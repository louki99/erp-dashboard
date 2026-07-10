import { useState } from 'react';
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

const DEFAULT_FILTERS: GeoAreaFilters = { per_page: 50, page: 1 };

function GeoAreaDetail({
    area,
    onBack,
}: {
    area: GeoArea;
    onBack?: () => void;
}) {
    const { data: usersData } = useGeoAreaUsers(area.id);
    const assignUser = useAssignGeoAreaUser(area.id);
    const removeUser = useRemoveGeoAreaUser(area.id);
    const { data: userOptions } = useUsersOptions();

    const assignedIds = usersData?.users.map((u) => u.id) ?? [];
    const availableUserOptions =
        userOptions
            ?.filter((u) => !assignedIds.includes(u.value as number))
            .map((u) => ({ value: u.value, label: u.label })) ?? [];

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                        <MapPin className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{area.name}</h1>
                        <p className="text-sm font-mono text-gray-500">{area.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {area.is_active ? (
                        <Badge variant="success" className="text-[10px]">Actif</Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                    )}
                    {onBack && (
                        <Button variant="outline" size="sm" onClick={onBack} className="ml-2">
                            <X className="mr-1.5 h-4 w-4" />
                            Fermer
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Informations" icon={MapPin} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type</span>
                                <span className="font-medium">{area.geo_area_type?.name ?? area.geo_area_type_id}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Parent</span>
                                <span className="font-medium">{area.parent?.name ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Ordre</span>
                                <span className="font-mono">{area.sort_order}</span>
                            </div>
                        </div>
                    </DetailCard>

                    <DetailCard title="Coordonnées" icon={FolderTree} accent="blue">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Latitude</span>
                                <span className="font-mono">{area.latitude ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Longitude</span>
                                <span className="font-mono">{area.longitude ?? '—'}</span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                {area.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{area.description}</p>
                    </DetailCard>
                )}

                <DetailCard title="Utilisateurs assignés" icon={Users} accent="amber">
                    <SearchableSelect
                        options={availableUserOptions}
                        value={undefined}
                        onChange={async (v) => {
                            try {
                                await assignUser.mutateAsync(Number(v));
                                toast.success('Utilisateur assigné.');
                            } catch (error) {
                                toast.error(getErrorMessage(error));
                            }
                        }}
                        placeholder="Ajouter un utilisateur..."
                    />
                    <div className="mt-3 space-y-2">
                        {usersData?.users.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-white"
                            >
                                <div>
                                    <p className="text-sm font-medium text-gray-900">{u.name}</p>
                                    <p className="text-xs text-gray-500">{u.email}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="text-red-500 hover:text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                        try {
                                            await removeUser.mutateAsync(u.id);
                                            toast.success('Utilisateur retiré.');
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
                            <p className="text-sm text-gray-400 text-center py-4">Aucun utilisateur assigné</p>
                        )}
                    </div>
                </DetailCard>
            </div>
        </div>
    );
}

export function GeoAreasPage() {
    const [filters, setFilters] = useState<GeoAreaFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useGeoAreas(filters);

    const [selectedArea, setSelectedArea] = useState<GeoArea | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingArea, setEditingArea] = useState<GeoArea | null | undefined>(undefined);
    const [areaToDelete, setAreaToDelete] = useState<GeoArea | null>(null);

    const createArea = useCreateGeoArea();
    const updateArea = useUpdateGeoArea(editingArea?.id ?? 0);
    const deleteArea = useDeleteGeoArea();
    const toggleArea = useToggleGeoArea();

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
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const columnDefs = [
        { field: 'code', headerName: 'Code', flex: 1 },
        { field: 'name', headerName: 'Nom', flex: 2 },
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
    const parentOptions = data?.parentAreas ?? [];

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
                        <div className="flex items-center gap-2 mb-3">
                            <MapPin className="h-5 w-5 text-sage-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Zones géographiques</h1>
                        </div>
                        <div className="space-y-2">
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                                <Input
                                    placeholder="Rechercher..."
                                    value={filters.search ?? ''}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                                    className="h-8 text-xs pl-8"
                                />
                            </div>
                            <SearchableSelect
                                options={[{ value: '', label: '— Tous les types —' }, ...typeOptions]}
                                value={filters.type_id ?? ''}
                                onChange={(v) => setFilters((prev) => ({ ...prev, type_id: v ? Number(v) : undefined, page: 1 }))}
                                placeholder="Type de zone"
                                clearable
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DataGrid
                                rowData={data?.geoAreas.data ?? []}
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
                            </DialogHeader>
                            <GeoAreaForm
                                key={editingArea ? `edit-${editingArea.id}` : 'create'}
                                geoArea={editingArea ?? null}
                                geoAreaTypes={data?.geoAreaTypes ?? []}
                                parentAreas={parentOptions}
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
                        <GeoAreaDetail area={selectedArea} onBack={() => setShowDetailPanel(false)} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <FolderTree className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Sectorisation</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Sélectionnez une zone pour voir ses détails et gérer ses utilisateurs.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
