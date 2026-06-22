import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Loader2, Search, RefreshCw, FileText, Package, Truck, CheckCircle2,
  XCircle, Scissors, ChevronRight, AlertCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmModal } from '@/components/common/Modal';
import { SplitBlModal } from '@/components/dispatcher/SplitBlModal';
import {
  useDispatcherBonLivraisonsList,
  useDispatcherBonLivraisonDetail,
  useDispatcherBlDecision,
  useDispatcherSplitBonLivraison,
  useDispatcherCancelBonLivraison,
} from '@/hooks/dispatcher/useDispatcherBonLivraisons';
import type { DeliveryNote, BlStatus } from '@/types/dispatcher.types';

// ─── Status config ─────────────────────────────────────────────────────────────

const BL_STATUS: Record<BlStatus, { label: string; color: string; dot: string }> = {
  draft:                  { label: 'Brouillon',        color: 'bg-gray-100 text-gray-700 border-gray-200',    dot: 'bg-gray-400' },
  confirmed:              { label: 'Confirmé',          color: 'bg-blue-100 text-blue-700 border-blue-200',    dot: 'bg-blue-500' },
  batched:                { label: 'En lot',            color: 'bg-indigo-100 text-indigo-700 border-indigo-200', dot: 'bg-indigo-500' },
  submitted_to_magasinier:{ label: 'Au magasinier',    color: 'bg-purple-100 text-purple-700 border-purple-200', dot: 'bg-purple-500' },
  in_preparation:         { label: 'En préparation',   color: 'bg-yellow-100 text-yellow-700 border-yellow-200', dot: 'bg-yellow-500' },
  ready:                  { label: 'Prêt',             color: 'bg-teal-100 text-teal-700 border-teal-200',    dot: 'bg-teal-500' },
  loaded:                 { label: 'Chargé',           color: 'bg-cyan-100 text-cyan-700 border-cyan-200',    dot: 'bg-cyan-500' },
  in_transit:             { label: 'En transit',       color: 'bg-orange-100 text-orange-700 border-orange-200', dot: 'bg-orange-500' },
  delivered:              { label: 'Livré',            color: 'bg-green-100 text-green-700 border-green-200', dot: 'bg-green-500' },
  partially_delivered:    { label: 'Livraison partielle', color: 'bg-lime-100 text-lime-700 border-lime-200', dot: 'bg-lime-500' },
  returned:               { label: 'Retourné',         color: 'bg-amber-100 text-amber-700 border-amber-200', dot: 'bg-amber-500' },
  cancelled:              { label: 'Annulé',           color: 'bg-red-100 text-red-700 border-red-200',       dot: 'bg-red-500' },
};

