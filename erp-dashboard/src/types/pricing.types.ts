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

// GET /pricing/overrides — response body shape
export interface OverridesIndexResponse {
    overrides: PaginatedResponse<PriceOverride>;
    filters: { q: string; partner_id: number; product_id: number; active: boolean | null };
    partners: Array<{ id: number; code: string; name: string }>;
}

// ─── Packagings (colisages) — contrat §6.1c figé ─────────────────────────────
// GET /pricing/products/{id}/packagings → ARRAY NU.
// Sans query param → price: null (mode dropdown).
// ?price_list_id=N → prix résolu sur la ligne active de cette liste.
// ?partner_id=N → liste effective du client (directe → canal) + overrides N1.

// Vocabulaire unique des sources du moteur v5 (badges UI partout)
export type PriceSource =
    | 'partner_override'
    | 'partner_override_discount'
    | 'tier'
    | 'override'
    | 'standard'
    | 'linear'
    | 'colisage_unpriced'
    | 'no_base';

export interface ResolvedPackagingPrice {
    unit_price: number;
    source: PriceSource | string;
    min_price?: number | null;
    max_price?: number | null;
    sellable: boolean;
}

export interface ProductPackaging {
    id: number;
    label: string;              // ex: "Carton (Qty: 100)"
    unit: { id: number; code: string; name: string };
    quantity: number;
    is_default: boolean;
    price: ResolvedPackagingPrice | null;
}

export interface PackagingResolutionParams {
    price_list_id?: number;
    partner_id?: number;
}

// ─── Filters & Requests ──────────────────────────────────────────────────────

export interface PriceListFilters {
    search?: string;
    rank?: number;
    page?: number;
    per_page?: number;
}

export interface OverrideFilters {
    partner_id?: number;
    product_id?: number;
    active?: boolean;
    q?: string;
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

// ─── Bulk Operations (Full-Screen Grid Enterprise ERP) ───────────────────────

export type BulkUpdateOperation =
    | 'increase_rate'
    | 'decrease_rate'
    | 'increase_amount'
    | 'decrease_amount'
    | 'set_value'
    | 'multiply'
    | 'copy_from_list';

export type BulkUpdateField =
    | 'sales_price'
    | 'return_price'
    | 'min_sales_price'
    | 'max_sales_price'
    | 'discount_rate'
    | 'discount_amount';

export interface BulkUpdateFilter {
    product_ids?: number[];
    min_price?: number;
    max_price?: number;
}

export interface BulkUpdateRequest {
    line_number?: number;
    operation: BulkUpdateOperation;
    field: BulkUpdateField;
    value: number;
    scope?: 'all' | 'selected';
    filters?: BulkUpdateFilter;
    source_price_list_id?: number;
    source_line_number?: number;
}

export interface BulkUpdateResponse {
    updated_count: number;
    line_number?: number;
}

export interface ImportPriceListParams {
    file: File;
    line_number?: number;
    mode: 'merge' | 'replace';
    has_header: boolean;
    product_identifier: 'id' | 'code';
    sheet_index?: number;
}

export interface ImportPriceListResponse {
    imported: number;
    updated: number;
    errors: number;
    line_number?: number;
}

export type ExportFormat = 'csv' | 'xlsx';

export interface ExportPriceListParams {
    line_number?: number;
    format: ExportFormat;
}

export interface CreateOverrideRequest {
    partner_id: number;
    product_id: number;
    // fixed_price = prix par unité de base; court-circuite les remises s'il est renseigné.
    fixed_price?: number | null;
    // discount_rate = POURCENTAGE 0–100 (envoyer 10 pour -10 %).
    discount_rate?: number | null;
    discount_amount?: number | null;
    valid_from?: string;
    valid_to?: string;
    priority?: number;
    active?: boolean;
}

export interface PreviewPriceRequest {
    partner_id: number;
    product_id: number;
}

// POST /pricing/overrides/preview — prix effectif calculé par le moteur v5
export interface PreviewPriceResponse {
    final_price: number;
    base_price: number;
    source: 'standard' | 'partner_override' | 'partner_override_discount' | string;
    detail: {
        sales_price?: string;
        min_sales_price?: string;
        max_sales_price?: string;
    } | null;
    algorithm_version: number;
}

// ─── Channels & Business Chronologies (Module 20) ────────────────────────────

export interface Channel {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    price_list_id?: number | null;
    is_active: boolean;
    sort_order: number;
    partners_count?: number;
    price_list?: { id: number; code: string; name: string; rank: number } | null;
}

export interface BusinessChronology {
    id: number;
    code: string;
    name: string;
    description?: string | null;
    available_sub_types: string[];
    is_active: boolean;
    sort_order: number;
    partners_count?: number;
    promotions_count?: number;
}

export interface PartnerChronologyAssignment {
    id: number;
    code: string;
    name: string;
    sub_types: string[];
    is_primary: boolean;
}

export interface SyncChronologiesRequest {
    chronologies: Array<{
        code: string;
        sub_types?: string[];
        is_primary?: boolean;
    }>;
}

export interface PartnerChronologiesResponse {
    success: boolean;
    chronologies: PartnerChronologyAssignment[];
    availableChronologies: BusinessChronology[];
}

export interface CreateChannelRequest {
    code: string;
    name: string;
    description?: string | null;
    price_list_id?: number | null;
    is_active?: boolean;
    sort_order?: number;
}

export interface UpdateChannelRequest {
    code?: string;
    name?: string;
    description?: string | null;
    price_list_id?: number | null;
    is_active?: boolean;
    sort_order?: number;
}

export interface CreateBusinessChronologyRequest {
    code: string;
    name: string;
    description?: string | null;
    available_sub_types?: string[];
    is_active?: boolean;
    sort_order?: number;
}

export interface UpdateBusinessChronologyRequest {
    code?: string;
    name?: string;
    description?: string | null;
    available_sub_types?: string[];
    is_active?: boolean;
    sort_order?: number;
}
