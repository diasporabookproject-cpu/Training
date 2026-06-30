// App data context: the ONLY bridge between components and the Dexie layer.
// Loads exercises + workouts, exposes mutations, keeps React state in sync,
// and (when signed in) reconciles everything with Supabase via the sync engine.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { CatalogExercise, Exercise, MuscleGroup, Workout } from "@/types";
import * as repo from "./db";
import type { BackupV1 } from "./db";
import { isSyncConfigured, supabase } from "./supabase";
import { fullSync } from "./sync";

export type SyncStatus = "disabled" | "signedOut" | "idle" | "syncing" | "error" | "offline";

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
  mergeImport: (backup: BackupV1) => Promise<void>;
  replaceImport: (backup: BackupV1) => Promise<void>;

  // Cloud sync
  syncEnabled: boolean;
  userEmail: string | null;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncAt: number | null;
  signUp: (email: string, password: string) => Promise<{ needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  syncNow: () => Promise<void>;
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

  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(
    isSyncConfigured ? "signedOut" : "disabled"
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  const reload = useCallback(async () => {
    const [ex, wk] = await Promise.all([repo.getExercises(), repo.getWorkouts()]);
    ex.sort((a, b) => a.name.localeCompare(b.name, "fr"));
    setExercises(ex);
    setWorkouts(wk);
  }, []);

  // ── Initial load ──────────────────────────────────────────────────────────
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        await repo.requestPersistence();
        await reload();
        setLastSyncAt(await repo.getLastSyncAt());
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [reload]);

  // ── Sync engine (debounced, guarded against overlap) ───────────────────────
  const userIdRef = useRef<string | null>(null);
  userIdRef.current = userId;
  const syncingRef = useRef(false);
  const syncTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runSync = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid) return;
    if (syncingRef.current) return;
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      setSyncStatus("offline");
      return;
    }
    syncingRef.current = true;
    setSyncStatus("syncing");
    setSyncError(null);
    try {
      await fullSync(uid);
      await reload();
      const ts = await repo.getLastSyncAt();
      setLastSyncAt(ts);
      setSyncStatus("idle");
    } catch (err) {
      console.error("[CHARGE] sync failed:", err);
      setSyncError(err instanceof Error ? err.message : "Erreur de synchronisation");
      setSyncStatus("error");
    } finally {
      syncingRef.current = false;
    }
  }, [reload]);

  const scheduleSync = useCallback(
    (delay = 1200) => {
      if (!userIdRef.current) return;
      if (syncTimer.current) clearTimeout(syncTimer.current);
      syncTimer.current = setTimeout(() => void runSync(), delay);
    },
    [runSync]
  );

  // ── Auth wiring ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isSyncConfigured) return;
    let unsub: (() => void) | undefined;

    supabase.auth.getSession().then(({ data }) => {
      const u = data.session?.user ?? null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      if (u) {
        setSyncStatus("idle");
        void runSync();
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      const u = session?.user ?? null;
      const wasSignedOut = userIdRef.current === null;
      setUserId(u?.id ?? null);
      setUserEmail(u?.email ?? null);
      if (u) {
        setSyncStatus("idle");
        if (wasSignedOut) void runSync(); // fresh login → reconcile immediately
      } else {
        setSyncStatus("signedOut");
      }
    });
    unsub = () => sub.subscription.unsubscribe();

    // Re-sync when coming back online or refocusing the app.
    const onOnline = () => scheduleSync(200);
    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleSync(200);
    };
    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unsub?.();
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runSync, scheduleSync]);

  // ── Mutations (stamp updatedAt, persist, refresh, schedule sync) ───────────
  const afterMutation = useCallback(async () => {
    await reload();
    scheduleSync();
  }, [reload, scheduleSync]);

  const adoptFromCatalog = useCallback(
    async (cat: CatalogExercise): Promise<Exercise> => {
      const existing = await repo.findAdoptedByLibraryId(cat.libraryId);
      if (existing) return existing;
      const now = Date.now();
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
        createdAt: now,
        updatedAt: now,
        deleted: false,
      };
      await repo.putExercise(ex);
      await afterMutation();
      return ex;
    },
    [afterMutation]
  );

  const createCustom = useCallback(
    async (name: string, primaryMuscle: MuscleGroup | null): Promise<Exercise> => {
      const now = Date.now();
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
        createdAt: now,
        updatedAt: now,
        deleted: false,
      };
      await repo.putExercise(ex);
      await afterMutation();
      return ex;
    },
    [afterMutation]
  );

  const renameExercise = useCallback(
    async (id: string, name: string) => {
      await repo.updateExercise(id, { name: name.trim() });
      await afterMutation();
    },
    [afterMutation]
  );

  const setExerciseMuscle = useCallback(
    async (id: string, muscle: MuscleGroup | null) => {
      await repo.updateExercise(id, { primaryMuscle: muscle });
      await afterMutation();
    },
    [afterMutation]
  );

  const removeExercise = useCallback(
    async (id: string) => {
      await repo.deleteExercise(id);
      await afterMutation();
    },
    [afterMutation]
  );

  const saveWorkout = useCallback(
    async (w: Workout) => {
      await repo.putWorkout({ ...w, updatedAt: Date.now(), deleted: false });
      await afterMutation();
    },
    [afterMutation]
  );

  const removeWorkout = useCallback(
    async (id: string) => {
      await repo.deleteWorkout(id);
      await afterMutation();
    },
    [afterMutation]
  );

  const mergeImport = useCallback(
    async (backup: BackupV1) => {
      await repo.mergeBackup(backup);
      await afterMutation();
    },
    [afterMutation]
  );

  const replaceImport = useCallback(
    async (backup: BackupV1) => {
      await repo.importBackup(backup);
      await afterMutation();
    },
    [afterMutation]
  );

  // ── Auth actions ─────────────────────────────────────────────────────────
  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw new Error(error.message);
    // If email confirmation is enabled, no session is returned yet.
    return { needsConfirmation: !data.session };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw new Error(error.message);
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUserId(null);
    setUserEmail(null);
    setSyncStatus(isSyncConfigured ? "signedOut" : "disabled");
  }, []);

  const syncNow = useCallback(async () => {
    await runSync();
  }, [runSync]);

  // ── Derived ────────────────────────────────────────────────────────────────
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
    mergeImport,
    replaceImport,
    syncEnabled: isSyncConfigured,
    userEmail,
    syncStatus,
    syncError,
    lastSyncAt,
    signUp,
    signIn,
    signOut,
    syncNow,
  };

  return <StoreCtx.Provider value={value}>{children}</StoreCtx.Provider>;
}
