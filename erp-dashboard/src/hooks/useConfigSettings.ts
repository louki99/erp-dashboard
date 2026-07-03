import { useState, useEffect, useCallback, useRef } from 'react';
import * as configApi from '@/services/api/configApi';
import type {
    ConfigSetting,
    ConfigSettingsResponse,
    ScopeEntity,
    ScopeKey,
    SettingDraft,
    SfaParam,
    SfaParamsResponse,
    ParamDraft,
} from '@/types/config.types';
import { CONFIG_SCOPES } from '@/types/config.types';

// ─── Settings fetch hook ──────────────────────────────────────────────────────

export const useConfigSettings = (scopeType: string | null, entityId: number | null) => {
    const [data, setData] = useState<ConfigSettingsResponse | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        if (!scopeType || entityId == null) { setData(null); return; }
        setLoading(true);
        setError(null);
        try {
            setData(await configApi.getSettings(scopeType, entityId));
        } catch (err: any) {
            setError(err?.response?.data?.message || 'Erreur de chargement');
            setData(null);
        } finally {
            setLoading(false);
        }
    }, [scopeType, entityId]);

    useEffect(() => { fetch(); }, [fetch]);

    return { data, loading, error, refetch: fetch };
};

// ─── Generic mutation helper ──────────────────────────────────────────────────

const useMutation = <T, R>(fn: (args: T) => Promise<R>) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const execute = async (args: T): Promise<R> => {
        setLoading(true);
        setError(null);
        try {
            return await fn(args);
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Erreur';
            setError(msg);
            throw err;
        } finally {
            setLoading(false);
        }
    };

    return { execute, loading, error };
};

// ─── Save batch ───────────────────────────────────────────────────────────────

export const useSaveBatch = () => useMutation(configApi.saveBatch);

// ─── Reset single setting ─────────────────────────────────────────────────────

export const useResetSetting = () => useMutation(configApi.resetSetting);

// ─── Scope entity search ──────────────────────────────────────────────────────

export const useScopeEntities = (scopeKey: ScopeKey | null) => {
    const [data, setData] = useState<ScopeEntity[]>([]);
    const [loading, setLoading] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout>>();

    const search = useCallback(async (q?: string) => {
        if (!scopeKey) { setData([]); return; }
        // SYSTEM has a single synthetic entry — no API call needed
        if (scopeKey === 'SYSTEM') {
            setData([{ id: 0, name: 'Paramètres Système', description: 'Configuration globale' }]);
            return;
        }
        setLoading(true);
        try {
            let results: ScopeEntity[] = [];
            switch (scopeKey) {
                case 'ROLE':           results = await configApi.getRoles(q); break;
                case 'USER':           results = await configApi.getUsers(q); break;
                case 'PARTNER':        results = await configApi.getPartners(q); break;
                case 'ACCESS_PROFILE': results = await configApi.getAccessProfiles(q); break;
                case 'BRANCH':         results = await configApi.getBranches(); break;
                case 'SHOP':           results = await configApi.getShops(); break;
                case 'COMPANY':        results = await configApi.getCompanies(q); break;
            }
            setData(results);
        } catch {
            setData([]);
        } finally {
            setLoading(false);
        }
    }, [scopeKey]);

    const debouncedSearch = useCallback((q: string) => {
        clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(q), 350);
    }, [search]);

    // Auto-load on scope change
    useEffect(() => {
        if (scopeKey) search();
        else setData([]);
    }, [scopeKey, search]);

    return { data, loading, search, debouncedSearch };
};

// ─── Draft state manager ──────────────────────────────────────────────────────

export const useSettingDrafts = (settings: ConfigSetting[]) => {
    const [drafts, setDrafts] = useState<Record<string, SettingDraft>>({});
    const fingerprintRef = useRef<string>('');

    // Reset drafts when settings reload — guarded by content fingerprint
    useEffect(() => {
        const fingerprint = settings.map(s => `${s.key}:${JSON.stringify(s.value)}`).join(',');
        if (fingerprint === fingerprintRef.current) return;
        fingerprintRef.current = fingerprint;

        const initial: Record<string, SettingDraft> = {};
        settings.forEach(s => {
            initial[s.key] = {
                key: s.key,
                type: s.type,
                originalValue: s.value,
                currentValue: s.value,
                isDirty: false,
            };
        });
        setDrafts(initial);
    }, [settings]);

    const updateDraft = useCallback((key: string, newValue: unknown) => {
        setDrafts(prev => {
            const d = prev[key];
            if (!d) return prev;
            let jsonError: string | undefined;
            if (d.type === 'json' && typeof newValue === 'string') {
                try { JSON.parse(newValue); } catch { jsonError = 'JSON invalide'; }
            }
            return {
                ...prev,
                [key]: {
                    ...d,
                    currentValue: newValue as any,
                    isDirty: newValue !== d.originalValue,
                    jsonError,
                },
            };
        });
    }, []);

    const resetDraft = useCallback((key: string) => {
        setDrafts(prev => {
            const d = prev[key];
            if (!d) return prev;
            return { ...prev, [key]: { ...d, currentValue: d.originalValue, isDirty: false, jsonError: undefined } };
        });
    }, []);

    const dirtyKeys = Object.values(drafts).filter(d => d.isDirty).map(d => d.key);
    const hasDirty = dirtyKeys.length > 0;

    const getDirtyPayload = useCallback((): Record<string, unknown> => {
        const out: Record<string, unknown> = {};
        dirtyKeys.forEach(key => {
            const d = drafts[key];
            if (!d) return;
            if (d.type === 'json' && typeof d.currentValue === 'string') {
                try { out[key] = JSON.parse(d.currentValue); } catch { /* skip invalid */ }
            } else {
                out[key] = d.currentValue;
            }
        });
        return out;
    }, [drafts, dirtyKeys]);

    return { drafts, updateDraft, resetDraft, dirtyKeys, hasDirty, getDirtyPayload };
};

