import apiClient from './client';
import type {
    PurchaseOrderListFilters, PurchaseOrderListResponse, PurchaseOrderShowResponse,
    CreatePurchaseOrderPayload, PurchaseOrderMutationResponse, CancelPurchaseOrderPayload,
    PurchaseOrderLinePayload,
    PurchaseReceptionListFilters, PurchaseReceptionListResponse, PurchaseReceptionShowResponse,
    CreatePurchaseReceptionPayload, PurchaseReceptionMutationResponse, CancelPurchaseReceptionPayload,
} from '@/types/achats.types';

const BASE = '/api/backend';

// No X-Idempotency-Key on any endpoint here — unlike gcomApi.ts's orders/
// delivery-notes/etc, the Achats doc (30-achats-purchase-orders.md) never
// mentions it for purchase-orders/purchase-receptions, so it's not sent.
export const achatsApi = {
    purchaseOrders: {
        list: async (filters?: PurchaseOrderListFilters): Promise<PurchaseOrderListResponse['data']> => {
            const response = await apiClient.get<PurchaseOrderListResponse>(`${BASE}/purchase-orders`, { params: filters });
            return response.data.data;
        },
        get: async (id: number) => {
            const response = await apiClient.get<PurchaseOrderShowResponse>(`${BASE}/purchase-orders/${id}`);
            return response.data.data;
        },
        create: async (payload: CreatePurchaseOrderPayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders`, payload);
            return response.data;
        },
        update: async (id: number, payload: Partial<CreatePurchaseOrderPayload>) => {
            const response = await apiClient.put<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}`, payload);
            return response.data;
        },
        addLine: async (id: number, payload: PurchaseOrderLinePayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/lines`, payload);
            return response.data;
        },
        deleteLine: async (id: number, lineId: number) => {
            const response = await apiClient.delete<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/lines/${lineId}`);
            return response.data;
        },
        confirm: async (id: number) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/confirm`);
            return response.data;
        },
        cancel: async (id: number, payload: CancelPurchaseOrderPayload) => {
            const response = await apiClient.post<PurchaseOrderMutationResponse>(`${BASE}/purchase-orders/${id}/cancel`, payload);
            return response.data;
        },
    },
    purchaseReceptions: {
        list: async (filters?: PurchaseReceptionListFilters): Promise<PurchaseReceptionListResponse['data']> => {
            const response = await apiClient.get<PurchaseReceptionListResponse>(`${BASE}/purchase-receptions`, { params: filters });
            return response.data.data;
        },
        get: async (id: number) => {
            const response = await apiClient.get<PurchaseReceptionShowResponse>(`${BASE}/purchase-receptions/${id}`);
            return response.data.data;
        },
        create: async (payload: CreatePurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions`, payload);
            return response.data;
        },
        validate: async (id: number) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/validate`);
            return response.data;
        },
        cancel: async (id: number, payload: CancelPurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/cancel`, payload);
            return response.data;
        },
        reverse: async (id: number, payload: CancelPurchaseReceptionPayload) => {
            const response = await apiClient.post<PurchaseReceptionMutationResponse>(`${BASE}/purchase-receptions/${id}/reverse`, payload);
            return response.data;
        },
    },
};
