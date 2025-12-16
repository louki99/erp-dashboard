import apiClient from './client';
import type { Promotion, PromotionListResponse } from '@/types/promotion.types';

export const promotionsApi = {
    getPromotions: async (params?: {
        page?: number;
        status?: string;
        search?: string;
        start_date?: string;
        end_date?: string;
    }) => {
        const response = await apiClient.get<PromotionListResponse>('/api/backend/promotions', { params });
        return response.data;
    },

    getPromotion: async (id: number) => {
        const response = await apiClient.get<{ promotion: Promotion }>(`/api/backend/promotions/${id}`);
        return response.data;
    },

    createPromotion: async (data: Partial<Promotion>) => {
        const response = await apiClient.post<{ success: boolean; promotion: Promotion }>('/api/backend/promotions', data);
        return response.data;
    },

    updatePromotion: async (id: number, data: Partial<Promotion>) => {
        const response = await apiClient.put<{ success: boolean; promotion: Promotion }>(`/api/backend/promotions/${id}`, data);
        return response.data;
    },

    deletePromotion: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean }>(`/api/backend/promotions/${id}`);
        return response.data;
    },

    clonePromotion: async (id: number) => {
        const response = await apiClient.post<{ success: boolean; clone: Promotion }>(`/api/backend/promotions/${id}/clone`);
        return response.data;
    },

    // Auxiliary Data Providers
    getProductFamilies: async () => {
        const response = await apiClient.get<any[]>('/api/backend/product-families');
        return response.data;
    },

    getPartnerFamilies: async () => {
        const response = await apiClient.get<any[]>('/api/backend/partner-families');
        return response.data;
    },

    getPaymentTerms: async () => {
        // Assuming there is an endpoint for payment terms, otherwise we might mock or use a different service
        const response = await apiClient.get<any[]>('/api/backend/payment-terms');
        return response.data;
    }
};
