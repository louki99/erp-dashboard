import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import type { QuickAction } from '@/lib/hub/hubData';

interface QuickActionsBarProps {
    actions: QuickAction[];
    className?: string;
}

export const QuickActionsBar = ({ actions, className }: QuickActionsBarProps) => {
    const navigate = useNavigate();

    if (!actions.length) return null;

    return (
        <div className={cn('', className)}>
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-3">
                Actions rapides
            </p>
            <div className="flex flex-wrap gap-2">
                {actions.map((action, i) => {
                    const Icon = action.icon;
                    return (
                        <motion.button
                            key={action.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 0.2, delay: i * 0.04 }}
                            onClick={() => navigate(action.route)}
                            className={cn(
                                'flex items-center gap-2 px-4 py-2.5 rounded-xl',
                                'bg-white dark:bg-gray-900',
                                'border border-gray-200 dark:border-gray-700',
                                'shadow-sm hover:shadow-md',
                                'text-sm font-semibold text-gray-700 dark:text-gray-200',
                                'hover:text-gray-900 dark:hover:text-white',
                                'hover:-translate-y-0.5 hover:border-gray-300 dark:hover:border-gray-600',
                                'transition-all duration-200 group'
                            )}
                        >
                            <span className={cn(
                                'w-6 h-6 rounded-lg flex items-center justify-center shrink-0',
                                action.color,
                                'group-hover:scale-110 transition-transform'
                            )}>
                                <Icon className="w-3.5 h-3.5 text-white" />
                            </span>
                            {action.label}
                        </motion.button>
                    );
                })}
            </div>
        </div>
    );
};
