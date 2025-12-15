import { useMemo, useState, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Plus, Package, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { ConfirmModal } from '@/components/common/Modal';
import { magasinierApi } from '@/services/api/magasinierApi';

export const MagasinierBatchPickingPage = () => {
    const [selected, setSelected] = useState<any[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [showGenerateConfirm, setShowGenerateConfirm] = useState(false);

    const fetchAvailableBls = async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.batchPicking.getAvailable();
            setData((res as any)?.bls || []);
        } catch (error) {
            console.error('Failed to fetch available BLs:', error);
            toast.error('Échec du chargement des BLs');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchAvailableBls();
    }, []);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'bl_number', headerName: 'N° BL', width: 180, checkboxSelection: true },
            { 
                field: 'partner.name', 
                headerName: 'Partenaire', 
                flex: 1,
                valueGetter: (params: any) => params.data?.partner?.name || '-'
            },
            { 
                field: 'status', 
                headerName: 'Statut', 
                width: 130,
                cellRenderer: (params: any) => {
                    const statusMap: Record<string, { label: string; className: string }> = {
                        draft: { label: 'Brouillon', className: 'bg-gray-100 text-gray-800' },
                        preparing: { label: 'En préparation', className: 'bg-blue-100 text-blue-800' },
                    };
                    const status = statusMap[params.value] || { label: params.value, className: 'bg-gray-100 text-gray-800' };
                    return `<span class="px-2 py-1 rounded-full text-xs font-medium ${status.className}">${status.label}</span>`;
                }
            },
            { 
                field: 'items_count', 
                headerName: 'Articles', 
                width: 100,
                valueGetter: (params: any) => params.data?.items?.length || 0
            },
            { 
                field: 'created_at', 
                headerName: 'Date', 
                width: 140,
                valueFormatter: (params: any) => params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-'
            },
        ],
        []
    );

    const handleGenerateBatch = async () => {
        if (selected.length === 0) {
            toast.error('Veuillez sélectionner au moins un BL');
            return;
        }

        setShowGenerateConfirm(false);
        setGenerating(true);

        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Génération de la session de préparation groupée...</span>
            </div>,
            { duration: Infinity }
        );

        try {
            const blIds = selected.map((bl: any) => bl.id);
            const res = await magasinierApi.batchPicking.generate(blIds);
            toast.dismiss(toastId);

            if (res.session) {
                toast.success(
                    <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Session créée avec succès</span>
                    </div>
                );
                await fetchAvailableBls();
                setSelected([]);
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de la génération');
        } finally {
            setGenerating(false);
        }
    };

    const mainContent = (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold text-gray-900">Préparation groupée (Batch Picking)</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez les BLs pour créer une session de préparation groupée
                </p>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun BL disponible pour la préparation groupée</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid
                        rowData={data}
                        columnDefs={columnDefs}
                        onRowSelected={(rows) => setSelected(rows)}
                        loading={loading}
                        rowSelection="multiple"
                    />
                )}
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col p-4">
                        <h1 className="text-sm font-semibold text-gray-900 mb-4">BLs disponibles</h1>
                        <div className="space-y-2">
                            <div className="bg-blue-50 rounded p-3">
                                <div className="text-xs text-gray-500">Total BLs</div>
                                <div className="text-2xl font-bold text-blue-700">{data.length}</div>
                            </div>
                            <div className="bg-green-50 rounded p-3">
                                <div className="text-xs text-gray-500">Sélectionnés</div>
                                <div className="text-2xl font-bold text-green-700">{selected.length}</div>
                            </div>
                        </div>
                        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                            <div className="text-xs font-semibold text-yellow-900 mb-1">Info</div>
                            <div className="text-xs text-yellow-800">
                                La préparation groupée permet de préparer plusieurs BLs en une seule session, optimisant ainsi le temps de picking.
                            </div>
                        </div>
                    </div>
                }
                mainContent={mainContent}
                rightContent={
                    <ActionPanel
                        groups={[
                            {
                                items: [
                                    {
                                        icon: RefreshCw,
                                        label: 'Rafraîchir',
                                        variant: 'sage',
                                        onClick: fetchAvailableBls,
                                    },
                                ],
                            },
                            {
                                items: [
                                    {
                                        icon: Plus,
                                        label: 'Générer session',
                                        variant: 'primary',
                                        onClick: () => setShowGenerateConfirm(true),
                                        disabled: selected.length === 0 || generating,
                                    },
                                ],
                            },
                        ]}
                    />
                }
            />

            <ConfirmModal
                isOpen={showGenerateConfirm}
                onClose={() => setShowGenerateConfirm(false)}
                onConfirm={handleGenerateBatch}
                title="Générer une session de préparation groupée"
                message={`Êtes-vous sûr de vouloir créer une session de batch picking avec ${selected.length} BL(s) ?`}
                confirmText="Générer"
                cancelText="Annuler"
                variant="info"
                loading={generating}
            />
        </>
    );
};
