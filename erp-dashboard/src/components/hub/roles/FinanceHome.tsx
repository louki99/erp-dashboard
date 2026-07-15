import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Clock, AlertTriangle, Shield, CreditCard,
    BookOpen, Banknote, ChevronRight, RefreshCw, CheckCircle2,
} from 'lucide-react';
import { KpiWidget, KpiWidgetSkeleton } from '../widgets/KpiWidget';
import { useAdvDashboard } from '@/hooks/adv/useAdvDashboard';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const FinanceHome = () => {
    const navigate = useNavigate();
    const { data, loading, refetch } = useAdvDashboard();

    const stats = data?.stats;

    const kpis = [
        {
            title: 'BCs en Attente',
            value: loading ? '…' : (stats?.pending_review ?? '—'),
            subtitle: 'Validation requise',
            icon: Clock,
            color: 'amber' as const,
            trend: (stats?.pending_review ?? 0) > 5 ? 'up' as const : 'neutral' as const,
            onClick: () => navigate('/adv/validation'),
        },
        {
            title: 'Dérogations',
            value: loading ? '…' : (stats?.pending_derogations ?? '—'),
            subtitle: 'En attente',
            icon: AlertTriangle,
            color: 'red' as const,
            onClick: () => navigate('/adv/derogations'),
        },
        {
            title: 'Confirmés Aujourd\'hui',
            value: loading ? '…' : (stats?.confirmed_today ?? '—'),
            subtitle: 'BCs validés',
            icon: CheckCircle2,
            color: 'emerald' as const,
            trend: 'up' as const,
            onClick: () => navigate('/adv/validation'),
        },
        {
            title: 'Partenaires Bloqués',
            value: loading ? '…' : (stats?.blocked_partners ?? '—'),
            subtitle: 'Crédit dépassé',
            icon: Shield,
            color: 'red' as const,
            onClick: () => navigate('/adv/credit'),
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPIs */}
            <motion.div variants={fadeUp}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Tableau de bord ADV
                    </p>
                    <button onClick={() => refetch()} className="flex items-center gap-1 text-xs text-gray-400 hover:text-sage-600 transition-colors">
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

            {/* Two columns */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Exposition crédit */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Shield className="w-4 h-4 text-blue-500" />
                        Exposition crédit
                    </h3>
                    {loading ? (
                        <div className="space-y-3">
                            {[1, 2].map(i => <div key={i} className="h-12 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
                        </div>
                    ) : stats ? (
                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-3 rounded-lg bg-blue-50 dark:bg-blue-900/10">
                                <span className="text-sm text-gray-600 dark:text-gray-300">Exposition totale</span>
                                <span className="text-sm font-bold text-blue-700 dark:text-blue-300 tabular-nums">
                                    {typeof stats.total_credit_exposure === 'number'
                                        ? stats.total_credit_exposure.toLocaleString('fr-FR') + ' MAD'
                                        : stats.total_credit_exposure}
                                </span>
                            </div>
                            <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/10">
                                <span className="text-sm text-gray-600 dark:text-gray-300">Crédit disponible</span>
                                <span className="text-sm font-bold text-emerald-700 dark:text-emerald-300 tabular-nums">
                                    {typeof stats.available_credit === 'number'
                                        ? stats.available_credit.toLocaleString('fr-FR') + ' MAD'
                                        : stats.available_credit}
                                </span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-gray-400 text-center py-4">Données non disponibles</p>
                    )}
                </div>

                {/* Finance Links */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Banknote className="w-4 h-4 text-emerald-500" />
                        Accès Finance
                    </h3>
                    <div className="space-y-1">
                        {[
                            { label: 'Validation BCs', icon: CheckCircle2, route: '/adv/validation', color: 'text-sage-600', badge: stats?.pending_review },
                            { label: 'Gestion Crédit', icon: Shield, route: '/adv/credit', color: 'text-blue-500' },
                            { label: 'Dérogations', icon: AlertTriangle, route: '/adv/derogations', color: 'text-red-500', badge: stats?.pending_derogations },
                            { label: 'Échéances', icon: Clock, route: '/adv/echeances', color: 'text-amber-500' },
                            { label: 'Journaux Caisse', icon: Banknote, route: '/finance/journals', color: 'text-emerald-600' },
                            { label: 'Grand Livre', icon: BookOpen, route: '/finance/ledger', color: 'text-indigo-500' },
                            { label: 'Règlements', icon: CreditCard, route: '/finance/settlements', color: 'text-violet-500' },
                        ].map(nav => {
                            const NavIcon = nav.icon;
                            return (
                                <button
                                    key={nav.label}
                                    onClick={() => navigate(nav.route)}
                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group text-left"
                                >
                                    <NavIcon className={cn('w-4 h-4 shrink-0', nav.color)} />
                                    <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1">{nav.label}</span>
                                    {nav.badge != null && nav.badge > 0 && (
                                        <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 text-xs font-bold">
                                            {nav.badge}
                                        </span>
                                    )}
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                                </button>
                            );
                        })}
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
