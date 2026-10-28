/** Display helpers shared by server and client components. */

export function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    cents / 100,
  );
}

export function formatDate(
  iso: string | null | undefined,
  opts: { time?: boolean } = { time: true },
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
    ...(opts.time ? { hour: "numeric", minute: "2-digit" } : {}),
  }).format(d);
}

export function relativeTime(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const diff = Date.parse(iso) - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [60_000, "second"],
    [3_600_000, "minute"],
    [86_400_000, "hour"],
    [Infinity, "day"],
  ];
  const divisors = { second: 1000, minute: 60_000, hour: 3_600_000, day: 86_400_000 };
  const unit = units.find(([limit]) => abs < limit)![1];
  const value = Math.round(diff / divisors[unit as keyof typeof divisors]);
  return new Intl.RelativeTimeFormat("en", { numeric: "auto" }).format(value, unit);
}

export function durationLeft(iso: string | null | undefined, now = Date.now()): string {
  if (!iso) return "";
  const ms = Date.parse(iso) - now;
  if (ms <= 0) return "now";
  const m = Math.floor(ms / 60_000);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 48) return `${h} h ${m % 60} min`;
  const d = Math.floor(h / 24);
  return `${d} d ${h % 24} h`;
}

export function shortId(id: string | null | undefined, keep = 8): string {
  if (!id) return "—";
  return id.length <= keep + 4 ? id : `${id.slice(0, keep)}…`;
}

export function pluralize(n: number, one: string, many = `${one}s`): string {
  return `${n} ${n === 1 ? one : many}`;
}
