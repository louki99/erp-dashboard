import apiClient from './client';
import type {
    DashboardData,
    BCListResponse,
    BCDetailResponse,
    PartnerDetailResponse,
    DerogationsListResponse,
    DerogationDetailResponse,
    CreditListResponse,
    BalanceCheckResponse,
    DerogationRequestResponse,
    ApiSuccessResponse,
    PaginatedResponse,
    Partner,
    EcheancesResponse,
    WorkflowExecuteResponse,

    PartnerValidationRequest,
    PartnerRejectionRequest,
    CreditLimitUpdateRequest,
    PartnerBlockRequest,
    BCApprovalRequest,
    BCRejectionRequest,
    BCHoldRequest,
    BCResumeRequest,
    BCBatchApprovalRequest,
    DerogationRequest,
    DerogationApprovalRequest,
    DerogationRejectionRequest,

    BCFilters,
    PartnerFilters,
    DerogationFilters,
    EcheanceFilters,
    CreditFilters,
} from '@/types/adv.types';

const ADV_BASE = '/api/backend/adv';
const WORKFLOW_BASE = '/api/backend/workflow';

const makeIdempotencyKey = (resource: string, id: number, decision: string): string =>
    `${resource}:${id}:${decision}:${Math.floor(Date.now() / 1000)}`;

export const advApi = {
    // ==================== Dashboard ====================

    dashboard: {
        get: async (): Promise<DashboardData> => {
            const response = await apiClient.get<DashboardData>(`${ADV_BASE}/dashboard`);
            return response.data;
        },
    },

    // ==================== Partners ====================

    partners: {
        getPending: async (filters?: PartnerFilters): Promise<PaginatedResponse<Partner>> => {
            const response = await apiClient.get<PaginatedResponse<Partner>>(`${ADV_BASE}/partners/pending`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (partnerId: number): Promise<PartnerDetailResponse> => {
            const response = await apiClient.get<PartnerDetailResponse>(`${ADV_BASE}/partners/${partnerId}`);
            return response.data;
        },

        validate: async (partnerId: number, data: PartnerValidationRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/partners/${partnerId}/validate`,
                data,
            );
            return response.data;
        },

        reject: async (partnerId: number, data: PartnerRejectionRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/partners/${partnerId}/reject`,
                data,
            );
            return response.data;
        },
    },

    // ==================== Credit Management ====================

    credit: {
        getList: async (filters?: CreditFilters): Promise<CreditListResponse> => {
            const response = await apiClient.get<CreditListResponse>(`${ADV_BASE}/credit`, {
                params: filters,
            });
            return response.data;
        },

        updateLimit: async (partnerId: number, data: CreditLimitUpdateRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/credit/${partnerId}/update-limit`,
                data,
            );
            return response.data;
        },

        block: async (partnerId: number, data: PartnerBlockRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/credit/${partnerId}/block`,
                data,
            );
            return response.data;
        },

        unblock: async (partnerId: number, comment?: string): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/credit/${partnerId}/unblock`,
                comment ? { comment } : {},
            );
            return response.data;
        },
    },

    // ==================== Écheances ====================

    echeances: {
        getList: async (filters?: EcheanceFilters): Promise<EcheancesResponse> => {
            const response = await apiClient.get<EcheancesResponse>(`${ADV_BASE}/echeances`, {
                params: filters,
            });
            return response.data;
        },
    },

    // ==================== BC (Bon de Commande) ====================

    bc: {
        getList: async (filters?: BCFilters): Promise<BCListResponse> => {
            const response = await apiClient.get<BCListResponse>(`${ADV_BASE}/bc`, {
                params: filters,
            });
            return response.data;
        },

        getPending: async (filters?: BCFilters): Promise<BCListResponse> => {
            const response = await apiClient.get<BCListResponse>(`${ADV_BASE}/bc/pending`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (bcId: number): Promise<BCDetailResponse> => {
            const response = await apiClient.get<BCDetailResponse>(`${ADV_BASE}/bc/${bcId}`);
            return response.data;
        },

        balanceCheck: async (bcId: number): Promise<BalanceCheckResponse> => {
            const response = await apiClient.get<BalanceCheckResponse>(`${ADV_BASE}/bc/${bcId}/balance-check`);
            return response.data;
        },

        // BC mutations go through the workflow engine
        approve: async (bcId: number, data?: BCApprovalRequest): Promise<WorkflowExecuteResponse> => {
            const response = await apiClient.post<WorkflowExecuteResponse>(
                `${WORKFLOW_BASE}/bon-commande/${bcId}/execute`,
                { decision: 'finalize_sale', ...data },
                {
                    headers: {
                        'Idempotency-Key': makeIdempotencyKey('bon-commande', bcId, 'finalize_sale'),
                    },
                },
            );
            return response.data;
        },

        reject: async (bcId: number, data: BCRejectionRequest): Promise<WorkflowExecuteResponse> => {
            const response = await apiClient.post<WorkflowExecuteResponse>(
                `${WORKFLOW_BASE}/bon-commande/${bcId}/execute`,
                { decision: 'reject_sale', ...data },
                {
                    headers: {
                        'Idempotency-Key': makeIdempotencyKey('bon-commande', bcId, 'reject_sale'),
                    },
                },
            );
            return response.data;
        },

        hold: async (bcId: number, data: BCHoldRequest): Promise<WorkflowExecuteResponse> => {
            const response = await apiClient.post<WorkflowExecuteResponse>(
                `${WORKFLOW_BASE}/bon-commande/${bcId}/execute`,
                { decision: 'hold_order', ...data },
                {
                    headers: {
                        'Idempotency-Key': makeIdempotencyKey('bon-commande', bcId, 'hold_order'),
                    },
                },
            );
            return response.data;
        },

        resume: async (bcId: number, data?: BCResumeRequest): Promise<WorkflowExecuteResponse> => {
            const response = await apiClient.post<WorkflowExecuteResponse>(
                `${WORKFLOW_BASE}/bon-commande/${bcId}/execute`,
                { decision: 'resume_order', ...data },
                {
                    headers: {
                        'Idempotency-Key': makeIdempotencyKey('bon-commande', bcId, 'resume_order'),
                    },
                },
            );
            return response.data;
        },

        batchApprove: async (data: BCBatchApprovalRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/batch-approve`, data);
            return response.data;
        },
    },

    // ==================== Credit Derogations ====================

    derogations: {
        getList: async (filters?: DerogationFilters): Promise<DerogationsListResponse> => {
            const response = await apiClient.get<DerogationsListResponse>(`${ADV_BASE}/derogations`, {
                params: filters,
            });
            return response.data;
        },

        getById: async (derogationId: number): Promise<DerogationDetailResponse> => {
            const response = await apiClient.get<DerogationDetailResponse>(`${ADV_BASE}/derogations/${derogationId}`);
            return response.data;
        },

        request: async (orderId: number, data: DerogationRequest): Promise<DerogationRequestResponse> => {
            const response = await apiClient.post<DerogationRequestResponse>(
                `${ADV_BASE}/derogations/${orderId}/request`,
                data,
            );
            return response.data;
        },

        approve: async (derogationId: number, data?: DerogationApprovalRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/derogations/${derogationId}/approve`,
                data || {},
            );
            return response.data;
        },

        reject: async (derogationId: number, data: DerogationRejectionRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${ADV_BASE}/derogations/${derogationId}/reject`,
                data,
            );
            return response.data;
        },
    },
};

export default advApi;
