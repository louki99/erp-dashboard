import { useState, useEffect, useCallback } from 'react';
import * as customFieldsApi from '../../services/api/customFieldsApi';
import type {
    CustomField,
    CustomFieldFilters,
    CustomFieldListResponse,
    CustomFieldCreateFormResponse,
    CreateCustomFieldRequest,
    UpdateCustomFieldRequest,
    ReorderRequest,
} from '../../types/customFields.types';

// ─── Generic mutation helper ─────────────────────────────────────────────────

const useMutation = <T, R>(mutationFn: (args: T) => Promise<R>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (args: T): Promise<R> => {
        setLoading(true);
        setError(null);
        try {
            const result = await mutationFn(args);
            return result;
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Une erreur est survenue');
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
};

// ─── List custom fields ──────────────────────────────────────────────────────

export const useCustomFieldsList = (filters: CustomFieldFilters) => {
    const [data, setData] = useState<CustomFieldListResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await customFieldsApi.getCustomFields(filters);
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [filters.entity_type, filters.page, filters.per_page]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Get single custom field detail ──────────────────────────────────────────

export const useCustomFieldDetail = (id: number | null) => {
    const [data, setData] = useState<CustomField | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!id) {
            setData(null);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const cf = await customFieldsApi.getCustomField(id);
            setData(cf);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement');
            console.error(err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Create form metadata ────────────────────────────────────────────────────

export const useCreateFormMeta = () => {
    const [data, setData] = useState<CustomFieldCreateFormResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await customFieldsApi.getCreateFormMeta();
            setData(response);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec du chargement');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        fetch();
    }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Mutations ───────────────────────────────────────────────────────────────

export const useCreateCustomField = () =>
    useMutation<CreateCustomFieldRequest, any>(customFieldsApi.createCustomField);

export const useUpdateCustomField = () => {
    const { loading, error, execute } = useMutation<
        { id: number; data: UpdateCustomFieldRequest },
        any
    >(async ({ id, data }) => customFieldsApi.updateCustomField(id, data));
    return { updateCustomField: execute, loading, error };
};

export const useDeleteCustomField = () =>
    useMutation<number, any>(customFieldsApi.deleteCustomField);

export const useToggleCustomField = () =>
    useMutation<number, any>(customFieldsApi.toggleCustomField);

export const useReorderCustomFields = () =>
    useMutation<ReorderRequest, any>(customFieldsApi.reorderCustomFields);
