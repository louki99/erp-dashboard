// GCOM (Gestion Commerciale Pure) — see docs/modules/28-gcom.md §8/§13/§14.
//
// NOTE: several field names below were corrected against the *actual* live
// API response (curled directly against the ORBIS seed tenant on
// 2026-08-15), not just the doc prose, because they disagree:
//  - `payment_method` / `payment_term_id` / `stamp_duty` live under
//    `order.financial_metadata`, not flat on the order.
//  - `order.products[]` is the full Product row with line data nested under
//    `.pivot` (quantity/prices/tax) — not a flat OrderProduct row.
//  - the relation is serialized as `delivery_notes` (snake_case), not
//    `deliveryNotes`.
//  - an invoice's HT subtotal field is `subtotal` (no underscore between
//    "sub" and "total"), and each invoice item's line total is `line_total`,
//    not `total_amount`.

// 'avoir' added 2026-08-20 — NON_CASH_COMPENSATION in GcomSettlementClassifier,
// no Treasury movement, no credit-limit check. Only meaningful (requires
// `avoir_allocations`) at the 3 endpoints that actually settle a sale to an
// invoice — POST /direct-invoices, orders/{order}/convert-to-invoice,
// delivery-notes/{id}/convert-to-invoice. Accepted elsewhere (BC/BL creation)
// only as a forward-looking hint, no allocation required there.
export type GcomPaymentMethod = 'cash' | 'card' | 'credit' | 'cheque' | 'effet' | 'transfer' | 'avoir';

// One or more credit notes funding a sale paid via payment_method: 'avoir'.
// The sum must match the sale total EXACTLY — GCOM has no mixed/split payment
// concept yet (avoir + another method on the same sale), confirmed 422:
// "Avoir allocations total (X) must exactly match the sale total (Y) — mixed
// avoir + another payment method is not supported yet." Each credit_note_id
// must belong to the sale's own partner, be APPROVED, and have enough
// remaining_amount — all three verified live as separate 422s.
export interface GcomAvoirAllocation {
    credit_note_id: number;
    amount: number;
}

// `?price_mode=` on the BC/Devis/BL pdf endpoints — controls only the per-line
// unit price/amount column basis; the HT/TVA/TTC totals block at the bottom
// always shows the full breakdown regardless. Omit to keep each document's
// own default (BC/Devis: HT, BL: TTC) — invoices have no price_mode param.
export type GcomPdfPriceMode = 'ht' | 'ttc';

export interface GcomInstrumentInput {
    reference_number: string;
    due_date: string; // YYYY-MM-DD
    bank_name?: string;
    bank_account?: string;
}

export interface GcomItemInput {
    product_id: number;
    quantity: number;
}

// §17, built 2026-08-25/26 — 'declared' (fiscal-export series, must stay
// gap-free) vs 'internal' (tracked for stock/caisse/encours only, never
// exported). Omit to fall back to the PaymentTerm-derived default
// (`'declared'` unless the resolved term is flagged is_internal_souche).
// An explicit value always wins over that default, even if they disagree.
export type GcomSoucheKind = 'declared' | 'internal';

export interface GcomDirectInvoicePayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    notes?: string;
    payment_term_id?: number | null;
    instrument?: GcomInstrumentInput | null;
    souche_kind?: GcomSoucheKind | null;
    // Both 2026-08-27 — see GcomCreateOrderPayload's comment, same semantics.
    client_order_ref?: string | null;
    salesperson_id?: number | null;
    // Required when payment_method is 'avoir' (2026-08-20) — see GcomAvoirAllocation.
    avoir_allocations?: GcomAvoirAllocation[];
}

export interface GcomInvoiceItem {
    id: number;
    product_id: number;
    product_code?: string;
    product_name?: string;
    quantity: number | string;
    unit?: string;
    unit_price?: number | string;
    discount_percent?: number | string;
    discount_amount?: number | string;
    tax_percent?: number | string;
    tax_amount?: number | string;
    line_total?: number | string; // TTC line total
}

export type GcomInvoiceStatus = 'pending' | 'partially_paid' | 'fully_paid' | 'overdue';

export interface GcomDeliveryNoteRef {
    id: number;
    status?: string;
    total_amount?: number | string;
}

// Order financial fields the doc implies are flat on the order — in practice
// they're nested here instead.
export interface GcomOrderFinancialMetadata {
    payment_method?: GcomPaymentMethod;
    payment_term_id?: number | null;
    stamp_duty?: number | string;
    is_credit_sale?: boolean;
}

// Added 2026-08-16 (GET /invoices/{invoice}) — one entry per règlement applied to
// this invoice, comptoir-immediate and deferred règlements in the same shape.
// Treasury-unification gap fixed 2026-08-17 (verified live) — a comptoir
// cash/card settlement now correctly produces a payment_transfers row, so
// `fully_paid` invoices reliably carry a populated `payments[]`. An empty
// array on a non-`pending` invoice should now only happen for legacy
// pre-fix data, not the expected norm it used to be.
export interface GcomInvoicePayment {
    payment_transfer_id: number;
    code: string;
    amount_applied: number | string;
    payment_total_amount: number | string;
    payment_method: string;
    status: string;
    reference?: string | null;
    bank?: string | null;
    payment_date?: string | null;
    lettering_date?: string | null;
    notes?: string | null;
}

// Distinct from GcomFinancialInstrument (partners/{id}/financial-instruments) —
// this is the subset embedded on the invoice itself (no partner_id/currency/
// issue_date, but adds bank_account/deposited_at/cleared_at/rejected_at).
export interface GcomInvoiceFinancialInstrument {
    id: number;
    instrument_type: GcomInstrumentType;
    reference_number: string;
    status: GcomInstrumentStatus;
    amount: number | string;
    due_date?: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    deposited_at?: string | null;
    cleared_at?: string | null;
    rejected_at?: string | null;
    rejection_reason?: string | null;
}

