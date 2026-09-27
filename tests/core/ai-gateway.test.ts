import { describe, expect, it } from 'vitest';
import { generateTextWithGateway } from '../../src/ai/gateway/gateway';
import type { AiProvider } from '../../src/ai/gateway/types';

describe('AI gateway', () => {
  it('routes a chat request through the configured provider', async () => {
    const provider: AiProvider = {
      name: 'test',
      supports: () => true,
      generateText: async (input) => ({ text: `ok:${input.model}`, provider: 'test', model: input.model }),
    };
    const result = await generateTextWithGateway(
      [provider],
      { key: 'model-1', provider: 'test', providerModelId: 'vendor-model', capabilities: ['chat'] },
      { prompt: 'hello' },
    );
    expect(result.text).toBe('ok:vendor-model');
  });
});


it('allows multiple model descriptors to share one provider credential adapter', async () => {
  const calls: string[] = [];
  const provider: AiProvider = {
    name: 'test',
    supports: (_capability, model) => ['a', 'b'].includes(model),
    generateText: async (input) => { calls.push(input.model); return { text: input.model, provider: 'test', model: input.model }; },
  };
  await generateTextWithGateway([provider], { key: 'one', provider: 'test', providerModelId: 'a', capabilities: ['chat'] }, { prompt: 'x' });
  await generateTextWithGateway([provider], { key: 'two', provider: 'test', providerModelId: 'b', capabilities: ['chat'] }, { prompt: 'x' });
  expect(calls).toEqual(['a', 'b']);
});
