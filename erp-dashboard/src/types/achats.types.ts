// ─── Module Achats (BC Fournisseur → Réception → Facture → Règlement) ───────
// Backend doc: docs/modules/30-achats-purchase-orders.md (gcom branch).
// §1-10 (PurchaseOrder/PurchaseReception, commit 0d643c68), §11 (SupplierInvoice
// / 3-way matching, commit bbc073bf), and §12 (SupplierPayment/lettrage,
// commit ff87789e) all confirmed deployed and verified on staging 2026-08-26.

export type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
export type PurchaseReceptionStatus = 'draft' | 'validated' | 'synced_to_erp' | 'cancelled';
export type QcStatus = 'pending' | 'passed' | 'failed' | 'stock_added';

export interface PurchaseOrder {
    id: number;
    order_number: string;
    supplier_id: number;
    branch_code: string;
    ordered_by: number;
    order_date: string;
    expected_delivery_date: string | null;
    status: PurchaseOrderStatus;
    total_quantity: string;
    total_amount: string;
    confirmed_by: number | null;
    confirmed_at: string | null;
    notes: string | null;
    supplier?: { id: number; name: string };
    branch?: { code: string; name: string };
    lines?: PurchaseOrderLine[];
    receptions?: PurchaseReception[];
}

export interface PurchaseOrderLine {
    id: number;
    purchase_order_id: number;
    product_id: number;
    ordered_quantity: string;
    received_quantity: string;
    unit_cost: string | null;
    product?: { id: number; name: string; code: string };
}

export interface PurchaseReception {
    id: number;
    reception_number: string;
    supplier_id: number;
    branch_code: string;
    purchase_order_id: number | null;
    received_by: number;
    supplier_invoice_number: string | null;
    reception_date: string;
    status: PurchaseReceptionStatus;
    total_quantity: string;
    total_amount: string;
    lines: PurchaseReceptionLine[];
    supplier?: { id: number; name: string };
    purchaseOrder?: PurchaseOrder;
}

export interface PurchaseReceptionLine {
    id: number;
    purchase_reception_id: number;
    product_id: number;
    ordered_quantity: string | null;
    received_quantity: string;
    accepted_quantity: string | null;
    rejected_quantity: string;
    unit_cost: string;
    lot_number: string | null;
    batch_number: string | null;
    expiration_date: string | null;
    qc_status: QcStatus;
    product?: { id: number; name: string; code: string };
}

// ─── Paginator (same shape as GcomPaginator, kept local to avoid a cross-
// module dependency for one shared shape) ────────────────────────────────────
export interface AchatsPaginator<T> {
    current_page: number;
    data: T[];
    per_page: number;
    total: number;
    last_page: number;
}

// Sélecteur fournisseur — GET /purchase-orders/suppliers (§3.8, added
// 2026-08-26 specifically to fix a real bug: the UI was calling GET
// /partners, which returns customers not suppliers. GET /suppliers and
// GET /master-data/suppliers exist too but are gated manage-products/
// manage-master-data (root/admin only) — this one is gated
// browse-purchase-orders (root/admin/magasinier), matching who can actually
// create a BC. No query params, no pagination — flat array, filter client-side.
export interface PurchaseOrderSupplier {
    id: number;
    name: string;
    contact_name: string | null;
    phone: string | null;
}

export interface PurchaseOrderSuppliersResponse {
    success: boolean;
    data: PurchaseOrderSupplier[];
}

// ─── Purchase Orders — requests/responses ────────────────────────────────────

export interface PurchaseOrderListFilters {
    status?: PurchaseOrderStatus;
    supplier_id?: number;
    branch_code?: string;
    search?: string;
    per_page?: number;
    page?: number;
}

export interface PurchaseOrderListResponse {
    success: boolean;
    data: AchatsPaginator<PurchaseOrder>;
}

export interface PurchaseOrderShowResponse {
    success: boolean;
    data: PurchaseOrder;
}

export interface PurchaseOrderLinePayload {
    product_id: number;
    ordered_quantity: number;
    unit_cost?: number;
}

// branch_code REMOVED from the payload 2026-08-27 (security fix, commit
// 50f9379e) — a cross-tenant vuln let a client-supplied branch_code bypass
// company ownership checks (existence was verified, not ownership). No
// override, even for admin/root — the branch is now always resolved
// server-side from the authenticated user. Sending it is silently ignored,
// not rejected, but don't send it — removed the field entirely rather than
// leave a dead client-side picker.
export interface CreatePurchaseOrderPayload {
    supplier_id: number;
    order_date?: string;
    expected_delivery_date?: string;
    notes?: string;
    lines: PurchaseOrderLinePayload[];
}

export interface PurchaseOrderMutationResponse {
    success: boolean;
    message?: string;
    data: PurchaseOrder;
}

export interface CancelPurchaseOrderPayload {
    reason: string;
}

