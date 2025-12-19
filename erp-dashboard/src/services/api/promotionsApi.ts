import apiClient from './client';
import type { 
    Promotion, 
    PromotionListResponse,
    PartnerFamily,
    PartnerFamilyListResponse,
    PartnerFamilyDetailResponse,
    ProductFamily,
    ProductFamilyListResponse,
    ProductFamilyDetailResponse,
    ProductFamilyBoost,
    BoostListResponse,
    BoostDetailResponse,
    BulkSyncBoostRequest
} from '@/types/promotion.types';

const PROMOTIONS_BASE = '/api/backend/promotions';

export const promotionsApi = {
    // ==================== Core Promotion Management ====================
    getPromotions: async (params?: {
        page?: number;
        status?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
        breakpoint_type?: number;
    }) => {
        const response = await apiClient.get<PromotionListResponse>(PROMOTIONS_BASE, { params });
        return response.data;
    },

    getPromotion: async (id: number) => {
        const response = await apiClient.get<{ promotion: Promotion }>(`${PROMOTIONS_BASE}/${id}`);
        return response.data;
    },

    getPromotionEdit: async (id: number) => {
        const response = await apiClient.get<{ promotion: Promotion }>(`${PROMOTIONS_BASE}/${id}/edit`);
        return response.data;
    },

    createPromotion: async (data: Partial<Promotion>) => {
        const response = await apiClient.post<{ success: boolean; promotion: Promotion }>(PROMOTIONS_BASE, data);
        return response.data;
    },

    updatePromotion: async (id: number, data: Partial<Promotion>) => {
        const response = await apiClient.put<{ success: boolean; promotion: Promotion }>(`${PROMOTIONS_BASE}/${id}`, data);
        return response.data;
    },

    deletePromotion: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean }>(`${PROMOTIONS_BASE}/${id}`);
        return response.data;
    },

    clonePromotion: async (id: number) => {
        const response = await apiClient.post<{ success: boolean; clone: Promotion }>(`${PROMOTIONS_BASE}/${id}/clone`);
        return response.data;
    },

    // ==================== Partner Family Management ====================
    getPartnerFamilies: async () => {
        const response = await apiClient.get<PartnerFamilyListResponse>(`${PROMOTIONS_BASE}/partner-families`);
        return response.data;
    },

    getPartnerFamily: async (id: number) => {
        const response = await apiClient.get<PartnerFamilyDetailResponse>(`${PROMOTIONS_BASE}/partner-families/${id}`);
        return response.data;
    },

    createPartnerFamily: async (data: Partial<PartnerFamily>) => {
        const response = await apiClient.post<{ success: boolean; partnerFamily: PartnerFamily }>(
            `${PROMOTIONS_BASE}/partner-families`, 
            data
        );
        return response.data;
    },

    updatePartnerFamily: async (id: number, data: Partial<PartnerFamily>) => {
        const response = await apiClient.put<{ success: boolean; partnerFamily: PartnerFamily }>(
            `${PROMOTIONS_BASE}/partner-families/${id}`, 
            data
        );
        return response.data;
    },

    deletePartnerFamily: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean }>(`${PROMOTIONS_BASE}/partner-families/${id}`);
        return response.data;
    },

    // ==================== Product Family Management ====================
    getProductFamilies: async () => {
        const response = await apiClient.get<ProductFamilyListResponse>(`${PROMOTIONS_BASE}/product-families`);
        return response.data;
    },

    getProductFamily: async (id: number) => {
        const response = await apiClient.get<ProductFamilyDetailResponse>(`${PROMOTIONS_BASE}/product-families/${id}`);
        return response.data;
    },

    createProductFamily: async (data: Partial<ProductFamily>) => {
        const response = await apiClient.post<{ success: boolean; productFamily: ProductFamily }>(
            `${PROMOTIONS_BASE}/product-families`, 
            data
        );
        return response.data;
    },

    updateProductFamily: async (id: number, data: Partial<ProductFamily>) => {
        const response = await apiClient.put<{ success: boolean; productFamily: ProductFamily }>(
            `${PROMOTIONS_BASE}/product-families/${id}`, 
            data
        );
        return response.data;
    },

    deleteProductFamily: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean }>(`${PROMOTIONS_BASE}/product-families/${id}`);
        return response.data;
    },

    // ==================== Boost Management ====================
    getBoosts: async (params?: {
        product_family_id?: number;
        partner_family_id?: number;
    }) => {
        const response = await apiClient.get<BoostListResponse>(`${PROMOTIONS_BASE}/boosts`, { params });
        return response.data;
    },

    getBoost: async (id: number) => {
        const response = await apiClient.get<BoostDetailResponse>(`${PROMOTIONS_BASE}/boosts/${id}`);
        return response.data;
    },

    createBoost: async (data: Partial<ProductFamilyBoost>) => {
        const response = await apiClient.post<{ success: boolean; boost: ProductFamilyBoost }>(
            `${PROMOTIONS_BASE}/boosts`, 
            data
        );
        return response.data;
    },

    updateBoost: async (id: number, data: Partial<ProductFamilyBoost>) => {
        const response = await apiClient.put<{ success: boolean; boost: ProductFamilyBoost }>(
            `${PROMOTIONS_BASE}/boosts/${id}`, 
            data
        );
        return response.data;
    },

    deleteBoost: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean }>(`${PROMOTIONS_BASE}/boosts/${id}`);
        return response.data;
    },

    bulkSyncBoosts: async (data: BulkSyncBoostRequest) => {
        const response = await apiClient.post<{ success: boolean }>(
            `${PROMOTIONS_BASE}/boosts/bulk-sync`, 
            data
        );
        return response.data;
    },

    // ==================== Auxiliary Data ====================
    getPaymentTerms: async () => {
        const response = await apiClient.get<any[]>('/api/backend/payment-terms');
        return response.data;
    }
};
