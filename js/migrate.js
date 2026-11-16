// Migrations de données v2.3. Fonctions pures : aucun accès à la base ni au DOM.
// Testées par tests/v23.test.mjs. L'appel et l'écriture se font dans app.js (boot).

export const HT_FROM = 'Barbell_Hip_Thrust';
export const HT_TO = 'custom_mw6hm706zjuhl';
export const HT_FLAG = 'mig-hipthrust';
export const HT_BACKUP = 'mig-hipthrust-backup';

const clone = (v) => JSON.parse(JSON.stringify(v));

/**
 * Fusionne l'exercice « Barbell_Hip_Thrust » dans l'exercice perso « Hip thrust ».
 * Ne fait rien (renvoie null) si l'un des deux manque : la migration est donc idempotente.
 * Entrées non modifiées. Renvoie la copie de sauvegarde (avant changement) et les enregistrements à écrire.
 */
export function planHipThrust({ exercises, workouts, sessions, active = null }, from = HT_FROM, to = HT_TO) {
  const src = exercises.find((e) => e.id === from);
  const dst = exercises.find((e) => e.id === to);
  if (!src || !dst) return null;
  const usesFrom = (items) => (items || []).some((it) => it?.exerciseId === from);
  const wk = workouts.filter((w) => usesFrom(w.items));
  const ss = sessions.filter((s) => usesFrom(s.items));
  const act = active && usesFrom(active.items) ? active : null;
  const backup = clone({ exercises: [src, dst], workouts: wk, sessions: ss, active: act });

  const workoutsOut = wk.map((w) => {
    const has = w.items.some((it) => it.exerciseId === to);
    // Déjà présent dans la séance type : on retire le doublon au lieu de le renommer.
    const items = has
      ? w.items.filter((it) => it.exerciseId !== from)
      : w.items.map((it) => (it.exerciseId === from ? { ...clone(it), exerciseId: to } : clone(it)));
    return { ...clone(w), items };
  });
  const moveItems = (items) => items.map((it) => (it.exerciseId === from ? { ...clone(it), exerciseId: to, name: dst.name } : clone(it)));
  const sessionsOut = ss.map((s) => ({ ...clone(s), items: moveItems(s.items) }));
  const activeOut = act ? { ...clone(act), items: moveItems(act.items) } : null;
  return { backup, workouts: workoutsOut, sessions: sessionsOut, active: activeOut, deleteExercise: from };
}

const normName = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();

/**
 * Nouveaux exercices par défaut à ajouter chez un utilisateur existant :
 * seulement ceux dont ni l'identifiant ni le nom (sans accents ni casse) n'existe déjà.
 */
export function missingDefaults(exercises, defaults, ids) {
  const haveId = new Set(exercises.map((e) => e.id));
  const haveName = new Set(exercises.map((e) => normName(e.name)));
  return defaults.filter((d) => ids.includes(d.id) && !haveId.has(d.id) && !haveName.has(normName(d.name))).map(clone);
}

/* ---------- Consignes en français (v2.3) ---------- */
export const EN_PREFIX = '(EN, à reformuler)';
export const CUES_FR = {
  Seated_Leg_Curl: [
    'Règle le dossier : genoux alignés avec l\'axe de la machine.',
    'Boudin sous les mollets, juste au-dessus des chevilles. Cale le boudin des cuisses juste au-dessus des genoux.',
    'Jambes tendues, mains sur les poignées : position de départ.',
    'Expire en ramenant le boudin sous les cuisses, genoux pliés. Buste immobile.',
    'Tiens 1 seconde contracté, puis remonte lentement en inspirant.',
  ].join('\n'),
  Thigh_Abductor: [
    'Assis sur la machine, jambes bien calées contre les coussins, mains sur les poignées.',
    'Haut du corps immobile du début à la fin.',
    'Expire en écartant lentement les jambes.',
    'Tiens 1 seconde, puis reviens doucement en inspirant, sans laisser claquer les charges.',
  ].join('\n'),
  Concentration_Curls: [
    'Assis sur un banc, jambes écartées, pieds au sol, haltère entre les pieds.',
    'Arrière du bras calé contre l\'intérieur de la cuisse, bras tendu, paume vers l\'avant.',
    'Bras immobile : monte l\'haltère vers l\'épaule en expirant. Seul l\'avant-bras bouge.',
    'En haut, petit doigt plus haut que le pouce : serre le biceps 1 seconde.',
    'Redescends lentement en inspirant, sans balancer. Puis change de bras.',
  ].join('\n'),
};

