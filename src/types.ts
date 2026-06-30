// Core domain model for CHARGE. Kept framework-agnostic so it can be reused
// behind a future cloud-sync layer without touching components.

export const MUSCLE_GROUPS = [
  "abdominals",
  "abductors",
  "adductors",
  "biceps",
  "calves",
  "chest",
  "forearms",
  "glutes",
  "hamstrings",
  "lats",
  "lower back",
  "middle back",
  "neck",
  "quadriceps",
  "shoulders",
  "traps",
  "triceps",
] as const;

export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** French labels for the 17 primary muscle groups. */
export const MUSCLE_LABELS: Record<MuscleGroup, string> = {
  abdominals: "Abdominaux",
  abductors: "Abducteurs",
  adductors: "Adducteurs",
  biceps: "Biceps",
  calves: "Mollets",
  chest: "Pectoraux",
  forearms: "Avant-bras",
  glutes: "Fessiers",
  hamstrings: "Ischio-jambiers",
  lats: "Grand dorsal",
  "lower back": "Bas du dos",
  "middle back": "Milieu du dos",
  neck: "Cou",
  quadriceps: "Quadriceps",
  shoulders: "Épaules",
  traps: "Trapèzes",
  triceps: "Triceps",
};

export function muscleLabel(m: string | null | undefined): string {
  if (!m) return "Non spécifié";
  return (MUSCLE_LABELS as Record<string, string>)[m] ?? m;
}

/** An ADOPTED exercise stored in Dexie (from catalog or custom-created). */
export type Exercise = {
  id: string; // internal CHARGE id
  name: string;
  source: "library" | "custom";
  libraryId: string | null; // free-exercise-db id if adopted from catalog
  primaryMuscle: MuscleGroup | null;
  equipment: string | null;
  category: string | null;
  mechanic: string | null;
  force: string | null;
  createdAt: number;
};

export type WorkoutSet = { weight: number; reps: number }; // kg
export type WorkoutEntry = { exerciseId: string; sets: WorkoutSet[] };

export type Workout = {
  id: string;
  date: string; // 'YYYY-MM-DD'
  entries: WorkoutEntry[];
  createdAt: number;
};

/** In-progress session, autosaved. */
export type Draft = { date: string; entries: WorkoutEntry[] };

/** A read-only catalog entry from free-exercise-db (mapped to CHARGE shape). */
export type CatalogExercise = {
  libraryId: string;
  name: string;
  primaryMuscle: MuscleGroup | null;
  secondaryMuscles: string[];
  equipment: string | null;
  category: string | null;
  mechanic: string | null;
  force: string | null;
  image: string | null;
};
