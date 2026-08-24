import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Search, X, Trash2, Loader2,
    User, Users, Building2, AlertTriangle, Calendar, Warehouse, LayoutGrid, ListFilter,
    Maximize2, Minimize2, Info, Hash, Truck, CheckCircle2, EyeOff, ArrowUpDown, GripHorizontal, Percent,
    BookOpen, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { PartnerPickerModal } from '@/components/gcom/PartnerPickerModal';
import { AvoirAllocationPicker } from '@/components/gcom/AvoirAllocationPicker';
import { avoirAllocationsMatchTotal, avoirAllocationsWithinTotal, canMixAvoirWith } from '@/lib/gcom/avoirAllocations';
import { useAuth } from '@/context/AuthContext';
import { useGcomParameters } from '@/hooks/useGcomParameters';
import { useGcomDraft, draftRelativeTime } from '@/hooks/useGcomDraft';

import { getPartners, getPaymentTerms } from '@/services/api/partnerApi';
import { telesalesApi } from '@/services/api/telesalesApi';
import { gcomApi } from '@/services/api/gcomApi';
import { masterdataApi, type Bank } from '@/services/api/masterdataApi';
import { PAYMENT_METHODS } from '@/lib/gcom/paymentMethods';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
import type { CatalogProduct } from '@/types/telesalesAgent.types';
import type { GcomPaymentMethod, GcomInstrumentInput, GcomItemInput, GcomSoucheKind, GcomRepresentative, GcomAvoirAllocation } from '@/types/gcom.types';

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
    /** Only meaningful when `showSoucheKindSelector` is set (Comptoir). §17. */
    souche_kind?: GcomSoucheKind | null;
    /** 2026-08-27 — customer's own PO/reference number, hidden on Devis (not
     * accepted by `POST /quotes`). Gated the same way as payment_method:
     * `!hidePaymentSection`. */
    client_order_ref?: string | null;
    /** 2026-08-27 — back-office override of the "creator = salesperson"
     * default. Same gating as client_order_ref. */
    salesperson_id?: number | null;
    /** Only meaningful when `showDeliveryDateField` is set (BL direct creation
     * — not accepted by POST /orders or POST /direct-invoices). */
    delivery_date?: string;
    /** 2026-08-29 — same gating as delivery_date (BL-only). Free text,
     * display/traceability only. The resulting BL is born in_transit. */
    driver_info?: string | null;
    transporter_name?: string | null;
    /** 2026-08-30 — same gating as delivery_date (BL-only). Omit/'in_transit'
     * for a real tournée; 'delivered' for a counter/depot pickup. */
    status?: 'in_transit' | 'delivered';
    /** 2026-08-20 — required (must sum exactly to the total) when
     * payment_method is 'avoir' and needsInstrumentAtSubmit is true (Comptoir
     * settles immediately; BC/BL creation only accept payment_method as a
     * hint, allocations happen later at convert-to-invoice). */
    avoir_allocations?: GcomAvoirAllocation[];
    /** 2026-09-01 — document-level manual negotiation, only meaningful when
     * `enableNegotiation` is set (BC creation only — POST /orders is the
     * only creation endpoint that accepts these). */
    global_discount_percent?: number;
    global_discount_amount?: number;
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
    /** Comptoir-only (§17) — a cash/cheque sale never carries a caller-chosen
     * payment_term_id (the one global cash term is always resolved), so this
     * is the only point-of-sale path that can mark a specific sale internal.
     * Shows a 2-option "Déclarée"/"Interne" toggle next to payment method. */
    showSoucheKindSelector?: boolean;
    /** BL-only (2026-08-27) — POST /delivery-notes is the only one of the 3
     * creation endpoints that accepts delivery_date directly. Shows a date
     * input next to notes, defaults to empty (backend defaults to today). */
    showDeliveryDateField?: boolean;
    /** 2026-09-01 — BC-only (POST /orders is the only creation endpoint with
     * manual-negotiation support so far). Master switch for the per-line
     * price-override/discount columns and the global-discount footer
     * inputs. Deliberately decoupled from the RBAC system itself — the
     * caller (BonCommandePage) resolves its own usePermissions() and passes
     * the 3 results below, so this shared component stays permission-agnostic
     * like every other gating prop here. */
    enableNegotiation?: boolean;
    canPriceOverride?: boolean;
    canDiscountLine?: boolean;
    canDiscountGlobal?: boolean;
    /** 2026-08-24 — opt-in per caller. When set, the in-progress draft
     * (client, lines, payment fields, notes...) autosaves to IndexedDB so a
     * token expiry or accidental refresh doesn't lose several minutes of
     * entry. Must be unique per screen (e.g. "gcom-bc-create"). Omit to skip
     * persistence entirely. */
    draftKey?: string;
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
    showSoucheKindSelector = false,
    showDeliveryDateField = false,
    enableNegotiation = false,
    canPriceOverride = false,
    canDiscountLine = false,
    canDiscountGlobal = false,
    draftKey,
}: GcomCatalogEntryScreenProps<TResult>) {
    const { user } = useAuth();
    const { maxDiscountPercent } = useGcomParameters();

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

    // ── Resizable bottom panel (payment + totals) ───────────────────────────
    // Grown wide with the negotiation columns (2026-09-01) — a fixed height
    // ate too much of the catalog table's vertical space, so the boundary is
    // now a drag handle instead. Height, not flex, so the panel keeps its
    // size across re-renders; the catalog grid above stays `flex-1` and just
    // absorbs whatever's left.
    const BOTTOM_PANEL_MIN = 96;
    const BOTTOM_PANEL_DEFAULT = 230;
    const [bottomPanelHeight, setBottomPanelHeight] = useState(BOTTOM_PANEL_DEFAULT);
    const resizingRef = useRef(false);

    const startResize = (e: React.MouseEvent) => {
        e.preventDefault();
        resizingRef.current = true;
        const startY = e.clientY;
        const startHeight = bottomPanelHeight;
        const maxHeight = Math.round(window.innerHeight * 0.75);
        const onMove = (moveEvent: MouseEvent) => {
            if (!resizingRef.current) return;
            const delta = startY - moveEvent.clientY;
            setBottomPanelHeight(Math.min(maxHeight, Math.max(BOTTOM_PANEL_MIN, startHeight + delta)));
        };
        const onUp = () => {
            resizingRef.current = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
        };
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    };

    const setQuantity = (productId: number, quantity: number) => {
        setQuantities(prev => ({ ...prev, [productId]: Math.max(0, quantity) }));
    };

    const selectedCount = useMemo(() => Object.values(quantities).filter(q => q > 0).length, [quantities]);

    // ── Manual negotiation (2026-09-01, BC only via enableNegotiation) ──────
    // Keyed the same way as `quantities` — per-product override maps, kept
    // even for a row currently at qty 0 so a value typed early isn't lost if
    // the user sets the quantity afterward.
    const [unitPriceOverrides, setUnitPriceOverrides] = useState<Record<number, number>>({});
    const [discountPercents, setDiscountPercents] = useState<Record<number, number>>({});
    const [globalDiscountMode, setGlobalDiscountMode] = useState<'' | 'percent' | 'amount'>('');
    const [globalDiscountValue, setGlobalDiscountValue] = useState<number | ''>('');

    // Net TTC unit price for a row, folding in a manual override and/or
    // per-line discount — local preview only, the real figure is whatever
    // the API resolves and returns (global discount is deliberately NOT
    // folded in here, its proportional-to-HT distribution algorithm lives
    // server-side and isn't worth duplicating just for an estimate).
    const netUnitPriceTTC = (row: CatalogProduct): number => {
        const base = unitPriceOverrides[row.id] || Number(row.price) || 0;
        const discountPct = discountPercents[row.id];
        return discountPct ? base * (1 - discountPct / 100) : base;
    };

    // Hide-rupture + sort only make sense on the live catalog view — a row
    // the user already selected should never disappear from "Sélectionnés"
    // just because it later went to 0 stock or the sort order changed.
    const [hideOutOfStock, setHideOutOfStock] = useState(false);
    const [catalogSort, setCatalogSort] = useState<'default' | 'stock_desc' | 'stock_asc' | 'price_desc' | 'price_asc'>('default');
    // Purely a display toggle — negotiation columns stay fully functional (values already
    // entered aren't cleared when hidden), this just declutters the table when the user
    // isn't negotiating on this particular sale. Default true = same layout as before this
    // toggle existed.
    const [showNegotiationColumns, setShowNegotiationColumns] = useState(true);

    const displayedRows: CatalogProduct[] = useMemo(() => {
        const base = showOnlySelected
            ? Array.from(catalogCache.current.values()).filter(r => (quantities[r.id] ?? 0) > 0)
            : catalogRows;
        if (showOnlySelected) return base;
        const filtered = hideOutOfStock ? base.filter(r => r.stock_available > 0) : base;
        if (catalogSort === 'default') return filtered;
        const sorted = [...filtered];
        sorted.sort((a, b) => {
            switch (catalogSort) {
                case 'stock_desc': return b.stock_available - a.stock_available;
                case 'stock_asc': return a.stock_available - b.stock_available;
                case 'price_desc': return (Number(b.price) || 0) - (Number(a.price) || 0);
                case 'price_asc': return (Number(a.price) || 0) - (Number(b.price) || 0);
                default: return 0;
            }
        });
        return sorted;
    }, [showOnlySelected, catalogRows, quantities, hideOutOfStock, catalogSort]);

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

    const clearSelection = () => { setQuantities({}); setUnitPriceOverrides({}); setDiscountPercents({}); };

    // ── Payment ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<GcomPaymentMethod>('cash');
    const [instrument, setInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [notes, setNotes] = useState('');
    const [expiresAt, setExpiresAt] = useState('');
    // §17 — 'declared' is the safe/common default, matching the backend's own
    // fallback when the field is omitted entirely.
    const [soucheKind, setSoucheKind] = useState<GcomSoucheKind>('declared');
    // 2026-08-27 — client_order_ref/salesperson_id/delivery_date.
    const [clientOrderRef, setClientOrderRef] = useState('');
    const [salespersonId, setSalespersonId] = useState<number | ''>('');
    const [deliveryDate, setDeliveryDate] = useState('');
    // 2026-08-29 — driver_info/transporter_name, BL-only like deliveryDate
    // (free text, display/traceability only, not a Driver FK).
    const [driverInfo, setDriverInfo] = useState('');
    const [transporterName, setTransporterName] = useState('');
    // 2026-08-30 — 'in_transit' is the safe/common default (real tournée),
    // matching the backend's own default when the field is omitted.
    const [blStatus, setBlStatus] = useState<'in_transit' | 'delivered'>('in_transit');
    // Instrument's bank_name defaults to a dropdown (GET /masterdata/banks),
    // falls back to free text if the list is empty or the bank isn't listed.
    const [instrumentBankOther, setInstrumentBankOther] = useState(false);
    // 2026-08-20 — avoir-as-payment allocations. Two distinct uses of the same
    // state: payment_method === 'avoir' itself (must sum to exactly the
    // total, mandatory, see showAvoirFields), or an OPTIONAL partial mix on
    // top of cash/card/cheque/effet (see mixAvoirEnabled/canMixAvoir below) —
    // the two are mutually exclusive by payment method so sharing the state
    // is safe.
    const [avoirAllocations, setAvoirAllocations] = useState<GcomAvoirAllocation[]>([]);
    const [mixAvoirEnabled, setMixAvoirEnabled] = useState(false);
    // §18 (2026-08-28) — salesperson_id is now validated against the
    // gcom_representative role specifically (422 otherwise), so this picker
    // MUST come from gcomApi.representatives.list(), not a generic
    // commercial-employees list — any other source will 422 at submit time.
    const [representatives, setRepresentatives] = useState<GcomRepresentative[]>([]);

    useEffect(() => {
        if (hidePaymentSection) return; // Devis doesn't need the salesperson picker
        gcomApi.representatives.list({ is_active: true, per_page: 100 }).then(res => setRepresentatives(res.data)).catch(() => {});
    }, [hidePaymentSection]);

    // Banks list (GET /masterdata/banks) — only Comptoir collects instrument
    // fields at submit time, so only load it there. Used to constrain the
    // instrument's bank_name to a known bank instead of raw free text; the
    // field itself stays a plain string (no bank_id on the instrument shape).
    const [banks, setBanks] = useState<Bank[]>([]);
    useEffect(() => {
        if (!needsInstrumentAtSubmit) return;
        masterdataApi.banks.getAll().then(setBanks).catch(() => setBanks([]));
    }, [needsInstrumentAtSubmit]);

    // ── Draft persistence (2026-08-24) ──────────────────────────────────────────
    // Snapshot mirrors reset()'s own field list below — keep the two in sync.
    const [dismissedDraftBanner, setDismissedDraftBanner] = useState(false);
    const { draft: pendingDraft, saveDraft, clearDraft } = useGcomDraft(draftKey);
    const draftSnapshot = useMemo(() => ({
        selectedPartner, paymentTermId, quantities, unitPriceOverrides, discountPercents,
        globalDiscountMode, globalDiscountValue, paymentMethod, instrument, notes, expiresAt,
        soucheKind, clientOrderRef, salespersonId, deliveryDate, driverInfo, transporterName,
        blStatus, instrumentBankOther, avoirAllocations, mixAvoirEnabled,
    }), [
        selectedPartner, paymentTermId, quantities, unitPriceOverrides, discountPercents,
        globalDiscountMode, globalDiscountValue, paymentMethod, instrument, notes, expiresAt,
        soucheKind, clientOrderRef, salespersonId, deliveryDate, driverInfo, transporterName,
        blStatus, instrumentBankOther, avoirAllocations, mixAvoirEnabled,
    ]);
    useEffect(() => {
        if (!draftKey) return;
        // Don't autosave a blank form, and don't autosave over a draft the user
        // just restored/dismissed this session (pendingDraft banner still shown).
        const meaningful = !!selectedPartner || Object.values(quantities).some(q => q > 0);
        if (!meaningful) return;
        saveDraft(draftSnapshot as unknown as Record<string, unknown>, selectedPartner?.name ?? '');
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draftKey, draftSnapshot]);

    const restoreDraft = () => {
        if (!pendingDraft) return;
        const d = pendingDraft.data as typeof draftSnapshot;
        setDismissedDraftBanner(true);
        if (d.selectedPartner) {
            selectPartner(d.selectedPartner);
            // selectPartner re-fetches payment terms and picks its own default —
            // override with the draft's actual value once that settles.
            setTimeout(() => setPaymentTermId(d.paymentTermId), 0);
        }
        setQuantities(d.quantities ?? {});
        setUnitPriceOverrides(d.unitPriceOverrides ?? {});
        setDiscountPercents(d.discountPercents ?? {});
        setGlobalDiscountMode(d.globalDiscountMode ?? '');
        setGlobalDiscountValue(d.globalDiscountValue ?? '');
        setPaymentMethod(d.paymentMethod ?? 'cash');
        setInstrument(d.instrument ?? EMPTY_INSTRUMENT);
        setNotes(d.notes ?? '');
        setExpiresAt(d.expiresAt ?? '');
        setSoucheKind(d.soucheKind ?? 'declared');
        setClientOrderRef(d.clientOrderRef ?? '');
        setSalespersonId(d.salespersonId ?? '');
        setDeliveryDate(d.deliveryDate ?? '');
        setDriverInfo(d.driverInfo ?? '');
        setTransporterName(d.transporterName ?? '');
        setBlStatus(d.blStatus ?? 'in_transit');
        setInstrumentBankOther(d.instrumentBankOther ?? false);
        setAvoirAllocations(d.avoirAllocations ?? []);
        setMixAvoirEnabled(d.mixAvoirEnabled ?? false);
    };

    const discardDraft = () => {
        setDismissedDraftBanner(true);
        clearDraft();
    };

    const methodDef = PAYMENT_METHODS.find(m => m.value === paymentMethod)!;
    const showInstrumentFields = needsInstrumentAtSubmit && methodDef.needsInstrument;
    const showAvoirFields = needsInstrumentAtSubmit && methodDef.needsAvoirAllocation;
    // A payment method switch invalidates any prior selection — a stale
    // allocation from cash mixing shouldn't silently carry over to cheque, or
    // survive a switch to a method that can't mix avoir at all.
    useEffect(() => { setAvoirAllocations([]); setMixAvoirEnabled(false); }, [paymentMethod]);
    // Optional avoir mix — only offered where backend actually accepts a
    // remainder payment method (cash/card/cheque/effet, verified live —
    // credit/transfer 422 as "not supported yet").
    const canMixAvoir = needsInstrumentAtSubmit && canMixAvoirWith(paymentMethod);
    const showMixAvoirFields = canMixAvoir && mixAvoirEnabled;
    // Cash terms (e.g. "Comptant") must never be offered once a credit/transfer
    // method is picked — only terms flagged is_credit are valid here.
    const creditTerms = useMemo(() => partnerTerms.filter(t => t.is_credit && !t.is_cash), [partnerTerms]);

    // ── Totals (client-side estimate — real totals confirmed by the API response) ──
    // `product.price` is already TTC (partner-resolved when a client is selected —
    // same pricing engine the backend uses to bill), so HT is derived, not the source.
    const { estimatedHT, estimatedTax, estimatedStamp, estimatedTTC } = useMemo(() => {
        let ht = 0, ttc = 0;
        selectedLines.forEach(l => {
            const unitTTC = enableNegotiation ? netUnitPriceTTC(l.product) : (Number(l.product.price) || 0);
            const unitHT = enableNegotiation ? unitTTC / (1 + (l.product.tax_rate || 0) / 100) : priceHT(l.product);
            ttc += unitTTC * l.quantity;
            ht += unitHT * l.quantity;
        });
        const stamp = paymentMethod === 'cash' ? ht * STAMP_DUTY_RATE : 0;
        return { estimatedHT: ht, estimatedTax: ttc - ht, estimatedStamp: stamp, estimatedTTC: ttc + stamp };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedLines, paymentMethod, enableNegotiation, unitPriceOverrides, discountPercents]);

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
        (!methodDef.needsTerm || paymentTermId != null) &&
        (!showAvoirFields || avoirAllocationsMatchTotal(avoirAllocations, estimatedTTC)) &&
        (!showMixAvoirFields || avoirAllocationsWithinTotal(avoirAllocations, estimatedTTC));

    const [showConfirmModal, setShowConfirmModal] = useState(false);

    const handleSubmit = () => {
        if (!selectedPartner) { toast.error('Sélectionnez un client'); return; }
        if (selectedLines.length === 0) { toast.error('Aucun article sélectionné'); return; }
        if (hasOutOfStockSelection) { toast.error('Retirez les articles en rupture de stock avant de valider'); return; }
        if (showInstrumentFields && (!instrument.reference_number.trim() || !instrument.due_date)) {
            toast.error('Référence et échéance requises pour ce mode de paiement');
            return;
        }
        if (showAvoirFields && !avoirAllocationsMatchTotal(avoirAllocations, estimatedTTC)) {
            toast.error('Le total des avoirs sélectionnés doit correspondre exactement au montant de la vente');
            return;
        }
        if (showMixAvoirFields && !avoirAllocationsWithinTotal(avoirAllocations, estimatedTTC)) {
            toast.error('Le total des avoirs sélectionnés dépasse le montant de la vente');
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
                items: selectedLines.map(l => ({
                    product_id: l.product.id,
                    quantity: l.quantity,
                    unit_price: enableNegotiation && canPriceOverride && unitPriceOverrides[l.product.id] ? unitPriceOverrides[l.product.id] : undefined,
                    discount_percent: enableNegotiation && canDiscountLine && discountPercents[l.product.id] ? discountPercents[l.product.id] : undefined,
                })),
                global_discount_percent: enableNegotiation && canDiscountGlobal && globalDiscountMode === 'percent' && globalDiscountValue !== '' ? globalDiscountValue : undefined,
                global_discount_amount: enableNegotiation && canDiscountGlobal && globalDiscountMode === 'amount' && globalDiscountValue !== '' ? globalDiscountValue : undefined,
                payment_method: paymentMethod,
                payment_term_id: methodDef.needsTerm ? paymentTermId : null,
                notes: notes.trim() || undefined,
                instrument: showInstrumentFields ? instrument : null,
                expires_at: showExpiresAt ? (expiresAt || undefined) : undefined,
                souche_kind: showSoucheKindSelector ? soucheKind : undefined,
                client_order_ref: !hidePaymentSection ? (clientOrderRef.trim() || undefined) : undefined,
                salesperson_id: !hidePaymentSection ? (salespersonId === '' ? undefined : salespersonId) : undefined,
                delivery_date: showDeliveryDateField ? (deliveryDate || undefined) : undefined,
                driver_info: showDeliveryDateField ? (driverInfo.trim() || undefined) : undefined,
                transporter_name: showDeliveryDateField ? (transporterName.trim() || undefined) : undefined,
                status: showDeliveryDateField ? blStatus : undefined,
                avoir_allocations: (showAvoirFields || (showMixAvoirFields && avoirAllocations.length > 0)) ? avoirAllocations : undefined,
            });
            setShowConfirmModal(false);
            if (renderSuccess) setResult(created);
            onSubmitted?.(created);
            clearDraft();
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
        clearDraft();
        setPaymentMethod('cash');
        setInstrument(EMPTY_INSTRUMENT);
        setNotes('');
        setExpiresAt('');
        setSoucheKind('declared');
        setClientOrderRef('');
        setSalespersonId('');
        setDeliveryDate('');
        setDriverInfo('');
        setTransporterName('');
        setGlobalDiscountMode('');
        setGlobalDiscountValue('');
        setBlStatus('in_transit');
        setInstrumentBankOther(false);
        setAvoirAllocations([]);
        setMixAvoirEnabled(false);
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

                        {pendingDraft && !dismissedDraftBanner && !selectedPartner && (
                            <div className="mb-2 rounded-xl border border-amber-200 bg-amber-50 overflow-hidden">
                                <div className="px-3 py-2 flex items-center gap-2">
                                    <BookOpen className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span className="text-xs font-semibold text-amber-700 flex-1">Brouillon non terminé</span>
                                    <button
                                        type="button"
                                        onClick={discardDraft}
                                        className="p-0.5 text-amber-400 hover:text-amber-700 rounded transition-colors"
                                        title="Ignorer"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                                <div className="px-3 pb-2">
                                    <button
                                        type="button"
                                        onClick={restoreDraft}
                                        className="w-full flex items-center gap-2 px-2 py-1.5 text-left rounded-lg bg-white border border-amber-100 hover:border-amber-300 hover:bg-amber-50 transition-all shadow-sm"
                                    >
                                        <div className="w-5 h-5 rounded-md bg-amber-100 flex items-center justify-center shrink-0">
                                            <BookOpen className="w-3 h-3 text-amber-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-[11px] font-semibold text-gray-800 truncate">
                                                {pendingDraft.partnerName || 'Sans client'}
                                            </p>
                                            <p className="text-[10px] text-gray-400">{draftRelativeTime(pendingDraft.savedAt)}</p>
                                        </div>
                                        <ChevronRight className="w-3 h-3 text-amber-400 shrink-0" />
                                    </button>
                                </div>
                            </div>
                        )}

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
                        {/* BL has its own editable delivery-date field below — showing
                            this generic read-only "today" row too was redundant there. */}
                        {!showDeliveryDateField && (
                            <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <span className="capitalize">{today}</span>
                            </div>
                        )}
                        <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                            <Warehouse className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                            <div className="min-w-0">
                                <p className="truncate">{user?.branch?.name ?? '—'}</p>
                                <p className="text-[10px] text-gray-400">Entrepôt central résolu automatiquement pour cette branche</p>
                            </div>
                        </div>

                        {showDeliveryDateField && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <input
                                    type="date"
                                    value={deliveryDate}
                                    onChange={e => setDeliveryDate(e.target.value)}
                                    autoComplete="off"
                                    title="Date de livraison (optionnel — défaut aujourd'hui)"
                                    className="w-full bg-transparent text-xs text-gray-700 focus:outline-none"
                                />
                                {!deliveryDate && <span className="text-[10px] text-gray-400 shrink-0">auj. par défaut</span>}
                            </div>
                        )}

                        {showDeliveryDateField && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <Truck className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <input
                                    value={driverInfo}
                                    onChange={e => setDriverInfo(e.target.value)}
                                    placeholder="Chauffeur (optionnel)"
                                    maxLength={150}
                                    className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                                />
                            </div>
                        )}

                        {showDeliveryDateField && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <Building2 className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <input
                                    value={transporterName}
                                    onChange={e => setTransporterName(e.target.value)}
                                    placeholder="Transporteur (optionnel)"
                                    maxLength={150}
                                    className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                                />
                            </div>
                        )}

                        {showDeliveryDateField && (
                            <div className="flex items-center gap-1.5">
                                {([
                                    { value: 'in_transit' as const, label: 'En transit', icon: Truck },
                                    { value: 'delivered' as const, label: 'Livré directement', icon: CheckCircle2 },
                                ]).map(opt => (
                                    <button
                                        key={opt.value}
                                        onClick={() => setBlStatus(opt.value)}
                                        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-[11px] font-medium transition-colors ${
                                            blStatus === opt.value
                                                ? 'bg-sage-600 border-sage-600 text-white'
                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <opt.icon className="w-3.5 h-3.5" /> {opt.label}
                                    </button>
                                ))}
                            </div>
                        )}
                        {showDeliveryDateField && blStatus === 'delivered' && (
                            <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                <Info className="w-3 h-3 shrink-0" />
                                Pour un retrait comptoir/dépôt — le client charge la marchandise sur place, pas de tournée réelle. Facturable immédiatement.
                            </p>
                        )}

                        {!hidePaymentSection && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <Hash className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <input
                                    value={clientOrderRef}
                                    onChange={e => setClientOrderRef(e.target.value)}
                                    placeholder="Réf. commande client (optionnel)"
                                    className="w-full bg-transparent text-xs text-gray-700 placeholder:text-gray-400 focus:outline-none"
                                />
                            </div>
                        )}

                        {!hidePaymentSection && (
                            <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 border border-gray-100">
                                <User className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                                <select
                                    value={salespersonId}
                                    onChange={e => setSalespersonId(e.target.value ? parseInt(e.target.value, 10) : '')}
                                    title="Commercial (optionnel — vide = vous-même)"
                                    className="w-full bg-transparent text-xs text-gray-700 focus:outline-none"
                                >
                                    <option value="">Commercial : vous-même</option>
                                    {representatives.map((r: GcomRepresentative) => (
                                        <option key={r.id} value={r.id}>{r.name}{r.code ? ` (${r.code})` : ''}</option>
                                    ))}
                                </select>
                            </div>
                        )}
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

                            {/* ── Filter/sort toolbar — only meaningful on the live
                                catalog, not the "Sélectionnés" view ─────────────── */}
                            {!showOnlySelected && (
                                <div className="px-4 py-2 bg-white border-b border-gray-100 shrink-0 flex items-center gap-4">
                                    <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer select-none">
                                        <input
                                            type="checkbox"
                                            checked={hideOutOfStock}
                                            onChange={e => setHideOutOfStock(e.target.checked)}
                                            className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                        />
                                        <EyeOff className="w-3.5 h-3.5 text-gray-400" />
                                        Masquer les ruptures
                                    </label>
                                    {enableNegotiation && (canPriceOverride || canDiscountLine || canDiscountGlobal) && (
                                        <label className="flex items-center gap-1.5 text-[11px] font-medium text-gray-600 cursor-pointer select-none">
                                            <input
                                                type="checkbox"
                                                checked={showNegotiationColumns}
                                                onChange={e => setShowNegotiationColumns(e.target.checked)}
                                                className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                            />
                                            <Percent className="w-3.5 h-3.5 text-gray-400" />
                                            Négociation
                                        </label>
                                    )}
                                    <div className="flex items-center gap-1.5">
                                        <ArrowUpDown className="w-3.5 h-3.5 text-gray-400" />
                                        <select
                                            value={catalogSort}
                                            onChange={e => setCatalogSort(e.target.value as typeof catalogSort)}
                                            className="text-[11px] font-medium text-gray-600 border border-gray-200 rounded-md pl-2 pr-6 py-1 bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                        >
                                            <option value="default">Trier par…</option>
                                            <option value="stock_desc">Stock (décroissant)</option>
                                            <option value="stock_asc">Stock (croissant)</option>
                                            <option value="price_desc">Prix (décroissant)</option>
                                            <option value="price_asc">Prix (croissant)</option>
                                        </select>
                                    </div>
                                    {(hideOutOfStock || catalogSort !== 'default') && (
                                        <button
                                            onClick={() => { setHideOutOfStock(false); setCatalogSort('default'); }}
                                            className="text-[11px] font-medium text-gray-400 hover:text-gray-600"
                                        >
                                            Réinitialiser
                                        </button>
                                    )}
                                    <span className="ml-auto text-[11px] text-gray-400">{displayedRows.length} article(s)</span>
                                </div>
                            )}

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
                                            : loadingCatalog ? 'Chargement du catalogue…'
                                            : hideOutOfStock ? (
                                                <>
                                                    Aucun article en stock ne correspond à cette recherche
                                                    <button onClick={() => setHideOutOfStock(false)} className="block mx-auto mt-2 text-sage-600 font-medium hover:underline">
                                                        Afficher aussi les ruptures
                                                    </button>
                                                </>
                                            ) : 'Aucun article trouvé'}
                                    </div>
                                ) : (
                                    <>
                                        {/* No `overflow-hidden` anywhere between here and the real scrolling
                                            ancestor (the .overflow-y-auto div above) — it breaks
                                            `position: sticky` on thead by giving it a clipping context to
                                            stick against instead of the actual scroll container, which
                                            showed up as a sliver of the row above peeking out from under the
                                            sticky header while scrolling. Costs slightly-less-clipped table
                                            corners, worth it for a working sticky header. */}
                                        <table className="w-full bg-white rounded-xl border border-gray-200 text-xs">
                                            {/* index.css has a global `th { @apply bg-gray-50 text-gray-600 ...; }`
                                                rule targeting the bare element — it paints its own opaque
                                                background/text color directly on every <th>, which silently
                                                hid a color set on the parent <thead> (child paint always wins
                                                over a parent's background, no specificity contest needed).
                                                Every header cell below sets its own bg/text explicitly to
                                                override that global rule (class beats element selector). */}
                                            <thead className="sticky top-0 z-[1] shadow-sm">
                                                <tr className="text-[10px] uppercase tracking-wider whitespace-nowrap">
                                                    <th className="text-left font-semibold px-3 py-2.5 w-24 bg-sage-600 text-white/90">Code</th>
                                                    <th className="text-left font-semibold px-3 py-2.5 bg-sage-600 text-white/90">Article</th>
                                                    <th className="text-right font-semibold px-3 py-2.5 w-20 bg-sage-600 text-white/90">Stock</th>
                                                    <th className="text-right font-semibold px-3 py-2.5 w-28 bg-sage-600 text-white/90">P.U. HT</th>
                                                    {enableNegotiation && canPriceOverride && showNegotiationColumns && (
                                                        <th className="text-center font-semibold px-3 py-2.5 w-24 bg-sage-600 text-white/90">Prix négocié</th>
                                                    )}
                                                    {enableNegotiation && canDiscountLine && showNegotiationColumns && (
                                                        <th className="text-center font-semibold px-3 py-2.5 w-24 bg-sage-600 text-white/90">
                                                            {maxDiscountPercent != null ? `Remise % (max ${maxDiscountPercent})` : 'Remise %'}
                                                        </th>
                                                    )}
                                                    <th className="text-center font-semibold px-3 py-2.5 w-24 bg-sage-600 text-white/90">Quantité</th>
                                                    <th className="text-right font-semibold px-3 py-2.5 w-32 bg-sage-600 text-white/90">Total TTC</th>
                                                    <th className="w-10 bg-sage-600"></th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100">
                                                {displayedRows.map((row, idx) => {
                                                    const quantity = quantities[row.id] ?? 0;
                                                    const lineTTC = (enableNegotiation ? netUnitPriceTTC(row) : (Number(row.price) || 0)) * quantity;
                                                    const short = row.stock_available != null && quantity > row.stock_available;
                                                    const outOfStock = row.stock_available === 0;
                                                    const selected = quantity > 0;
                                                    // Zebra striping on the two-idle states only — a selected or
                                                    // out-of-stock row already has its own strong background, no
                                                    // need to fight it with alternating shades.
                                                    const zebra = idx % 2 === 1 ? 'bg-gray-50/40' : 'bg-white';
                                                    const rowClass = outOfStock ? 'opacity-60' : selected ? 'bg-sage-50/40 hover:bg-sage-50/70' : `${zebra} hover:bg-gray-50/70 transition-colors`;
                                                    return (
                                                        <tr key={row.id} className={rowClass}>
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
                                                            {enableNegotiation && canPriceOverride && showNegotiationColumns && (
                                                                <td className="px-2 py-1.5">
                                                                    <input
                                                                        type="number" min={0} step="0.01"
                                                                        value={unitPriceOverrides[row.id] ?? ''}
                                                                        placeholder={String(row.price ?? '')}
                                                                        disabled={!selectedPartner}
                                                                        onChange={e => setUnitPriceOverrides(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                                        className="w-full text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                                    />
                                                                </td>
                                                            )}
                                                            {enableNegotiation && canDiscountLine && showNegotiationColumns && (
                                                                <td className="px-2 py-1.5">
                                                                    <input
                                                                        type="number" min={0} max={100} step="0.1"
                                                                        value={discountPercents[row.id] ?? ''}
                                                                        placeholder="0"
                                                                        disabled={!selectedPartner}
                                                                        onChange={e => setDiscountPercents(prev => ({ ...prev, [row.id]: parseFloat(e.target.value) || 0 }))}
                                                                        className="w-full text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 disabled:bg-gray-50 disabled:cursor-not-allowed"
                                                                    />
                                                                </td>
                                                            )}
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

                            {/* ── Drag handle — resizes the bottom panel below. Deliberately
                                loud (thick, gray-100 fill, visible icon + "Redimensionner"
                                label) — a bare thin bar here went unnoticed entirely. ──── */}
                            <div
                                onMouseDown={startResize}
                                className="shrink-0 h-6 flex items-center justify-center gap-1.5 cursor-row-resize select-none bg-gray-100 border-y border-gray-300 hover:bg-sage-100 active:bg-sage-200 transition-colors"
                                title="Glisser pour redimensionner"
                            >
                                <GripHorizontal className="w-4 h-4 text-gray-400" />
                                <span className="text-[10px] font-medium text-gray-400 uppercase tracking-wide">Redimensionner</span>
                            </div>

                            {/* ── Bottom panel: totals + payment + validate ──── */}
                            <div className="shrink-0 bg-white px-5 py-4 overflow-y-auto" style={{ height: bottomPanelHeight }}>
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

                                        {/* Deferred-settlement flows (BC/BL — not Comptoir) only record the
                                            method here; nothing is charged and no cheque/effet details are
                                            collected until convert-to-invoice, which confused testers into
                                            thinking a payment was being taken at this step. */}
                                        {!hidePaymentSection && !needsInstrumentAtSubmit && (
                                            <p className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                                <Info className="w-3 h-3 shrink-0" />
                                                Mode de règlement pré-sélectionné — les détails (N° chèque/effet, banque, échéance) seront saisis lors de la facturation, aucun encaissement n'a lieu à cette étape.
                                            </p>
                                        )}

                                        {showSoucheKindSelector && (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-gray-400 mr-0.5">Souche :</span>
                                                {(['declared', 'internal'] as GcomSoucheKind[]).map(k => (
                                                    <button
                                                        key={k}
                                                        onClick={() => setSoucheKind(k)}
                                                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-medium transition-colors ${
                                                            soucheKind === k
                                                                ? 'bg-indigo-600 border-indigo-600 text-white'
                                                                : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                                                        }`}
                                                    >
                                                        {k === 'declared' ? 'Déclarée' : 'Interne'}
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
                                                {banks.length > 0 && !instrumentBankOther ? (
                                                    <select
                                                        value={instrument.bank_name}
                                                        onChange={e => {
                                                            if (e.target.value === '__other__') { setInstrumentBankOther(true); setInstrument(p => ({ ...p, bank_name: '' })); }
                                                            else setInstrument(p => ({ ...p, bank_name: e.target.value }));
                                                        }}
                                                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                                    >
                                                        <option value="">Banque</option>
                                                        {banks.map(b => <option key={b.id} value={b.name}>{b.name}</option>)}
                                                        <option value="__other__">Autre…</option>
                                                    </select>
                                                ) : (
                                                    <input
                                                        value={instrument.bank_name}
                                                        onChange={e => setInstrument(p => ({ ...p, bank_name: e.target.value }))}
                                                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                        placeholder={banks.length > 0 ? 'Banque (saisie libre)' : 'Banque'}
                                                    />
                                                )}
                                                <input
                                                    value={instrument.bank_account}
                                                    onChange={e => setInstrument(p => ({ ...p, bank_account: e.target.value }))}
                                                    className="px-2 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    placeholder="N° compte"
                                                />
                                            </div>
                                        )}

                                        {!hidePaymentSection && showAvoirFields && (
                                            <div className="max-w-lg bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
                                                <AvoirAllocationPicker
                                                    partnerId={selectedPartner?.id ?? null}
                                                    total={estimatedTTC}
                                                    value={avoirAllocations}
                                                    onChange={setAvoirAllocations}
                                                />
                                            </div>
                                        )}

                                        {/* Optional avoir mix (2026-08-20) — the avoir covers PART of the
                                            total, this method settles the rest. Only offered where backend
                                            actually accepts a remainder method. */}
                                        {!hidePaymentSection && canMixAvoir && (
                                            <div className="max-w-lg space-y-2">
                                                <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={mixAvoirEnabled}
                                                        onChange={e => { setMixAvoirEnabled(e.target.checked); if (!e.target.checked) setAvoirAllocations([]); }}
                                                        className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                                    />
                                                    Appliquer un avoir en réduction du montant
                                                </label>
                                                {showMixAvoirFields && (
                                                    <div className="bg-amber-50/50 border border-amber-100 rounded-lg p-2.5">
                                                        <AvoirAllocationPicker
                                                            partnerId={selectedPartner?.id ?? null}
                                                            total={estimatedTTC}
                                                            value={avoirAllocations}
                                                            onChange={setAvoirAllocations}
                                                            mode="partial"
                                                        />
                                                    </div>
                                                )}
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
                                        {enableNegotiation && canDiscountGlobal && showNegotiationColumns && (
                                            <div className="space-y-1.5 pb-2 border-b border-gray-100">
                                                <label className="block text-[10px] font-medium text-gray-500">Remise globale (document)</label>
                                                <div className="flex gap-1.5">
                                                    <select
                                                        value={globalDiscountMode}
                                                        onChange={e => { setGlobalDiscountMode(e.target.value as '' | 'percent' | 'amount'); setGlobalDiscountValue(''); }}
                                                        className="px-2 py-1.5 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                    >
                                                        <option value="">Aucune</option>
                                                        <option value="percent">%</option>
                                                        <option value="amount">MAD</option>
                                                    </select>
                                                    {globalDiscountMode && (
                                                        <input
                                                            type="number" min={0} step="0.01"
                                                            value={globalDiscountValue}
                                                            onChange={e => setGlobalDiscountValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                                                            className="flex-1 min-w-0 px-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                        />
                                                    )}
                                                </div>
                                                {globalDiscountMode === 'percent' && maxDiscountPercent != null && (
                                                    <p className="text-[9px] text-gray-400">Plafond sans dérogation : {maxDiscountPercent}%</p>
                                                )}
                                                {globalDiscountMode && globalDiscountValue !== '' && (
                                                    <p className="text-[9px] text-amber-600">Réparti proportionnellement sur les lignes — non reflété dans l'estimation ci-dessous, confirmé à la validation.</p>
                                                )}
                                            </div>
                                        )}
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
