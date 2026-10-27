# Calendar / Instagram correctness investigation — 27 October 2026

## Environment

- Branch: `codex/production-workflow-redesign`; starting commit `7ce3f65`.
- Directory: `/Users/sushanthp/Eversweet/App/eversweet`.
- Working tree was clean before investigation. No commit, push or deployment performed.
- App: `http://localhost:3001/admin`. Started development mode, then built and started **production mode on the same port**, using `.next-production-check`.
- `.env.local` connects to `lqokriiytzrzkonedrwe.supabase.co`. No credentials are included here.
- All diagnostic writes were confined to clearly named temporary test orders. No real customer's order was edited. Temporary test orders were soft-cancelled; a reused older diagnostic row's Instagram value was restored.

## Root cause: stale operational reads

Both observed failures occur in the live admin read path, before calendar grouping or editor hydration. The database writes succeed. The live workspace returns an older snapshot.

Observed before changing source:

| Source | Result for Vishnudhathan |
| --- | --- |
| Direct Supabase service-role read | Present, `delivery_date=2026-10-27` |
| Local `/api/admin/workspace` | Present; October 27 count 1 |
| Live `/api/order-confirmation/{id}` | Present; `delivery_date=2026-10-27` |
| Live `/api/admin/workspace` | Absent; October 27 count 0 |

Live workspace returned 289 rows while the database contained 290 at the initial check. The query's `limit(1000)` was not reached. It has no date-range/city/status WHERE clause that could exclude this order. Repeating the live GET with `cache: no-store`, a `Cache-Control: no-cache` request header, and a different outer query string did not change its snapshot. Responses had `x-vercel-cache: MISS`, `age: 0`, so the stale result was not fixed by bypassing the outer URL cache.

The server Supabase factory previously delegated SDK requests to Next's fetch without an explicit cache policy. The PostgREST SDK calls fetch with method, headers, body and signal, but no cache setting. The workspace already exported `dynamic='force-dynamic'`; relying on that alone did not produce fresh data in the deployed application. The fix explicitly enforces `cache:'no-store'` on every fetch made through the **server** SDK. Browser HTTP cache prevention alone cannot control these nested server fetches.

