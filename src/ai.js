import { AI_SPEED, AI_ERROR, PADDLE_BOUNDS, PADDLE_HOME } from './constants.js';
import { vec, clamp, cloneBall } from './vec.js';
import { stepBall } from './physics.js';

const SERVE_DELAY = 1.0;

export function predictIntercept(ball) {
  const b = cloneBall(ball);
  let bounced = false;
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

export function createAI(rng = Math.random) {
  return { rng, planFor: -1, errX: 0, errZ: 0, serveTimer: 0 };
}

function planSwing(ai, game) {
  const { rng } = ai;
  ai.planFor = game.hitCount;
  ai.errX = (rng() - 0.5) * 2 * AI_ERROR;
  ai.errZ = (rng() - 0.5) * 2 * AI_ERROR;
  const r = rng();
  game.far.synthetic = {
    // far side swings toward +z
    vel: vec((rng() - 0.5) * 5, 0, 2 + rng() * 4),
    buttons: { left: r < 0.4, right: r >= 0.4 && r < 0.6 },
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
    const p = predictIntercept(game.ball);
    if (p) {
      tx = p.x + ai.errX;
      tz = p.z + ai.errZ;
    }
  }

  tx = clamp(tx, PADDLE_BOUNDS.xMin, PADDLE_BOUNDS.xMax);
  tz = clamp(tz, -PADDLE_BOUNDS.zMax, -PADDLE_BOUNDS.zMin);

  const dx = tx - far.pos.x;
  const dz = tz - far.pos.z;
  const dist = Math.sqrt(dx * dx + dz * dz);
  const maxStep = AI_SPEED * dt;
  if (dist <= maxStep) {
    far.pos.x = tx;
    far.pos.z = tz;
  } else {
    far.pos.x += (dx / dist) * maxStep;
    far.pos.z += (dz / dist) * maxStep;
  }
}
