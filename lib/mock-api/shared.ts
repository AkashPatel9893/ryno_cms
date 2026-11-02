import {
  getStore,
  SNAPSHOT,
  user,
  type Order,
  type Row,
  type Store,
} from "@/lib/mock-api/data";
import { invalid } from "@/lib/mock-api/http";
import {
  cents,
  money,
  selectOrders,
  settlements,
  statement,
} from "@/lib/mock-api/metrics";
import { randomUUID } from "node:crypto";

export const resources: Record<
  string,
  { key: keyof Store; filters: string[] }
> = {
  "admin/campaigns": {
    key: "campaigns",
    filters: ["audience", "status", "format", "market_id"],
  },
  "admin/coupons": { key: "coupons", filters: [] },
  "admin/drivers": {
    key: "drivers",
    filters: [
      "account_status",
      "onboarding_status",
      "compliance_status",
      "availability",
    ],
  },
  "admin/customers": { key: "customers", filters: ["customer_type", "status"] },
  "admin/business-accounts": { key: "businessAccounts", filters: ["status"] },
  "admin/brands": { key: "brands", filters: ["status"] },
  "admin/brand-campaigns": {
    key: "brandCampaigns",
    filters: ["status", "brand_id"],
  },
  "admin/web-enquiries": {
    key: "enquiries",
    filters: ["status", "owner_user_id"],
  },
  "admin/alerts": { key: "alerts", filters: ["status"] },
  "admin/payouts": {
    key: "payouts",
    filters: ["status", "driver_id", "cadence"],
  },
  "admin/payout-batches": { key: "batches", filters: ["status"] },
  "admin/creative-assets": { key: "assets", filters: [] },
  "admin/incentive-programs": { key: "programs", filters: ["status"] },
  "admin/incentive-claims": {
    key: "claims",
    filters: ["status", "program_id"],
  },
  "admin/driver-invitations": { key: "invitations", filters: ["status"] },
  "admin/data/imports": { key: "imports", filters: ["status", "dataset"] },
  "admin/data/exports": { key: "exports", filters: ["status", "dataset"] },
};
export const datasets = [
  "order_register",
  "customers",
  "business_accounts",
  "driver_settlements",
  "finance_statement",
  "reconciliation",
];
export const importDatasets = ["customers", "riders", "business_accounts"];
export const exportFields: Record<string, string[]> = {
  order_register: [
    "order_number",
    "customer_display_name",
    "customer_type",
    "status",
    "payment_method_type",
    "payment_timing",
    "quoted_amount",
    "final_amount",
    "currency",
    "created_at",
  ],
  customers: [
    "id",
    "customer_number",
    "display_name",
    "customer_type",
    "status",
    "phone_masked",
    "email",
  ],
  business_accounts: [
    "id",
    "customer_id",
    "display_name",
    "account_code",
    "location_count",
    "payment_terms",
    "status",
  ],
  driver_settlements: [
    "driver_id",
    "driver_number",
    "name",
    "bank_account",
    "driver_wallet_balance",
    "eligible_withdrawable_amount",
    "currency",
    "due_date",
    "in_flight_payout_amount",
    "status",
    "as_of",
  ],
  finance_statement: ["measure", "label", "value", "unit", "audit_basis"],
  reconciliation: [
    "name",
    "status",
    "expected_amount",
    "observed_amount",
    "difference",
    "reason",
  ],
};
export function audit(action: string, entity: Row, reason = "Mock API action") {
  getStore().audit.unshift({
    id: randomUUID(),
    actor_user_id: user.id,
    actor_type: "ADMIN",
    action,
    entity_type: "mock_resource",
    entity_id: entity.id,
    reason,
    created_at: SNAPSHOT,
  });
}
export function insert(items: Row[], value: Record<string, unknown>) {
  const row = { id: randomUUID(), created_at: SNAPSHOT, ...value };
  items.unshift(row);
  audit("CREATED", row);
  return row;
}
export function pool(key: keyof Store): Row[] {
  return getStore()[key] as Row[];
}
export function orderDetail(order: Order) {
  return {
    order: {
      ...order,
      quoted_amount: order.fare.quoted_amount,
      final_amount: order.fare.final_amount,
      currency: "INR",
      payment_timing: order.payment.timing,
      assigned_vehicle_id: null,
      active_trip_id: null,
      stops: [
        {
          sequence_number: 1,
          stop_type: "PICKUP",
          address_line_1: order.route.pickup_label,
        },
        {
          sequence_number: 2,
          stop_type: "DROP",
          address_line_1: order.route.drop_label,
        },
      ],
      items: [
        {
          description: "Mock delivery parcel",
          quantity: 1,
          category: "PARCEL",
        },
      ],
    },
    history: [
      {
        from_status: null,
        to_status: order.status,
        actor_type: "SYSTEM",
        reason: "Mock seed",
        created_at: order.created_at,
      },
    ],
    assignments: order.assigned_driver_id
      ? [
          {
            driver_id: order.assigned_driver_id,
            status: "ACTIVE",
            source: "MOCK",
          },
        ]
      : [],
    trips: [],
    payments: [
      {
        id: order.payment.payment_id,
        purpose:
          order.payment.timing === "PRE_DISPATCH"
            ? "ORDER_PREPAYMENT"
            : "ORDER_POSTPAYMENT",
        status: order.payment.gateway_status,
        amount: order.fare.quoted_amount,
        refunded_amount: order.payment.refunded_amount,
      },
    ],
  };
}
export function listWithActivity(
  kind: "customers" | "drivers",
  params: URLSearchParams,
) {
  const activityParams = new URLSearchParams(params);
  for (const field of ["q", "cursor", "limit"]) activityParams.delete(field);
  const orders = selectOrders(activityParams);
  const values = new Map<string, { count: number; cents: number }>();
  for (const o of orders) {
    if (o.status !== "DELIVERED") continue;
    const key = kind === "customers" ? o.customer.id : o.assigned_driver_id;
    if (!key) continue;
    const v = values.get(key) || { count: 0, cents: 0 };
    v.count++;
    v.cents += cents(o.fare.final_amount);
    values.set(key, v);
  }
  return pool(kind).map((row) => ({
    ...row,
    period_delivered_count: values.get(row.id)?.count || 0,
    period_fare_revenue: money(values.get(row.id)?.cents || 0),
    currency: "INR",
  }));
}
export function reconciliation() {
  return {
    status: "NOT_CHECKED",
    checked_at: null,
    controls: [
      "Gateway collections",
      "Cash collections",
      "Bank payout confirmations",
    ].map((name) => ({
      name,
      status: "NOT_CHECKED",
      expected_amount: null,
      observed_amount: null,
      difference: null,
      reason: "Mock API does not ingest bank or gateway statements",
    })),
  };
}
export function exportRows(
  dataset: string,
  params: URLSearchParams,
): Record<string, unknown>[] {
  if (dataset === "order_register")
    return selectOrders(params).map((o) => ({
      order_number: o.order_number,
      customer_display_name: o.customer.display_name,
      customer_type: o.customer.customer_type,
      status: o.status,
      payment_method_type: o.payment.method,
      payment_timing: o.payment.timing,
      quoted_amount: o.fare.quoted_amount,
      final_amount: o.fare.final_amount,
      currency: "INR",
      created_at: o.created_at,
    }));
  if (dataset === "customers") return getStore().customers;
  if (dataset === "business_accounts") return getStore().businessAccounts;
  if (dataset === "driver_settlements") return settlements();
  if (dataset === "finance_statement") return statement(params).data.rows;
  return reconciliation().controls;
}

export function validateDates(
  body: Record<string, unknown>,
  first: string,
  last: string,
) {
  for (const field of [first, last])
    if (
      body[field] != null &&
      (typeof body[field] !== "string" ||
        !Number.isFinite(Date.parse(String(body[field]))))
    )
      invalid(`${field} must be a valid date`);
  if (
    body[first] &&
    body[last] &&
    Date.parse(String(body[last])) <= Date.parse(String(body[first]))
  )
    invalid(`${last} must be after ${first}`);
}

export function publicRow(row: Row) {
  const { rows, staged_rows, ...visible } = row;
  void rows;
  void staged_rows;
  return visible;
}
