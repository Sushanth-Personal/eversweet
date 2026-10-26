# Eversweet production workflow review

Branch: `codex/production-workflow-redesign`  
Worktree: `/Users/sushanthp/Eversweet/App/eversweet`

## Local review

- Built application: `http://localhost:3012/admin` (uses the configured database).
- Isolated workflow review: `http://localhost:3013/admin` (test orders and an in-memory PostgreSQL database; no customer writes).
- The existing development server on port 3001 also reads this worktree.

Start the built application:

```sh
NEXT_BUILD_DIR=.next-production-review npm run build
NEXT_BUILD_DIR=.next-production-review npm run start -- -p 3012 -H 127.0.0.1
```

In a second terminal:

```sh
node tests/production-preview.cjs
```

The isolated review resets when its process restarts. Its API proxy blocks unknown API writes. It exercises the same SQL packing/preparation transaction as the application.

## Screens and controls

The admin opens on Calendar. Month navigation uses large plain chevrons with accessible names and 48px touch targets. Dates have coloured order-count badges. Selecting a date opens Orders, with remaining flavour demand above the order tiles. Prepare contains only orders still needing preparation; prepared orders move to Pack, packed orders move to Dispatch, and dispatched orders remain in Dispatch and Orders. All/Kochi/TVM affects every date summary and production queue.

The ivory header remains compact. Order tiles have a clear appointment row, one heading per box, distinct boundaries and large flavour names in coloured-border chips. Repeated box summaries and oversized pink/yellow blocks were removed. The same flavour uses the same colour across packing, order tiles and order details. Contact actions use labelled accessible icons; missing values have a small plus badge and open the shared editor at the missing field.

Order detail defaults to view. Tapping name, phone, address, map URL or Instagram URL copies that value. Edit shows normal labelled inputs; Save and Cancel are explicit. Copy delivery details writes exactly four plain-text entries: name, phone, full address, map URL. Plus Code copying, invoice generation, deletion, per-box editing and customer links remain available.

New order opens the full editable form. Order link creates a blank, retry-safe order and copies its `/confirm/{id}` link. After creating an order, Orders opens with All orders so undated orders are visible.

Instagram uses the existing `orders.insta_id` field. Both usernames and profile URLs normalize to `https://www.instagram.com/username/`; it stays optional.

## Production rules

`src/lib/production.ts` holds the pure aggregation, inventory allocation, cup and priority logic.

- Only the selected date participates in a production calculation. City inventory is separate.
- Each complete order is considered in delivery-slot order, creation time, then ID.
- An order receives a provisional allocation only if its entire plan is fulfillable. The allocated pieces cannot make a second order ready.
- Priority simulates one additional piece of each city/flavour. Immediate additional packable orders receive the strongest weight; near-completion and dependent-order counts break down the remaining demand. Scores never appear in the UI.
- Preparation records represent total pieces produced. The Orders button advances through Mark prepared → Mark packed → Mark dispatched, and also updates when the Prepare tab makes the order fulfillable.
- Mark prepared records only the missing stock for that order and reserves its pieces without marking it packed. Repeated clicks are idempotent. Undo prepared releases the reservation without deleting produced stock. These prepared reservations cannot make another order ready. Packing changes the reservation's stage without consuming it twice; dispatching does not consume it again.
- Historical dispatched orders without a reservation are treated as already produced and consumed. A dispatched box of four plus one pending box of four means four remaining, even if historical preparation records are absent.
- Cancelling or editing an unpacked order recalculates demand without deleting extra produced stock.
- An explicitly prepared order must release its reservation, and a packed order must be unpacked, before its date, city, box plan or cancellation can change. Contact edits remain allowed. Dispatched orders cannot be unpacked.

Latest confirmed cup rules: **4, 5 and 6 use regular cups; 8 uses white cups.** Counts come from each actual box's flavour quantities.

The preparation drawer distinguishes the full day's required/prepared counts from remaining work. The manifest defaults to remaining quantities, with a full-count toggle. It shows “4 left to prepare · 8 total today” rather than implying all eight are still outstanding.

## Additive database update — not applied to production

Apply `migrations/20261026_production_workflow.sql` in the Eversweet Supabase SQL editor. It includes the preparation table if that earlier migration has not been applied. It can be run on an existing project without deleting orders or existing preparation records. The user approved this database update. The signed-in editor was reached, but native browser text input was unreliable and the attempted query was rejected with a syntax error; successful application has not been verified. Replace the editor contents with the exact migration file before running it.

The new migration adds `order_packing`, a service-role-only `production_action` transaction and an order update guard. `packed_at = null` identifies a prepared reservation; a timestamp identifies a packed one. A shared transaction lock protects order preparation, packing, unpacking, dispatch and preparation changes. The transaction validates the saved individual boxes, rechecks current stock, makes repeated preparation/packing clicks idempotent, and rejects lowering produced quantities below reserved quantities. Existing orders are not deleted or rewritten by the migration.

Without the update, order details and calculated flavour/cup requirements remain readable. Packing and preparation writes remain unavailable rather than pretending that stock was saved. No schema update or application deployment was performed against production.

## Validation

```sh
npm run typecheck
npm run lint
npm test
NEXT_BUILD_DIR=.next-production-review npm run build
```

The test command includes eight suites: existing confirmation/draft, box, admin-link, delivery-date and map tests; workflow API tests; pure production/contact tests; and real PostgreSQL-semantic migration/transaction tests in PGlite.

Coverage includes cup sizes, partial boxes, demand aggregation, duplicate inventory allocation, packed reservations, historical dispatched counts, excess stock, city isolation, priority, contact destinations and missing-field targets, transaction retries, protected packed edits, contact edits, unpacking and dispatch.

Lint uses Next's standard rules. Existing legacy warnings are retained as warnings, including the pre-existing maintenance-return hook issue on `src/app/page.tsx`; these unrelated marketing-page behaviours were not changed. New workflow code must have no lint errors.

Readability changes follow visible sentence-case labels and grouping guidance from [GOV.UK](https://design-system.service.gov.uk/components/text-input/) and [W3C WAI](https://www.w3.org/WAI/tutorials/forms/grouping/).

Founder review is still required for the visual result. Database-update approval has been received; reliable editor input is still needed to apply it.
