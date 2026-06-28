import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  Loader2, Package, Truck, User, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Route,
  Search, Filter, X, MapPin, UserCircle2, Box, Weight, AlertTriangle, MapPinned, Eye, GripVertical,
  Trash2, XCircle, CheckSquare, Square, Sparkles, Banknote, TrendingDown, Printer,
  Info, Phone, Calendar, ExternalLink, Copy, Check,
} from 'lucide-react';
import { openPdf } from '@/utils/pdfUtils';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { Modal } from '@/components/common/Modal';
import { DecisionActionsBar } from '@/components/dispatcher/DecisionActionsBar';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { CheckboxSearchDropdown, type CheckboxOption } from '@/components/dispatcher/CheckboxSearchDropdown';
import { LoadCapacityBar } from '@/components/dispatcher/LoadCapacityBar';
import { Highlight } from '@/components/dispatcher/Highlight';
import { BlDetailModal } from '@/components/dispatcher/BlDetailModal';
import { ShortageAllocationModal } from '@/components/dispatcher/ShortageAllocationModal';
import { computeMissionLoad } from '@/utils/missionLoad';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import { useDispatcherPendingOrders, useDispatcherOrderDetail } from '@/hooks/dispatcher/useDispatcherOrders';
import { useRidersWithVehicles } from '@/hooks/dispatcher/useDispatcherFleet';
import {
  useDeliveryMissionsList,
  useCreateDeliveryMission,
} from '@/hooks/dispatcher/useDispatcherDeliveryMissions';
import type { DeliveryMission, DispatcherOrder, OrdersPendingFilters, ReviewPartialPreparationOutput } from '@/types/dispatcher.types';

// ─── BC → Delivery Mission workspace (docs §8.1, 2026-06-20) ──────────────────
// Replaces the old two-screen Planning/Loading split: rider + vehicle are now picked at mission
// creation time, in the same call that selects the BCs — there's no longer a separate "seal the
// LOT" or "group into a BCH" step before assigning a rider.

// ─── Copy-to-clipboard micro-button ─────────────────────────────────────────
// Used next to every reference code (BC, BL, mission number) so the dispatcher
// can copy it without selecting text manually. Shows a check icon for 1.5 s.
const CopyButton = ({ text, className = '' }: { text: string; className?: string }) => {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };
  return (
    <button
      onClick={handleCopy}
      title={copied ? 'Copié !' : `Copier ${text}`}
      className={`shrink-0 p-0.5 rounded transition-colors ${
        copied ? 'text-emerald-500' : 'text-gray-300 hover:text-gray-500 hover:bg-gray-100'
      } ${className}`}
    >
      {copied ? <Check size={11} /> : <Copy size={11} />}
    </button>
  );
};


// Common cancel_delivery reasons (docs §7.7 just requires "min 10 chars", no enum) — a curated
// dropdown speeds up the frequent cases; "Autre" reveals a free-text textarea for anything else.
const BULK_CANCEL_REASON_PRESETS = [
  "Le partenaire a annulé sa demande de livraison.",
  "Adresse de livraison incorrecte ou introuvable.",
  "Rupture de stock définitive sur cette commande.",
  "Erreur de saisie sur la commande.",
  "Doublon de commande.",
  "Client injoignable.",
] as const;
const OTHER_REASON = '__other__';

// awaiting_shortage_review added 2026-06-23 — the mission now flips here atomically the moment
// its BP hits completed_partial, instead of staying passively `in_preparation`. Loops back to
// in_preparation on request_rework, then either ready or back here depending on whether the
// magasinier's continue_preparation fully resolved the shortage (see DeliveryMissionStatus).
const MISSION_STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  in_preparation: 'En préparation',
  awaiting_shortage_review: 'Rupture à examiner',
  ready: 'Prêt',
  in_transit: 'En transit',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

// draft is red, not neutral — a mission can land back here two ways: never confirmed yet, or
// reverted by a magasinier `reject_preparation` (Module 16 §6.6, confirmed live 2026-06-23: BP →
// rejected, mission + its BLs → draft, BCs stay attached). Either way it needs the dispatcher's
// attention, so it shouldn't look the same as the in-progress/healthy statuses.
const MISSION_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-red-100 text-red-700',
  in_preparation: 'bg-amber-100 text-amber-700',
  awaiting_shortage_review: 'bg-red-100 text-red-700',
  ready: 'bg-blue-100 text-blue-700',
  in_transit: 'bg-indigo-100 text-indigo-700',
  completed: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

// violations[].reason comes back from decision_denied errors — same extraction convention as
// DecisionActionsBar, duplicated locally so the bulk-cancel loop can report a precise per-BL
// reason instead of a generic "Échec".
const extractCancelErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'annulation";
};

type BulkCancelRow = {
  id: number;
  label: string;
  status: 'pending' | 'processing' | 'success' | 'error';
  message?: string;
};

