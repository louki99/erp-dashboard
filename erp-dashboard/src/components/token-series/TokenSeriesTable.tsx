import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/common/DataGrid';
import type { TokenSerie, TokenSerieListResponse } from '@/types/tokenSeries.types';
import { Globe, Building2, Smartphone } from 'lucide-react';

interface TokenSeriesTableProps {
    response?: TokenSerieListResponse;
    loading?: boolean;
    selected?: TokenSerie | null;
    onSelect: (serie: TokenSerie) => void;
    onPageChange: (page: number) => void;
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

    const columnDefs = useMemo(() => [
        {
            colId: 'code',
            headerName: 'Code',
            width: 120,
            sortable: true,
            resizable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-1.5 h-full">
                    <div
                        className="shrink-0"
                        style={{
                            width: 7, height: 7, borderRadius: '50%',
                            backgroundColor: p.data?.is_active ? '#10b981' : '#d1d5db',
                        }}
                    />
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>
                        {p.data?.code ?? '—'}
                    </span>
                </div>
            ),
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            minWidth: 120,
            resizable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-1.5 h-full min-w-0">
                    <span style={{ fontSize: '12px', fontWeight: 500, color: '#111827' }} className="truncate">
                        {p.data?.name}
                    </span>
                    {p.data?.is_default && (
                        <span className="shrink-0 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-1">
                            Défaut
                        </span>
                    )}
                    {p.data?.auto_generated && (
                        <span className="shrink-0 text-[10px] font-medium text-gray-500 bg-gray-100 border border-gray-200 rounded px-1">
                            Auto
                        </span>
                    )}
                </div>
            ),
        },
        {
            colId: 'scope',
            headerName: 'Scope',
            width: 90,
            resizable: false,
            cellRenderer: (p: any) => {
                const scope = p.data?.scope;
                const Icon = scope === 'global' ? Globe : scope === 'branch' ? Building2 : Smartphone;
                const label = scope === 'global' ? 'Global' : scope === 'branch' ? 'Branche' : 'Device';
                const color = scope === 'global' ? '#3b82f6' : scope === 'branch' ? '#f59e0b' : '#10b981';
                return (
                    <div className="flex items-center gap-1.5 h-full">
                        <Icon style={{ width: 12, height: 12, color, flexShrink: 0 }} />
                        <span style={{ fontSize: '11px', color: '#374151' }}>{label}</span>
                    </div>
                );
            },
        },
    ], []);

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={series}
                    columnDefs={columnDefs}
                    loading={loading}
                    pagination={false}
                    rowSelection="single"
                    suppressAutoFit
                    onRowClicked={(e: any) => { if (e.data) onSelect(e.data); }}
                    defaultSelectedIds={(row: any) => row.code === selected?.code}
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
                ) : series.length > 0 ? (
                    <div className="text-[10px] text-muted-foreground text-center">
                        {total} résultat{total > 1 ? 's' : ''}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