export interface GcomInvoice {
    id: number;
    invoice_number?: string;
    status: GcomInvoiceStatus;
    subtotal?: number | string; // HT — note: no underscore, unlike Order.sub_total
    tax_amount?: number | string;
    total_amount: number | string;
    paid_amount?: number | string;
    remaining_amount: number | string;
    invoice_date?: string;
    due_date?: string | null;
    cancelled_at?: string | null;
    items?: GcomInvoiceItem[];
    partner?: { id: number; name: string; code?: string };
    order?: { id: number; order_code?: string; bc_status?: string; delivery_notes?: GcomDeliveryNoteRef[]; financial_metadata?: GcomOrderFinancialMetadata };
    payments?: GcomInvoicePayment[];
    financial_instrument?: GcomInvoiceFinancialInstrument | null;
    // §17 (2026-08-25) — captured at generation time, always present on a
    // freshly-created/converted invoice regardless of whether souche_kind
    // was explicitly sent or auto-derived from the PaymentTerm.
    souche_kind?: GcomSoucheKind;
    token_serie_id?: number;
    // 2026-08-27 — mirrored automatically from the underlying order.
    client_order_ref?: string | null;
}

export interface GcomDirectInvoiceResponse {
    success: boolean;
    message?: string;
    invoice: GcomInvoice;
}

// ─── Consultation (GET /invoices) ─────────────────────────────────────────

export interface GcomInvoiceListFilters {
    partner_id?: number;
    status?: GcomInvoiceStatus;
    from?: string; // YYYY-MM-DD, invoice_date range start
    to?: string;   // YYYY-MM-DD, invoice_date range end
    per_page?: number;
    page?: number;
}

export interface GcomPaginator<T> {
    current_page: number;
    data: T[];
    per_page: number;
    total: number;
    last_page: number;
    next_page_url?: string | null;
    prev_page_url?: string | null;
}

export interface GcomInvoiceListResponse {
    success: boolean;
    invoices: GcomPaginator<GcomInvoice>;
}

export interface GcomInvoiceShowResponse {
    success: boolean;
    invoice: GcomInvoice;
}

export type GcomCreditNoteStatus = 'APPROVED' | 'DRAFT' | 'PENDING' | 'REJECTED' | 'CANCELLED';

export interface GcomCreditNoteItem {
    id: number;
    product_id: number;
    quantity: number;
    is_restocked?: boolean;
    // Auto-populated from the item's `condition` at creation (2026-08-18 fix,
    // same day the 500 on credit-note creation was fixed) — no separate field
    // to send, just now readable back from the API.
    return_reason?: GcomReturnReason | null;
}

// `refund_method`/`refund_reference`/`refund_processed_at` (2026-08-20) — a
// credit note's `refund_amount` (the part that couldn't be netted against its
// own invoice's remaining debt, e.g. an avoir on an already-fully-paid cash
// sale) previously had no resolution path at all: visible as "money owed
// back" but nothing let staff mark it as actually paid out. `POST
// /credit-notes/{id}/redeem` sets these three fields; `refund_amount` itself
// stays unchanged (a fixed historical fact).
//
// `remaining_amount`/`consumed_amount`/`imputed_at` added the same day once
// `redeem` became partial (`amount?`) and a second consumer — paying for a
// NEW sale via `payment_method: 'avoir'` — was introduced: both draw from the
// same `remaining_amount` pool so an avoir can never be spent twice.
// `refund_processed_at` is set only when `remaining_amount` reaches exactly
// `0` (verified live: a partial `redeem` call left it `null`, only the call
// that brought `remaining_amount` to 0 set it) — treat it as "fully
// resolved", not "at least one event happened". `refund_method`/
// `refund_reference` mirror the same rule — only the closing event updates
// them, a partial redeem in between leaves them untouched (also verified
// live, not documented explicitly by backend). `consumed_amount` only
// tracks the avoir-as-payment channel specifically — a cash `redeem` reduces
// `remaining_amount` but does NOT increase `consumed_amount` (verified live:
// two `redeem` calls draining a note to 0 left `consumed_amount` at `0.00`
// throughout), so don't read `consumed_amount` as "total amount spent so
// far" — use `refund_amount - remaining_amount` for that instead.
//
// KNOWN DATA GAP (flagged to backend, not yet fixed as of 2026-08-20): the
// migration backfilling these three columns set `remaining_amount =
// refund_amount` unconditionally, including for credit notes that already
// had `refund_processed_at` set (cash-redeemed before this migration ran) —
// live-reproduced on ORBIS. Those rows now read as "fully available again"
// under the new field even though the money was already paid out once,
// which is exactly the double-credit risk this whole feature exists to
// prevent. Don't trust `remaining_amount` as authoritative for any credit
// note created/redeemed before 2026-08-20 until backend confirms a backfill
// fix — new credit notes created after this date are unaffected (verified
// live with a fresh note end-to-end).
export type GcomRefundMethod = 'cash' | 'cheque' | 'effet' | 'card' | 'transfer';

