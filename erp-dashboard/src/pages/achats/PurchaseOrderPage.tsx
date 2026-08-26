import { useState, useRef, useMemo, useCallback } from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import {
    ShoppingCart, Search, X, Plus, Loader2, CheckCircle2, Ban, Package,
    Building2, Calendar, Trash2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import {
    usePurchaseOrders, usePurchaseOrder, useCreatePurchaseOrder, useConfirmPurchaseOrder,
    useCancelPurchaseOrder, useAddPurchaseOrderLine, useDeletePurchaseOrderLine,
} from '@/hooks/achats/usePurchaseOrders';
import { getPartners } from '@/services/api/partnerApi';
import { financeApi } from '@/services/api/financeApi';
import { searchProducts } from '@/services/api/pricingApi';
import type { PurchaseOrder, PurchaseOrderStatus, PurchaseOrderLinePayload } from '@/types/achats.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<PurchaseOrderStatus, { label: string; dot: string; text: string }> = {
    draft: { label: 'Brouillon', dot: 'bg-gray-400', text: 'text-gray-500' },
    confirmed: { label: 'Confirmé', dot: 'bg-blue-500', text: 'text-blue-700' },
    partially_received: { label: 'Partiellement reçu', dot: 'bg-amber-500', text: 'text-amber-700' },
    received: { label: 'Reçu', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cancelled: { label: 'Annulé', dot: 'bg-red-500', text: 'text-red-700' },
};
const StatusBadge = ({ status }: { status: PurchaseOrderStatus }) => {
    const m = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const STATUS_FILTERS: { value: 'all' | PurchaseOrderStatus; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'confirmed', label: 'Confirmé' },
    { value: 'partially_received', label: 'Partiellement reçu' },
    { value: 'received', label: 'Reçu' },
    { value: 'cancelled', label: 'Annulé' },
];

type DraftLine = { _key: string; product: ComboboxOption | null; ordered_quantity: string; unit_cost: string };
const emptyLine = (): DraftLine => ({ _key: crypto.randomUUID(), product: null, ordered_quantity: '', unit_cost: '' });

const searchSuppliers = async (q: string): Promise<ComboboxOption[]> => {
    // No confirmed backend `partner_type` slug for "supplier" yet — same
    // unfiltered partner search every other GCOM combobox uses. Narrow this
    // if/when backend confirms a filter value.
    const res = await getPartners({ q, per_page: 20 });
    return (res.partners.data ?? []).map(p => ({ id: p.id, label: p.name, sub: p.code }));
};
const searchBranchesOptions = async (q: string): Promise<ComboboxOption[]> => {
    const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
    // `id` holds the branch CODE (not the numeric id) — the Achats API takes
    // branch_code directly, not branch_id (doc §3.3).
    return (res.data ?? []).map(b => ({ id: b.code, label: b.name, sub: b.code }));
};
const searchProductOptions = async (q: string): Promise<ComboboxOption[]> => {
    const res = await searchProducts(q);
    return (res ?? []).map(p => ({ id: p.id, label: p.name, sub: p.code }));
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function PurchaseOrderPage() {
    // ── List filters ─────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<'all' | PurchaseOrderStatus>('all');
    const [supplierFilter, setSupplierFilter] = useState<ComboboxOption | null>(null);
    const [search, setSearch] = useState('');
    const [searchDebounced, setSearchDebounced] = useState('');
    const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const onSearchChange = (v: string) => {
        setSearch(v);
        if (searchDebounceRef.current) clearTimeout(searchDebounceRef.current);
        searchDebounceRef.current = setTimeout(() => setSearchDebounced(v), 300);
    };

    const listFilters = useMemo(() => ({
        status: statusFilter === 'all' ? undefined : statusFilter,
        supplier_id: supplierFilter ? Number(supplierFilter.id) : undefined,
        search: searchDebounced || undefined,
    }), [statusFilter, supplierFilter, searchDebounced]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = usePurchaseOrders(listFilters);
    const rows = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);

    // ── Selection / detail ───────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const { data: selected, isLoading: loadingDetail } = usePurchaseOrder(selectedId);

    // ── Create form ───────────────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSupplier, setNewSupplier] = useState<ComboboxOption | null>(null);
    const [newBranch, setNewBranch] = useState<ComboboxOption | null>(null);
    const [newOrderDate, setNewOrderDate] = useState('');
    const [newExpectedDate, setNewExpectedDate] = useState('');
    const [newNotes, setNewNotes] = useState('');
    const [newLines, setNewLines] = useState<DraftLine[]>([emptyLine()]);

    const resetCreateForm = () => {
        setNewSupplier(null); setNewBranch(null); setNewOrderDate(''); setNewExpectedDate('');
        setNewNotes(''); setNewLines([emptyLine()]);
    };

    // ── Add-line form (existing draft BC) ────────────────────────────────────
    const [showAddLineForm, setShowAddLineForm] = useState(false);
    const [addLineProduct, setAddLineProduct] = useState<ComboboxOption | null>(null);
    const [addLineQty, setAddLineQty] = useState('');
    const [addLineCost, setAddLineCost] = useState('');

    // ── Cancel form ───────────────────────────────────────────────────────────
    const [showCancelForm, setShowCancelForm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const createMutation = useCreatePurchaseOrder();
    const confirmMutation = useConfirmPurchaseOrder();
    const cancelMutation = useCancelPurchaseOrder();
    const addLineMutation = useAddPurchaseOrderLine();
    const deleteLineMutation = useDeletePurchaseOrderLine();

    const openCreateForm = useCallback(() => {
        setSelectedId(null);
        setShowAddLineForm(false);
        setShowCancelForm(false);
        resetCreateForm();
        setShowCreateForm(true);
    }, []);

    const selectRow = useCallback((row: PurchaseOrder) => {
        setShowCreateForm(false);
        setShowAddLineForm(false);
        setShowCancelForm(false);
        setSelectedId(row.id);
    }, []);

    const handleCreateSubmit = async () => {
        if (!newSupplier) { toast.error('Sélectionnez un fournisseur.'); return; }
        if (!newBranch) { toast.error('Sélectionnez une agence.'); return; }
        const lines: PurchaseOrderLinePayload[] = [];
        for (const l of newLines) {
            if (!l.product) continue;
            const qty = parseFloat(l.ordered_quantity);
            if (!qty || qty <= 0) { toast.error('Quantité invalide sur une ligne.'); return; }
            lines.push({ product_id: Number(l.product.id), ordered_quantity: qty, unit_cost: l.unit_cost ? parseFloat(l.unit_cost) : undefined });
        }
        if (lines.length === 0) { toast.error('Ajoutez au moins une ligne avec un produit.'); return; }

        try {
            const res = await createMutation.mutateAsync({
                supplier_id: Number(newSupplier.id),
                branch_code: String(newBranch.id),
                order_date: newOrderDate || undefined,
                expected_delivery_date: newExpectedDate || undefined,
                notes: newNotes || undefined,
                lines,
            });
            toast.success('BC Fournisseur créé.');
            setShowCreateForm(false);
            setSelectedId(res.data.id);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la création du BC.');
        }
    };

    const handleConfirm = async () => {
        if (!selected) return;
        try {
            await confirmMutation.mutateAsync(selected.id);
            toast.success('BC confirmé.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la confirmation.');
        }
    };

    const handleCancel = async () => {
        if (!selected) return;
        if (cancelReason.trim().length < 10) { toast.error('Le motif doit contenir au moins 10 caractères.'); return; }
        try {
            await cancelMutation.mutateAsync({ id: selected.id, payload: { reason: cancelReason.trim() } });
            toast.success('BC annulé.');
            setShowCancelForm(false);
            setCancelReason('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation.");
        }
    };

    const handleAddLine = async () => {
        if (!selected) return;
        if (!addLineProduct) { toast.error('Sélectionnez un produit.'); return; }
        const qty = parseFloat(addLineQty);
        if (!qty || qty <= 0) { toast.error('Quantité invalide.'); return; }
        try {
            await addLineMutation.mutateAsync({
                id: selected.id,
                payload: { product_id: Number(addLineProduct.id), ordered_quantity: qty, unit_cost: addLineCost ? parseFloat(addLineCost) : undefined },
            });
            toast.success('Ligne ajoutée.');
            setShowAddLineForm(false);
            setAddLineProduct(null); setAddLineQty(''); setAddLineCost('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'ajout de la ligne.");
        }
    };

    const handleDeleteLine = async (lineId: number) => {
        if (!selected) return;
        try {
            await deleteLineMutation.mutateAsync({ id: selected.id, lineId });
            toast.success('Ligne supprimée.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la suppression de la ligne.');
        }
    };

    // ── Grid ──────────────────────────────────────────────────────────────────
    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'order_number', headerName: 'N° BC', width: 170,
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            colId: 'supplier', headerName: 'Fournisseur', flex: 1, minWidth: 140,
            valueGetter: p => p.data?.supplier?.name ?? '—',
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, string>) => <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.value}</span>,
        },
        {
            field: 'branch_code', headerName: 'Agence', width: 90, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{p.value}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 150, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, PurchaseOrderStatus>) => p.value ? <StatusBadge status={p.value} /> : null,
        },
        {
            field: 'total_amount', headerName: 'Montant', width: 120, filter: 'agNumberColumnFilter',
            cellStyle: { textAlign: 'right' }, headerClass: 'ag-right-aligned-header',
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, string>) => <span style={{ fontSize: '12px', fontWeight: 700 }}>{fmtMAD(p.value)}</span>,
        },
        {
            field: 'order_date', headerName: 'Date', width: 110, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<PurchaseOrder, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Actions ───────────────────────────────────────────────────────────────
    // Plain computation, not useMemo — cheap array construction, and it lets
    // us reference handleConfirm/etc directly without fighting the React
    // Compiler's manual-memoization-preservation check over deps it can't
    // reconcile (same class of issue as GcomCatalogEntryScreen's CatalogRow).
    const actionGroups: { items: ActionItemProps[] }[] = [
        { items: [{ icon: Plus, label: 'Nouveau BC', variant: 'sage', onClick: openCreateForm }] },
    ];
    if (selected && !showCreateForm) {
        const items: ActionItemProps[] = [];
        if (selected.status === 'draft') {
            items.push({ icon: CheckCircle2, label: 'Confirmer', variant: 'success', onClick: handleConfirm, disabled: !selected.lines?.length || confirmMutation.isPending });
            items.push({ icon: Package, label: 'Ajouter une ligne', variant: 'default', onClick: () => setShowAddLineForm(v => !v) });
        }
        if (selected.status === 'draft' || selected.status === 'confirmed') {
            items.push({ icon: Ban, label: 'Annuler', variant: 'danger', onClick: () => setShowCancelForm(v => !v) });
        }
        if (items.length) actionGroups.push({ items });
    }

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <ShoppingCart className="w-4 h-4 text-sage-600" />
                            <h1 className="text-sm font-bold text-gray-900">BC Fournisseur</h1>
                        </div>
                        <div className="relative mb-2">
                            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
                            <input
                                value={search} onChange={e => onSearchChange(e.target.value)}
                                placeholder="Rechercher un BC…"
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                            {search && (
                                <button onClick={() => onSearchChange('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                        <select
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | PurchaseOrderStatus)}
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
                                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-sage-600" /> Nouveau BC Fournisseur</h2>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Fournisseur <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newSupplier} onChange={setNewSupplier} onSearch={searchSuppliers} placeholder="Rechercher un fournisseur…" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Agence <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newBranch} onChange={setNewBranch} onSearch={searchBranchesOptions} placeholder="Rechercher une agence…" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Date commande</label>
                                        <input type="date" value={newOrderDate} onChange={e => setNewOrderDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Livraison prévue</label>
                                        <input type="date" value={newExpectedDate} onChange={e => setNewExpectedDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                </div>
                                <div className="mb-4">
                                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Notes</label>
                                    <textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                </div>

                                <div className="mb-2 flex items-center justify-between">
                                    <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Lignes</label>
                                    <button onClick={() => setNewLines(prev => [...prev, emptyLine()])} className="text-xs font-semibold text-sage-600 hover:underline flex items-center gap-1"><Plus className="w-3 h-3" /> Ajouter une ligne</button>
                                </div>
                                <div className="space-y-2 mb-6">
                                    {newLines.map((line) => (
                                        <div key={line._key} className="grid grid-cols-[1fr_110px_110px_28px] gap-2 items-center">
                                            <AsyncCombobox value={line.product} onChange={opt => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, product: opt } : l))} onSearch={searchProductOptions} placeholder="Produit…" />
                                            <input type="number" min="0" step="0.001" value={line.ordered_quantity} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, ordered_quantity: e.target.value } : l))} placeholder="Qté" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            <input type="number" min="0" step="0.01" value={line.unit_cost} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, unit_cost: e.target.value } : l))} placeholder="Coût (opt.)" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            <button onClick={() => setNewLines(prev => prev.length > 1 ? prev.filter(l => l._key !== line._key) : prev)} disabled={newLines.length === 1} className="text-gray-300 hover:text-red-500 disabled:opacity-30"><Trash2 className="w-3.5 h-3.5" /></button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex items-center gap-2">
                                    <button onClick={handleCreateSubmit} disabled={createMutation.isPending} className="px-4 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                        {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Créer le BC
                                    </button>
                                    <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                                </div>
                            </div>
                        </div>
                    ) : !selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <ShoppingCart className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Bons de Commande Fournisseur</p>
                            <p className="text-xs max-w-xs">Sélectionnez un BC dans la liste ou créez-en un nouveau.</p>
                        </div>
                    ) : loadingDetail ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 font-mono">{selected.order_number}</h2>
                                            <div className="mt-1"><StatusBadge status={selected.status} /></div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5 justify-end mb-0.5"><Building2 className="w-3 h-3" /> {selected.supplier?.name ?? '—'}</div>
                                            <div className="flex items-center gap-1.5 justify-end"><Calendar className="w-3 h-3" /> {fmtDate(selected.order_date)}{selected.expected_delivery_date ? ` → ${fmtDate(selected.expected_delivery_date)}` : ''}</div>
                                        </div>
                                    </div>
                                    {selected.notes && <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">{selected.notes}</p>}
                                </div>

                                {showCancelForm && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                        <label className="block text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Motif d'annulation (10-500 caractères)</label>
                                        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 mb-2" />
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleCancel} disabled={cancelMutation.isPending} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Confirmer l'annulation</button>
                                            <button onClick={() => setShowCancelForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                        </div>
                                    </div>
                                )}

                                {showAddLineForm && (
                                    <div className="bg-sage-50 border border-sage-200 rounded-xl p-4 mb-4">
                                        <label className="block text-[11px] font-semibold text-sage-700 uppercase tracking-wide mb-1.5">Nouvelle ligne</label>
                                        <div className="grid grid-cols-[1fr_110px_110px] gap-2 mb-2">
                                            <AsyncCombobox value={addLineProduct} onChange={setAddLineProduct} onSearch={searchProductOptions} placeholder="Produit…" />
                                            <input type="number" min="0" step="0.001" value={addLineQty} onChange={e => setAddLineQty(e.target.value)} placeholder="Qté" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            <input type="number" min="0" step="0.01" value={addLineCost} onChange={e => setAddLineCost(e.target.value)} placeholder="Coût (opt.)" className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleAddLine} disabled={addLineMutation.isPending} className="px-3 py-1.5 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50">Ajouter</button>
                                            <button onClick={() => setShowAddLineForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                                <th className="text-left px-3 py-2">Produit</th>
                                                <th className="text-right px-3 py-2">Commandé</th>
                                                <th className="text-right px-3 py-2">Reçu</th>
                                                <th className="text-right px-3 py-2">Coût unit.</th>
                                                <th className="text-right px-3 py-2">Sous-total</th>
                                                {selected.status === 'draft' && <th className="w-8" />}
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(selected.lines ?? []).map(line => {
                                                const ordered = parseFloat(line.ordered_quantity) || 0;
                                                const received = parseFloat(line.received_quantity) || 0;
                                                const remaining = ordered - received;
                                                return (
                                                    <tr key={line.id}>
                                                        <td className="px-3 py-2 font-medium text-gray-800">{line.product?.name ?? `#${line.product_id}`}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{fmt(ordered, 3)}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums">
                                                            <span className={received >= ordered && ordered > 0 ? 'text-emerald-600 font-semibold' : remaining > 0 ? 'text-amber-600 font-semibold' : 'text-gray-500'}>{fmt(received, 3)}</span>
                                                            <span className="text-gray-300"> / {fmt(ordered, 3)}</span>
                                                        </td>
                                                        <td className="px-3 py-2 text-right tabular-nums">{line.unit_cost ? fmtMAD(line.unit_cost) : '—'}</td>
                                                        <td className="px-3 py-2 text-right tabular-nums font-semibold">{line.unit_cost ? fmtMAD(ordered * parseFloat(line.unit_cost)) : '—'}</td>
                                                        {selected.status === 'draft' && (
                                                            <td className="px-2 py-2 text-center">
                                                                <button onClick={() => handleDeleteLine(line.id)} className="text-gray-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                                                            </td>
                                                        )}
                                                    </tr>
                                                );
                                            })}
                                            {(!selected.lines || selected.lines.length === 0) && (
                                                <tr><td colSpan={6} className="px-3 py-6 text-center text-gray-300">Aucune ligne</td></tr>
                                            )}
                                        </tbody>
                                        <tfoot>
                                            <tr className="bg-gray-50 border-t border-gray-200">
                                                <td className="px-3 py-2 font-bold text-gray-700" colSpan={4}>Total</td>
                                                <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtMAD(selected.total_amount)}</td>
                                                {selected.status === 'draft' && <td />}
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
