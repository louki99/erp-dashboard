// ─── Stock Management Types ───────────────────────────────────────────────────
// Maps to /api/backend/stock-management endpoints defined in stock.md

export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
}

// ─── Stock Item (from GET /stocks) ────────────────────────────────────────────

export interface StockProduct {
    id: number;
    code: string;
    name: string;
}

export interface StockItem {
    id: number;
    branch_code: string;
    product_id: number;
    quantity: string;
    reserved_quantity: string;
    available_quantity: string;
    effective_available: number;
    product: StockProduct;
    updated_at?: string;
    created_at?: string;
}

export interface StockListResponse {
    success: boolean;
    data: {
        data: StockItem[];
        current_page: number;
        last_page: number;
        per_page?: number;
        total?: number;
    };
}

export interface StockFilters {
    branch_code: string;
    search?: string;
    low_stock?: boolean;
    out_of_stock?: boolean;
    page?: number;
    per_page?: number;
}

// ─── Stock Movement (from GET /movements) ─────────────────────────────────────

export type MovementType = 'purchase' | 'sale' | 'adjustment' | 'transfer_in' | 'transfer_out' | 'return';
export type MovementStatus = 'CONFIRMED' | 'PROVISIONAL' | 'REVERSED';
export type SourceSystem = 'X3' | 'POS' | 'MOBILE' | 'ADJUSTMENT';

export interface StockMovement {
    id: number;
    branch_code: string;
    product_id: number;
    quantity: string;
    type: MovementType;
    movement_status: MovementStatus;
    source_system: SourceSystem;
    reference_type?: string;
    reference_id?: number | null;
    external_reference?: string;
    notes?: string;
    created_at?: string;
    updated_at?: string;
    product?: StockProduct;
}

export interface MovementFilters {
    branch_code: string;
    type?: MovementType;
    movement_status?: MovementStatus;
    source_system?: SourceSystem;
    product_id?: number;
    date_from?: string;
    date_to?: string;
    page?: number;
    per_page?: number;
}

export interface MovementListResponse {
    success: boolean;
    data: {
        data: StockMovement[];
        current_page: number;
        last_page: number;
        per_page?: number;
        total?: number;
    };
}

// ─── Effective Stock Breakdown (from GET /effective) ──────────────────────────

export interface EffectiveStockBreakdown {
    confirmed: number;
    provisional: number;
    reserved: number;
    effective: number;
}

export interface EffectiveStockResponse {
    success: boolean;
    data: EffectiveStockBreakdown;
}

export interface EffectiveStockFilters {
    product_id: number;
    branch_code?: string;
}

// ─── Create Provisional Movement (POST /provisional) ─────────────────────────

export interface CreateProvisionalRequest {
    branch_code: string;
    product_id: number;
    quantity: number;
    type: Exclude<MovementType, 'sale'>;
    reference_type?: string;
    reference_id?: number | null;
    external_reference?: string;
    notes?: string;
}

// ─── Reconcile From X3 (POST /reconcile-x3) ─────────────────────────────────

export interface ReconcileX3Request {
    branch_code: string;
    product_id: number;
    quantity: number;
    type: MovementType;
    external_reference?: string;
    notes?: string;
}
