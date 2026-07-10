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

// ═══════════════════════════════════════════════════════════════════════════════
// Warehouse & Storage Locations  (STOCK_WAREHOUSE_API.md)
// ═══════════════════════════════════════════════════════════════════════════════

export type WarehouseType = 'central' | 'delivery_van' | 'system_virtual';

export interface Warehouse {
    id: number;
    code: string;
    name: string;
    type: WarehouseType;
    branch_code: string;
    is_active: boolean;
    storage_locations_count?: number;
    created_at: string;
    updated_at: string;
}

export interface WarehouseListResponse {
    warehouses: {
        data: Warehouse[];
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
    };
}

export interface WarehouseFilters {
    branch_id?: number;
    branch_code?: string;
    type?: WarehouseType;
    active_only?: boolean;
    search?: string;
    per_page?: number;
}

export interface CreateWarehousePayload {
    branch_id: number;
    name: string;
    type?: 'central' | 'system_virtual';
    code?: string;
    is_active?: boolean;
}

export interface UpdateWarehousePayload {
    name?: string;
    is_active?: boolean;
    branch_id?: number;
    code?: string;
}

export type StorageLocationType =
    | 'SELLABLE'
    | 'DAMAGED'
    | 'EXPIRED'
    | 'QUARANTINE'
    | 'SCRAP'
    | 'RETURN_TO_SUPPLIER'
    | 'DEPOT'
    | 'DELIVERY_VAN'
    | 'VIRTUAL';

export interface StorageLocation {
    id: number;
    warehouse_id: number;
    branch_code: string;
    location_code: string;
    location_name: string;
    location_type: StorageLocationType;
    description: string | null;
    capacity: number | null;
    current_count: number;
    is_active: boolean;
    requires_supervisor: boolean;
    metadata: Record<string, unknown> | null;
}

export interface WarehouseLocationsResponse {
    warehouse: Pick<Warehouse, 'id' | 'code' | 'name' | 'type' | 'is_active'>;
    locations: StorageLocation[];
}

export interface CreateLocationPayload {
    location_type: Exclude<StorageLocationType, 'DELIVERY_VAN'>;
    location_name: string;
    location_code?: string;
    description?: string | null;
    capacity?: number | null;
    requires_supervisor?: boolean;
    is_active?: boolean;
}

export interface UpdateLocationPayload {
    location_type?: Exclude<StorageLocationType, 'DELIVERY_VAN'>;
    location_name?: string;
    is_active?: boolean;
    capacity?: number | null;
    description?: string | null;
    requires_supervisor?: boolean;
}

// ─── Stock (read-only consultation) ──────────────────────────────────────────

export interface StockRow {
    id: number;
    warehouse_code: string;
    branch_id: number;
    product_id: number;
    quantity: string;
    reserved_quantity: string;
    available_quantity: string;
    minimum_quantity: string;
    maximum_quantity: string;
    product?: {
        id: number;
        name: string;
        reference: string;
        barcode: string | null;
    };
}

export interface StockRowListResponse {
    success: boolean;
    data: {
        current_page: number;
        data: StockRow[];
        total: number;
        per_page: number;
    };
}

export interface StockSummary {
    total_quantity: number;
    total_reserved: number;
    total_available: number;
    distinct_products: number;
    estimated_value: number;
}

export interface StockSummaryResponse {
    success: boolean;
    data: StockSummary;
}

export interface StockRowFilters {
    branch_id?: number;
    warehouse_code?: string;
    product_id?: number;
    location_type?: StorageLocationType;
    per_page?: number;
    page?: number;
}

// ─── Preparation Bills ────────────────────────────────────────────────────────

export type BPStatus = 'pending' | 'in_progress' | 'completed' | 'rejected';

export interface PreparationBillItem {
    id: number;
    bon_preparation_id: number;
    order_id: number;
    product_id: number;
    requested_quantity: string;
    prepared_quantity: string;
    shortage_quantity: string;
    product?: {
        id: number;
        reference: string;
        name: string;
        barcode: string | null;
    };
}

export interface PreparationBill {
    id: number;
    bp_number: string;
    status: BPStatus;
    priority_level: number;
    deadline: string | null;
    estimated_completion: string | null;
    notes: string | null;
    total_items: number;
    prepared_items: number;
    items_count?: number;
    magasinier: { id: number; name: string; email?: string } | null;
    delivery_mission: { id: number; code: string } | null;
    items?: PreparationBillItem[];
    created_at: string;
    updated_at: string;
}

export interface PreparationBillListResponse {
    preparation_bills: {
        data: PreparationBill[];
        total: number;
        per_page: number;
        current_page?: number;
        last_page?: number;
    };
}

export interface PreparationBillDetailResponse {
    preparation_bill: PreparationBill;
}

export interface BPFilters {
    status?: BPStatus;
    magasinier_id?: number;
    delivery_mission_id?: number;
    from_date?: string;
    to_date?: string;
    search?: string;
    per_page?: number;
    page?: number;
}

export interface CreatePreparationBillPayload {
    order_ids: number[];
    magasinier_id?: number | null;
    delivery_mission_id?: number | null;
    priority_level?: number;
    deadline?: string | null;
    notes?: string | null;
}

export interface UpdatePreparationBillPayload {
    magasinier_id?: number | null;
    priority_level?: number;
    deadline?: string | null;
    estimated_completion?: string | null;
    notes?: string | null;
    status?: 'pending' | 'in_progress';
    items?: { id: number; requested_quantity: number }[];
    add_order_ids?: number[];
}
