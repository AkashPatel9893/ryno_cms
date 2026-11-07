"use client";
import { ArrowUpRight } from "lucide-react";

import { api, post, useApi, type Actions } from "@/lib/cms/client";
import {
  Badge,
  Button,
  Cell,
  LoadState,
  Panel,
  Table,
  TextButton,
} from "@/components/cms/ui";

type VehicleType = {
  id: string;
  code: string;
  display_name: string;
  category: string;
  max_payload_kg: string | number;
  image_url: string | null;
  is_active: boolean;
  requires_commercial_permit: boolean;
  requires_fitness_certificate: boolean;
  cargo_length_cm: number | null;
  cargo_width_cm: number | null;
  cargo_height_cm: number | null;
  sort_order: number;
  /** False means activating the type is refused until pricing is set up. */
  has_active_pricing: boolean;
};

function cargoSize(vehicle: VehicleType) {
  const { cargo_length_cm: l, cargo_width_cm: w, cargo_height_cm: h } = vehicle;
  return l && w && h ? `${l} × ${w} × ${h} cm` : "Not set";
}

export function VehicleCatalog({ actions }: { actions: Actions }) {
  const state = useApi<[VehicleType[]]>(["/admin/vehicle-types"]);
  function editVehicleType(vehicle: VehicleType) {
    const dimension = (value: number | null) =>
      value == null ? "" : String(value);
    actions.dialog({
      title: `Edit ${vehicle.display_name}`,
      body: (
        <p>
          Changes show in the customer and driver apps straight away. The code,
          category and permit rules cannot be changed here.
        </p>
      ),
      fields: [
        {
          name: "display_name",
          label: "Display name",
          required: true,
          value: vehicle.display_name,
        },
        {
          name: "max_payload_kg",
          label: "Maximum payload (kg)",
          required: true,
          type: "number",
          value: String(Number(vehicle.max_payload_kg)),
        },
        {
          name: "cargo_length_cm",
          label: "Cargo length (cm)",
          type: "number",
          value: dimension(vehicle.cargo_length_cm),
        },
        {
          name: "cargo_width_cm",
          label: "Cargo width (cm)",
          type: "number",
          value: dimension(vehicle.cargo_width_cm),
        },
        {
          name: "cargo_height_cm",
          label: "Cargo height (cm)",
          type: "number",
          value: dimension(vehicle.cargo_height_cm),
        },
        {
          name: "sort_order",
          label: "Sort order (lowest shows first)",
          required: true,
          type: "number",
          value: String(vehicle.sort_order),
        },
      ],
      submitLabel: "Save changes",
      submit: async (form) => {
        const displayName = String(form.get("display_name") || "").trim();
        const payload = Number(form.get("max_payload_kg"));
        const sortOrder = Number(form.get("sort_order"));
        if (!displayName || displayName.length > 100)
          throw new Error("Enter a display name of up to 100 characters.");
        if (!Number.isFinite(payload) || payload <= 0)
          throw new Error("Enter a payload greater than zero.");
        if (!Number.isInteger(sortOrder) || sortOrder < 0)
          throw new Error("Enter a whole sort order of zero or more.");
        const size = (name: string) => {
          const raw = String(form.get(name) || "").trim();
          if (!raw) return null;
          const value = Number(raw);
          if (!Number.isInteger(value) || value <= 0)
            throw new Error(
              "Cargo sizes must be whole centimetres above zero.",
            );
          return value;
        };
        await api(`/admin/vehicle-types/${vehicle.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            display_name: displayName,
            max_payload_kg: payload,
            cargo_length_cm: size("cargo_length_cm"),
            cargo_width_cm: size("cargo_width_cm"),
            cargo_height_cm: size("cargo_height_cm"),
            sort_order: sortOrder,
          }),
        });
        actions.refresh();
        actions.notify(`${displayName} updated.`);
      },
    });
  }

  function toggleVehicleType(vehicle: VehicleType) {
    const activating = !vehicle.is_active;
    actions.dialog({
      title: `${activating ? "Activate" : "Deactivate"} ${vehicle.display_name}`,
      body: (
        <p>
          {activating
            ? "Customers will see this vehicle type and drivers can be matched to it."
            : "Customers will no longer see this vehicle type. Existing bookings are not affected."}
          {activating && !vehicle.has_active_pricing
            ? " This type has no active pricing, so the backend will refuse until pricing is configured."
            : ""}
        </p>
      ),
      submitLabel: activating ? "Activate" : "Deactivate",
      submit: async () => {
        await post(
          `/admin/vehicle-types/${vehicle.id}/${activating ? "activate" : "deactivate"}`,
        );
        actions.refresh();
        actions.notify(
          `${vehicle.display_name} ${activating ? "activated" : "deactivated"}.`,
        );
      },
    });
  }

  function createVehicleType() {
    actions.dialog({
      title: "Add vehicle type",
      body: (
        <p>
          This creates an active vehicle type visible in the apps. Configure its
          pricing separately before customers book it. Its image uses the
          backend fallback until an image is configured.
        </p>
      ),
      fields: [
        { name: "display_name", label: "Display name", required: true },
        {
          name: "code",
          label: "Unique code (uppercase letters, numbers or underscores)",
          required: true,
        },
        {
          name: "category",
          label: "Category",
          options: [
            "TWO_WHEELER",
            "THREE_WHEELER",
            "MINI_TRUCK",
            "PICKUP_TRUCK",
            "LARGE_TRUCK",
          ].map((value) => ({ value, label: value.replaceAll("_", " ") })),
        },
        {
          name: "max_payload_kg",
          label: "Maximum payload (kg)",
          required: true,
        },
        {
          name: "requires_commercial_permit",
          label: "Commercial permit required?",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
        {
          name: "requires_fitness_certificate",
          label: "Fitness certificate required?",
          options: [
            { value: "false", label: "No" },
            { value: "true", label: "Yes" },
          ],
        },
      ],
      submitLabel: "Create vehicle type",
      submit: async (form) => {
        const code = String(form.get("code") || "")
          .trim()
          .toUpperCase();
        const displayName = String(form.get("display_name") || "").trim();
        const capacity = Number(form.get("max_payload_kg"));
        if (!/^[A-Z0-9_]{2,32}$/.test(code))
          throw new Error(
            "Use 2–32 letters, numbers or underscores for the code.",
          );
        if (!displayName || displayName.length > 100)
          throw new Error("Enter a display name of up to 100 characters.");
        if (!Number.isFinite(capacity) || capacity <= 0)
          throw new Error("Enter a payload greater than zero.");
        await post("/admin/vehicle-types", {
          code,
          display_name: displayName,
          category: form.get("category"),
          max_payload_kg: capacity,
          requires_commercial_permit:
            form.get("requires_commercial_permit") === "true",
          requires_fitness_certificate:
            form.get("requires_fitness_certificate") === "true",
          is_active: true,
        });
        actions.refresh();
        actions.notify(
          "Vehicle type created. Configure pricing before accepting bookings.",
        );
      },
    });
  }
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  return (
    <Panel
      title="Vehicle types"
      sub="Every vehicle type, including inactive ones. Editing and activating need pricing-management access."
      action={
        <Button primary onClick={createVehicleType}>
          Add vehicle type
        </Button>
      }
    >
      <p className="muted">
        Vehicle images are supplied by the backend. Image upload and assignment
        are not available yet.
      </p>
      <Table
        heads={[
          "Vehicle type",
          "Category",
          "Maximum payload",
          "Cargo size",
          "Image",
          "Status",
          "Actions",
        ]}
        rows={state.data[0].map((vehicle) => [
          <Cell
            key={vehicle.id}
            title={vehicle.display_name}
            sub={vehicle.code}
          />,
          vehicle.category.replaceAll("_", " "),
          `${Number(vehicle.max_payload_kg)} kg`,
          cargoSize(vehicle),
          vehicle.image_url ? (
            <a
              key="image"
              className="text-button"
              href={vehicle.image_url}
              target="_blank"
              rel="noreferrer"
            >
              View image{" "}
              <ArrowUpRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </a>
          ) : (
            "No image"
          ),
          <span key="status">
            <Badge orange={vehicle.is_active}>
              {vehicle.is_active ? "Active" : "Inactive"}
            </Badge>
            {!vehicle.has_active_pricing ? (
              <small className="muted"> No active pricing</small>
            ) : null}
          </span>,
          <div key="actions" className="row-actions">
            <TextButton onClick={() => editVehicleType(vehicle)}>
              Edit
            </TextButton>
            <TextButton onClick={() => toggleVehicleType(vehicle)}>
              {vehicle.is_active ? "Deactivate" : "Activate"}
            </TextButton>
          </div>,
        ])}
        empty="No vehicle types."
      />
    </Panel>
  );
}
