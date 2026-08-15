import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
    ShoppingCart, Search, X, Trash2, Loader2, CheckCircle2,
    Banknote, CreditCard, Landmark, FileCheck, Clock3, ArrowLeftRight,
    RefreshCw, FileText, User, Building2, AlertTriangle, ScanLine,
    Calendar, Warehouse, Printer,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { useAuth } from '@/context/AuthContext';

import { gcomApi } from '@/services/api/gcomApi';
import { productsApi } from '@/services/api/productsApi';
import { getPartners, getPaymentTerms } from '@/services/api/partnerApi';
import { stockManagementApi } from '@/services/api/stockManagementApi';
import type { Product } from '@/types/product.types';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
import type { GcomPaymentMethod, GcomInvoice, GcomInstrumentInput } from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;

const vatRateOf = (product: Product): number => {
    const list = product.vat_taxes ?? product.vatTaxes;
    return list?.[0]?.rate ?? 0;
};

interface CartLine {
    product: Product;
    quantity: number;
    stock?: number; // effective available stock captured when the line was added
}

interface SearchHit {
    product: Product;
    stock?: number;
}

interface PaymentMethodDef {
    value: GcomPaymentMethod;
    label: string;
    icon: React.ElementType;
    needsInstrument?: boolean;
    needsTerm?: boolean;
}

const PAYMENT_METHODS: PaymentMethodDef[] = [
    { value: 'cash', label: 'Espèces', icon: Banknote },
    { value: 'card', label: 'Carte', icon: CreditCard },
    { value: 'credit', label: 'Crédit', icon: Landmark, needsTerm: true },
    { value: 'cheque', label: 'Chèque', icon: FileCheck, needsInstrument: true },
    { value: 'effet', label: 'Effet', icon: Clock3, needsInstrument: true },
    { value: 'transfer', label: 'Virement', icon: ArrowLeftRight, needsTerm: true },
];

const EMPTY_INSTRUMENT: GcomInstrumentInput = { reference_number: '', due_date: '', bank_name: '', bank_account: '' };
const STAMP_DUTY_RATE = 0.0025; // 0.25%, cash only — see docs/modules/28-gcom.md §4

// ─── Component ───────────────────────────────────────────────────────────────

