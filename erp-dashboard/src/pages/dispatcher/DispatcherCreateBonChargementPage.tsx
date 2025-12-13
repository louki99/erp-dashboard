import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, PackagePlus } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useDispatcherDraftBonLivraisons } from '@/hooks/dispatcher/useDispatcherBonLivraisons';
import { useDispatcherCreateBch } from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { BonLivraison, Livreur } from '@/types/dispatcher.types';

export const DispatcherCreateBonChargementPage = () => {
    const { data, loading, error, refetch } = useDispatcherDraftBonLivraisons();
    const draftBls = data?.draftBls || [];
    const livreurs = data?.livreurs || [];

    const [selectedBls, setSelectedBls] = useState<Record<number, BonLivraison>>({});
    const [livreurId, setLivreurId] = useState<number | ''>('');
    const [notes, setNotes] = useState<string>('');

    const { create, loading: creating } = useDispatcherCreateBch();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'id', headerName: 'ID', width: 90 },
            { field: 'bl_number', headerName: 'BL', width: 160 },
            { field: 'delivery_date', headerName: 'Date livraison', width: 160 },
            { field: 'livreur.name', headerName: 'Livreur', flex: 1 },
        ],
        []
    );

    const toggleSelect = (bl: BonLivraison) => {
        setSelectedBls((prev) => {
            const next = { ...prev };
            if (next[bl.id]) delete next[bl.id];
            else next[bl.id] = bl;
            return next;
        });
    };

    const selectedIds = Object.keys(selectedBls).map((x) => Number(x));

    const createBch = async () => {
        if (selectedIds.length === 0) {
            toast.error('Sélectionne au moins un BL');
            return;
        }
        if (livreurId === '') {
            toast.error('Sélectionne un livreur');
            return;
        }

        try {
            const res = await create({
                bl_ids: selectedIds.join(','),
                livreur_id: Number(livreurId),
                notes: notes || undefined,
            });

            if (res.success) toast.success(res.message || 'BCH créé');
            else toast.error(res.message || 'Échec création');
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec création');
        }
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h1 className="text-sm font-semibold text-gray-900">Sélection BL (brouillons)</h1>
                        <p className="text-xs text-gray-500 mt-1">Créer un BCH en regroupant des BL</p>
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
                                    rowData={draftBls}
                                    columnDefs={columnDefs}
                                    loading={loading}
                                    onRowSelected={(row) => toggleSelect(row)}
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
                        <div className="mt-3 text-sm text-gray-700">BL sélectionnés: <span className="font-semibold">{selectedIds.length}</span></div>

                        <div className="mt-4">
                            <div className="text-xs font-semibold text-gray-600">Livreur</div>
                            <select
                                value={livreurId}
                                onChange={(e) => setLivreurId(e.target.value === '' ? '' : Number(e.target.value))}
                                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            >
                                <option value="">-- Sélectionner --</option>
                                {livreurs.map((l: Livreur) => (
                                    <option key={l.id} value={l.id}>
                                        {l.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div className="mt-4">
                            <div className="text-xs font-semibold text-gray-600">Notes</div>
                            <textarea
                                value={notes}
                                onChange={(e) => setNotes(e.target.value)}
                                rows={3}
                                className="mt-1 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                            />
                        </div>

                        <div className="mt-4">
                            <div className="text-xs font-semibold text-gray-600">IDs</div>
                            <pre className="mt-2 text-xs bg-gray-50 border border-gray-100 rounded p-3 overflow-auto">
                                {JSON.stringify(selectedIds, null, 2)}
                            </pre>
                        </div>
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
                                    icon: PackagePlus,
                                    label: 'Créer BCH',
                                    variant: 'primary',
                                    onClick: createBch,
                                    disabled: creating,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
