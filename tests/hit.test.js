import { describe, it, expect } from 'vitest';
import { computeHit } from '../src/hit.js';
import { flightResult } from '../src/physics.js';
import { vec, len } from '../src/vec.js';
import { MIN_SPEED, MAX_SPEED, TABLE } from '../src/constants.js';

const incoming = () => ({ pos: vec(0, 1.0, 1.5), vel: vec(0, -0.5, 3), spin: vec() });
const paddle = (vel, buttons = {}) => ({
  pos: vec(0, 1.0, 1.5),
  vel,
  buttons: { left: false, right: false, ...buttons },
});

function land(ball, hit) {
  return flightResult({ pos: ball.pos, vel: hit.vel, spin: hit.spin });
}

describe('computeHit', () => {
  it('sends the ball toward the opponent', () => {
    const h = computeHit(incoming(), paddle(vec(0, 0, -3)));
    expect(h.vel.z).toBeLessThan(0);
  });

  it('a normal swing lands on the far half of the table', () => {
    for (const buttons of [{}, { left: true }, { right: true }]) {
      const b = incoming();
      const r = land(b, computeHit(b, paddle(vec(0, 0, -3), buttons)));
      expect(r.type).toBe('bounce');
      expect(r.side).toBe('far');
      expect(Math.abs(r.pos.x)).toBeLessThan(TABLE.width / 2);
    }
  });

  it('even a stationary paddle returns the ball over the net', () => {
    const b = incoming();
    const r = land(b, computeHit(b, paddle(vec())));
    expect(r.type).toBe('bounce');
    expect(r.side).toBe('far');
  });

  it('faster forward swing gives a faster ball, clamped to MAX_SPEED', () => {
    const slow = len(computeHit(incoming(), paddle(vec(0, 0, -2))).vel);
    const fast = len(computeHit(incoming(), paddle(vec(0, 0, -5))).vel);
    const insane = len(computeHit(incoming(), paddle(vec(0, 0, -100))).vel);
    expect(slow).toBeGreaterThanOrEqual(MIN_SPEED - 1e-9);
    expect(fast).toBeGreaterThan(slow);
    expect(insane).toBeLessThanOrEqual(MAX_SPEED + 1e-9);
  });

  it('lateral swing aims the ball', () => {
    expect(computeHit(incoming(), paddle(vec(3, 0, -3))).vel.x).toBeGreaterThan(0);
    expect(computeHit(incoming(), paddle(vec(-3, 0, -3))).vel.x).toBeLessThan(0);
  });

  it('left button = topspin, right button = backspin, none = light topspin', () => {
    const top = computeHit(incoming(), paddle(vec(0, 0, -4), { left: true })).spin.x;
    const back = computeHit(incoming(), paddle(vec(0, 0, -4), { right: true })).spin.x;
    const flat = computeHit(incoming(), paddle(vec(0, 0, -4))).spin.x;
    expect(top).toBeLessThan(-200);
    expect(back).toBeGreaterThan(200);
    expect(flat).toBeLessThan(0);
    expect(flat).toBeGreaterThan(top);
  });

  it('hard lateral swing adds sidespin, gentle one does not', () => {
    expect(computeHit(incoming(), paddle(vec(4, 0, -3))).spin.y).toBeGreaterThan(0);
    expect(computeHit(incoming(), paddle(vec(-4, 0, -3))).spin.y).toBeLessThan(0);
    expect(computeHit(incoming(), paddle(vec(0.5, 0, -3))).spin.y).toBe(0);
  });

  it('a flat max-power smash goes long, the same smash with topspin lands', () => {
    const b = incoming();
    const flat = land(b, computeHit(b, paddle(vec(0, 0, -100))));
    const top = land(b, computeHit(b, paddle(vec(0, 0, -100), { left: true })));
    expect(flat.type === 'bounce' && flat.side === 'far').toBe(false);
    expect(top.type).toBe('bounce');
    expect(top.side).toBe('far');
  });
});
