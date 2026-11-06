// Mascotte « mini-Johan » : sprites animés, écran d'ouverture, fin de séance, popups.
// Les planches viennent de img/mascotte/ (générées par maquettes/sprites-app.py) ; décor, feux d'artifice et confettis en code.
import { SPRITES } from './sprites.js';

const BASE = 'img/mascotte/';
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const escH = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/** Largeur affichée d'un sprite pour une hauteur de personnage debout h (px). */
export function spriteSize(name, h) {
  const s = SPRITES[name];
  const H = Math.round(h * s.scale);
  return { w: Math.round((H * s.w) / s.h), h: H };
}

/**
 * HTML d'un sprite. h = hauteur d'un personnage debout en px : la taille réelle suit l'échelle de la planche,
 * pour que le personnage garde la même taille d'une animation à l'autre. Les animations « une fois » restent sur la dernière image.
 */
export function sprite(name, h, { once, cls = '', flip = false, ms } = {}) {
  const s = SPRITES[name];
  if (!s) return '';
  const { w, h: H } = spriteSize(name, h);
  const it = once ?? !s.loop ? 1 : 'infinite';
  return `<span class="spr ${cls}${flip ? ' flip' : ''}${s.n === 1 ? ' one' : ''}" style="width:${w}px;height:${H}px;--n:${s.n};--d:${ms || s.ms}ms;--it:${it}" aria-hidden="true"><img src="${BASE}${name}.webp" alt="" draggable="false" style="width:${s.n * 100}%"></span>`;
}

/** Petite flamme pixel (série de semaines, records). */
export const FLAME = '<svg class="flame" viewBox="0 0 10 13" shape-rendering="crispEdges" aria-hidden="true"><path fill="#ff5fa2" d="M4 0h1v1h1v1h1v1h1v2h1v1h1v4H9v1H8v1H7v1H3v-1H2v-1H1v-1H0V6h1V5h1v1h1V3h1z"/><path fill="#ff8a3d" d="M5 3h1v1h1v2h1v4H7v1H6v1H4v-1H3v-1H2V7h1v1h1V5h1z"/><path fill="#ffd166" d="M5 6h1v2h1v2H6v1H4v-1H3V9h1V8h1z"/></svg>';

/* ---------- Popup mascotte (record, motivation, sauvegarde, abandon) ---------- */
let popT;
/** Affiche une carte avec un sprite et un message. Se ferme au toucher ou après ms. */
export function mascotPop({ anim, h = 160, title = '', html = '', ms = 3000, cls = '', confetti = false }) {
  const el = document.getElementById('mpop');
  clearTimeout(popT);
  const conf = confetti ? Array.from({ length: 28 }, (_, n) => `<i style="left:${(n * 37) % 100}%;animation-delay:${(n % 7) * 0.08}s;background:hsl(${n * 47},90%,60%)"></i>`).join('') : '';
  el.innerHTML = `${conf}<div class="mpop-box ${cls}"><div class="mpop-spr">${sprite(anim, h)}</div>${title ? `<h2>${title}</h2>` : ''}${html}</div>`;
  el.className = 'show';
  return new Promise((resolve) => {
    const close = () => { clearTimeout(popT); el.className = ''; el.onclick = null; resolve(); };
    el.onclick = close;
    popT = setTimeout(close, ms);
  });
}

const MOTIV = [
  'Yeah buddy ! Exercice plié.',
  'Propre. On garde ce rythme.',
  'Ça, c\'est fait. Au suivant !',
  'Les muscles chauffent, continue !',
  'Solide. La suite est pour toi.',
  'Encore un de moins. Respire et enchaîne.',
  'Rien ne t\'arrête aujourd\'hui.',
  'Belle série. Le prochain va y passer aussi.',
];
/** Fenêtre de motivation à « Exercice suivant » : bilan de l'exercice terminé et prochain exercice. */
export function motivationPop({ name, bilan, next }) {
  return mascotPop({
    anim: 'motivation', h: 150, ms: 3200, cls: 'motiv',
    title: escH(pick(MOTIV)),
    html: `<p><strong>${escH(name)}</strong></p><p class="muted small">${escH(bilan)}</p>${next ? `<p class="small">Suivant : <strong>${escH(next)}</strong></p>` : ''}`,
  });
}