// ─── sfa-params dictionary ────────────────────────────────────────────────────

export const useSfaParams = () => {
    const [data, setData] = useState<SfaParamsResponse | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        setLoading(true);
        configApi.getSfaParams()
            .then(setData)
            .catch(() => setData(null))
            .finally(() => setLoading(false));
    }, []);

    return { data, loading };
};

// ─── Merged param drafts (dictionary + overrides) ─────────────────────────────

export const useParamDrafts = (
    sfaParams: SfaParam[],
    settings: ConfigSetting[]
) => {
    const [drafts, setDrafts] = useState<Record<string, ParamDraft>>({});

    // Content fingerprint — only re-initialize when data actually changes, not just reference
    const paramsKeyRef = useRef<string>('');

    useEffect(() => {
        // Build a lightweight fingerprint: sorted key+value pairs
        const fingerprint = sfaParams.map(p => p.key).join(',')
            + '|'
            + settings.map(s => `${s.key}:${JSON.stringify(s.value)}`).join(',');

        if (fingerprint === paramsKeyRef.current) return;
        paramsKeyRef.current = fingerprint;

        const overrideMap: Record<string, ConfigSetting> = {};
        settings.forEach(s => { overrideMap[s.key] = s; });

        const next: Record<string, ParamDraft> = {};
        sfaParams.forEach(p => {
            const override = overrideMap[p.key];
            const namespace = p.key.split('.')[0] ?? 'other';
            next[p.key] = {
                key: p.key,
                type: p.value_type,
                description: p.description,
                namespace,
                isOverride: !!override,
                savedValue: override?.value ?? null,
                currentValue: override?.value ?? null,
                isDirty: false,
            };
        });
        setDrafts(next);
    }, [sfaParams, settings]);

    const updateDraft = useCallback((key: string, newValue: unknown) => {
        setDrafts(prev => {
            const d = prev[key];
            if (!d) return prev;
            let jsonError: string | undefined;
            if (d.type === 'json' && typeof newValue === 'string') {
                try { JSON.parse(newValue); } catch { jsonError = 'JSON invalide'; }
            }
            const isDirty = newValue !== d.savedValue;
            return { ...prev, [key]: { ...d, currentValue: newValue as any, isDirty, jsonError } };
        });
    }, []);

    const resetDraftLocal = useCallback((key: string) => {
        setDrafts(prev => {
            const d = prev[key];
            if (!d) return prev;
            return { ...prev, [key]: { ...d, currentValue: d.savedValue, isDirty: false, jsonError: undefined } };
        });
    }, []);

    // After a successful DELETE reset, mark param as no longer an override
    const clearOverride = useCallback((key: string) => {
        setDrafts(prev => {
            const d = prev[key];
            if (!d) return prev;
            return { ...prev, [key]: { ...d, isOverride: false, savedValue: null, currentValue: null, isDirty: false, jsonError: undefined } };
        });
    }, []);

    const dirtyKeys = Object.values(drafts).filter(d => d.isDirty && !d.jsonError).map(d => d.key);
    const hasDirty = dirtyKeys.length > 0;

    const getDirtyPayload = useCallback((): Record<string, unknown> => {
        const out: Record<string, unknown> = {};
        dirtyKeys.forEach(key => {
            const d = drafts[key];
            if (!d || d.currentValue === null || d.currentValue === undefined) return;
            if (d.type === 'json' && typeof d.currentValue === 'string') {
                try { out[key] = JSON.parse(d.currentValue); } catch { /* skip invalid */ }
            } else {
                out[key] = d.currentValue;
            }
        });
        return out;
    }, [drafts, dirtyKeys]);

    return { drafts, updateDraft, resetDraftLocal, clearOverride, dirtyKeys, hasDirty, getDirtyPayload };
};
