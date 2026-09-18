import { createGame } from './game.js';
import { createAI, updateAI } from './ai.js';
import { movePaddle, setPaddleXZ } from './paddle.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { PADDLE_BOUNDS } from './constants.js';

const canvas = document.getElementById('scene');
const view = createRenderer(canvas);

let game = null;
let ai = null;
let paused = false;

const REASONS = {
  out: 'Dışarı',
  'own-side': 'Kendi sahası',
  missed: 'Karşılanamadı',
  'double-bounce': 'Çift sekme',
};

const ui = createUI({
  onPractice: () => startPractice(),
  onHost: () => ui.showMenu('Online mod henüz hazır değil'),
  onJoin: () => ui.showMenu('Online mod henüz hazır değil'),
  onRematch: () => startPractice(),
  onLeave: () => leave(),
});

function makeHooks() {
  return {
    onPoint(decision) {
      ui.setScore(game.rules);
      ui.banner(`${decision.winner === 'near' ? 'Sayı senin' : 'Sayı rakibin'} · ${REASONS[decision.reason] ?? ''}`);
    },
  };
}

function startPractice() {
  game = createGame({ online: false, firstServer: 'near', hooks: makeHooks() });
  ai = createAI();
  paused = false;
  ui.showHud();
  ui.setScore(game.rules);
  ui.setSpin(game.near.buttons);
  ui.status('Antrenman');
}

function leave() {
  game = null;
  ai = null;
  if (document.pointerLockElement) document.exitPointerLock();
  ui.status('');
  ui.showMenu();
}

// ---- input ----
const locked = () => document.pointerLockElement === canvas;

canvas.addEventListener('mousedown', (e) => {
  if (!game) return;
  if (!locked()) canvas.requestPointerLock?.();
  paused = false;
  if (e.button === 0) game.near.buttons.left = true;
  if (e.button === 2) game.near.buttons.right = true;
  ui.setSpin(game.near.buttons);
  if (e.button === 0 && game.phase === 'held' && game.rules.server === 'near') game.toss('near');
});

window.addEventListener('mouseup', (e) => {
  if (!game) return;
  if (e.button === 0) game.near.buttons.left = false;
  if (e.button === 2) game.near.buttons.right = false;
  ui.setSpin(game.near.buttons);
});

window.addEventListener('mousemove', (e) => {
  if (!game || paused) return;
  if (locked()) {
    movePaddle(game.near, e.movementX, e.movementY);
  } else {
    // fallback when Pointer Lock is unavailable: absolute mapping
    const r = canvas.getBoundingClientRect();
    const u = (e.clientX - r.left) / r.width;
    const v = (e.clientY - r.top) / r.height;
    setPaddleXZ(
      game.near,
      PADDLE_BOUNDS.xMin + u * (PADDLE_BOUNDS.xMax - PADDLE_BOUNDS.xMin),
      PADDLE_BOUNDS.zMin + v * (PADDLE_BOUNDS.zMax - PADDLE_BOUNDS.zMin),
    );
  }
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockchange', () => {
  if (!locked() && game && !game.online && game.phase !== 'over') {
    paused = true;
    ui.banner('Duraklatıldı — devam etmek için tıkla', 60000);
  } else if (locked()) {
    ui.banner('', 1);
  }
});

// ---- loop ----
let last = performance.now();
let shownOver = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (game && !paused) {
    if (ai) updateAI(ai, game, dt);
    game.update(dt);
    if (game.phase === 'over' && !shownOver) {
      shownOver = true;
      if (document.pointerLockElement) document.exitPointerLock();
      ui.gameOver(game.rules.winner === 'near', game.rules);
    }
    if (game.phase !== 'over') shownOver = false;
  }
  view.render(game);
  requestAnimationFrame(frame);
}

ui.showMenu();
requestAnimationFrame(frame);
