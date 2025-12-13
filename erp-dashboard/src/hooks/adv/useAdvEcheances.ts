import { useState, useEffect } from 'react';
import { advApi } from '@/services/api/advApi';
import type { PaginatedResponse, Echeance, EcheanceFilters } from '@/types/adv.types';

/**
 * Custom hook to fetch echeances (due dates) list
 * @param filters - Optional filters for echeances list
 * @returns Echeances list, loading state, error, and refetch function
 */
export const useAdvEcheances = (filters?: EcheanceFilters) => {
  const [data, setData] = useState<PaginatedResponse<Echeance> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEcheances = async () => {
    setLoading(true);
    setError(null);
    
    try {
      const echeancesData = await advApi.echeances.getList(filters);
      setData(echeancesData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch echeances');
      console.error('Failed to fetch echeances:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEcheances();
  }, [filters?.page, filters?.partner, filters?.date_from, filters?.date_to]);

  return { echeances: data, loading, error, refetch: fetchEcheances };
};
