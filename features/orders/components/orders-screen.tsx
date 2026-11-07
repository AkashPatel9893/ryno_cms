"use client";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  dateLabel,
  dateTime,
  exportData,
  label,
  number,
  phoneOf,
  post,
  query,
  rupees,
  useApi,
  type Actions,
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

type ActiveTrip = {
  id: string;
  trip_number: string;
  order_id: string;
  driver_id: string;
  status: string;
  attempt_number: number;
  created_at: string;
};

type AdminAction = {
  id: string;
  admin_user_id: string;
  action_type: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  created_at: string;
};

function cancelOrderDialog(actions: Actions, order: Order) {
  actions.dialog({
    title: `Cancel Order ${order.order_number}`,
    body: (
      <p className="muted">
        Cancel order for {order.customer.display_name}. This will trigger
        customer notification and any applicable refund.
      </p>
    ),
    fields: [
      {
        name: "reason_code",
        label: "Cancellation reason",
        required: true,
        options: [
          {
            value: "CUSTOMER_REQUEST",
            label: "Customer requested cancellation",
          },
          { value: "NO_DRIVER_FOUND", label: "No nearby driver found" },
          { value: "FRAUD_ALERT", label: "Suspected fraud or invalid address" },
          { value: "OPS_CANCEL", label: "Operations manual intervention" },
          { value: "OTHER", label: "Other reason" },
        ],
      },
      {
        name: "note",
        label: "Internal operational note (optional)",
      },
    ],
    submitLabel: "Confirm cancellation",
    submit: async (form) => {
      const reasonCode = String(form.get("reason_code") || "OPS_CANCEL");
      const note = String(form.get("note") || "").trim();
      await post(`/admin/orders/${order.id}/cancel`, {
        reason_code: reasonCode,
        ...(note ? { note } : {}),
      });
      actions.refresh();
      actions.notify(`Order ${order.order_number} cancelled.`);
    },
  });
}

function assignDriverDialog(actions: Actions, order: Order) {
  actions.dialog({
    title: `Assign Driver to ${order.order_number}`,
    body: (
      <p className="muted">
        Manually assign an approved driver to this unassigned booking.
      </p>
    ),
    fields: [
      {
        name: "driver_id",
        label: "Driver ID (UUID)",
        required: true,
      },
      {
        name: "reason",
        label: "Assignment reason",
        required: true,
        value: "Manual ops dispatch",
      },
    ],
    submitLabel: "Assign driver",
    submit: async (form) => {
      const driverId = String(form.get("driver_id") || "").trim();
      const reason = String(form.get("reason") || "").trim();
      if (!driverId) throw new Error("Driver ID is required.");
      if (reason.length < 3)
        throw new Error("Reason must be at least 3 characters.");
      await post(`/admin/orders/${order.id}/assign`, {
        driver_id: driverId,
        reason,
      });
      actions.refresh();
      actions.notify(`Driver assigned to order ${order.order_number}.`);
    },
  });
}

function reassignDriverDialog(actions: Actions, order: Order) {
  actions.dialog({
    title: `Reassign Order ${order.order_number}`,
    body: (
      <p className="muted">
        Transfer this order to another driver, or leave driver empty to release
        it to the pool.
      </p>
    ),
    fields: [
      {
        name: "driver_id",
        label: "New Driver ID (UUID - optional to unassign)",
        required: false,
      },
      {
        name: "reason",
        label: "Reassignment reason",
        required: true,
        value: "Driver vehicle breakdown / requested release",
      },
    ],
    submitLabel: "Confirm reassignment",
    submit: async (form) => {
      const driverId = String(form.get("driver_id") || "").trim() || null;
      const reason = String(form.get("reason") || "").trim();
      if (reason.length < 3)
        throw new Error("Reason must be at least 3 characters.");
      await post(`/admin/orders/${order.id}/reassign`, {
        driver_id: driverId,
        reason,
      });
      actions.refresh();
      actions.notify(`Order ${order.order_number} reassigned.`);
    },
  });
}

