// Service worker : met l'appli en cache pour qu'elle marche sans réseau.
// IMPORTANT : incrémenter VERSION à chaque mise en ligne, sinon l'iPhone garde l'ancienne version.
const VERSION = 'appmuscu-v2.1.1';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
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
  './js/charts.js',
  './data/catalog.json',
  './img/icons/icon-180.png',
  './img/icons/icon-192.png',
  './img/icons/icon-512.png',
  "./img/ex/Barbell_Bench_Press_-_Medium_Grip.jpg",
  "./img/ex/Barbell_Curl.jpg",
  "./img/ex/Barbell_Deadlift.jpg",
  "./img/ex/Barbell_Squat.jpg",
  "./img/ex/Bent_Over_Barbell_Row.jpg",
  "./img/ex/Cable_Crossover.jpg",
  "./img/ex/Dips_-_Triceps_Version.jpg",
  "./img/ex/Dumbbell_Bench_Press.jpg",
  "./img/ex/Dumbbell_Shoulder_Press.jpg",
  "./img/ex/Face_Pull.jpg",
  "./img/ex/Hammer_Curls.jpg",
  "./img/ex/Incline_Dumbbell_Press.jpg",
  "./img/ex/Leg_Extensions.jpg",
  "./img/ex/Leg_Press.jpg",
  "./img/ex/Lying_Leg_Curls.jpg",
  "./img/ex/Pullups.jpg",
  "./img/ex/Romanian_Deadlift.jpg",
  "./img/ex/Seated_Cable_Rows.jpg",
  "./img/ex/Seated_Calf_Raise.jpg",
  "./img/ex/Side_Lateral_Raise.jpg",
  "./img/ex/Standing_Calf_Raises.jpg",
  "./img/ex/Standing_Military_Press.jpg",
  "./img/ex/Triceps_Pushdown.jpg",
  "./img/ex/Wide-Grip_Lat_Pulldown.jpg",
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
