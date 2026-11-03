"use client";
import { ArrowRight } from "lucide-react";

import { dateTime, label, post, useApi, type Actions } from "@/lib/cms/client";
import {
  Badge,
  Button,
  LoadState,
  Panel,
  Table,
  TextButton,
} from "@/components/cms/ui";

type Verification = {
  verification_id: string;
  subject: "DRIVER" | "VEHICLE";
  subject_id: string;
  verification_type: string;
  status: string;
  requested_at: string;
};
type PendingDriver = {
  driver_id: string;
  driver_number: string;
  name: string;
  onboarding_status: string;
  submitted_at: string | null;
};
type Document = {
  id: string;
  document_type: string;
  identifier_masked: string | null;
  expiry_date: string | null;
  verification_status: string;
  rejection_reason: string | null;
  has_front?: boolean;
  has_back?: boolean;
};
type Bank = {
  id: string;
  holder_name: string;
  account_number_last4: string;
  verification_status: string;
};
type Vehicle = {
  id: string;
  registration_number: string;
  make: string;
  model: string;
  status: string;
  assignment_status: string;
};
type DriverReview = {
  driver_number: string;
  onboarding_status: string;
  account_status: string;
  documents: Document[];
  vehicle_documents: Document[];
  bank_accounts: Bank[];
  vehicles: Vehicle[];
  eligibility: { online_allowed: boolean; reasons: string[] };
};

function reviewDecision(
  actions: Actions,
  item: Verification,
  decision: "approve" | "reject" | "request-resubmission",
) {
  const title =
    decision === "approve"
      ? "Approve verification"
      : decision === "reject"
        ? "Reject verification"
        : "Request resubmission";
  actions.dialog({
    title,
    body: (
      <p>
        Decision for {label(item.verification_type)} · {label(item.subject)}{" "}
        {item.subject_id}. Document images are not available in this panel;
        review the evidence separately before deciding.
      </p>
    ),
    fields: [
      {
        name: "reason_code",
        label: "Reason code (at least 2 characters)",
        required: true,
      },
      { name: "note", label: "Review note" },
      { name: "expiry_date", label: "Expiry date (optional)", type: "date" },
    ],
    submitLabel: title,
    submit: async (form) => {
      const reason = String(form.get("reason_code") || "").trim();
      if (reason.length < 2 || reason.length > 64)
        throw new Error("Enter a reason code of 2 to 64 characters.");
      const note = String(form.get("note") || "").trim();
      const expiry = String(form.get("expiry_date") || "");
      await post(`/admin/verifications/${item.verification_id}/${decision}`, {
        reason_code: reason,
        ...(note ? { note } : {}),
        ...(expiry ? { expiry_date: expiry } : {}),
      });
      actions.refresh();
      actions.notify("Verification decision saved.");
    },
  });
}

function onboardingDecision(
  actions: Actions,
  driverId: string,
  driverName: string,
  decision: "approve" | "reject",
) {
  const title =
    decision === "approve"
      ? "Approve driver onboarding"
      : "Reject driver onboarding";
  actions.dialog({
    title,
    body: (
      <p>
        {title} for {driverName}? The backend checks eligibility before
        approval.
      </p>
    ),
    fields: [
      {
        name: "reason",
        label: "Reason (at least 3 characters)",
        required: true,
      },
    ],
    submitLabel: title,
    submit: async (form) => {
      const reason = String(form.get("reason") || "").trim();
      if (reason.length < 3)
        throw new Error("Enter a reason of at least 3 characters.");
      await post(`/admin/onboarding/${driverId}/${decision}`, { reason });
      actions.refresh();
      actions.notify(
        decision === "approve"
          ? "Driver onboarding approved."
          : "Driver onboarding rejected.",
      );
    },
  });
}

function suspendDriverDialog(
  actions: Actions,
  driverId: string,
  driverName: string,
) {
  actions.dialog({
    title: `Suspend Driver ${driverName}`,
    body: (
      <p className="muted">
        Suspending will force the driver offline and block new order offers
        until reinstated.
      </p>
    ),
    fields: [
      {
        name: "suspension_type",
        label: "Suspension type",
        required: true,
        options: [
          { value: "COMPLIANCE", label: "Compliance (document/KYC issue)" },
          { value: "TEMPORARY", label: "Temporary suspension" },
          { value: "INDEFINITE", label: "Indefinite suspension" },
        ],
      },
      {
        name: "reason",
        label: "Reason for suspension (min 3 characters)",
        required: true,
      },
    ],
    submitLabel: "Suspend driver",
    submit: async (form) => {
      const reason = String(form.get("reason") || "").trim();
      const suspensionType = String(
        form.get("suspension_type") || "COMPLIANCE",
      );
      if (reason.length < 3)
        throw new Error("Enter a reason of at least 3 characters.");
      await post(`/admin/drivers/${driverId}/suspend`, {
        reason,
        suspension_type: suspensionType,
      });
      actions.refresh();
      actions.notify(`Driver ${driverName} suspended.`);
    },
  });
}