export default function ComptoirPage() {
    const { user } = useAuth();
    const branchCode = user?.branch?.code;

    // ── Partner selection ─────────────────────────────────────────────────────
    const [partnerSearch, setPartnerSearch] = useState('');
    const [partnerResults, setPartnerResults] = useState<Partner[]>([]);
    const [searchingPartner, setSearchingPartner] = useState(false);
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
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
            .then(res => setPartnerTerms(res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? []))
            .catch(() => setPartnerTerms([]));
    };

    const changePartner = () => {
        setSelectedPartner(null);
        setPartnerTerms([]);
        setPaymentTermId(null);
    };

    // ── Quick search / barcode scan ──────────────────────────────────────────
    const [scanQuery, setScanQuery] = useState('');
    const [scanResults, setScanResults] = useState<SearchHit[]>([]);
    const [scanning, setScanning] = useState(false);
    const [scanOpen, setScanOpen] = useState(false);
    const scanDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scanInputRef = useRef<HTMLInputElement>(null);

    const runScan = useCallback(async (q: string) => {
        if (q.trim().length < 1) { setScanResults([]); return; }
        setScanning(true);
        try {
            const [productsRes, stockRes] = await Promise.all([
                productsApi.getList({ search: q.trim(), is_active: true, per_page: 15 }),
                branchCode
                    ? stockManagementApi.getStocks({ branch_code: branchCode, search: q.trim(), per_page: 15 }).catch(() => null)
                    : Promise.resolve(null),
            ]);
            const stockByProduct = new Map<number, number>();
            stockRes?.data?.data?.forEach(s => stockByProduct.set(s.product_id, s.effective_available));
            const hits = (productsRes.data?.data ?? []).map(product => ({
                product,
                stock: stockByProduct.get(product.id),
            }));
            setScanResults(hits);
        } catch {
            setScanResults([]);
        } finally {
            setScanning(false);
        }
    }, [branchCode]);

    useEffect(() => {
        if (scanDebounce.current) clearTimeout(scanDebounce.current);
        scanDebounce.current = setTimeout(() => runScan(scanQuery), 250);
        return () => { if (scanDebounce.current) clearTimeout(scanDebounce.current); };
    }, [scanQuery, runScan]);

    // ── Cart ──────────────────────────────────────────────────────────────────
    const [cart, setCart] = useState<CartLine[]>([]);
    const qtyRefs = useRef<(HTMLInputElement | null)[]>([]);

    const addToCart = (hit: SearchHit) => {
        if (!selectedPartner) { toast.error('Sélectionnez un client avant d\'ajouter un article'); return; }
        setCart(prev => {
            const existing = prev.find(l => l.product.id === hit.product.id);
            if (existing) {
                return prev.map(l => l.product.id === hit.product.id ? { ...l, quantity: l.quantity + 1 } : l);
            }
            return [...prev, { product: hit.product, quantity: 1, stock: hit.stock }];
        });
        setScanQuery('');
        setScanResults([]);
        setScanOpen(false);
        scanInputRef.current?.focus();
    };

    const handleScanKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key !== 'Enter') return;
        e.preventDefault();
        if (scanResults.length === 0) return;
        const q = scanQuery.trim().toLowerCase();
        const exact = scanResults.find(h => h.product.code.toLowerCase() === q);
        addToCart(exact ?? scanResults[0]);
    };

    const updateQuantity = (productId: number, quantity: number) => {
        setCart(prev => prev.map(l => l.product.id === productId ? { ...l, quantity } : l));
    };

    const handleQtyBlur = (productId: number, quantity: number) => {
        if (quantity <= 0) removeLine(productId);
    };

    const handleQtyKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, idx: number) => {
        if (e.key === 'ArrowDown' || e.key === 'Enter') {
            e.preventDefault();
            (qtyRefs.current[idx + 1] ?? scanInputRef.current)?.focus();
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            (qtyRefs.current[idx - 1] ?? scanInputRef.current)?.focus();
        }
    };

    const removeLine = (productId: number) => setCart(prev => prev.filter(l => l.product.id !== productId));
    const clearCart = () => setCart([]);

    // ── Payment ───────────────────────────────────────────────────────────────
    const [paymentMethod, setPaymentMethod] = useState<GcomPaymentMethod>('cash');
    const [instrument, setInstrument] = useState<GcomInstrumentInput>(EMPTY_INSTRUMENT);
    const [notes, setNotes] = useState('');

    const methodDef = PAYMENT_METHODS.find(m => m.value === paymentMethod)!;

    // ── Totals (client-side estimate — real totals confirmed by the invoice response) ──
    const { estimatedHT, estimatedTax, estimatedStamp, estimatedTTC } = useMemo(() => {
        let ht = 0, tax = 0;
        cart.forEach(l => {
            const lineHT = (Number(l.product.price) || 0) * l.quantity;
            ht += lineHT;
            tax += lineHT * (vatRateOf(l.product) / 100);
        });
        const stamp = paymentMethod === 'cash' ? ht * STAMP_DUTY_RATE : 0;
        return { estimatedHT: ht, estimatedTax: tax, estimatedStamp: stamp, estimatedTTC: ht + tax + stamp };
    }, [cart, paymentMethod]);

    // ── Submit ────────────────────────────────────────────────────────────────
    const [submitting, setSubmitting] = useState(false);
    const [result, setResult] = useState<GcomInvoice | null>(null);
    const [pdfLoading, setPdfLoading] = useState(false);

    const canSubmit = !!selectedPartner && cart.length > 0 && !submitting &&
        (!methodDef.needsInstrument || (instrument.reference_number.trim() && instrument.due_date));

    const printInvoicePdf = async (invoiceId: number) => {
        try {
            const url = await gcomApi.invoices.getPdfBlobUrl(invoiceId);
            const iframe = document.createElement('iframe');
            iframe.style.display = 'none';
            iframe.src = url;
            iframe.onload = () => {
                iframe.contentWindow?.focus();
                iframe.contentWindow?.print();
            };
            document.body.appendChild(iframe);
        } catch {
            toast.error('Impression impossible — la facture reste disponible en PDF');
        }
    };

    const handleSubmit = async () => {
        if (!selectedPartner) { toast.error('Sélectionnez un client'); return; }
        if (cart.length === 0) { toast.error('Le panier est vide'); return; }
        if (methodDef.needsInstrument && (!instrument.reference_number.trim() || !instrument.due_date)) {
            toast.error('Référence et échéance requises pour ce mode de paiement');
            return;
        }
        setSubmitting(true);
        try {
            const invoice = await gcomApi.directInvoices.create({
                partner_id: selectedPartner.id,
                items: cart.map(l => ({ product_id: l.product.id, quantity: l.quantity })),
                payment_method: paymentMethod,
                notes: notes.trim() || undefined,
                payment_term_id: methodDef.needsTerm ? paymentTermId : null,
                instrument: methodDef.needsInstrument ? instrument : null,
            });
            toast.success('Facture créée');
            setResult(invoice);
            printInvoicePdf(invoice.id);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la validation de la vente');
        } finally {
            setSubmitting(false);
        }
    };

    const startNewSale = () => {
        setResult(null);
        clearCart();
        changePartner();
        setPaymentMethod('cash');
        setInstrument(EMPTY_INSTRUMENT);
        setNotes('');
        setTimeout(() => scanInputRef.current?.focus(), 0);
    };

    const openPdf = async () => {
        if (!result) return;
        setPdfLoading(true);
        try {
            const url = await gcomApi.invoices.getPdfBlobUrl(result.id);
            window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le PDF');
        } finally {
            setPdfLoading(false);
        }
    };

    // ── Enter-to-validate: only when no field/button currently has focus ────────
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
    }, [canSubmit, result, cart, selectedPartner, paymentMethod, instrument, notes, paymentTermId]);

    // ── Action panel ──────────────────────────────────────────────────────────

    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (result) {
            return [{ items: [
                { icon: RefreshCw, label: 'Nouvelle vente', variant: 'sage', onClick: startNewSale },
                { icon: FileText, label: 'Facture PDF', variant: 'default', onClick: openPdf, disabled: pdfLoading },
            ]}];
        }
        return [{ items: [
            { icon: CheckCircle2, label: 'Valider la vente', variant: 'primary', onClick: handleSubmit, disabled: !canSubmit },
            { icon: Trash2, label: 'Vider le panier', variant: 'warning', onClick: clearCart, disabled: cart.length === 0 },
        ]}];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [result, canSubmit, cart.length, pdfLoading]);

    const today = useMemo(() => new Date().toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' }), []);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
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
                            <div className="relative">
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
                        // ── SUCCESS ───────────────────────────────────────────
                        <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                            <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mb-4">
                                <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                            </div>
                            <h2 className="text-lg font-bold text-gray-900 mb-1">Vente enregistrée</h2>
                            <p className="text-xs text-gray-500 mb-6">
                                Facture {result.invoice_number ?? `#${result.id}`} — {result.status === 'fully_paid' ? 'payée' : 'en attente de règlement'} · impression envoyée
                            </p>
                            <div className="bg-white border border-gray-200 rounded-xl p-5 w-full max-w-sm space-y-2 text-left">
                                <div className="flex justify-between text-xs"><span className="text-gray-400">Sous-total HT</span><span className="font-medium text-gray-900">{fmtMAD(result.sub_total)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-gray-400">TVA</span><span className="font-medium text-gray-900">{fmtMAD(result.tax_amount)}</span></div>
                                {Number(result.stamp_duty) > 0 && (
                                    <div className="flex justify-between text-xs"><span className="text-gray-400">Timbre</span><span className="font-medium text-gray-900">{fmtMAD(result.stamp_duty)}</span></div>
                                )}
                                <div className="flex justify-between text-sm pt-2 border-t border-gray-100"><span className="font-semibold text-gray-700">Total TTC</span><span className="font-bold text-gray-900">{fmtMAD(result.total_amount)}</span></div>
                                <div className="flex justify-between text-xs"><span className="text-gray-400">Restant dû</span><span className={`font-medium ${Number(result.remaining_amount) > 0 ? 'text-amber-600' : 'text-emerald-600'}`}>{fmtMAD(result.remaining_amount)}</span></div>
                            </div>
                        </div>
                    ) : (
                        <>
                            {/* ── Search / scan bar ─────────────────────────── */}
                            <div className="px-4 pt-4 pb-3 bg-white border-b border-gray-200 shrink-0 relative">
                                <div className="relative">
                                    <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-sage-500" />
                                    <input
                                        ref={scanInputRef}
                                        autoFocus
                                        value={scanQuery}
                                        onChange={e => { setScanQuery(e.target.value); setScanOpen(true); }}
                                        onFocus={() => setScanOpen(true)}
                                        onKeyDown={handleScanKeyDown}
                                        placeholder="Scanner un code-barres ou rechercher un article… (Entrée pour ajouter)"
                                        className="w-full pl-10 pr-8 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                                    />
                                    {scanQuery && (
                                        <button onClick={() => { setScanQuery(''); setScanResults([]); }} className="absolute right-3 top-1/2 -translate-y-1/2">
                                            <X className="w-3.5 h-3.5 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                                {scanOpen && scanQuery.trim().length >= 1 && (
                                    <div
                                        className="absolute z-20 left-4 right-4 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                                        onMouseDown={e => e.preventDefault()} // keep focus on the search input
                                    >
                                        {scanning ? (
                                            <div className="flex justify-center py-3"><Loader2 className="w-4 h-4 animate-spin text-gray-400" /></div>
                                        ) : scanResults.length === 0 ? (
                                            <p className="text-xs text-gray-400 text-center py-3">Aucun article trouvé</p>
                                        ) : (
                                            <div className="max-h-64 overflow-y-auto divide-y divide-gray-50">
                                                {scanResults.map(hit => (
                                                    <button
                                                        key={hit.product.id}
                                                        onClick={() => addToCart(hit)}
                                                        className="w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors flex items-center justify-between gap-3"
                                                    >
                                                        <div className="min-w-0 flex items-center gap-2">
                                                            <span className="text-[10px] font-mono font-bold text-indigo-600 shrink-0">{hit.product.code}</span>
                                                            <span className="text-xs font-medium text-gray-800 truncate">{hit.product.name}</span>
                                                        </div>
                                                        <div className="flex items-center gap-3 shrink-0">
                                                            <span className={`text-[10px] font-semibold ${hit.stock == null ? 'text-gray-300' : hit.stock > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                                                                {hit.stock == null ? 'stock —' : `stock ${fmt(hit.stock, 0)}`}
                                                            </span>
                                                            <span className="text-xs font-bold text-gray-900">{fmtMAD(hit.product.price)}</span>
                                                        </div>
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* ── Lines grid ─────────────────────────────────── */}
                            <div className="flex-1 overflow-y-auto px-4 py-3">
                                {cart.length === 0 ? (
                                    <div className="text-center py-16 text-xs text-gray-400">
                                        <ShoppingCart className="w-10 h-10 mx-auto mb-2 text-gray-200" />
                                        Panier vide — scannez ou recherchez un article ci-dessus
                                    </div>
                                ) : (
                                    <table className="w-full bg-white rounded-xl border border-gray-200 overflow-hidden text-xs">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200 text-[10px] uppercase tracking-wider text-gray-400">
                                                <th className="text-left font-semibold px-3 py-2 w-24">Code</th>
                                                <th className="text-left font-semibold px-3 py-2">Article</th>
                                                <th className="text-right font-semibold px-3 py-2 w-20">Stock</th>
                                                <th className="text-right font-semibold px-3 py-2 w-24">P.U. HT</th>
                                                <th className="text-center font-semibold px-3 py-2 w-24">Quantité</th>
                                                <th className="text-right font-semibold px-3 py-2 w-28">Total TTC</th>
                                                <th className="w-10"></th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {cart.map((line, idx) => {
                                                const lineHT = (Number(line.product.price) || 0) * line.quantity;
                                                const lineTTC = lineHT * (1 + vatRateOf(line.product) / 100);
                                                const short = line.stock != null && line.quantity > line.stock;
                                                return (
                                                    <tr key={line.product.id} className="hover:bg-gray-50/60">
                                                        <td className="px-3 py-2 font-mono font-bold text-indigo-600">{line.product.code}</td>
                                                        <td className="px-3 py-2 font-medium text-gray-800">{line.product.name}</td>
                                                        <td className={`px-3 py-2 text-right font-semibold ${short ? 'text-red-500' : line.stock != null ? 'text-gray-500' : 'text-gray-300'}`}>
                                                            {line.stock == null ? '—' : fmt(line.stock, 0)}
                                                        </td>
                                                        <td className="px-3 py-2 text-right text-gray-600">{fmtMAD(line.product.price)}</td>
                                                        <td className="px-2 py-1.5">
                                                            <input
                                                                type="number"
                                                                min={0}
                                                                value={line.quantity}
                                                                ref={el => { qtyRefs.current[idx] = el; }}
                                                                onChange={e => updateQuantity(line.product.id, e.target.value === '' ? 0 : parseInt(e.target.value, 10) || 0)}
                                                                onBlur={() => handleQtyBlur(line.product.id, line.quantity)}
                                                                onKeyDown={e => handleQtyKeyDown(e, idx)}
                                                                className="w-full text-center px-2 py-1 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-1 focus:ring-sage-400"
                                                            />
                                                        </td>
                                                        <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtMAD(lineTTC)}</td>
                                                        <td className="px-2 py-2 text-center">
                                                            <button onClick={() => removeLine(line.product.id)} className="text-red-400 hover:text-red-600">
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                )}
                            </div>

                            {/* ── Bottom panel: totals + payment + validate ──── */}
                            <div className="shrink-0 bg-white border-t border-gray-200 px-5 py-4">
                                <div className="flex items-start gap-6">
                                    {/* Payment method + conditional fields */}
                                    <div className="flex-1 space-y-3">
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

                                        {methodDef.needsTerm && (
                                            <select
                                                value={paymentTermId ?? ''}
                                                onChange={e => setPaymentTermId(e.target.value ? parseInt(e.target.value, 10) : null)}
                                                className="w-full max-w-xs px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 bg-white"
                                            >
                                                <option value="">Terme par défaut du client</option>
                                                {partnerTerms.map(t => (
                                                    <option key={t.id} value={t.id}>{t.name}</option>
                                                ))}
                                            </select>
                                        )}

                                        {methodDef.needsInstrument && (
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

                                        <input
                                            value={notes}
                                            onChange={e => setNotes(e.target.value)}
                                            placeholder="Notes (optionnel)…"
                                            className="w-full max-w-md px-3 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                                        />

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
                                            <p className="text-[9px] text-gray-400 text-right">estimation — confirmée à la validation</p>
                                        </div>
                                        <button
                                            onClick={handleSubmit}
                                            disabled={!canSubmit}
                                            className="w-full flex items-center justify-center gap-2 py-3 bg-sage-600 text-white text-sm font-bold rounded-xl hover:bg-sage-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors shadow-sm"
                                        >
                                            {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                            Valider &amp; Imprimer
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
    );
}
