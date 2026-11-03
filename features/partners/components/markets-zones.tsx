"use client";
import { Plus, RefreshCw } from "lucide-react";
import { useState } from "react";
import { label, post, useApi, type Actions } from "@/lib/cms/client";
import {
  Badge,
  Button,
  Cell,
  LoadState,
  Panel,
  Table,
} from "@/components/cms/ui";

type Market = {
  id: string;
  code: string;
  name: string;
  country_code: string;
  currency: string;
  timezone: string;
  is_active: boolean;
};

type Zone = {
  id: string;
  name: string;
  zone_type: string;
  priority: number;
  is_active: boolean;
};

type MarketZonesResponse = {
  market_id: string;
  market_code: string;
  market_name: string;
  zones: Zone[];
};

export function MarketsZones({ actions }: { actions: Actions }) {
  const [selectedMarketId, setSelectedMarketId] = useState<string | null>(null);
  const marketsState = useApi<[Market[]]>(["/admin/markets"]);

  const markets = marketsState.data?.[0] || [];
  const activeMarket =
    markets.find((m) => m.id === selectedMarketId) || markets[0] || null;
  const activeMarketId = activeMarket?.id;

  const zonesState = useApi<[MarketZonesResponse]>(
    activeMarketId ? [`/admin/markets/${activeMarketId}/zones`] : [],
    Boolean(activeMarketId),
  );

  function createMarketDialog() {
    actions.dialog({
      title: "Add Operating Market",
      body: (
        <p className="muted">
          Define a new geographical market for service operations and fare
          rules.
        </p>
      ),
      fields: [
        {
          name: "code",
          label: "Market code (e.g. BLR, DEL, BOM)",
          required: true,
        },
        {
          name: "name",
          label: "Market name (e.g. Bengaluru, Delhi NCR)",
          required: true,
        },
        {
          name: "currency",
          label: "Currency",
          required: true,
          value: "INR",
        },
        {
          name: "timezone",
          label: "Timezone",
          required: true,
          value: "Asia/Kolkata",
        },
        {
          name: "country_code",
          label: "Country code",
          required: true,
          value: "IN",
        },
      ],
      submitLabel: "Create market",
      submit: async (form) => {
        const code = String(form.get("code") || "")
          .trim()
          .toUpperCase();
        const name = String(form.get("name") || "").trim();
        const currency = String(form.get("currency") || "INR")
          .trim()
          .toUpperCase();
        const timezone = String(form.get("timezone") || "Asia/Kolkata").trim();
        const country = String(form.get("country_code") || "IN")
          .trim()
          .toUpperCase();

        if (code.length < 2) throw new Error("Enter a valid market code.");
        if (!name) throw new Error("Market name is required.");

        await post("/admin/markets", {
          code,
          name,
          currency,
          timezone,
          country_code: country,
        });
        actions.refresh();
        actions.notify(`Market ${name} (${code}) created.`);
      },
    });
  }

  function createZoneDialog(market: Market) {
    actions.dialog({
      title: `Add Service Zone in ${market.name}`,
      body: (
        <p className="muted">
          Define a service zone (e.g. Core City, Airport, Outer Suburb) within{" "}
          {market.name}.
        </p>
      ),
      fields: [
        {
          name: "name",
          label: "Zone name (e.g. Core Bengaluru, Whitefield, Airport)",
          required: true,
        },
        {
          name: "zone_type",
          label: "Zone type",
          required: true,
          options: [
            { value: "CORE", label: "Core City" },
            { value: "METRO", label: "Metro Area" },
            { value: "SUBURB", label: "Suburb" },
            { value: "OUTSTATION", label: "Outstation" },
            { value: "RESTRICTED", label: "Restricted Zone" },
          ],
        },
        {
          name: "priority",
          label: "Priority level (higher numbers take precedence)",
          type: "number",
          required: true,
          value: "100",
        },
      ],
      submitLabel: "Add zone",
      submit: async (form) => {
        const name = String(form.get("name") || "").trim();
        const zoneType = String(form.get("zone_type") || "CORE");
        const priority = Number(form.get("priority") || 100);

        if (!name) throw new Error("Zone name is required.");

        await post(`/admin/markets/${market.id}/zones`, {
          name,
          zone_type: zoneType,
          priority: isNaN(priority) ? 100 : priority,
          is_active: true,
        });
        actions.refresh();
        actions.notify(`Service zone "${name}" created for ${market.name}.`);
      },
    });
  }

  if (!marketsState.data) {
    return <LoadState error={marketsState.error} retry={actions.refresh} />;
  }

  const zones = zonesState.data?.[0]?.zones || [];

  return (
    <>
      <Panel
        title="Operating Markets"
        sub="Geographical logistics areas configured on the backend"
        action={
          <Button primary onClick={createMarketDialog}>
            <Plus size={14} className="inline mr-1" /> Add market
          </Button>
        }
      >
        <Table
          heads={["Market", "Code", "Currency & TZ", "Status", "Action"]}
          rows={markets.map((m) => [
            <Cell key="m" title={m.name} sub={`Country: ${m.country_code}`} />,
            m.code,
            `${m.currency} · ${m.timezone}`,
            <Badge key="s" orange={m.is_active}>
              {m.is_active ? "Active" : "Inactive"}
            </Badge>,
            <Button
              key="sel"
              primary={activeMarket?.id === m.id}
              onClick={() => setSelectedMarketId(m.id)}
            >
              {activeMarket?.id === m.id ? "Viewing zones" : "Select market"}
            </Button>,
          ])}
          empty="No operating markets configured. Click 'Add market' to define one."
        />
      </Panel>

      {activeMarket && (
        <Panel
          title={`Service Zones · ${activeMarket.name} (${activeMarket.code})`}
          sub="Serviceability boundaries and pricing zones within this market"
          action={
            <div className="flex items-center gap-2">
              <Button onClick={actions.refresh}>
                <RefreshCw size={14} className="inline mr-1" /> Refresh
              </Button>
              <Button primary onClick={() => createZoneDialog(activeMarket)}>
                <Plus size={14} className="inline mr-1" /> Add zone
              </Button>
            </div>
          }
        >
          {zonesState.loading ? (
            <p className="muted p-4">Loading zones for {activeMarket.name}…</p>
          ) : (
            <Table
              heads={["Zone Name", "Zone Type", "Priority", "Status"]}
              rows={zones.map((z) => [
                z.name,
                label(z.zone_type),
                String(z.priority),
                <Badge key="s" orange={z.is_active}>
                  {z.is_active ? "Active" : "Inactive"}
                </Badge>,
              ])}
              empty={`No service zones configured for ${activeMarket.name} yet. Click 'Add zone' to create one.`}
            />
          )}
        </Panel>
      )}
    </>
  );
}
