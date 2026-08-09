import apiClient from './client';
import type { DispatcherOrder } from '@/types/dispatcher.types';

export interface DispatcherSyncResponse {
    server_time: string;
    orders: {
        updated:     DispatcherOrder[];
        removed_ids: number[];
    };
}

export async function fetchDispatcherSync(updatedAfter?: string): Promise<DispatcherSyncResponse> {
    const params: Record<string, string> = {};
    if (updatedAfter) params.updated_after = updatedAfter;
    const { data } = await apiClient.get<DispatcherSyncResponse>(
        '/api/backend/dispatcher/sync',
        { params },
    );
    return data;
}
