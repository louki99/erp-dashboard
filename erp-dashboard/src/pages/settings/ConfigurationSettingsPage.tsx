import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    Settings2, Search, Save, RefreshCw, AlertTriangle, RotateCcw,
    ChevronRight, ChevronDown, X, Check, Loader2, Shield, User, Users, Building2,
    ToggleLeft, Hash, Type, Braces, Percent, Globe, MapPin, ShoppingBag,
    Factory, Info, CheckSquare, SlidersHorizontal, Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import {
    useConfigSettings,
    useSaveBatch,
    useResetSetting,
    useScopeEntities,
    useSfaParams,
    useParamDrafts,
} from '@/hooks/useConfigSettings';
import {
    CONFIG_SCOPES,
    SCOPE_LABELS,
    SCOPE_DESCRIPTIONS,
} from '@/types/config.types';
import type { ScopeKey, SettingType } from '@/types/config.types';

// ─── Scope constants ──────────────────────────────────────────────────────────

const SCOPE_KEYS: ScopeKey[] = [
    'SYSTEM', 'ROLE', 'USER', 'ACCESS_PROFILE', 'BRANCH', 'SHOP', 'COMPANY', 'PARTNER',
];

const SCOPE_ICONS: Record<ScopeKey, React.ElementType> = {
    SYSTEM:         Globe,
    ROLE:           Shield,
    USER:           User,
    ACCESS_PROFILE: Users,
    BRANCH:         MapPin,
    SHOP:           ShoppingBag,
    COMPANY:        Factory,
    PARTNER:        Building2,
};

