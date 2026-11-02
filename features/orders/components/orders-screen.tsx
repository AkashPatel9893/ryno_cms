"use client";
import { ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  dateLabel,
  dateTime,
  exportData,
  label,
  number,
  query,
  rupees,
  useApi,
  type Order,
  type Page,
} from "@/lib/cms/client";
import {
  Badge,
  Button,
  Cell,
  LoadState,
  Pager,
  Panel,
  Stats,
  Table,
  Tabs,
  TextButton,
} from "@/components/cms/ui";
import { attempt, type ScreenProps } from "@/components/cms/screen-utils";
const orderGroups = [
  "",
  "UNASSIGNED",
  "CONFIRMED",
  "ACTIVE",
  "DELIVERED",
  "CANCELLED",
  "FAILED",
];
export function OrdersScreen({ period, actions }: ScreenProps) {
  const [tab, setTab] = useState(0),
    [search, setSearch] = useState(""),
    [method, setMethod] = useState(""),
    [business, setBusiness] = useState(""),
    [timing, setTiming] = useState(""),
    [cursors, setCursors] = useState<string[]>([""]);
  const cursor = cursors.at(-1) || "";
  const filters = {
    q: search,
    payment_method_type: method,
    customer_type: business,
    payment_timing: timing,
  };
  const orders = useApi<[Page<Order>]>([
    `/admin/order-register?${query(period, { ...filters, status_group: orderGroups[tab], cursor, limit: "7" })}`,
  ]);
  const summary = useApi<
    [
      {
        total_count: number;
        counts_by_group: Record<string, number>;
        delivered_count: number;
        in_progress_count: number;
        cancelled_count: number;
        cancellation_rate_percent: number | null;
      },
    ]
  >([`/admin/order-register/summary?${query(period, filters)}`]);
  const reset = () => setCursors([""]);
  const rows = orders.data?.[0],
    counts = summary.data?.[0];
  function openOrder(order: Order) {
    actions.inspect(order.order_number, `/admin/orders/${order.id}`);
  }
  return (
    <>
      {counts && (
        <Stats
          items={[
            {
              label: "Total bookings",
              value: number(counts.total_count),
              note: dateLabel(period),
            },
            {
              label: "Delivered",
              value: number(counts.delivered_count),
              note: "Selected booking cohort",
            },
            {
              label: "In progress",
              value: number(counts.in_progress_count),
              note: "Unassigned + confirmed + active",
            },
            {
              label: "Cancelled",
              value: number(counts.cancelled_count),
              note:
                counts.cancellation_rate_percent == null
                  ? "No bookings"
                  : `${counts.cancellation_rate_percent}% of selected bookings`,
            },
          ]}
        />
      )}
      <Tabs
        items={orderGroups.map(
          (g, i) =>
            `${i ? label(g) : "All orders"}${counts ? " · " + number(i ? counts.counts_by_group[g] : counts.total_count) : ""}`,
        )}
        value={tab}
        onChange={(i) => {
          setTab(i);
          reset();
        }}
      />
      <Panel
        title="Order register"
        sub="Raw backend statuses, masked contact details and payment timing"
        action={
          <Button
            onClick={() =>
              attempt(actions, async () => {
                const count = await exportData("order_register", period, {
                  ...filters,
                  status_group: orderGroups[tab],
                });
                actions.notify(`${number(count)} matching orders exported.`);
              })
            }
          >
            Export matching orders
          </Button>
        }
      >
        <div className="filters">
          <Input
            aria-label="Search orders"
            placeholder="Search order number, customer or masked phone"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              reset();
            }}
          />
          <select
            aria-label="Payment method"
            value={method}
            onChange={(e) => {
              setMethod(e.target.value);
              reset();
            }}
          >
            <option value="">All payment methods</option>
            {["UPI", "CARD", "CASH", "NETBANKING", "WALLET"].map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
          <select
            aria-label="Payment timing"
            value={timing}
            onChange={(e) => {
              setTiming(e.target.value);
              reset();
            }}
          >
            <option value="">All payment timings</option>
            <option value="PRE_DISPATCH">Before dispatch</option>
            <option value="POST_DELIVERY">Pay on delivery</option>
          </select>
          <select
            aria-label="Business type"
            value={business}
            onChange={(e) => {
              setBusiness(e.target.value);
              reset();
            }}
          >
            <option value="">B2C + B2B</option>
            <option value="INDIVIDUAL">B2C · Individual</option>
            <option value="BUSINESS">B2B · Business</option>
          </select>
          <Button
            onClick={() => {
              setSearch("");
              setMethod("");
              setBusiness("");
              setTiming("");
              setTab(0);
              reset();
            }}
          >
            Reset filters
          </Button>
        </div>
        {rows ? (
          <>
            <Table
              heads={[
                "Order ID",
                "Customer / route",
                "Total fare",
                "Ride status",
                "Payment",
                "Date",
                "Actions",
              ]}
              rows={rows.items.map((r) => [
                <Cell
                  key="i"
                  title={r.order_number}
                  sub={r.vehicle_type.name}
                />,
                <Cell
                  key="c"
                  title={
                    <>
                      {r.customer.display_name}
                      <small>
                        {r.customer.phone_masked} ·{" "}
                        {r.customer.customer_type === "BUSINESS"
                          ? "B2B"
                          : "B2C"}
                      </small>
                    </>
                  }
                  sub={`${r.route.pickup_label} → ${r.route.drop_label}`}
                />,
                rupees(r.fare.final_amount ?? r.fare.quoted_amount),
                <Cell
                  key="s"
                  title={
                    <Badge
                      orange={["ACTIVE", "UNASSIGNED"].includes(r.status_group)}
                    >
                      {label(r.status_group)}
                    </Badge>
                  }
                  sub={label(r.status)}
                />,
                <Cell
                  key="p"
                  title={`${r.payment.gateway_status === "REFUNDED" ? "Refunded" : r.payment.gateway_status === "CANCELLED" ? "Not collected" : label(r.payment.status)} · ${r.payment.method ?? "No method yet"}`}
                  sub={
                    r.payment.timing === "POST_DELIVERY"
                      ? "Pay on delivery"
                      : "Before dispatch"
                  }
                />,
                dateTime(r.created_at),
                <TextButton key="a" onClick={() => openOrder(r)}>
                  View{" "}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </TextButton>,
              ])}
            />
            <Pager
              count={rows.total_count}
              cursor={cursor}
              next={rows.next_cursor}
              onNext={(next) => setCursors([...cursors, next])}
              onPrevious={() => setCursors(cursors.slice(0, -1))}
            />
          </>
        ) : (
          <LoadState error={orders.error} retry={actions.refresh} />
        )}
      </Panel>
      <p className="muted">
        POD means pay-on-delivery timing. CASH, UPI, CARD, NETBANKING and WALLET
        are payment methods. Failed deliveries remain a separate group.
      </p>
    </>
  );
}
