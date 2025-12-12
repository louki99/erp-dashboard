import React, { useState } from 'react';
import Split from 'react-split';
import { cn } from '@/lib/utils';
import { Search, Compass, Star, HelpCircle, Calendar, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2 } from 'lucide-react';
import { MegaMenu } from './MegaMenu';

interface MasterLayoutProps {
    leftContent: React.ReactNode;
    mainContent: React.ReactNode;
    rightContent?: React.ReactNode;
    className?: string;
}

type LayoutMode = 'split' | 'table' | 'details';

export const MasterLayout: React.FC<MasterLayoutProps> = ({
    leftContent,
    mainContent,
    rightContent,
    className,
}) => {
    const [mode, setMode] = useState<LayoutMode>('split');
    const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);

    return (
        <div className={cn("h-screen w-full flex flex-col bg-slate-50 overflow-hidden", className)}>
            {/* Mega Menu Overlay */}
            <MegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} />

            {/* Top Bar - Sage X3 Style Helper */}
            <header className="h-10 bg-[#1a1a1a] text-white flex items-center px-4 justify-between shrink-0 shadow-sm z-20 font-sans text-sm">
                {/* Left: Branding */}
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-3 select-none">
                        <span className="font-bold text-lg text-[#00b06b] tracking-tight">Sage</span>
                        <div className="h-4 w-px bg-gray-600"></div>
                        <span className="font-bold text-gray-100 tracking-wide text-base">X3</span>
                    </div>
                    <button className="text-gray-400 hover:text-white transition-colors ml-2">
                        <Calendar className="w-5 h-5" />
                    </button>
                </div>

                {/* Right: Controls & User Info */}
                <div className="flex items-center gap-5">
                    {/* User Info */}
                    <div className="flex items-center gap-6 mr-2">
                        <span className="text-[#fbce4c] font-medium tracking-wide text-xs">IDRIS LOUKI</span>
                        <span className="text-gray-300 font-medium text-xs">Utilisateurs</span>
                        <div className="flex items-center gap-2">
                            <div className="w-3 h-3 bg-[#00b06b] rounded-[1px]"></div>
                            <span className="text-gray-100 text-xs">FDP - Production</span>
                        </div>
                    </div>

                    {/* Icons Toolbar */}
                    <div className="flex items-center h-full">
                        <button className="text-white hover:text-gray-300 transition-colors bg-transparent p-1.5 rounded-full hover:bg-white/10 mx-1">
                            <HelpCircle className="w-5 h-5" />
                        </button>

                        {/* Star Menu with Green Background */}
                        <div className="flex items-center bg-[#007040] h-10 px-2 mx-1 cursor-pointer hover:bg-[#00854d] transition-colors relative group">
                            <Star className="w-5 h-5 fill-white text-white" />
                            <ChevronDown className="w-3 h-3 ml-1 text-white" />
                        </div>

                        {/* Compass - Mega Menu Toggle */}
                        <button
                            onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                            className={cn(
                                "text-white hover:text-gray-300 transition-colors p-1.5 mx-1 rounded-full",
                                isMegaMenuOpen && "bg-white/10 text-white"
                            )}
                        >
                            <Compass className="w-6 h-6" strokeWidth={1.5} />
                        </button>

                        <button className="text-white hover:text-gray-300 transition-colors p-1.5 mx-1">
                            <Search className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Split Content */}
            <div className="flex-1 overflow-hidden relative flex flex-row">

                {/* MODE: SPLIT VIEW (Default) */}
                {mode === 'split' && (
                    <Split
                        className="flex h-full flex-1"
                        sizes={[25, 75]}
                        minSize={[0, 400]}
                        gutterSize={6}
                        snapOffset={30}
                        dragInterval={1}
                        direction="horizontal"
                        cursor="col-resize"
                    >
                        {/* LEFT PANE: Data/List */}
                        <div className="h-full overflow-hidden bg-white border-r border-gray-200 flex flex-col relative group">
                            <div className="absolute right-2 top-2 z-50 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button
                                    onClick={() => setMode('table')}
                                    className="p-1 bg-white border border-gray-200 shadow-sm rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                    title="Maximize Table"
                                >
                                    <Maximize2 className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => setMode('details')}
                                    className="p-1 bg-white border border-gray-200 shadow-sm rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                                    title="Collapse Table"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                            </div>
                            {leftContent}
                        </div>

                        {/* MIDDLE PANE: Details */}
                        <div className="h-full overflow-y-auto bg-slate-50 flex flex-col">
                            {mainContent}
                        </div>
                    </Split>
                )}

                {/* MODE: FULL TABLE (Maximized Left) */}
                {mode === 'table' && (
                    <div className="flex h-full flex-1">
                        <div className="flex-1 h-full overflow-hidden bg-white relative group">
                            <button
                                onClick={() => setMode('split')}
                                className="absolute right-2 top-2 z-50 p-1 bg-white border border-gray-200 shadow-sm rounded-md text-gray-400 hover:text-gray-600 hover:bg-gray-50 opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Restore Split View"
                            >
                                <Minimize2 className="w-4 h-4" />
                            </button>
                            {leftContent}
                        </div>
                    </div>
                )}

                {/* MODE: FULL DETAILS (Collapsed Left) */}
                {mode === 'details' && (
                    <div className="flex h-full flex-1">
                        {/* Collapsed Strip */}
                        <div
                            className="w-5 bg-gray-50 border-r border-gray-200 flex flex-col items-center py-2 hover:bg-gray-100 cursor-pointer transition-colors group"
                            onClick={() => setMode('split')}
                            title="Expand Sidebar"
                        >
                            <div className="w-1 h-8 bg-gray-300 group-hover:bg-[#00b06b] rounded-full transition-colors mb-2"></div>
                            <ChevronRight className="w-4 h-4 text-gray-400 group-hover:text-gray-600 mt-1" />
                        </div>

                        {/* Expanded Main Content */}
                        <div className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col">
                            {mainContent}
                        </div>
                    </div>
                )}

                {/* RIGHT BAR: Fixed Actions (Always visible) */}
                {rightContent}
            </div>
        </div>
    );
};
