// Tests des calculs v2.3. Lancer : node --test tests/v23.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { QUOTES, quoteOfDay, weekProgress, goalWeeks, suggestForMood, balancePct, nextBalanceTier, featured, sparkPoints, weightEquivalent, groupsOf, muscleWeek, levelOf, achievements, achievementTotals, newlyUnlocked, prDetail, GROUPS, REST_TIPS, restTip } from '../js/v23.js';
import { sessionStats, lastTime, previousSetsFor, bestOf, detectPR } from '../js/stats.js';

const H = 3600e3;
const D = 24 * H;
const mon = new Date(2026, 10, 9, 18).getTime(); // lundi 9 novembre 2026, 18 h
const S = (id, start, items, extra = {}) => ({ id, workoutId: 'w', start, end: start + H, items, ...extra });
const I = (exerciseId, sets, name = exerciseId) => ({ exerciseId, name, sets: sets.map(([w, r, side]) => ({ w, r, done: true, ...(side ? { side } : {}) })) });

test('37 citations, une par jour, qui change le lendemain', () => {
  assert.equal(QUOTES.length, 37); // le tableau source compte 37 lignes
  assert.notEqual(quoteOfDay(mon).text, quoteOfDay(mon + D).text);
  assert.equal(quoteOfDay(mon).text, quoteOfDay(mon + 3 * H).text);
  assert.equal(quoteOfDay(mon).text, quoteOfDay(mon + QUOTES.length * D).text);
});

test('objectif de la semaine', () => {
  const ss = [S('a', mon + 26 * H, []), S('b', mon + 5 * D, []), S('c', mon - 3 * D, [])];
  const p = weekProgress(ss, mon + 6 * D);
  assert.equal(p.count, 2);
  assert.deepEqual([...p.days].sort(), [1, 5]);
  assert.equal(p.today, 6);
  assert.equal(goalWeeks(ss, 2), 1);
  assert.equal(goalWeeks(ss, 1), 2);
});

test('suggestion selon le ressenti', () => {
  const last = { sets: [{ w: 50, r: 8 }, { w: 50, r: 6 }], top: { w: 50, r: 8 } };
  assert.deepEqual(suggestForMood(last, 3, 'normal'), { w: 50, r: 8, up: false });
  assert.deepEqual(suggestForMood(last, 3, undefined), { w: 50, r: 8, up: false });
  assert.deepEqual(suggestForMood(last, 3, 'top'), { w: 52.5, r: 8, up: true });
  const full = { sets: [{ w: 50, r: 8 }, { w: 50, r: 8 }], top: { w: 50, r: 8 } };
  assert.deepEqual(suggestForMood(full, 2, 'normal'), { w: 52.5, r: 8, up: true });
  for (const m of ['tired', 'sleep', 'pain']) assert.deepEqual(suggestForMood(full, 2, m), { w: 50, r: 8, up: false });
  assert.equal(suggestForMood(null, 2, 'top'), null);
});

test('unilatéral : équilibre et records par côté', () => {
  assert.equal(balancePct([{ w: 30, r: 10, side: 'L' }, { w: 20, r: 10, side: 'R' }]), 67);
  assert.equal(balancePct([{ w: 30, r: 10, side: 'L' }]), null);
  assert.equal(nextBalanceTier(69), 75);
  assert.equal(nextBalanceTier(100), null);
  const old = S('o', mon - 7 * D, [I('dc', [[40, 10]])]); // bilatéral, avant la v2.3
  const s1 = S('a', mon, [I('dc', [[30, 10, 'L'], [20, 10, 'R']])]);
  const ss = [old, s1];
  assert.deepEqual(lastTime(ss, 'dc', null, 'R').top, { w: 20, r: 10 });
  assert.deepEqual(lastTime(ss, 'dc', null, 'L').top, { w: 30, r: 10 });
  assert.deepEqual(lastTime(ss, 'dc').top, { w: 30, r: 10 });
  const cur = { id: 'c', items: [I('dc', [[22.5, 10, 'R']])] };
  const st = cur.items[0].sets[0];
  // Droite seule : 22,5 bat 20 (le gauche à 30 ne compte pas).
  assert.deepEqual(detectPR(bestOf(previousSetsFor([s1], cur, 'dc', st)), st), ['charge', '1rm']);
  // Avec l'ancienne série bilatérale à 40 kg : pas de record.
  assert.deepEqual(detectPR(bestOf(previousSetsFor(ss, cur, 'dc', st)), st), []);
  // Une paire gauche + droite compte pour une série, le volume compte les deux côtés.
  const stt = sessionStats(s1);
  assert.equal(stt.setCount, 1);
  assert.equal(stt.volume, 500);
});

