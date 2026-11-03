"use client";
import { Play } from "lucide-react";
import {
  dateLabel,
  label,
  number,
  post,
  query,
  rupees,
  useApi,
  type Aggregate,
  type Row,
} from "@/lib/cms/client";
import { type ScreenProps } from "@/components/cms/screen-utils";
import {
  Badge,
  Button,
  LoadState,
  Panel,
  Stats,
  Table,
} from "@/components/cms/ui";

function runPayoutsDialog(actions: ScreenProps["actions"]) {
  actions.dialog({
    title: "Execute Driver Payout Run",
    body: (
      <p className="muted">
        Trigger a payout batch run for eligible driver wallets to their verified
        primary bank accounts.
      </p>
    ),
    fields: [
      {
        name: "cadence",
        label: "Payout Cadence",
        required: true,
        options: [
          { value: "MANUAL", label: "Manual on-demand run" },
          { value: "DAILY", label: "Daily settlement run" },
          { value: "WEEKLY", label: "Weekly settlement run" },
        ],
      },
      {
        name: "reason",
        label: "Payout run reason",
        required: true,
        value: "Driver earnings settlement from CMS",
      },
    ],
    submitLabel: "Execute payout run",
    submit: async (form) => {
      const cadence = String(form.get("cadence") || "MANUAL");
      const reason = String(
        form.get("reason") || "Driver earnings settlement",
      ).trim();
      const results = await post<unknown[]>("/admin/payouts/run", {
        cadence,
        reason,
      });
      actions.refresh();
      actions.notify(
        Array.isArray(results) && results.length > 0
          ? `Payout run complete: ${results.length} payout(s) initiated.`
          : "Payout run completed. No eligible balances met the withdrawal threshold.",
      );
    },
  });
}

function resolvePayoutDialog(actions: ScreenProps["actions"]) {
  actions.dialog({
    title: "Resolve Payout Exception",
    body: (
      <p className="muted">
        Retry a failed payout, confirm manual bank clearance, or reverse unpaid
        funds back to the driver wallet.
      </p>
    ),
    fields: [
      {
        name: "payout_id",
        label: "Payout ID (UUID)",
        required: true,
      },
      {
        name: "action",
        label: "Resolution action",
        required: true,
        options: [
          { value: "retry", label: "Retry failed payout transfer" },
          { value: "mark-paid", label: "Mark as paid (bank confirmed credit)" },
          {
            value: "reverse",
            label: "Reverse (credit funds back to driver wallet)",
          },
        ],
      },
      {
        name: "reason",
        label: "Reason for action (min 3 characters)",
        required: true,
        value: "Operations exception resolution",
      },
    ],
    submitLabel: "Execute payout action",
    submit: async (form) => {
      const payoutId = String(form.get("payout_id") || "").trim();
      const action = String(form.get("action") || "retry");
      const reason = String(
        form.get("reason") || "Operations resolution",
      ).trim();

      if (!payoutId) throw new Error("Payout ID is required.");
      if (reason.length < 3)
        throw new Error("Reason must be at least 3 characters.");

      if (action === "retry") {
        await post(`/admin/payouts/${payoutId}/retry`, {});
      } else {
        await post(`/admin/payouts/${payoutId}/${action}`, { reason });
      }
      actions.refresh();
      actions.notify(
        `Payout ${payoutId.slice(0, 8)}: ${action} executed successfully.`,
      );
    },
  });
}

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
          Payment and payout totals from the operational statement. You can
          trigger driver payout settlement runs directly.
        </span>
      </div>
      <Panel
        title="Payment and payout totals"
        sub="Selected period, except balances marked as current"
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => resolvePayoutDialog(actions)}>
              Resolve payout
            </Button>
            <Button primary onClick={() => runPayoutsDialog(actions)}>
              <Play size={14} className="inline mr-1" /> Run payouts
            </Button>
          </div>
        }
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
