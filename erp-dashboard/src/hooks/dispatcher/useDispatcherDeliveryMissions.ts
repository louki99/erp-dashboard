import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
  ApiSuccessResponse,
  CreateDeliveryMissionPayload,
  DeliveryMission,
  DeliveryMissionDetailResponse,
  DoDecisionsResponse,
  WorkflowContextResponse,
} from '@/types/dispatcher.types';

// Uses GET /dispatcher/delivery-missions (available since 2026-07). Returns all branch-scoped
// missions including auto-planned ones (rider: null). Enriches each row with delivery_notes +
// preparation_order from the detail endpoint in a parallel batch.
export const useDeliveryMissionsList = (filters?: { status?: string }) => {
  const [data, setData] = useState<DeliveryMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const list = await dispatcherApi.deliveryMissions.getList({
        status: filters?.status,
        per_page: 100,
      });
      // Enrich each mission with delivery_notes + preparation_order from the detail endpoint.
      const details = await Promise.all(
        list.map((m) => dispatcherApi.deliveryMissions.getDetail(m.id).catch(() => null))
      );
      const enriched = list.map((m) => {
        const detail = details.find((d) => d?.mission?.id === m.id);
        return {
          ...m,
          ...(detail?.mission ?? {}),
          delivery_notes: detail?.delivery_notes ?? [],
          preparation_order: detail?.preparation_order ?? null,
        };
      });
      setData(enriched);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement missions');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.status]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDeliveryMissionContext = (id: number | null) => {
  const [data, setData] = useState<WorkflowContextResponse<DeliveryMissionDetailResponse> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.deliveryMissions.getContext(id));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement mission context');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useCreateDeliveryMission = () => {
  const [loading, setLoading] = useState(false);
  const create = async (payload: CreateDeliveryMissionPayload): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.deliveryMissions.create(payload); }
    finally { setLoading(false); }
  };
  return { create, loading };
};

export const useMissionDecisions = (id: number | null) => {
  const [data, setData] = useState<DoDecisionsResponse | null>(null);
  const [loading, setLoading] = useState(false);

  const fetch = useCallback(async () => {
    if (!id) { setData(null); return; }
    setLoading(true);
    try { setData(await dispatcherApi.deliveryMissions.getDecisions(id)); }
    catch { setData(null); }
    finally { setLoading(false); }
  }, [id]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
};

export const useExecuteMissionDecision = () => {
  const [loading, setLoading] = useState(false);
  const execute = async (id: number, decision: string, extra?: Record<string, unknown>) => {
    setLoading(true);
    try { return await dispatcherApi.deliveryMissions.executeDecision(id, decision, extra); }
    finally { setLoading(false); }
  };
  return { execute, loading };
};
