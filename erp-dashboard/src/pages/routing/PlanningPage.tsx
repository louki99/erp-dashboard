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
    AlertTriangle,
    GripVertical,
    ArrowRight,
    Trash2,
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

const DAYS: { code: DayCode; label: string; short: string; isWeekend: boolean }[] = [
    { code: 1, label: 'Lundi',    short: 'Lun', isWeekend: false },
    { code: 2, label: 'Mardi',    short: 'Mar', isWeekend: false },
    { code: 3, label: 'Mercredi', short: 'Mer', isWeekend: false },
    { code: 4, label: 'Jeudi',    short: 'Jeu', isWeekend: false },
    { code: 5, label: 'Vendredi', short: 'Ven', isWeekend: false },
    { code: 6, label: 'Samedi',   short: 'Sam', isWeekend: true  },
    { code: 7, label: 'Dimanche', short: 'Dim', isWeekend: true  },
];

const ROLE_LABELS: Record<string, string> = {
    salesRep: 'Vendeur',
    livreur: 'Livreur',
};

// ─── Itinerary accent color (by code prefix) ─────────────────────────────────

function getItinAccent(code: string): { bg: string; border: string; dot: string } {
    if (code.includes('PRO')) return { bg: 'bg-amber-50',   border: 'border-l-amber-400',  dot: 'bg-amber-400'  };
    if (code.includes('STD')) return { bg: 'bg-blue-50',    border: 'border-l-blue-400',   dot: 'bg-blue-400'   };
    if (code.includes('LIV')) return { bg: 'bg-emerald-50', border: 'border-l-emerald-400',dot: 'bg-emerald-400'};
    return                            { bg: 'bg-gray-50',   border: 'border-l-gray-300',   dot: 'bg-gray-400'   };
}

// ─── Reusable confirm dialog ──────────────────────────────────────────────────

