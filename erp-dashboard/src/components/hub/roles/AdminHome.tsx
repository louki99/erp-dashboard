import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
    Shield, Users, Cog, Database,
    GitBranch, FileText, ChevronRight, AlertTriangle,
} from 'lucide-react';
import { KpiWidget } from '../widgets/KpiWidget';
import { usePartnerStatistics } from '@/hooks/partners/usePartners';
import { cn } from '@/lib/utils';

const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const fadeUp = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

export const AdminHome = () => {
    const navigate = useNavigate();
    const { data: partnerStats, loading } = usePartnerStatistics();

    const kpis = [
        {
            title: 'Total Clients',
            value: loading ? '…' : (partnerStats?.statistics?.total ?? '—'),
            icon: Users,
            color: 'blue' as const,
            onClick: () => navigate('/partners'),
        },
        {
            title: 'Clients Actifs',
            value: loading ? '…' : (partnerStats?.statistics?.active ?? '—'),
            icon: Users,
            color: 'emerald' as const,
            onClick: () => navigate('/partners'),
        },
        {
            title: 'Clients Bloqués',
            value: loading ? '…' : (partnerStats?.statistics?.blocked ?? '—'),
            icon: AlertTriangle,
            color: 'red' as const,
            onClick: () => navigate('/partners?status=BLOCKED'),
        },
        {
            title: 'En Attente',
            value: loading ? '…' : (partnerStats?.statistics?.on_hold ?? '—'),
            icon: AlertTriangle,
            color: 'amber' as const,
            onClick: () => navigate('/partners?status=ON_HOLD'),
        },
    ];

    const adminSections = [
        {
            title: 'Droits & Accès',
            icon: Shield,
            color: 'text-red-500',
            links: [
                { label: 'Rôles', route: '/rbac/roles' },
                { label: 'Matrice Permissions', route: '/rbac/matrix' },
                { label: 'Utilisateurs', route: '/rbac/users' },
                { label: 'Profils d\'Accès', route: '/rbac/access-profiles' },
            ],
        },
        {
            title: 'Configuration',
            icon: Cog,
            color: 'text-slate-500',
            links: [
                { label: 'Paramètres Généraux', route: '/settings' },
                { label: 'Configuration Système', route: '/settings/configuration' },
                { label: 'Champs Personnalisés', route: '/custom-fields' },
                { label: 'Règles Données', route: '/data-rules' },
            ],
        },
        {
            title: 'Données & Tokens',
            icon: Database,
            color: 'text-indigo-500',
            links: [
                { label: 'Séries de Tokens', route: '/token-series' },
                { label: 'Clés Appareils', route: '/device-keys' },
                { label: 'Traductions', route: '/translations' },
                { label: 'Import / Export', route: '/import-export' },
            ],
        },
        {
            title: 'Workflows & Docs',
            icon: GitBranch,
            color: 'text-violet-500',
            links: [
                { label: 'Templates Workflow', route: '/workflows' },
                { label: 'Document Studio', route: '/document-studio' },
                { label: 'Reporting Admin', route: '/reporting/admin' },
                { label: 'Catalogue Produits', route: '/products/master-data' },
            ],
        },
    ];

    return (
        <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
            {/* KPIs */}
            <motion.div variants={fadeUp}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Vue Système
                </p>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpis.map(k => <KpiWidget key={k.title} loading={loading} {...k} />)}
                </div>
            </motion.div>

            {/* Admin sections grid */}
            <motion.div variants={fadeUp}>
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                    Administration système
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {adminSections.map(section => {
                        const SectionIcon = section.icon;
                        return (
                            <div key={section.title} className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 shadow-sm p-4">
                                <h3 className="text-xs font-bold text-gray-900 dark:text-white mb-2.5 flex items-center gap-1.5">
                                    <SectionIcon className={cn('w-3.5 h-3.5', section.color)} />
                                    {section.title}
                                </h3>
                                <div className="space-y-0.5">
                                    {section.links.map(link => (
                                        <button
                                            key={link.label}
                                            onClick={() => navigate(link.route)}
                                            className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                        >
                                            <span className="text-xs text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white">
                                                {link.label}
                                            </span>
                                            <ChevronRight className="w-3 h-3 text-gray-300 group-hover:text-gray-500 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </motion.div>
        </motion.div>
    );
};
