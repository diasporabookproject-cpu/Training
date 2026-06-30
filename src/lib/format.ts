// Small formatting helpers, French-locale aware.

const NF1 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });
const NF0 = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 });

/** Compact number: drops trailing .0, French decimal comma. */
export function fmt(n: number): string {
  if (!isFinite(n)) return "0";
  return Math.abs(n) >= 100 ? NF0.format(Math.round(n)) : NF1.format(n);
}

export function fmtKg(n: number): string {
  return `${fmt(n)} kg`;
}

export function fmtSigned(n: number): string {
  const s = fmt(Math.abs(n));
  if (n > 0) return `+${s}`;
  if (n < 0) return `−${s}`;
  return s;
}

/** Today as 'YYYY-MM-DD' in local time. */
export function todayISO(): string {
  const d = new Date();
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10);
}

/** 'YYYY-MM-DD' → e.g. "lun. 30 juin". */
export function fmtDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  const date = new Date(y, m - 1, d);
  return date.toLocaleDateString("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

export function daysSince(ts: number): number {
  return Math.floor((Date.now() - ts) / 86400000);
}

/** Parse a user-typed number allowing a French decimal comma. */
export function parseNum(raw: string): number {
  const cleaned = raw.replace(",", ".").replace(/[^0-9.\-]/g, "");
  const n = parseFloat(cleaned);
  return isFinite(n) ? n : 0;
}
