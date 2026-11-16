// Calculs purs de la v2.3 (citation, objectif, exercice phare, équilibre, carte musculaire, succès).
// Aucun accès au DOM ni à la base. Testés par tests/v23.test.mjs.
import { epley, doneSets, countSets, weekStart, round1, suggestNext, bestOf, sessionVolume } from './stats.js';
import { musclesOf } from './exart.js';

const DAY = 864e5;

// ---------- Citations (bank/contenu-motivation-v2.3.md, 36 citations sourcées) ----------
export const QUOTES = [
  ['Passer la barrière de la douleur, c\'est ce qui fait grandir les muscles.', 'Arnold Schwarzenegger', 'The Guardian, 2009'],
  ['La force ne vient pas de la victoire.', 'Arnold Schwarzenegger', 'Boston Globe, 1982'],
  ['On ne grimpe pas l\'échelle du succès les mains dans les poches.', 'Arnold Schwarzenegger', 'Discours USC, 2009'],
  ['N\'aie pas peur de l\'échec : de quelle hauteur peux-tu vraiment tomber ?', 'Arnold Schwarzenegger', 'Reddit AMA, 2015'],
  ['Dans ma façon de penser, on vise toujours le sommet.', 'Arnold Schwarzenegger', '60 Minutes (CBS), 2004'],
  ['Souffre maintenant, et vis le reste de ta vie en champion.', 'Muhammad Ali', 'Newsweek, 1978'],
  ['Ma volonté a été mise à l\'épreuve, mon courage aussi, ma force aussi.', 'Muhammad Ali', 'The Soul of a Butterfly, 2004'],
  ['Je n\'avais jamais pensé perdre. Maintenant que c\'est arrivé, il faut bien le faire.', 'Muhammad Ali', 'Déclaration 1973 (NBC News, 2016)'],
  ['J\'accepte l\'échec. Je n\'accepte pas de ne pas essayer.', 'Michael Jordan', 'Livre, 1994'],
  ['J\'ai échoué encore et encore. Et c\'est pour ça que je réussis.', 'Michael Jordan', 'Nike Culture, 1998'],
  ['Les limites, comme les peurs, ne sont souvent qu\'une illusion.', 'Michael Jordan', 'Hall of Fame, 2009'],
  ['Je me fixais un objectif raisonnable, réalisable si je travaillais assez dur.', 'Michael Jordan', 'How to be like Mike, 2005'],
  ['Il n\'y a pas de formule secrète. Je soulève lourd, je bosse dur.', 'Ronnie Coleman', 'Herald Sun, 2006'],
  ['On ne peut pas faire ça sans dévouement, détermination et une foi solide.', 'Ronnie Coleman', 'Dallas Morning News, 1999'],
  ['Seuls les gens disciplinés sont libres dans la vie.', 'Eliud Kipchoge', 'Oxford Union, 2018'],
  ['La résilience est l\'une des recettes du succès.', 'Eliud Kipchoge', 'ClickOrlando, 2023'],
  ['Aucun humain n\'a de limite.', 'Eliud Kipchoge', 'South China Morning Post, 2019'],
  ['Je déteste perdre plus que j\'aime gagner.', 'Larry Bird', 'Christian Science Monitor, 1998'],
  ['On joue comme on s\'entraîne.', 'Larry Bird', 'The Journal Gazette, 2000'],
  ['J\'y ai travaillé si dur parce que j\'y prenais tant de plaisir.', 'Larry Bird', 'Chicago Tribune, 1991'],
  ['Sans mental ni préparation chaque soir, tu ne gagneras pas.', 'Larry Bird', 'Chicago Tribune, 1998'],
  ['Je jouais parce que j\'étais dévoué à l\'idée d\'être le meilleur.', 'Bill Russell', 'Sports Illustrated, 1969'],
  ['Tout le monde a des plans, jusqu\'au premier coup reçu.', 'Mike Tyson', 'Associated Press, 1987'],
  ['Les combats qui comptent sont ceux qu\'on mène contre soi-même.', 'Jesse Owens', 'Blackthink, 1970'],
  ['La seule victoire qui compte est celle sur soi-même.', 'Jesse Owens', 'T. Gentry, 1990'],
  ['Tout va si vite. C\'est le caractère qui fait la différence quand c\'est serré.', 'Jesse Owens', 'T. Gentry, 1990'],
  ['Rêve aussi grand que possible, et tout devient possible.', 'Michael Phelps', 'Sports Illustrated / AP, 2008'],
  ['N\'importe qui peut accomplir n\'importe quoi s\'il s\'y engage.', 'Michael Phelps', 'CNN, 2008'],
  ['Fais chaque jour au moins un pas précis vers ton objectif.', 'Bruce Lee', 'Jeet Kune Do, 1997'],
  ['Il n\'y a pas de limites, seulement des plateaux. Il faut les dépasser.', 'Bruce Lee', 'The Art of Expressing the Human Body, 1998'],
  ['L\'eau courante ne croupit jamais. Il faut continuer à couler.', 'Bruce Lee', 'The Warrior Within, 1996'],
  ['Mon père nous a appris qu\'il faut travailler deux fois plus et ne jamais abandonner.', 'Zinedine Zidane', 'The Guardian, 2004'],
  ['J\'ai besoin de jouer intensément chaque jour, de me battre à chaque match.', 'Zinedine Zidane', 'The Guardian, 2004'],
  ['Travailler chaque jour avec humilité pour devenir meilleur qu\'avant.', 'Rafael Nadal', 'Wimbledon.org, 2010'],
  ['Nous ne voulons pas raconter nos rêves, nous voulons les montrer.', 'Cristiano Ronaldo', 'Twitter, 2012'],
  ['On passe des années sans gagner. Pas grave, tant qu\'on continue à progresser.', 'Tiger Woods', 'PGA.com, 2003'],
  ['Il n\'y a pas de raccourci vers le succès, sur le terrain comme dans la vie.', 'Tom Brady', 'Instagram, 2022'],
];

