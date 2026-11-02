"use client";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  api,
  dateTime,
  download,
  exportData,
  label,
  number,
  post,
  query,
  useApi,
  type Page,
  type Row,
} from "@/lib/cms/client";
import { TransferHistory } from "@/features/data/components/transfer-history";
import { attempt, type ScreenProps } from "@/components/cms/screen-utils";
import {
  Badge,
  Button,
  LoadState,
  Panel,
  Stats,
  Table,
  Tabs,
  TextButton,
} from "@/components/cms/ui";

export function DataScreen({ period, actions }: ScreenProps) {
  const [tab, setTab] = useState(0),
    [dataset, setDataset] = useState("customers"),
    [exportSet, setExportSet] = useState("order_register"),
    [file, setFile] = useState<File | null>(null),
    [job, setJob] = useState<Row | null>(null),
    [error, setError] = useState(""),
    [importBusy, setImportBusy] = useState(false),
    [historyCursors, setHistoryCursors] = useState<string[]>([""]);
  const historyCursor = historyCursors.at(-1) || "";
  const state = useApi<
    [
      Row[],
      Page<Row>,
      { total_count: number },
      Page<Row>,
      {
        imports_count: number;
        exports_count: number;
        committed_records: number;
        last_transfer_at: string | null;
      },
    ]
  >([
    "/admin/data/templates",
    `/admin/data/transfers?limit=50&cursor=${encodeURIComponent(historyCursor)}`,
    `/admin/order-register/summary?${query(period)}`,
    "/admin/customers?limit=1",
    "/admin/data/summary",
  ]);
  function selectFile(next: File | undefined) {
    setError("");
    setJob(null);
    if (
      next &&
      (!next.name.toLowerCase().endsWith(".csv") ||
        next.size > 20 * 1024 * 1024)
    ) {
      setFile(null);
      setError(
        "Choose a UTF-8 CSV file up to 20 MB. XLSX is not supported by this API.",
      );
      return;
    }
    setFile(next || null);
  }
  async function importAction() {
    setError("");
    setImportBusy(true);
    try {
      if (!job) {
        if (!file) return;
        const form = new FormData();
        form.set("file", file);
        form.set("dataset", dataset);
        const uploaded = await api<Row>("/admin/data/imports", {
          method: "POST",
          body: form,
        });
        setJob(uploaded);
        actions.notify("File staged. Validate it before committing.");
      } else if (job.status === "UPLOADED" || job.status === "NEEDS_REVIEW") {
        const validated = await post<Row>(
          `/admin/data/imports/${job.id}/validate`,
          { version: job.version },
        );
        setJob(validated);
        actions.notify(
          validated.status === "VALIDATED"
            ? "Validation passed. Review and confirm the import."
            : "Validation found errors. Correct the CSV and choose it again.",
        );
      } else if (job.status === "VALIDATED") {
        const committed = await post<Row>(
          `/admin/data/imports/${job.id}/commit`,
          { version: job.version, reason: "Confirm validated import from CMS" },
          true,
        );
        setJob(committed);
        actions.notify(
          `${number(committed.committed_rows)} records imported successfully.`,
        );
      } else {
        setFile(null);
        setJob(null);
      }
      actions.refresh();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Import failed. Try again.",
      );
    } finally {
      setImportBusy(false);
    }
  }
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [templates, transfers, orders, customers, totals] = state.data;
  const template = templates.find((r) => r.dataset === dataset);
  const renderTransfers = (
    <TransferHistory
      {...{ transfers, actions, historyCursors, setHistoryCursors }}
    />
  );
  return (
    <>
      <Stats
        items={[
          {
            label: "Import jobs",
            value: number(totals.imports_count),
            note: "Server jobs",
          },
          {
            label: "Records committed",
            value: number(totals.committed_records),
            note: "Only validated imports",
          },
          {
            label: "Exports generated",
            value: number(totals.exports_count),
            note: "Frozen CSV snapshots",
          },
          {
            label: "Last transfer",
            value: totals.last_transfer_at ? "Recorded" : "No transfers",
            note: totals.last_transfer_at
              ? dateTime(totals.last_transfer_at)
              : "No synchronization is implied",
          },
        ]}
      />
      <Tabs
        items={["Import & export", "Transfer history", "Templates & schema"]}
        value={tab}
        onChange={setTab}
      />
      {tab === 0 && (
        <>
          <div className="grid">
            <Panel
              title="Import records"
              sub="UTF-8 CSV · up to 20 MB / 10,000 rows · stage, validate, confirm"
            >
              <select
                aria-label="Import dataset"
                disabled={importBusy}
                value={dataset}
                onChange={(e) => {
                  setDataset(e.target.value);
                  setJob(null);
                  setFile(null);
                  setError("");
                }}
              >
                {templates.map((r) => (
                  <option key={String(r.dataset)} value={String(r.dataset)}>
                    {label(r.dataset)}
                  </option>
                ))}
              </select>
              <div
                className="drop-zone"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (!importBusy) selectFile(e.dataTransfer.files[0]);
                }}
              >
                <h3>{file?.name || "Drop your CSV here, or browse"}</h3>
                <p>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB · ${job ? label(job.status) : "Not uploaded"}`
                    : "CSV only · XLSX is not currently supported"}
                </p>
                <label className="button file-button">
                  Choose CSV
                  <Input
                    aria-label="Choose import CSV"
                    disabled={importBusy}
                    type="file"
                    accept=".csv,text/csv"
                    onChange={(e) => {
                      selectFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              </div>
              <div className="steps">
                <Badge orange={!job}>1 · Upload</Badge>
                <Badge orange={Boolean(job && job.status !== "COMPLETED")}>
                  2 · Validate
                </Badge>
                <Badge orange={job?.status === "COMPLETED"}>3 · Confirm</Badge>
              </div>
              {file && (
                <Button primary disabled={importBusy} onClick={importAction}>
                  {!job
                    ? "Upload CSV"
                    : job.status === "UPLOADED" || job.status === "NEEDS_REVIEW"
                      ? "Validate records"
                      : job.status === "VALIDATED"
                        ? "Confirm import"
                        : "Start another import"}
                </Button>
              )}
              {error && (
                <p className="inline-error" role="alert">
                  {error}
                </p>
              )}
              {job && (
                <p className="muted">
                  {number(job.valid_rows)} valid · {number(job.invalid_rows)}{" "}
                  invalid · {number(job.committed_rows)} committed
                </p>
              )}
              {job && Array.isArray(job.errors) && job.errors.length > 0 && (
                <Table
                  heads={["Row", "Column", "Error"]}
                  rows={(
                    job.errors as {
                      row: number;
                      column: string;
                      message: string;
                    }[]
                  )
                    .slice(0, 10)
                    .map((r) => [r.row, r.column, r.message])}
                />
              )}
              <p className="muted">
                Required fields:{" "}
                {Array.isArray(template?.required_fields)
                  ? template.required_fields.join(", ")
                  : "See template"}
                . Rider imports create pending invitations, not approved
                drivers.
              </p>
            </Panel>
            <Panel
              title="Export data"
              sub="Download a real CSV generated from API records"
            >
              <div className="stack">
                <select
                  aria-label="Export dataset"
                  value={exportSet}
                  onChange={(e) => setExportSet(e.target.value)}
                >
                  <option value="order_register">Order register</option>
                  <option value="customers">Customers</option>
                  <option value="finance_statement">
                    Operational statement
                  </option>
                </select>
                <Badge orange>CSV (.csv)</Badge>
                <div className="soft-box">
                  <p>
                    {exportSet === "order_register"
                      ? number(orders.total_count)
                      : exportSet === "customers"
                        ? number(customers.total_count)
                        : "Selected-period"}{" "}
                    records ready to export
                  </p>
                  <small>
                    Export uses the selected reporting period where applicable.
                    Customer registries are current snapshots.
                  </small>
                  <p className="muted">
                    Source phone values and staged rows are not exposed in job
                    history.
                  </p>
                </div>
                <Button
                  primary
                  onClick={() =>
                    attempt(actions, async () => {
                      const count = await exportData(exportSet, period);
                      actions.notify(`${number(count)} records exported.`);
                      actions.refresh();
                    })
                  }
                >
                  Generate export
                </Button>
              </div>
            </Panel>
          </div>
          {renderTransfers}
        </>
      )}
      {tab === 1 && renderTransfers}
      {tab === 2 && (
        <Panel
          title="Templates & schema"
          sub="Versioned fields supported by the import API"
        >
          <Table
            heads={["Dataset", "Required fields", "Format / action"]}
            rows={templates.map((r) => [
              label(r.dataset),
              Array.isArray(r.required_fields)
                ? r.required_fields.join(", ")
                : "",
              <TextButton
                key="a"
                onClick={() =>
                  attempt(actions, async () => {
                    await download(`/admin/data/templates/${r.dataset}`);
                    actions.notify("CSV template downloaded.");
                  })
                }
              >
                Download CSV{" "}
                <Download size={14} strokeWidth={1.8} aria-hidden="true" />
              </TextButton>,
            ])}
          />
        </Panel>
      )}
    </>
  );
}
