import { useMemo } from 'react';
import { useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { DOMAIN_COLOR_MAP, type BusinessDomain } from '@/lib/hub/hubData';
import { getActiveDomainFromPath, getVisibleDomains } from '@/lib/hub/hubUtils';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AppSidebarProps {
    selectedDomain: string | null;
    onDomainSelect: (id: string) => void;
    className?: string;
}

// ─── Rail Item ────────────────────────────────────────────────────────────────

interface RailItemProps {
    domain: BusinessDomain;
    isActive: boolean;
    isOpen: boolean;
    onClick: () => void;
}

const RailItem = ({ domain, isActive, isOpen, onClick }: RailItemProps) => {
    const Icon = domain.icon;
    const colors = DOMAIN_COLOR_MAP[domain.color];
    const highlighted = isActive || isOpen;

    return (
        <button
            onClick={onClick}
            title={domain.label}
            aria-label={domain.label}
            aria-pressed={isOpen}
            className={cn(
                'relative w-full flex flex-col items-center gap-1.5 px-1 py-3 rounded-xl',
                'transition-all duration-150 group outline-none',
                highlighted
                    ? cn(colors.bg, colors.text, 'shadow-sm')
                    : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800/60',
            )}
        >
            {/* Open/active indicator bar */}
            {highlighted && (
                <motion.span
                    layoutId="sidebar-indicator"
                    className={cn('absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-6 rounded-r-full', colors.badge)}
                    transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
            )}

            {/* Pulsing ring when workspace is open */}
            {isOpen && (
                <span className={cn(
                    'absolute inset-0 rounded-xl ring-2 ring-inset opacity-30',
                    colors.badge.replace('bg-', 'ring-'),
                )} />
            )}

            <Icon className="w-5 h-5 shrink-0" />
            <span className={cn(
                'text-[9px] font-bold leading-tight text-center uppercase tracking-wide line-clamp-1 w-full',
            )}>
                {domain.label}
            </span>
        </button>
    );
};

// ─── App Sidebar ──────────────────────────────────────────────────────────────

export const AppSidebar = ({ selectedDomain, onDomainSelect, className }: AppSidebarProps) => {
    const { user } = useAuth();
    const { permissions, roles } = usePermissions();
    const location = useLocation();

    const activeDomain = useMemo(
        () => getActiveDomainFromPath(location.pathname),
        [location.pathname],
    );

    const visibleDomains = useMemo(
        () => getVisibleDomains(user, permissions, roles),
        [user, permissions, roles],
    );

    return (
        <div
            id="app-sidebar-rail"
            className={cn(
                'shrink-0 w-[60px] h-full bg-white dark:bg-gray-950',
                'border-r border-gray-100 dark:border-gray-800',
                'flex flex-col items-center py-2 px-1.5 gap-0.5',
                'overflow-y-auto overflow-x-hidden',
                className,
            )}
        >
            {visibleDomains.map(domain => (
                <RailItem
                    key={domain.id}
                    domain={domain}
                    isActive={activeDomain === domain.id}
                    isOpen={selectedDomain === domain.id}
                    onClick={() => onDomainSelect(domain.id)}
                />
            ))}
        </div>
    );
};
