import React from 'react';
import { cn } from '@/lib/utils';
import { Home, ChevronsDown, ChevronsUp } from 'lucide-react';

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

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const { scrollLeft, scrollWidth, clientWidth } = container;
        setShowLeftShadow(scrollLeft > 10);
        setShowRightShadow(scrollLeft < scrollWidth - clientWidth - 10);
    };

    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        handleScroll();
        container.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleScroll);
        return () => {
            container.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleScroll);
        };
    }, [tabs]);

    React.useEffect(() => {
        const container = scrollContainerRef.current;
        if (!container) return;
        const activeButton = container.querySelector(`button[data-tab-id="${activeTabId}"]`);
        if (activeButton) {
            activeButton.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        }
    }, [activeTabId]);

    const renderTab = (tab: TabItem, isHome = false) => {
        const isActive = activeTabId === tab.id;
        return (
            <button
                type="button"
                key={tab.id}
                data-tab-id={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={cn(
                    'relative flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold rounded-t-md border-t border-x border-transparent mb-[-1px] transition-all duration-200 whitespace-nowrap snap-start',
                    isActive
                        ? 'bg-white border-gray-200 text-sage-700 shadow-sm z-10'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-700',
                    isHome && 'px-3'
                )}
            >
                {tab.icon && <tab.icon className={cn('w-3.5 h-3.5', isActive ? 'text-sage-600' : 'text-gray-400')} />}
                {!isHome && tab.label}
                {isActive && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2.5px] bg-sage-500 rounded-t-full" />
                )}
            </button>
        );
    };

    return (
        <div className={cn("relative flex items-end justify-between border-b border-gray-200 bg-[#f8f9fa] pt-2 px-2 min-w-0", className)}>
            <div className="relative flex-1 overflow-hidden">
                {showLeftShadow && (
                    <div className="absolute left-0 top-0 bottom-0 w-10 bg-gradient-to-r from-[#f8f9fa] via-[#f8f9fa]/80 to-transparent z-10 pointer-events-none" />
                )}

                <div
                    ref={scrollContainerRef}
                    className="flex items-end overflow-x-auto no-scrollbar scroll-smooth snap-x snap-mandatory"
                    style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                >
                    {renderTab({ id: 'home', label: '', icon: Home }, true)}
                    {tabs.map((tab) => renderTab(tab))}
                </div>

                {showRightShadow && (
                    <div className="absolute right-0 top-0 bottom-0 w-10 bg-gradient-to-l from-[#f8f9fa] via-[#f8f9fa]/80 to-transparent z-10 pointer-events-none" />
                )}
            </div>

            {(onExpandAll || onCollapseAll) && (
                <div className="flex items-center gap-1 pl-2 pb-1.5 ml-2 shrink-0 border-l border-gray-200/60">
                    {onExpandAll && (
                        <button
                            type="button"
                            onClick={onExpandAll}
                            className="p-1.5 text-gray-500 hover:text-sage-600 hover:bg-white rounded-md transition-colors"
                            title="Expand all"
                        >
                            <ChevronsDown className="w-4 h-4" />
                        </button>
                    )}
                    {onCollapseAll && (
                        <button
                            type="button"
                            onClick={onCollapseAll}
                            className="p-1.5 text-gray-500 hover:text-sage-600 hover:bg-white rounded-md transition-colors"
                            title="Collapse all"
                        >
                            <ChevronsUp className="w-4 h-4" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};
