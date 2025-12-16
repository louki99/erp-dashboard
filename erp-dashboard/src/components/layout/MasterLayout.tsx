import React, { useState, useEffect } from 'react';
import Split from 'react-split';
import { cn } from '@/lib/utils';
import { Search, Star, ChevronDown, ChevronLeft, ChevronRight, Maximize2, Minimize2, Bell, Moon, Sun, LayoutGrid } from 'lucide-react';
import { MegaMenu } from './MegaMenu';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';

import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/context/AuthContext';

interface MasterLayoutProps {
    children?: React.ReactNode;
    leftContent?: React.ReactNode;
    mainContent?: React.ReactNode; // New prop for explicit middle content
    rightContent?: React.ReactNode; // New prop for custom action panel
    className?: string;
}

type LayoutMode = 'split' | 'table' | 'details';

export const MasterLayout: React.FC<MasterLayoutProps> = ({
    leftContent,
    mainContent,
    rightContent,
    className,
}) => {
    const navigate = useNavigate();
    const { user, logout } = useAuth();

    // Responsive State
    const [isMobile, setIsMobile] = useState(false);

    const [mode, setMode] = useState<LayoutMode>('split');
    const [isMegaMenuOpen, setIsMegaMenuOpen] = useState(false);
    const [showUserMenu, setShowUserMenu] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [isDark, setIsDark] = useState(false);

    // Check Screen Size
    useEffect(() => {
        const checkMobile = () => {
            const mobile = window.innerWidth < 1024; // lg breakpoint
            setIsMobile(mobile);
            // Auto-switch to table mode if resizing to mobile and currently in split
            if (mobile) {
                setMode(prev => prev === 'split' ? 'table' : prev);
            } else {
                // Optional: Restore split if resizing to desktop? 
                // Let's keep it manual or default to split if it was table?
                // For now, let's just leave it, but ensure 'split' is valid only on desktop
                setMode(prev => prev === 'table' ? 'split' : prev);
            }
        };

        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);

    // Theme Toggle Logic
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [isDark]);

    const toggleTheme = () => setIsDark(!isDark);

    return (
        <div className={cn("h-screen w-full flex flex-col bg-background overflow-hidden font-sans", className)}>
            {/* Mega Menu Overlay */}
            <MegaMenu isOpen={isMegaMenuOpen} onClose={() => setIsMegaMenuOpen(false)} />

            {/* Logout Confirmation Modal */}
            <ConfirmationModal
                isOpen={isLogoutModalOpen}
                onClose={() => setIsLogoutModalOpen(false)}
                onConfirm={() => {
                    logout();
                    navigate('/login');
                }}
                title="Sign out"
                description="Are you sure you want to sign out of your account? You will need to log in again to access the dashboard."
                confirmText="Sign out"
                variant="danger"
            />

            {/* Top Bar - Professional ERP Header */}
            <header className="h-14 bg-[#1a1a1a] dark:bg-black text-white flex items-center px-4 justify-between shrink-0 shadow-lg z-20 relative animate-in slide-in-from-top duration-300">
                {/* Left: Branding & Mega Menu Trigger */}
                <div className="flex items-center gap-6">
                    <button
                        onClick={() => setIsMegaMenuOpen(!isMegaMenuOpen)}
                        className="p-2 -ml-2 rounded-lg hover:bg-white/10 text-gray-300 hover:text-white transition-colors group"
                    >
                        <LayoutGrid className="w-6 h-6 group-hover:text-sage-500 transition-colors" />
                    </button>

                    <div className="flex items-center gap-3 select-none">
                        <div className="flex flex-col">
                            <span className="font-bold text-xl leading-none tracking-tight">
                                <span className="text-sage-500">Food</span>
                                <span className="text-white ml-1">Solutions</span>
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase tracking-widest font-medium">Enterprise</span>
                        </div>
                    </div>

                    <div className="h-6 w-px bg-white/10 hidden md:block"></div>

                    {/* Quick Access Toolbar */}
                    <nav className="hidden md:flex items-center gap-1">
                        <button className="flex items-center gap-2 px-3 py-1.5 rounded-md hover:bg-white/5 text-gray-300 hover:text-white transition-all text-sm font-medium group">
                            <Star className="w-4 h-4 text-sage-500 group-hover:text-sage-400" />
                            <span>Favorites</span>
                            <ChevronDown className="w-3 h-3 opacity-50" />
                        </button>
                    </nav>
                </div>

                {/* Center: Global Search (Visual Placeholder for now) */}
                <div className="flex-1 max-w-xl mx-8 hidden lg:block">
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500 group-hover:text-sage-500 transition-colors" />
                        <input
                            type="text"
                            placeholder="Search interactions, orders, customers (Ctrl+K)..."
                            className="w-full bg-white/5 border border-white/10 rounded-full pl-10 pr-4 py-1.5 text-sm text-gray-200 placeholder:text-gray-500 focus:outline-none focus:bg-white/10 focus:border-sage-500/50 transition-all"
                        />
                        <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-medium text-gray-400 border border-white/5">Ctrl</span>
                            <span className="px-1.5 py-0.5 rounded bg-white/10 text-[10px] font-medium text-gray-400 border border-white/5">K</span>
                        </div>
                    </div>
                </div>

                {/* Right: Controls & User Info */}
                <div className="flex items-center gap-2 md:gap-4">
                    {/* Theme Toggle */}
                    <button
                        onClick={toggleTheme}
                        className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-yellow-400 transition-colors"
                        title="Toggle Theme"
                    >
                        {isDark ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
                    </button>

                    <button className="p-2 rounded-full hover:bg-white/10 text-gray-400 hover:text-white transition-colors relative">
                        <Bell className="w-5 h-5" />
                        <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-[#1a1a1a]"></span>
                    </button>

                    <div className="h-6 w-px bg-white/10 hidden md:block"></div>

                    {/* User Profile */}
                    <div className="relative">
                        <button
                            onClick={() => setShowUserMenu(!showUserMenu)}
                            className="flex items-center gap-3 pl-2 pr-1 py-1 rounded-full hover:bg-white/5 border border-transparent hover:border-white/10 transition-all group"
                        >
                            <div className="text-right hidden md:block">
                                <div className="text-xs font-bold text-white group-hover:text-sage-400 transition-colors uppercase">{user?.name || 'User'}</div>
                                <div className="text-[10px] text-gray-400 capitalize">{user?.roles?.details?.[0]?.name || 'Guest'}</div>
                            </div>
                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center text-white font-bold text-xs shadow-lg ring-2 ring-transparent group-hover:ring-sage-500/50 transition-all">
                                {user?.name?.charAt(0).toUpperCase() || 'U'}
                            </div>
                        </button>

                        {/* User Dropdown Menu */}
                        {showUserMenu && (
                            <>
                                <div
                                    className="fixed inset-0 z-40"
                                    onClick={() => setShowUserMenu(false)}
                                ></div>
                                <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 py-2 animate-in fade-in slide-in-from-top-2 duration-200">
                                    <div className="px-4 py-2 border-b border-gray-100 dark:border-gray-700 mb-1">
                                        <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{user?.name}</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                                    </div>
                                    <button
                                        onClick={() => {
                                            navigate('/profile');
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-sage-50 dark:hover:bg-gray-700 hover:text-sage-600 transition-colors flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-sage-500"></div>
                                        My Profile
                                    </button>
                                    <button
                                        onClick={() => {
                                            /* Settings logic */
                                            setShowUserMenu(false);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-sage-50 dark:hover:bg-gray-700 hover:text-sage-600 transition-colors flex items-center gap-2"
                                    >
                                        <div className="w-2 h-2 rounded-full bg-gray-300"></div>
                                        Settings
                                    </button>
                                    <div className="h-px bg-gray-100 dark:bg-gray-700 my-1"></div>
                                    <button
                                        onClick={() => {
                                            setShowUserMenu(false);
                                            setIsLogoutModalOpen(true);
                                        }}
                                        className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors flex items-center gap-2"
                                    >
                                        Logout
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Main Split Content */}
            <div className="flex-1 overflow-hidden relative flex flex-row group/layout">

                {/* MODE: SPLIT VIEW (Default - Desktop Only) */}
                {mode === 'split' && !isMobile && (
                    <Split
                        className="flex h-full flex-1 min-w-0" // Added min-w-0 to prevent overflow
                        sizes={[30, 70]}
                        minSize={[280, 400]}
                        gutterSize={12}
                        snapOffset={30}
                        dragInterval={1}
                        direction="horizontal"
                        cursor="col-resize"
                        gutter={(index, direction) => {
                            const gutter = document.createElement('div')
                            gutter.className = `gutter gutter-${direction} relative flex items-center justify-center bg-gray-50/50 hover:bg-sage-50 transition-colors border-l border-r border-gray-200`
                            return gutter
                        }}
                    >
                        {/* LEFT PANE: Data/List */}
                        <div className="h-full overflow-hidden bg-white flex flex-col relative min-w-0 group/pane">
                            {/* Controls Container */}
                            <div className="absolute right-2 top-2 z-50 flex gap-1 opacity-0 group-hover/pane:opacity-100 transition-opacity duration-200">
                                <button
                                    onClick={() => setMode('table')}
                                    className="p-1.5 bg-white border border-gray-200 shadow-sm rounded-md text-gray-400 hover:text-sage-600 hover:border-sage-300 hover:bg-sage-50 transition-all"
                                    title="Maximize List"
                                >
                                    <Maximize2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                    onClick={() => setMode('details')}
                                    className="p-1.5 bg-white border border-gray-200 shadow-sm rounded-md text-gray-400 hover:text-sage-600 hover:border-sage-300 hover:bg-sage-50 transition-all"
                                    title="Collapse Sidebar"
                                >
                                    <ChevronLeft className="w-3.5 h-3.5" />
                                </button>
                            </div>
                            {leftContent}
                        </div>

                        {/* MIDDLE PANE: Details */}
                        <div className="h-full overflow-y-auto overflow-x-hidden bg-slate-50 flex flex-col relative min-w-0">
                            {mainContent}
                        </div>
                    </Split>
                )}

                {/* MODE: FULL TABLE (Maximized Left or Mobile Default) */}
                {(mode === 'table' || (mode === 'split' && isMobile)) && (
                    <div className="flex h-full flex-1 min-w-0">
                        <div className="flex-1 h-full overflow-hidden bg-white relative">
                            {/* Only show "Split View" button on desktop */}
                            {!isMobile && (
                                <button
                                    onClick={() => setMode('split')}
                                    className="absolute right-4 top-3 z-50 flex items-center gap-2 px-3 py-1.5 bg-white border border-gray-200 shadow-sm rounded-md text-sm font-medium text-gray-600 hover:text-sage-600 hover:border-sage-300 hover:bg-sage-50 transition-all"
                                    title="Restore Split View"
                                >
                                    <Minimize2 className="w-4 h-4" />
                                    <span>Split View</span>
                                </button>
                            )}

                            {/* On Mobile, provide a way to go to Details if something selected? 
                                Actually, the user clicks a row in leftContent. 
                                We need a way to detect selection or let the child component switch the mode.
                                Since props don't allow callback injection easily here without changing interface, 
                                we might need to rely on the user manually switching or the "Details" button below.
                                
                                BETTER IDEA: The List component usually handles selection. 
                                Note: This MasterLayout is generic. 
                                We might need to expose setMode to children? 
                                Or simply Provide a context?
                                
                                For this scoped fix, let's add a "View Details" FAB or button if on mobile?
                                Or just assume the user will use the explicit Buttons we add.
                            */}

                            {isMobile && (
                                <button
                                    onClick={() => setMode('details')}
                                    className="absolute bottom-4 right-4 z-50 h-12 w-12 bg-sage-600 text-white rounded-full shadow-lg flex items-center justify-center lg:hidden"
                                    title="Voir Détails"
                                >
                                    <ChevronRight className="w-6 h-6" />
                                </button>
                            )}

                            {leftContent}
                        </div>
                    </div>
                )}

                {/* MODE: FULL DETAILS (Collapsed Left) */}
                {mode === 'details' && (
                    <div className="flex h-full flex-1 min-w-0">
                        {/* Collapsed Strip - Sage Style (Desktop Only) */}
                        {!isMobile && (
                            <div
                                className="w-8 shrink-0 bg-[#2c3e50] border-r border-gray-700 flex flex-col items-center py-4 cursor-pointer hover:bg-[#34495e] transition-colors relative"
                                onClick={() => setMode('split')}
                                title="Expand Sidebar"
                            >
                                <div className="absolute top-6 -right-3 z-50 w-6 h-6 bg-white border border-gray-200 shadow-md rounded-full flex items-center justify-center text-gray-500 hover:text-sage-600 hover:border-sage-300 transition-all">
                                    <ChevronRight className="w-3 h-3" />
                                </div>

                                <div className="mt-10 [writing-mode:vertical-lr] rotate-180 text-xs font-medium text-gray-400 tracking-widest uppercase flex items-center gap-2">
                                    <span className="w-8 h-px bg-gray-600 mb-2"></span>
                                    LISTE
                                </div>
                            </div>
                        )}

                        {/* Mobile Back Button */}
                        {isMobile && (
                            <div
                                className="w-0" // Hidden visually but logic needed? No, let's put back button in main content header? 
                            // Actually, let's put a floating back button for mobile details view.
                            ></div>
                        )}

                        {/* Expanded Main Content */}
                        <div className="flex-1 h-full overflow-y-auto bg-slate-50 flex flex-col relative">
                            {isMobile && (
                                <button
                                    onClick={() => setMode('table')}
                                    className="absolute left-4 top-20 z-40 p-2 bg-white/80 backdrop-blur-md border border-gray-200 text-gray-600 rounded-full shadow-sm"
                                    style={{ top: '1rem', left: '1rem' }} // Override pos
                                >
                                    <ChevronLeft className="w-5 h-5" />
                                </button>
                            )}
                            {mainContent}
                        </div>
                    </div>
                )}

                {/* RIGHT BAR: Fixed Actions (Always visible) */}
                {/* On Mobile: Fix it to bottom or right, ensure high Z-Index */}
                <div className="shrink-0 z-[60] h-full bg-white shadow-xl border-l border-gray-200">
                    {rightContent}
                </div>
            </div>
        </div>
    );
};
