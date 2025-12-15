import apiClient from './client';
import type {
    PreparationsResponse,
    BonPreparationDetailResponse,
    ApiSuccessResponse,
    SavePreparationRequest,
    RejectPreparationRequest,
    StockResponse,
    StockAdjustmentRequest,
    DashboardStats,
} from '@/types/magasinier.types';

const MAGASINIER_BASE = '/api/backend/magasinier';

export const magasinierApi = {
    dashboard: {
        get: async (): Promise<DashboardStats> => {
            const response = await apiClient.get<DashboardStats>(`${MAGASINIER_BASE}/dashboard`);
            return response.data;
        },
    },

    preparations: {
        getPending: async (params?: { status?: string; search?: string; page?: number }): Promise<PreparationsResponse> => {
            const response = await apiClient.get<PreparationsResponse>(`${MAGASINIER_BASE}/preparations/pending`, { params });
            return response.data;
        },

        getDetail: async (id: number): Promise<BonPreparationDetailResponse> => {
            const response = await apiClient.get<BonPreparationDetailResponse>(`${MAGASINIER_BASE}/preparations/${id}`);
            return response.data;
        },

        prepare: async (id: number): Promise<BonPreparationDetailResponse> => {
            const response = await apiClient.get<BonPreparationDetailResponse>(`${MAGASINIER_BASE}/preparations/${id}/prepare`);
            return response.data;
        },

        save: async (id: number, data: SavePreparationRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.put<ApiSuccessResponse>(`${MAGASINIER_BASE}/preparations/${id}/save`, data);
            return response.data;
        },

        reject: async (id: number, data: RejectPreparationRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${MAGASINIER_BASE}/preparations/${id}/reject`, data);
            return response.data;
        },
    },

    orders: {
        getApproved: async (params?: { search?: string; page?: number }): Promise<any> => {
            const response = await apiClient.get(`${MAGASINIER_BASE}/orders/approved`, { params });
            return response.data;
        },

        createBpFromOrders: async (orderIds: number[]): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${MAGASINIER_BASE}/preparations/from-orders`, {
                order_ids: orderIds,
            });
            return response.data;
        },
    },

    stock: {
        getList: async (params?: { search?: string; low_stock?: boolean; out_of_stock?: boolean; page?: number }): Promise<StockResponse> => {
            const response = await apiClient.get<StockResponse>(`${MAGASINIER_BASE}/stock`, { params });
            return response.data;
        },

        getLowStock: async (): Promise<StockResponse> => {
            const response = await apiClient.get<StockResponse>(`${MAGASINIER_BASE}/stock/low-stock`);
            return response.data;
        },

        getMovements: async (params?: { type?: string; product_id?: number; date_from?: string; date_to?: string; page?: number }): Promise<any> => {
            const response = await apiClient.get(`${MAGASINIER_BASE}/stock/movements`, { params });
            return response.data;
        },

        adjust: async (data: StockAdjustmentRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${MAGASINIER_BASE}/stock/adjust`, data);
            return response.data;
        },
    },

    batchPicking: {
        getAvailable: async (): Promise<any> => {
            const response = await apiClient.get(`${MAGASINIER_BASE}/batch-picking`);
            return response.data;
        },

        generate: async (blIds: number[]): Promise<any> => {
            const response = await apiClient.post(`${MAGASINIER_BASE}/batch-picking/generate`, { bl_ids: blIds });
            return response.data;
        },

        distribute: async (id: number): Promise<any> => {
            const response = await apiClient.get(`${MAGASINIER_BASE}/batch-picking/${id}/distribute`);
            return response.data;
        },

        save: async (id: number, prepared: Record<string, Record<string, number>>): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${MAGASINIER_BASE}/batch-picking/${id}/save`, { prepared });
            return response.data;
        },
    },
};