test('anciennes séances sans côté : comportement inchangé', () => {
  const ss = [S('a', mon, [I('dc', [[80, 8], [80, 6]])])];
  assert.deepEqual(lastTime(ss, 'dc').top, { w: 80, r: 8 });
  assert.equal(sessionStats(ss[0]).setCount, 2);
});

test('exercice phare et courbe', () => {
  const ss = [
    S('1', mon - 40 * D, [I('sq', [[100, 5]]), I('tv', [[50, 10]])]),
    S('2', mon - 10 * D, [I('sq', [[100, 8]]), I('tv', [[60, 10]])]),
    S('3', mon - 3 * D, [I('sq', [[105, 8]])]),
  ];
  const f = featured(ss, mon);
  assert.equal(f.items[0].exerciseId, 'sq');
  assert.deepEqual(f.items[0].best, { w: 105, r: 8 });
  assert.equal(f.items[0].pct, Math.round(((105 * (1 + 8 / 30)) / (100 * (1 + 5 / 30)) - 1) * 100));
  assert.equal(f.top.exerciseId, 'tv');
  assert.equal(f.top.pct, 20);
  assert.equal(sparkPoints([1, 2, 3]).end[0], 94);
  assert.equal(sparkPoints([]), null);
});

test('équivalence de poids', () => {
  assert.equal(weightEquivalent(6200).a, 'un éléphant d\'Afrique');
  assert.equal(weightEquivalent(100), null);
  assert.equal(weightEquivalent(200).a, 'un gorille');
});

test('carte musculaire', () => {
  assert.deepEqual(groupsOf('Pectoraux, Triceps').sort(), [0, 5]);
  assert.deepEqual(groupsOf('Épaules arrière'), [3]);
  assert.deepEqual(groupsOf('Dos, ischios').sort((a, b) => a - b), [1, 8]);
  assert.deepEqual(groupsOf('quadriceps'), [2]);
  const ss = [S('a', mon, [I('dc', [[50, 8], [50, 8], [50, 8]], 'DC'), I('u', [[10, 10, 'L'], [8, 10, 'R']], 'Curl')])];
  const m = muscleWeek(ss, { dc: 'Pectoraux, Triceps', u: 'Biceps' }, new Date(2026, 10, 9).getTime());
  assert.equal(m.counts[0], 3);
  assert.equal(m.counts[4], 1);
  assert.equal(m.sessions, 1);
  assert.deepEqual(m.exercises[0], [{ name: 'DC', sets: 3 }]);
  assert.equal(muscleWeek(ss, {}, new Date(2026, 10, 16).getTime()).sessions, 0);
  assert.equal(GROUPS.length, 14);
  assert.deepEqual([0, 1, 4, 5, 9, 10].map(levelOf), [0, 1, 1, 2, 2, 3]);
});

test('succès et paliers', () => {
  const sat = new Date(2026, 10, 14, 10).getTime();
  const ss = [
    S('a', mon, [I('dc', [[30, 10, 'L'], [23, 10, 'R']])], { mood: 'tired' }),
    S('b', sat, [I('dc', [[1000, 10]])]),
  ];
  const list = achievements(ss, { goal: 2 });
  const get = (id) => list.find((a) => a.id === id);
  assert.equal(get('balance').value, 77);
  assert.equal(get('balance').tier, 3);
  assert.equal(get('balance').text, '77 % → 90 %');
  assert.equal(get('uni').tier, 1);
  assert.equal(get('goal').value, 1);
  assert.equal(get('volume').value, 10.5);
  assert.equal(get('volume').tier, 5); // girafe, hippopotame, rhinocéros, éléphant, tyrannosaure
  assert.equal(get('weekend').value, 1);
  assert.equal(get('tough').value, 1);
  assert.equal(get('faithful:dc').locked, true);
  assert.equal(get('faithful:dc').text, '2 / 10');
  const tot = achievementTotals(list);
  assert.ok(tot.unlocked > 0 && tot.total > tot.unlocked);
  const nu = newlyUnlocked(ss, 'b', { goal: 2 });
  assert.ok(nu.some((x) => x.id === 'weekend'));
  assert.ok(!nu.some((x) => x.id === 'uni'));
  assert.ok(achievements([], {}).every((a) => a.tier === 0));
});

test('libellé des records', () => {
  assert.equal(prDetail({ w: 35, r: 8, side: 'L', pr: ['charge', '1rm'] }, [{ w: 30, r: 10 }]), 'Gauche · nouvelle charge max');
  assert.equal(prDetail({ w: 40, r: 11, pr: ['1rm'] }, [{ w: 40, r: 9 }, { w: 45, r: 5 }]), 'Record de reps à 40 kg (avant : 9)');
});

// ---------- Migration Hip thrust (données copiées de la sauvegarde du 15/11, réduites) ----------
import { readFileSync, existsSync } from 'node:fs';
import { planHipThrust, HT_FROM, HT_TO } from '../js/migrate.js';

