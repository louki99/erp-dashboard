import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { DerogationsListResponse, DerogationDetailResponse, DerogationFilters } from '@/types/adv.types';

/**
 * Custom hook to fetch derogations list
 * @param filters - Optional filters (status, page)
 * @returns Derogations list, stats, loading state, error, and refetch function
 */
export const useAdvDerogations = (filters?: DerogationFilters) => {
    const [data, setData] = useState<DerogationsListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDerogations = async () => {
        setLoading(true);
        setError(null);

        try {
            const derogationsData = await advApi.derogations.getList(filters);
            setData(derogationsData);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch derogations');
            console.error('Failed to fetch derogations:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDerogations();
    }, [filters?.status, filters?.page]);

    return {
        derogations: data?.derogations || null,
        stats: data?.stats || null,
        loading,
        error,
        refetch: fetchDerogations,
    };
};

/**
 * Custom hook to fetch derogation detail by ID
 * @param derogationId - Derogation ID
 * @returns Derogation detail data, loading state, error, and refetch function
 */
export const useAdvDerogationDetail = (derogationId: number | null) => {
    const [data, setData] = useState<DerogationDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDerogationDetail = async () => {
        if (!derogationId) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const derogationDetail = await advApi.derogations.getById(derogationId);
            setData(derogationDetail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch derogation detail');
            console.error('Failed to fetch derogation detail:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDerogationDetail();
    }, [derogationId]);

    return {
        derogation: data?.derogation || null,
        loading,
        error,
        refetch: fetchDerogationDetail,
    };
};
