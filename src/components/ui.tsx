// Lightweight shadcn-style primitives — just enough for CHARGE, no CLI.

import {
  forwardRef,
  type ButtonHTMLAttributes,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
} from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "ghost" | "outline" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-accent text-bg font-semibold hover:bg-amber-400 active:bg-amber-500",
  ghost: "bg-transparent text-ink hover:bg-panel-2 active:bg-line",
  outline: "border border-line bg-panel text-ink hover:bg-panel-2 active:bg-line",
  danger: "bg-down/15 text-down border border-down/40 hover:bg-down/25",
};

const SIZES: Record<Size, string> = {
  sm: "h-9 px-3 text-sm rounded-lg",
  md: "h-11 px-4 text-[15px] rounded-xl",
  lg: "h-12 px-5 text-base rounded-xl",
};

export const Button = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }
>(({ className, variant = "outline", size = "md", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex items-center justify-center gap-2 select-none transition-colors",
      "disabled:opacity-40 disabled:pointer-events-none",
      VARIANTS[variant],
      SIZES[size],
      className
    )}
    {...props}
  />
));
Button.displayName = "Button";

/** Square icon button, min 44px touch target. */
export const IconButton = forwardRef<
  HTMLButtonElement,
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }
>(({ className, variant = "outline", ...props }, ref) => (
  <button
    ref={ref}
    className={cn(
      "inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition-colors",
      "disabled:opacity-40 disabled:pointer-events-none",
      VARIANTS[variant],
      className
    )}
    {...props}
  />
));
IconButton.displayName = "IconButton";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-2xl border border-line bg-panel/80 backdrop-blur-sm",
        className
      )}
      {...props}
    />
  );
}

export function Tag({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md bg-panel-2 px-1.5 py-0.5 text-[11px] text-muted",
        className
      )}
    >
      {children}
    </span>
  );
}

export function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="px-1 text-xs font-semibold uppercase tracking-wider text-muted">
      {children}
    </h2>
  );
}

/** Bottom sheet modal (mobile-first). */
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className="max-h-[88vh] w-full overflow-hidden rounded-t-3xl border-t border-line bg-panel safe-bottom animate-[slideup_.18s_ease-out]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <IconButton variant="ghost" onClick={onClose} aria-label="Fermer">
            <X size={20} />
          </IconButton>
        </div>
        <div className="max-h-[78vh] overflow-y-auto overscroll-contain p-4">
          {children}
        </div>
      </div>
      <style>{`@keyframes slideup{from{transform:translateY(12px);opacity:.6}to{transform:translateY(0);opacity:1}}`}</style>
    </div>
  );
}

/** Confirmation dialog. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirmer",
  danger,
  onConfirm,
  onCancel,
}: {
  open: boolean;
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-6"
      onClick={onCancel}
      role="alertdialog"
      aria-modal="true"
    >
      <Card
        className="w-full max-w-sm p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="mt-2 text-sm text-muted">{message}</div>
        <div className="mt-5 flex gap-2">
          <Button variant="ghost" className="flex-1" onClick={onCancel}>
            Annuler
          </Button>
          <Button
            variant={danger ? "danger" : "primary"}
            className="flex-1"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </Card>
    </div>
  );
}

/** Transient toast messages. */
export function Toast({
  message,
  tone = "info",
}: {
  message: string;
  tone?: "info" | "error" | "success";
}) {
  const toneCls =
    tone === "error"
      ? "border-down/50 text-down"
      : tone === "success"
        ? "border-up/50 text-up"
        : "border-line text-ink";
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-24 z-[70] flex justify-center px-4">
      <div
        className={cn(
          "pointer-events-auto max-w-sm rounded-xl border bg-panel px-4 py-3 text-sm shadow-lg",
          toneCls
        )}
        role="status"
      >
        {message}
      </div>
    </div>
  );
}
