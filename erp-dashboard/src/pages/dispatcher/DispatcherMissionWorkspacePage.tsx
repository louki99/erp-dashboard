import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  DndContext, DragOverlay, PointerSensor, useDraggable, useDroppable, useSensor, useSensors, pointerWithin,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core';
import {
  Loader2, Package, Truck, User, RefreshCw, CheckCircle2, ChevronDown, ChevronUp, Route,
  Search, Filter, X, MapPin, UserCircle2, Navigation, Box, Weight, AlertTriangle, MapPinned, Eye, GripVertical,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { Modal } from '@/components/common/Modal';
import { DecisionActionsBar } from '@/components/dispatcher/DecisionActionsBar';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { CheckboxSearchDropdown, type CheckboxOption } from '@/components/dispatcher/CheckboxSearchDropdown';
import { LoadCapacityBar } from '@/components/dispatcher/LoadCapacityBar';
import { Highlight } from '@/components/dispatcher/Highlight';
import { BlDetailModal } from '@/components/dispatcher/BlDetailModal';
import { computeMissionLoad } from '@/utils/missionLoad';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import { useDispatcherPendingOrders } from '@/hooks/dispatcher/useDispatcherOrders';
import { useRidersWithVehicles } from '@/hooks/dispatcher/useDispatcherFleet';
import {
  useDeliveryMissionsList,
  useCreateDeliveryMission,
} from '@/hooks/dispatcher/useDispatcherDeliveryMissions';
import type { DeliveryMission, DispatcherOrder, OrdersPendingFilters } from '@/types/dispatcher.types';

// ─── BC → Delivery Mission workspace (docs §8.1, 2026-06-20) ──────────────────
// Replaces the old two-screen Planning/Loading split: rider + vehicle are now picked at mission
// creation time, in the same call that selects the BCs — there's no longer a separate "seal the
// LOT" or "group into a BCH" step before assigning a rider.

// ─── Proximity smart-sort ───────────────────────────────────────────────────
// Replaces "Zone de livraison" / "Secteur géo" text/ID filters — those required knowing an
// internal code/ID by heart and didn't actually use the geo coordinates already on every order
// (`partner.geo_lat`/`geo_lng`). This greedily chains the BC pool nearest-neighbor by haversine
// distance instead, so partners close to each other end up adjacent in the list — closer to what
// a dispatcher actually wants ("group the BCs that are near each other") than a manual zone code.
const toRad = (deg: number) => (deg * Math.PI) / 180;

const haversineKm = (lat1: number, lng1: number, lat2: number, lng2: number): number => {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const sortByProximity = (orders: DispatcherOrder[]): Array<DispatcherOrder & { __distFromPrev?: number }> => {
  const withGeo = orders.filter((o) => o.partner.geo_lat != null && o.partner.geo_lng != null);
  const withoutGeo = orders.filter((o) => o.partner.geo_lat == null || o.partner.geo_lng == null);
  if (withGeo.length === 0) return orders;

  const remaining = [...withGeo];
  const chain: Array<DispatcherOrder & { __distFromPrev?: number }> = [];
  let current = remaining.shift()!;
  chain.push(current);

  while (remaining.length > 0) {
    const curLat = Number(current.partner.geo_lat);
    const curLng = Number(current.partner.geo_lng);
    let nearestIdx = 0;
    let nearestDist = Infinity;
    remaining.forEach((o, idx) => {
      const d = haversineKm(curLat, curLng, Number(o.partner.geo_lat), Number(o.partner.geo_lng));
      if (d < nearestDist) { nearestDist = d; nearestIdx = idx; }
    });
    current = remaining.splice(nearestIdx, 1)[0];
    chain.push({ ...current, __distFromPrev: nearestDist });
  }
  return [...chain, ...withoutGeo];
};

const MISSION_STATUS_LABEL: Record<string, string> = {
  draft: 'Brouillon',
  in_preparation: 'En préparation',
  ready: 'Prêt',
  in_transit: 'En transit',
  completed: 'Terminé',
  cancelled: 'Annulé',
};

// ─── Drag a BC onto a mission to attach it (backend 2026-06-22, add_order_ids) ─────────────────
// One useDraggable instance per row — must be its own component (not a hook called inline inside
// .map()) since the list length changes as orders are checked off/added, which would otherwise
// violate the rules of hooks (call count has to stay stable across renders for a given component).
const DraggableOrderRow = ({
  order,
  checked,
  onToggle,
  distLabel,
}: {
  order: DispatcherOrder;
  checked: boolean;
  onToggle: () => void;
  distLabel?: string;
}) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `order-${order.id}`,
    data: { orderId: order.id },
  });

  return (
    <div
      ref={setNodeRef}
      style={transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 } : undefined}
      className={`flex items-start gap-2 px-2.5 py-2 rounded-lg border transition-colors ${
        isDragging ? 'opacity-40' : ''
      } ${checked ? 'border-blue-400 bg-blue-50' : 'border-gray-100 hover:bg-gray-50'}`}
    >
      <div
        {...attributes}
        {...listeners}
        title="Glisser vers une mission pour l'ajouter directement"
        className="mt-0.5 p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 cursor-grab active:cursor-grabbing shrink-0 touch-none"
      >
        <GripVertical size={13} />
      </div>
      <label className="flex items-start gap-2 min-w-0 flex-1 cursor-pointer">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className="text-xs font-mono font-semibold text-gray-800 truncate">{order.order_code}</div>
            {distLabel && (
              <span className="shrink-0 text-[10px] px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-medium">{distLabel}</span>
            )}
          </div>
          <div className="text-[11px] text-gray-500 truncate">
            {order.partner.name}{order.partner.city ? ` · ${order.partner.city}` : ''}
          </div>
          {order.salesperson_data?.salesperson?.name && (
            <div className="text-[10px] text-gray-400 truncate">{order.salesperson_data.salesperson.name}</div>
          )}
        </div>
      </label>
    </div>
  );
};

