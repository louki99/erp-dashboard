# Mode GCOM (Gestion Commerciale Pure) — Complete Guide

> **Version**: 2026-08-24 — updated for cancellation/avoir, PDF, partial
> line cancel, dedicated permission, `sales_mode`, the `GcomDatabaseSeeder`
> demo tenant, returns architecture (§9bis), the financial-instrument
> bank-clearing lifecycle (§8), and Treasury branch caisse journals (§16).
> The Trésorerie story (§16) is now complete for both settlement paths —
> immediate (comptoir/BC/BL) and deferred (règlement) — plus daily
> closure (Z de caisse), its correction and batch-close paths, and
> instrument-reject reversal; only Priorité 3 (bank-statement
> reconciliation) remains deliberately paused — its full scope,
> dependencies and open questions are now written up in §16's own
> "Backlog" subsection so nothing is lost before it's picked up. Devis
> numbering migrated onto branch-scoped `TokenSerie` and the login
> bootstrap payload is now conditioned for GCOM-only companies (§11) —
> GCOM is backend-feature-complete as of this version. §8 gained a
> company-wide financial-instrument portfolio (list + batch deposit) for
> the "Portefeuille Chèques & Effets" screen, and a "Relevé de Compte"
> PDF export (`GET /partners/{partner}/ledger/pdf`) reusing the shared
> document pipeline. §17 (new) adds multi-souche invoice numbering
> (déclarée vs interne, Phase 1) — separate TokenSerie counters per
> souche, `PaymentTerm`-driven routing plus an explicit per-request
> `souche_kind` override on all three GCOM invoice-creation endpoints
> (2026-08-26), Sage/FEC export itself deferred to Phase 2. §8 (2026-08-27)
> gained `delivery_date` on direct BL creation and a new `client_order_ref`
> field (customer's own PO/reference number) on `POST /orders`,
> `POST /delivery-notes` and `POST /direct-invoices`, mirrored down the
> BC→BL→Facture chain. Also (2026-08-27): `partner.waive_stamp_duty` is
> now honored everywhere GCOM computes stamp duty (a real gap before —
> the flag existed but was never read), and all three sale-creation
> endpoints accept an optional `salesperson_id` override for back-office
> entry on behalf of a field salesperson. §18 (new, 2026-08-27/28) adds
> représentant management (`/gcom/representatives`, a dedicated
> `gcom_representative` role) and tightens `salesperson_id` to only
> accept a real représentant. **2026-08-29**: real BL lifecycle for flows
> #4/#5 — a BL is born `in_transit`, not `delivered` (§13); new
> `POST /delivery-notes/{id}/confirm-delivery` and a new guard on
> `convert-to-invoice` rejecting a still-`in_transit` BL. Settlement still
> only triggers at convert-to-invoice, unchanged. Flow #6 (Comptoir) is
> unaffected (no BL). New `driver_info`/`transporter_name` fields on BL
> creation. **2026-08-30**: BL creation's initial `status` is now
> configurable (`in_transit` default, or `delivered` for a counter/depot
> pickup with no real transit leg) on both `POST /delivery-notes` and
> `convert-to-bl`. `'draft'` is deliberately not accepted yet — real
> design gap (stock-deduction timing, cancellation, numbering), written up
> as a backlog note at the end of §18. **2026-08-31**: fixed a production
> bug where any non-null `instrument` on all 3 invoicing endpoints
> (`convert-to-invoice` ×2, `direct-invoices`) returned a bare 404 —
> `TYPE_BRANCH_CAISSE` journal codes collided with manually-created
> `BANK_ACCOUNT` codes in the same uniqueness namespace (§10 bug #9,
> §16's code-pattern note). New `GET /partners/statements` (§8) —
> company-wide statement list, one row per partner, same shape as
> `/partners/{partner}/statement`, computed as a fixed handful of
> `GROUP BY` queries across all partners rather than a per-partner loop.
> **2026-08-31 (§9bis)**: `POST /delivery-notes/{id}/lines/{item}/return`
> now allows returning 100% of a single line (was strictly less) — a
> multi-line BL can drop one fully-refused product without cancelling
> the rest. Fixed a real latent bug this surfaced: `InvoiceService::
> createInvoiceItemsFromBlItems()` used to silently resurrect a
> zero-quantity BL line to the full original order quantity on invoicing.
> New `GET /credit-notes` (company-wide "Avoirs" list) and
> `POST /credit-notes/{id}/redeem` (cash/cheque/effet/transfer
> resolution of a credit note's outstanding `refund_amount`, journaled
> in Treasury as a negative branch-caisse entry) — "apply to another
> invoice" deliberately deferred, backlog note at the end of this doc.
> **2026-08-31**: `draft` BL initial status shipped — no number/stock
> movement until `POST /delivery-notes/{id}/validate` (§8/§13), product
> decisions confirmed with the UI team. **Also 2026-08-31**: avoir as a
> payment method on a new sale shipped — `payment_method: "avoir"` +
> `avoir_allocations` at the 3 settlement endpoints (§8), no Treasury
> movement, no credit check. `credit_notes` gains `remaining_amount`/
> `consumed_amount`/`imputed_at`; `remaining_amount` is now the single
> authoritative balance shared with `redeemCreditNote()` (made partial
> in the same change) — resolves the `AvoirPaymentStrategy` collision
> the earlier backlog note described. Applying an avoir to an
> **existing**, already-invoiced sale (as opposed to a new one) remains
> unbuilt — see the backlog note at the end of this doc.
> **Also 2026-08-31**: mixed avoir + another payment method shipped —
> real case reported live (an 18 MAD avoir against a 590 MAD BL, the
> rest in cash), scoped out same-day then confirmed a genuine need
> within hours. `avoir_allocations` may now cover only part of a sale;
> Treasury is credited for only the real remainder, never the
> avoir-covered portion. `credit`/`transfer` as the remainder method
> still isn't supported (needs the credit check to run against just the
> remainder — real scope boundary). **Also 2026-08-31**: a follow-up
> gap surfaced within hours — a BC/BL created with `payment_method:
> "avoir"` whose only available avoir turned out too small had no way
> to switch to a real method without losing the delivery trail.
> `convert-to-invoice` (both BC and BL) now accepts an optional
> `payment_method` override (`cash`/`card` only, only when the stored
> method is `avoir`) — recalculates stamp duty, and for BL also updates
> its own stored `total_amount` snapshot.
> **Also 2026-08-31**: "Bordereau de remise en banque" shipped — new
> `BankDeposit` model (one row per real trip to the bank, `id`-based
> like every other GCOM PDF, never looked up by the free-text
> `deposit_reference`) and `GET /financial-instruments/bank-deposits/
> {id}/pdf`. `batch-deposit` creates one shared `BankDeposit`; a single
> `deposit()` now creates its own too (a batch of size 1) — the PDF
> action works uniformly for any `DEPOSITED` instrument.
> **2026-08-20**: fixed a real production data-correctness bug reported
> directly from live data — `GET /telesales/catalog/products`'s
> `stock_available` showed 11 for a product whose only non-damaged stock
> was actually 0. Root cause was two compounding bugs in the shared
> (non-GCOM) `TeleSalesCatalogController::bulkStock()`: its branch-only
> fallback path (hit whenever no warehouse code resolves — the normal
> case for a GCOM/télévendeur user with no `primary_warehouse_id`
> configured) summed `DAMAGED` stock as sellable with zero location-type
> filtering, and a `stocks.company_id` backfill gap (never run since the
> column was added nullable) let orphan rows leak into every tenant's
> aggregate via `CompanyScope`'s `company_id IS NULL OR company_id = …`
> clause. Both fixed; see §9bis's condition-routing table for the
> corrected invisibility guarantee and §8's `stock_available` note for
> full detail.
> **2026-08-20+ (caisses individuelles)**: reversed §16's own
> 2026-08-20 branch-caisse decision after real multi-vendeur feedback —
> "chacun a son propre tiroir-caisse et sa propre responsabilité
> financière" — even inside a single agency. Every GCOM settlement (sale,
> deferred règlement, avoir cash-out redemption) now targets the acting
> user's own `TYPE_USER_CAISSE` journal instead of a shared per-branch
> one; `TYPE_BRANCH_CAISSE` becomes a pure coffre fed only by end-of-day
> closure transfers. New self-service `GET /gcom/caisse` +
> `POST /gcom/caisse/close` (closes today's session, auto-transfers the
> theoretical balance to the branch coffre, auto-accepted). A settlement
> with no active caisse assigned now returns a `422`
> (`NoCaisseAssignedException`) instead of silently auto-provisioning one
> — caisses are provisioned up front (role-based, at account creation),
> never invented on first use. Also fixed, surfaced by this work: a
> pre-existing broken `id` column default on `treasury_ledger_entries`
> (same bug already fixed once on its sibling `treasury_audit_logs` back
> on 2026-08-11, never actually applied to this table) that made every
> insert into it fail — dormant until this was the first GCOM code path
> to ever call a real Treasury transfer `accept()`. See §16 for the full
> design.
> **Also 2026-08-31**: `GET /gcom/caisse` gained `is_closed_today` per
> journal — the UI team was only discovering an already-closed caisse
> reactively, via the close endpoint's own 422; this lets "Ma Caisse"
> disable the "Clôturer" button proactively instead.
> **Investigated, then built, 2026-08-31**: `partners.invoicing_mode`
> (per-partner billing cadence — immediate/per-order/periodic) is now
> wired into GCOM — "architecture propre à GCOM" per the UI team's
> explicit decision, NOT coupled to the legacy SFA
> `DeliveryNoteDelivered`/`GenerateInvoiceOnDelivery` listener chain.
> `1_FAC_PER_BL` (default) is unchanged. `1_FAC_PER_ORDER`:
> `convert-to-invoice` on any sibling BL of an order now waits for every
> non-cancelled sibling to be delivered, then consolidates all of them
> into ONE invoice (reuses `InvoiceService::generateFromOrderDeliveries()`)
> with GCOM's own settlement (USER_CAISSE, avoir) applied on top.
> `PERIODIC_FIN_DE_MOIS`: `convert-to-invoice` now rejects on demand; a
> new `gcom:generate-periodic-invoices` command (scheduled monthly, 1st
> at 01:30, `canal='GCOM'`-scoped) consolidates delivered/uninvoiced BLs
> into a 'pending' credit invoice per partner, settled later through the
> normal règlement screen. Real dormant risk found and fixed along the
> way: the legacy periodic cron had no `canal` filter and could have
> swept an unconverted GCOM BL into a pipeline never built for it. See
> §8's `convert-to-invoice` entry and §11 for full detail.
> **Confirmed 2026-08-31**: a GCOM credit invoice needs no "settlement"
> block (`payment_method: "credit"` alone is enough, status lands on the
> real `'pending'` value — there is no `'unpaid'` anywhere in this
> codebase), and règlement/lettrage (§6) already fully supports
> multi-invoice allocation. Real bug found and fixed in the same
> investigation: `LetteringService::letterPayment()` could be tricked
> into over-lettering — several individually-valid allocation lines whose
> SUM exceeded the payment's own amount, now rejected with a clean `422`.
> Also confirmed: no "avance client"/prepayment concept exists anywhere
> — a payment surplus beyond open invoices just sits as an under-lettered
> `PaymentTransfer`, discoverable only by direct query. See §6 for full
> detail.
> **Built 2026-08-31**: multi-sessions par jour for caisse closures —
> the original "one closure per journal per calendar day" hard lock
> (`UNIQUE(journal_id, business_date)`) is gone, replaced by a
> `session_number` column and `UNIQUE(journal_id, business_date,
> session_number)`. A sale after a lunchtime closure now silently
> auto-opens session 2 on the same journal/day instead of throwing
> `JournalClosedException` (deleted, had one throw site). `GET
> /gcom/caisse` gained `has_open_session`/`session_number` alongside
> `is_closed_today`. The explicit close endpoint still rejects
> (`422 TREASURY_NO_OPEN_SESSION`, new `NoOpenSessionException`)
> closing an already-closed-today caisse a second time, while still
> allowing "close my never-touched-today empty caisse for the record".
> See §16's "Clôture de caisse et versement au coffre" for full detail.
> **Generalized 2026-09-01**: the `payment_method` override at
> convert-to-invoice, previously scoped to the avoir-remainder gap only,
> now accepts any real settlement method regardless of the document's
> original one (mirrors convert-to-bl's `applyPaymentMethodChange()`
> exactly — stamp duty, credit-limit check, payment-term re-resolution).
> Fixes two real gaps: "espèces différé" (a cash BL/BC whose client
> can't pay on the spot at invoicing time can now be overridden to
> `credit` for a pending/no-movement invoice settled the next day via
> the normal deferred règlement), and a silent no-op where overriding
> `payment_method` after the document was already invoiced used to
> return the pre-existing invoice untouched — now a clear `422`. See
> §8's "payment_method override at convert-to-invoice" for full detail.
> **Built 2026-09-01**: `POST /invoices/consolidate` — on-demand
> cross-order BL grouping for `1_FAC_PER_ORDER` wholesale clients.
> Root-caused first: a GCOM order can only ever have one BL, so the
> existing `1_FAC_PER_ORDER` per-order consolidation could never
> actually merge more than one — the real need was several separate
> orders of the same client grouped together, a genuinely different
> endpoint. Reuses `InvoiceService::generatePeriodicInvoice()` (the
> same cross-order primitive `PERIODIC_FIN_DE_MOIS` already relies on)
> rather than a new one. Real dormant bug found and fixed along the
> way: that method's own `payment_term_id` resolution read a Partner
> attribute with no accessor, always silently landing on the 30-day due
> date fallback instead of the partner's real term — affected the
> pre-existing monthly cron too, not just this new endpoint. See §8's
> "`POST /invoices/consolidate`" for full detail.
> **Built 2026-09-01, "FEU VERT TOTAL"**: manual negotiation on `POST
> /orders` and its line-mutation endpoints — per-line `unit_price`
> override, per-line `discount_percent`/`discount_amount` (mutually
> exclusive), a document-level global discount distributed
> proportionally to each line's HT (VAT-inclusive TTC impact), and a
> real PMP (Prix Moyen Pondéré) cost engine on `stocks.pmp_cost`
> (recalculated synchronously by `StockUpdateService::addStock()` on
> every real purchase reception, never on transfers/returns) backing an
> absolute anti-loss-sale guard. 6 new kebab-case RBAC permissions
> (`gcom-price-override`, `gcom-discount-line`, `gcom-discount-global`,
> `gcom-discount-override-limit`, `gcom-loss-sale-override`,
> `gcom-delivery-note-edit`), a paramétrable `gcom.max_discount_percent`
> threshold (`ParameterService`, same Partner→User→AccessProfile→Role
> resolution `sales.max_discount_percent` uses). See §8's "Manual
> negotiation" section for full detail.
> **Built 2026-09-01, "FEU VERT TOTAL" part 2**: BL editing —
> `POST /delivery-notes/{id}/lines`, `PATCH .../lines/{item}`,
> `POST .../lines/{item}/remove`, gated on `gcom-delivery-note-edit`.
> Same manual-negotiation payload as the BC line endpoints, but a BL
> already deducted stock at creation (a BC never does), so every edit
> reacts on real stock immediately — by the DELTA on a quantity change,
> never a blind re-deduct/re-add. `delivery_notes` carries no HT/tax
> columns of its own; the underlying order's `sub_total`/`tax_amount`
> (proxied for display) are recomputed directly from the BL's own
> current items after every edit so that proxy never goes stale. See
> §8's "BL editing" subsection for full detail.
> **Built 2026-09-01, UI team follow-up**: document-level discount on an
> EXISTING BL (`POST /delivery-notes/{id}/discount`) — genuinely
> different from a BC's (set once, at creation, never revisited): a BL's
> real use case is re-negotiation after delivery, possibly more than
> once, so this redistributes from each item's `final_price` (locked in
> the first time any global discount touches it) rather than its
> current `unit_price` — safely re-appliable, a second call with a
> different value never compounds on the first. Also: the full manual-
> negotiation engine (override/discount/global-discount/anti-loss-sale
> guard) extended to `POST /direct-invoices` (Comptoir/Facture Directe),
> same permissions, same pipeline. Two real bugs found and fixed along
> the way: `InvoiceService`'s two invoice-item-creation call sites
> hardcoded `discount_percent`/`discount_amount` to `0` regardless of
> the source line's real discount (billing was unaffected — `unit_price`
> already carried it net — but the margin-reporting audit trail was
> silently lost on every invoice); `Order::products()`'s `withPivot()`
> never even included those two columns, so reading them would have
> returned `null` regardless. See §8's "BL editing"/"Direct Invoice"
> subsections for full detail.
> **Fixed 2026-09-01** (UI team, order BCORBI-A01-000066): the printed
> BC PDF ignored a global discount entirely — it recomputed each line's
> montant from the raw per-unit price instead of reading the already-
> discounted `total_price`/`line_total_ht` columns, and REM. always
> showed "—". Investigating this surfaced a more serious sibling bug:
> BC→BL conversion copied that same stale price onto each new BL item,
> which — since `DeliveryNoteItem` has no separate line-total column to
> fall back on — meant any BC with a global discount would have
> silently **overcharged** on the eventual BL→Facture invoice. Both
> fixed; see §8's `GET /orders/{order}/pdf` entry for full detail.
> **Audience**: this doc is written for two readers — backend maintainers
> (architecture/rationale, §1–7, §9–12) and **frontend/UI integrators**
> (§8 API Reference and §13–16, which are self-contained — you can build a
> GCOM UI from those sections alone without reading the rest).
> **Branch**: `gcom` (isolated working branch off `feature/build-studio-document`)
> **Services**: `App\Domains\Gcom\*` — `GcomDirectInvoiceService`, `GcomOrderService`, `GcomDeliveryNoteService`, `GcomCreditNoteService`, `GcomPaymentController`, plus shared helpers under `App\Domains\Gcom\Shared\Services`
> **Routes**: `routes/backend/gcom.php`, prefix `/api/backend/gcom/*`, `permission:manage-gcom` (granted to `root`+`admin` by default)

---

## Table of Contents

