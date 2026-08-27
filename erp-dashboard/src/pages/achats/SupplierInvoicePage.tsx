import { useState, useMemo, useCallback, useEffect } from 'react';
import type { ICellRendererParams } from 'ag-grid-community';
import {
    Receipt, Plus, Loader2, CheckCircle2, Ban, Building2, Calendar,
    Link2, AlertTriangle, ShieldAlert, FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import {
    useSupplierInvoices, useSupplierInvoice, useCreateSupplierInvoice,
    useApproveSupplierInvoice, useCancelSupplierInvoice,
} from '@/hooks/achats/useSupplierInvoices';
import { usePurchaseOrder } from '@/hooks/achats/usePurchaseOrders';
import { achatsApi } from '@/services/api/achatsApi';
import { usePermissions } from '@/hooks/usePermissions';
import type {
    SupplierInvoice, SupplierInvoiceStatus, MatchStatus, SupplierInvoiceLinePayload, PurchaseOrderLine,
} from '@/types/achats.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtPct = (n: string | null | undefined) => n == null ? '—' : `${fmt(n, 1)}%`;

const STATUS_META: Record<SupplierInvoiceStatus, { label: string; dot: string; text: string }> = {
    pending_review: { label: 'À vérifier', dot: 'bg-amber-500', text: 'text-amber-700' },
    matched: { label: 'Rapprochée', dot: 'bg-blue-500', text: 'text-blue-700' },
    approved: { label: 'Approuvée', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cancelled: { label: 'Annulée', dot: 'bg-red-500', text: 'text-red-700' },
};
const StatusBadge = ({ status }: { status: SupplierInvoiceStatus }) => {
    const m = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const MATCH_META: Record<MatchStatus, { label: string; dot: string; text: string }> = {
    matched: { label: 'OK', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    discrepancy: { label: 'Écart', dot: 'bg-red-500', text: 'text-red-700' },
    unmatched: { label: 'Non rapproché', dot: 'bg-gray-400', text: 'text-gray-500' },
};
const MatchBadge = ({ status }: { status: MatchStatus }) => {
    const m = MATCH_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1 text-[10px] font-semibold ${m.text}`}><span className={`w-1 h-1 rounded-full ${m.dot}`} />{m.label}</span>;
};

const STATUS_FILTERS: { value: 'all' | SupplierInvoiceStatus; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'pending_review', label: 'À vérifier' },
    { value: 'matched', label: 'Rapprochée' },
    { value: 'approved', label: 'Approuvée' },
    { value: 'cancelled', label: 'Annulée' },
];

const PO_STATUS_LABEL: Record<string, string> = {
    confirmed: 'Confirmé', partially_received: 'Partiellement reçu', received: 'Reçu',
};

type DraftLine = { _key: string; poLine: PurchaseOrderLine; invoiced_quantity: string; unit_cost: string; tax_percent: string; checked: boolean };

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

// ─── Component ───────────────────────────────────────────────────────────────

export default function SupplierInvoicePage() {
    const { has } = usePermissions();
    const canOverrideTolerance = has('override-purchase-matching-tolerance');

    // ── List filters ─────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<'all' | SupplierInvoiceStatus>('all');
    const [supplierFilter, setSupplierFilter] = useState<ComboboxOption | null>(null);

    const listFilters = useMemo(() => ({
        status: statusFilter === 'all' ? undefined : statusFilter,
        supplier_id: supplierFilter ? Number(supplierFilter.id) : undefined,
    }), [statusFilter, supplierFilter]);

    const { data, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage } = useSupplierInvoices(listFilters);
    const rows = useMemo(() => data?.pages.flatMap(p => p.data) ?? [], [data]);

    // ── Selection / detail ───────────────────────────────────────────────────
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const { data: selected, isLoading: loadingDetail } = useSupplierInvoice(selectedId);

    // ── Create form ───────────────────────────────────────────────────────────
    const [showCreateForm, setShowCreateForm] = useState(false);
    const [newSupplier, setNewSupplier] = useState<ComboboxOption | null>(null);
    const [newBc, setNewBc] = useState<ComboboxOption | null>(null);
    const [newReference, setNewReference] = useState('');
    const [newInvoiceDate, setNewInvoiceDate] = useState('');
    const [newLines, setNewLines] = useState<DraftLine[]>([]);

    const resetCreateForm = () => {
        setNewSupplier(null); setNewBc(null); setNewReference(''); setNewInvoiceDate(''); setNewLines([]);
    };

    const selectedBcId = newBc ? Number(newBc.id) : null;
    const { data: bcDetail } = usePurchaseOrder(selectedBcId);
    useEffect(() => {
        if (!bcDetail) return;
        setNewLines((bcDetail.lines ?? []).map(l => ({
            _key: crypto.randomUUID(),
            poLine: l,
            invoiced_quantity: l.received_quantity && parseFloat(l.received_quantity) > 0 ? l.received_quantity : l.ordered_quantity,
            unit_cost: l.unit_cost ?? '',
            tax_percent: '20',
            checked: true,
        })));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bcDetail?.id]);

    const searchPurchaseOrdersForSupplier = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        if (!newSupplier) return [];
        const res = await achatsApi.purchaseOrders.list({ supplier_id: Number(newSupplier.id), search: q || undefined, per_page: 20 });
        return (res.data ?? [])
            .filter((po): po is typeof po & { status: 'confirmed' | 'partially_received' | 'received' } =>
                po.status === 'confirmed' || po.status === 'partially_received' || po.status === 'received')
            .map(po => ({ id: po.id, label: po.order_number, sub: PO_STATUS_LABEL[po.status] }));
    }, [newSupplier]);

    // ── Cancel form ───────────────────────────────────────────────────────────
    const [showCancelForm, setShowCancelForm] = useState(false);
    const [cancelReason, setCancelReason] = useState('');

    const createMutation = useCreateSupplierInvoice();
    const approveMutation = useApproveSupplierInvoice();
    const cancelMutation = useCancelSupplierInvoice();

    const openCreateForm = useCallback(() => {
        setSelectedId(null);
        setShowCancelForm(false);
        resetCreateForm();
        setShowCreateForm(true);
    }, []);

    const selectRow = useCallback((row: SupplierInvoice) => {
        setShowCreateForm(false);
        setShowCancelForm(false);
        setSelectedId(row.id);
    }, []);

    const handleCreateSubmit = async () => {
        if (!newSupplier) { toast.error('Sélectionnez un fournisseur.'); return; }
        if (!newBc || !bcDetail) { toast.error('Sélectionnez un BC — chaque ligne de facture doit référencer une ligne de BC.'); return; }
        const lines: SupplierInvoiceLinePayload[] = [];
        for (const l of newLines) {
            if (!l.checked) continue;
            const qty = parseFloat(l.invoiced_quantity);
            const cost = parseFloat(l.unit_cost);
            if (!qty || qty <= 0) { toast.error(`Quantité facturée invalide sur ${l.poLine.product?.name ?? `#${l.poLine.product_id}`}.`); return; }
            if (!cost || cost <= 0) { toast.error(`Coût unitaire invalide sur ${l.poLine.product?.name ?? `#${l.poLine.product_id}`}.`); return; }
            lines.push({
                purchase_order_line_id: l.poLine.id,
                product_id: l.poLine.product_id,
                invoiced_quantity: qty,
                unit_cost: cost,
                tax_percent: l.tax_percent ? parseFloat(l.tax_percent) : undefined,
            });
        }
        if (lines.length === 0) { toast.error('Cochez au moins une ligne à facturer.'); return; }

        try {
            const res = await createMutation.mutateAsync({
                supplier_id: Number(newSupplier.id),
                supplier_invoice_reference: newReference || undefined,
                invoice_date: newInvoiceDate || undefined,
                lines,
            });
            toast.success(res.data.has_discrepancy ? 'Facture créée — écarts détectés, à vérifier.' : 'Facture créée et rapprochée.');
            setShowCreateForm(false);
            setSelectedId(res.data.id);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la création de la facture.');
        }
    };

    const [pdfLoading, setPdfLoading] = useState(false);
    const handlePrintPdf = async () => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await achatsApi.supplierInvoices.getPdfBlobUrl(selected.id);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    // Doc's explicit UX requirement: never just disable Approve on a
    // discrepancy — always let the click go through and surface the
    // backend's real 400 message, since that's the source of truth for
    // whether this specific user has override-purchase-matching-tolerance.
    const handleApprove = async () => {
        if (!selected) return;
        try {
            await approveMutation.mutateAsync(selected.id);
            toast.success('Facture approuvée.');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string }; status?: number } })?.response?.data?.message;
            const status = (err as { response?: { status?: number } })?.response?.status;
            if (status === 400) {
                toast.error(msg ?? "Approbation refusée — écart hors tolérance et permission de dérogation manquante. Escaladez à un profil comptable.", { duration: 6000 });
            } else {
                toast.error(msg ?? "Erreur lors de l'approbation.");
            }
        }
    };

    const handleCancel = async () => {
        if (!selected) return;
        if (cancelReason.trim().length < 10) { toast.error('Le motif doit contenir au moins 10 caractères.'); return; }
        try {
            await cancelMutation.mutateAsync({ id: selected.id, payload: { reason: cancelReason.trim() } });
            toast.success('Facture annulée.');
            setShowCancelForm(false);
            setCancelReason('');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation.");
        }
    };

    // ── Grid ──────────────────────────────────────────────────────────────────
    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'invoice_number', headerName: 'N° Facture', width: 170,
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            colId: 'supplier', headerName: 'Fournisseur', flex: 1, minWidth: 140,
            valueGetter: p => p.data?.supplier?.name ?? '—',
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, string>) => <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.value}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 130, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, SupplierInvoiceStatus>) => p.value ? <StatusBadge status={p.value} /> : null,
        },
        {
            colId: 'discrepancy', headerName: 'Écart', width: 70,
            valueGetter: p => p.data?.has_discrepancy ?? false,
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, boolean>) => p.value
                ? <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                : null,
        },
        {
            field: 'total_amount', headerName: 'Montant', width: 120, filter: 'agNumberColumnFilter',
            cellStyle: { textAlign: 'right' }, headerClass: 'ag-right-aligned-header',
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, string>) => <span style={{ fontSize: '12px', fontWeight: 700 }}>{fmtMAD(p.value)}</span>,
        },
        {
            field: 'invoice_date', headerName: 'Date', width: 110, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<SupplierInvoice, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Actions ───────────────────────────────────────────────────────────────
    // Plain computation, not useMemo — see PurchaseOrderPage.tsx for why.
    const actionGroups: { items: ActionItemProps[] }[] = [
        { items: [{ icon: Plus, label: 'Nouvelle facture', variant: 'sage', onClick: openCreateForm }] },
    ];
    if (selected && !showCreateForm) {
        const items: ActionItemProps[] = [
            { icon: FileText, label: 'Imprimer PDF', variant: 'default', onClick: handlePrintPdf, disabled: pdfLoading },
        ];
        if (selected.status === 'pending_review' || selected.status === 'matched') {
            items.push({ icon: CheckCircle2, label: 'Approuver', variant: 'success', onClick: handleApprove, disabled: approveMutation.isPending });
        }
        if (selected.status !== 'cancelled') {
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
                            <Receipt className="w-4 h-4 text-sage-600" />
                            <h1 className="text-sm font-bold text-gray-900">Facture Fournisseur</h1>
                        </div>
                        <select
                            value={statusFilter} onChange={e => setStatusFilter(e.target.value as 'all' | SupplierInvoiceStatus)}
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
                                <h2 className="text-sm font-bold text-gray-900 mb-4 flex items-center gap-2"><Plus className="w-4 h-4 text-sage-600" /> Nouvelle Facture Fournisseur</h2>
                                <div className="grid grid-cols-2 gap-4 mb-4">
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Fournisseur <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newSupplier} onChange={opt => { setNewSupplier(opt); setNewBc(null); }} onSearch={searchSuppliers} placeholder="Rechercher un fournisseur…" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">BC Fournisseur <span className="text-red-500">*</span></label>
                                        <AsyncCombobox value={newBc} onChange={setNewBc} onSearch={searchPurchaseOrdersForSupplier} placeholder={newSupplier ? 'Rechercher un BC…' : 'Choisir un fournisseur d\'abord'} disabled={!newSupplier} />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Réf. facture fournisseur</label>
                                        <input value={newReference} onChange={e => setNewReference(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                    <div>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-1">Date facture</label>
                                        <input type="date" value={newInvoiceDate} onChange={e => setNewInvoiceDate(e.target.value)} className="w-full px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                    </div>
                                </div>

                                {newBc && (
                                    <>
                                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide mb-2">Lignes du BC — décochez ce qui n'est pas facturé sur cette facture</label>
                                        <div className="space-y-2 mb-6">
                                            {newLines.length === 0 && <p className="text-xs text-gray-400 italic">Chargement des lignes…</p>}
                                            {newLines.map(line => (
                                                <div key={line._key} className={`grid grid-cols-[20px_1fr_100px_100px_70px] gap-2 items-center p-2 rounded-lg ${line.checked ? 'bg-sage-50' : 'bg-gray-50 opacity-60'}`}>
                                                    <input type="checkbox" checked={line.checked} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, checked: e.target.checked } : l))} />
                                                    <div className="text-xs">
                                                        <span className="font-medium text-gray-800">{line.poLine.product?.name ?? `#${line.poLine.product_id}`}</span>
                                                        <span className="text-[10px] text-gray-400 ml-1.5">commandé {fmt(line.poLine.ordered_quantity, 3)} / reçu {fmt(line.poLine.received_quantity, 3)}</span>
                                                    </div>
                                                    <input type="number" min="0" step="0.001" disabled={!line.checked} value={line.invoiced_quantity} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, invoiced_quantity: e.target.value } : l))} placeholder="Qté fact." className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-100" />
                                                    <input type="number" min="0" step="0.01" disabled={!line.checked} value={line.unit_cost} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, unit_cost: e.target.value } : l))} placeholder="Coût" className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-100" />
                                                    <input type="number" min="0" step="0.1" disabled={!line.checked} value={line.tax_percent} onChange={e => setNewLines(prev => prev.map(l => l._key === line._key ? { ...l, tax_percent: e.target.value } : l))} placeholder="TVA%" className="px-2 py-1 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-100" />
                                                </div>
                                            ))}
                                        </div>
                                    </>
                                )}

                                <div className="flex items-center gap-2">
                                    <button onClick={handleCreateSubmit} disabled={createMutation.isPending || !newBc} className="px-4 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg disabled:opacity-50 flex items-center gap-1.5">
                                        {createMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Créer la facture
                                    </button>
                                    <button onClick={() => setShowCreateForm(false)} className="px-4 py-2 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Annuler</button>
                                </div>
                            </div>
                        </div>
                    ) : !selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <Receipt className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Factures Fournisseur</p>
                            <p className="text-xs max-w-xs">Sélectionnez une facture dans la liste ou créez-en une nouvelle depuis un BC.</p>
                        </div>
                    ) : loadingDetail ? (
                        <div className="flex-1 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-gray-300" /></div>
                    ) : (
                        <div className="flex-1 overflow-y-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2 font-mono">{selected.invoice_number}</h2>
                                            <div className="mt-1"><StatusBadge status={selected.status} /></div>
                                        </div>
                                        <div className="text-right text-xs text-gray-500">
                                            <div className="flex items-center gap-1.5 justify-end mb-0.5"><Building2 className="w-3 h-3" /> {selected.supplier?.name ?? '—'}</div>
                                            <div className="flex items-center gap-1.5 justify-end"><Calendar className="w-3 h-3" /> {fmtDate(selected.invoice_date)}</div>
                                        </div>
                                    </div>
                                    {selected.supplier_invoice_reference && (
                                        <p className="text-xs text-gray-500 border-t border-gray-100 pt-3">Réf. fournisseur : <span className="font-medium text-gray-700">{selected.supplier_invoice_reference}</span></p>
                                    )}
                                    <div className="grid grid-cols-3 gap-3 mt-3 pt-3 border-t border-gray-100 text-xs">
                                        <div><span className="text-gray-400">Sous-total</span><div className="font-bold text-gray-800">{fmtMAD(selected.subtotal)}</div></div>
                                        <div><span className="text-gray-400">TVA</span><div className="font-bold text-gray-800">{fmtMAD(selected.tax_amount)}</div></div>
                                        <div><span className="text-gray-400">Total</span><div className="font-bold text-gray-900">{fmtMAD(selected.total_amount)}</div></div>
                                    </div>
                                </div>

                                {/* The core UX requirement (doc §11): make discrepancy lines and their
                                    reason unmistakable, and explain the override path before the user
                                    even clicks Approve — not just a disabled button. */}
                                {selected.has_discrepancy && selected.status !== 'cancelled' && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4">
                                        <div className="flex items-start gap-2.5">
                                            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                                            <div className="text-xs text-amber-800">
                                                <p className="font-semibold mb-1">Écarts détectés hors tolérance</p>
                                                <p>Les lignes marquées « Écart » ci-dessous diffèrent du BC ou de la réception au-delà de la tolérance autorisée (quantité et/ou prix).
                                                {selected.status === 'approved'
                                                    ? ' Cette facture a été approuvée malgré ces écarts (dérogation appliquée).'
                                                    : canOverrideTolerance
                                                        ? ' Vous disposez de la permission de dérogation — vous pouvez approuver directement.'
                                                        : " L'approbation directe sera refusée sans la permission de dérogation (override-purchase-matching-tolerance) — escaladez à un profil comptable ou un administrateur."}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {showCancelForm && (
                                    <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-4">
                                        <label className="block text-[11px] font-semibold text-red-700 uppercase tracking-wide mb-1.5">Motif d'annulation (10-500 caractères)</label>
                                        <textarea value={cancelReason} onChange={e => setCancelReason(e.target.value)} rows={2} className="w-full px-3 py-1.5 text-xs border border-red-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-red-400 mb-2" />
                                        {selected.status === 'approved' && (
                                            <p className="text-[10px] text-red-600 mb-2 flex items-center gap-1"><ShieldAlert className="w-3 h-3" /> Cette facture est approuvée — l'annulation décrémentera les quantités facturées sur le BC.</p>
                                        )}
                                        <div className="flex items-center gap-2">
                                            <button onClick={handleCancel} disabled={cancelMutation.isPending} className="px-3 py-1.5 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50">Confirmer l'annulation</button>
                                            <button onClick={() => setShowCancelForm(false)} className="px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-100 rounded-lg">Fermer</button>
                                        </div>
                                    </div>
                                )}

                                <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
                                    <table className="w-full text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wide text-gray-500">
                                                <th className="text-left px-3 py-2">Produit</th>
                                                <th className="text-right px-3 py-2">Qté facturée</th>
                                                <th className="text-right px-3 py-2">Coût unit.</th>
                                                <th className="text-right px-3 py-2">Total</th>
                                                <th className="text-right px-3 py-2">Écart qté</th>
                                                <th className="text-right px-3 py-2">Écart prix</th>
                                                <th className="text-center px-3 py-2">Rapprochement</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {(selected.lines ?? []).map(line => (
                                                <tr key={line.id} className={line.match_status === 'discrepancy' ? 'bg-red-50/40' : undefined}>
                                                    <td className="px-3 py-2 font-medium text-gray-800">
                                                        {line.product?.name ?? `#${line.product_id}`}
                                                        {line.purchase_reception_line_id && <Link2 className="w-3 h-3 text-indigo-400 inline-block ml-1" />}
                                                    </td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmt(line.invoiced_quantity, 3)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums">{fmtMAD(line.unit_cost)}</td>
                                                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{fmtMAD(line.line_total)}</td>
                                                    <td className={`px-3 py-2 text-right tabular-nums ${line.quantity_variance_percent && parseFloat(line.quantity_variance_percent) !== 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{fmtPct(line.quantity_variance_percent)}</td>
                                                    <td className={`px-3 py-2 text-right tabular-nums ${line.price_variance_percent && parseFloat(line.price_variance_percent) !== 0 ? 'text-red-600 font-semibold' : 'text-gray-400'}`}>{fmtPct(line.price_variance_percent)}</td>
                                                    <td className="px-3 py-2 text-center"><MatchBadge status={line.match_status} /></td>
                                                </tr>
                                            ))}
                                            {(!selected.lines || selected.lines.length === 0) && (
                                                <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-300">Aucune ligne</td></tr>
                                            )}
                                        </tbody>
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
