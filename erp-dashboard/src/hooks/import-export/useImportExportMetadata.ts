import { useQuery } from '@tanstack/react-query';
import { importExportApi } from '@/services/api/importExportApi';

// DB schema introspection (/metadata/tables, /metadata/tables/{id}/columns)
// barely changes during a work session and the tables response is heavy —
// cached aggressively so opening the field-mapping modal repeatedly (once
// per table/column picked while building a template) doesn't re-hit the
// endpoint every time. Same query key used by the page and the modal, so
// whichever fetches first primes the cache for the other.
const STALE_TIME = 30 * 60 * 1000;

export const importExportMetadataKeys = {
    all: ['import-export-metadata'] as const,
    tables: () => [...importExportMetadataKeys.all, 'tables'] as const,
    tableColumns: (tableId: string) => [...importExportMetadataKeys.all, 'columns', tableId] as const,
};

export const useDbTables = () =>
    useQuery({
        queryKey: importExportMetadataKeys.tables(),
        queryFn: () => importExportApi.metadata.getTables(),
        staleTime: STALE_TIME,
        gcTime: STALE_TIME,
    });

export const useDbTableColumns = (tableId: string | null) =>
    useQuery({
        queryKey: importExportMetadataKeys.tableColumns(tableId ?? ''),
        queryFn: () => importExportApi.metadata.getTableColumns(tableId!),
        enabled: !!tableId,
        staleTime: STALE_TIME,
        gcTime: STALE_TIME,
    });
