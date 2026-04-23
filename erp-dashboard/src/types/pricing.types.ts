export interface ApiSuccessResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page: number;
    per_page?: number;
    total?: number;
}

export interface ListsResponse<T> {
    lists: PaginatedResponse<T>;
    filters: Record<string, any>;
}

export interface PackagingPriceFilters {
    price_list_id?: number;
    line_detail_id?: number;
    page?: number;
    per_page?: number;
}

// ─── Price List Entities ─────────────────────────────────────────────────────

export interface PriceList {
    id: number;
    code: string;
    name: string;
    rank: number;
    lines_count?: number;
    lines?: PriceListLine[];
    created_at?: string;
    updated_at?: string;
}

export interface PriceListLine {
    id: number;
    price_list_id: number;
    line_number: number;
    name: string;
    start_date: string;
    end_date: string;
    closed: boolean;
    details_count?: number;
    created_at?: string;
    updated_at?: string;
    details?: LineDetail[];
}

export interface LineDetail {
    id: number;
    // Depending on endpoint, we may receive either a direct link to the line,
    // or (price_list_id + line_number). Keep them all optional for flexibility.
    price_list_line_id?: number;
    price_list_id?: number;
    line_number?: number;
    product_id: number;
    sales_price: number;
    return_price: number;
    min_sales_price: number;
    max_sales_price: number;
    discount_amount: number;
    discount_rate: number;
    sales_discount?: number;
    unit_id?: number;
    product?: PricingProduct;
    // Helper property for UI logic
    is_dirty?: boolean;
}

export interface PricingProduct {
    id: number;
    code: string;
    name: string;
    category?: string;
}

// ─── Partner Overrides (Dérogations) ─────────────────────────────────────────

export interface PriceOverride {
    id: number;
    price_list_id: number;
    partner_id: number;
    product_id: number;
    fixed_price: number | null;
    discount_rate: number | null;
    discount_amount: number | null;
    valid_from: string | null;
    valid_to: string | null;
    active: boolean;
    priority: number;
    partner?: {
        id: number;
        code: string;
        name: string;
    };
    product?: PricingProduct;
    created_at?: string;
    updated_at?: string;
}

// ─── Packaging Prices ────────────────────────────────────────────────────────

export interface PackagingPrice {
    id: number;
    line_detail_id: number;
    packaging_id: number;
    sales_price: number;
    return_price: number;
    packaging?: {
        id: number;
        code: string;
        name: string;
        quantity: number;
    };
}

// ─── Filters & Requests ──────────────────────────────────────────────────────

export interface PriceListFilters {
    search?: string;
    rank?: number;
    page?: number;
    per_page?: number;
}

export interface OverrideFilters {
    price_list_id?: number;
    partner_id?: number;
    product_id?: number;
    active?: boolean;
    search?: string;
    page?: number;
    per_page?: number;
}

export interface CreatePriceListRequest {
    code: string;
    name: string;
    rank: number;
}

export interface UpdatePriceListRequest {
    code?: string;
    name?: string;
    rank?: number;
}

export interface CreateLineRequest {
    line_number?: number;
    name: string;
    start_date: string;
    end_date: string;
    closed?: boolean;
}

export interface UpdateLineRequest {
    name?: string;
    start_date?: string;
    end_date?: string;
    closed?: boolean;
}

export interface UpsertDetailItem {
    product_id: number;
    sales_price: number;
    return_price: number;
    min_sales_price: number;
    max_sales_price: number;
    discount_amount: number;
    discount_rate: number;
}

export interface UpsertDetailsRequest {
    details: UpsertDetailItem[];
}

export interface DuplicateLineRequest {
    source_line_number: number;
    new_line_number?: number;
    new_start_date: string;
    new_end_date: string;
    new_name?: string;
}

export interface ImportCsvParams {
    file: File;
    mode: 'merge' | 'replace';
    has_header: boolean;
    product_identifier: 'id' | 'code';
}

export interface CreateOverrideRequest {
    price_list_id: number;
    partner_id: number;
    product_id: number;
    fixed_price?: number;
    discount_rate?: number;
    discount_amount?: number;
    valid_from?: string;
    valid_to?: string;
    priority?: number;
    active?: boolean;
}

export interface PreviewPriceRequest {
    partner_id: number;
    product_id: number;
    date?: string;
    quantity?: number;
}

export interface PreviewPriceResponse {
    final_price: number;
    base_price: number;
    applied_rule: 'base' | 'override' | 'promotion';
    rule_details?: any;
    breakdown: {
        label: string;
        value: number;
        operation: 'add' | 'subtract' | 'set';
    }[];
}

export interface CreatePackagingPriceRequest {
    line_detail_id: number;
    packaging_id: number;
    sales_price: number;
    return_price: number;
}
