import { Minus, Plus } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { parseNum } from "@/lib/format";
import { cn } from "@/lib/cn";

/**
 * Numeric stepper with +/- buttons AND keyboard entry.
 * Accepts a French decimal comma; clamps at 0.
 */
export function Stepper({
  value,
  onChange,
  step,
  mode = "decimal",
  ariaLabel,
}: {
  value: number;
  onChange: (v: number) => void;
  step: number;
  mode?: "decimal" | "numeric";
  ariaLabel: string;
}) {
  // Keep a local text buffer so typing "12," mid-edit isn't clobbered.
  const [text, setText] = useState(formatVal(value));
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current) setText(formatVal(value));
  }, [value]);

  function formatVal(v: number): string {
    if (v === 0) return "";
    return String(Math.round(v * 100) / 100).replace(".", ",");
  }

  function bump(delta: number) {
    const next = Math.max(0, Math.round((value + delta) * 100) / 100);
    onChange(next);
    setText(formatVal(next));
  }

  return (
    <div className="flex items-stretch overflow-hidden rounded-xl border border-line bg-panel-2">
      <button
        type="button"
        aria-label={`${ariaLabel} moins`}
        onClick={() => bump(-step)}
        className="flex w-11 shrink-0 items-center justify-center text-muted active:bg-line"
      >
        <Minus size={18} />
      </button>
      <input
        aria-label={ariaLabel}
        inputMode={mode}
        type="text"
        value={text}
        placeholder="0"
        onFocus={(e) => {
          focused.current = true;
          e.currentTarget.select();
        }}
        onBlur={() => {
          focused.current = false;
          setText(formatVal(value));
        }}
        onChange={(e) => {
          const raw = e.target.value;
          setText(raw);
          onChange(parseNum(raw));
        }}
        className={cn(
          "w-full min-w-0 border-x border-line bg-transparent py-3 text-center text-xl font-semibold tnum text-ink",
          "focus:bg-panel"
        )}
      />
      <button
        type="button"
        aria-label={`${ariaLabel} plus`}
        onClick={() => bump(step)}
        className="flex w-11 shrink-0 items-center justify-center text-accent active:bg-line"
      >
        <Plus size={18} />
      </button>
    </div>
  );
}
