import { useEffect, useMemo, useState } from 'react';
import { Play, Pause, Square, Loader2, Headset } from 'lucide-react';
import toast from 'react-hot-toast';

import { useCurrentSession, useSessionActions } from '@/hooks/telesales/useTelesalesSession';
import { useTelesalesSync } from '@/hooks/telesales/useTelesalesSync';

const formatElapsed = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
};

/**
 * Persistent session bandeau (docs §2) — one agent = one session at a time.
 * Chrono is computed client-side from started_at/total_paused_seconds, no
 * server polling needed per spec. Mount once at the top of the agent's app.
 *
 * `compact` renders a slim inline pill (status dot + chrono + small controls)
 * meant to sit in a page header's actions slot — used by the Cockpit so the
 * session controls don't consume a full-width strip of vertical space.
 */
export const TelesalesSessionBanner = ({ compact = false }: { compact?: boolean } = {}) => {
    const { session, setSession, loading: loadingSession, refetch } = useCurrentSession();
    const { start, pause, resume, end, loading: actionLoading } = useSessionActions();
    const { syncNow } = useTelesalesSync();
    const [now, setNow] = useState(() => Date.now());

    useEffect(() => {
        const i = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(i);
    }, []);

    const elapsedSeconds = useMemo(() => {
        if (!session || session.status === 'ended') return 0;
        const startedMs = new Date(session.started_at).getTime();
        const referenceMs = session.status === 'paused' && session.paused_at ? new Date(session.paused_at).getTime() : now;
        return Math.max(0, Math.floor((referenceMs - startedMs) / 1000) - session.total_paused_seconds);
    }, [session, now]);

    const handleStart = async () => {
        try {
            const s = await start();
            setSession(s);
            toast.success('Session démarrée');
            // §4.4 — refresh the offline catalogue/partner cache at the start of each
            // session; best-effort, never blocks the session-start flow if it fails.
            syncNow().catch(() => {});
        } catch (err: any) {
            if (err?.response?.status === 422) {
                // Another active/paused session already exists — resync rather than retry.
                await refetch();
                toast.error(err?.response?.data?.message || 'Une session est déjà en cours');
            } else {
                toast.error(err?.response?.data?.message || 'Échec du démarrage de la session');
            }
        }
    };

    const handlePause = async () => {
        if (!session) return;
        try {
            const s = await pause(session.id);
            setSession(s);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la mise en pause');
        }
    };

    const handleResume = async () => {
        if (!session) return;
        try {
            const s = await resume(session.id);
            setSession(s);
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la reprise');
        }
    };

    const handleEnd = async () => {
        if (!session) return;
        try {
            const s = await end(session.id);
            setSession(s);
            toast.success('Session terminée');
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la clôture');
        }
    };

    if (loadingSession) {
        return compact ? (
            <span className="flex items-center gap-1.5 text-xs text-gray-400">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Session...
            </span>
        ) : (
            <div className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 border-b border-gray-200 text-sm text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" /> Chargement de la session...
            </div>
        );
    }

    const isActive = session?.status === 'active';
    const isPaused = session?.status === 'paused';

    if (compact) {
        return (
            <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold ${
                    isActive ? 'bg-emerald-100 text-emerald-700' : isPaused ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'
                }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-emerald-500 animate-pulse' : isPaused ? 'bg-amber-500' : 'bg-gray-400'}`} />
                    <span className="hidden sm:inline">{isActive ? 'Session active' : isPaused ? 'En pause' : 'Hors session'}</span>
                    {session && session.status !== 'ended' && (
                        <span className="font-mono tabular-nums">{formatElapsed(elapsedSeconds)}</span>
                    )}
                </div>
                {!session || session.status === 'ended' ? (
                    <button
                        onClick={handleStart}
                        disabled={actionLoading}
                        className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                        Démarrer
                    </button>
                ) : (
                    <>
                        {isActive ? (
                            <button onClick={handlePause} disabled={actionLoading}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50">
                                <Pause className="w-3 h-3" /> Pause
                            </button>
                        ) : (
                            <button onClick={handleResume} disabled={actionLoading}
                                className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50">
                                <Play className="w-3 h-3" /> Reprendre
                            </button>
                        )}
                        <button onClick={handleEnd} disabled={actionLoading}
                            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50">
                            <Square className="w-3 h-3" /> Terminer
                        </button>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className={`flex items-center justify-between px-4 py-2.5 border-b transition-colors ${
            isActive ? 'bg-emerald-50 border-emerald-200' : isPaused ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'
        }`}>
            <div className="flex items-center gap-3">
                <Headset className={`w-4 h-4 ${isActive ? 'text-emerald-600' : isPaused ? 'text-amber-600' : 'text-gray-400'}`} />
                <span className="text-sm font-semibold text-gray-700">
                    {isActive ? 'Session active' : isPaused ? 'Session en pause' : 'Aucune session en cours'}
                </span>
                {session && session.status !== 'ended' && (
                    <span className="font-mono text-sm font-bold text-gray-800 tabular-nums">{formatElapsed(elapsedSeconds)}</span>
                )}
            </div>

            <div className="flex items-center gap-2">
                {!session || session.status === 'ended' ? (
                    <button
                        onClick={handleStart}
                        disabled={actionLoading}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                    >
                        {actionLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5" />}
                        Démarrer
                    </button>
                ) : (
                    <>
                        {isActive ? (
                            <button
                                onClick={handlePause}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-amber-500 rounded-lg hover:bg-amber-600 disabled:opacity-50"
                            >
                                <Pause className="w-3.5 h-3.5" /> Pause
                            </button>
                        ) : (
                            <button
                                onClick={handleResume}
                                disabled={actionLoading}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
                            >
                                <Play className="w-3.5 h-3.5" /> Reprendre
                            </button>
                        )}
                        <button
                            onClick={handleEnd}
                            disabled={actionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50"
                        >
                            <Square className="w-3.5 h-3.5" /> Terminer
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};
