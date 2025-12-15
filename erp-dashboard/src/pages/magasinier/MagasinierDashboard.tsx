import { useState, useEffect } from 'react';
import { Package, Clock, CheckCircle2, AlertTriangle, TrendingUp, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { DashboardStats } from '@/types/magasinier.types';

export const MagasinierDashboard = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchStats = async () => {
            try {
                const data = await magasinierApi.dashboard.get();
                setStats(data);
            } catch (error) {
                console.error('Failed to fetch dashboard stats:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchStats();
    }, []);

    const statCards = [
        {
            title: 'Préparations en attente',
            value: stats?.pendingPreparations || 0,
            icon: Clock,
            color: 'bg-yellow-500',
            textColor: 'text-yellow-600',
            bgColor: 'bg-yellow-50',
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'En cours',
            value: stats?.inProgress || 0,
            icon: Package,
            color: 'bg-blue-500',
            textColor: 'text-blue-600',
            bgColor: 'bg-blue-50',
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'Terminées aujourd\'hui',
            value: stats?.completedToday || 0,
            icon: CheckCircle2,
            color: 'bg-green-500',
            textColor: 'text-green-600',
            bgColor: 'bg-green-50',
        },
        {
            title: 'Articles en rupture',
            value: stats?.lowStockItems || 0,
            icon: AlertTriangle,
            color: 'bg-red-500',
            textColor: 'text-red-600',
            bgColor: 'bg-red-50',
            onClick: () => navigate('/magasinier/stock'),
        },
        {
            title: 'Prêt à préparer',
            value: stats?.readyToPrepare || 0,
            icon: TrendingUp,
            color: 'bg-purple-500',
            textColor: 'text-purple-600',
            bgColor: 'bg-purple-50',
            onClick: () => navigate('/magasinier/orders'),
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
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-gray-900">Tableau de bord Magasinier</h1>
                <p className="text-gray-600 mt-1">Vue d'ensemble des préparations et du stock</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 mb-6">
                {statCards.map((card, index) => {
                    const Icon = card.icon;
                    return (
                        <div
                            key={index}
                            onClick={card.onClick}
                            className={`${card.bgColor} rounded-lg p-6 border border-gray-200 ${card.onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <div className={`p-3 rounded-lg ${card.color}`}>
                                    <Icon className="w-6 h-6 text-white" />
                                </div>
                            </div>
                            <div className={`text-3xl font-bold ${card.textColor} mb-1`}>
                                {card.value}
                            </div>
                            <div className="text-sm text-gray-600">{card.title}</div>
                        </div>
                    );
                })}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <FileText className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Préparations en attente</h2>
                    </div>
                    {stats?.pendingBps && stats.pendingBps.length > 0 ? (
                        <div className="space-y-2">
                            {stats.pendingBps.map((bp) => (
                                <div
                                    key={bp.id}
                                    onClick={() => navigate('/magasinier/preparations')}
                                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 cursor-pointer transition-colors"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-2 h-2 rounded-full bg-yellow-500"></div>
                                        <span className="font-medium text-gray-900">{bp.bp_number}</span>
                                    </div>
                                    <span className="text-xs text-gray-500 px-2 py-1 bg-yellow-100 rounded-full">
                                        {bp.status}
                                    </span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-gray-500 text-sm">Aucune préparation en attente</p>
                    )}
                </div>

                <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="w-5 h-5 text-gray-600" />
                        <h2 className="text-lg font-semibold text-gray-900">Actions rapides</h2>
                    </div>
                    <div className="space-y-3">
                        <button
                            onClick={() => navigate('/magasinier/preparations')}
                            className="w-full flex items-center gap-3 p-4 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors text-left"
                        >
                            <Package className="w-5 h-5 text-blue-600" />
                            <div>
                                <div className="font-medium text-gray-900">Voir les préparations</div>
                                <div className="text-xs text-gray-600">Gérer les bons de préparation</div>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/magasinier/orders')}
                            className="w-full flex items-center gap-3 p-4 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-left"
                        >
                            <FileText className="w-5 h-5 text-purple-600" />
                            <div>
                                <div className="font-medium text-gray-900">Commandes approuvées</div>
                                <div className="text-xs text-gray-600">Créer des bons de préparation</div>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/magasinier/stock')}
                            className="w-full flex items-center gap-3 p-4 bg-green-50 hover:bg-green-100 rounded-lg transition-colors text-left"
                        >
                            <TrendingUp className="w-5 h-5 text-green-600" />
                            <div>
                                <div className="font-medium text-gray-900">Gérer le stock</div>
                                <div className="text-xs text-gray-600">Voir et ajuster les stocks</div>
                            </div>
                        </button>
                        <button
                            onClick={() => navigate('/magasinier/batch-picking')}
                            className="w-full flex items-center gap-3 p-4 bg-orange-50 hover:bg-orange-100 rounded-lg transition-colors text-left"
                        >
                            <CheckCircle2 className="w-5 h-5 text-orange-600" />
                            <div>
                                <div className="font-medium text-gray-900">Préparation groupée</div>
                                <div className="text-xs text-gray-600">Batch picking des BLs</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
