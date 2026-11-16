// AppMuscu : routeur et écrans.
import * as db from './db.js';
import { artKey, artSrc, decorOf, fitOf, glowLayer, muscleMap } from './exart.js';
import { planHipThrust, missingDefaults, HT_FLAG, HT_BACKUP, translateCues, purgeFixedBugs, planPairs, PAIR_FLAG, planMuscles, MUSCLES_FLAG } from './migrate.js';
import { DEFAULT_EXERCISES, DEFAULT_WORKOUTS, DEFAULT_REST_SEC, NEW_DEFAULTS_V23 } from './defaults.js';
import { epley, countSets, bestOf, detectPR, previousSetsFor, lastTime, sessionStats, exerciseSeries, nextWorkout, parseNum, formatDuration, fmtKg, round1, suggestNext, trainedDays, warmupWeight, supersetGroup, supersetLabels, removeItemAt, moveItem, weekStreak, weekStart, setPairIds, isPair, loadFactor } from './stats.js';
import { sprite, mascotPop, motivationPop, showSplash, showFinale, sessionKind, FLAME } from './mascot.js';
import { DEFAULT_CUES } from './cues.js';
import { RestTimer, unlockAudio, beepEnd, beepRecord, beepExercise, beepFinish, REST_SOUNDS, setSoundPrefs, previewRest, keepScreenOn, wakeLockSupported, screenLocked, lastWakeError, fmtClock } from './timer.js';
import { buildBackupFile, shareOrDownload, readBackup, restoreBackup } from './backup.js';
import * as sync from './sync.js';
import { lineChart } from './charts.js';
import { quoteOfDay, weekProgress, MOODS, moodLabel, suggestForMood, balancePct, nextBalanceTier, featured, sparkPoints, restTip, weightEquivalent, fmtT, GROUPS, muscleWeek, levelOf, achievements, achievementTotals, newlyUnlocked, prDetail } from './v23.js';

export const APP_VERSION = '2.3.1';

/* ---------- État en mémoire ---------- */
const state = {
  exercises: new Map(),
  workouts: [],
  sessions: [],
  restSec: DEFAULT_REST_SEC,
  warm: { on: true, pct: 60, reps: 15 }, // série d'échauffement automatique
  active: null, // séance en cours
  ui: { exIndex: 0, timerMin: false, justSet: null, calOffset: 0, ptab: 'courbes', editSub: null, mwOffset: 0, feat: 0 },
  backupFile: null,
};

const app = document.getElementById('app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmtDay = (t) => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
const PLACEHOLDER = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3"><rect width="4" height="3" fill="#2a2f3a"/><text x="2" y="1.9" font-size="1" text-anchor="middle" fill="#8a93a6">🏋️</text></svg>');
/**
 * Image choisie par l'utilisateur (photo perso). Les images free-exercise-db (img/ex/, lien GitHub,
 * ou copie téléchargée depuis le catalogue) ne sont plus affichées depuis la v2.3, mais restent en base.
 */
const userImage = (ex) => {
  const im = ex?.image;
  if (!im) return false;
  if (ex.imgUser) return true;
  if (im.startsWith('img/ex/') || /^https?:/.test(im)) return false;
  if (ex.source === 'free-exercise-db') return DEFAULT_EXERCISES.some((d) => d.id === ex.id); // remplacée avant la v2.3
  return true; // exercice perso : image ajoutée à la création
};
/** Clé du personnage animé, sauf si l'utilisateur a mis sa propre image. */
const hasArt = (ex) => (ex && !userImage(ex) ? artKey(ex) : null);
const img = (ex, cls = '') => {
  const k = hasArt(ex);
  if (k) return `<img class="${cls} art" src="${artSrc(k)}" alt="" loading="lazy">`;
  return `<img class="${cls}" src="${esc(userImage(ex) ? ex.image : PLACEHOLDER)}" alt="" loading="lazy" onerror="this.onerror=null;this.src='${PLACEHOLDER}'">`;
};
const cueHtml = (c) => esc(c).replace(/\n/g, '<br>');
/**
 * Grande image d'exercice. Personnage animé : décor 1 ou 2 avec néons animés, et la consigne
 * en orange néon à droite (grande vue de séance). Sinon : image + schéma des muscles.
 */
const exVis = (ex, cls, mapCls = '') => {
  const map = muscleMap(ex?.muscles, mapCls);
  const k = hasArt(ex);
  if (!k) return `<span class="exv">${img(ex, cls)}${map}</span>`;
  const cue = cls === 'exo-img' ? exCue(ex) : '';
  const side = cue ? `<span class="ex-cue"><span class="ex-cue-t">Consigne</span><span class="ex-cue-x">${cueHtml(cue)}</span></span>` : map;
  return `<span class="exv art d${decorOf(k)} ${cls} ${cue ? 'has-cue' : ''}"><span class="ex-neon" aria-hidden="true"></span><span class="exv-in" style="--fit:${fitOf(k)}"><img src="${artSrc(k)}" alt="" decoding="async">${glowLayer(k)}</span>${side}</span>`;
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
const fmtSet = (z) => z.skip ? 'non fait' : `${z.warm ? 'éch. ' : ''}${fmtKg(z.w)}×${z.r}${z.feel ? ` (${FEEL_TXT[z.feel]})` : z.rpe ? ` @${z.rpe}` : ''}`;
const exRest = (exId) => state.exercises.get(exId)?.restSec || state.restSec;
const GEAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>';
// Bouton retour : flèche ronde (le texte reste pour les lecteurs d'écran).
const BACK_SVG = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const backBtn = (href, label, attrs = '') => `<a class="back" href="${href}" aria-label="Retour : ${esc(label)}" title="${esc(label)}" ${attrs}>${BACK_SVG}</a>`;
const TRASH_SVG = '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12M9 7V4h6v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const dangerBtn = (act, label) => `<button class="btn danger-big" data-act="${act}">${TRASH_SVG}<span>${label}</span></button>`;
const BACK_HOME = backBtn('#/', 'Entraînement');

/* ---------- Démarrage ---------- */
// Appli mise en arrière-plan (ou fermée) : la séance en cours est écrite sans attendre.
// Synchro GitHub : envoi si les données ont changé (requête « keepalive » pour survivre à la mise en arrière-plan).
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState !== 'hidden') return;
  const save = state.active ? saveActive(true) : Promise.resolve();
  Promise.resolve(save).then(() => sync.pushNow({ keepalive: true })).catch(() => {});
});

async function boot() {
  const seeded = await db.kvGet('seeded');
  if (!seeded) {
    for (const e of DEFAULT_EXERCISES) await db.put('exercises', e);
    for (const w of DEFAULT_WORKOUTS) await db.put('workouts', w);
    await db.kvSet('seeded', true);
  }
  await reload();
  await migrateHipThrust();
  await addNewDefaults();
  await translateEnCues();
  await purgeBugs();
  await migratePairs();
  await migrateMuscles();
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
  // Rattrape un envoi raté (pas de réseau, appli fermée trop vite).
  sync.pushNow().catch(() => {});
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
  const [ex, wk, ss, rest, active, warm, splash, timerAdj, body, goal, sound] = await Promise.all([db.getAll('exercises'), db.getAll('workouts'), db.getAll('sessions'), db.kvGet('restSec'), db.kvGet('active'), db.kvGet('warm'), db.kvGet('splash'), db.kvGet('timerAdj'), db.kvGet('body'), db.kvGet('goal'), db.kvGet('sound')]);
  state.exercises = new Map(ex.map((e) => [e.id, e]));
  refreshPairs();
  state.workouts = wk;
  state.sessions = ss;
  state.restSec = rest || DEFAULT_REST_SEC;
  state.active = active || null;
  state.warm = { on: true, pct: 60, reps: 15, ...(warm || {}) };
  state.splash = splash !== false;
  state.timerAdj = timerAdj === true; // boutons −15 s / +15 s masqués par défaut
  state.body = Array.isArray(body) ? body : [];
  state.sound = { rest: 'classic', fx: true, ...(sound || {}) };
  setSoundPrefs(state.sound);
  state.goal = Number.isInteger(goal) && goal >= 1 && goal <= 7 ? goal : 3; // objectif de séances par semaine
}

/** V1.2 : l'ancienne note par exercice devient la consigne (ajoutée sous la consigne par défaut). */
/** v2.3 : Barbell_Hip_Thrust fusionné dans l'exercice perso Hip thrust (une seule fois, copie gardée dans kv). */
async function migrateHipThrust() {
  if (await db.kvGet(HT_FLAG)) return;
  const plan = planHipThrust({ exercises: [...state.exercises.values()], workouts: state.workouts, sessions: state.sessions, active: state.active });
  if (!plan) return;
  await db.kvSet(HT_BACKUP, { at: Date.now(), ...plan.backup }); // copie écrite avant toute modification
  for (const w of plan.workouts) await db.put('workouts', w);
  for (const x of plan.sessions) await db.put('sessions', x);
  if (plan.active) await db.kvSet('active', plan.active);
  await db.del('exercises', plan.deleteExercise);
  await db.kvSet(HT_FLAG, true);
  await reload();
}

/** v2.3 : Belt squat et Crunch à la machine ajoutés au catalogue perso s'ils n'y sont pas (une seule fois). */
async function addNewDefaults() {
  if (await db.kvGet('defaults-v23')) return;
  for (const e of missingDefaults([...state.exercises.values()], DEFAULT_EXERCISES, NEW_DEFAULTS_V23)) {
    await db.put('exercises', e); state.exercises.set(e.id, e);
  }
  await db.kvSet('defaults-v23', true);
}

/** v2.3 : consignes anglaises connues passées en français (copie d'origine gardée dans kv 'cues-en-backup'). */
async function translateEnCues() {
  const { changed, backup } = translateCues([...state.exercises.values()]);
  if (!changed.length) return;
  const old = (await db.kvGet('cues-en-backup')) || [];
  await db.kvSet('cues-en-backup', [...old, ...backup.map((b) => ({ ...b, at: Date.now() }))]);
  for (const e of changed) { await db.put('exercises', e); state.exercises.set(e.id, e); }
}

/** Liste des exercices aux haltères transmise aux calculs de volume (stats.js). */
function refreshPairs() { setPairIds([...state.exercises.values()].filter((e) => e.pair).map((e) => e.id)); }

/** v2.3 : exercices aux haltères connus marqués « poids par haltère » (une seule fois, choix manuel jamais touché). */
async function migratePairs() {
  if (await db.kvGet(PAIR_FLAG)) return;
  for (const e of planPairs([...state.exercises.values()])) { await db.put('exercises', e); state.exercises.set(e.id, e); }
  refreshPairs();
  await db.kvSet(PAIR_FLAG, true);
}

/** v2.3 : muscles des exercices perso renseignés s'ils sont vides (une seule fois, saisie manuelle jamais touchée). */
async function migrateMuscles() {
  if (await db.kvGet(MUSCLES_FLAG)) return;
  for (const e of planMuscles([...state.exercises.values()])) { await db.put('exercises', e); state.exercises.set(e.id, e); }
  await db.kvSet(MUSCLES_FLAG, true);
}

