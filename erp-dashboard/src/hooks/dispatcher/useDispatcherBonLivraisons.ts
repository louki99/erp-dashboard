import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
  PaginatedResponse,
  DeliveryNote,
  ApiSuccessResponse,
  UpdateBlPayload,
  SplitBlPayload,
  CancelBlPayload,
} from '@/types/dispatcher.types';

export const useDispatcherBonLivraisonsList = (filters?: {
  status?: string;
  rider_id?: number;
  search?: string;
  page?: number;
}) => {
  const [data, setData] = useState<PaginatedResponse<DeliveryNote> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonLivraisons.getList(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BLs');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.rider_id, filters?.search, filters?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

// §7.2/§7.3 (`/draft`, `/confirmed` sub-routes) — fixed 2026-06-23, functional again.
// These hooks use the generic list (§7.1) which is equivalent and handles both statuses fine.
export const useDispatcherDraftBonLivraisons = () => {
  const [data, setData] = useState<PaginatedResponse<DeliveryNote> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonLivraisons.getList({ status: 'draft' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BLs brouillon');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherConfirmedBonLivraisons = () => {
  const [data, setData] = useState<PaginatedResponse<DeliveryNote> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonLivraisons.getList({ status: 'confirmed' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BLs confirmés');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, []);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherBonLivraisonDetail = (blId: number | null) => {
  const [data, setData] = useState<DeliveryNote | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!blId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonLivraisons.getById(blId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BL');
    } finally {
      setLoading(false);
    }
  }, [blId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherUpdateBonLivraison = () => {
  const [loading, setLoading] = useState(false);
  const update = async (id: number, payload: UpdateBlPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonLivraisons.update(id, payload); }
    finally { setLoading(false); }
  };
  return { update, loading };
};

export const useDispatcherSplitBonLivraison = () => {
  const [loading, setLoading] = useState(false);
  const split = async (id: number, payload: SplitBlPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonLivraisons.split(id, payload); }
    finally { setLoading(false); }
  };
  return { split, loading };
};

export const useDispatcherCancelBonLivraison = () => {
  const [loading, setLoading] = useState(false);
  const cancel = async (id: number, payload: CancelBlPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonLivraisons.cancel(id, payload); }
    finally { setLoading(false); }
  };
  return { cancel, loading };
};

export const useDispatcherBlDecision = () => {
  const [loading, setLoading] = useState(false);
  const execute = async (id: number, decision: string, extra?: Record<string, unknown>): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonLivraisons.executeDecision(id, decision, extra); }
    finally { setLoading(false); }
  };
  return { execute, loading };
};
