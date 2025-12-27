import apiClient from './client';
import type {
    WorkflowDefinition,
    WorkflowTaskTemplate,
    WorkflowTemplateListResponse,
    WorkflowTemplateDetailResponse,
    WorkflowStatisticsResponse,
    WorkflowTemplateCreateRequest,
    TaskTemplateCreateRequest,
    TemplateDependencyCreateRequest,
    TemplateValidationRuleCreateRequest,
    ApiSuccessResponse,
} from '@/types/task.types';

const BASE_URL = '/api/backend/workflow-templates';

export const workflowApi = {
    getAll: async (): Promise<WorkflowDefinition[]> => {
        const response = await apiClient.get<WorkflowTemplateListResponse>(BASE_URL);
        return response.data.workflows;
    },

    getById: async (id: number): Promise<WorkflowDefinition> => {
        const response = await apiClient.get<WorkflowTemplateDetailResponse>(`${BASE_URL}/${id}`);
        return response.data.workflow;
    },

    create: async (data: WorkflowTemplateCreateRequest): Promise<WorkflowDefinition> => {
        const response = await apiClient.post<ApiSuccessResponse<{ workflow: WorkflowDefinition }>>(
            BASE_URL,
            data
        );
        return response.data.data!.workflow;
    },

    update: async (id: number, data: Partial<WorkflowTemplateCreateRequest>): Promise<WorkflowDefinition> => {
        const response = await apiClient.put<ApiSuccessResponse<{ workflow: WorkflowDefinition }>>(
            `${BASE_URL}/${id}`,
            data
        );
        return response.data.data!.workflow;
    },

    delete: async (id: number): Promise<void> => {
        await apiClient.delete(`${BASE_URL}/${id}`);
    },

    getStatistics: async (id: number) => {
        const response = await apiClient.get<WorkflowStatisticsResponse>(`${BASE_URL}/${id}/statistics`);
        return response.data.statistics;
    },

    preview: async (id: number) => {
        const response = await apiClient.get<ApiSuccessResponse>(`${BASE_URL}/${id}/preview`);
        return response.data.data;
    },

    getTemplates: async (workflowId: number): Promise<WorkflowTaskTemplate[]> => {
        const response = await apiClient.get<{ success: boolean; workflow: WorkflowDefinition; templates: WorkflowTaskTemplate[] }>(
            `${BASE_URL}/${workflowId}/templates`
        );
        return response.data.templates;
    },

    createTemplate: async (
        workflowId: number,
        data: TaskTemplateCreateRequest
    ): Promise<WorkflowTaskTemplate> => {
        const response = await apiClient.post<ApiSuccessResponse<{ template: WorkflowTaskTemplate }>>(
            `${BASE_URL}/${workflowId}/templates`,
            data
        );
        return response.data.data!.template;
    },

    updateTemplate: async (
        workflowId: number,
        templateId: number,
        data: Partial<TaskTemplateCreateRequest>
    ): Promise<WorkflowTaskTemplate> => {
        const response = await apiClient.put<ApiSuccessResponse<{ template: WorkflowTaskTemplate }>>(
            `${BASE_URL}/${workflowId}/templates/${templateId}`,
            data
        );
        return response.data.data!.template;
    },

    deleteTemplate: async (workflowId: number, templateId: number): Promise<void> => {
        await apiClient.delete(`${BASE_URL}/${workflowId}/templates/${templateId}`);
    },

    addDependency: async (
        workflowId: number,
        templateId: number,
        data: TemplateDependencyCreateRequest
    ) => {
        const response = await apiClient.post(
            `${BASE_URL}/${workflowId}/templates/${templateId}/dependencies`,
            data
        );
        return response.data;
    },

    removeDependency: async (workflowId: number, templateId: number, dependencyId: number) => {
        await apiClient.delete(
            `${BASE_URL}/${workflowId}/templates/${templateId}/dependencies/${dependencyId}`
        );
    },

    addValidationRule: async (
        workflowId: number,
        templateId: number,
        data: TemplateValidationRuleCreateRequest
    ) => {
        const response = await apiClient.post(
            `${BASE_URL}/${workflowId}/templates/${templateId}/validation-rules`,
            data
        );
        return response.data;
    },

    updateValidationRule: async (
        workflowId: number,
        templateId: number,
        ruleId: number,
        data: Partial<TemplateValidationRuleCreateRequest>
    ) => {
        const response = await apiClient.put(
            `${BASE_URL}/${workflowId}/templates/${templateId}/validation-rules/${ruleId}`,
            data
        );
        return response.data;
    },

    deleteValidationRule: async (workflowId: number, templateId: number, ruleId: number) => {
        await apiClient.delete(
            `${BASE_URL}/${workflowId}/templates/${templateId}/validation-rules/${ruleId}`
        );
    },

    reorderTemplates: async (workflowId: number, templateOrders: { id: number; order: number }[]) => {
        const response = await apiClient.post(`${BASE_URL}/${workflowId}/templates/reorder`, {
            templates: templateOrders,
        });
        return response.data;
    },
};
