import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type {
  MissionPlanningTemplate,
  MissionPlanningRun,
  MissionPlanningCalendarEvent,
  PaginatedResponse,
  CreateMissionPlanningTemplatePayload,
  UpdateMissionPlanningTemplatePayload,
} from '@/types/dispatcher.types';

export const useMissionPlanningTemplates = (params?: { is_active?: boolean; page?: number }) => {
  const [data, setData] = useState<PaginatedResponse<MissionPlanningTemplate> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.missionPlanningTemplates.getList(params));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement templates');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [params?.is_active, params?.page]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useMissionPlanningRuns = (templateId: number | null) => {
  const [data, setData] = useState<MissionPlanningRun[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    if (!templateId) { setData([]); return; }
    setLoading(true);
    setError(null);
    try {
      const runs = await dispatcherApi.missionPlanningRuns.getList({ template_id: templateId });
      setData(Array.isArray(runs) ? runs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement historique');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [templateId]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useCreateMissionPlanningTemplate = () => {
  const [loading, setLoading] = useState(false);
  const create = async (payload: CreateMissionPlanningTemplatePayload) => {
    setLoading(true);
    try { return await dispatcherApi.missionPlanningTemplates.create(payload); }
    finally { setLoading(false); }
  };
  return { create, loading };
};

export const useUpdateMissionPlanningTemplate = () => {
  const [loading, setLoading] = useState(false);
  const update = async (id: number, payload: UpdateMissionPlanningTemplatePayload) => {
    setLoading(true);
    try { return await dispatcherApi.missionPlanningTemplates.update(id, payload); }
    finally { setLoading(false); }
  };
  return { update, loading };
};

export const useDeleteMissionPlanningTemplate = () => {
  const [loading, setLoading] = useState(false);
  const remove = async (id: number) => {
    setLoading(true);
    try { return await dispatcherApi.missionPlanningTemplates.delete(id); }
    finally { setLoading(false); }
  };
  return { remove, loading };
};

export const useCommercials = () => {
  const [data, setData] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dispatcherApi.commercials.getList()
      .then(setData)
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading };
};

export const useMissionPlanningCalendar = (startDate: string, endDate: string) => {
  const [data, setData] = useState<MissionPlanningCalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.missionPlanningCalendar.getList({ start_date: startDate, end_date: endDate }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement calendrier');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useDispatcherPartners = (search?: string) => {
  const [data, setData] = useState<Array<{ id: number; name: string; code?: string }>>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await dispatcherApi.dispatcherPartners.getList({ per_page: 200, search }));
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
};
