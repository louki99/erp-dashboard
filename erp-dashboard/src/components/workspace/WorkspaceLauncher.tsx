import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { BUSINESS_DOMAINS } from '@/lib/hub/hubData';
import { WorkspacePanel } from './WorkspacePanel';

interface WorkspaceLauncherProps {
    domainId: string | null;
    onClose: () => void;
}

export const WorkspaceLauncher = ({ domainId, onClose }: WorkspaceLauncherProps) => {
    const domain = BUSINESS_DOMAINS.find(d => d.id === domainId) ?? null;

    // ESC key closes the workspace
    useEffect(() => {
        if (!domain) return;
        const handler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [domain, onClose]);

    return (
        <AnimatePresence mode="wait">
            {domain && (
                // Container: fills viewport below the topbar (top-14 = 56px), starts after the rail (left-[60px])
                <div
                    key={domain.id}
                    className="fixed top-14 bottom-0 left-[60px] right-0 z-[90] flex"
                    role="dialog"
                    aria-modal="true"
                    aria-label={`Workspace ${domain.label}`}
                >
                    {/* ── Workspace Panel ──────────────────────────────── */}
                    <motion.div
                        className="relative w-[720px] max-w-[calc(100vw-60px)] h-full bg-white dark:bg-gray-900 shadow-2xl flex flex-col overflow-hidden z-10"
                        initial={{ x: '-100%' }}
                        animate={{ x: 0 }}
                        exit={{ x: '-100%' }}
                        transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                    >
                        <WorkspacePanel domain={domain} onClose={onClose} />
                    </motion.div>

                    {/* ── Backdrop ─────────────────────────────────────── */}
                    <motion.div
                        className="flex-1 bg-black/25 backdrop-blur-[2px] cursor-pointer"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        onClick={onClose}
                        aria-label="Fermer le workspace"
                    />
                </div>
            )}
        </AnimatePresence>
    );
};
