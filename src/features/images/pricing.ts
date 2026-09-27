export interface ImagePriceInput {
  modelCost: number;
  speedCost: number;
  templateCost: number;
}

export function calculateImageCost(input: ImagePriceInput): number {
  return input.modelCost + input.speedCost + input.templateCost;
}
