import { useState, useEffect, useCallback } from 'react';
import { Loader2, CheckCircle2, AlertTriangle, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { gcomApi } from '@/services/api/gcomApi';
import { avoirAllocationsMatchTotal, avoirAllocationsWithinTotal } from '@/lib/gcom/avoirAllocations';
import type { GcomCreditNote, GcomAvoirAllocation } from '@/types/gcom.types';

// ─── Avoir-as-payment picker ─────────────────────────────────────────────────
// Shared by every screen that settles a sale with payment_method: 'avoir' —
// Comptoir (POST /direct-invoices), BC→Facture (orders/{order}/convert-to-invoice),
// BL→Facture (delivery-notes/{id}/convert-to-invoice), the 3 endpoints where
// `avoir_allocations` is actually required (2026-08-20). The backend rejects
// anything but an EXACT sum match against the sale total (422 "mixed avoir +
// another payment method is not supported yet") — this component exists
// mainly to make hitting that exact number easy instead of a plain form.

const fmtMAD = (n: number | string | undefined | null) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
};

// Same "authoritative live balance" rule as AvoirsPage.tsx — see
// gcomApi.ts's creditNotes.redeem() comment for the full explanation
// (including the known pre-2026-08-20 backfill gap).
const remaining = (cn: GcomCreditNote) => Number(cn.remaining_amount ?? cn.refund_amount) || 0;

export interface AvoirAllocationPickerProps {
    partnerId: number | null;
    total: number;
    value: GcomAvoirAllocation[];
    onChange: (allocations: GcomAvoirAllocation[]) => void;
    /** 'exact' (default) — payment_method: 'avoir' itself, the sum must match
     * the total exactly. 'partial' — avoir mixed with another payment method
     * (2026-08-20): the avoir only needs to cover part of the total, the
     * remainder is left for the sale's own payment_method to settle. */
    mode?: 'exact' | 'partial';
}

export const AvoirAllocationPicker = ({ partnerId, total, value, onChange, mode = 'exact' }: AvoirAllocationPickerProps) => {
    const [avoirs, setAvoirs] = useState<GcomCreditNote[]>([]);
    const [loading, setLoading] = useState(false);

    const load = useCallback(async () => {
        if (!partnerId) { setAvoirs([]); return; }
        setLoading(true);
        try {
            const res = await gcomApi.creditNotes.list({ partner_id: partnerId, status: 'APPROVED', per_page: 100 });
            setAvoirs(res.data.filter(cn => remaining(cn) > 0));
        } catch {
            toast.error('Erreur lors du chargement des avoirs du client');
            setAvoirs([]);
        } finally {
            setLoading(false);
        }
    }, [partnerId]);

    useEffect(() => { load(); }, [load]);
    // A partner switch invalidates any prior selection — different client, different avoirs.
    useEffect(() => { onChange([]); }, [partnerId]); // eslint-disable-line react-hooks/exhaustive-deps

    const allocatedFor = (id: number) => value.find(a => a.credit_note_id === id)?.amount ?? 0;
    const sum = value.reduce((s, a) => s + a.amount, 0);
    const remainingToCover = Math.max(0, total - sum);
    const overTotal = sum - total > 0.005;
    // In 'partial' mode any non-negative sum up to the total is a valid
    // state (0 selected = "not using an avoir", still fine) — only exceeding
    // the total is ever an error there. 'exact' mode keeps requiring the sum
    // to land exactly on the total.
    const valid = mode === 'exact' ? avoirAllocationsMatchTotal(value, total) : avoirAllocationsWithinTotal(value, total);

    const setAllocation = (cn: GcomCreditNote, amount: number) => {
        const capped = Math.max(0, Math.min(amount, remaining(cn)));
        const next = value.filter(a => a.credit_note_id !== cn.id);
        if (capped > 0) next.push({ credit_note_id: cn.id, amount: capped });
        onChange(next);
    };
    const toggle = (cn: GcomCreditNote) => {
        if (allocatedFor(cn.id) > 0) { setAllocation(cn, 0); return; }
        setAllocation(cn, Math.min(remaining(cn), remainingToCover || remaining(cn)));
    };

    // Greedy fill — picks avoirs in list order until the target is hit exactly
    // or exhausted. Fine for the common case (one or two avoirs); large
    // portfolios can still be adjusted by hand afterwards.
    const autoAllocate = () => {
        let need = total;
        const next: GcomAvoirAllocation[] = [];
        for (const cn of avoirs) {
            if (need <= 0.005) break;
            const take = Math.min(remaining(cn), need);
            if (take > 0) { next.push({ credit_note_id: cn.id, amount: take }); need -= take; }
        }
        onChange(next);
        // In 'exact' mode falling short is a real problem (the sale needs
        // avoir to cover 100%). In 'partial' mode it's expected — whatever's
        // left over is meant to be settled by the sale's own payment method.
        if (need > 0.005 && mode === 'exact') toast.error(`Les avoirs disponibles (${fmtMAD(total - need)}) ne couvrent pas le total (${fmtMAD(total)})`);
    };

    if (!partnerId) {
        return <p className="text-xs text-gray-400 italic">Sélectionnez d'abord un client.</p>;
    }
    if (loading) {
        return <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>;
    }
    if (avoirs.length === 0) {
        return <p className="text-xs text-amber-600">Ce client n'a aucun avoir disponible (approuvé, solde &gt; 0).</p>;
    }

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-[11px] text-gray-500">{avoirs.length} avoir(s) disponible(s)</span>
                <button
                    onClick={autoAllocate}
                    className="flex items-center gap-1 text-[11px] font-medium text-sage-600 hover:text-sage-700"
                >
                    <Wand2 className="w-3 h-3" /> Répartir automatiquement
                </button>
            </div>
            <GcomLinesTable
                rows={avoirs}
                rowKey={cn => cn.id}
                columns={[
                    {
                        key: 'select', header: '', align: 'center', width: 'w-8',
                        render: cn => (
                            <input
                                type="checkbox"
                                checked={allocatedFor(cn.id) > 0}
                                onChange={() => toggle(cn)}
                                className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                            />
                        ),
                    },
                    { key: 'number', header: 'N° Avoir', render: cn => <span className="font-mono font-semibold text-sage-600">{cn.credit_note_number ?? `#${cn.id}`}</span> },
                    { key: 'available', header: 'Disponible', align: 'right', render: cn => <span className="text-gray-600">{fmtMAD(remaining(cn))}</span> },
                    {
                        key: 'amount', header: 'Montant imputé', align: 'center', width: 'w-28',
                        render: cn => (
                            <input
                                type="number" min={0} max={remaining(cn)} step="0.01"
                                disabled={allocatedFor(cn.id) <= 0}
                                value={allocatedFor(cn.id) || ''}
                                placeholder="0"
                                onFocus={() => { if (allocatedFor(cn.id) <= 0) toggle(cn); }}
                                onChange={e => setAllocation(cn, parseFloat(e.target.value) || 0)}
                                className="w-24 text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-50"
                            />
                        ),
                    },
                ]}
            />
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium ${valid ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                <span className="flex items-center gap-1.5">
                    {valid ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertTriangle className="w-3.5 h-3.5" />}
                    {fmtMAD(sum)} / {fmtMAD(total)}
                </span>
                {overTotal ? (
                    <span>Dépasse le total</span>
                ) : mode === 'exact' ? (
                    !valid && <span>{`Reste ${fmtMAD(remainingToCover)}`}</span>
                ) : (
                    sum > 0 && <span>{`Reste ${fmtMAD(remainingToCover)} à régler via un autre moyen`}</span>
                )}
            </div>
        </div>
    );
};
