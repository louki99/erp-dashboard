import { useState, useEffect, useCallback, useMemo } from 'react';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    Wallet, RefreshCw, Landmark as BankIcon, Upload, Loader2, Filter, RotateCcw as ResetIcon,
    CheckCircle2, Ban, RotateCcw, Lock, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';

import { gcomApi } from '@/services/api/gcomApi';
import type { GcomFinancialInstrument, GcomInstrumentStatus, GcomInstrumentType, GcomFinancialInstrumentsGlobalFilters } from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtMAD = (n: number | string | undefined | null) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
};
const fmtDate = (d: string | null | undefined) => d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const todayISO = () => new Date().toISOString().slice(0, 10);

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

const STATUS_TABS: { key: GcomInstrumentStatus | 'ALL'; label: string }[] = [
    { key: 'ALL', label: 'Tous' },
    { key: 'PENDING', label: 'En attente' },
    { key: 'DEPOSITED', label: 'Déposés' },
    { key: 'CLEARED', label: 'Encaissés' },
    { key: 'REJECTED', label: 'Rejetés' },
];

// ─── Remise en banque groupée modal ─────────────────────────────────────────

interface BatchResult {
    deposited: GcomFinancialInstrument[];
    errors: { id: number; message: string }[];
}

const BatchDepositModal = ({
    instruments,
    onClose,
    onDone,
}: {
    instruments: GcomFinancialInstrument[];
    onClose: () => void;
    onDone: () => void;
}) => {
    const [depositDate, setDepositDate] = useState(todayISO());
    const [depositReference, setDepositReference] = useState('');
    const [saving, setSaving] = useState(false);
    const [result, setResult] = useState<BatchResult | null>(null);

    const total = instruments.reduce((sum, fi) => sum + (Number(fi.amount) || 0), 0);

    const handleSubmit = async () => {
        if (!depositReference.trim()) { toast.error('Le N° de bordereau est obligatoire pour une remise groupée'); return; }
        setSaving(true);
        try {
            const res = await gcomApi.financialInstruments.batchDeposit({
                instrument_ids: instruments.map(fi => fi.id),
                deposit_date: depositDate || undefined,
                deposit_reference: depositReference.trim(),
            });
            setResult(res);
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la remise en banque groupée');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-md w-full mx-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-9 h-9 rounded-full bg-blue-100 flex items-center justify-center">
                        <Upload className="w-4 h-4 text-blue-600" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-900">Remise en banque groupée</h3>
                </div>

                {result ? (
                    <div className="space-y-3">
                        {result.deposited.length > 0 && (
                            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                                <p className="text-xs font-semibold text-emerald-700 mb-1.5">{result.deposited.length} déposé(s)</p>
                                {result.deposited.map(fi => (
                                    <div key={fi.id} className="flex justify-between text-xs py-0.5">
                                        <span className="font-mono text-emerald-800">{fi.reference_number}</span>
                                        <span className="text-emerald-700">{fmtMAD(fi.amount)}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                        {result.errors.length > 0 && (
                            <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                                <p className="text-xs font-semibold text-red-700 mb-1.5">{result.errors.length} en erreur</p>
                                {result.errors.map(e => (
                                    <div key={e.id} className="text-xs text-red-700 py-0.5">
                                        <span className="font-mono">#{e.id}</span> — {e.message}
                                    </div>
                                ))}
                            </div>
                        )}
                        <button
                            onClick={() => { onDone(); onClose(); }}
                            className="w-full py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 transition-colors"
                        >
                            Fermer
                        </button>
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{instruments.length} instrument(s)</strong> sélectionné(s) — total <strong>{fmtMAD(total)}</strong>. Une seule date et un seul N° de bordereau seront appliqués à tout le lot.
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
                            <label className="block text-xs font-medium text-gray-600 mb-1">N° Bordereau *</label>
                            <input
                                value={depositReference}
                                onChange={e => setDepositReference(e.target.value)}
                                placeholder="BORD-2026-001"
                                autoFocus
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={handleSubmit}
                                disabled={saving}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                            >
                                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                                Confirmer la remise
                            </button>
                            <button onClick={onClose} disabled={saving} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const PortefeuilleInstrumentsPage = () => {
    const [rows, setRows] = useState<GcomFinancialInstrument[]>([]);
    const [loading, setLoading] = useState(false);
    // Defaults to "Tous" — a lone PENDING-only default reads as a broken/empty
    // screen the moment a tenant has no cheque currently awaiting deposit.
    const [statusFilter, setStatusFilter] = useState<GcomInstrumentStatus | 'ALL'>('ALL');
    const [typeFilter, setTypeFilter] = useState<GcomInstrumentType | 'ALL'>('ALL');
    const [dueDateFrom, setDueDateFrom] = useState('');
    const [dueDateTo, setDueDateTo] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [batchOpen, setBatchOpen] = useState(false);

    // Full-screen grid toggle — same pattern as GcomCatalogEntryScreen.tsx's
    // Comptoir view, for scanning a long list of instruments more easily.
    const [isExpanded, setIsExpanded] = useState(false);
    useEffect(() => {
        if (!isExpanded) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isExpanded]);

    // ── Single-instrument lifecycle actions (same 4 endpoints as
    // ReglementPage.tsx's per-partner tab, just reachable from the
    // company-wide list too) ────────────────────────────────────────────
    const [depositTarget, setDepositTarget] = useState<GcomFinancialInstrument | null>(null);
    const [depositDate, setDepositDate] = useState('');
    const [depositReference, setDepositReference] = useState('');
    const [depositing, setDepositing] = useState(false);

    const openDeposit = (fi: GcomFinancialInstrument) => {
        setDepositTarget(fi);
        setDepositDate(todayISO());
        setDepositReference('');
    };
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
            load();
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
            load();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? "Erreur lors de l'encaissement");
        } finally {
            setClearing(false);
        }
    };

    const [rejectTarget, setRejectTarget] = useState<GcomFinancialInstrument | null>(null);
    const [rejectReason, setRejectReason] = useState('');
    const [rejecting, setRejecting] = useState(false);

    const confirmReject = async () => {
        if (!rejectTarget) return;
        if (!rejectReason.trim()) { toast.error('Le motif est obligatoire'); return; }
        setRejecting(true);
        try {
            await gcomApi.financialInstruments.reject(rejectTarget.id, { reason: rejectReason.trim() });
            toast.success('Instrument rejeté — la créance client a été rouverte');
            setRejectTarget(null);
            load();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors du rejet');
        } finally {
            setRejecting(false);
        }
    };

    const [redepositTarget, setRedepositTarget] = useState<GcomFinancialInstrument | null>(null);
    const [redepositing, setRedepositing] = useState(false);

    const confirmRedeposit = async () => {
        if (!redepositTarget) return;
        setRedepositing(true);
        try {
            await gcomApi.financialInstruments.redeposit(redepositTarget.id);
            toast.success('Instrument remis en dépôt (en attente)');
            setRedepositTarget(null);
            load();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la remise en dépôt');
        } finally {
            setRedepositing(false);
        }
    };

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const filters: GcomFinancialInstrumentsGlobalFilters = { per_page: 100 };
            if (statusFilter !== 'ALL') filters.status = statusFilter;
            if (typeFilter !== 'ALL') filters.instrument_type = typeFilter;
            if (dueDateFrom) filters.due_date_from = dueDateFrom;
            if (dueDateTo) filters.due_date_to = dueDateTo;
            const res = await gcomApi.financialInstruments.list(filters);
            setRows(res.data);
        } catch {
            toast.error('Erreur lors du chargement du portefeuille');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [statusFilter, typeFilter, dueDateFrom, dueDateTo]);

    useEffect(() => { load(); }, [load]);
    // Selection doesn't survive a filter change/reload — the underlying id
    // set may no longer be visible, and a stale count would be misleading.
    useEffect(() => { setSelectedIds(new Set()); }, [statusFilter, typeFilter, dueDateFrom, dueDateTo]);

    const pendingRows = useMemo(() => rows.filter(r => r.status === 'PENDING'), [rows]);
    const allPendingSelected = pendingRows.length > 0 && pendingRows.every(r => selectedIds.has(r.id));

    const toggleRow = (id: number) => {
        setSelectedIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id); else next.add(id);
            return next;
        });
    };
    const toggleAllPending = () => {
        setSelectedIds(allPendingSelected ? new Set() : new Set(pendingRows.map(r => r.id)));
    };

    const selectedInstruments = useMemo(() => rows.filter(r => selectedIds.has(r.id)), [rows, selectedIds]);
    const selectedTotal = selectedInstruments.reduce((sum, fi) => sum + (Number(fi.amount) || 0), 0);

    const handleReset = () => {
        setStatusFilter('ALL');
        setTypeFilter('ALL');
        setDueDateFrom('');
        setDueDateTo('');
    };
    const hasActiveFilters = statusFilter !== 'ALL' || typeFilter !== 'ALL' || !!dueDateFrom || !!dueDateTo;

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            headerName: '',
            width: 44,
            pinned: 'left' as const,
            sortable: false,
            resizable: false,
            filter: false,
            headerComponent: () => (
                <input
                    type="checkbox"
                    checked={allPendingSelected}
                    onChange={toggleAllPending}
                    disabled={pendingRows.length === 0}
                    title="Sélectionner tous les instruments en attente"
                    className="w-3.5 h-3.5 rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                />
            ),
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument>) => {
                if (!p.data) return null;
                if (p.data.status !== 'PENDING') return <span className="flex items-center justify-center h-full text-gray-300 text-xs">—</span>;
                return (
                    <div className="flex items-center justify-center h-full">
                        <input
                            type="checkbox"
                            checked={selectedIds.has(p.data.id)}
                            onChange={() => toggleRow(p.data!.id)}
                            className="w-3.5 h-3.5 rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                        />
                    </div>
                );
            },
        },
        {
            field: 'instrument_type', headerName: 'Type', width: 90, filter: 'agSetColumnFilter',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => (
                <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${p.value === 'CHEQUE' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}>{p.value}</span>
            ),
        },
        {
            field: 'reference_number', headerName: 'Référence', width: 150,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 700, color: '#4338ca' }}>{p.value ?? '—'}</span>,
        },
        {
            colId: 'amount', headerName: 'Montant', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomFinancialInstrument>) => Number(p.data?.amount) || 0,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, number>) => <span style={{ fontSize: '11px', fontWeight: 700, color: '#111827' }}>{fmtMAD(p.value)}</span>,
        },
        {
            field: 'partner', headerName: 'Client', flex: 1, minWidth: 160,
            valueGetter: (p: ValueGetterParams<GcomFinancialInstrument>) => p.data?.partner?.name ?? '',
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontSize: '12px' }}>{p.value || '—'}</span>,
        },
        {
            field: 'bank_name', headerName: 'Banque', width: 130,
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
        {
            field: 'deposit_reference', headerName: 'N° Bordereau', width: 140,
            cellRenderer: (p: ICellRendererParams<GcomFinancialInstrument, string>) => <span style={{ fontFamily: 'monospace', fontSize: '11px', color: '#6b7280' }}>{p.value ?? '—'}</span>,
        },
        {
            colId: 'actions', headerName: 'Actions', width: 220, sortable: false, filter: false, pinned: 'right' as const,
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
                                onClick={() => setRejectTarget(fi)}
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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [selectedIds, allPendingSelected, pendingRows]);

    const mainContent = (
        <div className={isExpanded ? 'fixed inset-0 z-50 bg-gray-50 flex flex-col' : 'h-full flex flex-col bg-gray-50'}>
            <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                        <Wallet className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-gray-900">Portefeuille Chèques &amp; Effets</h1>
                        <p className="text-[11px] text-gray-500">
                            {loading ? 'Chargement…' : `${rows.length} instrument(s)`}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={load}
                        disabled={loading}
                        className="p-2 text-gray-500 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors disabled:opacity-50"
                        title="Rafraîchir"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                    <button
                        onClick={() => setIsExpanded(v => !v)}
                        title={isExpanded ? 'Réduire' : 'Plein écran'}
                        className="p-2 text-gray-500 hover:text-sage-600 hover:bg-sage-50 rounded-lg transition-colors"
                    >
                        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </div>

            <div className="bg-white border-b border-gray-200 px-5 py-4">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
                        <Filter className="w-4 h-4 text-sage-600" />
                        Filtres
                        {hasActiveFilters && (
                            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-sage-50 text-sage-700 border border-sage-200">
                                Actifs
                            </span>
                        )}
                    </div>
                    <button
                        onClick={handleReset}
                        disabled={!hasActiveFilters}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                    >
                        <ResetIcon className="w-3.5 h-3.5" />
                        Réinitialiser
                    </button>
                </div>

                <div className="flex items-center gap-1 mb-3">
                    {STATUS_TABS.map(opt => (
                        <button
                            key={opt.key}
                            onClick={() => setStatusFilter(opt.key)}
                            className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                                statusFilter === opt.key ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sage-300'
                            }`}
                        >
                            {opt.label}
                        </button>
                    ))}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Type</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value as GcomInstrumentType | 'ALL')}
                            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white transition-shadow"
                        >
                            <option value="ALL">Tous</option>
                            <option value="CHEQUE">Chèque</option>
                            <option value="EFFET">Effet</option>
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Échéance à partir de</label>
                        <input
                            type="date"
                            value={dueDateFrom}
                            onChange={e => setDueDateFrom(e.target.value)}
                            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 transition-shadow"
                        />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Échéance jusqu'à</label>
                        <input
                            type="date"
                            value={dueDateTo}
                            onChange={e => setDueDateTo(e.target.value)}
                            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 transition-shadow"
                        />
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-1">
                <DataGrid rowData={rows} columnDefs={columnDefs} loading={loading} suppressAutoFit />
            </div>

            {selectedIds.size > 0 && (
                <div className="border-t border-gray-200 bg-white px-5 py-3 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                        <strong>{selectedIds.size}</strong> sélectionné(s) — total <strong>{fmtMAD(selectedTotal)}</strong>
                    </span>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setSelectedIds(new Set())} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">
                            Désélectionner
                        </button>
                        <button
                            onClick={() => setBatchOpen(true)}
                            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                        >
                            <BankIcon className="w-4 h-4" /> Remise en banque groupée
                        </button>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            <MasterLayout leftContent={null} mainContent={mainContent} />
            {batchOpen && (
                <BatchDepositModal
                    instruments={selectedInstruments}
                    onClose={() => setBatchOpen(false)}
                    onDone={() => { load(); setSelectedIds(new Set()); }}
                />
            )}

            {/* ── Déposer en banque (single) ──────────────────────────────── */}
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
                            <button onClick={() => setDepositTarget(null)} disabled={depositing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Encaisser ────────────────────────────────────────────────── */}
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

            {/* ── Rejeter ──────────────────────────────────────────────────── */}
            {rejectTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <Ban className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Rejeter l'instrument</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-3">
                            <strong>{rejectTarget.instrument_type} {rejectTarget.reference_number}</strong> — {fmtMAD(rejectTarget.amount)} — la créance client sera rouverte automatiquement.
                        </p>
                        <div className="mb-5">
                            <label className="block text-xs font-medium text-gray-600 mb-1">Motif *</label>
                            <textarea
                                value={rejectReason}
                                onChange={e => setRejectReason(e.target.value)}
                                rows={2}
                                placeholder="Provision insuffisante…"
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                            />
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmReject}
                                disabled={rejecting}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {rejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                                Confirmer le rejet
                            </button>
                            <button onClick={() => setRejectTarget(null)} disabled={rejecting} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Remettre en dépôt (redeposit) ───────────────────────────── */}
            {redepositTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-amber-100 flex items-center justify-center">
                                <RotateCcw className="w-4 h-4 text-amber-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Remettre en dépôt</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            <strong>{redepositTarget.instrument_type} {redepositTarget.reference_number}</strong> — {fmtMAD(redepositTarget.amount)} — repart en attente (PENDING). Ne rouvre pas la créance ni ne recrédite la caisse — ceux-ci restent tels que le rejet les a laissés.
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
        </>
    );
};

export default PortefeuilleInstrumentsPage;
