import {
  MIN_SPEED, MAX_SPEED, POWER_GAIN, AIM_GAIN, MAX_TOPSPIN, MAX_BACKSPIN, MAX_SIDESPIN,
} from './constants.js';
import { clamp, vec } from './vec.js';
import { flightResult } from './physics.js';

const SIDESPIN_THRESHOLD = 1.5;

// Pick the launch elevation whose first bounce is closest to the target depth.
// If no elevation lands on the far side, take the lowest one that at least
// clears the net (the ball goes long) — that is how over-hit flat shots miss.
// `lands` tells the caller whether a far-side bounce was actually found.
function solveElevation(pos, speed, dirX, dirZ, spin, targetZ) {
  let best = null;
  let bestErr = Infinity;
  let firstClear = null;
  let last = null;
  for (let phi = -0.3; phi <= 0.7001; phi += 0.02) {
    const ch = Math.cos(phi) * speed;
    const vel = vec(dirX * ch, Math.sin(phi) * speed, dirZ * ch);
    const r = flightResult({ pos, vel, spin });
    last = vel;
    if (r.type === 'bounce' && r.side === 'far') {
      const err = Math.abs(r.pos.z - targetZ);
      if (err < bestErr) {
        bestErr = err;
        best = vel;
      }
    } else if (!firstClear && r.type !== 'net' && r.pos.z < 0) {
      firstClear = vel;
    }
  }
  return { vel: best || firstClear || last, lands: best !== null };
}

export function computeHit(ball, paddle) {
  const forward = Math.max(0, -paddle.vel.z);
  const lateral = paddle.vel.x;
  const swing = Math.sqrt(forward * forward + lateral * lateral);

  const speed = clamp(MIN_SPEED + forward * POWER_GAIN, MIN_SPEED, MAX_SPEED);
  const power = (speed - MIN_SPEED) / (MAX_SPEED - MIN_SPEED);

  const targetX = clamp(ball.pos.x * 0.3 + lateral * AIM_GAIN, -0.9, 0.9);
  const targetZ = -(0.5 + 0.7 * power);

  let dx = targetX - ball.pos.x;
  let dz = targetZ - ball.pos.z;
  const d = Math.sqrt(dx * dx + dz * dz);
  dx /= d;
  dz /= d;

  let top;
  if (paddle.buttons.left) top = Math.min(MAX_TOPSPIN, 160 + 56 * swing);
  else if (paddle.buttons.right) top = -Math.min(MAX_BACKSPIN, 120 + 48 * swing);
  else top = 60;

  const side =
    Math.abs(lateral) > SIDESPIN_THRESHOLD ? clamp(lateral * 48, -MAX_SIDESPIN, MAX_SIDESPIN) : 0;

  // Topspin axis for horizontal direction d is (up × d) = (dz, 0, -dx).
  const spin = vec(top * dz, side, -top * dx);

  // If the chosen speed can't reach the far side, speed the shot up in small
  // steps (keeping direction, spin and target fixed) until one lands or we
  // hit MAX_SPEED. Never lowers the speed, so over-hit shots still go long.
  let hitSpeed = speed;
  let result = solveElevation(ball.pos, hitSpeed, dx, dz, spin, targetZ);
  while (!result.lands && hitSpeed < MAX_SPEED) {
    hitSpeed = Math.min(MAX_SPEED, hitSpeed + 0.5);
    result = solveElevation(ball.pos, hitSpeed, dx, dz, spin, targetZ);
  }
  return { vel: result.vel, spin };
}
