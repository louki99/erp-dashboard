import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
  BchIndexResponse,
  Shipment,
  BalanceAnalysis,
  ApiSuccessResponse,
  CreateBchPayload,
  UpdateBchPayload,
  SaveBalancePayload,
} from '@/types/dispatcher.types';

export const useDispatcherBonChargementsList = (filters?: {
  status?: string;
  rider_id?: number;
  search?: string;
  page?: number;
}) => {
  const [data, setData] = useState<BchIndexResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonChargements.getList(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BCH');
    } finally {
      setLoading(false);
    }
  }, [filters?.status, filters?.rider_id, filters?.search, filters?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherBonChargementDetail = (bchId: number | null) => {
  const [data, setData] = useState<Shipment | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!bchId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonChargements.getById(bchId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement BCH');
    } finally {
      setLoading(false);
    }
  }, [bchId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherBchBalance = (bchId: number | null) => {
  const [data, setData] = useState<BalanceAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!bchId) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.bonChargements.getBalance(bchId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement balance');
    } finally {
      setLoading(false);
    }
  }, [bchId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherCreateBch = () => {
  const [loading, setLoading] = useState(false);
  const create = async (payload: CreateBchPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.create(payload); }
    finally { setLoading(false); }
  };
  return { create, loading };
};

export const useDispatcherUpdateBch = () => {
  const [loading, setLoading] = useState(false);
  const update = async (id: number, payload: UpdateBchPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.update(id, payload); }
    finally { setLoading(false); }
  };
  return { update, loading };
};

export const useDispatcherSubmitBch = () => {
  const [loading, setLoading] = useState(false);
  const submit = async (id: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.submit(id); }
    finally { setLoading(false); }
  };
  return { submit, loading };
};

export const useDispatcherResubmitBch = () => {
  const [loading, setLoading] = useState(false);
  const resubmit = async (id: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.resubmit(id); }
    finally { setLoading(false); }
  };
  return { resubmit, loading };
};

export const useDispatcherValidateBch = () => {
  const [loading, setLoading] = useState(false);
  const validate = async (id: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.validateShipment(id); }
    finally { setLoading(false); }
  };
  return { validate, loading };
};

export const useDispatcherCancelBch = () => {
  const [loading, setLoading] = useState(false);
  const cancel = async (id: number, reason: string): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.cancel(id, reason); }
    finally { setLoading(false); }
  };
  return { cancel, loading };
};

export const useDispatcherSaveBalance = () => {
  const [loading, setLoading] = useState(false);
  const save = async (id: number, payload: SaveBalancePayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.saveBalance(id, payload); }
    finally { setLoading(false); }
  };
  return { save, loading };
};

export const useDispatcherPrintBch = () => {
  const [loading, setLoading] = useState(false);
  const print = async (id: number): Promise<unknown> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.print(id); }
    finally { setLoading(false); }
  };
  return { print, loading };
};

export const useDispatcherAddBlToBch = () => {
  const [loading, setLoading] = useState(false);
  const addBls = async (id: number, blIds: number[]): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.addBls(id, blIds); }
    finally { setLoading(false); }
  };
  return { addBls, loading };
};

export const useDispatcherRemoveBlFromBch = () => {
  const [loading, setLoading] = useState(false);
  const removeBl = async (id: number, blId: number): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.bonChargements.removeBl(id, blId); }
    finally { setLoading(false); }
  };
  return { removeBl, loading };
};
