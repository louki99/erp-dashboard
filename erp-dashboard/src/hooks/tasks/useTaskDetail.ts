import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowTask } from '@/types/task.types';
import toast from 'react-hot-toast';

/**
 * Custom hook for task detail
 * Follows Single Responsibility Principle - handles single task operations
 */
export const useTaskDetail = (taskId: number | null, autoFetch: boolean = true) => {
    const [task, setTask] = useState<WorkflowTask | null>(null);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const fetchTask = useCallback(async () => {
        if (!taskId) {
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.getById(taskId);
            setTask(response.task);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch task details';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [taskId]);

    const refresh = useCallback(() => {
        fetchTask();
    }, [fetchTask]);

    useEffect(() => {
        if (autoFetch && taskId) {
            fetchTask();
        }
    }, [autoFetch, taskId, fetchTask]);

    return {
        task,
        loading,
        error,
        refresh,
    };
};
