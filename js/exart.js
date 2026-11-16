// Images d'exercices mini-Johan (fond détouré) et schéma des muscles travaillés.

// Personnages animés (WebP préparés par tools/gif-prep.py) dans img/mascotte/ex/<id>.webp.
// decor : 1 = salle à machines (poulie, miroir), pour machines, poulies et Smith ;
//         2 = salle à baie vitrée (haltères, tapis), pour poids libres et poids du corps.
// glow (facultatif, images fixes seulement) : zones de lueur rouge [x %, y %, rayon %].
// src (facultatif) : réutilise le fichier d'un autre exercice (même machine).
// fit (facultatif, 1 par défaut) : échelle de l'image dans la salle, pour que la tête du personnage
//   ait à peu près la même taille partout (les plans serrés sont réduits, jamais d'agrandissement).
export const EX_ART = {
  Incline_Dumbbell_Press: { decor: 2, fit: 0.7 },
  Barbell_Hip_Thrust: { decor: 2, fit: 0.7 },
  Leverage_Chest_Press: { decor: 1, fit: 0.7 },
  Butterfly: { decor: 1, fit: 0.75 },
  // v2.3 (bank/mascotte/exercices/CORRESPONDANCE.md)
  Leg_Extensions: { decor: 1, fit: 0.75 },
  Thigh_Abductor: { decor: 1, fit: 0.73 },
  Standing_Calf_Raises: { decor: 1 },
  'Wide-Grip_Lat_Pulldown': { decor: 1 },
  Side_Lateral_Raise: { decor: 1 },
  Triceps_Pushdown: { decor: 1 },
  Concentration_Curls: { decor: 2, fit: 0.7 },
  Pullups: { decor: 2 },
  'Barbell_Bench_Press_-_Medium_Grip': { decor: 2, fit: 0.9 },
  Belt_Squat: { decor: 1 },
  Machine_Crunch: { decor: 1 },
  // Exercices perso de Johan (identifiants de son téléphone)
  custom_mw6hkglnchdog: { decor: 1 }, // Pendulum Squat
  custom_mw6hm706zjuhl: { decor: 2, fit: 0.7, src: 'Barbell_Hip_Thrust' }, // Hip thrust
  custom_mwc3nyqh9vvel: { decor: 1, fit: 0.7, src: 'Leverage_Chest_Press' }, // Développé couché convergent
  custom_mwc3obllxirnj: { decor: 1, fit: 0.7 }, // Développé militaire convergent
  custom_mwc3oro6mhl0o: { decor: 1, src: 'Wide-Grip_Lat_Pulldown' }, // Tirage haut convergent
  custom_mwc3p45el78ed: { decor: 1, fit: 0.85 }, // Rowing convergent
  custom_mwc3pgerg6alc: { decor: 1 }, // Triceps poulie haute
  custom_mwc3r8k4gkz8e: { decor: 1 }, // Abdos machine allongé
};

// Repli par nom exact (sans accents ni casse) si l'identifiant n'est pas connu.
const norm = (t) => String(t || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\s+/g, ' ').trim();
const BY_NAME = {
  'pendulum squat': 'custom_mw6hkglnchdog',
  'hip thrust': 'custom_mw6hm706zjuhl',
  'developpe couche convergent': 'custom_mwc3nyqh9vvel',
  'developpe militaire convergent': 'custom_mwc3obllxirnj',
  'tirage haut convergent': 'custom_mwc3oro6mhl0o',
  'rowing convergent': 'custom_mwc3p45el78ed',
  'triceps poulie haute': 'custom_mwc3pgerg6alc',
  'abdos machine allonge': 'custom_mwc3r8k4gkz8e',
  'belt squat': 'Belt_Squat',
  'crunch a la machine': 'Machine_Crunch',
};

/** Clé EX_ART d'un exercice : son identifiant, sinon son nom exact, sinon null. */
export function artKey(ex) {
  if (!ex) return null;
  if (EX_ART[ex.id]) return ex.id;
  return BY_NAME[norm(ex.name)] || null;
}

export const artSrc = (key) => `img/mascotte/ex/${EX_ART[key]?.src || key}.webp`;
export const fitOf = (key) => Math.min(1, Math.max(0.5, Number(EX_ART[key]?.fit) || 1));
export const decorOf = (key) => (EX_ART[key]?.decor === 2 ? 2 : 1);

/** Lueur rouge sur l'image : masquée par la silhouette pour ne colorer que le corps. */
export function glowLayer(id) {
  const a = EX_ART[id];
  if (!a?.glow?.length) return '';
  const bg = a.glow.map(([x, y, r]) => `radial-gradient(circle at ${x}% ${y}%, rgba(255,30,50,1) 0, rgba(255,30,50,.75) ${r * 0.6}%, transparent ${r}%)`).join(',');
  const src = artSrc(id);
  return `<span class="ex-glow" style="background:${bg};-webkit-mask-image:url(${src});mask-image:url(${src})"></span>`;
}

