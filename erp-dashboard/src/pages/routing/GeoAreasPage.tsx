import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    MapPin,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    Power,
    PowerOff,
    X,
    Search,
    FolderTree,
    Users,
    Globe2,
    CheckCircle2,
    Map as MapIcon,
    Layers,
    ExternalLink,
    UserPlus,
    Truck,
    GitBranch,
    Navigation,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DetailCard } from '@/components/common/DetailCard';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs } from '@/components/common/SageTabs';
import SearchableSelect from '@/components/common/SearchableSelect';
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

import { GeoAreaForm } from '@/components/routing';
import {
    useAssignGeoAreaUser,
    useCreateGeoArea,
    useDeleteGeoArea,
    useGeoAreaStatistics,
    useGeoAreaUsers,
    useGeoAreas,
    useItineraries,
    useRemoveGeoAreaUser,
    useToggleGeoArea,
    useUpdateGeoArea,
} from '@/hooks/routing/useRouting';
import { useUsersOptions } from '@/hooks/tokenSeries/useEntitySelectors';
import type {
    CreateGeoAreaPayload,
    GeoArea,
    GeoAreaFilters,
    UpdateGeoAreaPayload,
} from '@/types/routing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
}

const TYPE_ICONS: Record<number, string> = {
    100: '🌍', 200: '📍', 300: '🏙️', 400: '🏘️', 500: '🗺️', 600: '📌',
};

const TYPE_COLORS: Record<number, string> = {
    100: 'bg-blue-50 border-blue-200 text-blue-700',
    200: 'bg-violet-50 border-violet-200 text-violet-700',
    300: 'bg-indigo-50 border-indigo-200 text-indigo-700',
    400: 'bg-sage-50 border-sage-200 text-sage-700',
    500: 'bg-amber-50 border-amber-200 text-amber-700',
    600: 'bg-gray-50 border-gray-200 text-gray-700',
};

const DEFAULT_FILTERS: GeoAreaFilters = { per_page: 100, page: 1 };

// ─── Form panel (inline) ──────────────────────────────────────────────────────

