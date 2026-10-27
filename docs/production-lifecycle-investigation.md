# Production scope and order-link lifecycle — 27 October 2026

## Environment

Branch `codex/production-workflow-redesign`, directory `/Users/sushanthp/Eversweet/App/eversweet`, clean initial tree, starting HEAD `d810aff`. Existing development server remains at `http://localhost:3001/admin`, against Supabase `lqokriiytzrzkonedrwe`. No deployment or commit was performed. No CSS, colours, card layout or typography changed.

## Root causes, established before editing

1. **Cross-date cards:** `ProductionWorkspace` calculated the summary/model from date-filtered `daily`, but `scope === 'all'` selected global city-filtered `filtered` for cards. `scope === 'undated'` likewise bypassed the selected date. The screenshot's “All orders” option is this exact path. There is no React Query/SWR cache involved.
2. **Ghosts:** `OrderManagerModal.copyNewOrder` called `POST /api/admin/orders`, which inserted a real `orders` row with status `confirmed`, placeholder customer name and preselected empty boxes. Customer autosave and final submit both called the same PATCH without distinguishing final confirmation. No draft state, expiry metadata or expiry guard existed.
3. **Completed cards:** dispatch persisted correctly through `production_action`; direct database reads found both Arati and Vishnudhathan as `dispatched`. Orders filtered only cancellation, and Dispatch explicitly included dispatched rows. Preparation requirements also included completed flavour quantities, although stock bookkeeping prevented double-use. The fix separates active requirements from historical inventory consumption.

## Existing schema and minimal lifecycle

Use the existing `orders` table and existing text `status`, timestamp `created_at`, and `notes` fields. No new table/column/migration is necessary. Stable `/confirm/{order-id}` URLs are preserved.

```text
Generate link -> draft
autosave      -> draft (never production)
final submit  -> confirmed
preparation   -> prepared reservation (order_packing.packed_at = null)
pack          -> timestamped reservation
dispatch      -> orders.status = dispatched + ledger dispatch timestamp

unconfirmed draft at/after creation + 5 min -> expired
```

New generated links explicitly send `link_draft: true`. Their `created_at` is server UTC and `notes` stores `Order link expires at: <ISO timestamp>` computed from the same creation instant. Only final customer submission sends `submit: true`; it validates name, ten-digit phone, date, Kochi time (TVM needs none), and complete box/flavour selections. Address/maps remain optional. Successful confirmation stores `Customer submitted at: <ISO timestamp>` and status `confirmed`.

Expiry is server-side, not a browser timer:

- Drafts are excluded by the workspace database query even **before** expiry.
- Workspace requests persist old `draft` rows as `expired` using status and created_at predicates. Correctness does not depend on this cleanup succeeding.
- Opening a link checks the persisted deadline, persists expiration where applicable, and returns the existing locked-page message.
- PATCH rejects expired links with HTTP 410.
- A draft update/confirmation also checks the original status and creation cutoff in its UPDATE, preventing a read-before-deadline/write-after-deadline resurrection.
- Confirmed rows are not subject to the five-minute deadline.

## Shared data ownership

`delivery_date` remains a date-only `YYYY-MM-DD` business value, using the existing `business-date.ts` helpers. One selected date drives all tabs.

`historicalProductionOrders` excludes draft/expired/cancelled/deleted/archived states and requires production-relevant saved box data; genuine dispatched records remain retrievable even if their legacy box representation is incomplete. `activeOrdersForDate` applies canonical date, active lifecycle and city together. Named legacy records with unfinished box plans are preserved, not guessed expired or deleted, but do not create production requirements.

The workspace API excludes temporary/dead statuses in the database query and applies the same shared history eligibility. Its optional `date`/`city` query returns the canonical `activeOrders` selection. The frontend uses the same selector for Orders and the base model for Prepare/Pack/Dispatch. No dropdown can bypass the date. “All active orders” stays within the selected date; “Completed history” is a separate, explicitly labelled view for the selected date.

Preparation, packing and dispatch receive only the selected date/city's operational orders. Historical completed reservations still consume stock internally, so removing completed requirements cannot let another order reuse those pieces. Completed quantities are subtracted from the displayed active prepared/required figures. Drafts and expired rows add no counts/cups/requirements. Counters and card numbering use the filtered operational list.

The workflow API independently rejects draft, expired or completed orders entering prepare/pack/dispatch. Existing database RPCs still perform the atomic production transitions; no schema change was needed or applied.

## Legacy placeholder cleanup actually applied

`scripts/expire-abandoned-links.cjs` is dry-run by default. The audited, one-time classification requires all of:

- old `confirmed` row with `payment_method=admin`;
- exact generated placeholder identity;
- empty phone and zero selected flavour quantities;
- no preparation/packing reservation;
- age greater than five minutes.

The apply mode uses original name/phone/flavours/notes/status as optimistic predicates so it does not race a customer editing the record. This is **not** a runtime name-based production filter.

