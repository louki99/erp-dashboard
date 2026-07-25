import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { RefreshCw, Radio, TrendingUp, PhoneCall, Trophy } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { useMonitoringSessions, useMonitoringKpis } from '@/hooks/telesales';
import { TELE_VISIT_OUTCOME_LABELS, type TeleVisitOutcome } from '@/types/telesales.types';

const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

const todayIso = () => new Date().toISOString().slice(0, 10);
const weekStartIso = () => {
    const d = new Date();
    const day = d.getDay() || 7;
    d.setDate(d.getDate() - day + 1);
    return d.toISOString().slice(0, 10);
};

export const TelesalesMonitoringPage = () => {
    const { data: sessionsData, loading: sessionsLoading, refetch: refetchSessions } = useMonitoringSessions(15000);
    const [dateFrom, setDateFrom] = useState(weekStartIso());
    const [dateTo, setDateTo] = useState(todayIso());
    const { data: kpis, loading: kpisLoading, refetch: refetchKpis } = useMonitoringKpis({ date_from: dateFrom, date_to: dateTo });

    // Live-recompute elapsed_seconds client-side between polls (server value is a snapshot).
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const i = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(i);
    }, []);

    const sessions = useMemo(() => {
        return (sessionsData?.sessions ?? []).map((s) => {
            if (s.status !== 'active') return s;
            const startedMs = new Date(s.started_at).getTime();
            const elapsed = Math.max(0, Math.floor((now - startedMs) / 1000) - s.total_paused_seconds);
            return { ...s, elapsed_seconds: elapsed };
        });
    }, [sessionsData, now]);

    const sessionColumnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'user.name', headerName: 'Agent', flex: 1, minWidth: 160, valueGetter: (p: any) => p.data?.user?.name },
            {
                field: 'status', headerName: 'Statut', width: 110,
                cellRenderer: (p: any) => (
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${p.value === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                        {p.value === 'active' ? 'Active' : 'En pause'}
                    </span>
                ),
            },
            {
                field: 'elapsed_seconds', headerName: 'Chrono', width: 110,
                valueFormatter: (p: any) => formatElapsed(p.value ?? 0),
            },
            {
                field: 'started_at', headerName: 'Connecté depuis', width: 170,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-',
            },
        ],
        []
    );

    const salesColumnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'user_name', headerName: 'Agent', flex: 1, minWidth: 160 },
            { field: 'orders_count', headerName: 'Commandes', width: 110 },
            {
                field: 'total_sales', headerName: 'CA', width: 140,
                valueFormatter: (p: any) => `${Number(p.value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD`,
            },
        ],
        []
    );

    const outcomeEntries = kpis ? (Object.entries(kpis.outcomes) as [TeleVisitOutcome, number][]) : [];
    const maxOutcome = Math.max(1, ...outcomeEntries.map(([, v]) => v));

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50 overflow-y-auto">
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Monitoring / Suivi live</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Sessions en direct et KPIs d'équipe</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50" />
                        <span className="text-gray-400 text-sm">→</span>
                        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50" />
                    </div>
                </div>
            </div>

            <div className="p-6 space-y-6">
                {/* Live sessions */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-2 px-5 py-4 border-b border-gray-100">
                        <Radio className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Agents en ligne ({sessions.length})</h3>
                    </div>
                    <div style={{ height: 260 }}>
                        <DataGrid rowData={sessions} columnDefs={sessionColumnDefs} loading={sessionsLoading} />
                    </div>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100/50 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-blue-600 uppercase tracking-wider mb-2">
                            <PhoneCall className="w-4 h-4" /> Appels qualifiés
                        </div>
                        <div className="text-4xl font-black text-blue-700 tracking-tight">{kpis?.total_qualified_calls ?? '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-5 border border-emerald-100/50 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-emerald-600 uppercase tracking-wider mb-2">
                            <TrendingUp className="w-4 h-4" /> Taux de conversion
                        </div>
                        <div className="text-4xl font-black text-emerald-700 tracking-tight">{kpis ? `${kpis.conversion_rate_percent}%` : '-'}</div>
                    </div>
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-5 border border-amber-100/50 shadow-sm">
                        <div className="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase tracking-wider mb-2">
                            <Trophy className="w-4 h-4" /> Meilleur agent
                        </div>
                        <div className="text-lg font-black text-amber-700 tracking-tight">
                            {kpis?.sales_by_agent?.[0]?.user_name ?? '-'}
                        </div>
                        {kpis?.sales_by_agent?.[0] && (
                            <div className="text-xs text-amber-600 mt-1">{kpis.sales_by_agent[0].total_sales.toLocaleString('fr-FR')} MAD</div>
                        )}
                    </div>
                </div>

                {/* Outcomes breakdown */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                    <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide mb-4">Répartition des résultats d'appel</h3>
                    <div className="space-y-3">
                        {outcomeEntries.map(([outcome, count]) => (
                            <div key={outcome} className="flex items-center gap-3">
                                <div className="w-40 text-sm text-gray-600 shrink-0">{TELE_VISIT_OUTCOME_LABELS[outcome]}</div>
                                <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-sage-500 rounded-full" style={{ width: `${(count / maxOutcome) * 100}%` }} />
                                </div>
                                <div className="w-10 text-right text-sm font-bold text-gray-700">{count}</div>
                            </div>
                        ))}
                        {outcomeEntries.length === 0 && !kpisLoading && (
                            <p className="text-sm text-gray-400">Aucun appel qualifié sur la période</p>
                        )}
                    </div>
                </div>

                {/* Sales by agent */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-gray-100">
                        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">Classement par CA</h3>
                    </div>
                    <div style={{ height: 220 }}>
                        <DataGrid rowData={kpis?.sales_by_agent ?? []} columnDefs={salesColumnDefs} loading={kpisLoading} />
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <MasterLayout
            mainContent={mainContent}
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                { icon: RefreshCw, label: 'Rafraîchir', variant: 'sage', onClick: () => { refetchSessions(); refetchKpis(); } },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};

export default TelesalesMonitoringPage;
