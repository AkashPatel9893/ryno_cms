import {
  getStore,
  MARKET_ID,
  markets,
  permissions,
  SNAPSHOT,
  user,
  vehicleTypes,
  zones,
} from "@/lib/mock-api/data";
import { filterRows, find, json, paginate, scope } from "@/lib/mock-api/http";
import {
  aggregate,
  cents,
  dashboard,
  money,
  selectOrders,
  settlements,
  statement,
  summary,
} from "@/lib/mock-api/metrics";

import { orderDetail, reconciliation } from "@/lib/mock-api/shared";

export function ReadOverview(
  path: string,
  p: URLSearchParams,
): Response | undefined {
  const store = getStore();
  if (path === "auth/me") return json(user);
  if (path === "admin/workspace")
    return json({
      user,
      roles: ["MOCK_ADMIN"],
      permissions,
      markets,
      selected_market_id: MARKET_ID,
      server_time: SNAPSHOT,
      mock: true,
    });
  if (path === "admin/markets") return json(markets);
  if (path === `admin/markets/${MARKET_ID}/zones`) return json(zones);
  if (path === "vehicle-types") return json(vehicleTypes);
  if (path === "admin/dashboard") return json(dashboard(p));
  if (
    path === "admin/order-register/summary" ||
    path === "admin/orders/summary"
  )
    return json({ ...scope(p), ...summary(selectOrders(p)) });
  if (path === "admin/order-register")
    return json(paginate(selectOrders(p), p));
  if (path === "admin/orders")
    return json(
      paginate(selectOrders(p), p).items.map((o) => ({
        id: o.id,
        order_number: o.order_number,
        status: o.status,
        quoted_amount: o.fare.quoted_amount,
        final_amount: o.fare.final_amount,
        currency: "INR",
        created_at: o.created_at,
      })),
    );
  if (path.startsWith("admin/orders/") && path.split("/").length === 3)
    return json(orderDetail(find(store.orders, path.split("/")[2])));
  if (path === "admin/active-trips")
    return json(
      paginate(
        store.orders.filter((o) =>
          ["ACTIVE", "CONFIRMED"].includes(o.status_group),
        ),
        p,
      ).items.map((o) => ({
        id: o.id,
        trip_number: `TRIP-${o.order_number}`,
        order_id: o.id,
        driver_id: o.assigned_driver_id,
        status: o.status,
        attempt_number: 1,
        created_at: o.created_at,
      })),
    );
  if (path === "admin/partners/summary")
    return json(
      aggregate(p, {
        registered_riders: store.drivers.length,
        registered_customers: store.customers.length,
        live_b2b_partners: store.businessAccounts.filter(
          (x) => x.status === "ACTIVE",
        ).length,
        advertising_brands: store.brands.length,
        online_riders: store.drivers.filter(
          (x) => x.availability === "AVAILABLE",
        ).length,
        on_delivery_riders: store.drivers.filter(
          (x) => x.availability === "ASSIGNED",
        ).length,
      }),
    );
  if (path === "admin/reports/statement") return json(statement(p));
  if (path === "admin/reports/reconciliation")
    return json(aggregate(p, reconciliation()));
  if (path === "admin/settlements/summary") {
    scope(p);
    const eligible = settlements();
    return json(
      aggregate(p, {
        driver_wallet_balance: money(
          eligible.reduce((n, d) => n + cents(d.driver_wallet_balance), 0),
        ),
        eligible_withdrawable_balance: money(
          eligible.reduce(
            (n, d) => n + cents(d.eligible_withdrawable_amount),
            0,
          ),
        ),
        eligible_driver_count: eligible.length,
        paid_payouts_mtd: money(
          store.payouts
            .filter((x) => x.status === "PAID")
            .reduce((n, d) => n + cents(d.net_amount), 0),
        ),
        in_flight_payout_amount: money(
          store.payouts
            .filter((x) => x.status === "PROCESSING")
            .reduce((n, d) => n + cents(d.net_amount), 0),
        ),
        due_today: null,
        next_run_at: null,
        basis:
          "Illustrative current wallet balances; not MTD earnings minus payouts",
      }),
    );
  }
  if (path === "admin/settlements") {
    scope(p);
    return json(paginate(filterRows(settlements(), p, ["status"]), p));
  }
  if (path === "admin/marketing/summary")
    return json(
      aggregate(p, {
        live_campaigns: store.campaigns.filter(
          (c) =>
            c.status === "LIVE" &&
            (!c.start_at ||
              Date.parse(String(c.start_at)) <= Date.parse(SNAPSHOT)) &&
            (!c.end_at || Date.parse(String(c.end_at)) > Date.parse(SNAPSHOT)),
        ).length,
        impressions: store.campaigns.reduce(
          (n, c) => n + Number(c.impressions || 0),
          0,
        ),
        coupon_redemptions: store.coupons.reduce(
          (n, c) => n + Number(c.usage_count || 0),
          0,
        ),
        cashback_credited: "0.00",
        incentives_credited: "0.00",
        measurement_basis:
          "Illustrative campaign seed counters, not instrumented events",
      }),
    );
  if (path === "admin/coupons/usage")
    return json(
      paginate(
        store.coupons.map((c) => ({
          id: c.id,
          code: c.code,
          applied_count: c.usage_count,
          reversed_count: 0,
          discount_amount: money(
            Number(c.usage_count || 0) * cents(c.discount_value),
          ),
        })),
        p,
      ),
    );
}
