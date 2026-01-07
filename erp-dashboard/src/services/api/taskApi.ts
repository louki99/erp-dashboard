import apiClient from './client';
import type {
    WorkflowTask,
    TaskListResponse,
    TaskDetailResponse,
    TaskExecuteResponse,
    WorkflowProgressResponse,
    WorkflowTemplateListResponse,
    WorkflowTemplateDetailResponse,
    WorkflowStatisticsResponse,
    ApiSuccessResponse,
    TaskFilters,
    TaskClaimRequest,
    TaskStartRequest,
    TaskExecuteRequest,
    TaskCompleteRequest,
    TaskFailRequest,
    TaskCancelRequest,
    WorkflowTemplateCreateRequest,
    TaskTemplateCreateRequest,
    TemplateDependencyCreateRequest,
    TemplateValidationRuleCreateRequest,
    WorkflowType,
} from '@/types/task.types';

const TASK_BASE = '/api/backend/tasks';
const WORKFLOW_BASE = '/api/backend/workflow-templates';

/**
 * Task Workflow Management API Service
 * Implements SOLID principles:
 * - Single Responsibility: Each method handles one specific API operation
 * - Open/Closed: Extensible through composition
 * - Interface Segregation: Grouped by functional area
 */
export const taskApi = {
    // ==================== Task Management ====================

    tasks: {
        /**
         * Get tasks assigned to authenticated user
         */
        getMyTasks: async (filters?: TaskFilters): Promise<TaskListResponse> => {
            const response = await apiClient.get<TaskListResponse>(`${TASK_BASE}/my-tasks`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get tasks available for user's role (not yet claimed)
         */
        getAvailable: async (filters?: TaskFilters): Promise<TaskListResponse> => {
            const response = await apiClient.get<TaskListResponse>(`${TASK_BASE}/available`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get all tasks (admin view)
         */
        getAll: async (filters?: TaskFilters): Promise<TaskListResponse> => {
            const response = await apiClient.get<TaskListResponse>(`${TASK_BASE}`, {
                params: filters,
            });
            return response.data;
        },

        /**
         * Get detailed information about a specific task
         */
        getById: async (taskId: number): Promise<TaskDetailResponse> => {
            const response = await apiClient.get<TaskDetailResponse>(`${TASK_BASE}/${taskId}`);
            return response.data;
        },

        /**
         * Claim a task for yourself
         */
        claim: async (taskId: number, data?: TaskClaimRequest): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.post<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/claim`,
                data || {}
            );
            return response.data;
        },

        /**
         * Release a claimed task
         */
        release: async (taskId: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${TASK_BASE}/${taskId}/release`);
            return response.data;
        },

        /**
         * Start working on a task
         */
        start: async (taskId: number, data?: TaskStartRequest): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.post<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/start`,
                data || {}
            );
            return response.data;
        },

        /**
         * Execute task validations or actions
         */
        execute: async (taskId: number, data?: TaskExecuteRequest): Promise<TaskExecuteResponse> => {
            const response = await apiClient.post<TaskExecuteResponse>(
                `${TASK_BASE}/${taskId}/execute`,
                data || {}
            );
            return response.data;
        },

        /**
         * Complete a task successfully
         */
        complete: async (taskId: number, data?: TaskCompleteRequest): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.post<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/complete`,
                data || {}
            );
            return response.data;
        },

        /**
         * Mark a task as failed
         */
        fail: async (taskId: number, data: TaskFailRequest): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.post<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/fail`,
                data
            );
            return response.data;
        },

        /**
         * Cancel a task
         */
        cancel: async (taskId: number, data: TaskCancelRequest): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.post<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/cancel`,
                data
            );
            return response.data;
        },

        /**
         * Reassign a task to another user
         */
        reassign: async (taskId: number, userId: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(`${TASK_BASE}/${taskId}/reassign`, {
                user_id: userId,
            });
            return response.data;
        },

        /**
         * Move/reorder a task within workflow
         */
        move: async (taskId: number, newOrder: number): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.put<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}/move`,
                { new_order: newOrder }
            );
            return response.data;
        },

        /**
         * Update task properties
         */
        update: async (taskId: number, data: Partial<WorkflowTask>): Promise<ApiSuccessResponse<WorkflowTask>> => {
            const response = await apiClient.put<ApiSuccessResponse<WorkflowTask>>(
                `${TASK_BASE}/${taskId}`,
                data
            );
            return response.data;
        },

        /**
         * Check if task exists by code
         */
        checkExists: async (code: string): Promise<{ exists: boolean; task?: WorkflowTask }> => {
            const response = await apiClient.get<ApiSuccessResponse<{ exists: boolean; task?: WorkflowTask }>>(
                `${TASK_BASE}/check/${code}`
            );
            return response.data.data!;
        },
    },

    // ==================== Bulk Operations ====================

    bulk: {
        /**
         * Complete multiple tasks at once
         */
        complete: async (taskIds: number[], outputData?: Record<string, any>): Promise<{
            success: boolean;
            message: string;
            results: {
                success: Array<{ task_id: number; code: string; name: string }>;
                failed: Array<{ task_id: number; error: string }>;
            };
        }> => {
            const response = await apiClient.post(`${TASK_BASE}/bulk/complete`, {
                task_ids: taskIds,
                output_data: outputData || {},
            });
            return response.data;
        },

        /**
         * Cancel multiple tasks at once
         */
        cancel: async (taskIds: number[], reason: string): Promise<{
            success: boolean;
            message: string;
            results: {
                success: Array<{ task_id: number; code: string; name: string }>;
                failed: Array<{ task_id: number; error: string }>;
            };
        }> => {
            const response = await apiClient.post(`${TASK_BASE}/bulk/cancel`, {
                task_ids: taskIds,
                reason,
            });
            return response.data;
        },

        /**
         * Reassign multiple tasks to a new user
         */
        reassign: async (taskIds: number[], newUserId: number, reason?: string): Promise<{
            success: boolean;
            message: string;
            results: {
                success: Array<{ task_id: number; code: string; name: string }>;
                failed: Array<{ task_id: number; error: string }>;
            };
        }> => {
            const response = await apiClient.post(`${TASK_BASE}/bulk/reassign`, {
                task_ids: taskIds,
                new_user_id: newUserId,
                reason,
            });
            return response.data;
        },
    },

    // ==================== Workflow Progress ====================

    workflow: {
        /**
         * Get workflow progress for a specific entity
         */
        getProgress: async (
            workflowType: WorkflowType,
            entityType: string,
            entityId: number
        ): Promise<WorkflowProgressResponse> => {
            const response = await apiClient.get<WorkflowProgressResponse>(
                `${TASK_BASE}/workflow/${workflowType}/${entityType}/${entityId}/progress`
            );
            return response.data;
        },

        /**
         * Get task progress for BC/Order by model ID
         * GET /tasks/bc/{orderId}/progress
         */
        getProgressByModel: async (
            modelType: string,
            modelId: number
        ): Promise<WorkflowProgressResponse> => {
            // Map model type to workflow type
            const workflowType = modelType === 'App\\Models\\Order' ? 'bc' : 'bc';

            console.log('[Task API] Fetching progress for:', { modelType, modelId, workflowType });

            const response = await apiClient.get<WorkflowProgressResponse>(
                `${TASK_BASE}/${workflowType}/${modelId}/progress`
            );

            console.log('[Task API] Progress response:', response.data);
            return response.data;
        },

        /**
         * Get task statistics
         */
        getStatistics: async (): Promise<any> => {
            const response = await apiClient.get(`${TASK_BASE}/statistics`);
            return response.data;
        },
    },

    // ==================== Workflow Template Management ====================

    templates: {
        /**
         * Get all workflow definitions
         */
        getAll: async (): Promise<WorkflowTemplateListResponse> => {
            const response = await apiClient.get<WorkflowTemplateListResponse>(WORKFLOW_BASE);
            return response.data;
        },

        /**
         * Get workflow definition with templates
         */
        getById: async (workflowId: number): Promise<WorkflowTemplateDetailResponse> => {
            const response = await apiClient.get<WorkflowTemplateDetailResponse>(`${WORKFLOW_BASE}/${workflowId}`);
            return response.data;
        },

        /**
         * Create new workflow definition
         */
        create: async (data: WorkflowTemplateCreateRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(WORKFLOW_BASE, data);
            return response.data;
        },

        /**
         * Update workflow definition
         */
        update: async (workflowId: number, data: Partial<WorkflowTemplateCreateRequest>): Promise<ApiSuccessResponse> => {
            const response = await apiClient.put<ApiSuccessResponse>(`${WORKFLOW_BASE}/${workflowId}`, data);
            return response.data;
        },

        /**
         * Delete workflow definition
         */
        delete: async (workflowId: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.delete<ApiSuccessResponse>(`${WORKFLOW_BASE}/${workflowId}`);
            return response.data;
        },

        /**
         * Get workflow statistics
         */
        getStatistics: async (workflowId: number): Promise<WorkflowStatisticsResponse> => {
            const response = await apiClient.get<WorkflowStatisticsResponse>(
                `${WORKFLOW_BASE}/${workflowId}/statistics`
            );
            return response.data;
        },

        /**
         * Preview workflow structure
         */
        preview: async (workflowId: number): Promise<any> => {
            const response = await apiClient.get(`${WORKFLOW_BASE}/${workflowId}/preview`);
            return response.data;
        },
    },

    // ==================== Task Template Management ====================

    taskTemplates: {
        /**
         * Get all task templates for a workflow
         */
        getAll: async (workflowId: number): Promise<any> => {
            const response = await apiClient.get(`${WORKFLOW_BASE}/${workflowId}/templates`);
            return response.data;
        },

        /**
         * Create new task template
         */
        create: async (workflowId: number, data: TaskTemplateCreateRequest): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${WORKFLOW_BASE}/${workflowId}/templates`,
                data
            );
            return response.data;
        },

        /**
         * Update task template
         */
        update: async (
            workflowId: number,
            templateId: number,
            data: Partial<TaskTemplateCreateRequest>
        ): Promise<ApiSuccessResponse> => {
            const response = await apiClient.put<ApiSuccessResponse>(
                `${WORKFLOW_BASE}/${workflowId}/templates/${templateId}`,
                data
            );
            return response.data;
        },

        /**
         * Delete task template
         */
        delete: async (workflowId: number, templateId: number): Promise<ApiSuccessResponse> => {
            const response = await apiClient.delete<ApiSuccessResponse>(
                `${WORKFLOW_BASE}/${workflowId}/templates/${templateId}`
            );
            return response.data;
        },

        /**
         * Add dependency to task template
         */
        addDependency: async (
            workflowId: number,
            templateId: number,
            data: TemplateDependencyCreateRequest
        ): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${WORKFLOW_BASE}/${workflowId}/templates/${templateId}/dependencies`,
                data
            );
            return response.data;
        },

        /**
         * Add validation rule to task template
         */
        addValidationRule: async (
            workflowId: number,
            templateId: number,
            data: TemplateValidationRuleCreateRequest
        ): Promise<ApiSuccessResponse> => {
            const response = await apiClient.post<ApiSuccessResponse>(
                `${WORKFLOW_BASE}/${workflowId}/templates/${templateId}/validation-rules`,
                data
            );
            return response.data;
        },
    },
};

export default taskApi;
