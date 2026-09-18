import { createGame } from './game.js';
import { createAI, updateAI } from './ai.js';
import { movePaddle, setPaddleXZ } from './paddle.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createNet } from './net.js';
import { other } from './rules.js';
import { mirror, mirrorBall } from './vec.js';
import { PADDLE_BOUNDS } from './constants.js';

const canvas = document.getElementById('scene');
const view = createRenderer(canvas);

let game = null;
let ai = null;
let paused = false;
let net = null;
let isHost = false;
let rtt = 0;
let farTarget = null;
let lastPaddleSend = 0;
let lastPing = 0;

const REASONS = {
  out: 'Dışarı',
  'own-side': 'Kendi sahası',
  missed: 'Karşılanamadı',
  'double-bounce': 'Çift sekme',
};

const ui = createUI({
  onPractice: () => startPractice(),
  onHost: () => hostRoom(),
  onJoin: (code) => joinRoom(code),
  onRematch: () => {
    if (net) {
      net.send({ type: 'restart' });
      startOnline();
    } else {
      startPractice();
    }
  },
  onLeave: () => leave(),
});

function sendScore() {
  net.send({ type: 'score', near: game.rules.score.far, far: game.rules.score.near });
}

function makeHooks() {
  return {
    onHit(side) {
      if (net && side === 'near') net.send({ type: 'hit', ball: mirrorBall(game.ball) });
    },
    onToss() {
      if (net) net.send({ type: 'ball', ball: mirrorBall(game.ball) });
    },
    onPoint(decision, remote) {
      ui.setScore(game.rules);
      ui.banner(`${decision.winner === 'near' ? 'Sayı senin' : 'Sayı rakibin'} · ${REASONS[decision.reason] ?? ''}`);
      if (!net) return;
      if (!remote) net.send({ type: 'point', winner: other(decision.winner), reason: decision.reason });
      if (isHost) sendScore();
    },
  };
}

function startPractice() {
  game = createGame({ online: false, firstServer: 'near', hooks: makeHooks() });
  ai = createAI();
  paused = false;
  const n = net;
  net = null;
  n?.close();
  ui.showHud();
  ui.setScore(game.rules);
  ui.setSpin(game.near.buttons);
  ui.status('Antrenman');
}

function startOnline() {
  game = createGame({ online: true, firstServer: isHost ? 'near' : 'far', hooks: makeHooks() });
  ai = null;
  paused = false;
  farTarget = null;
  ui.showHud();
  ui.setScore(game.rules);
  ui.setSpin(game.near.buttons);
  ui.banner(isHost ? 'Rakip katıldı — servis sende' : 'Bağlandın — servis rakipte', 2000);
}

function netError(err) {
  const messages = {
    'peer-unavailable': 'Oda bulunamadı',
    network: 'Bağlantı sunucusuna ulaşılamadı',
    'server-error': 'Bağlantı sunucusuna ulaşılamadı',
    'browser-incompatible': 'Tarayıcı WebRTC desteklemiyor',
  };
  leave(messages[err?.type] ?? 'Bağlantı hatası');
}

function onMessage(msg) {
  if (!msg || typeof msg !== 'object') return;
  if (msg.type === 'ping') return net.send({ type: 'pong', t: msg.t });
  if (msg.type === 'pong') {
    const sample = performance.now() - msg.t;
    rtt = rtt ? rtt * 0.8 + sample * 0.2 : sample;
    ui.status(`Online · ${Math.round(rtt)} ms`);
    return;
  }
  if (msg.type === 'restart') return startOnline();
  if (!game) return;
  if (msg.type === 'paddle') {
    farTarget = msg.pos;
    game.far.buttons.left = !!msg.left;
    game.far.buttons.right = !!msg.right;
  } else if (msg.type === 'hit') {
    game.applyRemoteHit(msg.ball, rtt / 2000);
  } else if (msg.type === 'ball') {
    game.applyRemoteBall(msg.ball);
  } else if (msg.type === 'point') {
    game.applyRemotePoint(msg.winner, msg.reason);
  } else if (msg.type === 'score') {
    if (game.rules.score.near !== msg.near || game.rules.score.far !== msg.far) {
      game.rules.setScore(msg.near, msg.far);
      ui.setScore(game.rules);
    }
  }
}

function makeNet() {
  return createNet({
    onOpen: () => startOnline(),
    onMessage,
    onClose: () => leave('Rakibin bağlantısı koptu'),
    onError: netError,
  });
}

async function hostRoom() {
  leave();
  isHost = true;
  net = makeNet();
  ui.showMenu('Oda kuruluyor…');
  try {
    const code = await net.host();
    const link = `${location.origin}${location.pathname}?room=${code}`;
    ui.showLobby(code, link);
    ui.status('Rakip bekleniyor');
  } catch (err) {
    netError(err);
  }
}

async function joinRoom(code) {
  leave();
  isHost = false;
  net = makeNet();
  ui.showMenu('Bağlanıyor…');
  ui.status(`Oda ${code}`);
  try {
    await net.join(code);
  } catch (err) {
    netError(err);
  }
}

function leave(message = '') {
  game = null;
  ai = null;
  const n = net;
  net = null; // cleared first so the close handler does not recurse
  n?.close();
  rtt = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  ui.status('');
  ui.showMenu(message);
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
    if (net) {
      if (farTarget) {
        const k = 1 - Math.exp(-25 * dt);
        game.far.pos.x += (farTarget.x - game.far.pos.x) * k;
        game.far.pos.z += (farTarget.z - game.far.pos.z) * k;
      }
      if (now - lastPaddleSend > 33) {
        lastPaddleSend = now;
        net.send({
          type: 'paddle',
          pos: mirror(game.near.pos),
          left: game.near.buttons.left,
          right: game.near.buttons.right,
        });
      }
      if (now - lastPing > 2000) {
        lastPing = now;
        net.send({ type: 'ping', t: now });
      }
    }
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
const room = new URLSearchParams(location.search).get('room');
if (room && /^[A-Za-z0-9]{4}$/.test(room)) joinRoom(room.toUpperCase());
requestAnimationFrame(frame);
