import { forwardRef, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { Loader2, CheckCircle2, Scale, Send, AlertTriangle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { Modal } from '@/components/common/Modal';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { ReviewPartialPreparationOutput } from '@/types/dispatcher.types';

// ─── Quantity Controller — manual per-BL shortage distribution ─────────────────────────────────
// Confirmed live by backend 2026-06-23 (docs §10, "second pass"): the system no longer
// auto-splits a shortage across the mission's BLs (used to be a silent, greedy first-BL-first
// depletion). accept_partial_preparation now REQUIRES `metadata.allocations: [{ bl_id, product_id,
// quantity }]` — the dispatcher's explicit choice of which customer's BL loses stock. Validated
// server-side: every bl_id must belong to the mission, no allocation may exceed that BL's
// `allocated_quantity`, and per product the allocations must sum to EXACTLY the shortage_quantity
// (full coverage, no partial/no leftover) — missing the field fails fast with `allocations_required`.
//
// The only source for this table's data is review_partial_preparation's own execution output
// (`shortage_details[].affected_bls`) — there is no separate read endpoint for it. That means if
// the dispatcher reloads the page after running review but before accepting, this data is gone
// and there's currently no way to get it back without backend adding a read endpoint (flagged).

type ShortageDetail = ReviewPartialPreparationOutput['shortage_details'][number];

interface BpForAllocation {
  id: number;
  bp_number: string;
}

export interface ShortageAllocationHandle {
  confirm: () => void;
}

export interface ShortageAllocationStatus {
  canConfirm: boolean;
  submitting: boolean;
  blockedCount: number;
}

interface ShortageAllocationContentProps {
  bp: BpForAllocation;
  shortageDetails: ShortageDetail[];
  onConfirmed: () => void;
  /** Renders its own Annuler/Confirmer footer when true (default) — set false when the host page
   * drives those actions itself (e.g. from a right-hand ActionPanel) via the imperative ref. */
  showFooter?: boolean;
  onClose?: () => void;
  onStatusChange?: (status: ShortageAllocationStatus) => void;
}

// Shared allocation editor — used both inline (Left/Center/Right dispatcher shortage screen) and
// inside a Modal (compact mission-workspace side panel, see ShortageAllocationModal below).
export const ShortageAllocationContent = forwardRef<ShortageAllocationHandle, ShortageAllocationContentProps>(
  ({ bp, shortageDetails, onConfirmed, showFooter = true, onClose, onStatusChange }, ref) => {
    // Greedy default split (first BL(s) absorb the shortage) — a starting point the dispatcher
    // rebalances, not a system decision (that's exactly the behavior backend removed server-side).
    const initialAllocations = useMemo(() => {
      const init: Record<number, Record<number, number>> = {};
      for (const detail of shortageDetails) {
        let remaining = Number(detail.shortage_quantity);
        const row: Record<number, number> = {};
        for (const bl of detail.affected_bls) {
          const give = Math.min(Number(bl.allocated_quantity), remaining);
          row[bl.bl_id] = give;
          remaining -= give;
        }
        init[detail.product_id] = row;
      }
      return init;
    }, [shortageDetails]);

    const prorataAllocations = useMemo(() => {
      const result: Record<number, Record<number, number>> = {};
      for (const detail of shortageDetails) {
        const target = Number(detail.shortage_quantity);
        let totalAlloc = 0;
        for (const bl of detail.affected_bls) {
          totalAlloc += Number(bl.allocated_quantity);
        }

        const row: Record<number, number> = {};
        if (totalAlloc === 0) {
          if (detail.affected_bls.length > 0) {
            row[detail.affected_bls[0].bl_id] = target;
          }
          result[detail.product_id] = row;
          continue;
        }

        let allocatedShortage = 0;
        const fractions: Array<{ bl_id: number; fraction: number }> = [];

        for (const bl of detail.affected_bls) {
          const exact = (Number(bl.allocated_quantity) / totalAlloc) * target;
          const rounded = Math.floor(exact);
          row[bl.bl_id] = rounded;
          allocatedShortage += rounded;
          fractions.push({ bl_id: bl.bl_id, fraction: exact - rounded });
        }

        let remainder = target - allocatedShortage;
        fractions.sort((a, b) => b.fraction - a.fraction);

        for (let i = 0; i < remainder; i++) {
          row[fractions[i % fractions.length].bl_id] += 1;
        }
        result[detail.product_id] = row;
      }
      return result;
    }, [shortageDetails]);

    const [allocations, setAllocations] = useState(initialAllocations);
    const [allocationMode, setAllocationMode] = useState<'manual' | 'prorata' | 'fifo'>('manual');
    const [reason, setReason] = useState('');
    const [submitting, setSubmitting] = useState(false);

    const setCell = (productId: number, blId: number, value: number) => {
      setAllocations((prev) => ({ ...prev, [productId]: { ...prev[productId], [blId]: value } }));
    };

    const currentAllocations =
      allocationMode === 'prorata' ? prorataAllocations :
      allocationMode === 'fifo' ? initialAllocations :
      allocations;

    const sumFor = (productId: number) =>
      Object.values(currentAllocations[productId] ?? {}).reduce((s, v) => s + (v || 0), 0);

    // A shortage line with zero affected_bls means no delivery note in this mission carries that
    // product at all — there's nothing to allocate it to, in ANY mode (manual/prorata/fifo). The
    // backend still requires exact per-product coverage though, so these lines block Confirm no
    // matter what the dispatcher does here; the UI's job is to make that unmistakably clear instead
    // of leaving a permanently-disabled button with no explanation (the bug this replaces).
    const blockedDetails = shortageDetails.filter((d) => d.affected_bls.length === 0);
    const blockedCount = blockedDetails.length;

    const allBalanced = shortageDetails.length > 0 && shortageDetails.every(
      (d) => sumFor(d.product_id) === Number(d.shortage_quantity)
    );
    const canConfirm = allBalanced && reason.trim().length > 0 && !submitting;

    useEffect(() => {
      onStatusChange?.({ canConfirm, submitting, blockedCount });
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canConfirm, submitting, blockedCount]);

    const handleConfirm = async () => {
      if (!canConfirm) return;
      setSubmitting(true);
      try {
        // Backend (docs §10, fixed 2026-06-23) always requires metadata.allocations: [{ bl_id,
        // product_id, quantity }] — the old server-side auto-split is gone. For FIFO mode we
        // compute the allocations client-side from initialAllocations (greedy first-BL-first,
        // equivalent to what the backend used to do automatically) instead of sending an
        // `allocation_mode` flag that the backend no longer accepts.
        const sourceAllocations = allocationMode === 'fifo' ? initialAllocations : currentAllocations;
        const allocationsPayload = shortageDetails.flatMap((detail) =>
          Object.entries(sourceAllocations[detail.product_id] ?? {})
            .filter(([, qty]) => qty > 0)
            .map(([blId, quantity]) => ({ bl_id: Number(blId), product_id: detail.product_id, quantity }))
        );
        const payload: Record<string, any> = {
          acceptance_reason: reason,
          allocations: allocationsPayload,
        };

        const res = await dispatcherApi.preparations.executeDecision(bp.id, 'accept_partial_preparation', payload);
        if (res.success) {
          toast.success(res.message || 'Rupture acceptée');
          onConfirmed();
          onClose?.();
        } else {
          toast.error(res.message || "Échec de l'acceptation");
        }
      } catch (err: any) {
        const violations = err?.response?.data?.violations as Array<{ reason: string }> | undefined;
        toast.error(violations?.length ? violations.map((v) => v.reason).join(' · ') : err?.response?.data?.message || "Échec de l'acceptation");
      } finally {
        setSubmitting(false);
      }
    };

    useImperativeHandle(ref, () => ({ confirm: handleConfirm }));

    const disabledReason = !allBalanced
      ? (blockedCount > 0
        ? `${blockedCount} article${blockedCount > 1 ? 's' : ''} sans BL associé ne peuvent pas être réparti${blockedCount > 1 ? 's' : ''} depuis cet écran — utilisez « Demander une reprise » à la place.`
        : 'La répartition doit couvrir exactement la rupture pour chaque article')
      : reason.trim().length === 0
      ? 'Un motif est requis'
      : undefined;

    return (
      <div className="space-y-4">
        {shortageDetails.length === 0 ? (
          <p className="text-sm text-gray-500 text-center py-6">Aucune ligne en rupture sur ce BP.</p>
        ) : (
          <>
            {blockedCount > 0 && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-xl">
                <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <div className="text-xs text-red-700 leading-relaxed">
                  <strong>{blockedCount} article{blockedCount > 1 ? 's' : ''} non répartissable{blockedCount > 1 ? 's' : ''}</strong> — aucun
                  BL de cette mission ne contient {blockedCount > 1 ? 'ces articles' : 'cet article'}. Cette rupture ne peut pas être
                  acceptée telle quelle depuis cet écran. Utilisez plutôt <strong>« Demander une reprise »</strong> ou contactez le support.
                </div>
              </div>
            )}

            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                onClick={() => setAllocationMode('manual')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${allocationMode === 'manual' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Manuelle
              </button>
              <button
                onClick={() => setAllocationMode('prorata')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${allocationMode === 'prorata' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Équitable (Prorata)
              </button>
              <button
                onClick={() => setAllocationMode('fifo')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${allocationMode === 'fifo' ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Automatique (FIFO)
              </button>
            </div>

            <div className="space-y-3 max-h-[45vh] overflow-y-auto">
              {allocationMode === 'prorata' && (
                <div className="bg-emerald-50 border border-emerald-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-emerald-800">
                    Les ruptures ont été réparties proportionnellement aux quantités demandées sur chaque BL.
                  </p>
                </div>
              )}
              {allocationMode === 'fifo' && (
                <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                  <p className="text-xs text-blue-800">
                    Répartition FIFO calculée — la rupture est imputée en priorité au premier BL jusqu'à épuisement, puis au suivant.
                  </p>
                </div>
              )}
              {shortageDetails.map((detail) => {
                const targetShortage = Number(detail.shortage_quantity);
                const sum = sumFor(detail.product_id);
                const balanced = sum === targetShortage;
                const isBlocked = detail.affected_bls.length === 0;

                return (
                  <div key={detail.product_id} className={`border rounded-xl overflow-hidden ${isBlocked ? 'border-red-200' : 'border-gray-200'}`}>
                    <div className={`px-3 py-2 border-b flex items-center justify-between gap-2 ${isBlocked ? 'bg-red-50 border-red-100' : 'bg-gray-50 border-gray-100'}`}>
                      <span className="text-sm font-semibold text-gray-800 truncate">{detail.product_name}</span>
                      {isBlocked ? (
                        <span className="flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full bg-gray-200 text-gray-600">
                          <AlertCircle size={12} />
                          Non répartissable
                        </span>
                      ) : (
                        <span className={`flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-full ${
                          balanced ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}>
                          {balanced ? <CheckCircle2 size={12} /> : <Scale size={12} />}
                          {sum} / {targetShortage} (rupture à couvrir)
                        </span>
                      )}
                    </div>

                    <div className="divide-y divide-gray-100">
                      {detail.affected_bls.length === 0 ? (
                        <p className="px-3 py-2.5 text-xs text-red-600 bg-red-50/50">
                          Aucun BL de la mission ne contient cet article — impossible à répartir depuis cet écran.
                        </p>
                      ) : detail.affected_bls.map((bl) => {
                        const value = currentAllocations[detail.product_id]?.[bl.bl_id] ?? 0;
                        const isReadOnly = allocationMode === 'prorata' || allocationMode === 'fifo';
                        return (
                          <div key={bl.bl_id} className="flex items-center justify-between gap-3 px-3 py-2">
                            <div className="min-w-0">
                              <span className="text-xs font-mono font-semibold text-gray-700">{bl.delivery_number}</span>
                              <span className="text-xs text-gray-400"> ({bl.partner_name})</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 text-xs text-gray-500">
                              <span>Alloué : <strong className="text-gray-700">{bl.allocated_quantity}</strong></span>
                              <span>À retirer :</span>
                              {isReadOnly ? (
                                <span className={`w-16 px-2 py-1 text-xs text-right font-bold rounded-lg ${
                                  allocationMode === 'prorata'
                                    ? 'text-emerald-700 bg-emerald-50 border border-emerald-100'
                                    : 'text-blue-700 bg-blue-50 border border-blue-100'
                                }`}>
                                  {value}
                                </span>
                              ) : (
                                <input
                                  type="number"
                                  min={0}
                                  max={bl.allocated_quantity}
                                  value={value}
                                  onChange={(e) => {
                                    const v = Math.min(Number(bl.allocated_quantity), Math.max(0, parseInt(e.target.value, 10) || 0));
                                    setCell(detail.product_id, bl.bl_id, v);
                                  }}
                                  className="w-16 px-2 py-1 text-xs text-right border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-300 outline-none"
                                />
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1.5">Motif de l'acceptation *</label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Raison de l'acceptation de la rupture…"
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-300 outline-none resize-none"
          />
        </div>

        {showFooter && (
          <div className="flex items-center gap-3 pt-2 border-t border-gray-100">
            <button
              onClick={onClose}
              disabled={submitting}
              className="flex-1 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Annuler
            </button>
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              title={disabledReason}
              className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              Confirmer
            </button>
          </div>
        )}
      </div>
    );
  }
);
ShortageAllocationContent.displayName = 'ShortageAllocationContent';

// Compact modal wrapper — kept for call sites that show this inside a side-panel/modal context
// (e.g. the mission workspace's quick BP review) rather than a full Left/Center/Right screen.
export const ShortageAllocationModal = ({
  bp,
  shortageDetails,
  onClose,
  onConfirmed,
}: {
  bp: BpForAllocation;
  shortageDetails: ShortageDetail[];
  onClose: () => void;
  onConfirmed: () => void;
}) => {
  const [submitting, setSubmitting] = useState(false);
  return (
    <Modal isOpen onClose={submitting ? () => {} : onClose} title={`Répartition de la rupture — BP ${bp.bp_number}`} size="lg">
      <div className="p-5">
        <ShortageAllocationContent
          bp={bp}
          shortageDetails={shortageDetails}
          onConfirmed={onConfirmed}
          onClose={onClose}
          onStatusChange={(s) => setSubmitting(s.submitting)}
        />
      </div>
    </Modal>
  );
};

export default ShortageAllocationModal;
