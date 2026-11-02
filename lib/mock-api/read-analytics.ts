import { json, paginate, scope } from "@/lib/mock-api/http";
import {
  aggregate,
  revenue,
  selectOrders,
  series,
} from "@/lib/mock-api/metrics";

import { listWithActivity } from "@/lib/mock-api/shared";

export function ReadAnalytics(
  path: string,
  p: URLSearchParams,
): Response | undefined {
  if (path === "admin/analytics/overview") {
    const orders = selectOrders(p);
    return json(
      aggregate(p, {
        gross_fare_revenue: revenue(orders),
        bookings_count: orders.length,
        revenue_change_percent: null,
        average_rating: null,
        on_time_rate_percent: null,
        coverage: { ratings: "NOT_SEEDED", on_time: "NO_SLA_TARGET" },
      }),
    );
  }
  if (path === "admin/analytics/revenue")
    return json(
      aggregate(p, {
        series: series(p, selectOrders(p)),
        total: revenue(selectOrders(p)),
      }),
    );
  if (path === "admin/analytics/demand") {
    const points = series(p, selectOrders(p));
    return json(
      aggregate(p, {
        series: points.map((x) => ({
          date: x.date,
          bookings_count: x.bookings_count,
        })),
        peak: points.reduce(
          (a, b) => (a.bookings_count >= b.bookings_count ? a : b),
          points[0],
        ),
      }),
    );
  }
  if (path === "admin/analytics/customers")
    return json(
      aggregate(
        p,
        paginate(
          listWithActivity("customers", p)
            .sort(
              (a, b) =>
                Number(b.period_fare_revenue) - Number(a.period_fare_revenue),
            )
            .map((row, i) => ({ ...row, revenue_rank: i + 1 })),
          p,
        ),
      ),
    );
  if (path === "admin/analytics/drivers")
    return json(
      aggregate(
        p,
        paginate(
          listWithActivity("drivers", p)
            .map((d) => ({
              ...d,
              on_time_rate_percent: null,
              rejected_offers_count: 0,
            }))
            .sort(
              (a, b) => b.period_delivered_count - a.period_delivered_count,
            ),
          p,
        ),
      ),
    );
  if (path === "admin/analytics/areas") {
    const orders = selectOrders(p);
    const areas = new Map<string, number>();
    for (const o of orders)
      areas.set(
        o.route.pickup_label,
        (areas.get(o.route.pickup_label) || 0) + 1,
      );
    return json(
      aggregate(p, {
        basis: "Seeded pickup labels; not production locality geometry",
        items: [...areas].map(([name, bookings_count]) => ({
          name,
          bookings_count,
          share_percent: orders.length
            ? Number(((bookings_count / orders.length) * 100).toFixed(2))
            : 0,
        })),
        unclassified_count: 0,
      }),
    );
  }
  if (path === "admin/analytics/ratings") {
    scope(p);
    return json(
      aggregate(p, { items: [], average_rating: null, coverage: "NOT_SEEDED" }),
    );
  }
  if (path === "admin/analytics/cancellations") {
    const rows = selectOrders(p).filter((o) => o.status === "CANCELLED");
    return json(
      aggregate(p, {
        total: rows.length,
        items: [
          {
            actor_type: "CUSTOMER",
            reason_code: "CHANGED_MIND",
            count: Math.ceil(rows.length * 0.625),
          },
          {
            actor_type: "DRIVER",
            reason_code: "VEHICLE_BREAKDOWN",
            count: rows.length - Math.ceil(rows.length * 0.625),
          },
        ],
        basis:
          "Synthetic cancellation attribution, not stored production evidence",
      }),
    );
  }
}