/**
 * Remplace les consignes anglaises connues par leur version française.
 * Seulement si la consigne commence encore par « (EN, à reformuler) » : une consigne déjà réécrite n'est jamais touchée.
 * Renvoie les exercices modifiés (copies) et leurs consignes d'origine (sauvegarde).
 */
export function translateCues(exercises, map = CUES_FR) {
  const changed = [], backup = [];
  for (const e of exercises) {
    if (!map[e.id] || !String(e.cue || '').trim().startsWith(EN_PREFIX)) continue;
    backup.push({ id: e.id, cue: e.cue });
    changed.push({ ...clone(e), cue: map[e.id] });
  }
  return { changed, backup };
}

/* ---------- Carnet de bugs : purge de ce qui est corrigé ---------- */
// Entrées du carnet (champ t = date de création) corrigées dans une version. Retirées au démarrage, copie gardée.
export const FIXED_BUGS = [
  { t: 1794580632073, v: '2.2.0' }, // sauvegarde trop lourde
  { t: 1794402568865, v: '2.2.0' }, // « undo typing » (réglage iOS)
  { t: 1794580341619, v: '2.3.0' }, // mode ressenti
  { t: 1794403261493, v: '2.3.0' }, // unilatéral
  { t: 1794404061919, v: '2.3.0' }, // logo / icône
  { t: 1794403092587, v: '2.3.0' }, // consignes en anglais
  { t: 1794064159827, v: '2.3.0' }, // ajouter / retirer un exercice pendant la séance
  { t: 1794064276987, v: '2.3.0' }, // chrono plus gros, plus de « Fin de séance » pendant le repos
  { t: 1794401708050, v: '2.3.0' }, // passer au prochain exercice pendant le dernier repos
  { t: 1794580497886, v: '2.3.0' }, // modifier la consigne pendant la séance
  { t: 1794404054729, v: '2.3.0' }, // renommer en YeahBuddy
];

/** Sépare le carnet en entrées gardées et entrées corrigées (copies, liste d'entrée non modifiée). */
export function purgeFixedBugs(list, fixed = FIXED_BUGS) {
  const done = new Map(fixed.map((f) => [f.t, f.v]));
  const keep = [], removed = [];
  for (const b of Array.isArray(list) ? list : []) (done.has(b?.t) ? removed : keep).push(done.has(b?.t) ? { ...clone(b), fixedIn: done.get(b.t) } : clone(b));
  return { keep, removed };
}

/* ---------- Haltères : poids saisi par haltère (v2.3) ---------- */
export const PAIR_FLAG = 'mig-pair';
export const PAIR_IDS = ['Incline_Dumbbell_Press', 'Dumbbell_Bench_Press', 'Dumbbell_Shoulder_Press', 'Hammer_Curls', 'Side_Lateral_Raise', 'Concentration_Curls'];

/**
 * Marque « aux haltères » (pair: true) les exercices connus et ceux dont le nom contient « haltère ».
 * Seulement si le champ pair n'a jamais été réglé : un choix fait à la main n'est jamais touché.
 * Les poids déjà saisis ne changent pas (ils étaient déjà le poids d'un haltère). Renvoie des copies.
 */
export function planPairs(exercises, ids = PAIR_IDS) {
  return exercises
    .filter((e) => e.pair === undefined && (ids.includes(e.id) || /halt[eè]re/i.test(normName(e.name))))
    .map((e) => ({ ...clone(e), pair: true }));
}

/* ---------- Muscles des exercices perso (v2.3) ---------- */
export const MUSCLES_FLAG = 'mig-muscles';
// Clé : nom sans accents ni casse (les identifiants perso diffèrent d'un téléphone à l'autre).
export const MUSCLES_BY_NAME = {
  'pendulum squat': 'Quadriceps, Fessiers',
  'hip thrust': 'Fessiers, Ischios',
  'developpe couche convergent': 'Pectoraux, Triceps',
  'developpe militaire convergent': 'Épaules, Triceps',
  'tirage haut convergent': 'Dos, Biceps',
  'rowing convergent': 'Dos, Biceps',
  'triceps poulie haute': 'Triceps',
  'abdos machine allonge': 'Abdos',
};

/**
 * Renseigne le champ « muscles » des exercices connus quand il est vide (jamais d'écrasement).
 * Les accents sont ignorés (« Développe » = « Développé »). Renvoie des copies.
 */
export function planMuscles(exercises, map = MUSCLES_BY_NAME) {
  return exercises
    .filter((e) => !String(e.muscles || '').trim() && map[normName(e.name)])
    .map((e) => ({ ...clone(e), muscles: map[normName(e.name)] }));
}
