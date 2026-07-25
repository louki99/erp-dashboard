import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { ColDef } from 'ag-grid-community';
import {
    ShoppingCart, Trash2, Loader2, ArrowLeft, AlertTriangle, CheckCircle2, Clock,
    Search, Plus, Check, LayoutGrid, Wallet, ChevronsRight, ChevronsLeft, Receipt, Tag,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { TelesalesSessionBanner } from '@/components/telesales/TelesalesSessionBanner';
import { SessionRequiredNotice } from '@/components/telesales/SessionRequiredNotice';
import { SyncStatusBadge } from '@/components/telesales/SyncStatusBadge';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { useCreateOrder, useSubmitOrder, useRequestDerogation, useOrderDetail, useOrderSummary } from '@/hooks/telesales/useTelesalesOrders';
import { useCatalogProducts, useCatalogPages } from '@/hooks/telesales/useTelesalesCatalog';
import { useSessionGate } from '@/hooks/telesales/useSessionGate';
import { useCachedCatalog, useCachedPartner } from '@/hooks/telesales/useTelesalesSync';
import { usePriceListData } from '@/hooks/telesales/usePriceListData';
import { resolveLocalPrice } from '@/lib/telesales/priceResolver';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { CatalogProduct, TelesalesOrder, CreditValidation, PartnerCreditStatus, ProductFlags } from '@/types/telesalesAgent.types';

interface CartLine {
    product: CatalogProduct;
    quantity: number;
}

interface LocationState {
    visitId?: number;
    partnerId?: number;
    partnerName?: string;
    partnerCode?: string;
}

// ─── Inline quantity cell (Sadi9 ultra-fast entry) ───────────────────────────
// Enter or the "+" button adds the row to the cart and moves focus to the next
// row's quantity input — kept local/uncontrolled per row so typing never gets
// reset by unrelated grid re-renders (cart highlight, search debounce, etc).
interface QuantityCellProps {
    product: CatalogProduct;
    rowIndex: number;
    inCart: boolean;
    disabled: boolean;
    onAdd: (product: CatalogProduct, quantity: number) => void;
}

const QuantityCell = ({ product, rowIndex, inCart, disabled, onAdd }: QuantityCellProps) => {
    // product_flags: quantité minimale de commande et autorisation de quantité
    // décimale sont des règles métier réelles, pas juste des suggestions UI.
    const minQty = Math.max(1, product.flags.min_quantity_order || 1);
    const allowDecimal = product.flags.decimal_quantity_allowed;
    const notSalable = !product.flags.is_salable;
    const isDisabled = disabled || notSalable;

    const [qty, setQty] = useState(minQty);
    const inputRef = useRef<HTMLInputElement>(null);

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
                ref={inputRef}
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

export const TelesalesOrderPage = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { id: existingOrderId } = useParams<{ id?: string }>();
    const state = (location.state as LocationState | null) ?? {};

    const [cartCollapsed, setCartCollapsed] = useState(false);

    const [partner, setPartner] = useState<PartnerPickerOption | null>(
        state.partnerId ? { id: state.partnerId, name: state.partnerName ?? '', code: state.partnerCode ?? '' } : null
    );
    const [cart, setCart] = useState<CartLine[]>([]);
    const [notes, setNotes] = useState('');

    // Viewing an existing order (e.g. redirected here after converting a devis, docs §6.4) —
    // skip the cart/create step and load it directly via GET /orders/{id}. `order` is derived
    // from whichever source is active rather than copied into a separate state via an effect.
    const { order: fetchedOrder, setOrder: setFetchedOrder, loading: loadingExisting } = useOrderDetail(existingOrderId ? Number(existingOrderId) : null);
    const [createdOrder, setCreatedOrder] = useState<TelesalesOrder | null>(null);
    const order = existingOrderId ? fetchedOrder : createdOrder;
    const setOrder = existingOrderId ? setFetchedOrder : setCreatedOrder;

    const { createOrder, loading: creating } = useCreateOrder();
    const { submit, loading: submitting } = useSubmitOrder();
    const { requestDerogation, loading: requestingDerogation } = useRequestDerogation();
    const { sessionActive } = useSessionGate();

    const [creditIssue, setCreditIssue] = useState<CreditValidation | null>(null);
    const [showDerogationModal, setShowDerogationModal] = useState(false);
    const [justification, setJustification] = useState('');
    const [idempotencyKey] = useState(() => crypto.randomUUID());
    const [derogationRequested, setDerogationRequested] = useState(false);

    // §5.2-bis — récapitulatif prix/promo/TVA, relecture obligatoire avant /submit.
    const { summary, loading: loadingSummary, fetchSummary, reset: resetSummary } = useOrderSummary();
    const [showSummaryModal, setShowSummaryModal] = useState(false);

    // ── Catalogue (center DataGrid) ──────────────────────────────────────────
    // §4.4 — prefer the offline-first cache once populated (instant, no round-trip
    // per keystroke); fall back to the live paginated endpoint before the first sync.
    const [search, setSearch] = useState('');
    const [pageCode, setPageCode] = useState<string | undefined>(undefined);
    const { pages } = useCatalogPages();

    const { products: cachedProducts } = useCachedCatalog();
    const cachedPartner = useCachedPartner(partner?.id ?? null);
    const usingCache = cachedProducts.length > 0;

    const { tiers, priceListLines } = usePriceListData(cachedPartner?.price_list_id ?? null);

    const { products: liveProducts, loading: loadingLive } = useCatalogProducts(
        usingCache ? {} : { search: search || undefined, product_page_code: pageCode, partner_id: partner?.id, per_page: 100 }
    );

    const estimatedIds = useMemo(() => {
        if (!usingCache || !partner) return new Set<number>();
        return new Set(
            cachedProducts
                .filter((p) => resolveLocalPrice(p, 1, cachedPartner, tiers, priceListLines).estimated)
                .map((p) => p.id)
        );
    }, [usingCache, partner, cachedProducts, cachedPartner, tiers, priceListLines]);

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
                    price_source: partner ? 'partner' : 'generic',
                    // The cache never carries a partner-resolved price_list — local calc only
                    // reproduces the base price, not the full server-side list resolution.
                    price_list: null,
                    tax_rate: p.tax_rate,
                    marketing: p.marketing,
                    flags: p.flags,
                };
            });
    }, [usingCache, cachedProducts, pageCode, search, cachedPartner, tiers, priceListLines, partner, liveProducts]);

    const loadingProducts = usingCache ? false : loadingLive;

    // Partner credit snapshot for the cart header — best-effort, hidden if the
    // endpoint errors (not every partner is on credit terms).
    const [creditStatus, setCreditStatus] = useState<PartnerCreditStatus | null>(null);
    useEffect(() => {
        setCreditStatus(null);
        if (!partner) return;
        let cancelled = false;
        telesalesApi.partners.getCreditStatus(partner.id)
            .then((res: any) => {
                const c = res?.credit ?? res?.data ?? res;
                if (!cancelled && c && typeof c.credit_available === 'number') setCreditStatus(c);
            })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [partner]);

    const addProduct = (product: CatalogProduct, quantity = 1) => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!partner) {
            toast.error('Sélectionnez un partenaire avant d\'ajouter des produits');
            return;
        }
        setCart((prev) => {
            const existing = prev.find((l) => l.product.id === product.id);
            if (existing) {
                return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + quantity } : l));
            }
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

    const indicativeTotal = useMemo(
        () => cart.reduce((sum, l) => sum + l.product.price * l.quantity, 0),
        [cart]
    );

    const cartProductIds = useMemo(() => new Set(cart.map((l) => l.product.id)), [cart]);

    const handleCreateOrder = async () => {
        if (!sessionActive) {
            toast.error('Démarrez votre session pour effectuer cette action');
            return;
        }
        if (!partner || cart.length === 0) {
            toast.error('Sélectionner un partenaire et au moins un produit');
            return;
        }
        try {
            const created = await createOrder({
                partner_id: partner.id,
                items: cart.map((l) => ({ product_id: l.product.id, quantity: l.quantity })),
                notes: notes || undefined,
            });
            setOrder(created);
            toast.success(`Commande ${created.bc_number} créée`);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la création de la commande');
        }
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

    const openSummary = async () => {
        if (!order) return;
        setShowSummaryModal(true);
        try {
            await fetchSummary(order.id);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec du chargement du récapitulatif');
            setShowSummaryModal(false);
        }
    };
    const closeSummary = () => {
        setShowSummaryModal(false);
        resetSummary();
    };
    const confirmAndSubmit = async () => {
        await handleSubmit();
        closeSummary();
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

    const goBackToVisit = () => {
        if (state.visitId) {
            navigate(`/telesales/visits/${state.visitId}`, { state: { orderId: order?.id } });
        } else {
            navigate('/telesales/planning');
        }
    };

    const columnDefs = useMemo<ColDef[]>(
        // `filter: false` on every column here — the grid only ever holds the current
        // server-fetched page (per_page: 100), so ag-grid's client-side floating filter
        // can only search what's already loaded and silently misses everything else
        // ("No Matching Rows" even when the product exists). The search bar above the
        // grid already does a real server-side `search=` request — keep that as the
        // single source of truth instead of a second, broken-looking search box.
        () => [
            { field: 'code', headerName: 'Code', width: 110, filter: false },
            {
                field: 'name', headerName: 'Produit', flex: 1, minWidth: 200, filter: false,
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
            { field: 'unit_name', headerName: 'Unité', width: 80, filter: false },
            {
                field: 'price', headerName: 'Prix Partner', width: 120, filter: false,
                cellRenderer: (p: any) => (
                    <span className="font-bold">
                        {Number(p.value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                        {estimatedIds.has(p.data?.id) && (
                            <span className="ml-1 text-[10px] font-bold text-amber-500" title="Estimation locale (cache hors-ligne) — confirmé à la création de la commande">≈</span>
                        )}
                    </span>
                ),
            },
            {
                field: 'stock_available', headerName: 'Stock', width: 90, filter: false,
                cellStyle: (p: any): { color: string } => ({ color: (p.value ?? 0) > 0 ? '#059669' : '#dc2626' }),
            },
            {
                headerName: 'Quantité', width: 130, sortable: false, filter: false,
                cellRenderer: (p: any) => (
                    <QuantityCell
                        product={p.data}
                        rowIndex={p.rowIndex}
                        inCart={cartProductIds.has(p.data.id)}
                        disabled={!partner || !sessionActive}
                        onAdd={addProduct}
                    />
                ),
            },
        ],
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [cartProductIds, partner, sessionActive, estimatedIds]
    );

    // §5.2-bis — read-only relecture: reflects exactly what the pricing/promotions
    // engine already computed at creation, never recomputed here. Shared between
    // both render branches below (new-order cart panel and existing-order view).
    const summaryModal = (
        <Modal isOpen={showSummaryModal} onClose={closeSummary} title="Récapitulatif de la commande" size="lg">
            {loadingSummary ? (
                <div className="flex items-center justify-center h-40">
                    <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
                </div>
            ) : !summary ? (
                <div className="p-8 text-center text-gray-400">Récapitulatif indisponible</div>
            ) : (
                <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <div className="text-sm font-bold text-gray-800">{summary.bc_number}</div>
                            <div className="text-xs text-gray-400">{summary.partner.name} ({summary.partner.code})</div>
                        </div>
                    </div>

                    <div className="border border-gray-100 rounded-xl overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-gray-50 text-left text-[11px] font-bold text-gray-500 uppercase">
                                    <th className="px-3 py-2">Produit</th>
                                    <th className="px-3 py-2 text-right">Qté</th>
                                    <th className="px-3 py-2 text-right">PU TTC</th>
                                    <th className="px-3 py-2 text-right">Total TTC</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {summary.items.map((item) => (
                                    <tr key={item.product_id}>
                                        <td className="px-3 py-2">
                                            <div className="font-semibold text-gray-800">{item.product_name}</div>
                                            <div className="text-[11px] text-gray-400">{item.product_code}</div>
                                            {item.promotion.applied && (
                                                <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">
                                                    <Tag className="w-2.5 h-2.5" />
                                                    Promo appliquée{item.promotion.labels.length > 0 ? ` — ${item.promotion.labels.join(', ')}` : ''}
                                                    {' '}(-{item.promotion.discount_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD)
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right text-gray-600">{item.quantity}</td>
                                        <td className="px-3 py-2 text-right text-gray-600">
                                            {item.promotion.applied ? (
                                                <>
                                                    <span className="line-through text-gray-300 mr-1">{item.unit_price_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                                                    {item.promotion.unit_price_ttc_after_discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}
                                                </>
                                            ) : (
                                                item.unit_price_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })
                                            )}
                                        </td>
                                        <td className="px-3 py-2 text-right font-bold text-gray-800">{item.line_total_ttc.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="bg-gray-50 rounded-xl p-4 space-y-1.5 text-sm">
                        <div className="flex justify-between text-gray-500">
                            <span>Sous-total HT</span>
                            <span>{summary.totals.sub_total_ht.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                        </div>
                        <div className="flex justify-between text-gray-500">
                            <span>TVA</span>
                            <span>{summary.totals.tva_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                        </div>
                        {summary.totals.promotion_discount > 0 && (
                            <div className="flex justify-between text-emerald-600 font-semibold">
                                <span>Remise totale</span>
                                <span>-{summary.totals.promotion_discount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                            </div>
                        )}
                        <div className="flex justify-between text-base font-black text-gray-900 pt-1.5 border-t border-gray-200">
                            <span>Total TTC à payer</span>
                            <span>{summary.totals.payable_amount.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                        </div>
                    </div>

                    {!sessionActive && <SessionRequiredNotice />}

                    <div className="flex justify-end gap-3 pt-1">
                        <button onClick={closeSummary} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Retour
                        </button>
                        <button
                            onClick={confirmAndSubmit}
                            disabled={submitting || !sessionActive}
                            className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                            Confirmer et soumettre
                        </button>
                    </div>
                </div>
            )}
        </Modal>
    );

    // ── Existing-order view mode (redirected here e.g. after a devis conversion) ──
    if (existingOrderId) {
        return (
            <>
                <MasterLayout
                    mainContent={
                        <div className="h-full flex flex-col bg-gray-50/50">
                            <TelesalesSessionBanner />
                            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                                <button onClick={goBackToVisit} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3">
                                    <ArrowLeft className="w-4 h-4" /> Retour
                                </button>
                                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Commande</h2>
                            </div>
                            <div className="flex-1 flex items-center justify-center p-6">
                                {loadingExisting ? (
                                    <Loader2 className="w-6 h-6 animate-spin text-sage-500" />
                                ) : !order ? (
                                    <p className="text-gray-400">Commande introuvable</p>
                                ) : (
                                    <div className="max-w-md w-full space-y-4">
                                        <div className="bg-sage-50 border border-sage-100 rounded-xl p-4">
                                            <div className="text-sm font-bold text-gray-800">{order.bc_number}</div>
                                            <div className="text-2xl font-black text-sage-700 mt-1">{order.final_total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                                            <div className="text-xs text-gray-400 mt-1">{order.items_count} article(s) — {order.partner.name}</div>
                                        </div>
                                        {order.status === 'draft' && !derogationRequested && (
                                            <>
                                                {!sessionActive && <SessionRequiredNotice />}
                                                <button
                                                    onClick={openSummary}
                                                    disabled={!sessionActive}
                                                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                                                >
                                                    <Receipt className="w-4 h-4" />
                                                    Voir le récapitulatif
                                                </button>
                                            </>
                                        )}
                                        {derogationRequested && (
                                            <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">
                                                <Clock className="w-4 h-4" /> En attente de validation ADV/CDZ
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    }
                />
                {creditIssue && (
                    <Modal isOpen={!!creditIssue} onClose={() => setCreditIssue(null)} title="Plafond de crédit dépassé" size="md">
                        <div className="p-5 space-y-4">
                            <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-100 rounded-lg">
                                <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                                <div className="text-sm text-red-700">
                                    Dépassement de <strong>{(creditIssue.warnings[0]?.excess_amount ?? (creditIssue.order_amount - creditIssue.credit_available)).toLocaleString('fr-FR')} MAD</strong>.
                                </div>
                            </div>
                            <div className="flex justify-end gap-3">
                                <button onClick={() => setCreditIssue(null)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                                <button onClick={() => { setShowDerogationModal(true); setCreditIssue(null); }} className="px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700">Demander une dérogation ADV</button>
                            </div>
                        </div>
                    </Modal>
                )}
                <Modal isOpen={showDerogationModal} onClose={() => setShowDerogationModal(false)} title="Demande de dérogation crédit" size="md">
                    <div className="p-5 space-y-4">
                        {!sessionActive && <SessionRequiredNotice />}
                        <textarea value={justification} onChange={(e) => setJustification(e.target.value)} rows={4} placeholder="Justification (min. 20 caractères)"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                        <div className="flex justify-end gap-3">
                            <button onClick={() => setShowDerogationModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">Annuler</button>
                            <button onClick={handleRequestDerogation} disabled={requestingDerogation || justification.trim().length < 20 || !sessionActive}
                                className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-amber-600 rounded-lg hover:bg-amber-700 disabled:opacity-50">
                                {requestingDerogation && <Loader2 className="w-4 h-4 animate-spin" />}
                                Demander la dérogation
                            </button>
                        </div>
                    </div>
                </Modal>
                {summaryModal}
            </>
        );
    }

    // ── New-order Sadi9 layout: category sidebar | product DataGrid | cart ──────
    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        <div className="px-3 py-2 border-b border-gray-100 shrink-0 flex items-center gap-1.5">
                            <LayoutGrid className="w-3.5 h-3.5 text-gray-400" />
                            <h1 className="text-sm font-semibold text-gray-900">Catégories</h1>
                        </div>
                        <div className="p-2 border-b border-gray-100 shrink-0">
                            <SyncStatusBadge />
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1">
                            <button
                                onClick={() => setPageCode(undefined)}
                                className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                                    !pageCode ? 'bg-sage-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                }`}
                            >
                                Toutes les catégories
                            </button>
                            {pages.map((p) => (
                                <button
                                    key={p.id}
                                    onClick={() => setPageCode(p.code)}
                                    className={`w-full text-left px-3 py-2 text-sm font-medium rounded-lg transition-colors truncate ${
                                        pageCode === p.code ? 'bg-sage-600 text-white' : 'text-gray-600 hover:bg-gray-50'
                                    }`}
                                    title={p.name}
                                >
                                    {p.name}
                                </button>
                            ))}
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex flex-col bg-gray-50/50">
                        <TelesalesSessionBanner />
                        <div className="p-4 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10 shrink-0">
                            <div className="flex items-center justify-between gap-3 mb-3">
                                <button onClick={goBackToVisit} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 shrink-0">
                                    <ArrowLeft className="w-4 h-4" /> Retour
                                </button>
                                <h2 className="text-lg font-extrabold text-gray-900 tracking-tight">Prise de commande</h2>
                                <div className="w-16" />
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Rechercher un produit par nom ou code..."
                                    className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                                />
                            </div>
                            {!partner && (
                                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-3">
                                    Sélectionnez un partenaire dans le panneau de droite pour voir les prix négociés et ajouter des produits.
                                </p>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            <DataGrid rowData={products} columnDefs={columnDefs} loading={loadingProducts} rowHeight={44} />
                        </div>
                    </div>
                }
                rightContent={
                    <div className={`h-full bg-white border-l border-gray-200 flex flex-col transition-all ${cartCollapsed ? 'w-14' : 'w-96'}`}>
                        <div className="flex items-center justify-between px-2 py-2 border-b border-gray-100 shrink-0">
                            {!cartCollapsed && (
                                <span className="text-xs font-bold text-gray-500 uppercase pl-2 flex items-center gap-1.5">
                                    <ShoppingCart className="w-3.5 h-3.5" /> Panier
                                    {cart.length > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{cart.length}</span>}
                                </span>
                            )}
                            <button
                                onClick={() => setCartCollapsed((c) => !c)}
                                title={cartCollapsed ? 'Afficher le panier' : 'Réduire le panier'}
                                className={`p-1.5 rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-100 ${cartCollapsed ? 'mx-auto' : ''}`}
                            >
                                {cartCollapsed ? <ChevronsLeft className="w-4 h-4" /> : <ChevronsRight className="w-4 h-4" />}
                            </button>
                        </div>

                        {cartCollapsed && cart.length > 0 && (
                            <div className="flex flex-col items-center pt-3">
                                <span className="w-8 h-8 flex items-center justify-center rounded-full bg-sage-100 text-sage-700 text-xs font-bold">{cart.length}</span>
                            </div>
                        )}

                        {!cartCollapsed && (
                        <>
                        {/* Partner block */}
                        <div className="p-4 border-b border-gray-100 shrink-0">
                            {!partner ? (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                                    <PartnerPicker value={partner} onChange={setPartner} />
                                </div>
                            ) : (
                                <div>
                                    <div className="flex items-center justify-between">
                                        <div className="min-w-0">
                                            <div className="text-xs font-bold text-gray-400 uppercase">Partenaire</div>
                                            <div className="text-sm font-bold text-gray-800 truncate">{partner.name}</div>
                                            <div className="text-xs text-gray-400">{partner.code}</div>
                                        </div>
                                        <button onClick={() => { setPartner(null); setCart([]); }} className="text-xs text-sage-600 hover:underline shrink-0">Changer</button>
                                    </div>
                                    {creditStatus && (
                                        <div className="mt-2.5 flex items-center gap-2 bg-blue-50 border border-blue-100 rounded-lg px-2.5 py-1.5">
                                            <Wallet className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                                            <div className="text-xs text-blue-700">
                                                Solde disponible : <strong>{creditStatus.credit_available.toLocaleString('fr-FR')} MAD</strong>
                                                {typeof creditStatus.credit_limit === 'number' && (
                                                    <span className="text-blue-400"> / {creditStatus.credit_limit.toLocaleString('fr-FR')} MAD</span>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {order ? (
                            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                <div className="bg-sage-50 border border-sage-100 rounded-xl p-4">
                                    <div className="text-sm font-bold text-gray-800">{order.bc_number}</div>
                                    <div className="text-2xl font-black text-sage-700 mt-1">{order.final_total.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</div>
                                    <div className="text-xs text-gray-400 mt-1">{order.items_count} article(s)</div>
                                </div>
                                {order.status === 'draft' && !derogationRequested && (
                                    <>
                                        {!sessionActive && <SessionRequiredNotice />}
                                        <button
                                            onClick={openSummary}
                                            disabled={!sessionActive}
                                            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-emerald-600 rounded-xl shadow-sm hover:bg-emerald-700 disabled:opacity-50"
                                        >
                                            <Receipt className="w-4 h-4" />
                                            Voir le récapitulatif
                                        </button>
                                    </>
                                )}
                                {derogationRequested && (
                                    <div className="flex items-center gap-2 px-4 py-2.5 text-sm font-bold text-amber-700 bg-amber-50 border border-amber-100 rounded-xl">
                                        <Clock className="w-4 h-4" /> En attente de validation ADV/CDZ
                                    </div>
                                )}
                                <button
                                    onClick={goBackToVisit}
                                    className="w-full px-4 py-2.5 text-sm font-bold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50"
                                >
                                    Retour à la fiche télé-visite
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="px-4 pt-3 pb-2 shrink-0">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase flex items-center gap-1.5">
                                        <ShoppingCart className="w-3.5 h-3.5" /> Panier ({cart.length})
                                    </h3>
                                </div>
                                <div className="flex-1 overflow-y-auto px-4 space-y-2">
                                    {cart.length === 0 ? (
                                        <p className="text-sm text-gray-400 py-6 text-center">Ajoutez des produits depuis la grille</p>
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
                                        value={notes}
                                        onChange={(e) => setNotes(e.target.value)}
                                        placeholder="Notes (optionnel)"
                                        rows={2}
                                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                                    />
                                    <button
                                        onClick={handleCreateOrder}
                                        disabled={creating || !partner || cart.length === 0 || !sessionActive}
                                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                                        Créer la commande
                                    </button>
                                </div>
                            </>
                        )}
                        </>
                        )}
                    </div>
                }
            />

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
            {summaryModal}
        </>
    );
};

export default TelesalesOrderPage;