const MissionCard = ({
  mission,
  onRefresh,
  searchQuery,
  onViewBl,
  defaultExpanded = false,
}: {
  mission: DeliveryMission;
  onRefresh: () => void;
  searchQuery: string;
  onViewBl: (blId: number) => void;
  defaultExpanded?: boolean;
}) => {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const isDraftMission = mission.status === 'draft';

  // Auto-expand a card the moment it starts matching a search (e.g. typing a BL/BC code that
  // belongs to a currently-collapsed mission) — but don't fight the dispatcher if they manually
  // collapse it back while still typing, so only react to the true→true edge, not every keystroke.
  useEffect(() => {
    if (defaultExpanded) setExpanded(true);
  }, [defaultExpanded]);

  // Drop target for a dragged BC row — only a draft mission can accept add_order_ids (docs §8.6),
  // so non-draft missions stay registered as droppable (for a clear "rejected" hover state) but
  // never actually accept the drop.
  const { setNodeRef, isOver } = useDroppable({
    id: `mission-${mission.id}`,
    data: { missionId: mission.id, status: mission.status, missionNumber: mission.mission_number },
  });
  const showAcceptHighlight = isOver && isDraftMission;
  const showRejectHighlight = isOver && !isDraftMission;

  return (
    <div
      ref={setNodeRef}
      className={`bg-white border rounded-xl shadow-sm overflow-hidden transition-all ${
        showAcceptHighlight
          ? 'border-emerald-400 ring-2 ring-emerald-200'
          : showRejectHighlight
          ? 'border-red-300 ring-2 ring-red-100'
          : 'border-gray-200'
      }`}
    >
      {showAcceptHighlight && (
        <div className="px-4 py-1.5 bg-emerald-50 text-emerald-700 text-[11px] font-semibold flex items-center gap-1.5">
          <CheckCircle2 size={11} /> Relâchez pour ajouter cette BC à la mission
        </div>
      )}
      {showRejectHighlight && (
        <div className="px-4 py-1.5 bg-red-50 text-red-700 text-[11px] font-semibold flex items-center gap-1.5">
          <AlertTriangle size={11} /> Mission non modifiable (statut « {MISSION_STATUS_LABEL[mission.status] ?? mission.status} »)
        </div>
      )}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition-colors"
      >
        <div className="flex items-center gap-3 min-w-0">
          <Route className="w-4 h-4 text-blue-500 shrink-0" />
          <div className="min-w-0 text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-bold text-gray-900">
                <Highlight text={mission.mission_number} query={searchQuery} />
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-blue-100 text-blue-700">
                {MISSION_STATUS_LABEL[mission.status] ?? mission.status}
              </span>
            </div>
            <div className="text-xs text-gray-500 mt-0.5 flex items-center gap-2">
              <span className="flex items-center gap-1"><User size={11} /> <Highlight text={mission.rider?.name ?? '—'} query={searchQuery} /></span>
              <span className="flex items-center gap-1"><Truck size={11} /> {mission.vehicle?.plate_number ?? mission.vehicle?.plate ?? '—'}</span>
              <span>{mission.bl_count ?? mission.delivery_notes?.length ?? 0} BL</span>
            </div>
          </div>
        </div>
        {expanded ? <ChevronUp size={16} className="text-gray-400 shrink-0" /> : <ChevronDown size={16} className="text-gray-400 shrink-0" />}
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3 space-y-3">
          <DecisionActionsBar
            subjectId={mission.id}
            subjectLabel={mission.mission_number}
            fetchDecisions={dispatcherApi.deliveryMissions.getDecisions}
            executeDecision={dispatcherApi.deliveryMissions.executeDecision}
            onActionDone={onRefresh}
            missionContext={{
              branchCode: mission.branch_code,
              currentBls: (mission.delivery_notes ?? []).map((bl) => ({
                id: bl.id,
                label: `${bl.delivery_number}${bl.partner?.name ? ` — ${bl.partner.name}` : ''}`,
              })),
            }}
          />

          {mission.delivery_notes && mission.delivery_notes.length > 0 ? (
            <div className="space-y-2">
              <h4 className="text-xs font-semibold text-gray-500">Bons de livraison</h4>
              {mission.delivery_notes.map((bl) => (
                <div key={bl.id} className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="min-w-0">
                    <div className="text-xs font-mono font-semibold text-gray-800 truncate">
                      <Highlight text={bl.delivery_number} query={searchQuery} />
                    </div>
                    <div className="text-[11px] text-gray-400 truncate">
                      <Highlight text={bl.partner?.name ?? ''} query={searchQuery} />
                      {bl.order?.order_code && (
                        <span> · <Highlight text={bl.order.order_code} query={searchQuery} /></span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      onClick={() => onViewBl(bl.id)}
                      title="Voir le détail du BL / de la BC liée"
                      className="p-1.5 rounded hover:bg-gray-200 text-gray-500 transition-colors"
                    >
                      <Eye size={14} />
                    </button>
                    <DecisionActionsBar
                      subjectId={bl.id}
                      subjectLabel={bl.delivery_number ?? `BL #${bl.id}`}
                      fetchDecisions={dispatcherApi.bonLivraisons.getDecisions}
                      executeDecision={dispatcherApi.bonLivraisons.executeDecision}
                      onActionDone={onRefresh}
                      compact
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400">Aucun BL</p>
          )}
        </div>
      )}
    </div>
  );
};

export const DispatcherMissionWorkspacePage = () => {
  const navigate = useNavigate();
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [riderId, setRiderId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [showCreateConfirm, setShowCreateConfirm] = useState(false);

  const { data: riders, loading: ridersLoading } = useRidersWithVehicles({ status: 'active' });

  // A rider already carries their assigned vehicle(s) (GET /backend/riders/with-vehicles, docs
  // §12d) — no separate vehicle picker needed. Auto-select when the rider has exactly one
  // vehicle (the common case); let the dispatcher choose if there's more than one.
  const selectedRider = riders.find((r) => r.id === riderId);
  const riderVehicles = selectedRider?.vehicles ?? [];
  const selectedVehicle = riderVehicles.find((v) => v.id === vehicleId) ?? null;

  const handleSelectRider = (id: number | '') => {
    setRiderId(id);
    if (id === '') { setVehicleId(''); return; }
    const rider = riders.find((r) => r.id === id);
    const vs = rider?.vehicles ?? [];
    setVehicleId(vs.length === 1 ? vs[0].id : '');
  };

  // ─── BC pool search/filters ───────────────────────────────────────────────
  // `search` is a real, server-side param on GET /backend/dispatcher/orders/pending (docs §6).
  // "Zone de livraison" / "Secteur géo (ID)" were dropped — both required typing an internal
  // code/ID by heart and ignored the geo coordinates already present on every order. Replaced by
  // proximity smart-sort (below), which actually uses `partner.geo_lat`/`geo_lng`. Verified live
  // 2026-06-21: there is NO `city` param and NO name-based salesperson/itinerary search either —
  // "Commercial", "Tournée" and "Ville" are filtered client-side against the currently loaded
  // page until backend adds proper params (see note further down).
  const [showFilters, setShowFilters] = useState(false);
  const [search, setSearch] = useState('');
  const [city, setCity] = useState('');
  const [itineraryIds, setItineraryIds] = useState<number[]>([]);
  const [salespersonIds, setSalespersonIds] = useState<number[]>([]);
  const [smartSort, setSmartSort] = useState(false);

  const orderFilters = useMemo<OrdersPendingFilters>(() => ({
    per_page: 100,
    search: search || undefined,
  }), [search]);

  const activeFilterCount = [search, city].filter(Boolean).length
    + (itineraryIds.length > 0 ? 1 : 0) + (salespersonIds.length > 0 ? 1 : 0);

  const resetFilters = () => {
    setSearch(''); setCity('');
    setItineraryIds([]); setSalespersonIds([]);
  };

  const { data: pendingData, loading: ordersLoading, refetch: refetchOrders } = useDispatcherPendingOrders(orderFilters);
  const allOrders = pendingData?.data ?? [];

  // Options derived from the currently loaded page — no dedicated lookup endpoint exists yet.
  const itineraryOptions = useMemo<CheckboxOption[]>(() => {
    const map = new Map<number, string>();
    allOrders.forEach((o) => o.partner?.active_itineraries?.forEach((it) => {
      if (it.id != null) map.set(it.id, it.name);
    }));
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allOrders]);

  const salespersonOptions = useMemo<CheckboxOption[]>(() => {
    const map = new Map<number, string>();
    allOrders.forEach((o) => {
      const sp = o.salesperson_data?.salesperson;
      if (sp?.id != null) map.set(sp.id, sp.name);
    });
    return Array.from(map, ([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
  }, [allOrders]);

  const orders = useMemo((): Array<DispatcherOrder & { __distFromPrev?: number }> => {
    let list: DispatcherOrder[] = allOrders;
    // Client-side only — no backend `city` param exists on orders/pending (ask backend to add
    // one if this needs to work beyond the currently loaded page).
    if (city) {
      const needle = city.trim().toLowerCase();
      list = list.filter((o) => (o.partner?.city ?? '').toLowerCase().includes(needle));
    }
    if (itineraryIds.length > 0) {
      list = list.filter((o) => o.partner?.active_itineraries?.some((it) => it.id != null && itineraryIds.includes(it.id)));
    }
    if (salespersonIds.length > 0) {
      list = list.filter((o) => {
        const spId = o.salesperson_data?.salesperson?.id;
        return spId != null && salespersonIds.includes(spId);
      });
    }
    return smartSort ? sortByProximity(list) : list;
  }, [allOrders, city, itineraryIds, salespersonIds, smartSort]);

  const { data: missions, loading: missionsLoading, refetch: refetchMissions } = useDeliveryMissionsList();
  const { create, loading: creating } = useCreateDeliveryMission();

  // Mission search — matches mission number, rider, vehicle plate, and (inside each mission)
  // every BL number / partner name / linked BC code, so a dispatcher can find a mission either by
  // its own identity or by something they remember about one of its BLs/BCs.
  const [missionSearch, setMissionSearch] = useState('');
  const [viewBlId, setViewBlId] = useState<number | null>(null);

  const filteredMissions = useMemo(() => {
    const q = missionSearch.trim().toLowerCase();
    if (!q) return missions;
    return missions.filter((m) => {
      const haystack = [
        m.mission_number,
        m.rider?.name,
        m.vehicle?.plate_number,
        m.vehicle?.plate,
        ...(m.delivery_notes ?? []).flatMap((bl) => [bl.delivery_number, bl.partner?.name, bl.order?.order_code]),
      ];
      return haystack.some((v) => v?.toLowerCase().includes(q));
    });
  }, [missions, missionSearch]);

  // Computed from allOrders (unfiltered), not the visible filtered/sorted `orders` list — an
  // already-selected BC can fall outside the current filters and must still count toward load.
  const missionLoad = useMemo(
    () => computeMissionLoad(allOrders.filter((o) => selectedOrderIds.includes(o.id))),
    [allOrders, selectedOrderIds]
  );

  const toggleOrder = (id: number) => {
    setSelectedOrderIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const refreshAll = () => {
    refetchOrders();
    refetchMissions();
  };

  // ─── Drag a BC onto a mission to attach it ─────────────────────────────────
  // Activation distance keeps a plain click on the row's checkbox/label working as a click —
  // only a sustained pointer move past 8px starts an actual drag, so the two interactions
  // (toggle-for-bulk-creation vs drag-to-attach-to-an-existing-mission) don't fight each other.
  const dndSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const [activeDragOrder, setActiveDragOrder] = useState<DispatcherOrder | null>(null);
  const [pendingDrop, setPendingDrop] = useState<{ order: DispatcherOrder; missionId: number; missionNumber: string } | null>(null);
  const [confirmingDrop, setConfirmingDrop] = useState(false);

  const handleDragStart = (e: DragStartEvent) => {
    const orderId = e.active.data.current?.orderId as number | undefined;
    setActiveDragOrder(allOrders.find((o) => o.id === orderId) ?? null);
  };

  // Dropping doesn't attach immediately — it just stages the operation; the actual API call only
  // fires once the dispatcher confirms in the modal below, same "no surprise mutation from a
  // single gesture" principle as the rest of this workspace's destructive/structural actions.
  const handleDragEnd = (e: DragEndEvent) => {
    setActiveDragOrder(null);
    const orderId = e.active.data.current?.orderId as number | undefined;
    const overData = e.over?.data.current as { missionId?: number; status?: string; missionNumber?: string } | undefined;
    if (!orderId || !overData?.missionId) return;
    if (overData.status !== 'draft') {
      toast.error(`Mission non modifiable (statut « ${MISSION_STATUS_LABEL[overData.status ?? ''] ?? overData.status} »).`);
      return;
    }
    const order = allOrders.find((o) => o.id === orderId);
    if (!order) return;
    setPendingDrop({ order, missionId: overData.missionId, missionNumber: overData.missionNumber ?? `#${overData.missionId}` });
  };

  const confirmAddOrderToMission = async () => {
    if (!pendingDrop) return;
    setConfirmingDrop(true);
    try {
      const res = await dispatcherApi.deliveryMissions.executeDecision(pendingDrop.missionId, 'update_delivery_mission', {
        add_order_ids: [pendingDrop.order.id],
      });
      if (res.success) {
        toast.success(res.message || 'BC ajoutée à la mission');
        setPendingDrop(null);
        refreshAll();
      } else {
        toast.error(res.message || "Échec de l'ajout");
      }
    } catch (err) {
      const e2 = err as { response?: { data?: { message?: string; violations?: Array<{ reason: string }> } } };
      const violations = e2?.response?.data?.violations;
      toast.error(
        violations?.length ? violations.map((v) => v.reason).join(' · ') : e2?.response?.data?.message ?? "Échec de l'ajout",
        { duration: 6000 }
      );
    } finally {
      setConfirmingDrop(false);
    }
  };

  const openCreateConfirm = () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Sélectionnez au moins une commande');
      return;
    }
    if (riderId === '' || vehicleId === '') {
      toast.error('Sélectionnez un livreur et un véhicule');
      return;
    }
    setShowCreateConfirm(true);
  };

  const handleCreateMission = async () => {
    if (selectedOrderIds.length === 0 || riderId === '' || vehicleId === '') return;
    try {
      const res = await create({
        order_ids: selectedOrderIds,
        rider_id: riderId,
        vehicle_id: vehicleId,
        notes: notes || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Mission créée');
        setSelectedOrderIds([]);
        setNotes('');
        setShowCreateConfirm(false);
        refreshAll();
      } else {
        toast.error(res.message || 'Échec de la création');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; violations?: Array<{ reason: string }> } } };
      const violations = e?.response?.data?.violations;
      toast.error(
        violations?.length ? violations.map((v) => v.reason).join(' · ') : e?.response?.data?.message ?? 'Échec de la création',
        { duration: 6000 }
      );
    }
  };

  const leftContent = (
    <div className="h-full bg-white border-r border-gray-100 flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center justify-between">
          <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
            <Package size={16} className="text-blue-600" /> Commandes en attente
          </h1>
          <button
            onClick={() => navigate('/dispatcher/workspace/map')}
            title="Vue carte par géolocalisation"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
          >
            <MapPinned size={13} /> Carte
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{selectedOrderIds.length} sélectionnée(s) / {orders.length}</p>
        <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
          <GripVertical size={10} /> Glissez une BC sur une mission brouillon pour l'y ajouter directement
        </p>

        <div className="relative mt-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="BC, partenaire…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-gray-50"
          />
        </div>

        <div className="flex gap-2 mt-2">
          <button
            onClick={() => setShowFilters(true)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
              activeFilterCount > 0 ? 'border-blue-400 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            <Filter size={12} /> Filtres
            {activeFilterCount > 0 && (
              <span className="px-1.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-bold leading-none">
                {activeFilterCount}
              </span>
            )}
          </button>
          <button
            onClick={refetchOrders}
            className="flex items-center justify-center px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw size={12} />
          </button>
        </div>

        <button
          onClick={() => setSmartSort((v) => !v)}
          title="Regrouper les BC les plus proches géographiquement (basé sur les coordonnées GPS partenaire)"
          className={`mt-2 w-full flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
            smartSort ? 'border-emerald-400 bg-emerald-50 text-emerald-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Navigation size={12} /> Tri par proximité {smartSort ? '(actif)' : ''}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {ordersLoading ? (
          <div className="h-full flex items-center justify-center text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ) : orders.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-8">Aucune commande en attente</p>
        ) : (
          <div className="space-y-1.5">
            {orders.map((o) => {
              const dist = o.__distFromPrev;
              return (
                <DraggableOrderRow
                  key={o.id}
                  order={o}
                  checked={selectedOrderIds.includes(o.id)}
                  onToggle={() => toggleOrder(o.id)}
                  distLabel={smartSort && dist != null ? `~${dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`}` : undefined}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full overflow-y-auto bg-slate-50 p-6 space-y-6">
      {/* Mission creation form */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
        <h2 className="text-sm font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Route size={16} className="text-blue-500" /> Créer une mission
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <SearchSelectDropdown
            label="Livreur"
            options={riders.map((r) => ({
              id: r.id,
              label: r.name,
              sublabel: r.vehicles.length === 0 ? 'Sans véhicule' : r.vehicles.length > 1 ? `${r.vehicles.length} véhicules` : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
            }))}
            value={riderId}
            onChange={handleSelectRider}
            disabled={ridersLoading}
          />
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
              placeholder="…"
            />
          </div>
        </div>

        {/* Vehicle — auto-selected from the rider's assignment (GET /riders/with-vehicles, §12d).
            A select only appears if the rider has more than one active vehicle. */}
        {riderId !== '' && (
          <div className="mt-3">
            {riderVehicles.length === 0 ? (
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
                <AlertTriangle size={14} className="shrink-0" /> Ce livreur n'a aucun véhicule assigné — assignez-en un depuis la Flotte avant de créer la mission.
              </div>
            ) : (
              <>
                {riderVehicles.length > 1 && (
                  <div className="mb-2">
                    <SearchSelectDropdown
                      label="Véhicule"
                      options={riderVehicles.map((v) => ({
                        id: v.id,
                        label: v.display_name ?? v.plate_number ?? v.plate ?? `#${v.id}`,
                        sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
                      }))}
                      value={vehicleId}
                      onChange={setVehicleId}
                    />
                  </div>
                )}

                {selectedVehicle && (
                  <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                    <div className="flex items-center gap-2 mb-2">
                      <Truck size={14} className="text-blue-500" />
                      <span className="text-sm font-bold text-blue-900">
                        {selectedVehicle.display_name ?? selectedVehicle.plate_number ?? selectedVehicle.plate}
                      </span>
                      {(selectedVehicle.make || selectedVehicle.model) && (
                        <span className="text-xs text-blue-600">{[selectedVehicle.make, selectedVehicle.model].filter(Boolean).join(' ')}</span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <Box size={12} /> Volume: <strong>{selectedVehicle.capacity_volume ?? '—'} m³</strong>
                      </div>
                      <div className="flex items-center gap-1.5 text-blue-700">
                        <Weight size={12} /> Charge: <strong>{selectedVehicle.payload_kg ?? selectedVehicle.capacity_weight ?? '—'} kg</strong>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Estimation de charge — backend a ajouté unit_volume_m3/unit_weight_kg sur
            order_products[].product 2026-06-22 (product_logistics_profiles →
            product_packaging_levels). Beaucoup de SKUs n'ont pas encore ces données renseignées
            (gap catalogue, pas un bug) — LoadCapacityBar le signale plutôt que de cacher l'écart. */}
        {selectedOrderIds.length > 0 && selectedVehicle && (
          <div className="mt-3">
            <LoadCapacityBar estimate={missionLoad} vehicle={selectedVehicle} />
          </div>
        )}

        <button
          onClick={openCreateConfirm}
          disabled={creating || selectedOrderIds.length === 0}
          className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
          Créer la mission ({selectedOrderIds.length} BC)
        </button>
      </div>

      {/* Existing missions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-gray-800">
            Missions ({filteredMissions.length}{missionSearch ? ` / ${missions.length}` : ''})
          </h2>
          <button onClick={refetchMissions} className="p-1.5 rounded hover:bg-gray-200 transition-colors text-gray-400">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="relative mb-3">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            value={missionSearch}
            onChange={(e) => setMissionSearch(e.target.value)}
            placeholder="Mission, livreur, BL, BC…"
            className="w-full pl-8 pr-3 py-2 text-xs border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-300 focus:border-blue-400 bg-white"
          />
        </div>

        {missionsLoading ? (
          <div className="flex items-center justify-center py-10 text-gray-400">
            <Loader2 className="w-6 h-6 animate-spin" />
          </div>
        ) : missions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune mission</p>
        ) : filteredMissions.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-10">Aucune mission ne correspond à « {missionSearch} »</p>
        ) : (
          <div className="space-y-2">
            {filteredMissions.map((m) => (
              <MissionCard
                key={m.id}
                mission={m}
                onRefresh={refreshAll}
                searchQuery={missionSearch}
                onViewBl={setViewBlId}
                defaultExpanded={!!missionSearch}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );

  // pointerWithin, not closestCenter — closestCenter always reports the nearest droppable as
  // "over" even when the pointer hasn't actually entered it yet, which made a mission card light
  // up the instant a drag started. pointerWithin only matches when the pointer is truly inside a
  // droppable's bounds, so the dispatcher can start a drag and move freely without any mission
  // falsely showing as the target until they're actually over one.
  return (
    <DndContext sensors={dndSensors} collisionDetection={pointerWithin} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />

      <DragOverlay>
        {activeDragOrder && (
          <div className="px-3 py-2 rounded-lg border-2 border-blue-400 bg-white shadow-2xl text-xs font-mono font-semibold text-gray-800 flex items-center gap-1.5">
            <GripVertical size={12} className="text-blue-400" />
            {activeDragOrder.order_code}
          </div>
        )}
      </DragOverlay>

      <Modal isOpen={showFilters} onClose={() => setShowFilters(false)} title="Filtres" size="sm">
        <div className="p-4 space-y-3">
          <div>
            <label className="text-[11px] text-gray-500 flex items-center gap-1 mb-1">
              <MapPin size={11} /> Ville
            </label>
            <input
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="Ex: Casablanca…"
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg"
            />
            <p className="text-[10px] text-gray-400 mt-0.5">Filtre local (page chargée) — pas encore de paramètre backend.</p>
          </div>

          <CheckboxSearchDropdown
            label="Tournée"
            icon={<Route size={11} />}
            options={itineraryOptions}
            selected={itineraryIds}
            onChange={setItineraryIds}
          />

          <CheckboxSearchDropdown
            label="Commercial"
            icon={<UserCircle2 size={11} />}
            options={salespersonOptions}
            selected={salespersonIds}
            onChange={setSalespersonIds}
          />
          <p className="text-[10px] text-gray-400 -mt-2">Filtres locaux (page chargée) — pas encore de paramètre backend.</p>

          <div className="flex gap-2 pt-2">
            {activeFilterCount > 0 && (
              <button
                onClick={resetFilters}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs text-red-500 hover:text-red-700 font-medium py-2 rounded-lg border border-red-100 hover:bg-red-50"
              >
                <X size={12} /> Réinitialiser
              </button>
            )}
            <button
              onClick={() => setShowFilters(false)}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-white font-semibold py-2 rounded-lg bg-blue-600 hover:bg-blue-700"
            >
              Appliquer
            </button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={showCreateConfirm} onClose={() => setShowCreateConfirm(false)} title="Confirmer la création de mission" size="sm">
        <div className="p-4 space-y-3">
          <p className="text-sm text-gray-600">
            <strong>{selectedOrderIds.length}</strong> commande(s) seront regroupées en une mission, assignée à{' '}
            <strong>{selectedRider?.name}</strong> avec le véhicule{' '}
            <strong>{selectedVehicle?.display_name ?? selectedVehicle?.plate_number}</strong>.
          </p>

          {missionLoad.itemCount > 0 && selectedVehicle && (
            <LoadCapacityBar estimate={missionLoad} vehicle={selectedVehicle} />
          )}

          {notes && (
            <div className="p-2.5 rounded-lg bg-gray-50 border border-gray-100 text-xs text-gray-600">
              <span className="font-semibold text-gray-700">Notes: </span>{notes}
            </div>
          )}

          <div className="flex gap-2 pt-1">
            <button
              onClick={handleCreateMission}
              disabled={creating}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50"
            >
              {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
              Confirmer
            </button>
            <button
              onClick={() => setShowCreateConfirm(false)}
              disabled={creating}
              className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50"
            >
              Annuler
            </button>
          </div>
        </div>
      </Modal>

      <BlDetailModal blId={viewBlId} onClose={() => setViewBlId(null)} />

      <Modal
        isOpen={pendingDrop != null}
        onClose={() => { if (!confirmingDrop) setPendingDrop(null); }}
        title="Ajouter cette BC à la mission ?"
        size="sm"
      >
        {pendingDrop && (
          <div className="p-5 space-y-4">
            <p className="text-sm text-gray-600">
              <strong className="font-mono">{pendingDrop.order.order_code}</strong>
              {pendingDrop.order.partner?.name ? ` (${pendingDrop.order.partner.name})` : ''} sera attachée à la
              mission <strong>{pendingDrop.missionNumber}</strong>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={confirmAddOrderToMission}
                disabled={confirmingDrop}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-60 transition-colors"
              >
                {confirmingDrop ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {confirmingDrop ? 'Ajout en cours…' : 'Confirmer'}
              </button>
              <button
                onClick={() => setPendingDrop(null)}
                disabled={confirmingDrop}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 disabled:opacity-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        )}
      </Modal>
    </DndContext>
  );
};

export default DispatcherMissionWorkspacePage;
