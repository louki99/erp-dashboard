import { useState, useEffect, useCallback } from 'react';
import { taskApi } from '@/services/api/taskApi';

interface TaskStatistics {
    total: number;
    pending: number;
    ready: number;
    in_progress: number;
    completed: number;
    failed: number;
    cancelled: number;
}

interface UseTaskStatisticsOptions {
    autoRefresh?: boolean;
    refreshInterval?: number;
}

export function useTaskStatistics(options: UseTaskStatisticsOptions = {}) {
    const { autoRefresh = false, refreshInterval = 10000 } = options;
    
    const [statistics, setStatistics] = useState<TaskStatistics | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStatistics = useCallback(async () => {
        try {
            const response = await taskApi.workflow.getStatistics();
            // API returns { success: true, statistics: {...} }
            if (response && response.statistics) {
                setStatistics(response.statistics);
            } else if (response) {
                // Fallback if response structure is different
                setStatistics(response as any);
            }
            setError(null);
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to fetch task statistics');
            console.error('Error fetching task statistics:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetchStatistics();

        if (autoRefresh) {
            const interval = setInterval(fetchStatistics, refreshInterval);
            return () => clearInterval(interval);
        }
    }, [fetchStatistics, autoRefresh, refreshInterval]);

    const refetch = useCallback(() => {
        setLoading(true);
        fetchStatistics();
    }, [fetchStatistics]);

    return {
        statistics,
        loading,
        error,
        refetch,
    };
}
