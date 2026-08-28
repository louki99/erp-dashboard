import { create } from 'zustand';

// Lets anything outside MasterLayout (e.g. a breadcrumb's root segment) open
// the App Launcher overlay — previously local-only state inside MasterLayout,
// with no route of its own to link back to.
interface AppLauncherState {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    toggle: () => void;
}

export const useAppLauncherStore = create<AppLauncherState>((set) => ({
    isOpen: false,
    open: () => set({ isOpen: true }),
    close: () => set({ isOpen: false }),
    toggle: () => set((s) => ({ isOpen: !s.isOpen })),
}));
