import apiClient from './client';
import type { WorkflowContextResponse, DispatcherOrder } from '@/types/dispatcher.types';

export interface WorkflowField {
    name: string;
    type: 'textarea' | 'number' | 'text' | 'select';
    label: string;
    required: boolean;
    min_length?: number;
    placeholder?: string;
    options?: Array<{ value: string | number; label: string }>;
}

export interface WorkflowAction {
    action: string;
    label: string;
    description?: string;
    intent?: string;
    confirm?: boolean;
    danger?: boolean;
    fields?: WorkflowField[];
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
    fields?: Record<string, any>;
    idempotencyKey?: string;
    override_guard_warning?: boolean;
}

export interface WorkflowTransitionResponse {
    success: boolean;
    message: string;
    current_state?: string;
    previous_state?: string;
    new_status?: string;
    metadata?: Record<string, any>;
    warnings?: string[];
    // Idempotency: 409 with success:true means already executed (docs §12)
    idempotent?: boolean;
    // Guard warning: success:false + guard_warning:true means user must confirm (docs §7)
    guard_warning?: boolean;
    guard_key?: string;
    severity?: 'warn' | 'block';
    can_override?: boolean;
    // Violations: 422 from constraint failures (docs §4/§11)
    violations?: Array<{
        constraint: string;
        reason: string;
        metadata?: {
            rule?: string;
            can_request_override?: boolean;
            available?: number;
            required?: number;
            [key: string]: any;
        };
    }>;
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
const BACKEND_WORKFLOW_BASE = '/api/backend/workflow';

export const workflowStateApi = {
    bonCommande: {
        getDecisions: async (orderId: number): Promise<WorkflowState> => {
            const response = await apiClient.get(
                `${BACKEND_WORKFLOW_BASE}/bon-commande/${orderId}/decisions`
            );
            const d = response.data;
            // Normalize: API returns { decisions: [...] } or { actions: [...] }
            // Each decision has { decision, label, description, intent, confirm, danger, fields }
            // We map decision → action and set can_execute: true (all returned decisions are executable)
            const raw: any[] = d.decisions ?? d.actions ?? [];
            return {
                success: d.success ?? true,
                current_state: d.current_state,
                current_step_name: d.current_step_name,
                workflow_status: d.workflow_status,
                actions: raw.map(item => ({
                    action: item.decision ?? item.action,
                    label: item.label,
                    description: item.description,
                    intent: item.intent,
                    confirm: item.confirm ?? true,
                    danger: item.danger ?? false,
                    fields: item.fields ?? [],
                    metadata: {
                        can_execute: true,
                        ...(item.metadata ?? {}),
                    },
                })),
                metadata: d.metadata,
            };
        },

        getContext: async (orderId: number): Promise<WorkflowContextResponse<DispatcherOrder>> => {
            const response = await apiClient.get<WorkflowContextResponse<DispatcherOrder>>(
                `${BACKEND_WORKFLOW_BASE}/bon-commande/${orderId}/context`
            );
            return response.data;
        },

        execute: async (orderId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const headers: Record<string, string> = {};
            if (data.idempotencyKey) headers['Idempotency-Key'] = data.idempotencyKey;

            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${BACKEND_WORKFLOW_BASE}/bon-commande/${orderId}/execute`,
                {
                    decision: data.action,
                    metadata: {
                        ...(data.fields ?? {}),
                        ...(data.comment ? { comment: data.comment } : {}),
                        ...(data.override_guard_warning ? { override_guard_warning: true } : {}),
                    },
                },
                { headers }
            );
            return response.data;
        },

        // Dry-run: validate a decision without executing it (docs §4 /validate)
        validate: async (orderId: number, data: WorkflowTransitionRequest): Promise<WorkflowTransitionResponse> => {
            const response = await apiClient.post<WorkflowTransitionResponse>(
                `${BACKEND_WORKFLOW_BASE}/bon-commande/${orderId}/validate`,
                {
                    decision: data.action,
                    metadata: { ...(data.fields ?? {}), ...(data.comment ? { comment: data.comment } : {}) },
                }
            );
            return response.data;
        },

        getHistory: async (orderId: number): Promise<{ success: boolean; history: WorkflowHistory[] }> => {
            const response = await apiClient.get<{ success: boolean; history: WorkflowHistory[] }>(
                `${BACKEND_WORKFLOW_BASE}/bon-commande/${orderId}/history`
            );
            return response.data;
        },
    },


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