/** Carnet de bugs : retire ce qui est corrigé (liste FIXED_BUGS), copie gardée dans kv 'bugs-fixed'. */
async function purgeBugs() {
  const { keep, removed } = purgeFixedBugs(await db.kvGet('bugs'));
  if (!removed.length) return;
  const old = (await db.kvGet('bugs-fixed')) || [];
  await db.kvSet('bugs-fixed', [...old, ...removed]);
  await db.kvSet('bugs', keep);
}

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
  [/^#\/body$/, viewBody],
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
  const tab = ['progress', 'body'].includes(hash.split('/')[1] || '') ? 'progress' : '';
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
      const input = m.querySelector('input, textarea');
      resolve(value === 'input' ? input.value : value);
    };
    m.querySelector('input')?.focus();
  });
}

/** Modifier la consigne d'un exercice pendant la séance. Enregistrée sur l'exercice (vaut pour les prochaines séances). */
async function editCue(id) {
  const ex = state.exercises.get(id);
  if (!ex) return;
  const v = await modal(`<h3>Consigne : ${esc(ex.name)}</h3><textarea class="field cue-edit" rows="8" aria-label="Consigne">${esc(exCue(ex))}</textarea><p class="muted small">Une idée par ligne. Enregistrée sur l'exercice, pour les prochaines séances aussi.</p>`, [{ label: 'Annuler', value: null }, { label: 'Enregistrer', value: 'input', cls: 'primary' }]);
  if (v == null) return;
  ex.cue = String(v).split('\r').join('').trim();
  await db.put('exercises', ex);
  state.exercises.set(ex.id, ex);
  toast('Consigne enregistrée');
  keepScroll(viewSession);
}
const cueBtn = (id, has) => `<button class="btn sm ghost cue-btn" data-act="editcue" data-id="${esc(id)}">${has ? '✎ Modifier la consigne' : '+ Ajouter une consigne'}</button>`;
const confirmBox = (text, ok = 'OK', cls = 'primary') => modal(`<p>${text}</p>`, [{ label: 'Annuler', value: false }, { label: ok, value: true, cls }]);
const promptBox = (text, value = '') => modal(`<p>${text}</p><input class="field" type="text" value="${esc(value)}">`, [{ label: 'Annuler', value: null }, { label: 'OK', value: 'input', cls: 'primary' }]);

