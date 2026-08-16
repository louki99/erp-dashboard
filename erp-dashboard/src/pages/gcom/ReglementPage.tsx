import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import type { AgGridReact } from 'ag-grid-react';
import {
    Landmark, Search, X, Loader2, RefreshCw, Plus,
    Building2, FileText, Wallet, History, TrendingUp, TrendingDown, Scale,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { SageTabs } from '@/components/common/SageTabs';
import { DataGrid } from '@/components/common/DataGrid';
import { ReglementForm } from '@/components/gcom/ReglementForm';

import { gcomApi } from '@/services/api/gcomApi';
import { getPartners, getPaymentTerms } from '@/services/api/partnerApi';
import type { Partner, PaymentTermOption } from '@/types/partner.types';
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
    pending: { label: 'En attente', dot: 'bg-amber-500', text: 'text-amber-700' },
    partially_paid: { label: 'Partiel', dot: 'bg-blue-500', text: 'text-blue-700' },
    fully_paid: { label: 'Payée', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    overdue: { label: 'En retard', dot: 'bg-red-500', text: 'text-red-700' },
};
const InvoiceStatusBadge = ({ status }: { status: GcomInvoiceStatus }) => {
    const m = INVOICE_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const INSTRUMENT_STATUS_META: Record<GcomInstrumentStatus, { label: string; dot: string; text: string }> = {
    PENDING: { label: 'En attente', dot: 'bg-amber-500', text: 'text-amber-700' },
    DEPOSITED: { label: 'Déposé', dot: 'bg-blue-500', text: 'text-blue-700' },
    CLEARED: { label: 'Encaissé', dot: 'bg-emerald-500', text: 'text-emerald-700' },
    REJECTED: { label: 'Rejeté', dot: 'bg-red-500', text: 'text-red-700' },
};
const InstrumentStatusBadge = ({ status }: { status: GcomInstrumentStatus }) => {
    const m = INSTRUMENT_STATUS_META[status] ?? { label: status, dot: 'bg-gray-400', text: 'text-gray-500' };
    return <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${m.text}`}><span className={`w-1.5 h-1.5 rounded-full ${m.dot}`} />{m.label}</span>;
};

const LEDGER_TYPE_META: Record<GcomLedgerEntryType, { label: string; cls: string }> = {
    invoice: { label: 'Facture', cls: 'bg-gray-100 text-gray-700' },
    payment: { label: 'Paiement', cls: 'bg-emerald-50 text-emerald-700' },
    credit_note: { label: 'Avoir', cls: 'bg-indigo-50 text-indigo-700' },
};
const LedgerTypeBadge = ({ type }: { type: GcomLedgerEntryType }) => {
    const m = LEDGER_TYPE_META[type] ?? { label: type, cls: 'bg-gray-100 text-gray-700' };
    return <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${m.cls}`}>{m.label}</span>;
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
            field: 'status', headerName: 'Statut', width: 90, filter: 'agSetColumnFilter',
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
    const [payments, setPayments] = useState<GcomPayment[]>([]);
    const [loadingPayments, setLoadingPayments] = useState(false);
    const [ledger, setLedger] = useState<GcomLedgerEntry[]>([]);
    const [loadingLedger, setLoadingLedger] = useState(false);
    const [ledgerFrom, setLedgerFrom] = useState('');
    const [ledgerTo, setLedgerTo] = useState('');
    const [partnerTerms, setPartnerTerms] = useState<PaymentTermOption[]>([]);

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

    const loadInstruments = useCallback(async (partnerId: number) => {
        setLoadingInstruments(true);
        try {
            const res = await gcomApi.partners.financialInstruments(partnerId, { status: 'PENDING', per_page: 100 });
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
        () => instruments.reduce((sum, i) => sum + (Number(i.amount) || 0), 0),
        [instruments],
    );

    const selectPartner = (p: Partner) => {
        setSelectedPartner(p);
        setShowReglementForm(false);
        setActiveTab('invoices');
        setLedgerFrom('');
        setLedgerTo('');
        setPartnerTerms([]);
        loadOpenInvoices(p.id);
        loadInstruments(p.id);
        loadPayments(p.id);
        loadLedger(p.id);
        loadAccountSummary(p.id);
        getPaymentTerms(p.id)
            .then(res => setPartnerTerms(res.partner?.paymentTerms ?? res.partner?.payment_terms ?? res.availableTerms ?? res.available_terms ?? []))
            .catch(() => setPartnerTerms([]));
    };

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
            field: 'status', headerName: 'Statut', width: 120, filter: 'agSetColumnFilter',
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
            field: 'instrument_type', headerName: 'Type', width: 100, filter: 'agSetColumnFilter',
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
            field: 'status', headerName: 'Statut', width: 120, filter: 'agSetColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument>) => p.data ? <InstrumentStatusBadge status={p.data.status} /> : null,
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
    ], []);

    const ledgerColumnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'date', headerName: 'Date', width: 110, filter: 'agDateColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomLedgerEntry, string>) => <span style={{ fontSize: '11px', color: '#6b7280' }}>{fmtDate(p.value)}</span>,
        },
        {
            field: 'type', headerName: 'Type', width: 110, filter: 'agSetColumnFilter',
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
                            partnerTerms={partnerTerms}
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

                            <div className="flex-1 min-h-0 flex flex-col p-6">
                                {activeTab === 'invoices' && (
                                    <div className="flex-1 min-h-0">
                                        <DataGrid rowData={openInvoices} columnDefs={invoicesColumnDefs} loading={loadingInvoices} pagination paginationPageSize={20} />
                                    </div>
                                )}

                                {activeTab === 'instruments' && (
                                    <div className="flex-1 min-h-0">
                                        <DataGrid rowData={instruments} columnDefs={instrumentsColumnDefs} loading={loadingInstruments} pagination paginationPageSize={20} />
                                    </div>
                                )}

                                {activeTab === 'payments' && (
                                    <div className="flex-1 min-h-0 flex flex-col">
                                        <div className="flex-1 min-h-0">
                                            <DataGrid rowData={payments} columnDefs={paymentsColumnDefs} loading={loadingPayments} pagination paginationPageSize={20} />
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
                                        </div>
                                        <div className="flex-1 min-h-0">
                                            <DataGrid rowData={ledger} columnDefs={ledgerColumnDefs} loading={loadingLedger} pagination paginationPageSize={20} />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            }

            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
