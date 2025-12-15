import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
    DraftBonLivraisonsResponse,
    BonLivraisonsResponse,
    BonLivraisonDetailResponse,
    UpdateBonLivraisonRequest,
    ApiSuccessResponse,
    SplitBlRequest,
    SplitBlResponse,
} from '@/types/dispatcher.types';

export const useDispatcherDraftBonLivraisons = () => {
    const [data, setData] = useState<DraftBonLivraisonsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchDraft = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonLivraisons.getDraft();
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch draft BLs');
            console.error('Failed to fetch draft BLs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDraft();
    }, []);

    return { data, loading, error, refetch: fetchDraft };
};

export const useDispatcherBonLivraisonsList = (filters?: { page?: number; status?: string; search?: string }) => {
    const [data, setData] = useState<BonLivraisonsResponse | any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonLivraisons.getList(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BLs');
            console.error('Failed to fetch BLs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [filters?.page, filters?.status, filters?.search]);

    return { data, loading, error, refetch: fetchList };
};

export const useDispatcherBonLivraisonEdit = (blId: number | null) => {
    const [data, setData] = useState<BonLivraisonDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchEdit = async () => {
        if (!blId) {
            setData(null);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonLivraisons.edit(blId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BL');
            console.error('Failed to fetch BL:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchEdit();
    }, [blId]);

    return { data, loading, error, refetch: fetchEdit };
};

export const useDispatcherUpdateBonLivraison = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const update = async (blId: number, payload: UpdateBonLivraisonRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await dispatcherApi.bonLivraisons.update(blId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update BL');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading, error };
};

export const useDispatcherSplitBonLivraison = () => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const split = async (blId: number, payload: SplitBlRequest): Promise<SplitBlResponse> => {
        setLoading(true);
        setError(null);
        try {
            return await dispatcherApi.bonLivraisons.split(blId, payload);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to split BL');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { split, loading, error };
};
