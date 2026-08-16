import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Search, X, Trash2, Loader2,
    User, Users, Building2, AlertTriangle, Calendar, Warehouse, LayoutGrid, ListFilter,
    Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { PartnerPickerModal } from '@/components/gcom/PartnerPickerModal';
import { useAuth } from '@/context/AuthContext';

import { getPartners, getPaymentTerms } from '@/services/api/partnerApi';
import { telesalesApi } from '@/services/api/telesalesApi';
import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
import type { CatalogProduct } from '@/types/telesalesAgent.types';
import type { GcomPaymentMethod, GcomInstrumentInput, GcomItemInput } from '@/types/gcom.types';

// ─── Shared "catalog quick-pad" entry experience ──────────────────────────────
// Powers both the Comptoir (direct invoice) and BC creation screens: pick a
// client, key quantities directly into the full product catalog, choose a
// payment method, submit. What differs between callers is only what the
// submit actually creates (an invoice vs. an order) and what happens after —
// everything about picking the client/articles/payment is identical, so it
// lives here once instead of being duplicated per screen.
//
// Pricing/stock come from `GET /telesales/catalog/products` (the same engine
// Devis/BC/BL/Facture resolve prices with server-side), scoped by
// `partner_id` once a client is picked — NOT from the generic
// `/products` catalog, which never carries partner-negotiated prices. Its
// `price` is TTC (not HT, unlike most of this app's Product type).

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;

const priceHT = (row: CatalogProduct): number => row.price / (1 + (row.tax_rate || 0) / 100);

export interface GcomCatalogEntryLine {
    product: CatalogProduct;
    quantity: number;
}

export interface GcomCatalogEntrySubmitPayload {
    partner_id: number;
    items: GcomItemInput[];
    payment_method: GcomPaymentMethod;
    payment_term_id: number | null;
    notes?: string;
    instrument: GcomInstrumentInput | null;
    /** Only meaningful when `showExpiresAt` is set on the screen (Devis). */
    expires_at?: string;
}

export interface GcomCatalogEntryScreenProps<TResult> {
    submitLabel: string;
    submitIcon: React.ElementType;
    /** Comptoir needs a cheque/effet instrument at submit time (settles now); BC does not (instrument is only collected later, at convert-to-invoice). */
    needsInstrumentAtSubmit: boolean;
    onSubmit: (payload: GcomCatalogEntrySubmitPayload) => Promise<TResult>;
    /** Shown in place of the catalog after a successful submit. Omit to leave success handling entirely to `onSubmitted` (e.g. navigating away). */
    renderSuccess?: (result: TResult, actions: { reset: () => void }) => React.ReactNode;
    successActionItems?: (result: TResult, actions: { reset: () => void }) => ActionItemProps[];
    onSubmitted?: (result: TResult) => void;
    /** Extra action shown alongside submit/clear — e.g. BC's "Annuler" back to the list. */
    cancelActionItem?: ActionItemProps;
    /** Opt-in per caller — BC creation asked for a confirmation step before the
     * document is actually created; Comptoir/BL default to submitting directly
     * (Comptoir is deliberately a fast scan-and-pay flow, an extra dialog there
     * would work against that). */
    confirmBeforeSubmit?: boolean;
    /** Devis creation collects no payment info at all (chosen later, at convert
     * time) — hides the payment method/term/instrument block entirely. */
    hidePaymentSection?: boolean;
    /** Devis-only: shows an optional "expires_at" date field next to notes. */
    showExpiresAt?: boolean;
}

const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };
const STAMP_DUTY_RATE = 0.0025; // 0.25%, cash only — see docs/modules/28-gcom.md §4
const CATALOG_PAGE_SIZE = 60;

