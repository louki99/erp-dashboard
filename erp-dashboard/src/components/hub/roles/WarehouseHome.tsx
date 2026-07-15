import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    ClipboardList, Package, AlertTriangle, Layers,
    ArrowLeftRight, Database, ChevronRight, RefreshCw, Warehouse,
} from 'lucide-react';
import { KpiWidget, KpiWidgetSkeleton } from '../widgets/KpiWidget';
import { usePreparationBills } from '@/hooks/stock/useWarehouse';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const WarehouseHome = () => {
    const navigate = useNavigate();

    const { data: bpsData, isLoading: bpsLoading, refetch } = usePreparationBills({ per_page: 5, status: 'pending' });
    const { data: bpsInProgress, isLoading: ipLoading } = usePreparationBills({ per_page: 5, status: 'in_progress' });

    const loading = bpsLoading || ipLoading;
    const pendingCount = bpsData?.total ?? 0;
    const inProgressCount = bpsInProgress?.total ?? 0;

    const kpis = [
        {
            title: 'Préparations à Faire',
            value: bpsLoading ? '…' : pendingCount,
            subtitle: 'BPs en attente',
            icon: ClipboardList,
            color: 'amber' as const,
            trend: pendingCount > 5 ? 'up' as const : 'neutral' as const,
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'En Cours',
            value: ipLoading ? '…' : inProgressCount,
            subtitle: 'BPs en progression',
            icon: Package,
            color: 'blue' as const,
            onClick: () => navigate('/magasinier/preparations'),
        },
        {
            title: 'Stock Global',
            value: '—',
            subtitle: 'Consultation requise',
            icon: Database,
            color: 'sage' as const,
            onClick: () => navigate('/stock/consultation'),
        },
        {
            title: 'Entrepôts',
            value: '—',
            subtitle: 'Emplacements actifs',
            icon: Warehouse,
            color: 'indigo' as const,
            onClick: () => navigate('/stock/warehouses'),
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPIs */}
            <motion.div variants={fadeUp}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Activité magasin
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

            {/* BPs à traiter + Quick Nav */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Pending Preparation Bills */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="text-sm font-bold text-gray-900 dark:text-white flex items-center gap-2">
                            <ClipboardList className="w-4 h-4 text-amber-500" />
                            BPs à traiter
                        </h3>
                        <button onClick={() => navigate('/magasinier/preparations')} className="text-xs text-sage-600 hover:text-sage-700 font-medium">
                            Tout voir →
                        </button>
                    </div>
                    {bpsLoading ? (
                        <div className="space-y-2">
                            {[1, 2, 3].map(i => <div key={i} className="h-10 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />)}
                        </div>
                    ) : bpsData?.data?.length ? (
                        <div className="space-y-1">
                            {bpsData.data.slice(0, 5).map((bp: any) => (
                                <button
                                    key={bp.id}
                                    onClick={() => navigate('/magasinier/preparations')}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2 rounded-lg text-left',
                                        'hover:bg-amber-50 dark:hover:bg-amber-900/10 transition-colors group'
                                    )}
                                >
                                    <div>
                                        <p className="text-sm font-medium text-gray-800 dark:text-gray-200">
                                            {bp.bp_number ?? `BP #${bp.id}`}
                                        </p>
                                        <p className="text-xs text-gray-400">
                                            Priorité {bp.priority ?? 'normale'}
                                        </p>
                                    </div>
                                    <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-amber-100 text-amber-700">
                                        En attente
                                    </span>
                                </button>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-6 text-center">
                            <Package className="w-8 h-8 text-gray-300 mb-2" />
                            <p className="text-sm text-gray-400">Aucune préparation en attente</p>
                        </div>
                    )}
                </div>

                {/* Quick Navigation */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Warehouse className="w-4 h-4 text-orange-500" />
                        Accès rapide
                    </h3>
                    <div className="space-y-1">
                        {[
                            { label: 'Mes Préparations', icon: ClipboardList, route: '/magasinier/preparations', color: 'text-amber-500' },
                            { label: 'Picking par Lots', icon: Layers, route: '/magasinier/batch-picking', color: 'text-orange-500' },
                            { label: 'Mon Stock', icon: Package, route: '/magasinier/stock', color: 'text-sage-600' },
                            { label: 'Consultation Stock', icon: Database, route: '/stock/consultation', color: 'text-indigo-500' },
                            { label: 'Transferts', icon: ArrowLeftRight, route: '/dispatcher/warehouse-transfers', color: 'text-blue-500' },
                            { label: 'Bons de Prép. Stock', icon: ClipboardList, route: '/stock/preparation-bills', color: 'text-violet-500' },
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
            </motion.div>
        </motion.div>
    );
};
