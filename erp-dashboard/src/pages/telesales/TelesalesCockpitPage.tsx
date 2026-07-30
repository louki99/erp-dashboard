import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import {
    Phone, Briefcase, Search, Clock, CalendarDays, Wallet, StickyNote,
    CheckCircle2, PhoneOff, MessageSquareWarning, PhoneMissed, PhoneCall, PackageX, Loader2,
    ShoppingCart, Trash2, Plus, Check, Receipt, AlertTriangle, Tag, LayoutGrid, RefreshCw, MapPin,
    ChevronsLeft, ChevronsRight, ChevronDown, ChevronUp, RotateCcw, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { DetailHeader, StatusPill } from '@/components/telesales/panels';
import { usePlanning, useStartAdhocVisit, useStartVisit, useCompleteVisit } from '@/hooks/telesales/useTelesalesVisits';
import { usePortfolio } from '@/hooks/telesales/useTelesalesPortfolio';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import { useCreateOrder, useUpdateOrder, useSubmitOrder, useRequestDerogation, useOrderSummary } from '@/hooks/telesales/useTelesalesOrders';
import { useCatalogProducts, useCatalogPages } from '@/hooks/telesales/useTelesalesCatalog';
import { useCachedCatalog, useCachedPartner } from '@/hooks/telesales/useTelesalesSync';
import { usePriceListData } from '@/hooks/telesales/usePriceListData';
import { resolveLocalPrice } from '@/lib/telesales/priceResolver';
import { telesalesApi } from '@/services/api/telesalesApi';
import { TELE_VISIT_OUTCOME_LABELS } from '@/types/telesalesAgent.types';
import type {
    TeleVisit, TeleVisitOutcome, PortfolioPartner, CatalogProduct, TelesalesOrder,
    CreditValidation, PartnerCreditStatus, ProductFlags,
} from '@/types/telesalesAgent.types';

const todayIso = () => new Date().toISOString().slice(0, 10);

const OUTCOME_CONFIG: Record<TeleVisitOutcome, { icon: React.ElementType; iconBg: string; iconColor: string }> = {
    ORDER_TAKEN: { icon: CheckCircle2, iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600' },
    UNAVAILABLE: { icon: PhoneOff, iconBg: 'bg-gray-100', iconColor: 'text-gray-500' },
    COMPLAINT: { icon: MessageSquareWarning, iconBg: 'bg-red-50', iconColor: 'text-red-500' },
    NO_ANSWER: { icon: PhoneMissed, iconBg: 'bg-amber-50', iconColor: 'text-amber-500' },
    BUSY: { icon: PhoneCall, iconBg: 'bg-rose-50', iconColor: 'text-rose-500' },
    RESTOCK_NEEDED: { icon: PackageX, iconBg: 'bg-blue-50', iconColor: 'text-blue-500' },
};

// Short labels for the compact 3×2 qualification grid — the full labels
// (TELE_VISIT_OUTCOME_LABELS) truncate badly at button width, so those are used
// only as the hover tooltip.
const OUTCOME_SHORT: Record<TeleVisitOutcome, string> = {
    ORDER_TAKEN: 'Commande',
    UNAVAILABLE: 'Absent',
    COMPLAINT: 'Réclamation',
    NO_ANSWER: 'Pas de réponse',
    BUSY: 'Occupé',
    RESTOCK_NEEDED: 'Rupture',
};

// Motifs proposés à la clôture quand AUCUNE commande n'a été passée pendant
// l'appel (ORDER_TAKEN est déduit automatiquement dans ce cas, jamais listé ici).
const CLOSE_REASONS: TeleVisitOutcome[] = ['NO_ANSWER', 'UNAVAILABLE', 'BUSY', 'RESTOCK_NEEDED', 'COMPLAINT'];

interface CartLine {
    product: CatalogProduct;
    quantity: number;
}

// ─── Inline quantity cell (Sadi9 ultra-fast entry, unchanged from /telesales/orders/new) ──
interface QuantityCellProps {
    product: CatalogProduct;
    rowIndex: number;
    inCart: boolean;
    disabled: boolean;
    onAdd: (product: CatalogProduct, quantity: number) => void;
}

const QuantityCell = ({ product, rowIndex, inCart, disabled, onAdd }: QuantityCellProps) => {
    const minQty = Math.max(1, product.flags.min_quantity_order || 1);
    const allowDecimal = product.flags.decimal_quantity_allowed;
    const notSalable = !product.flags.is_salable;
    const isDisabled = disabled || notSalable;

    const [qty, setQty] = useState(minQty);

    const normalize = (value: number) => {
        const n = Math.max(minQty, value);
        return allowDecimal ? n : Math.round(n);
    };

    const commit = () => {
        if (isDisabled || qty < minQty) return;
        onAdd(product, qty);
        setQty(minQty);
        const next = document.querySelector<HTMLInputElement>(`[data-qty-row="${rowIndex + 1}"]`);
        next?.focus();
        next?.select();
    };

    return (
        <div className="flex items-center gap-1.5 py-1">
            <input
                data-qty-row={rowIndex}
                type="number"
                min={minQty}
                step={allowDecimal ? 0.01 : 1}
                value={qty}
                disabled={isDisabled}
                title={notSalable ? 'Produit non vendable actuellement' : undefined}
                onChange={(e) => setQty(normalize(Number(e.target.value)))}
                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); commit(); } }}
                onFocus={(e) => e.target.select()}
                className="w-16 px-2 py-1 text-sm text-center border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500 disabled:bg-gray-50 disabled:text-gray-300"
            />
            <button
                onClick={commit}
                disabled={isDisabled}
                title={notSalable ? 'Produit non vendable actuellement' : 'Ajouter au panier (Entrée)'}
                className={`p-1.5 rounded-md transition-colors disabled:opacity-30 disabled:cursor-not-allowed ${
                    inCart ? 'bg-emerald-100 text-emerald-600' : 'bg-sage-50 text-sage-600 hover:bg-sage-100'
                }`}
            >
                {inCart ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            </button>
        </div>
    );
};

