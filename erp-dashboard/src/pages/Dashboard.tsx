import { useMemo, useCallback } from 'react';
import { motion } from 'framer-motion';

import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { detectUserRole, getQuickActions, getVisibleDomains } from '@/lib/hub/hubUtils';

import { HubHeader } from '@/components/hub/HubHeader';
import { QuickActionsBar } from '@/components/hub/QuickActionsBar';
import { DomainGrid } from '@/components/hub/DomainGrid';
import { BusinessFlowTrail } from '@/components/hub/BusinessFlowTrail';

import { ManagementHome } from '@/components/hub/roles/ManagementHome';
import { DispatcherHome } from '@/components/hub/roles/DispatcherHome';
import { WarehouseHome } from '@/components/hub/roles/WarehouseHome';
import { FinanceHome } from '@/components/hub/roles/FinanceHome';
import { SalesHome } from '@/components/hub/roles/SalesHome';
import { AdminHome } from '@/components/hub/roles/AdminHome';

import type { HubRole } from '@/lib/hub/hubData';

// ─── Role-specific homepage map ───────────────────────────────────────────────

const ROLE_HOME: Record<HubRole, React.ComponentType> = {
    dispatcher: DispatcherHome,
    magasinier: WarehouseHome,
    finance:    FinanceHome,
    sales:      SalesHome,
    admin:      AdminHome,
    management: ManagementHome,
};

const ROLE_PILL: Record<HubRole, { label: string; color: string }> = {
    admin:      { label: 'Administrateur', color: 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300' },
    dispatcher: { label: 'Dispatcher',     color: 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' },
    magasinier: { label: 'Magasinier',     color: 'bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300' },
    finance:    { label: 'ADV / Finance',  color: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
    management: { label: 'Management',     color: 'bg-violet-100 text-violet-700 dark:bg-violet-900/20 dark:text-violet-300' },
    sales:      { label: 'Commercial',     color: 'bg-sage-50 text-sage-700 dark:bg-sage-900/20 dark:text-sage-300' },
};

// ─── Operations Hub ───────────────────────────────────────────────────────────

export const Dashboard = () => {
    const { user } = useAuth();
    const { permissions, roles } = usePermissions();

    const role = useMemo(() => detectUserRole(user), [user]);
    const quickActions = useMemo(() => getQuickActions(role, permissions), [role, permissions]);
    const visibleDomains = useMemo(() => getVisibleDomains(user, permissions, roles), [user, permissions, roles]);

    const RoleHomeComponent = ROLE_HOME[role] ?? ManagementHome;
    const rolePill = ROLE_PILL[role];

    // Trigger CommandMenu by dispatching the same synthetic event MasterLayout listens for.
    const handleOpenSearch = useCallback(() => {
        window.dispatchEvent(new KeyboardEvent('keydown', {
            key: 'k',
            ctrlKey: true,
            bubbles: true,
        }));
    }, []);

    return (
        <div className="h-full overflow-y-auto overflow-x-hidden bg-slate-50 dark:bg-gray-950">
            <div className="max-w-[1400px] mx-auto px-5 py-6 space-y-7">

                {/* ── Header: Greeting + Search ──────────────────────────── */}
                <div className="flex items-start justify-between gap-4 flex-wrap">
                    <div className="flex-1 min-w-0">
                        <HubHeader user={user} onOpenSearch={handleOpenSearch} />
                    </div>
                    <div className="shrink-0 mt-1">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold ${rolePill.color}`}>
                            {rolePill.label}
                        </span>
                    </div>
                </div>

                {/* ── Quick Actions ──────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    <QuickActionsBar actions={quickActions} />
                </motion.div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

                {/* ── Role-specific workspace ────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.18 }}
                >
                    <RoleHomeComponent />
                </motion.div>

                <div className="h-px bg-gradient-to-r from-transparent via-gray-200 dark:via-gray-800 to-transparent" />

                {/* ── Business Domains ───────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.24 }}
                >
                    <DomainGrid domains={visibleDomains} />
                </motion.div>

                {/* ── Business Flow ──────────────────────────────────────── */}
                <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                >
                    <BusinessFlowTrail />
                </motion.div>

                <div className="h-8" />
            </div>
        </div>
    );
};

export default Dashboard;
