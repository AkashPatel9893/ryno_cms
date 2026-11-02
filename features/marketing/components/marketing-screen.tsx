"use client";
import { ArrowUpRight } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import {
  api,
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
import { type ScreenProps, attempt } from "@/components/cms/screen-utils";
import {
  Badge,
  Button,
  Cell,
  LoadState,
  Panel,
  Stats,
  Table,
  Tabs,
  TextButton,
} from "@/components/cms/ui";

export function campaignDialog(actions: ScreenProps["actions"]) {
  actions.dialog({
    title: "Create campaign",
    fields: [
      { name: "title", label: "Campaign name", required: true },
      {
        name: "audience",
        label: "Audience",
        options: [
          { value: "CUSTOMER", label: "Customers" },
          { value: "DRIVER", label: "Riders" },
        ],
      },
      {
        name: "format",
        label: "Format",
        options: ["HOME_BANNER", "TESTIMONIAL", "POPUP", "INCENTIVE"].map(
          (value) => ({ value, label: label(value) }),
        ),
      },
      { name: "description", label: "Description", required: true },
      { name: "start_at", label: "Start date", type: "date", required: true },
      {
        name: "end_at",
        label: "End date (exclusive)",
        type: "date",
        required: true,
      },
    ],
    submitLabel: "Create draft",
    submit: async (form) => {
      await post("/admin/campaigns", {
        title: form.get("title"),
        audience: form.get("audience"),
        format: form.get("format"),
        description: form.get("description"),
        start_at: `${form.get("start_at")}T00:00:00+05:30`,
        end_at: `${form.get("end_at")}T00:00:00+05:30`,
      });
      actions.refresh();
      actions.notify("Campaign draft created. Publish it when ready.");
    },
  });
}
export function MarketingScreen({ period, revision, actions }: ScreenProps) {
  const [tab, setTab] = useState(0);
  const state = useApi<
    [
      Aggregate<{
        live_campaigns: number;
        impressions: number;
        coupon_redemptions: number;
        cashback_credited: string;
        incentives_credited: string;
      }>,
      Page<Row>,
      Row[],
      Page<Row>,
      Page<Row>,
    ]
  >(
    [
      `/admin/marketing/summary?${query(period)}`,
      "/admin/campaigns?limit=50",
      "/admin/coupons",
      "/admin/incentive-programs",
      "/admin/creative-assets",
    ],
    revision,
  );
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [response, campaigns, coupons, programs, assets] = state.data;
  const s = response.data;
  return (
    <>
      <Stats
        items={[
          {
            label: "Live campaigns",
            value: number(s.live_campaigns),
            note: "Current campaign states",
          },
          {
            label: "Impressions",
            value: number(s.impressions),
            note: "Campaign views",
          },
          {
            label: "Coupon redemptions",
            value: number(s.coupon_redemptions),
            note: "Applied discounts",
          },
          {
            label: "Rewards credited",
            value: rupees(
              Number(s.cashback_credited) + Number(s.incentives_credited),
            ),
            note: "Credits & incentives",
          },
        ]}
      />
      <Tabs
        items={[
          "Campaigns",
          "Customer coupons",
          "Rider incentives",
          "Creative library",
        ]}
        value={tab}
        onChange={setTab}
      />
      {tab === 0 && (
        <>
          <div className="grid marketing-grid">
            <div className="campaign-banner">
              <div>
                <small>CUSTOMER APP / OFFER PREVIEW</small>
                <h2>
                  Big plans.
                  <br />
                  Small delivery fees.
                </h2>
                <p>
                  {coupons[0]
                    ? `${String(coupons[0].title || coupons[0].description || "Offer")} · code ${String(coupons[0].code)}`
                    : "No coupon to preview yet"}
                </p>
              </div>
              <div className="delivery-art">
                <Image
                  src="/delivery-scooter.png"
                  width={800}
                  height={656}
                  alt="Orange delivery scooter carrying parcels"
                />
              </div>
              <div className="banner-bottom">
                <Badge>Campaign creative</Badge>
                <span>Bengaluru</span>
              </div>
            </div>
            <Panel
              title="Rider incentive preview"
              sub="Program drafts do not credit rewards"
            >
              <div className="spotlight">
                <small>DRAFT · NOT AN ACTIVE REWARD</small>
                <h2>
                  {String(programs.items[0]?.title || "No incentive programs")}
                </h2>
                <p>
                  {programs.items.length
                    ? `${rupees(programs.items[0].reward_amount)} proposed reward · requires a qualification and credit engine`
                    : "Create a program after the reward rules are implemented."}
                </p>
              </div>
              <p className="muted">
                The driver app receives no earned bonus from this CMS preview.
                Claims and wallet credits stay at zero.
              </p>
            </Panel>
          </div>
          <Panel
            title="Campaign schedule"
            sub={`${campaigns.total_count} campaigns · state is stored on the backend`}
            action={
              <Button primary onClick={() => campaignDialog(actions)}>
                Create campaign
              </Button>
            }
          >
            <Table
              heads={[
                "Campaign",
                "Format",
                "Audience",
                "Schedule",
                "Performance",
                "Status / action",
              ]}
              rows={campaigns.items.map((r) => [
                <Cell
                  key="c"
                  title={String(r.title)}
                  sub={String(r.description)}
                />,
                label(r.format),
                r.audience === "DRIVER" ? "Riders" : "Customers",
                r.start_at && r.end_at
                  ? `${String(r.start_at).slice(0, 10)} → ${String(r.end_at).slice(0, 10)}`
                  : "Not scheduled",
                `${number(r.impressions)} views`,
                <div className="row-actions" key="a">
                  <Badge orange={r.status === "LIVE"}>
                    {r.status === "LIVE" &&
                    r.start_at &&
                    Date.parse(String(r.start_at)) > Date.parse(response.as_of)
                      ? "Scheduled"
                      : r.status === "LIVE" &&
                          r.end_at &&
                          Date.parse(String(r.end_at)) <=
                            Date.parse(response.as_of)
                        ? "Ended"
                        : label(r.status)}
                  </Badge>
                  <TextButton
                    onClick={() =>
                      attempt(actions, async () => {
                        await post(
                          `/admin/campaigns/${r.id}/${r.status === "LIVE" ? "pause" : "publish"}`,
                          { reason: "CMS campaign state update" },
                        );
                        actions.refresh();
                        actions.notify(
                          r.status === "LIVE"
                            ? "Campaign paused."
                            : "Campaign published.",
                        );
                      })
                    }
                  >
                    {r.status === "LIVE" ? "Pause" : "Publish"}
                  </TextButton>
                </div>,
              ])}
            />
          </Panel>
        </>
      )}
      {tab === 1 && (
        <Panel
          title="Customer coupons"
          sub="FLAT and PERCENT fare discounts · cashback is a separate wallet feature"
        >
          <Table
            heads={[
              "Coupon / benefit",
              "Minimum fare",
              "Usage",
              "Status / action",
            ]}
            rows={coupons.map((r) => [
              <Cell
                key="c"
                title={`${r.code} · ${r.discount_type === "PERCENT" ? String(r.discount_value) + "% off" : rupees(r.discount_value) + " off"}`}
                sub={String(r.description)}
              />,
              rupees(r.min_fare),
              number(r.usage_count),
              <div className="row-actions" key="a">
                <Badge orange={Boolean(r.is_active)}>
                  {r.is_active ? "Enabled" : "Disabled"}
                </Badge>
                <TextButton
                  onClick={() =>
                    attempt(actions, async () => {
                      await api(`/admin/coupons/${r.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({
                          is_active: !r.is_active,
                          reason: "CMS coupon availability update",
                        }),
                      });
                      actions.refresh();
                      actions.notify("Coupon availability updated.");
                    })
                  }
                >
                  {r.is_active ? "Disable" : "Enable"}
                </TextButton>
              </div>,
            ])}
          />
        </Panel>
      )}
      {tab === 2 && (
        <Panel
          title="Rider incentive programs"
          sub="Draft definitions only · no claims or wallet credit engine"
        >
          <Table
            heads={["Program", "Proposed reward", "Claims", "Status"]}
            rows={programs.items.map((r) => [
              <Cell key="c" title={String(r.title)} sub={String(r.code)} />,
              rupees(r.reward_amount),
              number(r.claims_count),
              <Badge key="s">{label(r.status)}</Badge>,
            ])}
          />
        </Panel>
      )}
      {tab === 3 && (
        <Panel
          title="Creative library"
          sub="Only assets with a usable URL can be previewed"
        >
          <Table
            heads={["Asset", "Type", "Preview"]}
            rows={assets.items.map((r) => [
              String(r.name),
              String(r.content_type),
              r.url ? (
                <a
                  href={String(r.url)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-button"
                >
                  Open asset{" "}
                  <ArrowUpRight
                    size={14}
                    strokeWidth={1.8}
                    aria-hidden="true"
                  />
                </a>
              ) : (
                "Metadata only · no uploaded image"
              ),
            ])}
          />
        </Panel>
      )}
    </>
  );
}
