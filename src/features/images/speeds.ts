export type ImageSpeed = 'fast' | 'standard' | 'long';

export interface ImageSpeedConfig {
  fast: number;
  standard: number;
  long: number;
}

export function speedCost(speed: ImageSpeed, config: ImageSpeedConfig): number {
  return config[speed];
}