function reinstateDriverDialog(
  actions: Actions,
  driverId: string,
  driverName: string,
) {
  actions.dialog({
    title: `Reinstate Driver ${driverName}`,
    body: (
      <p className="muted">
        Reinstating restores the driver account to active status and allows
        going online.
      </p>
    ),
    fields: [
      {
        name: "reason",
        label: "Reason for reinstatement (min 3 characters)",
        required: true,
      },
    ],
    submitLabel: "Reinstate driver",
    submit: async (form) => {
      const reason = String(form.get("reason") || "").trim();
      if (reason.length < 3)
        throw new Error("Enter a reason of at least 3 characters.");
      await post(`/admin/drivers/${driverId}/reinstate`, { reason });
      actions.refresh();
      actions.notify(`Driver ${driverName} reinstated.`);
    },
  });
}

function approveAssignmentDialog(actions: Actions, assignmentId: string) {
  actions.dialog({
    title: "Approve Vehicle Assignment",
    body: <p className="muted">Confirm vehicle assignment to this driver.</p>,
    fields: [
      {
        name: "reason",
        label: "Approval reason",
        required: true,
        value: "Vehicle assignment verified by CMS admin",
      },
    ],
    submitLabel: "Approve assignment",
    submit: async (form) => {
      const reason = String(form.get("reason") || "").trim();
      await post(`/admin/assignments/${assignmentId}/approve`, {
        reason: reason || "Approved by CMS admin",
      });
      actions.refresh();
      actions.notify("Vehicle assignment approved.");
    },
  });
}

