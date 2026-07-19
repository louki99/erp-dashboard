import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Truck,
    Plus,
    Edit2,
    Trash2,
    RotateCcw,
    Power,
    PowerOff,
    X,
    Search,
    MapPin,
    Users,
    Route,
    Building2,
    SlidersHorizontal,
    CheckCircle2,
    UserX,
    PenTool,
    CalendarDays,
    Milestone,
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

// ─── Detail panel ─────────────────────────────────────────────────────────────

function ItineraryDetail({
    itinerary,
    onBack,
    onEdit,
    onToggle,
    togglePending,
}: {
    itinerary: Itinerary;
    onBack?: () => void;
    onEdit: (itinerary: Itinerary) => void;
    onToggle: (itinerary: Itinerary) => void;
    togglePending: boolean;
}) {
    const navigate = useNavigate();
    const { data: detailData } = useItinerary(itinerary.id);
    const syncPartners = useSyncItineraryPartners(itinerary.id);
    const syncUsers = useSyncItineraryUsers(itinerary.id);
    const [activeTab, setActiveTab] = useState('detail');

    const detail = detailData?.itinerary ?? itinerary;
    const partners = detail.itinerary_partners ?? [];
    const stopPoints = partners.filter((p) => p.is_stop_point).length;
    const totalKm = partners.reduce((sum, p) => sum + (p.mileage ?? 0), 0);

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
            {/* Header */}
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-50 border border-sage-100 text-sage-700">
                            <Truck className="h-5 w-5" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-lg font-bold text-gray-900">{detail.name}</h1>
                                {detail.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">{detail.name_ar}</span>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                                <span className="font-mono text-gray-500">{detail.code}</span>
                                {detail.itinerary_type && (
                                    <>
                                        <span>·</span>
                                        <span>{detail.itinerary_type.name}</span>
                                    </>
                                )}
                                {detail.geo_area && (
                                    <>
                                        <span>·</span>
                                        <span>{detail.geo_area.name}</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => !togglePending && onToggle(detail)}
                            title={detail.is_active ? 'Cliquer pour désactiver' : 'Cliquer pour activer'}
                            className="focus:outline-none"
                            disabled={togglePending}
                        >
                            {detail.is_active ? (
                                <Badge variant="success" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ● Active
                                </Badge>
                            ) : (
                                <Badge variant="secondary" className="text-[10px] cursor-pointer hover:opacity-80">
                                    ○ Inactive
                                </Badge>
                            )}
                        </button>
                        <Button variant="outline" size="sm" onClick={() => onEdit(detail)}>
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

                {/* Mini KPI strip */}
                <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                    <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-indigo-400" />
                        <strong className="text-gray-700">{partners.length}</strong> clients
                    </span>
                    <span className="flex items-center gap-1.5">
                        <Milestone className="w-3.5 h-3.5 text-amber-400" />
                        <strong className="text-gray-700">{stopPoints}</strong> stop points
                    </span>
                    {totalKm > 0 && (
                        <span className="flex items-center gap-1.5">
                            <Route className="w-3.5 h-3.5 text-sage-500" />
                            <strong className="text-gray-700">{totalKm.toFixed(0)}</strong> km déclarés
                        </span>
                    )}
                    <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-gray-300" />
                        <strong className="text-gray-700">{detail.itinerary_users?.length ?? 0}</strong> vendeurs
                    </span>
                </div>
            </div>

            <SageTabs
                tabs={[
                    { id: 'detail', label: 'Détail' },
                    { id: 'partners', label: `Partenaires (${partners.length})` },
                    { id: 'users', label: `Vendeurs (${detail.itinerary_users?.length ?? 0})` },
                ]}
                activeTabId={activeTab}
                onTabChange={setActiveTab}
                className="px-6 pt-3 shrink-0"
            />

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'detail' && (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <DetailCard title="Configuration" icon={Route} accent="sage">
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Type</span>
                                        <span className="font-medium">{detail.itinerary_type?.name ?? detail.itinerary_type_id}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Fréquence de visite</span>
                                        <span className="font-mono">{detail.days_before_next_visit} j</span>
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
                                        <span className="text-muted-foreground">Secteur</span>
                                        <span className="font-medium">
                                            {detail.geo_area ? `${detail.geo_area.name} (${detail.geo_area.code})` : detail.geo_area_code ?? '—'}
                                        </span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="text-muted-foreground">Vendeur titulaire</span>
                                        <span className="font-medium">{detail.rider?.name ?? '—'}</span>
                                    </div>
                                </div>
                            </DetailCard>
                        </div>

                        <DetailCard title="Période de validité" icon={Building2} accent="amber">
                            <div className="grid grid-cols-3 gap-4 text-sm">
                                <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Début</p>
                                    <p className="font-medium">{detail.start_date ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Fin</p>
                                    <p className="font-medium">{detail.end_date ?? '—'}</p>
                                </div>
                                <div>
                                    <p className="text-muted-foreground text-xs mb-0.5">Ordre</p>
                                    <p className="font-mono">{detail.sort_order}</p>
                                </div>
                            </div>
                        </DetailCard>

                        {/* Quick navigation */}
                        <div className="grid grid-cols-2 gap-3">
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => navigate('/routing/designer')}
                            >
                                <PenTool className="w-4 h-4 mr-2 text-sage-600" />
                                Ouvrir dans le Visual Designer
                            </Button>
                            <Button
                                variant="outline"
                                className="justify-start"
                                onClick={() => navigate('/routing/planning')}
                            >
                                <CalendarDays className="w-4 h-4 mr-2 text-indigo-500" />
                                Voir le planning hebdomadaire
                            </Button>
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && detailData && (
                    <ItineraryPartnersManager
                        key={`partners-${itinerary.id}`}
                        partners={partners}
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

// ─── Empty state dashboard ────────────────────────────────────────────────────

function ItinerariesDashboard({ itineraries }: { itineraries: Itinerary[] }) {
    const navigate = useNavigate();

    const kpis = [
        {
            label: 'Tournées',
            value: itineraries.length,
            icon: <Truck className="w-5 h-5 text-sage-600" />,
            bg: 'bg-sage-50 border-sage-100',
        },
        {
            label: 'Actives',
            value: itineraries.filter((i) => i.is_active).length,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50 border-emerald-100',
        },
        {
            label: 'Avec vendeur',
            value: itineraries.filter((i) => i.rider_id != null).length,
            icon: <Users className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50 border-blue-100',
        },
        {
            label: 'Sans vendeur',
            value: itineraries.filter((i) => i.rider_id == null).length,
            icon: <UserX className="w-5 h-5 text-amber-500" />,
            bg: 'bg-amber-50 border-amber-100',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8">
            <div className="max-w-3xl mx-auto space-y-6">
                <div className="text-center mb-2">
                    <h3 className="text-lg font-semibold text-gray-800">Gestion des Tournées</h3>
                    <p className="text-sm text-gray-500 mt-1">
                        Sélectionnez une tournée pour gérer ses partenaires, vendeurs et sa configuration.
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

                {/* Quick links to workspaces */}
                <div className="grid grid-cols-2 gap-4">
                    <button
                        onClick={() => navigate('/routing/designer')}
                        className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 bg-white hover:border-sage-300 hover:shadow-sm transition-all text-left group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-sage-50 border border-sage-100 flex items-center justify-center shrink-0">
                            <PenTool className="w-5 h-5 text-sage-600" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800 group-hover:text-sage-700">Visual Designer</p>
                            <p className="text-xs text-gray-400 mt-0.5">Composer les tournées sur la carte (lasso, GPS)</p>
                        </div>
                    </button>
                    <button
                        onClick={() => navigate('/routing/planning')}
                        className="flex items-center gap-4 p-5 rounded-xl border border-gray-200 bg-white hover:border-indigo-300 hover:shadow-sm transition-all text-left group"
                    >
                        <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                            <CalendarDays className="w-5 h-5 text-indigo-500" />
                        </div>
                        <div>
                            <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600">Planning hebdomadaire</p>
                            <p className="text-xs text-gray-400 mt-0.5">Affecter les tournées aux agents par jour</p>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Form panel (inline, replaces modal) ─────────────────────────────────────

function ItineraryFormPanel({
    itinerary,
    itineraryTypes,
    branches,
    geoAreas,
    riders,
    onSubmit,
    onCancel,
    loading,
}: {
    itinerary: Itinerary | null;
    itineraryTypes: any[];
    branches: any[];
    geoAreas: any[];
    riders: any[];
    onSubmit: (payload: CreateItineraryPayload | UpdateItineraryPayload) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}) {
    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="border-b border-gray-200 bg-white px-6 py-4 shrink-0">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-sage-50 border border-sage-100 text-sage-700">
                            {itinerary ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                        </div>
                        <div>
                            <h1 className="text-lg font-bold text-gray-900">
                                {itinerary ? 'Modifier la tournée' : 'Nouvelle tournée'}
                            </h1>
                            {itinerary && (
                                <p className="text-xs text-gray-400 font-mono mt-0.5">{itinerary.code} · {itinerary.name}</p>
                            )}
                            {!itinerary && (
                                <p className="text-xs text-gray-400 mt-0.5">Configuration : type, secteur, vendeur et période</p>
                            )}
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <ItineraryForm
                    key={itinerary ? `edit-${itinerary.id}` : 'create'}
                    itinerary={itinerary}
                    itineraryTypes={itineraryTypes}
                    branches={branches}
                    geoAreas={geoAreas}
                    riders={riders}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                />
            </div>
        </div>
    );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

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
    const toggleItinerary = useUpdateItinerary(selectedItinerary?.id ?? 0);
    const deleteItinerary = useDeleteItinerary();

    const rows = data?.itineraries.data ?? [];
    const totalCount = data?.itineraries.total ?? 0;

    const handleSelect = (itinerary: Itinerary) => {
        setSelectedItinerary(itinerary);
        setShowDetailPanel(true);
    };

    const handleFormSubmit = async (payload: CreateItineraryPayload | UpdateItineraryPayload) => {
        try {
            if (editingItinerary) {
                await updateItinerary.mutateAsync(payload);
                toast.success('Tournée mise à jour.');
                // Return to detail panel for the same itinerary
                setEditingItinerary(undefined);
                setShowDetailPanel(true);
            } else {
                await createItinerary.mutateAsync(payload as CreateItineraryPayload);
                toast.success('Tournée créée.');
                setEditingItinerary(undefined);
            }
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleToggle = async (itinerary: Itinerary) => {
        try {
            await toggleItinerary.mutateAsync({ is_active: !itinerary.is_active });
            toast.success(itinerary.is_active ? 'Tournée désactivée.' : 'Tournée activée.');
            setSelectedItinerary((prev) =>
                prev && prev.id === itinerary.id ? { ...prev, is_active: !prev.is_active } : prev
            );
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
        { field: 'name', headerName: 'Tournée', flex: 2 },
        { field: 'code', headerName: 'Code', flex: 1.3, cellClass: 'font-mono text-xs' },
        {
            field: 'rider',
            headerName: 'Vendeur',
            flex: 1.2,
            cellRenderer: (params: { data: Itinerary }) =>
                params.data.rider ? (
                    <span className="text-xs">{params.data.rider.name}</span>
                ) : (
                    <span className="text-xs text-amber-500">Non affecté</span>
                ),
        },
        {
            field: 'is_active',
            headerName: 'Statut',
            flex: 0.7,
            cellRenderer: (params: { value: boolean }) =>
                params.value ? (
                    <span className="text-xs font-semibold text-emerald-600">Active</span>
                ) : (
                    <span className="text-xs font-semibold text-gray-400">Inactive</span>
                ),
        },
    ];

    const branchOptions = data?.branches.map((b) => ({ value: b.code, label: `${b.name} (${b.code})` })) ?? [];
    const geoAreaOptions = data?.geoAreas.map((g) => ({ value: g.code, label: `${g.name} (${g.code})` })) ?? [];
    const riderOptions = data?.riders.map((r) => ({ value: r.id, label: r.name })) ?? [];
    const typeOptions =
        itineraryTypesData?.data?.data.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` })) ?? [];

    const activeFilterCount = [
        filters.branch_code,
        filters.geo_area_code,
        filters.rider_id,
        filters.itinerary_type_id,
        filters.is_active,
    ].filter((v) => v !== undefined && v !== '').length;

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
                        {
                            icon: selectedItinerary.is_active ? PowerOff : Power,
                            label: selectedItinerary.is_active ? 'Désactiver' : 'Activer',
                            variant: 'warning' as const,
                            onClick: () => handleToggle(selectedItinerary),
                        },
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
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Truck className="h-5 w-5 text-sage-600" />
                                <h1 className="text-sm font-semibold text-gray-900">Tournées</h1>
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
                                rowData={rows}
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
                    <Dialog open={!!itineraryToDelete} onOpenChange={(open) => !open && setItineraryToDelete(null)}>
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2 text-destructive">
                                    <Trash2 className="h-5 w-5" />
                                    Supprimer la tournée ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer <strong>{itineraryToDelete?.name}</strong> ({itineraryToDelete?.code})
                                    ainsi que ses affectations partenaires et vendeurs. Cette action est irréversible.
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
                                    Affinez la liste par type, branche, zone, vendeur ou statut.
                                </DialogDescription>
                            </DialogHeader>
                            <div className="space-y-4 py-2">
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Type de tournée</Label>
                                    <SearchableSelect
                                        options={typeOptions}
                                        value={draftFilters.itinerary_type_id ?? undefined}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, itinerary_type_id: v ? Number(v) : undefined }))}
                                        placeholder="— Tous les types —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Branche</Label>
                                    <SearchableSelect
                                        options={branchOptions}
                                        value={draftFilters.branch_code ?? undefined}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, branch_code: v ? String(v) : undefined }))}
                                        placeholder="— Toutes les branches —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Zone géographique</Label>
                                    <SearchableSelect
                                        options={geoAreaOptions}
                                        value={draftFilters.geo_area_code ?? undefined}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, geo_area_code: v ? String(v) : undefined }))}
                                        placeholder="— Toutes les zones —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Vendeur</Label>
                                    <SearchableSelect
                                        options={riderOptions}
                                        value={draftFilters.rider_id ?? undefined}
                                        onChange={(v) => setDraftFilters((prev) => ({ ...prev, rider_id: v ? Number(v) : undefined }))}
                                        placeholder="— Tous les vendeurs —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">Statut</Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {([
                                            { label: 'Toutes', value: undefined },
                                            { label: 'Actives', value: true },
                                            { label: 'Inactives', value: false },
                                        ] as const).map((opt) => (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() => setDraftFilters((prev) => ({ ...prev, is_active: opt.value }))}
                                                className={`py-1.5 rounded-lg border text-xs font-medium transition-all ${
                                                    draftFilters.is_active === opt.value
                                                        ? 'bg-sage-600 text-white border-sage-600'
                                                        : 'bg-white text-gray-600 border-gray-200 hover:border-sage-400'
                                                }`}
                                            >
                                                {opt.label}
                                            </button>
                                        ))}
                                    </div>
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

                    {editingItinerary !== undefined ? (
                        <ItineraryFormPanel
                            itinerary={editingItinerary}
                            itineraryTypes={itineraryTypesData?.data?.data ?? []}
                            branches={data?.branches ?? []}
                            geoAreas={data?.geoAreas ?? []}
                            riders={data?.riders ?? []}
                            onSubmit={handleFormSubmit}
                            onCancel={() => setEditingItinerary(undefined)}
                            loading={createItinerary.isPending || updateItinerary.isPending}
                        />
                    ) : showDetailPanel && selectedItinerary ? (
                        <ItineraryDetail
                            itinerary={selectedItinerary}
                            onBack={() => setShowDetailPanel(false)}
                            onEdit={(itinerary) => setEditingItinerary(itinerary)}
                            onToggle={handleToggle}
                            togglePending={toggleItinerary.isPending}
                        />
                    ) : (
                        <ItinerariesDashboard itineraries={rows} />
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
