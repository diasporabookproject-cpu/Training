import { useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Award, Minus, TrendingDown, TrendingUp } from "lucide-react";
import { muscleLabel } from "@/types";
import { useStore } from "@/data/store";
import {
  computeTrend,
  isPR,
  METRIC_LABELS,
  metricSeries,
  volumeByMuscle,
  type Metric,
  type TrendVerdict,
} from "@/lib/stats";
import { fmt, fmtDate, fmtSigned } from "@/lib/format";
import { Card, SectionTitle } from "@/components/ui";
import { cn } from "@/lib/cn";

const METRICS: Metric[] = ["e1rm", "maxWeight", "volume"];

const TOOLTIP_STYLE = {
  background: "#121826",
  border: "1px solid #222c40",
  borderRadius: 12,
  color: "#e8edf5",
} as const;

export function ProgresTab() {
  const { workouts, exercises } = useStore();
  const [view, setView] = useState<"exercise" | "muscle">("exercise");
  const [exerciseId, setExerciseId] = useState<string>("");
  const [metric, setMetric] = useState<Metric>("e1rm");

  const exercisesWithData = useMemo(() => {
    const ids = new Set<string>();
    for (const w of workouts) for (const e of w.entries) ids.add(e.exerciseId);
    return exercises.filter((e) => ids.has(e.id));
  }, [workouts, exercises]);

  const activeId =
    exerciseId && exercisesWithData.some((e) => e.id === exerciseId)
      ? exerciseId
      : exercisesWithData[0]?.id ?? "";

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Progrès</h1>
        <p className="text-sm text-muted">Suis ta tendance dans le temps.</p>
      </header>

      <div className="grid grid-cols-2 gap-2">
        <ToggleButton active={view === "exercise"} onClick={() => setView("exercise")}>
          Par exercice
        </ToggleButton>
        <ToggleButton active={view === "muscle"} onClick={() => setView("muscle")}>
          Par groupe musculaire
        </ToggleButton>
      </div>

      {view === "exercise" ? (
        exercisesWithData.length === 0 ? (
          <EmptyState />
        ) : (
          <>
            <select
              value={activeId}
              onChange={(e) => setExerciseId(e.target.value)}
              className="h-12 w-full rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-ink"
              aria-label="Choisir un exercice"
            >
              {exercisesWithData.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-3 gap-2">
              {METRICS.map((m) => (
                <ToggleButton key={m} active={metric === m} onClick={() => setMetric(m)} small>
                  {METRIC_LABELS[m]}
                </ToggleButton>
              ))}
            </div>

            <ExerciseProgress exerciseId={activeId} metric={metric} />
          </>
        )
      ) : (
        <MuscleProgress />
      )}
    </div>
  );
}

