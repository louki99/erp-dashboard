import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Plus, AlertCircle, FileText, User, Package } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { ConfirmModal } from '@/components/common/Modal';
import { magasinierApi } from '@/services/api/magasinierApi';

export const MagasinierOrdersPage = () => {
    const [selected, setSelected] = useState<any[]>([]);
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showCreateConfirm, setShowCreateConfirm] = useState(false);

    const fetchOrders = async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.orders.getApproved();
            setData((res as any)?.data?.orders?.data || []);
        } catch (error) {
            console.error('Failed to fetch orders:', error);
            toast.error('Échec du chargement des commandes');
        } finally {
            setLoading(false);
        }
    };

    useState(() => {
        fetchOrders();
    });

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'bc_number', headerName: 'N° BC', width: 180, checkboxSelection: true },
            { 
                field: 'partner.name', 
                headerName: 'Partenaire', 
                flex: 1,
                valueGetter: (params: any) => params.data?.partner?.name || '-'
            },
            { 
                field: 'total_amount', 
                headerName: 'Montant', 
                width: 130,
                valueFormatter: (params: any) => `${parseFloat(params.value || 0).toLocaleString()} Dh`
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

    const handleCreateBp = async () => {
        if (selected.length === 0) {
            toast.error('Veuillez sélectionner au moins une commande');
            return;
        }

        setShowCreateConfirm(false);
        setCreating(true);

        const toastId = toast.loading(
            <div className="flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Création du bon de préparation...</span>
            </div>,
            { duration: Infinity }
        );

        try {
            const orderIds = selected.map((order: any) => order.id);
            const res = await magasinierApi.orders.createBpFromOrders(orderIds);
            toast.dismiss(toastId);

            if (res.success) {
                toast.success(res.message || 'Bon de préparation créé avec succès');
                await fetchOrders();
                setSelected([]);
            }
        } catch (e) {
            toast.dismiss(toastId);
            toast.error(e instanceof Error ? e.message : 'Échec de la création');
        } finally {
            setCreating(false);
        }
    };

    const mainContent = (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
                <h2 className="text-lg font-semibold text-gray-900">Commandes approuvées</h2>
                <p className="text-sm text-gray-600 mt-1">
                    Sélectionnez les commandes pour créer un bon de préparation
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
                            <p>Aucune commande approuvée</p>
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
                        <h1 className="text-sm font-semibold text-gray-900 mb-4">Commandes</h1>
                        <div className="space-y-2">
                            <div className="bg-blue-50 rounded p-3">
                                <div className="text-xs text-gray-500">Total</div>
                                <div className="text-2xl font-bold text-blue-700">{data.length}</div>
                            </div>
                            <div className="bg-purple-50 rounded p-3">
                                <div className="text-xs text-gray-500">Sélectionnées</div>
                                <div className="text-2xl font-bold text-purple-700">{selected.length}</div>
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
                                        onClick: fetchOrders,
                                    },
                                ],
                            },
                            {
                                items: [
                                    {
                                        icon: Plus,
                                        label: 'Créer BP',
                                        variant: 'primary',
                                        onClick: () => setShowCreateConfirm(true),
                                        disabled: selected.length === 0 || creating,
                                    },
                                ],
                            },
                        ]}
                    />
                }
            />

            <ConfirmModal
                isOpen={showCreateConfirm}
                onClose={() => setShowCreateConfirm(false)}
                onConfirm={handleCreateBp}
                title="Créer un bon de préparation"
                message={`Êtes-vous sûr de vouloir créer un BP à partir de ${selected.length} commande(s) ?`}
                confirmText="Créer"
                cancelText="Annuler"
                variant="info"
                loading={creating}
            />
        </>
    );
};
