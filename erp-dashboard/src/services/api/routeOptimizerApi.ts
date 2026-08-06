import apiClient from './client';
import type {
    OptimizeDispatchRequest,
    OptimizeDispatchResponse,
    ConfirmBatchResponse,
    OptimizedTour,
    OptimizerHealth,
} from '../../types/route-optimizer.types';

// ⚠️  Auth is not wired on the backend yet — will use the same Bearer token as the
// rest of the API once it lands. apiClient already attaches Authorization: Bearer <token>
// from localStorage, so no changes will be needed here when auth is enabled.
const BASE = '/api/v1';

export async function optimizeDispatch(payload: OptimizeDispatchRequest): Promise<OptimizeDispatchResponse> {
    const { data } = await apiClient.post<OptimizeDispatchResponse>(`${BASE}/optimize-dispatch`, payload);
    return data;
}

export async function confirmBatch(batchId: string, confirmedBy: number): Promise<ConfirmBatchResponse> {
    const { data } = await apiClient.post<ConfirmBatchResponse>(
        `${BASE}/batch/${batchId}/confirm`,
        { confirmed_by: confirmedBy },
    );
    return data;
}

export async function getBatchTours(batchId: string): Promise<OptimizedTour[]> {
    const { data } = await apiClient.get<OptimizedTour[]>(`${BASE}/batch/${batchId}/tours`);
    return data;
}

export async function getOptimizerHealth(): Promise<OptimizerHealth> {
    const { data } = await apiClient.get<OptimizerHealth>(`${BASE}/health`);
    return data;
}
