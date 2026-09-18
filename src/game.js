import { DT, PADDLE_REACH, TOSS_SPEED, TOSS_TIMEOUT, POINT_PAUSE, RALLY_TIMEOUT } from './constants.js';
import { vec, mirror, createBall, cloneBall, mirrorBall } from './vec.js';
import { stepBall } from './physics.js';
import { createRules } from './rules.js';
import { createPaddle, samplePaddle, trackHeight } from './paddle.js';
import { computeHit } from './hit.js';

const HOLD_OFFSET = { y: 0.12, z: -0.08 }; // near frame: above and in front of the paddle
const MAX_LEAD = 0.15;

export function createGame({ online = false, firstServer = 'near', hooks = {} } = {}) {
  const near = createPaddle();
  const far = createPaddle();
  far.pos = mirror(far.pos);

  const g = {
    online,
    ball: createBall(),
    near,
    far,
    rules: createRules(firstServer),
    phase: 'held',
    time: 0,
    hitCount: 0,
    _acc: 0,
    _tossTime: 0,
    _lastHitTime: 0,
    _deadTimer: 0,
    _prevRel: { near: -1, far: -1 },
  };

  const paddleOf = (side) => (side === 'near' ? near : far);
  // Signed gap along the hitting axis: negative while the ball is in front of the paddle.
  const relOf = (side) => (side === 'near' ? g.ball.pos.z - near.pos.z : far.pos.z - g.ball.pos.z);

  function placeHeldBall() {
    const p = paddleOf(g.rules.server);
    const dir = g.rules.server === 'near' ? 1 : -1;
    g.ball.pos = vec(p.pos.x, p.pos.y + HOLD_OFFSET.y, p.pos.z + HOLD_OFFSET.z * dir);
    g.ball.vel = vec();
    g.ball.spin = vec();
  }

  function doHit(side, swing) {
    if (!g.rules.onHit(side)) return false;
    const p = paddleOf(side);
    const src = { pos: p.pos, vel: swing.vel, buttons: swing.buttons };
    if (side === 'near') {
      const h = computeHit(g.ball, src);
      g.ball.vel = h.vel;
      g.ball.spin = h.spin;
    } else {
      const h = computeHit(mirrorBall(g.ball), { pos: mirror(src.pos), vel: mirror(src.vel), buttons: src.buttons });
      g.ball.vel = mirror(h.vel);
      g.ball.spin = mirror(h.spin);
    }
    g.phase = 'live';
    g.hitCount++;
    g._lastHitTime = g.time;
    hooks.onHit?.(side);
    return true;
  }

  function tryHit(side) {
    const rel = relOf(side);
    const prev = g._prevRel[side];
    g._prevRel[side] = rel;
    if (!(prev < 0 && rel >= 0)) return;
    if (!g.rules.canHit(side)) return;
    if (g.phase === 'tossed' && g.ball.vel.y >= 0) return; // serve on the way down
    const p = paddleOf(side);
    if (Math.abs(g.ball.pos.x - p.pos.x) > PADDLE_REACH.x) return;
    if (Math.abs(g.ball.pos.y - p.pos.y) > PADDLE_REACH.y) return;
    const swing = side === 'far' && far.synthetic ? far.synthetic : p;
    doHit(side, swing);
  }

  function point(decision, remote) {
    if (g.phase !== 'live' && g.phase !== 'tossed') return;
    g.rules.awardPoint(decision.winner);
    g.phase = 'dead';
    g._deadTimer = POINT_PAUSE;
    hooks.onPoint?.(decision, remote);
  }

  const finite = (v) => Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);
  const ballIsSane = () => finite(g.ball.pos) && finite(g.ball.vel) && finite(g.ball.spin);

  // The rally can no longer be judged — the ball state escaped (NaN/Infinity) or
  // nobody hit it for RALLY_TIMEOUT (online: a hit message that never arrived).
  // Replay the point instead of staying stuck in 'live'.
  function replayPoint() {
    g.rules.setScore(g.rules.score.near, g.rules.score.far); // same score, fresh rally state
    g.phase = 'held';
    g._acc = 0;
    g._lastHitTime = g.time;
    placeHeldBall();
    hooks.onLet?.();
  }

  function stepOnce() {
    const events = stepBall(g.ball);
    if (g.phase === 'live' || g.phase === 'tossed') {
      tryHit('near');
      if (!online) tryHit('far');
    }
    if (g.phase !== 'live') return;
    for (const e of events) {
      const decision = g.rules.onEvent(e);
      if (decision && (!online || g.rules.lastHitter === 'far')) {
        point(decision, false);
        return;
      }
    }
  }

  function simulate(seconds) {
    g._acc += seconds;
    while (g._acc >= DT) {
      g._acc -= DT;
      stepOnce();
    }
  }

  g.update = (dt) => {
    g.time += dt;
    samplePaddle(near, g.time);
    samplePaddle(far, g.time);
    const inPlay = g.phase === 'live' || g.phase === 'tossed';
    trackHeight(near, g.ball.pos.y, inPlay && Math.abs(g.ball.pos.z - near.pos.z) < 1.5, dt);
    trackHeight(far, g.ball.pos.y, inPlay && Math.abs(g.ball.pos.z - far.pos.z) < 1.5, dt);

    if (g.phase === 'held') {
      placeHeldBall();
      g._acc = 0;
      return;
    }
    if (g.phase === 'over') return;
    if (g.phase === 'live' && (!ballIsSane() || g.time - g._lastHitTime > RALLY_TIMEOUT)) {
      replayPoint();
      return;
    }

    simulate(dt);

    if (g.phase === 'tossed' && g.time - g._tossTime > TOSS_TIMEOUT) {
      g.phase = 'held';
    } else if (g.phase === 'dead') {
      g._deadTimer -= dt;
      if (g._deadTimer <= 0) g.phase = g.rules.state === 'over' ? 'over' : 'held';
    }
  };

  g.toss = (side = 'near') => {
    if (g.phase !== 'held' || g.rules.server !== side) return false;
    placeHeldBall();
    g.ball.vel = vec(0, TOSS_SPEED, 0);
    g.phase = 'tossed';
    g._tossTime = g.time;
    g._prevRel.near = relOf('near');
    g._prevRel.far = relOf('far');
    hooks.onToss?.();
    return true;
  };

  g.forceHit = (side, swing) => {
    if (g.phase !== 'held' && g.phase !== 'tossed' && g.phase !== 'live') return false;
    if (g.phase === 'held') placeHeldBall();
    return doHit(side, swing);
  };

  g.applyRemoteHit = (ball, lead = 0) => {
    // The far side is the authority for its own returns: if our local sim already
    // counted its second bounce while the hit message was in flight, undo that.
    if (g.rules.state === 'rally' && g.rules.lastHitter === 'near') g.rules.bounces = 1;
    // rules.onHit rejects anything illegal (wrong server, game over, double hit)
    if (!g.rules.onHit('far')) return;
    g.ball = cloneBall(ball);
    g.phase = 'live';
    g.hitCount++;
    g._lastHitTime = g.time;
    g._prevRel.near = relOf('near');
    simulate(Math.min(MAX_LEAD, Math.max(0, lead)));
  };

  g.applyRemoteBall = (ball) => {
    if (g.rules.state !== 'serving' || g.rules.server !== 'far') return;
    g.ball = cloneBall(ball);
    g.phase = 'tossed';
    g._tossTime = g.time;
  };

  g.applyRemotePoint = (winner, reason) => point({ winner, reason }, true);

  placeHeldBall();
  return g;
}
