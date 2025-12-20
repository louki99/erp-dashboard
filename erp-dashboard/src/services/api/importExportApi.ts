import apiClient from './client';
import type {
    Template,
    BatchOperation,
    BatchLog,
    BatchLogsResponse,
    BatchLogsFilters,
    CancelBatchRequest,
    CancelBatchResponse,
    RetryBatchResponse,
    ImportOptions,
    ExportOptions,
    ExportFilters,
    Statistics,
    UploadResponse,
    StartImportResponse,
    StartExportResponse
} from '@/types/importExport.types';

const BASE_URL = '/api/backend/dynamic-import-export';
const TEMPLATES_BASE = '/api/backend/templates';

// ==================== Template Management API ====================

export const templateApi = {
    /**
     * Get all templates with optional filters
     */
    getTemplates: async (params?: {
        type?: 'import' | 'export' | 'both';
        module?: string;
        object_code?: string;
        is_active?: boolean;
        search?: string;
    }) => {
        const response = await apiClient.get<{ success: boolean; templates: Template[] }>(
            TEMPLATES_BASE,
            { params }
        );
        return response.data;
    },

    /**
     * Get template details by ID or code
     */
    getTemplate: async (idOrCode: number | string) => {
        const response = await apiClient.get<{ success: boolean; template: Template }>(
            `${TEMPLATES_BASE}/${idOrCode}`
        );
        return response.data;
    },

    /**
     * Create new template
     */
    createTemplate: async (data: Partial<Template>) => {
        const response = await apiClient.post<{ success: boolean; template: Template }>(
            TEMPLATES_BASE,
            data
        );
        return response.data;
    },

    /**
     * Update existing template
     */
    updateTemplate: async (id: number, data: Partial<Template>) => {
        const response = await apiClient.put<{ success: boolean; template: Template }>(
            `${TEMPLATES_BASE}/${id}`,
            data
        );
        return response.data;
    },

    /**
     * Delete template
     */
    deleteTemplate: async (id: number) => {
        const response = await apiClient.delete<{ success: boolean; message: string }>(
            `${TEMPLATES_BASE}/${id}`
        );
        return response.data;
    },

    /**
     * Toggle template active status
     */
    toggleStatus: async (id: number) => {
        const response = await apiClient.post<{ success: boolean; message: string; is_active: boolean }>(
            `${TEMPLATES_BASE}/${id}/toggle-status`
        );
        return response.data;
    },

    /**
     * Generate template from database table
     */
    generateFromTable: async (data: { table_name: string; code: string; name: string }) => {
        const response = await apiClient.post<{ success: boolean; template: Template; message: string }>(
            `${TEMPLATES_BASE}/generate-from-table`,
            data
        );
        return response.data;
    },

    /**
     * Duplicate template
     */
    duplicateTemplate: async (id: number, data: { code: string; name: string }) => {
        const response = await apiClient.post<{ success: boolean; template: Template; message: string }>(
            `${TEMPLATES_BASE}/${id}/duplicate`,
            data
        );
        return response.data;
    },

    /**
     * Get template statistics
     */
    getTemplateStatistics: async (id: number) => {
        const response = await apiClient.get<{
            success: boolean;
            statistics: {
                total_batches: number;
                total_imports: number;
                total_exports: number;
                successful_batches: number;
                failed_batches: number;
                total_records_processed: number;
                total_records_successful: number;
                total_records_failed: number;
                last_execution: string;
            };
        }>(`${TEMPLATES_BASE}/${id}/statistics`);
        return response.data;
    },
};

// ==================== Import Operations API ====================

