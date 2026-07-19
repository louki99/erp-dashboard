import { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, ChevronRight, Clock, Search, ArrowRight, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DOMAIN_COLOR_MAP,
    type BusinessDomain,
    type DomainColor,
} from '@/lib/hub/hubData';
import { getVisibleDomains, filterDomainContent } from '@/lib/hub/hubUtils';
import { WorkspacePanel } from '@/components/workspace/WorkspacePanel';
import { useAuth } from '@/context/AuthContext';
import { usePermissions } from '@/hooks/usePermissions';
import { useRecentPages } from '@/hooks/useRecentPages';
import { useWorkspaceFavorites, makeMenuKey, type WorkspaceFavorite } from '@/hooks/useWorkspaceFavorites';
import { trackRecentPage } from '@/hooks/useRecentPages';
import { escapeRegExp } from '@/lib/menu/menuUtils';

// ─── Highlight ────────────────────────────────────────────────────────────────

function Highlight({ text, query }: { text: string; query: string }) {
    if (!query.trim()) return <>{text}</>;
    const parts = text.split(new RegExp(`(${escapeRegExp(query)})`, 'gi'));
    return (
        <>
            {parts.map((part, i) =>
                part.toLowerCase() === query.toLowerCase() ? (
                    <mark
                        key={i}
                        className="bg-yellow-200 dark:bg-yellow-600/40 text-gray-900 dark:text-white font-semibold px-0.5 rounded not-italic"
                    >
                        {part}
                    </mark>
                ) : (
                    <span key={i}>{part}</span>
                )
            )}
        </>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
    actionId: string;
    label: string;
    route: string;
    domainLabel: string;
    domainId: string;
    domainColor: DomainColor;
    processLabel: string;
}

// ─── Domain Card ──────────────────────────────────────────────────────────────

const DomainCard = ({ domain, onClick }: { domain: BusinessDomain; onClick: () => void }) => {
    const Icon = domain.icon;
    const colors = DOMAIN_COLOR_MAP[domain.color];
    const visibleCount = domain.processes.length;
    const pills = domain.processes.slice(0, 3).map(p => p.label);

    return (
        <button
            onClick={onClick}
            disabled={visibleCount === 0}
            className={cn(
                'flex items-center gap-5 p-5 rounded-2xl text-left w-full',
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
                'w-16 h-16 rounded-2xl flex items-center justify-center shrink-0',
                'group-hover:scale-105 transition-transform duration-200',
                colors.iconBg,
            )}>
                <Icon className={cn('w-8 h-8', colors.text)} />
            </div>
            <div className="flex-1 min-w-0">
                <p className="text-base font-black text-gray-900 dark:text-white leading-tight">
                    {domain.label}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-1">
                    {domain.description}
                </p>
                {visibleCount === 0 ? (
                    <span className="text-[10px] font-semibold text-gray-400 mt-2 block">Accès non autorisé</span>
                ) : (
                    <div className="flex flex-wrap gap-1.5 mt-2.5">
                        {pills.map(label => (
                            <span key={label} className={cn('inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold', colors.iconBg, colors.text)}>
                                {label}
                            </span>
                        ))}
                        {visibleCount > 3 && (
                            <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400">
                                +{visibleCount - 3}
                            </span>
                        )}
                    </div>
                )}
            </div>
            <ArrowRight className={cn(
                'w-5 h-5 shrink-0 transition-all duration-200',
                visibleCount === 0 ? 'text-gray-300' : cn(colors.text, 'opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5'),
            )} />
        </button>
    );
};

// ─── Recent Chip ──────────────────────────────────────────────────────────────

const RecentChip = ({ page, onClose }: { page: { route: string; label: string }; onClose: () => void }) => {
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

// ─── Favorite Chip ────────────────────────────────────────────────────────────

const FavoriteChip = ({ fav, onClose, onRemove }: { fav: WorkspaceFavorite; onClose: () => void; onRemove: () => void }) => {
    const navigate = useNavigate();
    const colors = DOMAIN_COLOR_MAP[fav.domainColor as DomainColor] ?? DOMAIN_COLOR_MAP['slate'];
    return (
        <div className="group/fav inline-flex items-center">
            <button
                onClick={() => {
                    trackRecentPage(fav.route, fav.label);
                    navigate(fav.route);
                    onClose();
                }}
                className={cn(
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-l-full text-xs font-semibold',
                    'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-200',
                    'border border-gray-200 dark:border-gray-700',
                    'hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                    'transition-all duration-150',
                )}
            >
                <Star className={cn('w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0')} />
                <span className="truncate max-w-[130px]">{fav.label}</span>
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onRemove(); }}
                title="Retirer des favoris"
                className={cn(
                    'px-1.5 py-1.5 rounded-r-full',
                    'border border-l-0 border-gray-200 dark:border-gray-700',
                    'text-gray-300 dark:text-gray-600 hover:text-red-400 hover:border-red-200',
                    'bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-gray-700',
                    'opacity-0 group-hover/fav:opacity-100 transition-all duration-150',
                )}
            >
                <X className="w-3 h-3" />
            </button>
        </div>
    );
};

