// Real BP status glossary (docs/modules/16-magasinier.md §3) — was previously missing the
// shortage/rework states entirely, which is why report_shortage/continue_preparation's resulting
// statuses had nowhere to land in the type system.
export type BonPreparationStatus =
    | 'pending'
    | 'in_progress'
    | 'completed_full'
    | 'completed_partial'
    | 'partial_rework_requested'
    | 'awaiting_shortage_review'
    | 'shortage_split_done'
    | 'shortage_accepted'
    | 'rejected';

// 2026-06-22 breaking change (backend Magasinier refactor, docs §5/§6): bonChargement/
// logisticsBatch fields were removed from every Magasinier response (preparations list, BP
// detail, dashboard) and replaced by `delivery_mission` — a BP now belongs to a mission, the same
// as a BL does on the dispatcher side. Do not reintroduce BonChargement/LogisticsBatch here.
export interface PreparationDeliveryMission {
    id: number;
    mission_number: string;
    status: string;
    rider?: { id: number; name: string; phone?: string } | null;
    delivery_notes?: Array<{ id: number; delivery_number: string; status?: string; partner?: { id: number; name: string } }>;
}

export interface BonPreparation {
    id: number;
    bp_number: string;
    status: BonPreparationStatus;
    magasinier_id?: number;
    notes?: string | null;
    rejection_reason?: string | null;
    total_items?: number;
    prepared_items?: number;
    preparation_efficiency?: number | null;
    total_shortage_percentage?: number;
    is_critical_shortage?: boolean;
    priority_level?: 'normal' | 'high' | 'urgent' | string;
    deadline?: string | null;
    shortage_acknowledged?: boolean;
    created_at: string;
    updated_at?: string;
    prepared_at?: string | null;
    rejected_at?: string | null;
    delivery_mission?: PreparationDeliveryMission | null;
    items?: BonPreparationItem[];
    magasinier?: Magasinier | null;
}

export interface BonPreparationItem {
    id: number;
    bon_preparation_id?: number;
    product_id: number;
    requested_quantity: number;
    available_quantity: number;
    prepared_quantity?: number;
    shortage_quantity?: number;
    shortage_reason?: string | null;
    delivery_note_item_id?: number | null;
    product?: Product;
}

export interface Product {
    id: number;
    name: string;
    code?: string;
    sku?: string;
    unit?: string;
}

export interface Magasinier {
    id: number;
    name: string;
    email?: string;
}

export interface Stock {
    id: number;
    product_id: number;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    min_stock_level?: number;
    minimum_quantity?: number;
    product?: Product;
}

export interface StockMovement {
    id: number;
    product_id?: number;
    type: 'purchase' | 'sale' | 'adjustment' | 'reservation' | 'reservation_release' | 'release' | 'transfer_in' | 'transfer_out' | 'return';
    quantity: number;
    balance_after?: number;
    notes?: string;
    user_id?: number;
    created_at: string;
    product?: Product;
    user?: { id: number; name: string } | null;
}

// readyToPrepare REMOVED 2026-06-22 (docs §5) — counted confirmed BCs not yet in a BP, a concept
// that no longer exists (BC → mission → BL → BP is entirely dispatcher-owned now; see
// GET /dispatcher/orders/pending instead). Do not reintroduce this field.
export interface DashboardStats {
    pendingPreparations: number;
    inProgress: number;
    completedToday: number;
    lowStockItems: number;
    pendingBps?: BonPreparation[];
}

export interface BatchPickingSession {
    id: number;
    status: 'active' | 'completed';
    created_at: string;
    completed_at?: string;
}

// GET /magasinier/preparations/pending returns the raw Laravel paginator directly (docs §6.1 —
// `MagasinierController::pendingPreparations()` returns `$paginator->toArray()`, no success/data
// wrapper). Flat, not nested under `data.bonPreparations` like the old type incorrectly assumed.
export interface PreparationsResponse {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    data: BonPreparation[];
    list_scope_applied?: string;
    list_scope_help?: Record<string, string>;
}

// GET /magasinier/preparations/{id} also returns the BP flat, no wrapper (docs §6.2).
export type BonPreparationDetailResponse = BonPreparation;

export interface StockResponse {
    success: boolean;
    data?: {
        stock: {
            data: Stock[];
            current_page: number;
            last_page: number;
            per_page: number;
            total: number;
        };
    };
}

// Uniform decision response envelope, 2026-06-22 breaking change (docs §6 intro): every BP
// decision (start_preparation, update_preparation, complete_preparation, reject_preparation)
// returns { success, message, decision, output } — the payload moved from `data` to `output`.
// report_shortage/continue_preparation's doc examples (§6.7/§6.8) still show the old `data` key
// and aren't marked "verified live" like the others — kept both fields on those two response
// types defensively until confirmed live, instead of assuming the doc's prose note applies
// uniformly to every decision without exception.
export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
    decision?: string;
    redirect?: string;
    output?: unknown;
}

export interface SavePreparationRequest {
    prepared_quantities: Record<string, number>;
    notes?: string;
}

export interface RejectPreparationRequest {
    rejection_reason: string;
}

