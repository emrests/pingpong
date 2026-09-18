import { WIN_SCORE } from './constants.js';

export const other = (side) => (side === 'near' ? 'far' : 'near');

export function serverFor(score, firstServer) {
  const total = score.near + score.far;
  const deuce = score.near >= WIN_SCORE - 1 && score.far >= WIN_SCORE - 1;
  const turn = deuce ? total % 2 : Math.floor(total / 2) % 2;
  return turn === 0 ? firstServer : other(firstServer);
}

export function createRules(firstServer = 'near') {
  const r = {
    firstServer,
    state: 'serving',
    score: { near: 0, far: 0 },
    server: firstServer,
    lastHitter: null,
    bounces: 0,
    winner: null,

    canHit(side) {
      if (r.state === 'serving') return side === r.server;
      return r.state === 'rally' && r.lastHitter !== side && r.bounces === 1;
    },

    onHit(side) {
      if (!r.canHit(side)) return false;
      r.state = 'rally';
      r.lastHitter = side;
      r.bounces = 0;
      return true;
    },

    onEvent(event) {
      if (r.state !== 'rally') return null;
      if (event.type === 'bounce') {
        if (event.side === r.lastHitter) return { winner: other(r.lastHitter), reason: 'own-side' };
        r.bounces++;
        if (r.bounces >= 2) return { winner: r.lastHitter, reason: 'double-bounce' };
        return null;
      }
      if (event.type === 'floor') {
        return r.bounces === 0
          ? { winner: other(r.lastHitter), reason: 'out' }
          : { winner: r.lastHitter, reason: 'missed' };
      }
      return null;
    },

    awardPoint(winner) {
      if (r.state === 'over') return;
      r.setScore(r.score.near + (winner === 'near' ? 1 : 0), r.score.far + (winner === 'far' ? 1 : 0));
    },

    setScore(near, far) {
      r.score = { near, far };
      r.lastHitter = null;
      r.bounces = 0;
      if ((near >= WIN_SCORE || far >= WIN_SCORE) && Math.abs(near - far) >= 2) {
        r.state = 'over';
        r.winner = near > far ? 'near' : 'far';
      } else {
        r.state = 'serving';
        r.winner = null;
        r.server = serverFor(r.score, r.firstServer);
      }
    },
  };
  return r;
}
