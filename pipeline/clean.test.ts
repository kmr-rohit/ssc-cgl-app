import { describe, expect, it } from 'vitest';
import { cleanSourceText, solutionNeedsWork } from './clean';

describe('cleanSourceText', () => {
  it('keeps the longest English version and drops payload markers and app data', () => {
    expect(cleanSourceText('हिंदी में व्याख्या\n\n16b:Tba1,\n\nHere the correct answer is **Kill**. It means to end life.')).toBe('Here the correct answer is **Kill**. It means to end life.');
    expect(cleanSourceText('Therefore, option 1 is correct.\n\n161:Td04,')).toBe('Therefore, option 1 is correct.');
    expect(cleanSourceText('Answer is B.\n\ne:["$","$L2d",null,{"testData":{"title":"x"}}]')).toBe('Answer is B.');
    expect(cleanSourceText('Plain solution, nothing to clean.')).toBe('Plain solution, nothing to clean.');
  });
});

describe('solutionNeedsWork', () => {
  it('flags thin and cut-off solutions but not complete ones', () => {
    expect(solutionNeedsWork('B')).toBe('short');
    expect(solutionNeedsWork('The word means to recover after a long illness and return to normal strength or value after a period of')).toBe('truncated');
    expect(solutionNeedsWork('The relation is organ and the disease of that organ. Hence, Skin : Acne is the correct answer')).toBeNull();
    expect(solutionNeedsWork('Using the formula 2^n = 4096 we get n = 12 address lines, so option B is correct.')).toBeNull();
  });
});
