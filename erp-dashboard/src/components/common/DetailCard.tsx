import { cn } from '@/lib/utils';
import type { LucideIcon } from 'lucide-react';

interface DetailCardProps {
    title: string;
    icon?: LucideIcon;
    children: React.ReactNode;
    className?: string;
    accent?: 'default' | 'blue' | 'green' | 'amber' | 'red' | 'sage';
}

const accentClasses: Record<string, string> = {
    default: 'border-gray-200',
    blue: 'border-blue-200 bg-blue-50/30',
    green: 'border-emerald-200 bg-emerald-50/30',
    amber: 'border-amber-200 bg-amber-50/30',
    red: 'border-red-200 bg-red-50/30',
    sage: 'border-sage-200 bg-sage-50/30',
};

export function DetailCard({ title, icon: Icon, children, className, accent = 'default' }: DetailCardProps) {
    return (
        <div className={cn('rounded-xl border bg-white shadow-sm overflow-hidden', accentClasses[accent], className)}>
            <div className="flex items-center gap-2 border-b border-inherit bg-white/60 px-4 py-2.5">
                {Icon && <Icon className="h-4 w-4 text-gray-500" />}
                <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-600">{title}</h3>
            </div>
            <div className="p-4">{children}</div>
        </div>
    );
}
