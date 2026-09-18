import {
  TABLE, NET_HEIGHT, NET_OVERHANG, BALL_RADIUS, DT, GRAVITY, DRAG_K, MAGNUS_K,
  RESTITUTION, FRICTION, SIDE_KICK,
} from './constants.js';
import { cross, len, cloneBall } from './vec.js';

const R = BALL_RADIUS;
const H = TABLE.height;
const HALF_W = TABLE.width / 2;
const HALF_L = TABLE.length / 2;

function bounceOnTable(ball) {
  const { vel, spin } = ball;
  const vyIn = vel.y;
  vel.y = -RESTITUTION * vyIn;

  // Velocity of the contact point (bottom of the ball) along the table.
  const cx = vel.x + R * spin.z;
  const cz = vel.z - R * spin.x;
  const c = Math.sqrt(cx * cx + cz * cz);
  if (c > 1e-6) {
    // Sliding friction impulse, capped at the impulse that reaches rolling
    // (hollow sphere, I = 2/3 m r^2 → contact speed changes 2.5x faster than v).
    const dv = Math.min(FRICTION * (1 + RESTITUTION) * Math.abs(vyIn), 0.4 * c);
    const dvx = (-dv * cx) / c;
    const dvz = (-dv * cz) / c;
    vel.x += dvx;
    vel.z += dvz;
    spin.x += (1.5 / R) * -dvz;
    spin.z += (1.5 / R) * dvx;
  }

  // Vertical-axis spin gives a small sideways kick, same sense as its Magnus curve.
  const vh = Math.sqrt(vel.x * vel.x + vel.z * vel.z);
  if (vh > 1e-6) {
    const k = (SIDE_KICK * R * spin.y) / vh;
    const kx = k * vel.z;
    const kz = -k * vel.x;
    vel.x += kx;
    vel.z += kz;
  }
  spin.y *= 0.85;
}

export function stepBall(ball, dt = DT) {
  const events = [];
  const { pos, vel, spin } = ball;

  const speed = len(vel);
  const m = cross(spin, vel);
  vel.x += (-DRAG_K * speed * vel.x + MAGNUS_K * m.x) * dt;
  vel.y += (-GRAVITY - DRAG_K * speed * vel.y + MAGNUS_K * m.y) * dt;
  vel.z += (-DRAG_K * speed * vel.z + MAGNUS_K * m.z) * dt;

  const prevY = pos.y;
  const prevZ = pos.z;
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  // Net: the plane z = 0 above the table surface.
  if (prevZ !== 0 && prevZ > 0 !== pos.z > 0) {
    const hitsNet =
      pos.y - R < H + NET_HEIGHT && pos.y + R > H && Math.abs(pos.x) < HALF_W + NET_OVERHANG;
    if (hitsNet) {
      pos.z = prevZ > 0 ? R : -R;
      vel.z *= -0.15;
      vel.x *= 0.5;
      vel.y *= 0.5;
      spin.x *= 0.3;
      spin.y *= 0.3;
      spin.z *= 0.3;
      events.push({ type: 'net' });
    }
  }

  // Table.
  const overTable = Math.abs(pos.x) <= HALF_W + R * 0.5 && Math.abs(pos.z) <= HALF_L + R * 0.5;
  if (vel.y < 0 && pos.y - R <= H && prevY - R >= H - 0.001 && overTable) {
    pos.y = H + R;
    bounceOnTable(ball);
    events.push({ type: 'bounce', side: pos.z > 0 ? 'near' : 'far' });
  }

  // Floor.
  if (pos.y - R <= 0) {
    pos.y = R;
    if (vel.y < 0) vel.y *= -0.6;
    vel.x *= 0.8;
    vel.z *= 0.8;
    events.push({ type: 'floor' });
  }

  return events;
}

export function flightResult(ball, maxTime = 3) {
  const b = cloneBall(ball);
  const steps = Math.ceil(maxTime / DT);
  for (let i = 0; i < steps; i++) {
    const events = stepBall(b);
    if (events.length) return { type: events[0].type, side: events[0].side, pos: b.pos };
  }
  return { type: 'none', pos: b.pos };
}