function ActiveTripsPanel({ actions }: { actions: Actions }) {
  const state = useApi<[ActiveTrip[]]>(["/admin/active-trips"]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const trips = state.data[0];
  return (
    <Panel
      title="Live Active Trips"
      sub={`${trips.length} trips currently underway on the road`}
      action={
        <Button onClick={actions.refresh}>
          <RefreshCw size={14} className="inline mr-1" /> Refresh trips
        </Button>
      }
    >
      <Table
        heads={[
          "Trip Number",
          "Order ID",
          "Driver ID",
          "Attempt",
          "Trip Status",
          "Started At",
          "Actions",
        ]}
        rows={trips.map((t) => [
          t.trip_number,
          <TextButton
            key="o"
            onClick={() =>
              actions.inspect(
                `Order ${t.order_id}`,
                `/admin/orders/${t.order_id}`,
              )
            }
          >
            {t.order_id.slice(0, 8)}…{" "}
            <ArrowUpRight size={14} className="inline" />
          </TextButton>,
          <TextButton
            key="d"
            onClick={() =>
              actions.inspect(
                `Driver ${t.driver_id}`,
                `/admin/drivers/${t.driver_id}`,
              )
            }
          >
            {t.driver_id.slice(0, 8)}…{" "}
            <ArrowUpRight size={14} className="inline" />
          </TextButton>,
          `Attempt #${t.attempt_number}`,
          <Badge key="s" orange>
            {label(t.status)}
          </Badge>,
          dateTime(t.created_at),
          <TextButton
            key="a"
            onClick={() =>
              actions.inspect(
                `Trip ${t.trip_number}`,
                `/admin/orders/${t.order_id}`,
              )
            }
          >
            Inspect <ArrowUpRight size={14} className="inline" />
          </TextButton>,
        ])}
        empty="No trips currently in flight. All deliveries completed or awaiting dispatch."
      />
    </Panel>
  );
}

function AdminActionsPanel({
  actions,
  initialOrderId,
}: {
  actions: Actions;
  initialOrderId: string;
}) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const [selectedOrderId, setSelectedOrderId] = useState(initialOrderId);
  const params = new URLSearchParams({
    entity_type: "order",
    entity_id: selectedOrderId,
  });
  const state = useApi<[AdminAction[]]>(
    [`/admin/admin-actions?${params}`],
    Boolean(selectedOrderId),
  );
  return (
    <Panel
      title="Order actions audit"
      sub="Find administrative actions for an order by its record ID."
      action={
        selectedOrderId ? (
          <Button onClick={actions.refresh}>
            <RefreshCw size={14} className="inline mr-1" /> Refresh log
          </Button>
        ) : undefined
      }
    >
      <form
        className="filters"
        onSubmit={(event) => {
          event.preventDefault();
          setSelectedOrderId(orderId.trim());
        }}
      >
        <Input
          aria-label="Order record ID"
          placeholder="Order record ID (UUID)"
          value={orderId}
          onChange={(event) => setOrderId(event.target.value)}
          required
          pattern="[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}"
          title="Enter a valid order record ID"
        />
        <button className="button primary" type="submit">
          Find actions
        </button>
      </form>
      {selectedOrderId &&
        (!state.data ? (
          <LoadState error={state.error} retry={actions.refresh} />
        ) : (
          <Table
            heads={[
              "Action Type",
              "Target Entity",
              "Admin User",
              "Reason",
              "Timestamp",
            ]}
            rows={state.data[0].map((a) => [
              <Badge key="t" orange={a.action_type.includes("CANCEL")}>
                {label(a.action_type)}
              </Badge>,
              <Cell
                key="e"
                title={label(a.entity_type)}
                sub={a.entity_id || "—"}
              />,
              <span key="u" className="text-xs text-[var(--muted)]">
                {a.admin_user_id || "System"}
              </span>,
              String(a.reason || "—"),
              dateTime(a.created_at),
            ])}
            empty="No admin actions recorded for this order."
          />
        ))}
    </Panel>
  );
}

export function OrdersScreen({ period, actions }: ScreenProps) {
  const [view, setView] = useState(0); // 0: Order Register, 1: Live Active Trips, 2: Admin Actions
  const [auditOrderId, setAuditOrderId] = useState("");
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
      <div className="section-subnav mb-4">
        <Tabs
          items={["Order register", "Live active trips", "Admin actions audit"]}
          value={view}
          onChange={setView}
        />
      </div>

      {view === 1 && <ActiveTripsPanel actions={actions} />}
      {view === 2 && (
        <AdminActionsPanel actions={actions} initialOrderId={auditOrderId} />
      )}

      {view === 0 && (
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
            sub="Raw backend statuses, contact details and payment timing"
            action={
              <Button
                onClick={() =>
                  attempt(actions, async () => {
                    const count = await exportData("order_register", period, {
                      ...filters,
                      status_group: orderGroups[tab],
                    });
                    actions.notify(
                      `${number(count)} matching orders exported.`,
                    );
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
                placeholder="Search order number, customer or phone"
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
                  rows={rows.items.map((r) => {
                    const isTerminal = [
                      "DELIVERED",
                      "CANCELLED",
                      "FAILED",
                    ].includes(r.status_group);
                    const isUnassigned = r.status_group === "UNASSIGNED";
                    const isAssignedOrActive = ["CONFIRMED", "ACTIVE"].includes(
                      r.status_group,
                    );

                    return [
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
                              {phoneOf(r.customer)} ·{" "}
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
                            orange={["ACTIVE", "UNASSIGNED"].includes(
                              r.status_group,
                            )}
                          >
                            {label(r.status_group)}
                          </Badge>
                        }
                        sub={label(r.status)}
                      />,
                      <Cell
                        key="p"
                        title={`${r.payment.gateway_status === "REFUNDED" ? "Refunded" : r.payment.gateway_status === "CANCELLED" ? "Not collected" : label(r.payment.status)} · ${!r.payment.method || r.payment.method === "NONE" ? "No method yet" : r.payment.method}`}
                        sub={
                          r.payment.timing === "POST_DELIVERY"
                            ? "Pay on delivery"
                            : "Before dispatch"
                        }
                      />,
                      dateTime(r.created_at),
                      <div className="row-actions" key="actions">
                        <TextButton onClick={() => openOrder(r)}>
                          View{" "}
                          <ArrowUpRight
                            size={14}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </TextButton>
                        <TextButton
                          onClick={() => {
                            setAuditOrderId(r.id);
                            setView(2);
                          }}
                        >
                          Audit
                        </TextButton>
                        {!isTerminal && (
                          <TextButton
                            onClick={() => cancelOrderDialog(actions, r)}
                          >
                            Cancel
                          </TextButton>
                        )}
                        {isUnassigned && (
                          <TextButton
                            onClick={() => assignDriverDialog(actions, r)}
                          >
                            Assign
                          </TextButton>
                        )}
                        {isAssignedOrActive && (
                          <TextButton
                            onClick={() => reassignDriverDialog(actions, r)}
                          >
                            Reassign
                          </TextButton>
                        )}
                      </div>,
                    ];
                  })}
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
            POD means pay-on-delivery timing. CASH, UPI, CARD, NETBANKING and
            WALLET are payment methods. Active trips and manual assignment
            controls allow direct operations dispatch.
          </p>
        </>
      )}
    </>
  );
}