This addresses the server/data-cache boundary. Vercel's internal cache entries were not directly inspected; the evidence above is the observed database/API discrepancy. Official references: [Supabase's Next 13/14 stale-data guidance](https://supabase.com/docs/guides/troubleshooting/nextjs-1314-stale-data-when-changing-rls-or-table-data-85b8oQ), [Next 14 fetch cache semantics](https://nextjs.org/docs/14/app/api-reference/functions/fetch).

## Affected order and canonical date

Persisted record, independently rechecked after all tests:

```text
id:              480778b5-8179-49a4-b741-dd0fbe3d65a4
customer_name:   Vishnudhathan
phone:           8113952189
delivery_date:   2026-10-27
order_date:      2026-10-27
source:          kochi
status:          confirmed
created_at:      2026-10-27T06:48:16.502583
delivery_slot:   3–5 PM
delivery_batch:  null
batch_label:     null
```

The active schema defines `delivery_date` and `order_date` as PostgreSQL `date`; `created_at` is `timestamp without time zone`. There is no `updated_at`, archived/deleted timestamp or separate cancellation column in this table; deletion uses `status='cancelled'`.

The canonical business date is **delivery_date**, not order_date or created_at.

Customer display trace:

`orders.delivery_date` → `GET /api/order-confirmation/[id]` (`FIELDS`) → `order.delivery_date` → `useDraft` hydration → `ConfirmationForm` → reserved-date text.

Calendar trace:

`orders` → server SDK → `GET /api/admin/workspace` (`select('*').order('created_at', descending).limit(1000)`) → `AdminPage.load` → `ProductionWorkspace` → city/status filtering → `ordersOnDate(..., day)` → badge/list. Ordering by created_at does not determine the grouping date.

No SQL month range is constructed by this workspace API: month/day selection happens on the returned rows. Previously the count compared date strings directly, so it was not a UTC shift removing this record. Calendar layout/month navigation did contain separate Date/toISOString logic; shared date-only helpers now calculate month days, weekday offsets, shifts, labels and delivery-date comparisons without converting reservation dates to timestamps. Only genuinely current timestamps use `Asia/Kolkata` for 'today'.

Observed DB counts after verification:

| Day | All | Kochi | TVM |
| --- | ---: | ---: | ---: |
| 2026-10-26 | 3 | 3 | 0 |
| 2026-10-27 | 1 | 1 | 0 |
| 2026-10-28 | 0 | 0 | 0 |
| 2026-10-31 | 0 | 0 | 0 |
| 2026-11-01 | 6 | 0 | 6 |

The local browser showed October 27's badge as 1, selecting it showed Vishnudhathan, Kochi included him, and TVM excluded him. October 26/28 did not receive his order. Real historical dates were not rewritten.

## Instagram trace and reproduction

`Instagram profile link` input → `instagram` React state → normalized `draft.insta_id` → autosave/explicit save/close flush → `PATCH /api/admin/orders` → normalization and changed-column allowlist → Supabase `orders.insta_id` update → returned database row → parent order state → workspace refetch → reopening hydrates `order.insta_id` → `contactAction` generates the profile URL.

Active schema inspection confirms `orders.insta_id` exists, is nullable PostgreSQL text, default empty string. It is included in the hand-maintained Order/ExtOrder types and in the workspace's `select('*')`. No Zod schema or mapper strips it. The server uses the service role; actual successful writes and independent reads demonstrate that RLS is not blocking this persistence path. No new Instagram schema migration is necessary.

Concrete live reproduction on an older, already-cached diagnostic row (`5a389b73-d723-45d1-b309-b20176de1850`):

1. Live PATCH returned `https://www.instagram.com/eversweet_diagnostic_two/` with HTTP 200.
2. Direct database read returned that exact new value.
3. Live workspace returned the **previous** `https://www.instagram.com/_sumayyya__/` for the same ID.
4. The diagnostic row was restored to its original value afterward.

On a newly created diagnostic order, live PATCH also persisted correctly, while the live workspace omitted the new row entirely. An unrelated subsequent save did not erase Instagram in the database. This disproves the earlier assumption that the observed disappearance necessarily means database deletion/overwrite.

The UI briefly shows the fresh mutation response, then the stale workspace snapshot replaces it. Reopening hydrates that stale value. An empty old snapshot produces precisely the reported disappearing icon/plus sign.

Two additional client safeguards were implemented at the persistence layer: workspace requests are versioned so an older in-flight read cannot overwrite a newer confirmed mutation, and a single serialized save queue drains the newest draft before closing or Back navigation. The old close handler returned early while a request was active; it did not wait for later edits. These safeguards are tested independently, not claimed as the live stale-cache diagnosis.

## Browser + real database verification

Safe UI record: `067bea42-fab5-4564-8510-47b5e465507b`, 'Safe Instagram verification'. It was undated so it did not affect production counts, and was cancelled after verification.

- Missing Instagram icon opened the editor and focused the correct input.
- Entered the user's exact shared URL; observed 'Saving…', then confirmed 'All changes saved'.
- Independent database and workspace reads both returned `https://www.instagram.com/_sumayyya__/`.
- Closed, fully reloaded the browser, reopened; stored URL remained populated and icon was a link.
- Entered `http://instagram.com/eversweet_second_check/` and closed immediately, before debounce; direct DB and workspace both returned normalized `https://www.instagram.com/eversweet_second_check/`.
- Cleared the input and immediately used browser Back; direct DB confirmed empty string.
- Invalid profile input produced 'Not saved' and left the editor open. Correcting it allowed confirmed persistence.
- Clicking the saved Instagram icon opened a new tab at `https://www.instagram.com/_sumayyya__/`; the profile page loaded.
- Phone generated `tel:9876543210`; missing Map opened and focused the Google Maps field.

Production-mode checks on port 3001 additionally warmed the workspace endpoint, saved first/second URLs and cleared them, and compared every refetch against direct database reads. A new test order inserted after a warmed read appeared on the next workspace request. That temporary cache-test order was cancelled afterward.

Screenshots: `/private/tmp/eversweet-calendar-oct27-proof.jpg`, `/private/tmp/eversweet-oct27-order-proof.jpg`, `/private/tmp/eversweet-instagram-persisted-proof.jpg`.

## File changes

- `src/lib/supabase.ts`: explicit uncached server SDK fetch; no browser permission/RLS change.
- `src/app/api/admin/workspace/route.ts`: private/no-store HTTP response.
- `src/app/api/order-confirmation/[id]/route.ts`: explicitly dynamic customer GET route.
- `src/lib/business-date.ts`: canonical delivery-date/string calendar helpers.
- `src/app/admin/_components/ProductionWorkspace.tsx`: uses shared dates for grouping, labels and calendar month arithmetic; no CSS/layout changes.
- `src/lib/production.ts`: uses canonical delivery-date and city helpers.
- `src/app/confirm/ConfirmationForm.tsx`: uses shared India-today/canonical hydration.
- `src/lib/save-queue.ts`: serialized, latest-draft persistence with failure acknowledgement and navigation flush.
- `src/app/admin/_components/OrderManagerModal.tsx`: integrates queue; waits before closing; preserves error state/undo semantics.
- `src/app/admin/page.tsx`: discards superseded workspace reads after newer reads/mutations.
- `tests/data-correctness.cjs`: timezone/date-boundary, cache freshness and save/navigation regression tests.
- `tests/production.cjs`: supplies the new shared helper dependency to the existing VM test loader.
- `package.json`: includes the new suite.
- This report records the evidence and limitations.

## Validation and remaining deployment step

- `npm run typecheck`: passed.
- `npm test`: all nine suites passed.
- `npm run lint`: exit 0, existing warnings in legacy components/marketing pages (images, unescaped entities, hook rules). No new failures; modified autosave dependency warning removed.
- `NEXT_BUILD_DIR=.next-production-check npm run build`: passed.
- Actual production-mode server, real Supabase API/database and UI checks above: passed.
- No database migration/schema changes; no tables reset/recreated; no existing customer/production data modified.
- **Not deployed:** live `eversweet.in` still uses its earlier deployment. Local production-mode verification is not a claim that the live deployment has changed. Commit/push/merge/deployment and a repeat live check remain necessary.
- Git: changes are uncommitted on `codex/production-workflow-redesign`; starting/HEAD commit remains `7ce3f65`.
