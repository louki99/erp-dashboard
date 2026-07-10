import { useState, useMemo, useCallback, useEffect } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    DndContext,
    DragOverlay,
    PointerSensor,
    useSensor,
    useSensors,
    useDroppable,
    useDraggable,
} from '@dnd-kit/core';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import interactionPlugin from '@fullcalendar/interaction';
import type { EventClickArg } from '@fullcalendar/core';
import {
    CalendarDays,
    Users,
    Truck,
    Check,
    X,
    Plus,
    MapPin,
    Route,
    UserRound,
    Building2,
    CalendarPlus,
    Loader2,
    Search,
    RotateCcw,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { SageTabs } from '@/components/common/SageTabs';
import SearchableSelect from '@/components/common/SearchableSelect';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    useItineraries,
    useAssignDays,
    useDeleteItineraryPlanning,
    usePlanningDaily,
    usePlanningUsers,
    usePlanningSummary,
    useUpdatePlanningDay,
    useUpsertForDate,
    useDeletePlanningDaily,
} from '@/hooks/routing/useRouting';
import type {
    ItineraryPlanningDaily,
    PlanningSummaryItinerary,
    PlanningDailyStrategyMode,
} from '@/types/routing.types';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

type DayCode = 1 | 2 | 3 | 4 | 5 | 6 | 7;

const DAYS: { code: DayCode; label: string; short: string }[] = [
    { code: 1, label: 'Lundi', short: 'Lun' },
    { code: 2, label: 'Mardi', short: 'Mar' },
    { code: 3, label: 'Mercredi', short: 'Mer' },
    { code: 4, label: 'Jeudi', short: 'Jeu' },
    { code: 5, label: 'Vendredi', short: 'Ven' },
    { code: 6, label: 'Samedi', short: 'Sam' },
    { code: 7, label: 'Dimanche', short: 'Dim' },
];

const ROLE_LABELS: Record<string, string> = {
    salesRep: 'Vendeur',
    livreur: 'Livreur',
};

// ─── Assign tournée dialog ────────────────────────────────────────────────────
// Full itinerary catalogue + multi-day picker. Days already planned for the
// chosen tournée are pre-checked; saving applies the diff (assign + delete).

