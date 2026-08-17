import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    Truck, Search, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Building2, AlertTriangle, Info, Package,
    FileText, Ban, Calendar, Download, RotateCcw,
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
import { getPartners } from '@/services/api/partnerApi';
import { RETURN_CONDITIONS, RETURN_CONDITION_LABEL } from '@/lib/gcom/returnConditions';
import { RETURN_REASONS, RETURN_REASON_LABEL } from '@/lib/gcom/returnReasons';
import type { Partner } from '@/types/partner.types';
import type {
    GcomDeliveryNote, GcomDeliveryNoteItem, GcomBlStatus, GcomInstrumentInput, GcomPdfPriceMode, GcomReturnCondition, GcomReturnReason, GcomDeliveryNoteReturn,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

// `ordered_quantity` is a fixed snapshot taken at BL creation — a CAS 1 return
// (§9bis) reduces `delivered_quantity` instead, verified live: after
// returning 1 of 2 units, `ordered_quantity` stayed "2.000" while
// `delivered_quantity` dropped to "1.000". Always read the live quantity
// through this helper, never `ordered_quantity` directly, for display,
// totals, or the return modal's max/validation.
const currentLineQty = (it: GcomDeliveryNoteItem): number => Number(it.delivered_quantity ?? it.ordered_quantity) || 0;

const BL_STATUS_META: Record<GcomBlStatus, { label: string; dot: string; text: string }> = {
    delivered: { label: 'Livré', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cancelled: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-500' },
};

const BL_STATUS_FILTERS: { value: 'all' | GcomBlStatus; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'delivered', label: 'Livré' },
    { value: 'cancelled', label: 'Annulé' },
];

const StatusBadge = ({ status }: { status: GcomBlStatus }) => {
    const meta = BL_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
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
    { id: 'retours', label: 'Retours', icon: RotateCcw },
];

const PAGE_SIZE = 30;
const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };

// ─── Component ───────────────────────────────────────────────────────────────

