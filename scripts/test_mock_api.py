#!/usr/bin/env python3
"""Smoke-test the local mock API only; never run against a real FastAPI backend."""
import concurrent.futures
import io
import json
import os
import urllib.error
import urllib.parse
import urllib.request
import uuid

BASE = os.environ.get('MOCK_API_BASE', 'http://127.0.0.1:3000/api/v1').rstrip('/')
TOKEN = 'mock-admin-token'


def request(path, method='GET', body=None, key=None, auth=True, raw=None, content_type=None):
    headers = {'Authorization': 'Bearer ' + TOKEN} if auth else {}
    if key:
        headers['Idempotency-Key'] = key
    if body is not None:
        raw = json.dumps(body).encode()
        headers['Content-Type'] = 'application/json'
    if content_type:
        headers['Content-Type'] = content_type
    req = urllib.request.Request(BASE + path, data=raw, method=method, headers=headers)
    try:
        response = urllib.request.urlopen(req, timeout=30)
    except urllib.error.HTTPError as error:
        response = error
    data = response.read()
    if response.headers.get('Content-Type', '').startswith('application/json'):
        data = json.loads(data)
    return response.status, data, response.headers


def ok(path):
    status, data, _ = request(path)
    assert status == 200, (path, status, data)
    return data


def check(condition, message):
    assert condition, message
    print('PASS', message)


