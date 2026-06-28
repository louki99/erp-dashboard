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

// ⚠️ WORKAROUND: there is NO `GET /backend/dispatcher/delivery-missions` list endpoint anywhere
// in the docs (flagged to backend as a real gap, see end-of-migration summary). create_delivery_
// mission/confirm_delivery_mission/start/complete/update/cancel are decisions on the mission
// itself; the old per-BL `allocate_delivery_note` and `generate_preparation_for_mission` were
// REMOVED 2026-06-22 — confirm_delivery_mission now does both atomically (see ConfirmDeliveryMissionOutput).
// Until that exists, the mission list is derived client-side: fetch BLs (§7.1, confirmed working,
// unaffected by the migration), collect their distinct `delivery_mission_id`s, then fetch each
// mission's full detail (§8.8). This is N+1 and only surfaces missions that have at least one BL
// (true for every mission, since create_delivery_mission always generates BLs in the same call —
// so this should never miss a mission in practice, just costs extra round-trips).
export const useDeliveryMissionsList = (filters?: { status?: string }) => {
  const [data, setData] = useState<DeliveryMission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const blPage = await dispatcherApi.bonLivraisons.getList({ per_page: 200 });
      const missionIds = Array.from(
        new Set(
          (blPage.data ?? [])
            .map((bl) => bl.delivery_mission_id)
            .filter((id): id is number => id != null)
        )
      );
      const details = await Promise.all(
        missionIds.map((id) => dispatcherApi.deliveryMissions.getDetail(id).catch(() => null))
      );
      let missions = details
        .filter((d): d is DeliveryMissionDetailResponse => d != null && d.mission != null)
        .map((d) => {
          return { ...d.mission, delivery_notes: d.delivery_notes, preparation_order: d.preparation_order };
        });
      if (filters?.status) {
        missions = missions.filter((m) => m.status === filters.status);
      }
      setData(missions);
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

