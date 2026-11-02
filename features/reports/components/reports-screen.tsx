"use client";
import {
  api,
  dateLabel,
  exportData,
  label,
  number,
  query,
  rupees,
  useApi,
  type Aggregate,
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
        <Panel
          title="Export package"
          sub="CSV generated from the same API data"
        >
          <p>Selected-period operational statement</p>
          <p className="muted">
            YTD values, GST/TDS accounting and multi-sheet workbooks require
            backend support. No annual totals are inferred.
          </p>
          <div className="actions">
            <Button
              onClick={() =>
                attempt(actions, async () => {
                  await exportData("finance_statement", period);
                  actions.notify("Statement downloaded.");
                })
              }
            >
              Download CSV
            </Button>
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
          sub="Bank and gateway evidence is not available"
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
