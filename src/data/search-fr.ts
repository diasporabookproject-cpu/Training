// French-aware search for the (English) exercise catalog. We DON'T translate
// the displayed names; instead, when the user types French gym terms, we expand
// each term to the English token(s) that appear in catalog names and match on
// those. English queries keep working (unknown tokens match literally).

/** Normalize for accent/case-insensitive matching. */
export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();
}

// Tiny words ignored in queries (FR + EN articles/prepositions).
const STOPWORDS = new Set([
  "de", "du", "des", "la", "le", "les", "l", "un", "une", "a", "au", "aux",
  "et", "ou", "en", "pour", "avec", "sur", "the", "with", "of", "to", "and",
]);

// French gym term → English substrings found in catalog names.
// Keys are NORMALIZED (no accents, lowercase).
const FR_EN: Record<string, string[]> = {
  // Mouvements principaux
  developpe: ["press"],
  developpes: ["press"],
  couche: ["bench"],
  couchee: ["bench"],
  militaire: ["overhead", "military"],
  presse: ["press"],
  curl: ["curl"],
  curls: ["curl"],
  flexion: ["curl"],
  flexions: ["curl"],
  extension: ["extension"],
  extensions: ["extension"],
  elevation: ["raise"],
  elevations: ["raise"],
  releve: ["raise", "sit-up"],
  releves: ["raise", "sit-up"],
  ecarte: ["fly", "flye"],
  ecartes: ["fly", "flye"],
  tirage: ["row", "pulldown", "pull-down"],
  tirages: ["row", "pulldown"],
  rowing: ["row"],
  traction: ["pull-up", "pullup", "pull up", "chin"],
  tractions: ["pull-up", "pullup", "chin"],
  pompe: ["push-up", "pushup", "push up"],
  pompes: ["push-up", "pushup", "push up"],
  squat: ["squat"],
  squats: ["squat"],
  souleve: ["deadlift"],
  souleves: ["deadlift"],
  terre: ["deadlift"],
  fente: ["lunge"],
  fentes: ["lunge"],
  crunch: ["crunch"],
  crunchs: ["crunch"],
  gainage: ["plank"],
  planche: ["plank"],
  haussement: ["shrug"],
  haussements: ["shrug"],
  shrug: ["shrug"],
  epaule: ["clean", "shoulder"],
  arrache: ["snatch"],
  jete: ["jerk"],
  saut: ["jump"],
  sauts: ["jump"],
  saute: ["jump"],
  dips: ["dip"],
  dip: ["dip"],
  rotation: ["rotation", "twist"],
  torsion: ["twist"],
  oiseau: ["bent-over", "bent over", "rear"],

  // Matériel
  haltere: ["dumbbell"],
  halteres: ["dumbbell"],
  barre: ["barbell", "bar"],
  poulie: ["cable"],
  poulies: ["cable"],
  cable: ["cable"],
  machine: ["machine"],
  smith: ["smith"],
  kettlebell: ["kettlebell"],
  kettlebells: ["kettlebell"],
  elastique: ["band"],
  elastiques: ["band"],
  corde: ["rope"],
  banc: ["bench"],
  poids: ["weighted", "weight"],

  // Position / variantes
  assis: ["seated"],
  assise: ["seated"],
  debout: ["standing"],
  allonge: ["lying"],
  allongee: ["lying"],
  incline: ["incline"],
  inclinee: ["incline"],
  decline: ["decline"],
  declinee: ["decline"],
  inverse: ["reverse"],
  inversee: ["reverse"],
  prise: ["grip"],
  serree: ["close-grip", "close grip", "narrow"],
  serre: ["close-grip", "close"],
  large: ["wide", "wide-grip"],
  prone: ["prone"],
  supine: ["supine"],
  unilateral: ["one-arm", "single", "one arm"],
  nuque: ["behind neck", "behind-the-neck"],
  marteau: ["hammer"],

  // Groupes musculaires / parties du corps
  pectoraux: ["chest"],
  pecs: ["chest"],
  poitrine: ["chest"],
  dos: ["back"],
  epaules: ["shoulder"],
  biceps: ["biceps", "bicep"],
  triceps: ["triceps", "tricep"],
  jambe: ["leg"],
  jambes: ["leg"],
  cuisse: ["thigh", "leg"],
  cuisses: ["thigh", "leg"],
  mollet: ["calf"],
  mollets: ["calf", "calves"],
  fessier: ["glute"],
  fessiers: ["glute", "glutes"],
  ischio: ["hamstring"],
  ischios: ["hamstring", "hamstrings"],
  ischiojambiers: ["hamstring"],
  quadriceps: ["quadriceps", "quad"],
  quadri: ["quad"],
  abdominaux: ["abdominal", "abs", "crunch", "ab"],
  abdos: ["abdominal", "abs", "crunch"],
  abdo: ["ab", "abs"],
  adducteurs: ["adductor"],
  abducteurs: ["abductor"],
  trapezes: ["trap", "shrug"],
  trapeze: ["trap"],
  bras: ["arm"],
  avantbras: ["forearm"],
  poignet: ["wrist"],
  poignets: ["wrist"],
  hanche: ["hip"],
  hanches: ["hip"],
  cou: ["neck"],
  genou: ["knee"],
  genoux: ["knee"],
  lombaires: ["lower back"],
  buste: ["sit-up", "torso"],
  laterale: ["lateral", "side"],
  lateral: ["lateral", "side"],
  laterales: ["lateral", "side"],
  frontale: ["front"],
  frontal: ["front"],
};

/** Split a query into meaningful normalized tokens. */
export function tokenizeQuery(query: string): string[] {
  return normalize(query)
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length > 0 && !STOPWORDS.has(t));
}

/** Candidate English substrings to look for, for one French/English token. */
function expand(token: string): string[] {
  return FR_EN[token] ?? [token];
}

/**
 * True if every query token has at least one candidate substring present in
 * the (normalized) exercise name.
 */
export function nameMatches(normName: string, tokens: string[]): boolean {
  for (const tok of tokens) {
    const candidates = expand(tok);
    if (!candidates.some((c) => normName.includes(normalize(c)))) return false;
  }
  return true;
}

/** Lower = better. Rewards early matches and prefix/word-start hits. */
export function scoreMatch(normName: string, tokens: string[]): number {
  let score = 0;
  for (const tok of tokens) {
    let best = Infinity;
    for (const c of expand(tok)) {
      const pos = normName.indexOf(normalize(c));
      if (pos === -1) continue;
      let s = pos;
      if (pos === 0) s -= 100;
      else if (normName[pos - 1] === " ") s -= 40;
      best = Math.min(best, s);
    }
    if (best !== Infinity) score += best;
  }
  return score;
}

/** Convenience for matching a single name against a raw query string. */
export function matchesQuery(name: string, query: string): boolean {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return true;
  return nameMatches(normalize(name), tokens);
}
