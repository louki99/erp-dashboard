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
    ShortageItemPayload,
    ReportShortageResponse,
    AdditionalItemPayload,
    ContinuePreparationResponse,
    CompletePreparationResponse,
    StartPreparationResponse,
    RejectPreparationResponse,
    UpdatePreparationResponse,
} from '@/types/magasinier.types';

const MAGASINIER_BASE = '/api/backend/magasinier';
const WORKFLOW_BASE = '/api/backend/workflow';

const mkKey = (prefix: string) => `${prefix}:${Date.now()}`;

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

        // start_preparation (docs §6.3) — GET that triggers a decision (unusual, confirmed
        // intentional shortcut). Response is the uniform {success, message, decision, output}
        // envelope, not the BP itself. Backend rejects "critical" decisions with
        // idempotency_key_required (422) if this header is missing — confirmed live 2026-06-22
        // on complete_preparation; applying the same header to every direct REST shortcut here,
        // not just the two that already went through the workflow engine route.
        prepare: async (id: number): Promise<StartPreparationResponse> => {
            const response = await apiClient.get<StartPreparationResponse>(`${MAGASINIER_BASE}/preparations/${id}/prepare`, {
                headers: { 'Idempotency-Key': mkKey(`bp:${id}:start`) },
            });
            return response.data;
        },

        // update_preparation (docs §6.4) — incremental save while picking, callable multiple
        // times before complete_preparation. Not currently wired into the UI.
        updateItems: async (id: number, items: Array<{ product_id: number; prepared_quantity: number }>): Promise<UpdatePreparationResponse> => {
            const response = await apiClient.put<UpdatePreparationResponse>(
                `${MAGASINIER_BASE}/preparations/${id}/items`,
                { items },
                { headers: { 'Idempotency-Key': mkKey(`bp:${id}:items`) } }
            );
            return response.data;
        },

        // complete_preparation (docs §6.5) — output now includes mission_id, warehouse_transfer
        // (auto-created CENTRAL→VAN transfer, null on shortage) and stock_deducted (always 0,
        // by design — no physical deduction happens at preparation time). Backend confirmed live:
        // 422 idempotency_key_required without this header — complete_preparation is flagged as a
        // "critical decision".
        save: async (id: number, data: SavePreparationRequest): Promise<CompletePreparationResponse> => {
            const response = await apiClient.put<CompletePreparationResponse>(
                `${MAGASINIER_BASE}/preparations/${id}/save`,
                data,
                { headers: { 'Idempotency-Key': mkKey(`bp:${id}:complete`) } }
            );
            return response.data;
        },

        // reject_preparation (docs §6.6) — side effects changed: mission + its BLs revert to
        // draft (no more BCH to revert), orders stay tied to the mission (not released back to
        // "Commandes en attente"). Payload unchanged — rejection_reason stays top-level.
        reject: async (id: number, data: RejectPreparationRequest): Promise<RejectPreparationResponse> => {
            const response = await apiClient.post<RejectPreparationResponse>(
                `${MAGASINIER_BASE}/preparations/${id}/reject`,
                data,
                { headers: { 'Idempotency-Key': mkKey(`bp:${id}:reject`) } }
            );
            return response.data;
        },

        // Both go through the workflow engine, not the REST /magasinier/preparations/* routes
        // above — fields nest under `metadata` (confirmed convention across every module this
        // session, docs §16 curl examples match), and both are idempotency-key protected per docs.
        reportShortage: async (id: number, shortageItems: ShortageItemPayload[]): Promise<ReportShortageResponse> => {
            const response = await apiClient.post<ReportShortageResponse>(
                `${WORKFLOW_BASE}/bon-preparation/${id}/execute`,
                { decision: 'report_shortage', metadata: { shortage_items: shortageItems } },
                { headers: { 'Idempotency-Key': mkKey(`bp:${id}:report-shortage`) } }
            );
            return response.data;
        },

        continuePreparation: async (id: number, additionalItems: AdditionalItemPayload[]): Promise<ContinuePreparationResponse> => {
            const response = await apiClient.post<ContinuePreparationResponse>(
                `${WORKFLOW_BASE}/bon-preparation/${id}/execute`,
                { decision: 'continue_preparation', metadata: { additional_items: additionalItems } },
                { headers: { 'Idempotency-Key': mkKey(`bp:${id}:continue`) } }
            );
            return response.data;
        },
    },

    // REMOVED 2026-06-22 (backend breaking change) — `GET /magasinier/orders/approved` and
    // `POST /magasinier/preparations/from-orders` no longer exist. The "create a BP directly from
    // a BC" flow is gone entirely; every BP now originates from a dispatcher-created mission
    // (create_delivery_mission → confirm_delivery_mission generates the BP automatically).

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

        // adjust_stock (docs §8.4) — also a critical decision per backend, requires Idempotency-Key.
        adjust: async (data: StockAdjustmentRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${MAGASINIER_BASE}/stock/adjust`,
                data,
                { headers: { 'Idempotency-Key': mkKey(`stock:adjust:${data.product_id}`) } }
            );
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
