export const vec = (x = 0, y = 0, z = 0) => ({ x, y, z });
export const clone = (a) => ({ x: a.x, y: a.y, z: a.z });
export const add = (a, b) => ({ x: a.x + b.x, y: a.y + b.y, z: a.z + b.z });
export const sub = (a, b) => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
export const scale = (a, s) => ({ x: a.x * s, y: a.y * s, z: a.z * s });
export const cross = (a, b) => ({
  x: a.y * b.z - a.z * b.y,
  y: a.z * b.x - a.x * b.z,
  z: a.x * b.y - a.y * b.x,
});
export const len = (a) => Math.sqrt(a.x * a.x + a.y * a.y + a.z * a.z);
export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// 180° rotation about the y axis: swaps the near and far ends of the table.
// -0 is normalised to 0 so mirrored values compare equal and serialise cleanly.
export const mirror = (a) => ({ x: -a.x + 0, y: a.y, z: -a.z + 0 });

export const createBall = () => ({ pos: vec(), vel: vec(), spin: vec() });
export const cloneBall = (b) => ({ pos: clone(b.pos), vel: clone(b.vel), spin: clone(b.spin) });
export const mirrorBall = (b) => ({ pos: mirror(b.pos), vel: mirror(b.vel), spin: mirror(b.spin) });