export interface GcomCreditNote {
    id: number;
    // "AVR..." prefix — real agency-series number (2026-08-18 fix, was 500ing
    // before due to a series-resolution bug, now fixed).
    credit_note_number?: string;
    credit_note_type?: 'financial' | 'return';
    status: GcomCreditNoteStatus;
    order_id?: number;
    invoice_id?: number;
    partner_id?: number;
    branch_id?: number;
    subtotal?: number | string;
    tax_amount?: number | string;
    total_amount: number | string;
    refund_amount: number | string;
    refund_method?: GcomRefundMethod | null;
    refund_reference?: string | null;
    refund_processed_at?: string | null;
    // The live, authoritative spendable balance — see the comment above
    // GcomRefundMethod for the full explanation and the known backfill gap.
    remaining_amount?: number | string;
    consumed_amount?: number | string;
    imputed_at?: string | null;
    reason?: string;
    return_reason?: GcomReturnReason | null;
    notes?: string | null;
    created_at?: string;
    items?: GcomCreditNoteItem[];
    // Only present on the global list/detail endpoints (§8, 2026-08-20) — the
    // per-invoice list (`GET /invoices/{id}/credit-notes`) doesn't nest these
    // since the caller already has both from context.
    invoice?: { id: number; invoice_number?: string; total_amount: number | string; status: GcomInvoiceStatus };
    partner?: { id: number; name: string; code?: string };
}

export interface GcomCreditNotesListResponse {
    success: boolean;
    credit_notes: GcomCreditNote[];
}

// ─── Global Avoirs (2026-08-20) ────────────────────────────────────────────

export interface GcomCreditNotesGlobalListFilters {
    partner_id?: number;
    status?: GcomCreditNoteStatus;
    branch_id?: number;
    from?: string; // YYYY-MM-DD
    to?: string; // YYYY-MM-DD
    per_page?: number;
    page?: number;
}

export interface GcomCreditNotesGlobalListResponse {
    success: boolean;
    credit_notes: GcomPaginator<GcomCreditNote>;
}

export interface GcomCreditNoteDetailResponse {
    success: boolean;
    credit_note: GcomCreditNote;
}

export interface GcomRedeemCreditNotePayload {
    method: GcomRefundMethod;
    reference?: string;
    // 2026-08-20 — partial redeem, draws from remaining_amount (not
    // refund_amount directly). Omit for the full remaining balance.
    amount?: number;
}

export interface GcomRedeemCreditNoteResponse {
    success: boolean;
    message?: string;
    credit_note: GcomCreditNote;
}

// ─── Returns architecture (§9bis, 2026-08-18) ─────────────────────────────
// Shared by CAS 1 (BL line return, pre-invoice) and CAS 2 (avoir restock,
// post-invoice) — `sellable` (default) goes straight back to sellable stock,
// `damaged`/`technical` land in a dedicated (invisible-to-sales) location.
export type GcomReturnCondition = 'sellable' | 'damaged' | 'technical';

// `App\Enums\ReturnReason` — 2026-08-18, CAS 1's `reason` moved from free
// text to this enum (breaking change, 422 for anything else). CAS 2/3's
// top-level `GcomCreateCreditNotePayload.reason` is a DIFFERENT field (a
// free-text note on the credit note itself) and is NOT affected by this.
export type GcomReturnReason =
    | 'DEFECTIVE' | 'DAMAGED' | 'WRONG_ITEM' | 'CHANGE_MIND'
    | 'NOT_AS_DESCRIBED' | 'EXPIRED' | 'CUSTOMER_REQUEST'
    | 'DUPLICATE_ORDER' | 'OTHER';

// POST /invoices/{invoice}/credit-notes — `amount` omitted means full-amount
// (invoice cancellation); `items` presence triggers restock of those lines.
// `items[].condition` added 2026-08-18 — omit for the pre-existing plain
// sellable-restock behavior.
export interface GcomCreateCreditNotePayload {
    amount?: number;
    reason: string;
    items?: { product_id: number; quantity: number; condition?: GcomReturnCondition }[];
}

export interface GcomCreateCreditNoteResponse {
    success: boolean;
    message?: string;
    credit_note: GcomCreditNote;
    invoice?: GcomInvoice;
}

// POST /delivery-notes/{deliveryNote}/lines/{item}/return — CAS 1: reduces a
// BL line's quantity before it's ever been invoiced (only allowed then —
// 422 if the BL is already invoiced). `{item}` is the DeliveryNoteItem row
// id. `quantity` must be strictly less than the line's current quantity —
// for a full line/whole-BL return, use the existing `cancel` endpoint
// instead. Restocks immediately (condition-aware) and recomputes the BL's
// total_amount; a later convert-to-invoice bills the net quantity with no
// extra step needed.
export interface GcomReturnDeliveryNoteLinePayload {
    quantity: number;
    reason: GcomReturnReason;
    condition?: GcomReturnCondition;
}

export interface GcomReturnDeliveryNoteLineResponse {
    success: boolean;
    message?: string;
    delivery_note: GcomDeliveryNote;
}

// GET /delivery-notes/{deliveryNote}/returns — 2026-08-18. Every CAS 1 return
// event is now its own persisted row (was previously baked as freeform text
// into StockMovement.notes, unreachable from any GET, and unable to
// represent more than one return on the same line) — newest first.
export interface GcomDeliveryNoteReturn {
    id: number;
    delivery_note_item_id: number;
    product?: { code?: string; name?: string };
    quantity: number | string;
    condition: GcomReturnCondition;
    reason: GcomReturnReason;
    stock_location?: string;
    returned_by?: { id: number; name: string };
    returned_at?: string;
}

export interface GcomDeliveryNoteReturnsListResponse {
    success: boolean;
    returns: GcomDeliveryNoteReturn[];
}

// ─── Quotes (Devis) — see docs/modules/28-gcom.md §8 "Quotes (Devis)" ──────
// Flow #1 (Devis → BC → Facture) and #2 (Devis → Facture Directe). `GET
// /quotes` only ever returns the authenticated user's own quotes — there is
// no cross-user listing on this endpoint (Quote.user_id = current user).

