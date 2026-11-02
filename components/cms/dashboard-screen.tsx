"use client";
import { ArrowRight } from "lucide-react";
import {
  api,
  dateLabel,
  dateTime,
  label,
  number,
  query,
  rupees,
  useApi,
  type Aggregate,
  type Dashboard,
  type Page,
  type Row,
} from "@/lib/cms/client";
import {
  Badge,
  Cell,
  Chart,
  LoadState,
  Panel,
  Stats,
  Table,
  TextButton,
} from "@/components/cms/ui";
import { type ScreenProps } from "@/components/cms/screen-utils";
export function DashboardScreen({ period, revision, actions }: ScreenProps) {
  const state = useApi<[Aggregate<Dashboard>, Page<Row>]>(
    [`/admin/dashboard?${query(period)}`, "/admin/web-enquiries?limit=3"],
    revision,
  );
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [response, enquiries] = state.data;
  const d = response.data;
  return (
    <>
      <Stats
        items={[
          {
            label: "Delivered fare revenue",
            value: rupees(d.gross_fare_revenue),
            note: dateLabel(period),
          },
          {
            label: "Snapshot-day revenue",
            value: rupees(d.today_gross_fare_revenue),
            note: `${d.today_date} · delivered fares`,
          },
          {
            label: "Bookings · selected period",
            value: number(d.bookings_count),
            note: `B2C ${number(d.bookings_by_customer_type.INDIVIDUAL)} · B2B ${number(d.bookings_by_customer_type.BUSINESS)}`,
          },
          {
            label: "Snapshot-day bookings",
            value: number(d.today_bookings_count),
            note: `${number(d.today_counts_by_group.DELIVERED)} delivered · ${d.today_date}`,
          },
        ]}
      />
      <div className="mini-stats">
        {["DELIVERED", "UNASSIGNED", "CONFIRMED", "ACTIVE", "CANCELLED"].map(
          (key) => (
            <div key={key}>
              <h3>{label(key)}</h3>
              <strong>{number(d.counts_by_group[key])}</strong>
              <p>Selected booking cohort</p>
            </div>
          ),
        )}
      </div>
      <div className="grid wide">
        <Panel
          title="Revenue momentum"
          sub={`${dateLabel(period)} · delivered fares`}
        >
          <Chart points={d.revenue_series} />
        </Panel>
        <Panel
          title="Rides by business"
          sub="B2C = individual · B2B = business"
        >
          <Table
            heads={["Status", "B2C", "B2B"]}
            rows={d.rides_by_customer_type_and_group.map((r) => [
              label(r.status_group),
              number(r.individual_count),
              number(r.business_count),
            ])}
          />
        </Panel>
      </div>
      <Panel
        title="Web enquiries"
        sub={`${enquiries.total_count} enquiries · review and follow-up`}
        action={<Badge orange>Web records</Badge>}
      >
        <Table
          heads={[
            "Contact",
            "Reason",
            "Enquiry details",
            "Owner / received",
            "Action",
          ]}
          rows={enquiries.items.map((r) => [
            <Cell
              key="c"
              title={String(r.contact_name)}
              sub={String(r.phone_masked)}
            />,
            label(r.reason_code),
            String(r.message),
            <Cell
              key="t"
              title={label(r.status)}
              sub={dateTime(r.received_at)}
            />,
            <TextButton
              key="a"
              onClick={() =>
                actions.dialog({
                  title: String(r.contact_name),
                  fields: [
                    {
                      name: "status",
                      label: "Follow-up status",
                      options: [
                        "NEW",
                        "ASSIGNED",
                        "FOLLOW_UP",
                        "RESOLVED",
                        "SPAM",
                      ].map((value) => ({ value, label: label(value) })),
                      value: String(r.status),
                    },
                    { name: "note", label: "Follow-up note", required: true },
                  ],
                  submitLabel: "Save follow-up",
                  submit: async (data) => {
                    await api(`/admin/web-enquiries/${r.id}`, {
                      method: "PATCH",
                      body: JSON.stringify({
                        status: data.get("status"),
                        note: data.get("note"),
                        reason: "CMS follow-up update",
                      }),
                    });
                    actions.refresh();
                    actions.notify("Follow-up saved.");
                  },
                })
              }
            >
              Review{" "}
              <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </TextButton>,
          ])}
        />
      </Panel>
    </>
  );
}
