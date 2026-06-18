import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Loader2, RefreshCw, ChevronRight, AlertCircle, FileText, Truck,
  Package, Plus, Printer, CheckCircle2, Send, RotateCcw, XCircle,
  Scale, User, Calendar, Hash, ArrowRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ConfirmModal } from '@/components/common/Modal';
import { AddBlToBchModal } from '@/components/dispatcher/AddBlToBchModal';
import { BalanceModal } from '@/components/dispatcher/BalanceModal';
import {
  useDispatcherBonChargementsList,
  useDispatcherBonChargementDetail,
  useDispatcherBchBalance,
  useDispatcherSubmitBch,
  useDispatcherResubmitBch,
  useDispatcherValidateBch,
  useDispatcherCancelBch,
  useDispatcherPrintBch,
  useDispatcherAddBlToBch,
  useDispatcherRemoveBlFromBch,
  useDispatcherSaveBalance,
} from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { Shipment, BchStatus, SplitStrategy, BalanceAdjustment } from '@/types/dispatcher.types';

// ─── Status config ─────────────────────────────────────────────────────────────

const BCH_STATUS: Record<BchStatus, { label: string; color: string; dot: string }> = {
  pending:        { label: 'En attente',      color: 'bg-yellow-100 text-yellow-700 border-yellow-200',   dot: 'bg-yellow-500' },
  in_preparation: { label: 'En préparation',  color: 'bg-blue-100 text-blue-700 border-blue-200',         dot: 'bg-blue-500' },
  prepared:       { label: 'Préparé',         color: 'bg-teal-100 text-teal-700 border-teal-200',         dot: 'bg-teal-500' },
  validated:      { label: 'Validé',          color: 'bg-indigo-100 text-indigo-700 border-indigo-200',   dot: 'bg-indigo-500' },
  loaded:         { label: 'Chargé',          color: 'bg-cyan-100 text-cyan-700 border-cyan-200',         dot: 'bg-cyan-500' },
  in_transit:     { label: 'En transit',      color: 'bg-orange-100 text-orange-700 border-orange-200',   dot: 'bg-orange-500' },
  completed:      { label: 'Terminé',         color: 'bg-green-100 text-green-700 border-green-200',      dot: 'bg-green-500' },
  cancelled:      { label: 'Annulé',          color: 'bg-red-100 text-red-700 border-red-200',            dot: 'bg-red-500' },
};

const StatusBadge = ({ status }: { status: BchStatus }) => {
  const cfg = BCH_STATUS[status] ?? { label: status, color: 'bg-gray-100 text-gray-700 border-gray-200', dot: 'bg-gray-400' };
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
};

const BCH_FILTER_TABS = [
  { id: '', label: 'Tous' },
  { id: 'pending', label: 'En attente' },
  { id: 'in_preparation', label: 'En prép.' },
  { id: 'prepared', label: 'Préparés' },
  { id: 'in_transit', label: 'En transit' },
  { id: 'completed', label: 'Terminés' },
];

// ─── Detail panel ──────────────────────────────────────────────────────────────

