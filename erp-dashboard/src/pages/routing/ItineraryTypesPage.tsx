import { useState } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Route,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    X,
    Search,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DetailCard } from '@/components/common/DetailCard';
import { DataGrid } from '@/components/common/DataGrid';
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
    useItineraryTypes,
    useUpdateItineraryType,
} from '@/hooks/routing/useRouting';
import type {
    CreateItineraryTypePayload,
    ItineraryType,
    ItineraryTypeFilters,
    UpdateItineraryTypePayload,
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

const DEFAULT_FILTERS: ItineraryTypeFilters = { per_page: 50, page: 1 };

function ItineraryTypeDetail({
    type,
    onBack,
}: {
    type: ItineraryType;
    onBack?: () => void;
}) {
    const { data: businessNatures } = useBusinessNatures();
    const nature = (businessNatures ?? []).find((n) => n.id === type.business_nature_id);

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                        <Route className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{type.name}</h1>
                        <p className="text-sm font-mono text-gray-500">{type.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {type.is_active ? (
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
                    <DetailCard title="Informations" icon={Route} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Code</span>
                                <span className="font-mono font-medium">{type.code}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Nom arabe</span>
                                <span>{type.name_ar ?? '—'}</span>
                            </div>
                        </div>
                    </DetailCard>

                    <DetailCard title="Statut" accent="blue">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Actif</span>
                                <span>{type.is_active ? 'Oui' : 'Non'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Nature business</span>
                                <span>
                                    {nature
                                        ? `${nature.label} (${nature.code})`
                                        : type.business_nature_id
                                        ? `#${type.business_nature_id}`
                                        : '—'}
                                </span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                {type.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{type.description}</p>
                    </DetailCard>
                )}
            </div>
        </div>
    );
}

export function ItineraryTypesPage() {
    const [filters, setFilters] = useState<ItineraryTypeFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useItineraryTypes(filters);

    const [selectedType, setSelectedType] = useState<ItineraryType | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingType, setEditingType] = useState<ItineraryType | null | undefined>(undefined);
    const [typeToDelete, setTypeToDelete] = useState<ItineraryType | null>(null);

    const createType = useCreateItineraryType();
    const updateType = useUpdateItineraryType(editingType?.id ?? 0);
    const deleteType = useDeleteItineraryType();

    const handleSelect = (type: ItineraryType) => {
        setSelectedType(type);
        setShowDetailPanel(true);
    };

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

    const handleDelete = async () => {
        if (!typeToDelete) return;
        try {
            await deleteType.mutateAsync(typeToDelete.id);
            toast.success('Type supprimé.');
            setTypeToDelete(null);
            if (selectedType?.id === typeToDelete.id) {
                setSelectedType(null);
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

    const actionGroups = [
        {
            items: [
                { icon: Plus, label: 'Nouveau type', variant: 'primary' as const, onClick: () => setEditingType(null) },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetch() },
            ],
        },
        ...(selectedType
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingType(selectedType) },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setTypeToDelete(selectedType) },
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
                            <Route className="h-5 w-5 text-sage-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Types de tournée</h1>
                        </div>
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder="Rechercher..."
                                value={filters.search ?? ''}
                                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value, page: 1 }))}
                                className="h-8 text-xs pl-8"
                            />
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <DataGrid
                                rowData={data?.data?.data ?? []}
                                columnDefs={columnDefs}
                                onRowSelected={(type) => handleSelect(type)}
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
                    <Dialog open={editingType !== undefined} onOpenChange={(open) => !open && setEditingType(undefined)}>
                        <DialogContent className="max-w-xl">
                            <DialogHeader>
                                <DialogTitle>{editingType ? 'Modifier le type' : 'Nouveau type de tournée'}</DialogTitle>
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

                    <Dialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer le type ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{typeToDelete?.name}</strong> ({typeToDelete?.code}).
                                    Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setTypeToDelete(null)}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteType.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {showDetailPanel && selectedType ? (
                        <ItineraryTypeDetail type={selectedType} onBack={() => setShowDetailPanel(false)} />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Route className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Types de tournée</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Sélectionnez un type pour voir ses détails.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