export type GcomQuoteStatus = 'draft' | 'sent' | 'accepted' | 'expired' | 'converted';

export interface GcomQuoteItem {
    id: number;
    product_id: number;
    quantity: number | string;
    unit_price_ht?: number | string;
    // Verified live 2026-08-16: the field is `line_total_ttc`, NOT `total_price`
    // (unlike GcomOrderProductPivot's `total_price` — quotes don't follow that
    // naming). `price` (unit TTC) and `line_total_ht`/`line_tax_amount` also exist.
    line_total_ttc?: number | string;
    product?: { id: number; name: string; code?: string };
}

export interface GcomQuote {
    id: number;
    // Verified live 2026-08-16: the real field is `quote_number`, not `quote_code`
    // (unlike GcomOrder's `order_code`) — don't assume GCOM documents share a
    // naming convention across endpoints, check each one.
    quote_number?: string;
    status: GcomQuoteStatus;
    sub_total?: number | string;
    tax_amount?: number | string;
    total_amount: number | string;
    notes?: string | null;
    expires_at?: string | null;
    created_at?: string;
    items?: GcomQuoteItem[];
    partner?: { id: number; name: string; code?: string };
    converted_order_id?: number | null;
}

export interface GcomCreateQuotePayload {
    partner_id: number;
    items: GcomItemInput[];
    notes?: string;
    expires_at?: string; // ISO datetime
}

export interface GcomQuoteListFilters {
    status?: GcomQuoteStatus;
    per_page?: number;
    page?: number;
}

export interface GcomQuoteListResponse {
    success: boolean;
    quotes: GcomPaginator<GcomQuote>;
}

export interface GcomQuoteShowResponse {
    success: boolean;
    quote: GcomQuote;
}

export interface GcomQuoteMutationResponse {
    success: boolean;
    message?: string;
    quote: GcomQuote;
}

// POST /quotes/{id}/convert — Devis → Facture Directe (flow #2). All fields
// optional, `payment_method` defaults to "cash". `instrument` required when
// `payment_method` is cheque/effet.
export interface GcomConvertQuotePayload {
    payment_method?: GcomPaymentMethod;
    payment_term_id?: number | null;
    instrument?: GcomInstrumentInput | null;
}

export interface GcomConvertQuoteResponse {
    success: boolean;
    message?: string;
    invoice: GcomInvoice;
    quote: GcomQuote;
}

// POST /quotes/{id}/convert-to-order — Devis → BC (flow #1, first hop).
export interface GcomConvertQuoteToOrderPayload {
    payment_method?: GcomPaymentMethod;
    payment_term_id?: number | null;
}

export interface GcomConvertQuoteToOrderResponse {
    success: boolean;
    message?: string;
    order: GcomOrder;
    quote: GcomQuote;
}

// ─── Orders (BC) — see docs/modules/28-gcom.md §8 "Orders (BC)" ────────────

export type GcomBcStatus = 'confirmed' | 'cancelled';

export interface GcomOrderProductPivot {
    // Backend fix 2026-08-15 (`id` added to Order::products()'s withPivot()) —
    // this IS the real OrderProduct row id, and it's what
    // POST /orders/{order}/lines/{orderProduct}/cancel and
    // PATCH /orders/{order}/lines/{orderProduct} expect as their route param.
    // Before that fix this field didn't exist anywhere in the API and both
    // endpoints were unreachable from the frontend — don't fall back to the
    // product's own `id` (GcomOrderProduct.id below), that never worked.
    id: number;
    order_id: number;
    product_id: number;
    quantity: number | string;
    unit?: string;
    price?: number | string;          // unit price TTC
    total_price?: number | string;    // line total TTC
    tax_rate?: number | string;
    unit_price_ht?: number | string;
    line_tax_amount?: number | string;
    line_total_ht?: number | string;
}

export interface GcomOrderProduct {
    // This is the PRODUCT's own id (name/code below are the product's too) —
    // NOT the order-line identifier. Use `pivot.id` for line-level mutations.
    id: number;
    name: string;
    code: string;
    pivot: GcomOrderProductPivot;
}

export interface GcomOrder {
    id: number;
    order_code?: string;
    bc_status: GcomBcStatus;
    sub_total?: number | string;
    tax_amount?: number | string;
    total_amount: number | string;
    payable_amount?: number | string;
    notes?: string | null;
    cancellation_reason_code?: string | null;
    created_at?: string;
    products?: GcomOrderProduct[];
    partner?: { id: number; name: string; code?: string };
    invoices?: GcomInvoice[];
    delivery_notes?: GcomDeliveryNoteRef[];
    financial_metadata?: GcomOrderFinancialMetadata;
    // 2026-08-27 — customer's own PO/reference number, separate from notes.
    client_order_ref?: string | null;
    // order.sales_rep_id never appears as a bare top-level key (backend's own
    // note) — only reachable nested here, regardless of which GCOM endpoint
    // returned the order.
    salesperson_data?: { id: number; salesperson_id: number } | null;
}

export interface GcomCreateOrderPayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    payment_term_id?: number | null;
    notes?: string;
    // Both 2026-08-27. client_order_ref lives on orders.client_order_ref and
    // is auto-mirrored onto any delivery_notes/invoices created later from
    // this order — no need to resend at convert-to-bl/convert-to-invoice.
    // salesperson_id overrides the "creator = salesperson" default, for a
    // back-office user entering a sale on behalf of a field salesperson.
    client_order_ref?: string | null;
    salesperson_id?: number | null;
}

export interface GcomOrderListFilters {
    partner_id?: number;
    bc_status?: GcomBcStatus;
    per_page?: number;
    page?: number;
}

