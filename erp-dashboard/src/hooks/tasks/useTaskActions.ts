import { useState, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type {
    TaskClaimRequest,
    TaskStartRequest,
    TaskExecuteRequest,
    TaskCompleteRequest,
    TaskFailRequest,
    TaskCancelRequest,
} from '@/types/task.types';
import toast from 'react-hot-toast';

/**
 * Custom hook for task actions
 * Follows Single Responsibility Principle - handles task state transitions
 */
export const useTaskActions = () => {
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const claimTask = useCallback(async (taskId: number, data?: TaskClaimRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.claim(taskId, data);
            toast.success(response.message || 'Task claimed successfully');
            return response.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to claim task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const releaseTask = useCallback(async (taskId: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.release(taskId);
            toast.success(response.message || 'Task released successfully');
            return response;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to release task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const startTask = useCallback(async (taskId: number, data?: TaskStartRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.start(taskId, data);
            toast.success(response.message || 'Task started successfully');
            return response.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to start task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const executeTask = useCallback(async (taskId: number, data?: TaskExecuteRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.execute(taskId, data);
            toast.success(response.message || 'Task executed successfully');
            return response;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to execute task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const completeTask = useCallback(async (taskId: number, data?: TaskCompleteRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.complete(taskId, data);
            toast.success(response.message || 'Task completed successfully');
            return response.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to complete task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const failTask = useCallback(async (taskId: number, data: TaskFailRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.fail(taskId, data);
            toast.success(response.message || 'Task marked as failed');
            return response.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to mark task as failed';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const cancelTask = useCallback(async (taskId: number, data: TaskCancelRequest) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.cancel(taskId, data);
            toast.success(response.message || 'Task cancelled successfully');
            return response.data;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to cancel task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    const reassignTask = useCallback(async (taskId: number, userId: number) => {
        setLoading(true);
        setError(null);
        try {
            const response = await taskApi.tasks.reassign(taskId, userId);
            toast.success(response.message || 'Task reassigned successfully');
            return response;
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to reassign task';
            setError(errorMessage);
            toast.error(errorMessage);
            throw err;
        } finally {
            setLoading(false);
        }
    }, []);

    return {
        loading,
        error,
        claimTask,
        releaseTask,
        startTask,
        executeTask,
        completeTask,
        failTask,
        cancelTask,
        reassignTask,
    };
};
