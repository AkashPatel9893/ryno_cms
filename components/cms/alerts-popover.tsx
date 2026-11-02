"use client";

import { motion } from "motion/react";

import { Spinner } from "@/components/ui/spinner";
import { Bell, BellOff, RefreshCw } from "lucide-react";
import { Popover } from "radix-ui";
import { dateTime } from "@/lib/cms/format";
import type { Page, Row } from "@/lib/cms/types";

type AlertsPopoverProps = {
  alerts: Page<Row> | null;
  loading: boolean;
  error: string | null;
  onRefresh: () => void;
};

export function AlertsPopover({
  alerts,
  loading,
  error,
  onRefresh,
}: AlertsPopoverProps) {
  const activeAlerts =
    alerts?.items.filter((alert) => alert.status !== "RESOLVED") ?? [];

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          className="notification rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-orange-600"
          aria-label="Operational alerts"
        >
          <Bell size={20} aria-hidden="true" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          asChild
          align="end"
          sideOffset={12}
          collisionPadding={12}
          aria-label="Operational alerts"
          className="z-[100] w-[360px] max-w-[calc(100vw-24px)] overflow-hidden overscroll-contain rounded-2xl border border-[var(--line)] bg-[var(--surface)] text-[var(--ink)] shadow-[0_16px_44px_#17181224,0_2px_8px_#1718120a] outline-none"
        >
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-start justify-between gap-4 border-b border-[var(--line)] px-5 py-4">
              <div>
                <h2 className="m-0 text-sm font-semibold">
                  Operational alerts
                </h2>
                <p className="mt-1 text-xs text-[var(--muted)]">
                  Recent alerts requiring attention
                </p>
              </div>
              <button
                type="button"
                onClick={onRefresh}
                aria-label="Refresh alerts"
                className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface-hover)] focus-visible:outline-2 focus-visible:outline-orange-600"
              >
                <RefreshCw size={16} aria-hidden="true" />
              </button>
            </div>
            <div
              className="max-h-[min(360px,50vh)] overflow-y-auto overscroll-contain"
              aria-live="polite"
            >
              {loading && !alerts ? (
                <p
                  className="flex items-center justify-center gap-2 px-5 py-8 text-sm text-[var(--muted)]"
                  role="status"
                >
                  <Spinner /> Loading alerts…
                </p>
              ) : error ? (
                <p className="px-5 py-8 text-center text-sm text-[var(--accent-text)]">
                  Couldn’t load alerts. Try refreshing.
                </p>
              ) : activeAlerts.length === 0 ? (
                <div className="flex flex-col items-center px-6 py-9 text-center">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-[var(--surface-subtle)] text-[var(--muted)]">
                    <BellOff size={18} aria-hidden="true" />
                  </span>
                  <p className="text-sm font-semibold">No active alerts</p>
                  <p className="mt-1 text-xs leading-5 text-[var(--muted)]">
                    You’re all caught up on recent operational alerts.
                  </p>
                </div>
              ) : (
                <ul className="m-0 list-none p-0">
                  {activeAlerts.map((alert) => (
                    <li
                      key={alert.id}
                      className="border-b border-[var(--line)] px-5 py-4 last:border-0"
                    >
                      <p className="text-sm leading-5 font-semibold">
                        {String(alert.title || "Operational alert")}
                      </p>
                      <p className="mt-1.5 text-xs text-[var(--muted)]">
                        {String(alert.status || "Open").replaceAll("_", " ")} ·{" "}
                        {dateTime(alert.created_at)}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
