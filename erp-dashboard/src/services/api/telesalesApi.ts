import apiClient from './client';
import type {
    CurrentSessionResponse,
    SessionResponse,
    PlanningResponse,
    VisitsHistoryResponse,
    CreateVisitRequest,
    VisitResponse,
    StartAdhocVisitRequest,
    CompleteVisitRequest,
    CatalogProductsResponse,
    CatalogPagesResponse,
    CatalogSyncResponse,
    CatalogTiersResponse,
    CatalogPriceListResponse,
    PartnerSyncResponse,
    MasterDataResponse,
    PortfolioResponse,
    CreateOrderRequest,
    CreateOrderResponse,
    SubmitOrderResponse,
    RequestDerogationRequest,
    RequestDerogationResponse,
    ScheduledOrdersResponse,
    OrdersListResponse,
    OrderDetailResponse,
    OrderSummaryResponse,
    DevisListResponse,
    DevisDetailResponse,
    CreateDevisRequest,
    UpdateDevisRequest,
    SendDevisResponse,
    ConvertDevisResponse,
    CreateReturnRequest,
    CreateReturnResponse,
    ReturnsListResponse,
    ReturnDetailResponse,
} from '@/types/telesalesAgent.types';
import type { ApiSuccessResponse } from '@/types/telesales.types';

// Lot 2 — Agent (poste télévendeur). Role televendeur|admin|root. Distinct from
// /api/backend/admin/telesales/... (Lot 1, admin-only) — see telesalesAdminApi.ts.
const TELESALES_BASE = '/api/backend/telesales';

const genIdempotencyKey = () =>
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

