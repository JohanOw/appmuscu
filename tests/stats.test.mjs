// Tests des calculs. Lancer : node --test tests/stats.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { epley, bestOf, detectPR, lastTime, sessionStats, exerciseSeries, nextWorkout, parseNum, previousSetsFor, suggestNext, trainedDays, warmupWeight, supersetGroup, supersetLabels, weekStreak, weekStart } from '../js/stats.js';

const S = (id, start, sets, workoutId = 'push') => ({
  id, workoutId, start, end: start + 3600e3,
  items: [{ exerciseId: 'bench', name: 'Développé couché', sets: sets.map(([w, r]) => ({ w, r, done: true })) }],
});

test('Epley', () => {
  assert.equal(epley(100, 1), 100);
  assert.equal(epley(80, 8), 80 * (1 + 8 / 30));
  assert.equal(epley(0, 10), 0);
});

test('parseNum accepte la virgule', () => {
  assert.equal(parseNum('82,5'), 82.5);
  assert.ok(Number.isNaN(parseNum('')));
});

test('pas de record au premier passage', () => {
  assert.deepEqual(detectPR(bestOf([]), { w: 100, r: 5 }), []);
});

test('record de charge et de 1RM', () => {
  const prev = bestOf([{ w: 80, r: 8 }]);
  assert.deepEqual(detectPR(prev, { w: 85, r: 5 }), ['charge']); // 85*1.1667=99.2 < 80*1.2667=101.3
  assert.deepEqual(detectPR(prev, { w: 80, r: 10 }), ['1rm']);
  assert.deepEqual(detectPR(prev, { w: 90, r: 8 }), ['charge', '1rm']);
  assert.deepEqual(detectPR(prev, { w: 80, r: 8 }), []);
});

test('record de reps au poids du corps', () => {
  assert.deepEqual(detectPR(bestOf([{ w: 0, r: 8 }]), { w: 0, r: 9 }), ['reps']);
});

test('dernière fois et séries', () => {
  const sessions = [S('a', 1000, [[70, 10]]), S('b', 5000, [[80, 8], [80, 6]])];
  assert.deepEqual(lastTime(sessions, 'bench').top, { w: 80, r: 8 });
  assert.equal(lastTime(sessions, 'bench', 'b').top.w, 70);
  assert.equal(lastTime(sessions, 'squat'), null);
  const series = exerciseSeries(sessions, 'bench');
  assert.equal(series.length, 2);
  assert.equal(series[1].volume, 80 * 8 + 80 * 6);
});

test('historique inclut la séance en cours sauf la série testée', () => {
  const cur = { id: 'c', start: 9000, end: null, items: [{ exerciseId: 'bench', sets: [{ w: 90, r: 3, done: true }, { w: 95, r: 1, done: true }] }] };
  const prev = previousSetsFor([S('a', 1000, [[80, 8]])], cur, 'bench', cur.items[0].sets[1]);
  assert.equal(prev.length, 2);
});

test('récap de séance', () => {
  const s = S('a', 0, [[100, 5], [100, 5]]);
  s.items[0].sets.push({ w: 120, r: 5, done: false });
  const st = sessionStats(s);
  assert.equal(st.volume, 1000);
  assert.equal(st.setCount, 2);
  assert.equal(st.durationMs, 3600e3);
});

test('séance suivante en rotation', () => {
  const w = [{ id: 'push' }, { id: 'pull' }, { id: 'legs' }];
  assert.equal(nextWorkout(w, []).id, 'push');
  assert.equal(nextWorkout(w, [S('a', 1, [[1, 1]], 'pull')]).id, 'legs');
  assert.equal(nextWorkout(w, [S('a', 1, [[1, 1]], 'legs')]).id, 'push');
});

