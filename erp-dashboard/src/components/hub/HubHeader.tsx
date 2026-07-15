import { Search, Calendar, Sparkles } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getGreeting } from '@/lib/hub/hubUtils';
import type { User } from '@/context/AuthContext';

interface HubHeaderProps {
    user: User | null;
    onOpenSearch: () => void;
    className?: string;
}

function formatDate(): string {
    return new Date().toLocaleDateString('fr-FR', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
    });
}

const SEARCH_HINTS = [
    'créer commande',
    'facture 25001',
    'client Atlas',
    'stock produit',
    'livraisons du jour',
    'valider BC',
];

export const HubHeader = ({ user, onOpenSearch, className }: HubHeaderProps) => {
    const greeting = getGreeting(user?.name);
    const dateStr = formatDate();
    // Capitalize first letter of day
    const formattedDate = dateStr.charAt(0).toUpperCase() + dateStr.slice(1);

    return (
        <div className={cn('space-y-5', className)}>
            {/* Greeting Row */}
            <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="flex items-start justify-between flex-wrap gap-3"
            >
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white tracking-tight">
                        {greeting}
                    </h1>
                    <div className="flex items-center gap-1.5 mt-1 text-sm text-gray-500 dark:text-gray-400">
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{formattedDate}</span>
                    </div>
                </div>

                {/* AI hint pill */}
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-900/20 dark:to-indigo-900/20 border border-violet-100 dark:border-violet-800/30">
                    <Sparkles className="w-3.5 h-3.5 text-violet-500" />
                    <span className="text-xs font-medium text-violet-700 dark:text-violet-300">
                        Assistant IA disponible
                    </span>
                </div>
            </motion.div>

            {/* Universal Search Bar */}
            <motion.button
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                onClick={onOpenSearch}
                className={cn(
                    'w-full flex items-center gap-3 px-4 py-3.5 rounded-xl',
                    'bg-white dark:bg-gray-900',
                    'border border-gray-200 dark:border-gray-700',
                    'shadow-sm hover:shadow-md',
                    'hover:border-sage-400 dark:hover:border-sage-600',
                    'transition-all duration-200 group',
                    'text-left'
                )}
                aria-label="Ouvrir la recherche universelle"
            >
                <Search className="w-5 h-5 text-gray-400 group-hover:text-sage-500 transition-colors shrink-0" />
                <span className="flex-1 text-sm text-gray-400 dark:text-gray-500 font-medium">
                    Rechercher — essayez &ldquo;{SEARCH_HINTS[Math.floor(Date.now() / 10000) % SEARCH_HINTS.length]}&rdquo;
                </span>
                <div className="flex items-center gap-1 shrink-0">
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        ⌘
                    </kbd>
                    <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-[11px] font-mono text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-gray-700">
                        K
                    </kbd>
                </div>
            </motion.button>
        </div>
    );
};
