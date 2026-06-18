// ADV Module TypeScript Type Definitions
// Aligned with API Documentation — base URL: /api/backend/adv

// ========== Enums & Constants ==========

export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REJECTED';

export type BcStatus =
    | 'draft'
    | 'submitted'
    | 'in_review'
    | 'on_hold'
    | 'pending_derogation'
    | 'confirmed'
    | 'rejected'
    | 'converted_to_bl'
    | 'in_preparation'
    | 'prepared'
    | 'in_transit'
    | 'delivered'
    | 'returned'
    | 'cancelled';

export type BcDecision =
    | 'finalize_sale'
    | 'reject_sale'
    | 'hold_order'
    | 'resume_order'
    | 'request_credit_derogation';

export type DerogationStatus = 'pending' | 'approved' | 'rejected';

export type DerogationType = 'credit_limit_override';

export type DataCompleteness = 'complete' | 'partial' | 'unavailable';

// ========== Core Entities ==========

export interface Partner {
    id: number;
    code: string;
    name: string;
    email: string;
    phone?: string;
    whatsapp?: string;
    status: PartnerStatus;
    credit_limit: string | number;
    credit_used: string | number;
    credit_available?: string | number;
    credit_hold?: boolean;
    partner_type?: string;
    channel?: string;
    tax_number_ice?: string;
    tax_number_if?: string;
    address_line1?: string;
    city?: string | null;
    country?: string;
    created_at: string;
    blocked_until?: string | null;
    block_reason?: string | null;
    rejection_reason?: string | null;
    geoArea?: GeoArea;
    paymentTerm?: PaymentTerm | null;
    workflowInstance?: WorkflowInstance;
    bonCommandes?: BonCommande[];
}

export interface Product {
    id: number;
    name: string;
    code?: string;
    sku?: string;
    stock?: number;
    quantity?: number;
    thumbnail?: string;
    short_description?: string;
    total_available_stock?: number;
    stocks?: ProductStock[];
}

export interface ProductStock {
    branch_code: string;
    quantity: string;
    reserved_quantity: string;
    available_quantity: string;
}

export interface LogisticsLine {
    line_base_quantity: number;
    share_of_product_quantity: number;
    shipping_level?: string;
    physical_packages_estimate?: number;
    line_gross_weight_kg_estimate?: number | null;
    line_volume_m3_estimate?: number | null;
    packaging?: { label: string; units_per_package: number };
    profile_flags?: {
        temperature_profile_code: string;
        load_category: string;
    };
    shipping_constraints: {
        temperature_profile_code: string | null;
        load_category: string | null;
    };
    missing_reason: string | null;
}

export interface LogisticsSummary {
    total_weight_kg: number | null;
    total_volume_m3: number | null;
    data_completeness: DataCompleteness;
    missing_issue_count: number;
    weight_evaluable: boolean;
    volume_evaluable: boolean;
}

export interface OrderProduct {
    id?: number;
    order_id: number;
    product_id: number;
    quantity: number;
    price: string | number;
    unit_price?: string | number;
    total_price?: string | number;
    unit?: string;
    out_of_stock?: boolean;
    available_stock_quantity?: number;
    product: Product;
    packaging?: { id: number; name: string };
    logistics_line?: LogisticsLine;
}

export interface BonCommande {
    id: number;
    bc_number?: string;
    order_number?: string;
    order_code?: string;
    partner_id: number;
    total_amount: string | number;
    sub_total?: string | number;
    tax_amount?: string | number;
    payment_status?: string;
    order_status?: string;
    bc_status: BcStatus;
    is_urgent?: boolean;
    is_overdue?: boolean;
    is_credit_sale?: boolean;
    items_count?: number;
    bc_notes?: string;
    order_date?: string;
    due_date?: string;
    priority?: 'normal' | 'urgent';
    created_at: string;
    updated_at?: string;
    approved_by?: number | null;
    approved_at?: string | null;
    rejected_by?: number | null;
    rejected_at?: string | null;
    reject_reason?: string | null;
    partner: Partner;
    order_products: OrderProduct[];
    orderProducts?: OrderProduct[];
    paymentTerm?: PaymentTerm;
    payment_term?: PaymentTerm;
    workflowInstance?: WorkflowInstance;
    workflow_instance?: WorkflowInstance;
    logistics_summary?: LogisticsSummary;
}