function ExerciseProgress({
  exerciseId,
  metric,
}: {
  exerciseId: string;
  metric: Metric;
}) {
  const { workouts, exercisesById } = useStore();

  const series = useMemo(
    () => metricSeries(workouts, exerciseId, metric),
    [workouts, exerciseId, metric]
  );
  const trend = useMemo(() => computeTrend(series), [series]);
  const pr = useMemo(() => isPR(series), [series]);
  const ex = exercisesById.get(exerciseId);

  const chartData = series.map((p, i) => ({
    label: fmtDate(p.date),
    value: Math.round(p.value * 10) / 10,
    trend: Math.round(trend.line[i] * 10) / 10,
  }));

  return (
    <div className="space-y-3">
      <TrendBanner verdict={trend.verdict} changePct={trend.changePct} sessions={trend.sessions} />

      <div className="grid grid-cols-2 gap-2">
        <Card className="p-3">
          <p className="text-xs text-muted">Dernière séance</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-2xl font-bold tnum">
            {fmt(trend.last)}
            <span className="text-sm font-normal text-muted">kg</span>
            {pr && (
              <span className="inline-flex items-center gap-1 rounded-md bg-up/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-up">
                <Award size={11} /> Record
              </span>
            )}
          </p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-muted">Meilleur</p>
          <p className="mt-0.5 text-2xl font-bold tnum">
            {fmt(trend.best)}
            <span className="text-sm font-normal text-muted"> kg</span>
          </p>
        </Card>
      </div>

      <Card className="p-3">
        <p className="mb-2 px-1 text-xs text-muted">
          {METRIC_LABELS[metric]} · {ex?.name}
        </p>
        {chartData.length < 2 ? (
          <p className="px-1 py-8 text-center text-sm text-muted">
            Au moins 2 séances sont nécessaires pour tracer une courbe.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <ComposedChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
              <CartesianGrid stroke="#222c40" vertical={false} />
              <XAxis
                dataKey="label"
                tick={{ fill: "#8a96ac", fontSize: 11 }}
                tickLine={false}
                axisLine={{ stroke: "#222c40" }}
                interval="preserveStartEnd"
              />
              <YAxis
                tick={{ fill: "#8a96ac", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={44}
              />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                labelStyle={{ color: "#8a96ac" }}
                formatter={(v: number, name) => [
                  `${fmt(v)} kg`,
                  name === "trend" ? "Tendance" : METRIC_LABELS[metric],
                ]}
              />
              <Line
                type="monotone"
                dataKey="trend"
                stroke="#8a96ac"
                strokeWidth={1.5}
                strokeDasharray="5 4"
                dot={false}
                isAnimationActive={false}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f59e0b"
                strokeWidth={2.5}
                dot={{ r: 3, fill: "#f59e0b" }}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
              />
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </Card>
    </div>
  );
}

function MuscleProgress() {
  const { workouts, exercises } = useStore();
  const data = useMemo(() => volumeByMuscle(workouts, exercises), [workouts, exercises]);

  if (data.length === 0) return <EmptyState />;

  const chartData = data.map((d) => ({
    label: muscleLabel(d.muscle),
    volume: Math.round(d.volume),
  }));
  const max = Math.max(...chartData.map((d) => d.volume), 1);

  return (
    <div className="space-y-3">
      <SectionTitle>Volume total par groupe musculaire</SectionTitle>
      <Card className="p-3">
        <ResponsiveContainer width="100%" height={Math.max(180, chartData.length * 38)}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 4, right: 12, bottom: 4, left: 4 }}
          >
            <CartesianGrid stroke="#222c40" horizontal={false} />
            <XAxis type="number" hide domain={[0, max]} />
            <YAxis
              type="category"
              dataKey="label"
              width={104}
              tick={{ fill: "#e8edf5", fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip
              cursor={{ fill: "#ffffff08" }}
              contentStyle={TOOLTIP_STYLE}
              formatter={(v: number) => [`${fmt(v)} kg`, "Volume"]}
            />
            <Bar dataKey="volume" radius={[0, 6, 6, 0]} maxBarSize={26}>
              {chartData.map((_, i) => (
                <Cell key={i} fill="#f59e0b" />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <p className="px-1 text-xs text-muted">
        Σ (poids × reps) cumulé sur tout l'historique. Utile pour repérer un groupe
        musculaire en retard.
      </p>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
  small,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
  small?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "rounded-xl border text-center font-medium transition-colors",
        small ? "h-10 px-1 text-xs" : "h-11 px-2 text-sm",
        active
          ? "border-accent bg-accent-soft text-accent"
          : "border-line bg-panel text-muted active:bg-panel-2"
      )}
    >
      {children}
    </button>
  );
}

const TREND_STYLE: Record<
  TrendVerdict,
  { label: string; cls: string; Icon: typeof TrendingUp }
> = {
  up: { label: "En progression", cls: "border-up/40 bg-up/10 text-up", Icon: TrendingUp },
  flat: { label: "Plateau", cls: "border-flat/40 bg-flat/10 text-flat", Icon: Minus },
  down: { label: "En recul", cls: "border-down/40 bg-down/10 text-down", Icon: TrendingDown },
  unknown: { label: "À suivre", cls: "border-line bg-panel text-muted", Icon: Minus },
};

function TrendBanner({
  verdict,
  changePct,
  sessions,
}: {
  verdict: TrendVerdict;
  changePct: number;
  sessions: number;
}) {
  const { label, cls, Icon } = TREND_STYLE[verdict];
  return (
    <div className={cn("flex items-center gap-3 rounded-2xl border p-4", cls)}>
      <Icon size={28} className="shrink-0" />
      <div className="min-w-0">
        <p className="text-lg font-bold leading-tight">{label}</p>
        <p className="text-sm opacity-90">
          {verdict === "unknown" ? (
            `${sessions} séance${sessions > 1 ? "s" : ""} — encore un peu de données`
          ) : (
            <>
              <span className="tnum font-semibold">{fmtSigned(changePct)} %</span> depuis le
              début · {sessions} séances
            </>
          )}
        </p>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="p-8 text-center">
      <p className="text-sm text-muted">
        Pas encore de données.
        <br />
        Enregistre quelques séances pour voir ta progression.
      </p>
    </Card>
  );
}
