import React from 'react';
import { Settings, Printer, Download, Trash, Edit, Plus, ArrowRight, FileText, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';



const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-2 py-4 border-b border-gray-100 last:border-0">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'danger' | 'primary';
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default' }: ActionItemProps) => {
    const colors = {
        default: "text-gray-500 hover:bg-gray-100 hover:text-gray-900",
        danger: "text-gray-500 hover:bg-red-50 hover:text-red-600",
        primary: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
    };

    return (
        <button
            onClick={onClick}
            title={label}
            className={cn(
                "w-10 h-10 flex items-center justify-center rounded-lg transition-colors mx-auto",
                colors[variant]
            )}
        >
            <Icon className="w-5 h-5" />
            <span className="sr-only">{label}</span>
        </button>
    );
};

export const ActionPanel = () => {
    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-14 shrink-0 shadow-sm z-20">
            <ActionGroup>
                <ActionItem icon={Plus} label="New Record" variant="primary" />
                <ActionItem icon={Edit} label="Edit Record" />
                <ActionItem icon={Trash} label="Delete" variant="danger" />
            </ActionGroup>

            <ActionGroup>
                <ActionItem icon={Printer} label="Print Record" />
                <ActionItem icon={Download} label="Export PDF" />
                <ActionItem icon={FileText} label="Detailed Log" />
            </ActionGroup>

            <ActionGroup>
                <ActionItem icon={ArrowRight} label="Submit for Approval" />
                <ActionItem icon={Share2} label="Assign to User" />
            </ActionGroup>

            <ActionGroup>
                <ActionItem icon={Settings} label="Debug View" />
            </ActionGroup>
        </div>
    );
};
