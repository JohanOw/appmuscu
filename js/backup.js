// Sauvegarde : export d'un fichier JSON (partage iOS ou téléchargement) et import.
// Les images intégrées (data URL) ne sont jamais sauvegardées : seules leurs adresses le sont.
// Le réglage de synchro (jeton GitHub) n'est jamais exporté et survit à une restauration.
import { getAll, kvAll, kvGet, replaceAll } from './db.js';
import { CATALOG_IMG_BASE } from './defaults.js';

export const BACKUP_FORMAT = 1;
/** Nom fixe : iOS peut ainsi proposer de remplacer l'ancien fichier au lieu d'en créer un nouveau. */
export const BACKUP_NAME = 'appmuscu-sauvegarde.json';
/** Clés de réglages propres à ce téléphone, jamais exportées ni écrasées par une restauration. */
export const LOCAL_ONLY_KV = ['sync'];

/** Remplace les images intégrées : lien du catalogue si l'exercice en vient, sinon pas d'image. */
export function stripImages(exercises, base = CATALOG_IMG_BASE) {
  return exercises.map((e) => (typeof e.image === 'string' && e.image.startsWith('data:')
    ? { ...e, image: e.source === 'free-exercise-db' ? `${base}${e.id}/0.jpg` : '' }
    : e));
}

/** Réglages sans les clés locales (jeton de synchro). */
export function exportableKv(kv) {
  const out = { ...(kv || {}) };
  for (const k of LOCAL_ONLY_KV) delete out[k];
  return out;
}

/** Données de sauvegarde (objet), sans images intégrées ni jeton. */
export async function buildBackupData() {
  const [exercises, workouts, sessions, kv] = await Promise.all([getAll('exercises'), getAll('workouts'), getAll('sessions'), kvAll()]);
  return { app: 'AppMuscu', format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), exercises: stripImages(exercises), workouts, sessions, kv: exportableKv(kv) };
}

export async function buildBackupFile() {
  const data = await buildBackupData();
  return { file: new File([JSON.stringify(data)], BACKUP_NAME, { type: 'application/json' }), counts: { sessions: data.sessions.length, exercises: data.exercises.length } };
}

/**
 * Partage le fichier (feuille de partage iOS : Mail, Enregistrer dans Fichiers / iCloud Drive...).
 * Repli : téléchargement classique. Doit être appelé directement dans un gestionnaire de clic.
 * Renvoie 'shared', 'downloaded' ou 'cancelled'.
 */
export async function shareOrDownload(file) {
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: 'Sauvegarde AppMuscu' });
      return 'shared';
    } catch (e) {
      if (e.name === 'AbortError') return 'cancelled';
      console.warn('Partage impossible, repli téléchargement', e);
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url; a.download = file.name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

/** Vérifie un objet de sauvegarde déjà lu (fichier ou GitHub). Lève une erreur claire s'il est invalide. */
export function validateBackup(data) {
  if (data?.app !== 'AppMuscu') throw new Error('Ce fichier n\'est pas une sauvegarde AppMuscu.');
  if (data.format > BACKUP_FORMAT) throw new Error('Sauvegarde créée par une version plus récente de l\'appli.');
  for (const k of ['exercises', 'workouts', 'sessions']) {
    if (!Array.isArray(data[k])) throw new Error(`Sauvegarde incomplète (${k} manquant).`);
    if (data[k].some((x) => typeof x?.id !== 'string' || !x.id)) throw new Error(`Sauvegarde abîmée (${k} sans identifiant).`);
  }
  if (data.kv != null && typeof data.kv !== 'object') throw new Error('Sauvegarde abîmée (réglages illisibles).');
  return data;
}

/** Lit et vérifie un fichier de sauvegarde, sans rien écrire. */
export async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Fichier illisible : ce n\'est pas un JSON valide.'); }
  return validateBackup(data);
}

/** Remplace toutes les données, en gardant les réglages locaux de ce téléphone (synchro). */
export async function restoreBackup(data) {
  const kv = exportableKv(data.kv);
  for (const k of LOCAL_ONLY_KV) { const v = await kvGet(k); if (v !== undefined) kv[k] = v; }
  return replaceAll({ ...data, kv });
}
