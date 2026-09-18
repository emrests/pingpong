const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);

const CAM_HELP = {
  hand:
    'El: raketi hareket ettir (yukarı = fileye doğru) · Topa doğru savur: vuruş<br />' +
    'Avuç içi kameraya: topspin · El üstü kameraya: backspin · El yan: düz<br />' +
    'Servis: Space ya da tıkla (top havaya) ve düşerken vur · Menü: sağ üstteki buton',
  color:
    'Defter: raketi hareket ettir (yukarı = fileye doğru) · Topa doğru savur: vuruş<br />' +
    'Sol tuş basılı: topspin · Sağ tuş basılı: backspin<br />' +
    'Servis: Space ya da tıkla (top havaya) ve düşerken vur · Menü: sağ üstteki buton',
};

export function createUI(actions) {
  const el = {
    hud: $('hud'), spin: $('spin'), status: $('status'), help: $('help'), banner: $('banner'),
    menuBtn: $('btn-menu'),
    menu: $('menu'), menuMsg: $('menu-msg'), lobby: $('lobby'), code: $('code'),
    over: $('over'), overTitle: $('over-title'), overScore: $('over-score'),
    sNear: $('s-near'), sFar: $('s-far'), joinCode: $('join-code'), copy: $('btn-copy'),
    cam: $('cam'), camMsg: $('cam-msg'),
  };
  const mouseHelp = el.help.innerHTML;
  let bannerTimer = 0;
  let inviteLink = '';

  for (const b of document.querySelectorAll('[data-level]')) b.onclick = () => actions.onPractice(b.dataset.level);
  $('btn-host').onclick = () => actions.onHost();
  $('btn-join').onclick = () => {
    const code = el.joinCode.value.trim().toUpperCase();
    if (code.length === 4) actions.onJoin(code);
  };
  el.joinCode.onkeydown = (e) => {
    if (e.key === 'Enter') $('btn-join').click();
  };
  $('btn-cancel').onclick = () => actions.onLeave();
  el.menuBtn.onclick = () => actions.onLeave();
  $('btn-leave').onclick = () => actions.onLeave();
  $('btn-rematch').onclick = () => actions.onRematch();
  $('btn-cam').onclick = () => actions.onCamOn();
  $('btn-cam-off').onclick = () => actions.onCamOff();
  $('btn-cam-hand').onclick = () => actions.onCamHand();
  $('btn-cam-calibrate').onclick = () => actions.onCamCalibrate();
  for (const b of document.querySelectorAll('[data-cam-mode]')) b.onclick = () => actions.onCamMode(b.dataset.camMode);
  el.copy.onclick = async () => {
    try {
      await navigator.clipboard.writeText(inviteLink);
      el.copy.textContent = 'Kopyalandı ✓';
    } catch {
      el.copy.textContent = inviteLink;
    }
  };

  function only(panel) {
    for (const p of [el.menu, el.lobby, el.over]) show(p, p === panel);
    const playing = panel === null;
    show(el.hud, playing || panel === el.over);
    show(el.spin, playing);
    show(el.help, playing);
    show(el.menuBtn, playing);
    el.cam.classList.toggle('compact', panel !== el.menu);
  }

  return {
    showMenu(message = '') {
      el.menuMsg.textContent = message;
      only(el.menu);
    },
    showLobby(code, link) {
      inviteLink = link;
      el.code.textContent = code;
      el.copy.textContent = 'Davet linkini kopyala';
      only(el.lobby);
    },
    showHud() {
      only(null);
    },
    setScore(rules) {
      el.sNear.querySelector('.num').textContent = rules.score.near;
      el.sFar.querySelector('.num').textContent = rules.score.far;
      el.sNear.classList.toggle('serving', rules.state !== 'over' && rules.server === 'near');
      el.sFar.classList.toggle('serving', rules.state !== 'over' && rules.server === 'far');
    },
    setSpin(buttons) {
      const name = buttons.left ? 'TOPSPIN' : buttons.right ? 'BACKSPIN' : 'DÜZ';
      el.spin.innerHTML = `FALSO: <b>${name}</b>`;
    },
    banner(text, ms = 1100) {
      el.banner.textContent = text;
      show(el.banner, true);
      clearTimeout(bannerTimer);
      bannerTimer = setTimeout(() => show(el.banner, false), ms);
    },
    status(text) {
      el.status.textContent = text;
    },
    // cam: null when the camera is off, else { mode, rightHand }
    setCam(cam, message = '') {
      show(el.cam, cam !== null);
      show($('btn-cam'), cam === null);
      el.camMsg.textContent = message;
      el.help.innerHTML = cam === null ? mouseHelp : CAM_HELP[cam.mode];
      if (cam === null) return;
      for (const b of document.querySelectorAll('[data-cam-mode]')) {
        b.classList.toggle('on', b.dataset.camMode === cam.mode);
      }
      show($('btn-cam-hand'), cam.mode === 'hand');
      show($('btn-cam-calibrate'), cam.mode === 'color');
      $('btn-cam-hand').textContent = cam.rightHand ? 'Sağ el (değiştir)' : 'Sol el (değiştir)';
    },
    gameOver(won, rules) {
      el.overTitle.textContent = won ? 'Kazandın!' : 'Kaybettin';
      el.overScore.textContent = `${rules.score.near} — ${rules.score.far}`;
      only(el.over);
    },
  };
}
