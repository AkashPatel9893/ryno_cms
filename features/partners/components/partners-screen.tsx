"use client";
import { ArrowRight, ArrowUpRight, Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  api,
  dateTime,
  label,
  number,
  phoneOf,
  post,
  query,
  rupees,
  useApi,
  type Actions,
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
import { VerificationQueues } from "@/features/partners/components/driver-verification";
import { VehicleCatalog } from "@/features/partners/components/vehicle-catalog";
import { MarketsZones } from "@/features/partners/components/markets-zones";
import { type ScreenProps } from "@/components/cms/screen-utils";

function createBusinessAccountDialog(actions: Actions) {
  actions.dialog({
    title: "Create B2B Commercial Account",
    body: (
      <p className="muted">
        Create a commercial billing profile for an existing BUSINESS customer.
      </p>
    ),
    fields: [
      {
        name: "customer_id",
        label: "Customer ID (UUID)",
        required: true,
      },
      {
        name: "display_name",
        label: "Company / Display Name",
        required: true,
      },
      {
        name: "account_code",
        label: "Account Code (e.g. ACME_CORP)",
        required: true,
      },
      {
        name: "payment_terms",
        label: "Payment Terms",
        required: true,
        options: [
          { value: "PREPAID", label: "Prepaid (Immediate settlement)" },
          { value: "NET_15", label: "Net 15 days" },
          { value: "NET_30", label: "Net 30 days" },
        ],
      },
    ],
    submitLabel: "Create account",
    submit: async (form) => {
      const customerId = String(form.get("customer_id") || "").trim();
      const displayName = String(form.get("display_name") || "").trim();
      const accountCode = String(form.get("account_code") || "")
        .trim()
        .toUpperCase();
      const terms = String(form.get("payment_terms") || "PREPAID");

      if (!customerId) throw new Error("Customer ID is required.");
      if (!displayName) throw new Error("Company name is required.");
      if (!accountCode) throw new Error("Account code is required.");

      await post("/admin/business-accounts", {
        customer_id: customerId,
        display_name: displayName,
        account_code: accountCode,
        payment_terms: terms,
      });
      actions.refresh();
      actions.notify(`B2B account ${displayName} created.`);
    },
  });
}

function editBusinessAccountDialog(actions: Actions, account: Row) {
  actions.dialog({
    title: `Edit B2B Account · ${account.display_name}`,
    fields: [
      {
        name: "display_name",
        label: "Display Name",
        required: true,
        value: String(account.display_name || ""),
      },
      {
        name: "payment_terms",
        label: "Payment Terms",
        required: true,
        options: [
          { value: "PREPAID", label: "Prepaid" },
          { value: "NET_15", label: "Net 15" },
          { value: "NET_30", label: "Net 30" },
        ],
        value: String(account.payment_terms || "PREPAID"),
      },
      {
        name: "reason",
        label: "Reason for change",
        required: true,
        value: "Commercial terms update",
      },
    ],
    submitLabel: "Save changes",
    submit: async (form) => {
      const displayName = String(form.get("display_name") || "").trim();
      const terms = String(form.get("payment_terms") || "PREPAID");
      const reason = String(form.get("reason") || "").trim();

      await api(`/admin/business-accounts/${account.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          display_name: displayName,
          payment_terms: terms,
          reason,
        }),
      });
      actions.refresh();
      actions.notify("B2B account updated.");
    },
  });
}

function triageWebEnquiryDialog(actions: Actions, enquiry: Row) {
  actions.dialog({
    title: `Triage Enquiry · ${enquiry.contact_name}`,
    body: (
      <p className="muted">
        Update status, assign owner, and record follow-up notes for this contact
        inquiry.
      </p>
    ),
    fields: [
      {
        name: "status",
        label: "Enquiry status",
        required: true,
        options: [
          { value: "NEW", label: "New" },
          { value: "ASSIGNED", label: "Assigned" },
          { value: "FOLLOW_UP", label: "Follow-up Needed" },
          { value: "RESOLVED", label: "Resolved" },
          { value: "SPAM", label: "Spam" },
        ],
        value: String(enquiry.status || "NEW"),
      },
      {
        name: "note",
        label: "Triage note",
        required: false,
      },
      {
        name: "reason",
        label: "Reason for status change",
        required: true,
        value: "Admin triage from CMS",
      },
    ],
    submitLabel: "Save update",
    submit: async (form) => {
      const status = String(form.get("status") || "NEW");
      const note = String(form.get("note") || "").trim();
      const reason = String(form.get("reason") || "Admin triage");

      await api(`/admin/web-enquiries/${enquiry.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          ...(note ? { note } : {}),
          reason,
        }),
      });
      actions.refresh();
      actions.notify("Web enquiry updated.");
    },
  });
}