export function GcomCatalogEntryScreen<TResult>({
    submitLabel,
    submitIcon: SubmitIcon,
    needsInstrumentAtSubmit,
    onSubmit,
    renderSuccess,
    successActionItems,
    onSubmitted,
    cancelActionItem,
    confirmBeforeSubmit = false,
    hidePaymentSection = false,
    showExpiresAt = false,
}: GcomCatalogEntryScreenProps<TResult>) {
    const { user } = useAuth();

    // ── Partner selection ─────────────────────────────────────────────────────
    const [partnerSearch, setPartnerSearch] = useState('');
    const [partnerResults, setPartnerResults] = useState<Partner[]>([]);
    const [searchingPartner, setSearchingPartner] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [showPartnerPicker, setShowPartnerPicker] = useState(false);
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
        if (selectedPartner) { setPartnerResults([]); return; }
        partnerDebounce.current = setTimeout(() => runPartnerSearch(partnerSearch), 300);
        return () => { if (partnerDebounce.current) clearTimeout(partnerDebounce.current); };
    }, [partnerSearch, selectedPartner, runPartnerSearch]);

    // ── Partner payment terms (for credit/transfer) ─────────────────────────────
    const [partnerTerms, setPartnerTerms] = useState<PaymentTermOption[]>([]);
    const [paymentTermId, setPaymentTermId] = useState<number | null>(null);

    const selectPartner = (p: Partner) => {
        setSelectedPartner(p);
        setPartnerSearch('');
        setPartnerResults([]);
        setPaymentTermId(null);
        setPartnerTerms([]);
        getPaymentTerms(p.id)
            .then(res => {
                const terms = res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? [];
                setPartnerTerms(terms);
                // Credit-eligible sales can only use credit terms — never a cash term.
                // Pre-select the partner's configured default (pivot.is_default), or the
                // first active credit term if the partner has no default set.
                const creditTerms = terms.filter(t => t.is_credit && !t.is_cash);
                const defaultTerm = creditTerms.find(t => t.pivot?.is_default) ?? creditTerms[0] ?? null;
                setPaymentTermId(defaultTerm?.id ?? null);
            })
            .catch(() => setPartnerTerms([]));
    };

    const changePartner = () => {
        setSelectedPartner(null);
        setPartnerTerms([]);
        setPaymentTermId(null);
    };

    // ── Catalog (quick pad) ──────────────────────────────────────────────────
    // `catalogRows` is the currently loaded/searched page. `catalogCache` remembers
    // every row ever loaded (across searches/pages) so "only selected" can still
    // render a product that scrolled out of the current search/page. Both are
    // cleared whenever the partner changes, since prices are partner-scoped —
    // a cached row from a different (or no) partner would show a stale price.
    const [catalogQuery, setCatalogQuery] = useState('');
    const [catalogRows, setCatalogRows] = useState<CatalogProduct[]>([]);
    const [loadingCatalog, setLoadingCatalog] = useState(false);
    const [catalogPage, setCatalogPage] = useState(1);
    const [catalogLastPage, setCatalogLastPage] = useState(1);
    const catalogCache = useRef<Map<number, CatalogProduct>>(new Map());
    const catalogDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);

    const loadCatalog = useCallback(async (query: string, page: number, append: boolean) => {
        setLoadingCatalog(true);
        try {
            const res = await telesalesApi.catalog.getProducts({
                search: query.trim() || undefined,
                partner_id: selectedPartner?.id,
                per_page: CATALOG_PAGE_SIZE,
                page,
            });
            const rows = res.products ?? [];
            rows.forEach(r => catalogCache.current.set(r.id, r));
            setCatalogRows(prev => append ? [...prev, ...rows] : rows);
            setCatalogPage(res.pagination?.current_page ?? page);
            setCatalogLastPage(res.pagination?.total_pages ?? page);
        } catch {
            toast.error('Erreur chargement du catalogue');
        } finally {
            setLoadingCatalog(false);
        }
    }, [selectedPartner?.id]);

    // Re-fetch page 1 (and drop cached prices) whenever the partner changes —
    // covers the initial mount too (selectedPartner starts null).
    useEffect(() => {
        catalogCache.current.clear();
        loadCatalog(catalogQuery, 1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedPartner?.id]);

    useEffect(() => {
        if (catalogDebounce.current) clearTimeout(catalogDebounce.current);
        catalogDebounce.current = setTimeout(() => loadCatalog(catalogQuery, 1, false), 300);
        return () => { if (catalogDebounce.current) clearTimeout(catalogDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [catalogQuery]);

    const loadMore = () => { if (catalogPage < catalogLastPage) loadCatalog(catalogQuery, catalogPage + 1, true); };

    // ── Quantities ────────────────────────────────────────────────────────────
    const [quantities, setQuantities] = useState<Record<number, number>>({});
    const [showOnlySelected, setShowOnlySelected] = useState(false);
    // Full-screen catalog toggle — takes over the whole viewport (client card,
    // payment panel, action rail all hidden) for scanning/keying a long order.
    const [isExpanded, setIsExpanded] = useState(false);
    useEffect(() => {
        if (!isExpanded) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isExpanded]);
    const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

    const setQuantity = (productId: number, quantity: number) => {
        setQuantities(prev => ({ ...prev, [productId]: Math.max(0, quantity) }));
    };

    const selectedCount = useMemo(() => Object.values(quantities).filter(q => q > 0).length, [quantities]);

    const displayedRows: CatalogProduct[] = showOnlySelected
        ? Array.from(catalogCache.current.values()).filter(r => (quantities[r.id] ?? 0) > 0)
        : catalogRows;

    const selectedLines: GcomCatalogEntryLine[] = useMemo(() => {
        return Object.entries(quantities)
            .filter(([, q]) => q > 0)
            .map(([id, q]) => {
                const row = catalogCache.current.get(Number(id));
                return row ? { product: row, quantity: q } : null;
            })
            .filter((l): l is GcomCatalogEntryLine => l !== null);
    }, [quantities]);

    const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            (qtyRefs.current[idx + 1] ?? searchInputRef.current)?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            (qtyRefs.current[idx - 1] ?? searchInputRef.current)?.focus();
        }
    };

    const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        const q = catalogQuery.trim().toLowerCase();
        if (!q) return;
        const exact = displayedRows.find(r => r.code.toLowerCase() === q);
        const target = exact ?? (displayedRows.length === 1 ? displayedRows[0] : null);
        if (!target) return;
        e.preventDefault();
        const idx = displayedRows.findIndex(r => r.id === target.id);
        const input = qtyRefs.current[idx];
        if (input) { input.focus(); input.select(); }
    };

    const clearSelection = () => setQuantities({});

    // ── Payment ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<GcomPaymentMethod>('cash');
    const [instrument, setInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [notes, setNotes] = useState('');
    const [expiresAt, setExpiresAt] = useState('');

    const methodDef = PAYMENT_METHODS.find(m => m.value === paymentMethod)!;
    const showInstrumentFields = needsInstrumentAtSubmit && methodDef.needsInstrument;
    // Cash terms (e.g. "Comptant") must never be offered once a credit/transfer
    // method is picked — only terms flagged is_credit are valid here.
    const creditTerms = useMemo(() => partnerTerms.filter(t => t.is_credit && !t.is_cash), [partnerTerms]);

    // ── Totals (client-side estimate — real totals confirmed by the API response) ──
    // `product.price` is already TTC (partner-resolved when a client is selected —
    // same pricing engine the backend uses to bill), so HT is derived, not the source.
    const { estimatedHT, estimatedTax, estimatedStamp, estimatedTTC } = useMemo(() => {
        let ht = 0, ttc = 0;
        selectedLines.forEach(l => {
            const lineTTC = (Number(l.product.price) || 0) * l.quantity;
            ttc += lineTTC;
            ht += priceHT(l.product) * l.quantity;
        });
        const stamp = paymentMethod === 'cash' ? ht * STAMP_DUTY_RATE : 0;
        return { estimatedHT: ht, estimatedTax: ttc - ht, estimatedStamp: stamp, estimatedTTC: ttc + stamp };
    }, [selectedLines, paymentMethod]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<TResult | null>(null);

    // Zero stock blocks the line entirely (input disabled below) — this is a
    // defensive re-check at submit time for a line that was selected while
    // stock was available and only dropped to 0 afterwards (catalogCache keeps
    // stale rows visible in "Sélectionnés" across searches/pages).
    const hasOutOfStockSelection = useMemo(
        () => selectedLines.some(l => l.product.stock_available === 0),
        [selectedLines],
    );

    const canSubmit = !!selectedPartner && selectedLines.length > 0 && !submitting && !hasOutOfStockSelection &&
        (!showInstrumentFields || (instrument.reference_number.trim() && instrument.due_date)) &&
        (!methodDef.needsTerm || paymentTermId != null);

    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const handleSubmit = () => {
        if (!selectedPartner) { toast.error('Sélectionnez un client'); return; }
        if (selectedLines.length === 0) { toast.error('Aucun article sélectionné'); return; }
        if (hasOutOfStockSelection) { toast.error('Retirez les articles en rupture de stock avant de valider'); return; }
        if (showInstrumentFields && (!instrument.reference_number.trim() || !instrument.due_date)) {
            toast.error('Référence et échéance requises pour ce mode de paiement');
            return;
        }
        if (confirmBeforeSubmit) { setShowConfirmModal(true); return; }
        doSubmit();
    };

    const doSubmit = async () => {
        if (!selectedPartner) return;
        setSubmitting(true);
        try {
            const created = await onSubmit({
                partner_id: selectedPartner.id,
                items: selectedLines.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
                payment_method: paymentMethod,
                payment_term_id: methodDef.needsTerm ? paymentTermId : null,
                notes: notes.trim() || undefined,
                instrument: showInstrumentFields ? instrument : null,
                expires_at: showExpiresAt ? (expiresAt || undefined) : undefined,
            });
            setShowConfirmModal(false);
            if (renderSuccess) setResult(created);
            onSubmitted?.(created);
        } catch (err: unknown) {
            toast.error((err as { message?: string })?.message ?? 'Erreur lors de la soumission');
        } finally {
            setSubmitting(false);
        }
    };

    const reset = () => {
        setResult(null);
        clearSelection();
        changePartner();
        setPaymentMethod('cash');
        setInstrument(EMPTY_INSTRUMENT);
        setNotes('');
        setExpiresAt('');
        setShowOnlySelected(false);
        loadCatalog(catalogQuery, 1, false); // refresh stock levels
        setTimeout(() => searchInputRef.current?.focus(), 0);
    };

    // ── Enter-to-submit: only when no field/button currently has focus ──────────
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Enter' || result) return;
            const tag = (document.activeElement?.tagName || '').toLowerCase();
            if (['input', 'textarea', 'select', 'button'].includes(tag)) return;
            if (canSubmit) { e.preventDefault(); handleSubmit(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [canSubmit, result, selectedLines, selectedPartner, paymentMethod, instrument, notes, paymentTermId]);

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (result) {
            const items = successActionItems?.(result, { reset }) ?? [];
            return items.length > 0 ? [{ items }] : [];
        }
        const groups: { items: ActionItemProps[] }[] = [{ items: [
            { icon: SubmitIcon, label: submitLabel, variant: 'primary', onClick: handleSubmit, disabled: !canSubmit },
            { icon: Trash2, label: 'Vider la sélection', variant: 'warning', onClick: clearSelection, disabled: selectedCount === 0 },
        ] }];
        if (cancelActionItem) groups.push({ items: [cancelActionItem] });
        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result, canSubmit, selectedCount, cancelActionItem]);

    const today = useMemo(() => new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }), []);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-y-auto">
                    {/* Client */}
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <User className="w-4 h-4 text-sage-600" />
                            <h2 className="text-sm font-bold text-gray-900">Client</h2>
                        </div>
                        {selectedPartner ? (
                            <div className="bg-sage-50 border border-sage-100 rounded-lg px-3 py-2.5 space-y-1.5">
                                <div className="flex items-start justify-between">
                                    <p className="text-xs font-semibold text-gray-900">{selectedPartner.name}</p>
                                    <button onClick={changePartner} className="text-[10px] text-sage-600 font-semibold hover:underline shrink-0 ml-2">Changer</button>
                                </div>
                                <p className="text-[10px] text-gray-500">{selectedPartner.code}</p>
                                {selectedPartner.tax_number_ice && (
                                    <p className="text-[10px] text-gray-500">ICE : <span className="font-mono">{selectedPartner.tax_number_ice}</span></p>
                                )}
                                <div className="flex items-center justify-between pt-1.5 border-t border-sage-100">
                                    <span className="text-[10px] text-gray-500">Encours dispo.</span>
                                    <span className={`text-xs font-bold ${selectedPartner.credit_available >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                        {fmtMAD(selectedPartner.credit_available)}
                                    </span>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-stretch gap-1.5">
                            <div className="relative flex-1 min-w-0">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    value={partnerSearch}
                                    onChange={e => setPartnerSearch(e.target.value)}
                                    placeholder="Rechercher un client…"
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                                />
                                {partnerSearch && (
                                    <button onClick={() => setPartnerSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
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
                                            <div className="max-h-56 overflow-y-auto divide-y divide-gray-50">
                                                {partnerResults.map(p => (
                                                    <button
                                                        key={p.id}
                                                        onClick={() => selectPartner(p)}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center gap-2"
                                                    >
                                                        <Building2 className="w-3.5 h-3.5 text-gray-300 shrink-0" />
                                                        <div className="min-w-0">
                                                            <p className="text-xs font-semibold text-gray-900 truncate">{p.name}</p>
                                                            <p className="text-[10px] text-gray-400">{p.code} · {p.city ?? '—'}</p>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                onClick={() => setShowPartnerPicker(true)}
                                title="Parcourir tous les clients"
                                className="flex items-center justify-center w-[34px] shrink-0 border border-gray-200 rounded-lg text-gray-500 hover:text-sage-600 hover:bg-gray-50 transition-colors"
                            >
                                <Users className="w-3.5 h-3.5" />
                            </button>
                            </div>
                        )}
                    </div>

                    {/* Sale metadata */}
                    <div className="px-4 pt-3 pb-4 shrink-0 space-y-2">
                        <h3 className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">Détails de la vente</h3>
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <span className="capitalize">{today}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <Warehouse className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="truncate">{user?.branch?.name ?? '—'}</p>
                                <p className="text-[10px] text-gray-400">Entrepôt central résolu automatiquement pour cette branche</p>
                            </div>
                        </div>
                    </div>
                </div>
            }

            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                    {result ? (
                        renderSuccess?.(result, { reset })
                    ) : (
                        <>
                            <div className={isExpanded ? 'fixed inset-0 z-50 bg-gray-50 flex flex-col' : 'contents'}>
                            {/* ── Search bar + toggle ─────────────────────────── */}
                            <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-200 shrink-0 flex items-center gap-3">
                                <div className="relative flex-1">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-500" />
                                    <input
                                        ref={searchInputRef}
                                        autoFocus
                                        value={catalogQuery}
                                        onChange={e => setCatalogQuery(e.target.value)}
                                        onKeyDown={handleSearchKeyDown}
                                        placeholder="Scanner un code-barres ou rechercher un article…"
                                        className="w-full pl-10 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                                    />
                                    {catalogQuery && (
                                        <button onClick={() => setCatalogQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                                <div className="flex items-center bg-gray-100 rounded-lg p-1 shrink-0">
                                    <button
                                        onClick={() => setShowOnlySelected(false)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            !showOnlySelected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        <LayoutGrid className="w-3.5 h-3.5" /> Tout le catalogue
                                    </button>
                                    <button
                                        onClick={() => setShowOnlySelected(true)}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                                            showOnlySelected ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                        }`}
                                    >
                                        <ListFilter className="w-3.5 h-3.5" /> Sélectionnés ({selectedCount})
                                    </button>
                                </div>
                                <button
                                    onClick={() => setIsExpanded(v => !v)}
                                    title={isExpanded ? 'Réduire' : 'Plein écran'}
                                    className="flex items-center justify-center w-9 h-9 shrink-0 text-gray-500 hover:text-sage-600 hover:bg-gray-100 rounded-lg transition-colors"
                                >
                                    {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                </button>
                            </div>

                            {/* ── Catalog grid ─────────────────────────────────── */}
                            <div className="flex-1 overflow-y-auto px-4 py-3 relative">
                                {!selectedPartner && (
                                    <div className="absolute inset-0 z-10 bg-white/75 backdrop-blur-[1px] flex flex-col items-center justify-center text-center px-6">
                                        <User className="w-8 h-8 text-gray-300 mb-2" />
                                        <p className="text-sm font-semibold text-gray-600">Sélectionnez un client pour activer la saisie</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-xs">Le catalogue est visible mais désactivé tant qu'aucun client n'est sélectionné (les prix affichés sont génériques tant qu'aucun client n'est choisi).</p>
                                    </div>
                                )}
                                <div className={!selectedPartner ? 'opacity-50 pointer-events-none select-none' : undefined}>
                                {displayedRows.length === 0 ? (
                                    <div className="text-center py-16 text-xs text-gray-400">
                                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                        {showOnlySelected
                                            ? 'Aucun article sélectionné pour le moment'
                                            : loadingCatalog ? 'Chargement du catalogue…' : 'Aucun article trouvé'}
                                    </div>
                                ) : (
                                    <>
                                        <table className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                                            <thead>
                                                <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400 whitespace-nowrap">
                                                    <th className="text-left font-semibold px-3 py-2 w-24">Code</th>
                                                    <th className="text-left font-semibold px-3 py-2">Article</th>
                                                    <th className="text-right font-semibold px-3 py-2 w-20">Stock</th>
                                                    <th className="text-right font-semibold px-3 py-2 w-28">P.U. HT</th>
                                                    <th className="text-center font-semibold px-3 py-2 w-24">Quantité</th>
                                                    <th className="text-right font-semibold px-3 py-2 w-32">Total TTC</th>
                                                    <th className="w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {displayedRows.map((row, idx) => {
                                                    const quantity = quantities[row.id] ?? 0;
                                                    const lineTTC = (Number(row.price) || 0) * quantity;
                                                    const short = row.stock_available != null && quantity > row.stock_available;
                                                    const outOfStock = row.stock_available === 0;
                                                    const selected = quantity > 0;
                                                    return (
                                                        <tr key={row.id} className={outOfStock ? 'opacity-60' : selected ? 'bg-sage-50/40 hover:bg-sage-50/70' : 'hover:bg-gray-50/60'}>
                                                            <td className="px-3 py-2 font-mono font-bold text-indigo-600 whitespace-nowrap">{row.code}</td>
                                                            <td className="px-3 py-2 font-medium text-gray-800">{row.name}</td>
                                                            <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${outOfStock ? 'text-red-500' : short ? 'text-red-500' : row.stock_available != null ? 'text-gray-500' : 'text-gray-300'}`}>
                                                                {row.stock_available == null ? '—' : fmt(row.stock_available, 0)}
                                                            </td>
                                                            <td className="px-3 py-2 text-right text-gray-600 whitespace-nowrap">
                                                                {fmtMAD(priceHT(row))}
                                                                {selectedPartner && row.price_source === 'generic' && (
                                                                    <span className="block text-[9px] text-amber-600 font-medium">générique</span>
                                                                )}
                                                            </td>
                                                            <td className="px-2 py-1.5">
                                                                {outOfStock ? (
                                                                    <span className="block text-center text-[10px] font-semibold text-red-500 py-1.5">Rupture</span>
                                                                ) : (
                                                                    <input
                                                                        type="number"
                                                                        min={0}
                                                                        value={quantity === 0 ? '' : quantity}
                                                                        placeholder="0"
                                                                        disabled={!selectedPartner}
                                                                        ref={el => { qtyRefs.current[idx] = el; }}
                                                                        onChange={e => setQuantity(row.id, e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                                                                        onKeyDown={e => handleQtyKeyDown(e, idx)}
                                                                        className="w-full text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                                    />
                                                                )}
                                                            </td>
                                                            <td className="px-3 py-2 text-right font-bold text-gray-900 whitespace-nowrap">{selected ? fmtMAD(lineTTC) : '—'}</td>
                                                            <td className="px-2 py-2 text-center">
                                                                {selected && (
                                                                    <button onClick={() => setQuantity(row.id, 0)} className="text-red-400 hover:text-red-600">
                                                                        <X className="w-3.5 h-3.5" />
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                        {!showOnlySelected && catalogPage < catalogLastPage && (
                                            <div className="flex justify-center py-3">
                                                <button
                                                    onClick={loadMore}
                                                    disabled={loadingCatalog}
                                                    className="flex items-center gap-2 px-4 py-1.5 text-xs font-medium text-sage-600 border border-sage-200 rounded-lg hover:bg-sage-50 disabled:opacity-50 transition-colors"
                                                >
                                                    {loadingCatalog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                                    Charger plus d'articles
                                                </button>
                                            </div>
                                        )}
                                    </>
                                )}
                                </div>
                            </div>
                            </div>

                            {/* ── Bottom panel: totals + payment + validate ──── */}
                            <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-4">
                                <div className="flex items-start gap-6">
                                    {/* Payment method + conditional fields */}
                                    <div className="flex-1 space-y-3">
                                        {!hidePaymentSection && (
                                        <div className="flex flex-wrap items-center gap-1.5">
                                            {PAYMENT_METHODS.map(m => (
                                                <button
                                                    key={m.value}
                                                    onClick={() => setPaymentMethod(m.value)}
                                                    className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                                                        paymentMethod === m.value
                                                            ? 'bg-sage-600 border-sage-600 text-white'
                                                            : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    <m.icon className="w-3.5 h-3.5" /> {m.label}
                                                </button>
                                            ))}
                                        </div>
                                        )}

                                        {!hidePaymentSection && methodDef.needsTerm && (
                                            creditTerms.length > 0 ? (
                                                <select
                                                    value={paymentTermId ?? ''}
                                                    onChange={e => setPaymentTermId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                                    className="w-full max-w-xs px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                                >
                                                    {creditTerms.map(t => (
                                                        <option key={t.id} value={t.id}>{t.name}</option>
                                                    ))}
                                                </select>
                                            ) : (
                                                <p className="text-[11px] text-red-600 font-medium">
                                                    Aucun terme de paiement à crédit configuré pour ce client — impossible de valider avec ce mode de paiement.
                                                </p>
                                            )
                                        )}

                                        {!hidePaymentSection && showInstrumentFields && (
                                            <div className="grid grid-cols-2 gap-2 bg-amber-50/50 border border-amber-100 rounded-lg p-2.5 max-w-md">
                                                <input
                                                    value={instrument.reference_number}
                                                    onChange={e => setInstrument(p => ({ ...p, reference_number: e.target.value }))}
                                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    placeholder="Référence *"
                                                />
                                                <input
                                                    type="date"
                                                    value={instrument.due_date}
                                                    onChange={e => setInstrument(p => ({ ...p, due_date: e.target.value }))}
                                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                />
                                                <input
                                                    value={instrument.bank_name}
                                                    onChange={e => setInstrument(p => ({ ...p, bank_name: e.target.value }))}
                                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    placeholder="Banque"
                                                />
                                                <input
                                                    value={instrument.bank_account}
                                                    onChange={e => setInstrument(p => ({ ...p, bank_account: e.target.value }))}
                                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    placeholder="N° compte"
                                                />
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2">
                                            <input
                                                value={notes}
                                                onChange={e => setNotes(e.target.value)}
                                                placeholder="Notes (optionnel)…"
                                                className="w-full max-w-md px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                            />
                                            {showExpiresAt && (
                                                <div className="shrink-0">
                                                    <input
                                                        type="date"
                                                        value={expiresAt}
                                                        onChange={e => setExpiresAt(e.target.value)}
                                                        title="Date d'expiration (optionnel)"
                                                        className="px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    />
                                                </div>
                                            )}
                                        </div>

                                        {!selectedPartner && (
                                            <div className="flex items-center gap-1.5 text-[11px] text-amber-700">
                                                <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Sélectionnez un client avant de valider.
                                            </div>
                                        )}
                                    </div>

                                    {/* Totals + validate */}
                                    <div className="w-64 shrink-0 space-y-2">
                                        <div className="space-y-1 text-xs">
                                            <div className="flex justify-between text-gray-500"><span>Total HT</span><span>{fmtMAD(estimatedHT)}</span></div>
                                            <div className="flex justify-between text-gray-500"><span>TVA</span><span>{fmtMAD(estimatedTax)}</span></div>
                                            {paymentMethod === 'cash' && (
                                                <div className="flex justify-between text-gray-500"><span>Timbre (0,25%)</span><span>{fmtMAD(estimatedStamp)}</span></div>
                                            )}
                                            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100">
                                                <span>Total TTC</span><span>{fmtMAD(estimatedTTC)}</span>
                                            </div>
                                            <p className="text-[9px] text-gray-400 text-right">
                                                {selectedPartner ? 'prix réel — confirmé à la validation' : 'estimation générique — sélectionnez un client'}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!canSubmit}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-sage-600 text-white text-sm font-bold rounded-xl hover:bg-sage-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <SubmitIcon className="w-4 h-4" />}
                                            {submitLabel}
                                        </button>
                                        <p className="text-[9px] text-gray-400 text-center">Appuyez sur <kbd className="px-1 py-0.5 bg-gray-100 border border-gray-200 rounded text-[9px]">Entrée</kbd> pour valider</p>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </div>
            }

            rightContent={<ActionPanel groups={actionGroups} />}
        />
        {confirmBeforeSubmit && selectedPartner && (
            <ConfirmationModal
                isOpen={showConfirmModal}
                onClose={() => setShowConfirmModal(false)}
                onConfirm={doSubmit}
                title={`Confirmer — ${submitLabel} ?`}
                description={`Vérifiez les informations avant de valider. Cette action ${needsInstrumentAtSubmit ? 'facture' : 'crée'} le document immédiatement.`}
                confirmText={submitLabel}
                cancelText="Annuler"
                variant="sage"
                isLoading={submitting}
            >
                <div className="mt-1 space-y-1.5 text-xs bg-gray-50 border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500">Client</span>
                        <span className="font-semibold text-gray-900">{selectedPartner.name}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500">Articles</span>
                        <span className="font-semibold text-gray-900">{selectedLines.length}</span>
                    </div>
                    <div className="flex items-center justify-between">
                        <span className="text-gray-500">Mode de paiement</span>
                        <span className="font-semibold text-gray-900">{methodDef.label}</span>
                    </div>
                    <div className="flex items-center justify-between pt-1.5 mt-1.5 border-t border-gray-200">
                        <span className="text-gray-500">Total TTC</span>
                        <span className="font-bold text-sage-700 text-sm">{fmtMAD(estimatedTTC)}</span>
                    </div>
                </div>
            </ConfirmationModal>
        )}
        <PartnerPickerModal
            isOpen={showPartnerPicker}
            onClose={() => setShowPartnerPicker(false)}
            onSelect={selectPartner}
        />
        </>
    );
}