export const importApi = {
    /**
     * Upload file for import
     */
    uploadFile: async (templateCode: string, file: File) => {
        const formData = new FormData();
        formData.append('template_code', templateCode);
        formData.append('file', file);

        const response = await apiClient.post<{
            success: boolean;
            file_path: string;
            filename: string;
            message: string;
        }>(`${BASE_URL}/upload`, formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    /**
     * Start import process
     */
    startImport: async (data: {
        template_code: string;
        file_path: string;
        options?: ImportOptions;
        use_queue?: boolean;
    }) => {
        const response = await apiClient.post<{
            success: boolean;
            message: string;
            batch_id: string;
            status: string;
            summary?: any;
        }>(`${BASE_URL}/import/start`, data);
        return response.data;
    },

    /**
     * Get import status
     */
    getStatus: async (batchId: string) => {
        const response = await apiClient.get<{
            success: boolean;
            batch: BatchOperation;
            logs?: BatchLog[] | { data: BatchLog[] };
        }>(`${BASE_URL}/import/${batchId}/status`);
        return response.data;
    },

    /**
     * Get import logs
     */
    getLogs: async (batchId: string, params?: {
        status?: 'success' | 'failed' | 'skipped' | 'warning';
        per_page?: number;
        page?: number;
    }) => {
        const response = await apiClient.get<{
            success: boolean;
            logs: {
                current_page: number;
                data: BatchLog[];
                total: number;
                per_page: number;
                last_page: number;
                from: number;
                to: number;
            };
        }>(`${BASE_URL}/import/${batchId}/logs`, { params });
        return response.data;
    },

    /**
     * Download error report
     */
    downloadErrorReport: (batchId: string) => {
        window.location.href = `${BASE_URL}/import/${batchId}/error-report`;
    },
};

// ==================== Export Operations API ====================

export const exportApi = {
    /**
     * Start export process
     */
    startExport: async (data: {
        template_code: string;
        filters?: ExportFilters;
        options?: ExportOptions;
        use_queue?: boolean;
    }) => {
        const response = await apiClient.post<{
            success: boolean;
            message: string;
            batch_id: string;
            status: string;
        }>(`${BASE_URL}/export/start`, data);
        return response.data;
    },

    /**
     * Get export status
     */
    getStatus: async (batchId: string) => {
        const response = await apiClient.get<{
            success: boolean;
            batch: BatchOperation;
        }>(`${BASE_URL}/export/${batchId}/status`);
        return response.data;
    },

    /**
     * Download export file
     */
    downloadFile: async (batchId: string, format?: 'csv' | 'xlsx') => {
        try {
            const response = await apiClient.get(`${BASE_URL}/export/${batchId}/download`, {
                responseType: 'blob',
                params: format ? { format } : undefined
            });
            
            console.log('Download response headers:', response.headers);
            console.log('Content-Type:', response.headers['content-type']);
            console.log('Response data type:', typeof response.data);
            
            // Get filename from Content-Disposition header or use default
            const contentDisposition = response.headers['content-disposition'];
            let filename = `export_${batchId}.${format || 'xlsx'}`;
            
            if (contentDisposition) {
                const filenameMatch = contentDisposition.match(/filename="?(.+)"?/i);
                if (filenameMatch && filenameMatch[1]) {
                    filename = filenameMatch[1];
                }
            }
            
            // If format is specified but filename has wrong extension, fix it
            if (format) {
                const currentExt = filename.split('.').pop()?.toLowerCase();
                if (currentExt !== format) {
                    console.warn(`Filename extension mismatch: ${currentExt} vs ${format}. Fixing...`);
                    filename = filename.replace(/\.[^.]+$/, `.${format}`);
                }
            }
            
            console.log('Final filename:', filename);
            
            // Determine correct MIME type based on format
            let mimeType = response.headers['content-type'] || 'application/octet-stream';
            
            // Override MIME type if format is specified and doesn't match
            if (format === 'csv') {
                mimeType = 'text/csv;charset=utf-8';
                console.log('Forcing CSV MIME type');
            } else if (format === 'xlsx') {
                mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
                console.log('Forcing XLSX MIME type');
            }
            
            // Create blob with correct MIME type
            const blob = new Blob([response.data], { type: mimeType });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            return { success: true, filename };
        } catch (error: any) {
            console.error('Download failed:', error);
            throw new Error(error?.response?.data?.message || 'Échec du téléchargement du fichier');
        }
    },
};

// ==================== Batch Management API ====================

export const batchApi = {
    /**
     * Get all batches
     */
    getBatches: async (params?: {
        operation_type?: 'import' | 'export';
        template_id?: number;
        status?: string;
        user_id?: number;
        per_page?: number;
        page?: number;
    }) => {
        const response = await apiClient.get<{
            success: boolean;
            batches: {
                current_page: number;
                data: BatchOperation[];
                total: number;
                per_page: number;
                last_page: number;
            };
        }>(`${BASE_URL}/batches`, { params });
        return response.data;
    },

    /**
     * Get single batch by ID
     */
    getBatch: async (batchId: string) => {
        const response = await apiClient.get<{
            success: boolean;
            batch: BatchOperation;
        }>(`${BASE_URL}/batches/${batchId}`);
        return response.data;
    },

    /**
     * Delete batch
     */
    deleteBatch: async (batchId: string) => {
        const response = await apiClient.delete<{
            success: boolean;
            message: string;
        }>(`${BASE_URL}/batches/${batchId}`);
        return response.data;
    },

    /**
     * Get batch logs with filters and pagination
     */
    getBatchLogs: async (batchId: string, filters?: BatchLogsFilters) => {
        const response = await apiClient.get<BatchLogsResponse>(
            `${BASE_URL}/import/${batchId}/logs`,
            { params: filters }
        );
        return response.data;
    },

    /**
     * Cancel a batch operation
     */
    cancelBatch: async (batchId: string, request: CancelBatchRequest) => {
        const response = await apiClient.post<CancelBatchResponse>(
            `${BASE_URL}/batches/${batchId}/cancel`,
            request
        );
        return response.data;
    },

    /**
     * Retry a failed batch operation
     */
    retryBatch: async (batchId: string) => {
        const response = await apiClient.post<RetryBatchResponse>(
            `${BASE_URL}/batches/${batchId}/retry`
        );
        return response.data;
    },
};

// ==================== Statistics API ====================

export const statisticsApi = {
    /**
     * Get overall statistics
     */
    getStatistics: async (templateId?: number) => {
        const response = await apiClient.get<{
            success: boolean;
            statistics: Statistics;
        }>(`${BASE_URL}/statistics`, {
            params: templateId ? { template_id: templateId } : undefined,
        });
        return response.data;
    },
};

// ==================== Metadata API - Database Introspection ====================

export const metadataApi = {
    /**
     * Get all database tables (with encoded IDs for security)
     */
    getTables: async () => {
        const response = await apiClient.get<{
            success: boolean;
            database: string;
            schema: string;
            total_tables: number;
            tables: Array<{
                id: string;
                display_name: string;
                row_count: number;
                size: string;
                has_timestamps: boolean;
            }>;
        }>(`${BASE_URL}/metadata/tables`);
        return response.data;
    },

    /**
     * Get table column details using encoded table ID
     */
    getTableColumns: async (tableId: string) => {
        const response = await apiClient.get<{
            success: boolean;
            table_id: string;
            table_name: string;
            total_columns: number;
            columns: Array<{
                name: string;
                type: string;
                udt_name: string;
                laravel_type: string;
                max_length: number | null;
                numeric_precision: number | null;
                numeric_scale: number | null;
                nullable: boolean;
                default: string | null;
                is_primary_key: boolean;
                is_foreign_key: boolean;
                foreign_key: {
                    references_table: string;
                    references_column: string;
                } | null;
                is_unique: boolean;
            }>;
            primary_keys: string[];
            foreign_keys: Record<string, {
                references_table: string;
                references_column: string;
            }>;
            unique_columns: string[];
            indexes: Array<{
                name: string;
                column: string;
                unique: boolean;
                primary: boolean;
            }>;
        }>(`${BASE_URL}/metadata/tables/${tableId}/columns`);
        return response.data;
    },

    /**
     * Decode table ID to get actual table name (for internal use)
     */
    decodeTableId: (tableId: string): string => {
        try {
            const base64 = tableId.replace(/-/g, '+').replace(/_/g, '/');
            return atob(base64);
        } catch (error) {
            console.error('Failed to decode table ID:', error);
            return '';
        }
    },
};

// ==================== Combined Export ====================

export const importExportApi = {
    templates: templateApi,
    import: importApi,
    export: exportApi,
    batches: batchApi,
    statistics: statisticsApi,
    metadata: metadataApi,
};
