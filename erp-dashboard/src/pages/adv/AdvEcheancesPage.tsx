import { useState } from 'react';
import { Calendar, AlertTriangle, RefreshCw, Loader2, Download } from 'lucide-react';
import { AgGridReact } from 'ag-grid-react';
import type { ColDef } from 'ag-grid-community';
import { ModuleRegistry, ClientSideRowModelModule, ValidationModule } from 'ag-grid-community';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { StatsCard } from '@/components/adv/StatsCard';
import { useAdvEcheances } from '@/hooks/adv/useAdvEcheances';

// Register AG Grid modules
ModuleRegistry.registerModules([ClientSideRowModelModule, ValidationModule]);

const AdvEcheancesContent = () => {
    const [searchTerm, setSearchTerm] = useState('');
    const { echeances, loading, error, refetch } = useAdvEcheances();

    // AG Grid column definitions
    const columnDefs: ColDef[] = [
        {
            headerName: 'N° BC',
            field: 'order_number',
            width: 140,
            pinned: 'left',
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                        {params.value}
                    </span>
                </div>
            ),
        },
        {
            headerName: 'Code Partenaire',
            field: 'partner_code',
            width: 140,
        },
        {
            headerName: 'Partenaire',
            field: 'partner_name',
            flex: 1,
            minWidth: 200,
        },
        {
            headerName: 'Conditions Paiement',
            field: 'payment_term',
            width: 150,
        },
        {
            headerName: 'Montant',
            field: 'total_amount',
            width: 130,
            valueFormatter: (params) => `${parseFloat(params.value || 0).toLocaleString()} Dh`,
            cellClass: 'font-bold',
        },
        {
            headerName: 'Date BC',
            field: 'created_at',
            width: 120,
            valueFormatter: (params) =>
                params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-',
        },
        {
            headerName: 'Date Échéance',
            field: 'due_date',
            width: 140,
            valueFormatter: (params) =>
                params.value ? new Date(params.value).toLocaleDateString('fr-FR') : '-',
            cellClass: 'font-medium',
        },
        {
            headerName: 'Jours de Retard',
            field: 'days_overdue',
            width: 140,
            cellRenderer: (params: any) => {
                const days = params.value || 0;
                const colorClass =
                    days > 60
                        ? 'bg-red-100 text-red-700 border-red-200'
                        : days > 30
                            ? 'bg-orange-100 text-orange-700 border-orange-200'
                            : 'bg-amber-100 text-amber-700 border-amber-200';

                return (
                    <div className="flex items-center justify-center h-full">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-bold border ${colorClass}`}>
                            <AlertTriangle className="w-3 h-3" />
                            {days} jour{days > 1 ? 's' : ''}
                        </span>
                    </div>
                );
            },
        },
        {
            headerName: 'Statut BC',
            field: 'bc_status',
            width: 120,
            cellRenderer: (params: any) => {
                const statusColors: Record<string, string> = {
                    confirmed: 'bg-blue-100 text-blue-700 border-blue-200',
                    delivered: 'bg-emerald-100 text-emerald-700 border-emerald-200',
                    cancelled: 'bg-gray-100 text-gray-700 border-gray-200',
                };
                const colorClass = statusColors[params.value] || 'bg-gray-100 text-gray-700 border-gray-200';
                return (
                    <div className="flex items-center justify-center h-full">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${colorClass}`}>
                            {params.value}
                        </span>
                    </div>
                );
            },
        },
    ];

    const echeancesList = echeances?.data || [];

    // Filter by search term
    const filteredEcheances = searchTerm
        ? echeancesList.filter(
            (e) =>
                e.partner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.partner_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                e.order_number.toLowerCase().includes(searchTerm.toLowerCase())
        )
        : echeancesList;

    // Calculate stats
    const totalOverdue = filteredEcheances.length;
    const criticalOverdue = filteredEcheances.filter((e) => e.days_overdue > 60).length;
    const totalAmount = filteredEcheances.reduce((sum, e) => sum + parseFloat(String(e.total_amount || 0)), 0);

    const handleExport = () => {
        // Simple CSV export
        const headers = ['N° BC', 'Partenaire', 'Code', 'Montant', 'Date Échéance', 'Jours Retard'];
        const rows = filteredEcheances.map((e) => [
            e.order_number,
            e.partner_name,
            e.partner_code,
            e.total_amount,
            new Date(e.due_date).toLocaleDateString('fr-FR'),
            e.days_overdue,
        ]);

        const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `echeances_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
    };

    return (
        <div className="h-full flex flex-col bg-slate-50 dark:bg-black/20">
            {/* Header */}
            <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 p-6">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                            Échéances & Retards
                        </h1>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            Suivi des factures en retard et gestion des échéances
                        </p>
                    </div>
                    <div className="flex gap-3">
                        <button
                            onClick={handleExport}
                            disabled={!filteredEcheances.length}
                            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <Download className="w-4 h-4" />
                            Exporter CSV
                        </button>
                        <button
                            onClick={() => refetch()}
                            disabled={loading}
                            className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg shadow-sm transition-colors text-sm font-medium flex items-center gap-2 disabled:opacity-50"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                            Rafraîchir
                        </button>
                    </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <StatsCard
                        label="Total en Retard"
                        value={totalOverdue}
                        icon={AlertTriangle}
                        color="amber"
                        change="Factures"
                    />
                    <StatsCard
                        label="Critique (> 60j)"
                        value={criticalOverdue}
                        icon={AlertTriangle}
                        color="red"
                        change="Urgent"
                    />
                    <StatsCard
                        label="Montant Total"
                        value={`${totalAmount.toLocaleString()} Dh`}
                        icon={Calendar}
                        color="blue"
                        change="En Retard"
                    />
                </div>

                {/* Search */}
                <div className="relative">
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rechercher par partenaire, code ou N° BC..."
                        className="w-full px-4 py-2.5 pl-10 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                        </svg>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex-1 p-6 overflow-hidden">
                {loading && !echeancesList.length ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <Loader2 className="w-8 h-8 animate-spin text-sage-500 mx-auto mb-3" />
                            <p className="text-gray-500">Chargement des échéances...</p>
                        </div>
                    </div>
                ) : error ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <p className="text-red-500 mb-4">{error}</p>
                            <button
                                onClick={() => refetch()}
                                className="px-4 py-2 bg-sage-600 hover:bg-sage-700 text-white rounded-lg"
                            >
                                Réessayer
                            </button>
                        </div>
                    </div>
                ) : filteredEcheances.length === 0 ? (
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center text-gray-400">
                            <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">Aucune échéance en retard</p>
                            <p className="text-sm mt-2">Tous les paiements sont à jour</p>
                        </div>
                    </div>
                ) : (
                    <div className="h-full bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden ag-theme-alpine dark:ag-theme-alpine-dark">
                        <AgGridReact
                            rowData={filteredEcheances}
                            columnDefs={columnDefs}
                            defaultColDef={{
                                sortable: true,
                                filter: true,
                                resizable: true,
                            }}
                            pagination={true}
                            paginationPageSize={20}
                            animateRows={true}
                            headerHeight={44}
                            rowHeight={44}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export const AdvEcheancesPage = () => {
    return (
        <MasterLayout
            leftContent={
                <div className="bg-white dark:bg-black h-full p-6 border-r border-gray-100 dark:border-gray-800 flex items-center justify-center text-gray-400 text-sm italic">
                    Filtres Date
                </div>
            }
            mainContent={
                <div className="h-full overflow-hidden">
                    <AdvEcheancesContent />
                </div>
            }
        />
    );
};
