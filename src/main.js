import { createGame } from './game.js';
import { createAI, updateAI } from './ai.js';
import { movePaddle, setPaddleXZ } from './paddle.js';
import { createRenderer } from './render.js';
import { createUI } from './ui.js';
import { createNet } from './net.js';
import { createCamera } from './camera.js';
import { other } from './rules.js';
import { mirror, mirrorBall } from './vec.js';
import { isBall, isVec, isSide, isScore } from './validate.js';
import { PADDLE_BOUNDS } from './constants.js';

const canvas = document.getElementById('scene');
const view = createRenderer(canvas);
const camera = createCamera(document.getElementById('cam-view'));

let game = null;
let ai = null;
let aiLevel = 'easy';
let paused = false;
let net = null;
let isHost = false;
let rtt = 0;
let farTarget = null;
let lastPaddleSend = 0;
let lastHeard = 0;
let pingInterval = null;
let joinTimer = null;

const REASONS = {
  out: 'Dışarı',
  'own-side': 'Kendi sahası',
  missed: 'Karşılanamadı',
  'double-bounce': 'Çift sekme',
};

// PeerJS reports these when the signalling websocket drops; the P2P data
// channel can still be healthy, so a running match must survive them.
const LEVEL_NAMES = { easy: 'Kolay', medium: 'Orta', hard: 'Zor' };
const BROKER_ERRORS = ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'];

const ui = createUI({
  onPractice: (level) => startPractice(level),
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
  onCamOn: () => camOn(),
  onCamOff: () => {
    camera.stop();
    ui.setCam(null);
  },
  onCamMode: (mode) => camMode(mode),
  onCamHand: () => {
    camera.setRightHand(!camera.rightHand);
    showCam();
  },
  onCamCalibrate: () => {
    camera.calibrate();
    showCam();
  },
});

// ---- camera control ----
function camMessage() {
  if (camera.mode === 'hand') {
    return camera.ready
      ? 'Açık elini kameraya göster. Çerçevenin içi masanın tamamı; yukarı = fileye doğru.'
      : 'El modeli yükleniyor…';
  }
  return camera.ready
    ? 'Turuncu boyanan yer defter olmalı; değilse rengi tekrar al.'
    : 'Defteri kutuya tut ve "Rengi al"a bas. Parlak, tek renk bir kapak en iyisi.';
}

function showCam(message = camMessage()) {
  ui.setCam({ mode: camera.mode, rightHand: camera.rightHand }, message);
}

async function camOn() {
  try {
    await camera.start();
  } catch {
    ui.showMenu('Kameraya erişilemedi');
    return;
  }
  camMode(camera.mode);
}

async function camMode(mode) {
  const loading = camera.setMode(mode);
  showCam();
  try {
    await loading;
  } catch {
    if (camera.on && camera.mode === 'hand') showCam('El modeli yüklenemedi — bağlantını kontrol et ya da Defter modunu dene.');
    return;
  }
  if (camera.on) showCam();
}

let shownFacing = null;
let fistArmed = true; // an open hand re-arms the toss, so a fist held through the point pause still serves

function driveFromCamera(dt) {
  const t = camera.target();
  if (t) {
    // ease toward the camera position: it arrives at ~30 Hz and a stepped paddle would swing in bursts
    const k = 1 - Math.exp(-30 * dt);
    const x = PADDLE_BOUNDS.xMin + t.u * (PADDLE_BOUNDS.xMax - PADDLE_BOUNDS.xMin);
    const z = PADDLE_BOUNDS.zMin + t.v * (PADDLE_BOUNDS.zMax - PADDLE_BOUNDS.zMin);
    setPaddleXZ(game.near, game.near.pos.x + (x - game.near.pos.x) * k, game.near.pos.z + (z - game.near.pos.z) * k);
  }
  if (camera.mode !== 'hand') return;
  // closing the hand tosses the serve, so the player can stand back from the keyboard
  if (!camera.fist()) fistArmed = true;
  else if (fistArmed && game.phase === 'held' && game.rules.server === 'near') {
    fistArmed = false;
    game.toss('near');
  }
  const facing = camera.facing();
  game.near.buttons.left = facing === 'palm';
  game.near.buttons.right = facing === 'back';
  if (facing !== shownFacing) {
    shownFacing = facing;
    ui.setSpin(game.near.buttons);
  }
}

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
    onLet() {
      ui.banner('Sayı tekrarlanıyor');
      ui.setScore(game.rules);
    },
  };
}

function startPractice(level = aiLevel) {
  aiLevel = level;
  game = createGame({ online: false, firstServer: 'near', hooks: makeHooks() });
  ai = createAI(Math.random, aiLevel);
  paused = false;
  const n = net;
  net = null;
  n?.close();
  ui.showHud();
  ui.setScore(game.rules);
  ui.setSpin(game.near.buttons);
  ui.status(`Antrenman · ${LEVEL_NAMES[aiLevel]}`);
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
  if (msg.type === 'bye') return leave('Rakip oyundan ayrıldı');
  if (msg.type === 'full') return leave('Oda dolu');
  if (!game) return;
  if (msg.type === 'paddle') {
    if (!isVec(msg.pos)) return;
    farTarget = msg.pos;
    game.far.buttons.left = !!msg.left;
    game.far.buttons.right = !!msg.right;
  } else if (msg.type === 'hit') {
    if (!isBall(msg.ball)) return;
    game.applyRemoteHit(msg.ball, rtt / 2000);
  } else if (msg.type === 'ball') {
    if (!isBall(msg.ball)) return;
    game.applyRemoteBall(msg.ball);
  } else if (msg.type === 'point') {
    if (!isSide(msg.winner)) return;
    game.applyRemotePoint(msg.winner, Object.hasOwn(REASONS, msg.reason) ? msg.reason : 'missed');
  } else if (msg.type === 'score') {
    if (!isScore(msg.near) || !isScore(msg.far)) return;
    if (game.rules.score.near !== msg.near || game.rules.score.far !== msg.far) {
      game.rules.setScore(msg.near, msg.far);
      ui.setScore(game.rules);
    }
  }
}

