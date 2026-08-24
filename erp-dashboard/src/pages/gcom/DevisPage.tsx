import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    FileSignature, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Info, Package, FileText, ClipboardList, Calendar, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { GcomCatalogEntryScreen, type GcomCatalogEntrySubmitPayload } from '@/components/gcom/GcomCatalogEntryScreen';
import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { PdfPriceModeModal } from '@/components/gcom/PdfPriceModeModal';

import { gcomApi } from '@/services/api/gcomApi';
import { useQuotes, useQuote, useCreateQuote, useConvertQuoteToOrder, useConvertQuoteToInvoice } from '@/hooks/gcom/useGcomQuotes';
import { getPaymentTerms } from '@/services/api/partnerApi';
import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import type { PaymentTermOption } from '@/types/partner.types';
import type {
    GcomPaymentMethod, GcomQuote, GcomQuoteStatus, GcomInstrumentInput, GcomPdfPriceMode,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const QUOTE_STATUS_META: Record<GcomQuoteStatus, { label: string; dot: string; text: string }> = {
    draft: { label: 'Brouillon', dot: 'bg-gray-400', text: 'text-gray-500' },
    sent: { label: 'Envoyé', dot: 'bg-blue-500', text: 'text-blue-700' },
    accepted: { label: 'Accepté', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    expired: { label: 'Expiré', dot: 'bg-red-400', text: 'text-red-600' },
    converted: { label: 'Converti', dot: 'bg-sage-500', text: 'text-sage-700' },
};

const QUOTE_STATUS_FILTERS: { value: 'all' | GcomQuoteStatus; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'draft', label: 'Brouillon' },
    { value: 'sent', label: 'Envoyé' },
    { value: 'accepted', label: 'Accepté' },
    { value: 'expired', label: 'Expiré' },
    { value: 'converted', label: 'Converti' },
];

const StatusBadge = ({ status }: { status: GcomQuoteStatus }) => {
    const meta = QUOTE_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return (
        <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${meta.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${meta.dot}`} />
            {meta.label}
        </span>
    );
};

const TABS: TabItem[] = [
    { id: 'informations', label: 'Informations', icon: Info },
    { id: 'lignes', label: 'Lignes', icon: Package },
];

const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };

// ─── Component ───────────────────────────────────────────────────────────────

export default function DevisPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ── List filters ─────────────────────────────────────────────────────────
    // GET /quotes only takes `status`/`per_page` — no partner_id filter (own-quotes-only endpoint).
    const [statusFilter, setStatusFilter] = useState<'all' | GcomQuoteStatus>('all');

    // ── List ──────────────────────────────────────────────────────────────────
    const quotesQuery = useQuotes({ status: statusFilter === 'all' ? undefined : statusFilter });
    const quotes = useMemo(() => quotesQuery.data?.pages.flatMap(p => p.data) ?? [], [quotesQuery.data]);
    const loading = quotesQuery.isLoading || quotesQuery.isFetchingNextPage;
    const total = quotesQuery.data?.pages[0]?.total ?? 0;
    const loadMore = () => quotesQuery.fetchNextPage();

    // ── Selection / detail ───────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'create'>('view');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const quoteDetailQuery = useQuote(selectedId);
    const selected = quoteDetailQuery.data ?? null;
    const detailLoading = quoteDetailQuery.isLoading;

    const [activeTab, setActiveTab] = useState('informations');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ informations: true, lignes: true });
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
    const handleExpandAll = () => setOpenSections({ informations: true, lignes: true });
    const handleCollapseAll = () => setOpenSections({ informations: false, lignes: false });

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

    const selectQuote = useCallback((row: { id: number }) => {
        setFormMode('view');
        setActiveTab('informations');
        setSelectedId(row.id);
    }, []);

    const handleManualRefresh = () => {
        quotesQuery.refetch();
        quoteDetailQuery.refetch();
    };

    // Deep-link from another GCOM document's "Documents liés" chip (?id=123).
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) selectQuote({ id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── PDF (defaults HT if `priceMode` omitted — this document's convention) ──
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const openPdf = async (priceMode: GcomPdfPriceMode) => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.quotes.getPdfBlobUrl(selected.id, priceMode);
            if (url) window.open(url, '_blank');
            setPdfModalOpen(false);
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    const openCreate = () => setFormMode('create');

    const createQuote = useCreateQuote();

    const handleCreateQuoteSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomQuote> => {
        try {
            const quote = await createQuote.mutateAsync({
                partner_id: payload.partner_id,
                items: payload.items,
                notes: payload.notes,
                expires_at: payload.expires_at,
            });
            toast.success('Devis créé');
            return quote;
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg ?? 'Erreur lors de la création du devis');
        }
    };

    const handleQuoteCreated = (quote: GcomQuote) => {
        setFormMode('view');
        selectQuote(quote);
    };

    // ── Convertible-status guard (shared by both convert actions) ───────────────
    const isConvertible = selected?.status !== 'converted' && selected?.status !== 'expired';

    // ── Convert to Order (BC) — flow #1, first hop ───────────────────────────────
    const [convertOrderModalOpen, setConvertOrderModalOpen] = useState(false);
    const [convertOrderMethod, setConvertOrderMethod] = useState<GcomPaymentMethod>('cash');
    const [convertOrderTermId, setConvertOrderTermId] = useState<number | null>(null);
    const [convertOrderTerms, setConvertOrderTerms] = useState<PaymentTermOption[]>([]);
    const [convertingToOrder, setConvertingToOrder] = useState(false);

    const openConvertToOrder = () => {
        if (!selected?.partner) return;
        setConvertOrderMethod('cash');
        setConvertOrderTermId(null);
        setConvertOrderTerms([]);
        setConvertOrderModalOpen(true);
        getPaymentTerms(selected.partner.id)
            .then(res => {
                const terms = res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? [];
                setConvertOrderTerms(terms.filter(t => t.is_credit && !t.is_cash));
            })
            .catch(() => setConvertOrderTerms([]));
    };
    const closeConvertOrderModal = () => setConvertOrderModalOpen(false);
    const convertQuoteToOrder = useConvertQuoteToOrder();

    const confirmConvertToOrder = async () => {
        if (!selected) return;
        const methodDef = PAYMENT_METHODS.find(m => m.value === convertOrderMethod)!;
        if (methodDef.needsTerm && convertOrderTermId == null) { toast.error('Terme de paiement requis'); return; }
        setConvertingToOrder(true);
        try {
            await convertQuoteToOrder.mutateAsync({
                id: selected.id,
                payload: {
                    payment_method: convertOrderMethod,
                    payment_term_id: methodDef.needsTerm ? convertOrderTermId : null,
                },
            });
            toast.success('Devis converti en bon de commande');
            setConvertOrderModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en BC');
        } finally {
            setConvertingToOrder(false);
        }
    };

    // ── Convert to Direct Invoice — flow #2 ──────────────────────────────────────
    const [convertInvoiceModalOpen, setConvertInvoiceModalOpen] = useState(false);
    const [convertInvoiceMethod, setConvertInvoiceMethod] = useState<GcomPaymentMethod>('cash');
    const [convertInvoiceTermId, setConvertInvoiceTermId] = useState<number | null>(null);
    const [convertInvoiceTerms, setConvertInvoiceTerms] = useState<PaymentTermOption[]>([]);
    const [convertInvoiceInstrument, setConvertInvoiceInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [convertingToInvoice, setConvertingToInvoice] = useState(false);

    const openConvertToInvoice = () => {
        if (!selected?.partner) return;
        setConvertInvoiceMethod('cash');
        setConvertInvoiceTermId(null);
        setConvertInvoiceTerms([]);
        setConvertInvoiceInstrument(EMPTY_INSTRUMENT);
        setConvertInvoiceModalOpen(true);
        getPaymentTerms(selected.partner.id)
            .then(res => {
                const terms = res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? [];
                setConvertInvoiceTerms(terms.filter(t => t.is_credit && !t.is_cash));
            })
            .catch(() => setConvertInvoiceTerms([]));
    };
    const closeConvertInvoiceModal = () => setConvertInvoiceModalOpen(false);

    const invoiceMethodDef = PAYMENT_METHODS.find(m => m.value === convertInvoiceMethod)!;
    const convertQuoteToInvoice = useConvertQuoteToInvoice();

    const confirmConvertToInvoice = async () => {
        if (!selected) return;
        if (invoiceMethodDef.needsTerm && convertInvoiceTermId == null) { toast.error('Terme de paiement requis'); return; }
        if (invoiceMethodDef.needsInstrument && (!convertInvoiceInstrument.reference_number.trim() || !convertInvoiceInstrument.due_date)) {
            toast.error('Référence et échéance requises pour ce mode de paiement');
            return;
        }
        setConvertingToInvoice(true);
        try {
            const res = await convertQuoteToInvoice.mutateAsync({
                id: selected.id,
                payload: {
                    payment_method: convertInvoiceMethod,
                    payment_term_id: invoiceMethodDef.needsTerm ? convertInvoiceTermId : null,
                    instrument: invoiceMethodDef.needsInstrument ? convertInvoiceInstrument : null,
                },
            });
            toast.success(`Facture ${res.invoice.invoice_number ?? `#${res.invoice.id}`} créée`);
            setConvertInvoiceModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en facture');
        } finally {
            setConvertingToInvoice(false);
        }
    };

    // ── DataGrid columns ──────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'quote_number', headerName: 'Devis', width: 130,
            valueGetter: (p: ValueGetterParams<GcomQuote>) => p.data?.quote_number ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomQuote, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomQuote, string>) => <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.value ?? '—'}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 110,
            filter: 'agSetColumnFilter',
            filterParams: { valueFormatter: (p: { value: GcomQuoteStatus }) => QUOTE_STATUS_META[p.value]?.label ?? p.value },
            cellRenderer: (p: ICellRendererParams<GcomQuote>) => p.data ? <StatusBadge status={p.data.status} /> : null,
        },
        {
            colId: 'total_amount', headerName: 'Total TTC', width: 100,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomQuote>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomQuote, number>) => (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>
            ),
        },
        {
            field: 'created_at', headerName: 'Date', width: 100,
            filter: 'agDateColumnFilter',
            filterParams: {
                comparator: (filterDate: Date, cellValue: string) => {
                    if (!cellValue) return -1;
                    const cellDate = new Date(cellValue);
                    cellDate.setHours(0, 0, 0, 0);
                    return cellDate < filterDate ? -1 : cellDate > filterDate ? 1 : 0;
                },
            },
            cellRenderer: (p: ICellRendererParams<GcomQuote, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau devis', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: handleManualRefresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [
            { icon: Download, label: 'Imprimer', variant: 'default', onClick: () => setPdfModalOpen(true) },
        ];
        if (isConvertible) {
            detailItems.push(
                { icon: ClipboardList, label: 'Convertir en BC', variant: 'primary', onClick: openConvertToOrder, disabled: convertingToOrder },
                { icon: FileText, label: 'Convertir en facture directe', variant: 'primary', onClick: openConvertToInvoice, disabled: convertingToInvoice },
            );
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, isConvertible, loading, convertingToOrder, convertingToInvoice]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (formMode === 'create') {
        return (
            <GcomCatalogEntryScreen<GcomQuote>
                submitLabel="Créer le devis"
                submitIcon={Plus}
                needsInstrumentAtSubmit={false}
                hidePaymentSection
                showExpiresAt
                onSubmit={handleCreateQuoteSubmit}
                onSubmitted={handleQuoteCreated}
                cancelActionItem={{ icon: X, label: 'Annuler', variant: 'warning', onClick: () => setFormMode('view') }}
                draftKey="gcom-devis-create"
            />
        );
    }

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-2.5">
                            <div className="flex items-center gap-2">
                                <FileSignature className="w-4 h-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Devis</h2>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{total}</span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {QUOTE_STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setStatusFilter(f.value)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                                            statusFilter === f.value ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={quotes}
                                columnDefs={columnDefs}
                                loading={loading}
                                rowActionLoading={detailLoading}
                                rowSelection="single"
                                onRowClicked={e => { if (e.data) { selectQuote(e.data); navigate(`/gcom/devis?id=${e.data.id}`, { replace: true }); } }}
                                defaultSelectedIds={row => row.id === selected?.id}
                            />
                        </div>

                        {quotesQuery.hasNextPage && (
                            <div className="shrink-0 border-t border-gray-100 p-2">
                                <button
                                    onClick={loadMore}
                                    disabled={loading}
                                    className="w-full flex items-center justify-center gap-2 py-1.5 text-xs font-medium text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 disabled:opacity-50 transition-colors"
                                >
                                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                    Charger plus ({quotes.length}/{total})
                                </button>
                            </div>
                        )}
                    </div>
                }

                mainContent={
                    <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                        {!selected ? (
                            // ── EMPTY ─────────────────────────────────────────
                            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                                <FileSignature className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="text-sm font-medium text-gray-600 mb-1">Devis</p>
                                <p className="text-xs max-w-xs">Sélectionnez un devis dans la liste, ou créez-en un nouveau.</p>
                                <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Nouveau devis
                                </button>
                            </div>
                        ) : (
                            // ── DETAIL ────────────────────────────────────────
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{selected.quote_number ?? `#${selected.id}`}</span>
                                                <StatusBadge status={selected.status} />
                                                {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-900">{selected.partner?.name ?? '—'}</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selected.created_at)} · Total {fmtMAD(selected.total_amount)}</p>
                                        </div>
                                    </div>

                                    <SageTabs tabs={TABS} activeTabId={activeTab} onTabChange={handleTabChange} onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} className="shadow-none" />
                                </div>

                                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Informations ─────────────────────── */}
                                    <div ref={el => { sectionRefs.current['informations'] = el; }}>
                                        <SageCollapsible title="Informations" isOpen={openSections['informations']} onOpenChange={open => toggleSection('informations', open)}>
                                            <div className="space-y-3">
                                                <div className="grid grid-cols-3 gap-3">
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Sous-total HT</p>
                                                        <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.sub_total)}</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">TVA</p>
                                                        <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.tax_amount)}</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total TTC</p>
                                                        <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.total_amount)}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 px-1">
                                                    <div className="flex items-center gap-1.5">
                                                        <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                        <p className="text-xs font-medium text-gray-700">{fmtDate(selected.created_at)}</p>
                                                    </div>
                                                    {selected.expires_at && (
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] text-gray-400">Expire le</span>
                                                            <p className="text-xs font-medium text-gray-700">{fmtDate(selected.expires_at)}</p>
                                                        </div>
                                                    )}
                                                </div>

                                                {selected.converted_order_id && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Documents liés</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            <button
                                                                onClick={() => navigate(`/gcom/bons-commande?id=${selected.converted_order_id}`)}
                                                                className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                            >
                                                                <ClipboardList className="w-3 h-3 text-gray-400" /> BC #{selected.converted_order_id}
                                                            </button>
                                                        </div>
                                                    </div>
                                                )}

                                                {selected.notes && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                                                        <p className="text-sm text-gray-700">{selected.notes}</p>
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
                                                    { key: 'article', header: 'Article', render: it => <span className="font-medium text-gray-800">{it.product?.name ?? `Produit #${it.product_id}`}</span> },
                                                    { key: 'qty', header: 'Qté', align: 'right', width: 'w-16', render: it => <span className="text-gray-600">{fmt(it.quantity, 0)}</span> },
                                                    { key: 'pu', header: 'P.U. HT', align: 'right', width: 'w-24', render: it => <span className="text-gray-600">{fmtMAD(it.unit_price_ht)}</span> },
                                                    { key: 'total', header: 'Total TTC', align: 'right', width: 'w-24', render: it => <span className="font-bold text-gray-900">{fmtMAD(it.line_total_ttc)}</span> },
                                                ]}
                                            />
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

            {/* ── Convert to Order (BC) modal ─────────────────────────────────── */}
            {convertOrderModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <ClipboardList className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en bon de commande</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{selected.quote_number ?? `#${selected.id}`}</strong> — {selected.partner?.name} — {fmtMAD(selected.total_amount)}
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de règlement</label>
                            <select
                                value={convertOrderMethod}
                                onChange={e => setConvertOrderMethod(e.target.value as GcomPaymentMethod)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                            >
                                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        {PAYMENT_METHODS.find(m => m.value === convertOrderMethod)?.needsTerm && (
                            <div className="mb-5">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Terme de paiement *</label>
                                {convertOrderTerms.length > 0 ? (
                                    <select
                                        value={convertOrderTermId ?? ''}
                                        onChange={e => setConvertOrderTermId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                    >
                                        <option value="">— Choisir —</option>
                                        {convertOrderTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-[11px] text-red-600 font-medium">Aucun terme à crédit configuré pour ce client.</p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={confirmConvertToOrder}
                                disabled={convertingToOrder}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {convertingToOrder ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeConvertOrderModal} disabled={convertingToOrder} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Convert to Direct Invoice modal ─────────────────────────────── */}
            {convertInvoiceModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en facture directe</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{selected.quote_number ?? `#${selected.id}`}</strong> — {selected.partner?.name} — {fmtMAD(selected.total_amount)}
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de règlement</label>
                            <select
                                value={convertInvoiceMethod}
                                onChange={e => setConvertInvoiceMethod(e.target.value as GcomPaymentMethod)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                            >
                                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                        </div>
                        {invoiceMethodDef.needsTerm && (
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Terme de paiement *</label>
                                {convertInvoiceTerms.length > 0 ? (
                                    <select
                                        value={convertInvoiceTermId ?? ''}
                                        onChange={e => setConvertInvoiceTermId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                    >
                                        <option value="">— Choisir —</option>
                                        {convertInvoiceTerms.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
                                    </select>
                                ) : (
                                    <p className="text-[11px] text-red-600 font-medium">Aucun terme à crédit configuré pour ce client.</p>
                                )}
                            </div>
                        )}
                        {invoiceMethodDef.needsInstrument && (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                                <input value={convertInvoiceInstrument.reference_number} onChange={e => setConvertInvoiceInstrument(p => ({ ...p, reference_number: e.target.value }))} placeholder="Référence *" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                <input type="date" value={convertInvoiceInstrument.due_date} onChange={e => setConvertInvoiceInstrument(p => ({ ...p, due_date: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                <input value={convertInvoiceInstrument.bank_name} onChange={e => setConvertInvoiceInstrument(p => ({ ...p, bank_name: e.target.value }))} placeholder="Banque" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                <input value={convertInvoiceInstrument.bank_account} onChange={e => setConvertInvoiceInstrument(p => ({ ...p, bank_account: e.target.value }))} placeholder="N° compte" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                            </div>
                        )}
                        <div className="flex gap-3 mt-2">
                            <button
                                onClick={confirmConvertToInvoice}
                                disabled={convertingToInvoice}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeConvertInvoiceModal} disabled={convertingToInvoice} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
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
                defaultMode="ht"
                documentLabel="devis"
                loading={pdfLoading}
            />
        </>
    );
}
