import { seedOrders } from "@/lib/mock-api/order-fixtures";
export const SNAPSHOT = "2026-10-14T09:00:00Z";
export const MARKET_ID = "11111111-1111-4111-8111-111111111111";
export const TOKEN = "mock-admin-token";
import type { Order, Row } from "@/lib/mock-api/types";
export type { Order, Row } from "@/lib/mock-api/types";
export function id(n: number, family = 2) {
  return `${String(family).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
}
export const groups: Record<string, string> = {
  CREATED: "UNASSIGNED",
  PAYMENT_PENDING: "UNASSIGNED",
  PAYMENT_FAILED: "UNASSIGNED",
  SEARCHING_DRIVER: "UNASSIGNED",
  NO_DRIVER_FOUND: "UNASSIGNED",
  DRIVER_ASSIGNED: "CONFIRMED",
  DRIVER_ARRIVED_AT_PICKUP: "CONFIRMED",
  PICKED_UP: "ACTIVE",
  DRIVER_ARRIVED_AT_DROP: "ACTIVE",
  AWAITING_PAYMENT: "ACTIVE",
  DELIVERED: "DELIVERED",
  CANCELLED: "CANCELLED",
  DELIVERY_FAILED: "FAILED",
};
export const permissions = [
  "orders.manage",
  "kyc.review",
  "drivers.manage",
  "vehicles.manage",
  "pricing.manage",
  "payments.read",
  "payments.refund",
  "payouts.manage",
  "alerts.manage",
  "audit.read",
  "support.manage",
  "analytics.read",
  "reports.read",
  "customers.manage",
  "partners.manage",
  "marketing.manage",
  "data.import",
  "data.export",
];
export const markets: Row[] = [
  {
    id: MARKET_ID,
    code: "BLR",
    name: "Bengaluru",
    state: "Karnataka",
    country_code: "IN",
    timezone: "Asia/Kolkata",
    currency: "INR",
    is_active: true,
  },
];
export const zones: Row[] = [
  "Koramangala",
  "Indiranagar",
  "HSR Layout",
  "Whitefield",
].map((name, i) => ({
  id: id(i + 1, 10),
  market_id: MARKET_ID,
  name,
  zone_type: "SERVICEABLE",
  priority: 0,
  is_active: true,
}));
export const vehicleTypes: Row[] = [
  {
    id: id(1, 4),
    code: "BIKE",
    name: "2 Wheeler",
    category: "TWO_WHEELER",
    payload_capacity_kg: "20.00",
  },
  {
    id: id(2, 4),
    code: "TATA_ACE",
    name: "Mini truck",
    category: "MINI_TRUCK",
    payload_capacity_kg: "750.00",
  },
];
export const user: Row = {
  id: id(1, 1),
  user_type: "ADMIN",
  status: "ACTIVE",
  phone: "+919900000001",
  phone_masked: "+91 99•••••001",
  email: "ananya@example.com",
  email_verified: true,
  name: "Ananya K.",
  profile_complete: true,
};
const people = [
  "Aarav Mehta",
  "FreshMart",
  "Neha Sharma",
  "Bloom Studio",
  "Rohan Gupta",
  "Nest Home",
  "Meera Iyer",
];
export const seedCustomers: Row[] = people.map((name, i) => ({
  id: id(i + 1, 3),
  customer_number: `CUS-${String(i + 1).padStart(4, "0")}`,
  display_name: name,
  customer_type: [1, 3, 5].includes(i) ? "BUSINESS" : "INDIVIDUAL",
  status: "ACTIVE",
  phone_masked: `+91 98•••••${String(220 + i).padStart(3, "0")}`,
  email: `customer${i + 1}@example.com`,
  default_currency: "INR",
  created_at: "2026-09-01T04:30:00Z",
}));
export const seedDrivers: Row[] = Array.from({ length: 96 }, (_, i) => ({
  id: id(i + 1, 5),
  driver_number: `RD-${String(i + 1).padStart(3, "0")}`,
  first_name:
    ["Ravi", "Suresh", "Imran", "Deepak", "Prakash", "Arun"][i] ||
    `Rider ${i + 1}`,
  last_name: ["Kumar", "Gowda", "Khan", "S.", "R.", "Kumar"][i] || null,
  phone_masked: `+91 98•••••${String(301 + i).padStart(3, "0")}`,
  primary_market_id: MARKET_ID,
  account_status: i === 3 ? "ONBOARDING" : "ACTIVE",
  onboarding_status: i === 3 ? "IN_PROGRESS" : "APPROVED",
  compliance_status: i === 3 ? "PENDING" : "VALID",
  availability: i === 3 ? "OFFLINE" : i % 3 === 1 ? "ASSIGNED" : "AVAILABLE",
  availability_as_of: SNAPSHOT,
  current_vehicle: {
    id: id(i + 1, 6),
    code: i % 3 === 1 ? "TATA_ACE" : "BIKE",
    name: i % 3 === 1 ? "Mini truck" : "Bike",
    registration_number: `KA 01 AB ${2184 + i}`,
  },
  rating: null,
  rating_count: null,
  created_at: "2026-09-01T04:30:00Z",
}));
const campaignNames = [
  "October delivery boost",
  "Made for your business",
  "Welcome to the road",
  "Extra mile rewards",
  "Weekend savings",
  "Business delivery days",
  "Refer a rider",
  "Evening delivery boost",
];
export type Store = {
  orders: Order[];
  customers: Row[];
  drivers: Row[];
  campaigns: Row[];
  coupons: Row[];
  brands: Row[];
  businessAccounts: Row[];
  brandCampaigns: Row[];
  enquiries: Row[];
  alerts: Row[];
  payouts: Row[];
  batches: Row[];
  previews: Row[];
  imports: Row[];
  exports: Row[];
  audit: Row[];
  assets: Row[];
  programs: Row[];
  claims: Row[];
  reviews: Row[];
  invitations: Row[];
  idempotency: Map<
    string,
    { fingerprint: string; body: unknown; status: number }
  >;
};
function createStore(): Store {
  return {
    orders: seedOrders({ seedCustomers, id, MARKET_ID, groups }),
    customers: structuredClone(seedCustomers),
    drivers: structuredClone(seedDrivers),
    campaigns: campaignNames.map((title, i) => ({
      id: id(i + 1, 11),
      title,
      description:
        i === 0 ? "₹40 fare discount with RYNO40" : "Illustrative campaign",
      audience: [2, 3, 6].includes(i) ? "DRIVER" : "CUSTOMER",
      format: i % 2 ? "TESTIMONIAL" : "HOME_BANNER",
      placement: [2, 3, 6].includes(i) ? "DRIVER_REWARDS" : "CUSTOMER_HOME",
      market_id: MARKET_ID,
      status: "LIVE",
      start_at: "2026-10-01T00:00:00+05:30",
      end_at: "2026-11-01T00:00:00+05:30",
      impressions: [84200, 32000, 4800, 4800, 18000, 22000, 8400, 10000][i],
      clicks: 640 + i * 25,
      version: 1,
      created_at: SNAPSHOT,
    })),
    coupons: [
      {
        id: id(1, 12),
        code: "RYNO40",
        title: "October delivery discount",
        description: "Mock flat discount — not a wallet cashback credit",
        discount_type: "FLAT",
        discount_value: "40.00",
        max_discount: null,
        min_fare: "199.00",
        vehicle_type_codes: null,
        valid_from: "2026-10-01T00:00:00+05:30",
        valid_until: "2026-11-01T00:00:00+05:30",
        max_uses_per_customer: 1,
        is_active: true,
        usage_count: 920,
      },
      {
        id: id(2, 12),
        code: "BUSINESS10",
        title: "Business discount",
        description: "Ten percent discount",
        discount_type: "PERCENT",
        discount_value: "10.00",
        max_discount: "150.00",
        min_fare: "199.00",
        vehicle_type_codes: null,
        valid_from: "2026-10-16T00:00:00+05:30",
        valid_until: "2026-11-01T00:00:00+05:30",
        max_uses_per_customer: 3,
        is_active: false,
        usage_count: 0,
      },
    ],
    brands: [
      {
        id: id(1, 13),
        display_name: "FreshMart",
        contact_name: "Priya S.",
        email: "priya@example.com",
        status: "ACTIVE",
      },
      {
        id: id(2, 13),
        display_name: "Chai Point",
        contact_name: "Arjun R.",
        email: "arjun@example.com",
        status: "ACTIVE",
      },
    ],
    businessAccounts: seedCustomers
      .filter((c) => c.customer_type === "BUSINESS")
      .map((c, i) => ({
        id: id(i + 1, 14),
        customer_id: c.id,
        display_name: c.display_name,
        account_code: ["FM-024", "BL-018", "NH-012"][i],
        location_count: [8, 3, 2][i],
        payment_terms: i === 1 ? "PREPAID" : "NET_15",
        status: "ACTIVE",
        version: 1,
      })),
    brandCampaigns: [
      {
        id: id(1, 15),
        brand_id: id(1, 13),
        title: "Fresh picks, delivered",
        placement: "CUSTOMER_HOME",
        start_at: "2026-10-01",
        end_at: "2026-10-31",
        booked_ad_value: "45000.00",
        currency: "INR",
        status: "LIVE",
      },
    ],
    enquiries: ["Priya Shah", "Karthik Rao", "Meera Nair"].map(
      (contact_name, i) => ({
        id: id(i + 1, 16),
        contact_name,
        phone_masked: `+91 98•••••${100 + i}`,
        email: `enquiry${i + 1}@example.com`,
        reason_code: [
          "B2B_EXPANSION",
          "FARE_CLARIFICATION",
          "DELIVERY_COVERAGE",
        ][i],
        message: [
          "Daily dispatch for 3 new stores",
          "Mini-truck quote for 12 km",
          "Weekend deliveries to Yelahanka",
        ][i],
        status: "NEW",
        market_id: MARKET_ID,
        owner_user_id: user.id,
        received_at: SNAPSHOT,
        created_at: SNAPSHOT,
      }),
    ),
    alerts: [
      {
        id: id(1, 17),
        alert_type: "IMPORT_REVIEW",
        severity: "WARNING",
        status: "OPEN",
        title: "Customer import needs review",
        details: { summary: "412 valid records · 8 errors" },
        occurrence_count: 1,
        created_at: SNAPSHOT,
        last_seen_at: SNAPSHOT,
      },
      {
        id: id(2, 17),
        alert_type: "PAYOUT_REVIEW",
        severity: "INFO",
        status: "OPEN",
        title: "Mock payout batch ready to review",
        details: { summary: "No real funds are transferred" },
        occurrence_count: 1,
        created_at: SNAPSHOT,
        last_seen_at: SNAPSHOT,
      },
    ],
    payouts: ["648000.00", "536800.00", "420000.00", "380000.00"].map(
      (net_amount, i) => ({
        id: id(i + 1, 18),
        payout_reference: `PB-2610${12 - i * 2}`,
        driver_id: id(i + 1, 5),
        cadence: "MANUAL",
        period_start: "2026-10-01T00:00:00+05:30",
        period_end: `2026-10-${String(12 - i * 2).padStart(2, "0")}T18:00:00+05:30`,
        net_amount,
        currency: "INR",
        status: "PAID",
        paid_at: `2026-10-${String(12 - i * 2).padStart(2, "0")}T12:34:00Z`,
        provider_reference: `MOCK-UTR-${i + 1}`,
        created_at: SNAPSHOT,
      }),
    ),
    batches: [],
    previews: [],
    imports: [],
    exports: [],
    audit: [],
    assets: [
      {
        id: id(1, 19),
        name: "October delivery scooter",
        url: "/delivery-scooter.png",
        content_type: "image/png",
        created_at: SNAPSHOT,
      },
    ],
    programs: [
      {
        id: id(1, 20),
        code: "EXTRAMILE",
        title: "Extra mile rewards",
        reward_amount: "80.00",
        currency: "INR",
        required_rides: 12,
        status: "DRAFT",
        claims_count: 0,
      },
    ],
    claims: [],
    reviews: [],
    invitations: [],
    idempotency: new Map(),
  };
}
const runtime = globalThis as typeof globalThis & { rynoMockApiStore?: Store };
export function getStore(): Store {
  return (runtime.rynoMockApiStore ??= createStore());
}
