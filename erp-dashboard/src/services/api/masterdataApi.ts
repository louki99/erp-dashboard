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
};
