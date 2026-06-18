import { useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DispatcherDashboardData } from '@/types/dispatcher.types';

export const useDispatcherDashboard = () => {
  const [data, setData] = useState<DispatcherDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.dashboard.get());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement dashboard');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);
  return { data, loading, error, refetch: fetch };
};
