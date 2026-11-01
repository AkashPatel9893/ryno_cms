"use client";

import { post, useApi, type Actions } from "@/lib/cms/client";
import { Badge, Button, Cell, LoadState, Panel, Table } from "./ui";

type VehicleType = { id: string; code: string; display_name: string; category: string; max_payload_kg: string | number; image_url: string | null; is_active: boolean; requires_commercial_permit: boolean; requires_fitness_certificate: boolean };

export function VehicleCatalog({ revision, actions }: { revision: number; actions: Actions }) {
  const state = useApi<[VehicleType[]]>(["/vehicle-types"], revision);
  function createVehicleType() {
    actions.dialog({
      title: "Add vehicle type",
      body: <p>This creates an active vehicle type visible in the apps. Configure its pricing separately before customers book it. Its image uses the backend fallback until an image is configured.</p>,
      fields: [
        { name: "display_name", label: "Display name", required: true },
        { name: "code", label: "Unique code (uppercase letters, numbers or underscores)", required: true },
        { name: "category", label: "Category", options: ["TWO_WHEELER", "THREE_WHEELER", "MINI_TRUCK", "PICKUP_TRUCK", "LARGE_TRUCK"].map((value) => ({ value, label: value.replaceAll("_", " ") })) },
        { name: "max_payload_kg", label: "Maximum payload (kg)", required: true },
        { name: "requires_commercial_permit", label: "Commercial permit required?", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
        { name: "requires_fitness_certificate", label: "Fitness certificate required?", options: [{ value: "false", label: "No" }, { value: "true", label: "Yes" }] },
      ],
      submitLabel: "Create vehicle type",
      submit: async (form) => {
        const code = String(form.get("code") || "").trim().toUpperCase();
        const displayName = String(form.get("display_name") || "").trim();
        const capacity = Number(form.get("max_payload_kg"));
        if (!/^[A-Z0-9_]{2,32}$/.test(code)) throw new Error("Use 2–32 letters, numbers or underscores for the code.");
        if (!displayName || displayName.length > 100) throw new Error("Enter a display name of up to 100 characters.");
        if (!Number.isFinite(capacity) || capacity <= 0) throw new Error("Enter a payload greater than zero.");
        await post("/admin/vehicle-types", { code, display_name: displayName, category: form.get("category"), max_payload_kg: capacity, requires_commercial_permit: form.get("requires_commercial_permit") === "true", requires_fitness_certificate: form.get("requires_fitness_certificate") === "true", is_active: true });
        actions.refresh();
        actions.notify("Vehicle type created. Configure pricing before accepting bookings.");
      },
    });
  }
  if (!state.data) return <LoadState error={state.error} retry={actions.refresh} />;
  return <Panel title="Vehicle types" sub="Active vehicle types shown in the customer and driver apps. Creating a type requires pricing-management access." action={<Button primary onClick={createVehicleType}>Add vehicle type</Button>}>
    <p className="muted">Vehicle images are supplied by the backend. Image upload and assignment are not available yet.</p>
    <Table heads={["Vehicle type", "Category", "Maximum payload", "Image", "Status"]} rows={state.data[0].map((vehicle) => [<Cell key={vehicle.id} title={vehicle.display_name} sub={vehicle.code} />, vehicle.category.replaceAll("_", " "), `${vehicle.max_payload_kg} kg`, vehicle.image_url ? <a key="image" className="text-button" href={vehicle.image_url} target="_blank" rel="noreferrer">View image ↗</a> : "No image", <Badge key="status" orange={vehicle.is_active}>{vehicle.is_active ? "Active" : "Inactive"}</Badge>])} empty="No active vehicle types." />
  </Panel>;
}
