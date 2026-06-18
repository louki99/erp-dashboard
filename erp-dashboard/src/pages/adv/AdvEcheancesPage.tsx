import { useState } from 'react';
import { Calendar, AlertTriangle, RefreshCw, Loader2, Download, TrendingDown, Clock } from 'lucide-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { AgGridReact } from 'ag-grid-react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { useAdvEcheances } from '@/hooks/adv/useAdvEcheances';
import type { Invoice } from '@/types/adv.types';
import { cn } from '@/lib/utils';

ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

// ─── KPI stat card ────────────────────────────────────────────────────────────

const StatCard = ({
    label,
    value,
    icon: Icon,
    color,
}: {
    label: string;
    value: string | number;
    icon: React.ElementType;
    color: 'amber' | 'red' | 'blue';
}) => {
    const colors = {
        amber: { bg: 'bg-amber-50', icon: 'text-amber-500', border: 'border-amber-200', text: 'text-amber-700' },
        red: { bg: 'bg-red-50', icon: 'text-red-500', border: 'border-red-200', text: 'text-red-700' },
        blue: { bg: 'bg-blue-50', icon: 'text-blue-500', border: 'border-blue-200', text: 'text-blue-700' },
    }[color];

    return (
        <div className={cn('rounded-xl border p-4 flex items-center gap-4', colors.bg, colors.border)}>
            <div className={cn('p-2.5 rounded-xl bg-white/80')}>
                <Icon className={cn('w-5 h-5', colors.icon)} />
            </div>
            <div>
                <p className={cn('text-2xl font-black', colors.text)}>{value}</p>
                <p className="text-xs text-gray-600 font-medium mt-0.5">{label}</p>
            </div>
        </div>
    );
};

// ─── Status badge helper ───────────────────────────────────────────────────────

const statusLabel: Record<string, { text: string; cls: string }> = {
    overdue: { text: 'En Retard', cls: 'bg-red-100 text-red-700 border-red-200' },
    partially_paid: { text: 'Part. Payé', cls: 'bg-amber-100 text-amber-700 border-amber-200' },
    pending: { text: 'En Attente', cls: 'bg-blue-100 text-blue-700 border-blue-200' },
};

// ─── AG-Grid column definitions ───────────────────────────────────────────────

const buildColumns = (): ColDef<Invoice>[] => [
    {
        headerName: 'N° Facture',
        field: 'invoice_number',
        width: 160,
        pinned: 'left',
        cellRenderer: (p: any) => (
            <div className="flex items-center h-full">
                <span className="font-mono font-bold text-blue-600 text-xs">{p.value}</span>
            </div>
        ),
    },
    {
        headerName: 'Partenaire',
        width: 200,
        valueGetter: (p) => p.data?.partner?.name ?? '—',
        cellClass: 'font-medium text-sm',
    },
    {
        headerName: 'Code',
        width: 120,
        valueGetter: (p) => p.data?.partner?.code ?? '—',
        cellClass: 'font-mono text-xs text-gray-500',
    },
    {
        headerName: 'N° BC',
        width: 150,
        valueGetter: (p) => p.data?.order?.order_code ?? '—',
        cellClass: 'font-mono text-xs',
    },
    {
        headerName: 'Montant',
        field: 'amount',
        width: 140,
        cellRenderer: (p: any) => (
            <div className="flex items-center justify-end h-full">
                <span className="font-bold text-sm text-gray-900">{Number(p.value || 0).toLocaleString('fr-FR')} Dh</span>
            </div>
        ),
    },
    {
        headerName: 'Restant',
        field: 'remaining_amount',
        width: 140,
        cellRenderer: (p: any) => (
            <div className="flex items-center justify-end h-full">
                <span className="font-bold text-sm text-amber-600">{Number(p.value || 0).toLocaleString('fr-FR')} Dh</span>
            </div>
        ),
    },
    {
        headerName: 'Date Échéance',
        field: 'due_date',
        width: 140,
        cellRenderer: (p: any) => (
            <div className="flex items-center h-full gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <span className="text-sm">{p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—'}</span>
            </div>
        ),
    },
    {
        headerName: 'Statut',
        field: 'status',
        width: 130,
        cellRenderer: (p: any) => {
            const cfg = statusLabel[p.value] ?? { text: p.value, cls: 'bg-gray-100 text-gray-600 border-gray-200' };
            return (
                <div className="flex items-center h-full">
                    <span className={cn('px-2 py-0.5 rounded text-xs font-semibold border', cfg.cls)}>{cfg.text}</span>
                </div>
            );
        },
    },
];

// ─── Main content ─────────────────────────────────────────────────────────────