/* ---------- Écran d'ouverture ---------- */
/** Décor Muscle Beach, mini-Johan sur son transat ; un appui le fait se lever puis ouvre l'appli. */
export function showSplash({ line = '' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.id = 'splash';
    el.innerHTML = `<div class="sp-sky"></div>
      <div class="sp-title"><span>Yeah</span>Buddy</div>
      <div class="sp-stage">${line ? `<div class="sp-say">${escH(line)}</div>` : ''}<div class="sp-spr">${sprite('transat', 230)}</div></div>
      <button class="btn primary big sp-go">Entrer</button>`;
    document.body.append(el);
    let gone = false;
    el.addEventListener('click', () => {
      if (gone) return;
      gone = true;
      const out = () => { el.classList.add('out'); setTimeout(() => { el.remove(); resolve(); }, reduced() ? 0 : 320); };
      if (reduced()) { out(); return; }
      el.querySelector('.sp-say')?.remove();
      el.querySelector('.sp-spr').innerHTML = sprite('sortie', 230, { once: true, ms: 1800 });
      el.querySelector('.sp-go').textContent = 'C\'est parti !';
      setTimeout(out, 2100);
    });
  });
}

/* ---------- Fin de séance ---------- */
/** Type de séance d'après son nom : animation, couleur et message de fin. icon = animation pour l'accueil. */
export function sessionKind(name) {
  const n = (name || '').toLowerCase();
  if (/push|pec|poussé/.test(n)) return { anim: 'couche', icon: 'couche', color: '#ff5fa2', msg: 'PUSH PLIÉ !' };
  if (/pull|dos|tirage/.test(n)) return { anim: 'traction', icon: 'traction', color: '#2de2e6', msg: 'PULL PLIÉ !' };
  if (/leg|jambe|squat|cuisse/.test(n)) return { anim: 'squat', icon: 'squat', color: '#ff8a3d', msg: 'LEGS PLIÉES !' };
  return { anim: null, icon: 'flex', color: '#ffd166', msg: 'SÉANCE PLIÉE !' };
}

/**
 * Animation de fin de séance par-dessus le récap. complete = toutes les séries prévues faites.
 * Complète : dernière série (couché / traction / squat), saut, pose double biceps, feux d'artifice et confettis.
 * Anticipée avec les 2 premiers exercices complets (core) : saut et pose, il est content.
 * Anticipée sinon : chute humoristique, sans feux d'artifice. Un appui ferme.
 */
