// App data context: the ONLY bridge between components and the Dexie layer.
// Loads exercises + workouts, exposes mutations, keeps React state in sync.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { CatalogExercise, Exercise, MuscleGroup, Workout } from "@/types";
import * as repo from "./db";

type StoreValue = {
  loading: boolean;
  exercises: Exercise[];
  workouts: Workout[];
  exercisesById: Map<string, Exercise>;
  reload: () => Promise<void>;
  adoptFromCatalog: (cat: CatalogExercise) => Promise<Exercise>;
  createCustom: (name: string, primaryMuscle: MuscleGroup | null) => Promise<Exercise>;
  renameExercise: (id: string, name: string) => Promise<void>;
  setExerciseMuscle: (id: string, muscle: MuscleGroup | null) => Promise<void>;
  removeExercise: (id: string) => Promise<void>;
  saveWorkout: (w: Workout) => Promise<void>;
  removeWorkout: (id: string) => Promise<void>;
  isExerciseUsed: (id: string) => boolean;
};

const StoreCtx = createContext<StoreValue | null>(null);

export function useStore(): StoreValue {
  const ctx = useContext(StoreCtx);
  if (!ctx) throw new Error("useStore must be used within <StoreProvider>");
  return ctx;
}

export function StoreProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  const reload = useCallback(async () => {
    const [ex, wk] = await Promise.all([repo.getExercises(), repo.getWorkouts()]);
    ex.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    setExercises(ex);
    setWorkouts(wk);
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await repo.requestPersistence();
        await reload();
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  const adoptFromCatalog = useCallback(
    async (cat: CatalogExercise): Promise<Exercise> => {
      const existing = await repo.findAdoptedByLibraryId(cat.libraryId);
      if (existing) return existing;
      const ex: Exercise = {
        id: repo.newId("ex"),
        name: cat.name,
        source: "library",
        libraryId: cat.libraryId,
        primaryMuscle: cat.primaryMuscle,
        equipment: cat.equipment,
        category: cat.category,
        mechanic: cat.mechanic,
        force: cat.force,
        createdAt: Date.now(),
      };
      await repo.putExercise(ex);
      await reload();
      return ex;
    },
    [reload]
  );

  const createCustom = useCallback(
    async (name: string, primaryMuscle: MuscleGroup | null): Promise<Exercise> => {
      const ex: Exercise = {
        id: repo.newId("ex"),
        name: name.trim(),
        source: "custom",
        libraryId: null,
        primaryMuscle,
        equipment: null,
        category: null,
        mechanic: null,
        force: null,
        createdAt: Date.now(),
      };
      await repo.putExercise(ex);
      await reload();
      return ex;
    },
    [reload]
  );

  const renameExercise = useCallback(
    async (id: string, name: string) => {
      await repo.updateExercise(id, { name: name.trim() });
      await reload();
    },
    [reload]
  );

  const setExerciseMuscle = useCallback(
    async (id: string, muscle: MuscleGroup | null) => {
      await repo.updateExercise(id, { primaryMuscle: muscle });
      await reload();
    },
    [reload]
  );

  const removeExercise = useCallback(
    async (id: string) => {
      await repo.deleteExercise(id);
      await reload();
    },
    [reload]
  );

  const saveWorkout = useCallback(
    async (w: Workout) => {
      await repo.putWorkout(w);
      await reload();
    },
    [reload]
  );

  const removeWorkout = useCallback(
    async (id: string) => {
      await repo.deleteWorkout(id);
      await reload();
    },
    [reload]
  );

  const exercisesById = useMemo(
    () => new Map(exercises.map((e) => [e.id, e])),
    [exercises]
  );

  const usedExerciseIds = useMemo(() => {
    const s = new Set<string>();
    for (const w of workouts) for (const e of w.entries) s.add(e.exerciseId);
    return s;
  }, [workouts]);

  const isExerciseUsed = useCallback(
    (id: string) => usedExerciseIds.has(id),
    [usedExerciseIds]
  );

  const value: StoreValue = {
    loading,
    exercises,
    workouts,
    exercisesById,
    reload,
    adoptFromCatalog,
    createCustom,
    renameExercise,
    setExerciseMuscle,
    removeExercise,
    saveWorkout,
    removeWorkout,
    isExerciseUsed,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
