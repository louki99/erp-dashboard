import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, ArrowRightLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import { useDispatcherPendingOrders } from '@/hooks/dispatcher/useDispatcherOrders';
import type { DispatcherOrder } from '@/types/dispatcher.types';

export const DispatcherOrdersPage = () => {
    const [selected, setSelected] = useState<DispatcherOrder | null>(null);
    const { data, loading, error, refetch } = useDispatcherPendingOrders();

    const rowData = data?.data || [];

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'id', headerName: 'ID', width: 90 },
            { field: 'bc_number', headerName: 'BC', width: 140 },
            { field: 'order_code', headerName: 'Commande', width: 140 },
            { field: 'partner.name', headerName: 'Client', flex: 1 },
            { field: 'total_amount', headerName: 'Total', width: 140 },
            { field: 'bc_status', headerName: 'Statut', width: 160 },
            { field: 'created_at', headerName: 'Date', width: 160 },
        ],
        []
    );

    const convertToBl = async () => {
        if (!selected?.id) return;
        try {
            const res = await dispatcherApi.orders.convertToBl(selected.id);
            if (res.success) {
                toast.success(res.message || 'Converti en BL');
            } else {
                toast.error(res.message || 'Conversion échouée');
            }
            refetch();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Conversion échouée');
        }
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h1 className="text-sm font-semibold text-gray-900">Commandes en attente (BC)</h1>
                        <p className="text-xs text-gray-500 mt-1">/api/backend/dispatcher/orders/pending</p>
                    </div>

                    {error && <div className="px-4 pt-3 text-sm text-red-600">{error}</div>}

                    <div className="flex-1 p-2">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 h-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid
                                    rowData={rowData}
                                    columnDefs={columnDefs}
                                    loading={loading}
                                    onRowSelected={(row) => setSelected(row)}
                                />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full overflow-y-auto bg-slate-50 p-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-sm font-semibold text-gray-900">Détails</div>

                        {!selected ? (
                            <div className="mt-3 text-sm text-gray-500">Sélectionne une commande dans la liste.</div>
                        ) : (
                            <>
                                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                        <div className="text-xs text-gray-500">BC</div>
                                        <div className="font-semibold text-gray-900">{selected.bc_number || '-'}</div>
                                    </div>
                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                        <div className="text-xs text-gray-500">Client</div>
                                        <div className="font-semibold text-gray-900">{selected.partner?.name || '-'}</div>
                                    </div>
                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                        <div className="text-xs text-gray-500">Statut</div>
                                        <div className="font-semibold text-gray-900">{selected.bc_status || '-'}</div>
                                    </div>
                                    <div className="p-3 rounded border border-gray-100 bg-gray-50">
                                        <div className="text-xs text-gray-500">Total</div>
                                        <div className="font-semibold text-gray-900">{selected.total_amount ?? '-'}</div>
                                    </div>
                                </div>

                                <div className="mt-4">
                                    <div className="text-xs font-semibold text-gray-600">Payload</div>
                                    <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
                                        {JSON.stringify(selected, null, 2)}
                                    </pre>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            }
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: RefreshCw,
                                    label: 'Rafraîchir',
                                    variant: 'sage',
                                    onClick: refetch,
                                },
                                {
                                    icon: ArrowRightLeft,
                                    label: 'Convertir en BL',
                                    variant: 'primary',
                                    onClick: convertToBl,
                                    disabled: !selected,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