// ─── Search Result Row ────────────────────────────────────────────────────────

const SearchRow = ({ result, query, onGo, starred, onStar }: {
    result: SearchResult;
    query: string;
    onGo: () => void;
    starred: boolean;
    onStar: () => void;
}) => {
    const colors = DOMAIN_COLOR_MAP[result.domainColor];
    return (
        <div className="group/row flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
            <button onClick={onGo} className="flex-1 flex items-center gap-3 text-left min-w-0">
                <div className={cn('w-8 h-8 rounded-lg flex items-center justify-center shrink-0', colors.iconBg)}>
                    <span className={cn('text-[10px] font-black', colors.text)}>
                        {result.domainLabel.slice(0, 2).toUpperCase()}
                    </span>
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                        <Highlight text={result.label} query={query} />
                    </p>
                    <p className="text-[10px] text-gray-400 truncate flex items-center gap-1">
                        <span className={cn('font-medium', colors.text)}>
                            <Highlight text={result.domainLabel} query={query} />
                        </span>
                        <ChevronRight className="w-2.5 h-2.5 shrink-0" />
                        <Highlight text={result.processLabel} query={query} />
                    </p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 shrink-0 group-hover/row:text-gray-500 transition-colors" />
            </button>
            <button
                onClick={(e) => { e.stopPropagation(); onStar(); }}
                title={starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                className={cn(
                    'shrink-0 p-1.5 rounded-full',
                    'transition-all duration-150',
                    starred
                        ? 'opacity-100'
                        : 'opacity-0 group-hover/row:opacity-100',
                    'hover:bg-yellow-50 dark:hover:bg-yellow-900/20',
                )}
            >
                <Star className={cn('w-3.5 h-3.5', starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400 hover:text-yellow-500')} />
            </button>
        </div>
    );
};

// ─── Domain Grid View ─────────────────────────────────────────────────────────

interface DomainGridViewProps {
    domains: BusinessDomain[];
    onSelectDomain: (id: string) => void;
    onClose: () => void;
    favorites: WorkspaceFavorite[];
    onToggleFavorite: (item: WorkspaceFavorite) => void;  // POST toggle — for star buttons
    onRemoveFavorite: (item: WorkspaceFavorite) => void;  // DELETE explicit — for × button
    isFavorite: (id: string, route: string) => boolean;
    searchResults: SearchResult[];
    searchQuery: string;
    setSearchQuery: (q: string) => void;
    onSearchGo: (result: SearchResult) => void;
}

const DomainGridView = ({
    domains, onSelectDomain, onClose,
    favorites, onToggleFavorite, onRemoveFavorite, isFavorite,
    searchResults, searchQuery, setSearchQuery, onSearchGo,
}: DomainGridViewProps) => {
    const recentPages = useRecentPages();
    const searchRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setTimeout(() => searchRef.current?.focus(), 80);
    }, []);

    const isSearching = searchQuery.trim().length > 0;

    return (
        <motion.div
            key="domains"
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
            exit={{ opacity: 0, x: -16, transition: { duration: 0.14 } }}
            className="flex flex-col h-full"
        >
            {/* Header */}
            <div className="flex items-start justify-between px-7 pt-7 pb-4 shrink-0">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-gray-400">OMNI360 ENTERPRISE</p>
                    <h2 className="text-xl font-black text-gray-900 dark:text-white mt-1 leading-tight">
                        {isSearching ? 'Résultats de recherche' : 'Choisissez votre espace de travail'}
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

            {/* Search bar */}
            <div className="px-7 pb-4 shrink-0">
                <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        ref={searchRef}
                        type="text"
                        value={searchQuery}
                        onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Rechercher une fonction, un module..."
                        className={cn(
                            'w-full pl-10 pr-10 py-2.5 rounded-xl text-sm',
                            'bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700',
                            'text-gray-900 dark:text-white placeholder:text-gray-400',
                            'focus:outline-none focus:ring-2 focus:ring-sage-500/40 focus:border-sage-400',
                            'transition-all duration-150',
                        )}
                    />
                    {searchQuery && (
                        <button
                            onClick={() => setSearchQuery('')}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>
            </div>

            {/* Content area */}
            <div className="flex-1 overflow-y-auto px-7 pb-4">
                {isSearching ? (
                    // ── Search results
                    <div className="space-y-0.5">
                        {searchResults.length === 0 ? (
                            <div className="text-center py-12 text-gray-400">
                                <Search className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                <p className="text-sm">Aucun résultat pour &ldquo;{searchQuery}&rdquo;</p>
                            </div>
                        ) : (
                            searchResults.map(result => (
                                <SearchRow
                                    key={`${result.domainId}-${result.actionId}`}
                                    result={result}
                                    query={searchQuery}
                                    onGo={() => onSearchGo(result)}
                                    starred={isFavorite(result.actionId, result.route)}
                                    onStar={() => onToggleFavorite({
                                        menuKey: makeMenuKey(result.domainId, result.actionId),
                                        id: result.actionId,
                                        label: result.label,
                                        route: result.route,
                                        domainId: result.domainId,
                                        domainLabel: result.domainLabel,
                                        domainColor: result.domainColor,
                                    })}
                                />
                            ))
                        )}
                    </div>
                ) : (
                    // ── Domain grid
                    <div className="grid grid-cols-2 gap-3">
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
                )}
            </div>

            {/* Bottom strip — favorites + recents */}
            {!isSearching && (
                <div className="shrink-0 border-t border-gray-100 dark:border-gray-800 px-7 py-4 space-y-3">
                    {/* Favorites */}
                    {favorites.length > 0 && (
                        <div>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                Favoris
                            </p>
                            <div className="flex flex-wrap gap-2">
                                {favorites.slice(0, 8).map(fav => (
                                    <FavoriteChip
                                        key={fav.menuKey}
                                        fav={fav}
                                        onClose={onClose}
                                        onRemove={() => onRemoveFavorite(fav)}
                                    />
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Recents */}
                    <div>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 mb-2 flex items-center gap-1.5">
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
                </div>
            )}
        </motion.div>
    );
};

// ─── Workspace View ───────────────────────────────────────────────────────────

interface WorkspaceViewProps {
    domain: BusinessDomain;
    onBack: () => void;
    onClose: () => void;
    favorites: WorkspaceFavorite[];
    onToggleFavorite: (item: WorkspaceFavorite) => void;
}

const WorkspaceView = ({ domain, onBack, onClose, favorites, onToggleFavorite }: WorkspaceViewProps) => (
    <motion.div
        key={domain.id}
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0, transition: { duration: 0.18, ease: [0.22, 1, 0.36, 1] } }}
        exit={{ opacity: 0, x: 16, transition: { duration: 0.14 } }}
        className="flex-1 min-h-0 flex flex-col overflow-hidden"
    >
        <WorkspacePanel
            domain={domain}
            onClose={onClose}
            onBack={onBack}
            favorites={favorites}
            onToggleFavorite={onToggleFavorite}
        />
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
    const navigate = useNavigate();

    const [view, setView] = useState<LauncherView>('domains');
    const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const { favorites, toggle: toggleFavorite, remove: removeFavorite, isFavorite } = useWorkspaceFavorites();

    const visibleDomains = useMemo(
        () => getVisibleDomains(user, permissions, roles)
                .map(d => filterDomainContent(d, permissions, roles, user)),
        [user, permissions, roles],
    );

    const activeDomain = useMemo(
        () => visibleDomains.find(d => d.id === selectedDomain) ?? null,
        [visibleDomains, selectedDomain],
    );

    // Flat search index across all domains
    const searchResults = useMemo((): SearchResult[] => {
        const q = searchQuery.trim().toLowerCase();
        if (!q) return [];
        return visibleDomains.flatMap(domain =>
            domain.processes.flatMap(process =>
                process.actions
                    .filter(a =>
                        a.label.toLowerCase().includes(q) ||
                        process.label.toLowerCase().includes(q) ||
                        domain.label.toLowerCase().includes(q)
                    )
                    .map(action => ({
                        actionId: action.id,
                        label: action.label,
                        route: action.route,
                        domainLabel: domain.label,
                        domainId: domain.id,
                        domainColor: domain.color,
                        processLabel: process.label,
                    }))
            )
        ).slice(0, 15);
    }, [searchQuery, visibleDomains]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            const t = setTimeout(() => {
                setView('domains');
                setSelectedDomain(null);
                setSearchQuery('');
            }, 280);
            return () => clearTimeout(t);
        }
    }, [isOpen]);

    // ESC: workspace → domains; domains → close
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

    const handleSearchGo = (result: SearchResult) => {
        trackRecentPage(result.route, result.label);
        navigate(result.route);
        onClose();
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
                    <motion.div
                        className="absolute inset-0 bg-black/40 backdrop-blur-[3px]"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={view === 'workspace' ? handleBackToDomains : onClose}
                    />

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
                        {/* Accent bar */}
                        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-sage-500 via-blue-500 to-violet-500 opacity-60 z-10" />

                        <AnimatePresence mode="wait">
                            {view === 'domains' ? (
                                <DomainGridView
                                    key="domains"
                                    domains={visibleDomains}
                                    onSelectDomain={handleSelectDomain}
                                    onClose={onClose}
                                    favorites={favorites}
                                    onToggleFavorite={toggleFavorite}
                                    onRemoveFavorite={removeFavorite}
                                    isFavorite={isFavorite}
                                    searchResults={searchResults}
                                    searchQuery={searchQuery}
                                    setSearchQuery={setSearchQuery}
                                    onSearchGo={handleSearchGo}
                                />
                            ) : activeDomain ? (
                                <WorkspaceView
                                    key={activeDomain.id}
                                    domain={activeDomain}
                                    onBack={handleBackToDomains}
                                    onClose={onClose}
                                    favorites={favorites}
                                    onToggleFavorite={toggleFavorite}
                                />
                            ) : null}
                        </AnimatePresence>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
