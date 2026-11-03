"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { LoadState } from "@/components/cms/loading-state";
import { useApi, type Actions } from "@/lib/cms/client";
import { DriverReviewPanel } from "@/features/partners/components/driver-verification";

export function DriverVerificationScreen({
  driverId,
  actions,
}: {
  driverId: string;
  actions: Actions;
}) {
  const router = useRouter();
  const driver = useApi<[{ first_name: string; last_name: string | null }]>([
    `/admin/drivers/${encodeURIComponent(driverId)}`,
  ]);
  const name = driver.data
    ? `${driver.data[0].first_name} ${driver.data[0].last_name || ""}`.trim()
    : "";

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <Link
        href="/partners"
        className="text-button inline-flex w-fit items-center gap-2"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Back to partners
      </Link>
      {driver.data ? (
        <DriverReviewPanel
          driverId={driverId}
          driverName={name}
          actions={actions}
          onClose={() => router.push("/partners")}
        />
      ) : (
        <LoadState error={driver.error} retry={actions.refresh} />
      )}
    </div>
  );
}
