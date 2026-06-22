import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Package, Truck, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import {
  useDispatcherWarehouseTransfersList,
  useDispatcherWarehouseTransferDetail,
  useAcceptWarehouseTransfer,
  useRejectWarehouseTransfer,
} from '@/hooks/dispatcher/useDispatcherWarehouseTransfers';
import type { WarehouseTransfer } from '@/types/dispatcher.types';

// Real status values from code (docs §12c, corrected 2026-06-17) — pending → accepted →
// completed, plus rejected/validated. No ship/in_transit/receive transitions exist.
const STATUS_LABEL: Record<string, string> = {
  pending: 'En attente',
  accepted: 'Accepté',
  completed: 'Terminé',
  rejected: 'Rejeté',
  validated: 'Validé (réconciliation décharge)',
};

const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'action";
};

// ─── Main page ────────────────────────────────────────────────────────────────
// 2026-06-20: there is no longer any dispatcher-triggered creation path at all (docs §12c) — a
// WT is generated automatically the moment a mission's BP completes
// (WarehouseTransferService::createFromMission()). This page is read/accept/reject only.

export const DispatcherWarehouseTransfersPage = () => {
  const [selected, setSelected] = useState<WarehouseTransfer | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');

  const { data, loading, error, refetch } = useDispatcherWarehouseTransfersList({
    status: statusFilter || undefined,
  });
  const transfers = data?.data ?? [];

  const { data: detail, loading: detailLoading, refetch: refetchDetail } = useDispatcherWarehouseTransferDetail(selected?.id ?? null);
  const details = detail ?? selected;

  const { accept, loading: accepting } = useAcceptWarehouseTransfer();
  const { reject, loading: rejecting } = useRejectWarehouseTransfer();

  const columnDefs = useMemo<ColDef[]>(
    () => [
      { field: 'transfer_number', headerName: 'N° Transfert', width: 170 },
      {
        headerName: 'Statut',
        width: 140,
        valueGetter: (p) => STATUS_LABEL[p.data?.status] ?? p.data?.status,
      },
      { headerName: 'Mission', width: 150, valueGetter: (p) => p.data?.delivery_mission?.mission_number ?? '-' },
      { headerName: 'Livreur', width: 150, valueGetter: (p) => p.data?.livreur?.name ?? '-' },
      { field: 'to_warehouse', headerName: 'Destination', width: 130 },
      { field: 'created_at', headerName: 'Créé le', flex: 1 },
    ],
    []
  );

  const onSelect = (row: WarehouseTransfer) => {
    setSelected(row);
    setShowRejectModal(false);
    setRejectReason('');
  };

  const handleAccept = async () => {
    if (!selected?.id) return;
    try {
      const res = await accept(selected.id);
      if (res.success) {
        toast.success(res.message || 'Transfert accepté');
        refetch();
        refetchDetail();
      } else {
        toast.error(res.message || "Échec de l'acceptation");
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
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
        toast.success(res.message || 'Transfert rejeté');
        setShowRejectModal(false);
        setRejectReason('');
        refetch();
        refetchDetail();
      } else {
        toast.error(res.message || 'Échec du rejet');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  };

  return (
    <>
      <MasterLayout
        leftContent={
          <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="p-4 border-b border-gray-100">
              <h1 className="text-sm font-semibold text-gray-900">Transferts Entrepôt</h1>
              <p className="text-xs text-gray-500 mt-1">/api/backend/dispatcher/warehouse-transfers</p>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="mt-2 w-full border border-gray-300 rounded px-2 py-1.5 text-xs"
              >
                <option value="">Tous les statuts</option>
                {Object.entries(STATUS_LABEL).map(([k, v]) => (
                  <option key={k} value={k}>{v}</option>
                ))}
              </select>
            </div>

            {error && <div className="px-4 pt-3 text-sm text-red-600">{error}</div>}

            <div className="flex-1 p-2">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-2 h-full">
                {loading ? (
                  <div className="h-full flex items-center justify-center text-gray-400">
                    <Loader2 className="w-6 h-6 animate-spin mr-2" /> Chargement...
                  </div>
                ) : (
                  <DataGrid rowData={transfers} columnDefs={columnDefs} loading={loading} onRowSelected={onSelect} />
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
                  <Truck className="w-16 h-16 text-gray-300 mb-4" />
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Aucun transfert sélectionné</h3>
                  <p className="text-sm text-gray-500">Sélectionnez un transfert dans la liste pour voir les détails</p>
                </div>
              ) : (
                <>
                  <div className="border-b border-gray-200 pb-4 mb-4">
                    <h2 className="text-xl font-bold text-gray-900">{details?.transfer_number || `Transfert #${selected.id}`}</h2>
                    <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                      <span className="font-medium">Statut: {STATUS_LABEL[details?.status ?? ''] ?? details?.status ?? '-'}</span>
                      <span>De: {details?.from_warehouse ?? '-'}</span>
                      <span>Vers: {details?.to_warehouse ?? '-'}</span>
                    </div>
                  </div>

                  {detailLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                      <span className="text-sm text-gray-500">Chargement des détails...</span>
                    </div>
                  ) : (
                    <>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                        <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">Mission source</div>
                          <div className="font-semibold text-gray-900">{details?.delivery_mission?.mission_number || '-'}</div>
                        </div>
                        <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">Livreur</div>
                          <div className="font-semibold text-gray-900">{details?.livreur?.name || '-'}</div>
                        </div>
                        <div className="p-4 rounded-lg border border-gray-100 bg-gray-50">
                          <div className="text-xs text-gray-500 mb-1">Notes</div>
                          <div className="font-semibold text-gray-900">{details?.notes || '-'}</div>
                        </div>
                      </div>

                      {details?.items && details.items.length > 0 && (
                        <div className="mb-6">
                          <h3 className="text-sm font-semibold text-gray-700 mb-3">Articles</h3>
                          <div className="border border-gray-200 rounded-lg overflow-hidden">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-50">
                                <tr>
                                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">Produit</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté demandée</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté transférée</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté livrée</th>
                                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">Qté retournée</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {details.items.map((item) => (
                                  <tr key={item.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 text-sm text-gray-900">{item.product_name || `Produit #${item.product_id}`}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.requested_quantity}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.transferred_quantity ?? '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.delivered_quantity ?? '-'}</td>
                                    <td className="px-4 py-3 text-sm text-gray-900 text-right">{item.returned_quantity ?? '-'}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}

                      {showRejectModal && (
                        <div className="mb-6 p-4 border border-red-200 bg-red-50 rounded-lg">
                          <h3 className="text-sm font-semibold text-red-900 mb-3">Rejeter le transfert</h3>
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
                              onClick={() => { setShowRejectModal(false); setRejectReason(''); }}
                              className="px-4 py-2 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
                            >
                              Annuler
                            </button>
                          </div>
                        </div>
                      )}

                      {/* accept/reject have no status guard backend-side (callable from any
                          status) — confirmed by backend, not a frontend assumption. No ship/
                          in_transit/receive actions exist; pending → accepted → completed is
                          driven by other service flows, not user-triggered here. */}
                      <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800 flex items-start gap-2">
                        <Package size={14} className="mt-0.5 shrink-0" />
                        Accepter/rejeter ne sont pas gardés par statut côté backend (utilisable depuis n'importe quel état) — agir avec prudence.
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
                  { icon: RefreshCw, label: 'Rafraîchir', variant: 'sage', onClick: refetch },
                  {
                    icon: CheckCircle2,
                    label: 'Accepter',
                    variant: 'primary',
                    onClick: handleAccept,
                    disabled: !selected || accepting,
                  },
                  {
                    icon: XCircle,
                    label: 'Rejeter',
                    variant: 'default',
                    onClick: () => setShowRejectModal(true),
                    disabled: !selected || rejecting,
                  },
                ],
              },
            ]}
          />
        }
      />
    </>
  );
};

export default DispatcherWarehouseTransfersPage;