export interface GcomOrderListResponse {
    success: boolean;
    orders: GcomPaginator<GcomOrder>;
}

export interface GcomOrderShowResponse {
    success: boolean;
    order: GcomOrder;
}

export interface GcomOrderMutationResponse {
    success: boolean;
    message?: string;
    order: GcomOrder;
}

export interface GcomConvertToInvoiceResponse {
    success: boolean;
    message?: string;
    invoice: GcomInvoice;
}

export interface GcomConvertToBlResponse {
    success: boolean;
    message?: string;
    delivery_note: GcomDeliveryNoteRef;
}

// Backend fix 2026-08-15: both fields are now genuinely read and persisted
// (verified live) — `delivery_date` defaults to today if omitted;
// `payment_method` keeps the BC's existing method if omitted. Changing
// `payment_method` here has real side effects, not just a label change:
// stamp duty is added/removed (recalculated), and switching from cash/card
// to credit/cheque/effet/transfer re-runs the credit check (never checked
// for those two methods at BC creation) — can 422 with "Credit check
// failed: ..." or "No payment term resolved...", same as BC creation.
export interface GcomConvertToBlPayload {
    delivery_date?: string; // YYYY-MM-DD
    payment_method?: GcomPaymentMethod;
    // Both 2026-08-29 — free text, max 150 chars, display/traceability only.
    driver_info?: string | null;
    transporter_name?: string | null;
    // 2026-08-30 — optional, default 'in_transit'. 'delivered' is for a
    // counter/depot pickup (client loads goods right there, no real transit
    // leg) — sets delivered_at=now() immediately, skips confirm-delivery
    // entirely (calling it afterwards 422s, already delivered). 'draft' is
    // NOT accepted (422) — a real, currently unbuilt design gap, see the
    // doc's §18 backlog note — never send it speculatively.
    status?: 'in_transit' | 'delivered';
}

export interface GcomCancelOrderPayload {
    reason: string;
}

export interface GcomCancelOrderLinePayload {
    quantity?: number;
    reason: string;
}

// PATCH /orders/{order}/lines/{orderProduct} — the inverse of cancel: raise a
// line's quantity (e.g. "client called back, wants 15 instead of 10"). No
// `reason` — this is a correction, not a cancellation. Only allowed before
// any BL/invoice exists, same guard as cancel. Never touches stock (GCOM
// orders never do, until BL/invoice conversion).
export interface GcomUpdateOrderLinePayload {
    quantity: number;
}

// POST /orders/{order}/lines — adds a brand-new product line to a BC (before
// any BL/invoice). 422 if the product is already on the order — use
// updateLine to change its quantity instead. No equivalent exists (and
// never will) once the order has been invoiced — a post-invoice extra item
// is a new BC/facture, not an edit to the old one.
export interface GcomAddOrderLinePayload {
    product_id: number;
    quantity: number;
}

// ─── Delivery Notes (BL) — see docs/modules/28-gcom.md §8 "Delivery Notes (BL)" ─
//
// Verified live 2026-08-15. Two gaps worth knowing before building UI on top
// of this: (1) `items[]` carries `product_id` only, no product name/code —
// unlike Order's `products[]` (full Product row) or Invoice's `items[]`
// (product_name/product_code included). Fall back to `Produit #{id}` in the
// UI. (2) the top-level `invoice_id` is a bare number, not a nested invoice
// object — no `invoice_number` available here, only the id.
// 'in_transit' added 2026-08-29 ("FEU VERT TOTAL: CYCLE BL IN_TRANSIT ->
// DELIVERED") — a BL created via flow #4/#5 is now born in_transit, not
// delivered; only confirm-delivery moves it to delivered, the only state
// it can be invoiced from. Flow #6 (Comptoir/direct-invoices) has no BL
// at all, unaffected.
export type GcomBlStatus = 'in_transit' | 'delivered' | 'cancelled';

export interface GcomDeliveryNoteItem {
    id: number;
    product_id: number;
    ordered_quantity: number | string;
    delivered_quantity?: number | string;
    unit_price?: number | string;
    unit?: string;
}

export interface GcomDeliveryNote {
    id: number;
    delivery_number?: string;
    order_id: number;
    status: GcomBlStatus;
    total_amount: number | string;
    sub_total?: number | string; // proxied from the underlying order — see §8
    tax_amount?: number | string; // same
    delivery_date?: string;
    notes?: string | null;
    invoice_id?: number | null;
    items?: GcomDeliveryNoteItem[];
    partner?: { id: number; name: string; code?: string };
    order?: { id: number; order_code?: string; bc_status?: string; financial_metadata?: GcomOrderFinancialMetadata };
    // 2026-08-27 — mirrored automatically from the underlying order.
    client_order_ref?: string | null;
    // All 3 added 2026-08-29 — display/traceability only, not a Driver FK
    // (GCOM still has zero field-sales/fleet dependency). delivered_at is
    // never set at BL creation anymore — only confirm-delivery sets it.
    driver_info?: string | null;
    transporter_name?: string | null;
    delivered_at?: string | null;
}

export interface GcomDeliveryNoteListFilters {
    partner_id?: number;
    status?: GcomBlStatus;
    per_page?: number;
    page?: number;
}

export interface GcomDeliveryNoteListResponse {
    success: boolean;
    delivery_notes: GcomPaginator<GcomDeliveryNote>;
}

export interface GcomDeliveryNoteShowResponse {
    success: boolean;
    delivery_note: GcomDeliveryNote;
}

export interface GcomDeliveryNoteMutationResponse {
    success: boolean;
    message?: string;
    delivery_note: GcomDeliveryNote;
}

