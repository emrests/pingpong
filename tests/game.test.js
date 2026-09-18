import { describe, it, expect, vi } from 'vitest';
import { createGame } from '../src/game.js';
import { vec } from '../src/vec.js';
import { POINT_PAUSE } from '../src/constants.js';

const swing = { vel: vec(0, 0, -3), buttons: { left: false, right: false } };

function run(game, seconds, each) {
  const n = Math.round(seconds * 60);
  for (let i = 0; i < n; i++) {
    each?.();
    game.update(1 / 60);
  }
}

describe('game', () => {
  it('holds the ball at the server paddle', () => {
    const g = createGame({});
    g.near.pos.x = 0.4;
    g.update(1 / 60);
    expect(g.phase).toBe('held');
    expect(g.ball.pos.x).toBeCloseTo(0.4);
    expect(g.ball.pos.z).toBeLessThan(g.near.pos.z);

    const g2 = createGame({ firstServer: 'far' });
    g2.update(1 / 60);
    expect(g2.ball.pos.z).toBeGreaterThan(g2.far.pos.z);
    expect(g2.ball.pos.z).toBeLessThan(0);
  });

  it('toss only works for the current server and returns to held if not hit', () => {
    const onToss = vi.fn();
    const g = createGame({ hooks: { onToss } });
    expect(g.toss('far')).toBe(false);
    expect(g.toss('near')).toBe(true);
    expect(g.phase).toBe('tossed');
    expect(onToss).toHaveBeenCalledTimes(1);
    run(g, 2);
    expect(g.phase).toBe('held');
    expect(g.rules.score).toEqual({ near: 0, far: 0 });
  });

  it('swinging the paddle through a tossed ball serves it', () => {
    const onHit = vi.fn();
    const g = createGame({ hooks: { onHit } });
    g.far.pos.x = 1.3; // park the opponent out of the way so it can't auto-return the serve
    g.update(1 / 60);
    g.toss();
    // wait for the ball to come back down to paddle height, then push the paddle forward
    let served = false;
    run(g, 1.5, () => {
      if (g.phase === 'tossed' && g.ball.vel.y < 0 && g.ball.pos.y < 1.5) g.near.pos.z -= 0.04;
      if (g.phase === 'live') served = true;
    });
    expect(served).toBe(true);
    expect(onHit).toHaveBeenCalledWith('near');
    expect(g.ball.vel.z).toBeLessThan(0);
  });

  it('unreturned serve scores for the server, then resumes', () => {
    const onPoint = vi.fn();
    const g = createGame({ hooks: { onPoint } });
    g.far.pos.x = 1.3; // park the opponent out of the way
    g.update(1 / 60);
    expect(g.forceHit('near', swing)).toBe(true);
    expect(g.phase).toBe('live');
    run(g, 3);
    expect(onPoint).toHaveBeenCalledTimes(1);
    expect(onPoint.mock.calls[0][0].winner).toBe('near');
    expect(onPoint.mock.calls[0][1]).toBe(false);
    expect(g.rules.score).toEqual({ near: 1, far: 0 });
    run(g, POINT_PAUSE + 0.5);
    expect(g.phase).toBe('held');
  });

  it('far paddle in the ball path returns it (practice mode)', () => {
    const g = createGame({});
    g.update(1 / 60);
    g.forceHit('near', swing);
    g.far.synthetic = { vel: vec(0, 0, 3), buttons: { left: false, right: false } };
    run(g, 2, () => {
      // cheat: keep the far paddle glued to the ball's x
      g.far.pos.x = g.ball.pos.x;
    });
    expect(g.hitCount).toBeGreaterThanOrEqual(2);
  });

  it('online: does not judge its own shots, waits for the remote point', () => {
    const onPoint = vi.fn();
    const g = createGame({ online: true, hooks: { onPoint } });
    g.update(1 / 60);
    g.forceHit('near', swing);
    run(g, 3);
    expect(onPoint).not.toHaveBeenCalled();
    expect(g.rules.score).toEqual({ near: 0, far: 0 });
    g.applyRemotePoint('near', 'missed');
    expect(g.rules.score).toEqual({ near: 1, far: 0 });
    expect(onPoint.mock.calls[0][1]).toBe(true);
  });

  it('online: judges incoming shots (remote hit that I miss → point far)', () => {
    const onPoint = vi.fn();
    const g = createGame({ online: true, firstServer: 'far', hooks: { onPoint } });
    g.near.pos.x = 1.3;
    g.update(1 / 60);
    // a legal serve from the far side, expressed in local coordinates
    g.applyRemoteHit({ pos: vec(0, 1.1, -1.6), vel: vec(0, 1.2, 6), spin: vec() }, 0.05);
    expect(g.phase).toBe('live');
    expect(g.rules.lastHitter).toBe('far');
    run(g, 3);
    expect(onPoint).toHaveBeenCalledTimes(1);
    expect(onPoint.mock.calls[0][0]).toEqual({ winner: 'far', reason: 'missed' });
    expect(onPoint.mock.calls[0][1]).toBe(false);
  });

  it('online: accepts a remote hit that arrives after the local sim counted two bounces', () => {
    const g = createGame({ online: true });
    g.update(1 / 60);
    expect(g.forceHit('near', swing)).toBe(true);
    // let the shot land on the far side
    for (let i = 0; i < 180 && g.rules.bounces < 1; i++) g.update(1 / 60);
    expect(g.rules.bounces).toBe(1);
    // Stage the late-return race directly (rather than shaping a natural short
    // ball): the local sim counts the opponent's second bounce just before its
    // 'hit' message arrives.
    g.rules.bounces = 2;
    expect(g.rules.canHit('far')).toBe(false);

    g.applyRemoteHit({ pos: vec(0, 1.0, -0.6), vel: vec(0, 1.2, 6), spin: vec() }, 0);
    expect(g.rules.lastHitter).toBe('far');
    expect(g.phase).toBe('live');
  });

  it('online: replays the point as a let when the ball state goes bad', () => {
    const onLet = vi.fn();
    const g = createGame({ online: true, hooks: { onLet } });
    g.update(1 / 60);
    g.forceHit('near', swing);
    g.ball.pos.x = NaN;
    g.update(1 / 60);
    expect(g.phase).toBe('held');
    expect(g.rules.score).toEqual({ near: 0, far: 0 });
    expect(g.rules.server).toBe('near');
    expect(onLet).toHaveBeenCalledTimes(1);
  });

  it('online: replays the point as a let when a rally stalls', () => {
    const onLet = vi.fn();
    const g = createGame({ online: true, hooks: { onLet } });
    g.update(1 / 60);
    g.forceHit('near', swing);
    run(g, 7);
    expect(g.phase).toBe('live');
    expect(onLet).not.toHaveBeenCalled();
    run(g, 2);
    expect(g.phase).toBe('held');
    expect(g.rules.score).toEqual({ near: 0, far: 0 });
    expect(onLet).toHaveBeenCalledTimes(1);
  });

  it('game over stops play', () => {
    const g = createGame({});
    // near=10, far=2 keeps 'near' on serve (serve rotates every 2 points); one
    // more near point reaches WIN_SCORE with the required 2-point margin.
    g.rules.setScore(10, 2);
    g.far.pos.x = 1.3;
    g.update(1 / 60);
    g.forceHit('near', swing);
    run(g, 3 + POINT_PAUSE + 0.5);
    expect(g.phase).toBe('over');
    expect(g.toss()).toBe(false);
  });
});
