import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Truck, Package, AlertTriangle, CheckCircle2,
    Clock, Map, RefreshCw, ChevronRight, Route,
} from 'lucide-react';
import { KpiWidget, KpiWidgetSkeleton } from '../widgets/KpiWidget';
import { useDispatcherDashboard } from '@/hooks/dispatcher/useDispatcherDashboard';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const DispatcherHome = () => {
    const navigate = useNavigate();
    const { data, loading, refetch } = useDispatcherDashboard();

    const pipeline = data?.pipeline;
    const alerts = data?.alerts;

    const kpis = [
        {
            title: 'Livrées aujourd\'hui',
            value: loading ? '…' : (pipeline?.delivered_today ?? '—'),
            icon: CheckCircle2,
            color: 'emerald' as const,
            trend: 'up' as const,
            trendLabel: 'Ce jour',
            onClick: () => navigate('/dispatcher/bons-livraisons'),
        },
        {
            title: 'Missions en Transit',
            value: loading ? '…' : (pipeline?.missions_in_transit ?? '—'),
            icon: Truck,
            color: 'blue' as const,
            onClick: () => navigate('/dispatcher/workspace/missions'),
        },
        {
            title: 'En Préparation',
            value: loading ? '…' : (pipeline?.missions_in_preparation ?? '—'),
            subtitle: 'Missions actives',
            icon: Package,
            color: 'amber' as const,
            onClick: () => navigate('/dispatcher/workspace/missions'),
        },
        {
            title: 'Alertes',
            value: loading ? '…' : ((alerts?.shortage_queue ?? 0) + (alerts?.overdue_deliveries ?? 0)),
            subtitle: `${alerts?.shortage_queue ?? 0} pénuries · ${alerts?.overdue_deliveries ?? 0} retards`,
            icon: AlertTriangle,
            color: 'red' as const,
            trend: (alerts?.shortage_queue ?? 0) + (alerts?.overdue_deliveries ?? 0) > 0 ? 'up' as const : 'neutral' as const,
            onClick: () => navigate('/dispatcher/shortage-queue'),
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPIs */}
            <motion.div variants={fadeUp}>
                <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        Pipeline livraison
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

            {/* Pipeline Summary + Quick Nav */}
            <motion.div variants={fadeUp} className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Pipeline steps */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Route className="w-4 h-4 text-sage-600" />
                        État du Pipeline
                    </h3>
                    <div className="space-y-2">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-9 bg-gray-100 dark:bg-gray-800 rounded-lg animate-pulse" />
                            ))
                        ) : pipeline ? (
                            [
                                { label: 'BCs Confirmés', value: pipeline.bc_confirmed, color: 'text-violet-600 bg-violet-50', route: '/orders' },
                                { label: 'BLs Confirmés', value: pipeline.bl_confirmed, color: 'text-blue-600 bg-blue-50', route: '/dispatcher/bons-livraisons' },
                                { label: 'BLs Chargés', value: pipeline.bl_loaded, color: 'text-amber-600 bg-amber-50', route: '/dispatcher/bons-livraisons' },
                                { label: 'En Transit', value: pipeline.missions_in_transit, color: 'text-sage-700 bg-sage-50', route: '/dispatcher/workspace/missions' },
                                { label: 'Pénuries', value: pipeline.bp_shortage_queue, color: 'text-red-600 bg-red-50', route: '/dispatcher/shortage-queue' },
                            ].map(step => (
                                <button
                                    key={step.label}
                                    onClick={() => navigate(step.route)}
                                    className={cn(
                                        'w-full flex items-center justify-between px-3 py-2 rounded-lg',
                                        'hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group'
                                    )}
                                >
                                    <span className="text-sm text-gray-600 dark:text-gray-300">{step.label}</span>
                                    <span className={cn('text-sm font-bold px-2 py-0.5 rounded-md', step.color)}>
                                        {step.value}
                                    </span>
                                </button>
                            ))
                        ) : (
                            <p className="text-sm text-gray-400 text-center py-4">Chargement du pipeline…</p>
                        )}
                    </div>
                </div>

                {/* Quick navigation */}
                <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                    <h3 className="text-sm font-bold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <Map className="w-4 h-4 text-blue-500" />
                        Navigation rapide
                    </h3>
                    <div className="space-y-1">
                        {[
                            { label: 'Espace Missions', icon: Route, route: '/dispatcher/workspace/missions', color: 'text-sage-600' },
                            { label: 'Carte en Direct', icon: Map, route: '/dispatcher/workspace/map', color: 'text-blue-500' },
                            { label: 'Bons de Livraison', icon: Package, route: '/dispatcher/bons-livraisons', color: 'text-amber-500' },
                            { label: 'File des Pénuries', icon: AlertTriangle, route: '/dispatcher/shortage-queue', color: 'text-red-500' },
                            { label: 'Flotte & Livreurs', icon: Truck, route: '/dispatcher/fleet', color: 'text-indigo-500' },
                            { label: 'Planning Missions', icon: Clock, route: '/dispatcher/mission-planning', color: 'text-violet-500' },
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