// Cockpit All-in-One (2026-08) — replaces the old planning → fiche → prise de
// commande, page-hopping flow for the agent's actual in-call work. Left picks
// the client (planning or portfolio), center holds profile/credit + qualification
// + catalog, right holds the live cart + submit — all in place, no navigation.
// /telesales/planning and /telesales/visits/{id} remain reachable directly
// (scheduling a *future* call, or reviewing a past qualification) — this
// screen is specifically the "on the phone right now" workspace.
export const TelesalesCockpitPage = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const incoming = (location.state as { visit?: TeleVisit } | null) ?? null;

    const { sessionActive } = useSessionGate();

    // Collapse toggles — let the agent hide the client/qualification strip and the
    // cart panel to give the product grid the full screen while picking fast.
    const [topCollapsed, setTopCollapsed] = useState(false);
    const [panierCollapsed, setPanierCollapsed] = useState(false);
    // Fullscreen catalog — a distraction-free overlay (catalog + pages + cart only)
    // for high-speed order entry, toggled by the maximize icon on the search bar.
    const [catalogFullscreen, setCatalogFullscreen] = useState(false);

    // End-of-call flow — "Terminer la visite" auto-qualifies ORDER_TAKEN if an order
    // was placed, else opens this modal to pick a reason.
    const [showCompleteModal, setShowCompleteModal] = useState(false);
    const [completeOutcome, setCompleteOutcome] = useState<TeleVisitOutcome>('NO_ANSWER');

    // ── Left column — Planning / Portefeuille ────────────────────────────────
    const [leftTab, setLeftTab] = useState<'planning' | 'portfolio'>('planning');
    const [portfolioSearch, setPortfolioSearch] = useState('');
    const { visits: planningVisits, loading: loadingPlanning, refetch: refetchPlanning } = usePlanning(todayIso());
    const { partners: portfolioPartners, loading: loadingPortfolio } = usePortfolio(portfolioSearch);

    const { startAdhoc, loading: startingAdhoc } = useStartAdhocVisit();
    const { start: startPlanned, loading: startingPlanned } = useStartVisit();
    const startingCall = startingAdhoc || startingPlanned;

    // ── Active call state ─────────────────────────────────────────────────────
    const [visit, setVisit] = useState<TeleVisit | null>(incoming?.visit ?? null);
    const [callNotes, setCallNotes] = useState('');
    const { complete, loading: completing } = useCompleteVisit();

    // ── Order / cart state ────────────────────────────────────────────────────
    const [cart, setCart] = useState<CartLine[]>([]);
    const [orderNotes, setOrderNotes] = useState('');
    const [order, setOrder] = useState<TelesalesOrder | null>(null);
    const { createOrder, loading: creating } = useCreateOrder();
    const { updateOrder, loading: updatingOrder } = useUpdateOrder();
    const { submit, loading: submitting } = useSubmitOrder();
    const { requestDerogation, loading: requestingDerogation } = useRequestDerogation();
    const { summary, fetchSummary, reset: resetSummary } = useOrderSummary();
    // Récapitulatif shown INLINE in the panier sidebar (not a modal) — reviewMode
    // swaps the cart list for the fiscal summary + "Confirmer et soumettre".
    const [reviewMode, setReviewMode] = useState(false);
    const [creditIssue, setCreditIssue] = useState<CreditValidation | null>(null);
    const [showDerogationModal, setShowDerogationModal] = useState(false);
    const [justification, setJustification] = useState('');
    const [idempotencyKey] = useState(() => crypto.randomUUID());
    const [derogationRequested, setDerogationRequested] = useState(false);

    const resetForNewCall = () => {
        setCallNotes('');
        setShowCompleteModal(false);
        setReviewMode(false);
        setCart([]);
        setOrderNotes('');
        setOrder(null);
        setCreditIssue(null);
        setShowDerogationModal(false);
        setJustification('');
        setDerogationRequested(false);
        resetSummary();
    };

    const handleSelectPlanning = async (v: TeleVisit) => {
        // Already started (per the list) — resume straight into the cockpit, no /start call.
        if (v.started_at) {
            resetForNewCall();
            setVisit(v);
            return;
        }
        try {
            const started = await startPlanned(v.id);
            resetForNewCall();
            setVisit(started);
            refetchPlanning();
        } catch (err: any) {
            // POST /visits/{id}/start returns 422 "already been started" when the visit was
            // started earlier (e.g. a previous session) but the planning list hadn't surfaced
            // its started_at yet. That's not an error for the agent — the visit IS in progress,
            // so just open it and mark it started locally instead of blocking with a toast.
            const status = err?.response?.status;
            const msg: string = err?.response?.data?.message || '';
            if (status === 422 && /already been started|déjà démarr/i.test(msg)) {
                resetForNewCall();
                setVisit({ ...v, started_at: v.started_at ?? new Date().toISOString() });
                refetchPlanning();
                return;
            }
            toast.error(msg || "Échec du démarrage de l'appel");
        }
    };

    const handleSelectPortfolio = async (p: PortfolioPartner) => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        try {
            const started = await startAdhoc({ partner_id: p.id });
            resetForNewCall();
            setVisit(started);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec du démarrage de l'appel");
        }
    };

    // ── Qualification ─────────────────────────────────────────────────────────
    const alreadyQualified = !!visit?.outcome;

    const handleQualify = async (outcome: TeleVisitOutcome) => {
        if (!visit) return;
        try {
            const updated = await complete(visit.id, {
                outcome,
                notes: callNotes || undefined,
                order_id: outcome === 'ORDER_TAKEN' ? order?.id : undefined,
            });
            setVisit(updated);
            toast.success(`Appel qualifié : ${TELE_VISIT_OUTCOME_LABELS[outcome]}`);
            refetchPlanning();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la qualification');
        }
    };

    // "Terminer la visite" — auto-qualify ORDER_TAKEN if a command was placed during
    // the call, otherwise ask for a reason. This is the single close action that
    // replaces the always-visible 6-button qualification panel.
    const handleEndVisit = () => {
        if (!visit) return;
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (order) {
            handleQualify('ORDER_TAKEN');
        } else {
            setCompleteOutcome('NO_ANSWER');
            setShowCompleteModal(true);
        }
    };

    const confirmComplete = async () => {
        setShowCompleteModal(false);
        await handleQualify(completeOutcome);
    };

    const goToReturn = () => {
        if (!visit) return;
        navigate('/telesales/returns', {
            state: { openCreateForPartner: { id: visit.partner_id, name: visit.partner?.name ?? '', code: visit.partner?.code ?? '' } },
        });
    };

    // ── Catalog (Bloc 3) — offline-first cache once populated, live fallback ──
    const [search, setSearch] = useState('');
    const [pageCode, setPageCode] = useState<string | undefined>(undefined);
    const { pages } = useCatalogPages();

    const partnerId = visit?.partner_id ?? null;
    const { products: cachedProducts } = useCachedCatalog();
    const cachedPartner = useCachedPartner(partnerId);
    const usingCache = cachedProducts.length > 0;
    const { tiers, priceListLines } = usePriceListData(cachedPartner?.price_list_id ?? null);

    const { products: liveProducts, loading: loadingLive } = useCatalogProducts(
        usingCache ? {} : { search: search || undefined, product_page_code: pageCode, partner_id: partnerId ?? undefined, per_page: 100 }
    );

    const estimatedIds = useMemo(() => {
        if (!usingCache || !partnerId) return new Set<number>();
        return new Set(
            cachedProducts
                .filter((p) => resolveLocalPrice(p, 1, cachedPartner, tiers, priceListLines).estimated)
                .map((p) => p.id)
        );
    }, [usingCache, partnerId, cachedProducts, cachedPartner, tiers, priceListLines]);

    const products: CatalogProduct[] = useMemo(() => {
        if (!usingCache) return liveProducts;
        const q = search.trim().toLowerCase();
        return cachedProducts
            .filter((p) => !pageCode || p.product_page_code === pageCode)
            .filter((p) => !q || p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q))
            .map((p): CatalogProduct => {
                const resolved = resolveLocalPrice(p, 1, cachedPartner, tiers, priceListLines);
                return {
                    id: p.id, code: p.code, name: p.name, product_page_code: p.product_page_code,
                    short_description: p.short_description, barcode: p.barcode, brand: p.brand,
                    unit_id: p.unit_id, unit_name: p.unit_name, stock_available: p.stock_available, packagings: p.packagings,
                    price: resolved.unitPriceTtc,
                    price_source: partnerId ? 'partner' : 'generic',
                    price_list: null,
                    tax_rate: p.tax_rate,
                    marketing: p.marketing,
                    flags: p.flags,
                };
            });
    }, [usingCache, cachedProducts, pageCode, search, cachedPartner, tiers, priceListLines, partnerId, liveProducts]);

    const loadingProducts = usingCache ? false : loadingLive;

    // Partner credit snapshot for the cart header — best-effort, hidden if the
    // endpoint errors (not every partner is on credit terms).
    const [creditStatus, setCreditStatus] = useState<PartnerCreditStatus | null>(null);
    useEffect(() => {
        setCreditStatus(null);
        if (!partnerId) return;
        let cancelled = false;
        telesalesApi.partners.getCreditStatus(partnerId)
            .then((res: any) => {
                const c = res?.credit ?? res?.data ?? res;
                if (!cancelled && c && typeof c.credit_available === 'number') setCreditStatus(c);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [partnerId]);

    // Unified credit source — the embedded `visit.partner.credit` isn't always
    // present (e.g. an adhoc visit started from the portfolio), so fall back to
    // the live GET /partners/{id}/credit-status the right panel already fetches.
    // This is what fixes the "Aucune information de crédit" vs "Solde disponible"
    // mismatch between the two panels.
    const partnerCredit = useMemo(() => {
        if (visit?.partner?.credit) return visit.partner.credit;
        if (creditStatus) return { limit: creditStatus.credit_limit, used: creditStatus.credit_used, available: creditStatus.credit_available };
        return null;
    }, [visit?.partner?.credit, creditStatus]);

    const addProduct = (product: CatalogProduct, quantity = 1) => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!visit) {
            toast.error("Sélectionnez d'abord un appel");
            return;
        }
        setCart((prev) => {
            const existing = prev.find((l) => l.product.id === product.id);
            if (existing) return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l));
            return [...prev, { product, quantity }];
        });
    };

    const updateQuantity = (productId: number, quantity: number) => {
        if (quantity <= 0) {
            setCart((prev) => prev.filter((l) => l.product.id !== productId));
            return;
        }
        setCart((prev) => prev.map((l) => (l.product.id === productId ? { ...l, quantity } : l)));
    };

    const cartProductIds = useMemo(() => new Set(cart.map((l) => l.product.id)), [cart]);
    const indicativeTotal = useMemo(() => cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0), [cart]);

    // ── "Récapitulatif & Soumettre" — covers all 3 steps (docs):
    // POST /orders (first time) OR PUT /orders/{id} (draft already exists — resyncs
    // the cart so promotions/TVA recalculate) → GET /orders/{id}/summary → submit on
    // confirm. Re-openable: closing the summary ("Retour") keeps the cart editable;
    // adding products and re-clicking pushes the changes to the draft and refreshes
    // the récapitulatif.
    const handleReviewAndSubmit = async () => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!visit || cart.length === 0) {
            toast.error('Sélectionnez un client et ajoutez au moins un produit');
            return;
        }
        const items = cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity }));
        let current = order;
        try {
            if (!current) {
                current = await createOrder({ partner_id: visit.partner_id, items, notes: orderNotes || undefined });
                toast.success(`Commande ${current.bc_number} créée`);
            } else {
                // Existing draft — push the current cart so the server recomputes
                // pricing/promotions on the up-to-date lines before we show the summary.
                current = await updateOrder(current.id, { items, notes: orderNotes || undefined });
            }
            setOrder(current);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de l\'enregistrement de la commande');
            return;
        }
        // Fetch the fiscal summary and switch the panier into review mode (inline,
        // no modal). Only shown once the summary is loaded.
        try {
            await fetchSummary(current.id);
            setReviewMode(true);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec du chargement du récapitulatif');
        }
    };

    const exitReview = () => {
        setReviewMode(false);
        resetSummary();
    };

    const handleSubmit = async () => {
        if (!order) return;
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        try {
            const res = await submit(order.id);
            if (res.order) setOrder(res.order);
            toast.success('Commande soumise pour préparation');
        } catch (err: any) {
            // 422 credit-exceeded is a normal business state (docs §5.3), not a hard error.
            if (err?.response?.status === 422 && err?.response?.data?.credit_validation) {
                setCreditIssue(err.response.data.credit_validation);
            } else {
                toast.error(err?.response?.data?.message || 'Échec de la soumission');
            }
        }
    };

    const confirmAndSubmit = async () => {
        await handleSubmit();
        setReviewMode(false);
        resetSummary();
    };

    const handleRequestDerogation = async () => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!order || justification.trim().length < 20) {
            toast.error('Justification requise (20 caractères minimum)');
            return;
        }
        try {
            const res = await requestDerogation(order.id, { justification }, idempotencyKey);
            setOrder((prev) => (prev ? { ...prev, status: res.order.status } : prev));
            setDerogationRequested(true);
            setShowDerogationModal(false);
            setCreditIssue(null);
            toast.success('Dérogation demandée — en attente de validation ADV/CDZ');
        } catch (err: any) {
            const reason = err?.response?.data?.decision?.constraints?.[0]?.reason;
            toast.error(reason || err?.response?.data?.message || 'Échec de la demande de dérogation');
        }
    };

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'code', headerName: 'Code', width: 100, filter: false },
            {
                field: 'name', headerName: 'Produit', flex: 1, minWidth: 180, filter: false,
                cellRenderer: (p: any) => {
                    const flags: ProductFlags | undefined = p.data?.flags;
                    return (
                        <span className={!flags?.is_salable ? 'text-gray-400' : ''}>
                            {p.value}
                            {flags?.requires_refrigeration && <span className="ml-1.5" title="Nécessite la chaîne du froid">🧊</span>}
                            {p.data?.marketing?.is_new && <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-blue-100 text-blue-700 rounded-full">Nouveau</span>}
                            {!flags?.is_salable && <span className="ml-1.5 px-1.5 py-0.5 text-[9px] font-bold bg-gray-100 text-gray-500 rounded-full">Indisponible</span>}
                        </span>
                    );
                },
            },
            { field: 'unit_name', headerName: 'Unité', width: 70, filter: false },
            {
                field: 'price', headerName: 'Prix', width: 110, filter: false,
                cellRenderer: (p: any) => (
                    <span className="font-bold">
                        {Number(p.value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        {estimatedIds.has(p.data?.id) && (
                            <span className="ml-1 text-[10px] font-bold text-amber-500" title="Estimation locale (cache hors-ligne)">≈</span>
                        )}
                    </span>
                ),
            },
            {
                field: 'stock_available', headerName: 'Stock', width: 80, filter: false,
                cellStyle: (p: any): { color: string } => ({ color: (p.value ?? 0) > 0 ? '#059669' : '#dc2626' }),
            },
            {
                headerName: 'Quantité', width: 130, sortable: false, filter: false,
                cellRenderer: (p: any) => (
                    <QuantityCell
                        product={p.data}
                        rowIndex={p.rowIndex}
                        inCart={cartProductIds.has(p.data.id)}
                        disabled={!visit || !sessionActive}
                        onAdd={addProduct}
                    />
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cartProductIds, visit, sessionActive, estimatedIds]
    );

    // ── Left column ───────────────────────────────────────────────────────────

    const visitStatusOf = (v: TeleVisit) => (v.outcome ? 'Qualifié' : v.started_at ? 'En cours' : 'En attente');
    const visitStatusColor = (v: TeleVisit) =>
        v.outcome ? 'bg-emerald-100 text-emerald-700' : v.started_at ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500';

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="px-3 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-1.5">
                    <div className="flex-1 flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => setLeftTab('planning')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                leftTab === 'planning' ? 'bg-white shadow-sm text-sage-700' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Phone className="w-3.5 h-3.5" /> Appels du jour
                        </button>
                        <button
                            onClick={() => setLeftTab('portfolio')}
                            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-bold rounded-md transition-colors ${
                                leftTab === 'portfolio' ? 'bg-white shadow-sm text-sage-700' : 'text-gray-500 hover:text-gray-700'
                            }`}
                        >
                            <Briefcase className="w-3.5 h-3.5" /> Portefeuille
                        </button>
                    </div>
                    <button
                        onClick={refetchPlanning}
                        title="Rafraîchir le planning"
                        className="shrink-0 p-2 rounded-lg text-gray-400 hover:text-sage-600 hover:bg-gray-100 transition-colors"
                    >
                        <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {leftTab === 'portfolio' && (
                <div className="px-3 py-2 border-b border-gray-100 shrink-0">
                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            type="text"
                            value={portfolioSearch}
                            onChange={(e) => setPortfolioSearch(e.target.value)}
                            placeholder="Rechercher un partenaire..."
                            className="w-full pl-8 pr-3 py-1.5 text-xs border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-sage-500 focus:bg-white transition-all"
                        />
                    </div>
                </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto">
                {leftTab === 'planning' ? (
                    loadingPlanning ? (
                        <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                    ) : planningVisits.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4 text-center">
                            <CalendarDays className="w-8 h-8 mb-2 text-gray-300" />
                            <p className="text-xs">Aucun appel planifié aujourd'hui</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {planningVisits.map((v) => {
                                const isSelected = visit?.id === v.id;
                                // Prefer the live active-visit state for the row that's open, so a
                                // call we just started (or resumed via the 422 path) shows "En cours"
                                // immediately even if the planning list's started_at was still stale.
                                const effective = isSelected && visit ? visit : v;
                                const started = !!effective.started_at && !effective.outcome;
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => handleSelectPlanning(v)}
                                        disabled={startingCall}
                                        className={`w-full text-left px-4 py-3 transition-colors border-l-2 disabled:opacity-50 ${
                                            isSelected ? 'bg-sage-50 border-l-sage-500' : started ? 'border-l-amber-400 hover:bg-gray-50' : 'border-l-transparent hover:bg-gray-50'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between gap-2 mb-1.5">
                                            <span className="inline-flex items-center gap-1 text-xs font-bold text-gray-900">
                                                <Clock className="w-3.5 h-3.5 text-sage-600" />
                                                {v.scheduled_at ? new Date(v.scheduled_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }) : '--:--'}
                                            </span>
                                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${visitStatusColor(effective)}`}>
                                                {started && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />}
                                                {visitStatusOf(effective)}
                                            </span>
                                        </div>
                                        <p className="text-xs font-semibold text-gray-800 truncate">{v.partner?.name ?? `Partenaire #${v.partner_id}`}</p>
                                        {v.partner?.code && <p className="text-[10px] text-gray-400 mt-0.5">{v.partner.code}</p>}
                                    </button>
                                );
                            })}
                        </div>
                    )
                ) : loadingPortfolio ? (
                    <div className="flex items-center justify-center h-32 text-gray-400"><Loader2 className="w-5 h-5 animate-spin" /></div>
                ) : portfolioPartners.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400 px-4 text-center">
                        <Briefcase className="w-8 h-8 mb-2 text-gray-300" />
                        <p className="text-xs">Aucun partenaire assigné</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {portfolioPartners.map((p) => {
                            const isSelected = visit?.partner_id === p.id;
                            return (
                                <button
                                    key={p.id}
                                    onClick={() => handleSelectPortfolio(p)}
                                    disabled={startingCall}
                                    className={`w-full text-left px-4 py-3 transition-colors border-l-2 disabled:opacity-50 ${
                                        isSelected ? 'bg-sage-50 border-l-sage-500' : 'border-l-transparent hover:bg-gray-50'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="min-w-0">
                                            <p className="text-xs font-semibold text-gray-800 truncate">{p.name}</p>
                                            <p className="text-[10px] text-gray-400 mt-0.5">{p.code}</p>
                                        </div>
                                        <p className="shrink-0 text-xs font-bold text-emerald-600">
                                            {p.credit_available.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                                        </p>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Reusable catalog + cart (shared between docked layout and fullscreen) ──

    // Search + category pages + product grid. Rendered inline in the center column,
    // or full-viewport in the fullscreen overlay. The maximize/minimize icon on the
    // search row toggles between the two.
    const catalogInner = (
        <div className="flex-1 min-h-0 flex flex-col">
            <div className="shrink-0 mb-2 space-y-2">
                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Rechercher un produit par nom ou code..."
                            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                        />
                    </div>
                    <button
                        onClick={() => setCatalogFullscreen((f) => !f)}
                        title={catalogFullscreen ? 'Quitter le plein écran' : 'Catalogue en plein écran'}
                        className="shrink-0 p-2 rounded-lg border border-gray-200 text-gray-400 hover:text-sage-600 hover:border-sage-300 transition-colors"
                    >
                        {catalogFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 overflow-x-auto pb-0.5">
                    <button
                        onClick={() => setPageCode(undefined)}
                        className={`shrink-0 flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                            !pageCode ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sage-300'
                        }`}
                    >
                        <LayoutGrid className="w-3 h-3" /> Toutes
                    </button>
                    {pages.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => setPageCode(p.code)}
                            className={`shrink-0 px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                                pageCode === p.code ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sage-300'
                            }`}
                        >
                            {p.name}
                        </button>
                    ))}
                </div>
            </div>
            <div className="flex-1 min-h-0 rounded-xl border border-gray-200 overflow-hidden bg-white">
                <DataGrid rowData={products} columnDefs={columnDefs} loading={loadingProducts} rowHeight={42} />
            </div>
        </div>
    );

    // Cart body (three states: no visit / order created / editing cart) — shared by
    // the docked right panel and the fullscreen overlay's cart column.
    // Show the read-only "order submitted" view only once the order actually leaves
    // draft (after /submit). While it's still a draft, keep the editable cart so the
    // agent can add products and re-open a fresh récapitulatif.
    const orderSubmitted = !!order && order.status !== 'draft';
    const cartBody = !visit ? (
        <div className="flex-1 flex items-center justify-center text-center text-gray-400 px-6">
            <p className="text-xs">Sélectionnez un appel pour démarrer une commande</p>
        </div>
    ) : orderSubmitted && order ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div className="bg-sage-50 border border-sage-100 rounded-xl p-4">
                <div className="text-sm font-bold text-gray-800">{order.bc_number}</div>
                <div className="text-2xl font-black text-sage-700 mt-1">{order.final_total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                <div className="text-xs text-gray-400 mt-1">{order.items_count} article(s)</div>
                <StatusPill label={order.status_label || order.status} accent="emerald" />
            </div>
            {derogationRequested && (
                <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">
                    <Clock className="w-4 h-4" /> En attente de validation ADV/CDZ
                </div>
            )}
            <button
                onClick={() => { setOrder(null); setCart([]); }}
                className="w-full px-4 py-2 text-xs font-bold text-gray-500 hover:text-gray-700"
            >
                Nouvelle commande pour ce client
            </button>
        </div>
    ) : reviewMode && summary ? (
        // Récapitulatif fiscal INLINE dans le panier — pas de modale.
        <>
            <div className="px-4 pt-3 shrink-0">
                <div className="text-sm font-bold text-gray-800">{summary.bc_number}</div>
                <div className="text-[11px] text-gray-400">{summary.partner.name} ({summary.partner.code})</div>
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-1.5">
                {summary.items.map((item) => (
                    <div key={item.product_id} className="p-2 bg-gray-50 rounded-lg">
                        <div className="text-xs font-semibold text-gray-800 truncate">{item.product_name}</div>
                        <div className="flex items-center justify-between mt-0.5 text-[11px] text-gray-500">
                            <span>
                                {item.quantity} × {item.promotion.applied ? (
                                    <>
                                        <span className="line-through text-gray-300">{item.unit_price_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>{' '}
                                        {item.promotion.unit_price_ttc_after_discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                    </>
                                ) : item.unit_price_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </span>
                            <span className="font-bold text-gray-800">{item.line_total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                        </div>
                        {item.promotion.applied && (
                            <span className="inline-flex items-center gap-1 mt-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-100 text-emerald-700">
                                <Tag className="w-2.5 h-2.5" /> Promo -{item.promotion.discount_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                            </span>
                        )}
                    </div>
                ))}
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 space-y-3">
                <div className="space-y-1 text-xs">
                    <div className="flex justify-between text-gray-500"><span>Sous-total HT</span><span>{summary.totals.sub_total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span></div>
                    <div className="flex justify-between text-gray-500"><span>TVA</span><span>{summary.totals.tva_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span></div>
                    {summary.totals.promotion_discount > 0 && (
                        <div className="flex justify-between text-emerald-600 font-semibold"><span>Remise totale</span><span>-{summary.totals.promotion_discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span></div>
                    )}
                    <div className="flex justify-between text-sm font-black text-gray-900 pt-1.5 border-t border-gray-200"><span>Total TTC</span><span>{summary.totals.payable_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span></div>
                </div>
                {!sessionActive && <SessionRequiredNotice />}
                <div className="flex items-center gap-2">
                    <button
                        onClick={exitReview}
                        className="flex-1 px-3 py-2.5 text-sm font-bold text-gray-700 bg-gray-100 rounded-xl hover:bg-gray-200 transition-colors"
                    >
                        Retour
                    </button>
                    <button
                        onClick={confirmAndSubmit}
                        disabled={submitting || !sessionActive}
                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        Soumettre
                    </button>
                </div>
            </div>
        </>
    ) : (
        <>
            {creditStatus && (
                <div className="mx-4 mt-3 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5 shrink-0">
                    <Wallet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <div className="text-xs text-blue-700">
                        Solde disponible : <strong>{creditStatus.credit_available.toLocaleString('fr-FR')} MAD</strong>
                    </div>
                </div>
            )}
            <div className="flex-1 overflow-y-auto px-4 pt-3 space-y-2">
                {cart.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 text-center">Ajoutez des produits depuis le catalogue</p>
                ) : (
                    cart.map((line) => (
                        <div key={line.product.id} className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg">
                            <div className="flex-1 min-w-0">
                                <div className="text-xs font-semibold text-gray-700 truncate">{line.product.name}</div>
                                <div className="text-[11px] text-gray-400">{line.product.price.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                            </div>
                            <input
                                type="number"
                                min={Math.max(1, line.product.flags.min_quantity_order || 1)}
                                step={line.product.flags.decimal_quantity_allowed ? 0.01 : 1}
                                value={line.quantity}
                                onChange={(e) => {
                                    const min = Math.max(1, line.product.flags.min_quantity_order || 1);
                                    const raw = Math.max(min, Number(e.target.value));
                                    updateQuantity(line.product.id, line.product.flags.decimal_quantity_allowed ? raw : Math.round(raw));
                                }}
                                className="w-14 px-1.5 py-1 text-xs text-center border border-gray-200 rounded"
                            />
                            <button onClick={() => updateQuantity(line.product.id, 0)} className="text-red-400 hover:text-red-600">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    ))
                )}
            </div>
            <div className="p-4 border-t border-gray-100 shrink-0 space-y-3">
                {cart.length > 0 && (
                    <div className="flex items-center justify-between text-sm font-bold text-gray-700">
                        <span>Total indicatif</span>
                        <span>{indicativeTotal.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                    </div>
                )}
                {!sessionActive && <SessionRequiredNotice />}
                <textarea
                    value={orderNotes}
                    onChange={(e) => setOrderNotes(e.target.value)}
                    placeholder="Notes de commande (optionnel)"
                    rows={2}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                />
                <button
                    onClick={handleReviewAndSubmit}
                    disabled={creating || updatingOrder || cart.length === 0 || !sessionActive}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {(creating || updatingOrder) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Receipt className="w-4 h-4" />}
                    Récapitulatif & Soumettre
                </button>
            </div>
        </>
    );

    // ── Center column — profile/credit + qualification + catalog ────────────

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden bg-slate-50/50">
            {/* Session controls live here (compact, in the header actions slot) instead of a
                full-width strip below — reclaims the vertical space for the catalog grid. */}
            <DetailHeader
                icon={Phone}
                title={visit ? (visit.partner?.name ?? `Partenaire #${visit.partner_id}`) : 'Cockpit Télévendeur'}
                subtitle={visit ? visit.partner?.code : 'Sélectionnez un appel à gauche pour démarrer'}
                accent="sage"
            />

            {!visit ? (
                <div className="flex-1 flex items-center justify-center text-gray-400">
                    <div className="text-center max-w-xs">
                        <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                            <Phone className="w-7 h-7 text-gray-300" />
                        </div>
                        <p className="text-sm font-semibold text-gray-500">Aucun appel actif</p>
                        <p className="text-xs text-gray-400 mt-1">Choisissez un appel planifié ou un partenaire du portefeuille à gauche.</p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                    {/* Client + qualification strip. Collapsible — when collapsed it becomes a
                        single summary line so the catalog grid takes the full screen height. */}
                    {topCollapsed ? (
                        <div className="shrink-0 px-5 pt-3">
                            <button
                                onClick={() => setTopCollapsed(false)}
                                className="w-full flex items-center justify-between gap-3 bg-white rounded-xl border border-gray-100 shadow-sm px-3 py-2 hover:border-sage-200 transition-colors"
                            >
                                <div className="flex items-center gap-2 min-w-0">
                                    <div className="w-6 h-6 rounded-md bg-sage-100 flex items-center justify-center shrink-0 text-sage-700 font-bold text-[10px]">
                                        {(visit.partner?.name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                    </div>
                                    <span className="text-xs font-bold text-gray-900 truncate">{visit.partner?.name ?? `Partenaire #${visit.partner_id}`}</span>
                                    <span className="text-[10px] text-gray-400 shrink-0">{visit.partner?.code}</span>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    {partnerCredit && <span className="hidden sm:inline text-[11px] font-bold text-emerald-700">{partnerCredit.available.toLocaleString('fr-FR')} MAD dispo.</span>}
                                    {alreadyQualified ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700"><CheckCircle2 className="w-3 h-3" /> {OUTCOME_SHORT[visit.outcome!]}</span>
                                    ) : (
                                        <span className="text-[10px] font-bold text-amber-500">Non qualifié</span>
                                    )}
                                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-400"><ChevronDown className="w-3.5 h-3.5" /> Détails</span>
                                </div>
                            </button>
                        </div>
                    ) : (
                    <div className="shrink-0 px-5 pt-3">
                        <div className="flex items-center justify-end -mb-0.5">
                            <button
                                onClick={() => setTopCollapsed(true)}
                                className="flex items-center gap-1 text-[11px] font-semibold text-gray-400 hover:text-sage-600 px-2 py-0.5"
                            >
                                <ChevronUp className="w-3.5 h-3.5" /> Réduire pour agrandir le catalogue
                            </button>
                        </div>
                        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 items-start">
                        {/* Bloc 1 — Profil client & crédit (100% visible) */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-sage-100 to-sage-200 flex items-center justify-center shrink-0 text-sage-700 font-bold text-xs">
                                    {(visit.partner?.name ?? '?').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
                                </div>
                                <div className="min-w-0 flex-1">
                                    <div className="text-sm font-bold text-gray-900 truncate">{visit.partner?.name ?? `Partenaire #${visit.partner_id}`}</div>
                                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-gray-500">
                                        <span className="font-semibold text-gray-400">{visit.partner?.code}</span>
                                        {visit.partner?.phone && <span className="inline-flex items-center gap-1"><PhoneCall className="w-3 h-3 text-sage-600" />{visit.partner.phone}</span>}
                                        {visit.partner?.address?.city && <span className="inline-flex items-center gap-1"><MapPin className="w-3 h-3 text-sage-600" />{visit.partner.address.city}</span>}
                                    </div>
                                </div>
                            </div>
                            {partnerCredit ? (
                                <div>
                                    <div className="flex items-center justify-between text-[11px] mb-1">
                                        <span className="inline-flex items-center gap-1 font-semibold text-gray-400 uppercase"><Wallet className="w-3 h-3" /> Encours crédit</span>
                                        <span className="font-bold text-emerald-700">{partnerCredit.available.toLocaleString('fr-FR')} <span className="text-gray-400 font-medium">/ {partnerCredit.limit.toLocaleString('fr-FR')} MAD</span></span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className={`h-full rounded-full transition-all ${
                                                partnerCredit.limit > 0 && partnerCredit.used / partnerCredit.limit > 0.9
                                                    ? 'bg-red-500' : partnerCredit.limit > 0 && partnerCredit.used / partnerCredit.limit > 0.7 ? 'bg-amber-500' : 'bg-emerald-500'
                                            }`}
                                            style={{ width: `${partnerCredit.limit > 0 ? Math.min(100, (partnerCredit.used / partnerCredit.limit) * 100) : 0}%` }}
                                        />
                                    </div>
                                </div>
                            ) : (
                                <div className="text-[11px] text-gray-400">Aucune information de crédit</div>
                            )}
                        </div>

                        {/* Bloc 2 — Contrôle d'appel. Plus de pâté de boutons : l'agent
                            travaille (panier / retour) puis clôture. La qualification est
                            déduite automatiquement (commande passée → ORDER_TAKEN) ou
                            demandée dans une petite modale de motif si aucune commande. */}
                        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 space-y-2.5">
                            <div className="flex items-center justify-between">
                                <label className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase">
                                    <StickyNote className="w-3 h-3" /> Appel en cours
                                </label>
                                {alreadyQualified && (
                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold">
                                        <CheckCircle2 className="w-3 h-3" /> Clôturé · {OUTCOME_SHORT[visit.outcome!]}
                                    </span>
                                )}
                            </div>
                            {!sessionActive && !alreadyQualified && <SessionRequiredNotice />}
                            <input
                                type="text"
                                value={callNotes}
                                onChange={(e) => setCallNotes(e.target.value)}
                                disabled={alreadyQualified || !sessionActive}
                                placeholder="Notes de l'appel..."
                                className="w-full px-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/30 disabled:bg-gray-100 disabled:text-gray-400"
                            />
                            {!alreadyQualified && (
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={goToReturn}
                                        disabled={!sessionActive}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-700 bg-rose-50 border border-rose-100 rounded-lg hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <RotateCcw className="w-3.5 h-3.5" /> Créer un retour
                                    </button>
                                    <button
                                        onClick={handleEndVisit}
                                        disabled={completing || !sessionActive}
                                        title={order ? 'Commande passée — clôture en ORDER_TAKEN' : "Choisir un motif de fin d'appel"}
                                        className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-white bg-gradient-to-r from-sage-600 to-sage-700 rounded-lg shadow-sm hover:shadow disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                    >
                                        {completing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <PhoneOff className="w-3.5 h-3.5" />}
                                        Terminer la visite
                                    </button>
                                </div>
                            )}
                            {alreadyQualified && (visit.order_id || order) && (
                                <div className="flex items-center gap-2 text-[11px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" /> Commande #{visit.order_id ?? order?.id} liée à cet appel
                                </div>
                            )}
                        </div>
                        </div>
                    </div>
                    )}

                    {/* Bloc 3 — Catalogue (flex-1, prend toute la hauteur restante).
                        Masqué quand le catalogue est en plein écran (overlay dédié). */}
                    <div className="flex-1 min-h-0 flex flex-col px-5 pb-4 pt-3">
                        {catalogFullscreen ? (
                            <button
                                onClick={() => setCatalogFullscreen(false)}
                                className="flex-1 min-h-0 flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-200 text-gray-400 hover:border-sage-300 hover:text-sage-600 transition-colors"
                            >
                                <Minimize2 className="w-8 h-8 mb-2" />
                                <span className="text-sm font-semibold">Catalogue en plein écran</span>
                                <span className="text-xs">Cliquez pour revenir à la vue standard</span>
                            </button>
                        ) : (
                            catalogInner
                        )}
                    </div>
                </div>
            )}
        </div>
    );

    // ── Right column — panier live & validation ──────────────────────────────

    const rightContent = (
        <div className={`h-full bg-white border-l border-gray-200 flex flex-col transition-all ${panierCollapsed ? 'w-12' : 'w-96'}`}>
            <div className={`flex items-center border-b border-gray-100 shrink-0 ${panierCollapsed ? 'justify-center py-3' : 'justify-between px-4 py-3'}`}>
                {!panierCollapsed && (
                    <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                        <ShoppingCart className="w-3.5 h-3.5" /> Panier
                        {cart.length > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{cart.length}</span>}
                    </span>
                )}
                <button
                    onClick={() => setPanierCollapsed((c) => !c)}
                    title={panierCollapsed ? 'Afficher le panier' : 'Réduire le panier'}
                    className="p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                >
                    {panierCollapsed ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                </button>
            </div>

            {panierCollapsed ? (
                <button
                    onClick={() => setPanierCollapsed(false)}
                    className="flex-1 flex flex-col items-center pt-4 gap-2 text-gray-400 hover:text-sage-600"
                    title="Afficher le panier"
                >
                    <ShoppingCart className="w-5 h-5" />
                    {cart.length > 0 && (
                        <span className="w-6 h-6 flex items-center justify-center rounded-full bg-sage-100 text-sage-700 text-xs font-bold">{cart.length}</span>
                    )}
                </button>
            ) : (
                cartBody
            )}
        </div>
    );

    // ── Fullscreen catalog overlay — catalog + pages + cart, nothing else ──────
    const fullscreenOverlay = catalogFullscreen && (
        <div className="fixed inset-0 z-[70] bg-slate-50 flex flex-col">
            <div className="shrink-0 flex items-center justify-between px-5 py-3 bg-white border-b border-gray-200">
                <div className="flex items-center gap-3 min-w-0">
                    <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                        <ShoppingCart className="w-4.5 h-4.5 text-sage-600" />
                    </div>
                    <div className="min-w-0">
                        <div className="text-sm font-extrabold text-gray-900 truncate">Catalogue — {visit?.partner?.name ?? `Partenaire #${visit?.partner_id}`}</div>
                        <div className="text-[11px] text-gray-400">Prise de commande rapide</div>
                    </div>
                </div>
                <button
                    onClick={() => setCatalogFullscreen(false)}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                >
                    <Minimize2 className="w-3.5 h-3.5" /> Quitter le plein écran
                </button>
            </div>
            <div className="flex-1 min-h-0 flex overflow-hidden">
                <div className="flex-1 min-w-0 flex flex-col p-4">
                    {catalogInner}
                </div>
                <div className="w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col">
                    <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                        <span className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                            <ShoppingCart className="w-3.5 h-3.5" /> Panier
                            {cart.length > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{cart.length}</span>}
                        </span>
                    </div>
                    {cartBody}
                </div>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={leftContent}
                mainContent={mainContent}
                rightContent={rightContent}
                topBarContent={<TelesalesSessionBanner compact />}
            />

            {fullscreenOverlay}

            {/* Motif de fin d'appel — ouvert par "Terminer la visite" quand aucune
                commande n'a été passée (sinon clôture auto en ORDER_TAKEN). */}
            <Modal isOpen={showCompleteModal} onClose={() => setShowCompleteModal(false)} title="Motif de fin d'appel" size="sm">
                <div className="p-5 space-y-4">
                    <p className="text-sm text-gray-500">
                        Aucune commande n'a été passée durant cet appel. Sélectionnez le motif de clôture :
                    </p>
                    <div className="space-y-1.5">
                        {CLOSE_REASONS.map((reason) => {
                            const { icon: Icon, iconBg, iconColor } = OUTCOME_CONFIG[reason];
                            const isSelected = completeOutcome === reason;
                            return (
                                <button
                                    key={reason}
                                    onClick={() => setCompleteOutcome(reason)}
                                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm font-semibold text-left transition-all ${
                                        isSelected ? 'bg-sage-50 border-sage-300 ring-1 ring-sage-200 text-gray-900' : 'bg-white border-gray-100 hover:bg-gray-50 hover:border-gray-200 text-gray-600'
                                    }`}
                                >
                                    <span className={`w-8 h-8 rounded-lg ${iconBg} flex items-center justify-center shrink-0`}>
                                        <Icon className={`w-4 h-4 ${iconColor}`} />
                                    </span>
                                    {TELE_VISIT_OUTCOME_LABELS[reason]}
                                    {isSelected && <CheckCircle2 className="w-4 h-4 text-sage-600 ml-auto shrink-0" />}
                                </button>
                            );
                        })}
                    </div>
                    <input
                        type="text"
                        value={callNotes}
                        onChange={(e) => setCallNotes(e.target.value)}
                        placeholder="Notes (optionnel)"
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/30"
                    />
                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={() => setShowCompleteModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button
                            onClick={confirmComplete}
                            disabled={completing}
                            className="flex items-center gap-2 px-5 py-2 text-sm font-bold text-white bg-gradient-to-r from-sage-600 to-sage-700 rounded-lg hover:shadow disabled:opacity-50"
                        >
                            {completing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhoneOff className="w-4 h-4" />}
                            Clôturer la visite
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Credit exceeded on submit (docs §5.3) — normal business state, offer derogation. */}
            <Modal isOpen={!!creditIssue} onClose={() => setCreditIssue(null)} title="Plafond de crédit dépassé" size="md">
                {creditIssue && (
                    <div className="p-5 space-y-4">
                        <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                            <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                            <div className="text-sm text-red-700">
                                Dépassement de <strong>{(creditIssue.warnings[0]?.excess_amount ?? (creditIssue.order_amount - creditIssue.credit_available)).toLocaleString('fr-FR')} MAD</strong>.
                                Crédit disponible : {creditIssue.credit_available.toLocaleString('fr-FR')} MAD, montant commande : {creditIssue.order_amount.toLocaleString('fr-FR')} MAD.
                            </div>
                        </div>
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setCreditIssue(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                Annuler
                            </button>
                            <button
                                onClick={() => { setShowDerogationModal(true); setCreditIssue(null); }}
                                className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700"
                            >
                                Demander une dérogation ADV
                            </button>
                        </div>
                    </div>
                )}
            </Modal>

            <Modal isOpen={showDerogationModal} onClose={() => setShowDerogationModal(false)} title="Demande de dérogation crédit" size="md">
                <div className="p-5 space-y-4">
                    {!sessionActive && <SessionRequiredNotice />}
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Justification (min. 20 caractères)</label>
                        <textarea
                            value={justification}
                            onChange={(e) => setJustification(e.target.value)}
                            rows={4}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                        />
                        <div className={`text-xs mt-1 ${justification.trim().length >= 20 ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {justification.trim().length}/20 caractères minimum
                        </div>
                    </div>
                    <div className="flex justify-end gap-3">
                        <button onClick={() => setShowDerogationModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button
                            onClick={handleRequestDerogation}
                            disabled={requestingDerogation || justification.trim().length < 20 || !sessionActive}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50"
                        >
                            {requestingDerogation && <Loader2 className="w-4 h-4 animate-spin" />}
                            Demander la dérogation
                        </button>
                    </div>
                </div>
            </Modal>
        </>
    );
};

export default TelesalesCockpitPage;
