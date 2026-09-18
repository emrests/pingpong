import { MOUSE_SENS, PADDLE_BOUNDS, PADDLE_HOME } from './constants.js';
import { vec, clone, clamp } from './vec.js';

const HISTORY_WINDOW = 0.05;

export function createPaddle() {
  return {
    pos: clone(PADDLE_HOME),
    vel: vec(),
    buttons: { left: false, right: false },
    synthetic: null,
    _hist: [],
  };
}

export function setPaddleXZ(p, x, z) {
  p.pos.x = clamp(x, PADDLE_BOUNDS.xMin, PADDLE_BOUNDS.xMax);
  p.pos.z = clamp(z, PADDLE_BOUNDS.zMin, PADDLE_BOUNDS.zMax);
}

export function movePaddle(p, dxPx, dyPx) {
  setPaddleXZ(p, p.pos.x + dxPx * MOUSE_SENS, p.pos.z + dyPx * MOUSE_SENS);
}

export function samplePaddle(p, time) {
  const h = p._hist;
  h.push({ t: time, x: p.pos.x, z: p.pos.z });
  while (h.length > 2 && time - h[1].t >= HISTORY_WINDOW) h.shift();
  const oldest = h[0];
  const dt = time - oldest.t;
  if (dt > 1e-4) {
    p.vel.x = (p.pos.x - oldest.x) / dt;
    p.vel.z = (p.pos.z - oldest.z) / dt;
  }
}

export function trackHeight(p, ballY, follow, dt) {
  const target = follow ? clamp(ballY, 0.85, 1.5) : PADDLE_HOME.y;
  p.pos.y += (target - p.pos.y) * Math.min(1, 12 * dt);
}
