import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowProgress, WorkflowType } from '@/types/task.types';
import toast from 'react-hot-toast';

/**
 * Custom hook for workflow progress tracking
 * Follows Single Responsibility Principle - handles workflow progress operations
 */
export const useWorkflowProgress = (
    workflowType: WorkflowType,
    entityType: string,
    entityId: number,
    autoFetch: boolean = true
) => {
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        if (!workflowType || !entityType || !entityId) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.workflow.getProgress(workflowType, entityType, entityId);
            setProgress(response.progress);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch workflow progress';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [workflowType, entityType, entityId]);

    const refresh = useCallback(() => {
        fetchProgress();
    }, [fetchProgress]);

    useEffect(() => {
        if (autoFetch) {
            fetchProgress();
        }
    }, [autoFetch, fetchProgress]);

    return {
        progress,
        loading,
        error,
        refresh,
    };
};