// Flow #5 — BL Direct → Facture. Deducts stock immediately (the only
// document that exists yet), unlike BC creation which never touches stock.
export interface GcomCreateDeliveryNotePayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    payment_term_id?: number | null;
    notes?: string;
    // All 3 added 2026-08-27 — see GcomCreateOrderPayload's comment for
    // client_order_ref/salesperson_id (same semantics, applies to the
    // transparently-created order underneath this BL). delivery_date
    // (YYYY-MM-DD) defaults to today if omitted — previously this endpoint
    // had no way to set it at all (always silently forced today).
    delivery_date?: string;
    client_order_ref?: string | null;
    salesperson_id?: number | null;
    // Both 2026-08-29 — free text, max 150 chars, display/traceability only.
    driver_info?: string | null;
    transporter_name?: string | null;
    // 2026-08-30 — see GcomConvertToBlPayload's comment, same semantics.
    status?: 'in_transit' | 'delivered';
}

export interface GcomCancelDeliveryNotePayload {
    reason: string;
}

// ─── Règlement & Lettrage — see docs/modules/28-gcom.md §8 "Payments" ──────
//
// Verified live 2026-08-15 against ORBIS. Two real integration constraints
// found that the doc doesn't call out:
//  - `payment_term_id` must resolve to a real `payment_method_id` on the
//    PaymentTerm record — a term with none (e.g. generic NET30) 422s with
//    "Unable to resolve a payment method for this payment term." In
//    practice: only use the partner's own attached payment terms here
//    (same `getPaymentTerms(partnerId)` call already used by Comptoir/BC),
//    not an arbitrary term id.
//  - When the resolved payment method needs a bank, `bank_id` is required
//    (422 "Bank is required for this payment method" otherwise) — and there
//    is currently **no discoverable endpoint to list banks** (`/masterdata/banks`,
//    `/banks`, `/finance/banks` all 404). The UI can only offer a raw numeric
//    bank id input until backend adds a lookup endpoint — flagged, not a
//    frontend bug.

export interface GcomOpenInvoice {
    id: number;
    invoice_number?: string;
    invoice_date?: string;
    due_date?: string | null;
    total_amount: number | string;
    paid_amount?: number | string;
    remaining_amount: number | string;
    status: GcomInvoiceStatus;
}

export interface GcomOpenInvoicesResponse {
    success: boolean;
    invoices: GcomOpenInvoice[];
}

export interface GcomPayment {
    id: number;
    code?: string;
    reference?: string | null;
    partner_id: number;
    payment_method_id?: number | null;
    payment_term_id?: number | null;
    bank_id?: number | null;
    amount: number | string;
    payment_date?: string;
    maturity_date?: string | null;
    status?: string;
    is_reconciled?: boolean;
    reconciled_amount?: number | string;
    remaining_amount?: number | string;
    notes?: string | null;
}

export interface GcomPaymentAllocationInput {
    invoice_id: number;
    amount: number;
    notes?: string;
}

export interface GcomRegisterPaymentPayload {
    partner_id: number;
    amount: number;
    payment_term_id: number;
    // Added 2026-08-16 — the dropdown the "moyen de paiement" select actually
    // submits now. payment_term_id (échéance) stays separate and still required
    // — the two are NOT merged, per backend's explicit instruction.
    payment_method_id?: number;
    reference?: string;
    bank_id?: number | null;
    maturity_date?: string | null;
    notes?: string;
    // Required only when payment_method_id resolves to Chèque/Effet (verified
    // live: masterdata's own `type: 'check'` reliably identifies these two —
    // 422 with a clear message if omitted while a check-type method is chosen).
    instrument?: GcomInstrumentInput;
    allocations?: GcomPaymentAllocationInput[];
    auto_letter?: boolean;
}

export interface GcomPaymentListFilters {
    partner_id: number; // required — no cross-partner feed on this endpoint
    status?: string;
    per_page?: number;
    page?: number;
}

export interface GcomPaymentListResponse {
    success: boolean;
    payments: GcomPaginator<GcomPayment>;
}

export interface GcomLetteringSummary {
    total_amount: number | string;
    lettered_amount: number | string;
    remaining_amount: number | string;
}

export interface GcomRegisterPaymentResponse {
    success: boolean;
    message?: string;
    payment: GcomPayment;
    lettering?: GcomLetteringSummary;
}

// ─── Financial instruments / statement / ledger (added 2026-08-16) ─────────
// `/statement`'s total_credit/current_balance and `/ledger`'s "payment"
// entries originally only reflected manually-registered règlements, missing
// the "treasury unification" auto-settlements from comptoir/BC/BL cash/card/
// cheque/effet sales — backend fixed 2026-08-17 (re-verified live: a fresh
// comptoir cash sale now nets to a correct 0 balance immediately, and a mixed
// paid+pending scenario across two invoices split total_debit/total_credit/
// current_balance exactly right). Safe to use directly now — this is the
// primary source for GCOM header/list balance figures, not a client-side
// invoice-summing workaround.
export type GcomInstrumentType = 'CHEQUE' | 'EFFET';
export type GcomInstrumentStatus = 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'REJECTED';