export function DriverReviewPanel({
  driverId,
  driverName,
  actions,
  onClose,
}: {
  driverId: string;
  driverName: string;
  actions: Actions;
  onClose: () => void;
}) {
  const state = useApi<[DriverReview, Verification[]]>([
    `/admin/drivers/${encodeURIComponent(driverId)}/verification`,
    "/admin/verifications/pending",
  ]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [review, queue] = state.data;
  const vehicleIds = new Set(review.vehicles.map((vehicle) => vehicle.id));
  const pending = queue.filter((item) =>
    item.subject === "DRIVER"
      ? item.subject_id === driverId
      : vehicleIds.has(item.subject_id),
  );
  const submitted = ["SUBMITTED", "UNDER_REVIEW"].includes(
    review.onboarding_status,
  );
  const documents = [...review.documents, ...review.vehicle_documents];
  return (
    <Panel
      title={`Verification · ${driverName}`}
      sub={`${review.driver_number} · ${label(review.onboarding_status)} · ${label(review.account_status)}`}
      action={
        <div className="flex items-center gap-2">
          {review.account_status === "ACTIVE" ? (
            <Button
              onClick={() => suspendDriverDialog(actions, driverId, driverName)}
            >
              Suspend driver
            </Button>
          ) : review.account_status === "SUSPENDED" ? (
            <Button
              primary
              onClick={() =>
                reinstateDriverDialog(actions, driverId, driverName)
              }
            >
              Reinstate driver
            </Button>
          ) : null}
          <Button onClick={onClose}>Close</Button>
        </div>
      }
    >
      <p className="muted">
        Document images cannot currently be viewed in this panel. Review the
        evidence separately before recording a decision.
      </p>
      <h3>Documents</h3>
      <Table
        heads={["Document", "Reference", "Expiry", "Status"]}
        rows={documents.map((doc) => [
          label(doc.document_type),
          doc.identifier_masked || "—",
          doc.expiry_date || "—",
          <Badge key={doc.id}>{label(doc.verification_status)}</Badge>,
        ])}
        empty="No documents submitted."
      />
      <h3>Bank accounts</h3>
      <Table
        heads={["Holder", "Account", "Status"]}
        rows={review.bank_accounts.map((bank) => [
          bank.holder_name,
          `•• ${bank.account_number_last4}`,
          <Badge key={bank.id}>{label(bank.verification_status)}</Badge>,
        ])}
        empty="No bank account submitted."
      />
      <h3>Vehicles</h3>
      <Table
        heads={[
          "Vehicle",
          "Registration",
          "Vehicle status",
          "Assignment",
          "Action",
        ]}
        rows={review.vehicles.map((vehicle) => [
          `${vehicle.make} ${vehicle.model}`,
          vehicle.registration_number,
          label(vehicle.status),
          label(vehicle.assignment_status),
          vehicle.assignment_status === "PENDING" ? (
            <TextButton
              key="appr"
              onClick={() => approveAssignmentDialog(actions, vehicle.id)}
            >
              Approve assignment
            </TextButton>
          ) : (
            "—"
          ),
        ])}
        empty="No vehicle registered."
      />
      <h3>Pending verification decisions</h3>
      <Table
        heads={["Type", "Subject", "Requested", "Decision"]}
        rows={pending.map((item) => [
          label(item.verification_type),
          label(item.subject),
          dateTime(item.requested_at),
          <div className="row-actions" key={item.verification_id}>
            <TextButton
              onClick={() => reviewDecision(actions, item, "approve")}
            >
              Approve
            </TextButton>
            <TextButton onClick={() => reviewDecision(actions, item, "reject")}>
              Reject
            </TextButton>
            <TextButton
              onClick={() =>
                reviewDecision(actions, item, "request-resubmission")
              }
            >
              Request resubmission
            </TextButton>
          </div>,
        ])}
        empty="No pending manual verifications for this driver or their vehicles."
      />
      <h3>Onboarding</h3>
      <p className="muted">
        {submitted
          ? "This application is awaiting review."
          : `This application is ${label(review.onboarding_status)}. The driver must submit it before an onboarding decision can be made.`}
      </p>
      {review.eligibility.reasons.length > 0 && (
        <p className="muted">
          Current eligibility reasons:{" "}
          {review.eligibility.reasons.map(label).join(", ")}. The backend will
          check eligibility again when approving.
        </p>
      )}
      <div className="actions">
        <Button
          primary
          disabled={!submitted}
          onClick={() =>
            onboardingDecision(actions, driverId, driverName, "approve")
          }
        >
          Approve onboarding
        </Button>
        <Button
          disabled={!submitted}
          onClick={() =>
            onboardingDecision(actions, driverId, driverName, "reject")
          }
        >
          Reject onboarding
        </Button>
      </div>
    </Panel>
  );
}

export function VerificationQueues({
  actions,
  onReview,
}: {
  actions: Actions;
  onReview: (id: string, name: string) => void;
}) {
  const state = useApi<[PendingDriver[], Verification[]]>([
    "/admin/onboarding/pending",
    "/admin/verifications/pending",
  ]);
  if (!state.data)
    return <LoadState error={state.error} retry={actions.refresh} />;
  const [drivers, verifications] = state.data;
  return (
    <>
      <Panel
        title="Driver applications awaiting review"
        sub="Submitted applications; select a driver to inspect their compliance status."
      >
        <Table
          heads={["Driver", "Status", "Submitted", "Action"]}
          rows={drivers.map((driver) => [
            `${driver.name} · ${driver.driver_number}`,
            label(driver.onboarding_status),
            driver.submitted_at ? dateTime(driver.submitted_at) : "—",
            <TextButton
              key={driver.driver_id}
              onClick={() => onReview(driver.driver_id, driver.name)}
            >
              Review{" "}
              <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
            </TextButton>,
          ])}
          empty="No submitted applications awaiting review."
        />
      </Panel>
      <Panel
        title="Manual verification queue"
        sub="Driver and vehicle checks awaiting a decision. Driver checks can be opened from here."
      >
        <Table
          heads={["Type", "Subject", "Reference", "Requested", "Action"]}
          rows={verifications.map((item) => [
            label(item.verification_type),
            label(item.subject),
            <span key={item.subject_id} title={item.subject_id}>
              {item.subject_id.slice(0, 8)}…
            </span>,
            dateTime(item.requested_at),
            item.subject === "DRIVER" ? (
              <TextButton
                key={item.verification_id}
                onClick={() =>
                  onReview(
                    item.subject_id,
                    `Driver ${item.subject_id.slice(0, 8)}`,
                  )
                }
              >
                Review{" "}
                <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
              </TextButton>
            ) : (
              <div className="row-actions" key={item.verification_id}>
                <TextButton
                  onClick={() => reviewDecision(actions, item, "approve")}
                >
                  Approve
                </TextButton>
                <TextButton
                  onClick={() => reviewDecision(actions, item, "reject")}
                >
                  Reject
                </TextButton>
                <TextButton
                  onClick={() =>
                    reviewDecision(actions, item, "request-resubmission")
                  }
                >
                  Request resubmission
                </TextButton>
              </div>
            ),
          ])}
          empty="No verifications awaiting manual review."
        />
      </Panel>
    </>
  );
}
