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
export type PreparationsScope = 'active' | 'rupture_watch' | 'history' | 'all';

export interface PreparationDeliveryMission {
    id: number;
    mission_number: string;
    status: string;
    branch_code?: string;
    delivery_date?: string | null;
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

// Real field names verified against docs §8.1 — `minimum_quantity`/`maximum_quantity`, not
// `min_stock_level` (a guessed name that never matched the live response).
export interface Stock {
    id: number;
    product_id: number;
    warehouse_code?: string;
    quantity: number;
    reserved_quantity: number;
    available_quantity: number;
    minimum_quantity: number;
    maximum_quantity?: number;
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

// GET /magasinier/preparations — new history endpoint (docs §6.0, 2026-06-24).
// `counts` is per-status totals AFTER date/search but BEFORE scope/status filter — use for tab badges.
export interface PreparationsAllResponse {
    data: BonPreparation[];
    meta: {
        current_page: number;
        last_page: number;
        per_page: number;
        total: number;
        from?: number;
        to?: number;
    };
    counts: Record<string, number>;
}

// GET /magasinier/preparations/{id} also returns the BP flat, no wrapper (docs §6.2).
export type BonPreparationDetailResponse = BonPreparation;

// GET /magasinier/stock and /stock/low-stock both return the raw Laravel paginator directly
// (docs §8.1/§8.2) — flat, no success/data wrapper. Same pattern bug as PreparationsResponse had:
// the old nested `data.stock.data` shape never matched the live response.
export interface StockResponse {
    current_page: number;
    last_page?: number;
    per_page: number;
    total: number;
    data: Stock[];
}

export interface StockMovementsResponse {
    current_page: number;
    last_page?: number;
    per_page: number;
    total: number;
    data: StockMovement[];
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

// ─── §9 Conventional Loading ──────────────────────────────────────────────────

export type LoadingRequestStatus =
    | 'submitted'
    | 'pending_cdz'
    | 'pending_adv'
    | 'approved'
    | 'fulfilled'
    | 'confirmed'
    | 'cancelled'
    | 'rejected'
    | 'rejected_by_vendor';

export interface LoadingRequestItem {
    product_id: number;
    product_name: string;
    quantity: number;
}

export interface LoadingRequest {
    id: number;
    status: LoadingRequestStatus;
    branch_id: number;
    notes?: string | null;
    approved_at?: string | null;
    fulfilled_at?: string | null;
    confirmed_at?: string | null;
    user: { id: number; name: string };
    vendeur_items_snapshot: LoadingRequestItem[];
}

export interface LoadingRequestsResponse {
    current_page: number;
    per_page: number;
    total: number;
    data: LoadingRequest[];
}

export interface FulfillLoadingResponse {
    success: boolean;
    message: string;
    data: {
        loading_request_id: number;
        status: string;
        qr_token: string;
        qr_expires_at: string;
        fulfilled_at: string;
    };
}

// ─── §10 Conventional Décharge Reconciliation ─────────────────────────────────
// Real statuses from staging capture (2026-07-16, commit db2c0ff7).
// NOT pending/confirmed/approved/rejected — those were assumptions.
export type ConventionalDechargeReconciliationStatus =
    | 'draft'        // created, not yet confirmed by magasinier
    | 'reconciling'  // magasinier confirmed QR + count → ready to approve
    | 'completed'    // count done, awaiting transfer
    | 'approved'     // VAN → depot transfer executed (terminal)
    | 'cancelled';   // cancelled (terminal)

// List row shape — verified against staging capture.
// NOTE: branch_code (string "A0001") not branch_id (int).
//       work_session_id not loading_request_id.
//       items omitted from list — use getDetail() to get resolved product names.
export interface ConventionalDechargeReconciliationRequest {
    id: number;
    work_session_id: number | null;
    user_id?: number;
    branch_code: string;
    status: ConventionalDechargeReconciliationStatus;
    // Product-keyed maps (product_id as string key → quantity)
    theoretical_by_product: Record<string, number>;
    physical_by_product: Record<string, number>;
    shortage_by_product: Record<string, number>;
    shortage_value_total: string | null; // decimal as string (e.g. "45.50")
    computed_at: string | null;
    initiated_at: string | null;
    completed_at: string | null;
    warehouse_confirmed_at?: string | null;
    warehouse_transfer_id?: number | null;
    user: { id: number; name: string } | null;
}

// Detail response — same as list row plus resolved items, work_session, warehouse_transfer
export interface ConventionalDechargeReconciliationItem {
    product_id: number;
    product_name: string;
    theoretical_quantity: number;
    physical_quantity: number;
    shortage_quantity: number | null;
}

export interface ConventionalDechargeReconciliationDetail extends ConventionalDechargeReconciliationRequest {
    items: ConventionalDechargeReconciliationItem[];
    work_session: { id: number } | null;
    warehouse_transfer: { id: number } | null;
}

export interface ConventionalDechargeReconciliationListResponse {
    current_page: number;
    per_page: number;
    total: number;
    data: ConventionalDechargeReconciliationRequest[];
}

export interface DechargeReconciliationLine {
    product_id: number;
    physical_qty: number;
}

export interface DechargeReconciliationConfirmResponse {
    message: string;
    data?: Record<string, unknown>;
}

export interface DechargeReconciliationApproveResponse {
    success: boolean;
    data: {
        decharge_reconciliation_id: number;
        status: 'approved';
        warehouse_transfer_id: number;
        products_transferred: number;
        message: string;
    };
}

// ─── §11 Décharge Van→Depot ───────────────────────────────────────────────────

export type MagasinierDechargeStatus = 'pending' | 'approved';

export interface MagasinierDechargeItem {
    id?: number;
    product_id?: number;
    product_name?: string;
    quantity?: number;
    returned_quantity?: number;
    stock_released?: boolean;
    product?: { id: number; name: string; sku?: string };
}

export interface MagasinierDecharge {
    id: number;
    decharge_number?: string;
    status?: string;
    comment?: string;
    reason?: string;
    partner?: { id: number; name: string } | null;
    rider?: { id: number; name: string } | null;
    created_at?: string;
    items?: MagasinierDechargeItem[];
}

export interface MagasinierDechargesResponse {
    current_page: number;
    per_page: number;
    total: number;
    data: MagasinierDecharge[];
}

export interface ApproveDechargeWorkflowResponse {
    success: boolean;
    data?: {
        decharge_id: number;
        decharge_number: string;
        status: 'approved';
        items_released: number;
        total_value?: number;
        message: string;
    };
    output?: {
        decharge_id: number;
        decharge_number: string;
        status: 'approved';
        items_released: number;
        total_value?: number;
        message: string;
    };
    message?: string;
}

// ─── §12 Returns Processing ────────────────────────────────────────────────────

export type PartnerReturnStatus =
    | 'PENDING_DIRECTION_APPROVAL'
    | 'APPROVED'
    | 'REJECTED'
    | 'ASSIGNED_TO_DRIVER'
    | 'COLLECTED'
    | 'RECEIVED_AT_WAREHOUSE'
    | 'CLOSED'
    // IMMEDIATE is a legacy status — after backend update, POST /v2/returns/immediate
    // now immediately transitions to ROLLED_BACK (atomic stock rollback in same call).
    | 'IMMEDIATE'
    // ROLLED_BACK = stock van remis en dépôt de façon atomique (retour immédiat finalisé).
    // Also the initial status returned by POST /v2/returns/immediate.
    | 'ROLLED_BACK'
    | 'RECONCILED';

export type ReturnType = 'commercial' | 'immediate';

// Only 3 conditions exist — no "technical return" condition.
// If business requires it, must be discussed with backend (impacts stock routing).
export type ReturnItemCondition = 'good' | 'damaged' | 'expired';

// Valid reasons for commercial returns (§8)
export type CommercialReturnReason =
    | 'DAMAGED'
    | 'PRICING_ERROR'
    | 'COMMERCIAL_RETURN'
    | 'EXPIRED'
    | 'QUALITY_ISSUE';

// Valid reasons for immediate returns / field refusals (§8)
export type ImmediateReturnReason =
    | 'CLIENT_CLOSED'
    | 'CLIENT_REFUSED'
    | 'PARTIAL_REFUSAL'
    | 'DISPUTE'
    | 'WRONG_DELIVERY';

export type ReturnReason = CommercialReturnReason | ImmediateReturnReason;

export interface PartnerReturnItem {
    id: number;
    product_id: number;
    return_quantity: number;
    delivered_quantity?: number;
    condition?: ReturnItemCondition | null;
    reason?: string;
    unit_price?: number;
    total_value?: number;
    product: { id: number; name: string; sku?: string };
}

export interface PartnerReturn {
    id: number;
    return_number: string;
    status: PartnerReturnStatus;
    return_type: ReturnType;
    return_reason?: ReturnReason | null;
    partner: { id: number; name: string };
    deliveryNote?: { id: number; delivery_number: string } | null;
    items?: PartnerReturnItem[];
    // Populated after approve() — present when requires_manual_assignment=true
    metadata?: {
        requires_manual_assignment?: boolean;
        assigned_driver_id?: number | null;
        [key: string]: unknown;
    } | null;
    // Who created / approved (from DB schema §9)
    initiated_by?: number | null;
    approved_by?: number | null;
    assigned_driver_id?: number | null;
    approval_timestamp?: string | null;
    rejection_reason?: string | null;
    // GPS captured automatically on immediate returns (field refusal)
    gps_latitude?: number | null;
    gps_longitude?: number | null;
    collection_timestamp?: string | null;
    warehouse_receipt_timestamp?: string | null;
    created_at: string;
    notes?: string | null;
}

export interface ReturnsResponse {
    current_page: number;
    per_page: number;
    total: number;
    data: PartnerReturn[];
}

export interface ReceiveReturnResponse {
    data: {
        id: number;
        return_number: string;
        status: PartnerReturnStatus;
        warehouse_receipt_timestamp?: string | null;
    };
}

export interface CloseReturnResponse {
    data: {
        id: number;
        return_number: string;
        status: PartnerReturnStatus;
    };
}

// Response from POST /v2/returns/{id}/approve (direction role).
// If requires_manual_assignment=true, no driver was auto-assigned — a coordinator
// must call POST /v2/returns/{id}/assign with { driver_id } manually.
export interface ApproveReturnResponse {
    data: {
        id: number;
        return_number: string;
        status: 'APPROVED' | 'ASSIGNED_TO_DRIVER';
        assigned_driver_id: number | null;
        requires_manual_assignment: boolean;
    };
}

// Response from POST /v2/returns/{id}/assign (dispatcher/coordinator role).
// Used when approve returned requires_manual_assignment=true.
export interface AssignReturnResponse {
    data: {
        id: number;
        return_number: string;
        status: 'ASSIGNED_TO_DRIVER';
        assigned_driver_id: number;
    };
}
