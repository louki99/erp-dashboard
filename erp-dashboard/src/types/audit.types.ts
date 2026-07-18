// ─── Activity Log ─────────────────────────────────────────────────────────────

export interface ActivityLogUser {
    id: number;
    name: string;
    email: string;
}

export interface ActivityLog {
    id: number;
    auditable_type: string | null;
    auditable_id: number | string | null;
    event: string;
    audit_level: 'standard' | 'medium' | 'advanced';
    user_id: number | null;
    user_role: string | null;
    action_intent: string | null;
    old_values: Record<string, any> | null;
    new_values: Record<string, any> | null;
    description: string | null;
    ip_address: string | null;
    user_agent: string | null;
    correlation_id: string | null;
    module_context: string | null;
    created_at: string;
    user: ActivityLogUser | null;
}

export interface ActivityDiffEntry {
    attribute: string;
    old: any;
    new: any;
}

export interface ActivityDetailResponse {
    data: ActivityLog;
    diff: ActivityDiffEntry[];
}

export interface PaginatedActivityLogs {
    current_page: number;
    data: ActivityLog[];
    total: number;
    per_page: number;
    last_page: number;
}

export interface ActivityFilters {
    page?: number;
    per_page?: number;
    user_id?: number;
    entity_type?: string;
    action?: string;
    audit_level?: 'standard' | 'medium' | 'advanced' | '';
    user_role?: string;
    module_context?: string;
    changed_field?: string;
    correlation_id?: string;
    date_from?: string;
    date_to?: string;
}

// ─── Anomalies ────────────────────────────────────────────────────────────────

export type AnomalySeverity = 'CRITICAL' | 'WARNING';

export interface AnomalyLog {
    id: number;
    error_code: string;
    error_severity: AnomalySeverity;
    source: string;
    reference_type: string | null;
    reference_id: number | string | null;
    context_payload: Record<string, any> | null;
    user_id: number | null;
    created_at: string;
}

export interface PaginatedAnomalyLogs {
    current_page: number;
    data: AnomalyLog[];
    total: number;
    per_page: number;
    last_page: number;
}

export interface AnomalyFilters {
    page?: number;
    per_page?: number;
    error_severity?: AnomalySeverity | '';
    error_code?: string;
    source?: string;
    reference_type?: string;
    user_id?: number;
    date_from?: string;
    date_to?: string;
}

// ─── Export ───────────────────────────────────────────────────────────────────

export type ExportFormat = 'csv' | 'json';
export type ExportSource = 'activities' | 'anomalies';

export interface ExportRequest {
    date_from: string;
    date_to: string;
    source: ExportSource;
    format: ExportFormat;
    module_context?: string;
}

export interface ExportResponse {
    filename: string;
    download_url: string;
    expires_in_hours: number;
}

// ─── Purge ────────────────────────────────────────────────────────────────────

export type PurgeTarget = 'activities' | 'anomalies' | 'all';

export interface PurgeRequest {
    older_than_months: number;
    target: PurgeTarget;
}

export interface PurgeArchive {
    filename: string;
    download_url: string;
}

export interface PurgeTargetResult {
    purged_count: number;
    archive: PurgeArchive | null;
}

export interface PurgeResponse {
    activities?: PurgeTargetResult;
    anomalies?: PurgeTargetResult;
}

// ─── DB Deletion Log ─────────────────────────────────────────────────────────

export interface DbDeletion {
    id: number;
    table_name: string;
    record_id: string;
    deleted_row: Record<string, any>;
    deleted_by_user_id: number | null;
    correlation_id: string | null;
    db_transaction_id: number;
    created_at: string;
}

export interface PaginatedDbDeletions {
    current_page: number;
    data: DbDeletion[];
    total: number;
    per_page: number;
    last_page: number;
}

export interface DbDeletionFilters {
    page?: number;
    per_page?: number;
    table_name?: string;
    correlation_id?: string;
    db_transaction_id?: number;
    date_from?: string;
    date_to?: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export type AuditLevel = 'standard' | 'medium' | 'advanced';

export interface AuditSettings {
    audit_level: AuditLevel;
    updated_at?: string;
}

export interface UpdateAuditSettingsRequest {
    audit_level: AuditLevel;
}
