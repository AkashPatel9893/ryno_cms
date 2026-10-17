# Ryno CMS — complete backend API handoff

Reviewed: 17 October 2026. Backend source commit: `cc9844590f28240c14c85489c032b3e9be5938cb`.

This is the single CMS backend handoff: all eight screens, required API endpoints, query/body inputs, response shapes, fake examples, existing backend schemas, missing data models and integration work. It replaces the previous CMS API/reference/checklist/mock/design/product documentation. Repository instruction files and documentation belonging to sibling mobile/backend projects are preserved.

**Status:** EXISTING means registered in the inspected FastAPI source, not runtime-tested. NEW means the CMS mock implements it but FastAPI still needs it. MOCK ONLY marks local discovery tooling. New API examples describe current browser expectations; existing source contracts remain authoritative and differences are called out below. All sample contacts/IDs/data are illustrative. No backend database, migration or provider operation was executed.

## Contents

1. Shared transport, query, pagination, errors and permissions
2. Required endpoint catalog with fake request/response data
3. Detailed backend requirements and domain rules
4. Mock workflows, uploads, exports and local testing
5. Exact existing backend route and DTO declarations
6. Production integration decisions and acceptance

## 1. Shared contract

Base path `/api/v1`; local mock `http://127.0.0.1:3000/api/v1`. Configure the real backend hostname at integration. Protected calls send `Authorization: Bearer <access_token>`. JSON writes send `Content-Type: application/json`; uploads use multipart/form-data and a generated boundary. GET has no body. Path IDs are UUIDs, never display references such as RY-10482.

Keep snake_case, existing bare-resource/array responses, Decimal money strings and timezone-aware timestamps. Do not add a global success wrapper. New aggregates use the explicit scope/data envelope; new lists use the Page envelope below. Fields shown as null are nullable; zero is a measured zero, not unavailable data. Currency is required for monetary values. Server-owned IDs, actor, state, counters and timestamps are not editable inputs.

### Query sets used in the catalog

| Set | Inputs and rules |
|---|---|
| S: reporting scope | market_id?:UUID; from?:YYYY-MM-DD; to?:YYYY-MM-DD. Inclusive local dates, authorized market. Mock defaults2026-10-01..2026-10-14, rejects reversed/invalid dates and spans over366 days. Production defaults must be agreed and echoed. |
| L: list | q?:string case-insensitive search; limit?:integer1..200 default 50; cursor?:opaque token from previous page. Reset cursor after filters change. Production search must use allowlisted authorized fields, not arbitrary serialized data. |
| O: order filters | status?:raw enum OR status_group?:UNASSIGNED/CONFIRMED/ACTIVE/DELIVERED/CANCELLED/FAILED (mutually exclusive); customer_type?:INDIVIDUAL/BUSINESS; payment_method_type?:CASH/UPI/CARD/NETBANKING/WALLET; payment_timing?:PRE_DISPATCH/POST_DELIVERY. |

Apply a set only where named. Current registry counts and wallets are snapshot reads, not historical reconstructions just because a page carries dates. Use zone-aware conversion from local dates to a UTC half-open interval. Bind cursors to filters/order and use deterministic keyset sorting; do not derive global totals from one page.

Page<T> (items contain the endpoint-specific resource):

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

Aggregate<T> (data has the endpoint-specific shape):

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {}
}
```

Common errors:400 malformed JSON,401 session,403 permission,404 absent/inaccessible resource,405 unsupported method,409 state/version/idempotency conflict,413 oversized file,422 validation,429 rate limit,503 dependency failure. Real validation errors have details.errors entries containing loc/msg/type. Mock often uses empty details. Do not leak PII or secrets in errors.

```json
{
  "code": "VERSION_CONFLICT",
  "message": "Resource changed; reload it before updating",
  "details": {
    "expected_version": 2,
    "actual_version": 3
  }
}
```

Idempotency-Key is required for export creation, import commit and payout confirmation; existing refunds also require it. Mock keys4..128 characters, scoped by method/path, compare exact serialized JSON and only persist within one process. Production needs durable atomic actor-scoped records and canonical body fingerprints. Same request/key returns original resource/status; changed body returns409. Existing payout-run does not declare idempotency. Versioned edits reject stale versions; reason is audit input.

Existing permissions: orders.manage, dispatch.manage, kyc.review, drivers.manage, vehicles.manage, pricing.manage, payments.read, payments.refund, payouts.manage, alerts.manage, audit.read, support.manage. Proposed new grants to seed: analytics.read (dashboard/analytics), reports.read (statements/reviews), customers.manage (customer registry), partners.manage (business/brands), marketing.manage (campaign/media/rewards), data.import and data.export. New driver registry/invitations use drivers.manage; existing coupons retain pricing.manage; order register/actions retain orders.manage. Settlement/payout reads/actions use payouts.manage. Workspace read grant and per-admin market scopes need an agreed policy; do not require pricing write access merely to select a city. Every admin route requires ADMIN and server-side permission checks.

## 2. Complete CMS endpoint catalog

Each endpoint below specifies method/path, source status, query/body and a response example. Arrays in examples are shortened to the first item while original total_count metadata is preserved: these illustrate shape, not a complete page. NEW does not mean deployed in FastAPI. No body for GET. UUID path parameters are required. Default GET success200, create201 unless stated, update/action200, no-content204; exact existing declarations appear in section5.

### 2.1 `GET /api/v1` — MOCK ONLY

Public endpoint index.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "name": "Ryno CMS mock API",
  "mock": true,
  "base_url": "/api/v1",
  "authentication": "Bearer mock-admin-token",
  "snapshot": "2026-10-14T09:00:00Z",
  "notice": "Illustrative in-memory data. No connection to FastAPI, database, SMS, bank, or payment provider. State resets on process restart. CMS screens use this mock API.",
  "endpoints": [
    {
      "method": "GET",
      "path": "/api/v1",
      "description": "Public endpoint index"
    }
  ]
}
```

### 2.2 `POST /api/v1/auth/otp/request` — EXISTING

Mock OTP 000000; no SMS.

Source: `backend/app/modules/auth/router.py:29`. Existing DTO/permission dependencies: section5.

**Success:** 202. phone and app_type required; mock code `000000` is never sent by SMS. Real response must not expose demo_code. ADMIN must be pre-provisioned.

**Request JSON:**

```json
{
  "phone": "+919900000001",
  "app_type": "ADMIN"
}
```

**Response example:**

```json
{
  "phone_masked": "+91 99•••••001",
  "expires_in_seconds": 300,
  "mock": true,
  "demo_code": "000000"
}
```

### 2.3 `POST /api/v1/auth/otp/verify` — EXISTING

Get mock bearer token.

Source: `backend/app/modules/auth/router.py:35`. Existing DTO/permission dependencies: section5.

**Success:** 200. Real body requires device (mock ignores it): device_uuid4..128, platform WEB, app_version optional, push_token optional <=512. Actual production OTP required; mock000000 is not an auth implementation.

**Request JSON:**

```json
{
  "phone": "+919900000001",
  "app_type": "ADMIN",
  "code": "000000",
  "device": {
    "device_uuid": "cms-browser-installation-001",
    "platform": "WEB",
    "app_version": "0.1.0"
  }
}
```

**Response example:**

```json
{
  "access_token": "mock-admin-token",
  "refresh_token": "mock-refresh-token-for-demo-only",
  "token_type": "bearer",
  "expires_in_seconds": 86400,
  "is_new_user": false,
  "user": {
    "id": "00000001-0000-4000-8000-000000000001",
    "user_type": "ADMIN",
    "status": "ACTIVE",
    "phone": "+919900000001",
    "phone_masked": "+91 99•••••001",
    "email": "ananya@example.com",
    "email_verified": true,
    "name": "Ananya K.",
    "profile_complete": true
  }
}
```

### 2.4 `POST /api/v1/auth/refresh` — EXISTING

Mock token refresh.

Source: `backend/app/modules/auth/router.py:45`. Existing DTO/permission dependencies: section5.

**Success:** 200.

**Request JSON:**

```json
{
  "refresh_token": "mock-refresh-token-for-demo-only"
}
```

**Response example:**

```json
{
  "access_token": "mock-admin-token",
  "refresh_token": "mock-refresh-token-for-demo-only",
  "token_type": "bearer",
  "expires_in_seconds": 86400,
  "is_new_user": false,
  "user": {
    "id": "00000001-0000-4000-8000-000000000001",
    "user_type": "ADMIN",
    "status": "ACTIVE",
    "phone": "+919900000001",
    "phone_masked": "+91 99•••••001",
    "email": "ananya@example.com",
    "email_verified": true,
    "name": "Ananya K.",
    "profile_complete": true
  }
}
```

### 2.5 `POST /api/v1/auth/logout` — EXISTING

No-op logout.

Source: `backend/app/modules/auth/router.py:53`. Existing DTO/permission dependencies: section5.

**Success:** 204. 204 empty body. Mock is a no-op; real backend revokes session(s).

**Request JSON:**

```json
{
  "all_sessions": false
}
```

**Response:** empty body; do not parse JSON.

### 2.6 `GET /api/v1/auth/me` — EXISTING

Mock admin.

Source: `backend/app/modules/auth/router.py:68`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000001-0000-4000-8000-000000000001",
  "user_type": "ADMIN",
  "status": "ACTIVE",
  "phone": "+919900000001",
  "phone_masked": "+91 99•••••001",
  "email": "ananya@example.com",
  "email_verified": true,
  "name": "Ananya K.",
  "profile_complete": true
}
```

### 2.7 `GET /api/v1/admin/workspace` — NEW

User, roles, permissions, markets.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "user": {
    "id": "00000001-0000-4000-8000-000000000001",
    "user_type": "ADMIN",
    "status": "ACTIVE",
    "phone": "+919900000001",
    "phone_masked": "+91 99•••••001",
    "email": "ananya@example.com",
    "email_verified": true,
    "name": "Ananya K.",
    "profile_complete": true
  },
  "roles": [
    "MOCK_ADMIN"
  ],
  "permissions": [
    "orders.manage"
  ],
  "markets": [
    {
      "id": "11111111-1111-4111-8111-111111111111",
      "code": "BLR",
      "name": "Bengaluru",
      "state": "Karnataka",
      "country_code": "IN",
      "timezone": "Asia/Kolkata",
      "currency": "INR",
      "is_active": true
    }
  ],
  "selected_market_id": "11111111-1111-4111-8111-111111111111",
  "server_time": "2026-10-14T09:00:00Z",
  "mock": true
}
```

### 2.8 `GET /api/v1/admin/markets` — EXISTING

Mock markets.

Source: `backend/app/modules/geography/router.py:152`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[
  {
    "id": "11111111-1111-4111-8111-111111111111",
    "code": "BLR",
    "name": "Bengaluru",
    "state": "Karnataka",
    "country_code": "IN",
    "timezone": "Asia/Kolkata",
    "currency": "INR",
    "is_active": true
  }
]
```

### 2.9 `GET /api/v1/admin/markets/{market_id}/zones` — NEW

Mock zones.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[
  {
    "id": "00000010-0000-4000-8000-000000000001",
    "market_id": "11111111-1111-4111-8111-111111111111",
    "name": "Koramangala",
    "zone_type": "SERVICEABLE",
    "priority": 0,
    "is_active": true
  }
]
```

### 2.10 `GET /api/v1/vehicle-types` — EXISTING

Vehicle catalog.

Source: `backend/app/modules/geography/router.py:68`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[
  {
    "id": "00000004-0000-4000-8000-000000000001",
    "code": "BIKE",
    "name": "2 Wheeler",
    "category": "TWO_WHEELER",
    "payload_capacity_kg": "20.00"
  }
]
```

### 2.11 `GET /api/v1/admin/dashboard` — NEW

Calculated dashboard.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "gross_fare_revenue": "2856000.00",
    "today_date": "2026-10-14",
    "today_gross_fare_revenue": "204000.00",
    "revenue_change_percent": null,
    "bookings_count": 12480,
    "today_bookings_count": 960,
    "counts_by_group": {
      "UNASSIGNED": 200,
      "CONFIRMED": 280,
      "ACTIVE": 320,
      "DELIVERED": 11200,
      "CANCELLED": 480,
      "FAILED": 0
    },
    "today_counts_by_group": {
      "UNASSIGNED": 24,
      "CONFIRMED": 40,
      "ACTIVE": 64,
      "DELIVERED": 800,
      "CANCELLED": 32,
      "FAILED": 0
    },
    "bookings_by_customer_type": {
      "INDIVIDUAL": 7131,
      "BUSINESS": 5349
    },
    "revenue_series": [
      {
        "date": "2026-10-01",
        "amount": "204000.00",
        "bookings_count": 888,
        "comparison_amount": null
      }
    ],
    "rides_by_customer_type_and_group": [
      {
        "status_group": "UNASSIGNED",
        "individual_count": 114,
        "business_count": 86
      }
    ],
    "open_web_enquiries_count": 3
  }
}
```

### 2.12 `GET /api/v1/admin/order-register` — NEW

Paginated enriched orders.

**Query:** S + O + q + limit,cursor. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000002-0000-4000-8000-000000000959",
      "order_number": "RY-9524",
      "market_id": "11111111-1111-4111-8111-111111111111",
      "status": "CANCELLED",
      "status_group": "CANCELLED",
      "created_at": "2026-10-14T07:59:00Z",
      "completed_at": null,
      "customer": {
        "id": "00000003-0000-4000-8000-000000000001",
        "customer_number": "CUS-0001",
        "display_name": "Aarav Mehta",
        "customer_type": "INDIVIDUAL",
        "phone_masked": "+91 98•••••220"
      },
      "route": {
        "pickup_label": "Koramangala",
        "drop_label": "Bellandur",
        "stop_count": 2
      },
      "vehicle_type": {
        "id": "00000004-0000-4000-8000-000000000001",
        "code": "BIKE",
        "name": "2 Wheeler"
      },
      "fare": {
        "quoted_amount": "255.00",
        "final_amount": null,
        "currency": "INR"
      },
      "payment": {
        "payment_id": "00000007-0000-4000-8000-000000000959",
        "method": "CASH",
        "timing": "POST_DELIVERY",
        "status": "PENDING",
        "gateway_status": "CANCELLED",
        "paid_at": null,
        "refunded_amount": "0.00"
      },
      "assigned_driver_id": null
    }
  ],
  "next_cursor": "eyJhZnRlciI6IjAwMDAwMDAyLTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDg4NyIsImJpbmRpbmciOiJlM2IwYzQ0Mjk4ZmMxYzE0In0",
  "total_count": 12480,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.13 `GET /api/v1/admin/order-register/summary` — NEW

Filtered counts.

**Query:** S + O + q (no pagination). **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "total_count": 12480,
  "counts_by_group": {
    "UNASSIGNED": 200,
    "CONFIRMED": 280,
    "ACTIVE": 320,
    "DELIVERED": 11200,
    "CANCELLED": 480,
    "FAILED": 0
  },
  "counts_by_status": {
    "CANCELLED": 480,
    "DRIVER_ASSIGNED": 280,
    "PICKED_UP": 320,
    "DELIVERED": 11200,
    "SEARCHING_DRIVER": 200
  },
  "delivered_count": 11200,
  "in_progress_count": 800,
  "cancelled_count": 480,
  "failed_count": 0,
  "cancellation_rate_percent": 3.85
}
```

### 2.14 `GET /api/v1/admin/orders` — EXISTING

Legacy-style order summary array.

Source: `backend/app/modules/admin/router.py:111`. Existing DTO/permission dependencies: section5.

**Query:** Real: status?:string, market_id?:UUID, limit?:integer1..200 default 50. **Body:** none. **Success:** 200. Bare OrderSummary[]. Mock extra filters are not an existing guarantee.

**Response example:**

```json
[
  {
    "id": "00000002-0000-4000-8000-000000000959",
    "order_number": "RY-9524",
    "status": "CANCELLED",
    "quoted_amount": "255.00",
    "final_amount": null,
    "currency": "INR",
    "created_at": "2026-10-14T07:59:00Z"
  }
]
```

### 2.15 `GET /api/v1/admin/orders/{id}` — EXISTING

Order detail.

Source: `backend/app/modules/admin/router.py:127`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "order": {
    "id": "00000002-0000-4000-8000-000000000001",
    "order_number": "RY-10482",
    "market_id": "11111111-1111-4111-8111-111111111111",
    "status": "DELIVERED",
    "status_group": "DELIVERED",
    "created_at": "2026-10-14T05:01:00Z",
    "completed_at": "2026-10-14T05:01:00Z",
    "customer": {
      "id": "00000003-0000-4000-8000-000000000001",
      "customer_number": "CUS-0001",
      "display_name": "Aarav Mehta",
      "customer_type": "INDIVIDUAL",
      "phone_masked": "+91 98•••••220"
    },
    "route": {
      "pickup_label": "Whitefield",
      "drop_label": "HSR Layout",
      "stop_count": 2
    },
    "vehicle_type": {
      "id": "00000004-0000-4000-8000-000000000002",
      "code": "TATA_ACE",
      "name": "Mini truck"
    },
    "fare": {
      "quoted_amount": "280.00",
      "final_amount": "280.00",
      "currency": "INR"
    },
    "payment": {
      "payment_id": "00000007-0000-4000-8000-000000000001",
      "method": "CARD",
      "timing": "PRE_DISPATCH",
      "status": "PAID",
      "gateway_status": "SUCCESS",
      "paid_at": "2026-10-14T05:01:00Z",
      "refunded_amount": "0.00"
    },
    "assigned_driver_id": "00000005-0000-4000-8000-000000000002",
    "quoted_amount": "280.00",
    "final_amount": "280.00",
    "currency": "INR",
    "payment_timing": "PRE_DISPATCH",
    "assigned_vehicle_id": null,
    "active_trip_id": null,
    "stops": [
      {
        "sequence_number": 1,
        "stop_type": "PICKUP",
        "address_line_1": "Whitefield"
      }
    ],
    "items": [
      {
        "description": "Mock delivery parcel",
        "quantity": 1,
        "category": "PARCEL"
      }
    ]
  },
  "history": [
    {
      "from_status": null,
      "to_status": "DELIVERED",
      "actor_type": "SYSTEM",
      "reason": "Mock seed",
      "created_at": "2026-10-14T05:01:00Z"
    }
  ],
  "assignments": [
    {
      "driver_id": "00000005-0000-4000-8000-000000000002",
      "status": "ACTIVE",
      "source": "MOCK"
    }
  ],
  "trips": [],
  "payments": [
    {
      "id": "00000007-0000-4000-8000-000000000001",
      "purpose": "ORDER_PREPAYMENT",
      "status": "SUCCESS",
      "amount": "280.00",
      "refunded_amount": "0.00"
    }
  ]
}
```

### 2.16 `GET /api/v1/admin/active-trips` — EXISTING

Synthetic trip projections.

Source: `backend/app/modules/admin/router.py:163`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200. Real bare unpaginated TripView[]; mock synthesizes trip-like projections. Query real trips in production.

**Response example:**

```json
[
  {
    "id": "00000002-0000-4000-8000-000000000002",
    "trip_number": "TRIP-RY-10481",
    "order_id": "00000002-0000-4000-8000-000000000002",
    "driver_id": "00000005-0000-4000-8000-000000000003",
    "status": "PICKED_UP",
    "attempt_number": 1,
    "created_at": "2026-10-14T06:02:00Z"
  }
]
```

### 2.17 `POST /api/v1/admin/orders/{id}/cancel` — EXISTING

Simulated order action.

Source: `backend/app/modules/admin/router.py:170`. Existing DTO/permission dependencies: section5.

**Success:** 204. Cancel: reason_code2..64 required, note<=1000 optional. Assign: driver_id UUID required; reassign allows null to release; reason3..500 required. Reject terminal/invalid states409; real domain eligibility, vehicle and row-lock rules apply.

**Request JSON:**

```json
{
  "reason_code": "CUSTOMER_REQUEST",
  "note": "Customer requested cancellation"
}
```

**Response:** empty body; do not parse JSON.

### 2.18 `POST /api/v1/admin/orders/{id}/assign` — EXISTING

Simulated order action.

Source: `backend/app/modules/admin/router.py:183`. Existing DTO/permission dependencies: section5.

**Success:** 200. Cancel: reason_code2..64 required, note<=1000 optional. Assign: driver_id UUID required; reassign allows null to release; reason3..500 required. Reject terminal/invalid states409; real domain eligibility, vehicle and row-lock rules apply.

**Request JSON:**

```json
{
  "driver_id": "00000005-0000-4000-8000-000000000001",
  "reason": "Manual dispatch correction"
}
```

**Response example:**

```json
{
  "id": "00000096-0000-4000-8000-000000000001",
  "driver_id": "00000005-0000-4000-8000-000000000001",
  "vehicle_id": "00000006-0000-4000-8000-000000000001",
  "source": "ADMIN",
  "status": "ACTIVE",
  "assigned_at": "2026-10-14T09:00:00Z",
  "release_reason": null
}
```

### 2.19 `POST /api/v1/admin/orders/{id}/reassign` — EXISTING