Five audited undated empty placeholders were marked `expired` (not deleted):

```text
2f77aa2d-1583-4df7-8ee3-9400aa75992b
2af990ce-72d3-4f1b-a2d4-50e3f8dd30a7
7e1ca627-fdfb-4422-b1f5-9917b59a568f
1051da9c-4e4b-46e6-88d8-317a8552c27a
39bfdc5f-47c9-47e7-bbaa-292a91ce4063
```

The photographed October 28 placeholder `0fd066fa-1beb-489f-80dc-6898353e84e4` had already been cancelled before this task. It was created `2026-10-27T14:19:50.474732`, had no phone/flavour quantities, and was not a real production order. It was left cancelled, not modified.

## Actual customer verification (read-only)

| Date | Active API / Orders cards | Historical records |
| --- | --- | --- |
| October 28 | 0 | No eligible real orders |
| October 27 | 0 | Arati and Vishnudhathan, both dispatched |
| November 1 | 6 TVM, 0 Kochi | Includes Dheeksha and five other real orders |

The browser checked October 28 with “All active orders”: summary 0 orders / 0 remaining / 0 ready, and 0 cards. Prepare, Pack and Dispatch each contained no Arati, Vishnudhathan or Dheeksha card. Selecting October 27 and “Completed history” showed Arati and Vishnudhathan. Switching to November 1 showed six active orders including Dheeksha; Kochi showed zero and TVM showed six, without a reload.

The genuine rows remain stored:

- Arati: `cd870a44-eddc-484d-8db7-d01c332cd4bc`, `2026-10-27`, dispatched.
- Vishnudhathan: `480778b5-8179-49a4-b741-dd0fbe3d65a4`, `2026-10-27`, dispatched.
- Dheeksha: `7d14de6d-9b48-44aa-93b9-1af93b609246`, `2026-11-01`, confirmed.

Proof screenshots: `/private/tmp/eversweet-oct28-active-proof.jpg`, `/private/tmp/eversweet-nov1-active-proof.jpg`.

## Real database/API lifecycle verification

Only safe diagnostic orders on `2099-10-28` were used, not customer production dates:

- `35d35b61-ceb6-419b-9dd1-8ebfcd32400f`: created draft, absent from calendar/operations; its own persisted timestamps were advanced past the deadline for testing; GET persisted `expired`; confirmation returned HTTP 410. Retained expired.
- `5ab4bf32-02be-4e72-bbe5-d99fbaf85934`: autosave remained draft; explicit final submit returned/persisted confirmed; changing only its diagnostic creation timestamp past the window did not expire it. Selected-date active API included it.
- That same safe confirmed order passed real `prepare_order`, `pack`, `dispatch` RPC/API actions with HTTP 200. Direct DB then read `dispatched`; active API excluded it while history API retained it.
- Diagnostic ledger rows were removed, diagnostic future-date progress was restored to its pre-test state, and the safe order retained as cancelled after verification. No existing customer/production data was reset or removed.

## Files

- `src/lib/order-lifecycle.ts`: status and persisted deadline rules.
- `src/lib/production.ts`: shared history/active selectors and active-only requirements with historical stock accounting.
- `src/app/admin/_components/ProductionWorkspace.tsx`: mandatory date scope for every tab and dropdown, explicit date-scoped history.
- `src/app/api/admin/workspace/route.ts`: backend lifecycle exclusion, expiry persistence, history and active selection.
- `src/app/api/admin/orders/route.ts`: explicit link draft creation and persisted server timestamps.
- `src/app/admin/_components/OrderManagerModal.tsx`: link creation identifies the temporary draft operation.
- `src/app/confirm/ConfirmationForm.tsx`: explicit final confirmation signal, separate from autosave.
- `src/app/api/order-confirmation/[id]/route.ts`: expiration checks, validated final transition and guarded updates.
- `src/app/api/admin/workflow/route.ts`: backend active-order guard before workflow mutation.
- `scripts/expire-abandoned-links.cjs`: audited/dry-run-first legacy cleanup.
- `tests/order-lifecycle.cjs`: date/city/base counter consistency, drafts, five-minute expiry, final confirmation, historical preservation and no resurrection.
- Existing admin-link/order-draft/preparation/production tests: lifecycle dependencies and active-only expectations, workflow API rejection regressions.
- `package.json`: tenth test suite.

## Validation / deployment

Typecheck, all ten suites, lint and production build passed. Lint retains existing legacy warnings; no new failing checks. `git diff --check` passed. No visual redesign or full-page reload mechanism was added. Current local dev server stays on port 3001 with hot reload.

No schema migration was created/applied. The five legacy status updates **were applied** to the active database. Code changes are uncommitted on `codex/production-workflow-redesign` (starting HEAD `d810aff`) and are not yet deployed to `eversweet.in`.
