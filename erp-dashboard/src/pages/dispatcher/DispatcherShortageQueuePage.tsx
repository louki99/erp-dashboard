import { useEffect, useMemo, useRef, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import toast from 'react-hot-toast';
import {
  Loader2, AlertTriangle, RefreshCw, Package, AlertCircle,
  ChevronRight, ChevronLeft, TrendingDown, Sparkles, Banknote, Printer, Download, Send, Split,
} from 'lucide-react';
import { openPdf, downloadPdf } from '@/utils/pdfUtils';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { DecisionActionsBar } from '@/components/dispatcher/DecisionActionsBar';
import { ShortageAllocationContent, type ShortageAllocationHandle, type ShortageAllocationStatus } from '@/components/dispatcher/ShortageAllocationModal';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import { useDispatcherShortageQueue } from '@/hooks/dispatcher/useDispatcherShortageQueue';
import type { ApiSuccessResponse, PreparationOrder, BpStatus, ReviewPartialPreparationOutput } from '@/types/dispatcher.types';

const BP_STATUS: Record<BpStatus, { label: string; color: string }> = {
  pending:                  { label: 'En attente',        color: 'bg-gray-100 text-gray-700' },
  in_progress:              { label: 'En cours',          color: 'bg-blue-100 text-blue-700' },
  completed_full:           { label: 'Complété',          color: 'bg-green-100 text-green-700' },
  completed_partial:        { label: 'Rupture signalée',  color: 'bg-orange-100 text-orange-700' },
  shortage_accepted:        { label: 'Rupture acceptée',  color: 'bg-yellow-100 text-yellow-800' },
  shortage_split_done:      { label: 'Reliquat splitté',  color: 'bg-teal-100 text-teal-700' },
  awaiting_shortage_review: { label: 'À examiner',        color: 'bg-red-100 text-red-700' },
  partial_rework_requested: { label: 'Reprise demandée',  color: 'bg-purple-100 text-purple-700' },
  rejected:                 { label: 'Rejeté',            color: 'bg-red-100 text-red-800' },
};

// ─── Shortage detail panel for a BP ────────────────────────────────────────────
// Flow (docs §10, fixed/verified live 2026-06-23): completed_partial → [review_partial_
// preparation] → awaiting_shortage_review → [accept_partial_preparation] → shortage_split_done
// (backlog BC auto-created) OR [request_rework] → partial_rework_requested → magasinier picks
// again (continue_preparation, Module 16 §6.8) → completed_full or back to this queue.
// All 3 decisions render dynamically via DecisionActionsBar (model-agnostic, same as every other
// module) — no hardcoded buttons, so the available actions always match the BP's real state.

const ShortageDetailPanel = ({
  bp,
  reviewAnalysis,
  onClose,
  onRefresh,
  executeDecisionWithCapture,
  onAcceptClick,
}: {
  bp: PreparationOrder;
  reviewAnalysis: ReviewPartialPreparationOutput | null;
  onClose: () => void;
  onRefresh: () => void;
  executeDecisionWithCapture: (id: number, decision: string, extra?: Record<string, unknown>) => Promise<ApiSuccessResponse>;
  onAcceptClick: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const shortageItems = (bp.items ?? []).filter((i) => (i.shortage_quantity ?? 0) > 0);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 truncate">Ruptures — {bp.bp_number}</h2>
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium border ${BP_STATUS[bp.status]?.color ?? 'bg-gray-100 text-gray-700'}`}>
                {BP_STATUS[bp.status]?.label ?? bp.status}
              </span>
            </div>
            {bp.delivery_mission && <p className="text-xs text-gray-400 mt-0.5">Mission {bp.delivery_mission.mission_number}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => openPdf('bp', bp.id, { force: true, watermark: bp.status === 'in_progress' ? 'DRAFT' : undefined })}
              title="Imprimer le BP (PDF)"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={() => downloadPdf('bp', bp.id)}
              title="Télécharger le BP (PDF)"
              className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700 transition-colors"
            >
              <Download className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="mt-3">
          <DecisionActionsBar
            subjectId={bp.id}
            subjectLabel={bp.bp_number}
            fetchDecisions={dispatcherApi.preparations.getDecisions}
            executeDecision={executeDecisionWithCapture}
            onActionDone={onRefresh}
            customDecisionHandlers={{ accept_partial_preparation: onAcceptClick }}
          />
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {/* review_partial_preparation analysis */}
        {reviewAnalysis && (
          <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-100 flex items-center gap-2">
              <Sparkles size={15} className="text-indigo-500 shrink-0" />
              <span className="text-sm font-semibold text-indigo-900">Analyse de la rupture</span>
            </div>
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Rupture</div>
                  <div className="font-bold text-gray-900">{reviewAnalysis.analysis.shortage_percentage}% ({reviewAnalysis.analysis.total_shortage}/{reviewAnalysis.analysis.total_requested})</div>
                </div>
                <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500 flex items-center gap-1"><Banknote size={11} /> Valeur</div>
                  <div className="font-bold text-gray-900">{reviewAnalysis.analysis.shortage_value.toLocaleString('fr-MA')} Dh</div>
                </div>
              </div>
              {reviewAnalysis.analysis.is_critical && (
                <div className="flex items-center gap-1.5 text-xs text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  <AlertTriangle size={12} className="shrink-0" /> {reviewAnalysis.analysis.critical_items_count} ligne(s) critique(s) (rupture/périssable/surgelé)
                </div>
              )}
              <div className={`flex items-center gap-1.5 text-xs rounded-lg px-3 py-2 border ${
                reviewAnalysis.recommended_action === 'accept_and_split'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-purple-700 bg-purple-50 border-purple-100'
              }`}>
                Recommandation : <strong>{reviewAnalysis.recommended_action === 'accept_and_split' ? 'Accepter et splitter' : 'Demander une reprise'}</strong>
              </div>
              {reviewAnalysis.decision_guidance && (
                <p className="text-xs text-gray-500 italic">{reviewAnalysis.decision_guidance}</p>
              )}
            </div>
          </div>
        )}

        {shortageItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune ligne en rupture pour ce BP</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span><strong>{shortageItems.length}</strong> ligne(s) en rupture dans ce BP</span>
            </div>

            <SageCollapsible
              title={`Lignes en rupture (${shortageItems.length})`}
              isOpen={open}
              onOpenChange={setOpen}
            >
              <div className="space-y-2 p-1">
                {shortageItems.map((item) => {
                  const rate = item.requested_quantity > 0
                    ? Math.round((item.shortage_quantity / item.requested_quantity) * 100)
                    : 0;
                  return (
                    <div key={item.id} className="bg-white border border-red-100 rounded-lg overflow-hidden px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-800">{item.product?.name ?? `Produit #${item.product_id}`}</div>
                        <div className="shrink-0 text-right">
                          <div className={`text-base font-bold ${rate > 50 ? 'text-red-700' : 'text-orange-600'}`}>
                            -{item.shortage_quantity}
                          </div>
                          <div className="text-xs text-red-400">{rate}% de rupture</div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span>Préparé: {item.prepared_quantity}</span>
                        <span>Demandé: {item.requested_quantity}</span>
                      </div>
                      {item.shortage_reason && (
                        <div className="text-xs text-gray-500 mt-1.5 italic">{item.shortage_reason}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SageCollapsible>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherShortageQueuePage = () => {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [reviewAnalysis, setReviewAnalysis] = useState<ReviewPartialPreparationOutput | null>(null);
  const [allocationView, setAllocationView] = useState(false);
  const [allocationStatus, setAllocationStatus] = useState<ShortageAllocationStatus>({ canConfirm: false, submitting: false, blockedCount: 0 });
  const allocationRef = useRef<ShortageAllocationHandle>(null);

  // Reset any in-progress allocation editing whenever the dispatcher switches BPs — the captured
  // review analysis (affected_bls) is specific to the previously selected BP.
  useEffect(() => {
    setReviewAnalysis(null);
    setAllocationView(false);
  }, [selectedId]);

  const { data, loading, error, refetch } = useDispatcherShortageQueue();
  const allBps = data?.data ?? [];
  // Worklist scope: BPs that still need a dispatcher decision (completed_partial just landed,
  // awaiting_shortage_review mid-flow, or partial_rework_requested waiting on the magasinier).
  // shortage_split_done/shortage_accepted are resolved — kept out of the active count.
  const queueStatuses: BpStatus[] = ['completed_partial', 'awaiting_shortage_review', 'partial_rework_requested'];
  const shortageItems = allBps.filter((b) => queueStatuses.includes(b.status));
  const selected = shortageItems.find((b) => b.id === selectedId) ?? null;

  // Captures review_partial_preparation's rich analysis (shortage value, recommended action,
  // per-line breakdown, and — since 2026-06-23 — shortage_details[].affected_bls, the only source
  // for the Quantity Controller table below) before handing the response back to
  // DecisionActionsBar — that output is too valuable to bury in a generic toast.
  const executeDecisionWithCapture = async (id: number, decision: string, extra?: Record<string, unknown>): Promise<ApiSuccessResponse> => {
    const res = await dispatcherApi.preparations.executeDecision(id, decision, extra);
    if (decision === 'review_partial_preparation' && res.success) {
      setReviewAnalysis(res.output as ReviewPartialPreparationOutput | undefined ?? null);
    }
    if (decision === 'accept_partial_preparation' || decision === 'request_rework') {
      setReviewAnalysis(null);
      setAllocationView(false);
    }
    return res;
  };

  // affected_bls only exists in review_partial_preparation's own execution output (no read
  // endpoint) — if this panel never captured it this session (e.g. opened directly on a BP
  // already awaiting_shortage_review from a prior session), there's currently no way to recover
  // it. Flagged to backend; for now, block with a clear message instead of opening an empty table.
  const handleAcceptClick = async () => {
    if (!selected) return;
    if (!reviewAnalysis) {
      const loadingToast = toast.loading('Récupération des données de répartition...');
      try {
        const res = await executeDecisionWithCapture(selected.id, 'review_partial_preparation');
        toast.dismiss(loadingToast);
        if (!res.success) {
          toast.error('Impossible de récupérer les données de répartition.');
          return;
        }
      } catch {
        toast.dismiss(loadingToast);
        toast.error('Erreur lors de la récupération des données.');
        return;
      }
    }
    setAllocationView(true);
  };

  const handleAllocationConfirmed = () => {
    setAllocationView(false);
    refetch();
  };

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'bp_number',
      headerName: 'N° BP',
      width: 160,
      cellRenderer: (p: { value: string }) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      headerName: 'Mission',
      width: 150,
      valueGetter: (p) => (p.data as PreparationOrder | undefined)?.delivery_mission?.mission_number ?? '—',
    },
    {
      headerName: 'Statut',
      width: 150,
      cellRenderer: (p: { data?: PreparationOrder }) => {
        const status = p.data?.status;
        const cfg = status ? BP_STATUS[status] : undefined;
        return cfg ? (
          <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${cfg.color}`}>{cfg.label}</span>
        ) : status ?? '—';
      },
    },
    {
      field: 'total_shortage_percentage',
      headerName: '% Rupture',
      width: 100,
      valueFormatter: (p: { value?: number }) => p.value != null ? `${p.value}%` : '—',
    },
    {
      field: 'created_at',
      headerName: 'Depuis',
      width: 110,
      valueFormatter: (p: { value?: string }) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
  ], []);

  return (
    <MasterLayout
      leftContent={
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h1 className="text-sm font-bold text-gray-900">File de ruptures</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${shortageItems.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                  {shortageItems.length}
                </span>
                <button onClick={refetch} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {shortageItems.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{shortageItems.length}</strong> BP(s) nécessitent une décision</span>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex-1 min-h-0 p-2">
            <div className="bg-white rounded-lg border border-gray-200 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : shortageItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
                  <Package className="w-12 h-12 mb-3 opacity-30" />
                  <div className="text-sm font-medium text-gray-500">Aucune rupture active</div>
                  <div className="text-xs mt-1">Tous les BP sont équilibrés</div>
                </div>
              ) : (
                <DataGrid
                  rowData={shortageItems}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: PreparationOrder) => setSelectedId(row.id)}
                />
              )}
            </div>
          </div>
        </div>
      }
      mainContent={
        selected ? (
          allocationView && reviewAnalysis ? (
            <div className="h-full flex flex-col bg-white">
              <div className="px-5 py-4 border-b border-gray-100 shrink-0 flex items-center gap-2">
                <button onClick={() => setAllocationView(false)} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                  <ChevronLeft className="w-4 h-4 text-gray-500" />
                </button>
                <div className="min-w-0">
                  <h2 className="text-base font-bold text-gray-900 truncate flex items-center gap-2">
                    <Split className="w-4 h-4 text-indigo-500 shrink-0" />
                    Répartition de la rupture — {selected.bp_number}
                  </h2>
                  <p className="text-xs text-gray-400 mt-0.5">Choisissez quel(s) BL absorbe(nt) le manquant, puis confirmez à droite.</p>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                <ShortageAllocationContent
                  ref={allocationRef}
                  bp={selected}
                  shortageDetails={reviewAnalysis.shortage_details}
                  onConfirmed={handleAllocationConfirmed}
                  showFooter={false}
                  onStatusChange={setAllocationStatus}
                />
              </div>
            </div>
          ) : (
            <ShortageDetailPanel
              key={selected.id}
              bp={selected}
              reviewAnalysis={reviewAnalysis}
              onClose={() => setSelectedId(null)}
              onRefresh={refetch}
              executeDecisionWithCapture={executeDecisionWithCapture}
              onAcceptClick={handleAcceptClick}
            />
          )
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <AlertTriangle className="w-14 h-14 text-amber-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">File de ruptures</h3>
              <p className="text-sm text-gray-400">Sélectionnez un BP pour examiner et résoudre la rupture</p>
            </div>
          </div>
        )
      }
      rightContent={
        allocationView ? (
          <ActionPanel
            groups={[
              {
                items: [
                  {
                    icon: Send,
                    label: 'Confirmer la répartition',
                    variant: 'primary',
                    onClick: () => allocationRef.current?.confirm(),
                    disabled: !allocationStatus.canConfirm || allocationStatus.submitting,
                  },
                  {
                    icon: ChevronLeft,
                    label: 'Retour',
                    onClick: () => setAllocationView(false),
                    disabled: allocationStatus.submitting,
                  },
                ],
              },
              ...(allocationStatus.blockedCount > 0 ? [{
                items: [
                  {
                    icon: AlertTriangle,
                    label: `${allocationStatus.blockedCount} article(s) non répartissable(s)`,
                    onClick: () => {},
                    disabled: true,
                  },
                ],
              }] : []),
            ]}
          />
        ) : (
          <ActionPanel
            groups={[
              {
                items: [
                  { icon: RefreshCw, label: 'Rafraîchir', variant: 'sage', onClick: refetch },
                ],
              },
            ]}
          />
        )
      }
    />
  );
};

export default DispatcherShortageQueuePage;
