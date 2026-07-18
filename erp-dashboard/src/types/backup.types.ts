export type OperationStatus = 'pending' | 'running' | 'completed' | 'failed';
export type OperationType = 'backup' | 'restore';

export interface BackupFile {
    path: string;
    filename: string;
    size_bytes: number;
    created_at: string;
    download_url: string;
}

export interface BackupOperation {
    id: number;
    type: OperationType;
    status: OperationStatus;
    disk: string | null;
    path: string | null;
    size_bytes: number | null;
    initiated_by: number | null;
    backup_schedule_id?: number | null;
    error: string | null;
    started_at: string | null;
    finished_at: string | null;
    created_at: string;
    updated_at: string;
}

export interface BackupListData {
    backups: BackupFile[];
    recent_operations: BackupOperation[];
}

export interface BackupSchedule {
    id: number;
    label: string | null;
    is_active: boolean;
    days_of_week: number[];
    trigger_time: string;
    schedule_label: string;
    last_triggered_at: string | null;
    created_by: number;
    created_at: string;
    updated_at: string;
}

export interface CreateSchedulePayload {
    label?: string;
    is_active?: boolean;
    days_of_week?: number[];
    trigger_time: string;
}

export interface UpdateSchedulePayload {
    label?: string;
    is_active?: boolean;
    days_of_week?: number[];
    trigger_time?: string;
}