/** Numéro du jour local (change à minuit, heure locale). */
export function dayIndex(t) {
  const d = new Date(t);
  return Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / DAY);
}

/** Citation du jour : { text, author, source }. Change chaque jour, tourne sur la liste. */
export function quoteOfDay(t = Date.now()) {
  const [text, author, source] = QUOTES[((dayIndex(t) % QUOTES.length) + QUOTES.length) % QUOTES.length];
  return { text, author, source };
}

// ---------- Objectif de la semaine ----------
/**
 * Semaine contenant t : { count (séances terminées), days (Set 0 = lundi … 6 = dimanche), today (0-6) }.
 */
export function weekProgress(sessions, t = Date.now()) {
  const ws = weekStart(t);
  const we = weekStart(ws + 8 * DAY);
  const days = new Set();
  let count = 0;
  for (const s of sessions) {
    if (!s.end || s.start < ws || s.start >= we) continue;
    count++;
    days.add((new Date(s.start).getDay() + 6) % 7);
  }
  return { count, days, today: (new Date(t).getDay() + 6) % 7 };
}

/** Semaines (lundi) où l'objectif est atteint. L'objectif actuel s'applique à tout l'historique. */
export function goalWeeks(sessions, goal) {
  const n = new Map();
  for (const s of sessions) if (s.end) { const w = weekStart(s.start); n.set(w, (n.get(w) || 0) + 1); }
  let k = 0;
  for (const v of n.values()) if (v >= goal) k++;
  return k;
}

// ---------- Ressenti (v2.3) ----------
export const MOODS = [
  { id: 'top', label: 'En forme', sub: 'Charges suggérées en hausse' },
  { id: 'normal', label: 'Normal', sub: 'Suggestion habituelle' },
  { id: 'tired', label: 'Fatigué', sub: 'Mêmes charges que la dernière fois' },
  { id: 'sleep', label: 'Mauvaise nuit', sub: 'Mêmes charges que la dernière fois' },
  { id: 'pain', label: 'Douleur', sub: 'Charges de la dernière fois, pas de record visé' },
];
export const moodLabel = (id) => MOODS.find((m) => m.id === id)?.label || '';

