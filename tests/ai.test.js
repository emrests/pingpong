import { describe, it, expect } from 'vitest';
import { predictIntercept, createAI, updateAI } from '../src/ai.js';
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

  it('serves when it is its turn', () => {
    const g = createGame({ firstServer: 'far' });
    const ai = createAI(() => 0.5);
    play(g, ai, 2);
    expect(g.rules.lastHitter === 'far' || g.rules.score.near + g.rules.score.far > 0).toBe(true);
    expect(g.hitCount).toBeGreaterThanOrEqual(1);
  });
});
