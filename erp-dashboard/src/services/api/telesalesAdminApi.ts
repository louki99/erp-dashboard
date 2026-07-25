import apiClient from './client';
import type {
    CreateScheduleRequest,
    CreateScheduleResponse,
    SchedulesListFilters,
    SchedulesListResponse,
    BulkScheduleRequest,
    BulkScheduleResponse,
    DeleteScheduleResponse,
    CreateAssignmentRequest,
    CreateAssignmentResponse,
    AssignmentsListFilters,
    AssignmentsListResponse,
    MonitoringSessionsResponse,
    MonitoringKpisResponse,
} from '@/types/telesales.types';

// Lot 1 — Admin/Superviseur. Note the `admin/` segment: distinct from
// /api/backend/telesales/... (Lot 2, agent-facing) — role admin|root only.
const TELESALES_ADMIN_BASE = '/api/backend/admin/telesales';

export const telesalesAdminApi = {
    schedules: {
        // Landed 2026-08 (fix requested after Lot 1 review) — partner/agent already joined server-side.
        getList: async (params?: SchedulesListFilters): Promise<SchedulesListResponse> => {
            const response = await apiClient.get<SchedulesListResponse>(`${TELESALES_ADMIN_BASE}/schedules`, { params });
            return response.data;
        },

        create: async (data: CreateScheduleRequest): Promise<CreateScheduleResponse> => {
            const response = await apiClient.post<CreateScheduleResponse>(`${TELESALES_ADMIN_BASE}/schedules`, data);
            return response.data;
        },

        bulkCreate: async (data: BulkScheduleRequest): Promise<BulkScheduleResponse> => {
            const response = await apiClient.post<BulkScheduleResponse>(`${TELESALES_ADMIN_BASE}/schedules/bulk`, data);
            return response.data;
        },

        remove: async (id: number): Promise<DeleteScheduleResponse> => {
            const response = await apiClient.delete<DeleteScheduleResponse>(`${TELESALES_ADMIN_BASE}/schedules/${id}`);
            return response.data;
        },
    },

    assignments: {
        // Landed 2026-08 (fix requested after Lot 1 review) — partner/agent already joined server-side.
        getList: async (params?: AssignmentsListFilters): Promise<AssignmentsListResponse> => {
            const response = await apiClient.get<AssignmentsListResponse>(`${TELESALES_ADMIN_BASE}/assignments`, { params });
            return response.data;
        },

        create: async (data: CreateAssignmentRequest): Promise<CreateAssignmentResponse> => {
            const response = await apiClient.post<CreateAssignmentResponse>(`${TELESALES_ADMIN_BASE}/assignments`, data);
            return response.data;
        },
    },

    monitoring: {
        getSessions: async (): Promise<MonitoringSessionsResponse> => {
            const response = await apiClient.get<MonitoringSessionsResponse>(`${TELESALES_ADMIN_BASE}/monitoring/sessions`);
            return response.data;
        },

        getKpis: async (params?: { date_from?: string; date_to?: string }): Promise<MonitoringKpisResponse> => {
            const response = await apiClient.get<MonitoringKpisResponse>(`${TELESALES_ADMIN_BASE}/monitoring/kpis`, { params });
            return response.data;
        },
    },
};