def main():
    index = ok('')
    check(index.get('mock') is True and len(index['endpoints']) > 70, 'public discovery explicitly identifies mock API')
    check(request('/admin/dashboard', auth=False)[0] == 401, 'missing mock token is rejected')
    status, session, _ = request('/auth/otp/verify', 'POST', {'phone': '+919900000001', 'app_type': 'ADMIN', 'code': '000000'}, auth=False)
    check(status == 200 and session['access_token'] == TOKEN, 'mock OTP returns demo token')
    register = ok('/admin/order-register?limit=7')
    check(register['total_count'] == 12480 and len(register['items']) == 7, 'full seeded register and page limit')
    next_page = ok('/admin/order-register?limit=7&cursor=' + urllib.parse.quote(register['next_cursor']))
    check(not ({r['id'] for r in register['items']} & {r['id'] for r in next_page['items']}), 'cursor pages do not overlap')
    mismatch = request('/admin/order-register?status_group=CANCELLED&cursor=' + urllib.parse.quote(register['next_cursor']))
    check(mismatch[0] == 422, 'cursor cannot be reused under different filters')
    counts = ok('/admin/order-register/summary')
    check(counts['delivered_count'] == 11200 and counts['cancelled_count'] == 480, 'status counters match seed')
    data = ok('/admin/dashboard')['data']
    check(data['gross_fare_revenue'] == '2856000.00' and data['today_bookings_count'] == 960 and data['today_gross_fare_revenue'] == '204000.00', 'dashboard revenue and today totals derive correctly')
    check(ok('/admin/order-register?from=2026-09-01&to=2026-09-30')['total_count'] == 0, 'unseeded dates return empty records')
    check(request('/admin/order-register?from=2026-02-30')[0] == 422, 'invalid calendar dates are rejected')
    check(request('/admin/order-register?limit=0')[0] == 422, 'invalid page limits are rejected')
    matched = ok('/admin/order-register?q=FreshMart&status_group=ACTIVE')
    check(all(r['customer']['display_name'] == 'FreshMart' and r['status_group'] == 'ACTIVE' for r in matched['items']), 'search and status filters combine')
    check(ok('/admin/analytics/overview')['data']['average_rating'] is None, 'unsupported ratings remain null')
    live_before = ok('/admin/marketing/summary')['data']['live_campaigns']
    new = {'title': 'API test ' + uuid.uuid4().hex[:6], 'audience': 'DRIVER', 'format': 'HOME_BANNER', 'start_at': '2026-10-15T00:00:00+05:30', 'end_at': '2026-11-01T00:00:00+05:30'}
    status, campaign, _ = request('/admin/campaigns', 'POST', new)
    check(status == 201 and campaign['status'] == 'DRAFT', 'campaign create produces a draft')
    status, updated, _ = request('/admin/campaigns/' + campaign['id'], 'PATCH', {'title': new['title'] + ' edited', 'reason': 'Smoke test', 'version': 1})
    check(status == 200 and updated['version'] == 2, 'allowlisted update increments version')
    check(request('/admin/campaigns/' + campaign['id'], 'PATCH', {'reason': 'Stale update', 'version': 1})[0] == 409, 'stale updates conflict')
    check(request('/admin/campaigns/' + campaign['id'] + '/publish', 'POST', {'reason': 'Mock publication test'})[1]['status'] == 'LIVE', 'campaign publish transition')
    delivered = ok('/admin/order-register?status=DELIVERED&limit=1')['items'][0]
    check(request('/admin/orders/' + delivered['id'] + '/cancel', 'POST', {'reason_code': 'TEST'})[0] == 409, 'terminal order cannot be cancelled')
    export_body = {'dataset': 'order_register', 'format': 'csv', 'from_date': '2026-10-14', 'to_date': '2026-10-14', 'fields': ['order_number', 'status', 'currency']}
    key = 'test-export-' + uuid.uuid4().hex
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
        replies = list(executor.map(lambda _: request('/admin/data/exports', 'POST', export_body, key=key), range(2)))
    check(all(r[0] == 202 for r in replies) and replies[0][1]['id'] == replies[1][1]['id'], 'concurrent identical idempotency keys create one export')
    export_job = replies[0][1]
    check('rows' not in ok('/admin/data/exports/' + export_job['id']), 'job detail does not expose internal snapshot rows')
    status, data, headers = request('/admin/data/exports/' + export_job['id'] + '/download')
    check(status == 200 and 'text/csv' in headers['Content-Type'] and 'order_number' in data.decode('utf-8-sig') and 'phone' not in data.decode('utf-8-sig').splitlines()[0], 'CSV download honors selected fields')
    check(request('/admin/data/exports', 'POST', {**export_body, 'format': 'xlsx'}, key=key)[0] == 409, 'idempotency key reuse with changed payload conflicts')
    check(request('/admin/data/exports', 'POST', export_body)[0] == 422, 'exports require idempotency key')
    preview = request('/admin/payout-batches/preview', 'POST', {})[1]
    key = 'batch-' + uuid.uuid4().hex
    status, batch, _ = request('/admin/payout-batches', 'POST', {'preview_id': preview['id'], 'confirmed': True, 'reason': 'Mock smoke test'}, key=key)
    check(status == 201 and batch['status'] == 'SIMULATED', 'payout confirmation simulates only; no provider call')
    check(request('/admin/payout-batches', 'POST', {'preview_id': preview['id'], 'confirmed': True, 'reason': 'Duplicate preview'}, key=key + '-new')[0] == 409, 'preview cannot be confirmed twice')
    boundary = 'test-' + uuid.uuid4().hex
    payload = io.BytesIO()
    for field, value in [('dataset', 'customers')]:
        payload.write(f'--{boundary}\r\nContent-Disposition: form-data; name="{field}"\r\n\r\n{value}\r\n'.encode())
    payload.write(f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="customers.csv"\r\nContent-Type: text/csv\r\n\r\n'.encode())
    payload.write(b'display_name,phone,email,city\r\nAPI Test Customer,+919900009999,api-test@example.com,Bengaluru\r\n')
    payload.write(f'\r\n--{boundary}--\r\n'.encode())
    status, job, _ = request('/admin/data/imports', 'POST', raw=payload.getvalue(), content_type='multipart/form-data; boundary=' + boundary)
    check(status == 201 and job['status'] == 'UPLOADED' and 'staged_rows' not in job, 'CSV upload stages data and hides private rows')
    status, validated, _ = request('/admin/data/imports/' + job['id'] + '/validate', 'POST', {'version': 1})
    check(status == 200 and validated['status'] == 'VALIDATED', 'CSV schema and contact validation')
    status, committed, _ = request('/admin/data/imports/' + job['id'] + '/commit', 'POST', {'version': validated['version'], 'reason': 'Mock import smoke test'}, key='import-' + uuid.uuid4().hex)
    check(status == 200 and committed['committed_rows'] == 1, 'validated import commits to in-memory customer registry')
    check(ok('/admin/customers?q=API%20Test%20Customer')['total_count'] == 1, 'committed mock customer can be queried')
    alert = ok('/admin/alerts')['items'][0]
    check(request('/admin/alerts/' + alert['id'] + '/resolve', 'POST', {'note': 'Resolved in mock smoke test'})[1]['status'] == 'RESOLVED', 'alert resolution persists within process')
    check(request('/does-not-exist')[0] == 404, 'unknown endpoints return structured 404')
    check(request('/admin/campaigns', 'DELETE')[0] == 405, 'unsupported resource methods return JSON 405')
    transfer_rows = ok('/admin/data/transfers')['items']
    check(all('rows' not in row and 'staged_rows' not in row for row in transfer_rows), 'transfer history hides raw export and import rows')
    cash = ok('/admin/order-register?status_group=ACTIVE&payment_method_type=CASH&limit=1')['items'][0]
    check(cash['payment']['timing'] == 'POST_DELIVERY' and cash['payment']['status'] == 'PENDING' and cash['payment']['paid_at'] is None, 'active cash deliveries are unpaid until delivery')
    all_drivers = ok('/admin/drivers')['items']
    ravi = next(row for row in all_drivers if row['first_name'] == 'Ravi')
    searched_ravi = ok('/admin/drivers?q=Ravi')['items'][0]
    check(ravi['period_delivered_count'] == searched_ravi['period_delivered_count'] and ravi['period_delivered_count'] > 0, 'driver name search does not erase activity totals')
    check(request('/admin/campaigns', 'POST', {'title': 'Invalid schedule', 'audience': 'CUSTOMER', 'start_at': '2026-11-01', 'end_at': '2026-10-01'})[0] == 422, 'reversed campaign schedules are rejected')
    check(request('/admin/coupons', 'POST', {'code': 'BADDATE' + uuid.uuid4().hex[:4], 'title': 'Invalid dates', 'description': 'Test validation', 'discount_type': 'FLAT', 'discount_value': '10', 'valid_from': '2026-11-01', 'valid_until': '2026-10-01'})[0] == 422, 'coupon validity windows are enforced')
    check(ok('/admin/marketing/summary')['data']['live_campaigns'] == live_before, 'future published campaigns are scheduled, not counted as currently live')
    status, empty_export, _ = request('/admin/data/exports', 'POST', {**export_body, 'from_date': '2026-09-01', 'to_date': '2026-09-30'}, key='empty-' + uuid.uuid4().hex)
    status, empty_csv, _ = request('/admin/data/exports/' + empty_export['id'] + '/download')
    check(status == 200 and empty_csv.decode('utf-8-sig').splitlines()[0] == '"order_number","status","currency"', 'empty exports preserve the requested column schema')
    totals = ok('/admin/data/summary')
    check(totals['imports_count'] == ok('/admin/data/imports?limit=1')['total_count'] and totals['exports_count'] == ok('/admin/data/exports?limit=1')['total_count'], 'transfer totals come from complete datasets, not a limited history page')
    print('All mock API smoke checks passed.')


if __name__ == '__main__':
    main()
