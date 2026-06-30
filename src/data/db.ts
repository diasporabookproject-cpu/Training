// Isolated data-access layer. Components NEVER touch Dexie directly — they
// import the functions below. This keeps a future cloud-sync (Turso/libSQL)
// swappable without rewriting UI.

import Dexie, { type Table } from "dexie";
import type {
  Draft,
  Exercise,
  MuscleGroup,
  Workout,
  WorkoutEntry,
} from "@/types";

const DRAFT_KEY = "current";

type Setting = { key: string; value: unknown };

class ChargeDB extends Dexie {
  exercises!: Table<Exercise, string>;
  workouts!: Table<Workout, string>;
  settings!: Table<Setting, string>;

  constructor() {
    super("charge");
    this.version(1).stores({
      // Only adopted exercises live here; the 873-entry catalog stays in memory.
      exercises: "id, name, primaryMuscle, source",
      workouts: "id, date, createdAt",
      // Holds the autosaved draft and misc app settings.
      settings: "key",
    });
  }
}

export const db = new ChargeDB();

/** Wrap a storage op so failures surface clearly instead of dying silently. */
async function guard<T>(label: string, fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    console.error(`[CHARGE] storage error (${label}):`, err);
    throw new Error(
      `Échec de l'opération de stockage (${label}). Vos données ne sont pas perdues — réessayez ou exportez une sauvegarde.`
    );
  }
}

let idCounter = 0;
/** Time-ordered, collision-resistant id without external deps. */
export function newId(prefix = "id"): string {
  idCounter = (idCounter + 1) % 1000;
  const rand = Math.floor(performance.now() * 1000) % 1000;
  return `${prefix}_${Date.now().toString(36)}_${(rand * 1000 + idCounter)
    .toString(36)
    .padStart(4, "0")}`;
}

/** Request persistent storage so the browser is less likely to evict us. */
export async function requestPersistence(): Promise<boolean> {
  try {
    if (navigator.storage?.persisted) {
      if (await navigator.storage.persisted()) return true;
    }
    if (navigator.storage?.persist) {
      return await navigator.storage.persist();
    }
  } catch (err) {
    console.warn("[CHARGE] persist() unavailable:", err);
  }
  return false;
}

export async function storageEstimate(): Promise<StorageEstimate | null> {
  try {
    return navigator.storage?.estimate ? await navigator.storage.estimate() : null;
  } catch {
    return null;
  }
}

// ── Exercises (adopted) ───────────────────────────────────────────────────

export function getExercises(): Promise<Exercise[]> {
  return guard("lire les exercices", () => db.exercises.toArray());
}

export function getExercise(id: string): Promise<Exercise | undefined> {
  return guard("lire un exercice", () => db.exercises.get(id));
}

export async function findAdoptedByLibraryId(
  libraryId: string
): Promise<Exercise | undefined> {
  return guard("rechercher un exercice adopté", () =>
    db.exercises.where("source").equals("library").and((e) => e.libraryId === libraryId).first()
  );
}

export function putExercise(ex: Exercise): Promise<string> {
  return guard("enregistrer un exercice", () => db.exercises.put(ex));
}

export function deleteExercise(id: string): Promise<void> {
  return guard("supprimer un exercice", () => db.exercises.delete(id));
}

export async function updateExercise(
  id: string,
  patch: Partial<Pick<Exercise, "name" | "primaryMuscle">>
): Promise<void> {
  await guard("modifier un exercice", () => db.exercises.update(id, patch));
}

// ── Workouts ────────────────────────────────────────────────────────────────

export async function getWorkouts(): Promise<Workout[]> {
  const list = await guard("lire les séances", () => db.workouts.toArray());
  return list.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : b.createdAt - a.createdAt));
}

export function putWorkout(w: Workout): Promise<string> {
  return guard("enregistrer la séance", () => db.workouts.put(w));
}

export function deleteWorkout(id: string): Promise<void> {
  return guard("supprimer la séance", () => db.workouts.delete(id));
}

/** Latest non-empty sets logged for an exercise, for prefill. */
export async function lastSetsForExercise(
  exerciseId: string
): Promise<WorkoutEntry["sets"] | null> {
  const workouts = await getWorkouts(); // already newest-first
  for (const w of workouts) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId);
    if (entry && entry.sets.length > 0) return entry.sets.map((s) => ({ ...s }));
  }
  return null;
}

// ── Draft (autosave) ─────────────────────────────────────────────────────────

export async function getDraft(): Promise<Draft | null> {
  const row = await guard("lire le brouillon", () => db.settings.get(DRAFT_KEY));
  return (row?.value as Draft) ?? null;
}

export async function saveDraft(draft: Draft): Promise<void> {
  await guard("sauvegarder le brouillon", () =>
    db.settings.put({ key: DRAFT_KEY, value: draft })
  );
}

export async function clearDraft(): Promise<void> {
  await guard("vider le brouillon", () => db.settings.delete(DRAFT_KEY));
}

// ── Backup metadata ───────────────────────────────────────────────────────

const LAST_EXPORT_KEY = "lastExportAt";

export async function getLastExportAt(): Promise<number | null> {
  const row = await db.settings.get(LAST_EXPORT_KEY).catch(() => undefined);
  return (row?.value as number) ?? null;
}

export async function setLastExportAt(ts: number): Promise<void> {
  await db.settings.put({ key: LAST_EXPORT_KEY, value: ts }).catch(() => {});
}

// ── Backup / restore / reset ──────────────────────────────────────────────

export type BackupV1 = {
  app: "CHARGE";
  version: 1;
  exportedAt: number;
  exercises: Exercise[];
  workouts: Workout[];
};

export async function exportBackup(): Promise<BackupV1> {
  const [exercises, workouts] = await Promise.all([getExercises(), getWorkouts()]);
  return {
    app: "CHARGE",
    version: 1,
    exportedAt: Date.now(),
    exercises,
    workouts,
  };
}

export function isValidBackup(data: unknown): data is BackupV1 {
  if (!data || typeof data !== "object") return false;
  const b = data as Record<string, unknown>;
  return (
    b.app === "CHARGE" &&
    b.version === 1 &&
    Array.isArray(b.exercises) &&
    Array.isArray(b.workouts)
  );
}

/** Replace ALL data with the backup contents (used by Import). */
export async function importBackup(backup: BackupV1): Promise<void> {
  await guard("importer la sauvegarde", () =>
    db.transaction("rw", db.exercises, db.workouts, db.settings, async () => {
      await db.exercises.clear();
      await db.workouts.clear();
      await db.settings.delete(DRAFT_KEY);
      await db.exercises.bulkPut(backup.exercises);
      await db.workouts.bulkPut(backup.workouts);
    })
  );
}

export async function resetAll(): Promise<void> {
  await guard("réinitialiser", () =>
    db.transaction("rw", db.exercises, db.workouts, db.settings, async () => {
      await db.exercises.clear();
      await db.workouts.clear();
      await db.settings.clear();
    })
  );
}

export type { MuscleGroup };
