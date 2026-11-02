import type { Order, Row } from "@/lib/mock-api/types";
type SeedDependencies = {
  seedCustomers: Row[];
  id: (n: number, family?: number) => string;
  MARKET_ID: string;
  groups: Record<string, string>;
};
export function seedOrders({
  seedCustomers,
  id,
  MARKET_ID,
  groups,
}: SeedDependencies): Order[] {
  function makeOrder(
    n: number,
    status: string,
    day: number,
    customerIndex: number,
    amount: number,
  ): Order {
    const c = seedCustomers[customerIndex];
    const delivered = status === "DELIVERED";
    const method = ["UPI", "CARD", "CASH"][n % 3];
    const refunded = status === "CANCELLED" && method !== "CASH";
    const paid = status !== "CANCELLED" && (method !== "CASH" || delivered);
    const created = `2026-10-${String(day).padStart(2, "0")}T${String(4 + (n % 4)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}:00Z`;
    return {
      id: id(n),
      order_number: `RY-${10483 - n}`,
      market_id: MARKET_ID,
      status,
      status_group: groups[status],
      created_at: created,
      completed_at: delivered ? created : null,
      customer: {
        id: c.id,
        customer_number: String(c.customer_number),
        display_name: String(c.display_name),
        customer_type: String(c.customer_type),
        phone_masked: String(c.phone_masked),
      },
      route: {
        pickup_label: [
          "Indiranagar",
          "Whitefield",
          "Jayanagar",
          "HSR Layout",
          "Koramangala",
        ][n % 5],
        drop_label: [
          "Koramangala",
          "HSR Layout",
          "JP Nagar",
          "MG Road",
          "Bellandur",
        ][n % 5],
        stop_count: 2,
      },
      vehicle_type: {
        id: id(n % 3 === 1 ? 2 : 1, 4),
        code: n % 3 === 1 ? "TATA_ACE" : "BIKE",
        name: n % 3 === 1 ? "Mini truck" : "2 Wheeler",
      },
      fare: {
        quoted_amount: amount.toFixed(2),
        final_amount: delivered ? amount.toFixed(2) : null,
        currency: "INR",
      },
      payment: {
        payment_id: id(n, 7),
        method,
        timing: method === "CASH" ? "POST_DELIVERY" : "PRE_DISPATCH",
        status: paid || refunded ? "PAID" : "PENDING",
        gateway_status: refunded
          ? "REFUNDED"
          : status === "CANCELLED"
            ? "CANCELLED"
            : paid
              ? "SUCCESS"
              : "PENDING",
        paid_at: paid || refunded ? created : null,
        refunded_amount: refunded ? amount.toFixed(2) : "0.00",
      },
      assigned_driver_id: ["SEARCHING_DRIVER", "CANCELLED"].includes(status)
        ? null
        : id((n % 3) + 1, 5),
    };
  }

  const first = [
    "DELIVERED",
    "PICKED_UP",
    "DRIVER_ASSIGNED",
    "SEARCHING_DRIVER",
    "CANCELLED",
    "DELIVERED",
    "DELIVERED",
  ].map((s, i) =>
    makeOrder(i + 1, s, 14, i, [280, 640, 220, 420, 180, 760, 240][i]),
  );
  const quotas: [[string, number][], number][] = [
    [
      [
        ["DELIVERED", 797],
        ["PICKED_UP", 63],
        ["DRIVER_ASSIGNED", 39],
        ["SEARCHING_DRIVER", 23],
        ["CANCELLED", 31],
      ],
      14,
    ],
    [
      [
        ["DELIVERED", 10400],
        ["PICKED_UP", 256],
        ["DRIVER_ASSIGNED", 240],
        ["SEARCHING_DRIVER", 176],
        ["CANCELLED", 448],
      ],
      0,
    ],
  ];
  let discountIndex = 0;
  for (const [entries, day] of quotas)
    for (const [status, count] of entries)
      for (let i = 0; i < count; i++) {
        const n = first.length + 1;
        let amount = 255;
        if (day === 14 && status === "DELIVERED" && discountIndex < 3)
          amount -= [172, 172, 171][discountIndex++];
        const order = makeOrder(n, status, day || 1 + (i % 13), n % 7, amount);
        if (n > 10475) order.order_number = `RY-ARCH-${n}`;
        first.push(order);
      }
  return first;
}
