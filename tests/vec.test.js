import { describe, it, expect } from 'vitest';
import { vec, add, sub, scale, cross, len, mirror, cloneBall, mirrorBall } from '../src/vec.js';

describe('vec', () => {
  it('basic ops', () => {
    expect(add(vec(1, 2, 3), vec(1, 1, 1))).toEqual({ x: 2, y: 3, z: 4 });
    expect(sub(vec(1, 2, 3), vec(1, 1, 1))).toEqual({ x: 0, y: 1, z: 2 });
    expect(scale(vec(1, 2, 3), 2)).toEqual({ x: 2, y: 4, z: 6 });
    expect(len(vec(3, 4, 0))).toBe(5);
  });

  it('cross follows right-hand rule', () => {
    expect(cross(vec(1, 0, 0), vec(0, 1, 0))).toEqual({ x: 0, y: 0, z: 1 });
  });

  it('mirror is an involution and keeps y', () => {
    const v = vec(1, 2, 3);
    expect(mirror(v)).toEqual({ x: -1, y: 2, z: -3 });
    expect(mirror(mirror(v))).toEqual(v);
  });

  it('cloneBall is deep, mirrorBall mirrors all parts', () => {
    const b = { pos: vec(1, 2, 3), vel: vec(4, 5, 6), spin: vec(7, 8, 9) };
    const c = cloneBall(b);
    c.pos.x = 99;
    expect(b.pos.x).toBe(1);
    expect(mirrorBall(b)).toEqual({ pos: vec(-1, 2, -3), vel: vec(-4, 5, -6), spin: vec(-7, 8, -9) });
    expect(mirrorBall(mirrorBall(b))).toEqual(b);
  });
});