export interface PaymentTerm {
    id: number;
    name: string;
    code?: string;
    days?: number;
    days_number?: number;
    description?: string;
}

export interface GeoArea {
    id?: number;
    code?: string;
    name: string;
    description?: string;
}

export interface User {
    id: number;
    name: string;
    email?: string;
    role?: string;
}

export interface WorkflowInstance {
    id: number;
    status?: string;
    current_step?: string | { name: string; label: string };
    currentStep?: WorkflowStep;
    created_at?: string;
    updated_at?: string;
    approvals?: any[];
    transitions?: WorkflowTransition[];
}

export interface WorkflowStep {
    id?: number;
    code?: string;
    name: string;
    label?: string;
    description?: string;
}

export interface WorkflowTransition {
    id: number;
    workflow_instance_id?: number;
    from_step?: string;
    from_state?: string;
    to_step?: string;
    to_state?: string;
    performed_by: number | { id: number; name: string };
    performed_at?: string;
    created_at?: string;
    comment?: string;
    performedBy?: User;
}

export interface CreditHistory {
    id: number;
    partner_id: number;
    old_limit: number;
    new_limit: number;
    changed_by: number;
    justification: string;
    created_at: string;
    changedBy?: User;
}

export interface PaymentHistory {
    id: number;
    partner_id: number;
    order_id?: number;
    order_number: string;
    total_amount: number;
    bc_status: string;
    created_at: string;
    paid_at?: string;
    payment_method?: string;
}

export interface CreditDerogation {
    id: number;
    order_id: number;
    partner_id?: number;
    partner_credit_limit: number;
    partner_credit_used: number;
    order_amount: number;
    total_exposure: number;
    excess_amount: number;
    justification: string;
    derogation_type: DerogationType;
    status: DerogationStatus;
    requested_by: number | { id: number; name: string };
    reviewed_by?: number | null;
    reviewed_at?: string | null;
    review_comment?: string | null;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at?: string;
    order?: BonCommande & { order_code?: string };
    partner?: Pick<Partner, 'id' | 'name' | 'code'>;
    requestedBy?: User;
    reviewedBy?: User | null;
}

// ========== Dashboard ==========

export interface DashboardStats {
    pending_partners: number;
    pending_review: number;
    on_hold: number;
    pending_derogations: number;
    confirmed_today: number;
    blocked_partners: number;
    total_credit_exposure: number | string;
    available_credit: number | string;
}

export interface DashboardData {
    stats: DashboardStats;
    recentPartners: Partner[];
    creditAlerts: Partner[];
}

// ========== BC Stats ==========

export interface BCStats {
    pending_review: number;
    on_hold: number;
    pending_derogation: number;
    confirmed_today: number;
    overdue: number;
}

// ========== Derogation Stats ==========

export interface DerogationStats {
    pending: number;
    approved_today: number;
    rejected_today: number;
}

// ========== Credit Management ==========

export interface CreditOverview {
    totalExposure: number;
    totalLimit: number;
    utilizationRate: number;
}

// ========== Écheances (Due Dates / Invoices) ==========

export interface Invoice {
    id: number;
    invoice_number: string;
    amount: number;
    remaining_amount: number;
    status: 'pending' | 'partially_paid' | 'overdue';
    due_date: string;
    partner: Pick<Partner, 'id' | 'name' | 'code'>;
    order: { id: number; order_code: string };
}

export interface EcheancesStats {
    total_overdue: number;
    total_due_this_week: number;
    overdue_count: number;
}

// ========== Partner Stats ==========

export interface PartnerStats {
    total_orders: number;
    pending_bcs: number;
    avg_order_value: number;
    overdue_payments?: number;
}

// ========== Workflow Execution ==========

export interface WorkflowExecuteRequest {
    decision: BcDecision;
    comment?: string;
    reason?: string;
    justification?: string;
}

export interface WorkflowConstraint {
    name: string;
    reason: string;
    context?: Record<string, unknown>;
}

export interface WorkflowExecuteResponse {
    success: boolean;
    message: string;
    data?: Record<string, unknown>;
    constraints?: WorkflowConstraint[];
}

// ========== API Request Types ==========

export interface PartnerValidationRequest {
    comment?: string;
}

export interface PartnerRejectionRequest {
    reason: string;
}

export interface CreditLimitUpdateRequest {
    credit_limit: number;
    reason: string;
}

export interface PartnerBlockRequest {
    reason: string;
}