/**
 * Suggestion selon le ressenti. Sans ressenti (séances d'avant la v2.3) ou « Normal » : règle habituelle.
 * « En forme » : hausse proposée même si la dernière séance n'était pas complète.
 * « Fatigué », « Mauvaise nuit », « Douleur » : meilleure série de la dernière fois, sans hausse.
 */
export function suggestForMood(last, plannedSets, mood, step = 2.5) {
  const base = suggestNext(last, plannedSets, step);
  if (!base) return null;
  if (mood === 'top' && !base.up) {
    const t = last.top;
    return t.w === 0 ? { w: 0, r: t.r + 1, up: true } : { w: round1(t.w + step), r: t.r, up: true };
  }
  if (mood === 'tired' || mood === 'sleep' || mood === 'pain') return { w: last.top.w, r: last.top.r, up: false };
  return base;
}

// ---------- Unilatéral ----------
/** Meilleur 1RM estimé d'une liste de séries pour un côté. */
export function sideE1rm(sets, side) {
  let m = 0;
  for (const s of sets) if (s.side === side) m = Math.max(m, epley(s.w, s.r));
  return m;
}

/** Équilibre droite / gauche en % (1RM estimé droite ÷ gauche), ou null si un côté manque. */
export function balancePct(sets) {
  const L = sideE1rm(sets, 'L'), R = sideE1rm(sets, 'R');
  if (!(L > 0) || !(R > 0)) return null;
  return Math.round((R / L) * 100);
}

export const BALANCE_TIERS = [50, 60, 75, 90, 100];
export const nextBalanceTier = (pct) => BALANCE_TIERS.find((t) => t > (pct ?? 0)) ?? null;

/** Meilleur équilibre atteint sur une séance (max sur ses exercices unilatéraux). */
export function sessionBalance(session) {
  let best = null;
  for (const it of session.items || []) {
    const b = balancePct(it.sets.filter((s) => s.done && !s.warm && !s.skip));
    if (b != null && (best == null || b > best)) best = b;
  }
  return best;
}

export const isUniSession = (s) => (s.items || []).some((it) => it.sets.some((x) => x.done && x.side));

// ---------- Exercice phare ----------
/**
 * Exercices les plus pratiqués sur les 8 dernières semaines (max n), avec meilleure série,
 * évolution du 1RM estimé (4 dernières semaines contre les 4 précédentes) et points de courbe.
 */
export function featured(sessions, now = Date.now(), n = 5) {
  const from = now - 56 * DAY, mid = now - 28 * DAY;
  const byEx = new Map();
  const done = sessions.filter((s) => s.end && s.start >= from).sort((a, b) => a.start - b.start);
  for (const s of done) {
    for (const it of s.items || []) {
      const sets = it.sets.filter((x) => x.done && !x.warm && !x.skip && x.side !== 'R');
      if (!sets.length) continue;
      let e = byEx.get(it.exerciseId);
      if (!e) byEx.set(it.exerciseId, (e = { exerciseId: it.exerciseId, name: it.name, sessions: 0, best: null, recent: 0, before: 0, pts: [], hist: [] }));
      e.sessions++;
      e.name = it.name;
      let top = 0, sw = 0, sr = 0;
      for (const x of sets) {
        if (x.w > sw || (x.w === sw && x.r > sr)) { sw = x.w; sr = x.r; }
        const v = epley(x.w, x.r);
        top = Math.max(top, v);
        if (!e.best || x.w > e.best.w || (x.w === e.best.w && x.r > e.best.r)) e.best = { w: x.w, r: x.r };
      }
      if (s.start >= mid) e.recent = Math.max(e.recent, top); else e.before = Math.max(e.before, top);
      e.pts.push(round1(top));
      e.hist.push({ date: s.start, w: sw, r: sr });
    }
  }
  const list = [...byEx.values()].map((e) => ({
    exerciseId: e.exerciseId, name: e.name, sessions: e.sessions, best: e.best, pts: e.pts,
    ...beforeBest(e.hist),
    pct: e.before > 0 && e.recent > 0 ? Math.round(((e.recent - e.before) / e.before) * 100) : null,
  }));
  list.sort((a, b) => b.sessions - a.sessions || a.name.localeCompare(b.name));
  const withPct = list.filter((e) => e.pct != null).sort((a, b) => b.pct - a.pct);
  return { items: list.slice(0, n), top: withPct[0] && withPct[0].pct > 0 ? withPct[0] : null };
}

