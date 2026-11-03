"use client";
import { ArrowUpRight, Download } from "lucide-react";
import {
  dateTime,
  download,
  label,
  number,
  type Actions,
  type Page,
  type Row,
} from "@/lib/cms/client";
import { attempt } from "@/components/cms/screen-utils";
import {
  Badge,
  Cell,
  Pager,
  Panel,
  Table,
  TextButton,
} from "@/components/cms/ui";
export function TransferHistory({
  transfers,
  actions,
  historyCursors,
  setHistoryCursors,
}: {
  transfers: Page<Row>;
  actions: Actions;
  historyCursors: string[];
  setHistoryCursors: (value: string[]) => void;
}) {
  const historyCursor = historyCursors.at(-1) || "";
  return (
    <Panel title="Recent transfers" sub="Actual job history from the server">
      <Table
        heads={[
          "File / dataset",
          "Direction",
          "Records",
          "Created",
          "Status",
          "Actions",
        ]}
        rows={transfers.items.map((r) => [
          <Cell
            key="f"
            title={String(r.original_filename || label(r.dataset))}
            sub={String(r.id)}
          />,
          label(r.direction),
          r.direction === "IMPORT"
            ? `${number(r.committed_rows)} committed / ${number(r.total_rows)} staged`
            : number(r.record_count),
          dateTime(r.created_at),
          <Badge
            key="s"
            orange={["READY", "NEEDS_REVIEW"].includes(String(r.status))}
          >
            {label(r.status)}
          </Badge>,
          r.direction === "EXPORT" && r.status === "READY" ? (
            <TextButton
              key="a"
              onClick={() =>
                attempt(actions, async () => {
                  await download(`/admin/data/exports/${r.id}/download`);
                  actions.notify("Export downloaded.");
                })
              }
            >
              Download{" "}
              <Download size={14} strokeWidth={1.8} aria-hidden="true" />
            </TextButton>
          ) : (
            <div
              key="a"
              style={{
                display: "inline-flex",
                gap: "0.5rem",
                alignItems: "center",
              }}
            >
              <TextButton
                onClick={() =>
                  actions.inspect("Import job", `/admin/data/imports/${r.id}`)
                }
              >
                View log{" "}
                <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </TextButton>
              {Number(r.error_rows || 0) > 0 ? (
                <TextButton
                  onClick={() =>
                    actions.inspect(
                      "Import errors",
                      `/admin/data/imports/${r.id}/errors`,
                    )
                  }
                >
                  Errors
                </TextButton>
              ) : null}
            </div>
          ),
        ])}
        empty="No transfers yet. Import or export a CSV to create a traceable job."
      />
      <Pager
        count={transfers.total_count}
        cursor={historyCursor}
        next={transfers.next_cursor}
        onNext={(next) => setHistoryCursors([...historyCursors, next])}
        onPrevious={() => setHistoryCursors(historyCursors.slice(0, -1))}
      />
    </Panel>
  );
}
