"use client";

import { useState, useSyncExternalStore } from "react";
import { Popover } from "radix-ui";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import { DayPicker, type DateRange } from "react-day-picker";
import { dateLabel, type Period } from "@/lib/cms/client";
import type { ReportingPreset } from "@/lib/cms/reporting-periods";

type Props = {
  period: Period | null;
  periods: ReportingPreset[];
  onChange: (period: Period) => void;
};
const DAY_MS = 86_400_000;
const COMPACT_QUERY = "(max-width: 740px)";
function subscribeToViewport(onChange: () => void) {
  const media = window.matchMedia(COMPACT_QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}
function isCompactViewport() {
  return window.matchMedia(COMPACT_QUERY).matches;
}
function serverViewport() {
  return false;
}

function parseDate(value: string): Date | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : undefined;
}
function formatDate(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PeriodControl({ period, periods, onChange }: Props) {
  const compact = useSyncExternalStore(
    subscribeToViewport,
    isCompactViewport,
    serverViewport,
  );
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<Period>({ from: "", to: "" });
  const [month, setMonth] = useState<Date>();
  const [error, setError] = useState("");
  const selectedPreset = periods.find(
    (item) => item.from === period?.from && item.to === period?.to,
  );
  const draftPreset = periods.find(
    (item) => item.from === draft.from && item.to === draft.to,
  );
  const from = parseDate(draft.from);
  const to = parseDate(draft.to);
  const selected: DateRange | undefined = from
    ? { from, to: to && to >= from ? to : undefined }
    : undefined;

  function handleOpen(next: boolean) {
    if (next) {
      const initial = period ?? { from: "", to: "" };
      setDraft(initial);
      setMonth(parseDate(initial.from));
      setError("");
    }
    setOpen(next);
  }
  function selectRange(range: DateRange | undefined) {
    setDraft({
      from: range?.from ? formatDate(range.from) : "",
      to: range?.to ? formatDate(range.to) : "",
    });
    setError("");
  }
  function apply() {
    if (!from || !to) return setError("Choose both a start and an end date.");
    const start = Date.parse(`${draft.from}T00:00:00Z`);
    const end = Date.parse(`${draft.to}T00:00:00Z`);
    if (end < start)
      return setError("The end date must be on or after the start date.");
    if ((end - start) / DAY_MS + 1 > 366)
      return setError("Choose a date range of 366 days or less.");
    onChange(draft);
    setOpen(false);
  }

  return (
    <div className="period-control">
      <span id="reporting-period-label">Reporting period</span>
      <Popover.Root open={open} onOpenChange={handleOpen}>
        <Popover.Trigger asChild>
          <button
            type="button"
            className="period-trigger"
            aria-labelledby="reporting-period-label reporting-period-value"
          >
            <CalendarDays size={16} aria-hidden="true" />
            <span id="reporting-period-value">
              {selectedPreset?.label ??
                (period ? dateLabel(period) : "Select dates")}
            </span>
            <ChevronDown size={16} aria-hidden="true" />
          </button>
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content
            className="period-popover"
            align="end"
            sideOffset={8}
            collisionPadding={12}
            aria-label="Choose reporting period"
          >
            <div className="period-picker-body">
              <div className="period-presets" aria-label="Quick date ranges">
                <span className="period-presets-title">Quick ranges</span>
                {periods.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="period-preset"
                    aria-pressed={draftPreset?.id === item.id}
                    onClick={() => {
                      setDraft({ from: item.from, to: item.to });
                      setMonth(parseDate(item.from));
                      setError("");
                    }}
                  >
                    {item.label}
                    {draftPreset?.id === item.id && (
                      <Check size={15} aria-hidden="true" />
                    )}
                  </button>
                ))}
              </div>
              <div className="period-calendar">
                <DayPicker
                  mode="range"
                  selected={selected}
                  onSelect={selectRange}
                  month={month}
                  onMonthChange={setMonth}
                  numberOfMonths={compact ? 1 : 2}
                  weekStartsOn={1}
                  resetOnSelect
                  navLayout="around"
                  aria-label="Select a date range"
                />
              </div>
            </div>
            <div className="period-picker-footer">
              <div className="period-date-inputs">
                <label>
                  From date
                  <input
                    type="date"
                    value={draft.from}
                    onChange={(event) => {
                      const value = event.target.value;
                      setDraft((current) => ({ ...current, from: value }));
                      const nextMonth = parseDate(value);
                      if (nextMonth) setMonth(nextMonth);
                      setError("");
                    }}
                  />
                </label>
                <label>
                  To date
                  <input
                    type="date"
                    value={draft.to}
                    onChange={(event) => {
                      setDraft((current) => ({
                        ...current,
                        to: event.target.value,
                      }));
                      setError("");
                    }}
                  />
                </label>
              </div>
              {error && (
                <p className="period-error" role="alert">
                  {error}
                </p>
              )}
              <div className="period-picker-actions">
                <button
                  type="button"
                  className="period-clear"
                  onClick={() => {
                    setDraft({ from: "", to: "" });
                    setError("");
                  }}
                >
                  Clear
                </button>
                <button type="button" className="period-apply" onClick={apply}>
                  Apply dates
                </button>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    </div>
  );
}
