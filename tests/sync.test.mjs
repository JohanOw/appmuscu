// Tests de la synchro GitHub et du nettoyage de sauvegarde. Aucun appel réseau : fetch est simulé.
// Lancer : node --test tests/sync.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRepo, utf8ToB64, b64ToUtf8, contentHash, client, SYNC_FILE } from '../js/sync.js';
import { stripImages, exportableKv, validateBackup, BACKUP_NAME } from '../js/backup.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

/** Faux GitHub en mémoire : un dépôt, un fichier, contrôle du sha comme l'API réelle. */
function fakeGitHub({ isPrivate = true, push = true } = {}) {
  const st = { file: null, sha: null, n: 0, calls: [] };
  const fetchFn = async (url, opts) => {
    st.calls.push({ url, ...opts });
    assert.match(opts.headers.Authorization, /^Bearer /);
    const path = new URL(url).pathname;
    if (path === '/repos/jo/data') return json(200, { private: isPrivate, permissions: { push } });
    if (path === `/repos/jo/data/contents/${SYNC_FILE}`) {
      if (opts.method === 'GET') return st.file ? json(200, { encoding: 'base64', content: st.file.replace(/(.{60})/g, '$1\n'), sha: st.sha }) : json(404, { message: 'Not Found' });
      const body = JSON.parse(opts.body);
      if (st.file && body.sha !== st.sha) return json(409, { message: 'sha mismatch' });
      if (!st.file && body.sha) return json(422, { message: 'bad sha' });
      st.file = body.content; st.sha = `sha${++st.n}`;
      return json(st.n === 1 ? 201 : 200, { content: { sha: st.sha } });
    }
    return json(404, { message: 'Not Found' });
  };
  return { st, fetchFn };
}

test('parseRepo accepte pseudo/depot et l\'adresse complète, refuse le reste', () => {
  assert.deepEqual(parseRepo(' jo/appmuscu-data '), { owner: 'jo', repo: 'appmuscu-data' });
  assert.deepEqual(parseRepo('https://github.com/jo/appmuscu-data.git'), { owner: 'jo', repo: 'appmuscu-data' });
  assert.throws(() => parseRepo('appmuscu-data'));
  assert.throws(() => parseRepo('jo/a/b'));
});

test('base64 UTF-8 aller-retour avec accents et emoji', () => {
  const s = 'Développé couché · séries ✓ 🔥';
  assert.equal(b64ToUtf8(utf8ToB64(s)), s);
  assert.equal(b64ToUtf8(utf8ToB64(s).replace(/(.{8})/g, '$1\n')), s); // GitHub coupe en lignes
});

test('contentHash ignore la date d\'export mais voit les changements', () => {
  const a = { exportedAt: '1', sessions: [{ id: 'x' }] };
  assert.equal(contentHash(a), contentHash({ ...a, exportedAt: '2' }));
  assert.notEqual(contentHash(a), contentHash({ ...a, sessions: [{ id: 'y' }] }));
});

test('stripImages : data URL remplacée (lien catalogue ou vide), le reste inchangé', () => {
  const out = stripImages([
    { id: 'Seated_Leg_Curl', source: 'free-exercise-db', image: 'data:image/jpeg;base64,AAA' },
    { id: 'custom_1', source: 'custom', image: 'data:image/jpeg;base64,BBB' },
    { id: 'Pullups', source: 'free-exercise-db', image: 'img/ex/Pullups.jpg' },
  ], 'https://base/');
  assert.equal(out[0].image, 'https://base/Seated_Leg_Curl/0.jpg');
  assert.equal(out[1].image, '');
  assert.equal(out[2].image, 'img/ex/Pullups.jpg');
});

test('le jeton (kv « sync ») n\'est jamais exporté, nom de fichier fixe', () => {
  const kv = exportableKv({ sync: { token: 'secret' }, bugs: [], restSec: 90 });
  assert.equal('sync' in kv, false);
  assert.equal(kv.restSec, 90);
  assert.equal(BACKUP_NAME, 'appmuscu-sauvegarde.json');
});

test('client : dépôt public refusé, jeton sans écriture refusé', async () => {
  await assert.rejects(client({ owner: 'jo', repo: 'data', token: 't' }, fakeGitHub({ isPrivate: false }).fetchFn).checkRepo(), /public/);
  await assert.rejects(client({ owner: 'jo', repo: 'data', token: 't' }, fakeGitHub({ push: false }).fetchFn).checkRepo(), /écrire/);
  await client({ owner: 'jo', repo: 'data', token: 't' }, fakeGitHub().fetchFn).checkRepo();
});

test('client : lecture vide, création, remplacement du même fichier, relecture', async () => {
  const { st, fetchFn } = fakeGitHub();
  const gh = client({ owner: 'jo', repo: 'data', token: 't' }, fetchFn);
  assert.equal(await gh.read(), null);
  const sha1 = await gh.write(JSON.stringify({ app: 'AppMuscu', v: 'é1' }), null);
  const sha2 = await gh.write(JSON.stringify({ app: 'AppMuscu', v: 'é2' }), sha1);
  assert.notEqual(sha1, sha2);
  const r = await gh.read();
  assert.deepEqual(r, { data: { app: 'AppMuscu', v: 'é2' }, sha: sha2 });
  assert.equal(st.calls.filter((c) => c.method === 'PUT').length, 2);
});

test('client : sha périmé → erreur 409 exploitable, erreurs HTTP traduites', async () => {
  const { fetchFn } = fakeGitHub();
  const gh = client({ owner: 'jo', repo: 'data', token: 't' }, fetchFn);
  await gh.write('{}', null);
  await assert.rejects(gh.write('{}', 'vieux'), (e) => e.status === 409);
  const deny = client({ owner: 'jo', repo: 'data', token: 't' }, async () => json(401, { message: 'Bad credentials' }));
  await assert.rejects(deny.read(), /Jeton refusé/);
  const offline = client({ owner: 'jo', repo: 'data', token: 't' }, async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(offline.read(), /Pas de réseau/);
});

test('keepalive seulement sous 60 Ko', async () => {
  const { st, fetchFn } = fakeGitHub();
  const gh = client({ owner: 'jo', repo: 'data', token: 't' }, fetchFn);
  await gh.write('{"a":1}', null, { keepalive: true });
  const sha = st.sha;
  await gh.write(JSON.stringify({ big: 'x'.repeat(70000) }), sha, { keepalive: true });
  const puts = st.calls.filter((c) => c.method === 'PUT');
  assert.equal(puts[0].keepalive, true);
  assert.equal(puts[1].keepalive, false);
});

test('la vraie sauvegarde nettoyée reste valide', async () => {
  const { readFileSync, existsSync } = await import('node:fs');
  const f = new URL('../save/appmuscu-sauvegarde-2026-11-15-sans-images.json', import.meta.url);
  if (!existsSync(f)) return; // dossier privé absent (autre ordinateur)
  const data = validateBackup(JSON.parse(readFileSync(f, 'utf8')));
  assert.ok(data.sessions.length > 0);
});
