import type { AiCapability, AiMediaResult, AiProvider, AiTextResult, GenerateMediaInput, GenerateTextInput } from './types';
import { DomainError } from '../../core/errors/domain';

export interface AiModelDescriptor {
  key: string;
  provider: string;
  providerModelId: string;
  capabilities: readonly AiCapability[];
}

function resolveProvider(providers: readonly AiProvider[], descriptor: AiModelDescriptor, capability: AiCapability): AiProvider {
  if (!descriptor.capabilities.includes(capability)) {
    throw new DomainError('INVALID_INPUT', `Model ${descriptor.key} does not support ${capability}`);
  }
  const provider = providers.find(
    (candidate) => candidate.name === descriptor.provider && candidate.supports(capability, descriptor.providerModelId),
  );
  if (!provider) throw new DomainError('PROVIDER_ERROR', `No configured provider for ${descriptor.key}`, false);
  return provider;
}

export async function generateTextWithGateway(
  providers: readonly AiProvider[],
  descriptor: AiModelDescriptor,
  input: Omit<GenerateTextInput, 'model'>,
  capability: AiCapability = 'chat',
): Promise<AiTextResult> {
  const provider = resolveProvider(providers, descriptor, capability);
  return provider.generateText({ ...input, model: descriptor.providerModelId });
}

export async function generateMediaWithGateway(
  providers: readonly AiProvider[],
  descriptor: AiModelDescriptor,
  capability: Extract<AiCapability, 'image' | 'audio' | 'document'>,
  input: Omit<GenerateMediaInput, 'model'>,
): Promise<AiMediaResult> {
  const provider = resolveProvider(providers, descriptor, capability);
  if (!provider.generateMedia) {
    throw new DomainError('PROVIDER_ERROR', `Provider ${provider.name} does not implement ${capability}`, false);
  }
  return provider.generateMedia(capability, { ...input, model: descriptor.providerModelId });
}
