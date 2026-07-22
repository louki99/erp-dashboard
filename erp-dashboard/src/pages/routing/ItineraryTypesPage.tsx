import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Route,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    Power,
    PowerOff,
    X,
    Search,
    Briefcase,
    ListChecks,
    Truck,
    CheckCircle2,
    ExternalLink,
    Layers,
    AlertTriangle,
    ChevronRight,
    Tag,
    Hash,
    Globe2,
    Loader2,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

import { ItineraryTypeForm } from '@/components/routing';
import {
    useBusinessNatures,
    useCreateItineraryType,
    useDeleteItineraryType,
    useItineraries,
    useItineraryTypes,
    useUpdateItineraryType,
} from '@/hooks/routing/useRouting';
import type {
    CreateItineraryTypePayload,
    ItineraryBusinessNature,
    ItineraryType,
    ItineraryTypeFilters,
    UpdateItineraryTypePayload,
} from '@/types/routing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

const DEFAULT_FILTERS: ItineraryTypeFilters = { per_page: 100, page: 1 };

// ─── Type list item ───────────────────────────────────────────────────────────

function TypeListItem({
    type,
    nature,
    selected,
    onClick,
}: {
    type: ItineraryType;
    nature?: ItineraryBusinessNature;
    selected: boolean;
    onClick: () => void;
}) {
    return (
        <button
            onClick={onClick}
            className={[
                'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors relative',
                selected ? 'bg-sage-50' : 'hover:bg-gray-50',
            ].join(' ')}
        >
            {selected && <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-sage-500" />}
            <span className={['w-2 h-2 rounded-full shrink-0', type.is_active ? 'bg-emerald-400' : 'bg-gray-300'].join(' ')} />

            <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                    <p className={['text-sm font-medium truncate', selected ? 'text-sage-800' : 'text-gray-800'].join(' ')}>
                        {type.name}
                    </p>
                    {type.name_ar && (
                        <span className="text-[11px] text-gray-400 shrink-0" dir="rtl">{type.name_ar}</span>
                    )}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-gray-400">{type.code}</span>
                    {nature && <span className="text-[11px] text-gray-400 truncate">· {nature.label}</span>}
                </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-300" />
        </button>
    );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ItineraryTypeDetail({
    type,
    nature,
    onBack,
    onEdit,
    onToggle,
    onDelete,
    togglePending,
}: {
    type: ItineraryType;
    nature: ItineraryBusinessNature | undefined;
    onBack?: () => void;
    onEdit: (type: ItineraryType) => void;
    onToggle: (type: ItineraryType) => void;
    onDelete: (type: ItineraryType) => void;
    togglePending: boolean;
}) {
    const navigate = useNavigate();

    const { data: linkedData, isLoading: linkedLoading } = useItineraries({
        itinerary_type_id: type.id,
        per_page: 5,
    });
    const linked      = linkedData?.itineraries.data ?? [];
    const linkedTotal = linkedData?.itineraries.total ?? 0;
    const actions     = nature?.action_rules?.actions ?? [];

    return (
        <div className="h-full flex flex-col bg-gray-50/40">

            {/* ── Hero header ── */}
            <div className="shrink-0 bg-white border-b border-gray-100">
                {/* Top bar */}
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-4">
                        <div className={[
                            'w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border',
                            type.is_active
                                ? 'bg-gradient-to-br from-sage-500 to-sage-700 border-sage-600 text-white'
                                : 'bg-gray-100 border-gray-200 text-gray-400',
                        ].join(' ')}>
                            <Route className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900 leading-none">{type.name}</h1>
                                {type.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">{type.name_ar}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5">
                                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                    <Hash className="w-3 h-3" />{type.code}
                                </span>
                                {nature && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                                        <Briefcase className="w-3 h-3" />{nature.label}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                        {/* Active toggle pill */}
                        <button
                            onClick={() => !togglePending && onToggle(type)}
                            disabled={togglePending}
                            className={[
                                'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all',
                                type.is_active
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100',
                                togglePending && 'opacity-50 cursor-not-allowed',
                            ].join(' ')}
                        >
                            {togglePending
                                ? <Loader2 className="w-3 h-3 animate-spin" />
                                : <span className={['w-1.5 h-1.5 rounded-full', type.is_active ? 'bg-emerald-500' : 'bg-gray-400'].join(' ')} />
                            }
                            {type.is_active ? 'Actif' : 'Inactif'}
                        </button>

                        <Button variant="outline" size="sm" onClick={() => onEdit(type)} className="gap-1.5">
                            <Edit2 className="w-3.5 h-3.5" />Éditer
                        </Button>

                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(type)}
                            className="gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </Button>

                        {onBack && (
                            <Button variant="ghost" size="sm" onClick={onBack} className="w-8 h-8 p-0 text-gray-400">
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-3 divide-x divide-gray-100 border-t border-gray-100">
                    {[
                        { label: 'Tournées liées', value: linkedTotal, icon: <Truck className="w-3.5 h-3.5 text-amber-500" /> },
                        { label: 'Actions playbook', value: actions.length, icon: <ListChecks className="w-3.5 h-3.5 text-blue-500" /> },
                        { label: 'Obligatoires', value: actions.filter((a) => a.required).length, icon: <CheckCircle2 className="w-3.5 h-3.5 text-red-400" /> },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-2.5 px-6 py-3">
                            {s.icon}
                            <div>
                                <p className="text-sm font-bold text-gray-900 leading-none">{s.value}</p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* ── Body ── */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">

                {/* Info + Playbook row */}
                <div className="grid grid-cols-2 gap-4">

                    {/* Informations */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                            <Tag className="w-3.5 h-3.5 text-sage-500" />
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Informations</p>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {[
                                { label: 'Code', value: <span className="font-mono text-gray-800 text-xs">{type.code}</span> },
                                { label: 'Nom (FR)', value: <span className="text-gray-800 text-sm">{type.name}</span> },
                                { label: 'Nom (AR)', value: type.name_ar
                                    ? <span className="text-gray-800 text-sm" dir="rtl">{type.name_ar}</span>
                                    : <span className="text-gray-300 text-sm">—</span>
                                },
                                { label: 'Statut', value: (
                                    <span className={['text-xs font-semibold', type.is_active ? 'text-emerald-600' : 'text-gray-400'].join(' ')}>
                                        {type.is_active ? '● Actif' : '○ Inactif'}
                                    </span>
                                )},
                            ].map((row) => (
                                <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                    <span className="text-xs text-gray-400">{row.label}</span>
                                    {row.value}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Nature business */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                            <Briefcase className="w-3.5 h-3.5 text-blue-500" />
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Nature business</p>
                        </div>

                        {nature ? (
                            <div>
                                <div className="divide-y divide-gray-50">
                                    {[
                                        { label: 'Playbook', value: <span className="text-sm font-medium text-gray-800">{nature.label}</span> },
                                        { label: 'Code', value: <span className="font-mono text-xs text-gray-600">{nature.code}</span> },
                                        { label: 'Actions', value: (
                                            <span className="text-sm text-gray-800">
                                                {actions.length}
                                                {actions.filter((a) => a.required).length > 0 &&
                                                    <span className="text-xs text-red-500 ml-1">({actions.filter((a) => a.required).length} oblig.)</span>
                                                }
                                            </span>
                                        )},
                                    ].map((row) => (
                                        <div key={row.label} className="flex items-center justify-between px-4 py-2.5">
                                            <span className="text-xs text-gray-400">{row.label}</span>
                                            {row.value}
                                        </div>
                                    ))}
                                </div>
                                <div className="px-4 py-3 border-t border-gray-50">
                                    <button
                                        onClick={() => navigate('/routing/business-natures')}
                                        className="inline-flex items-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 font-medium"
                                    >
                                        <ExternalLink className="w-3 h-3" />Gérer les playbooks
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-8 text-center px-4">
                                <div className="w-9 h-9 rounded-xl bg-gray-100 flex items-center justify-center mb-3">
                                    <Globe2 className="w-4 h-4 text-gray-300" />
                                </div>
                                <p className="text-xs font-medium text-gray-500">Aucun playbook associé</p>
                                <p className="text-[11px] text-gray-400 mt-1">Les visites de ce type n'ont pas de règles d'action.</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* Description */}
                {type.description && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-4 py-4">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</p>
                        <p className="text-sm text-gray-700 leading-relaxed">{type.description}</p>
                    </div>
                )}

                {/* Playbook actions */}
                {actions.length > 0 && (
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                            <div className="flex items-center gap-2">
                                <ListChecks className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Actions du playbook</p>
                            </div>
                            <span className="text-xs font-mono text-gray-400">{actions.length} action(s)</span>
                        </div>
                        <div className="divide-y divide-gray-50">
                            {actions.map((action, idx) => (
                                <div
                                    key={`${action.visit_action_code}-${idx}`}
                                    className="flex items-center gap-3 px-4 py-3"
                                >
                                    <span className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 text-[10px] font-bold flex items-center justify-center shrink-0">
                                        {idx + 1}
                                    </span>
                                    <span className="font-mono text-xs text-gray-700 flex-1">{action.visit_action_code}</span>
                                    {action.required && (
                                        <span className="text-[10px] font-semibold text-red-500 bg-red-50 px-1.5 py-0.5 rounded">
                                            Obligatoire
                                        </span>
                                    )}
                                    <span className="text-[11px] text-gray-400 shrink-0">
                                        {action.gates_any?.[0]?.[0] ?? 'always'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Linked itineraries */}
                <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                        <div className="flex items-center gap-2">
                            <Truck className="w-3.5 h-3.5 text-amber-500" />
                            <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">Tournées de ce type</p>
                        </div>
                        <span className="text-xs font-mono text-gray-400">{linkedTotal} au total</span>
                    </div>

                    {linkedLoading ? (
                        <div className="divide-y divide-gray-50">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-14 px-4 flex items-center gap-3">
                                    <div className="w-8 h-8 rounded-lg bg-gray-100 animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-1.5">
                                        <div className="h-3 rounded bg-gray-100 animate-pulse w-2/3" />
                                        <div className="h-2.5 rounded bg-gray-100 animate-pulse w-1/3" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : linked.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                            <Truck className="w-6 h-6 text-gray-200 mb-2" />
                            <p className="text-xs text-gray-400">Aucune tournée n'utilise ce type.</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-50">
                            {linked.map((it) => (
                                <div key={it.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors">
                                    <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0">
                                        <Truck className="w-3.5 h-3.5 text-amber-500" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-800 truncate">{it.name}</p>
                                        <p className="text-[11px] font-mono text-gray-400 truncate">{it.code}</p>
                                    </div>
                                    {it.rider && (
                                        <span className="text-xs text-gray-500 shrink-0">{it.rider.name}</span>
                                    )}
                                    <span className={[
                                        'text-[10px] font-semibold px-2 py-0.5 rounded-full',
                                        it.is_active
                                            ? 'text-emerald-600 bg-emerald-50'
                                            : 'text-gray-400 bg-gray-100',
                                    ].join(' ')}>
                                        {it.is_active ? 'Actif' : 'Inactif'}
                                    </span>
                                </div>
                            ))}
                            {linkedTotal > linked.length && (
                                <button
                                    onClick={() => navigate('/routing/itineraries')}
                                    className="w-full flex items-center justify-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 py-3 hover:bg-sage-50/30 transition-colors"
                                >
                                    Voir les {linkedTotal} tournées
                                    <ChevronRight className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Dashboard (no selection) ─────────────────────────────────────────────────

function TypesDashboard({ types }: { types: ItineraryType[] }) {
    const kpis = [
        { label: 'Types de tournée', value: types.length, icon: <Route className="w-5 h-5 text-sage-600" />, bg: 'bg-sage-50 border-sage-200', num: 'text-sage-700' },
        { label: 'Actifs', value: types.filter((t) => t.is_active).length, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-200', num: 'text-emerald-700' },
        { label: 'Avec playbook', value: types.filter((t) => t.business_nature_id != null).length, icon: <Briefcase className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 border-blue-200', num: 'text-blue-700' },
        { label: 'Sans playbook', value: types.filter((t) => t.business_nature_id == null).length, icon: <Layers className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50 border-amber-200', num: 'text-amber-700' },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/40">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-sage-50 border border-sage-100 flex items-center justify-center mx-auto mb-4">
                        <Route className="w-7 h-7 text-sage-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Types de tournée</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                        Chaque type détermine le playbook de visite appliqué sur le terrain.
                        Sélectionnez un type dans la liste pour voir ses détails.
                    </p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`rounded-2xl border p-5 ${kpi.bg}`}>
                            <div className="mb-3">{kpi.icon}</div>
                            <p className={`text-3xl font-bold leading-none ${kpi.num}`}>{kpi.value}</p>
                            <p className="text-xs text-gray-500 mt-1.5">{kpi.label}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ItineraryTypesPage() {
    const [filters, setFilters]       = useState<ItineraryTypeFilters>(DEFAULT_FILTERS);
    const [activeOnly, setActiveOnly] = useState(false);
    const [search, setSearch]         = useState('');
    const { data, isLoading, refetch } = useItineraryTypes(filters);
    const { data: businessNatures }   = useBusinessNatures();

    const [selectedType, setSelectedType]   = useState<ItineraryType | null>(null);
    const [editingType, setEditingType]     = useState<ItineraryType | null | undefined>(undefined);
    const [typeToDelete, setTypeToDelete]   = useState<ItineraryType | null>(null);

    const createType = useCreateItineraryType();
    const updateType = useUpdateItineraryType(editingType?.id ?? 0);
    const toggleType = useUpdateItineraryType(selectedType?.id ?? 0);
    const deleteType = useDeleteItineraryType();

    const naturesById = useMemo(
        () => new Map((businessNatures ?? []).map((n) => [n.id, n])),
        [businessNatures]
    );

    const allTypes = data?.data?.data ?? [];
    const totalCount = data?.data?.total ?? 0;

    const rows = useMemo(() => {
        let list = allTypes;
        if (activeOnly) list = list.filter((t) => t.is_active);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter((t) => t.name.toLowerCase().includes(q) || t.code.toLowerCase().includes(q));
        }
        return list;
    }, [allTypes, activeOnly, search]);

    const handleFormSubmit = async (payload: CreateItineraryTypePayload | UpdateItineraryTypePayload) => {
        try {
            if (editingType) {
                await updateType.mutateAsync(payload);
                toast.success('Type mis à jour.');
            } else {
                await createType.mutateAsync(payload as CreateItineraryTypePayload);
                toast.success('Type créé.');
            }
            setEditingType(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleToggle = async (type: ItineraryType) => {
        try {
            await toggleType.mutateAsync({ is_active: !type.is_active });
            toast.success(type.is_active ? 'Type désactivé.' : 'Type activé.');
            setSelectedType((prev) =>
                prev?.id === type.id ? { ...prev, is_active: !prev.is_active } : prev
            );
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!typeToDelete) return;
        try {
            await deleteType.mutateAsync(typeToDelete.id);
            toast.success('Type supprimé.');
            setTypeToDelete(null);
            if (selectedType?.id === typeToDelete.id) setSelectedType(null);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const actionGroups = [
        {
            items: [
                { icon: Plus, label: 'Nouveau type', variant: 'primary' as const, onClick: () => setEditingType(null) },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selectedType ? [{
            items: [
                { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingType(selectedType) },
                {
                    icon: selectedType.is_active ? PowerOff : Power,
                    label: selectedType.is_active ? 'Désactiver' : 'Activer',
                    variant: 'warning' as const,
                    onClick: () => handleToggle(selectedType),
                },
                { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setTypeToDelete(selectedType) },
            ],
        }] : []),
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Header */}
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                    <Route className="w-4 h-4 text-sage-600" />
                                </div>
                                <h1 className="text-sm font-bold text-gray-900">Types de tournée</h1>
                            </div>
                            <span className="text-[11px] font-mono text-gray-400">{rows.length}/{totalCount}</span>
                        </div>

                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder="Nom, code..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                                className="h-8 text-xs pl-8"
                            />
                        </div>

                        {/* Filter chips */}
                        <div className="flex gap-1.5">
                            {[
                                { label: 'Tous', active: !activeOnly, onClick: () => setActiveOnly(false) },
                                { label: 'Actifs', active: activeOnly, onClick: () => setActiveOnly(true) },
                            ].map((chip) => (
                                <button
                                    key={chip.label}
                                    onClick={chip.onClick}
                                    className={[
                                        'px-2.5 py-1 rounded-full text-[11px] font-medium transition-all',
                                        chip.active
                                            ? 'bg-sage-600 text-white shadow-sm'
                                            : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                                    ].join(' ')}
                                >
                                    {chip.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
                        {isLoading ? (
                            <div className="space-y-1.5 p-2">
                                {[...Array(6)].map((_, i) => (
                                    <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Route className="w-8 h-8 mb-2 text-gray-200" />
                                <p className="text-xs">Aucun type trouvé</p>
                            </div>
                        ) : (
                            rows.map((type) => (
                                <TypeListItem
                                    key={type.id}
                                    type={type}
                                    nature={type.business_nature_id != null ? naturesById.get(type.business_nature_id) : undefined}
                                    selected={selectedType?.id === type.id}
                                    onClick={() => setSelectedType(type)}
                                />
                            ))
                        )}
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    {/* Create / Edit form dialog */}
                    <Dialog open={editingType !== undefined} onOpenChange={(open) => !open && setEditingType(undefined)}>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{editingType ? 'Modifier le type' : 'Nouveau type de tournée'}</DialogTitle>
                                <DialogDescription>
                                    Le playbook (nature business) détermine les règles d'action des visites.
                                </DialogDescription>
                            </DialogHeader>
                            <ItineraryTypeForm
                                key={editingType ? `edit-${editingType.id}` : 'create'}
                                itineraryType={editingType ?? null}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditingType(undefined)}
                                loading={createType.isPending || updateType.isPending}
                            />
                        </DialogContent>
                    </Dialog>

                    {/* Delete confirmation */}
                    <Dialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
                        <DialogContent className="max-w-sm">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="w-4 h-4 text-red-500" />
                                    </span>
                                    Supprimer le type ?
                                </DialogTitle>
                                <DialogDescription>
                                    <strong>{typeToDelete?.name}</strong> ({typeToDelete?.code}) sera supprimé.
                                    Cette action échoue si des tournées utilisent encore ce type.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setTypeToDelete(null)}>Annuler</Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleDelete}
                                    disabled={deleteType.isPending}
                                >
                                    {deleteType.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {selectedType ? (
                        <ItineraryTypeDetail
                            type={selectedType}
                            nature={selectedType.business_nature_id != null ? naturesById.get(selectedType.business_nature_id) : undefined}
                            onBack={() => setSelectedType(null)}
                            onEdit={(t) => setEditingType(t)}
                            onToggle={handleToggle}
                            onDelete={(t) => setTypeToDelete(t)}
                            togglePending={toggleType.isPending}
                        />
                    ) : (
                        <TypesDashboard types={allTypes} />
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
