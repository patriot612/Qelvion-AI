export type HeavyTaskType = 'image' | 'document' | 'audio' | 'voice';

export interface HeavyTaskMessage {
  taskId: string;
  operationId: string;
  userId: string;
  type: HeavyTaskType;
  model: string;
  prompt: string;
  templateKey: string | null;
  metadata: Record<string, string | number | boolean | null>;
}
