import type { Period } from "@/lib/cms/types";

export type ReportingPreset = Period & { id: string; label: string };

const isoDay = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

/** Reporting periods relative to today, so the filters never go stale. */
export function reportingPeriods(now = new Date()): ReportingPreset[] {
  const monthName = (date: Date) =>
    date.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const day = (offset: number) =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate() + offset);
  const weekday = (now.getDay() + 6) % 7;
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const lastYearStart = new Date(now.getFullYear() - 1, 0, 1);
  const lastYearEnd = new Date(now.getFullYear() - 1, 11, 31);
  return [
    { id: "today", label: "Today", from: isoDay(now), to: isoDay(now) },
    {
      id: "yesterday",
      label: "Yesterday",
      from: isoDay(day(-1)),
      to: isoDay(day(-1)),
    },
    {
      id: "week-to-date",
      label: "Week to date",
      from: isoDay(day(-weekday)),
      to: isoDay(now),
    },
    {
      id: "last-week",
      label: "Last week",
      from: isoDay(day(-weekday - 7)),
      to: isoDay(day(-weekday - 1)),
    },
    {
      id: "last-seven",
      label: "Last 7 days",
      from: isoDay(day(-6)),
      to: isoDay(now),
    },
    {
      id: "month-to-date",
      label: `${monthName(now)} to date`,
      from: isoDay(monthStart),
      to: isoDay(now),
    },
    {
      id: "last-month",
      label: monthName(lastMonthStart),
      from: isoDay(lastMonthStart),
      to: isoDay(lastMonthEnd),
    },
    {
      id: "year-to-date",
      label: "Year to date",
      from: isoDay(yearStart),
      to: isoDay(now),
    },
    {
      id: "last-year",
      label: "Last year",
      from: isoDay(lastYearStart),
      to: isoDay(lastYearEnd),
    },
  ];
}
