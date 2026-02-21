import apiClient from './client';
import type {
    Partner,
    PartnerListResponse,
    PartnerShowResponse,
    PartnerCreateFormResponse,
    PartnerPaymentTermsResponse,
    CreditHistoryResponse,
    PartnerStatisticsResponse,
    PartnerFilters,
    CreatePartnerRequest,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PaginatedPartners,
} from '../../types/partner.types';

const BASE_PATH = '/api/backend/partners';

// ─── List & Search ──────────────────────────────────────────────────────────

export const getPartners = async (filters: PartnerFilters): Promise<{ partners: PaginatedPartners; priceLists: { id: number; code: string; name: string }[] }> => {
    const response = await apiClient.get<PartnerListResponse>(BASE_PATH, { params: filters });
    return { partners: response.data.partners, priceLists: response.data.priceLists || [] };
};

export const getPartner = async (id: number): Promise<PartnerShowResponse> => {
    const response = await apiClient.get<PartnerShowResponse>(`${BASE_PATH}/${id}`);
    return response.data;
};

export const getStatistics = async (): Promise<PartnerStatisticsResponse> => {
    const response = await apiClient.get<PartnerStatisticsResponse>(`${BASE_PATH}/statistics`);
    return response.data;
};

export const generateCode = async (documentType: string = 'CL'): Promise<{ code: string; sequence: number }> => {
    const response = await apiClient.get<{ success: boolean; code: string; sequence: number }>(
        `${BASE_PATH}/generate-code`,
        { params: { document_type: documentType } }
    );
    return response.data;
};

// ─── Create form metadata ───────────────────────────────────────────────────

export const getCreateFormMeta = async (): Promise<PartnerCreateFormResponse> => {
    const response = await apiClient.get<PartnerCreateFormResponse>(`${BASE_PATH}/create`);
    return response.data;
};

export const getEditFormMeta = async (id: number): Promise<PartnerCreateFormResponse & { partner: Partner; customFields: Record<string, any> }> => {
    const response = await apiClient.get(`${BASE_PATH}/${id}/edit`);
    return response.data;
};

// ─── CRUD ───────────────────────────────────────────────────────────────────

export const createPartner = async (data: CreatePartnerRequest) => {
    const response = await apiClient.post<{ success: boolean; message: string; partner: Partner }>(BASE_PATH, data);
    return response.data;
};

export const updatePartner = async (id: number, data: Partial<CreatePartnerRequest>) => {
    const response = await apiClient.put<{ success: boolean; message: string }>(`${BASE_PATH}/${id}`, data);
    return response.data;
};

export const deletePartner = async (id: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_PATH}/${id}`);
    return response.data;
};

// ─── Status & Blocking ──────────────────────────────────────────────────────

export const toggleStatus = async (id: number) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(`${BASE_PATH}/${id}/toggle`);
    return response.data;
};

export const updateStatus = async (id: number, data: UpdateStatusRequest) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(`${BASE_PATH}/${id}/status`, data);
    return response.data;
};

export const blockPartner = async (id: number, data: BlockPartnerRequest) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(`${BASE_PATH}/${id}/block`, data);
    return response.data;
};

export const unblockPartner = async (id: number) => {
    const response = await apiClient.patch<{ success: boolean; message: string }>(`${BASE_PATH}/${id}/unblock`);
    return response.data;
};

// ─── Credit ─────────────────────────────────────────────────────────────────

export const updateCredit = async (id: number, data: UpdateCreditRequest) => {
    const response = await apiClient.patch<{ success: boolean; message: string; partner: Partner }>(
        `${BASE_PATH}/${id}/credit`, data
    );
    return response.data;
};

export const getCreditHistory = async (id: number): Promise<CreditHistoryResponse> => {
    const response = await apiClient.get<CreditHistoryResponse>(`${BASE_PATH}/${id}/credit/history`);
    return response.data;
};

export const recalcCredit = async (id: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`${BASE_PATH}/${id}/credit/recalc`);
    return response.data;
};

// ─── Payment Terms ──────────────────────────────────────────────────────────

export const getPaymentTerms = async (partnerId: number): Promise<PartnerPaymentTermsResponse> => {
    const response = await apiClient.get<PartnerPaymentTermsResponse>(`${BASE_PATH}/${partnerId}/payment-terms`);
    return response.data;
};

export const attachPaymentTerm = async (partnerId: number, data: { payment_term_id: number; is_default?: boolean }) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
        `${BASE_PATH}/${partnerId}/payment-terms`, data
    );
    return response.data;
};

export const detachPaymentTerm = async (partnerId: number, termId: number) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(
        `${BASE_PATH}/${partnerId}/payment-terms/${termId}`
    );
    return response.data;
};

export const setDefaultPaymentTerm = async (partnerId: number, termId: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(
        `${BASE_PATH}/${partnerId}/payment-terms/${termId}/default`
    );
    return response.data;
};

// ─── Bulk ───────────────────────────────────────────────────────────────────

export const bulkUpdateStatus = async (data: { partner_ids: number[]; status: string; reason?: string }) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`${BASE_PATH}/bulk/status`, data);
    return response.data;
};

export const bulkDelete = async (data: { partner_ids: number[] }) => {
    const response = await apiClient.delete<{ success: boolean; message: string }>(`${BASE_PATH}/bulk/delete`, { data });
    return response.data;
};
