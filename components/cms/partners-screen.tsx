"use client";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import {
  label,
  number,
  post,
  query,
  rupees,
  useApi,
  type Aggregate,
  type Page,
  type Row,
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
import {
  DriverReviewPanel,
  VerificationQueues,
} from "@/components/cms/driver-verification";
import { VehicleCatalog } from "@/components/cms/vehicle-catalog";
import { type ScreenProps } from "@/components/cms/screen-utils";
export function PartnersScreen({ period, revision, actions }: ScreenProps) {
  const [tab, setTab] = useState(0),
    [riderView, setRiderView] = useState(0),
    [search, setSearch] = useState(""),
    [cursors, setCursors] = useState<string[]>([""]);
  const [reviewDriver, setReviewDriver] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const cursor = cursors.at(-1) || "";
  const paths = [
    "drivers",
    "customers",
    "business-accounts",
    "brands",
    "brand-campaigns",
  ];
  const state = useApi<
    [Aggregate<Record<string, number>>, Page<Row>, Page<Row>]
  >(
    [
      `/admin/partners/summary?${query(period)}`,
      `/admin/${paths[tab]}?${query(period, { q: search, cursor, limit: "7" })}`,
      "/admin/driver-invitations?limit=10",
    ],
    revision,
  );
  const data = state.data;
  const invite = () =>
    actions.dialog({
      title: "Invite a rider",
      fields: [
        { name: "name", label: "Rider name", required: true },
        {
          name: "phone",
          label: "Phone · E.164 format",
          type: "tel",
          required: true,
          value: "+91",
        },
      ],
      submitLabel: "Create invitation",
      submit: async (form) => {
        await post("/admin/driver-invitations", {
          name: form.get("name"),
          phone: form.get("phone"),
        });
        actions.refresh();
        actions.notify("Invitation created.");
      },
    });
  return (
    <>
      {data && (
        <Stats
          items={[
            {
              label: "Registered riders",
              value: number(data[0].data.registered_riders),
              note: `${number(data[0].data.online_riders)} online · ${number(data[0].data.on_delivery_riders)} on delivery`,
            },
            {
              label: "Registered customers",
              value: number(data[0].data.registered_customers),
              note: "Actual registry count",
            },
            {
              label: "Live B2B accounts",
              value: number(data[0].data.live_b2b_partners),
              note: "Active accounts with orders in the selected period",
            },
            {
              label: "Advertising brands",
              value: number(data[0].data.advertising_brands),
              note: "Campaign advertisers",
            },
          ]}
        />
      )}
      <Tabs
        items={[
          "Riders",
          "Customers",
          "B2B accounts",
          "Brands",
          "Ad campaigns",
        ]}
        value={tab}
        onChange={(i) => {
          setTab(i);
          setSearch("");
          setCursors([""]);
        }}
      />
      {tab === 0 && (
        <div className="section-subnav">
          <Tabs
            items={["All riders", "Verification", "Vehicle types"]}
            value={riderView}
            onChange={setRiderView}
          />
        </div>
      )}
      {(tab !== 0 || riderView === 0) && (
        <Panel
          title={
            [
              "Registered riders",
              "Registered customers",
              "B2B accounts",
              "Advertising brands",
              "Brand campaigns",
            ][tab]
          }
          sub="Search and review records"
          action={
            tab === 0 ? (
              <Button primary onClick={invite}>
                Invite rider
              </Button>
            ) : undefined
          }
        >
          <div className="filters">
            <Input
              aria-label="Search partners"
              placeholder="Search name, reference or masked contact"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursors([""]);
              }}
            />
          </div>
          {data ? (
            <>
              <Table
                heads={
                  tab === 0
                    ? [
                        "Rider / contact",
                        "Vehicle",
                        "Compliance",
                        "Availability",
                        "Delivered",
                        "Rating",
                        "Action",
                      ]
                    : tab === 1
                      ? [
                          "Customer",
                          "Type",
                          "Delivered",
                          "Fare revenue",
                          "Action",
                        ]
                      : tab === 2
                        ? [
                            "Business",
                            "Account",
                            "Locations",
                            "Terms",
                            "Action",
                          ]
                        : tab === 3
                          ? ["Brand", "Contact", "Status", "Action"]
                          : [
                              "Campaign",
                              "Placement",
                              "Booked value",
                              "Status",
                              "Action",
                            ]
                }
                rows={data[1].items.map((r) => {
                  const view = (
                    <TextButton
                      key="v"
                      onClick={() =>
                        actions.inspect(
                          String(r.display_name || r.first_name || r.title),
                          `/admin/${paths[tab]}/${r.id}`,
                        )
                      }
                    >
                      View{" "}
                      <ArrowUpRight
                        size={14}
                        strokeWidth={1.8}
                        aria-hidden="true"
                      />
                    </TextButton>
                  );
                  if (tab === 0) {
                    const vehicle = r.current_vehicle as {
                      name: string;
                      registration_number: string;
                    } | null;
                    const riderName =
                      `${r.first_name} ${r.last_name || ""}`.trim();
                    return [
                      <Cell
                        key="n"
                        title={`${r.first_name} ${r.last_name || ""} · ${r.driver_number}`}
                        sub={String(r.phone_masked)}
                      />,
                      vehicle
                        ? `${vehicle.name} · ${vehicle.registration_number}`
                        : "No approved vehicle",
                      <Badge key="c">{label(r.compliance_status)}</Badge>,
                      <Badge key="a" orange={r.availability !== "OFFLINE"}>
                        {r.availability === "AVAILABLE"
                          ? "Online"
                          : r.availability === "ASSIGNED"
                            ? "On delivery"
                            : label(r.availability)}
                      </Badge>,
                      number(r.period_delivered_count),
                      r.rating == null ? "Not rated" : String(r.rating),
                      <div className="row-actions" key="actions">
                        {view}
                        <TextButton
                          onClick={() =>
                            setReviewDriver({
                              id: String(r.id),
                              name: riderName,
                            })
                          }
                        >
                          Verification{" "}
                          <ArrowRight
                            size={14}
                            strokeWidth={1.8}
                            aria-hidden="true"
                          />
                        </TextButton>
                      </div>,
                    ];
                  }
                  if (tab === 1)
                    return [
                      <Cell
                        key="n"
                        title={String(r.display_name)}
                        sub={String(r.phone_masked)}
                      />,
                      r.customer_type === "BUSINESS"
                        ? "B2B · Business"
                        : "B2C · Individual",
                      number(r.period_delivered_count),
                      rupees(r.period_fare_revenue),
                      view,
                    ];
                  if (tab === 2)
                    return [
                      String(r.display_name),
                      String(r.account_code),
                      number(r.location_count),
                      label(r.payment_terms),
                      view,
                    ];
                  if (tab === 3)
                    return [
                      String(r.display_name),
                      <Cell
                        key="c"
                        title={String(r.contact_name)}
                        sub={String(r.email)}
                      />,
                      <Badge key="s">{label(r.status)}</Badge>,
                      view,
                    ];
                  return [
                    String(r.title),
                    label(r.placement),
                    rupees(r.booked_ad_value),
                    <Badge key="s" orange={r.status === "LIVE"}>
                      {label(r.status)}
                    </Badge>,
                    view,
                  ];
                })}
              />
              <Pager
                count={data[1].total_count}
                cursor={cursor}
                next={data[1].next_cursor}
                onNext={(next) => setCursors([...cursors, next])}
                onPrevious={() => setCursors(cursors.slice(0, -1))}
              />
            </>
          ) : (
            <LoadState error={state.error} retry={actions.refresh} />
          )}
        </Panel>
      )}
      {tab === 0 && riderView === 2 && (
        <VehicleCatalog revision={revision} actions={actions} />
      )}
      {tab === 0 && reviewDriver && (
        <DriverReviewPanel
          key={reviewDriver.id}
          driverId={reviewDriver.id}
          driverName={reviewDriver.name}
          revision={revision}
          actions={actions}
          onClose={() => setReviewDriver(null)}
        />
      )}
      {tab === 0 && riderView === 1 && (
        <VerificationQueues
          revision={revision}
          actions={actions}
          onReview={(id, name) => setReviewDriver({ id, name })}
        />
      )}
      {tab === 0 && riderView === 0 && data && (
        <Panel
          title="Pending rider invitations"
          sub="An invitation does not create an approved driver or send a real message"
        >
          <Table
            heads={["Name", "Contact", "Status"]}
            rows={data[2].items.map((r) => [
              String(r.name),
              String(r.phone_masked),
              <Badge key="b">{label(r.status)}</Badge>,
            ])}
            empty="No pending invitations. Invite a rider to start onboarding."
          />
        </Panel>
      )}
    </>
  );
}
