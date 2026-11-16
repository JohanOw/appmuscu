// Service worker : met l'appli en cache pour qu'elle marche sans réseau.
// IMPORTANT : incrémenter VERSION à chaque mise en ligne, sinon l'iPhone garde l'ancienne version.
const VERSION = 'appmuscu-v2.3.0';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/v23.js',
  './js/migrate.js',
  './img/muscles/base.webp',
  './img/muscles/l1.webp',
  './img/muscles/l2.webp',
  './img/muscles/l3.webp',
  './img/muscles/zones.png',
  './js/db.js',
  './js/defaults.js',
  './js/stats.js',
  './js/cues.js',
  './js/mascot.js',
  './js/sprites.js',
  './img/mascotte/ex-decor.webp',
  './img/mascotte/ex-neon.webp',
  './img/mascotte/ex-decor2.webp', './img/mascotte/ex-neon2.webp', './img/mascotte/ex/Leverage_Chest_Press.webp', './img/mascotte/ex/Barbell_Hip_Thrust.webp', './img/mascotte/ex/Butterfly.webp',
  './js/exart.js',
  './img/mascotte/ex/Incline_Dumbbell_Press.webp',
  './img/mascotte/ex/Barbell_Bench_Press_-_Medium_Grip.webp',
  './img/mascotte/ex/Belt_Squat.webp',
  './img/mascotte/ex/Concentration_Curls.webp',
  './img/mascotte/ex/Leg_Extensions.webp',
  './img/mascotte/ex/Machine_Crunch.webp',
  './img/mascotte/ex/Pullups.webp',
  './img/mascotte/ex/Side_Lateral_Raise.webp',
  './img/mascotte/ex/Standing_Calf_Raises.webp',
  './img/mascotte/ex/Thigh_Abductor.webp',
  './img/mascotte/ex/Triceps_Pushdown.webp',
  './img/mascotte/ex/Wide-Grip_Lat_Pulldown.webp',
  './img/mascotte/ex/custom_mw6hkglnchdog.webp',
  './img/mascotte/ex/custom_mwc3obllxirnj.webp',
  './img/mascotte/ex/custom_mwc3p45el78ed.webp',
  './img/mascotte/ex/custom_mwc3pgerg6alc.webp',
  './img/mascotte/ex/custom_mwc3r8k4gkz8e.webp',
  "./img/mascotte/biceps.webp",
  "./img/mascotte/chute.webp",
  "./img/mascotte/couche.webp",
  "./img/mascotte/decor.webp",
  "./img/mascotte/echauf.webp",
  "./img/mascotte/epuise.webp",
  "./img/mascotte/finrepos.webp",
  "./img/mascotte/flex.webp",
  "./img/mascotte/hausse.webp",
  "./img/mascotte/marche.webp",
  "./img/mascotte/motivation.webp",
  "./img/mascotte/pouce.webp",
  "./img/mascotte/record.webp",
  "./img/mascotte/repos.webp",
  "./img/mascotte/saut.webp",
  "./img/mascotte/sortie.webp",
  "./img/mascotte/squat.webp",
  "./img/mascotte/traction.webp",
  "./img/mascotte/transat.webp",
  "./img/mascotte/victoire.webp",
  './js/timer.js',
  './js/backup.js',
  './js/sync.js',
  './js/charts.js',
  './data/catalog.json',
  './img/icons/icon-180.png',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(FILES.map((u) => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Fichiers de l'appli : cache d'abord. Autres origines (images du catalogue) : réseau normal.
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== self.location.origin) return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request).catch(() => {
      if (e.request.mode === 'navigate') return caches.match('./index.html');
      return Response.error();
    })),
  );
});
