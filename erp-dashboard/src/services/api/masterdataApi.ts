import apiClient from './client';

const MASTERDATA_BASE = '/api/backend/masterdata';

export interface Partner {
    code: string;
    name: string;
    credit_limit: string;
    credit_used: string;
    price_list_id: number;
    price_list?: {
        id: number;
        code: string;
        name: string;
        rank: number;
        created_at: string;
        updated_at: string;
        company_id: number | null;
    };
}

export interface PartnersListResponse {
    success: boolean;
    message: string;
    partner: Partner[];
}

export interface Product {
    id: number;
    code: string;
    name: string;
    short_description: string;
    is_active: boolean;
    thumbnail: string;
    flags?: {
        is_salable: boolean;
        is_discountable: boolean;
        is_weight_managed: boolean;
        decimal_quantity_allowed: boolean;
        [key: string]: any;
    };
    price_list_details?: any[];
    media?: any;
}

export interface ProductsListResponse {
    success: boolean;
    message: string;
    product: Product[];
}

// GET /masterdata/banks — added 2026-08-16, resolves the GCOM Règlement gap
// (POST /gcom/payments needs bank_id for non-cash terms; there was previously
// no lookup endpoint). Generic, not GCOM-specific — lives here like
// partners/products above.
export interface Bank {
    id: number;
    code: string;
    name: string;
    swift_code: string | null;
    is_active: boolean;
}

export interface BanksListResponse {
    success: boolean;
    data: Bank[];
}

// GET /masterdata/payment-methods — added 2026-08-16, feeds the new
// payment_method_id field on POST /gcom/payments. Global list, no per-partner
// filtering (confirmed by backend as not needed for now).
// `type: 'check'` reliably identifies Chèque/Effet (verified live) — use that,
// not name matching, to decide when the `instrument` payload is needed.
// `requires_bank`/`requires_reference` are NOT reliable predictors of what
// POST /gcom/payments actually demands — verified live: CASH (requires_bank:
// false here) still 422s "Bank is required" when combined with a real credit
// payment_term. The bank field is kept unconditionally required in the
// Règlement form for this reason, not gated by this flag.
export type GcomPaymentMethodType = 'bank_transfer' | 'cash' | 'check' | 'credit_card' | 'mobile_money' | string;

export interface PaymentMethod {
    id: number;
    code: string;
    name: string;
    type: GcomPaymentMethodType;
    requires_reference: boolean;
    requires_bank: boolean;
    is_active: boolean;
    display_order?: number;
}

export interface PaymentMethodsListResponse {
    success: boolean;
    data: PaymentMethod[];
}

export const masterdataApi = {
    partners: {
        getAll: async (): Promise<PartnersListResponse> => {
            const response = await apiClient.get<PartnersListResponse>(`${MASTERDATA_BASE}/partners`);
            return response.data;
        },
    },
    products: {
        getAll: async (): Promise<ProductsListResponse> => {
            const response = await apiClient.get<ProductsListResponse>(`${MASTERDATA_BASE}/products`);
            return response.data;
        },
    },
    banks: {
        getAll: async (): Promise<Bank[]> => {
            const response = await apiClient.get<BanksListResponse>(`${MASTERDATA_BASE}/banks`);
            // Defensively re-filter/sort client-side rather than trust the
            // "actives uniquement, triées par nom" claim verbatim.
            return response.data.data
                .filter(b => b.is_active)
                .sort((a, b) => a.name.localeCompare(b.name, 'fr'));
        },
    },
    paymentMethods: {
        getAll: async (): Promise<PaymentMethod[]> => {
            const response = await apiClient.get<PaymentMethodsListResponse>(`${MASTERDATA_BASE}/payment-methods`);
            return response.data.data
                .filter(m => m.is_active)
                .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0));
        },
    },
};
