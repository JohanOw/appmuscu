// Données de départ : exercices et séances Push / Pull / Legs.
// Images : yuhonas/free-exercise-db (licence Unlicense, domaine public), copiées dans img/ex/.
const E = (id, name, muscles) => ({ id, name, muscles, image: `img/ex/${id}.jpg`, source: 'free-exercise-db' });

export const DEFAULT_EXERCISES = [
  E('Barbell_Bench_Press_-_Medium_Grip', 'Développé couché', 'Pectoraux'),
  E('Incline_Dumbbell_Press', 'Développé incliné haltères', 'Pectoraux'),
  E('Dumbbell_Bench_Press', 'Développé couché haltères', 'Pectoraux'),
  E('Cable_Crossover', 'Écarté poulie vis-à-vis', 'Pectoraux'),
  E('Standing_Military_Press', 'Développé militaire', 'Épaules'),
  E('Dumbbell_Shoulder_Press', 'Développé épaules haltères', 'Épaules'),
  E('Side_Lateral_Raise', 'Élévations latérales', 'Épaules'),
  E('Triceps_Pushdown', 'Extension triceps poulie', 'Triceps'),
  E('Dips_-_Triceps_Version', 'Dips', 'Triceps'),
  E('Pullups', 'Tractions', 'Dos'),
  E('Wide-Grip_Lat_Pulldown', 'Tirage vertical', 'Dos'),
  E('Bent_Over_Barbell_Row', 'Rowing barre', 'Dos'),
  E('Seated_Cable_Rows', 'Rowing assis poulie', 'Dos'),
  E('Face_Pull', 'Face pull', 'Épaules arrière'),
  E('Barbell_Curl', 'Curl barre', 'Biceps'),
  E('Hammer_Curls', 'Curl marteau', 'Biceps'),
  E('Barbell_Squat', 'Squat', 'Quadriceps'),
  E('Barbell_Deadlift', 'Soulevé de terre', 'Dos, ischios'),
  E('Romanian_Deadlift', 'Soulevé de terre roumain', 'Ischios'),
  E('Leg_Press', 'Presse à cuisses', 'Quadriceps'),
  E('Lying_Leg_Curls', 'Leg curl allongé', 'Ischios'),
  E('Leg_Extensions', 'Leg extension', 'Quadriceps'),
  E('Standing_Calf_Raises', 'Mollets debout', 'Mollets'),
  E('Seated_Calf_Raise', 'Mollets assis', 'Mollets'),
];

const item = (exerciseId, sets = 3) => ({ exerciseId, sets });

export const DEFAULT_WORKOUTS = [
  { id: 'push', name: 'Push', order: 0, items: [
    item('Barbell_Bench_Press_-_Medium_Grip', 4), item('Incline_Dumbbell_Press'), item('Standing_Military_Press'),
    item('Side_Lateral_Raise'), item('Triceps_Pushdown'), item('Dips_-_Triceps_Version'),
  ] },
  { id: 'pull', name: 'Pull', order: 1, items: [
    item('Pullups', 4), item('Wide-Grip_Lat_Pulldown'), item('Bent_Over_Barbell_Row'),
    item('Seated_Cable_Rows'), item('Face_Pull'), item('Barbell_Curl'), item('Hammer_Curls'),
  ] },
  { id: 'legs', name: 'Legs', order: 2, items: [
    item('Barbell_Squat', 4), item('Romanian_Deadlift'), item('Leg_Press'),
    item('Lying_Leg_Curls'), item('Leg_Extensions'), item('Standing_Calf_Raises', 4),
  ] },
];

export const DEFAULT_REST_SEC = 90;
export const CATALOG_IMG_BASE = 'https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/';
