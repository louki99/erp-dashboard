import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { DashboardData } from '@/types/adv.types';

/**
 * Custom hook to fetch ADV dashboard data
 * @returns Dashboard data, loading state, error, and refetch function
 */
export const useAdvDashboard = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);

        try {
            const dashboardData = await advApi.dashboard.get();
            setData(dashboardData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch dashboard');
            console.error('Failed to fetch ADV dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    return { data, loading, error, refetch: fetchDashboard };
};