export interface GcomFinancialInstrument {
    id: number;
    partner_id: number;
    payment_method_id?: number | null;
    instrument_type: GcomInstrumentType;
    reference_number: string;
    amount: number | string;
    currency?: string;
    issue_date?: string | null;
    due_date: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    bank_id?: number | null;
    status: GcomInstrumentStatus;
    rejection_reason?: string | null;
    invoice_id?: number | null;
    payment_transfer_id?: number | null;
    // Lifecycle timestamps + the deposit reference field added 2026-08-18
    // alongside the 3 transition endpoints below.
    deposited_at?: string | null;
    cleared_at?: string | null;
    rejected_at?: string | null;
    deposit_reference?: string | null;
    // 2026-08-20 — the real, id-based source of truth for "which bordereau
    // does this instrument belong to". `deposit_reference` stays a free-text
    // display field only (never unique, never a lookup key) — a single
    // deposit() creates its own 1-instrument BankDeposit too, so any
    // DEPOSITED/CLEARED/REJECTED instrument has one, not just batch deposits.
    bank_deposit_id?: number | null;
    // Only present on the company-wide list (GET /financial-instruments) —
    // the per-partner list omits it since the partner is already known
    // from the URL.
    partner?: { id: number; name: string; code?: string };
}

// Lifecycle transitions (2026-08-18) — FinancialInstrumentService existed
// already, just never wired to an HTTP route before. All 3 return
// `{ success, message?, financial_instrument }` and require
// X-Idempotency-Key. A 422 (not 500) on an invalid transition (e.g. clear on
// a still-PENDING instrument) carries a real explanatory message.
export interface GcomInstrumentDepositPayload {
    deposit_date?: string; // YYYY-MM-DD, defaults to today if omitted
    deposit_reference?: string;
}

export interface GcomInstrumentRejectPayload {
    reason: string;
}

export interface GcomFinancialInstrumentActionResponse {
    success: boolean;
    message?: string;
    financial_instrument: GcomFinancialInstrument;
}

export interface GcomFinancialInstrumentsFilters {
    status?: GcomInstrumentStatus;
    instrument_type?: GcomInstrumentType;
    per_page?: number;
    page?: number;
}

export interface GcomFinancialInstrumentsResponse {
    success: boolean;
    financial_instruments: GcomPaginator<GcomFinancialInstrument>;
}

// Company-wide "Portefeuille" (built 2026-08-24) — distinct from the
// per-partner list above. financial_instruments has neither company_id nor
// branch_id as a column: company scope is 100% reliable (partner_id →
// partners.company_id), branch_id is best-effort (only resolvable for an
// at-sale instrument via invoice_id → order.branch_id — a deferred
// règlement's instrument never has one, not a bug).
export interface GcomFinancialInstrumentsGlobalFilters {
    status?: GcomInstrumentStatus;
    instrument_type?: GcomInstrumentType;
    bank_id?: number;
    due_date_from?: string;
    due_date_to?: string;
    branch_id?: number;
    per_page?: number;
    page?: number;
}

// "Remise en banque groupée" — one deposit_date/deposit_reference applied
// to the whole selection in a single bordereau.
export interface GcomBatchDepositPayload {
    instrument_ids: number[];
    deposit_date?: string;
    deposit_reference?: string;
}

// Best-effort, not all-or-nothing (same shape as §16's closeAllForBranch) —
// always 200 even on partial failure; a malformed request (e.g. no
// instrument_ids) still 422s as usual. An id from another company is
// reported in errors as not-found, never silently processed.
export interface GcomBatchDepositResponse {
    success: boolean;
    message?: string;
    data: {
        deposited: GcomFinancialInstrument[];
        errors: { id: number; message: string }[];
        // The one BankDeposit shared by every instrument in this batch —
        // feeds the "Imprimer le bordereau PDF" button shown right after a
        // successful remise groupée.
        bank_deposit_id?: number | null;
    };
}

export interface GcomAccountStatement {
    partner_id: number;
    total_debit: number;
    total_credit: number;
    current_balance: number;
    pending_instruments_total: number;
    credit_limit: number;
    available_credit: number;
}

export interface GcomAccountStatementResponse {
    success: boolean;
    statement: GcomAccountStatement;
}

// Relevé de Compte Global (built 2026-08-30) — company-wide, one row per
// partner, same shape as GcomAccountStatement above (mass-aggregated with a
// fixed ~6 GROUP BY queries server-side, not a per-partner loop over
// statement() — that would N+1 on a large client base). No PDF for this
// list — row click drills into the existing per-partner Relevé de Compte
// tab (ReglementPage.tsx's ?partnerId=&tab=ledger deep link).
export interface GcomPartnerStatementRow {
    partner_id: number;
    partner_name: string;
    partner_code: string;
    total_debit: number;
    total_credit: number;
    current_balance: number;
    pending_instruments_total: number;
    credit_limit: number;
    available_credit: number;
}

export interface GcomPartnerStatementsListFilters {
    branch_id?: number;
    channel?: string;
    min_balance?: number;
    // Default false server-side — clients with zero GCOM activity (no
    // partner_credit_states row) are excluded unless this is set, to avoid
    // silently auto-provisioning credit-state rows for hundreds of clients
    // on every call (the per-partner statement() endpoint does auto-create
    // one on demand; this bulk endpoint deliberately does not).
    // Send 1 (not `true`) or omit the key: axios serializes a JS `false` as
    // the literal string "false" in query params, which Laravel's `boolean`
    // validation rule rejects with a 422.
    include_zero_balance?: 1;
    per_page?: number;
    page?: number;
}

export interface GcomPartnerStatementsListResponse {
    success: boolean;
    statements: GcomPaginator<GcomPartnerStatementRow>;
}

export type GcomLedgerEntryType = 'invoice' | 'payment' | 'credit_note';

export interface GcomLedgerEntry {
    type: GcomLedgerEntryType;
    date: string;
    reference: string;
    debit: number;
    credit: number;
    running_balance: number;
    invoice_id?: number;
    payment_transfer_id?: number;
    credit_note_id?: number;
}

export interface GcomLedgerFilters {
    from?: string; // YYYY-MM-DD
    to?: string;
}

export interface GcomLedgerResponse {
    success: boolean;
    partner_id: number;
    ledger: GcomLedgerEntry[];
}

