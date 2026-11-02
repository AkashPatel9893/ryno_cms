import { getStore, SNAPSHOT } from "@/lib/mock-api/data";
import {
  csv,
  fail,
  filterRows,
  find,
  invalid,
  json,
  paginate,
  scope,
} from "@/lib/mock-api/http";

import {
  importDatasets,
  listWithActivity,
  pool,
  publicRow,
  resources,
} from "@/lib/mock-api/shared";

export function ReadResources(
  path: string,
  p: URLSearchParams,
): Response | undefined {
  const store = getStore();
  if (path === "admin/onboarding/pending")
    return json(
      store.drivers.filter((d) => d.onboarding_status !== "APPROVED"),
    );
  if (path === "admin/verifications/pending") return json([]);
  if (path === "admin/audit" || path === "admin/admin-actions")
    return json(
      paginate(filterRows(store.audit, p, ["entity_id", "entity_type"]), p)
        .items,
    );
  if (path === "admin/data/templates")
    return json(
      importDatasets.map((dataset) => ({
        dataset,
        schema_version: "1",
        formats: ["csv"],
        required_fields:
          dataset === "customers"
            ? ["display_name", "phone", "email", "city"]
            : dataset === "riders"
              ? ["first_name", "phone", "market_code"]
              : ["display_name", "customer_id", "account_code"],
      })),
    );
  if (path.startsWith("admin/data/templates/")) {
    const dataset = path.split("/").at(-1)!;
    if (!importDatasets.includes(dataset))
      fail(404, "NOT_FOUND", "Unknown template dataset");
    if (p.has("format") && p.get("format") !== "csv")
      invalid("Mock templates support CSV only");
    const row =
      dataset === "customers"
        ? {
            display_name: "Example customer",
            phone: "+919900000010",
            email: "customer@example.com",
            city: "Bengaluru",
          }
        : dataset === "riders"
          ? {
              first_name: "Example rider",
              phone: "+919900000011",
              market_code: "BLR",
            }
          : {
              display_name: "Example business",
              customer_id: store.customers[1].id,
              account_code: "BIZ-001",
            };
    return csv([row], `${dataset}_template`);
  }
  if (path === "admin/data/summary")
    return json({
      imports_count: store.imports.length,
      exports_count: store.exports.length,
      committed_records: store.imports.reduce(
        (n, r) => n + Number(r.committed_rows || 0),
        0,
      ),
      last_transfer_at:
        store.imports.length || store.exports.length ? SNAPSHOT : null,
      as_of: SNAPSHOT,
    });
  if (path === "admin/data/transfers")
    return json(
      paginate(
        filterRows(
          [
            ...store.imports.map((x) => ({
              ...publicRow(x),
              direction: "IMPORT",
            })),
            ...store.exports.map((x) => ({
              ...publicRow(x),
              direction: "EXPORT",
            })),
          ],
          p,
          ["direction", "dataset", "status"],
        ),
        p,
      ),
    );
  const downloadMatch = path.match(/^admin\/data\/exports\/([^/]+)\/download$/);
  if (downloadMatch) {
    const job = find(store.exports, downloadMatch[1]);
    if (job.status !== "READY")
      fail(409, "EXPORT_NOT_READY", "Export is not ready");
    return csv(
      job.rows as Record<string, unknown>[],
      String(job.dataset),
      job.fields as string[],
    );
  }
  const errorMatch = path.match(/^admin\/data\/imports\/([^/]+)\/errors$/);
  if (errorMatch) {
    const job = find(store.imports, errorMatch[1]);
    return json({
      items: job.errors || [],
      total_count: ((job.errors as unknown[]) || []).length,
    });
  }
  const receipt = path.match(/^admin\/payouts\/([^/]+)\/receipt$/);
  if (receipt) {
    const row = find(store.payouts, receipt[1]);
    if (row.status !== "PAID")
      fail(
        409,
        "PAYOUT_NOT_PAID",
        "Receipts are available only for PAID mock payouts",
      );
    return json({
      mock: true,
      payout_reference: row.payout_reference,
      net_amount: row.net_amount,
      currency: "INR",
      paid_at: row.paid_at,
      provider_reference: row.provider_reference,
      notice: "Mock receipt — no funds transferred",
    });
  }
  for (const [base, config] of Object.entries(resources)) {
    if (path === base) {
      scope(p);
      let rows =
        base === "admin/customers"
          ? listWithActivity("customers", p)
          : base === "admin/drivers"
            ? listWithActivity("drivers", p)
            : pool(config.key);
      rows = filterRows(rows, p, config.filters).map(publicRow);
      return json(base === "admin/coupons" ? rows : paginate(rows, p));
    }
    if (
      path.startsWith(base + "/") &&
      path.split("/").length === base.split("/").length + 1
    )
      return json(
        publicRow(find(pool(config.key), path.slice(base.length + 1))),
      );
  }
}
