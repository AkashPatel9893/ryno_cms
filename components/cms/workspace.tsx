"use client";

import { useQueryClient } from "@tanstack/react-query";
import { Check, Menu, X } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import {
  api,
  clearAdminSession,
  ensureAdminToken,
  dateTime,
  useApi,
  type Actions,
  type Dialog,
  type Page,
  type Row,
} from "@/lib/cms/client";
import { DashboardScreen } from "@/features/dashboard/components/dashboard-screen";
import { OrdersScreen } from "@/features/orders/components/orders-screen";
import { PartnersScreen } from "@/features/partners/components/partners-screen";
import { ReportsScreen } from "@/features/reports/components/reports-screen";
import { AnalyticsScreen } from "@/features/analytics/components/analytics-screen";
import { MarketingScreen } from "@/features/marketing/components/marketing-screen";
import { DataScreen } from "@/features/data/components/data-screen";
import { PaymentsScreen } from "@/features/payments/components/payments-screen";
import { PeriodControl } from "@/components/cms/period-control";
import { AccountMenu } from "@/components/cms/account-menu";
import { AlertsPopover } from "@/components/cms/alerts-popover";
import { BackendHealth } from "@/components/cms/backend-health";
import { Modal } from "@/components/cms/modal";
import { LoginGate } from "@/features/auth/components/login-gate";
import { Sidebar } from "@/components/cms/sidebar";
import { sections, descriptions } from "@/components/cms/navigation";
import { reportingPeriods } from "@/lib/cms/reporting-periods";
import { useAppDispatch, useAppSelector } from "@/lib/store/hooks";
import {
  initializeReportingPeriod,
  setMobileNavigationOpen,
  setReportingPeriod,
} from "@/lib/store/workspace-slice";
import { setSignedIn } from "@/lib/store/session-slice";
import { RecordDetail } from "@/components/cms/ui";
import { Spinner } from "@/components/ui/spinner";