// ─── Représentants (§18, built 2026-08-27/28) ─────────────────────────────
// A représentant is a plain User holding the gcom_representative Spatie
// role — thin GCOM-scoped façade over User::create()/assignRole(), gated
// manage-gcom, tenant-scoped to the acting admin's own company_id. This is
// now the ONLY valid source for the 3 sale-creation endpoints' salesperson_id
// (App\Rules\IsGcomRepresentative, 422 for anyone else) — do not source that
// picker from a generic employees/commercials list anymore.
export interface GcomRepresentative {
    id: number;
    name: string;
    email: string;
    phone?: string | null;
    code?: string | null;
    branch_id?: number | null;
    company_id?: number;
    is_active: boolean;
    // Only present on GET .../representatives/{user} (the show endpoint),
    // not on the list.
    roles?: string[];
    permissions?: string[];
}

export interface GcomRepresentativesListFilters {
    search?: string;
    branch_id?: number;
    is_active?: boolean;
    per_page?: number;
    page?: number;
}

export interface GcomRepresentativesListResponse {
    success: boolean;
    representatives: GcomPaginator<GcomRepresentative>;
}

export interface GcomRepresentativeShowResponse {
    success: boolean;
    representative: GcomRepresentative;
}

// company_id always defaults to the acting admin's own — never settable here.
export interface GcomCreateRepresentativePayload {
    name: string;
    email: string;
    password: string;
    code?: string;
    branch_id?: number;
    phone?: string;
}

export interface GcomUpdateRepresentativePayload {
    branch_id?: number;
    phone?: string;
    is_active?: boolean;
}

export interface GcomRepresentativeMutationResponse {
    success: boolean;
    message?: string;
    representative: GcomRepresentative;
}

// DELETE removes the gcom_representative role only — the user account
// itself is never deleted (any BC/BL/Facture already attributed via
// sales_rep_id keeps that history, the person just stops being selectable
// for new ones).
export interface GcomRepresentativeRemoveResponse {
    success: boolean;
    message?: string;
}

// ─── Caisses individuelles (2026-08-20) ────────────────────────────────────
// Routing switch: every GCOM cash-in (comptoir/BC/BL sale, deferred
// règlement, and a cash avoir redeem) now credits the CONNECTED USER's own
// USER_CAISSE journal (CU{user_id}-{ESP/CHQ/EFF/VIR}) instead of the
// branch's BRANCH_CAISSE, which becomes a pure coffre fed only by closure
// transfers below. Auto-provisioned for all 4 immediate-settlement methods
// (not just ESP/CHQ) for any user with manage-gcom — card/credit don't get
// one (they settle to a bank account, not a physical drawer).
export type GcomCaisseMethodSuffix = 'ESP' | 'CHQ' | 'EFF' | 'VIR';

export interface GcomCaisse {
    id: number;
    code: string;
    method_suffix: GcomCaisseMethodSuffix;
    balance: number;
    is_active: boolean;
    // 2026-08-21 — multi-session-per-day: a caisse can now be closed and
    // silently reopened (auto, on the next settlement) any number of times
    // within the same calendar day. is_closed_today is kept for back-compat
    // but is now just !has_open_session — has_open_session is the field to
    // gate the Clôturer action on. session_number is null until the caisse
    // has ever been touched today; distinguishing "never touched" (closing
    // is always valid — opens+closes an empty session for the record) from
    // "closed, nothing since" (closing 422s: TREASURY_NO_OPEN_SESSION)
    // requires checking session_number, not just has_open_session alone.
    is_closed_today: boolean;
    has_open_session: boolean;
    session_number: number | null;
}

export interface GcomCaisseListResponse {
    success: boolean;
    data: GcomCaisse[];
}

export interface GcomCloseCaissePayload {
    method_suffix: GcomCaisseMethodSuffix;
    counted_balance: number;
    notes?: string;
}

export interface GcomCaisseClosure {
    id: number;
    company_id: number;
    journal_id: number;
    business_date: string;
    status: 'CLOSED' | string;
    opening_balance: number | string;
    theoretical_closing_balance: number | string;
    counted_balance: number | string;
    discrepancy: number | string;
    notes?: string | null;
    opened_by?: number | null;
    opened_at?: string | null;
    closed_by?: number | null;
    closed_at?: string | null;
}

// Cheque/effet closures settle to the coffre one transfer per instrument
// (an instrument isn't divisible) rather than a single lump sum — `transfers`
// reflects that, length 1 for ESP/VIR, N for CHQ/EFF.
export interface GcomCaisseCloseResult {
    success: boolean;
    message?: string;
    data: {
        closure: GcomCaisseClosure;
        coffre_code: string;
        transfers: { id: number; amount: number | string; status: number }[];
    };
}

// 2026-09-01 — POST /invoices/consolidate. Groups delivery notes from
// SEPARATE orders of the same partner into one invoice — the case
// convert-to-invoice's own "wait for every sibling BL of this order" logic
// can never reach, since a GCOM order can only ever have one BL. `avoir` is
// not a valid payment_method here yet (real method or nothing). All 4
// optional fields are only REQUIRED when the selected BLs' orders disagree
// (different payment methods, different natural souche) — omit them and
// backend auto-resolves when everything naturally agrees; 422 asking for an
// explicit value otherwise. `instrument` still required when overriding to
// cheque/effet.
export interface GcomConsolidateInvoicePayload {
    delivery_note_ids: number[];
    payment_method?: Exclude<GcomPaymentMethod, 'avoir'>;
    payment_term_id?: number | null;
    instrument?: GcomInstrumentInput | null;
    souche_kind?: GcomSoucheKind | null;
}
