"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  api,
  clearAdminSession,
  ensureAdminToken,
  dateTime,
  loginWithOtp,
  requestAdminOtp,
  useApi,
  type Actions,
  type Dialog,
  type Page,
  type Period,
  type Row,
} from "@/lib/cms/client";
import { DashboardScreen, OrdersScreen, PartnersScreen, ReportsScreen } from "@/components/cms/operations";
import { AnalyticsScreen, MarketingScreen } from "@/components/cms/insights";
import { DataScreen, PaymentsScreen } from "@/components/cms/transfers";
import { RecordDetail } from "@/components/cms/ui";

const sections = ["Dashboard", "Orders", "Reports", "Marketing", "Partners", "Analytics", "Data", "Payments"];
const descriptions: Record<string, string> = {
  Dashboard: "Your last-mile operations, at a glance.",
  Orders: "Track each booking, its backend status and how the customer pays.",
  Reports: "Operational statements with clear periods, definitions and reconciliation status.",
  Marketing: "Manage campaign drafts, fare discounts and creative previews.",
  Partners: "The people and businesses keeping Bengaluru moving.",
  Analytics: "Explore booking demand, delivered fares and real-time operations.",
  Data: "Bring validated records in. Download traceable CSV snapshots.",
  Payments: "Review payment totals and reconciliation status.",
};
const iconPaths = [
  "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  "m12 3 9 5v9l-9 5-9-5V8z M3 8l9 5 9-5 M12 13v9 M7 5l10 6",
  "M5 3h10l4 4v14H5z M14 3v5h5 M8 17v-4 M12 17v-7 M16 17v-2",
  "M4 9h5l11-5v16L9 15H4z M7 15l2 6 M9 9v6",
  "M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4",
  "M3 20v-5 M8 20v-8 M13 20v-5 M18 20V8 M2 12l6-6 5 4 8-8",
  "M3 6c0-5 18-5 18 0s-18 5-18 0 M3 6v12c0 5 18 5 18 0V6 M3 12c0 5 18 5 18 0",
  "M3 7V4h15v3 M3 7h18v14H3z M21 12h-6v5h6",
];
function Icon({ index = 0, children }: { index?: number; children?: ReactNode }) {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children || <path d={iconPaths[index]} />}
    </svg>
  );
}
function Modal({ value, onClose }: { value: Dialog; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [notice, setNotice] = useState("");
  useEffect(() => {
    const dialog = ref.current;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog?.showModal();
    document.body.style.overflow = "hidden";
    return () => {
      dialog?.close();
      document.body.style.overflow = overflow;
      opener?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-label={value.title}
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          const bounds = event.currentTarget.getBoundingClientRect();
          if (
            event.clientX < bounds.left ||
            event.clientX > bounds.right ||
            event.clientY < bounds.top ||
            event.clientY > bounds.bottom
          )
            onClose();
        }
      }}
    >
      <div className="panel-heading">
        <h2>{value.title}</h2>
        <button autoFocus className="close" aria-label="Close dialog" disabled={busy} onClick={onClose}>
          ×
        </button>
      </div>
      {value.body}
      {value.fields && (
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            const form = new FormData(event.currentTarget);
            setBusy(true);
            setError("");
            try {
              await value.submit?.(form);
              onClose();
            } catch (error) {
              setError(error instanceof Error ? error.message : "Could not save. Try again.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {value.fields.map((field) => (
            <label key={field.name}>
              {field.label}
              {field.options ? (
                <select name={field.name} defaultValue={field.value} disabled={busy}>
                  {field.options.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  name={field.name}
                  type={field.type || "text"}
                  required={field.required}
                  defaultValue={field.value}
                  min={field.min}
                  max={field.max}
                  disabled={busy}
                />
              )}
            </label>
          ))}
          {value.secondary && (
            <button type="button" className="button" disabled={busy} onClick={async (event) => {
              const form = event.currentTarget.form;
              if (!form) return;
              setBusy(true);
              setError("");
              setNotice("");
              try {
                await value.secondary?.run(new FormData(form));
                setNotice("Code requested. Enter the code to sign in.");
              } catch (error) {
                setError(error instanceof Error ? error.message : "Could not request a code.");
              } finally {
                setBusy(false);
              }
            }}>
              {value.secondary.label}
            </button>
          )}
          {notice && <p role="status">{notice}</p>}
          {error && (
            <p role="alert" className="inline-error">
              {error}
            </p>
          )}
          <button type="submit" className="button primary" disabled={busy}>
            {busy ? "Saving…" : value.submitLabel || "Save"}
          </button>
        </form>
      )}
    </dialog>
  );
}
const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Reporting periods relative to today, so the filters never go stale. */
function reportingPeriods(now = new Date()): { label: string; from: string; to: string }[] {
  const monthName = (d: Date) => d.toLocaleString("en-IN", { month: "long", year: "numeric" });
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);
  const sevenDaysAgo = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  return [
    { label: "Today", from: isoDay(now), to: isoDay(now) },
    { label: "Last 7 days", from: isoDay(sevenDaysAgo), to: isoDay(now) },
    { label: `${monthName(now)} to date`, from: isoDay(monthStart), to: isoDay(now) },
    { label: monthName(lastMonthStart), from: isoDay(lastMonthStart), to: isoDay(lastMonthEnd) },
  ];
}

