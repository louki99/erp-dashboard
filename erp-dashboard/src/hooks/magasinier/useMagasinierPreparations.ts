import { useEffect, useState } from 'react';
import { magasinierApi } from '@/services/api/magasinierApi';
import type {
    PreparationsResponse,
    BonPreparationDetailResponse,
    SavePreparationRequest,
    RejectPreparationRequest,
    ShortageItemPayload,
    ReportShortageResponse,
    AdditionalItemPayload,
    ContinuePreparationResponse,
    CompletePreparationResponse,
    StartPreparationResponse,
    RejectPreparationResponse,
} from '@/types/magasinier.types';

export const useMagasinierPreparationsList = (filters?: { status?: string; search?: string; page?: number }) => {
    const [data, setData] = useState<PreparationsResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchList = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await magasinierApi.preparations.getPending(filters);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch preparations');
            console.error('Failed to fetch preparations:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchList();
    }, [filters?.page, filters?.status, filters?.search]);

    return { data, loading, error, refetch: fetchList };
};

export const useMagasinierPreparationDetail = (id: number | null) => {
    const [data, setData] = useState<BonPreparationDetailResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchDetail = async () => {
        if (!id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const res = await magasinierApi.preparations.getDetail(id);
            setData(res);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch preparation details');
            console.error('Failed to fetch preparation details:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDetail();
    }, [id]);

    return { data, loading, error, refetch: fetchDetail };
};

export const useMagasinierPrepare = () => {
    const [loading, setLoading] = useState(false);

    const prepare = async (id: number): Promise<StartPreparationResponse> => {
        setLoading(true);
        try {
            return await magasinierApi.preparations.prepare(id);
        } finally {
            setLoading(false);
        }
    };

    return { prepare, loading };
};

export const useMagasinierSavePreparation = () => {
    const [loading, setLoading] = useState(false);

    const save = async (id: number, data: SavePreparationRequest): Promise<CompletePreparationResponse> => {
        setLoading(true);
        try {
            return await magasinierApi.preparations.save(id, data);
        } finally {
            setLoading(false);
        }
    };

    return { save, loading };
};

export const useMagasinierRejectPreparation = () => {
    const [loading, setLoading] = useState(false);

    const reject = async (id: number, data: RejectPreparationRequest): Promise<RejectPreparationResponse> => {
        setLoading(true);
        try {
            return await magasinierApi.preparations.reject(id, data);
        } finally {
            setLoading(false);
        }
    };

    return { reject, loading };
};

export const useMagasinierReportShortage = () => {
    const [loading, setLoading] = useState(false);

    const reportShortage = async (id: number, items: ShortageItemPayload[]): Promise<ReportShortageResponse> => {
        setLoading(true);
        try {
            return await magasinierApi.preparations.reportShortage(id, items);
        } finally {
            setLoading(false);
        }
    };

    return { reportShortage, loading };
};

export const useMagasinierContinuePreparation = () => {
    const [loading, setLoading] = useState(false);

    const continuePreparation = async (id: number, items: AdditionalItemPayload[]): Promise<ContinuePreparationResponse> => {
        setLoading(true);
        try {
            return await magasinierApi.preparations.continuePreparation(id, items);
        } finally {
            setLoading(false);
        }
    };

    return { continuePreparation, loading };
};
