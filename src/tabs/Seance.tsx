import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, Copy, Plus, Save, Trash2 } from "lucide-react";
import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from "@/types";
import { muscleLabel } from "@/types";
import { useStore } from "@/data/store";
import {
  clearDraft,
  getDraft,
  lastSetsForExercise,
  newId,
  saveDraft,
} from "@/data/db";
import { entryE1RM, entryVolume, isValidSet } from "@/lib/stats";
import { fmt, fmtDate, todayISO } from "@/lib/format";
import { useToast } from "@/components/toast";
import { Button, Card, ConfirmDialog, IconButton, SectionTitle, Tag } from "@/components/ui";
import { Stepper } from "@/components/Stepper";
import { ExercisePicker } from "@/components/ExercisePicker";

const WEIGHT_STEP = 2.5;
const REPS_STEP = 1;

export function SeanceTab() {
  const { exercisesById, saveWorkout, removeWorkout } = useStore();
  const toast = useToast();

  const [date, setDate] = useState(todayISO());
  const [entries, setEntries] = useState<WorkoutEntry[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Workout | null>(null);

  // Restore autosaved draft on first mount.
  useEffect(() => {
    (async () => {
      try {
        const draft = await getDraft();
        if (draft) {
          setDate(draft.date || todayISO());
          setEntries(draft.entries ?? []);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // Autosave draft (debounced) whenever the in-progress session changes.
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!loaded) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (entries.length === 0) {
        clearDraft().catch(() => {});
      } else {
        saveDraft({ date, entries }).catch((e) =>
          toast(e instanceof Error ? e.message : "Échec de l'autosave", "error")
        );
      }
    }, 400);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [date, entries, loaded, toast]);

  const excludeIds = useMemo(
    () => new Set(entries.map((e) => e.exerciseId)),
    [entries]
  );

  const addExercise = useCallback(async (ex: Exercise) => {
    setPickerOpen(false);
    let sets: WorkoutSet[];
    try {
      const last = await lastSetsForExercise(ex.id);
      sets = last && last.length > 0 ? last : [{ weight: 0, reps: 0 }];
    } catch {
      sets = [{ weight: 0, reps: 0 }];
    }
    setEntries((prev) =>
      prev.some((e) => e.exerciseId === ex.id)
        ? prev
        : [...prev, { exerciseId: ex.id, sets }]
    );
  }, []);

  function updateSet(ei: number, si: number, patch: Partial<WorkoutSet>) {
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === ei
          ? {
              ...entry,
              sets: entry.sets.map((s, j) => (j === si ? { ...s, ...patch } : s)),
            }
          : entry
      )
    );
  }

  function addSet(ei: number) {
    setEntries((prev) =>
      prev.map((entry, i) => {
        if (i !== ei) return entry;
        const last = entry.sets[entry.sets.length - 1] ?? { weight: 0, reps: 0 };
        return { ...entry, sets: [...entry.sets, { ...last }] };
      })
    );
  }

  function removeSet(ei: number, si: number) {
    setEntries((prev) =>
      prev.map((entry, i) =>
        i === ei
          ? { ...entry, sets: entry.sets.filter((_, j) => j !== si) }
          : entry
      )
    );
  }

  function removeEntry(ei: number) {
    setEntries((prev) => prev.filter((_, i) => i !== ei));
  }

  const validEntries = useMemo(
    () =>
      entries
        .map((e) => ({ ...e, sets: e.sets.filter(isValidSet) }))
        .filter((e) => e.sets.length > 0),
    [entries]
  );
  const canSave = validEntries.length > 0;

  async function handleSave() {
    if (!canSave) return;
    const workout: Workout = {
      id: newId("wk"),
      date,
      entries: validEntries,
      createdAt: Date.now(),
    };
    try {
      await saveWorkout(workout);
      await clearDraft();
      setEntries([]);
      setDate(todayISO());
      toast("Séance enregistrée 💪", "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Échec de l'enregistrement", "error");
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Séance</h1>
          <p className="text-sm text-muted">Note tes séries en direct.</p>
        </div>
        <input
          type="date"
          value={date}
          max={todayISO()}
          onChange={(e) => setDate(e.target.value || todayISO())}
          className="h-11 rounded-xl border border-line bg-panel-2 px-3 text-sm text-ink"
          aria-label="Date de la séance"
        />
      </header>

      {entries.length === 0 && (
        <Card className="p-6 text-center">
          <p className="text-sm text-muted">
            Aucun exercice pour l'instant.
            <br />
            Ajoute ton premier mouvement pour commencer.
          </p>
        </Card>
      )}

      <div className="space-y-3">
        {entries.map((entry, ei) => {
          const ex = exercisesById.get(entry.exerciseId);
          const best = entryE1RM(entry);
          return (
            <Card key={entry.exerciseId} className="overflow-hidden">
              <div className="flex items-start justify-between gap-2 border-b border-line px-4 py-3">
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-semibold">
                    {ex?.name ?? "Exercice supprimé"}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {ex?.primaryMuscle && <Tag>{muscleLabel(ex.primaryMuscle)}</Tag>}
                    {best > 0 && (
                      <span className="text-[11px] text-muted">
                        1RM est. <span className="tnum text-accent">{fmt(best)} kg</span>
                      </span>
                    )}
                  </div>
                </div>
                <IconButton
                  variant="ghost"
                  aria-label="Retirer l'exercice"
                  onClick={() => removeEntry(ei)}
                >
                  <Trash2 size={18} className="text-muted" />
                </IconButton>
              </div>

              <div className="space-y-2.5 p-3">
                <div className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2 px-1 text-[11px] font-medium uppercase tracking-wide text-muted">
                  <span>#</span>
                  <span>Poids (kg)</span>
                  <span>Reps</span>
                  <span />
                </div>
                {entry.sets.map((set, si) => (
                  <div
                    key={si}
                    className="grid grid-cols-[1.5rem_1fr_1fr_2.75rem] items-center gap-2"
                  >
                    <span className="text-center text-sm font-semibold tnum text-muted">
                      {si + 1}
                    </span>
                    <Stepper
                      value={set.weight}
                      onChange={(v) => updateSet(ei, si, { weight: v })}
                      step={WEIGHT_STEP}
                      mode="decimal"
                      ariaLabel={`Série ${si + 1} poids`}
                    />
                    <Stepper
                      value={set.reps}
                      onChange={(v) => updateSet(ei, si, { reps: Math.round(v) })}
                      step={REPS_STEP}
                      mode="numeric"
                      ariaLabel={`Série ${si + 1} répétitions`}
                    />
                    <IconButton
                      variant="ghost"
                      aria-label={`Supprimer la série ${si + 1}`}
                      onClick={() => removeSet(ei, si)}
                      disabled={entry.sets.length <= 1}
                    >
                      <Trash2 size={16} className="text-muted" />
                    </IconButton>
                  </div>
                ))}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-accent"
                  onClick={() => addSet(ei)}
                >
                  <Copy size={15} /> + Série
                </Button>
              </div>
            </Card>
          );
        })}
      </div>

      <Button
        variant="outline"
        size="lg"
        className="w-full border-dashed"
        onClick={() => setPickerOpen(true)}
      >
        <Plus size={20} /> Ajouter un exercice
      </Button>

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        disabled={!canSave}
        onClick={handleSave}
      >
        <Save size={20} /> Enregistrer la séance
      </Button>

      <RecentWorkouts onDelete={(w) => setConfirmDelete(w)} />

      <ExercisePicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPick={addExercise}
        excludeIds={excludeIds}
      />

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Supprimer la séance ?"
        message={
          confirmDelete
            ? `Séance du ${fmtDate(confirmDelete.date)} — cette action est définitive.`
            : ""
        }
        confirmLabel="Supprimer"
        danger
        onCancel={() => setConfirmDelete(null)}
        onConfirm={async () => {
          if (confirmDelete) {
            try {
              await removeWorkout(confirmDelete.id);
              toast("Séance supprimée", "info");
            } catch (e) {
              toast(e instanceof Error ? e.message : "Erreur", "error");
            }
          }
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}

function RecentWorkouts({ onDelete }: { onDelete: (w: Workout) => void }) {
  const { workouts, exercisesById } = useStore();
  const [openId, setOpenId] = useState<string | null>(null);

  if (workouts.length === 0) return null;

  return (
    <section className="space-y-2 pt-2">
      <SectionTitle>Séances récentes</SectionTitle>
      <div className="space-y-2">
        {workouts.slice(0, 12).map((w) => {
          const setCount = w.entries.reduce((a, e) => a + e.sets.length, 0);
          const volume = w.entries.reduce((a, e) => a + entryVolume(e), 0);
          const isOpen = openId === w.id;
          return (
            <Card key={w.id} className="overflow-hidden">
              <button
                className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
                onClick={() => setOpenId(isOpen ? null : w.id)}
                aria-expanded={isOpen}
              >
                <div>
                  <p className="text-[15px] font-semibold capitalize">
                    {fmtDate(w.date)}
                  </p>
                  <p className="text-xs text-muted">
                    {w.entries.length} exo{w.entries.length > 1 ? "s" : ""} ·{" "}
                    {setCount} série{setCount > 1 ? "s" : ""} ·{" "}
                    <span className="tnum">{fmt(volume)} kg</span> vol.
                  </p>
                </div>
                <ChevronDown
                  size={18}
                  className={`shrink-0 text-muted transition-transform ${
                    isOpen ? "rotate-180" : ""
                  }`}
                />
              </button>
              {isOpen && (
                <div className="border-t border-line px-4 py-3">
                  <ul className="space-y-2">
                    {w.entries.map((entry, i) => {
                      const ex = exercisesById.get(entry.exerciseId);
                      return (
                        <li key={i} className="text-sm">
                          <p className="font-medium">{ex?.name ?? "(supprimé)"}</p>
                          <p className="text-muted tnum">
                            {entry.sets
                              .map((s) => `${fmt(s.weight)}×${s.reps}`)
                              .join("  ·  ")}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                  <Button
                    variant="danger"
                    size="sm"
                    className="mt-3"
                    onClick={() => onDelete(w)}
                  >
                    <Trash2 size={15} /> Supprimer cette séance
                  </Button>
                </div>
              )}
            </Card>
          );
        })}
      </div>
    </section>
  );
}
