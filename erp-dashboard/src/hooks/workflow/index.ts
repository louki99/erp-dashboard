// Legacy workflow hooks (task templates)
export { useRealtimeWorkflow } from './useRealtimeWorkflow';
export { useSLATracking } from './useSLATracking';
export { useTaskStatistics } from './useTaskStatistics';
export { useWorkflowProgress } from './useWorkflowProgress';
export { useWorkflowTemplates } from './useWorkflowTemplates';

export type {
    TaskStatusChangeEvent,
    TaskBecameReadyEvent,
    TaskSLAExceededEvent,
    WorkflowProgress,
} from './useRealtimeWorkflow';

// New Workflow Engine hooks (React Flow based)
export { useWorkflowEngine } from './useWorkflowEngine';
export { useWorkflowLayout } from './useWorkflowLayout';
export type { UseWorkflowEngineOptions, UseWorkflowEngineReturn } from './useWorkflowEngine';
export type { UseWorkflowLayoutOptions, UseWorkflowLayoutReturn } from './useWorkflowLayout';
