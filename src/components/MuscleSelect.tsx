import { MUSCLE_GROUPS, MUSCLE_LABELS, type MuscleGroup } from "@/types";
import { cn } from "@/lib/cn";

export function MuscleSelect({
  value,
  onChange,
  allowEmpty = true,
  id,
  className,
}: {
  value: MuscleGroup | null;
  onChange: (m: MuscleGroup | null) => void;
  allowEmpty?: boolean;
  id?: string;
  className?: string;
}) {
  return (
    <select
      id={id}
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as MuscleGroup | null)}
      className={cn(
        "h-11 w-full rounded-xl border border-line bg-panel-2 px-3 text-[15px] text-ink",
        className
      )}
    >
      {allowEmpty && <option value="">— Groupe musculaire —</option>}
      {MUSCLE_GROUPS.map((m) => (
        <option key={m} value={m}>
          {MUSCLE_LABELS[m]}
        </option>
      ))}
    </select>
  );
}