// ─── Purchase Receptions — requests/responses ────────────────────────────────

export interface PurchaseReceptionListFilters {
    status?: PurchaseReceptionStatus;
    supplier_id?: number;
    branch_code?: string;
    purchase_order_id?: number;
    per_page?: number;
    page?: number;
}

export interface PurchaseReceptionListResponse {
    success: boolean;
    data: AchatsPaginator<PurchaseReception>;
}

export interface PurchaseReceptionShowResponse {
    success: boolean;
    data: PurchaseReception;
}

export interface PurchaseReceptionLinePayload {
    product_id: number;
    received_quantity: number;
    // Required (confirmed live 2026-08-26 — a 422 on
    // "The lines.0.unit_cost field is required" when omitted). Unlike
    // PurchaseOrderLinePayload's unit_cost (genuinely optional per doc §3.3,
    // a BC can be raised before a price is known), a reception is recording
    // what was actually received at what actual cost, so the doc's §4.1
    // example JSON always including it was the real signal, not a stray
    // example choice.
    unit_cost: number;
}

// branch_code REMOVED 2026-08-27 — see CreatePurchaseOrderPayload's comment.
export interface CreatePurchaseReceptionPayload {
    supplier_id: number;
    purchase_order_id?: number | null;
    reception_date?: string;
    supplier_invoice_number?: string;
    lines: PurchaseReceptionLinePayload[];
}

export interface PurchaseReceptionMutationResponse {
    success: boolean;
    message?: string;
    data: PurchaseReception;
}

export interface CancelPurchaseReceptionPayload {
    reason: string;
}

// ─── Facture Fournisseur & 3-Way Matching (added 2026-08-26, §11) ────────────
// Ancré sur purchase_order_lines, pas directement sur une réception —
// received_quantity s'accumule déjà sur toutes les réceptions validées
// contre une ligne de BC, donc une facture peut consolider plusieurs
// livraisons. No `draft` status — matching runs synchronously on
// create/update, so a persisted invoice is always already pending_review or
// matched.

export type SupplierInvoiceStatus = 'pending_review' | 'matched' | 'approved' | 'cancelled';
export type MatchStatus = 'matched' | 'discrepancy' | 'unmatched';
export type SupplierInvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

export interface SupplierInvoice {
    id: number;
    invoice_number: string;
    supplier_invoice_reference: string | null;
    supplier_id: number;
    branch_code: string;
    invoice_date: string;
    due_date: string | null;
    status: SupplierInvoiceStatus;
    subtotal: string;
    tax_amount: string;
    total_amount: string;
    has_discrepancy: boolean;
    created_by: number;
    approved_by: number | null;
    approved_at: string | null;
    lines: SupplierInvoiceLine[];
    supplier?: { id: number; name: string };
    // Confirmed live on staging 2026-08-27 — the original §11.7 TS block
    // predated the Règlements Fournisseurs migration and was never updated.
    // `remaining_amount` is the real outstanding balance — use this for the
    // manual-lettering picker, not `total_amount` (see the fixed gap note
    // in [[project_achats_module]]).
    paid_amount: string;
    remaining_amount: string;
    payment_status: SupplierInvoicePaymentStatus;
}

export interface SupplierInvoiceLine {
    id: number;
    supplier_invoice_id: number;
    purchase_order_line_id: number | null;
    purchase_reception_line_id: number | null;
    product_id: number;
    invoiced_quantity: string;
    unit_cost: string;
    tax_percent: string | null;
    line_total: string;
    quantity_variance_percent: string | null;
    price_variance_percent: string | null;
    match_status: MatchStatus;
    product?: { id: number; name: string; code: string };
}

export interface SupplierInvoiceListFilters {
    status?: SupplierInvoiceStatus;
    supplier_id?: number;
    branch_code?: string;
    per_page?: number;
    page?: number;
}

export interface SupplierInvoiceListResponse {
    success: boolean;
    data: AchatsPaginator<SupplierInvoice>;
}

export interface SupplierInvoiceShowResponse {
    success: boolean;
    data: SupplierInvoice;
}

export interface SupplierInvoiceLinePayload {
    purchase_order_line_id: number;
    product_id: number;
    invoiced_quantity: number;
    unit_cost: number;
    tax_percent?: number;
    purchase_reception_line_id?: number;
}

// branch_code REMOVED 2026-08-27 — see CreatePurchaseOrderPayload's comment.
export interface CreateSupplierInvoicePayload {
    supplier_id: number;
    supplier_invoice_reference?: string;
    invoice_date?: string;
    lines: SupplierInvoiceLinePayload[];
}

export interface SupplierInvoiceMutationResponse {
    success: boolean;
    message?: string;
    data: SupplierInvoice;
}

export interface CancelSupplierInvoicePayload {
    reason: string;
}

