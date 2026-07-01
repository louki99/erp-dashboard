import apiClient from './client';
import type {
    Partner,
    PartnerListResponse,
    PartnerShowResponse,
    PartnerCreateFormResponse,
    PartnerPaymentTermsResponse,
    CreditHistoryResponse,
    CreditExposureResponse,
    CreditEvent,
    CreditEvaluateResponse,
    PartnerBalance,
    UpsertBalanceRequest,
    PartnerStatisticsResponse,
    PartnerFilters,
    CreatePartnerRequest,
    UpdateStatusRequest,
    BlockPartnerRequest,
    UpdateCreditRequest,
    PaginatedPartners,
    PartnerMasterData,
    CreatePartnerFullPayload,
    PaymentMethodRecord,
    PaymentOverride,
    CreatePaymentOverrideRequest,
} from '../../types/partner.types';

const BASE_PATH = '/api/backend/partners';
const MASTERDATA_PATH = '/api/backend/masterdata';
const CREDIT_V2_PATH = '/api/backend/credit-v2';
const ITINERARIES_PATH = '/api/backend/itineraries';
const PAYMENT_OVERRIDES_PATH = '/api/backend/payment-overrides';

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

// ─── Master Data for partner form ───────────────────────────────────────────

export const getPartnerFormMasterData = async (): Promise<PartnerMasterData> => {
    const response = await apiClient.get<PartnerMasterData>(`${MASTERDATA_PATH}/for-partner-form`);
    return response.data;
};

export const getCountries = async (): Promise<import('../../types/partner.types').CountryItem[]> => {
    const response = await apiClient.get<{ success: boolean; data: import('../../types/partner.types').CountryItem[] }>(`${MASTERDATA_PATH}/countries`);
    return response.data.data ?? [];
};

// ─── Create form metadata (legacy - used for edit mode only) ─────────────────

export const getCreateFormMeta = async (): Promise<PartnerCreateFormResponse> => {
    const response = await apiClient.get<PartnerCreateFormResponse>(`${BASE_PATH}/create`);
    return response.data;
};

export const getEditFormMeta = async (id: number): Promise<PartnerCreateFormResponse & { partner: Partner; customFields: Record<string, any> }> => {
    const response = await apiClient.get(`${BASE_PATH}/${id}/edit`);
    return response.data;
};

// ─── CRUD ───────────────────────────────────────────────────────────────────