1. [Why GCOM Is a Separate Module](#1-why-gcom-is-a-separate-module)
2. [The Nine Document Flows](#2-the-nine-document-flows)
3. [Golden Rule: Stock Deduction Timing](#3-golden-rule-stock-deduction-timing)
4. [Settlement Classification](#4-settlement-classification)
5. [Credit Control Integration](#5-credit-control-integration)
6. [Règlement & Lettrage](#6-règlement--lettrage)
7. [Shared Services (the reuse layer)](#7-shared-services-the-reuse-layer)
8. [API Reference](#8-api-reference) — **start here for UI integration**
9. [Cancellation & Avoir (Credit Notes)](#9-cancellation--avoir-credit-notes)
10. [Real Bugs Found Building This](#10-real-bugs-found-building-this)
11. [Known Gaps — Deliberately Deferred](#11-known-gaps--deliberately-deferred)
12. [Testing](#12-testing)
13. [Status & Enum Reference](#13-status--enum-reference)
14. [Frontend Integration Notes](#14-frontend-integration-notes)
15. [Getting a Test Tenant — GcomDatabaseSeeder](#15-getting-a-test-tenant--gcomdatabaseseeder)
16. [Treasury Integration — Branch Caisse Journals](#16-treasury-integration--branch-caisse-journals)
17. [Multi-Souche Invoice Numbering (Declared vs Internal)](#17-multi-souche-invoice-numbering-declared-vs-internal)
18. [Représentants (Sales Rep Management)](#18-représentants-sales-rep-management)

---

## 1. Why GCOM Is a Separate Module

GCOM ("Gestion Commerciale pure") targets back-office B2B/grossiste/négoce
sales — quotes, direct counter invoicing, credit accounts — with **zero
field-sales dependency**: no `Visit`, no `WorkSession`, no van, no route, no
tournée, no ADV derogation workflow.

Before writing any GCOM code, an audit (2026-08-13) checked whether the
existing "Conventional" van-selling subsystem or POS already covered this.
**They don't.** Findings:

- `DirectInvoiceOrchestrator` (Conventional) hard-requires an open `Visit`
  tied to a `WorkSession`, and a van-anchored warehouse context
  (`app/Services/Sales/Conventional/DirectInvoiceOrchestrator.php`). It's
  "SFA-lite" — instant invoicing per tournée stop — not GCOM.
- `LoadingRequest`/`ConventionalDechargeReconciliationService`/
  `ConventionalDailyLedgerService` are all truck-loading/van-ledger
  concepts, not counter-sale concepts.
- `config/conventional_sales.php`'s flags (`adv_validation_on_session_end`,
  `session_reconciliation_required`, ...) all key off `WorkSession`/van
  close-out — Conventional is not zero-field-constraint as configured.
- POS is a distinct, not-yet-production concept — not reused.

**Conclusion**: GCOM is new code, but it is *not* a rewrite of the Core
Engine. It calls the same generic, channel-agnostic primitives every other
part of the ERP uses — `StockService`, `InvoiceService`,
`PartnerProductPriceResolver`, `VatResolutionService`,
`CreditControlEngine`, `PaymentTransferService`, `LetteringService` — none
of which required forking. Several of those primitives turned out to be
already generic in *implementation* despite only ever being *called* from
van-specific code (`StockService::deductForDirectSale()` takes any
warehouse code — it just had no non-van caller until GCOM).

---

## 2. The Nine Document Flows

| # | Flow | Entry point | Status |
|---|------|-------------|--------|
| 1 | Devis → BC → Facture | `POST /quotes/{id}/convert-to-order` → `POST /orders/{id}/convert-to-invoice` | ✅ |
| 2 | Devis → Facture Directe | `POST /quotes/{id}/convert` | ✅ |
| 3 | BC → Facture | `POST /orders` → `POST /orders/{id}/convert-to-invoice` | ✅ |
| 4 | BC → BL → Facture | `POST /orders` → `.../convert-to-bl` → **`.../confirm-delivery`** → `POST /delivery-notes/{id}/convert-to-invoice` | ✅ |
| 5 | BL Direct → Facture | `POST /delivery-notes` → **`.../confirm-delivery`** → `.../convert-to-invoice` | ✅ |
| 6 | Facture Directe / Comptoir | `POST /direct-invoices` (1-click: BC + stock-out + invoice) | ✅ |
| 7 | Règlement à la facture (ESP/Chèque/Effet/Virement) | Built into every invoice-producing endpoint via `payment_method` | ✅ |
| 8 | Lettrage (imputer un règlement sur 1+ factures) | `POST /payments` | ✅ |
| 9 | Encours client / crédit | `CreditControlEngine`, checked on every non-immediate sale | ✅ |

No flow is privileged — a user can start at Devis, BC, BL, or straight at
Facture, and convert forward from wherever they start. Nothing in the
Order/Invoice/DeliveryNote schema enforces a fixed sequence for GCOM
documents; the *services* simply offer every entry point.

**BL lifecycle (2026-08-29, §13/§18)**: flows #4/#5 have a real
`in_transit` state now — a BL is no longer born delivered. `confirm-delivery`
is mandatory before `convert-to-invoice` will accept it. Flow #6 (Comptoir)
has no BL at all and is unaffected.

**Traceability**: no new `origin_document_type`/`origin_document_id`
columns were added (see §10) — the existing relational chain already
carries this: `Invoice.order_id` / `Invoice.delivery_note_id` /
`DeliveryNote.order_id` / `Quote.converted_order_id`. Walking backward from
an invoice to its quote (if any) is a two-hop join, not a stored field.

---

## 3. Golden Rule: Stock Deduction Timing

> Stock deducts at the **first document that physically materializes the
> sale** for a given flow. Never before. Never twice.

| Flow | Deducts at | Does NOT deduct at |
|------|-----------|---------------------|
| Facture Directe/Comptoir (#6) | Invoice creation (only document that exists) | — |
| BC → Facture (#3) | `convertOrderToInvoice()` | BC creation |
| BC → BL → Facture (#4) | `convertOrderToDeliveryNote()` (BC→BL) | BC creation, BL→Facture |
| BL Direct → Facture (#5) | BL creation (`createDirectDeliveryNote()`) | BL→Facture |

This is enforced by `StockService::deductForDirectSale()` being called from
exactly one place per flow (`GcomDirectInvoiceService::createDirectInvoice`/
`convertOrderToInvoice`, or `GcomDeliveryNoteService::
createDeliveryNoteFromOrder`) — never from both a BC-creation step and its
later conversion. `convertOrderToInvoice()` and `convertDeliveryNoteToInvoice()`
are also idempotent: calling either again on an already-invoiced
order/BL returns the existing invoice rather than re-running anything.

Covered by `GcomFlexibleDocumentFlowTest` — this is the single most
important invariant in the whole module, verified explicitly per flow
(stock quantity asserted after each hop, not just at the end).

---

## 4. Settlement Classification

Six payment methods (`cash`, `card`, `credit`, `cheque`, `effet`,
`transfer`), three behaviors, classified by
`App\Domains\Gcom\Shared\Services\GcomSettlementClassifier`:

| Behavior | Methods | Invoice ends as | Exposure via |
|---|---|---|---|
| **Immediate** | cash, card | `fully_paid` immediately | none |
| **Instrument** | cheque, effet | `fully_paid` (settled by the instrument) + a `FinancialInstrument` row `PENDING` | `ExposureCalculator`'s `pending_cheques`/`pending_effets` terms |
| **Credit** | credit, transfer | `pending` (`is_credit_sale=true`) | `ExposureCalculator`'s `open_invoices` term |

**Why cheque/effet mark the invoice paid, not pending**: a physical
instrument changed hands at the point of sale — from an AR perspective the
invoice is settled, replaced by "effets/chèques à recevoir" as the real
remaining risk. Marking it `pending` too would double-count the same
amount as both an open invoice and a pending instrument.

**Treasury unification (2026-08-15)**: every Immediate and Instrument
settlement — i.e. anything that closes `fully_paid` at document creation,
cash/card/cheque/effet, never credit/transfer — now ALSO creates a real
`payment_transfers` row (registered → validated) and a `letterings` row
linking it to the invoice, via `GcomInstrumentRegistrar::recordSettlement()`.
Before this, `payment_transfers`/`letterings` only ever got populated by a
later règlement (§6) — a comptoir cash/cheque sale left both empty despite
the invoice closing paid, which is what prompted this. `payment_transfers`
is now the single source of truth for every GCOM cash inflow, comptoir or
deferred, not just deferred ones. Cheque/effet still ALSO get a
`FinancialInstrument` row — the two aren't redundant: `financial_instruments`
tracks the physical document's own bank-clearing lifecycle (registered →
deposited → cleared/rejected), `payment_transfers`/`letterings` is the
accounting journal (who paid, how much, against which invoice).

Stamp duty (`StampDutyService`, 0.25%) applies to `cash` only, by Moroccan
law — computed once, at BC creation (`GcomOrderBuilder::build()`), not
per-conversion-step (recomputed on a payment-method change at convert-to-bl,
and on any BC line edit — see §10). **`partner.waive_stamp_duty`
respected since 2026-08-27** — a real gap before that: none of GCOM's four
stamp-duty computation points (BC creation, the three BC line-edit
recompute paths, convert-to-bl's payment-method change) read the flag, so
a partner marked exempt (Admin/ADV-only toggle,
`PATCH /partners/{id}/stamp-duty-waiver`) was still silently charged on
every cash GCOM sale. Now checked automatically wherever `payment_method`
resolves to `cash` — no request-level flag needed, and no new permission
gate required (the waiver itself is already Admin/ADV-gated at the point
it's set on the partner).

---

## 5. Credit Control Integration

Every non-immediate settlement (`credit`, `transfer`, `cheque`, `effet`)
runs `CreditControlEngine::evaluateOrderEligibility()` — the same engine
fixed/tested earlier in this session for the SFA/mobile channel (see
`docs/modules/08-payment-credit.md` §11.11) — **before any row is
written**. Pricing/tax for every line is pre-computed first specifically so
the check sees the real order total, not an estimate.

**No derogation path.** GCOM has no ADV/approval workflow anywhere. A hard
block (`CreditDecision::canProceed() === false`) throws a `DomainException`
and the sale is rejected outright — there is nothing to route the request
to for manual override, unlike the télévendeur BC channel.

**Checked once, at BC creation** (`GcomOrderService::createOrder()`), not
re-checked at each later conversion step (BC→Facture, BC→BL, BL→Facture) —
nothing about the order's partner/amount changes between BC and its
eventual invoice, so re-checking would be redundant, and there's no
derogation path to react differently to anyway.

A resolved `payment_term_id` is required for `credit`/`transfer` — either
passed explicitly or falling back to the partner's default term
(`Partner::paymentTerm()`). No fallback exists for a partner with no term
configured — the sale is rejected with a clear message rather than silently
picking an arbitrary term.

---

## 6. Règlement & Lettrage

`PaymentTransferService` and `LetteringService` (both pre-existing,
`app/Services/*`) were already fully channel-agnostic — keyed on
`invoice_id`/`partner_id`, no `canal` filter anywhere. The actual gap was
that neither was reachable from any backend/admin endpoint, only from
`CollectionService` (mobile field-collection). `GcomPaymentController`
closes that:

- `POST /payments` — registers a payment, validates it immediately (no ADV
  approval step, same design as the rest of GCOM), then letters it: either
  against explicit `allocations` (`[{invoice_id, amount}]`) or
  auto-lettered oldest-open-invoice-first (`LetteringService::autoLetter()`).
- `GET /partners/{partner}/open-invoices` — lookup for deciding what a
  règlement should cover.

This is how a `credit`/`transfer` GCOM invoice (left `pending` at creation)
gets settled later — GCOM doesn't special-case this, it's the same
mechanism every other credit invoice in the ERP uses. It's also, since
2026-08-15, the exact same register→validate→letter sequence an
*immediate* settlement runs at document creation (§4) — same tables, same
shape, whether the money arrived at the counter or three weeks later.
Since 2026-08-21 that parity extends to Trésorerie too (§16): a règlement
here seeds a `TreasuryIntakeLine` into the collecting actor's own branch
caisse, same as an immediate settlement — the only difference is which
branch it's attributed to (the actor's, not an order's, since a règlement
has no single order to derive one from).

**Issuing a credit invoice needs no "settlement" block at all** (confirmed
2026-08-31, real UI team question). `payment_method: "credit"` (or
`"transfer"`) is enough — `instrument` is only ever required for
`cheque`/`effet` (`GcomSettlementClassifier::usesInstrument()`), and
there is no `settlement` key anywhere in any GCOM request shape. The
resulting invoice: `status = 'pending'` (the real vocabulary is
`pending`/`partially_paid`/`fully_paid`/`overdue`/`cancelled` — there is
**no** `'unpaid'` value anywhere in this codebase, despite that being a
natural guess), `paid_amount = 0`, `remaining_amount = total_amount`. A
`payment_term_id` IS required, but not as a request field — either pass
it explicitly or let it fall back to the partner's own default term
(`Partner::paymentTerm()`); a partner with neither gets a clean `422`
(`GcomContextResolver::resolvePaymentTermId()`): `"No payment term
resolved for partner {id} — cannot create a credit sale without one
(pass payment_term_id or configure a default)."`

**Lettering mechanics — allocations, auto-letter, and surplus** (same
2026-08-31 question). `POST /payments`'s `allocations` is
`[{invoice_id, amount, notes?}]`, one `Lettering` row created per entry
(`LetteringService::letterPayment()`) — note the `letterings` table's FK
column is literally `order_id` (`invoices.order_id`, resolved from the
invoice), not `invoice_id`; there's no `invoice_id` column on that table
at all. Each allocation increments the invoice's `paid_amount`,
decrements `remaining_amount`, and recomputes `status`
(`fully_paid` once `remaining_amount <= 0`, else `partially_paid` if
anything's been paid, else `overdue`/`pending`). `autoLetter()` (used
when `allocations` is omitted and `auto_letter` isn't `false`) walks the
partner's open invoices oldest-`invoice_date`-first, allocating
`min(remaining payment, that invoice's remaining_amount)` to each until
either the payment or the invoice list runs out — exactly the ordering
`GET /partners/{partner}/open-invoices` already returns.

**No partner credit-balance/prepayment concept exists** — a payment
larger than the sum of all open invoices (e.g. a 20 000 MAD chèque
against 5 000 MAD of open invoices) is not tracked anywhere as an
"avance client." `autoLetter()` simply allocates until it runs out of
open invoices, then stops — the payment's own `remaining_amount` (on
`payment_transfers`, decremented but never negative) is left non-zero,
its `status` stays `'validated'` (never flips to `'reconciled'`), and
that's the *entire* representation of the surplus: an under-lettered
`PaymentTransfer` row, discoverable only via
`PaymentTransferService::getValidatedPayments()` (`status='validated'
AND remaining_amount>0`) — no dedicated "surplus"/"avance" list endpoint
exists today. Once new invoices exist for that partner, a fresh
`letterPayment()`/`autoLetter()` call against that same payment can
allocate the remainder — nothing expires it or writes it off
automatically. **If the UI needs to surface "ce client a une avance de X
MAD"** as its own concept, that's real, unbuilt scope — flag if wanted,
not started.

**Real bug found and fixed in the same investigation**: `letterPayment()`'s
per-line guard (`$amount > $payment->remaining_amount`) compared every
allocation line against the payment's remaining_amount as loaded
*before* the loop — never decremented mid-loop — so several
individually-valid lines could jointly exceed the payment (e.g. two
200 MAD allocations against a 250 MAD payment: `200 > 250` is false
twice, but they sum to 400). Fixed with an aggregate sum check before
the loop starts — `POST /payments` now returns a clean `422`
(`"Total allocation amount {X} exceeds payment remaining balance {Y}"`)
instead of silently over-lettering multiple invoices with money the
payment never actually had.

**Per-partner financial views** (2026-08-15, `GcomPartnerFinanceController`)
— three reads for a "vue financière complète par client" screen:

- `GET /partners/{partner}/financial-instruments` — row-level cheque/effet
  portfolio. Query: `status?` (`PENDING`/`DEPOSITED`/`CLEARED`/`REJECTED`/
  `CANCELLED`), `instrument_type?` (`CHEQUE`/`EFFET`), `per_page?`. This
  genuinely didn't exist anywhere before — checked first: the only other
  `FinancialInstrument` endpoint in the whole codebase is a mobile
  *create* action, no list/index anywhere.
- `GET /partners/{partner}/statement` — `{ partner_id, total_debit,
  total_credit, current_balance, pending_instruments_total, credit_limit,
  available_credit }`. `credit_limit`/`available_credit` are read straight
  from `CreditControlEngine::getCreditState()` — the same source
  `GET /api/backend/credit-v2/partners/{partner}` and
  `GET /api/backend/partners/{id}/balances` already use elsewhere in the
  ERP (both pre-existing, both already reachable by a GCOM admin today —
  checked before building anything, not reimplemented here). `total_debit`/
  `total_credit`/`current_balance` are a genuinely different, LIFETIME
  number (every invoice/payment/avoir ever, not the current open exposure
  those two endpoints track), computed fresh from GCOM's own invoices/
  letterings/credit-notes.
- `GET /partners/{partner}/ledger` — chronological merged debit/credit
  entries (`type`: `invoice`/`payment`/`credit_note`, plus a running
  `running_balance`). Query: `from?`/`to?` (`YYYY-MM-DD`, filters each
  entry's own date). Built directly from `Invoice`/`Lettering`/
  `CreditNote` — deliberately NOT from `MsTransaction`, even though that
  table already gets `partner_id`-tagged postings for invoices and
  payments (`InvoiceService::postInvoiceFinancialPosting()`,
  `PaymentTransferService::validatePayment()`): `GcomCreditNoteService`
  never posts an `MsTransaction` entry for an avoir, so a ledger built
  from that table would silently miss every credit note.

All three scope by `order.partner_id`/`invoice.partner_id` directly — no
multi-tier billing-partner indirection
(`Partner::resolveBillingPartner()`), since no GCOM flow uses a payer
partner today.

**Company-wide statement list** (2026-08-31, `GcomPartnerStatementsBuilder`)
— `GET /partners/statements`, requested for a "revue de fin de mois"
screen where an accountant needs every client's balance without opening
`/partners/{partner}/statement` one at a time. Same row shape as that
endpoint (`partner_id`, `partner_name`, `partner_code`, `total_debit`,
`total_credit`, `current_balance`, `pending_instruments_total`,
`credit_limit`, `available_credit`), paginated, sorted by
`current_balance` desc by default. Query: `branch_id?` (only counts
orders placed at that branch — never applied to `pending_instruments_total`,
matching the per-partner endpoint's own scoping), `channel?`,
`min_balance?`, `include_zero_balance?` (default `false` — only partners
with ≥1 GCOM order; `true` also lists partners with zero GCOM activity,
every metric at `0`), `per_page?`, `page?`.

Deliberately NOT a loop over `/statement`'s per-partner query set (~6
queries per partner — a straight N+1 across a full partner list).
Instead every metric is computed as one `GROUP BY partner_id` query
across every qualifying partner at once, so the query count stays fixed
regardless of company size — see `GcomPartnerStatementsBuilder`'s
docblock. One behavioral difference from `/statement`: a partner with no
`PartnerCreditState` row yet reads `credit_limit`/`available_credit` as
`0` here rather than auto-provisioning one via `CreditControlEngine::
getCreditState()`'s `firstOrCreate()` — silently writing hundreds of rows
as a side effect of a `GET` list would itself be the N+1 this endpoint
exists to avoid.

---

## 7. Shared Services (the reuse layer)

Extracted 2026-08-13 when BC/BL support was added, so pricing/credit/
order-building logic has exactly one implementation instead of three
copies (the class of duplication that caused several real bugs earlier
this session — two `CreditControlService`, two `PartnerCreditService`; see
`docs/modules/08-payment-credit.md` §11.11).

| Class | Responsibility |
|---|---|
| `GcomPricingCalculator` | Line pricing/tax (`PartnerProductPriceResolver` + `VatResolutionService`, called **with** `$partner` — unlike `SalespersonCartService::addLine()`, which doesn't and silently skips partner VAT-group overrides) |
| `GcomSettlementClassifier` | Payment-method → behavior classification + the credit-limit check |
| `GcomContextResolver` | Branch/company/central-warehouse/cash-term resolution |
| `GcomOrderBuilder` | Builds the BC (`Order` + `OrderProduct` rows), no stock/invoice side effects |
| `GcomInstrumentRegistrar` | `register()`/`registerForPaymentTransfer()` — a `FinancialInstrument` (cheque/effet), at-sale or deferred. `recordSettlement()` (2026-08-15) — `payment_transfers`+`letterings`+branch-caisse `TreasuryIntakeLine` for any immediate settlement; also closes the gap where `generateFromDeliveryNote()` always returns `'pending'`. `recordDeferredSettlement()` (2026-08-21) — the same branch-caisse seeding for a règlement. `reverseSettlementForRejectedInstrument()` (2026-08-20) — undoes all of the above when an instrument is rejected. See §16 for the full Trésorerie picture |
| `GcomQuoteItemsExtractor` | Validates a quote is convertible (not already converted/expired) and extracts line items |
| `GcomPartnerLedgerBuilder` | Extracted 2026-08-24. Builds the chronological merged debit/credit ledger (invoice/payment/avoir + running balance) for a partner — the one implementation `GcomPartnerFinanceController::ledger()` (JSON) and `DocumentDataResolver::resolveStatement()` (Relevé de Compte PDF, §8) both read through, so they can never disagree |

`GcomOrderService`, `GcomDeliveryNoteService`, and
`GcomDirectInvoiceService` each compose these rather than duplicating any
of this logic.

---

## 8. API Reference

**Base URL**: `/api/backend/gcom`
**Auth**: `Authorization: Bearer <sanctum-token>` (every request) — see §14
for the full header list and how to obtain a token.
**Gate**: `permission:manage-gcom` — the authenticated user's role must
carry this permission (`root`/`admin` have it by default). A user without
it gets `403 Forbidden` on every route in this file.
**Idempotency**: every route marked 🔁 below additionally requires an
`X-Idempotency-Key` header (any UUID, one per logical action — see §14).
Missing it on a 🔁 route returns `422`.

All list (`GET` index) endpoints return Laravel's standard paginator
shape — see §14 for the exact envelope, documented once instead of
repeated below.

### Quotes (Devis)

**`GET /quotes`** — list the *authenticated user's own* quotes only
(`Quote.user_id = current user` — there is no cross-user quote listing on
this endpoint).
Query: `status?` (`draft`|`sent`|`accepted`|`expired`|`converted`), `per_page?`

**`GET /quotes/{id}`** — 403 if the quote belongs to a different user.

**`GET /quotes/{id}/pdf`** — streams the Devis PDF (`Content-Type:
application/pdf`). `?download=1` for an attachment instead of inline,
`?price_mode=ht|ttc` for whether line items print HT or TTC (see the
HT/TTC print toggle note below §8 — defaults to `ht`, this document's own
existing convention, if omitted). Same generic document pipeline as BC/BL
below (`App\Services\DocumentService`, type `devis`) — genuinely new as of
2026-08-17, no document type anywhere in the codebase rendered a Quote
before this. Not a JSON endpoint — point a browser `<a href>`/download
button directly at this URL (with the auth header), same caveat as every
other PDF endpoint in this module.

**`POST /quotes`**
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3 }],
  "notes": "Devis pour ouverture de saison",
  "expires_at": "2026-09-01T00:00:00Z"
}
```
→ `201`, `{ "success": true, "quote": { "id": 7, "status": "draft", ... } }`

**`POST /quotes/{id}/convert`** 🔁 — Devis → Facture Directe (flow #2).
Skips the BC stage entirely — lands straight on a paid or credit invoice.
```json
{
  "payment_method": "cash",
  "payment_term_id": null,
  "instrument": null
}
```
All fields optional (`payment_method` defaults to `"cash"`). If
`payment_method` is `cheque`/`effet`, `instrument` is required:
```json
{ "payment_method": "cheque", "instrument": { "reference_number": "CHQ-0001", "due_date": "2026-10-12", "bank_name": "Attijariwafa", "bank_account": "011..." } }
```
→ `200`, `{ "success": true, "message": "Quote converted to invoice", "invoice": {...}, "quote": { "status": "converted", ... } }`

**`POST /quotes/{id}/convert-to-order`** 🔁 — Devis → BC (flow #1, first
hop). Body: `{ "payment_method"?, "payment_term_id"? }`.
→ `201`, `{ "success": true, "order": { "bc_status": "confirmed", ... }, "quote": { "status": "converted", ... } }`

### Orders (BC)

**Montant HT/TVA/TTC**: `order.sub_total` (HT), `order.tax_amount` (TVA),
`order.total_amount` (TTC) are all real columns, always populated at BC
creation (not only after an invoice exists) — read them directly, no
computation needed on the client. `order.stamp_duty` is separate (cash
sales only, not VAT).

**`GET /orders`** — scoped to `canal = 'GCOM'` automatically (SFA/POS
orders never appear here). Query: `partner_id?`, `bc_status?` (in
practice only `confirmed`|`cancelled` ever appear — see §13),
`per_page?`.

**`GET /orders/{order}`** 🔁 (trimmed 2026-08-23, UI team audit of the BC
detail screen's actual frontend code) — 404 if the order isn't a GCOM
order. Was the full `Order` model + full `products`/`partner`/
`invoices`/`deliveryNotes` (~7.3KB for a single-line order); confirmed
100% dedicated to this one screen (exactly one route registration for
this controller method across the whole backend, GCOM is a
backend-web-only surface by design, and `show()` 404s on any non-GCOM
order — no other consumer, mobile or otherwise, could reach it).
Trimmed to:
- Flat: `id`, `order_code`, `bc_status`, `sub_total`, `tax_amount`,
  `total_amount`, `cancellation_reason_code`, `created_at`, `bc_notes`.
  **`bc_notes` is the only notes field `Order` has** — no `notes`
  column or alias exists anywhere; a frontend reading `selected.notes`
  was silently reading undefined.
- `products[]`: `id`, `name`, `pivot: { id, quantity, price,
  total_price, original_price, final_price, unit_price_ht }`.
- `partner`: `id`, `name` only — the rest (address, etc.) is refetched
  separately via `GET /partners/{id}` when actually needed.
- `invoices[]`: `id`, `invoice_number` only.
- `delivery_notes[]`: `id`, `status`, `total_amount` only.
- `financial_metadata`: `payment_method`, `stamp_duty` only.
→ `{ "success": true, "order": { "id": 110, "order_code": "BCORBI-...", "bc_status": "confirmed", "sub_total": "...", "tax_amount": "...", "total_amount": "...", "cancellation_reason_code": null, "created_at": "...", "bc_notes": "...", "products": [{ "id": 1, "name": "...", "pivot": { "id": 1, "quantity": 1, "price": 100.0, "total_price": 100.0, "original_price": null, "final_price": null, "unit_price_ht": 84.03 } }], "partner": { "id": 1, "name": "..." }, "invoices": [{ "id": 88, "invoice_number": "INV-..." }], "delivery_notes": [{ "id": 34, "status": "delivered", "total_amount": 100.0 }], "financial_metadata": { "payment_method": "cash", "stamp_duty": 0.0 } } }`

**`GET /orders/list-view`** 🔁 (2026-08-23, UI team report) — lightweight
BC datagrid feed. `GET /orders` above returns full `Order` models —
measured ~3.2KB/row (129 fields available across order + partner +
`financial_metadata` + `salesperson_data`, mostly cancellation/
preparation/physical-metrics workflow internals no grid renders) — this
endpoint selects only the 6 fields a BC datagrid actually displays,
**at the DB level**, not just a smaller JSON encode of the same fully-
hydrated row. Same `partner_id`/`bc_status` filters as `GET /orders`,
same pagination shape.
→ `{ "success": true, "orders": { "data": [{ "id": 88, "order_code": "BCORBI-...", "partner": { "name": "..." }, "bc_status": "confirmed", "payment_method": "cash", "total_amount": 200.00, "created_at": "2026-08-23T10:00:00+00:00" }], ...pagination... } }`

Not a replacement for `GET /orders` — detail screens still need the full
model. `id` is included beyond the UI team's literal 6-field ask (a grid
row needs a stable key). The same 129-vs-6 pattern almost certainly
applies to `GET /delivery-notes`, `/invoices`, `/quotes` too (per the UI
team's own report) — **not built for those yet**, deliberately: their
exact minimal datagrid field sets weren't specified, and guessing risks
either missing a field the real grid renders or dropping one nobody
asked to drop. Flag if/when those three grids' exact field lists are
confirmed — straightforward to extend with the same pattern.

**`GET /orders/{order}/pdf`** — streams the BC PDF (`Content-Type:
application/pdf`). `?download=1` for an attachment, `?price_mode=ht|ttc`
for whether line items print HT or TTC (defaults to `ht` if omitted).
2026-08-17: reuses the ERP's generic document pipeline
(`App\Services\DocumentService`, type `bc`) — the same one
`Backend\DocumentController` already exposes for other channels, not a
GCOM-specific renderer. Not a JSON endpoint.

**Real bug fixed 2026-09-01** (UI team, order BCORBI-A01-000066): the
printed PDF used to ignore a global discount entirely — `App\Documents\
DocumentDataResolver::resolveBc()` recomputed each line's montant from
the raw per-unit `price` × quantity instead of reading the already-
correctly-discounted `total_price`/`line_total_ht` columns (a global
discount is distributed into those two at write time,
`GcomPricingCalculator::applyGlobalDiscount()`, never back into
`price`/`final_price`). The REM. column also always printed "—",
reading a nonexistent `promotion_discount` field instead of deriving
the real effective discount from `original_price` vs the net total.
Fixed to read the persisted totals directly (same pattern
`resolveDevis()` already used correctly for `QuoteItem`). Investigating
this surfaced a more serious sibling bug in the same family: BC→BL
conversion copied that same stale per-unit price onto each new
`DeliveryNoteItem` — since that table has no separate line-total column
to fall back on (unlike `order_products`/`invoice_items`), its
`unit_price` is the SOLE source `InvoiceService::
generateFromDeliveryNote()` bills from, so any BC with a global
discount applied at creation would have silently **overcharged** on
the eventual BL→Facture invoice while the BL's own `total_amount`
(mirrored straight from the order) displayed correctly the whole time.
Fixed in `GcomDeliveryNoteService::createDeliveryNoteFromOrder()` to
derive the BL item's `unit_price` from the order line's own
`total_price`/`quantity` instead of copying `price` directly. Data
audit at fix time: 6 GCOM orders had a global discount live, none yet
converted to a BL — the overcharge risk was real but had not yet
actually billed anyone.

**Operational gotcha hit deploying this fix**: `DocumentService` caches
rendered PDFs on disk (MinIO), auto-invalidated only when a Blade
**template** file's mtime changes (`templateChangedSince()`) — a fix
to `DocumentDataResolver` (PHP data-prep, not the template) does NOT
trigger that check, so an already-cached PDF for an order keeps
serving its stale, pre-fix bytes indefinitely until something calls
`DocumentService::invalidate($type, $id)` explicitly. Any deploy that
changes a resolver's OUTPUT (not just a template) must manually
invalidate the affected documents' cache — done by id for the 6
affected orders above at fix time, but there's no general "invalidate
everything on deploy" mechanism, so this is a step to remember for any
future resolver fix, not just this one.

**PDF generation latency fix (2026-09-02)**: BC/BL/Invoice PDF downloads
were taking up to ~60s. Root cause: `GotenbergClient` retried on ANY
exception with `retry($retryAttempts=2, ...)`, including a slow-but-alive
render that simply hit the 30s `timeout` — doubling worst-case latency
instead of recovering anything. Fixed by setting `retry_attempts=1` (no
retry) and bumping `timeout` to 45s, in `config/gotenberg.php`'s defaults
AND every `.env*` (the live `.env.docker.production` pins these explicitly,
so the config default alone doesn't take effect — must edit both).
Separately, a new best-effort `App\Jobs\WarmDocumentPdfCache` job is
dispatched (`->onQueue('documents')`, already covered by Horizon's
`default-supervisor`) right after a BC/BL/Invoice/avoir is created —
`GcomOrderService::createOrder()`, `GcomDeliveryNoteService::
createDeliveryNoteFromOrder()`/`validateDraft()` (skips DRAFT), all
5 invoice-creating entry points in `GcomDirectInvoiceService`, and
`GcomCreditNoteService::createCreditNote()` (2026-09-02, closing the last
gap — `createFreeStandingCreditNote()` isn't warmed, it has no PDF route
yet) — so the interactive download usually hits an already-warm MinIO
cache instead of waiting on Gotenberg synchronously. The job no-ops under
PHPUnit (`app()->runningUnitTests()` / `PHPUNIT_COMPOSER_INSTALL`) — the
whole suite forces `QUEUE_CONNECTION=sync`, so without that guard it ran
real Gotenberg calls inline inside every test that creates a document
(one test hit 138s, another blew PHP's 128MB `memory_limit` reading the
Guzzle response body). A Gotenberg CPU/memory reservation was considered
and dropped: the actual host is 2 vCPU / 3.8GB, already running ~24
containers with swap saturated — a reservation wouldn't add capacity
that doesn't exist, so it wouldn't have moved the needle.

**PDF stays in sync after an edit + "generating" status + real-time
ready notification (2026-09-03)** — Team UI asked directly: does editing
a BL/BC/Facture/Devis regenerate its PDF automatically, and can the
in-progress state be surfaced to the user? Investigated precisely rather
than assumed, and found two real gaps: `DocumentService::invalidate()`
existed (docblocked "call after the document is updated") but had ZERO
callers anywhere in the app, and `WarmDocumentPdfCache` (above) was only
ever dispatched at document CREATION — an edited document kept serving
its stale pre-edit PDF until the 60min cache TTL happened to expire, with
no data-driven invalidation at all.

- `DocumentService::scheduleRegeneration($type, $id, $options = [])` —
  invalidates the current cache, sets a short-lived (2min safety-net TTL)
  "generating" flag, and dispatches `WarmDocumentPdfCache` to re-render in
  the background. Call this after ANY mutation to a document's printed
  content.
- **Wired into every real GCOM mutation** that changes what a document
  prints: BC line add/update/cancel + full cancel
  (`GcomOrderService`); BL line add/update/remove, global discount,
  partial return (CAS 1), delivery confirmation, full cancel
  (`GcomDeliveryNoteService`, mostly funneled through the shared
  `recomputeBlAndOrderTotals()` hook); Devis creation (was never
  pre-warmed at all before this — closed for consistency with the other
  3 types) + item edits + send (`QuoteService`); Invoice
  `remaining_amount`/`status` changes from a credit-note debt reduction
  or an avoir imputation (`GcomCreditNoteService`), and from a deferred
  règlement/lettering (`GcomPaymentController::store()` — schedules one
  regeneration per invoice actually lettered, explicit allocations or
  auto-lettered either way).
- **`GET .../pdf` now returns `202` while a regeneration is genuinely in
  flight**, instead of either racing the background job with a
  synchronous render or (before this feature existed) silently serving
  the file that was just invalidated:
  ```json
  { "success": false, "status": "generating", "message": "Le document est en cours de régénération suite à une modification récente. Merci de réessayer dans quelques secondes.", "type": "bl", "id": 34, "retry_after_seconds": 3 }
  ```
  `Retry-After: 3` header included. Falls back to the pre-existing
  synchronous on-demand render once the flag clears either way (job
  finished, or its 2min safety-net TTL lapsed) — this endpoint still
  always eventually returns a real PDF, it just doesn't fight a job
  that's already rendering the exact same file. **Frontend must handle
  this**: a plain `<a href>`/iframe pointed at the PDF endpoint will show
  broken JSON during the "generating" window — check status/Content-Type
  before rendering inline, show a "please wait" state, retry after the
  given delay (or react to the WebSocket event below instead of polling).
- **Real-time ready notification**: `App\Events\DocumentPdfReady`
  broadcasts on a private channel `documents.{type}.{id}` (event name
  `document.pdf.ready`, payload `{type, id, status}`, status `'ready'` or
  `'failed'`) once `WarmDocumentPdfCache` finishes — subscribe to
  dismiss/refresh a "please wait" UI without polling. Channel
  authorization (`routes/channels.php`) gates on the same coarse-grained
  `manage-gcom` permission every other GCOM endpoint already requires —
  no per-document ownership ACL exists to check more narrowly against.
- **Test-suite-only exception**: `scheduleRegeneration()` skips the
  actual `invalidate()` disk call specifically when running automated
  tests (`WarmDocumentPdfCache` dispatched right after already no-ops in
  tests too, so there's nothing real for it to usefully precede there).
  Real gap hit building this: `invalidate()`'s S3/MinIO round trip had
  never been exercised by the test suite before (zero prior callers) —
  once wired into every edit path, dozens of otherwise-unrelated
  business-logic tests started triggering it as an incidental side
  effect, and each real disk resolution left memory PHPUnit's one
  long-lived test process never reclaimed, OOMing partway through a real
  test file (confirmed by isolating it against the pre-feature commit
  under identical host load: passed clean). Not a production concern — a
  real PHP-FPM/queue-worker request is short-lived or periodically
  recycled. `invalidate()` itself stays fully real/unguarded.
- **`Cache-Control: no-store` on `GET .../pdf` (2026-09-03, Team UI
  report)** — was `private, max-age=300`, which let a BROWSER resurface
  its own stale copy on an identical URL for up to 5 minutes, completely
  invisible to `scheduleRegeneration()`'s server-side invalidation: an
  edit followed by a same-URL print within that window could still show
  the pre-edit PDF, entirely at the browser-cache layer (Team UI had
  worked around it client-side with a cache-busting query param before
  this fix landed). Applies to both the real PDF response and the `202`
  "generating" branch. These documents are small (well under 100KB in
  practice) and can change at any moment a GCOM edit happens, so the
  bandwidth a longer `max-age` would save is negligible against the
  correctness cost — `DocumentService`'s own MinIO cache already keeps a
  re-fetch of an unchanged document fast regardless.
- **Cold-render latency is a Gotenberg/host issue, not a GCOM resolver
  one** (2026-09-03, investigated after a reported 31.5s cold render):
  `DocumentDataResolver::resolveBl()` (and siblings) eager-load
  everything needed with no N+1 pattern — confirmed by reading the code,
  not assumed. Gotenberg's own access logs show the real cause: its
  internal Chromium browser periodically becomes unresponsive
  (`"browser health check failed: context deadline exceeded"`) and has to
  restart; a PDF request landing in that window blocks until Gotenberg's
  internal timeout (~30-34s) before either succeeding or failing with
  `503`/`500` (`"process restart before task"` /
  `"browser start already in progress"`). Reproducible beyond the one BL
  reported — multiple independent occurrences visible in the same log
  window. Root cause is this host's known resource ceiling (2 vCPU /
  3.8GB, ~24 containers, swap saturated — see the 2026-09-02 PDF-latency
  fix above), not application code. Re-adding a blind retry was
  considered and rejected again for the same reason it was removed
  2026-09-02: retrying on every error would double the worst-case latency
  instead of recovering anything. Left as a known infra constraint,
  partially absorbed by the pre-warm job (most real users hit an
  already-warm cache) — a real fix needs either more Gotenberg capacity
  or a smarter (health-check-aware, not blind) retry, both out of scope
  for a quick patch.

**`POST /orders`** 🔁 — flow #1 (second hop, if not started from a quote)
/ #3 / #4's BC leg.
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3, "unit_price": 95.0, "discount_percent": 8 }],
  "payment_method": "credit",
  "payment_term_id": 5,
  "notes": "Commande mensuelle",
  "client_order_ref": "PO-CLIENT-0042",
  "salesperson_id": null,
  "global_discount_amount": 50
}
```
`payment_term_id` is **required** if `payment_method` is `credit`/`transfer`
and the partner has no default payment term configured — otherwise it
falls back to `Partner.paymentTerm()`. `client_order_ref` (optional,
2026-08-27) — the customer's own PO/reference number, deliberately
separate from `notes` (`bc_notes` under the hood) since it's a
structured value, not freeform text. Lives on `orders.client_order_ref`
and is automatically mirrored onto any `delivery_notes`/`invoices` row
later created from this order (convert-to-bl, convert-to-invoice) — no
need to resend it at each conversion step. `salesperson_id` (optional,
2026-08-27, **must be a user holding the `gcom_representative` role** —
see §18, `422` via `App\Rules\IsGcomRepresentative` otherwise) — overrides
`orders.sales_rep_id` (otherwise always the authenticated user) for a
back-office user entering a sale on behalf of a field salesperson; omit
to keep the strict "creator = salesperson" default. Note: `order.sales_rep_id` is a
satellite-mirrored attribute (`order_salesperson_data`) — it does **not**
appear as a bare top-level key in any JSON response today (only nested
`order.salesperson_data.salesperson_id`), regardless of which GCOM
endpoint returns the order — flag this to the UI team if a direct
top-level field is needed for display.
→ `201`, `{ "success": true, "message": "Order created", "order": {...} }`

Does **not** touch stock or create an invoice — see §3.

### Manual negotiation — price override, discounts, anti-loss-sale guard (2026-09-01)

Available on `POST /orders`, `POST /orders/{order}/lines`, and
`PATCH /orders/{order}/lines/{orderProduct}` (all three items below).
Every check below runs BEFORE any write — a `422` never leaves a
partial edit behind.

- **`items[].unit_price`** — manual override of the catalog-resolved
  price for that line, requires the **`gcom-price-override`**
  permission (`422` otherwise). `order_products.original_price` still
  carries the catalog/undiscounted price actually used (override or
  resolved) — the audit trail for margin reporting.
- **`items[].discount_percent`** / **`items[].discount_amount`** —
  per-line discount, **mutually exclusive** on the same line (`422` if
  both are sent). Requires **`gcom-discount-line`**. A `discount_percent`
  above the paramétrable `gcom.max_discount_percent` threshold (default
  10%, resolved Partner → User → AccessProfile → Role → default via
  `ParameterService`, same mechanism the legacy SFA
  `sales.max_discount_percent` uses — configurable per partner/user/role
  through the existing paramètres admin screen, no new one built) is
  rejected (`422`) unless the actor also holds
  **`gcom-discount-override-limit`**.
- **`global_discount_percent`** / **`global_discount_amount`**
  (`POST /orders` only — document-level) — mutually exclusive, requires
  **`gcom-discount-global`**, same max-percent cap as above when
  expressed as a percent. Distributed **proportionally to each line's
  HT total, before VAT** (team's own spec) — the rounding remainder is
  assigned to the last eligible line (skips any line already at 0 HT,
  e.g. a fully-returned BL line) so the sum of lines always reconciles
  exactly to the requested discount. Because the discount is applied on
  the HT side, its impact on `total_amount` (TTC) is VAT-inclusive: a
  100 MAD discount on a 19%-VAT line reduces the total by 119 MAD, not
  100 — it removes the VAT that would have applied to the discounted
  HT along with it.
- **Anti-loss-sale guard** — every line's NET unit price (after any
  override/discount) is compared HT against `stocks.pmp_cost` (real
  PMP — Prix Moyen Pondéré, recalculated synchronously by
  `StockUpdateService::addStock()` on every real purchase reception,
  never on transfers/returns) for the product's warehouse. Below cost
  is rejected outright (`422`, *"vente à perte interdite"*) — **no
  soft block, no threshold** — bypassable only by
  **`gcom-loss-sale-override`** (deliberately a *different* permission
  from `gcom-discount-override-limit`: exceeding the discount cap and
  selling below cost are different risks with different owners on the
  terrain). A product with no PMP recorded yet (never received via
  `PurchaseReception`) skips the guard silently — nothing to compare
  against.

**Permissions** (all new, kebab-case, seeded via migration — granted to
`root`/`admin` by default, same as `manage-gcom`; assign a subset to a
real commercial/manager role as needed):

| Permission | Grants |
|---|---|
| `gcom-price-override` | Manual `unit_price` on a line |
| `gcom-discount-line` | Per-line `discount_percent`/`discount_amount` |
| `gcom-discount-global` | Document-level global discount |
| `gcom-discount-override-limit` | Exceed `gcom.max_discount_percent` |
| `gcom-loss-sale-override` | Sell below `stocks.pmp_cost` anyway (déstockage, near-expiry, damaged goods) |
| `gcom-delivery-note-edit` | Edit a line on an existing, not-yet-invoiced BL — see "BL editing" below |

**BL editing itself (2026-09-01, "FEU VERT TOTAL" part 2)** is built —
see the "BL editing" subsection under "Delivery Notes (BL)" below for
the full endpoint contracts, including `POST /delivery-notes/{id}/discount`
(2026-09-01, UI team follow-up) for a document-level discount on an
**existing** BL — safely re-appliable, unlike a BC's (set once, at
`POST /orders`, never revisited). Manual negotiation (per-line
override/discount, global discount, anti-loss-sale guard) is also now
wired into `POST /direct-invoices` (Comptoir/Facture Directe) — same
pipeline, same permissions — see "Direct Invoice" below. Global
discount is still NOT settable via `PATCH /orders/{order}/lines/{orderProduct}`
for an already-created BC (only at `POST /orders` itself) — a
dedicated "change the BC's global discount after creation" endpoint,
mirroring the BL one, would be new scope if ever needed.

**`POST /orders/{order}/convert-to-invoice`** 🔁 — flow #3 (BC → Facture,
no BL). Body: `{ "instrument"?, "souche_kind"? }` (`instrument` same shape
as quotes' convert, required for cheque/effet; `souche_kind` — see §17,
`'declared'`|`'internal'`, explicit override beating the PaymentTerm
default for this one invoice, omit to use the default). Idempotent:
calling again on an already-invoiced order returns the existing invoice
instead of erroring.
→ `200`, `{ "success": true, "message": "Order converted to invoice", "invoice": {...} }` (`invoice.souche_kind`/`invoice.token_serie_id` included)

**`POST /orders/{order}/convert-to-bl`** 🔁 — flow #4's first hop (BC → BL).
Body is optional:
```json
{ "delivery_date": "2026-08-25", "payment_method": "cash", "driver_info": "Yassine — 0600112233", "transporter_name": "Transport Atlas", "status": "in_transit" }
```
All fields optional independently. `driver_info`/`transporter_name`
(2026-08-29, free text, max 150 chars) — display/traceability only, not a
Driver FK (GCOM still has zero field-sales/fleet dependency). `status`
(2026-08-30, `'in_transit'`|`'delivered'`, default `'in_transit'`) — the
resulting BL is born `in_transit` by default (real tournée/expédition, see
§13/§18) and must go through `confirm-delivery` below before it's
invoiceable; pass `status: 'delivered'` instead for a counter/depot
pickup (the client loads the goods themselves right there) — sets
`delivered_at = now()` immediately and skips `confirm-delivery` entirely
(calling it afterwards on an already-delivered BL returns `422`).
`'draft'` (2026-08-31) — creates the BC as normal but the BL itself gets
no `TokenSerie` number and no stock deduction, both deferred to
`POST /delivery-notes/{id}/validate` below.
`delivery_date` (`YYYY-MM-DD`) defaults
to today, sets `delivery_note.delivery_date`. `payment_method` (one of
`cash`/`card`/`credit`/`cheque`/`effet`/`transfer`) defaults to the BC's
existing method; if it differs from that, it **replaces** the order's
payment method at this point (`order.financial_metadata.payment_method`) —
this is the last moment before stock/invoicing lock the order in, so it's
the last chance to correct a payment method chosen wrong at BC creation.
Changing it has real side effects, not just a label update:
- **Stamp duty is recalculated**, not left frozen from BC creation —
  moving to `cash` adds it, moving away from `cash` removes it
  (`order.stamp_duty`/`total_amount`/`payable_amount` all update
  accordingly; StampDutyService is cash-only by Moroccan law).
- **Credit is re-checked** if moving from an immediate method
  (`cash`/`card`, never checked at BC creation) to any other method —
  `422 "Credit check failed: ..."` if it fails, same as at BC creation.
- `order.is_credit_sale` and `order.payment_term_id` are re-synced when
  the credit classification flips (`credit`/`transfer` vs. everything
  else) — same resolution `POST /orders` itself uses, so `422` with "No
  payment term resolved..." if the partner has no default term and one
  wasn't already on the order.

→ `201`, `{ "success": true, "message": "Order converted to delivery note", "delivery_note": {...} }`
→ `422` on a malformed `delivery_date`, an invalid `payment_method`, a
failed credit re-check, or a missing payment term for a new credit sale.

**`POST /orders/{order}/cancel`** 🔁 — see §9. Body: `{ "reason": "..." }`
(required, max 255 chars). Only allowed if the BC has no BL and no
invoice yet.
→ `200`, `{ "success": true, "message": "Order cancelled", "order": { "bc_status": "cancelled", "cancellation_reason_code": "...", ... } }`
→ `422` if a BL or invoice already exists, or the BC isn't `confirmed`.

**`POST /orders/{order}/lines`** 🔁 — adds a brand-new product line to an
existing BC, same "before any BL/invoice" guard as the other line-level
actions below.
```json
{ "product_id": 77, "quantity": 4, "unit_price": 90.0, "discount_percent": 5 }
```
Price is resolved fresh via the same pricing engine `POST /orders` uses —
not something the client computes. `unit_price`/`discount_percent`/
`discount_amount` (2026-09-01) — same rules, permissions, and
anti-loss-sale guard as `POST /orders`' own manual-negotiation section
above. Rejects a `product_id` already on the
order (`422`) — use the `PATCH` update-line endpoint below to change an
existing line's quantity instead. For a credit-sale BC, adding a line
always grows the total, so the credit limit is unconditionally re-checked.
→ `201`, `{ "success": true, "message": "Order line added", "order": {...} }`
→ `422` if the product is already on the order, `quantity` is missing/≤ 0,
a BL/invoice already exists, the new total breaches the credit limit, a
missing permission, or the net price falls below cost.

**`POST /orders/{order}/lines/{orderProduct}/cancel`** 🔁 — partial or
full single-line cancellation, same "before any BL/invoice" guard.
`orderProduct` is the `OrderProduct` row id — `order.products[].pivot.id`
in every GCOM order response (see §14 for the gotcha this used to be
before the 2026-08-15 fix).
```json
{ "quantity": 2, "reason": "Le client a réduit sa commande" }
```
`quantity` omitted (or ≥ the line's own quantity) removes the line
entirely. Removing the last remaining line cancels the whole BC (same
effect as the whole-order cancel above).
→ `200`, `{ "success": true, "message": "Order line cancelled", "order": {...} }`

**`PATCH /orders/{order}/lines/{orderProduct}`** 🔁 — changes a BC line's
quantity in **either** direction (the cancel endpoint above only ever
reduces/removes). Same "before any BL/invoice" guard, same `orderProduct`
id gotcha as above.
```json
{ "quantity": 15, "unit_price": 88.0, "discount_amount": 20 }
```
Price is re-resolved fresh for the new quantity (not linearly rescaled),
so a price-list change since the BC was created is picked up — other,
untouched lines on the same order keep their original creation-time price.
`unit_price`/`discount_percent`/`discount_amount` (2026-09-01) — same
rules, permissions, and anti-loss-sale guard as `POST /orders`' own
manual-negotiation section above; omitted, the line's own existing
override/discount is simply dropped (re-priced from catalog, same as
before this feature).
For a credit-sale BC, the credit limit is re-checked only when the new
total is **higher** than before a reduction never needs re-checking.
Stock is **not** touched — a GCOM BC never touches stock either way (see
§3); there is nothing to reflect until the BC is converted to a BL/invoice.
→ `200`, `{ "success": true, "message": "Order line updated", "order": {...} }`
→ `422` if `quantity` is missing/≤ 0 (use the cancel endpoint to remove a
line), a BL/invoice already exists, the new total breaches the
partner's credit limit, a missing permission, or the net price falls
below cost.

### Delivery Notes (BL)

**Montant HT/TVA/TTC**: `delivery_notes` has no `sub_total`/`tax_amount`
columns at all in the schema — only a flat TTC `total_amount`. Since a
GCOM BL always has an underlying Order with the real breakdown already
correct, `index`/`show`/`store` below all attach `sub_total` (HT) and
`tax_amount` (TVA) to the response, proxied from that order — read them
directly off `delivery_note.sub_total`/`delivery_note.tax_amount`, no
need to reach into `delivery_note.order` for them.

**`GET /delivery-notes`** — scoped to `order.canal = 'GCOM'`. Query:
`partner_id?`, `status?` (in practice only `delivered`|`cancelled` for
GCOM — no separate confirm/load/transit steps, a BL is `delivered` the
moment it's created; see §13), `per_page?`.

**`GET /delivery-notes/list-view`** 🔁 (2026-08-23, UI team report) —
lightweight BL datagrid feed, same pattern as `GET /orders/list-view`
above. Full `GET /delivery-notes` measured ~1.3KB/row (41 root fields
+11 on `partner`) for a grid that renders 7: `delivery_number`,
`partner.name`, `status`, `invoice_id` (the "Facturé" column — truthy/
falsy, not the full invoice), `total_amount`, `delivery_date`. Selects
only those at the DB level; unlike `withHtTvaBreakdown()` on the full
endpoint, `total_amount` here is `delivery_notes`' own flat TTC column
directly — no order-proxied HT/TVA computation, the grid only ever
shows TTC. Same `partner_id`/`status` filters as the full index. `id`
included beyond the UI team's literal list (row key/navigation).
→ `{ "success": true, "delivery_notes": { "data": [{ "id": 34, "delivery_number": "BLORBI-A01-00003", "partner": { "name": "..." }, "status": "delivered", "invoice_id": null, "total_amount": 26.00, "delivery_date": "2026-08-23T10:00:00+00:00" }], ...pagination... } }`

**`GET /delivery-notes/{deliveryNote}`** 🔁 (trimmed 2026-08-23, UI team
audit of the BL detail screen's actual frontend code — same
100%-dedicated confirmation as `GET /orders/{order}`'s own trim above)
— 404 if not from a GCOM order. Was the full `DeliveryNote` model plus
a fully-hydrated nested `order` (~75 fields, `salesperson_data`/
`financial_metadata` included) — the screen reads exactly 3 values off
that nested order (`id`, `order_code`,
`financial_metadata.payment_method`), so the nested `order` object is
gone entirely, replaced with 3 flat fields (`order_id`, `order_code`,
`order_payment_method`) — per the UI team's own recommendation, the
single biggest contributor to the old response's weight. `sub_total`/
`tax_amount`/`global_discount_percent`/`global_discount_amount` stay
proxied from the order (`delivery_notes` has no columns of its own for
the first two — see this section's intro above). `items[]` drops the
product name/code (resolved client-side via a separate product cache)
down to `id`, `product_id`, `ordered_quantity`, `delivered_quantity`,
`unit_price`, `original_price`, `final_price`. `partner` is `id`/`name`
only, same as the BC trim.

Also confirmed while auditing this: `delivery_notes` (the table) has a
real column literally named `delivery_notes` (distinct from `notes`) —
grepped across the whole backend, zero app-code reads or writes it.
Dead legacy column, excluded from this trimmed response; a genuine
drop-column cleanup candidate if anyone wants to pick it up, not done
here (out of scope for a response-shape trim).
→ `{ "success": true, "delivery_note": { "id": 35, "delivery_number": "BLORBI-...", "status": "delivered", "total_amount": 100.0, "sub_total": "...", "tax_amount": "...", "delivery_date": "...", "notes": null, "invoice_id": null, "global_discount_percent": null, "global_discount_amount": null, "driver_info": null, "transporter_name": null, "delivered_at": "...", "items": [{ "id": 1, "product_id": 5, "ordered_quantity": 1, "delivered_quantity": 1, "unit_price": 100.0, "original_price": null, "final_price": null }], "partner": { "id": 1, "name": "..." }, "order_id": 110, "order_code": "BCORBI-...", "order_payment_method": "cash" } }`

**`GET /delivery-notes/{deliveryNote}/pdf`** — streams the BL PDF
(`Content-Type: application/pdf`). `?download=1` for an attachment,
`?price_mode=ht|ttc` for whether line items print HT or TTC (defaults to
`ttc` if omitted — the opposite default from BC/Devis, this document's own
existing convention). Same generic document pipeline as BC above
(`App\Services\DocumentService`, type `bl`). Not a JSON endpoint.

**`POST /delivery-notes`** 🔁 — flow #5 (BL Direct → Facture). Creates an
underlying BC transparently, then the BL — stock deducts **here**, at BL
creation, not later (unchanged by the 2026-08-29 lifecycle change below —
stock timing never depended on delivery status).
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3, "unit_price": 95.0, "discount_percent": 8 }],
  "payment_method": "cash",
  "notes": "Livraison directe comptoir",
  "delivery_date": "2026-09-01",
  "client_order_ref": "PO-CLIENT-0042",
  "salesperson_id": null,
  "driver_info": "Yassine — 0600112233",
  "transporter_name": "Transport Atlas",
  "status": "in_transit",
  "global_discount_amount": 50
}
```
**Manual negotiation fields** (2026-09-02, aligned with `POST /orders` —
requested so a comptoir/dépôt BL doesn't need a second round-trip through
the line-editing endpoints just to apply a negotiated price):
`items[].unit_price`/`discount_percent`/`discount_amount` and
`global_discount_percent`/`global_discount_amount` go through the exact
same pipeline as `POST /orders` §8 above — same RBAC gates
(`gcom-price-override`/`gcom-discount-line`/`gcom-discount-global`/
`gcom-discount-override-limit`), the same `gcom.max_discount_percent`
cap, the same proportional-to-HT global discount distribution, and the
same anti-loss-sale check against `stocks.pmp_cost`
(`gcom-loss-sale-override` to bypass) — nothing new was built for BL
specifically, `createDirectDeliveryNote()` creates its transparent
underlying BC through the identical `GcomOrderService::createOrder()`
call BC itself uses.

`delivery_date` (optional, `YYYY-MM-DD`, 2026-08-27) — defaults to today
if omitted, same semantics as `convert-to-bl`'s own `delivery_date`
(previously this direct-creation endpoint had no way to set it at all —
it always silently forced today). `client_order_ref` (optional,
2026-08-27) — see the note on `POST /orders` above; on this endpoint it
lands on both the transparently-created order and this BL.
`salesperson_id` (optional, 2026-08-27) — see the note on `POST /orders`
above; applies to the transparently-created order underneath this BL.
`driver_info`/`transporter_name` (optional, free text, max 150 chars,
2026-08-29) — see `convert-to-bl`'s equivalent note above.

`status` (optional, `'in_transit'`|`'delivered'`, default `'in_transit'`,
2026-08-30) — **the resulting BL is born `in_transit` by default**
(§13/§18) — real distribution has goods physically leaving before a
driver confirms delivery, so it must go through `confirm-delivery` below
before `convert-to-invoice` will accept it. Pass `status: 'delivered'`
for a counter/depot pickup instead — the client loads the goods
themselves right there, so there's no real transit leg to model: this
sets `delivered_at = now()` immediately and the BL is invoiceable right
away (`confirm-delivery` afterwards would `422` — already delivered).
`'draft'` (2026-08-31) — no `TokenSerie` number, no stock deduction; the
response's `delivery_number` is a placeholder (`"DRAFT-{uuid}"`) until
`POST /delivery-notes/{id}/validate` below is called.
→ `201`, `{ "success": true, "message": "Delivery note created", "delivery_note": { "id": 5, "status": "in_transit", "total_amount": "320.80", "sub_total": "268.91", "tax_amount": "51.09", "client_order_ref": "PO-CLIENT-0042", "driver_info": "Yassine — 0600112233", "transporter_name": "Transport Atlas", ... } }`

**`POST /delivery-notes/{deliveryNote}/confirm-delivery`** 🔁 (2026-08-29,
§13/§18) — `in_transit` → `delivered`. No body. Sets `delivered_at` (never
set at BL creation anymore — a BL that hasn't been confirmed has no real
delivery timestamp yet). Does **not** touch stock (already deducted at BL
creation, regardless of delivery status) or trigger any settlement
(`payment_transfers`/`letterings`/`FinancialInstrument` — those still
only ever happen at `convert-to-invoice`, exactly as before this feature;
this only adds a delivery-confirmed gate in front of that existing
trigger, nothing else changes about how settlement works).
→ `200`, `{ "success": true, "message": "Delivery confirmed", "delivery_note": { "status": "delivered", "delivered_at": "2026-08-29T09:15:00.000000Z", ... } }`
→ `422` if the BL isn't currently `in_transit` (already `delivered`,
`cancelled`, etc.) — `"Delivery note {id} cannot be confirmed delivered
from status '...' (must be in_transit)."`

**`POST /delivery-notes/{deliveryNote}/validate`** 🔁 (2026-08-31) —
`draft` → `in_transit`/`delivered`. Draws the real `TokenSerie` BL number
(overwrites the `DRAFT-{uuid}` placeholder) and deducts stock — both
deferred from creation for a draft, done unconditionally here instead.
```json
{ "status": "in_transit" }
```
`status` optional, `'in_transit'`|`'delivered'`, default `'in_transit'` —
same two options and same `delivered_at` handling as the initial-status
parameter on `POST /delivery-notes` above.
→ `200`, `{ "success": true, "message": "Delivery note validated", "delivery_note": { "status": "in_transit", "delivery_number": "BLORBI-A01-000012", ... } }`
→ `422` if the BL isn't currently `draft`.

**`POST /delivery-notes/{deliveryNote}/convert-to-invoice`** 🔁 — flow #4
second hop / #5's only hop. Body: `{ "instrument"?, "souche_kind"? }` (see
§17 for `souche_kind`). **New guard (2026-08-29)**: `422` if the BL is
still `in_transit` — `"Delivery note {id} cannot be invoiced from status
'in_transit' — confirm delivery first."` Call `confirm-delivery` above
first.
→ `200`, `{ "success": true, "message": "Delivery note converted to invoice", "invoice": {...} }` (`invoice.souche_kind`/`invoice.token_serie_id` included)

**`partners.invoicing_mode` now branches this endpoint's behavior
(2026-08-31)** — resolved from the BL's own order's partner, not a
separate parameter:
- `1_FAC_PER_BL` (default/null): unchanged, everything above.
- `1_FAC_PER_ORDER`: call this endpoint on **any** BL of the order, same
  as always — the backend decides whether it's ready. If any
  non-cancelled sibling BL isn't `delivered` yet: `422`,
  `"Order {id} (mode 1_FAC_PER_ORDER) cannot be invoiced yet — N delivery
  note(s) not yet delivered."` Once every sibling is delivered, calling it
  on ANY of them consolidates every still-uninvoiced sibling into ONE
  invoice covering all of them — same response shape, `invoice.id` is
  shared across every sibling BL's own `delivery_note.invoice_id`.
  Calling it again on any sibling afterward just returns that same
  invoice (idempotent, no duplicate). `payment_method` (the avoir-too-small
  override) and an explicit `souche_kind` are **not supported yet** for
  this mode — `422` if either is passed, not a silent no-op.
- `PERIODIC_FIN_DE_MOIS`: always `422` —
  `"Delivery note {id}'s partner is billed periodically (fin de mois) —
  it stays delivered/uninvoiced until the monthly GCOM periodic run, not
  invoiced on demand."` The BL stays `delivered`+uninvoiced;
  `GcomGeneratePeriodicInvoicesCommand` (`gcom:generate-periodic-invoices`,
  scheduled monthly, 1st at 01:30) consolidates every `PERIODIC_FIN_DE_MOIS`
  partner's GCOM BLs into one 'pending' credit invoice per partner —
  settled later through the normal règlement screen (§6/§8's
  `POST /payments`), same as any other GCOM credit sale. Not wired up
  yet: PDF for a periodic invoice (no single `order_id` to key GCOM's
  document pipeline off of — same pre-existing gap the legacy/SFA
  periodic path also has).

**`POST /delivery-notes/{deliveryNote}/cancel`** 🔁 — see §9. Restocks
immediately. Body: `{ "reason": "..." }` (required, max 255 chars).
A still-`draft` BL (2026-08-31) skips the restock entirely — nothing was
ever deducted, so this is a plain abandon, not a reversal.
→ `200`, `{ "success": true, "message": "Delivery note cancelled", "delivery_note": {...} }`
→ `422` if an invoice already exists for this BL.

**`POST /delivery-notes/{deliveryNote}/lines/{item}/return`** 🔁 —
2026-08-18, see §9bis (CAS 1 of the returns architecture). `{item}` is the
`DeliveryNoteItem` row id (`delivery_note.items[].id`).
```json
{ "quantity": 3, "reason": "DAMAGED", "condition": "damaged" }
```
`condition` — `sellable` (default) | `damaged` | `technical` — see §9bis
for exactly where each one lands. `reason` — **2026-08-18, was free text,
now one of**: `DEFECTIVE`, `DAMAGED`, `WRONG_ITEM`, `CHANGE_MIND`,
`NOT_AS_DESCRIBED`, `EXPIRED`, `CUSTOMER_REQUEST`, `DUPLICATE_ORDER`,
`OTHER` (the same `App\Enums\ReturnReason` `credit_note_items` already
uses) — breaking change, `422` for anything else now. `quantity` may now
equal the line's current quantity (2026-08-31, was strictly less — a
100%-damaged single line on a multi-line BL previously had no path that
didn't cancel the whole BL; see §9bis). Restocks immediately and
recomputes the BL's `total_amount`; no separate step needed to bill the
net quantity — `convert-to-invoice` already reads the line's live
quantity and now correctly EXCLUDES a zeroed line from the invoice
entirely (§9bis — a real latent bug was fixed alongside this: a zero
quantity used to be silently resurrected to the full original order
quantity). A zeroed line is NOT removed from the BL — `GET
/delivery-notes/{id}` keeps returning it in `items[]` at quantity `0`
(build the "Retourné intégralement" UI state off that, don't hide the
row), and the BL itself is never auto-cancelled even if every line
reaches zero. Each call is now also persisted as its own row (see
below) — previously `reason`/`condition` only ended up as freeform text
buried in `StockMovement.notes`, unreachable from any GET.
→ `200`, `{ "success": true, "message": "Delivery note line reduced", "delivery_note": {...} }`
→ `422` if the BL is already invoiced, `quantity` exceeds the line's
current quantity, or `reason` isn't one of the values above.

### BL editing (2026-09-01, "FEU VERT TOTAL" part 2)

Add/update/remove a line on an existing, not-yet-invoiced BL — distinct
from the return endpoint above (that's a customer-facing return with a
condition/reason audit trail; this is a plain pre-invoice correction,
e.g. a data-entry mistake, no `DeliveryNoteReturn` row). All three
require **`gcom-delivery-note-edit`**. Confirmed guard (team's own
arbitrage): `invoice_id IS NULL` — there is no "caisse session" concept
a BL is ever tied to (settlement only ever happens at invoicing, §3).
Also requires `status` to be `in_transit`/`delivered` — a `draft` BL
has no stock deducted yet (§13), so the delta logic below doesn't apply
to it; scoped out with a clear `422` rather than silently mishandled.

Same manual-negotiation payload/permissions/anti-loss-sale guard as
`POST /orders`'s own section above (`unit_price` → `gcom-price-override`,
`discount_percent`/`discount_amount` → `gcom-discount-line` + the
`gcom.max_discount_percent` cap, `gcom-loss-sale-override` for a
below-`pmp_cost` sale) — **not re-documented here**, only what's
BL-specific: unlike a BC line edit (which never touches stock — a BC
never deducts any), a BL already deducted stock at creation, so every
edit here reacts on real stock **immediately**, by the delta:

**`POST /delivery-notes/{deliveryNote}/lines`** 🔁
```json
{ "product_id": 77, "quantity": 4, "unit_price": 90.0, "discount_percent": 5 }
```
Deducts stock for the full new quantity. Rejects a `product_id`
already on the BL (`422`) — use `PATCH` below instead.
→ `201`, `{ "success": true, "message": "Delivery note line added", "delivery_note": {...} }`

**`PATCH /delivery-notes/{deliveryNote}/lines/{item}`** 🔁
```json
{ "quantity": 8, "unit_price": 88.0 }
```
`{item}` is the `DeliveryNoteItem` row id, same as the return endpoint.
Stock moves by the **delta** only: quantity grew → deducts the
difference; quantity shrank → restocks the difference (never a blind
re-deduct/re-add cycle). Omitting `unit_price`/`discount_percent`/
`discount_amount` re-prices from catalog, dropping any existing
override on that line.
→ `200`, `{ "success": true, "message": "Delivery note line updated", "delivery_note": {...} }`

**`POST /delivery-notes/{deliveryNote}/lines/{item}/remove`** 🔁
```json
{ "reason": "Erreur de saisie" }
```
Removes the line entirely, restocking its full remaining quantity as a
flat `adjustment` movement (no condition routing, no
`DeliveryNoteReturn` row — that machinery is for the customer-facing
return endpoint above, not this one). Removing the **last** remaining
line cancels the whole BL (`bl.status` → `cancelled`,
`order.bc_status` → `cancelled`, same "a document with zero lines
isn't a valid state" rule `POST /orders/{order}/lines/{orderProduct}/cancel`
already applies to a BC) — same effect as `POST /delivery-notes/{id}/cancel`,
just reached by emptying the BL one line at a time instead.
→ `200`, `{ "success": true, "message": "Delivery note line removed", "delivery_note": {...} }`

**`POST /delivery-notes/{deliveryNote}/discount`** 🔁 (2026-09-01, UI team
follow-up) — sets, replaces, or clears the BL's document-level discount.
Requires `gcom-delivery-note-edit` **and** `gcom-discount-global`.
```json
{ "global_discount_percent": 15 }
```
or `{ "global_discount_amount": 60 }` (mutually exclusive), or `{}` to
**clear** a previously-applied discount.

Genuinely different from a BC's global discount (set once, at
`POST /orders`, never revisited by a later line edit) — a BL's real
use case is a commercial re-negotiating **after** delivery, possibly
more than once. **Safely re-appliable**: unlike naively redistributing
from each line's current `unit_price` (which would compound — a 20%
call followed by a 10% call would wrongly yield ~28% off, not a fresh
10%), this always redistributes from each item's `final_price` — the
stable, post-line-discount/pre-global-discount price, permanently set
once at BL creation (or by a later `addLine`/`updateLine` call) and
never touched again by this endpoint.

**Fixed 2026-09-03** (Team UI live-testing report on the BL payload
alignment feature, §"Alignement payload BL" below): a BL created via the
manual-negotiation payload (`POST /delivery-notes` with its own
creation-time `global_discount_percent`/`items[].discount_percent`) used
to have `final_price` seeded from the already-globally-discounted total
instead of the pre-global-discount price — so a later call here would
silently compound on top of the creation-time discount rather than
redistributing fresh. Note that the fresh discount is computed on top of
the *permanent* line-level discount (if any) — it's only the global
portion that resets on every call, matching a BC's own line/global split
where line discounts are never re-litigated by a global one.
→ `200`, `{ "success": true, "message": "Delivery note discount updated", "delivery_note": {...} }`

**HT/TVA + discount proxy staying in sync**: `delivery_notes`/
`delivery_note_items` carry no HT/tax-breakdown columns of their own —
only a flat TTC `total_amount` (see
`GcomDeliveryNoteController::withHtTvaBreakdown()`'s own docblock: the
`sub_total`/`tax_amount` a `GET` response shows are proxied from the
underlying `order`). Every edit above recomputes those order-level
fields directly from the BL's own current items (not the order's
original `order_products`, which the BL may now have diverged from) —
the proxy never goes stale after a BL edit. The same method also proxies
`global_discount_percent`/`global_discount_amount` onto the BL's own
root (2026-09-03, Team UI report — these were only visible nested under
`order` before): preferring the BL's own column (set by a real
`POST .../discount` call) and falling back to the order's value (the
creation-time-only case, since a discount set purely at `POST
/delivery-notes` never gets backfilled onto the BL row itself).

**`GET /delivery-notes/{deliveryNote}/returns`** — 2026-08-18. Every CAS 1
return event recorded against this BL (any line), newest first.
→ `{ "success": true, "returns": [{ "id": 7, "delivery_note_item_id": 12, "product": {"code": "P001", "name": "..."}, "quantity": "3.000", "condition": "damaged", "reason": "DAMAGED", "stock_location": "GCB01-DAMAGED", "returned_by": {"id": 3, "name": "..."}, "returned_at": "2026-08-18T10:30:00.000000Z" }] }`

**`GET /delivery-notes/{deliveryNote}/returns/{return}/pdf`** — 2026-08-18,
bon de retour. `{return}` is a row id from the list above (each `return`
call already touches exactly one product/line, so one row prints cleanly
as one document — no aggregation across multiple return events). Same
generic pipeline as BC/Devis/BL/Facture (`App\Services\DocumentService`,
type `return`), same design family (logo, info boxes, line table,
signature block). `?download=1` for an attachment. `404` if `{return}`
doesn't belong to `{deliveryNote}` or the BL isn't a GCOM one.

### Direct Invoice (Facture Directe / Comptoir)

**`POST /direct-invoices`** 🔁 — flow #6, the 1-click path: BC + stock-out
+ invoice in one call. This is the endpoint a POS-style "comptoir" screen
should call.
```json
{
  "partner_id": 12,
  "items": [{ "product_id": 42, "quantity": 3, "unit_price": 95.0, "discount_percent": 5 }],
  "payment_method": "cash",
  "notes": "Vente comptoir",
  "payment_term_id": null,
  "instrument": null,
  "souche_kind": null,
  "client_order_ref": null,
  "salesperson_id": null,
  "global_discount_amount": 20
}
```
`souche_kind` — 2026-08-26, see §17 — `'declared'`|`'internal'`, optional.
Explicit per-transaction override: a cash/cheque sale never carries a
caller-chosen `payment_term_id` at all (the one global cash term is
always resolved regardless of what's passed), so this is the only way to
mark one specific comptoir sale internal. Omit to use the
`PaymentTerm.is_internal_souche`-derived default (`'declared'` unless the
resolved term is flagged internal). `client_order_ref` (optional,
2026-08-27) — see the note on `POST /orders` above. `salesperson_id`
(optional, 2026-08-27) — see the note on `POST /orders` above.
`items[].unit_price`/`discount_percent`/`discount_amount` and
`global_discount_percent`/`global_discount_amount` (2026-09-01, UI team
follow-up: "vente comptoir avec négociation globale immédiate") —
identical rules/permissions/anti-loss-sale guard as `POST /orders`'s own
manual-negotiation section — real terrain case: a loyal client, a
one-off commercial gesture on the whole basket rather than product by
product. Reuses the exact same pipeline as the BC path (`GcomOrderBuilder::
build()` already persists the discount fields), so the resulting
invoice's `items[].unit_price` already reflects it net; `invoices.
discount_amount`/`global_discount_percent` also carry the request
forward onto the invoice header for record.
→ `201`, `{ "success": true, "message": "Invoice created", "invoice": { "id": 88, "status": "fully_paid", "total_amount": "75.19", "remaining_amount": "0.00", "souche_kind": "declared", "token_serie_id": 4, "client_order_ref": null, "items": [...], "partner": {...}, "order": {...} } }`

### Invoices (mostly consultation — see consolidate below)

Every flow above lands here — there's no separate "create invoice"
concept beyond the endpoints already listed, except `consolidate` below.

**`GET /invoices`** — scoped to `order.canal = 'GCOM'`. Query:
`partner_id?`, `status?` (`pending`|`partially_paid`|`fully_paid`|
`overdue` — see §13), `from?`/`to?` (invoice_date range, `YYYY-MM-DD`),
`per_page?`.

**`GET /invoices/{invoice}`** — 404 if not a GCOM invoice. Response
includes `items`, `partner` (full model), `order`, `order.deliveryNotes`,
plus two attached fields (2026-08-15, real gap reported by the UI team):

- `payments` — array, every `payment_transfers` row lettered against this
  invoice (comptoir settlements from §4's treasury unification AND
  deferred règlements from §6, same shape either way): `payment_transfer_id`,
  `code`, `amount_applied` (this lettering's share — usually the full
  invoice total, since GCOM never splits one payment across several
  invoices today), `payment_total_amount`, `payment_method`, `status`,
  `reference`, `bank`, `payment_date`, `lettering_date`, `notes`. Empty
  array for a `credit`/`transfer` invoice not yet settled.
- `financial_instrument` — object or `null`. The registered cheque/effet
  for this invoice (§4), with its own bank-clearing lifecycle independent
  of the invoice's own status: `id`, `instrument_type`, `reference_number`,
  `status` (`pending`/`deposited`/`cleared`/`rejected`), `amount`,
  `due_date`, `bank_name`, `bank_account`, `deposited_at`, `cleared_at`,
  `rejected_at`, `rejection_reason`. Always `null` for cash/card/credit/
  transfer.

**`GET /invoices/{invoice}/pdf`** — streams the invoice PDF
(`Content-Type: application/pdf`). Migrated 2026-08-18 onto the same
`DocumentService`/`documents._layout` pipeline BC/Devis/BL already use
(was `InvoiceDocumentService`/`documents.invoice_v1` — same plainer
template still used, untouched, by `Backend\OrderController` and POS).
Two real gaps this closed, both reported by the UI team after wiring a
shared "Imprimer" (HT/TTC) button across all 4 GCOM screens:

- `?price_mode=ht|ttc` — line-item prices HT or TTC. **Defaults to TTC**
  if omitted (this endpoint's own pre-existing convention — unlike BC/Devis,
  which default to HT), so existing callers see no behavior change.
- `?download=1` — attachment instead of inline (same query param BC/Devis/BL
  already use).
- Visual design now matches BC/Devis/BL exactly (logo, status badge,
  detailed CODE/DÉSIGNATION/UNITÉ/QTÉ/P.U./REM./MONTANT/TVA table, seller/
  client info boxes incl. a payment box with due date + mode, a
  payé/reste-à-payer breakdown when the invoice isn't fully settled,
  signature grid, legal footer) — no longer the older, sparser
  `invoice_v1` layout.

### `POST /invoices/consolidate` — on-demand cross-order BL grouping (2026-09-01)

"Feu vert" follow-up to the `1_FAC_PER_ORDER` work above: reported live
that `convert-to-invoice` invoiced a single BL immediately for a
grouped-billing wholesale client instead of waiting/consolidating.
Root cause, confirmed live before building anything: **a GCOM order can
only ever have one BL** (`GcomDeliveryNoteService::
createDeliveryNoteFromOrder()`'s own idempotent guard returns the
existing BL rather than ever creating a second one) — so
`convertOrderToConsolidatedInvoice()`'s "wait for every sibling BL of
this order" logic can never actually consolidate more than one; there
was nothing broken to fix there. The real need was multiple SEPARATE
orders of the same client, grouped on demand — a different endpoint.

Reuses `InvoiceService::generatePeriodicInvoice()` — the exact same
cross-order consolidation primitive `PERIODIC_FIN_DE_MOIS` already
relies on (`invoices.order_id` left NULL by design for a batch spanning
several orders) — rather than inventing a second one.

Body:
```json
{
  "delivery_note_ids": [24, 25, 31],
  "payment_method": "credit",
  "payment_term_id": 4,
  "instrument": { "reference_number": "...", "due_date": "..." },
  "souche_kind": "declared"
}
```
- `delivery_note_ids` — required, **≥ 2** (a single id is the existing
  `convert-to-invoice` endpoint). Every BL must: belong to the **same
  partner**, be `DELIVERED`, not already invoiced, and come from a GCOM
  order — `422` listing the offending ids otherwise, before any write.
- `payment_method` — optional **only if every selected BL's order
  naturally agrees** on one (read the same way `convert-to-invoice`'s
  override does, §8's own section above); a real disagreement (e.g. one
  order was `cash`, another `credit`) gets a `422` asking for an
  explicit value rather than silently picking one. Any real method
  (`cash`/`card`/`cheque`/`effet`/`credit`/`transfer`) — `avoir` is not
  supported here yet.
- `payment_term_id` — optional, same "explicit beats natural agreement,
  422 if neither resolves" rule, needed when overriding to
  `credit`/`transfer` and the partner has no default term.
- `souche_kind` — same consistency rule as `payment_method`: an invoice
  can only ever draw from ONE `TokenSerie` series, so if the selected
  orders' payment terms don't all naturally resolve to the same souche
  (§17), an explicit value is required.
- `instrument` — required for `cheque`/`effet`, same shape as every
  other settlement endpoint.

Response: the created invoice (`items`, `partner` loaded). Every
selected BL is stamped with this invoice's id — `delivery_notes.
invoice_id` remains the authoritative, precise record of exactly which
BLs a consolidated invoice covers; `invoice.order_id` is backfilled
with the lowest-id selected order purely so the existing settlement
pipeline has a real FK to letter against (`letterings.order_id` is a
hard `NOT NULL` column — there is no `invoice_id` column on that table
at all, §6) — treat it as a "primary order" convenience for reporting,
not as the full picture.

Real bug found building this: `InvoiceService::generatePeriodicInvoice()`
read `$billingPartner?->payment_term_id` to resolve the invoice's own
due date — but `Partner` has no read accessor for that virtual
attribute (only a write mutator routing to the `partner_payment_terms`
pivot, see §21 of the partner/address doc), so it always evaluated to
`null`. Dead code on **every** call, including the pre-existing monthly
`PERIODIC_FIN_DE_MOIS` cron — silently landing on `calculateDueDate()`'s
30-day fallback instead of the partner's real term. Fixed to read the
`paymentTerm` relation directly.

Not a JSON endpoint: point a browser `<a href>`/download button directly
at this URL (with the auth header), don't run it through your normal JSON
fetch wrapper.

**Real bug found 2026-09-04** (Team UI report on a consolidated invoice —
TVA showing 0 despite every line correctly carrying its own tax_amount):
all three BL-derived invoice-creation paths —
`InvoiceService::generateFromDeliveryNote()` (`1_FAC_PER_BL`, the
default, most common mode), `generateFromOrderDeliveries()`
(`1_FAC_PER_ORDER`), and `generatePeriodicInvoice()`
(`PERIODIC_FIN_DE_MOIS` + the ad-hoc multi-order `consolidateDeliveryNotes()`
above) — seeded `subtotal`/`total_amount` at creation from
`$bl->original_total`/`$bl->final_total`, columns `DeliveryNote` doesn't
actually have. The fallback always silently resolved to the raw,
TTC-inclusive `total_amount` for BOTH fields, making `subtotal` and
`total_amount` end up identical — and `tax_amount` was never included in
any of the three `Invoice::create()` calls at all, staying at its 0.00
default regardless of what every individual `invoice_item` correctly
computed. Not limited to consolidation — this affected every GCOM invoice
ever created from a BL, single or merged. A repo-wide scan found 15
already-affected production invoices; all corrected in place from their
own (already-correct) line items.

Fixed with a shared `recomputeInvoiceTotalsFromItems()` helper, called
after an invoice's items are actually created (and after any promotion
adjustment) in all three methods — sums the real per-item
`tax_amount`/`line_total` rather than trusting anything derived from the
source BLs. Two related findings surfaced fixing this:
- **Stamp duty** ("droit de timbre", cash-only by Moroccan law) lives
  only on the `Order` (`StampDutyService`) — `Invoice` has no
  `stamp_duty` column at all, and it's neither part of any product line
  nor of `tax_amount`. Omitting it would silently drop a real,
  already-collected amount from a cash invoice's total — each caller now
  passes the sum of `stamp_duty` across whichever order(s) actually back
  the invoice. `Order.stamp_duty` is itself a PHP-level `Attribute`
  accessor reading through `financialMetadata`, not a real column
  (stale `$fillable`/`$casts` entries on `Order` claim otherwise) — a
  raw query-builder `->sum('stamp_duty')` throws `SQLSTATE[42703]`
  in production; must load real `Order` models and sum via the
  `Collection` instead, which does invoke the accessor.
- **`createInvoiceItemsFromBlItems()` preferred `DeliveryNoteItem.final_price`
  over `unit_price`** when pricing an invoice line — harmless before
  2026-09-03 (the two fields were normally kept equal), but the BL
  global-discount-compounding fix (§ above) deliberately repurposed
  `final_price` into a narrow "pre-global-discount anchor" for
  `setGlobalDiscount()`'s own re-negotiation logic — it no longer
  reflects a document-level discount the way `unit_price` does.
  Preferring it here silently billed the pre-global-discount amount on
  an invoice generated from a BL created (or re-negotiated) with a
  global discount. Previously invisible because the header total was
  trusted directly from `bl.total_amount` rather than summed from these
  items — surfaced by the `recomputeInvoiceTotalsFromItems()` fix, which
  correctly sums the items and exposed the pre-existing per-item bug
  underneath. Fixed to prefer `unit_price`.

**Real production incident, 2026-08-23** (Team UI report): `recomputeInvoiceTotalsFromItems()`
isn't only called once at creation — it can run again later against the
SAME invoice (e.g. a header/stamp_duty correction applied after the
fact). It used to set `remaining_amount => $totalAmount` unconditionally,
which is correct on first creation (`paid_amount` is always `0` then)
but silently erases any payment already collected on a second call:
two already fully-paid invoices (74, 77) had `remaining_amount`/`status`
reset back to unpaid while `paid_amount` stayed untouched, desyncing the
"Factures Ouvertes" list from the partner's real (correctly-aggregated)
ledger balance. Fixed to net `remaining_amount` against the invoice's
current `paid_amount` instead of blindly overwriting it; no behavior
change on the normal creation path.

### Avoir (Credit Notes) — see §9 for the full design

**`GET /invoices/{invoice}/credit-notes`** — list credit notes issued
against one invoice.
→ `{ "success": true, "credit_notes": [{ "id": 3, "status": "APPROVED", "total_amount": "75.19", "refund_amount": "0.00", "items": [...] }] }`

**`POST /invoices/{invoice}/credit-notes`** 🔁
```json
{
  "amount": null,
  "reason": "Retour marchandise défectueuse",
  "items": [{ "product_id": 42, "quantity": 1, "condition": "damaged" }]
}
```
- `amount` omitted → full `total_amount` (this **is** how a GCOM invoice
  gets cancelled after the fact — no separate "cancel invoice" endpoint).
- `items` present → also restocks (a physical "retour"); `items` omitted
  → pure financial correction, no stock movement.
- `items[].condition` — 2026-08-18, `sellable` (default) | `damaged` |
  `technical` — see §9bis for exactly where each one lands. Omit entirely
  for a plain sellable return, no behavior change from before this field
  existed.
- `reason` is required, max 500 chars.

→ `201`, `{ "success": true, "message": "Credit note created", "credit_note": {...}, "invoice": { "remaining_amount": "0.00", "status": "fully_paid", ... } }`
→ `422` if `amount` exceeds the invoice's `total_amount`.

**`GET /invoices/{invoice}/credit-notes/{creditNote}/pdf`** — same
binary-PDF pattern as every other document PDF route in this API (§ the
common `withoutMiddleware('force.json')` note applies here too). `404`
if the credit note doesn't belong to the given invoice (cross-invoice
guard, same as every other nested-resource PDF route).

**`GET /credit-notes`** (2026-08-31) — company-wide "Avoirs" list, same
family as `/partners/statements` but a plain filtered/paginated query
(no aggregation — `CreditNote` carries no per-row perf risk). Query:
`partner_id?`, `status?`, `branch_id?`, `from?`/`to?` (`created_at`,
`YYYY-MM-DD`), `per_page?`, `page?`. `invoice`/`partner` are always
eager-loaded — no extra call needed for a detail panel. `remaining_amount`
(build the "Remboursé"/"En attente"/"Partiellement soldé" badge off this
directly, not `refund_processed_at` — see below), `consumed_amount`,
`imputed_at` all included alongside the existing `refund_*` fields.
→ `{ "success": true, "credit_notes": { "data": [{ "id": 12, "credit_note_number": "AVRORBI-A01-000004", "status": "APPROVED", "total_amount": "60.00", "refund_amount": "60.00", "remaining_amount": "40.00", "consumed_amount": "20.00", "refund_method": null, "refund_reference": null, "refund_processed_at": null, "imputed_at": "2026-08-31T10:00:00.000000Z", "reason": "...", "created_at": "...", "invoice": { "id": 38, "invoice_number": "INVORBI-A02-000004", "total_amount": "239.00", "status": "fully_paid" }, "partner": { "id": 1485, "code": "ORBIS-CLI-002", "name": "Superette Bennani" } }], ...pagination... } }`

**`GET /credit-notes/{creditNote}`** — same shape as one row above, for
deep-linking.

**`POST /credit-notes`** 🔁 (2026-09-02) — "avoir libre": a commercial
gesture with no originating order/invoice at all, unlike
`POST /invoices/{invoice}/credit-notes` above. Validated with the UI team
before building: reuses the exact same encours/numbering machinery an
invoice-linked avoir already gets (`ExposureCalculator` sums every
`APPROVED` `credit_notes` row by `partner_id` alone, no `invoice_id`/
`order_id` filter; `CreditNote::generateNumber()` draws from the same
branch-scoped `'AVR'` `TokenSerie` series) — auto-approved, same as every
other GCOM avoir (no derogation workflow anywhere in GCOM).
```json
{ "partner_id": 1485, "amount": 150.0, "reason": "Geste commercial" }
```
Requires the **`gcom-credit-note-free-standing`** permission (`422`
otherwise) — an invoice-linked avoir only needs `manage-gcom`, since it's
capped by the invoice's own total by construction; this one has no
natural ceiling. Amount is capped by the paramétrable
`gcom.max_free_standing_credit_note_amount` (`ParameterService`-resolved,
`Partner` → `User` → `AccessProfile` → `Role` → default **2000.0**,
same chain `gcom.max_discount_percent` uses) unless the actor holds
**`gcom-credit-note-free-standing-override-limit`**.
→ `201`, `{ "success": true, "message": "Free-standing credit note created", "credit_note": {...} }`

`credit_notes.order_id` is now nullable (was a hard `NOT NULL` FK) —
`invoice_id` was already nullable. `credit_note_type` is `'free_standing'`
for this path (`'return'`/`'financial'` for the invoice-linked ones).
`refund_amount` is `0`, not the full amount — see
`GcomCreditNoteService::createFreeStandingCreditNote()`'s docblock for why
(`ExposureCalculator`'s `total_amount - refund_amount` encours formula
would otherwise net to zero for a free-standing avoir, silently
contradicting the whole point of the feature — a real gap only the
feature's own test caught, not present in the original arbitrage with
the UI team). `remaining_amount` (what `redeem`/`imputeAvoirs()` actually
draw from) is unaffected — still the full amount.

Known gap: no PDF endpoint yet (the existing one is nested under
`/invoices/{invoice}/...`, which doesn't exist for a free-standing avoir)
— not requested in the original ask, flagged here for whenever it is.

**Real bug found and fixed (2026-09-02, reported by the UI team right
after creating one)**: a freshly-created free-standing avoir never
appeared in `GET /credit-notes` — `GcomCreditNoteController::all()`'s
"is this a GCOM credit note" scope was `whereHas('order', canal=GCOM)`,
and a free-standing avoir has no `order` at all, so it matched nowhere.
`show()`/`redeem()` had the identical guard shape
(`$creditNote->order?->canal !== 'GCOM'`) and 404'd for the same reason —
no test had exercised either endpoint against a free-standing avoir
before this was reported. Fixed by also matching
`credit_note_type = 'free_standing'` in all three places (factored into
a shared `isGcomCreditNote()` helper for `show()`/`redeem()`).
`redeemCreditNote()`'s own write (`TreasuryIntakeLine.order_id`) was
already nullable, so nothing else needed changing downstream.

**`POST /credit-notes/{creditNote}/redeem`** 🔁 (2026-08-31, now partial)
— resolves (part of) a credit note's outstanding `remaining_amount`
(money owed back to the partner because the original invoice was
already settled — see §9). Journals a negative/compensating
`TreasuryIntakeLine` against the credit note's own branch caisse for the
given method (same `cash→ESP, cheque→CHQ, effet→EFF, card|transfer→VIR`
mapping as every other GCOM settlement, §16), records a
`CreditNoteResolution` row, then stamps `refund_method`/
`refund_reference`/`refund_processed_at` — but only once
`remaining_amount` actually reaches `0`, whether via this one call or
the last of several partial ones.
```json
{ "method": "cash", "amount": 200.00, "reference": "CAISSE-2026-0001" }
```
`amount` optional — omitted redeems the full `remaining_amount`.
→ `200`, `{ "success": true, "message": "Credit note redeemed", "credit_note": {...} }`
→ `422` if not `APPROVED`, `remaining_amount` is already `0`, `amount`
exceeds `remaining_amount`, or `method` isn't one of
`cash`/`cheque`/`effet`/`card`/`transfer`.

### Avoir as a payment method (2026-08-31)

A partner's own APPROVED credit note(s) settle a **new** sale directly
— no Treasury/cash movement at all (`GcomSettlementClassifier`'s 4th
category, `NON_CASH_COMPENSATION`, skips both `GcomInstrumentRegistrar::
recordSettlement()` and the credit-limit check entirely — an avoir
spends already-approved money, not new exposure). See
`GcomCreditNoteService::imputeAvoirs()`'s docblock for the full design
rationale (and why this is deliberately NOT the same mechanism as POS's
`AvoirPaymentStrategy`).

`payment_method: "avoir"` is accepted wherever `payment_method` already
is (`POST /orders`, `POST /delivery-notes`/`convert-to-bl` — stored as a
hint only, GCOM's Golden Rule means BC/BL creation never settles
anything), but `avoir_allocations` itself is only accepted — and
required — at the 3 endpoints that actually settle a sale, same as
`instrument` for cheque/effet:

```json
POST /direct-invoices | /orders/{order}/convert-to-invoice | /delivery-notes/{id}/convert-to-invoice
{
  "avoir_allocations": [
    { "credit_note_id": 12, "amount": 200.00 },
    { "credit_note_id": 15, "amount": 100.00 }
  ]
}
```

Each allocated credit note must belong to the **same partner** as the
sale, be `APPROVED`, and have `remaining_amount >= amount` requested —
`422` otherwise. On success, each avoir's `remaining_amount` decrements
(and `consumed_amount` increments) by its allocated share, and one
`CreditNoteResolution` row is written per avoir consumed.

**Mixed avoir + another payment method** (2026-08-31, real case reported
live: an 18 MAD avoir against a 590 MAD BL, the rest paid cash —
originally scoped out, confirmed as a real need the same day). Two
shapes, both driven by whether `avoir_allocations` covers the full sale:

- `payment_method: "avoir"` — allocations must sum to **exactly** the
  sale total (`422` in either direction, under- or over-application).
  This value means "no remainder expected"; a shortfall here is a
  caller error, not an invitation to mix — set `payment_method` to the
  remainder's real method instead (below).
- `payment_method: "cash"|"card"|"cheque"|"effet"` **with**
  `avoir_allocations` covering only PART of the sale — the avoir
  settles that part, `payment_method` settles the rest (an `instrument`
  object is still required for cheque/effet, same as always). The
  Treasury outflow reflects **only the remainder**, never the full
  total — the avoir-covered portion never physically moved. Still
  `422` if `avoir_allocations` sums to MORE than the sale total.
  **Not yet supported**: `credit`/`transfer` as the remainder method —
  needs the credit-limit check to run against just the remainder, not
  the full total; real scope boundary, not an oversight — `422` if
  attempted.

Either way, the invoice ends up `fully_paid`/`remaining_amount: 0`
exactly like a cash sale from the caller's point of view.

### `payment_method` override at convert-to-invoice (2026-08-31, generalized 2026-09-01)

Originally shipped narrowly (real case reported live within hours of
mixed-tender avoir support): a BC/BL created with `payment_method:
"avoir"` as the stated intent, but the partner's only available avoir
turns out too small — no way to switch to a real remainder method
except cancelling and recreating the document, losing the delivery
trail. Generalized 2026-09-01 after the UI team reported two related
gaps: no way to invoice a document "espèces différé" (client can't pay
on the spot at invoicing time, needs a pending/no-movement invoice
settled the next day), and sending a different `payment_method` than
the document's stored one silently returned the pre-existing invoice
unchanged once the document was already invoiced (read as "the backend
responds 200 but ignores the override").

`POST /orders/{order}/convert-to-invoice` and
`POST /delivery-notes/{id}/convert-to-invoice` accept an optional
`payment_method` in the body — now **any** real settlement method
(`cash`/`card`/`cheque`/`effet`/`credit`/`transfer`), regardless of
what the document was originally created with. `avoir` is not a valid
target here — becoming avoir-settled is the `avoir_allocations`
mechanism above, a different amount-bearing payload, not a bare method
swap:
```json
{ "payment_method": "credit", "payment_term_id": 4 }
```
`payment_term_id` (optional) — explicit échéancier when overriding to
`credit`/`transfer` and the partner has no default payment term
configured (common for an otherwise cash-only partner, the exact
"espèces différé" case); falls back to the partner's default when
omitted, `422` with a clear message if neither exists.

Mirrors `convert-to-bl`'s own override (`applyPaymentMethodChange()`)
exactly: stamp duty recomputed (cash only, by law), the same real
credit-limit check (`GcomSettlementClassifier::assertCreditOk()`) a
genuine credit sale gets when switching to a non-immediate method, and
`payment_term_id` re-resolved whenever credit-sale-ness flips. For the
BL endpoint, this also updates the BL's own `total_amount` —
`generateFromDeliveryNote()` reads that stored snapshot (taken at BL
creation), never the order's live total, so the recalculated amount
would otherwise never reach the invoice.

**Fixed 2026-09-03** (Team UI report — a genuinely wrong invoice total,
not just a display bug): the line-total recompute this override does
used to always sum `order.orderProducts` — the BC's ORIGINAL snapshot —
even for the BL endpoint. A BL's items can have since diverged from that
snapshot via the BL line-editing feature (§ "BL editing" above —
add/update/remove line, global discount — none of which ever touches
`order_products`, only `delivery_note_items`). Converting such an edited
BL to invoice **with** a `payment_method` override silently discarded
the edit: the stale order-level total got written to `bl.total_amount`
right before `generateFromDeliveryNote()` copied that same wrong value
onto the freshly-created invoice's own `total_amount`/`subtotal`/
`remaining_amount` — a real financial document born with the wrong
amount, not merely a stale read. Fixed to sum the BL's own current items
when one is given (same formula `GcomDeliveryNoteService::
recomputeBlAndOrderTotals()` already uses for the BL's own totals);
`convert-to-invoice` on a BC with no BL (flow #3) is unaffected — there's
no BL to have diverged from, so `order.orderProducts` stays correct
there.

**"Espèces différé" — the driving real case**: a BL created
`payment_method: "cash"` whose client can't pay on the spot when it's
time to invoice. Override to `credit` at convert-to-invoice produces
the same `pending`/`paid_amount: 0`/no-Treasury-movement invoice a
genuine credit sale gets (`settleWithAvoirSupport()` skips
`recordSettlement()` entirely for a credit sale) — settled the next
day through the normal deferred règlement screen (`POST /payments`,
below), no different from any other credit sale's règlement.

**Rejected once already invoiced** (2026-09-01, closes the silent-ignore
gap): if the document already has an invoice (a second call, e.g. a UI
retry or double-click), passing `payment_method` now gets a `422`
("payment_method can only be overridden before the first successful
conversion") instead of silently returning the existing invoice with
its original method. Omitting `payment_method` on a repeat call still
returns the existing invoice as before — only the override itself is
rejected.

`422` also on: an invalid override target (validation layer —
`cheque`/`effet`/`credit`/`transfer`/`cash`/`card` only, `avoir`
excluded), missing `instrument` details when overriding to
`cheque`/`effet`, the credit-limit check failing when overriding to
`credit`/`transfer`, no resolvable payment term for the same, and
(unchanged) not supported at all yet for a `1_FAC_PER_ORDER` partner
(§11).

### Payments (Règlement & Lettrage)

**`GET /payments`** — **channel-agnostic**: every payment for the given
partner, not just GCOM-originated ones (règlement has no `canal` concept
anywhere in this codebase). `partner_id` is **required** — there is no
global cross-partner feed on this endpoint. Query: `partner_id` (required),
`status?`, `per_page?`.

**`POST /payments`** 🔁 — register a règlement and letter it against open
invoices, in one call (no separate ADV-approval step — validated
immediately).
```json
{
  "partner_id": 12,
  "amount": 1250.00,
  "payment_term_id": 5,
  "payment_method_id": 2,
  "reference": "VIR-2026-0042",
  "bank_id": 3,
  "maturity_date": null,
  "notes": "Virement reçu",
  "instrument": null,
  "allocations": [{ "invoice_id": 88, "amount": 1250.00, "notes": "" }],
  "auto_letter": true
}
```
- `payment_method_id` (optional, 2026-08-17) — pick it from `GET
  /api/backend/masterdata/payment-methods`. If omitted, it falls back
  through the resolution chain documented just below. **This is the field
  the "Nouveau Règlement" screen's method dropdown should actually submit
  — not `payment_term_id`.**
- `payment_term_id` (**optional since 2026-09-05** — was required before
  that; see the dedicated note further below) — a règlement is an
  encashment that can cover several open invoices with different credit
  terms, so forcing one term onto the payment itself never matched the
  business reality. Still accepted when the caller wants to log which
  term this règlement was collected against, just never required.
- `instrument` (required when `payment_method_id` resolves to
  cheque/effet, same shape as everywhere else in GCOM: `{
  reference_number, due_date, bank_name?, bank_account? }`) — a cheque/
  effet received at règlement time, weeks after the original sale, now
  gets the same bank-clearing lifecycle tracking (`financial_instruments`,
  `PENDING → DEPOSITED → CLEARED/REJECTED`) as one handed over at the
  counter. Linked via `financial_instruments.payment_transfer_id`, not
  `invoice_id` — a single règlement can letter across several invoices, so
  there's no one invoice to anchor it to. `422` if `payment_method_id`
  resolves to cheque/effet and `instrument` is missing.
- `allocations` present → letters exactly those invoices for exactly
  those amounts (explicit lettrage).
- `allocations` omitted **and** `auto_letter` true (the default) → letters
  the partner's oldest open invoices first, automatically, up to `amount`.
- Omit both `allocations` and set `auto_letter: false` to register the
  payment without lettering it yet (a partner-level credit balance to
  letter manually later).

→ `201`, `{ "success": true, "message": "Payment registered and lettered", "payment": {...}, "lettering": { ... LetteringService::getPaymentLetteringSummary() shape ... } }`

**`bank_id` is required** whenever the *resolved* `payment_method_id`
has `payment_methods.requires_bank = true` (`PaymentTransferService::
registerPayment()`'s own guard) — populate the picker from `GET
/api/backend/masterdata/banks` (outside GCOM's own routes, same "no
duplicate master-data endpoints" rule as partners/products — real gap
found 2026-08-16, `Bank` the model already existed but no listing
endpoint anywhere did). → `{ "success": true, "data": [{ "id": 3, "code": "...", "name": "Attijariwafa Bank", "swift_code": "...", "is_active": true }] }`

**Fixed 2026-09-05** (Team UI question: why require `payment_term_id` at
all on a règlement?): this check used to read
`$paymentTerm->is_bank_transfer`/`is_cash` — the wrong, indirect source,
and one that silently skipped the check entirely for a payment with no
term at all. `payment_methods.requires_bank` is the real, purpose-built
column for this exact decision (seeded correctly: `CASH`/`CARD`/
`MOBILE` = `false`, `CHEQUE`/`EFFET`/`VIREMENT` = `true` —
`database/sql/26_payment_domain_v2_seed.sql`), reads off the
already-resolved payment method, and needs no `payment_term_id` to work
— which is what made `payment_term_id` safe to make optional in the
first place. Also more correct than the old check for an explicit
`payment_method_id` override that disagrees with the term's own stored
method (e.g. a cash term, but this one instance is explicitly settled by
transfer) — the old term-only check would have missed that case even
before `payment_term_id` became optional.

**How `payment_method_id` is resolved** (real bug fixed 2026-08-16: every
payment term genuinely attached to a real partner failed with either
`"Bank is required for this payment method"` or `"Unable to resolve a
payment method for this payment term."` depending on whether `bank_id`
happened to be sent — both messages, same root cause). You never send
`payment_method_id` yourself in normal use; `PaymentTransferService::
registerPayment()` resolves it in this order:
1. An explicit `payment_method_id` in the request, if you send one.
2. The payment term's own `payment_method_id`, if it has one configured.
3. If the term is a cash term (`is_cash=true`) — automatically resolved to
   the system's cash `PaymentMethod`, deterministically, before step 4 (so
   a partner's generic default can never override an explicitly-cash
   règlement).
4. The partner's `partner_financial_profiles.default_payment_method_id`
   — the intended source of truth for credit-type terms per
   `database/sql/04_partenaires_commerciaux.sql`'s own documented
   architecture (payment_terms carry only timing logic; the settlement
   method is a per-partner fact).

`422 "Unable to resolve a payment method for this payment term."` now
means exactly one thing: none of the four sources above resolved anything
for this partner+term — check the partner's financial profile has a
`default_payment_method_id` set (`GET`/`PUT
/api/backend/partners/{id}/balances` or the equivalent admin screen; no
GCOM-specific endpoint for this, it's partner master data). This no
longer gets masked by the bank-requirement check — that's checked
strictly after method resolution now, so it never produces a second,
different-looking error for the same missing configuration.

**`GET /partners/{partner}/open-invoices`** — convenience lookup for
building a "which invoices does this règlement cover" picker.
→ `{ "success": true, "invoices": [{ "id": 88, "invoice_number": "INV-...", "invoice_date": "...", "due_date": "...", "total_amount": "...", "paid_amount": "...", "remaining_amount": "...", "status": "pending" }] }`

**`GET /payments/{payment}/pdf`** 🔁 (2026-08-23, Team UI request) — reçu
d'encaissement / quittance de paiement. Same `DocumentService` pipeline
every other GCOM document uses (`?download=true` for attachment instead
of inline; see `DocumentDataResolver::resolvePaymentReceipt()`). Not
gated on any GCOM-canal check (unlike `/invoices/{invoice}/pdf`) —
`PaymentTransferService`/`LetteringService` are deliberately
channel-agnostic (§7 above), so a payment has no channel marker to check
against in the first place.

Content: partner identity (name/code/ICE), branch + the caissier
(`received_by`), the amount both numerically and spelled out in French
words (`Support\AmountInWordsService` — hand-rolled; `NumberFormatter::
SPELLOUT` was tried first but silently falls back to English on this
environment's ICU data), payment method + — for chèque/effet — the
linked `FinancialInstrument`'s reference/bank/échéance when one was
registered (`GcomInstrumentRegistrar`), falling back to the payment's
own `bank_id`/`reference`/`maturity_date` otherwise. The imputation
table lists every invoice this payment was lettered against (`N°
Facture`, date, `total_amount` TTC, amount imputed on this payment,
and that invoice's **current** `remaining_amount` — reflecting this and
any other lettering already applied, not a snapshot frozen at print
time). The closing "nouveau solde dû" line reuses `GcomPartnerLedgerBuilder`
— the exact same source `/partners/{partner}/statement` and `/ledger`
already serve — so the receipt can never show a different balance than
the rest of the UI for the same partner.

Each `Lettering` row only carries `order_id` (not `invoice_id` — a
pre-existing gap noted on `LetteringService::getPaymentLetteringSummary()`),
so the invoice per line is resolved the same way `LetteringService::
unletter()` already does: `Invoice::where('order_id', ...)`.

### Per-partner financial views — see §6 for the full design rationale

**`GET /partners/{partner}/financial-instruments`** — Query: `status?`,
`instrument_type?`, `per_page?`.
→ `{ "success": true, "financial_instruments": { "data": [{ "id": 1, "instrument_type": "CHEQUE", "reference_number": "CHQ-0001", "amount": "300.00", "status": "PENDING", "due_date": "2026-10-12", "bank_name": "...", ... }], ...pagination... } }`

**`GET /partners/statements`** (2026-08-31) — company-wide list, same row
shape as `/statement` below, one row per partner. Query: `branch_id?`,
`channel?`, `min_balance?`, `include_zero_balance?` (default `false`),
`per_page?`, `page?`. Sorted `current_balance` desc.
→ `{ "success": true, "statements": { "data": [{ "partner_id": 1, "partner_name": "...", "partner_code": "...", "total_debit": 15000.00, "total_credit": 10797.20, "current_balance": 4202.80, "pending_instruments_total": 5359.20, "credit_limit": 50000.00, "available_credit": 40438.00 }], ...pagination... } }`

**`GET /partners/{partner}/statement`**
→ `{ "success": true, "statement": { "partner_id": 1, "total_debit": 15000.00, "total_credit": 10797.20, "current_balance": 4202.80, "pending_instruments_total": 5359.20, "credit_limit": 50000.00, "available_credit": 40438.00 } }`

**`GET /partners/{partner}/ledger`** — Query: `from?`, `to?` (`YYYY-MM-DD`).
→ `{ "success": true, "partner_id": 1, "ledger": [{ "type": "invoice", "date": "2026-08-01", "reference": "INV-2026-00042", "debit": 1500.00, "credit": 0, "running_balance": 1500.00, "invoice_id": 88 }, { "type": "payment", "date": "2026-08-10", "reference": "PAY-2026-000004", "debit": 0, "credit": 1500.00, "running_balance": 0, "payment_transfer_id": 4 }, { "type": "credit_note", "date": "2026-08-12", "reference": "AV-2026-00003", "debit": 0, "credit": 200.00, "running_balance": -200.00, "credit_note_id": 3 }] }`

**`GET /partners/{partner}/ledger/pdf`** — "Relevé de Compte" export,
built 2026-08-24. Query: `from?`, `to?` (same `YYYY-MM-DD` filters as
the JSON endpoint above, applied identically since both read through
the same `GcomPartnerLedgerBuilder` — the PDF can never disagree with
what the JSON ledger shows on screen), `download?` (`1`/`true` for
`Content-Disposition: attachment`, omitted/`0` for `inline`). Reuses
the shared `DocumentService`/`DocumentDataResolver`/
`documents._layout` pipeline (same one as BC/BL/Devis/Facture/Avoir),
so it carries the same letterhead/legal footer and is generated the
same way — `response()` with `Content-Type: application/pdf`, no JSON
envelope. Cached per `partner_id` + date range (a `from`/`to`
combination folds into the cache path, since — unlike `price_mode` or
`watermark` — a statement's content genuinely changes with the date
range; two different ranges never share a cached PDF).

### Financial Instruments — Portefeuille (company-wide list + batch deposit)

Built 2026-08-24, requested by the UI team: the per-partner listing
below (§ next) turned out to be unusable for a comptable preparing one
bank deposit slip spanning many clients — no way to see, or deposit,
more than one client's cheques at a time.

**Real architectural fact both endpoints rely on**: `financial_instruments`
has **neither `company_id` nor `branch_id`** as a column. Company scope
is 100% reliable — every row has a `partner_id`, and every partner has a
`company_id`, so scoping is `partner_id → partners.company_id`. Branch
scope is **best-effort by design**: only resolvable for an at-sale
instrument (`invoice_id → invoices.order_id → orders.branch_id`). A
deferred règlement's instrument has no `invoice_id` at all — it will
never match a `branch_id` filter, not because of a bug, but because the
branch was never stored anywhere on that settlement path in the first
place (`GcomInstrumentRegistrar::recordDeferredSettlement()`, §16).

**`GET /financial-instruments`** — every instrument across every
partner of the acting user's company (fits §14 as a company-wide
**Liste**, distinct from the per-partner one below). Filters: `status`,
`instrument_type`, `bank_id`, `due_date_from`, `due_date_to`, `branch_id`
(best-effort, see above), `per_page`.
```json
{ "success": true, "financial_instruments": { "data": [{ "id": 12, "instrument_type": "CHEQUE", "reference_number": "CHQ-0001", "amount": "300.00", "status": "PENDING", "due_date": "2026-09-15", "bank_id": 3, "bank_deposit_id": null, "partner": { "id": 7, "name": "...", "code": "..." } }], "total": 1, "...": "pagination" } }
```
`bank_deposit_id` (2026-08-31) — `null` until deposited, then the id
`GET .../bank-deposits/{id}/pdf` below prints — present here with zero
extra calls, so an "Imprimer Bordereau" row action needs nothing beyond
this list.

**`POST /financial-instruments/batch-deposit`** 🔁 — the "remise en
banque groupée" action.
```json
{ "instrument_ids": [12, 15, 18, 22], "deposit_date": "2026-08-24", "deposit_reference": "BORD-2026-0042" }
```
One `deposit_date`/`deposit_reference` applied to every listed
instrument — a single bordereau for the whole batch, as requested.
**Best-effort, not all-or-nothing** (same shape as §16's
`closeAllForBranch()`): an instrument that isn't `PENDING` (already
deposited, already rejected) doesn't block the others — it lands in
`errors` instead of failing the whole request. An id belonging to
another company is treated as **not found** and reported the same way
in `errors`, never silently processed across the tenant boundary.
```json
{ "success": true, "message": "Deposited 3 of 4 instrument(s).",
  "data": { "deposited": [ /* updated instruments */ ], "errors": [ { "id": 18, "message": "Invalid transition: cannot move from CLEARED to DEPOSITED..." } ], "bank_deposit_id": 7 } }
```
Always `200` — read `data.deposited`/`data.errors`, not the HTTP status,
to know what actually happened (a request with malformed input, e.g. no
`instrument_ids` at all, still returns `422` as usual). `data.bank_deposit_id`
(2026-08-31) is what `GET .../bank-deposits/{id}/pdf` below prints — one
real `BankDeposit` row created per call, shared by every instrument in
that batch (not one per instrument).

**`GET /financial-instruments/bank-deposits/{bankDeposit}/pdf`** —
"Bordereau de remise en banque" (2026-08-31, real gap reported by the
UI team: no printable deposit slip existed, and no entity to print one
FROM either). Same generic `DocumentService` pipeline as every other
GCOM PDF. `?download=1` for an attachment. Available for **any**
`DEPOSITED` instrument's bordereau — a single `deposit()` call (below)
creates its own `BankDeposit` too (a batch of size 1), so this isn't
limited to instruments that went through `batch-deposit`. `404` if the
deposit doesn't belong to the acting user's company.

Deliberately **id-based**, not looked up by the free-text
`deposit_reference` a caller may type — every other GCOM PDF route
(`BC`/`BL`/`Facture`/`Devis`/bon de retour/avoir) is id-based too, and
`deposit_reference` has no uniqueness constraint (two accidentally-
identical references would otherwise silently merge two real deposits
on one printed slip). `BankDeposit` is a real row purely so this
document has something honest to key off of — see its own model
docblock.

**Screen shape** (§14 convention): a dedicated **Liste** (not folded
into a single caisse's `Détail`, since this view spans partners by
design — "qu'est-ce que j'ai à déposer" is a different question from
"d'où vient l'argent de cette caisse") with a checkbox column, filter
tabs on `status`, filter row for `instrument_type`/`bank_id`/due-date
range. Selecting rows + one **Formulaire** (`Date de dépôt` + `N°
bordereau`) submits the whole selection to `batch-deposit` in one call.
Show the `deposited`/`errors` split directly in the result, not just a
single success toast.

### Financial Instruments — Bank-Clearing Lifecycle

Built 2026-08-19 for the "Chèques & Effets" screen. Thin GCOM wrappers
around `App\Domains\Payment\Treasury\Services\FinancialInstrumentService`
— a pre-existing state machine that was never wired to any HTTP route
before this. State machine: `PENDING → DEPOSITED → CLEARED|REJECTED`,
`REJECTED → PENDING` (redeposit, built 2026-08-21, see below). Every
`FinancialInstrument` a GCOM flow creates starts `PENDING` — see
`register()`/`registerForPaymentTransfer()` above and in §6.

Fits the §14 convention as **Actions** on the existing "Chèques &
Effets" tab (already built, a `Liste` of instruments filtered by
`status`/`instrument_type` inside a partner's `Détail`) — each row's
available action button follows directly from its current `status`:
`deposit` when `PENDING`, `clear`/`reject` when `DEPOSITED`, `redeposit`
when `REJECTED`. No separate screen needed for any of these four.

**`POST /financial-instruments/{financialInstrument}/deposit`** 🔁
```json
{ "deposit_date": "2026-08-15", "deposit_reference": "BORD-2026-001" }
```
`PENDING → DEPOSITED`. Both fields optional: `deposit_date` defaults to
today, `deposit_reference` (N° bordereau) is free text. Creates its own
`BankDeposit` (2026-08-31 — a batch of size 1), so the response's
`financial_instrument.bank_deposit_id` is immediately printable via
`GET .../bank-deposits/{id}/pdf` above, same as a batch-deposited one.

**`POST /financial-instruments/{financialInstrument}/clear`** 🔁 — no
body. `DEPOSITED → CLEARED` (bank reconciliation confirmed, removes the
instrument from `getExposureForPartner()`'s pending totals).

**`POST /financial-instruments/{financialInstrument}/reject`** 🔁
```json
{ "reason": "Provision insuffisante" }
```
`DEPOSITED → REJECTED` (impayé). `reason` required. The instrument stays
in exposure as a risk indicator (it does not vanish from the partner's
pending totals the way `clear()` does).

**`POST /financial-instruments/{financialInstrument}/redeposit`** 🔁 —
no body. `REJECTED → PENDING` (built 2026-08-21, completes the state
machine's HTTP surface). Resets `rejection_reason`/`rejected_at`/
`deposited_at` to null. Does **not** re-close any invoice or re-credit
any branch caisse — those were fully reversed on the original reject
(below); if the retry actually clears, represent that with a fresh
`deposit()`/`clear()` call, there's no automatic replay.

All four return `{ "success": true, "message": "...", "financial_instrument": {...} }`
(same shape as `GET /partners/{partner}/financial-instruments`'s rows).
An invalid transition (e.g. `clear` on a still-`PENDING` instrument)
returns `422 { "success": false, "message": "Invalid transition: cannot move from PENDING to CLEARED. Allowed: DEPOSITED, CANCELLED" }`
instead of a 500.

**Rejecting an instrument reopens the debt** (built 2026-08-20, see §11) —
`reject()`'s `422`/success response is unchanged, but as a side effect
(`InstrumentRejected` → `ReverseSettlementOnInstrumentRejected` listener,
synchronous, same DB transaction as the status flip) every invoice that
instrument's settlement touched goes back to open: `paid_amount` reverses,
`remaining_amount` reopens, `status` recalculates (`pending` or `overdue`
depending on the term — never stays `fully_paid`). The amount is also
pulled back out of whichever caisse it landed in — the acting user's own
`TYPE_USER_CAISSE` as of 2026-08-20+ (§16), previously the shared branch
caisse — via a compensating negative `treasury_intake_lines` row (never
mutates the original — append-only) — since 2026-08-21 this applies
uniformly to **both** an at-sale cheque and a deferred règlement's cheque
(§16's "Deferred règlement"), not just the former.
No new fields on the reject response for the UI to read — this is
entirely a backend consistency fix, poll `GET /invoices/{invoice}` again
if the screen needs to reflect the reopened state immediately.

### Common request shapes

```json
// items — used by /quotes, /orders, /delivery-notes, /direct-invoices
[{ "product_id": 42, "quantity": 3 }]

// payment_method — every endpoint that produces/converts to an invoice
"cash" | "card" | "credit" | "cheque" | "effet" | "transfer"

// instrument — required when payment_method is cheque or effet
{
  "reference_number": "CHQ-0001",
  "due_date": "2026-10-12",
  "bank_name": "Attijariwafa Bank",     // optional
  "bank_account": "011780000012345678"  // optional
}
```

### Parameter registry

**`GET /api/backend/gcom/parameters?module=GCOM`** (2026-09-02, full path
spelled out here — every other heading in this §8 is relative to
`/api/backend/gcom/` per the section's own convention, which reads fine
in context but 404s if copy-pasted as `/parameters` on its own, as
reported by the UI team) — queryable registry for
GCOM's own thresholds, the counterpart to SFA's own
`config/data/sfa_parameter_definitions.php` (~140 keys) which this
endpoint does NOT expose (GCOM-only today; `module` is validated against
`['GCOM']`, accepted rather than hardcoded so wiring SFA in here later
isn't a breaking shape change). Before this, `gcom.max_discount_percent`/
`gcom.max_free_standing_credit_note_amount` existed purely as string
literals + hardcoded fallback constants inside
`GcomDiscountAuthorizationService`/`GcomCreditNoteService` — no endpoint
anywhere could enumerate them.
```json
{
  "success": true,
  "module": "GCOM",
  "parameters": [
    {
      "key": "gcom.max_discount_percent",
      "type": "decimal",
      "default": 10.0,
      "current_value": 10.0,
      "description": "Remise max (%) sur une ligne ou une remise globale sans la permission gcom-discount-override-limit."
    },
    {
      "key": "gcom.max_free_standing_credit_note_amount",
      "type": "decimal",
      "default": 2000.0,
      "current_value": 2000.0,
      "description": "..."
    }
  ]
}
```
`current_value` is resolved for the ACTING user (`ParameterService::get()`'s
normal Partner → User → AccessProfile → Role → default chain, no
`$partner` passed — this is the actor's own effective default, not a
specific partner's override).

**Writing a value (2026-09-02, fast-follow — fixed)**: goes through the
existing generic `configuration_settings` admin API
(`ConfigurationSettingAdminController`, full path
`/api/backend/access-control/configuration-settings` — a *different* base
prefix than every other endpoint in this §8, not a GCOM-specific write
endpoint), same as every other configurable key. Body:
`{ "configurable_type": "Spatie\\Permission\\Models\\Role", "configurable_id": 5, "key": "gcom.max_discount_percent", "value": 12 }`
(`POST` to create/upsert, `PUT /{id}` to update an existing row —
`configurable_type` accepts `Role`/`User`/`Partner`/`AccessProfile`/`Branch`,
see `allowedConfigurableTypes()`). Bulk variants exist too:
`POST .../roles/{role}/configuration-settings/bulk` (and `users/`,
`partners/`) with `{ "settings": [{ "key": ..., "value": ... }, ...] }`.
Getting there took two fixes, not one:
1. That controller's `store()`/`update()`/`bulkUpsert*()` validated
   `'key' => 'exists:sfa_params,key'` — rejects every `gcom.*` key
   outright (config-file-only, never rows in `sfa_params`). Replaced with
   `resolveParamValueType()`/`validParamKeyRule()`, checking both
   `sfa_params` and `ParameterService::gcomDefinitions()`.
2. That alone wasn't enough — `configuration_settings.key` has a hard
   Postgres FK to `sfa_params.key` (`cascadeOnUpdate`/`restrictOnDelete`),
   so the INSERT was rejected at the DB level before the app code above
   ever ran. Dropping the FK was considered and rejected: `SettingsService`/
   `AppSetting`/`GeneraleSettingController` all write to
   `configuration_settings` directly with no key validation of their own —
   the FK is their only typo safety net. Fixed instead by registering
   GCOM's keys as real `sfa_params` rows (migration
   `2026_09_02_100000_register_gcom_parameters_in_sfa_params_for_fk`,
   `description` prefixed `"GCOM: "` so they don't read as SFA settings on
   a raw `sfa_params` browse) — same `updateOrInsert` pattern the FK's own
   creating migration already used for its "orphan key" backfill step.

### Response & error envelope

Every mutating endpoint returns `{ "success": bool, "message"?: string }`
plus the created/updated resource under a named key (`invoice`, `order`,
`delivery_note`, `quote`, `credit_note`, `payment` — never a generic
`data`). Validation and domain errors return `422` with
`{ "success": false, "message": "..." }` — credit-limit rejections
included, message format `"Credit check failed: {reason}"`. See §14 for
the full status-code table and how to distinguish error types.

---

## 9. Cancellation & Avoir (Credit Notes)

Two separate mechanisms, deliberately not unified into one "undo" concept —
they cover different points in the document lifecycle:

**Cancellation (`GcomOrderService::cancelOrder()` /
`GcomDeliveryNoteService::cancelDeliveryNote()`)** — for documents that
haven't reached an invoice yet:

- A BC can only be cancelled while it has no BL and no invoice.
- A BL can only be cancelled while it has no invoice; cancelling restocks
  immediately via `StockService::restockForReturn()` (new, generic — the
  restock counterpart to `deductForDirectSale()`, idempotent per
  `referenceType+referenceId+product` since multiple returns can happen
  against the same order over time).
- Neither is built on the existing `CancellationService`
  (`cancelBonCommande()`/`cancelDeliveryNote()`): that service requires
  draft/pending statuses and a magasinier-approval-gated decharge before
  releasing stock — incompatible with GCOM's immediate-confirm,
  no-approval-workflow design (see §10 bug list — this was actually
  verified by reading the code, not assumed).

**Partial line cancellation (`GcomOrderService::cancelOrderLine()`)** —
same "before any BL/invoice" guard as the whole-BC cancel, but operates on
one `OrderProduct` line: a smaller `quantity` reduces the line and
recomputes the order's totals (sub_total/total_amount/payable_amount/
stamp_duty) from the remaining lines, never by decrementing the old
totals (avoids rounding drift across repeated partial cancellations,
mirroring `GcomOrderBuilder::build()`'s own "never trust a header total,
only sum(lines)" rule). Omitting `quantity` (or passing ≥ the line's own
quantity) removes the line entirely; removing the last line cancels the
whole BC. There is no equivalent for BL/invoice lines — once a BL exists,
cancel the whole BL (restocks everything); once invoiced, use an avoir
(§ below).

**Line quantity update (`GcomOrderService::updateOrderLine()`)** — the
missing "increase" counterpart to partial cancellation above: sets a BC
line's quantity to any new value, in either direction, before any
BL/invoice exists. Unlike `cancelOrderLine()`, price is **re-resolved**
via `GcomPricingCalculator` for the new quantity rather than linearly
rescaled from the old line total — picks up a price-list change since BC
creation the same way a fresh order would. Order totals are recomputed the
same "sum(lines), never decrement" way. For a credit-sale BC, the credit
limit (normally checked once, at BC creation — see §3) is re-checked only
when the new total is higher than before, since a reduction can't violate
a limit that already passed at the higher amount. Stock is never touched
either way — a plain BC never does (§3), so there's nothing to reconcile
until the BC is converted to a BL/invoice, at which point stock reacts to
whatever quantities are on the order at that moment.

**Adding a new line (`GcomOrderService::addOrderLine()`)** — completes the
trio: a partner adds a product they didn't originally order, still before
any BL/invoice. Same guard, same fresh-pricing approach as
`updateOrderLine()`. A `product_id` already on the order is rejected
rather than merged — ambiguous otherwise (merge quantities? re-price as
one combined line?), and `updateOrderLine()` already owns "change an
existing line's quantity" unambiguously. Unlike `updateOrderLine()`,
adding a line can only ever grow the total, so a credit-sale BC's limit
is unconditionally re-checked rather than only on growth.

**Why none of the three (cancel/update/add) exist for an already-invoiced
BC/BL** — this is where GCOM's "no cancelling once an invoice exists" rule
(see Known Gaps, §11) applies just as much to line-level edits as to the
whole document: an issued invoice is a fiscal snapshot, not a draft.
Needing to add an item after invoicing means creating a **new** BC/Facture
for that item, not reopening the old one — see §11 for the worked example
of why, and what to do instead.

**Avoir (`GcomCreditNoteService::createCreditNote()`, new)** — for
documents that already have an invoice. This is the first mechanism
anywhere in the codebase that makes a `CreditNote` actually reduce
`Invoice.remaining_amount`: the pre-existing `CreditNoteService`
(POS/exchange-flavored) only offset **new** orders at checkout and fed
`ExposureCalculator` as a risk input — it never touched an existing
invoice's debt.

- Validates the credited `amount` against the invoice's **`total_amount`**,
  not `remaining_amount`. A `remaining_amount` ceiling would make it
  impossible to credit an already-fully-paid cash-sale invoice — the single
  most common real "return after a till sale" scenario — since
  `remaining_amount` is already `0` at creation for cash/card sales.
- The credited amount splits into `appliedToDebt = min(amount, remaining)`
  (reduces `Invoice.remaining_amount`, flips status to
  `fully_paid`/`partially_paid`) and `refundAmount = amount - appliedToDebt`
  (stored on `CreditNote.refund_amount` — money owed back to the partner,
  not a debt reduction).
- `items` present → also restocks via `StockService::restockForReturn()`
  and marks each `CreditNoteItem.is_restocked = true`.
- `items` omitted → pure financial correction (commercial gesture, billing
  error), no stock movement.
- No separate "cancel invoice" endpoint — a full-amount avoir (omit
  `amount`) **is** how a GCOM invoice gets cancelled after the fact,
  matching real accounting practice (a validated invoice is credited, never
  deleted).
- **Resolving a non-zero `refund_amount`** (2026-08-31, real gap
  reported by the UI team — previously there was no action possible
  against it at all). `remaining_amount` (new column) is the single
  authoritative, mutable balance — backfilled from `refund_amount`, NOT
  `total_amount`: the `appliedToDebt` portion above already reduced
  *this* invoice at creation, so treating the full `total_amount` as
  available again would let a partner benefit twice from the same
  return. Two ways to resolve it, both decrementing the same
  `remaining_amount` so they can never double-spend it:
  - `POST /credit-notes/{id}/redeem` (§8) — cash/cheque/effet/transfer/
    card, now partial (`amount?`, omitted = full remaining), journals a
    compensating outflow in Treasury.
  - `payment_method: "avoir"` (§8/§9's "Avoir as a payment method"
    section) — applies the balance toward a brand-new sale instead, no
    Treasury movement at all.

  `refund_processed_at` means "`remaining_amount` reached zero" (set by
  whichever event actually zeroes it), not "a first redemption
  happened" — `refund_method`/`refund_reference` reflect only that last
  event; `credit_note_resolutions` (new table) is the full per-event
  history. Applying the balance to a **different, already-invoiced**
  sale (rather than funding a new one) is still not built — see the
  backlog note at the end of this doc.
- Auto-approved immediately (`CreditNoteStatus::APPROVED`) — GCOM has no
  derogation/approval workflow anywhere else either.

### 9bis. Returns architecture — 3 use cases, condition routing (2026-08-18)

Agreed and built with the UI team as a single coherent design across BC/BL/avoir:

**CAS 1 — return before invoicing (no avoir needed).** A BL is created,
the client refuses/returns part of it before the BL is ever converted.
`GcomDeliveryNoteService::reduceLineQuantity()` — see §8
(`POST /delivery-notes/{deliveryNote}/lines/{item}/return`) — reduces the
line's own quantity, restocks the returned amount immediately
(condition-aware, below), and recomputes the BL's `total_amount`.
`convertToInvoice()`/`InvoiceService::generateFromDeliveryNote()` already
read live `DeliveryNoteItem` quantities, not a snapshot taken at BL
creation — so a later conversion bills exactly the net quantity with
**zero changes needed on the invoicing side**.

**100% single-line return (2026-08-31)** — real gap reported by the UI
team: a client refusing 100% of one damaged product on a multi-line BL
had no correct path — `reduceLineQuantity()` originally required the
returned quantity to be strictly less than the line's current quantity,
forcing the whole-BL `cancel` (which would have wrongly restocked and
cancelled every *other* line too). The boundary is now `quantity <=
currentQty` (was `<`) — a line can zero out while the rest of the BL
stays untouched, through the exact same mechanism (restock, audit row,
`total_amount` recompute).

This surfaced a real latent bug in `InvoiceService::
createInvoiceItemsFromBlItems()`, fixed alongside it: a "defensive"
fallback there treated ANY zero/missing BL item quantity as missing
data and silently substituted the full ORIGINAL ORDER quantity — so a
zeroed-out line would have been invoiced at its pre-return quantity,
re-billing the client for stock they'd already returned. Now only a
genuinely-`null` quantity falls back; an explicit `0` is trusted and
produces no invoice line at all (the method used to always call
`InvoiceItem::create()` regardless of quantity — a second, narrower bug
in the same method, fixed in the same pass — quantity is now checked
*before* that call, not just for tax computation).

A zeroed line is **not** removed from the BL — it stays in `GET
/delivery-notes/{id}`'s `items[]` at quantity `0` (build a "Retourné
intégralement" UI state off that). The BL itself is never auto-cancelled
even if every line reaches zero — deliberately out of scope, since it
doesn't happen in the reported scenario (2 of 3 lines stay real);
`convertToInvoice()` on such a BL would simply produce a zero-amount
invoice. A dedicated "remove line" endpoint was considered and rejected:
`delivery_note_returns.delivery_note_item_id` is `ON DELETE CASCADE`, so
hard-deleting the `DeliveryNoteItem` row to implement it would have
silently destroyed any earlier partial-return history already recorded
against that same line.

**Persistence + printable bon de retour (2026-08-18)** — real gap
reported by the UI team: `reason`/`condition` reached `StockService::
restockForReturn()` from the start, but only ended up baked into
`StockMovement.notes` as freeform text — unreachable from any GET, and
unable to represent more than one return event on the same line (a line
can be returned more than once). Each `reduceLineQuantity()` call now
also writes a `DeliveryNoteReturn` row (`delivery_note_id`,
`delivery_note_item_id`, `product_id`, `quantity`, `condition`, `reason`
— the `ReturnReason` enum, see below — `stock_location`, `returned_by`,
`returned_at`), exposed via `GET /delivery-notes/{deliveryNote}/returns`
and printable one-per-row via
`GET /delivery-notes/{deliveryNote}/returns/{return}/pdf` (see §8) —
same `DocumentService`/`documents._layout` pipeline as BC/Devis/BL/
Facture. `reason` moved from free text to the same `App\Enums\
ReturnReason` enum `credit_note_items.return_reason` already declares
(`DEFECTIVE`, `DAMAGED`, `WRONG_ITEM`, `CHANGE_MIND`,
`NOT_AS_DESCRIBED`, `EXPIRED`, `CUSTOMER_REQUEST`, `DUPLICATE_ORDER`,
`OTHER`) — a breaking validation change, done for consistency across
return paths rather than leave CAS 1 as the one arbitrary-text outlier.
Note this doesn't yet extend to CAS 2/3: `GcomCreditNoteService` still
never populates `CreditNoteItem.return_reason` either (a pre-existing,
separate gap — flagged, not fixed here, since it wasn't part of what was
reported).

**CAS 2 — return after invoicing (avoir + restock).** Already covered
above — `POST /invoices/{id}/credit-notes` with `items` present.

**CAS 3 — pure financial avoir (no stock movement).** Already covered
above — `POST /invoices/{id}/credit-notes` with `items` omitted.

**Condition routing** — shared by CAS 1 and CAS 2's restock path, both
ultimately call `StockService::restockForReturn()`, which now accepts an
optional `condition` per item (`sellable` default, `damaged`, or
`technical` — omit entirely for the exact prior behavior, fully backward
compatible):

| `condition` | Destination | Sellable stock impact |
|---|---|---|
| `sellable` (default) | The warehouse's own aggregate stock — immediately available for sale | `available_quantity` increases |
| `damaged` | A dedicated `StorageLocationType::DAMAGED` location, auto-provisioned per warehouse on first use | **Untouched** — invisible to every normal stock-availability lookup |
| `technical` | A dedicated `StorageLocationType::QUARANTINE` location (SAV / expertise interne), auto-provisioned per warehouse on first use | **Untouched**, same as `damaged` |

Non-sellable stock is tracked under its OWN `Stock` row, keyed by the
destination location's `location_code` rather than the real warehouse
code (`Stock.storage_location_id` set to that location's id) — this is
what makes it invisible to `bulkStock()`/pricing/order-creation on its
warehouse-code-resolvable path, which only ever queries the real
warehouse code plus known sellable/depot location codes. Matches the
pre-existing inter-location transfer guard elsewhere in `StockService`
(a `DAMAGED`-location product must pass through `QUARANTINE`/`SCRAP`
before it can become sellable again) — this restock path only ever
places non-sellable returns into `DAMAGED` or `QUARANTINE`, never
directly back into sellable stock.

**Caveat fixed 2026-08-20**: the "invisible" guarantee above only ever
held on `bulkStock()`'s warehouse-code-resolvable path. Its branch-only
fallback (hit whenever no warehouse code resolves anywhere in the
user/branch chain — the normal case for a télévendeur/GCOM user with no
van and no `primary_warehouse_id` configured) summed **every** `stocks`
row for the branch with no location-type filtering at all, so `DAMAGED`/
`QUARANTINE` stock silently counted as sellable `stock_available` for
those users. Fixed — see §8's `stock_available` note below.

For CAS 2, `condition` is per `items[]` entry
(`POST /invoices/{id}/credit-notes` — see §8) and is also recorded on
`CreditNoteItem`: `is_scrap = true` for `damaged`, and `stock_location`
set to wherever it actually landed (resolved via the same
`StockService::resolveConditionLocation()` the restock itself uses, so
the two can never disagree).

**Explicitly decided against**: reusing the legacy `BonRetour` system for
a dedicated physical "bon de retour" document — its final stock-writing
step calls methods that don't exist on the class it depends on
(`StockService::addStock()`/`writeOffStock()`, neither of which is
real), so it's not a working reference to extend. `CreditNote` +
`StockMovement` (already battle-tested, already covers CAS 2/3 in full)
is the system of record for GCOM returns; no separate return-document
entity was introduced.

---

## 10. Real Bugs Found Building This

Not assumed, not pre-existing knowledge — each found via a failing test
while building GCOM, then confirmed against the actual codebase.

1. **`StockService::deductForDirectSale()` read `$order->branch_code`**,
   which isn't a real column (`orders.branch_code` was dropped; ~35 call
   sites across the app still read it expecting a value). Every call to
   this method failed with a `NOT NULL` violation on
   `stock_movements.branch_code` — silently unnoticed because its only
   prior caller (`SubmitOrderDecision::deductVanStockIfDirectSale()`) is
   gated behind a flag that defaults off. Fixed with a minimal, scoped
   patch (`$order->branch?->code` fallback) — the other ~35 call sites are
   a separate, much larger pre-existing issue, flagged not fixed.

2. **`LetteringService::getPaymentLetteringSummary()` eager-loaded
   `letterings.order.invoice`** — `Order` has no singular `invoice()`
   relation, only `invoices()` (an order can have several, e.g.
   per-order-mode invoicing). `RelationNotFoundException` on every call.
   Never caught because this method was never reachable via any controller
   before `GcomPaymentController`. Fixed to the real relation name.

3. **`GcomContextResolver`'s cash-payment-term lookup was silently scoped
   by `PaymentTerm`'s `HasDataScoping` trait** (per-user data-rule
   allowlist) — the exact trap `CreditLimitConstraint::isCashTerm()` and
   `SubmitOrderDecision` already document and bypass elsewhere in this
   codebase, just not copied into the new GCOM code on the first pass.
   A real GCOM user without explicit payment-term allowlisting would have
   gotten `"No cash payment term configured"` on every cash/card sale
   despite one existing. Fixed with `withoutGlobalScopes()`.

4. Earlier in the same session, building the underlying Facture
   Directe/Comptoir slice: `InvoiceService::createFromPosOrder()`'s credit-
   state recalculation gap (found and fixed 2026-08-11, see
   `docs/modules/08-payment-credit.md`) — confirmed via test that it fires
   correctly for GCOM-originated invoices too, not just POS/SFA.

5. **`CreditNote::generateNumber()` called `DocumentNumberingService` with
   document type `'AVOIR'`**, which was never a recognized code —
   `legacySeriesColumnsForDocumentType()` only maps `AVR`/`CN`/
   `CREDIT_NOTE`. This method has thrown `CriticalConfigurationException`
   for every caller in the codebase's history, including the pre-existing,
   never-exercised `CreditNoteService` — nothing had ever hit this path
   before `GcomCreditNoteService`'s tests. Fixed: `'AVOIR'` → `'AVR'`.

6. **No seeded `TokenSerie` template ever populated
   `credit_note_prefix`/`credit_note_next_number`** — not the `TV01`
   migration, not any of the `FD97`/`FD98`/`FD99`/`ERP` rows in
   `TokenSerieSeeder`. Only `TokenSerie::autoGenerate()` (per-branch/device
   series) sets it. Combined with bug #5, credit notes had **never** been
   issuable anywhere in this codebase, on any channel. Fixed with a new
   backfill migration
   (`2026_08_14_120000_backfill_missing_credit_note_token_series_prefix.php`)
   that derives `{prefix}{code}` for any series missing it, matching
   `autoGenerate()`'s own convention (guarantees uniqueness since `code` is
   unique) — applied to both the test DB and the dev DB.

7. **`GcomCreditNoteService` used `Invoice->loadMissing('order', ...)`**,
   but `GcomCreditNoteController::store()`'s 404 guard had already called
   `$invoice->loadMissing('order:id,canal')` — a narrow column select.
   `loadMissing()` treats an already-loaded relation as satisfied and skips
   reloading it, so the service saw an `Order` with only `id`/`canal`
   populated and everything else (`branch_id` included) `null` — surfaced
   as "No central warehouse configured for order N's branch," but only
   through the HTTP layer (`GcomCancellationAndCreditNoteTest`'s direct
   service-call tests never hit this, since they pass a fully-loaded
   `Invoice`). Fixed by switching the service to `load()` (unconditional
   reload) instead of `loadMissing()`.

8. **`GcomOrderBuilder::build()` never set `orders.tax_amount`** — stayed
   at its 0 default for every GCOM order. `sub_total`/`total_amount` were
   always correct (computed the same way), so it looked fine on any
   already-invoiced order, because `InvoiceService` incidentally
   back-filled the order's `tax_amount` as a side effect of invoice
   creation. Any BC or BL still *awaiting* invoicing showed the right HT
   and TTC but VAT stuck at `0` on every consultation response — found
   2026-08-15 while reviewing those responses for the UI handoff. Fixed by
   computing it the same way `sub_total` already is (from
   `GcomPricingCalculator`'s line totals, excluding stamp duty).
   Separately, `delivery_notes` has no `sub_total`/`tax_amount` columns in
   the schema at all — `GcomDeliveryNoteController` now proxies both from
   the BL's underlying order onto the response instead (see §8).

9. **`instrument` → bare 404 on all 3 invoicing endpoints** (found
   2026-08-31, reported by the UI team as a suspected regression from the
   08-29 BL-lifecycle deploy — it wasn't). `TreasuryJournalService::
   findOrCreateBranchCaisse()` (§16) generated `BRANCH_CAISSE` journal
   codes as `B{branch_id}{method_suffix}`, sharing the same per-company
   `(code)` uniqueness namespace (`idx_tj_code_company`) as manually-typed
   `BANK_ACCOUNT` codes (`POST /finance/journals`, `FinanceJournalController`
   lets an admin type an arbitrary code). Production already had a
   `BANK_ACCOUNT` journal coded `B8CHQ`, so every cheque/effet GCOM
   settlement for that branch failed the `INSERT` with a
   `UniqueConstraintViolationException` — a **permanent, deterministic**
   collision, not the intermittent race the catch block's comment assumed.
   The race-recovery re-fetch (scoped to `TYPE_BRANCH_CAISSE`) legitimately
   found no row, threw an uncaught `ModelNotFoundException`, and the global
   handler rendered that as `{"error":"not_found"}` — content-independent,
   reproducing on any request that included a non-null `instrument` (the
   only requests that reach `seedFromGcomBranchSettlement()` at all; a
   pure-cash request never touches this code path, matching the report's
   "instrument-present-only" correlation exactly). Fixed by renaming the
   generated prefix to `BC{branch_id}{method_suffix}` (§16) — namespaced
   away from the `BANK_ACCOUNT` convention, verified against every
   existing `BANK_ACCOUNT` code in production (none match `BC\d+`) — plus
   hardening the catch block to throw a diagnosable `DomainException`
   instead of a bare `firstOrFail()` if a genuine mismatch ever recurs.

10. **N+1 audit (2026-09-02)** — systematic pass over the 8 GCOM
    controllers' index/list methods. 6 of 8 already eager-load correctly
    (`Order`, `DeliveryNote`, `Invoice`, `CreditNote`, `Payment`,
    `Representative` — `GcomPartnerStatementsBuilder`/
    `GcomPartnerLedgerBuilder`, §6, are the reference pattern: batch/
    `GROUP BY` before any loop, `->with()` before any relation access in a
    transform). Two real findings, both fixed:
    - `GcomCaisseController::index()` called `TreasuryJournalService::
      computeBalance()` inside a `->map()` over the caller's journals — 3
      unbatched `SUM()` queries per journal (12 for the standard
      ESP/CHQ/EFF/VIR set). Added `TreasuryJournalService::
      computeBalances()` — same per-journal discrepancy-detection/
      audit-log/`RecalculateJournalBalanceJob` side effect, but the 3 SUMs
      each run once, `GROUP BY journal_id`, across every journal.
    - `GcomFinancialInstrumentController::batchDeposit()` ran one
      `whereHas()->find($id)` query per instrument id inside the "remise
      en banque groupée" loop — 20 round-trips for a 20-cheque batch.
      Replaced with one `whereIn()->get()->keyBy('id')` lookup before the
      loop.

11. **Numbering concurrency (2026-09-02, raised by the UI team as an
    integrity check)** — `DocumentNumberingService::
    generateFromFlatTokenSeries()` called `TokenSerie::query()->
    lockForUpdate()` (both directly and via `resolveBranchTokenSerie()`)
    with no `DB::transaction()` anywhere in its call chain. `lockForUpdate()`
    only actually holds its row lock for the lifetime of an enclosing
    transaction — without one, Postgres treats the `SELECT ... FOR UPDATE`
    as its own autocommit statement and releases the lock immediately
    after it returns, before the counter increment even runs. Two
    concurrent requests for the same series (e.g. two users on the same
    branch both converting a BC to a Facture at the same moment) could
    both read the same `next_number` and race. Real duplicate document
    numbers were never actually possible —
    `registerDocumentNumberOrThrowConflict()`'s unique-constraint catch on
    `document_numbers` caught that — but the loser of the race got a hard
    `SyncConflictException` (a failed request the user would have to
    retry) instead of being transparently serialized behind the lock like
    "lockForUpdate" implies. Fixed by wrapping the whole critical section
    in `DB::transaction()` — when called from inside a caller's own
    transaction (every `GcomOrderService`/`GcomDeliveryNoteService`/
    `GcomDirectInvoiceService` flow wraps its whole document-creation
    operation), Laravel nests it as a savepoint and the lock correctly
    holds for the outer transaction's full lifetime.

---

## 11. Known Gaps — Deliberately Deferred

Resolved since the initial build (kept here, struck through, so the
history is traceable rather than silently vanishing from the doc):

- ~~`sales.mode` company-scoped switch.~~ **Built 2026-08-14**, consuming
  side wired **2026-08-15** — `companies.sales_mode` (`GCOM`/`SFA`/
  `HYBRID`) + `GET`/`PUT /api/backend/companies/{company}/sales-mode` for
  managing it, and `POST /api/backend/login`'s response now includes
  `user.company.sales_mode` + `user.can.access_gcom` directly — no second
  call needed at bootstrap. See §14.
- ~~No PDF generation wired for GCOM invoices.~~ **Built 2026-08-14** —
  `GET /invoices/{invoice}/pdf`, see §8.
- ~~No avoir/credit-note or order/BL/invoice cancellation flow.~~ **Built
  2026-08-14** — see §9.
- ~~No partial-BC-line cancellation.~~ **Built 2026-08-14** —
  `GcomOrderService::cancelOrderLine()`, see §8/§9.
- ~~No way to increase a BC line's quantity (only reduce/remove).~~
  **Built 2026-08-15** — `GcomOrderService::updateOrderLine()`,
  `PATCH /orders/{order}/lines/{orderProduct}`, see §8/§9.
- ~~No way to add a brand-new product line to an existing BC.~~ **Built
  2026-08-15** — `GcomOrderService::addOrderLine()`,
  `POST /orders/{order}/lines`, see §8/§9.
- ~~`payment_transfers`/`letterings` were only ever populated by a later
  règlement — a comptoir cash/cheque sale left both empty.~~ **Fixed
  2026-08-15** — real gap reported by the UI team. See §4/§6/§7
  ("Treasury unification") — `GcomInstrumentRegistrar::recordSettlement()`.
- ~~No way to list a partner's pending cheques/effets, no debit/credit
  statement, no chronological account ledger.~~ **Built 2026-08-16**
  (requested by the UI team) — `GcomPartnerFinanceController`, see §6/§8.
- ~~`POST /payments` rejected every payment term genuinely attached to a
  real partner.~~ **Fixed 2026-08-16** — real bug reported by the UI team
  (règlement screen unusable for any of the 3 ORBIS test partners,
  regardless of which of their real terms was picked). Root causes: (1)
  `payment_terms.payment_method_id` was missing from `PaymentTerm::
  $fillable`, so every attempt to set it was silently dropped — including
  `GcomDatabaseSeeder`'s own; (2) `PaymentTransferService::
  registerPayment()` never fell back to
  `partner_financial_profiles.default_payment_method_id`, the actual
  source of truth for credit-type terms per this codebase's own
  documented architecture (`database/sql/04_partenaires_commerciaux.sql`);
  (3) `PaymentTerm::find()` was scoped (`HasDataScoping`+
  `BelongsToCompany`), same trap already fixed once on
  `GcomContextResolver::resolvePaymentTermId()` for the same model. See
  §8 for the full resolution order and `tests/Feature/Payment/
  PaymentTransferMethodResolutionTest.php`.
- ~~`POST /payments` had no `payment_method_id`/`instrument` fields at
  all — a cheque/effet received at DEFERRED règlement time (weeks after
  the original credit sale) never got any bank-clearing lifecycle
  tracking, only a plain `payment_transfers` row.~~ **Built 2026-08-17**
  (UI team confirmed this was needed, no per-partner method restriction
  needed) — `GcomInstrumentRegistrar::registerForPaymentTransfer()`,
  linked via `financial_instruments.payment_transfer_id` rather than
  `invoice_id` (a règlement can letter across several invoices). See §8.
- ~~No PDF for BC (`GET /orders/{order}/pdf`), Devis
  (`GET /quotes/{id}/pdf`), or BL (`GET /delivery-notes/{deliveryNote}/pdf`)
  — only the invoice had one.~~ **Built 2026-08-17.** BC and BL needed no
  new template work at all — `App\Services\DocumentService` +
  `App\Documents\DocumentDataResolver` (a second, already-generic
  document pipeline, separate from `InvoiceDocumentService`, already
  exposed for other channels via `Backend\DocumentController` at
  `/api/backend/documents/{bc,bl}/{id}`) already had full resolver cases
  and Blade templates (`documents/bc.blade.php`, `documents/bl.blade.php`)
  for both — this just wires the existing pipeline into GCOM's own routes
  with the usual `canal !== 'GCOM'` → 404 guard, same pattern as the
  invoice PDF. Devis was the one genuinely missing piece — no document
  type anywhere rendered a Quote before this — added `resolveDevis()` +
  `documents/devis.blade.php`, modeled closely on the BC resolver/template.
  Also fixed a real dormant bug found while touching `resolveBc()`: the
  commercial's name was stored under the key `'preSelling'`, but
  `bc.blade.php` reads `$data['sales_rep']` — silently blank on every BC
  PDF ever generated, in both the info box and the signature line.
  These templates (logo/letterhead, colored branded header, status badge,
  bordered totals box, dashed notes block, two-column signature grid with
  "Signature & Cachet" lines, legal footer with Capital social/RC/IF/ICE,
  watermark support) are considerably more polished than the invoice's own
  `documents.invoice_v1` template — ~~worth considering migrating the
  invoice PDF onto the same `documents._layout` family for visual
  consistency across the whole GCOM document set, but that's a separate,
  deliberately-not-done-here change (the invoice PDF already works and
  wasn't reported broken)~~. **Done — see below.**
- ~~`price_mode` had no effect on the invoice PDF (BC/Devis/BL got the
  toggle, the invoice didn't), and the invoice PDF's design didn't match
  BC/Devis/BL (older, plainer `documents.invoice_v1` template — no logo,
  no detailed line table, no signature block).~~ **Built 2026-08-18** —
  real gaps reported by the UI team (evidence: a `pdftotext` diff across 3
  live invoices proving `price_mode` was a total no-op, and a side-by-side
  text-extract comparison against a BC for the same client/product showing
  the layout gap) while wiring a shared "Imprimer" (HT/TTC) button across
  all 4 GCOM screens. Both closed in one move: `GcomInvoiceController::
  pdf()` now calls the same `DocumentService`/`DocumentDataResolver`
  pipeline as BC/Devis/BL (type `'invoice'`) instead of the older
  `InvoiceDocumentService` — new `DocumentDataResolver::resolveInvoice()`
  + `documents/invoice.blade.php` (extends `documents._layout`, same as
  the other three). `InvoiceDocumentService` itself is untouched —
  `Backend\OrderController` and `POS\PosOrderController` still depend on
  it and neither was reported broken. `price_mode` defaults to `ttc`
  (this endpoint's own pre-existing convention) when omitted, so no
  existing caller's output changes unless it opts in.
- ~~No way to print a document HT or TTC — some clients need the
  tax-excluded figure for their own accounting, others need the final
  tax-included one.~~ **Built 2026-08-17** — `?price_mode=ht|ttc` on all
  three new PDF endpoints (§8). Each document keeps its own prior default
  when the param is omitted (BC/Devis: `ht`, BL: `ttc`) — fully backward
  compatible, existing bookmarked/embedded PDF links keep behaving exactly
  as before. Real caching bug found and fixed while wiring this: the PDF
  cache was keyed on document type+id **only** — a `?price_mode=ttc`
  request right after the default one would have silently been served the
  stale HT bytes back. `DocumentService::storagePath()` now folds every
  render-affecting option (`price_mode`, `show_prices`, `watermark`) into
  the cache path itself, and is now `public` so
  `DocumentController::url()` — which used to hardcode its own
  independent copy of the same path logic — calls it instead rather than
  risking the two drifting apart again.
- ~~No way to reduce a BL line's quantity before invoicing (partial return
  at delivery, no avoir should be needed since no invoice exists yet), and
  no condition/destination targeting on any restock (everything always
  went back to sellable stock at the central warehouse, no way to route
  damaged/technical returns elsewhere).~~ **Built 2026-08-18** — full plan
  agreed with the UI team first (§9bis has the complete design):
  `GcomDeliveryNoteService::reduceLineQuantity()` for CAS 1,
  `StockService::restockForReturn()` extended with a per-item `condition`
  (shared by CAS 1 and the existing CAS 2 avoir restock), routing
  `damaged`/`technical` returns into dedicated `DAMAGED`/`QUARANTINE`
  `StorageLocation`s instead of sellable stock. Explicitly decided
  **against** reviving the legacy `BonRetour` system for this (its final
  stock-writing step calls methods that don't exist on the class it
  depends on) — `CreditNote` + `StockMovement` remains the system of
  record.
- ~~Seeded GCOM products never had `is_active` set, hidden from any
  "active only" consumer despite `Product::updateOrCreate()` otherwise
  succeeding.~~ **Fixed 2026-08-17** — GCOM's own order-creation paths
  never filter by `is_active` (`findOrFail` only), so this stayed
  unnoticed until `GET /telesales/catalog/products` (reused by GCOM,
  which does filter) returned zero products for reasons that had nothing
  to do with `company_id`/partner scoping.
- ~~`GET /telesales/catalog/products`'s `stock_available` was silently
  always `0` for GCOM stock once a warehouse had any storage location
  configured.~~ **Fixed 2026-08-17** — see the product-picker section in
  §14 for the full explanation (SFA vs. GCOM stock-recording convention
  mismatch).
- ~~`GcomDirectInvoiceService::convertOrderToInvoice()` and
  `convertDeliveryNoteToInvoice()` read `order.payment_method` (the
  Attribute accessor), which always returns `null` for a GCOM order — it
  casts through the legacy `PaymentMethod` enum (`CASH='Cash Payment'`
  etc.), and GCOM's own lowercase vocabulary (`'cash'`, `'credit'`, ...)
  never matches any case. Both silently fell back to `'cash'`
  unconditionally.~~ **Fixed 2026-08-15**, found investigating the
  `payment_transfers`/`financial_instruments`-always-empty report above.
  Impact was **worse than empty tables**: on the BL→Facture path
  specifically, `convertDeliveryNoteToInvoice()` used this value to decide
  whether to force-close the invoice — meaning **every genuine credit-sale
  invoice converted via BC→BL→Facture (or BL Direct→Facture) was being
  silently marked `fully_paid`** instead of staying `pending`, losing its
  credit exposure. `convertOrderToInvoice()` (BC→Facture, skips BL) wasn't
  affected the same way — `InvoiceService::createFromPosOrder()` decides
  paid/pending from `order.is_credit_sale` (a real column), not this
  accessor — so only its `financial_instruments` registration was broken
  there, not the invoice status. Both now read
  `order.financialMetadata?->payment_method` directly, matching the
  pattern already established in `GcomOrderService` for the same accessor
  bug. See `tests/Feature/Gcom/GcomTreasuryUnificationTest.php ::
  credit_sale_via_bl_stays_pending_not_paid` for the regression test.
- ~~`convert-to-bl`'s `delivery_date`/`payment_method` body fields were
  silently accepted and ignored.~~ **Fixed 2026-08-15** — real bug
  reported by the UI team, confirmed live against order 15 (both fields
  sent, neither had any effect: the BL got the request's real creation
  timestamp, the order kept its original payment method). Neither field
  existed in the controller's validation at all — anything sent there was
  simply never read. Now wired through to
  `GcomDeliveryNoteService::createDeliveryNoteFromOrder()`, including the
  stamp-duty recalculation and credit re-check a payment-method change
  requires. See §8.
- ~~`order.products[].pivot.id` didn't actually exist on any GCOM order
  response.~~ **Fixed 2026-08-15** — found by the UI team wiring the
  line-cancel button: `Order::products()`'s `withPivot([...])` never
  listed `id`, so Laravel never hydrated it on `POST /orders`, `GET
  /orders/{order}`, or the cancel-line/update-line responses. The doc's
  own §14 gotcha note was itself wrong (claimed `GET` used a different,
  flat shape) — never actually verified against a live response. One
  real `pivot.id` now, same shape everywhere. See §14.
- ~~`role:admin|root` gating, not a dedicated permission.~~ **Narrowed
  2026-08-14** — `permission:manage-gcom` (see banner at the top of this
  doc). Still only granted to `root`/`admin` by the seeder; create and
  grant a narrower role when real GCOM back-office users need it (§14 has
  the exact API calls to do this).
- ~~No printable document for a CAS 1 partial return (bon de retour) —
  BC/Devis/BL/Facture all had PDFs, a physical return had none, and
  nothing about the return (reason/condition/date) was persisted anywhere
  queryable, only buried as freeform text in `StockMovement.notes`.~~
  **Built 2026-08-18** — real gap reported by the UI team while wiring
  the CAS 1 return flow, who correctly noted §9bis's design choice (no
  dedicated `BonRetour` entity, `CreditNote`+`StockMovement` as the system
  of record) doesn't by itself give a physical return anything to sign —
  see §9bis and §8 for the full design (new `DeliveryNoteReturn` event
  table + `GET .../returns` + `GET .../returns/{return}/pdf`, `reason`
  moved to the shared `ReturnReason` enum). Deliberately still no
  dedicated entity/workflow — this only adds a queryable record + a
  printable view of data that already existed in principle.
- ~~The pre-existing Treasury engine (`treasury_journals`,
  `treasury_transfers`, `treasury_ledger_entries`...) had zero overlap
  with GCOM — a comptoir cash/cheque sale closed the invoice and updated
  `payment_transfers` (§4/§6's "Treasury unification") but never touched
  a single Treasury table, so an admin building the "Gestion Trésorerie"
  screen against a GCOM tenant would find every journal empty.~~ **Built
  2026-08-20** — surfaced by the UI team's already-built "Chèques &
  Effets" screen prompting the question "does GCOM feed the real
  trésorerie". See §16 for the full design (originally one shared journal
  per branch + payment method, reversed 2026-08-20+ to per-user caisses)
  and the admin Finance API GCOM's back-office screen should build
  against.
- ~~Rejecting a financial instrument didn't reopen the invoice's debt or
  touch the branch caisse it landed in — a bounced cheque left the
  invoice `fully_paid` and the journal balance untouched, as if the money
  had actually arrived.~~ **Fixed 2026-08-20** — PRIORITÉ 1 of the
  trésorerie cadrage ("FEU VERT TOTAL" from the UI team). See §8's
  "Financial Instruments" section and §16's cross-reference —
  `ReverseSettlementOnInstrumentRejected` listener +
  `GcomInstrumentRegistrar::reverseSettlementForRejectedInstrument()`.

- ~~Deferred règlement doesn't feed a branch caisse journal.~~ **Fixed
  2026-08-21** — the last structural gap in the Treasury story.
  `GcomPaymentController::store()` (§6) has no order/invoice to derive a
  branch from (a règlement is partner-level), so it's resolved from the
  **collecting actor's own branch** instead
  (`GcomContextResolver::resolveBranch()`) —
  `GcomInstrumentRegistrar::recordDeferredSettlement()`, covering every
  payment method (cash/cheque/effet/virement), not just cheque/effet.
  Consequence for the reject fix above: rejecting a deferred cheque now
  voids its branch-caisse entry too, exactly like an at-sale one — before
  this it only reopened the invoice debt, since there was no intake line
  yet to void. See §16.

Still open:

- ~~No "clôture de caisse" (Z de caisse) for GCOM.~~ **Built 2026-08-21**
  — PRIORITÉ 2 of the trésorerie cadrage, schema validated before coding
  per the established review-before-build pattern. See §16's own
  "Clôture de caisse (Z de caisse)" subsection for the full design
  (`treasury_journal_closures`, `TreasuryJournalClosureService`, the
  admin endpoints, the strict same-day blocking guard).
- **No bank-statement reconciliation** (matching `treasury_ledger_entries`
  against an actually-imported bank statement — as opposed to lettrage,
  which matches invoices to payments and is fully operational). Paused
  2026-08-20 by explicit decision (Priorité 3, on hold) — lettrage +
  branch caisse balances + transfers already give correct traceability
  without it for now. Full scope/dependencies/open-questions written up
  in §16's "Backlog — Rapprochement bancaire" subsection (2026-08-22) so
  nothing here needs re-deriving when a real trigger eventually shows up.

- **Invoice total mismatch after a full-line damaged/technical return**
  (found 2026-08-23, regression sweep for the `GET /orders`/
  `/delivery-notes` detail-endpoint trim — unrelated to that trim,
  reproduces identically on the pre-trim code too, confirmed by direct
  isolation). `GcomReturnsConditionTest::returning_the_entire_line_
  quantity_zeroes_it_and_leaves_other_lines_billable` expects
  `total_amount = 500.00` (10 units × 100 kept, one line fully returned
  as damaged) but gets `503.75` — a 3.75 discrepancy not yet root-caused.
  Not fixed here (out of scope for the trim); flagged so it doesn't get
  silently attributed to unrelated work later.

- ~~Devis (Quote) numbering doesn't use the branch-scoped `TokenSerie`
  system.~~ **Fixed 2026-08-23** ("FEU VERT TOTAL") — the last GCOM
  document type still on a random scheme (`DEV-{Ymd}-{random 6}`) is now
  on `DocumentNumberingService`/`TokenSerie`, same as BC/BL/Facture/
  Avoir/bon de retour. New `token_series.devis_prefix`/
  `devis_next_number` columns (backfilled for every existing series —
  live-verified on ORBIS's own series, no manual reconfiguration
  needed), `TokenSerie::autoGenerate()` sets the pair for new series,
  `DEV`/`DEVIS`/`QUOTE` mapped in `legacySeriesColumnsForDocumentType()`,
  `DEV` registered in `document_types`. `QuoteService::
  generateQuoteNumber()` now requires `$user->branch_code` — same
  requirement `convertToOrder()` already enforced for this exact user
  population's BC number a few steps later in the same lifecycle, so not
  a new constraint in practice. Shared by SFA/télévendeur quote creation
  too (`QuoteService` has zero canal coupling) — both channels get real
  branch-scoped numbering now, not just GCOM. Existing `DEV-*` numbers
  already in production keep their old shape (numbering migrations here
  are never retroactive) — only new quotes get the new format.
- ~~Setup/Bootstrap payload conditioning — not formally confirmed.~~
  **Verified and fixed 2026-08-23.** The route-surface separation was
  already correct (a GCOM client never calls any SFA sync/bootstrap
  endpoint — that part really was moot). What the original phrasing got
  wrong was *where* the actual leak lived: not named
  `device_parameters`/`sync_settings`/`geofence_rules` blocks (those
  don't exist anywhere in the code), but `POST /api/backend/login`'s
  `auth_profile.settings` — `ProfileService::getAuthProfilePayload()`
  unconditionally computed and returned all ~140 keys from
  `config/data/sfa_parameter_definitions.php` (confirmed genuinely SFA/
  vendeur-terrain-specific by inspection: sync, geofencing, van-selling
  thresholds) on **every** login, regardless of `company.sales_mode`.
  Never a boot-blocker (nothing downstream fails without them — traced
  every caller), but real, confirmed payload/compute bloat for a
  GCOM-only tenant. Now skipped for `sales_mode = 'GCOM'` companies only
  (SFA/HYBRID untouched); the separate `ConfigurationSetting`-driven
  override path (channel-agnostic, e.g. an explicit per-company override
  on any registered key) is never skipped for anyone, so a GCOM company
  keeps everything it could actually be using.
- **No cancelling — or editing — a BC/BL once an invoice exists.** No
  add-line/update-line/cancel-line endpoint reaches an invoiced document,
  by design: an issued invoice is a fiscal snapshot, not something that
  gets silently rewritten after the fact (matches real accounting practice
  — a validated invoice is credited, never un-issued). Worked example:
  Facture `FAC-2026-00042` is issued for 10× product A. The client then
  asks for 3× product B on top.
  - **Wrong**: looking for a "add line to invoice" endpoint — none exists,
    and none should; it would mean silently changing a number that may
    already be printed/sent/reported.
  - **Right**: create a **new** BC (`POST /orders`) for the 3× product B,
    then convert it to its own invoice the normal way (§3). The client
    ends up with two invoices instead of one amended invoice — this is
    the expected, correct outcome, not a workaround.
  - If the original 10× product A was wrong (not just "needs more added")
    — e.g. wrong quantity or wrong product entirely — that's a correction,
    not an addition: issue an avoir against `FAC-2026-00042` for the
    incorrect part (§9), then create a fresh, correct BC/Facture.
- **Origin-document tracking is relational, not a stored polymorphic
  field.** Works today (see §2) but requires a join to walk backward from
  an invoice to its quote. Revisit only if a single-query "full document
  history" view is actually needed.
- **No dedicated Inventaire UI-facing docs in this file** — generic (not
  GCOM-scoped) backend feature, not documented here; see
  `InventoryCheckController.php` directly if a GCOM screen needs to
  trigger a stock count. Achats (BC Fournisseur / Réception / Stock) now
  has its own doc: [30-achats-purchase-orders.md](30-achats-purchase-orders.md)
  (2026-08-26) — the `purchase_order_number` free-text field on
  `purchase_receptions` was replaced by a real `purchase_order_id` FK as
  part of that work.
- ~~`partners.invoicing_mode` is not consulted anywhere in GCOM.~~
  **Built 2026-08-31** (confirmed status 2026-08-31, real question from
  the UI team; "architecture propre à GCOM" — explicit decision to NOT
  couple to the legacy SFA `DeliveryNoteDelivered`/
  `GenerateInvoiceOnDelivery` listener chain). See §8's
  `convert-to-invoice` entry and §16-adjacent `GcomGeneratePeriodicInvoicesCommand`
  for the full behavior of all 3 modes. Real latent risk found and fixed
  in the same investigation, independent of the feature itself: the
  monthly `invoices:generate-periodic` cron (`GeneratePeriodicInvoicesCommand`,
  the legacy/non-GCOM one) had no `canal` filter at all — a GCOM BL
  sitting `delivered`+uninvoiced (its normal pre-convert-to-invoice
  state) for a `PERIODIC_FIN_DE_MOIS` partner would have been swept into
  that legacy pipeline, never built for GCOM's souche/stamp-duty/
  settlement rules. No partner was in that state at fix time (verified
  live) — excluded by `canal` now regardless.

---

## 12. Testing

| File | Covers |
|---|---|
| `tests/Feature/Gcom/GcomDirectInvoiceServiceTest.php` | Facture Directe (#6), Devis→Facture (#2), credit sales, cheque/effet instruments |
| `tests/Feature/Gcom/GcomDirectInvoiceControllerTest.php` | HTTP layer for the above |
| `tests/Feature/Gcom/GcomPaymentControllerTest.php` | Règlement/lettrage (#7/#8) — registers + auto-letters a payment against an open GCOM invoice, letters against an explicit allocation, lists open invoices. **2026-08-31**: rejects a set of individually-valid allocation lines whose SUM exceeds the payment amount (real bug fix, `LetteringService::letterPayment()`'s aggregate guard), no partial write survives the rejected transaction |
| `tests/Feature/Gcom/GcomFlexibleDocumentFlowTest.php` | BC/BL flows (#1, #3, #4, #5) — the stock-deduction-timing invariant, credit checks at BC creation, Devis→BC |
| `tests/Feature/Gcom/GcomFlexibleDocumentControllerTest.php` | HTTP layer for BC/BL flows |
| `tests/Feature/Gcom/GcomConsultationEndpointsTest.php` | List/show endpoints — GET /orders, /delivery-notes, /invoices, /payments, canal/partner scoping, cross-tenant 404s |
| `tests/Feature/Gcom/GcomAdminCanUseTelesalesCatalogTest.php` | GCOM reuse of `GET /telesales/catalog/products` — partner-aware pricing, permission gate, `stock_available` correctly found under the bare warehouse code even when a storage location exists for that warehouse, and (2026-08-20) the branch-fallback path excludes `DAMAGED` stock while still counting general-bucket stock |
| `tests/Feature/Gcom/GcomCancellationAndCreditNoteTest.php` | §9 — BC/BL cancellation + restocking, full/partial avoir, the total_amount-vs-remaining_amount split (refund_amount path), HTTP layer for cancel + credit-note endpoints |
| `tests/Feature/Gcom/GcomCreditNoteGlobalAndRedeemTest.php` | §8/§9 (2026-08-31) — `GET /credit-notes` filters (partner_id/status), invoice/partner eager-loaded, no cross-company leak; `GET /credit-notes/{id}`; `POST /credit-notes/{id}/redeem` journals a negative TreasuryIntakeLine and decrements the branch caisse's cached_balance, stamps refund_method/refund_reference/refund_processed_at, rejects a second redemption, rejects redeeming a credit note with nothing owed back, rejects an unknown method |
| `tests/Feature/Gcom/GcomAvoirPaymentTest.php` | §8/§9 (2026-08-31) — a direct invoice settles fully via one avoir with zero TreasuryIntakeLine created; partial imputation leaves a remaining balance and does NOT flip refund_processed_at; two avoirs combined cover one sale; rejects allocations summing to less than or more than the sale total, an avoir belonging to another partner, and exceeding an avoir's remaining_amount; redeeming part then imputing the rest never double-spends the original balance (and a third attempt against the exhausted avoir fails); BC→Facture and BL→Facture both settle via avoir despite generateFromDeliveryNote() always starting 'pending'; avoir payment skips the credit check entirely even for a partner with a tiny credit limit. **Mixed avoir + another method** (same day, real case) — direct-invoice and BL→Facture both settle via a partial avoir + card remainder, Treasury credited for ONLY the remainder (never the avoir-covered portion); rejects a shortfall when payment_method is 'avoir' itself; rejects mixing avoir with a credit remainder; mixed avoir + cheque remainder still requires instrument details. **payment_method override** (same day, another real case) — BL→Facture and BC→Facture both override an avoir-only BC/BL to cash/card when the avoir is too small, stamp duty correctly added/omitted, the BL's own total_amount snapshot updated (not just the order's), Treasury credited for the true remainder including stamp duty. **2026-09-01 (generalized)**: a stored 'credit' BC now overrides to 'cash' and succeeds (was a 422 before generalization); rejects 'avoir' as an override target (the one target still excluded) |
| `tests/Feature/Gcom/GcomPaymentMethodOverrideAtInvoicingTest.php` | §8 (2026-09-01) — general payment_method override at convert-to-invoice: BL→Facture overrides cash to credit for "espèces différé" (pending/paid_amount:0/no TreasuryIntakeLine, explicit payment_term_id honored), settled the next day via the normal POST /payments deferred règlement into the actor's own ESP caisse; BC→Facture overrides a stored credit method to cash (real Treasury movement, fully_paid); override to cheque still requires instrument details; rejects avoir as an override target; rejects overriding once the document is already invoiced (a repeat call without an override still returns the existing invoice unchanged); rejects a credit override with no resolvable payment term (no explicit one supplied, no partner default); a credit override still runs the real credit-limit check (422 for a partner with a 1 MAD limit) |
| `tests/Feature/Gcom/GcomReturnsConditionTest.php` | §9bis — CAS 1 (BL partial return pre-invoice, net billing on convert), condition routing (sellable/damaged/technical → available/DAMAGED/QUARANTINE) shared by BL returns and credit-note restocks, guards (already invoiced, over-quantity rejected, invalid `reason`), `CreditNoteItem.is_scrap`/`stock_location`, `DeliveryNoteReturn` persistence + `GET .../returns` + bon de retour PDF + cross-BL 404 (2026-08-18), HTTP layer. **2026-08-31**: 100% single-line return zeroes the line and leaves sibling lines untouched, the zeroed line is excluded from the invoice (not resurrected to the original order quantity — the real bug this surfaced), `GET /delivery-notes/{id}` still returns the zeroed line in `items[]` |
| `tests/Feature/Gcom/GcomOrderLineCancellationTest.php` | Partial/full single-line BC cancellation, order-total recomputation, HTTP layer |
| `tests/Feature/Gcom/GcomOrderLineUpdateTest.php` | BC line quantity increase/decrease, re-pricing, stock untouched, credit re-check on increase only, HTTP layer. Signature gained an explicit `User $actor` param (2026-09-01, needed for the new discount/margin-guard checks) — every call site updated |
| `tests/Feature/Gcom/GcomOrderLineAdditionTest.php` | Adding a new product line to an existing BC, rejects duplicate product, stock untouched, credit re-check, HTTP layer. Same `$actor` signature change as the update-line test above |
| `tests/Feature/Gcom/GcomPricingDiscountEngineTest.php` | Manual negotiation (2026-09-01) — `unit_price` override rejected without `gcom-price-override`, honored with it; line `discount_percent` rejected without `gcom-discount-line`, honored within the paramétrable `gcom.max_discount_percent` (default 10%), rejected beyond it without `gcom-discount-override-limit`, honored with it; rejects `discount_percent`+`discount_amount` together on one line; global discount rejected without `gcom-discount-global`, distributed proportionally to each line's HT and reconciles exactly (VAT-inclusive TTC impact verified against the 19% fallback rate); anti-loss-sale guard rejects a line net-priced below `stocks.pmp_cost`, honored with `gcom-loss-sale-override`, skips silently with no PMP recorded, also enforced on add-line/update-line |
| `tests/Feature/Gcom/GcomConvertToBlOptionsTest.php` | `convert-to-bl`'s `delivery_date`/`payment_method` body — explicit date honored, defaults, stamp-duty recalculation both directions, credit re-check on switching to a non-immediate method, `is_credit_sale`/`payment_term_id` re-sync, HTTP layer |
| `tests/Feature/Gcom/GcomTreasuryUnificationTest.php` | Treasury unification (§4/§6/§7) — `payment_transfers`+`letterings` created for cash/card/cheque comptoir sales and BC→Facture/BL→Facture immediate settlements, none created for credit sales, cheque gets both a `FinancialInstrument` and a `payment_transfers` row, and the credit-sale-via-BL-was-wrongly-fully_paid regression |
| `tests/Feature/Gcom/GcomInvoiceDetailPaymentInfoTest.php` | `GET /invoices/{invoice}`'s `payments`/`financial_instrument` fields — cash/cheque comptoir, empty for an unsettled credit invoice, populated once a deferred règlement lands |
| `tests/Feature/Gcom/GcomPartnerFinanceControllerTest.php` | `GET /partners/{partner}/{financial-instruments,statement,ledger}` — instrument filtering + cross-partner isolation, statement debit/credit/balance/pending-instruments/credit-limit for cash and mixed credit+cheque scenarios, ledger entry types + running balance including a deferred règlement and an avoir |
| `tests/Feature/Gcom/GcomPartnerStatementsTest.php` | §8 (2026-08-31) — `GET /partners/statements` sorted by `current_balance` desc, cash-settled partner nets to zero and reports credit limit, `include_zero_balance` on/off toggles whether a partner with no GCOM orders appears, `min_balance` filters, `branch_id` only counts orders placed there, `pending_instruments_total` reflects an uncleared cheque, no cross-company partner leak |
| `tests/Feature/Gcom/GcomDeferredChequeSettlementTest.php` | `POST /payments`'s `payment_method_id`/`instrument` fields — a deferred cheque/effet creates a `FinancialInstrument` linked via `payment_transfer_id` (not `invoice_id`), rejects a cheque with no instrument details, an explicit `payment_method_id` overrides the term's default |
| `tests/Feature/Gcom/GcomFinancialInstrumentLifecycleTest.php` | §8 "Financial Instruments" — deposit with date+reference, deposit defaults to today, clear, reject with reason, reject requires a reason (422), invalid transition surfaces as a 422 through the GCOM HTTP layer |
| `tests/Feature/Gcom/GcomTreasuryUserCaisseTest.php` | §16 (2026-08-20+ caisses individuelles) — cash settlement seeds an ESP intake line into the ACTOR's own `TYPE_USER_CAISSE` journal (not the branch coffre, untouched), two sales accumulate in the same user journal, two vendeurs at the same branch never mix caisses, cheque settlement seeds CHQ **and** still registers the PENDING `FinancialInstrument`, card maps to VIR, a credit sale seeds nothing at all, a settlement with no assigned caisse gets a 422 |
| `tests/Feature/Gcom/GcomInstrumentRejectReversalTest.php` | §8/§11 reject-reversal — an at-sale cheque's reject reopens the invoice (`paid_amount`/`remaining_amount`/`status`) and voids the actor's own user caisse's intake line (compensating negative row, balance back to 0), `clear()` touches neither, a deferred cheque lettered across two invoices reopens both on reject |
| `tests/Feature/Treasury/TreasuryJournalClosureTest.php` | §16 "Clôture de caisse" — auto-open on first sale, a second sale reuses the same session, explicit `open` is idempotent, `close` computes `theoretical_closing_balance`/`discrepancy` correctly and never touches `cached_balance`, closing an already-closed session is rejected, correcting a closed session updates the count and preserves `original_counted_balance`/`original_discrepancy`, a second correction doesn't overwrite those originals, correcting a still-`OPEN` session is rejected, correction requires a `reason`, batch-close closes every open journal for a branch in one call, reports a never-touched journal as `skipped` not an error, and is best-effort (one already-closed journal doesn't block closing the others). **Multi-sessions (2026-08-31)**: a closed journal auto-opens `session_number` 2 for the next same-day GCOM sale instead of throwing (was `JournalClosedException`, now deleted), and batch-close targets the currently-open session specifically, never an earlier already-closed one |
| `tests/Feature/Gcom/GcomDeferredSettlementUserCaisseTest.php` | §16 "Deferred règlement" — a deferred cash règlement seeds an ESP intake line into the collecting actor's own user caisse, a deferred cheque seeds CHQ and links `intake_line_id` on the `FinancialInstrument`, a closed branch coffre does NOT block a user settlement, no assigned caisse gets a 422, `redeposit()` moves a rejected instrument back to `PENDING`. **Multi-sessions (2026-08-31)**: a closed user caisse auto-opens a new session for the next deferred règlement the same day rather than blocking it |
| `tests/Feature/Gcom/GcomCaisseClosureTest.php` | §16 "Clôture de caisse et versement au coffre" (2026-08-20+) — `GET /gcom/caisse` lists the caller's own caisses with live computed balances and `is_closed_today` (false before, true for the just-closed journal only — a sibling caisse stays false), closing ESP transfers the closure's theoretical balance to the branch coffre auto-accepted (a counted-balance discrepancy never changes the transferred amount), closing CHQ creates one transfer per pending cheque (never a lump sum), closing an empty caisse transfers nothing, no assigned caisse gets a 422. **Multi-sessions (2026-08-31)**: `index` also exposes `has_open_session`/`session_number`; closing with nothing currently open (already closed today, untouched since) is rejected (`422 TREASURY_NO_OPEN_SESSION`) without creating a phantom session; a second same-day session closes and transfers independently of the first, coffre balance ends up as the sum of both |
| `tests/Feature/Gcom/GcomInvoicePdfTest.php` | `GET /invoices/{invoice}/pdf` — real PDF bytes returned, correct `Content-Type`, 404 for non-GCOM invoices, HT vs. TTC renders differ and cache separately (2026-08-18, migration onto the BC/Devis/BL pipeline) |
| `tests/Feature/Gcom/GcomDocumentPdfTest.php` | `GET /orders/{order}/pdf`, `/delivery-notes/{deliveryNote}/pdf`, `/quotes/{id}/pdf` — real PDF bytes for BC/BL/Devis, 404 for non-GCOM BC/BL, 403 for someone else's Devis, HT vs. TTC renders differ and cache separately |
| `tests/Feature/Gcom/GcomDocumentDiscountRenderingTest.php` | Real bug (2026-09-01, UI team, order BCORBI-A01-000066) — `DocumentDataResolver::resolveBc()`'s PDF data reflects a `global_discount_percent` in `total_ht`/`total_ttc`/line totals (not the raw pre-discount amount) with a correctly-derived REM.% (not always "—"); BC→BL conversion carries the discount onto the new `DeliveryNoteItem.unit_price` (not the stale pre-discount `order_products.price`) and the BL's own `total_amount` reconciles with the sum of its items; BC→BL→Facture ultimately bills the discounted amount, not the pre-discount one (the real overcharge risk this surfaced) |
| `tests/Feature/Gcom/GcomDocumentNumberingBranchScopingTest.php` | Locks in that BC/Devis/BL/bon de retour/Facture/Avoir each consume their own branch's `TokenSerie` series, never a coexisting generic wildcard default and never another branch's series (real bug this test was built to catch, §10) — Devis added 2026-08-23 once its numbering migrated off the random scheme |
| `tests/Feature/Gcom/GcomBootstrapPayloadConditioningTest.php` | §11 "Setup/Bootstrap payload conditioning" — a GCOM-only company's login `settings` excludes the ~140 `sfa_parameter_definitions.php` keys, SFA/HYBRID companies still get the full set (unaffected), an explicit `ConfigurationSetting` override on a registered key still reaches a GCOM company's settings (extraKeys path never skipped) |
| `tests/Feature/Gcom/GcomFinancialInstrumentPortfolioTest.php` | §8 "Portefeuille" — `GET /financial-instruments` lists across every partner of the company, never leaks another company's instruments, filters by `status`/`instrument_type`/`bank_id`/`due_date` range, `branch_id` best-effort matches an at-sale instrument; `POST /financial-instruments/batch-deposit` deposits every valid id in one call, is best-effort (one wrong-state instrument doesn't block the others), and treats another company's id as not found rather than processing it |
| `tests/Feature/Gcom/GcomBankDepositTest.php` | §8 "Bordereau de remise en banque" (2026-08-31) — `batch-deposit` creates ONE `BankDeposit` shared by every instrument in the call; a single `deposit()` creates its own (a batch of size 1), and two separate single deposits get two separate `BankDeposit`s; `bank_deposit_id` exposed on `GET /financial-instruments` with zero extra calls; `deposit_reference` stays optional; `GET .../bank-deposits/{id}/pdf` returns real PDF bytes, `404` for another company's deposit |
| `tests/Feature/Gcom/GcomPartnerStatementPdfTest.php` | §8 "Relevé de Compte" PDF (2026-08-24) — `GET /partners/{partner}/ledger/pdf` returns real PDF bytes with `Content-Type: application/pdf`, `download` flag switches `Content-Disposition` inline/attachment, entries match the JSON `/ledger` endpoint exactly (shared `GcomPartnerLedgerBuilder`), a `from`/`to` range excluding every entry doesn't reuse the full-history cached PDF, 404 for a non-existent partner |
| `tests/Feature/Gcom/GcomStampDutyWaiverAndSalespersonOverrideTest.php` | 2026-08-27 — `partner.waive_stamp_duty` honored on BC creation and on the line-edit recompute path (adding a line to a waived partner's order stays waived), non-waived partner still charged normally (regression); explicit `salesperson_id` honored on direct-invoice and direct-BL creation, defaults to the acting user when omitted, rejects a non-existent user id with 422 |
| `tests/Feature/Gcom/GcomRepresentativeTest.php` | §18 (2026-08-27/28) — creates a représentant with the dedicated role, lists scoped to the actor's company only (excludes plain staff and another company's représentant — real BelongsToCompany creating-hook trap found writing this test), `show` 404s for a non-représentant, update (branch/active status), role removal without deleting the user, BC creation accepts a registered représentant as `salesperson_id` and rejects a non-représentant with 422 |
| `tests/Feature/Gcom/GcomBlDeliveryLifecycleTest.php` | §13/§18 (2026-08-29/30) — a direct BL and a BC→BL conversion are both born `in_transit`; `confirm-delivery` transitions to `delivered` and sets `delivered_at`, rejects an already-delivered BL; `convert-to-invoice` rejects a still-`in_transit` BL and succeeds once delivered; cancelling an `in_transit` BL restocks immediately (locks in that `cancelDeliveryNote()` needed zero changes); `driver_info`/`transporter_name` stored on both direct BL creation and convert-to-bl; full lifecycle confirms stock deducts once (at creation) and settlement still only triggers at convert-to-invoice, unchanged; configurable `status: 'delivered'` at creation (both endpoints) skips `in_transit` entirely, still deducts stock, is immediately invoiceable, and rejects a subsequent `confirm-delivery` call; omitting `status` still defaults to `in_transit`. **2026-08-31**: `status: 'draft'` creates no number/no stock movement (`delivery_number` placeholder), `POST .../validate` draws the real number and deducts stock exactly once, can target `delivered` directly, rejects validating a non-draft BL, cancelling a draft does not restock, `draft` also honored on `convert-to-bl` |
| `tests/Feature/Gcom/GcomDeliveryNoteEditingTest.php` | BL editing (2026-09-01) — rejects add-line without `gcom-delivery-note-edit`; adding a line deducts stock and recomputes the BL's `total_amount` AND the order-level HT/TVA proxy; rejects a duplicate product; increasing/decreasing a line's quantity deducts/restocks exactly the delta; a manual discount on update requires `gcom-discount-line` (rejected without it); removing a line restocks it fully; removing the last line cancels the whole BL (and the order); rejects editing an already-invoiced or still-draft BL; the anti-loss-sale guard runs on BL edits too. **Global discount** (2026-09-01, UI team follow-up): rejected without `gcom-discount-global`; applied proportionally and flows through to the eventual invoice unchanged (`convert-to-invoice` after); re-applying a DIFFERENT value never compounds on a previous call (real bug caught and fixed here — see GcomDeliveryNoteService::setGlobalDiscount()); sending neither field clears a previously-applied discount, restoring the original total exactly |
| `tests/Feature/Gcom/GcomDirectInvoicePricingTest.php` | Manual negotiation extended to Comptoir/Facture Directe (2026-09-01) — `unit_price` override rejected without `gcom-price-override`; a manual override + line discount together compute the expected net total; a global discount is rejected without `gcom-discount-global` and, once granted, distributes correctly and lands on the created invoice (`invoice.items` count + total verified); the anti-loss-sale guard rejects a below-`pmp_cost` line and is bypassable with `gcom-loss-sale-override` |
| `tests/Feature/Gcom/GcomBlPayloadAlignmentTest.php` | 2026-08-27 — `delivery_date` on direct BL creation (`POST /delivery-notes`, previously convert-to-bl only, defaults to today when omitted, rejects malformed dates), `client_order_ref` stored on a BC and mirrored onto a direct BL + its underlying order, mirrored onto a direct invoice, and flows through the full BC→BL→Facture chain with no extra parameter needed on the conversion endpoints |
| `tests/Feature/Gcom/GcomMultiSoucheNumberingTest.php` | §17 multi-souche numbering (2026-08-25/26) — a credit sale via a declared/internal `PaymentTerm` draws from the matching branch series, internal and declared invoices advance separate counters (declared sequence stays gap-free), creating an internal-souche invoice fails loudly when the branch's internal series isn't provisioned (never falls back to declared), stock deducts and treasury settlement posts identically regardless of souche, explicit `souche_kind` override beats the `PaymentTerm` default on all three invoice-creation endpoints (Comptoir, BC→Facture, BL→Facture), invalid `souche_kind` rejected with 422, an unprovisioned branch's internal request returns a clean 422 on all three endpoints (not a 500) |
| `tests/Feature/CompanySalesModeTest.php` | `sales_mode` GET/PUT, default value, invalid-mode rejection, permission gate |
| `tests/Feature/Warehouse/InventoryCheckTest.php` | Generic (not GCOM-scoped) — inventaire lifecycle, included here since it shares `StockService`/`StockUpdateService` with GCOM |
| `tests/Feature/Warehouse/PurchaseReceptionValidationTest.php` | Generic — stock reception validate/reverse, same reason. **PMP (2026-09-01)**: a first reception adopts its own `unit_cost` as the PMP outright, a second reception at a different cost blends into the correct weighted average, a stock transfer (no cost involved) never touches the PMP |
| `tests/Feature/Invoicing/GeneratePeriodicInvoicesCommandGcomExclusionTest.php` | §11 "`invoicing_mode` not consulted in GCOM" (2026-08-31) — a GCOM BL for a `PERIODIC_FIN_DE_MOIS` partner is never swept into the legacy `invoices:generate-periodic` cron, a non-GCOM BL for the same partner still consolidates normally (regression guard), a mix of GCOM + non-GCOM BLs only ever consolidates the non-GCOM one |
| `tests/Feature/Gcom/GcomInvoicingModeTest.php` | §8/§11 "`invoicing_mode` wired into GCOM" (2026-08-31) — `1_FAC_PER_ORDER`: blocks convert-to-invoice with a clear pending-count 422 until every non-cancelled sibling BL is delivered, then consolidates all uninvoiced siblings into ONE invoice (callable from any sibling, idempotent on retry), real USER_CAISSE settlement happens, a cancelled sibling is never waited on or included, `payment_method` override is rejected. `PERIODIC_FIN_DE_MOIS`: convert-to-invoice always rejects on demand; `gcom:generate-periodic-invoices` consolidates only `canal='GCOM'` BLs for periodic partners, leaves a non-GCOM sibling for the legacy command |
| `tests/Feature/Gcom/GcomInvoiceConsolidationTest.php` | §8 `POST /invoices/consolidate` (2026-09-01) — consolidates 2 delivered BLs from DIFFERENT orders of the same partner into one invoice (real settlement, both orders' worth credited to the actor's caisse); rejects fewer than 2 ids, an unknown id, BLs from different partners, a not-yet-delivered BL, an already-invoiced BL; requires an explicit `payment_method` when the selected orders' natural methods disagree (succeeds once supplied); requires an explicit `souche_kind` when the selected orders' natural souches disagree (succeeds once supplied, draws from the right TokenSerie); still requires `instrument` details for a cheque settlement; still runs the real credit-limit check when overriding to credit |
| `tests/Feature/Invoicing/GeneratePeriodicInvoicesCommandGcomExclusionTest.php` | Re-verified 2026-09-01 after fixing `generatePeriodicInvoice()`'s dead `payment_term_id` read (see §8's consolidate section) — still correctly excludes GCOM BLs from the legacy monthly command, still consolidates a periodic partner's non-GCOM BLs normally |
| `tests/Feature/MasterDataBanksTest.php` | Generic (not GCOM-scoped) — `GET /masterdata/banks`, active-only + name-ordered, feeds the `bank_id` picker `POST /gcom/payments` needs |
| `tests/Feature/Payment/PaymentTransferMethodResolutionTest.php` | Generic (not GCOM-scoped) — `PaymentTransferService::registerPayment()`'s `payment_method_id` resolution order: term's own, cash-term auto-resolve takes priority over the partner's generic default, partner default for credit terms, and the single consistent error when nothing resolves |

188 tests total across `tests/Feature/Gcom/` + `tests/Feature/Warehouse/` +
`tests/Feature/Payment/` + `tests/Feature/Partners/` +
`tests/Feature/CompanySalesModeTest.php` passing together as of this doc —
run all of these together when touching any GCOM shared service, since
several (`CreditControlEngine`, `StockService`, `StockUpdateService`,
`LetteringService`) are also exercised by Payment/Partners/Warehouse
tests.

---

## 13. Status & Enum Reference

These `status`/`bc_status` columns are shared with the rest of the ERP
(SFA, POS, télévendeur) and carry many values GCOM never produces — a
`GET /orders/{order}` response is *never* going to come back
`pending_derogation` or `in_preparation`, for example, since GCOM has no
derogation workflow and no picking/loading pipeline. Building status
badges/filters against the full underlying enum would add dead code paths
for states that can't occur on this API surface. The tables below list
**only the values GCOM's own code paths actually set** — treat anything
else as belonging to a different channel's data, not a state your GCOM UI
needs to handle.

### `order.bc_status` (BC / Devis-converted-to-BC)

| Value | Meaning | Set by |
|---|---|---|
| `confirmed` | The only "active" state — GCOM BCs are confirmed immediately on creation, never draft | `GcomOrderBuilder::build()` |
| `cancelled` | Cancelled before any BL/invoice existed (whole-order or last-line cancel) | `GcomOrderService::cancelOrder()`/`cancelOrderLine()` |

### `deliveryNote.status` (BL)

**Changed 2026-08-29** ("FEU VERT TOTAL: CYCLE BL IN_TRANSIT -> DELIVERED")
— a BL is no longer born delivered for flows #4 (BC→BL) and #5 (BL
Direct): real distribution has goods physically leaving before a driver
confirms a signed delivery or a refusal. §18 has the full design writeup.

| Value | Meaning | Set by |
|---|---|---|
| `draft` | (2026-08-31) No `TokenSerie` number drawn, no stock deducted — `delivery_number` is a `DRAFT-{uuid}` placeholder | `POST /delivery-notes`/`convert-to-bl` with `status: 'draft'` |
| `in_transit` | Default initial state for flows #4/#5 — goods have left, delivery not yet confirmed. Stock is already deducted at this point (unchanged — see §3) | `GcomDeliveryNoteService` (`createDeliveryNoteFromOrder()`/`createDirectDeliveryNote()`, or `validateDraft()` from `draft`) |
| `delivered` | Delivery confirmed. Also directly selectable as the **initial** state (2026-08-30, `status: 'delivered'` on creation) for a counter/depot pickup with no real transit leg — either way, this is the only state a BL can be invoiced from | `GcomDeliveryNoteService::confirmDelivery()`, creation itself when `status: 'delivered'` is passed, or `validateDraft()` targeting `delivered` |
| `cancelled` | Cancelled before an invoice existed. Restocks — except from `draft`, which never deducted anything in the first place (plain abandon, no reversal); works from `in_transit` too, a recalled/refused delivery restocks exactly like any other cancellation | `GcomDeliveryNoteService::cancelDeliveryNote()` |

Flow #6 (Comptoir/`direct-invoices`) has no BL at all — this lifecycle
doesn't apply to it; that flow remains BC + stock-out + invoice in one
call, unchanged.

### `invoice.status`

| Value | Meaning |
|---|---|
| `pending` | Credit/transfer sale, not yet settled — real encours |
| `partially_paid` | Some règlement/avoir applied, balance remains |
| `fully_paid` | Cash/card at creation, or cheque/effet (instrument registered), or fully settled by règlement/avoir since |
| `overdue` | `pending`/`partially_paid` past its due date (background job, not GCOM-specific) |

### `quote.status`

| Value | Meaning |
|---|---|
| `draft` | Just created |
| `sent` | Not used by any GCOM endpoint today (present for parity with the shared `Quote` model) |
| `accepted` | Not used by any GCOM endpoint today |
| `expired` | Past `expires_at`, not converted |
| `converted` | Converted to an Order (`convert-to-order`) or Invoice (`convert`) — `Quote.converted_order_id` set for the order case |

### `credit_note.status`

| Value | Meaning |
|---|---|
| `APPROVED` | The only value GCOM produces — every avoir is auto-approved immediately, no derogation workflow |

*(`DRAFT`/`PENDING`/`REJECTED`/`CANCELLED` exist on the shared enum but
are never set by any GCOM code path.)*

### `payment_method` (request field, not a DB enum)

| Value | Settlement behavior (§4) |
|---|---|
| `cash` | Immediate — `fully_paid`, stamp duty applied |
| `card` | Immediate — `fully_paid`, no stamp duty |
| `cheque` | Instrument — `fully_paid` + pending `FinancialInstrument`, `instrument` object required |
| `effet` | Instrument — same as cheque |
| `credit` | Credit — `pending`, opens real encours, `payment_term_id` required (or partner default) |
| `transfer` | Credit — same as `credit` |
| `avoir` | (2026-08-31) Non-cash compensation — `fully_paid`, no Treasury movement, no credit check; `avoir_allocations` required at the 3 settlement endpoints (§8's "Avoir as a payment method") |

### `company.sales_mode`

| Value | Meaning |
|---|---|
| `GCOM` | This company operates GCOM back-office only (stored flag — nothing enforces it yet, see §11) |
| `SFA` | Field-sales only |
| `HYBRID` | Both (the default for every company unless set otherwise) |

---

## 14. Frontend Integration Notes

### Screen convention — Liste / Détail à onglets / Formulaire / Actions

**Standing rule for this doc and for every future GCOM UI spec written
here**: describe a screen using the same four building blocks the UI
team's existing screens already use (confirmed against the live "Bons
de livraison" screen, 2026-08-21) — never invent a new layout shape when
one of these four already fits.

1. **Liste (data)** — left panel (or full-width table): a data grid with
   status **filter tabs** at the top (e.g. `Tous` / `Livré` / `Annulé`
   on the BL screen), a **per-column filter row** under the header
   (small inputs/icons under each column), a search box, and a row count
   badge next to the screen title.
2. **Détail à onglets** — right panel (or a drill-in page) opened by
   selecting a row: a breadcrumb line (document code + status pill), a
   title (usually the partner/agency name) and subtitle (date + total or
   key figure), then a **tab bar** (e.g. `Informations` / `Lignes` /
   `Retours` on the BL screen) with icons. Under the active tab:
   collapsible sections, each opening with 2–3 **metric cards** in a row
   (e.g. `SOUS-TOTAL HT` / `TVA` / `TOTAL TTC`), and a **"Documents
   liés"** row of pill-shaped links to related documents (e.g. the BC
   and Facture a BL came from). A dismissible **alert banner** sits above
   the tabs when the record is in a state that constrains what can be
   done with it (e.g. "BL déjà facturé — utilisez l'avoir sur la facture
   liée").
3. **Formulaire (ajout / édition)** — a modal/popup for any action that
   needs input before it can run (a count, a reason, a reference number).
   Not a full page — the BL/BC/Facture screens never navigate away for
   this.
4. **Actions** — buttons scoped to the current row/detail (top-right of
   the detail panel or inline in the list), never a separate menu screen.

Every screen spec from here on (§16 in particular) is written in exactly
these terms — when a spec says "Liste", it's block 1 above; "Détail",
block 2; "Formulaire", block 3.

### Headers

| Header | Required on | Value |
|---|---|---|
| `Authorization` | every request | `Bearer <sanctum-token>` |
| `Accept` | every request | `application/json` (the API also forces this server-side, but send it) |
| `Content-Type` | `POST`/`PUT` requests | `application/json` |
| `X-Idempotency-Key` | every route marked 🔁 in §8 | a fresh UUID **per logical action** — see below |

Obtaining the bearer token is outside GCOM's scope (standard Sanctum
login flow elsewhere in this API) — once you have it, every call below
just needs it attached.

### Login response — deciding whether to show GCOM at all

`POST /api/backend/login` (outside `/gcom/*`, the normal login endpoint —
`LoginController::getUserCompleteData()`) now returns, alongside the
existing `user.roles`/`user.permissions`/`user.branch` fields:

```json
{
  "success": true,
  "user": {
    "...": "...",
    "company": { "id": 2, "name": "ORBIS DISTRIBUTION", "code": "ORBIS", "sales_mode": "GCOM" },
    "can": { "...": "...", "access_gcom": true }
  }
}
```

This is everything the UI needs at bootstrap, in the login response
itself — no second call:
- `user.can.access_gcom` (boolean) — whether this user actually holds
  `manage-gcom`. Gate the whole GCOM menu section on this, not on
  `sales_mode` alone — a `HYBRID` company can still have GCOM-only users
  and vice versa.
- `user.company.sales_mode` (`GCOM`|`SFA`|`HYBRID`) — the company-level
  default. Use it to decide the *default* landing view/menu emphasis, not
  as an access-control check (that's what `can.access_gcom` is for).

### Product picker with real partner pricing (HT/TVA/TTC)

`GET /api/backend/products` (generic catalog browsing) deliberately does
**not** resolve price list / partner-specific pricing — that's not its
job. For "pick a partner, then show what they'd actually pay for each
product," use the existing télévendeur catalog endpoint instead of
anything under `/gcom/*`:

```
GET /api/backend/telesales/catalog/products?partner_id={id}&search=&per_page=20
```

Requires the `televendeur.view_products` permission (granted to
`root`/`admin` — same as `manage-gcom`, so any GCOM admin already has it).
Response per product:

```json
{
  "id": 42, "code": "ORBIS-HV1L", "name": "Huile Végétale 1L",
  "price": 22.5, "price_source": "partner",
  "price_list": { "id": 3, "code": "ORBIS_STD", "name": "ORBIS — Tarif standard" },
  "tax_rate": 20.0,
  "stock_available": 498.0,
  "packagings": [...], "flags": {...}
}
```

- `price_source` is `"partner"` when `partner_id` was given and a real
  override/price-list price resolved, `"generic"` otherwise (list price
  fallback) — use this to decide whether to show "prix standard" vs "prix
  négocié" in the UI.
- `price` is already TTC. `tax_rate` (%) is what you need to back out
  HT: `price_ht = price / (1 + tax_rate/100)`.
- `partner_id` is optional — omit it to browse the catalog before a
  partner is selected; the response shape doesn't change, only
  `price_source` flips to `"generic"`.
- This is the **same underlying pricing engine** (`PartnerProductPriceResolver`)
  every GCOM document (Devis/BC/BL/Facture) uses server-side — the price
  you show here is the price that endpoint will actually charge.

**`stock_available` was silently always `0` for GCOM stock — fixed
2026-08-17.** Real bug: this endpoint's stock lookup (shared with the SFA
télévendeur channel) preferred a warehouse's storage-location codes over
its own bare code whenever ANY active sellable/depot `StorageLocation` was
configured for that warehouse — correct for SFA's own convention, but
GCOM's stock (`StockService::deductForDirectSale()`, `GcomContextResolver`,
and manually-entered stock) is always written under the warehouse's bare
code, with no location granularity. If a warehouse happened to also have
a storage location configured for an unrelated WMS reason, every product's
real stock became invisible in this response. Now queries both the bare
warehouse code and any location codes — no client-side change needed,
`stock_available` just reflects real numbers now.

**`stock_available` also over-counted `DAMAGED` stock for users with no
resolvable warehouse — fixed 2026-08-20.** Real bug, reported directly
from live data (a product showing `stock_available: 11` when its only
non-damaged stock was 0 — the "11" was 10 units sitting in a `DAMAGED`
storage location plus 1 unit from an unrelated data-integrity gap, see
next paragraph). `bulkStock()` has two paths: when a warehouse code
resolves (van, user, or branch `primary_warehouse_id`), it already
filtered correctly to `SELLABLE`/`DEPOT` locations. Its **fallback**
path — hit whenever nothing resolves, e.g. a télévendeur/GCOM user on a
branch with no `primary_warehouse_id` set, which is the common case —
had no filtering at all and summed every `stocks` row for the branch
regardless of condition. Fixed to apply the same `SELLABLE`/`DEPOT`
(or general-bucket, `storage_location_id IS NULL`) filter on that path
too. No client-side change needed.

**Companion data bug, same investigation**: `stocks.company_id` was
added nullable with no backfill (`2025_12_06_080625_add_company_id_to_
core_tables.php`), and `BelongsToCompany` only auto-fills it when an
authenticated user is present at row-creation time — any row written by
a seeder/console command landed with `company_id = NULL`. `CompanyScope`'s
`company_id IS NULL OR company_id = :company` clause then pulled those
orphan rows into **every** tenant's stock aggregate (invisible to a
company-scoped `SELECT`, but still summed into the API response — this
is where the "+1" in the "11" above came from). Backfilled via
`branch_id → branches.company_id` (migration
`2026_08_31_110000_backfill_null_company_id_on_stocks`); 9 orphan rows
found and fixed company-wide as of this write-up.

### Idempotency keys — how to generate them correctly

Every mutating GCOM endpoint (all `POST` routes) requires
`X-Idempotency-Key`. **Generate a new UUID per user action** (e.g., per
"Valider" button click), not once per app session and not once per
screen load. If the same key is replayed (e.g., a retried request after a
network timeout), the server returns the **original** response instead of
re-running the action — this is what makes "double-click on submit" or
"retry after timeout" safe. Reusing a key across genuinely different
actions (e.g., hardcoding one key for a whole session) will make the
second action silently return the first action's stale result.

### Response envelope

Every endpoint responds with a top-level `success: boolean`. On success,
the created/updated resource is under a **named** key matching the
resource type — never a generic `data`:

```json
{ "success": true, "message": "Invoice created", "invoice": { ... } }
```

List endpoints wrap results in Laravel's standard paginator shape, under
the resource's plural name:

```json
{
  "success": true,
  "orders": {
    "current_page": 1,
    "data": [ { "id": 1, "..." : "..." }, ... ],
    "per_page": 20,
    "total": 47,
    "last_page": 3,
    "next_page_url": "...?page=2",
    "prev_page_url": null
  }
}
```

### Status codes

| Code | Meaning | Body |
|---|---|---|
| `200` | Success (GET, or a mutation that doesn't create a new resource — e.g. cancel) | `{ success: true, ... }` |
| `201` | Success, a new resource was created (order/invoice/quote/BL/credit-note/payment) | `{ success: true, ... }` |
| `403` | Missing `manage-gcom` permission, or a quote belonging to a different user | Laravel's default 403 body (not the `{success:false}` shape) |
| `404` | Resource doesn't exist, **or** it exists but isn't a GCOM document (e.g. an SFA invoice ID passed to a GCOM endpoint — every `show`/`convert`/`cancel` endpoint checks `canal === 'GCOM'` and 404s otherwise, indistinguishable from a truly missing ID) | Laravel's default 404 body |
| `422` | Validation failure **or** a domain rule rejection (credit limit exceeded, wrong document state for the action, etc.) — same status code for both, distinguish by reading `message` | `{ success: false, message: "..." }` |
| `422` (idempotency) | `X-Idempotency-Key` missing on a 🔁 route | Idempotency middleware's own error body |

There is no `400` in normal use and no `500` in any tested path — a
`500` means a real bug, not a UI-side mistake to handle gracefully.

### `orderProduct` id gotcha (line cancel/update)

`POST /orders/{order}/lines/{orderProduct}/cancel` and
`PATCH /orders/{order}/lines/{orderProduct}` both need the `OrderProduct`
row's own `id` (not the product's id) as `{orderProduct}`.

**Real bug, fixed 2026-08-15**: this doc previously claimed `GET
/orders/{order}` exposed a flat `order.products[].id` for this — it
didn't. Every GCOM order response (`POST /orders`, `GET /orders/{order}`,
and the `order` object returned by the cancel-line/update-line endpoints
themselves) loads the same `products` belongs-to-many relation, and
`Order::products()`'s `withPivot([...])` never listed `id`, so Laravel
never hydrated it — `pivot.id` was `undefined` everywhere, not just on
one endpoint. One consistent shape now, everywhere:

```
order.products[].id        → the Product's own id (name, code, etc. live at this level)
order.products[].pivot.id  → the OrderProduct row's id — THIS is what {orderProduct} wants
```

### Practical integration order

If building GCOM screens from scratch, this is the dependency order that
avoids dead ends (mirrors the backend setup order in
`docs/modules/29-gcom-onboarding-orbis-distribution.md`):

1. Partner picker (needs `GET /masterdata/partners` or similar — outside
   GCOM's own routes, see the main partner CRUD docs).
2. Product picker (same — outside GCOM's own routes).
3. Comptoir screen → `POST /direct-invoices` (flow #6) — the simplest
   flow, good first integration target, exercises pricing/stock/credit/
   stamp-duty all at once.
4. BC screen → `POST /orders`, `GET /orders`, `GET /orders/{order}`.
5. BC → BL/Facture conversion buttons → `convert-to-bl`/`convert-to-invoice`.
6. Devis screen → `POST /quotes` + its two convert endpoints.
7. Règlement screen → `GET /partners/{partner}/open-invoices` +
   `POST /payments`.
8. Cancellation/avoir actions layered onto the BC/BL/Invoice detail
   screens once the create/convert flows work.

---

## 15. Getting a Test Tenant — GcomDatabaseSeeder

For frontend development against a real, working GCOM dataset without
touching production/shared demo data:

```bash
php artisan db:seed --class=GcomDatabaseSeeder
```

Provisions an isolated company (**ORBIS DISTRIBUTION**, `sales_mode=GCOM`)
with everything needed to hit every endpoint in §8 immediately:

- 1 branch + central warehouse (`ORBIS-CAS`)
- A working token series (document numbering)
- Payment terms: cash + two credit terms (30j, 60j fin de mois)
- An admin user: `admin@orbis.ma` / `orbis2026` — has `manage-gcom`
- 3 products with stock in the central warehouse
- 3 B2B partners, each with a fixed-price override on every product and a
  financial profile (credit limit) so credit sales work immediately

Idempotent — safe to re-run any time without creating duplicates or
resetting anything. Doesn't touch existing data outside its own rows
(`company_id`-scoped where the schema supports it — see the seeder's own
comments for the one caveat around `BelongsToCompany`'s auto-fill only
applying to authenticated-user contexts, not seeders).

Quick manual smoke test once seeded:
```bash
curl -X POST https://<host>/api/backend/gcom/direct-invoices \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: $(uuidgen)" \
  -d '{"partner_id": <ORBIS-CLI-001 id>, "items": [{"product_id": <ORBIS-HV1L id>, "quantity": 2}], "payment_method": "cash"}'
```
Look up the actual partner/product ids first — `select id, code from
partners where company_id = (select id from companies where code =
'ORBIS');` and the equivalent for `products`.

---

## 16. Treasury Integration — Individual Caisses (Caisses Individuelles)

**Audience**: this section is written for whoever builds the admin
"Gestion Trésorerie" back-office screen — it's self-contained, same as
§8/§13–15.

**2026-08-20+ (caisses individuelles) — reverses this section's original
decision.** GCOM originally routed every settlement into one shared
`TYPE_BRANCH_CAISSE` journal per (branch, payment method) — see "Why a
journal per branch, not per user" below for the reasoning at the time.
Reversed after real multi-vendeur feedback: even inside a single agency,
every person who physically handles money carries their own financial
responsibility — a shared branch till makes individual discrepancy
accountability and end-of-day session closure impossible. GCOM now
targets the **acting user's own `TYPE_USER_CAISSE` journal**, same model
SFA already used; `TYPE_BRANCH_CAISSE` becomes a pure **coffre**,
receiving only closure transfers from user caisses, never a direct
settlement. The historical rationale is kept below for context, followed
by the current routing.

### Why this existed (2026-08-20, historical)

Before 2026-08-20, GCOM had **zero footprint** in the ERP's pre-existing
Treasury engine (`treasury_journals`, `treasury_intake_lines`,
`treasury_transfers`, `treasury_ledger_entries`, `treasury_audit_logs`,
`treasury_transfer_routes`) — a comptoir cash/cheque sale closed the
invoice and wrote a `payment_transfers`/`letterings` row (§4/§6's
"Treasury unification", 2026-08-15), but never touched a Treasury table
at all. Surfaced when the UI team's already-built "Chèques & Effets"
screen (a per-partner view, §8's Financial Instruments section) prompted
the question: does GCOM feed the *real* company-wide trésorerie an
accountant would reconcile against? It didn't.

### Why a journal per branch, not per user (2026-08-20, superseded below)

The Treasury engine's existing model (`TreasuryJournal.type =
USER_CAISSE`) is built around an individual field agent physically
holding cash — a vendeur terrain collects a payment, it lands in *their*
personal caisse (`C{user_code}{method_suffix}`), and they later transfer
it to a desk/bank journal. GCOM's comptoir/back-office channel has no
such agent: whoever is logged into the back office records a sale, but
the money conceptually belongs to the **branch**, not to that particular
admin. Forcing GCOM through `USER_CAISSE` would have meant either a
fictional "cashier" user per branch, or every admin who ever touches a
till accumulating a personal caisse that means nothing operationally.

Decision (confirmed 2026-08-20, **reversed 2026-08-20+** — see the
callout at the top of §16): a new journal type, `TYPE_BRANCH_CAISSE` —
one journal per **(branch, payment method)**, shared by everyone who
transacts at that branch. `TreasuryJournal.user_id` is `null` on these
rows (same as the pre-existing `TYPE_BANK_ACCOUNT`); `branch_id` is the
source of truth instead.

### Caisses individuelles (2026-08-20+, current) — why the reversal

Real feedback from the field: "même dans une seule agence, dès qu'il y a
2 personnes (ou le patron + un vendeur), chacun a son propre
tiroir-caisse et sa propre responsabilité financière." A shared branch
caisse made two things impossible that a real multi-vendeur agency
needs: (1) individual discrepancy accountability at end of day (a
counted-vs-theoretical gap is meaningless when 3 people fed the same
till), and (2) a real end-of-day session per person. Individual
traceability of *who* collected *what* was never actually missing (every
`TreasuryIntakeLine`/`TreasuryAuditLog` always carried `created_by` =
the real actor) — what was missing was per-person **ownership** of the
money and its own closure session.

**Routing**: every GCOM settlement (immediate sale, deferred règlement,
avoir cash-out redemption) now targets the **acting user's own**
`TYPE_USER_CAISSE` journal — same model, same code pattern
(`C{user_code}{method_suffix}` / `CU{user_id}{method_suffix}` fallback),
SFA already used for field agents. `TYPE_BRANCH_CAISSE` survives as the
**coffre** — the agency's safe, fed only by end-of-day closure transfers
from user caisses (see "Clôture de caisse et versement au coffre"
below), never by a direct settlement again.

**Provisioning — deliberately NOT auto-vivified at settlement time.**
Unlike SFA's `TreasuryJournalService::findOrCreate()` (silently creates a
journal on first use), a GCOM user caisse must already exist and be
`is_active` before any settlement — `TreasuryIntakeService::
seedFromGcomUserSettlement()` only ever looks it up, never creates one.
An unprovisioned or deactivated caisse rejects the settlement outright:

```json
{ "success": false, "message": "Aucun journal de caisse actif n'est assigné à votre compte utilisateur pour cette agence." }
```
HTTP 422, `NoCaisseAssignedException` (`TREASURY_NO_CAISSE_ASSIGNED`).

Provisioning itself is automatic, just not at settlement time:
`ProvisionUserJournalsJob` (dispatched on `UserObserver::created()`)
grants `ESP`/`CHQ`/`EFF`/`VIR` to any user with the `manage-gcom`
permission — GCOM already supports all four as real settlement methods
(cash, cheque/effet at sale, card immediate, VIR also used for a
deferred transfer règlement), so all four are provisioned, not just
cash/cheque. Existing GCOM accounts created before this shipped were
backfilled once via migration
(`2026_08_31_120000_provision_gcom_user_caisses`) — nothing an admin
needs to trigger manually for accounts created going forward.

### How it's populated (automatic, no UI action needed)

Every **immediate** GCOM settlement — cash, card, cheque, effet, across
Facture Directe (§8's Direct Invoice), BC→Facture, and BL→Facture — seeds
a `TreasuryIntakeLine` into the **acting user's own** `TYPE_USER_CAISSE`
journal for that payment method, as a side effect of the same
`GcomInstrumentRegistrar::recordSettlement()` call that already writes
the `payment_transfers`/`letterings` row (§4/§6). This is entirely
backend-internal — no new request/response shape on any endpoint you
already call.

- The caisse follows the **acting user**, not the order's own branch —
  reversed from the 2026-08-20 branch-caisse design's explicit safeguard
  (an admin from branch A converting an order created at branch B used
  to correctly credit B's caisse, not A's). With individual caisses that
  safeguard is moot: the person physically doing the conversion is the
  one who'd hold the cash regardless of which branch the order
  originated from — consistent with "chacun sa responsabilité
  financière."
- Payment method → Treasury `method_suffix` mapping: `cash→ESP`,
  `cheque→CHQ`, `effet→EFF`, `card→VIR`. `VIR` for card is deliberate —
  Treasury's vocabulary has no caisse-suffix for "card payment" (no
  physical drawer holds it, it settles straight to a bank account via
  the TPE), so it's grouped with virement, the closest real category.
- Credit and transfer sales create **no** intake line at the moment of
  the sale (same as they create no `payment_transfers` row — genuinely
  open account exposure, nothing has actually been paid yet). Once
  settled later through §6's règlement, **that** does create an intake
  line — see "Deferred règlement" below.
- An avoir cash-out refund (`POST /credit-notes/{id}/redeem`, §8) also
  routes through the actor's own caisse as a **negative** entry — the
  person handing the customer their refund is the one whose drawer it
  comes out of, same reasoning as an incoming settlement.
- User caisse journal codes are `C{user_code}{method_suffix}` (or
  `CU{user_id}{method_suffix}` when `users.code` is empty/collides) —
  same pattern SFA journals already use, `TreasuryJournalService::
  findOrCreate()`. The coffre (`TYPE_BRANCH_CAISSE`, fed only by closure
  transfers now) keeps its own `BC{branch_id}{method_suffix}` code (e.g.
  `BC5ESP`, renamed from a bare `B{branch_id}{method_suffix}` on
  2026-08-31 — see §10's "instrument → 404 on all 3 invoicing endpoints"
  entry) — keyed on the numeric branch id, not the branch's human code,
  to guarantee a short, collision-free code regardless of how long a
  real branch code is (`treasury_audit_logs`/
  `treasury_ledger_entries.journal_code` are `varchar(20)`, partitioned
  tables — not worth widening for a value that doesn't need to be
  human-derived).

### The admin API — already fully built, not GCOM-specific

The Treasury engine already has a complete admin Finance API
(`routes/backend.php`, prefix `/api/backend/finance/*`, pre-existing —
built for field-terrain trésorerie, generic across every journal type
including the new `BRANCH_CAISSE` one). **Nothing new needs to be built
backend-side to view or transfer GCOM branch caisses** — the "Gestion
Trésorerie" screen is a pure frontend build against this existing
surface, filtered to GCOM's journals.

Permissions: `permission:browse-finance` gates the whole `/finance/*`
group; `manage-finance-journals`, `manage-finance-transfers`,
`adjust-finance-ledger`, `reconcile-settlements` gate the mutating
actions within it. The `GcomDatabaseSeeder` `admin@orbis.ma` user already
has all five (`root`/`admin` get them by default, `DynamicRbacPermissionsSeeder`)
— nothing to unblock before building against this.

**Journals**

`GET /api/backend/finance/journals?type=BRANCH_CAISSE` — filters:
`branch_id`, `method_suffix` (`ESP`/`CHQ`/`EFF`/`VIR`/`VER`), `type`,
`active_only`, `search` (matches on `code`), `per_page`. Each row is
enriched with **computed** balances (never the raw cache — always
recomputed from full transaction history):
```json
{
  "id": 12, "code": "BC5ESP", "type": "BRANCH_CAISSE", "method_suffix": "ESP",
  "user_id": null, "branch_id": 5, "branch": { "id": 5, "code": "ORBIS-CAS", "name": "..." },
  "currency": "MAD", "cached_balance": "628.00", "is_active": true,
  "computed_balance": 628.00, "transit_balance": 0.00, "available_balance": 628.00
}
```
`GET /api/backend/finance/journals/{id}` — same shape, single row.
No `POST` needed for a `BRANCH_CAISSE` journal — it provisions itself
automatically on the first settlement at that branch+method, same
idempotent `findOrCreate` pattern as everything else in this engine.
`POST /api/backend/finance/journals` with `type: "BANK_ACCOUNT"` is for
the one-time setup of a bank destination journal (see the Transfers
subsection below) — not something GCOM's own comptoir flow ever calls.

`PUT`/`PATCH /api/backend/finance/journals/{id}` — `{ is_active?,
currency?, bank_name?, rib? }`. `bank_name`/`rib` only editable on a
`BANK_ACCOUNT` journal (`422 FINANCE_NOT_A_BANK_ACCOUNT` otherwise).
Deactivating (`is_active: false`) is blocked with a `422` (
`FINANCE_JOURNAL_HAS_BALANCE` / `FINANCE_JOURNAL_HAS_TRANSIT`) while the
journal still has a real balance or funds in transit — transfer them out
first. `code`/`user_id`/`type`/`branch_id`/`method_suffix`/
`cached_balance` are never editable (accounting identity).

**Transfers — moving a branch caisse's cash to a bank account**

`GET /api/backend/finance/transfers` — filters: `status` (1–5),
`source_journal_id`, `dest_journal_id`, `journal_code` (either side),
`from_date`/`to_date`, `created_by`.

`POST /api/backend/finance/transfers` 🔁 — request a transfer out of a
branch caisse:
```json
{
  "source_journal_id": 12,
  "dest_journal_id": 3,
  "amount": 628.00,
  "transfer_type": "BANK_DEPOSIT",
  "versement_reference": "VER-2026-0091",
  "bank_name": "Attijariwafa Bank",
  "deposit_date": "2026-08-20",
  "note": "Versement quotidien ORBIS-CAS"
}
```
- `transfer_type` optional, `DIRECT` (default) or `BANK_DEPOSIT` — the
  latter is for an `ESP` source going to a bank/`VER` journal and
  expects `versement_reference`/`bank_name`/`deposit_date`.
- `intake_line_id` — **required** when the source is `CHQ` or `EFF` (a
  cheque/effet is not divisible — the transfer moves one specific
  physical instrument, not an arbitrary amount out of a pooled balance).
  Pick it from `GET /api/backend/finance/intake-lines?journal_id=X&untransferred_only=true`.
- Only source→dest **suffix** pairs present in
  `GET /api/backend/finance/transfer-routes` are allowed — already
  seeded for every GCOM deployment (`ESP→ESP`, `ESP→VER`, `CHQ→CHQ`,
  `EFF→EFF`, `VIR→VIR`; `TreasuryTransferRoutesSeeder`, no longer
  SFA-only-excluded as of 2026-08-20). `dest_journal_id` for the bank
  side needs a real `TYPE_BANK_ACCOUNT` journal to exist first — create
  one via `POST /api/backend/finance/journals` with `type: "BANK_ACCOUNT"`
  if this deployment doesn't have one yet (one-time setup, not a
  per-transfer step).

`POST /api/backend/finance/transfers/{id}/approve` 🔁 — `{ comment?,
confirmed_amount? }`. Applies the balance deltas on both journals and
**auto-generates the double-entry `treasury_ledger_entries` pair**
(Plan Comptable Marocain: `ESP→5161`, `CHQ→5113`, `EFF→3425`,
`VER`/`VIR→5141`) — this is the only place a real ledger entry is ever
created; an intake line alone never produces one. Returns both the
updated transfer and the generated ledger rows.

`POST /api/backend/finance/transfers/{id}/reject` 🔁 — `{ reason }`
required, releases the transit hold.

**Read-only views**

- `GET /api/backend/finance/ledger` — the double-entry book itself.
  Filters (same shape as every other list here, checked against
  `FinanceLedgerController`): journal/date/period — treat it as a plain
  paginated feed, no GCOM-specific filter needed on top.
- `GET /api/backend/finance/intake-lines?journal_id=X` — every
  settlement that filled a given caisse, traceable back to `order_id`.
- `GET /api/backend/finance/audit-logs?journal_code=B5ESP` — full
  operations trail (every intake, transfer request/approve/reject,
  auth check, caisse open/close) for one journal.
- `GET /api/backend/finance/helpers/branches`, `/helpers/methods`,
  `/helpers/users` — for the screen's filters/dropdowns. `/helpers/users`
  exists for SFA's per-vendeur journal pickers — GCOM's own screens have
  no use for it (a `BRANCH_CAISSE` journal has no `user_id`), listed here
  only so nothing in the Finance API goes undocumented.

**Ledger adjustment (compensating entry)** — `POST
/api/backend/finance/ledger/{entryId}/adjust`, gated by
`adjust-finance-ledger` (already granted, see above). Posts a
compensating counter-entry against a specific `treasury_ledger_entries`
row — the original is never modified or deleted (same append-only
philosophy as `voidIntakeLine()`). This exists for correcting a ledger
row after the fact (e.g. a transfer approved with the wrong amount) —
not part of GCOM's day-to-day flow, but the only way to fix a posted
ledger entry if one is ever found wrong. Not something to build a
dedicated GCOM button for unless an actual correction workflow is
requested; documented here for completeness.

**Transfer routes — admin configuration, not a day-to-day screen** —
`POST`/`PUT /api/backend/finance/transfer-routes` (`PUT` needs `{id}`),
gated by `manage-finance-transfers`. Creates or edits an allowed
source→destination suffix pair (`description`/`is_active` only —
the suffix pair itself is the route's identity, not editable once
created; recreate instead of repointing). The 5 defaults ORBIS needs
are already seeded (§16's own intro) — this is only relevant if a new
suffix pair is ever needed, not a screen the comptoir/back-office
workflow requires.

**`/finance/settlements/*` (`FinanceSettlementController`) — exists,
not applicable to GCOM.** `GET /settlements`, `GET /settlements/{id}`,
`POST /settlements/reconcile` — SFA's end-of-tour cash reconciliation,
built entirely around `WorkSession`/`VendorSettlement` (a field vendor
physically returning cash to a cashier). GCOM has no `WorkSession`
anywhere, so these three don't apply to any GCOM screen — listed here
only so the Finance API's full endpoint surface is on record; GCOM's own
equivalent is the Clôture de caisse subsection below, a completely
separate mechanism.

### Suggested screen shape

Follows §14's Liste/Détail/Formulaire/Actions convention:

- **Liste** — one row per caisse (`GET /finance/journals?type=BRANCH_CAISSE`),
  filter tabs `Toutes` / `Actives` (`active_only`), a filter row for
  `branch_id`/`method_suffix`, columns: agence, moyen de paiement, solde
  disponible.
- **Détail à onglets** — clicking a row opens: breadcrumb (journal code +
  active/inactive pill), title = agence name, subtitle = moyen de
  paiement. Tabs: `Informations` (metric cards `Théorique` /
  `Transit` / `Disponible`, from `computed_balance`/`transit_balance`/
  `available_balance`), `Historique des clôtures` (§16's closure
  subsection — a `Liste` in its own right), `Grand livre` (`GET
  /finance/ledger?...`), `Encaissements` (`GET
  /finance/intake-lines?journal_id=X`).
- **Actions** (top of the détail panel) — "Transférer vers la banque"
  (opens the transfer **Formulaire** below) and "Clôturer" (§16's own
  closure subsection).

This is the same screen a field-terrain trésorerie view would need —
just filtered to `type=BRANCH_CAISSE` and, for a GCOM-only tenant,
effectively the whole `/finance/journals` list.

**Transfer Formulaire** (opened by the "Transférer vers la banque"
action): `source_journal_id`/`amount` pre-filled from the caisse being
viewed, `dest_journal_id` (bank account picker), `transfer_type`,
`versement_reference`/`bank_name`/`deposit_date` when `BANK_DEPOSIT`,
`intake_line_id` picker (required, CHQ/EFF only) — submits to
`POST /finance/transfers` (§ above).

### Instrument reject reverses the settlement (built 2026-08-20)

Rejecting a cheque/effet (`POST .../financial-instruments/{id}/reject`,
§8) reopens every invoice its settlement touched and pulls the amount
back out of the caisse it landed in (the actor's own user caisse as of
2026-08-20+) — see §8's "Financial Instruments" section for the full
behavior. Nothing new to call from the UI; this is a side effect of the
existing `reject` endpoint.

### Clôture de caisse (Z de caisse) — built 2026-08-21

PRIORITÉ 2 of the trésorerie cadrage. New table
`treasury_journal_closures` — one row per **(journal, business_date)**.
A mechanism with the right *shape* already existed
(`VendorSettlement`/`FinanceSettlementController::reconcile()` —
counted-vs-theoretical, gap posting, session lock) but it's built
entirely around SFA's `WorkSession` (a field vendor physically returning
cash to a cashier); GCOM has no `WorkSession`, so that endpoint doesn't
apply here. This is the GCOM-shaped equivalent, independent of it.

**Lifecycle**: `OPEN` → `CLOSED`, one active session per journal per day.
- **Opening** — explicit via `POST .../closures/open`, but also
  **auto-provisioned** on the first settlement of the day if nobody
  opened one yet (same self-provisioning philosophy as the journals
  themselves). `opening_balance` is the journal's computed balance at
  that moment.
- **Closing** — `POST .../closures/{closure}/close` with
  `{ counted_balance, notes? }`. `theoretical_closing_balance` is simply
  the journal's `computeBalance()` at the moment of closing — no separate
  date-windowed sum needed, since closures are sequential and nothing is
  ever backdated, the cumulative balance already **is** the day's
  theoretical figure. `discrepancy = counted_balance - theoretical_closing_balance`
  (validated sign convention: positive = surplus, negative = shortage).
  **Never auto-corrects `treasury_journals.cached_balance`** — a
  discrepancy is recorded and reportable, not silently applied, keeping
  the append-only invariant the whole engine is built on. If real
  correction is needed, that's a manual/accounting decision outside this
  system, not an automatic side effect of closing.

**Strict same-day lock (validated, not just anti-backdating)**: once a
journal's session is `CLOSED` for today, **every new GCOM settlement on
that journal is blocked** — not just retroactive entries. Guarded at the
single choke point, `TreasuryIntakeService::seedFromGcomUserSettlement()`
(2026-08-20+ caisses individuelles — was `seedFromGcomBranchSettlement()`
before), so it covers comptoir, BC→Facture and BL→Facture in one place. A
blocked attempt returns `422`:
```json
{ "success": false, "message": "Caisse CU15-ESP clôturée pour la date du 2026-08-21. Aucune nouvelle opération autorisée jusqu'à la prochaine ouverture." }
```
The lock is **per journal**, not per branch — closing the `CHQ` caisse
doesn't block `ESP` sales at the same branch, and (2026-08-20+) closing
one user's caisse never blocks another user's, or the branch coffre's,
own sessions. **UI implication**: closing
a caisse mid-day (by mistake or on purpose) stops that specific payment
method's GCOM sales at that branch until the next day's session opens —
show this message directly rather than a generic error, since it's an
expected/intentional state, not a bug.

**Endpoints** (`/api/backend/finance/journals/{journal}/closures/*`,
same permissions as the rest of the Finance API, no new RBAC surface):
`GET` (list, filterable by `business_date`/`status`, `browse-finance`),
`GET /{closure}` (the "Z de caisse" report itself, `browse-finance`),
`POST /open` (idempotent, `manage-finance-journals`),
`POST /{closure}/close` (`manage-finance-journals`),
`POST /{closure}/correct` (`adjust-finance-ledger` — see below).

**Correcting a CLOSED session (built 2026-08-22)** — `POST
/{closure}/correct`, body `{ counted_balance, reason }` (`reason`
required, unlike `close()`'s optional `notes`). Fixes a wrong
`counted_balance` after the fact (e.g. a typo caught the next day) —
before this there was no way to fix a closed session's count short of
editing the database directly, a real gap rather than a deliberate
pause (unlike the two "not built" items below). Gated by
`adjust-finance-ledger`, not `manage-finance-journals` — deliberately
narrower, same permission as the analogous "fix something already
posted" action on the ledger (`POST /finance/ledger/{entryId}/adjust`).

`theoretical_closing_balance` is **never** recomputed by a correction —
it's frozen at the moment that day was originally closed; recomputing
it now would silently fold in every transaction from every day since,
which isn't what fixing a typo means. Only `counted_balance` (the human
input) and its `discrepancy` change. The very first submitted count
survives forever in `original_counted_balance`/`original_discrepancy`
(set once, on the first correction only — a second correction updates
`counted_balance` again but never touches these two) — read them to
show "corrigé, valeur d'origine : X" on the Z de caisse report. Every
correction (who, when, why, before/after) is also logged to
`treasury_audit_logs` (`CAISSE_CLOSURE_CORRECTED`) regardless of how
many times it happens.

**Screen shape** (§14 convention):
- **Liste** — inside the caisse's `Détail` panel (previous subsection),
  as the `Historique des clôtures` tab: one row per business day,
  columns `business_date`/`status`/`counted_balance`/`discrepancy`, a
  `Toutes` / `Ouvertes` / `Clôturées` filter tab row. Add a small
  "corrigé" indicator on any row where `correction_count > 0`.
- **Formulaire — Clôturer** (action available while `status = OPEN`):
  `Montant compté` (required), `Notes` (optional, make it visually
  prominent whenever a discrepancy appears once submitted). Show the
  current theoretical balance (from the caisse's own `Détail` metric
  card) above the field for reference before the user types the real
  count.
- **Formulaire — Corriger** (action available while `status = CLOSED`):
  same `Montant compté` field, plus `Motif` — **required**, make that
  visually clear (unlike the closing form's optional notes). Show the
  currently recorded `counted_balance` (and `original_counted_balance`
  if `correction_count > 0`) above the field so the user can see exactly
  what they're changing.
- **Détail** — clicking a row in the `Historique` opens the "Z de
  caisse" report itself (`GET .../closures/{closure}`): three metric
  cards `Théorique` / `Compté` / `Écart` (colour the écart card —
  positive in the same tone as a credit/surplus, negative like a
  debit/shortage). If `correction_count > 0`, add a small correction
  panel: original count, current count, who/when/why for the latest
  correction (`last_corrected_by`/`last_corrected_at`/
  `last_correction_reason`).
- **Actions** — "Ouvrir" (only while no session exists yet for today),
  "Clôturer" (only while `status = OPEN`), "Corriger" (only while
  `status = CLOSED`).

**Batch-closing a whole branch (built 2026-08-22)** — `POST
/api/backend/finance/branches/{branch}/closures/close-all`, body
`{ counts: [{ journal_id, counted_balance, notes? }, ...] }`,
`manage-finance-journals`. Closes every listed journal's OPEN-today
session in one call — pure ergonomics (closing ESP/CHQ/EFF/VIR one at a
time, every day, for every branch, is real recurring friction with no
safety trade-off; each journal still gets counted and audited
individually, nothing about the per-journal invariants changes).

**Best-effort, not all-or-nothing**: one journal failing doesn't block
the others. Response shape: `{ closed: [...closures], skipped:
[journal_id, ...], errors: [{journal_id, message}, ...] }`. A journal
with no OPEN session for today (never provisioned — no settlement
happened on it yet, or already closed by someone else) lands in
`skipped`, not `errors` — that's a normal, expected case, not a fault.
Always returns `200` — read `closed`/`skipped`/`errors` in the body
rather than the HTTP status to know what actually happened.

Screen shape: an extra "Clôturer tout" action at the branch level (not
per-journal) opens a **Formulaire** listing every currently-`OPEN`
journal for that branch (from the existing `GET /finance/journals?
branch_id=X&type=BRANCH_CAISSE` list, §"The admin API" above) with one
`Montant compté` input per row, submitted together. After submit, show
which closed and which were skipped/errored inline — don't just show a
single success toast, since a partial result is a real, expected
outcome here.

**Not built** (out of scope, deliberate, not an oversight): no time
limit on when a correction can be made (any `CLOSED` session, regardless
of age, can be corrected — not restricted to "today" or "yesterday").

### Deferred règlement (built 2026-08-21, routing updated 2026-08-20+)

The last structural gap: §6's `POST /payments` (a règlement collected
weeks after a credit sale) also seeds a `TreasuryIntakeLine`, exactly
like an immediate settlement — every GCOM payment method that produces
real money in hand (cash, cheque, effet, virement) shows up in
`/finance/intake-lines` and a journal's balance, regardless of whether it
was collected at the counter or weeks later.

**Routing (2026-08-20+)**: the intake line lands in the **collecting
actor's own `TYPE_USER_CAISSE`** — same caisse an immediate settlement
by that user would credit. Before the caisses-individuelles bascule this
used the collecting actor's own BRANCH (not an order's branch, since a
règlement is partner-level and can letter across invoices from different
branches) — that branch-resolution step is no longer needed at all now
that the caisse follows the person, not a branch lookup.

`GcomInstrumentRegistrar::recordDeferredSettlement()` is the entry
point, called from `GcomPaymentController::store()` right after
`registerPayment()`/`validatePayment()` and before
`registerForPaymentTransfer()` (so the resulting intake line's id can be
threaded onto the `FinancialInstrument`'s `metadata`, same as the
at-sale path — needed for reject-reversal, §8, to be able to void it).
This also means the strict same-day closure lock (previous subsection)
now applies to deferred règlements too: collecting a règlement while the
collecting user's own caisse is closed for today returns the same `422`
— and, same as any settlement, a user with no assigned caisse for that
payment method gets `NoCaisseAssignedException` instead.

### Clôture de caisse et versement au coffre (2026-08-20+, caisses individuelles)

Self-service daily closure for a GCOM user's own caisse — closes today's
session (same mechanism as "Clôture de caisse" above) then **transfers
the closed balance to the branch coffre**, auto-accepted. Deliberately
scoped to the authenticated actor's own journals only — no journal id in
the URL/body — closing someone else's caisse stays on the generic admin
`FinanceJournalClosureController` (any journal, by id, gated on
`manage-finance-journals`); this is the self-service "je clôture ma
caisse" flow a vendeur/admin uses on themselves.

`GET /api/backend/gcom/caisse` — the caller's own `TYPE_USER_CAISSE`
journals with live computed balances:
```json
{ "success": true, "data": [
  { "id": 24, "code": "CU15-ESP", "method_suffix": "ESP", "balance": 420.0, "is_active": true, "is_closed_today": false, "has_open_session": true, "session_number": 1 },
  { "id": 25, "code": "CU15-CHQ", "method_suffix": "CHQ", "balance": 0.0, "is_active": true, "is_closed_today": true, "has_open_session": false, "session_number": 1 }
] }
```
`is_closed_today` (2026-08-31, requested by the UI team after shipping
"Ma Caisse" — they were only finding out on submit, via the close
endpoint's own 422) — lets the "Clôturer" button disable itself
proactively instead of failing on click.

`has_open_session`/`session_number` (2026-08-31, multi-sessions par jour)
describe the **latest** session for today, not session 1 specifically —
`is_closed_today` is really `!has_open_session`, kept as its own field
for UI back-compat. After a caisse is closed then a new sale
auto-reopens it (see below), `is_closed_today` flips back to `false`,
`has_open_session` to `true`, and `session_number` increments — the UI
can re-enable "Clôturer" purely by watching `has_open_session`, no
polling needed beyond the normal `GET /gcom/caisse` refresh.

`POST /api/backend/gcom/caisse/close` — body
`{ method_suffix: "ESP"|"CHQ"|"EFF"|"VIR", counted_balance, notes? }`.
Closes the caller's own currently-open session for that method (or
auto-opens session 1 first if the caisse was never touched at all
today — "close my empty caisse for the record" stays valid, unchanged
from before this feature), then:
- Resolves (or provisions, first time) the caller's own branch's coffre
  (`TYPE_BRANCH_CAISSE`, same method suffix).
- **ESP/VIR**: one `TreasuryTransfer` for the closure's **theoretical**
  (system-computed) balance — never the counted one; a counting
  discrepancy is recorded on the closure (same as always) but never
  changes what actually moves. `transfer_type: DIRECT` (the coffre is a
  caisse-type journal, never a bank account).
- **CHQ/EFF**: one transfer **per still-untransferred cheque/effet** —
  paper instruments are non-divisible
  (`TreasuryTransferService::validatePaperInstrument()`), so closing a
  cheque caisse with 3 pending cheques produces 3 transfers, not 1.
- Every transfer is **auto-accepted** in the same request (V1 arbitrage,
  2026-08-31) — source and destination are the same agency, no distinct
  counterparty to hand off to.
- Nothing to transfer (closure balance is zero) closes the session and
  returns an empty `transfers` array — not an error.

**Multi-sessions par jour (2026-08-31)** — the original design hard-locked
a journal for the rest of the calendar day after one closure
(`UNIQUE(journal_id, business_date)`); the UI team flagged this as a real
operational blocker (a vendeur closes at lunch, needs to keep selling in
the afternoon on the *same* caisse). Reversed: `treasury_journal_closures`
gained a `session_number` column, uniqueness is now
`(journal_id, business_date, session_number)`, and
`TreasuryJournalClosureService::findOrOpenTodaysClosure()` auto-opens
`session_number + 1` whenever the latest session for today is already
closed, instead of throwing. A cash/cheque sale right after a lunchtime
closure silently opens session 2 on the same journal/day — no separate
"reopen" call needed, same auto-open-on-first-activity behavior the
journal always had, just no longer capped at one session per day.
`JournalClosedException` is gone (had exactly one throw site, this one).

The explicit **close** action stays stricter than settlement's
auto-open, on purpose: closing must never silently manufacture a phantom
empty session just to immediately close it again. `POST
/gcom/caisse/close` distinguishes two states for the caller's caisse
today:
- **Never touched at all today** (no closure row yet) — legitimate,
  auto-opens session 1 (zero activity) and closes it. Same as before
  this feature; "close my empty caisse for the record" still works.
- **Latest session today already closed, nothing since** — rejected,
  `422 TREASURY_NO_OPEN_SESSION`, *"Aucune session de caisse ouverte à
  clôturer aujourd'hui pour {code}"*. Calling close twice in a row
  without an intervening sale/settlement hits this, not a silent no-op.

`closeAllForBranch` (the generic admin bulk-close, §7/`FinanceJournalClosureController`)
was updated the same way — it now targets each journal's **currently
open session** specifically, not a naive "today's row", so it can't
double-close an already-closed session or miss session 2+ after a
lunchtime reopen.

Response:
```json
{ "success": true, "message": "Caisse clôturée et versée au coffre de l'agence",
  "data": { "closure": { "...": "TreasuryJournalClosure row" },
            "coffre_code": "BC8ESP",
            "transfers": [ { "id": 91, "amount": 420.0, "status": 3 } ] } }
```
`status: 3` is `TreasuryTransfer::STATUS_ACCEPTED`.

**Reading the source caisse's balance right after closing**: `accept()`
only increments the **destination**'s `cached_balance` synchronously —
the source user caisse's `cached_balance` is left to
`TreasuryJournalService::computeBalance()`'s own lazy discrepancy-
correction (it nets out the now-`ACCEPTED` outgoing transfer on the next
read regardless, and self-heals the cache as a side effect). If a screen
needs an immediately-accurate source balance right after closing, call
`GET /gcom/caisse` again (which always computes live) rather than
trusting a `cached_balance` you may have read from before the closure.

**Non-admin actors and transfer authorization**: `TreasuryTransferService
::createTransfer()` checks `TreasuryAuthorizationService::assertCanTransfer()`
— `root`/`admin` bypass it entirely, but any other GCOM role attempting a
closure needs a real `data_rules` allow entry for the ESP→ESP/CHQ→CHQ
route (same 5-level cascade every other Treasury transfer already goes
through). Every GCOM actor exercised in this codebase's tests so far
carries `admin`, so this hasn't been a practical blocker yet — but a
future non-admin GCOM commercial role (e.g. `gcom_representative`) will
need that `data_rules` row seeded before their own closure works, same
setup SFA already requires for van→desk transfers.

### Financial Instruments — redeposit (built 2026-08-21)

`POST /financial-instruments/{id}/redeposit` (§8) — `REJECTED` →
`PENDING`. Completes the pre-existing state machine's HTTP surface
(deposit/clear/reject were already wired). Resets the status only — it
does **not** re-close the invoice or re-credit the branch caisse those
were fully reversed on reject, exactly as if the settlement had never
happened. If the retry actually clears, represent that with a fresh
`deposit()`/`clear()` call, same as any other instrument; there is no
automatic "replay" of the original settlement.

### Backlog — Rapprochement bancaire (relevé réel), not started

**Status**: paused, not a gap. Confirmed 2026-08-22: lettrage (§6) +
branch caisse balances (this section) + transfers + closures already
give correct traceability for every current operational need — no
business trigger (auditor requirement, an actual undetected
discrepancy) has asked for this yet. This subsection exists so the
scoping work already done isn't lost — pick it up here instead of
re-deriving it when a real trigger shows up.

What this is, precisely (and why it's a different thing from everything
else in §16): comparing `treasury_ledger_entries` against what the bank
*itself* says happened, via an actually-imported bank statement — as
opposed to lettrage, which only matches invoices to payments, and never
touches an external bank statement at all.

**Scope, when it's eventually built:**

1. **Bank statement import** — standard formats: OFX, MT940, CSV. No
   single universal schema across Moroccan banks in practice — expect to
   need a per-bank parser (or per-format-per-bank), not one generic
   importer. First format to support should be driven by whichever
   bank(s) a real tenant actually exports from — not decided yet, and
   deliberately not guessed at here.
2. **Heuristic matching engine** — match each imported statement line
   against `treasury_ledger_entries`/`treasury_transfers` on
   Date / Montant / Référence (a transfer's `versement_reference`, a
   cheque/effet's `reference_number` on `financial_instruments`, etc.).
   Confidence-scored auto-match for the unambiguous cases, a manual
   review queue for anything that doesn't match cleanly (amount off by a
   few centimes, date shifted by a bank processing delay, reference typo).
3. **Manual reconciliation interface** — pair an unmatched statement line
   to a ledger entry by hand, or flag it as genuinely unexplained.
4. **Bank-fee / commission handling** — a real, unresolved design
   question, not just an implementation detail: many statement lines are
   pure bank fees with **no corresponding internal transaction at all**.
   These need their own posting path (a new kind of ledger entry
   representing a cost, not a match against something that already
   exists) — whoever builds this needs to design that path first, it's
   not covered by the matching engine above.

**Dependencies — all already exist, nothing to prepare in advance:**
- `treasury_journals` (`TYPE_BANK_ACCOUNT` rows — the destination side
  of every transfer, already built, §16 above).
- `treasury_transfers` (the `DIRECT`/`BANK_DEPOSIT` records already
  created when a branch caisse's funds move to a bank journal).
- `treasury_ledger_entries` (the double-entry postings
  `TreasuryTransferService::accept()` already generates on approval —
  this is the "grand livre" side of the comparison).
- `financial_instruments` (cheque/effet lifecycle — a statement line for
  a cleared cheque should ultimately cross-reference the instrument, not
  just a ledger entry).

**Not designed yet — open questions for whoever picks this up:**
- Which statement format(s) to support first (depends on the eventual
  real bank(s)).
- Where bank fees get posted (see point 4 above).
- Whether reconciliation is scoped per bank account or per branch.
- Whether an unmatched line older than some age should raise an alert,
  and to whom.

## 17. Multi-Souche Invoice Numbering (Declared vs Internal)

Built 2026-08-25, "FEU VERT TOTAL" Phase 1. **Why this exists**:
distributors/wholesalers commonly run two invoice sequences in parallel —
a **déclarée** series that gets exported to the accountant/Sage and must
be strictly gap-free for fiscal compliance, and an **interne** series for
sales tracked for internal stock/caisse/encours purposes only, which must
**never** appear in that export. Phase 1 builds the split itself; the
Sage/FEC export format/job is deliberately out of scope (Phase 2, to be
scoped once this split is validated in real use — no format decided yet).

### The core design decision: separate counters, not a shared counter filtered later

Each souche draws its invoice number from its **own** `TokenSerie` row —
its own `invoice_next_number` counter. This is the only way the declared
sequence's gap-freedom is **structural**: an internal sale never consumes
a number from the declared counter in the first place, so there's nothing
to "leave a hole" when it's excluded from the export. A design where both
souches shared one counter and internal invoices were filtered out at
export time was explicitly rejected — that would show a visible gap in
the declared file every time an internal sale happened between two
declared ones.

### Schema

- `token_series.souche_kind` — `'declared'` (default) or `'internal'`
  (`TokenSerie::SOUCHE_DECLARED`/`SOUCHE_INTERNAL`). Every existing series
  defaults to `declared`, so nothing changes until a branch is given a
  second, internal series.
- `invoices.souche_kind` + `invoices.token_serie_id` — captured at
  generation time (`Invoice::generateInvoiceNumber()`, see below), so a
  future export job can select `WHERE souche_kind = 'declared'` directly
  instead of re-deriving the souche from the prefix, and any invoice can
  be traced back to exactly which `TokenSerie` row produced its number
  (this traceability didn't exist before — an invoice's number was
  stored, but not which series row generated it).
- `payment_terms.is_internal_souche` (boolean, default `false`) — the
  chosen trigger (see below).

### The default trigger: PaymentTerm

A `PaymentTerm` flagged `is_internal_souche = true` routes **every**
invoice settled through it onto the branch's internal series
automatically — `PaymentTerm::soucheKind()` resolves which kind, and
`Invoice::generateInvoiceNumber($branchCode, $paymentTermId)` reads it.
No new field anywhere in the sale/checkout UI: every `InvoiceService`
call site already resolves `payment_term_id` before creating the invoice
(for due-date calculation), so this default is a zero-UI-cost addition at
the point of sale — it only requires marking the relevant `PaymentTerm`
row once in back-office master data.

This only reliably drives **credit/transfer settlements**, which is the
only path where a caller-supplied `payment_term_id` is actually honored
(`GcomContextResolver::resolvePaymentTermId()` — cash/card/cheque/effet
always resolve the one global `is_cash=true` term regardless of what's
passed, since for those methods the payment method itself, not the term,
carries the settlement semantics). This is exactly why the explicit
override below exists — a payment term can't express "this specific
cash sale is internal" when cash sales don't route through a
caller-chosen term at all.

### Explicit override at invoice creation (2026-08-26)

Real business need reported by the UI team: in daily practice a cash or
cheque sale can go on either souche depending on the transaction's
nature, decided by the caissier/commercial at the point of sale — not
implied by the settlement method. The three GCOM invoice-creation
endpoints (`POST /direct-invoices`, `POST /orders/{order}/
convert-to-invoice`, `POST /delivery-notes/{deliveryNote}/
convert-to-invoice`) all accept an optional `souche_kind`
(`'declared'`|`'internal'`) in the request body — see §8 for the exact
per-endpoint contract. Precedence, resolved in
`Invoice::generateInvoiceNumber()`:

1. `souche_kind` explicitly provided and a recognized value → used as-is,
   beats the `PaymentTerm` default even if the resolved term is flagged
   `is_internal_souche` the other way.
2. Otherwise → the `PaymentTerm`-derived default above.
3. No payment term resolved either → `'declared'`.

An unrecognized `souche_kind` string is never silently treated as
meaningful — Laravel validation rejects it with `422` before the request
reaches the service layer (`in:declared,internal`).

**Real bug found in live testing (2026-08-26) and fixed**: requesting
`souche_kind: 'internal'` on a branch whose internal series isn't
provisioned yet threw `CriticalConfigurationException` from
`resolveBranchTokenSerie()` (by design — see "Provisioning" above), but
none of the three GCOM invoice-creation controllers caught that
exception type (only `InvalidArgumentException`/`DomainException`/
`TreasuryException`), so it bubbled into Laravel's generic handler and
surfaced as an opaque `{"message": "Server Error"}` 500 instead of an
actionable `422`. All three (plus the Devis→Facture/Devis→BC actions,
same numbering call chain) now catch it too, same shape as every other
GCOM validation/config error: `{"success": false, "message": "No active
[internal] token series available for INV numbering (branch: ...)."}`.
If you see this message, the fix is: provision the branch's internal
series (see above) before sending `souche_kind: 'internal'` for it.

### Provisioning a branch's internal series

```php
TokenSerie::autoGenerate(branchCode: $branch->code, name: 'Interne', soucheKind: TokenSerie::SOUCHE_INTERNAL);
```

A branch's existing declared series is untouched — `autoGenerate()` always
mints a fresh unique code/prefix set, so calling it a second time with
`SOUCHE_INTERNAL` gives that branch a second, fully independent series.

**Resolution fails loudly, never silently falls back to the wrong
souche**: `DocumentNumberingService::resolveBranchTokenSerie()` filters
its candidate set to the requested `souche_kind` *before* running the
branch-exact-match / `is_default` / sole-active-series cascade. If a
`PaymentTerm` is flagged `is_internal_souche` but the branch has no
internal series provisioned yet, invoice creation throws
`CriticalConfigurationException` rather than drawing the number from the
declared series (which would silently defeat the whole point) — the
internal series must be provisioned before the flag is turned on for a
branch's payment terms.

### Real bug found building this (§10-class, not yet in §10's own table)

`Order` has no `branch_code` column (only `branch_id`) — two
`InvoiceService` call sites (`createFromPosOrder()`, the GCOM Facture
Directe/Comptoir path, and `generateFromOrderDeliveries()`) were reading
`$order->branch_code`, which Eloquent silently evaluates to `null` for an
undefined attribute. Every invoice generated via either path was
therefore **never** actually drawing its number from its own branch's
series — it only ever worked by `resolveBranchTokenSerie()`'s
"single active series" fallback coincidence, same latent-bug family as
the branch_code gaps already fixed elsewhere in §10. It stayed invisible
until multi-souche numbering made it legitimate for two `declared`-kind
candidates to coexist (a test's own branch series + the environment's
pre-existing baseline series), which forced resolution off that
fallback and exposed the null branch code. Fixed: `createFromPosOrder()`
now resolves `$order->branch?->code`; `generateFromOrderDeliveries()`
uses `$lastBl->branch_code` (a `DeliveryNote`, which does have a real
`branch_code` column, already in scope) — same source
`generatePeriodicInvoice()` already correctly used.

### Stock/treasury invariant

`souche_kind` is purely a numbering/export classification layered onto
the `Invoice` row — it never gates `StockService` or
`GcomInstrumentRegistrar`. An internal-souche sale deducts stock exactly
like a declared one, and settling an internal-souche invoice later posts
treasury (payment_transfers/letterings/branch caisse) exactly like any
other — locked in by
`tests/Feature/Gcom/GcomMultiSoucheNumberingTest.php`.

### Not built in Phase 1 (deliberately)

Sage/FEC export job or endpoint — format (FEC? CSV Sage-native?), cadence
(on-demand vs. scheduled), and delivery mechanism are all still open. No
existing code touches this (the only "Sage" reference anywhere in the
codebase is an unrelated, unimplemented warehouse-transfer sync stub) —
greenfield, to be scoped once the souche split above is validated in
real use.

---

## 18. Représentants (Sales Rep Management)

Built 2026-08-27/28: now that a BC/BL/Facture can be attributed to a
`salesperson_id` explicitly (§8, "back-office entering a sale on behalf of
a field salesperson"), the UI team asked for a way to actually manage
those représentants — create them, list/edit them, and control who
qualifies as one.

### Why a thin façade, not new user-management infrastructure

A représentant is a **plain `User`** holding a new dedicated Spatie role,
`gcom_representative` (`Roles::GCOM_REPRESENTATIVE`) — no new model, no
new table. A full generic user/role/permission management API already
existed before this (`RbacController`, `RolePermissionController`,
`UserPermissionController` — create a staff user with `branch_id`+role in
one call, assign/remove roles, grant/revoke/blacklist permissions), but
it's gated `manage-rbac`/`manage-employees`, not `manage-gcom` — a GCOM
back-office admin has no access to it. Rather than either (a) duplicating
that machinery under GCOM, or (b) handing out `manage-rbac` (which exposes
every role including `admin`/`root` and every user in the system, far
more than "manage my commercials"), this is a **thin, GCOM-scoped façade**
over the exact same `User::create()`/`assignRole()`/`hasRole()` mechanics,
gated `manage-gcom`, and deliberately narrow:

- The role is **never a request parameter** — `POST /representatives`
  always assigns `gcom_representative`, nothing else.
- **Tenant-scoped**: every list/show/update is filtered to
  `company_id = $actor->company_id` — a GCOM admin from one company can
  never see or edit another company's représentants.
- **"Manage his role"** = add/remove the one `gcom_representative` role
  (`POST`/`DELETE`). There is no arbitrary-role-assignment path here.
- **"Manage his permission"** = `GET .../representatives/{user}` returns
  `roles`+`permissions` (effective, read-only). There is deliberately
  **no** grant/revoke-permission endpoint under `manage-gcom` — that stays
  on `UserPermissionController` (`manage-rbac`), so this façade can't
  become a backdoor into broader access control. If per-representative
  custom permissions turn out to be a real need, that's a separate,
  explicit ask.
- `DELETE` removes the role, **never the user account** — a représentant
  who already has BCs/BLs/Factures attributed via `sales_rep_id` keeps
  that history; they just stop being selectable for new ones.

### API

**`GET /api/backend/gcom/representatives`** — Query: `search?` (name/
email/code), `branch_id?`, `is_active?`, `per_page?`.
→ `{ "success": true, "representatives": { "data": [{ "id": 42, "name": "...", "email": "...", "phone": "...", "code": "REP-001", "branch_id": 3, "company_id": 1, "is_active": true }], ...pagination... } }`

**`POST /api/backend/gcom/representatives`** 🔁 — Body:
```json
{ "name": "Karim Bennani", "email": "karim@...", "password": "...", "code": "REP-001", "branch_id": 3, "phone": "0600000000" }
```
`company_id` always defaults to the acting admin's own — not settable in
the payload (tenant isolation, same reasoning as elsewhere in this doc).
→ `201`, `{ "success": true, "message": "Representative created", "representative": { "id": 42, "name": "...", ... } }`

**`GET /api/backend/gcom/representatives/{user}`** — `404` if `{user}`
doesn't hold `gcom_representative` or belongs to another company.
→ `{ "success": true, "representative": { "id": 42, "...": "...", "roles": ["gcom_representative"], "permissions": [] } }`

**`PUT /api/backend/gcom/representatives/{user}`** 🔁 — Body (all
optional): `{ "branch_id"?, "phone"?, "is_active"? }`.
→ `200`, `{ "success": true, "message": "Representative updated", "representative": {...} }`

**`DELETE /api/backend/gcom/representatives/{user}`** 🔁 — removes the
role only.
→ `200`, `{ "success": true, "message": "Representative role removed — the user account itself was not deleted" }`

### `salesperson_id` validation tightened

Before this, `salesperson_id` on the three GCOM sale-creation endpoints
(`POST /orders`, `POST /delivery-notes`, `POST /direct-invoices` — §8)
accepted **any** user id (`exists:users,id` only) — a magasinier or driver
could be picked as a BC's commercial. It's now additionally validated by
`App\Rules\IsGcomRepresentative`: the id must belong to a user holding
`gcom_representative`, or the request fails `422` with a clear message.
Representatives created before this feature (there were none, since the
role is new) aren't affected; any pre-existing `sales_rep_id` value on an
already-created order is untouched either way — this only gates new
requests going forward.

### `draft` BL initial status — built 2026-08-31

Was a deliberately-paused backlog item (see git history for the original
write-up of the 3 open design questions); shipped once the UI team made
the product calls:

1. **No number, no stock movement at draft creation.** `delivery_number`
   is a placeholder (`DRAFT-{uuid}`, since the column is NOT NULL +
   UNIQUE at the DB level) until validated.
2. **`POST /delivery-notes/{id}/validate`** (§8) — separate action, not
   folded into `confirm-delivery`. Draws the real `TokenSerie` number,
   deducts stock, transitions to `in_transit` (default) or `delivered`
   (`{ status?: 'in_transit'|'delivered' }`).
3. **Cancelling a draft** reuses the existing `cancel` endpoint —
   `cancelDeliveryNote()` skips the restock entirely when the BL is still
   `draft` (nothing was ever deducted), a plain abandon rather than a
   reversal.

Not addressed (not asked for, not blocking): draft line items are NOT
independently editable before validation — same locked snapshot as any
other BL, set once at creation from the order's lines.

### Avoir as a payment method — built 2026-08-31 (the refund_amount collision is resolved)

The `AvoirPaymentStrategy::applyAvoir()` collision this backlog note
originally described (POS's mechanism treats `refund_amount` as a
MUTABLE "amount already applied" counter — incompatible with GCOM's own
"fixed at creation" convention) is now resolved for good, not just
avoided: `credit_notes.remaining_amount` (new column, backfilled from
`refund_amount`, NOT `total_amount` — see §9's "Resolving a non-zero
refund_amount" note for why) is the single authoritative, mutable
balance both `redeemCreditNote()` (made partial in the same change) and
the new `GcomCreditNoteService::imputeAvoirs()` draw from and decrement
— so a credit note can never be redeemed in cash and imputed toward a
sale for the same money. `credit_note_resolutions` (new table) is the
real per-event audit trail now that resolution can be partial/repeated.

**What's built**: `payment_method: "avoir"` on `POST /orders`,
`POST /delivery-notes`/`convert-to-bl` (stored as a hint, same as
`cheque`/`effet` today — GCOM's Golden Rule means BC/BL creation never
settles anything), with `avoir_allocations` accepted and validated at
the 3 endpoints that actually settle a sale: `POST /direct-invoices`,
`POST /orders/{order}/convert-to-invoice`,
`POST /delivery-notes/{id}/convert-to-invoice` (same 3 endpoints
`instrument` already lives on, for the same reason). Scope (a) only,
confirmed with the UI team: allocations must sum to EXACTLY the sale
total — `422` in either direction. See §8/§9 for the full contract.

**What's still NOT built — applying an avoir to an EXISTING already-
invoiced sale** (as opposed to funding a brand-new one). Genuinely
smaller now that the hard part (the `remaining_amount` collision) is
resolved — the same `imputeAvoirs()` pattern could plausibly be adapted
to reduce an existing `Invoice.remaining_amount` instead of always
closing a freshly-created one, reusing `credit_note_resolutions`
unchanged. Open questions if picked up:
- Does applying to an existing invoice route through the exact same
  field-touching pattern `createCreditNote()`'s own `appliedToDebt`
  already uses (decrement `remaining_amount`, flip status), or does
  `imputeAvoirs()` itself grow a second mode?
- Partial application against an existing invoice (leaving both the
  avoir AND the target invoice partially resolved) vs. requiring an
  exact match like the new-sale case does today.
- What happens if the target invoice is fully settled by the time the
  application is attempted (race with a règlement) — same
  idempotency/locking questions §6's règlement code already had to
  answer once.
- Cross-partner applications: still out of scope either way (an avoir
  only ever applies within the same partner).

## 19. Notification Center — GCOM Alerts Summary

Built 2026-08-23 (Team UI cadrage for the bell icon + sidebar badges).
One endpoint, `GET /gcom/alerts/summary` (`?branch_id?`), aggregating 8
operational alert categories behind a single lightweight response —
`App\Domains\Gcom\Alerts\Services\GcomAlertsSummaryService`, each
category a plain `count`/`total_amount` pair from a cheap aggregate
query (no N+1 model hydration — meant to be polled often, not a report).

```json
{
  "success": true,
  "alerts": {
    "overdue_invoices": { "count": 5, "total_amount": 14250.00 },
    "uninvoiced_delivery_notes": { "count": 2, "total_amount": 3400.00 },
    "unallocated_credit_notes": { "count": 1, "total_amount": 500.00 },
    "pending_instruments_due": { "count": 3, "total_amount": 8900.00 },
    "rejected_instruments": { "count": 1, "total_amount": 1200.00 },
    "unclosed_cash_sessions": { "count": 1 },
    "pending_orders": { "count": 4, "total_amount": 11200.00 },
    "expiring_quotes": { "count": 2, "total_amount": 3000.00 },
    "total_alerts_count": 19
  }
}
```

`total_amount` is always the ACTIONABLE figure (what's actually still
owed/outstanding), never a document's gross face value — e.g. overdue
invoices report `remaining_amount`, not `total_amount`.

Category definitions:
- **`overdue_invoices`** — same `status='overdue'` filter `GET
  /invoices?status=overdue` already uses (a literal DB status, only
  flipped by the daily `invoices:escalate-overdue` command or a
  payment-driven status recompute — not a live `due_date < now()`
  check).
- **`uninvoiced_delivery_notes`** — `DeliveryNote` with `status =
  'delivered'` and `invoice_id IS NULL`.
- **`unallocated_credit_notes`** — `credit_note_type = 'free_standing'`,
  `status = APPROVED`, `remaining_amount > 0`.
- **`pending_instruments_due`** — `FinancialInstrument` (chèque/effet),
  `status = PENDING`, `due_date` within 7 days (also catches an already-
  overdue-but-still-undeposited instrument, since the window is `<=`).
- **`rejected_instruments`** — `status = REJECTED` (the state an
  instrument sits in after `ReverseSettlementOnInstrumentRejected` has
  already reopened the invoice — these need a fresh règlement/re-deposit,
  not a status check).
- **`unclosed_cash_sessions`** — `TreasuryJournalClosure` `status =
  OPEN`, `opened_at` more than 24h ago (no `total_amount` — a session's
  balance isn't a single meaningful figure at this level).
- **`pending_orders`** — **proxy, not a literal match to "BC en attente
  d'expédition dépassant la date d'expédition prévue"**: confirmed by a
  full grep of the BC creation path that `Order` carries no "planned
  ship date" column at all (`delivery_date` only exists on `DeliveryNote`,
  set once a BL is actually created). Proxied as: GCOM orders with no
  `DeliveryNote` that reached `DELIVERED`, older than 3 days. A real
  "date d'expédition prévue" field on `Order`/BC is separate, unbuilt
  scope if wanted.
- **`expiring_quotes`** — `status = sent`, `expires_at` within 7 days
  and not already past. Branch-scoped via the quote's own creator
  (`user_id` → `User.branch_id`) — `Quote` has no branch column of its
  own.

Branch scoping (`?branch_id=`) goes through `Order.branch_id` wherever a
category traces back to an order (invoices/BLs/orders themselves via
`whereHas('order', ...)`), `CreditNote.branch_id` directly (a real
column), `TreasuryJournal.branch_id` via the journal relation for cash
sessions, and — for the two categories with no branch column at all
(`FinancialInstrument`, `Quote`) — the registering/creating user's own
`branch_id` as a proxy, same pattern
`DocumentDataResolver::resolvePaymentReceipt()` already uses for a
payment's own branch.
