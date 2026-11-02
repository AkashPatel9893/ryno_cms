import { getStore, MARKET_ID, SNAPSHOT, user } from "@/lib/mock-api/data";
import { choice, invalid, json, scope, text } from "@/lib/mock-api/http";

import {
  datasets,
  exportFields,
  exportRows,
  insert,
} from "@/lib/mock-api/shared";

export function mutateTransfers(
  request: Request,
  path: string,
  b: Record<string, unknown>,
): Response | undefined {
  const store = getStore();
  if (path === "admin/reports/reviews")
    return json(
      insert(store.reviews, {
        market_id: MARKET_ID,
        from_date: text(b, "from_date"),
        to_date: text(b, "to_date"),
        note: text(b, "note"),
        reason: text(b, "reason", 3, 500),
        reviewed_by: user.id,
        reviewed_at: SNAPSHOT,
      }),
      201,
    );
  if (path === "admin/data/exports") {
    const dataset = choice(b, "dataset", datasets);
    choice(b, "format", ["csv"]);
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(
      b.filters && typeof b.filters === "object" ? b.filters : {},
    ))
      query.set(key, String(value));
    if (b.market_id) query.set("market_id", String(b.market_id));
    if (b.from_date) query.set("from", String(b.from_date));
    if (b.to_date) query.set("to", String(b.to_date));
    let rows = structuredClone(exportRows(dataset, query));
    const fields = b.fields === undefined ? exportFields[dataset] : b.fields;
    if (
      !Array.isArray(fields) ||
      !fields.length ||
      fields.some(
        (f) => typeof f !== "string" || !exportFields[dataset].includes(f),
      )
    )
      invalid("fields must be a non-empty array of supported dataset fields");
    rows = rows.map((row) =>
      Object.fromEntries(fields.map((f) => [f, row[f]])),
    );
    const job = insert(store.exports, {
      dataset,
      format: "csv",
      status: "READY",
      schema_version: "1",
      rows,
      fields,
      record_count: rows.length,
      created_by: user.id,
      ...scope(query),
    });
    return json(
      {
        ...job,
        rows: undefined,
        download_url: `/api/v1/admin/data/exports/${job.id}/download`,
        mock: true,
      },
      202,
    );
  }
}
