import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { PaginatedResponse, Decharge, ApiSuccessResponse } from '@/types/dispatcher.types';

export const useDispatcherDechargesList = (filters?: { type?: string; status?: string; page?: number }) => {
  const [data, setData] = useState<PaginatedResponse<Decharge> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.decharges.getList(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement décharges');
    } finally {
      setLoading(false);
    }
  }, [filters?.type, filters?.status, filters?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherDechargeDetail = (id: number | null) => {
  const [data, setData] = useState<Decharge | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.decharges.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement décharge');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useApproveDechargeReturn = () => {
  const [loading, setLoading] = useState(false);
  const approve = async (id: number, comment?: string): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.decharges.approveReturn(id, comment); }
    finally { setLoading(false); }
  };
  return { approve, loading };
};

export const useRejectDecharge = () => {
  const [loading, setLoading] = useState(false);
  const reject = async (id: number, reason: string): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.decharges.reject(id, reason); }
    finally { setLoading(false); }
  };
  return { reject, loading };
};