function startPingInterval() {
  clearInterval(pingInterval);
  pingInterval = setInterval(() => {
    if (!net) return;
    net.send({ type: 'ping', t: performance.now() });
    if (performance.now() - lastHeard > 8000) leave('Rakibin bağlantısı koptu');
  }, 1000);
}

function makeNet() {
  const self = createNet({
    onOpen: () => {
      if (net !== self) return;
      lastHeard = performance.now();
      startPingInterval();
      startOnline();
    },
    onMessage: (msg) => {
      if (net !== self) return;
      lastHeard = performance.now();
      onMessage(msg);
    },
    onClose: () => {
      if (net !== self) return;
      leave('Rakibin bağlantısı koptu');
    },
    onError: (err) => {
      if (net !== self) return;
      // A live match only needs the data channel; the 8 s heartbeat catches real peer loss.
      if (game?.online && BROKER_ERRORS.includes(err?.type)) return;
      netError(err);
    },
  });
  return self;
}

async function hostRoom() {
  leave();
  isHost = true;
  const mine = makeNet();
  net = mine;
  ui.showMenu('Oda kuruluyor…');
  try {
    const code = await mine.host();
    if (net !== mine) return;
    const link = `${location.origin}${location.pathname}?room=${code}`;
    ui.showLobby(code, link);
    ui.status('Rakip bekleniyor');
  } catch (err) {
    if (net !== mine) return;
    netError(err);
  }
}

async function joinRoom(code) {
  leave();
  isHost = false;
  const mine = makeNet();
  net = mine;
  ui.showMenu('Bağlanıyor…');
  ui.status(`Oda ${code}`);
  try {
    await mine.join(code);
    if (net !== mine) return;
    // the data channel may never open (dead room, blocked network): give up loudly
    joinTimer = setTimeout(() => {
      if (net !== mine || game) return;
      leave('Bağlanılamadı');
    }, 15000);
  } catch (err) {
    if (net !== mine) return;
    netError(err);
  }
}

function leave(message = '') {
  game = null;
  ai = null;
  const n = net;
  net = null; // cleared first so the close handler does not recurse
  clearInterval(pingInterval);
  pingInterval = null;
  clearTimeout(joinTimer);
  joinTimer = null;
  n?.send({ type: 'bye' });
  n?.close();
  rtt = 0;
  if (document.pointerLockElement) document.exitPointerLock();
  // drop ?room= so a reload does not auto-rejoin a room that is already gone
  if (new URLSearchParams(location.search).has('room')) {
    history.replaceState(null, '', location.pathname);
  }
  ui.status('');
  ui.showMenu(message);
}

// ---- input ----
const locked = () => document.pointerLockElement === canvas;
// Some browsers and automation refuse Pointer Lock; then the absolute-mouse
// fallback is the only way to play, so clicks must keep working as before.
let lockDenied = !canvas.requestPointerLock;

function requestLock() {
  if (!canvas.requestPointerLock) {
    lockDenied = true;
    return;
  }
  const p = canvas.requestPointerLock();
  if (p && typeof p.catch === 'function') p.catch(() => { lockDenied = true; });
}

canvas.addEventListener('mousedown', (e) => {
  if (!game) return;
  const wasLocked = locked();
  const wasPaused = paused;
  // camera control needs no cursor grab: clicks only toss and pick spin
  if (!camera.ready && !wasLocked) requestLock();
  paused = false;
  // the click that grabs the cursor back or un-pauses must not also swing
  if (!camera.ready && !lockDenied && (!wasLocked || wasPaused)) return;
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
  if (!game || paused || camera.ready) return;
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

window.addEventListener('keydown', (e) => {
  if (e.code !== 'Space' || !game || e.target instanceof HTMLInputElement) return;
  e.preventDefault();
  if (game.phase === 'held' && game.rules.server === 'near') game.toss('near');
});

canvas.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('pointerlockerror', () => {
  lockDenied = true;
});

document.addEventListener('pointerlockchange', () => {
  if (locked()) {
    lockDenied = false;
    ui.banner('', 1);
    return;
  }
  if (!game || game.phase === 'over') return;
  if (game.online) {
    ui.banner('İmleç serbest — devam etmek için tıkla', 2500); // online play never pauses
  } else {
    paused = true;
    ui.banner('Duraklatıldı — devam etmek için tıkla', 60000);
  }
});

window.addEventListener('blur', () => {
  if (!game) return;
  game.near.buttons.left = false;
  game.near.buttons.right = false;
  ui.setSpin(game.near.buttons);
});

window.addEventListener('pagehide', () => {
  if (net) net.send({ type: 'bye' });
});

// ---- loop ----
let last = performance.now();
let shownOver = false;

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  camera.update(dt);
  if (game && !paused) {
    if (camera.ready) driveFromCamera(dt);
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
