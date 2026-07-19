import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { X, Zap, Grid3x3, Clock, ChevronRight, Sparkles, ChevronLeft, Star } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    DOMAIN_COLOR_MAP,
    type BusinessDomain,
    type HubProcess,
    type HubAction,
} from '@/lib/hub/hubData';
import { trackRecentPage, useRecentPages } from '@/hooks/useRecentPages';
import { makeMenuKey } from '@/hooks/useWorkspaceFavorites';
import type { WorkspaceFavorite } from '@/hooks/useWorkspaceFavorites';

interface WorkspacePanelProps {
    domain: BusinessDomain;
    onClose: () => void;
    onBack?: () => void;
    favorites?: WorkspaceFavorite[];
    onToggleFavorite?: (item: WorkspaceFavorite) => void;
}

// ─── Quick Action Card ─────────────────────────────────────────────────────────

interface QuickActionCardProps {
    action: HubAction;
    colors: typeof DOMAIN_COLOR_MAP[keyof typeof DOMAIN_COLOR_MAP];
    onClick: () => void;
    starred?: boolean;
    onStar?: () => void;
}

const QuickActionCard = ({ action, colors, onClick, starred, onStar }: QuickActionCardProps) => {
    const Icon = action.icon;
    return (
        <div className="relative group/qa">
            <button
                onClick={onClick}
                className={cn(
                    'flex flex-col items-center gap-3 p-4 rounded-2xl text-center w-full',
                    'bg-white dark:bg-gray-800/70 border-2 border-transparent',
                    'hover:border-gray-200 dark:hover:border-gray-600',
                    'hover:shadow-lg shadow-sm transition-all duration-200 group',
                    'focus:outline-none focus:ring-2 focus:ring-offset-2',
                )}
            >
                <div className={cn(
                    'w-11 h-11 rounded-xl flex items-center justify-center shrink-0',
                    'group-hover:scale-110 transition-transform duration-200',
                    colors.iconBg,
                )}>
                    <Icon className={cn('w-5 h-5', colors.text)} />
                </div>
                <span className="text-[11px] font-bold text-gray-700 dark:text-gray-200 leading-tight line-clamp-2 w-full">
                    {action.label}
                </span>
            </button>
            {onStar && (
                <button
                    onClick={(e) => { e.stopPropagation(); onStar(); }}
                    title={starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                    className={cn(
                        'absolute top-1.5 right-1.5 w-5 h-5 rounded-full flex items-center justify-center',
                        'opacity-0 group-hover/qa:opacity-100 transition-opacity duration-150',
                        'hover:bg-gray-100 dark:hover:bg-gray-700',
                    )}
                >
                    <Star className={cn('w-3 h-3', starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400')} />
                </button>
            )}
        </div>
    );
};

// ─── Process Card ──────────────────────────────────────────────────────────────

interface ProcessCardProps {
    process: HubProcess;
    colors: typeof DOMAIN_COLOR_MAP[keyof typeof DOMAIN_COLOR_MAP];
    onNavigate: (route: string, label: string) => void;
    domainId: string;
    domainLabel: string;
    domainColor: string;
    favorites?: WorkspaceFavorite[];
    onToggleFavorite?: (item: WorkspaceFavorite) => void;
}

const ProcessCard = ({ process, colors, onNavigate, domainId, domainLabel, domainColor, favorites, onToggleFavorite }: ProcessCardProps) => {
    const ProcessIcon = process.icon;
    const [expanded, setExpanded] = useState(false);
    const chipsRef = useRef<HTMLDivElement>(null);
    const VISIBLE = 3;
    const visibleActions = expanded ? process.actions : process.actions.slice(0, VISIBLE);
    const hiddenCount = process.actions.length - VISIBLE;

    const handleExpand = (e: React.MouseEvent) => {
        e.stopPropagation();
        setExpanded(true);
        requestAnimationFrame(() => {
            chipsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
    };

    const isFav = (action: HubAction) =>
        !!favorites?.some(f => f.id === action.id && f.route === action.route);

    return (
        <div className={cn(
            'bg-white dark:bg-gray-800/50 rounded-2xl p-4',
            'border border-gray-100 dark:border-gray-700/50',
            'hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-md',
            'transition-all duration-200 flex flex-col gap-3',
        )}>
            <button
                onClick={() => onNavigate(process.route, process.label)}
                className="flex items-start gap-3 text-left group/header"
            >
                <div className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                    'group-hover/header:scale-105 transition-transform',
                    colors.iconBg,
                )}>
                    <ProcessIcon className={cn('w-4 h-4', colors.text)} />
                </div>
                <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 dark:text-white leading-tight group-hover/header:text-inherit transition-colors line-clamp-1">
                        {process.label}
                    </p>
                    {process.description && (
                        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-0.5 line-clamp-1">
                            {process.description}
                        </p>
                    )}
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-1 group-hover/header:text-gray-500 transition-colors" />
            </button>

            {process.actions.length > 0 && (
                <div ref={chipsRef} className="flex flex-wrap gap-1.5 pt-2.5 border-t border-gray-100 dark:border-gray-700/50">
                    {visibleActions.map(action => {
                        const ActionIcon = action.icon;
                        const starred = isFav(action);
                        const favItem: WorkspaceFavorite = {
                            menuKey: makeMenuKey(domainId, action.id),
                            id: action.id,
                            label: action.label,
                            route: action.route,
                            domainId,
                            domainLabel,
                            domainColor,
                        };
                        return (
                            <div key={action.id} className="relative group/chip inline-flex items-center">
                                <button
                                    onClick={(e) => { e.stopPropagation(); onNavigate(action.route, action.label); }}
                                    className={cn(
                                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full',
                                        'text-[10px] font-semibold transition-all duration-150',
                                        'bg-gray-50 dark:bg-gray-700/60 text-gray-600 dark:text-gray-300',
                                        'border border-gray-200 dark:border-gray-600/50',
                                        'hover:bg-gray-100 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-white',
                                        'hover:border-gray-300 dark:hover:border-gray-500',
                                        starred && 'border-yellow-300 dark:border-yellow-600/50',
                                    )}
                                >
                                    <ActionIcon className="w-2.5 h-2.5 shrink-0" />
                                    {action.label}
                                </button>
                                {onToggleFavorite && (
                                    <button
                                        onClick={(e) => { e.stopPropagation(); onToggleFavorite(favItem); }}
                                        title={starred ? 'Retirer des favoris' : 'Ajouter aux favoris'}
                                        className={cn(
                                            'ml-0.5 p-0.5 rounded-full flex-shrink-0',
                                            'opacity-0 group-hover/chip:opacity-100 transition-opacity duration-150',
                                            'hover:bg-gray-100 dark:hover:bg-gray-700',
                                        )}
                                    >
                                        <Star className={cn('w-2.5 h-2.5', starred ? 'fill-yellow-400 text-yellow-400' : 'text-gray-300')} />
                                    </button>
                                )}
                            </div>
                        );
                    })}
                    {!expanded && hiddenCount > 0 && (
                        <button
                            onClick={handleExpand}
                            className={cn(
                                'inline-flex items-center gap-1 px-2.5 py-1 rounded-full',
                                'text-[10px] font-semibold transition-all duration-150',
                                colors.bg, colors.text,
                                'border border-current/20',
                                'hover:opacity-80',
                            )}
                        >
                            +{hiddenCount} autres
                        </button>
                    )}
                    {expanded && hiddenCount > 0 && (
                        <button
                            onClick={(e) => { e.stopPropagation(); setExpanded(false); }}
                            className={cn(
                                'inline-flex items-center px-2.5 py-1 rounded-full',
                                'text-[10px] font-semibold transition-all duration-150',
                                'bg-gray-50 dark:bg-gray-700/60 text-gray-400 dark:text-gray-500',
                                'border border-gray-200 dark:border-gray-600/50',
                                'hover:bg-gray-100 hover:text-gray-700',
                            )}
                        >
                            Moins
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── AI Suggestion Strip ───────────────────────────────────────────────────────

const AI_SUGGESTIONS: Record<string, string[]> = {
    'dispatcher':     ['Bons de livraison du jour', 'Livreurs disponibles', 'Pénuries en cours'],
    'adv':            ['BCs en attente de validation', 'Clients avec dérogation', 'Limite crédit dépassée'],
    'magasinier':     ['Mes préparations du jour', 'Picking en retard', 'Transfert inter-dépôt'],
    'administration': ['Utilisateurs actifs', 'Audit des accès', 'Configuration système'],
};

const SectionLabel = ({ icon: Icon, label }: { icon: React.ElementType; label: string }) => (
    <div className="flex items-center gap-2 mb-4">
        <Icon className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-gray-400">
            {label}
        </span>
    </div>
);

const stagger = {
    hidden: {},
    show: { transition: { staggerChildren: 0.05, delayChildren: 0.05 } },
};
const fadeUp = {
    hidden: { opacity: 0, y: 10 },
    show:   { opacity: 1, y: 0, transition: { duration: 0.2 } },
};

// ─── Main Panel ───────────────────────────────────────────────────────────────

export const WorkspacePanel = ({ domain, onClose, onBack, favorites, onToggleFavorite }: WorkspacePanelProps) => {
    const navigate = useNavigate();
    const colors = DOMAIN_COLOR_MAP[domain.color];
    const recentPages = useRecentPages();
    const DomainIcon = domain.icon;

    const go = (route: string, label: string) => {
        trackRecentPage(route, label);
        navigate(route);
        onClose();
    };

    const quickActions: HubAction[] = domain.processes
        .map(p => p.actions[0])
        .filter(Boolean)
        .slice(0, 5);

    const aiSuggestions = AI_SUGGESTIONS[domain.id] ?? ['Aide', 'Rechercher'];
    const totalActions = domain.processes.reduce((sum, p) => sum + p.actions.length, 0);

    const isFav = (action: HubAction) =>
        !!favorites?.some(f => f.id === action.id && f.route === action.route);

    return (
        <div className="flex flex-col h-full select-none">

            {/* ── Header ───────────────────────────────────────────────── */}
            <div className={cn('shrink-0 px-7 py-5 flex items-center gap-4 border-b border-gray-100 dark:border-gray-800/60', colors.bg)}>
                <div className={cn('w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm shrink-0', colors.iconBg)}>
                    <DomainIcon className={cn('w-6 h-6', colors.text)} />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className={cn('text-base font-black uppercase tracking-wide', colors.text)}>
                        {domain.label}
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 leading-snug line-clamp-1">
                        {domain.description}
                    </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                    {onBack && (
                        <button
                            onClick={onBack}
                            aria-label="Retour aux domaines"
                            className={cn(
                                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold',
                                'text-gray-500 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-100',
                                'hover:bg-white/70 dark:hover:bg-gray-700 transition-colors',
                            )}
                        >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            Domaines
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        aria-label="Fermer"
                        className={cn(
                            'w-8 h-8 rounded-full flex items-center justify-center',
                            'text-gray-400 hover:text-gray-700 dark:hover:text-gray-100',
                            'hover:bg-white/70 dark:hover:bg-gray-700 transition-colors',
                        )}
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>
            </div>

            {/* ── Scrollable Body ───────────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto overflow-x-hidden">
                <motion.div
                    variants={stagger}
                    initial="hidden"
                    animate="show"
                    className="px-7 py-6 space-y-7"
                >

                    {/* ── Quick Actions ─────────────────────────────────── */}
                    {quickActions.length > 0 && (
                        <motion.section variants={fadeUp}>
                            <SectionLabel icon={Zap} label="Actions Rapides" />
                            <div
                                className="grid gap-3"
                                style={{ gridTemplateColumns: `repeat(${Math.min(quickActions.length, 5)}, 1fr)` }}
                            >
                                {quickActions.map(action => (
                                    <QuickActionCard
                                        key={action.id}
                                        action={action}
                                        colors={colors}
                                        onClick={() => go(action.route, action.label)}
                                        starred={isFav(action)}
                                        onStar={onToggleFavorite ? () => onToggleFavorite({
                                            menuKey: makeMenuKey(domain.id, action.id),
                                            id: action.id,
                                            label: action.label,
                                            route: action.route,
                                            domainId: domain.id,
                                            domainLabel: domain.label,
                                            domainColor: domain.color,
                                        }) : undefined}
                                    />
                                ))}
                            </div>
                        </motion.section>
                    )}

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* ── Process Cards ─────────────────────────────────── */}
                    <motion.section variants={fadeUp}>
                        <SectionLabel icon={Grid3x3} label="Processus Métier" />
                        <div className="grid grid-cols-2 gap-3">
                            {domain.processes.map(process => (
                                <ProcessCard
                                    key={process.id}
                                    process={process}
                                    colors={colors}
                                    onNavigate={go}
                                    domainId={domain.id}
                                    domainLabel={domain.label}
                                    domainColor={domain.color}
                                    favorites={favorites}
                                    onToggleFavorite={onToggleFavorite}
                                />
                            ))}
                        </div>
                    </motion.section>

                    <div className="h-px bg-gray-100 dark:bg-gray-800" />

                    {/* ── Bottom: Recent + Stats ─────────────────────────── */}
                    <motion.div variants={fadeUp} className="grid grid-cols-2 gap-5">
                        <section>
                            <SectionLabel icon={Clock} label="Reprendre" />
                            {recentPages.length === 0 ? (
                                <p className="text-xs text-gray-400 italic py-2">Aucun historique récent</p>
                            ) : (
                                <div className="space-y-0.5">
                                    {recentPages.slice(0, 4).map(page => (
                                        <button
                                            key={page.route + page.ts}
                                            onClick={() => go(page.route, page.label)}
                                            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group"
                                        >
                                            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', colors.badge)} />
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-300 group-hover:text-gray-900 dark:group-hover:text-white flex-1 truncate">
                                                {page.label}
                                            </span>
                                            <ChevronRight className="w-3 h-3 text-gray-300 dark:text-gray-600 shrink-0" />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </section>

                        <section>
                            <SectionLabel icon={Grid3x3} label="Statistiques" />
                            <div className="grid grid-cols-2 gap-2.5">
                                <div className={cn('rounded-2xl px-3 py-4 text-center', colors.bg)}>
                                    <p className={cn('text-3xl font-black leading-none', colors.text)}>
                                        {domain.processes.length}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-semibold mt-1.5 uppercase tracking-wide">
                                        Processus
                                    </p>
                                </div>
                                <div className={cn('rounded-2xl px-3 py-4 text-center', colors.bg)}>
                                    <p className={cn('text-3xl font-black leading-none', colors.text)}>
                                        {totalActions}
                                    </p>
                                    <p className="text-[10px] text-gray-500 font-semibold mt-1.5 uppercase tracking-wide">
                                        Actions
                                    </p>
                                </div>
                            </div>
                        </section>
                    </motion.div>

                    {/* ── AI Assistant ──────────────────────────────────── */}
                    <motion.section variants={fadeUp}>
                        <div className={cn('rounded-2xl p-5 border', colors.bg, colors.border)}>
                            <div className="flex items-center gap-2 mb-3">
                                <Sparkles className="w-4 h-4 text-violet-500" />
                                <span className="text-xs font-bold text-gray-700 dark:text-gray-200">
                                    Demandez à Omni
                                </span>
                            </div>
                            <div className="flex flex-wrap gap-2">
                                {aiSuggestions.map(suggestion => (
                                    <button
                                        key={suggestion}
                                        onClick={() => {
                                            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));
                                            onClose();
                                        }}
                                        className={cn(
                                            'text-[11px] px-3 py-1.5 rounded-full font-medium transition-all duration-150',
                                            'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300',
                                            'border border-gray-200 dark:border-gray-600',
                                            'hover:border-violet-300 hover:text-violet-700 dark:hover:border-violet-500 dark:hover:text-violet-300',
                                            'hover:bg-violet-50 dark:hover:bg-violet-950/20',
                                        )}
                                    >
                                        &ldquo;{suggestion}&rdquo;
                                    </button>
                                ))}
                            </div>
                        </div>
                    </motion.section>

                    <div className="h-5" />
                </motion.div>
            </div>
        </div>
    );
};
