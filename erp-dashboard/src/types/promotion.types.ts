export const PromotionType = {
    PERCENTAGE_DISCOUNT: 1,        // Type 1: Percentage (-10 = 10% off)
    AMOUNT_PER_UNIT: 2,           // Type 2: Amount Per Unit (-5 = 5 MAD off per unit)
    BEST_PRICE: 3,                // Type 3: Best Price (50 = max price 50 MAD)
    FREE_UNIT: 4,                 // Type 4: Free Units (-2 = 2 free units)
    FREE_PROMO_UNIT: 5,           // Type 5: Free Promo Units (-10 = 10 promo units free)
    FLAT_AMOUNT_DISCOUNT: 6,      // Type 6: Flat Amount (-100 = 100 MAD off total)
    REPLACE_PRICE: 7              // Type 7: Replace Price (76 = new price 76 MAD)
} as const;

export type PromotionType = (typeof PromotionType)[keyof typeof PromotionType];

export const BreakpointType = {
    QUANTITY_BASED: 1,   // Number of units
    VALUE_BASED: 2,      // MAD amount
    PROMO_UNIT_BASED: 3  // Standardized units
} as const;

export type BreakpointType = (typeof BreakpointType)[keyof typeof BreakpointType];

export const AssortmentType = {
    NONE: 0,                    // No requirement - any products qualify
    QUANTITY: 1,                // Absolute Quantity - Each item must meet minimum quantity
    QUANTITY_PERCENT: 2,        // Quantity % - Each item must be minimum % of total quantity
    AMOUNT_PERCENT: 3,          // Amount % - Each item must be minimum % of total amount
    AMOUNT: 4                   // Absolute Amount - Each item must meet minimum amount (MAD)
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
    based_on_product: string; // "0" = family, "1" = product
    product_code?: string;
    product_family_code?: string;
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

    // Paid Target (what triggers the discount)
    paid_based_on_product: PromotionPaidBasedOn; // 'entire_cart', 'family', 'product'
    paid_code?: string; // Unified field for API
    paid_product_code?: string; // UI helper
    paid_product_family_code?: string; // UI helper

    // Free Target (for Type 4 & 5 - what you get free)
    free_based_on_product?: string; // "0" = family, "1" = product
    free_code?: string; // Unified field for API
    free_product_code?: string; // UI helper
    free_product_family_code?: string; // UI helper

    // Assortment Rules
    assortment_type: AssortmentType | string | number;
    minimum_cart_amount?: number;
    assortments?: PromotionLineAssortment[];

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
    skip_to_sequence?: number; // Skip promotions with sequence < this value (0 = no skip)

    breakpoint_type: BreakpointType;
    scale_method: 1 | 2; // 1 = Cumulative/Progressive, 2 = Bracket/Highest tier only

    payment_term_dependent: boolean;

    // Burning / Redemption
    is_burning_promo?: boolean;
    based_on_burned?: string; // Code of the balance to burn (e.g. POINTS, BUDGET)

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
    created_at?: string;
    partners?: string[]; // Array of partner codes
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
    created_at?: string;
    products?: Array<{
        id: number;
        code: string;
        name: string;
    }> | string[]; // Can be objects from API or strings in form
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