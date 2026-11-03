"use client";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Button as BaseButton } from "@/components/ui/button";
import {
  Table as BaseTable,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge as BaseBadge } from "@/components/ui/badge";
import { number } from "@/lib/cms/client";
export function Badge({
  children,
  orange = false,
}: {
  children: ReactNode;
  orange?: boolean;
}) {
  return (
    <BaseBadge variant={orange ? "orange" : "default"}>{children}</BaseBadge>
  );
}
export function Cell({ title, sub }: { title: ReactNode; sub?: ReactNode }) {
  return (
    <>
      <span>{title}</span>
      {sub && <small>{sub}</small>}
    </>
  );
}
export function Panel({
  title,
  sub,
  children,
  action,
}: {
  title: string;
  sub?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <h2>{title}</h2>
          {sub && <p>{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}
export function Table({
  heads,
  rows,
  empty = "No matching records. Try another filter.",
}: {
  heads: string[];
  rows: ReactNode[][];
  empty?: string;
}) {
  return (
    <div
      className={
        heads.length >= 5 ? "table-scroll table-scroll--wide" : "table-scroll"
      }
    >
      <BaseTable>
        <TableHeader>
          <TableRow>
            {heads.map((h) => (
              <TableHead scope="col" key={h}>
                {h}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row, i) => (
            <TableRow key={i}>
              {row.map((cell, j) => (
                <TableCell key={j} data-label={heads[j]}>
                  {cell}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </BaseTable>
      {!rows.length && <p className="empty">{empty}</p>}
    </div>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: ReactNode; note: string }[];
}) {
  return (
    <div className="stats">
      {items.map((s, i) => (
        <div className={"stat " + (!i ? "dark" : "")} key={s.label}>
          <h3>{s.label}</h3>
          <div>{s.value}</div>
          <p>{s.note}</p>
        </div>
      ))}
    </div>
  );
}
export function Tabs({
  items,
  value,
  onChange,
}: {
  items: string[];
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="tabs" role="tablist">
      {items.map((title, i) => (
        <button
          key={title}
          role="tab"
          aria-selected={value === i}
          className={value === i ? "selected" : ""}
          onClick={() => onChange(i)}
        >
          {title}
        </button>
      ))}
    </div>
  );
}
export function Button({
  children,
  onClick,
  primary = false,
  disabled = false,
}: {
  children: ReactNode;
  onClick: () => void | Promise<void>;
  primary?: boolean;
  disabled?: boolean;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <BaseButton
      variant={primary ? "default" : "outline"}
      disabled={disabled || busy}
      onClick={async () => {
        setBusy(true);
        try {
          await onClick();
        } finally {
          setBusy(false);
        }
      }}
    >
      {busy ? "Please wait…" : children}
    </BaseButton>
  );
}
export function TextButton({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button className="text-button" onClick={onClick}>
      {children}
    </button>
  );
}
export function Pager({
  count,
  cursor,
  next,
  onNext,
  onPrevious,
}: {
  count: number;
  cursor: string;
  next: string | null;
  onNext: (cursor: string) => void;
  onPrevious: () => void;
}) {
  return (
    <div className="pagination">
      <span>{number(count)} matching records</span>
      <div>
        <button disabled={!cursor} onClick={onPrevious}>
          <ArrowLeft size={14} aria-hidden="true" /> Previous
        </button>
        <button disabled={!next} onClick={() => next && onNext(next)}>
          Next <ArrowRight size={14} aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}
export { LoadState } from "@/components/cms/loading-state";
export { Chart } from "@/components/cms/revenue-chart";
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/;
function detailValue(key: string, value: unknown): React.ReactNode {
  if (value === null) return <span className="muted">—</span>;
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "string") {
    if (ISO.test(value)) {
      const d = new Date(value);
      if (!Number.isNaN(d.getTime()))
        return d.toLocaleString("en-IN", {
          day: "numeric",
          month: "short",
          hour: "numeric",
          minute: "2-digit",
        });
    }
    if (
      /^\d+(\.\d+)?$/.test(value) &&
      /amount|fare|fee|price|total|discount|tax|earning|payable/i.test(key)
    )
      return `₹${Number(value).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    return value.replaceAll("_", " ");
  }
  if (Array.isArray(value)) {
    if (value.length === 0) return <span className="muted">None</span>;
    return (
      <div className="record-list">
        {value.map((item, i) => (
          <div key={i}>
            {typeof item === "object" && item !== null ? (
              <RecordDetail record={item} />
            ) : (
              detailValue(key, item)
            )}
          </div>
        ))}
      </div>
    );
  }
  if (typeof value === "object") return <RecordDetail record={value} />;
  return String(value);
}
export function RecordDetail({ record }: { record: unknown }) {
  if (record == null)
    return <p className="muted">No record details available.</p>;
  if (typeof record !== "object") return <p>{String(record)}</p>;
  return (
    <dl className="record-detail">
      {Object.entries(record)
        .filter(
          ([key, value]) =>
            value !== undefined && !key.endsWith("phone_masked"),
        )
        .map(([key, value]) => (
          <div
            key={key}
            className={
              value !== null && typeof value === "object"
                ? "record-group"
                : undefined
            }
          >
            <dt>{key.replaceAll("_", " ")}</dt>
            <dd>{detailValue(key, value)}</dd>
          </div>
        ))}
    </dl>
  );
}
