import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Users, TrendingUp, Clock, AlertTriangle,
    FileText, CheckCircle2, ChevronRight, RefreshCw,
    Banknote, Package,
} from 'lucide-react';
import { KpiWidget, KpiWidgetSkeleton } from '../widgets/KpiWidget';
import { usePartnerStatistics } from '@/hooks/partners/usePartners';
import { useAdvDashboard } from '@/hooks/adv/useAdvDashboard';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const ManagementHome = () => {
    const navigate = useNavigate();
    const { data: partnerStats, loading: partnerLoading } = usePartnerStatistics();
    const { data: advData, loading: advLoading, refetch } = useAdvDashboard();

    const loading = partnerLoading || advLoading;

    const kpis = [
        {
            title: 'Clients Actifs',
            value: partnerLoading ? '…' : (partnerStats?.statistics?.active ?? '—'),
            subtitle: `Total: ${partnerStats?.statistics?.total ?? '—'}`,
            icon: Users,
            color: 'blue' as const,
            trend: 'up' as const,
            trendLabel: '+2 ce mois',
            onClick: () => navigate('/partners'),
        },
        {
            title: 'BCs en Attente',
            value: advLoading ? '…' : (advData?.stats?.pending_review ?? '—'),
            subtitle: 'Validation requise',
            icon: Clock,
            color: 'amber' as const,
            trend: advData?.stats?.pending_review > 5 ? 'up' as const : 'neutral' as const,
            trendLabel: advData?.stats?.pending_review > 5 ? 'Attention' : undefined,
            onClick: () => navigate('/adv/validation'),
        },
        {
            title: 'Dérogations',
            value: advLoading ? '…' : (advData?.stats?.pending_derogations ?? '—'),
            subtitle: 'En attente d\'approbation',
            icon: AlertTriangle,
            color: 'red' as const,
            onClick: () => navigate('/adv/derogations'),
        },
        {
            title: 'Clients Bloqués',
            value: partnerLoading ? '…' : (partnerStats?.statistics?.blocked ?? '—'),
            subtitle: 'Limite crédit dépassée',
            icon: AlertTriangle,
            color: 'red' as const,
            onClick: () => navigate('/partners?status=BLOCKED'),
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPI Row */}
            <motion.div variants={fadeUp}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Vue d&apos;ensemble
                    </p>
                    <button
                        onClick={() => refetch()}
                        className="flex items-center gap-1 text-xs text-gray-400 hover:text-sage-600 transition-colors"
                    >
                        <RefreshCw className="w-3 h-3" />
                        Actualiser
                    </button>
                </div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {loading
                        ? Array.from({ length: 4 }).map((_, i) => <KpiWidgetSkeleton key={i} />)
                        : kpis.map(k => <KpiWidget key={k.title} {...k} />)
                    }
                </div>
            </motion.div>

            {/* Two columns: Recent Alerts + Quick Links */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Recent Partners to Validate */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <Users className="w-4 h-4 text-blue-500" />
                            Partenaires récents
                        </h3>
                        <button onClick={() => navigate('/adv/partners')} className="text-xs text-sage-600 hover:text-sage-700 font-medium">
                            Voir tout →
                        </button>
                    </div>
                    {advLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
                        </div>
                    ) : advData?.recentPartners?.length ? (
                        <div className="space-y-1">
                            {advData.recentPartners.slice(0, 5).map((p: any) => (
                                <button
                                    key={p.id}
                                    onClick={() => navigate('/partners')}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left',
                                        'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group'
                                    )}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                                        <p className="text-xs text-gray-400">{p.code}</p>
                                    </div>
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                                </button>
                            ))}
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-4">Aucun partenaire récent</p>
                    )}
                </div>

                {/* Credit Alerts */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            Alertes crédit
                        </h3>
                        <button onClick={() => navigate('/adv/credit')} className="text-xs text-sage-600 hover:text-sage-700 font-medium">
                            Gérer →
                        </button>
                    </div>
                    {advLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
                        </div>
                    ) : advData?.creditAlerts?.length ? (
                        <div className="space-y-1">
                            {advData.creditAlerts.slice(0, 5).map((p: any) => (
                                <div key={p.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-red-50 dark:bg-red-900/10">
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</p>
                                        <p className="text-xs text-red-500 font-medium">Crédit dépassé</p>
                                    </div>
                                    <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <CheckCircle2 className="w-8 h-8 text-emerald-400 mb-2" />
                            <p className="text-sm text-gray-500">Aucune alerte crédit active</p>
                        </div>
                    )}
                </div>
            </motion.div>
        </motion.div>
    );
};
