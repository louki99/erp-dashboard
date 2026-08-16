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
    PartnerItineraryResponse,
    PartnerAddress,
    PartnerAddressPayload,
    PartnerAddressesResponse,
    PartnerContact,
    PartnerContactPayload,
    PartnerPayerResponse,
    Partner360Response,
    PartnerCreditExposureV2,
} from '../../types/partner.types';

const BASE_PATH = '/api/backend/partners';
const MASTERDATA_PATH = '/api/backend/masterdata';
const CREDIT_V2_PATH = '/api/backend/credit-v2';
const ITINERARIES_PATH = '/api/backend/itineraries';
const PAYMENT_OVERRIDES_PATH = '/api/backend/payment-overrides';

// ─── List & Search ──────────────────────────────────────────────────────────

export const getPartners = async (filters: PartnerFilters): Promise<{ partners: PaginatedPartners; priceLists: { id: number; code: string; name: string }[] }> => {
    const { custom_fields, search, q, ...rest } = filters;
    const params: Record<string, any> = { ...rest };
    // `search` is silently ignored server-side (verified live) — only `q`
    // actually filters. See the comment on PartnerFilters.search.
    const effectiveQuery = q ?? search;
    if (effectiveQuery) params.q = effectiveQuery;
    if (custom_fields) {
        Object.entries(custom_fields).forEach(([k, v]) => {
            params[`custom_fields[${k}]`] = v;
        });
    }
    const response = await apiClient.get<PartnerListResponse>(BASE_PATH, { params });
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

const COMMERCIAL_ROLES = new Set([
    'televendeur', 'commercial_director', 'commercial_technician',
    'vanSelling', 'preSelling', 'cdz', 'visitor',
]);

export interface CommercialEmployee {
    id: number;
    name: string;
    last_name: string | null;
    email: string;
    is_active: boolean;
    roles: { name: string }[];
}

export const getCommercialEmployees = async (): Promise<CommercialEmployee[]> => {
    const firstRes = await apiClient.get<{ users: { data: CommercialEmployee[]; last_page: number } }>(
        '/api/backend/employees', { params: { per_page: 100 } }
    );
    const { data, last_page } = firstRes.data.users;
    const all = [...data];
    if (last_page > 1) {
        const pages = Array.from({ length: last_page - 1 }, (_, i) => i + 2);
        const rest = await Promise.all(
            pages.map(p => apiClient.get<{ users: { data: CommercialEmployee[] } }>(
                '/api/backend/employees', { params: { per_page: 100, page: p } }
            ))
        );
        rest.forEach(r => all.push(...r.data.users.data));
    }
    return all.filter(u => u.is_active && u.roles.some(r => COMMERCIAL_ROLES.has(r.name)));
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

export const setStampDutyWaiver = async (id: number, waive: boolean): Promise<{ success: boolean; message: string; partner_id: number; waive_stamp_duty: boolean }> => {
    const response = await apiClient.patch(`${BASE_PATH}/${id}/stamp-duty-waiver`, { waive_stamp_duty: waive });
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
    // Requires X-Idempotency-Key (verified live 2026-08-15, 422 without it) — was
    // missing here, meaning this call previously always failed; the sole caller
    // (PartnerManagementPage's "Recalculer" button) silently swallows the error.
    const response = await apiClient.post<{ success: boolean; message: string }>(
        `${CREDIT_V2_PATH}/partners/${id}/recalculate`,
        {},
        { headers: { 'X-Idempotency-Key': crypto.randomUUID() } },
    );
    return response.data;
};

// Correctly-shaped counterpart to `getCreditExposure` above (see the comment on
// `PartnerCreditExposureV2` in partner.types.ts for why a separate function exists).
// Real response is `{ data: { ...PartnerCreditExposureV2 } }`.
export const getCreditExposureBreakdown = async (id: number): Promise<PartnerCreditExposureV2> => {
    const response = await apiClient.get<{ data: PartnerCreditExposureV2 }>(`${CREDIT_V2_PATH}/partners/${id}`);
    return response.data.data;
};

export const evaluateCreditOrder = async (id: number, orderAmount: number): Promise<CreditEvaluateResponse> => {
    const response = await apiClient.post<CreditEvaluateResponse>(`${CREDIT_V2_PATH}/partners/${id}/evaluate`, { order_amount: orderAmount });
    return response.data;
};

// ─── Itineraries ────────────────────────────────────────────────────────────

export const getPartnerItinerary = async (id: number): Promise<PartnerItineraryResponse> => {
    const response = await apiClient.get<PartnerItineraryResponse>(`${BASE_PATH}/${id}/itinerary`);
    return response.data;
};

export const getItineraries = async (): Promise<{ id: number; code: string; name: string; branch_code: string; geo_area_code?: string }[]> => {
    const response = await apiClient.get(`${ITINERARIES_PATH}`);
    const d = response.data;
    // API returns { itineraries: { current_page, data: [...] } }
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.itineraries?.data)) return d.itineraries.data;
    if (Array.isArray(d?.itineraries)) return d.itineraries;
    if (Array.isArray(d?.data)) return d.data;
    return [];
};

export const assignItinerary = async (itineraryId: number, data: { partner_code: string; rank?: number; visit_frequency_days?: number; start_time?: string; end_time?: string; is_stop_point?: boolean; notes?: string }) => {
    const response = await apiClient.post(`${ITINERARIES_PATH}/${itineraryId}/assign-partner`, data);
    return response.data;
};

