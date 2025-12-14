import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { BonChargementsResponse, BonChargementDetailResponse, CreateBchRequest, BalanceResponse, UpdateBalanceRequest } from '@/types/dispatcher.types';

export const useDispatcherBchList = (filters?: { status?: string; livreur_id?: number; search?: string; page?: number }) => {
    const [data, setData] = useState<BonChargementsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchBchs = async () => {
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.bonChargements.getList(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BCHs');
            console.error('Failed to fetch BCHs:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBchs();
    }, [filters?.status, filters?.livreur_id, filters?.search, filters?.page]);

    return { data, loading, error, refetch: fetchBchs };
};

export const useDispatcherBchDetail = (bchId: number | null) => {
    const [data, setData] = useState<BonChargementDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBch = async () => {
        if (!bchId) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.bonChargements.getById(bchId);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BCH');
            console.error('Failed to fetch BCH:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBch();
    }, [bchId]);

    return { data, loading, error, refetch: fetchBch };
};

export const useDispatcherBchEdit = (bchId: number | null) => {
    const [data, setData] = useState<BonChargementDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBch = async () => {
        if (!bchId) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.bonChargements.edit(bchId);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch BCH for edit');
            console.error('Failed to fetch BCH for edit:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchBch();
    }, [bchId]);

    return { data, loading, error, refetch: fetchBch };
};

export const useCreateBch = () => {
    const [loading, setLoading] = useState(false);

    const create = async (data: CreateBchRequest) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.create(data);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { create, loading };
};

export const useUpdateBch = () => {
    const [loading, setLoading] = useState(false);

    const update = async (bchId: number, data: { livreur_id?: number; notes?: string }) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.update(bchId, data);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { update, loading };
};

export const useValidateBch = () => {
    const [loading, setLoading] = useState(false);

    const validate = async (bchId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.validate(bchId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { validate, loading };
};

export const useSubmitBch = () => {
    const [loading, setLoading] = useState(false);

    const submit = async (bchId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.submit(bchId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { submit, loading };
};

export const useResubmitBch = () => {
    const [loading, setLoading] = useState(false);

    const resubmit = async (bchId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.resubmit(bchId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { resubmit, loading };
};

export const useCancelBch = () => {
    const [loading, setLoading] = useState(false);

    const cancel = async (bchId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.cancel(bchId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { cancel, loading };
};

export const useDispatcherBchBalance = (bchId: number | null) => {
    const [data, setData] = useState<BalanceResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchBalance = async () => {
        if (!bchId) return;
        
        setLoading(true);
        setError(null);

        try {
            const response = await dispatcherApi.bonChargements.getBalance(bchId);
            setData(response);
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

export const useUpdateBchBalance = () => {
    const [loading, setLoading] = useState(false);

    const updateBalance = async (bchId: number, data: UpdateBalanceRequest) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.updateBalance(bchId, data);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { updateBalance, loading };
};

export const usePrintBch = () => {
    const [loading, setLoading] = useState(false);

    const print = async (bchId: number) => {
        setLoading(true);
        try {
            const response = await dispatcherApi.bonChargements.print(bchId);
            return response;
        } catch (err) {
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { print, loading };
};
