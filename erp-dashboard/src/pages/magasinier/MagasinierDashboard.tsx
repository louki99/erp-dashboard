import { useCallback, useEffect, useState } from 'react';
import { Package, Clock, CheckCircle2, AlertTriangle, TrendingUp, FileText, RefreshCw, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { BonPreparationStatus, DashboardStats } from '@/types/magasinier.types';
import { TaskWidget } from '@/components/tasks';

const PENDING_BP_STATUS_LABEL: Partial<Record<BonPreparationStatus, string>> = {
    pending: 'En attente',
    in_progress: 'En cours',
    partial_rework_requested: 'Rework demandé',
};

export const MagasinierDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchStats = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const data = await magasinierApi.dashboard.get();
            setStats(data);
        } catch (err) {
            console.error('Failed to fetch dashboard stats:', err);
            setError(err instanceof Error ? err.message : 'Échec du chargement du tableau de bord');
            toast.error('Échec du chargement du tableau de bord');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchStats(); }, [fetchStats]);

    const statCards = [
        {
            title: 'Préparations en attente',
            value: stats?.pendingPreparations || 0,
            icon: Clock,
            gradient: 'from-amber-400 to-orange-500',
            iconColor: 'text-orange-100',
            bgGlow: 'group-hover:shadow-orange-500/20',
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'En cours',
            value: stats?.inProgress || 0,
            icon: Package,
            gradient: 'from-blue-500 to-indigo-600',
            iconColor: 'text-indigo-100',
            bgGlow: 'group-hover:shadow-indigo-500/20',
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'Terminées aujourd\'hui',
            value: stats?.completedToday || 0,
            icon: CheckCircle2,
            gradient: 'from-emerald-400 to-teal-500',
            iconColor: 'text-teal-100',
            bgGlow: 'group-hover:shadow-teal-500/20',
        },
        {
            title: 'Articles en rupture',
            value: stats?.lowStockItems || 0,
            icon: AlertTriangle,
            gradient: 'from-rose-400 to-red-500',
            iconColor: 'text-red-100',
            bgGlow: 'group-hover:shadow-red-500/20',
            onClick: () => navigate('/magasinier/stock'),
        },
    ];

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8 flex items-start justify-between">
                <div>
                    <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-gray-900 to-gray-600 tracking-tight">
                        Tableau de bord Magasinier
                    </h1>
                    <p className="text-gray-500 mt-2 font-medium">Vue d'ensemble dynamique des préparations et du stock</p>
                </div>
                <button
                    onClick={fetchStats}
                    className="flex items-center gap-2 px-3.5 py-2 text-sm font-semibold rounded-xl border border-gray-200 bg-white text-gray-600 hover:bg-gray-50 shadow-sm transition-colors"
                >
                    <RefreshCw className="w-4 h-4" /> Rafraîchir
                </button>
            </div>

            {error && (
                <div className="mb-6 flex items-center gap-2 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
                    <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 mb-8">
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={index}
                            onClick={card.onClick}
                            className={`group relative overflow-hidden rounded-2xl bg-white p-6 border border-gray-100 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${card.bgGlow} ${card.onClick ? 'cursor-pointer' : ''}`}
                        >
                            <div className={`absolute top-0 right-0 w-32 h-32 bg-gradient-to-br ${card.gradient} opacity-10 rounded-bl-full -mr-8 -mt-8 transition-transform duration-500 group-hover:scale-110`}></div>
                            <div className="relative flex items-center justify-between mb-4">
                                <div className={`p-3.5 rounded-xl bg-gradient-to-br ${card.gradient} shadow-sm group-hover:shadow-md transition-shadow`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className="relative">
                                <div className="text-4xl font-black text-gray-900 mb-1 tracking-tight">
                                    {card.value}
                                </div>
                                <div className="text-sm font-semibold text-gray-500 uppercase tracking-wider">{card.title}</div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Task Workflow Widget */}
            <div className="mb-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-1">
                    <TaskWidget
                        workflowType="bp"
                        title="Mes tâches de préparation"
                        maxTasks={5}
                        showViewAll={true}
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-amber-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 transition-opacity group-hover:opacity-100"></div>
                    <div className="relative flex items-center gap-3 mb-6">
                        <div className="p-2 bg-amber-100 rounded-lg">
                            <FileText className="w-5 h-5 text-amber-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Préparations en attente</h2>
                    </div>
                    {stats?.pendingBps && stats.pendingBps.length > 0 ? (
                        <div className="space-y-3 relative">
                            {stats.pendingBps.map((bp) => (
                                <div
                                    key={bp.id}
                                    onClick={() => navigate('/magasinier/preparations')}
                                    className="flex items-center justify-between p-4 bg-white border border-gray-100 rounded-xl hover:border-amber-200 hover:shadow-md cursor-pointer transition-all duration-200 group/item"
                                >
                                    <div className="flex items-center gap-4 min-w-0">
                                        <div className="w-2.5 h-2.5 rounded-full bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.5)] shrink-0"></div>
                                        <div className="min-w-0">
                                            <span className="font-bold text-gray-800 group-hover/item:text-amber-700 transition-colors block truncate">{bp.bp_number}</span>
                                            {bp.delivery_mission?.mission_number && (
                                                <span className="text-xs text-gray-400 truncate">{bp.delivery_mission.mission_number}</span>
                                            )}
                                        </div>
                                    </div>
                                    <span className="text-xs font-semibold text-amber-700 px-3 py-1 bg-amber-50 border border-amber-100 rounded-full shrink-0">
                                        {PENDING_BP_STATUS_LABEL[bp.status] ?? bp.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center relative">
                            <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-3">
                                <CheckCircle2 className="w-8 h-8 text-gray-300" />
                            </div>
                            <p className="text-gray-500 font-medium">Aucune préparation en attente</p>
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 overflow-hidden relative group">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 transition-opacity group-hover:opacity-100"></div>
                    <div className="relative flex items-center gap-3 mb-6">
                        <div className="p-2 bg-blue-100 rounded-lg">
                            <Package className="w-5 h-5 text-sage-600" />
                        </div>
                        <h2 className="text-xl font-bold text-gray-900 tracking-tight">Actions rapides</h2>
                    </div>
                    <div className="space-y-4 relative">
                        <button
                            onClick={() => navigate('/magasinier/preparations')}
                            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-blue-50 to-indigo-50 border border-blue-100/50 hover:border-blue-300 rounded-xl hover:shadow-md transition-all duration-200 text-left group/btn"
                        >
                            <div className="p-3 bg-white rounded-lg shadow-sm group-hover/btn:scale-110 transition-transform">
                                <Package className="w-6 h-6 text-sage-600" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 group-hover/btn:text-blue-700 transition-colors">Voir les préparations</div>
                                <div className="text-sm font-medium text-gray-500 mt-0.5">Gérer les bons de préparation (BP)</div>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/magasinier/stock')}
                            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-100/50 hover:border-emerald-300 rounded-xl hover:shadow-md transition-all duration-200 text-left group/btn"
                        >
                            <div className="p-3 bg-white rounded-lg shadow-sm group-hover/btn:scale-110 transition-transform">
                                <TrendingUp className="w-6 h-6 text-emerald-600" />
                            </div>
                            <div>
                                <div className="font-bold text-gray-900 group-hover/btn:text-emerald-700 transition-colors">Gérer le stock</div>
                                <div className="text-sm font-medium text-gray-500 mt-0.5">Voir et ajuster les niveaux de stock</div>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/magasinier/batch-picking')}
                            className="w-full flex items-center gap-4 p-5 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-100/50 hover:border-orange-300 rounded-xl hover:shadow-md transition-all duration-200 text-left group/btn"
                        >
                            <div className="p-3 bg-white rounded-lg shadow-sm group-hover/btn:scale-110 transition-transform">
                                <CheckCircle2 className="w-6 h-6 text-orange-600" />
                            </div>
                            <div className="min-w-0">
                                <div className="font-bold text-gray-900 group-hover/btn:text-orange-700 transition-colors flex items-center gap-2">
                                    Préparation groupée
                                    <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200">orpheline</span>
                                </div>
                                <div className="text-sm font-medium text-gray-500 mt-0.5">Déconnectée du pipeline mission — usage non recommandé</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