export default function BonLivraisonPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    // ── List filters ─────────────────────────────────────────────────────────
    const [blStatusFilter, setBlStatusFilter] = useState<'all' | GcomBlStatus>('all');
    const [partnerFilter, setPartnerFilter] = useState<Partner | null>(null);
    const [partnerSearch, setPartnerSearch] = useState('');
    const [partnerResults, setPartnerResults] = useState<Partner[]>([]);
    const [searchingPartner, setSearchingPartner] = useState(false);
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
    const [notes, setNotes] = useState<GcomDeliveryNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const loadNotes = useCallback(async (pageNum: number, append: boolean) => {
        setLoading(true);
        try {
            const res = await gcomApi.deliveryNotes.list({
                partner_id: partnerFilter?.id,
                status: blStatusFilter === 'all' ? undefined : blStatusFilter,
                per_page: PAGE_SIZE,
                page: pageNum,
            });
            setNotes(prev => append ? [...prev, ...res.data] : res.data);
            setPage(res.current_page);
            setLastPage(res.last_page);
            setTotal(res.total);
        } catch {
            toast.error('Erreur chargement des bons de livraison');
        } finally {
            setLoading(false);
        }
    }, [partnerFilter, blStatusFilter]);

    useEffect(() => { loadNotes(1, false); }, [loadNotes]);
    const loadMore = () => { if (page < lastPage) loadNotes(page + 1, true); };

    // ── Selection / detail ───────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'create'>('view');
    const [selected, setSelected] = useState<GcomDeliveryNote | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);

    const [activeTab, setActiveTab] = useState('informations');
    const [openSections, setOpenSections] = useState<Record<string, boolean>>({ informations: true, lignes: true, retours: true });
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
    const handleExpandAll = () => setOpenSections({ informations: true, lignes: true, retours: true });
    const handleCollapseAll = () => setOpenSections({ informations: false, lignes: false, retours: false });

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

    const [returns, setReturns] = useState<GcomDeliveryNoteReturn[]>([]);
    const [returnsLoading, setReturnsLoading] = useState(false);

    const selectNote = useCallback(async (row: GcomDeliveryNote) => {
        setFormMode('view');
        setSelected(row);
        setActiveTab('informations');
        setDetailLoading(true);
        setReturns([]);
        try {
            setSelected(await gcomApi.deliveryNotes.get(row.id));
        } catch {
            toast.error('Erreur chargement du bon de livraison');
        } finally {
            setDetailLoading(false);
        }
        setReturnsLoading(true);
        try {
            setReturns(await gcomApi.deliveryNotes.listReturns(row.id));
        } catch {
            setReturns([]);
        } finally {
            setReturnsLoading(false);
        }
    }, []);

    const refresh = () => {
        loadNotes(1, false);
        if (selected) selectNote(selected);
    };

    // Deep-link from another GCOM document's "Documents liés" chip (?id=123).
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) selectNote({ id } as GcomDeliveryNote);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── PDF (defaults TTC if `priceMode` omitted — this document's convention,
    // the opposite default from BC/Devis) ────────────────────────────────────
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const openPdf = async (priceMode: GcomPdfPriceMode) => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.deliveryNotes.getPdfBlobUrl(selected.id, priceMode);
            window.open(url, '_blank');
            setPdfModalOpen(false);
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    // Bon de retour — one PDF per return event (each `return` call only ever
    // touches one line, no aggregation across events needed).
    const [returnPdfLoadingId, setReturnPdfLoadingId] = useState<number | null>(null);
    const openReturnPdf = async (returnId: number) => {
        if (!selected) return;
        setReturnPdfLoadingId(returnId);
        try {
            const url = await gcomApi.deliveryNotes.getReturnPdfBlobUrl(selected.id, returnId);
            window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le bon de retour');
        } finally {
            setReturnPdfLoadingId(null);
        }
    };

    const openCreate = () => setFormMode('create');

    const handleCreateNoteSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomDeliveryNote> => {
        try {
            const note = await gcomApi.deliveryNotes.create({
                partner_id: payload.partner_id,
                items: payload.items,
                payment_method: payload.payment_method,
                payment_term_id: payload.payment_term_id,
                notes: payload.notes,
            });
            toast.success('Bon de livraison créé');
            return note;
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg ?? 'Erreur lors de la création du BL');
        }
    };

    const handleNoteCreated = (note: GcomDeliveryNote) => {
        setFormMode('view');
        loadNotes(1, false);
        selectNote(note);
    };

    // ── Convert to Facture ───────────────────────────────────────────────────
    const [convertPanelOpen, setConvertPanelOpen] = useState(false); // instrument required (cheque/effet)
    const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false); // plain confirmation otherwise
    const [convertInstrument, setConvertInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [convertingToInvoice, setConvertingToInvoice] = useState(false);

    const openConvertToInvoice = () => {
        if (!selected) return;
        const method = selected.order?.financial_metadata?.payment_method;
        const needsInstrument = method === 'cheque' || method === 'effet';
        if (needsInstrument) {
            setConvertInstrument(EMPTY_INSTRUMENT);
            setConvertPanelOpen(true);
        } else {
            setInvoiceConfirmOpen(true);
        }
    };
    const closeInvoiceConfirm = () => setInvoiceConfirmOpen(false);

    const doConvertToInvoice = async (instrument: GcomInstrumentInput | null) => {
        if (!selected) return;
        setConvertingToInvoice(true);
        try {
            const invoice = await gcomApi.deliveryNotes.convertToInvoice(selected.id, instrument);
            toast.success(`Facture ${invoice.invoice_number ?? `#${invoice.id}`} créée`);
            setConvertPanelOpen(false);
            setInvoiceConfirmOpen(false);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en facture');
        } finally {
            setConvertingToInvoice(false);
        }
    };

    // ── Cancellation (restocks) ──────────────────────────────────────────────
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    const openCancel = () => { setCancelOpen(true); setCancelReason(''); };
    const closeCancel = () => setCancelOpen(false);

    const confirmCancel = async () => {
        if (!selected || !cancelReason.trim()) { toast.error('Motif requis'); return; }
        setCancelling(true);
        try {
            await gcomApi.deliveryNotes.cancel(selected.id, { reason: cancelReason.trim() });
            toast.success('Bon de livraison annulé — stock réintégré');
            setCancelOpen(false);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation");
        } finally {
            setCancelling(false);
        }
    };

    // ── Return — CAS 1 of the returns architecture (§9bis), batch entry ─────────
    // Only possible before the BL is invoiced (same guard as convert/cancel) —
    // once invoiced, a return goes through the invoice's avoir instead (CAS 2,
    // on FacturesPage), not this endpoint. Per explicit UX request: a single
    // "Effectuer un retour partiel" action opens one grid covering every line
    // instead of a per-line button+modal — the API itself is still one call per
    // line (no batch endpoint exists), fired sequentially like BC's "Ajouter des
    // articles" modal, same reason (parallel POSTs mutating the same BL's line
    // list risk a server-side race) and same partial-success reporting.
    const [returnBatchOpen, setReturnBatchOpen] = useState(false);
    const [returnBatchQty, setReturnBatchQty] = useState<Record<number, number | ''>>({});
    const [returnBatchCondition, setReturnBatchCondition] = useState<Record<number, GcomReturnCondition>>({});
    const [returnBatchReason, setReturnBatchReason] = useState<Record<number, GcomReturnReason | ''>>({});
    const [returningBatch, setReturningBatch] = useState(false);

    const openReturnBatch = () => {
        setReturnBatchQty({});
        setReturnBatchCondition({});
        setReturnBatchReason({});
        setReturnBatchOpen(true);
    };
    const closeReturnBatch = () => setReturnBatchOpen(false);

    const setBatchQty = (itemId: number, value: number | '') => setReturnBatchQty(prev => ({ ...prev, [itemId]: value }));
    const setBatchCondition = (itemId: number, value: GcomReturnCondition) => setReturnBatchCondition(prev => ({ ...prev, [itemId]: value }));
    const setBatchReason = (itemId: number, value: GcomReturnReason | '') => setReturnBatchReason(prev => ({ ...prev, [itemId]: value }));

    const confirmReturnBatch = async () => {
        if (!selected) return;
        const lines = (selected.items ?? []).filter(it => (Number(returnBatchQty[it.id]) || 0) > 0);
        if (lines.length === 0) { toast.error('Renseignez au moins une quantité à retourner'); return; }

        setReturningBatch(true);
        let successCount = 0;
        const failures: string[] = [];
        // Sequential, not Promise.all — each call mutates the same BL's line
        // list, parallel calls risk a server-side race on the same row.
        for (const it of lines) {
            const qty = Number(returnBatchQty[it.id]) || 0;
            const currentQty = currentLineQty(it);
            const reason = returnBatchReason[it.id] || '';
            const label = it.product_id ? `Produit #${it.product_id}` : `Ligne #${it.id}`;
            if (qty >= currentQty) {
                failures.push(`${label} : quantité invalide (doit être < ${fmt(currentQty, 0)})`);
                continue;
            }
            if (!reason) {
                failures.push(`${label} : motif requis`);
                continue;
            }
            try {
                await gcomApi.deliveryNotes.returnLine(selected.id, it.id, {
                    quantity: qty,
                    reason,
                    condition: returnBatchCondition[it.id] ?? 'sellable',
                });
                successCount++;
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                failures.push(`${label} : ${msg ?? 'erreur'}`);
            }
        }
        setReturningBatch(false);
        if (successCount > 0) {
            toast.success(`${successCount} ligne${successCount > 1 ? 's' : ''} retournée${successCount > 1 ? 's' : ''} — stock réintégré`);
            refresh();
        }
        if (failures.length > 0) {
            toast.error(failures.join(' • '));
        } else {
            setReturnBatchOpen(false);
        }
    };

    // ── DataGrid columns ──────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'delivery_number', headerName: 'BL', width: 150,
            valueGetter: (p: ValueGetterParams<GcomDeliveryNote>) => p.data?.delivery_number ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote, string>) => <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.value ?? '—'}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 100,
            filter: 'agSetColumnFilter',
            filterParams: { valueFormatter: (p: { value: GcomBlStatus }) => BL_STATUS_META[p.value]?.label ?? p.value },
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote>) => p.data ? <StatusBadge status={p.data.status} /> : null,
        },
        {
            colId: 'total_amount', headerName: 'Total TTC', width: 100,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomDeliveryNote>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote, number>) => (
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>
            ),
        },
        {
            field: 'delivery_date', headerName: 'Date', width: 100,
            filter: 'agDateColumnFilter',
            filterParams: {
                comparator: (filterDate: Date, cellValue: string) => {
                    if (!cellValue) return -1;
                    const cellDate = new Date(cellValue);
                    cellDate.setHours(0, 0, 0, 0);
                    return cellDate < filterDate ? -1 : cellDate > filterDate ? 1 : 0;
                },
            },
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    const canConvertToInvoice = selected?.status === 'delivered' && !selected.invoice_id;
    const canCancel = selected?.status === 'delivered' && !selected.invoice_id;
    const canReturn = canCancel && (selected?.items ?? []).some(it => currentLineQty(it) > 1);

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau BL', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: refresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [
            { icon: Download, label: 'Imprimer', variant: 'default', onClick: () => setPdfModalOpen(true) },
        ];
        if (canReturn) {
            detailItems.push({ icon: RotateCcw, label: 'Effectuer un retour partiel', variant: 'warning', onClick: openReturnBatch });
        }
        if (canConvertToInvoice) {
            detailItems.push({ icon: FileText, label: 'Convertir en Facture', variant: 'primary', onClick: openConvertToInvoice, disabled: convertingToInvoice });
        }
        if (canCancel) {
            detailItems.push({ icon: Ban, label: 'Annuler le BL', variant: 'danger', onClick: openCancel });
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, canConvertToInvoice, canCancel, canReturn, loading, convertingToInvoice]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (formMode === 'create') {
        return (
            <GcomCatalogEntryScreen<GcomDeliveryNote>
                submitLabel="Créer le BL"
                submitIcon={Truck}
                needsInstrumentAtSubmit={false}
                onSubmit={handleCreateNoteSubmit}
                onSubmitted={handleNoteCreated}
                cancelActionItem={{ icon: X, label: 'Annuler', variant: 'warning', onClick: () => setFormMode('view') }}
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
                                <Truck className="w-4 h-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Bons de livraison</h2>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{total}</span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {BL_STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setBlStatusFilter(f.value)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                                            blStatusFilter === f.value ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                        }`}
                                    >
                                        {f.label}
                                    </button>
                                ))}
                            </div>

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
                        </div>

                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={notes}
                                columnDefs={columnDefs}
                                loading={loading}
                                rowActionLoading={detailLoading}
                                rowSelection="single"
                                onRowClicked={e => { if (e.data) selectNote(e.data); }}
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
                                    Charger plus ({notes.length}/{total})
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
                                <Truck className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="text-sm font-medium text-gray-600 mb-1">Bons de livraison</p>
                                <p className="text-xs max-w-xs">Sélectionnez un BL dans la liste, ou créez-en un nouveau (vente directe, sans passer par un BC).</p>
                                <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Nouveau BL
                                </button>
                            </div>
                        ) : (
                            // ── DETAIL ────────────────────────────────────────
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{selected.delivery_number ?? `#${selected.id}`}</span>
                                                <StatusBadge status={selected.status} />
                                                {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-900">{selected.partner?.name ?? '—'}</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selected.delivery_date)} · Total {fmtMAD(selected.total_amount)}</p>
                                        </div>
                                    </div>

                                    <SageTabs tabs={TABS} activeTabId={activeTab} onTabChange={handleTabChange} onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} className="shadow-none" />
                                </div>

                                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Convert-to-invoice instrument panel ──── */}
                                    {convertPanelOpen && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">
                                                Instrument requis pour la conversion en facture ({selected.order?.financial_metadata?.payment_method})
                                            </p>
                                            <div className="grid grid-cols-2 gap-2">
                                                <input value={convertInstrument.reference_number} onChange={e => setConvertInstrument(p => ({ ...p, reference_number: e.target.value }))} placeholder="Référence *" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                                <input type="date" value={convertInstrument.due_date} onChange={e => setConvertInstrument(p => ({ ...p, due_date: e.target.value }))} className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                                <input value={convertInstrument.bank_name} onChange={e => setConvertInstrument(p => ({ ...p, bank_name: e.target.value }))} placeholder="Banque" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                                <input value={convertInstrument.bank_account} onChange={e => setConvertInstrument(p => ({ ...p, bank_account: e.target.value }))} placeholder="N° compte" className="px-2 py-1.5 text-xs border border-gray-200 rounded-md" />
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        if (!convertInstrument.reference_number.trim() || !convertInstrument.due_date) { toast.error('Référence et échéance requises'); return; }
                                                        void doConvertToInvoice(convertInstrument);
                                                    }}
                                                    disabled={convertingToInvoice}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white text-xs font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50"
                                                >
                                                    {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    Confirmer
                                                </button>
                                                <button onClick={() => setConvertPanelOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                                            </div>
                                        </div>
                                    )}

                                    {selected.status === 'cancelled' && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                                            <Ban className="w-3.5 h-3.5 text-gray-400 shrink-0" /> Bon de livraison annulé — stock réintégré
                                        </div>
                                    )}

                                    {selected.status === 'delivered' && selected.invoice_id && (
                                        <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                            <RotateCcw className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                            BL déjà facturé — pour un retour de marchandise, utilisez l'avoir sur la facture liée (onglet Factures).
                                        </div>
                                    )}

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

                                                <div className="flex items-center gap-1.5 px-1">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                    <p className="text-xs font-medium text-gray-700">{fmtDate(selected.delivery_date)}</p>
                                                </div>

                                                {(selected.order || selected.invoice_id) && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Documents liés</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {selected.order && (
                                                                <button
                                                                    onClick={() => navigate(`/gcom/bons-commande?id=${selected.order!.id}`)}
                                                                    className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                                >
                                                                    <Package className="w-3 h-3 text-gray-400" /> {selected.order.order_code ?? `BC #${selected.order.id}`}
                                                                </button>
                                                            )}
                                                            {selected.invoice_id && (
                                                                <button
                                                                    onClick={() => navigate(`/gcom/factures?id=${selected.invoice_id}`)}
                                                                    className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                                >
                                                                    <FileText className="w-3 h-3 text-gray-400" /> Facture #{selected.invoice_id}
                                                                </button>
                                                            )}
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
                                                    { key: 'article', header: 'Article', render: (it: GcomDeliveryNoteItem) => <span className="font-medium text-gray-800">{`Produit #${it.product_id}`}</span> },
                                                    {
                                                        key: 'qty', header: 'Qté', align: 'right', width: 'w-20',
                                                        render: (it: GcomDeliveryNoteItem) => {
                                                            // Full history (reason/condition/who/when) is in the Retours tab
                                                            // below — this is just a quick at-a-glance signal in the Lignes list.
                                                            const original = Number(it.ordered_quantity) || 0;
                                                            const current = currentLineQty(it);
                                                            const returned = original - current;
                                                            return (
                                                                <div>
                                                                    <span className="text-gray-600">{fmt(current, 0)}</span>
                                                                    {returned > 0 && (
                                                                        <p className="text-[9px] text-amber-600 font-medium">-{fmt(returned, 0)} retourné{returned > 1 ? 's' : ''}</p>
                                                                    )}
                                                                </div>
                                                            );
                                                        },
                                                    },
                                                    { key: 'pu', header: 'P.U.', align: 'right', width: 'w-24', render: (it: GcomDeliveryNoteItem) => <span className="text-gray-600">{fmtMAD(it.unit_price)}</span> },
                                                    { key: 'total', header: 'Total', align: 'right', width: 'w-24', render: (it: GcomDeliveryNoteItem) => <span className="font-bold text-gray-900">{fmtMAD((Number(it.unit_price) || 0) * currentLineQty(it))}</span> },
                                                ]}
                                            />
                                        </SageCollapsible>
                                    </div>

                                    {/* ── Retours ─────────────────────────────── */}
                                    <div ref={el => { sectionRefs.current['retours'] = el; }}>
                                        <SageCollapsible
                                            title="Retours"
                                            isOpen={openSections['retours']}
                                            onOpenChange={open => toggleSection('retours', open)}
                                            rightContent={!returnsLoading && <span className="text-[10px] text-gray-400 mr-2">{returns.length}</span>}
                                        >
                                            {returnsLoading ? (
                                                <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                            ) : returns.length === 0 ? (
                                                <div className="text-center py-8 text-xs text-gray-400">
                                                    <RotateCcw className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                                    Aucun retour enregistré pour ce BL
                                                </div>
                                            ) : (
                                                <div className="divide-y divide-gray-100 rounded-lg overflow-hidden border border-gray-100">
                                                    {returns.map(r => (
                                                        <div key={r.id} className="flex items-center justify-between px-3 py-2.5 bg-white">
                                                            <div className="min-w-0">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-xs font-semibold text-gray-900">{r.product?.name ?? `Produit #${r.delivery_note_item_id}`}</span>
                                                                    <span className="text-[10px] text-gray-400">{RETURN_CONDITION_LABEL[r.condition] ?? r.condition}</span>
                                                                </div>
                                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                                    {RETURN_REASON_LABEL[r.reason] ?? r.reason}
                                                                    {r.returned_by?.name && ` · ${r.returned_by.name}`}
                                                                    {r.returned_at && ` · ${fmtDate(r.returned_at)}`}
                                                                </p>
                                                            </div>
                                                            <div className="flex items-center gap-3 shrink-0 ml-3">
                                                                <span className="text-xs font-bold text-gray-900">{fmt(r.quantity, 0)}</span>
                                                                <button
                                                                    onClick={() => openReturnPdf(r.id)}
                                                                    disabled={returnPdfLoadingId === r.id}
                                                                    title="Bon de retour PDF"
                                                                    className="text-gray-400 hover:text-sage-600 disabled:opacity-50"
                                                                >
                                                                    {returnPdfLoadingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ))}
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

            {/* ── Convert to Facture — plain confirmation (no instrument needed) ── */}
            {invoiceConfirmOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en facture</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Confirmez-vous la conversion du BL <strong>{selected.delivery_number ?? `#${selected.id}`}</strong> en facture pour <strong>{selected.partner?.name}</strong>, d'un montant de <strong>{fmtMAD(selected.total_amount)}</strong> ?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => doConvertToInvoice(null)}
                                disabled={convertingToInvoice}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                                {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeInvoiceConfirm} disabled={convertingToInvoice} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Cancel confirm modal ─────────────────────────────────────────── */}
            {cancelOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Annuler le bon de livraison</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{selected.delivery_number ?? `#${selected.id}`}</strong> — le stock sera immédiatement réintégré.
                        </p>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={2}
                                maxLength={255}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                                placeholder="Marchandise refusée par le client…"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmCancel}
                                disabled={cancelling || !cancelReason.trim()}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeCancel} disabled={cancelling} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
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
                documentLabel="bon de livraison"
                loading={pdfLoading}
            />

            {/* ── Batch return modal — all lines in one grid, one submit ───────── */}
            {returnBatchOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-3xl w-full mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <RotateCcw className="w-4 h-4 text-amber-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Retour partiel</h3>
                                <p className="text-[11px] text-gray-400">Renseignez la quantité retournée pour chaque article concerné.</p>
                            </div>
                        </div>

                        <div className="max-h-[26rem] overflow-y-auto rounded-lg border border-gray-100">
                            <table className="w-full text-xs">
                                <thead className="sticky top-0 bg-gray-50 border-b border-gray-200">
                                    <tr className="text-[10px] uppercase tracking-wider text-gray-400">
                                        <th className="text-left font-semibold px-3 py-2">Article</th>
                                        <th className="text-right font-semibold px-3 py-2 w-20">Qté livrée</th>
                                        <th className="text-center font-semibold px-3 py-2 w-24">Qté à retourner</th>
                                        <th className="text-left font-semibold px-3 py-2 w-40">État</th>
                                        <th className="text-left font-semibold px-3 py-2">Motif</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {(selected.items ?? []).map(it => {
                                        const current = currentLineQty(it);
                                        const returnable = current > 1;
                                        const qty = returnBatchQty[it.id] ?? '';
                                        return (
                                            <tr key={it.id} className={!returnable ? 'opacity-50' : (Number(qty) || 0) > 0 ? 'bg-amber-50/40' : undefined}>
                                                <td className="px-3 py-2 font-medium text-gray-800">{`Produit #${it.product_id}`}</td>
                                                <td className="px-3 py-2 text-right text-gray-600">{fmt(current, 0)}</td>
                                                <td className="px-2 py-1.5">
                                                    <input
                                                        type="number" min={0} max={returnable ? current - 1 : 0}
                                                        disabled={!returnable}
                                                        value={qty}
                                                        placeholder="0"
                                                        onChange={e => setBatchQty(it.id, e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                                        className="w-full text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                    />
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <select
                                                        disabled={!returnable}
                                                        value={returnBatchCondition[it.id] ?? 'sellable'}
                                                        onChange={e => setBatchCondition(it.id, e.target.value as GcomReturnCondition)}
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                    >
                                                        {RETURN_CONDITIONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                </td>
                                                <td className="px-2 py-1.5">
                                                    <select
                                                        disabled={!returnable}
                                                        value={returnBatchReason[it.id] ?? ''}
                                                        onChange={e => setBatchReason(it.id, e.target.value as GcomReturnReason | '')}
                                                        className="w-full px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                    >
                                                        <option value="">{returnable ? '— Motif —' : 'Qté = 1, annulez le BL'}</option>
                                                        {RETURN_REASONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                    </select>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={confirmReturnBatch}
                                disabled={returningBatch}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {returningBatch ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer le retour
                            </button>
                            <button onClick={closeReturnBatch} disabled={returningBatch} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
