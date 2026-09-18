import { describe, it, expect } from 'vitest';
import { isVec, isBall, isSide, isScore } from '../src/validate.js';

const v = (x = 0, y = 0, z = 0) => ({ x, y, z });
const ball = () => ({ pos: v(1, 2, 3), vel: v(-1, 0, 4), spin: v(0, 10, 0) });

describe('isVec', () => {
  it('accepts objects with three finite numbers', () => {
    expect(isVec(v())).toBe(true);
    expect(isVec(v(-1.5, 0.2, 1e6))).toBe(true);
    expect(isVec({ x: 1, y: 2, z: 3, extra: 'ok' })).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of [undefined, null, 0, 1, '', 'x,y,z', true, [], [1, 2, 3], () => {}]) {
      expect(isVec(bad)).toBe(false);
    }
    expect(isVec({ x: 1, y: 2 })).toBe(false);
    expect(isVec({ x: NaN, y: 0, z: 0 })).toBe(false);
    expect(isVec({ x: 0, y: Infinity, z: 0 })).toBe(false);
    expect(isVec({ x: 0, y: 0, z: -Infinity })).toBe(false);
    expect(isVec({ x: '1', y: 2, z: 3 })).toBe(false);
    expect(isVec({ x: null, y: 2, z: 3 })).toBe(false);
  });
});

describe('isBall', () => {
  it('accepts a ball whose pos, vel and spin are vectors', () => {
    expect(isBall(ball())).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of [undefined, null, 0, 'ball', true, [], () => {}]) {
      expect(isBall(bad)).toBe(false);
    }
    expect(isBall({})).toBe(false);
    expect(isBall({ pos: v(), vel: v() })).toBe(false); // no spin
    expect(isBall({ ...ball(), vel: null })).toBe(false);
    expect(isBall({ ...ball(), spin: [0, 0, 0] })).toBe(false);
    expect(isBall({ ...ball(), pos: { x: 0, y: NaN, z: 0 } })).toBe(false);
    expect(isBall({ ...ball(), vel: { x: Infinity, y: 0, z: 0 } })).toBe(false);
  });
});

describe('isSide', () => {
  it('accepts only the two side names', () => {
    expect(isSide('near')).toBe(true);
    expect(isSide('far')).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of [undefined, null, 0, '', 'NEAR', 'left', true, ['near'], { side: 'near' }]) {
      expect(isSide(bad)).toBe(false);
    }
  });
});

describe('isScore', () => {
  it('accepts integers from 0 to 99', () => {
    expect(isScore(0)).toBe(true);
    expect(isScore(11)).toBe(true);
    expect(isScore(99)).toBe(true);
  });

  it('rejects anything else', () => {
    for (const bad of [undefined, null, '', '3', true, [], [3], NaN, Infinity, -Infinity]) {
      expect(isScore(bad)).toBe(false);
    }
    expect(isScore(-1)).toBe(false);
    expect(isScore(100)).toBe(false);
    expect(isScore(1.5)).toBe(false);
  });
});
