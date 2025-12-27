// ADV Module TypeScript Type Definitions
// Based on API Documentation v1.0

// ========== Enums & Constants ==========

export type PartnerStatus = 'PENDING' | 'ACTIVE' | 'BLOCKED' | 'REJECTED';

export type BcStatus =
    | 'draft'
    | 'submitted'
    | 'adv_review'
    | 'adv_on_hold'
    | 'pending_credit_derogation'
    | 'adv_approved'
    | 'adv_rejected'
    | 'confirmed'
    | 'converted_to_bl'
    | 'in_preparation'
    | 'prepared'
    | 'in_transit'
    | 'delivered'
    | 'returned'
    | 'cancelled';

export type ApprovalMode = 'standard' | 'manual' | 'forced' | 'derogation';

export type DerogationStatus = 'pending' | 'approved' | 'rejected';

export type DerogationType = 'credit_ceiling_exceeded' | 'payment_term_extension' | 'other';

// ========== Core Entities ==========

export interface Partner {
    id: number;
    code: string;
    name: string;
    email: string;
    phone: string;
    whatsapp?: string;
    status: PartnerStatus;
    credit_limit: string | number;
    credit_used: string | number;
    credit_available: string | number;
    credit_hold?: boolean;
    partner_type: string;
    channel: string;
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
    bonLivraisons?: any[];
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

export interface OrderProduct {
    id?: number;
    order_id: number;
    product_id: number;
    quantity: number;
    price: string | number;
    total_price?: string | number;
    unit: string;
    product: Product;
}

export interface BonCommande {
    id: number;
    bc_number?: string;
    order_number: string;
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
    items_count?: number;
    created_at: string;
    updated_at?: string;
    partner: Partner;
    order_products: OrderProduct[];
    orderProducts?: OrderProduct[];
    paymentTerm?: PaymentTerm;
    workflowInstance?: WorkflowInstance;
}

export interface PaymentTerm {
    id: number;
    name: string;
    code?: string;
    days_number: number;
    description?: string;
}

export interface GeoArea {
    id?: number;
    code: string;
    name: string;
    description?: string;
}

export interface User {
    id: number;
    name: string;
    email: string;
    role?: string;
}

export interface WorkflowInstance {
    id: number;
    status: string;
    current_step?: string;
    currentStep?: WorkflowStep;
    created_at?: string;
    updated_at?: string;
    approvals?: any[];
    transitions?: WorkflowTransition[];
}

export interface WorkflowStep {
    id?: number;
    code: string;
    name: string;
    description?: string;
}

export interface WorkflowTransition {
    id: number;
    workflow_instance_id: number;
    from_step: string;
    to_step: string;
    performed_by: number;
    performed_at: string;
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
    partner_id: number;
    partner_credit_limit: number;
    partner_credit_used: number;
    order_amount: number;
    total_exposure: number;
    excess_amount: number;
    justification: string;
    derogation_type: DerogationType;
    status: DerogationStatus;
    requested_by: number;
    reviewed_by?: number | null;
    reviewed_at?: string | null;
    review_comment?: string | null;
    metadata?: Record<string, any>;
    created_at: string;
    updated_at?: string;
    order?: BonCommande;
    partner?: Partner;
    requestedBy?: User;
    reviewedBy?: User | null;
}

// ========== Dashboard ==========

export interface DashboardStats {
    pending_partners: number;
    pending_credit_approvals: number;
    pending_derogations: number;
    blocked_partners: number;
    overdue_payments: number;
    pending_bc: number;
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
    approved_today: number;
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

// ========== Echeances (Due Dates) ==========

export interface Echeance {
    id: number;
    order_number: string;
    partner_name: string;
    partner_code: string;
    payment_term: string;
    total_amount: number;
    bc_status: string;
    created_at: string;
    due_date: string;
    days_overdue: number;
}

// ========== Partner Stats ==========

export interface PartnerStats {
    total_orders: number;
    pending_bcs: number;
    avg_order_value: number;
    overdue_payments: number;
}

// ========== API Request Types ==========

export interface PartnerValidationRequest {
    credit_limit: number;
    payment_term_id: number;
    notes?: string;
}

export interface PartnerRejectionRequest {
    rejection_reason: string;
}

export interface CreditLimitUpdateRequest {
    new_credit_limit: number;
    justification: string;
}

export interface PartnerBlockRequest {
    block_reason: string;
    blocked_until?: string;
}

export interface BCApprovalRequest {
    comment?: string;
    approval_mode?: ApprovalMode;
    quantities?: Record<number, number>;
    auto_adjust_stock?: boolean;
    responsable_id?: number;
}

export interface BCRejectionRequest {
    reason: string;
}

export interface BCHoldRequest {
    reason: string;
}

export interface BCRequestInfoRequest {
    info_needed: string;
    put_on_hold?: boolean;
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
}

export interface PaginatedResponse<T> {
    current_page: number;
    data: T[];
    first_page_url: string;
    from: number;
    last_page: number;
    last_page_url: string;
    next_page_url: string | null;
    path: string;
    per_page: number;
    prev_page_url: string | null;
    to: number;
    total: number;
}

export interface BCListResponse {
    bcs: PaginatedResponse<BonCommande>;
    stats: BCStats;
}

export interface BCDetailResponse {
    bc: BonCommande;
    stockAvailable?: boolean;
    creditOk?: boolean;
    creditExceeded?: boolean;
    excessAmount?: number;
    pendingDerogation?: CreditDerogation | null;
    partnerStats?: PartnerStats;
}

export interface PartnerDetailResponse {
    partner: Partner;
    creditHistory: CreditHistory[];
    paymentHistory: PaymentHistory[];
}

export interface DerogationsListResponse {
    derogations: PaginatedResponse<CreditDerogation>;
    stats: DerogationStats;
}

export interface DerogationDetailResponse {
    success: boolean;
    derogation: CreditDerogation;
}

export interface CreditListResponse {
    partners: PaginatedResponse<Partner>;
    totalExposure: number;
    totalLimit: number;
    utilizationRate: number;
}

export interface BalanceCheckItem {
    product_id: number;
    product_name: string;
    requested_quantity: number;
    available_stock: number;
    shortage?: number;
    status: 'ok' | 'shortage';
}

export interface BalanceCheckResponse {
    success: boolean;
    message: string;
    data: {
        success: boolean;
        all_ok: boolean;
        items: BalanceCheckItem[];
    };
}

export interface DerogationRequestResponse {
    success: boolean;
    message: string;
    derogation: CreditDerogation;
}

// ========== Filter & Query Types ==========

export interface BCFilters {
    status?: BcStatus | BcStatus[];
    search?: string;
    partner?: string;
    bc_number?: string;
    page?: number;
    per_page?: number;
}

export interface PartnerFilters {
    status?: PartnerStatus;
    page?: number;
    per_page?: number;
}

export interface DerogationFilters {
    status?: DerogationStatus;
    page?: number;
    per_page?: number;
}

export interface EcheanceFilters {
    page?: number;
    per_page?: number;
    partner?: string;
    date_from?: string;
    date_to?: string;
}

export interface CreditFilters {
    page?: number;
    per_page?: number;
    min_utilization?: number;
    max_utilization?: number;
}

// ========== BC Detail Context ==========

export interface BC {
    id: number;
    bc_number: string;
    order_code: string;
    created_at: string;
    total_amount: string;
    payment_status: string;
    order_status: string;
    bc_status: BcStatus;
    is_urgent: boolean;
    is_overdue: boolean;
    items_count: number;
    partner: Partner;
    order_products: OrderProduct[];
}
