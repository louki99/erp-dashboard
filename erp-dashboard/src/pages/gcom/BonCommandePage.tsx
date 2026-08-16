import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    ClipboardList, Search, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Building2, AlertTriangle, Info, Package, Truck,
    FileText, Ban, Calendar, Edit2,
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
import { telesalesApi } from '@/services/api/telesalesApi';
import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import type { Partner } from '@/types/partner.types';
import type { CatalogProduct } from '@/types/telesalesAgent.types';
import type {
    GcomPaymentMethod, GcomOrder, GcomOrderProduct, GcomBcStatus, GcomInstrumentInput,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const BC_STATUS_META: Record<GcomBcStatus, { label: string; dot: string; text: string }> = {
    confirmed: { label: 'Confirmé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cancelled: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-500' },
};

const BC_STATUS_FILTERS: { value: 'all' | GcomBcStatus; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'confirmed', label: 'Confirmé' },
    { value: 'cancelled', label: 'Annulé' },
];

const StatusBadge = ({ status }: { status: GcomBcStatus }) => {
    const meta = BC_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
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

type ConvertTarget = { type: 'order'; id: number } | { type: 'bl'; id: number };

// ─── Component ───────────────────────────────────────────────────────────────

export default function BonCommandePage() {
    // ── List filters ─────────────────────────────────────────────────────────
    const [bcStatusFilter, setBcStatusFilter] = useState<'all' | GcomBcStatus>('all');
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
    const [orders, setOrders] = useState<GcomOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const loadOrders = useCallback(async (pageNum: number, append: boolean) => {
        setLoading(true);
        try {
            const res = await gcomApi.orders.list({
                partner_id: partnerFilter?.id,
                bc_status: bcStatusFilter === 'all' ? undefined : bcStatusFilter,
                per_page: PAGE_SIZE,
                page: pageNum,
            });
            setOrders(prev => append ? [...prev, ...res.data] : res.data);
            setPage(res.current_page);
            setLastPage(res.last_page);
            setTotal(res.total);
        } catch {
            toast.error('Erreur chargement des bons de commande');
        } finally {
            setLoading(false);
        }
    }, [partnerFilter, bcStatusFilter]);

    useEffect(() => { loadOrders(1, false); }, [loadOrders]);
    const loadMore = () => { if (page < lastPage) loadOrders(page + 1, true); };

    // ── Selection / detail ───────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'create'>('view');
    const [selected, setSelected] = useState<GcomOrder | null>(null);
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

    const selectOrder = useCallback(async (row: GcomOrder) => {
        setFormMode('view');
        setSelected(row);
        setActiveTab('informations');
        setDetailLoading(true);
        try {
            // Re-fetch via GET regardless of what the list row already had, so the
            // detail view always has full products/invoices/delivery_notes.
            setSelected(await gcomApi.orders.get(row.id));
        } catch {
            toast.error('Erreur chargement du bon de commande');
        } finally {
            setDetailLoading(false);
        }
    }, []);

    const refresh = () => {
        loadOrders(1, false);
        if (selected) selectOrder(selected);
    };

    const openCreate = () => setFormMode('create');

    const handleCreateOrderSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomOrder> => {
        try {
            const order = await gcomApi.orders.create({
                partner_id: payload.partner_id,
                items: payload.items,
                payment_method: payload.payment_method,
                payment_term_id: payload.payment_term_id,
                notes: payload.notes,
            });
            toast.success('Bon de commande créé');
            return order;
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg ?? 'Erreur lors de la création du BC');
        }
    };

    const handleOrderCreated = (order: GcomOrder) => {
        setFormMode('view');
        loadOrders(1, false);
        selectOrder(order);
    };

    // ── BC → BL conversion (delivery date + payment method confirmation) ────────
    // Backend fix 2026-08-15: delivery_date/payment_method are genuinely
    // persisted now (verified live). Changing payment_method here re-triggers
    // stamp duty recalculation and, when switching to a credit-family method,
    // a real credit check — 422s surface via confirmConvertToBl's catch block
    // same as everywhere else, no special-casing needed.
    const [blModalOpen, setBlModalOpen] = useState(false);
    const [blDeliveryDate, setBlDeliveryDate] = useState('');
    const [blPaymentMethod, setBlPaymentMethod] = useState<GcomPaymentMethod>('cash');
    const [convertingToBl, setConvertingToBl] = useState(false);

    const openConvertToBlModal = () => {
        if (!selected) return;
        setBlDeliveryDate(new Date().toISOString().slice(0, 10));
        setBlPaymentMethod(selected.financial_metadata?.payment_method ?? 'cash');
        setBlModalOpen(true);
    };
    const closeConvertToBlModal = () => setBlModalOpen(false);

    const confirmConvertToBl = async () => {
        if (!selected) return;
        setConvertingToBl(true);
        try {
            await gcomApi.orders.convertToBl(selected.id, { delivery_date: blDeliveryDate, payment_method: blPaymentMethod });
            toast.success('Bon de commande converti en BL');
            setBlModalOpen(false);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en BL');
        } finally {
            setConvertingToBl(false);
        }
    };

    // ── BC/BL → Facture conversion ───────────────────────────────────────────────
    const [convertTarget, setConvertTarget] = useState<ConvertTarget | null>(null);
    const [convertPanelOpen, setConvertPanelOpen] = useState(false); // instrument required (cheque/effet)
    const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false); // plain confirmation otherwise
    const [convertInstrument, setConvertInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [convertingToInvoice, setConvertingToInvoice] = useState(false);

    const openConvertToInvoice = (target: ConvertTarget) => {
        if (!selected) return;
        setConvertTarget(target);
        const method = selected.financial_metadata?.payment_method;
        const needsInstrument = method === 'cheque' || method === 'effet';
        if (needsInstrument) {
            setConvertInstrument(EMPTY_INSTRUMENT);
            setConvertPanelOpen(true);
        } else {
            setInvoiceConfirmOpen(true);
        }
    };

    const closeInvoiceConfirm = () => { setInvoiceConfirmOpen(false); setConvertTarget(null); };

    const doConvertToInvoice = async (target: ConvertTarget, instrument: GcomInstrumentInput | null) => {
        setConvertingToInvoice(true);
        try {
            const invoice = target.type === 'order'
                ? await gcomApi.orders.convertToInvoice(target.id, instrument)
                : await gcomApi.deliveryNotes.convertToInvoice(target.id, instrument);
            toast.success(`Facture ${invoice.invoice_number ?? `#${invoice.id}`} créée`);
            setConvertPanelOpen(false);
            setInvoiceConfirmOpen(false);
            setConvertTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en facture');
        } finally {
            setConvertingToInvoice(false);
        }
    };

    // ── Cancellation (order or single line) ──────────────────────────────────
    const [cancelTarget, setCancelTarget] = useState<{ type: 'order' } | { type: 'line'; line: GcomOrderProduct } | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelQuantity, setCancelQuantity] = useState<number | ''>('');
    const [cancelling, setCancelling] = useState(false);

    const openCancelOrder = () => { setCancelTarget({ type: 'order' }); setCancelReason(''); };
    const openCancelLine = (line: GcomOrderProduct) => { setCancelTarget({ type: 'line', line }); setCancelReason(''); setCancelQuantity(''); };
    const closeCancelDialog = () => setCancelTarget(null);

    const confirmCancel = async () => {
        if (!cancelTarget || !selected || !cancelReason.trim()) { toast.error('Motif requis'); return; }
        setCancelling(true);
        try {
            if (cancelTarget.type === 'order') {
                await gcomApi.orders.cancel(selected.id, { reason: cancelReason.trim() });
                toast.success('Bon de commande annulé');
            } else {
                await gcomApi.orders.cancelLine(selected.id, cancelTarget.line.pivot.id, {
                    reason: cancelReason.trim(),
                    quantity: cancelQuantity === '' ? undefined : cancelQuantity,
                });
                toast.success('Ligne annulée');
            }
            setCancelTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation");
        } finally {
            setCancelling(false);
        }
    };

    // ── Update line quantity (the inverse of cancel — raise it) ─────────────────
    const [updateQtyTarget, setUpdateQtyTarget] = useState<GcomOrderProduct | null>(null);
    const [updateQtyValue, setUpdateQtyValue] = useState<number | ''>('');
    const [updatingQty, setUpdatingQty] = useState(false);

    const openUpdateQty = (line: GcomOrderProduct) => { setUpdateQtyTarget(line); setUpdateQtyValue(Number(line.pivot.quantity)); };
    const closeUpdateQtyDialog = () => setUpdateQtyTarget(null);

    const confirmUpdateQty = async () => {
        if (!updateQtyTarget || !selected || updateQtyValue === '' || updateQtyValue <= 0) { toast.error('Quantité invalide'); return; }
        setUpdatingQty(true);
        try {
            await gcomApi.orders.updateLine(selected.id, updateQtyTarget.pivot.id, { quantity: updateQtyValue });
            toast.success('Quantité mise à jour');
            setUpdateQtyTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la mise à jour de la quantité');
        } finally {
            setUpdatingQty(false);
        }
    };

    // ── Add new lines to the BC (paginated multi-select) ────────────────────────
    const ADD_LINE_PAGE_SIZE = 8;
    const [addLineModalOpen, setAddLineModalOpen] = useState(false);
    const [addLineSearch, setAddLineSearch] = useState('');
    const [addLineRows, setAddLineRows] = useState<CatalogProduct[]>([]);
    const [addLineLoading, setAddLineLoading] = useState(false);
    const [addLinePage, setAddLinePage] = useState(1);
    const [addLineLastPage, setAddLineLastPage] = useState(1);
    const [addLineSelected, setAddLineSelected] = useState<Record<number, boolean>>({});
    const [addLineQuantities, setAddLineQuantities] = useState<Record<number, number>>({});
    const [addingLine, setAddingLine] = useState(false);
    const addLineDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Remembers every row ever loaded (across pages/searches) so the confirm
    // step can still name a product selected on a page the user has since left.
    const addLineCache = useRef<Map<number, CatalogProduct>>(new Map());

    const selectedAddLineCount = useMemo(() => Object.values(addLineSelected).filter(Boolean).length, [addLineSelected]);

    const loadAddLineCatalog = useCallback(async (query: string, page: number) => {
        if (!selected?.partner) return;
        setAddLineLoading(true);
        try {
            const res = await telesalesApi.catalog.getProducts({ search: query.trim() || undefined, partner_id: selected.partner.id, per_page: ADD_LINE_PAGE_SIZE, page });
            // Already-present products need the PATCH (update quantity) endpoint, not this one.
            const existingIds = new Set((selected.products ?? []).map(p => p.id));
            const rows = res.products.filter(p => !existingIds.has(p.id));
            rows.forEach(p => addLineCache.current.set(p.id, p));
            setAddLineRows(rows);
            setAddLinePage(res.pagination?.current_page ?? page);
            setAddLineLastPage(res.pagination?.total_pages ?? page);
        } catch {
            toast.error('Erreur chargement du catalogue');
        } finally {
            setAddLineLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.partner?.id, selected?.products]);

    const openAddLineModal = () => {
        setAddLineSearch('');
        setAddLineSelected({});
        setAddLineQuantities({});
        addLineCache.current.clear();
        setAddLineModalOpen(true);
        loadAddLineCatalog('', 1);
    };
    const closeAddLineModal = () => setAddLineModalOpen(false);

    useEffect(() => {
        if (!addLineModalOpen) return;
        if (addLineDebounce.current) clearTimeout(addLineDebounce.current);
        addLineDebounce.current = setTimeout(() => loadAddLineCatalog(addLineSearch, 1), 300);
        return () => { if (addLineDebounce.current) clearTimeout(addLineDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [addLineSearch, addLineModalOpen]);

    const goToAddLinePage = (page: number) => loadAddLineCatalog(addLineSearch, page);

    const toggleAddLineSelect = (productId: number) => {
        setAddLineSelected(prev => ({ ...prev, [productId]: !prev[productId] }));
        setAddLineQuantities(prev => prev[productId] ? prev : { ...prev, [productId]: 1 });
    };
    const setAddLineQty = (productId: number, quantity: number) => {
        setAddLineQuantities(prev => ({ ...prev, [productId]: Math.max(1, quantity) }));
    };

    const confirmAddLines = async () => {
        const productIds = Object.entries(addLineSelected).filter(([, checked]) => checked).map(([id]) => Number(id));
        if (!selected || productIds.length === 0) { toast.error('Sélectionnez au moins un article'); return; }
        setAddingLine(true);
        let successCount = 0;
        const failures: string[] = [];
        // Sequential, not Promise.all — each call mutates the same order's line
        // list; parallel calls risk a server-side race on the same row.
        for (const productId of productIds) {
            const quantity = addLineQuantities[productId] ?? 1;
            try {
                await gcomApi.orders.addLine(selected.id, { product_id: productId, quantity });
                successCount++;
            } catch (err: unknown) {
                const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
                const name = addLineCache.current.get(productId)?.name ?? `#${productId}`;
                failures.push(`${name} : ${msg ?? 'erreur'}`);
            }
        }
        setAddingLine(false);
        if (successCount > 0) {
            toast.success(`${successCount} article${successCount > 1 ? 's' : ''} ajouté${successCount > 1 ? 's' : ''}`);
            refresh();
        }
        if (failures.length > 0) {
            toast.error(failures.join(' • '));
        } else {
            setAddLineModalOpen(false);
        }
    };

    // ── DataGrid columns ──────────────────────────────────────────────────────

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'order_code', headerName: 'BC', width: 150,
            valueGetter: (p: ValueGetterParams<GcomOrder>) => p.data?.order_code ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomOrder, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomOrder, string>) => <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.value ?? '—'}</span>,
        },
        {
            field: 'bc_status', headerName: 'Statut', width: 100,
            filter: 'agSetColumnFilter',
            filterParams: { valueFormatter: (p: { value: GcomBcStatus }) => BC_STATUS_META[p.value]?.label ?? p.value },
            cellRenderer: (p: ICellRendererParams<GcomOrder>) => p.data ? <StatusBadge status={p.data.bc_status} /> : null,
        },
        {
            field: 'financial_metadata.payment_method', headerName: 'Règlement', width: 100,
            cellRenderer: (p: ICellRendererParams<GcomOrder, GcomPaymentMethod>) => (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{PAYMENT_METHODS.find(m => m.value === p.value)?.label ?? p.value ?? '—'}</span>
            ),
        },
        {
            colId: 'total_amount', headerName: 'Total TTC', width: 100,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomOrder>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomOrder, number>) => (
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
            cellRenderer: (p: ICellRendererParams<GcomOrder, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    // Same "before any BL/invoice" guard the API enforces for BC→BL, BC→Facture, cancel and line-cancel.
    const noDocumentsYet = selected?.bc_status === 'confirmed' && (selected.delivery_notes?.length ?? 0) === 0 && (selected.invoices?.length ?? 0) === 0;
    const blForConversion = selected?.delivery_notes?.[0];
    const canConvertBlToInvoice = selected?.bc_status === 'confirmed' && !!blForConversion && (selected.invoices?.length ?? 0) === 0;

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau BC', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: refresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [];
        if (noDocumentsYet) {
            detailItems.push(
                { icon: Plus, label: 'Ajouter une ligne', variant: 'sage', onClick: openAddLineModal },
                { icon: Truck, label: 'Convertir en BL', variant: 'primary', onClick: openConvertToBlModal, disabled: convertingToBl },
                { icon: FileText, label: 'Convertir en Facture', variant: 'primary', onClick: () => openConvertToInvoice({ type: 'order', id: selected.id }), disabled: convertingToInvoice },
                { icon: Ban, label: 'Annuler le BC', variant: 'danger', onClick: openCancelOrder },
            );
        } else if (canConvertBlToInvoice && blForConversion) {
            detailItems.push(
                { icon: FileText, label: 'Convertir le BL en Facture', variant: 'primary', onClick: () => openConvertToInvoice({ type: 'bl', id: blForConversion.id }), disabled: convertingToInvoice },
            );
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, noDocumentsYet, canConvertBlToInvoice, blForConversion, loading, convertingToBl, convertingToInvoice]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (formMode === 'create') {
        return (
            <GcomCatalogEntryScreen<GcomOrder>
                submitLabel="Créer le BC"
                submitIcon={Plus}
                needsInstrumentAtSubmit={false}
                onSubmit={handleCreateOrderSubmit}
                onSubmitted={handleOrderCreated}
                cancelActionItem={{ icon: X, label: 'Annuler', variant: 'warning', onClick: () => setFormMode('view') }}
                confirmBeforeSubmit
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
                                <ClipboardList className="w-4 h-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Bons de commande</h2>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{total}</span>
                            </div>

                            <div className="flex flex-wrap gap-1">
                                {BC_STATUS_FILTERS.map(f => (
                                    <button
                                        key={f.value}
                                        onClick={() => setBcStatusFilter(f.value)}
                                        className={`px-2 py-1 text-[10px] font-medium rounded-md border transition-colors ${
                                            bcStatusFilter === f.value ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
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
                                rowData={orders}
                                columnDefs={columnDefs}
                                loading={loading}
                                rowActionLoading={detailLoading}
                                rowSelection="single"
                                onRowClicked={e => { if (e.data) selectOrder(e.data); }}
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
                                    Charger plus ({orders.length}/{total})
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
                                <ClipboardList className="w-12 h-12 mb-3 text-gray-200" />
                                <p className="text-sm font-medium text-gray-600 mb-1">Bons de commande</p>
                                <p className="text-xs max-w-xs">Sélectionnez un BC dans la liste, ou créez-en un nouveau.</p>
                                <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors">
                                    <Plus className="w-3.5 h-3.5" /> Nouveau BC
                                </button>
                            </div>
                        ) : (
                            // ── DETAIL ────────────────────────────────────────
                            <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                                <div className="px-6 pt-5 pb-0 bg-white border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between mb-3">
                                        <div>
                                            <div className="flex items-center gap-2 mb-1">
                                                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{selected.order_code ?? `#${selected.id}`}</span>
                                                <StatusBadge status={selected.bc_status} />
                                                {detailLoading && <Loader2 className="w-3 h-3 animate-spin text-gray-300" />}
                                            </div>
                                            <h2 className="text-lg font-bold text-gray-900">{selected.partner?.name ?? '—'}</h2>
                                            <p className="text-xs text-gray-500 mt-0.5">{fmtDate(selected.created_at)} · Total {fmtMAD(selected.total_amount)}</p>
                                        </div>
                                    </div>

                                    <SageTabs tabs={TABS} activeTabId={activeTab} onTabChange={handleTabChange} onExpandAll={handleExpandAll} onCollapseAll={handleCollapseAll} className="shadow-none" />
                                </div>

                                <div ref={containerRef} className="flex-1 overflow-y-auto p-4 space-y-3 scroll-smooth bg-slate-50">

                                    {/* ── Convert-to-invoice instrument panel ──── */}
                                    {convertPanelOpen && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">
                                                Instrument requis pour la conversion {convertTarget?.type === 'bl' ? 'du BL' : 'du BC'} en facture ({selected.financial_metadata?.payment_method})
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
                                                        if (!convertTarget) return;
                                                        if (!convertInstrument.reference_number.trim() || !convertInstrument.due_date) { toast.error('Référence et échéance requises'); return; }
                                                        void doConvertToInvoice(convertTarget, convertInstrument);
                                                    }}
                                                    disabled={convertingToInvoice}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white text-xs font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50"
                                                >
                                                    {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    Confirmer la conversion
                                                </button>
                                                <button onClick={() => { setConvertPanelOpen(false); setConvertTarget(null); }} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
                                            </div>
                                        </div>
                                    )}

                                    {selected.bc_status === 'cancelled' && (
                                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-100 border border-gray-200 rounded-lg px-3 py-2">
                                            <Ban className="w-3.5 h-3.5 text-gray-400 shrink-0" /> Bon de commande annulé
                                            {selected.cancellation_reason_code && <span className="text-gray-400">— {selected.cancellation_reason_code}</span>}
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
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Timbre</p>
                                                        <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.financial_metadata?.stamp_duty)}</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Total TTC</p>
                                                        <p className="text-sm font-bold text-gray-900">{fmtMAD(selected.total_amount)}</p>
                                                    </div>
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Mode règlement</p>
                                                        <p className="text-sm font-bold text-gray-900">{PAYMENT_METHODS.find(m => m.value === selected.financial_metadata?.payment_method)?.label ?? '—'}</p>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-1.5 px-1">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                    <p className="text-xs font-medium text-gray-700">{fmtDate(selected.created_at)}</p>
                                                </div>

                                                {((selected.delivery_notes?.length ?? 0) > 0 || (selected.invoices?.length ?? 0) > 0) && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Documents liés</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {selected.delivery_notes?.map(bl => (
                                                                <span key={bl.id} className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1">
                                                                    <Truck className="w-3 h-3 text-gray-400" /> BL #{bl.id} {bl.status && <span className="text-[10px] text-gray-400">({bl.status})</span>}
                                                                </span>
                                                            ))}
                                                            {selected.invoices?.map(inv => (
                                                                <span key={inv.id} className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1">
                                                                    <FileText className="w-3 h-3 text-gray-400" /> {inv.invoice_number ?? `Facture #${inv.id}`}
                                                                </span>
                                                            ))}
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
                                            rightContent={!detailLoading && <span className="text-[10px] text-gray-400 mr-2">{selected.products?.length ?? 0} article(s)</span>}
                                        >
                                            <GcomLinesTable
                                                rows={selected.products ?? []}
                                                rowKey={it => it.pivot.id}
                                                emptyIcon={Package}
                                                columns={[
                                                    { key: 'article', header: 'Article', render: it => <span className="font-medium text-gray-800">{it.name}</span> },
                                                    { key: 'qty', header: 'Qté', align: 'right', width: 'w-16', render: it => <span className="text-gray-600">{fmt(it.pivot.quantity, 0)}</span> },
                                                    { key: 'pu', header: 'P.U. HT', align: 'right', width: 'w-24', render: it => <span className="text-gray-600">{fmtMAD(it.pivot.unit_price_ht)}</span> },
                                                    { key: 'total', header: 'Total TTC', align: 'right', width: 'w-24', render: it => <span className="font-bold text-gray-900">{fmtMAD(it.pivot.total_price)}</span> },
                                                    ...(noDocumentsYet ? [{
                                                        key: 'actions', header: '', align: 'center' as const, width: 'w-16',
                                                        render: (it: GcomOrderProduct) => (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button onClick={() => openUpdateQty(it)} className="text-gray-400 hover:text-sage-600" title="Modifier la quantité">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => openCancelLine(it)} className="text-red-400 hover:text-red-600" title="Annuler la ligne">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ),
                                                    }] : []),
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

            {/* ── Cancel confirm modal ─────────────────────────────────────────── */}
            {cancelTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">
                                {cancelTarget.type === 'order' ? 'Annuler le bon de commande' : 'Annuler la ligne'}
                            </h3>
                        </div>
                        {cancelTarget.type === 'line' && (
                            <p className="text-sm text-gray-600 mb-3"><strong>{cancelTarget.line.name}</strong> (qté actuelle : {fmt(cancelTarget.line.pivot.quantity, 0)})</p>
                        )}
                        {cancelTarget.type === 'line' && (
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Quantité à annuler (vide = ligne entière)</label>
                                <input
                                    type="number" min={1} max={Number(cancelTarget.line.pivot.quantity)}
                                    value={cancelQuantity}
                                    onChange={e => setCancelQuantity(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                />
                            </div>
                        )}
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                            <textarea
                                value={cancelReason}
                                onChange={e => setCancelReason(e.target.value)}
                                rows={2}
                                maxLength={255}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                                placeholder="Le client a annulé sa commande…"
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
                            <button onClick={closeCancelDialog} disabled={cancelling} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Update line quantity modal ──────────────────────────────────── */}
            {updateQtyTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <Edit2 className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Modifier la quantité</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{updateQtyTarget.name}</strong> (quantité actuelle : {fmt(updateQtyTarget.pivot.quantity, 0)})
                        </p>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nouvelle quantité *</label>
                            <input
                                type="number" min={1} autoFocus
                                value={updateQtyValue}
                                onChange={e => setUpdateQtyValue(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmUpdateQty}
                                disabled={updatingQty || updateQtyValue === '' || updateQtyValue <= 0}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {updatingQty ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeUpdateQtyDialog} disabled={updatingQty} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add lines modal ──────────────────────────────────────────────── */}
            {addLineModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-3xl w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-sage-600" />
                            </div>
                            <div>
                                <h3 className="text-base font-semibold text-gray-900">Ajouter des articles</h3>
                                <p className="text-[11px] text-gray-400">{selectedAddLineCount} sélectionné{selectedAddLineCount !== 1 ? 's' : ''}</p>
                            </div>
                        </div>

                        <div className="relative mb-3">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                autoFocus
                                value={addLineSearch}
                                onChange={e => setAddLineSearch(e.target.value)}
                                placeholder="Rechercher un article…"
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>

                        {addLineLoading && addLineRows.length === 0 ? (
                            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
                        ) : (
                            <GcomLinesTable
                                rows={addLineRows}
                                rowKey={p => p.id}
                                emptyLabel="Aucun article trouvé (déjà sur le BC ?)"
                                emptyIcon={Package}
                                columns={[
                                    {
                                        key: 'select', header: '', align: 'center', width: 'w-8',
                                        render: p => (
                                            <input
                                                type="checkbox"
                                                checked={!!addLineSelected[p.id]}
                                                onChange={() => toggleAddLineSelect(p.id)}
                                                className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                            />
                                        ),
                                    },
                                    { key: 'code', header: 'Code', width: 'w-24', render: p => <span className="font-mono font-bold text-indigo-600">{p.code}</span> },
                                    { key: 'article', header: 'Article', render: p => <span className="font-medium text-gray-800">{p.name}</span> },
                                    { key: 'price', header: 'Prix', align: 'right', width: 'w-24', render: p => <span className="text-gray-600">{fmtMAD(p.price)}</span> },
                                    {
                                        key: 'qty', header: 'Qté', align: 'center', width: 'w-16',
                                        render: p => (
                                            <input
                                                type="number" min={1}
                                                value={addLineQuantities[p.id] ?? 1}
                                                onChange={e => setAddLineQty(p.id, parseInt(e.target.value, 10) || 1)}
                                                onFocus={() => { if (!addLineSelected[p.id]) toggleAddLineSelect(p.id); }}
                                                className="w-14 text-center px-1 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            />
                                        ),
                                    },
                                ]}
                            />
                        )}

                        {addLineLastPage > 1 && (
                            <div className="flex items-center justify-center gap-3 mt-2">
                                <button
                                    onClick={() => goToAddLinePage(addLinePage - 1)}
                                    disabled={addLineLoading || addLinePage <= 1}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    ← Précédent
                                </button>
                                <span className="text-[11px] text-gray-400">Page {addLinePage} / {addLineLastPage}</span>
                                <button
                                    onClick={() => goToAddLinePage(addLinePage + 1)}
                                    disabled={addLineLoading || addLinePage >= addLineLastPage}
                                    className="px-2.5 py-1 text-xs font-medium text-gray-600 border border-gray-200 rounded-md hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    Suivant →
                                </button>
                            </div>
                        )}

                        <div className="flex gap-3 mt-5">
                            <button
                                onClick={confirmAddLines}
                                disabled={addingLine || selectedAddLineCount === 0}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {addingLine ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Ajouter {selectedAddLineCount > 0 ? `(${selectedAddLineCount})` : ''}
                            </button>
                            <button onClick={closeAddLineModal} disabled={addingLine} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Convert to BL modal ─────────────────────────────────────────── */}
            {blModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <Truck className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en Bon de Livraison</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-4">
                            <strong>{selected.order_code ?? `#${selected.id}`}</strong> — {selected.partner?.name} — {fmtMAD(selected.total_amount)}
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Date de livraison</label>
                            <input
                                type="date"
                                value={blDeliveryDate}
                                onChange={e => setBlDeliveryDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Mode de règlement</label>
                            <select
                                value={blPaymentMethod}
                                onChange={e => setBlPaymentMethod(e.target.value as GcomPaymentMethod)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                            >
                                {PAYMENT_METHODS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                            </select>
                            {blPaymentMethod !== (selected.financial_metadata?.payment_method ?? blPaymentMethod) && (
                                <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mt-2">
                                    <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                    Changement réel, pas juste une étiquette : le timbre sera recalculé, et passer vers un mode à crédit relance la vérification d'encours du client.
                                </p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmConvertToBl}
                                disabled={convertingToBl}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                            >
                                {convertingToBl ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeConvertToBlModal} disabled={convertingToBl} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors whitespace-nowrap">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Convert to Facture — plain confirmation (no instrument needed) ── */}
            {invoiceConfirmOpen && convertTarget && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en facture</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            Confirmez-vous la conversion {convertTarget.type === 'bl' ? 'du BL' : `du BC ${selected.order_code ?? `#${selected.id}`}`} en facture pour <strong>{selected.partner?.name}</strong>, d'un montant de <strong>{fmtMAD(selected.total_amount)}</strong> ?
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => doConvertToInvoice(convertTarget, null)}
                                disabled={convertingToInvoice}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeInvoiceConfirm} disabled={convertingToInvoice} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