// ─── Règlements Fournisseurs & Lettrage Achat (added 2026-08-26, §12) ────────
// Mirror of the sales-side PaymentTransfer/Lettering system (GcomPayment/
// GcomLetteringSummary in gcom.types.ts) — field names below follow that
// mirror wherever the doc didn't give an explicit shape, EXCEPT where the
// doc's own JSON/prose gave different literal names (instrument_reference/
// maturity_date, not GCOM's nested `instrument: {reference_number, due_date}`
// object — don't "fix" that back to match GCOM, it's genuinely different here).
//
// No §12 TypeScript block exists in the doc (unlike §8/§11.7) — these types
// are inferred from the JSON examples + prose, not transcribed verbatim.
// `status` is left as a loose string (not a literal union) since the doc only
// describes a cheque/effet-specific issued→cleared/rejected lifecycle, not a
// confirmed universal enum covering cash/transfer too.
//
// ⚠️ Sign convention is INVERTED vs the customer statement (GcomAccountStatement/
// GcomLedgerEntry): here `credit` = Facturé (increases what we owe),
// `debit` = Réglé (decreases it), `current_balance` = credit − debit = what
// we still owe the supplier. A negative current_balance is a genuine credit/
// avance we hold with that supplier (we overpaid) — same "avance" concept as
// the customer side, just from the other side of the relationship. Do NOT
// reuse soldeDisplay()-style helpers from ReglementPage.tsx without renaming
// the labels ("Dû"/"Avance" mean the opposite direction here).
export interface SupplierPayment {
    id: number;
    code: string;
    supplier_id: number;
    branch_code: string;
    amount: string;
    payment_method_id: number;
    instrument_reference: string | null;
    maturity_date: string | null;
    status: string;
    reconciled_amount: string;
    remaining_amount: string;
    notes: string | null;
    payment_date?: string;
    supplier?: { id: number; name: string };
    letterings?: SupplierPaymentLettering[];
}

export interface SupplierPaymentLettering {
    id: number;
    supplier_payment_id: number;
    supplier_invoice_id: number;
    amount: string;
    supplier_invoice?: { id: number; invoice_number: string };
}

export interface SupplierPaymentAllocationInput {
    supplier_invoice_id: number;
    amount: number;
}

// branch_code REMOVED 2026-08-27 — see CreatePurchaseOrderPayload's comment.
export interface CreateSupplierPaymentPayload {
    supplier_id: number;
    amount: number;
    payment_method_id: number;
    instrument_reference?: string;
    maturity_date?: string;
    notes?: string;
    allocations?: SupplierPaymentAllocationInput[];
    // Default true server-side when `allocations` is omitted — auto-letters
    // the supplier's oldest `approved` invoices. Send `false` with no
    // `allocations` for a pure advance/acompte with no imputation.
    auto_letter?: boolean;
}

export interface SupplierPaymentMutationResponse {
    success: boolean;
    message?: string;
    data: SupplierPayment;
}

export interface LetterSupplierPaymentPayload {
    allocations: SupplierPaymentAllocationInput[];
}

// Confirmed live 2026-08-27 — required, 10-500 chars, same convention as
// every other cancel in this module (was omitted from the §12.3 example).
export interface CancelSupplierPaymentPayload {
    reason: string;
}

// GET /supplier-payments — confirmed live 2026-08-27, existed since the same
// commit as POST but was undocumented in §12 (a doc gap, not a missing
// endpoint — see [[project_achats_module]]).
export interface SupplierPaymentListFilters {
    supplier_id?: number;
    status?: string;
    branch_code?: string;
    per_page?: number;
    page?: number;
}

export interface SupplierPaymentListResponse {
    success: boolean;
    data: AchatsPaginator<SupplierPayment>;
}

// GET /supplier-payments/{id} — loads letterings.supplierInvoice, needed to
// letter/unletter/cancel an existing (not just just-created) payment.
export interface SupplierPaymentShowResponse {
    success: boolean;
    data: SupplierPayment;
}

export interface SupplierAccountStatement {
    supplier_id: number;
    supplier_name: string;
    total_credit: number;
    total_debit: number;
    current_balance: number;
}

export interface SupplierAccountStatementResponse {
    success: boolean;
    data: SupplierAccountStatement;
}

export interface SupplierLedgerEntry {
    type: 'invoice' | 'payment';
    date: string;
    reference: string;
    debit: number;
    credit: number;
    running_balance: number;
    supplier_invoice_id?: number;
    supplier_payment_id?: number;
}

export interface SupplierLedgerFilters {
    from?: string;
    to?: string;
}

export interface SupplierLedgerResponse {
    success: boolean;
    supplier_id: number;
    ledger: SupplierLedgerEntry[];
}

export interface SupplierPaymentsStatementsListFilters {
    min_balance?: number;
    per_page?: number;
    page?: number;
}

export interface SupplierPaymentsStatementsListResponse {
    success: boolean;
    data: AchatsPaginator<SupplierAccountStatement>;
}
