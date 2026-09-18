// Shape checks for messages coming off the wire. A peer is untrusted input:
// anything that does not match exactly is dropped by the caller.

const isObject = (o) => typeof o === 'object' && o !== null && !Array.isArray(o);

export const isVec = (v) =>
  isObject(v) && Number.isFinite(v.x) && Number.isFinite(v.y) && Number.isFinite(v.z);

export const isBall = (b) => isObject(b) && isVec(b.pos) && isVec(b.vel) && isVec(b.spin);

export const isSide = (s) => s === 'near' || s === 'far';

export const isScore = (n) => Number.isInteger(n) && n >= 0 && n <= 99;
