import apiClient from './client';
import type {
    DispatcherDashboardData,
    DispatcherOrdersPendingResponse,
    DispatcherOrderDetailResponse,
    ConvertToBlResponse,
    DraftBonLivraisonsResponse,
    BonLivraisonsResponse,
    BonLivraisonDetailResponse,
    UpdateBonLivraisonRequest,
    ApiSuccessResponse,
    CreateBchRequest,
    BonChargementsResponse,
    BonChargementDetailResponse,
    BalanceResponse,
    UpdateBalanceRequest,
} from '@/types/dispatcher.types';

const DISPATCHER_BASE = '/api/backend/dispatcher';

export const dispatcherApi = {
    dashboard: {
        get: async (): Promise<DispatcherDashboardData> => {
            const response = await apiClient.get<DispatcherDashboardData>(`${DISPATCHER_BASE}/dashboard`);
            return response.data;
        },
    },

    orders: {
        getPending: async (filters?: { search?: string; date_from?: string; date_to?: string; page?: number }) => {
            const response = await apiClient.get<DispatcherOrdersPendingResponse>(`${DISPATCHER_BASE}/orders/pending`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (id: number): Promise<DispatcherOrderDetailResponse> => {
            const response = await apiClient.get<DispatcherOrderDetailResponse>(`${DISPATCHER_BASE}/orders/${id}`);
            return response.data;
        },

        convertToBl: async (id: number): Promise<ConvertToBlResponse> => {
            const response = await apiClient.post<ConvertToBlResponse>(`${DISPATCHER_BASE}/orders/${id}/convert-to-bl`);
            return response.data;
        },
    },

    bonLivraisons: {
        getDraft: async (): Promise<DraftBonLivraisonsResponse> => {
            const response = await apiClient.get<{ success: boolean; data: DraftBonLivraisonsResponse }>(`${DISPATCHER_BASE}/bon-livraisons/draft`);
            return response.data.data;
        },

        getList: async (filters?: { page?: number; status?: string; search?: string }) => {
            const response = await apiClient.get<BonLivraisonsResponse>(`${DISPATCHER_BASE}/bon-livraisons`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (id: number): Promise<BonLivraisonDetailResponse> => {
            const response = await apiClient.get<BonLivraisonDetailResponse>(`${DISPATCHER_BASE}/bon-livraisons/${id}`);
            return response.data;
        },

        edit: async (id: number): Promise<BonLivraisonDetailResponse> => {
            const response = await apiClient.get<BonLivraisonDetailResponse>(`${DISPATCHER_BASE}/bon-livraisons/${id}/edit`);
            return response.data;
        },

        update: async (id: number, data: UpdateBonLivraisonRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.put<ApiSuccessResponse>(`${DISPATCHER_BASE}/bon-livraisons/${id}`, data);
            return response.data;
        },
    },

    bonChargements: {
        create: async (data: CreateBchRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${DISPATCHER_BASE}/bon-chargements`, data);
            return response.data;
        },

        getList: async (filters?: { status?: string; livreur_id?: number; search?: string; page?: number }) => {
            const response = await apiClient.get<BonChargementsResponse>(`${DISPATCHER_BASE}/bon-chargements`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (id: number): Promise<BonChargementDetailResponse> => {
            const response = await apiClient.get<BonChargementDetailResponse>(`${DISPATCHER_BASE}/bon-chargements/${id}`);
            return response.data;
        },

        validate: async (id: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${DISPATCHER_BASE}/bon-chargements/${id}/validate`);
            return response.data;
        },

        getBalance: async (id: number): Promise<BalanceResponse> => {
            const response = await apiClient.get<BalanceResponse>(`${DISPATCHER_BASE}/bon-chargements/${id}/balance`);
            return response.data;
        },

        updateBalance: async (id: number, data: UpdateBalanceRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.put<ApiSuccessResponse>(`${DISPATCHER_BASE}/bon-chargements/${id}/balance`, data);
            return response.data;
        },
    },
};

export default dispatcherApi;
