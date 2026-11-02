"use client";

import { motion } from "motion/react";

import { useQuery } from "@tanstack/react-query";
import { Spinner } from "@/components/ui/spinner";
import { Activity, RefreshCw } from "lucide-react";
import { Popover } from "radix-ui";

type HealthStatus = "healthy" | "degraded" | "unavailable";

async function getHealth(): Promise<HealthStatus> {
  const response = await fetch("/api/health", {
    cache: "no-store",
    signal: AbortSignal.timeout(7000),
  });
  if (!response.ok) return "unavailable";
  const data: unknown = await response.json();
  if (
    typeof data === "object" &&
    data !== null &&
    "status" in data &&
    (data.status === "healthy" ||
      data.status === "degraded" ||
      data.status === "unavailable")
  )
    return data.status;
  return "unavailable";
}

export function BackendHealth() {
  const health = useQuery({
    queryKey: ["backend-health"],
    queryFn: getHealth,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    retry: false,
  });
  const status = health.isError ? "unavailable" : health.data;
  const label = !status
    ? "Checking"
    : status === "healthy"
      ? "Healthy"
      : status === "degraded"
        ? "Degraded"
        : "Unavailable";
  const dot = !status
    ? "bg-[#a0a6a0]"
    : status === "healthy"
      ? "bg-[#268251]"
      : status === "degraded"
        ? "bg-[#d88a17]"
        : "bg-[#c53d2a]";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={`Backend health: ${label}`}
          className="inline-flex items-center gap-2 rounded-full border border-[#e5e7e2] bg-white px-3 py-2 text-xs font-medium text-[#4c5650] hover:bg-[#f7f8f5] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600"
        >
          <span className={`h-2 w-2 rounded-full ${dot}`} aria-hidden="true" />
          <span className="hidden sm:inline">Backend {label}</span>
          <span className="sm:hidden">{label}</span>
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          asChild
          align="end"
          sideOffset={10}
          collisionPadding={12}
          aria-label="Backend health"
          className="z-[100] w-[280px] max-w-[calc(100vw-24px)] rounded-2xl border border-[#e5e7e2] bg-white p-4 text-[#20251f] shadow-[0_16px_44px_#17181224,0_2px_8px_#1718120a] outline-none"
        >
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#f4f5f2] text-[#647067]">
                <Activity size={18} aria-hidden="true" />
              </span>
              <div>
                <h2 className="text-sm font-semibold">Backend health</h2>
                <p className="mt-1 text-xs text-[#777f78]" role="status">
                  {label}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs leading-5 text-[#777f78]">
              {status === "healthy"
                ? "Backend, database and Redis are ready."
                : status === "degraded"
                  ? "The backend is reachable, but a dependency is unavailable."
                  : status === "unavailable"
                    ? "The backend health check could not be reached."
                    : "Checking backend readiness…"}
            </p>
            <button
              type="button"
              onClick={() => void health.refetch()}
              disabled={health.isFetching}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-[#e5e7e2] px-3 py-2 text-xs font-semibold hover:bg-[#f5f5f2] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-orange-600"
            >
              {health.isFetching ? (
                <Spinner className="h-3.5 w-3.5" />
              ) : (
                <RefreshCw size={14} aria-hidden="true" />
              )}
              {health.isFetching ? "Checking…" : "Refresh status"}
            </button>
          </motion.div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