/**
 * Ancienne meilleure série : la meilleure des séances AVANT celle du record actuel (8 semaines).
 * prev = { date, w, r, dw, dr } (écart toujours positif), null si le record date de la 1re séance.
 * first = date de la 1re séance, n = nombre de séances.
 */
export function beforeBest(hist) {
  const better = (a, b) => a.w > b.w || (a.w === b.w && a.r > b.r);
  let bi = 0;
  hist.forEach((h, i) => { if (better(h, hist[bi])) bi = i; });
  let p = null;
  for (const h of hist.slice(0, bi)) if (!p || better(h, p)) p = h;
  const b = hist[bi];
  return { n: hist.length, first: hist[0]?.date ?? null, prev: p && b ? { date: p.date, w: p.w, r: p.r, dw: round1(b.w - p.w), dr: b.r - p.r } : null };
}

/** Points d'une polyligne SVG (w × h, marge 2 et 8 en haut) ; renvoie { points, end:[x,y] }. */
export function sparkPoints(vals, w = 96, h = 48) {
  if (!vals.length) return null;
  const v = vals.length === 1 ? [vals[0], vals[0]] : vals;
  const lo = Math.min(...v), hi = Math.max(...v);
  const xy = v.map((y, i) => [round1(2 + (i * (w - 4)) / (v.length - 1)), round1(hi === lo ? h / 2 : h - 6 - ((y - lo) * (h - 16)) / (hi - lo))]);
  return { points: xy.map((p) => p.join(',')).join(' '), end: xy[xy.length - 1] };
}

// ---------- Volume : équivalences (valeurs au statut V de bank/contenu-motivation-v2.3.md) ----------
export const WEIGHTS = [
  { t: 0.18, a: 'un gorille', d: 'un gorille mâle pèse de 136 à 227 kg' },
  { t: 0.55, a: 'un ours polaire', d: 'un ours polaire mâle pèse de 300 à 800 kg' },
  { t: 0.88, a: 'une Smart fortwo', d: 'une Smart fortwo pèse environ 0,88 t à vide' },
  { t: 1.15, a: 'une Renault Clio 5', d: 'une Clio 5 pèse environ 1,15 t à vide' },
  { t: 1.19, a: 'une girafe', d: 'une girafe mâle pèse environ 1,19 t' },
  { t: 1.48, a: 'un hippopotame', d: 'un hippopotame mâle pèse environ 1,48 t' },
  { t: 2.15, a: 'un rhinocéros blanc', d: 'un rhinocéros blanc mâle pèse de 2 à 2,3 t' },
  { t: 6, a: 'un éléphant d\'Afrique', d: 'un éléphant mâle adulte pèse environ 6 t' },
  { t: 6.5, a: 'un tyrannosaure', d: 'un tyrannosaure adulte pesait de 5,4 à 8 t' },
  { t: 19, a: 'un bus de 12 m', d: 'un bus Citaro de 12 m pèse 19 t en charge' },
  { t: 36, a: 'un conteneur plein', d: 'un conteneur maritime de 6 m plein pèse jusqu\'à 36 t' },
  { t: 44, a: 'un semi-remorque', d: 'un semi-remorque pèse au plus 44 t en France' },
  { t: 57, a: 'un char Leclerc', d: 'un char Leclerc pèse environ 57 t au combat' },
  { t: 110, a: 'une baleine bleue', d: 'une baleine bleue pèse environ 110 t' },
  { t: 225, a: 'la statue de la Liberté', d: 'la statue de la Liberté pèse environ 225 t' },
  { t: 390, a: 'une rame de TGV Duplex', d: 'une rame de TGV Duplex pèse environ 390 t' },
  { t: 397, a: 'un Boeing 747-400', d: 'un Boeing 747-400 pèse 397 t au décollage maximal' },
  { t: 420, a: 'la Station spatiale internationale', d: 'l\'ISS pèse environ 420 t' },
  { t: 575, a: 'un Airbus A380', d: 'un A380 pèse 575 t au décollage maximal' },
  { t: 10100, a: 'la tour Eiffel', d: 'la tour Eiffel pèse environ 10 100 t' },
];

