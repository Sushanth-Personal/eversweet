# Eversweet product audit — 19 October 2026

## Evidence and architecture

Next.js App Router, React client state, Supabase Postgres. Products use UUID primary keys. Orders store aggregated `flavours` JSON keyed by product ID, a legacy single `box_size_id`, and per-box JSON encoded in `notes`. Customers are embedded in orders rather than maintained by this workflow as a separate customer entity. Payment is manual UPI verification, not a verified payment-provider webhook. `payment_confirmed_at` already exists and is the authoritative verification evidence; status alone is not evidence of payment.

Read-only production audit: 252 orders (137 dispatched, 86 confirmed, 29 cancelled). 66 confirmed orders have no payment timestamp. Three reported UUIDs resolve to inactive products: the admin's available-only product array discarded these names. Four other referenced product IDs have no product row. No customer personal information is copied into this report; no production records were changed.

## Root causes and connected risks

- Available-only catalogue doubled as historical name resolver; several screens fell back to raw IDs. Synthetic Pomegranate was selectable without a database row. Settings availability was not enforced by confirmation writes.
- Confirmation POST sets `confirmed` without payment; admin POST invents a payment timestamp. Pay screen interprets any non-pending status as paid.
- Per-date preparation totals are separate from order state; header counted undisbursed boxes, not unprepared pieces. No packed state or dispatch guards.
- Per-box editing, aggregate JSON, price and old single-box fields have independent calculation paths. Customer PATCH trusted product IDs, ignored TVM prices and allowed overfull boxes.
- Old links were UUID capabilities with no server expiry or protected paid contents. Browser storage expiry was not server protection. Cached local changes could overwrite admin edits immediately on open.
- Public/admin mutation endpoints lacked authentication; anon policies in the setup script allowed order insertion. Browser-direct legacy writes bypass API rules if live policies permit them.
- Legacy setup SQL contains destructive seeds and is not the actual live schema. Do not rerun it on production.
- Delivery called all non-dispatched orders 'ready', including unpaid/unprepared orders.
- Existing hidden finance/TVM routes and imported-order tools are still reachable. They must not become alternate mutation paths around the canonical workflow.
- Requested screenshot attachments were discussed but never implemented. They are not part of this release and must not be described as complete.

## Revised owner-approved flow (19 October)

Admin creates an order with a fixed date and city, then sends its unique /confirm/:id link. Customer edits only that order. Public confirmation creation and cache-based resume are retired. Customer date/city mutations are rejected server-side; past/dispatched links are locked. An admin can reschedule. No new payment verification requirement is imposed.

Flavour collection uses products.is_premium everywhere in this workflow. Settings edits name, image, tier and availability without deleting history. No automatic pricing change is inferred from a tier change. Customer edits preserve the admin quote; administrators should review added boxes before issuing an invoice.

## Implemented in this worktree

Order-specific flow; idempotent admin creation; copy link/message; server date/city guards; no cached order overwrite; optional contact details on admin creation; catalogue tier/image/availability settings; ingredient image fallback; separate Regular/Premium customer collections; all-product historical name lookup in main admin; overfull box and retired-flavour addition checks. Existing preparation changes retained.

## Deployment and remaining risks

Production build and mocked API tests are separate from real database/browser verification. Apply migrations/20261019_flavour_collections.sql once to set Blueberry/Hazelnut/Pistachio Regular and Biscoff/Dark Chocolate Premium. The five classifications were applied successfully after the approval service recovered. No order or price values were changed. Settings can change them again after deployment. Preparation still needs its existing table migration.

The broader audit is NOT fully implemented. Admin authentication was explicitly not requested by the owner and has not been introduced; public admin endpoints remain a serious access-control risk. Old /api/orders and legacy pages still exist. Do not treat customer date locking as authorization against someone using unprotected admin endpoints. Revision/concurrent-field conflict protection, true attachment storage and packing lifecycle remain outstanding. Unknown historical product IDs are not guessed or reassigned.

## Superseding decision: no flavour tiers

Regular/Premium differentiation has been removed from customer selection, active admin editor, settings, and public product badges. Legacy database flags are retained for compatibility but are not used by this workflow. Do not apply the superseded classification migration. Admin remains password-free at the owner’s explicit request. Creating an order continues to return /confirm/<order-id> with Copy link and Copy thank-you message.

## Superseding creation flow

Add Order opens a minimal dialog. Copy Order creates a blank dated-null order using a stable UUID and copies /confirm/<id>. No admin fields are required. Customer can choose city/date while date is unset; saving the first date fixes it, with server-side conditional updates protecting simultaneous first-date changes. Past/dispatched orders remain locked. This supersedes the earlier admin-required-date flow.
