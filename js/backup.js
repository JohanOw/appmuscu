// Sauvegarde : export d'un fichier JSON (partage iOS ou téléchargement) et import.
import { getAll, kvAll, replaceAll } from './db.js';

export const BACKUP_FORMAT = 1;

export async function buildBackupFile() {
  const [exercises, workouts, sessions, kv] = await Promise.all([getAll('exercises'), getAll('workouts'), getAll('sessions'), kvAll()]);
  const data = { app: 'AppMuscu', format: BACKUP_FORMAT, exportedAt: new Date().toISOString(), exercises, workouts, sessions, kv };
  const d = new Date();
  const stamp = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const name = `appmuscu-sauvegarde-${stamp}.json`;
  return { file: new File([JSON.stringify(data)], name, { type: 'application/json' }), counts: { sessions: sessions.length, exercises: exercises.length } };
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

/** Lit et vérifie un fichier de sauvegarde, sans rien écrire. */
export async function readBackup(file) {
  let data;
  try { data = JSON.parse(await file.text()); } catch { throw new Error('Fichier illisible : ce n\'est pas un JSON valide.'); }
  if (data?.app !== 'AppMuscu') throw new Error('Ce fichier n\'est pas une sauvegarde AppMuscu.');
  if (data.format > BACKUP_FORMAT) throw new Error('Sauvegarde créée par une version plus récente de l\'appli.');
  for (const k of ['exercises', 'workouts', 'sessions']) {
    if (!Array.isArray(data[k])) throw new Error(`Sauvegarde incomplète (${k} manquant).`);
    if (data[k].some((x) => typeof x?.id !== 'string' || !x.id)) throw new Error(`Sauvegarde abîmée (${k} sans identifiant).`);
  }
  if (data.kv != null && typeof data.kv !== 'object') throw new Error('Sauvegarde abîmée (réglages illisibles).');
  return data;
}

export const restoreBackup = (data) => replaceAll(data);
