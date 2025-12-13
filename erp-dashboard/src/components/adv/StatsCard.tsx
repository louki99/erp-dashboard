import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';


interface StatsCardProps {
    label: string;
    value: string | number;
    icon: LucideIcon;
    trend?: 'up' | 'down' | 'neutral';
    change?: string;
    color?: 'blue' | 'emerald' | 'amber' | 'red' | 'sage';
    className?: string;
}

const colorVariants = {
    blue: {
        icon: 'text-blue-600 dark:text-blue-400',
        bg: 'bg-blue-50 dark:bg-blue-900/20',
    },
    emerald: {
        icon: 'text-emerald-600 dark:text-emerald-400',
        bg: 'bg-emerald-50 dark:bg-emerald-900/20',
    },
    amber: {
        icon: 'text-amber-600 dark:text-amber-400',
        bg: 'bg-amber-50 dark:bg-amber-900/20',
    },
    red: {
        icon: 'text-red-600 dark:text-red-400',
        bg: 'bg-red-50 dark:bg-red-900/20',
    },
    sage: {
        icon: 'text-sage-600 dark:text-sage-400',
        bg: 'bg-sage-50 dark:bg-sage-900/20',
    },
};

/**
 * Reusable statistics card component for ADV module
 * Displays KPI with icon, value, label, and optional trend indicator
 */
export const StatsCard = ({
    label,
    value,
    icon: Icon,
    trend = 'neutral',
    change,
    color = 'blue',
    className,
}: StatsCardProps) => {
    const variant = colorVariants[color];

    return (
        <div className={cn(
            'bg-white dark:bg-gray-800 p-6 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md transition-all duration-200',
            className
        )}>
            <div className="flex justify-between items-start mb-4">
                <div className={cn('p-3 rounded-lg', variant.bg)}>
                    <Icon className={cn('w-6 h-6', variant.icon)} />
                </div>
                {change && (
                    <span className="text-xs font-medium px-2 py-1 rounded-full text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                        {change}
                    </span>
                )}
            </div>
            <div className="space-y-1">
                <h3 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
                    {value}
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {label}
                </p>
            </div>
        </div>
    );
};