const HT_FILE = new URL('../save/appmuscu-sauvegarde-2026-11-15-sans-images.json', import.meta.url);
const skip = !existsSync(HT_FILE) && 'sauvegarde locale absente (save/ non versionné)';
function htData() {
  const d = JSON.parse(readFileSync(HT_FILE, 'utf8'));
  return { exercises: d.exercises, workouts: d.workouts, sessions: d.sessions, active: null };
}

test('migration Hip thrust : historique déplacé, séance type corrigée, copie gardée', { skip }, () => {
  const data = htData();
  const before = JSON.stringify(data);
  const p = planHipThrust(data);
  assert.ok(p);
  assert.equal(JSON.stringify(data), before, 'entrées non modifiées');
  assert.equal(p.deleteExercise, HT_FROM);
  assert.deepEqual(p.backup.exercises.map((e) => e.id), [HT_FROM, HT_TO]);
  assert.equal(p.backup.sessions.length, 1);
  const s = p.sessions.find((x) => x.id === 'mwf0oldi1vf28');
  const it = s.items.find((x) => x.exerciseId === HT_TO);
  assert.equal(it.name, 'Hip thrust');
  assert.deepEqual(it.sets.map((z) => [z.w, z.r]), [[40, 14], [80, 10], [110, 8], [110, 7]]);
  assert.ok(!s.items.some((x) => x.exerciseId === HT_FROM));
  const legs = p.workouts.find((w) => w.id === 'legs');
  assert.equal(legs.items[1].exerciseId, HT_TO);
  assert.equal(legs.items.length, 6);
  // Après application, l'historique du Hip thrust perso contient les 2 séances.
  const sessions = data.sessions.map((x) => p.sessions.find((y) => y.id === x.id) || x);
  assert.equal(sessions.filter((x) => x.items.some((i) => i.exerciseId === HT_TO)).length, 2);
});

test('migration Hip thrust : idempotente et sans effet si un des deux exercices manque', { skip }, () => {
  const data = htData();
  const p = planHipThrust(data);
  const after = { ...data, exercises: data.exercises.filter((e) => e.id !== p.deleteExercise),
    workouts: data.workouts.map((w) => p.workouts.find((y) => y.id === w.id) || w),
    sessions: data.sessions.map((x) => p.sessions.find((y) => y.id === x.id) || x) };
  assert.equal(planHipThrust(after), null);
  assert.equal(planHipThrust({ ...data, exercises: data.exercises.filter((e) => e.id !== HT_TO) }), null);
});

test('migration Hip thrust : doublon retiré si la séance type a déjà le Hip thrust perso', { skip }, () => {
  const data = htData();
  data.workouts = [{ id: 'w', name: 'W', items: [{ exerciseId: HT_FROM, sets: 3 }, { exerciseId: HT_TO, sets: 4 }] }];
  data.active = { items: [{ exerciseId: HT_FROM, name: 'Barbell Hip Thrust', sets: [] }] };
  const p = planHipThrust(data);
  assert.deepEqual(p.workouts[0].items, [{ exerciseId: HT_TO, sets: 4 }]);
  assert.equal(p.active.items[0].exerciseId, HT_TO);
});

test('nouveaux exercices par défaut : pas de doublon par identifiant ni par nom', async () => {
  const { DEFAULT_EXERCISES, NEW_DEFAULTS_V23 } = await import('../js/defaults.js');
  const { missingDefaults } = await import('../js/migrate.js');
  assert.deepEqual(missingDefaults([], DEFAULT_EXERCISES, NEW_DEFAULTS_V23).map((e) => e.id), ['Belt_Squat', 'Machine_Crunch']);
  assert.deepEqual(missingDefaults([{ id: 'custom_x', name: 'Belt Squat' }], DEFAULT_EXERCISES, NEW_DEFAULTS_V23).map((e) => e.id), ['Machine_Crunch']);
  assert.deepEqual(missingDefaults([{ id: 'Machine_Crunch', name: 'Autre' }, { id: 'y', name: 'crunch a la machine' }, { id: 'Belt_Squat' }], DEFAULT_EXERCISES, NEW_DEFAULTS_V23), []);
});

