import { describe, it, expect } from 'vitest';
import { predictIntercept, createAI, updateAI, AI_LEVELS } from '../src/ai.js';
import { createGame } from '../src/game.js';
import { vec } from '../src/vec.js';
import { TABLE } from '../src/constants.js';

const swing = { vel: vec(0, 0, -3), buttons: { left: false, right: false } };

function play(game, ai, seconds) {
  for (let i = 0; i < seconds * 60; i++) {
    updateAI(ai, game, 1 / 60);
    game.update(1 / 60);
  }
}

describe('ai', () => {
  it('predicts an intercept beyond the far-side bounce', () => {
    const p = predictIntercept({ pos: vec(0.2, 1.1, 1.4), vel: vec(-0.3, 1.5, -6), spin: vec() });
    expect(p).not.toBe(null);
    expect(p.z).toBeLessThan(0);
    expect(p.y).toBeGreaterThan(TABLE.height);
  });

  it('returns null for a ball that is going out', () => {
    expect(predictIntercept({ pos: vec(0, 1.1, 1.4), vel: vec(0, 4, -14), spin: vec() })).toBe(null);
  });

  it('with zero error it returns a normal shot', () => {
    const g = createGame({});
    const ai = createAI(() => 0.5);
    g.update(1 / 60);
    g.forceHit('near', swing);
    play(g, ai, 2.5);
    expect(g.hitCount).toBeGreaterThanOrEqual(2);
  });

  it('with alreadyBounced tracks a ball past its far-side bounce, but not without it', () => {
    const ball = { pos: vec(0, 0.78, -0.8), vel: vec(0, 2.5, -5), spin: vec() };
    const p = predictIntercept(ball, true);
    expect(p).not.toBe(null);
    expect(p.z).toBeLessThan(-0.8);
    expect(p.y).toBeGreaterThan(0.78);
    expect(predictIntercept(ball, false)).toBe(null);
  });

  it.each([
    ['vec(0,0,-3)', vec(0, 0, -3)],
    ['vec(2,0,-4)', vec(2, 0, -4)],
    ['vec(-2,0,-6)', vec(-2, 0, -6)],
  ])('the CPU hits back a near swing of %s after its own bounce', (_label, vel) => {
    const g = createGame({});
    const ai = createAI(() => 0.5);
    g.update(1 / 60);
    g.forceHit('near', { vel, buttons: { left: false, right: false } });
    let checked = false;
    for (let i = 0; i < 60 * 5; i++) {
      updateAI(ai, g, 1 / 60);
      g.update(1 / 60);
      if (g.ball.pos.z <= g.far.pos.z || g.hitCount >= 2) {
        expect(g.hitCount).toBeGreaterThanOrEqual(2);
        checked = true;
        break;
      }
    }
    expect(checked).toBe(true);
  });

  it('serves when it is its turn', () => {
    const sides = [];
    const g = createGame({ firstServer: 'far', hooks: { onHit: (side) => sides.push(side) } });
    const ai = createAI(() => 0.5);
    play(g, ai, 2);
    expect(sides[0]).toBe('far');
  });
  describe('difficulty levels', () => {
    const swingAt = (level, r) => {
      const g = createGame({});
      const ai = createAI(() => r, level);
      updateAI(ai, g, 1 / 60);
      return g.far.synthetic;
    };

    it('easy swings slower and aims narrower than medium, medium than hard', () => {
      const [e, m, h] = ['easy', 'medium', 'hard'].map((l) => swingAt(l, 0.999));
      expect(e.vel.z).toBeLessThan(m.vel.z);
      expect(m.vel.z).toBeLessThan(h.vel.z);
      expect(Math.abs(e.vel.x)).toBeLessThan(Math.abs(m.vel.x));
      expect(Math.abs(m.vel.x)).toBeLessThan(Math.abs(h.vel.x));
      // easy never out-swings ~1.2 m/s → ball speed stays under ~7 m/s
      expect(e.vel.z).toBeLessThanOrEqual(1.2);
    });

    it('easy is slower on its feet and less accurate', () => {
      expect(AI_LEVELS.easy.speed).toBeLessThan(AI_LEVELS.medium.speed);
      expect(AI_LEVELS.medium.speed).toBeLessThan(AI_LEVELS.hard.speed);
      expect(AI_LEVELS.easy.error).toBeGreaterThan(AI_LEVELS.hard.error);
    });

    it('easy rarely uses spin buttons, and defaults/unknown levels mean hard', () => {
      expect(swingAt('easy', 0.3).buttons).toEqual({ left: false, right: false });
      expect(swingAt('hard', 0.3).buttons.left).toBe(true);
      expect(swingAt(undefined, 0.999)).toEqual(swingAt('hard', 0.999));
      expect(swingAt('nope', 0.999)).toEqual(swingAt('hard', 0.999));
    });

    it('easy still returns an ordinary shot', () => {
      const g = createGame({});
      const ai = createAI(() => 0.5, 'easy');
      g.update(1 / 60);
      g.forceHit('near', { vel: vec(0, 0, -3), buttons: { left: false, right: false } });
      play(g, ai, 2.5);
      expect(g.hitCount).toBeGreaterThanOrEqual(2);
    });
  });
});
