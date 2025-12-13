import apiClient from './client';
import type {
    // Responses
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
    Echeance,

    // Requests
    PartnerValidationRequest,
    PartnerRejectionRequest,
    CreditLimitUpdateRequest,
    PartnerBlockRequest,
    BCApprovalRequest,
    BCRejectionRequest,
    BCHoldRequest,
    BCRequestInfoRequest,
    BCBatchApprovalRequest,
    DerogationRequest,
    DerogationApprovalRequest,
    DerogationRejectionRequest,

    // Filters
    BCFilters,
    PartnerFilters,
    DerogationFilters,
    EcheanceFilters,
    CreditFilters,
} from '@/types/adv.types';

const ADV_BASE = '/api/backend/adv';

/**
 * ADV Module API Service
 * Centralized service for all ADV-related API calls
 */
export const advApi = {
    // ==================== Dashboard ====================

    dashboard: {
        /**
         * Get ADV dashboard statistics and alerts
         */
        get: async (): Promise<DashboardData> => {
            const response = await apiClient.get<DashboardData>(`${ADV_BASE}/dashboard`);
            return response.data;
        },
    },

    // ==================== Partners ====================

    partners: {
        /**
         * Get list of pending partners awaiting validation
         */
        getPending: async (filters?: PartnerFilters): Promise<PaginatedResponse<Partner>> => {
            const response = await apiClient.get<PaginatedResponse<Partner>>(`${ADV_BASE}/partners/pending`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get detailed information about a specific partner
         */
        getById: async (partnerId: number): Promise<PartnerDetailResponse> => {
            const response = await apiClient.get<PartnerDetailResponse>(`${ADV_BASE}/partners/${partnerId}`);
            return response.data;
        },

        /**
         * Validate and approve a pending partner
         */
        validate: async (partnerId: number, data: PartnerValidationRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/partners/${partnerId}/validate`, data);
            return response.data;
        },

        /**
         * Reject a pending partner
         */
        reject: async (partnerId: number, data: PartnerRejectionRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/partners/${partnerId}/reject`, data);
            return response.data;
        },
    },

    // ==================== Credit Management ====================

    credit: {
        /**
         * Get list of active partners with credit information
         */
        getList: async (filters?: CreditFilters): Promise<CreditListResponse> => {
            const response = await apiClient.get<CreditListResponse>(`${ADV_BASE}/credit`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Update partner's credit limit
         */
        updateLimit: async (partnerId: number, data: CreditLimitUpdateRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/credit/${partnerId}/update-limit`, data);
            return response.data;
        },

        /**
         * Block a partner from placing orders
         */
        block: async (partnerId: number, data: PartnerBlockRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/credit/${partnerId}/block`, data);
            return response.data;
        },

        /**
         * Unblock a previously blocked partner
         */
        unblock: async (partnerId: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/credit/${partnerId}/unblock`);
            return response.data;
        },
    },

    // ==================== Echeances (Due Dates) ====================

    echeances: {
        /**
         * Get overdue invoices and payment tracking
         */
        getList: async (filters?: EcheanceFilters): Promise<PaginatedResponse<Echeance>> => {
            const response = await apiClient.get<PaginatedResponse<Echeance>>(`${ADV_BASE}/echeances`, {
                params: filters,
            });
            return response.data;
        },
    },

    // ==================== BC (Bon de Commande) Validation ====================

    bc: {
        /**
         * Get BC list with statistics (NEW master-detail view)
         */
        getList: async (filters?: BCFilters): Promise<BCListResponse> => {
            const response = await apiClient.get<BCListResponse>(`${ADV_BASE}/bc`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get pending BCs (Classic list view)
         */
        getPending: async (filters?: BCFilters): Promise<BCListResponse> => {
            const response = await apiClient.get<BCListResponse>(`${ADV_BASE}/bc/pending`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get detailed BC information
         */
        getById: async (bcId: number): Promise<BCDetailResponse> => {
            const response = await apiClient.get<BCDetailResponse>(`${ADV_BASE}/bc/${bcId}`);
            return response.data;
        },

        /**
         * Approve a BC
         */
        approve: async (bcId: number, data?: BCApprovalRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/${bcId}/approve`, data || {});
            return response.data;
        },

        /**
         * Reject a BC
         */
        reject: async (bcId: number, data: BCRejectionRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/${bcId}/reject`, data);
            return response.data;
        },

        /**
         * Put BC on hold
         */
        hold: async (bcId: number, data: BCHoldRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/${bcId}/hold`, data);
            return response.data;
        },

        /**
         * Request additional information from partner
         */
        requestInfo: async (bcId: number, data: BCRequestInfoRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/${bcId}/request-info`, data);
            return response.data;
        },

        /**
         * Perform stock balance check for BC
         */
        balanceCheck: async (bcId: number): Promise<BalanceCheckResponse> => {
            const response = await apiClient.get<BalanceCheckResponse>(`${ADV_BASE}/bc/${bcId}/balance-check`);
            return response.data;
        },

        /**
         * Approve multiple BCs at once
         */
        batchApprove: async (data: BCBatchApprovalRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/bc/batch-approve`, data);
            return response.data;
        },
    },

    // ==================== Credit Derogation Management ====================

    derogations: {
        /**
         * Get list of credit derogations
         */
        getList: async (filters?: DerogationFilters): Promise<DerogationsListResponse> => {
            const response = await apiClient.get<DerogationsListResponse>(`${ADV_BASE}/derogations`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get detailed derogation information
         */
        getById: async (derogationId: number): Promise<DerogationDetailResponse> => {
            const response = await apiClient.get<DerogationDetailResponse>(`${ADV_BASE}/derogations/${derogationId}`);
            return response.data;
        },

        /**
         * Request credit derogation for a BC
         */
        request: async (bcId: number, data: DerogationRequest): Promise<DerogationRequestResponse> => {
            const response = await apiClient.post<DerogationRequestResponse>(`${ADV_BASE}/derogations/${bcId}/request`, data);
            return response.data;
        },

        /**
         * Approve a credit derogation (Admin/Chef ADV only)
         */
        approve: async (derogationId: number, data?: DerogationApprovalRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/derogations/${derogationId}/approve`, data || {});
            return response.data;
        },

        /**
         * Reject a credit derogation (Admin/Chef ADV only)
         */
        reject: async (derogationId: number, data: DerogationRejectionRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${ADV_BASE}/derogations/${derogationId}/reject`, data);
            return response.data;
        },
    },
};

export default advApi;