/* ---------- Entraînement (accueil + gestion des séances) ---------- */
function viewHome() {
  const ws = workoutsSorted();
  const next = nextWorkout(ws, state.sessions);
  const last = [...state.sessions].filter((s) => s.end).sort((a, b) => b.start - a.start)[0];
  const lastOf = (wid) => state.sessions.filter((s) => s.end && s.workoutId === wid).sort((a, b) => b.start - a.start)[0];
  // Carte du jour : décor Muscle Beach + mini-Johan dans le mouvement de la séance, nom en néon (contenu v2.3).
  // Citation du jour à droite du titre, dans la carte (place libre).
  const qd = quoteOfDay();
  const quoteIn = `<figure class="v-quote in"><blockquote>« ${esc(qd.text)} »</blockquote><figcaption>${esc(qd.author)}</figcaption></figure>`;
  const hero = (eyebrow, name, sub, btn) => {
    const k = sessionKind(name);
    return `<section class="card hero" style="--k:${k.color}"><div class="scene k-${k.icon}" aria-hidden="true"><div class="scene-spr">${sprite(k.icon, 104)}</div></div><div class="body">
      <div class="hero-row"><div class="hero-t"><div class="eyebrow">${eyebrow}</div><h2>${esc(name)}</h2><div class="v-sub">${sub}</div></div>${quoteIn}</div>${btn}</div></section>`;
  };
  let top;
  if (state.active) {
    top = hero('Séance en cours', state.active.workoutName, `Commencée à ${new Date(state.active.start).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`,
      '<button class="v-grad v-start" data-act="resume">Reprendre la séance</button>');
  } else if (next) {
    const lw = lastOf(next.id);
    const n = next.items.length;
    top = hero('Séance du jour', next.name, `${n} exercice${n > 1 ? 's' : ''}${lw ? ` · dernière fois ${dayLong(lw.start)}` : ''}`,
      `<button class="v-grad v-start" data-act="start" data-id="${esc(next.id)}">Commencer</button>`);
  } else {
    top = `<section class="card empty">${sprite('hausse', 72)}<p>Aucune séance. Crée ta première séance ci-dessous.</p></section>`;
  }
  const q = quoteOfDay();
  const quote = `<figure class="v-quote"><blockquote>« ${esc(q.text)} »</blockquote><figcaption>${esc(q.author)} · ${esc(q.source)}</figcaption></figure>`;
  // Objectif de la semaine (lundi à dimanche).
  const wp = weekProgress(state.sessions);
  const left = state.goal - wp.count;
  const dots = ['L', 'M', 'M', 'J', 'V', 'S', 'D'].map((l, d) => `<div class="v-day"><span class="v-dot ${wp.days.has(d) ? 'on' : d === wp.today ? 'today' : ''}"></span>${l}</div>`).join('');
  const goalCard = `<section class="card v-goal"><div class="v-goal-h"><div class="grow">Objectif de la semaine</div><div class="v-goal-n" aria-label="${wp.count} séances sur ${state.goal}">${wp.count} / ${state.goal}</div></div>
    <div class="v-week" aria-hidden="true">${dots}</div>
    <div class="v-sub">${left > 0 ? `Encore ${left} séance${left > 1 ? 's' : ''} pour valider la semaine.` : 'Semaine validée, bravo.'}</div></section>`;
  // Exercice phare : les exercices les plus pratiqués, un appui passe au suivant.
  const f = featured(state.sessions);
  let feat = '';
  if (f.items.length) {
    const k = state.ui.feat % f.items.length;
    const it = f.items[k];
    const sp = sparkPoints(it.pts);
    const pg = f.items.map((_, j) => `<i class="${j === k ? 'on' : ''}"></i>`).join('');
    feat = `<section class="card v-feat" data-act="feat" role="button" aria-label="Exercice phare : ${esc(it.name)}. Toucher pour voir le suivant.">
      <div class="v-feat-h"><div class="v-eyebrow grow">Exercice phare</div>${f.items.length > 1 ? `<div class="v-pg" aria-hidden="true">${pg}</div>` : ''}</div>
      <div class="v-feat-b"><div class="grow"><div class="v-fname">${esc(it.name)}</div>
        <div class="v-sub">Meilleure série : <b>${fmtKg(it.best.w)} kg × ${it.best.r}</b></div>
        ${featSince(it)}</div>
        ${sp && it.pts.length > 1 ? `<svg width="96" height="48" viewBox="0 0 96 48" role="img" aria-label="Courbe de progression du 1RM estimé"><polyline points="${sp.points}" fill="none" stroke="#ff5fa2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><circle cx="${sp.end[0]}" cy="${sp.end[1]}" r="4" fill="#ffd166"/></svg>` : ''}</div>
      ${f.top && f.top.pct > 0 ? `<div class="v-feat-f">Tu progresses le plus sur <b>${esc(f.top.name)}</b> : <span class="v-cy"><b>+${f.top.pct} %</b></span></div>` : ''}</section>`;
  }
  const rows = ws.map((w) => `<li class="wk" style="--k:${sessionKind(w.name).color}">
      <span class="wk-ico" aria-hidden="true">${sprite(sessionKind(w.name).icon, 46)}</span>
      <a class="grow" href="#/workout/${esc(w.id)}"><strong>${esc(w.name)}</strong><div class="muted small">${w.items.length} exercice${w.items.length > 1 ? 's' : ''} · Cliquer pour modifier</div></a>
      ${state.active ? '' : `<button class="btn outline" data-act="start" data-id="${esc(w.id)}">Démarrer</button>`}</li>`).join('');
  render(`<header class="top"><h1>Entraînement</h1><a class="gear" href="#/settings" aria-label="Réglages">${GEAR}</a></header>
    ${top}
    ${next || state.active ? '' : quote}
    ${state.sessions.some((x) => x.end) ? goalCard + feat : ''}
    <h3 class="sec">Mes séances</h3><ul class="list card">${rows || '<li class="muted">Aucune séance</li>'}</ul>
    <div class="row gap"><button class="btn grow" data-act="new">+ Nouvelle séance</button>${ws.length > 1 ? '<a class="btn ghost" href="#/workouts">Changer l\'ordre</a>' : ''}</div>
    ${last ? `<p class="muted small center">Dernière séance : ${esc(last.workoutName)}, ${fmtDay(last.start)} · <a href="#/recap/${esc(last.id)}">voir le récap</a></p>` : ''}`, {
    resume: () => go('#/session'),
    start: (el) => moodSheet(el.dataset.id),
    new: newWorkout,
    feat: () => { state.ui.feat++; keepScroll(viewHome); },
  });
}

/** « jeudi 13/11 » */
const dayLong = (t) => { const d = new Date(t); return `${d.toLocaleDateString('fr-FR', { weekday: 'long' })} ${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };

/** Feuille « Comment tu te sens ? » : un appui démarre la séance avec ce ressenti, la croix annule. */
function moodSheet(workoutId) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  if (!w.items.length) { toast('Cette séance ne contient aucun exercice.'); return; }
  unlockAudio();
  let sh = document.getElementById('sheet');
  if (!sh) { sh = document.createElement('div'); sh.id = 'sheet'; sh.className = 'v-sheet-wrap'; document.body.appendChild(sh); }
  sh.innerHTML = `<div class="v-sheet" role="dialog" aria-modal="true" aria-labelledby="sheetT">
    <div class="v-handle" aria-hidden="true"></div>
    <div class="v-sheet-h"><div class="v-eyebrow grow">${esc(w.name)}</div><button class="v-x" data-x aria-label="Fermer"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <h2 id="sheetT">Comment tu te sens ?</h2><p class="v-sub">Un appui et la séance démarre.</p>
    <div class="v-moods">${MOODS.map((m) => `<button class="v-mood m-${m.id}" data-m="${m.id}"><span class="l">${esc(m.label)}</span><span class="s">${esc(m.sub)}</span></button>`).join('')}</div></div>`;
  sh.classList.add('show');
  const close = () => { sh.classList.remove('show'); sh.onclick = null; document.removeEventListener('keydown', onKey); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  document.addEventListener('keydown', onKey);
  sh.onclick = (e) => {
    if (e.target === sh || e.target.closest('[data-x]')) { close(); return; }
    const b = e.target.closest('[data-m]');
    if (b) { close(); startSession(w.id, b.dataset.m); }
  };
  sh.querySelector('.v-mood')?.focus();
}

async function newWorkout() {
  const name = (await promptBox('Nom de la nouvelle séance :', ''))?.trim();
  if (!name) return;
  const w = { id: uid(), name, order: Math.max(-1, ...state.workouts.map((x) => x.order)) + 1, items: [] };
  await db.put('workouts', w); state.workouts.push(w);
  go(`#/workout/${w.id}`);
}

async function startSession(workoutId, mood) {
  const w = state.workouts.find((x) => x.id === workoutId);
  if (!w) return;
  if (!w.items.length) { toast('Cette séance ne contient aucun exercice.'); return; }
  unlockAudio();
  state.active = {
    id: uid(), workoutId: w.id, workoutName: w.name, start: Date.now(), end: null, restSec: state.restSec, timer: null,
    items: w.items.map((it, k) => buildItem(it.exerciseId, it.sets, !!it.ss && k < w.items.length - 1)),
  };
  if (mood) state.active.mood = mood;
  state.ui.exIndex = 0;
  await saveActive(true);
  go('#/session');
}

/** Exercice de séance : séries préremplies depuis la dernière fois, échauffement ajouté si une charge est connue. */
function buildItem(exerciseId, n, ss = false) {
  // Unilatéral (hors superset) : séries gauche puis droite, préremplies par côté, échauffement commun en tête.
  if (state.exercises.get(exerciseId)?.uni && !ss) {
    const lts = { L: lastTime(state.sessions, exerciseId, null, 'L'), R: lastTime(state.sessions, exerciseId, null, 'R') };
    // Côté sauté à la dernière séance (blessure) : on ne reprend pas une charge plus ancienne, la case reste vide.
    const latest = Math.max(lts.L?.date || 0, lts.R?.date || 0);
    for (const sd of ['L', 'R']) if (lts[sd] && lts[sd].date < latest) lts[sd] = null;
    const sets = [];
    for (let k = 0; k < n; k++) for (const side of ['L', 'R']) {
      const lt = lts[side];
      const ref = lt?.sets[k] || lt?.sets[lt.sets.length - 1];
      sets.push({ w: ref ? ref.w : '', r: ref ? ref.r : '', done: false, side });
    }
    const item = { exerciseId, name: exName(exerciseId), restSec: exRest(exerciseId), planned: n, ss: false, uni: true, sets };
    if (state.warm.on) addWarmup(item);
    return item;
  }
  const lt = lastTime(state.sessions, exerciseId, null, 'B');
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
/** Comparaison de l'exercice phare avec son premier passage des 8 dernières semaines. */
function featSince(it) {
  // Comparatif : meilleure série actuelle (ligne au-dessus) contre l'ancienne meilleure, puis l'écart.
  const day = (t) => { const d = new Date(t); return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`; };
  if (it.n < 2) return '<div class="v-sub">1re séance, à suivre</div>';
  const p = it.prev;
  if (!p) return `<div class="v-sub">Record posé le ${day(it.first)}, à battre</div>`;
  const t = p.dw > 0 ? `+${fmtKg(p.dw)} kg` : `+${p.dr} rep${p.dr > 1 ? 's' : ''}`;
  return `<div class="v-sub">Ancienne meilleure : <b>${fmtKg(p.w)} kg × ${p.r}</b></div><div class="v-cy"><b>${t}</b> depuis le ${day(p.date)}</div>`;
}

function pickSessionExercise() {
  const s = state.active;
  const labs = supersetLabels(s.items);
  const cur = Math.min(state.ui.exIndex, s.items.length - 1);
  const m = document.getElementById('modal');
  m.innerHTML = `<div class="modal-box"><p><strong>Exercices de la séance</strong></p><ul class="pick-list ex-pick">${s.items.map((x, k) => {
    const work = x.sets.filter((z) => !z.warm);
    const done = work.filter((z) => z.done).length;
    return `<li data-i="${k}" class="${k === cur ? 'on' : ''} ${done && done >= work.length ? 'ok' : ''}"><span class="num">${k + 1}</span><span class="grow">${esc(x.name)}${labs[k] ? ` <span class="sstag">${labs[k]}</span>` : ''}</span><span class="cnt">${done}/${work.length}</span>${s.items.length > 1 ? `<button class="btn icon sm" data-mv="${k}" data-d="-1" ${k === 0 ? 'disabled' : ''} aria-label="Monter ${esc(x.name)}">↑</button><button class="btn icon sm" data-mv="${k}" data-d="1" ${k === s.items.length - 1 ? 'disabled' : ''} aria-label="Descendre ${esc(x.name)}">↓</button>` : ''}${s.items.length > 1 ? `<button class="btn icon sm danger-text" data-rm="${k}" aria-label="Retirer ${esc(x.name)} de cette séance">✕</button>` : ''}</li>`;
  }).join('')}</ul><button class="btn big" data-add>+ Ajouter un exercice</button><p class="muted small">Ajout, retrait et ordre valent pour cette séance uniquement : la séance type ne change pas.</p><div class="modal-actions"><button class="btn" data-x>Fermer</button></div></div>`;
  m.classList.add('show');
  m.onclick = async (e) => {
    const mv = e.target.closest('[data-mv]');
    if (mv) {
      const k = +mv.dataset.mv, j = k + +mv.dataset.d;
      if (j < 0 || j >= s.items.length) return;
      s.items = moveItem(s.items, k, +mv.dataset.d);
      const ex = state.ui.exIndex;
      state.ui.exIndex = ex === k ? j : ex === j ? k : ex;
      await saveActive(true);
      pickSessionExercise();
      return;
    }
    const rm = e.target.closest('[data-rm]');
    if (rm) { m.classList.remove('show'); m.onclick = null; await removeSessionExercise(+rm.dataset.rm); return; }
    if (e.target.closest('[data-add]')) { m.classList.remove('show'); m.onclick = null; await addSessionExercise(); return; }
    const li = e.target.closest('li[data-i]');
    if (!li && !e.target.closest('[data-x]')) return;
    m.classList.remove('show'); m.onclick = null;
    if (li) { state.ui.exIndex = +li.dataset.i; viewSession(); window.scrollTo(0, 0); }
  };
}

/** Ajoute un exercice à la fin de la séance en cours (la séance type n'est pas modifiée). */
async function addSessionExercise() {
  const s = state.active;
  const id = await pickExercise('Ajouter un exercice à cette séance');
  if (!id) { pickSessionExercise(); return; }
  s.items.push(buildItem(id, 3, false));
  await saveActive(true);
  state.ui.exIndex = s.items.length - 1;
  toast(`${exName(id)} ajouté à la séance`);
  viewSession(); window.scrollTo(0, 0);
}

/** Retire un exercice de la séance en cours, avec confirmation si des séries sont déjà validées. */
async function removeSessionExercise(k) {
  const s = state.active;
  const it = s.items[k];
  if (!it || s.items.length < 2) return;
  const done = it.sets.filter((z) => z.done && !z.warm).length;
  const msg = done ? `${esc(it.name)} : ${done} série${done > 1 ? 's' : ''} déjà validée${done > 1 ? 's' : ''} ser${done > 1 ? 'ont' : 'a'} perdue${done > 1 ? 's' : ''}. Retirer quand même ?` : `Retirer ${esc(it.name)} de cette séance ?`;
  if (!(await confirmBox(msg, 'Retirer', 'danger'))) { pickSessionExercise(); return; }
  s.items = removeItemAt(s.items, k);
  if (state.ui.exIndex >= s.items.length || state.ui.exIndex > k) state.ui.exIndex = Math.max(0, Math.min(s.items.length - 1, state.ui.exIndex - (state.ui.exIndex > k ? 1 : 0)));
  await saveActive(true);
  toast(`${it.name} retiré de la séance`);
  viewSession(); window.scrollTo(0, 0);
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
    editcue: (el) => editCue(el.dataset.id),
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
  if (it.uni) { viewUni(s, i, group); return; }
  const ex = state.exercises.get(it.exerciseId);
  const lt = lastTime(state.sessions, it.exerciseId, s.id, 'B');
  const best = bestOf(previousSetsFor(state.sessions, null, it.exerciseId, null, 'B'));
  const sug = suggestForMood(lt, it.planned || it.sets.length, s.mood);
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
      <label><input class="field num" type="text" inputmode="decimal" value="${esc(typeof st.w === 'number' ? fmtKg(st.w) : st.w)}" data-input="setval" data-k="${k}" data-f="w" ${st.done ? 'disabled' : ''} aria-label="Poids ${name}${isPair(it.exerciseId) ? ', un haltère' : ''}"><em>${isPair(it.exerciseId) ? 'kg/haltère' : 'kg'}</em></label>
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
      ${sug && anyUndone ? `<button class="btn suggest" data-act="applysug"><span>${sug.up ? '↗' : sug.down ? '↘' : '='} Aujourd'hui : ${sugTxt}</span><span class="small">Appliquer</span></button>` : ''}
      ${best.count ? `<p class="muted small">Record : ${fmtKg(best.maxW)} kg · 1RM estimé ${fmtKg(round1(best.maxE1rm))} kg</p>` : ''}
      ${cue && !hasArt(ex) ? `<p class="cue-neon">${cueHtml(cue)}</p>` : ''}<p>${cueBtn(it.exerciseId, !!cue)}</p>
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
      const vol = loadFactor(it) * done.reduce((a, z) => a + z.w * z.r, 0);
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
    const lt = lastTime(state.sessions, it.exerciseId, s.id, 'B');
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
      ${cues.length ? `<details class="cue"><summary><span class="small muted">Consignes</span></summary>${cues.map(([it, c]) => `<p><strong>${esc(it.name)}</strong><br><span class="cue-txt">${cueHtml(c)}</span><br>${cueBtn(it.exerciseId, true)}</p>`).join('')}</details>` : ''}
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

const SVG_CHECK = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>';
const SVG_BACK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>';
const SVG_NEXT = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>';
const fmtW = (w) => esc(typeof w === 'number' ? fmtKg(w) : w);

/**
 * Exercice unilatéral : une ligne par série avec une colonne Gauche et une colonne Droite.
 * Les séries sont rangées G, D, G, D… dans it.sets (champ side). Un appui valide les deux côtés.
 */
function viewUni(s, i, group) {
  const it = s.items[i];
  const ex = state.exercises.get(it.exerciseId);
  const Ls = [], Rs = [];
  it.sets.forEach((z, k) => { if (!z.warm) (z.side === 'R' ? Rs : Ls).push(k); });
  const pairs = Array.from({ length: Math.max(Ls.length, Rs.length) }, (_, p) => [Ls[p] ?? null, Rs[p] ?? null]);
  const pairDone = (pr) => pr.every((k) => k == null || it.sets[k].done);
  const cur = pairs.findIndex((pr) => !pairDone(pr));
  const ltL = lastTime(state.sessions, it.exerciseId, s.id, 'L');
  const ltR = lastTime(state.sessions, it.exerciseId, s.id, 'R');
  const sug = suggestForMood(ltL, pairs.length, s.mood);
  const sugTxt = sug ? (sug.w ? `${fmtKg(sug.w)} kg × ${sug.r}` : `${sug.r} reps`) : '';
  const rest = it.restSec || s.restSec || state.restSec;
  const n = s.items.length;
  const cell = (k, p, side) => {
    if (k == null) return '<div class="v-cell fut">–</div>';
    const st = it.sets[k];
    const lab = `${side === 'L' ? 'gauche' : 'droite'}, série ${p + 1}`;
    if (st.done && st.skip) return '<div class="v-cell fut">non fait</div>';
    if (st.done) return `<div class="v-cell">${fmtKg(st.w)} × ${st.r}${st.pr?.length ? ' <span aria-label="record">🏆</span>' : ''}</div>`;
    if (p === cur) return `<div class="v-in"><input type="text" inputmode="decimal" value="${fmtW(st.w)}" data-input="setval" data-k="${k}" data-f="w" aria-label="Poids ${lab}" placeholder="kg"><span aria-hidden="true">×</span><input type="text" inputmode="numeric" value="${esc(st.r)}" data-input="setval" data-k="${k}" data-f="r" aria-label="Répétitions ${lab}" placeholder="reps"></div>`;
    return `<div class="v-cell fut">${st.w !== '' ? fmtW(st.w) : '–'} × ${st.r !== '' ? esc(st.r) : '–'}</div>`;
  };
  const rows = pairs.map((pr, p) => {
    const done = pairDone(pr);
    const circle = done ? `<button class="v-cir done" data-act="uundo" data-p="${p}" aria-label="Annuler la série ${p + 1}">${SVG_CHECK}</button>`
      : `<span class="v-cir ${p === cur ? 'cur' : ''}">${p + 1}</span>`;
    const a = it.sets[pr[0] ?? pr[1]];
    const sub = subLine({ key: `u${i}-${p}`, done, feel: a.feel, note: a.note, noun: 'Série', fem: true,
      feelAttrs: `data-act="ufeel" data-p="${p}"`, noteAttrs: `data-change="unote" data-p="${p}" aria-label="Note série ${p + 1}"`,
      okAttrs: 'data-act="subok"', editAttrs: `data-act="subedit" data-key="u${i}-${p}"` });
    return `<div class="set-wrap"><div class="v-grow ${p === cur ? 'cur' : ''}">${circle}${cell(pr[0], p, 'L')}${cell(pr[1], p, 'R')}</div>${sub}</div>`;
  }).join('');
  // Échauffement (un seul, pour les deux côtés) : hors records et hors volume.
  const wk = it.sets.findIndex((z) => z.warm);
  const ws = wk < 0 ? null : it.sets[wk];
  const warmRow = !ws ? '' : `<div class="set-wrap warm"><div class="v-grow">
      <span class="v-cir">Éch.</span>
      ${ws.done ? `<div class="v-cell">${fmtKg(ws.w)} × ${ws.r}</div>` : `<div class="v-in"><input type="text" inputmode="decimal" value="${fmtW(ws.w)}" data-input="setval" data-k="${wk}" data-f="w" aria-label="Poids échauffement" placeholder="kg"><span aria-hidden="true">×</span><input type="text" inputmode="numeric" value="${esc(ws.r)}" data-input="setval" data-k="${wk}" data-f="r" aria-label="Répétitions échauffement" placeholder="reps"></div>`}
      <div class="v-warm-b">${ws.done ? `<button class="btn icon undo" data-act="undo" data-k="${wk}" aria-label="Annuler l'échauffement">↺</button>` : `<button class="btn icon ok" data-act="validate" data-k="${wk}" aria-label="Valider l'échauffement">✓</button>`}</div></div>
      <div class="set-sub warm-sub"><span class="small muted">Échauffement léger, les deux côtés : hors records et hors volume</span>${ws.done ? '' : '<button class="btn sm ghost" data-act="delwarm">Retirer</button>'}</div></div>`;
  const anyDone = it.sets.some((z) => z.done && !z.warm);
  // Côté absent de la séance la plus récente : « non fait » plutôt qu'une charge plus ancienne.
  const lastDate = Math.max(ltL?.date || 0, ltR?.date || 0);
  const lastLine = (lt, l) => (!lt ? '' : lt.date < lastDate ? `<div><b>${l}</b> <span class="muted">non fait</span></div>` : `<div><b>${l}</b> ${fmtKg(lt.top.w)} kg × ${lt.top.r}</div>`);
  // Équilibre : séries du jour si les deux côtés sont faits, sinon meilleures séries de la dernière fois.
  // Un côté sauté aujourd'hui (aucune série réelle, au moins une « non fait ») : pas de pourcentage.
  const sideState = (sd) => { const d = it.sets.filter((z) => z.side === sd && z.done && !z.warm); return d.length && d.every((z) => z.skip) ? 'skip' : d.length ? 'ok' : 'none'; };
  const skipSide = sideState('R') === 'skip' ? 'Droite' : sideState('L') === 'skip' ? 'Gauche' : null;
  let bal = skipSide ? null : balancePct(it.sets.filter((z) => z.done && !z.warm && !z.skip));
  let balSrc = 'aujourd\'hui';
  // Repli sur la dernière séance seulement si les deux côtés y ont été faits (même séance).
  if (bal == null && !skipSide && ltL && ltR && ltL.date === ltR.date) { bal = balancePct([{ ...ltL.top, side: 'L' }, { ...ltR.top, side: 'R' }]); balSrc = 'dernière séance'; }
  const nt = nextBalanceTier(bal);
  const lastPair = pairs[pairs.length - 1];
  const nav = navHandlers(s, group);
  const pDone = pairs.filter(pairDone).length;
  render(`${sessionTop(s, group).replace('<span class="small muted"></span>', `<span class="small muted">${pDone}/${pairs.length} séries</span>`)}
    <h1 class="v-h1">${esc(it.name)}</h1>
    <div class="v-chips"><span class="v-chip uni">Unilatéral</span>${s.mood ? `<span class="v-chip">${esc(moodLabel(s.mood))}</span>` : ''}</div>
    <button class="imgbtn v-imgbtn" data-act="zoom">${exVis(ex, 'uni-img')}</button>
    <div class="rest-line v-rest"><span class="grow rest-lbl"><span aria-hidden="true">⏱</span> Repos pour cet exercice</span>${restPicker(rest, 'rest')}</div>
    <p class="v-cuebtn">${cueBtn(it.exerciseId, !!exCue(ex))}</p>
    <section class="card v-last">${ltL || ltR ? `<div class="v-eyebrow">La dernière fois</div>${lastLine(ltL, 'G')}${lastLine(ltR, 'D')}` : '<div class="v-sub">Première fois en unilatéral sur cet exercice.</div>'}
      <p class="v-info"><span class="v-i" aria-hidden="true">i</span><span>Gauche : suggestion de progression. Droite : charge libre, pas de suggestion (rééducation).</span></p>
      ${sug && cur >= 0 ? `<button class="btn suggest" data-act="applysug"><span>${sug.up ? '↗' : sug.down ? '↘' : '='} Gauche aujourd'hui : ${sugTxt}</span><span class="small">Appliquer</span></button>` : ''}
    </section>
    <section class="card v-uni">
      <div class="v-grid-h"><span>Série</span><span>Gauche</span><span>Droite</span></div>
      ${warmRow}${rows}
      ${cur >= 0 ? `<button class="v-grad v-big" data-act="upair">Valider la série ${cur + 1}</button>` : '<p class="v-sub center">Toutes les séries sont faites.</p>'}
      <div class="row gap"><button class="btn" data-act="uadd">+ Série</button>
        ${!ws && !anyDone ? '<button class="btn ghost" data-act="addwarm">+ Échauffement</button>' : ''}
        ${pairs.length > 1 && lastPair && !pairDone(lastPair) && lastPair.every((k) => k == null || !it.sets[k].done) ? '<button class="btn ghost" data-act="udel">− Série</button>' : ''}
        <span class="grow"></span><button class="btn sm ghost" data-act="swap">⇄ Remplacer</button></div>
    </section>
    ${bal != null ? `<section class="card v-bal"><div class="v-bal-h"><span class="grow">Équilibre droite / gauche</span><b>${bal} %</b></div>
      <div class="v-bar" role="img" aria-label="Côté droit à ${bal} % du côté gauche"><i style="width:${Math.min(100, bal)}%"></i></div>
      <div class="v-bal-f"><span class="grow">Calcul : 1RM estimé droite ÷ gauche (${balSrc})</span><span>${nt ? `Prochain palier : ${nt} %` : 'Équilibre atteint'}</span></div></section>`
      : skipSide ? `<section class="card v-bal"><div class="v-bal-h"><span class="grow">Équilibre droite / gauche</span><b>–</b></div>
      <div class="v-bal-f"><span class="grow">${skipSide} non faite aujourd'hui : pas de calcul d'équilibre.</span></div></section>` : ''}
    ${i < n - 1 ? '<div class="row gap"><span class="grow"></span><button class="btn primary next" data-act="nextex">Exercice suivant →</button></div>' : ''}`, {
    ...nav,
    setval: (el) => { it.sets[+el.dataset.k][el.dataset.f] = el.value; saveActive(); },
    upair: () => validatePair(i, pairs[cur]),
    validate: (el) => validateSet(i, +el.dataset.k),
    undo: (el) => { const st = it.sets[+el.dataset.k]; st.done = false; delete st.pr; delete st.at; saveActive(); keepScroll(viewSession); },
    addwarm: () => { if (addWarmup(it)) { saveActive(); keepScroll(viewSession); } else toast('Saisis d’abord la charge gauche de la 1re série : l’échauffement en est calculé.'); },
    delwarm: () => { it.sets = it.sets.filter((z) => !z.warm); saveActive(); keepScroll(viewSession); },
    subedit: (el) => { state.ui.editSub = el.dataset.key; keepScroll(viewSession); app.querySelector('.sub-edit input')?.focus(); },
    subok: () => { app.querySelector('.sub-edit input')?.blur(); state.ui.editSub = null; keepScroll(viewSession); },
    unote: (el) => { const v = el.value.trim(); for (const k of pairs[+el.dataset.p]) if (k != null) it.sets[k].note = v; saveActive(); },
    ufeel: (el) => { const v = +el.dataset.v; const ks = pairs[+el.dataset.p].filter((k) => k != null); const on = it.sets[ks[0]].feel !== v; for (const k of ks) { if (on) it.sets[k].feel = v; else delete it.sets[k].feel; } saveActive(); keepScroll(viewSession); },
    uundo: (el) => { for (const k of pairs[+el.dataset.p]) if (k != null) { const st = it.sets[k]; st.done = false; delete st.pr; delete st.at; if (st.skip) { st.w = ''; st.r = ''; delete st.skip; } } saveActive(); keepScroll(viewSession); },
    uadd: () => {
      for (const side of ['L', 'R']) { const l = it.sets.filter((z) => !z.warm && (z.side || 'L') === side).pop(); const ok = l && !l.skip; it.sets.push({ w: ok ? l.w : '', r: ok ? l.r : '', done: false, side }); }
      saveActive(); keepScroll(viewSession);
    },
    udel: () => { const ks = lastPair.filter((k) => k != null).sort((a, b) => b - a); for (const k of ks) it.sets.splice(k, 1); saveActive(); keepScroll(viewSession); },
    applysug: () => { for (const z of it.sets) if (!z.done && !z.warm && z.side !== 'R') { z.w = sug.w; z.r = sug.r; } saveActive(); keepScroll(viewSession); toast(`Côté gauche réglé sur ${sugTxt}`); },
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

/** Valide une série unilatérale (gauche et droite), puis lance un seul repos. */
async function validatePair(i, ks) {
  unlockAudio();
  const s = state.active;
  const it = s.items[i];
  const todo = ks.filter((k) => k != null && !it.sets[k].done);
  if (!todo.length) return;
  // Côté laissé vide (blessure, rééducation) : accepté si l'autre côté est saisi. Série « sautée », hors stats.
  const empty = (st) => (st.w === '' || parseNum(st.w) === 0) && (st.r === '' || parseNum(st.r) === 0);
  const real = todo.filter((k) => !empty(it.sets[k]));
  if (!real.length) { toast('Saisis au moins un côté'); return; }
  for (const k of real) if (!checkSet(it.sets[k])) return;
  const prs = [];
  for (const k of todo) {
    if (!real.includes(k)) {
      Object.assign(it.sets[k], { w: 0, r: 0, done: true, skip: true, pr: [], at: Date.now() });
      // Côté sauté : la série suivante de ce côté part vide (pas de charge proposée).
      const nx = it.sets[k + 2];
      if (nx && !nx.done && !nx.warm && nx.side === it.sets[k].side) { nx.w = ''; nx.r = ''; }
      continue;
    }
    const st = commitSet(i, k);
    if (st.pr.length) prs.push(st);
  }
  state.ui.lastSet = todo.map((k) => [i, k]);
  const finished = !it.sets.some((z) => !z.done && !z.warm);
  state.ui.restAnim = finished ? 'epuise' : 'repos';
  startRest(it.restSec || s.restSec || state.restSec);
  await saveActive(true);
  if (location.hash === '#/session') keepScroll(viewSession);
  if (finished && i < s.items.length - 1) toast(`${it.name} terminé. Suivant : ${s.items[i + 1].name}`, 3500);
  if (prs.length) celebrate(`${it.name} (${prs[0].side === 'R' ? 'droite' : 'gauche'})`, prs[0]);
  else if (finished) beepExercise();
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
  const nx = it.uni ? it.sets[k + 2] : it.sets[k + 1];
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
  else if (lastWork && !st.warm) beepExercise();
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
  else if (finished && !warm) beepExercise();
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
    if (!(await confirmBox('Aucune série validée. Terminer la séance ? Rien ne sera enregistré.', 'Terminer'))) return;
    await endActive();
    go('#/');
    mascotPop({ anim: 'saut', h: 150, ms: 3000, title: 'Tu es venu, c’est déjà ça !', html: '<p class="muted">Chaque passage à la salle compte. À la prochaine.</p>' });
    return;
  }
  // Une paire gauche + droite compte pour une série, comme au récap (countSets).
  const remaining = s.items.reduce((a, it) => a + countSets(it.sets.filter((z) => !z.done && !z.warm)), 0);
  const shown = Math.max(1, s.items.reduce((a, it) => a + countSets(it.sets.filter((z) => z.done && !z.warm)), 0));
  // Les 2 premiers exercices sont les plus importants : toutes leurs séries de travail faites = séance réussie.
  const core = s.items.slice(0, 2).every((it) => it.sets.filter((z) => !z.warm).every((z) => z.done));
  const msg = remaining ? `Terminer maintenant ? ${shown} séries validées, ${remaining} non faites (elles ne seront pas enregistrées).` : `Terminer la séance ? ${shown} séries validées.`;
  if (!(await confirmBox(msg, 'Terminer'))) return;
  const done = { ...s, end: Date.now(), timer: null, items: s.items.map((it) => ({ ...it, sets: it.sets.filter((z) => z.done) })).filter((it) => it.sets.some((z) => !z.warm)) };
  await db.put('sessions', done);
  state.sessions.push(done);
  await endActive();
  go(`#/recap/${done.id}`);
  beepFinish();
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
  if (a === 'nextex' && state.active) {
    timer.stop(); timerEl.classList.remove('ended'); state.ui.timerMin = false;
    state.ui.exIndex = Math.min(+b.dataset.k, state.active.items.length - 1);
    if (location.hash === '#/session') { viewSession(); window.scrollTo(0, 0); } else go('#/session');
  }
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
/** Exercice suivant si toutes les séries de l'exercice (ou du superset) en cours sont validées, sinon null. */
function nextExerciseAfterRest() {
  const s = state.active;
  if (!s || !s.items.length) return null;
  const g = supersetGroup(s.items, Math.min(state.ui.exIndex, s.items.length - 1));
  const k = g[g.length - 1] + 1;
  if (k >= s.items.length || !g.every((x) => s.items[x].sets.every((z) => z.done))) return null;
  return { k, name: s.items[k].name };
}

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
    if (it.uni && !it.sets[k].warm) { const w = it.sets.filter((z) => !z.warm); return `Ensuite : ${it.name}, série ${Math.floor(w.indexOf(it.sets[k]) / 2) + 1} / ${Math.ceil(w.length / 2)}`; }
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
      <div class="t-label">Repos</div><div class="t-next"></div><div class="t-spr"></div>
      <div class="t-ring"><svg viewBox="0 0 280 280" aria-hidden="true"><circle class="track" cx="140" cy="140" r="124"/><circle class="prog" cx="140" cy="140" r="124" stroke-dasharray="${RING_C.toFixed(1)}"/></svg><div class="t-digits"></div></div>
      <div class="t-feel"></div>
      <p class="t-tip"></p>
      <div class="t-btns t-adj"><button class="btn soft" data-t="minus">−15 s</button><button class="btn soft" data-t="plus">+15 s</button></div>
      <button class="btn primary t-nextex" data-t="nextex"></button>
      <div class="t-btns"><button class="btn cyan" data-t="skip">Passer</button><button class="btn outline" data-t="min">Réduire</button></div>
      <button class="btn primary big t-go" data-t="go">C'est parti !</button></div>
      <button class="t-mini" data-t="max"><span>Repos</span> <b class="t-digits"></b></button>`;
  }
  const rem = timer.remainingMs;
  timerEl.querySelectorAll('.t-digits').forEach((d) => { d.textContent = fmtClock(rem); });
  timerEl.querySelector('.t-label').textContent = ended ? 'Repos terminé' : 'Repos';
  const frac = timer.total ? Math.max(0, Math.min(1, rem / (timer.total * 1000))) : 0;
  timerEl.querySelector('.t-ring .prog').style.strokeDashoffset = (RING_C * (1 - frac)).toFixed(1);
  timerEl.querySelector('.t-next').textContent = nextSetLabel();
  // Dernier repos d'un exercice (ou d'un superset) : proposer de passer directement au suivant.
  const nx = show && !ended ? nextExerciseAfterRest() : null;
  const nb = timerEl.querySelector('.t-nextex');
  nb.style.display = nx ? '' : 'none';
  if (nx) { nb.dataset.k = nx.k; nb.textContent = `Passer à : ${nx.name} →`; }
  // Un conseil par repos : la clé est la seconde de fin prévue au départ (stable pendant le repos).
  if (timer.running && timerEl.dataset.tk !== String(timer.startKey)) { timerEl.dataset.tk = timer.startKey; timerEl.querySelector('.t-tip').textContent = `💡 ${restTip(Math.round(timer.startKey / 1000))}`; }
  const anim = ended ? 'finrepos' : state.ui.restAnim || 'repos';
  const sp = timerEl.querySelector('.t-spr');
  // Taille du bonhomme bornée par la hauteur d'écran : sinon la colonne déborde et le haut du sprite est rogné.
  const size = Math.round(Math.min(ended ? 200 : 150, innerHeight * (ended ? 0.24 : 0.15)));
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
  const vol = st.volume >= 1000 ? `${fmtT(st.volume)} t` : `${fmtKg(st.volume)} kg`;
  const eq = weightEquivalent(st.volume);
  const today = new Date(s.start).toDateString() === new Date().toDateString();
  const ended = state.sessions.filter((x) => x.end);
  const before = ended.filter((x) => x.start < s.start);
  // Succès : seulement pour la séance la plus récente (sinon les paliers ont déjà été vus).
  const latest = !ended.some((x) => x.id !== s.id && x.start > s.start);
  const unlocked = latest ? newlyUnlocked(ended, s.id, { goal: state.goal }) : [];
  const recs = st.prs.map((p) => `<li class="v-rec"><div class="grow"><strong>${esc(p.name)}</strong><div class="v-sub">${esc(prDetail(p, previousSetsFor(before, null, p.exerciseId, { side: p.side || undefined })))}</div></div><div class="v-gold">${fmtKg(p.w)} kg × ${p.r} reps</div></li>`).join('');
  const TROPHY = '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4"/><path d="M12 13v4M8 20h8"/></svg>';
  render(`<div class="v-eyebrow v-top">Séance terminée · ${esc(s.workoutName)}</div>
    <h1 class="v-h1 big">Bien joué.</h1>
    <p class="v-sub">${fmtDay(s.start)}${s.mood ? ` · ${esc(moodLabel(s.mood))}` : ''}</p>
    <div class="v-tiles">
      <div><span>Durée</span><b>${formatDuration(st.durationMs)}</b></div>
      <div><span>Séries</span><b>${st.setCount}</b></div>
      <div><span>Volume</span><b>${vol}</b></div>
    </div>
    ${eq ? `<section class="v-idea"><div class="v-idea-t">Pour te donner une idée</div>
      <div class="v-idea-m">Tu as soulevé l'équivalent ${eq.a.startsWith('un') ? `d'${esc(eq.a)}` : `de ${esc(eq.a)}`}.</div>
      <div class="v-idea-s">${fmtT(st.volume)} t ${today ? 'aujourd\'hui' : 'ce jour-là'} · ${esc(eq.d)}</div></section>` : ''}
    ${recs ? `<h3 class="sec">${FLAME} Records battus</h3><ul class="list card">${recs}</ul>` : ''}
    ${unlocked.map((u) => `<section class="card v-ach"><div class="v-badge big">${TROPHY}</div><div class="grow"><div class="v-eyebrow">Succès débloqué</div><div class="v-ach-n">${esc(u.name)} · palier ${u.tier}</div><div class="v-sub">${esc(u.desc)}</div></div></section>`).join('')}
    <h3 class="sec">Détail</h3><ul class="list card">${s.items.map((it, k) => `<li class="row"><div class="grow"><strong>${esc(it.name)}</strong><div class="muted small">${it.sets.map((z) => `${z.side ? `${z.side === 'R' ? 'D' : 'G'} ` : ''}${fmtSet(z)}`).join(' · ')}</div>${setNotes(it.sets)}</div><button class="btn icon sm" data-act="delitem" data-k="${k}" aria-label="Retirer cet exercice de la séance">✕</button></li>`).join('')}</ul>
    <p class="muted small">Volume = somme des poids × répétitions des séries validées.</p>
    <p class="small muted" id="syncLine">Préparation de la sauvegarde…</p>
    <div class="v-btns"><button class="btn outline big" data-act="saveq" id="saveq">Sauvegarder et quitter</button>
      <button class="v-grad v-start" data-act="succes">Voir mes succès</button></div>
    <button class="btn ghost" data-act="exp" id="expBtn" hidden>Exporter aussi un fichier</button>
    ${dangerBtn('del', 'Supprimer cette séance')}`, {
    saveq: async (el) => {
      if (!ready) { toast('Sauvegarde en préparation, réessaie dans un instant.'); return; }
      if (hasToken) {
        el.disabled = true; el.textContent = 'Envoi…';
        const ok = await pushP;
        toast(ok ? 'Sauvegardé sur GitHub' : 'Envoi GitHub échoué : nouvel essai au prochain lancement.');
        go('#/');
        return;
      }
      // Sur iOS, le partage doit partir directement du clic : aucun await avant doExport.
      const res = await doExport();
      if (res && res !== 'cancelled') go('#/');
    },
    exp: async (el) => { const res = await doExport(); if (res && res !== 'cancelled') el.textContent = 'Fichier exporté ✓'; },
    succes: () => {
      // La séance est déjà enregistrée sur le téléphone ; l'envoi GitHub continue et prévient à la fin (toast).
      if (!hasToken) toast('Séance enregistrée sur ce téléphone. Pense à « Sauvegarder et quitter » pour une copie.');
      state.ui.ptab = 'succes'; go('#/progress');
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
  let ready = false, hasToken = false, pushP = Promise.resolve(false);
  Promise.all([buildBackupFile(), sync.getConfig()]).then(([f, cfg]) => {
    state.backupFile = f;
    ready = true;
    hasToken = !!cfg?.token;
    const line = document.getElementById('syncLine');
    if (!hasToken) {
      if (line) line.textContent = 'Tes données ne sont que sur ce téléphone. « Sauvegarder et quitter » ouvre la feuille de partage : choisis « Enregistrer dans Fichiers » (iCloud Drive) ou Mail. Pour que ce soit automatique, active la synchro GitHub dans Réglages.';
      return;
    }
    const eb = document.getElementById('expBtn');
    if (eb) eb.hidden = false;
    if (line) line.textContent = 'Envoi sur GitHub…';
    pushP = sync.pushNow().then(() => {
      if (line?.isConnected) line.textContent = `Sauvegardé sur GitHub ✓ (${cfg.owner}/${cfg.repo})`;
      else toast('Séance sauvegardée sur GitHub ✓');
      return true;
    }, (e) => {
      if (line?.isConnected) line.innerHTML = `<span class="danger-text">${esc(e.message)}</span> Nouvel essai au prochain lancement de l'appli.`;
      else toast('Envoi GitHub échoué : nouvel essai au prochain lancement.');
      return false;
    });
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
    ${dangerBtn('delw', 'Supprimer cette séance')}`, {
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
  render(`<header class="top">${backBtn(`#/workout/${esc(w.id)}`, w.name)}</header>
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
    html += `<h3 class="sec">Catalogue <span class="muted small">(noms en anglais)</span></h3>
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
  // v2.3 : plus rien n'est téléchargé (ni image ni consigne). Nom et muscles viennent du catalogue local.
  const ex = { id, name: row[1], muscles: row[2], image: '', source: 'free-exercise-db' };
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
  render(`<header class="top">${backBtn('#/', 'Retour', 'data-act="back"')}</header>
    <section class="card exo">${exVis(ex, 'exo-img')}
      <label class="btn big file">Remplacer l'image<input type="file" accept="image/*" data-change="file" hidden></label>
      ${userImage(ex) ? `<button class="btn ghost" data-act="restore">${hasArt({ ...ex, image: '' }) ? 'Remettre l\'image d\'origine' : 'Retirer mon image'}</button>` : ''}
      <p class="muted small">Utilise une image dont tu as les droits (photo perso, capture de tes contenus).</p></section>
    <section class="card"><label class="small muted">Nom</label><input class="field" type="text" value="${esc(ex.name)}" data-change="name">
      <label class="small muted">Muscles</label><input class="field" type="text" value="${esc(ex.muscles || '')}" data-change="muscles"></section>
    <section class="card"><label class="small muted">Consigne (affichée pendant la séance, une idée par ligne)</label>
      <textarea class="field" rows="5" placeholder="Placement, tempo, réglage machine…" data-change="cue">${esc(exCue(ex))}</textarea>
      ${DEFAULT_CUES[id] && ex.cue !== undefined && ex.cue !== DEFAULT_CUES[id] ? '<button class="btn ghost sm" data-act="cuereset">Remettre la consigne d\'origine</button>' : ''}
      <div class="rest-line"><span class="grow rest-lbl"><span aria-hidden="true">⏱</span> Repos pour cet exercice</span>${restPicker(ex.restSec || state.restSec, 'rest')}</div></section>
    <section class="card"><label class="row"><span class="grow">Unilatéral (gauche et droite séparés)</span><input type="checkbox" class="switch" data-change="uni" ${ex.uni ? 'checked' : ''}></label>
      <p class="muted small">En séance : une colonne Gauche et une colonne Droite, l'équilibre droite / gauche, une suggestion de progression pour le côté gauche seulement. Prend effet à la prochaine séance.</p>
      <label class="row"><span class="grow">Aux haltères (poids d’un haltère)</span><input type="checkbox" class="switch" data-change="pair" ${ex.pair ? 'checked' : ''}></label>
      <p class="muted small">Tu saisis le poids d’UN haltère. Le volume compte les deux (2 × poids × reps), sauf en unilatéral où chaque côté porte un seul haltère.</p></section>
    ${ex.source === 'free-exercise-db' ? '<p class="muted small">Nom et muscles : catalogue free-exercise-db (domaine public, licence Unlicense).</p>' : ''}
    ${dangerBtn('delex', 'Supprimer cet exercice')}`, {
    back: () => (history.length > 1 ? history.back() : go('#/')),
    delex: () => deleteExercise(ex),
    file: async (el) => {
      const f = el.files[0];
      if (!f) return;
      try { ex.image = await resizeImage(f); ex.imgUser = true; await saveEx(ex); toast('Image remplacée'); viewExercise(id); } catch { toast('Image illisible'); }
    },
    restore: async () => { ex.image = ''; delete ex.imgUser; await saveEx(ex); viewExercise(id); },
    name: async (el) => { ex.name = el.value.trim() || ex.name; await saveEx(ex); toast('Nom enregistré'); },
    muscles: async (el) => { ex.muscles = el.value.trim(); await saveEx(ex); },
    cue: async (el) => { ex.cue = el.value.trim(); await saveEx(ex); toast('Consigne enregistrée'); keepScroll(() => viewExercise(id)); },
    cuereset: async () => { delete ex.cue; await saveEx(ex); toast('Consigne d\'origine remise'); keepScroll(() => viewExercise(id)); },
    rest: async (el) => { ex.restSec = readRest(el); await saveEx(ex); toast(`Repos de ${fmtClock(ex.restSec * 1000)} enregistré`); },
    pair: async (el) => { ex.pair = el.checked; await saveEx(ex); toast(el.checked ? 'Poids saisi par haltère' : 'Poids total saisi'); },
    uni: async (el) => { if (el.checked) ex.uni = true; else delete ex.uni; await saveEx(ex); toast(el.checked ? 'Unilatéral activé (prochaine séance)' : 'Unilatéral désactivé'); },
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
  refreshPairs();
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

const LOCK = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>';
const LVL_COLOR = ['#ffffff', '#2de2e6', '#ffce2d', '#ff5fa2'];
const DAY = 864e5;
/** Lundi de la semaine décalée de off semaines (off ≤ 0). */
const weekAt = (off) => weekStart(weekStart(Date.now()) + off * 7 * DAY + 3 * DAY);
const musclesById = () => Object.fromEntries([...state.exercises.values()].map((e) => [e.id, e.muscles || '']));

function viewProgress() {
  const tab = ['courbes', 'calendrier', 'muscles', 'succes'].includes(state.ui.ptab) ? state.ui.ptab : 'courbes';
  const done = state.sessions.filter((s) => s.end);
  const tabs = [['courbes', 'Courbes'], ['calendrier', 'Calendrier'], ['muscles', 'Muscles'], ['succes', 'Succès']]
    .map(([k, l]) => `<button class="v-seg-b ${tab === k ? 'on' : ''}" data-act="ptab" data-k="${k}" role="tab" aria-selected="${tab === k}">${l}</button>`).join('');
  let body = '';
  let mw = null;
  if (tab === 'calendrier') {
    const hist = [...done].sort((a, z) => z.start - a.start);
    body = `${calendarHtml()}
      ${done.length ? `<h3 class="sec">Évolution par type de séance</h3>${sessionTypesHtml(done)}
      <p class="muted small">Pourcentage : volume (poids × reps) de la dernière séance comparé à la précédente du même type.</p>
      <h3 class="sec">Historique</h3><ul class="list card">${hist.map((s) => { const st = sessionStats(s); return `<li class="row"><a class="grow row" href="#/recap/${esc(s.id)}"><div class="grow"><strong>${esc(s.workoutName)}</strong><div class="muted small">${fmtDay(s.start)} · ${fmtKg(st.volume)} kg · ${st.setCount} séries</div></div><span class="plus">›</span></a></li>`; }).join('')}</ul>
      <p class="muted small">Ouvre une séance pour la supprimer ou retirer un exercice.</p>`
      : `<section class="card empty">${sprite('hausse', 72)}<p class="muted">Termine une première séance pour voir ton évolution.</p></section>`}`;
  } else if (tab === 'courbes') {
    const counts = new Map();
    for (const s of state.sessions) for (const it of s.items) counts.set(it.exerciseId, (counts.get(it.exerciseId) || 0) + 1);
    const list = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    const lastBody = [...state.body].sort((a, z) => z.t - a.t)[0];
    body = `<a class="card row v-link" href="#/body"><div class="grow"><strong>Mensurations</strong><div class="muted small">${lastBody ? `Dernière mesure : ${fmtDay(lastBody.t)}` : 'Poids, masse grasse, tours de bras, poitrine, taille, cuisse'}</div></div><span class="plus">›</span></a>
      ${list.length ? `<h3 class="sec">Exercices</h3><ul class="list card">${list.map(([id, n]) => {
      const b = bestOf(previousSetsFor(state.sessions, null, id));
      return `<li class="row ex-row"><a class="grow row" href="#/progress/${esc(id)}">${img(state.exercises.get(id), 'thumb')}<div class="grow"><strong>${esc(exName(id))}</strong><div class="muted small">${n} séance${n > 1 ? 's' : ''} · max ${fmtKg(b.maxW)} kg · 1RM est. ${fmtKg(round1(b.maxE1rm))} kg</div></div><span class="plus">›</span></a></li>`;
    }).join('')}</ul>` : `<section class="card empty">${sprite('hausse', 72)}<p class="muted">Termine une première séance pour voir tes courbes.</p></section>`}`;
  } else if (tab === 'muscles') {
    const off = Math.min(0, state.ui.mwOffset);
    const ws = weekAt(off);
    const mb = musclesById();
    mw = muscleWeek(state.sessions, mb, ws);
    const prev = muscleWeek(state.sessions, mb, weekAt(off - 1));
    const d1 = new Date(ws), d2 = new Date(ws + 6 * DAY);
    const range = `${d1.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })} au ${d2.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}`;
    const title = off === 0 ? 'Cette semaine' : off === -1 ? 'Semaine dernière' : `Il y a ${-off} semaines`;
    const max = Math.max(10, ...mw.counts);
    const order = GROUPS.map((_, g) => g).filter((g) => mw.counts[g] > 0).sort((a, b) => mw.counts[b] - mw.counts[a]);
    const zeros = GROUPS.map((_, g) => g).filter((g) => !mw.counts[g]);
    const diff = (g) => { const d = mw.counts[g] - prev.counts[g]; return d > 0 ? `<span class="up">+${d}</span>` : d < 0 ? `<span class="down">−${-d}</span>` : '<span class="eq">=</span>'; };
    const rows = order.map((g) => `<li><button class="v-mrow" data-act="mgroup" data-g="${g}"><span class="nm">${esc(GROUPS[g])}</span><span class="v-mbar"><i style="width:${Math.round((mw.counts[g] / max) * 100)}%;background:${LVL_COLOR[levelOf(mw.counts[g])]}"></i></span><b>${mw.counts[g]}</b>${diff(g)}</button></li>`).join('');
    const zeroRow = zeros.length ? `<li><div class="v-mrow zero"><span class="nm">${esc(zeros.map((g, k) => (k ? GROUPS[g].toLowerCase() : GROUPS[g])).join(', '))}</span><b>0</b></div></li>` : '';
    body = `<div class="v-wnav"><button class="v-wbtn" data-act="mwprev" aria-label="Semaine précédente">${SVG_BACK}</button>
        <div class="grow center"><div class="v-wt">${title}</div><div class="v-ws">${range} · ${mw.sessions} séance${mw.sessions > 1 ? 's' : ''}</div></div>
        <button class="v-wbtn" data-act="mwnext" aria-label="Semaine suivante" ${off >= 0 ? 'disabled' : ''}>${SVG_NEXT}</button></div>
      <section class="card v-map"><canvas id="mmap" class="v-mcanvas" data-act="mmap" role="img" aria-label="Carte des muscles travaillés, face et dos"></canvas>
        <div class="v-fd" aria-hidden="true"><span>Face</span><span>Dos</span></div>
        <p class="muted small" id="mmapErr" hidden>Carte indisponible (images non chargées).</p>
        <div class="v-legend"><span><i style="background:#fff"></i>0</span><span><i style="background:#2de2e6"></i>1 à 4</span><span><i style="background:#ffce2d"></i>5 à 9</span><span><i style="background:#ff5fa2"></i>10 séries et +</span></div></section>
      <section class="card v-mlist"><div class="v-mhead"><span>Séries par muscle</span><span>vs sem. passée</span></div><ul>${rows}${zeroRow}</ul></section>
      <p class="muted small">Toucher un muscle pour voir les exercices qui l'ont travaillé. Séries validées, hors échauffement ; un exercice compte pour chacun des muscles indiqués dans sa fiche.</p>`;
  } else {
    const list = achievements(done, { goal: state.goal });
    const tot = achievementTotals(list);
    const sorted = [...list.filter((a) => !a.locked), ...list.filter((a) => a.locked)];
    body = `<div class="v-ach-tot"><b>${tot.unlocked}</b> / ${tot.total} paliers débloqués</div>
      <div class="v-achs">${sorted.map((a) => `<section class="v-achc ${a.locked ? 'locked' : ''}" data-act="ach" data-id="${esc(a.id)}" role="button" tabindex="0"><div class="v-badge ${a.locked ? 'lock' : ''}" aria-hidden="true">${a.locked ? LOCK : a.tier}</div>
        <div class="grow"><div class="v-achc-h"><span class="grow">${esc(a.name)}</span><span class="v-sub">${esc(a.text)}</span></div>
        ${a.hint ? `<div class="v-achc-hint">${esc(a.hint)}</div>` : ''}
        <div class="v-pbar" role="img" aria-label="${a.locked ? 'Verrouillé' : `Palier ${a.tier}`}, progression ${Math.round(a.pct)} %"><i style="width:${Math.max(0, Math.min(100, a.pct))}%"></i></div></div></section>`).join('')}</div>`;
  }
  render(`<h1 class="v-h1 big">Progrès</h1>
    <div class="v-seg" role="tablist">${tabs}</div>
    ${body}`, {
    ptab: (el) => { state.ui.ptab = el.dataset.k; viewProgress(); },
    ach: (el) => {
      const a = achievements(done, { goal: state.goal }).find((x) => x.id === el.dataset.id);
      if (!a) return;
      const steps = a.tiers.map((_, i) => `<li class="${i < a.tier ? 'ok' : ''}">${i < a.tier ? '✓' : '○'} Palier ${i + 1} : ${esc(a.desc(i + 1))}</li>`).join('');
      modal(`<h3>${esc(a.name)}</h3><p>${esc(a.how || '')}</p><p class="muted small">Où tu en es : ${esc(a.text)}</p><ul class="v-ach-steps">${steps}</ul>`, [{ label: 'Fermer', value: true }]);
    },
    calprev: () => { state.ui.calOffset--; viewProgress(); },
    calnext: () => { state.ui.calOffset = Math.min(0, state.ui.calOffset + 1); viewProgress(); },
    mwprev: () => { state.ui.mwOffset--; viewProgress(); },
    mwnext: () => { state.ui.mwOffset = Math.min(0, state.ui.mwOffset + 1); viewProgress(); },
    mgroup: (el) => muscleModal(+el.dataset.g, mw),
    mmap: async (el, e) => {
      try {
        const z = (await muscleData())[4];
        const r = el.getBoundingClientRect();
        const x = Math.floor(((e.clientX - r.left) / r.width) * z.width), y = Math.floor(((e.clientY - r.top) / r.height) * z.height);
        if (x < 0 || y < 0 || x >= z.width || y >= z.height) return;
        const p = (y * z.width + x) * 4;
        if (!z.data[p + 3]) return;
        const g = (z.data[p] - 8) >> 4;
        if (g >= 0 && g < GROUPS.length) muscleModal(g, mw);
      } catch { /* carte indisponible */ }
    },
  });
  if (mw) drawMuscleMap(mw.counts);
}

function muscleModal(g, mw) {
  if (!mw) return;
  const ex = mw.exercises[g] || [];
  modal(`<p><strong>${esc(GROUPS[g])}</strong> · ${mw.counts[g]} série${mw.counts[g] > 1 ? 's' : ''}</p>${ex.length ? `<ul class="list">${ex.map((x) => `<li class="row"><span class="grow">${esc(x.name)}</span><span class="muted small">${x.sets} série${x.sets > 1 ? 's' : ''}</span></li>`).join('')}</ul>` : '<p class="muted small">Aucun exercice cette semaine.</p>'}`, [{ label: 'Fermer', value: true }]);
}

/** Images de la carte musculaire (base, 3 niveaux, zones), chargées une fois et gardées en mémoire. */
let muscleImgs = null;
function muscleData() {
  if (!muscleImgs) {
    muscleImgs = Promise.all(['base.webp', 'l1.webp', 'l2.webp', 'l3.webp', 'zones.png'].map((f) => new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error(f));
      im.src = `img/muscles/${f}`;
    }))).then((ims) => {
      const W = ims[0].naturalWidth, H = ims[0].naturalHeight;
      return ims.map((im) => { const c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0, W, H); return x.getImageData(0, 0, W, H); });
    });
    muscleImgs.catch(() => { muscleImgs = null; });
  }
  return muscleImgs;
}

/** Colore chaque zone selon le nombre de séries : pixels pris dans le calque du niveau (l1, l2, l3). */
async function drawMuscleMap(counts) {
  const cv = document.getElementById('mmap');
  if (!cv) return;
  try {
    const [base, l1, l2, l3, zones] = await muscleData();
    if (!cv.isConnected) return;
    const L = [null, l1.data, l2.data, l3.data];
    const lv = counts.map(levelOf);
    const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    const o = out.data, z = zones.data;
    for (let p = 0; p < z.length; p += 4) {
      if (!z[p + 3]) continue;
      const g = (z[p] - 8) >> 4;
      if (g < 0 || g > 13) continue;
      const v = lv[g];
      if (!v) continue;
      const s = L[v];
      o[p] = s[p]; o[p + 1] = s[p + 1]; o[p + 2] = s[p + 2]; o[p + 3] = s[p + 3];
    }
    cv.width = base.width; cv.height = base.height;
    cv.getContext('2d').putImageData(out, 0, 0);
  } catch {
    const n = document.getElementById('mmapErr');
    if (n) n.hidden = false;
  }
}

/* ---------- Mensurations ---------- */
const BODY_FIELDS = [
  ['w', 'Poids', 'kg', 'ex. 78,5'], ['bf', 'Masse grasse', '%', 'facultatif'],
  ['armL', 'Bras gauche', 'cm', 'tour de bras'], ['armR', 'Bras droit', 'cm', 'tour de bras'],
  ['chest', 'Poitrine', 'cm', ''], ['waist', 'Taille', 'cm', 'au nombril'], ['thigh', 'Cuisse', 'cm', ''],
];
function viewBody() {
  const rows = [...state.body].sort((a, z) => a.t - z.t);
  const charts = BODY_FIELDS.map(([k, l, u]) => [l, u, rows.filter((r) => r[k] > 0).map((r) => ({ x: r.t, y: r[k] }))])
    .filter(([, , pts]) => pts.length).map(([l, u, pts]) => `<section class="card"><h3>${l} (${u})</h3>${lineChart(pts, { unit: u })}</section>`).join('');
  const txt = (r) => BODY_FIELDS.filter(([k]) => r[k] > 0).map(([k, l, u]) => `${l.toLowerCase()} ${fmtKg(r[k])} ${u}`).join(' · ');
  render(`<header class="top">${backBtn('#/progress', 'Progrès')}</header>
    <h1 class="h1">Mensurations</h1>
    <section class="card"><h3>Nouvelle mesure</h3>
      <div class="body-form v-bform">${BODY_FIELDS.map(([k, l, u, ph]) => `<label><span class="muted small">${l} (${u})</span><input id="b_${k}" type="text" inputmode="decimal" placeholder="${ph}"></label>`).join('')}</div>
      <p class="muted small">Remplis seulement ce que tu as mesuré.</p>
      <button class="btn primary big" data-act="bodyadd">Ajouter</button></section>
    ${charts || '<section class="card"><p class="muted">Ajoute une première mesure pour voir les courbes.</p></section>'}
    ${rows.length ? `<h3 class="sec">Historique</h3><ul class="list card">${[...rows].reverse().map((r) => `<li class="row"><div class="grow"><strong>${fmtDay(r.t)}</strong><div class="muted small">${txt(r) || 'vide'}</div></div><button class="btn icon sm" data-act="bodydel" data-t="${r.t}" aria-label="Supprimer cette mesure">✕</button></li>`).join('')}</ul>` : ''}`, {
    bodyadd: async () => {
      const num = (k) => parseFloat(String(document.getElementById(`b_${k}`).value).replace(',', '.'));
      const e = { t: Date.now() };
      for (const [k, l, u] of BODY_FIELDS) {
        const v = num(k);
        if (!(v > 0)) continue;
        if (k === 'w' && v >= 400) { toast('Poids : une valeur en kg sous 400.'); return; }
        if (k === 'bf' && v >= 70) { toast('Masse grasse : un pourcentage entre 0 et 70.'); return; }
        if (u === 'cm' && (v < 10 || v > 250)) { toast(`${l} : une valeur en cm entre 10 et 250.`); return; }
        e[k] = round1(v);
      }
      if (Object.keys(e).length === 1) { toast('Saisis au moins une mesure.'); return; }
      // w et bf toujours présents (null si vides) : format des mesures d'avant la v2.3.
      e.w = e.w ?? null; e.bf = e.bf ?? null;
      state.body = [...state.body, e];
      await db.kvSet('body', state.body);
      toast('Mesure ajoutée');
      viewBody();
    },
    bodydel: async (el) => {
      if (!(await confirmBox('Supprimer cette mesure ?', 'Supprimer', 'danger'))) return;
      state.body = state.body.filter((r) => r.t !== +el.dataset.t);
      await db.kvSet('body', state.body);
      viewBody();
    },
  });
}

function viewProgressExercise(id) {
  const series = exerciseSeries(state.sessions, id);
  const b = bestOf(previousSetsFor(state.sessions, null, id));
  const pts = (k) => series.map((p) => ({ x: p.date, y: p[k] }));
  const hist = state.sessions.filter((s) => s.end && s.items.some((it) => it.exerciseId === id)).sort((a, z) => z.start - a.start);
  render(`<header class="top">${backBtn('#/progress', 'Progrès')}</header>
    <h1 class="h1">${esc(exName(id))}</h1>
    <section class="card stats"><div><b>${fmtKg(b.maxW)}</b><span>kg max</span></div><div><b>${fmtKg(round1(b.maxE1rm))}</b><span>kg 1RM estimé</span></div><div><b>${series.length}</b><span>séances</span></div></section>
    <section class="card"><h3>Charge max par séance (kg)</h3>${lineChart(pts('maxW'))}</section>
    <section class="card"><h3>1RM estimé (kg)</h3>${lineChart(pts('e1rm'))}
      <p class="muted small">1RM estimé : la charge que tu pourrais soulever une seule fois, calculée depuis ta meilleure série de chaque séance. C'est une estimation, fiable surtout entre 2 et 10 reps.</p></section>
    <section class="card"><h3>Volume par séance (kg)</h3>${lineChart(pts('volume'))}<p class="muted small">Volume = somme des poids × répétitions.</p></section>
    <h3 class="sec">Historique</h3><ul class="list card">${hist.map((s) => `<li><strong>${fmtDay(s.start)}</strong> <span class="muted small">${esc(s.workoutName)}</span>${s.items.filter((it) => it.exerciseId === id).map((it) => `<div class="small">${it.sets.map((z) => `${fmtSet(z)}${z.pr?.length ? ' 🏆' : ''}`).join(' · ')}</div>${setNotes(it.sets)}`).join('')}</li>`).join('')}</ul>
    ${hist.length ? dangerBtn('purge', 'Supprimer l\'historique de cet exercice') : ''}`, {
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
  const [lastExport, bugs, syncCfg] = await Promise.all([db.kvGet('lastExport'), db.kvGet('bugs'), sync.getConfig()]);
  let bugList = Array.isArray(bugs) ? bugs : [];
  if (location.hash !== '#/settings') return; // l'utilisateur a changé d'écran entre-temps
  render(`<header class="top">${BACK_HOME}</header><h1 class="h1">Réglages</h1>
    <section class="card row"><span class="grow">Repos par défaut</span>${restPicker(state.restSec, 'rest')}</section>
    <h3 class="sec">Sons</h3>
    <section class="card">
      <div class="row"><span class="grow">Fin du repos</span><select class="field" data-change="restsound" aria-label="Son de fin du repos">${Object.entries(REST_SOUNDS).map(([k, v]) => `<option value="${k}" ${k === state.sound.rest ? 'selected' : ''}>${v.name}</option>`).join('')}</select><button class="btn sm" data-act="listen" aria-label="Écouter le son de fin du repos">▶ Écouter</button></div>
      <label class="row"><span class="grow">Sons de réussite</span><input type="checkbox" class="switch" data-change="fx" ${state.sound.fx ? 'checked' : ''}></label>
      <p class="muted small">Exercice terminé, record et fin de séance. Coupés si l'iPhone est en mode silencieux.</p>
    </section>
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
    <h3 class="sec">Objectif</h3>
    <section class="card"><div class="row"><span class="grow">Séances par semaine</span><select class="field" data-change="goal" aria-label="Objectif de séances par semaine">${[1, 2, 3, 4, 5, 6, 7].map((v) => `<option value="${v}" ${v === state.goal ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
      <p class="muted small">Affiché sur l'écran Entraînement, du lundi au dimanche.</p></section>
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
    <h3 class="sec">Synchro GitHub</h3>
    ${syncSectionHtml(syncCfg)}
    <h3 class="sec">Sauvegarde fichier</h3>
    <section class="card">
      <p class="small">${syncCfg?.token ? 'En secours de la synchro : un fichier' : 'Tes données restent uniquement sur ce téléphone. Exporte régulièrement un fichier'} (Mail, Fichiers / iCloud Drive). Il porte toujours le même nom : si iOS le propose, choisis « Remplacer ». Les photos d'exercices n'y sont pas incluses.</p>
      <p class="muted small">Dernier export : ${lastExport ? new Date(lastExport).toLocaleString('fr-FR') : 'jamais'}</p>
      <button class="btn primary big" data-act="export" id="exportBtn" disabled>Préparation…</button>
      <label class="btn big file">Importer une sauvegarde<input type="file" accept="application/json,.json" data-change="import" hidden></label>
      <p class="muted small" id="persist"></p>
    </section>
    <h3 class="sec">À propos</h3>
    <section class="card small"><p>YeahBuddy v${APP_VERSION} · usage personnel.</p>
      <p class="muted">Images d'exercices : personnages mini-Johan faits pour l'appli. Noms et muscles du catalogue : <a href="https://github.com/yuhonas/free-exercise-db" target="_blank" rel="noopener">free-exercise-db</a> (domaine public, Unlicense).</p>
      <p class="muted">Maintien de l'écran : ${!wakeLockSupported() ? 'non pris en charge par ce navigateur' : screenLocked() ? 'actif' : `inactif${lastWakeError() ? ` (${esc(lastWakeError())})` : ''}`}.</p></section>`, {
    rest: async (el) => { state.restSec = readRest(el); await db.kvSet('restSec', state.restSec); toast('Repos par défaut enregistré'); },
    goal: async (el) => { state.goal = Math.min(7, Math.max(1, +el.value || 3)); await db.kvSet('goal', state.goal); toast(`Objectif : ${state.goal} séance${state.goal > 1 ? 's' : ''} par semaine`); },
    restsound: async (el) => { state.sound.rest = el.value; setSoundPrefs(state.sound); await db.kvSet('sound', state.sound); previewRest(el.value); },
    listen: () => previewRest(state.sound.rest),
    fx: async (el) => { state.sound.fx = el.checked; setSoundPrefs(state.sound); await db.kvSet('sound', state.sound); toast(el.checked ? 'Sons de réussite activés' : 'Sons de réussite coupés'); },
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
      try { await navigator.clipboard.writeText(`Bugs YeahBuddy v${APP_VERSION}\n${txt}`); toast('Liste copiée'); } catch { toast('Copie impossible sur ce navigateur'); }
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
        sync.pushNow().catch(() => {});
        go('#/');
      } catch (e) { modal(`<p>${esc(e.message)}</p>`, [{ label: 'OK', value: true }]); }
    },
    syncconnect: async (el) => {
      const repo = document.getElementById('syncRepo').value;
      const tok = document.getElementById('syncTok').value;
      el.disabled = true; el.textContent = 'Connexion…';
      try {
        const remote = await sync.connect(repo, tok);
        const remoteN = remote?.data.sessions.length || 0;
        const localN = state.sessions.length;
        if (!remoteN) {
          await sync.pushNow({ force: true });
          toast('Connecté : sauvegarde envoyée sur GitHub');
        } else if (!localN) {
          await restoreFromGitHub();
        } else {
          const choice = await modal(`<p>Une sauvegarde existe déjà sur GitHub : ${remoteN} séance${remoteN > 1 ? 's' : ''}, du ${new Date(remote.data.exportedAt).toLocaleString('fr-FR')}. Ce téléphone en a ${localN}.</p><p>Laquelle garder ? L'autre reste récupérable dans l'historique GitHub.</p>`,
            [{ label: 'Annuler', value: null }, { label: 'Celle du téléphone', value: 'push' }, { label: 'Celle de GitHub', value: 'pull', cls: 'primary' }]);
          if (choice === 'push') { await sync.pushNow({ force: true }); toast('Sauvegarde du téléphone envoyée'); }
          else if (choice === 'pull') await restoreFromGitHub();
          else { await sync.disconnect(); toast('Connexion annulée'); }
        }
      } catch (e) { await modal(`<p>${esc(e.message)}</p>`, [{ label: 'OK', value: true }]); }
      if (location.hash === '#/settings') viewSettings();
    },
    syncnow: async (el) => {
      el.disabled = true; el.textContent = 'Envoi…';
      try { await sync.pushNow({ force: true }); toast('Sauvegardé sur GitHub ✓'); } catch (e) { toast(e.message, 5000); }
      viewSettings();
    },
    syncpull: async () => {
      if (!(await confirmBox('Remplacer les données de ce téléphone par la sauvegarde GitHub ?', 'Remplacer', 'danger'))) return;
      try { await restoreFromGitHub(); go('#/'); } catch (e) { modal(`<p>${esc(e.message)}</p>`, [{ label: 'OK', value: true }]); }
    },
    syncoff: async () => {
      if (!(await confirmBox('Déconnecter ce téléphone ? Le jeton est effacé du téléphone. La sauvegarde sur GitHub reste intacte.', 'Déconnecter', 'danger'))) return;
      await sync.disconnect();
      toast('Synchro désactivée');
      viewSettings();
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

/** Carte « Synchro GitHub » des Réglages : formulaire de connexion, ou état et actions. */
function syncSectionHtml(cfg) {
  if (!cfg?.token) return `<section class="card sync">
    <p class="small">Sauvegarde automatique dans un dépôt GitHub <strong>privé</strong> : envoyée en fin de séance et quand tu quittes l'appli. Si le téléphone est effacé ou perdu, reconnecte-toi ici pour tout récupérer.</p>
    <input class="field" id="syncRepo" type="text" placeholder="pseudo/nom-du-depot" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false">
    <input class="field" id="syncTok" type="password" placeholder="Jeton github_pat_…" autocapitalize="off" autocorrect="off" autocomplete="off" spellcheck="false">
    <button class="btn primary big" data-act="syncconnect">Connecter</button>
    <p class="muted small">Le jeton reste sur ce téléphone : il n'est ni exporté ni envoyé ailleurs qu'à GitHub. Garde-le dans tes mots de passe pour pouvoir te reconnecter.</p></section>`;
  const when = (t) => new Date(t).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' });
  return `<section class="card sync">
    <p class="small">Connecté à <strong>${esc(cfg.owner)}/${esc(cfg.repo)}</strong>.</p>
    <p class="muted small">Dernier envoi : ${cfg.lastSync ? when(cfg.lastSync) : 'pas encore'}</p>
    ${cfg.lastError ? `<p class="small danger-text">Dernier échec (${when(cfg.lastErrorAt)}) : ${esc(cfg.lastError)}</p>` : ''}
    <button class="btn primary big" data-act="syncnow">Synchroniser maintenant</button>
    <button class="btn outline big" data-act="syncpull">Restaurer depuis GitHub</button>
    <button class="btn ghost danger-text" data-act="syncoff">Déconnecter ce téléphone</button></section>`;
}

/** Remplace les données du téléphone par la sauvegarde GitHub, puis recharge l'appli. */
async function restoreFromGitHub() {
  timer.stop();
  const data = await sync.pullAndRestore();
  await reload();
  toast(`${data.sessions.length} séance${data.sessions.length > 1 ? 's' : ''} récupérée${data.sessions.length > 1 ? 's' : ''} depuis GitHub`, 4000);
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
