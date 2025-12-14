import { useEffect, useState } from 'react';
import { ridersApi, type Rider, type RidersResponse } from '@/services/api/ridersApi';

export const useRiders = () => {
    const [riders, setRiders] = useState<Rider[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchRiders = async () => {
        setLoading(true);
        setError(null);

        try {
            const response: RidersResponse = await ridersApi.getSimple();
            if (response.success && response.data?.riders?.data) {
                setRiders(response.data.riders.data);
            } else {
                setRiders([]);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch riders');
            console.error('Failed to fetch riders:', err);
            setRiders([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchRiders();
    }, []);

    return { riders, loading, error, refetch: fetchRiders };
};
