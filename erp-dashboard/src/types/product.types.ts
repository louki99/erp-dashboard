export interface ApiSuccessResponse {
    success: boolean;
    message?: string;
    errors?: Record<string, string[]>;
}

export interface PaginatedResponse<T> {
    data: T[];
    current_page: number;
    last_page?: number;
    per_page?: number;
    total: number;
}

export interface Brand {
    id: number;
    name: string;
    slug?: string;
}

export interface Unit {
    id: number;
    name: string;
    short_name?: string;
}

export interface Category {
    id: number;
    name: string;
    slug?: string;
    parent_id?: number;
}

export interface VatTax {
    id: number;
    name: string;
    rate: number;
}

export interface Supplier {
    id: number;
    name: string;
    code?: string;
}

export interface ProductMedia {
    id: number;
    src?: string;
    url?: string;
    name?: string;
}

export interface ProductFlags {
    id?: number;
    product_id?: number;
    decimal_quantity_allowed?: boolean;
    decimal_precision?: number;
    is_backorder_allowed?: boolean;
    is_batch_managed?: boolean;
    is_consignment?: boolean;
    is_discountable?: boolean;
    is_expirable?: boolean;
    is_returnable?: boolean;
    is_salable?: boolean;
    is_serialized?: boolean;
    is_weight_managed?: boolean;
    decimal_step?: string;
    min_quantity_order?: string;
}

export interface ProductMarketing {
    id?: number;
    product_id?: number;
    is_featured?: boolean;
    is_free_good?: boolean;
    is_ideal_orderable?: boolean;
    is_quotation_required?: boolean;
    is_slow_moving?: boolean;
    is_sold_separately?: boolean;
    is_visible_individually?: boolean;
    requires_login_to_view?: boolean;
}

export interface CustomField {
    id: number;
    field_name: string;
    field_label: string;
    field_type: 'text' | 'number' | 'select' | 'checkbox' | 'textarea' | 'date';
    entity_type: string;
    is_required: boolean;
    default_value?: any;
    options?: string[];
    validation_rules?: string[];
    placeholder?: string;
    help_text?: string;
    order: number;
    is_active: boolean;
    is_searchable: boolean;
    is_visible: boolean;
}

export interface CustomFieldValue {
    label: string;
    value: any;
    formatted_value?: any;
    type: string;
    field: CustomField;
}

export interface ProductStock {
    id: number;
    branch_code?: string;
    quantity: number;
    available_quantity?: number;
    reserved_quantity?: number;
    branch?: {
        id: number;
        name: string;
        code: string;
    };
}

export interface ProductSupplier {
    id: number;
    supplier_id: number;
    cost?: number;
    min_quantity?: number;
    lead_time_days?: number;
    is_preferred?: boolean;
    supplier?: Supplier;
}

export interface Product {
    id: number;
    name: string;
    code: string;
    slug?: string;
    price: number | string;
    discount_price?: number | string;
    quantity?: number;
    min_order_quantity?: number;
    brand_id?: number;
    unit_id?: number;
    short_description?: string;
    description?: string;
    buy_price?: number | string;
    has_colisage?: boolean;
    is_active: boolean;
    is_approve?: boolean;
    is_new?: boolean;
    is_featured?: boolean;
    created_at?: string;
    updated_at?: string;
    thumbnail?: string;
    media?: ProductMedia;
    brand?: Brand;
    unit?: Unit;
    units?: Unit[];
    categories?: Category[];
    subcategories?: Category[];
    vatTaxes?: VatTax[];
    vat_taxes?: VatTax[];
    suppliers?: ProductSupplier[];
    flags?: ProductFlags;
    marketing?: ProductMarketing;
    stocks?: ProductStock[];
    medias?: ProductMedia[];
    video_media?: ProductMedia;
    colors?: any[];
    sizes?: any[];
    packagings?: any[];
    custom_field_values?: any[];
    customFieldValues?: CustomFieldValue[];
    thumbnails?: ProductMedia[];
    additional_thumbnails?: ProductMedia[];
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string[];
}

export interface ProductsListResponse {
    success: boolean;
    data: PaginatedResponse<Product>;
    meta?: {
        total: number;
        per_page: number;
        current_page: number;
        last_page: number;
    };
}

export interface ProductDetailResponse extends ApiSuccessResponse {
    data: {
        product: Product;
        custom_fields?: Record<string, CustomFieldValue>;
        stock_summary?: {
            total_stock: number;
            available_stock: number;
            reserved_stock: number;
            by_branch: ProductStock[];
        };
        thumbnails?: any[];
        additional_thumbnails?: any[];
    };
}

export interface ProductFormMetadata {
    success: boolean;
    data: {
        brands: Brand[];
        categories: Category[];
        units: Unit[];
        vat_taxes: VatTax[];
        suppliers: Supplier[];
        custom_fields?: any[];
        shop?: any;
    };
}

export interface CreateProductRequest {
    name: string;
    code: string;
    price: number;
    discount_price?: number;
    quantity?: number;
    min_order_quantity?: number;
    brand?: number;
    unit?: number;
    short_description?: string;
    description?: string;
    buy_price?: number;
    has_colisage?: boolean;
    thumbnail?: File;
    additionThumbnail?: File[];
    categories?: number[];
    vat_taxes?: number[];
    units_multi?: number[];
    suppliers?: number[];
    decimal_quantity_allowed?: boolean;
    decimal_precision?: number;
    is_backorder_allowed?: boolean;
    is_batch_managed?: boolean;
    is_discountable?: boolean;
    is_expirable?: boolean;
    is_returnable?: boolean;
    is_salable?: boolean;
    is_serialized?: boolean;
    is_weight_managed?: boolean;
    is_featured?: boolean;
    is_free_good?: boolean;
    is_quotation_required?: boolean;
    is_visible_individually?: boolean;
    requires_login_to_view?: boolean;
    custom_fields?: Record<string, any>;
    meta_title?: string;
    meta_description?: string;
    meta_keywords?: string[];
    [key: string]: any;
}

export interface ProductFilters {
    status?: string;
    is_active?: boolean;
    search?: string;
    category?: number;
    brand?: number;
    min_price?: number;
    max_price?: number;
    in_stock?: boolean;
    sort_by?: string;
    sort_order?: 'asc' | 'desc';
    per_page?: number;
    page?: number;
}

export interface BulkUpdateRequest {
    product_ids: number[];
    action: 'activate' | 'deactivate' | 'approve' | 'delete';
}

export interface ProductStatistics {
    success: boolean;
    data: {
        total_products: number;
        active_products: number;
        pending_approval: number;
        out_of_stock: number;
        low_stock: number;
    };
}

export interface StockSummaryResponse {
    success: boolean;
    data: {
        product_id: number;
        product_name: string;
        total_stock: number;
        available_stock: number;
        reserved_stock: number;
        stocks_by_branch: ProductStock[];
    };
}
