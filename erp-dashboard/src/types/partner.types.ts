// ─── Partner Types ───────────────────────────────────────────────────────────

export type PartnerStatus = 'ACTIVE' | 'ON_HOLD' | 'BLOCKED' | 'CLOSED';

export interface Partner {
    id: number;
    code: string;
    name: string;
    customer_id: number | null;
    price_list_id: number | null;
    payment_term_id: number | null;
    status: PartnerStatus;
    partner_type: string;
    channel: string;            // code (rétrocompatible)
    channel_id?: number | null; // FK vers la table channels (refonte segmentation)
    email: string | null;
    phone: string | null;
    whatsapp: string | null;
    website: string | null;
    // Credit
    credit_limit: number;
    credit_used: number;
    credit_available: number;
    // Tax
    tax_number_ice: string | null;
    tax_number_if: string | null;
    tax_exempt: boolean;
    vat_group_code: string | null;
    // Address
    address_line1: string | null;
    address_line2: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    postal_code: string | null;
    geo_area_code: string | null;
    geo_lat: number | null;
    geo_lng: number | null;
    // Ops
    opening_hours: string | null;
    delivery_instructions: string | null;
    min_order_amount: number | null;
    delivery_zone: string | null;
    // Classification
    risk_score: number;
    // Hierarchy
    parent_partner_id: number | null;
    salesperson_id: number | null;
    // Blocking
    blocked_until: string | null;
    block_reason: string | null;
    // Discounts
    default_discount_rate: number;
    default_discount_amount: number;
    max_discount_rate: number;
    // Options
    allow_show_on_pos: boolean;
    currency?: string;
    // Activity stats
    total_orders_count?: number;
    total_orders_value?: string | number;
    average_order_value?: string | number;
    last_order_date?: string | null;
    last_payment_date?: string | null;
    // Relations
    price_list?: { id: number; code: string; name: string } | null;
    channel_ref?: { id: number; code: string; name: string; price_list_id: number } | null;
    customer?: { id: number; user?: { id: number; name: string; email: string } } | null;
    parent?: Partner | null;
    children?: Partner[];
    salesperson?: { id: number; name: string } | null;
    payment_term?: { id: number; name: string; description?: string } | null;
    geo_area?: { id: number; code: string; name: string } | null;
    business_chronologies?: any[];
    financial_profile?: Record<string, unknown> | null;
    credit_state?: PartnerCreditState | null;
    custom_field_values?: any[];
    itinerary_partners?: ItineraryPartner[];
    // Timestamps
    created_at?: string;
    updated_at?: string;
}

// ─── Partner Credit State (materialized from partner_credit_states) ────────────

export interface PartnerCreditState {
    partner_id: number;
    total_exposure: number;
    available_credit: number;
    status: 'ALLOWED' | 'WARNING' | 'SOFT_BLOCK' | 'HARD_BLOCK';
    last_recalculated_at?: string | null;
}

// ─── Itinerary ────────────────────────────────────────────────────────────────

export interface ItineraryPartner {
    id: number;
    itinerary_id: number;
    partner_id: number;
    rank: number;
    visit_frequency_days: number;
    start_time: string | null;
    end_time: string | null;
    is_stop_point: boolean;
    notes: string | null;
    itinerary?: {
        id: number;
        code: string;
        name: string;
        branch_code: string;
        geo_area_code?: string | null;
    };
}

// ─── Credit Control V2 ────────────────────────────────────────────────────────

export type CreditExposureStatus = 'ALLOWED' | 'WARNING' | 'SOFT_BLOCK' | 'HARD_BLOCK';

export interface CreditExposureResponse {
    partner_id: number;
    credit_limit: number;
    open_invoices_amount: number;
    pending_cheques_amount: number;
    pending_effets_amount: number;
    confirmed_orders_amount: number;
    delivered_not_invoiced_amount: number;
    validated_payments_amount: number;
    credit_notes_amount: number;
    total_exposure: number;
    available_credit: number;
    status: CreditExposureStatus;
    overdue_invoice_count: number;
    oldest_overdue_days: number;
    risk_score: number;
    last_recalculated_at: string;
}

