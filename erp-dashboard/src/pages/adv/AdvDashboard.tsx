import {
    Users,
    FileCheck,
    AlertTriangle,
    TrendingUp,
    CheckCircle2,
    Ban,
    Loader2 // Added for loading state
} from 'lucide-react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { useAdvDashboard } from '@/hooks/adv/useAdvDashboard';
import { TaskWidget } from '@/components/tasks';

const AdvDashboardContent = () => {
    const { data, loading, error, refetch } = useAdvDashboard();

    if (loading) {
        return (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                <Loader2 className="w-8 h-8 animate-spin mb-2 text-sage-500" />
                <p>Loading dashboard...</p>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">{error || "No data available"}</p>
                <button
                    onClick={refetch}
                    className="px-4 py-2 bg-sage-500 text-white rounded hover:bg-sage-600 transition-colors"
                >
                    Retry
                </button>
            </div>
        );
    }

    const { stats, creditAlerts } = data;

    // Derived Stats for UI
    const KPI_CARDS = [
        {
            label: 'Commandes à Valider',
            value: stats.pending_bc.toString(),
            change: 'Active',
            icon: FileCheck,
            color: 'text-amber-600',
            bg: 'bg-amber-100',
            trend: 'down' // Placeholder logic
        },
        {
            label: 'Partenaires Bloqués',
            value: stats.blocked_partners.toString(),
            change: 'Action req.',
            icon: Ban,
            color: 'text-red-600',
            bg: 'bg-red-100',
            trend: 'down'
        },
        {
            label: 'Encours Global',
            value: `${Number(stats.total_credit_exposure).toLocaleString()} Dh`,
            change: 'Total Exposure',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-100',
            trend: 'up'
        },
        {
            label: 'Validation Tiers',
            value: stats.pending_partners.toString(),
            change: 'New',
            icon: Users,
            color: 'text-blue-600',
            bg: 'bg-blue-100',
            trend: 'neutral'
        },
    ];

    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Tableau de bord ADV</h1>
                    <p className="text-gray-500 mt-1">Supervision de l'administration des ventes et du risque client.</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={refetch}
                        className="px-4 py-2 bg-sage-600 text-white rounded-lg shadow-sm hover:bg-sage-700 transition-colors text-sm font-medium"
                    >
                        Rafraîchir
                    </button>
                </div>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {KPI_CARDS.map((stat, idx) => {
                    const Icon = stat.icon;
                    return (
                        <div key={idx} className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-4">
                                <div className={`p-3 rounded-lg ${stat.bg}`}>
                                    <Icon className={`w-6 h-6 ${stat.color}`} />
                                </div>
                                {/* Trend Indicator Placeholder */}
                                <span className="text-xs font-medium px-2 py-1 rounded-full text-gray-600 bg-gray-100">
                                    {stat.change}
                                </span>
                            </div>
                            <div className="space-y-1">
                                <h3 className="text-3xl font-bold text-gray-900">{stat.value}</h3>
                                <p className="text-sm text-gray-500 font-medium">{stat.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main Action Area */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Task Workflow Widget */}
                    <TaskWidget
                        workflowType="bc"
                        title="Tâches de validation BC"
                        maxTasks={5}
                        showViewAll={true}
                    />

                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="font-semibold text-gray-900">Validations en attente</h3>
                            <button className="text-sm text-sage-600 hover:text-sage-700 font-medium">Voir tout</button>
                        </div>
                        {/* Placeholder for Pending Validations List (Since it wasn't in the provided JSON, keeping static or empty for now) */}
                        <div className="p-8 text-center text-gray-400">
                            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-gray-200" />
                            <p>Aucune commande à valider pour le moment.</p>
                        </div>
                    </div>
                </div>

                {/* Side Alerts */}
                <div className="space-y-6">
                    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                        <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <AlertTriangle className="w-5 h-5 text-amber-500" />
                            Alerte Crédit PARTENAIRES
                        </h3>
                        <div className="space-y-4">
                            {creditAlerts.length > 0 ? creditAlerts.map((alert) => (
                                <div key={alert.id} className="flex gap-3 items-start border-l-2 border-amber-400 pl-3">
                                    <div>
                                        <p className="text-sm text-gray-800 font-bold leading-tight">{alert.name}</p>
                                        <p className="text-xs text-gray-500 mt-1">Utilisé: {Number(alert.credit_used).toLocaleString()} / {Number(alert.credit_limit).toLocaleString()}</p>
                                        <p className="text-[10px] text-gray-400 mt-0.5">{new Date(alert.created_at).toLocaleDateString()}</p>
                                    </div>
                                </div>
                            )) : (
                                <p className="text-sm text-gray-400 italic">Aucune alerte crédit.</p>
                            )}
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-xl shadow-lg p-6 text-white relative overflow-hidden">
                        <div className="relative z-10">
                            <h3 className="font-bold text-lg mb-2">Credit Management</h3>
                            <p className="text-indigo-200 text-sm mb-4">Review credit limits and blocked partners.</p>
                            <button className="w-full py-2 bg-white/10 hover:bg-white/20 border border-white/20 rounded-lg text-sm font-medium transition-colors backdrop-blur-sm">
                                Open Credit Console
                            </button>
                        </div>
                        {/* Decorative background circle */}
                        <div className="absolute -bottom-12 -right-12 w-32 h-32 bg-indigo-500/30 rounded-full blur-2xl"></div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export const AdvDashboard = () => {
    return (
        <MasterLayout
            leftContent={<div className="bg-white h-full p-6 border-r border-gray-100 flex items-center justify-center text-gray-400 text-sm italic">ADV Quick Actions</div>}
            mainContent={<div className="h-full overflow-y-auto bg-slate-50"><AdvDashboardContent /></div>}
        />
    );
};
