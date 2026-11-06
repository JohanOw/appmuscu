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

function tone(freq, start, dur, vol = 0.35) {
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0.0001, start);
  g.gain.exponentialRampToValueAtTime(vol, start + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  o.connect(g).connect(ctx.destination);
  o.start(start); o.stop(start + dur + 0.05);
}

export function beepEnd() {
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.05;
  for (let i = 0; i < 3; i++) tone(880, t + i * 0.35, 0.25);
  tone(1320, t + 1.05, 0.6);
  // Vibration : API absente de Safari iOS (à confirmer sur l'iPhone) ; utilisée si elle existe.
  if (navigator.vibrate) try { navigator.vibrate([300, 150, 300]); } catch { /* ignoré */ }
}

export function beepRecord() {
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  const t = ctx.currentTime + 0.05;
  [523, 659, 784, 1047].forEach((f, i) => tone(f, t + i * 0.12, 0.3, 0.3));
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
  start(sec) { this.total = sec; this.endAt = Date.now() + sec * 1000; this.#loop(); }
  resume(endAt, total) { this.endAt = endAt; this.total = total; this.#loop(); }
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
