import React from 'react';
import Split from 'react-split';
import { cn } from '@/lib/utils'; // Assuming cn utility exists, usually standard in shadcn setups. If not, I will add it or remove it.

interface MasterLayoutProps {
    leftContent: React.ReactNode;
    mainContent: React.ReactNode;
    rightContent?: React.ReactNode;
    className?: string;
}

export const MasterLayout: React.FC<MasterLayoutProps> = ({
    leftContent,
    mainContent,
    rightContent,
    className,
}) => {
    return (
        <div className={cn("h-screen w-full flex flex-col bg-slate-50 overflow-hidden", className)}>
            {/* Top Bar - Sage X3 Style Helper */}
            <header className="h-12 bg-[#2a2a2a] text-white flex items-center px-4 justify-between shrink-0 shadow-sm z-10">
                <div className="flex items-center gap-4">
                    <span className="font-bold text-lg text-[#00b06b]">Sage</span>
                    <span className="font-semibold text-gray-300">X3</span>
                </div>
                <div className="text-sm text-gray-400">
                    Master Layout Demo
                </div>
            </header>

            {/* Main Split Content */}
            <div className="flex-1 overflow-hidden relative">
                <Split
                    className="flex h-full w-full"
                    sizes={rightContent ? [20, 60, 20] : [25, 75]}
                    minSize={[200, 400, 50]}
                    gutterSize={6}
                    snapOffset={30}
                    dragInterval={1}
                    direction="horizontal"
                    cursor="col-resize"
                >
                    {/* LEFT PANE: Data/List */}
                    <div className="h-full overflow-hidden bg-white border-r border-gray-200 flex flex-col">
                        {leftContent}
                    </div>

                    {/* MIDDLE PANE: Details */}
                    <div className="h-full overflow-y-auto bg-slate-50 flex flex-col">
                        {mainContent}
                    </div>

                    {/* RIGHT PANE: Actions (Optional) */}
                    {rightContent && (
                        <div className="h-full overflow-y-auto bg-white border-l border-gray-200 shadow-[-4px_0_15px_-3px_rgba(0,0,0,0.05)] z-0">
                            {rightContent}
                        </div>
                    )}
                </Split>
            </div>
        </div>
    );
};
