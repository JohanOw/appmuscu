// Timer de repos, son de fin et maintien de l'écran allumé.

/* ---------- Son (Web Audio) ---------- */
let ctx;

/** À appeler lors d'un appui utilisateur : iOS n'autorise le son qu'après un geste. */
export function unlockAudio() {
  try {
    // iOS 17+ : session "transient" = son court qui se mélange à la musique (à vérifier sur iPhone).
    if (navigator.audioSession && navigator.audioSession.type !== 'transient') navigator.audioSession.type = 'transient';
  } catch { /* non supporté */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!ctx) ctx = new AC();
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // Petit son muet pour "débloquer" la sortie audio sur iOS.
  const b = ctx.createBuffer(1, 1, 22050);
  const src = ctx.createBufferSource();
  src.buffer = b; src.connect(ctx.destination); src.start(0);
}

function tone(freq, start, dur, vol = 0.35, type = 'sine') {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.05);
}

/** Cloche : fondamentale + harmoniques non entières, longue décroissance. */
function bell(freq, start, vol = 0.3) {
  [[1, 1, 1.6], [2.76, 0.35, 0.9], [5.4, 0.15, 0.5]].forEach(([m, v, d]) => tone(freq * m, start, d, vol * v));
}

/** Prépare un son : renvoie l'heure de départ, ou null si le son n'est pas débloqué. */
function at() {
  if (!ctx) return null;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  return ctx.currentTime + 0.05;
}

/* Sons de fin de repos au choix (Réglages). Tous synthétisés : aucun fichier, marche hors ligne. */
export const REST_SOUNDS = {
  classic: { name: 'Classique', play: (t) => { for (let i = 0; i < 3; i++) tone(880, t + i * 0.35, 0.25); tone(1320, t + 1.05, 0.6); } },
  arcade: { name: 'Arcade', play: (t) => { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, t + i * 0.1, 0.12, 0.18, 'square')); tone(1568, t + 0.65, 0.45, 0.16, 'square'); } },
  cloche: { name: 'Cloche', play: (t) => { bell(660, t); bell(660, t + 0.6); bell(880, t + 1.2, 0.35); } },
  coach: { name: 'Sifflet', play: (t) => { tone(2100, t, 0.18, 0.25, 'triangle'); tone(2100, t + 0.28, 0.5, 0.25, 'triangle'); } },
};
let restSound = 'classic';
let fxOn = true;

/** Réglages du son : son de fin de repos et sons de réussite (exercice, record, fin de séance). */
export function setSoundPrefs({ rest, fx } = {}) {
  if (rest && REST_SOUNDS[rest]) restSound = rest;
  if (typeof fx === 'boolean') fxOn = fx;
}

/** Fait écouter un son de fin de repos (bouton « Écouter » des Réglages, donc après un geste). */
export function previewRest(id) {
  unlockAudio();
  const t = at(); if (t !== null) (REST_SOUNDS[id] || REST_SOUNDS.classic).play(t);
}

export function beepEnd() {
  const t = at(); if (t === null) return;
  REST_SOUNDS[restSound].play(t);
  // Vibration : API absente de Safari iOS (à confirmer sur l'iPhone) ; utilisée si elle existe.
  if (navigator.vibrate) try { navigator.vibrate([300, 150, 300]); } catch { /* ignoré */ }
}

export function beepRecord() {
  const t = fxOn ? at() : null; if (t === null) return;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 0.3));
}

/** Exercice terminé : petit « ta-da » montant. */
export function beepExercise() {
  const t = fxOn ? at() : null; if (t === null) return;
  tone(659, t, 0.14, 0.25, 'triangle'); tone(988, t + 0.13, 0.4, 0.28, 'triangle');
}

/** Fin de séance : courte fanfare et accord final. */
export function beepFinish() {
  const t = fxOn ? at() : null; if (t === null) return;
  [392, 523, 659, 784].forEach((f, i) => tone(f, t + i * 0.14, 0.2, 0.25, 'triangle'));
  [523, 659, 784, 1047].forEach((f) => tone(f, t + 0.62, 1.3, 0.14, 'triangle'));
}

/* ---------- Screen Wake Lock ---------- */
let wakeWanted = false;
let sentinel = null;
let wakeListener = null;
let wakeError = '';

export const wakeLockSupported = () => 'wakeLock' in navigator;

async function acquire() {
  if (!wakeWanted || !wakeLockSupported() || document.visibilityState !== 'visible') return;
  if (sentinel && !sentinel.released) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    wakeError = '';
    sentinel.addEventListener('release', () => { sentinel = null; wakeListener?.(); });
  } catch (e) {
    sentinel = null;
    wakeError = `${e?.name || 'Erreur'} : ${e?.message || ''}`.trim();
    console.warn('Wake lock refusé', e);
  }
  wakeListener?.();
}

document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') acquire(); });

export function keepScreenOn(on, onChange) {
  wakeWanted = on;
  if (onChange) wakeListener = onChange;
  if (on) return acquire();
  if (sentinel) sentinel.release().catch(() => {});
  sentinel = null;
  wakeListener?.();
}

export const screenLocked = () => !!(sentinel && !sentinel.released);
export const lastWakeError = () => wakeError;

/* ---------- Timer ---------- */
// L'état repose sur une heure de fin absolue : le décompte reste juste même si la page a été mise en pause.
export class RestTimer {
  constructor({ onTick, onEnd }) {
    this.onTick = onTick;
    this.onEnd = onEnd;
    this.endAt = null;
    this.total = 0;
    this.iv = null;
  }
  get remainingMs() { return this.endAt ? Math.max(0, this.endAt - Date.now()) : 0; }
  get running() { return this.endAt !== null; }
  start(sec) { this.total = sec; this.endAt = Date.now() + sec * 1000; this.startKey = this.endAt; this.#loop(); }
  resume(endAt, total) { this.endAt = endAt; this.total = total; this.startKey ??= endAt; this.#loop(); }
  adjust(deltaSec) {
    if (!this.endAt) return;
    this.endAt = Math.max(Date.now() + 1000, this.endAt + deltaSec * 1000);
    this.total = Math.max(1, this.total + deltaSec);
    this.onTick(this);
  }
  stop() { this.endAt = null; clearInterval(this.iv); this.iv = null; this.onTick(this); }
  #loop() {
    clearInterval(this.iv);
    const step = () => {
      this.onTick(this);
      if (this.endAt && Date.now() >= this.endAt) {
        clearInterval(this.iv); this.iv = null; this.endAt = null;
        this.onEnd(this);
      }
    };
    this.iv = setInterval(step, 250);
    step();
  }
}

export function fmtClock(ms) {
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
