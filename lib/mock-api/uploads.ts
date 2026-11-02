import {
  getStore,
  MARKET_ID,
  SNAPSHOT,
  user,
  type Row,
} from "@/lib/mock-api/data";
import { choice, fail, invalid, json, text } from "@/lib/mock-api/http";

import {
  audit,
  importDatasets,
  insert,
  publicRow,
} from "@/lib/mock-api/shared";

function parseCsv(content: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [],
    cell = "",
    quoted = false;
  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '"') {
      if (quoted && content[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (!quoted && cell.length)
        invalid("CSV quotes must start at the beginning of a field");
      else quoted = !quoted;
    } else if (c === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((c === "\n" || c === "\r") && !quoted) {
      if (c === "\r" && content[i + 1] === "\n") i++;
      row.push(cell);
      if (row.some((x) => x.trim())) rows.push(row);
      row = [];
      cell = "";
    } else cell += c;
  }
  if (quoted) invalid("CSV contains an unclosed quoted field");
  row.push(cell);
  if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
export async function uploadImport(request: Request) {
  const form = await request.formData();
  const dataset = choice(
    { dataset: form.get("dataset") },
    "dataset",
    importDatasets,
  );
  const file = form.get("file");
  if (!(file instanceof File))
    invalid("Provide multipart file and dataset fields");
  if (file.size > 20 * 1024 * 1024)
    fail(413, "FILE_TOO_LARGE", "Files must be no larger than 20 MB");
  if (!file.name.toLowerCase().endsWith(".csv"))
    invalid("Mock imports support UTF-8 CSV only; XLSX requires a parser");
  const values = parseCsv((await file.text()).replace(/^\uFEFF/, ""));
  if (values.length < 2)
    invalid("CSV must contain a header and at least one data row");
  if (values.length > 10001)
    invalid("Mock imports support at most 10,000 data rows");
  const keys = values[0].map((v) => v.trim());
  if (keys.some((k) => !k) || new Set(keys).size !== keys.length)
    invalid("CSV headers must be non-empty and unique");
  const rows = values
    .slice(1)
    .map((row) =>
      Object.fromEntries(keys.map((key, i) => [key, row[i] || ""])),
    );
  const job = insert(getStore().imports, {
    dataset,
    schema_version: "1",
    original_filename: file.name,
    size_bytes: file.size,
    status: "UPLOADED",
    total_rows: rows.length,
    valid_rows: 0,
    invalid_rows: 0,
    committed_rows: 0,
    created_by: user.id,
    market_id: MARKET_ID,
    version: 1,
    staged_rows: rows,
    errors: [],
  });
  return json(publicRow(job), 201);
}
export function importAction(
  job: Row,
  action: string,
  b: Record<string, unknown>,
) {
  if (b.version !== job.version)
    fail(409, "VERSION_CONFLICT", "Pass the current import job version");
  if (action === "validate") {
    if (!["UPLOADED", "NEEDS_REVIEW"].includes(String(job.status)))
      fail(
        409,
        "INVALID_IMPORT_STATE",
        "Only uploaded/review imports can be validated",
      );
    const required =
      job.dataset === "customers"
        ? ["display_name", "phone", "email", "city"]
        : job.dataset === "riders"
          ? ["first_name", "phone", "market_code"]
          : ["display_name", "customer_id", "account_code"];
    const errors: {
      row: number;
      column: string;
      code: string;
      message: string;
    }[] = [];
    const rows = job.staged_rows as Record<string, string>[];
    const seen = new Set<string>();
    rows.forEach((row, i) => {
      for (const key of required)
        if (!row[key]?.trim())
          errors.push({
            row: i + 2,
            column: key,
            code: "REQUIRED",
            message: `${key} is required`,
          });
      if (row.phone && !/^\+\d{6,15}$/.test(row.phone))
        errors.push({
          row: i + 2,
          column: "phone",
          code: "INVALID_PHONE",
          message: "Use E.164 phone format",
        });
      if (row.phone && seen.has(row.phone))
        errors.push({
          row: i + 2,
          column: "phone",
          code: "DUPLICATE",
          message: "Phone repeats within this file",
        });
      if (row.phone) seen.add(row.phone);
      if (row.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email))
        errors.push({
          row: i + 2,
          column: "email",
          code: "INVALID_EMAIL",
          message: "Email is invalid",
        });
      if (
        job.dataset === "business_accounts" &&
        row.customer_id &&
        !getStore().customers.some(
          (c) => c.id === row.customer_id && c.customer_type === "BUSINESS",
        )
      )
        errors.push({
          row: i + 2,
          column: "customer_id",
          code: "INVALID_BUSINESS_CUSTOMER",
          message: "Use an existing BUSINESS customer UUID",
        });
    });
    job.errors = errors;
    job.invalid_rows = new Set(errors.map((e) => e.row)).size;
    job.valid_rows = rows.length - Number(job.invalid_rows);
    job.status = errors.length ? "NEEDS_REVIEW" : "VALIDATED";
    job.validated_at = SNAPSHOT;
    job.version = Number(job.version) + 1;
    audit("IMPORT_VALIDATED", job);
    return json(publicRow(job));
  }
  text(b, "reason", 3, 500);
  if (job.status !== "VALIDATED")
    fail(
      409,
      "IMPORT_NOT_VALIDATED",
      "Resolve all validation errors before committing this mock import",
    );
  for (const row of job.staged_rows as Record<string, string>[]) {
    if (job.dataset === "customers")
      insert(getStore().customers, {
        display_name: row.display_name,
        customer_number: `CUS-MOCK-${getStore().customers.length + 1}`,
        phone_masked: row.phone.slice(0, 5) + "••••" + row.phone.slice(-3),
        email: row.email,
        customer_type: "INDIVIDUAL",
        status: "ACTIVE",
        email_verified: false,
        mock_import: true,
      });
    else if (job.dataset === "riders")
      insert(getStore().invitations, {
        name: row.first_name,
        phone_masked: row.phone.slice(0, 5) + "••••" + row.phone.slice(-3),
        market_code: row.market_code,
        status: "PENDING",
        mock_import: true,
      });
    else
      insert(getStore().businessAccounts, {
        display_name: row.display_name,
        customer_id: row.customer_id,
        account_code: row.account_code,
        status: "ACTIVE",
        version: 1,
        mock_import: true,
      });
  }
  job.committed_rows = job.valid_rows;
  job.status = "COMPLETED";
  job.committed_at = SNAPSHOT;
  job.version = Number(job.version) + 1;
  audit("IMPORT_COMMITTED", job, String(b.reason));
  return json(publicRow(job));
}
export async function uploadAsset(request: Request) {
  const form = await request.formData();
  const file = form.get("file");
  if (!(file instanceof File)) invalid("Provide a file");
  if (file.size > 5 * 1024 * 1024)
    fail(
      413,
      "FILE_TOO_LARGE",
      "Mock asset metadata supports files up to 5 MB",
    );
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type))
    invalid("Use a PNG, JPEG or WebP image");
  return json(
    insert(getStore().assets, {
      name: file.name,
      content_type: file.type,
      size_bytes: file.size,
      url: null,
      status: "METADATA_ONLY",
      notice:
        "Mock stores metadata only; file bytes are not persisted or published",
    }),
    201,
  );
}