/** Équivalence d'un volume en kg : le plus gros repère qui ne dépasse pas le volume, ou null. */
export function weightEquivalent(kg) {
  const t = kg / 1000;
  let best = null;
  for (const x of WEIGHTS) if (x.t <= t) best = x;
  return best;
}

export const fmtT = (kg) => String(round1(kg / 1000)).replace('.', ',');

// ---------- Carte musculaire ----------
export const GROUPS = ['Pectoraux', 'Dorsaux', 'Quadriceps', 'Deltoïdes', 'Biceps', 'Triceps', 'Trapèzes', 'Avant-bras', 'Ischios', 'Fessiers', 'Lombaires', 'Adducteurs', 'Abdos', 'Mollets'];
const ZONE_GROUP = { chest: 0, lats: 1, mid: 1, quads: 2, delt: 3, rear: 3, bi: 4, tri: 5, traps: 6, fore: 7, hams: 8, glutes: 9, low: 10, add: 11, abs: 12, calves: 13 };

/** Groupes (indices de GROUPS) travaillés d'après le champ « muscles » d'un exercice. */
export function groupsOf(muscles) {
  const g = new Set();
  for (const z of musclesOf(muscles)) if (z in ZONE_GROUP) g.add(ZONE_GROUP[z]);
  return [...g];
}

/**
 * Séries de travail par groupe musculaire sur la semaine qui commence à ws.
 * Chaque série compte pour 1 dans chaque groupe listé par l'exercice ; une paire gauche + droite compte 1.
 * Renvoie { counts:[14], exercises:[14 × [{name, sets}]], sessions }.
 */
export function muscleWeek(sessions, musclesById, ws) {
  const we = weekStart(ws + 8 * DAY);
  const counts = GROUPS.map(() => 0);
  const ex = GROUPS.map(() => new Map());
  let n = 0;
  for (const s of sessions) {
    if (!s.end || s.start < ws || s.start >= we) continue;
    n++;
    for (const it of s.items || []) {
      const k = countSets(doneSets({ items: [it] }));
      if (!k) continue;
      for (const g of groupsOf(musclesById[it.exerciseId] ?? '')) {
        counts[g] += k;
        ex[g].set(it.name, (ex[g].get(it.name) || 0) + k);
      }
    }
  }
  return { counts, exercises: ex.map((m) => [...m].map(([name, sets]) => ({ name, sets }))), sessions: n };
}

/** Niveau de couleur : 0 (aucune série), 1 (1 à 4), 2 (5 à 9), 3 (10 et plus). */
export const levelOf = (n) => (n >= 10 ? 3 : n >= 5 ? 2 : n >= 1 ? 1 : 0);

// ---------- Succès ----------
const VOL_TIERS = WEIGHTS.filter((x) => x.t >= 1.19);
const tier = (v, tiers) => tiers.filter((t) => v >= t).length;

/**
 * Liste des succès et paliers. Chaque entrée : { id, name, tier, max, value, next, text, pct, locked }.
 * opts : { goal, musclesById? }.
 */
