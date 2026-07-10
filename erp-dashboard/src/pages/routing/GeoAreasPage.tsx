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
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DetailCard } from '@/components/common/DetailCard';
import { DataGrid } from '@/components/common/DataGrid';
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
import { Badge } from '@/components/ui/badge';

import { GeoAreaForm } from '@/components/routing';
import {
    useAssignGeoAreaUser,
    useCreateGeoArea,
    useDeleteGeoArea,
    useGeoAreaStatistics,
    useGeoAreaUsers,
    useGeoAreas,
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
    if (error instanceof Error) {
        return error.message;
    }
    return 'Une erreur est survenue.';
}

// API returns decimals as strings — normalize before toFixed
function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

const TYPE_ICONS: Record<number, string> = {
    100: '🌍',
    200: '📍',
    300: '🏙️',
    400: '🏘️',
    500: '🗺️',
    600: '📌',
};

const DEFAULT_FILTERS: GeoAreaFilters = { per_page: 50, page: 1 };

// ─── Detail panel ─────────────────────────────────────────────────────────────

function GeoAreaDetail({
    area,
    onBack,
    onEdit,
    onToggle,
}: {
    area: GeoArea;
    onBack?: () => void;
    onEdit: (area: GeoArea) => void;
    onToggle: (area: GeoArea) => void;
}) {
    const navigate = useNavigate();
    const { data: usersData } = useGeoAreaUsers(area.id);
    const assignUser = useAssignGeoAreaUser(area.id);
    const removeUser = useRemoveGeoAreaUser(area.id);
    const { data: userOptions } = useUsersOptions();

    const assignedIds = usersData?.users.map((u) => u.id) ?? [];
    const availableUserOptions =
        userOptions
            ?.filter((u) => !assignedIds.includes(u.value as number))
            .map((u) => ({ value: u.value, label: u.label })) ?? [];

    const lat = toCoord(area.latitude);
    const lng = toCoord(area.longitude);
    const typeRank = area.geo_area_type?.rank ?? 0;
    const icon = TYPE_ICONS[typeRank] ?? '📌';

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-50 border border-sage-100 text-xl">
                            {icon}
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">{area.name}</h1>
                                {area.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">{area.name_ar}</span>
                                )}
                            </div>
                            {/* Hierarchy breadcrumb */}
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                {area.parent && (
                                    <>
                                        <span>{area.parent.name}</span>
                                        <span>›</span>
                                    </>
                                )}
                                <span className="font-mono text-gray-500">{area.code}</span>
                                {area.geo_area_type && (
                                    <>
                                        <span>·</span>
                                        <span>{area.geo_area_type.name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => onToggle(area)}
                            title={area.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            className="focus:outline-none"
                        >
                            {area.is_active ? (
                                <Badge variant="success" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ● Actif
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ○ Inactif
                                </Badge>
                            )}
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
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Informations" icon={MapPin} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span className="font-medium">
                                    {area.geo_area_type
                                        ? `${area.geo_area_type.name} (rang ${area.geo_area_type.rank})`
                                        : area.geo_area_type_id}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Parent</span>
                                <span className="font-medium">
                                    {area.parent ? `${area.parent.name} (${area.parent.code})` : '—'}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ordre d'affichage</span>
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
                                    className="inline-flex items-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 hover:underline mt-1"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Ouvrir dans Google Maps
                                </a>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400">Aucune coordonnée renseignée.</p>
                        )}
                    </DetailCard>
                </div>

                {area.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{area.description}</p>
                    </DetailCard>
                )}

                <DetailCard title={`Superviseurs assignés (${usersData?.users.length ?? 0})`} icon={Users} accent="amber">
                    <SearchableSelect
                        options={availableUserOptions}
                        value={undefined}
                        onChange={async (v) => {
                            try {
                                await assignUser.mutateAsync(Number(v));
                                toast.success('Superviseur assigné.');
                            } catch (error) {
                                toast.error(getErrorMessage(error));
                            }
                        }}
                        placeholder="Ajouter un superviseur..."
                    />
                    <div className="mt-3 space-y-2">
                        {usersData?.users.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white"
                            >
                                <div className="w-8 h-8 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                                    {u.name
                                        .split(' ')
                                        .map((p) => p[0])
                                        .slice(0, 2)
                                        .join('')
                                        .toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-400 hover:text-red-600 hover:bg-red-50 shrink-0"
                                    onClick={async () => {
                                        try {
                                            await removeUser.mutateAsync(u.id);
                                            toast.success('Superviseur retiré.');
                                        } catch (error) {
                                            toast.error(getErrorMessage(error));
                                        }
                                    }}
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                        {(usersData?.users.length ?? 0) === 0 && (
                            <div className="flex flex-col items-center py-5 text-gray-400">
                                <UserPlus className="w-7 h-7 mb-1.5" />
                                <p className="text-xs">Aucun superviseur — utilisez le champ ci-dessus</p>
                            </div>
                        )}
                    </div>
                </DetailCard>

                <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => navigate('/routing/geo-governance')}
                >
                    <FolderTree className="w-4 h-4 mr-2" />
                    Voir dans l'arborescence (Gouvernance)
                </Button>
            </div>
        </div>
    );
}

