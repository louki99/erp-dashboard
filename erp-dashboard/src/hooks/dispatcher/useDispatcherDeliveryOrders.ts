import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { PaginatedResponse, DeliveryOrder, DoDecisionsResponse } from '@/types/dispatcher.types';

export const useDispatcherDeliveryOrdersList = (filters?: {
  status?: string;
  search?: string;
  page?: number;
  per_page?: number;
}) => {
  const [data, setData] = useState<PaginatedResponse<DeliveryOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.deliveryOrders.getList(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement DOs');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.search, filters?.page, filters?.per_page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherDeliveryOrderDetail = (id: number | null) => {
  const [data, setData] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.deliveryOrders.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement DO');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDoDecisions = (id: number | null) => {
  const [data, setData] = useState<DoDecisionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    try {
      setData(await dispatcherApi.deliveryOrders.getDecisions(id));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
};

export const useExecuteDoDecision = () => {
  const [loading, setLoading] = useState(false);

  const execute = async (id: number, decision: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    try {
      return await dispatcherApi.deliveryOrders.executeDecision(id, decision, extra);
    } finally {
      setLoading(false);
    }
  };

  return { execute, loading };
};
