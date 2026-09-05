import apiClient from './client';
import type {
    CreateSalesSouchePayload,
    SalesSouche,
    SalesSoucheDeleteConflictResponse,
    SalesSoucheDeleteResponse,
    SalesSoucheFilters,
    SalesSoucheListResponse,
    SalesSoucheSingleResponse,
    UpdateSalesSouchePayload,
} from '@/types/salesSouches.types';

const SALES_SOUCHES_BASE = '/api/backend/access-control/sales-souches';

export const getSalesSouches = async (filters: SalesSoucheFilters = {}): Promise<SalesSoucheListResponse> => {
    const response = await apiClient.get<SalesSoucheListResponse>(SALES_SOUCHES_BASE, { params: filters });
    return response.data;
};

export const getSalesSouche = async (id: number): Promise<SalesSouche> => {
    const response = await apiClient.get<SalesSoucheSingleResponse>(`${SALES_SOUCHES_BASE}/${id}`);
    return response.data.data;
};

export const createSalesSouche = async (payload: CreateSalesSouchePayload): Promise<SalesSouche> => {
    const response = await apiClient.post<SalesSoucheSingleResponse>(SALES_SOUCHES_BASE, payload);
    return response.data.data;
};

export const updateSalesSouche = async (id: number, payload: UpdateSalesSouchePayload): Promise<SalesSouche> => {
    const response = await apiClient.put<SalesSoucheSingleResponse>(`${SALES_SOUCHES_BASE}/${id}`, payload);
    return response.data.data;
};

// 409 (still referenced) surfaces as an axios error with response.data
// shaped like SalesSoucheDeleteConflictResponse — same convention as
// deleteTokenSerie, left to the caller to catch/branch on.
export const deleteSalesSouche = async (id: number): Promise<SalesSoucheDeleteResponse | SalesSoucheDeleteConflictResponse> => {
    const response = await apiClient.delete<SalesSoucheDeleteResponse | SalesSoucheDeleteConflictResponse>(`${SALES_SOUCHES_BASE}/${id}`);
    return response.data;
};
