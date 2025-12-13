import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DispatcherDashboardData } from '@/types/dispatcher.types';

export const useDispatcherDashboard = () => {
    const [data, setData] = useState<DispatcherDashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDashboard = async () => {
        setLoading(true);
        setError(null);

        try {
            const dashboardData = await dispatcherApi.dashboard.get();
            setData(dashboardData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch dispatcher dashboard');
            console.error('Failed to fetch dispatcher dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboard();
    }, []);

    return { data, loading, error, refetch: fetchDashboard };
};
