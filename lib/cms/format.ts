import type { Period } from "@/lib/cms/types";

export function query(period: Period, extra: Record<string, string> = {}) {
  return new URLSearchParams({
    ...period,
    ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value)),
  }).toString();
}

export function rupees(value: unknown) {
  return value == null
    ? "Not available"
    : new Intl.NumberFormat("en-IN", {
        style: "currency",
        currency: "INR",
        maximumFractionDigits: 2,
        minimumFractionDigits: 0,
      }).format(Number(value));
}

export function number(value: unknown) {
  return Number(value || 0).toLocaleString("en-IN");
}

export function label(value: unknown) {
  return value == null
    ? "Not available"
    : String(value)
        .toLowerCase()
        .split("_")
        .map((s) => s[0]?.toUpperCase() + s.slice(1))
        .join(" ");
}

export function dateTime(value: unknown) {
  if (!value) return "Not available";
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kolkata",
  }).format(new Date(String(value)));
}

export function dateLabel(period: Period) {
  return (
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      timeZone: "Asia/Kolkata",
    }).format(new Date(period.from)) +
    " – " +
    new Intl.DateTimeFormat("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Kolkata",
    }).format(new Date(period.to))
  );
}

/** The best phone number a row carries: the full number when the backend sends it, else the masked one. */
export function phoneOf(source: Record<string, unknown>) {
  const value = source.phone_full || source.phone || source.phone_masked;
  return value ? String(value) : "Phone unavailable";
}
