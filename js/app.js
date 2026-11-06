// AppMuscu : routeur et écrans.
import * as db from './db.js';
import { EX_ART, artSrc, decorOf, glowLayer, muscleMap } from './exart.js';
import { DEFAULT_EXERCISES, DEFAULT_WORKOUTS, DEFAULT_REST_SEC, CATALOG_IMG_BASE } from './defaults.js';
import { epley, bestOf, detectPR, previousSetsFor, lastTime, sessionStats, exerciseSeries, nextWorkout, parseNum, formatDuration, fmtKg, round1, suggestNext, trainedDays, warmupWeight, supersetGroup, supersetLabels, weekStreak, weekStart } from './stats.js';
import { sprite, mascotPop, motivationPop, showSplash, showFinale, sessionKind, FLAME } from './mascot.js';
import { DEFAULT_CUES } from './cues.js';
import { RestTimer, unlockAudio, beepEnd, beepRecord, keepScreenOn, wakeLockSupported, screenLocked, lastWakeError, fmtClock } from './timer.js';
import { buildBackupFile, shareOrDownload, readBackup, restoreBackup } from './backup.js';
import { lineChart } from './charts.js';

export const APP_VERSION = '2.1.1';

/* ---------- État en mémoire ---------- */
const state = {
  exercises: new Map(),
  workouts: [],
  sessions: [],
  restSec: DEFAULT_REST_SEC,
  warm: { on: true, pct: 60, reps: 15 }, // série d'échauffement automatique
  active: null, // séance en cours
  ui: { exIndex: 0, timerMin: false, justSet: null, calOffset: 0, ptab: 'seances', editSub: null },
  backupFile: null,
};

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtDay = (t) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#2a2f3a"/><text x="2" y="1.9" font-size="1" text-anchor="middle" fill="#8a93a6">🏋️</text></svg>');
/** Image mini-Johan si elle existe et que l'image n'a pas été remplacée par l'utilisateur. */
const hasArt = (ex) => {
  if (!ex || !EX_ART[ex.id]) return false;
  const def = DEFAULT_EXERCISES.find((d) => d.id === ex.id);
  return !def || ex.image === def.image;
};
const img = (ex, cls = '') => hasArt(ex)
  ? `<img class="${cls} art" src="${artSrc(ex.id)}" alt="" loading="lazy">`
  : `<img class="${cls}" src="${esc(ex?.image || PLACEHOLDER)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
const cueHtml = (c) => esc(c).replace(/\n/g, '<br>');
/**
 * Grande image d'exercice. Personnage animé : décor 1 ou 2 avec néons animés, et la consigne
 * en orange néon à droite (grande vue de séance). Sinon : image + schéma des muscles.
 */
const exVis = (ex, cls, mapCls = '') => {
  const map = muscleMap(ex?.muscles, mapCls);
  if (!hasArt(ex)) return `<span class="exv">${img(ex, cls)}${map}</span>`;
  const cue = cls === 'exo-img' ? exCue(ex) : '';
  const side = cue ? `<span class="ex-cue"><span class="ex-cue-t">Consigne</span><span class="ex-cue-x">${cueHtml(cue)}</span></span>` : map;
  return `<span class="exv art d${decorOf(ex.id)} ${cls} ${cue ? 'has-cue' : ''}"><span class="ex-neon" aria-hidden="true"></span><span class="exv-in"><img src="${artSrc(ex.id)}" alt="" decoding="async">${glowLayer(ex.id)}</span>${side}</span>`;
};
const exName = (id) => state.exercises.get(id)?.name || id;
const workoutsSorted = () => [...state.workouts].sort((a, b) => a.order - b.order);
/** Réglage du repos à la seconde près : deux listes (minutes, secondes), affichées en roues sur iPhone. */
const restPicker = (cur, act) => {
  const m = Math.floor(cur / 60), sec = cur % 60;
  const o = (n, v, lab) => `<option value="${v}" ${v === n ? 'selected' : ''}>${lab}</option>`;
  return `<span class="restpick"><select class="field" data-change="${act}" data-u="m" aria-label="Minutes">${Array.from({ length: 11 }, (_, v) => o(m, v, v)).join('')}</select><em>min</em>
    <select class="field" data-change="${act}" data-u="s" aria-label="Secondes">${Array.from({ length: 60 }, (_, v) => o(sec, v, String(v).padStart(2, '0'))).join('')}</select><em>s</em></span>`;
};
/** Lit la valeur d'un restPicker (en secondes, au moins 5 s). */
const readRest = (el) => { const b = el.closest('.restpick'); return Math.max(5, +b.querySelector('[data-u="m"]').value * 60 + +b.querySelector('[data-u="s"]').value); };
const exCue = (ex) => ex?.cue ?? DEFAULT_CUES[ex?.id] ?? '';
const FEEL = [[1, 'Facile'], [2, 'Correct'], [3, 'Dur'], [4, 'À bloc']];
const FEEL_TXT = { 1: 'facile', 2: 'correct', 3: 'dur', 4: 'à bloc' };
/** Rangée de 4 boutons de ressenti. attrs : attributs data-* propres à l'appelant (action, série). */
const feelRow = (cur, attrs) => `<div class="feel" role="group" aria-label="Ressenti">${FEEL.map(([v, l]) => `<button class="btn sm ${cur === v ? 'on' : ''}" ${attrs} data-v="${v}" aria-pressed="${cur === v}">${l}</button>`).join('')}</div>`;
/**
 * Sous une série (ou un tour) : ligne repliée « Série correcte · note » avec un crayon,
 * ou, en édition, ressenti + note + Valider. key = identifiant unique de l'éditeur ouvert.
 */
const subLine = ({ key, done, feel, note, noun, fem, feelAttrs, noteAttrs, okAttrs, editAttrs }) => {
  if (state.ui.editSub === key) {
    return `<div class="set-sub sub-edit">${done ? feelRow(feel, feelAttrs) : ''}
      <input class="field" type="text" placeholder="Note (facultatif)" value="${esc(note || '')}" ${noteAttrs}>
      <button class="btn sm sub-ok" ${okAttrs}>Valider</button></div>`;
  }
  const f = done && feel ? `${noun} ${FEEL_ADJ[feel][fem ? 0 : 1]}` : '';
  const txt = [f && `<b class="feel-${feel}">${f}</b>`, note && `<span class="muted">${esc(note)}</span>`].filter(Boolean).join(' · ');
  return `<div class="set-sub sub-sum"><span class="grow small">${txt}</span><button class="btn icon sm pen" ${editAttrs} aria-label="Ressenti et note">✎</button></div>`;
};
const FEEL_ADJ = { 1: ['facile', 'facile'], 2: ['correcte', 'correct'], 3: ['dure', 'dur'], 4: ['à bloc', 'à bloc'] };
/** Affichage court d'une série : « éch. 60×12 », « 80×8 @8 ». */
const fmtSet = (z) => `${z.warm ? 'éch. ' : ''}${fmtKg(z.w)}×${z.r}${z.feel ? ` (${FEEL_TXT[z.feel]})` : z.rpe ? ` @${z.rpe}` : ''}`;
const exRest = (exId) => state.exercises.get(exId)?.restSec || state.restSec;
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
const BACK_HOME = '<a class="back" href="#/">‹ Entraînement</a>';

/* ---------- Démarrage ---------- */
// Appli mise en arrière-plan (ou fermée) : la séance en cours est écrite sans attendre.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && state.active) saveActive(true); });

async function boot() {
  const seeded = await db.kvGet('seeded');
  if (!seeded) {
    for (const e of DEFAULT_EXERCISES) await db.put('exercises', e);
    for (const w of DEFAULT_WORKOUTS) await db.put('workouts', w);
    await db.kvSet('seeded', true);
  }
  await reload();
  await migrateNotes();
  // Repos en cours, ou terminé appli fermée depuis moins de 30 min : l'écran « C'est parti » s'affiche.
  const tt = state.active?.timer;
  if (tt?.endAt > Date.now() - 30 * 60000) timer.resume(tt.endAt, tt.total);
  // Écran jamais en veille tant que l'appli est ouverte (redemandé au premier appui si le navigateur l'exige).
  keepScreenOn(true);
  // iOS n'accorde le maintien qu'après un vrai geste : la fin d'un toucher (touchend) ou un clic,
  // pas pointerdown. Redemandé à chaque geste tant qu'il n'est pas actif.
  const wakeRetry = () => { if (!screenLocked()) keepScreenOn(true); };
  document.addEventListener('touchend', wakeRetry, { passive: true });
  document.addEventListener('click', wakeRetry);
  // Stockage persistant : évite que Safari efface les données (accordé ou non par le navigateur).
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  window.addEventListener('hashchange', route);
  route();
  if (state.splash) showSplash({ line: state.active ? 'Prêt pour une nouvelle séance ?' : splashLine() });
  registerSW();
}

/** Bulle de l'écran d'ouverture : jours depuis la dernière séance, sinon message standard. */
function splashLine() {
  const last = state.sessions.filter((s) => s.end).sort((a, b) => b.start - a.start)[0];
  if (!last) return 'Prêt pour ta première séance ?';
  const days = Math.floor((Date.now() - last.start) / 86400000);
  if (days >= 3) return `${days} jours sans séance… On s'y remet ?`;
  return 'Prêt pour une nouvelle séance ?';
}

async function reload() {
  const [ex, wk, ss, rest, active, warm, splash, timerAdj, body] = await Promise.all([db.getAll('exercises'), db.getAll('workouts'), db.getAll('sessions'), db.kvGet('restSec'), db.kvGet('active'), db.kvGet('warm'), db.kvGet('splash'), db.kvGet('timerAdj'), db.kvGet('body')]);
  state.exercises = new Map(ex.map((e) => [e.id, e]));
  state.workouts = wk;
  state.sessions = ss;
  state.restSec = rest || DEFAULT_REST_SEC;
  state.active = active || null;
  state.warm = { on: true, pct: 60, reps: 15, ...(warm || {}) };
  state.splash = splash !== false;
  state.timerAdj = timerAdj === true; // boutons −15 s / +15 s masqués par défaut
  state.body = Array.isArray(body) ? body : [];
}

/** V1.2 : l'ancienne note par exercice devient la consigne (ajoutée sous la consigne par défaut). */
async function migrateNotes() {
  for (const ex of state.exercises.values()) {
    if (!ex.note || ex.cue !== undefined) continue;
    const def = DEFAULT_CUES[ex.id];
    ex.cue = (def ? def + '\n' : '') + 'Ma note : ' + ex.note;
    delete ex.note;
    await db.put('exercises', ex);
  }
}

let saveT;
function saveActive(now = false) {
  clearTimeout(saveT);
  const doSave = () => db.kvSet('active', state.active);
  if (now) return doSave();
  saveT = setTimeout(doSave, 300);
}

