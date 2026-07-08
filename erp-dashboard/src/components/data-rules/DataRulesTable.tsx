import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit2, Trash2 } from 'lucide-react';
import { DataGrid } from '@/components/common/DataGrid';
import type { DataRule, DataRuleListResponse } from '@/types/dataRules.types';
import { getActionLabel } from '@/lib/dataRules';

interface DataRulesTableProps {
    response?: DataRuleListResponse;
    loading?: boolean;
    onEdit: (rule: DataRule) => void;
    onDelete: (rule: DataRule) => void;
    onPageChange: (page: number) => void;
}

interface ActionsCellRendererProps {
    data: DataRule;
    onEdit: (rule: DataRule) => void;
    onDelete: (rule: DataRule) => void;
}

function ActionsCellRenderer({ data, onEdit, onDelete }: ActionsCellRendererProps) {
    return (
        <div className="flex justify-end gap-2">
            <Button variant="ghost" size="icon" onClick={() => onEdit(data)}>
                <Edit2 className="h-4 w-4" />
            </Button>
            <Button
                variant="ghost"
                size="icon"
                className="text-destructive hover:text-destructive"
                onClick={() => onDelete(data)}
            >
                <Trash2 className="h-4 w-4" />
            </Button>
        </div>
    );
}

function ActionCellRenderer({ value }: { value: DataRule['action'] }) {
    return <Badge variant={value === 'allow' ? 'success' : 'destructive'}>{getActionLabel(value)}</Badge>;
}

function ResourceCellRenderer({ data }: { data: DataRule }) {
    if (data.model_id === null) {
        return <span className="italic text-muted-foreground">wildcard (toutes)</span>;
    }
    return <span>{data.resource_label}</span>;
}

export function DataRulesTable({ response, loading, onEdit, onDelete, onPageChange }: DataRulesTableProps) {
    const rules = response?.data ?? [];
    const meta = response?.meta;
    const currentPage = meta?.current_page ?? 1;
    const lastPage = meta?.last_page ?? 1;
    const total = meta?.total ?? 0;
    const perPage = meta?.per_page ?? 50;

    const columnDefs = useMemo(
        () => [
            {
                field: 'id',
                headerName: 'ID',
                width: 80,
                cellClass: 'font-mono text-xs',
            },
            {
                field: 'model_type_label',
                headerName: 'Type de modèle',
                minWidth: 180,
                flex: 1,
            },
            {
                headerName: 'Ressource',
                minWidth: 180,
                flex: 1,
                cellRenderer: ResourceCellRenderer,
            },
            {
                field: 'scope_type',
                headerName: 'Scope',
                width: 120,
            },
            {
                field: 'scope_label',
                headerName: 'Valeur',
                minWidth: 180,
                flex: 1,
            },
            {
                field: 'action',
                headerName: 'Action',
                width: 120,
                cellRenderer: ActionCellRenderer,
            },
            {
                headerName: 'Actions',
                width: 120,
                sortable: false,
                filter: false,
                cellRenderer: ActionsCellRenderer,
                cellRendererParams: { onEdit, onDelete },
            },
        ],
        [onEdit, onDelete]
    );

    return (
        <div className="space-y-3">
            <div className="rounded-lg border bg-card shadow-sm">
                <div className="h-[500px] w-full">
                    <DataGrid
                        rowData={rules}
                        columnDefs={columnDefs}
                        loading={loading}
                        pagination={false}
                        rowSelection="single"
                    />
                </div>
            </div>

            {lastPage > 1 && (
                <div className="flex items-center justify-between rounded-lg border bg-card px-4 py-3 shadow-sm">
                    <div className="text-xs text-muted-foreground">
                        {total} résultat{total > 1 ? 's' : ''} · page {currentPage} / {lastPage}
                    </div>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage - 1)}
                            disabled={currentPage <= 1}
                        >
                            Précédent
                        </Button>
                        <span className="text-xs text-muted-foreground">
                            {currentPage} / {lastPage}
                        </span>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onPageChange(currentPage + 1)}
                            disabled={currentPage >= lastPage}
                        >
                            Suivant
                        </Button>
                    </div>
                </div>
            )}

            {lastPage <= 1 && rules.length > 0 && (
                <div className="text-xs text-muted-foreground">
                    {total} résultat{total > 1 ? 's' : ''} · {perPage} par page
                </div>
            )}
        </div>
    );
}