export interface CreditEvent {
    id: number;
    event_type: string;
    amount: number;
    reference_type: string | null;
    reference_id: number | null;
    exposure_before: number;
    exposure_after: number;
    created_at: string;
}

// ─── API Responses ───────────────────────────────────────────────────────────

export interface PaginatedPartners {
    current_page: number;
    data: Partner[];
    per_page: number;
    total: number;
    last_page?: number;
    from?: number;
    to?: number;
}

export interface PartnerListResponse {
    partners: PaginatedPartners;
    filters: Record<string, any>;
    priceLists: { id: number; code: string; name: string }[];
}

export interface PartnerShowResponse {
    partner: Partner;
    taxId?: string;
    customFields?: Record<string, {
        label: string;
        value: any;
        formatted_value: string;
        type: string;
        field: any;
    }>;
}

export interface PartnerCreateFormResponse {
    priceLists: { id: number; code: string; name: string }[];
    customers: { id: number; name: string; email: string }[];
    paymentTerms: PaymentTermOption[];
    vatTaxes: { id: number; type: string; name: string; percentage: number }[];
    geoAreas: { id: number; code: string; name: string }[];
    regions: { id: number; region: string }[];
    villes: { id: number; ville: string }[];
    custom_fields: any[];
}

export interface PaymentTermOption {
    id: number;
    name: string;
    description?: string;
    is_credit?: boolean;
    is_cash?: boolean;
    is_bank_transfer?: boolean;
}

export interface PartnerPaymentTermsResponse {
    partner: Partner & { paymentTerms?: PaymentTermOption[]; payment_terms?: PaymentTermOption[] };
    availableTerms?: PaymentTermOption[];
    available_terms?: PaymentTermOption[];
}

export interface CreditHistoryResponse {
    success: boolean;
    data: {
        current_limit: string | number;
        current_used: string | number;
        current_available: string | number;
        orders: { id: number; order_code: string; total_amount: string | number; order_status: string; created_at: string }[];
        deliveries: { id: number; code?: string; delivery_code?: string; total_amount: string | number; status?: string; delivery_status?: string; created_at: string }[];
    };
}

export interface PartnerStatisticsResponse {
    success: boolean;
    statistics: {
        total: number;
        active: number;
        blocked: number;
        on_hold: number;
        by_type: { partner_type: string; count: number }[];
        by_channel: { channel: string; count: number }[];
        total_credit_limit: number;
        total_credit_used: number;
        with_customer: number;
    };
}

// ─── Request Types ───────────────────────────────────────────────────────────