function AssignTourneeDialog({
    open,
    onClose,
    userId,
    userName,
    plannedDaysByItinerary,
    planningIdLookup,
}: {
    open: boolean;
    onClose: () => void;
    userId: number;
    userName: string;
    /** itinerary_id → set of day codes already planned */
    plannedDaysByItinerary: Map<number, Set<number>>;
    /** `${itinerary_id}:${day_code}` → planning_id (for removals) */
    planningIdLookup: Map<string, number>;
}) {
    const [itineraryId, setItineraryId] = useState<number | null>(null);
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);

    const { data: itinerariesData, isLoading: itinerariesLoading } = useItineraries({ per_page: 200 });
    const assignDays = useAssignDays();
    const deletePlanning = useDeleteItineraryPlanning();

    const itineraryOptions = (itinerariesData?.itineraries.data ?? []).map((it) => ({
        value: it.id,
        label: `${it.name} (${it.code})`,
    }));

    // Pre-check days already planned when the tournée changes
    useEffect(() => {
        if (itineraryId) {
            setSelectedDays(new Set(plannedDaysByItinerary.get(itineraryId) ?? []));
        } else {
            setSelectedDays(new Set());
        }
    }, [itineraryId, plannedDaysByItinerary]);

    // Reset on close
    useEffect(() => {
        if (!open) {
            setItineraryId(null);
            setSelectedDays(new Set());
        }
    }, [open]);

    const currentDays = itineraryId ? plannedDaysByItinerary.get(itineraryId) ?? new Set<number>() : new Set<number>();
    const addedDays = [...selectedDays].filter((d) => !currentDays.has(d));
    const removedDays = [...currentDays].filter((d) => !selectedDays.has(d));
    const hasChanges = addedDays.length > 0 || removedDays.length > 0;

    const toggleDay = (code: number) => {
        setSelectedDays((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code);
            else next.add(code);
            return next;
        });
    };

    const handleSave = async () => {
        if (!itineraryId || !hasChanges) return;
        setSaving(true);
        try {
            if (addedDays.length > 0) {
                await assignDays.mutateAsync({
                    user_id: userId,
                    itinerary_id: itineraryId,
                    day_codes: addedDays,
                });
            }
            for (const day of removedDays) {
                const planningId = planningIdLookup.get(`${itineraryId}:${day}`);
                if (planningId) await deletePlanning.mutateAsync(planningId);
            }
            toast.success(
                addedDays.length > 0 && removedDays.length > 0
                    ? 'Affectation mise à jour.'
                    : addedDays.length > 0
                    ? `Tournée affectée sur ${addedDays.length} jour(s).`
                    : `Tournée retirée de ${removedDays.length} jour(s).`
            );
            onClose();
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
            <DialogContent className="max-w-md">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <CalendarPlus className="w-4 h-4 text-sage-600" />
                        Affecter une tournée
                    </DialogTitle>
                    <DialogDescription>
                        Choisissez une tournée et les jours de passage hebdomadaires.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600 bg-gray-50 rounded-lg px-3 py-2">
                        <UserRound className="w-4 h-4 text-gray-400" />
                        <span className="font-medium text-gray-800">{userName}</span>
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Tournée</p>
                        {itinerariesLoading ? (
                            <div className="h-9 rounded-md bg-gray-100 animate-pulse" />
                        ) : (
                            <SearchableSelect
                                options={itineraryOptions}
                                value={itineraryId ?? undefined}
                                onChange={(v) => setItineraryId(v ? Number(v) : null)}
                                placeholder="— Choisir une tournée —"
                                clearable
                            />
                        )}
                    </div>

                    <div>
                        <p className="text-xs font-medium text-gray-600 mb-1.5">Jours de passage</p>
                        <div className="flex gap-1.5 flex-wrap">
                            {DAYS.map((d) => {
                                const isOn = selectedDays.has(d.code);
                                const wasPlanned = currentDays.has(d.code);
                                return (
                                    <button
                                        key={d.code}
                                        type="button"
                                        disabled={!itineraryId}
                                        onClick={() => toggleDay(d.code)}
                                        className={`flex flex-col items-center gap-0.5 w-12 py-2 rounded-lg border text-xs font-medium transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
                                            isOn
                                                ? 'bg-sage-600 text-white border-sage-600 shadow-sm'
                                                : wasPlanned
                                                ? 'bg-red-50 text-red-500 border-red-200 line-through'
                                                : 'bg-white text-gray-600 border-gray-200 hover:border-sage-400'
                                        }`}
                                    >
                                        {d.short}
                                        {isOn && <Check className="w-3 h-3" />}
                                    </button>
                                );
                            })}
                        </div>
                        {itineraryId && (
                            <p className="text-[11px] text-gray-400 mt-2">
                                {addedDays.length > 0 && (
                                    <span className="text-sage-600 font-medium">+{addedDays.length} jour(s) </span>
                                )}
                                {removedDays.length > 0 && (
                                    <span className="text-red-500 font-medium">−{removedDays.length} jour(s) </span>
                                )}
                                {!hasChanges && 'Cochez ou décochez des jours pour modifier l\'affectation.'}
                            </p>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>
                        Annuler
                    </Button>
                    <Button onClick={handleSave} disabled={!itineraryId || !hasChanges || saving}>
                        {saving && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                        Enregistrer
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Draggable tournée card ───────────────────────────────────────────────────

function TourneeCard({
    itin,
    isDragging = false,
}: {
    itin: PlanningSummaryItinerary;
    isDragging?: boolean;
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: String(itin.planning_id),
        data: itin,
    });

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined;

    return (
        <div
            ref={setNodeRef}
            style={style}
            {...attributes}
            {...listeners}
            className={`group relative cursor-grab active:cursor-grabbing select-none rounded-md border p-2 text-[11px] transition-shadow ${
                isDragging
                    ? 'opacity-40'
                    : 'bg-white border-sage-200 hover:border-sage-400 hover:shadow-sm'
            }`}
        >
            <p className="font-semibold text-gray-800 truncate leading-tight">{itin.name}</p>
            <p className="text-gray-400 font-mono truncate mt-0.5">{itin.code}</p>
            <div className="flex items-center gap-2 mt-1.5 text-gray-500">
                <span className="flex items-center gap-0.5">
                    <Users className="w-3 h-3" />
                    {itin.partners_count}
                </span>
                {itin.estimated_km > 0 && (
                    <span className="flex items-center gap-0.5">
                        <Route className="w-3 h-3" />
                        {itin.estimated_km.toFixed(1)} km
                    </span>
                )}
            </div>
        </div>
    );
}

// ─── Droppable day column ─────────────────────────────────────────────────────

function DayColumn({
    dayCode,
    label,
    short,
    itineraries,
    totalPartners,
    totalKm,
    isLoading,
    activeId,
    onRemove,
}: {
    dayCode: number;
    label: string;
    short: string;
    itineraries: PlanningSummaryItinerary[];
    totalPartners: number;
    totalKm: number;
    isLoading: boolean;
    activeId: string | null;
    onRemove: (planningId: number) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: String(dayCode) });
    const isEmpty = itineraries.length === 0;

    return (
        <div
            ref={setNodeRef}
            className={`flex flex-col rounded-xl border transition-colors min-h-[160px] ${
                isOver
                    ? 'border-sage-400 bg-sage-50/60 shadow-inner'
                    : isEmpty
                    ? 'border-dashed border-gray-200 bg-gray-50/30'
                    : 'border-gray-200 bg-white'
            }`}
        >
            {/* Day header */}
            <div className="px-2.5 py-2 border-b border-gray-100">
                <p className="text-xs font-bold text-gray-700">{short}</p>
                <p className="text-[10px] text-gray-400 hidden lg:block">{label}</p>
                {!isEmpty && (
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                        <span>{totalPartners} cl.</span>
                        {totalKm > 0 && <span>{totalKm.toFixed(0)} km</span>}
                    </div>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-1.5 space-y-1.5">
                {isLoading ? (
                    <div className="h-12 rounded bg-gray-100 animate-pulse" />
                ) : isEmpty ? (
                    <div className="flex items-center justify-center h-full">
                        <p className="text-[10px] text-gray-300">Repos</p>
                    </div>
                ) : (
                    itineraries.map((itin) => (
                        <div key={itin.planning_id} className="relative group/card">
                            <TourneeCard itin={itin} isDragging={activeId === String(itin.planning_id)} />
                            <button
                                onClick={() => onRemove(itin.planning_id)}
                                className="absolute top-1 right-1 opacity-0 group-hover/card:opacity-100 text-red-300 hover:text-red-500 transition-opacity z-10"
                                title="Retirer"
                            >
                                <X className="w-3 h-3" />
                            </button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Weekly Grid Tab ──────────────────────────────────────────────────────────

function WeeklyPlanningTab({
    userId,
    userName,
    onOpenAssign,
}: {
    userId: number | null;
    userName: string;
    onOpenAssign: () => void;
}) {
    const [activeId, setActiveId] = useState<string | null>(null);
    const { data: summary, isLoading } = usePlanningSummary(userId);
    const deletePlanning = useDeleteItineraryPlanning();
    const updatePlanningDay = useUpdatePlanningDay();

    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const totalPlanned = (summary?.week ?? []).reduce((s, d) => s + d.itineraries.length, 0);

    const handleRemove = async (planningId: number) => {
        try {
            await deletePlanning.mutateAsync(planningId);
            toast.success('Affectation supprimée.');
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleDragStart = (event: DragStartEvent) => {
        setActiveId(String(event.active.id));
    };

    const handleDragEnd = async (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const planningId = Number(active.id);
        const newDayCode = Number(over.id);
        const itin = active.data.current as PlanningSummaryItinerary | undefined;
        const currentDay = summary?.week.find((d) =>
            d.itineraries.some((i) => i.planning_id === planningId)
        );
        if (!currentDay || currentDay.day_code === newDayCode) return;

        try {
            await updatePlanningDay.mutateAsync({ id: planningId, day_code: newDayCode });
            const targetDay = DAYS.find((d) => d.code === newDayCode);
            toast.success(`"${itin?.name}" déplacé au ${targetDay?.label ?? `jour ${newDayCode}`}.`);
        } catch (err) {
            if (isAxiosError(err) && err.response?.status === 422) {
                toast.error(err.response.data?.message ?? 'Conflit : ce vendeur a déjà une tournée ce jour-là.');
            } else {
                toast.error(getErrorMessage(err));
            }
        }
    };

    const activeSummaryItem: PlanningSummaryItinerary | undefined = activeId
        ? summary?.week.flatMap((d) => d.itineraries).find((i) => String(i.planning_id) === activeId)
        : undefined;

    if (!userId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <Users className="w-12 h-12 mb-3" />
                <p className="text-sm">Sélectionnez un agent terrain pour voir son planning hebdomadaire</p>
            </div>
        );
    }

    // Empty week → strong CTA
    if (!isLoading && totalPlanned === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-72 text-center">
                <div className="w-14 h-14 rounded-2xl bg-sage-50 border border-sage-100 flex items-center justify-center mb-4">
                    <CalendarPlus className="w-7 h-7 text-sage-500" />
                </div>
                <p className="text-sm font-semibold text-gray-700">Aucune tournée planifiée</p>
                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                    {userName} n'a pas encore de planning hebdomadaire. Affectez-lui une première tournée.
                </p>
                <Button onClick={onOpenAssign} className="mt-4 gap-1.5">
                    <Plus className="w-4 h-4" />
                    Affecter une tournée
                </Button>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* KPI strip */}
            {summary && !isLoading && (
                <div className="grid grid-cols-3 gap-3">
                    {[
                        {
                            label: 'Tournées planifiées',
                            value: totalPlanned,
                            icon: <Truck className="w-4 h-4 text-sage-600" />,
                        },
                        {
                            label: 'Clients / semaine',
                            value: summary.week.reduce((s, d) => s + d.total_partners, 0),
                            icon: <Users className="w-4 h-4 text-indigo-500" />,
                        },
                        {
                            label: 'Km / semaine',
                            value:
                                summary.week.reduce((s, d) => s + d.total_km, 0).toFixed(0) + ' km',
                            icon: <MapPin className="w-4 h-4 text-amber-500" />,
                        },
                    ].map((kpi) => (
                        <div key={kpi.label} className="flex items-center gap-3 bg-white rounded-lg border border-gray-200 px-4 py-3">
                            {kpi.icon}
                            <div>
                                <p className="text-lg font-bold text-gray-900 leading-none">{kpi.value}</p>
                                <p className="text-[11px] text-gray-400 mt-0.5">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Weekly grid with drag-and-drop */}
            <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
                <div className="grid grid-cols-7 gap-2">
                    {DAYS.map((d) => {
                        const dayData = summary?.week.find((w) => w.day_code === d.code);
                        return (
                            <DayColumn
                                key={d.code}
                                dayCode={d.code}
                                label={d.label}
                                short={d.short}
                                itineraries={dayData?.itineraries ?? []}
                                totalPartners={dayData?.total_partners ?? 0}
                                totalKm={dayData?.total_km ?? 0}
                                isLoading={isLoading}
                                activeId={activeId}
                                onRemove={handleRemove}
                            />
                        );
                    })}
                </div>

                <DragOverlay>
                    {activeSummaryItem ? (
                        <div className="rounded-md border border-sage-400 bg-white shadow-xl p-2 text-[11px] w-40 opacity-95">
                            <p className="font-semibold text-gray-800 truncate">{activeSummaryItem.name}</p>
                            <p className="text-gray-400 font-mono truncate mt-0.5">{activeSummaryItem.code}</p>
                            <div className="flex items-center gap-2 mt-1.5 text-gray-500">
                                <span className="flex items-center gap-0.5">
                                    <Users className="w-3 h-3" />
                                    {activeSummaryItem.partners_count}
                                </span>
                                {activeSummaryItem.estimated_km > 0 && (
                                    <span className="flex items-center gap-0.5">
                                        <Route className="w-3 h-3" />
                                        {activeSummaryItem.estimated_km.toFixed(1)} km
                                    </span>
                                )}
                            </div>
                        </div>
                    ) : null}
                </DragOverlay>
            </DndContext>

            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <Route className="w-3.5 h-3.5" />
                Glissez-déposez une carte pour déplacer la tournée vers un autre jour.
            </p>
        </div>
    );
}

// ─── Daily Overrides Tab ──────────────────────────────────────────────────────

function DailyOverridesTab({ userId }: { userId: number | null }) {
    const [overrideDialog, setOverrideDialog] = useState<{ date: string } | null>(null);
    const [strategyMode, setStrategyMode] = useState<PlanningDailyStrategyMode>('REPLACE');
    const [overrideItineraryId, setOverrideItineraryId] = useState<number | null>(null);

    const { data: dailyData } = usePlanningDaily(userId ? { user_id: userId } : {});
    const { data: itinerariesData } = useItineraries({ per_page: 200 });
    const upsertForDate = useUpsertForDate();
    const deleteDailyEntry = useDeletePlanningDaily();

    const dailyEntries: ItineraryPlanningDaily[] = dailyData?.data ?? [];

    const itineraryOptions = (itinerariesData?.itineraries.data ?? []).map((it) => ({
        value: it.id,
        label: `${it.name} (${it.code})`,
    }));

    const calendarEvents = dailyEntries.map((e) => ({
        id: String(e.id),
        title: e.itinerary?.name ?? `Tournée #${e.itinerary_id}`,
        date: e.work_date,
        backgroundColor: e.strategy_mode === 'REPLACE' ? '#4f46e5' : '#0ea5e9',
        borderColor: e.strategy_mode === 'REPLACE' ? '#4338ca' : '#0284c7',
        extendedProps: { entry: e },
    }));

    const handleDateClick = useCallback(
        (info: { dateStr: string }) => {
            if (!userId) {
                toast.error('Sélectionnez un agent terrain.');
                return;
            }
            setOverrideDialog({ date: info.dateStr });
        },
        [userId]
    );

    const handleAddOverride = async () => {
        if (!overrideDialog || !userId || !overrideItineraryId) return;
        try {
            await upsertForDate.mutateAsync({
                user_id: userId,
                work_date: overrideDialog.date,
                entries: [{ itinerary_id: overrideItineraryId, is_active: true, strategy_mode: strategyMode }],
            });
            toast.success('Override journalier enregistré.');
            setOverrideDialog(null);
            setOverrideItineraryId(null);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleEventClick = useCallback(
        async (info: EventClickArg) => {
            const entry = info.event.extendedProps.entry as ItineraryPlanningDaily;
            if (!confirm(`Supprimer l'override du ${entry.work_date} ?`)) return;
            try {
                await deleteDailyEntry.mutateAsync(entry.id);
                toast.success('Override supprimé.');
            } catch (err) {
                toast.error(getErrorMessage(err));
            }
        },
        [deleteDailyEntry]
    );

    if (!userId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <CalendarDays className="w-12 h-12 mb-3" />
                <p className="text-sm">Sélectionnez un agent terrain pour gérer ses overrides journaliers</p>
            </div>
        );
    }

    return (
        <div>
            <div className="flex items-center gap-2 mb-4 text-xs text-gray-500">
                <span className="flex items-center gap-1">
                    <span className="w-3 h-3 rounded-sm bg-indigo-600 inline-block" /> REPLACE — remplace le planning hebdo
                </span>
                <span className="flex items-center gap-1 ml-4">
                    <span className="w-3 h-3 rounded-sm bg-sky-500 inline-block" /> APPEND — s'ajoute au planning hebdo
                </span>
                <span className="ml-auto text-gray-400">
                    Cliquez sur une date pour ajouter un override
                </span>
            </div>

            <FullCalendar
                plugins={[dayGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                locale="fr"
                height={520}
                events={calendarEvents}
                dateClick={handleDateClick}
                eventClick={handleEventClick}
                headerToolbar={{
                    left: 'prev,next today',
                    center: 'title',
                    right: 'dayGridMonth',
                }}
            />

            <Dialog open={!!overrideDialog} onOpenChange={(open) => !open && setOverrideDialog(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <Plus className="w-4 h-4" />
                            Override du {overrideDialog?.date}
                        </DialogTitle>
                        <DialogDescription>
                            Affectation exceptionnelle qui remplace ou complète le planning hebdomadaire.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div>
                            <p className="text-xs font-medium text-gray-600 mb-1.5">Tournée</p>
                            <SearchableSelect
                                options={itineraryOptions}
                                value={overrideItineraryId ?? undefined}
                                onChange={(v) => setOverrideItineraryId(v ? Number(v) : null)}
                                placeholder="— Choisir une tournée —"
                                clearable
                            />
                        </div>
                        <p className="text-sm text-gray-600">Mode d'override :</p>
                        <div className="grid grid-cols-2 gap-2">
                            {(['REPLACE', 'APPEND'] as PlanningDailyStrategyMode[]).map((mode) => (
                                <button
                                    key={mode}
                                    onClick={() => setStrategyMode(mode)}
                                    className={`p-3 rounded-lg border text-sm font-medium transition-all text-left ${
                                        strategyMode === mode
                                            ? 'border-indigo-500 bg-indigo-50 text-indigo-700'
                                            : 'border-gray-200 text-gray-600 hover:border-gray-300'
                                    }`}
                                >
                                    <p className="font-semibold">{mode}</p>
                                    <p className="text-xs mt-0.5 font-normal opacity-80">
                                        {mode === 'REPLACE'
                                            ? 'Remplace le planning habituel'
                                            : "S'ajoute aux tournées habituelles"}
                                    </p>
                                </button>
                            ))}
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOverrideDialog(null)}>
                            Annuler
                        </Button>
                        <Button
                            onClick={handleAddOverride}
                            disabled={upsertForDate.isPending || !overrideItineraryId}
                        >
                            Créer l'override
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}

// ─── Agent roster (left pane) ─────────────────────────────────────────────────

function AgentRoster({
    selectedUserId,
    onSelect,
}: {
    selectedUserId: number | null;
    onSelect: (id: number) => void;
}) {
    const [search, setSearch] = useState('');
    const { data: planningUsersData, isLoading } = usePlanningUsers();
    const planningUsers = planningUsersData?.users ?? [];

    const filtered = planningUsers.filter(
        (u) =>
            !search ||
            u.name.toLowerCase().includes(search.toLowerCase()) ||
            (u.branch_code ?? '').toLowerCase().includes(search.toLowerCase())
    );

    // Group by branch — backend already sorts branch → name
    const grouped = useMemo(() => {
        const map = new Map<string, typeof filtered>();
        for (const u of filtered) {
            const key = u.branch_code ?? 'Sans agence';
            const arr = map.get(key) ?? [];
            arr.push(u);
            map.set(key, arr);
        }
        return map;
    }, [filtered]);

    return (
        <div className="h-full bg-white border-r border-gray-100 flex flex-col">
            <div className="p-4 border-b border-gray-100 shrink-0">
                <div className="flex items-center gap-2 mb-3">
                    <CalendarDays className="h-5 w-5 text-sage-600" />
                    <h1 className="text-sm font-semibold text-gray-900">Planning des Tournées</h1>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input
                        placeholder="Rechercher un agent..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs pl-8"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="space-y-2 p-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                        ))}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <Users className="w-8 h-8 mb-2" />
                        <p className="text-xs">Aucun agent terrain trouvé</p>
                    </div>
                ) : (
                    [...grouped.entries()].map(([branch, users]) => (
                        <div key={branch} className="mb-3">
                            <p className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                                <Building2 className="w-3 h-3" />
                                {branch}
                            </p>
                            <div className="space-y-1">
                                {users.map((u) => {
                                    const isSelected = u.id === selectedUserId;
                                    return (
                                        <button
                                            key={u.id}
                                            onClick={() => onSelect(u.id)}
                                            className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-all ${
                                                isSelected
                                                    ? 'border-sage-400 bg-sage-50 shadow-sm'
                                                    : 'border-transparent hover:border-gray-200 hover:bg-gray-50'
                                            }`}
                                        >
                                            <div
                                                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                                                    u.b2b_role === 'livreur'
                                                        ? 'bg-amber-100 text-amber-700'
                                                        : 'bg-sage-100 text-sage-700'
                                                }`}
                                            >
                                                {u.name
                                                    .split(' ')
                                                    .map((p) => p[0])
                                                    .slice(0, 2)
                                                    .join('')
                                                    .toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={`text-sm truncate ${isSelected ? 'font-semibold text-sage-800' : 'font-medium text-gray-700'}`}>
                                                    {u.name}
                                                </p>
                                                <p className="text-[11px] text-gray-400 truncate">
                                                    {ROLE_LABELS[u.b2b_role] ?? u.b2b_role}
                                                    {u.geo_area_code && ` · ${u.geo_area_code}`}
                                                </p>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export function PlanningPage() {
    const [activeTab, setActiveTab] = useState('weekly');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    const { data: planningUsersData, refetch: refetchUsers } = usePlanningUsers();
    const planningUsers = planningUsersData?.users ?? [];

    const { data: summary, refetch: refetchSummary } = usePlanningSummary(selectedUserId);

    // Lookup maps consumed by the assign dialog (pre-check + diff removal)
    const { plannedDaysByItinerary, planningIdLookup } = useMemo(() => {
        const byItinerary = new Map<number, Set<number>>();
        const idLookup = new Map<string, number>();
        for (const day of summary?.week ?? []) {
            for (const itin of day.itineraries) {
                const set = byItinerary.get(itin.id) ?? new Set<number>();
                set.add(day.day_code);
                byItinerary.set(itin.id, set);
                idLookup.set(`${itin.id}:${day.day_code}`, itin.planning_id);
            }
        }
        return { plannedDaysByItinerary: byItinerary, planningIdLookup: idLookup };
    }, [summary]);

    const selectedUser = planningUsers.find((u) => u.id === selectedUserId);

    const actionGroups = [
        {
            items: [
                ...(selectedUserId
                    ? [{
                        icon: Plus,
                        label: 'Affecter une tournée',
                        variant: 'primary' as const,
                        onClick: () => setAssignDialogOpen(true),
                    }]
                    : []),
                {
                    icon: RotateCcw,
                    label: 'Rafraîchir',
                    variant: 'default' as const,
                    onClick: () => {
                        refetchUsers();
                        if (selectedUserId) refetchSummary();
                    },
                },
            ],
        },
    ];

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Selected agent header */}
            <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-3">
                {selectedUser ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-sage-500 to-sage-700 flex items-center justify-center text-white font-bold text-sm">
                                {selectedUser.name
                                    .split(' ')
                                    .map((p) => p[0])
                                    .slice(0, 2)
                                    .join('')
                                    .toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900">{selectedUser.name}</h2>
                                <p className="text-[11px] text-gray-400">{selectedUser.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1">
                                <UserRound className="w-3 h-3" />
                                {ROLE_LABELS[selectedUser.b2b_role] ?? selectedUser.b2b_role}
                            </Badge>
                            {selectedUser.branch_code && (
                                <Badge variant="outline" className="gap-1">
                                    <Building2 className="w-3 h-3" />
                                    {selectedUser.branch_code}
                                </Badge>
                            )}
                            {selectedUser.geo_area_code && (
                                <Badge variant="outline" className="gap-1">
                                    <MapPin className="w-3 h-3" />
                                    {selectedUser.geo_area_code}
                                </Badge>
                            )}
                            <Button size="sm" onClick={() => setAssignDialogOpen(true)} className="gap-1.5 ml-2">
                                <Plus className="w-4 h-4" />
                                Affecter une tournée
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 py-1">
                        <CalendarDays className="w-4 h-4 text-gray-400" />
                        <p className="text-sm text-gray-400">Sélectionnez un agent terrain dans la liste</p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-6">
                <SageTabs
                    tabs={[
                        { id: 'weekly', label: 'Planning hebdomadaire' },
                        { id: 'daily', label: 'Overrides journaliers' },
                    ]}
                    activeTabId={activeTab}
                    onTabChange={setActiveTab}
                />
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 bg-gray-50/40">
                {activeTab === 'weekly' && (
                    <WeeklyPlanningTab
                        userId={selectedUserId}
                        userName={selectedUser?.name ?? ''}
                        onOpenAssign={() => setAssignDialogOpen(true)}
                    />
                )}
                {activeTab === 'daily' && <DailyOverridesTab userId={selectedUserId} />}
            </div>

            {/* Assign dialog */}
            {selectedUserId && selectedUser && (
                <AssignTourneeDialog
                    open={assignDialogOpen}
                    onClose={() => setAssignDialogOpen(false)}
                    userId={selectedUserId}
                    userName={selectedUser.name}
                    plannedDaysByItinerary={plannedDaysByItinerary}
                    planningIdLookup={planningIdLookup}
                />
            )}
        </div>
    );

    return (
        <MasterLayout
            leftContent={<AgentRoster selectedUserId={selectedUserId} onSelect={setSelectedUserId} />}
            mainContent={mainContent}
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