const SCOPE_COLORS: Record<ScopeKey, { bg: string; text: string; border: string; active: string }> = {
    SYSTEM:         { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', active: 'bg-indigo-600 text-white border-indigo-600' },
    ROLE:           { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', active: 'bg-violet-600 text-white border-violet-600' },
    USER:           { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',    active: 'bg-sky-600 text-white border-sky-600'       },
    ACCESS_PROFILE: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  active: 'bg-amber-600 text-white border-amber-600'   },
    BRANCH:         { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   active: 'bg-teal-600 text-white border-teal-600'     },
    SHOP:           { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',   active: 'bg-pink-600 text-white border-pink-600'     },
    COMPANY:        { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-200',  active: 'bg-slate-600 text-white border-slate-600'   },
    PARTNER:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',active: 'bg-emerald-600 text-white border-emerald-600'},
};

// ─── Type constants ───────────────────────────────────────────────────────────

const TYPE_STYLES: Record<SettingType, { bg: string; text: string; border: string; label: string }> = {
    boolean: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Boolean'  },
    integer: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Integer'  },
    decimal: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Decimal'  },
    string:  { bg: 'bg-gray-100',  text: 'text-gray-700',   border: 'border-gray-200',   label: 'String'   },
    json:    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: 'JSON'     },
};

const TYPE_ICONS: Record<SettingType, React.ElementType> = {
    boolean: ToggleLeft,
    integer: Hash,
    decimal: Percent,
    string:  Type,
    json:    Braces,
};

const KNOWN_ENUMS: Record<string, string[]> = {
    'visit.gps.strict_mode': ['STRICT', 'WARNING', 'OFF'],
};

// Detect hex color values like #e8f0fe, #1a56db, #fff
const isHexColor = (val: unknown): val is string =>
    typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val.trim());

// Detect color-related key names
const isColorKey = (key: string): boolean =>
    /color|colour|accent|primary|secondary|brand|background|bg_|_bg$/i.test(key);

const NAMESPACE_LABELS: Record<string, string> = {
    visit:        'Visite terrain / SFA',
    wms:          'WMS / Entrepôt',
    order:        'Commandes',
    delivery:     'Livraison',
    finance:      'Finance / Crédit',
    erp:          'ERP / Intégrations',
    conventional: 'Chargement conventionnel',
    itinerary:    'Tournées / Itinéraires',
};

// ─── Reset confirm modal ──────────────────────────────────────────────────────

const ResetModal: React.FC<{
    settingKey: string;
    onConfirm: () => void;
    onCancel: () => void;
    loading: boolean;
}> = ({ settingKey, onConfirm, onCancel, loading }) => (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onCancel} />
        <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <div className="flex items-start gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-200 flex items-center justify-center shrink-0">
                    <RotateCcw className="w-5 h-5 text-amber-600" />
                </div>
                <div>
                    <h3 className="text-sm font-bold text-gray-900">Réinitialiser ce paramètre</h3>
                    <p className="text-xs text-gray-500 mt-1">
                        L'override de <code className="font-mono bg-gray-100 px-1 rounded">{settingKey}</code> sera supprimé.
                        La valeur par défaut globale de <code className="font-mono bg-gray-100 px-1 rounded">sfa_params</code> sera utilisée.
                    </p>
                </div>
            </div>
            <div className="flex gap-2">
                <button onClick={onCancel} className="flex-1 py-2 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                    Annuler
                </button>
                <button onClick={onConfirm} disabled={loading} className="flex-1 flex items-center justify-center gap-1.5 py-2 text-xs font-medium bg-amber-500 text-white rounded-lg hover:bg-amber-600 disabled:opacity-40 transition-colors">
                    {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCcw className="w-3.5 h-3.5" />}
                    Réinitialiser
                </button>
            </div>
        </div>
    </div>
);

// ─── Inline value editor ──────────────────────────────────────────────────────

const ValueEditor: React.FC<{
    settingKey: string;
    type: SettingType;
    value: unknown;
    jsonError?: string;
    isOverride: boolean;
    onChange: (v: unknown) => void;
}> = ({ settingKey, type, value, jsonError, isOverride, onChange }) => {
    const baseInputCls = `text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sage-500 transition-colors ${
        isOverride ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 text-gray-400 italic'
    }`;

    if (type === 'boolean') {
        const bool = value === null || value === undefined ? false : Boolean(value);
        const isDefault = !isOverride && value === null;
        if (isDefault) {
            return (
                <button
                    onClick={() => onChange(false)}
                    className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 opacity-40 cursor-pointer hover:opacity-60 transition-opacity"
                    title="Cliquer pour créer un override"
                >
                    <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow" />
                </button>
            );
        }
        return (
            <button
                onClick={() => onChange(!bool)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sage-500 ${bool ? 'bg-sage-600' : 'bg-gray-200'}`}
                role="switch"
                aria-checked={bool}
            >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bool ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        );
    }

    if (type === 'string') {
        const enumOpts = KNOWN_ENUMS[settingKey];
        if (enumOpts) {
            return (
                <select
                    value={String(value ?? '')}
                    onChange={e => onChange(e.target.value)}
                    className={`${baseInputCls} min-w-[120px]`}
                >
                    {!isOverride && <option value="">— défaut global —</option>}
                    {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
            );
        }

        // Color picker: show when value is a hex color OR key name suggests a color
        const strVal = String(value ?? '');
        const showColorPicker = isHexColor(value) || (isColorKey(settingKey) && (strVal === '' || isHexColor(value)));
        if (showColorPicker) {
            const colorRef = React.useRef<HTMLInputElement>(null);
            const safeHex = isHexColor(value) ? value : '#000000';
            return (
                <div className="flex items-center gap-2">
                    {/* Color swatch — clicking opens native color picker */}
                    <button
                        type="button"
                        onClick={() => colorRef.current?.click()}
                        title="Choisir une couleur"
                        className="w-8 h-8 rounded-lg border-2 border-gray-200 shadow-sm hover:scale-110 transition-transform shrink-0 relative overflow-hidden"
                        style={{ backgroundColor: safeHex }}
                    >
                        <input
                            ref={colorRef}
                            type="color"
                            value={safeHex}
                            onChange={e => onChange(e.target.value)}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            tabIndex={-1}
                        />
                    </button>
                    {/* Hex text input */}
                    <input
                        type="text"
                        value={strVal}
                        placeholder="#rrggbb"
                        onChange={e => onChange(e.target.value)}
                        className={`${baseInputCls} w-28 font-mono uppercase`}
                        maxLength={9}
                    />
                    {/* Live preview badge */}
                    {isHexColor(value) && (
                        <span
                            className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border border-gray-200"
                            style={{ backgroundColor: safeHex + '22', color: safeHex, borderColor: safeHex + '55' }}
                        >
                            {safeHex.toUpperCase()}
                        </span>
                    )}
                </div>
            );
        }

        return (
            <input
                type="text"
                value={strVal}
                placeholder={isOverride ? '' : '— défaut global —'}
                onChange={e => onChange(e.target.value)}
                className={`${baseInputCls} min-w-[140px]`}
            />
        );
    }

    if (type === 'integer') {
        return (
            <input
                type="number"
                step="1"
                value={value === null || value === undefined ? '' : String(value)}
                placeholder={isOverride ? '' : '—'}
                onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))}
                className={`${baseInputCls} w-28 text-right font-mono`}
            />
        );
    }

    if (type === 'decimal') {
        return (
            <input
                type="number"
                step="0.01"
                value={value === null || value === undefined ? '' : String(value)}
                placeholder={isOverride ? '' : '—'}
                onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))}
                className={`${baseInputCls} w-28 text-right font-mono`}
            />
        );
    }

    // json
    const jsonStr = value === null || value === undefined ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return (
        <div className="flex-1">
            <textarea
                value={jsonStr}
                placeholder={isOverride ? '' : '— défaut global —'}
                onChange={e => onChange(e.target.value)}
                rows={3}
                spellCheck={false}
                className={`w-full text-xs font-mono border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sage-500 resize-y min-w-[220px] ${
                    jsonError ? 'border-red-300 bg-red-50/30' : isOverride ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400 italic'
                }`}
            />
            {jsonError && <p className="text-[10px] text-red-600 mt-0.5">{jsonError}</p>}
        </div>
    );
};

// ─── Namespace accordion section ──────────────────────────────────────────────

const NAMESPACE_ICONS: Record<string, string> = {
    visit: '📍', wms: '🏭', order: '📦', delivery: '🚚',
    finance: '💰', erp: '🔗', conventional: '🏗️', itinerary: '🗺️',
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const ConfigurationSettingsPage = () => {
    const [activeScopeKey, setActiveScopeKey] = useState<ScopeKey>('ROLE');
    const [selectedEntity, setSelectedEntity] = useState<{ id: number; name: string } | null>(null);
    const [entitySearch, setEntitySearch] = useState('');
    const [globalSearch, setGlobalSearch] = useState('');
    const [resetTarget, setResetTarget] = useState<string | null>(null);
    const [showScopeModal, setShowScopeModal] = useState(false);
    const [expandedNs, setExpandedNs] = useState<Set<string>>(new Set(Object.keys(NAMESPACE_LABELS)));
    const [showOverridesOnly, setShowOverridesOnly] = useState(false);

    const entitySearchRef = useRef<HTMLInputElement>(null);

    const scopeType = CONFIG_SCOPES[activeScopeKey];

    // Load sfa-params dictionary on mount
    const { data: sfaParamsData, loading: sfaLoading } = useSfaParams();

    // Entity list for scope
    const { data: entities, loading: entitiesLoading, debouncedSearch } = useScopeEntities(activeScopeKey);

    // Settings (overrides) for selected scope+entity
    const {
        data: settingsData,
        loading: settingsLoading,
        refetch: refetchSettings,
    } = useConfigSettings(selectedEntity ? scopeType : null, selectedEntity?.id ?? null);

    // Memoize to prevent new array references on every render (avoids infinite loops in useParamDrafts)
    const rawSettings = useMemo(() => settingsData?.settings ?? [], [settingsData]);
    const sfaParamsList = useMemo(() => sfaParamsData?.params ?? [], [sfaParamsData]);
    const rawGrouped = useMemo(() => sfaParamsData?.grouped ?? {}, [sfaParamsData]);

    // Fallback: if dictionary failed/empty but we have overrides, build synthetic entries from the overrides
    const effectiveSfaParams = useMemo(() =>
        sfaParamsList.length > 0
            ? sfaParamsList
            : rawSettings.map(s => ({
                key: s.key,
                value_type: s.type,
                description: s.key,
            })),
        [sfaParamsList, rawSettings]
    );

    const effectiveGrouped = useMemo(() =>
        Object.keys(rawGrouped).length > 0
            ? rawGrouped
            : effectiveSfaParams.reduce<Record<string, typeof effectiveSfaParams>>((acc, p) => {
                const ns = p.key.split('.')[0] ?? 'other';
                if (!acc[ns]) acc[ns] = [];
                acc[ns].push(p);
                return acc;
            }, {}),
        [rawGrouped, effectiveSfaParams]
    );

    const dictUnavailable = sfaParamsList.length === 0 && rawSettings.length > 0;

    // Merged draft map
    const { drafts, updateDraft, resetDraftLocal, clearOverride, hasDirty, dirtyKeys, getDirtyPayload } = useParamDrafts(
        effectiveSfaParams,
        rawSettings
    );

    // Mutations
    const { execute: saveBatchFn, loading: saving } = useSaveBatch();
    const { execute: resetSettingFn, loading: resetting } = useResetSetting();

    // Scope change
    const handleScopeChange = (key: ScopeKey) => {
        setActiveScopeKey(key);
        setSelectedEntity(key === 'SYSTEM' ? { id: 0, name: 'Paramètres Système' } : null);
        setEntitySearch('');
        setGlobalSearch('');
    };

    useEffect(() => {
        if (activeScopeKey === 'SYSTEM' && !selectedEntity) {
            setSelectedEntity({ id: 0, name: 'Paramètres Système' });
        }
    }, [activeScopeKey, selectedEntity]);

    const handleEntitySearch = (q: string) => {
        setEntitySearch(q);
        debouncedSearch(q);
    };

    const toggleNamespace = (ns: string) => {
        setExpandedNs(prev => {
            const next = new Set(prev);
            next.has(ns) ? next.delete(ns) : next.add(ns);
            return next;
        });
    };

    const expandAll = () => setExpandedNs(new Set(Object.keys(effectiveGrouped)));
    const collapseAll = () => setExpandedNs(new Set());

    // Save all dirty
    const handleSaveAll = async () => {
        if (!selectedEntity || !hasDirty) return;
        const payload = getDirtyPayload();
        if (Object.keys(payload).length === 0) return;
        const toastId = toast.loading(`Sauvegarde de ${dirtyKeys.length} paramètre(s)…`);
        try {
            await saveBatchFn({
                configurable_type: scopeType,
                configurable_id: selectedEntity.id,
                settings: payload,
            });
            toast.dismiss(toastId);
            toast.success(`${dirtyKeys.length} paramètre(s) sauvegardé(s)`);
            refetchSettings();
        } catch (e: any) {
            toast.dismiss(toastId);
            const unknown = e?.response?.data?.unknown_keys?.join(', ');
            toast.error(unknown ? `Clés inconnues : ${unknown}` : (e?.response?.data?.message || 'Erreur de sauvegarde'));
        }
    };

    // Reset single param
    const handleConfirmReset = async () => {
        if (!selectedEntity || !resetTarget) return;
        const toastId = toast.loading('Réinitialisation…');
        try {
            await resetSettingFn({
                configurable_type: scopeType,
                configurable_id: selectedEntity.id,
                key: resetTarget,
            });
            toast.dismiss(toastId);
            toast.success('Paramètre réinitialisé au défaut global');
            clearOverride(resetTarget);
            setResetTarget(null);
        } catch (e: any) {
            toast.dismiss(toastId);
            toast.error(e?.response?.data?.message || 'Erreur');
        }
    };

    useEffect(() => {
        const handler = (e: BeforeUnloadEvent) => {
            if (hasDirty) { e.preventDefault(); e.returnValue = ''; }
        };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasDirty]);

    // Namespace override counts
    const overrideCount = rawSettings.length;
    const nsOverrideCounts = rawSettings.reduce<Record<string, number>>((acc, s) => {
        const ns = s.key.split('.')[0] ?? 'other';
        acc[ns] = (acc[ns] ?? 0) + 1;
        return acc;
    }, {});

    // Scroll-to-namespace helper
    const scrollToNs = (ns: string) => {
        setExpandedNs(prev => { const n = new Set(prev); n.add(ns); return n; });
        setTimeout(() => {
            document.getElementById(`ns-${ns}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 50);
    };

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                        {/* Header */}
                        <div className="px-3 pt-3 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                    <Settings2 className="w-4 h-4 text-sage-600" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900">Configuration</h1>
                                    <p className="text-[10px] text-gray-400">Paramètres dynamiques par scope</p>
                                </div>
                            </div>

                            {/* Active scope chip */}
                            {(() => {
                                const Icon = SCOPE_ICONS[activeScopeKey];
                                const c = SCOPE_COLORS[activeScopeKey];
                                return (
                                    <button
                                        onClick={() => setShowScopeModal(true)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all group ${c.active} hover:opacity-90`}
                                    >
                                        <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center shrink-0">
                                            <Icon className="w-4 h-4" />
                                        </div>
                                        <div className="flex-1 min-w-0 text-left">
                                            <div className="text-xs font-bold truncate">{SCOPE_LABELS[activeScopeKey]}</div>
                                            <div className="text-[10px] opacity-70 truncate">Cliquer pour changer</div>
                                        </div>
                                        <ChevronRight className="w-3.5 h-3.5 opacity-60 group-hover:translate-x-0.5 transition-transform shrink-0" />
                                    </button>
                                );
                            })()}
                        </div>

                        {/* Entity search */}
                        {activeScopeKey !== 'SYSTEM' && (
                            <div className="p-3 border-b border-gray-100 shrink-0">
                                <p className="text-[10px] text-gray-400 mb-2 uppercase tracking-wider font-semibold">
                                    {SCOPE_LABELS[activeScopeKey]}
                                </p>
                                <div className="relative">
                                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                    <input
                                        ref={entitySearchRef}
                                        type="text"
                                        value={entitySearch}
                                        onChange={e => handleEntitySearch(e.target.value)}
                                        placeholder={`Chercher un(e) ${SCOPE_LABELS[activeScopeKey].toLowerCase()}…`}
                                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 bg-gray-50"
                                    />
                                    {entitySearch && (
                                        <button onClick={() => handleEntitySearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                            <X className="w-3 h-3 text-gray-400" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* SYSTEM info card */}
                        {activeScopeKey === 'SYSTEM' && (
                            <div className="p-3 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                                    <Globe className="w-4 h-4 shrink-0" />
                                    <div>
                                        <div className="font-semibold">Paramètres globaux</div>
                                        <div className="text-[10px] text-indigo-500">id = 0 · base de tous les scopes</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Entity list */}
                        <div className={`flex-1 min-h-0 overflow-y-auto ${activeScopeKey === 'SYSTEM' ? 'hidden' : ''}`}>
                            {entitiesLoading ? (
                                <div className="p-4 space-y-2">
                                    {[...Array(5)].map((_, i) => (
                                        <div key={i} className="h-10 bg-gray-50 rounded-xl animate-pulse" />
                                    ))}
                                </div>
                            ) : entities.length === 0 ? (
                                <div className="p-6 text-center text-xs text-gray-400">
                                    <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                    Aucun résultat
                                </div>
                            ) : (
                                <div className="p-2 space-y-1">
                                    {entities.map(e => {
                                        const isSelected = selectedEntity?.id === e.id;
                                        const c = SCOPE_COLORS[activeScopeKey];
                                        return (
                                            <button
                                                key={e.id}
                                                onClick={() => setSelectedEntity({ id: e.id, name: e.name })}
                                                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs text-left transition-all ${isSelected ? `${c.active} shadow-sm` : 'hover:bg-gray-50 text-gray-700'}`}
                                            >
                                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-bold text-[11px] ${isSelected ? 'bg-white/20 text-white' : `${c.bg} ${c.text}`}`}>
                                                    {e.name.charAt(0).toUpperCase()}
                                                </div>
                                                <div className="min-w-0 flex-1">
                                                    <div className="font-semibold truncate">{e.name}</div>
                                                    {e.description && (
                                                        <div className={`text-[10px] truncate ${isSelected ? 'opacity-70' : 'text-gray-400'}`}>{e.description}</div>
                                                    )}
                                                </div>
                                                {isSelected && <Check className="w-3.5 h-3.5 shrink-0" />}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    </div>
                }

                mainContent={
                    <div className="h-full flex flex-col bg-slate-50">
                        {!selectedEntity ? (
                            <div className="flex-1 flex items-center justify-center">
                                <div className="text-center max-w-sm">
                                    <div className="w-16 h-16 rounded-2xl bg-white border border-gray-100 shadow-sm flex items-center justify-center mx-auto mb-4">
                                        <Settings2 className="w-8 h-8 text-gray-300" />
                                    </div>
                                    <h2 className="text-sm font-bold text-gray-700 mb-2">Sélectionnez une entité</h2>
                                    <p className="text-xs text-gray-400 leading-relaxed">{SCOPE_DESCRIPTIONS[activeScopeKey]}</p>
                                </div>
                            </div>
                        ) : (
                            <>
                                {/* Top bar */}
                                <div className="shrink-0 bg-white border-b border-gray-200 px-5 py-3.5">
                                    <div className="flex items-center justify-between gap-4">
                                        <div className="flex items-center gap-3 min-w-0">
                                            <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${SCOPE_COLORS[activeScopeKey].active}`}>
                                                {selectedEntity.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h2 className="text-sm font-bold text-gray-900">{selectedEntity.name}</h2>
                                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${SCOPE_COLORS[activeScopeKey].bg} ${SCOPE_COLORS[activeScopeKey].text} ${SCOPE_COLORS[activeScopeKey].border}`}>
                                                        {SCOPE_LABELS[activeScopeKey]}
                                                    </span>
                                                </div>
                                                <div className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-2">
                                                    <span>{effectiveSfaParams.length} paramètres</span>
                                                    <span className="text-gray-300">·</span>
                                                    <span className="text-sage-600 font-semibold">{overrideCount} override{overrideCount !== 1 ? 's' : ''}</span>
                                                    {hasDirty && (
                                                        <>
                                                            <span className="text-gray-300">·</span>
                                                            <span className="text-amber-600 font-semibold">{dirtyKeys.length} non sauvegardé{dirtyKeys.length > 1 ? 's' : ''}</span>
                                                        </>
                                                    )}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 shrink-0">
                                            {hasDirty && (
                                                <button
                                                    onClick={handleSaveAll}
                                                    disabled={saving}
                                                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-sage-600 text-white rounded-lg hover:bg-sage-700 disabled:opacity-40 transition-colors"
                                                >
                                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                                    Sauvegarder ({dirtyKeys.length})
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* Search + accordion controls */}
                                    <div className="mt-3 flex items-center gap-2">
                                        <div className="relative flex-1">
                                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                            <input
                                                type="text"
                                                value={globalSearch}
                                                onChange={e => setGlobalSearch(e.target.value)}
                                                placeholder="Rechercher un paramètre (clé ou description)…"
                                                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500 bg-gray-50 font-mono"
                                            />
                                            {globalSearch && (
                                                <button onClick={() => setGlobalSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                                    <X className="w-3 h-3 text-gray-400" />
                                                </button>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => setShowOverridesOnly(v => !v)}
                                            className={`flex items-center gap-1.5 px-2.5 py-2 text-[10px] font-semibold rounded-lg border transition-colors whitespace-nowrap ${
                                                showOverridesOnly
                                                    ? 'bg-sage-600 text-white border-sage-600'
                                                    : 'text-gray-500 bg-white border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <Zap className="w-3 h-3" />
                                            Overrides only
                                        </button>
                                        <button onClick={expandAll} className="px-2.5 py-2 text-[10px] font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                                            ↕ Tout
                                        </button>
                                        <button onClick={collapseAll} className="px-2.5 py-2 text-[10px] font-medium text-gray-500 hover:text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors whitespace-nowrap">
                                            ↕ Fermer
                                        </button>
                                    </div>

                                    {hasDirty && (
                                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            <span><strong>{dirtyKeys.length}</strong> modification{dirtyKeys.length > 1 ? 's' : ''} non sauvegardée{dirtyKeys.length > 1 ? 's' : ''} — pensez à sauvegarder.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Namespace accordions */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                                    {sfaLoading || settingsLoading ? (
                                        // Skeleton
                                        <div className="space-y-3">
                                            {[...Array(4)].map((_, i) => (
                                                <div key={i} className="bg-white rounded-xl border border-gray-200 overflow-hidden animate-pulse">
                                                    <div className="h-11 bg-gray-50 px-4 flex items-center gap-3">
                                                        <div className="h-4 w-4 bg-gray-200 rounded" />
                                                        <div className="h-3 w-32 bg-gray-200 rounded" />
                                                        <div className="ml-auto h-4 w-8 bg-gray-200 rounded-full" />
                                                    </div>
                                                    <div className="divide-y divide-gray-50">
                                                        {[...Array(3)].map((_, j) => (
                                                            <div key={j} className="flex items-center gap-4 px-4 py-3.5">
                                                                <div className="space-y-1.5 flex-1">
                                                                    <div className="h-3 bg-gray-100 rounded w-40" />
                                                                    <div className="h-2.5 bg-gray-50 rounded w-64" />
                                                                </div>
                                                                <div className="h-5 bg-gray-100 rounded w-16" />
                                                                <div className="h-7 bg-gray-100 rounded w-24" />
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : Object.keys(effectiveGrouped).length === 0 ? (
                                        <div className="bg-white rounded-xl border border-gray-200 py-14 text-center">
                                            <CheckSquare className="w-10 h-10 mx-auto mb-3 text-gray-200" />
                                            <p className="text-sm font-semibold text-gray-500 mb-1">Aucun paramètre</p>
                                            <p className="text-xs text-gray-400">Sélectionnez une entité pour voir ses paramètres.</p>
                                        </div>
                                    ) : (
                                        Object.entries(effectiveGrouped).map(([ns, params]) => {
                                            const q = globalSearch.toLowerCase();
                                            let visible = q
                                                ? params.filter(p => p.key.toLowerCase().includes(q) || p.description.toLowerCase().includes(q))
                                                : params;
                                            if (showOverridesOnly) {
                                                visible = visible.filter(p => drafts[p.key]?.isOverride || drafts[p.key]?.isDirty);
                                            }
                                            if (visible.length === 0) return null;

                                            const isExpanded = expandedNs.has(ns);
                                            const nsOverride = nsOverrideCounts[ns] ?? 0;
                                            const nsLabel = NAMESPACE_LABELS[ns] ?? ns;
                                            const nsIcon = NAMESPACE_ICONS[ns] ?? '⚙️';
                                            const nsDirty = visible.filter(p => drafts[p.key]?.isDirty).length;

                                            return (
                                                <div key={ns} id={`ns-${ns}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    {/* Accordion header */}
                                                    <button
                                                        onClick={() => toggleNamespace(ns)}
                                                        className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50/80 hover:bg-gray-100/60 transition-colors text-left"
                                                    >
                                                        <span className="text-base leading-none">{nsIcon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-gray-800">{nsLabel}</span>
                                                                <code className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ns}</code>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {nsDirty > 0 && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">
                                                                    {nsDirty} ✏️
                                                                </span>
                                                            )}
                                                            {nsOverride > 0 && (
                                                                <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">
                                                                    {nsOverride} override{nsOverride > 1 ? 's' : ''}
                                                                </span>
                                                            )}
                                                            <span className="text-[10px] text-gray-400 font-medium">{visible.length}</span>
                                                            {isExpanded
                                                                ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
                                                                : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />
                                                            }
                                                        </div>
                                                    </button>

                                                    {/* Param rows */}
                                                    {isExpanded && (
                                                        <div className="divide-y divide-gray-50">
                                                            {visible.map(param => {
                                                                const draft = drafts[param.key];
                                                                if (!draft) return null;
                                                                const ts = TYPE_STYLES[param.value_type];
                                                                const TypeIcon = TYPE_ICONS[param.value_type];
                                                                const isDirty = draft.isDirty;
                                                                const isOverride = draft.isOverride;

                                                                return (
                                                                    <div
                                                                        key={param.key}
                                                                        className={`group flex items-start gap-4 px-4 py-3 transition-colors border-l-2 ${
                                                                            isDirty
                                                                                ? 'bg-amber-50/30 border-amber-400'
                                                                                : isOverride
                                                                                    ? 'bg-sage-50/20 border-sage-300 hover:bg-sage-50/30'
                                                                                    : 'border-transparent hover:bg-gray-50/60'
                                                                        }`}
                                                                    >
                                                                        {/* Key + description */}
                                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <code className={`text-xs font-mono font-semibold ${isOverride || isDirty ? 'text-gray-800' : 'text-gray-400'}`}>
                                                                                    {param.key}
                                                                                </code>
                                                                                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                                                                                {isOverride && !isDirty && (
                                                                                    <span className="text-[9px] font-bold text-sage-600 bg-sage-50 border border-sage-200 px-1 rounded uppercase tracking-wide">override</span>
                                                                                )}
                                                                            </div>
                                                                            {/* Description — always shown, style adapts to state */}
                                                                            {param.description && param.description !== param.key ? (
                                                                                <p className={`text-[11px] mt-1 leading-snug flex items-start gap-1 ${isOverride || isDirty ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                                    <Info className="w-3 h-3 shrink-0 mt-0.5 text-gray-300" />
                                                                                    {param.description}
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-[10px] mt-0.5 text-gray-300 italic">Aucune description disponible</p>
                                                                            )}
                                                                        </div>

                                                                        {/* Type badge */}
                                                                        <div className="pt-0.5 shrink-0">
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${ts.bg} ${ts.text} ${ts.border} ${!isOverride && !isDirty ? 'opacity-40' : ''}`}>
                                                                                <TypeIcon className="w-2.5 h-2.5" />
                                                                                {ts.label}
                                                                            </span>
                                                                        </div>

                                                                        {/* Value editor */}
                                                                        <div className={`pt-0.5 shrink-0 ${param.value_type === 'json' ? 'flex-1' : ''}`}>
                                                                            <ValueEditor
                                                                                settingKey={param.key}
                                                                                type={param.value_type}
                                                                                value={draft.currentValue}
                                                                                jsonError={draft.jsonError}
                                                                                isOverride={isOverride}
                                                                                onChange={v => updateDraft(param.key, v)}
                                                                            />
                                                                        </div>

                                                                        {/* Actions */}
                                                                        <div className="flex items-center gap-1 pt-0.5 shrink-0">
                                                                            {isDirty && (
                                                                                <button
                                                                                    onClick={() => resetDraftLocal(param.key)}
                                                                                    title="Annuler les modifications"
                                                                                    className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {isOverride && (
                                                                                <button
                                                                                    onClick={() => setResetTarget(param.key)}
                                                                                    title="Réinitialiser au défaut global"
                                                                                    className="p-1.5 rounded-lg text-gray-200 hover:text-amber-500 hover:bg-amber-50 transition-colors"
                                                                                >
                                                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                );
                                                            })}
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}

                                    {/* Legend */}
                                    {dictUnavailable && (
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>
                                                Dictionnaire <code className="font-mono bg-amber-100 px-1 rounded">sfa-params</code> indisponible — affichage des overrides uniquement, sans descriptions.
                                            </span>
                                        </div>
                                    )}
                                    {!sfaLoading && !settingsLoading && selectedEntity && effectiveSfaParams.length > 0 && !dictUnavailable && (
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700">
                                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>
                                                <span className="font-semibold">Lignes en grisé</span> = valeur par défaut globale (sfa_params) — aucun override pour ce scope.
                                                <span className="ml-1 font-semibold">Barre verte</span> = override actif. Priorité : <span className="font-mono">User → AccessProfile → Role → Branch → Company → System</span>.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                }

                rightContent={
                    <div className="h-full flex flex-col bg-white border-l border-gray-100 overflow-y-auto">

                        {/* Save CTA */}
                        <div className="p-3 shrink-0">
                            {hasDirty ? (
                                <button
                                    onClick={handleSaveAll}
                                    disabled={saving}
                                    className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-bold bg-sage-600 text-white rounded-xl hover:bg-sage-700 disabled:opacity-50 shadow-sm shadow-sage-200 transition-all"
                                >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                                    Sauvegarder ({dirtyKeys.length})
                                </button>
                            ) : (
                                <div className="w-full flex items-center justify-center gap-2 py-2.5 text-xs font-semibold text-gray-400 bg-gray-50 border border-gray-100 rounded-xl">
                                    <Check className="w-3.5 h-3.5 text-sage-400" />
                                    Tout sauvegardé
                                </div>
                            )}
                            <button
                                onClick={refetchSettings}
                                disabled={!selectedEntity}
                                className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 text-[11px] font-medium text-gray-400 hover:text-gray-600 hover:bg-gray-50 rounded-lg disabled:opacity-30 transition-colors"
                            >
                                <RefreshCw className="w-3 h-3" />
                                Actualiser
                            </button>
                        </div>

                        {/* Stats cards */}
                        {selectedEntity && (
                            <div className="px-3 pb-3 shrink-0 space-y-2">
                                <div className="grid grid-cols-2 gap-2">
                                    <div className="bg-gray-50 border border-gray-100 rounded-xl p-2.5 text-center">
                                        <div className="text-lg font-black text-gray-800">{effectiveSfaParams.length}</div>
                                        <div className="text-[9px] text-gray-400 font-medium uppercase tracking-wide mt-0.5">Params</div>
                                    </div>
                                    <div className={`rounded-xl p-2.5 text-center border ${overrideCount > 0 ? 'bg-sage-50 border-sage-100' : 'bg-gray-50 border-gray-100'}`}>
                                        <div className={`text-lg font-black ${overrideCount > 0 ? 'text-sage-700' : 'text-gray-400'}`}>{overrideCount}</div>
                                        <div className={`text-[9px] font-medium uppercase tracking-wide mt-0.5 ${overrideCount > 0 ? 'text-sage-500' : 'text-gray-400'}`}>Overrides</div>
                                    </div>
                                </div>
                                {hasDirty && (
                                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-2.5 flex items-center gap-2">
                                        <div className="w-7 h-7 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                                            <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                        </div>
                                        <div>
                                            <div className="text-xs font-bold text-amber-700">{dirtyKeys.length} non sauvegardé{dirtyKeys.length > 1 ? 's' : ''}</div>
                                            <div className="text-[9px] text-amber-500">Pensez à sauvegarder</div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Divider */}
                        <div className="mx-3 border-t border-gray-100 shrink-0" />

                        {/* Namespace navigator */}
                        {selectedEntity && Object.keys(effectiveGrouped).length > 0 && (
                            <div className="flex-1 min-h-0 overflow-y-auto p-3">
                                <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-2.5 px-1">Navigation</p>
                                <div className="space-y-0.5">
                                    {Object.entries(effectiveGrouped).map(([ns, params]) => {
                                        const nsOverride = nsOverrideCounts[ns] ?? 0;
                                        const nsDirty = params.filter(p => drafts[p.key]?.isDirty).length;
                                        const nsIcon = NAMESPACE_ICONS[ns] ?? '⚙️';
                                        const pct = params.length > 0 ? Math.round((nsOverride / params.length) * 100) : 0;
                                        return (
                                            <button
                                                key={ns}
                                                onClick={() => scrollToNs(ns)}
                                                className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg hover:bg-gray-50 text-left transition-colors group"
                                            >
                                                <span className="text-base leading-none shrink-0">{nsIcon}</span>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center justify-between mb-0.5">
                                                        <span className="text-[10px] font-semibold text-gray-700 truncate group-hover:text-gray-900">
                                                            {NAMESPACE_LABELS[ns] ?? ns}
                                                        </span>
                                                        <span className="text-[9px] font-mono text-gray-400 shrink-0 ml-1">{nsOverride}/{params.length}</span>
                                                    </div>
                                                    {/* Progress bar */}
                                                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                                                        <div
                                                            className={`h-full rounded-full transition-all ${pct > 0 ? 'bg-sage-400' : 'bg-transparent'}`}
                                                            style={{ width: `${pct}%` }}
                                                        />
                                                    </div>
                                                </div>
                                                {nsDirty > 0 && (
                                                    <span className="text-[9px] font-bold text-amber-600 bg-amber-100 w-4 h-4 rounded-full flex items-center justify-center shrink-0">
                                                        {nsDirty}
                                                    </span>
                                                )}
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}

                        {/* Legend */}
                        <div className="p-3 border-t border-gray-100 shrink-0">
                            <p className="text-[9px] text-gray-400 uppercase tracking-widest font-bold mb-2.5 px-1">Légende</p>
                            <div className="space-y-1.5">
                                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                    <span className="w-3 h-3 rounded border-l-4 border-sage-400 bg-sage-50 shrink-0" />
                                    Override actif
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-600">
                                    <span className="w-3 h-3 rounded border-l-4 border-amber-400 bg-amber-50 shrink-0" />
                                    Modification locale
                                </div>
                                <div className="flex items-center gap-2 text-[10px] text-gray-400 italic">
                                    <span className="w-3 h-3 rounded border-l-4 border-gray-200 bg-gray-50 shrink-0" />
                                    Défaut global
                                </div>
                            </div>
                        </div>
                    </div>
                }
            />

            {/* Reset confirm modal */}
            {resetTarget && (
                <ResetModal
                    settingKey={resetTarget}
                    onConfirm={handleConfirmReset}
                    onCancel={() => setResetTarget(null)}
                    loading={resetting}
                />
            )}

            {/* Scope picker modal */}
            {showScopeModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowScopeModal(false)} />
                    <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-xl bg-sage-100 flex items-center justify-center">
                                    <Settings2 className="w-4 h-4 text-sage-600" />
                                </div>
                                <div>
                                    <h2 className="text-sm font-bold text-gray-900">Type de configuration</h2>
                                    <p className="text-[10px] text-gray-400">Sélectionnez le scope à configurer</p>
                                </div>
                            </div>
                            <button onClick={() => setShowScopeModal(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        <div className="p-4 grid grid-cols-2 gap-2.5 max-h-[70vh] overflow-y-auto">
                            {SCOPE_KEYS.map(key => {
                                const Icon = SCOPE_ICONS[key];
                                const c = SCOPE_COLORS[key];
                                const isActive = activeScopeKey === key;
                                return (
                                    <button
                                        key={key}
                                        onClick={() => { handleScopeChange(key); setShowScopeModal(false); }}
                                        className={`relative flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${isActive ? `${c.active} shadow-md` : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'}`}
                                    >
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : `${c.bg} border ${c.border}`}`}>
                                            <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : c.text}`} />
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className={`text-xs font-bold truncate ${isActive ? 'text-white' : 'text-gray-800'}`}>{SCOPE_LABELS[key]}</div>
                                            <div className={`text-[10px] mt-0.5 leading-tight ${isActive ? 'text-white/70' : 'text-gray-400'}`}>{SCOPE_DESCRIPTIONS[key]}</div>
                                        </div>
                                        {isActive && (
                                            <div className="absolute top-2 right-2 w-4 h-4 rounded-full bg-white/30 flex items-center justify-center">
                                                <Check className="w-2.5 h-2.5 text-white" />
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        <div className="px-5 py-3 border-t border-gray-100 bg-gray-50">
                            <p className="text-[10px] text-gray-400 text-center">
                                Priorité : <span className="font-mono text-gray-600">User → AccessProfile → Role → Branch → Company → System</span>
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
