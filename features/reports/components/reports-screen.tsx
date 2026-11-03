"use client";
import {
  api,
  dateLabel,
  exportData,
  label,
  number,
  post,
  query,
  rupees,
  useApi,
  type Actions,
  type Aggregate,
  type Period,
  type Row,
} from "@/lib/cms/client";
import {
  Badge,
  Button,
  LoadState,
  Panel,
  RecordDetail,
  Stats,
  Table,
} from "@/components/cms/ui";
import { attempt, type ScreenProps } from "@/components/cms/screen-utils";

function recordFinanceReviewDialog(actions: Actions, period: Period) {
  actions.dialog({
    title: "Record Finance Review",
    body: (
      <p className="muted">
        Records that finance reviewed this market statement for {period.from} to{" "}
        {period.to}.
      </p>
    ),
    fields: [
      {
        name: "reason",
        label: "Review reason (min 3 characters)",
        required: true,
        value: "Periodic ledger reconciliation",
      },
      {
        name: "note",
        label: "Review findings or audit note",
        required: true,
      },
    ],
    submitLabel: "Record review",
    submit: async (form) => {
      const reason = String(form.get("reason") || "").trim();
      const note = String(form.get("note") || "").trim();
      if (reason.length < 3)
        throw new Error("Reason must be at least 3 characters.");
      if (!note) throw new Error("Note is required.");
      await post("/admin/reports/reviews", {
        from_date: period.from,
        to_date: period.to,
        reason,
        note,
      });
      actions.refresh();
      actions.notify("Finance review recorded successfully.");
    },
  });
}
export function ReportsScreen({ period, actions }: ScreenProps) {
  const state = useApi<
    [
      Aggregate<{
        rows: {
          measure: string;
          label: string;
          value: number | string;
          unit: string;
          audit_basis: string;
        }[];
        coverage: Record<string, string>;
      }>,
      Aggregate<{ status: string; controls: Row[] }>,
    ]
  >([
    `/admin/reports/statement?${query(period)}`,
    `/admin/reports/reconciliation?${query(period)}`,
  ]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [statement, reconciliation] = state.data;
  const rows = statement.data.rows;
  const summaryMeasures = [
    "gross_fare_revenue",
    "total_bookings",
    "delivered_orders",
    "rider_net_earnings",
  ];
  const summaryRows = summaryMeasures.flatMap((measure) =>
    rows.filter((row) => row.measure === measure),
  );
  return (
    <>
      <Stats
        items={summaryRows.map((r) => ({
          label: r.label,
          value: r.unit === "MONEY" ? rupees(r.value) : number(r.value),
          note: dateLabel(period),
        }))}
      />
      <div className="notice">
        <Badge>Reconciliation</Badge>Operational statement for the selected
        booking cohort.
      </div>
      <Panel
        title="Operational statement"
        sub={`${dateLabel(period)} · amounts in INR`}
        action={
          <div className="flex items-center gap-2">
            <Button onClick={() => recordFinanceReviewDialog(actions, period)}>
              Record review
            </Button>
            <Button
              primary
              onClick={() =>
                attempt(actions, async () => {
                  await exportData("finance_statement", period);
                  actions.notify("Statement exported.");
                })
              }
            >
              Download CSV
            </Button>
          </div>
        }
      >
        <Table
          heads={["Measure", "Selected period", "Unit", "Audit basis"]}
          rows={rows.map((r) => [
            r.label,
            r.unit === "MONEY" ? rupees(r.value) : number(r.value),
            r.unit,
            r.audit_basis,
          ])}
        />
      </Panel>
      <div className="grid">
        <Panel title="Audit history" sub="Find the history of a record">
          <div className="actions">
            <Button
              onClick={() =>
                actions.dialog({
                  title: "Find audit history",
                  body: (
                    <p>
                      Enter the record type and ID to view its audit history.
                    </p>
                  ),
                  fields: [
                    {
                      name: "entity_type",
                      label: "Record type",
                      required: true,
                    },
                    { name: "entity_id", label: "Record ID", required: true },
                  ],
                  submitLabel: "View audit",
                  submit: async (form) => {
                    const type = String(form.get("entity_type") || "").trim();
                    const id = String(form.get("entity_id") || "").trim();
                    if (
                      !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                        id,
                      )
                    )
                      throw new Error("Enter a valid record ID.");
                    const params = new URLSearchParams({
                      entity_type: type,
                      entity_id: id,
                    });
                    const rows = await api<unknown[]>(`/admin/audit?${params}`);
                    setTimeout(
                      () =>
                        actions.dialog({
                          title: "Audit history",
                          body: rows.length ? (
                            <RecordDetail record={rows} />
                          ) : (
                            <p>No audit history found for this record.</p>
                          ),
                        }),
                      0,
                    );
                  },
                })
              }
            >
              View audit
            </Button>
          </div>
        </Panel>
        <Panel
          title="Review & controls"
          sub="Reconciliation status for the selected period"
        >
          <Table
            heads={["Control", "Status"]}
            rows={reconciliation.data.controls.map((r) => [
              String(r.name),
              <Badge key="s">{label(r.status)}</Badge>,
            ])}
          />
        </Panel>
      </div>
    </>
  );
}