export interface BCApprovalRequest {
    decision: 'finalize_sale';
    comment?: string;
}

export interface BCRejectionRequest {
    decision: 'reject_sale';
    reason: string;
}

export interface BCHoldRequest {
    decision: 'hold_order';
    reason: string;
}

export interface BCResumeRequest {
    decision: 'resume_order';
    comment?: string;
}

export interface BCBatchApprovalRequest {
    bc_ids: number[];
    comment?: string;
}

export interface DerogationRequest {
    justification: string;
}

export interface DerogationApprovalRequest {
    comment?: string;
}

export interface DerogationRejectionRequest {
    reason: string;
}

// ========== API Response Types ==========

export interface ApiSuccessResponse {
    success: true;
    message: string;
    data?: any;
}

export interface ApiErrorResponse {
    success: false;
    message: string;
    errors?: Record<string, string[]>;
    constraints?: WorkflowConstraint[];
}

export interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    first_page_url?: string;
    from?: number;
    last_page?: number;
    last_page_url?: string;
    next_page_url?: string | null;
    path?: string;
    per_page: number;
    prev_page_url?: string | null;
    to?: number;
    total: number;
}

export interface BCListResponse {
    bcs: PaginatedResponse<BonCommande>;
    stats: BCStats;
    partners?: Pick<Partner, 'id' | 'name' | 'code'>[];
}

export interface BCDetailResponse {
    bc: BonCommande;
    stockAvailable?: boolean;
    creditOk?: boolean;
    creditExceeded?: boolean;
    excessAmount?: number;
    pendingDerogation?: CreditDerogation | null;
    partnerStats?: PartnerStats;
    logistics_aggregate?: LogisticsSummary & { per_product: Record<string, unknown> };
}

export interface BalanceCheckResponse {
    stock_ok: boolean;
    credit_ok: boolean;
    details: {
        credit_limit: number;
        credit_used: number;
        order_amount: number;
        total_exposure: number;
        credit_exceeded_by: number;
    };
}

export interface PartnerDetailResponse {
    partner?: Partner;
    id?: number;
    code?: string;
    name?: string;
    email?: string;
    status?: PartnerStatus;
    creditHistory?: CreditHistory[];
    paymentHistory?: PaymentHistory[];
    geo_area?: GeoArea;
    payment_terms?: PaymentTerm[];
    [key: string]: any;
}

export interface DerogationsListResponse {
    current_page?: number;
    per_page?: number;
    total?: number;
    data: CreditDerogation[];
    stats?: DerogationStats;
}

export interface DerogationDetailResponse {
    success?: boolean;
    derogation?: CreditDerogation;
    id?: number;
    [key: string]: any;
}

export interface CreditListResponse {
    current_page?: number;
    per_page?: number;
    total?: number;
    data: Partner[];
    partners?: PaginatedResponse<Partner>;
    totalExposure?: number;
    totalLimit?: number;
    utilizationRate?: number;
}

export interface EcheancesResponse {
    echeances: PaginatedResponse<Invoice>;
    stats: EcheancesStats;
}

export interface DerogationRequestResponse {
    success: boolean;
    message: string;
    derogation?: CreditDerogation;
    data?: any;
}

// ========== Filter & Query Types ==========

export interface BCFilters {
    status?: BcStatus | BcStatus[] | 'all';
    search?: string;
    partner_id?: number;
    date_from?: string;
    date_to?: string;
    amount_min?: number;
    amount_max?: number;
    page?: number;
    per_page?: number;
}

export interface PartnerFilters {
    status?: PartnerStatus;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface DerogationFilters {
    status?: DerogationStatus;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface EcheanceFilters {
    partner_id?: number;
    status?: 'pending' | 'partially_paid' | 'overdue';
    date_from?: string;
    date_to?: string;
    overdue_only?: boolean;
    page?: number;
    per_page?: number;
}

export interface CreditFilters {
    search?: string;
    credit_status?: 'exceeded' | 'warning';
    page?: number;
    per_page?: number;
}

// ========== BC Detail Context (legacy compat) ==========

export interface BC {
    id: number;
    bc_number?: string;
    order_code?: string;
    created_at: string;
    total_amount: string;
    payment_status?: string;
    order_status?: string;
    bc_status: BcStatus;
    is_urgent?: boolean;
    is_overdue?: boolean;
    items_count?: number;
    partner: Partner;
    order_products: OrderProduct[];
}
