import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight, Clock, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { DOMAIN_COLOR_MAP, type BusinessDomain } from '@/lib/hub/hubData';
import { getVisibleDomains, filterDomainContent } from '@/lib/hub/hubUtils';
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRecentPages } from '@/hooks/useRecentPages';

// ─── Domain Card ──────────────────────────────────────────────────────────────

interface DomainCardProps {
    domain: BusinessDomain;
    onClick: () => void;
}

const DomainCard = ({ domain, onClick }: DomainCardProps) => {
    const Icon = domain.icon;
    const colors = DOMAIN_COLOR_MAP[domain.color];
    // domain.processes is already permission-filtered → count is accurate
    const visibleCount = domain.processes.length;

    return (
        <button
            onClick={onClick}
            disabled={visibleCount === 0}
            className={cn(
                'flex flex-col items-center gap-3.5 p-5 rounded-2xl text-center',
                'bg-white dark:bg-gray-800/50',
                'border-2 border-transparent',
                'shadow-sm hover:shadow-xl',
                'hover:border-gray-100 dark:hover:border-gray-700',
                'hover:-translate-y-0.5',
                'transition-all duration-200 group outline-none',
                'focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-300',
                visibleCount === 0 && 'opacity-40 cursor-not-allowed hover:shadow-sm hover:translate-y-0',
            )}
        >
            <div className={cn(
                'w-14 h-14 rounded-2xl flex items-center justify-center',
                'group-hover:scale-110 transition-transform duration-200',
                colors.iconBg,
            )}>
                <Icon className={cn('w-7 h-7', colors.text)} />
            </div>

            <div className="w-full">
                <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight">
                    {domain.label}
                </p>
                <div className={cn(
                    'flex items-center justify-center gap-0.5 mt-1.5 text-[10px] font-semibold',
                    visibleCount === 0 ? 'text-gray-400' : colors.text,
                )}>
                    {visibleCount === 0
                        ? <span>Accès non autorisé</span>
                        : <><span>{visibleCount} processus</span><ChevronRight className="w-3 h-3" /></>
                    }
                </div>
            </div>
        </button>
    );
};

// ─── Domain Grid View ─────────────────────────────────────────────────────────

interface DomainGridViewProps {
    domains: BusinessDomain[];
    onSelectDomain: (id: string) => void;
    onClose: () => void;
    onOpenSearch: () => void;
}

