import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowProgress, WorkflowTask } from '@/types/task.types';
import toast from 'react-hot-toast';

interface UseTaskProgressProps {
    modelType: string;
    modelId: number;
    enabled?: boolean;
}

interface UseTaskProgressReturn {
    progress: WorkflowProgress | null;
    tasks: WorkflowTask[];
    loading: boolean;
    error: Error | null;
    refresh: () => Promise<void>;
    claimTask: (taskId: number) => Promise<void>;
    startTask: (taskId: number) => Promise<void>;
    executeTask: (taskId: number, data?: Record<string, any>) => Promise<void>;
}

/**
 * Hook to manage task progress for a workflow instance
 */
export function useTaskProgress({
    modelType,
    modelId,
    enabled = true,
}: UseTaskProgressProps): UseTaskProgressReturn {
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<Error | null>(null);

    const fetchProgress = useCallback(async () => {
        if (!enabled || !modelId) return;

        try {
            setLoading(true);
            setError(null);

            const response = await taskApi.workflow.getProgressByModel(modelType, modelId);
            setProgress(response.progress);
        } catch (err: any) {
            console.error('[useTaskProgress] Error fetching progress:', err);
            setError(err);

            // Don't show error toast if it's a 404 (no tasks yet)
            if (err.response?.status !== 404) {
                toast.error('Failed to load task progress');
            }
        } finally {
            setLoading(false);
        }
    }, [modelType, modelId, enabled]);

    useEffect(() => {
        fetchProgress();
    }, [fetchProgress]);

    const claimTask = useCallback(async (taskId: number) => {
        try {
            setLoading(true);
            await taskApi.tasks.claim(taskId);
            toast.success('Task claimed successfully');
            await fetchProgress(); // Refresh after action
        } catch (err: any) {
            console.error('[useTaskProgress] Error claiming task:', err);
            toast.error(err.response?.data?.message || 'Failed to claim task');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProgress]);

    const startTask = useCallback(async (taskId: number) => {
        try {
            setLoading(true);
            await taskApi.tasks.start(taskId);
            toast.success('Task started successfully');
            await fetchProgress(); // Refresh after action
        } catch (err: any) {
            console.error('[useTaskProgress] Error starting task:', err);
            toast.error(err.response?.data?.message || 'Failed to start task');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProgress]);

    const executeTask = useCallback(async (taskId: number, data?: Record<string, any>) => {
        try {
            setLoading(true);
            await taskApi.tasks.execute(taskId, data);
            toast.success('Task executed successfully');
            await fetchProgress(); // Refresh after action
        } catch (err: any) {
            console.error('[useTaskProgress] Error executing task:', err);
            toast.error(err.response?.data?.message || 'Failed to execute task');
            throw err;
        } finally {
            setLoading(false);
        }
    }, [fetchProgress]);

    return {
        progress,
        tasks: progress?.tasks || [],
        loading,
        error,
        refresh: fetchProgress,
        claimTask,
        startTask,
        executeTask,
    };
}