function ConfirmDialog({
    open,
    title,
    description,
    confirmLabel = 'Confirmer',
    variant = 'danger',
    loading = false,
    onConfirm,
    onCancel,
}: {
    open: boolean;
    title: string;
    description: string;
    confirmLabel?: string;
    variant?: 'danger' | 'default';
    loading?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}) {
    return (
        <Dialog open={open} onOpenChange={(o) => !o && onCancel()}>
            <DialogContent className="max-w-sm">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        {variant === 'danger' && (
                            <span className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                                <AlertTriangle className="w-4 h-4 text-red-500" />
                            </span>
                        )}
                        {title}
                    </DialogTitle>
                    <DialogDescription>{description}</DialogDescription>
                </DialogHeader>
                <DialogFooter className="mt-2">
                    <Button variant="outline" onClick={onCancel} disabled={loading}>
                        Annuler
                    </Button>
                    <Button
                        onClick={onConfirm}
                        disabled={loading}
                        className={variant === 'danger' ? 'bg-red-600 hover:bg-red-700 text-white' : ''}
                    >
                        {loading && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                        {confirmLabel}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ─── Assign tournée dialog ────────────────────────────────────────────────────

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
    plannedDaysByItinerary: Map<number, Set<number>>;
    planningIdLookup: Map<string, number>;
}) {
    const [itineraryId, setItineraryId] = useState<number | null>(null);
    const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());
    const [saving, setSaving] = useState(false);

    const { data: itinerariesData, isLoading: itinerariesLoading } = useItineraries({ per_page: 200 });
    const assignDays   = useAssignDays();
    const deletePlanning = useDeleteItineraryPlanning();

    const itineraryOptions = (itinerariesData?.itineraries.data ?? []).map((it) => ({
        value: it.id,
        label: `${it.name} (${it.code})`,
    }));

    useEffect(() => {
        if (itineraryId) setSelectedDays(new Set(plannedDaysByItinerary.get(itineraryId) ?? []));
        else             setSelectedDays(new Set());
    }, [itineraryId, plannedDaysByItinerary]);

    useEffect(() => {
        if (!open) { setItineraryId(null); setSelectedDays(new Set()); }
    }, [open]);

    const currentDays  = itineraryId ? plannedDaysByItinerary.get(itineraryId) ?? new Set<number>() : new Set<number>();
    const addedDays    = [...selectedDays].filter((d) => !currentDays.has(d));
    const removedDays  = [...currentDays].filter((d) => !selectedDays.has(d));
    const hasChanges   = addedDays.length > 0 || removedDays.length > 0;

    const toggleDay = (code: number) => {
        setSelectedDays((prev) => {
            const next = new Set(prev);
            if (next.has(code)) next.delete(code); else next.add(code);
            return next;
        });
    };

    const handleSave = async () => {
        if (!itineraryId || !hasChanges) return;
        setSaving(true);
        try {
            if (addedDays.length > 0) {
                await assignDays.mutateAsync({ user_id: userId, itinerary_id: itineraryId, day_codes: addedDays });
            }
            for (const day of removedDays) {
                const planningId = planningIdLookup.get(`${itineraryId}:${day}`);
                if (planningId) await deletePlanning.mutateAsync(planningId);
            }
            toast.success(
                addedDays.length > 0 && removedDays.length > 0 ? 'Affectation mise à jour.'
                : addedDays.length > 0 ? `Tournée affectée sur ${addedDays.length} jour(s).`
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
                        <span className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center">
                            <CalendarPlus className="w-4 h-4 text-sage-600" />
                        </span>
                        Affecter une tournée
                    </DialogTitle>
                    <DialogDescription>
                        Choisissez une tournée et les jours de passage hebdomadaires.
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-2">
                    <div className="flex items-center gap-2.5 text-sm bg-gray-50 border border-gray-100 rounded-lg px-3 py-2.5">
                        <div className="w-7 h-7 rounded-full bg-sage-100 flex items-center justify-center text-xs font-bold text-sage-700 shrink-0">
                            {userName.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                        </div>
                        <span className="font-medium text-gray-800">{userName}</span>
                    </div>

                    <div>
                        <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Tournée</p>
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
                        <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Jours de passage</p>
                        <div className="grid grid-cols-7 gap-1">
                            {DAYS.map((d) => {
                                const isOn       = selectedDays.has(d.code);
                                const wasPlanned = currentDays.has(d.code);
                                const isRemoved  = wasPlanned && !isOn;
                                return (
                                    <button
                                        key={d.code}
                                        type="button"
                                        disabled={!itineraryId}
                                        onClick={() => toggleDay(d.code)}
                                        className={[
                                            'flex flex-col items-center gap-1 py-2.5 rounded-xl border text-[11px] font-semibold transition-all',
                                            'disabled:opacity-35 disabled:cursor-not-allowed',
                                            isOn      ? 'bg-sage-600 text-white border-sage-600 shadow-md shadow-sage-200'
                                            : isRemoved ? 'bg-red-50 text-red-400 border-red-200'
                                            : d.isWeekend ? 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                                            : 'bg-white text-gray-600 border-gray-200 hover:border-sage-400 hover:bg-sage-50/40',
                                        ].join(' ')}
                                    >
                                        {d.short}
                                        <span className={[
                                            'w-1.5 h-1.5 rounded-full transition-all',
                                            isOn       ? 'bg-white/70'
                                            : isRemoved ? 'bg-red-300'
                                            : 'bg-transparent',
                                        ].join(' ')} />
                                    </button>
                                );
                            })}
                        </div>

                        {itineraryId && (
                            <div className="flex items-center gap-3 mt-3 text-[11px]">
                                {addedDays.length > 0 && (
                                    <span className="flex items-center gap-1 text-sage-600 font-semibold">
                                        <Check className="w-3 h-3" />+{addedDays.length} jour(s)
                                    </span>
                                )}
                                {removedDays.length > 0 && (
                                    <span className="flex items-center gap-1 text-red-500 font-semibold">
                                        <X className="w-3 h-3" />−{removedDays.length} jour(s)
                                    </span>
                                )}
                                {!hasChanges && (
                                    <span className="text-gray-400">Cochez ou décochez des jours pour modifier l'affectation.</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="outline" onClick={onClose} disabled={saving}>Annuler</Button>
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
    onRemove,
}: {
    itin: PlanningSummaryItinerary;
    isDragging?: boolean;
    onRemove?: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform } = useDraggable({
        id: String(itin.planning_id),
        data: itin,
    });

    const style = transform
        ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
        : undefined;

    const accent = getItinAccent(itin.code);

    return (
        <div
            ref={setNodeRef}
            style={style}
            className={[
                'group/card relative rounded-lg border border-l-[3px] text-[11px] transition-all select-none',
                accent.bg, accent.border,
                isDragging ? 'opacity-30 shadow-none' : 'shadow-sm hover:shadow-md hover:border-opacity-80',
            ].join(' ')}
        >
            {/* Drag handle + content */}
            <div className="flex items-stretch">
                <div
                    {...attributes}
                    {...listeners}
                    className="flex items-center px-1.5 text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing shrink-0 touch-none"
                >
                    <GripVertical className="w-3 h-3" />
                </div>
                <div className="flex-1 py-2 pr-2 min-w-0">
                    <p className="font-semibold text-gray-800 truncate leading-tight">{itin.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{itin.code}</p>
                    <div className="flex items-center gap-2.5 mt-1.5 text-gray-500">
                        <span className="flex items-center gap-0.5">
                            <Users className="w-3 h-3" />{itin.partners_count} cl.
                        </span>
                        {itin.estimated_km > 0 && (
                            <span className="flex items-center gap-0.5">
                                <Route className="w-3 h-3" />{itin.estimated_km.toFixed(1)} km
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Remove button */}
            {onRemove && (
                <button
                    onClick={(e) => { e.stopPropagation(); onRemove(); }}
                    className="absolute top-1.5 right-1.5 opacity-0 group-hover/card:opacity-100 w-5 h-5 flex items-center justify-center rounded bg-red-100 text-red-400 hover:bg-red-200 hover:text-red-600 transition-all z-10"
                    title="Retirer"
                >
                    <Trash2 className="w-2.5 h-2.5" />
                </button>
            )}
        </div>
    );
}

// ─── Drag overlay card (ghost while dragging) ─────────────────────────────────

function DragCard({ itin }: { itin: PlanningSummaryItinerary }) {
    const accent = getItinAccent(itin.code);
    return (
        <div className={[
            'rounded-lg border border-l-[3px] shadow-2xl shadow-gray-300/60 text-[11px] w-44 rotate-2 opacity-95',
            accent.bg, accent.border,
        ].join(' ')}>
            <div className="flex items-stretch">
                <div className="flex items-center px-1.5 text-gray-300 shrink-0">
                    <GripVertical className="w-3 h-3" />
                </div>
                <div className="flex-1 py-2 pr-2 min-w-0">
                    <p className="font-semibold text-gray-800 truncate">{itin.name}</p>
                    <p className="text-[10px] text-gray-400 font-mono truncate mt-0.5">{itin.code}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-gray-500">
                        <span className="flex items-center gap-0.5"><Users className="w-3 h-3" />{itin.partners_count}</span>
                        {itin.estimated_km > 0 && (
                            <span className="flex items-center gap-0.5"><Route className="w-3 h-3" />{itin.estimated_km.toFixed(1)} km</span>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}

// ─── Droppable day column ─────────────────────────────────────────────────────

function DayColumn({
    dayCode,
    label,
    short,
    isWeekend,
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
    isWeekend: boolean;
    itineraries: PlanningSummaryItinerary[];
    totalPartners: number;
    totalKm: number;
    isLoading: boolean;
    activeId: string | null;
    onRemove: (planningId: number, itinName: string) => void;
}) {
    const { setNodeRef, isOver } = useDroppable({ id: String(dayCode) });
    const isEmpty = itineraries.length === 0;

    return (
        <div
            ref={setNodeRef}
            className={[
                'flex flex-col rounded-xl border transition-all duration-150 min-h-[160px]',
                isOver
                    ? 'border-sage-400 bg-sage-50/80 shadow-inner ring-2 ring-sage-200'
                    : isEmpty
                    ? 'border-dashed border-gray-200 bg-gray-50/20'
                    : 'border-gray-200 bg-white shadow-sm',
            ].join(' ')}
        >
            {/* Day header */}
            <div className={[
                'px-2.5 pt-2.5 pb-2 border-b',
                isWeekend ? 'border-amber-100 bg-amber-50/50 rounded-t-xl' : 'border-gray-100',
            ].join(' ')}>
                <div className="flex items-center justify-between">
                    <div>
                        <p className={['text-xs font-bold', isWeekend ? 'text-amber-700' : 'text-gray-700'].join(' ')}>
                            {short}
                        </p>
                        <p className="text-[10px] text-gray-400 hidden lg:block">{label}</p>
                    </div>
                    {!isEmpty && (
                        <span className="text-[10px] font-semibold text-gray-500 bg-gray-100 rounded-full px-1.5 py-0.5">
                            {itineraries.length}
                        </span>
                    )}
                </div>
                {!isEmpty && (
                    <div className="flex items-center gap-2 mt-1.5 text-[10px] text-gray-400">
                        <span className="flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" />{totalPartners} cl.
                        </span>
                        {totalKm > 0 && (
                            <span className="flex items-center gap-0.5">
                                <Route className="w-2.5 h-2.5" />{totalKm.toFixed(0)} km
                            </span>
                        )}
                    </div>
                )}
            </div>

            {/* Cards */}
            <div className="flex-1 p-1.5 space-y-1.5">
                {isLoading ? (
                    <div className="space-y-1.5">
                        <div className="h-14 rounded-lg bg-gray-100 animate-pulse" />
                    </div>
                ) : isEmpty ? (
                    <div className="flex flex-col items-center justify-center h-full py-4 gap-1">
                        {isOver ? (
                            <p className="text-[10px] text-sage-500 font-medium">Déposer ici</p>
                        ) : (
                            <p className="text-[10px] text-gray-300">{isWeekend ? '—' : 'Repos'}</p>
                        )}
                    </div>
                ) : (
                    itineraries.map((itin) => (
                        <TourneeCard
                            key={`${itin.planning_id}-${itin.id}`}
                            itin={itin}
                            isDragging={activeId === String(itin.planning_id)}
                            onRemove={() => onRemove(itin.planning_id, itin.name)}
                        />
                    ))
                )}

                {/* Drop zone indicator when dragging over non-empty column */}
                {isOver && !isEmpty && (
                    <div className="h-10 rounded-lg border-2 border-dashed border-sage-300 bg-sage-50/60 flex items-center justify-center">
                        <p className="text-[10px] text-sage-500 font-medium">Déposer ici</p>
                    </div>
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
    const [activeId, setActiveId]         = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<{ planningId: number; name: string } | null>(null);
    const [pendingMove, setPendingMove]   = useState<{
        planningId: number;
        itinName: string;
        fromDay: string;
        toDay: string;
        newDayCode: number;
    } | null>(null);
    const [opLoading, setOpLoading]       = useState(false);

    const { data: summary, isLoading }    = usePlanningSummary(userId);
    const deletePlanning                  = useDeleteItineraryPlanning();
    const updatePlanningDay               = useUpdatePlanningDay();
    const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

    const totalPlanned = (summary?.week ?? []).reduce((s, d) => s + d.itineraries.length, 0);

    const confirmDelete = async () => {
        if (!deleteTarget) return;
        setOpLoading(true);
        try {
            await deletePlanning.mutateAsync(deleteTarget.planningId);
            toast.success(`"${deleteTarget.name}" retiré du planning.`);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setOpLoading(false);
            setDeleteTarget(null);
        }
    };

    const confirmMove = async () => {
        if (!pendingMove) return;
        setOpLoading(true);
        try {
            await updatePlanningDay.mutateAsync({ id: pendingMove.planningId, day_code: pendingMove.newDayCode });
            toast.success(`"${pendingMove.itinName}" déplacé au ${pendingMove.toDay}.`);
        } catch (err) {
            if (isAxiosError(err) && err.response?.status === 422) {
                toast.error(err.response.data?.message ?? 'Conflit : ce vendeur a déjà une tournée ce jour-là.');
            } else {
                toast.error(getErrorMessage(err));
            }
        } finally {
            setOpLoading(false);
            setPendingMove(null);
        }
    };

    const handleDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

    const handleDragEnd = (event: DragEndEvent) => {
        setActiveId(null);
        const { active, over } = event;
        if (!over) return;
        const planningId   = Number(active.id);
        const newDayCode   = Number(over.id);
        const itin         = active.data.current as PlanningSummaryItinerary | undefined;
        const currentDay   = summary?.week.find((d) => d.itineraries.some((i) => i.planning_id === planningId));
        if (!currentDay || currentDay.day_code === newDayCode) return;

        const fromDay = DAYS.find((d) => d.code === currentDay.day_code)?.label ?? `Jour ${currentDay.day_code}`;
        const toDay   = DAYS.find((d) => d.code === newDayCode)?.label ?? `Jour ${newDayCode}`;
        setPendingMove({ planningId, itinName: itin?.name ?? 'Tournée', fromDay, toDay, newDayCode });
    };

    const activeSummaryItem: PlanningSummaryItinerary | undefined = activeId
        ? summary?.week.flatMap((d) => d.itineraries).find((i) => String(i.planning_id) === activeId)
        : undefined;

    if (!userId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <Users className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">Aucun agent sélectionné</p>
                <p className="text-xs text-gray-400 mt-1">Sélectionnez un agent terrain pour voir son planning</p>
            </div>
        );
    }

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
                    <Plus className="w-4 h-4" />Affecter une tournée
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
                        { label: 'Tournées planifiées', value: totalPlanned, icon: <Truck className="w-4 h-4 text-sage-600" />, bg: 'bg-sage-50', border: 'border-sage-200' },
                        { label: 'Clients / semaine', value: summary.week.reduce((s, d) => s + d.total_partners, 0), icon: <Users className="w-4 h-4 text-indigo-500" />, bg: 'bg-indigo-50', border: 'border-indigo-200' },
                        { label: 'Km / semaine', value: summary.week.reduce((s, d) => s + d.total_km, 0).toFixed(0) + ' km', icon: <MapPin className="w-4 h-4 text-amber-500" />, bg: 'bg-amber-50', border: 'border-amber-200' },
                    ].map((kpi) => (
                        <div key={kpi.label} className={`flex items-center gap-3 rounded-xl border ${kpi.border} ${kpi.bg} px-4 py-3`}>
                            <div className="w-8 h-8 rounded-lg bg-white/70 flex items-center justify-center shadow-sm">
                                {kpi.icon}
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900 leading-none">{kpi.value}</p>
                                <p className="text-[11px] text-gray-500 mt-0.5">{kpi.label}</p>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Weekly grid with DnD */}
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
                                isWeekend={d.isWeekend}
                                itineraries={dayData?.itineraries ?? []}
                                totalPartners={dayData?.total_partners ?? 0}
                                totalKm={dayData?.total_km ?? 0}
                                isLoading={isLoading}
                                activeId={activeId}
                                onRemove={(planningId, name) => setDeleteTarget({ planningId, name })}
                            />
                        );
                    })}
                </div>

                <DragOverlay dropAnimation={{ duration: 150, easing: 'ease' }}>
                    {activeSummaryItem ? <DragCard itin={activeSummaryItem} /> : null}
                </DragOverlay>
            </DndContext>

            <p className="text-[11px] text-gray-400 flex items-center gap-1.5">
                <GripVertical className="w-3.5 h-3.5" />
                Faites glisser une carte pour déplacer la tournée vers un autre jour. Survolez une carte pour la retirer.
            </p>

            {/* Delete confirmation */}
            <ConfirmDialog
                open={!!deleteTarget}
                title="Retirer la tournée"
                description={`Êtes-vous sûr de vouloir retirer "${deleteTarget?.name}" du planning hebdomadaire ?`}
                confirmLabel="Retirer"
                variant="danger"
                loading={opLoading}
                onConfirm={confirmDelete}
                onCancel={() => setDeleteTarget(null)}
            />

            {/* Drag-and-drop confirmation */}
            <ConfirmDialog
                open={!!pendingMove}
                title="Déplacer la tournée"
                description={
                    pendingMove
                        ? `Déplacer "${pendingMove.itinName}" du ${pendingMove.fromDay} au ${pendingMove.toDay} ?`
                        : ''
                }
                confirmLabel="Déplacer"
                variant="default"
                loading={opLoading}
                onConfirm={confirmMove}
                onCancel={() => setPendingMove(null)}
            />
        </div>
    );
}

// ─── Daily Overrides Tab ──────────────────────────────────────────────────────

function DailyOverridesTab({ userId }: { userId: number | null }) {
    const [overrideDialog, setOverrideDialog]         = useState<{ date: string } | null>(null);
    const [strategyMode, setStrategyMode]             = useState<PlanningDailyStrategyMode>('REPLACE');
    const [overrideItineraryId, setOverrideItineraryId] = useState<number | null>(null);
    const [deleteTarget, setDeleteTarget]             = useState<ItineraryPlanningDaily | null>(null);
    const [deleting, setDeleting]                     = useState(false);

    const { data: dailyData }        = usePlanningDaily(userId ? { user_id: userId } : {});
    const { data: itinerariesData }  = useItineraries({ per_page: 200 });
    const upsertForDate              = useUpsertForDate();
    const deleteDailyEntry           = useDeletePlanningDaily();

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
        borderColor:     e.strategy_mode === 'REPLACE' ? '#4338ca' : '#0284c7',
        extendedProps: { entry: e },
    }));

    const handleDateClick = useCallback(
        (info: { dateStr: string }) => {
            if (!userId) { toast.error('Sélectionnez un agent terrain.'); return; }
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
        (info: EventClickArg) => {
            setDeleteTarget(info.event.extendedProps.entry as ItineraryPlanningDaily);
        },
        []
    );

    const confirmDeleteOverride = async () => {
        if (!deleteTarget) return;
        setDeleting(true);
        try {
            await deleteDailyEntry.mutateAsync(deleteTarget.id);
            toast.success('Override supprimé.');
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setDeleting(false);
            setDeleteTarget(null);
        }
    };

    if (!userId) {
        return (
            <div className="flex flex-col items-center justify-center h-64 text-gray-400">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                    <CalendarDays className="w-8 h-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium text-gray-500">Aucun agent sélectionné</p>
                <p className="text-xs text-gray-400 mt-1">Sélectionnez un agent pour gérer ses overrides journaliers</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            {/* Legend */}
            <div className="flex items-center gap-4 p-3 bg-white border border-gray-100 rounded-xl text-xs text-gray-500">
                <span className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded bg-indigo-600" />
                    <span><strong>REPLACE</strong> — remplace le planning hebdo</span>
                </span>
                <span className="flex items-center gap-2 ml-2">
                    <span className="w-3 h-3 rounded bg-sky-500" />
                    <span><strong>APPEND</strong> — s'ajoute au planning hebdo</span>
                </span>
                <span className="ml-auto text-gray-400 italic">Cliquez sur une date pour ajouter un override · Cliquez sur un événement pour le supprimer</span>
            </div>

            <div className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm">
                <FullCalendar
                    plugins={[dayGridPlugin, interactionPlugin]}
                    initialView="dayGridMonth"
                    locale="fr"
                    height={520}
                    events={calendarEvents}
                    dateClick={handleDateClick}
                    eventClick={handleEventClick}
                    headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth' }}
                />
            </div>

            {/* Add override dialog */}
            <Dialog open={!!overrideDialog} onOpenChange={(open) => !open && setOverrideDialog(null)}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-indigo-100 flex items-center justify-center">
                                <Plus className="w-4 h-4 text-indigo-600" />
                            </span>
                            Override du {overrideDialog?.date}
                        </DialogTitle>
                        <DialogDescription>
                            Affectation exceptionnelle qui remplace ou complète le planning hebdomadaire.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-1.5 uppercase tracking-wide">Tournée</p>
                            <SearchableSelect
                                options={itineraryOptions}
                                value={overrideItineraryId ?? undefined}
                                onChange={(v) => setOverrideItineraryId(v ? Number(v) : null)}
                                placeholder="— Choisir une tournée —"
                                clearable
                            />
                        </div>
                        <div>
                            <p className="text-xs font-semibold text-gray-600 mb-2 uppercase tracking-wide">Mode d'override</p>
                            <div className="grid grid-cols-2 gap-2">
                                {(['REPLACE', 'APPEND'] as PlanningDailyStrategyMode[]).map((mode) => (
                                    <button
                                        key={mode}
                                        onClick={() => setStrategyMode(mode)}
                                        className={[
                                            'p-3 rounded-xl border text-left transition-all',
                                            strategyMode === mode
                                                ? 'border-indigo-400 bg-indigo-50 ring-2 ring-indigo-200'
                                                : 'border-gray-200 hover:border-gray-300',
                                        ].join(' ')}
                                    >
                                        <p className="text-sm font-bold text-gray-800">{mode}</p>
                                        <p className="text-[11px] text-gray-500 mt-0.5">
                                            {mode === 'REPLACE' ? 'Remplace le planning habituel' : "S'ajoute aux tournées habituelles"}
                                        </p>
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setOverrideDialog(null)}>Annuler</Button>
                        <Button onClick={handleAddOverride} disabled={upsertForDate.isPending || !overrideItineraryId}>
                            {upsertForDate.isPending && <Loader2 className="w-4 h-4 mr-1.5 animate-spin" />}
                            Créer l'override
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete override confirmation */}
            <ConfirmDialog
                open={!!deleteTarget}
                title="Supprimer l'override"
                description={`Supprimer l'override du ${deleteTarget?.work_date} (${deleteTarget?.itinerary?.name ?? ''}) ?`}
                confirmLabel="Supprimer"
                variant="danger"
                loading={deleting}
                onConfirm={confirmDeleteOverride}
                onCancel={() => setDeleteTarget(null)}
            />
        </div>
    );
}

// ─── Agent roster (left pane) ─────────────────────────────────────────────────

function AgentRoster({ selectedUserId, onSelect }: { selectedUserId: number | null; onSelect: (id: number) => void }) {
    const [search, setSearch] = useState('');
    const { data: planningUsersData, isLoading } = usePlanningUsers();
    const planningUsers = planningUsersData?.users ?? [];

    const filtered = planningUsers.filter(
        (u) => !search || u.name.toLowerCase().includes(search.toLowerCase()) || (u.branch_code ?? '').toLowerCase().includes(search.toLowerCase())
    );

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
                    <div className="w-7 h-7 rounded-lg bg-sage-100 flex items-center justify-center">
                        <CalendarDays className="w-4 h-4 text-sage-600" />
                    </div>
                    <h1 className="text-sm font-bold text-gray-900">Planning Tournées</h1>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                    <Input placeholder="Rechercher un agent..." value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs pl-8" />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="space-y-2 p-2">
                        {[...Array(6)].map((_, i) => <div key={i} className="h-14 rounded-xl bg-gray-100 animate-pulse" />)}
                    </div>
                ) : filtered.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-gray-400">
                        <Users className="w-8 h-8 mb-2" />
                        <p className="text-xs">Aucun agent trouvé</p>
                    </div>
                ) : (
                    [...grouped.entries()].map(([branch, users]) => (
                        <div key={branch} className="mb-4">
                            <p className="flex items-center gap-1.5 px-2 py-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                                <Building2 className="w-3 h-3" />{branch}
                            </p>
                            <div className="space-y-0.5">
                                {users.map((u) => {
                                    const isSelected = u.id === selectedUserId;
                                    const initials   = u.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();
                                    const isLivreur  = u.b2b_role === 'livreur';
                                    return (
                                        <button
                                            key={u.id}
                                            onClick={() => onSelect(u.id)}
                                            className={[
                                                'w-full flex items-center gap-2.5 px-2.5 py-2.5 rounded-xl text-left transition-all',
                                                isSelected
                                                    ? 'bg-sage-50 border border-sage-200 shadow-sm'
                                                    : 'border border-transparent hover:bg-gray-50',
                                            ].join(' ')}
                                        >
                                            <div className={[
                                                'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0',
                                                isLivreur ? 'bg-amber-100 text-amber-700' : 'bg-sage-100 text-sage-700',
                                            ].join(' ')}>
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className={['text-xs truncate', isSelected ? 'font-semibold text-sage-800' : 'font-medium text-gray-700'].join(' ')}>
                                                    {u.name}
                                                </p>
                                                <p className="text-[10px] text-gray-400 truncate">
                                                    {ROLE_LABELS[u.b2b_role] ?? u.b2b_role}
                                                    {u.geo_area_code && ` · ${u.geo_area_code}`}
                                                </p>
                                            </div>
                                            {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-sage-500 shrink-0" />}
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
    const [activeTab, setActiveTab]           = useState('weekly');
    const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
    const [assignDialogOpen, setAssignDialogOpen] = useState(false);

    const { data: planningUsersData, refetch: refetchUsers } = usePlanningUsers();
    const planningUsers = planningUsersData?.users ?? [];
    const { data: summary, refetch: refetchSummary } = usePlanningSummary(selectedUserId);

    const { plannedDaysByItinerary, planningIdLookup } = useMemo(() => {
        const byItinerary = new Map<number, Set<number>>();
        const idLookup    = new Map<string, number>();
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

    const actionGroups = [{
        items: [
            ...(selectedUserId ? [{
                icon: Plus,
                label: 'Affecter une tournée',
                variant: 'primary' as const,
                onClick: () => setAssignDialogOpen(true),
            }] : []),
            {
                icon: RotateCcw,
                label: 'Rafraîchir',
                variant: 'default' as const,
                onClick: () => { refetchUsers(); if (selectedUserId) refetchSummary(); },
            },
        ],
    }];

    const mainContent = (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Agent header */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-6 py-3">
                {selectedUser ? (
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-md">
                                {selectedUser.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}
                            </div>
                            <div>
                                <h2 className="text-sm font-semibold text-gray-900">{selectedUser.name}</h2>
                                <p className="text-[11px] text-gray-400">{selectedUser.email}</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <Badge variant="secondary" className="gap-1 text-[11px]">
                                <UserRound className="w-3 h-3" />
                                {ROLE_LABELS[selectedUser.b2b_role] ?? selectedUser.b2b_role}
                            </Badge>
                            {selectedUser.branch_code && (
                                <Badge variant="outline" className="gap-1 text-[11px]">
                                    <Building2 className="w-3 h-3" />{selectedUser.branch_code}
                                </Badge>
                            )}
                            {selectedUser.geo_area_code && (
                                <Badge variant="outline" className="gap-1 text-[11px]">
                                    <MapPin className="w-3 h-3" />{selectedUser.geo_area_code}
                                </Badge>
                            )}
                            <Button size="sm" onClick={() => setAssignDialogOpen(true)} className="gap-1.5 ml-2">
                                <Plus className="w-4 h-4" />Affecter une tournée
                            </Button>
                        </div>
                    </div>
                ) : (
                    <div className="flex items-center gap-2 py-1">
                        <CalendarDays className="w-4 h-4 text-gray-300" />
                        <p className="text-sm text-gray-400">Sélectionnez un agent terrain dans la liste</p>
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="shrink-0 border-b border-gray-100 bg-white px-6">
                <SageTabs
                    tabs={[
                        { id: 'weekly', label: 'Planning hebdomadaire' },
                        { id: 'daily',  label: 'Overrides journaliers' },
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
