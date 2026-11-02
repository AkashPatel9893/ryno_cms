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
