"use client";
import {
  dateLabel,
  label,
  number,
  query,
  rupees,
  useApi,
  type Aggregate,
  type Page,
  type Point,
  type Row,
} from "@/lib/cms/client";
import { type ScreenProps } from "@/components/cms/screen-utils";
import {
  Cell,
  Chart,
  LoadState,
  Panel,
  Stats,
  Table,
} from "@/components/cms/ui";

type DriverMetric = Row & {
  period_delivered_count: number;
  period_fare_revenue: string;
};
export function AnalyticsScreen({ period, revision, actions }: ScreenProps) {
  const state = useApi<
    [
      Aggregate<{
        gross_fare_revenue: string;
        bookings_count: number;
        average_rating: null;
        on_time_rate_percent: null;
      }>,
      Aggregate<{ series: Point[]; total: string }>,
      Aggregate<{ series: { date: string; bookings_count: number }[] }>,
      Aggregate<{ items: Row[] }>,
      Aggregate<{
        items: {
          name: string;
          bookings_count: number;
          share_percent: number;
        }[];
      }>,
      Aggregate<Page<DriverMetric>>,
      Aggregate<{
        items: Row[];
        average_rating: string | null;
        rating_count: number;
      }>,
      Aggregate<{
        total: number;
        items: { actor_type: string; reason_code: string; count: number }[];
      }>,
    ]
  >(
    [
      "overview",
      "revenue",
      "demand",
      "customers",
      "areas",
      "drivers",
      "ratings",
      "cancellations",
    ].map(
      (name) =>
        `/admin/analytics/${name}?${query(period, { limit: name === "ratings" ? "200" : "7" })}`,
    ),
    revision,
  );
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [
    overview,
    revenue,
    demand,
    customers,
    areas,
    drivers,
    ratings,
    cancellations,
  ] = state.data;
  const riderRating = (id: string) => {
    const mine = ratings.data.items.filter(
      (x) => (x.driver as { id: string } | null)?.id === id,
    );
    return mine.length
      ? `${(mine.reduce((sum, x) => sum + Number(x.rating), 0) / mine.length).toFixed(1)} (${mine.length})`
      : "—";
  };
  const max = Math.max(...demand.data.series.map((p) => p.bookings_count), 1);
  return (
    <>
      <Stats
        items={[
          {
            label: "Revenue · selected period",
            value: rupees(overview.data.gross_fare_revenue),
            note: dateLabel(period),
          },
          {
            label: "Bookings",
            value: number(overview.data.bookings_count),
            note: "All booking statuses",
          },
          {
            label: "On-time delivery",
            value: "Not available",
            note: "No promised-delivery/SLA targets",
          },
          {
            label: "Average ride rating",
            value: ratings.data.average_rating
              ? `${Number(ratings.data.average_rating).toFixed(1)} / 5`
              : "Not available",
            note: ratings.data.rating_count
              ? `${number(ratings.data.rating_count)} rating${ratings.data.rating_count === 1 ? "" : "s"} in this period`
              : "No ratings in this period",
          },
        ]}
      />
      <div className="grid wide">
        <Panel
          title="Revenue over time"
          sub={`${rupees(revenue.data.total)} · delivered fares`}
        >
          <Chart points={revenue.data.series} />
        </Panel>
        <Panel title="Daily ride demand" sub={dateLabel(period)}>
          <div className="bar-chart">
            {demand.data.series.map((p) => (
              <div key={p.date}>
                <div
                  style={{
                    height: `${Math.max(p.bookings_count ? 5 : 0, (p.bookings_count / max) * 100)}%`,
                  }}
                  title={`${p.date}: ${p.bookings_count} bookings`}
                />
                <small>{new Date(p.date).getUTCDate()}</small>
              </div>
            ))}
          </div>
          <p className="chart-note">
            Booking creation date · market-local calendar days
          </p>
        </Panel>
      </div>
      <div className="grid wide">
        <Panel
          title="Most repeated customers"
          sub="Ranked by delivered fare revenue"
        >
          <Table
            heads={["Customer", "Revenue rank", "Fare revenue", "Delivered"]}
            rows={customers.data.items.map((r) => [
              <Cell
                key="c"
                title={String(r.display_name)}
                sub={
                  r.customer_type === "BUSINESS"
                    ? "B2B · Business"
                    : "B2C · Individual"
                }
              />,
              `#${r.revenue_rank}`,
              rupees(r.period_fare_revenue),
              number(r.period_delivered_count),
            ])}
          />
        </Panel>
        <Panel
          title="Most-booked pickup areas"
          sub="Pickup areas in active zones"
        >
          <div className="area-list">
            {areas.data.items.map((r) => (
              <div key={r.name}>
                <div>
                  <span>{r.name}</span>
                  <strong>
                    {number(r.bookings_count)} · {r.share_percent}%
                  </strong>
                </div>
                <div className="track">
                  <span style={{ width: r.share_percent + "%" }} />
                </div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <Panel
        title="Top riders & performance"
        sub="Delivered counts, fares and customer ratings · on-time rate needs delivery-time targets"
      >
        <Table
          heads={[
            "Rider",
            "Delivered",
            "Fare revenue",
            "Rating",
            "On-time rate",
          ]}
          rows={drivers.data.items.map((r) => [
            <Cell
              key="r"
              title={`${r.first_name} ${r.last_name || ""}`}
              sub={String(r.driver_number)}
            />,
            number(r.period_delivered_count),
            rupees(r.period_fare_revenue),
            riderRating(String(r.id)),
            "No target set",
          ])}
        />
      </Panel>
      <div className="grid">
        <Panel title="Ride ratings" sub="Customer ratings given after delivery">
          <Table
            heads={["Order", "Rating", "Feedback"]}
            rows={ratings.data.items
              .slice(0, 7)
              .map((r) => [
                String(r.order_number),
                String(r.rating),
                r.comment ? String(r.comment) : "—",
              ])}
            empty="No rating records. Customer feedback is not fabricated."
          />
        </Panel>
        <Panel
          title="Why rides get cancelled"
          sub={`${number(cancellations.data.total)} cancellations · cancellation attribution`}
        >
          <Table
            heads={["Cancelled by", "Reason", "Bookings"]}
            rows={cancellations.data.items.map((r) => [
              label(r.actor_type),
              label(r.reason_code),
              number(r.count),
            ])}
          />
          <p className="muted">
            Production reporting uses the stored cancellation actor and reason.
          </p>
        </Panel>
      </div>
    </>
  );
}