Simulated order action.

Source: `backend/app/modules/admin/router.py:197`. Existing DTO/permission dependencies: section5.

**Success:** 200. Cancel: reason_code2..64 required, note<=1000 optional. Assign: driver_id UUID required; reassign allows null to release; reason3..500 required. Reject terminal/invalid states409; real domain eligibility, vehicle and row-lock rules apply. Release response is JSON null; assigning a driver returns AssignmentView as above.

**Request JSON:**

```json
{
  "driver_id": null,
  "reason": "Manual dispatch correction"
}
```

### 2.20 `GET /api/v1/admin/partners/summary` — NEW

Partner counts.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "registered_riders": 96,
    "registered_customers": 7,
    "live_b2b_partners": 3,
    "advertising_brands": 2,
    "online_riders": 63,
    "on_delivery_riders": 32
  }
}
```

### 2.21 `GET /api/v1/admin/reports/statement` — NEW

Period statement.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "mtd_period": {
      "from_date": "2026-10-01",
      "to_date": "2026-10-14"
    },
    "ytd_period": null,
    "reconciled_at": null,
    "rows": [
      {
        "measure": "total_bookings",
        "label": "Total bookings",
        "value": 12480,
        "unit": "COUNT",
        "audit_basis": "Order created_at"
      }
    ],
    "coverage": {
      "ytd": "NOT_SEEDED",
      "finance_reconciliation": "NOT_CHECKED"
    }
  }
}
```

### 2.22 `GET /api/v1/admin/reports/reconciliation` — NEW

NOT_CHECKED mock controls.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "status": "NOT_CHECKED",
    "checked_at": null,
    "controls": [
      {
        "name": "Gateway collections",
        "status": "NOT_CHECKED",
        "expected_amount": null,
        "observed_amount": null,
        "difference": null,
        "reason": "Mock API does not ingest bank or gateway statements"
      }
    ]
  }
}
```

### 2.23 `POST /api/v1/admin/reports/reviews` — NEW

Record mock finance review.

**Success:** 201. All shown inputs required; reason3..500. Validate authorized date scope. A review does not prove reconciliation.

**Request JSON:**

```json
{
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "note": "Bank evidence still pending",
  "reason": "Monthly finance review"
}
```

**Response example:**

```json
{
  "id": "00000097-0000-4000-8000-000000000001",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "note": "Bank evidence still pending",
  "reason": "Monthly finance review",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "reviewed_by": "00000001-0000-4000-8000-000000000001",
  "reviewed_at": "2026-10-14T09:00:00Z",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.24 `GET /api/v1/admin/analytics/overview` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "gross_fare_revenue": "2856000.00",
    "bookings_count": 12480,
    "revenue_change_percent": null,
    "average_rating": null,
    "on_time_rate_percent": null,
    "coverage": {
      "ratings": "NOT_SEEDED",
      "on_time": "NO_SLA_TARGET"
    }
  }
}
```

### 2.25 `GET /api/v1/admin/analytics/revenue` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "series": [
      {
        "date": "2026-10-01",
        "amount": "204000.00",
        "bookings_count": 888,
        "comparison_amount": null
      }
    ],
    "total": "2856000.00"
  }
}
```

### 2.26 `GET /api/v1/admin/analytics/demand` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "series": [
      {
        "date": "2026-10-01",
        "bookings_count": 888
      }
    ],
    "peak": {
      "date": "2026-10-14",
      "amount": "204000.00",
      "bookings_count": 960,
      "comparison_amount": null
    }
  }
}
```

### 2.27 `GET /api/v1/admin/analytics/customers` — NEW

Mock analytics.

**Query:** S + L. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "items": [
      {
        "id": "00000003-0000-4000-8000-000000000006",
        "customer_number": "CUS-0006",
        "display_name": "Nest Home",
        "customer_type": "BUSINESS",
        "status": "ACTIVE",
        "phone_masked": "+91 98•••••225",
        "email": "customer6@example.com",
        "default_currency": "INR",
        "created_at": "2026-09-01T04:30:00Z",
        "period_delivered_count": 1601,
        "period_fare_revenue": "408760.00",
        "currency": "INR",
        "revenue_rank": 1
      }
    ],
    "next_cursor": null,
    "total_count": 7,
    "as_of": "2026-10-14T09:00:00Z"
  }
}
```

### 2.28 `GET /api/v1/admin/analytics/drivers` — NEW

Mock analytics.

**Query:** S + L. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "items": [
      {
        "id": "00000005-0000-4000-8000-000000000002",
        "driver_number": "RD-002",
        "first_name": "Suresh",
        "last_name": "Gowda",
        "phone_masked": "+91 98•••••302",
        "primary_market_id": "11111111-1111-4111-8111-111111111111",
        "account_status": "ACTIVE",
        "onboarding_status": "APPROVED",
        "compliance_status": "VALID",
        "availability": "ASSIGNED",
        "availability_as_of": "2026-10-14T09:00:00Z",
        "current_vehicle": {
          "id": "00000006-0000-4000-8000-000000000002",
          "code": "TATA_ACE",
          "name": "Mini truck",
          "registration_number": "KA 01 AB 2185"
        },
        "rating": null,
        "rating_count": null,
        "created_at": "2026-09-01T04:30:00Z",
        "period_delivered_count": 3734,
        "period_fare_revenue": "952009.00",
        "currency": "INR",
        "on_time_rate_percent": null,
        "rejected_offers_count": 0
      }
    ],
    "next_cursor": "eyJhZnRlciI6IjAwMDAwMDA1LTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDA1MCIsImJpbmRpbmciOiJlM2IwYzQ0Mjk4ZmMxYzE0In0",
    "total_count": 96,
    "as_of": "2026-10-14T09:00:00Z"
  }
}
```

### 2.29 `GET /api/v1/admin/analytics/areas` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "basis": "Seeded pickup labels; not production locality geometry",
    "items": [
      {
        "name": "Koramangala",
        "bookings_count": 2496,
        "share_percent": 20
      }
    ],
    "unclassified_count": 0
  }
}
```

### 2.30 `GET /api/v1/admin/analytics/ratings` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "items": [],
    "average_rating": null,
    "coverage": "NOT_SEEDED"
  }
}
```

### 2.31 `GET /api/v1/admin/analytics/cancellations` — NEW

Mock analytics.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "total": 480,
    "items": [
      {
        "actor_type": "CUSTOMER",
        "reason_code": "CHANGED_MIND",
        "count": 300
      }
    ],
    "basis": "Synthetic cancellation attribution, not stored production evidence"
  }
}
```

### 2.32 `GET /api/v1/admin/marketing/summary` — NEW

Campaign counters.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "live_campaigns": 8,
    "impressions": 184200,
    "coupon_redemptions": 920,
    "cashback_credited": "0.00",
    "incentives_credited": "0.00",
    "measurement_basis": "Illustrative campaign seed counters, not instrumented events"
  }
}
```

### 2.33 `GET /api/v1/admin/coupons/usage` — NEW

Illustrative coupon usage.

**Query:** L. **Body:** none. **Success:** 200. Production needs explicit reporting scope and actual applied/reversed redemption sums; mock counters are illustrative.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000012-0000-4000-8000-000000000001",
      "code": "RYNO40",
      "applied_count": 920,
      "reversed_count": 0,
      "discount_amount": "36800.00"
    }
  ],
  "next_cursor": null,
  "total_count": 2,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.34 `GET /api/v1/admin/settlements` — NEW

Wallet balance projections.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000005-0000-4000-8000-000000000001",
      "driver_id": "00000005-0000-4000-8000-000000000001",
      "driver_number": "RD-001",
      "name": "Ravi Kumar",
      "bank_account": {
        "bank_name": "HDFC",
        "account_number_last4": "4218",
        "verification_status": "VERIFIED"
      },
      "driver_wallet_balance": "5000.00",
      "eligible_withdrawable_amount": "5000.00",
      "currency": "INR",
      "due_date": null,
      "in_flight_payout_amount": "0.00",
      "status": "ELIGIBLE",
      "as_of": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": "eyJhZnRlciI6IjAwMDAwMDA1LTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDA1MSIsImJpbmRpbmciOiJlM2IwYzQ0Mjk4ZmMxYzE0In0",
  "total_count": 95,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.35 `GET /api/v1/admin/settlements/summary` — NEW

Settlement summary.

**Query:** S. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "data": {
    "driver_wallet_balance": "300000.00",
    "eligible_withdrawable_balance": "300000.00",
    "eligible_driver_count": 95,
    "paid_payouts_mtd": "1984800.00",
    "in_flight_payout_amount": "0.00",
    "due_today": null,
    "next_run_at": null,
    "basis": "Illustrative current wallet balances; not MTD earnings minus payouts"
  }
}
```

### 2.36 `GET /api/v1/admin/campaigns` — NEW

Resource list.

**Query:** L; exact filters audience,status,format,market_id. **Body:** none. **Success:** 200. Required title1..120 and audience CUSTOMER|DRIVER; format optional default HOME_BANNER, enum HOME_BANNER|TESTIMONIAL|POPUP|INCENTIVE; description optional; start_at/end_at optional for draft, ordered and required before publish. Response DRAFT version1, zero counters. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000011-0000-4000-8000-000000000001",
      "title": "October delivery boost",
      "description": "₹40 fare discount with RYNO40",
      "audience": "CUSTOMER",
      "format": "HOME_BANNER",
      "placement": "CUSTOMER_HOME",
      "market_id": "11111111-1111-4111-8111-111111111111",
      "status": "LIVE",
      "start_at": "2026-10-01T00:00:00+05:30",
      "end_at": "2026-11-01T00:00:00+05:30",
      "impressions": 84200,
      "clicks": 640,
      "version": 1,
      "created_at": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 8,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.37 `GET /api/v1/admin/campaigns/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000011-0000-4000-8000-000000000001",
  "title": "October delivery boost",
  "description": "₹40 fare discount with RYNO40",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "placement": "CUSTOMER_HOME",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "LIVE",
  "start_at": "2026-10-01T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "impressions": 84200,
  "clicks": 640,
  "version": 1,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.38 `GET /api/v1/admin/coupons` — EXISTING

Resource list.

Source: `backend/app/modules/coupon/router.py:123`. Existing DTO/permission dependencies: section5.

**Query:** L; exact filters none (existing bare array). **Body:** none. **Success:** 200. Required code3..32 uppercase alphanumeric/_/-, title1..120, description1..255, discount_type FLAT|PERCENT, positive discount_value; percent <=100. Other fields optional/nullable; max_discount>0, min_fare>=0, max_uses_per_customer>=1; ordered validity; duplicate 409. Fare discount, not cashback. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
[
  {
    "id": "00000012-0000-4000-8000-000000000001",
    "code": "RYNO40",
    "title": "October delivery discount",
    "description": "Mock flat discount — not a wallet cashback credit",
    "discount_type": "FLAT",
    "discount_value": "40.00",
    "max_discount": null,
    "min_fare": "199.00",
    "vehicle_type_codes": null,
    "valid_from": "2026-10-01T00:00:00+05:30",
    "valid_until": "2026-11-01T00:00:00+05:30",
    "max_uses_per_customer": 1,
    "is_active": true,
    "usage_count": 920
  }
]
```

### 2.39 `GET /api/v1/admin/coupons/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000012-0000-4000-8000-000000000001",
  "code": "RYNO40",
  "title": "October delivery discount",
  "description": "Mock flat discount — not a wallet cashback credit",
  "discount_type": "FLAT",
  "discount_value": "40.00",
  "max_discount": null,
  "min_fare": "199.00",
  "vehicle_type_codes": null,
  "valid_from": "2026-10-01T00:00:00+05:30",
  "valid_until": "2026-11-01T00:00:00+05:30",
  "max_uses_per_customer": 1,
  "is_active": true,
  "usage_count": 920
}
```

### 2.40 `GET /api/v1/admin/drivers` — NEW

Resource list.

**Query:** L; exact filters account_status,onboarding_status,compliance_status,availability; S for period activity. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000005-0000-4000-8000-000000000001",
      "driver_number": "RD-001",
      "first_name": "Ravi",
      "last_name": "Kumar",
      "phone_masked": "+91 98•••••301",
      "primary_market_id": "11111111-1111-4111-8111-111111111111",
      "account_status": "ACTIVE",
      "onboarding_status": "APPROVED",
      "compliance_status": "VALID",
      "availability": "AVAILABLE",
      "availability_as_of": "2026-10-14T09:00:00Z",
      "current_vehicle": {
        "id": "00000006-0000-4000-8000-000000000001",
        "code": "BIKE",
        "name": "Bike",
        "registration_number": "KA 01 AB 2184"
      },
      "rating": null,
      "rating_count": null,
      "created_at": "2026-09-01T04:30:00Z",
      "period_delivered_count": 3733,
      "period_fare_revenue": "952248.00",
      "currency": "INR"
    }
  ],
  "next_cursor": "eyJhZnRlciI6IjAwMDAwMDA1LTAwMDAtNDAwMC04MDAwLTAwMDAwMDAwMDA1MCIsImJpbmRpbmciOiJlM2IwYzQ0Mjk4ZmMxYzE0In0",
  "total_count": 96,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.41 `GET /api/v1/admin/drivers/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000005-0000-4000-8000-000000000001",
  "driver_number": "RD-001",
  "first_name": "Ravi",
  "last_name": "Kumar",
  "phone_masked": "+91 98•••••301",
  "primary_market_id": "11111111-1111-4111-8111-111111111111",
  "account_status": "ACTIVE",
  "onboarding_status": "APPROVED",
  "compliance_status": "VALID",
  "availability": "AVAILABLE",
  "availability_as_of": "2026-10-14T09:00:00Z",
  "current_vehicle": {
    "id": "00000006-0000-4000-8000-000000000001",
    "code": "BIKE",
    "name": "Bike",
    "registration_number": "KA 01 AB 2184"
  },
  "rating": null,
  "rating_count": null,
  "created_at": "2026-09-01T04:30:00Z"
}
```

### 2.42 `GET /api/v1/admin/customers` — NEW

Resource list.

**Query:** L; exact filters customer_type,status; S for period activity. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000003-0000-4000-8000-000000000001",
      "customer_number": "CUS-0001",
      "display_name": "Aarav Mehta",
      "customer_type": "INDIVIDUAL",
      "status": "ACTIVE",
      "phone_masked": "+91 98•••••220",
      "email": "customer1@example.com",
      "default_currency": "INR",
      "created_at": "2026-09-01T04:30:00Z",
      "period_delivered_count": 1599,
      "period_fare_revenue": "407770.00",
      "currency": "INR"
    }
  ],
  "next_cursor": null,
  "total_count": 7,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.43 `GET /api/v1/admin/customers/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000003-0000-4000-8000-000000000001",
  "customer_number": "CUS-0001",
  "display_name": "Aarav Mehta",
  "customer_type": "INDIVIDUAL",
  "status": "ACTIVE",
  "phone_masked": "+91 98•••••220",
  "email": "customer1@example.com",
  "default_currency": "INR",
  "created_at": "2026-09-01T04:30:00Z"
}
```

### 2.44 `GET /api/v1/admin/business-accounts` — NEW

Resource list.

**Query:** L; exact filters status. **Body:** none. **Success:** 200. Required existing BUSINESS customer_id, display_name1..160, account_code1..32. payment_terms optional default PREPAID; PREPAID|NET_15|NET_30. Enforce production code uniqueness and commercial policy. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000014-0000-4000-8000-000000000001",
      "customer_id": "00000003-0000-4000-8000-000000000002",
      "display_name": "FreshMart",
      "account_code": "FM-024",
      "location_count": 8,
      "payment_terms": "NET_15",
      "status": "ACTIVE",
      "version": 1
    }
  ],
  "next_cursor": null,
  "total_count": 3,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.45 `GET /api/v1/admin/business-accounts/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000014-0000-4000-8000-000000000001",
  "customer_id": "00000003-0000-4000-8000-000000000002",
  "display_name": "FreshMart",
  "account_code": "FM-024",
  "location_count": 8,
  "payment_terms": "NET_15",
  "status": "ACTIVE",
  "version": 1
}
```

### 2.46 `GET /api/v1/admin/brands` — NEW

Resource list.

**Query:** L; exact filters status. **Body:** none. **Success:** 200. All three required; names1..160, email3..254; production validates normalized email. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000013-0000-4000-8000-000000000001",
      "display_name": "FreshMart",
      "contact_name": "Priya S.",
      "email": "priya@example.com",
      "status": "ACTIVE"
    }
  ],
  "next_cursor": null,
  "total_count": 2,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.47 `GET /api/v1/admin/brands/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000013-0000-4000-8000-000000000001",
  "display_name": "FreshMart",
  "contact_name": "Priya S.",
  "email": "priya@example.com",
  "status": "ACTIVE"
}
```

### 2.48 `GET /api/v1/admin/brand-campaigns` — NEW

Resource list.

**Query:** L; exact filters status,brand_id. **Body:** none. **Success:** 200. Required brand_id, title1..120, placement, positive booked_ad_value. Dates optional in mock; production validates ordered aware instants. Mock assigns INR. Contracted advertising value is not fare revenue. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000015-0000-4000-8000-000000000001",
      "brand_id": "00000013-0000-4000-8000-000000000001",
      "title": "Fresh picks, delivered",
      "placement": "CUSTOMER_HOME",
      "start_at": "2026-10-01",
      "end_at": "2026-10-31",
      "booked_ad_value": "45000.00",
      "currency": "INR",
      "status": "LIVE"
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.49 `GET /api/v1/admin/brand-campaigns/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000015-0000-4000-8000-000000000001",
  "brand_id": "00000013-0000-4000-8000-000000000001",
  "title": "Fresh picks, delivered",
  "placement": "CUSTOMER_HOME",
  "start_at": "2026-10-01",
  "end_at": "2026-10-31",
  "booked_ad_value": "45000.00",
  "currency": "INR",
  "status": "LIVE"
}
```

### 2.50 `GET /api/v1/admin/web-enquiries` — NEW

Resource list.

**Query:** L; exact filters status,owner_user_id. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000016-0000-4000-8000-000000000001",
      "contact_name": "Priya Shah",
      "phone_masked": "+91 98•••••100",
      "email": "enquiry1@example.com",
      "reason_code": "B2B_EXPANSION",
      "message": "Daily dispatch for 3 new stores",
      "status": "NEW",
      "market_id": "11111111-1111-4111-8111-111111111111",
      "owner_user_id": "00000001-0000-4000-8000-000000000001",
      "received_at": "2026-10-14T09:00:00Z",
      "created_at": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 3,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.51 `GET /api/v1/admin/web-enquiries/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000016-0000-4000-8000-000000000001",
  "contact_name": "Priya Shah",
  "phone_masked": "+91 98•••••100",
  "email": "enquiry1@example.com",
  "reason_code": "B2B_EXPANSION",
  "message": "Daily dispatch for 3 new stores",
  "status": "NEW",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "owner_user_id": "00000001-0000-4000-8000-000000000001",
  "received_at": "2026-10-14T09:00:00Z",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.52 `GET /api/v1/admin/alerts` — EXISTING

Resource list.

Source: `backend/app/modules/ops_alert/router.py:18`. Existing DTO/permission dependencies: section5.

**Query:** L; exact filters status. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000017-0000-4000-8000-000000000001",
      "alert_type": "IMPORT_REVIEW",
      "severity": "WARNING",
      "status": "OPEN",
      "title": "Customer import needs review",
      "details": {
        "summary": "412 valid records · 8 errors"
      },
      "occurrence_count": 1,
      "created_at": "2026-10-14T09:00:00Z",
      "last_seen_at": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 2,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.53 `GET /api/v1/admin/alerts/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000017-0000-4000-8000-000000000001",
  "alert_type": "IMPORT_REVIEW",
  "severity": "WARNING",
  "status": "OPEN",
  "title": "Customer import needs review",
  "details": {
    "summary": "412 valid records · 8 errors"
  },
  "occurrence_count": 1,
  "created_at": "2026-10-14T09:00:00Z",
  "last_seen_at": "2026-10-14T09:00:00Z"
}
```

### 2.54 `GET /api/v1/admin/payouts` — NEW

Resource list.

