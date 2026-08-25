import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import type { AgGridReact } from 'ag-grid-react';
import {
    Landmark, Search, X, Loader2, RefreshCw, Plus,
    Building2, FileText, Wallet, History, TrendingUp, TrendingDown, Scale,
    Upload, CheckCircle2, Ban, AlertTriangle, Lock, RotateCcw, Maximize2, Minimize2, Download,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { SageTabs } from '@/components/common/SageTabs';
import { DataGrid } from '@/components/common/DataGrid';
import { ReglementForm } from '@/components/gcom/ReglementForm';

import { gcomApi } from '@/services/api/gcomApi';
import { getPartners, getPartner } from '@/services/api/partnerApi';
import type { Partner } from '@/types/partner.types';
import type {
    GcomOpenInvoice, GcomPayment, GcomFinancialInstrument, GcomLedgerEntry,
    GcomInvoiceStatus, GcomInstrumentStatus, GcomLedgerEntryType,
} from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmt = (n: number | string | undefined | null, decimals = 2) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : v.toLocaleString('fr-MA', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
};
const fmtMAD = (n: number | string | undefined | null) => `${fmt(n)} MAD`;
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const CLIENT_PAGE_SIZE = 20;

// ─── Status badges ──────────────────────────────────────────────────────────

const INVOICE_STATUS_META: Record<GcomInvoiceStatus, { label: string; dot: string; text: string }> = {
    // "Non réglée" not "En attente" — same relabel as FacturesPage.tsx's
    // STATUS_META, standard ERP terminology (Sage/Odoo), avoids reading like
    // a draft/approval-pending state.
    pending: { label: 'Non réglée', dot: 'bg-amber-500', text: 'text-amber-700' },
    partially_paid: { label: 'Partiel', dot: 'bg-blue-500', text: 'text-blue-700' },
    fully_paid: { label: 'Payée', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    overdue: { label: 'En retard', dot: 'bg-red-500', text: 'text-red-700' },
};
const InvoiceStatusBadge = ({ status }: { status: GcomInvoiceStatus }) => {
    const m = INVOICE_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const INSTRUMENT_STATUS_META: Record<GcomInstrumentStatus, { label: string; dot: string; text: string }> = {
    PENDING: { label: 'En portefeuille', dot: 'bg-amber-500', text: 'text-amber-700' },
    DEPOSITED: { label: 'Déposé', dot: 'bg-blue-500', text: 'text-blue-700' },
    CLEARED: { label: 'Encaissé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    REJECTED: { label: 'Rejeté', dot: 'bg-red-500', text: 'text-red-700' },
};
const InstrumentStatusBadge = ({ status }: { status: GcomInstrumentStatus }) => {
    const m = INSTRUMENT_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

// Dot+text, no filled background — matches INVOICE_STATUS_META/
// INSTRUMENT_STATUS_META's style below (established GCOM convention, no
// filled-pill badges).
const LEDGER_TYPE_META: Record<GcomLedgerEntryType, { label: string; dot: string; text: string }> = {
    invoice: { label: 'Facture', dot: 'bg-gray-400', text: 'text-gray-600' },
    payment: { label: 'Paiement', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    credit_note: { label: 'Avoir', dot: 'bg-indigo-500', text: 'text-indigo-700' },
};
const LedgerTypeBadge = ({ type }: { type: GcomLedgerEntryType }) => {
    const m = LEDGER_TYPE_META[type] ?? { label: type, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

// ─── Header KPI cards ───────────────────────────────────────────────────────

const KPI_TONES = {
    slate: { bg: 'bg-gray-50', text: 'text-gray-900', icon: 'text-gray-400' },
    emerald: { bg: 'bg-emerald-50', text: 'text-emerald-700', icon: 'text-emerald-500' },
    amber: { bg: 'bg-amber-50', text: 'text-amber-700', icon: 'text-amber-500' },
    indigo: { bg: 'bg-indigo-50', text: 'text-indigo-700', icon: 'text-indigo-500' },
} as const;

const KpiCard: React.FC<{
    label: string;
    icon: React.ElementType;
    tone: keyof typeof KPI_TONES;
    loading: boolean;
    value: string | null;
}> = ({ label, icon: Icon, tone, loading, value }) => {
    const t = KPI_TONES[tone];
    return (
        <div className={`rounded-xl border border-gray-200 ${t.bg} px-3.5 py-3`}>
            <div className="flex items-center gap-1.5 mb-1.5">
                <Icon className={`w-3.5 h-3.5 ${t.icon}`} />
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">{label}</span>
            </div>
            {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
            ) : (
                <span className={`text-sm font-bold tabular-nums ${t.text}`}>{value ?? '—'}</span>
            )}
        </div>
    );
};

// ─── Component ───────────────────────────────────────────────────────────────

export default function ReglementPage() {
    const [searchParams] = useSearchParams();

    // ── Client list (sidebar) ────────────────────────────────────────────────
    const [clients, setClients] = useState<Partner[]>([]);
    const [clientsLoading, setClientsLoading] = useState(false);
    const [clientSearch, setClientSearch] = useState('');
    const [clientPage, setClientPage] = useState(1);
    const [clientHasMore, setClientHasMore] = useState(false);
    const clientSearchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Solde Dû per client — GET /partners/{id}/statement, verified live 2026-08-16
    // as genuinely fixed (treasury-unification gap closed: a fresh comptoir cash
    // sale now correctly nets to 0 balance, not the sale's full amount). One call
    // per partner instead of paginating that partner's whole invoice history.
    // Both caches are plain refs (not React state) so a solde resolving never
    // forces a new `rowData` array reference on the grid — only `refreshCells()`
    // below repaints the column in place, avoiding the rowData-churn pattern that
    // previously destabilized this same grid (see memory).
    const soldeCache = useRef<Map<number, number>>(new Map());
    const soldeLoadingIds = useRef<Set<number>>(new Set());
    const clientGridRef = useRef<AgGridReact>(null);

    const loadSoldeForPartners = useCallback(async (partnerIds: number[]) => {
        const idsToFetch = partnerIds.filter(id => !soldeCache.current.has(id));
        if (idsToFetch.length === 0) return;
        idsToFetch.forEach(id => soldeLoadingIds.current.add(id));
        clientGridRef.current?.api?.refreshCells({ columns: ['solde'], force: true });
        await Promise.all(idsToFetch.map(async id => {
            try {
                const statement = await gcomApi.partners.statement(id);
                soldeCache.current.set(id, statement.current_balance);
            } catch {
                soldeCache.current.set(id, NaN);
            }
        }));
        idsToFetch.forEach(id => soldeLoadingIds.current.delete(id));
        clientGridRef.current?.api?.refreshCells({ columns: ['solde'], force: true });
    }, []);

    // Guards against an older in-flight request (e.g. a stale search) resolving
    // after a newer one and silently overwriting fresher state with fewer rows.
    const clientRequestSeq = useRef(0);

    const loadClients = useCallback(async (search: string, page: number, append: boolean) => {
        const seq = ++clientRequestSeq.current;
        setClientsLoading(true);
        try {
            const res = await getPartners({ search: search.trim() || undefined, per_page: CLIENT_PAGE_SIZE, page });
            if (seq !== clientRequestSeq.current) return; // superseded by a newer request
            const rows = res.partners.data ?? [];
            setClients(prev => append ? [...prev, ...rows] : rows);
            const curPage = res.partners.current_page ?? page;
            setClientPage(curPage);
            setClientHasMore(curPage < (res.partners.last_page ?? curPage));
            loadSoldeForPartners(rows.map(r => r.id));
        } catch {
            if (seq === clientRequestSeq.current) toast.error('Erreur chargement des clients');
        } finally {
            if (seq === clientRequestSeq.current) setClientsLoading(false);
        }
    }, [loadSoldeForPartners]);

    useEffect(() => {
        if (clientSearchDebounce.current) clearTimeout(clientSearchDebounce.current);
        clientSearchDebounce.current = setTimeout(() => loadClients(clientSearch, 1, false), 300);
        return () => { if (clientSearchDebounce.current) clearTimeout(clientSearchDebounce.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [clientSearch]);

    const loadMoreClients = () => { if (clientHasMore) loadClients(clientSearch, clientPage + 1, true); };

    // Column defs read `soldeCache`/`soldeLoadingIds` refs directly (not merged
    // into rowData) — `rowData` stays exactly `clients`, so a resolving solde
    // fetch never changes the grid's row identity, only triggers refreshCells().
    const clientColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'code', headerName: 'Code Client', width: 110,
            cellRenderer: (p: ICellRendererParams<Partner, string>) => (
                <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>{p.value}</span>
            ),
        },
        {
            field: 'name', headerName: 'Intitulé', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<Partner, string>) => (
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>{p.value}</span>
            ),
        },
        {
            field: 'status', headerName: 'Statut', width: 90, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<Partner, string>) => {
                const active = p.value === 'ACTIVE';
                return (
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: '10px', fontWeight: 600, color: active ? '#059669' : '#dc2626' }}>
                        <span style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#10b981' : '#ef4444' }} />
                        {p.value ?? '—'}
                    </span>
                );
            },
        },
        {
            colId: 'solde', headerName: 'Solde Dû', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<Partner>) => (p.data ? soldeCache.current.get(p.data.id) ?? null : null),
            cellStyle: { textAlign: 'right' },
            headerClass: 'ag-right-aligned-header',
            cellRenderer: (p: ICellRendererParams<Partner, number | null>) => {
                if (p.data && soldeLoadingIds.current.has(p.data.id)) return <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-300 ml-auto" />;
                const v = p.value;
                if (v == null || Number.isNaN(v)) return <span style={{ color: '#d1d5db', fontSize: '11px' }}>—</span>;
                return <span style={{ fontSize: '12px', fontWeight: 700, color: v > 0 ? '#d97706' : '#059669' }}>{fmtMAD(v)}</span>;
            },
        },
    ], []);

    // ── Selected partner + its account data ──────────────────────────────────
    const [activeTab, setActiveTab] = useState<'invoices' | 'instruments' | 'payments' | 'ledger'>('invoices');
    const [selectedPartner, setSelectedPartner] = useState<Partner | null>(null);
    const [showReglementForm, setShowReglementForm] = useState(false);

    const [openInvoices, setOpenInvoices] = useState<GcomOpenInvoice[]>([]);
    const [loadingInvoices, setLoadingInvoices] = useState(false);
    const [instruments, setInstruments] = useState<GcomFinancialInstrument[]>([]);
    const [loadingInstruments, setLoadingInstruments] = useState(false);
    const [instrumentStatusFilter, setInstrumentStatusFilter] = useState<'all' | GcomInstrumentStatus>('all');
    const [payments, setPayments] = useState<GcomPayment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    // Reçu d'encaissement reprint (2026-09-03) — per-row loading id, same
    // pattern as every other per-row PDF button in GCOM (Avoirs/BL return).
    const [receiptPdfLoadingId, setReceiptPdfLoadingId] = useState<number | null>(null);
    const openReceiptPdf = async (paymentId: number) => {
        setReceiptPdfLoadingId(paymentId);
        try {
            const url = await gcomApi.payments.getPdfBlobUrl(paymentId);
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le reçu PDF');
        } finally {
            setReceiptPdfLoadingId(null);
        }
    };
    const [ledger, setLedger] = useState<GcomLedgerEntry[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [ledgerFrom, setLedgerFrom] = useState('');
    const [ledgerTo, setLedgerTo] = useState('');

    // Fullscreen toggle for the active tab's content (Factures Ouvertes/
    // Chèques & Effets/Historique des Paiements/Relevé de Compte, whichever
    // is selected) — same Maximize2/Minimize2, fixed inset-0, ESC-to-close
    // pattern established in GcomCatalogEntryScreen/PortefeuilleInstrumentsPage/
    // RelevesComptePage.
    const [isTabExpanded, setIsTabExpanded] = useState(false);
    useEffect(() => {
        if (!isTabExpanded) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsTabExpanded(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isTabExpanded]);
    // AG Grid's flex columns size themselves against the container width at
    // mount time (DataGrid's onGridReady) — an already-mounted grid doesn't
    // automatically re-fit when the fixed-position wrapper's width changes
    // out from under it, which left a large empty gap to the right of the
    // grid after toggling. Force a re-fit once the layout has settled.
    const gridApiRef = useRef<AgGridReact>(null);
    useEffect(() => {
        const raf = requestAnimationFrame(() => gridApiRef.current?.api?.sizeColumnsToFit());
        return () => cancelAnimationFrame(raf);
    }, [isTabExpanded, activeTab]);

    const loadOpenInvoices = useCallback(async (partnerId: number) => {
        setLoadingInvoices(true);
        try {
            setOpenInvoices(await gcomApi.partners.openInvoices(partnerId));
        } catch {
            toast.error('Erreur chargement des factures ouvertes');
            setOpenInvoices([]);
        } finally {
            setLoadingInvoices(false);
        }
    }, []);

    // No status filter here — the tab now needs every lifecycle stage visible
    // (PENDING/DEPOSITED get actions, CLEARED/REJECTED are read-only history).
    // The "Encours" KPI below filters this same list down to PENDING itself.
    const loadInstruments = useCallback(async (partnerId: number) => {
        setLoadingInstruments(true);
        try {
            const res = await gcomApi.partners.financialInstruments(partnerId, { per_page: 100 });
            setInstruments(res.data);
        } catch {
            setInstruments([]);
        } finally {
            setLoadingInstruments(false);
        }
    }, []);

    const loadPayments = useCallback(async (partnerId: number) => {
        setLoadingPayments(true);
        try {
            const res = await gcomApi.payments.listForPartner({ partner_id: partnerId, per_page: 50 });
            setPayments(res.data);
        } catch {
            setPayments([]);
        } finally {
            setLoadingPayments(false);
        }
    }, []);

    const loadLedger = useCallback(async (partnerId: number, from?: string, to?: string) => {
        setLoadingLedger(true);
        try {
            setLedger(await gcomApi.partners.ledger(partnerId, { from: from || undefined, to: to || undefined }));
        } catch {
            setLedger([]);
        } finally {
            setLoadingLedger(false);
        }
    }, []);

    // ── Header KPIs: Total Facturé / Total Réglé / Solde Dû ─────────────────────
    // GET /partners/{id}/statement — verified live 2026-08-16 that the
    // treasury-unification gap (comptoir cash/card auto-settlements missing from
    // total_credit/current_balance) is genuinely fixed: a fresh comptoir cash
    // sale now nets to a 0 balance immediately, and a mixed paid+pending scenario
    // (two invoices, one cash-settled, one left on credit) correctly split
    // total_debit/total_credit/current_balance. Replaces the earlier per-invoice
    // pagination workaround — one call instead of looping every invoice page.
    const [accountSummary, setAccountSummary] = useState<{ invoiced: number; paid: number; due: number } | null>(null);
    const [loadingSummary, setLoadingSummary] = useState(false);

    const loadAccountSummary = useCallback(async (partnerId: number) => {
        setLoadingSummary(true);
        try {
            const statement = await gcomApi.partners.statement(partnerId);
            setAccountSummary({ invoiced: statement.total_debit, paid: statement.total_credit, due: statement.current_balance });
        } catch {
            setAccountSummary(null);
        } finally {
            setLoadingSummary(false);
        }
    }, []);

    // Encours chèques/effets — real per-instrument data (added 2026-08-16),
    // summed from the same list rendered in the "Chèques & Effets" tab so the
    // header figure and the tab always agree.
    const pendingInstrumentsTotal = useMemo(
        () => instruments.filter(i => i.status === 'PENDING').reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
        [instruments],
    );

    const displayedInstruments = useMemo(
        () => instrumentStatusFilter === 'all' ? instruments : instruments.filter(i => i.status === instrumentStatusFilter),
        [instruments, instrumentStatusFilter],
    );

    // ── Chèque/effet lifecycle actions (2026-08-18) ──────────────────────────
    const [depositTarget, setDepositTarget] = useState<GcomFinancialInstrument | null>(null);
    const [depositDate, setDepositDate] = useState('');
    const [depositReference, setDepositReference] = useState('');
    const [depositing, setDepositing] = useState(false);

    const openDeposit = (fi: GcomFinancialInstrument) => {
        setDepositTarget(fi);
        setDepositDate(new Date().toISOString().slice(0, 10));
        setDepositReference('');
    };
    const closeDeposit = () => setDepositTarget(null);

    const confirmDeposit = async () => {
        if (!depositTarget) return;
        setDepositing(true);
        try {
            await gcomApi.financialInstruments.deposit(depositTarget.id, {
                deposit_date: depositDate || undefined,
                deposit_reference: depositReference.trim() || undefined,
            });
            toast.success('Instrument remis en banque');
            setDepositTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la remise en banque');
        } finally {
            setDepositing(false);
        }
    };

    const [clearTarget, setClearTarget] = useState<GcomFinancialInstrument | null>(null);
    const [clearing, setClearing] = useState(false);

    const confirmClear = async () => {
        if (!clearTarget) return;
        setClearing(true);
        try {
            await gcomApi.financialInstruments.clear(clearTarget.id);
            toast.success('Instrument encaissé');
            setClearTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'encaissement");
        } finally {
            setClearing(false);
        }
    };

    // REJECTED → PENDING (2026-08-21) — completes the state machine's HTTP
    // surface. Doesn't re-close the invoice or re-credit the caisse (those
    // stay reversed from the original reject) — a fresh deposit()/clear()
    // represents an actual successful retry, this just resets the status.
    const [redepositTarget, setRedepositTarget] = useState<GcomFinancialInstrument | null>(null);
    const [redepositing, setRedepositing] = useState(false);

    const confirmRedeposit = async () => {
        if (!redepositTarget) return;
        setRedepositing(true);
        try {
            await gcomApi.financialInstruments.redeposit(redepositTarget.id);
            toast.success('Instrument remis en dépôt (PENDING)');
            setRedepositTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la remise en dépôt');
        } finally {
            setRedepositing(false);
        }
    };

    const [rejectTarget, setRejectTarget] = useState<GcomFinancialInstrument | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    const openReject = (fi: GcomFinancialInstrument) => { setRejectTarget(fi); setRejectReason(''); };
    const closeReject = () => setRejectTarget(null);

    const confirmReject = async () => {
        if (!rejectTarget || !rejectReason.trim()) { toast.error('Motif requis'); return; }
        setRejecting(true);
        try {
            await gcomApi.financialInstruments.reject(rejectTarget.id, { reason: rejectReason.trim() });
            toast.success('Instrument déclaré impayé');
            setRejectTarget(null);
            refresh();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors du rejet');
        } finally {
            setRejecting(false);
        }
    };

    const selectPartner = (p: Partner) => {
        setSelectedPartner(p);
        setShowReglementForm(false);
        setActiveTab('invoices');
        setLedgerFrom('');
        setLedgerTo('');
        loadOpenInvoices(p.id);
        loadInstruments(p.id);
        loadPayments(p.id);
        loadLedger(p.id);
        loadAccountSummary(p.id);
    };

    // Deep-link from another GCOM screen (e.g. the global Relevé de Compte
    // list) — ?partnerId=123 selects that client directly, optional
    // &tab=ledger jumps straight to the Relevé de Compte tab (selectPartner
    // itself always resets to 'invoices' first; setActiveTab after it in the
    // same synchronous block wins, same batching every other selectXxx here
    // relies on).
    useEffect(() => {
        const partnerIdParam = searchParams.get('partnerId');
        const partnerId = partnerIdParam ? parseInt(partnerIdParam, 10) : NaN;
        if (Number.isNaN(partnerId)) return;
        getPartner(partnerId)
            .then(res => {
                selectPartner(res.partner);
                if (searchParams.get('tab') === 'ledger') setActiveTab('ledger');
            })
            .catch(() => toast.error('Client introuvable'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refresh = () => {
        if (!selectedPartner) return;
        loadOpenInvoices(selectedPartner.id);
        loadInstruments(selectedPartner.id);
        loadPayments(selectedPartner.id);
        loadLedger(selectedPartner.id, ledgerFrom, ledgerTo);
        loadAccountSummary(selectedPartner.id);
        soldeCache.current.delete(selectedPartner.id);
        loadSoldeForPartners([selectedPartner.id]);
    };

    const applyLedgerFilter = () => {
        if (!selectedPartner) return;
        loadLedger(selectedPartner.id, ledgerFrom, ledgerTo);
    };

    const [ledgerPdfLoading, setLedgerPdfLoading] = useState(false);
    const handleLedgerPdf = async () => {
        if (!selectedPartner) return;
        setLedgerPdfLoading(true);
        try {
            const url = await gcomApi.partners.getLedgerPdfBlobUrl(selectedPartner.id, {
                from: ledgerFrom || undefined,
                to: ledgerTo || undefined,
            });
            if (url) window.open(url, '_blank');
        } catch {
            toast.error('Impossible de charger le relevé de compte PDF');
        } finally {
            setLedgerPdfLoading(false);
        }
    };

    // ── Action panel ──────────────────────────────────────────────────────────
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => [{
        items: showReglementForm
            ? [{ icon: X, label: 'Retour à la consultation', variant: 'warning', onClick: () => setShowReglementForm(false) }]
            : [
                { icon: Plus, label: 'Nouveau règlement', variant: 'primary', onClick: () => setShowReglementForm(true), disabled: !selectedPartner },
                { icon: RefreshCw, label: 'Actualiser', variant: 'default', onClick: refresh, disabled: !selectedPartner },
            ],
    }],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedPartner, showReglementForm]);

    // ── DataGrid columns ─────────────────────────────────────────────────────

    const invoicesColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'invoice_number', headerName: 'N° Facture', width: 150,
            valueGetter: (p: ValueGetterParams<GcomOpenInvoice>) => p.data?.invoice_number ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomOpenInvoice, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 120, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomOpenInvoice>) => p.data ? <InvoiceStatusBadge status={p.data.status} /> : null,
        },
        {
            field: 'due_date', headerName: 'Échéance', width: 120, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomOpenInvoice, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
        {
            colId: 'total_amount', headerName: 'Total', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomOpenInvoice>) => Number(p.data?.total_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomOpenInvoice, number>) => <span style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>{fmtMAD(p.value)}</span>,
        },
        {
            colId: 'remaining_amount', headerName: 'Reste à payer', width: 130, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomOpenInvoice>) => Number(p.data?.remaining_amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomOpenInvoice, number>) => <span style={{ fontSize: '11px', fontWeight: 700, color: '#d97706' }}>{fmtMAD(p.value)}</span>,
        },
    ], []);

    const instrumentsColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'instrument_type', headerName: 'Type', width: 100, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.value === 'CHEQUE' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{p.value}</span>
            ),
        },
        {
            field: 'reference_number', headerName: 'Référence', width: 140,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value ?? '—'}</span>,
        },
        {
            colId: 'amount', headerName: 'Montant', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomFinancialInstrument>) => Number(p.data?.amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, number>) => <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>,
        },
        {
            field: 'bank_name', headerName: 'Banque', flex: 1, minWidth: 120,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontSize: '12px' }}>{p.value ?? '—'}</span>,
        },
        {
            field: 'due_date', headerName: 'Échéance', width: 120, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 120, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument>) => p.data ? <InstrumentStatusBadge status={p.data.status} /> : null,
        },
        {
            colId: 'actions', headerName: 'Actions', width: 220, sortable: false, filter: false, pinned: 'right',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument>) => {
                if (!p.data) return null;
                const fi = p.data;
                if (fi.status === 'PENDING') {
                    return (
                        <button
                            onClick={() => openDeposit(fi)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors"
                        >
                            <Upload className="w-3 h-3" /> Déposer en banque
                        </button>
                    );
                }
                if (fi.status === 'DEPOSITED') {
                    return (
                        <div className="flex items-center gap-1.5">
                            <button
                                onClick={() => setClearTarget(fi)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md hover:bg-emerald-100 transition-colors"
                            >
                                <CheckCircle2 className="w-3 h-3" /> Encaisser
                            </button>
                            <button
                                onClick={() => openReject(fi)}
                                className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 rounded-md hover:bg-red-100 transition-colors"
                            >
                                <Ban className="w-3 h-3" /> Rejeter
                            </button>
                        </div>
                    );
                }
                if (fi.status === 'REJECTED') {
                    return (
                        <button
                            onClick={() => setRedepositTarget(fi)}
                            className="flex items-center gap-1 px-2 py-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-md hover:bg-amber-100 transition-colors"
                        >
                            <RotateCcw className="w-3 h-3" /> Remettre en dépôt
                        </button>
                    );
                }
                // CLEARED — terminal state, read-only.
                return (
                    <span className="flex items-center gap-1 text-[10px] text-gray-400" title="État terminal">
                        <Lock className="w-3 h-3" /> —
                    </span>
                );
            },
        },
    ], []);

    const paymentsColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'code', headerName: 'Code', width: 150,
            valueGetter: (p: ValueGetterParams<GcomPayment>) => p.data?.code ?? `#${p.data?.id}`,
            cellRenderer: (p: ICellRendererParams<GcomPayment, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value}</span>,
        },
        {
            field: 'reference', headerName: 'Référence', flex: 1, minWidth: 120,
            cellRenderer: (p: ICellRendererParams<GcomPayment, string>) => <span style={{ fontSize: '12px' }}>{p.value ?? '—'}</span>,
        },
        {
            colId: 'amount', headerName: 'Montant', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPayment>) => Number(p.data?.amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPayment, number>) => <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>,
        },
        {
            field: 'payment_date', headerName: 'Date', width: 120, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomPayment, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
        {
            field: 'status', headerName: 'Statut', width: 120,
            cellRenderer: (p: ICellRendererParams<GcomPayment, string>) => <span style={{ fontSize: '11px', color: '#6b7280', textTransform: 'capitalize' }}>{p.value ?? '—'}</span>,
        },
        {
            colId: 'receipt', headerName: '', width: 56, sortable: false, filter: false, resizable: false,
            cellRenderer: (p: ICellRendererParams<GcomPayment>) => {
                if (!p.data) return null;
                const paymentId = p.data.id;
                const loading = receiptPdfLoadingId === paymentId;
                return (
                    <button
                        onClick={() => openReceiptPdf(paymentId)}
                        disabled={loading}
                        title="Imprimer le reçu"
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', color: '#6b7280', opacity: loading ? 0.5 : 1 }}
                    >
                        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    </button>
                );
            },
        },
    ], [receiptPdfLoadingId]);

    const ledgerColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'date', headerName: 'Date', width: 110, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
        {
            field: 'type', headerName: 'Type', width: 110, filter: 'agTextColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry>) => p.data ? <LedgerTypeBadge type={p.data.type} /> : null,
        },
        {
            field: 'reference', headerName: 'Référence', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>{p.value}</span>,
        },
        {
            field: 'debit', headerName: 'Débit', width: 110, filter: 'agNumberColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, number>) => (p.value ? <span style={{ fontSize: '11px', fontWeight: 600, color: '#111827' }}>{fmtMAD(p.value)}</span> : <span style={{ color: '#d1d5db' }}>—</span>),
        },
        {
            field: 'credit', headerName: 'Crédit', width: 110, filter: 'agNumberColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, number>) => (p.value ? <span style={{ fontSize: '11px', fontWeight: 600, color: '#059669' }}>{fmtMAD(p.value)}</span> : <span style={{ color: '#d1d5db' }}>—</span>),
        },
        {
            field: 'running_balance', headerName: 'Solde Progressif', width: 140, filter: 'agNumberColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, number>) => {
                const v = p.value ?? 0;
                return <span style={{ fontSize: '11px', fontWeight: 700, color: v > 0 ? '#d97706' : '#059669' }}>{fmtMAD(v)}</span>;
            },
        },
    ], []);

    // ─────────────────────────────────────────────────────────────────────────
    // RENDER
    // ─────────────────────────────────────────────────────────────────────────

    return (
        <>
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col overflow-hidden">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-2">
                            <Building2 className="w-4 h-4 text-sage-600" />
                            <h2 className="text-sm font-bold text-gray-900">Clients</h2>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                value={clientSearch}
                                onChange={e => setClientSearch(e.target.value)}
                                placeholder="Rechercher un client…"
                                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70"
                            />
                            {clientSearch && (
                                <button onClick={() => setClientSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="flex-1 min-h-0">
                        <DataGrid
                            ref={clientGridRef}
                            rowData={clients}
                            columnDefs={clientColumnDefs}
                            loading={clientsLoading && clients.length === 0}
                            rowActionLoading={loadingInvoices || loadingInstruments || loadingPayments || loadingLedger || loadingSummary}
                            rowSelection="single"
                            getRowId={data => String(data.id)}
                            defaultSelectedIds={row => row.id === selectedPartner?.id}
                            onRowClicked={e => { if (e.data) selectPartner(e.data); }}
                            headerHeight={28}
                            rowHeight={44}
                        />
                    </div>
                    {clientHasMore && (
                        <div className="shrink-0 p-2 border-t border-gray-100">
                            <button
                                onClick={loadMoreClients}
                                disabled={clientsLoading}
                                className="w-full flex items-center justify-center gap-1.5 py-2 text-[11px] font-semibold text-sage-700 hover:bg-sage-50 rounded-lg transition-colors disabled:opacity-50"
                            >
                                {clientsLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                                Charger plus
                            </button>
                        </div>
                    )}
                </div>
            }

            mainContent={
                <div className="h-full flex flex-col overflow-hidden bg-gray-50">
                    {!selectedPartner ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <Landmark className="w-12 h-12 mb-3 text-gray-200" />
                            <p className="text-sm font-medium text-gray-600 mb-1">Règlements & Trésorerie Client</p>
                            <p className="text-xs max-w-xs">Sélectionnez un client dans la liste pour consulter son compte et enregistrer un règlement.</p>
                        </div>
                    ) : showReglementForm ? (
                        <ReglementForm
                            partner={selectedPartner}
                            openInvoices={openInvoices}
                            loadingInvoices={loadingInvoices}
                            accountSummary={accountSummary}
                            onCancel={() => setShowReglementForm(false)}
                            onSuccess={() => { setShowReglementForm(false); refresh(); }}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Fiche financière — persists across tabs */}
                            <div className="shrink-0 bg-white border-b border-gray-200 px-6 pt-5 pb-0">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <h2 className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                            <Landmark className="w-4 h-4 text-sage-600" /> {selectedPartner.name}
                                        </h2>
                                        <p className="text-[11px] text-gray-400 mt-0.5">{selectedPartner.code}</p>
                                    </div>
                                    <button
                                        onClick={() => setShowReglementForm(true)}
                                        className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-sage-600 hover:bg-sage-700 rounded-lg transition-colors shrink-0"
                                    >
                                        <Plus className="w-3.5 h-3.5" /> Nouveau Règlement
                                    </button>
                                </div>
                                <div className="grid grid-cols-4 gap-3 mb-4">
                                    <KpiCard
                                        label="Total Facturé (Débit)"
                                        icon={TrendingUp}
                                        tone="slate"
                                        loading={loadingSummary}
                                        value={accountSummary ? fmtMAD(accountSummary.invoiced) : null}
                                    />
                                    <KpiCard
                                        label="Total Réglé (Crédit)"
                                        icon={TrendingDown}
                                        tone="emerald"
                                        loading={loadingSummary}
                                        value={accountSummary ? fmtMAD(accountSummary.paid) : null}
                                    />
                                    <KpiCard
                                        label="Solde Dû Actuel"
                                        icon={Scale}
                                        tone={accountSummary && accountSummary.due > 0 ? 'amber' : 'emerald'}
                                        loading={loadingSummary}
                                        value={accountSummary ? fmtMAD(accountSummary.due) : null}
                                    />
                                    <KpiCard
                                        label="Encours Chèques/Effets"
                                        icon={Wallet}
                                        tone="indigo"
                                        loading={loadingInstruments}
                                        value={fmtMAD(pendingInstrumentsTotal)}
                                    />
                                </div>
                            </div>

                            {/* Tabs + active tab's content — both go fullscreen together so
                                the user can still switch tabs while maximized, not just stare
                                at whichever table was active when they clicked the toggle. */}
                            <div className={isTabExpanded ? 'fixed inset-0 z-50 bg-white flex flex-col' : 'flex-1 min-h-0 flex flex-col'}>
                                <div className="shrink-0 bg-white border-b border-gray-200 px-6 pt-2">
                                    <div className="flex items-end gap-2">
                                        <div className="flex-1 min-w-0">
                                            <SageTabs
                                                tabs={[
                                                    { id: 'invoices', label: 'Factures Ouvertes', icon: FileText },
                                                    { id: 'instruments', label: 'Chèques & Effets', icon: Wallet },
                                                    { id: 'payments', label: 'Historique des Paiements', icon: History },
                                                    { id: 'ledger', label: 'Relevé de Compte', icon: History },
                                                ]}
                                                activeTabId={activeTab}
                                                onTabChange={id => setActiveTab(id as typeof activeTab)}
                                                className="shadow-none px-0"
                                            />
                                        </div>
                                        <button
                                            onClick={() => setIsTabExpanded(v => !v)}
                                            title={isTabExpanded ? 'Réduire' : 'Plein écran'}
                                            className="mb-1.5 p-2 text-gray-500 hover:text-sage-600 hover:bg-white border border-gray-200 rounded-lg transition-colors shrink-0"
                                        >
                                            {isTabExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="flex-1 min-h-0 flex flex-col p-6">
                                {activeTab === 'invoices' && (
                                    <div className="flex-1 min-h-0">
                                        <DataGrid ref={gridApiRef} rowData={openInvoices} columnDefs={invoicesColumnDefs} loading={loadingInvoices} pagination paginationPageSize={20} />
                                    </div>
                                )}

                                {activeTab === 'instruments' && (
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <div className="flex flex-wrap gap-1 mb-3 shrink-0">
                                            {([
                                                { value: 'all', label: 'Tous' },
                                                { value: 'PENDING', label: 'En portefeuille' },
                                                { value: 'DEPOSITED', label: 'Déposé' },
                                                { value: 'CLEARED', label: 'Encaissé' },
                                                { value: 'REJECTED', label: 'Rejeté' },
                                            ] as const).map(f => (
                                                <button
                                                    key={f.value}
                                                    onClick={() => setInstrumentStatusFilter(f.value)}
                                                    className={`px-2.5 py-1 text-[11px] font-medium rounded-md border transition-colors ${
                                                        instrumentStatusFilter === f.value ? 'bg-sage-600 border-sage-600 text-white' : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                                                    }`}
                                                >
                                                    {f.label}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <DataGrid ref={gridApiRef} rowData={displayedInstruments} columnDefs={instrumentsColumnDefs} loading={loadingInstruments} pagination paginationPageSize={20} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'payments' && (
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <div className="flex-1 min-h-0">
                                            <DataGrid ref={gridApiRef} rowData={payments} columnDefs={paymentsColumnDefs} loading={loadingPayments} pagination paginationPageSize={20} />
                                        </div>
                                    </div>
                                )}

                                {activeTab === 'ledger' && (
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <div className="flex items-center gap-2 mb-3">
                                            <input type="date" value={ledgerFrom} onChange={e => setLedgerFrom(e.target.value)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            <span className="text-xs text-gray-400">→</span>
                                            <input type="date" value={ledgerTo} onChange={e => setLedgerTo(e.target.value)} className="px-2.5 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400" />
                                            <button onClick={applyLedgerFilter} className="px-3 py-1.5 text-xs font-semibold text-sage-700 bg-sage-50 hover:bg-sage-100 rounded-lg transition-colors">Filtrer</button>
                                            <button
                                                onClick={handleLedgerPdf}
                                                disabled={ledgerPdfLoading}
                                                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-gray-700 bg-white border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                                            >
                                                {ledgerPdfLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5" />}
                                                Exporter PDF
                                            </button>
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <DataGrid ref={gridApiRef} rowData={ledger} columnDefs={ledgerColumnDefs} loading={loadingLedger} pagination paginationPageSize={20} />
                                        </div>
                                    </div>
                                )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            }

            rightContent={<ActionPanel groups={actionGroups} />}
        />

        {/* ── Déposer en banque ────────────────────────────────────────────── */}
        {depositTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                            <Upload className="w-4 h-4 text-blue-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Déposer en banque</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                        <strong>{depositTarget.instrument_type} {depositTarget.reference_number}</strong> — {fmtMAD(depositTarget.amount)}
                    </p>
                    <div className="mb-3">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date de remise</label>
                        <input
                            type="date"
                            value={depositDate}
                            onChange={e => setDepositDate(e.target.value)}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                        />
                    </div>
                    <div className="mb-5">
                        <label className="block text-xs font-medium text-gray-600 mb-1">N° Bordereau (optionnel)</label>
                        <input
                            value={depositReference}
                            onChange={e => setDepositReference(e.target.value)}
                            placeholder="BORD-2026-001"
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={confirmDeposit}
                            disabled={depositing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                        >
                            {depositing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            Confirmer
                        </button>
                        <button onClick={closeDeposit} disabled={depositing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Encaisser ────────────────────────────────────────────────────── */}
        {clearTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-emerald-100 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Confirmer l'encaissement</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-5">
                        <strong>{clearTarget.instrument_type} {clearTarget.reference_number}</strong> — {fmtMAD(clearTarget.amount)} — le fonds a bien été crédité en banque ?
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={confirmClear}
                            disabled={clearing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                        >
                            {clearing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                            Confirmer
                        </button>
                        <button onClick={() => setClearTarget(null)} disabled={clearing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Remettre en dépôt (redeposit) ───────────────────────────────── */}
        {redepositTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                            <RotateCcw className="w-4 h-4 text-amber-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Remettre en dépôt</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                        <strong>{redepositTarget.instrument_type} {redepositTarget.reference_number}</strong> — {fmtMAD(redepositTarget.amount)} — repart en attente (PENDING).
                    </p>
                    <p className="flex items-start gap-1.5 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-1.5 mb-5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Ne rouvre ni la facture ni la caisse — pour représenter un vrai encaissement réussi, redéposez puis encaissez normalement ensuite.
                    </p>
                    <div className="flex gap-3">
                        <button
                            onClick={confirmRedeposit}
                            disabled={redepositing}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                        >
                            {redepositing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                            Confirmer
                        </button>
                        <button onClick={() => setRedepositTarget(null)} disabled={redepositing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* ── Rejeter ──────────────────────────────────────────────────────── */}
        {rejectTarget && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                    <div className="flex items-center gap-3 mb-3">
                        <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                            <Ban className="w-4 h-4 text-red-600" />
                        </div>
                        <h3 className="text-base font-semibold text-gray-900">Rejeter</h3>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">
                        <strong>{rejectTarget.instrument_type} {rejectTarget.reference_number}</strong> — {fmtMAD(rejectTarget.amount)}
                    </p>
                    <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-3">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                        Le rejet ne rouvre pas automatiquement la dette de la facture liée — c'est une limite connue, pas encore corrigée côté backend. Pensez à vérifier/ajuster le solde de la facture manuellement si besoin.
                    </div>
                    <div className="mb-5">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                        <textarea
                            value={rejectReason}
                            onChange={e => setRejectReason(e.target.value)}
                            rows={2}
                            maxLength={255}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                            placeholder="Provision insuffisante…"
                        />
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={confirmReject}
                            disabled={rejecting || !rejectReason.trim()}
                            className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                        >
                            {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                            Confirmer
                        </button>
                        <button onClick={closeReject} disabled={rejecting} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                            Annuler
                        </button>
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
