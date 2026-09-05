import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { DataGrid } from '@/components/common/DataGrid';
import type { SalesSouche, SalesSoucheListResponse } from '@/types/salesSouches.types';

interface SalesSouchesTableProps {
    response?: SalesSoucheListResponse;
    loading?: boolean;
    selected?: SalesSouche | null;
    onSelect: (souche: SalesSouche) => void;
    onPageChange: (page: number) => void;
}

export function SalesSouchesTable({
    response,
    loading,
    selected,
    onSelect,
    onPageChange,
}: SalesSouchesTableProps) {
    const souches = response?.data ?? [];
    const meta = response?.meta;
    const currentPage = meta?.current_page ?? 1;
    const lastPage = meta?.last_page ?? 1;
    const total = meta?.total ?? 0;

    const columnDefs = useMemo(() => [
        {
            colId: 'code',
            headerName: 'Code',
            width: 110,
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
            minWidth: 130,
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
                </div>
            ),
        },
        {
            colId: 'fiscal_type',
            headerName: 'Type',
            width: 90,
            resizable: false,
            cellRenderer: (p: any) => {
                const declared = p.data?.fiscal_type === 'declared';
                return (
                    <span
                        className="text-[10px] font-medium rounded px-1.5 py-0.5 border"
                        style={declared
                            ? { color: '#1d4ed8', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }
                            : { color: '#6b7280', backgroundColor: '#f9fafb', borderColor: '#e5e7eb' }}
                    >
                        {declared ? 'Déclarée' : 'Interne'}
                    </span>
                );
            },
        },
        {
            colId: 'branch_code',
            headerName: 'Branche',
            width: 100,
            resizable: false,
            cellRenderer: (p: any) => (
                <span style={{ fontSize: '11px', color: '#374151' }}>
                    {p.data?.branch_code ?? 'Globale'}
                </span>
            ),
        },
        {
            colId: 'token_serie',
            headerName: 'Série',
            width: 110,
            resizable: false,
            cellRenderer: (p: any) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#374151' }}>
                    {p.data?.token_serie?.code ?? `#${p.data?.token_serie_id}`}
                </span>
            ),
        },
    ], []);

    return (
        <div className="flex h-full flex-col">
            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={souches}
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
                ) : souches.length > 0 ? (
                    <div className="text-[10px] text-muted-foreground text-center">
                        {total} résultat{total > 1 ? 's' : ''}
                    </div>
                ) : null}
            </div>
        </div>
    );
}