// ─── Statistics dashboard (empty state) ───────────────────────────────────────

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
        {
            label: 'Zones totales',
            value: stats?.total_areas ?? 0,
            icon: <Globe2 className="w-5 h-5 text-sage-600" />,
            bg: 'bg-sage-50 border-sage-100',
        },
        {
            label: 'Actives',
            value: stats?.active_areas ?? 0,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50 border-emerald-100',
        },
        {
            label: 'Géolocalisées',
            value: stats?.with_coordinates ?? 0,
            icon: <MapPin className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50 border-blue-100',
        },
        {
            label: 'Racines',
            value: stats?.top_level ?? 0,
            icon: <Layers className="w-5 h-5 text-amber-500" />,
            bg: 'bg-amber-50 border-amber-100',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="text-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">Sectorisation géographique</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Sélectionnez une zone dans la liste pour voir ses détails et gérer ses superviseurs.
                    </p>
                </div>

                {/* KPI cards */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`rounded-xl border p-4 ${kpi.bg}`}>
                            <div className="flex items-center justify-between mb-2">{kpi.icon}</div>
                            <p className="text-2xl font-bold text-gray-900 leading-none">{kpi.value}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{kpi.label}</p>
                        </div>
                    ))}
                </div>

                {/* Breakdown by type */}
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
                                        <span className="w-24 text-xs text-gray-600 shrink-0 truncate">{t.name}</span>
                                        <div className="flex-1 h-5 bg-gray-50 rounded-md overflow-hidden">
                                            <div
                                                className="h-full bg-sage-400/70 rounded-md transition-all"
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
    const [areaToDelete, setAreaToDelete] = useState<GeoArea | null>(null);

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
    };

    const handleFormSubmit = async (payload: CreateGeoAreaPayload | UpdateGeoAreaPayload) => {
        try {
            if (editingArea) {
                await updateArea.mutateAsync(payload);
                toast.success('Zone mise à jour.');
            } else {
                await createArea.mutateAsync(payload as CreateGeoAreaPayload);
                toast.success('Zone créée.');
            }
            setEditingArea(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
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
        try {
            await toggleArea.mutateAsync(area.id);
            toast.success('Statut mis à jour.');
            // reflect immediately in the open detail panel
            setSelectedArea((prev) =>
                prev && prev.id === area.id ? { ...prev, is_active: !prev.is_active } : prev
            );
        } catch (error) {
            toast.error(getErrorMessage(error));
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
                        <span>{TYPE_ICONS[rank] ?? '📌'}</span>
                        <span className="truncate">{params.data.name}</span>
                    </span>
                );
            },
        },
        { field: 'code', headerName: 'Code', flex: 1.2, cellClass: 'font-mono text-xs' },
        {
            field: 'geo_area_type',
            headerName: 'Type',
            flex: 1,
            valueGetter: (params: { data: GeoArea }) => params.data.geo_area_type?.name ?? '',
        },
        {
            field: 'parent',
            headerName: 'Parent',
            flex: 1,
            valueGetter: (params: { data: GeoArea }) => params.data.parent?.name ?? '—',
        },
        {
            field: 'is_active',
            headerName: 'Statut',
            flex: 0.7,
            cellRenderer: (params: { value: boolean }) =>
                params.value ? (
                    <Badge variant="success" className="text-[10px]">Actif</Badge>
                ) : (
                    <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                ),
        },
    ];

    const typeOptions = data?.geoAreaTypes.map((t) => ({ value: t.id, label: t.name })) ?? [];
    const parentFilterOptions =
        data?.parentAreas.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })) ?? [];

    const actionGroups = [
        {
            items: [
                { icon: Plus, label: 'Nouvelle zone', variant: 'primary' as const, onClick: () => setEditingArea(null) },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selectedArea
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingArea(selectedArea) },
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
                            <span className="text-[11px] text-gray-400 font-mono">
                                {rows.length}/{totalCount}
                            </span>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Rechercher (nom, code)..."
                                    value={filters.search ?? ''}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                                    className="h-8 text-xs pl-8"
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                                <SearchableSelect
                                    options={typeOptions}
                                    value={filters.type_id ?? undefined}
                                    onChange={(v) => setFilters((prev) => ({ ...prev, type_id: v ? Number(v) : undefined, page: 1 }))}
                                    placeholder="Type"
                                    clearable
                                />
                                <SearchableSelect
                                    options={parentFilterOptions}
                                    value={filters.parent_code ?? undefined}
                                    onChange={(v) => setFilters((prev) => ({ ...prev, parent_code: v ? String(v) : undefined, page: 1 }))}
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
                                onRowSelected={(area) => handleSelect(area)}
                                loading={isLoading}
                                pagination
                                paginationPageSize={filters.per_page ?? 50}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    <Dialog open={editingArea !== undefined} onOpenChange={(open) => !open && setEditingArea(undefined)}>
                        <DialogContent className="max-w-2xl">
                            <DialogHeader>
                                <DialogTitle>{editingArea ? 'Modifier la zone' : 'Nouvelle zone'}</DialogTitle>
                                <DialogDescription>
                                    Renseignez le code, le nom et le type hiérarchique de la zone.
                                </DialogDescription>
                            </DialogHeader>
                            <GeoAreaForm
                                key={editingArea ? `edit-${editingArea.id}` : 'create'}
                                geoArea={editingArea ?? null}
                                geoAreaTypes={data?.geoAreaTypes ?? []}
                                parentAreas={data?.parentAreas ?? []}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditingArea(undefined)}
                                loading={createArea.isPending || updateArea.isPending}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!areaToDelete} onOpenChange={(open) => !open && setAreaToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer la zone ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{areaToDelete?.name}</strong> ({areaToDelete?.code}).
                                    Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setAreaToDelete(null)}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteArea.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {showDetailPanel && selectedArea ? (
                        <GeoAreaDetail
                            area={selectedArea}
                            onBack={() => setShowDetailPanel(false)}
                            onEdit={(area) => setEditingArea(area)}
                            onToggle={handleToggle}
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
