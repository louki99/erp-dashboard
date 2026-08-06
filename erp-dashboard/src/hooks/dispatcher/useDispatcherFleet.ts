import { useCallback, useEffect, useState } from 'react';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { ApiSuccessResponse, RiderWithVehicles, Vehicle, CreateVehiclePayload, UpdateVehiclePayload } from '@/types/dispatcher.types';

export const useRidersWithVehicles = (filters?: { branch_code?: string; status?: string; search?: string }) => {
  const [data, setData] = useState<RiderWithVehicles[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setData(await dispatcherApi.fleet.getRidersWithVehicles(filters));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erreur chargement flotte');
      setData([]);
    } finally {
      setLoading(false);
    }
  }, [filters?.branch_code, filters?.status, filters?.search]);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, error, refetch: fetch };
};

export const useFleetVehicles = () => {
  const [data, setData] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      setData(await dispatcherApi.vehicles.getList());
    } catch {
      setData([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);
  return { data, loading, refetch: fetch };
};

export const useToggleRiderActive = () => {
  const [loading, setLoading] = useState(false);
  const toggle = async (id: number) => {
    setLoading(true);
    try { return await dispatcherApi.fleet.toggleRiderActive(id); }
    finally { setLoading(false); }
  };
  return { toggle, loading };
};

export const useAssignVehicle = () => {
  const [loading, setLoading] = useState(false);
  const assign = async (
    vehicleId: number,
    userId: number,
    extra?: { starts_at?: string; notes?: string; role?: 'van_seller' | 'delivery_agent' }
  ): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.fleet.assignVehicle(vehicleId, userId, extra); }
    finally { setLoading(false); }
  };
  return { assign, loading };
};

export const useUnassignVehicle = () => {
  const [loading, setLoading] = useState(false);
  const unassign = async (vehicleId: number, extra?: { ends_at?: string; notes?: string }): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.fleet.unassignVehicle(vehicleId, extra); }
    finally { setLoading(false); }
  };
  return { unassign, loading };
};

export const useUpdateAssignment = () => {
  const [loading, setLoading] = useState(false);
  const update = async (
    vehicleId: number,
    payload: { notes?: string; ends_at?: string; is_active?: boolean }
  ): Promise<ApiSuccessResponse> => {
    setLoading(true);
    try { return await dispatcherApi.fleet.updateAssignment(vehicleId, payload); }
    finally { setLoading(false); }
  };
  return { update, loading };
};

export const useCreateVehicle = () => {
  const [loading, setLoading] = useState(false);
  const create = async (payload: CreateVehiclePayload) => {
    setLoading(true);
    try { return await dispatcherApi.vehicles.create(payload); }
    finally { setLoading(false); }
  };
  return { create, loading };
};

export const useUpdateVehicle = () => {
  const [loading, setLoading] = useState(false);
  const update = async (id: number, payload: UpdateVehiclePayload) => {
    setLoading(true);
    try { return await dispatcherApi.vehicles.update(id, payload); }
    finally { setLoading(false); }
  };
  return { update, loading };
};

export const useRetireVehicle = () => {
  const [loading, setLoading] = useState(false);
  const retire = async (id: number) => {
    setLoading(true);
    try { return await dispatcherApi.vehicles.retire(id); }
    finally { setLoading(false); }
  };
  return { retire, loading };
};
