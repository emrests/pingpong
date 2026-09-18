import { describe, it, expect } from 'vitest';
import { sampleColor, trackColor, toUnit, palmCenter, handFacing, isFist, ACTIVE } from '../src/tracker.js';

const W = 160;
const H = 120;
const BG = [90, 90, 95];
const BLUE = [20, 60, 220];

function frame(rects) {
  const data = new Uint8ClampedArray(W * H * 4);
  for (let i = 0; i < W * H; i++) data.set([...BG, 255], i * 4);
  for (const { x, y, w, h, color } of rects) {
    for (let py = y; py < y + h; py++) {
      for (let px = x; px < x + w; px++) data.set([...color, 255], (py * W + px) * 4);
    }
  }
  return data;
}

const calibrate = () =>
  sampleColor(frame([{ x: 60, y: 40, w: 40, h: 40, color: BLUE }]), W, { x: 70, y: 50, w: 20, h: 20 });

describe('tracker', () => {
  it('finds the centroid of the calibrated colour', () => {
    const target = calibrate();
    const p = trackColor(frame([{ x: 100, y: 20, w: 30, h: 20, color: BLUE }]), W, H, target);
    expect(p.x).toBeCloseTo(114.5);
    expect(p.y).toBeCloseTo(29.5);
    expect(p.count).toBe(600);
  });

  it('returns null when the object is not in view', () => {
    expect(trackColor(frame([]), W, H, calibrate())).toBeNull();
  });

  it('tolerates the object getting darker or brighter', () => {
    const target = calibrate();
    const dim = BLUE.map((c) => c * 0.8);
    expect(trackColor(frame([{ x: 10, y: 10, w: 30, h: 30, color: dim }]), W, H, target)).not.toBeNull();
  });

  it('ignores a small stray patch of the same colour far from the blob', () => {
    const target = calibrate();
    const p = trackColor(
      frame([
        { x: 20, y: 50, w: 30, h: 30, color: BLUE },
        { x: 150, y: 5, w: 6, h: 6, color: BLUE },
      ]),
      W, H, target,
    );
    expect(p.count).toBe(900);
    expect(p.x).toBeCloseTo(34.5);
  });

  it('fills the mask with matched pixels', () => {
    const mask = new Uint8Array(W * H);
    trackColor(frame([{ x: 0, y: 0, w: 10, h: 10, color: BLUE }]), W, H, calibrate(), mask);
    expect(mask.reduce((a, b) => a + b, 0)).toBe(100);
  });

  // Unmirrored camera picture of a raised right hand, palm to the camera:
  // the thumb/index side is on the picture's right, fingers point up.
  function hand({ flip = false, squeeze = 1, rotate = 0 } = {}) {
    const lm = Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.7 }));
    const bases = { 5: 0.06, 9: 0.02, 13: -0.02, 17: -0.06 };
    for (const [i, dx] of Object.entries(bases)) {
      const x = (flip ? -dx : dx) * squeeze;
      const y = -0.15;
      lm[i] = {
        x: 0.5 + x * Math.cos(rotate) - y * Math.sin(rotate),
        y: 0.7 + x * Math.sin(rotate) + y * Math.cos(rotate),
      };
    }
    return lm;
  }

  it('tells palm from back of the hand, at any in-plane rotation', () => {
    expect(handFacing(hand())).toBe('palm');
    expect(handFacing(hand({ flip: true }))).toBe('back');
    expect(handFacing(hand({ rotate: 2.5 }))).toBe('palm');
    expect(handFacing(hand({ flip: true, rotate: -1.2 }))).toBe('back');
  });

  it('mirrors the answer for a left hand and reports an edge-on hand', () => {
    expect(handFacing(hand(), false)).toBe('back');
    expect(handFacing(hand({ squeeze: 0.1 }))).toBe('edge');
  });

  it('sees a fist when the fingertips fold back toward the wrist', () => {
    const open = hand();
    const closed = hand();
    for (const tip of [8, 12, 16, 20]) {
      const base = open[tip - 3];
      open[tip - 2] = { x: base.x, y: base.y - 0.08 };
      open[tip] = { x: base.x, y: base.y - 0.2 };
      closed[tip - 2] = { x: base.x, y: base.y - 0.06 };
      closed[tip] = { x: base.x, y: base.y + 0.03 };
    }
    expect(isFist(open)).toBe(false);
    expect(isFist(closed)).toBe(true);
    closed[8] = open[8]; // pointing with one finger is still a closed hand
    expect(isFist(closed)).toBe(true);
    closed[12] = open[12];
    expect(isFist(closed)).toBe(false);
  });

  it('puts the palm centre between the wrist and the finger bases', () => {
    const c = palmCenter(hand());
    expect(c.x).toBeCloseTo(0.5);
    expect(c.y).toBeCloseTo(0.7 - 0.15 * 0.8);
  });

  it('maps the active area to 0..1 and clamps outside it', () => {
    const mid = toUnit({ x: (W * (ACTIVE.uMin + ACTIVE.uMax)) / 2, y: (H * (ACTIVE.vMin + ACTIVE.vMax)) / 2 }, W, H);
    expect(mid.u).toBeCloseTo(0.5);
    expect(mid.v).toBeCloseTo(0.5);
    expect(toUnit({ x: 0, y: H }, W, H)).toEqual({ u: 0, v: 1 });
  });
});
