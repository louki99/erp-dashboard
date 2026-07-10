import { useState } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Truck,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    X,
    Search,
    MapPin,
    Users,
    Route,
    Building2,
    SlidersHorizontal,
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
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { SageTabs } from '@/components/common/SageTabs';

import {
    ItineraryForm,
    ItineraryPartnersManager,
    ItineraryUsersManager,
} from '@/components/routing';
import {
    useCreateItinerary,
    useDeleteItinerary,
    useItineraries,
    useItinerary,
    useItineraryTypes,
    useSyncItineraryPartners,
    useSyncItineraryUsers,
    useUpdateItinerary,
} from '@/hooks/routing/useRouting';
import type {
    CreateItineraryPayload,
    Itinerary,
    ItineraryFilters,
    SyncItineraryUsersPayload,
    SyncPartnerEntry,
    UpdateItineraryPayload,
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

const DEFAULT_FILTERS: ItineraryFilters = { per_page: 50, page: 1 };

function ItineraryDetail({
    itinerary,
    onBack,
}: {
    itinerary: Itinerary;
    onBack?: () => void;
}) {
    const { data: detailData } = useItinerary(itinerary.id);
    const syncPartners = useSyncItineraryPartners(itinerary.id);
    const syncUsers = useSyncItineraryUsers(itinerary.id);
    const [activeTab, setActiveTab] = useState('detail');

    const detail = detailData?.itinerary ?? itinerary;

    const handleSyncPartners = async (entries: SyncPartnerEntry[]) => {
        try {
            await syncPartners.mutateAsync({ partners: entries });
            toast.success('Partenaires synchronisés.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleSyncUsers = async (payload: SyncItineraryUsersPayload) => {
        try {
            await syncUsers.mutateAsync(payload);
            toast.success('Vendeurs synchronisés.');
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                        <Truck className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{detail.name}</h1>
                        <p className="text-sm font-mono text-gray-500">{detail.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {detail.is_active ? (
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

            <SageTabs
                tabs={[
                    { id: 'detail', label: 'Détail' },
                    { id: 'partners', label: 'Partenaires' },
                    { id: 'users', label: 'Vendeurs' },
                ]}
                activeTabId={activeTab}
                onTabChange={setActiveTab}
                className="px-6 pt-4"
            />

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'detail' && (
                    <div className="space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailCard title="Configuration" icon={Route} accent="sage">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Type</span>
                                        <span className="font-medium">{detail.itinerary_type?.name ?? detail.itinerary_type_id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Jours avant prochaine visite</span>
                                        <span className="font-mono">{detail.days_before_next_visit}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Trend</span>
                                        <span className="font-mono">{detail.trend}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Niveau sécurité</span>
                                        <span className="font-mono">{detail.security_level}</span>
                                    </div>
                                </div>
                            </DetailCard>

                            <DetailCard title="Affectations" icon={MapPin} accent="blue">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Branche</span>
                                        <span className="font-medium">{detail.branch?.name ?? detail.branch_code ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Zone</span>
                                        <span className="font-medium">{detail.geo_area?.name ?? detail.geo_area_code ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Vendeur</span>
                                        <span className="font-medium">{detail.rider?.name ?? detail.rider_id ?? '—'}</span>
                                    </div>
                                </div>
                            </DetailCard>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailCard title="Période" icon={Building2} accent="amber">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Début</span>
                                        <span>{detail.start_date ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fin</span>
                                        <span>{detail.end_date ?? '—'}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Ordre</span>
                                        <span className="font-mono">{detail.sort_order}</span>
                                    </div>
                                </div>
                            </DetailCard>

                            <DetailCard title="Compteurs" icon={Users} accent="default">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Partenaires</span>
                                        <span className="font-medium">{detail.itinerary_partners?.length ?? 0}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Vendeurs</span>
                                        <span className="font-medium">{detail.itinerary_users?.length ?? 0}</span>
                                    </div>
                                </div>
                            </DetailCard>
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && detailData && (
                    <ItineraryPartnersManager
                        key={`partners-${itinerary.id}`}
                        partners={detail.itinerary_partners ?? []}
                        availablePartners={detailData.availablePartners}
                        onSave={handleSyncPartners}
                        loading={syncPartners.isPending}
                    />
                )}

                {activeTab === 'users' && detailData && (
                    <ItineraryUsersManager
                        key={`users-${itinerary.id}`}
                        users={detail.itinerary_users ?? []}
                        availableUsers={detailData.availableUsers}
                        onSave={handleSyncUsers}
                        loading={syncUsers.isPending}
                    />
                )}
            </div>
        </div>
    );
}

export function ItinerariesPage() {
    const [filters, setFilters] = useState<ItineraryFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useItineraries(filters);
    const { data: itineraryTypesData } = useItineraryTypes({ per_page: 500 });

    const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingItinerary, setEditingItinerary] = useState<Itinerary | null | undefined>(undefined);
    const [itineraryToDelete, setItineraryToDelete] = useState<Itinerary | null>(null);
    const [showFilters, setShowFilters] = useState(false);
    const [draftFilters, setDraftFilters] = useState<ItineraryFilters>(DEFAULT_FILTERS);

    const createItinerary = useCreateItinerary();
    const updateItinerary = useUpdateItinerary(editingItinerary?.id ?? 0);
    const deleteItinerary = useDeleteItinerary();

    const handleSelect = (itinerary: Itinerary) => {
        setSelectedItinerary(itinerary);
        setShowDetailPanel(true);
    };

    const handleFormSubmit = async (payload: CreateItineraryPayload | UpdateItineraryPayload) => {
        try {
            if (editingItinerary) {
                await updateItinerary.mutateAsync(payload);
                toast.success('Tournée mise à jour.');
            } else {
                await createItinerary.mutateAsync(payload as CreateItineraryPayload);
                toast.success('Tournée créée.');
            }
            setEditingItinerary(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleDelete = async () => {
        if (!itineraryToDelete) return;
        try {
            await deleteItinerary.mutateAsync(itineraryToDelete.id);
            toast.success('Tournée supprimée.');
            setItineraryToDelete(null);
            if (selectedItinerary?.id === itineraryToDelete.id) {
                setSelectedItinerary(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const columnDefs = [
        { field: 'code', headerName: 'Code', flex: 1 },
        { field: 'name', headerName: 'Nom', flex: 2 },
        {
            field: 'itinerary_type',
            headerName: 'Type',
            flex: 1,
            valueGetter: (params: { data: Itinerary }) => params.data.itinerary_type?.name ?? '',
        },
        {
            field: 'branch',
            headerName: 'Branche',
            flex: 1,
            valueGetter: (params: { data: Itinerary }) => params.data.branch?.name ?? params.data.branch_code ?? '—',
        },
        {
            field: 'rider',
            headerName: 'Vendeur',
            flex: 1,
            valueGetter: (params: { data: Itinerary }) => params.data.rider?.name ?? '—',
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

    const branchOptions = data?.branches.map((b) => ({ value: b.code, label: `${b.name} (${b.code})` })) ?? [];
    const geoAreaOptions = data?.geoAreas.map((g) => ({ value: g.code, label: `${g.name} (${g.code})` })) ?? [];
    const riderOptions = data?.riders.map((r) => ({ value: r.id, label: r.name })) ?? [];

    const activeFilterCount = [filters.branch_code, filters.geo_area_code, filters.rider_id].filter(Boolean).length;

    const actionGroups = [
        {
            items: [
                { icon: Plus, label: 'Nouvelle tournée', variant: 'primary' as const, onClick: () => setEditingItinerary(null) },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selectedItinerary
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingItinerary(selectedItinerary) },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setItineraryToDelete(selectedItinerary) },
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
                            <Truck className="h-5 w-5 text-sage-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Tournées</h1>
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
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    className="flex-1 h-8 text-xs"
                                    onClick={() => {
                                        setDraftFilters(filters);
                                        setShowFilters(true);
                                    }}
                                >
                                    <SlidersHorizontal className="w-3.5 h-3.5 mr-1.5" />
                                    Filtres
                                    {activeFilterCount > 0 && (
                                        <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-sage-100 text-sage-700 text-[10px] font-medium">
                                            {activeFilterCount}
                                        </span>
                                    )}
                                </Button>
                                {activeFilterCount > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="h-8 px-2 text-xs text-gray-500 hover:text-red-500"
                                        onClick={() => setFilters((prev) => ({ ...DEFAULT_FILTERS, search: prev.search }))}
                                    >
                                        Réinitialiser
                                    </Button>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DataGrid
                                rowData={data?.itineraries.data ?? []}
                                columnDefs={columnDefs}
                                onRowSelected={(itinerary) => handleSelect(itinerary)}
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
                    <Dialog open={editingItinerary !== undefined} onOpenChange={(open) => !open && setEditingItinerary(undefined)}>
                        <DialogContent className="max-w-3xl">
                            <DialogHeader>
                                <DialogTitle>{editingItinerary ? 'Modifier la tournée' : 'Nouvelle tournée'}</DialogTitle>
                            </DialogHeader>
                            <ItineraryForm
                                key={editingItinerary ? `edit-${editingItinerary.id}` : 'create'}
                                itinerary={editingItinerary ?? null}
                                itineraryTypes={itineraryTypesData?.data?.data ?? []}
                                branches={data?.branches ?? []}
                                geoAreas={data?.geoAreas ?? []}
                                riders={data?.riders ?? []}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditingItinerary(undefined)}
                                loading={createItinerary.isPending || updateItinerary.isPending}
                            />
                        </DialogContent>
                    </Dialog>

                    <Dialog open={!!itineraryToDelete} onOpenChange={(open) => !open && setItineraryToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer la tournée ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{itineraryToDelete?.name}</strong> ({itineraryToDelete?.code}).
                                    Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setItineraryToDelete(null)}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteItinerary.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    <Dialog open={showFilters} onOpenChange={(open) => !open && setShowFilters(false)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <SlidersHorizontal className="h-5 w-5" />
                                    Filtres de tournées
                                </DialogTitle>
                                <DialogDescription>
                                    Affinez la liste des tournées par branche, zone ou vendeur.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Branche</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: '— Toutes les branches —' }, ...branchOptions]}
                                        value={draftFilters.branch_code ?? ''}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, branch_code: v ? String(v) : undefined }))}
                                        placeholder="Branche"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Zone géographique</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: '— Toutes les zones —' }, ...geoAreaOptions]}
                                        value={draftFilters.geo_area_code ?? ''}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, geo_area_code: v ? String(v) : undefined }))}
                                        placeholder="Zone géographique"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Vendeur</Label>
                                    <SearchableSelect
                                        options={[{ value: '', label: '— Tous les vendeurs —' }, ...riderOptions]}
                                        value={draftFilters.rider_id ?? ''}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, rider_id: v ? Number(v) : undefined }))}
                                        placeholder="Vendeur"
                                        clearable
                                    />
                                </div>
                            </div>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setDraftFilters(DEFAULT_FILTERS);
                                        setFilters((prev) => ({ ...DEFAULT_FILTERS, search: prev.search }));
                                        setShowFilters(false);
                                    }}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    onClick={() => {
                                        setFilters((prev) => ({ ...draftFilters, search: prev.search, page: 1 }));
                                        setShowFilters(false);
                                    }}
                                >
                                    Appliquer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {showDetailPanel && selectedItinerary ? (
                        <ItineraryDetail itinerary={selectedItinerary} onBack={() => setShowDetailPanel(false)} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Truck className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Tournées</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Sélectionnez une tournée pour voir ses détails, partenaires et vendeurs.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
