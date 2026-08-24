import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    ClipboardList, Search, X, Plus, Loader2, CheckCircle2,
    RefreshCw, Building2, AlertTriangle, Info, Package, Truck,
    FileText, Ban, Calendar, Edit2, Download,
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
import { AvoirAllocationPicker } from '@/components/gcom/AvoirAllocationPicker';
import { ConvertToInvoicePaymentFields } from '@/components/gcom/ConvertToInvoicePaymentFields';
import { avoirAllocationsMatchTotal, avoirAllocationsWithinTotal } from '@/lib/gcom/avoirAllocations';

import { gcomApi } from '@/services/api/gcomApi';
import {
    useOrders, useOrder, useCreateOrder, useConvertOrderToBl, useConvertToInvoice,
    useCancelOrder, useCancelOrderLine, useUpdateOrderLine, useAddOrderLine,
} from '@/hooks/gcom/useGcomOrders';
import { useConfirmBlDelivery } from '@/hooks/gcom/useGcomDeliveryNotes';
import { getPartners, getPartner, getPaymentTerms } from '@/services/api/partnerApi';
import { telesalesApi } from '@/services/api/telesalesApi';
import { masterdataApi, type Bank } from '@/services/api/masterdataApi';
import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import { usePermissions } from '@/hooks/usePermissions';
import { useGcomParameters } from '@/hooks/useGcomParameters';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
import type { CatalogProduct } from '@/types/telesalesAgent.types';
import type {
    GcomPaymentMethod, GcomOrder, GcomOrderProduct, GcomOrderListViewRow, GcomBcStatus, GcomInstrumentInput, GcomPdfPriceMode, GcomSoucheKind, GcomAvoirAllocation,
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

const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };

type ConvertTarget = { type: 'order'; id: number } | { type: 'bl'; id: number };

// ─── Component ───────────────────────────────────────────────────────────────