**Query:** L; exact filters status,driver_id,cadence. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000018-0000-4000-8000-000000000001",
      "payout_reference": "PB-261012",
      "driver_id": "00000005-0000-4000-8000-000000000001",
      "cadence": "MANUAL",
      "period_start": "2026-10-01T00:00:00+05:30",
      "period_end": "2026-10-12T18:00:00+05:30",
      "net_amount": "648000.00",
      "currency": "INR",
      "status": "PAID",
      "paid_at": "2026-10-12T12:34:00Z",
      "provider_reference": "MOCK-UTR-1",
      "created_at": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 4,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.55 `GET /api/v1/admin/payouts/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000018-0000-4000-8000-000000000001",
  "payout_reference": "PB-261012",
  "driver_id": "00000005-0000-4000-8000-000000000001",
  "cadence": "MANUAL",
  "period_start": "2026-10-01T00:00:00+05:30",
  "period_end": "2026-10-12T18:00:00+05:30",
  "net_amount": "648000.00",
  "currency": "INR",
  "status": "PAID",
  "paid_at": "2026-10-12T12:34:00Z",
  "provider_reference": "MOCK-UTR-1",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.56 `GET /api/v1/admin/payout-batches` — NEW

Resource list.

**Query:** L; exact filters status. **Body:** none. **Success:** 200. 201; all shown fields required, confirmed=true, reason3..500 and Idempotency-Key. Reject expired/used/stale preview409. Mock SIMULATED only. Agree real processing states and frontend confirmation before enablement. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.57 `GET /api/v1/admin/payout-batches/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000093-0000-4000-8000-000000000001",
  "preview_id": "00000090-0000-4000-8000-000000000001",
  "status": "SIMULATED",
  "total_amount": "300000.00",
  "currency": "INR",
  "driver_count": 95,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "notice": "Simulation only — no wallet posting or bank transfer",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.58 `GET /api/v1/admin/creative-assets` — NEW

Resource list.

**Query:** L; exact filters none. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000019-0000-4000-8000-000000000001",
      "name": "October delivery scooter",
      "url": "/delivery-scooter.png",
      "content_type": "image/png",
      "created_at": "2026-10-14T09:00:00Z"
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.59 `GET /api/v1/admin/creative-assets/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000019-0000-4000-8000-000000000001",
  "name": "October delivery scooter",
  "url": "/delivery-scooter.png",
  "content_type": "image/png",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.60 `GET /api/v1/admin/incentive-programs` — NEW

Resource list.

**Query:** L; exact filters status. **Body:** none. **Success:** 200. code3..32, title1..120, positive reward_amount required. Creates DRAFT, no wallet credit. Qualification/budget/publication/award logic needs separate production work. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [
    {
      "id": "00000020-0000-4000-8000-000000000001",
      "code": "EXTRAMILE",
      "title": "Extra mile rewards",
      "reward_amount": "80.00",
      "currency": "INR",
      "required_rides": 12,
      "status": "DRAFT",
      "claims_count": 0
    }
  ],
  "next_cursor": null,
  "total_count": 1,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.61 `GET /api/v1/admin/incentive-programs/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000020-0000-4000-8000-000000000001",
  "code": "EXTRAMILE",
  "title": "Extra mile rewards",
  "reward_amount": "80.00",
  "currency": "INR",
  "required_rides": 12,
  "status": "DRAFT",
  "claims_count": 0
}
```

### 2.62 `GET /api/v1/admin/incentive-claims` — NEW

Resource list.

**Query:** L; exact filters status,program_id. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.63 `GET /api/v1/admin/incentive-claims/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000095-0000-4000-8000-000000000001",
  "program_id": "00000020-0000-4000-8000-000000000001",
  "driver_id": "00000005-0000-4000-8000-000000000001",
  "status": "PENDING",
  "amount": "80.00",
  "currency": "INR",
  "wallet_ledger_entry_id": null,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.64 `GET /api/v1/admin/driver-invitations` — NEW

Resource list.

**Query:** L; exact filters status. **Body:** none. **Success:** 200. name1..160 and E.164 phone required. Creates PENDING invitation, no approved driver. Real sending/expiry/dedupe/onboarding linkage still needed. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.65 `GET /api/v1/admin/driver-invitations/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000094-0000-4000-8000-000000000001",
  "name": "Demo Rider",
  "phone_masked": "+9199••••099",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "PENDING",
  "notice": "Mock invitation only; no SMS sent",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.66 `GET /api/v1/admin/data/imports` — NEW

Resource list.

**Query:** L; exact filters status,dataset. **Body:** none. **Success:** 200.  List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.67 `GET /api/v1/admin/data/imports/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000091-0000-4000-8000-000000000001",
  "dataset": "customers",
  "schema_version": "1",
  "original_filename": "customers.csv",
  "size_bytes": 112,
  "status": "UPLOADED",
  "total_rows": 1,
  "valid_rows": 0,
  "invalid_rows": 0,
  "committed_rows": 0,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "errors": [],
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.68 `GET /api/v1/admin/data/exports` — NEW

Resource list.

**Query:** L; exact filters status,dataset. **Body:** none. **Success:** 200. 202; Idempotency-Key required. dataset and format required, remaining fields optional. CSV only. Frozen authorized projection; internal rows never serialized. Production queued jobs require frontend polling before download. List is Page<T>, except coupons bare array. Current-state registry unless explicitly period activity.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.69 `GET /api/v1/admin/data/exports/{id}` — NEW

