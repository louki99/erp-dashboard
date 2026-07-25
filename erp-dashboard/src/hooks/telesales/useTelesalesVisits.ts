import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { TeleVisit, CreateVisitRequest, StartAdhocVisitRequest, CompleteVisitRequest } from '@/types/telesalesAgent.types';

export const usePlanning = (date?: string) => {
    const [visits, setVisits] = useState<TeleVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.visits.getPlanning({ date });
            setVisits(result.visits);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du planning');
        } finally {
            setLoading(false);
        }
    }, [date]);

    useEffect(() => { fetch(); }, [fetch]);

    return { visits, loading, error, refetch: fetch };
};

export const useVisitsHistory = (filters: { date_from?: string; date_to?: string }) => {
    const [visits, setVisits] = useState<TeleVisit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.visits.getHistory(filters);
            setVisits(result.visits);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Échec du chargement de l'historique");
        } finally {
            setLoading(false);
        }
    }, [filters.date_from, filters.date_to]);

    useEffect(() => { fetch(); }, [fetch]);

    return { visits, loading, error, refetch: fetch };
};

export const useScheduleVisit = () => {
    const [loading, setLoading] = useState(false);
    const schedule = useCallback(async (data: CreateVisitRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.visits.schedule(data);
            return res.visit;
        } finally {
            setLoading(false);
        }
    }, []);
    return { schedule, loading };
};

export const useStartAdhocVisit = () => {
    const [loading, setLoading] = useState(false);
    const startAdhoc = useCallback(async (data: StartAdhocVisitRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.visits.startAdhoc(data);
            return res.visit;
        } finally {
            setLoading(false);
        }
    }, []);
    return { startAdhoc, loading };
};

export const useStartVisit = () => {
    const [loading, setLoading] = useState(false);
    const start = useCallback(async (id: number) => {
        setLoading(true);
        try {
            const res = await telesalesApi.visits.start(id);
            return res.visit;
        } finally {
            setLoading(false);
        }
    }, []);
    return { start, loading };
};

export const useCompleteVisit = () => {
    const [loading, setLoading] = useState(false);
    const complete = useCallback(async (id: number, data: CompleteVisitRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.visits.complete(id, data);
            return res.visit;
        } finally {
            setLoading(false);
        }
    }, []);
    return { complete, loading };
};
