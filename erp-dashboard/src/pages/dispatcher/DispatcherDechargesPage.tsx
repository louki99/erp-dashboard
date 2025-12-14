import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, CheckCircle2, XCircle, Package } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useDispatcherDechargesList, useDispatcherDechargeDetail, useApproveDechargeReturn, useRejectDecharge } from '@/hooks/dispatcher';
import type { Decharge } from '@/types/dispatcher.types';

export const DispatcherDechargesPage = () => {
    const [selected, setSelected] = useState<Decharge | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [showRejectModal, setShowRejectModal] = useState(false);

    const { data, loading, error, refetch } = useDispatcherDechargesList();
    const decharges = (data as any)?.decharges?.data || (data as any)?.data || [];

    const { data: detailData, loading: detailLoading, refetch: refetchDetail } = useDispatcherDechargeDetail(selected?.id ?? null);
    const { approve, loading: approving } = useApproveDechargeReturn();
    const { reject, loading: rejecting } = useRejectDecharge();

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'id', headerName: 'ID', width: 90 },
            { field: 'decharge_number', headerName: 'Décharge', width: 160 },
            { field: 'type', headerName: 'Type', width: 120 },
            { field: 'status', headerName: 'Statut', width: 140 },
            { field: 'bl_number', headerName: 'BL', width: 140 },
            { field: 'livreur.name', headerName: 'Livreur', flex: 1 },
            { field: 'created_at', headerName: 'Date', width: 160 },
        ],
        []
    );

    const onSelect = (row: Decharge) => {
        setSelected(row);
        setShowRejectModal(false);
        setRejectReason('');
    };

    const approveReturn = async () => {
        if (!selected?.id) return;
        try {
            const res = await approve(selected.id);
            if (res.success) {
                toast.success(res.message || 'Retour approuvé');
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec approbation');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec approbation');
        }
    };

    const handleReject = async () => {
        if (!selected?.id || !rejectReason.trim()) {
            toast.error('Veuillez fournir une raison de rejet');
            return;
        }
        try {
            const res = await reject(selected.id, rejectReason);
            if (res.success) {
                toast.success(res.message || 'Décharge rejetée');
                setShowRejectModal(false);
                setRejectReason('');
                await refetch();
                await refetchDetail();
            } else {
                toast.error(res.message || 'Échec rejet');
            }
        } catch (e) {
            toast.error(e instanceof Error ? e.message : 'Échec rejet');
        }
    };

    const details = detailData?.decharge || selected;

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100">
                        <h1 className="text-sm font-semibold text-gray-900">Décharges & Retours</h1>
                        <p className="text-xs text-gray-500 mt-1">/api/backend/dispatcher/decharges</p>
                    </div>

                    {error && <div className="px-4 pt-3 text-sm text-red-600">{error}</div>}

                    <div className="flex-1 p-2">
                        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 h-full">
                            {loading ? (
                                <div className="h-full flex items-center justify-center text-gray-400">
                                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                                </div>
                            ) : (
                                <DataGrid rowData={decharges} columnDefs={columnDefs} loading={loading} onRowSelected={onSelect} />
                            )}
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full overflow-y-auto bg-slate-50 p-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        {!selected ? (
                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                <Package className="w-16 h-16 text-gray-300 mb-4" />
                                <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucune décharge sélectionnée</h3>
                                <p className="text-sm text-gray-500">Sélectionnez une décharge dans la liste pour voir les détails</p>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="border-b border-gray-200 pb-4 mb-4">
                                    <h2 className="text-xl font-bold text-gray-900">{details?.decharge_number || `Décharge #${selected.id}`}</h2>
                                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                        <span className="font-medium">Type: {details?.type || '-'}</span>
                                        <span className="font-medium">Statut: {details?.status || '-'}</span>
                                        <span>BL: {details?.bl_number || '-'}</span>
                                    </div>
                                </div>

                                {detailLoading ? (
                                    <div className="flex items-center justify-center py-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                                        <span className="text-sm text-gray-500">Chargement des détails...</span>
                                    </div>
                                ) : (
                                    <>
                                        {/* Info Cards */}
                                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                <div className="text-xs text-gray-500 mb-1">Décharge</div>
                                                <div className="font-semibold text-gray-900">{details?.decharge_number || '-'}</div>
                                            </div>
                                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                <div className="text-xs text-gray-500 mb-1">BL</div>
                                                <div className="font-semibold text-gray-900">{details?.bl_number || '-'}</div>
                                            </div>
                                            <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                                                <div className="text-xs text-gray-500 mb-1">Livreur</div>
                                                <div className="font-semibold text-gray-900">{details?.livreur?.name || '-'}</div>
                                            </div>
                                        </div>

                                        {/* Items */}
                                        {details?.items && details.items.length > 0 && (
                                            <div className="mb-6">
                                                <h3 className="text-sm font-semibold text-gray-700 mb-3">Articles</h3>
                                                <div className="border border-gray-200 rounded-lg overflow-hidden">
                                                    <table className="min-w-full divide-y divide-gray-200">
                                                        <thead className="bg-gray-50">
                                                            <tr>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Produit</th>
                                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté livrée</th>
                                                                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté retournée</th>
                                                                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Raison retour</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody className="bg-white divide-y divide-gray-200">
                                                            {details.items.map((item: any, idx: number) => (
                                                                <tr key={idx} className="hover:bg-gray-50">
                                                                    <td className="px-4 py-3 text-sm text-gray-900">{item.product_name || `Produit #${item.product_id}`}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.delivered_quantity || 0}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.returned_quantity || 0}</td>
                                                                    <td className="px-4 py-3 text-sm text-gray-600">{item.return_reason || '-'}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}

                                        {/* Reject Modal */}
                                        {showRejectModal && (
                                            <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
                                                <h3 className="text-sm font-semibold text-red-900 mb-3">Rejeter la décharge</h3>
                                                <textarea
                                                    value={rejectReason}
                                                    onChange={(e) => setRejectReason(e.target.value)}
                                                    placeholder="Raison du rejet..."
                                                    rows={3}
                                                    className="w-full rounded-md border border-red-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-500 focus:border-red-500"
                                                />
                                                <div className="flex gap-2 mt-3">
                                                    <button
                                                        onClick={handleReject}
                                                        disabled={rejecting || !rejectReason.trim()}
                                                        className="px-4 py-2 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                                                    >
                                                        {rejecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                                        Confirmer le rejet
                                                    </button>
                                                    <button
                                                        onClick={() => {
                                                            setShowRejectModal(false);
                                                            setRejectReason('');
                                                        }}
                                                        className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                                                    >
                                                        Annuler
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {/* JSON Payload */}
                                        <div>
                                            <h3 className="text-xs font-semibold text-gray-600 mb-2">Payload JSON</h3>
                                            <pre className="text-xs bg-gray-50 border border-gray-100 rounded-lg p-4 overflow-auto max-h-96">
                                                {JSON.stringify(details, null, 2)}
                                            </pre>
                                        </div>
                                    </>
                                )}
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
                                    icon: CheckCircle2,
                                    label: 'Approuver retour',
                                    variant: 'primary',
                                    onClick: approveReturn,
                                    disabled: !selected || approving || selected.status === 'approved',
                                },
                                {
                                    icon: XCircle,
                                    label: 'Rejeter',
                                    variant: 'default',
                                    onClick: () => setShowRejectModal(true),
                                    disabled: !selected || rejecting || selected.status === 'rejected',
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
