import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
    ApiSuccessResponse,
    BonChargementsResponse,
    BonChargementDetailResponse,
    BalanceResponse,
    UpdateBalanceRequest,
    CreateBchRequest,
} from '@/types/dispatcher.types';

export const useDispatcherBonChargementsList = (filters?: { status?: string; livreur_id?: number; search?: string; page?: number }) => {
    const [data, setData] = useState<BonChargementsResponse | any | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonChargements.getList(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BCH');
            console.error('Failed to fetch BCH:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [filters?.status, filters?.livreur_id, filters?.search, filters?.page]);

    return { data, loading, error, refetch: fetchList };
};

export const useDispatcherBonChargementDetail = (bchId: number | null) => {
    const [data, setData] = useState<BonChargementDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = async () => {
        if (!bchId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonChargements.getById(bchId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BCH');
            console.error('Failed to fetch BCH:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [bchId]);

    return { data, loading, error, refetch: fetchDetail };
};

export const useDispatcherBchBalance = (bchId: number | null) => {
    const [data, setData] = useState<BalanceResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = async () => {
        if (!bchId) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await dispatcherApi.bonChargements.getBalance(bchId);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch balance');
            console.error('Failed to fetch balance:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBalance();
    }, [bchId]);

    return { data, loading, error, refetch: fetchBalance };
};

export const useDispatcherCreateBch = () => {
    const [loading, setLoading] = useState(false);

    const create = async (payload: CreateBchRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await dispatcherApi.bonChargements.create(payload);
        } finally {
            setLoading(false);
        }
    };

    return { create, loading };
};

export const useDispatcherValidateBch = () => {
    const [loading, setLoading] = useState(false);

    const validate = async (bchId: number): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await dispatcherApi.bonChargements.validate(bchId);
        } finally {
            setLoading(false);
        }
    };

    return { validate, loading };
};

export const useDispatcherUpdateBchBalance = () => {
    const [loading, setLoading] = useState(false);

    const update = async (bchId: number, payload: UpdateBalanceRequest): Promise<ApiSuccessResponse> => {
        setLoading(true);
        try {
            return await dispatcherApi.bonChargements.updateBalance(bchId, payload);
        } finally {
            setLoading(false);
        }
    };

    return { update, loading };
};
