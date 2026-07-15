import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Users, ClipboardList, Tag, Calculator,
    TrendingUp, ChevronRight, UserPlus, FilePlus,
} from 'lucide-react';
import { KpiWidget } from '../widgets/KpiWidget';
import { usePartnerStatistics } from '@/hooks/partners/usePartners';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const SalesHome = () => {
    const navigate = useNavigate();
    const { data: partnerStats, loading } = usePartnerStatistics();

    const kpis = [
        {
            title: 'Mes Clients Actifs',
            value: loading ? '…' : (partnerStats?.statistics?.active ?? '—'),
            icon: Users,
            color: 'blue' as const,
            trend: 'up' as const,
            onClick: () => navigate('/partners'),
        },
        {
            title: 'Total Clients',
            value: loading ? '…' : (partnerStats?.statistics?.total ?? '—'),
            icon: Users,
            color: 'sage' as const,
            onClick: () => navigate('/partners'),
        },
        {
            title: 'Promotions Actives',
            value: '—',
            subtitle: 'Consulter le catalogue',
            icon: Tag,
            color: 'violet' as const,
            onClick: () => navigate('/promotions'),
        },
        {
            title: 'Résultats',
            value: '—',
            subtitle: 'Voir reporting',
            icon: TrendingUp,
            color: 'emerald' as const,
            onClick: () => navigate('/reporting'),
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPIs */}
            <motion.div variants={fadeUp}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Mon activité commerciale
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpis.map(k => <KpiWidget key={k.title} loading={loading} {...k} />)}
                </div>
            </motion.div>

            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {/* Actions commerciales */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <FilePlus className="w-4 h-4 text-sage-600" />
                        Actions rapides
                    </h3>
                    <div className="space-y-1">
                        {[
                            { label: 'Nouvelle Commande', icon: FilePlus, route: '/orders', color: 'text-sage-600' },
                            { label: 'Nouveau Client', icon: UserPlus, route: '/partners', color: 'text-blue-500' },
                            { label: 'Mes Clients', icon: Users, route: '/partners', color: 'text-indigo-500' },
                            { label: 'Promotions', icon: Tag, route: '/promotions', color: 'text-violet-500' },
                            { label: 'Simulateur de Prix', icon: Calculator, route: '/pricing/preview', color: 'text-amber-500' },
                            { label: 'Mes Commandes', icon: ClipboardList, route: '/orders', color: 'text-orange-500' },
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
                                    <ChevronRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-gray-500" />
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Performance */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <TrendingUp className="w-4 h-4 text-emerald-500" />
                        Ma performance
                    </h3>
                    <div className="flex flex-col items-center justify-center py-8 text-center text-gray-400">
                        <TrendingUp className="w-10 h-10 mb-3 text-gray-200 dark:text-gray-700" />
                        <p className="text-sm font-medium">Tableau de bord commercial</p>
                        <p className="text-xs mt-1 mb-4">Les KPIs commerciaux seront disponibles prochainement</p>
                        <button
                            onClick={() => navigate('/reporting')}
                            className="px-4 py-2 bg-sage-600 text-white text-sm font-semibold rounded-lg hover:bg-sage-700 transition-colors"
                        >
                            Voir les rapports
                        </button>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
};
