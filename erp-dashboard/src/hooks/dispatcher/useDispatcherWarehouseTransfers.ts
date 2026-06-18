import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { PaginatedResponse, WarehouseTransfer, ApiSuccessResponse } from '@/types/dispatcher.types';

export const useDispatcherWarehouseTransfersList = (filters?: {
  status?: string;
  sync_status?: string;
  rider_id?: number;
  page?: number;
}) => {
  const [data, setData] = useState<PaginatedResponse<WarehouseTransfer> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.warehouseTransfers.getList(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement transferts');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.sync_status, filters?.rider_id, filters?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherWarehouseTransferDetail = (id: number | null) => {
  const [data, setData] = useState<WarehouseTransfer | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.warehouseTransfers.getById(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement transfert');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

// Only real creation path — a WT is generated from a completed BCH, never authored manually
// (docs §12c, corrected 2026-06-17).
export const useCreateWarehouseTransferFromBch = () => {
  const [loading, setLoading] = useState(false);
  const createFromBch = async (bchId: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.warehouseTransfers.createFromBch(bchId); }
    finally { setLoading(false); }
  };
  return { createFromBch, loading };
};

export const useAcceptWarehouseTransfer = () => {
  const [loading, setLoading] = useState(false);
  const accept = async (id: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.warehouseTransfers.accept(id); }
    finally { setLoading(false); }
  };
  return { accept, loading };
};

export const useRejectWarehouseTransfer = () => {
  const [loading, setLoading] = useState(false);
  const reject = async (id: number, reason: string): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.warehouseTransfers.reject(id, reason); }
    finally { setLoading(false); }
  };
  return { reject, loading };
};
