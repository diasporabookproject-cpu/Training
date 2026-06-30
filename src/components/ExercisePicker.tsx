// The exercise selector: searches "Mes exercices" first, then the embedded
// catalog (limited), and offers custom creation when nothing matches.

import { useEffect, useMemo, useRef, useState } from "react";
import { Plus, Search, Star } from "lucide-react";
import type { CatalogExercise, Exercise, MuscleGroup } from "@/types";
import { muscleLabel } from "@/types";
import { normalize, searchCatalog } from "@/data/catalog";
import { useStore } from "@/data/store";
import { useToast } from "./toast";
import { Button, Sheet, Tag } from "./ui";
import { MuscleSelect } from "./MuscleSelect";

export function ExercisePicker({
  open,
  onClose,
  onPick,
  excludeIds,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (exercise: Exercise) => void;
  excludeIds?: Set<string>;
}) {
  const { exercises, adoptFromCatalog, createCustom } = useStore();
  const toast = useToast();
  const [query, setQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState<CatalogExercise[]>([]);
  const [searching, setSearching] = useState(false);
  const [customMuscle, setCustomMuscle] = useState<MuscleGroup | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery("");
      setCatalogResults([]);
      setCustomMuscle(null);
      // Delay focus until the sheet has mounted.
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Debounced catalog search.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (!q) {
      setCatalogResults([]);
      return;
    }
    setSearching(true);
    const t = setTimeout(async () => {
      try {
        setCatalogResults(await searchCatalog(q, 30));
      } catch (e) {
        console.error(e);
      } finally {
        setSearching(false);
      }
    }, 140);
    return () => clearTimeout(t);
  }, [query, open]);

  const nq = normalize(query);

  // Adopted exercises matching the query (or all when query empty).
  const mine = useMemo(() => {
    const list = exercises.filter((e) => !excludeIds?.has(e.id));
    if (!nq) return list;
    return list.filter((e) => normalize(e.name).includes(nq));
  }, [exercises, nq, excludeIds]);

  // Catalog results whose exact name isn't already adopted (avoid dupes).
  const adoptedLibIds = useMemo(
    () => new Set(exercises.map((e) => e.libraryId).filter(Boolean)),
    [exercises]
  );
  const catalogFiltered = useMemo(
    () => catalogResults.filter((c) => !adoptedLibIds.has(c.libraryId)),
    [catalogResults, adoptedLibIds]
  );

  const exactExists = useMemo(() => {
    if (!nq) return true;
    const inMine = exercises.some((e) => normalize(e.name) === nq);
    const inCatalog = catalogResults.some((c) => normalize(c.name) === nq);
    return inMine || inCatalog;
  }, [exercises, catalogResults, nq]);

  async function handleAdopt(cat: CatalogExercise) {
    if (busy) return;
    setBusy(true);
    try {
      const ex = await adoptFromCatalog(cat);
      onPick(ex);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  function handlePickMine(ex: Exercise) {
    if (busy) return;
    onPick(ex);
  }

  async function handleCreate() {
    const name = query.trim();
    if (!name || busy) return;
    setBusy(true);
    try {
      const ex = await createCustom(name, customMuscle);
      toast(`« ${ex.name} » créé`, "success");
      onPick(ex);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Erreur", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Ajouter un exercice">
      <div className="relative mb-3">
        <Search
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher (ex. développé couché)…"
          enterKeyHint="search"
          className="h-12 w-full rounded-xl border border-line bg-panel-2 pl-10 pr-3 text-[15px] text-ink placeholder:text-muted"
        />
      </div>

      {/* Mes exercices */}
      {mine.length > 0 && (
        <div className="mb-4">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-accent">
            Mes exercices
          </p>
          <ul className="space-y-1.5">
            {mine.map((ex) => (
              <li key={ex.id}>
                <button
                  onClick={() => handlePickMine(ex)}
                  disabled={busy}
                  className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-panel-2 px-3 py-3 text-left active:bg-line disabled:opacity-50"
                >
                  <span className="flex items-center gap-2">
                    <Star size={15} className="shrink-0 text-accent" />
                    <span className="text-[15px]">{ex.name}</span>
                  </span>
                  <span className="flex shrink-0 gap-1">
                    {ex.primaryMuscle && <Tag>{muscleLabel(ex.primaryMuscle)}</Tag>}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Catalogue */}
      {query.trim() !== "" && (
        <div className="mb-4">
          <p className="mb-1.5 px-1 text-xs font-semibold uppercase tracking-wider text-muted">
            Catalogue {searching ? "…" : `(${catalogFiltered.length})`}
          </p>
          {catalogFiltered.length === 0 && !searching ? (
            <p className="px-1 text-sm text-muted">Aucun résultat dans le catalogue.</p>
          ) : (
            <ul className="space-y-1.5">
              {catalogFiltered.map((cat) => (
                <li key={cat.libraryId}>
                  <button
                    onClick={() => handleAdopt(cat)}
                    disabled={busy}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-line bg-panel px-3 py-3 text-left active:bg-panel-2 disabled:opacity-50"
                  >
                    <span className="text-[15px]">{cat.name}</span>
                    <span className="flex shrink-0 flex-wrap justify-end gap-1">
                      {cat.primaryMuscle && <Tag>{muscleLabel(cat.primaryMuscle)}</Tag>}
                      {cat.equipment && <Tag>{cat.equipment}</Tag>}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Création custom */}
      {query.trim() !== "" && !exactExists && (
        <div className="rounded-xl border border-dashed border-accent/50 bg-accent-soft p-3">
          <p className="mb-2 text-sm">
            Créer « <span className="font-semibold text-accent">{query.trim()}</span> »
          </p>
          <div className="mb-2">
            <MuscleSelect value={customMuscle} onChange={setCustomMuscle} />
            <p className="mt-1 px-1 text-[11px] text-muted">
              Optionnel, mais recommandé pour les stats par groupe musculaire.
            </p>
          </div>
          <Button
            variant="primary"
            className="w-full"
            onClick={handleCreate}
            disabled={busy}
          >
            <Plus size={18} /> Créer cet exercice
          </Button>
        </div>
      )}

      {query.trim() === "" && mine.length === 0 && (
        <p className="px-1 py-6 text-center text-sm text-muted">
          Recherchez un exercice dans le catalogue (873 mouvements) ou créez le vôtre.
        </p>
      )}
    </Sheet>
  );
}
