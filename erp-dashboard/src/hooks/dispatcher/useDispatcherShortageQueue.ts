import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { PaginatedResponse, PreparationOrder } from '@/types/dispatcher.types';

export const useDispatcherShortageQueue = (params?: { page?: number }) => {
  const [data, setData] = useState<PaginatedResponse<PreparationOrder> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.preparations.getShortageQueue(params));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement file de ruptures');
    } finally {
      setLoading(false);
    }
  }, [params?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};
