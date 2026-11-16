// Fonctions de calcul pures (sans accès au DOM ni à la base). Testées par tests/stats.test.mjs.

/** 1RM estimé, formule d'Epley : poids × (1 + reps / 30). Pour 1 rep, on renvoie le poids. */
export function epley(w, r) {
  if (!(w > 0) || !(r > 0)) return 0;
  if (r === 1) return w;
  return w * (1 + r / 30);
}

export const round1 = (n) => Math.round(n * 10) / 10;

/**
 * Séries de travail validées d'une séance pour un exercice donné (ou toutes si exerciseId absent).
 * Les séries d'échauffement (warm) et les côtés laissés vides en unilatéral (skip) sont exclus : ni volume, ni records.
 */
export function doneSets(session, exerciseId, side) {
  const out = [];
  for (const it of session.items || []) {
    if (exerciseId && it.exerciseId !== exerciseId) continue;
    for (const s of it.sets) if (s.done && !s.warm && !s.skip && onSide(s, side)) out.push(s);
  }
  return out;
}

/**
 * Filtre de côté (mode unilatéral) : side = 'L' ou 'R' pour un côté, 'B' pour les seules séries bilatérales
 * (sans côté), absent pour tout garder (volume, courbes). v2.3.1 : historiques bilatéral et unilatéral séparés,
 * une charge à deux bras ne sert plus de référence à un seul bras (et inversement).
 */
export function onSide(set, side) {
  if (!side) return true;
  if (side === 'B') return !set.side;
  return set.side === side;
}

/** Nombre de séries affiché : en unilatéral, une paire gauche + droite compte pour une série. */
export const countSets = (sets) => sets.filter((s) => s.side !== 'R').length;

/** Charge d'échauffement : pct % de la charge de travail, arrondie au 2,5 kg inférieur (0 si pas de charge). */
export function warmupWeight(workW, pct = 60) {
  if (!(workW > 0)) return 0;
  return Math.floor((workW * pct) / 100 / 2.5) * 2.5;
}

/**
 * Groupe de superset contenant l'exercice i : indices consécutifs reliés par `ss` (ss = lié au suivant).
 * Renvoie [i] si l'exercice n'est pas en superset.
 */
export function supersetGroup(items, i) {
  let a = i, b = i;
  while (a > 0 && items[a - 1]?.ss) a--;
  while (b < items.length - 1 && items[b]?.ss) b++;
  return Array.from({ length: b - a + 1 }, (_, k) => a + k);
}

/**
 * Retire l'exercice k d'une liste de séance (copie). Garde les supersets cohérents :
 * si le précédent était lié à celui retiré, il reste lié au suivant seulement si le retiré l'était aussi.
 */
export function removeItemAt(items, k) {
  const out = items.map((x) => ({ ...x }));
  if (k < 0 || k >= out.length) return out;
  const gone = out.splice(k, 1)[0];
  if (k > 0 && out[k - 1]?.ss && !gone.ss) out[k - 1].ss = false;
  if (out.length) out[out.length - 1].ss = false;
  return out;
}

/**
 * Échange l'exercice k avec son voisin (dir = -1 vers le haut, +1 vers le bas), en copie.
 * Les deux exercices déplacés et le précédent sortent de leur superset, pour ne jamais créer un lien non voulu.
 */
export function moveItem(items, k, dir) {
  const out = items.map((x) => ({ ...x }));
  const j = k + dir;
  if (k < 0 || k >= out.length || j < 0 || j >= out.length) return out;
  [out[k], out[j]] = [out[j], out[k]];
  const a = Math.min(k, j);
  for (const i of [a - 1, a, a + 1]) if (out[i]) out[i].ss = false;
  return out;
}

/** Lettre du superset (A, B, C…) pour chaque exercice, ou '' s'il n'est pas en superset. */
export function supersetLabels(items) {
  const out = items.map(() => '');
  let n = 0;
  for (let i = 0; i < items.length; i++) {
    const g = supersetGroup(items, i);
    if (g.length < 2 || g[0] !== i) continue;
    const L = String.fromCharCode(65 + (n++ % 26));
    g.forEach((k, j) => { out[k] = `${L}${j + 1}`; });
  }
  return out;
}

