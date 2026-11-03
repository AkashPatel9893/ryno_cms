"use client";
import { ArrowUpRight } from "lucide-react";
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

export function couponDialog(actions: ScreenProps["actions"]) {
  actions.dialog({
    title: "Create Discount Coupon",
    body: (
      <p className="muted">
        Define a customer coupon discount code for booking fare calculation.
      </p>
    ),
    fields: [
      {
        name: "code",
        label: "Coupon code (e.g. SAVE20, DIWALI50)",
        required: true,
      },
      { name: "title", label: "Coupon title", required: true },
      {
        name: "description",
        label: "Description (e.g. 20% off up to ₹100)",
        required: true,
      },
      {
        name: "discount_type",
        label: "Discount type",
        required: true,
        options: [
          { value: "PERCENT", label: "Percentage off (%)" },
          { value: "FLAT", label: "Flat discount (₹)" },
        ],
      },
      {
        name: "discount_value",
        label: "Discount value",
        type: "number",
        required: true,
      },
      { name: "min_fare", label: "Minimum fare (₹, optional)", type: "number" },
      {
        name: "max_discount",
        label: "Maximum discount (₹, optional for %)",
        type: "number",
      },
      { name: "valid_from", label: "Valid from (date)", type: "date" },
      { name: "valid_until", label: "Valid until (date)", type: "date" },
    ],
    submitLabel: "Create coupon",
    submit: async (form) => {
      const code = String(form.get("code") || "")
        .trim()
        .toUpperCase();
      const title = String(form.get("title") || "").trim();
      const description = String(form.get("description") || "").trim();
      const discountType = String(form.get("discount_type") || "PERCENT");
      const discountValue = Number(form.get("discount_value"));
      const minFare = form.get("min_fare")
        ? Number(form.get("min_fare"))
        : undefined;
      const maxDiscount = form.get("max_discount")
        ? Number(form.get("max_discount"))
        : undefined;
      const validFrom = form.get("valid_from")
        ? `${form.get("valid_from")}T00:00:00+05:30`
        : undefined;
      const validUntil = form.get("valid_until")
        ? `${form.get("valid_until")}T23:59:59+05:30`
        : undefined;

      if (!code || code.length < 3)
        throw new Error("Coupon code must be at least 3 characters.");
      if (isNaN(discountValue) || discountValue <= 0)
        throw new Error("Enter a positive discount value.");

      await post("/admin/coupons", {
        code,
        title,
        description,
        discount_type: discountType,
        discount_value: discountValue,
        min_fare: minFare,
        max_discount: maxDiscount,
        valid_from: validFrom,
        valid_until: validUntil,
      });
      actions.refresh();
      actions.notify(`Coupon ${code} created.`);
    },
  });
}

export function uploadCreativeAsset(actions: ScreenProps["actions"]) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "image/png,image/jpeg,image/webp";
  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      actions.notify("Choose an image file up to 5 MB.");
      return;
    }
    const form = new FormData();
    form.set("file", file);
    form.set("name", file.name.replace(/\.[^/.]+$/, ""));
    try {
      await api("/admin/creative-assets", {
        method: "POST",
        body: form,
      });
      actions.refresh();
      actions.notify("Creative asset uploaded.");
    } catch (err) {
      actions.notify(
        err instanceof Error ? err.message : "Failed to upload asset.",
      );
    }
  };
  fileInput.click();
}

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
export function MarketingScreen({ period, actions }: ScreenProps) {
  const [tab, setTab] = useState(0);
  const state = useApi<
    [
      Aggregate<{
        live_campaigns: number;
        impressions: number;
        coupon_redemptions: number;
      }>,
      Page<Row>,
      Row[],
      Page<Row>,
    ]
  >([
    `/admin/marketing/summary?${query(period)}`,
    "/admin/campaigns?limit=50",
    "/admin/coupons",
    "/admin/creative-assets",
  ]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [response, campaigns, coupons, assets] = state.data;
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
        ]}
      />
      <Tabs
        items={["Campaigns", "Customer coupons", "Creative library"]}
        value={tab}
        onChange={setTab}
      />
      {tab === 0 && (
        <>
          <Panel
            title="Campaign schedule"
            sub={`${campaigns.total_count} campaigns`}
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
          action={
            <Button primary onClick={() => couponDialog(actions)}>
              Create coupon
            </Button>
          }
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
                    actions.inspect(
                      String(r.code || "Coupon"),
                      `/admin/coupons/${r.id}`,
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
          title="Creative library"
          sub="Only assets with a usable URL can be previewed"
          action={
            <Button primary onClick={() => uploadCreativeAsset(actions)}>
              Upload asset
            </Button>
          }
        >
          <Table
            heads={["Asset", "Type", "Preview", "Actions"]}
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
              <TextButton
                key="v"
                onClick={() =>
                  actions.inspect(
                    String(r.name || "Asset"),
                    `/admin/creative-assets/${r.id}`,
                  )
                }
              >
                Inspect{" "}
                <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </TextButton>,
            ])}
          />
        </Panel>
      )}
    </>
  );
}
