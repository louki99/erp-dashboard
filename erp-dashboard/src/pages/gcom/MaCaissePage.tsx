import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ICellRendererParams } from 'ag-grid-community';
import {
    Wallet, RefreshCw, Banknote, FileCheck, Clock3, ArrowLeftRight,
    Lock, Loader2, CheckCircle2, AlertTriangle, Building2,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { gcomApi } from '@/services/api/gcomApi';
import type { GcomCaisse, GcomCaisseMethodSuffix } from '@/types/gcom.types';

// ─── helpers ─────────────────────────────────────────────────────────────────

const fmtMAD = (n: number | string | undefined | null) => {
    const v = typeof n === 'string' ? parseFloat(n) : n;
    return v == null || Number.isNaN(v) ? '—' : `${v.toLocaleString('fr-MA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD`;
};

// Same 4 methods a caisse is ever auto-provisioned for (card/credit settle to
// a bank account, never a physical drawer, so they never get one) — see
// gcomApi.ts's caisse namespace comment for the full routing explanation.
const METHOD_META: Record<GcomCaisseMethodSuffix, { label: string; icon: typeof Banknote; tone: string; iconTone: string }> = {
    ESP: { label: 'Espèces', icon: Banknote, tone: 'bg-emerald-50 border-emerald-100', iconTone: 'text-emerald-600 bg-emerald-100' },
    CHQ: { label: 'Chèques', icon: FileCheck, tone: 'bg-blue-50 border-blue-100', iconTone: 'text-blue-600 bg-blue-100' },
    EFF: { label: 'Effets', icon: Clock3, tone: 'bg-amber-50 border-amber-100', iconTone: 'text-amber-600 bg-amber-100' },
    VIR: { label: 'Virements', icon: ArrowLeftRight, tone: 'bg-indigo-50 border-indigo-100', iconTone: 'text-indigo-600 bg-indigo-100' },
};

const hasBalance = (c: GcomCaisse) => (Number(c.balance) || 0) > 0;
// 2026-08-21 — multi-session-per-day. A manual close 422s (TREASURY_NO_OPEN_SESSION)
// ONLY when the caisse was touched today, then closed, with nothing new since —
// i.e. session_number is set but there's no open session. A caisse never touched
// today (session_number null) is always safe to close (opens+closes an empty
// session for the record), same as before this feature shipped.
const closeWouldFail = (c: GcomCaisse) => !c.has_open_session && c.session_number != null;

// ─── Clôture modal — a financial mutation, one of the few places this
// codebase's "no modals" convention doesn't apply (matches the destructive-
// action exception used elsewhere in GCOM) ───────────────────────────────────

const CloseCaisseModal = ({ caisse, onClose, onDone }: { caisse: GcomCaisse; onClose: () => void; onDone: () => void }) => {
    const meta = METHOD_META[caisse.method_suffix];
    const [countedBalance, setCountedBalance] = useState(String(caisse.balance));
    const [notes, setNotes] = useState('');
    const [closing, setClosing] = useState(false);

    const parsed = parseFloat(countedBalance);
    const discrepancy = Number.isNaN(parsed) ? null : parsed - (Number(caisse.balance) || 0);

    const confirm = async () => {
        if (countedBalance.trim() === '' || Number.isNaN(parsed)) { toast.error('Montant compté invalide'); return; }
        setClosing(true);
        try {
            const res = await gcomApi.caisse.close({ method_suffix: caisse.method_suffix, counted_balance: parsed, notes: notes.trim() || undefined });
            toast.success(`Caisse ${meta.label} clôturée — ${fmtMAD(res.closure.theoretical_closing_balance)} versés au coffre ${res.coffre_code}`);
            onDone();
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la clôture');
        } finally {
            setClosing(false);
        }
    };

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                <div className="flex items-center gap-3 mb-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${meta.iconTone}`}>
                        <Lock className="w-4 h-4" />
                    </div>
                    <div>
                        <h3 className="text-base font-semibold text-gray-900">Clôturer — {meta.label}</h3>
                        <p className="text-[11px] text-gray-400 font-mono">{caisse.code}</p>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-4">
                    Solde théorique <strong>{fmtMAD(caisse.balance)}</strong> — validé immédiatement et versé au coffre de l'agence, sans étape de confirmation séparée.
                </p>
                <div className="mb-3">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Montant compté</label>
                    <input
                        type="number" step="0.01"
                        value={countedBalance}
                        onChange={e => setCountedBalance(e.target.value)}
                        autoFocus
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                    {discrepancy !== null && Math.abs(discrepancy) > 0.005 && (
                        <p className={`text-[11px] mt-1 flex items-center gap-1 ${discrepancy > 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                            <AlertTriangle className="w-3 h-3" />
                            Écart {discrepancy > 0 ? '+' : ''}{fmtMAD(discrepancy)} par rapport au théorique
                        </p>
                    )}
                </div>
                <div className="mb-5">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Notes (optionnel)</label>
                    <textarea
                        value={notes}
                        onChange={e => setNotes(e.target.value)}
                        rows={2}
                        className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400 resize-none"
                    />
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={confirm}
                        disabled={closing}
                        className="flex-1 flex items-center justify-center gap-2 py-2 bg-sage-600 text-white text-sm font-medium rounded-lg hover:bg-sage-700 disabled:opacity-50 transition-colors"
                    >
                        {closing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        Clôturer
                    </button>
                    <button onClick={onClose} disabled={closing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                        Annuler
                    </button>
                </div>
            </div>
        </div>
    );
};

// ─── Detail panel — inline in the center pane, no modal for read-only detail ─

const CaisseDetailPanel = ({ caisse, onClose }: { caisse: GcomCaisse; onClose: () => void }) => {
    const meta = METHOD_META[caisse.method_suffix];
    const Icon = meta.icon;

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="px-6 pt-5 pb-4 bg-white border-b border-gray-200 shrink-0">
                <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{caisse.code}</span>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${caisse.is_active ? 'text-emerald-700' : 'text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${caisse.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {caisse.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {caisse.session_number != null && (
                        <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">Session n°{caisse.session_number}</span>
                    )}
                </div>
                <div className="flex items-center gap-2.5">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center ${meta.iconTone}`}>
                        <Icon className="w-4 h-4" />
                    </div>
                    <h2 className="text-lg font-bold text-gray-900">{meta.label}</h2>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                <div className="bg-white rounded-lg border border-gray-100 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Solde</p>
                    <p className={`text-2xl font-bold ${hasBalance(caisse) ? 'text-gray-900' : 'text-gray-400'}`}>{fmtMAD(caisse.balance)}</p>
                    <p className="text-[11px] text-gray-500 mt-1">Solde théorique — mis à jour à chaque encaissement {meta.label.toLowerCase()} sur les ventes et règlements GCOM.</p>
                </div>

                <div className="bg-white rounded-lg border border-gray-100 p-4">
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Fonctionnement</p>
                    <p className="text-sm text-gray-600 leading-relaxed">
                        Chaque vente ou règlement GCOM encaissé en {meta.label.toLowerCase()} crédite directement cette caisse.
                        En fin de journée, clôturez-la si elle a eu de l'activité — le solde théorique est
                        versé automatiquement au coffre de l'agence, sans étape de confirmation séparée.
                    </p>
                    {!caisse.is_active && (
                        <p className="text-[11px] text-gray-500 mt-2">Caisse inactive — aucune clôture possible pour le moment.</p>
                    )}
                    {caisse.is_active && closeWouldFail(caisse) && (
                        <p className="text-[11px] text-emerald-700 mt-2 flex items-center gap-1.5">
                            <CheckCircle2 className="w-3 h-3" /> Session n°{caisse.session_number} clôturée — une nouvelle session s'ouvrira automatiquement dès le prochain encaissement, aucune action requise.
                        </p>
                    )}
                </div>

                <button onClick={onClose} className="text-xs font-medium text-gray-400 hover:text-gray-600">← Retour à la liste</button>
            </div>
        </div>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────

export const MaCaissePage = () => {
    const navigate = useNavigate();
    const [caisses, setCaisses] = useState<GcomCaisse[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<GcomCaisse | null>(null);
    const [closeTarget, setCloseTarget] = useState<GcomCaisse | null>(null);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const data = await gcomApi.caisse.list();
            setCaisses(data);
            setSelected(prev => (prev ? data.find(c => c.id === prev.id) ?? prev : prev));
        } catch {
            toast.error('Erreur lors du chargement de vos caisses');
            setCaisses([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { load(); }, [load]);

    const totalBalance = caisses.reduce((sum, c) => sum + (Number(c.balance) || 0), 0);

    const columnDefs = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'method_suffix', headerName: 'Type', flex: 1, minWidth: 130,
            cellRenderer: (p: ICellRendererParams<GcomCaisse, GcomCaisseMethodSuffix>) => {
                if (!p.data) return null;
                const meta = METHOD_META[p.data.method_suffix];
                const Icon = meta.icon;
                return (
                    <div className="flex items-center gap-2">
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${meta.iconTone}`}>
                            <Icon className="w-3 h-3" />
                        </div>
                        <span className="text-xs font-semibold text-gray-800">{meta.label}</span>
                    </div>
                );
            },
        },
        {
            field: 'code', headerName: 'Code', width: 110,
            cellRenderer: (p: ICellRendererParams<GcomCaisse, string>) => (
                <span className="text-[11px] text-gray-500 font-mono">{p.value}</span>
            ),
        },
        {
            colId: 'balance', headerName: 'Solde', width: 110, filter: 'agNumberColumnFilter',
            valueGetter: p => p.data ? Number(p.data.balance) || 0 : 0,
            cellRenderer: (p: ICellRendererParams<GcomCaisse, number>) => (
                <span className={`text-xs font-bold ${p.value! > 0 ? 'text-gray-900' : 'text-gray-400'}`}>{fmtMAD(p.value)}</span>
            ),
        },
        {
            colId: 'status', headerName: 'Statut', width: 110,
            cellRenderer: (p: ICellRendererParams<GcomCaisse>) => {
                if (!p.data) return null;
                if (!p.data.is_active) return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-gray-500"><span className="w-1.5 h-1.5 rounded-full bg-gray-400" />Inactive</span>;
                if (closeWouldFail(p.data)) return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-blue-700"><Lock className="w-3 h-3" />Clôturée</span>;
                return <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-emerald-700"><span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />Active</span>;
            },
        },
    ], []);

    const leftContent = (
        <div className="h-full bg-white border-r border-gray-200 flex flex-col">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-1">
                <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-sage-600" />
                    <h2 className="text-sm font-bold text-gray-900">Ma Caisse</h2>
                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">{caisses.length}</span>
                    <button onClick={load} disabled={loading} className="ml-auto p-1 text-gray-400 hover:text-sage-600 disabled:opacity-50" title="Rafraîchir">
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
                <p className="text-[11px] text-gray-500">{loading ? 'Chargement…' : `${fmtMAD(totalBalance)} au total`}</p>
            </div>

            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={caisses}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowSelection="single"
                    onRowClicked={e => { if (e.data) setSelected(e.data); }}
                    defaultSelectedIds={row => row.id === selected?.id}
                />
            </div>
        </div>
    );

    const mainContent = !selected ? (
        <div className="h-full flex flex-col items-center justify-center text-center p-8 text-gray-400">
            <Wallet className="w-12 h-12 mb-3 text-gray-200" />
            <p className="text-sm font-medium text-gray-600 mb-1">Ma Caisse</p>
            <p className="text-xs max-w-xs">
                Sélectionnez une caisse dans la liste pour consulter son solde et la clôturer.
                Chaque vente ou règlement GCOM crédite directement l'une de vos caisses selon le mode de paiement.
            </p>
        </div>
    ) : (
        <CaisseDetailPanel caisse={selected} onClose={() => setSelected(null)} />
    );

    const actionGroups = useMemo(() => {
        const groups: { items: ActionItemProps[] }[] = [];
        if (selected) {
            groups.push({
                items: [
                    {
                        icon: Lock,
                        label: closeWouldFail(selected) ? 'Aucune session ouverte' : hasBalance(selected) ? 'Clôturer' : 'Clôturer (solde à 0)',
                        variant: 'warning',
                        disabled: !selected.is_active || closeWouldFail(selected),
                        onClick: () => setCloseTarget(selected),
                    },
                    {
                        icon: Building2,
                        label: 'Journaux & comptes',
                        onClick: () => navigate('/finance/journals'),
                    },
                ],
            });
        }
        return groups;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selected]);

    return (
        <>
            <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={<ActionPanel groups={actionGroups} />} />
            {closeTarget && (
                <CloseCaisseModal
                    caisse={closeTarget}
                    onClose={() => setCloseTarget(null)}
                    onDone={load}
                />
            )}
        </>
    );
};

export default MaCaissePage;
