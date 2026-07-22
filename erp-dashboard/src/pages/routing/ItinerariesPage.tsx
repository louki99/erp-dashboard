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
    ChevronRight,
    Hash,
    Loader2,
    AlertTriangle,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
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
    useItineraryMasterData,
    useItineraryTypes,
    useSyncItineraryPartners,
    useSyncItineraryUsers,
    useUpdateItinerary,
} from '@/hooks/routing/useRouting';
import { useVendeurs } from '@/hooks/rbac/useRbac';
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

// ─── List item ────────────────────────────────────────────────────────────────

function ItineraryListItem({
    itinerary,
    selected,
    onClick,
}: {
    itinerary: Itinerary;
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
            {/* Selected indicator bar */}
            {selected && (
                <span className="absolute left-0 top-1 bottom-1 w-0.5 rounded-r bg-sage-500" />
            )}
            <span className={`w-2 h-2 rounded-full shrink-0 ${itinerary.is_active ? 'bg-emerald-400' : 'bg-gray-300'}`} />
            <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium truncate ${selected ? 'text-sage-800' : 'text-gray-800'}`}>
                    {itinerary.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[11px] font-mono text-gray-400">{itinerary.code}</span>
                    {itinerary.rider ? (
                        <span className="text-[11px] text-gray-400 truncate">· {itinerary.rider.name}</span>
                    ) : (
                        <span className="text-[11px] text-amber-500">· Non affecté</span>
                    )}
                </div>
            </div>
            <ChevronRight className="w-3.5 h-3.5 shrink-0 text-gray-300" />
        </button>
    );
}

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
    const { data: vendeursData } = useVendeurs();
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
            {/* Hero header */}
            <div className="shrink-0 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-6 pt-5 pb-4">
                    <div className="flex items-center gap-4">
                        <div
                            className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border ${
                                detail.is_active
                                    ? 'bg-gradient-to-br from-sage-500 to-sage-700 border-sage-600 text-white'
                                    : 'bg-gray-100 border-gray-200 text-gray-400'
                            }`}
                        >
                            <Truck className="w-6 h-6" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2.5 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900">{detail.name}</h1>
                                {detail.name_ar && (
                                    <span className="text-sm text-gray-400" dir="rtl">
                                        {detail.name_ar}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                                <span className="inline-flex items-center gap-1 text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded-md">
                                    <Hash className="w-3 h-3" />
                                    {detail.code}
                                </span>
                                {detail.itinerary_type && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-sage-50 text-sage-600 border border-sage-100 px-2 py-0.5 rounded-md">
                                        <Route className="w-3 h-3" />
                                        {detail.itinerary_type.name}
                                    </span>
                                )}
                                {detail.geo_area && (
                                    <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 border border-blue-100 px-2 py-0.5 rounded-md">
                                        <MapPin className="w-3 h-3" />
                                        {detail.geo_area.name}
                                    </span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                        {/* Active toggle pill */}
                        <button
                            onClick={() => !togglePending && onToggle(detail)}
                            disabled={togglePending}
                            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                                detail.is_active
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100'
                                    : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                            } ${togglePending ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                            {togglePending ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                                <span
                                    className={`w-1.5 h-1.5 rounded-full ${
                                        detail.is_active ? 'bg-emerald-500' : 'bg-gray-400'
                                    }`}
                                />
                            )}
                            {detail.is_active ? 'Active' : 'Inactive'}
                        </button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => onEdit(detail)}
                            className="gap-1.5"
                        >
                            <Edit2 className="w-3.5 h-3.5" />
                            Éditer
                        </Button>
                        {onBack && (
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={onBack}
                                className="w-8 h-8 p-0 text-gray-400"
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        )}
                    </div>
                </div>

                {/* Stats strip */}
                <div className="grid grid-cols-4 divide-x divide-gray-100 border-t border-gray-100">
                    {[
                        {
                            label: 'Clients',
                            value: partners.length,
                            icon: <Users className="w-3.5 h-3.5 text-indigo-500" />,
                        },
                        {
                            label: 'Stop points',
                            value: stopPoints,
                            icon: <Milestone className="w-3.5 h-3.5 text-amber-500" />,
                        },
                        {
                            label: 'Km déclarés',
                            value: totalKm > 0 ? totalKm.toFixed(0) + ' km' : '—',
                            icon: <Route className="w-3.5 h-3.5 text-sage-500" />,
                        },
                        {
                            label: 'Vendeurs',
                            value: detail.itinerary_users?.length ?? 0,
                            icon: <Users className="w-3.5 h-3.5 text-gray-400" />,
                        },
                    ].map((s) => (
                        <div key={s.label} className="flex items-center gap-2.5 px-4 py-3">
                            {s.icon}
                            <div>
                                <p className="text-sm font-bold text-gray-900 leading-none">
                                    {s.value}
                                </p>
                                <p className="text-[10px] text-gray-400 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
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
                        {/* Config card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                                <Route className="w-3.5 h-3.5 text-sage-500" />
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Configuration
                                </p>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {[
                                    {
                                        label: 'Type',
                                        value: (
                                            <span className="text-sm text-gray-800">
                                                {detail.itinerary_type?.name ?? '—'}
                                            </span>
                                        ),
                                    },
                                    {
                                        label: 'Ordre',
                                        value: (
                                            <span className="font-mono text-xs text-gray-700">
                                                {detail.sort_order}
                                            </span>
                                        ),
                                    },
                                ].map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-center justify-between px-4 py-2.5"
                                    >
                                        <span className="text-xs text-gray-400">{row.label}</span>
                                        {row.value}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Affectations card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                                <MapPin className="w-3.5 h-3.5 text-blue-500" />
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Affectations
                                </p>
                            </div>
                            <div className="divide-y divide-gray-50">
                                {[
                                    {
                                        label: 'Branche',
                                        value: (
                                            <span className="text-sm text-gray-800">
                                                {detail.branch?.name ?? '—'}
                                            </span>
                                        ),
                                    },
                                    {
                                        label: 'Secteur',
                                        value: (
                                            <span className="text-sm text-gray-800">
                                                {detail.geo_area
                                                    ? `${detail.geo_area.name} (${detail.geo_area.code})`
                                                    : '—'}
                                            </span>
                                        ),
                                    },
                                    {
                                        label: 'Vendeur titulaire',
                                        value: (
                                            <span className="text-sm text-gray-800">
                                                {detail.rider?.name ?? '—'}
                                            </span>
                                        ),
                                    },
                                ].map((row) => (
                                    <div
                                        key={row.label}
                                        className="flex items-center justify-between px-4 py-2.5"
                                    >
                                        <span className="text-xs text-gray-400">{row.label}</span>
                                        {row.value}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Période de validité card */}
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                            <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
                                <Building2 className="w-3.5 h-3.5 text-amber-500" />
                                <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                                    Période de validité
                                </p>
                            </div>
                            <div className="grid grid-cols-2 divide-x divide-gray-50">
                                <div className="px-4 py-3">
                                    <p className="text-[10px] text-gray-400 mb-0.5">Début</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        {detail.start_date ?? '—'}
                                    </p>
                                </div>
                                <div className="px-4 py-3">
                                    <p className="text-[10px] text-gray-400 mb-0.5">Fin</p>
                                    <p className="text-sm font-medium text-gray-800">
                                        {detail.end_date ?? '—'}
                                    </p>
                                </div>
                            </div>
                        </div>

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

                {activeTab === 'users' && (
                    <ItineraryUsersManager
                        key={`users-${itinerary.id}`}
                        users={detail.itinerary_users ?? []}
                        availableUsers={(
                            vendeursData?.data ??
                            detailData?.availableUsers ??
                            []
                        ).map((u) => ({
                            id: u.id,
                            name: u.name,
                            email: (u as any).email ?? '',
                        }))}
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
            num: 'text-sage-700',
        },
        {
            label: 'Actives',
            value: itineraries.filter((i) => i.is_active).length,
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-500" />,
            bg: 'bg-emerald-50 border-emerald-100',
            num: 'text-emerald-700',
        },
        {
            label: 'Avec vendeur',
            value: itineraries.filter((i) => i.rider_id != null).length,
            icon: <Users className="w-5 h-5 text-blue-500" />,
            bg: 'bg-blue-50 border-blue-100',
            num: 'text-blue-700',
        },
        {
            label: 'Sans vendeur',
            value: itineraries.filter((i) => i.rider_id == null).length,
            icon: <UserX className="w-5 h-5 text-amber-500" />,
            bg: 'bg-amber-50 border-amber-100',
            num: 'text-amber-700',
        },
    ];

    return (
        <div className="flex-1 overflow-y-auto p-8 bg-gray-50/40">
            <div className="max-w-2xl mx-auto space-y-6">
                <div className="text-center">
                    <div className="w-14 h-14 rounded-2xl bg-sage-50 border border-sage-100 flex items-center justify-center mx-auto mb-4">
                        <Truck className="w-7 h-7 text-sage-500" />
                    </div>
                    <h3 className="text-lg font-bold text-gray-800">Gestion des Tournées</h3>
                    <p className="text-sm text-gray-500 mt-1 max-w-sm mx-auto">
                        Sélectionnez une tournée pour gérer ses partenaires, vendeurs et sa
                        configuration.
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    {kpis.map((kpi) => (
                        <div key={kpi.label} className={`rounded-2xl border p-5 ${kpi.bg}`}>
                            <div className="mb-3">{kpi.icon}</div>
                            <p className={`text-3xl font-bold leading-none ${kpi.num}`}>
                                {kpi.value}
                            </p>
                            <p className="text-xs text-gray-500 mt-1.5">{kpi.label}</p>
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
                            <p className="text-sm font-semibold text-gray-800 group-hover:text-sage-700">
                                Visual Designer
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Composer les tournées sur la carte (lasso, GPS)
                            </p>
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
                            <p className="text-sm font-semibold text-gray-800 group-hover:text-indigo-600">
                                Planning hebdomadaire
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                                Affecter les tournées aux agents par jour
                            </p>
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
                                <p className="text-xs text-gray-400 font-mono mt-0.5">
                                    {itinerary.code} · {itinerary.name}
                                </p>
                            )}
                            {!itinerary && (
                                <p className="text-xs text-gray-400 mt-0.5">
                                    Configuration : type, secteur, vendeur et période
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
    const { data: vendeursData } = useVendeurs();

    const [selectedItinerary, setSelectedItinerary] = useState<Itinerary | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingItinerary, setEditingItinerary] = useState<Itinerary | null | undefined>(
        undefined
    );
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
                prev && prev.id === itinerary.id
                    ? { ...prev, is_active: !prev.is_active }
                    : prev
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

    const { data: masterData } = useItineraryMasterData();

    const branchOptions =
        data?.branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` })) ?? [];
    const geoAreaOptions =
        data?.geoAreas.map((g) => ({ value: g.id, label: `${g.name} (${g.code})` })) ?? [];
    const riderOptions = (vendeursData?.data ?? data?.riders ?? []).map((r) => ({
        value: r.id,
        label: r.name,
    }));
    const typeOptions =
        itineraryTypesData?.data?.data.map((t) => ({
            value: t.id,
            label: `${t.name} (${t.code})`,
        })) ?? [];

    const formBranches = masterData?.branches ?? data?.branches ?? [];
    const formGeoAreas = masterData?.geo_areas ?? data?.geoAreas ?? [];
    const formRiders = (
        vendeursData?.data ??
        masterData?.riders ??
        data?.riders ??
        []
    ).map((u) => ({ id: u.id, name: u.name }));

    const activeFilterCount = [
        filters.branch_id,
        filters.geo_area_id,
        filters.rider_id,
        filters.itinerary_type_id,
        filters.is_active,
    ].filter((v) => v !== undefined && v !== '').length;

    const actionGroups = [
        {
            items: [
                {
                    icon: Plus,
                    label: 'Nouvelle tournée',
                    variant: 'primary' as const,
                    onClick: () => setEditingItinerary(null),
                },
                {
                    icon: RotateCcw,
                    label: 'Rafraîchir',
                    variant: 'default' as const,
                    onClick: () => refetch(),
                },
            ],
        },
        ...(selectedItinerary
            ? [
                  {
                      items: [
                          {
                              icon: Edit2,
                              label: 'Éditer',
                              variant: 'sage' as const,
                              onClick: () => setEditingItinerary(selectedItinerary),
                          },
                          {
                              icon: selectedItinerary.is_active ? PowerOff : Power,
                              label: selectedItinerary.is_active ? 'Désactiver' : 'Activer',
                              variant: 'warning' as const,
                              onClick: () => handleToggle(selectedItinerary),
                          },
                          {
                              icon: Trash2,
                              label: 'Supprimer',
                              variant: 'danger' as const,
                              onClick: () => setItineraryToDelete(selectedItinerary),
                          },
                      ],
                  },
              ]
            : []),
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    {/* Panel header */}
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                                    <Truck className="w-4 h-4 text-sage-600" />
                                </div>
                                <h1 className="text-sm font-bold text-gray-900">Tournées</h1>
                            </div>
                            <span className="text-[11px] font-mono text-gray-400">
                                {rows.length}/{totalCount}
                            </span>
                        </div>

                        {/* Search */}
                        <div className="relative mb-2">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                            <Input
                                placeholder="Rechercher (nom, code)..."
                                value={filters.search ?? ''}
                                onChange={(e) =>
                                    setFilters((prev) => ({
                                        ...prev,
                                        search: e.target.value,
                                        page: 1,
                                    }))
                                }
                                className="h-8 text-xs pl-8"
                            />
                        </div>

                        {/* Filter button */}
                        <div className="flex items-center gap-2 mb-2">
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
                                    onClick={() =>
                                        setFilters((prev) => ({
                                            ...DEFAULT_FILTERS,
                                            search: prev.search,
                                        }))
                                    }
                                >
                                    Réinitialiser
                                </Button>
                            )}
                        </div>

                        {/* Active filter chips */}
                        <div className="flex gap-1.5">
                            {(
                                [
                                    { label: 'Toutes', value: undefined },
                                    { label: 'Actives', value: true },
                                    { label: 'Inactives', value: false },
                                ] as const
                            ).map((chip) => (
                                <button
                                    key={chip.label}
                                    onClick={() =>
                                        setFilters((p) => ({
                                            ...p,
                                            is_active: chip.value,
                                            page: 1,
                                        }))
                                    }
                                    className={
                                        filters.is_active === chip.value
                                            ? 'px-2.5 py-1 rounded-full text-[11px] font-medium bg-sage-600 text-white'
                                            : 'px-2.5 py-1 rounded-full text-[11px] font-medium bg-gray-100 text-gray-500 hover:bg-gray-200 transition-colors'
                                    }
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
                                    <div
                                        key={i}
                                        className="h-14 rounded-xl bg-gray-100 animate-pulse"
                                    />
                                ))}
                            </div>
                        ) : rows.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                                <Truck className="w-8 h-8 mb-2 text-gray-200" />
                                <p className="text-xs">Aucune tournée trouvée</p>
                            </div>
                        ) : (
                            rows.map((itinerary) => (
                                <ItineraryListItem
                                    key={itinerary.id}
                                    itinerary={itinerary}
                                    selected={selectedItinerary?.id === itinerary.id}
                                    onClick={() => handleSelect(itinerary)}
                                />
                            ))
                        )}
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    {/* Delete dialog */}
                    <Dialog
                        open={!!itineraryToDelete}
                        onOpenChange={(open) => !open && setItineraryToDelete(null)}
                    >
                        <DialogContent className="max-w-md">
                            <DialogHeader>
                                <DialogTitle className="flex items-center gap-2">
                                    <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                        <AlertTriangle className="h-4 w-4 text-red-600" />
                                    </div>
                                    Supprimer la tournée ?
                                </DialogTitle>
                                <DialogDescription>
                                    Vous allez supprimer{' '}
                                    <strong>{itineraryToDelete?.name}</strong> (
                                    {itineraryToDelete?.code}) ainsi que ses affectations
                                    partenaires et vendeurs. Cette action est irréversible.
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button
                                    variant="outline"
                                    onClick={() => setItineraryToDelete(null)}
                                >
                                    Annuler
                                </Button>
                                <Button
                                    className="bg-red-600 hover:bg-red-700 text-white"
                                    onClick={handleDelete}
                                    disabled={deleteItinerary.isPending}
                                >
                                    {deleteItinerary.isPending && (
                                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                    )}
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                    {/* Filters dialog */}
                    <Dialog
                        open={showFilters}
                        onOpenChange={(open) => !open && setShowFilters(false)}
                    >
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
                                    <Label className="text-xs font-medium text-gray-700">
                                        Type de tournée
                                    </Label>
                                    <SearchableSelect
                                        options={typeOptions}
                                        value={draftFilters.itinerary_type_id ?? undefined}
                                        onChange={(v) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                itinerary_type_id: v ? Number(v) : undefined,
                                            }))
                                        }
                                        placeholder="— Tous les types —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">
                                        Branche
                                    </Label>
                                    <SearchableSelect
                                        options={branchOptions}
                                        value={draftFilters.branch_id ?? undefined}
                                        onChange={(v) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                branch_id: v ? Number(v) : undefined,
                                            }))
                                        }
                                        placeholder="— Toutes les branches —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">
                                        Zone géographique
                                    </Label>
                                    <SearchableSelect
                                        options={geoAreaOptions}
                                        value={draftFilters.geo_area_id ?? undefined}
                                        onChange={(v) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                geo_area_id: v ? Number(v) : undefined,
                                            }))
                                        }
                                        placeholder="— Toutes les zones —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">
                                        Vendeur
                                    </Label>
                                    <SearchableSelect
                                        options={riderOptions}
                                        value={draftFilters.rider_id ?? undefined}
                                        onChange={(v) =>
                                            setDraftFilters((prev) => ({
                                                ...prev,
                                                rider_id: v ? Number(v) : undefined,
                                            }))
                                        }
                                        placeholder="— Tous les vendeurs —"
                                        clearable
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label className="text-xs font-medium text-gray-700">
                                        Statut
                                    </Label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {(
                                            [
                                                { label: 'Toutes', value: undefined },
                                                { label: 'Actives', value: true },
                                                { label: 'Inactives', value: false },
                                            ] as const
                                        ).map((opt) => (
                                            <button
                                                key={opt.label}
                                                type="button"
                                                onClick={() =>
                                                    setDraftFilters((prev) => ({
                                                        ...prev,
                                                        is_active: opt.value,
                                                    }))
                                                }
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
                                        setFilters((prev) => ({
                                            ...DEFAULT_FILTERS,
                                            search: prev.search,
                                        }));
                                        setShowFilters(false);
                                    }}
                                >
                                    Réinitialiser
                                </Button>
                                <Button
                                    onClick={() => {
                                        setFilters((prev) => ({
                                            ...draftFilters,
                                            search: prev.search,
                                            page: 1,
                                        }));
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
                            branches={formBranches}
                            geoAreas={formGeoAreas}
                            riders={formRiders}
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
