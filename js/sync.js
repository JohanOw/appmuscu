// Synchro automatique avec un dépôt GitHub PRIVÉ (API REST « contents »), sans serveur.
// Un seul fichier (appmuscu.json) est remplacé à chaque envoi ; GitHub garde l'historique de chaque version.
// Règle en cas de conflit (deux téléphones) : le dernier envoi gagne, les versions précédentes restent dans l'historique.
import { kvGet, kvSet, del } from './db.js';
import { buildBackupData, validateBackup, restoreBackup } from './backup.js';

const API = 'https://api.github.com';
export const SYNC_FILE = 'appmuscu.json';
/** Limite des requêtes « keepalive » (envoi quand l'appli passe en arrière-plan) : 64 Ko, marge gardée. */
const KEEPALIVE_MAX = 60000;

export class GitHubError extends Error {
  constructor(message, status = 0) { super(message); this.status = status; }
}

/** « pseudo/depot » ou l'adresse complète du dépôt. */
export function parseRepo(input) {
  const s = String(input || '').trim().replace(/^https?:\/\/(www\.)?github\.com\//i, '').replace(/\.git$/i, '').replace(/\/+$/, '');
  const m = s.match(/^([A-Za-z0-9](?:[A-Za-z0-9-]{0,38}))\/([A-Za-z0-9._-]{1,100})$/);
  if (!m) throw new GitHubError('Dépôt attendu sous la forme pseudo/nom-du-depot.');
  return { owner: m[1], repo: m[2] };
}

/** Base64 d'un texte UTF-8 (accents compris), comme l'attend l'API GitHub. */
export function utf8ToB64(str) {
  const bytes = new TextEncoder().encode(str);
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export function b64ToUtf8(b64) {
  const bin = atob(String(b64).replace(/\s/g, ''));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

/** Empreinte du contenu (sans la date d'export) : évite de renvoyer des données inchangées. */
export function contentHash(data) {
  const { exportedAt, ...rest } = data;
  const s = JSON.stringify(rest);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193); }
  return `${(h >>> 0).toString(16)}:${s.length}`;
}

function messageFor(status, detail) {
  if (status === 401) return 'Jeton refusé : il est invalide ou a expiré. Crée-en un nouveau sur GitHub.';
  if (status === 403) return 'Accès refusé par GitHub : vérifie que le jeton a le droit « Contents : Read and write » sur ce dépôt.';
  if (status === 404) return 'Dépôt introuvable : vérifie son nom et que le jeton a bien accès à ce dépôt.';
  if (status === 409 || status === 422) return 'Conflit de version avec GitHub.';
  return `Erreur GitHub ${status}${detail ? ` : ${detail}` : ''}.`;
}

/** Client GitHub minimal. `fetchFn` est remplaçable pour les tests. */
export function client({ owner, repo, token }, fetchFn = (...a) => fetch(...a)) {
  const base = `${API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  async function call(path, { method = 'GET', body, keepalive = false } = {}) {
    let res;
    try {
      res = await fetchFn(base + path, {
        method, keepalive, cache: 'no-store',
        headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body,
      });
    } catch { throw new GitHubError('Pas de réseau : la synchro sera retentée plus tard.'); }
    if (res.ok) return res.json();
    let detail = '';
    try { detail = (await res.json()).message || ''; } catch { /* corps vide */ }
    throw new GitHubError(messageFor(res.status, detail), res.status);
  }
  return {
    /** Vérifie l'accès, refuse un dépôt public et un jeton sans droit d'écriture. */
    async checkRepo() {
      const r = await call('');
      if (!r.private) throw new GitHubError('Ce dépôt est public : tes données seraient visibles par tous. Choisis un dépôt privé.');
      if (r.permissions && !r.permissions.push) throw new GitHubError('Le jeton ne peut pas écrire dans ce dépôt (droit « Contents : Read and write » manquant).', 403);
      return r;
    },
    /** Sauvegarde distante { data, sha }, ou null s'il n'y en a pas encore. */
    async read() {
      let r;
      try { r = await call(`/contents/${SYNC_FILE}`); } catch (e) { if (e.status === 404) return null; throw e; }
      if (r.encoding !== 'base64' || !r.content) throw new GitHubError('Sauvegarde GitHub trop grosse pour être lue (plus de 1 Mo).');
      let data;
      try { data = JSON.parse(b64ToUtf8(r.content)); } catch { throw new GitHubError('Sauvegarde GitHub illisible (JSON abîmé).'); }
      return { data, sha: r.sha };
    },
    /** Crée ou remplace le fichier. Renvoie le nouveau sha. */
    async write(text, sha, { keepalive = false } = {}) {
      const body = JSON.stringify({ message: `Sauvegarde AppMuscu ${new Date().toISOString()}`, content: utf8ToB64(text), ...(sha ? { sha } : {}) });
      const r = await call(`/contents/${SYNC_FILE}`, { method: 'PUT', body, keepalive: keepalive && body.length < KEEPALIVE_MAX });
      return r.content.sha;
    },
  };
}

/* ---------- Synchro de l'appli (réglage stocké dans kv « sync », jamais exporté) ---------- */

export const getConfig = () => kvGet('sync');

/** Met à jour le réglage, sauf s'il a été supprimé entre-temps (déconnexion pendant un envoi). */
async function patchConfig(patch) {
  const cur = await kvGet('sync');
  if (cur?.token) await kvSet('sync', { ...cur, ...patch });
}

// Une seule opération à la fois : deux envois simultanés se marcheraient dessus (sha).
let chain = Promise.resolve();
const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };

/**
 * Envoie les données si elles ont changé depuis le dernier envoi (ou toujours avec `force`).
 * Renvoie 'off' (pas configuré), 'unchanged' ou 'pushed'. Lève une GitHubError en cas d'échec.
 */
export function pushNow({ force = false, keepalive = false } = {}, fetchFn) {
  return serial(async () => {
    const cfg = await kvGet('sync');
    if (!cfg?.token) return 'off';
    const data = await buildBackupData();
    const hash = contentHash(data);
    if (!force && hash === cfg.lastHash) return 'unchanged';
    const gh = client(cfg, fetchFn);
    const text = JSON.stringify(data);
    try {
      let sha;
      try { sha = await gh.write(text, cfg.sha, { keepalive }); } catch (e) {
        // Fichier modifié ailleurs (ou sha perdu) : on relit le sha actuel et on remplace. L'ancienne version reste dans l'historique GitHub.
        if (e.status !== 409 && e.status !== 422) throw e;
        const cur = await gh.read();
        sha = await gh.write(text, cur?.sha);
      }
      await patchConfig({ sha, lastHash: hash, lastSync: Date.now(), lastError: null });
      return 'pushed';
    } catch (e) {
      await patchConfig({ lastError: e.message, lastErrorAt: Date.now() });
      throw e;
    }
  });
}

/**
 * Vérifie le dépôt et le jeton, puis enregistre le réglage sur ce téléphone.
 * Renvoie la sauvegarde distante ({ data, sha }) si elle existe, sinon null. Ne modifie aucune donnée.
 */
export async function connect(repoInput, token, fetchFn) {
  const { owner, repo } = parseRepo(repoInput);
  const tok = String(token || '').trim();
  if (!tok) throw new GitHubError('Colle le jeton GitHub.');
  const gh = client({ owner, repo, token: tok }, fetchFn);
  await gh.checkRepo();
  const remote = await gh.read();
  if (remote) validateBackup(remote.data);
  await kvSet('sync', { owner, repo, token: tok, sha: remote?.sha || null, lastHash: null, lastSync: null, lastError: null });
  return remote;
}

/** Remplace les données du téléphone par la sauvegarde GitHub. Renvoie les données restaurées. */
export function pullAndRestore(fetchFn) {
  return serial(async () => {
    const cfg = await kvGet('sync');
    if (!cfg?.token) throw new GitHubError('Synchro GitHub non configurée.');
    const remote = await client(cfg, fetchFn).read();
    if (!remote) throw new GitHubError('Aucune sauvegarde sur GitHub pour l\'instant.', 404);
    validateBackup(remote.data);
    await restoreBackup(remote.data);
    await patchConfig({ sha: remote.sha, lastHash: contentHash(await buildBackupData()), lastSync: Date.now(), lastError: null });
    return remote.data;
  });
}

/** Efface le jeton de ce téléphone. La sauvegarde sur GitHub n'est pas touchée. */
export const disconnect = () => del('kv', 'sync');