export default function Workspace({
  initialSection = "dashboard",
}: {
  initialSection?: string;
}) {
  const section =
    sections.find((s) => s.toLowerCase() === initialSection) || "Dashboard";
  const dispatch = useAppDispatch();
  const queryClient = useQueryClient();
  const { mobileNavigationOpen: mobile, period } = useAppSelector(
    (state) => state.workspace,
  );
  const { signedIn, checked: sessionChecked } = useAppSelector(
    (state) => state.session,
  );
  const [toast, setToast] = useState("");
  const setMobile = (open: boolean) => dispatch(setMobileNavigationOpen(open));
  const [periods, setPeriods] = useState<ReturnType<typeof reportingPeriods>>(
    [],
  );
  // Read the clock after mount: the current date is not stable across prerender.
  useEffect(() => {
    // Clear credentials left by a pre-hydration form submission without reloading.
    const url = new URL(window.location.href);
    if (url.searchParams.has("phone") || url.searchParams.has("code")) {
      url.searchParams.delete("phone");
      url.searchParams.delete("code");
      window.history.replaceState(
        window.history.state,
        "",
        `${url.pathname}${url.search}${url.hash}`,
      );
    }
    const next = reportingPeriods();
    // Deliberate: the date must be read after mount, so this state cannot be derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriods(next);
    const monthToDate = next.find((item) => item.id === "month-to-date")!;
    dispatch(
      initializeReportingPeriod({ from: monthToDate.from, to: monthToDate.to }),
    );
    if (sessionChecked) return;
    let active = true;
    void ensureAdminToken()
      .then((token) => {
        if (active) dispatch(setSignedIn(Boolean(token)));
      })
      .catch(() => {
        if (active) dispatch(setSignedIn(false));
      });
    return () => {
      active = false;
    };
  }, [dispatch, sessionChecked]);
  const [dialog, setDialog] = useState<(Dialog & { id: number }) | null>(null);
  const context = useApi<
    [{ user: Row; server_time: string; markets: Row[]; roles?: string[] }]
  >(["/admin/workspace"], signedIn);
  const alerts = useApi<[Page<Row>]>(["/admin/alerts?limit=10"], signedIn);
  const currentUser = context.data?.[0].user;
  function notify(message: string) {
    setToast(message);
    setTimeout(() => setToast(""), 5000);
  }
  function openDialog(value: Dialog) {
    setDialog({ ...value, id: Date.now() });
  }
  const actions: Actions = {
    notify,
    dialog: openDialog,
    refresh: () => {
      void queryClient.invalidateQueries({ queryKey: ["cms"] });
    },
    inspect: (title, path) => {
      const id = Date.now();
      setDialog({
        id,
        title,
        body: (
          <p className="muted flex items-center gap-2" role="status">
            <Spinner /> Loading record…
          </p>
        ),
      });
      api(path)
        .then((record) =>
          setDialog((current) =>
            current?.id === id
              ? { ...current, body: <RecordDetail record={record} /> }
              : current,
          ),
        )
        .catch((error) =>
          setDialog((current) =>
            current?.id === id
              ? {
                  ...current,
                  body: (
                    <p className="inline-error" role="alert">
                      {error instanceof Error
                        ? error.message
                        : "Could not load record"}
                    </p>
                  ),
                }
              : current,
          ),
        );
    },
  };

  useEffect(() => {
    // An expired or missing session returns to the full-page sign-in (no pop-up, nothing else shown).
    const handleUnauthorized = () => {
      dispatch(setSignedIn(false));
      dispatch(setMobileNavigationOpen(false));
      setDialog(null);
    };
    window.addEventListener("ryno:admin_unauthorized", handleUnauthorized);
    return () =>
      window.removeEventListener("ryno:admin_unauthorized", handleUnauthorized);
  }, [dispatch]);

  const screen =
    !period || !signedIn ? null : section === "Dashboard" ? (
      <DashboardScreen {...{ period, actions }} />
    ) : section === "Orders" ? (
      <OrdersScreen key={period.from + period.to} {...{ period, actions }} />
    ) : section === "Reports" ? (
      <ReportsScreen {...{ period, actions }} />
    ) : section === "Marketing" ? (
      <MarketingScreen {...{ period, actions }} />
    ) : section === "Partners" ? (
      <PartnersScreen key={period.from + period.to} {...{ period, actions }} />
    ) : section === "Analytics" ? (
      <AnalyticsScreen {...{ period, actions }} />
    ) : section === "Data" ? (
      <DataScreen {...{ period, actions }} />
    ) : (
      <PaymentsScreen {...{ period, actions }} />
    );
  if (!sessionChecked) {
    return (
      <div
        className="flex min-h-screen items-center justify-center bg-[var(--canvas)] px-6"
        role="status"
        aria-live="polite"
      >
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--accent-soft)] text-[var(--accent-text)]">
            <Spinner className="h-6 w-6" />
          </span>
          <span className="text-sm font-medium text-[var(--muted)]">
            Checking your session…
          </span>
        </div>
      </div>
    );
  }
  if (!signedIn) {
    return (
      <LoginGate
        onSignedIn={() => {
          dispatch(setSignedIn(true));
          actions.refresh();
          setToast("Signed in successfully.");
          setTimeout(() => setToast(""), 5000);
        }}
      />
    );
  }
  return (
    <div className="workspace">
      {mobile && (
        <button
          className="mobile-scrim"
          aria-label="Close navigation"
          onClick={() => setMobile(false)}
        />
      )}
      <Sidebar {...{ mobile, setMobile, section }} />
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Menu size={20} aria-hidden="true" />
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{section}</strong>
          </div>
          <div className="header-right">
            <span className="updated">
              Server Time ·{" "}
              {context.data
                ? dateTime(context.data[0].server_time)
                : "Connecting…"}{" "}
              IST
            </span>
            <BackendHealth />
            <AlertsPopover
              alerts={alerts.data?.[0] ?? null}
              loading={alerts.loading}
              error={alerts.error}
              onRefresh={actions.refresh}
            />
            <AccountMenu
              user={currentUser}
              roles={context.data?.[0].roles}
              onSignOut={() => {
                clearAdminSession();
                dispatch(setSignedIn(false));
                dispatch(setMobileNavigationOpen(false));
                setDialog(null);
                notify("Signed out.");
              }}
            />
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{section}</h1>
              <p>{descriptions[section]}</p>
            </div>
            <PeriodControl
              period={period}
              periods={periods}
              onChange={(value) => dispatch(setReportingPeriod(value))}
            />
          </div>
          {context.error && (
            <div className="notice" role="alert">
              Backend unavailable: {context.error}
              <button
                className="text-button"
                onClick={actions.refresh}
                style={{ marginLeft: "12px" }}
              >
                Retry
              </button>
            </div>
          )}
          <motion.div key={section} initial={{ y: 3 }} animate={{ y: 0 }}>
            {screen}
          </motion.div>
          <footer>
            <span>
              Bengaluru · INR ·{" "}
              {context.data
                ? `Live · ${dateTime(context.data[0].server_time)} IST`
                : "Connecting to backend…"}
            </span>
            <span>ryno / built for the last mile</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <Check size={17} aria-hidden="true" />
          {toast}
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      )}
      {dialog && (
        <Modal key={dialog.id} value={dialog} onClose={() => setDialog(null)} />
      )}
    </div>
  );
}
