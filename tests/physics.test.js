import { describe, it, expect } from 'vitest';
import { stepBall, flightResult } from '../src/physics.js';
import { vec, cloneBall } from '../src/vec.js';
import { TABLE, BALL_RADIUS, DT } from '../src/constants.js';

const ball = (pos, vel, spin = vec()) => ({ pos, vel, spin });

function runUntil(b, type, maxSteps = 2000) {
  for (let i = 0; i < maxSteps; i++) {
    const ev = stepBall(b).find((e) => e.type === type);
    if (ev) return ev;
  }
  return null;
}

describe('stepBall', () => {
  it('falls under gravity', () => {
    const b = ball(vec(0, 2, 1), vec());
    stepBall(b);
    expect(b.vel.y).toBeLessThan(0);
    expect(b.vel.y).toBeCloseTo(-9.81 * DT, 5);
  });

  it('bounces on the table with restitution and reports the side', () => {
    const b = ball(vec(0, 1.0, 0.7), vec());
    const ev = runUntil(b, 'bounce');
    expect(ev).toEqual({ type: 'bounce', side: 'near' });
    expect(b.vel.y).toBeGreaterThan(0);
    expect(b.pos.y).toBeCloseTo(TABLE.height + BALL_RADIUS, 6);
    const b2 = ball(vec(0, 1.0, -0.7), vec());
    expect(runUntil(b2, 'bounce').side).toBe('far');
  });

  it('does not bounce outside the table, hits the floor instead', () => {
    const b = ball(vec(2, 1.0, 0.7), vec());
    const events = [];
    for (let i = 0; i < 400 && !events.some((e) => e.type === 'floor'); i++) events.push(...stepBall(b));
    expect(events.some((e) => e.type === 'bounce')).toBe(false);
    expect(events.some((e) => e.type === 'floor')).toBe(true);
  });

  it('topspin leaves the bounce faster than backspin', () => {
    const top = ball(vec(0, 1.0, -0.3), vec(0, 0, -5), vec(-480, 0, 0));
    const back = ball(vec(0, 1.0, -0.3), vec(0, 0, -5), vec(480, 0, 0));
    runUntil(top, 'bounce');
    runUntil(back, 'bounce');
    expect(Math.abs(top.vel.z)).toBeGreaterThan(Math.abs(back.vel.z));
  });

  it('topspin dips, backspin floats (Magnus)', () => {
    const top = ball(vec(0, 1.2, 1.3), vec(0, 1, -8), vec(-480, 0, 0));
    const back = ball(vec(0, 1.2, 1.3), vec(0, 1, -8), vec(480, 0, 0));
    for (let i = 0; i < 48; i++) {
      stepBall(top);
      stepBall(back);
    }
    expect(top.pos.y).toBeLessThan(back.pos.y);
  });

  it('positive y spin curves a -z ball toward -x', () => {
    const b = ball(vec(0, 1.2, 1.3), vec(0, 1, -8), vec(0, 320, 0));
    for (let i = 0; i < 48; i++) stepBall(b);
    expect(b.pos.x).toBeLessThan(-0.01);
  });

  it('sidespin kicks the bounce sideways', () => {
    const b = ball(vec(0, 1.0, -0.3), vec(0, 0, -5), vec(0, 320, 0));
    const plain = ball(vec(0, 1.0, -0.3), vec(0, 0, -5));
    runUntil(b, 'bounce');
    runUntil(plain, 'bounce');
    expect(b.vel.x).toBeLessThan(plain.vel.x - 0.05);
  });

  it('low ball hits the net and stays on the hitter side', () => {
    const b = ball(vec(0, 0.85, 0.5), vec(0, 0, -6));
    const ev = runUntil(b, 'net');
    expect(ev).toEqual({ type: 'net' });
    expect(b.pos.z).toBeGreaterThan(0);
    expect(b.vel.z).toBeGreaterThan(0);
  });

  it('high ball clears the net', () => {
    const b = ball(vec(0, 1.2, 0.5), vec(0, 1, -6));
    const events = [];
    for (let i = 0; i < 100; i++) events.push(...stepBall(b));
    expect(events.some((e) => e.type === 'net')).toBe(false);
    expect(b.pos.z).toBeLessThan(0);
  });

  it('is deterministic', () => {
    const a = ball(vec(0.1, 1.1, 1.2), vec(0.5, 1.2, -7), vec(-60, 30, 5));
    const b = cloneBall(a);
    for (let i = 0; i < 500; i++) {
      stepBall(a);
      stepBall(b);
    }
    expect(a).toEqual(b);
  });
});

describe('flightResult', () => {
  it('reports first event without mutating the input', () => {
    const b = ball(vec(0, 1.1, 1.4), vec(0, 1.5, -6));
    const before = cloneBall(b);
    const r = flightResult(b);
    expect(b).toEqual(before);
    expect(r.type).toBe('bounce');
    expect(r.side).toBe('far');
    expect(r.pos.z).toBeLessThan(0);
  });
});
