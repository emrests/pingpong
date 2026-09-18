import { sampleColor, trackColor, toUnit, palmCenter, handFacing, ACTIVE } from './tracker.js';

const W = 160;
const H = 120;
const BOX = { x: W / 2 - 12, y: H / 2 - 12, w: 24, h: 24 }; // colour calibration sample area
const LOST_AFTER = 0.4; // seconds without a match before the target is dropped

// Keep in step with the @mediapipe/tasks-vision version in package.json.
const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm';
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

let landmarkerPromise = null;

// The model and its wasm runtime are ~15 MB, so they load only on first use.
function loadLandmarker() {
  landmarkerPromise ??= (async () => {
    const { FilesetResolver, HandLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(WASM_URL);
    return HandLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: MODEL_URL, delegate: 'GPU' },
      runningMode: 'VIDEO',
      numHands: 1,
    });
  })();
  landmarkerPromise.catch(() => { landmarkerPromise = null; }); // allow a retry
  return landmarkerPromise;
}

// Webcam control. 'hand' mode follows the open hand and reads which side of it
// faces the camera; 'color' mode follows a calibrated colour (a notebook cover).
// Either way the position in the mirrored picture drives the paddle.
export function createCamera(view) {
  const ctx = view.getContext('2d', { willReadFrequently: true });
  view.width = W;
  view.height = H;
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  const mask = new Uint8Array(W * H);

  let stream = null;
  let mode = 'hand';
  let rightHand = true;
  let landmarker = null;
  let color = null;
  let target = null;
  let facing = null;
  let lastFrameTime = -1;
  let lostFor = 0;

  function drawActiveArea() {
    ctx.lineWidth = 1;
    ctx.strokeStyle = '#ffffff88';
    ctx.strokeRect(
      ACTIVE.uMin * W, ACTIVE.vMin * H,
      (ACTIVE.uMax - ACTIVE.uMin) * W, (ACTIVE.vMax - ACTIVE.vMin) * H,
    );
  }

  function drawMarker(point) {
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
    ctx.stroke();
  }

  function trackHand() {
    const lm = landmarker.detectForVideo(video, performance.now()).landmarks[0];
    drawActiveArea();
    if (!lm) return null;
    ctx.fillStyle = '#e8573a';
    for (const p of lm) ctx.fillRect((1 - p.x) * W - 1, p.y * H - 1, 3, 3);
    facing = handFacing(lm, rightHand);
    const c = palmCenter(lm);
    return { x: (1 - c.x) * W, y: c.y * H }; // landmarks are unmirrored, the picture is mirrored
  }

  function trackNotebook() {
    const img = ctx.getImageData(0, 0, W, H);
    const point = trackColor(img.data, W, H, color, mask);
    for (let i = 0; i < mask.length; i++) {
      if (!mask[i]) continue;
      img.data[i * 4] = 232;
      img.data[i * 4 + 1] = 87;
      img.data[i * 4 + 2] = 58;
    }
    ctx.putImageData(img, 0, 0);
    drawActiveArea();
    return point;
  }

  function lose(dt) {
    lostFor += dt;
    if (lostFor > LOST_AFTER) {
      target = null;
      facing = null;
    }
  }

  return {
    get on() {
      return stream !== null;
    },
    get mode() {
      return mode;
    },
    get rightHand() {
      return rightHand;
    },
    // true once the chosen mode can actually produce positions
    get ready() {
      return stream !== null && (mode === 'hand' ? landmarker !== null : color !== null);
    },
    get tracking() {
      return target !== null;
    },

    async start() {
      if (stream) return;
      stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240, frameRate: { ideal: 60 }, facingMode: 'user' },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();
    },

    stop() {
      for (const t of stream?.getTracks() ?? []) t.stop();
      stream = null;
      video.srcObject = null;
      color = null;
      target = null;
      facing = null;
    },

    // Resolves once the mode is usable ('hand' has to download its model first).
    async setMode(next) {
      mode = next;
      target = null;
      facing = null;
      if (mode === 'hand' && !landmarker) landmarker = await loadLandmarker();
    },

    setRightHand(value) {
      rightHand = value;
    },

    // Colour mode: take whatever is inside the box as the thing to follow.
    calibrate() {
      if (!stream) return false;
      color = sampleColor(ctx.getImageData(0, 0, W, H).data, W, BOX);
      return true;
    },

    // Call once per render frame; does work only when the camera delivered a new picture.
    update(dt) {
      if (!stream || video.readyState < 2) return;
      if (video.currentTime === lastFrameTime) return lose(dt);
      lastFrameTime = video.currentTime;

      ctx.save();
      ctx.scale(-1, 1); // mirror, so moving right moves the picture right
      ctx.drawImage(video, -W, 0, W, H);
      ctx.restore();

      let point = null;
      if (mode === 'hand') {
        if (landmarker) point = trackHand();
      } else if (color) {
        point = trackNotebook();
      } else {
        ctx.lineWidth = 1;
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(BOX.x + 0.5, BOX.y + 0.5, BOX.w, BOX.h);
      }

      if (!point) return lose(dt);
      drawMarker(point);
      target = toUnit(point, W, H);
      lostFor = 0;
    },

    // { u, v } in 0..1 (u: left→right, v: top→bottom) or null while nothing is tracked.
    target() {
      return target;
    },

    // Hand mode only: 'palm' | 'back' | 'edge', or null.
    facing() {
      return mode === 'hand' ? facing : null;
    },
  };
}
