import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';
import type { WorkflowTask, TaskFilters, TaskListResponse } from '@/types/task.types';
import toast from 'react-hot-toast';

/**
 * Custom hook for managing tasks
 * Follows Single Responsibility Principle - handles task list operations
 */
export const useTasks = (filters?: TaskFilters, autoFetch: boolean = true) => {
    const [tasks, setTasks] = useState<WorkflowTask[]>([]);
    const [loading, setLoading] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);
    const [pagination, setPagination] = useState({
        currentPage: 1,
        totalPages: 1,
        total: 0,
        perPage: 20,
    });

    const fetchTasks = useCallback(async (customFilters?: TaskFilters) => {
        setLoading(true);
        setError(null);
        try {
            const response: TaskListResponse = await taskApi.tasks.getMyTasks({
                ...filters,
                ...customFilters,
            });

            // Handle both paginated and flat array responses
            if (Array.isArray(response.tasks)) {
                // Flat array response
                setTasks(response.tasks);
                setPagination({
                    currentPage: 1,
                    totalPages: 1,
                    total: response.tasks.length,
                    perPage: response.tasks.length,
                });
            } else {
                // Paginated response
                setTasks(response.tasks.data);
                setPagination({
                    currentPage: response.tasks.current_page,
                    totalPages: response.tasks.last_page,
                    total: response.tasks.total,
                    perPage: response.tasks.per_page,
                });
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch tasks';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const fetchAvailableTasks = useCallback(async (customFilters?: TaskFilters) => {
        setLoading(true);
        setError(null);
        try {
            const response: TaskListResponse = await taskApi.tasks.getAvailable({
                ...filters,
                ...customFilters,
            });

            // Handle both paginated and flat array responses
            if (Array.isArray(response.tasks)) {
                // Flat array response
                setTasks(response.tasks);
                setPagination({
                    currentPage: 1,
                    totalPages: 1,
                    total: response.tasks.length,
                    perPage: response.tasks.length,
                });
            } else {
                // Paginated response
                setTasks(response.tasks.data);
                setPagination({
                    currentPage: response.tasks.current_page,
                    totalPages: response.tasks.last_page,
                    total: response.tasks.total,
                    perPage: response.tasks.per_page,
                });
            }
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || 'Failed to fetch available tasks';
            setError(errorMessage);
            toast.error(errorMessage);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    const refresh = useCallback(() => {
        fetchTasks();
    }, [fetchTasks]);

    useEffect(() => {
        if (autoFetch) {
            fetchTasks();
        }
    }, [autoFetch, fetchTasks]);

    return {
        tasks,
        loading,
        error,
        pagination,
        fetchTasks,
        fetchAvailableTasks,
        refresh,
    };
};
