export type AiCapability = 'chat' | 'search-editor' | 'image' | 'audio' | 'document' | 'vision' | 'structured';

export interface GenerateTextInput {
  model: string;
  prompt: string;
  rolePrompt?: string;
  systemPrompt?: string;
}

export interface GenerateMediaInput {
  model: string;
  prompt: string;
  input?: string;
  voice?: string;
  format?: string;
  size?: string;
}

export interface AiTextResult {
  text: string;
  provider: string;
  model: string;
  usage?: { inputTokens?: number; outputTokens?: number };
}

export interface AiMediaResult {
  result: string;
  provider: string;
  model: string;
  mimeType?: string;
}

export interface AiProvider {
  readonly name: string;
  supports(capability: AiCapability, model: string): boolean;
  generateText(input: GenerateTextInput): Promise<AiTextResult>;
  generateMedia?(capability: Extract<AiCapability, 'image' | 'audio' | 'document'>, input: GenerateMediaInput): Promise<AiMediaResult>;
}
