import { describe, expect, it } from 'vitest';
import { generateMediaWithGateway } from '../../src/ai/gateway/gateway';
import type { AiProvider } from '../../src/ai/gateway/types';

describe('AI media gateway', () => {
  it('routes media by provider/model descriptor instead of calling a provider directly', async () => {
    const provider: AiProvider = {
      name: 'test',
      supports: (capability, model) => capability === 'image' && model === 'image-1',
      generateText: async () => ({ text: 'unused', provider: 'test', model: 'image-1' }),
      generateMedia: async (_capability, input) => ({ result: `ok:${input.model}:${input.prompt}`, provider: 'test', model: input.model }),
    };
    const result = await generateMediaWithGateway(
      [provider],
      { key: 'image-model', provider: 'test', providerModelId: 'image-1', capabilities: ['image'] },
      'image',
      { prompt: 'draw' },
    );
    expect(result.result).toBe('ok:image-1:draw');
  });
});
