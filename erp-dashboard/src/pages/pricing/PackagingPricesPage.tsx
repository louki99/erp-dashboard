import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Plus,
    Edit2,
    Trash2,
    RefreshCw,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { PricingPageShell } from '@/components/pricing/PricingPageShell';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';

import {
    usePackagingPrices,
    useCreatePackagingPrice,
    useUpdatePackagingPrice,
    useDeletePackagingPrice,
} from '@/hooks/pricing/usePricing';
import { ModalPackagingPrice } from './PricingModals';
import type { PackagingPrice, CreatePackagingPriceRequest } from '@/types/pricing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

type CellParams = { value: unknown; data?: PackagingPrice };

export function PackagingPricesPage() {
    const { t } = useTranslation();
    const [filters] = useState({ page: 1, per_page: 20 });
    const { data, loading, error, refetch } = usePackagingPrices(filters);
    const { createPackagingPrice, loading: creating } = useCreatePackagingPrice();
    const { updatePackagingPrice, loading: updating } = useUpdatePackagingPrice();
    const { deletePackagingPrice, loading: deleting } = useDeletePackagingPrice();

    const [isOpen, setIsOpen] = useState(false);
    const [editing, setEditing] = useState<PackagingPrice | null>(null);
    const [form, setForm] = useState<Partial<CreatePackagingPriceRequest>>({});

    const prices = data?.data ?? [];

    const handleCreate = () => {
        setEditing(null);
        setForm({ line_detail_id: undefined, packaging_id: undefined, sales_price: undefined, return_price: undefined });
        setIsOpen(true);
    };

    const handleEdit = (p: PackagingPrice) => {
        setEditing(p);
        setForm({
            line_detail_id: p.line_detail_id,
            packaging_id: p.packaging_id,
            sales_price: p.sales_price,
            return_price: p.return_price,
        });
        setIsOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm(t('pricing.packagingPrices.deleteConfirm'))) return;
        try {
            await deletePackagingPrice(id);
            toast.success(t('pricing.packagingPrices.deleteSuccess'));
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleSubmit = async () => {
        try {
            if (editing) {
                await updatePackagingPrice({ id: editing.id, data: form });
                toast.success(t('pricing.packagingPrices.updateSuccess'));
            } else {
                await createPackagingPrice(form as CreatePackagingPriceRequest);
                toast.success(t('pricing.packagingPrices.createSuccess'));
            }
            setIsOpen(false);
            refetch();
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const columnDefs = useMemo(
        () => [
            {
                field: 'line_detail_id',
                headerName: t('pricing.packagingPrices.lineDetail'),
                minWidth: 120,
                cellRenderer: (params: CellParams) => <span className="text-xs font-mono text-gray-600">#{Number(params.value ?? 0)}</span>,
            },
            {
                field: 'packaging',
                headerName: t('pricing.packagingPrices.packaging'),
                minWidth: 180,
                cellRenderer: (params: CellParams) => {
                    const p = params.data as PackagingPrice;
                    return (
                        <div>
                            <div className="text-sm font-medium text-gray-900">{p.packaging?.name || `Packaging #${p.packaging_id}`}</div>
                            <div className="text-[11px] text-gray-500 font-mono">{p.packaging?.code}</div>
                        </div>
                    );
                },
            },
            {
                field: 'packaging.quantity',
                headerName: t('common.quantity'),
                minWidth: 90,
                cellRenderer: (params: CellParams) => {
                    const p = params.data as PackagingPrice;
                    return <span className="text-xs text-gray-500">{p.packaging?.quantity ?? '—'}</span>;
                },
            },
            {
                field: 'sales_price',
                headerName: t('pricing.packagingPrices.salesPrice'),
                minWidth: 120,
                cellRenderer: (params: CellParams) => <span className="text-sm font-semibold text-emerald-700">{Number(params.value ?? 0).toFixed(2)}</span>,
            },
            {
                field: 'return_price',
                headerName: t('pricing.packagingPrices.returnPrice'),
                minWidth: 120,
                cellRenderer: (params: CellParams) => <span className="text-sm text-gray-600">{Number(params.value ?? 0).toFixed(2)}</span>,
            },
            {
                headerName: t('common.actions'),
                minWidth: 100,
                sortable: false,
                filter: false,
                cellRenderer: (params: CellParams) => {
                    const p = params.data as PackagingPrice;
                    return (
                        <div className="flex items-center justify-end gap-1">
                            <button
                                onClick={() => handleEdit(p)}
                                className="p-1.5 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                title={t('common.edit')}
                            >
                                <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                                onClick={() => handleDelete(p.id)}
                                className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title={t('common.delete')}
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    );
                },
            },
        ],
        [t]
    );

    const actions: ActionItemProps[] = [
        { icon: Plus, label: t('pricing.packagingPrices.create'), variant: 'sage', onClick: handleCreate },
        { icon: RefreshCw, label: t('common.refresh'), onClick: refetch, disabled: loading },
    ];

    return (
        <>
            <MasterLayout
                mainContent={
                    <PricingPageShell
                        title={t('pricing.packagingPrices.title')}
                        subtitle={t('pricing.packagingPrices.subtitle')}
                    >
                        <div className="h-full flex flex-col">
                            <div className="flex-1 p-4 overflow-hidden">
                                {error ? (
                                    <div className="h-full flex flex-col items-center justify-center text-red-600 gap-2">
                                        <p className="text-sm">{error}</p>
                                        <Button variant="outline" size="sm" onClick={refetch}>
                                            <RefreshCw className="w-4 h-4 mr-1.5" /> {t('common.retry')}
                                        </Button>
                                    </div>
                                ) : (
                                    <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                        <DataGrid
                                            rowData={prices}
                                            columnDefs={columnDefs}
                                            loading={loading}
                                            pagination
                                            paginationPageSize={20}
                                            suppressAutoFit
                                        />
                                    </div>
                                )}
                            </div>
                        </div>
                    </PricingPageShell>
                }
                rightContent={<ActionPanel groups={[{ items: actions }]} />}
            />
            {isOpen && (
                <ModalPackagingPrice
                    editingPackaging={editing}
                    form={form}
                    setForm={setForm}
                    onClose={() => setIsOpen(false)}
                    onSubmit={handleSubmit}
                    loading={creating || updating || deleting}
                />
            )}
        </>
    );
}
