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

export type GcomPaymentMethod = 'cash' | 'card' | 'credit' | 'cheque' | 'effet' | 'transfer';

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

export interface GcomDirectInvoicePayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    notes?: string;
    payment_term_id?: number | null;
    instrument?: GcomInstrumentInput | null;
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
// Verified live: this does NOT close the treasury-unification gap for pure
// cash/card comptoir settlements — an invoice can be `fully_paid` with
// `payments: []` (no payment_transfers row was ever created for it), while
// cheque/effet and manually-registered règlements do appear correctly. Don't
// treat an empty array as "not yet paid" without checking `status` first.
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
}

export interface GcomCreditNote {
    id: number;
    status: GcomCreditNoteStatus;
    total_amount: number | string;
    refund_amount: number | string;
    reason?: string;
    created_at?: string;
    items?: GcomCreditNoteItem[];
}

export interface GcomCreditNotesListResponse {
    success: boolean;
    credit_notes: GcomCreditNote[];
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
}

export interface GcomCreateOrderPayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    payment_term_id?: number | null;
    notes?: string;
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
export type GcomBlStatus = 'delivered' | 'cancelled';

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
// Verified live: `/statement`'s total_credit/current_balance and `/ledger`'s
// "payment" entries only reflect manually-registered règlements (POST
// /payments) — NOT the "treasury unification" payment_transfers rows the
// backend creates automatically for cash/card/cheque/effet settlements at
// comptoir/BC/BL creation. Proof: a partner with 2 invoices both fully_paid
// via comptoir cash, zero manual règlements, shows total_credit:0 and
// current_balance == total_debit (i.e. reports the partner owing the full
// invoiced amount despite already being paid). Do NOT use total_credit/
// current_balance to show "how much does this client owe" — sum invoice
// remaining_amount instead (verified correct). pending_instruments_total
// IS correct (matches summing /financial-instruments directly) and
// credit_limit is a static config value — both safe to use as-is.
// available_credit inherits the same staleness caveat as the credit-v2
// snapshot (same underlying engine per backend).
export type GcomInstrumentType = 'CHEQUE' | 'EFFET';
export type GcomInstrumentStatus = 'PENDING' | 'DEPOSITED' | 'CLEARED' | 'REJECTED';

export interface GcomFinancialInstrument {
    id: number;
    partner_id: number;
    instrument_type: GcomInstrumentType;
    reference_number: string;
    amount: number | string;
    currency?: string;
    issue_date?: string | null;
    due_date: string | null;
    bank_name?: string | null;
    bank_account?: string | null;
    status: GcomInstrumentStatus;
    rejection_reason?: string | null;
    invoice_id?: number | null;
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

export interface GcomAccountStatement {
    partner_id: number;
    total_debit: number;
    total_credit: number; // see caveat above — excludes auto-settled comptoir/BC/BL payments
    current_balance: number; // see caveat above — inherits total_credit's gap
    pending_instruments_total: number;
    credit_limit: number;
    available_credit: number; // may be stale, see caveat above
}

export interface GcomAccountStatementResponse {
    success: boolean;
    statement: GcomAccountStatement;
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