// Noms de muscles (français de l'appli et anglais du catalogue) vers zones du schéma.
const ALIAS = [
  [/pector|chest|poitrine/, ['chest']],
  [/arri[eè]re|rear/, ['rear']],
  [/[ée]paule|shoulder|delto/, ['delt', 'rear']],
  [/biceps/, ['bi']],
  [/triceps/, ['tri']],
  [/avant-bras|forearm/, ['fore']],
  [/abdo|abdominal/, ['abs']],
  [/trap/, ['traps']],
  [/lombaire|lower back/, ['low']],
  [/middle back|dos|lats|dorsa/, ['lats', 'mid']],
  [/fessier|glute/, ['glutes']],
  [/ischio|hamstring/, ['hams']],
  [/quadri|cuisse/, ['quads']],
  [/mollet|calves|calf/, ['calves']],
  [/adduct/, ['add']],
  [/abduct/, ['glutes']],
  [/cou|neck/, ['traps']],
];

export function musclesOf(text) {
  const on = new Set();
  for (const part of String(text || '').toLowerCase().split(/[,;/]+/)) {
    // « Épaules arrière » n'allume que l'arrière de l'épaule.
    if (/arri[eè]re|rear/.test(part)) { on.add('rear'); continue; }
    for (const [re, z] of ALIAS) if (re.test(part)) z.forEach((k) => on.add(k));
  }
  return on;
}

/** Silhouette face + dos ; les zones travaillées passent en rouge. */
export function muscleMap(text, cls = '') {
  const on = musclesOf(text);
  if (!on.size) return '';
  const z = (k, d) => `<path class="${on.has(k) ? 'on' : ''}" d="${d}"/>`;
  const body = (cx, back) => {
    const L = (x) => cx - x, R = (x) => cx + x;
    const rect = (x1, y1, x2, y2) => `M${x1} ${y1}H${x2}V${y2}H${x1}Z`;
    const pair = (a, y1, b, y2) => rect(L(b), y1, L(a), y2) + rect(R(a), y1, R(b), y2);
    let s = `<circle class="base" cx="${cx}" cy="8" r="5.5"/>`;
    s += `<path class="base" d="${rect(L(2.5), 13, R(2.5), 17)}"/>`;
    s += z(back ? 'rear' : 'delt', `M${L(13.5)} 23a4.5 4.5 0 0 1 4.5-5.5H${L(9)}V25H${L(13.5)}Z M${R(13.5)} 23a4.5 4.5 0 0 0-4.5-5.5H${R(9)}V25H${R(13.5)}Z`);
    s += z(back ? 'tri' : 'bi', pair(10, 25.5, 14, 37));
    s += z('fore', pair(10.5, 38, 14.5, 50));
    if (back) {
      s += z('traps', `M${L(8.5)} 17.5L${cx} 14L${R(8.5)} 17.5L${R(4)} 22H${L(4)}Z`);
      s += z('lats', `M${L(8.5)} 18.5H${L(4.5)}V36L${L(7)} 34Z M${R(8.5)} 18.5H${R(4.5)}V36L${R(7)} 34Z`);
      s += z('mid', rect(L(4), 22.5, R(4), 33));
      s += z('low', rect(L(4), 33.5, R(4), 42));
      s += z('glutes', pair(0.4, 42.5, 8.5, 52));
      s += z('hams', pair(0.8, 52.5, 8.5, 74));
      s += z('calves', pair(1.5, 76, 7.5, 94));
    } else {
      s += z('chest', pair(0.4, 18, 8.5, 28.5));
      s += z('abs', rect(L(5), 29, R(5), 43));
      s += `<path class="base" d="${pair(5.4, 29, 8.5, 43)}"/>`;
      s += `<path class="base" d="${rect(L(8.5), 43.5, R(8.5), 50)}"/>`;
      s += z('quads', pair(2.6, 50.5, 8.5, 74));
      s += z('add', pair(0.4, 50.5, 2.2, 66));
      s += `<path class="base" d="${pair(1.5, 76, 7.5, 94)}"/>`;
    }
    s += `<path class="base" d="${pair(1.5, 95, 8, 98)}"/>`;
    return s;
  };
  return `<svg class="mmap ${cls}" viewBox="0 0 70 100" aria-label="Muscles travaillés : ${String(text).replace(/"/g, '')}" role="img">${body(17, false)}${body(53, true)}</svg>`;
}
