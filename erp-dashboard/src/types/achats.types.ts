// ─── Module Achats (BC Fournisseur → Réception → Stock) ─────────────────────
// Backend doc: docs/modules/30-achats-purchase-orders.md (gcom branch, commit
// 0d643c68, 2026-08-26). Migrations not yet on staging at doc-writing time —
// a 404/500 on any endpoint here is expected until backend confirms
// deployment, not a frontend bug (see [[project_achats_module]] memory).

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

export interface CreatePurchaseOrderPayload {
    supplier_id: number;
    branch_code: string;
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
    unit_cost?: number;
}

export interface CreatePurchaseReceptionPayload {
    supplier_id: number;
    branch_code: string;
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