const AdvEcheancesContent = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const [overdueOnly, setOverdueOnly] = useState(false);
    const { invoices, stats, loading, error, refetch } = useAdvEcheances({ overdue_only: overdueOnly || undefined });

    const filtered = searchTerm
        ? invoices.filter((e) => {
              const s = searchTerm.toLowerCase();
              return (
                  e.partner?.name?.toLowerCase().includes(s) ||
                  e.partner?.code?.toLowerCase().includes(s) ||
                  e.invoice_number?.toLowerCase().includes(s) ||
                  e.order?.order_code?.toLowerCase().includes(s)
              );
          })
        : invoices;

    const handleExport = () => {
        const headers = ['N° Facture', 'Partenaire', 'Code', 'N° BC', 'Montant', 'Restant', 'Date Échéance', 'Statut'];
        const rows = filtered.map((e) => [
            e.invoice_number,
            e.partner?.name ?? '',
            e.partner?.code ?? '',
            e.order?.order_code ?? '',
            e.amount,
            e.remaining_amount,
            e.due_date ? new Date(e.due_date).toLocaleDateString('fr-FR') : '',
            e.status,
        ]);
        const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
        const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `echeances_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    const columnDefs = buildColumns();

    return (
        <div className="h-full flex flex-col bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex justify-between items-start mb-5">
                    <div>
                        <h1 className="text-xl font-bold text-gray-900 tracking-tight">Échéances & Retards</h1>
                        <p className="text-gray-500 text-sm mt-0.5">Suivi des factures en retard et gestion des créances</p>
                    </div>
                    <div className="flex gap-2.5">
                        <button
                            onClick={handleExport}
                            disabled={!filtered.length}
                            className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                        >
                            <Download className="w-4 h-4" />
                            CSV
                        </button>
                        <button
                            onClick={refetch}
                            disabled={loading}
                            className="px-3.5 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-sm font-medium flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                        >
                            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
                            Actualiser
                        </button>
                    </div>
                </div>

                {/* KPI row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-5">
                    <StatCard
                        label="Factures en retard"
                        value={stats.overdue_count}
                        icon={AlertTriangle}
                        color="red"
                    />
                    <StatCard
                        label="Dû cette semaine"
                        value={`${Number(stats.total_due_this_week).toLocaleString('fr-FR')} Dh`}
                        icon={Clock}
                        color="amber"
                    />
                    <StatCard
                        label="Total en souffrance"
                        value={`${Number(stats.total_overdue).toLocaleString('fr-FR')} Dh`}
                        icon={TrendingDown}
                        color="blue"
                    />
                </div>

                {/* Filters */}
                <div className="flex gap-3 items-center">
                    <div className="relative flex-1 max-w-sm">
                        <input
                            type="text"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            placeholder="Rechercher partenaire, code, N° facture..."
                            className="w-full px-4 py-2 pl-9 rounded-lg border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                    </div>
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={overdueOnly}
                            onChange={(e) => setOverdueOnly(e.target.checked)}
                            className="rounded border-gray-300 text-red-600 focus:ring-red-500"
                        />
                        <span className="text-sm text-gray-700 font-medium">Retards uniquement</span>
                    </label>
                </div>
            </div>

            {/* Grid */}
            <div className="flex-1 p-6 overflow-hidden">
                {loading && !invoices.length ? (
                    <div className="h-full flex items-center justify-center">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-500 mr-3" />
                        <p className="text-gray-500 text-sm">Chargement des échéances...</p>
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-red-500 mb-4 text-sm">{error}</p>
                            <button onClick={refetch} className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg text-sm font-medium">
                                Réessayer
                            </button>
                        </div>
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-400">
                            <Calendar className="w-14 h-14 mx-auto mb-4 text-gray-200" />
                            <p className="text-base font-medium text-gray-600">Aucune échéance trouvée</p>
                            <p className="text-sm mt-1 text-gray-400">
                                {searchTerm ? 'Modifiez votre recherche' : 'Tous les paiements sont à jour'}
                            </p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden ag-theme-quartz">
                        <AgGridReact
                            rowData={filtered}
                            columnDefs={columnDefs}
                            defaultColDef={{ sortable: true, filter: true, resizable: true }}
                            pagination={true}
                            paginationPageSize={20}
                            animateRows={true}
                            headerHeight={44}
                            rowHeight={48}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export const AdvEcheancesPage = () => (
    <MasterLayout
        leftContent={
            <div className="bg-white h-full p-5 border-r border-gray-100 space-y-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Filtres</p>
                <p className="text-xs text-gray-400 italic">Sélectionnez une période pour filtrer</p>
            </div>
        }
        mainContent={
            <div className="h-full overflow-hidden">
                <AdvEcheancesContent />
            </div>
        }
    />
);
