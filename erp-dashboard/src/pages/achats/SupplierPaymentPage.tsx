import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import {
    Banknote, Search, X, Plus, Loader2, CheckCircle2, Ban, Building2, ShieldAlert, Link2, Unlink,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';

import {
    useSupplierStatement, useSupplierLedger, useCreateSupplierPayment, useCancelSupplierPayment,
    useSupplierPayments, useSupplierPayment, useLetterSupplierPayment, useUnletterSupplierPayment,
} from '@/hooks/achats/useSupplierPayments';
import { achatsApi } from '@/services/api/achatsApi';
import { masterdataApi, type PaymentMethod } from '@/services/api/masterdataApi';
import type { PurchaseOrderSupplier, SupplierInvoice, SupplierPayment, SupplierLedgerEntry } from '@/types/achats.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// ⚠️ Inverted vs ReglementPage.tsx's soldeDisplay(): here current_balance > 0
// means WE owe the supplier (Dû), < 0 means we overpaid (Avance/credit in our
// favor) — same "avance" concept as the customer side, opposite direction.
// Doc §12's explicit warning: don't reuse the customer-side helper as-is.
const soldeDisplay = (balance: number): { label: string; amount: string; className: string } => {
    if (balance === 0) return { label: 'Soldé', amount: fmtMAD(0), className: 'text-gray-500' };
    if (balance < 0) return { label: 'Avance', amount: fmtMAD(Math.abs(balance)), className: 'text-emerald-700' };
    return { label: 'Dû', amount: fmtMAD(balance), className: 'text-amber-700' };
};

type AllocationMode = 'auto' | 'manual' | 'none';
type ManualAllocation = { invoice: SupplierInvoice; amount: string };

// Fetches the supplier's approved invoices for a lettering picker (create
// form's manual mode, and the existing-payment "Lettrer" panel). Uses
// remaining_amount (confirmed live 2026-08-27 — the real outstanding
// balance) as the reference/prefill amount, not total_amount.
const loadApprovedInvoices = (supplierId: number) =>
    achatsApi.supplierInvoices.list({ supplier_id: supplierId, status: 'approved', per_page: 50 }).then(res => res.data);

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupplierPaymentPage() {
    // ── Supplier list (left) ─────────────────────────────────────────────────
    const [suppliers, setSuppliers] = useState<PurchaseOrderSupplier[]>([]);
    const [suppliersLoading, setSuppliersLoading] = useState(false);
    const [search, setSearch] = useState('');

    useEffect(() => {
        setSuppliersLoading(true);
        achatsApi.purchaseOrders.suppliers()
            .then(setSuppliers)
            .catch(() => toast.error('Erreur chargement des fournisseurs'))
            .finally(() => setSuppliersLoading(false));
    }, []);

    const filteredSuppliers = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return suppliers;
        return suppliers.filter(s => s.name.toLowerCase().includes(q) || (s.contact_name ?? '').toLowerCase().includes(q));
    }, [suppliers, search]);

    // Same capped-concurrency worker-pool pattern as ReglementPage.tsx's
    // loadSoldeForPartners — an uncapped Promise.all over every visible row
    // is exactly what tripped the per-user rate limiter on the customer side
    // (2026-08-25 incident, see [[project_gcom_frontend_perf]]). Applying the
    // fix proactively here rather than waiting to reproduce it.
    const soldeCache = useRef<Map<number, number>>(new Map());
    const soldeLoadingIds = useRef<Set<number>>(new Set());
    const [, forceRerender] = useState(0);

    useEffect(() => {
        const idsToFetch = filteredSuppliers.map(s => s.id).filter(id => !soldeCache.current.has(id));
        if (idsToFetch.length === 0) return;
        idsToFetch.forEach(id => soldeLoadingIds.current.add(id));
        forceRerender(n => n + 1);
        const CONCURRENCY = 4;
        let cursor = 0;
        const worker = async () => {
            while (cursor < idsToFetch.length) {
                const id = idsToFetch[cursor++];
                try {
                    const statement = await achatsApi.supplierPayments.statement(id);
                    soldeCache.current.set(id, statement.current_balance);
                } catch {
                    soldeCache.current.set(id, NaN);
                }
                soldeLoadingIds.current.delete(id);
                forceRerender(n => n + 1);
            }
        };
        void Promise.all(Array.from({ length: Math.min(CONCURRENCY, idsToFetch.length) }, worker));
    }, [filteredSuppliers]);

    // ── Selection ─────────────────────────────────────────────────────────────
    const [selectedSupplier, setSelectedSupplier] = useState<PurchaseOrderSupplier | null>(null);
    const { data: statement, isLoading: loadingStatement } = useSupplierStatement(selectedSupplier?.id ?? null);
    const { data: ledgerData, isLoading: loadingLedger } = useSupplierLedger(selectedSupplier?.id ?? null);

    // §12.1bis (2026-08-27, doc fix) — history of past décaissements for the
    // selected supplier, selectable to letter/unletter/cancel.
    const { data: paymentsData, isLoading: loadingPayments } = useSupplierPayments({ supplier_id: selectedSupplier?.id });
    const payments = useMemo(() => paymentsData?.pages.flatMap(p => p.data) ?? [], [paymentsData]);

    const [selectedPaymentId, setSelectedPaymentId] = useState<number | null>(null);
    const { data: selectedPayment, isLoading: loadingSelectedPayment } = useSupplierPayment(selectedPaymentId);

    // ── Create payment form ───────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newAmount, setNewAmount] = useState('');
    const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
    const [newMethodId, setNewMethodId] = useState<number | ''>('');
    const [newInstrumentRef, setNewInstrumentRef] = useState('');
    const [newMaturityDate, setNewMaturityDate] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [allocationMode, setAllocationMode] = useState<AllocationMode>('auto');
    const [approvedInvoices, setApprovedInvoices] = useState<SupplierInvoice[]>([]);
    const [manualAllocations, setManualAllocations] = useState<ManualAllocation[]>([]);

    useEffect(() => {
        masterdataApi.paymentMethods.getAll().then(setPaymentMethods).catch(() => setPaymentMethods([]));
    }, []);

    const selectedMethod = paymentMethods.find(m => m.id === newMethodId);
    const needsInstrument = selectedMethod?.type === 'check';

    const resetCreateForm = () => {
        setNewAmount(''); setNewMethodId(''); setNewInstrumentRef(''); setNewMaturityDate('');
        setNewNotes(''); setAllocationMode('auto'); setManualAllocations([]);
    };

    const openCreateForm = useCallback((supplier: PurchaseOrderSupplier) => {
        setSelectedSupplier(supplier);
        setSelectedPaymentId(null);
        resetCreateForm();
        setShowCreateForm(true);
    }, []);

    const selectSupplierRow = useCallback((supplier: PurchaseOrderSupplier) => {
        setShowCreateForm(false);
        setSelectedPaymentId(null);
        setSelectedSupplier(supplier);
    }, []);

    const selectPaymentRow = useCallback((payment: SupplierPayment) => {
        setShowCreateForm(false);
        setSelectedPaymentId(payment.id);
    }, []);

    useEffect(() => {
        if (allocationMode !== 'manual' || !selectedSupplier) { setApprovedInvoices([]); return; }
        loadApprovedInvoices(selectedSupplier.id)
            .then(invoices => {
                setApprovedInvoices(invoices);
                setManualAllocations(invoices.map(inv => ({ invoice: inv, amount: '' })));
            })
            .catch(() => toast.error('Erreur chargement des factures approuvées'));
    }, [allocationMode, selectedSupplier]);

    const createMutation = useCreateSupplierPayment();
    const cancelMutation = useCancelSupplierPayment();
    const letterMutation = useLetterSupplierPayment();
    const unletterMutation = useUnletterSupplierPayment();

    const handleCreateSubmit = async () => {
        if (!selectedSupplier) return;
        const amount = parseFloat(newAmount);
        if (!amount || amount <= 0) { toast.error('Montant invalide.'); return; }
        if (!newMethodId) { toast.error('Sélectionnez un mode de paiement.'); return; }
        if (needsInstrument && (!newInstrumentRef || !newMaturityDate)) {
            toast.error('Référence et date d\'échéance requises pour un chèque/effet.');
            return;
        }

        let allocations: { supplier_invoice_id: number; amount: number }[] | undefined;
        let autoLetter: boolean | undefined;
        if (allocationMode === 'manual') {
            allocations = manualAllocations
                .filter(a => a.amount && parseFloat(a.amount) > 0)
                .map(a => ({ supplier_invoice_id: a.invoice.id, amount: parseFloat(a.amount) }));
            if (allocations.length === 0) { toast.error('Saisissez au moins un montant imputé.'); return; }
        } else if (allocationMode === 'none') {
            autoLetter = false;
        }
        // allocationMode === 'auto' → send neither, backend auto-letters
        // the oldest approved invoices (doc §12.1 default).

        try {
            const res = await createMutation.mutateAsync({
                supplier_id: selectedSupplier.id,
                amount,
                payment_method_id: Number(newMethodId),
                instrument_reference: needsInstrument ? newInstrumentRef : undefined,
                maturity_date: needsInstrument ? newMaturityDate : undefined,
                notes: newNotes || undefined,
                allocations,
                auto_letter: autoLetter,
            });
            toast.success('Décaissement enregistré.');
            soldeCache.current.delete(selectedSupplier.id);
            setShowCreateForm(false);
            setSelectedPaymentId(res.data.id);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'enregistrement du décaissement.");
        }
    };

    // ── Existing-payment panel: letter / unletter / cancel ────────────────────
    const [showLetterForm, setShowLetterForm] = useState(false);
    const [letterInvoices, setLetterInvoices] = useState<SupplierInvoice[]>([]);
    const [letterAllocations, setLetterAllocations] = useState<ManualAllocation[]>([]);
    const [showCancelForm, setShowCancelForm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const openLetterForm = useCallback(() => {
        if (!selectedSupplier) return;
        loadApprovedInvoices(selectedSupplier.id)
            .then(invoices => {
                setLetterInvoices(invoices);
                setLetterAllocations(invoices.map(inv => ({ invoice: inv, amount: '' })));
            })
            .catch(() => toast.error('Erreur chargement des factures approuvées'));
        setShowLetterForm(true);
    }, [selectedSupplier]);

    const handleLetterSubmit = async () => {
        if (!selectedPayment) return;
        const allocations = letterAllocations
            .filter(a => a.amount && parseFloat(a.amount) > 0)
            .map(a => ({ supplier_invoice_id: a.invoice.id, amount: parseFloat(a.amount) }));
        if (allocations.length === 0) { toast.error('Saisissez au moins un montant imputé.'); return; }
        try {
            await letterMutation.mutateAsync({ id: selectedPayment.id, payload: { allocations } });
            toast.success('Lettrage enregistré.');
            setShowLetterForm(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors du lettrage.");
        }
    };

    const handleUnletter = async (letteringId: number) => {
        try {
            await unletterMutation.mutateAsync(letteringId);
            toast.success('Imputation retirée.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors du délettrage.");
        }
    };

    const handleCancelPayment = async () => {
        if (!selectedPayment) return;
        if (cancelReason.trim().length < 10) { toast.error('Le motif doit contenir au moins 10 caractères.'); return; }
        try {
            await cancelMutation.mutateAsync({ id: selectedPayment.id, payload: { reason: cancelReason.trim() } });
            toast.success('Décaissement annulé.');
            setShowCancelForm(false);
            setCancelReason('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation.");
        }
    };

    // ── Grid: suppliers ────────────────────────────────────────────────────────
    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            colId: 'name', headerName: 'Fournisseur', flex: 1, minWidth: 140,
            valueGetter: p => p.data?.name ?? '—',
            cellRenderer: (p: ICellRendererParams<PurchaseOrderSupplier, string>) => <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.value}</span>,
        },
        {
            colId: 'contact', headerName: 'Contact', width: 130,
            valueGetter: p => p.data?.contact_name ?? p.data?.phone ?? '—',
            cellRenderer: (p: ICellRendererParams<PurchaseOrderSupplier, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{p.value}</span>,
        },
        {
            colId: 'solde', headerName: 'Solde', width: 140,
            valueGetter: p => (p.data ? soldeCache.current.get(p.data.id) ?? null : null),
            cellStyle: { textAlign: 'right' }, headerClass: 'ag-right-aligned-header',
            cellRenderer: (p: ICellRendererParams<PurchaseOrderSupplier, number | null>) => {
                if (p.data && soldeLoadingIds.current.has(p.data.id)) return <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />;
                const v = p.value;
                if (v == null || Number.isNaN(v)) return <span style={{ color: '#d1d5db', fontSize: '11px' }}>—</span>;
                const { label, amount, className } = soldeDisplay(v);
                return <span className={`text-xs font-bold ${className}`}>{amount}{v !== 0 && <span className="text-[9px] font-semibold ml-1">({label})</span>}</span>;
            },
        },
    ], []);

    // ── Actions ───────────────────────────────────────────────────────────────
    const actionGroups: { items: ActionItemProps[] }[] = [];
    if (selectedSupplier) {
        const items: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau Décaissement', variant: 'sage', onClick: () => openCreateForm(selectedSupplier) },
        ];
        if (selectedPayment && !showCreateForm) {
            items.push({ icon: Link2, label: 'Lettrer', variant: 'default', onClick: openLetterForm, disabled: showLetterForm });
            items.push({ icon: Ban, label: 'Annuler ce décaissement', variant: 'danger', onClick: () => setShowCancelForm(v => !v) });
        }
        actionGroups.push({ items });
    }

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Banknote className="w-4 h-4 text-sage-600" />
                            <h1 className="text-sm font-bold text-gray-900">Règlements Fournisseurs</h1>
                        </div>
                        <div className="relative">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                value={search} onChange={e => setSearch(e.target.value)}
                                placeholder="Rechercher un fournisseur…"
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                            {search && (
                                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <DataGrid rowData={filteredSuppliers} columnDefs={columnDefs} loading={suppliersLoading} onRowClicked={e => selectSupplierRow(e.data)} />
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                    {!selectedSupplier ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <Banknote className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Règlements Fournisseurs</p>
                            <p className="text-xs max-w-xs">Sélectionnez un fournisseur pour consulter son compte et enregistrer un décaissement.</p>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2"><Building2 className="w-4 h-4 text-sage-600" /> {selectedSupplier.name}</h2>
                                    </div>
                                    <div className="grid grid-cols-3 gap-3 text-xs">
                                        <div><span className="text-gray-400">Total Facturé</span><div className="font-bold text-gray-800">{loadingStatement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : fmtMAD(statement?.total_credit)}</div></div>
                                        <div><span className="text-gray-400">Total Réglé</span><div className="font-bold text-gray-800">{loadingStatement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : fmtMAD(statement?.total_debit)}</div></div>
                                        <div>
                                            <span className="text-gray-400">Solde</span>
                                            {loadingStatement ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : statement && (() => {
                                                const { label, amount, className } = soldeDisplay(statement.current_balance);
                                                return <div className={`font-bold ${className}`}>{amount}{statement.current_balance !== 0 && <span className="text-[10px] font-semibold ml-1">({label})</span>}</div>;
                                            })()}
                                        </div>
                                    </div>
                                </div>

                                {showCreateForm && (
                                    <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                                        <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-sage-600" /> Nouveau Décaissement</h3>
                                        <div className="grid grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Montant <span className="text-red-500">*</span></label>
                                                <input type="number" min="0" step="0.01" value={newAmount} onChange={e => setNewAmount(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            </div>
                                            <div>
                                                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Mode de paiement <span className="text-red-500">*</span></label>
                                                <select value={newMethodId} onChange={e => setNewMethodId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400">
                                                    <option value="">— Choisir —</option>
                                                    {paymentMethods.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                                </select>
                                            </div>
                                            {needsInstrument && (
                                                <>
                                                    <div>
                                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Référence chèque/effet <span className="text-red-500">*</span></label>
                                                        <input value={newInstrumentRef} onChange={e => setNewInstrumentRef(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                                    </div>
                                                    <div>
                                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Date d'échéance <span className="text-red-500">*</span></label>
                                                        <input type="date" value={newMaturityDate} onChange={e => setNewMaturityDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                                    </div>
                                                </>
                                            )}
                                            <div className="col-span-2">
                                                <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                                                <input value={newNotes} onChange={e => setNewNotes(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            </div>
                                        </div>

                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Lettrage</label>
                                        <div className="flex items-center gap-4 mb-4">
                                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                <input type="radio" checked={allocationMode === 'auto'} onChange={() => setAllocationMode('auto')} /> Automatique (factures les plus anciennes)
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                <input type="radio" checked={allocationMode === 'manual'} onChange={() => setAllocationMode('manual')} /> Imputation manuelle
                                            </label>
                                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                                                <input type="radio" checked={allocationMode === 'none'} onChange={() => setAllocationMode('none')} /> Sans imputation (avance)
                                            </label>
                                        </div>

                                        {allocationMode === 'manual' && (
                                            <div className="space-y-1.5 mb-4">
                                                {approvedInvoices.length === 0 && <p className="text-xs text-gray-400 italic">Aucune facture approuvée pour ce fournisseur.</p>}
                                                {manualAllocations.map((a, idx) => (
                                                    <div key={a.invoice.id} className="grid grid-cols-[1fr_120px_110px] gap-2 items-center">
                                                        <span className="text-xs font-mono text-indigo-600">{a.invoice.invoice_number}</span>
                                                        <span className="text-[10px] text-gray-400">Reste : {fmtMAD(a.invoice.remaining_amount)}</span>
                                                        <input
                                                            type="number" min="0" step="0.01" value={a.amount}
                                                            onChange={e => setManualAllocations(prev => prev.map((p, i) => i === idx ? { ...p, amount: e.target.value } : p))}
                                                            placeholder="Montant"
                                                            className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                        />
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <button onClick={handleCreateSubmit} disabled={createMutation.isPending} className="px-4 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                                {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Enregistrer
                                            </button>
                                            <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                                        </div>
                                    </div>
                                )}

                                {!showCreateForm && (
                                    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden mb-4">
                                        <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Historique des Décaissements</div>
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                                    <th className="text-left px-3 py-2">Code</th>
                                                    <th className="text-left px-3 py-2">Statut</th>
                                                    <th className="text-right px-3 py-2">Montant</th>
                                                    <th className="text-right px-3 py-2">Restant</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {loadingPayments ? (
                                                    <tr><td colSpan={4} className="px-3 py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-300" /></td></tr>
                                                ) : payments.map(p => (
                                                    <tr
                                                        key={p.id}
                                                        onClick={() => selectPaymentRow(p)}
                                                        className={`cursor-pointer hover:bg-sage-50 ${selectedPaymentId === p.id ? 'bg-sage-50' : ''}`}
                                                    >
                                                        <td className="px-3 py-2 font-mono text-indigo-600">{p.code}</td>
                                                        <td className="px-3 py-2 text-gray-600">{p.status}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtMAD(p.amount)}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-amber-600">{fmtMAD(p.remaining_amount)}</td>
                                                    </tr>
                                                ))}
                                                {!loadingPayments && payments.length === 0 && (
                                                    <tr><td colSpan={4} className="px-3 py-6 text-center text-gray-300">Aucun décaissement</td></tr>
                                                )}
                                            </tbody>
                                        </table>
                                    </div>
                                )}

                                {!showCreateForm && selectedPaymentId && (
                                    loadingSelectedPayment ? (
                                        <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-gray-300" /></div>
                                    ) : selectedPayment && (
                                        <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4">
                                            <div className="flex items-start justify-between mb-2">
                                                <p className="text-xs font-bold text-gray-900 font-mono">{selectedPayment.code} — {fmtMAD(selectedPayment.amount)}</p>
                                                <span className="text-[10px] font-semibold text-gray-500 uppercase">{selectedPayment.status}</span>
                                            </div>
                                            {selectedPayment.letterings && selectedPayment.letterings.length > 0 ? (
                                                <ul className="space-y-1 mb-2">
                                                    {selectedPayment.letterings.map(l => (
                                                        <li key={l.id} className="flex items-center justify-between text-xs">
                                                            <span>{fmtMAD(l.amount)} imputé sur <span className="font-mono text-indigo-600">{l.supplier_invoice?.invoice_number ?? `facture #${l.supplier_invoice_id}`}</span></span>
                                                            <button onClick={() => handleUnletter(l.id)} disabled={unletterMutation.isPending} className="text-gray-400 hover:text-red-500 flex items-center gap-1 text-[10px]">
                                                                <Unlink className="w-3 h-3" /> Délettrer
                                                            </button>
                                                        </li>
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="text-xs text-gray-500 mb-2">Aucune imputation — restant : {fmtMAD(selectedPayment.remaining_amount)}.</p>
                                            )}

                                            {showLetterForm && (
                                                <div className="bg-sage-50 border border-sage-200 rounded-lg p-3 mt-2">
                                                    <p className="text-[11px] font-semibold text-sage-700 uppercase tracking-wide mb-2">Nouvelle imputation</p>
                                                    {letterInvoices.length === 0 && <p className="text-xs text-gray-400 italic">Aucune facture approuvée pour ce fournisseur.</p>}
                                                    <div className="space-y-1.5 mb-2">
                                                        {letterAllocations.map((a, idx) => (
                                                            <div key={a.invoice.id} className="grid grid-cols-[1fr_120px_110px] gap-2 items-center">
                                                                <span className="text-xs font-mono text-indigo-600">{a.invoice.invoice_number}</span>
                                                                <span className="text-[10px] text-gray-400">Reste : {fmtMAD(a.invoice.remaining_amount)}</span>
                                                                <input
                                                                    type="number" min="0" step="0.01" value={a.amount}
                                                                    onChange={e => setLetterAllocations(prev => prev.map((p, i) => i === idx ? { ...p, amount: e.target.value } : p))}
                                                                    placeholder="Montant"
                                                                    className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                                />
                                                            </div>
                                                        ))}
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={handleLetterSubmit} disabled={letterMutation.isPending} className="px-3 py-1.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50">Enregistrer</button>
                                                        <button onClick={() => setShowLetterForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                                    </div>
                                                </div>
                                            )}

                                            {showCancelForm && (
                                                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mt-2">
                                                    <label className="block text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Motif d'annulation (10-500 caractères)</label>
                                                    <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 mb-2" />
                                                    <div className="flex items-center gap-2">
                                                        <button onClick={handleCancelPayment} disabled={cancelMutation.isPending} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Confirmer l'annulation</button>
                                                        <button onClick={() => setShowCancelForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    )
                                )}

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <div className="px-4 py-2.5 border-b border-gray-200 bg-gray-50 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Grand Livre</div>
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                                <th className="text-left px-3 py-2">Date</th>
                                                <th className="text-left px-3 py-2">Type</th>
                                                <th className="text-left px-3 py-2">Référence</th>
                                                <th className="text-right px-3 py-2">Facturé</th>
                                                <th className="text-right px-3 py-2">Réglé</th>
                                                <th className="text-right px-3 py-2">Solde progressif</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {loadingLedger ? (
                                                <tr><td colSpan={6} className="px-3 py-6 text-center"><Loader2 className="w-4 h-4 animate-spin mx-auto text-gray-300" /></td></tr>
                                            ) : (ledgerData?.ledger ?? []).map((entry: SupplierLedgerEntry, idx) => {
                                                const { label, amount, className } = soldeDisplay(entry.running_balance);
                                                return (
                                                    <tr key={idx}>
                                                        <td className="px-3 py-2 text-gray-500">{fmtDate(entry.date)}</td>
                                                        <td className="px-3 py-2">{entry.type === 'invoice' ? 'Facture' : 'Paiement'}</td>
                                                        <td className="px-3 py-2 font-mono text-indigo-600">{entry.reference}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{entry.credit ? fmtMAD(entry.credit) : '—'}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums text-emerald-600 font-medium">{entry.debit ? fmtMAD(entry.debit) : '—'}</td>
                                                        <td className={`px-3 py-2 text-right tabular-nums font-semibold ${className}`}>{amount}{entry.running_balance !== 0 && <span className="text-[9px] font-semibold ml-1">({label})</span>}</td>
                                                    </tr>
                                                );
                                            })}
                                            {!loadingLedger && (!ledgerData?.ledger || ledgerData.ledger.length === 0) && (
                                                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-300">Aucun mouvement</td></tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>

                                <div className="mt-3 flex items-start gap-2 text-[10px] text-gray-400">
                                    <ShieldAlert className="w-3.5 h-3.5 shrink-0 mt-px" />
                                    Décaissement, lettrage et grand livre réservés aux profils comptabilité (root/admin/comptable) — pas d'accès magasinier ici, contrairement aux factures fournisseur.
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
