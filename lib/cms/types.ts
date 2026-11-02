import type { ReactNode } from "react";

export type Row = { id: string; [key: string]: unknown };
export type Order = {
  id: string;
  order_number: string;
  market_id: string;
  status: string;
  status_group: string;
  created_at: string;
  completed_at: string | null;
  customer: {
    id: string;
    customer_number: string;
    display_name: string;
    customer_type: string;
    phone_masked: string;
  };
  route: { pickup_label: string; drop_label: string; stop_count: number };
  vehicle_type: { id: string; code: string; name: string };
  fare: {
    quoted_amount: string;
    final_amount: string | null;
    currency: string;
  };
  payment: {
    payment_id: string;
    method: string;
    timing: string;
    status: string;
    gateway_status: string;
    paid_at: string | null;
    refunded_amount: string;
  };
  assigned_driver_id: string | null;
};

export type Page<T> = {
  items: T[];
  next_cursor: string | null;
  total_count: number;
  as_of: string;
};
export type Aggregate<T> = {
  market_id: string;
  from_date: string;
  to_date: string;
  as_of: string;
  currency: string;
  timezone: string;
  data: T;
};
export type Period = { from: string; to: string };
export type Point = {
  date: string;
  amount: string;
  bookings_count: number;
  comparison_amount: string | null;
};
export type Dashboard = {
  gross_fare_revenue: string;
  today_date: string;
  today_gross_fare_revenue: string;
  bookings_count: number;
  today_bookings_count: number;
  counts_by_group: Record<string, number>;
  today_counts_by_group: Record<string, number>;
  bookings_by_customer_type: Record<string, number>;
  revenue_series: Point[];
  rides_by_customer_type_and_group: {
    status_group: string;
    individual_count: number;
    business_count: number;
  }[];
  open_web_enquiries_count: number;
};
export type FormField = {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  value?: string;
  min?: string;
  max?: string;
};
export type Dialog = {
  title: string;
  body?: ReactNode;
  fields?: FormField[];
  submit?: (data: FormData) => Promise<void>;
  submitLabel?: string;
  secondary?: { label: string; run: (data: FormData) => Promise<void> };
};
export type Actions = {
  notify: (message: string) => void;
  dialog: (value: Dialog) => void;
  inspect: (title: string, path: string) => void;
  refresh: () => void;
};