export default function Workspace({ initialSection = "dashboard" }: { initialSection?: string }) {
  const section = sections.find((s) => s.toLowerCase() === initialSection) || "Dashboard";
  const [mobile, setMobile] = useState(false),
    [revision, setRevision] = useState(0),
    [toast, setToast] = useState("");
  const [period, setPeriod] = useState<Period | null>(null);
  // Nothing is shown until there is a session; the backend still enforces auth on every call.
  const [signedIn, setSignedIn] = useState(false);
  const [periods, setPeriods] = useState<ReturnType<typeof reportingPeriods>>([]);
  // Read the clock after mount: the current date is not stable across prerender.
  useEffect(() => {
    const next = reportingPeriods();
    // Deliberate: the date must be read after mount, so this state cannot be derived during render.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPeriods(next);
    setPeriod({ from: next[2].from, to: next[2].to });
    void ensureAdminToken().then((token) => {
      if (token) setSignedIn(true);
      else window.dispatchEvent(new Event("ryno:admin_unauthorized"));
    });
  }, []);
  const [dialog, setDialog] = useState<(Dialog & { id: number }) | null>(null);
  const context = useApi<[{ user: Row; server_time: string; markets: Row[]; roles?: string[] }, Page<Row>]>(
    ["/admin/workspace", "/admin/alerts?limit=10"],
    revision
  );
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
    refresh: () => setRevision((r) => r + 1),
    inspect: (title, path) => {
      const id = Date.now();
      setDialog({ id, title, body: <p className="muted">Loading record…</p> });
      api(path)
        .then((record) =>
          setDialog((current) => (current?.id === id ? { ...current, body: <RecordDetail record={record} /> } : current))
        )
        .catch((error) =>
          setDialog((current) =>
            current?.id === id
              ? {
                  ...current,
                  body: (
                    <p className="inline-error" role="alert">
                      {error instanceof Error ? error.message : "Could not load record"}
                    </p>
                  ),
                }
              : current
          )
        );
    },
  };

  useEffect(() => {
    // An expired or missing session returns to the full-page sign-in (no pop-up, nothing else shown).
    const handleUnauthorized = () => {
      setSignedIn(false);
      setDialog(null);
    };
    window.addEventListener("ryno:admin_unauthorized", handleUnauthorized);
    return () => window.removeEventListener("ryno:admin_unauthorized", handleUnauthorized);
  }, []);

  const openAccount = () => {
    openDialog({
      title: String(currentUser?.name || "Admin Account"),
      body: (
        <div className="stack" style={{ gap: "12px", padding: "8px 0" }}>
          <p>
            <strong>Phone:</strong> {String(currentUser?.phone || "—")}
          </p>
          <p>
            <strong>Email:</strong> {String(currentUser?.email || "admin@ryno.app")}
          </p>
          <p>
            <strong>Roles:</strong>{" "}
            {context.data?.[0]?.roles ? (context.data[0].roles as string[]).join(", ") : "ADMIN_SUPER"}
          </p>
          <div className="row-actions" style={{ marginTop: "16px" }}>
            <button
              type="button"
              className="button"
              onClick={() => {
                clearAdminSession();
                setDialog(null);
                actions.refresh();
                notify("Signed out.");
              }}
            >
              Sign Out
            </button>
          </div>
        </div>
      ),
    });
  };

  const screen = !period || !signedIn ? null : section === "Dashboard" ? (
      <DashboardScreen {...{ period, revision, actions }} />
    ) : section === "Orders" ? (
      <OrdersScreen key={period.from + period.to} {...{ period, revision, actions }} />
    ) : section === "Reports" ? (
      <ReportsScreen {...{ period, revision, actions }} />
    ) : section === "Marketing" ? (
      <MarketingScreen {...{ period, revision, actions }} />
    ) : section === "Partners" ? (
      <PartnersScreen key={period.from + period.to} {...{ period, revision, actions }} />
    ) : section === "Analytics" ? (
      <AnalyticsScreen {...{ period, revision, actions }} />
    ) : section === "Data" ? (
      <DataScreen {...{ period, revision, actions }} />
    ) : (
      <PaymentsScreen {...{ period, revision, actions }} />
    );
  // First sign in, then the platform: until there is a session nothing of the workspace is rendered.
  if (!signedIn) {
    return (
      <LoginGate
        onSignedIn={() => {
          setSignedIn(true);
          setRevision((r) => r + 1);
          setToast("Signed in successfully.");
          setTimeout(() => setToast(""), 5000);
        }}
      />
    );
  }
  return (
    <div className="workspace">
      {mobile && <button className="mobile-scrim" aria-label="Close navigation" onClick={() => setMobile(false)} />}
      <aside className={"sidebar " + (mobile ? "open" : "")}>
        <Link href="/" className="brand" aria-label="Ryno mobility home">
          <Image src="/ryno-logo.png" width={144} height={66} alt="Ryno mobility" priority />
        </Link>
        <div className="location">
          <span>
            <Icon>
              <path d="M3 21V8h6V3h9v18M7 21v-6h6v6M12 7h2m-2 4h2m-2 4h2M3 21h18" />
            </Icon>
          </span>
          <div>
            <strong>Bengaluru</strong>
            <small>All zones · IN</small>
          </div>
        </div>
        <nav aria-label="Main navigation">
          {sections.map((name, i) => (
            <Link
              href={name === "Dashboard" ? "/" : "/" + name.toLowerCase()}
              key={name}
              className={section === name ? "active" : ""}
              aria-current={section === name ? "page" : undefined}
              onClick={() => setMobile(false)}
            >
              <Icon index={i} />
              {name}
            </Link>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="broadcast">
            <Icon>
              <circle cx="12" cy="12" r="2" />
              <path d="M7 7a7 7 0 0 0 0 10M17 7a7 7 0 0 1 0 10M4 4a11 11 0 0 0 0 16M20 4a11 11 0 0 1 0 16" />
            </Icon>
          </span>
          <strong>Every delivery counts.</strong>
          <p>
            Delivering more.
            <br />
            Worrying less.
          </p>
        </div>
        <button
          className="help"
          onClick={() =>
            openDialog({
              title: "About this workspace",
              body: (
                <>
                  <p>Use this workspace to manage orders, partners, campaigns, reports and payments.</p>
                  <p>The connection status at the top of the page shows whether workspace data is available.</p>
                  <a className="text-button" href="http://localhost:8000/docs" target="_blank" rel="noreferrer">
                    Open backend OpenAPI docs ↗
                  </a>
                </>
              ),
            })
          }
        >
          <span className="help-icon">?</span>Help & support
        </button>
      </aside>
      <div className="main-shell">
        <header>
          <div className="breadcrumb">
            <button
              className="mobile-toggle"
              aria-label="Toggle navigation"
              aria-expanded={mobile}
              onClick={() => setMobile(!mobile)}
            >
              <Icon>
                <path d="M3 6h18M3 12h18M3 18h18" />
              </Icon>
            </button>
            <span>Workspace</span>
            <span>/</span>
            <strong>{section}</strong>
          </div>
          <div className="header-right">
            <span className="badge workspace-mode">
              {context.error ? "API Unavailable" : context.loading ? "Connecting…" : "Live Backend"}
            </span>
            <span className="updated">
              Server Time · {context.data ? dateTime(context.data[0].server_time) : "Connecting…"} IST
            </span>
            <button
              className="notification"
              aria-label="Notifications"
              onClick={() =>
                openDialog({
                  title: "Operational alerts",
                  body: context.data ? (
                    <div className="notifications">
                      {context.data[1].items
                        .filter((r) => r.status !== "RESOLVED")
                        .map((r) => (
                          <p key={r.id}>
                            <strong>{String(r.title)}</strong>
                            <small>
                              {labelStatus(r.status)} · {dateTime(r.created_at)}
                            </small>
                          </p>
                        ))}
                    </div>
                  ) : (
                    <p>Alerts are not available. Refresh the workspace and try again.</p>
                  ),
                })
              }
            >
              <Icon>
                <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4" />
              </Icon>
            </button>
            <button type="button" className="avatar account-button" aria-label="Open admin account" onClick={openAccount}>
              {String(currentUser?.name || "AD")
                .slice(0, 2)
                .toUpperCase()}
            </button>
            <button type="button" className="account-name" onClick={openAccount}>
              {String(currentUser?.name || "Admin")}
            </button>
          </div>
        </header>
        <main>
          <div className="page-heading">
            <div>
              <h1>{section}</h1>
              <p>{descriptions[section]}</p>
            </div>
            <label className="period-control"><span>Reporting period</span><select
              aria-label="Reporting period"
              value={period ? period.from + "/" + period.to : ""}
              onChange={(event) => {
                const [from, to] = event.target.value.split("/");
                setPeriod({ from, to });
              }}
            >
              {periods.map((p) => (
                <option key={p.label} value={p.from + "/" + p.to}>
                  {p.label}
                </option>
              ))}
            </select></label>
          </div>
          {context.error && (
            <div className="notice" role="alert">
              Backend unavailable: {context.error}
              <button className="text-button" onClick={actions.refresh} style={{ marginLeft: "12px" }}>
                Retry
              </button>
            </div>
          )}
          {screen}
          <footer>
            <span>
              Bengaluru · INR ·{" "}
              {context.data ? `Live · ${dateTime(context.data[0].server_time)} IST` : "Connecting to backend…"}
            </span>
            <span>ryno / built for the last mile</span>
          </footer>
        </main>
      </div>
      {toast && (
        <div className="toast" role="status">
          <span>✓</span>
          {toast}
          <button aria-label="Dismiss notification" onClick={() => setToast("")}>
            ×
          </button>
        </div>
      )}
      {dialog && <Modal key={dialog.id} value={dialog} onClose={() => setDialog(null)} />}
    </div>
  );
}
function labelStatus(value: unknown) {
  return String(value || "")
    .replaceAll("_", " ")
    .toLowerCase();
}

/** Full-page admin sign-in: phone number, one-time code, then the workspace opens. */
function LoginGate({ onSignedIn }: { onSignedIn: () => void }) {
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function sendCode() {
    if (phone.length !== 10) return setError("Enter the 10-digit admin phone number.");
    setBusy(true);
    setError("");
    try {
      await requestAdminOtp(`+91${phone}`);
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not send the code.");
    } finally {
      setBusy(false);
    }
  }

  async function signIn(event: React.FormEvent) {
    event.preventDefault();
    if (!sent) return sendCode();
    if (!code.trim()) return setError("Enter the code you received.");
    setBusy(true);
    setError("");
    try {
      await loginWithOtp(`+91${phone}`, code.trim());
      onSignedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Sign in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-gate">
      <form className="login-card" onSubmit={signIn}>
        <Image src="/ryno-logo.png" width={144} height={66} alt="Ryno mobility" priority />
        <h1>Sign in</h1>
        <p>Operations workspace · admin access only</p>
        <label>
          Admin phone number
          <span className="phone-field">
            <span className="phone-prefix">+91</span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              placeholder="98765 43210"
              maxLength={10}
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              disabled={sent}
            />
          </span>
        </label>
        {sent ? (
          <label>
            One-time code
            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="6-digit code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
          </label>
        ) : null}
        {error ? (
          <div className="inline-error" role="alert">
            {error}
          </div>
        ) : null}
        <button type="submit" className="button primary" disabled={busy}>
          {busy ? "Please wait…" : sent ? "Sign in" : "Send code"}
        </button>
        {sent ? (
          <button
            type="button"
            className="text-button"
            onClick={() => {
              setSent(false);
              setCode("");
              setError("");
            }}
          >
            Use a different number
          </button>
        ) : null}
      </form>
    </div>
  );
}