export default function BonCommandePage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    // 2026-09-01 — manual negotiation (price override/discounts) gating.
    // root/admin bypass every check (usePermissions' own isAdminUser short-
    // circuit) — these only actually restrict a real commercial/manager role.
    const { has } = usePermissions();
    const canPriceOverride = has('gcom-price-override');
    const canDiscountLine = has('gcom-discount-line');
    const { maxDiscountPercent } = useGcomParameters();

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
    const ordersQuery = useOrders({
        partner_id: partnerFilter?.id,
        bc_status: bcStatusFilter === 'all' ? undefined : bcStatusFilter,
    });
    const orders = useMemo(() => ordersQuery.data?.pages.flatMap(p => p.data) ?? [], [ordersQuery.data]);
    const loading = ordersQuery.isLoading || ordersQuery.isFetchingNextPage;
    const total = ordersQuery.data?.pages[0]?.total ?? 0;
    const loadMore = () => ordersQuery.fetchNextPage();

    // ── Selection / detail ───────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'create'>('view');
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const orderDetailQuery = useOrder(selectedId);
    const selected = orderDetailQuery.data ?? null;
    const detailLoading = orderDetailQuery.isLoading;

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

    const selectOrder = useCallback((row: { id: number }) => {
        setFormMode('view');
        setActiveTab('informations');
        setSelectedId(row.id);
    }, []);

    const handleManualRefresh = () => {
        ordersQuery.refetch();
        orderDetailQuery.refetch();
    };

    // Deep-link from another GCOM document's "Documents liés" chip
    // (?id=123) — fetches directly by id regardless of which list page/filter
    // it'd otherwise fall under, same pattern every selectXxx already re-fetches.
    useEffect(() => {
        const idParam = searchParams.get('id');
        const id = idParam ? parseInt(idParam, 10) : NaN;
        if (!Number.isNaN(id)) selectOrder({ id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── PDF (defaults HT if `priceMode` omitted — this document's convention) ──
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLoading, setPdfLoading] = useState(false);
    const openPdf = async (priceMode: GcomPdfPriceMode) => {
        if (!selected) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.orders.getPdfBlobUrl(selected.id, priceMode);
            if (url) window.open(url, '_blank');
            setPdfModalOpen(false);
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    const openCreate = () => setFormMode('create');

    const createOrder = useCreateOrder();

    const handleCreateOrderSubmit = async (payload: GcomCatalogEntrySubmitPayload): Promise<GcomOrder> => {
        try {
            const order = await createOrder.mutateAsync({
                partner_id: payload.partner_id,
                items: payload.items,
                payment_method: payload.payment_method,
                payment_term_id: payload.payment_term_id,
                notes: payload.notes,
                client_order_ref: payload.client_order_ref,
                salesperson_id: payload.salesperson_id,
                global_discount_percent: payload.global_discount_percent,
                global_discount_amount: payload.global_discount_amount,
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
    // 2026-08-29 — free text, display/traceability only. The resulting BL
    // is born in_transit, not delivered (see docs §13/§18).
    const [blDriverInfo, setBlDriverInfo] = useState('');
    const [blTransporterName, setBlTransporterName] = useState('');
    // 2026-08-30 — 'in_transit' is the safe/common default (real tournée).
    const [blStatus, setBlStatus] = useState<'in_transit' | 'delivered'>('in_transit');
    const [convertingToBl, setConvertingToBl] = useState(false);

    const openConvertToBlModal = () => {
        if (!selected) return;
        setBlDeliveryDate(new Date().toISOString().slice(0, 10));
        setBlPaymentMethod(selected.financial_metadata?.payment_method ?? 'cash');
        setBlDriverInfo('');
        setBlTransporterName('');
        setBlStatus('in_transit');
        setBlModalOpen(true);
    };
    const closeConvertToBlModal = () => setBlModalOpen(false);
    const convertOrderToBl = useConvertOrderToBl();

    const confirmConvertToBl = async () => {
        if (!selected) return;
        setConvertingToBl(true);
        try {
            await convertOrderToBl.mutateAsync({
                id: selected.id,
                payload: {
                    delivery_date: blDeliveryDate,
                    payment_method: blPaymentMethod,
                    driver_info: blDriverInfo.trim() || undefined,
                    transporter_name: blTransporterName.trim() || undefined,
                    status: blStatus,
                },
            });
            toast.success(blStatus === 'delivered' ? 'Bon de commande converti en BL — livré' : 'Bon de commande converti en BL — en transit');
            setBlModalOpen(false);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en BL');
        } finally {
            setConvertingToBl(false);
        }
    };

    // ── Confirmer la livraison du BL lié (2026-08-29) ────────────────────────
    const [confirmingBlDelivery, setConfirmingBlDelivery] = useState(false);
    const confirmBlDeliveryMutation = useConfirmBlDelivery();
    const confirmBlDelivery = async () => {
        if (!blForConversion || !selected) return;
        setConfirmingBlDelivery(true);
        try {
            await confirmBlDeliveryMutation.mutateAsync({ blId: blForConversion.id, orderId: selected.id });
            toast.success('Livraison confirmée');
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la confirmation de livraison');
        } finally {
            setConfirmingBlDelivery(false);
        }
    };

    // ── BC/BL → Facture conversion ───────────────────────────────────────────────
    const [convertTarget, setConvertTarget] = useState<ConvertTarget | null>(null);
    const [convertPanelOpen, setConvertPanelOpen] = useState(false); // instrument required (cheque/effet)
    const [invoiceConfirmOpen, setInvoiceConfirmOpen] = useState(false); // plain confirmation otherwise
    const [convertAvoirPanelOpen, setConvertAvoirPanelOpen] = useState(false); // payment_method === 'avoir'
    const [convertAvoirAllocations, setConvertAvoirAllocations] = useState<GcomAvoirAllocation[]>([]);
    // Optional avoir mix (2026-08-20) — the avoir covers PART of the total,
    // the BC/BL's own payment_method settles the rest. Reuses
    // convertAvoirAllocations (mutually exclusive with the exact-avoir panel
    // by payment method, same reasoning as GcomCatalogEntryScreen).
    const [convertMixAvoirEnabled, setConvertMixAvoirEnabled] = useState(false);
    // payment_method override (2026-08-20) — ONLY meaningful inside the
    // exact-avoir panel (BC/BL stored payment_method === 'avoir'): when the
    // available avoir doesn't cover 100%, this is the one way to still
    // convert — override to cash/card for the remainder. '' = no override,
    // stays the strict 100%-avoir requirement.
    const [convertAvoirOverrideMethod, setConvertAvoirOverrideMethod] = useState<'' | 'cash' | 'card'>('');
    const [convertInstrument, setConvertInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [convertingToInvoice, setConvertingToInvoice] = useState(false);
    // §17 — explicit override, 'declared' is the safe/common default.
    const [convertSoucheKind, setConvertSoucheKind] = useState<GcomSoucheKind>('declared');
    // 2026-08-21 — see BonLivraisonPage.tsx's identical comment: the
    // partner's billing mode isn't embedded on the order payload, fetched
    // once when the conversion flow opens. 1_FAC_PER_ORDER doesn't support
    // an explicit souche_kind or payment_method override yet (verified live:
    // backend silently swaps the souche to its own default rather than
    // honoring ours, instead of the clean 422 it described — hide both
    // controls). PERIODIC_FIN_DE_MOIS blocks conversion entirely, before any
    // modal opens.
    const [convertInvoicingMode, setConvertInvoicingMode] = useState<'1_FAC_PER_BL' | '1_FAC_PER_ORDER' | 'PERIODIC_FIN_DE_MOIS' | null>(null);
    const [convertModeChecking, setConvertModeChecking] = useState(false);
    // 2026-09-01 — see BonLivraisonPage.tsx's identical comment: the
    // generalized payment_method override at convert-to-invoice, any real
    // method regardless of what the BC/BL was originally created with.
    const [convertMethodOverride, setConvertMethodOverride] = useState<Exclude<GcomPaymentMethod, 'avoir'>>('cash');
    const [convertOverrideCreditTerms, setConvertOverrideCreditTerms] = useState<PaymentTermOption[]>([]);
    const [convertOverrideTermId, setConvertOverrideTermId] = useState<number | null>(null);
    // Bank dropdown for the instrument's bank_name (GET /masterdata/banks) —
    // falls back to free text if the list is empty or the bank isn't listed.
    const [banks, setBanks] = useState<Bank[]>([]);
    const [convertInstrumentBankOther, setConvertInstrumentBankOther] = useState(false);
    useEffect(() => { masterdataApi.banks.getAll().then(setBanks).catch(() => setBanks([])); }, []);

    const openConvertToInvoice = async (target: ConvertTarget) => {
        if (!selected) return;
        setConvertTarget(target);
        setConvertSoucheKind('declared');
        setConvertAvoirAllocations([]);
        setConvertMixAvoirEnabled(false);
        setConvertAvoirOverrideMethod('');
        setConvertInvoicingMode(null);
        setConvertOverrideCreditTerms([]);
        setConvertOverrideTermId(null);
        const method: GcomPaymentMethod = selected.financial_metadata?.payment_method ?? 'cash';
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
                    toast.error('Ce client est facturé automatiquement en fin de mois — pas de conversion manuelle possible.');
                    setConvertTarget(null);
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

    const closeInvoiceConfirm = () => { setInvoiceConfirmOpen(false); setConvertTarget(null); };

    const convertToInvoice = useConvertToInvoice();

    const doConvertToInvoice = async (target: ConvertTarget, instrument: GcomInstrumentInput | null, avoirAllocations?: GcomAvoirAllocation[], paymentMethodOverride?: Exclude<GcomPaymentMethod, 'avoir'>, paymentTermId?: number | null) => {
        setConvertingToInvoice(true);
        try {
            // 1_FAC_PER_ORDER doesn't support an explicit souche_kind or
            // payment_method override yet — let backend pick its own defaults
            // rather than risk a silent mismatch.
            const soucheKindArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : convertSoucheKind;
            const overrideArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : paymentMethodOverride;
            const termIdArg = convertInvoicingMode === '1_FAC_PER_ORDER' ? undefined : paymentTermId;
            const invoice = await convertToInvoice.mutateAsync({
                target, instrument, soucheKind: soucheKindArg, avoirAllocations,
                paymentMethodOverride: overrideArg, paymentTermId: termIdArg,
            });
            toast.success(`Facture ${invoice.invoice_number ?? `#${invoice.id}`} créée${invoice.souche_kind === 'internal' ? ' (souche interne)' : ''}`);
            setConvertPanelOpen(false);
            setInvoiceConfirmOpen(false);
            setConvertAvoirPanelOpen(false);
            setConvertTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la conversion en facture');
        } finally {
            setConvertingToInvoice(false);
        }
    };

    // Shared submit for both the "instrument panel" and "plain confirm modal"
    // — see BonLivraisonPage.tsx's identical comment.
    const confirmConvertToInvoice = () => {
        if (!convertTarget) return;
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
        if (convertMixAvoirEnabled && !avoirAllocationsWithinTotal(convertAvoirAllocations, convertTargetTotal)) {
            toast.error('Le total des avoirs sélectionnés dépasse le montant de la vente');
            return;
        }
        const storedMethod = selected?.financial_metadata?.payment_method ?? 'cash';
        const methodChanged = convertMethodOverride !== storedMethod;
        void doConvertToInvoice(
            convertTarget,
            needsInstrumentNow ? convertInstrument : null,
            convertMixAvoirEnabled && convertAvoirAllocations.length > 0 ? convertAvoirAllocations : undefined,
            methodChanged ? convertMethodOverride : undefined,
            needsTermNow ? convertOverrideTermId : undefined,
        );
    };

    // ── Cancellation (order or single line) ──────────────────────────────────
    const [cancelTarget, setCancelTarget] = useState<{ type: 'order' } | { type: 'line'; line: GcomOrderProduct } | null>(null);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelQuantity, setCancelQuantity] = useState<number | ''>('');
    const [cancelling, setCancelling] = useState(false);

    const openCancelOrder = () => { setCancelTarget({ type: 'order' }); setCancelReason(''); };
    const openCancelLine = (line: GcomOrderProduct) => { setCancelTarget({ type: 'line', line }); setCancelReason(''); setCancelQuantity(''); };
    const closeCancelDialog = () => setCancelTarget(null);
    const cancelOrder = useCancelOrder();
    const cancelOrderLine = useCancelOrderLine();

    const confirmCancel = async () => {
        if (!cancelTarget || !selected || !cancelReason.trim()) { toast.error('Motif requis'); return; }
        setCancelling(true);
        try {
            if (cancelTarget.type === 'order') {
                await cancelOrder.mutateAsync({ id: selected.id, payload: { reason: cancelReason.trim() } });
                toast.success('Bon de commande annulé');
            } else {
                await cancelOrderLine.mutateAsync({
                    id: selected.id,
                    lineId: cancelTarget.line.pivot.id,
                    payload: { reason: cancelReason.trim(), quantity: cancelQuantity === '' ? undefined : cancelQuantity },
                });
                toast.success('Ligne annulée');
            }
            setCancelTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'annulation");
        } finally {
            setCancelling(false);
        }
    };

    // ── Update line quantity (the inverse of cancel — raise it), plus manual
    // negotiation (2026-09-01) — unit_price/discount are re-priced fresh for
    // the new quantity, omitting them just drops any existing override. ──────
    const [updateQtyTarget, setUpdateQtyTarget] = useState<GcomOrderProduct | null>(null);
    const [updateQtyValue, setUpdateQtyValue] = useState<number | ''>('');
    const [updateUnitPrice, setUpdateUnitPrice] = useState<number | ''>('');
    const [updateDiscountMode, setUpdateDiscountMode] = useState<'' | 'percent' | 'amount'>('');
    const [updateDiscountValue, setUpdateDiscountValue] = useState<number | ''>('');
    const [updatingQty, setUpdatingQty] = useState(false);

    const openUpdateQty = (line: GcomOrderProduct) => {
        setUpdateQtyTarget(line);
        setUpdateQtyValue(Number(line.pivot.quantity));
        setUpdateUnitPrice('');
        setUpdateDiscountMode('');
        setUpdateDiscountValue('');
    };
    const closeUpdateQtyDialog = () => setUpdateQtyTarget(null);
    const updateOrderLine = useUpdateOrderLine();

    const confirmUpdateQty = async () => {
        if (!updateQtyTarget || !selected || updateQtyValue === '' || updateQtyValue <= 0) { toast.error('Quantité invalide'); return; }
        setUpdatingQty(true);
        try {
            await updateOrderLine.mutateAsync({
                id: selected.id,
                lineId: updateQtyTarget.pivot.id,
                payload: {
                    quantity: updateQtyValue,
                    unit_price: canPriceOverride && updateUnitPrice !== '' ? updateUnitPrice : undefined,
                    discount_percent: canDiscountLine && updateDiscountMode === 'percent' && updateDiscountValue !== '' ? updateDiscountValue : undefined,
                    discount_amount: canDiscountLine && updateDiscountMode === 'amount' && updateDiscountValue !== '' ? updateDiscountValue : undefined,
                },
            });
            toast.success('Ligne mise à jour');
            setUpdateQtyTarget(null);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la mise à jour de la ligne');
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
    // 2026-09-01 — manual negotiation, permission-gated (canPriceOverride/
    // canDiscountLine). Keyed the same way as addLineQuantities — only
    // discount_percent is offered here (not discount_amount) to keep this
    // compact multi-row table usable; the single-line update-quantity modal
    // offers the full percent/amount choice for the less common case.
    const [addLineUnitPrices, setAddLineUnitPrices] = useState<Record<number, number>>({});
    const [addLineDiscountPercents, setAddLineDiscountPercents] = useState<Record<number, number>>({});
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
        setAddLineUnitPrices({});
        setAddLineDiscountPercents({});
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

    const addOrderLine = useAddOrderLine();

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
            const unitPrice = addLineUnitPrices[productId];
            const discountPercent = addLineDiscountPercents[productId];
            try {
                await addOrderLine.mutateAsync({
                    id: selected.id,
                    payload: {
                        product_id: productId,
                        quantity,
                        unit_price: canPriceOverride && unitPrice ? unitPrice : undefined,
                        discount_percent: canDiscountLine && discountPercent ? discountPercent : undefined,
                    },
                });
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
            valueGetter: (p: ValueGetterParams<GcomOrderListViewRow>) => p.data?.order_code ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'partner.name', headerName: 'Client', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow, string>) => <span style={{ fontSize: '12px', fontWeight: 500 }}>{p.value ?? '—'}</span>,
        },
        {
            field: 'bc_status', headerName: 'Statut', width: 100,
            filter: 'agSetColumnFilter',
            filterParams: { valueFormatter: (p: { value: GcomBcStatus }) => BC_STATUS_META[p.value]?.label ?? p.value },
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow>) => p.data ? <StatusBadge status={p.data.bc_status} /> : null,
        },
        {
            // Flat on this lean endpoint (not nested under financial_metadata
            // like the full GcomOrder) — confirmed with backend, kept flat.
            field: 'payment_method', headerName: 'Règlement', width: 100,
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow, GcomPaymentMethod>) => (
                <span style={{ fontSize: '11px', color: '#6b7280' }}>{PAYMENT_METHODS.find(m => m.value === p.value)?.label ?? p.value ?? '—'}</span>
            ),
        },
        {
            colId: 'total_amount', headerName: 'Total TTC', width: 100,
            filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomOrderListViewRow>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow, number>) => (
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
            cellRenderer: (p: ICellRendererParams<GcomOrderListViewRow, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
    ], []);

    // ── Action panel ──────────────────────────────────────────────────────────

    // Same "before any BL/invoice" guard the API enforces for BC→BL, BC→Facture, cancel and line-cancel.
    const noDocumentsYet = selected?.bc_status === 'confirmed' && (selected.delivery_notes?.length ?? 0) === 0 && (selected.invoices?.length ?? 0) === 0;
    const blForConversion = selected?.delivery_notes?.[0];
    // The BC's own total unless converting the BL specifically — a BL can
    // diverge from its parent BC (partial return before invoicing, §9bis),
    // so its own total_amount is the one that must match the avoir allocation sum.
    const convertTargetTotal = Number(convertTarget?.type === 'bl' ? (blForConversion?.total_amount ?? selected?.total_amount) : selected?.total_amount) || 0;
    // 2026-08-29: a BL is born in_transit now — only 'delivered' can be
    // invoiced (the endpoint 422s otherwise, gate the button instead of
    // letting that surface as an error).
    const canConfirmBlDelivery = blForConversion?.status === 'in_transit';
    const canConvertBlToInvoice = selected?.bc_status === 'confirmed' && !!blForConversion && blForConversion.status === 'delivered' && (selected.invoices?.length ?? 0) === 0;

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const base: ActionItemProps[] = [
            { icon: Plus, label: 'Nouveau BC', variant: 'sage', onClick: openCreate },
            { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: handleManualRefresh, disabled: loading },
        ];
        if (!selected) return [{ items: base }];
        const detailItems: ActionItemProps[] = [
            { icon: Download, label: 'Imprimer', variant: 'default', onClick: () => setPdfModalOpen(true) },
        ];
        if (noDocumentsYet) {
            detailItems.push(
                { icon: Plus, label: 'Ajouter une ligne', variant: 'sage', onClick: openAddLineModal },
                { icon: Truck, label: 'Convertir en BL', variant: 'primary', onClick: openConvertToBlModal, disabled: convertingToBl },
                { icon: FileText, label: 'Convertir en Facture', variant: 'primary', onClick: () => openConvertToInvoice({ type: 'order', id: selected.id }), disabled: convertingToInvoice || convertModeChecking },
                { icon: Ban, label: 'Annuler le BC', variant: 'danger', onClick: openCancelOrder },
            );
        } else if (canConfirmBlDelivery && blForConversion) {
            detailItems.push(
                { icon: CheckCircle2, label: 'Confirmer la livraison du BL', variant: 'primary', onClick: confirmBlDelivery, disabled: confirmingBlDelivery },
            );
        } else if (canConvertBlToInvoice && blForConversion) {
            detailItems.push(
                { icon: FileText, label: 'Convertir le BL en Facture', variant: 'primary', onClick: () => openConvertToInvoice({ type: 'bl', id: blForConversion.id }), disabled: convertingToInvoice || convertModeChecking },
            );
        }
        return [{ items: base }, { items: detailItems }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected, noDocumentsYet, canConfirmBlDelivery, canConvertBlToInvoice, blForConversion, loading, convertingToBl, convertingToInvoice, convertModeChecking, confirmingBlDelivery]);

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
                enableNegotiation
                canPriceOverride={canPriceOverride}
                canDiscountLine={canDiscountLine}
                canDiscountGlobal={has('gcom-discount-global')}
                draftKey="gcom-bc-create"
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
                                onRowClicked={e => { if (e.data) { selectOrder(e.data); navigate(`/gcom/bons-commande?id=${e.data.id}`, { replace: true }); } }}
                                defaultSelectedIds={row => row.id === selected?.id}
                            />
                        </div>

                        {ordersQuery.hasNextPage && (
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

                                    {/* ── Convert-to-invoice panel (instrument-first entry, but any method can be picked) ──── */}
                                    {convertPanelOpen && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">
                                                Conversion {convertTarget?.type === 'bl' ? 'du BL' : 'du BC'} en facture
                                            </p>
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
                                                total={convertTargetTotal}
                                            />

                                            <div className="flex gap-2">
                                                <button
                                                    onClick={confirmConvertToInvoice}
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

                                    {/* ── Convert-to-invoice avoir panel ──── */}
                                    {convertAvoirPanelOpen && convertTarget && (
                                        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 space-y-3">
                                            <p className="text-xs font-semibold text-amber-800">
                                                Règlement par avoir pour la conversion {convertTarget.type === 'bl' ? 'du BL' : 'du BC'} en facture
                                            </p>
                                            <AvoirAllocationPicker
                                                partnerId={selected.partner?.id ?? null}
                                                total={convertTargetTotal}
                                                value={convertAvoirAllocations}
                                                onChange={setConvertAvoirAllocations}
                                                mode={convertAvoirOverrideMethod ? 'partial' : 'exact'}
                                            />

                                            {/* payment_method override (2026-08-20) — the avoir alone doesn't have
                                                to cover 100%; switching this on lets the remainder be settled in
                                                cash/card instead of requiring an exact avoir match. Not supported
                                                yet for 1_FAC_PER_ORDER — the avoir must cover 100% in that mode. */}
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
                                                        if (!convertTarget) return;
                                                        const ok = convertAvoirOverrideMethod
                                                            ? avoirAllocationsWithinTotal(convertAvoirAllocations, convertTargetTotal)
                                                            : avoirAllocationsMatchTotal(convertAvoirAllocations, convertTargetTotal);
                                                        if (!ok) {
                                                            toast.error(convertAvoirOverrideMethod
                                                                ? 'Le total des avoirs sélectionnés dépasse le montant de la vente'
                                                                : 'Le total des avoirs sélectionnés doit correspondre exactement au montant de la vente (ou choisissez un mode de règlement pour le reliquat)');
                                                            return;
                                                        }
                                                        void doConvertToInvoice(convertTarget, null, convertAvoirAllocations, convertAvoirOverrideMethod || undefined);
                                                    }}
                                                    disabled={convertingToInvoice || (convertAvoirOverrideMethod
                                                        ? !avoirAllocationsWithinTotal(convertAvoirAllocations, convertTargetTotal)
                                                        : !avoirAllocationsMatchTotal(convertAvoirAllocations, convertTargetTotal))}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-sage-600 text-white text-xs font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50"
                                                >
                                                    {convertingToInvoice ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                                    Confirmer la conversion
                                                </button>
                                                <button onClick={() => { setConvertAvoirPanelOpen(false); setConvertTarget(null); }} className="px-3 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50">Annuler</button>
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
                                                                <button
                                                                    key={bl.id}
                                                                    onClick={() => navigate(`/gcom/bons-livraison?id=${bl.id}`)}
                                                                    className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                                >
                                                                    <Truck className="w-3 h-3 text-gray-400" /> BL #{bl.id} {bl.status && <span className="text-[10px] text-gray-400">({bl.status})</span>}
                                                                </button>
                                                            ))}
                                                            {selected.invoices?.map(inv => (
                                                                <button
                                                                    key={inv.id}
                                                                    onClick={() => navigate(`/gcom/factures?id=${inv.id}`)}
                                                                    className="flex items-center gap-1 text-xs font-medium text-gray-700 bg-white border border-gray-200 rounded-md px-2 py-1 hover:bg-sage-50 hover:border-sage-200 hover:text-sage-700 transition-colors"
                                                                >
                                                                    <FileText className="w-3 h-3 text-gray-400" /> {inv.invoice_number ?? `Facture #${inv.id}`}
                                                                </button>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}

                                                {selected.bc_notes && (
                                                    <div className="bg-gray-50 rounded-lg p-3 border border-gray-100">
                                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1">Notes</p>
                                                        <p className="text-sm text-gray-700">{selected.bc_notes}</p>
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
                                                    {
                                                        key: 'pu', header: 'P.U. TTC', align: 'right', width: 'w-24',
                                                        render: it => {
                                                            // original_price/final_price only diverge when a manual
                                                            // unit_price override and/or per-line discount was applied
                                                            // (2026-09-01) — show the struck-through original alongside
                                                            // the real net price when they differ, plain price otherwise.
                                                            const original = Number(it.pivot.original_price) || 0;
                                                            const final = Number(it.pivot.final_price) || Number(it.pivot.price) || 0;
                                                            const negotiated = original > 0 && Math.abs(original - final) > 0.005;
                                                            return negotiated ? (
                                                                <div className="leading-tight">
                                                                    <p className="text-gray-400 line-through text-[10px]">{fmtMAD(original)}</p>
                                                                    <p className="text-amber-700 font-semibold">{fmtMAD(final)}</p>
                                                                </div>
                                                            ) : <span className="text-gray-600">{fmtMAD(it.pivot.price)}</span>;
                                                        },
                                                    },
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
                            <h3 className="text-base font-semibold text-gray-900">Modifier la ligne</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{updateQtyTarget.name}</strong> (quantité actuelle : {fmt(updateQtyTarget.pivot.quantity, 0)})
                        </p>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Nouvelle quantité *</label>
                            <input
                                type="number" min={1} autoFocus
                                value={updateQtyValue}
                                onChange={e => setUpdateQtyValue(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>

                        {/* 2026-09-01 — manual negotiation, permission-gated. Omitted =
                            simply re-priced fresh from catalog, dropping any prior override. */}
                        {canPriceOverride && (
                            <div className="mb-3">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Prix unitaire HT (optionnel — vide = prix catalogue)</label>
                                <input
                                    type="number" min={0} step="0.01"
                                    value={updateUnitPrice}
                                    onChange={e => setUpdateUnitPrice(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                    placeholder={fmtMAD(updateQtyTarget.pivot.unit_price_ht)}
                                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                />
                            </div>
                        )}
                        {canDiscountLine && (
                            <div className="mb-5">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Remise (optionnel)</label>
                                <div className="flex gap-1.5">
                                    <select
                                        value={updateDiscountMode}
                                        onChange={e => { setUpdateDiscountMode(e.target.value as '' | 'percent' | 'amount'); setUpdateDiscountValue(''); }}
                                        className="px-2 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                    >
                                        <option value="">Aucune</option>
                                        <option value="percent">%</option>
                                        <option value="amount">MAD</option>
                                    </select>
                                    {updateDiscountMode && (
                                        <input
                                            type="number" min={0} step="0.01" autoFocus
                                            value={updateDiscountValue}
                                            onChange={e => setUpdateDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
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
                                    ...(canPriceOverride ? [{
                                        key: 'unitPriceOverride', header: 'Prix négocié', align: 'center' as const, width: 'w-24',
                                        render: (p: CatalogProduct) => (
                                            <input
                                                type="number" min={0} step="0.01"
                                                value={addLineUnitPrices[p.id] ?? ''}
                                                onChange={e => setAddLineUnitPrices(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                                onFocus={() => { if (!addLineSelected[p.id]) toggleAddLineSelect(p.id); }}
                                                placeholder={String(p.price ?? '')}
                                                className="w-20 text-center px-1 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            />
                                        ),
                                    }] : []),
                                    ...(canDiscountLine ? [{
                                        key: 'discount', header: maxDiscountPercent != null ? `Remise % (max ${maxDiscountPercent})` : 'Remise %', align: 'center' as const, width: 'w-24',
                                        render: (p: CatalogProduct) => (
                                            <input
                                                type="number" min={0} max={100} step="0.1"
                                                value={addLineDiscountPercents[p.id] ?? ''}
                                                onChange={e => setAddLineDiscountPercents(prev => ({ ...prev, [p.id]: parseFloat(e.target.value) || 0 }))}
                                                onFocus={() => { if (!addLineSelected[p.id]) toggleAddLineSelect(p.id); }}
                                                className="w-16 text-center px-1 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            />
                                        ),
                                    }] : []),
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
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Chauffeur (optionnel)</label>
                            <input
                                value={blDriverInfo}
                                onChange={e => setBlDriverInfo(e.target.value)}
                                maxLength={150}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        <div className="mb-3">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Transporteur (optionnel)</label>
                            <input
                                value={blTransporterName}
                                onChange={e => setBlTransporterName(e.target.value)}
                                maxLength={150}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        <div className="flex items-center gap-1.5 mb-4">
                            {([
                                { value: 'in_transit' as const, label: 'En transit', icon: Truck },
                                { value: 'delivered' as const, label: 'Livré directement', icon: CheckCircle2 },
                            ]).map(opt => (
                                <button
                                    key={opt.value}
                                    onClick={() => setBlStatus(opt.value)}
                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                                        blStatus === opt.value ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                    }`}
                                >
                                    <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                                </button>
                            ))}
                        </div>
                        <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-4">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            {blStatus === 'delivered'
                                ? 'Retrait comptoir/dépôt — le BL sera immédiatement livré et facturable.'
                                : "Le BL sera créé en transit — il faudra confirmer la livraison avant de pouvoir le facturer."}
                        </p>
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
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-lg w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-sage-100 flex items-center justify-center">
                                <FileText className="w-4 h-4 text-sage-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Convertir en facture</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            Confirmez-vous la conversion {convertTarget.type === 'bl' ? 'du BL' : `du BC ${selected.order_code ?? `#${selected.id}`}`} en facture pour <strong>{selected.partner?.name}</strong>, d'un montant de <strong>{fmtMAD(selected.total_amount)}</strong> ?
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
                                total={convertTargetTotal}
                            />
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={confirmConvertToInvoice}
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

            <PdfPriceModeModal
                isOpen={pdfModalOpen}
                onClose={() => setPdfModalOpen(false)}
                onConfirm={openPdf}
                defaultMode="ht"
                documentLabel="bon de commande"
                loading={pdfLoading}
            />
        </>
    );
}
