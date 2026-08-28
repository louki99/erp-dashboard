import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    Truck, Search, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Building2, AlertTriangle, Info, Package,
    FileText, Ban, Calendar, Download, RotateCcw, Layers, Edit2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { GcomCatalogEntryScreen, type GcomCatalogEntrySubmitPayload } from '@/components/gcom/GcomCatalogEntryScreen';
import { GcomLinesTable } from '@/components/gcom/GcomLinesTable';
import { GcomBreadcrumb } from '@/components/gcom/GcomBreadcrumb';
import { PdfPriceModeModal } from '@/components/gcom/PdfPriceModeModal';
import { AvoirAllocationPicker } from '@/components/gcom/AvoirAllocationPicker';
import { ConvertToInvoicePaymentFields } from '@/components/gcom/ConvertToInvoicePaymentFields';
import { avoirAllocationsMatchTotal, avoirAllocationsWithinTotal } from '@/lib/gcom/avoirAllocations';

import { gcomApi } from '@/services/api/gcomApi';
import {
    useNotes, useNote, useNoteReturns, useCreateNote, useConfirmBlDelivery, useCancelNote,
    useUpdateNoteLine, useRemoveNoteLine, useApplyNoteDiscount, useReturnNoteLine,
} from '@/hooks/gcom/useGcomDeliveryNotes';
import { useConvertToInvoice } from '@/hooks/gcom/useGcomOrders';
import { useConsolidateInvoices } from '@/hooks/gcom/useGcomInvoices';
import { getPartners, getPartner, getPaymentTerms } from '@/services/api/partnerApi';
import { masterdataApi, type Bank } from '@/services/api/masterdataApi';
import { productsApi } from '@/services/api/productsApi';
import { usePermissions } from '@/hooks/usePermissions';
import { useGcomParameters } from '@/hooks/useGcomParameters';
import { RETURN_CONDITIONS, RETURN_CONDITION_LABEL } from '@/lib/gcom/returnConditions';
import { RETURN_REASONS, RETURN_REASON_LABEL } from '@/lib/gcom/returnReasons';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
import type {
    GcomDeliveryNote, GcomDeliveryNoteItem, GcomBlStatus, GcomInstrumentInput, GcomPdfPriceMode, GcomReturnCondition, GcomReturnReason, GcomSoucheKind, GcomAvoirAllocation, GcomPaymentMethod,
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
    in_transit: { label: 'En transit', dot: 'bg-amber-500', text: 'text-amber-700' },
    delivered: { label: 'Livré', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    cancelled: { label: 'Annulé', dot: 'bg-gray-400', text: 'text-gray-500' },
};

// 2026-09-01 — same eligibility rule POST /invoices/consolidate itself
// enforces server-side (delivered, not yet invoiced) — checked client-side
// too so the checkbox column never offers a row that would 422.
const isConsolidateEligible = (n: GcomDeliveryNote) => n.status === 'delivered' && !n.invoice_id;

const BL_STATUS_FILTERS: { value: 'all' | GcomBlStatus; label: string }[] = [
    { value: 'all', label: 'Tous' },
    { value: 'in_transit', label: 'En transit' },
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

// ─── Consolidate modal — groups ≥2 BLs from separate orders of the same
// partner into one invoice (2026-09-01, POST /invoices/consolidate). A
// financial mutation, so a modal like every other convert/close/redeem
// action in this codebase, not inline. ─────────────────────────────────────

const ConsolidateModal = ({ notes, onClose, onDone }: { notes: GcomDeliveryNote[]; onClose: () => void; onDone: () => void }) => {
    const partner = notes[0]?.partner ?? null;
    const total = notes.reduce((sum, n) => sum + (Number(n.total_amount) || 0), 0);
    const consolidateInvoices = useConsolidateInvoices();

    // Off by default — payment_method/souche_kind are only REQUIRED when the
    // selected orders disagree; most manual groupings are a single wholesale
    // client whose orders already naturally agree, so the common path needs
    // no override at all. If the API 422s asking for one, confirm() reveals
    // this section automatically rather than leaving the user to guess why.
    const [overrideEnabled, setOverrideEnabled] = useState(false);
    const [method, setMethod] = useState<Exclude<GcomPaymentMethod, 'avoir'>>('cash');
    const [instrument, setInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [instrumentBankOther, setInstrumentBankOther] = useState(false);
    const [banks, setBanks] = useState<Bank[]>([]);
    const [creditTerms, setCreditTerms] = useState<PaymentTermOption[]>([]);
    const [termId, setTermId] = useState<number | null>(null);
    const [soucheKind, setSoucheKind] = useState<GcomSoucheKind>('declared');
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        masterdataApi.banks.getAll().then(setBanks).catch(() => setBanks([]));
        if (partner?.id) {
            getPaymentTerms(partner.id)
                .then(res => {
                    const terms = res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? [];
                    const ct = terms.filter(t => t.is_credit && !t.is_cash);
                    setCreditTerms(ct);
                    const defaultTerm = ct.find(t => t.pivot?.is_default) ?? ct[0] ?? null;
                    setTermId(defaultTerm?.id ?? null);
                })
                .catch(() => setCreditTerms([]));
        }
    }, [partner?.id]);

    const confirm = async () => {
        const needsInstrumentNow = overrideEnabled && (method === 'cheque' || method === 'effet');
        if (needsInstrumentNow && (!instrument.reference_number.trim() || !instrument.due_date)) {
            toast.error('Référence et échéance requises');
            return;
        }
        const needsTermNow = overrideEnabled && (method === 'credit' || method === 'transfer');
        if (needsTermNow && creditTerms.length === 0) {
            toast.error('Aucun terme de paiement à crédit configuré pour ce client');
            return;
        }
        setSubmitting(true);
        try {
            const invoice = await consolidateInvoices.mutateAsync({
                delivery_note_ids: notes.map(n => n.id),
                payment_method: overrideEnabled ? method : undefined,
                payment_term_id: needsTermNow ? termId : undefined,
                instrument: needsInstrumentNow ? instrument : undefined,
                souche_kind: overrideEnabled ? soucheKind : undefined,
            });
            toast.success(`Facture ${invoice.invoice_number ?? `#${invoice.id}`} créée — ${notes.length} BL consolidés`);
            onDone();
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la consolidation');
            if (!overrideEnabled) setOverrideEnabled(true);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4 max-h-[85vh] overflow-y-auto">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center">
                        <Layers className="w-4 h-4 text-indigo-600" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Consolider en une facture</h3>
                        <p className="text-xs text-gray-500">{partner?.name ?? '—'} — {notes.length} bons de livraison</p>
                    </div>
                </div>

                <div className="bg-gray-50 rounded-lg border border-gray-100 divide-y divide-gray-100 mb-3 max-h-40 overflow-y-auto">
                    {notes.map(n => (
                        <div key={n.id} className="flex items-center justify-between px-3 py-1.5 text-xs">
                            <span className="font-mono text-indigo-600">{n.delivery_number ?? `#${n.id}`}</span>
                            <span className="text-gray-600">{fmtMAD(n.total_amount)}</span>
                        </div>
                    ))}
                </div>
                <p className="text-sm text-gray-700 font-semibold mb-4">Total : {fmtMAD(total)}</p>

                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer mb-3">
                    <input
                        type="checkbox"
                        checked={overrideEnabled}
                        onChange={e => setOverrideEnabled(e.target.checked)}
                        className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                    />
                    Forcer un mode de règlement (sinon détecté automatiquement si les commandes sont d'accord)
                </label>

                {overrideEnabled && (
                    <div className="space-y-3 mb-4 bg-amber-50 border border-amber-200 rounded-lg p-3">
                        <ConvertToInvoicePaymentFields
                            invoicingMode={null}
                            method={method}
                            onMethodChange={setMethod}
                            instrument={instrument}
                            onInstrumentChange={setInstrument}
                            banks={banks}
                            bankOther={instrumentBankOther}
                            onBankOtherChange={setInstrumentBankOther}
                            creditTerms={creditTerms}
                            termId={termId}
                            onTermIdChange={setTermId}
                            soucheKind={soucheKind}
                            onSoucheKindChange={setSoucheKind}
                            mixAvoirEnabled={false}
                            onMixAvoirEnabledChange={() => {}}
                            avoirAllocations={[]}
                            onAvoirAllocationsChange={() => {}}
                            partnerId={partner?.id ?? null}
                            total={total}
                            hideAvoirMix
                        />
                    </div>
                )}

                <div className="flex gap-3">
                    <button
                        onClick={confirm}
                        disabled={submitting}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                    >
                        {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Consolider
                    </button>
                    <button onClick={onClose} disabled={submitting} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };

// ─── Component ───────────────────────────────────────────────────────────────

export default function BonLivraisonPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // 2026-09-01 — BL editing gating. See BonCommandePage.tsx's identical
    // comment for the usePermissions/admin-bypass rationale.
    const { has } = usePermissions();
    const canPriceOverride = has('gcom-price-override');
    const canDiscountLine = has('gcom-discount-line');
    const canDiscountGlobal = has('gcom-discount-global');
    const canEditBl = has('gcom-delivery-note-edit');
    const { maxDiscountPercent } = useGcomParameters();

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
    // NOT switched to listView() — ConsolidateModal needs partner.id, which the
    // lean projection doesn't carry (see useNotes' own comment).
    const notesQuery = useNotes({
        partner_id: partnerFilter?.id,
        status: blStatusFilter === 'all' ? undefined : blStatusFilter,
    });
    const notes = useMemo(() => notesQuery.data?.pages.flatMap(p => p.data) ?? [], [notesQuery.data]);
    const loading = notesQuery.isLoading || notesQuery.isFetchingNextPage;
    const total = notesQuery.data?.pages[0]?.total ?? 0;
    const loadMore = () => notesQuery.fetchNextPage();

    // ── Consolidate (2026-09-01) — pick ≥2 delivered/uninvoiced BLs from the
    // same partner and group them into one invoice. A distinct selection from
    // the single-row `selected` used for the detail view — a checkbox column
    // (not the grid's own row-selection, which stays "single" for detail
    // click-through), same manual Set<id> pattern as PortefeuilleInstrumentsPage's
    // batch-deposit selection. ─────────────────────────────────────────────
    const [consolidateIds, setConsolidateIds] = useState<Set<number>>(new Set());
    const [consolidateModalOpen, setConsolidateModalOpen] = useState(false);
    // Selection doesn't survive a filter change/reload — the underlying id
    // set may no longer be visible, and a stale count would be misleading.
    useEffect(() => { setConsolidateIds(new Set()); }, [partnerFilter, blStatusFilter]);

    const toggleConsolidateRow = (note: GcomDeliveryNote) => {
        if (!isConsolidateEligible(note)) return;
        setConsolidateIds(prev => {
            if (prev.has(note.id)) {
                const next = new Set(prev);
                next.delete(note.id);
                return next;
            }
            if (prev.size > 0) {
                const firstSelected = notes.find(n => prev.has(n.id));
                if (firstSelected && firstSelected.partner?.id !== note.partner?.id) {
                    toast.error('Sélectionnez des bons de livraison du même client uniquement.');
                    return prev;
                }
            }
            const next = new Set(prev);
            next.add(note.id);
            return next;
        });
    };

    const consolidateNotes = useMemo(() => notes.filter(n => consolidateIds.has(n.id)), [notes, consolidateIds]);
    const consolidateTotal = consolidateNotes.reduce((sum, n) => sum + (Number(n.total_amount) || 0), 0);

    // "Select all" — scoped to one partner, same as the per-row guard: picks
    // up the currently selected partner (if any) or the first eligible row's,
    // so it stays correct even when the list isn't filtered to one client.
    // Typical use: filter by client, then select all in one click.
    const eligibleNotes = useMemo(() => notes.filter(isConsolidateEligible), [notes]);
    const selectAllTargetPartnerId = consolidateNotes[0]?.partner?.id ?? eligibleNotes[0]?.partner?.id ?? null;
    const eligibleForSelectAll = useMemo(
        () => selectAllTargetPartnerId == null ? [] : eligibleNotes.filter(n => n.partner?.id === selectAllTargetPartnerId),
        [eligibleNotes, selectAllTargetPartnerId],
    );
    const allEligibleSelected = eligibleForSelectAll.length > 0 && eligibleForSelectAll.every(n => consolidateIds.has(n.id));
    const toggleAllConsolidate = () => {
        setConsolidateIds(allEligibleSelected ? new Set() : new Set(eligibleForSelectAll.map(n => n.id)));
    };

    // ── Selection / detail ───────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'create'>('view');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const noteDetailQuery = useNote(selectedId);
    const selected = noteDetailQuery.data ?? null;
    const detailLoading = noteDetailQuery.isLoading;

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

    const returnsQuery = useNoteReturns(selectedId);
    const returns = returnsQuery.data ?? [];
    const returnsLoading = returnsQuery.isLoading;

    // List-row sync (Statut/Facturé staying current after a mutation) now
    // comes from invalidating both noteKeys.list and noteKeys.detail on every
    // mutation's onSuccess, not a manual setNotes patch here.
    const selectNote = useCallback((row: { id: number }) => {
        setFormMode('view');
        setActiveTab('informations');
        setSelectedId(row.id);
    }, []);

    const handleManualRefresh = () => {
        notesQuery.refetch();
        noteDetailQuery.refetch();
        returnsQuery.refetch();
    };

    // Delivery-note items only carry `product_id` (verified live — no nested
    // `product` object, unlike the returns list which does), so line/return
    // tables fell back to a raw "Produit #id" label. Resolve real
    // code/name for whatever product ids show up on the currently-viewed
    // BL, caching across selections since the catalog is stable within a
    // session.
    const [productNames, setProductNames] = useState<Record<number, { code: string; name: string }>>({});
    useEffect(() => {
        const ids = Array.from(new Set((selected?.items ?? []).map(it => it.product_id))).filter(id => !(id in productNames));
        if (ids.length === 0) return;
        (async () => {
            const results = await Promise.all(ids.map(async id => {
                try {
                    const res = await productsApi.getDetail(id);
                    return [id, { code: res.data.product.code, name: res.data.product.name }] as const;
                } catch {
                    return [id, null] as const;
                }
            }));
            setProductNames(prev => {
                const next = { ...prev };
                for (const [id, info] of results) if (info) next[id] = info;
                return next;
            });
        })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected?.items]);
    const productLabel = (productId: number) => {
        const info = productNames[productId];
        return info ? `${info.name}${info.code ? ` (${info.code})` : ''}` : `Produit #${productId}`;
    };

    // Deep-link from another GCOM document's "Documents liés" chip (?id=123).
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) selectNote({ id });
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
            if (url) window.open(url, '_blank');
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
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le bon de retour');
        } finally {
            setReturnPdfLoadingId(null);
        }
    };

    const openCreate = () => setFormMode('create');

    const createNote = useCreateNote();

    const handleCreateNoteSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomDeliveryNote> => {
        try {
            const note = await createNote.mutateAsync({
                partner_id: payload.partner_id,
                items: payload.items,
                payment_method: payload.payment_method,
                payment_term_id: payload.payment_term_id,
                notes: payload.notes,
                delivery_date: payload.delivery_date,
                client_order_ref: payload.client_order_ref,
                salesperson_id: payload.salesperson_id,
                driver_info: payload.driver_info,
                transporter_name: payload.transporter_name,
                status: payload.status,
                global_discount_percent: payload.global_discount_percent,
                global_discount_amount: payload.global_discount_amount,
            });
            toast.success(note.status === 'delivered' ? 'Bon de livraison créé — livré' : 'Bon de livraison créé — en transit');
            return note;
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            throw new Error(msg ?? 'Erreur lors de la création du BL');
        }
    };

    const handleNoteCreated = (note: GcomDeliveryNote) => {
        setFormMode('view');
        selectNote(note);
    };

    // ── Confirmer la livraison (2026-08-29) — in_transit → delivered ────────
    const [confirmingDelivery, setConfirmingDelivery] = useState(false);
    const confirmBlDeliveryMutation = useConfirmBlDelivery();
    const confirmDelivery = async () => {
        if (!selected) return;
        setConfirmingDelivery(true);
        try {
            await confirmBlDeliveryMutation.mutateAsync({ blId: selected.id, orderId: selected.order_id });
            toast.success('Livraison confirmée');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la confirmation de livraison');
        } finally {
            setConfirmingDelivery(false);
        }
    };

    // ── Convert to Facture ───────────────────────────────────────────────────
    const [convertPanelOpen, setConvertPanelOpen] = useState(false); // instrument required (cheque/effet)
    const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false); // plain confirmation otherwise
    const [convertAvoirPanelOpen, setConvertAvoirPanelOpen] = useState(false); // payment_method === 'avoir'
    const [convertAvoirAllocations, setConvertAvoirAllocations] = useState<GcomAvoirAllocation[]>([]);
    // Optional avoir mix (2026-08-20) — the avoir covers PART of the total,
    // the BL's own payment_method settles the rest. Reuses
    // convertAvoirAllocations (mutually exclusive with the exact-avoir panel
    // by payment method).
    const [convertMixAvoirEnabled, setConvertMixAvoirEnabled] = useState(false);
    // payment_method override (2026-08-20) — ONLY meaningful inside the
    // exact-avoir panel (BL's stored payment_method === 'avoir'): when the
    // available avoir doesn't cover 100%, this is the one way to still
    // convert — override to cash/card for the remainder. '' = no override.
    const [convertAvoirOverrideMethod, setConvertAvoirOverrideMethod] = useState<'' | 'cash' | 'card'>('');
    const [convertInstrument, setConvertInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [convertingToInvoice, setConvertingToInvoice] = useState(false);
    // §17 — explicit override, 'declared' is the safe/common default.
    const [convertSoucheKind, setConvertSoucheKind] = useState<GcomSoucheKind>('declared');
    // 2026-08-21 — the partner's billing mode (per-order/BL consolidation,
    // periodic fin-de-mois) isn't embedded on the order/BL payload itself,
    // so it's fetched once when the conversion flow opens. 1_FAC_PER_ORDER
    // doesn't support an explicit souche_kind or payment_method override yet
    // (backend either 422s or, verified live 2026-08-21, silently swaps the
    // souche to its own default instead of honoring ours — hide both
    // controls rather than risk a declared/internal mismatch the user never
    // asked for). PERIODIC_FIN_DE_MOIS never allows manual conversion at
    // all — blocked at openConvertToInvoice, before any modal opens.
    const [convertInvoicingMode, setConvertInvoicingMode] = useState<'1_FAC_PER_BL' | '1_FAC_PER_ORDER' | 'PERIODIC_FIN_DE_MOIS' | null>(null);
    const [convertModeChecking, setConvertModeChecking] = useState(false);
    // 2026-09-01 — generalized payment_method override at convert-to-invoice:
    // any real method (cash/card/cheque/effet/credit/transfer, avoir excluded
    // — that's the separate avoir_allocations mechanism above) can now be
    // swapped in regardless of what the BL was originally created with.
    // Defaults to the BL's own stored method (openConvertToInvoice) so the
    // common "no change" path never sends an override. Not offered at all
    // for 1_FAC_PER_ORDER (doc: "not supported at all yet for this mode",
    // matches the souche_kind restriction already gated on the same flag).
    const [convertMethodOverride, setConvertMethodOverride] = useState<Exclude<GcomPaymentMethod, 'avoir'>>('cash');
    const [convertOverrideCreditTerms, setConvertOverrideCreditTerms] = useState<PaymentTermOption[]>([]);
    const [convertOverrideTermId, setConvertOverrideTermId] = useState<number | null>(null);
    // Bank dropdown for the instrument's bank_name (GET /masterdata/banks) —
    // falls back to free text if the list is empty or the bank isn't listed.
    const [banks, setBanks] = useState<Bank[]>([]);
    const [convertInstrumentBankOther, setConvertInstrumentBankOther] = useState(false);
    useEffect(() => { masterdataApi.banks.getAll().then(setBanks).catch(() => setBanks([])); }, []);

    const openConvertToInvoice = async () => {
        if (!selected) return;
        setConvertSoucheKind('declared');
        setConvertAvoirAllocations([]);
        setConvertMixAvoirEnabled(false);
        setConvertAvoirOverrideMethod('');
        setConvertInvoicingMode(null);
        setConvertOverrideCreditTerms([]);
        setConvertOverrideTermId(null);
        const method: GcomPaymentMethod = selected.order_payment_method ?? 'cash';
        // The method-override selector never offers 'avoir' (see
        // ConvertToInvoicePaymentFields) — an avoir-stored document takes the
        // separate avoir panel branch below instead, where this state is unused.
        setConvertMethodOverride(method === 'avoir' ? 'cash' : method);
        if (selected.partner?.id) {
            setConvertModeChecking(true);
            try {
                const [{ partner }, termsRes] = await Promise.all([
                    getPartner(selected.partner.id),
                    getPaymentTerms(selected.partner.id).catch(() => null),
                ]);
                const mode = partner.invoicing_mode ?? '1_FAC_PER_BL';
                if (mode === 'PERIODIC_FIN_DE_MOIS') {
                    toast.error('Ce client est facturé automatiquement en fin de mois — pas de conversion manuelle possible pour ce BL.');
                    return;
                }
                setConvertInvoicingMode(mode);
                if (termsRes) {
                    const terms = termsRes.partner?.paymentTerms ?? termsRes.partner?.payment_terms ?? termsRes.availableTerms ?? termsRes.available_terms ?? [];
                    const creditTerms = terms.filter(t => t.is_credit && !t.is_cash);
                    setConvertOverrideCreditTerms(creditTerms);
                    const defaultTerm = creditTerms.find(t => t.pivot?.is_default) ?? creditTerms[0] ?? null;
                    setConvertOverrideTermId(defaultTerm?.id ?? null);
                }
            } catch {
                // Partner fetch failing shouldn't block the conversion itself —
                // fall back to the default (unrestricted) behavior.
            } finally {
                setConvertModeChecking(false);
            }
        }
        const needsInstrument = method === 'cheque' || method === 'effet';
        if (needsInstrument) {
            setConvertInstrument(EMPTY_INSTRUMENT);
            setConvertInstrumentBankOther(false);
            setConvertPanelOpen(true);
        } else if (method === 'avoir') {
            setConvertAvoirPanelOpen(true);
        } else {
            setInvoiceConfirmOpen(true);
        }
    };
    const closeInvoiceConfirm = () => setInvoiceConfirmOpen(false);
    const convertToInvoice = useConvertToInvoice();

    const doConvertToInvoice = async (instrument: GcomInstrumentInput | null, avoirAllocations?: GcomAvoirAllocation[], paymentMethodOverride?: Exclude<GcomPaymentMethod, 'avoir'>, paymentTermId?: number | null) => {
        if (!selected) return;
        setConvertingToInvoice(true);
        try {
            // 1_FAC_PER_ORDER doesn't support an explicit souche_kind or
            // payment_method override yet — let backend pick its own defaults
            // rather than risk a silent mismatch.
            const soucheKindArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : convertSoucheKind;
            const overrideArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : paymentMethodOverride;
            const termIdArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : paymentTermId;
            const invoice = await convertToInvoice.mutateAsync({
                target: { type: 'bl', id: selected.id }, instrument, soucheKind: soucheKindArg, avoirAllocations,
                paymentMethodOverride: overrideArg, paymentTermId: termIdArg,
            });
            toast.success(`Facture ${invoice.invoice_number ?? `#${invoice.id}`} créée${invoice.souche_kind === 'internal' ? ' (souche interne)' : ''}`);
            setConvertPanelOpen(false);
            setInvoiceConfirmOpen(false);
            setConvertAvoirPanelOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en facture');
        } finally {
            setConvertingToInvoice(false);
        }
    };

    // Shared submit for both the "instrument panel" and "plain confirm modal"
    // — both now render the same ConvertToInvoicePaymentFields, so both need
    // the same validation/dispatch based on the currently selected
    // convertMethodOverride, not which panel happened to open by default.
    const confirmConvertToInvoice = () => {
        if (!selected) return;
        const total = Number(selected.total_amount) || 0;
        const needsInstrumentNow = convertMethodOverride === 'cheque' || convertMethodOverride === 'effet';
        if (needsInstrumentNow && (!convertInstrument.reference_number.trim() || !convertInstrument.due_date)) {
            toast.error('Référence et échéance requises');
            return;
        }
        const needsTermNow = convertMethodOverride === 'credit' || convertMethodOverride === 'transfer';
        if (needsTermNow && convertOverrideCreditTerms.length === 0) {
            toast.error('Aucun terme de paiement à crédit configuré pour ce client');
            return;
        }
        if (convertMixAvoirEnabled && !avoirAllocationsWithinTotal(convertAvoirAllocations, total)) {
            toast.error('Le total des avoirs sélectionnés dépasse le montant de la vente');
            return;
        }
        const storedMethod = selected.order_payment_method ?? 'cash';
        const methodChanged = convertMethodOverride !== storedMethod;
        void doConvertToInvoice(
            needsInstrumentNow ? convertInstrument : null,
            convertMixAvoirEnabled && convertAvoirAllocations.length > 0 ? convertAvoirAllocations : undefined,
            methodChanged ? convertMethodOverride : undefined,
            needsTermNow ? convertOverrideTermId : undefined,
        );
    };

    // ── Cancellation (restocks) ──────────────────────────────────────────────
    const [cancelOpen, setCancelOpen] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelling, setCancelling] = useState(false);

    const openCancel = () => { setCancelOpen(true); setCancelReason(''); };
    const closeCancel = () => setCancelOpen(false);
    const cancelNote = useCancelNote();

    const confirmCancel = async () => {
        if (!selected || !cancelReason.trim()) { toast.error('Motif requis'); return; }
        setCancelling(true);
        try {
            await cancelNote.mutateAsync({ id: selected.id, payload: { reason: cancelReason.trim() } });
            toast.success('Bon de livraison annulé — stock réintégré');
            setCancelOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation");
        } finally {
            setCancelling(false);
        }
    };

    // ── BL line editing (2026-09-01) — distinct from the CAS-1 return below:
    // a plain pre-invoice correction (data-entry mistake), no DeliveryNoteReturn
    // row. Only offered when invoice_id is null and status is in_transit/
    // delivered (a draft BL has no stock deducted yet — see canEditBlLine).
    // addLine is deliberately NOT wired up here — live-verified 500 on this
    // tenant regardless of payload, reported to backend, not shipped until
    // confirmed fixed. ─────────────────────────────────────────────────────
    const [updateLineTarget, setUpdateLineTarget] = useState<GcomDeliveryNoteItem | null>(null);
    const [updateLineQty, setUpdateLineQty] = useState<number | ''>('');
    const [updateLineUnitPrice, setUpdateLineUnitPrice] = useState<number | ''>('');
    const [updateLineDiscountMode, setUpdateLineDiscountMode] = useState<'' | 'percent' | 'amount'>('');
    const [updateLineDiscountValue, setUpdateLineDiscountValue] = useState<number | ''>('');
    const [updatingLine, setUpdatingLine] = useState(false);

    const openUpdateLine = (item: GcomDeliveryNoteItem) => {
        setUpdateLineTarget(item);
        setUpdateLineQty(Number(item.delivered_quantity ?? item.ordered_quantity));
        setUpdateLineUnitPrice('');
        setUpdateLineDiscountMode('');
        setUpdateLineDiscountValue('');
    };
    const closeUpdateLine = () => setUpdateLineTarget(null);
    const updateNoteLine = useUpdateNoteLine();

    const confirmUpdateLine = async () => {
        if (!updateLineTarget || !selected || updateLineQty === '' || updateLineQty <= 0) { toast.error('Quantité invalide'); return; }
        setUpdatingLine(true);
        try {
            await updateNoteLine.mutateAsync({
                id: selected.id,
                itemId: updateLineTarget.id,
                payload: {
                    quantity: updateLineQty,
                    unit_price: canPriceOverride && updateLineUnitPrice !== '' ? updateLineUnitPrice : undefined,
                    discount_percent: canDiscountLine && updateLineDiscountMode === 'percent' && updateLineDiscountValue !== '' ? updateLineDiscountValue : undefined,
                    discount_amount: canDiscountLine && updateLineDiscountMode === 'amount' && updateLineDiscountValue !== '' ? updateLineDiscountValue : undefined,
                },
            });
            toast.success('Ligne mise à jour — stock ajusté');
            setUpdateLineTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la mise à jour de la ligne');
        } finally {
            setUpdatingLine(false);
        }
    };

    const [removeLineTarget, setRemoveLineTarget] = useState<GcomDeliveryNoteItem | null>(null);
    const [removeLineReason, setRemoveLineReason] = useState('');
    const [removingLine, setRemovingLine] = useState(false);

    const openRemoveLine = (item: GcomDeliveryNoteItem) => { setRemoveLineTarget(item); setRemoveLineReason(''); };
    const closeRemoveLine = () => setRemoveLineTarget(null);
    const removeNoteLine = useRemoveNoteLine();

    const confirmRemoveLine = async () => {
        if (!removeLineTarget || !selected || !removeLineReason.trim()) { toast.error('Motif requis'); return; }
        setRemovingLine(true);
        try {
            await removeNoteLine.mutateAsync({ id: selected.id, itemId: removeLineTarget.id, payload: { reason: removeLineReason.trim() } });
            toast.success('Ligne supprimée — stock réintégré');
            setRemoveLineTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la suppression de la ligne');
        } finally {
            setRemovingLine(false);
        }
    };

    // ── BL global discount (2026-09-01) — can be renegotiated any number of
    // times, backend always redistributes from each line's stable
    // pre-discount price, never compounds. `{}` clears it entirely. ───────
    const [discountModalOpen, setDiscountModalOpen] = useState(false);
    const [discountMode, setDiscountMode] = useState<'percent' | 'amount'>('percent');
    const [discountValue, setDiscountValue] = useState<number | ''>('');
    const [applyingDiscount, setApplyingDiscount] = useState(false);

    const openDiscountModal = () => {
        if (!selected) return;
        if (selected.global_discount_percent != null) { setDiscountMode('percent'); setDiscountValue(Number(selected.global_discount_percent)); }
        else if (selected.global_discount_amount != null) { setDiscountMode('amount'); setDiscountValue(Number(selected.global_discount_amount)); }
        else { setDiscountMode('percent'); setDiscountValue(''); }
        setDiscountModalOpen(true);
    };
    const closeDiscountModal = () => setDiscountModalOpen(false);
    const applyNoteDiscount = useApplyNoteDiscount();

    const confirmApplyDiscount = async () => {
        if (!selected || discountValue === '' || discountValue <= 0) { toast.error('Valeur invalide'); return; }
        setApplyingDiscount(true);
        try {
            await applyNoteDiscount.mutateAsync({
                id: selected.id,
                payload: {
                    global_discount_percent: discountMode === 'percent' ? discountValue : undefined,
                    global_discount_amount: discountMode === 'amount' ? discountValue : undefined,
                },
            });
            toast.success('Remise globale appliquée');
            setDiscountModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'application de la remise");
        } finally {
            setApplyingDiscount(false);
        }
    };

    const clearDiscount = async () => {
        if (!selected) return;
        setApplyingDiscount(true);
        try {
            await applyNoteDiscount.mutateAsync({ id: selected.id, payload: {} });
            toast.success('Remise globale retirée');
            setDiscountModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors du retrait de la remise');
        } finally {
            setApplyingDiscount(false);
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
    const returnNoteLine = useReturnNoteLine();

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
            const label = productLabel(it.product_id);
            if (qty > currentQty) {
                failures.push(`${label} : quantité invalide (doit être ≤ ${fmt(currentQty, 0)})`);
                continue;
            }
            if (!reason) {
                failures.push(`${label} : motif requis`);
                continue;
            }
            try {
                await returnNoteLine.mutateAsync({
                    id: selected.id,
                    itemId: it.id,
                    payload: { quantity: qty, reason, condition: returnBatchCondition[it.id] ?? 'sellable' },
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
            // DataGrid's own defaultColDef enforces minWidth: 100 — must be
            // overridden per-column here, otherwise width alone is ignored.
            headerName: '', width: 32, minWidth: 32, maxWidth: 32, pinned: 'left' as const, sortable: false, resizable: false, filter: false,
            headerComponent: () => (
                <div className="flex items-center justify-center h-full" title="Tout sélectionner (client courant)">
                    <input
                        type="checkbox"
                        checked={allEligibleSelected}
                        onChange={toggleAllConsolidate}
                        disabled={eligibleForSelectAll.length === 0}
                        className="w-3.5 h-3.5 rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                    />
                </div>
            ),
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote>) => {
                if (!p.data || !isConsolidateEligible(p.data)) return <span className="flex items-center justify-center h-full text-gray-300 text-xs">—</span>;
                return (
                    <div className="flex items-center justify-center h-full" onClick={e => e.stopPropagation()}>
                        <input
                            type="checkbox"
                            checked={consolidateIds.has(p.data.id)}
                            onChange={() => toggleConsolidateRow(p.data!)}
                            title="Sélectionner pour consolidation"
                            className="w-3.5 h-3.5 rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                        />
                    </div>
                );
            },
        },
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
            filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote>) => p.data ? <StatusBadge status={p.data.status} /> : null,
        },
        {
            colId: 'facture', headerName: 'Facturé', width: 90,
            filter: 'agTextColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomDeliveryNote>) => (p.data?.invoice_id ? 'Oui' : 'Non'),
            cellRenderer: (p: ICellRendererParams<GcomDeliveryNote, string>) => (
                <span className={`inline-flex items-center gap-1 text-[11px] font-medium ${p.value === 'Oui' ? 'text-emerald-700' : 'text-gray-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${p.value === 'Oui' ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {p.value}
                </span>
            ),
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [consolidateIds, allEligibleSelected, eligibleForSelectAll]);

    // ── Action panel ──────────────────────────────────────────────────────────

    // 2026-08-29: a BL is born in_transit now — only 'delivered' can be
    // invoiced or partially returned (returning implies delivery already
    // happened). Cancel works from both in_transit and delivered, per
    // backend confirmation — never invoice-gated only, status!=='cancelled'.
    const canConfirmDelivery = selected?.status === 'in_transit';
    const canConvertToInvoice = selected?.status === 'delivered' && !selected.invoice_id;
    const canCancel = (selected?.status === 'in_transit' || selected?.status === 'delivered') && !selected.invoice_id;
    const canReturn = canConvertToInvoice && (selected?.items ?? []).some(it => currentLineQty(it) > 0);
    // 2026-09-01 — same guard the backend enforces: invoice_id IS NULL and
    // status in_transit/delivered (a draft BL has no stock deducted yet).
    const canEditBlLine = canEditBl && !selected?.invoice_id && (selected?.status === 'in_transit' || selected?.status === 'delivered');

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau BL', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: handleManualRefresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [
            { icon: Download, label: 'Imprimer', variant: 'default', onClick: () => setPdfModalOpen(true) },
        ];
        if (canConfirmDelivery) {
            detailItems.push({ icon: CheckCircle2, label: 'Confirmer la livraison', variant: 'primary', onClick: confirmDelivery, disabled: confirmingDelivery });
        }
        if (canReturn) {
            detailItems.push({ icon: RotateCcw, label: 'Effectuer un retour partiel', variant: 'warning', onClick: openReturnBatch });
        }
        if (canConvertToInvoice) {
            detailItems.push({ icon: FileText, label: 'Convertir en Facture', variant: 'primary', onClick: openConvertToInvoice, disabled: convertingToInvoice || convertModeChecking });
        }
        if (canCancel) {
            detailItems.push({ icon: Ban, label: 'Annuler le BL', variant: 'danger', onClick: openCancel });
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, canConfirmDelivery, canConvertToInvoice, canCancel, canReturn, loading, convertingToInvoice, convertModeChecking, confirmingDelivery]);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    if (formMode === 'create') {
        return (
            <GcomCatalogEntryScreen<GcomDeliveryNote>
                submitLabel="Créer le BL"
                submitIcon={Truck}
                needsInstrumentAtSubmit={false}
                showDeliveryDateField
                onSubmit={handleCreateNoteSubmit}
                onSubmitted={handleNoteCreated}
                cancelActionItem={{ icon: X, label: 'Annuler', variant: 'warning', onClick: () => setFormMode('view') }}
                enableNegotiation
                canPriceOverride={canPriceOverride}
                canDiscountLine={canDiscountLine}
                canDiscountGlobal={canDiscountGlobal}
                draftKey="gcom-bl-create"
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
                                onRowClicked={e => { if (e.data) { selectNote(e.data); navigate(`/gcom/bons-livraison?id=${e.data.id}`, { replace: true }); } }}
                                defaultSelectedIds={row => row.id === selected?.id}
                            />
                        </div>

                        {consolidateIds.size > 0 && (
                            <div className="shrink-0 border-t border-indigo-100 bg-indigo-50 px-3 py-2 flex items-center justify-between gap-2">
                                <div className="min-w-0">
                                    <p className="text-[11px] font-semibold text-indigo-800">{consolidateIds.size} sélectionné(s) — {fmtMAD(consolidateTotal)}</p>
                                    <button onClick={() => setConsolidateIds(new Set())} className="text-[10px] text-indigo-500 hover:underline">Vider la sélection</button>
                                </div>
                                <button
                                    onClick={() => setConsolidateModalOpen(true)}
                                    disabled={consolidateIds.size < 2}
                                    title={consolidateIds.size < 2 ? 'Sélectionnez au moins 2 bons de livraison' : undefined}
                                    className="shrink-0 flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                >
                                    <Layers className="w-3.5 h-3.5" /> Consolider
                                </button>
                            </div>
                        )}

                        {notesQuery.hasNextPage && (
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
                        <GcomBreadcrumb
                            section="Ventes"
                            page={{ label: 'Bons de livraison', icon: Truck, onClick: () => setSelectedId(null) }}
                            current={selected ? { label: selected.delivery_number ?? `#${selected.id}` } : null}
                        />
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

                                    {/* ── Convert-to-invoice panel (instrument-first entry, but any method can be picked) ──── */}
                                    {convertPanelOpen && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">Conversion en facture</p>
                                            <ConvertToInvoicePaymentFields
                                                invoicingMode={convertInvoicingMode}
                                                method={convertMethodOverride}
                                                onMethodChange={setConvertMethodOverride}
                                                instrument={convertInstrument}
                                                onInstrumentChange={setConvertInstrument}
                                                banks={banks}
                                                bankOther={convertInstrumentBankOther}
                                                onBankOtherChange={setConvertInstrumentBankOther}
                                                creditTerms={convertOverrideCreditTerms}
                                                termId={convertOverrideTermId}
                                                onTermIdChange={setConvertOverrideTermId}
                                                soucheKind={convertSoucheKind}
                                                onSoucheKindChange={setConvertSoucheKind}
                                                mixAvoirEnabled={convertMixAvoirEnabled}
                                                onMixAvoirEnabledChange={setConvertMixAvoirEnabled}
                                                avoirAllocations={convertAvoirAllocations}
                                                onAvoirAllocationsChange={setConvertAvoirAllocations}
                                                partnerId={selected.partner?.id ?? null}
                                                total={Number(selected.total_amount) || 0}
                                            />

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={confirmConvertToInvoice}
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

                                    {/* ── Convert-to-invoice avoir panel ──── */}
                                    {convertAvoirPanelOpen && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">Règlement par avoir pour la conversion du BL en facture</p>
                                            <AvoirAllocationPicker
                                                partnerId={selected.partner?.id ?? null}
                                                total={Number(selected.total_amount) || 0}
                                                value={convertAvoirAllocations}
                                                onChange={setConvertAvoirAllocations}
                                                mode={convertAvoirOverrideMethod ? 'partial' : 'exact'}
                                            />

                                            {/* payment_method override (2026-08-20) — the avoir alone doesn't have
                                                to cover 100%; switching this on lets the remainder be settled in
                                                cash/card instead of requiring an exact avoir match. Not supported
                                                yet for 1_FAC_PER_ORDER (backend 422s it) — the avoir must cover
                                                100% of this BL's total in that mode. */}
                                            {convertInvoicingMode === '1_FAC_PER_ORDER' ? (
                                                <p className="text-[10px] text-gray-400 italic pt-1 border-t border-amber-100">Le reliquat espèces/carte n'est pas encore disponible pour ce mode de facturation — l'avoir doit couvrir 100% du montant.</p>
                                            ) : (
                                                <div className="space-y-1.5 pt-1 border-t border-amber-100">
                                                    <p className="text-[11px] text-gray-500">L'avoir ne couvre pas tout ? Réglez le reliquat par :</p>
                                                    <div className="flex gap-1.5">
                                                        <button
                                                            onClick={() => setConvertAvoirOverrideMethod('')}
                                                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                                                !convertAvoirOverrideMethod ? 'bg-gray-700 border-gray-700 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            Avoir seul (100%)
                                                        </button>
                                                        <button
                                                            onClick={() => setConvertAvoirOverrideMethod('cash')}
                                                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                                                convertAvoirOverrideMethod === 'cash' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            Espèces
                                                        </button>
                                                        <button
                                                            onClick={() => setConvertAvoirOverrideMethod('card')}
                                                            className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                                                convertAvoirOverrideMethod === 'card' ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                            }`}
                                                        >
                                                            Carte
                                                        </button>
                                                    </div>
                                                </div>
                                            )}

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        const total = Number(selected.total_amount) || 0;
                                                        const ok = convertAvoirOverrideMethod
                                                            ? avoirAllocationsWithinTotal(convertAvoirAllocations, total)
                                                            : avoirAllocationsMatchTotal(convertAvoirAllocations, total);
                                                        if (!ok) {
                                                            toast.error(convertAvoirOverrideMethod
                                                                ? 'Le total des avoirs sélectionnés dépasse le montant de la vente'
                                                                : 'Le total des avoirs sélectionnés doit correspondre exactement au montant de la vente (ou choisissez un mode de règlement pour le reliquat)');
                                                            return;
                                                        }
                                                        void doConvertToInvoice(null, convertAvoirAllocations, convertAvoirOverrideMethod || undefined);
                                                    }}
                                                    disabled={convertingToInvoice || (convertAvoirOverrideMethod
                                                        ? !avoirAllocationsWithinTotal(convertAvoirAllocations, Number(selected.total_amount) || 0)
                                                        : !avoirAllocationsMatchTotal(convertAvoirAllocations, Number(selected.total_amount) || 0))}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white text-xs font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50"
                                                >
                                                    {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    Confirmer
                                                </button>
                                                <button onClick={() => setConvertAvoirPanelOpen(false)} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
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

                                                {canEditBlLine && canDiscountGlobal && (
                                                    <div className="flex items-center justify-between bg-white rounded-lg p-3 border border-gray-100">
                                                        <div>
                                                            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Remise globale</p>
                                                            {selected.global_discount_percent != null ? (
                                                                <p className="text-sm font-semibold text-amber-700">-{fmt(selected.global_discount_percent, 0)}%</p>
                                                            ) : selected.global_discount_amount != null ? (
                                                                <p className="text-sm font-semibold text-amber-700">-{fmtMAD(selected.global_discount_amount)}</p>
                                                            ) : (
                                                                <p className="text-sm text-gray-400">Aucune</p>
                                                            )}
                                                        </div>
                                                        <div className="flex gap-2">
                                                            <button onClick={openDiscountModal} className="text-xs font-medium text-sage-600 hover:underline">
                                                                {selected.global_discount_percent != null || selected.global_discount_amount != null ? 'Modifier' : 'Appliquer'}
                                                            </button>
                                                            {(selected.global_discount_percent != null || selected.global_discount_amount != null) && (
                                                                <button onClick={clearDiscount} disabled={applyingDiscount} className="text-xs font-medium text-red-500 hover:underline disabled:opacity-50">
                                                                    Retirer
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-1.5 px-1">
                                                    <Calendar className="w-3.5 h-3.5 text-gray-300" />
                                                    <p className="text-xs font-medium text-gray-700">{fmtDate(selected.delivery_date)}</p>
                                                </div>

                                                {(selected.driver_info || selected.transporter_name || selected.delivered_at) && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100 space-y-1.5">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Livraison</p>
                                                        {selected.driver_info && (
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                                                <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {selected.driver_info}
                                                            </div>
                                                        )}
                                                        {selected.transporter_name && (
                                                            <div className="flex items-center gap-1.5 text-xs text-gray-700">
                                                                <Package className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {selected.transporter_name}
                                                            </div>
                                                        )}
                                                        {selected.delivered_at && (
                                                            <div className="flex items-center gap-1.5 text-xs text-emerald-700">
                                                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" /> Livré le {fmtDate(selected.delivered_at)}
                                                            </div>
                                                        )}
                                                    </div>
                                                )}

                                                {(selected.order_id || selected.invoice_id) && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Documents liés</p>
                                                        <div className="flex flex-wrap items-center gap-2">
                                                            {selected.order_id && (
                                                                <button
                                                                    onClick={() => navigate(`/gcom/bons-commande?id=${selected.order_id}`)}
                                                                    className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                                >
                                                                    <Package className="w-3 h-3 text-gray-400" /> {selected.order_code ?? `BC #${selected.order_id}`}
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
                                                    { key: 'article', header: 'Article', render: (it: GcomDeliveryNoteItem) => <span className="font-medium text-gray-800">{productLabel(it.product_id)}</span> },
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
                                                    {
                                                        key: 'pu', header: 'P.U.', align: 'right', width: 'w-24',
                                                        render: (it: GcomDeliveryNoteItem) => {
                                                            // 2026-09-01 — original_price/final_price only diverge once a
                                                            // manual unit_price override and/or per-line discount was
                                                            // applied via the new BL-editing endpoints.
                                                            const original = Number(it.original_price) || 0;
                                                            const final = Number(it.final_price) || Number(it.unit_price) || 0;
                                                            const negotiated = original > 0 && Math.abs(original - final) > 0.005;
                                                            return negotiated ? (
                                                                <div className="leading-tight">
                                                                    <p className="text-gray-400 line-through text-[10px]">{fmtMAD(original)}</p>
                                                                    <p className="text-amber-700 font-semibold">{fmtMAD(final)}</p>
                                                                </div>
                                                            ) : <span className="text-gray-600">{fmtMAD(it.unit_price)}</span>;
                                                        },
                                                    },
                                                    { key: 'total', header: 'Total', align: 'right', width: 'w-24', render: (it: GcomDeliveryNoteItem) => <span className="font-bold text-gray-900">{fmtMAD((Number(it.final_price) || Number(it.unit_price) || 0) * currentLineQty(it))}</span> },
                                                    ...(canEditBlLine ? [{
                                                        key: 'actions', header: '', align: 'center' as const, width: 'w-16',
                                                        render: (it: GcomDeliveryNoteItem) => (
                                                            <div className="flex items-center justify-center gap-2">
                                                                <button onClick={() => openUpdateLine(it)} className="text-gray-400 hover:text-sage-600" title="Modifier la ligne">
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button onClick={() => openRemoveLine(it)} className="text-red-400 hover:text-red-600" title="Supprimer la ligne">
                                                                    <X className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        ),
                                                    }] : []),
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
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en facture</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            Confirmez-vous la conversion du BL <strong>{selected.delivery_number ?? `#${selected.id}`}</strong> en facture pour <strong>{selected.partner?.name}</strong>, d'un montant de <strong>{fmtMAD(selected.total_amount)}</strong> ?
                        </p>

                        <div className="space-y-3 mb-5">
                            <ConvertToInvoicePaymentFields
                                invoicingMode={convertInvoicingMode}
                                method={convertMethodOverride}
                                onMethodChange={setConvertMethodOverride}
                                instrument={convertInstrument}
                                onInstrumentChange={setConvertInstrument}
                                banks={banks}
                                bankOther={convertInstrumentBankOther}
                                onBankOtherChange={setConvertInstrumentBankOther}
                                creditTerms={convertOverrideCreditTerms}
                                termId={convertOverrideTermId}
                                onTermIdChange={setConvertOverrideTermId}
                                soucheKind={convertSoucheKind}
                                onSoucheKindChange={setConvertSoucheKind}
                                mixAvoirEnabled={convertMixAvoirEnabled}
                                onMixAvoirEnabledChange={setConvertMixAvoirEnabled}
                                avoirAllocations={convertAvoirAllocations}
                                onAvoirAllocationsChange={setConvertAvoirAllocations}
                                partnerId={selected.partner?.id ?? null}
                                total={Number(selected.total_amount) || 0}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={confirmConvertToInvoice}
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

            {/* ── Update BL line modal (2026-09-01) ───────────────────────────── */}
            {updateLineTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <Edit2 className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Modifier la ligne</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{productLabel(updateLineTarget.product_id)}</strong> (quantité actuelle : {fmt(currentLineQty(updateLineTarget), 0)})
                        </p>
                        <p className="text-[11px] text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-3">
                            Le stock réel sera ajusté immédiatement (delta uniquement).
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nouvelle quantité *</label>
                            <input
                                type="number" min={1} autoFocus
                                value={updateLineQty}
                                onChange={e => setUpdateLineQty(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        {canPriceOverride && (
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Prix unitaire (optionnel — vide = prix catalogue)</label>
                                <input
                                    type="number" min={0} step="0.01"
                                    value={updateLineUnitPrice}
                                    onChange={e => setUpdateLineUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder={fmtMAD(updateLineTarget.unit_price)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                />
                            </div>
                        )}
                        {canDiscountLine && (
                            <div className="mb-5">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Remise (optionnel)</label>
                                <div className="flex gap-1.5">
                                    <select
                                        value={updateLineDiscountMode}
                                        onChange={e => { setUpdateLineDiscountMode(e.target.value as '' | 'percent' | 'amount'); setUpdateLineDiscountValue(''); }}
                                        className="px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                    >
                                        <option value="">Aucune</option>
                                        <option value="percent">%</option>
                                        <option value="amount">MAD</option>
                                    </select>
                                    {updateLineDiscountMode && (
                                        <input
                                            type="number" min={0} step="0.01" autoFocus
                                            value={updateLineDiscountValue}
                                            onChange={e => setUpdateLineDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                            className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                        />
                                    )}
                                </div>
                                {maxDiscountPercent != null && (
                                    <p className="text-[11px] text-gray-400 mt-1">Plafond sans dérogation : {maxDiscountPercent}%</p>
                                )}
                            </div>
                        )}
                        <div className="flex gap-3">
                            <button
                                onClick={confirmUpdateLine}
                                disabled={updatingLine || updateLineQty === '' || updateLineQty <= 0}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {updatingLine ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeUpdateLine} disabled={updatingLine} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Remove BL line modal (2026-09-01) ───────────────────────────── */}
            {removeLineTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Supprimer la ligne</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{productLabel(removeLineTarget.product_id)}</strong> — le stock sera immédiatement réintégré.
                            {(selected?.items?.length ?? 0) <= 1 && (
                                <span className="block mt-1.5 text-amber-600 font-medium">Dernière ligne — supprimer annulera le bon de livraison entier.</span>
                            )}
                        </p>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                            <textarea
                                value={removeLineReason}
                                onChange={e => setRemoveLineReason(e.target.value)}
                                rows={2}
                                maxLength={255}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                                placeholder="Erreur de saisie…"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmRemoveLine}
                                disabled={removingLine || !removeLineReason.trim()}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {removingLine ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={closeRemoveLine} disabled={removingLine} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── BL global discount modal (2026-09-01) ───────────────────────── */}
            {discountModalOpen && selected && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <RotateCcw className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Remise globale</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{selected.delivery_number ?? `#${selected.id}`}</strong> — total actuel {fmtMAD(selected.total_amount)}.
                        </p>
                        <p className="text-[11px] text-gray-400 mb-3">
                            Renégociable à volonté — chaque application repart du prix d'origine des lignes, jamais d'une remise déjà en place.
                        </p>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Remise</label>
                            <div className="flex gap-1.5">
                                <select
                                    value={discountMode}
                                    onChange={e => { setDiscountMode(e.target.value as 'percent' | 'amount'); setDiscountValue(''); }}
                                    className="px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                >
                                    <option value="percent">%</option>
                                    <option value="amount">MAD</option>
                                </select>
                                <input
                                    type="number" min={0} step="0.01" autoFocus
                                    value={discountValue}
                                    onChange={e => setDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    className="flex-1 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                />
                            </div>
                            {discountMode === 'percent' && maxDiscountPercent != null && (
                                <p className="text-[11px] text-gray-400 mt-1">Plafond sans dérogation : {maxDiscountPercent}%</p>
                            )}
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmApplyDiscount}
                                disabled={applyingDiscount || discountValue === '' || discountValue <= 0}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {applyingDiscount ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                Appliquer
                            </button>
                            <button onClick={closeDiscountModal} disabled={applyingDiscount} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
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

            {/* ── Batch return modal — all lines in one grid, one submit ─────────
                Reuses the same draggable/resizable ConfirmationModal shell as the
                Comptoir/BC submit-confirmation flow (GcomCatalogEntryScreen) —
                drag the header to move it, drag the bottom-right handle to resize. */}
            {returnBatchOpen && selected && (
                <ConfirmationModal
                    isOpen={returnBatchOpen}
                    onClose={closeReturnBatch}
                    onConfirm={confirmReturnBatch}
                    title="Retour partiel"
                    description="Renseignez la quantité retournée pour chaque article concerné — un retour intégral d'une ligne est accepté, les autres lignes du BL ne sont pas affectées."
                    confirmText="Confirmer le retour"
                    cancelText="Annuler"
                    variant="warning"
                    isLoading={returningBatch}
                    initialWidth={768}
                >
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
                                    const returnable = current > 0;
                                    const qty = returnBatchQty[it.id] ?? '';
                                    const isFullReturn = returnable && Number(qty) === current;
                                    return (
                                        <tr key={it.id} className={!returnable ? 'opacity-50' : (Number(qty) || 0) > 0 ? 'bg-amber-50/40' : undefined}>
                                            <td className="px-3 py-2 font-medium text-gray-800">
                                                {productLabel(it.product_id)}
                                                {isFullReturn && <span className="ml-1.5 text-[9px] font-semibold text-amber-600 uppercase tracking-wide">Retour intégral</span>}
                                            </td>
                                            <td className="px-3 py-2 text-right text-gray-600">{fmt(current, 0)}</td>
                                            <td className="px-2 py-1.5">
                                                <input
                                                    type="number" min={0} max={returnable ? current : 0}
                                                    disabled={!returnable}
                                                    value={qty}
                                                    placeholder="0"
                                                    onChange={e => {
                                                        const raw = e.target.value === '' ? '' : parseInt(e.target.value, 10);
                                                        const clamped = raw === '' ? '' : Math.min(raw, returnable ? current : 0);
                                                        setBatchQty(it.id, clamped);
                                                    }}
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
                                                    <option value="">— Motif —</option>
                                                    {RETURN_REASONS.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                                                </select>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </ConfirmationModal>
            )}

            {consolidateModalOpen && consolidateNotes.length >= 2 && (
                <ConsolidateModal
                    notes={consolidateNotes}
                    onClose={() => setConsolidateModalOpen(false)}
                    onDone={() => setConsolidateIds(new Set())}
                />
            )}
        </>
    );
}
