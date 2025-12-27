import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowType } from '@/types/task.types';

interface WorkflowProgress {
    total: number;
    completed: number;
    in_progress: number;
    failed: number;
    pending: number;
    progress_percentage: number;
    tasks: any[];
}

interface UseWorkflowProgressOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export function useWorkflowProgress(
    workflowType: WorkflowType | null,
    entityType: string | null,
    entityId: number | null,
    options: UseWorkflowProgressOptions = {}
) {
    const { autoRefresh = false, refreshInterval = 5000 } = options;
    
    const [progress, setProgress] = useState<WorkflowProgress | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchProgress = useCallback(async () => {
        if (!workflowType || !entityType || !entityId) {
            setLoading(false);
            return;
        }

        try {
            const response = await taskApi.workflow.getProgress(workflowType, entityType, entityId);
            setProgress(response.progress);
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch workflow progress');
            console.error('Error fetching workflow progress:', err);
        } finally {
            setLoading(false);
        }
    }, [workflowType, entityType, entityId]);

    useEffect(() => {
        fetchProgress();

        if (autoRefresh && workflowType && entityType && entityId) {
            const interval = setInterval(fetchProgress, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchProgress, autoRefresh, refreshInterval, workflowType, entityType, entityId]);

    const refetch = useCallback(() => {
        setLoading(true);
        fetchProgress();
    }, [fetchProgress]);

    return {
        progress,
        loading,
        error,
        refetch,
    };
}
