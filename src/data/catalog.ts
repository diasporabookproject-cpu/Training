// Lazy access to the embedded free-exercise-db catalog (873 exercises,
// Unlicense / public domain). The JSON is bundled so search works fully
// offline. We never store the whole catalog in Dexie — only adopted
// exercises get copied there.

import type { CatalogExercise, MuscleGroup } from "@/types";
import { MUSCLE_GROUPS } from "@/types";
import { nameMatches, normalize, scoreMatch, tokenizeQuery } from "./search-fr";

// Re-export so existing importers keep working.
export { normalize };

type RawExercise = {
  id: string;
  name: string;
  force: string | null;
  level: string | null;
  mechanic: string | null;
  equipment: string | null;
  primaryMuscles: string[];
  secondaryMuscles: string[];
  category: string | null;
  images: string[];
};

const MUSCLE_SET = new Set<string>(MUSCLE_GROUPS);

function mapEquipment(eq: string | null): string | null {
  if (eq == null) return "non spécifié";
  if (eq === "body only") return "poids du corps";
  return eq;
}

function asMuscle(m: string | undefined): MuscleGroup | null {
  return m && MUSCLE_SET.has(m) ? (m as MuscleGroup) : null;
}

function mapRaw(raw: RawExercise): CatalogExercise {
  return {
    libraryId: raw.id,
    name: raw.name,
    primaryMuscle: asMuscle(raw.primaryMuscles?.[0]),
    secondaryMuscles: raw.secondaryMuscles ?? [],
    equipment: mapEquipment(raw.equipment),
    category: raw.category,
    mechanic: raw.mechanic,
    force: raw.force,
    image: raw.images?.[0]
      ? // Kept for a future "show images" toggle; not displayed in v1.
        raw.images[0]
      : null,
  };
}

let catalogPromise: Promise<CatalogExercise[]> | null = null;
type IndexedCatalog = { items: CatalogExercise[]; normNames: string[] };
let indexed: IndexedCatalog | null = null;

/** Load + map + index the catalog once, on first selector open. */
export async function loadCatalog(): Promise<CatalogExercise[]> {
  if (catalogPromise) return catalogPromise;
  catalogPromise = import("./exercises-library.json").then((mod) => {
    const raw = (mod.default ?? mod) as RawExercise[];
    const items = raw.map(mapRaw);
    indexed = {
      items,
      normNames: items.map((e) => normalize(e.name)),
    };
    return items;
  });
  return catalogPromise;
}

/**
 * Search the catalog (French- or English-typed). Every query token must match
 * (after FR→EN expansion); results ranked by earliest / word-start matches.
 * Returns at most `limit` items.
 */
export async function searchCatalog(
  query: string,
  limit = 30
): Promise<CatalogExercise[]> {
  await loadCatalog();
  if (!indexed) return [];
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return [];
  const scored: { item: CatalogExercise; score: number }[] = [];
  for (let i = 0; i < indexed.items.length; i++) {
    const name = indexed.normNames[i];
    if (!nameMatches(name, tokens)) continue;
    scored.push({ item: indexed.items[i], score: scoreMatch(name, tokens) });
  }
  scored.sort((a, b) => a.score - b.score || a.item.name.length - b.item.name.length);
  return scored.slice(0, limit).map((s) => s.item);
}