// Sequential, animated bulk-cancel — cancel_delivery is per-BL (docs §7.7, no bulk endpoint
// exists backend-side), so this drives N individual `executeDecision` calls one at a time and
// renders live progress instead of firing them all in parallel (which would make a single
// idempotency/stock-release failure hard to attribute to the right BL).
const BulkCancelProgressModal = ({
  rows,
  processing,
  onClose,
}: {
  rows: BulkCancelRow[];
  processing: boolean;
  onClose: () => void;
}) => {
  const done = rows.filter((r) => r.status === 'success' || r.status === 'error').length;
  const failed = rows.filter((r) => r.status === 'error').length;
  const pct = rows.length > 0 ? Math.round((done / rows.length) * 100) : 0;

  return (
    <Modal isOpen onClose={processing ? () => {} : onClose} title="Annulation des BL sélectionnés" size="sm">
      <div className="p-5 space-y-4">
        <div>
          <div className="flex items-center justify-between text-xs text-gray-500 mb-1.5">
            <span>{done} / {rows.length} traités</span>
            <span>{pct}%</span>
          </div>
          <div className="h-2.5 w-full rounded-full bg-gray-100 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${failed > 0 ? 'bg-amber-500' : 'bg-emerald-500'}`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        <div className="max-h-64 overflow-y-auto space-y-1.5 -mx-1 px-1">
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-gray-50 text-xs">
              {r.status === 'pending' && <span className="w-3.5 h-3.5 rounded-full border-2 border-gray-300 shrink-0" />}
              {r.status === 'processing' && <Loader2 size={14} className="animate-spin text-blue-500 shrink-0" />}
              {r.status === 'success' && <CheckCircle2 size={14} className="text-emerald-500 shrink-0" />}
              {r.status === 'error' && <XCircle size={14} className="text-red-500 shrink-0" />}
              <span className="font-mono font-medium text-gray-700 truncate">{r.label}</span>
              {r.message && <span className="text-red-500 truncate ml-auto">{r.message}</span>}
            </div>
          ))}
        </div>

        {!processing && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <span className={`text-xs font-medium ${failed > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>
              {failed > 0 ? `${done - failed} réussi(s), ${failed} échec(s)` : `${done} BL annulé(s) avec succès`}
            </span>
            <button
              onClick={onClose}
              className="px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold hover:bg-gray-800 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ─── Drag a BC onto a mission to attach it (backend 2026-06-22, add_order_ids) ─────────────────
// One useDraggable instance per row — must be its own component (not a hook called inline inside
// .map()) since the list length changes as orders are checked off/added, which would otherwise
// violate the rules of hooks (call count has to stay stable across renders for a given component).
const DraggableOrderRow = ({
  order,
  checked,
  onToggle,
  onViewDetail,
}: {
  order: DispatcherOrder;
  checked: boolean;
  onToggle: () => void;
  onViewDetail: () => void;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { orderId: order.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={`flex items-center gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
        isDragging ? 'opacity-40' : ''
      } ${checked ? 'border-sage-400 bg-sage-50' : 'border-gray-100 hover:bg-gray-50'}`}
    >
      <div
        {...attributes}
        {...listeners}
        title="Glisser vers une mission pour l'ajouter directement"
        className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <GripVertical size={13} />
      </div>
      <label className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onToggle} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <span className="text-xs font-mono font-semibold text-gray-800 truncate">{order.order_code}</span>
            <CopyButton text={order.order_code} />
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {order.partner.name}{order.partner.city ? ` · ${order.partner.city}` : ''}
          </div>
          {order.salesperson_data?.salesperson?.name && (
            <div className="text-[10px] text-gray-400 truncate">{order.salesperson_data.salesperson.name}</div>
          )}
        </div>
      </label>
      <button
        onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
        title="Voir le détail du BC"
        className="shrink-0 p-1 rounded text-gray-300 hover:text-sage-500 hover:bg-sage-50 transition-colors"
      >
        <Info size={12} />
      </button>
    </div>
  );
};

// Statuses where the BP genuinely needs a dispatcher decision (docs §10) — `completed_partial`
// just landed and hasn't been analyzed yet, `awaiting_shortage_review` is mid-flow with
// accept/rework both available. `partial_rework_requested` is excluded: at that point the ball is
// back in the magasinier's court (continue_preparation), nothing for the dispatcher to arbitrate.
const SHORTAGE_NEEDS_DISPATCHER_REVIEW = new Set(['completed_partial', 'awaiting_shortage_review']);

// Inline "Quantity Control / Arbitrage" panel — surfaces the shortage straight on the mission
// card (no need to navigate to the separate Shortage Queue page) the moment the BP the dispatcher
// is already looking at needs review_partial_preparation/accept_partial_preparation/
// request_rework. There's no dedicated "mission status" for this — the mission itself stays
// in_preparation throughout (docs §3); the signal already lives on `mission.preparation_order.status`,
// no API change needed.
const MissionShortagePanel = ({
  bp,
  onRefresh,
}: {
  bp: NonNullable<DeliveryMission['preparation_order']>;
  onRefresh: () => void;
}) => {
  const [reviewAnalysis, setReviewAnalysis] = useState<ReviewPartialPreparationOutput | null>(null);
  const [showAllocationModal, setShowAllocationModal] = useState(false);
  const shortageItems = (bp.items ?? []).filter((i) => (i.shortage_quantity ?? 0) > 0);

  const executeDecisionWithCapture = async (id: number, decision: string, extra?: Record<string, unknown>) => {
    const res = await dispatcherApi.preparations.executeDecision(id, decision, extra);
    if (decision === 'review_partial_preparation' && res.success) {
      setReviewAnalysis((res.output as ReviewPartialPreparationOutput | undefined) ?? null);
    }
    if (decision === 'accept_partial_preparation' || decision === 'request_rework') {
      setReviewAnalysis(null);
    }
    return res;
  };

  // accept_partial_preparation's allocation table can only be built from
  // review_partial_preparation's own execution output (`shortage_details[].affected_bls`) — there
  // is no separate read endpoint for it (flagged to backend). If this card never saw that output
  // this session (e.g. page reloaded after review but before accept), there's currently no way to
  // recover it — review_partial_preparation itself is only offered while the BP is still
  // completed_partial, not once it's awaiting_shortage_review.
  const handleAcceptClick = async () => {
    if (!reviewAnalysis) {
      const loadingToast = toast.loading("Récupération des données de répartition...");
      try {
        const res = await executeDecisionWithCapture(bp.id, 'review_partial_preparation');
        toast.dismiss(loadingToast);
        if (!res.success) {
          toast.error("Impossible de récupérer les données de répartition.");
          return;
        }
      } catch (err) {
        toast.dismiss(loadingToast);
        toast.error("Erreur lors de la récupération des données.");
        return;
      }
    }
    setShowAllocationModal(true);
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50/50 overflow-hidden">
      <div className="px-4 py-2.5 bg-red-100/70 border-b border-red-200 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <AlertTriangle size={15} className="text-red-600 shrink-0" />
          <span className="text-xs font-bold text-red-800 truncate">
            Rupture à examiner — BP {bp.bp_number}
          </span>
        </div>
        <DecisionActionsBar
          subjectId={bp.id}
          subjectLabel={bp.bp_number}
          fetchDecisions={dispatcherApi.preparations.getContext}
          executeDecision={executeDecisionWithCapture}
          onActionDone={onRefresh}
          compact
          // accept_partial_preparation gets the Quantity Controller table instead of the generic
          // reason-only modal (requested 2026-06-23) — see ShortageAllocationModal.
          customDecisionHandlers={{ accept_partial_preparation: handleAcceptClick }}
        />
      </div>

      {showAllocationModal && reviewAnalysis && (
        <ShortageAllocationModal
          bp={bp}
          shortageDetails={reviewAnalysis.shortage_details}
          onClose={() => setShowAllocationModal(false)}
          onConfirmed={onRefresh}
        />
      )}

      <div className="p-3 space-y-2.5">
        {reviewAnalysis && (
          <div className="bg-white border border-indigo-100 rounded-lg overflow-hidden">
            <div className="px-3 py-2 bg-indigo-50 border-b border-indigo-100 flex items-center gap-1.5">
              <Sparkles size={13} className="text-indigo-500 shrink-0" />
              <span className="text-xs font-semibold text-indigo-900">Analyse de la rupture</span>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500">Rupture</div>
                  <div className="font-bold text-gray-900">
                    {reviewAnalysis.analysis.shortage_percentage}% ({reviewAnalysis.analysis.total_shortage}/{reviewAnalysis.analysis.total_requested})
                  </div>
                </div>
                <div className="p-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="text-gray-500 flex items-center gap-1"><Banknote size={10} /> Valeur</div>
                  <div className="font-bold text-gray-900">{reviewAnalysis.analysis.shortage_value.toLocaleString('fr-MA')} Dh</div>
                </div>
              </div>
              <div className={`flex items-center gap-1.5 text-[11px] rounded-lg px-2.5 py-1.5 border ${
                reviewAnalysis.recommended_action === 'accept_and_split'
                  ? 'text-emerald-700 bg-emerald-50 border-emerald-100'
                  : 'text-purple-700 bg-purple-50 border-purple-100'
              }`}>
                Recommandation : <strong>{reviewAnalysis.recommended_action === 'accept_and_split' ? 'Accepter et splitter' : 'Demander une reprise'}</strong>
              </div>
            </div>
          </div>
        )}

        {shortageItems.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium">
              <TrendingDown size={12} />
              {shortageItems.length} ligne(s) en rupture
            </div>
            {shortageItems.map((item) => (
              <div key={item.id} className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-red-100 text-[11px]">
                <span className="font-medium text-gray-700 truncate">{item.product?.name ?? `Produit #${item.product_id}`}</span>
                <span className="shrink-0 text-red-600 font-semibold">
                  {item.prepared_quantity}/{item.requested_quantity} (-{item.shortage_quantity})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const MissionCard = ({
  mission,
  onRefresh,
  searchQuery,
  onViewBl,
  defaultExpanded = false,
}: {
  mission: DeliveryMission;
  onRefresh: () => void;
  searchQuery: string;
  onViewBl: (blId: number) => void;
  defaultExpanded?: boolean;
}) => {
  const isDraftMission = mission.status === 'draft';
  // Specifically a magasinier rejection (not just "never confirmed yet") — only a mission that
  // already had a BP generated can have a `preparation_order`, so this combination is unambiguous.
  const isRejectedByMagasinier = isDraftMission && mission.preparation_order?.status === 'rejected';
  // Primary signal is now the mission's own status (set atomically with the BP, 2026-06-23) —
  // the BP-status check is kept as a fallback for any mission row that hasn't synced yet (e.g. a
  // stale list cache), not the source of truth anymore.
  const needsShortageReview =
    mission.status === 'awaiting_shortage_review' ||
    (!!mission.preparation_order && SHORTAGE_NEEDS_DISPATCHER_REVIEW.has(mission.preparation_order.status));
  // Auto-expand on first render if there's already a shortage waiting — the arbitrage panel is
  // useless to the dispatcher hidden behind a collapsed card. Only the initial mount matters here
  // (useState's lazy initializer runs once); afterwards the dispatcher's manual collapse wins.
  const [expanded, setExpanded] = useState(defaultExpanded || needsShortageReview);

  // ─── Bulk BL cancellation ────────────────────────────────────────────────
  // No bulk-cancel endpoint exists (docs §7.7 is per-BL) — selecting several BLs and clicking
  // "Annuler la sélection" drives the same `cancel_delivery` decision N times sequentially,
  // surfaced as a single animated progress modal instead of forcing the dispatcher to click
  // "Cancel Delivery" once per row.
  const [selectedBlIds, setSelectedBlIds] = useState<Set<number>>(new Set());
  const [showBulkReasonModal, setShowBulkReasonModal] = useState(false);
  const [bulkReasonChoice, setBulkReasonChoice] = useState<string>(BULK_CANCEL_REASON_PRESETS[0]);
  const [bulkReasonCustom, setBulkReasonCustom] = useState('');
  const bulkReason = bulkReasonChoice === OTHER_REASON ? bulkReasonCustom : bulkReasonChoice;
  const [bulkRows, setBulkRows] = useState<BulkCancelRow[] | null>(null);
  const [bulkProcessing, setBulkProcessing] = useState(false);

  // Bulk-cancel is draft-only — if the mission moves on (e.g. confirmed while this card was
  // already open with a selection mid-flight), drop any stale selection rather than leave it
  // sitting inert in state.
  useEffect(() => {
    if (!isDraftMission && selectedBlIds.size > 0) setSelectedBlIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDraftMission]);

  const toggleBlSelected = (id: number) => {
    setSelectedBlIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const allBlIds = (mission.delivery_notes ?? []).map((bl) => bl.id);
  const allBlsSelected = allBlIds.length > 0 && allBlIds.every((id) => selectedBlIds.has(id));
  const toggleSelectAllBls = () => {
    setSelectedBlIds(allBlsSelected ? new Set() : new Set(allBlIds));
  };

  const runBulkCancel = async () => {
    const ids = Array.from(selectedBlIds);
    const rows: BulkCancelRow[] = ids.map((id) => ({
      id,
      label: mission.delivery_notes?.find((bl) => bl.id === id)?.delivery_number ?? `#${id}`,
      status: 'pending',
    }));
    setShowBulkReasonModal(false);
    setBulkRows(rows);
    setBulkProcessing(true);

    for (const id of ids) {
      setBulkRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: 'processing' } : r)) ?? prev);
      try {
        const res = await dispatcherApi.bonLivraisons.executeDecision(id, 'cancel_delivery', { reason: bulkReason });
        setBulkRows((prev) =>
          prev?.map((r) => (r.id === id ? { ...r, status: res.success ? 'success' : 'error', message: res.success ? undefined : res.message } : r)) ?? prev
        );
      } catch (err) {
        setBulkRows((prev) => prev?.map((r) => (r.id === id ? { ...r, status: 'error', message: extractCancelErrorMessage(err) } : r)) ?? prev);
      }
    }

    setBulkProcessing(false);
    setSelectedBlIds(new Set());
    onRefresh();
  };

  // Auto-expand a card the moment it starts matching a search (e.g. typing a BL/BC code that
  // belongs to a currently-collapsed mission) — but don't fight the dispatcher if they manually
  // collapse it back while still typing, so only react to the true→true edge, not every keystroke.
  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  // Same one-shot expand on the false→true edge for shortage review — covers the case where a
  // BP this card already knows about transitions into a reviewable state on a background refetch
  // (the magasinier just finished picking elsewhere), not just on first mount.
  useEffect(() => {
    if (needsShortageReview) setExpanded(true);
  }, [needsShortageReview]);

  // Drop target for a dragged BC row — only a draft mission can accept add_order_ids (docs §8.6),
  // so non-draft missions stay registered as droppable (for a clear "rejected" hover state) but
  // never actually accept the drop.
  const { setNodeRef, isOver } = useDroppable({
    id: `mission-${mission.id}`,
    data: { missionId: mission.id, status: mission.status, missionNumber: mission.mission_number },
  });
  const showAcceptHighlight = isOver && isDraftMission;
  const showRejectHighlight = isOver && !isDraftMission;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
        showAcceptHighlight
          ? 'border-emerald-400 ring-2 ring-emerald-200'
          : showRejectHighlight
          ? 'border-red-300 ring-2 ring-red-100'
          : 'border-gray-200'
      }`}
    >
      {showAcceptHighlight && (
        <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={11} /> Relâchez pour ajouter cette BC à la mission
        </div>
      )}
      {showRejectHighlight && (
        <div className="px-4 py-1.5 bg-red-50 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
          <AlertTriangle size={11} /> Mission non modifiable (statut « {MISSION_STATUS_LABEL[mission.status] ?? mission.status} »)
        </div>
      )}
      {isRejectedByMagasinier && (
        <div className="px-4 py-1.5 bg-red-50 text-red-700 text-[11px] font-semibold flex items-center gap-1.5 border-b border-red-100">
          <AlertTriangle size={11} className="shrink-0" />
          Rejetée par le magasinier (BP {mission.preparation_order?.bp_number}) — corrigez puis confirmez à nouveau pour générer un nouveau BP.
        </div>
      )}
      <div
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <Route className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                <Highlight text={mission.mission_number} query={searchQuery} />
              </span>
              <CopyButton text={mission.mission_number} />
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${MISSION_STATUS_BADGE[mission.status] ?? 'bg-blue-100 text-blue-700'}`}>
                {MISSION_STATUS_LABEL[mission.status] ?? mission.status}
              </span>
              {/* Redundant once mission.status itself is awaiting_shortage_review (the status
                  badge above already reads "Rupture à examiner") — only shown as a fallback for
                  the legacy signal (BP-level status) in case the mission-level one hasn't synced. */}
              {needsShortageReview && mission.status !== 'awaiting_shortage_review' && (
                <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-red-100 text-red-700">
                  <AlertTriangle size={10} /> Rupture à examiner
                </span>
              )}
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="flex items-center gap-1"><User size={11} /> <Highlight text={mission.rider?.name ?? '—'} query={searchQuery} /></span>
              <span className="flex items-center gap-1"><Truck size={11} /> {mission.vehicle?.plate_number ?? mission.vehicle?.plate ?? '—'}</span>
              <span>{mission.bl_count ?? mission.delivery_notes?.length ?? 0} BL</span>
              {mission.delivery_date && (
                <span className="flex items-center gap-1 text-sage-600 font-medium">
                  <Calendar size={11} />
                  {new Date(mission.delivery_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' })}
                </span>
              )}
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </div>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <DecisionActionsBar
            subjectId={mission.id}
            subjectLabel={mission.mission_number}
            fetchDecisions={() => dispatcherApi.deliveryMissions.getDecisions(mission.id)}
            executeDecision={dispatcherApi.deliveryMissions.executeDecision}
            onActionDone={onRefresh}
            missionContext={{
              branchCode: mission.branch_code,
              currentRiderId: mission.rider_id,
              currentBls: (mission.delivery_notes ?? []).map((bl) => ({
                id: bl.id,
                label: `${bl.delivery_number}${bl.partner?.name ? ` — ${bl.partner.name}` : ''}`,
              })),
              currentOrders: (mission.delivery_notes ?? []).flatMap((bl) => {
                const ordersList = bl.orders || (bl.order ? [bl.order] : []);
                return ordersList.map((o) => ({
                  id: o.id,
                  label: `${o.order_code}${bl.partner?.name ? ` — ${bl.partner.name}` : ''}`,
                }));
              }),
            }}
          />

          {needsShortageReview && mission.preparation_order && (
            <MissionShortagePanel bp={mission.preparation_order} onRefresh={onRefresh} />
          )}

          {mission.delivery_notes && mission.delivery_notes.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                {/* Bulk-select/cancel is a draft-only convenience — once the magasinier has the
                    mission (in_preparation and beyond), amputating BLs out from under an active
                    picking run is exactly the unsafe edit "Modifier la préparation" exists to
                    prevent properly (full rollback flow). Selection checkboxes are hidden outright
                    rather than just disabling the button, so there's no dead UI implying it's
                    still possible. */}
                {isDraftMission ? (
                  <button
                    onClick={toggleSelectAllBls}
                    className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 hover:text-gray-700 transition-colors"
                  >
                    {allBlsSelected ? <CheckSquare size={14} className="text-sage-600" /> : <Square size={14} />}
                    Bons de livraison ({mission.delivery_notes.length})
                  </button>
                ) : (
                  <h4 className="text-xs font-semibold text-gray-500">Bons de livraison ({mission.delivery_notes.length})</h4>
                )}
                <div className="flex items-center gap-1.5">
                  {isDraftMission && selectedBlIds.size > 0 && (
                    <button
                      onClick={() => setShowBulkReasonModal(true)}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-white bg-red-600 hover:bg-red-700 transition-colors"
                    >
                      <Trash2 size={12} />
                      Annuler la sélection ({selectedBlIds.size})
                    </button>
                  )}
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => openPdf('mission', mission.id, { force: true })}
                      title="Imprimer le document mission complet (avec prix)"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-sage-700 hover:text-sage-800 hover:bg-sage-50 transition-colors border border-sage-200"
                    >
                      <Printer size={12} />
                      Imprimer mission
                    </button>
                    <button
                      onClick={() => openPdf('mission', mission.id, { force: true, prices: false })}
                      title="Copie chauffeur — sans prix"
                      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors border border-gray-200"
                    >
                      <Truck size={12} />
                      Copie chauffeur
                    </button>
                  </div>
                </div>
              </div>
              {mission.delivery_notes.map((bl) => (
                <div
                  key={bl.id}
                  className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border transition-colors ${
                    isDraftMission && selectedBlIds.has(bl.id) ? 'bg-sage-50 border-sage-200' : 'bg-gray-50 border-gray-100'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {isDraftMission && (
                      <button
                        onClick={() => toggleBlSelected(bl.id)}
                        title="Sélectionner ce BL"
                        className="shrink-0 text-gray-400 hover:text-sage-600 transition-colors"
                      >
                        {selectedBlIds.has(bl.id) ? <CheckSquare size={16} className="text-sage-600" /> : <Square size={16} />}
                      </button>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1">
                        <span className="text-xs font-mono font-semibold text-gray-800 truncate">
                          <Highlight text={bl.delivery_number} query={searchQuery} />
                        </span>
                        <CopyButton text={bl.delivery_number} />
                      </div>
                      <div className="flex items-center gap-1 text-[11px] text-gray-400 truncate">
                        <Highlight text={bl.partner?.name ?? ''} query={searchQuery} />
                        {bl.order?.order_code && (
                          <>
                            <span> · </span>
                            <Highlight text={bl.order.order_code} query={searchQuery} />
                            <CopyButton text={bl.order.order_code} />
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onViewBl(bl.id)}
                      title="Voir le détail du BL / de la BC liée"
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    <button
                      onClick={() => {
                        const blStatus = (bl as any).status as string | undefined;
                        const watermark = (blStatus === 'batched' || blStatus === 'confirmed') ? 'DRAFT' : undefined;
                        openPdf('bl', bl.id, { force: true, watermark });
                      }}
                      title="Imprimer le BL (PDF)"
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                    >
                      <Printer size={14} />
                    </button>
                    <DecisionActionsBar
                      subjectId={bl.id}
                      subjectLabel={bl.delivery_number ?? `BL #${bl.id}`}
                      fetchDecisions={dispatcherApi.bonLivraisons.getDecisions}
                      executeDecision={dispatcherApi.bonLivraisons.executeDecision}
                      onActionDone={onRefresh}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Aucun BL</p>
          )}
        </div>
      )}

      {showBulkReasonModal && (
        <Modal isOpen onClose={() => setShowBulkReasonModal(false)} title={`Annuler ${selectedBlIds.size} BL`} size="sm">
          <div className="p-5 space-y-4">
            <p className="text-xs text-gray-500">
              Cette raison sera appliquée aux {selectedBlIds.size} BL sélectionnés. Chacun sera annulé
              individuellement ({'"cancel_delivery"'}) — un BL en échec n'empêche pas les suivants de continuer.
            </p>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Raison de l'annulation *</label>
              <select
                value={bulkReasonChoice}
                onChange={(e) => setBulkReasonChoice(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 outline-none bg-white"
              >
                {BULK_CANCEL_REASON_PRESETS.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
                <option value={OTHER_REASON}>Autre (préciser)…</option>
              </select>
              {bulkReasonChoice === OTHER_REASON && (
                <textarea
                  rows={3}
                  value={bulkReasonCustom}
                  onChange={(e) => setBulkReasonCustom(e.target.value)}
                  placeholder="Min. 10 caractères…"
                  autoFocus
                  className="w-full mt-2 px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-red-300 outline-none resize-none"
                />
              )}
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowBulkReasonModal(false)}
                className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={runBulkCancel}
                disabled={bulkReason.trim().length < 10}
                className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl bg-red-600 hover:bg-red-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <Trash2 className="w-4 h-4" />
                Confirmer
              </button>
            </div>
          </div>
        </Modal>
      )}

      {bulkRows && (
        <BulkCancelProgressModal
          rows={bulkRows}
          processing={bulkProcessing}
          onClose={() => { setBulkRows(null); setBulkReasonChoice(BULK_CANCEL_REASON_PRESETS[0]); setBulkReasonCustom(''); }}
        />
      )}
    </div>
  );
};

// ─── BC detail modal ─────────────────────────────────────────────────────────
// Full-detail read-only view of a DispatcherOrder (BC). Uses a custom overlay so
// we have complete layout control — gradient header, KPI strip, side-by-side info
// columns, and a product line-items table.
// NOTE: order_products requires GET /backend/dispatcher/orders/{id} to include
// the `order_products` relation with nested `product` (name + sku). Ask Sadi9 to
// confirm this is eager-loaded on the show endpoint if the articles section is empty.
const BcDetailModal = ({ orderId, onClose }: { orderId: number; onClose: () => void }) => {
  const { data: order, loading } = useDispatcherOrderDetail(orderId);

  const fmtAmt = (v?: number | string | null) =>
    v != null ? `${Number(v).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD` : '—';
  const fmtDate = (d?: string | null) =>
    d ? new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const sp = (order?.salesperson_data?.salesperson ?? order?.salesperson ?? null) as { name: string; code?: string; phone?: string; id?: number } | null;
  const itin = order?.partner?.active_itineraries?.[0] ?? null;
  const fm   = order?.financial_metadata;
  const area = order?.partner?.geo_area;
  const products = order?.order_products ?? [];

  const bcStatusColor: Record<string, string> = {
    confirmed: 'bg-blue-500/20 text-blue-100 ring-blue-400/30',
    approved:  'bg-indigo-500/20 text-indigo-100 ring-indigo-400/30',
    pending:   'bg-amber-500/20 text-amber-100 ring-amber-400/30',
    cancelled: 'bg-red-500/20 text-red-100 ring-red-400/30',
    completed: 'bg-emerald-500/20 text-emerald-100 ring-emerald-400/30',
  };

  const infoRow = (label: string, value: React.ReactNode, highlight = false) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-400 shrink-0">{label}</span>
      <span className={`text-xs text-right ${highlight ? 'font-bold text-sage-700' : 'font-medium text-gray-800'}`}>
        {value}
      </span>
    </div>
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">

        {/* ── Gradient header ─────────────────────────────────────────────────── */}
        <div className="bg-gradient-to-br from-sage-600 via-sage-700 to-sage-900 px-6 pt-5 pb-0 shrink-0">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="min-w-0">
              {/* Status / canal chips */}
              <div className="flex items-center gap-2 flex-wrap mb-2">
                {order?.bc_status && (
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ring-1 ${bcStatusColor[order.bc_status] ?? 'bg-white/10 text-white ring-white/20'}`}>
                    {order.bc_status.replace(/_/g, ' ').toUpperCase()}
                  </span>
                )}
                {order?.canal && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-purple-500/25 text-purple-100 ring-1 ring-purple-400/30">
                    {order.canal}
                  </span>
                )}
                {order?.payment_status && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/80 ring-1 ring-white/20">
                    Paiement · {order.payment_status}
                  </span>
                )}
              </div>

              {/* BC code */}
              <h2 className="text-xl font-bold text-white tracking-tight truncate">
                {loading ? 'Chargement…' : (order?.order_code ?? '—')}
              </h2>
              {order && (
                <p className="mt-0.5 text-sm text-sage-200 truncate">
                  {order.partner.name}
                  {order.partner.city ? ` · ${order.partner.city}` : ''}
                  {order.order_date ? ` · ${fmtDate(order.order_date)}` : ''}
                </p>
              )}
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {order && (
                <button
                  onClick={() => openPdf('bc', order.id, { force: true })}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white text-sage-700 hover:bg-sage-50 text-xs font-bold shadow transition-colors"
                >
                  <Printer size={13} /> Imprimer BC
                </button>
              )}
              <button
                onClick={onClose}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors"
              >
                <X size={16} />
              </button>
            </div>
          </div>

          {/* KPI strip */}
          {order && (
            <div className="grid grid-cols-4 gap-px bg-white/10 rounded-t-xl overflow-hidden -mx-6 px-0">
              {[
                { label: 'Total TTC', value: fmtAmt(order.total_amount), accent: true },
                { label: 'Sous-total HT', value: fmtAmt(order.sub_total), accent: false },
                { label: 'TVA', value: fmtAmt(order.tax_amount), accent: false },
                { label: fm?.payment_method ? 'Mode paiement' : 'Livraison prévue',
                  value: fm?.payment_method ?? fmtDate(order.logistics_details?.delivery_date ?? order.due_date),
                  accent: false },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white/[0.07] px-4 py-3">
                  <p className="text-[10px] text-sage-200 uppercase tracking-wide">{kpi.label}</p>
                  <p className={`mt-0.5 text-sm font-bold truncate ${kpi.accent ? 'text-white' : 'text-sage-100'}`}>
                    {kpi.value}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── Scrollable body ──────────────────────────────────────────────────── */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-sage-500" />
          </div>
        ) : !order ? (
          <div className="flex-1 flex items-center justify-center py-20 text-sm text-gray-400">
            Commande introuvable
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-5">

            {/* ── Row 1 : Client | Commercial | Finances ─────────────────────── */}
            <div className="grid grid-cols-3 gap-4">

              {/* Client */}
              <div className="col-span-1 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                  <MapPin size={10} /> Client
                </h4>
                <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">{order.partner.name}</p>
                <p className="text-[11px] text-gray-400 font-mono mb-3">{order.partner.code}</p>
                <div className="space-y-0.5">
                  {order.partner.city    && infoRow('Ville',    order.partner.city)}
                  {order.partner.address && infoRow('Adresse',  order.partner.address)}
                  {area                  && infoRow('Zone',     area.name)}
                  {order.partner.delivery_zone && infoRow('Secteur', order.partner.delivery_zone)}
                  {itin && infoRow('Tournée', <span className="text-emerald-600">{itin.name}</span>)}
                  {order.partner.geo_lat && order.partner.geo_lng && infoRow('GPS',
                    <a
                      href={`https://maps.google.com/?q=${order.partner.geo_lat},${order.partner.geo_lng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-blue-600 hover:underline"
                    >
                      Voir sur carte <ExternalLink size={9} />
                    </a>
                  )}
                </div>
              </div>

              {/* Commercial */}
              <div className="col-span-1 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                  <User size={10} /> Commercial
                </h4>
                {sp ? (
                  <>
                    <p className="text-sm font-bold text-gray-900 mb-0.5 truncate">{sp.name}</p>
                    {sp.code && <p className="text-[11px] text-gray-400 font-mono mb-3">{sp.code}</p>}
                    <div className="space-y-0.5">
                      {sp.phone && infoRow('Tél.',
                        <a href={`tel:${sp.phone}`} className="inline-flex items-center gap-1 text-blue-600 hover:underline">
                          <Phone size={9} /> {sp.phone}
                        </a>
                      )}
                      {infoRow('Commande', fmtDate(order.order_date))}
                      {order.confirmed_at && infoRow('Confirmé', fmtDate(order.confirmed_at))}
                      {order.approved_at  && infoRow('Approuvé', fmtDate(order.approved_at))}
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-gray-400 mb-3">—</p>
                    <div className="space-y-0.5">
                      {infoRow('Commande', fmtDate(order.order_date))}
                      {order.confirmed_at && infoRow('Confirmé', fmtDate(order.confirmed_at))}
                      {order.approved_at  && infoRow('Approuvé', fmtDate(order.approved_at))}
                    </div>
                  </>
                )}
              </div>

              {/* Finances */}
              <div className="col-span-1 rounded-xl border border-gray-100 bg-gray-50/60 p-4">
                <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold text-gray-400 uppercase tracking-widest mb-3">
                  <Banknote size={10} /> Finances
                </h4>
                <div className="space-y-0.5">
                  {infoRow('Sous-total HT', fmtAmt(order.sub_total))}
                  {infoRow('TVA', fmtAmt(order.tax_amount))}
                  {infoRow('Total TTC', fmtAmt(order.total_amount), true)}
                  {fm?.payment_method && infoRow('Mode paiement', fm.payment_method)}
                  {infoRow('Livraison', fmtDate(order.logistics_details?.delivery_date ?? order.due_date))}
                  {fm?.is_credit_sale && (
                    <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-amber-50 border border-amber-200 px-3 py-1.5">
                      <TrendingDown size={11} className="text-amber-500 shrink-0" />
                      <span className="text-[11px] font-semibold text-amber-700">Vente à crédit</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Row 2 : Articles / Lignes de commande ─────────────────────── */}
            <div className="rounded-xl border border-gray-100 overflow-hidden">
              {/* Table header */}
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
                <h4 className="flex items-center gap-1.5 text-[10px] font-extrabold text-gray-500 uppercase tracking-widest">
                  <Package size={11} />
                  Articles
                  {products.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.5 rounded-full bg-sage-100 text-sage-700 text-[10px] font-bold">
                      {products.length}
                    </span>
                  )}
                </h4>
                {products.length > 0 && (
                  <span className="text-xs text-gray-500">
                    Total : <span className="font-bold text-sage-700">{fmtAmt(order.total_amount)}</span>
                  </span>
                )}
              </div>

              {products.length === 0 ? (
                <div className="px-4 py-8 text-center">
                  <Package size={28} className="mx-auto mb-2 text-gray-200" />
                  <p className="text-sm text-gray-400">Aucun article disponible</p>
                  <p className="text-[11px] text-gray-300 mt-1">
                    Demander au backend d'inclure <code className="bg-gray-100 px-1 rounded">order_products</code> dans{' '}
                    <code className="bg-gray-100 px-1 rounded">GET /dispatcher/orders/{'{id}'}</code>
                  </p>
                </div>
              ) : (
                <>
                  {/* Column headers */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-2 bg-gray-50/40 border-b border-gray-100 text-[10px] font-bold text-gray-400 uppercase tracking-wide">
                    <span>Produit</span>
                    <span className="text-right w-16">Qté</span>
                    <span className="text-right w-28">Prix unitaire</span>
                    <span className="text-right w-28">Total ligne</span>
                  </div>

                  {/* Rows */}
                  <div className="divide-y divide-gray-50">
                    {products.map((item, idx) => {
                      const qty       = Number(item.quantity);
                      const unitP     = item.final_price ?? item.price;
                      const lineTotal = qty * unitP;
                      const hasPromo  = item.final_price != null && item.final_price !== item.price;
                      const ref       = item.product?.code ?? item.product?.sku;
                      return (
                        <div
                          key={item.id}
                          className={`grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-3 items-center ${idx % 2 === 1 ? 'bg-gray-50/40' : ''}`}
                        >
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-gray-800 truncate">
                              {item.product?.name ?? `Produit #${item.product_id}`}
                            </p>
                            {ref && <p className="text-[10px] text-gray-400 font-mono">{ref}</p>}
                          </div>
                          <span className="w-16 text-right text-xs font-bold text-gray-700">
                            {qty} <span className="text-gray-400 font-normal">u.</span>
                          </span>
                          <span className="w-28 text-right text-xs text-gray-500">
                            {hasPromo && (
                              <span className="line-through text-gray-300 mr-1">{fmtAmt(item.price)}</span>
                            )}
                            {fmtAmt(unitP)}
                          </span>
                          <span className="w-28 text-right text-xs font-bold text-sage-700">
                            {fmtAmt(lineTotal)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Footer total */}
                  <div className="grid grid-cols-[1fr_auto_auto_auto] gap-x-4 px-4 py-3 bg-sage-50 border-t border-sage-100">
                    <span className="text-xs font-bold text-sage-800">
                      {products.length} article{products.length > 1 ? 's' : ''}
                    </span>
                    <span className="w-16" />
                    <span className="w-28 text-right text-[11px] text-sage-600 font-semibold">Total TTC</span>
                    <span className="w-28 text-right text-sm font-extrabold text-sage-700">
                      {fmtAmt(order.total_amount)}
                    </span>
                  </div>
                </>
              )}
            </div>

          </div>
        )}
      </div>
    </div>
  );
};

export const DispatcherMissionWorkspacePage = () => {
  const navigate = useNavigate();
  const location = useLocation();
  // Handoff from DispatcherOrdersPage's "Planifier (Mission)" button — selection made there
  // arrives via navigation state (one-shot, not a query param: shouldn't survive a refresh or be
  // bookmarkable) instead of being lost on redirect like before.
  const incomingOrderIds = (location.state as { preselectedOrderIds?: number[] } | null)?.preselectedOrderIds;
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>(incomingOrderIds ?? []);

  useEffect(() => {
    if (incomingOrderIds?.length) {
      toast.success(`${incomingOrderIds.length} commande(s) pré-sélectionnée(s) depuis la liste des commandes.`);
      // Clear the handoff state so it doesn't re-apply on a back-navigation or refresh.
      navigate(location.pathname, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [riderId, setRiderId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [deliveryDate, setDeliveryDate] = useState('');
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);
  const [createPanelOpen, setCreatePanelOpen] = useState<boolean>(() => {
    try { return localStorage.getItem('dispatcher:createPanelOpen') !== 'false'; }
    catch { return true; }
  });
  const toggleCreatePanel = () => setCreatePanelOpen((v) => {
    const next = !v;
    try { localStorage.setItem('dispatcher:createPanelOpen', String(next)); } catch {}
    return next;
  });

  const { data: riders, loading: ridersLoading } = useRidersWithVehicles({ status: 'active' });

  // A rider already carries their assigned vehicle(s) (GET /backend/riders/with-vehicles, docs
  // §12d) — no separate vehicle picker needed. Auto-select when the rider has exactly one
  // vehicle (the common case); let the dispatcher choose if there's more than one.
  const selectedRider = riders.find((r) => r.id === riderId);
  const riderVehicles = selectedRider?.vehicles ?? [];
  const selectedVehicle = riderVehicles.find((v) => v.id === vehicleId) ?? null;

  const handleSelectRider = (id: number | '') => {
    setRiderId(id);
    if (id === '') { setVehicleId(''); return; }
    const rider = riders.find((r) => r.id === id);
    const vs = rider?.vehicles ?? [];
    setVehicleId(vs.length === 1 ? vs[0].id : '');
  };

  // ─── BC pool search/filters ───────────────────────────────────────────────
  // `search` is a real, server-side param on GET /backend/dispatcher/orders/pending (docs §6).
  // "Zone de livraison" / "Secteur géo (ID)" were dropped — both required typing an internal
  // code/ID by heart and ignored the geo coordinates already present on every order. Replaced by
  // proximity smart-sort (below), which actually uses `partner.geo_lat`/`geo_lng`. Verified live
  // 2026-06-21: there is NO `city` param and NO name-based salesperson/itinerary search either —
  // "Commercial", "Tournée" and "Ville" are filtered client-side against the currently loaded
  // page until backend adds proper params (see note further down).
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [itineraryIds, setItineraryIds] = useState<number[]>([]);
  const [salespersonIds, setSalespersonIds] = useState<number[]>([]);

  const orderFilters = useMemo<OrdersPendingFilters>(() => ({
    per_page: 100,
    search: search || undefined,
  }), [search]);

  const activeFilterCount = [search, city].filter(Boolean).length
    + (itineraryIds.length > 0 ? 1 : 0) + (salespersonIds.length > 0 ? 1 : 0);

  const resetFilters = () => {
    setSearch(''); setCity('');
    setItineraryIds([]); setSalespersonIds([]);
  };

  const { data: pendingData, loading: ordersLoading, refetch: refetchOrders } = useDispatcherPendingOrders(orderFilters);
  const allOrders = pendingData?.data ?? [];

  // Options derived from the currently loaded page — no dedicated lookup endpoint exists yet.
  const itineraryOptions = useMemo<CheckboxOption[]>(() => {
    const map = new Map<number, string>();
    allOrders.forEach((o) => o.partner?.active_itineraries?.forEach((it) => {
      if (it.id != null) map.set(it.id, it.name);
    }));
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allOrders]);

  const salespersonOptions = useMemo<CheckboxOption[]>(() => {
    const map = new Map<number, string>();
    allOrders.forEach((o) => {
      const sp = o.salesperson_data?.salesperson;
      if (sp?.id != null) map.set(sp.id, sp.name);
    });
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allOrders]);

  const orders = useMemo((): Array<DispatcherOrder & { __distFromPrev?: number }> => {
    let list: DispatcherOrder[] = allOrders;
    // Client-side only — no backend `city` param exists on orders/pending (ask backend to add
    // one if this needs to work beyond the currently loaded page).
    if (city) {
      const needle = city.trim().toLowerCase();
      list = list.filter((o) => (o.partner?.city ?? '').toLowerCase().includes(needle));
    }
    if (itineraryIds.length > 0) {
      list = list.filter((o) => o.partner?.active_itineraries?.some((it) => it.id != null && itineraryIds.includes(it.id)));
    }
    if (salespersonIds.length > 0) {
      list = list.filter((o) => {
        const spId = o.salesperson_data?.salesperson?.id;
        return spId != null && salespersonIds.includes(spId);
      });
    }
    return list;
  }, [allOrders, city, itineraryIds, salespersonIds]);

  const { data: missions, loading: missionsLoading, refetch: refetchMissions } = useDeliveryMissionsList();
  const { create, loading: creating } = useCreateDeliveryMission();

  // Mission search — matches mission number, rider, vehicle plate, and (inside each mission)
  // every BL number / partner name / linked BC code, so a dispatcher can find a mission either by
  // its own identity or by something they remember about one of its BLs/BCs.
  const [missionSearch, setMissionSearch] = useState('');
  const [viewBlId, setViewBlId] = useState<number | null>(null);
  const [viewBcId, setViewBcId] = useState<number | null>(null);

  const filteredMissions = useMemo(() => {
    const q = missionSearch.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter((m) => {
      const haystack = [
        m.mission_number,
        m.rider?.name,
        m.vehicle?.plate_number,
        m.vehicle?.plate,
        ...(m.delivery_notes ?? []).flatMap((bl) => [bl.delivery_number, bl.partner?.name, bl.order?.order_code]),
      ];
      return haystack.some((v) => v?.toLowerCase().includes(q));
    });
  }, [missions, missionSearch]);

  // Computed from allOrders (unfiltered), not the visible filtered/sorted `orders` list — an
  // already-selected BC can fall outside the current filters and must still count toward load.
  const missionLoad = useMemo(
    () => computeMissionLoad(allOrders.filter((o) => selectedOrderIds.includes(o.id))),
    [allOrders, selectedOrderIds]
  );

  const toggleOrder = (id: number) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const refreshAll = () => {
    refetchOrders();
    refetchMissions();
  };

  // ─── Drag a BC onto a mission to attach it ─────────────────────────────────
  // Activation distance keeps a plain click on the row's checkbox/label working as a click —
  // only a sustained pointer move past 8px starts an actual drag, so the two interactions
  // (toggle-for-bulk-creation vs drag-to-attach-to-an-existing-mission) don't fight each other.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeDragOrder, setActiveDragOrder] = useState<DispatcherOrder | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ order: DispatcherOrder; missionId: number; missionNumber: string } | null>(null);
  const [confirmingDrop, setConfirmingDrop] = useState(false);

  const handleDragStart = (e: DragStartEvent) => {
    const orderId = e.active.data.current?.orderId as number | undefined;
    setActiveDragOrder(allOrders.find((o) => o.id === orderId) ?? null);
  };

  // Dropping doesn't attach immediately — it just stages the operation; the actual API call only
  // fires once the dispatcher confirms in the modal below, same "no surprise mutation from a
  // single gesture" principle as the rest of this workspace's destructive/structural actions.
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragOrder(null);
    const orderId = e.active.data.current?.orderId as number | undefined;
    const overData = e.over?.data.current as { missionId?: number; status?: string; missionNumber?: string } | undefined;
    if (!orderId || !overData?.missionId) return;
    if (overData.status !== 'draft') {
      toast.error(`Mission non modifiable (statut « ${MISSION_STATUS_LABEL[overData.status ?? ''] ?? overData.status} »).`);
      return;
    }
    const order = allOrders.find((o) => o.id === orderId);
    if (!order) return;
    setPendingDrop({ order, missionId: overData.missionId, missionNumber: overData.missionNumber ?? `#${overData.missionId}` });
  };

  const confirmAddOrderToMission = async () => {
    if (!pendingDrop) return;
    setConfirmingDrop(true);
    try {
      const res = await dispatcherApi.deliveryMissions.executeDecision(pendingDrop.missionId, 'update_delivery_mission', {
        add_order_ids: [pendingDrop.order.id],
      });
      if (res.success) {
        toast.success(res.message || 'BC ajoutée à la mission');
        setPendingDrop(null);
        refreshAll();
      } else {
        toast.error(res.message || "Échec de l'ajout");
      }
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string; violations?: Array<{ reason: string }> } } };
      const violations = e2?.response?.data?.violations;
      toast.error(
        violations?.length ? violations.map((v) => v.reason).join(' · ') : e2?.response?.data?.message ?? "Échec de l'ajout",
        { duration: 6000 }
      );
    } finally {
      setConfirmingDrop(false);
    }
  };

  const openCreateConfirm = () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Sélectionnez au moins une commande');
      return;
    }
    if (riderId === '' || vehicleId === '') {
      toast.error('Sélectionnez un livreur et un véhicule');
      return;
    }
    setShowCreateConfirm(true);
  };

  const handleCreateMission = async () => {
    if (selectedOrderIds.length === 0 || riderId === '' || vehicleId === '') return;
    try {
      const res = await create({
        order_ids: selectedOrderIds,
        rider_id: riderId,
        vehicle_id: vehicleId,
        notes: notes || undefined,
        delivery_date: deliveryDate || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Mission créée');
        setSelectedOrderIds([]);
        setNotes('');
        setDeliveryDate('');
        setShowCreateConfirm(false);
        refreshAll();
      } else {
        toast.error(res.message || 'Échec de la création');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; violations?: Array<{ reason: string }> } } };
      const violations = e?.response?.data?.violations;
      toast.error(
        violations?.length ? violations.map((v) => v.reason).join(' · ') : e?.response?.data?.message ?? 'Échec de la création',
        { duration: 6000 }
      );
    }
  };

  const leftContent = (
    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package size={16} className="text-sage-600" /> Commandes en attente
          </h1>
          <button
            onClick={() => navigate('/dispatcher/workspace/map')}
            title="Vue carte par géolocalisation"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <MapPinned size={13} /> Carte
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{selectedOrderIds.length} sélectionnée(s) / {orders.length}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
          <GripVertical size={10} /> Glissez une BC sur une mission brouillon pour l'y ajouter directement
        </p>

        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BC, partenaire…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-300 focus:border-sage-400 bg-gray-50"
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              activeFilterCount > 0 ? 'border-sage-400 bg-sage-50 text-sage-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={12} /> Filtres
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-sage-500 text-white text-[10px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={refetchOrders}
            className="flex items-center justify-center px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={12} />
          </button>
        </div>

      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {ordersLoading ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucune commande en attente</p>
        ) : (
          <div className="space-y-1.5">
            {orders.map((o) => (
              <DraggableOrderRow
                key={o.id}
                order={o}
                checked={selectedOrderIds.includes(o.id)}
                onToggle={() => toggleOrder(o.id)}
                onViewDetail={() => setViewBcId(o.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 space-y-6">
      {/* Mission creation form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Collapsible header */}
        <button
          onClick={toggleCreatePanel}
          className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-bold text-gray-800">
            <Route size={16} className="text-blue-500" /> Créer une mission
            {selectedOrderIds.length > 0 && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700">
                {selectedOrderIds.length} BC sélectionnée{selectedOrderIds.length > 1 ? 's' : ''}
              </span>
            )}
          </span>
          {createPanelOpen
            ? <ChevronUp size={15} className="text-gray-400" />
            : <ChevronDown size={15} className="text-gray-400" />}
        </button>

        {createPanelOpen && (
        <div className="px-5 pb-5 border-t border-gray-100 pt-4 space-y-3">
          {/* Livreur on its own row so the dropdown never overlaps sibling inputs */}
          <SearchSelectDropdown
            label="Livreur"
            options={riders.map((r) => ({
              id: r.id,
              label: r.name,
              sublabel: r.vehicles.length === 0 ? 'Sans véhicule' : r.vehicles.length > 1 ? `${r.vehicles.length} véhicules` : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
            }))}
            value={riderId}
            onChange={handleSelectRider}
            disabled={ridersLoading}
          />
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">
                Date de livraison <span className="text-gray-400 font-normal">(optionnel)</span>
              </label>
              <input
                type="date"
                value={deliveryDate}
                min={new Date().toISOString().split('T')[0]}
                onChange={(e) => setDeliveryDate(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Notes <span className="text-gray-400 font-normal">(optionnel)</span></label>
              <input
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
                placeholder="…"
              />
            </div>
          </div>

        {/* Vehicle — auto-selected from the rider's assignment (GET /riders/with-vehicles, §12d).
            A select only appears if the rider has more than one active vehicle. */}
        {riderId !== '' && (
          <div className="mt-3">
            {riderVehicles.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertTriangle size={14} className="shrink-0" /> Ce livreur n'a aucun véhicule assigné — assignez-en un depuis la Flotte avant de créer la mission.
              </div>
            ) : (
              <>
                {riderVehicles.length > 1 && (
                  <div className="mb-2">
                    <SearchSelectDropdown
                      label="Véhicule"
                      options={riderVehicles.map((v) => ({
                        id: v.id,
                        label: v.display_name ?? v.plate_number ?? v.plate ?? `#${v.id}`,
                        sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
                      }))}
                      value={vehicleId}
                      onChange={setVehicleId}
                    />
                  </div>
                )}

                {selectedVehicle && (
                  <div className="p-3 rounded-lg bg-sage-50 border border-sage-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck size={14} className="text-sage-500" />
                      <span className="text-sm font-bold text-sage-900">
                        {selectedVehicle.display_name ?? selectedVehicle.plate_number ?? selectedVehicle.plate}
                      </span>
                      {(selectedVehicle.make || selectedVehicle.model) && (
                        <span className="text-xs text-sage-600">{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-sage-700">
                        <Box size={12} /> Volume: <strong>{selectedVehicle.capacity_volume ?? '—'} m³</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-sage-700">
                        <Weight size={12} /> Charge: <strong>{selectedVehicle.payload_kg ?? selectedVehicle.capacity_weight ?? '—'} kg</strong>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Estimation de charge — backend a ajouté unit_volume_m3/unit_weight_kg sur
            order_products[].product 2026-06-22 (product_logistics_profiles →
            product_packaging_levels). Beaucoup de SKUs n'ont pas encore ces données renseignées
            (gap catalogue, pas un bug) — LoadCapacityBar le signale plutôt que de cacher l'écart. */}
        {selectedOrderIds.length > 0 && selectedVehicle && (
          <div className="mt-3">
            <LoadCapacityBar estimate={missionLoad} vehicle={selectedVehicle} />
          </div>
        )}

        <button
          onClick={openCreateConfirm}
          disabled={creating || selectedOrderIds.length === 0}
          className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Créer la mission ({selectedOrderIds.length} BC)
        </button>
        </div>
        )}
      </div>

      {/* Existing missions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">
            Missions ({filteredMissions.length}{missionSearch ? ` / ${missions.length}` : ''})
          </h2>
          <button onClick={refetchMissions} className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-400">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={missionSearch}
            onChange={(e) => setMissionSearch(e.target.value)}
            placeholder="Mission, livreur, BL, BC…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-sage-300 focus:border-sage-400 bg-white"
          />
        </div>

        {missionsLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : missions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune mission</p>
        ) : filteredMissions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune mission ne correspond à « {missionSearch} »</p>
        ) : (
          <div className="space-y-2">
            {filteredMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onRefresh={refreshAll}
                searchQuery={missionSearch}
                onViewBl={setViewBlId}
                defaultExpanded={!!missionSearch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // pointerWithin, not closestCenter — closestCenter always reports the nearest droppable as
  // "over" even when the pointer hasn't actually entered it yet, which made a mission card light
  // up the instant a drag started. pointerWithin only matches when the pointer is truly inside a
  // droppable's bounds, so the dispatcher can start a drag and move freely without any mission
  // falsely showing as the target until they're actually over one.
  return (
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />

      <DragOverlay>
        {activeDragOrder && (
          <div className="px-3 py-2 rounded-lg border-2 border-blue-400 bg-white shadow-2xl text-xs font-mono font-semibold text-gray-800 flex items-center gap-1.5">
            <GripVertical size={12} className="text-blue-400" />
            {activeDragOrder.order_code}
          </div>
        )}
      </DragOverlay>

      <Modal isOpen={showFilters} onClose={() => setShowFilters(false)} title="Filtres" size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-gray-500 flex items-center gap-1 mb-1">
              <MapPin size={11} /> Ville
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: Casablanca…"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Filtre local (page chargée) — pas encore de paramètre backend.</p>
          </div>

          <CheckboxSearchDropdown
            label="Tournée"
            icon={<Route size={11} />}
            options={itineraryOptions}
            selected={itineraryIds}
            onChange={setItineraryIds}
          />

          <CheckboxSearchDropdown
            label="Commercial"
            icon={<UserCircle2 size={11} />}
            options={salespersonOptions}
            selected={salespersonIds}
            onChange={setSalespersonIds}
          />
          <p className="text-[10px] text-gray-400 -mt-2">Filtres locaux (page chargée) — pas encore de paramètre backend.</p>

          <div className="flex gap-2 pt-2">
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium py-2 rounded-lg border border-red-100 hover:bg-red-50"
              >
                <X size={12} /> Réinitialiser
              </button>
            )}
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white font-semibold py-2 rounded-lg bg-sage-500 hover:bg-sage-600"
            >
              Appliquer
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCreateConfirm} onClose={() => setShowCreateConfirm(false)} title="Confirmer la création de mission" size="sm">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            <strong>{selectedOrderIds.length}</strong> commande(s) seront regroupées en une mission, assignée à{' '}
            <strong>{selectedRider?.name}</strong> avec le véhicule{' '}
            <strong>{selectedVehicle?.display_name ?? selectedVehicle?.plate_number}</strong>.
          </p>

          {missionLoad.itemCount > 0 && selectedVehicle && (
            <LoadCapacityBar estimate={missionLoad} vehicle={selectedVehicle} />
          )}

          {(deliveryDate || notes) && (
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600 space-y-1">
              {deliveryDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar size={11} className="text-sage-500 shrink-0" />
                  <span className="font-semibold text-gray-700">Livraison :</span>
                  {new Date(deliveryDate).toLocaleDateString('fr-FR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
                </div>
              )}
              {notes && (
                <div className="flex items-start gap-1.5">
                  <span className="font-semibold text-gray-700 shrink-0">Notes :</span> {notes}
                </div>
              )}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreateMission}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirmer
            </button>
            <button
              onClick={() => setShowCreateConfirm(false)}
              disabled={creating}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </Modal>

      <BlDetailModal blId={viewBlId} onClose={() => setViewBlId(null)} />
      {viewBcId !== null && <BcDetailModal orderId={viewBcId} onClose={() => setViewBcId(null)} />}

      <Modal
        isOpen={pendingDrop != null}
        onClose={() => { if (!confirmingDrop) setPendingDrop(null); }}
        title="Ajouter cette BC à la mission ?"
        size="sm"
      >
        {pendingDrop && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              <strong className="font-mono">{pendingDrop.order.order_code}</strong>
              {pendingDrop.order.partner?.name ? ` (${pendingDrop.order.partner.name})` : ''} sera attachée à la
              mission <strong>{pendingDrop.missionNumber}</strong>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmAddOrderToMission}
                disabled={confirmingDrop}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white disabled:opacity-60 transition-colors"
              >
                {confirmingDrop ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {confirmingDrop ? 'Ajout en cours…' : 'Confirmer'}
              </button>
              <button
                onClick={() => setPendingDrop(null)}
                disabled={confirmingDrop}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DndContext>
  );
};

export default DispatcherMissionWorkspacePage;