/*
 * Exercices aux haltères (v2.3) : le poids saisi est celui d'UN haltère, le volume compte donc 2 × poids × reps.
 * Exception : en mode unilatéral, chaque côté porte un seul haltère (facteur 1).
 * La liste est fournie par l'appli au démarrage et à chaque modification d'exercice (setPairIds).
 */
let PAIR = new Set();
export function setPairIds(ids) { PAIR = new Set(ids || []); }
export const isPair = (exerciseId) => PAIR.has(exerciseId);
export const loadFactor = (it) => (PAIR.has(it?.exerciseId) && !it?.uni ? 2 : 1);

/** Volume (kg) des séries de travail validées d'une séance, pour un exercice ou pour toute la séance. */
export function sessionVolume(session, exerciseId) {
  let v = 0;
  for (const it of session.items || []) {
    if (exerciseId && it.exerciseId !== exerciseId) continue;
    const f = loadFactor(it);
    for (const s of it.sets) if (s.done && !s.warm && !s.skip) v += f * s.w * s.r;
  }
  return v;
}

export function sessionStats(session) {
  const sets = doneSets(session);
  const volume = sessionVolume(session);
  const end = session.end || Date.now();
  const prs = [];
  for (const it of session.items || []) {
    for (const s of it.sets) if (s.done && s.pr && s.pr.length) prs.push({ name: it.name, exerciseId: it.exerciseId, w: s.w, r: s.r, pr: s.pr, side: s.side || null });
  }
  return { durationMs: Math.max(0, end - session.start), volume: round1(volume), setCount: countSets(sets), prs };
}

/** Meilleures performances sur une liste de séries. */
export function bestOf(sets) {
  let maxW = 0, maxE1rm = 0, maxRepsBodyweight = 0, count = 0;
  for (const s of sets) {
    count++;
    if (s.w > maxW) maxW = s.w;
    const e = epley(s.w, s.r);
    if (e > maxE1rm) maxE1rm = e;
    if (s.w === 0 && s.r > maxRepsBodyweight) maxRepsBodyweight = s.r;
  }
  return { maxW, maxE1rm, maxRepsBodyweight, count };
}

/**
 * Types de record battus par `set` par rapport à `previous` (résultat de bestOf).
 * Aucun record si aucun historique : le tout premier passage ne compte pas.
 */
export function detectPR(previous, set) {
  if (!previous || previous.count === 0 || !(set.r > 0)) return [];
  const types = [];
  if (set.w > 0) {
    if (set.w > previous.maxW) types.push('charge');
    if (epley(set.w, set.r) > previous.maxE1rm + 1e-9) types.push('1rm');
  } else if (set.r > previous.maxRepsBodyweight && previous.maxW === 0) {
    types.push('reps');
  }
  return types;
}

/**
 * Historique de référence pour un exercice : séances terminées + séries déjà validées de la séance en cours.
 * Avec une série de référence : seules les séries du même côté comptent (bilatéral avec bilatéral,
 * gauche avec gauche, droite avec droite). Sans série : tout l'historique, ou le filtre `side` donné.
 */
export function previousSetsFor(sessions, current, exerciseId, exceptSet, side = exceptSet ? (exceptSet.side || 'B') : undefined) {
  const sets = [];
  for (const s of sessions) if (s.end && s.id !== current?.id) sets.push(...doneSets(s, exerciseId, side));
  if (current) for (const s of doneSets(current, exerciseId, side)) if (s !== exceptSet) sets.push(s);
  return sets;
}

/** Dernière séance terminée contenant cet exercice : { date, sets, top }. */
export function lastTime(sessions, exerciseId, exceptSessionId, side) {
  const sorted = sessions.filter((s) => s.end && s.id !== exceptSessionId).sort((a, b) => b.start - a.start);
  for (const s of sorted) {
    const sets = doneSets(s, exerciseId, side);
    if (sets.length) {
      const top = sets.reduce((a, b) => (b.w > a.w || (b.w === a.w && b.r > a.r) ? b : a));
      return { date: s.start, sets: sets.map(({ w, r, feel }) => (feel ? { w, r, feel } : { w, r })), top: { w: top.w, r: top.r } };
    }
  }
  return null;
}

