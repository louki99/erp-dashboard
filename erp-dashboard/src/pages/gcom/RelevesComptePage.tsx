import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ICellRendererParams, ValueGetterParams } from 'ag-grid-community';
import {
    Scale, RefreshCw, Filter, RotateCcw as ResetIcon, Maximize2, Minimize2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import { gcomApi } from '@/services/api/gcomApi';
import { financeApi } from '@/services/api/financeApi';
import { getChannels } from '@/services/api/pricingApi';
import type { Channel } from '@/types/pricing.types';
import type { GcomPartnerStatementRow } from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtMAD = (n: number | string | undefined | null) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
};

// A negative balance means the client overpaid (avance/acompte), not a debt —
// backend fix 2026-08-25 (current_balance can now legitimately go negative).
// Never render the raw signed value: it reads as "the client owes -675 MAD",
// which is backwards. Always show the absolute amount with a sign-derived
// label/color instead.
const soldeDisplay = (balance: number): { label: string; amount: string; className: string } => {
    if (balance === 0) return { label: 'Soldé', amount: fmtMAD(0), className: 'text-gray-500' };
    if (balance < 0) return { label: 'Avance', amount: fmtMAD(Math.abs(balance)), className: 'text-emerald-700' };
    return { label: 'Dû', amount: fmtMAD(balance), className: 'text-amber-700' };
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const RelevesComptePage = () => {
    const navigate = useNavigate();
    const [rows, setRows] = useState<GcomPartnerStatementRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedBranch, setSelectedBranch] = useState<ComboboxOption | null>(null);
    const [channelFilter, setChannelFilter] = useState('');
    const [minBalance, setMinBalance] = useState('');
    const [includeZeroBalance, setIncludeZeroBalance] = useState(false);
    const [channels, setChannels] = useState<Channel[]>([]);
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        getChannels().then(setChannels).catch(() => setChannels([]));
    }, []);

    useEffect(() => {
        if (!isExpanded) return;
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') setIsExpanded(false); };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isExpanded]);

    const searchBranches = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
        return (res.data ?? []).map(b => ({ id: b.id, label: b.name, sub: b.code }));
    }, []);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await gcomApi.partners.statementsList({
                branch_id: selectedBranch ? Number(selectedBranch.id) : undefined,
                channel: channelFilter || undefined,
                min_balance: minBalance !== '' ? parseFloat(minBalance) : undefined,
                include_zero_balance: includeZeroBalance ? 1 : undefined,
                per_page: 100,
            });
            setRows(res.data);
        } catch {
            toast.error('Erreur lors du chargement des relevés de compte');
            setRows([]);
        } finally {
            setLoading(false);
        }
    }, [selectedBranch, channelFilter, minBalance, includeZeroBalance]);

    useEffect(() => { load(); }, [load]);

    const handleReset = () => {
        setSelectedBranch(null);
        setChannelFilter('');
        setMinBalance('');
        setIncludeZeroBalance(false);
    };
    const hasActiveFilters = !!selectedBranch || !!channelFilter || minBalance !== '' || includeZeroBalance;

    const goToPartnerLedger = (partnerId: number) => navigate(`/gcom/reglement?partnerId=${partnerId}&tab=ledger`);

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'partner_code', headerName: 'Code', width: 120,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, string>) => (
                <button onClick={() => goToPartnerLedger(p.data!.partner_id)} className="font-mono text-xs font-semibold text-sage-600 hover:underline">{p.value}</button>
            ),
        },
        {
            field: 'partner_name', headerName: 'Client', flex: 1, minWidth: 160,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, string>) => (
                <button onClick={() => goToPartnerLedger(p.data!.partner_id)} className="text-xs font-medium text-gray-800 hover:text-sage-700 hover:underline">{p.value}</button>
            ),
        },
        {
            colId: 'current_balance', headerName: 'Solde', width: 150, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPartnerStatementRow>) => Number(p.data?.current_balance) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, number>) => {
                const { label, amount, className } = soldeDisplay(p.value ?? 0);
                return (
                    <span className={`text-xs font-bold ${className}`}>
                        {amount}{(p.value ?? 0) !== 0 && <span className="text-[9px] font-semibold ml-1">({label})</span>}
                    </span>
                );
            },
        },
        {
            colId: 'total_debit', headerName: 'Total débit', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPartnerStatementRow>) => Number(p.data?.total_debit) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, number>) => <span className="text-xs text-gray-600">{fmtMAD(p.value)}</span>,
        },
        {
            colId: 'total_credit', headerName: 'Total crédit', width: 120, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPartnerStatementRow>) => Number(p.data?.total_credit) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, number>) => <span className="text-xs text-gray-600">{fmtMAD(p.value)}</span>,
        },
        {
            colId: 'pending_instruments_total', headerName: 'Chèques en attente', width: 150, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPartnerStatementRow>) => Number(p.data?.pending_instruments_total) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, number>) => <span className="text-xs text-gray-500">{p.value! > 0 ? fmtMAD(p.value) : '—'}</span>,
        },
        {
            colId: 'available_credit', headerName: 'Crédit disponible', width: 140, filter: 'agNumberColumnFilter',
            valueGetter: (p: ValueGetterParams<GcomPartnerStatementRow>) => Number(p.data?.available_credit) || 0,
            cellRenderer: (p: ICellRendererParams<GcomPartnerStatementRow, number>) => <span className="text-xs text-emerald-700 font-semibold">{fmtMAD(p.value)}</span>,
        },
        // eslint-disable-next-line react-hooks/exhaustive-deps
    ], []);

    const mainContent = (
        <div className={isExpanded ? 'fixed inset-0 z-50 bg-gray-50 flex flex-col' : 'h-full flex flex-col bg-gray-50'}>
            <div className="px-5 py-3 bg-white border-b border-gray-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-sage-50 rounded-lg">
                        <Scale className="w-5 h-5 text-sage-600" />
                    </div>
                    <div>
                        <h1 className="text-base font-semibold text-gray-900">Relevé de Compte Global</h1>
                        <p className="text-[11px] text-gray-500">
                            {loading ? 'Chargement…' : `${rows.length} client(s)`}
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 items-end">
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Agence</label>
                        <AsyncCombobox value={selectedBranch} onChange={setSelectedBranch} onSearch={searchBranches} placeholder="Toutes les agences…" />
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Canal</label>
                        <select
                            value={channelFilter}
                            onChange={e => setChannelFilter(e.target.value)}
                            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 bg-white transition-shadow"
                        >
                            <option value="">Tous</option>
                            {channels.map(c => <option key={c.id} value={c.code}>{c.name}</option>)}
                        </select>
                    </div>
                    <div className="space-y-1">
                        <label className="block text-[11px] font-medium text-gray-500 uppercase tracking-wide">Solde minimum (MAD)</label>
                        <input
                            type="number" step="0.01" value={minBalance} onChange={e => setMinBalance(e.target.value)}
                            placeholder="0.00"
                            className="w-full h-10 border border-gray-300 rounded-lg px-3 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500 transition-shadow"
                        />
                    </div>
                    <label className="flex items-center gap-2 h-10 text-xs text-gray-600 cursor-pointer">
                        <input type="checkbox" checked={includeZeroBalance} onChange={e => setIncludeZeroBalance(e.target.checked)} className="rounded border-gray-300 text-sage-600 focus:ring-sage-400" />
                        Inclure les clients sans activité GCOM
                    </label>
                </div>
            </div>

            <div className="flex-1 overflow-hidden p-1">
                <DataGrid rowData={rows} columnDefs={columnDefs} loading={loading} suppressAutoFit />
            </div>
        </div>
    );

    return <MasterLayout leftContent={null} mainContent={mainContent} />;
};

export default RelevesComptePage;
