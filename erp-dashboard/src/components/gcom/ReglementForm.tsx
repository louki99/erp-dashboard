import React, { useState, useMemo, useEffect } from 'react';
import {
    CheckCircle2, LayoutGrid, ListFilter, AlertTriangle, Loader2,
    CreditCard, Banknote, Hash, CalendarDays, StickyNote, Landmark, X, Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { gcomApi } from '@/services/api/gcomApi';
import { masterdataApi, type Bank, type PaymentMethod } from '@/services/api/masterdataApi';
import type { Partner } from '@/types/partner.types';
import type { GcomOpenInvoice } from '@/types/gcom.types';

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

type AllocationMode = 'auto' | 'manual';

interface ReglementFormProps {
    partner: Partner;
    openInvoices: GcomOpenInvoice[];
    loadingInvoices: boolean;
    // Already loaded by the parent page for its own KPI cards (GET
    // /partners/{id}/statement) — reused here as a header badge instead of a
    // second fetch. `undefined` while the parent hasn't loaded it yet, `null`
    // if that load failed — both just hide the badge.
    accountSummary?: { invoiced: number; paid: number; due: number } | null;
    onCancel: () => void;
    onSuccess: () => void;
}

// Renders inline in the master layout's content pane (not a modal/drawer) — per
// explicit request: a slide-over drawer was tried first, then rejected as "still
// not good", asking specifically for the form to take over the content space
// instead, matching how BC/BL creation (GcomCatalogEntryScreen) already works.
//
// 2026-09-03 — V2: collapsed from a 2-step wizard (payment entry, then a
// separate "Imputation" step) into one unified view, per Sadi9's UX proposal.
// The old step 2 was the only place the auto-lettering/FIFO behavior was ever
// shown — since `mode` already defaulted to 'auto' and the backend already
// applies it by default, most users never saw it unless they clicked
// "Suivant". Now the invoice table (with a live FIFO simulation in auto mode)
// sits next to the payment fields the whole time.
export const ReglementForm: React.FC<ReglementFormProps> = ({
    partner, openInvoices, loadingInvoices, accountSummary, onCancel, onSuccess,
}) => {
    // ── Payment entry ─────────────────────────────────────────────────────────
    const [amount, setAmount] = useState<number | ''>('');
    const [paymentMethodId, setPaymentMethodId] = useState<number | null>(null);
    const [reference, setReference] = useState('');
    const [bankId, setBankId] = useState<number | ''>('');
    const [maturityDate, setMaturityDate] = useState('');
    const [instrumentBankName, setInstrumentBankName] = useState('');
    const [instrumentBankAccount, setInstrumentBankAccount] = useState('');
    const [notes, setNotes] = useState('');

    // Banks list — added 2026-08-16 (GET /masterdata/banks), replaces the raw
    // numeric bank_id input. Loaded once; doesn't depend on partner.
    const [banks, setBanks] = useState<Bank[]>([]);
    const [loadingBanks, setLoadingBanks] = useState(true);
    useEffect(() => {
        masterdataApi.banks.getAll()
            .then(setBanks)
            .catch(() => setBanks([]))
            .finally(() => setLoadingBanks(false));
    }, []);

    // Payment methods — added 2026-08-16 (GET /masterdata/payment-methods),
    // feeds the new payment_method_id field. Coexists with payment_term_id
    // (échéance) — the two dropdowns are NOT merged, per backend's explicit
    // instruction.
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [loadingPaymentMethods, setLoadingPaymentMethods] = useState(true);
    useEffect(() => {
        masterdataApi.paymentMethods.getAll()
            .then(methods => {
                setPaymentMethods(methods);
                setPaymentMethodId(prev => prev ?? methods[0]?.id ?? null);
            })
            .catch(() => setPaymentMethods([]))
            .finally(() => setLoadingPaymentMethods(false));
    }, []);

    const selectedMethod = paymentMethods.find(m => m.id === paymentMethodId);
    // `type: 'check'` reliably identifies Chèque/Effet (verified live) — this is
    // when the `instrument` payload becomes required instead of the plain
    // reference/date fields.
    const needsInstrument = selectedMethod?.type === 'check';

    // 2026-09-03 — Banque is now genuinely conditional on the selected
    // method's own `requires_bank` (masterdata `GET /payment-methods`),
    // matching Sadi9's original V2 proposal. Previously kept unconditionally
    // required/visible because bank-required used to be resolved off the
    // payment TERM (every term this screen offered was a credit term, which
    // always needed a bank regardless of method) — backend confirmed
    // 2026-09-03 that `payment_term_id` is now optional and the bank check
    // reads `payment_methods.requires_bank` off the resolved method directly,
    // independent of any term. Live-verified both directions: CHEQUE
    // (requires_bank:true) 422s "Bank is required..." without one; CASH
    // (requires_bank:false) succeeds without one.
    const needsBank = selectedMethod?.requires_bank ?? false;

    const step1Valid = amount !== '' && amount > 0 && paymentMethodId != null &&
        (!needsBank || bankId !== '') && (!needsInstrument || (reference.trim() !== '' && maturityDate !== ''));

    // ── Allocation / lettrage — always visible now, not a separate step ───────
    const [mode, setMode] = useState<AllocationMode>('auto');
    const [manualAllocations, setManualAllocations] = useState<Record<number, number>>({});
    const setAllocationAmount = (invoiceId: number, amt: number) => {
        setManualAllocations(prev => ({ ...prev, [invoiceId]: Math.max(0, amt) }));
    };

    // Oldest-first, matching the backend's own auto-lettering order (doc:
    // "letters the partner's oldest open invoices first"). due_date falls back
    // to invoice_date for any invoice missing one.
    const sortedOpenInvoices = useMemo(
        () => [...openInvoices].sort((a, b) => (a.due_date ?? a.invoice_date ?? '').localeCompare(b.due_date ?? b.invoice_date ?? '')),
        [openInvoices],
    );

    // Client-side FIFO simulation for auto mode — purely a preview so the
    // impact is visible immediately instead of hidden until submit; the
    // backend (LetteringService) is still the real source of truth at
    // submit time and could theoretically differ (e.g. a race with another
    // payment) — worded as an estimate in the UI, not a guarantee.
    const autoAllocations = useMemo(() => {
        if (mode !== 'auto' || amount === '' || amount <= 0) return {};
        let remaining = amount;
        const result: Record<number, number> = {};
        for (const inv of sortedOpenInvoices) {
            if (remaining <= 0) break;
            const due = Number(inv.remaining_amount) || 0;
            if (due <= 0) continue;
            const applied = Math.min(due, remaining);
            result[inv.id] = applied;
            remaining -= applied;
        }
        return result;
    }, [mode, amount, sortedOpenInvoices]);

    const effectiveAllocations = mode === 'auto' ? autoAllocations : manualAllocations;
    const allocatedTotal = useMemo(
        () => Object.values(effectiveAllocations).reduce((sum, v) => sum + (v || 0), 0),
        [effectiveAllocations],
    );
    const overAllocated = mode === 'manual' && amount !== '' && allocatedTotal > amount;

    const [submitting, setSubmitting] = useState(false);

    // Reset whenever the form mounts for a (possibly different) partner.
    useEffect(() => {
        setAmount('');
        setPaymentMethodId(paymentMethods[0]?.id ?? null);
        setReference('');
        setBankId('');
        setMaturityDate('');
        setInstrumentBankName('');
        setInstrumentBankAccount('');
        setNotes('');
        setMode('auto');
        setManualAllocations({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [partner.id]);

    const formValid = step1Valid && !overAllocated;

    const confirmPayment = async () => {
        if (amount === '' || amount <= 0 || paymentMethodId == null) {
            toast.error('Montant et moyen de paiement requis');
            return;
        }
        if (needsBank && bankId === '') { toast.error('Banque requise pour ce moyen de paiement'); return; }
        if (needsInstrument && (!reference.trim() || !maturityDate)) {
            toast.error('N° chèque/effet et date d\'échéance requis pour ce moyen de paiement');
            return;
        }
        if (overAllocated) { toast.error('Le montant imputé dépasse le montant du règlement'); return; }
        setSubmitting(true);
        try {
            const payment = await gcomApi.payments.register({
                partner_id: partner.id,
                amount,
                payment_method_id: paymentMethodId,
                reference: reference.trim() || undefined,
                bank_id: needsBank && bankId !== '' ? Number(bankId) : undefined,
                maturity_date: maturityDate || null,
                notes: notes.trim() || undefined,
                instrument: needsInstrument ? {
                    reference_number: reference.trim(),
                    due_date: maturityDate,
                    bank_name: instrumentBankName.trim() || undefined,
                    bank_account: instrumentBankAccount.trim() || undefined,
                } : undefined,
                auto_letter: mode === 'auto',
                allocations: mode === 'manual'
                    ? Object.entries(manualAllocations).filter(([, amt]) => amt > 0).map(([id, amt]) => ({ invoice_id: Number(id), amount: amt }))
                    : undefined,
            });
            toast.success('Règlement enregistré');
            // Reçu d'encaissement (2026-09-03) — auto-open like every other GCOM
            // creation flow (Comptoir's printInvoicePdf, etc.). null = still
            // generating; the shared toast (pdfReadyToast.tsx) picks it up from
            // there, nothing to await here.
            gcomApi.payments.getPdfBlobUrl(payment.id)
                .then(url => { if (url) window.open(url, '_blank'); })
                .catch(() => toast.error('Impossible de charger le reçu PDF'));
            onSuccess();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'enregistrement du règlement");
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="h-full flex flex-col overflow-hidden bg-gray-50">
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-sage-600" /> Nouveau règlement — {partner.name}
                    </h2>
                    <p className="text-[11px] text-gray-400 mt-0.5">{partner.code}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {accountSummary != null && (
                        <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold ${
                            accountSummary.due > 0 ? 'bg-amber-50 border-amber-200 text-amber-700' : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                        }`}>
                            <Scale className="w-3.5 h-3.5" /> Solde dû : {fmtMAD(accountSummary.due)}
                        </div>
                    )}
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        <X className="w-3.5 h-3.5" /> Annuler
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
                <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
                    {/* ── LEFT: payment details ─────────────────────────────── */}
                    <div className="space-y-5">
                        {/* Montant — the primary, most prominent field */}
                        <div className="bg-sage-50 border border-sage-100 rounded-xl px-4 py-4 transition-shadow focus-within:ring-2 focus-within:ring-sage-300 focus-within:border-sage-300">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-sage-800 mb-2">
                                <Banknote className="w-3.5 h-3.5" /> Montant du règlement *
                            </label>
                            <div className="flex items-baseline gap-2">
                                <input
                                    type="number" min={0} step="0.01" autoFocus
                                    value={amount}
                                    onChange={e => setAmount(e.target.value === '' ? '' : parseFloat(e.target.value) || 0)}
                                    className="flex-1 min-w-0 bg-transparent text-3xl font-bold text-gray-900 placeholder-gray-300 outline-none border-none focus:outline-none focus:ring-0 focus:border-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                    placeholder="0.00"
                                />
                                <span className="text-sm font-semibold text-sage-600 shrink-0">MAD</span>
                            </div>
                        </div>

                        {/* Détails du règlement */}
                        <div className="border border-gray-200 rounded-xl overflow-hidden bg-white">
                            <div className="flex items-center gap-1.5 px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                                <CreditCard className="w-3.5 h-3.5 text-gray-400" />
                                <span className="text-xs font-semibold text-gray-700">Détails du règlement</span>
                            </div>
                            <div className="p-4 space-y-3.5">
                                <div>
                                    <label className="block text-xs font-medium text-gray-600 mb-1">Moyen de paiement *</label>
                                    {loadingPaymentMethods ? (
                                        <div className="flex items-center gap-1.5 text-xs text-gray-400 py-2">
                                            <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement…
                                        </div>
                                    ) : paymentMethods.length > 0 ? (
                                        <select
                                            value={paymentMethodId ?? ''}
                                            onChange={e => setPaymentMethodId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                            className="w-full max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                        >
                                            {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                    ) : (
                                        <p className="text-[11px] text-red-600 font-medium">Aucun moyen de paiement disponible.</p>
                                    )}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                                            <Hash className="w-3 h-3 text-gray-400" /> {needsInstrument ? 'N° Chèque / Effet *' : 'Référence'}
                                        </label>
                                        <input
                                            value={reference}
                                            onChange={e => setReference(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            placeholder={needsInstrument ? 'CHQ-0001' : 'VIR-2026-0042'}
                                        />
                                    </div>
                                    <div>
                                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                                            <CalendarDays className="w-3 h-3 text-gray-400" /> {needsInstrument ? "Date d'échéance *" : 'Date de valeur (optionnel)'}
                                        </label>
                                        <input
                                            type="date"
                                            value={maturityDate}
                                            onChange={e => setMaturityDate(e.target.value)}
                                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                        />
                                    </div>
                                </div>

                                {needsInstrument && (
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">Nom banque (optionnel)</label>
                                            <input
                                                value={instrumentBankName}
                                                onChange={e => setInstrumentBankName(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                placeholder="Attijariwafa Bank"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-xs font-medium text-gray-600 mb-1">N° Compte (optionnel)</label>
                                            <input
                                                value={instrumentBankAccount}
                                                onChange={e => setInstrumentBankAccount(e.target.value)}
                                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                placeholder="011780000012345678"
                                            />
                                        </div>
                                    </div>
                                )}

                                {needsBank && (
                                    <div>
                                        <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                                            <Landmark className="w-3 h-3 text-gray-400" /> Banque *
                                        </label>
                                        {loadingBanks ? (
                                            <div className="flex items-center gap-1.5 text-xs text-gray-400 py-2">
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Chargement des banques…
                                            </div>
                                        ) : banks.length > 0 ? (
                                            <select
                                                value={bankId}
                                                onChange={e => setBankId(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                                className="w-full max-w-xs px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                            >
                                                <option value="">Sélectionner…</option>
                                                {banks.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                            </select>
                                        ) : (
                                            <p className="text-[11px] text-red-600 font-medium">Aucune banque disponible côté API.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="flex items-center gap-1 text-xs font-medium text-gray-600 mb-1">
                                <StickyNote className="w-3 h-3 text-gray-400" /> Notes
                            </label>
                            <textarea
                                value={notes}
                                onChange={e => setNotes(e.target.value)}
                                rows={2}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none bg-white"
                                placeholder="Virement reçu…"
                            />
                        </div>
                    </div>

                    {/* ── RIGHT: factures ouvertes + live impact ────────────── */}
                    <div className="space-y-4">
                        <div className="bg-sage-50 border border-sage-100 rounded-xl px-4 py-4 flex items-center justify-between">
                            <span className="flex items-center gap-1.5 text-xs font-semibold text-sage-800">
                                <Banknote className="w-3.5 h-3.5" /> Montant à imputer
                            </span>
                            <span className="text-2xl font-bold text-gray-900">{amount === '' ? '—' : fmtMAD(amount)}</span>
                        </div>

                        <div className="flex items-center justify-between">
                            <label className="text-xs font-medium text-gray-600">Factures ouvertes</label>
                            <div className="flex items-center bg-gray-100 rounded-lg p-1">
                                <button
                                    onClick={() => setMode('auto')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                                        mode === 'auto' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <LayoutGrid className="w-3 h-3" /> Auto (plus ancienne d'abord)
                                </button>
                                <button
                                    onClick={() => setMode('manual')}
                                    className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-all ${
                                        mode === 'manual' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                    }`}
                                >
                                    <ListFilter className="w-3 h-3" /> Manuel
                                </button>
                            </div>
                        </div>

                        {loadingInvoices ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                        ) : (
                            <>
                                {mode === 'auto' && (
                                    <div className="text-xs text-gray-500 bg-white border border-gray-100 rounded-lg px-3 py-2.5">
                                        Les factures ouvertes les plus anciennes seront lettrées automatiquement jusqu'à {amount === '' ? '0,00 MAD' : fmtMAD(amount)} — estimation ci-dessous, confirmée à l'enregistrement.
                                    </div>
                                )}
                                <GcomLinesTable
                                    rows={sortedOpenInvoices}
                                    rowKey={inv => inv.id}
                                    emptyLabel="Aucune facture ouverte pour ce client"
                                    columns={[
                                        { key: 'invoice', header: 'Facture', render: inv => <span className="font-mono font-bold text-indigo-600">{inv.invoice_number ?? `#${inv.id}`}</span> },
                                        { key: 'due', header: 'Échéance', width: 'w-24', render: inv => <span className="text-gray-600">{fmtDate(inv.due_date)}</span> },
                                        { key: 'remaining', header: 'Restant', align: 'right', width: 'w-24', render: inv => <span className="font-bold text-amber-600">{fmtMAD(inv.remaining_amount)}</span> },
                                        {
                                            key: 'amount', header: 'Montant', align: 'center', width: 'w-28',
                                            render: inv => mode === 'manual' ? (
                                                <input
                                                    type="number" min={0} step="0.01"
                                                    value={manualAllocations[inv.id] ?? ''}
                                                    placeholder="0"
                                                    onChange={e => setAllocationAmount(inv.id, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                                                    className="w-20 text-center px-1.5 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                />
                                            ) : (
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {autoAllocations[inv.id] ? fmtMAD(autoAllocations[inv.id]) : '—'}
                                                </span>
                                            ),
                                        },
                                        {
                                            key: 'impact', header: 'Impact', align: 'center', width: 'w-20',
                                            render: inv => {
                                                const applied = effectiveAllocations[inv.id] ?? 0;
                                                const due = Number(inv.remaining_amount) || 0;
                                                if (applied <= 0) return <span className="text-[10px] text-gray-300">—</span>;
                                                if (applied >= due) return (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-emerald-100 text-emerald-700">Soldée</span>
                                                );
                                                return (
                                                    <span className="px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide rounded-full bg-amber-100 text-amber-700">Partielle</span>
                                                );
                                            },
                                        },
                                    ]}
                                />
                                <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-xs ${overAllocated ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-white text-gray-600 border border-gray-100'}`}>
                                    <span>Total imputé</span>
                                    <span className="font-bold">{fmtMAD(allocatedTotal)} / {amount === '' ? '0,00 MAD' : fmtMAD(amount)}</span>
                                </div>
                                {overAllocated && (
                                    <div className="flex items-center gap-2 text-[11px] text-red-700">
                                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Le montant imputé dépasse le montant du règlement.
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end gap-2 px-6 py-4 border-t border-gray-200 bg-white">
                <div className="max-w-6xl w-full mx-auto flex items-center justify-end gap-2">
                    <button
                        onClick={onCancel}
                        disabled={submitting}
                        className="px-4 py-2.5 text-xs font-semibold text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={confirmPayment}
                        disabled={submitting || !formValid}
                        className="flex items-center gap-1.5 px-5 py-2.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 disabled:bg-gray-300 disabled:cursor-not-allowed rounded-lg shadow-sm transition-colors"
                    >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Enregistrer le règlement
                    </button>
                </div>
            </div>
        </div>
    );
};
