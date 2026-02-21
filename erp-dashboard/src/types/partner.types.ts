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
    channel: string;
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
    // Relations
    price_list?: { id: number; code: string; name: string } | null;
    customer?: { id: number; user?: { id: number; name: string; email: string } } | null;
    parent?: Partner | null;
    children?: Partner[];
    salesperson?: { id: number; name: string } | null;
    payment_term?: { id: number; name: string; description?: string } | null;
    geo_area?: { id: number; code: string; name: string } | null;
    custom_field_values?: any[];
    // Timestamps
    created_at?: string;
    updated_at?: string;
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
    price_list_id?: number;
    per_page?: number;
    page?: number;
}

export interface CreatePartnerRequest {
    name: string;
    code?: string;
    price_list_id?: number;
    payment_term_id?: number;
    email?: string;
    phone?: string;
    whatsapp?: string;
    status?: PartnerStatus;
    partner_type?: string;
    channel?: string;
    credit_limit?: number;
    tax_number_ice?: string;
    tax_number_if?: string;
    tax_exempt?: boolean;
    address_line1?: string;
    address_line2?: string;
    city?: string;
    region?: string;
    country?: string;
    postal_code?: string;
    geo_area_code?: string;
    opening_hours?: string;
    delivery_instructions?: string;
    min_order_amount?: number;
    delivery_zone?: string;
    default_discount_rate?: number;
    default_discount_amount?: number;
    max_discount_rate?: number;
    custom_fields?: Record<string, string>;
}

export interface UpdateStatusRequest {
    new_status: PartnerStatus;
    status_change_reason: string;
    notify_partner?: boolean;
}

export interface BlockPartnerRequest {
    blocked_until?: string;
    block_reason?: string;
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
    auth: {
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
        name: string;
        code?: string;
        price_list_id?: number;
        payment_term_id?: number;
        partner_type: string;
        channel: string;
        status: PartnerStatus;
        credit_limit?: number;
        default_discount_rate?: number;
        phone?: string;
        email?: string;
        address_line1?: string;
        address_line2?: string;
        city?: string;
        region?: string;
        country?: string;
        postal_code?: string;
        tax_number_ice?: string;
        tax_number_if?: string;
        tax_exempt?: boolean;
        geo_area_code?: string;
        delivery_zone?: string;
        delivery_instructions?: string;
        min_order_amount?: number;
    };
    custom_fields?: Record<string, string>;
}

// ─── Discriminated union for the form panel's onSave callback ─────────────────

export type PartnerSavePayload =
    | { mode: 'create'; data: CreatePartnerFullPayload }
    | { mode: 'edit'; data: Partial<CreatePartnerRequest> };
