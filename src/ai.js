import { AI_SPEED, AI_ERROR, PADDLE_BOUNDS, PADDLE_HOME } from './constants.js';
import { vec, clamp, cloneBall } from './vec.js';
import { stepBall } from './physics.js';

const SERVE_DELAY = 1.0;

// speed: paddle movement (m/s); error: aim error (m); forward: swing speed range (m/s),
// which sets the ball speed; lateral: max sideways swing (m/s); topspin/backspin: chance per shot.
export const AI_LEVELS = {
  easy: { speed: 2.0, error: 0.14, forward: [0, 1.2], lateral: 1.5, topspin: 0.1, backspin: 0.1 },
  medium: { speed: 2.4, error: 0.11, forward: [0.8, 2.6], lateral: 3, topspin: 0.25, backspin: 0.2 },
  hard: { speed: AI_SPEED, error: AI_ERROR, forward: [2, 6], lateral: 5, topspin: 0.4, backspin: 0.2 },
};

export function predictIntercept(ball, alreadyBounced = false) {
  const b = cloneBall(ball);
  let bounced = alreadyBounced;
  for (let i = 0; i < 720; i++) {
    for (const e of stepBall(b)) {
      if (e.type === 'floor') return null;
      if (e.type === 'bounce') {
        if (e.side !== 'far' || bounced) return null;
        bounced = true;
      }
    }
    // hit it at the top of the bounce, or at the back of the AI's reach for fast balls
    if (bounced && (b.vel.y <= 0 || b.pos.z <= -PADDLE_BOUNDS.zMax)) return { x: b.pos.x, y: b.pos.y, z: b.pos.z };
  }
  return null;
}

export function createAI(rng = Math.random, level = 'hard') {
  return { rng, level: AI_LEVELS[level] ?? AI_LEVELS.hard, planFor: -1, errX: 0, errZ: 0, serveTimer: 0, lastTarget: null };
}

function planSwing(ai, game) {
  const { rng, level } = ai;
  const [fMin, fMax] = level.forward;
  ai.planFor = game.hitCount;
  ai.errX = (rng() - 0.5) * 2 * level.error;
  ai.errZ = (rng() - 0.5) * 2 * level.error;
  ai.lastTarget = null;
  const r = rng();
  game.far.synthetic = {
    // far side swings toward +z
    vel: vec((rng() - 0.5) * level.lateral, 0, fMin + rng() * (fMax - fMin)),
    buttons: { left: r < level.topspin, right: r >= level.topspin && r < level.topspin + level.backspin },
  };
}

export function updateAI(ai, game, dt) {
  const far = game.far;
  if (ai.planFor !== game.hitCount || !far.synthetic) planSwing(ai, game);

  let tx = -PADDLE_HOME.x;
  let tz = -PADDLE_HOME.z;

  if (game.phase === 'held' && game.rules.server === 'far') {
    ai.serveTimer += dt;
    if (ai.serveTimer >= SERVE_DELAY) {
      ai.serveTimer = 0;
      game.forceHit('far', far.synthetic);
    }
  } else {
    ai.serveTimer = 0;
  }

  if (game.phase === 'live' && game.rules.lastHitter === 'near') {
    const p = predictIntercept(game.ball, game.rules.bounces >= 1);
    if (p) ai.lastTarget = p;
    const target = p || ai.lastTarget;
    if (target) {
      tx = target.x + ai.errX;
      tz = target.z + ai.errZ;
    }
  }

  tx = clamp(tx, PADDLE_BOUNDS.xMin, PADDLE_BOUNDS.xMax);
  tz = clamp(tz, -PADDLE_BOUNDS.zMax, -PADDLE_BOUNDS.zMin);

  const dx = tx - far.pos.x;
  const dz = tz - far.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const maxStep = ai.level.speed * dt;
  if (dist <= maxStep) {
    far.pos.x = tx;
    far.pos.z = tz;
  } else {
    far.pos.x += (dx / dist) * maxStep;
    far.pos.z += (dz / dist) * maxStep;
  }
}
