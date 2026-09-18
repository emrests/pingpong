const $ = (id) => document.getElementById(id);
const show = (el, on) => el.classList.toggle('hidden', !on);

export function createUI(actions) {
  const el = {
    hud: $('hud'), spin: $('spin'), status: $('status'), help: $('help'), banner: $('banner'),
    menu: $('menu'), menuMsg: $('menu-msg'), lobby: $('lobby'), code: $('code'),
    over: $('over'), overTitle: $('over-title'), overScore: $('over-score'),
    sNear: $('s-near'), sFar: $('s-far'), joinCode: $('join-code'), copy: $('btn-copy'),
  };
  let bannerTimer = 0;
  let inviteLink = '';

  $('btn-practice').onclick = () => actions.onPractice();
  $('btn-host').onclick = () => actions.onHost();
  $('btn-join').onclick = () => {
    const code = el.joinCode.value.trim().toUpperCase();
    if (code.length === 4) actions.onJoin(code);
  };
  el.joinCode.onkeydown = (e) => {
    if (e.key === 'Enter') $('btn-join').click();
  };
  $('btn-cancel').onclick = () => actions.onLeave();
  $('btn-leave').onclick = () => actions.onLeave();
  $('btn-rematch').onclick = () => actions.onRematch();
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
    gameOver(won, rules) {
      el.overTitle.textContent = won ? 'Kazandın!' : 'Kaybettin';
      el.overScore.textContent = `${rules.score.near} — ${rules.score.far}`;
      only(el.over);
    },
  };
}
