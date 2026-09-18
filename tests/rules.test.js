import { describe, it, expect } from 'vitest';
import { createRules, serverFor, other } from '../src/rules.js';

const bounce = (side) => ({ type: 'bounce', side });
const floor = { type: 'floor' };

describe('rules', () => {
  it('other flips sides', () => {
    expect(other('near')).toBe('far');
    expect(other('far')).toBe('near');
  });

  it('only the server can hit while serving', () => {
    const r = createRules('near');
    expect(r.canHit('far')).toBe(false);
    expect(r.onHit('far')).toBe(false);
    expect(r.onHit('near')).toBe(true);
    expect(r.state).toBe('rally');
    expect(r.lastHitter).toBe('near');
  });

  it('receiver can hit only after exactly one bounce on their side', () => {
    const r = createRules('near');
    r.onHit('near');
    expect(r.canHit('far')).toBe(false);
    expect(r.onEvent(bounce('far'))).toBe(null);
    expect(r.canHit('far')).toBe(true);
    expect(r.canHit('near')).toBe(false);
  });

  it('bounce on hitter side loses the point', () => {
    const r = createRules('near');
    r.onHit('near');
    expect(r.onEvent(bounce('near'))).toEqual({ winner: 'far', reason: 'own-side' });
  });

  it('floor without bounce is out, floor after one bounce is a miss', () => {
    const r = createRules('near');
    r.onHit('near');
    expect(r.onEvent(floor)).toEqual({ winner: 'far', reason: 'out' });
    const r2 = createRules('near');
    r2.onHit('near');
    r2.onEvent(bounce('far'));
    expect(r2.onEvent(floor)).toEqual({ winner: 'near', reason: 'missed' });
  });

  it('double bounce wins the point for the hitter', () => {
    const r = createRules('near');
    r.onHit('near');
    r.onEvent(bounce('far'));
    expect(r.onEvent(bounce('far'))).toEqual({ winner: 'near', reason: 'double-bounce' });
  });

  it('net events and events outside a rally decide nothing', () => {
    const r = createRules('near');
    expect(r.onEvent(floor)).toBe(null);
    r.onHit('near');
    expect(r.onEvent({ type: 'net' })).toBe(null);
  });

  it('onEvent never changes the score', () => {
    const r = createRules('near');
    r.onHit('near');
    r.onEvent(floor);
    expect(r.score).toEqual({ near: 0, far: 0 });
    expect(r.state).toBe('rally');
  });

  it('serve alternates every two points, every point from 10-10', () => {
    expect(serverFor({ near: 0, far: 0 }, 'near')).toBe('near');
    expect(serverFor({ near: 1, far: 0 }, 'near')).toBe('near');
    expect(serverFor({ near: 1, far: 1 }, 'near')).toBe('far');
    expect(serverFor({ near: 2, far: 2 }, 'near')).toBe('near');
    expect(serverFor({ near: 10, far: 10 }, 'near')).toBe('near');
    expect(serverFor({ near: 11, far: 10 }, 'near')).toBe('far');
    expect(serverFor({ near: 11, far: 11 }, 'near')).toBe('near');
  });

  it('awardPoint resets rally state and rotates server', () => {
    const r = createRules('near');
    r.onHit('near');
    r.awardPoint('near');
    r.onHit('near');
    r.awardPoint('near');
    expect(r.score.near).toBe(2);
    expect(r.state).toBe('serving');
    expect(r.server).toBe('far');
    expect(r.lastHitter).toBe(null);
  });

  it('game ends at 11 with a 2 point lead', () => {
    const r = createRules('near');
    for (let i = 0; i < 10; i++) r.awardPoint('near');
    for (let i = 0; i < 10; i++) r.awardPoint('far');
    r.awardPoint('near');
    expect(r.state).toBe('serving');
    r.awardPoint('near');
    expect(r.state).toBe('over');
    expect(r.winner).toBe('near');
    r.awardPoint('far');
    expect(r.score).toEqual({ near: 12, far: 10 });
  });

  it('setScore recomputes server and game over', () => {
    const r = createRules('far');
    r.setScore(1, 1);
    expect(r.server).toBe('near');
    r.setScore(11, 3);
    expect(r.state).toBe('over');
    expect(r.winner).toBe('near');
  });
});
