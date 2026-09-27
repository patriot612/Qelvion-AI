import { generateTextWithGateway, type AiModelDescriptor } from '../../ai/gateway/gateway';
import type { AiProvider } from '../../ai/gateway/types';

export async function runChat(
  providers: readonly AiProvider[],
  model: AiModelDescriptor,
  prompt: string,
  rolePrompt?: string,
): Promise<string> {
  const result = await generateTextWithGateway(providers, model, { prompt, rolePrompt });
  return result.text;
}