const DomainGridView = ({ domains, onSelectDomain, onClose, onOpenSearch }: DomainGridViewProps) => {
    const recentPages = useRecentPages();

    return (
        <motion.div
            key="domains"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, x: -16, transition: { duration: 0.14 } }}
            className="flex flex-col h-full"
        >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-6 shrink-0">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">
                        OMNI360 ENTERPRISE
                    </p>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1 leading-tight">
                        Choisissez votre espace de travail
                    </h2>
                </div>
                <button
                    onClick={onClose}
                    aria-label="Fermer"
                    className="mt-1 w-8 h-8 rounded-full flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                    <X style={{ width: 18, height: 18 }} />
                </button>
            </div>

            {/* Domain cards grid — scrollable if domains overflow */}
            <div className="flex-1 overflow-y-auto px-7 pb-4">
                <div className="grid grid-cols-4 gap-3">
                    {domains.map((domain, i) => (
                        <motion.div
                            key={domain.id}
                            initial={{ opacity: 0, y: 14 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.18, delay: i * 0.035 }}
                        >
                            <DomainCard
                                domain={domain}
                                onClick={() => domain.processes.length > 0 && onSelectDomain(domain.id)}
                            />
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Bottom strip — anchored at bottom */}
            <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-7 py-5">
                <div className="flex items-start gap-8">
                    {/* Recent pages */}
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2.5 flex items-center gap-1.5">
                            <Clock className="w-3 h-3" />
                            Récents
                        </p>
                        {recentPages.length === 0 ? (
                            <p className="text-xs text-gray-400 italic">Aucun historique</p>
                        ) : (
                            <div className="flex flex-wrap gap-2">
                                {recentPages.slice(0, 5).map(page => (
                                    <RecentChip key={page.route} page={page} onClose={onClose} />
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Search shortcut */}
                    <button
                        onClick={onOpenSearch}
                        className={cn(
                            'shrink-0 flex items-center gap-2.5 px-4 py-2.5 rounded-xl',
                            'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                            'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white',
                            'hover:border-gray-300 dark:hover:border-gray-600 hover:shadow-sm',
                            'transition-all duration-150',
                        )}
                    >
                        <Search className="w-4 h-4" />
                        <span className="text-sm font-medium">Recherche universelle</span>
                        <div className="flex gap-1 ml-1">
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-mono text-gray-500 dark:text-gray-400">⌘</kbd>
                            <kbd className="px-1.5 py-0.5 rounded bg-gray-200 dark:bg-gray-700 text-[10px] font-mono text-gray-500 dark:text-gray-400">K</kbd>
                        </div>
                    </button>
                </div>
            </div>
        </motion.div>
    );
};

// ─── Recent Chip ──────────────────────────────────────────────────────────────

interface RecentChipProps {
    page: { route: string; label: string };
    onClose: () => void;
}

const RecentChip = ({ page, onClose }: RecentChipProps) => {
    const navigate = useNavigate();
    return (
        <button
            onClick={() => { navigate(page.route); onClose(); }}
            className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium',
                'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300',
                'border border-gray-200 dark:border-gray-700',
                'hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                'hover:border-gray-300 transition-all duration-150',
            )}
        >
            <Clock className="w-3 h-3 text-gray-400 shrink-0" />
            <span className="truncate max-w-[120px]">{page.label}</span>
        </button>
    );
};

// ─── Workspace View ───────────────────────────────────────────────────────────

interface WorkspaceViewProps {
    domain: BusinessDomain;
    onBack: () => void;
    onClose: () => void;
}

const WorkspaceView = ({ domain, onBack, onClose }: WorkspaceViewProps) => (
    <motion.div
        key={domain.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, x: 16, transition: { duration: 0.14 } }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
    >
        <WorkspacePanel domain={domain} onClose={onClose} onBack={onBack} />
    </motion.div>
);

// ─── App Launcher ─────────────────────────────────────────────────────────────

type LauncherView = 'domains' | 'workspace';

export interface AppLauncherProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AppLauncher = ({ isOpen, onClose }: AppLauncherProps) => {
    const { user } = useAuth();
    const { permissions, roles } = usePermissions();

    const [view, setView] = useState<LauncherView>('domains');
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

    // Visible domains filtered by role, then each domain's processes/actions filtered by permission
    const visibleDomains = useMemo(
        () => getVisibleDomains(user, permissions, roles)
                .map(d => filterDomainContent(d, permissions, roles, user)),
        [user, permissions, roles],
    );

    // The selected domain object (already permission-filtered)
    const activeDomain = useMemo(
        () => visibleDomains.find(d => d.id === selectedDomain) ?? null,
        [visibleDomains, selectedDomain],
    );

    // Reset to domain grid after close animation finishes
    useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(() => {
                setView('domains');
                setSelectedDomain(null);
            }, 280);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // ESC: workspace → domains; domains → close (propagates to parent)
    useEffect(() => {
        if (!isOpen) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key !== 'Escape') return;
            if (view === 'workspace') {
                e.stopPropagation();
                setView('domains');
                setSelectedDomain(null);
            }
        };
        window.addEventListener('keydown', handler, { capture: true });
        return () => window.removeEventListener('keydown', handler, { capture: true });
    }, [isOpen, view]);

    const handleSelectDomain = (domainId: string) => {
        setSelectedDomain(domainId);
        setView('workspace');
    };

    const handleBackToDomains = () => {
        setView('domains');
        setSelectedDomain(null);
    };

    const handleOpenSearch = () => {
        onClose();
        setTimeout(() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
        }, 150);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div
                    className="fixed inset-0 z-[90] flex items-center justify-center p-4"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Application Launcher"
                >
                    {/* Backdrop */}
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={view === 'workspace' ? handleBackToDomains : onClose}
                    />

                    {/*
                        Main panel — FIXED height on BOTH views to eliminate layout shift.
                        h-[min(82vh,760px)] is identical in domains and workspace views:
                        no resize, no layout animation, no jump.
                    */}
                    <motion.div
                        className={cn(
                            'relative z-10 w-full max-w-[860px] bg-white dark:bg-gray-900',
                            'rounded-3xl shadow-2xl overflow-hidden flex flex-col',
                            'h-[min(82vh,760px)]',
                        )}
                        initial={{ opacity: 0, scale: 0.94, y: -12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.94, y: -12 }}
                        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
                    >
                        {/* Accent gradient bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sage-500 via-blue-500 to-violet-500 opacity-60 z-10" />

                        <AnimatePresence mode="wait">
                            {view === 'domains' ? (
                                <DomainGridView
                                    key="domains"
                                    domains={visibleDomains}
                                    onSelectDomain={handleSelectDomain}
                                    onClose={onClose}
                                    onOpenSearch={handleOpenSearch}
                                />
                            ) : activeDomain ? (
                                <WorkspaceView
                                    key={activeDomain.id}
                                    domain={activeDomain}
                                    onBack={handleBackToDomains}
                                    onClose={onClose}
                                />
                            ) : null}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
