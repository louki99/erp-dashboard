import apiClient from './client';
import type {
    WorkflowGraph,
    WorkflowGraphResponse,
    WorkflowInstanceDetail,
    WorkflowInstanceResponse,
    WorkflowInstanceByModelResponse,
    CreateWorkflowInstanceRequest,
    CreateWorkflowInstanceResponse,
    TransitionRequest,
    TransitionResponse,
    WorkflowHistoryResponse,
    WorkflowDefinition,
} from '@/types/workflowEngine.types';

const BASE_URL = '/api/backend';

/**
 * Workflow Engine API
 * Implements the Workflow Engine API specification
 */
export const workflowEngineApi = {
    /**
     * A. Fetching the Graph (React Flow)
     * GET /workflows/{workflowId}/graph
     */
    getWorkflowGraph: async (workflowId: number): Promise<WorkflowGraph> => {
        try {
            console.log(`[Workflow Engine] Fetching graph for workflow ${workflowId}`);
            const response = await apiClient.get<any>(
                `${BASE_URL}/workflows/${workflowId}/graph`
            );
            console.log('[Workflow Engine] Graph response:', response.data);

            // Backend might return graph directly or wrapped in { graph: {...} }
            const graphData = response.data.graph || response.data;

            console.log('[Workflow Engine] Extracted graph data:', graphData);

            if (!graphData.nodes || !graphData.edges) {
                console.error('[Workflow Engine] Invalid graph structure:', graphData);
                throw new Error('Invalid graph structure: missing nodes or edges');
            }

            return graphData;
        } catch (error: any) {
            console.error('[Workflow Engine] Error fetching graph:', {
                workflowId,
                error: error.message,
                response: error.response?.data,
            });
            throw error;
        }
    },

    /**
     * B. Fetching the Instance (The "State")
     * GET /workflow-instances/{instanceId}
     */
    getWorkflowInstance: async (instanceId: number): Promise<WorkflowInstanceDetail> => {
        try {
            console.log(`[Workflow Engine] Fetching instance ${instanceId}`);
            const response = await apiClient.get<any>(
                `${BASE_URL}/workflow-instances/${instanceId}`
            );
            console.log('[Workflow Engine] Instance response:', response.data);

            // Backend returns: { instance: {...}, current_step: {...}, allowed_actions: [...] }
            // We need to restructure it to match WorkflowInstanceDetail
            const instanceDetail: WorkflowInstanceDetail = {
                instance: response.data.instance,
                current_step: response.data.current_step,
                allowed_actions: response.data.allowed_actions || []
            };

            return instanceDetail;
        } catch (error: any) {
            console.error('[Workflow Engine] Error fetching instance:', {
                instanceId,
                error: error.message,
                response: error.response?.data,
            });
            throw error;
        }
    },

    /**
     * Get instance by model (Order, BC, etc.)
     * GET /workflows/{workflowId}/instances/by-model?model_type=App\Models\Order&model_id=115
     */
    getInstanceByModel: async (
        workflowId: number,
        modelType: string,
        modelId: number
    ): Promise<WorkflowInstanceByModelResponse> => {
        const response = await apiClient.get<WorkflowInstanceByModelResponse>(
            `${BASE_URL}/workflows/${workflowId}/instances/by-model`,
            {
                params: {
                    model_type: modelType,
                    model_id: modelId,
                },
            }
        );
        return response.data;
    },

    /**
     * Create a new workflow instance
     * POST /workflow-instances
     */
    createWorkflowInstance: async (
        data: CreateWorkflowInstanceRequest
    ): Promise<CreateWorkflowInstanceResponse> => {
        try {
            console.log('[Workflow Engine] Creating instance with data:', data);
            const response = await apiClient.post<CreateWorkflowInstanceResponse>(
                `${BASE_URL}/workflow-instances`,
                data
            );
            console.log('[Workflow Engine] Create instance raw response:', response);
            console.log('[Workflow Engine] Create instance response.data:', response.data);
            return response.data;
        } catch (error: any) {
            console.error('[Workflow Engine] Error creating instance:', {
                data,
                error: error.message,
                response: error.response?.data,
            });
            throw error;
        }
    },

    /**
     * C. Executing a Transition (The "Action")
     * POST /workflow-instances/{instanceId}/transitions
     */
    executeTransition: async (
        instanceId: number,
        transitionData: TransitionRequest
    ): Promise<TransitionResponse> => {
        const response = await apiClient.post<TransitionResponse>(
            `${BASE_URL}/workflow-instances/${instanceId}/transitions`,
            transitionData
        );
        return response.data;
    },

    /**
     * Get workflow instance history
     * GET /workflow-instances/{instanceId}/history
     */
    getInstanceHistory: async (instanceId: number) => {
        const response = await apiClient.get<WorkflowHistoryResponse>(
            `${BASE_URL}/workflow-instances/${instanceId}/history`
        );
        return response.data.history;
    },

    /**
     * Get all workflow definitions
     * GET /workflows
     */
    getAllWorkflows: async (): Promise<WorkflowDefinition[]> => {
        const response = await apiClient.get<{ success: boolean; workflows: WorkflowDefinition[] }>(
            `${BASE_URL}/workflows`
        );
        return response.data.workflows;
    },

    /**
     * Get workflow definition by ID
     * GET /workflows/{workflowId}
     */
    getWorkflowById: async (workflowId: number): Promise<WorkflowDefinition> => {
        const response = await apiClient.get<{ success: boolean; workflow: WorkflowDefinition }>(
            `${BASE_URL}/workflows/${workflowId}`
        );
        return response.data.workflow;
    },

    /**
     * Get workflow definition by code
     * GET /workflows/by-code/{code}
     */
    getWorkflowByCode: async (code: string): Promise<WorkflowDefinition> => {
        const response = await apiClient.get<{ success: boolean; workflow: WorkflowDefinition }>(
            `${BASE_URL}/workflows/by-code/${code}`
        );
        return response.data.workflow;
    },

    /**
     * Helper: Get or create instance for a model
     * Combines getInstanceByModel and createWorkflowInstance
     */
    getOrCreateInstance: async (
        workflowId: number,
        modelType: string,
        modelId: number
    ): Promise<number> => {
        try {
            console.log('[Workflow Engine] Getting or creating instance:', {
                workflowId,
                modelType,
                modelId,
            });

            // First, try to get existing instance
            const existingResponse = await workflowEngineApi.getInstanceByModel(
                workflowId,
                modelType,
                modelId
            );

            console.log('[Workflow Engine] Existing instance response:', existingResponse);

            // Backend returns instance directly if it exists, or null if 404
            if (existingResponse && existingResponse.id) {
                console.log('[Workflow Engine] Found existing instance:', existingResponse.id);
                return existingResponse.id;
            }

            // If not exists, create new instance
            console.log('[Workflow Engine] Creating new instance...');
            const createResponse = await workflowEngineApi.createWorkflowInstance({
                workflow_id: workflowId,
                model_type: modelType,
                model_id: modelId,
            });

            console.log('[Workflow Engine] Created instance response:', createResponse);

            // Backend returns instance directly in the response
            const instanceId = createResponse.id ||
                createResponse.instance?.id ||
                createResponse.data?.id;

            if (!instanceId) {
                console.error('[Workflow Engine] Could not extract instance ID from response:', createResponse);
                throw new Error('Invalid response structure: missing instance ID');
            }

            console.log('[Workflow Engine] Extracted instance ID:', instanceId);
            return instanceId;
        } catch (error: any) {
            console.error('[Workflow Engine] Error in getOrCreateInstance:', {
                error,
                message: error.message,
                response: error.response?.data,
                status: error.response?.status,
            });
            throw error;
        }
    },
};
