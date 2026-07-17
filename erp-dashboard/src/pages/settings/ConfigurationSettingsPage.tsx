import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import {
    Settings2, Search, Save, RefreshCw, AlertTriangle, RotateCcw,
    ChevronRight, ChevronDown, X, Check, Loader2, Shield, User, Users, Building2,
    ToggleLeft, Hash, Type, Braces, Percent, Globe, MapPin, ShoppingBag,
    Factory, Info, CheckSquare, Zap, ChevronsDown, ChevronsUp, ChevronDown as ChevronDownSm,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
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

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SCOPE_COLORS: Record<ScopeKey, { bg: string; text: string; border: string; active: string; pill: string }> = {
    SYSTEM:         { bg: 'bg-indigo-50',  text: 'text-indigo-700',  border: 'border-indigo-200', active: 'bg-indigo-600 text-white',  pill: 'bg-indigo-100 text-indigo-700 border-indigo-200'  },
    ROLE:           { bg: 'bg-violet-50',  text: 'text-violet-700',  border: 'border-violet-200', active: 'bg-violet-600 text-white',  pill: 'bg-violet-100 text-violet-700 border-violet-200'  },
    USER:           { bg: 'bg-sky-50',     text: 'text-sky-700',     border: 'border-sky-200',    active: 'bg-sky-600 text-white',     pill: 'bg-sky-100 text-sky-700 border-sky-200'           },
    ACCESS_PROFILE: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',  active: 'bg-amber-600 text-white',   pill: 'bg-amber-100 text-amber-700 border-amber-200'     },
    BRANCH:         { bg: 'bg-teal-50',    text: 'text-teal-700',    border: 'border-teal-200',   active: 'bg-teal-600 text-white',    pill: 'bg-teal-100 text-teal-700 border-teal-200'        },
    SHOP:           { bg: 'bg-pink-50',    text: 'text-pink-700',    border: 'border-pink-200',   active: 'bg-pink-600 text-white',    pill: 'bg-pink-100 text-pink-700 border-pink-200'        },
    COMPANY:        { bg: 'bg-slate-100',  text: 'text-slate-700',   border: 'border-slate-200',  active: 'bg-slate-600 text-white',   pill: 'bg-slate-100 text-slate-700 border-slate-200'     },
    PARTNER:        { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200',active: 'bg-emerald-600 text-white', pill: 'bg-emerald-100 text-emerald-700 border-emerald-200'},
};

const TYPE_STYLES: Record<SettingType, { bg: string; text: string; border: string; label: string }> = {
    boolean: { bg: 'bg-blue-50',   text: 'text-blue-700',   border: 'border-blue-200',   label: 'Boolean' },
    integer: { bg: 'bg-green-50',  text: 'text-green-700',  border: 'border-green-200',  label: 'Integer' },
    decimal: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200', label: 'Decimal' },
    string:  { bg: 'bg-gray-100',  text: 'text-gray-700',   border: 'border-gray-200',   label: 'String'  },
    json:    { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200', label: 'JSON'    },
};

const TYPE_ICONS: Record<SettingType, React.ElementType> = {
    boolean: ToggleLeft, integer: Hash, decimal: Percent, string: Type, json: Braces,
};

const KNOWN_ENUMS: Record<string, string[]> = {
    'visit.gps.strict_mode': ['STRICT', 'WARNING', 'OFF'],
};

const isHexColor = (val: unknown): val is string =>
    typeof val === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(val.trim());

const isColorKey = (key: string): boolean =>
    /color|colour|accent|primary|secondary|brand|background|bg_|_bg$/i.test(key);

const NAMESPACE_LABELS: Record<string, string> = {
    visit: 'Visite terrain / SFA', wms: 'WMS / Entrepôt', order: 'Commandes',
    delivery: 'Livraison', finance: 'Finance / Crédit', erp: 'ERP / Intégrations',
    conventional: 'Chargement conventionnel', itinerary: 'Tournées / Itinéraires',
};

const NAMESPACE_ICONS: Record<string, string> = {
    visit: '📍', wms: '🏭', order: '📦', delivery: '🚚',
    finance: '💰', erp: '🔗', conventional: '🏗️', itinerary: '🗺️',
};

// ─── Reset modal ──────────────────────────────────────────────────────────────

const ResetModal: React.FC<{
    settingKey: string; onConfirm: () => void; onCancel: () => void; loading: boolean;
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

// ─── Value editor ──────────────────────────────────────────────────────────────

const ValueEditor: React.FC<{
    settingKey: string; type: SettingType; value: unknown;
    jsonError?: string; isOverride: boolean; onChange: (v: unknown) => void;
}> = ({ settingKey, type, value, jsonError, isOverride, onChange }) => {
    const baseCls = `text-xs border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sage-500 transition-colors ${
        isOverride ? 'bg-white border-gray-200' : 'bg-gray-50 border-gray-100 text-gray-400 italic'
    }`;

    if (type === 'boolean') {
        const bool = value === null || value === undefined ? false : Boolean(value);
        const isDefault = !isOverride && value === null;
        if (isDefault) return (
            <button onClick={() => onChange(false)} className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-200 opacity-40 cursor-pointer hover:opacity-60 transition-opacity" title="Cliquer pour créer un override">
                <span className="inline-block h-4 w-4 translate-x-1 rounded-full bg-white shadow" />
            </button>
        );
        return (
            <button onClick={() => onChange(!bool)} className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-sage-500 ${bool ? 'bg-sage-600' : 'bg-gray-200'}`} role="switch" aria-checked={bool}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${bool ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
        );
    }

    if (type === 'string') {
        const enumOpts = KNOWN_ENUMS[settingKey];
        if (enumOpts) return (
            <select value={String(value ?? '')} onChange={e => onChange(e.target.value)} className={`${baseCls} min-w-[120px]`}>
                {!isOverride && <option value="">— défaut global —</option>}
                {enumOpts.map(o => <option key={o} value={o}>{o}</option>)}
            </select>
        );

        const strVal = String(value ?? '');
        const showColorPicker = isHexColor(value) || (isColorKey(settingKey) && (strVal === '' || isHexColor(value)));
        if (showColorPicker) {
            const colorRef = React.useRef<HTMLInputElement>(null);
            const safeHex = isHexColor(value) ? value : '#000000';
            return (
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => colorRef.current?.click()} className="w-8 h-8 rounded-lg border-2 border-gray-200 shadow-sm hover:scale-110 transition-transform shrink-0 relative overflow-hidden" style={{ backgroundColor: safeHex }}>
                        <input ref={colorRef} type="color" value={safeHex} onChange={e => onChange(e.target.value)} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" tabIndex={-1} />
                    </button>
                    <input type="text" value={strVal} placeholder="#rrggbb" onChange={e => onChange(e.target.value)} className={`${baseCls} w-28 font-mono uppercase`} maxLength={9} />
                    {isHexColor(value) && (
                        <span className="text-[10px] font-mono px-1.5 py-0.5 rounded-md border" style={{ backgroundColor: safeHex + '22', color: safeHex, borderColor: safeHex + '55' }}>{safeHex.toUpperCase()}</span>
                    )}
                </div>
            );
        }
        return <input type="text" value={strVal} placeholder={isOverride ? '' : '— défaut global —'} onChange={e => onChange(e.target.value)} className={`${baseCls} min-w-[140px]`} />;
    }

    if (type === 'integer') return (
        <input type="number" step="1" value={value === null || value === undefined ? '' : String(value)} placeholder={isOverride ? '' : '—'} onChange={e => onChange(e.target.value === '' ? null : parseInt(e.target.value, 10))} className={`${baseCls} w-28 text-right font-mono`} />
    );

    if (type === 'decimal') return (
        <input type="number" step="0.01" value={value === null || value === undefined ? '' : String(value)} placeholder={isOverride ? '' : '—'} onChange={e => onChange(e.target.value === '' ? null : parseFloat(e.target.value))} className={`${baseCls} w-28 text-right font-mono`} />
    );

    const jsonStr = value === null || value === undefined ? '' : (typeof value === 'string' ? value : JSON.stringify(value, null, 2));
    return (
        <div className="flex-1">
            <textarea value={jsonStr} placeholder={isOverride ? '' : '— défaut global —'} onChange={e => onChange(e.target.value)} rows={3} spellCheck={false}
                className={`w-full text-xs font-mono border rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-sage-500 resize-y min-w-[220px] ${
                    jsonError ? 'border-red-300 bg-red-50/30' : isOverride ? 'border-gray-200 bg-white' : 'border-gray-100 bg-gray-50 text-gray-400 italic'
                }`}
            />
            {jsonError && <p className="text-[10px] text-red-600 mt-0.5">{jsonError}</p>}
        </div>
    );
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

    const { data: sfaParamsData, loading: sfaLoading } = useSfaParams();
    const { data: entities, loading: entitiesLoading, debouncedSearch } = useScopeEntities(activeScopeKey);
    const { data: settingsData, loading: settingsLoading, refetch: refetchSettings } = useConfigSettings(
        selectedEntity ? scopeType : null, selectedEntity?.id ?? null
    );

    const rawSettings    = useMemo(() => settingsData?.settings ?? [], [settingsData]);
    const sfaParamsList  = useMemo(() => sfaParamsData?.params ?? [], [sfaParamsData]);
    const rawGrouped     = useMemo(() => sfaParamsData?.grouped ?? {}, [sfaParamsData]);

    const effectiveSfaParams = useMemo(() =>
        sfaParamsList.length > 0 ? sfaParamsList
            : rawSettings.map(s => ({ key: s.key, value_type: s.type, description: s.key })),
        [sfaParamsList, rawSettings]
    );

    const effectiveGrouped = useMemo(() =>
        Object.keys(rawGrouped).length > 0 ? rawGrouped
            : effectiveSfaParams.reduce<Record<string, typeof effectiveSfaParams>>((acc, p) => {
                const ns = p.key.split('.')[0] ?? 'other';
                if (!acc[ns]) acc[ns] = [];
                acc[ns].push(p);
                return acc;
            }, {}),
        [rawGrouped, effectiveSfaParams]
    );

    const dictUnavailable = sfaParamsList.length === 0 && rawSettings.length > 0;

    const { drafts, updateDraft, resetDraftLocal, clearOverride, hasDirty, dirtyKeys, getDirtyPayload } = useParamDrafts(effectiveSfaParams, rawSettings);
    const { execute: saveBatchFn, loading: saving } = useSaveBatch();
    const { execute: resetSettingFn, loading: resetting } = useResetSetting();

    const handleScopeChange = (key: ScopeKey) => {
        setActiveScopeKey(key);
        setSelectedEntity(key === 'SYSTEM' ? { id: 0, name: 'Paramètres Système' } : null);
        setEntitySearch('');
        setGlobalSearch('');
        setShowScopeModal(false);
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
        setExpandedNs(prev => { const n = new Set(prev); n.has(ns) ? n.delete(ns) : n.add(ns); return n; });
    };

    const expandAll  = useCallback(() => setExpandedNs(new Set(Object.keys(effectiveGrouped))), [effectiveGrouped]);
    const collapseAll = useCallback(() => setExpandedNs(new Set()), []);

    const handleSaveAll = async () => {
        if (!selectedEntity || !hasDirty) return;
        const payload = getDirtyPayload();
        if (Object.keys(payload).length === 0) return;
        const toastId = toast.loading(`Sauvegarde de ${dirtyKeys.length} paramètre(s)…`);
        try {
            await saveBatchFn({ configurable_type: scopeType, configurable_id: selectedEntity.id, settings: payload });
            toast.dismiss(toastId);
            toast.success(`${dirtyKeys.length} paramètre(s) sauvegardé(s)`);
            refetchSettings();
        } catch (e: any) {
            toast.dismiss(toastId);
            const unknown = e?.response?.data?.unknown_keys?.join(', ');
            toast.error(unknown ? `Clés inconnues : ${unknown}` : (e?.response?.data?.message || 'Erreur de sauvegarde'));
        }
    };

    const handleConfirmReset = async () => {
        if (!selectedEntity || !resetTarget) return;
        const toastId = toast.loading('Réinitialisation…');
        try {
            await resetSettingFn({ configurable_type: scopeType, configurable_id: selectedEntity.id, key: resetTarget });
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
        const handler = (e: BeforeUnloadEvent) => { if (hasDirty) { e.preventDefault(); e.returnValue = ''; } };
        window.addEventListener('beforeunload', handler);
        return () => window.removeEventListener('beforeunload', handler);
    }, [hasDirty]);

    const overrideCount = rawSettings.length;
    const nsOverrideCounts = rawSettings.reduce<Record<string, number>>((acc, s) => {
        const ns = s.key.split('.')[0] ?? 'other';
        acc[ns] = (acc[ns] ?? 0) + 1;
        return acc;
    }, {});

    // Entity DataGrid columns
    const c = SCOPE_COLORS[activeScopeKey];
    const ScopeIcon = SCOPE_ICONS[activeScopeKey];

    const entityColumnDefs = useMemo(() => [
        {
            colId: 'entity_name',
            headerName: 'Nom',
            flex: 1,
            minWidth: 80,
            resizable: false,
            sortable: false,
            filter: false,
            floatingFilter: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-2 h-full min-w-0">
                    <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 font-bold text-[10px] ${c.bg} ${c.text}`}>
                        {(p.data?.name as string)?.charAt(0)?.toUpperCase() ?? '?'}
                    </div>
                    <span className="text-[11px] font-semibold text-gray-800 truncate">{p.data?.name}</span>
                </div>
            ),
        },
        ...(entities.some((e: any) => e.description) ? [{
            colId: 'entity_code',
            headerName: 'Code',
            width: 72,
            resizable: false,
            sortable: false,
            filter: false,
            floatingFilter: false,
            cellRenderer: (p: any) => p.data?.description ? (
                <span style={{ fontFamily: 'monospace', fontSize: '10px', fontWeight: 600, color: '#6b7280' }}>
                    {p.data.description}
                </span>
            ) : null,
        }] : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    ], [activeScopeKey, entities]);

    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        const groups: { items: ActionItemProps[] }[] = [
            {
                items: [
                    { icon: Save, label: hasDirty ? `Sauvegarder (${dirtyKeys.length})` : 'Sauvegarder', variant: 'primary' as const, onClick: handleSaveAll, disabled: !hasDirty || saving || !selectedEntity },
                    { icon: RefreshCw, label: 'Actualiser', variant: 'default' as const, onClick: refetchSettings, disabled: !selectedEntity },
                ],
            },
        ];
        if (selectedEntity) {
            groups.push({
                items: [
                    { icon: ChevronsDown, label: 'Tout déplier', variant: 'default' as const, onClick: expandAll },
                    { icon: ChevronsUp,   label: 'Tout replier', variant: 'default' as const, onClick: collapseAll },
                    { icon: Zap, label: 'Overrides uniquement', variant: (showOverridesOnly ? 'primary' : 'default') as const, onClick: () => setShowOverridesOnly(v => !v) },
                ],
            });
        }
        return groups;
    }, [hasDirty, dirtyKeys.length, saving, selectedEntity, showOverridesOnly, expandAll, collapseAll]);

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col">

                        {/* Header */}
                        <div className="px-3 pt-3 pb-3 border-b border-gray-100 shrink-0 space-y-2">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center shrink-0">
                                    <Settings2 className="w-4 h-4 text-white" />
                                </div>
                                <div>
                                    <h1 className="text-sm font-bold text-gray-900 leading-tight">Configuration</h1>
                                    <p className="text-[10px] text-gray-400">Paramètres dynamiques</p>
                                </div>
                            </div>

                            {/* Scope pill — full width, below title */}
                            <button
                                onClick={() => setShowScopeModal(true)}
                                className={`w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-lg border text-[11px] font-semibold transition-colors hover:opacity-80 ${c.pill}`}
                            >
                                <ScopeIcon className="w-3 h-3" />
                                <span>{SCOPE_LABELS[activeScopeKey]}</span>
                                <ChevronDownSm className="w-3 h-3 opacity-60" />
                            </button>
                        </div>

                        {/* SYSTEM banner */}
                        {activeScopeKey === 'SYSTEM' && (
                            <div className="px-3 py-2.5 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-indigo-50 border border-indigo-100 text-xs text-indigo-700">
                                    <Globe className="w-4 h-4 shrink-0" />
                                    <div>
                                        <div className="font-semibold">Paramètres globaux</div>
                                        <div className="text-[10px] text-indigo-500">id = 0 · base de tous les scopes</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Entity search */}
                        {activeScopeKey !== 'SYSTEM' && (
                            <div className="px-3 py-2 border-b border-gray-100 shrink-0">
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
                                {entities.length > 0 && (
                                    <p className="text-[10px] text-gray-400 mt-1.5 px-0.5">
                                        {entities.length} {SCOPE_LABELS[activeScopeKey].toLowerCase()}{entities.length > 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                        )}

                        {/* Entity DataGrid */}
                        {activeScopeKey !== 'SYSTEM' && (
                            <div className="flex-1 min-h-0">
                                {entitiesLoading ? (
                                    <div className="p-3 space-y-1.5">
                                        {[...Array(6)].map((_, i) => (
                                            <div key={i} className="h-9 bg-gray-50 rounded-lg animate-pulse" />
                                        ))}
                                    </div>
                                ) : entities.length === 0 ? (
                                    <div className="p-6 text-center text-xs text-gray-400">
                                        <Users className="w-8 h-8 mx-auto mb-2 text-gray-200" />
                                        Aucun résultat
                                    </div>
                                ) : (
                                    <DataGrid
                                        rowData={entities}
                                        columnDefs={entityColumnDefs}
                                        loading={entitiesLoading}
                                        pagination={false}
                                        rowSelection="single"
                                        suppressAutoFit
                                        headerHeight={0}
                                        rowHeight={38}
                                        onRowClicked={(e: any) => {
                                            if (e.data) setSelectedEntity({ id: e.data.id, name: e.data.name });
                                        }}
                                        defaultSelectedIds={(row: any) => row.id === selectedEntity?.id}
                                    />
                                )}
                            </div>
                        )}
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
                                    <div className="flex items-center gap-3 min-w-0">
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-sm shrink-0 ${c.active}`}>
                                            {selectedEntity.name.charAt(0).toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <h2 className="text-sm font-bold text-gray-900">{selectedEntity.name}</h2>
                                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.bg} ${c.text} ${c.border}`}>
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

                                    <div className="mt-3 relative">
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

                                    {hasDirty && (
                                        <div className="mt-2 flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                                            <span><strong>{dirtyKeys.length}</strong> modification{dirtyKeys.length > 1 ? 's' : ''} non sauvegardée{dirtyKeys.length > 1 ? 's' : ''} — pensez à sauvegarder.</span>
                                        </div>
                                    )}
                                </div>

                                {/* Accordions */}
                                <div className="flex-1 overflow-y-auto px-4 py-4 space-y-2">
                                    {sfaLoading || settingsLoading ? (
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
                                            if (showOverridesOnly) visible = visible.filter(p => drafts[p.key]?.isOverride || drafts[p.key]?.isDirty);
                                            if (visible.length === 0) return null;

                                            const isExpanded  = expandedNs.has(ns);
                                            const nsOverride  = nsOverrideCounts[ns] ?? 0;
                                            const nsLabel     = NAMESPACE_LABELS[ns] ?? ns;
                                            const nsIcon      = NAMESPACE_ICONS[ns] ?? '⚙️';
                                            const nsDirty     = visible.filter(p => drafts[p.key]?.isDirty).length;

                                            return (
                                                <div key={ns} id={`ns-${ns}`} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                                    <button onClick={() => toggleNamespace(ns)} className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50/80 hover:bg-gray-100/60 transition-colors text-left">
                                                        <span className="text-base leading-none">{nsIcon}</span>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-xs font-bold text-gray-800">{nsLabel}</span>
                                                                <code className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{ns}</code>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {nsDirty > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-amber-100 text-amber-700 rounded-full">{nsDirty} ✏️</span>}
                                                            {nsOverride > 0 && <span className="px-1.5 py-0.5 text-[10px] font-bold bg-sage-100 text-sage-700 rounded-full">{nsOverride} override{nsOverride > 1 ? 's' : ''}</span>}
                                                            <span className="text-[10px] text-gray-400 font-medium">{visible.length}</span>
                                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-gray-400" /> : <ChevronRight className="w-3.5 h-3.5 text-gray-400" />}
                                                        </div>
                                                    </button>

                                                    {isExpanded && (
                                                        <div className="divide-y divide-gray-50">
                                                            {visible.map(param => {
                                                                const draft = drafts[param.key];
                                                                if (!draft) return null;
                                                                const ts = TYPE_STYLES[param.value_type];
                                                                const TypeIcon = TYPE_ICONS[param.value_type];
                                                                const isDirty    = draft.isDirty;
                                                                const isOverride = draft.isOverride;
                                                                return (
                                                                    <div key={param.key} className={`group flex items-start gap-4 px-4 py-3 transition-colors border-l-2 ${
                                                                        isDirty ? 'bg-amber-50/30 border-amber-400' : isOverride ? 'bg-sage-50/20 border-sage-300 hover:bg-sage-50/30' : 'border-transparent hover:bg-gray-50/60'
                                                                    }`}>
                                                                        <div className="flex-1 min-w-0 pt-0.5">
                                                                            <div className="flex items-center gap-2 flex-wrap">
                                                                                <code className={`text-xs font-mono font-semibold ${isOverride || isDirty ? 'text-gray-800' : 'text-gray-400'}`}>{param.key}</code>
                                                                                {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />}
                                                                                {isOverride && !isDirty && <span className="text-[9px] font-bold text-sage-600 bg-sage-50 border border-sage-200 px-1 rounded uppercase tracking-wide">override</span>}
                                                                            </div>
                                                                            {param.description && param.description !== param.key ? (
                                                                                <p className={`text-[11px] mt-1 leading-snug flex items-start gap-1 ${isOverride || isDirty ? 'text-gray-500' : 'text-gray-400'}`}>
                                                                                    <Info className="w-3 h-3 shrink-0 mt-0.5 text-gray-300" />
                                                                                    {param.description}
                                                                                </p>
                                                                            ) : (
                                                                                <p className="text-[10px] mt-0.5 text-gray-300 italic">Aucune description disponible</p>
                                                                            )}
                                                                        </div>
                                                                        <div className="pt-0.5 shrink-0">
                                                                            <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-semibold border ${ts.bg} ${ts.text} ${ts.border} ${!isOverride && !isDirty ? 'opacity-40' : ''}`}>
                                                                                <TypeIcon className="w-2.5 h-2.5" />
                                                                                {ts.label}
                                                                            </span>
                                                                        </div>
                                                                        <div className={`pt-0.5 shrink-0 ${param.value_type === 'json' ? 'flex-1' : ''}`}>
                                                                            <ValueEditor settingKey={param.key} type={param.value_type} value={draft.currentValue} jsonError={draft.jsonError} isOverride={isOverride} onChange={v => updateDraft(param.key, v)} />
                                                                        </div>
                                                                        <div className="flex items-center gap-1 pt-0.5 shrink-0">
                                                                            {isDirty && (
                                                                                <button onClick={() => resetDraftLocal(param.key)} title="Annuler les modifications" className="p-1.5 rounded-lg text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors">
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            )}
                                                                            {isOverride && (
                                                                                <button onClick={() => setResetTarget(param.key)} title="Réinitialiser au défaut global" className="p-1.5 rounded-lg text-gray-200 hover:text-amber-500 hover:bg-amber-50 transition-colors">
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

                                    {dictUnavailable && (
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-amber-50 border border-amber-200 rounded-xl text-[11px] text-amber-700">
                                            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>Dictionnaire <code className="font-mono bg-amber-100 px-1 rounded">sfa-params</code> indisponible — affichage des overrides uniquement, sans descriptions.</span>
                                        </div>
                                    )}
                                    {!sfaLoading && !settingsLoading && selectedEntity && effectiveSfaParams.length > 0 && !dictUnavailable && (
                                        <div className="flex items-start gap-2 px-3 py-2.5 bg-blue-50 border border-blue-100 rounded-xl text-[11px] text-blue-700">
                                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                            <span>
                                                <span className="font-semibold">Lignes en grisé</span> = valeur par défaut globale.{' '}
                                                <span className="font-semibold">Barre verte</span> = override actif. Priorité :{' '}
                                                <span className="font-mono">User → AccessProfile → Role → Branch → Company → System</span>.
                                            </span>
                                        </div>
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                }

                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Scope picker modal */}
            <Dialog open={showScopeModal} onOpenChange={setShowScopeModal}>
                <DialogContent className="max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center">
                                <Settings2 className="w-4 h-4 text-white" />
                            </div>
                            Choisir un scope de configuration
                        </DialogTitle>
                    </DialogHeader>

                    <div className="grid grid-cols-2 gap-2 py-2">
                        {SCOPE_KEYS.map(key => {
                            const Icon = SCOPE_ICONS[key];
                            const col = SCOPE_COLORS[key];
                            const isActive = activeScopeKey === key;
                            return (
                                <button
                                    key={key}
                                    onClick={() => handleScopeChange(key)}
                                    className={`relative flex items-start gap-3 p-3.5 rounded-xl border-2 text-left transition-all ${
                                        isActive ? `${col.active} border-transparent shadow-md` : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                    }`}
                                >
                                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${isActive ? 'bg-white/20' : `${col.bg} border ${col.border}`}`}>
                                        <Icon className={`w-[18px] h-[18px] ${isActive ? 'text-white' : col.text}`} />
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

                    <p className="text-[10px] text-gray-400 text-center pb-1">
                        Priorité : <span className="font-mono text-gray-600">User → AccessProfile → Role → Branch → Company → System</span>
                    </p>
                </DialogContent>
            </Dialog>

            {/* Reset confirm modal */}
            {resetTarget && (
                <ResetModal settingKey={resetTarget} onConfirm={handleConfirmReset} onCancel={() => setResetTarget(null)} loading={resetting} />
            )}
        </>
    );
};