const StatusBadge = ({ status }: { status: BlStatus }) => {
  const cfg = BL_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const STATUS_FILTER_TABS: Array<{ id: string; label: string }> = [
  { id: '', label: 'Tous' },
  { id: 'draft', label: 'Brouillons' },
  { id: 'confirmed', label: 'Confirmés' },
  { id: 'in_preparation', label: 'En prép.' },
  { id: 'ready', label: 'Prêts' },
  { id: 'in_transit', label: 'En transit' },
  { id: 'cancelled', label: 'Annulés' },
];

// ─── Detail panel ──────────────────────────────────────────────────────────────

const DetailPanel = ({
  bl,
  onClose,
  onRefresh,
}: {
  bl: DeliveryNote;
  onClose: () => void;
  onRefresh: () => void;
}) => {
  const { data: detail, loading: detailLoading, refetch: refetchDetail } = useDispatcherBonLivraisonDetail(bl.id);
  const { execute, loading: executing } = useDispatcherBlDecision();
  const { split, loading: splitting } = useDispatcherSplitBonLivraison();
  const { cancel, loading: cancelling } = useDispatcherCancelBonLivraison();

  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [showSplitModal, setShowSplitModal] = useState(false);
  const [activeTab, setActiveTab] = useState('info');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ info: true, order: true, items: true });

  const d = detail ?? bl;
  const status = d.status as BlStatus;
  const canConfirm = status === 'draft';
  const canSplit   = status === 'draft' && (d.items?.length ?? 0) >= 2;
  // Backend breaking change 2026-06-22: once confirm_delivery_mission has run (mission →
  // in_preparation), "Cancel Delivery" disappears too — a direct call now 422s with
  // mission_not_draft. Guard on the mission's status, not just the BL's own, so this stays hidden
  // even if the BL's own status field hasn't caught up yet.
  const canCancel = (status === 'draft' || status === 'confirmed')
    && (!d.delivery_mission || d.delivery_mission.status === 'draft');

  const tabs: TabItem[] = useMemo(() => [
    { id: 'info',  label: 'Informations', icon: FileText },
    { id: 'order', label: 'Commande',     icon: Package },
    { id: 'items', label: `Lignes (${d.items?.length ?? 0})`, icon: Truck },
  ], [d.items?.length]);

  const runDecision = async (decision: string, extra?: Record<string, unknown>) => {
    try {
      const res = await execute(bl.id, decision, extra);
      if (res.success) {
        toast.success(res.message || 'Action effectuée');
        refetchDetail();
        onRefresh();
      } else {
        toast.error(res.message || 'Échec');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleConfirm = () => runDecision('confirm_delivery');

  const handleCancel = async () => {
    if (cancelReason.trim().length < 10) {
      toast.error('Motif trop court (min 10 caractères)');
      return;
    }
    setShowCancelModal(false);
    try {
      const res = await cancel(bl.id, { decision: 'cancel_delivery', reason: cancelReason });
      if (res.success) {
        toast.success(res.message || 'BL annulé');
        refetchDetail();
        onRefresh();
      } else {
        toast.error(res.message || 'Échec annulation');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur annulation');
    }
  };

  const handleSplit = async (splits: Array<{ items: number[]; notes?: string }>) => {
    try {
      const res = await split(bl.id, {
        decision: 'split_delivery',
        splits: splits.map((s) => ({ item_ids: s.items, label: s.notes })),
      });
      if (res.success) {
        toast.success(res.message || 'BL divisé avec succès');
        setShowSplitModal(false);
        onRefresh();
        onClose();
      } else {
        toast.error(res.message || 'Échec division');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur division');
    }
  };

  return (
    <>
      <div className="h-full flex flex-col bg-white">
        {/* Header */}
        <div className="px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
              </button>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base font-bold text-gray-900 truncate">{d.delivery_number}</h2>
                  <StatusBadge status={status} />
                </div>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{d.partner?.name}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-bold text-gray-900">
                {Number(d.total_amount).toLocaleString('fr-MA')}
                <span className="text-xs font-normal text-gray-400 ml-1">Dh</span>
              </div>
              {(detailLoading || executing) && (
                <div className="flex items-center justify-end gap-1 text-xs text-gray-400 mt-0.5">
                  <Loader2 className="w-3 h-3 animate-spin" /> En cours…
                </div>
              )}
            </div>
          </div>

          {/* Workflow actions bar */}
          <div className="flex flex-wrap gap-2 mt-3">
            {canConfirm && (
              <button
                onClick={handleConfirm}
                disabled={executing}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                Confirmer
              </button>
            )}
            {canSplit && (
              <button
                onClick={() => setShowSplitModal(true)}
                disabled={splitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                <Scissors className="w-3.5 h-3.5" />
                Diviser
              </button>
            )}
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                disabled={cancelling}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-red-600 border border-red-200 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" />
                Annuler
              </button>
            )}
            {!canConfirm && !canCancel && !canSplit && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <AlertCircle className="w-3.5 h-3.5" />
                Aucune action disponible dans cet état
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 shrink-0">
          <SageTabs
            tabs={tabs}
            activeTabId={activeTab}
            onTabChange={setActiveTab}
            className="px-4 shadow-none"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
          {/* Info section */}
          {activeTab === 'info' && (
            <SageCollapsible
              title="Informations BL"
              isOpen={openSections.info}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, info: v }))}
            >
              <div className="grid grid-cols-2 gap-3 p-1">
                {[
                  { label: 'Numéro', value: d.delivery_number },
                  { label: 'Branche', value: d.branch_code },
                  { label: 'Date livraison', value: d.delivery_date ?? '—' },
                  { label: 'Livreur', value: d.rider?.name ?? 'Non assigné' },
                  { label: 'Dispatcher', value: d.dispatcher?.name ?? '—' },
                  { label: 'Quantité verrouillée', value: d.is_quantity_locked ? 'Oui' : 'Non' },
                ].map(({ label, value }) => (
                  <div key={label} className="p-3 rounded-lg bg-white border border-gray-100">
                    <div className="text-xs text-gray-500">{label}</div>
                    <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value}</div>
                  </div>
                ))}
                {d.notes && (
                  <div className="col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="text-xs text-amber-600 font-medium mb-1">Notes</div>
                    <div className="text-sm text-amber-800">{d.notes}</div>
                  </div>
                )}
                {d.delivery_mission && (
                  <div className="col-span-2 p-3 rounded-lg bg-purple-50 border border-purple-100">
                    <div className="text-xs text-purple-600 font-medium mb-1">Mission associée</div>
                    <div className="text-sm font-semibold text-purple-800">{d.delivery_mission.mission_number}</div>
                  </div>
                )}
              </div>
            </SageCollapsible>
          )}

          {/* Order section */}
          {activeTab === 'order' && (
            <SageCollapsible
              title="Bon de commande"
              isOpen={openSections.order}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, order: v }))}
            >
              {d.order ? (
                <div className="grid grid-cols-2 gap-3 p-1">
                  {[
                    { label: 'Code BC', value: d.order.order_code },
                    { label: 'Statut BC', value: d.order.bc_status },
                    { label: 'Partenaire', value: d.partner?.name },
                    { label: 'Code partenaire', value: d.partner?.code },
                  ].map(({ label, value }) => (
                    <div key={label} className="p-3 rounded-lg bg-white border border-gray-100">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5 truncate">{value ?? '—'}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 p-3">Aucune commande associée</p>
              )}
            </SageCollapsible>
          )}

          {/* Items section */}
          {activeTab === 'items' && (
            <SageCollapsible
              title={`Lignes produits (${d.items?.length ?? 0})`}
              isOpen={openSections.items}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, items: v }))}
            >
              {d.items && d.items.length > 0 ? (
                <div className="overflow-hidden rounded-lg border border-gray-200">
                  <table className="min-w-full divide-y divide-gray-100 text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-3 py-2.5 text-left text-xs font-semibold text-gray-600">Produit</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Qté</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Alloué</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Préparé</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">P.U</th>
                        <th className="px-3 py-2.5 text-right text-xs font-semibold text-gray-600">Total</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50 bg-white">
                      {d.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-3 py-2.5">
                            <div className="font-medium text-gray-900 text-xs">{item.product?.name ?? `#${item.product_id}`}</div>
                            <div className="text-gray-400 text-xs">{item.product?.sku}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-700">{item.ordered_quantity ?? item.quantity}</td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-700">{item.allocated_quantity ?? item.allocated_qty}</td>
                          <td className="px-3 py-2.5 text-right text-xs">
                            {item.prepared_quantity != null ? (
                              <span className={item.prepared_quantity < (item.ordered_quantity ?? item.quantity ?? 0) ? 'text-orange-600 font-semibold' : 'text-green-600'}>
                                {item.prepared_quantity}
                              </span>
                            ) : (
                              <span className="text-gray-400">—</span>
                            )}
                          </td>
                          <td className="px-3 py-2.5 text-right text-xs text-gray-700">{Number(item.unit_price).toLocaleString()} Dh</td>
                          <td className="px-3 py-2.5 text-right text-xs font-semibold text-gray-900">{Number(item.total_price).toLocaleString()} Dh</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-sm text-gray-400 p-3">Aucune ligne produit</p>
              )}
            </SageCollapsible>
          )}
        </div>
      </div>

      {/* Cancel modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Annuler le BL"
        message={
          <div className="space-y-3">
            <p className="text-sm text-gray-600">
              Êtes-vous sûr de vouloir annuler <strong>{d.delivery_number}</strong> ? Le stock réservé sera libéré.
            </p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Motif d'annulation (min 10 car.) *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400"
                placeholder="Indiquez la raison…"
              />
            </div>
          </div>
        }
        confirmText="Annuler le BL"
        cancelText="Retour"
        variant="danger"
        loading={cancelling}
      />

      {/* Split modal */}
      <SplitBlModal
        isOpen={showSplitModal}
        onClose={() => setShowSplitModal(false)}
        onConfirm={handleSplit}
        items={d.items ?? []}
        loading={splitting}
      />
    </>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherBonLivraisonsPage = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<DeliveryNote | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    search: search || undefined,
    page,
  }), [statusFilter, search, page]);

  const { data, loading, error, refetch } = useDispatcherBonLivraisonsList(filters);
  const bls = data?.data ?? [];
  const total = data?.total ?? 0;

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'delivery_number',
      headerName: 'N° BL',
      width: 180,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      field: 'status',
      headerName: 'Statut',
      width: 150,
      cellRenderer: (p: any) => {
        const cfg = BL_STATUS[p.value as BlStatus];
        return cfg ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ) : p.value;
      },
    },
    { field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 150 },
    { field: 'order.order_code', headerName: 'BC', width: 150 },
    {
      field: 'total_amount',
      headerName: 'Montant',
      width: 120,
      valueFormatter: (p: any) => p.value ? `${Number(p.value).toLocaleString('fr-MA')} Dh` : '—',
    },
    {
      field: 'delivery_date',
      headerName: 'Livraison',
      width: 110,
      valueFormatter: (p: any) =>
        p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
    {
      field: 'rider.name',
      headerName: 'Livreur',
      width: 130,
      valueFormatter: (p: any) => p.value ?? '—',
    },
  ], []);

  return (
    <MasterLayout
      leftContent={
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-bold text-gray-900">Bons de livraison</h1>
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="font-semibold text-gray-700">{total}</span> BL(s)
                <button onClick={refetch} className="p-1 rounded hover:bg-gray-100 transition-colors">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="BL, partenaire…"
                className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50"
              />
            </div>

            {/* Status filter tabs */}
            <div className="flex flex-wrap gap-1">
              {STATUS_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {/* Grid */}
          <div className="flex-1 min-h-0 p-2">
            <div className="bg-white rounded-lg border border-gray-200 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : (
                <DataGrid
                  rowData={bls}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: DeliveryNote) => setSelected(row)}
                />
              )}
            </div>
          </div>

          {/* Pagination */}
          {data && data.last_page && data.last_page > 1 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Préc.
              </button>
              <span className="text-xs text-gray-500">
                Page {page} / {data.last_page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (data.last_page ?? 1)}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Suiv.
              </button>
            </div>
          )}
        </div>
      }
      mainContent={
        selected ? (
          <DetailPanel
            key={selected.id}
            bl={selected}
            onClose={() => setSelected(null)}
            onRefresh={refetch}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <FileText className="w-14 h-14 text-gray-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">Aucun BL sélectionné</h3>
              <p className="text-sm text-gray-400">Cliquez sur une ligne pour afficher les détails</p>
            </div>
          </div>
        )
      }
    />
  );
};
