import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import {
    PackageCheck, Plus, Loader2, CheckCircle2, Ban, RotateCcw,
    Building2, Calendar, Trash2, Link2, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import {
    usePurchaseReceptions, usePurchaseReception, useCreatePurchaseReception,
    useValidatePurchaseReception, useCancelPurchaseReception, useReversePurchaseReception,
} from '@/hooks/achats/usePurchaseReceptions';
import { usePurchaseOrder } from '@/hooks/achats/usePurchaseOrders';
import { achatsApi } from '@/services/api/achatsApi';
import { financeApi } from '@/services/api/financeApi';
import { searchProducts } from '@/services/api/pricingApi';
import type { PurchaseReception, PurchaseReceptionStatus, QcStatus, PurchaseReceptionLinePayload } from '@/types/achats.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<PurchaseReceptionStatus, { label: string; dot: string; text: string }> = {
    draft: { label: 'Brouillon', dot: 'bg-gray-400', text: 'text-gray-500' },
    validated: { label: 'Validée', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    synced_to_erp: { label: 'Synchronisée ERP', dot: 'bg-indigo-500', text: 'text-indigo-700' },
    cancelled: { label: 'Annulée', dot: 'bg-red-500', text: 'text-red-700' },
};
const StatusBadge = ({ status }: { status: PurchaseReceptionStatus }) => {
    const m = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const QC_META: Record<QcStatus, { label: string; dot: string; text: string }> = {
    pending: { label: 'En attente', dot: 'bg-amber-500', text: 'text-amber-700' },
    passed: { label: 'Accepté', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    failed: { label: 'Refusé', dot: 'bg-red-500', text: 'text-red-700' },
    stock_added: { label: 'Stocké', dot: 'bg-blue-500', text: 'text-blue-700' },
};
const QcBadge = ({ status }: { status: QcStatus }) => {
    const m = QC_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${m.text}`}><span className={`w-1 h-1 rounded-full ${m.dot}`} />{m.label}</span>;
};

const STATUS_FILTERS: { value: 'all' | PurchaseReceptionStatus; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'validated', label: 'Validée' },
    { value: 'synced_to_erp', label: 'Synchronisée ERP' },
    { value: 'cancelled', label: 'Annulée' },
];

type DraftLine = { _key: string; product: ComboboxOption | null; received_quantity: string; unit_cost: string; remainingHint?: number };
const emptyLine = (): DraftLine => ({ _key: crypto.randomUUID(), product: null, received_quantity: '', unit_cost: '' });

// GET /purchase-orders/suppliers (doc §3.8), NOT GET /partners (customers)
// nor /suppliers|/master-data/suppliers (root/admin-only, a magasinier would
// 403). No server-side search — flat unpaginated list, filtered here.
const searchSuppliers = async (q: string): Promise<ComboboxOption[]> => {
    const suppliers = await achatsApi.purchaseOrders.suppliers();
    const query = q.trim().toLowerCase();
    const filtered = query
        ? suppliers.filter(s => s.name.toLowerCase().includes(query) || (s.contact_name ?? '').toLowerCase().includes(query))
        : suppliers;
    return filtered.map(s => ({ id: s.id, label: s.name, sub: s.contact_name ?? s.phone ?? undefined }));
};
const searchBranchesOptions = async (q: string): Promise<ComboboxOption[]> => {
    const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
    return (res.data ?? []).map(b => ({ id: b.code, label: b.name, sub: b.code }));
};
const searchProductOptions = async (q: string): Promise<ComboboxOption[]> => {
    const res = await searchProducts(q);
    return (res ?? []).map(p => ({ id: p.id, label: p.name, sub: p.code }));
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PurchaseReceptionPage() {
    // ── List filters ─────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<'all' | PurchaseReceptionStatus>('all');
    const [supplierFilter, setSupplierFilter] = useState<ComboboxOption | null>(null);

    const listFilters = useMemo(() => ({
        status: statusFilter === 'all' ? undefined : statusFilter,
        supplier_id: supplierFilter ? Number(supplierFilter.id) : undefined,
    }), [statusFilter, supplierFilter]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePurchaseReceptions(listFilters);
    const rows = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);

    // ── Selection / detail ───────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const { data: selected, isLoading: loadingDetail } = usePurchaseReception(selectedId);

    // ── Create form ───────────────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSupplier, setNewSupplier] = useState<ComboboxOption | null>(null);
    const [newBranch, setNewBranch] = useState<ComboboxOption | null>(null);
    const [newBc, setNewBc] = useState<ComboboxOption | null>(null);
    const [newReceptionDate, setNewReceptionDate] = useState('');
    const [newInvoiceNumber, setNewInvoiceNumber] = useState('');
    const [newLines, setNewLines] = useState<DraftLine[]>([emptyLine()]);

    const resetCreateForm = () => {
        setNewSupplier(null); setNewBranch(null); setNewBc(null);
        setNewReceptionDate(''); setNewInvoiceNumber(''); setNewLines([emptyLine()]);
    };

    // Selecting a BC fetches its detail (lines + supplier/branch) to prefill —
    // the core reconciliation UX payoff of this whole module (doc §5): only
    // lines with remaining quantity > 0 are prefilled, pre-filled with what's
    // still owed, not the full ordered_quantity.
    const selectedBcId = newBc ? Number(newBc.id) : null;
    const { data: bcDetail } = usePurchaseOrder(selectedBcId);
    useEffect(() => {
        if (!bcDetail) return;
        setNewBranch({ id: bcDetail.branch_code, label: bcDetail.branch?.name ?? bcDetail.branch_code, sub: bcDetail.branch_code });
        const remainingLines = (bcDetail.lines ?? [])
            .map(l => ({ l, remaining: (parseFloat(l.ordered_quantity) || 0) - (parseFloat(l.received_quantity) || 0) }))
            .filter(({ remaining }) => remaining > 0);
        if (remainingLines.length === 0) return;
        setNewLines(remainingLines.map(({ l, remaining }) => ({
            _key: crypto.randomUUID(),
            product: { id: l.product_id, label: l.product?.name ?? `#${l.product_id}`, sub: l.product?.code },
            received_quantity: String(remaining),
            unit_cost: l.unit_cost ?? '',
            remainingHint: remaining,
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bcDetail?.id]);

    const searchPurchaseOrdersForSupplier = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        if (!newSupplier) return [];
        const res = await achatsApi.purchaseOrders.list({ supplier_id: Number(newSupplier.id), search: q || undefined, per_page: 20 });
        return (res.data ?? [])
            .filter((po): po is typeof po & { status: 'confirmed' | 'partially_received' } => po.status === 'confirmed' || po.status === 'partially_received')
            .map(po => ({ id: po.id, label: po.order_number, sub: STATUS_META_LABEL(po.status) }));
    }, [newSupplier]);

    // ── Cancel / reverse form ─────────────────────────────────────────────────
    const [showReasonForm, setShowReasonForm] = useState<'cancel' | 'reverse' | null>(null);
    const [reason, setReason] = useState('');

    const createMutation = useCreatePurchaseReception();
    const validateMutation = useValidatePurchaseReception();
    const cancelMutation = useCancelPurchaseReception();
    const reverseMutation = useReversePurchaseReception();

    const openCreateForm = useCallback(() => {
        setSelectedId(null);
        setShowReasonForm(null);
        resetCreateForm();
        setShowCreateForm(true);
    }, []);

    const selectRow = useCallback((row: PurchaseReception) => {
        setShowCreateForm(false);
        setShowReasonForm(null);
        setSelectedId(row.id);
    }, []);

    const handleCreateSubmit = async () => {
        if (!newSupplier) { toast.error('Sélectionnez un fournisseur.'); return; }
        if (!newBranch) { toast.error('Sélectionnez une agence.'); return; }
        const lines: PurchaseReceptionLinePayload[] = [];
        for (const l of newLines) {
            if (!l.product) continue;
            const qty = parseFloat(l.received_quantity);
            if (!qty || qty <= 0) { toast.error(`Quantité invalide sur ${l.product.label}.`); return; }
            const cost = parseFloat(l.unit_cost);
            // Confirmed live 2026-08-26 — the API 422s without unit_cost on
            // every reception line, unlike purchase-order lines where it's
            // genuinely optional. See the type's own comment.
            if (!cost || cost <= 0) { toast.error(`Coût unitaire requis sur ${l.product.label}.`); return; }
            lines.push({ product_id: Number(l.product.id), received_quantity: qty, unit_cost: cost });
        }
        if (lines.length === 0) { toast.error('Ajoutez au moins une ligne avec un produit.'); return; }

        try {
            const res = await createMutation.mutateAsync({
                supplier_id: Number(newSupplier.id),
                branch_code: String(newBranch.id),
                purchase_order_id: selectedBcId ?? undefined,
                reception_date: newReceptionDate || undefined,
                supplier_invoice_number: newInvoiceNumber || undefined,
                lines,
            });
            toast.success('Réception créée.');
            setShowCreateForm(false);
            setSelectedId(res.data.id);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la création de la réception.');
        }
    };

    const [pdfLoading, setPdfLoading] = useState(false);
    const handlePrintPdf = async () => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await achatsApi.purchaseReceptions.getPdfBlobUrl(selected.id);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    const handleValidate = async () => {
        if (!selected) return;
        try {
            await validateMutation.mutateAsync(selected.id);
            toast.success('Réception validée — stock mis à jour.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la validation.');
        }
    };

    const handleReasonSubmit = async () => {
        if (!selected || !showReasonForm) return;
        if (reason.trim().length < 10) { toast.error('Le motif doit contenir au moins 10 caractères.'); return; }
        try {
            if (showReasonForm === 'cancel') {
                await cancelMutation.mutateAsync({ id: selected.id, payload: { reason: reason.trim() } });
                toast.success('Réception annulée.');
            } else {
                await reverseMutation.mutateAsync({ id: selected.id, payload: { reason: reason.trim() } });
                toast.success('Réception reversée — stock et BC ajustés.');
            }
            setShowReasonForm(null);
            setReason('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'opération.");
        }
    };

    // ── Grid ──────────────────────────────────────────────────────────────────
    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'reception_number', headerName: 'N° Réception', width: 170,
            cellRenderer: (p: ICellRendererParams<PurchaseReception, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            colId: 'supplier', headerName: 'Fournisseur', flex: 1, minWidth: 140,
            valueGetter: p => p.data?.supplier?.name ?? '—',
            cellRenderer: (p: ICellRendererParams<PurchaseReception, string>) => <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.value}</span>,
        },
        {
            colId: 'bc', headerName: 'BC lié', width: 130,
            valueGetter: p => p.data?.purchaseOrder?.order_number ?? (p.data?.purchase_order_id ? `#${p.data.purchase_order_id}` : null),
            cellRenderer: (p: ICellRendererParams<PurchaseReception, string>) => p.value
                ? <span style={{ fontSize: '11px', color: '#4f46e5', display: 'flex', alignItems: 'center', gap: 4 }}><Link2 className="w-3 h-3" />{p.value}</span>
                : <span style={{ color: '#d1d5db', fontSize: '11px' }}>Ad hoc</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 150, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<PurchaseReception, PurchaseReceptionStatus>) => p.value ? <StatusBadge status={p.value} /> : null,
        },
        {
            field: 'reception_date', headerName: 'Date', width: 110, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<PurchaseReception, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Actions ───────────────────────────────────────────────────────────────
    // Plain computation, not useMemo — see the matching comment in
    // PurchaseOrderPage.tsx for why.
    const actionGroups: { items: ActionItemProps[] }[] = [
        { items: [{ icon: Plus, label: 'Nouvelle réception', variant: 'sage', onClick: openCreateForm }] },
    ];
    if (selected && !showCreateForm) {
        const items: ActionItemProps[] = [
            { icon: FileText, label: 'Imprimer PDF', variant: 'default', onClick: handlePrintPdf, disabled: pdfLoading },
        ];
        if (selected.status === 'draft') {
            items.push({ icon: CheckCircle2, label: 'Valider', variant: 'success', onClick: handleValidate, disabled: !selected.lines?.length || validateMutation.isPending });
            items.push({ icon: Ban, label: 'Annuler', variant: 'danger', onClick: () => setShowReasonForm(v => v === 'cancel' ? null : 'cancel') });
        }
        if (selected.status === 'validated') {
            items.push({ icon: RotateCcw, label: 'Reverser', variant: 'warning', onClick: () => setShowReasonForm(v => v === 'reverse' ? null : 'reverse') });
        }
        if (items.length) actionGroups.push({ items });
    }

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <PackageCheck className="w-4 h-4 text-sage-600" />
                            <h1 className="text-sm font-bold text-gray-900">Réception Achat</h1>
                        </div>
                        <select
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | PurchaseReceptionStatus)}
                            className="w-full px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 mb-2"
                        >
                            {STATUS_FILTERS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                        </select>
                        <AsyncCombobox value={supplierFilter} onChange={setSupplierFilter} onSearch={searchSuppliers} placeholder="Tous les fournisseurs…" />
                    </div>
                    <div className="flex-1 overflow-hidden">
                        <DataGrid rowData={rows} columnDefs={columnDefs} loading={isLoading} onRowClicked={e => selectRow(e.data)} />
                    </div>
                    {hasNextPage && (
                        <div className="p-2 border-t border-gray-100 shrink-0">
                            <button
                                onClick={() => fetchNextPage()} disabled={isFetchingNextPage}
                                className="w-full py-1.5 text-xs font-medium text-sage-600 hover:bg-sage-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {isFetchingNextPage ? <Loader2 className="w-3.5 h-3.5 animate-spin mx-auto" /> : 'Charger plus'}
                            </button>
                        </div>
                    )}
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                    {showCreateForm ? (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-3xl mx-auto bg-white border border-gray-200 rounded-xl p-6">
                                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-sage-600" /> Nouvelle Réception</h2>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Fournisseur <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newSupplier} onChange={opt => { setNewSupplier(opt); setNewBc(null); }} onSearch={searchSuppliers} placeholder="Rechercher un fournisseur…" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">BC lié <span className="text-[10px] font-normal text-gray-400">(optionnel — préremplit les lignes)</span></label>
                                        <AsyncCombobox value={newBc} onChange={setNewBc} onSearch={searchPurchaseOrdersForSupplier} placeholder={newSupplier ? 'Rechercher un BC confirmé…' : 'Choisir un fournisseur d\'abord'} disabled={!newSupplier} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Agence <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newBranch} onChange={setNewBranch} onSearch={searchBranchesOptions} placeholder="Rechercher une agence…" disabled={!!newBc} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Date réception</label>
                                        <input type="date" value={newReceptionDate} onChange={e => setNewReceptionDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                    <div className="col-span-2">
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">N° Facture fournisseur</label>
                                        <input value={newInvoiceNumber} onChange={e => setNewInvoiceNumber(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                </div>

                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Lignes</label>
                                    <button onClick={() => setNewLines(prev => [...prev, emptyLine()])} className="text-xs font-semibold text-sage-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter une ligne</button>
                                </div>
                                <div className="space-y-2 mb-6">
                                    {newLines.map(line => (
                                        <div key={line._key}>
                                            <div className="grid grid-cols-[1fr_130px_110px_28px] gap-2 items-center">
                                                <AsyncCombobox value={line.product} onChange={opt => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, product: opt } : l))} onSearch={searchProductOptions} placeholder="Produit…" />
                                                <input type="number" min="0" step="0.001" value={line.received_quantity} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, received_quantity: e.target.value } : l))} placeholder="Qté reçue" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                                <input type="number" min="0" step="0.01" value={line.unit_cost} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, unit_cost: e.target.value } : l))} placeholder="Coût *" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                                <button onClick={() => setNewLines(prev => prev.length > 1 ? prev.filter(l => l._key !== line._key) : prev)} disabled={newLines.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div>
                                            {line.remainingHint != null && (
                                                <p className="text-[10px] text-amber-600 mt-0.5 ml-0.5">Reste à recevoir sur le BC : {fmt(line.remainingHint, 3)}</p>
                                            )}
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={handleCreateSubmit} disabled={createMutation.isPending} className="px-4 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                        {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Créer la réception
                                    </button>
                                    <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                                </div>
                            </div>
                        </div>
                    ) : !selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <PackageCheck className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Réceptions Achat</p>
                            <p className="text-xs max-w-xs">Sélectionnez une réception dans la liste ou créez-en une nouvelle.</p>
                        </div>
                    ) : loadingDetail ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 font-mono">{selected.reception_number}</h2>
                                            <div className="mt-1"><StatusBadge status={selected.status} /></div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5 justify-end mb-0.5"><Building2 className="w-3 h-3" /> {selected.supplier?.name ?? '—'}</div>
                                            <div className="flex items-center gap-1.5 justify-end"><Calendar className="w-3 h-3" /> {fmtDate(selected.reception_date)}</div>
                                        </div>
                                    </div>
                                    {selected.purchase_order_id && (
                                        <div className="border-t border-gray-100 pt-3 flex items-center gap-1.5 text-xs text-indigo-600">
                                            <Link2 className="w-3.5 h-3.5" /> BC lié : <span className="font-mono font-semibold">{selected.purchaseOrder?.order_number ?? `#${selected.purchase_order_id}`}</span>
                                        </div>
                                    )}
                                    {selected.supplier_invoice_number && (
                                        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3 mt-3">Facture fournisseur : <span className="font-medium text-gray-700">{selected.supplier_invoice_number}</span></p>
                                    )}
                                </div>

                                {showReasonForm && (
                                    <div className={`border rounded-xl p-4 mb-4 ${showReasonForm === 'cancel' ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                                        <label className={`block text-[11px] font-semibold uppercase tracking-wide mb-1.5 ${showReasonForm === 'cancel' ? 'text-red-700' : 'text-amber-700'}`}>
                                            Motif {showReasonForm === 'cancel' ? "d'annulation" : 'de reversement'} (10-500 caractères)
                                        </label>
                                        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400 mb-2" />
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleReasonSubmit} disabled={cancelMutation.isPending || reverseMutation.isPending} className={`px-3 py-1.5 text-xs font-semibold text-white rounded-lg disabled:opacity-50 ${showReasonForm === 'cancel' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
                                                Confirmer
                                            </button>
                                            <button onClick={() => { setShowReasonForm(null); setReason(''); }} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                                <th className="text-left px-3 py-2">Produit</th>
                                                {selected.purchase_order_id && <th className="text-right px-3 py-2">Commandé</th>}
                                                <th className="text-right px-3 py-2">Reçu</th>
                                                <th className="text-right px-3 py-2">Accepté</th>
                                                <th className="text-right px-3 py-2">Coût unit.</th>
                                                <th className="text-center px-3 py-2">QC</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(selected.lines ?? []).map(line => (
                                                <tr key={line.id}>
                                                    <td className="px-3 py-2 font-medium text-gray-800">{line.product?.name ?? `#${line.product_id}`}</td>
                                                    {selected.purchase_order_id && <td className="px-3 py-2 text-right tabular-nums text-gray-400">{line.ordered_quantity ? fmt(line.ordered_quantity, 3) : '—'}</td>}
                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(line.received_quantity, 3)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{line.accepted_quantity ? fmt(line.accepted_quantity, 3) : '—'}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{fmtMAD(line.unit_cost)}</td>
                                                    <td className="px-3 py-2 text-center"><QcBadge status={line.qc_status} /></td>
                                                </tr>
                                            ))}
                                            {(!selected.lines || selected.lines.length === 0) && (
                                                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-300">Aucune ligne</td></tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 border-t border-gray-200">
                                                <td className="px-3 py-2 font-bold text-gray-700" colSpan={selected.purchase_order_id ? 4 : 3}>Total</td>
                                                <td className="px-3 py-2 text-right font-bold text-gray-900" colSpan={2}>{fmtMAD(selected.total_amount)}</td>
                                            </tr>
                                        </tfoot>
                                    </table>
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

function STATUS_META_LABEL(status: 'confirmed' | 'partially_received') {
    return status === 'confirmed' ? 'Confirmé' : 'Partiellement reçu';
}
