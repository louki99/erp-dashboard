import apiClient from './client';
import type {
    PreparationsResponse,
    PreparationsAllResponse,
    PreparationsScope,
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
    StockMovementsResponse,
    LoadingRequestsResponse,
    FulfillLoadingResponse,
    ConventionalDechargeReconciliationListResponse,
    DechargeReconciliationLine,
    DechargeReconciliationConfirmResponse,
    DechargeReconciliationApproveResponse,
    MagasinierDecharge,
    MagasinierDechargesResponse,
    ApproveDechargeWorkflowResponse,
    ReturnsResponse,
    PartnerReturn,
    ReceiveReturnResponse,
    CloseReturnResponse,
    ApproveReturnResponse,
    AssignReturnResponse,
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

        getAll: async (params?: {
            scope?: PreparationsScope;
            status?: string;
            search?: string;
            date_from?: string;
            date_to?: string;
            per_page?: number;
            page?: number;
        }): Promise<PreparationsAllResponse> => {
            const response = await apiClient.get<PreparationsAllResponse>(`${MAGASINIER_BASE}/preparations`, { params });
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

        getMovements: async (params?: { type?: string; product_id?: number; date_from?: string; date_to?: string; page?: number }): Promise<StockMovementsResponse> => {
            const response = await apiClient.get<StockMovementsResponse>(`${MAGASINIER_BASE}/stock/movements`, { params });
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

    // §9 — Conventional Loading (SFA field salesperson → van stock loading)
    conventionalLoading: {
        getList: async (params?: { status?: string; page?: number }): Promise<LoadingRequestsResponse> => {
            const response = await apiClient.get<LoadingRequestsResponse>('/api/backend/conventional-loading-requests', { params });
            return response.data;
        },
        fulfill: async (id: number, data: { fulfilled_quantities: Record<string, number>; notes?: string }): Promise<FulfillLoadingResponse> => {
            const response = await apiClient.post<FulfillLoadingResponse>(
                `/api/backend/conventional-loading-requests/${id}/fulfill`,
                data,
                { headers: { 'Idempotency-Key': mkKey(`lr:${id}:fulfill`) } }
            );
            return response.data;
        },
        rejectAtVendor: async (id: number, reason: string): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `/api/backend/conventional-loading-requests/${id}/reject-at-vendor`,
                { reason },
                { headers: { 'Idempotency-Key': mkKey(`lr:${id}:reject-vendor`) } }
            );
            return response.data;
        },
    },

    // §10 — Conventional Décharge Reconciliation (EOD van→dépôt, ventes SFA)
    dechargeReconciliation: {
        // Backend endpoint pending creation — will return data once GET /backend/conventional-decharge-reconciliation is deployed.
        getList: async (params?: { status?: string; page?: number }): Promise<ConventionalDechargeReconciliationListResponse> => {
            const response = await apiClient.get<ConventionalDechargeReconciliationListResponse>(
                '/api/backend/conventional-decharge-reconciliation',
                { params }
            );
            return response.data;
        },
        confirm: async (
            id: number,
            data: { qr_token: string; lines: DechargeReconciliationLine[]; photo?: File | null }
        ): Promise<DechargeReconciliationConfirmResponse> => {
            const formData = new FormData();
            formData.append('qr_token', data.qr_token);
            formData.append('lines', JSON.stringify(data.lines));
            if (data.photo) formData.append('photo', data.photo);
            const response = await apiClient.post<DechargeReconciliationConfirmResponse>(
                `/api/backend/conventional-decharge-reconciliation/${id}/confirm`,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data', 'Idempotency-Key': mkKey(`drr:${id}:confirm`) } }
            );
            return response.data;
        },
        approve: async (id: number, notes?: string): Promise<DechargeReconciliationApproveResponse> => {
            const response = await apiClient.post<DechargeReconciliationApproveResponse>(
                `${WORKFLOW_BASE}/decharge-reconciliation/${id}/execute`,
                { decision: 'approve_decharge_reconciliation', metadata: { notes: notes ?? '' } },
                { headers: { 'Idempotency-Key': mkKey(`drr:${id}:approve`) } }
            );
            return response.data;
        },
    },

    // §11 — Décharge Van→Dépôt (retour marchandises non livrées)
    // Listing reuses GET /dispatcher/decharges (accessible to magasinier role per docs).
    // Approval goes through the workflow engine, not the dispatcher's approve-return shortcut.
    decharges: {
        getList: async (params?: { status?: string; page?: number }): Promise<MagasinierDechargesResponse> => {
            const response = await apiClient.get<MagasinierDechargesResponse>('/api/backend/dispatcher/decharges', { params });
            return response.data;
        },
        getDetail: async (id: number): Promise<MagasinierDecharge> => {
            const response = await apiClient.get<MagasinierDecharge>(`/api/backend/dispatcher/decharges/${id}`);
            return response.data;
        },
        approve: async (id: number, notes?: string): Promise<ApproveDechargeWorkflowResponse> => {
            const response = await apiClient.post<ApproveDechargeWorkflowResponse>(
                `${WORKFLOW_BASE}/decharge/${id}/execute`,
                { decision: 'approve_decharge', metadata: { notes: notes ?? '' } },
                { headers: { 'Idempotency-Key': mkKey(`decharge:${id}:approve`) } }
            );
            return response.data;
        },
    },

    // §12 — Returns Processing (PartnerReturn — /api/v2/returns/*, different base path)
    // NOTE: All /v2/returns/* endpoints use a different base than /api/backend/...
    // NOTE: POST /v2/returns/immediate now returns status ROLLED_BACK immediately
    //       (atomic stock rollback). Do NOT expect IMMEDIATE as initial status.
    // NOTE: No financial credit (avoir) is generated automatically on approve/close.
    returns: {
        getPending: async (params?: { status?: string; page?: number }): Promise<ReturnsResponse> => {
            const response = await apiClient.get<ReturnsResponse>(`${MAGASINIER_BASE}/returns/pending`, { params });
            return response.data;
        },
        getDetail: async (id: number): Promise<PartnerReturn> => {
            const response = await apiClient.get<PartnerReturn>(`${MAGASINIER_BASE}/returns/${id}`);
            return response.data;
        },
        // Magasinier action — confirm physical receipt at warehouse
        receive: async (id: number): Promise<ReceiveReturnResponse> => {
            const response = await apiClient.post<ReceiveReturnResponse>(
                `/api/v2/returns/${id}/receive`,
                {},
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:receive`) } }
            );
            return response.data;
        },
        // Magasinier action — close after quality check (does NOT generate financial credit)
        close: async (id: number): Promise<CloseReturnResponse> => {
            const response = await apiClient.post<CloseReturnResponse>(
                `/api/v2/returns/${id}/close`,
                {},
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:close`) } }
            );
            return response.data;
        },
        // Direction action — approve pending return.
        // Check response.data.requires_manual_assignment: if true, auto-assign failed
        // (no planned tour found for partner) → call assign() with a driver_id.
        approve: async (id: number): Promise<ApproveReturnResponse> => {
            const response = await apiClient.post<ApproveReturnResponse>(
                `/api/v2/returns/${id}/approve`,
                {},
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:approve`) } }
            );
            return response.data;
        },
        // Dispatcher/coordinator action — manual driver assignment when approve()
        // returns requires_manual_assignment=true.
        assign: async (id: number, driverId: number): Promise<AssignReturnResponse> => {
            const response = await apiClient.post<AssignReturnResponse>(
                `/api/v2/returns/${id}/assign`,
                { driver_id: driverId },
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:assign:${driverId}`) } }
            );
            return response.data;
        },
        // Direction action — reject a pending return.
        reject: async (id: number, reason: string): Promise<{ data: { id: number; status: 'REJECTED'; rejection_reason: string } }> => {
            const response = await apiClient.post(
                `/api/v2/returns/${id}/reject`,
                { reason },
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:reject`) } }
            );
            return response.data;
        },
        // Driver action — confirm physical collection at partner site (§5.1 step 4).
        // ⚠️ After collect: dispatcher is HARD LOCKED from assigning new routes to this driver
        // until magasinier calls receive(). Unblocking the driver is one of the most
        // time-sensitive tasks for the magasinier.
        collect: async (id: number): Promise<{ data: { id: number; status: 'COLLECTED'; collection_timestamp: string } }> => {
            const response = await apiClient.post(
                `/api/v2/returns/${id}/collect`,
                {},
                { headers: { 'Idempotency-Key': mkKey(`pr:${id}:collect`) } }
            );
            return response.data;
        },
        // Full audit trail — every state transition, stock movement, and discharge decision.
        getAudit: async (id: number, periodId?: number): Promise<unknown> => {
            const response = await apiClient.get(
                `/api/v2/returns/${id}/audit`,
                { params: periodId ? { period_id: periodId } : undefined }
            );
            return response.data;
        },
    },
};
