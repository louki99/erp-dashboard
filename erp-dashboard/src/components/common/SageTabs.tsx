import React from 'react';
import { cn } from '@/lib/utils';
import { Home } from 'lucide-react';

export interface TabItem {
    id: string;
    label: string;
    icon?: React.ElementType;
}

interface SageTabsProps {
    tabs: TabItem[];
    activeTabId: string;
    onTabChange: (id: string) => void;
    onExpandAll?: () => void;
    onCollapseAll?: () => void;
    className?: string;
}

import { ChevronsDown, ChevronsUp } from 'lucide-react';

export const SageTabs: React.FC<SageTabsProps> = ({
    tabs,
    activeTabId,
    onTabChange,
    onExpandAll,
    onCollapseAll,
    className
}) => {
    const scrollContainerRef = React.useRef<HTMLDivElement>(null);
    const [showLeftShadow, setShowLeftShadow] = React.useState(false);
    const [showRightShadow, setShowRightShadow] = React.useState(false);

    // Check scroll position to show/hide shadows
    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const scrollLeft = container.scrollLeft;
        const scrollWidth = container.scrollWidth;
        const clientWidth = container.clientWidth;

        setShowLeftShadow(scrollLeft > 10);
        setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
    };

    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;

        // Initial check
        handleScroll();

        container.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);

        return () => {
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [tabs]);

    // Auto-scroll to active tab
    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const activeButton = container.querySelector(`button[data-tab-id="${activeTabId}"]`);
        if (activeButton) {
            activeButton.scrollIntoView({
                behavior: 'smooth',
                block: 'nearest',
                inline: 'center'
            });
        }
    }, [activeTabId]);

    return (
        <div className={cn("relative flex items-end justify-between border-b border-gray-300 bg-[#f5f6f7] pt-2 px-2 min-w-0", className)}>
            {/* Scroll Container with Shadows */}
            <div className="relative flex-1 overflow-hidden">
                {/* Left Shadow */}
                {showLeftShadow && (
                    <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#f5f6f7] via-[#f5f6f7]/80 to-transparent z-10 pointer-events-none" />
                )}

                {/* Tabs Scroll Area */}
                <div
                    ref={scrollContainerRef}
                    className="flex items-end overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {/* Home Tab */}
                    <button
                        data-tab-id="home"
                        onClick={() => onTabChange('home')}
                        className={cn(
                            "flex items-center justify-center p-2 sm:p-2.5 rounded-t-[4px] border-t border-r border-l border-transparent mb-[-1px] relative mr-1 min-w-[40px] sm:min-w-[44px] shrink-0 snap-start transition-all duration-200",
                            activeTabId === 'home'
                                ? "bg-white border-gray-300 text-primary after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[3px] after:bg-primary z-10 shadow-sm"
                                : "text-gray-500 hover:bg-gray-200 hover:text-gray-700"
                        )}
                    >
                        <Home className="w-4 h-4" />
                    </button>

                    {/* Regular Tabs */}
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            data-tab-id={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={cn(
                                "px-3 sm:px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-semibold rounded-t-[4px] border-t border-r border-l border-transparent mb-[-1px] relative whitespace-nowrap transition-all duration-200 snap-start",
                                activeTabId === tab.id
                                    ? "bg-white border-gray-300 text-gray-900 after:content-[''] after:absolute after:bottom-0 after:left-0 after:w-full after:h-[3px] after:bg-primary z-10 shadow-sm"
                                    : "text-gray-600 hover:bg-gray-200 hover:text-gray-800"
                            )}
                        >
                            {tab.icon && <tab.icon className="w-4 h-4 mr-2 inline-block" />}
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Right Shadow */}
                {showRightShadow && (
                    <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#f5f6f7] via-[#f5f6f7]/80 to-transparent z-10 pointer-events-none" />
                )}
            </div>

            {/* Action Buttons */}
            {(onExpandAll || onCollapseAll) && (
                <div className="flex items-center gap-1 pl-2 pb-1.5 ml-2 shrink-0 border-l border-gray-300/50">
                    {onExpandAll && (
                        <button
                            onClick={onExpandAll}
                            className="p-1.5 sm:p-2 text-gray-500 hover:text-primary hover:bg-white rounded-md transition-colors touch-manipulation"
                            title="Tout développer"
                        >
                            <ChevronsDown className="w-4 h-4" />
                        </button>
                    )}
                    {onCollapseAll && (
                        <button
                            onClick={onCollapseAll}
                            className="p-1.5 sm:p-2 text-gray-500 hover:text-primary hover:bg-white rounded-md transition-colors touch-manipulation"
                            title="Tout réduire"
                        >
                            <ChevronsUp className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
