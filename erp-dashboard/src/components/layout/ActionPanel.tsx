import React from 'react';
import { Settings, Printer, Download, Trash, Edit, Plus, ArrowRight, FileText, Share2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ActionGroupProps {
    title: string;
    children: React.ReactNode;
}

const ActionGroup = ({ title, children }: ActionGroupProps) => (
    <div className="mb-6">
        <h3 className="px-4 py-2 text-xs font-bold text-gray-500 uppercase tracking-wider bg-gray-50 border-y border-gray-100 mb-2">
            {title}
        </h3>
        <div className="flex flex-col">
            {children}
        </div>
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
        default: "text-gray-600 hover:bg-gray-50 hover:text-black",
        danger: "text-red-500 hover:bg-red-50 hover:text-red-700",
        primary: "text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700"
    };

    return (
        <button
            onClick={onClick}
            className={cn(
                "w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors text-left",
                colors[variant]
            )}
        >
            <Icon className="w-4 h-4 shrink-0" />
            <span className="truncate">{label}</span>
        </button>
    );
};

export const ActionPanel = () => {
    return (
        <div className="flex flex-col py-0 min-h-full bg-white">
            <div className="p-4 border-b border-gray-100">
                <h2 className="text-sm font-semibold text-gray-900">Actions</h2>
            </div>

            <ActionGroup title="Main Operations">
                <ActionItem icon={Plus} label="New Record" variant="primary" />
                <ActionItem icon={Edit} label="Edit Record" />
                <ActionItem icon={Trash} label="Delete" variant="danger" />
            </ActionGroup>

            <ActionGroup title="Reports & Output">
                <ActionItem icon={Printer} label="Print Record" />
                <ActionItem icon={Download} label="Export PDF" />
                <ActionItem icon={FileText} label="Detailed Log" />
            </ActionGroup>

            <ActionGroup title="Workflow">
                <ActionItem icon={ArrowRight} label="Submit for Approval" />
                <ActionItem icon={Share2} label="Assign to User" />
            </ActionGroup>

            <ActionGroup title="Simulation">
                <ActionItem icon={Settings} label="Debug View" />
            </ActionGroup>
        </div>
    );
};
