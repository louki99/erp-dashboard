import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { TeleSalesSession } from '@/types/telesalesAgent.types';

// GET /sessions/current must be called on app load — the back refuses a 2nd
// session while one is active/paused, so the UI needs to resume the existing
// one (e.g. after a page refresh) rather than trying to start a new one.
export const useCurrentSession = () => {
    const [session, setSession] = useState<TeleSalesSession | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.sessions.current();
            setSession(result.session);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement de la session');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetch(); }, [fetch]);

    return { session, setSession, loading, error, refetch: fetch };
};

export const useSessionActions = () => {
    const [loading, setLoading] = useState(false);

    const start = useCallback(async () => {
        setLoading(true);
        try {
            const res = await telesalesApi.sessions.start();
            return res.session;
        } finally {
            setLoading(false);
        }
    }, []);

    const pause = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const res = await telesalesApi.sessions.pause(id);
            return res.session;
        } finally {
            setLoading(false);
        }
    }, []);

    const resume = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const res = await telesalesApi.sessions.resume(id);
            return res.session;
        } finally {
            setLoading(false);
        }
    }, []);

    const end = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const res = await telesalesApi.sessions.end(id);
            return res.session;
        } finally {
            setLoading(false);
        }
    }, []);

    return { start, pause, resume, end, loading };
};