function GeoAreaFormPanel({
    geoArea,
    defaultParentCode,
    geoAreaTypes,
    parentAreas,
    onSubmit,
    onCancel,
    loading,
}: {
    geoArea: GeoArea | null;
    defaultParentCode?: string;
    geoAreaTypes: any[];
    parentAreas: any[];
    onSubmit: (payload: CreateGeoAreaPayload | UpdateGeoAreaPayload) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}) {
    const typeRank = geoArea?.geo_area_type?.rank ?? 0;
    const icon = TYPE_ICONS[typeRank] ?? '📌';
    const colorClass = TYPE_COLORS[typeRank] ?? TYPE_COLORS[600];

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${geoArea ? colorClass : 'bg-sage-50 border-sage-100'}`}>
                            {geoArea ? icon : <Plus className="h-5 w-5 text-sage-600" />}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">
                                {geoArea ? 'Modifier la zone' : 'Nouvelle zone'}
                            </h1>
                            {geoArea && (
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {geoArea.code} · {geoArea.geo_area_type?.name ?? ''}
                                </p>
                            )}
                            {!geoArea && defaultParentCode && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Zone enfant de <span className="font-mono text-gray-600">{defaultParentCode}</span>
                                </p>
                            )}
                            {!geoArea && !defaultParentCode && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Définissez le code, le nom et le niveau hiérarchique
                                </p>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <GeoAreaForm
                    key={geoArea ? `edit-${geoArea.id}` : `create-${defaultParentCode ?? 'root'}`}
                    geoArea={geoArea}
                    defaultParentCode={defaultParentCode}
                    geoAreaTypes={geoAreaTypes}
                    parentAreas={parentAreas}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                />
            </div>
        </div>
    );
}

// ─── Tournées tab ─────────────────────────────────────────────────────────────

function GeoAreaItineraries({ areaId }: { areaId: number }) {
    const navigate = useNavigate();
    const { data, isLoading } = useItineraries({ geo_area_id: areaId, per_page: 50 });
    const rows = data?.itineraries.data ?? [];

    if (isLoading) {
        return (
            <div className="space-y-2 pt-2">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="flex flex-col items-center py-10 text-gray-400">
                <Truck className="w-9 h-9 mb-2 opacity-30" />
                <p className="text-sm">Aucune tournée n'est rattachée à cette zone.</p>
                <Button
                    variant="outline"
                    size="sm"
                    className="mt-4"
                    onClick={() => navigate('/routing/itineraries')}
                >
                    <Plus className="w-3.5 h-3.5 mr-1.5" />
                    Créer une tournée
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-2">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-3">
                {rows.length} tournée{rows.length > 1 ? 's' : ''} dans cette zone
            </p>
            {rows.map((itin) => (
                <button
                    key={itin.id}
                    onClick={() => navigate('/routing/itineraries')}
                    className="w-full flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white hover:border-sage-300 hover:shadow-sm transition-all text-left group"
                >
                    <div className="w-9 h-9 rounded-lg bg-sage-50 border border-sage-100 flex items-center justify-center shrink-0">
                        <Truck className="w-4 h-4 text-sage-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-800 group-hover:text-sage-700 truncate">
                            {itin.name}
                        </p>
                        <p className="text-xs text-gray-400 font-mono">{itin.code}</p>
                    </div>
                    <div className="shrink-0 flex items-center gap-2">
                        {itin.rider && (
                            <span className="text-xs text-gray-500 truncate max-w-[120px]">{itin.rider.name}</span>
                        )}
                        <span className={`text-[10px] font-semibold ${itin.is_active ? 'text-emerald-600' : 'text-gray-400'}`}>
                            {itin.is_active ? '● Active' : '○ Inactive'}
                        </span>
                    </div>
                </button>
            ))}
            <Button
                variant="outline"
                size="sm"
                className="w-full mt-2"
                onClick={() => navigate('/routing/itineraries')}
            >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
                Gérer les tournées
            </Button>
        </div>
    );
}

// ─── Superviseurs tab ─────────────────────────────────────────────────────────

function GeoAreaSuperviseurs({ areaId }: { areaId: number }) {
    const { data: usersData, isLoading } = useGeoAreaUsers(areaId);
    const assignUser = useAssignGeoAreaUser(areaId);
    const removeUser = useRemoveGeoAreaUser(areaId);
    const { data: userOptions } = useUsersOptions();

    const assignedIds = usersData?.users.map((u) => u.id) ?? [];
    const availableOptions = (userOptions ?? [])
        .filter((u) => !assignedIds.includes(u.value as number))
        .map((u) => ({ value: u.value, label: u.label }));

    const handleAssign = async (v: string | number | undefined) => {
        if (!v) return;
        try {
            await assignUser.mutateAsync(Number(v));
            toast.success('Superviseur assigné.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleRemove = async (userId: number) => {
        try {
            await removeUser.mutateAsync(userId);
            toast.success('Superviseur retiré.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    if (isLoading) {
        return (
            <div className="space-y-2 pt-2">
                {[...Array(2)].map((_, i) => (
                    <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                ))}
            </div>
        );
    }

    const users = usersData?.users ?? [];

    return (
        <div className="space-y-4">
            <div className="space-y-1.5">
                <p className="text-xs font-medium text-gray-600">Ajouter un superviseur</p>
                <SearchableSelect
                    options={availableOptions}
                    value={undefined}
                    onChange={handleAssign}
                    placeholder="Rechercher un utilisateur..."
                />
            </div>

            <div className="space-y-2">
                {users.length === 0 ? (
                    <div className="flex flex-col items-center py-8 text-gray-400">
                        <UserPlus className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-sm">Aucun superviseur assigné</p>
                        <p className="text-xs mt-1">Utilisez le champ ci-dessus pour en ajouter</p>
                    </div>
                ) : (
                    <>
                        <p className="text-xs text-gray-400 font-medium uppercase tracking-wider">
                            {users.length} superviseur{users.length > 1 ? 's' : ''} assigné{users.length > 1 ? 's' : ''}
                        </p>
                        {users.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white group hover:border-gray-300 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {u.name.split(' ').map((p: string) => p[0]).slice(0, 2).join('').toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                </div>
                                <button
                                    onClick={() => handleRemove(u.id)}
                                    disabled={removeUser.isPending}
                                    className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                                    title="Retirer"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        ))}
                    </>
                )}
            </div>
        </div>
    );
}

// ─── Detail panel ─────────────────────────────────────────────────────────────

function GeoAreaDetail({
    area,
    onBack,
    onEdit,
    onToggle,
    onCreateChild,
    togglePending,
}: {
    area: GeoArea;
    onBack?: () => void;
    onEdit: (area: GeoArea) => void;
    onToggle: (area: GeoArea) => void;
    onCreateChild: (parentCode: string) => void;
    togglePending?: boolean;
}) {
    const navigate = useNavigate();
    const { data: usersData } = useGeoAreaUsers(area.id);
    const { data: itinerariesData } = useItineraries({ geo_area_id: area.id, per_page: 50 });
    const [activeTab, setActiveTab] = useState('infos');

    const lat = toCoord(area.latitude);
    const lng = toCoord(area.longitude);
    const typeRank = area.geo_area_type?.rank ?? 0;
    const icon = TYPE_ICONS[typeRank] ?? '📌';
    const colorClass = TYPE_COLORS[typeRank] ?? TYPE_COLORS[600];

    const itinCount = itinerariesData?.itineraries.data.length ?? 0;
    const supervisorCount = usersData?.users.length ?? 0;

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${colorClass}`}>
                            {icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">{area.name}</h1>
                                {area.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">{area.name_ar}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                {area.parent && (
                                    <>
                                        <span className="text-gray-500">{area.parent.name}</span>
                                        <span>›</span>
                                    </>
                                )}
                                <span className="font-mono text-gray-500">{area.code}</span>
                                {area.geo_area_type && (
                                    <>
                                        <span>·</span>
                                        <span className="text-gray-500">{area.geo_area_type.name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => !togglePending && onToggle(area)}
                            disabled={togglePending}
                            className="focus:outline-none"
                            title={area.is_active ? 'Désactiver' : 'Activer'}
                        >
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full cursor-pointer hover:opacity-80 transition-opacity ${area.is_active ? 'text-emerald-700 bg-emerald-50 border border-emerald-200' : 'text-gray-500 bg-gray-50 border border-gray-200'}`}>
                                {area.is_active ? '● Actif' : '○ Inactif'}
                            </span>
                        </button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(area)}>
                            <Edit2 className="mr-1.5 h-3.5 w-3.5" />
                            Éditer
                        </Button>
                        {onBack && (
                            <Button variant="ghost" size="sm" onClick={onBack} className="h-8 w-8 p-0">
                                <X className="h-4 w-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* KPI strip */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
                    <button
                        onClick={() => setActiveTab('itineraries')}
                        className="flex items-center gap-1.5 hover:text-sage-600 transition-colors"
                    >
                        <Truck className="w-3.5 h-3.5 text-sage-400" />
                        <strong className="text-gray-700">{itinCount}</strong> tournée{itinCount > 1 ? 's' : ''}
                    </button>
                    <button
                        onClick={() => setActiveTab('superviseurs')}
                        className="flex items-center gap-1.5 hover:text-amber-600 transition-colors"
                    >
                        <Users className="w-3.5 h-3.5 text-amber-400" />
                        <strong className="text-gray-700">{supervisorCount}</strong> superviseur{supervisorCount > 1 ? 's' : ''}
                    </button>
                    {(lat !== null && lng !== null) && (
                        <a
                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1.5 hover:text-blue-600 transition-colors"
                        >
                            <Navigation className="w-3.5 h-3.5 text-blue-400" />
                            <span>GPS</span>
                        </a>
                    )}
                    <button
                        onClick={() => onCreateChild(area.code)}
                        className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-gray-300 hover:border-sage-400 hover:text-sage-600 transition-colors"
                    >
                        <GitBranch className="w-3.5 h-3.5" />
                        Zone enfant
                    </button>
                </div>
            </div>

            <SageTabs
                tabs={[
                    { id: 'infos', label: 'Infos' },
                    { id: 'itineraries', label: `Tournées (${itinCount})` },
                    { id: 'superviseurs', label: `Superviseurs (${supervisorCount})` },
                ]}
                activeTabId={activeTab}
                onTabChange={setActiveTab}
                className="px-6 pt-3 shrink-0"
            />

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'infos' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailCard title="Configuration" icon={Layers} accent="sage">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Type</span>
                                        <span className="font-medium">
                                            {area.geo_area_type
                                                ? `${area.geo_area_type.name}`
                                                : `Type ${area.geo_area_type_id}`}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Rang</span>
                                        <span className="font-mono">{area.geo_area_type?.rank ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Zone parent</span>
                                        <span className="font-medium">
                                            {area.parent ? `${area.parent.name} (${area.parent.code})` : '— Racine —'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ordre</span>
                                        <span className="font-mono">{area.sort_order}</span>
                                    </div>
                                </div>
                            </DetailCard>

                            <DetailCard title="Géolocalisation" icon={MapIcon} accent="blue">
                                {lat !== null && lng !== null ? (
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Latitude</span>
                                            <span className="font-mono">{lat.toFixed(6)}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-muted-foreground">Longitude</span>
                                            <span className="font-mono">{lng.toFixed(6)}</span>
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps?q=${lat},${lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 hover:underline mt-1"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            Ouvrir dans Google Maps
                                        </a>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center py-4 text-gray-400">
                                        <MapPin className="w-6 h-6 mb-1 opacity-30" />
                                        <p className="text-xs">Aucune coordonnée GPS renseignée</p>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            className="mt-2 text-xs h-7"
                                            onClick={() => onEdit(area)}
                                        >
                                            <Edit2 className="w-3 h-3 mr-1" />
                                            Ajouter les coordonnées
                                        </Button>
                                    </div>
                                )}
                            </DetailCard>
                        </div>

                        {area.description && (
                            <DetailCard title="Description" accent="default">
                                <p className="text-sm text-gray-700 leading-relaxed">{area.description}</p>
                            </DetailCard>
                        )}

                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => navigate('/routing/geo-governance')}
                            >
                                <FolderTree className="w-4 h-4 mr-2 text-indigo-500" />
                                Voir dans l'arborescence
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => onCreateChild(area.code)}
                            >
                                <GitBranch className="w-4 h-4 mr-2 text-sage-600" />
                                Créer une zone enfant
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'itineraries' && (
                    <GeoAreaItineraries areaId={area.id} />
                )}

                {activeTab === 'superviseurs' && (
                    <GeoAreaSuperviseurs areaId={area.id} />
                )}
            </div>
        </div>
    );
}

// ─── Statistics dashboard ─────────────────────────────────────────────────────

function StatisticsDashboard() {
    const { data: stats, isLoading } = useGeoAreaStatistics();

    if (isLoading) {
        return (
            <div className="flex-1 p-8">
                <div className="grid grid-cols-4 gap-4 max-w-3xl mx-auto">
                    {[...Array(4)].map((_, i) => (
                        <div key={i} className="h-24 rounded-xl bg-gray-100 animate-pulse" />
                    ))}
                </div>
            </div>
        );
    }

    const kpis = [
        { label: 'Zones totales', value: stats?.total_areas ?? 0, icon: <Globe2 className="w-5 h-5 text-sage-600" />, bg: 'bg-sage-50 border-sage-100' },
        { label: 'Actives', value: stats?.active_areas ?? 0, icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />, bg: 'bg-emerald-50 border-emerald-100' },
        { label: 'Géolocalisées', value: stats?.with_coordinates ?? 0, icon: <MapPin className="w-5 h-5 text-blue-500" />, bg: 'bg-blue-50 border-blue-100' },
        { label: 'Racines', value: stats?.top_level ?? 0, icon: <Layers className="w-5 h-5 text-amber-500" />, bg: 'bg-amber-50 border-amber-100' },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="text-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">Sectorisation géographique</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Sélectionnez une zone pour gérer ses tournées, superviseurs et sous-zones.
                    </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
                            <div className="flex items-center justify-between mb-2">{kpi.icon}</div>
                            <p className="text-2xl font-bold text-gray-900 leading-none">{kpi.value}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{kpi.label}</p>
                        </div>
                    ))}
                </div>

                {(stats?.by_type?.length ?? 0) > 0 && (
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-4">
                            Répartition par niveau hiérarchique
                        </p>
                        <div className="space-y-3">
                            {stats!.by_type.map((t) => {
                                const max = Math.max(...stats!.by_type.map((x) => x.geo_areas_count), 1);
                                const pct = (t.geo_areas_count / max) * 100;
                                return (
                                    <div key={t.id} className="flex items-center gap-3">
                                        <span className="w-28 text-xs text-gray-600 shrink-0 truncate">{t.name}</span>
                                        <div className="flex-1 h-5 bg-gray-50 rounded-md overflow-hidden">
                                            <div
                                                className="h-full bg-sage-400/70 rounded-md transition-all duration-300"
                                                style={{ width: `${Math.max(pct, 2)}%` }}
                                            />
                                        </div>
                                        <span className="w-10 text-right text-xs font-mono font-semibold text-gray-700 shrink-0">
                                            {t.geo_areas_count}
                                        </span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <div className="bg-gradient-to-br from-sage-50 to-blue-50 rounded-xl border border-sage-100 p-5">
                    <p className="text-xs font-semibold text-gray-600 uppercase tracking-wider mb-3">Guide rapide</p>
                    <div className="space-y-2.5 text-sm text-gray-600">
                        <div className="flex items-start gap-2.5">
                            <span className="text-sage-500 mt-0.5">①</span>
                            <span>Sélectionnez une zone dans la liste pour voir ses tournées et superviseurs.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <span className="text-sage-500 mt-0.5">②</span>
                            <span>Onglet <strong>Tournées</strong> — visualisez et naviguez vers les itinéraires associés.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <span className="text-sage-500 mt-0.5">③</span>
                            <span>Onglet <strong>Superviseurs</strong> — assignez ou retirez des utilisateurs responsables.</span>
                        </div>
                        <div className="flex items-start gap-2.5">
                            <span className="text-sage-500 mt-0.5">④</span>
                            <span>Bouton <strong>Zone enfant</strong> — créez une sous-zone directement depuis le détail.</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function GeoAreasPage() {
    const [filters, setFilters] = useState<GeoAreaFilters>(DEFAULT_FILTERS);
    const [activeOnly, setActiveOnly] = useState(false);
    const { data, isLoading, refetch } = useGeoAreas(filters);

    const [selectedArea, setSelectedArea] = useState<GeoArea | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingArea, setEditingArea] = useState<GeoArea | null | undefined>(undefined);
    const [defaultParentCode, setDefaultParentCode] = useState<string | undefined>(undefined);
    const [areaToDelete, setAreaToDelete] = useState<GeoArea | null>(null);
    const [togglePending, setTogglePending] = useState(false);

    const createArea = useCreateGeoArea();
    const updateArea = useUpdateGeoArea(editingArea?.id ?? 0);
    const deleteArea = useDeleteGeoArea();
    const toggleArea = useToggleGeoArea();

    const rows = useMemo(() => {
        const list = data?.geoAreas.data ?? [];
        return activeOnly ? list.filter((a) => a.is_active) : list;
    }, [data, activeOnly]);

    const totalCount = data?.geoAreas.total ?? 0;

    const handleSelect = (area: GeoArea) => {
        setSelectedArea(area);
        setShowDetailPanel(true);
        setEditingArea(undefined);
    };

    const handleCreateChild = (parentCode: string) => {
        setDefaultParentCode(parentCode);
        setEditingArea(null);
    };

    const handleFormSubmit = async (payload: CreateGeoAreaPayload | UpdateGeoAreaPayload) => {
        try {
            if (editingArea) {
                await updateArea.mutateAsync(payload);
                toast.success('Zone mise à jour.');
                setEditingArea(undefined);
                setShowDetailPanel(true);
            } else {
                await createArea.mutateAsync(payload as CreateGeoAreaPayload);
                toast.success('Zone créée.');
                setEditingArea(undefined);
                setDefaultParentCode(undefined);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleCancel = () => {
        setEditingArea(undefined);
        setDefaultParentCode(undefined);
    };

    const handleDelete = async () => {
        if (!areaToDelete) return;
        try {
            await deleteArea.mutateAsync(areaToDelete.id);
            toast.success('Zone supprimée.');
            setAreaToDelete(null);
            if (selectedArea?.id === areaToDelete.id) {
                setSelectedArea(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleToggle = async (area: GeoArea) => {
        setTogglePending(true);
        try {
            await toggleArea.mutateAsync(area.id);
            toast.success('Statut mis à jour.');
            setSelectedArea((prev) =>
                prev && prev.id === area.id ? { ...prev, is_active: !prev.is_active } : prev
            );
        } catch (error) {
            toast.error(getErrorMessage(error));
        } finally {
            setTogglePending(false);
        }
    };

    const columnDefs = [
        {
            field: 'name',
            headerName: 'Zone',
            flex: 2,
            cellRenderer: (params: { data: GeoArea }) => {
                const rank = params.data.geo_area_type?.rank ?? 0;
                return (
                    <span className="flex items-center gap-2">
                        <span className="text-base leading-none">{TYPE_ICONS[rank] ?? '📌'}</span>
                        <span className="truncate text-sm">{params.data.name}</span>
                    </span>
                );
            },
        },
        { field: 'code', headerName: 'Code', flex: 1, cellClass: 'font-mono text-xs text-gray-500' },
        {
            field: 'geo_area_type',
            headerName: 'Niveau',
            flex: 1,
            valueGetter: (params: { data: GeoArea }) => params.data.geo_area_type?.name ?? '',
            cellClass: 'text-xs text-gray-500',
        },
        {
            field: 'is_active',
            headerName: '',
            flex: 0.5,
            cellRenderer: (params: { value: boolean }) =>
                params.value ? (
                    <span className="text-[10px] font-semibold text-emerald-600">● Actif</span>
                ) : (
                    <span className="text-[10px] font-semibold text-gray-400">○ Inactif</span>
                ),
        },
    ];

    const typeOptions = data?.geoAreaTypes.map((t) => ({ value: t.id, label: t.name })) ?? [];
    const parentFilterOptions = data?.parentAreas.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })) ?? [];

    const actionGroups = [
        {
            items: [
                { icon: Plus, label: 'Nouvelle zone', variant: 'primary' as const, onClick: () => { setDefaultParentCode(undefined); setEditingArea(null); } },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selectedArea && editingArea === undefined
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingArea(selectedArea) },
                        { icon: GitBranch, label: 'Zone enfant', variant: 'default' as const, onClick: () => handleCreateChild(selectedArea.code) },
                        {
                            icon: selectedArea.is_active ? PowerOff : Power,
                            label: selectedArea.is_active ? 'Désactiver' : 'Activer',
                            variant: 'warning' as const,
                            onClick: () => handleToggle(selectedArea),
                        },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setAreaToDelete(selectedArea) },
                    ],
                },
            ]
            : []),
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <MapPin className="h-5 w-5 text-sage-600" />
                                <h1 className="text-sm font-semibold text-gray-900">Zones géographiques</h1>
                            </div>
                            <span className="text-[11px] text-gray-400 font-mono">{rows.length}/{totalCount}</span>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Rechercher (nom, code)..."
                                    value={filters.search ?? ''}
                                    onChange={(e) => setFilters((p) => ({ ...p, search: e.target.value, page: 1 }))}
                                    className="h-8 text-xs pl-8"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <SearchableSelect
                                    options={typeOptions}
                                    value={filters.type_id ?? undefined}
                                    onChange={(v) => setFilters((p) => ({ ...p, type_id: v ? Number(v) : undefined, page: 1 }))}
                                    placeholder="Niveau"
                                    clearable
                                />
                                <SearchableSelect
                                    options={parentFilterOptions}
                                    value={filters.parent_code ?? undefined}
                                    onChange={(v) => setFilters((p) => ({ ...p, parent_code: v ? String(v) : undefined, page: 1 }))}
                                    placeholder="Parent"
                                    clearable
                                />
                            </div>
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none pt-0.5">
                                <input
                                    type="checkbox"
                                    checked={activeOnly}
                                    onChange={(e) => setActiveOnly(e.target.checked)}
                                    className="rounded border-gray-300 text-sage-600 focus:ring-sage-400"
                                />
                                Actifs seulement
                            </label>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DataGrid
                                rowData={rows}
                                columnDefs={columnDefs}
                                onRowSelected={handleSelect}
                                loading={isLoading}
                                pagination
                                paginationPageSize={filters.per_page ?? 100}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    {/* Delete confirmation — stays as dialog */}
                    <Dialog open={!!areaToDelete} onOpenChange={(open) => !open && setAreaToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer la zone ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{areaToDelete?.name}</strong> ({areaToDelete?.code}).
                                    Toutes les sous-zones et affectations seront impactées. Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAreaToDelete(null)}>Annuler</Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteArea.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {editingArea !== undefined ? (
                        <GeoAreaFormPanel
                            geoArea={editingArea}
                            defaultParentCode={defaultParentCode}
                            geoAreaTypes={data?.geoAreaTypes ?? []}
                            parentAreas={data?.parentAreas ?? []}
                            onSubmit={handleFormSubmit}
                            onCancel={handleCancel}
                            loading={createArea.isPending || updateArea.isPending}
                        />
                    ) : showDetailPanel && selectedArea ? (
                        <GeoAreaDetail
                            area={selectedArea}
                            onBack={() => setShowDetailPanel(false)}
                            onEdit={(area) => setEditingArea(area)}
                            onToggle={handleToggle}
                            onCreateChild={handleCreateChild}
                            togglePending={togglePending}
                        />
                    ) : (
                        <StatisticsDashboard />
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
