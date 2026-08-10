import apiClient from './client';
import type { ClientGroup, ClientGroupDashboard } from '@/types/partner.types';

const BASE = '/api/backend/client-groups';

export interface ClientGroupPayload {
    code: string;
    name: string;
    description?: string | null;
    default_discount_rate?: number | null;
    kam_user_id?: number | null;
    is_active?: boolean;
}

export const getClientGroups = async (): Promise<ClientGroup[]> => {
    const res = await apiClient.get(BASE);
    const d = res.data;
    if (Array.isArray(d)) return d;
    if (Array.isArray(d?.data)) return d.data;
    if (Array.isArray(d?.client_groups)) return d.client_groups;
    return [];
};

export const getClientGroup = async (id: number): Promise<ClientGroup> => {
    const res = await apiClient.get(`${BASE}/${id}`);
    return res.data?.client_group ?? res.data;
};

export const createClientGroup = async (data: ClientGroupPayload): Promise<ClientGroup> => {
    const res = await apiClient.post(BASE, data);
    return res.data?.client_group ?? res.data;
};

export const updateClientGroup = async (id: number, data: Partial<ClientGroupPayload>): Promise<ClientGroup> => {
    const res = await apiClient.put(`${BASE}/${id}`, data);
    return res.data?.client_group ?? res.data;
};

export const deleteClientGroup = async (id: number): Promise<void> => {
    await apiClient.delete(`${BASE}/${id}`);
};

export const getClientGroupDashboard = async (id: number): Promise<ClientGroupDashboard> => {
    const response = await apiClient.get<ClientGroupDashboard>(`${BASE}/${id}/dashboard`);
    return response.data;
};
