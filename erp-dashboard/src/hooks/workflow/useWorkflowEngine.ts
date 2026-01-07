import { useState, useEffect, useCallback } from 'react';
import { workflowEngineApi } from '@/services/api/workflowEngineApi';
import type {
    WorkflowGraph,
    WorkflowInstanceDetail,
    AllowedAction,
    WorkflowStep,
    WorkflowInstance,
    TransitionRequest,
} from '@/types/workflowEngine.types';
import toast from 'react-hot-toast';

export interface UseWorkflowEngineOptions {
    workflowId?: number;
    workflowCode?: string;
    instanceId?: number;
    modelType?: string;
    modelId?: number;
    autoFetch?: boolean;
}

export interface UseWorkflowEngineReturn {
    // State
    graph: WorkflowGraph | null;
    instance: WorkflowInstance | null;
    currentStep: WorkflowStep | null;
    allowedActions: AllowedAction[];
    isLoading: boolean;
    isExecuting: boolean;
    error: Error | null;

    // Methods
    fetchGraph: () => Promise<void>;
    fetchInstance: () => Promise<void>;
    executeTransition: (action: string, notes?: string, metadata?: Record<string, any>) => Promise<void>;
    refresh: () => Promise<void>;
    reset: () => void;
}

/**
 * Main hook for Workflow Engine integration
 * Manages workflow graph, instance state, and transitions
 */
export function useWorkflowEngine(options: UseWorkflowEngineOptions = {}): UseWorkflowEngineReturn {
    const {
        workflowId,
        workflowCode,
        instanceId,
        modelType,
        modelId,
        autoFetch = true,
    } = options;

    // State
    const [graph, setGraph] = useState<WorkflowGraph | null>(null);
    const [instanceDetail, setInstanceDetail] = useState<WorkflowInstanceDetail | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [isExecuting, setIsExecuting] = useState(false);
    const [error, setError] = useState<Error | null>(null);
    const [resolvedWorkflowId, setResolvedWorkflowId] = useState<number | undefined>(workflowId);

    // Resolve workflow ID from code if needed
    useEffect(() => {
        if (workflowCode && !workflowId) {
            workflowEngineApi.getWorkflowByCode(workflowCode)
                .then((workflow) => {
                    if (workflow && workflow.id) {
                        setResolvedWorkflowId(workflow.id);
                    } else {
                        const error = new Error(`Workflow with code "${workflowCode}" not found`);
                        setError(error);
                        console.error('Failed to resolve workflow code:', error);
                    }
                })
                .catch((err) => {
                    console.error('Failed to resolve workflow code:', err);
                    setError(err);
                });
        }
    }, [workflowCode, workflowId]);

    /**
     * Fetch workflow graph
     */
    const fetchGraph = useCallback(async () => {
        if (!resolvedWorkflowId) return;

        try {
            setIsLoading(true);
            setError(null);
            const graphData = await workflowEngineApi.getWorkflowGraph(resolvedWorkflowId);
            setGraph(graphData);
        } catch (err) {
            const error = err as Error;
            setError(error);
            console.error('Failed to fetch workflow graph:', error);
        } finally {
            setIsLoading(false);
        }
    }, [resolvedWorkflowId]);

    /**
     * Fetch workflow instance
     */
    const fetchInstance = useCallback(async () => {
        try {
            setIsLoading(true);
            setError(null);

            let targetInstanceId = instanceId;

            // If no instance ID provided, try to get/create by model
            if (!targetInstanceId && resolvedWorkflowId && modelType && modelId) {
                targetInstanceId = await workflowEngineApi.getOrCreateInstance(
                    resolvedWorkflowId,
                    modelType,
                    modelId
                );
            }

            if (!targetInstanceId) {
                throw new Error('No instance ID available');
            }

            const instanceData = await workflowEngineApi.getWorkflowInstance(targetInstanceId);
            setInstanceDetail(instanceData);
        } catch (err) {
            const error = err as Error;
            setError(error);
            console.error('Failed to fetch workflow instance:', error);
        } finally {
            setIsLoading(false);
        }
    }, [instanceId, resolvedWorkflowId, modelType, modelId]);

    /**
     * Execute a workflow transition
     */
    const executeTransition = useCallback(async (
        action: string,
        notes?: string,
        metadata?: Record<string, any>
    ) => {
        if (!instanceDetail?.instance.id) {
            toast.error('No active workflow instance');
            return;
        }

        try {
            setIsExecuting(true);
            setError(null);

            const transitionData: TransitionRequest = {
                action,
                notes,
                metadata: {
                    ...metadata,
                    ui_source: 'react_flow',
                },
            };

            const response = await workflowEngineApi.executeTransition(
                instanceDetail.instance.id,
                transitionData
            );

            if (response.success) {
                toast.success(response.message || 'Transition executed successfully');
                // Refresh instance data
                await fetchInstance();
            } else {
                toast.error('Transition failed');
            }
        } catch (err: any) {
            const error = err as Error;
            setError(error);
            const errorMessage = err.response?.data?.error || error.message || 'Failed to execute transition';
            toast.error(errorMessage);
            console.error('Failed to execute transition:', error);
        } finally {
            setIsExecuting(false);
        }
    }, [instanceDetail, fetchInstance]);

    /**
     * Refresh both graph and instance
     */
    const refresh = useCallback(async () => {
        await Promise.all([fetchGraph(), fetchInstance()]);
    }, [fetchGraph, fetchInstance]);

    /**
     * Reset state
     */
    const reset = useCallback(() => {
        setGraph(null);
        setInstanceDetail(null);
        setError(null);
    }, []);

    // Auto-fetch on mount or when dependencies change
    useEffect(() => {
        if (autoFetch && resolvedWorkflowId) {
            fetchGraph();
        }
    }, [autoFetch, resolvedWorkflowId, fetchGraph]);

    useEffect(() => {
        if (autoFetch && (instanceId || (resolvedWorkflowId && modelType && modelId))) {
            fetchInstance();
        }
    }, [autoFetch, instanceId, resolvedWorkflowId, modelType, modelId, fetchInstance]);

    return {
        // State
        graph,
        instance: instanceDetail?.instance || null,
        currentStep: instanceDetail?.current_step || null,
        allowedActions: instanceDetail?.allowed_actions || [],
        isLoading,
        isExecuting,
        error,

        // Methods
        fetchGraph,
        fetchInstance,
        executeTransition,
        refresh,
        reset,
    };
}