export const createPartner = async (data: CreatePartnerFullPayload) => {
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

// ─── Credit Control V2 ──────────────────────────────────────────────────────

export const getCreditExposure = async (id: number): Promise<CreditExposureResponse> => {
    const response = await apiClient.get<CreditExposureResponse>(`${CREDIT_V2_PATH}/partners/${id}`);
    return response.data;
};

export const getCreditEvents = async (id: number): Promise<CreditEvent[]> => {
    const response = await apiClient.get<CreditEvent[] | { data: CreditEvent[] }>(`${CREDIT_V2_PATH}/partners/${id}/events`);
    return Array.isArray(response.data) ? response.data : ((response.data as any)?.data ?? []);
};

export const recalcCreditExposure = async (id: number) => {
    const response = await apiClient.post<{ success: boolean; message: string }>(`${CREDIT_V2_PATH}/partners/${id}/recalculate`);
    return response.data;
};

export const evaluateCreditOrder = async (id: number, orderAmount: number): Promise<CreditEvaluateResponse> => {
    const response = await apiClient.post<CreditEvaluateResponse>(`${CREDIT_V2_PATH}/partners/${id}/evaluate`, { order_amount: orderAmount });
    return response.data;
};

// ─── Itineraries ────────────────────────────────────────────────────────────

export const getItineraries = async (): Promise<{ id: number; code: string; name: string; branch_code: string; geo_area_code?: string }[]> => {
    const response = await apiClient.get(`${ITINERARIES_PATH}`);
    const d = response.data;
    return Array.isArray(d) ? d : (d?.data ?? []);
};

export const assignItinerary = async (itineraryId: number, data: { partner_code: string; rank?: number; visit_frequency_days?: number; start_time?: string; end_time?: string; is_stop_point?: boolean; notes?: string }) => {
    const response = await apiClient.post(`${ITINERARIES_PATH}/${itineraryId}/assign-partner`, data);
    return response.data;
};

export const removeFromItinerary = async (itineraryId: number, itineraryPartnerId: number) => {
    const response = await apiClient.delete(`${ITINERARIES_PATH}/${itineraryId}/partner/${itineraryPartnerId}`);
    return response.data;
};

// ─── Partner Balances (§11) ─────────────────────────────────────────────────

export const getPartnerBalances = async (partnerCode: string): Promise<PartnerBalance[]> => {
    const response = await apiClient.get<PartnerBalance[] | { data: PartnerBalance[] }>('/api/backend/partner-balances', { params: { partner_code: partnerCode } });
    return Array.isArray(response.data) ? response.data : ((response.data as any)?.data ?? []);
};

export const upsertPartnerBalance = async (data: UpsertBalanceRequest): Promise<PartnerBalance> => {
    const response = await apiClient.post<PartnerBalance>('/api/backend/partner-balances', data);
    return response.data;
};

export const deletePartnerBalance = async (id: number) => {
    const response = await apiClient.delete<{ success: boolean }>(`/api/backend/partner-balances/${id}`);
    return response.data;
};

// ─── Geo & misc ─────────────────────────────────────────────────────────────

export const getNearbyPartners = async (lat: number | string, lng: number | string, radiusKm = 2): Promise<Partner[]> => {
    const response = await apiClient.get<Partner[] | { data: Partner[] }>(`${BASE_PATH}/nearby`, {
        params: { lat, lng, radius: radiusKm },
    });
    return Array.isArray(response.data) ? response.data : ((response.data as any)?.data ?? []);
};

export const uploadPartnerImage = async (id: number, file: File): Promise<{ success: boolean; url?: string }> => {
    const form = new FormData();
    form.append('image', file);
    const response = await apiClient.post<{ success: boolean; url?: string }>(`${BASE_PATH}/${id}/image`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
    });
    return response.data;
};

// ─── Payment Methods (§7) ────────────────────────────────────────────────────

export const getPaymentMethods = async (): Promise<PaymentMethodRecord[]> => {
    const response = await apiClient.get<PaymentMethodRecord[] | { data: PaymentMethodRecord[] }>(
        `${MASTERDATA_PATH}/payment-methods`
    );
    return Array.isArray(response.data) ? response.data : ((response.data as any)?.data ?? []);
};

// ─── Payment Overrides (§9) ──────────────────────────────────────────────────

export const createPaymentOverride = async (data: CreatePaymentOverrideRequest): Promise<{ success: boolean; override: PaymentOverride }> => {
    const response = await apiClient.post(PAYMENT_OVERRIDES_PATH, data);
    return response.data;
};

export const getPendingOverrides = async (): Promise<PaymentOverride[]> => {
    const response = await apiClient.get<PaymentOverride[] | { data: PaymentOverride[] }>(
        `${PAYMENT_OVERRIDES_PATH}/pending`
    );
    return Array.isArray(response.data) ? response.data : ((response.data as any)?.data ?? []);
};

export const getPaymentOverride = async (id: number): Promise<PaymentOverride> => {
    const response = await apiClient.get(`${PAYMENT_OVERRIDES_PATH}/${id}`);
    return response.data?.override ?? response.data;
};

export const approveOverride = async (id: number, comment?: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`${PAYMENT_OVERRIDES_PATH}/${id}/approve`, { comment });
    return response.data;
};

export const rejectOverride = async (id: number, reason: string): Promise<{ success: boolean }> => {
    const response = await apiClient.post(`${PAYMENT_OVERRIDES_PATH}/${id}/reject`, { reason });
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
