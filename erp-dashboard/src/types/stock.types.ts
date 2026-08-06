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
    // delivery_van is intentionally NOT creatable here — POST /warehouses rejects it
    // (DB CHECK: a van warehouse must have a vehicle_id). Van warehouses are auto-
    // provisioned via POST /rbac/users/{id}/logistics with a vehicle_id.
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

// Terminal states per backend spec (2026-08): a BP in any of completed,
// completed_full, completed_partial, rejected or cancelled returns 422 on
// PUT ("Cannot edit a <status> preparation bill.") — never send a mutation once reached.
export type BPStatus = 'pending' | 'in_progress' | 'completed' | 'completed_full' | 'completed_partial' | 'rejected' | 'cancelled';

export interface PreparationBillItem {
    id: number;
    bon_preparation_id: number;
    order_id: number;
    product_id: number;
    requested_quantity: string;
    // Stock on hand at the time of the response — present on show/store/update,
    // not to be confused with prepared_quantity (only set once picking starts).
    available_quantity?: string;
    prepared_quantity?: string;
    shortage_quantity?: string;
    product?: {
        id: number;
        code: string;
        name: string;
        barcode?: string | null;
    };
}

export interface PreparationBill {
    id: number;
    bp_number: string;
    status: BPStatus;
    // Write payload (POST/PUT) takes an int 1-5, but the API resource has been
    // observed echoing it back as a label string (e.g. "normal") on read — accept both.
    priority_level: number | string;
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

// GET /stock/preparation-bills/magasiniers — dedicated picker source (2026-08),
// replaces the generic /masterdata/users list for the magasinier_id field.
export interface PreparationBillMagasinier {
    id: number;
    name: string;
    email: string;
    branch_id: number | null;
}

export interface PreparationBillMagasiniersResponse {
    success: boolean;
    magasiniers: PreparationBillMagasinier[];
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

// ═══════════════════════════════════════════════════════════════════════════════
// WMS Tier 2/3  (22-stock-wms.md)
// ═══════════════════════════════════════════════════════════════════════════════

// ─── Stock Levels ─────────────────────────────────────────────────────────────

export interface StockLevelRow {
    id: number;
    product_id: number;
    quantity: string;
    reserved_quantity: string;
    available_quantity: string;
    minimum_quantity: string;
    maximum_quantity: string | null;
    warehouse_code: string;
    branch_id: number | null;
    storage_location_id: number | null;
    product: { id: number; name: string; code: string; barcode: string | null };
    warehouse: { code: string; name: string; type: 'central' | 'delivery_van' | 'system_virtual'; branch_code: string };
    storage_location: {
        id: number;
        location_code: string;
        location_name: string;
        location_type: 'DEPOT' | 'SELLABLE' | 'DAMAGED' | 'EXPIRED' | 'QUARANTINE' | 'SCRAP' | 'RETURN_TO_SUPPLIER' | 'DELIVERY_VAN';
    } | null;
}

export interface StockLevelFilters {
    warehouse_id?: number;
    storage_location_id?: number;
    product_id?: number;
    branch_id?: number;
    low_stock_only?: boolean;
    page?: number;
    per_page?: number;
}

export interface StockLevelListResponse {
    success: boolean;
    data: {
        current_page: number;
        data: StockLevelRow[];
        per_page: number;
        total: number;
        last_page: number;
    };
}

// ─── Pick Tasks ───────────────────────────────────────────────────────────────

export type PickTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

export interface WmsPickTask {
    id: number;
    preparation_order_id: number;
    storage_location_id: number;
    product_id: number;
    quantity_to_pick: number;
    actual_picked_quantity: number | null;
    sequence_number: number;
    status: PickTaskStatus;
    completed_at: string | null;
    completed_by: number | null;
    product: { id: number; name: string; code: string };
    storage_location: { id: number; location_code: string; location_name: string; location_type: string };
}

export interface WmsPickTaskFilters {
    preparation_order_id?: number;
    status?: PickTaskStatus | 'completed';
    page?: number;
    per_page?: number;
}

export interface WmsPickTaskListResponse {
    success: boolean;
    data: {
        data: WmsPickTask[];
        total: number;
    };
}

export interface CompletePickTaskPayload {
    actual_picked_quantity: number;
    stock_batch_id?: number;
    notes?: string;
}

// ─── Batch Expiry ─────────────────────────────────────────────────────────────

export type BatchAlertStatus = 'OK' | 'WARNING' | 'EXPIRED' | 'QUARANTINE';
export type StockBatchStatus = 'active' | 'expired' | 'quarantine' | 'depleted';

export interface StockBatchExpiryRow {
    id: number;
    product_id: number;
    branch_code?: string;
    warehouse_code?: string;
    batch_number: string;
    production_date: string | null;
    expiry_date: string;
    quantity: string;
    reserved_quantity?: string;
    initial_quantity?: string;
    status: StockBatchStatus;
    notes: string | null;
    alert_status: BatchAlertStatus;
    days_until_expiry: number;
    product: { id: number; name: string; code: string };
}

export interface BatchExpiryFilters {
    warehouse_code?: string;
    product_id?: number;
    include_all?: boolean;
    page?: number;
    per_page?: number;
}

export interface BatchExpiryListResponse {
    success: boolean;
    data: {
        data: StockBatchExpiryRow[];
        total: number;
    };
    lot_expiry_alert_days?: number;
}

export interface BulkBatchActionPayload {
    stock_batch_ids: number[];
    reason?: string;
}

// ─── Goods Receipt — POST /wms/receipts ───────────────────────────────────────

export interface GoodsReceiptItemPayload {
    product_id: number;
    quantity: number;
    storage_location_id: number;
    batch_number?: string;
    production_date?: string;
    expiry_date?: string;
}

export interface GoodsReceiptPayload {
    supplier_id?: number;
    warehouse_id: number;
    items: GoodsReceiptItemPayload[];
}

export interface GoodsReceiptResponse {
    success: boolean;
    message: string;
    data: {
        movements: Array<{
            id: number;
            warehouse_code: string;
            product_id: number;
            type: 'purchase';
            quantity: string;
            balance_after: string;
            stock_batch_id: number | null;
        }>;
        batches: Array<{
            id: number;
            product_id: number;
            batch_number: string;
            expiry_date: string | null;
            quantity: string;
            status: StockBatchStatus;
        }>;
    };
}

// ─── Transfer — POST /wms/transfers ──────────────────────────────────────────

export interface TransferItemPayload {
    product_id: number;
    quantity: number;
    stock_batch_id?: number;
}

export interface TransferPayload {
    source_warehouse_id: number;
    destination_warehouse_id: number;
    items: TransferItemPayload[];
}

export interface TransferResponse {
    success: boolean;
    message: string;
    data: {
        movements: Array<{
            id: number;
            warehouse_code: string;
            type: 'transfer_out' | 'transfer_in';
            quantity: string;
            balance_after: string;
            stock_batch_id: number | null;
            reference_id: number | null;
        }>;
    };
}

// ─── Adjustment — POST /wms/adjustments ──────────────────────────────────────
// performed_by_user_id is accepted but IGNORED server-side — do NOT send it.

export interface AdjustmentPayload {
    warehouse_id: number;
    storage_location_id: number;
    product_id: number;
    quantity: number;       // signed: negative = loss, positive = surplus, cannot be 0
    reason_code: string;    // required, max 50 chars
    notes?: string;
}

export interface AdjustmentResponse {
    success: boolean;
    message: string;
    data: {
        movement: {
            id: number;
            warehouse_code: string;
            product_id: number;
            type: 'adjustment';
            quantity: string;
            balance_after: string;
        };
        stock: StockLevelRow;
    };
}
