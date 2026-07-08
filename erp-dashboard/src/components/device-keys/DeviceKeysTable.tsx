import { useMemo } from 'react';
import { Badge } from '@/components/ui/badge';
import { DataGrid } from '@/components/common/DataGrid';
import type { DeviceKey, DeviceKeyListResponse } from '@/types/tokenSeries.types';
import { cn } from '@/lib/utils';

interface DeviceKeysTableProps {
    response?: DeviceKeyListResponse;
    loading?: boolean;
    selected?: DeviceKey | null;
    onSelect: (device: DeviceKey) => void;
    onPageChange: (page: number) => void;
}

function StatusCellRenderer({ data }: { data: DeviceKey }) {
    const isRevoked = !!data.revoked_at;
    const isLocked = !!data.locked_until && new Date(data.locked_until) > new Date();

    if (isRevoked) return <Badge variant="destructive" className="text-[10px]">Révoqué</Badge>;
    if (isLocked) return <Badge variant="outline" className="text-[10px] border-orange-400 text-orange-600">Verrouillé</Badge>;
    if (data.activated_at) return <Badge variant="success" className="text-[10px]">Activé</Badge>;
    return <Badge variant="secondary" className="text-[10px]">Actif</Badge>;
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
                field: 'user.name',
                headerName: 'Utilisateur',
                minWidth: 120,
                flex: 1,
                valueGetter: (params: { data: DeviceKey }) => params.data.user?.name ?? `User #${params.data.user_id}`,
            },
            {
                field: 'token_series_code',
                headerName: 'Série',
                width: 90,
            },
            {
                headerName: 'Statut',
                width: 90,
                sortable: false,
                filter: false,
                cellRenderer: StatusCellRenderer,
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
                    onRowSelected={onSelect}
                    getRowClass={(params: { data: DeviceKey }) =>
                        cn(params.data.id === selected?.id && 'bg-blue-50/80')
                    }
                />
            </div>

            <div className="border-t p-2">
                {lastPage > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <button
                            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            ‹
                        </button>
                        <span className="text-[10px] text-muted-foreground">
                            {currentPage} / {lastPage}
                        </span>
                        <button
                            className="rounded border px-2 py-1 text-xs disabled:opacity-50"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= lastPage}
                        >
                            ›
                        </button>
                    </div>
                )}

                {lastPage <= 1 && devices.length > 0 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                        {total} résultat{total > 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
