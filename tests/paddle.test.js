import { describe, it, expect } from 'vitest';
import { createPaddle, movePaddle, setPaddleXZ, samplePaddle, trackHeight } from '../src/paddle.js';
import { PADDLE_BOUNDS, PADDLE_HOME, MOUSE_SENS } from '../src/constants.js';

describe('paddle', () => {
  it('starts at home', () => {
    expect(createPaddle().pos).toEqual(PADDLE_HOME);
  });

  it('mouse right moves +x, mouse forward (negative dy) moves toward the net', () => {
    const p = createPaddle();
    movePaddle(p, 100, -100);
    expect(p.pos.x).toBeCloseTo(100 * MOUSE_SENS);
    expect(p.pos.z).toBeCloseTo(PADDLE_HOME.z - 100 * MOUSE_SENS);
  });

  it('clamps to bounds', () => {
    const p = createPaddle();
    movePaddle(p, 1e6, 1e6);
    expect(p.pos.x).toBe(PADDLE_BOUNDS.xMax);
    expect(p.pos.z).toBe(PADDLE_BOUNDS.zMax);
    setPaddleXZ(p, -99, -99);
    expect(p.pos.x).toBe(PADDLE_BOUNDS.xMin);
    expect(p.pos.z).toBe(PADDLE_BOUNDS.zMin);
  });

  it('velocity comes from recent history and decays to zero when still', () => {
    const p = createPaddle();
    samplePaddle(p, 0);
    setPaddleXZ(p, 0.1, 1.5);
    samplePaddle(p, 0.02);
    expect(p.vel.x).toBeCloseTo(5);
    expect(p.vel.z).toBeCloseTo(-10);
    for (let t = 0.03; t < 0.2; t += 0.01) samplePaddle(p, t);
    expect(p.vel.x).toBeCloseTo(0);
    expect(p.vel.z).toBeCloseTo(0);
  });

  it('tracks ball height only when following', () => {
    const p = createPaddle();
    for (let i = 0; i < 60; i++) trackHeight(p, 1.3, true, 1 / 60);
    expect(p.pos.y).toBeCloseTo(1.3, 1);
    for (let i = 0; i < 60; i++) trackHeight(p, 1.3, false, 1 / 60);
    expect(p.pos.y).toBeCloseTo(PADDLE_HOME.y, 1);
  });
});
