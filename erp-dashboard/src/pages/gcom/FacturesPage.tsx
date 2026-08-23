import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    FileText, Search, X, Loader2, RefreshCw, Download, Building2,
    Info, Package, RotateCcw, Calendar, Truck, ReceiptText, Banknote, Landmark, CreditCard, CheckCircle2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { PdfPriceModeModal } from '@/components/gcom/PdfPriceModeModal';

import { gcomApi } from '@/services/api/gcomApi';
import { getPartners } from '@/services/api/partnerApi';
import { RETURN_CONDITIONS } from '@/lib/gcom/returnConditions';
import type { Partner } from '@/types/partner.types';
import type { GcomInvoice, GcomInvoiceStatus, GcomInvoiceItem, GcomCreditNote, GcomPdfPriceMode, GcomReturnCondition } from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const STATUS_META: Record<GcomInvoiceStatus, { label: string; dot: string; text: string }> = {
    // "Non réglée" not "En attente" — the invoice is officially issued and
    // validated, not a draft or pending approval; it's just unpaid, standard
    // ERP terminology (Sage/Odoo).
    pending: { label: 'Non réglée', dot: 'bg-amber-500', text: 'text-amber-700' },
    partially_paid: { label: 'Partiel', dot: 'bg-blue-500', text: 'text-blue-700' },
    fully_paid: { label: 'Payée', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    overdue: { label: 'En retard', dot: 'bg-red-500', text: 'text-red-700' },
};

const STATUS_FILTERS: { value: 'all' | GcomInvoiceStatus; label: string }[] = [
    { value: 'all', label: 'Toutes' },
    { value: 'pending', label: 'Non réglées' },
    { value: 'partially_paid', label: 'Partiel' },
    { value: 'fully_paid', label: 'Payées' },
    { value: 'overdue', label: 'En retard' },
];

const CREDIT_NOTE_STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
    APPROVED: { label: 'Approuvé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    DRAFT: { label: 'Brouillon', dot: 'bg-gray-400', text: 'text-gray-500' },
    PENDING: { label: 'En attente', dot: 'bg-amber-500', text: 'text-amber-700' },
    REJECTED: { label: 'Rejeté', dot: 'bg-red-500', text: 'text-red-700' },
    CANCELLED: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-500' },
};

const TABS: TabItem[] = [
    { id: 'informations', label: 'Informations', icon: Info },
    { id: 'lignes', label: 'Lignes', icon: Package },
    { id: 'reglement', label: 'Règlement', icon: Banknote },
    { id: 'avoirs', label: 'Avoirs', icon: RotateCcw },
];

const PAYMENT_STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
    validated: { label: 'Validé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    reconciled: { label: 'Rapproché', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    registered: { label: 'Enregistré', dot: 'bg-amber-500', text: 'text-amber-700' },
};

const INSTRUMENT_STATUS_META: Record<string, { label: string; dot: string; text: string }> = {
    PENDING: { label: 'En portefeuille', dot: 'bg-amber-500', text: 'text-amber-700' },
    DEPOSITED: { label: 'Déposé', dot: 'bg-blue-500', text: 'text-blue-700' },
    CLEARED: { label: 'Encaissé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    REJECTED: { label: 'Rejeté', dot: 'bg-red-500', text: 'text-red-700' },
};

const PAGE_SIZE = 30;

const StatusBadge = ({ status }: { status: GcomInvoiceStatus }) => {
    const meta = STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function FacturesPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ── Filters ───────────────────────────────────────────────────────────────
    const [statusFilter, setStatusFilter] = useState<'all' | GcomInvoiceStatus>('all');
    const [partnerFilter, setPartnerFilter] = useState<Partner | null>(null);
    const [partnerSearch, setPartnerSearch] = useState('');
    const [partnerResults, setPartnerResults] = useState<Partner[]>([]);
    const [searchingPartner, setSearchingPartner] = useState(false);
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');
    const partnerDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    const runPartnerSearch = useCallback(async (q: string) => {
        if (q.trim().length < 2) { setPartnerResults([]); return; }
        setSearchingPartner(true);
        try {
            const res = await getPartners({ search: q.trim(), per_page: 15 });
            setPartnerResults(res.partners.data ?? []);
        } catch {
            setPartnerResults([]);
        } finally {
            setSearchingPartner(false);
        }
    }, []);

    useEffect(() => {
        if (partnerDebounce.current) clearTimeout(partnerDebounce.current);
        if (partnerFilter) { setPartnerResults([]); return; }
        partnerDebounce.current = setTimeout(() => runPartnerSearch(partnerSearch), 300);
        return () => { if (partnerDebounce.current) clearTimeout(partnerDebounce.current); };
    }, [partnerSearch, partnerFilter, runPartnerSearch]);

    // ── List ──────────────────────────────────────────────────────────────────
    const [invoices, setInvoices] = useState<GcomInvoice[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const loadInvoices = useCallback(async (pageNum: number, append: boolean) => {
        setLoading(true);
        try {
            const res = await gcomApi.invoices.list({
                partner_id: partnerFilter?.id,
                status: statusFilter === 'all' ? undefined : statusFilter,
                from: dateFrom || undefined,
                to: dateTo || undefined,
                per_page: PAGE_SIZE,
                page: pageNum,
            });
            setInvoices(prev => append ? [...prev, ...res.data] : res.data);
            setPage(res.current_page);
            setLastPage(res.last_page);
            setTotal(res.total);
        } catch {
            toast.error('Erreur chargement des factures');
        } finally {
            setLoading(false);
        }
    }, [partnerFilter, statusFilter, dateFrom, dateTo]);

    useEffect(() => { loadInvoices(1, false); }, [loadInvoices]);

    const loadMore = () => { if (page < lastPage) loadInvoices(page + 1, true); };

    // ── Selection / detail ───────────────────────────────────────────────────
    const [selected, setSelected] = useState<GcomInvoice | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [creditNotes, setCreditNotes] = useState<GcomCreditNote[]>([]);
    const [creditNotesLoading, setCreditNotesLoading] = useState(false);

    // Scroll-spy state (same pattern as ClientGroupsPage/PartnerManagementPage)
    const [activeTab, setActiveTab] = useState('informations');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ informations: true, lignes: true, reglement: true, avoirs: true });
    const sectionRefs = useRef<Record<string, HTMLDivElement | null>>({});
    const containerRef = useRef<HTMLDivElement>(null);
    const isScrollingRef = useRef(false);

    const handleTabChange = (tabId: string) => {
        setActiveTab(tabId);
        const section = sectionRefs.current[tabId];
        if (section && containerRef.current) {
            isScrollingRef.current = true;
            section.scrollIntoView({ behavior: 'smooth', block: 'start' });
            setTimeout(() => { isScrollingRef.current = false; }, 1000);
        }
    };
    const toggleSection = (id: string, open: boolean) => setOpenSections(prev => ({ ...prev, [id]: open }));
    const handleExpandAll = () => setOpenSections({ informations: true, lignes: true, reglement: true, avoirs: true });
    const handleCollapseAll = () => setOpenSections({ informations: false, lignes: false, reglement: false, avoirs: false });

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        const onScroll = () => {
            if (isScrollingRef.current) return;
            const top = container.scrollTop;
            for (const tab of TABS) {
                const el = sectionRefs.current[tab.id];
                if (!el) continue;
                const elTop = el.offsetTop;
                const elBottom = elTop + el.clientHeight;
                if (elTop <= top + 100 && elBottom > top + 50) {
                    if (activeTab !== tab.id) setActiveTab(tab.id);
                    break;
                }
            }
        };
        container.addEventListener('scroll', onScroll);
        return () => container.removeEventListener('scroll', onScroll);
    }, [openSections, activeTab]);

    const selectInvoice = useCallback(async (row: GcomInvoice) => {
        setSelected(row);
        setActiveTab('informations');
        setDetailLoading(true);
        setCreditNotes([]);
        try {
            setSelected(await gcomApi.invoices.get(row.id));
        } catch {
            toast.error('Erreur chargement de la facture');
        } finally {
            setDetailLoading(false);
        }
        setCreditNotesLoading(true);
        try {
            setCreditNotes(await gcomApi.invoices.creditNotes(row.id));
        } catch {
            setCreditNotes([]);
        } finally {
            setCreditNotesLoading(false);
        }
    }, []);

    const refresh = () => {
        loadInvoices(1, false);
        if (selected) selectInvoice(selected);
    };

    // Deep-link from another GCOM document's "Documents liés"/"Origine" chip (?id=123).
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) selectInvoice({ id } as GcomInvoice);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Avoir (credit note) creation ─────────────────────────────────────────
    // POST /invoices/{invoice}/credit-notes — omitting `amount` cancels the
    // invoice for its full amount; checking items triggers restock for those lines.
    const [avoirModalOpen, setAvoirModalOpen] = useState(false);
    const [avoirAmount, setAvoirAmount] = useState('');
    const [avoirReason, setAvoirReason] = useState('');
    const [avoirItemSelected, setAvoirItemSelected] = useState<Record<number, boolean>>({});
    const [avoirItemQty, setAvoirItemQty] = useState<Record<number, number>>({});
    const [avoirItemCondition, setAvoirItemCondition] = useState<Record<number, GcomReturnCondition>>({});
    const [creatingAvoir, setCreatingAvoir] = useState(false);

    const openAvoirModal = () => {
        setAvoirAmount('');
        setAvoirReason('');
        setAvoirItemSelected({});
        setAvoirItemQty({});
        setAvoirItemCondition({});
        setAvoirModalOpen(true);
    };
    const closeAvoirModal = () => setAvoirModalOpen(false);

    const toggleAvoirItem = (item: GcomInvoiceItem) => {
        setAvoirItemSelected(prev => ({ ...prev, [item.id]: !prev[item.id] }));
        setAvoirItemQty(prev => prev[item.id] ? prev : { ...prev, [item.id]: Number(item.quantity) || 1 });
        setAvoirItemCondition(prev => prev[item.id] ? prev : { ...prev, [item.id]: 'sellable' });
    };
    const setAvoirItemQuantity = (itemId: number, quantity: number) => {
        setAvoirItemQty(prev => ({ ...prev, [itemId]: Math.max(1, quantity) }));
    };

    const confirmCreateAvoir = async () => {
        if (!selected || !avoirReason.trim()) { toast.error('Motif requis'); return; }
        const selectedItems = (selected.items ?? []).filter(it => avoirItemSelected[it.id]);
        setCreatingAvoir(true);
        try {
            await gcomApi.invoices.createCreditNote(selected.id, {
                amount: avoirAmount.trim() ? parseFloat(avoirAmount) : undefined,
                reason: avoirReason.trim(),
                items: selectedItems.length > 0
                    ? selectedItems.map(it => ({
                        product_id: it.product_id,
                        quantity: avoirItemQty[it.id] ?? (Number(it.quantity) || 1),
                        condition: avoirItemCondition[it.id] ?? 'sellable',
                    }))
                    : undefined,
            });
            toast.success('Avoir créé');
            setAvoirModalOpen(false);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de la création de l'avoir");
        } finally {
            setCreatingAvoir(false);
        }
    };

    // Bon d'avoir — one PDF per credit note (2026-08-18).
    const [avoirPdfLoadingId, setAvoirPdfLoadingId] = useState<number | null>(null);
    const openAvoirPdf = async (creditNoteId: number) => {
        if (!selected) return;
        setAvoirPdfLoadingId(creditNoteId);
        try {
            const url = await gcomApi.invoices.getCreditNotePdfBlobUrl(selected.id, creditNoteId);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error("Impossible de charger le PDF de l'avoir");
        } finally {
            setAvoirPdfLoadingId(null);
        }
    };

    // ── PDF ───────────────────────────────────────────────────────────────────
    // Same HT/TTC print modal as BC/Devis/BL — price_mode genuinely works here
    // now (fixed 2026-08-17: the invoice pdf runs through the same
    // DocumentService pipeline as the other 3 documents), defaults to TTC.
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const openPdf = async (priceMode: GcomPdfPriceMode) => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.invoices.getPdfBlobUrl(selected.id, priceMode);
            if (url) window.open(url, '_blank');
            setPdfModalOpen(false);
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    // ── DataGrid columns ──────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'invoice_number', headerName: 'N° Facture', width: 130,
            valueGetter: (p: ValueGetterParams<GcomInvoice>) => p.data?.invoice_number ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomInvoice, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomInvoice, string>) => (
                <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.value ?? '—'}</span>
            ),
        },
        {
            field: 'status', headerName: 'Statut', width: 110,
            filter: 'agSetColumnFilter',
            filterParams: {
                valueFormatter: (p: { value: GcomInvoiceStatus }) => STATUS_META[p.value]?.label ?? p.value,
            },
            cellRenderer: (p: ICellRendererParams<GcomInvoice>) => p.data ? <StatusBadge status={p.data.status} /> : null,
        },
        {
            colId: 'total_amount', headerName: 'Total TTC', width: 100,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomInvoice>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomInvoice, number>) => (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>
            ),
        },
        {
            colId: 'remaining_amount', headerName: 'Restant', width: 90,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomInvoice>) => Number(p.data?.remaining_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomInvoice, number>) => {
                const v = p.value ?? 0;
                return <span style={{ fontSize: '11px', fontWeight: 600, color: v > 0 ? '#d97706' : '#9ca3af' }}>{fmtMAD(v)}</span>;
            },
        },
        {
            field: 'invoice_date', headerName: 'Date', width: 100,
            filter: 'agDateColumnFilter',
            filterParams: {
                comparator: (filterDate: Date, cellValue: string) => {
                    if (!cellValue) return -1;
                    const cellDate = new Date(cellValue);
                    cellDate.setHours(0, 0, 0, 0);
                    return cellDate < filterDate ? -1 : cellDate > filterDate ? 1 : 0;
                },
            },
            cellRenderer: (p: ICellRendererParams<GcomInvoice, string>) => (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>
            ),
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const groups: { items: ActionItemProps[] }[] = [{
            items: [
                { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: refresh, disabled: loading },
                { icon: Download, label: 'Imprimer', variant: 'primary', onClick: () => setPdfModalOpen(true), disabled: !selected || pdfLoading },
            ],
        }];
        if (selected) {
            groups.push({ items: [
                { icon: RotateCcw, label: 'Émettre un avoir', variant: 'warning', onClick: openAvoirModal },
            ] });
        }
        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [loading, selected, pdfLoading]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-2.5">
                        <div className="flex items-center gap-2">
                            <FileText className="w-4 h-4 text-sage-600" />
                            <h2 className="text-sm font-bold text-gray-900">Factures</h2>
                            <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{total}</span>
                        </div>

                        {/* Status filter chips */}
                        <div className="flex flex-wrap gap-1">
                            {STATUS_FILTERS.map(f => (
                                <button
                                    key={f.value}
                                    onClick={() => setStatusFilter(f.value)}
                                    className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                                        statusFilter === f.value
                                            ? 'bg-sage-600 border-sage-600 text-white'
                                            : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                    }`}
                                >
                                    {f.label}
                                </button>
                            ))}
                        </div>

                        {/* Partner filter */}
                        {partnerFilter ? (
                            <div className="flex items-center justify-between bg-sage-50 border border-sage-100 rounded-lg px-2.5 py-1.5">
                                <div className="min-w-0 flex items-center gap-1.5">
                                    <Building2 className="w-3 h-3 text-sage-500 shrink-0" />
                                    <span className="text-[11px] font-semibold text-gray-800 truncate">{partnerFilter.name}</span>
                                </div>
                                <button onClick={() => setPartnerFilter(null)} className="shrink-0 ml-2"><X className="w-3 h-3 text-gray-400" /></button>
                            </div>
                        ) : (
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    value={partnerSearch}
                                    onChange={e => setPartnerSearch(e.target.value)}
                                    placeholder="Filtrer par client…"
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                                />
                                {partnerSearch && (
                                    <button onClick={() => setPartnerSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                                {partnerSearch.trim().length >= 2 && (
                                    <div className="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden">
                                        {searchingPartner ? (
                                            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                        ) : partnerResults.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>
                                        ) : (
                                            <div className="max-h-48 overflow-y-auto divide-y divide-gray-50">
                                                {partnerResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => { setPartnerFilter(p); setPartnerSearch(''); setPartnerResults([]); }}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors"
                                                    >
                                                        <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                                                        <p className="text-[10px] text-gray-400">{p.code}</p>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Date range */}
                        <div className="grid grid-cols-2 gap-1.5">
                            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="px-2 py-1.5 text-[11px] border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                        </div>
                    </div>

                    <div className="flex-1 min-h-0">
                        <DataGrid
                            rowData={invoices}
                            columnDefs={columnDefs}
                            loading={loading}
                            rowActionLoading={detailLoading}
                            rowSelection="single"
                            onRowClicked={e => { if (e.data) { selectInvoice(e.data); navigate(`/gcom/factures?id=${e.data.id}`, { replace: true }); } }}
                            defaultSelectedIds={row => row.id === selected?.id}
                        />
                    </div>

                    {page < lastPage && (
                        <div className="shrink-0 border-t border-gray-100 p-2">
                            <button
                                onClick={loadMore}
                                disabled={loading}
                                className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 disabled:opacity-50 transition-colors"
                            >
                                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Charger plus ({invoices.length}/{total})
                            </button>
                        </div>
                    )}
                </div>
            }

            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <FileText className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Consultation des factures</p>
                            <p className="text-xs max-w-xs">Sélectionnez une facture dans la liste pour consulter ses lignes, son origine et ses éventuels avoirs.</p>
                        </div>
                    ) : (
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                            {/* header */}
                            <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">
                                                {selected.invoice_number ?? `#${selected.id}`}
                                            </span>
                                            <StatusBadge status={selected.status} />
                                            {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                                        </div>
                                        <h2 className="text-lg font-bold text-gray-900">{selected.partner?.name ?? '—'}</h2>
                                        <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selected.invoice_date)} · Total {fmtMAD(selected.total_amount)}</p>
                                    </div>
                                </div>

                                <SageTabs
                                    tabs={TABS}
                                    activeTabId={activeTab}
                                    onTabChange={handleTabChange}
                                    onExpandAll={handleExpandAll}
                                    onCollapseAll={handleCollapseAll}
                                    className="shadow-none"
                                />
                            </div>

                            {/* Scrollable content */}
                            <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                {/* ── Informations ─────────────────────── */}
                                <div ref={el => { sectionRefs.current['informations'] = el; }}>
                                    <SageCollapsible title="Informations" isOpen={openSections['informations']} onOpenChange={open => toggleSection('informations', open)}>
                                        <div className="space-y-3">
                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Sous-total HT</p>
                                                    <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.subtotal)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">TVA</p>
                                                    <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.tax_amount)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Timbre</p>
                                                    <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.order?.financial_metadata?.stamp_duty)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total TTC</p>
                                                    <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.total_amount)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Payé</p>
                                                    <p className="text-sm font-bold text-emerald-600">{fmtMAD(selected.paid_amount)}</p>
                                                </div>
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Restant dû</p>
                                                    <p className={`text-sm font-bold ${Number(selected.remaining_amount) > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
                                                        {fmtMAD(selected.remaining_amount)}
                                                    </p>
                                                </div>
                                            </div>

                                            <div className="flex gap-6 px-1">
                                                <div className="flex items-center gap-1.5">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                    <div>
                                                        <p className="text-[10px] text-gray-400">Date facture</p>
                                                        <p className="text-xs font-medium text-gray-700">{fmtDate(selected.invoice_date)}</p>
                                                    </div>
                                                </div>
                                                {selected.due_date && (
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                        <div>
                                                            <p className="text-[10px] text-gray-400">Échéance</p>
                                                            <p className="text-xs font-medium text-gray-700">{fmtDate(selected.due_date)}</p>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Origine */}
                                            {selected.order && (
                                                <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Origine</p>
                                                    <div className="flex flex-wrap items-center gap-2">
                                                        <button
                                                            onClick={() => navigate(`/gcom/bons-commande?id=${selected.order!.id}`)}
                                                            className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                        >
                                                            <ReceiptText className="w-3 h-3 text-gray-400" /> {selected.order.order_code ?? `BC #${selected.order.id}`}
                                                            {selected.order.bc_status && <span className="text-[10px] text-gray-400">({selected.order.bc_status})</span>}
                                                        </button>
                                                        {selected.order.delivery_notes?.map(bl => (
                                                            <button
                                                                key={bl.id}
                                                                onClick={() => navigate(`/gcom/bons-livraison?id=${bl.id}`)}
                                                                className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                            >
                                                                <Truck className="w-3 h-3 text-gray-400" /> BL #{bl.id}
                                                                {bl.status && <span className="text-[10px] text-gray-400">({bl.status})</span>}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </SageCollapsible>
                                </div>

                                {/* ── Lignes ──────────────────────────────── */}
                                <div ref={el => { sectionRefs.current['lignes'] = el; }}>
                                    <SageCollapsible
                                        title="Lignes"
                                        isOpen={openSections['lignes']}
                                        onOpenChange={open => toggleSection('lignes', open)}
                                        rightContent={!detailLoading && <span className="text-[10px] text-gray-400 mr-2">{selected.items?.length ?? 0} article(s)</span>}
                                    >
                                        <GcomLinesTable
                                            rows={selected.items ?? []}
                                            rowKey={it => it.id}
                                            emptyIcon={Package}
                                            columns={[
                                                { key: 'article', header: 'Article', render: it => <span className="font-medium text-gray-800">{it.product_name ?? `Produit #${it.product_id}`}</span> },
                                                { key: 'qty', header: 'Qté', align: 'right', width: 'w-16', render: it => <span className="text-gray-600">{it.quantity}</span> },
                                                { key: 'pu', header: 'P.U.', align: 'right', width: 'w-24', render: it => <span className="text-gray-600">{fmtMAD(it.unit_price)}</span> },
                                                { key: 'total', header: 'Total', align: 'right', width: 'w-24', render: it => <span className="font-bold text-gray-900">{fmtMAD(it.line_total)}</span> },
                                            ]}
                                        />
                                    </SageCollapsible>
                                </div>

                                {/* ── Règlement ───────────────────────────── */}
                                <div ref={el => { sectionRefs.current['reglement'] = el; }}>
                                    <SageCollapsible
                                        title="Règlement"
                                        isOpen={openSections['reglement']}
                                        onOpenChange={open => toggleSection('reglement', open)}
                                        rightContent={<span className="text-[10px] text-gray-400 mr-2">{selected.payments?.length ?? 0}</span>}
                                    >
                                        {selected.financial_instrument && (() => {
                                            const fi = selected.financial_instrument;
                                            const meta = INSTRUMENT_STATUS_META[fi.status] ?? { label: fi.status, dot: 'bg-gray-400', text: 'text-gray-500' };
                                            return (
                                                <div className="mb-3 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5">
                                                    <div className="flex items-center justify-between mb-1">
                                                        <span className="flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                                                            <Landmark className="w-3.5 h-3.5 text-gray-400" />
                                                            {fi.instrument_type} {fi.reference_number}
                                                        </span>
                                                        <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.text}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} /> {meta.label}
                                                        </span>
                                                    </div>
                                                    <div className="flex items-center justify-between text-[11px] text-gray-500">
                                                        <span>{fi.bank_name ?? '—'} · échéance {fmtDate(fi.due_date)}</span>
                                                        <span className="font-bold text-gray-900">{fmtMAD(fi.amount)}</span>
                                                    </div>
                                                </div>
                                            );
                                        })()}

                                        {!selected.payments || selected.payments.length === 0 ? (
                                            <div className="text-center py-8 text-xs text-gray-400">
                                                <Banknote className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                                {selected.status === 'pending'
                                                    ? 'Facture pas encore réglée'
                                                    : 'Aucune ligne de règlement enregistrée pour cette facture'}
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                                {selected.payments.map(p => {
                                                    const meta = PAYMENT_STATUS_META[p.status] ?? { label: p.status, dot: 'bg-gray-400', text: 'text-gray-500' };
                                                    return (
                                                        <div key={p.payment_transfer_id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-mono font-semibold text-indigo-600">{p.code}</span>
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.text}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                                        {meta.label}
                                                                    </span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                                                                    <CreditCard className="w-3 h-3" /> {p.payment_method} · {fmtDate(p.payment_date)}
                                                                    {p.reference && ` · ${p.reference}`}
                                                                    {p.bank && ` · ${p.bank}`}
                                                                </p>
                                                            </div>
                                                            <div className="text-right shrink-0 ml-3">
                                                                <p className="text-xs font-bold text-gray-900">{fmtMAD(p.amount_applied)}</p>
                                                                {Number(p.payment_total_amount) !== Number(p.amount_applied) && (
                                                                    <p className="text-[10px] text-gray-400">sur {fmtMAD(p.payment_total_amount)}</p>
                                                                )}
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                {/* ── Avoirs ──────────────────────────────── */}
                                <div ref={el => { sectionRefs.current['avoirs'] = el; }}>
                                    <SageCollapsible
                                        title="Avoirs"
                                        isOpen={openSections['avoirs']}
                                        onOpenChange={open => toggleSection('avoirs', open)}
                                        rightContent={!creditNotesLoading && (
                                            <div className="flex items-center gap-2 mr-2">
                                                <span className="text-[10px] text-gray-400">{creditNotes.length}</span>
                                                <button
                                                    onClick={e => { e.stopPropagation(); openAvoirModal(); }}
                                                    className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                                                >
                                                    <RotateCcw className="w-3 h-3" /> Émettre un avoir
                                                </button>
                                            </div>
                                        )}
                                    >
                                        {creditNotesLoading ? (
                                            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                        ) : creditNotes.length === 0 ? (
                                            <div className="text-center py-8 text-xs text-gray-400">
                                                <RotateCcw className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                                <p className="mb-3">Aucun avoir émis pour cette facture</p>
                                                <button
                                                    onClick={openAvoirModal}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-amber-600 rounded-lg hover:bg-amber-700 transition-colors"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" /> Émettre un avoir
                                                </button>
                                            </div>
                                        ) : (
                                            <div className="divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                                {creditNotes.map(cn => {
                                                    const meta = CREDIT_NOTE_STATUS_META[cn.status] ?? { label: cn.status, dot: 'bg-gray-400', text: 'text-gray-500' };
                                                    return (
                                                        <div key={cn.id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-gray-900">{cn.credit_note_number ?? `Avoir #${cn.id}`}</span>
                                                                    <span className={`inline-flex items-center gap-1 text-[10px] font-medium ${meta.text}`}>
                                                                        <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
                                                                        {meta.label}
                                                                    </span>
                                                                </div>
                                                                {cn.reason && <p className="text-[10px] text-gray-400 truncate mt-0.5">{cn.reason}</p>}
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                                                <div className="text-right">
                                                                    <p className="text-xs font-bold text-gray-900">{fmtMAD(cn.total_amount)}</p>
                                                                    {Number(cn.refund_amount) > 0 && (
                                                                        <p className="text-[10px] text-amber-600">dont {fmtMAD(cn.refund_amount)} à rembourser</p>
                                                                    )}
                                                                </div>
                                                                <button
                                                                    onClick={() => openAvoirPdf(cn.id)}
                                                                    disabled={avoirPdfLoadingId === cn.id}
                                                                    title="Avoir PDF"
                                                                    className="text-gray-400 hover:text-sage-600 disabled:opacity-50"
                                                                >
                                                                    {avoirPdfLoadingId === cn.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </SageCollapsible>
                                </div>

                                <div className="h-8" />
                            </div>
                        </div>
                    )}
                </div>
            }

            rightContent={<ActionPanel groups={actionGroups} />}
        />

        {/* ── Create avoir modal ──────────────────────────────────────────── */}
        {avoirModalOpen && selected && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <h3 className="text-base font-semibold text-gray-900">Émettre un avoir</h3>
                            <p className="text-[11px] text-gray-400">{selected.invoice_number ?? `#${selected.id}`} — {selected.partner?.name} — {fmtMAD(selected.total_amount)}</p>
                        </div>
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Montant (vide = avoir du montant total, annule la facture)</label>
                        <input
                            type="number" min={0} step={0.01}
                            value={avoirAmount}
                            onChange={e => setAvoirAmount(e.target.value)}
                            placeholder={fmtMAD(selected.total_amount)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                        />
                    </div>

                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                        <textarea
                            value={avoirReason}
                            onChange={e => setAvoirReason(e.target.value)}
                            rows={2}
                            maxLength={500}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                            placeholder="Marchandise retournée, erreur de facturation…"
                        />
                    </div>

                    {(selected.items?.length ?? 0) > 0 && (
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1.5">Articles à restocker (optionnel)</label>
                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-100 rounded-lg border border-gray-100">
                                {selected.items!.map(it => (
                                    <div key={it.id} className="px-3 py-2 bg-white space-y-1.5">
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="checkbox"
                                                checked={!!avoirItemSelected[it.id]}
                                                onChange={() => toggleAvoirItem(it)}
                                                className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                            />
                                            <span className="flex-1 text-xs text-gray-700 truncate">{it.product_name ?? `Produit #${it.product_id}`}</span>
                                            <input
                                                type="number" min={1} max={Number(it.quantity) || undefined}
                                                value={avoirItemQty[it.id] ?? (Number(it.quantity) || 1)}
                                                onChange={e => setAvoirItemQuantity(it.id, parseInt(e.target.value, 10) || 1)}
                                                onFocus={() => { if (!avoirItemSelected[it.id]) toggleAvoirItem(it); }}
                                                className="w-16 text-center px-1 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            />
                                        </div>
                                        {avoirItemSelected[it.id] && (
                                            <div className="flex items-center gap-1.5 pl-6">
                                                {RETURN_CONDITIONS.map(opt => (
                                                    <button
                                                        key={opt.value}
                                                        onClick={() => setAvoirItemCondition(prev => ({ ...prev, [it.id]: opt.value }))}
                                                        title={opt.hint}
                                                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md border transition-colors ${
                                                            (avoirItemCondition[it.id] ?? 'sellable') === opt.value
                                                                ? 'bg-sage-600 border-sage-600 text-white'
                                                                : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {opt.label}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div className="flex gap-3">
                        <button
                            onClick={confirmCreateAvoir}
                            disabled={creatingAvoir || !avoirReason.trim()}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                        >
                            {creatingAvoir ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Confirmer
                        </button>
                        <button onClick={closeAvoirModal} disabled={creatingAvoir} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        )}

        <PdfPriceModeModal
            isOpen={pdfModalOpen}
            onClose={() => setPdfModalOpen(false)}
            onConfirm={openPdf}
            defaultMode="ttc"
            documentLabel="facture"
            loading={pdfLoading}
        />
        </>
    );
}