/** Points pour les courbes : une entrée par séance terminée. */
export function exerciseSeries(sessions, exerciseId) {
  return sessions
    .filter((s) => s.end)
    .sort((a, b) => a.start - b.start)
    .map((s) => {
      const sets = doneSets(s, exerciseId);
      if (!sets.length) return null;
      const b = bestOf(sets);
      return { date: s.start, maxW: b.maxW, e1rm: round1(b.maxE1rm), volume: round1(sessionVolume(s, exerciseId)) };
    })
    .filter(Boolean);
}

/** Séance suggérée : celle qui suit la dernière séance faite, dans l'ordre de la liste. */
export function nextWorkout(workouts, sessions) {
  if (!workouts.length) return null;
  const last = sessions.filter((s) => s.end).sort((a, b) => b.start - a.start)[0];
  if (!last) return workouts[0];
  const i = workouts.findIndex((w) => w.id === last.workoutId);
  return i === -1 ? workouts[0] : workouts[(i + 1) % workouts.length];
}

/** Lecture d'un nombre saisi au clavier français ("82,5" ou "82.5"). */
export function parseNum(v) {
  const n = parseFloat(String(v ?? '').replace(',', '.').trim());
  return Number.isFinite(n) ? n : NaN;
}

export function formatDuration(ms) {
  const m = Math.round(ms / 60000);
  const h = Math.floor(m / 60);
  return h ? `${h} h ${String(m % 60).padStart(2, '0')}` : `${m} min`;
}

export const fmtKg = (n) => String(round1(n)).replace('.', ',');

/**
 * Suggestion pour aujourd'hui, à partir de lastTime() et du nombre de séries prévues.
 * Règle : si la dernière fois toutes les séries prévues ont été validées à la charge max,
 * on propose +step kg (reps = le plus petit nombre de reps à cette charge).
 * Sinon on propose de refaire la meilleure série. Au poids du corps : +1 rep.
 * Renvoie { w, r, up } ou null sans historique.
 */
export function suggestNext(last, plannedSets, step = 2.5) {
  if (!last || !last.sets.length) return null;
  const { top, sets } = last;
  const complete = sets.length >= plannedSets && sets.every((s) => s.w >= top.w);
  const minR = Math.min(...sets.filter((s) => s.w >= top.w).map((s) => s.r));
  if (top.w === 0) return complete ? { w: 0, r: minR + 1, up: true } : { w: 0, r: top.r, up: false };
  return complete ? { w: round1(top.w + step), r: minR, up: true } : { w: top.w, r: top.r, up: false };
}

/** Jours entraînés (clé AAAA-MM-JJ en heure locale) à partir des séances terminées. */
export function trainedDays(sessions) {
  const days = new Set();
  for (const s of sessions) {
    if (!s.end) continue;
    const d = new Date(s.start);
    days.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  return days;
}

/** Lundi 0 h (heure locale) de la semaine qui contient t, en ms. */
export function weekStart(t) {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
}

/**
 * Série de semaines d'entraînement (lundi à dimanche) avec au moins une séance terminée.
 * Si la semaine en cours n'a pas encore de séance, le compte part de la semaine précédente :
 * la série n'est pas perdue tant que la semaine n'est pas finie.
 * Renvoie { weeks, thisWeek } (thisWeek = la semaine en cours compte déjà).
 */
export function weekStreak(sessions, now = Date.now()) {
  const weeks = new Set(sessions.filter((s) => s.end).map((s) => weekStart(s.start)));
  const prev = (w) => { const d = new Date(w); d.setDate(d.getDate() - 7); return weekStart(d.getTime()); };
  let w = weekStart(now);
  const thisWeek = weeks.has(w);
  if (!thisWeek) w = prev(w);
  let n = 0;
  while (weeks.has(w)) { n++; w = prev(w); }
  return { weeks: n, thisWeek };
}
