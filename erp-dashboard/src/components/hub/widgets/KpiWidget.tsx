import { ArrowUpRight, ArrowDownRight, Minus, Loader2 } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export type KpiColor = 'blue' | 'emerald' | 'amber' | 'red' | 'sage' | 'violet' | 'orange' | 'indigo';
export type KpiTrend = 'up' | 'down' | 'neutral';

interface KpiWidgetProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon: LucideIcon;
    color?: KpiColor;
    trend?: KpiTrend;
    trendLabel?: string;
    loading?: boolean;
    onClick?: () => void;
    className?: string;
}

const COLOR_MAP: Record<KpiColor, { icon: string; iconBg: string; badge: string }> = {
    blue:    { icon: 'text-blue-600 dark:text-blue-400',    iconBg: 'bg-blue-50 dark:bg-blue-900/20',    badge: 'bg-blue-500' },
    emerald: { icon: 'text-emerald-600 dark:text-emerald-400', iconBg: 'bg-emerald-50 dark:bg-emerald-900/20', badge: 'bg-emerald-500' },
    amber:   { icon: 'text-amber-600 dark:text-amber-400',  iconBg: 'bg-amber-50 dark:bg-amber-900/20',  badge: 'bg-amber-500' },
    red:     { icon: 'text-red-600 dark:text-red-400',      iconBg: 'bg-red-50 dark:bg-red-900/20',      badge: 'bg-red-500' },
    sage:    { icon: 'text-sage-600 dark:text-sage-400',    iconBg: 'bg-sage-50 dark:bg-sage-900/20',    badge: 'bg-sage-500' },
    violet:  { icon: 'text-violet-600 dark:text-violet-400', iconBg: 'bg-violet-50 dark:bg-violet-900/20', badge: 'bg-violet-500' },
    orange:  { icon: 'text-orange-600 dark:text-orange-400', iconBg: 'bg-orange-50 dark:bg-orange-900/20', badge: 'bg-orange-500' },
    indigo:  { icon: 'text-indigo-600 dark:text-indigo-400', iconBg: 'bg-indigo-50 dark:bg-indigo-900/20', badge: 'bg-indigo-500' },
};

const TREND_MAP: Record<KpiTrend, { icon: React.FC<{ className?: string }>; text: string }> = {
    up:      { icon: ArrowUpRight,   text: 'text-emerald-600 dark:text-emerald-400' },
    down:    { icon: ArrowDownRight, text: 'text-red-500 dark:text-red-400' },
    neutral: { icon: Minus,          text: 'text-gray-400' },
};

export const KpiWidget = ({
    title,
    value,
    subtitle,
    icon: Icon,
    color = 'sage',
    trend,
    trendLabel,
    loading = false,
    onClick,
    className,
}: KpiWidgetProps) => {
    const colors = COLOR_MAP[color];
    const trendInfo = trend ? TREND_MAP[trend] : null;
    const TrendIcon = trendInfo?.icon;

    return (
        <div
            className={cn(
                'bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm',
                'transition-all duration-200',
                onClick && 'cursor-pointer hover:shadow-md hover:-translate-y-0.5',
                className
            )}
            onClick={onClick}
        >
            <div className="flex items-start justify-between mb-4">
                <div className={cn('p-2.5 rounded-lg', colors.iconBg)}>
                    <Icon className={cn('w-5 h-5', colors.icon)} />
                </div>
                {trendInfo && trendLabel && TrendIcon && (
                    <span className={cn('flex items-center gap-0.5 text-xs font-semibold', trendInfo.text)}>
                        <TrendIcon className="w-3.5 h-3.5" />
                        {trendLabel}
                    </span>
                )}
            </div>

            {loading ? (
                <div className="space-y-2">
                    <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-24" />
                    <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-32" />
                </div>
            ) : (
                <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 leading-tight tabular-nums">
                        {value}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 font-medium">{title}</p>
                    {subtitle && (
                        <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{subtitle}</p>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Skeleton Loader ──────────────────────────────────────────────────────────

export const KpiWidgetSkeleton = () => (
    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-100 dark:border-gray-800 p-5 shadow-sm">
        <div className="flex items-start justify-between mb-4">
            <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 animate-pulse" />
        </div>
        <div className="flex items-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 text-gray-300 animate-spin" />
        </div>
        <div className="h-8 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-20 mb-2" />
        <div className="h-4 bg-gray-100 dark:bg-gray-800 rounded animate-pulse w-28" />
    </div>
);
