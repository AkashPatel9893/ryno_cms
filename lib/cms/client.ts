"use client";
import { useEffect, useState } from "react";
import type { Order, Row } from "@/lib/mock-api/data";
export type { Order, Row };
export type Page<T> = { items: T[]; next_cursor: string | null; total_count: number; as_of: string };
export type Aggregate<T> = { market_id: string; from_date: string; to_date: string; as_of: string; currency: string; timezone: string; data: T };
export type Period = { from: string; to: string };
export type Point = { date: string; amount: string; bookings_count: number; comparison_amount: string | null };
export type Dashboard = { gross_fare_revenue: string; today_date: string; today_gross_fare_revenue: string; bookings_count: number; today_bookings_count: number; counts_by_group: Record<string, number>; today_counts_by_group: Record<string, number>; bookings_by_customer_type: Record<string, number>; revenue_series: Point[]; rides_by_customer_type_and_group: { status_group: string; individual_count: number; business_count: number }[]; open_web_enquiries_count: number };
export type FormField = { name: string; label: string; type?: string; required?: boolean; options?: { value: string; label: string }[]; value?: string; min?: string; max?: string };
export type Dialog = { title: string; body?: React.ReactNode; fields?: FormField[]; submit?: (data: FormData) => Promise<void>; submitLabel?: string };
export type Actions = { notify: (message: string) => void; dialog: (value: Dialog) => void; inspect: (title: string, path: string) => void; refresh: () => void };
const AUTH = { Authorization: "Bearer mock-admin-token" };
export class RequestError extends Error { constructor(message: string, public code: string) { super(message) } }
export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch("/api/v1" + path, { ...options, cache: "no-store", headers: { ...AUTH, ...(options.body instanceof FormData ? {} : options.body ? { "Content-Type": "application/json" } : {}), ...options.headers } });
    if (!response.ok) { let error: { message?: string; code?: string } = {}; try { error = await response.json() } catch { } throw new RequestError(error.message || `Request failed (${response.status}). Try again.`, error.code || "REQUEST_FAILED") }
    if (response.status === 204) return undefined as T;
    return response.json();
}
export function post<T>(path: string, body: unknown = {}, idempotent = false) { return api<T>(path, { method: "POST", body: JSON.stringify(body), headers: idempotent ? { "Idempotency-Key": crypto.randomUUID() } : undefined }) }
export function useApi<T>(paths: string[], revision = 0) {
    const key = JSON.stringify([paths, revision]); const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });
    useEffect(() => {
        const controller = new AbortController(); const urls = JSON.parse(key)[0] as string[];
        Promise.all(urls.map(path => api(path, { signal: controller.signal }))).then(data => setState({ key, data: data as T, error: null })).catch(error => { if (!controller.signal.aborted) setState({ key, data: null, error: error instanceof Error ? error.message : "Could not load records" }) });
        return () => controller.abort();
    }, [key]);
    return state.key === key ? { ...state, loading: false } : { data: null, error: null, loading: true };
}
export function query(period: Period, extra: Record<string, string> = {}) { return new URLSearchParams({ ...period, ...Object.fromEntries(Object.entries(extra).filter(([, value]) => value)) }).toString() }
export function rupees(value: unknown) { return value == null ? "Not available" : new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 }).format(Number(value)) }
export function number(value: unknown) { return Number(value || 0).toLocaleString("en-IN") }
export function label(value: unknown) { return value == null ? "Not available" : String(value).toLowerCase().split("_").map(s => s[0]?.toUpperCase() + s.slice(1)).join(" ") }
export function dateTime(value: unknown) { if (!value) return "Not available"; return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" }).format(new Date(String(value))) }
export function dateLabel(period: Period) { return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" }).format(new Date(period.from)) + " – " + new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" }).format(new Date(period.to)) }
export async function download(path: string, fallback = "export.csv") {
    const response = await fetch("/api/v1" + path, { headers: AUTH, cache: "no-store" }); if (!response.ok) { const error = await response.json(); throw new Error(error.message || "Download failed") }
    const url = URL.createObjectURL(await response.blob()); const a = document.createElement("a"); a.href = url; a.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || fallback; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export async function exportData(dataset: string, period: Period, filters: Record<string, string> = {}) { const job = await post<{ download_url: string; record_count: number }>("/admin/data/exports", { dataset, format: "csv", from_date: period.from, to_date: period.to, filters }, true); await download(job.download_url.replace("/api/v1", "")); return job.record_count }