const DetailPanel = ({
  bch,
  onClose,
  onRefresh,
}: {
  bch: Shipment;
  onClose: () => void;
  onRefresh: () => void;
}) => {
  const { data: detail, loading: detailLoading, refetch: refetchDetail } = useDispatcherBonChargementDetail(bch.id);
  const { data: balance, loading: balanceLoading, refetch: refetchBalance } = useDispatcherBchBalance(bch.id);
  const { submit, loading: submitting } = useDispatcherSubmitBch();
  const { resubmit, loading: resubmitting } = useDispatcherResubmitBch();
  const { validate, loading: validating } = useDispatcherValidateBch();
  const { cancel, loading: cancelling } = useDispatcherCancelBch();
  const { print, loading: printing } = useDispatcherPrintBch();
  const { addBls, loading: addingBl } = useDispatcherAddBlToBch();
  const { removeBl, loading: removingBl } = useDispatcherRemoveBlFromBch();
  const { save: saveBalance, loading: savingBalance } = useDispatcherSaveBalance();

  const [activeTab, setActiveTab] = useState('info');
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({ info: true, bls: true, balance: false });
  const [showAddBlModal, setShowAddBlModal] = useState(false);
  const [showBalanceModal, setShowBalanceModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showValidateConfirm, setShowValidateConfirm] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [blToRemove, setBlToRemove] = useState<{ id: number; delivery_number: string } | null>(null);

  const d = detail ?? bch;
  const status = d.status as BchStatus;
  const canSubmit    = status === 'pending';
  const canResubmit  = status === 'prepared';
  const canValidate  = status === 'prepared';
  const canCancel    = status === 'pending' || status === 'in_preparation';
  const canAddBl     = status === 'pending';
  const hasShortage  = d.has_shortage;

  const tabs: TabItem[] = useMemo(() => [
    { id: 'info',    label: 'Informations', icon: FileText },
    { id: 'bls',     label: `BLs (${d.delivery_notes_count ?? d.delivery_notes?.length ?? 0})`, icon: Package },
    { id: 'balance', label: 'Balance',      icon: Scale },
  ], [d.delivery_notes_count, d.delivery_notes?.length]);

  const runAction = async (fn: () => Promise<any>, successMsg?: string) => {
    try {
      const res = await fn();
      if (res?.success !== false) {
        toast.success(successMsg || res?.message || 'Action effectuée');
        refetchDetail();
        onRefresh();
      } else {
        toast.error(res?.message || 'Échec');
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur');
    }
  };

  const handleSaveBalance = async (strategy: SplitStrategy, adjustments?: BalanceAdjustment[]) => {
    await runAction(
      () => saveBalance(bch.id, { decision: 'adjust_quantities', split_strategy: strategy, adjustments }),
      'Balance sauvegardée'
    );
    refetchBalance();
    setShowBalanceModal(false);
  };

  const handleAddBls = async (blIds: number[]) => {
    await runAction(() => addBls(bch.id, blIds), 'BL(s) ajouté(s)');
    setShowAddBlModal(false);
  };

  const handleRemoveBl = async () => {
    if (!blToRemove) return;
    await runAction(() => removeBl(bch.id, blToRemove.id), `BL ${blToRemove.delivery_number} retiré`);
    setBlToRemove(null);
  };

  const handleCancel = async () => {
    if (cancelReason.trim().length < 10) { toast.error('Motif trop court (min 10 car.)'); return; }
    setShowCancelModal(false);
    await runAction(() => cancel(bch.id, cancelReason), 'BCH annulé');
    onClose();
  };

  const isLoading = detailLoading || submitting || resubmitting || validating || cancelling || addingBl || removingBl;

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
                  <h2 className="text-base font-bold text-gray-900 truncate">{d.shipment_number}</h2>
                  <StatusBadge status={status} />
                  {hasShortage && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                      ⚠ Rupture
                    </span>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{d.rider?.name ?? 'Aucun livreur'}</p>
              </div>
            </div>
            <div className="shrink-0 text-right">
              {isLoading && (
                <div className="flex items-center justify-end gap-1 text-xs text-gray-400">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> En cours…
                </div>
              )}
            </div>
          </div>

          {/* Workflow actions */}
          <div className="flex flex-wrap gap-2 mt-3">
            {canSubmit && (
              <button
                onClick={() => setShowSubmitConfirm(true)}
                disabled={submitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <Send className="w-3.5 h-3.5" /> Soumettre au magasinier
              </button>
            )}
            {canResubmit && (
              <button
                onClick={() => runAction(() => resubmit(bch.id), 'BCH resoumis')}
                disabled={resubmitting}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Resoumettre
              </button>
            )}
            {canValidate && (
              <button
                onClick={() => setShowValidateConfirm(true)}
                disabled={validating}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 text-white rounded-lg hover:bg-teal-700 disabled:opacity-50 transition-colors"
              >
                <CheckCircle2 className="w-3.5 h-3.5" /> Valider chargement
              </button>
            )}
            {hasShortage && (
              <button
                onClick={() => { setShowBalanceModal(true); setActiveTab('balance'); }}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors"
              >
                <Scale className="w-3.5 h-3.5" /> Équilibrer rupture
              </button>
            )}
            {canAddBl && (
              <button
                onClick={() => setShowAddBlModal(true)}
                disabled={addingBl}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Ajouter BL
              </button>
            )}
            <button
              onClick={() => runAction(() => print(bch.id), 'Impression lancée')}
              disabled={printing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
            >
              <Printer className="w-3.5 h-3.5" /> Imprimer
            </button>
            {canCancel && (
              <button
                onClick={() => setShowCancelModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 border border-red-200 bg-white rounded-lg hover:bg-red-50 transition-colors"
              >
                <XCircle className="w-3.5 h-3.5" /> Annuler
              </button>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="border-b border-gray-100 shrink-0">
          <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} className="px-4 shadow-none" />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">

          {/* Info tab */}
          {activeTab === 'info' && (
            <SageCollapsible
              title="Informations BCH"
              isOpen={openSections.info}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, info: v }))}
            >
              <div className="grid grid-cols-2 gap-3 p-1">
                {[
                  { label: 'N° expédition', value: d.shipment_number, icon: Hash },
                  { label: 'Statut', value: BCH_STATUS[status]?.label ?? status, icon: CheckCircle2 },
                  { label: 'Branche', value: d.branch_code, icon: Package },
                  { label: 'Livreur', value: d.rider?.name ?? '—', icon: User },
                  { label: 'Véhicule', value: d.vehicle?.plate ?? '—', icon: Truck },
                  { label: 'Départ estimé', value: d.estimated_departure ? new Date(d.estimated_departure).toLocaleDateString('fr-FR') : '—', icon: Calendar },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} className="p-3 rounded-lg bg-white border border-gray-100 flex items-start gap-2">
                    <Icon className="w-3.5 h-3.5 text-gray-400 mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <div className="text-xs text-gray-500">{label}</div>
                      <div className="text-sm font-semibold text-gray-900 truncate mt-0.5">{value}</div>
                    </div>
                  </div>
                ))}
                {d.notes && (
                  <div className="col-span-2 p-3 rounded-lg bg-amber-50 border border-amber-100">
                    <div className="text-xs text-amber-600 font-medium mb-1">Notes</div>
                    <div className="text-sm text-amber-800">{d.notes}</div>
                  </div>
                )}
              </div>
            </SageCollapsible>
          )}

          {/* BLs tab */}
          {activeTab === 'bls' && (
            <SageCollapsible
              title={`Bons de livraison (${d.delivery_notes?.length ?? 0})`}
              isOpen={openSections.bls}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, bls: v }))}
            >
              {d.delivery_notes && d.delivery_notes.length > 0 ? (
                <div className="space-y-2 p-1">
                  {d.delivery_notes.map((bl) => (
                    <div key={bl.id} className="flex items-center justify-between p-3 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-mono font-semibold text-gray-800">{bl.delivery_number}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium border ${BCH_STATUS[bl.status as BchStatus]?.color ?? 'bg-gray-100 text-gray-600 border-gray-200'}`}>
                            {BCH_STATUS[bl.status as BchStatus]?.label ?? bl.status}
                          </span>
                        </div>
                        <div className="text-xs text-gray-500 mt-0.5 truncate">{bl.partner?.name}</div>
                      </div>
                      <div className="text-right ml-3 shrink-0">
                        <div className="text-sm font-bold text-gray-900">{Number(bl.total_amount).toLocaleString('fr-MA')} Dh</div>
                        {canAddBl && (
                          <button
                            onClick={() => setBlToRemove({ id: bl.id, delivery_number: bl.delivery_number })}
                            disabled={removingBl}
                            className="text-xs text-red-500 hover:text-red-700 mt-0.5"
                          >
                            Retirer
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-400 p-3">Aucun BL associé</p>
              )}
            </SageCollapsible>
          )}

          {/* Balance tab */}
          {activeTab === 'balance' && (
            <SageCollapsible
              title="Analyse des ruptures"
              isOpen={openSections.balance}
              onOpenChange={(v) => setOpenSections((p) => ({ ...p, balance: v }))}
            >
              {balanceLoading ? (
                <div className="p-6 flex items-center justify-center gap-2 text-gray-400 text-sm">
                  <Loader2 className="w-4 h-4 animate-spin" /> Chargement balance…
                </div>
              ) : balance && balance.products.length > 0 ? (
                <div className="space-y-3 p-1">
                  {balance.products.map((product) => (
                    <div key={product.product_id} className="bg-white border border-red-100 rounded-lg overflow-hidden">
                      <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex items-center justify-between">
                        <div>
                          <div className="text-sm font-semibold text-red-900">{product.product_name}</div>
                          <div className="text-xs text-red-600 mt-0.5">{product.sku} — Rupture: {product.shortage}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-red-600">Demandé: <strong>{product.total_requested}</strong></div>
                          <div className="text-xs text-green-600">Préparé: <strong>{product.total_prepared}</strong></div>
                        </div>
                      </div>
                      <div className="divide-y divide-gray-50">
                        {product.requesting_bls.map((bl) => (
                          <div key={bl.bl_id} className="px-4 py-2.5 flex items-center gap-3 text-xs">
                            <div className="flex-1 min-w-0">
                              <span className="font-mono font-semibold text-gray-800">{bl.delivery_number}</span>
                              <span className="text-gray-400 mx-1">·</span>
                              <span className="text-gray-600 truncate">{bl.partner_name}</span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-center">
                                <div className="text-gray-400">Demandé</div>
                                <div className="font-semibold text-gray-800">{bl.requested}</div>
                              </div>
                              <ArrowRight className="w-3 h-3 text-gray-300" />
                              <div className="text-center">
                                <div className="text-blue-500">Égal</div>
                                <div className="font-semibold text-blue-700">{bl.suggested_equal}</div>
                              </div>
                              <div className="text-center">
                                <div className="text-purple-500">FIFO</div>
                                <div className="font-semibold text-purple-700">{bl.suggested_fifo}</div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={() => handleSaveBalance('equal')}
                      disabled={savingBalance}
                      className="flex-1 py-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 disabled:opacity-50 transition-colors"
                    >
                      Appliquer Égal
                    </button>
                    <button
                      onClick={() => handleSaveBalance('fifo')}
                      disabled={savingBalance}
                      className="flex-1 py-2 text-xs font-semibold text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 disabled:opacity-50 transition-colors"
                    >
                      Appliquer FIFO
                    </button>
                    <button
                      onClick={() => setShowBalanceModal(true)}
                      className="flex-1 py-2 text-xs font-semibold text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Manuel…
                    </button>
                  </div>
                </div>
              ) : (
                <div className="p-6 text-center text-sm text-gray-400">
                  <CheckCircle2 className="w-8 h-8 text-green-400 mx-auto mb-2" />
                  Aucune rupture détectée
                </div>
              )}
            </SageCollapsible>
          )}
        </div>
      </div>

      {/* Submit confirm */}
      <ConfirmModal
        isOpen={showSubmitConfirm}
        onClose={() => setShowSubmitConfirm(false)}
        onConfirm={async () => {
          setShowSubmitConfirm(false);
          await runAction(() => submit(bch.id), 'BCH soumis au magasinier');
        }}
        title="Soumettre au magasinier"
        message={`Soumettre le BCH ${d.shipment_number} au magasinier pour préparation ?`}
        confirmText="Soumettre"
        loading={submitting}
      />

      {/* Validate confirm */}
      <ConfirmModal
        isOpen={showValidateConfirm}
        onClose={() => setShowValidateConfirm(false)}
        onConfirm={async () => {
          setShowValidateConfirm(false);
          await runAction(() => validate(bch.id), 'Chargement validé');
        }}
        title="Valider le chargement"
        message={`Confirmer que le BCH ${d.shipment_number} est chargé et prêt à partir ?`}
        confirmText="Valider"
        loading={validating}
      />

      {/* Cancel modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        title="Annuler le BCH"
        message={
          <div className="space-y-3">
            <p className="text-sm text-gray-600">Annuler <strong>{d.shipment_number}</strong> libérera tous les BLs associés.</p>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Motif *</label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                rows={3}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-red-300 focus:border-red-400"
                placeholder="Raison de l'annulation (min 10 car.)…"
              />
            </div>
          </div>
        }
        confirmText="Annuler le BCH"
        variant="danger"
        loading={cancelling}
      />

      {/* Remove BL confirm */}
      <ConfirmModal
        isOpen={!!blToRemove}
        onClose={() => setBlToRemove(null)}
        onConfirm={handleRemoveBl}
        title="Retirer le BL"
        message={`Retirer le BL ${blToRemove?.delivery_number} du BCH ${d.shipment_number} ?`}
        confirmText="Retirer"
        variant="danger"
        loading={removingBl}
      />

      {/* Add BL modal */}
      <AddBlToBchModal
        isOpen={showAddBlModal}
        onClose={() => setShowAddBlModal(false)}
        onConfirm={handleAddBls}
        bchId={bch.id}
        loading={addingBl}
      />

      {/* Balance modal */}
      <BalanceModal
        isOpen={showBalanceModal}
        onClose={() => setShowBalanceModal(false)}
        balance={balance}
        loading={savingBalance}
        onSave={handleSaveBalance}
      />
    </>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherBonChargementsPage = () => {
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Shipment | null>(null);

  const filters = useMemo(() => ({
    status: statusFilter || undefined,
    page,
  }), [statusFilter, page]);

  const { data, loading, error, refetch } = useDispatcherBonChargementsList(filters);
  const bchs = data?.bch?.data ?? [];
  const paginatedMeta = data?.bch;
  const stats = data?.stats;

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'shipment_number',
      headerName: 'N° BCH',
      width: 200,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      field: 'status',
      headerName: 'Statut',
      width: 150,
      cellRenderer: (p: any) => {
        const cfg = BCH_STATUS[p.value as BchStatus];
        return cfg ? (
          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
            {cfg.label}
          </span>
        ) : p.value;
      },
    },
    { field: 'rider.name', headerName: 'Livreur', flex: 1, minWidth: 120, valueFormatter: (p: any) => p.value ?? '—' },
    {
      field: 'delivery_notes_count',
      headerName: 'BLs',
      width: 65,
      valueFormatter: (p: any) => p.value ?? '—',
    },
    {
      field: 'has_shortage',
      headerName: 'Rupture',
      width: 85,
      cellRenderer: (p: any) =>
        p.value ? <span className="text-xs text-red-600 font-semibold">⚠ Oui</span> : <span className="text-xs text-gray-400">Non</span>,
    },
    {
      field: 'created_at',
      headerName: 'Date',
      width: 100,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
  ], []);

  return (
    <MasterLayout
      leftContent={
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
          {/* Header */}
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <h1 className="text-sm font-bold text-gray-900">Bons de chargement</h1>
              <button onClick={refetch} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400">
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Stats bar */}
            {stats && (
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { label: 'Total', value: stats.total },
                  { label: 'Attente', value: stats.pending, color: 'text-yellow-600' },
                  { label: 'En prép.', value: stats.in_preparation, color: 'text-blue-600' },
                  { label: 'Terminés', value: stats.completed, color: 'text-green-600' },
                ].map(({ label, value, color }) => (
                  <div key={label} className="bg-gray-50 rounded-lg p-2 text-center">
                    <div className={`text-base font-bold ${color ?? 'text-gray-700'}`}>{value}</div>
                    <div className="text-xs text-gray-400">{label}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Filter tabs */}
            <div className="flex flex-wrap gap-1">
              {BCH_FILTER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => { setStatusFilter(tab.id); setPage(1); }}
                  className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                    statusFilter === tab.id
                      ? 'bg-indigo-600 text-white shadow-sm'
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
                  rowData={bchs}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: Shipment) => setSelected(row)}
                />
              )}
            </div>
          </div>

          {/* Pagination */}
          {paginatedMeta && paginatedMeta.last_page && paginatedMeta.last_page > 1 && (
            <div className="px-4 py-2 border-t border-gray-100 flex items-center justify-between shrink-0">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
              >
                Préc.
              </button>
              <span className="text-xs text-gray-500">
                Page {page} / {paginatedMeta.last_page}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page >= (paginatedMeta.last_page ?? 1)}
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
            bch={selected}
            onClose={() => setSelected(null)}
            onRefresh={refetch}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <Package className="w-14 h-14 text-gray-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">Aucun BCH sélectionné</h3>
              <p className="text-sm text-gray-400">Cliquez sur une ligne pour afficher les détails</p>
            </div>
          </div>
        )
      }
    />
  );
};
