import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    Truck, Search, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Building2, AlertTriangle, Info, Package,
    FileText, Ban, Calendar,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { GcomCatalogEntryScreen, type GcomCatalogEntrySubmitPayload } from '@/components/gcom/GcomCatalogEntryScreen';
import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';

import { gcomApi } from '@/services/api/gcomApi';
import { getPartners } from '@/services/api/partnerApi';
import type { Partner } from '@/types/partner.types';
import type {
    GcomDeliveryNote, GcomDeliveryNoteItem, GcomBlStatus, GcomInstrumentInput,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

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
];

const PAGE_SIZE = 30;
const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };

// ─── Component ───────────────────────────────────────────────────────────────

export default function BonLivraisonPage() {
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

    const selectNote = useCallback(async (row: GcomDeliveryNote) => {
        setFormMode('view');
        setSelected(row);
        setActiveTab('informations');
        setDetailLoading(true);
        try {
            setSelected(await gcomApi.deliveryNotes.get(row.id));
        } catch {
            toast.error('Erreur chargement du bon de livraison');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const refresh = () => {
        loadNotes(1, false);
        if (selected) selectNote(selected);
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

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau BL', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: refresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [];
        if (canConvertToInvoice) {
            detailItems.push({ icon: FileText, label: 'Convertir en Facture', variant: 'primary', onClick: openConvertToInvoice, disabled: convertingToInvoice });
        }
        if (canCancel) {
            detailItems.push({ icon: Ban, label: 'Annuler le BL', variant: 'danger', onClick: openCancel });
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, canConvertToInvoice, canCancel, loading, convertingToInvoice]);

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
                                                                <span className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1">
                                                                    <Package className="w-3 h-3 text-gray-400" /> {selected.order.order_code ?? `BC #${selected.order.id}`}
                                                                </span>
                                                            )}
                                                            {selected.invoice_id && (
                                                                <span className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1">
                                                                    <FileText className="w-3 h-3 text-gray-400" /> Facture #{selected.invoice_id}
                                                                </span>
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
                                                    { key: 'qty', header: 'Qté', align: 'right', width: 'w-16', render: (it: GcomDeliveryNoteItem) => <span className="text-gray-600">{fmt(it.ordered_quantity, 0)}</span> },
                                                    { key: 'pu', header: 'P.U.', align: 'right', width: 'w-24', render: (it: GcomDeliveryNoteItem) => <span className="text-gray-600">{fmtMAD(it.unit_price)}</span> },
                                                    { key: 'total', header: 'Total', align: 'right', width: 'w-24', render: (it: GcomDeliveryNoteItem) => <span className="font-bold text-gray-900">{fmtMAD((Number(it.unit_price) || 0) * (Number(it.ordered_quantity) || 0))}</span> },
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
        </>
    );
}
