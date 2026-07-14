import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SageCollapsibleProps {
    title: string;
    defaultOpen?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    className?: string;
    rightContent?: React.ReactNode;
}

export const SageCollapsible: React.FC<SageCollapsibleProps> = ({
    title,
    defaultOpen = false,
    isOpen: controlledIsOpen,
    onOpenChange,
    children,
    className,
    rightContent,
}) => {
    const [internalIsOpen, setInternalIsOpen] = useState(defaultOpen);

    const isControlled = controlledIsOpen !== undefined;
    const currentIsOpen = isControlled ? controlledIsOpen : internalIsOpen;

    const handleToggle = () => {
        if (isControlled) {
            onOpenChange?.(!controlledIsOpen);
        } else {
            setInternalIsOpen(!internalIsOpen);
        }
    };

    return (
        <div className={cn("bg-white border border-gray-200 shadow-sm rounded-lg overflow-hidden", className)}>
            <button
                onClick={handleToggle}
                className={cn(
                    "w-full flex items-center justify-between px-4 py-3 transition-colors border-b",
                    currentIsOpen ? "bg-gray-50/60 border-gray-100" : "bg-white border-transparent hover:bg-gray-50"
                )}
            >
                <div className="flex items-center gap-2">
                    <ChevronDown className={cn(
                        "w-4 h-4 text-gray-400 transition-transform duration-200 shrink-0",
                        !currentIsOpen && "-rotate-90"
                    )} />
                    <span className="font-semibold text-gray-800 text-sm">{title}</span>
                </div>
                {rightContent}
            </button>

            {currentIsOpen && (
                <div className="p-4 bg-white animate-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};