Resource detail.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "id": "00000092-0000-4000-8000-000000000001",
  "dataset": "order_register",
  "format": "csv",
  "status": "READY",
  "schema_version": "1",
  "fields": [
    "order_number"
  ],
  "record_count": 5349,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "created_at": "2026-10-14T09:00:00Z",
  "download_url": "/api/v1/admin/data/exports/00000092-0000-4000-8000-000000000001/download",
  "mock": true
}
```

### 2.70 `POST /api/v1/admin/campaigns` — NEW

Create mock resource.

**Success:** 201. Required title1..120 and audience CUSTOMER|DRIVER; format optional default HOME_BANNER, enum HOME_BANNER|TESTIMONIAL|POPUP|INCENTIVE; description optional; start_at/end_at optional for draft, ordered and required before publish. Response DRAFT version1, zero counters.

**Request JSON:**

```json
{
  "title": "Weekend delivery boost",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "description": "Forty rupees off eligible fares",
  "start_at": "2026-10-17T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30"
}
```

**Response example:**

```json
{
  "id": "00000011-0000-4000-8000-000000000001",
  "title": "Weekend delivery boost",
  "description": "Forty rupees off eligible fares",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "placement": "CUSTOMER_HOME",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "DRAFT",
  "start_at": "2026-10-17T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "impressions": 0,
  "clicks": 0,
  "version": 1,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.71 `POST /api/v1/admin/coupons` — EXISTING

Create mock resource.

Source: `backend/app/modules/coupon/router.py:128`. Existing DTO/permission dependencies: section5.

**Success:** 201. Required code3..32 uppercase alphanumeric/_/-, title1..120, description1..255, discount_type FLAT|PERCENT, positive discount_value; percent <=100. Other fields optional/nullable; max_discount>0, min_fare>=0, max_uses_per_customer>=1; ordered validity; duplicate 409. Fare discount, not cashback.

**Request JSON:**

```json
{
  "code": "WEEKEND40",
  "title": "Weekend fare discount",
  "description": "Forty rupees off eligible fares",
  "discount_type": "FLAT",
  "discount_value": "40.00",
  "max_discount": null,
  "min_fare": "199.00",
  "vehicle_type_codes": [
    "BIKE"
  ],
  "valid_from": "2026-10-17T00:00:00+05:30",
  "valid_until": "2026-11-01T00:00:00+05:30",
  "max_uses_per_customer": 1
}
```

**Response example:**

```json
{
  "id": "00000012-0000-4000-8000-000000000001",
  "code": "WEEKEND40",
  "title": "Weekend fare discount",
  "description": "Forty rupees off eligible fares",
  "discount_type": "FLAT",
  "discount_value": "40.00",
  "max_discount": null,
  "min_fare": "199.00",
  "vehicle_type_codes": [
    "BIKE"
  ],
  "valid_from": "2026-10-17T00:00:00+05:30",
  "valid_until": "2026-11-01T00:00:00+05:30",
  "max_uses_per_customer": 1,
  "is_active": true,
  "usage_count": 0
}
```

### 2.72 `POST /api/v1/admin/brands` — NEW

Create mock resource.

**Success:** 201. All three required; names1..160, email3..254; production validates normalized email.

**Request JSON:**

```json
{
  "display_name": "Demo Retail",
  "contact_name": "Priya Demo",
  "email": "priya@example.com"
}
```

**Response example:**

```json
{
  "id": "00000013-0000-4000-8000-000000000001",
  "display_name": "Demo Retail",
  "contact_name": "Priya Demo",
  "email": "priya@example.com",
  "status": "ACTIVE"
}
```

### 2.73 `POST /api/v1/admin/brand-campaigns` — NEW

Create mock resource.

**Success:** 201. Required brand_id, title1..120, placement, positive booked_ad_value. Dates optional in mock; production validates ordered aware instants. Mock assigns INR. Contracted advertising value is not fare revenue.

**Request JSON:**

```json
{
  "brand_id": "00000013-0000-4000-8000-000000000001",
  "title": "Fresh picks, delivered",
  "placement": "CUSTOMER_HOME",
  "booked_ad_value": "45000.00",
  "start_at": "2026-10-17T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30"
}
```

**Response example:**

```json
{
  "id": "00000015-0000-4000-8000-000000000001",
  "brand_id": "00000013-0000-4000-8000-000000000001",
  "title": "Fresh picks, delivered",
  "placement": "CUSTOMER_HOME",
  "start_at": "2026-10-17T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "booked_ad_value": "45000.00",
  "currency": "INR",
  "status": "DRAFT"
}
```

### 2.74 `POST /api/v1/admin/business-accounts` — NEW

Create mock resource.

**Success:** 201. Required existing BUSINESS customer_id, display_name1..160, account_code1..32. payment_terms optional default PREPAID; PREPAID|NET_15|NET_30. Enforce production code uniqueness and commercial policy.

**Request JSON:**

```json
{
  "customer_id": "00000003-0000-4000-8000-000000000002",
  "display_name": "FreshMart",
  "account_code": "FM-024",
  "payment_terms": "NET_15"
}
```

**Response example:**

```json
{
  "id": "00000014-0000-4000-8000-000000000001",
  "customer_id": "00000003-0000-4000-8000-000000000002",
  "display_name": "FreshMart",
  "account_code": "FM-024",
  "location_count": 0,
  "payment_terms": "NET_15",
  "status": "ACTIVE",
  "version": 1
}
```

### 2.75 `POST /api/v1/admin/incentive-programs` — NEW

Create mock resource.

**Success:** 201. code3..32, title1..120, positive reward_amount required. Creates DRAFT, no wallet credit. Qualification/budget/publication/award logic needs separate production work.

**Request JSON:**

```json
{
  "code": "EXTRAMILE_DEMO",
  "title": "Extra mile rewards",
  "reward_amount": "80.00"
}
```

**Response example:**

```json
{
  "id": "00000020-0000-4000-8000-000000000001",
  "code": "EXTRAMILE_DEMO",
  "title": "Extra mile rewards",
  "reward_amount": "80.00",
  "currency": "INR",
  "required_rides": 12,
  "status": "DRAFT",
  "claims_count": 0
}
```

### 2.76 `POST /api/v1/admin/driver-invitations` — NEW

Create mock resource.

**Success:** 201. name1..160 and E.164 phone required. Creates PENDING invitation, no approved driver. Real sending/expiry/dedupe/onboarding linkage still needed.

**Request JSON:**

```json
{
  "name": "Demo Rider",
  "phone": "+919900000099"
}
```

**Response example:**

```json
{
  "id": "00000094-0000-4000-8000-000000000001",
  "name": "Demo Rider",
  "phone_masked": "+9199••••099",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "PENDING",
  "notice": "Mock invitation only; no SMS sent",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.77 `PATCH /api/v1/admin/campaigns/{id}` — NEW

Update allowlisted fields with reason.

**Success:** 200. reason required 3..500. Optional editable fields: title,description,start_at,end_at; version optional expected revision in mock. Production validates references/dates/enums and enforces concurrency.

**Request JSON:**

```json
{
  "reason": "Update after review",
  "title": "Updated delivery boost",
  "version": 1
}
```

**Response example:**

```json
{
  "id": "00000011-0000-4000-8000-000000000001",
  "title": "Updated delivery boost",
  "description": "₹40 fare discount with RYNO40",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "placement": "CUSTOMER_HOME",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "LIVE",
  "start_at": "2026-10-01T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "impressions": 84200,
  "clicks": 640,
  "version": 2,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.78 `PATCH /api/v1/admin/coupons/{id}` — EXISTING

Update allowlisted fields with reason.

Source: `backend/app/modules/coupon/router.py:155`. Existing DTO/permission dependencies: section5.

**Success:** 200. reason required 3..500. Optional editable fields: is_active,valid_until only (no real version field). Production validates references/dates/enums and enforces concurrency.

**Request JSON:**

```json
{
  "reason": "Update after review",
  "is_active": false,
  "valid_until": "2026-11-01T00:00:00+05:30"
}
```

**Response example:**

```json
{
  "id": "00000012-0000-4000-8000-000000000001",
  "code": "RYNO40",
  "title": "October delivery discount",
  "description": "Mock flat discount — not a wallet cashback credit",
  "discount_type": "FLAT",
  "discount_value": "40.00",
  "max_discount": null,
  "min_fare": "199.00",
  "vehicle_type_codes": null,
  "valid_from": "2026-10-01T00:00:00+05:30",
  "valid_until": "2026-11-01T00:00:00+05:30",
  "max_uses_per_customer": 1,
  "is_active": false,
  "usage_count": 920
}
```

### 2.79 `PATCH /api/v1/admin/business-accounts/{id}` — NEW

Update allowlisted fields with reason.

**Success:** 200. reason required 3..500. Optional editable fields: display_name,payment_terms; version optional expected revision in mock. Production validates references/dates/enums and enforces concurrency.

**Request JSON:**

```json
{
  "reason": "Update after review",
  "display_name": "FreshMart Bengaluru",
  "payment_terms": "NET_15",
  "version": 1
}
```

**Response example:**

```json
{
  "id": "00000014-0000-4000-8000-000000000001",
  "customer_id": "00000003-0000-4000-8000-000000000002",
  "display_name": "FreshMart Bengaluru",
  "account_code": "FM-024",
  "location_count": 8,
  "payment_terms": "NET_15",
  "status": "ACTIVE",
  "version": 2
}
```

### 2.80 `PATCH /api/v1/admin/web-enquiries/{id}` — NEW

Update allowlisted fields with reason.

**Success:** 200. reason required 3..500. Optional editable fields: status,owner_user_id,follow_up_at,note; states NEW|ASSIGNED|FOLLOW_UP|RESOLVED|SPAM. Production validates references/dates/enums and enforces concurrency.

**Request JSON:**

```json
{
  "reason": "Update after review",
  "status": "FOLLOW_UP",
  "owner_user_id": "00000001-0000-4000-8000-000000000001",
  "follow_up_at": "2026-10-18T05:00:00Z",
  "note": "Discuss delivery requirements"
}
```

**Response example:**

```json
{
  "id": "00000016-0000-4000-8000-000000000001",
  "contact_name": "Priya Shah",
  "phone_masked": "+91 98•••••100",
  "email": "enquiry1@example.com",
  "reason_code": "B2B_EXPANSION",
  "message": "Daily dispatch for 3 new stores",
  "status": "FOLLOW_UP",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "owner_user_id": "00000001-0000-4000-8000-000000000001",
  "received_at": "2026-10-14T09:00:00Z",
  "created_at": "2026-10-14T09:00:00Z",
  "follow_up_at": "2026-10-18T05:00:00Z",
  "note": "Discuss delivery requirements"
}
```

### 2.81 `POST /api/v1/admin/campaigns/{id}/publish` — NEW

Campaign state action.

**Success:** 200. reason required 3..500; publish requires valid ordered start_at/end_at. Return Campaign with incremented version; LIVE can still be future Scheduled in UI.

**Request JSON:**

```json
{
  "reason": "Approved promotion change"
}
```

**Response example:**

```json
{
  "id": "00000011-0000-4000-8000-000000000001",
  "title": "October delivery boost",
  "description": "₹40 fare discount with RYNO40",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "placement": "CUSTOMER_HOME",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "LIVE",
  "start_at": "2026-10-01T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "impressions": 84200,
  "clicks": 640,
  "version": 2,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.82 `POST /api/v1/admin/campaigns/{id}/pause` — NEW

Campaign state action.

**Success:** 200. reason required 3..500; publish requires valid ordered start_at/end_at. Return Campaign with incremented version; LIVE can still be future Scheduled in UI.

**Request JSON:**

```json
{
  "reason": "Approved promotion change"
}
```

**Response example:**

```json
{
  "id": "00000011-0000-4000-8000-000000000001",
  "title": "October delivery boost",
  "description": "₹40 fare discount with RYNO40",
  "audience": "CUSTOMER",
  "format": "HOME_BANNER",
  "placement": "CUSTOMER_HOME",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "PAUSED",
  "start_at": "2026-10-01T00:00:00+05:30",
  "end_at": "2026-11-01T00:00:00+05:30",
  "impressions": 84200,
  "clicks": 640,
  "version": 2,
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.83 `POST /api/v1/admin/alerts/{id}/acknowledge` — EXISTING

Alert action.

Source: `backend/app/modules/ops_alert/router.py:30`. Existing DTO/permission dependencies: section5.

**Success:** 200. Resolve note required 3..2000. Return OpsAlert including actor/timestamp/resolution_note; resolved state conflict 409.

**Request JSON:**

```json
{}
```

**Response example:**

```json
{
  "id": "00000017-0000-4000-8000-000000000001",
  "alert_type": "IMPORT_REVIEW",
  "severity": "WARNING",
  "status": "ACKNOWLEDGED",
  "title": "Customer import needs review",
  "details": {
    "summary": "412 valid records · 8 errors"
  },
  "occurrence_count": 1,
  "created_at": "2026-10-14T09:00:00Z",
  "last_seen_at": "2026-10-14T09:00:00Z"
}
```

### 2.84 `POST /api/v1/admin/alerts/{id}/resolve` — EXISTING

Alert action.

Source: `backend/app/modules/ops_alert/router.py:35`. Existing DTO/permission dependencies: section5.

**Success:** 200. Resolve note required 3..2000. Return OpsAlert including actor/timestamp/resolution_note; resolved state conflict 409.

**Request JSON:**

```json
{
  "note": "Reviewed and resolved the issue"
}
```

**Response example:**

```json
{
  "id": "00000017-0000-4000-8000-000000000001",
  "alert_type": "IMPORT_REVIEW",
  "severity": "WARNING",
  "status": "RESOLVED",
  "title": "Customer import needs review",
  "details": {
    "summary": "412 valid records · 8 errors"
  },
  "occurrence_count": 1,
  "created_at": "2026-10-14T09:00:00Z",
  "last_seen_at": "2026-10-14T09:00:00Z"
}
```

### 2.85 `GET /api/v1/admin/onboarding/pending` — EXISTING

Pending mock riders.

Source: `backend/app/modules/partner_onboarding/admin_router.py:34`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[
  {
    "id": "00000005-0000-4000-8000-000000000004",
    "driver_number": "RD-004",
    "first_name": "Deepak",
    "last_name": "S.",
    "phone_masked": "+91 98•••••304",
    "primary_market_id": "11111111-1111-4111-8111-111111111111",
    "account_status": "ONBOARDING",
    "onboarding_status": "IN_PROGRESS",
    "compliance_status": "PENDING",
    "availability": "OFFLINE",
    "availability_as_of": "2026-10-14T09:00:00Z",
    "current_vehicle": {
      "id": "00000006-0000-4000-8000-000000000004",
      "code": "BIKE",
      "name": "Bike",
      "registration_number": "KA 01 AB 2187"
    },
    "rating": null,
    "rating_count": null,
    "created_at": "2026-09-01T04:30:00Z"
  }
]
```

### 2.86 `GET /api/v1/admin/verifications/pending` — EXISTING

Empty verification queue.

Source: `backend/app/modules/partner_onboarding/admin_router.py:39`. Existing DTO/permission dependencies: section5.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[]
```

### 2.87 `GET /api/v1/admin/audit` — EXISTING

Mock mutation history.

Source: `backend/app/modules/admin/router.py:211`. Existing DTO/permission dependencies: section5.

**Query:** Real requires entity_type:string and entity_id:UUID. **Body:** none. **Success:** 200. Existing entity-scoped arrays; mock broader global/list behavior is not a real backend feature.

**Response example:**

```json
[]
```

### 2.88 `GET /api/v1/admin/admin-actions` — EXISTING

Mock mutation history.

Source: `backend/app/modules/admin/router.py:222`. Existing DTO/permission dependencies: section5.

**Query:** Real requires entity_type:string and entity_id:UUID. **Body:** none. **Success:** 200. Existing entity-scoped arrays; mock broader global/list behavior is not a real backend feature.

**Response example:**

```json
[]
```

### 2.89 `GET /api/v1/admin/data/summary` — NEW

Actual transfer totals.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "imports_count": 0,
  "exports_count": 0,
  "committed_records": 0,
  "last_transfer_at": null,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.90 `GET /api/v1/admin/data/templates` — NEW

CSV schema metadata.

**Query:** None. **Body:** none. **Success:** 200.

**Response example:**

```json
[
  {
    "dataset": "customers",
    "schema_version": "1",
    "formats": [
      "csv"
    ],
    "required_fields": [
      "display_name"
    ]
  }
]
```

### 2.91 `GET /api/v1/admin/data/templates/{dataset}` — NEW

Download CSV template.

**Query:** dataset path=customers|riders|business_accounts; format?:csv. **Body:** none. **Success:** 200. 200 text/csv attachment, not JSON; example CSV in section4.

### 2.92 `POST /api/v1/admin/data/imports` — NEW

Multipart CSV upload.

**Success:** 201. multipart fields dataset and file required. dataset customers|riders|business_accounts; UTF-8 CSV <=20MiB and10,000 rows. Upload stages only.

**Response example:**

```json
{
  "id": "00000091-0000-4000-8000-000000000001",
  "dataset": "customers",
  "schema_version": "1",
  "original_filename": "customers.csv",
  "size_bytes": 112,
  "status": "UPLOADED",
  "total_rows": 1,
  "valid_rows": 0,
  "invalid_rows": 0,
  "committed_rows": 0,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "version": 1,
  "errors": [],
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.93 `GET /api/v1/admin/data/imports/{id}/errors` — NEW

Redacted validation errors.

**Query:** None. **Body:** none. **Success:** 200. No cursor currently. First data row2. Errors redact source contacts.

**Response example:**

```json
{
  "items": [
    {
      "row": 2,
      "column": "phone",
      "code": "INVALID_PHONE",
      "message": "Use E.164 phone format"
    }
  ],
  "total_count": 1
}
```

### 2.94 `POST /api/v1/admin/data/imports/{id}/validate` — NEW

Staged import action.

**Success:** 200. Current version required; only UPLOADED/NEEDS_REVIEW. Response VALIDATED or NEEDS_REVIEW with errors/counters/version+1.

**Request JSON:**

```json
{
  "version": 1
}
```

**Response example:**

```json
{
  "id": "00000091-0000-4000-8000-000000000001",
  "dataset": "customers",
  "schema_version": "1",
  "original_filename": "customers.csv",
  "size_bytes": 112,
  "status": "VALIDATED",
  "total_rows": 1,
  "valid_rows": 1,
  "invalid_rows": 0,
  "committed_rows": 0,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "version": 2,
  "errors": [],
  "created_at": "2026-10-14T09:00:00Z",
  "validated_at": "2026-10-14T09:00:00Z"
}
```

### 2.95 `POST /api/v1/admin/data/imports/{id}/commit` — NEW

Staged import action.

**Success:** 200. Current version and reason3..500 required; Idempotency-Key required. Only fully VALIDATED jobs; domain-service atomic commit; conflicts 409.

**Request JSON:**

```json
{
  "version": 2,
  "reason": "Commit validated customers"
}
```

**Response example:**

```json
{
  "id": "00000091-0000-4000-8000-000000000001",
  "dataset": "customers",
  "schema_version": "1",
  "original_filename": "customers.csv",
  "size_bytes": 112,
  "status": "COMPLETED",
  "total_rows": 1,
  "valid_rows": 1,
  "invalid_rows": 0,
  "committed_rows": 1,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "version": 3,
  "errors": [],
  "created_at": "2026-10-14T09:00:00Z",
  "committed_at": "2026-10-14T09:00:00Z"
}
```

### 2.96 `POST /api/v1/admin/data/exports` — NEW

Create frozen CSV export.

**Success:** 202. 202; Idempotency-Key required. dataset and format required, remaining fields optional. CSV only. Frozen authorized projection; internal rows never serialized. Production queued jobs require frontend polling before download.

**Request JSON:**

```json
{
  "dataset": "order_register",
  "format": "csv",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "fields": [
    "order_number",
    "customer_display_name",
    "status",
    "final_amount",
    "currency"
  ],
  "filters": {
    "customer_type": "BUSINESS"
  }
}
```

**Response example:**

```json
{
  "id": "00000092-0000-4000-8000-000000000001",
  "dataset": "order_register",
  "format": "csv",
  "status": "READY",
  "schema_version": "1",
  "fields": [
    "order_number"
  ],
  "record_count": 5349,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "timezone": "Asia/Kolkata",
  "currency": "INR",
  "as_of": "2026-10-14T09:00:00Z",
  "created_at": "2026-10-14T09:00:00Z",
  "download_url": "/api/v1/admin/data/exports/00000092-0000-4000-8000-000000000001/download",
  "mock": true
}
```

### 2.97 `GET /api/v1/admin/data/exports/{id}/download` — NEW

Download CSV.

**Query:** None. **Body:** none. **Success:** 200. Authenticated text/csv attachment; no JSON. Recheck access; production409 if not ready/410 if expired.

### 2.98 `GET /api/v1/admin/data/transfers` — NEW

Import/export job history.

**Query:** L + dataset,status,direction(IMPORT|EXPORT). **Body:** none. **Success:** 200.

**Response example:**

```json
{
  "items": [],
  "next_cursor": null,
  "total_count": 0,
  "as_of": "2026-10-14T09:00:00Z"
}
```

### 2.99 `POST /api/v1/admin/creative-assets` — NEW

Store image metadata only.

**Success:** 201. multipart file required, image/png|image/jpeg|image/webp <=5MiB. Mock metadata only; production must validate bytes and store/serve asset.

**Response example:**

```json
{
  "id": "00000019-0000-4000-8000-000000000001",
  "name": "campaign.png",
  "content_type": "image/png",
  "size_bytes": 1024,
  "url": null,
  "status": "METADATA_ONLY",
  "notice": "File bytes not persisted or published",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.100 `POST /api/v1/admin/payout-batches/preview` — NEW

No-side-effect preview.

**Success:** 200. No money moved; market_id optional in mock. Production must persist immutable membership/criteria, amounts and expiry.200.

**Request JSON:**

```json
{
  "market_id": "11111111-1111-4111-8111-111111111111"
}
```

**Response example:**

```json
{
  "id": "00000090-0000-4000-8000-000000000001",
  "eligible_driver_count": 95,
  "total_amount": "300000.00",
  "currency": "INR",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "status": "PREVIEW",
  "criteria_hash": "demo-criteria-hash",
  "expires_at": "2026-10-17T10:15:00Z",
  "notice": "Preview only — no money moved",
  "created_at": "2026-10-17T10:00:00Z"
}
```

### 2.101 `POST /api/v1/admin/payout-batches` — NEW

Confirm simulation.

**Success:** 201. 201; all shown fields required, confirmed=true, reason3..500 and Idempotency-Key. Reject expired/used/stale preview409. Mock SIMULATED only. Agree real processing states and frontend confirmation before enablement.

**Request JSON:**

```json
{
  "preview_id": "00000090-0000-4000-8000-000000000001",
  "confirmed": true,
  "reason": "Confirm reviewed demonstration batch"
}
```

**Response example:**

```json
{
  "id": "00000093-0000-4000-8000-000000000001",
  "preview_id": "00000090-0000-4000-8000-000000000001",
  "status": "SIMULATED",
  "total_amount": "300000.00",
  "currency": "INR",
  "driver_count": 95,
  "created_by": "00000001-0000-4000-8000-000000000001",
  "notice": "Simulation only — no wallet posting or bank transfer",
  "created_at": "2026-10-14T09:00:00Z"
}
```

### 2.102 `POST /api/v1/admin/payouts/run` — EXISTING

Simulation only, no real payments.

Source: `backend/app/modules/earnings/router.py:191`. Existing DTO/permission dependencies: section5.

**Success:** 200. Real endpoint actually processes money and returns PayoutResponse[]. Mock returns SIMULATED object. cadence required DAILY|WEEKLY|MANUAL; period_end/reason optional. Current CMS uses preview/confirm instead.

**Request JSON:**

```json
{
  "cadence": "MANUAL",
  "period_end": "2026-10-14T09:00:00Z",
  "reason": "Approved manual payout run"
}
```

**Response example:**

```json
{
  "mock": true,
  "status": "SIMULATED",
  "payouts": [],
  "notice": "Real endpoint processes money and returns PayoutResponse[]"
}
```

### 2.103 `GET /api/v1/admin/payouts/{id}/receipt` — NEW

Mock PAID payout receipt.

**Query:** None. **Body:** none. **Success:** 200. Only PAID payouts. Mock JSON is illustrative, not bank evidence/PDF; real media/evidence contract needs agreement.

**Response example:**

```json
{
  "mock": true,
  "payout_reference": "PB-261012",
  "net_amount": "648000.00",
  "currency": "INR",
  "paid_at": "2026-10-12T12:34:00Z",
  "provider_reference": "MOCK-UTR-1",
  "notice": "Mock receipt — no funds transferred"
}
```

## 3. Detailed backend requirements and domain rules

The following source-based domain analysis explains missing persistence and production behavior. Where an earlier design proposal differs from current mock JSON, the endpoint catalog in section2 defines current browser expectations; the integration corrections in section6 identify remaining decisions. New-data proposals here do not claim those models already exist.

### Domain 1. Main findings

| CMS area | Available backend foundation | Missing for the supplied frontend |
|---|---|---|
| Dashboard | Orders, trips, payments, customers, cancellations, earning ledger | Market/date aggregates, comparison periods, daily series, B2B split, web enquiries |
| Orders | Admin list/detail/cancel/assign/reassign; status history; payments | Enriched paginated register, search, date/payment/business filters, counts, export |
| Reports | Orders/payments/refunds, immutable earnings, payouts, invoices, audit | MTD/YTD statements, reconciled finance aggregates, export packages/history |
| Marketing | Coupon CRUD; coupon redemptions; customer offer banners read from settings | Campaigns, media library, impressions/click events, attribution, rider incentive programs, cashback-specific ledger links |
| Partners | Customers, drivers, owners, vehicles, KYC, bank accounts, market IDs | Admin registries/detail/statistics; B2B commercial profile; advertising brands/contracts; invitation flow |
| Analytics | Lifecycle timestamps, pickup coordinates, cancellation actor/reason, driver offers, ledger amounts | Aggregate endpoints; ratings persistence; on-time target/SLA definition; stable locality dimension |
| Data | Transactional services, entity schemas, audit tables | Import/export jobs, staged rows, validation/commit workflow, template/schema APIs, transfer logs |
| Payments | Driver wallet ledger, earnings, payouts and admin run/retry/resolve operations | Admin balances/payout lists, masked-bank joined views, dry-run batch preview, batch entity, reconciliation/receipt exports |

**Important mismatches:**

1. `B2C` and `B2B` are UI labels. The actual customer enum is `INDIVIDUAL | BUSINESS`. Business classification exists, but stores/warehouses, payment terms and commercial account identifiers do not have a dedicated business profile.
2. `Unassigned`, `Confirmed` and `Active` are proposed display groups, not stored order status values. Keep and return raw statuses.
3. **POD is payment timing, not a method.** Use `payment_timing=POST_DELIVERY`; method may be `CASH`, `UPI`, `CARD`, `NETBANKING`, or `WALLET` according to the applicable flow. “Online” must distinguish external gateway collections from wallet-funded orders.
4. The mock “80% earnings” rule is not authoritative. Earnings use the quote's snapshotted pricing plan, `commission_rate`, component amounts, incentives and deductions.
5. Payouts currently withdraw driver **wallet balances**. `DriverPayoutItem` is historical; new payouts no longer itemize per-trip earnings. Do not derive outstanding balances by summing `PAYABLE` earnings or subtracting month-to-date payouts from month-to-date earnings.
6. Rating fields are nullable DTO placeholders; no rating persistence or rating endpoint was found. Do not fill them with the mock `4.8` or `4.9`.
7. `estimated_duration_seconds` is an estimate, not an on-time delivery promise. The displayed `94.6%` needs an agreed SLA and persisted target before it can be real.
8. `POST /admin/payouts/run` **creates and processes actual payouts through the configured provider**. It is not a preview and must not be called when opening “Prepare settlement.”
9. The screenshot totals, companies and 14 October snapshot are frontend fixtures. The backend demo seed describes 2 admins, 10 customers, 10 drivers, and lifecycle examples; it is a different dataset.

### Domain 3. Login and workspace context

#### Existing

| Method / path | Request | Response / behavior |
|---|---|---|
| `POST /auth/otp/request` | `phone` (6–20 characters), `app_type: "ADMIN"` | 202: `phone_masked`, `expires_in_seconds` |
| `POST /auth/otp/verify` | `phone`, `app_type: "ADMIN"`, `code` (4–8 digits), `device` | 200: `AuthTokenResponse` |
| `POST /auth/refresh` | `refresh_token` (20–256 characters) | Rotated `AuthTokenResponse` |
| `GET /auth/me` | Bearer | `MeResponse`, same user fields as login |
| `POST /auth/logout` | `all_sessions: boolean`, default false | 204 |
| `GET /admin/markets` | `pricing.manage` | `MarketResponse[]` |
| `GET /vehicle-types` | Authenticated principal | `VehicleTypeResponse[]` |

Admin accounts must already exist; ADMIN OTP login does not self-register an arbitrary phone. This documentation does not create accounts or request OTPs.

Example verification request, with a placeholder OTP that must be replaced by the actual challenge:

```json
{
  "phone": "+919900000001",
  "app_type": "ADMIN",
  "code": "<actual OTP>",
  "device": {
    "device_uuid": "cms-browser-installation-id",
    "platform": "WEB",
    "app_version": "0.1.0"
  }
}
```

`device_uuid`: 4–128 characters. Optional `push_token`: up to 512 characters. Auth response contains `access_token`, `refresh_token`, `token_type`, `expires_in_seconds`, `is_new_user`, and `user`. `user` includes `id`, `user_type`, `status`, phone details, nullable email/name, `email_verified`, `profile_complete`, and optional customer/onboarding/driver status fields. It does **not** include role/permission arrays or a market scope.

#### Proposed workspace API

`GET /admin/workspace` — **New API**. Require ADMIN plus an agreed workspace access permission; apply market scopes if those are introduced. Return `user`, `roles`, `permissions`, `markets: MarketResponse[]`, `selected_market_id`, `server_time`. The selected market must be authorized server-side; the current backend has no general per-admin market access model, so do not describe one as implemented.

This avoids requiring `pricing.manage` merely to populate every operator's city selector. A read-only `GET /admin/markets/{market_id}/zones` is also required for the CMS; only zone creation currently exists.

### Domain 4. Orders: existing API and required register

#### 4.1 Current contracts

`GET /admin/orders` — **Existing**, `orders.manage`.

Query: `status?: string`, `market_id?: UUID`, `limit: 1..200` (default 50). Sorted by `Order.created_at DESC`. **No cursor, offset, search, date range, payment filter, business filter, total count, customer contact or route fields.**

Each current `OrderSummary` contains:

| Field | Type |
|---|---|
| `id` | UUID |
| `order_number` | string |
| `status` | string, raw `OrderStatus` |
| `quoted_amount` | decimal string |
| `final_amount` | decimal string or null |
| `currency` | string |
| `created_at` | ISO timestamp |

`GET /admin/orders/{order_id}` — **Existing**, `orders.manage`. Response is `AdminOrderDetail`:

- `order`: serialized `OrderResponse` dictionary, **excluding nested `driver` and `vehicle`**. Assigned UUID pointers remain; stops, items, payment and cancellation projections are included.
- `history`: `{from_status, to_status, actor_type, reason, created_at}[]`.
- `assignments`: `{id, driver_id, vehicle_id, source, status, assigned_at, release_reason}[]`.
- `trips`: `{id, trip_number, order_id, driver_id, status, attempt_number, created_at}[]`.
- `payments`: `{id, purpose, status, amount, refunded_amount}[]`. This summary does not contain the payment method; fetch the authorized payment detail or add a reviewed projection.

`OrderResponse` includes `id`, `order_number`, `status`, `service_type`, `payment_timing`, `vehicle_type_id`, `market_id`, nullable `price_quote_id`, currency/quoted/final amounts, estimated distance/duration, nullable assigned driver/vehicle/active-trip IDs, `requested_at`, `created_at`, nullable `search_expires_at`, `stops`, `items`, `payment`, nullable `cancellation`.

Current admin actions:

| Method / path | Body | Response |
|---|---|---|
| `POST /admin/orders/{id}/cancel` | `{reason_code: string(2..64), note?: string(max 1000)}` | 204 |
| `POST /admin/orders/{id}/assign` | `{driver_id: UUID, reason: string(3..500)}` | `AssignmentView` |
| `POST /admin/orders/{id}/reassign` | `{driver_id?: UUID or null, reason: string(3..500)}` | `AssignmentView` or null |
| `GET /admin/active-trips` | No filters declared | `TripView[]` of non-terminal trips |

Use these domain actions, not a generic status PATCH. Preserve the current reassign/release semantics in `AdminOpsService`. Assignment eligibility and concurrency checks belong in backend services.

#### 4.2 Proposed enriched register

`GET /admin/order-register` — **New API**, `orders.manage`. New path preserves the existing `/admin/orders` array contract.

Queries: shared date/market scope; `q?: string(max 160)`; `status?: raw OrderStatus`; `status_group?: enum below`; `payment_method_type?: PaymentMethod`; `payment_timing?: PRE_DISPATCH|POST_DELIVERY`; `customer_type?: INDIVIDUAL|BUSINESS`; `cursor?`; `limit`. Reject simultaneous conflicting raw/group status filters.

Search should cover order number, customer display name and normalized phone. Apply PII access policy before returning phone details. Return the list envelope from §2.2 with items:

```json
{
  "id": "22222222-2222-4222-8222-222222222222",
  "order_number": "ORD-EXAMPLE",
  "created_at": "2026-10-14T08:12:00Z",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "customer": {
    "id": "33333333-3333-4333-8333-333333333333",
    "customer_number": "CUS-EXAMPLE",
    "display_name": "Example customer",
    "customer_type": "INDIVIDUAL",
    "phone_masked": "+91 98•••••220"
  },
  "route": {"pickup_label": "Indiranagar", "drop_label": "Koramangala", "stop_count": 2},
  "vehicle_type": {"id": "44444444-4444-4444-8444-444444444444", "code": "BIKE", "name": "2 Wheeler"},
  "fare": {"quoted_amount": "280.00", "final_amount": "280.00", "currency": "INR"},
  "status": "DELIVERED",
  "status_group": "DELIVERED",
  "payment": {
    "payment_id": "55555555-5555-4555-8555-555555555555",
    "method": "UPI",
    "timing": "POST_DELIVERY",
    "status": "PAID",
    "gateway_status": "SUCCESS",
    "paid_at": "2026-10-14T08:40:00Z",
    "refunded_amount": "0.00"
  }
}
```

The current embedded `OrderPayment.status` is `PENDING | PAID`; do not confuse it with the full payment ledger status. Select the effective payment for the relevant purpose using backend logic, not an arbitrary joined row. For multiple drops, use the last ordered DROP for the terminal label.

#### 4.3 Proposed display groups

These groups are a CMS proposal, not a database enum change:

| Group | Raw order statuses |
|---|---|
| `UNASSIGNED` | `CREATED`, `PAYMENT_PENDING`, `PAYMENT_FAILED`, `SEARCHING_DRIVER`, `NO_DRIVER_FOUND` |
| `CONFIRMED` | `DRIVER_ASSIGNED`, `DRIVER_ARRIVED_AT_PICKUP` |
| `ACTIVE` | `PICKED_UP`, `DRIVER_ARRIVED_AT_DROP`, `AWAITING_PAYMENT` |
| `DELIVERED` | `DELIVERED` |
| `CANCELLED` | `CANCELLED` |
| `FAILED` | `DELIVERY_FAILED` |
| `RESERVED` | `DRAFT`, `QUOTED` (reserved backend values, not normal persisted booking flow) |

The extra FAILED group prevents silently losing terminal failures from totals. `NO_DRIVER_FOUND` is retryable until the search window expires; it is not automatically a cancellation. Confirm the exact label for payment-pending/failed unassigned bookings before final integration.

`GET /admin/order-register/summary` — **New API**, `orders.manage`, same date/market/filter meanings. Return `total_count`, `counts_by_status`, `counts_by_group`, `delivered_count`, `in_progress_count`, `cancelled_count`, `failed_count`, `cancellation_rate_percent`. Do not mix currently open rides with period-created bookings without labeling the cohort.

**Route registration:** do not rename this proposed summary route to `/admin/orders/summary` without resolving routing order. The existing `/admin/orders/{order_id}` captures a path segment. Register `/admin/orders/summary` before it, or use a non-conflicting path such as `/admin/order-register/summary`. Prefer the latter when implementing; the checklist uses `/admin/order-register/summary`.

### Domain 5. Dashboard

`GET /admin/dashboard` — **New API**, proposed `analytics.read` plus finance permission for monetary fields. Query: shared reporting scope. Response `data`:

| Field | Type / source |
|---|---|
| `gross_fare_revenue` | decimal; completed orders, basis documented in §13 |
| `today_gross_fare_revenue` | decimal, current market day as of snapshot |
| `revenue_change_percent` | decimal or null if prior comparable denominator is zero |
| `bookings_count`, `today_bookings_count` | integers, `orders.created_at` |
| `bookings_by_customer_type` | `{INDIVIDUAL: int, BUSINESS: int}` |
| `counts_by_group` | complete group count map from §4.3 |
| `today_counts_by_group` | same map, explicitly today's booking cohort or today's transition events; agree one definition |
| `revenue_series` | `[{date, amount, comparison_amount}]`; local dates; zero-fill missing days |
| `rides_by_customer_type_and_group` | `[{status_group, individual_count, business_count}]` |
| `open_web_enquiries_count` | int or null until enquiry storage exists |

“Today” must be derived from `as_of` and market timezone; historical periods should not pretend the last selected day is the current day. Return `today_date` explicitly. Comparisons use equal elapsed lengths, with boundary behavior documented.

#### Web enquiries — new data + API

Do not repurpose `SupportTicket` as a sales lead merely because both contain messages. Add a dedicated `web_enquiries` entity with UUID, contact name, normalized phone, nullable email, reason code, message, optional route/business context, source, market, owner admin ID, status, received/updated timestamps and follow-up due date. Suggested statuses: `NEW | ASSIGNED | FOLLOW_UP | RESOLVED | SPAM` (proposal).

- `GET /admin/web-enquiries?status=&owner_user_id=&q=&cursor=&limit=` → list envelope.
- `GET /admin/web-enquiries/{id}` → full enquiry and action history.
- `PATCH /admin/web-enquiries/{id}` → `{owner_user_id?, status?, follow_up_at?, note?, reason}`; require `support.manage` or a new sales permission, agreed explicitly.
- Public website intake, if needed: a separate rate-limited endpoint with abuse protection and consent fields. It is not needed merely to render the CMS list.

### Domain 6. Reports

`GET /admin/reports/statement` — **New API**, proposed `reports.read` + `payments.read`. Query: `market_id`, `as_of` timestamp, optional `month=2026-10`; fiscal-year start currently proposed as 1 April to match the screenshots, not inferred from a money model.

Return the aggregate scope plus `mtd_period`, `ytd_period`, `reconciled_at?: timestamp`, `reviewed_by?: UUID`, `reviewed_at?: timestamp`, and `rows: [{measure, label, mtd, ytd, unit, audit_basis}]`.

Measures required by the CMS:

```text
total_bookings, delivered_orders, pending_orders, confirmed_orders, active_orders,
cancelled_orders, failed_orders, gross_fare_revenue, gateway_collections,
wallet_funded_collections, cash_collections, processed_refunds,
rider_net_earnings, rider_paid_payouts, rider_wallet_balance, payouts_processing
```

`unit` is `COUNT | MONEY`; counts are integers and monetary values decimal strings. Split collections by actual method, not by screen copy. Return breakdowns rather than treating refunded captures as net settled revenue. Sum/refund/capture datasets must be pre-aggregated before joining to prevent double-counting order fares across payment attempts or multiple trips.

`GET /admin/reports/reconciliation` — **New API**, same authorization. Return control name/code, scope, expected amount/count, observed amount/count, difference, status `MATCHED | MISMATCH | NOT_CHECKED`, checked timestamp, evidence/source references. Gateway/bank settlement matching requires provider settlement evidence; current `PaymentEvent`/`DriverPayout` state alone does not prove “100% matched.” If provider statements are unavailable, return `NOT_CHECKED`.

`POST /admin/reports/reviews` — **New data + API** if the “Last finance review” field is editable. Body `{market_id, period_from, period_to, note, reason}`; record actor/time and append audit. Do not hardcode a finance review timestamp.

Use the shared export jobs in §10 for CSV/XLSX statements and multi-sheet packages. XLSX requires an actual writer and media type; changing a CSV filename to `.xlsx` is invalid.

### Domain 7. Marketing

#### 7.1 Existing coupons

All admin coupon endpoints require `pricing.manage`:

- `GET /admin/coupons` → all `CouponResponse[]`, no pagination or aggregate metrics.
- `POST /admin/coupons` → 201 `CouponResponse`.
- `PATCH /admin/coupons/{coupon_id}` → `CouponResponse`; accepts only `is_active?`, `valid_until?`, mandatory `reason` (3–255 characters). It is not a full coupon editor.

Valid create example:

```json
{
  "code": "BUSINESS10",
  "title": "Business delivery discount",
  "description": "Ten percent discount on eligible deliveries",
  "discount_type": "PERCENT",
  "discount_value": "10.00",
  "max_discount": "150.00",
  "min_fare": "199.00",
  "vehicle_type_codes": ["BIKE"],
  "valid_from": "2026-10-16T00:00:00+05:30",
  "valid_until": "2026-11-01T00:00:00+05:30",
  "max_uses_per_customer": 3
}
```

Constraints: `code` length 3–32 and alphanumeric/underscore/hyphen; title 1–120; description 1–255; type `PERCENT | FLAT`; value >0, max 2 decimal places; percent ≤100; cap >0; minimum fare ≥0; per-customer use cap ≥1; end after start. Code/vehicle codes are normalized. Duplicate coupon code returns 409 `COUPON_CODE_TAKEN`. Create has no `is_active` field; use PATCH if activation changes are needed.

`CouponRedemption`: coupon/user/order IDs, `discount_amount`, status `APPLIED | REVERSED`; one redemption per order. It supports usage/discount aggregates. It does not record impressions, views, budget, cashback credit, business-only eligibility or “first N B2B orders” eligibility.

`GET /offers/banners` is **customer-only**, derived from `settings.offer_banners` and active coupon validity. It returns `{id, image_url, alt_text, coupon_code, deep_link}[]`. There is no persisted admin banner-edit API. Do not call this customer route using an admin token as the CMS campaign registry.

#### 7.2 Required campaign APIs — new data + API

| Proposed method / path | Purpose / fields |
|---|---|
| `GET /admin/marketing/summary` | Live counts, attributed impressions, coupon usage, cashback/incentive ledger totals under market/date scope |
| `GET /admin/campaigns` | Filters `audience`, `status`, `format`, date/market, cursor; schedule/performance rows |
| `POST /admin/campaigns` | Create a DRAFT with title, audience `CUSTOMER|DRIVER`, format, placement, market, creative asset, optional coupon, start/end, deep link |
| `GET /admin/campaigns/{id}` | Campaign definition, schedule, attribution metrics and audit |
| `PATCH /admin/campaigns/{id}` | Validated editable fields plus reason and optimistic version |
| `POST /admin/campaigns/{id}/publish` | Validate eligibility, asset, schedule and publish; audited domain action |
| `POST /admin/campaigns/{id}/pause` | Reason required; preserve history |
| `GET /admin/coupons/usage` | Aggregate applied/reversed counts and amounts by coupon, not fake campaign impressions |
| `GET /admin/creative-assets` | Approved asset registry and metadata, cursor pagination |
| `POST /admin/creative-assets` | Validated multipart upload; storage metadata; safe content type and size limits |
| `GET /admin/incentive-programs` | Rider qualification, reward and claims |
| `POST /admin/incentive-programs` | DRAFT reward rule; requires separate reviewed reward-engine implementation |
| `GET /admin/incentive-claims` | Claim/credit statuses, driver/program, ledger references |

Proposed persisted entities: `campaigns`, `creative_assets`, `campaign_events` or an external analytics event store with ingestion/aggregation, `incentive_programs`, `incentive_claims`. Add frequency caps, dedupe keys, placement definitions, attribution windows, schedule timezone, and approved reward rules before production activation.

Cashback such as “₹40 after successful delivery” is **not** the current coupon discount. It needs an idempotent post-completion wallet credit and reversal policy, linked to the order, campaign and ledger reference. Incentive amount columns exist on earnings, but there is no program qualification/claim engine. Existing earnings DTO comments explicitly identify incentives as a placeholder/program gap. Do not award real incentives by writing an amount from the CMS form.

### Domain 8. Partners

#### 8.1 Existing entities and actions

`Customer` has `customer_number`, `customer_type`, `status`, `display_name`, language and currency. Join `User` for phone/email. The customer self-service profile upsert does not accept `customer_type`; it cannot register a business commercial account from an admin screen.

`Driver` has driver number, name, DOB, market, account/onboarding/compliance statuses, activation timestamp. Vehicle/owner/driver are distinct. Join `DriverVehicleAssignment` and `Vehicle` for current vehicle, and `User` for phone. `DriverBankAccount` stores encrypted account number and a separate last-four projection.

Existing KYC/admin endpoints:

| Route (all `/api/v1`) | Permission | Contract |
|---|---|---|
| `GET /admin/onboarding/pending` | `kyc.review` | `PendingOnboardingItem[]` |
| `GET /admin/verifications/pending` | `kyc.review` | `PendingVerificationItem[]` |
| `GET /admin/drivers/{id}/verification` | `kyc.review` | Documents, bank projections, vehicles, eligibility |
| `POST /admin/verifications/{id}/approve` / `reject` / `request-resubmission` | `kyc.review` | `ManualDecisionRequest` |
| `POST /admin/onboarding/{driver_id}/approve` | `kyc.review` | `{reason}` → `EligibilityResponse` |
| `POST /admin/onboarding/{driver_id}/reject` | `kyc.review` | `{reason}` → 204 |
| `POST /admin/assignments/{id}/approve` | `kyc.review` | `{reason}` → 204 |
| `POST /admin/drivers/{id}/suspend` | `drivers.manage` | `{reason, suspension_type, ends_at?}` → 204 |
| `POST /admin/drivers/{id}/reinstate` | `drivers.manage` | `{reason}` → 204 |

`ManualDecisionRequest`: `reason_code` (2–64), optional `note` (≤2000), optional `expiry_date`. `OnboardingDecisionRequest.reason`: 3–2000. Suspension types: `TEMPORARY | INDEFINITE | COMPLIANCE`.

KYC approval does not equal online availability. Call the existing `evaluate_driver_eligibility` policy when presenting eligibility; do not duplicate its rules in the CMS. Availability is operational state backed by Redis/active assignments (`AVAILABLE | ASSIGNED` in the current dispatch state; going offline deletes that Redis state); map AVAILABLE to Online and ASSIGNED to On delivery, and treat an absent state according to the offline/staleness policy. Historical availability sessions exist, but existing earnings `online_minutes` remains null; a reliable aggregate is not exposed.

#### 8.2 Proposed partner registry APIs

| Method / path | Status / contract |
|---|---|
| `GET /admin/partners/summary` | **New API**: registered/active customers, drivers, business accounts; online driver count; brand counts only after brand models exist |
| `GET /admin/drivers` | **New API**: market, q, account/onboarding/compliance/availability filters, cursor; see fields below |
| `GET /admin/drivers/{id}` | **New API**: profile, authorized contact, current vehicle and computed period activity |
| `GET /admin/customers` | **New API**: market/activity definition, q, customer_type, status, cursor; customer contact, period rides and revenue |
| `GET /admin/customers/{id}` | **New API**: authorized customer detail, ride/revenue summary; no customer impersonation |
| `POST /admin/driver-invitations` | **New data + API**: name, verified/normalized contact, market, invitation state. Do not create an approved driver from only name/email |
| `GET /admin/business-accounts` | **New data + API**: commercially configured BUSINESS customers, account code, store/warehouse count, terms, account manager |
| `POST /admin/business-accounts` | **New data + API**: customer link + commercial profile, validated terms and audited actor |
| `PATCH /admin/business-accounts/{id}` | **New data + API**: commercial profile changes; reason/version; approved billing rules |
| `GET /admin/brands` / `POST /admin/brands` | **New data + API**: advertiser legal/display name, contact, manager, status |
| `GET /admin/brand-campaigns` / `POST /admin/brand-campaigns` | **New data + API**: brand, creative/placement, flight dates, contracted ad value/currency, status |

Driver list item: `id`, `driver_number`, `first_name`, `last_name`, `phone_masked`, `primary_market_id`, `account_status`, `onboarding_status`, `compliance_status`, `availability`, `availability_as_of`, `current_vehicle`, `period_delivered_count`, `rating: decimal|null`, `rating_count: int|null`. Availability may need `UNKNOWN` if Redis is unavailable; do not silently label everyone offline.

Customer list item: `id`, `customer_number`, `display_name`, `customer_type`, `status`, authorized email/phone projection, `period_bookings_count`, `period_delivered_count`, `period_fare_revenue`, `currency`. A customer currently has no primary market field: filter by period order activity or introduce an explicit market association; document which is used.

Business-only fields need a linked `business_accounts` model, and location count needs a dedicated business-location relationship if it must distinguish stores from ordinary saved customer addresses. Brands are advertisers, not automatically transport customers or vehicle owners.

### Domain 9. Analytics

All following endpoints are **New API**, except unsupported metrics additionally need new data. Use common market/date scope, proposed `analytics.read`, bounded limits and stable ordering.

| Proposed route | Response `data` / fields | Source / blocker |
|---|---|---|
| `GET /admin/analytics/overview` | revenue, booking count, comparable changes, average rating, on-time rate, coverage flags | Orders/payments; ratings/SLA missing |
| `GET /admin/analytics/revenue` | `series: [{date, amount, bookings_count, comparison_amount}]`, totals | Completed orders and explicit revenue definition |
| `GET /admin/analytics/demand` | `series: [{date, bookings_count}]`, peak date/count | `orders.created_at` |
| `GET /admin/analytics/customers` | customer identity/type, revenue rank, delivered count/rank, revenue | Pre-aggregate delivered orders by customer |
| `GET /admin/analytics/areas` | area ID/name, bookings count/share, unclassified count | Pickup coordinates exist; locality taxonomy/assignment missing |
| `GET /admin/analytics/drivers` | driver, delivered count, rating, on-time rate, fare, earning/payout amounts, cancellations/rejections | Trip history, earnings/wallets, cancellations, offers; ratings/SLA missing |
| `GET /admin/analytics/ratings` | ride/order/driver/customer, numeric rating, comment, rated_at | **New data + API** |
| `GET /admin/analytics/cancellations` | totals by actor and reason, count/percent, unknown actor bucket | `OrderCancellation` and status history |

Rating storage proposal: `order_ratings(id, order_id UNIQUE, customer_id, driver_id, trip_id, rating CHECK 1..5, comment, created_at)` with eligibility, ownership and moderation rules. `POST /orders/{id}/rating` would be a **new customer endpoint**, not an existing route. Enforce delivered/unrated order and correct terminal driver/trip. Return null for unknown average/zero ratings, not zero stars.

On-time proposal: persist `promised_delivery_at`/SLA basis on order or service promise snapshot; compare with `completed_at` only for eligible deliveries; return `eligible_count`, `on_time_count`, `on_time_rate_percent`, `excluded_count`, `basis`. Decide whether failure/cancellation counts against SLA. No such target is currently present in Order.

Locality proposal: reference `pickup_areas` with market, name, geometry and a durable assignment/boundary policy, or an approved existing spatial dimension. `ServiceZone` is a serviceability polygon with priority; it is not guaranteed to be a locality. Overlapping zones need deterministic ownership to avoid double counting. “Other” and “Unclassified” must be explicit and sum consistently with the chosen cohort.

Driver performance must distinguish **orders** from **trip attempts**: reassignment can produce multiple trips for one order. Rejected offers (`DriverOffer.status=REJECTED`) are not cancelled orders. Use `OrderCancellation.actor_type` for customer/driver/admin/system cancellation buckets; do not assume all non-customer events are driver cancellations.

### Domain 10. Data imports, exports and transfer history

These are **New data + API**. Existing document/photo upload flows are not tabular imports. Do not send CSV/XLSX files to KYC upload endpoints.

#### Import workflow

`GET /admin/data/summary` — **New API** for transfer counters independent of paginated history: `imports_count`, `exports_count`, `committed_records`, nullable `last_transfer_at`, and `as_of`. Scope totals explicitly and never infer them from a limited list page. The local mock API implements this shape; the inspected FastAPI source still needs this endpoint or equivalent summary metadata.

| Method / path | Request | Response |
|---|---|---|
| `GET /admin/data/templates` | Dataset filter | Dataset list with schema/version and actual supported formats |
| `GET /admin/data/templates/{dataset}` | `format=csv|xlsx` | Real template file; support only implemented formats |
| `POST /admin/data/imports` | Multipart `dataset`, `file`, `schema_version`; idempotency key | 201/202 proposed ImportJob |
| `GET /admin/data/imports/{id}` | Authorized job UUID | State, row counts, field validation summary, owner/timestamps |
| `GET /admin/data/imports/{id}/errors` | cursor/limit or CSV error report format | Row number, column, stable code, message; redact sensitive values |
| `POST /admin/data/imports/{id}/validate` | Expected version, optional mapping | 202 staged validation job; no committed business changes |
| `POST /admin/data/imports/{id}/commit` | Expected version, approved row IDs or all-valid policy, reason; idempotency key | Accepted commit job; conflict if not validated/current |

Proposed ImportJob fields: `id`, `dataset`, `schema_version`, `original_filename`, `size_bytes`, `status`, `total_rows`, `valid_rows`, `invalid_rows`, `committed_rows`, `created_by`, `market_id`, `created_at`, `validated_at`, `committed_at`, `failure_code`, `failure_message`, `version`. Proposed states: `UPLOADED | VALIDATING | NEEDS_REVIEW | VALIDATED | COMMITTING | COMPLETED | FAILED`.

Required persistence: transfer/import jobs, staged records, row errors, commit references and audit. Raw file storage needs an authorized storage reference, retention policy, safe parser, content validation and bounded sizes. The screenshot's 20 MB is a proposed CMS requirement, not an existing generic upload limit. Reject oversize/unsupported files and protect against formula injection on exported untrusted cell text.

**Dataset mapping:**

- Customers: `display_name` maps to `Customer.display_name`, phone/email to `User`; schema version can accept `customer_name` as a CSV alias. Identity is per `(phone_e164, user_type)`, not phone across the entire platform. Importing a customer must not overwrite a driver/admin with the same phone or silently mark email verified.
- Riders: driver creation requires DOB, market, user identity and onboarding. Name/phone alone can create an invitation/staging record, not an ACTIVE driver. KYC/bank/document workflows remain authoritative.
- Business accounts: customer_type classification exists, but commercial metadata needs the new model from §8.
- Financial ledgers, payouts, balances and order lifecycle histories are not ordinary editable spreadsheet datasets. Any reconciliation import needs a dedicated workflow rather than direct ORM inserts.

Commit via owning domain services, preserving unique keys, validation, audit and transaction behavior; no direct overwrite of financial or immutable history tables. Duplicate handling and all-or-nothing versus valid-row partial commit must be explicit in the versioned template contract.

#### Export workflow

| Method / path | Request | Response |
|---|---|---|
| `POST /admin/data/exports` | JSON below; idempotency key | 202 ExportJob |
| `GET /admin/data/exports/{id}` | Job UUID | State, format, schema, counts, timestamps, expiry/failure details |
| `GET /admin/data/exports/{id}/download` | Bearer + ownership/permission recheck | Stream file or short-lived authorized URL |
| `GET /admin/data/transfers` | dataset/direction/status/market/date/cursor | Import/export history envelope |

```json
{
  "dataset": "order_register",
  "format": "csv",
  "market_id": "11111111-1111-4111-8111-111111111111",
  "from_date": "2026-10-01",
  "to_date": "2026-10-14",
  "fields": ["order_number", "customer_display_name", "status", "final_amount", "currency"],
  "filters": {"customer_type": "BUSINESS"},
  "contact_policy": "MASKED"
}
```

Allowlisted dataset examples: `order_register`, `customers`, `business_accounts`, `driver_settlements`, `finance_statement`, `reconciliation`. Dataset-specific permissions apply in addition to proposed `data.export`. Proposed job states: `QUEUED | PROCESSING | READY | FAILED | EXPIRED`. The query/period/snapshot/field schema must be frozen with the job. CSV uses `text/csv`; XLSX uses `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`. Full-contact exports require a distinct reviewed permission/approval contract; the screenshot mention does not mean the backend currently implements an approval system.

### Domain 11. Payments and settlements

#### 11.1 Existing contracts

| Method / path | Authorization | Request / response |
|---|---|---|
| `GET /payments/{payment_id}` | CurrentPrincipal; service allows ADMIN with `payments.read` or owning customer | `PaymentResponse` including refunds |
| `POST /payments/{payment_id}/refunds` | `payments.refund` | `RefundRequest`, required `Idempotency-Key`; declared 201, including replay of the same resource |
| `POST /payments/refunds/{refund_id}/retry` | `payments.refund` | `{reason: string(3..500)}`; retry existing refund → `RefundResponse` |
| `POST /payments/refunds/{refund_id}/close` | `payments.refund` | Reason; close confirmed unsuccessful refund; `RefundResponse` |
| `POST /admin/payouts/run` | `payouts.manage` | `{cadence, period_end?, reason}` → `PayoutResponse[]` |
| `POST /admin/payouts/{id}/retry` | `payouts.manage` | `PayoutResponse` |
| `POST /admin/payouts/{id}/mark-paid` | `payouts.manage` | `{reason: string(3..500)}` → `PayoutResponse` |
| `POST /admin/payouts/{id}/reverse` | `payouts.manage` | `{reason: string(3..500)}` → `PayoutResponse` |

`RefundRequest`: optional amount >0 with max 2 decimal places (omitted means service-defined remaining refund), reason 3–255, optional destination `SOURCE|WALLET`. Refund status values: `REQUESTED | PROCESSING | PROCESSED | FAILED | NEEDS_ATTENTION | CLOSED`. Cash refunds are an offline exception in the current service; do not imply every method can be refunded through a gateway.

`PayoutRunRequest.cadence`: `DAILY | WEEKLY | MANUAL`; optional timezone-aware `period_end`; default reason `scheduled payout run`. Existing admin run does not declare an `Idempotency-Key` header, a market selector, driver subset, preview token, or batch ID. Do not retry it automatically as though it were a dry-run idempotent request. The driver withdrawal endpoint separately implements idempotency; that does not establish a header contract for the admin run.

`PayoutResponse`: `id`, `payout_reference`, `driver_id`, `cadence`, `period_start`, `period_end`, `net_amount`, `currency`, `status`, nullable `paid_at`. Provider reference and bank data exist in storage but are not exposed in this response schema.

Current statuses:

```text
Payout: CREATED | PROCESSING | PAID | FAILED | NEEDS_ATTENTION | REVERSED
Earning: PENDING | PAYABLE | IN_PAYOUT | PAID | ON_HOLD | WALLET_SETTLED
Payment: CREATED | PENDING | AUTHORIZED | SUCCESS | FAILED | CANCELLED | PARTIALLY_REFUNDED | REFUNDED
```

`mark-paid`/`reverse` are reconciliation actions for unresolved payout outcomes. They are not arbitrary status editors. The backend must validate eligible states and evidence before any financial effect.

#### 11.2 Required admin reads — new APIs

- `GET /admin/settlements/summary`: selected market/period, `net_earnings_mtd`, `paid_payouts_mtd`, `driver_wallet_balance`, `eligible_withdrawable_balance`, `in_flight_payout_amount`, `needs_attention_amount`, `eligible_driver_count`, currency, as_of, calculation basis. “Due today”, next payout run and settlement due dates require a persisted/agreed schedule; return null until available.
- `GET /admin/settlements`: q, market, eligibility/status, cursor/limit; rows with driver ID/number/name, masked verified primary bank, period earnings, period paid payouts, current wallet balance, withdrawal eligibility/amount, in-flight payouts, nullable due date. Never label `earnings_mtd - paid_payouts_mtd` as a current balance.
- `GET /admin/payouts`: driver/market/date/status/cadence/cursor; enriched authorized payout projections.
- `GET /admin/payouts/{id}`: amounts, bank last4/name, provider reference, attempts/next retry, failure reason, timeline and related audit IDs. Include only safe provider metadata, never bank ciphertext/hash/full number.
- `GET /admin/payouts/{id}/receipt`: generated receipt with payout reference, paid timestamp, amount/currency, authorized masked bank destination and provider reference. A receipt must not claim payment for a non-PAID state.

#### 11.3 Prepare/confirm batches — new data + API

The screenshot's batch-level records `PB-...` and due-date summary cannot be constructed as durable batch entities from `DriverPayout` alone. If batch review is required, add `payout_batches` and batch membership, frozen preview criteria/version, actor/reason/timestamps, total/currency and state. Revalidate wallet eligibility at execution time; never reserve or pay by trusting frontend totals.

Proposed workflow:

1. `POST /admin/payout-batches/preview` → eligible/skipped driver counts, amounts, currency, market/scope, criteria hash/version and expiry. **No ledger posting or provider call.**
2. `POST /admin/payout-batches` with preview reference, explicit confirmation, reason, `Idempotency-Key` → durable batch, audited, queued for execution.
3. `GET /admin/payout-batches` and `GET /admin/payout-batches/{id}` → persisted state/counts/amounts/items.
4. Receipts/export via the authorized report/download flow.

Existing `PayoutService` and wallet posting rules must remain the financial authority. Unknown provider outcomes must be reconciled rather than blindly paid again. Withdrawal thresholds, cadence, bank verification policy and deduction rules remain configuration/business decisions; do not hardcode the screenshot's 18:00 schedule or 80% formula.

### Domain 12. Notifications, audit and support

**Existing**:

- `GET /admin/alerts`: `alerts.manage`; optional `status`, `cursor` ≤200 chars, `limit` default 50, 1–200. Response `{items: OpsAlertResponse[], next_cursor}`.
- `POST /admin/alerts/{id}/acknowledge`: `alerts.manage` → alert.
- `POST /admin/alerts/{id}/resolve`: `alerts.manage`; `{note: string(3..2000)}` → alert.
- `GET /admin/audit?entity_type=<string>&entity_id=<UUID>`: `audit.read` → matching `AuditEntry[]`.
- `GET /admin/admin-actions?entity_type=<string>&entity_id=<UUID>`: `audit.read` → matching `AdminActionEntry[]`.
- Admin support-ticket/chat routes exist; exact signatures are in the generated reference. They are not a substitute for missing sales-enquiry data.

Wire the bell to operational alerts that actually exist. The mock “64 payouts due”, “3 new enquiries” and import-validation notifications need the underlying new data before becoming real. Audit routes currently require a specific entity; they are not a general paginated site-wide transfer history.

### Domain 13. Metric definitions and schema gap checklist

| Metric / UI field | Proposed calculation / current limitation |
|---|---|
| Bookings | Count orders created in market-local date range; include every raw state; distinguish period cohort from current open workload |
| Delivered | Count order `DELIVERED` with `completed_at` in range; when grouped by booking cohort, return a separately labeled metric |
| Gross fare revenue | Sum `coalesce(final_amount, quoted_amount)` for eligible delivered orders by completion date; confirm inclusion/exclusion of waiting, tax, discount and cancellation fee; do not silently change accounting semantics |
| Collections | Captured-success payment amounts by paid timestamp and method/purpose; deduplicate attempts; refundable/refunded captures retain historical capture evidence |
| Refunds | Sum processed refund records by processed timestamp and destination; standard vs duplicate-capture refunds are separate kinds |
| Net collection | Define capture less processed refunds under consistent timing; wallet-funded orders and gateway cash-in are different cash-flow events |
| Customer activity | Distinct customers/order counts within explicit period and lifecycle basis; commercial “live partner” needs an agreed status definition |
| Rider earnings | Sum snapshotted `DriverEarning.net_amount` by `calculated_at`; preserve incentive, commission/tax/other deduction components |
| Settled payouts | Sum `DriverPayout.net_amount` with PAID and paid_at in range; not proof of bank-statement reconciliation |
| Current outstanding | Authoritative current wallet balance/eligible withdrawal and in-flight amounts; can be affected by cash collection, reversal and adjustments outside selected period |
| Driver on-time/rating | Return null + coverage/availability reason until SLA/rating source exists |
| Cancellation reasons | Group stored actor/reason including ADMIN/SYSTEM/unknown; preserve totals and denominators |
| Pickup area | Durable area classification, deterministic overlap handling, unclassified bucket; raw address substrings are not a stable dimension |
| Campaign impressions | Require instrumented events and dedupe/attribution; coupon redemption count is not impressions |
| Coupon cashback | Current coupons discount fare; separate reward credit workflow required |
| Due date / payout batch | No due-date field or durable batch model in current payout schema |
| Finance review | New review entity/action or explicit audited workflow required |

New persistence candidates, **not present as implemented CMS models**: commercial business profiles/locations; advertiser brands/ad contracts; campaigns/creative assets/events; rating records; SLA target snapshot; pickup locality dimension; incentive programs/claims/cashback references; enquiries/follow-up history; import/export/staging/error jobs; payout batches/preview membership; finance review/provider statement reconciliation evidence.

### Domain 14. Delivery order and acceptance criteria

1. **Integration foundation:** admin login/refresh/logout, workspace permissions/market reads; generated types from actual backend OpenAPI once dependencies are available.
2. **Operational reads:** enriched order register and counts; driver/customer registries; existing KYC/audit/alert actions. Preserve old mobile contracts.
3. **Financial reads:** reporting definitions, wallet-based settlement projections, admin payout lists and exports. Resolve ambiguous tax/waiting/cadence accounting before implementing calculations that depend on it.
4. **Workflow gaps:** staged imports/exports and preview/confirm payout batches with audit/idempotency and service ownership.
5. **New domains:** commercial partner metadata, campaigns/measurement, rewards, enquiries, ratings and SLA/localities. Until available, remove fake totals or show “Not available” with nullable values.

Acceptance criteria:

- Every CMS request has an existing route or a clearly marked implementation ticket from this document.
- Backend raw enums, UUIDs, money and timezone semantics survive the UI adapter; display labels do not become stored state.
- Empty and zero values differ from unsupported/null metrics; percentage denominators and cohorts are explicit.
- Search/filters and exports use the same authorized dataset and snapshot; pages do not claim global totals from a limited list response.
- Unauthorized contacts/bank data are not serialized; no hidden customer/driver impersonation.
- Aggregate queries avoid N+1 and multi-join multiplication; index query filters/order and bound range/limit.
- Financial actions preserve wallet/earning snapshots, unique business references, row-lock order and domain state machines.
- Any backend implementation touching transactions/migrations is verified with the repository's PostgreSQL/Redis tests and migration checks. Those checks were **not run** for this documentation-only task.

## 4. Mock workflow details, files and local testing

### Seed data

Default snapshot: `2026-10-14T09:00:00Z` (14:30 IST). Market timezone: `Asia/Kolkata`. Money values are decimal strings; currency is INR. All timestamps in examples are fixture timestamps, not the server's real clock.

| Dataset | Seeded data |
|---|---|
| Orders | 12,480 orders across 1–14 October 2026 |
| Order statuses | 11,200 delivered; 320 active; 280 confirmed; 200 unassigned; 480 cancelled |
| Delivered gross fare | `2856000.00` calculated from seeded final fares |
| Snapshot day | 960 bookings; `204000.00` delivered gross fare |
| Customers | 7 sample customers: Aarav Mehta, FreshMart, Neha Sharma, Bloom Studio, Rohan Gupta, Nest Home, Meera Iyer |
| Drivers | 96 sample drivers, including Ravi Kumar, Suresh Gowda and Imran Khan; one is still onboarding |
| Campaigns | 8 illustrative live campaigns |
| Coupons | RYNO40 flat discount and BUSINESS10 percent discount |
| Other resources | 3 business profiles, 2 brands, 1 ad campaign, 3 enquiries, 2 alerts, 4 historic paid payout fixtures |
| Not seeded | Real ratings, promised delivery targets, comparison periods, reward claims, bank statement evidence |

Counts derive from each API's actual fixtures. Do not assume the frontend screenshot's registered-user/driver totals are real API row counts. The backend's own seed dataset is also separate.

Deterministic fixture IDs:

```text
Bengaluru market: 11111111-1111-4111-8111-111111111111
First order:      00000002-0000-4000-8000-000000000001 (RY-10482)
FreshMart:        00000003-0000-4000-8000-000000000002
Ravi Kumar:       00000005-0000-4000-8000-000000000001
First campaign:   00000011-0000-4000-8000-000000000001
RYNO40 coupon:    00000012-0000-4000-8000-000000000001
```

### CSV exports

Create a frozen export snapshot. `Idempotency-Key` is required:

```sh
curl -X POST http://127.0.0.1:3000/api/v1/admin/data/exports \
  -H 'Authorization: Bearer mock-admin-token' \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: orders-example-001' \
  -d '{"dataset":"order_register","format":"csv","from_date":"2026-10-01","to_date":"2026-10-14","fields":["order_number","customer_display_name","status","final_amount","currency"],"filters":{"customer_type":"BUSINESS"}}'
```

Returns 202 with generated job ID, `status:"READY"`, `record_count` and `download_url`.

```sh
curl -H 'Authorization: Bearer mock-admin-token' \
  'http://127.0.0.1:3000/api/v1/admin/data/exports/REPLACE_WITH_JOB_ID/download' \
  -o orders.csv
```

Datasets: `order_register`, `customers`, `business_accounts`, `driver_settlements`, `finance_statement`, `reconciliation`. Format: CSV only; XLSX is rejected. Selected fields are allowlisted against the dataset projection. The snapshot does not change when later records are edited. JSON job responses omit the internal rows. CSV cells are quoted, and formula-leading untrusted values are escaped.

### CSV imports

CSV only, at most 20 MB and 10,000 data rows. Headers and at least one row are required. The parser handles quoted fields. Upload does not commit customer data.

```sh
# Download a template
curl -H 'Authorization: Bearer mock-admin-token' \
  http://127.0.0.1:3000/api/v1/admin/data/templates/customers \
  -o customers.csv

# Upload after filling the CSV
curl -X POST http://127.0.0.1:3000/api/v1/admin/data/imports \
  -H 'Authorization: Bearer mock-admin-token' \
  -F dataset=customers -F file=@customers.csv

# Use returned job id/version
curl -X POST http://127.0.0.1:3000/api/v1/admin/data/imports/REPLACE_WITH_JOB_ID/validate \
  -H 'Authorization: Bearer mock-admin-token' -H 'Content-Type: application/json' \
  -d '{"version":1}'

# Use the version returned by validation
curl -X POST http://127.0.0.1:3000/api/v1/admin/data/imports/REPLACE_WITH_JOB_ID/commit \
  -H 'Authorization: Bearer mock-admin-token' -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: customer-import-001' \
  -d '{"version":2,"reason":"Commit validated mock customers"}'
```

Required fields by dataset:

- `customers`: display_name, phone, email, city. Commit adds an INDIVIDUAL fixture with masked phone and unverified email.
- `riders`: first_name, phone, market_code. Commit creates mock pending invitations, never approved riders.
- `business_accounts`: display_name, customer_id, account_code; customer must already exist as BUSINESS.

Validation checks required fields, phone/email shape, duplicate phones within the uploaded file, and referenced business customers. It does not reproduce the real backend's identity verification, cross-file dedupe or full domain validation. Errors expose row/column/code/message, not source phone values. All rows must validate before commit; version and idempotency guards prevent stale/replayed commits. Raw staged rows are omitted from JSON detail/list/transfer responses.

States: UPLOADED → VALIDATED or NEEDS_REVIEW → COMPLETED after valid commit. Use `/admin/data/imports/{id}/errors` for errors and `/admin/data/transfers` for history. Jobs run synchronously in this mock; they are not a real queue.

`POST /admin/creative-assets` accepts multipart image file metadata up to 5 MB. It returns `url:null`, `status:METADATA_ONLY`; uploaded bytes are not persisted, served or published.

### Payout preview and simulation

```sh
curl -X POST http://127.0.0.1:3000/api/v1/admin/payout-batches/preview \
  -H 'Authorization: Bearer mock-admin-token' -H 'Content-Type: application/json' \
  -d '{}'

curl -X POST http://127.0.0.1:3000/api/v1/admin/payout-batches \
  -H 'Authorization: Bearer mock-admin-token' -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: payout-simulation-001' \
  -d '{"preview_id":"REPLACE_WITH_PREVIEW_ID","confirmed":true,"reason":"Review demo batch"}'
```

The second call returns a durable-for-this-process mock batch with `status:"SIMULATED"`. No wallet amount is debited and no bank/provider is contacted. A preview expires after 15 real minutes and cannot be confirmed twice. Same-key replay returns the same batch; changed body under that key returns 409.

`POST /admin/payouts/run` with `{cadence:"MANUAL"}` also returns a **simulation only**. This deliberately differs from the real backend endpoint, which creates/processes payouts. Do not port this call to the real backend without an explicit payment confirmation flow.

`GET /admin/payouts/{id}/receipt` only succeeds for a PAID fixture and returns JSON marked as a mock receipt. Due dates, next scheduled run and actual reconciliation remain null/NOT_CHECKED. Mock wallet balances are independent seeded projections; they are not calculated as selected-period earnings minus payouts.

### Errors and idempotency

```json
{
  "code": "VALIDATION_ERROR",
  "message": "limit must be an integer between 1 and 200",
  "details": {}
}
```

Codes include UNAUTHORIZED (401), NOT_FOUND (404), VALIDATION_ERROR (422), INVALID_JSON (400), VERSION_CONFLICT (409), IDEMPOTENCY_KEY_REUSED (409), IMPORT_NOT_VALIDATED (409), PREVIEW_USED (409), PREVIEW_EXPIRED (409), INVALID_ORDER_STATE (409).

Required idempotency keys: creating exports, committing imports, confirming payout batches. Keys are 4–128 characters. Other POST/PATCH operations optionally accept keys too. Scope is method + path + key; replay must use the exact same serialized body. Concurrent same-key requests are coalesced in the process. State is neither persistent nor distributed.

### Run and verify locally

From rno_cms: `npm run dev`, or `npx next build --webpack` then `npm run start`. Public route discovery: GET /api/v1. Protected calls use Authorization: Bearer mock-admin-token. Demo OTP `000000`; no SMS/email/wallet/provider effects. State resets on process restart and is not shared across replicas. Never use the fixed token as production JWT authentication.

Run `python3 scripts/test_mock_api.py` against the local mock only. This mutates mock memory and exercises auth, filters, cursors, validation, version conflicts, idempotency, CSV jobs/imports, alert actions and payout simulation. Backend database/provider tests are separate and were not run for this doc change.

### Additional file and financial examples

Exact current export allowlists (fields is a nonempty subset, or omitted for all):

| Dataset | Fields |
|---|---|
| order_register | order_number, customer_display_name, customer_type, status, payment_method_type, payment_timing, quoted_amount, final_amount, currency, created_at |
| customers | id, customer_number, display_name, customer_type, status, phone_masked, email |
| business_accounts | id, customer_id, display_name, account_code, location_count, payment_terms, status |
| driver_settlements | driver_id, driver_number, name, bank_account, driver_wallet_balance, eligible_withdrawable_amount, currency, due_date, in_flight_payout_amount, status, as_of |
| finance_statement | measure, label, value, unit, audit_basis |
| reconciliation | name, status, expected_amount, observed_amount, difference, reason |

Fake customer CSV upload content:

```csv
display_name,phone,email,city
Demo Customer,+919900000098,demo.customer@example.com,Bengaluru
```

Fake rider CSV (creates invitations):

```csv
first_name,phone,market_code
Demo Rider,+919900000097,BLR
```

Fake commercial CSV (existing BUSINESS customer required):

```csv
display_name,customer_id,account_code
Demo Business,00000003-0000-4000-8000-000000000002,DEMO-001
```

Example downloaded export is a CSV attachment, not JSON:

```csv
"order_number","customer_display_name","status","final_amount","currency"
"RY-DEMO-001","Demo Customer","DELIVERED","280.00","INR"
```

Existing refund request, `POST /api/v1/payments/{payment_id}/refunds`, payments.refund and Idempotency-Key required. amount optional (positive decimal; omitted means remaining refundable), reason required 3–255, destination SOURCE|WALLET optional subject to service policy:

```json
{
  "amount": "100.00",
  "reason": "Approved customer refund",
  "destination": "SOURCE"
}
```

Expected HTTP 201 RefundResponse example (also 201 on idempotent replay):

```json
{
  "id": "00000098-0000-4000-8000-000000000001",
  "refund_reference": "RF-DEMO-001",
  "kind": "STANDARD",
  "destination": "SOURCE",
  "amount": "100.00",
  "currency": "INR",
  "reason": "Approved customer refund",
  "status": "REQUESTED",
  "attempt_count": 0,
  "failure_reason": null,
  "requested_at": "2026-10-17T10:00:00Z",
  "processed_at": null
}
```

Retry/close existing refund routes take reason 3–500 and return HTTP 200 RefundResponse. Close requires the real service's verified no-money-moved resolution. Do not infer a completed refund from a requested one. Cash refunds require the actual supported policy, not an invented gateway action.

Example KYC decision body for approve/reject/request-resubmission (all require kyc.review):

```json
{
  "reason_code": "MANUAL_REVIEW",
  "note": "Reviewed submitted verification evidence",
  "expiry_date": "2028-10-17"
}
```

reason_code required 2–64; note optional <=2000; expiry_date optional according to document policy. Onboarding approve/reject and assignment approve use reason 3–2000. Approve onboarding returns EligibilityResponse; reject onboarding/approve assignment return204. Driver suspend/reinstate require drivers.manage; suspension type TEMPORARY|INDEFINITE|COMPLIANCE with optional ends_at. See existing DTO dictionary for the complete schemas. A reviewer action must not bypass eligibility/domain state checks.

## 5. Exact existing backend declarations

These static source declarations preserve current route parameters, DTO fields, enum values and dependencies for CMS-relevant existing APIs. Python DbSession/Redis/settings/permission dependencies are injected server-side, never browser input. No default means required; a nullable type alone is not an optional default. Route default status200 applies unless declared otherwise or handler explicitly returns another status. Response models and business services together define real behavior; this is not resolved runtime OpenAPI.

Existing admin pricing/support APIs are included as backend context even where no CMS action currently calls them. Unrelated mobile-only routes are outside this handoff.

### `POST /api/v1/auth/otp/request`

Source `backend/app/modules/auth/router.py:29`. Response `OtpChallengeResponse`; success `status.HTTP_202_ACCEPTED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `OtpRequest` | `None` |
| `db` | `DbSession` | `None` |
| `redis` | `RedisDep` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/auth/otp/verify`

Source `backend/app/modules/auth/router.py:35`. Response `AuthTokenResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `OtpVerifyRequest` | `None` |
| `request` | `Request` | `None` |
| `db` | `DbSession` | `None` |
| `redis` | `RedisDep` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/auth/refresh`

Source `backend/app/modules/auth/router.py:45`. Response `AuthTokenResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `RefreshRequest` | `None` |
| `request` | `Request` | `None` |
| `db` | `DbSession` | `None` |
| `redis` | `RedisDep` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/auth/logout`

Source `backend/app/modules/auth/router.py:53`. Response `None`; success `status.HTTP_204_NO_CONTENT`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `principal` | `CurrentPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `redis` | `RedisDep` | `None` |
| `settings` | `SettingsDep` | `None` |
| `body` | `LogoutRequest \| None` | `None` |

### `GET /api/v1/auth/me`

Source `backend/app/modules/auth/router.py:68`. Response `MeResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `principal` | `CurrentPrincipal` | `None` |
| `db` | `DbSession` | `None` |

### `GET /api/v1/vehicle-types`

Source `backend/app/modules/geography/router.py:68`. Response `list[VehicleTypeResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `CurrentPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/admin/vehicle-types`

Source `backend/app/modules/geography/router.py:147`. Response `VehicleTypeResponse`; success `status.HTTP_201_CREATED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `VehicleTypeCreate` | `None` |
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `GET /api/v1/admin/markets`

Source `backend/app/modules/geography/router.py:152`. Response `list[MarketResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/markets`

Source `backend/app/modules/geography/router.py:157`. Response `MarketResponse`; success `status.HTTP_201_CREATED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `MarketCreate` | `None` |
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/markets/{market_id}/zones`

Source `backend/app/modules/geography/router.py:162`. Response `ZoneResponse`; success `status.HTTP_201_CREATED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `market_id` | `uuid.UUID` | `None` |
| `body` | `ZoneCreate` | `None` |
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `GET /api/v1/admin/onboarding/pending`

Source `backend/app/modules/partner_onboarding/admin_router.py:34`. Response `list[PendingOnboardingItem]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `GET /api/v1/admin/verifications/pending`

Source `backend/app/modules/partner_onboarding/admin_router.py:39`. Response `list[PendingVerificationItem]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/verifications/{verification_id}/approve`

Source `backend/app/modules/partner_onboarding/admin_router.py:44`. Response `None`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `verification_id` | `uuid.UUID` | `None` |
| `body` | `ManualDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/verifications/{verification_id}/reject`

Source `backend/app/modules/partner_onboarding/admin_router.py:51`. Response `None`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `verification_id` | `uuid.UUID` | `None` |
| `body` | `ManualDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/verifications/{verification_id}/request-resubmission`

Source `backend/app/modules/partner_onboarding/admin_router.py:58`. Response `None`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `verification_id` | `uuid.UUID` | `None` |
| `body` | `ManualDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/onboarding/{driver_id}/approve`

Source `backend/app/modules/partner_onboarding/admin_router.py:67`. Response `EligibilityResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `body` | `OnboardingDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/onboarding/{driver_id}/reject`

Source `backend/app/modules/partner_onboarding/admin_router.py:73`. Response `None`; success `204`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `body` | `OnboardingDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/assignments/{assignment_id}/approve`

Source `backend/app/modules/partner_onboarding/admin_router.py:78`. Response `None`; success `204`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `assignment_id` | `uuid.UUID` | `None` |
| `body` | `OnboardingDecisionRequest` | `None` |
| `admin` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/drivers/{driver_id}/suspend`

Source `backend/app/modules/partner_onboarding/admin_router.py:85`. Response `None`; success `204`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `body` | `SuspendRequest` | `None` |
| `admin` | `DriverManager` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/drivers/{driver_id}/reinstate`

Source `backend/app/modules/partner_onboarding/admin_router.py:93`. Response `None`; success `204`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `body` | `OnboardingDecisionRequest` | `None` |
| `admin` | `DriverManager` | `None` |
| `db` | `DbSession` | `None` |

### `GET /api/v1/admin/drivers/{driver_id}/verification`

Source `backend/app/modules/partner_onboarding/admin_router.py:98`. Response `DriverComplianceView`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `_` | `KycReviewer` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/admin/pricing-plans`

Source `backend/app/modules/pricing/router.py:24`. Response `PlanResponse`; success `status.HTTP_201_CREATED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `PlanCreate` | `None` |
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/admin/pricing-plans/{plan_id}/activate`

Source `backend/app/modules/pricing/router.py:29`. Response `PlanResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `plan_id` | `uuid.UUID` | `None` |
| `_` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/payments/cash-collections`

Source `backend/app/modules/payment/router.py:76`. Response `PaymentResponse`; success `201`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `CashCollectionRequest` | `None` |
| `principal` | `DriverPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

Driver: the customer paid the amount due in cash. Pay-on-delivery single drop: allowed once the drop
code is verified, and completes the delivery in the same transaction. Multi-stop: after delivery. The
cash is debited from the driver wallet; the trip's net earning is credited at completion.

### `GET /api/v1/payments/{payment_id}`

Source `backend/app/modules/payment/router.py:100`. Response `PaymentResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payment_id` | `uuid.UUID` | `None` |
| `principal` | `CurrentPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/payments/{payment_id}/sync`

Source `backend/app/modules/payment/router.py:106`. Response `PaymentResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payment_id` | `uuid.UUID` | `None` |
| `principal` | `CustomerPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

Client says 'paid' -> the server verifies with the provider. Client success alone is never trusted.

### `POST /api/v1/payments/{payment_id}/retry`

Source `backend/app/modules/payment/router.py:122`. Response `PaymentResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payment_id` | `uuid.UUID` | `None` |
| `principal` | `CustomerPrincipal` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/payments/webhooks/{provider}`

Source `backend/app/modules/payment/router.py:128`. Response `dict`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `provider` | `str` | `None` |
| `request` | `Request` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

### `POST /api/v1/payments/{payment_id}/refunds`

Source `backend/app/modules/payment/router.py:139`. Response `RefundResponse`; success `201`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payment_id` | `uuid.UUID` | `None` |
| `body` | `RefundRequest` | `None` |
| `admin` | `Refunder` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `idempotency_key` | `Annotated[str \| None, Header(alias='Idempotency-Key')]` | `None` |

### `POST /api/v1/payments/refunds/{refund_id}/retry`

Source `backend/app/modules/payment/router.py:169`. Response `RefundResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `refund_id` | `uuid.UUID` | `None` |
| `body` | `RefundOpsRequest` | `None` |
| `admin` | `Refunder` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

Ops: start a fresh retry cycle for a refund that failed or needs attention (same provider reference).

### `POST /api/v1/payments/refunds/{refund_id}/close`

Source `backend/app/modules/payment/router.py:177`. Response `RefundResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `refund_id` | `uuid.UUID` | `None` |
| `body` | `RefundOpsRequest` | `None` |
| `admin` | `Refunder` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

Ops: after confirming with the provider that no money moved, stop retrying and free the refundable amount.

### `GET /api/v1/admin/coupons`

Source `backend/app/modules/coupon/router.py:123`. Response `list[CouponResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `admin` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/coupons`

Source `backend/app/modules/coupon/router.py:128`. Response `CouponResponse`; success `status.HTTP_201_CREATED`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `CouponCreate` | `None` |
| `admin` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `PATCH /api/v1/admin/coupons/{coupon_id}`

Source `backend/app/modules/coupon/router.py:155`. Response `CouponResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `coupon_id` | `uuid.UUID` | `None` |
| `body` | `CouponUpdate` | `None` |
| `admin` | `PricingAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/payouts/run`

Source `backend/app/modules/earnings/router.py:191`. Response `list[PayoutResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `body` | `PayoutRunRequest` | `None` |
| `admin` | `PayoutAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/admin/payouts/{payout_id}/retry`

Source `backend/app/modules/earnings/router.py:210`. Response `PayoutResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payout_id` | `uuid.UUID` | `None` |
| `admin` | `PayoutAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `POST /api/v1/admin/payouts/{payout_id}/mark-paid`

Source `backend/app/modules/earnings/router.py:255`. Response `PayoutResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payout_id` | `uuid.UUID` | `None` |
| `body` | `PayoutResolveRequest` | `None` |
| `admin` | `PayoutAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

Ops confirmed with the bank that an unresolved payout was paid.

### `POST /api/v1/admin/payouts/{payout_id}/reverse`

Source `backend/app/modules/earnings/router.py:263`. Response `PayoutResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `payout_id` | `uuid.UUID` | `None` |
| `body` | `PayoutResolveRequest` | `None` |
| `admin` | `PayoutAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

Ops confirmed with the bank that an unresolved payout was NOT paid: credit it back to the driver wallet.

### `GET /api/v1/admin/support/tickets`

Source `backend/app/modules/support/router.py:131`. Response `list[TicketResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `Agent` | `None` |
| `db` | `DbSession` | `None` |
| `status` | `str \| None` | `None` |

### `GET /api/v1/admin/support/tickets/{ticket_id}/messages`

Source `backend/app/modules/support/router.py:136`. Response `list[MessageResponse]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `ticket_id` | `uuid.UUID` | `None` |
| `admin` | `Agent` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/support/tickets/{ticket_id}/messages`

Source `backend/app/modules/support/router.py:142`. Response `MessageResponse`; success `201`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `ticket_id` | `uuid.UUID` | `None` |
| `body` | `MessageCreate` | `None` |
| `admin` | `Agent` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/support/tickets/{ticket_id}/assign`

Source `backend/app/modules/support/router.py:149`. Response `TicketResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `ticket_id` | `uuid.UUID` | `None` |
| `body` | `AssignRequest` | `None` |
| `admin` | `Agent` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/support/tickets/{ticket_id}/resolve`

Source `backend/app/modules/support/router.py:155`. Response `TicketResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `ticket_id` | `uuid.UUID` | `None` |
| `body` | `ResolveRequest` | `None` |
| `admin` | `Agent` | `None` |
| `db` | `DbSession` | `None` |

### `GET /api/v1/admin/support/chats/queue`

Source `backend/app/modules/support/chat_router.py:170`. Response `list[QueueItem]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `Agent` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `redis` | `RedisDep` | `None` |

### `POST /api/v1/admin/support/chats/{ticket_id}/claim`

Source `backend/app/modules/support/chat_router.py:175`. Response `SupportChatResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `ticket_id` | `uuid.UUID` | `None` |
| `admin` | `Agent` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `redis` | `RedisDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

### `GET /api/v1/admin/orders`

Source `backend/app/modules/admin/router.py:111`. Response `list[OrderSummary]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `status` | `str \| None` | `None` |
| `market_id` | `uuid.UUID \| None` | `None` |
| `limit` | `int` | `Query(default=50, ge=1, le=200)` |

### `GET /api/v1/admin/orders/{order_id}`

Source `backend/app/modules/admin/router.py:127`. Response `AdminOrderDetail`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `order_id` | `uuid.UUID` | `None` |
| `_` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |

### `GET /api/v1/admin/active-trips`

Source `backend/app/modules/admin/router.py:163`. Response `list[TripView]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/orders/{order_id}/cancel`

Source `backend/app/modules/admin/router.py:170`. Response `None`; success `204`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `order_id` | `uuid.UUID` | `None` |
| `body` | `AdminCancelRequest` | `None` |
| `admin` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

### `POST /api/v1/admin/orders/{order_id}/assign`

Source `backend/app/modules/admin/router.py:183`. Response `AssignmentView`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `order_id` | `uuid.UUID` | `None` |
| `body` | `AssignRequest` | `None` |
| `admin` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

### `POST /api/v1/admin/orders/{order_id}/reassign`

Source `backend/app/modules/admin/router.py:197`. Response `AssignmentView | None`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `order_id` | `uuid.UUID` | `None` |
| `body` | `ReassignRequest` | `None` |
| `admin` | `OrdersAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `settings` | `SettingsDep` | `None` |
| `background` | `BackgroundTasks` | `None` |

### `GET /api/v1/admin/audit`

Source `backend/app/modules/admin/router.py:211`. Response `list[AuditEntry]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `AuditReader` | `None` |
| `db` | `DbSession` | `None` |
| `entity_type` | `str` | `None` |
| `entity_id` | `uuid.UUID` | `None` |

### `GET /api/v1/admin/admin-actions`

Source `backend/app/modules/admin/router.py:222`. Response `list[AdminActionEntry]`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `_` | `AuditReader` | `None` |
| `db` | `DbSession` | `None` |
| `entity_type` | `str` | `None` |
| `entity_id` | `uuid.UUID` | `None` |

### `GET /api/v1/admin/alerts`

Source `backend/app/modules/ops_alert/router.py:18`. Response `OpsAlertListResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `admin` | `AlertsAdmin` | `None` |
| `db` | `DbSession` | `None` |
| `status` | `AlertStatus \| None` | `None` |
| `cursor` | `str \| None` | `Query(default=None, max_length=200)` |
| `limit` | `int` | `Query(default=50, ge=1, le=200)` |

### `POST /api/v1/admin/alerts/{alert_id}/acknowledge`

Source `backend/app/modules/ops_alert/router.py:30`. Response `OpsAlertResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `alert_id` | `uuid.UUID` | `None` |
| `admin` | `AlertsAdmin` | `None` |
| `db` | `DbSession` | `None` |

### `POST /api/v1/admin/alerts/{alert_id}/resolve`

Source `backend/app/modules/ops_alert/router.py:35`. Response `OpsAlertResponse`; success `200`.

| Parameter | Python type/dependency | Default |
|---|---|---|
| `alert_id` | `uuid.UUID` | `None` |
| `body` | `ResolveAlertRequest` | `None` |
| `admin` | `AlertsAdmin` | `None` |
| `db` | `DbSession` | `None` |

### Existing DTO and enum dictionary

#### `AdminActionEntry`

Source `backend/app/modules/admin/router.py:97`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `admin_user_id` | `uuid.UUID` | `None` |
| `action_type` | `str` | `None` |
| `entity_type` | `str` | `None` |
| `entity_id` | `uuid.UUID` | `None` |
| `reason` | `str` | `None` |
| `before_state` | `dict \| None` | `None` |
| `after_state` | `dict \| None` | `None` |
| `created_at` | `datetime` | `None` |

#### `AdminCancelRequest`

Source `backend/app/modules/admin/router.py:30`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason_code` | `str` | `Field(min_length=2, max_length=64)` |
| `note` | `str \| None` | `Field(default=None, max_length=1000)` |

#### `AdminOrderDetail`

Source `backend/app/modules/admin/router.py:76`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `order` | `dict` | `None` |
| `history` | `list[StatusHistoryItem]` | `None` |
| `assignments` | `list[AssignmentView]` | `None` |
| `trips` | `list[TripView]` | `None` |
| `payments` | `list[PaymentView]` | `None` |

#### `AlertStatus`

Source `backend/app/modules/ops_alert/models.py:13`; bases `StrEnum`.

Values: `{"OPEN": "'OPEN'", "ACKNOWLEDGED": "'ACKNOWLEDGED'", "RESOLVED": "'RESOLVED'"}`.

#### `AppType`

Source `backend/app/modules/auth/models.py:26`; bases `StrEnum`.

Values: `{"CUSTOMER": "'CUSTOMER'", "PARTNER": "'PARTNER'", "ADMIN": "'ADMIN'"}`.

#### `AssignRequest`

Source `backend/app/modules/support/router.py:57`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `assignee_user_id` | `uuid.UUID` | `None` |

#### `AssignmentView`

Source `backend/app/modules/admin/router.py:45`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `driver_id` | `uuid.UUID` | `None` |
| `vehicle_id` | `uuid.UUID` | `None` |
| `source` | `str` | `None` |
| `status` | `str` | `None` |
| `assigned_at` | `datetime` | `None` |
| `release_reason` | `str \| None` | `None` |

#### `AuditEntry`

Source `backend/app/modules/admin/router.py:84`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `actor_user_id` | `uuid.UUID \| None` | `None` |
| `actor_type` | `str` | `None` |
| `action` | `str` | `None` |
| `entity_type` | `str` | `None` |
| `entity_id` | `uuid.UUID` | `None` |
| `correlation_id` | `str \| None` | `None` |
| `details` | `dict \| None` | `None` |
| `created_at` | `datetime` | `None` |

#### `AuthTokenResponse`

Source `backend/app/modules/auth/schemas.py:59`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `access_token` | `str` | `None` |
| `refresh_token` | `str` | `None` |
| `token_type` | `str` | `'bearer'` |
| `expires_in_seconds` | `int` | `None` |
| `is_new_user` | `bool` | `None` |
| `user` | `AuthUser` | `None` |

#### `AuthUser`

Source `backend/app/modules/auth/schemas.py:41`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `user_type` | `str` | `None` |
| `status` | `str` | `None` |
| `phone_masked` | `str` | `None` |
| `phone` | `str` | `None` |
| `email` | `str \| None` | `None` |
| `email_verified` | `bool` | `None` |
| `name` | `str \| None` | `None` |
| `profile_complete` | `bool` | `None` |
| `customer_status` | `str \| None` | `None` |
| `onboarding_status` | `str \| None` | `None` |
| `driver_account_status` | `str \| None` | `None` |

#### `BankAccountResponse`

Source `backend/app/modules/driver/schemas.py:94`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `account_number_last4` | `str` | `None` |
| `ifsc` | `str` | `None` |
| `holder_name` | `str` | `None` |
| `bank_name` | `str \| None` | `None` |
| `verification_status` | `str` | `None` |
| `is_primary` | `bool` | `None` |
| `verified_at` | `datetime \| None` | `None` |

#### `CashCollectionRequest`

Source `backend/app/modules/payment/schemas.py:16`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `trip_id` | `uuid.UUID` | `None` |

#### `CouponCreate`

Source `backend/app/modules/coupon/router.py:61`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `code` | `str` | `Field(min_length=3, max_length=32, pattern='^[A-Za-z0-9_-]+$')` |
| `title` | `str` | `Field(min_length=1, max_length=120)` |
| `description` | `str` | `Field(min_length=1, max_length=255)` |
| `discount_type` | `DiscountType` | `None` |
| `discount_value` | `Decimal` | `Field(gt=0, max_digits=10, decimal_places=2)` |
| `max_discount` | `Decimal \| None` | `Field(default=None, gt=0, max_digits=10, decimal_places=2)` |
| `min_fare` | `Decimal \| None` | `Field(default=None, ge=0, max_digits=10, decimal_places=2)` |
| `vehicle_type_codes` | `list[str] \| None` | `None` |
| `valid_from` | `datetime \| None` | `None` |
| `valid_until` | `datetime \| None` | `None` |
| `max_uses_per_customer` | `int \| None` | `Field(default=None, ge=1)` |

#### `CouponResponse`

Source `backend/app/modules/coupon/router.py:25`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `code` | `str` | `None` |
| `title` | `str` | `None` |
| `description` | `str` | `None` |
| `discount_type` | `str` | `None` |
| `discount_value` | `Decimal` | `None` |
| `max_discount` | `Decimal \| None` | `None` |
| `min_fare` | `Decimal \| None` | `None` |
| `vehicle_type_codes` | `list[str] \| None` | `None` |
| `valid_from` | `datetime \| None` | `None` |
| `valid_until` | `datetime \| None` | `None` |
| `max_uses_per_customer` | `int \| None` | `None` |
| `is_active` | `bool` | `None` |

#### `CouponUpdate`

Source `backend/app/modules/coupon/router.py:83`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `is_active` | `bool \| None` | `None` |
| `valid_until` | `datetime \| None` | `None` |
| `reason` | `str` | `Field(min_length=3, max_length=255)` |

#### `DeviceInfo`

Source `backend/app/modules/auth/schemas.py:19`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `device_uuid` | `str` | `Field(min_length=4, max_length=128)` |
| `platform` | `Literal['ANDROID', 'IOS', 'WEB']` | `None` |
| `app_version` | `str \| None` | `Field(default=None, max_length=32)` |
| `push_token` | `str \| None` | `Field(default=None, max_length=512)` |

#### `DiscountType`

Source `backend/app/modules/coupon/models.py:12`; bases `StrEnum`.

Values: `{"PERCENT": "'PERCENT'", "FLAT": "'FLAT'"}`.

#### `DocumentResponse`

Source `backend/app/modules/driver/schemas.py:71`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `document_type` | `str` | `None` |
| `identifier_masked` | `str \| None` | `None` |
| `name_on_document` | `str \| None` | `None` |
| `issue_date` | `date \| None` | `None` |
| `expiry_date` | `date \| None` | `None` |
| `verification_status` | `str` | `None` |
| `verification_source` | `str \| None` | `None` |
| `verified_at` | `datetime \| None` | `None` |
| `rejection_reason` | `str \| None` | `None` |
| `has_front` | `bool` | `None` |
| `has_back` | `bool` | `None` |

#### `DriverComplianceView`

Source `backend/app/modules/partner_onboarding/schemas.py:66`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `driver_number` | `str` | `None` |
| `account_status` | `str` | `None` |
| `onboarding_status` | `str` | `None` |
| `documents` | `list[DocumentResponse]` | `None` |
| `bank_accounts` | `list[BankAccountResponse]` | `None` |
| `vehicles` | `list[VehicleResponse]` | `None` |
| `vehicle_documents` | `list[VehicleDocumentResponse]` | `None` |
| `eligibility` | `EligibilityResponse` | `None` |

#### `EligibilityResponse`

Source `backend/app/modules/partner_onboarding/schemas.py:27`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `online_allowed` | `bool` | `None` |
| `reasons` | `list[str]` | `None` |
| `vehicle_id` | `uuid.UUID \| None` | `None` |

#### `LogoutRequest`

Source `backend/app/modules/auth/schemas.py:37`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `all_sessions` | `bool` | `False` |

#### `ManualDecisionRequest`

Source `backend/app/modules/partner_onboarding/schemas.py:50`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason_code` | `str` | `Field(min_length=2, max_length=64)` |
| `note` | `str \| None` | `Field(default=None, max_length=2000)` |
| `expiry_date` | `date \| None` | `None` |

#### `MarketCreate`

Source `backend/app/modules/geography/schemas.py:6`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `code` | `str` | `Field(pattern='^[A-Z0-9_]{2,16}$')` |
| `name` | `str` | `Field(min_length=1, max_length=100)` |
| `state` | `str` | `Field(min_length=1, max_length=100)` |
| `timezone` | `str` | `'Asia/Kolkata'` |
| `currency` | `str` | `Field(default='INR', pattern='^[A-Z]{3}$')` |

#### `MarketResponse`

Source `backend/app/modules/geography/schemas.py:14`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `code` | `str` | `None` |
| `name` | `str` | `None` |
| `state` | `str` | `None` |
| `timezone` | `str` | `None` |
| `currency` | `str` | `None` |
| `is_active` | `bool` | `None` |

#### `MessageCreate`

Source `backend/app/modules/support/router.py:27`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `message` | `str` | `Field(min_length=1, max_length=5000)` |
| `internal` | `bool` | `False` |

#### `MessageResponse`

Source `backend/app/modules/support/router.py:46`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `sender_type` | `str` | `None` |
| `message` | `str` | `None` |
| `is_internal` | `bool` | `None` |
| `created_at` | `datetime` | `None` |
| `actions` | `list[dict[str, str]] \| None` | `None` |
| `client_message_id` | `str \| None` | `None` |

#### `OnboardingDecisionRequest`

Source `backend/app/modules/partner_onboarding/schemas.py:56`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason` | `str` | `Field(min_length=3, max_length=2000)` |

#### `OpsAlertListResponse`

Source `backend/app/modules/ops_alert/schemas.py:28`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `items` | `list[OpsAlertResponse]` | `None` |
| `next_cursor` | `str \| None` | `None` |

#### `OpsAlertResponse`

Source `backend/app/modules/ops_alert/schemas.py:7`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `alert_type` | `str` | `None` |
| `severity` | `str` | `None` |
| `status` | `str` | `None` |
| `title` | `str` | `None` |
| `details` | `dict[str, str]` | `None` |
| `related_entity_type` | `str \| None` | `None` |
| `related_entity_id` | `uuid.UUID \| None` | `None` |
| `occurrence_count` | `int` | `None` |
| `created_at` | `datetime` | `None` |
| `last_seen_at` | `datetime` | `None` |
| `acknowledged_by` | `uuid.UUID \| None` | `None` |
| `acknowledged_at` | `datetime \| None` | `None` |
| `resolved_by` | `uuid.UUID \| None` | `None` |
| `resolved_at` | `datetime \| None` | `None` |
| `resolution_note` | `str \| None` | `None` |

#### `OrderSummary`

Source `backend/app/modules/booking/schemas.py:143`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `order_number` | `str` | `None` |
| `status` | `str` | `None` |
| `quoted_amount` | `Decimal` | `None` |
| `final_amount` | `Decimal \| None` | `None` |
| `currency` | `str` | `None` |
| `created_at` | `datetime` | `None` |

#### `OtpChallengeResponse`

Source `backend/app/modules/auth/schemas.py:14`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `phone_masked` | `str` | `None` |
| `expires_in_seconds` | `int` | `None` |

#### `OtpRequest`

Source `backend/app/modules/auth/schemas.py:9`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `phone` | `str` | `Field(min_length=6, max_length=20)` |
| `app_type` | `AppType` | `None` |

#### `OtpVerifyRequest`

Source `backend/app/modules/auth/schemas.py:26`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `phone` | `str` | `Field(min_length=6, max_length=20)` |
| `app_type` | `AppType` | `None` |
| `code` | `str` | `Field(pattern='^\\d{4,8}$')` |
| `device` | `DeviceInfo` | `None` |

#### `OwnerAuthorizationResponse`

Source `backend/app/modules/vehicle/schemas.py:76`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `status` | `str` | `None` |
| `noc_uploaded` | `bool` | `None` |
| `owner_otp_verified` | `bool` | `None` |
| `owner_phone_masked` | `str` | `None` |
| `valid_from` | `datetime` | `None` |
| `valid_until` | `datetime \| None` | `None` |

#### `PaymentResponse`

Source `backend/app/modules/payment/schemas.py:47`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `order_id` | `uuid.UUID` | `None` |
| `payment_reference` | `str` | `None` |
| `purpose` | `str` | `None` |
| `payment_method_type` | `str` | `None` |
| `provider` | `str` | `None` |
| `provider_order_id` | `str \| None` | `None` |
| `amount` | `Decimal` | `None` |
| `refunded_amount` | `Decimal` | `None` |
| `currency` | `str` | `None` |
| `status` | `str` | `None` |
| `paid_at` | `datetime \| None` | `None` |
| `failure_code` | `str \| None` | `None` |
| `refunds` | `list[RefundResponse]` | `[]` |

#### `PaymentView`

Source `backend/app/modules/admin/router.py:67`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `purpose` | `str` | `None` |
| `status` | `str` | `None` |
| `amount` | `Decimal` | `None` |
| `refunded_amount` | `Decimal` | `None` |

#### `PayoutResolveRequest`

Source `backend/app/modules/earnings/router.py:250`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason` | `str` | `Field(min_length=3, max_length=500)` |

#### `PayoutResponse`

Source `backend/app/modules/earnings/router.py:73`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `payout_reference` | `str` | `None` |
| `driver_id` | `uuid.UUID` | `None` |
| `cadence` | `str` | `None` |
| `period_start` | `datetime` | `None` |
| `period_end` | `datetime` | `None` |
| `net_amount` | `Decimal` | `None` |
| `currency` | `str` | `None` |
| `status` | `str` | `None` |
| `paid_at` | `datetime \| None` | `None` |

#### `PayoutRunRequest`

Source `backend/app/modules/earnings/router.py:91`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `cadence` | `Literal['DAILY', 'WEEKLY', 'MANUAL']` | `None` |
| `period_end` | `datetime \| None` | `None` |
| `reason` | `str` | `'scheduled payout run'` |

#### `PendingOnboardingItem`

Source `backend/app/modules/partner_onboarding/schemas.py:33`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `driver_id` | `uuid.UUID` | `None` |
| `driver_number` | `str` | `None` |
| `name` | `str` | `None` |
| `onboarding_status` | `str` | `None` |
| `submitted_at` | `datetime \| None` | `None` |

#### `PendingVerificationItem`

Source `backend/app/modules/partner_onboarding/schemas.py:41`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `verification_id` | `uuid.UUID` | `None` |
| `subject` | `str` | `None` |
| `subject_id` | `uuid.UUID` | `None` |
| `verification_type` | `str` | `None` |
| `status` | `str` | `None` |
| `requested_at` | `datetime` | `None` |

#### `PlanCreate`

Source `backend/app/modules/pricing/schemas.py:17`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `name` | `str` | `Field(min_length=1, max_length=160)` |
| `market_id` | `uuid.UUID` | `None` |
| `vehicle_type_id` | `uuid.UUID` | `None` |
| `effective_from` | `datetime \| None` | `None` |
| `rules` | `list[RuleInput]` | `Field(min_length=1)` |

#### `PlanResponse`

Source `backend/app/modules/pricing/schemas.py:25`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `name` | `str` | `None` |
| `market_id` | `uuid.UUID` | `None` |
| `vehicle_type_id` | `uuid.UUID` | `None` |
| `status` | `str` | `None` |
| `version` | `int` | `None` |
| `effective_from` | `datetime` | `None` |
| `effective_until` | `datetime \| None` | `None` |

#### `ReassignRequest`

Source `backend/app/modules/admin/router.py:40`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `driver_id` | `uuid.UUID \| None` | `None` |
| `reason` | `str` | `Field(min_length=3, max_length=500)` |

#### `RefreshRequest`

Source `backend/app/modules/auth/schemas.py:33`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `refresh_token` | `str` | `Field(min_length=20, max_length=256)` |

#### `RefundDestination`

Source `backend/app/modules/payment/models.py:159`; bases `StrEnum`.

Values: `{"SOURCE": "'SOURCE'", "WALLET": "'WALLET'"}`.

#### `RefundOpsRequest`

Source `backend/app/modules/payment/schemas.py:27`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason` | `str` | `Field(min_length=3, max_length=500)` |

#### `RefundRequest`

Source `backend/app/modules/payment/schemas.py:20`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `amount` | `Decimal \| None` | `Field(default=None, gt=0, max_digits=14, decimal_places=2)` |
| `reason` | `str` | `Field(min_length=3, max_length=255)` |
| `destination` | `RefundDestination \| None` | `None` |

#### `RefundResponse`

Source `backend/app/modules/payment/schemas.py:31`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `refund_reference` | `str` | `None` |
| `kind` | `str` | `None` |
| `destination` | `str` | `None` |
| `amount` | `Decimal` | `None` |
| `currency` | `str` | `None` |
| `reason` | `str` | `None` |
| `status` | `str` | `None` |
| `attempt_count` | `int` | `0` |
| `failure_reason` | `str \| None` | `None` |
| `requested_at` | `datetime` | `None` |
| `processed_at` | `datetime \| None` | `None` |

#### `ResolveAlertRequest`

Source `backend/app/modules/ops_alert/schemas.py:33`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `note` | `str` | `Field(min_length=3, max_length=2000)` |

#### `ResolveRequest`

Source `backend/app/modules/support/router.py:61`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `note` | `str` | `Field(min_length=3, max_length=2000)` |

#### `RuleInput`

Source `backend/app/modules/pricing/schemas.py:10`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `rule_type` | `RuleType` | `None` |
| `amount` | `Decimal \| None` | `Field(default=None, ge=0, max_digits=14, decimal_places=2)` |
| `percentage` | `Decimal \| None` | `Field(default=None, ge=0, le=100)` |
| `threshold` | `Decimal \| None` | `Field(default=None, ge=0)` |

#### `RuleType`

Source `backend/app/modules/pricing/models.py:20`; bases `StrEnum`.

Values: `{"BASE_FARE": "'BASE_FARE'", "MINIMUM_FARE": "'MINIMUM_FARE'", "PER_KM": "'PER_KM'", "PER_MINUTE": "'PER_MINUTE'", "WAITING_PER_MINUTE": "'WAITING_PER_MINUTE'", "FREE_WAITING_MINUTES": "'FREE_WAITING_MINUTES'", "EXTRA_STOP": "'EXTRA_STOP'", "NIGHT_SURCHARGE": "'NIGHT_SURCHARGE'", "SURGE_MULTIPLIER": "'SURGE_MULTIPLIER'", "PLATFORM_FEE": "'PLATFORM_FEE'", "CANCELLATION_FEE": "'CANCELLATION_FEE'", "TAX_PERCENTAGE": "'TAX_PERCENTAGE'", "DRIVER_COMMISSION_PERCENTAGE": "'DRIVER_COMMISSION_PERCENTAGE'", "CANCELLATION_COMPENSATION_PER_KM": "'CANCELLATION_COMPENSATION_PER_KM'"}`.

#### `StatusHistoryItem`

Source `backend/app/modules/booking/schemas.py:175`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `from_status` | `str \| None` | `None` |
| `to_status` | `str` | `None` |
| `actor_type` | `str` | `None` |
| `reason` | `str \| None` | `None` |
| `created_at` | `datetime` | `None` |

#### `SuspendRequest`

Source `backend/app/modules/partner_onboarding/schemas.py:60`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `reason` | `str` | `Field(min_length=3, max_length=2000)` |
| `suspension_type` | `str` | `Field(pattern='^(TEMPORARY\|INDEFINITE\|COMPLIANCE)$')` |
| `ends_at` | `datetime \| None` | `None` |

#### `TicketResponse`

Source `backend/app/modules/support/router.py:32`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `ticket_number` | `str` | `None` |
| `category` | `str` | `None` |
| `priority` | `str` | `None` |
| `status` | `str` | `None` |
| `subject` | `str` | `None` |
| `order_id` | `uuid.UUID \| None` | `None` |
| `assigned_to_user_id` | `uuid.UUID \| None` | `None` |
| `resolution_note` | `str \| None` | `None` |
| `created_at` | `datetime` | `None` |

#### `TripView`

Source `backend/app/modules/admin/router.py:56`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `trip_number` | `str` | `None` |
| `order_id` | `uuid.UUID` | `None` |
| `driver_id` | `uuid.UUID` | `None` |
| `status` | `str` | `None` |
| `attempt_number` | `int` | `None` |
| `created_at` | `datetime` | `None` |

#### `VehicleCategory`

Source `backend/app/modules/vehicle/models.py:27`; bases `StrEnum`.

Values: `{"TWO_WHEELER": "'TWO_WHEELER'", "THREE_WHEELER": "'THREE_WHEELER'", "MINI_TRUCK": "'MINI_TRUCK'", "PICKUP_TRUCK": "'PICKUP_TRUCK'", "LARGE_TRUCK": "'LARGE_TRUCK'"}`.

#### `VehicleDocumentResponse`

Source `backend/app/modules/vehicle/schemas.py:109`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `vehicle_id` | `uuid.UUID` | `None` |
| `document_type` | `str` | `None` |
| `identifier_masked` | `str \| None` | `None` |
| `issue_date` | `date \| None` | `None` |
| `expiry_date` | `date \| None` | `None` |
| `verification_status` | `str` | `None` |
| `verification_source` | `str \| None` | `None` |
| `rejection_reason` | `str \| None` | `None` |

#### `VehicleResponse`

Source `backend/app/modules/vehicle/schemas.py:87`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `registration_number` | `str` | `None` |
| `vehicle_type_code` | `str` | `None` |
| `make` | `str` | `None` |
| `model` | `str` | `None` |
| `fuel_type` | `str` | `None` |
| `status` | `str` | `None` |
| `relationship_type` | `str` | `None` |
| `assignment_status` | `str` | `None` |
| `owner_authorization` | `OwnerAuthorizationResponse \| None` | `None` |

#### `VehicleTypeCreate`

Source `backend/app/modules/vehicle/schemas.py:12`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `code` | `str` | `Field(pattern='^[A-Z0-9_]{2,32}$')` |
| `display_name` | `str` | `Field(min_length=1, max_length=100)` |
| `category` | `VehicleCategory` | `None` |
| `max_payload_kg` | `Decimal` | `Field(gt=0, max_digits=10, decimal_places=2)` |
| `cargo_length_cm` | `int \| None` | `Field(default=None, gt=0)` |
| `cargo_width_cm` | `int \| None` | `Field(default=None, gt=0)` |
| `cargo_height_cm` | `int \| None` | `Field(default=None, gt=0)` |
| `requires_commercial_permit` | `bool` | `False` |
| `requires_fitness_certificate` | `bool` | `False` |
| `sort_order` | `int` | `0` |
| `is_active` | `bool` | `True` |

#### `VehicleTypeResponse`

Source `backend/app/modules/vehicle/schemas.py:26`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `code` | `str` | `None` |
| `display_name` | `str` | `None` |
| `category` | `str` | `None` |
| `max_payload_kg` | `Decimal` | `None` |
| `cargo_length_cm` | `int \| None` | `None` |
| `cargo_width_cm` | `int \| None` | `None` |
| `cargo_height_cm` | `int \| None` | `None` |
| `requires_commercial_permit` | `bool` | `None` |
| `requires_fitness_certificate` | `bool` | `None` |
| `is_active` | `bool` | `None` |
| `image_url` | `str` | `None` |

#### `ZoneCreate`

Source `backend/app/modules/geography/schemas.py:25`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `name` | `str` | `Field(min_length=1, max_length=100)` |
| `zone_type` | `str` | `Field(default='SERVICEABLE', pattern='^(SERVICEABLE\|RESTRICTED)$')` |
| `boundary` | `list[tuple[float, float]]` | `Field(min_length=3)` |
| `priority` | `int` | `0` |

#### `ZoneResponse`

Source `backend/app/modules/geography/schemas.py:41`; bases `BaseModel`.

| Field | Type | Default/constraints |
|---|---|---|
| `id` | `uuid.UUID` | `None` |
| `market_id` | `uuid.UUID` | `None` |
| `name` | `str` | `None` |
| `zone_type` | `str` | `None` |
| `priority` | `int` | `None` |
| `is_active` | `bool` | `None` |

## 6. Production integration corrections and decisions

`contact_policy` in the domain export proposal is not accepted/enforced by the current mock; masking is server-owned. Treat new contact-access modes as a separately authorized extension, never an arbitrary client bypass.

- Keep existing mobile response contracts; add enriched CMS routes. Do not register /admin/orders/summary behind the existing UUID detail route: use /admin/order-register/summary. Mock-only alias is not a production requirement.
- Current period data uses a booking-created_at cohort, including delivered fare series. Finance may require completed_at recognition instead: agree and expose audit_basis, comparison cohort and fiscal periods. Current statement rows use value/unit/audit_basis, not mtd/ytd keys, with ytd_period:null. Full YTD and collections/refunds/tax measures need real data and an additive schema agreed with CMS.
- Revenue points currently use amount/bookings_count/comparison_amount. Driver/customer list activity fields are period_delivered_count and period_fare_revenue; raw mock detail may omit these, so production detail projections must explicitly include fields displayed by the UI.
- Registries/wallets are current snapshot reads. A customer's market association is not persisted; agree activity-based filtering or add explicit market links. Do not reconstruct historical registry counts from current rows.
- Current coupon usage totals and campaign counters are illustrative. In particular percentage-coupon discount_amount must come from actual CouponRedemption amounts, never percent multiplied by count. Campaign events, attribution and incentive/credit ledger links need implementation.
- Missing ratings/SLA/comparison metrics remain null, reconciliation NOT_CHECKED. Driver analytics mock rejected_offers_count=0 is a placeholder, not real evidence; use actual REJECTED offers or report unavailable. Areas and cancellation attribution are synthetic until sourced from durable locality/cancellation data.
- Exports: current frontend expects immediate READY/download_url after202. If production queues work, add GET-job polling and failure/expiry UI before downloading. Apply identical authorized dataset filters to screen and export; mock non-order registry exports do not yet implement every list filter. Flatten agreed masked bank columns for CSV instead of serializing a bank object implicitly. XLSX remains unsupported until real writer/parser exists.
- Real file storage must persist and validate creative bytes; current mock url:null/METADATA_ONLY is intentional. Require actual asset/coupon references for publish once those fields/models are introduced.
- Payout preview must persist exact membership, criteria hash, expiry and current eligibility; confirmation must be durable and idempotent, with row locks and per-member outcomes. Real batch status/201-or202/polling contract needs agreement before replacing SIMULATED. Existing /admin/payouts/run processes real funds and returns an array, unlike mock simulation; opening Prepare must never invoke it.
- Wallet balances are not MTD earnings minus payouts; no fixed80% commission rule. Reuse snapshotted earning components and wallet ledger. Due dates/schedules stay null until configured; provider reconciliation requires actual evidence.
- Replace the demo token with ADMIN OTP/device/session/refresh flow. Seed new grants, enforce authorized markets, redact bank/PII fields and preserve immutable audits. Mock authentication has no real permission isolation.
- Resolve tax/TDS, waiting/prepaid adjustments, payout cadence, reward qualification/reversals, SLA denominator, rating moderation and locality boundaries using actual service behavior and the backend implementation-decisions ADR. Do not invent business policy from screenshot copy.

Acceptance: all required routes have runtime schemas and permission tests; filters/counts/exports agree; empty/null are distinct; version/cursor/duplicate/concurrent/error cases are tested; PostgreSQL/Redis transactions, migrations and wallet invariants pass the backend suite. Compare deployed OpenAPI against this single handoff after implementation.

Authoritative source locations: CMS lib/mock-api/{handler,data,http,metrics}.ts and lib/cms/client.ts; FastAPI backend/app/api/router.py, modules/admin/router.py, auth schemas/RBAC, partner_onboarding admin_router/eligibility, and booking/customer/driver/vehicle/geography/payment/earnings/wallet/coupon/ops_alert schemas and services. Existing source locations for each DTO/route are recorded above.

