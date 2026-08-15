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
    items?: GcomInvoiceItem[];
    partner?: { id: number; name: string; code?: string };
    order?: { id: number; order_code?: string; bc_status?: string; delivery_notes?: GcomDeliveryNoteRef[]; financial_metadata?: GcomOrderFinancialMetadata };
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

// §8 documents `POST /orders/{order}/convert-to-bl` as taking no body — these
// two fields are sent anyway (UI asks for them) pending backend confirmation
// that they're actually read/persisted. Don't assume they take effect yet.
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
