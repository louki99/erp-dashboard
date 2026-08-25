import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    RotateCcw, RefreshCw, RotateCcw as ResetIcon, Filter, ChevronDown,
    Loader2, CheckCircle2, Banknote, Building2, FileText, Package, Plus, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import { gcomApi } from '@/services/api/gcomApi';
import { financeApi } from '@/services/api/financeApi';
import { getPartners } from '@/services/api/partnerApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useGcomParameters } from '@/hooks/useGcomParameters';
import { useCreditNotes, useCreditNote, useCreateFreeStandingCreditNote, useRedeemCreditNote } from '@/hooks/gcom/useGcomCreditNotes';
import type {
    GcomCreditNote, GcomCreditNoteStatus, GcomCreditNotesGlobalListFilters, GcomRefundMethod,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const CREDIT_NOTE_STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
    APPROVED: { label: 'Approuvé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    DRAFT: { label: 'Brouillon', dot: 'bg-gray-400', text: 'text-gray-500' },
    PENDING: { label: 'En attente', dot: 'bg-amber-500', text: 'text-amber-700' },
    REJECTED: { label: 'Rejeté', dot: 'bg-red-500', text: 'text-red-700' },
    CANCELLED: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-500' },
};
const StatusBadge = ({ status }: { status: string }) => {
    const m = CREDIT_NOTE_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const STATUS_TABS: { key: GcomCreditNoteStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Tous' },
    { key: 'APPROVED', label: 'Approuvés' },
    { key: 'PENDING', label: 'En attente' },
    { key: 'DRAFT', label: 'Brouillons' },
    { key: 'REJECTED', label: 'Rejetés' },
    { key: 'CANCELLED', label: 'Annulés' },
];

const REFUND_METHOD_LABEL: Record<GcomRefundMethod, string> = {
    cash: 'Espèces', cheque: 'Chèque', effet: 'Effet', card: 'Carte', transfer: 'Virement',
};
const REFUND_METHODS: { value: GcomRefundMethod; label: string }[] = [
    { value: 'cash', label: 'Espèces' },
    { value: 'cheque', label: 'Chèque' },
    { value: 'effet', label: 'Effet' },
    { value: 'card', label: 'Carte' },
    { value: 'transfer', label: 'Virement' },
];

// `remaining_amount` is the live, authoritative spendable balance — it's what
// both `redeem` (cash/cheque/etc.) and `payment_method: 'avoir'` allocations
// draw from (2026-08-20), so it's the only field that can't double-count a
// note as both "redeemed" and "still available". `refund_amount` stays a
// fixed historical total and is NOT the right field to gate actions on
// anymore — see gcomApi.ts's creditNotes.redeem() comment for the full
// explanation, including a known (now fixed) backend backfill gap.
const remaining = (cn: GcomCreditNote) => Number(cn.remaining_amount ?? cn.refund_amount) || 0;
const needsRedeem = (cn: GcomCreditNote) => remaining(cn) > 0;
const isRedeemed = (cn: GcomCreditNote) => (Number(cn.refund_amount) || 0) > 0 && remaining(cn) <= 0;

// ─── Create free-standing avoir modal (2026-09-02) — a pure commercial
// gesture with no originating invoice/order (invoice_id/order_id both null).
// Financial mutation, modal like every other one on this page. ─────────────

const CreateFreeStandingModal = ({
    searchPartners, onClose,
}: { searchPartners: (q: string) => Promise<ComboboxOption[]>; onClose: () => void }) => {
    const { maxFreeStandingCreditNoteAmount } = useGcomParameters();
    const [partner, setPartner] = useState<ComboboxOption | null>(null);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [saving, setSaving] = useState(false);
    const createFreeStanding = useCreateFreeStandingCreditNote();

    const confirm = async () => {
        if (!partner) { toast.error('Sélectionnez un client'); return; }
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) { toast.error('Montant invalide'); return; }
        if (!reason.trim()) { toast.error('Motif requis'); return; }
        setSaving(true);
        try {
            const cn = await createFreeStanding.mutateAsync({ partner_id: Number(partner.id), amount: parsed, reason: reason.trim() });
            toast.success(`Avoir ${cn.credit_note_number ?? `#${cn.id}`} créé`);
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de la création de l'avoir");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                        <RotateCcw className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Créer un avoir libre</h3>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                    Geste commercial sans facture d'origine — auto-approuvé, plafonné selon vos droits.
                </p>
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Client *</label>
                    <AsyncCombobox value={partner} onChange={setPartner} onSearch={searchPartners} placeholder="Rechercher un client…" />
                </div>
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant *</label>
                    <input
                        type="number" min={0.01} step="0.01" autoFocus
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                    {maxFreeStandingCreditNoteAmount != null && (
                        <p className="text-[11px] text-gray-400 mt-1">
                            Plafond sans dérogation : {maxFreeStandingCreditNoteAmount.toLocaleString('fr-MA')} MAD
                        </p>
                    )}
                </div>
                <div className="mb-5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                    <textarea
                        value={reason}
                        onChange={e => setReason(e.target.value)}
                        rows={2}
                        maxLength={255}
                        placeholder="Geste commercial, remise fidélité…"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={confirm}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Créer
                    </button>
                    <button onClick={onClose} disabled={saving} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Redeem modal — a financial mutation, one of the few places this
// codebase's "no modals" convention doesn't apply (matches the destructive-
// action exception used elsewhere in GCOM) ───────────────────────────────────

const RedeemModal = ({ creditNote, onClose }: { creditNote: GcomCreditNote; onClose: () => void }) => {
    const remainingAmount = remaining(creditNote);
    const [method, setMethod] = useState<GcomRefundMethod>('cash');
    const [reference, setReference] = useState('');
    const [amount, setAmount] = useState(String(remainingAmount));
    const [saving, setSaving] = useState(false);
    const redeemCreditNote = useRedeemCreditNote();

    const confirm = async () => {
        const parsed = parseFloat(amount);
        if (!parsed || parsed <= 0) { toast.error('Montant invalide'); return; }
        if (parsed - remainingAmount > 0.005) { toast.error(`Le montant dépasse le solde disponible (${fmtMAD(remainingAmount)})`); return; }
        setSaving(true);
        try {
            const isFull = Math.abs(parsed - remainingAmount) < 0.005;
            await redeemCreditNote.mutateAsync({
                id: creditNote.id,
                payload: { method, reference: reference.trim() || undefined, amount: isFull ? undefined : parsed },
            });
            toast.success(isFull ? 'Avoir remboursé intégralement — caisse mise à jour' : 'Remboursement partiel enregistré — caisse mise à jour');
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors du remboursement');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                        <Banknote className="w-4 h-4 text-amber-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Rembourser l'avoir</h3>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    <strong>{creditNote.credit_note_number ?? `Avoir #${creditNote.id}`}</strong> — {fmtMAD(remainingAmount)} disponible pour <strong>{creditNote.partner?.name ?? 'ce client'}</strong>.
                </p>
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant à rembourser</label>
                    <input
                        type="number" min={0.01} max={remainingAmount} step="0.01"
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                    {parseFloat(amount) > 0 && parseFloat(amount) < remainingAmount && (
                        <p className="text-[11px] text-amber-600 mt-1">Reliquat après ce remboursement : {fmtMAD(remainingAmount - parseFloat(amount))}</p>
                    )}
                </div>
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Mode de remboursement</label>
                    <select
                        value={method}
                        onChange={e => setMethod(e.target.value as GcomRefundMethod)}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                    >
                        {REFUND_METHODS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                </div>
                <div className="mb-5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Référence (optionnel)</label>
                    <input
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        placeholder="N° pièce de caisse, chèque…"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={confirm}
                        disabled={saving}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                    >
                        {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Confirmer le remboursement
                    </button>
                    <button onClick={onClose} disabled={saving} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Detail panel — avoir + facture + partenaire réunis, inline in the center
// pane like every other GCOM document screen (no modal for read-only detail) ──

const AvoirDetailPanel = ({ creditNote, detailLoading, onRedeem }: { creditNote: GcomCreditNote; detailLoading: boolean; onRedeem: () => void }) => {
    const navigate = useNavigate();

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-4 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{creditNote.credit_note_number ?? `#${creditNote.id}`}</span>
                    <StatusBadge status={creditNote.status} />
                    {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{creditNote.partner?.name ?? '—'}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{fmtDate(creditNote.created_at)} · Total {fmtMAD(creditNote.total_amount)}</p>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {/* ── Montants ─────────────────────────────────────────── */}
                <div className="bg-white rounded-lg border border-gray-100 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Montants</p>
                    <div className="grid grid-cols-2 gap-3 text-sm">
                        <div><span className="text-gray-500">Sous-total</span><p className="font-semibold text-gray-900">{fmtMAD(creditNote.subtotal)}</p></div>
                        <div><span className="text-gray-500">TVA</span><p className="font-semibold text-gray-900">{fmtMAD(creditNote.tax_amount)}</p></div>
                        <div><span className="text-gray-500">Total avoir</span><p className="font-bold text-gray-900">{fmtMAD(creditNote.total_amount)}</p></div>
                        <div>
                            <span className="text-gray-500">Solde disponible</span>
                            <p className={`font-bold ${needsRedeem(creditNote) ? 'text-amber-600' : 'text-gray-900'}`}>{fmtMAD(remaining(creditNote))}</p>
                        </div>
                    </div>
                    {(Number(creditNote.consumed_amount) || 0) > 0 && (
                        <p className="text-[11px] text-gray-500 mt-2">
                            dont <strong>{fmtMAD(creditNote.consumed_amount)}</strong> utilisé en paiement d'une vente{creditNote.imputed_at && ` le ${fmtDateTime(creditNote.imputed_at)}`}
                        </p>
                    )}
                    {needsRedeem(creditNote) ? (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                            <span className="text-xs text-amber-600 font-medium">Remboursement disponible</span>
                            <button
                                onClick={onRedeem}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                            >
                                <Banknote className="w-3.5 h-3.5" /> Rembourser
                            </button>
                        </div>
                    ) : isRedeemed(creditNote) && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-xs text-emerald-700">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Solde entièrement soldé
                            {creditNote.refund_processed_at && <> — dernier remboursement par {REFUND_METHOD_LABEL[creditNote.refund_method as GcomRefundMethod] ?? creditNote.refund_method} le {fmtDateTime(creditNote.refund_processed_at)}{creditNote.refund_reference && ` (réf. ${creditNote.refund_reference})`}</>}
                        </div>
                    )}
                </div>

                {/* ── Origine ──────────────────────────────────────────── */}
                <div className="bg-white rounded-lg border border-gray-100 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Origine</p>
                    <div className="space-y-1.5 text-sm">
                        {creditNote.reason && <p><span className="text-gray-500">Motif</span> — {creditNote.reason}</p>}
                        {creditNote.return_reason && <p><span className="text-gray-500">Raison retour</span> — {creditNote.return_reason}</p>}
                        <p><span className="text-gray-500">Émis le</span> — {fmtDate(creditNote.created_at)}</p>
                    </div>
                </div>

                {/* ── Facture ──────────────────────────────────────────── */}
                {creditNote.invoice && (
                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><FileText className="w-3 h-3" /> Facture d'origine</p>
                        <div className="flex items-center justify-between">
                            <div>
                                <button
                                    onClick={() => navigate(`/gcom/factures?id=${creditNote.invoice!.id}`)}
                                    className="text-sm font-semibold text-sage-600 hover:underline"
                                >
                                    {creditNote.invoice.invoice_number ?? `#${creditNote.invoice.id}`}
                                </button>
                                <p className="text-xs text-gray-500 mt-0.5">Total {fmtMAD(creditNote.invoice.total_amount)}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Partenaire ───────────────────────────────────────── */}
                {creditNote.partner && (
                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Building2 className="w-3 h-3" /> Client</p>
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm font-semibold text-gray-900">{creditNote.partner.name}</p>
                                <p className="text-xs text-gray-500 font-mono">{creditNote.partner.code}</p>
                            </div>
                            <button
                                onClick={() => navigate(`/gcom/reglement?partnerId=${creditNote.partner!.id}&tab=ledger`)}
                                className="text-xs font-medium text-sage-600 hover:underline"
                            >
                                Relevé de compte →
                            </button>
                        </div>
                    </div>
                )}

                {/* ── Lignes ───────────────────────────────────────────── */}
                {creditNote.items && creditNote.items.length > 0 && (
                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2 flex items-center gap-1.5"><Package className="w-3 h-3" /> Articles restockés</p>
                        <div className="divide-y divide-gray-100">
                            {creditNote.items.map(it => (
                                <div key={it.id} className="flex items-center justify-between py-1.5 text-xs">
                                    <span className="text-gray-700">Produit #{it.product_id}</span>
                                    <span className="text-gray-500">{it.quantity} — {it.is_restocked ? 'restocké' : 'non restocké'}{it.return_reason ? ` (${it.return_reason})` : ''}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const AvoirsPage = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // 2026-09-02 — free-standing avoir creation gating. See
    // BonCommandePage.tsx's identical comment for the usePermissions/
    // admin-bypass rationale.
    const { has } = usePermissions();
    const canCreateFreeStanding = has('gcom-credit-note-free-standing');
    const [createFreeStandingOpen, setCreateFreeStandingOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState<GcomCreditNoteStatus | 'ALL'>('ALL');
    const [partnerFilter, setPartnerFilter] = useState<ComboboxOption | null>(null);
    const [branchFilter, setBranchFilter] = useState<ComboboxOption | null>(null);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const creditNotesFilters = useMemo((): GcomCreditNotesGlobalListFilters => {
        const filters: GcomCreditNotesGlobalListFilters = { per_page: 100 };
        if (statusFilter !== 'ALL') filters.status = statusFilter;
        if (partnerFilter) filters.partner_id = Number(partnerFilter.id);
        if (branchFilter) filters.branch_id = Number(branchFilter.id);
        if (dateFrom) filters.from = dateFrom;
        if (dateTo) filters.to = dateTo;
        return filters;
    }, [statusFilter, partnerFilter, branchFilter, dateFrom, dateTo]);
    const creditNotesQuery = useCreditNotes(creditNotesFilters);
    const rows = useMemo(() => creditNotesQuery.data?.data ?? [], [creditNotesQuery.data]);
    const loading = creditNotesQuery.isLoading;
    // Collapsed by default — the filter block ate most of the left panel's
    // vertical space, crowding out the grid it's supposed to be filtering.
    const [filtersOpen, setFiltersOpen] = useState(false);

    const [selectedId, setSelectedId] = useState<number | null>(null);
    const creditNoteDetailQuery = useCreditNote(selectedId);
    const selected = creditNoteDetailQuery.data ?? null;
    const detailLoading = creditNoteDetailQuery.isLoading;
    const [redeemTarget, setRedeemTarget] = useState<GcomCreditNote | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    // PDF only exists for an invoice-linked avoir (POST /invoices/{invoice}/
    // credit-notes/{creditNote}/pdf) — a free-standing one (no invoice_id) has
    // no PDF route at all yet, backend-confirmed gap, not something to build
    // a button for. Gate strictly on `creditNote.invoice`, not just presence
    // of an id, to match what the ActionPanel's "Voir la facture" already checks.
    const openAvoirPdf = async (creditNote: GcomCreditNote) => {
        if (!creditNote.invoice) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.invoices.getCreditNotePdfBlobUrl(creditNote.invoice.id, creditNote.id);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    const searchPartners = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        const res = await getPartners({ q, per_page: 30 });
        return (res.partners.data ?? []).map(p => ({ id: p.id, label: p.name, sub: p.code }));
    }, []);
    const searchBranches = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
        return (res.data ?? []).map(b => ({ id: b.id, label: b.name, sub: b.code }));
    }, []);

    // Row click selects an avoir — useCreditNote(selectedId) fetches the
    // single-GET detail (picks up items[], not present on the list rows),
    // same pattern as BC/BL/Facture.
    const selectRow = useCallback((cn: { id: number }) => {
        setSelectedId(cn.id);
    }, []);

    // Deep-link (?id=) — the single-GET endpoint was added specifically for this.
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) setSelectedId(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleReset = () => {
        setStatusFilter('ALL');
        setPartnerFilter(null);
        setBranchFilter(null);
        setDateFrom('');
        setDateTo('');
    };
    const activeFilterCount = [statusFilter !== 'ALL', !!partnerFilter, !!branchFilter, !!dateFrom, !!dateTo].filter(Boolean).length;
    const hasActiveFilters = activeFilterCount > 0;

    const pendingRefundTotal = useMemo(
        () => rows.filter(needsRedeem).reduce((sum, cn) => sum + remaining(cn), 0),
        [rows],
    );

    const handleManualRefresh = () => {
        creditNotesQuery.refetch();
        creditNoteDetailQuery.refetch();
    };

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'credit_note_number', headerName: 'N° Avoir', width: 150,
            cellRenderer: (p: ICellRendererParams<GcomCreditNote, string>) => (
                <span className="font-mono text-xs font-semibold text-sage-600">{p.value ?? `#${p.data?.id}`}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 140,
            valueGetter: (p: ValueGetterParams<GcomCreditNote>) => p.data?.partner?.name ?? '',
            cellRenderer: (p: ICellRendererParams<GcomCreditNote, string>) => <span className="text-xs font-medium text-gray-800">{p.value || '—'}</span>,
        },
        {
            colId: 'remaining_amount', headerName: 'Solde', width: 110, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomCreditNote>) => p.data ? remaining(p.data) : 0,
            cellRenderer: (p: ICellRendererParams<GcomCreditNote, number>) => (
                <span className={`text-xs font-bold ${p.value! > 0 ? 'text-amber-700' : 'text-gray-400'}`}>{p.value! > 0 ? fmtMAD(p.value) : '—'}</span>
            ),
        },
        {
            field: 'status', headerName: 'Statut', width: 100, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomCreditNote>) => p.data ? <StatusBadge status={p.data.status} /> : null,
        },
    ], []);

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-200 flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-2.5">
                <div className="flex items-center gap-2">
                    <RotateCcw className="w-4 h-4 text-amber-600" />
                    <h2 className="text-sm font-bold text-gray-900">Avoirs</h2>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{rows.length}</span>
                    <button onClick={handleManualRefresh} disabled={loading} className="ml-auto p-1 text-gray-400 hover:text-sage-600 disabled:opacity-50" title="Rafraîchir">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                {pendingRefundTotal > 0 && (
                    <p className="text-[11px] text-amber-600 font-medium">{fmtMAD(pendingRefundTotal)} en attente de remboursement</p>
                )}

                <button
                    onClick={() => setFiltersOpen(v => !v)}
                    className="w-full flex items-center justify-between px-2.5 py-1.5 text-xs font-medium text-gray-600 bg-gray-50 border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
                >
                    <span className="flex items-center gap-1.5">
                        <Filter className="w-3.5 h-3.5 text-sage-600" />
                        Filtres
                        {activeFilterCount > 0 && (
                            <span className="inline-flex items-center justify-center min-w-[16px] h-4 px-1 text-[10px] font-semibold rounded-full bg-sage-600 text-white">{activeFilterCount}</span>
                        )}
                    </span>
                    <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${filtersOpen ? 'rotate-180' : ''}`} />
                </button>

                {filtersOpen && (
                    <div className="space-y-2.5">
                        <div className="flex flex-wrap gap-1">
                            {STATUS_TABS.map(opt => (
                                <button
                                    key={opt.key}
                                    onClick={() => setStatusFilter(opt.key)}
                                    className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                                        statusFilter === opt.key ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>

                        <AsyncCombobox value={partnerFilter} onChange={setPartnerFilter} onSearch={searchPartners} placeholder="Filtrer par client…" />
                        <AsyncCombobox value={branchFilter} onChange={setBranchFilter} onSearch={searchBranches} placeholder="Toutes les agences…" />
                        <div className="grid grid-cols-2 gap-1.5">
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} title="Du" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} title="Au" className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                        </div>
                        {hasActiveFilters && (
                            <button
                                onClick={handleReset}
                                className="flex items-center gap-1.5 text-[11px] font-medium text-gray-500 hover:text-gray-700"
                            >
                                <ResetIcon className="w-3 h-3" /> Réinitialiser les filtres
                            </button>
                        )}
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={rows}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowSelection="single"
                    onRowClicked={e => { if (e.data) { selectRow(e.data); navigate(`/gcom/avoirs?id=${e.data.id}`, { replace: true }); } }}
                    defaultSelectedIds={row => row.id === selected?.id}
                />
            </div>
        </div>
    );

    const mainContent = !selected ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
            <RotateCcw className="w-12 h-12 mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-600 mb-1">Avoirs</p>
            <p className="text-xs max-w-xs">Sélectionnez un avoir dans la liste pour consulter ses montants, la facture d'origine et le client.</p>
        </div>
    ) : (
        <AvoirDetailPanel creditNote={selected} detailLoading={detailLoading} onRedeem={() => setRedeemTarget(selected)} />
    );

    const actionGroups = useMemo(() => {
        const groups: { items: ActionItemProps[] }[] = [];
        const base: ActionItemProps[] = [
            { icon: RefreshCw, label: 'Actualiser', onClick: handleManualRefresh, disabled: loading },
        ];
        if (canCreateFreeStanding) {
            base.push({ icon: Plus, label: 'Créer un avoir libre', variant: 'sage', onClick: () => setCreateFreeStandingOpen(true) });
        }
        groups.push({ items: base });
        if (selected) {
            const items: ActionItemProps[] = [];
            if (needsRedeem(selected)) {
                items.push({ icon: Banknote, label: 'Rembourser', variant: 'warning', onClick: () => setRedeemTarget(selected) });
            }
            if (selected.invoice) {
                items.push({ icon: FileText, label: 'Voir la facture', onClick: () => navigate(`/gcom/factures?id=${selected.invoice!.id}`) });
                items.push({ icon: Download, label: 'Imprimer', onClick: () => openAvoirPdf(selected), disabled: pdfLoading });
            }
            if (selected.partner) {
                items.push({ icon: Building2, label: 'Relevé de compte', onClick: () => navigate(`/gcom/reglement?partnerId=${selected.partner!.id}&tab=ledger`) });
            }
            if (items.length > 0) groups.push({ items });
        }
        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, canCreateFreeStanding, loading, pdfLoading]);

    return (
        <>
            <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={<ActionPanel groups={actionGroups} />} />
            {redeemTarget && (
                <RedeemModal
                    creditNote={redeemTarget}
                    onClose={() => setRedeemTarget(null)}
                />
            )}
            {createFreeStandingOpen && (
                <CreateFreeStandingModal
                    searchPartners={searchPartners}
                    onClose={() => setCreateFreeStandingOpen(false)}
                />
            )}
        </>
    );
};

export default AvoirsPage;
