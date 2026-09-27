import { generateTextWithGateway, type AiModelDescriptor } from '../../ai/gateway/gateway';
import type { AiProvider } from '../../ai/gateway/types';

export async function runChat(
  providers: readonly AiProvider[],
  model: AiModelDescriptor,
  prompt: string,
  rolePrompt?: string,
): Promise<string> {
  const input = rolePrompt === undefined ? { prompt } : { prompt, rolePrompt };
  const result = await generateTextWithGateway(providers, model, input);
  return result.text;
}
