import apiClient from './client';

export interface WorkflowAction {
    action: string;
    label: string;
    metadata?: {
        can_execute?: boolean;
        required_role?: string;
        [key: string]: any;
    };
}

export interface WorkflowState {
    success: boolean;
    current_state: string;
    current_step_name: string;
    workflow_status: string;
    actions: WorkflowAction[];
    metadata?: Record<string, any>;
}

export interface WorkflowTransitionRequest {
    action: string;
    comment?: string;
    metadata?: Record<string, any>;
    force?: boolean;
}

export interface WorkflowTransitionResponse {
    success: boolean;
    message: string;
    current_state: string;
    previous_state: string;
    metadata?: Record<string, any>;
    warnings?: string[];
}

export interface WorkflowHistory {
    id: number;
    from_step: string;
    from_step_code: string;
    to_step: string;
    to_step_code: string;
    action: string;
    comment: string | null;
    user: string;
    user_id: number | null;
    created_at: string;
    metadata?: Record<string, any>;
}

export interface ValidationResult {
    valid: boolean;
    can_transition: boolean;
    errors: string[];
    warnings: string[];
    guard_results?: Array<{
        guard: string;
        passed: boolean;
        message?: string;
    }>;
}

const WORKFLOW_BASE = '/api/workflow';

export const workflowStateApi = {
    order: {
        getAllowedActions: async (orderId: number): Promise<WorkflowState> => {
            const response = await apiClient.get<WorkflowState>(
                `${WORKFLOW_BASE}/order/${orderId}/allowed-actions`
            );
            return response.data;
        },

        transition: async (orderId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${WORKFLOW_BASE}/order/${orderId}/transition`,
                data
            );
            return response.data;
        },

        validateTransition: async (orderId: number, action: string): Promise<ValidationResult> => {
            const response = await apiClient.post<ValidationResult>(
                `${WORKFLOW_BASE}/order/${orderId}/validate-transition`,
                { action }
            );
            return response.data;
        },

        getHistory: async (orderId: number): Promise<{ success: boolean; history: WorkflowHistory[] }> => {
            const response = await apiClient.get<{ success: boolean; history: WorkflowHistory[] }>(
                `${WORKFLOW_BASE}/order/${orderId}/history`
            );
            return response.data;
        },

        getPendingReview: async (filters?: { page?: number; per_page?: number }) => {
            const response = await apiClient.get(`${WORKFLOW_BASE}/orders/pending-review`, {
                params: filters,
            });
            return response.data;
        },
    },

    bonLivraison: {
        getAllowedActions: async (blId: number): Promise<WorkflowState> => {
            const response = await apiClient.get<WorkflowState>(
                `${WORKFLOW_BASE}/bon-livraison/${blId}/allowed-actions`
            );
            return response.data;
        },

        transition: async (blId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${WORKFLOW_BASE}/bon-livraison/${blId}/transition`,
                data
            );
            return response.data;
        },

        validateTransition: async (blId: number, action: string): Promise<ValidationResult> => {
            const response = await apiClient.post<ValidationResult>(
                `${WORKFLOW_BASE}/bon-livraison/${blId}/validate-transition`,
                { action }
            );
            return response.data;
        },

        getHistory: async (blId: number): Promise<{ success: boolean; history: WorkflowHistory[] }> => {
            const response = await apiClient.get<{ success: boolean; history: WorkflowHistory[] }>(
                `${WORKFLOW_BASE}/bon-livraison/${blId}/history`
            );
            return response.data;
        },

        getInTransit: async (filters?: { page?: number; per_page?: number }) => {
            const response = await apiClient.get(`${WORKFLOW_BASE}/bon-livraisons/in-transit`, {
                params: filters,
            });
            return response.data;
        },
    },

    bonChargement: {
        getAllowedActions: async (bchId: number): Promise<WorkflowState> => {
            const response = await apiClient.get<WorkflowState>(
                `${WORKFLOW_BASE}/bon-chargement/${bchId}/allowed-actions`
            );
            return response.data;
        },

        transition: async (bchId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${WORKFLOW_BASE}/bon-chargement/${bchId}/transition`,
                data
            );
            return response.data;
        },

        validateTransition: async (bchId: number, action: string): Promise<ValidationResult> => {
            const response = await apiClient.post<ValidationResult>(
                `${WORKFLOW_BASE}/bon-chargement/${bchId}/validate-transition`,
                { action }
            );
            return response.data;
        },

        getHistory: async (bchId: number): Promise<{ success: boolean; history: WorkflowHistory[] }> => {
            const response = await apiClient.get<{ success: boolean; history: WorkflowHistory[] }>(
                `${WORKFLOW_BASE}/bon-chargement/${bchId}/history`
            );
            return response.data;
        },
    },

    bonPreparation: {
        getAllowedActions: async (bpId: number): Promise<WorkflowState> => {
            const response = await apiClient.get<WorkflowState>(
                `${WORKFLOW_BASE}/bon-preparation/${bpId}/allowed-actions`
            );
            return response.data;
        },

        transition: async (bpId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${WORKFLOW_BASE}/bon-preparation/${bpId}/transition`,
                data
            );
            return response.data;
        },

        validateTransition: async (bpId: number, action: string): Promise<ValidationResult> => {
            const response = await apiClient.post<ValidationResult>(
                `${WORKFLOW_BASE}/bon-preparation/${bpId}/validate-transition`,
                { action }
            );
            return response.data;
        },

        getHistory: async (bpId: number): Promise<{ success: boolean; history: WorkflowHistory[] }> => {
            const response = await apiClient.get<{ success: boolean; history: WorkflowHistory[] }>(
                `${WORKFLOW_BASE}/bon-preparation/${bpId}/history`
            );
            return response.data;
        },

        updateItems: async (bpId: number, items: Array<{ product_id: number; prepared_quantity: number }>) => {
            const response = await apiClient.put(
                `/api/backend/magasinier/preparations/${bpId}/items`,
                { items }
            );
            return response.data;
        },
    },
};

export default workflowStateApi;
