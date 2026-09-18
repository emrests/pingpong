import { Peer } from 'peerjs';

const PREFIX = 'pingpong-rally-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeCode(rng = Math.random) {
  let code = '';
  for (let i = 0; i < 4; i++) code += ALPHABET[Math.floor(rng() * ALPHABET.length)];
  return code;
}

export function createNet(handlers) {
  let peer = null;
  let conn = null;

  function attach(c) {
    conn = c;
    c.on('open', () => handlers.onOpen?.());
    c.on('data', (data) => handlers.onMessage?.(data));
    c.on('close', () => {
      if (conn === c) {
        conn = null;
        handlers.onClose?.();
      }
    });
    c.on('error', (err) => handlers.onError?.(err));
  }

  function hostOnce(code) {
    return new Promise((resolve, reject) => {
      const p = new Peer(PREFIX + code);
      p.on('open', () => {
        peer = p;
        resolve(code);
      });
      p.on('connection', (c) => {
        if (conn) {
          // room is full: let this connection open, tell it so, then close it —
          // never attach it, never trigger the host's handlers.
          c.on('open', () => {
            c.send({ type: 'full' });
            setTimeout(() => c.close(), 500);
          });
          return;
        }
        attach(c);
      });
      p.on('error', (err) => {
        if (peer === p) handlers.onError?.(err);
        else {
          p.destroy();
          reject(err);
        }
      });
    });
  }

  return {
    async host() {
      for (let attempt = 0; ; attempt++) {
        try {
          return await hostOnce(makeCode());
        } catch (err) {
          if (err?.type !== 'unavailable-id' || attempt >= 4) throw err;
        }
      }
    },

    join(code) {
      return new Promise((resolve, reject) => {
        const p = new Peer();
        let opened = false;
        p.on('open', () => {
          opened = true;
          peer = p;
          attach(p.connect(PREFIX + code.toUpperCase(), { reliable: true, serialization: 'json' }));
          resolve();
        });
        p.on('error', (err) => {
          if (opened) handlers.onError?.(err);
          else reject(err);
        });
      });
    },

    send(msg) {
      if (conn?.open) conn.send(msg);
    },

    close() {
      const c = conn;
      conn = null;
      c?.close();
      peer?.destroy();
      peer = null;
    },
  };
}