/* ---------- Routeur ---------- */
const routes = [
  [/^#?\/?$/, viewHome],
  [/^#\/session$/, viewSession],
  [/^#\/recap\/(.+)$/, viewRecap],
  [/^#\/workouts$/, viewWorkouts],
  [/^#\/workout\/(.+)$/, viewWorkoutEdit],
  [/^#\/pick\/(.+)$/, viewPick],
  [/^#\/exercise\/(.+)$/, viewExercise],
  [/^#\/progress$/, viewProgress],
  [/^#\/progress\/(.+)$/, viewProgressExercise],
  [/^#\/settings$/, viewSettings],
];
let handlers = {};
let clock;
function route() {
  clearInterval(clock);
  handlers = {};
  const hash = location.hash || '#/';
  const hit = routes.find(([re]) => re.test(hash));
  if (hit) hit[1](...hash.match(hit[0]).slice(1).map(decodeURIComponent));
  else viewHome();
  // 2 onglets : Progrès (et ses sous-écrans), sinon Entraînement.
  const tab = (hash.split('/')[1] || '') === 'progress' ? 'progress' : '';
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
  app.classList.remove('enter'); void app.offsetWidth; app.classList.add('enter'); // petite transition d'écran
  renderTimer();
  window.scrollTo(0, 0);
}
const go = (h) => { if (location.hash === h) route(); else location.hash = h; };

app.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (el && handlers[el.dataset.act]) { e.preventDefault(); handlers[el.dataset.act](el, e); }
});
app.addEventListener('change', (e) => { const el = e.target.closest('[data-change]'); if (el) handlers[el.dataset.change]?.(el, e); });
app.addEventListener('input', (e) => { const el = e.target.closest('[data-input]'); if (el) handlers[el.dataset.input]?.(el, e); });

function render(html, h = {}) { app.innerHTML = html; handlers = h; }

/* ---------- Petits composants ---------- */
const toastEl = document.getElementById('toast');
let toastT;
function toast(msg, ms = 2500) {
  toastEl.textContent = msg; toastEl.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove('show'), ms);
}

function modal(html, buttons) {
  return new Promise((resolve) => {
    const m = document.getElementById('modal');
    m.innerHTML = `<div class="modal-box">${html}<div class="modal-actions">${buttons.map((b, i) => `<button class="btn ${b.cls || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    m.classList.add('show');
    m.onclick = (e) => {
      const b = e.target.closest('button[data-i]');
      if (!b) return;
      m.classList.remove('show'); m.onclick = null;
      const value = buttons[b.dataset.i].value;
      const input = m.querySelector('input');
      resolve(value === 'input' ? input.value : value);
    };
    m.querySelector('input')?.focus();
  });
}
const confirmBox = (text, ok = 'OK', cls = 'primary') => modal(`<p>${text}</p>`, [{ label: 'Annuler', value: false }, { label: ok, value: true, cls }]);
const promptBox = (text, value = '') => modal(`<p>${text}</p><input class="field" type="text" value="${esc(value)}">`, [{ label: 'Annuler', value: null }, { label: 'OK', value: 'input', cls: 'primary' }]);

/* ---------- Entraînement (accueil + gestion des séances) ---------- */
function viewHome() {
  const ws = workoutsSorted();
  const next = nextWorkout(ws, state.sessions);
  const last = [...state.sessions].filter((s) => s.end).sort((a, b) => b.start - a.start)[0];
  const listEx = (w) => w.items.map((i) => esc(exName(i.exerciseId))).join(' · ');
  // Carte du jour : décor Muscle Beach et mini-Johan dans le mouvement de la séance (couché, traction, squat).
  const hero = (name, eyebrow, sub, btn) => {
    const k = sessionKind(name);
    return `<section class="card hero" style="--k:${k.color}"><div class="scene k-${k.icon}" aria-hidden="true"><div class="scene-spr">${sprite(k.icon, 104)}</div></div><div class="body">
      <div class="eyebrow">${eyebrow}</div><h2>${esc(name)}</h2><p class="muted small">${sub}</p>${btn}</div></section>`;
  };
  let top;
  if (state.active) {
    top = hero(state.active.workoutName, 'Séance en cours', `Commencée à ${new Date(state.active.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      '<button class="btn primary big" data-act="resume">Reprendre la séance</button>');
  } else if (next) {
    top = hero(next.name, 'Séance du jour', listEx(next) || 'Aucun exercice',
      `<button class="btn primary big" data-act="start" data-id="${esc(next.id)}">Démarrer</button>`);
  } else {
    top = `<section class="card empty">${sprite('hausse', 72)}<p>Aucune séance. Crée ta première séance ci-dessous.</p></section>`;
  }
  const ks = weekStreak(state.sessions);
  // Bilan de la semaine en cours (lundi à dimanche) et série de semaines.
  const wk0 = weekStart(Date.now());
  const thisWeek = state.sessions.filter((x) => x.end && weekStart(x.start) === wk0).map(sessionStats);
  const wVol = Math.round(thisWeek.reduce((a, x) => a + x.volume, 0));
  const wPr = thisWeek.reduce((a, x) => a + x.prs.length, 0);
  const streak = !state.sessions.some((x) => x.end) ? '' : `<section class="card week">
      <div class="streak ${ks.thisWeek ? '' : 'cold'}">${FLAME}<div class="grow">
      ${ks.weeks ? `<b>${ks.weeks} semaine${ks.weeks > 1 ? 's' : ''}</b> d'affilée` : '<b>Série à relancer</b>'}
      <div class="muted small">${ks.thisWeek ? 'Semaine validée, la flamme tient.' : 'Une séance cette semaine pour garder la flamme.'}</div></div></div>
      <div class="week-stats">
        <div><b>${thisWeek.length}</b><span>séance${thisWeek.length > 1 ? 's' : ''}</span></div>
        <div><b>${wVol.toLocaleString('fr-FR')}</b><span>kg soulevés</span></div>
        <div><b>${wPr}</b><span>record${wPr > 1 ? 's' : ''}</span></div>
      </div></section>`;
  const rows = ws.map((w) => `<li class="wk" style="--k:${sessionKind(w.name).color}">
      <span class="wk-ico" aria-hidden="true">${sprite(sessionKind(w.name).icon, 46)}</span>
      <a class="grow" href="#/workout/${esc(w.id)}"><strong>${esc(w.name)}</strong><div class="muted small">${w.items.length} exercice${w.items.length > 1 ? 's' : ''} · Cliquer pour modifier</div></a>
      ${state.active ? '' : `<button class="btn outline" data-act="start" data-id="${esc(w.id)}">Démarrer</button>`}</li>`).join('');
  render(`<header class="top"><h1>Entraînement</h1><a class="gear" href="#/settings" aria-label="Réglages">${GEAR}</a></header>
    ${top}
    ${streak}
    <h3 class="sec">Mes séances</h3><ul class="list card">${rows || '<li class="muted">Aucune séance</li>'}</ul>
    <div class="row gap"><button class="btn grow" data-act="new">+ Nouvelle séance</button>${ws.length > 1 ? '<a class="btn ghost" href="#/workouts">Changer l\'ordre</a>' : ''}</div>
    ${last ? `<p class="muted small center">Dernière séance : ${esc(last.workoutName)}, ${fmtDay(last.start)} · <a href="#/recap/${esc(last.id)}">voir le récap</a></p>` : ''}`, {
    resume: () => go('#/session'),
    start: (el) => startSession(el.dataset.id),
    new: newWorkout,
  });
}

async function newWorkout() {
  const name = (await promptBox('Nom de la nouvelle séance :', ''))?.trim();
  if (!name) return;
  const w = { id: uid(), name, order: Math.max(-1, ...state.workouts.map((x) => x.order)) + 1, items: [] };
  await db.put('workouts', w); state.workouts.push(w);
  go(`#/workout/${w.id}`);
}

async function startSession(workoutId) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  if (!w.items.length) { toast('Cette séance ne contient aucun exercice.'); return; }
  unlockAudio();
  state.active = {
    id: uid(), workoutId: w.id, workoutName: w.name, start: Date.now(), end: null, restSec: state.restSec, timer: null,
    items: w.items.map((it, k) => buildItem(it.exerciseId, it.sets, !!it.ss && k < w.items.length - 1)),
  };
  state.ui.exIndex = 0;
  await saveActive(true);
  go('#/session');
}

/** Exercice de séance : séries préremplies depuis la dernière fois, échauffement ajouté si une charge est connue. */
function buildItem(exerciseId, n, ss = false) {
  const lt = lastTime(state.sessions, exerciseId);
  const sets = Array.from({ length: n }, (_, k) => {
    const ref = lt?.sets[k] || lt?.sets[lt.sets.length - 1];
    return { w: ref ? ref.w : '', r: ref ? ref.r : '', done: false };
  });
  const item = { exerciseId, name: exName(exerciseId), restSec: exRest(exerciseId), planned: n, ss, sets };
  if (state.warm.on) addWarmup(item);
  return item;
}

/** Ajoute la série d'échauffement en tête (pct % de la 1re série de travail × reps réglées). Renvoie false sans charge connue. */
function addWarmup(it) {
  if (it.sets.some((z) => z.warm)) return false;
  const first = it.sets.find((z) => !z.warm);
  const w = warmupWeight(parseNum(first?.w), state.warm.pct);
  if (!(w > 0)) return false;
  it.sets.unshift({ w, r: state.warm.reps, done: false, warm: true });
  return true;
}

/** Choix de l'exercice de la séance en cours (bouton « Exercice 2/6 ▾ »). */
function pickSessionExercise() {
  const s = state.active;
  const labs = supersetLabels(s.items);
  const cur = Math.min(state.ui.exIndex, s.items.length - 1);
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal-box"><p><strong>Exercices de la séance</strong></p><ul class="pick-list ex-pick">${s.items.map((x, k) => {
    const work = x.sets.filter((z) => !z.warm);
    const done = work.filter((z) => z.done).length;
    return `<li data-i="${k}" class="${k === cur ? 'on' : ''} ${done && done >= work.length ? 'ok' : ''}"><span class="num">${k + 1}</span><span class="grow">${esc(x.name)}${labs[k] ? ` <span class="sstag">${labs[k]}</span>` : ''}</span><span class="cnt">${done}/${work.length}</span></li>`;
  }).join('')}</ul><div class="modal-actions"><button class="btn" data-x>Fermer</button></div></div>`;
  m.classList.add('show');
  m.onclick = (e) => {
    const li = e.target.closest('li[data-i]');
    if (!li && !e.target.closest('[data-x]')) return;
    m.classList.remove('show'); m.onclick = null;
    if (li) { state.ui.exIndex = +li.dataset.i; viewSession(); window.scrollTo(0, 0); }
  };
}

/* ---------- Séance en cours ---------- */
/** En-tête de séance et navigation entre exercices (un superset compte comme un bloc). */
function sessionTop(s, group) {
  const a = group[0], b = group[group.length - 1], n = s.items.length;
  return `<header class="top session-top">
      <div><div class="eyebrow">${esc(s.workoutName)}</div><div class="elapsed" id="elapsed">${fmtClock(Date.now() - s.start)}</div></div>
      <button class="btn danger" data-act="finish">Fin de séance</button>
    </header>
    <div class="exnav">
      <button class="btn icon" data-act="prevex" ${a === 0 ? 'disabled' : ''} aria-label="Exercice précédent">‹</button>
      <button class="btn grow expick" data-act="pickex">Exercice ${a === b ? a + 1 : `${a + 1}-${b + 1}`}/${n} ▾ <span class="small muted">${group.length > 1 ? 'superset' : ''}</span></button>
      <button class="btn icon" data-act="nextex" ${b >= n - 1 ? 'disabled' : ''} aria-label="Exercice suivant">›</button>
    </div>`;
}
function navHandlers(s, group) {
  const a = group[0], b = group[group.length - 1];
  const goEx = (k) => { state.ui.exIndex = Math.max(0, Math.min(s.items.length - 1, k)); viewSession(); window.scrollTo(0, 0); };
  return {
    pickex: pickSessionExercise,
    prevex: () => goEx(supersetGroup(s.items, Math.max(0, a - 1))[0]),
    nextex: () => goEx(b + 1),
    finish: finishSession,
    goEx,
  };
}
function startClock(s) {
  clock = setInterval(() => { const e = document.getElementById('elapsed'); if (e) e.textContent = fmtClock(Date.now() - s.start); }, 1000);
}

function viewSession() {
  clearInterval(clock); // sinon chaque nouvel affichage ajoute un chrono (bug « 0 puis 6 min » qui clignote)
  const s = state.active;
  if (!s) { location.replace('#/'); return; }
  const i = Math.min(state.ui.exIndex, s.items.length - 1);
  const group = supersetGroup(s.items, i);
  if (group.length > 1) { viewSuperset(s, group); return; }
  const it = s.items[i];
  const ex = state.exercises.get(it.exerciseId);
  const lt = lastTime(state.sessions, it.exerciseId, s.id);
  const best = bestOf(previousSetsFor(state.sessions, null, it.exerciseId));
  const sug = suggestNext(lt, it.planned || it.sets.length);
  const rest = it.restSec || s.restSec || state.restSec;
  const work = it.sets.filter((z) => !z.warm);
  const doneN = work.filter((z) => z.done).length;
  let wn = 0;
  const rows = it.sets.map((st, k) => {
    const lab = st.warm ? 'Éch.' : String(++wn);
    const name = st.warm ? 'échauffement' : `série ${wn}`;
    const sub = st.warm
      ? `<div class="set-sub warm-sub"><span class="small muted">Échauffement léger, 12 à 15 reps : hors records et hors volume</span>${st.done ? '' : `<button class="btn sm ghost" data-act="delwarm">Retirer</button>`}</div>`
      : subLine({ key: `${i}-${k}`, done: st.done, feel: st.feel, note: st.note, noun: 'Série', fem: true,
        feelAttrs: `data-act="feel" data-k="${k}"`, noteAttrs: `data-change="setnote" data-k="${k}" aria-label="Note ${name}"`,
        okAttrs: 'data-act="subok"', editAttrs: `data-act="subedit" data-key="${i}-${k}"` });
    return `<div class="set-wrap ${st.warm ? 'warm' : ''}"><div class="set ${st.done ? 'done' : ''} ${state.ui.justSet === `${i}-${k}` ? 'just' : ''}">
      <span class="n">${lab}</span>
      <label><input class="field num" type="text" inputmode="decimal" value="${esc(typeof st.w === 'number' ? fmtKg(st.w) : st.w)}" data-input="setval" data-k="${k}" data-f="w" ${st.done ? 'disabled' : ''} aria-label="Poids ${name}"><em>kg</em></label>
      <label><input class="field num" type="text" inputmode="numeric" value="${esc(st.r)}" data-input="setval" data-k="${k}" data-f="r" ${st.done ? 'disabled' : ''} aria-label="Répétitions ${name}"><em>reps</em></label>
      ${st.done ? `<button class="btn icon undo" data-act="undo" data-k="${k}" aria-label="Annuler ${name}">↺</button>` : `<button class="btn icon ok" data-act="validate" data-k="${k}" aria-label="Valider ${name}">✓</button>`}
      ${st.pr?.length ? '<span class="prtag">🏆</span>' : ''}
    </div>${sub}</div>`;
  }).join('');
  state.ui.justSet = null;
  const anyUndone = work.some((z) => !z.done);
  const sugTxt = sug ? (sug.w ? `${fmtKg(sug.w)} kg × ${sug.r}` : `${sug.r} reps`) : '';
  const cue = exCue(ex);
  const lastWork = work[work.length - 1];
  const nav = navHandlers(s, group);
  render(`${sessionTop(s, group).replace('<span class="small muted"></span>', `<span class="small muted">${doneN}/${work.length} séries</span>`)}
    <section class="card exo">
      <button class="imgbtn" data-act="zoom">${exVis(ex, 'exo-img')}</button>
      <div class="exo-head"><h2>${esc(it.name)}</h2><button class="btn sm ghost" data-act="swap">⇄ Remplacer</button></div>
      <div class="rest-line"><span class="grow rest-lbl"><span aria-hidden="true">⏱</span> Repos pour cet exercice</span>${restPicker(rest, 'rest')}</div>
      <p class="last">${lt ? `La dernière fois : <strong>${fmtKg(lt.top.w)} kg × ${lt.top.r}</strong> <span class="muted small">(${fmtDay(lt.date)} · ${lt.sets.map((z) => `${fmtKg(z.w)}×${z.r}`).join(', ')})</span>` : '<span class="muted">Première fois sur cet exercice</span>'}</p>
      ${sug && anyUndone ? `<button class="btn suggest" data-act="applysug"><span>${sug.up ? '↗' : '='} Aujourd'hui : ${sugTxt}</span><span class="small">Appliquer</span></button>` : ''}
      ${best.count ? `<p class="muted small">Record : ${fmtKg(best.maxW)} kg · 1RM estimé (Epley) ${fmtKg(round1(best.maxE1rm))} kg</p>` : ''}
      ${!cue ? `<p class="small"><a href="#/exercise/${esc(it.exerciseId)}">+ Ajouter une consigne</a></p>` : hasArt(ex) ? '' : `<p class="cue-neon">${cueHtml(cue)}</p>`}
      <div class="sets">${rows}</div>
      <div class="row gap"><button class="btn" data-act="addset">+ Série</button>
        ${work.length > 1 && lastWork && !lastWork.done ? '<button class="btn ghost" data-act="delset">− Série</button>' : ''}
        ${!it.sets.some((z) => z.warm) && !doneN ? '<button class="btn ghost" data-act="addwarm">+ Échauffement</button>' : ''}
        <span class="grow"></span>
        ${i < s.items.length - 1 ? '<button class="btn primary next" data-act="nextbtn">Exercice suivant →</button>' : ''}</div>
    </section>`, {
    ...nav,
    nextbtn: () => {
      const done = work.filter((z) => z.done);
      nav.goEx(i + 1);
      if (!done.length) return;
      const vol = done.reduce((a, z) => a + z.w * z.r, 0);
      const top = done.reduce((a, z) => (z.w > a.w || (z.w === a.w && z.r > a.r) ? z : a));
      motivationPop({ name: it.name, bilan: `${done.length} série${done.length > 1 ? 's' : ''}${vol ? ` · ${fmtKg(vol)} kg de volume` : ''} · meilleure : ${fmtKg(top.w)} kg × ${top.r}`, next: s.items[i + 1]?.name });
    },
    setval: (el) => { it.sets[+el.dataset.k][el.dataset.f] = el.value; saveActive(); },
    setnote: (el) => { it.sets[+el.dataset.k].note = el.value.trim(); saveActive(); },
    subedit: (el) => { state.ui.editSub = el.dataset.key; keepScroll(viewSession); app.querySelector('.sub-edit input')?.focus(); },
    subok: () => { const f = app.querySelector('.sub-edit input'); f?.blur(); state.ui.editSub = null; keepScroll(viewSession); },
    feel: (el) => { const st = it.sets[+el.dataset.k]; const v = +el.dataset.v; if (st.feel === v) delete st.feel; else st.feel = v; saveActive(); keepScroll(viewSession); },
    validate: (el) => validateSet(i, +el.dataset.k),
    undo: (el) => { const st = it.sets[+el.dataset.k]; st.done = false; delete st.pr; delete st.at; saveActive(); keepScroll(viewSession); },
    addset: () => { const l = work[work.length - 1]; it.sets.push({ w: l?.w ?? '', r: l?.r ?? '', done: false }); saveActive(); keepScroll(viewSession); },
    delset: () => { it.sets.pop(); saveActive(); keepScroll(viewSession); },
    addwarm: () => { if (addWarmup(it)) { saveActive(); keepScroll(viewSession); } else toast('Saisis d\'abord la charge de la 1re série : l\'échauffement en est calculé.'); },
    delwarm: () => { it.sets = it.sets.filter((z) => !z.warm); saveActive(); keepScroll(viewSession); },
    applysug: () => { for (const z of it.sets) if (!z.done && !z.warm) { z.w = sug.w; z.r = sug.r; } saveActive(); keepScroll(viewSession); toast(`Séries réglées sur ${sugTxt}`); },
    rest: async (el) => {
      it.restSec = readRest(el); saveActive();
      if (ex) { ex.restSec = it.restSec; await db.put('exercises', ex); }
      toast(`Repos de ${fmtClock(it.restSec * 1000)} enregistré pour ${it.name}`);
    },
    swap: () => swapExercise(i),
    zoom: () => modal(`${exVis(ex, 'zoom-img')}<p class="muted small">${esc(ex?.name || '')}</p>${exCue(ex) ? `<p class="cue-neon">${cueHtml(exCue(ex))}</p>` : ''}`, [{ label: 'Fermer', value: true }]),
  });
  startClock(s);
}

/**
 * Superset : les exercices du groupe côte à côte (image, nom), puis une ligne par tour avec poids et reps de chacun.
 * Un seul ✓ valide le tour entier, le repos part après le tour.
 */
function viewSuperset(s, group) {
  const its = group.map((x) => s.items[x]);
  const labs = supersetLabels(s.items);
  const last = its[its.length - 1];
  const rest = last.restSec || s.restSec || state.restSec;
  const works = its.map((it) => it.sets.filter((z) => !z.warm));
  const nR = Math.max(...works.map((w) => w.length));
  const rounds = [];
  if (its.some((it) => it.sets.some((z) => z.warm))) {
    rounds.push({ warm: true, cells: its.map((it, m) => { const k = it.sets.findIndex((z) => z.warm); return k < 0 ? null : [group[m], k]; }) });
  }
  for (let r = 0; r < nR; r++) rounds.push({ warm: false, cells: its.map((it, m) => { const z = works[m][r]; return z ? [group[m], it.sets.indexOf(z)] : null; }) });
  const setOf = ([x, k]) => s.items[x].sets[k];
  const roundDone = (rd) => rd.cells.every((c) => !c || setOf(c).done);
  const doneN = rounds.filter((rd) => !rd.warm && roundDone(rd)).length;
  let wn = 0;
  const rows = rounds.map((rd, r) => {
    const lab = rd.warm ? 'Éch.' : String(++wn);
    const tour = rd.warm ? 'échauffement' : `tour ${wn}`;
    const done = roundDone(rd);
    const cells = rd.cells.map((c, m) => {
      if (!c) return '<div class="ss-cell empty">–</div>';
      const st = setOf(c);
      const nm = esc(its[m].name);
      return `<div class="ss-cell">${st.pr?.length ? '<span class="prtag">🏆</span>' : ''}
        <label><input class="field num" type="text" inputmode="decimal" value="${esc(typeof st.w === 'number' ? fmtKg(st.w) : st.w)}" data-input="ssin" data-x="${c[0]}" data-k="${c[1]}" data-f="w" ${st.done ? 'disabled' : ''} aria-label="Poids ${nm}, ${tour}"><em>kg</em></label>
        <label><input class="field num" type="text" inputmode="numeric" value="${esc(st.r)}" data-input="ssin" data-x="${c[0]}" data-k="${c[1]}" data-f="r" ${st.done ? 'disabled' : ''} aria-label="Répétitions ${nm}, ${tour}"><em>reps</em></label></div>`;
    }).join('');
    const btn = done ? `<button class="btn icon undo" data-act="ssundo" data-r="${r}" aria-label="Annuler le ${tour}">↺</button>`
      : `<button class="btn icon ok" data-act="ssok" data-r="${r}" aria-label="Valider le ${tour}">✓</button>`;
    const first = setOf(rd.cells.find(Boolean));
    const sub = rd.warm
      ? (done ? '' : '<div class="set-sub warm-sub"><span class="small muted">Échauffement léger : hors records et hors volume</span><button class="btn sm ghost" data-act="ssdelwarm">Retirer</button></div>')
      : subLine({ key: `ss${group[0]}-${r}`, done, feel: first.feel, note: first.note, noun: 'Tour', fem: false,
        feelAttrs: `data-act="ssfeel" data-r="${r}"`, noteAttrs: `data-change="ssnote" data-r="${r}" aria-label="Note du ${tour}"`,
        okAttrs: 'data-act="subok"', editAttrs: `data-act="subedit" data-key="ss${group[0]}-${r}"` });
    return `<div class="set-wrap ${rd.warm ? 'warm' : ''}"><div class="set ss-row ${done ? 'done' : ''}" style="--m:${its.length}"><span class="n">${lab}</span>${cells}${btn}</div>${sub}</div>`;
  }).join('');
  const heads = its.map((it, m) => {
    const ex = state.exercises.get(it.exerciseId);
    const lt = lastTime(state.sessions, it.exerciseId, s.id);
    return `<div class="ss-head"><button class="imgbtn" data-act="sszoom" data-m="${m}">${exVis(ex, 'ss-img', 'sm')}</button>
      <div><span class="sstag">${labs[group[m]]}</span> <strong>${esc(it.name)}</strong></div>
      <span class="small muted">${lt ? `Dernière fois : ${fmtKg(lt.top.w)} × ${lt.top.r}` : 'Première fois'}</span>
      <button class="btn sm ghost" data-act="ssswap" data-m="${m}">⇄ Remplacer</button></div>`;
  }).join('');
  const cues = its.map((it) => [it, exCue(state.exercises.get(it.exerciseId))]).filter(([, c]) => c);
  const lastW = works.map((w) => w[w.length - 1]);
  const canDel = nR > 1 && lastW.every((z) => !z || !z.done);
  const after = group[group.length - 1] + 1;
  const nav = navHandlers(s, group);
  const forRound = (el) => rounds[+el.dataset.r].cells.filter(Boolean).map(setOf);
  render(`${sessionTop(s, group).replace('<span class="small muted">superset</span>', `<span class="small muted">${doneN}/${nR} tours</span>`)}
    <section class="card exo ss">
      <p class="ssline"><span class="sstag">Superset</span> enchaîne les ${its.length} exercices sans repos, repos après chaque tour</p>
      <div class="ss-heads" style="--m:${its.length}">${heads}</div>
      <div class="rest-line"><span class="grow rest-lbl"><span aria-hidden="true">⏱</span> Repos après chaque tour</span>${restPicker(rest, 'rest')}</div>
      ${cues.length ? `<details class="cue"><summary><span class="small muted">Consignes</span></summary>${cues.map(([it, c]) => `<p><strong>${esc(it.name)}</strong><br><span class="cue-txt">${cueHtml(c)}</span></p>`).join('')}</details>` : ''}
      <div class="sets">${rows}</div>
      <div class="row gap"><button class="btn" data-act="ssadd">+ Tour</button>
        ${canDel ? '<button class="btn ghost" data-act="ssdel">− Tour</button>' : ''}
        <span class="grow"></span>
        ${after < s.items.length ? '<button class="btn primary next" data-act="nextbtn">Exercice suivant →</button>' : ''}</div>
    </section>`, {
    ...nav,
    nextbtn: () => {
      nav.goEx(after);
      if (!doneN) return;
      motivationPop({ name: its.map((it) => it.name).join(' + '), bilan: `Superset : ${doneN} tour${doneN > 1 ? 's' : ''}`, next: s.items[after]?.name });
    },
    ssin: (el) => { s.items[+el.dataset.x].sets[+el.dataset.k][el.dataset.f] = el.value; saveActive(); },
    ssok: (el) => validateRound(rounds[+el.dataset.r].cells.filter(Boolean)),
    ssundo: (el) => { for (const st of forRound(el)) { st.done = false; delete st.pr; delete st.at; } saveActive(); keepScroll(viewSession); },
    ssnote: (el) => { const v = el.value.trim(); for (const st of forRound(el)) st.note = v; saveActive(); },
    subedit: (el) => { state.ui.editSub = el.dataset.key; keepScroll(viewSession); app.querySelector('.sub-edit input')?.focus(); },
    subok: () => { const f = app.querySelector('.sub-edit input'); f?.blur(); state.ui.editSub = null; keepScroll(viewSession); },
    ssfeel: (el) => { const v = +el.dataset.v; const sets = forRound(el); const on = sets[0].feel !== v; for (const st of sets) { if (on) st.feel = v; else delete st.feel; } saveActive(); keepScroll(viewSession); },
    ssdelwarm: () => { for (const it of its) it.sets = it.sets.filter((z) => z.warm !== true || z.done); saveActive(); keepScroll(viewSession); },
    ssadd: () => { for (const it of its) { const l = it.sets.filter((z) => !z.warm).pop(); it.sets.push({ w: l?.w ?? '', r: l?.r ?? '', done: false }); } saveActive(); keepScroll(viewSession); },
    ssdel: () => { for (const it of its) { const w = it.sets.filter((z) => !z.warm); if (w.length > 1 && !w[w.length - 1].done) it.sets.splice(it.sets.lastIndexOf(w[w.length - 1]), 1); } saveActive(); keepScroll(viewSession); },
    rest: async (el) => {
      last.restSec = readRest(el); saveActive();
      const ex = state.exercises.get(last.exerciseId);
      if (ex) { ex.restSec = last.restSec; await db.put('exercises', ex); }
      toast(`Repos de ${fmtClock(last.restSec * 1000)} après chaque tour`);
    },
    ssswap: (el) => swapExercise(group[+el.dataset.m]),
    sszoom: (el) => { const ex = state.exercises.get(its[+el.dataset.m].exerciseId); modal(`${exVis(ex, 'zoom-img')}<p class="muted small">${esc(ex?.name || '')}</p>${exCue(ex) ? `<p class="cue-neon">${cueHtml(exCue(ex))}</p>` : ''}`, [{ label: 'Fermer', value: true }]); },
  });
  startClock(s);
}

/** Choix d'un exercice dans « Mes exercices » (fenêtre avec recherche). Renvoie l'id ou null. */
function pickExercise(title, exceptId) {
  return new Promise((resolve) => {
    const m = document.getElementById('modal');
    const all = [...state.exercises.values()].filter((e) => e.id !== exceptId).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
    const list = (q) => all.filter((e) => !q || e.name.toLowerCase().includes(q.toLowerCase()))
      .map((e) => `<li data-id="${esc(e.id)}">${esc(e.name)} <span class="muted small">${esc(e.muscles || '')}</span></li>`).join('') || '<li class="muted">Aucun résultat</li>';
    m.innerHTML = `<div class="modal-box"><p><strong>${esc(title)}</strong></p><input class="field" type="search" placeholder="Rechercher" autocomplete="off">
      <ul class="pick-list">${list('')}</ul><div class="modal-actions"><button class="btn" data-x>Annuler</button></div></div>`;
    m.classList.add('show');
    const close = (v) => { m.classList.remove('show'); m.onclick = null; resolve(v); };
    m.querySelector('input').oninput = (e) => { m.querySelector('.pick-list').innerHTML = list(e.target.value); };
    m.onclick = (e) => {
      if (e.target.closest('[data-x]')) { close(null); return; }
      const li = e.target.closest('li[data-id]');
      if (li) close(li.dataset.id);
    };
  });
}

/** Remplace un exercice pour cette séance uniquement (la séance type n'est pas modifiée). */
async function swapExercise(i) {
  const s = state.active;
  const it = s.items[i];
  const id = await pickExercise(`Remplacer ${it.name} (pour cette séance uniquement)`, it.exerciseId);
  if (!id) return;
  const done = it.sets.filter((z) => z.done).length;
  if (done && !(await confirmBox(`${done} série${done > 1 ? 's' : ''} déjà validée${done > 1 ? 's' : ''} sur ${esc(it.name)} ser${done > 1 ? 'ont' : 'a'} retirée${done > 1 ? 's' : ''}. Continuer ?`, 'Remplacer', 'danger'))) return;
  s.items[i] = buildItem(id, it.planned || it.sets.filter((z) => !z.warm).length, !!it.ss);
  await saveActive(true);
  toast(`${exName(id)} remplace ${it.name} pour cette séance`);
  viewSession();
}

function keepScroll(fn) { const y = window.scrollY; fn(); window.scrollTo(0, y); }

/** Contrôle la saisie d'une série (poids vide = 0). Affiche le message d'erreur et renvoie false si invalide. */
function checkSet(st) {
  const w = st.w === '' ? 0 : parseNum(st.w);
  const r = parseNum(st.r);
  if (!Number.isFinite(w) || w < 0) { toast('Poids invalide'); return false; }
  if (!Number.isFinite(r) || r <= 0 || !Number.isInteger(r)) { toast('Nombre de répétitions invalide'); return false; }
  return true;
}

/** Enregistre une série déjà contrôlée : valeurs, record, préremplissage de la série suivante. */
function commitSet(i, k) {
  const s = state.active;
  const it = s.items[i];
  const st = it.sets[k];
  const w = st.w === '' ? 0 : parseNum(st.w);
  const r = parseNum(st.r);
  const prev = bestOf(previousSetsFor(state.sessions, s, it.exerciseId, st));
  st.w = w; st.r = r; st.done = true; st.at = Date.now();
  st.pr = st.warm ? [] : detectPR(prev, st); // l'échauffement ne compte jamais comme record
  const nx = it.sets[k + 1];
  if (!st.warm && nx && !nx.done && nx.w === '' && nx.r === '') { nx.w = w; nx.r = r; }
  return st;
}

async function validateSet(i, k) {
  unlockAudio(); // geste utilisateur : autorise le son de fin de timer sur iOS
  const s = state.active;
  const it = s.items[i];
  if (it.sets[k].done || !checkSet(it.sets[k])) return;
  const st = commitSet(i, k);
  state.ui.justSet = `${i}-${k}`;
  state.ui.lastSet = st.warm ? null : [[i, k]];
  const lastWork = !it.sets.some((z) => !z.done && !z.warm);
  state.ui.restAnim = st.warm ? 'echauf' : lastWork ? 'epuise' : 'repos';
  startRest(it.restSec || s.restSec || state.restSec);
  await saveActive(true);
  if (location.hash === '#/session') keepScroll(viewSession);
  if (!it.sets.some((z) => !z.done) && i < s.items.length - 1) toast(`${it.name} terminé. Suivant : ${s.items[i + 1].name}`, 3500);
  if (st.pr.length) celebrate(it.name, st);
}

/** Valide un tour de superset (une série de chaque exercice), puis lance un seul repos. */
async function validateRound(cells) {
  unlockAudio();
  const s = state.active;
  const todo = cells.filter(([x, k]) => !s.items[x].sets[k].done);
  if (!todo.length) return;
  for (const [x, k] of todo) if (!checkSet(s.items[x].sets[k])) return;
  const prs = [];
  for (const [x, k] of todo) { const st = commitSet(x, k); if (st.pr.length) prs.push([s.items[x].name, st]); }
  const warm = todo.every(([x, k]) => s.items[x].sets[k].warm);
  state.ui.lastSet = warm ? null : todo;
  const group = supersetGroup(s.items, todo[0][0]);
  const its = group.map((x) => s.items[x]);
  const finished = !its.some((it) => it.sets.some((z) => !z.done && !z.warm));
  state.ui.restAnim = warm ? 'echauf' : finished ? 'epuise' : 'repos';
  const last = its[its.length - 1];
  startRest(last.restSec || s.restSec || state.restSec);
  await saveActive(true);
  if (location.hash === '#/session') keepScroll(viewSession);
  const after = group[group.length - 1] + 1;
  if (finished && after < s.items.length) toast(`Superset terminé. Suivant : ${s.items[after].name}`, 3500);
  if (prs.length) celebrate(prs[0][0], prs[0][1]);
}

function celebrate(name, st) {
  beepRecord();
  const labels = { charge: 'charge max', '1rm': '1RM estimé', reps: 'répétitions' };
  mascotPop({ anim: 'record', h: 150, cls: 'rec', confetti: true, ms: 3800, title: `${FLAME} Nouveau record ! ${FLAME}`,
    html: `<p><strong>${esc(name)}</strong></p><p>${fmtKg(st.w)} kg × ${st.r} ${st.w > 0 ? `· 1RM est. ${fmtKg(round1(epley(st.w, st.r)))} kg` : ''}</p>
    <p class="muted small">${st.pr.map((p) => labels[p]).join(' + ')}</p>` });
}

async function finishSession() {
  const s = state.active;
  const n = s.items.reduce((a, it) => a + it.sets.filter((z) => z.done && !z.warm).length, 0);
  if (n === 0) {
    if (!(await confirmBox('Aucune série validée. Abandonner cette séance ? Elle ne sera pas enregistrée.', 'Abandonner', 'danger'))) return;
    await endActive();
    go('#/');
    mascotPop({ anim: 'chute', h: 130, ms: 3000, title: 'Séance abandonnée', html: '<p class="muted">Pas grave. On se relève et on revient plus fort.</p>' });
    return;
  }
  const remaining = s.items.reduce((a, it) => a + it.sets.filter((z) => !z.done && !z.warm).length, 0);
  // Les 2 premiers exercices sont les plus importants : toutes leurs séries de travail faites = séance réussie.
  const core = s.items.slice(0, 2).every((it) => it.sets.filter((z) => !z.warm).every((z) => z.done));
  const msg = remaining ? `Terminer maintenant ? ${n} séries validées, ${remaining} non faites (elles ne seront pas enregistrées).` : `Terminer la séance ? ${n} séries validées.`;
  if (!(await confirmBox(msg, 'Terminer'))) return;
  const done = { ...s, end: Date.now(), timer: null, items: s.items.map((it) => ({ ...it, sets: it.sets.filter((z) => z.done) })).filter((it) => it.sets.some((z) => !z.warm)) };
  await db.put('sessions', done);
  state.sessions.push(done);
  await endActive();
  go(`#/recap/${done.id}`);
  const st = sessionStats(done);
  showFinale({ workoutName: done.workoutName, complete: !remaining, core, stats: [[formatDuration(st.durationMs), 'durée'], [fmtKg(st.volume), 'kg'], [st.setCount, 'séries'], [st.prs.length, 'records']] });
}

async function endActive() {
  timer.stop();
  timerEl.classList.remove('ended');
  state.active = null;
  await db.kvSet('active', null);
  renderTimer();
}

/* ---------- Timer de repos (overlay) ---------- */
const timerEl = document.getElementById('timer');
const timer = new RestTimer({
  onTick: () => renderTimer(),
  onEnd: () => {
    beepEnd();
    if (state.active) { state.active.timer = null; saveActive(); }
    // Reste affiché (quel que soit l'écran) jusqu'à l'appui sur « C'est parti ! » : impossible de rater la fin du repos.
    timerEl.classList.add('ended');
    renderTimer();
  },
});

function startRest(sec) {
  state.ui.timerMin = false;
  timerEl.classList.remove('ended');
  timer.start(sec);
  state.active.timer = { endAt: timer.endAt, total: timer.total };
}

timerEl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-t]');
  const a = b?.dataset.t;
  if (!a) return;
  if (a === 'minus') timer.adjust(-15);
  if (a === 'plus') timer.adjust(15);
  if (a === 'skip') { timer.stop(); timerEl.classList.remove('ended'); }
  if (a === 'go') { timerEl.classList.remove('ended'); state.ui.timerMin = false; if (state.active && location.hash !== '#/session') go('#/session'); }
  if (a === 'feel' && state.active && state.ui.lastSet) {
    const v = +b.dataset.v;
    const sets = state.ui.lastSet.map(([x, k]) => state.active.items[x]?.sets[k]).filter(Boolean);
    const on = sets[0] && sets[0].feel !== v;
    for (const z of sets) { if (on) z.feel = v; else delete z.feel; }
    if (on && v === 4) state.ui.restAnim = 'epuise';
    if (location.hash === '#/session') keepScroll(viewSession);
  }
  if (a === 'min') state.ui.timerMin = true;
  if (a === 'max') state.ui.timerMin = false;
  if (a === 'finish') { state.ui.timerMin = true; if (state.active) finishSession(); }
  if (state.active) { state.active.timer = timer.running ? { endAt: timer.endAt, total: timer.total } : null; saveActive(); }
  renderTimer();
});

const RING_C = 2 * Math.PI * 124;

/** Texte « Ensuite : exercice, série x / n » calculé depuis la séance en cours. */
function nextSetLabel() {
  const s = state.active;
  if (!s || !s.items.length) return '';
  const n = s.items.length;
  const start = Math.min(state.ui.exIndex, n - 1);
  for (let d = 0; d < n; d++) {
    const x = (start + d) % n;
    const it = s.items[x];
    const k = it.sets.findIndex((z) => !z.done);
    if (k < 0) continue;
    const g = supersetGroup(s.items, x);
    if (g.length > 1 && !it.sets[k].warm) {
      const w = it.sets.filter((z) => !z.warm);
      return `Ensuite : superset, tour ${w.indexOf(it.sets[k]) + 1} / ${w.length}`;
    }
    if (it.sets[k].warm) return `Ensuite : ${it.name}, échauffement`;
    const work = it.sets.filter((z) => !z.warm);
    return `Ensuite : ${it.name}, série ${work.indexOf(it.sets[k]) + 1} / ${work.length}`;
  }
  return 'Toutes les séries sont faites';
}

function renderTimer() {
  const ended = timerEl.classList.contains('ended');
  const show = ended || (timer.running && location.hash === '#/session' && !state.ui.timerMin);
  const mini = timer.running && !show;
  timerEl.className = `${show ? 'show' : ''} ${mini ? 'mini' : ''} ${ended ? 'ended' : ''} ${state.timerAdj ? 'adj' : ''}`;
  if (!timerEl.firstChild) {
    timerEl.innerHTML = `<div class="t-full">
      <button class="btn danger sm t-finish" data-t="finish">Fin de séance</button>
      <div class="t-label">Repos</div><div class="t-next"></div><div class="t-spr"></div>
      <div class="t-ring"><svg viewBox="0 0 280 280" aria-hidden="true"><circle class="track" cx="140" cy="140" r="124"/><circle class="prog" cx="140" cy="140" r="124" stroke-dasharray="${RING_C.toFixed(1)}"/></svg><div class="t-digits"></div></div>
      <div class="t-btns t-adj"><button class="btn soft" data-t="minus">−15 s</button><button class="btn soft" data-t="plus">+15 s</button></div>
      <div class="t-btns"><button class="btn cyan" data-t="skip">Passer</button><button class="btn outline" data-t="min">Réduire</button></div>
      <div class="t-feel"></div>
      <button class="btn primary big t-go" data-t="go">C'est parti !</button></div>
      <button class="t-mini" data-t="max"><span>Repos</span> <b class="t-digits"></b></button>`;
  }
  const rem = timer.remainingMs;
  timerEl.querySelectorAll('.t-digits').forEach((d) => { d.textContent = fmtClock(rem); });
  timerEl.querySelector('.t-label').textContent = ended ? 'Repos terminé' : 'Repos';
  const frac = timer.total ? Math.max(0, Math.min(1, rem / (timer.total * 1000))) : 0;
  timerEl.querySelector('.t-ring .prog').style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  timerEl.querySelector('.t-next').textContent = nextSetLabel();
  const anim = ended ? 'finrepos' : state.ui.restAnim || 'repos';
  const sp = timerEl.querySelector('.t-spr');
  const size = ended ? 200 : 96;
  if (show && sp.dataset.a !== anim + size) { sp.dataset.a = anim + size; sp.innerHTML = sprite(anim, size); }
  // Ressenti de la série (ou du tour) qui vient d'être validé, pendant le repos.
  const ls = state.ui.lastSet;
  const cur = show && !ended && ls && state.active ? state.active.items[ls[0][0]]?.sets[ls[0][1]] : null;
  const fh = cur ? `<span class="small muted">Ressenti ${ls.length > 1 ? 'du tour' : 'de la série'}</span>${feelRow(cur.feel, 'data-t="feel"')}` : '';
  const fe = timerEl.querySelector('.t-feel');
  if (fe.dataset.h !== fh) { fe.dataset.h = fh; fe.innerHTML = fh; }
  if (mini && location.hash !== '#/session') timerEl.querySelector('.t-mini').dataset.t = 'goto';
  else timerEl.querySelector('.t-mini').dataset.t = 'max';
}
timerEl.addEventListener('click', (e) => { if (e.target.closest('[data-t="goto"]')) { state.ui.timerMin = false; go('#/session'); } });

/* ---------- Récap ---------- */
function viewRecap(id) {
  const s = state.sessions.find((x) => x.id === id);
  if (!s) { location.replace('#/'); return; }
  const st = sessionStats(s);
  const labels = { charge: 'charge max', '1rm': '1RM estimé', reps: 'reps' };
  render(`<header class="top"><h1>Récap</h1></header>
    <section class="card hero"><div class="sun"></div><div class="body"><div class="eyebrow">${fmtDay(s.start)}</div><h2>${esc(s.workoutName)}</h2>
      <div class="stats">
        <div><b>${formatDuration(st.durationMs)}</b><span>durée</span></div>
        <div><b>${fmtKg(st.volume)}</b><span>kg de volume</span></div>
        <div><b>${st.setCount}</b><span>séries</span></div>
        <div><b>${st.prs.length}</b><span>records</span></div>
      </div></div></section>
    <section class="card"><h3>Sauvegarde</h3>
      <p class="small muted">Tes données ne sont que sur ce téléphone. Un appui ouvre la feuille de partage : choisis « Enregistrer dans Fichiers » (iCloud Drive) ou Mail.</p>
      <button class="btn primary big" data-act="save" id="saveBtn" disabled>Préparation…</button></section>
    ${st.prs.length ? `<h3 class="sec">${FLAME} Records battus</h3><ul class="list card">${st.prs.map((p) => `<li>${FLAME} <strong>${esc(p.name)}</strong> : ${fmtKg(p.w)} kg × ${p.r} <span class="muted small">(${p.pr.map((x) => labels[x]).join(', ')})</span></li>`).join('')}</ul>` : ''}
    <h3 class="sec">Détail</h3><ul class="list card">${s.items.map((it, k) => `<li class="row"><div class="grow"><strong>${esc(it.name)}</strong><div class="muted small">${it.sets.map(fmtSet).join(' · ')}</div>${setNotes(it.sets)}</div><button class="btn icon sm" data-act="delitem" data-k="${k}" aria-label="Retirer cet exercice de la séance">✕</button></li>`).join('')}</ul>
    <p class="muted small">Volume = somme des poids × répétitions des séries validées.</p>
    <button class="btn outline big" data-act="home">Retour à l'entraînement</button>
    <button class="btn ghost danger-text" data-act="del">Supprimer cette séance</button>`, {
    home: () => go('#/'),
    save: async (el) => {
      const res = await doExport();
      if (res && res !== 'cancelled') { el.textContent = 'Sauvegardé ✓'; mascotPop({ anim: 'pouce', h: 120, ms: 2200, title: 'Sauvegarde OK', html: '<p class="muted small">Tes données sont à l\'abri.</p>' }); }
    },
    del: async () => {
      if (!(await confirmBox('Supprimer définitivement cette séance de l\'historique ?', 'Supprimer', 'danger'))) return;
      await db.del('sessions', s.id);
      state.sessions = state.sessions.filter((x) => x.id !== s.id);
      toast('Séance supprimée');
      go('#/progress');
    },
    delitem: async (el) => {
      const it = s.items[+el.dataset.k];
      if (!it) return;
      const last = s.items.length === 1;
      if (!(await confirmBox(last ? `Retirer « ${esc(it.name)} » ? C’est le dernier exercice : la séance entière sera supprimée.` : `Retirer « ${esc(it.name)} » de cette séance ?`, 'Retirer', 'danger'))) return;
      if (last) { await db.del('sessions', s.id); state.sessions = state.sessions.filter((x) => x.id !== s.id); toast('Séance supprimée'); go('#/progress'); return; }
      s.items.splice(+el.dataset.k, 1);
      await db.put('sessions', s);
      toast('Exercice retiré');
      viewRecap(s.id);
    },
  });
  // Fichier préparé à l'avance : sur iOS, le partage doit partir directement du clic.
  buildBackupFile().then((f) => {
    state.backupFile = f;
    const b = document.getElementById('saveBtn');
    if (b) { b.disabled = false; b.textContent = 'Sauvegarder'; }
  });
}

/** Notes de séries (« S2 : … ») sous un exercice, pour le récap et l'historique. */
function setNotes(sets) {
  let n = 0;
  const lines = sets.map((z) => { if (!z.warm) n++; return z.note ? `${z.warm ? 'Éch.' : `S${n}`} : ${esc(z.note)}` : ''; }).filter(Boolean);
  return lines.length ? `<div class="small setnotes">${lines.join('<br>')}</div>` : '';
}

/** Partage (ou télécharge) le fichier de sauvegarde préparé, et note la date du dernier export. */
async function doExport() {
  if (!state.backupFile) return null;
  const res = await shareOrDownload(state.backupFile.file);
  if (res !== 'cancelled') { await db.kvSet('lastExport', Date.now()); toast(res === 'shared' ? 'Sauvegarde partagée' : 'Sauvegarde téléchargée'); }
  return res;
}

/* ---------- Gestion des séances ---------- */
function viewWorkouts() {
  const ws = workoutsSorted();
  render(`<header class="top">${BACK_HOME}</header><h1 class="h1">Ordre des séances</h1>
    <ul class="list card">${ws.map((w, k) => `<li class="row">
      <a class="grow" href="#/workout/${esc(w.id)}"><strong>${esc(w.name)}</strong><div class="muted small">${w.items.map((i) => esc(exName(i.exerciseId))).join(' · ') || 'Vide'}</div></a>
      <button class="btn icon" data-act="up" data-k="${k}" ${k === 0 ? 'disabled' : ''} aria-label="Monter">↑</button>
      <button class="btn icon" data-act="down" data-k="${k}" ${k === ws.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button></li>`).join('')}</ul>
    <p class="muted small">L'ordre sert à proposer la « séance du jour » : après Push vient Pull, etc.</p>
    <button class="btn primary big" data-act="new">+ Nouvelle séance</button>`, {
    up: (el) => swapOrder(ws, +el.dataset.k, -1),
    down: (el) => swapOrder(ws, +el.dataset.k, 1),
    new: newWorkout,
  });
}

async function swapOrder(ws, k, d) {
  const a = ws[k], b = ws[k + d];
  if (!a || !b) return;
  ws.forEach((w, n) => { w.order = n; });
  [a.order, b.order] = [b.order, a.order];
  for (const w of ws) await db.put('workouts', w);
  viewWorkouts();
}

function viewWorkoutEdit(id) {
  const w = state.workouts.find((x) => x.id === id);
  if (!w) { location.replace('#/'); return; }
  const save = () => db.put('workouts', w);
  render(`<header class="top">${BACK_HOME}</header>
    <section class="card"><label class="small muted">Nom de la séance</label><input class="field" type="text" value="${esc(w.name)}" data-change="name"></section>
    <ul class="list card">${w.items.map((it, k) => {
      const ex = state.exercises.get(it.exerciseId);
      return `<li class="row ex-row">${img(ex, 'thumb')}
        <a class="grow" href="#/exercise/${esc(it.exerciseId)}"><strong>${esc(exName(it.exerciseId))}</strong><div class="muted small">${esc(ex?.muscles || '')}</div></a>
        <div class="stepper"><button class="btn icon" data-act="sm" data-k="${k}">−</button><span>${it.sets}<small> séries</small></span><button class="btn icon" data-act="sp" data-k="${k}">+</button></div>
        <div class="col"><button class="btn icon sm" data-act="up" data-k="${k}" ${k === 0 ? 'disabled' : ''} aria-label="Monter">↑</button><button class="btn icon sm" data-act="down" data-k="${k}" ${k === w.items.length - 1 ? 'disabled' : ''} aria-label="Descendre">↓</button></div>
        <button class="btn icon danger-text" data-act="rm" data-k="${k}" aria-label="Retirer">✕</button></li>${k < w.items.length - 1
        ? `<li class="sslink"><button class="btn sm ${it.ss ? 'on' : 'ghost'}" data-act="ss" data-k="${k}">${it.ss ? '⛓ En superset avec le suivant' : 'Lier au suivant (superset)'}</button></li>` : ''}`;
    }).join('') || '<li class="muted">Aucun exercice pour l\'instant.</li>'}</ul>
    <p class="muted small">Superset : les exercices liés s'enchaînent sans repos, le repos vient après le dernier du groupe.</p>
    <button class="btn primary big" data-act="add">+ Ajouter un exercice</button>
    <button class="btn ghost danger-text" data-act="delw">Supprimer cette séance</button>`, {
    name: async (el) => { w.name = el.value.trim() || w.name; await save(); toast('Nom enregistré'); },
    sm: async (el) => { const it = w.items[+el.dataset.k]; it.sets = Math.max(1, it.sets - 1); await save(); keepScroll(() => viewWorkoutEdit(id)); },
    sp: async (el) => { const it = w.items[+el.dataset.k]; it.sets = Math.min(10, it.sets + 1); await save(); keepScroll(() => viewWorkoutEdit(id)); },
    up: async (el) => { const k = +el.dataset.k; [w.items[k - 1], w.items[k]] = [w.items[k], w.items[k - 1]]; await save(); keepScroll(() => viewWorkoutEdit(id)); },
    down: async (el) => { const k = +el.dataset.k; [w.items[k + 1], w.items[k]] = [w.items[k], w.items[k + 1]]; await save(); keepScroll(() => viewWorkoutEdit(id)); },
    rm: async (el) => { w.items.splice(+el.dataset.k, 1); if (w.items.length) w.items[w.items.length - 1].ss = false; await save(); keepScroll(() => viewWorkoutEdit(id)); },
    ss: async (el) => { const it = w.items[+el.dataset.k]; it.ss = !it.ss; await save(); keepScroll(() => viewWorkoutEdit(id)); },
    add: () => go(`#/pick/${w.id}`),
    delw: async () => {
      if (state.active?.workoutId === w.id) { toast('Séance en cours : termine-la d\'abord.'); return; }
      if (!(await confirmBox(`Supprimer la séance « ${esc(w.name)} » ? L'historique des séances déjà faites est conservé.`, 'Supprimer', 'danger'))) return;
      await db.del('workouts', w.id);
      state.workouts = state.workouts.filter((x) => x.id !== w.id);
      go('#/');
    },
  });
}

/* ---------- Choix d'un exercice ---------- */
let catalog = null;
async function loadCatalog() {
  if (!catalog) catalog = await fetch('data/catalog.json').then((r) => r.json());
  return catalog;
}

function viewPick(workoutId, query = '') {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) { location.replace('#/'); return; }
  render(`<header class="top"><a class="back" href="#/workout/${esc(w.id)}">‹ ${esc(w.name)}</a></header>
    <h1 class="h1">Ajouter un exercice</h1>
    <input class="field" type="search" placeholder="Rechercher (ex. squat, curl, press)" value="${esc(query)}" data-input="q" id="q" autocomplete="off">
    <div id="results"></div>
    <button class="btn big" data-act="custom">+ Créer un exercice perso</button>`, {
    q: (el) => fillResults(el.value),
    mine: (el) => addToWorkout(w, el.dataset.id),
    cat: (el) => addFromCatalog(w, el.dataset.id, el),
    custom: async () => {
      const p = modal(`<p><strong>Nouvel exercice</strong></p>
        <input class="field" type="text" placeholder="Nom de l'exercice" value="${esc(document.getElementById('q').value)}">
        <label class="btn big file">Choisir une image (facultatif)<input type="file" accept="image/*" id="newImg" hidden></label>
        <p class="muted small" id="newImgName">Photo perso ou image dont tu as les droits.</p>`,
      [{ label: 'Annuler', value: null }, { label: 'Créer', value: 'input', cls: 'primary' }]);
      const fi = document.getElementById('newImg');
      fi.onchange = () => { document.getElementById('newImgName').textContent = fi.files[0] ? `Image : ${fi.files[0].name}` : ''; };
      const name = (await p)?.trim();
      if (!name) return;
      const same = [...state.exercises.values()].find((e) => e.name.trim().toLowerCase() === name.toLowerCase());
      if (same && !(await confirmBox(`Un exercice « ${esc(same.name)} » existe déjà. En créer un deuxième quand même ?`, 'Créer'))) return;
      let image = '';
      if (fi.files[0]) { try { image = await resizeImage(fi.files[0]); } catch { toast('Image illisible : exercice créé sans image'); } }
      const ex = { id: 'custom_' + uid(), name, muscles: '', image, source: 'custom' };
      await db.put('exercises', ex); state.exercises.set(ex.id, ex);
      await addToWorkout(w, ex.id);
    },
  });
  fillResults(query);
}

async function fillResults(q) {
  const box = document.getElementById('results');
  if (!box) return;
  const n = q.trim().toLowerCase();
  const mine = [...state.exercises.values()].filter((e) => !n || e.name.toLowerCase().includes(n) || e.id.toLowerCase().replace(/_/g, ' ').includes(n)).sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  let html = `<h3 class="sec">Mes exercices</h3><ul class="list card">${mine.map((e) => `<li class="row ex-row" data-act="mine" data-id="${esc(e.id)}">${img(e, 'thumb')}<div class="grow"><strong>${esc(e.name)}</strong><div class="muted small">${esc(e.muscles || '')}</div></div><span class="plus">＋</span></li>`).join('') || '<li class="muted">Aucun résultat</li>'}</ul>`;
  if (n.length >= 2) {
    const cat = await loadCatalog();
    const res = cat.filter(([id, name]) => !state.exercises.has(id) && name.toLowerCase().includes(n)).slice(0, 40);
    html += `<h3 class="sec">Catalogue free-exercise-db <span class="muted small">(noms en anglais, image téléchargée à l'ajout)</span></h3>
      <ul class="list card">${res.map(([id, name, mus, eq]) => `<li class="row" data-act="cat" data-id="${esc(id)}"><div class="grow"><strong>${esc(name)}</strong><div class="muted small">${esc(mus)}${eq ? ' · ' + esc(eq) : ''}</div></div><span class="plus">＋</span></li>`).join('') || '<li class="muted">Aucun résultat</li>'}</ul>`;
  } else {
    html += '<p class="muted small">Tape au moins 2 lettres pour chercher aussi dans le catalogue complet (873 exercices).</p>';
  }
  if (document.getElementById('results') === box) box.innerHTML = html;
}

async function addToWorkout(w, exId, back = true) {
  w.items.push({ exerciseId: exId, sets: 3 });
  await db.put('workouts', w);
  if (back) { toast(`${exName(exId)} ajouté`); go(`#/workout/${w.id}`); }
}

async function addFromCatalog(w, id, el) {
  const row = (await loadCatalog()).find((x) => x[0] === id);
  if (!row) return;
  el.classList.add('loading');
  let image = CATALOG_IMG_BASE + id + '/0.jpg';
  try {
    const blob = await fetch(image).then((r) => { if (!r.ok) throw new Error(r.status); return r.blob(); });
    image = await resizeImage(blob);
  } catch {
    toast('Image non téléchargée (hors ligne ?). Elle sera chargée depuis Internet.');
  }
  // Consigne d'origine (en anglais, à reformuler) : fichier JSON de l'exercice dans free-exercise-db.
  let cue;
  try {
    const j = await fetch(CATALOG_IMG_BASE + id + '.json').then((r) => { if (!r.ok) throw new Error(r.status); return r.json(); });
    if (Array.isArray(j.instructions) && j.instructions.length) cue = `(EN, à reformuler)\n${j.instructions.join('\n')}`;
  } catch { /* hors ligne : pas de consigne, elle reste modifiable dans la fiche */ }
  const ex = { id, name: row[1], muscles: row[2], image, source: 'free-exercise-db', ...(cue ? { cue } : {}) };
  await db.put('exercises', ex); state.exercises.set(id, ex);
  await addToWorkout(w, id);
}

/** Redimensionne une image (max 640 px) et la renvoie en data URL JPEG, pour la stocker dans IndexedDB. */
async function resizeImage(blob, max = 640) {
  const url = URL.createObjectURL(blob);
  try {
    const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = url; });
    const k = Math.min(1, max / Math.max(im.naturalWidth, im.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(im.naturalWidth * k); c.height = Math.round(im.naturalHeight * k);
    c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.82);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- Fiche exercice (nom, image) ---------- */
function viewExercise(id) {
  const ex = state.exercises.get(id);
  if (!ex) { location.replace('#/'); return; }
  const def = DEFAULT_EXERCISES.find((d) => d.id === id);
  render(`<header class="top"><a class="back" href="#/" data-act="back">‹ Retour</a></header>
    <section class="card exo">${exVis(ex, 'exo-img')}
      <label class="btn big file">Remplacer l'image<input type="file" accept="image/*" data-change="file" hidden></label>
      ${def && ex.image !== def.image ? '<button class="btn ghost" data-act="restore">Remettre l\'image d\'origine</button>' : ''}
      <p class="muted small">Utilise une image dont tu as les droits (photo perso, capture de tes contenus).</p></section>
    <section class="card"><label class="small muted">Nom</label><input class="field" type="text" value="${esc(ex.name)}" data-change="name">
      <label class="small muted">Muscles</label><input class="field" type="text" value="${esc(ex.muscles || '')}" data-change="muscles"></section>
    <section class="card"><label class="small muted">Consigne (affichée pendant la séance, une idée par ligne)</label>
      <textarea class="field" rows="5" placeholder="Placement, tempo, réglage machine…" data-change="cue">${esc(exCue(ex))}</textarea>
      ${DEFAULT_CUES[id] && ex.cue !== undefined && ex.cue !== DEFAULT_CUES[id] ? '<button class="btn ghost sm" data-act="cuereset">Remettre la consigne d\'origine</button>' : ''}
      <div class="rest-line"><span class="grow rest-lbl"><span aria-hidden="true">⏱</span> Repos pour cet exercice</span>${restPicker(ex.restSec || state.restSec, 'rest')}</div></section>
    ${ex.source === 'free-exercise-db' ? '<p class="muted small">Image d\'origine : free-exercise-db (domaine public, licence Unlicense).</p>' : ''}
    <button class="btn ghost danger-text" data-act="delex">Supprimer cet exercice</button>`, {
    back: () => (history.length > 1 ? history.back() : go('#/')),
    delex: () => deleteExercise(ex),
    file: async (el) => {
      const f = el.files[0];
      if (!f) return;
      try { ex.image = await resizeImage(f); await saveEx(ex); toast('Image remplacée'); viewExercise(id); } catch { toast('Image illisible'); }
    },
    restore: async () => { ex.image = def.image; await saveEx(ex); viewExercise(id); },
    name: async (el) => { ex.name = el.value.trim() || ex.name; await saveEx(ex); toast('Nom enregistré'); },
    muscles: async (el) => { ex.muscles = el.value.trim(); await saveEx(ex); },
    cue: async (el) => { ex.cue = el.value.trim(); await saveEx(ex); toast('Consigne enregistrée'); keepScroll(() => viewExercise(id)); },
    cuereset: async () => { delete ex.cue; await saveEx(ex); toast('Consigne d\'origine remise'); keepScroll(() => viewExercise(id)); },
    rest: async (el) => { ex.restSec = readRest(el); await saveEx(ex); toast(`Repos de ${fmtClock(ex.restSec * 1000)} enregistré`); },
  });
}
/** Supprime un exercice : retiré des séances types ; historique conservé ou supprimé au choix. */
async function deleteExercise(ex) {
  if (state.active?.items.some((it) => it.exerciseId === ex.id)) { toast('Exercice utilisé dans la séance en cours : termine-la d\'abord'); return; }
  const inW = state.workouts.filter((w) => w.items.some((i) => i.exerciseId === ex.id));
  const nH = state.sessions.filter((x) => x.end && x.items.some((it) => it.exerciseId === ex.id)).length;
  const btns = [{ label: 'Annuler', value: false }, { label: nH ? 'Supprimer, garder l\'historique' : 'Supprimer', value: 'ex', cls: 'danger' }];
  if (nH) btns.push({ label: 'Supprimer avec l\'historique', value: 'all', cls: 'danger' });
  const r = await modal(`<p>Supprimer « ${esc(ex.name)} » ?</p><p class="muted small">${inW.length ? `Retiré de ${inW.length} séance${inW.length > 1 ? 's' : ''} type : ${inW.map((w) => esc(w.name)).join(', ')}.` : 'Utilisé dans aucune séance type.'}${nH ? `<br>Historique : ${nH} séance${nH > 1 ? 's' : ''}.` : ''}</p>`, btns);
  if (!r) return;
  for (const w of inW) { w.items = w.items.filter((i) => i.exerciseId !== ex.id); await db.put('workouts', w); }
  if (r === 'all') await purgeHistory(ex.id);
  await db.del('exercises', ex.id);
  state.exercises.delete(ex.id);
  toast('Exercice supprimé');
  go('#/');
}

/** Retire un exercice de toutes les séances terminées ; une séance devenue vide est supprimée. */
async function purgeHistory(id) {
  for (const x of state.sessions.filter((z) => z.end && z.items.some((it) => it.exerciseId === id))) {
    x.items = x.items.filter((it) => it.exerciseId !== id);
    if (x.items.length) await db.put('sessions', x);
    else { await db.del('sessions', x.id); state.sessions = state.sessions.filter((z) => z.id !== x.id); }
  }
}

async function saveEx(ex) {
  await db.put('exercises', ex);
  if (state.active) for (const it of state.active.items) if (it.exerciseId === ex.id) { it.name = ex.name; if (ex.restSec) it.restSec = ex.restSec; saveActive(); }
}

/* ---------- Progrès ---------- */
/** Calendrier du mois (lundi en premier) : jours entraînés en rose, aujourd'hui entouré. */
function calendarHtml() {
  const days = trainedDays(state.sessions);
  const now = new Date();
  const m = new Date(now.getFullYear(), now.getMonth() + state.ui.calOffset, 1);
  const y = m.getFullYear(), mo = m.getMonth();
  const nDays = new Date(y, mo + 1, 0).getDate();
  const lead = (m.getDay() + 6) % 7;
  const key = (d) => `${y}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  let cells = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((d) => `<span class="dow">${d}</span>`).join('') + '<span></span>'.repeat(lead);
  let nOn = 0;
  for (let d = 1; d <= nDays; d++) {
    const on = days.has(key(d));
    if (on) nOn++;
    cells += `<span class="d ${on ? 'on' : ''} ${key(d) === today ? 'today' : ''}">${d}</span>`;
  }
  const nSess = state.sessions.filter((s) => { if (!s.end) return false; const d = new Date(s.start); return d.getFullYear() === y && d.getMonth() === mo; }).length;
  const title = m.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return `<section class="card"><div class="cal-head"><button class="btn icon sm" data-act="calprev" aria-label="Mois précédent">‹</button>
      <strong>${title}</strong><button class="btn icon sm" data-act="calnext" aria-label="Mois suivant" ${state.ui.calOffset >= 0 ? 'disabled' : ''}>›</button></div>
    <div class="cal">${cells}</div>
    <p class="muted small cal-foot">${nSess} séance${nSess > 1 ? 's' : ''} ce mois-ci · ${nOn} jour${nOn > 1 ? 's' : ''} d'entraînement</p></section>`;
}

/** Courbe de volume par type de séance et écart avec la séance précédente du même type. */
function sessionTypesHtml(done) {
  const groups = new Map();
  for (const s of [...done].sort((a, z) => a.start - z.start)) {
    const k = s.workoutId || s.workoutName;
    if (!groups.has(k)) groups.set(k, { name: s.workoutName, pts: [] });
    groups.get(k).name = s.workoutName;
    groups.get(k).pts.push({ x: s.start, y: sessionStats(s).volume });
  }
  return [...groups.values()].sort((a, z) => z.pts.at(-1).x - a.pts.at(-1).x).map((g) => {
    const n = g.pts.length, last = g.pts[n - 1].y, prev = n > 1 ? g.pts[n - 2].y : null;
    let badge = `<span class="delta muted small">${n > 1 ? 'pas de volume avant' : '1re séance'}</span>`;
    if (prev > 0) {
      const pc = Math.round(((last - prev) / prev) * 1000) / 10;
      const cls = pc > 0 ? 'up' : pc < 0 ? 'down' : '';
      badge = `<span class="delta ${cls}">${pc > 0 ? '+' : pc < 0 ? '−' : ''}${String(Math.abs(pc)).replace('.', ',')} %</span>`;
    }
    return `<section class="card"><div class="row"><h3 class="grow">${esc(g.name)}</h3>${badge}</div>
      <p class="muted small">Dernière séance : ${fmtKg(last)} kg${n > 1 ? ` (précédente : ${fmtKg(prev)} kg)` : ''} · ${n} séance${n > 1 ? 's' : ''}</p>
      ${lineChart(g.pts)}</section>`;
  }).join('');
}

function viewProgress() {
  const tab = state.ui.ptab;
  const done = state.sessions.filter((s) => s.end);
  const tabs = [['seances', 'Séances'], ['exercices', 'Exercices'], ['corps', 'Corps']]
    .map(([k, l]) => `<button class="seg-btn ${tab === k ? 'on' : ''}" data-act="ptab" data-k="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('');
  let body = '';
  if (tab === 'seances') {
    const hist = [...done].sort((a, z) => z.start - a.start);
    body = `${calendarHtml()}
      ${done.length ? `<h3 class="sec">Évolution par type de séance</h3>${sessionTypesHtml(done)}
      <p class="muted small">Pourcentage : volume (poids × reps) de la dernière séance comparé à la précédente du même type.</p>
      <h3 class="sec">Historique</h3><ul class="list card">${hist.map((s) => { const st = sessionStats(s); return `<li class="row"><a class="grow row" href="#/recap/${esc(s.id)}"><div class="grow"><strong>${esc(s.workoutName)}</strong><div class="muted small">${fmtDay(s.start)} · ${fmtKg(st.volume)} kg · ${st.setCount} séries</div></div><span class="plus">›</span></a></li>`; }).join('')}</ul>
      <p class="muted small">Ouvre une séance pour la supprimer ou retirer un exercice.</p>`
      : `<section class="card empty">${sprite('hausse', 72)}<p class="muted">Termine une première séance pour voir ton évolution.</p></section>`}`;
  } else if (tab === 'exercices') {
    const counts = new Map();
    for (const s of state.sessions) for (const it of s.items) counts.set(it.exerciseId, (counts.get(it.exerciseId) || 0) + 1);
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    body = list.length ? `<ul class="list card">${list.map(([id, n]) => {
      const b = bestOf(previousSetsFor(state.sessions, null, id));
      return `<li class="row ex-row"><a class="grow row" href="#/progress/${esc(id)}">${img(state.exercises.get(id), 'thumb')}<div class="grow"><strong>${esc(exName(id))}</strong><div class="muted small">${n} séance${n > 1 ? 's' : ''} · max ${fmtKg(b.maxW)} kg · 1RM est. ${fmtKg(round1(b.maxE1rm))} kg</div></div><span class="plus">›</span></a></li>`;
    }).join('')}</ul>` : `<section class="card empty">${sprite('hausse', 72)}<p class="muted">Termine une première séance pour voir tes courbes.</p></section>`;
  } else {
    const rows = [...state.body].sort((a, z) => a.t - z.t);
    const w = rows.filter((r) => r.w > 0).map((r) => ({ x: r.t, y: r.w }));
    const bf = rows.filter((r) => r.bf > 0).map((r) => ({ x: r.t, y: r.bf }));
    body = `<section class="card"><h3>Nouvelle mesure</h3>
        <div class="body-form">
          <label><span class="muted small">Poids (kg)</span><input id="bw" type="text" inputmode="decimal" placeholder="ex. 78,5"></label>
          <label><span class="muted small">Masse grasse (%)</span><input id="bbf" type="text" inputmode="decimal" placeholder="facultatif"></label>
        </div>
        <button class="btn primary big" data-act="bodyadd">Ajouter</button></section>
      <section class="card"><h3>Poids (kg)</h3>${lineChart(w)}</section>
      <section class="card"><h3>Masse grasse (%)</h3>${lineChart(bf, { unit: '%' })}</section>
      ${rows.length ? `<h3 class="sec">Mesures</h3><ul class="list card">${[...rows].reverse().map((r) => `<li class="row"><div class="grow"><strong>${fmtDay(r.t)}</strong><div class="muted small">${[r.w > 0 && `${fmtKg(r.w)} kg`, r.bf > 0 && `${fmtKg(r.bf)} % de masse grasse`].filter(Boolean).join(' · ')}</div></div><button class="btn icon sm" data-act="bodydel" data-t="${r.t}" aria-label="Supprimer cette mesure">✕</button></li>`).join('')}</ul>` : ''}`;
  }
  render(`<header class="top"><h1>Progrès</h1></header>
    <div class="seg" role="tablist">${tabs}</div>
    ${body}`, {
    ptab: (el) => { state.ui.ptab = el.dataset.k; viewProgress(); },
    calprev: () => { state.ui.calOffset--; viewProgress(); },
    calnext: () => { state.ui.calOffset = Math.min(0, state.ui.calOffset + 1); viewProgress(); },
    bodyadd: async () => {
      const num = (id) => parseFloat(String(document.getElementById(id).value).replace(',', '.'));
      const wv = num('bw'), bv = num('bbf');
      if (!(wv > 0) && !(bv > 0)) { toast('Saisis au moins le poids ou la masse grasse.'); return; }
      if (bv >= 70) { toast('Masse grasse : un pourcentage entre 0 et 70.'); return; }
      state.body = [...state.body, { t: Date.now(), w: wv > 0 ? round1(wv) : null, bf: bv > 0 ? round1(bv) : null }];
      await db.kvSet('body', state.body);
      toast('Mesure ajoutée');
      viewProgress();
    },
    bodydel: async (el) => {
      if (!(await confirmBox('Supprimer cette mesure ?', 'Supprimer', 'danger'))) return;
      state.body = state.body.filter((r) => r.t !== +el.dataset.t);
      await db.kvSet('body', state.body);
      viewProgress();
    },
  });
}

function viewProgressExercise(id) {
  const series = exerciseSeries(state.sessions, id);
  const b = bestOf(previousSetsFor(state.sessions, null, id));
  const pts = (k) => series.map((p) => ({ x: p.date, y: p[k] }));
  const hist = state.sessions.filter((s) => s.end && s.items.some((it) => it.exerciseId === id)).sort((a, z) => z.start - a.start);
  render(`<header class="top"><a class="back" href="#/progress">‹ Progrès</a></header>
    <h1 class="h1">${esc(exName(id))}</h1>
    <section class="card stats"><div><b>${fmtKg(b.maxW)}</b><span>kg max</span></div><div><b>${fmtKg(round1(b.maxE1rm))}</b><span>kg 1RM estimé</span></div><div><b>${series.length}</b><span>séances</span></div></section>
    <section class="card"><h3>Charge max par séance (kg)</h3>${lineChart(pts('maxW'))}</section>
    <section class="card"><h3>1RM estimé (kg)</h3>${lineChart(pts('e1rm'))}
      <p class="muted small">Formule d'Epley : 1RM ≈ poids × (1 + reps / 30), meilleure série de chaque séance. C'est une estimation, fiable surtout entre 2 et 10 reps.</p></section>
    <section class="card"><h3>Volume par séance (kg)</h3>${lineChart(pts('volume'))}<p class="muted small">Volume = somme des poids × répétitions.</p></section>
    <h3 class="sec">Historique</h3><ul class="list card">${hist.map((s) => `<li><strong>${fmtDay(s.start)}</strong> <span class="muted small">${esc(s.workoutName)}</span>${s.items.filter((it) => it.exerciseId === id).map((it) => `<div class="small">${it.sets.map((z) => `${fmtSet(z)}${z.pr?.length ? ' 🏆' : ''}`).join(' · ')}</div>${setNotes(it.sets)}`).join('')}</li>`).join('')}</ul>
    ${hist.length ? '<button class="btn ghost danger-text" data-act="purge">Supprimer l\'historique de cet exercice</button>' : ''}`, {
    purge: async () => {
      if (!(await confirmBox(`Supprimer tout l'historique de « ${esc(exName(id))} » (${hist.length} séance${hist.length > 1 ? 's' : ''}) ?<br>Les autres exercices de ces séances sont conservés. Une séance qui ne contenait que cet exercice est supprimée.`, 'Supprimer', 'danger'))) return;
      await purgeHistory(id);
      toast('Historique supprimé');
      go('#/progress');
    },
  });
}

/* ---------- Réglages et sauvegarde ---------- */
const bugsHtml = (list) => list.map((b) => `<li class="row"><div class="grow"><div class="muted small">${new Date(b.t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}</div><div class="small">${esc(b.text).replace(/\n/g, '<br>')}</div></div><button class="btn icon sm" data-act="bugdel" data-t="${b.t}" aria-label="Retirer ce bug">✕</button></li>`).join('') || '<li class="muted small">Aucun bug noté.</li>';
async function viewSettings() {
  const wm = state.warm;
  const pctOpts = [40, 50, 60, 70, 80].map((v) => `<option value="${v}" ${v === wm.pct ? 'selected' : ''}>${v} %</option>`).join('');
  const repOpts = Array.from({ length: 16 }, (_, k) => k + 5).map((v) => `<option value="${v}" ${v === wm.reps ? 'selected' : ''}>${v}</option>`).join('');
  const [lastExport, bugs] = await Promise.all([db.kvGet('lastExport'), db.kvGet('bugs')]);
  let bugList = Array.isArray(bugs) ? bugs : [];
  if (location.hash !== '#/settings') return; // l'utilisateur a changé d'écran entre-temps
  render(`<header class="top">${BACK_HOME}</header><h1 class="h1">Réglages</h1>
    <section class="card row"><span class="grow">Repos par défaut</span>${restPicker(state.restSec, 'rest')}</section>
    <h3 class="sec">Échauffement</h3>
    <section class="card">
      <label class="row"><span class="grow">Ajouter une série d'échauffement</span><input type="checkbox" class="switch" data-change="warmon" ${wm.on ? 'checked' : ''}></label>
      <div class="row"><span class="grow small">Charge (part de la 1re série)</span><select class="field" data-change="warmpct">${pctOpts}</select></div>
      <div class="row"><span class="grow small">Répétitions</span><select class="field" data-change="warmreps">${repOpts}</select></div>
      <p class="muted small">Ajoutée en tête de chaque exercice dont la charge est connue, arrondie à 2,5 kg en dessous. Elle ne compte ni dans le volume ni dans les records.</p>
    </section>
    <h3 class="sec">Minuteur</h3>
    <section class="card">
      <label class="row"><span class="grow">Boutons −15 s / +15 s</span><input type="checkbox" class="switch" data-change="timeradj" ${state.timerAdj ? 'checked' : ''}></label>
      <p class="muted small">Masqués : le minuteur n'affiche que « Passer », « Réduire » et le ressenti.</p>
    </section>
    <h3 class="sec">Mascotte</h3>
    <section class="card">
      <label class="row"><span class="grow">Écran d'ouverture</span><input type="checkbox" class="switch" data-change="splash" ${state.splash ? 'checked' : ''}></label>
      <p class="muted small">Affiché à chaque lancement de l'appli. Les animations de record, de motivation et de fin de séance restent actives.</p>
    </section>
    <h3 class="sec">Carnet de bugs</h3>
    <section class="card">
      <textarea class="field" id="bugTxt" rows="3" placeholder="Ce qui ne marche pas, sur quel écran, ce que tu faisais…"></textarea>
      <button class="btn primary big" data-act="bugadd">Ajouter au carnet</button>
      <ul class="list bugs" id="bugList">${bugsHtml(bugList)}</ul>
      <button class="btn ghost" data-act="bugcopy" id="bugCopy" ${bugList.length ? '' : 'hidden'}>Copier la liste</button>
      <p class="muted small">Gardé sur ce téléphone et inclus dans l'export.</p>
    </section>
    <h3 class="sec">Sauvegarde</h3>
    <section class="card">
      <p class="small">Tes données restent uniquement sur ce téléphone. Exporte régulièrement un fichier (Mail, Fichiers / iCloud Drive) pour pouvoir les restaurer.</p>
      <p class="muted small">Dernier export : ${lastExport ? new Date(lastExport).toLocaleString('fr-FR') : 'jamais'}</p>
      <button class="btn primary big" data-act="export" id="exportBtn" disabled>Préparation…</button>
      <label class="btn big file">Importer une sauvegarde<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <p class="muted small" id="persist"></p>
    </section>
    <h3 class="sec">À propos</h3>
    <section class="card small"><p>AppMuscu v${APP_VERSION} · usage personnel.</p>
      <p class="muted">Images d'exercices : <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (domaine public, Unlicense).</p>
      <p class="muted">Maintien de l'écran : ${!wakeLockSupported() ? 'non pris en charge par ce navigateur' : screenLocked() ? 'actif' : `inactif${lastWakeError() ? ` (${esc(lastWakeError())})` : ''}`}.</p></section>`, {
    rest: async (el) => { state.restSec = readRest(el); await db.kvSet('restSec', state.restSec); toast('Repos par défaut enregistré'); },
    warmon: async (el) => { state.warm.on = el.checked; await db.kvSet('warm', state.warm); toast(el.checked ? 'Échauffement activé' : 'Échauffement désactivé'); },
    warmpct: async (el) => { state.warm.pct = +el.value; await db.kvSet('warm', state.warm); toast('Charge d\'échauffement enregistrée'); },
    warmreps: async (el) => { state.warm.reps = +el.value; await db.kvSet('warm', state.warm); toast('Répétitions d\'échauffement enregistrées'); },
    timeradj: async (el) => { state.timerAdj = el.checked; await db.kvSet('timerAdj', state.timerAdj); },
    splash: async (el) => { state.splash = el.checked; await db.kvSet('splash', state.splash); toast(el.checked ? 'Écran d\'ouverture activé' : 'Écran d\'ouverture désactivé'); },
    bugadd: async () => {
      const ta = document.getElementById('bugTxt');
      const text = ta.value.trim();
      if (!text) { ta.focus(); return; }
      bugList = [{ t: Date.now(), text }, ...bugList];
      await db.kvSet('bugs', bugList);
      ta.value = '';
      refreshBugs();
      toast('Bug noté');
    },
    bugdel: async (el) => {
      if (!(await confirmBox('Retirer ce bug du carnet ?', 'Retirer', 'danger'))) return;
      bugList = bugList.filter((b) => b.t !== +el.dataset.t);
      await db.kvSet('bugs', bugList);
      refreshBugs();
    },
    bugcopy: async () => {
      const txt = bugList.map((b) => `- ${new Date(b.t).toLocaleString('fr-FR')} : ${b.text}`).join('\n');
      try { await navigator.clipboard.writeText(`Bugs AppMuscu v${APP_VERSION}\n${txt}`); toast('Liste copiée'); } catch { toast('Copie impossible sur ce navigateur'); }
    },
    export: doExport,
    import: async (el) => {
      const f = el.files[0];
      el.value = '';
      if (!f) return;
      try {
        const data = await readBackup(f);
        const ok = await confirmBox(`Restaurer cette sauvegarde du ${new Date(data.exportedAt).toLocaleString('fr-FR')} ?<br>${data.sessions.length} séances, ${data.workouts.length} séances types, ${data.exercises.length} exercices.<br><strong>Les données actuelles de ce téléphone seront remplacées.</strong>`, 'Restaurer', 'danger');
        if (!ok) return;
        timer.stop();
        await restoreBackup(data);
        await reload();
        toast('Sauvegarde restaurée');
        go('#/');
      } catch (e) { modal(`<p>${esc(e.message)}</p>`, [{ label: 'OK', value: true }]); }
    },
  });
  function refreshBugs() {
    const ul = document.getElementById('bugList'); if (ul) ul.innerHTML = bugsHtml(bugList);
    const c = document.getElementById('bugCopy'); if (c) c.hidden = !bugList.length;
  }
  // Prépare le fichier à l'avance : sur iOS, le partage doit partir directement du clic.
  state.backupFile = await buildBackupFile();
  const btn = document.getElementById('exportBtn');
  if (btn) { btn.disabled = false; const n = state.backupFile.counts.sessions; btn.textContent = `Exporter (${n} séance${n > 1 ? 's' : ''})`; }
  const p = document.getElementById('persist');
  if (p && navigator.storage?.persisted) {
    const persisted = await navigator.storage.persisted();
    p.textContent = persisted ? 'Stockage persistant accordé par le navigateur.' : 'Stockage persistant non accordé : l\'export régulier est d\'autant plus important.';
  }
}

/* ---------- Service worker ---------- */
function registerSW() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').then((reg) => {
    reg.addEventListener('updatefound', () => {
      const nw = reg.installing;
      nw?.addEventListener('statechange', () => {
        if (nw.state === 'installed' && navigator.serviceWorker.controller) toast('Nouvelle version installée : ferme et rouvre l\'appli pour l\'utiliser.', 6000);
      });
    });
  }).catch((e) => console.warn('Service worker non enregistré', e));
}

boot().catch((e) => { app.innerHTML = `<p class="card">Erreur au démarrage : ${esc(e.message)}</p>`; console.error(e); });
