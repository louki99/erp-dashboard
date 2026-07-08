import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataGrid } from '@/components/common/DataGrid';
import type { TokenSerie, TokenSerieListResponse } from '@/types/tokenSeries.types';
import { cn } from '@/lib/utils';

interface TokenSeriesTableProps {
    response?: TokenSerieListResponse;
    loading?: boolean;
    selected?: TokenSerie | null;
    onSelect: (serie: TokenSerie) => void;
    onPageChange: (page: number) => void;
}

function ScopeCellRenderer({ value, data }: { value: TokenSerie['scope']; data: TokenSerie }) {
    const label = value === 'global' ? 'Global' : value === 'branch' ? 'Branche' : 'Device';
    return (
        <div className="flex flex-col">
            <span className="font-medium">{label}</span>
            {value === 'branch' && data.allowed_branches && (
                <span className="text-[10px] text-muted-foreground">
                    {data.allowed_branches.join(', ')}
                </span>
            )}
        </div>
    );
}

function StatusCellRenderer({ data }: { data: TokenSerie }) {
    return (
        <div className="flex gap-1">
            {data.is_active ? (
                <Badge variant="success" className="text-[10px]">Actif</Badge>
            ) : (
                <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
            )}
            {data.is_default && <Badge variant="outline" className="text-[10px]">Défaut</Badge>}
            {data.auto_generated && <Badge variant="outline" className="text-[10px]">Auto</Badge>}
        </div>
    );
}

export function TokenSeriesTable({
    response,
    loading,
    selected,
    onSelect,
    onPageChange,
}: TokenSeriesTableProps) {
    const series = response?.data ?? [];
    const meta = response?.meta;
    const currentPage = meta?.current_page ?? 1;
    const lastPage = meta?.last_page ?? 1;
    const total = meta?.total ?? 0;

    const columnDefs = useMemo(
        () => [
            {
                field: 'code',
                headerName: 'Code',
                width: 100,
                cellClass: 'font-mono text-xs',
            },
            {
                field: 'name',
                headerName: 'Nom',
                minWidth: 140,
                flex: 1,
            },
            {
                field: 'scope',
                headerName: 'Scope',
                width: 120,
                cellRenderer: ScopeCellRenderer,
            },
            {
                headerName: 'Statut',
                width: 110,
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
                    rowData={series}
                    columnDefs={columnDefs}
                    loading={loading}
                    pagination={false}
                    rowSelection="single"
                    onRowSelected={onSelect}
                    getRowClass={(params: { data: TokenSerie }) =>
                        cn(params.data.code === selected?.code && 'bg-blue-50/80')
                    }
                />
            </div>

            <div className="border-t p-2">
                {lastPage > 1 && (
                    <div className="flex items-center justify-between gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            ‹
                        </Button>
                        <span className="text-[10px] text-muted-foreground">
                            {currentPage} / {lastPage}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= lastPage}
                        >
                            ›
                        </Button>
                    </div>
                )}

                {lastPage <= 1 && series.length > 0 && (
                    <div className="text-[10px] text-muted-foreground text-center">
                        {total} résultat{total > 1 ? 's' : ''}
                    </div>
                )}
            </div>
        </div>
    );
}