export function PartnersScreen({ period, actions }: ScreenProps) {
  const router = useRouter();
  const [tab, setTab] = useState(0),
    [riderView, setRiderView] = useState(0),
    [search, setSearch] = useState(""),
    [cursors, setCursors] = useState<string[]>([""]);
  const cursor = cursors.at(-1) || "";
  const paths = ["drivers", "customers", "business-accounts", "web-enquiries"];
  const summary = useApi<[Aggregate<Record<string, number>>]>([
    `/admin/partners/summary?${query(period)}`,
  ]);
  const list = useApi<[Page<Row>]>([
    `/admin/${paths[tab]}?${query(period, { q: search, cursor, limit: "7" })}`,
  ]);
  const invitations = useApi<[Page<Row>]>([
    "/admin/driver-invitations?limit=10",
  ]);
  const summaryData = summary.data?.[0];
  const rows = list.data?.[0];
  const invitationRows = invitations.data?.[0];
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
      {summaryData && (
        <Stats
          items={[
            {
              label: "Registered riders",
              value: number(summaryData.data.registered_riders),
              note: `${number(summaryData.data.online_riders)} online · ${number(summaryData.data.on_delivery_riders)} on delivery`,
            },
            {
              label: "Registered customers",
              value: number(summaryData.data.registered_customers),
              note: "Actual registry count",
            },
            {
              label: "Live B2B accounts",
              value: number(summaryData.data.live_b2b_partners),
              note: "Active accounts with orders in the selected period",
            },
            {
              label: "Web enquiries",
              value: number(summaryData.data.open_web_enquiries_count ?? 0),
              note: "Incoming enterprise requests",
            },
          ]}
        />
      )}
      <Tabs
        items={["Riders", "Customers", "B2B accounts", "Web enquiries"]}
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
            items={[
              "All riders",
              "Verification",
              "Vehicle types",
              "Markets & Zones",
            ]}
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
              "Web enquiries",
            ][tab]
          }
          sub="Search, inspect and manage records"
          action={
            tab === 0 ? (
              <Button primary onClick={invite}>
                <Plus size={14} className="inline mr-1" /> Invite rider
              </Button>
            ) : tab === 2 ? (
              <Button
                primary
                onClick={() => createBusinessAccountDialog(actions)}
              >
                <Plus size={14} className="inline mr-1" /> Add B2B account
              </Button>
            ) : undefined
          }
        >
          <div className="filters">
            <Input
              aria-label="Search partners"
              placeholder={
                tab === 3
                  ? "Search contact name, email or phone"
                  : "Search name, reference or contact"
              }
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCursors([""]);
              }}
            />
          </div>
          {rows ? (
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
                        : [
                            "Contact",
                            "Email / Phone",
                            "Reason",
                            "Message",
                            "Status",
                            "Received",
                            "Action",
                          ]
                }
                rows={rows.items.map((r) => {
                  const view = (
                    <TextButton
                      key="v"
                      onClick={() =>
                        actions.inspect(
                          String(
                            r.display_name ||
                              r.first_name ||
                              r.contact_name ||
                              "Record",
                          ),
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
                    return [
                      <Cell
                        key="n"
                        title={`${r.first_name} ${r.last_name || ""} · ${r.driver_number}`}
                        sub={phoneOf(r)}
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
                            router.push(
                              `/partners/drivers/${encodeURIComponent(String(r.id))}/verification`,
                            )
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
                        sub={phoneOf(r)}
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
                      <div className="row-actions" key="actions">
                        {view}
                        <TextButton
                          onClick={() => editBusinessAccountDialog(actions, r)}
                        >
                          Edit terms
                        </TextButton>
                      </div>,
                    ];
                  // tab === 3: Web enquiries
                  return [
                    <Cell
                      key="c"
                      title={String(r.contact_name)}
                      sub={String(r.company_name || "")}
                    />,
                    <Cell
                      key="e"
                      title={String(r.email || "—")}
                      sub={phoneOf(r)}
                    />,
                    label(r.reason_code),
                    <span
                      key="m"
                      className="text-xs max-w-[200px] truncate block"
                      title={String(r.message || "")}
                    >
                      {String(r.message || "—")}
                    </span>,
                    <Badge
                      key="s"
                      orange={r.status === "NEW" || r.status === "FOLLOW_UP"}
                    >
                      {label(r.status)}
                    </Badge>,
                    dateTime(r.received_at),
                    <div className="row-actions" key="actions">
                      {view}
                      <TextButton
                        onClick={() => triageWebEnquiryDialog(actions, r)}
                      >
                        Follow-up
                      </TextButton>
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
            <LoadState error={list.error} retry={actions.refresh} />
          )}
        </Panel>
      )}
      {tab === 0 && riderView === 2 && <VehicleCatalog actions={actions} />}
      {tab === 0 && riderView === 3 && <MarketsZones actions={actions} />}
      {tab === 0 && riderView === 1 && (
        <VerificationQueues
          actions={actions}
          onReview={(id) =>
            router.push(
              `/partners/drivers/${encodeURIComponent(id)}/verification`,
            )
          }
        />
      )}
      {tab === 0 && riderView === 0 && invitationRows && (
        <Panel
          title="Pending rider invitations"
          sub="An invitation does not create an approved driver or send a real message"
        >
          <Table
            heads={["Name", "Contact", "Status", "Actions"]}
            rows={invitationRows.items.map((r) => [
              String(r.name),
              phoneOf(r),
              <Badge key="b">{label(r.status)}</Badge>,
              <TextButton
                key="v"
                onClick={() =>
                  actions.inspect(
                    String(r.name || "Invitation"),
                    `/admin/driver-invitations/${r.id}`,
                  )
                }
              >
                View{" "}
                <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </TextButton>,
            ])}
            empty="No pending invitations. Invite a rider to start onboarding."
          />
        </Panel>
      )}
    </>
  );
}