export const removeFromItinerary = async (itineraryId: number, itineraryPartnerId: number) => {
    const response = await apiClient.delete(`${ITINERARIES_PATH}/${itineraryId}/partner/${itineraryPartnerId}`);
    return response.data;
};

// ─── Contacts ───────────────────────────────────────────────────────────────

export const getPartnerContacts = async (partnerId: number): Promise<PartnerContact[]> => {
    const response = await apiClient.get(`${BASE_PATH}/${partnerId}/contacts`);
    const d = response.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.contacts)) return d.contacts;
    if (Array.isArray(d?.data)) return d.data;
    return [];
};

export const createPartnerContact = async (partnerId: number, data: PartnerContactPayload): Promise<PartnerContact> => {
    const response = await apiClient.post<{ contact: PartnerContact } | PartnerContact>(`${BASE_PATH}/${partnerId}/contacts`, data);
    return (response.data as any)?.contact ?? response.data as PartnerContact;
};

export const updatePartnerContact = async (partnerId: number, contactId: number, data: Partial<PartnerContactPayload>): Promise<PartnerContact> => {
    const response = await apiClient.put<{ contact: PartnerContact } | PartnerContact>(`${BASE_PATH}/${partnerId}/contacts/${contactId}`, data);
    return (response.data as any)?.contact ?? response.data as PartnerContact;
};

export const deletePartnerContact = async (partnerId: number, contactId: number): Promise<void> => {
    await apiClient.delete(`${BASE_PATH}/${partnerId}/contacts/${contactId}`);
};

export const setDefaultPartnerContact = async (partnerId: number, contactId: number): Promise<void> => {
    await apiClient.patch(`${BASE_PATH}/${partnerId}/contacts/${contactId}/default`);
};

// ─── Payer ───────────────────────────────────────────────────────────────────

export const getPartnerPayer = async (partnerId: number): Promise<PartnerPayerResponse> => {
    const response = await apiClient.get<PartnerPayerResponse>(`${BASE_PATH}/${partnerId}/payer`);
    return response.data;
};

export const updatePartnerPayer = async (partnerId: number, payerPartnerId: number | null, changeReason: string): Promise<void> => {
    await apiClient.patch(`${BASE_PATH}/${partnerId}/payer`, { payer_partner_id: payerPartnerId, change_reason: changeReason });
};

export const updatePartnerInvoicingMode = async (
    partnerId: number,
    invoicingMode: '1_FAC_PER_BL' | '1_FAC_PER_ORDER' | 'PERIODIC_FIN_DE_MOIS' | null,
    changeReason: string,
): Promise<{ success: boolean; message: string; partner_id: number; invoicing_mode: string | null }> => {
    const response = await apiClient.patch(`${BASE_PATH}/${partnerId}/invoicing-mode`, {
        invoicing_mode: invoicingMode,
        change_reason: changeReason,
    });
    return response.data;
};

export const getPartner360 = async (partnerId: number): Promise<Partner360Response> => {
    const response = await apiClient.get<Partner360Response>(`${BASE_PATH}/${partnerId}/360`);
    return response.data;
};

export const assignPartnerToGroup = async (
    partner: { id: number; name: string; price_list_id?: number | null },
    clientGroupId: number | null,
): Promise<void> => {
    await apiClient.patch(`${BASE_PATH}/${partner.id}`, {
        name: partner.name,
        price_list_id: partner.price_list_id ?? null,
        client_group_id: clientGroupId,
    });
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

export const uploadPartnerImage = async (id: number, file: File): Promise<{ success: boolean; image_url: string | null; thumb_url: string | null }> => {
    const form = new FormData();
    form.append('image', file);
    const response = await apiClient.post(`${BASE_PATH}/${id}/image`, form, {
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

// ─── Adresses partenaire (§21 — table `addresses` polymorphe) ────────────────

export const getPartnerAddresses = async (partnerId: number): Promise<PartnerAddressesResponse> => {
    const response = await apiClient.get<PartnerAddressesResponse>(
        `${BASE_PATH}/${partnerId}/addresses`
    );
    return response.data;
};

export const createPartnerAddress = async (
    partnerId: number,
    data: PartnerAddressPayload
): Promise<{ success: boolean; message: string; address: PartnerAddress; default_address_id: number | null }> => {
    const response = await apiClient.post(`${BASE_PATH}/${partnerId}/addresses`, data);
    return response.data;
};

export const updatePartnerAddress = async (
    partnerId: number,
    addressId: number,
    data: Partial<PartnerAddressPayload>
): Promise<{ success: boolean; message: string; address: PartnerAddress }> => {
    const response = await apiClient.put(
        `${BASE_PATH}/${partnerId}/addresses/${addressId}`,
        data
    );
    return response.data;
};

export const deletePartnerAddress = async (
    partnerId: number,
    addressId: number
): Promise<{ success: boolean; message: string; default_address_id: number | null }> => {
    const response = await apiClient.delete(
        `${BASE_PATH}/${partnerId}/addresses/${addressId}`
    );
    return response.data;
};

export const setDefaultPartnerAddress = async (
    partnerId: number,
    addressId: number
): Promise<{ success: boolean; message: string; default_address_id: number }> => {
    const response = await apiClient.patch(
        `${BASE_PATH}/${partnerId}/addresses/${addressId}/default`
    );
    return response.data;
};
