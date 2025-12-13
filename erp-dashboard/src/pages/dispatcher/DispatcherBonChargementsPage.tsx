import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import {
    useDispatcherBonChargementsList,
    useDispatcherBonChargementDetail,
    useDispatcherValidateBch,
    useDispatcherBchBalance,
} from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { BonChargement } from '@/types/dispatcher.types';

export const DispatcherBonChargementsPage = () => {
    const [selected, setSelected] = useState<BonChargement | null>(null);

    const { data, loading, error, refetch } = useDispatcherBonChargementsList();
    const bchs = (data as any)?.bchs?.data || (data as any)?.data || [];

    const { data: detailData, loading: detailLoading, error: detailError, refetch: refetchDetail } = useDispatcherBonChargementDetail(selected?.id ?? null);
    const { data: balanceData, loading: balanceLoading, error: balanceError, refetch: refetchBalance } = useDispatcherBchBalance(selected?.id ?? null);
    const { validate, loading: validating } = useDispatcherValidateBch();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'id', headerName: 'ID', width: 90 },
            { field: 'bch_number', headerName: 'BCH', width: 160 },
            { field: 'status', headerName: 'Statut', width: 140 },
            { field: 'livreur_id', headerName: 'Livreur', width: 120 },
            { field: 'created_at', headerName: 'Date', width: 160 },
        ],
        []
    );

    const onSelect = (row: BonChargement) => {
        setSelected(row);
    };

    const validateSelected = async () => {
        if (!selected?.id) return;
        try {
            const res = await validate(selected.id);
            if (res.success) toast.success(res.message || 'BCH validé');
            else toast.error(res.message || 'Échec validation');
            await refetch();
            await refetchDetail();
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec validation');
        }
    };

    const details = detailData?.bch || selected;

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h1 className="text-sm font-semibold text-gray-900">Bons de chargement (BCH)</h1>
                        <p className="text-xs text-gray-500 mt-1">/api/backend/dispatcher/bon-chargements</p>
                    </div>

                    {error && <div className="px-4 pt-3 text-sm text-red-600">{error}</div>}

                    <div className="flex-1 p-2">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 h-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid rowData={bchs} columnDefs={columnDefs} loading={loading} onRowSelected={onSelect} />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full overflow-y-auto bg-slate-50 p-6 space-y-4">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
                        <div className="text-sm font-semibold text-gray-900">Détails BCH</div>

                        {!selected ? (
                            <div className="mt-3 text-sm text-gray-500">Sélectionne un BCH dans la liste.</div>
                        ) : (
                            <>
                                {(detailLoading || balanceLoading || validating) && (
                                    <div className="mt-3 text-sm text-gray-500 flex items-center gap-2">
                                        <Loader2 className="w-4 h-4 animate-spin" /> Traitement...
                                    </div>
                                )}

                                {detailError && <div className="mt-3 text-sm text-red-600">{detailError}</div>}

                                <div className="mt-4">
                                    <div className="text-xs font-semibold text-gray-600">BCH payload</div>
                                    <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
                                        {JSON.stringify(details, null, 2)}
                                    </pre>
                                </div>

                                <div className="mt-4">
                                    <div className="text-xs font-semibold text-gray-600">Balance</div>
                                    {balanceError && <div className="mt-2 text-sm text-red-600">{balanceError}</div>}
                                    <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
                                        {JSON.stringify(balanceData, null, 2)}
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
                                    onClick: () => {
                                        refetch();
                                        refetchDetail();
                                        refetchBalance();
                                    },
                                },
                                {
                                    icon: CheckCircle2,
                                    label: 'Valider BCH',
                                    variant: 'primary',
                                    onClick: validateSelected,
                                    disabled: !selected || validating,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
