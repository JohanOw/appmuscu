// Petit wrapper IndexedDB. Base "appmuscu", 4 magasins :
// exercises (catalogue perso), workouts (séances types), sessions (séances faites), kv (réglages, séance en cours).
const DB_NAME = 'appmuscu';
const DB_VERSION = 1;
export const STORES = ['exercises', 'workouts', 'sessions', 'kv'];

let dbPromise;
function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const s of ['exercises', 'workouts', 'sessions']) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s, { keyPath: 'id' });
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
      };
      req.onsuccess = () => {
        const db = req.result;
        // Connexion fermée par le système (longue mise en veille sur iOS) : rouverte au prochain accès.
        db.onclose = () => { dbPromise = null; };
        db.onversionchange = () => { db.close(); dbPromise = null; };
        resolve(db);
      };
      req.onerror = () => { dbPromise = null; reject(req.error); };
    });
  }
  return dbPromise;
}

function run(store, mode, fn, retry = true) {
  return open().then((db) => new Promise((resolve, reject) => {
    let tx;
    try { tx = db.transaction(store, mode); } catch (e) {
      // Connexion morte : une seule nouvelle tentative avec une connexion neuve.
      dbPromise = null;
      if (retry) run(store, mode, fn, false).then(resolve, reject); else reject(e);
      return;
    }
    const os = tx.objectStore(store);
    const req = fn(os);
    tx.oncomplete = () => resolve(req?.result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  }));
}

export const getAll = (store) => run(store, 'readonly', (os) => os.getAll());
export const get = (store, key) => run(store, 'readonly', (os) => os.get(key));
export const put = (store, value, key) => run(store, 'readwrite', (os) => (key === undefined ? os.put(value) : os.put(value, key)));
export const del = (store, key) => run(store, 'readwrite', (os) => os.delete(key));

export const kvGet = (key) => get('kv', key);
export const kvSet = (key, value) => put('kv', value, key);

/** Remplace tout le contenu (utilisé par l'import de sauvegarde), en une seule transaction. */
export async function replaceAll(data) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORES, 'readwrite');
    try {
      for (const s of STORES) tx.objectStore(s).clear();
      for (const s of ['exercises', 'workouts', 'sessions']) for (const v of data[s] || []) tx.objectStore(s).put(v);
      for (const [k, v] of Object.entries(data.kv || {})) tx.objectStore('kv').put(v, k);
    } catch (e) { tx.abort(); reject(e); return; } // rien n'est effacé si une donnée est invalide
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export async function kvAll() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const out = {};
    const tx = db.transaction('kv', 'readonly');
    const req = tx.objectStore('kv').openCursor();
    req.onsuccess = () => {
      const c = req.result;
      if (c) { out[c.key] = c.value; c.continue(); }
    };
    tx.oncomplete = () => resolve(out);
    tx.onerror = () => reject(tx.error);
  });
}