export function showFinale({ workoutName, complete, core = false, stats }) {
  const kind = sessionKind(workoutName);
  const el = document.createElement('div');
  el.id = 'finale';
  el.innerHTML = `<canvas></canvas><div class="fn-top"><div class="fn-big"></div><div class="fn-sub"></div></div>
    <div class="fn-stage"><div class="fn-say"></div><div class="fn-spr"></div></div>
    <div class="fn-stats">${stats.map(([v, l]) => `<div><b>${escH(v)}</b><span>${escH(l)}</span></div>`).join('')}</div>
    <button class="btn primary big fn-go">Voir le récap</button>`;
  document.body.append(el);
  const $ = (s) => el.querySelector(s);
  const timers = [];
  const at = (ms, fn) => timers.push(setTimeout(fn, ms));
  let fx = null;
  const close = () => { timers.forEach(clearTimeout); fx?.stop(); el.classList.add('out'); setTimeout(() => el.remove(), 250); };
  el.addEventListener('click', close);

  const pose = (msg) => {
    $('.fn-spr').innerHTML = sprite('biceps', 300, { cls: 'pulse' });
    $('.fn-say').textContent = msg;
    $('.fn-say').classList.add('on');
    if (!reduced()) fx = fireworks($('canvas'));
  };
  if (!complete && core) {
    $('.fn-big').textContent = 'L\'ESSENTIEL EST FAIT';
    $('.fn-sub').textContent = 'Les 2 premiers exercices sont bouclés : ce sont les plus importants.';
    if (reduced()) { pose('Séance validée !'); return close; }
    $('.fn-spr').innerHTML = sprite('saut', 260, { once: true });
    at(SPRITES.saut.ms, () => pose('Séance validée !'));
    return close;
  }
  if (!complete) {
    $('.fn-big').textContent = 'FIN ANTICIPÉE';
    $('.fn-sub').textContent = 'Les 2 premiers exercices n\'étaient pas finis. La prochaine sera la bonne.';
    $('.fn-spr').innerHTML = sprite('chute', 240, { once: true });
    at(reduced() ? 0 : 2800, () => { $('.fn-say').textContent = 'Je me relève et je reviens !'; $('.fn-say').classList.add('on'); });
    return close;
  }
  $('.fn-big').textContent = 'DERNIÈRE SÉRIE';
  if (reduced()) { $('.fn-big').textContent = kind.msg; pose(kind.msg); return close; }
  let t = 0;
  if (kind.anim) {
    $('.fn-spr').innerHTML = sprite(kind.anim, 230);
    t = SPRITES[kind.anim].ms * 2;
  }
  at(t, () => { $('.fn-big').textContent = 'BRAVO !'; $('.fn-spr').innerHTML = sprite('saut', 260, { once: true }); });
  at(t + SPRITES.saut.ms, () => { $('.fn-big').textContent = kind.msg; pose(kind.msg); });
  return close;
}

/** Feux d'artifice et confettis en pixels (blocs de 4 px) sur un canvas plein écran. */
function fireworks(cv) {
  const dpr = Math.min(2, devicePixelRatio || 1);
  const W = innerWidth, H = innerHeight;
  cv.width = W * dpr; cv.height = H * dpr;
  const g = cv.getContext('2d');
  g.scale(dpr, dpr);
  const P = 4, LW = W / P, LH = H / P;
  const px = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x) * P, Math.round(y) * P, w * P, h * P); };
  const cols = ['#ff4f9a', '#2de2e6', '#ffd166', '#ffffff'];
  const bursts = Array.from({ length: 10 }, (_, k) => [k * 600 + (k % 3) * 120, LW * (0.2 + ((k * 0.37) % 0.6)), LH * (0.12 + ((k * 0.23) % 0.25)), cols[k % 4]]);
  const t0 = performance.now();
  let raf = 0;
  const frame = (now) => {
    const s = (now - t0) % 6500;
    g.clearRect(0, 0, W, H);
    for (const [tb, cx, cy, c] of bursts) {
      const u = (s - tb) / 1000;
      if (u < -0.35 || u > 1.4) continue;
      if (u < 0) { const k = (u + 0.35) / 0.35; px(cx, LH * 0.6 - (LH * 0.6 - cy) * k, 1, 2, '#ffe0c0'); continue; }
      for (let i = 0; i < 20; i++) {
        const a = (i / 20) * Math.PI * 2, v = 22 * (0.7 + ((i * 7) % 5) * 0.08);
        const pos = (q) => [cx + Math.cos(a) * v * q, cy + Math.sin(a) * v * q + 12 * q * q];
        const [x, y] = pos(u); px(x, y, 1, 1, u < 0.12 ? '#ffffff' : u < 0.85 ? c : '#6e2c78');
        if (u > 0.06 && u < 0.6) { const [x2, y2] = pos(u - 0.06); px(x2, y2, 1, 1, '#ffb35c'); }
      }
    }
    const tc = now - t0;
    for (let i = 0; i < 50; i++) {
      const st = 200 + (i % 8) * 120; if (tc < st) continue;
      const y = (-4 + ((tc - st) / 1000) * (22 + ((i * 13) % 16))) % (LH + 8);
      const x = ((i * 37) % LW) + Math.sin(tc / 300 + i) * 3, flip = Math.floor(tc / 160 + i) % 2;
      px(x, y, flip ? 2 : 1, flip ? 1 : 2, cols[i % 4]);
    }
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return { stop: () => cancelAnimationFrame(raf) };
}
