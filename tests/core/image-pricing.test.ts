import { describe, expect, it } from 'vitest';
import { calculateImageCost } from '../../src/features/images/pricing';

describe('image pricing', () => {
  it('does not charge for image size/aspect ratio and sums only model, speed and template', () => {
    expect(calculateImageCost({ modelCost: 10, speedCost: 2, templateCost: 3 })).toBe(15);
  });
});
