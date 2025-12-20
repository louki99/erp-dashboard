export interface Template {
    id: number;
    code: string;
    name: string;
    type: 'import' | 'export' | 'both';
    object_code: string;
    object_name: string;
    primary_table: string;
    module: string;
    description: string | null;
    file_type: 'csv' | 'xlsx' | 'xls' | 'txt';
    field_separator: string;
    decimal_separator: string;
    date_format: string;
    charset: string;
    record_separator: string;
    allow_import: boolean;
    allow_update: boolean;
    allow_workflow: boolean;
    is_special_import: boolean;
    allow_export: boolean;
    export_chrono: number;
    is_active: boolean;
    is_system: boolean;
    created_by: number | null;
    updated_by: number | null;
    created_at: string;
    updated_at: string;
    deleted_at: string | null;
    fields?: TemplateField[];
    creator?: User;
}

export interface TemplateField {
    id: number;
    template_id: number;
    level: number;
    sequence: number;
    indicator: string;
    table_name: string;
    field_name: string;
    label: string;
    link: string | null;
    data_type: 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'text';
    input_output: 'input' | 'output' | 'both';
    is_required: boolean;
    is_identifier: boolean;
    is_readonly: boolean;
    validation_rule: string | null;
    default_value: string | null;
    max_length: number | null;
    format: string | null;
    transformation: string | null;
    value_mapping: Record<string, any> | null;
    is_visible: boolean;
    help_text: string | null;
    created_at: string;
    updated_at: string;
    column_index?: number;
    display_name?: string;
    field_type?: string;
    source_table?: string;
    source_column?: string;
}

export interface BatchOperation {
    id: number;
    batch_id: string;
    template_id: number;
    template?: Template;
    operation_type: 'import' | 'export';
    filename: string;
    format?: string;
    status: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    job_status?: string;
    total_records: number;
    processed_records: number;
    successful_records: number;
    failed_records: number;
    skipped_records: number;
    created_records?: number;
    updated_records?: number;
    progress_percentage: number;
    success_rate: number;
    file_path?: string;
    download_url?: string;
    started_at: string | null;
    completed_at: string | null;
    execution_time: number | null;
    error_summary: string | null;
    user_id: number;
    user?: User;
    created_at: string;
    updated_at: string;
}

export interface BatchLog {
    id: number;
    batch_id: string;
    record_number: number;
    record_identifier: string | null;
    status: 'created' | 'updated' | 'success' | 'failed' | 'skipped' | 'warning';
    action: 'create' | 'update' | 'created' | 'updated' | 'skipped' | null;
    product_id: number | null;
    record_data: Record<string, any>;
    processed_data: Record<string, any> | null;
    errors: Record<string, string[]> | string | null;
    warnings: Record<string, string> | null;
    message: string | null;
    affected_tables: string[] | null;
    affected_records: number[] | null;
    created_at: string;
}

export interface BatchLogsResponse {
    success: boolean;
    batch: {
        batch_id: string;
        template: string;
        operation_type: 'import' | 'export';
        status: string;
        filename: string;
        user: string;
        started_at: string | null;
        completed_at: string | null;
        execution_time: number | null;
    };
    stats: {
        total: number;
        success: number;
        failed: number;
        skipped: number;
        warning: number;
    };
    logs: {
        current_page: number;
        data: BatchLog[];
        per_page: number;
        total: number;
        last_page: number;
    };
}

export interface BatchLogsFilters {
    status?: 'created' | 'updated' | 'success' | 'failed' | 'skipped' | 'warning';
    search?: string;
    per_page?: number;
    page?: number;
    sort_by?: 'record_number' | 'status' | 'created_at';
    sort_order?: 'asc' | 'desc';
}

export interface ImportOptions {
    update_existing?: boolean;
    skip_errors?: boolean;
    validate_only?: boolean;
    batch_size?: number;
}

export interface ExportOptions {
    format?: 'xlsx' | 'csv';
    include_headers?: boolean;
    batch_size?: number;
}

export interface ExportFilters {
    [key: string]: any;
}

export interface Statistics {
    imports: {
        total: number;
        completed: number;
        failed: number;
        processing: number;
        total_records_processed: number;
        total_records_successful: number;
        total_records_failed: number;
    };
    exports: {
        total: number;
        completed: number;
        failed: number;
        processing: number;
        total_records_exported: number;
    };
}

export interface User {
    id: number;
    name: string;
    email: string;
}

export interface TemplateFilters {
    type?: 'import' | 'export' | 'both';
    module?: string;
    object_code?: string;
    is_active?: boolean;
    search?: string;
}

export interface BatchFilters {
    operation_type?: 'import' | 'export';
    template_id?: number;
    status?: 'pending' | 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    user_id?: number;
    per_page?: number;
    page?: number;
}

export interface UploadResponse {
    success: boolean;
    file_path: string;
    filename: string;
    message: string;
}

export interface StartImportResponse {
    success: boolean;
    message: string;
    batch_id: string;
    status: string;
    summary?: BatchOperation;
}

export interface StartExportResponse {
    success: boolean;
    message: string;
    batch_id: string;
    status: string;
}

export type BatchLogStatus = 'created' | 'updated' | 'success' | 'failed' | 'skipped' | 'warning';
export type BatchLogAction = 'create' | 'update' | 'created' | 'updated' | 'skipped';

export interface CancelBatchRequest {
    reason: string;
}

export interface CancelBatchResponse {
    success: boolean;
    message: string;
    batch: {
        batch_id: string;
        status: string;
        error_summary: string;
        execution_time: number;
    };
}

export interface RetryBatchResponse {
    success: boolean;
    message: string;
    original_batch_id: string;
    new_batch_id: string;
    new_batch: {
        batch_id: string;
        status: string;
        template: string;
    };
}
