#!/usr/bin/env node
// End-to-end smoke test against a dev API seeded with SNAPCLAIM_SEED_DEV=true.
//   node api/smoke.mjs http://localhost:8097
// Walks the whole flow: employee uploads a receipt and files a claim, manager
// approves, director reviews the month, downloads the Excel and closes it.
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const base = (process.argv[2] ?? 'http://localhost:8097').replace(/\/$/, '');
let step = 0;
const log = (msg) => console.log(`${String(++step).padStart(2, '0')}. ${msg}`);

async function call(method, path, { token, body, form } = {}) {
  const headers = {};
  if (token) headers.authorization = `Bearer ${token}`;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const res = await fetch(base + path, { method, headers, body: form ?? (body === undefined ? undefined : JSON.stringify(body)) });
  const type = res.headers.get('content-type') ?? '';
  const data = type.includes('json') ? await res.json() : await res.arrayBuffer();
  return { status: res.status, data, headers: res.headers };
}

async function login(email, password) {
  const r = await call('POST', '/api/v1/auth/login', { body: { email, password } });
  assert.equal(r.status, 200, `login ${email}: ${JSON.stringify(r.data)}`);
  return r.data;
}

// A tiny valid 1x1 PNG so the upload path is exercised even without an API key.
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');
const today = new Date();
const period = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
const spentOn = today.toISOString().slice(0, 10);

const health = await call('GET', '/health');
assert.equal(health.data.status, 'ok');
log(`API healthy at ${base}`);

const ravi = await login('ravi@snapclaim.local', 'Employee123!');
assert.equal(ravi.user.role, 'employee');
log(`Signed in as ${ravi.user.full_name} (${ravi.company.name}, ${ravi.company.currency})`);

const cats = await call('GET', '/api/v1/categories', { token: ravi.access_token });
assert.ok(cats.data.items.length >= 5, 'categories seeded');
const meals = cats.data.items.find((c) => c.code === 'meals');
log(`${cats.data.items.length} categories; meals = ${meals.id}`);

const caps = await call('GET', '/api/v1/receipts/capabilities', { token: ravi.access_token });
log(`Receipt extraction ${caps.data.extraction_enabled ? 'ENABLED (' + caps.data.model + ')' : 'disabled (no ANTHROPIC_API_KEY)'}`);

const form = new FormData();
form.append('file', new Blob([png], { type: 'image/png' }), 'receipt.png');
const upload = await call('POST', '/api/v1/receipts/', { token: ravi.access_token, form });
assert.equal(upload.status, 200, JSON.stringify(upload.data));
const receipt = upload.data;
log(`Uploaded receipt ${receipt.id} (${receipt.byte_size} bytes, extraction ${receipt.extraction_status})`);

const check = await call('POST', '/api/v1/policy/check', {
  token: ravi.access_token,
  body: { category_id: meals.id, amount: 1800, spent_on: spentOn, has_receipt: true, vendor: 'Saravana Bhavan' },
});
assert.equal(check.status, 200);
assert.ok(check.data.flags.some((f) => f.code === 'over_claim_cap'), 'meal over 1500 should be flagged');
log(`Policy check flags: ${check.data.flags.map((f) => f.code).join(', ')}`);

const blocked = await call('POST', '/api/v1/claims/', {
  token: ravi.access_token,
  body: { title: 'No receipt', category_id: meals.id, amount: 900, spent_on: spentOn, submit: true },
});
assert.equal(blocked.status, 422, 'submitting above the receipt threshold without a receipt must be blocked');
log(`Submission without receipt blocked: ${blocked.data.error.message}`);

