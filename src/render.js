import * as THREE from 'three';
import { TABLE, NET_HEIGHT, NET_OVERHANG, BALL_RADIUS, PADDLE_RADIUS } from './constants.js';

const TRAIL = 10;

function makePaddle(color) {
  const group = new THREE.Group();
  const blade = new THREE.Mesh(
    new THREE.CylinderGeometry(PADDLE_RADIUS, PADDLE_RADIUS, 0.012, 40),
    new THREE.MeshStandardMaterial({ color, roughness: 0.7 }),
  );
  blade.rotation.x = Math.PI / 2;
  blade.castShadow = true;
  const handle = new THREE.Mesh(
    new THREE.BoxGeometry(0.028, 0.1, 0.022),
    new THREE.MeshStandardMaterial({ color: 0xc89b62, roughness: 0.8 }),
  );
  handle.position.y = -PADDLE_RADIUS - 0.04;
  handle.castShadow = true;
  group.add(blade, handle);
  return group;
}

function makeTable() {
  const group = new THREE.Group();
  const H = TABLE.height;
  const top = new THREE.Mesh(
    new THREE.BoxGeometry(TABLE.width, 0.04, TABLE.length),
    new THREE.MeshStandardMaterial({ color: 0x3f8f6b, roughness: 0.85 }),
  );
  top.position.y = H - 0.02;
  top.receiveShadow = true;
  top.castShadow = true;
  group.add(top);

  const white = new THREE.MeshBasicMaterial({ color: 0xf7f5ef });
  const line = (w, l, x, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.001, l), white);
    m.position.set(x, H + 0.0008, z);
    group.add(m);
  };
  const E = 0.02;
  line(TABLE.width, E, 0, TABLE.length / 2 - E / 2);
  line(TABLE.width, E, 0, -TABLE.length / 2 + E / 2);
  line(E, TABLE.length, TABLE.width / 2 - E / 2, 0);
  line(E, TABLE.length, -TABLE.width / 2 + E / 2, 0);
  line(0.006, TABLE.length, 0, 0);

  const dark = new THREE.MeshStandardMaterial({ color: 0x1f2a24, roughness: 0.9 });
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, H - 0.04, 0.06), dark);
      leg.position.set(sx * (TABLE.width / 2 - 0.15), (H - 0.04) / 2, sz * (TABLE.length / 2 - 0.3));
      leg.castShadow = true;
      group.add(leg);
    }
  }

  const netW = TABLE.width + NET_OVERHANG * 2;
  const net = new THREE.Mesh(
    new THREE.PlaneGeometry(netW, NET_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x1f2a24, transparent: true, opacity: 0.5, side: THREE.DoubleSide }),
  );
  net.position.set(0, H + NET_HEIGHT / 2, 0);
  const tape = new THREE.Mesh(new THREE.BoxGeometry(netW, 0.012, 0.006), white);
  tape.position.set(0, H + NET_HEIGHT, 0);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.015, NET_HEIGHT + 0.02, 0.015), dark);
    post.position.set((sx * netW) / 2, H + NET_HEIGHT / 2, 0);
    group.add(post);
  }
  group.add(net, tape);
  return group;
}

export function createRenderer(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xefece6);

  const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 50);
  camera.position.set(0, 1.9, 3.35);
  camera.lookAt(0, 0.8, -0.2);

  scene.add(new THREE.HemisphereLight(0xffffff, 0xd8d2c4, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(2, 5, 3);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -3, right: 3, top: 3, bottom: -3, near: 0.5, far: 12 });
  scene.add(sun);

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.ShadowMaterial({ opacity: 0.18 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  scene.add(makeTable());

  const nearPaddle = makePaddle(0xe8573a);
  const farPaddle = makePaddle(0x23221f);
  farPaddle.rotation.y = Math.PI;
  scene.add(nearPaddle, farPaddle);

  const ball = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_RADIUS, 20, 20),
    new THREE.MeshStandardMaterial({ color: 0xfffaf0, roughness: 0.4 }),
  );
  ball.castShadow = true;
  scene.add(ball);

  const trail = [];
  for (let i = 0; i < TRAIL; i++) {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(BALL_RADIUS * (1 - i / (TRAIL + 2)), 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xe8573a, transparent: true, opacity: 0.28 * (1 - i / TRAIL) }),
    );
    m.visible = false;
    scene.add(m);
    trail.push(m);
  }
  const history = [];

  function resize() {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (canvas.width !== Math.floor(w * renderer.getPixelRatio()) || canvas.height !== Math.floor(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      // keep the whole table visible on narrow windows
      camera.fov = camera.aspect < 1.2 ? 50 + (1.2 - camera.aspect) * 35 : 50;
      camera.updateProjectionMatrix();
    }
  }

  function placePaddle(mesh, p, sign) {
    mesh.position.set(p.pos.x, p.pos.y, p.pos.z);
    mesh.rotation.z = -sign * Math.max(-0.7, Math.min(0.7, p.pos.x * 0.6));
  }

  return {
    render(game) {
      resize();
      const active = !!game;
      nearPaddle.visible = farPaddle.visible = ball.visible = active;
      if (active) {
        placePaddle(nearPaddle, game.near, 1);
        placePaddle(farPaddle, game.far, -1);
        ball.position.set(game.ball.pos.x, game.ball.pos.y, game.ball.pos.z);

        const moving = game.phase === 'live';
        history.unshift(moving ? { ...game.ball.pos } : null);
        history.length = Math.min(history.length, TRAIL * 2);
        for (let i = 0; i < TRAIL; i++) {
          const h = history[(i + 1) * 2 - 1];
          trail[i].visible = !!h;
          if (h) trail[i].position.set(h.x, h.y, h.z);
        }
      } else {
        for (const t of trail) t.visible = false;
      }
      renderer.render(scene, camera);
    },
  };
}
