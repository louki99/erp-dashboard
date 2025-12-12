import React, { useState, useEffect } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SageCollapsibleProps {
    title: string;
    defaultOpen?: boolean;
    isOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
    children: React.ReactNode;
    className?: string;
}

export const SageCollapsible: React.FC<SageCollapsibleProps> = ({
    title,
    defaultOpen = false,
    isOpen: controlledIsOpen,
    onOpenChange,
    children,
    className
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
        <div className={cn("bg-white border border-gray-200 shadow-sm rounded-sm mb-3 overflow-hidden", className)}>
            <button
                onClick={handleToggle}
                className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors border-b border-transparent data-[open=true]:border-gray-100"
                data-open={currentIsOpen}
            >
                <span className="font-bold text-gray-800 text-sm">{title}</span>
                {currentIsOpen ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                ) : (
                    <ChevronDown className="w-4 h-4 text-gray-500 -rotate-90" />
                )}
            </button>

            {currentIsOpen && (
                <div className="p-4 bg-white animate-in slide-in-from-top-1 duration-200">
                    {children}
                </div>
            )}
        </div>
    );
};