const created = await call('POST', '/api/v1/claims/', {
  token: ravi.access_token,
  body: {
    title: 'Client lunch', category_id: meals.id, vendor: 'Saravana Bhavan', spent_on: spentOn, amount: 1800, tax_amount: 86,
    notes: 'Lunch with the Delhi team', lines: [{ description: 'Thali x3', quantity: 3, unit_price: 500, amount: 1500 }, { description: 'Coffee', quantity: 3, amount: 300 }],
    receipt_ids: [receipt.id], submit: true,
  },
});
assert.equal(created.status, 201, JSON.stringify(created.data));
const claim = created.data.claim;
assert.equal(claim.status, 'submitted');
assert.equal(created.data.receipts.length, 1);
log(`Claim #${claim.claim_no} submitted for ${claim.amount} with ${claim.policy_flags.length} flag(s)`);

const mine = await call('GET', '/api/v1/claims/?scope=mine', { token: ravi.access_token });
assert.ok(mine.data.items.some((c) => c.id === claim.id));
log(`Employee sees ${mine.data.total} claim(s) of their own`);

const anita = await login('anita@snapclaim.local', 'Employee123!');
const peek = await call('GET', `/api/v1/claims/${claim.id}`, { token: anita.access_token });
assert.equal(peek.status, 403, 'another employee cannot read the claim');
log('Another employee is refused the claim');

const manager = await login('manager@snapclaim.local', 'Manager123!');
const queue = await call('GET', '/api/v1/approvals/', { token: manager.access_token });
assert.ok(queue.data.items.some((c) => c.id === claim.id), 'claim is in the manager queue');
log(`Manager queue: ${queue.data.total} pending, ${queue.data.flagged} flagged, total ${queue.data.total_amount}`);

const image = await call('GET', `/api/v1/receipts/${receipt.id}/image`, { token: manager.access_token });
assert.equal(image.status, 200);
log(`Manager can open the receipt image (${image.data.byteLength} bytes)`);

const decide = await call('POST', '/api/v1/approvals/decide', { token: manager.access_token, body: { claim_ids: [claim.id], decision: 'approve', note: 'OK, team lunch' } });
assert.equal(decide.status, 200);
assert.deepEqual(decide.data.decided, [claim.id]);
log('Manager approved in one tap');

const director = await login('director@snapclaim.local', 'Director123!');
const month = await call('GET', `/api/v1/months/${period}`, { token: director.access_token });
assert.equal(month.status, 200);
assert.ok(month.data.month.approved >= 1);
log(`Director month view: ${month.data.month.approved} approved, ${month.data.by_employee.length} employee(s), ${month.data.flagged.length} flagged`);

const xlsx = await call('GET', `/api/v1/months/${period}/export.xlsx`, { token: director.access_token });
assert.equal(xlsx.status, 200);
assert.ok(xlsx.data.byteLength > 4000, 'workbook has content');
const out = join(tmpdir(), `snapclaim-${period}.xlsx`);
writeFileSync(out, Buffer.from(xlsx.data));
log(`Excel export ${xlsx.data.byteLength} bytes → ${out}`);

const close = await call('POST', `/api/v1/months/${period}/close`, { token: director.access_token, body: { note: 'Reviewed' } });
assert.equal(close.status, 200);
log(`Month closed: ${close.data.newly_cleared} newly cleared, ${close.data.cleared_total} total, ${close.data.still_pending} still pending`);

const after = await call('GET', `/api/v1/claims/${claim.id}`, { token: ravi.access_token });
assert.equal(after.data.claim.status, 'cleared');
log(`Employee now sees claim #${claim.claim_no} as cleared with ${after.data.events.length} events`);

const forbidden = await call('GET', '/api/v1/months/', { token: manager.access_token });
assert.equal(forbidden.status, 403);
log('Approver cannot reach the month list');

const audit = await call('GET', '/api/v1/audit?limit=5', { token: director.access_token });
assert.equal(audit.status, 200);
assert.ok(audit.data.total > 0 && audit.data.items[0].action, 'audit trail has entries');
log(`Audit trail: ${audit.data.total} entries, latest ${audit.data.items[0].action}`);

const noAudit = await call('GET', '/api/v1/audit', { token: manager.access_token });
assert.equal(noAudit.status, 403);
log('Approver cannot read the audit trail');

console.log('\nSmoke test passed.');