export interface PartnerFilters {
    q?: string;
    status?: PartnerStatus | '';
    partner_type?: string;
    channel?: string;
    channel_id?: number;
    salesperson_id?: number;
    price_list_id?: number;
    sort_by?: 'name' | 'code' | 'created_at' | 'last_order_date' | 'total_orders_count' | 'total_orders_value' | 'average_order_value';
    sort_dir?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface CreatePartnerRequest {
    // Identity
    name: string;
    code?: string;
    partner_type?: string;
    channel?: string;
    status?: PartnerStatus;
    risk_score?: number;
    parent_partner_id?: number | null;
    salesperson_id?: number | null;
    // Commercial
    price_list_id?: number;
    payment_term_id?: number;
    currency?: string;
    credit_limit?: number;
    default_discount_rate?: number;
    default_discount_amount?: number;
    max_discount_rate?: number;
    // Tax
    tax_number_ice?: string;
    tax_number_if?: string;
    tax_exempt?: boolean;
    vat_group_code?: string;
    // Contact
    phone?: string;
    whatsapp?: string;
    email?: string;
    website?: string;
    // Address
    address_line1?: string;
    address_line2?: string;
    city?: string;
    region?: string;
    country?: string;
    postal_code?: string;
    geo_area_code?: string;
    geo_lat?: number | null;
    geo_lng?: number | null;
    // Delivery
    opening_hours?: Record<string, string> | string;
    delivery_instructions?: string;
    min_order_amount?: number;
    delivery_zone?: string;
    // Options
    allow_show_on_pos?: boolean;
    blocked_until?: string | null;
    block_reason?: string | null;
    // Custom fields
    custom_fields?: Record<string, string>;
}

export interface UpdateStatusRequest {
    status: PartnerStatus;
    reason?: string;
}

export interface BlockPartnerRequest {
    reason: string;
    blocked_until?: string;
}

export interface UpdateCreditRequest {
    credit_limit: number;
    reason?: string;
}

// ─── Master Data (GET /api/backend/masterdata/for-partner-form) ───────────────

export interface GeoAreaItem {
    id: number;
    code: string;
    name: string;
    name_ar?: string;
    geo_area_type_id: number;
    parent_code: string | null;
    sort_order: number;
    geo_area_type: { id: number; code: string; name: string };
}

export interface BranchItem {
    id: number;
    code: string;
    name: string;
    name_ar?: string;
    geo_area_code: string | null;
}

export interface CustomFieldDef {
    id: number;
    field_name: string;
    field_label: string;
    field_type: string;
    options: Array<{ value: string; label: string }> | null;
    is_required: boolean;
    order: number;
    placeholder?: string;
    help_text?: string;
    default_value?: any;
}

export interface CountryItem {
    code: string;
    name: string;
    name_ar?: string;
    dial_code: string;
}

export interface PartnerMasterData {
    success: boolean;
    price_lists: { id: number; code: string; name: string; rank?: number }[];
    payment_terms: {
        id: number;
        code: string;
        name: string;
        description?: string;
        is_credit: boolean;
        is_cash: boolean;
        is_bank_transfer: boolean;
    }[];
    vat_taxes: { id: number; type: string; name: string; percentage: string; deduction: string }[];
    geo_areas: GeoAreaItem[];
    geo_area_types: { id: number; code: string; name: string; name_ar?: string; rank: number }[];
    branches: BranchItem[];
    itineraries: { id: number; code: string; name: string; branch_code: string; geo_area_code?: string }[];
    salespersons: any[];
    partner_families: any[];
    custom_fields: CustomFieldDef[];
    countries?: CountryItem[];
}

// ─── Auth form data (create partner with user account) ───────────────────────

export interface AuthFormData {
    name: string;
    last_name: string;
    email: string;
    password: string;
    confirm_password: string;
    phone: string;
    phone_code: string;
    gender: string;
    date_of_birth: string;
    branch_code: string;
    geo_area_code: string;
    is_active: boolean;
    target_app: string;
}

// ─── Full create payload ──────────────────────────────────────────────────────

export interface CreatePartnerFullPayload {
    /** Omit entirely for a partner without B2B login */
    auth?: {
        name: string;
        last_name?: string;
        email: string;
        password: string;
        phone: string;
        phone_code?: string;
        gender?: string;
        date_of_birth?: string;
        branch_code?: string;
        geo_area_code?: string;
        is_active: boolean;
        target_app: string;
    };
    partner: {
        // Identity
        name: string;
        code?: string;
        partner_type: string;
        // code string (accepté) ou channel_id — les deux routés vers la FK channels
        channel?: string;
        channel_id?: number;
        status: PartnerStatus;
        risk_score?: number;
        parent_partner_id?: number | null;
        salesperson_id?: number | null;
        // Commercial
        price_list_id?: number;
        payment_term_id?: number;
        currency?: string;
        credit_limit?: number;
        default_discount_rate?: number;
        default_discount_amount?: number;
        max_discount_rate?: number;
        // Tax
        tax_number_ice?: string;
        tax_number_if?: string;
        tax_exempt?: boolean;
        vat_group_code?: string;
        // Contact
        phone?: string;
        whatsapp?: string;
        email?: string;
        website?: string;
        // Address
        address_line1?: string;
        address_line2?: string;
        city?: string;
        region?: string;
        country?: string;
        postal_code?: string;
        geo_area_code?: string;
        geo_lat?: number | null;
        geo_lng?: number | null;
        // Delivery
        opening_hours?: Record<string, string> | string;
        delivery_instructions?: string;
        min_order_amount?: number;
        delivery_zone?: string;
        // Options
        allow_show_on_pos?: boolean;
        blocked_until?: string | null;
        block_reason?: string | null;
    };
    custom_fields?: Record<string, string>;
}

// ─── Partner Balances (§11) ───────────────────────────────────────────────────

export type BalanceType = 'POINTS' | 'BUDGET_PROMO' | 'AVOIR' | string;
export type BalanceOperation = 'set' | 'add' | 'subtract';

export interface PartnerBalance {
    id: number;
    partner_code: string;
    balance_type: BalanceType;
    balance: number;
    created_at?: string;
    updated_at?: string;
}

export interface UpsertBalanceRequest {
    partner_code: string;
    balance_type: BalanceType;
    balance: number;
    operation: BalanceOperation;
}

// ─── Credit evaluate dry-run (§6.5) ──────────────────────────────────────────

export interface CreditEvaluateResponse {
    eligible: boolean;
    status: CreditExposureStatus;
    available_after?: number;
    shortfall?: number;
    requires_approval?: boolean;
}

// ─── Discriminated union for the form panel's onSave callback ─────────────────

export type PartnerSavePayload =
    | { mode: 'create'; data: CreatePartnerFullPayload }
    | { mode: 'edit'; data: Partial<CreatePartnerRequest> };

// ─── Payment Methods (§7) ─────────────────────────────────────────────────────

export type PaymentMethodCode = 'CHEQUE' | 'CASH' | 'MOBILE' | 'EFFET' | 'VIREMENT' | 'CARD';
export type PaymentMethodType = 'cash' | 'check' | 'bank_transfer' | 'mobile_money' | 'credit_card';

export interface PaymentMethodRecord {
    id: number;
    code: PaymentMethodCode;
    name: string;
    type: PaymentMethodType;
    requires_reference: boolean;
    requires_bank: boolean;
    is_active: boolean;
    display_order: number;
}

// ─── Payment Override (§9) ────────────────────────────────────────────────────

export type OverrideApprovalStatus = 'pending' | 'approved' | 'rejected';

export interface PaymentOverride {
    id: number;
    document_type: 'order' | 'invoice';
    document_id: number;
    payment_term_id?: number | null;
    payment_method_id?: number | null;
    reason: string;
    approval_status: OverrideApprovalStatus;
    requested_by: number;
    approved_by?: number | null;
    comment?: string | null;
    payment_term?: { id: number; code: string; name: string } | null;
    payment_method?: { id: number; code: PaymentMethodCode; name: string } | null;
    created_at: string;
    updated_at: string;
}

export interface CreatePaymentOverrideRequest {
    document_type: 'order' | 'invoice';
    document_id: number;
    payment_term_id?: number | null;
    payment_method_id?: number | null;
    reason: string;
}

// ─── Itinerary endpoint (§11.1) ───────────────────────────────────────────────

export interface PartnerItineraryEntry {
    itinerary_id: number;
    itinerary_code: string;
    itinerary_name: string;
    itinerary_type: string;
    is_active: boolean;
    line_number: number;
    rank: number;
    is_stop_point: boolean;
    visit_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    visit_frequency_days: number;
}

export interface PartnerItineraryResponse {
    success: boolean;
    partner: { id: number; code: string; name: string };
    allocation: { allocation_priority: string; min_allocation_pct: number };
    itineraries: PartnerItineraryEntry[];
}
