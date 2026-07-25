import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import type { Devis, CreateDevisRequest, UpdateDevisRequest } from '@/types/telesalesAgent.types';

export const useDevisList = (filters: { status?: string }) => {
    const [devis, setDevis] = useState<Devis[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.devis.getList(filters);
            setDevis(result.devis);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement des devis');
        } finally {
            setLoading(false);
        }
    }, [filters.status]);

    useEffect(() => { fetch(); }, [fetch]);

    return { devis, loading, error, refetch: fetch };
};

export const useDevisDetail = (id: number | null) => {
    const [devis, setDevis] = useState<Devis | null>(null);
    const [loading, setLoading] = useState(!!id);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!id) return;
        setLoading(true);
        setError(null);
        try {
            const result = await telesalesApi.devis.getDetail(id);
            setDevis(result.devis);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement du devis');
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { fetch(); }, [fetch]);

    return { devis, setDevis, loading, error, refetch: fetch };
};

export const useCreateDevis = () => {
    const [loading, setLoading] = useState(false);
    const create = useCallback(async (data: CreateDevisRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.devis.create(data);
            return res.devis;
        } finally {
            setLoading(false);
        }
    }, []);
    return { create, loading };
};

export const useUpdateDevis = () => {
    const [loading, setLoading] = useState(false);
    const update = useCallback(async (id: number, data: UpdateDevisRequest) => {
        setLoading(true);
        try {
            const res = await telesalesApi.devis.update(id, data);
            return res.devis;
        } finally {
            setLoading(false);
        }
    }, []);
    return { update, loading };
};

export const useSendDevis = () => {
    const [loading, setLoading] = useState(false);
    const send = useCallback(async (id: number) => {
        setLoading(true);
        try {
            return await telesalesApi.devis.send(id);
        } finally {
            setLoading(false);
        }
    }, []);
    return { send, loading };
};

export const useConvertDevis = () => {
    const [loading, setLoading] = useState(false);
    const convert = useCallback(async (id: number) => {
        setLoading(true);
        try {
            return await telesalesApi.devis.convert(id);
        } finally {
            setLoading(false);
        }
    }, []);
    return { convert, loading };
};
