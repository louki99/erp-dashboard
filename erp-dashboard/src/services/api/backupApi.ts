import apiClient from './client';
import type {
    BackupListData,
    BackupOperation,
    BackupSchedule,
    CreateSchedulePayload,
    UpdateSchedulePayload,
} from '../../types/backup.types';

const BASE = '/api/backend/admin/backups';

export async function listBackups(): Promise<BackupListData> {
    const response = await apiClient.get<{ data: BackupListData }>(BASE);
    return response.data.data;
}

export async function createBackup(): Promise<{ operation_id: number }> {
    const response = await apiClient.post<{ data: { operation_id: number } }>(BASE);
    return response.data.data;
}

export async function pollOperation(id: number): Promise<BackupOperation> {
    const response = await apiClient.get<{ data: BackupOperation }>(`${BASE}/operations/${id}`);
    return response.data.data;
}

export async function deleteBackup(path: string): Promise<void> {
    await apiClient.delete(BASE, { data: { path } });
}

export async function restoreBackup(path: string): Promise<{ operation_id: number }> {
    const response = await apiClient.post<{ data: { operation_id: number } }>(`${BASE}/restore`, {
        path,
        confirm: 'RESTORE',
    });
    return response.data.data;
}

export async function listSchedules(): Promise<BackupSchedule[]> {
    const response = await apiClient.get<{ data: BackupSchedule[] }>(`${BASE}/schedules`);
    return response.data.data;
}

export async function createSchedule(payload: CreateSchedulePayload): Promise<BackupSchedule> {
    const response = await apiClient.post<{ data: BackupSchedule }>(`${BASE}/schedules`, payload);
    return response.data.data;
}

export async function updateSchedule(id: number, payload: UpdateSchedulePayload): Promise<BackupSchedule> {
    const response = await apiClient.put<{ data: BackupSchedule }>(`${BASE}/schedules/${id}`, payload);
    return response.data.data;
}

export async function deleteSchedule(id: number): Promise<void> {
    await apiClient.delete(`${BASE}/schedules/${id}`);
}

export async function runScheduleNow(id: number): Promise<{ operation_id: number }> {
    const response = await apiClient.post<{ data: { operation_id: number } }>(`${BASE}/schedules/${id}/run-now`);
    return response.data.data;
}

export async function cancelOperation(id: number): Promise<{ operation_id: number; warning: string | null }> {
    const response = await apiClient.post<{ data: { operation_id: number; warning: string | null } }>(
        `${BASE}/operations/${id}/cancel`,
    );
    return response.data.data;
}
