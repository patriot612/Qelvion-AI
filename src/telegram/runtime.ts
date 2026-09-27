import type { AiProvider } from '../ai/gateway/types';
import { createOpenAIProvider } from '../ai/providers/openai';
import { createAnthropicProvider } from '../ai/providers/anthropic';
import { createGoogleProvider } from '../ai/providers/google';
import { createOpenRouterProvider } from '../ai/providers/openrouter';
import { D1ModelRegistry } from '../ai/registry';
import { D1OperationRepository } from '../db/repositories/operations';
import { D1PointRepository } from '../db/repositories/points';
import { D1UserRepository } from '../db/repositories/users';
import { D1DialogRepository } from '../db/repositories/dialogs';
import { D1RoleRepository } from '../db/repositories/roles';
import { D1DailyPointsRepository } from '../db/repositories/daily-points';
import type { Env } from '../env';
import { runChat } from '../features/chat/service';
import { executeSearch } from '../features/search/service';
import { resolveDialogLimits } from '../features/dialogs/service';
import { D1ConfigRepository } from '../db/repositories/config';
import { createReservedOperation, settleOperation } from '../core/operations/service';
import { enqueueHeavyTask } from '../queue/producer/enqueue';

export function createProviders(env: Env): AiProvider[] {
  return [createOpenAIProvider(env.OPENAI_API_KEY), createAnthropicProvider(env.ANTHROPIC_API_KEY), createGoogleProvider(env.GOOGLE_AI_API_KEY), createOpenRouterProvider(env.OPENROUTER_API_KEY)].filter((p): p is AiProvider => Boolean(p));
}

export function createRuntime(env: Env) {
  const users = new D1UserRepository(env.QELVION_DB);
  const dialogs = new D1DialogRepository(env.QELVION_DB);
  const roles = new D1RoleRepository(env.QELVION_DB);
  const models = new D1ModelRegistry(env.QELVION_DB);
  const operations = new D1OperationRepository(env.QELVION_DB);
  const points = new D1PointRepository(env.QELVION_DB);
  const dailyPoints = new D1DailyPointsRepository(env.QELVION_DB);
  const providers = createProviders(env);
  const config = new D1ConfigRepository(env.QELVION_DB);

  return {
    users, dialogs, roles, models, operations, points, providers,
    async recentOperations() { return operations.listRecent(); },
    async prepareUser(telegramUserId: number) {
      const user = await users.getOrCreate(telegramUserId);
      const tariff = await config.getJson<string>('default.tariff', user.subscription_status || 'free');
      const dailyGrant = await config.getJson<number>(`daily.${tariff}.points`, await config.getJson<number>('daily.free.points', 50));
      return dailyPoints.ensureCurrent(user, dailyGrant);
    },
    async chat(telegramUserId: number, prompt: string, requestId = `telegram:${crypto.randomUUID()}`) {
      const user = await this.prepareUser(telegramUserId);
      if (user.status !== 'active') throw new Error('User is blocked');
      const limits = await resolveDialogLimits(env.QELVION_DB, user.subscription_status || 'free');
      const dialog = await dialogs.ensureActive(user.id, limits);
      const model = await models.getDefault('chat');
      if (!model) throw new Error('No active chat model is configured');
      const role = await roles.getActive((await config.getJson<string>('chat.role', '')) || 'writer');
      const turnToken = crypto.randomUUID();
      await dialogs.claimTurn(dialog.dialogId, turnToken);
      let operationId: string | null = null;
      try {
        const history = await dialogs.history(dialog.dialogId, 20);
        const historyPrompt = history.length ? history.map((item) => `${item.role === 'assistant' ? 'Assistant' : 'User'}: ${item.content}`).join('\\n') + '\\n\\n' : '';
        const requestCost = model.pointCost;
        operationId = crypto.randomUUID();
        const now = new Date().toISOString();
        await createReservedOperation(operations, points, { operationId, requestId, userId: user.id, type: 'chat', provider: model.provider, model: model.providerModelId, cost: requestCost, attempt: 0, createdAt: now, startedAt: null, finishedAt: null, errorCode: null, metadataJson: JSON.stringify({ dialogId: dialog.dialogId, role: role?.key ?? null }) });
        let answer: string;
        try {
          await dialogs.addMessage(dialog.dialogId, 'user', prompt, limits);
          answer = await runChat(providers, model, `${historyPrompt}User: ${prompt}`, role?.prompt);
          await dialogs.addMessage(dialog.dialogId, 'assistant', answer, limits);
        } catch (error) {
          try { await settleOperation(operations, points, operationId, 'failure'); } catch { /* preserve original provider/data error */ }
          throw error;
        }
        await settleOperation(operations, points, operationId, 'success');
        return answer;
      } finally {
        await dialogs.releaseTurn(dialog.dialogId, turnToken);
      }
    },
    async enqueueMedia(telegramUserId: number, type: 'image' | 'document' | 'audio' | 'voice', prompt: string, requestId: string) {
      const user = await this.prepareUser(telegramUserId);
      if (user.status !== 'active') throw new Error('User is blocked');
      const capability = type === 'voice' ? 'audio' : type;
      const model = await models.getDefaultByCapability(capability);
      if (!model) throw new Error(`No active ${type} model is configured`);
      const operationId = crypto.randomUUID();
      const now = new Date().toISOString();
      await createReservedOperation(operations, points, { operationId, requestId, userId: user.id, type, provider: model.provider, model: model.providerModelId, cost: model.pointCost, attempt: 0, createdAt: now, startedAt: null, finishedAt: null, errorCode: null, metadataJson: JSON.stringify({ telegramUserId, prompt }) });
      try {
        await enqueueHeavyTask(env.HEAVY_TASK_QUEUE, { taskId: crypto.randomUUID(), operationId, userId: user.id, type, model: model.providerModelId, prompt, templateKey: null, metadata: { telegramUserId, input: prompt } });
      } catch (error) {
        await settleOperation(operations, points, operationId, 'failure');
        throw error;
      }
      return operationId;
    },
    async search(telegramUserId: number, query: string, requestId: string) {
      const user = await this.prepareUser(telegramUserId);
      if (user.status !== 'active') throw new Error('User is blocked');
      const model = await models.getDefault('search');
      if (!model) throw new Error('No active Search Editor model is configured');
      const searxngBaseUrl = env.SEARXNG_BASE_URL;
      if (!searxngBaseUrl) throw new Error('Search service is not configured');
      const searchDeps = {
        db: env.QELVION_DB,
        providers,
        operationRepository: operations,
        pointRepository: points,
        model,
        userId: user.id,
        requestId,
        searxngBaseUrl,
        ...(env.SEARXNG_USERNAME === undefined ? {} : { searxngUsername: env.SEARXNG_USERNAME }),
        ...(env.SEARXNG_PASSWORD === undefined ? {} : { searxngPassword: env.SEARXNG_PASSWORD }),
      };
      return executeSearch(searchDeps, query);
    },
  };
}