test('removeItemAt : retrait en séance, supersets cohérents, entrée non modifiée', async () => {
  const { removeItemAt } = await import('../js/stats.js');
  const items = [{ exerciseId: 'a', ss: true }, { exerciseId: 'b', ss: false }, { exerciseId: 'c', ss: true }, { exerciseId: 'd', ss: true }, { exerciseId: 'e' }];
  // a-b en superset, on retire b : a n'est plus lié.
  assert.deepEqual(removeItemAt(items, 1).map((x) => [x.exerciseId, !!x.ss]), [['a', false], ['c', true], ['d', true], ['e', false]]);
  // c-d-e en superset, on retire d : c reste lié à e.
  assert.deepEqual(removeItemAt(items, 3).map((x) => [x.exerciseId, !!x.ss]), [['a', true], ['b', false], ['c', true], ['e', false]]);
  // Dernier retiré : le nouveau dernier n'est plus lié.
  assert.deepEqual(removeItemAt(items, 4).map((x) => [x.exerciseId, !!x.ss]), [['a', true], ['b', false], ['c', true], ['d', false]]);
  assert.equal(items.length, 5);
  assert.equal(items[0].ss, true);
});

import { translateCues, purgeFixedBugs, CUES_FR, FIXED_BUGS } from '../js/migrate.js';

test('translateCues : remplace seulement les consignes encore marquées EN', () => {
  const ex = [
    { id: 'Seated_Leg_Curl', cue: '(EN, à reformuler) Adjust the machine...' },
    { id: 'Thigh_Abductor', cue: 'Ma consigne à moi' },
    { id: 'Autre', cue: '(EN, à reformuler) x' },
  ];
  const { changed, backup } = translateCues(ex);
  assert.equal(changed.length, 1);
  assert.equal(changed[0].cue, CUES_FR.Seated_Leg_Curl);
  assert.equal(backup[0].cue, ex[0].cue);
  assert.match(ex[0].cue, /^\(EN/); // entrée non modifiée
  assert.equal(translateCues(changed).changed.length, 0); // idempotent
});

test('purgeFixedBugs : retire les entrées corrigées, garde le reste', () => {
  const list = [{ t: FIXED_BUGS[0].t, text: 'a' }, { t: 1, text: 'b' }];
  const { keep, removed } = purgeFixedBugs(list);
  assert.deepEqual(keep, [{ t: 1, text: 'b' }]);
  assert.equal(removed[0].fixedIn, FIXED_BUGS[0].v);
  assert.equal(list.length, 2);
  assert.deepEqual(purgeFixedBugs(undefined), { keep: [], removed: [] });
});

test('featured : ancienne meilleure série et écart', () => {
  const ss = [S('a', mon - 20 * D, [I('X', [[40, 10], [45, 8]])]), S('b', mon - 10 * D, [I('X', [[50, 8]])]), S('d', mon - 2 * D, [I('X', [[47.5, 8]])]),
    S('c', mon - 3 * D, [I('Y', [[20, 10]])]), S('e', mon - 9 * D, [I('Z', [[30, 10]])]), S('f', mon - 1 * D, [I('Z', [[30, 9]])])];
  const f = featured(ss, mon);
  const g = (id) => f.items.find((e) => e.exerciseId === id);
  assert.deepEqual(g('X').prev, { date: mon - 20 * D, w: 45, r: 8, dw: 5, dr: 0 }); // record le 2e passage, comparé au 1er
  assert.equal(g('Y').n, 1); // une seule séance : « 1re séance, à suivre »
  assert.equal(g('Z').prev, null); // record dès la 1re séance : « à battre »
  assert.equal(g('Z').first, mon - 9 * D);
});

test('restTip : conseil stable pour une même clé, toujours dans la liste', () => {
  assert.equal(restTip(12345), restTip(12345));
  for (let k = 0; k < 30; k++) assert.ok(REST_TIPS.includes(restTip(k)));
});

test('migration haltères : exercices connus et noms « haltère », choix manuel respecté', async () => {
  const { planPairs } = await import('../js/migrate.js');
  const ex = [
    { id: 'Hammer_Curls', name: 'Curl marteau' },
    { id: 'custom_1', name: 'Rowing Haltère' },
    { id: 'custom_2', name: 'Developpe halteres', pair: false },
    { id: 'Barbell_Squat', name: 'Squat' },
  ];
  const out = planPairs(ex);
  assert.deepEqual(out.map((e) => e.id), ['Hammer_Curls', 'custom_1']);
  assert.ok(out.every((e) => e.pair === true));
  assert.equal(ex[0].pair, undefined); // entrée non modifiée
});

import { planMuscles } from '../js/migrate.js';
test('muscles des exercices perso : remplis seulement si vides', () => {
  const ex = [
    { id: 'a', name: 'Développe militaire convergent', muscles: '' },
    { id: 'b', name: 'Rowing convergent', muscles: 'Dos' },
    { id: 'c', name: 'Abdos machine allongé' },
    { id: 'd', name: 'Inconnu', muscles: '' },
  ];
  const out = planMuscles(ex);
  assert.deepEqual(out.map((e) => [e.id, e.muscles]), [['a', 'Épaules, Triceps'], ['c', 'Abdos']]);
  assert.equal(ex[0].muscles, '', 'entrée non modifiée');
});
