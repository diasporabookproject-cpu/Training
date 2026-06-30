// Pure business logic: 1RM, per-session metrics, trend (linear regression),
// and per-muscle aggregation. No I/O here so it's trivially testable.

import type { Exercise, Workout, WorkoutEntry, WorkoutSet } from "@/types";

export type Metric = "e1rm" | "maxWeight" | "volume";

export const METRIC_LABELS: Record<Metric, string> = {
  e1rm: "1RM estimé",
  maxWeight: "Poids max",
  volume: "Volume total",
};

export const METRIC_UNITS: Record<Metric, string> = {
  e1rm: "kg",
  maxWeight: "kg",
  volume: "kg",
};

/** Epley estimated 1RM. 0 if weight or reps <= 0. */
export function epley1RM(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return weight * (1 + reps / 30);
}

export function setVolume(s: WorkoutSet): number {
  return Math.max(0, s.weight) * Math.max(0, s.reps);
}

/** A set is "valid" (counts toward stats / saving) if weight & reps > 0. */
export function isValidSet(s: WorkoutSet): boolean {
  return s.weight > 0 && s.reps > 0;
}

/** Value of one exercise within one workout, for the chosen metric. */
export function entryMetric(entry: WorkoutEntry, metric: Metric): number {
  const sets = entry.sets.filter(isValidSet);
  if (sets.length === 0) return 0;
  switch (metric) {
    case "e1rm":
      return Math.max(...sets.map((s) => epley1RM(s.weight, s.reps)));
    case "maxWeight":
      return Math.max(...sets.map((s) => s.weight));
    case "volume":
      return sets.reduce((acc, s) => acc + setVolume(s), 0);
  }
}

export function entryE1RM(entry: WorkoutEntry): number {
  return entryMetric(entry, "e1rm");
}

export function entryVolume(entry: WorkoutEntry): number {
  return entryMetric(entry, "volume");
}

export type SeriesPoint = { date: string; value: number };

/** One value per session (where the exercise appears with valid sets), oldest→newest. */
export function metricSeries(
  workouts: Workout[],
  exerciseId: string,
  metric: Metric
): SeriesPoint[] {
  const points: SeriesPoint[] = [];
  for (const w of workouts) {
    const entry = w.entries.find((e) => e.exerciseId === exerciseId);
    if (!entry) continue;
    const value = entryMetric(entry, metric);
    if (value > 0) points.push({ date: w.date, value });
  }
  return points.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

export type TrendVerdict = "up" | "flat" | "down" | "unknown";

export type Trend = {
  verdict: TrendVerdict;
  slope: number; // raw slope per session
  normalizedSlopePct: number; // slope / mean * 100
  changePct: number; // (last - first) / first * 100
  sessions: number;
  first: number;
  last: number;
  best: number;
  /** trendline values aligned to the input series indices */
  line: number[];
};

/** Least-squares linear regression on (index, value). */
function linreg(values: number[]): { slope: number; intercept: number } {
  const n = values.length;
  if (n < 2) return { slope: 0, intercept: values[0] ?? 0 };
  let sx = 0,
    sy = 0,
    sxx = 0,
    sxy = 0;
  for (let i = 0; i < n; i++) {
    sx += i;
    sy += values[i];
    sxx += i * i;
    sxy += i * values[i];
  }
  const denom = n * sxx - sx * sx;
  if (denom === 0) return { slope: 0, intercept: sy / n };
  const slope = (n * sxy - sx * sy) / denom;
  const intercept = (sy - slope * sx) / n;
  return { slope, intercept };
}

const TREND_THRESHOLD = 1.2; // %/session

export function computeTrend(series: SeriesPoint[]): Trend {
  const sessions = series.length;
  const values = series.map((p) => p.value);
  const best = values.length ? Math.max(...values) : 0;

  if (sessions < 2) {
    return {
      verdict: "unknown",
      slope: 0,
      normalizedSlopePct: 0,
      changePct: 0,
      sessions,
      first: values[0] ?? 0,
      last: values[0] ?? 0,
      best,
      line: values.slice(),
    };
  }

  const { slope, intercept } = linreg(values);
  const mean = values.reduce((a, b) => a + b, 0) / sessions;
  const normalizedSlopePct = mean !== 0 ? (slope / mean) * 100 : 0;
  const first = values[0];
  const last = values[sessions - 1];
  const changePct = first !== 0 ? ((last - first) / first) * 100 : 0;

  let verdict: TrendVerdict = "flat";
  if (normalizedSlopePct > TREND_THRESHOLD) verdict = "up";
  else if (normalizedSlopePct < -TREND_THRESHOLD) verdict = "down";

  const line = values.map((_, i) => intercept + slope * i);

  return {
    verdict,
    slope,
    normalizedSlopePct,
    changePct,
    sessions,
    first,
    last,
    best,
    line,
  };
}

/** Σ volume grouped by primaryMuscle of the adopted exercise, over given workouts. */
export function volumeByMuscle(
  workouts: Workout[],
  exercises: Exercise[]
): { muscle: string; volume: number }[] {
  const byId = new Map(exercises.map((e) => [e.id, e]));
  const totals = new Map<string, number>();
  for (const w of workouts) {
    for (const entry of w.entries) {
      const ex = byId.get(entry.exerciseId);
      const muscle = ex?.primaryMuscle ?? "non spécifié";
      const vol = entry.sets.filter(isValidSet).reduce((a, s) => a + setVolume(s), 0);
      if (vol <= 0) continue;
      totals.set(muscle, (totals.get(muscle) ?? 0) + vol);
    }
  }
  return [...totals.entries()]
    .map(([muscle, volume]) => ({ muscle, volume }))
    .sort((a, b) => b.volume - a.volume);
}

/** Whether the last session set a personal record on the metric. */
export function isPR(series: SeriesPoint[]): boolean {
  if (series.length < 1) return false;
  const last = series[series.length - 1].value;
  const prior = series.slice(0, -1).map((p) => p.value);
  if (prior.length === 0) return false;
  return last > Math.max(...prior);
}
