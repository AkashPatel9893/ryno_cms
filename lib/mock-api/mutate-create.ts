import { getStore, MARKET_ID } from "@/lib/mock-api/data";
import {
  amount,
  choice,
  fail,
  find,
  invalid,
  json,
  text,
} from "@/lib/mock-api/http";

import { insert, validateDates } from "@/lib/mock-api/shared";

export function mutateCreate(
  request: Request,
  path: string,
  b: Record<string, unknown>,
): Response | undefined {
  const store = getStore();
  if (path === "admin/campaigns" && request.method === "POST") {
    validateDates(b, "start_at", "end_at");
    const title = text(b, "title", 1, 120),
      audience = choice(b, "audience", ["CUSTOMER", "DRIVER"]),
      format = choice(
        b,
        "format",
        ["HOME_BANNER", "TESTIMONIAL", "POPUP", "INCENTIVE"],
        "HOME_BANNER",
      );
    return json(
      insert(store.campaigns, {
        title,
        description: typeof b.description === "string" ? b.description : "",
        audience,
        format,
        placement: audience === "CUSTOMER" ? "CUSTOMER_HOME" : "DRIVER_REWARDS",
        market_id: MARKET_ID,
        status: "DRAFT",
        start_at: b.start_at || null,
        end_at: b.end_at || null,
        impressions: 0,
        clicks: 0,
        version: 1,
      }),
      201,
    );
  }
  if (path === "admin/coupons" && request.method === "POST") {
    validateDates(b, "valid_from", "valid_until");
    const code = text(b, "code", 3, 32).toUpperCase();
    if (!/^[A-Z0-9_-]+$/.test(code)) invalid("Invalid coupon code");
    if (store.coupons.some((c) => c.code === code))
      fail(409, "COUPON_CODE_TAKEN", "Coupon code already exists");
    const kind = choice(b, "discount_type", ["FLAT", "PERCENT"]),
      value = amount(b.discount_value, "discount_value");
    if (kind === "PERCENT" && Number(value) > 100)
      invalid("Percent discount cannot exceed 100");
    return json(
      insert(store.coupons, {
        code,
        title: text(b, "title", 1, 120),
        description: text(b, "description", 1, 255),
        discount_type: kind,
        discount_value: value,
        max_discount:
          b.max_discount == null
            ? null
            : amount(b.max_discount, "max_discount"),
        min_fare:
          b.min_fare == null ? null : amount(b.min_fare, "min_fare", true),
        vehicle_type_codes: b.vehicle_type_codes || null,
        valid_from: b.valid_from || null,
        valid_until: b.valid_until || null,
        max_uses_per_customer: b.max_uses_per_customer || null,
        is_active: true,
        usage_count: 0,
      }),
      201,
    );
  }
  if (path === "admin/driver-invitations") {
    const name = text(b, "name", 1, 160),
      phone = text(b, "phone", 6, 20);
    if (!/^\+\d{6,15}$/.test(phone)) invalid("phone must use E.164 format");
    return json(
      insert(store.invitations, {
        name,
        phone_masked: phone.slice(0, 5) + "••••" + phone.slice(-3),
        market_id: MARKET_ID,
        status: "PENDING",
        notice:
          "Mock invitation only; no SMS/email sent and no approved driver created",
      }),
      201,
    );
  }
  if (path === "admin/business-accounts" && request.method === "POST") {
    const customer = find(store.customers, text(b, "customer_id"));
    if (customer.customer_type !== "BUSINESS")
      invalid("customer_id must reference a BUSINESS customer");
    return json(
      insert(store.businessAccounts, {
        customer_id: customer.id,
        display_name: text(b, "display_name", 1, 160),
        account_code: text(b, "account_code", 1, 32),
        payment_terms: choice(
          b,
          "payment_terms",
          ["PREPAID", "NET_15", "NET_30"],
          "PREPAID",
        ),
        status: "ACTIVE",
        location_count: 0,
        version: 1,
      }),
      201,
    );
  }
  if (path === "admin/brands" && request.method === "POST")
    return json(
      insert(store.brands, {
        display_name: text(b, "display_name", 1, 160),
        contact_name: text(b, "contact_name", 1, 160),
        email: text(b, "email", 3, 254),
        status: "ACTIVE",
      }),
      201,
    );
  if (path === "admin/brand-campaigns" && request.method === "POST") {
    find(store.brands, text(b, "brand_id"));
    return json(
      insert(store.brandCampaigns, {
        brand_id: b.brand_id,
        title: text(b, "title", 1, 120),
        booked_ad_value: amount(b.booked_ad_value, "booked_ad_value"),
        currency: "INR",
        placement: text(b, "placement"),
        start_at: b.start_at || null,
        end_at: b.end_at || null,
        status: "DRAFT",
      }),
      201,
    );
  }
  if (path === "admin/incentive-programs" && request.method === "POST")
    return json(
      insert(store.programs, {
        code: text(b, "code", 3, 32),
        title: text(b, "title", 1, 120),
        reward_amount: amount(b.reward_amount, "reward_amount"),
        currency: "INR",
        status: "DRAFT",
        claims_count: 0,
        notice: "No rewards are credited by this mock API",
      }),
      201,
    );
}