test('suggestion de progression', () => {
  const L = (sets) => ({ date: 0, sets: sets.map(([w, r]) => ({ w, r })), top: sets.reduce((a, b) => (b[0] > a[0] || (b[0] === a[0] && b[1] > a[1]) ? b : a)) });
  const fix = (l) => ({ ...l, top: { w: l.top[0], r: l.top[1] } });
  assert.equal(suggestNext(null, 3), null);
  // 3 séries prévues, 3 faites à 80 kg : +2,5 kg, reps = la plus basse
  assert.deepEqual(suggestNext(fix(L([[80, 8], [80, 8], [80, 7]])), 3), { w: 82.5, r: 7, up: true });
  // une série manquante : on refait la meilleure
  assert.deepEqual(suggestNext(fix(L([[80, 8], [80, 8]])), 3), { w: 80, r: 8, up: false });
  // une série plus légère : pas de hausse
  assert.deepEqual(suggestNext(fix(L([[80, 8], [80, 8], [70, 10]])), 3), { w: 80, r: 8, up: false });
  // poids du corps : +1 rep
  assert.deepEqual(suggestNext(fix(L([[0, 10], [0, 9]])), 2), { w: 0, r: 10, up: true });
});

test('jours entraînés', () => {
  const d = new Date(2026, 10, 6, 18, 30).getTime();
  const days = trainedDays([S('a', d, [[1, 1]]), { id: 'x', start: d, end: null, items: [] }]);
  assert.deepEqual([...days], ['2026-11-06']);
});

test('échauffement exclu du volume, des records et de la dernière fois', () => {
  const s = { id: 'w', start: 0, end: 1, workoutId: 'x', items: [{ exerciseId: 'e', sets: [
    { w: 60, r: 12, done: true, warm: true }, { w: 100, r: 8, done: true }] }] };
  assert.equal(sessionStats(s).volume, 800);
  assert.equal(sessionStats(s).setCount, 1);
  assert.deepEqual(lastTime([s], 'e').sets, [{ w: 100, r: 8 }]);
  assert.equal(bestOf(previousSetsFor([s], null, 'e')).count, 1);
});

test("charge d'échauffement", () => {
  assert.equal(warmupWeight(100, 60), 60);
  assert.equal(warmupWeight(82.5, 60), 47.5); // 49,5 arrondi au 2,5 inférieur
  assert.equal(warmupWeight(0, 60), 0);
  assert.equal(warmupWeight(100, 50), 50);
});

test('groupes de superset', () => {
  const it = [{}, { ss: true }, { ss: true }, {}, { ss: true }, {}];
  assert.deepEqual(supersetGroup(it, 0), [0]);
  assert.deepEqual(supersetGroup(it, 2), [1, 2, 3]);
  assert.deepEqual(supersetGroup(it, 5), [4, 5]);
  assert.deepEqual(supersetLabels(it), ['', 'A1', 'A2', 'A3', 'B1', 'B2']);
});

test('série de semaines', () => {
  const at = (y, m, d) => ({ start: new Date(y, m - 1, d, 18).getTime(), end: 1 });
  const now = new Date(2026, 10, 6, 12).getTime(); // vendredi 6 novembre 2026
  assert.equal(weekStart(now), new Date(2026, 10, 2).getTime()); // lundi 2
  assert.deepEqual(weekStreak([], now), { weeks: 0, thisWeek: false });
  // semaine en cours + 2 précédentes
  assert.deepEqual(weekStreak([at(2026, 11, 2), at(2026, 10, 28), at(2026, 10, 20), at(2026, 10, 1)], now), { weeks: 3, thisWeek: true });
  // rien cette semaine : la série part de la semaine précédente
  assert.deepEqual(weekStreak([at(2026, 10, 30), at(2026, 10, 25)], now), { weeks: 2, thisWeek: false });
  // trou d'une semaine : la série s'arrête
  assert.deepEqual(weekStreak([at(2026, 11, 3), at(2026, 10, 19)], now), { weeks: 1, thisWeek: true });
  // séance non terminée ignorée
  assert.deepEqual(weekStreak([{ start: at(2026, 11, 3).start }], now), { weeks: 0, thisWeek: false });
});
