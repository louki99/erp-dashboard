import { ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { BusinessDomain } from '@/lib/hub/hubData';
import { DOMAIN_COLOR_MAP } from '@/lib/hub/hubData';

interface DomainCardProps {
    domain: BusinessDomain;
    isActive?: boolean;
    onHover?: (domainId: string | null) => void;
    className?: string;
}

export const DomainCard = ({ domain, isActive, onHover, className }: DomainCardProps) => {
    const navigate = useNavigate();
    const colors = DOMAIN_COLOR_MAP[domain.color];
    const Icon = domain.icon;
    const processCount = domain.processes.length;
    const firstRoute = domain.processes[0]?.route ?? '/dashboard';

    return (
        <motion.div
            whileHover={{ y: -3, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
            transition={{ duration: 0.18 }}
            onHoverStart={() => onHover?.(domain.id)}
            onHoverEnd={() => onHover?.(null)}
            onClick={() => navigate(firstRoute)}
            className={cn(
                'relative bg-white dark:bg-gray-900 rounded-xl border cursor-pointer',
                'transition-colors duration-200 p-5 group overflow-hidden',
                isActive
                    ? `${colors.border} shadow-md`
                    : 'border-gray-100 dark:border-gray-800 shadow-sm hover:border-gray-200 dark:hover:border-gray-700',
                className
            )}
        >
            {/* Background accent on active */}
            {isActive && (
                <div className={cn('absolute inset-0 opacity-[0.04] pointer-events-none', colors.bg)} />
            )}

            {/* Icon */}
            <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center mb-4 transition-transform group-hover:scale-105', colors.iconBg)}>
                <Icon className={cn('w-5 h-5', colors.text)} />
            </div>

            {/* Label & Description */}
            <h3 className="font-bold text-sm text-gray-900 dark:text-white mb-1 leading-tight">
                {domain.label}
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2 mb-3">
                {domain.description}
            </p>

            {/* Footer */}
            <div className="flex items-center justify-between">
                <span className={cn(
                    'text-xs font-semibold px-2 py-0.5 rounded-full',
                    colors.bg, colors.text,
                )}>
                    {processCount} process{processCount > 1 ? 'us' : ''}
                </span>
                <ChevronRight className={cn(
                    'w-3.5 h-3.5 transition-all duration-200',
                    'text-gray-300 group-hover:text-gray-500 dark:group-hover:text-gray-300',
                    'group-hover:translate-x-0.5'
                )} />
            </div>
        </motion.div>
    );
};
