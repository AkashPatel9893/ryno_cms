import { getStore, MARKET_ID, SNAPSHOT, user } from "@/lib/mock-api/data";
import {
  choice,
  fail,
  find,
  headers,
  invalid,
  json,
  text,
} from "@/lib/mock-api/http";
import { cents, money, settlements } from "@/lib/mock-api/metrics";
import { randomUUID } from "node:crypto";

import {
  audit,
  insert,
  pool,
  resources,
  validateDates,
} from "@/lib/mock-api/shared";
import { importAction } from "@/lib/mock-api/uploads";

export function mutateActions(
  request: Request,
  path: string,
  b: Record<string, unknown>,
): Response | undefined {
  const store = getStore();
  const imported = path.match(
    /^admin\/data\/imports\/([^/]+)\/(validate|commit)$/,
  );
  if (imported)
    return importAction(find(store.imports, imported[1]), imported[2], b);
  if (path === "admin/payout-batches/preview") {
    if (b.market_id && b.market_id !== MARKET_ID) invalid("Unknown market_id");
    const eligible = settlements();
    const preview = insert(store.previews, {
      eligible_driver_count: eligible.length,
      total_amount: money(
        eligible.reduce((n, d) => n + cents(d.eligible_withdrawable_amount), 0),
      ),
      currency: "INR",
      market_id: MARKET_ID,
      status: "PREVIEW",
      criteria_hash: randomUUID(),
      expires_at: new Date(Date.now() + 900000).toISOString(),
      notice: "Preview only — no money moved",
    });
    return json(preview);
  }
  if (path === "admin/payout-batches" && request.method === "POST") {
    const preview = find(store.previews, text(b, "preview_id"));
    text(b, "reason", 3, 500);
    if (b.confirmed !== true) invalid("confirmed must be true");
    if (preview.status !== "PREVIEW")
      fail(409, "PREVIEW_USED", "Preview was already confirmed");
    if (Date.parse(String(preview.expires_at)) < Date.now())
      fail(409, "PREVIEW_EXPIRED", "Create a new preview");
    preview.status = "CONFIRMED";
    return json(
      insert(store.batches, {
        preview_id: preview.id,
        status: "SIMULATED",
        total_amount: preview.total_amount,
        currency: "INR",
        driver_count: preview.eligible_driver_count,
        created_by: user.id,
        notice:
          "Simulation only — no wallet posting, bank transfer, or gateway call",
      }),
      201,
    );
  }
  if (path === "admin/payouts/run") {
    choice(b, "cadence", ["DAILY", "WEEKLY", "MANUAL"]);
    return json({
      mock: true,
      status: "SIMULATED",
      payouts: [],
      notice:
        "This mock endpoint does not run the real backend PayoutService or move money",
    });
  }
  const orderAction = path.match(
    /^admin\/orders\/([^/]+)\/(cancel|assign|reassign)$/,
  );
  if (orderAction) {
    const order = find(store.orders, orderAction[1]);
    if (["DELIVERED", "CANCELLED", "DELIVERY_FAILED"].includes(order.status))
      fail(409, "INVALID_ORDER_STATE", "Terminal orders cannot be changed");
    if (orderAction[2] === "cancel") {
      text(b, "reason_code", 2, 64);
      order.status = "CANCELLED";
      order.status_group = "CANCELLED";
      audit("ORDER_CANCELLED", order);
      return new Response(null, { status: 204, headers });
    }
    text(b, "reason", 3, 500);
    if (order.status_group === "ACTIVE")
      fail(
        409,
        "INVALID_ORDER_STATE",
        "Mock reassignment is only available before pickup",
      );
    if (b.driver_id == null && orderAction[2] === "reassign") {
      order.assigned_driver_id = null;
      order.status = "SEARCHING_DRIVER";
      order.status_group = "UNASSIGNED";
      audit("ORDER_RELEASED", order);
      return json(null);
    }
    const driver = find(store.drivers, text(b, "driver_id"));
    if (driver.account_status !== "ACTIVE")
      fail(409, "DRIVER_NOT_ELIGIBLE", "Select an active mock driver");
    if (
      store.orders.some(
        (o) =>
          o.assigned_driver_id === driver.id &&
          ["ACTIVE", "CONFIRMED"].includes(o.status_group),
      )
    )
      fail(409, "DRIVER_BUSY", "Driver is assigned to another mock order");
    order.assigned_driver_id = driver.id;
    order.status = "DRIVER_ASSIGNED";
    order.status_group = "CONFIRMED";
    audit("ORDER_ASSIGNED", order);
    return json({
      id: randomUUID(),
      driver_id: driver.id,
      order_id: order.id,
      vehicle_id: (driver.current_vehicle as { id: string }).id,
      source: "MOCK_ADMIN",
      status: "ACTIVE",
      assigned_at: SNAPSHOT,
      release_reason: null,
    });
  }
  const alertAction = path.match(
    /^admin\/alerts\/([^/]+)\/(acknowledge|resolve)$/,
  );
  if (alertAction) {
    const alert = find(store.alerts, alertAction[1]);
    if (alert.status === "RESOLVED")
      fail(409, "ALERT_RESOLVED", "Alert is already resolved");
    if (alertAction[2] === "resolve") {
      alert.resolution_note = text(b, "note", 3, 2000);
      alert.status = "RESOLVED";
      alert.resolved_at = SNAPSHOT;
      alert.resolved_by = user.id;
    } else {
      alert.status = "ACKNOWLEDGED";
      alert.acknowledged_by = user.id;
      alert.acknowledged_at = SNAPSHOT;
    }
    audit("ALERT_" + alert.status, alert);
    return json(alert);
  }
  const campaignAction = path.match(
    /^admin\/campaigns\/([^/]+)\/(publish|pause)$/,
  );
  if (campaignAction) {
    const row = find(store.campaigns, campaignAction[1]);
    text(b, "reason", 3, 500);
    if (campaignAction[2] === "publish") {
      if (
        !row.start_at ||
        !row.end_at ||
        !Number.isFinite(Date.parse(String(row.start_at))) ||
        !Number.isFinite(Date.parse(String(row.end_at))) ||
        Date.parse(String(row.start_at)) >= Date.parse(String(row.end_at))
      )
        invalid("Valid start_at and end_at are required before publishing");
      row.status = "LIVE";
    } else row.status = "PAUSED";
    row.version = Number(row.version) + 1;
    audit("CAMPAIGN_" + row.status, row);
    return json(row);
  }
  const patch = path.match(
    /^admin\/(campaigns|coupons|business-accounts|web-enquiries)\/([^/]+)$/,
  );
  if (patch && request.method === "PATCH") {
    const row = find(pool(resources[`admin/${patch[1]}`].key), patch[2]);
    text(b, "reason", 3, 500);
    if (b.version !== undefined && b.version !== row.version)
      fail(
        409,
        "VERSION_CONFLICT",
        "Resource changed; reload it before updating",
      );
    const allowed =
      patch[1] === "campaigns"
        ? ["title", "description", "start_at", "end_at"]
        : patch[1] === "coupons"
          ? ["is_active", "valid_until"]
          : patch[1] === "business-accounts"
            ? ["display_name", "payment_terms"]
            : ["status", "owner_user_id", "follow_up_at", "note"];
    if (patch[1] === "campaigns")
      validateDates({ ...row, ...b }, "start_at", "end_at");
    if (patch[1] === "coupons")
      validateDates({ ...row, ...b }, "valid_from", "valid_until");
    if (b.title !== undefined) text(b, "title", 1, 120);
    if (b.is_active !== undefined && typeof b.is_active !== "boolean")
      invalid("is_active must be boolean");
    if (patch[1] === "web-enquiries" && b.status !== undefined)
      choice(b, "status", ["NEW", "ASSIGNED", "FOLLOW_UP", "RESOLVED", "SPAM"]);
    for (const key of allowed) if (key in b) row[key] = b[key];
    if ("version" in row) row.version = Number(row.version) + 1;
    audit("UPDATED", row, String(b.reason));
    return json(row);
  }
}
