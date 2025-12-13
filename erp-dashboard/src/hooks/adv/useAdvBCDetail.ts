import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { BCDetailResponse } from '@/types/adv.types';

/**
 * Custom hook to fetch BC detail by ID
 * @param bcId - BC/Order ID
 * @returns BC detail data, loading state, error, and refetch function
 */
export const useAdvBCDetail = (bcId: number | null) => {
    const [data, setData] = useState<BCDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBCDetail = async () => {
        if (!bcId) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const bcDetail = await advApi.bc.getById(bcId);
            setData(bcDetail);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BC detail');
            console.error('Failed to fetch BC detail:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBCDetail();
    }, [bcId]);

    return {
        bc: data?.bc || null,
        stockAvailable: data?.stockAvailable,
        creditOk: data?.creditOk,
        creditExceeded: data?.creditExceeded,
        excessAmount: data?.excessAmount,
        pendingDerogation: data?.pendingDerogation,
        partnerStats: data?.partnerStats,
        loading,
        error,
        refetch: fetchBCDetail,
    };
};
