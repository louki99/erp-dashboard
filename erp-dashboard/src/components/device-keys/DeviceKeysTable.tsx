import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/common/DataGrid';
import type { DeviceKey, DeviceKeyListResponse } from '@/types/tokenSeries.types';

interface DeviceKeysTableProps {
    response?: DeviceKeyListResponse;
    loading?: boolean;
    selected?: DeviceKey | null;
    onSelect: (device: DeviceKey) => void;
    onPageChange: (page: number) => void;
}

function getDotColor(d: DeviceKey): string {
    if (d.revoked_at) return '#ef4444';
    if (d.locked_until && new Date(d.locked_until) > new Date()) return '#f59e0b';
    if (d.activated_at) return '#10b981';
    return '#3b82f6';
}

export function DeviceKeysTable({
    response,
    loading,
    selected,
    onSelect,
    onPageChange,
}: DeviceKeysTableProps) {
    const devices = response?.data ?? [];
    const meta = response?.meta;
    const currentPage = meta?.current_page ?? 1;
    const lastPage = meta?.last_page ?? 1;
    const total = meta?.total ?? 0;

    const columnDefs = useMemo(
        () => [
            {
                colId: 'user',
                headerName: 'Utilisateur',
                flex: 1,
                minWidth: 120,
                resizable: false,
                cellRenderer: (p: any) => {
                    const d = p.data as DeviceKey;
                    return (
                        <div className="flex items-center gap-1.5 h-full">
                            <div
                                className="shrink-0"
                                style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: getDotColor(d) }}
                            />
                            <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }}>
                                {d?.user?.name ?? `User #${d?.user_id}`}
                            </span>
                        </div>
                    );
                },
            },
            {
                field: 'token_series_code',
                headerName: 'Série',
                width: 80,
                resizable: false,
                cellRenderer: (p: any) => (
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>
                        {p.value ?? '—'}
                    </span>
                ),
            },
        ],
        []
    );

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={devices}
                    columnDefs={columnDefs}
                    loading={loading}
                    pagination={false}
                    rowSelection="single"
                    suppressAutoFit
                    onRowClicked={(e: any) => { if (e.data) onSelect(e.data); }}
                    defaultSelectedIds={(row: any) => row.id === selected?.id}
                />
            </div>

            <div className="border-t p-2">
                {lastPage > 1 ? (
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline" size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >‹</Button>
                        <span className="text-[10px] text-muted-foreground">{currentPage} / {lastPage}</span>
                        <Button
                            variant="outline" size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= lastPage}
                        >›</Button>
                    </div>
                ) : devices.length > 0 ? (
                    <div className="text-[10px] text-muted-foreground text-center">
                        {total} résultat{total > 1 ? 's' : ''}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
