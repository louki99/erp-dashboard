import apiClient from './client';
import type {
    OptimizeDispatchRequest,
    OptimizeDispatchResponse,
    ConfirmBatchResponse,
    CancelBatchResponse,
    BatchSummary,
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

// confirmed_by is derived from the Bearer token server-side — no body needed
export async function confirmBatch(batchId: string): Promise<ConfirmBatchResponse> {
    const { data } = await apiClient.post<ConfirmBatchResponse>(`${BASE}/batch/${batchId}/confirm`);
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

// Lightweight status check — use instead of getBatchTours when you only need lifecycle state
export async function getBatchSummary(batchId: string): Promise<BatchSummary> {
    const { data } = await apiClient.get<BatchSummary>(`${BASE}/batch/${batchId}`);
    return data;
}

// No request body — cancelled_by derived from Bearer token server-side.
// Safe to call twice on an already-cancelled batch (returns 200 again).
// 409 if already confirmed — gate UI to only show cancel while status is processing/completed.
export async function cancelBatch(batchId: string): Promise<CancelBatchResponse> {
    const { data } = await apiClient.post<CancelBatchResponse>(`${BASE}/batch/${batchId}/cancel`);
    return data;
}