export const telesalesApi = {
    sessions: {
        current: async (): Promise<CurrentSessionResponse> => {
            const response = await apiClient.get<CurrentSessionResponse>(`${TELESALES_BASE}/sessions/current`);
            return response.data;
        },
        start: async (): Promise<SessionResponse> => {
            const response = await apiClient.post<SessionResponse>(`${TELESALES_BASE}/sessions/start`);
            return response.data;
        },
        pause: async (id: number): Promise<SessionResponse> => {
            const response = await apiClient.post<SessionResponse>(`${TELESALES_BASE}/sessions/${id}/pause`);
            return response.data;
        },
        resume: async (id: number): Promise<SessionResponse> => {
            const response = await apiClient.post<SessionResponse>(`${TELESALES_BASE}/sessions/${id}/resume`);
            return response.data;
        },
        end: async (id: number): Promise<SessionResponse> => {
            const response = await apiClient.post<SessionResponse>(`${TELESALES_BASE}/sessions/${id}/end`);
            return response.data;
        },
    },

    visits: {
        getPlanning: async (params?: { date?: string }): Promise<PlanningResponse> => {
            const response = await apiClient.get<PlanningResponse>(`${TELESALES_BASE}/planning`, { params });
            return response.data;
        },
        getHistory: async (params?: { date_from?: string; date_to?: string }): Promise<VisitsHistoryResponse> => {
            const response = await apiClient.get<VisitsHistoryResponse>(`${TELESALES_BASE}/visits`, { params });
            return response.data;
        },
        schedule: async (data: CreateVisitRequest): Promise<VisitResponse> => {
            const response = await apiClient.post<VisitResponse>(`${TELESALES_BASE}/visits`, data);
            return response.data;
        },
        startAdhoc: async (data: StartAdhocVisitRequest): Promise<VisitResponse> => {
            const response = await apiClient.post<VisitResponse>(`${TELESALES_BASE}/visits/start-adhoc`, data);
            return response.data;
        },
        start: async (id: number): Promise<VisitResponse> => {
            const response = await apiClient.post<VisitResponse>(`${TELESALES_BASE}/visits/${id}/start`);
            return response.data;
        },
        complete: async (id: number, data: CompleteVisitRequest): Promise<VisitResponse> => {
            const response = await apiClient.post<VisitResponse>(`${TELESALES_BASE}/visits/${id}/complete`, data);
            return response.data;
        },
    },

    catalog: {
        getProducts: async (params?: { search?: string; product_page_code?: string; partner_id?: number; per_page?: number; page?: number }): Promise<CatalogProductsResponse> => {
            const response = await apiClient.get<CatalogProductsResponse>(`${TELESALES_BASE}/catalog/products`, { params });
            return response.data;
        },
        getPages: async (): Promise<CatalogPagesResponse> => {
            const response = await apiClient.get<CatalogPagesResponse>(`${TELESALES_BASE}/catalog/pages`);
            return response.data;
        },
        // §4.4 — full catalogue dump (generic price only, never partner-scoped) to
        // populate the IndexedDB cache. `updated_since` for a lighter re-sync.
        sync: async (params?: { updated_since?: string }): Promise<CatalogSyncResponse> => {
            const response = await apiClient.get<CatalogSyncResponse>(`${TELESALES_BASE}/catalog/sync`, { params });
            return response.data;
        },
        // Quantity tiers for a price list — do NOT cache long-term, the "active line"
        // shifts over time (date window); re-fetch on every reconnect (docs §4.4).
        tiers: async (priceListId: number): Promise<CatalogTiersResponse> => {
            const response = await apiClient.get<CatalogTiersResponse>(`${TELESALES_BASE}/catalog/tiers`, { params: { price_list_id: priceListId } });
            return response.data;
        },
        // §4.4 (correctif urgent 2026-08) — le prix de base réel du partenaire pour
        // la grande majorité des lignes ; priorité 3/4 dans le résolveur local, entre
        // les tiers et le repli linéaire. Ne pas cacher long terme (même règle que tiers).
        priceList: async (priceListId: number): Promise<CatalogPriceListResponse> => {
            const response = await apiClient.get<CatalogPriceListResponse>(`${TELESALES_BASE}/catalog/price-list`, { params: { price_list_id: priceListId } });
            return response.data;
        },
    },

    masterData: {
        get: async (): Promise<MasterDataResponse> => {
            const response = await apiClient.get<MasterDataResponse>(`${TELESALES_BASE}/master-data`);
            return response.data;
        },
    },

    portfolio: {
        get: async (params?: { search?: string; per_page?: number; page?: number }): Promise<PortfolioResponse> => {
            const response = await apiClient.get<PortfolioResponse>(`${TELESALES_BASE}/portfolio`, { params });
            return response.data;
        },
    },

    partners: {
        search: async (q: string, limit = 10): Promise<{ success: boolean; partners: { id: number; code: string; name: string }[] }> => {
            const response = await apiClient.get(`${TELESALES_BASE}/partners/search`, { params: { q, limit } });
            return response.data;
        },
        getCreditStatus: async (id: number) => {
            const response = await apiClient.get(`${TELESALES_BASE}/partners/${id}/credit-status`);
            return response.data;
        },
        getPromotions: async (id: number) => {
            const response = await apiClient.get(`${TELESALES_BASE}/partners/${id}/promotions`);
            return response.data;
        },
        // §4.4 — full partner dump (credit + price_overrides) for the IndexedDB cache.
        sync: async (params?: { updated_since?: string }): Promise<PartnerSyncResponse> => {
            const response = await apiClient.get<PartnerSyncResponse>(`${TELESALES_BASE}/partners/sync`, { params });
            return response.data;
        },
    },

    orders: {
        create: async (data: CreateOrderRequest): Promise<CreateOrderResponse> => {
            const response = await apiClient.post<CreateOrderResponse>(`${TELESALES_BASE}/orders`, data);
            return response.data;
        },
        update: async (id: number, data: Partial<CreateOrderRequest>): Promise<CreateOrderResponse> => {
            const response = await apiClient.put<CreateOrderResponse>(`${TELESALES_BASE}/orders/${id}`, data);
            return response.data;
        },
        // 422 credit-exceeded is a normal business state (docs §5.3) — callers must
        // inspect err.response.data.credit_validation, not treat this as a hard failure.
        submit: async (id: number): Promise<SubmitOrderResponse> => {
            const response = await apiClient.post<SubmitOrderResponse>(`${TELESALES_BASE}/orders/${id}/submit`);
            return response.data;
        },
        requestDerogation: async (id: number, data: RequestDerogationRequest, idempotencyKey?: string): Promise<RequestDerogationResponse> => {
            const response = await apiClient.post<RequestDerogationResponse>(
                `${TELESALES_BASE}/orders/${id}/request-derogation`,
                data,
                { headers: { 'X-Idempotency-Key': idempotencyKey || genIdempotencyKey() } }
            );
            return response.data;
        },
        getScheduled: async (params?: { date?: string }): Promise<ScheduledOrdersResponse> => {
            const response = await apiClient.get<ScheduledOrdersResponse>(`${TELESALES_BASE}/orders/scheduled`, { params });
            return response.data;
        },
        getList: async (params?: { status?: string; date_from?: string; date_to?: string; search?: string; partner_id?: number }): Promise<OrdersListResponse> => {
            const response = await apiClient.get<OrdersListResponse>(`${TELESALES_BASE}/orders`, { params });
            return response.data;
        },
        getDetail: async (id: number): Promise<OrderDetailResponse> => {
            const response = await apiClient.get<OrderDetailResponse>(`${TELESALES_BASE}/orders/${id}`);
            return response.data;
        },
        // §5.2-bis (2026-08) — read-only relecture step before /submit: line-by-line
        // price/promo/TVA breakdown, exactly as computed and persisted at creation.
        getSummary: async (id: number): Promise<OrderSummaryResponse> => {
            const response = await apiClient.get<OrderSummaryResponse>(`${TELESALES_BASE}/orders/${id}/summary`);
            return response.data;
        },
    },

    devis: {
        getList: async (params?: { status?: string }): Promise<DevisListResponse> => {
            const response = await apiClient.get<DevisListResponse>(`${TELESALES_BASE}/devis`, { params });
            return response.data;
        },
        getDetail: async (id: number): Promise<DevisDetailResponse> => {
            const response = await apiClient.get<DevisDetailResponse>(`${TELESALES_BASE}/devis/${id}`);
            return response.data;
        },
        create: async (data: CreateDevisRequest): Promise<DevisDetailResponse> => {
            const response = await apiClient.post<DevisDetailResponse>(`${TELESALES_BASE}/devis`, data);
            return response.data;
        },
        update: async (id: number, data: UpdateDevisRequest): Promise<DevisDetailResponse> => {
            const response = await apiClient.put<DevisDetailResponse>(`${TELESALES_BASE}/devis/${id}`, data);
            return response.data;
        },
        send: async (id: number): Promise<SendDevisResponse> => {
            const response = await apiClient.post<SendDevisResponse>(`${TELESALES_BASE}/devis/${id}/send`);
            return response.data;
        },
        convert: async (id: number): Promise<ConvertDevisResponse> => {
            const response = await apiClient.post<ConvertDevisResponse>(`${TELESALES_BASE}/devis/${id}/convert`);
            return response.data;
        },
    },

    returns: {
        getList: async (params?: { status?: string }): Promise<ReturnsListResponse> => {
            const response = await apiClient.get<ReturnsListResponse>(`${TELESALES_BASE}/returns`, { params });
            return response.data;
        },
        getDetail: async (id: number): Promise<ReturnDetailResponse> => {
            const response = await apiClient.get<ReturnDetailResponse>(`${TELESALES_BASE}/returns/${id}`);
            return response.data;
        },
        create: async (data: CreateReturnRequest): Promise<CreateReturnResponse> => {
            const response = await apiClient.post<CreateReturnResponse>(`${TELESALES_BASE}/returns`, data);
            return response.data;
        },
    },
};

export type { ApiSuccessResponse };
