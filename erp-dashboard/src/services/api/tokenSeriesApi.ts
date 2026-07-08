import apiClient from './client';
import type {
    CreateDeviceKeyPayload,
    CreateTokenSeriePayload,
    DeviceKey,
    DeviceKeyDeleteResponse,
    DeviceKeyFilters,
    DeviceKeyListResponse,
    DeviceKeyMessageResponse,
    DeviceKeySingleResponse,
    PinOperationResult,
    RotateKeyPayload,
    SetPinPayload,
    TokenSerie,
    TokenSerieConflictResponse,
    TokenSerieDeleteResponse,
    TokenSerieDetail,
    TokenSerieFilters,
    TokenSerieListResponse,
    TokenSerieSingleResponse,
    UpdateDeviceKeyPayload,
    UpdateTokenSeriePayload,
} from '@/types/tokenSeries.types';

const TOKEN_SERIES_BASE = '/api/backend/access-control/token-series';
const DEVICE_KEYS_BASE = '/api/backend/access-control/device-keys';

// ─── Token Series ────────────────────────────────────────────────────────────

export const getTokenSeries = async (filters: TokenSerieFilters = {}): Promise<TokenSerieListResponse> => {
    const response = await apiClient.get<TokenSerieListResponse>(TOKEN_SERIES_BASE, { params: filters });
    return response.data;
};

export const getTokenSerie = async (code: string): Promise<TokenSerieDetail> => {
    const response = await apiClient.get<TokenSerieDetail>(`${TOKEN_SERIES_BASE}/${code}`);
    return response.data;
};

export const createTokenSerie = async (payload: CreateTokenSeriePayload): Promise<TokenSerie> => {
    const response = await apiClient.post<TokenSerieSingleResponse>(TOKEN_SERIES_BASE, payload);
    return response.data.data;
};

export const updateTokenSerie = async (code: string, payload: UpdateTokenSeriePayload): Promise<TokenSerie> => {
    const response = await apiClient.put<TokenSerieSingleResponse>(`${TOKEN_SERIES_BASE}/${code}`, payload);
    return response.data.data;
};

export const deleteTokenSerie = async (code: string): Promise<TokenSerieDeleteResponse | TokenSerieConflictResponse> => {
    const response = await apiClient.delete<TokenSerieDeleteResponse | TokenSerieConflictResponse>(`${TOKEN_SERIES_BASE}/${code}`);
    return response.data;
};

// ─── Device Keys ─────────────────────────────────────────────────────────────

export const getDeviceKeys = async (filters: DeviceKeyFilters = {}): Promise<DeviceKeyListResponse> => {
    const response = await apiClient.get<DeviceKeyListResponse>(DEVICE_KEYS_BASE, { params: filters });
    return response.data;
};

export const getDeviceKey = async (id: number): Promise<DeviceKey> => {
    const response = await apiClient.get<DeviceKeySingleResponse>(`${DEVICE_KEYS_BASE}/${id}`);
    return response.data.data;
};

export const createDeviceKey = async (payload: CreateDeviceKeyPayload): Promise<DeviceKey> => {
    const response = await apiClient.post<DeviceKeySingleResponse>(DEVICE_KEYS_BASE, payload);
    return response.data.data;
};

export const updateDeviceKey = async (id: number, payload: UpdateDeviceKeyPayload): Promise<DeviceKey> => {
    const response = await apiClient.put<DeviceKeySingleResponse>(`${DEVICE_KEYS_BASE}/${id}`, payload);
    return response.data.data;
};

export const deleteDeviceKey = async (id: number, force = false): Promise<DeviceKeyDeleteResponse> => {
    const response = await apiClient.delete<DeviceKeyDeleteResponse>(`${DEVICE_KEYS_BASE}/${id}`, {
        params: force ? { force: 1 } : {},
    });
    return response.data;
};

export const revokeDeviceKey = async (id: number): Promise<DeviceKeyMessageResponse> => {
    const response = await apiClient.post<DeviceKeyMessageResponse>(`${DEVICE_KEYS_BASE}/${id}/revoke`);
    return response.data;
};

export const restoreDeviceKey = async (id: number): Promise<DeviceKeyMessageResponse> => {
    const response = await apiClient.post<DeviceKeyMessageResponse>(`${DEVICE_KEYS_BASE}/${id}/restore`);
    return response.data;
};

export const rotateDeviceKey = async (id: number, payload: RotateKeyPayload = {}): Promise<DeviceKeyMessageResponse> => {
    const response = await apiClient.post<DeviceKeyMessageResponse>(`${DEVICE_KEYS_BASE}/${id}/rotate`, payload);
    return response.data;
};

export const resetDevicePin = async (id: number): Promise<{ message: string; data: PinOperationResult }> => {
    const response = await apiClient.post<{ message: string; data: PinOperationResult }>(`${DEVICE_KEYS_BASE}/${id}/reset-pin`);
    return response.data;
};

export const setDevicePin = async (id: number, payload: SetPinPayload): Promise<{ message: string; data: PinOperationResult }> => {
    const response = await apiClient.post<{ message: string; data: PinOperationResult }>(`${DEVICE_KEYS_BASE}/${id}/set-pin`, payload);
    return response.data;
};
