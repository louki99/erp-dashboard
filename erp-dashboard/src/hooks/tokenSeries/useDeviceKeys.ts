import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { AxiosError } from 'axios';
import * as tokenSeriesApi from '@/services/api/tokenSeriesApi';
import type {
    CreateDeviceKeyPayload,
    DeviceKey,
    DeviceKeyDeleteResponse,
    DeviceKeyFilters,
    DeviceKeyListResponse,
    DeviceKeyMessageResponse,
    PinOperationResult,
    RotateKeyPayload,
    SetPinPayload,
    UpdateDeviceKeyPayload,
} from '@/types/tokenSeries.types';

export const DEVICE_KEYS_BASE_KEY = ['device-keys'] as const;

export const deviceKeysKeys = {
    all: DEVICE_KEYS_BASE_KEY,
    lists: () => [...DEVICE_KEYS_BASE_KEY, 'list'] as const,
    list: (filters: DeviceKeyFilters) => [...deviceKeysKeys.lists(), filters] as const,
    detail: (id: number) => [...DEVICE_KEYS_BASE_KEY, 'detail', id] as const,
};

export function useDeviceKeys(filters: DeviceKeyFilters = {}) {
    return useQuery<DeviceKeyListResponse>({
        queryKey: deviceKeysKeys.list(filters),
        queryFn: () => tokenSeriesApi.getDeviceKeys(filters),
    });
}

export function useDeviceKey(id: number | null) {
    return useQuery<DeviceKey>({
        queryKey: id ? deviceKeysKeys.detail(id) : ['device-keys', 'detail', 'noop'],
        queryFn: () => tokenSeriesApi.getDeviceKey(id as number),
        enabled: !!id,
    });
}

export function useCreateDeviceKey() {
    const queryClient = useQueryClient();

    return useMutation<DeviceKey, AxiosError, CreateDeviceKeyPayload>({
        mutationFn: (payload) => tokenSeriesApi.createDeviceKey(payload),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
        },
    });
}

export function useUpdateDeviceKey(id: number) {
    const queryClient = useQueryClient();

    return useMutation<DeviceKey, AxiosError, UpdateDeviceKeyPayload>({
        mutationFn: (payload) => tokenSeriesApi.updateDeviceKey(id, payload),
        onSuccess: (deviceKey) => {
            queryClient.setQueryData(deviceKeysKeys.detail(id), deviceKey);
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
        },
    });
}

export function useDeleteDeviceKey() {
    const queryClient = useQueryClient();

    return useMutation<DeviceKeyDeleteResponse, AxiosError, { id: number; force?: boolean }>({
        mutationFn: ({ id, force }) => tokenSeriesApi.deleteDeviceKey(id, force),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
        },
    });
}

export function useRevokeDeviceKey() {
    const queryClient = useQueryClient();

    return useMutation<DeviceKeyMessageResponse, AxiosError, number>({
        mutationFn: (id) => tokenSeriesApi.revokeDeviceKey(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.detail(id) });
        },
    });
}

export function useRestoreDeviceKey() {
    const queryClient = useQueryClient();

    return useMutation<DeviceKeyMessageResponse, AxiosError, number>({
        mutationFn: (id) => tokenSeriesApi.restoreDeviceKey(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.detail(id) });
        },
    });
}

export function useRotateDeviceKey() {
    const queryClient = useQueryClient();

    return useMutation<DeviceKeyMessageResponse, AxiosError, { id: number; payload?: RotateKeyPayload }>({
        mutationFn: ({ id, payload }) => tokenSeriesApi.rotateDeviceKey(id, payload),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.detail(id) });
        },
    });
}

export function useResetDevicePin() {
    const queryClient = useQueryClient();

    return useMutation<{ message: string; data: PinOperationResult }, AxiosError, number>({
        mutationFn: (id) => tokenSeriesApi.resetDevicePin(id),
        onSuccess: (_, id) => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.detail(id) });
        },
    });
}

export function useSetDevicePin() {
    const queryClient = useQueryClient();

    return useMutation<{ message: string; data: PinOperationResult }, AxiosError, { id: number; payload: SetPinPayload }>({
        mutationFn: ({ id, payload }) => tokenSeriesApi.setDevicePin(id, payload),
        onSuccess: (_, { id }) => {
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.all });
            queryClient.invalidateQueries({ queryKey: deviceKeysKeys.detail(id) });
        },
    });
}
