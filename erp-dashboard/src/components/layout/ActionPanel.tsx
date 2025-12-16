import React from 'react';
import { Settings, Printer, Download, Trash, Edit, Plus, Share2, Copy, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';

const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 py-3 border-b border-gray-100 dark:border-gray-800 last:border-0 relative">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger' | 'primary' | 'sage';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800",
        danger: "text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/10",
        primary: "text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/10",
        sage: "text-sage-500 hover:text-sage-700 dark:text-sage-400 dark:hover:text-sage-200 hover:bg-sage-50 dark:hover:bg-sage-900/20"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={cn(
                "group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto",
                disabled ? 'opacity-30 cursor-not-allowed' : variants[variant]
            )}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />

            {/* Tooltip - Left Side */}
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900"></span>
            </span>
        </button>
    );
};

export interface ActionPanelGroup {
    items: ActionItemProps[];
}

export interface ActionPanelProps {
    groups?: ActionPanelGroup[];
}

const DEFAULT_GROUPS: ActionPanelGroup[] = [
    {
        items: [
            { icon: Plus, label: 'New Record', variant: 'sage' },
            { icon: Edit, label: 'Edit Record', variant: 'default' },
            { icon: Copy, label: 'Duplicate', variant: 'default' },
        ],
    },
    {
        items: [
            { icon: Printer, label: 'Print Record', variant: 'default' },
            { icon: Download, label: 'Export PDF', variant: 'default' },
            { icon: Share2, label: 'Assign / Share', variant: 'primary' },
        ],
    },
    {
        items: [
            { icon: Archive, label: 'Archive', variant: 'default' },
            { icon: Trash, label: 'Delete', variant: 'danger' },
        ],
    },
    {
        items: [{ icon: Settings, label: 'Settings', variant: 'default' }],
    },
];

export const ActionPanel = ({ groups }: ActionPanelProps) => {
    const resolvedGroups = groups && groups.length > 0 ? groups : DEFAULT_GROUPS;

    return (
        <div className="flex flex-col h-full bg-white dark:bg-black border-l border-gray-200 dark:border-gray-800 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-50 transition-all duration-300">
            {resolvedGroups.map((group, idx) => (
                <ActionGroup key={idx}>
                    {idx === 0 && (
                        <div className="w-full flex justify-center mb-1">
                            <div className="w-6 h-0.5 bg-sage-500 rounded-full opacity-50"></div>
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
                </ActionGroup>
            ))}
        </div>
    );
};
