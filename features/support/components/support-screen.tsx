"use client";
import {
  ArrowLeft,
  ArrowUpRight,
  CheckCircle2,
  MessageSquare,
  Send,
  UserCheck,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { api, dateTime, label, post, useApi } from "@/lib/cms/client";
import { type ScreenProps } from "@/components/cms/screen-utils";
import {
  Badge,
  Button,
  Cell,
  LoadState,
  Panel,
  Table,
  Tabs,
  TextButton,
} from "@/components/cms/ui";
import { Spinner } from "@/components/ui/spinner";

export type SupportTicket = {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  status: string;
  subject: string;
  order_id: string | null;
  assigned_to_user_id: string | null;
  resolution_note: string | null;
  created_at: string;
};

export type SupportMessage = {
  id: string;
  sender_type: string;
  message: string;
  is_internal: boolean;
  created_at: string;
};

export type QueueItem = {
  id: string;
  ticket_number: string;
  order_id: string | null;
  handoff_requested_at: string | null;
};

const statusTabs = [
  "",
  "OPEN",
  "ASSIGNED",
  "IN_PROGRESS",
  "RESOLVED",
  "CLOSED",
];

export function SupportScreen({ actions }: ScreenProps) {
  const [sectionView, setSectionView] = useState(0); // 0: Tickets, 1: Live Queue
  const [tab, setTab] = useState(0);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [priority, setPriority] = useState("");
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);

  const statusFilter = statusTabs[tab];
  const state = useApi<[SupportTicket[], QueueItem[]]>([
    statusFilter
      ? `/admin/support/tickets?status=${statusFilter}`
      : "/admin/support/tickets",
    "/admin/support/chats/queue",
  ]);

  const [activeThread, setActiveThread] = useState<SupportMessage[] | null>(
    null,
  );
  const [loadingThread, setLoadingThread] = useState(false);
  const [threadError, setThreadError] = useState("");
  const [threadAttempt, setThreadAttempt] = useState(0);
  const [replyText, setReplyText] = useState("");
  const [isInternalNote, setIsInternalNote] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  const tickets = state.data?.[0];
  const queueItems = state.data?.[1] || [];

  const selectedTicket =
    tickets?.find((t) => t.id === selectedTicketId) || null;

  useEffect(() => {
    if (!selectedTicketId) return;
    let cancelled = false;
    api<SupportMessage[]>(`/admin/support/tickets/${selectedTicketId}/messages`)
      .then((msgs) => {
        if (!cancelled) setActiveThread(msgs);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setThreadError(
            error instanceof Error ? error.message : "Could not load messages.",
          );
      })
      .finally(() => {
        if (!cancelled) setLoadingThread(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTicketId, threadAttempt]);

  async function sendReply() {
    if (!selectedTicketId || !replyText.trim() || sendingReply) return;
    setSendingReply(true);
    try {
      const newMsg = await post<SupportMessage>(
        `/admin/support/tickets/${selectedTicketId}/messages`,
        {
          message: replyText.trim(),
          internal: isInternalNote,
        },
      );
      setActiveThread((prev) => (prev ? [...prev, newMsg] : [newMsg]));
      setReplyText("");
      actions.notify(
        isInternalNote
          ? "Internal note added."
          : "Reply sent to customer/driver.",
      );
    } catch (err) {
      actions.notify(
        err instanceof Error ? err.message : "Failed to send message.",
      );
    } finally {
      setSendingReply(false);
    }
  }

  function assignTicketDialog(ticket: SupportTicket) {
    actions.dialog({
      title: `Assign Ticket ${ticket.ticket_number}`,
      body: (
        <p className="muted">
          Assign this support request to an admin agent user ID.
        </p>
      ),
      fields: [
        {
          name: "assignee_user_id",
          label: "Agent User ID (UUID)",
          required: true,
          value: ticket.assigned_to_user_id || "",
        },
      ],
      submitLabel: "Assign ticket",
      submit: async (form) => {
        const assignee = String(form.get("assignee_user_id") || "").trim();
        if (!assignee) throw new Error("Agent user ID is required.");
        await post(`/admin/support/tickets/${ticket.id}/assign`, {
          assignee_user_id: assignee,
        });
        actions.refresh();
        actions.notify("Ticket assigned successfully.");
      },
    });
  }

  function resolveTicketDialog(ticket: SupportTicket) {
    actions.dialog({
      title: `Resolve Ticket ${ticket.ticket_number}`,
      body: (
        <p className="muted">
          Record resolution details. This will mark the ticket as resolved.
        </p>
      ),
      fields: [
        {
          name: "note",
          label: "Resolution note",
          required: true,
        },
      ],
      submitLabel: "Mark resolved",
      submit: async (form) => {
        const note = String(form.get("note") || "").trim();
        if (note.length < 3)
          throw new Error("Enter a resolution note of at least 3 characters.");
        await post(`/admin/support/tickets/${ticket.id}/resolve`, {
          note,
        });
        actions.refresh();
        actions.notify("Ticket resolved.");
      },
    });
  }

  if (!state.data) {
    return <LoadState error={state.error} retry={actions.refresh} />;
  }

  // Filter tickets by search, category, priority
  const filteredTickets = (tickets || []).filter((t) => {
    if (search) {
      const q = search.toLowerCase();
      const matchNumber = t.ticket_number.toLowerCase().includes(q);
      const matchSubject = t.subject.toLowerCase().includes(q);
      if (!matchNumber && !matchSubject) return false;
    }
    if (category && t.category !== category) return false;
    if (priority && t.priority !== priority) return false;
    return true;
  });

  async function claimChat(chatId: string) {
    try {
      await post(`/admin/support/chats/${chatId}/claim`);
      setSelectedTicketId(chatId);
      setThreadError("");
      setLoadingThread(true);
      setActiveThread(null);
      setSectionView(0);
      setTab(0);
      actions.refresh();
      actions.notify("Live chat claimed. You joined the conversation.");
    } catch (err) {
      actions.notify(
        err instanceof Error ? err.message : "Failed to claim chat.",
      );
    }
  }

  return (
    <>
      <div className="section-subnav mb-4">
        <Tabs
          items={["Ticket inbox", `Live chat queue (${queueItems.length})`]}
          value={sectionView}
          onChange={(i) => {
            setSectionView(i);
            setSelectedTicketId(null);
          }}
        />
      </div>

      {sectionView === 1 && (
        <Panel
          title="Live Support Chat Queue"
          sub="Customers and delivery riders currently waiting for an agent to claim their session"
          action={<Button onClick={actions.refresh}>Refresh queue</Button>}
        >
          <Table
            heads={[
              "Ticket / Session",
              "Linked Order",
              "Waiting Since",
              "Action",
            ]}
            rows={queueItems.map((item) => [
              item.ticket_number,
              item.order_id ? (
                <TextButton
                  key="o"
                  onClick={() =>
                    actions.inspect(
                      `Order ${item.order_id}`,
                      `/admin/orders/${item.order_id}`,
                    )
                  }
                >
                  {item.order_id.slice(0, 8)}…{" "}
                  <ArrowUpRight size={14} className="inline" />
                </TextButton>
              ) : (
                "General query"
              ),
              item.handoff_requested_at
                ? dateTime(item.handoff_requested_at)
                : "Just now",
              <div key="act" className="row-actions">
                <Button primary onClick={() => claimChat(item.id)}>
                  Claim chat
                </Button>
              </div>,
            ])}
            empty="No users currently waiting in the live chat queue."
          />
        </Panel>
      )}

      {sectionView === 0 && (
        <>
          <Tabs
            items={statusTabs.map((status, index) =>
              index === 0 ? "All tickets" : label(status),
            )}
            value={tab}
            onChange={(i) => {
              setTab(i);
              setSelectedTicketId(null);
            }}
          />

          {selectedTicket && (
            <Panel
              title={`Ticket ${selectedTicket.ticket_number} · ${selectedTicket.subject}`}
              sub={`${label(selectedTicket.category)} · Priority: ${label(selectedTicket.priority)} · Created ${dateTime(selectedTicket.created_at)}`}
              action={
                <div className="flex items-center gap-2">
                  <Button
                    onClick={() => {
                      setSelectedTicketId(null);
                      setActiveThread(null);
                    }}
                  >
                    <ArrowLeft size={16} className="inline mr-1" /> Back to list
                  </Button>
                  {selectedTicket.status !== "RESOLVED" &&
                    selectedTicket.status !== "CLOSED" && (
                      <>
                        <Button
                          onClick={() => assignTicketDialog(selectedTicket)}
                        >
                          <UserCheck size={16} className="inline mr-1" /> Assign
                        </Button>
                        <Button
                          primary
                          onClick={() => resolveTicketDialog(selectedTicket)}
                        >
                          <CheckCircle2 size={16} className="inline mr-1" />{" "}
                          Resolve
                        </Button>
                      </>
                    )}
                </div>
              }
            >
              {selectedTicket.resolution_note && (
                <div className="notice mb-4">
                  <Badge orange>Resolved</Badge>
                  <span>Resolution note: {selectedTicket.resolution_note}</span>
                </div>
              )}

              {selectedTicket.order_id && (
                <div className="mb-4 flex items-center gap-2">
                  <span className="text-xs text-[var(--muted)]">
                    Linked Order:
                  </span>
                  <TextButton
                    onClick={() =>
                      actions.inspect(
                        `Order ${selectedTicket.order_id}`,
                        `/admin/orders/${selectedTicket.order_id}`,
                      )
                    }
                  >
                    {selectedTicket.order_id}{" "}
                    <ArrowUpRight size={14} className="inline" />
                  </TextButton>
                </div>
              )}

              <div className="flex flex-col gap-4 border-t border-[var(--line)] pt-4">
                <h3 className="text-sm font-semibold">Message Thread</h3>
                {loadingThread ? (
                  <p className="flex items-center gap-2 text-sm text-[var(--muted)]">
                    <Spinner /> Loading thread…
                  </p>
                ) : threadError ? (
                  <div role="alert" className="text-sm text-[var(--muted)]">
                    {threadError}{" "}
                    <button
                      className="text-button"
                      onClick={() => {
                        setThreadError("");
                        setLoadingThread(true);
                        setThreadAttempt((attempt) => attempt + 1);
                      }}
                    >
                      Retry
                    </button>
                  </div>
                ) : !activeThread || activeThread.length === 0 ? (
                  <p className="text-sm text-[var(--muted)]">
                    No messages in this ticket yet.
                  </p>
                ) : (
                  <div className="flex flex-col gap-3 max-h-[450px] overflow-y-auto pr-2">
                    {activeThread.map((msg) => {
                      const isAgent = msg.sender_type === "AGENT";
                      return (
                        <div
                          key={msg.id}
                          className={`p-3 rounded-xl border ${
                            msg.is_internal
                              ? "bg-[var(--surface-subtle)] border-amber-500/30"
                              : isAgent
                                ? "bg-[var(--surface)] border-[var(--line)]"
                                : "bg-[var(--canvas)] border-[var(--line)]"
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 mb-1">
                            <div className="flex items-center gap-2">
                              <Badge orange={isAgent}>
                                {msg.is_internal
                                  ? "Internal Staff Note"
                                  : label(msg.sender_type)}
                              </Badge>
                              {msg.is_internal && (
                                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                                  (Only visible to staff)
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--muted)]">
                              {dateTime(msg.created_at)}
                            </span>
                          </div>
                          <p className="text-sm whitespace-pre-wrap leading-relaxed">
                            {msg.message}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                )}

                {selectedTicket.status !== "CLOSED" && (
                  <div className="mt-4 pt-4 border-t border-[var(--line)] flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <label
                        htmlFor="support-reply"
                        className="text-xs font-semibold"
                      >
                        Post Reply or Internal Note
                      </label>
                      <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={isInternalNote}
                          onChange={(e) => setIsInternalNote(e.target.checked)}
                          className="rounded accent-orange-600"
                        />
                        <span>Post as internal staff note</span>
                      </label>
                    </div>
                    <textarea
                      id="support-reply"
                      rows={3}
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={
                        isInternalNote
                          ? "Add internal notes, findings or transfer instructions…"
                          : "Type a response to the customer or driver…"
                      }
                      className="w-full rounded-xl border border-[var(--line)] bg-[var(--surface)] p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                    <div className="flex justify-end">
                      <Button
                        primary
                        disabled={!replyText.trim() || sendingReply}
                        onClick={sendReply}
                      >
                        {sendingReply ? (
                          <Spinner />
                        ) : (
                          <>
                            <Send size={15} className="inline mr-1.5" />
                            {isInternalNote ? "Save note" : "Send reply"}
                          </>
                        )}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </Panel>
          )}

          {!selectedTicket && (
            <Panel
              title="Customer & Driver Support Tickets"
              sub="Customer and rider requests, messages, and resolution"
            >
              {tickets && tickets.length >= 200 && (
                <p className="muted" role="status">
                  Showing up to 200 tickets. Search and category filters apply
                  to the tickets shown; use the status tabs to narrow the list.
                </p>
              )}
              <div className="filters">
                <Input
                  aria-label="Search tickets"
                  placeholder="Search ticket number or subject"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  aria-label="Filter by category"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  <option value="">All categories</option>
                  {[
                    "ORDER",
                    "PAYMENT",
                    "REFUND",
                    "DRIVER_BEHAVIOUR",
                    "DAMAGE",
                    "ACCOUNT",
                    "KYC",
                    "EARNINGS",
                    "OTHER",
                  ].map((c) => (
                    <option key={c} value={c}>
                      {label(c)}
                    </option>
                  ))}
                </select>
                <select
                  aria-label="Filter by priority"
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                >
                  <option value="">All priorities</option>
                  {["URGENT", "HIGH", "NORMAL", "LOW"].map((p) => (
                    <option key={p} value={p}>
                      {label(p)}
                    </option>
                  ))}
                </select>
                {(search || category || priority) && (
                  <Button
                    onClick={() => {
                      setSearch("");
                      setCategory("");
                      setPriority("");
                    }}
                  >
                    Reset
                  </Button>
                )}
              </div>

              <Table
                heads={[
                  "Ticket / Subject",
                  "Category",
                  "Priority",
                  "Status",
                  "Assigned Agent",
                  "Created",
                  "Action",
                ]}
                rows={filteredTickets.map((t) => [
                  <Cell key="t" title={t.ticket_number} sub={t.subject} />,
                  label(t.category),
                  <Badge
                    key="p"
                    orange={["HIGH", "URGENT"].includes(t.priority)}
                  >
                    {label(t.priority)}
                  </Badge>,
                  <Badge
                    key="s"
                    orange={["OPEN", "IN_PROGRESS"].includes(t.status)}
                  >
                    {label(t.status)}
                  </Badge>,
                  t.assigned_to_user_id ? (
                    <span
                      key="a"
                      title={t.assigned_to_user_id}
                      className="text-xs"
                    >
                      {t.assigned_to_user_id.slice(0, 8)}…
                    </span>
                  ) : (
                    <span key="a" className="text-xs text-[var(--muted)]">
                      Unassigned
                    </span>
                  ),
                  dateTime(t.created_at),
                  <div key="actions" className="row-actions">
                    <TextButton
                      onClick={() => {
                        setSelectedTicketId(t.id);
                        setThreadError("");
                        setLoadingThread(true);
                        setActiveThread(null);
                      }}
                    >
                      View thread{" "}
                      <MessageSquare size={14} className="inline ml-1" />
                    </TextButton>
                  </div>,
                ])}
                empty="No support tickets match the current criteria."
              />
            </Panel>
          )}
        </>
      )}
    </>
  );
}
