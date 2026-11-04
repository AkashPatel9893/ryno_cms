"use client";
import {
  dateLabel,
  label,
  number,
  query,
  rupees,
  useApi,
  type Aggregate,
  type Row,
} from "@/lib/cms/client";
import { type ScreenProps } from "@/components/cms/screen-utils";
import { Badge, LoadState, Panel, Stats, Table } from "@/components/cms/ui";

export function PaymentsScreen({ period, actions }: ScreenProps) {
  const state = useApi<
    [
      Aggregate<{
        rows: {
          measure: string;
          label: string;
          unit: string;
          value: string | number;
          audit_basis: string;
        }[];
      }>,
      Aggregate<{ controls: Row[] }>,
    ]
  >([
    `/admin/reports/statement?${query(period)}`,
    `/admin/reports/reconciliation?${query(period)}`,
  ]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [statement, reconciliation] = state.data;
  const rows = statement.data.rows.filter((row) =>
    /collection|refund|payout|wallet|earning/i.test(row.label),
  );
  const summaryMeasures = [
    "gateway_collections",
    "cash_collections",
    "processed_refunds",
    "rider_paid_payouts",
  ];
  const summaryRows = summaryMeasures.flatMap((measure) =>
    rows.filter((row) => row.measure === measure),
  );
  return (
    <>
      <Stats
        items={summaryRows.map((row) => ({
          label: row.label,
          value: row.unit === "MONEY" ? rupees(row.value) : number(row.value),
          note: dateLabel(period),
        }))}
      />
      <div className="notice">
        <Badge>Payments &amp; Settlements</Badge>
        <span>
          Payment and payout totals from the operational statement. Driver
          payout runs are coming soon.
        </span>
      </div>
      <Panel
        title="Payment and payout totals"
        sub="Selected period, except balances marked as current"
      >
        <Table
          heads={["Measure", "Amount", "How it is calculated"]}
          rows={rows.map((row) => [
            row.label,
            row.unit === "MONEY" ? rupees(row.value) : number(row.value),
            row.audit_basis,
          ])}
        />
      </Panel>
      <Panel
        title="Driver payouts"
        sub="Wallet balances, payout batches and receipts"
        action={<Badge>Coming soon</Badge>}
      >
        {/* Settlement and payout-batch APIs are on hold with the backend team. Running payouts
            without the batch preview step would pay every eligible driver unreviewed. */}
        <p className="muted">
          Reviewing driver wallets and running payouts will be available here
          soon. Until then, payouts are handled by the finance team outside the
          CMS.
        </p>
      </Panel>
      <Panel
        title="Reconciliation"
        sub="Gateway collections and payment reconciliation status"
      >
        <Table
          heads={["Control", "Status", "Reason"]}
          rows={reconciliation.data.controls.map((row) => [
            String(row.name),
            <Badge key="status">{label(row.status)}</Badge>,
            String(row.reason || "—"),
          ])}
        />
      </Panel>
    </>
  );
}