export function achievements(sessions, opts = {}) {
  const goal = opts.goal || 3;
  const done = sessions.filter((s) => s.end);
  const out = [];
  const add = (id, name, value, tiers, fmt, extra = {}) => {
    const t = tier(value, tiers);
    const next = tiers[t] ?? null;
    const prevT = t ? tiers[t - 1] : 0;
    out.push({
      id, name, tier: t, max: tiers.length, value, next,
      text: fmt(value, next, prevT),
      pct: next == null ? 100 : Math.max(0, Math.min(100, Math.round(((value - prevT) / (next - prevT)) * 100))),
      locked: t === 0, tiers, ...extra,
    });
    const a = out[out.length - 1];
    // Ce qu'il faut faire pour le prochain palier, affiché sous le nom.
    a.hint = a.desc ? (next == null ? 'Tous les paliers débloqués' : `Prochain palier : ${a.desc(t + 1).replace(/^./, (c) => c.toLowerCase())}`) : '';
  };
  const n = (v) => String(v).replace('.', ',');
  const frac = (unit) => (v, next) => (next == null ? `${n(v)} ${unit}` : `${n(v)} / ${n(next)} ${unit}`).trim();

  let bal = 0;
  for (const s of done) bal = Math.max(bal, sessionBalance(s) ?? 0);
  add('balance', 'Équilibre', bal, BALANCE_TIERS, (v, next) => (next == null ? `${v} %` : `${v} % → ${next} %`), { desc: (t) => `Côté droit à ${BALANCE_TIERS[t - 1]} % du gauche`, how: 'Sur un exercice en mode unilatéral, le volume (poids × reps) de ton côté droit comparé au côté gauche. Ta meilleure séance compte.' });

  add('uni', 'Bras droit', done.filter(isUniSession).length, [1, 3, 6, 10, 25, 50], frac('séances'), { desc: (t) => `${[1, 3, 6, 10, 25, 50][t - 1]} séances en unilatéral`, how: 'Séances terminées avec au moins un exercice fait en mode unilatéral (gauche / droite).' });

  const gw = goalWeeks(done, goal);
  add('goal', 'Objectif tenu', gw, [1, 3, 6, 12, 26, 52], frac('semaines'), { desc: (t) => `Objectif tenu ${[1, 3, 6, 12, 26, 52][t - 1]} semaines`, how: `Semaines (lundi à dimanche) où tu as fait au moins ${goal} séances, ton objectif de la semaine.` });

  const vol = round1(done.reduce((a, s) => a + sessionVolume(s), 0) / 1000);
  add('volume', 'Volume cumulé', vol, VOL_TIERS.map((x) => x.t), (v, next) => {
    const nx = VOL_TIERS.find((x) => x.t === next);
    return next == null ? `${n(Math.floor(v))} t` : `${n(Math.floor(v))} / ${n(next)} t (${nx.a.replace(/^(un|une|la|le) /, '')})`;
  }, { desc: (t) => `L'équivalent ${VOL_TIERS[t - 1].a.replace(/^une? /, (m) => `d'${m}`).replace(/^le /, 'du ').replace(/^(?!d'|du )/, 'de ')}`, how: 'Total des kilos soulevés (poids × reps des séries validées) depuis le début, échauffement exclu.' });

  const we = done.filter((s) => [0, 6].includes(new Date(s.start).getDay())).length;
  add('weekend', 'Guerrier du week-end', we, [1, 5, 10, 25, 50], (v, next) => (next == null ? `${v}` : `${v} / ${next}`), { desc: (t) => `${[1, 5, 10, 25, 50][t - 1]} séances le week-end`, how: 'Séances terminées un samedi ou un dimanche.' });

  const tough = done.filter((s) => s.mood === 'tired' || s.mood === 'sleep').length;
  add('tough', 'Présent quand même', tough, [1, 3, 10, 25], (v, next) => (next == null ? `${v}` : `${v} / ${next}`), { desc: (t) => `${[1, 3, 10, 25][t - 1]} séances fatigué ou après une mauvaise nuit`, how: 'Séances terminées alors que tu avais choisi « fatigué » ou « mauvaise nuit » dans le ressenti avant séance.' });

  // Fidèle : les 3 exercices les plus pratiqués.
  const cnt = new Map();
  for (const s of done) for (const it of s.items || []) if (doneSets({ items: [it] }).length) {
    const c = cnt.get(it.exerciseId) || { name: it.name, n: 0 };
    c.n++; c.name = it.name; cnt.set(it.exerciseId, c);
  }
  [...cnt.entries()].sort((a, b) => b[1].n - a[1].n || a[1].name.localeCompare(b[1].name)).slice(0, 3).forEach(([id, c]) => {
    add(`faithful:${id}`, `Fidèle · ${c.name}`, c.n, [10, 25, 50, 100], (v, next) => (next == null ? `${v}` : `${v} / ${next}`), { desc: (t) => `${[10, 25, 50, 100][t - 1]} séances de ${c.name}`, how: `Séances où tu as validé au moins une série de ${c.name}. Concerne tes 3 exercices les plus pratiqués.` });
  });
  return out;
}

/** Paliers débloqués et total. */
export function achievementTotals(list) {
  return { unlocked: list.reduce((a, x) => a + x.tier, 0), total: list.reduce((a, x) => a + x.max, 0) };
}

/** Paliers débloqués par la séance id : compare l'historique sans elle et avec elle. */
export function newlyUnlocked(sessions, id, opts) {
  const before = new Map(achievements(sessions.filter((s) => s.id !== id), opts).map((a) => [a.id, a.tier]));
  return achievements(sessions, opts)
    .filter((a) => a.tier > (before.get(a.id) || 0))
    .map((a) => ({ id: a.id, name: a.name, tier: a.tier, desc: a.desc ? a.desc(a.tier) : '' }));
}

// ---------- Records : texte détaillé pour le récap ----------
/**
 * Libellé d'un record. prevSets : séries de référence (même côté) avant la série.
 */
export function prDetail(set, prevSets) {
  const t = prText(set, prevSets);
  return t.charAt(0).toUpperCase() + t.slice(1);
}
function prText(set, prevSets) {
  const side = set.side === 'L' ? 'Gauche · ' : set.side === 'R' ? 'Droite · ' : '';
  const pr = set.pr || [];
  if (pr.includes('charge')) return `${side}nouvelle charge max`;
  if (pr.includes('reps')) return `${side}record de reps au poids du corps`;
  const same = prevSets.filter((x) => x.w === set.w);
  if (same.length) return `${side}record de reps à ${String(set.w).replace('.', ',')} kg (avant : ${Math.max(...same.map((x) => x.r))})`;
  const b = bestOf(prevSets);
  return `${side}nouveau 1RM estimé${b.maxE1rm ? ` (avant : ${String(round1(b.maxE1rm)).replace('.', ',')} kg)` : ''}`;
}

// ---------- Conseils affichés pendant le repos (un par repos, il change au suivant) ----------
export const REST_TIPS = [
  'Respire profondément par le nez, souffle lentement : le cœur redescend plus vite.',
  'Bois une gorgée d\'eau.',
  'Relâche les épaules et secoue les bras, sans t\'étirer fort entre deux séries.',
  'Visualise la prochaine série : placement, trajet de la barre, respiration.',
  'Entre deux séries, garde la nuque neutre et les épaules basses : pas de tension inutile.',
  'Garde le même tempo à chaque rep : 2 secondes à la descente, contrôle en bas.',
  'Une rep propre vaut mieux qu\'une rep de plus avec une mauvaise forme.',
  'Reste debout et marche un peu plutôt que de t\'asseoir sur le téléphone.',
  'Prépare ta charge maintenant pour repartir dès la fin du chrono.',
  'Sur la dernière série, tu peux viser 1 ou 2 reps de réserve, pas l\'échec à chaque fois.',
  'Serre la sangle abdominale avant de lancer la première rep.',
  'Si la charge te semble trop facile, monte la prochaine fois : c\'est la progression qui compte.',
];

/** Conseil du repos en cours : stable pendant un repos (même clé), différent au repos suivant. */
export const restTip = (key) => REST_TIPS[Math.abs(Math.floor(Number(key) || 0)) % REST_TIPS.length];
