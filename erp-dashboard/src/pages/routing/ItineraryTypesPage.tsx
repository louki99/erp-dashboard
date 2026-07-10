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
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Une erreur est survenue.';
}

const DEFAULT_FILTERS: ItineraryTypeFilters = { per_page: 50, page: 1 };

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ItineraryTypeDetail({
    type,
    nature,
    onBack,
    onEdit,
    onToggle,
    togglePending,
}: {
    type: ItineraryType;
    nature: ItineraryBusinessNature | undefined;
    onBack?: () => void;
    onEdit: (type: ItineraryType) => void;
    onToggle: (type: ItineraryType) => void;
    togglePending: boolean;
}) {
    const navigate = useNavigate();

    // Tournées using this type (backend filter itinerary_type_id)
    const { data: linkedData, isLoading: linkedLoading } = useItineraries({
        itinerary_type_id: type.id,
        per_page: 5,
    });
    const linked = linkedData?.itineraries.data ?? [];
    const linkedTotal = linkedData?.itineraries.total ?? 0;

    const actions = nature?.action_rules?.actions ?? [];

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-50 border border-sage-100 text-sage-700">
                            <Route className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">{type.name}</h1>
                                {type.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">{type.name_ar}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                <span className="font-mono text-gray-500">{type.code}</span>
                                {nature && (
                                    <>
                                        <span>·</span>
                                        <span>{nature.label}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => !togglePending && onToggle(type)}
                            title={type.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            className="focus:outline-none"
                            disabled={togglePending}
                        >
                            {type.is_active ? (
                                <Badge variant="success" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ● Actif
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ○ Inactif
                                </Badge>
                            )}
                        </button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(type)}>
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
                    <DetailCard title="Informations" icon={Route} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Code</span>
                                <span className="font-mono font-medium">{type.code}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Nom arabe</span>
                                <span dir="rtl">{type.name_ar ?? '—'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Statut</span>
                                <span>{type.is_active ? 'Actif' : 'Inactif'}</span>
                            </div>
                        </div>
                    </DetailCard>

                    {/* Playbook card */}
                    <DetailCard title="Nature business (playbook)" icon={Briefcase} accent="blue">
                        {nature ? (
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Playbook</span>
                                    <span className="font-medium">{nature.label}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Code</span>
                                    <span className="font-mono text-xs">{nature.code}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-muted-foreground">Actions de visite</span>
                                    <span className="font-medium">
                                        {actions.length}
                                        {actions.filter((a) => a.required).length > 0 &&
                                            ` (dont ${actions.filter((a) => a.required).length} oblig.)`}
                                    </span>
                                </div>
                                <button
                                    onClick={() => navigate('/routing/business-natures')}
                                    className="inline-flex items-center gap-1.5 text-xs text-sage-600 hover:text-sage-700 hover:underline mt-1"
                                >
                                    <ExternalLink className="w-3 h-3" />
                                    Gérer les playbooks
                                </button>
                            </div>
                        ) : type.business_nature_id ? (
                            <p className="text-sm text-gray-400">
                                Playbook #{type.business_nature_id} (introuvable dans le référentiel)
                            </p>
                        ) : (
                            <p className="text-sm text-gray-400">
                                Aucun playbook associé — les visites de ce type n'ont pas de règles d'action.
                            </p>
                        )}
                    </DetailCard>
                </div>

                {/* Playbook actions preview */}
                {actions.length > 0 && (
                    <DetailCard title="Actions du playbook" icon={ListChecks} accent="default">
                        <div className="space-y-2">
                            {actions.map((action, idx) => (
                                <div
                                    key={`${action.visit_action_code}-${idx}`}
                                    className="flex items-center gap-2 p-2.5 border border-gray-200 rounded-lg bg-white"
                                >
                                    <Badge variant="secondary" className="font-mono text-[10px]">
                                        {action.visit_action_code}
                                    </Badge>
                                    {action.required && (
                                        <span className="text-xs text-red-500 font-medium">Obligatoire</span>
                                    )}
                                    <span className="text-xs text-gray-500 ml-auto">
                                        Déclencheur : {action.gates_any?.[0]?.[0] ?? 'always'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </DetailCard>
                )}

                {type.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{type.description}</p>
                    </DetailCard>
                )}

                {/* Linked itineraries */}
                <DetailCard title={`Tournées de ce type (${linkedTotal})`} icon={Truck} accent="amber">
                    {linkedLoading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-10 rounded-lg bg-gray-100 animate-pulse" />
                            ))}
                        </div>
                    ) : linked.length === 0 ? (
                        <p className="text-sm text-gray-400">Aucune tournée n'utilise ce type.</p>
                    ) : (
                        <div className="space-y-2">
                            {linked.map((it) => (
                                <div
                                    key={it.id}
                                    className="flex items-center gap-3 p-2.5 rounded-lg border border-gray-100 bg-white"
                                >
                                    <Truck className="w-4 h-4 text-gray-300 shrink-0" />
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium text-gray-900 truncate">{it.name}</p>
                                        <p className="text-xs text-gray-400 font-mono truncate">{it.code}</p>
                                    </div>
                                    {it.rider && (
                                        <span className="text-xs text-gray-500 shrink-0">{it.rider.name}</span>
                                    )}
                                    <Badge
                                        variant={it.is_active ? 'success' : 'secondary'}
                                        className="text-[9px] shrink-0"
                                    >
                                        {it.is_active ? 'Active' : 'Inactive'}
                                    </Badge>
                                </div>
                            ))}
                            {linkedTotal > linked.length && (
                                <button
                                    onClick={() => navigate('/routing/itineraries')}
                                    className="w-full text-center text-xs text-sage-600 hover:text-sage-700 hover:underline py-1"
                                >
                                    Voir les {linkedTotal} tournées →
                                </button>
                            )}
                        </div>
                    )}
                </DetailCard>
            </div>
        </div>
    );
}

// ─── Empty state dashboard ────────────────────────────────────────────────────

function TypesDashboard({ types }: { types: ItineraryType[] }) {
    const kpis = [
        {
            label: 'Types de tournée',
            value: types.length,
            icon: <Route className="w-5 h-5 text-sage-600" />,
            bg: 'bg-sage-50 border-sage-100',
        },
        {
            label: 'Actifs',
            value: types.filter((t) => t.is_active).length,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50 border-emerald-100',
        },
        {
            label: 'Avec playbook',
            value: types.filter((t) => t.business_nature_id != null).length,
            icon: <Briefcase className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50 border-blue-100',
        },
        {
            label: 'Sans playbook',
            value: types.filter((t) => t.business_nature_id == null).length,
            icon: <Layers className="w-5 h-5 text-amber-500" />,
            bg: 'bg-amber-50 border-amber-100',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="text-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">Types de tournée</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Chaque type détermine le playbook de visite (nature business) appliqué sur le terrain.
                        Sélectionnez un type pour voir ses détails.
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
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function ItineraryTypesPage() {
    const [filters, setFilters] = useState<ItineraryTypeFilters>(DEFAULT_FILTERS);
    const [activeOnly, setActiveOnly] = useState(false);
    const { data, isLoading, refetch } = useItineraryTypes(filters);
    const { data: businessNatures } = useBusinessNatures();

    const [selectedType, setSelectedType] = useState<ItineraryType | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingType, setEditingType] = useState<ItineraryType | null | undefined>(undefined);
    const [typeToDelete, setTypeToDelete] = useState<ItineraryType | null>(null);

    const createType = useCreateItineraryType();
    const updateType = useUpdateItineraryType(editingType?.id ?? 0);
    const toggleType = useUpdateItineraryType(selectedType?.id ?? 0);
    const deleteType = useDeleteItineraryType();

    const naturesById = useMemo(
        () => new Map((businessNatures ?? []).map((n) => [n.id, n])),
        [businessNatures]
    );

    const allTypes = data?.data?.data ?? [];
    const rows = useMemo(
        () => (activeOnly ? allTypes.filter((t) => t.is_active) : allTypes),
        [allTypes, activeOnly]
    );
    const totalCount = data?.data?.total ?? 0;

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

    const handleToggle = async (type: ItineraryType) => {
        try {
            await toggleType.mutateAsync({ is_active: !type.is_active });
            toast.success(type.is_active ? 'Type désactivé.' : 'Type activé.');
            setSelectedType((prev) =>
                prev && prev.id === type.id ? { ...prev, is_active: !prev.is_active } : prev
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
            if (selectedType?.id === typeToDelete.id) {
                setSelectedType(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const columnDefs = [
        { field: 'name', headerName: 'Nom', flex: 2 },
        { field: 'code', headerName: 'Code', flex: 1.2, cellClass: 'font-mono text-xs' },
        {
            field: 'business_nature_id',
            headerName: 'Playbook',
            flex: 1.2,
            cellRenderer: (params: { value: number | null }) => {
                const nature = params.value != null ? naturesById.get(params.value) : undefined;
                return nature ? (
                    <Badge variant="secondary" className="text-[10px] font-mono">{nature.code}</Badge>
                ) : (
                    <span className="text-xs text-gray-300">—</span>
                );
            },
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
                        {
                            icon: selectedType.is_active ? PowerOff : Power,
                            label: selectedType.is_active ? 'Désactiver' : 'Activer',
                            variant: 'warning' as const,
                            onClick: () => handleToggle(selectedType),
                        },
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
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Route className="h-5 w-5 text-sage-600" />
                                <h1 className="text-sm font-semibold text-gray-900">Types de tournée</h1>
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
                            <label className="flex items-center gap-2 text-xs text-gray-600 cursor-pointer select-none">
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

                    <Dialog open={!!typeToDelete} onOpenChange={(open) => !open && setTypeToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer le type ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{typeToDelete?.name}</strong> ({typeToDelete?.code}).
                                    Cette action échoue si des tournées utilisent encore ce type.
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
                        <ItineraryTypeDetail
                            type={selectedType}
                            nature={
                                selectedType.business_nature_id != null
                                    ? naturesById.get(selectedType.business_nature_id)
                                    : undefined
                            }
                            onBack={() => setShowDetailPanel(false)}
                            onEdit={(type) => setEditingType(type)}
                            onToggle={handleToggle}
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
