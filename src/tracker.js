// Colour-blob tracking on raw RGBA frames. Pure functions so they can be unit tested.

const Y_WEIGHT = 0.35; // brightness matters less than chroma: lighting changes as the object moves
const MIN_PIXELS = 40;

// Only the middle of the camera frame is used, so the paddle reaches its
// bounds without the object having to leave the picture.
export const ACTIVE = { uMin: 0.2, uMax: 0.8, vMin: 0.25, vMax: 0.8 };

// Chroma is scaled by brightness so a shaded object keeps (nearly) the same
// colour coordinates; the offset keeps near-black pixels from blowing up.
function ycc(r, g, b) {
  const y = 0.299 * r + 0.587 * g + 0.114 * b;
  const s = 128 / (y + 32);
  return {
    y,
    cb: (-0.169 * r - 0.331 * g + 0.5 * b) * s,
    cr: (0.5 * r - 0.419 * g - 0.081 * b) * s,
  };
}

function dist2(c, t) {
  const dy = (c.y - t.y) * Y_WEIGHT;
  const db = c.cb - t.cb;
  const dr = c.cr - t.cr;
  return dy * dy + db * db + dr * dr;
}

// Mean colour of a pixel box, plus a tolerance derived from how much it varies.
export function sampleColor(data, width, box) {
  let n = 0;
  const sum = { y: 0, cb: 0, cr: 0 };
  const pixels = [];
  for (let py = box.y; py < box.y + box.h; py++) {
    for (let px = box.x; px < box.x + box.w; px++) {
      const i = (py * width + px) * 4;
      const c = ycc(data[i], data[i + 1], data[i + 2]);
      pixels.push(c);
      sum.y += c.y;
      sum.cb += c.cb;
      sum.cr += c.cr;
      n++;
    }
  }
  const target = { y: sum.y / n, cb: sum.cb / n, cr: sum.cr / n };
  let varSum = 0;
  for (const c of pixels) varSum += dist2(c, target);
  const std = Math.sqrt(varSum / n);
  return { ...target, tol: Math.min(40, Math.max(14, 2.5 * std + 8)) };
}

// Centroid of the pixels matching `target`, in pixel coordinates, or null when
// too few match. `mask` (optional Uint8Array, width*height) receives the matches.
export function trackColor(data, width, height, target, mask = null) {
  const tol2 = target.tol * target.tol;
  let n = 0;
  let sx = 0;
  let sy = 0;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const i = (py * width + px) * 4;
      const hit = dist2(ycc(data[i], data[i + 1], data[i + 2]), target) <= tol2;
      if (mask) mask[py * width + px] = hit ? 1 : 0;
      if (!hit) continue;
      n++;
      sx += px;
      sy += py;
    }
  }
  if (n < MIN_PIXELS) return null;
  const cx = sx / n;
  const cy = sy / n;

  // Second pass: drop stray matches far from the blob (similar colours in the background).
  const r2 = 4 * n; // (2 * side of a square blob with n pixels)^2
  let m = 0;
  let mx = 0;
  let my = 0;
  for (let py = 0; py < height; py++) {
    for (let px = 0; px < width; px++) {
      const dx = px - cx;
      const dy = py - cy;
      if (dx * dx + dy * dy > r2) continue;
      const i = (py * width + px) * 4;
      if (dist2(ycc(data[i], data[i + 1], data[i + 2]), target) > tol2) continue;
      m++;
      mx += px;
      my += py;
    }
  }
  if (m < MIN_PIXELS) return null;
  return { x: mx / m, y: my / m, count: m };
}

// ---- hand landmarks (MediaPipe layout: 0 wrist, 5/9/13/17 finger bases) ----
const EDGE_SIN = 0.25; // below this the hand is seen edge-on

// Centre of the palm in the landmarks' own 0..1 image coordinates.
export function palmCenter(lm) {
  const ids = [0, 5, 9, 13, 17];
  let x = 0;
  let y = 0;
  for (const i of ids) {
    x += lm[i].x;
    y += lm[i].y;
  }
  return { x: x / ids.length, y: y / ids.length };
}

// Which side of the hand faces the camera: 'palm', 'back' or 'edge'.
// Landmarks must come from the unmirrored picture. The winding of
// wrist→index base→pinky base flips when the hand turns over, whatever its
// in-plane rotation; it shrinks to nothing when the hand is edge-on.
export function handFacing(lm, rightHand = true) {
  const ax = lm[5].x - lm[0].x;
  const ay = lm[5].y - lm[0].y;
  const bx = lm[17].x - lm[0].x;
  const by = lm[17].y - lm[0].y;
  const len = Math.hypot(ax, ay) * Math.hypot(bx, by);
  if (len < 1e-9) return 'edge';
  const sin = (ax * by - ay * bx) / len;
  if (Math.abs(sin) < EDGE_SIN) return 'edge';
  return sin < 0 === rightHand ? 'palm' : 'back';
}

// Pixel centroid -> 0..1 paddle coordinates over the active part of the frame.
export function toUnit(point, width, height) {
  const u = (point.x / width - ACTIVE.uMin) / (ACTIVE.uMax - ACTIVE.uMin);
  const v = (point.y / height - ACTIVE.vMin) / (ACTIVE.vMax - ACTIVE.vMin);
  return { u: Math.min(1, Math.max(0, u)), v: Math.min(1, Math.max(0, v)) };
}
