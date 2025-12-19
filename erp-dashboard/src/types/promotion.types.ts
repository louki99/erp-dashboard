export const PromotionType = {
    PERCENTAGE_DISCOUNT: 1,
    FIXED_AMOUNT_DISCOUNT: 2,
    BEST_PRICE: 3,
    AMOUNT_PER_UNIT: 4,
    FREE_PROMO_UNIT: 5,
    FLAT_AMOUNT_DISCOUNT: 6,
    REPLACE_PRICE: 7
} as const;

export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const BreakpointType = {
    VALUE_BASED: 1,      // MAD amount
    QUANTITY_BASED: 2,   // Number of units
    PROMO_UNIT_BASED: 3  // Standardized units
} as const;

export type BreakpointType = (typeof BreakpointType)[keyof typeof BreakpointType];

export const AssortmentType = {
    NONE: 0,
    MULTIPLE_AND: 1,     // Must have X of Product A AND Y of Product B
    CART_AMOUNT: 2,      // Minimum cart total
    BOTH: 3              // Both Assortment AND Cart Amount
} as const;

export type AssortmentType = (typeof AssortmentType)[keyof typeof AssortmentType];

export const PromotionPaidBasedOn = {
    ENTIRE_CART: 'cart',
    PRODUCT_FAMILY: 'family',
    SPECIFIC_PRODUCT: 'product'
} as const;

export type PromotionPaidBasedOn = (typeof PromotionPaidBasedOn)[keyof typeof PromotionPaidBasedOn];

export interface PromotionLineAssortment {
    id?: number;
    based_on_product: boolean;
    product_code: string; // Product Code or Family Code
    minimum: number;
}

export interface PromotionLineDetail {
    detail_number?: number;
    promo_type: PromotionType;
    minimum_value: number; // The breakpoint value
    amount: number;        // The discount amount/percentage/price
    repeating: boolean;
}

export interface PromotionLine {
    line_number?: number;
    name: string;

    // Target
    paid_based_on_product: boolean; // false = family-based, true = product-based
    paid_product_code?: string;
    paid_product_family_code?: string;

    // Assortment Rules
    assortment_type: AssortmentType;
    minimum_cart_amount?: number;
    assortments: PromotionLineAssortment[];

    // Breakpoints & Rewards
    details: PromotionLineDetail[];
}

export interface Promotion {
    id?: number;
    code: string;
    name: string;
    description?: string;

    start_date: string;
    end_date: string;

    is_closed: boolean;
    sequence: number; // Priority (lower = higher priority)

    breakpoint_type: BreakpointType;
    scale_method?: number; // 1=Linear, 2=Step (usually implied by logic)

    payment_term_dependent: boolean;

    // Relationships
    lines: PromotionLine[];
    partner_families: string[]; // List of Family Codes
    payment_terms: string[];    // List of Payment Term Codes

    // Stats (ReadOnly)
    usage_count?: number;
    total_discount?: number;
}

export interface PromotionStats {
    total: number;
    active: number;
    upcoming: number;
    expired: number;
}

export interface PromotionListResponse {
    promotions: {
        data: Promotion[];
        current_page: number;
        total: number;
        last_page: number;
    };
    statistics: PromotionStats;
}

// Partner Family Types
export interface PartnerFamily {
    id?: number;
    code: string;
    name: string;
    partner_condition?: string;
    partners_count?: number;
    partners?: Array<{
        id: number;
        code: string;
        name: string;
    }>;
    promotions?: Promotion[];
    boosts?: ProductFamilyBoost[];
}

export interface PartnerFamilyListResponse {
    partnerFamilies: PartnerFamily[];
}

export interface PartnerFamilyDetailResponse {
    partnerFamily: PartnerFamily;
}

// Product Family Types
export interface ProductFamily {
    id?: number;
    code: string;
    name: string;
    description?: string;
    sales_group_code?: string;
    products_count?: number;
    products?: Array<{
        id: number;
        code: string;
        name: string;
    }>;
    boosts?: ProductFamilyBoost[];
}

export interface ProductFamilyListResponse {
    productFamilies: ProductFamily[];
}

export interface ProductFamilyDetailResponse {
    productFamily: ProductFamily;
}

// Boost Types
export interface ProductFamilyBoost {
    id?: number;
    product_family_id: number;
    partner_family_id: number;
    rank: number;
    boost_factor: number;
    productFamily?: ProductFamily;
    partnerFamily?: PartnerFamily;
}

export interface BoostListResponse {
    boosts: ProductFamilyBoost[];
}

export interface BoostDetailResponse {
    boost: ProductFamilyBoost;
}

export interface BulkSyncBoostRequest {
    product_family_id: number;
    boosts: Array<{
        partner_family_id: number;
        rank: number;
        boost_factor: number;
    }>;
}