import type { AiProvider } from '../../ai/gateway/types';
import { generateMediaWithGateway } from '../../ai/gateway/gateway';
import type { AiModelDescriptor } from '../../ai/gateway/gateway';
import type { HeavyTaskMessage } from '../tasks/types';

export async function executeMediaTask(
  providers: readonly AiProvider[],
  model: AiModelDescriptor,
  task: HeavyTaskMessage,
): Promise<string> {
  const capability = task.type === 'voice' ? 'audio' : task.type;
  const result = await generateMediaWithGateway(providers, model, capability, {
    prompt: task.prompt,
    input: typeof task.metadata.input === 'string' ? task.metadata.input : task.prompt,
    voice: typeof task.metadata.voice === 'string' ? task.metadata.voice : undefined,
    format: typeof task.metadata.format === 'string' ? task.metadata.format : task.type === 'voice' ? 'opus' : task.type === 'audio' ? 'mp3' : undefined,
    size: typeof task.metadata.size === 'string' ? task.metadata.size : undefined,
  });
  return result.result;
}