// start_preparation output (docs §6.3, verified live against StartPreparationDecision::doExecute()).
export interface StartPreparationOutput {
    bp_id: number;
    bp_number: string;
    status: BonPreparationStatus;
    magasinier: string;
    bl_count: number;
    stock_warnings: Array<{ product_id: number; product_name: string; requested_qty: number; available_qty: number; shortage_qty: number }>;
}

export interface StartPreparationResponse extends ApiSuccessResponse {
    output?: StartPreparationOutput;
}

// update_preparation output (docs §6.4, verified live) — PUT .../items, incremental save while
// picking. Not currently wired into the UI (preparedQuantities are only submitted all at once via
// complete_preparation) — added for when that gets built.
export interface UpdatePreparationOutput {
    bp_id: number;
    bp_number: string;
    status: BonPreparationStatus;
    updated_items: Array<{ product_id: number; product_name: string; requested_quantity: number; prepared_quantity: number; available_quantity: number; shortage: number }>;
    statistics: { total_items: number; total_requested: number; total_prepared: number; progress: number; is_complete: boolean };
}

export interface UpdatePreparationResponse extends ApiSuccessResponse {
    output?: UpdatePreparationOutput;
}

// complete_preparation output (docs §6.5, verified live against CompletePreparationDecision::
// doExecute()) — warehouse_transfer (CENTRAL→VAN) is now auto-created in the same atomic call,
// null only on shortage (no full coverage to transfer until the dispatcher resolves it).
// stock_deducted is always 0 by design — no physical deduction happens at preparation time, the
// reservation made by confirm_delivery_mission carries through to the transfer instead.
// generated_bls is always [] in the mission flow — leftover field from an unused code path, don't
// build logic around it.
export interface CompletePreparationOutput {
    bp_id: number;
    bp_number: string;
    status: BonPreparationStatus;
    is_fully_prepared: boolean;
    efficiency: number;
    shortage_percentage: number;
    stock_deducted: number;
    total_prepared: number;
    total_requested: number;
    total_shortage: number;
    generated_bls: unknown[];
    mission_id?: number;
    warehouse_transfer?: {
        id: number;
        transfer_number: string;
        status: string;
        delivery_mission_id: number;
        rider_id: number;
        from_warehouse: string;
        to_warehouse: string;
        items?: Array<{ id: number; product_id: number; product_name?: string; requested_quantity: string | number; transferred_quantity: string | number; sales_group_code?: string }>;
    } | null;
}

export interface CompletePreparationResponse extends ApiSuccessResponse {
    output?: CompletePreparationOutput;
}

// reject_preparation output (docs §6.6, verified live) — side effects changed with the mission
// migration: the mission and its BLs revert to `draft` (not a BCH-revert anymore), orders stay
// tied to the mission/BLs (not released back to "Commandes en attente"). Dispatcher re-runs
// confirm_delivery_mission to retry, no payload change on this end (rejection_reason stays
// top-level, MagasinierController wraps it into metadata internally).
export interface RejectPreparationOutput {
    bp_id: number;
    bp_number: string;
    status: BonPreparationStatus;
    rejected_at: string;
    message?: string;
}

export interface RejectPreparationResponse extends ApiSuccessResponse {
    output?: RejectPreparationOutput;
}

// report_shortage (docs §6.7) — declare a shortage mid-pick, before reaching Complete Preparation.
export interface ShortageItemPayload {
    product_id: number;
    shortage_quantity: number;
    shortage_reason: string;
    shortage_notes?: string;
    can_fulfill_later?: boolean;
    estimated_availability?: string;
}

export interface ReportShortageOutput {
    bp_id: number;
    bp_number: string;
    bp_status: BonPreparationStatus;
    total_requested: number;
    total_prepared: number;
    total_shortage: number;
    shortage_percentage: number;
    is_critical: boolean;
    critical_items: unknown[];
    shortage_items: Array<{ product_id: number; shortage_quantity: number; reason: string }>;
}

export interface ReportShortageResponse extends ApiSuccessResponse {
    // §6.7's example still shows `data`, not `output` — and isn't marked "verified live" like
    // §6.3-§6.6. Kept both until confirmed; read output first, fall back to data.
    data?: ReportShortageOutput;
    output?: ReportShortageOutput;
}

// continue_preparation (docs §6.8) — rework after a dispatcher's request_rework, BP must be
// partial_rework_requested. Each line capped server-side to actual available_quantity.
export interface AdditionalItemPayload {
    product_id: number;
    additional_quantity: number;
}

export interface ContinuePreparationOutput {
    bp_id: number;
    bp_number: string;
    bp_status: BonPreparationStatus;
    previous_total_prepared: number;
    additional_prepared: number;
    new_total_prepared: number;
    new_total_shortage: number;
    new_shortage_percentage: number;
    is_now_complete: boolean;
    updated_items: Array<{ product_id: number; product_name: string; previous_prepared: number; additional_prepared: number; new_prepared: number; new_shortage: number }>;
    message?: string;
}

export interface ContinuePreparationResponse extends ApiSuccessResponse {
    // Same data/output ambiguity as ReportShortageResponse — §6.8's example also shows `data`.
    data?: ContinuePreparationOutput;
    output?: ContinuePreparationOutput;
}

export interface StockAdjustmentRequest {
    product_id: number;
    adjustment_type: 'add' | 'subtract' | 'set';
    quantity: number;
    reason?: string;
    notes?: string;
}
