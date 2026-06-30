// Cloud sync engine. Strategy: local-first with last-write-wins per record
// (by updatedAt) and soft-delete tombstones, so create/edit/delete all
// propagate across devices. Dexie remains the source of truth the UI reads;
// this module reconciles it with Supabase.

import type { Exercise, MuscleGroup, Workout, WorkoutEntry } from "@/types";
import { supabase } from "./supabase";
import {
  applyRemote,
  getAllExercisesRaw,
  getAllWorkoutsRaw,
  setLastSyncAt,
} from "./db";

// ── Row mapping (camelCase local ↔ snake_case Supabase) ────────────────────

type RemoteExercise = {
  id: string;
  user_id: string;
  name: string;
  source: string;
  library_id: string | null;
  primary_muscle: string | null;
  equipment: string | null;
  category: string | null;
  mechanic: string | null;
  force: string | null;
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

type RemoteWorkout = {
  id: string;
  user_id: string;
  date: string;
  entries: WorkoutEntry[];
  created_at: number;
  updated_at: number;
  deleted: boolean;
};

function exToRemote(e: Exercise, userId: string): RemoteExercise {
  return {
    id: e.id,
    user_id: userId,
    name: e.name,
    source: e.source,
    library_id: e.libraryId,
    primary_muscle: e.primaryMuscle,
    equipment: e.equipment,
    category: e.category,
    mechanic: e.mechanic,
    force: e.force,
    created_at: e.createdAt,
    updated_at: e.updatedAt,
    deleted: e.deleted ?? false,
  };
}

function exFromRemote(r: RemoteExercise): Exercise {
  return {
    id: r.id,
    name: r.name,
    source: r.source === "library" ? "library" : "custom",
    libraryId: r.library_id,
    primaryMuscle: (r.primary_muscle as MuscleGroup | null) ?? null,
    equipment: r.equipment,
    category: r.category,
    mechanic: r.mechanic,
    force: r.force,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: r.deleted,
  };
}

function wkToRemote(w: Workout, userId: string): RemoteWorkout {
  return {
    id: w.id,
    user_id: userId,
    date: w.date,
    entries: w.entries,
    created_at: w.createdAt,
    updated_at: w.updatedAt,
    deleted: w.deleted ?? false,
  };
}

function wkFromRemote(r: RemoteWorkout): Workout {
  return {
    id: r.id,
    date: r.date,
    entries: Array.isArray(r.entries) ? r.entries : [],
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    deleted: r.deleted,
  };
}

// ── Sync ────────────────────────────────────────────────────────────────────

export type SyncResult = {
  pulled: number;
  pushed: number;
};

class SyncError extends Error {}

/**
 * Reconcile local Dexie data with the cloud for `userId`.
 * Pulls everything, applies remote winners locally, pushes local winners up.
 */
export async function fullSync(userId: string): Promise<SyncResult> {
  // 1. Pull remote snapshot.
  const [remoteExRes, remoteWkRes] = await Promise.all([
    supabase.from("exercises").select("*"),
    supabase.from("workouts").select("*"),
  ]);
  if (remoteExRes.error) throw new SyncError(remoteExRes.error.message);
  if (remoteWkRes.error) throw new SyncError(remoteWkRes.error.message);

  const remoteEx = (remoteExRes.data as RemoteExercise[]).map(exFromRemote);
  const remoteWk = (remoteWkRes.data as RemoteWorkout[]).map(wkFromRemote);
  const remoteExById = new Map(remoteEx.map((e) => [e.id, e]));
  const remoteWkById = new Map(remoteWk.map((w) => [w.id, w]));

  // 2. Local snapshot (including tombstones).
  const [localEx, localWk] = await Promise.all([
    getAllExercisesRaw(),
    getAllWorkoutsRaw(),
  ]);
  const localExById = new Map(localEx.map((e) => [e.id, e]));
  const localWkById = new Map(localWk.map((w) => [w.id, w]));

  // 3. Remote → local: apply rows newer than (or missing from) local.
  const applyEx = remoteEx.filter((r) => {
    const l = localExById.get(r.id);
    return !l || r.updatedAt > l.updatedAt;
  });
  const applyWk = remoteWk.filter((r) => {
    const l = localWkById.get(r.id);
    return !l || r.updatedAt > l.updatedAt;
  });
  await applyRemote(applyEx, applyWk);

  // 4. Local → remote: push rows newer than (or missing from) remote.
  const pushEx = localEx.filter((l) => {
    const r = remoteExById.get(l.id);
    return !r || l.updatedAt > r.updatedAt;
  });
  const pushWk = localWk.filter((l) => {
    const r = remoteWkById.get(l.id);
    return !r || l.updatedAt > r.updatedAt;
  });

  if (pushEx.length) {
    const { error } = await supabase
      .from("exercises")
      .upsert(pushEx.map((e) => exToRemote(e, userId)));
    if (error) throw new SyncError(error.message);
  }
  if (pushWk.length) {
    const { error } = await supabase
      .from("workouts")
      .upsert(pushWk.map((w) => wkToRemote(w, userId)));
    if (error) throw new SyncError(error.message);
  }

  await setLastSyncAt(Date.now());
  return { pulled: applyEx.length + applyWk.length, pushed: pushEx.length + pushWk.length };
}
