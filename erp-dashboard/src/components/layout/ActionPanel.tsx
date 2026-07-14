import React from 'react';
import { cn } from '@/lib/utils';

export interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger' | 'primary' | 'sage' | 'success' | 'warning';
    disabled?: boolean;
}

export interface ActionPanelGroup {
    items: ActionItemProps[];
}

export interface ActionPanelProps {
    groups?: ActionPanelGroup[];
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: 'text-gray-500 hover:text-gray-700 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-200 dark:hover:bg-gray-800',
        primary: 'text-blue-600 hover:text-blue-700 hover:bg-blue-50 dark:hover:bg-blue-900/20',
        sage: 'text-sage-600 hover:text-sage-700 hover:bg-sage-50 dark:hover:bg-sage-900/20',
        success: 'text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-900/20',
        warning: 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20',
        danger: 'text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20',
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                'group relative w-10 h-10 flex items-center justify-center rounded-xl transition-all duration-200 mx-auto shadow-sm border border-gray-100 hover:shadow-md',
                disabled ? 'opacity-30 cursor-not-allowed' : variants[variant]
            )}
            title={label}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />

            {/* Tooltip - Left Side */}
            <span className="absolute right-full mr-3 top-1/2 -translate-y-1/2 px-2.5 py-1 bg-gray-900 text-white text-[11px] font-medium rounded-md opacity-0 group-hover:opacity-100 transition-all whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900" />
            </span>
        </button>
    );
};

export const ActionPanel = ({ groups }: ActionPanelProps) => {
    if (!groups || groups.length === 0) {
        return (
            <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-14 shrink-0 z-50" />
        );
    }

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-14 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-50 transition-all duration-300">
            {groups.map((group, idx) => (
                <div
                    key={idx}
                    className="flex flex-col gap-2 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 relative"
                >
                    {idx === 0 && (
                        <div className="w-full flex justify-center mb-1">
                            <div className="w-5 h-0.5 bg-sage-500 rounded-full opacity-60" />
                        </div>
                    )}
                    {group.items.map((item) => (
                        <ActionItem
                            key={item.label}
                            icon={item.icon}
                            label={item.label}
                            onClick={item.onClick}
                            variant={item.variant}
                            disabled={item.disabled}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
};
