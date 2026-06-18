import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  useDraggable,
  useDroppable,
  type DragEndEvent,
  type DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Package2, Truck, Lock, GripVertical, Loader2, RefreshCw, Boxes, PackagePlus, MapPinned } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { DecisionActionsBar } from '@/components/dispatcher/DecisionActionsBar';
import { useAuth } from '@/context/AuthContext';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import { useDispatcherPendingOrders } from '@/hooks/dispatcher/useDispatcherOrders';
import { useDispatcherDeliveryOrdersList } from '@/hooks/dispatcher/useDispatcherDeliveryOrders';
import { useCreateDeliveryOrderDecision, useCreateBatch, useSealBatch } from '@/hooks/dispatcher/useDispatcherPlanningWorkspace';
import type { DispatcherOrder, DeliveryOrder, LogisticsBatch } from '@/types/dispatcher.types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const getZone = (o: DispatcherOrder): string => {
  if (o.partner?.delivery_zone) return o.partner.delivery_zone;
  if (o.partner?.geo_area?.parent?.name) return o.partner.geo_area.parent.name;
  if (o.partner?.geo_area?.name) return o.partner.geo_area.name;
  const itin = o.partner?.active_itineraries?.[0];
  if (itin?.name) return itin.name;
  return 'Sans zone';
};

const getDoZone = (d: DeliveryOrder): string => d.delivery_zone || 'Sans zone';

// This board is Pipeline 1 (LOT path) only — 'optimized'/'in_preparation'/etc. only exist on
// Pipeline 2 (Dispatch V2) and a DO in those states can never be create_batch'd (docs §2,
// confirmed by backend 2026-06-16: the two pipelines are mutually exclusive). Excluding them
// here avoids showing a Pipeline-2 DO as if it were still a LOT candidate.
// Includes 'pending_allocation' defensively — docs §2 say auto_allocate:true always resolves to
// allocated/partially_allocated, but a DO reported "disappearing" right after creation (2026-06-18)
// suggests it may land here instead in some cases (e.g. allocation couldn't proceed at all). Better
// to show it (un-selectable for LOT until allocated, same treatment as 'draft') than hide it.
// Includes 'validated' too — confirmed by backend 2026-06-18 that `create_batch` explicitly
// accepts `validated` DOs as a valid starting point (root cause of an incident where a DO was
// auto-validated with 0% stock allocated, still under investigation server-side, is unrelated to
// whether this status should be batchable — it legitimately is per the decision's own guard).
// Without this, an orphaned validated-but-unbatched DO would be stuck with no way to recover it
// from this board.
const UNBATCHED_STATUSES = ['draft', 'pending_allocation', 'allocated', 'partially_allocated', 'validated'];

// create_batch only accepts DOs in these statuses (docs §2/§16) — 'draft' DOs haven't been
// allocated yet and would be rejected, so they're shown but not selectable for batching.
const BATCHABLE_STATUSES = ['allocated', 'partially_allocated', 'validated'];

// decision_denied errors come back as { violations: [{ constraint, reason, context }] }, not
// `constraints` — surface each violation's `reason` (e.g. `mixed_branches` tells you which
// branch_ids conflicted via `context`, so a dispatcher knows to pass branch_code explicitly).
const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'action";
};

// ─── Drag selection chip ──────────────────────────────────────────────────────
// The chip itself is the drag source (kept in flow, dimmed while dragging); a
// separate <DragOverlay> renders the floating clone that actually follows the
// cursor, which avoids the jumpy/clipped feel of transform-translating an
// in-flow element directly.

const SelectionChip = ({ count, disabled }: { count: number; disabled?: boolean }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: 'bc-selection-chip',
    disabled,
  });

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-lg select-none transition-all duration-150 ${
        disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-grab active:cursor-grabbing hover:bg-blue-700 hover:shadow-xl'
      } ${isDragging ? 'opacity-30' : ''}`}
    >
      <GripVertical size={16} />
      {count} BC sélectionnée{count > 1 ? 's' : ''} — glisser vers une zone
    </div>
  );
};

const SelectionDragPreview = ({ count }: { count: number }) => (
  <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-2xl ring-4 ring-blue-300/50 scale-105 cursor-grabbing select-none">
    <MapPinned size={16} className="animate-pulse" />
    {count} BC sélectionnée{count > 1 ? 's' : ''}
  </div>
);

// ─── Zone drop target (Planning Board section) ────────────────────────────────

const ZoneSection = ({
  zone,
  dos,
  selectedDoIds,
  onToggleDo,
  isAssigning,
  isDragActive,
  onDoActionDone,
}: {
  zone: string;
  dos: DeliveryOrder[];
  selectedDoIds: Set<number>;
  onToggleDo: (id: number) => void;
  isAssigning: boolean;
  isDragActive: boolean;
  onDoActionDone: () => void;
}) => {
  const { setNodeRef, isOver } = useDroppable({ id: `zone:${zone}` });

  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 p-3 mb-3 transition-all duration-150 ${
        isOver
          ? 'border-blue-500 bg-blue-50 shadow-lg scale-[1.01] ring-4 ring-blue-200/60'
          : isDragActive
          ? 'border-dashed border-blue-300 bg-white opacity-60'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-1.5">
          <Truck size={14} className={isOver ? 'text-blue-500' : 'text-gray-400'} /> {zone}
        </h3>
        <span className="text-xs text-gray-500">{dos.length} DO</span>
      </div>

      {isOver && (
        <div className="text-xs text-blue-700 font-semibold mb-2 flex items-center gap-1.5 animate-pulse">
          {isAssigning ? <Loader2 size={12} className="animate-spin" /> : <MapPinned size={12} />}
          {isAssigning ? 'Création du DO en cours…' : 'Déposer pour créer un nouveau DO dans cette zone'}
        </div>
      )}

      {dos.length === 0 ? (
        <p className="text-xs text-gray-400 italic">Aucun DO dans cette zone</p>
      ) : (
        <div className="space-y-1.5">
          {dos.map((d) => {
            const batchable = BATCHABLE_STATUSES.includes(d.status);
            return (
              <div key={d.id} className="bg-gray-50 hover:bg-gray-100 rounded px-2 py-1.5 border border-gray-100">
                <label
                  className={`flex items-center gap-2 text-xs ${batchable ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`}
                  title={batchable ? undefined : "Non éligible au LOT — d'abord allouer/optimiser ce DO via une action ci-dessous"}
                >
                  <input
                    type="checkbox"
                    checked={selectedDoIds.has(d.id)}
                    disabled={!batchable}
                    onChange={() => onToggleDo(d.id)}
                    className="rounded"
                  />
                  <span className="font-semibold text-gray-700">{d.do_number}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{d.orders_count} BC</span>
                  <span className="ml-auto px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-medium">
                    {d.status}
                  </span>
                </label>
                <div className="mt-1.5 pl-5">
                  <DecisionActionsBar
                    subjectId={d.id}
                    subjectLabel={d.do_number}
                    fetchDecisions={dispatcherApi.deliveryOrders.getDecisions}
                    executeDecision={dispatcherApi.deliveryOrders.executeDecision}
                    onActionDone={onDoActionDone}
                    compact
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Open LOTs section (currently-open logistics batches, not yet sealed) ─────

const LotsSection = ({ lots, onLotActionDone }: { lots: LogisticsBatch[]; onLotActionDone: () => void }) => {
  if (!Array.isArray(lots) || lots.length === 0) return null;
  return (
    <div className="rounded-lg border-2 border-amber-200 bg-amber-50 p-3 mb-3">
      <h3 className="text-sm font-bold text-amber-800 flex items-center gap-1.5 mb-2">
        <Boxes size={14} className="text-amber-500" /> LOTs ouverts ({lots.length})
      </h3>
      <div className="space-y-1.5">
        {lots.map((lot) => (
          <div key={lot.id} className="bg-white rounded px-2 py-1.5 border border-amber-100">
            <div className="flex items-center gap-2 text-xs">
              <span className="font-semibold text-gray-700">{lot.batch_number}</span>
              <span className="text-gray-400">·</span>
              <span className="text-gray-500">{lot.delivery_notes?.length ?? 0} BL</span>
              <span className="ml-auto px-1.5 py-0.5 rounded bg-amber-200 text-amber-700 text-[10px] font-medium">
                {lot.status}
              </span>
            </div>
            <div className="mt-1.5">
              <DecisionActionsBar
                subjectId={lot.id}
                subjectLabel={lot.batch_number}
                fetchDecisions={dispatcherApi.batches.getDecisions}
                executeDecision={dispatcherApi.batches.executeDecision}
                onActionDone={onLotActionDone}
                compact
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const DispatcherPlanningWorkspacePage = () => {
  const { user } = useAuth();
  // `branch_code` is sometimes only populated on the nested `branch` relation rather than the
  // top-level field, depending on how the user payload was hydrated — fall back to it instead of
  // surfacing a false "branch code not found" error.
  const branchCode = user?.branch_code ?? user?.branch?.code;
  const [selectedOrders, setSelectedOrders] = useState<DispatcherOrder[]>([]);
  const [selectedDoIds, setSelectedDoIds] = useState<Set<number>>(new Set());
  const [assigningZone, setAssigningZone] = useState<string | null>(null);
  const [isDragActive, setIsDragActive] = useState(false);

  const { data: pendingData, loading: pendingLoading, refetch: refetchPending } = useDispatcherPendingOrders({ per_page: 100 });
  // per_page bumped from the backend default (20) — with no status filter, this list spans every
  // DO ever created (including dispatched/cancelled history). On any branch with real volume, a
  // newly-created DO can land past page 1 and never show up in unbatchedDos below even though it
  // was created successfully — looked like the DO "disappearing" after create.
  const { data: doData, loading: doLoading, refetch: refetchDos } = useDispatcherDeliveryOrdersList({ status: undefined, per_page: 200 });

  const { create: createDo } = useCreateDeliveryOrderDecision();
  const { createBatch, loading: creatingBatch } = useCreateBatch();
  const { sealBatch, loading: sealing } = useSealBatch();

  const [openLots, setOpenLots] = useState<LogisticsBatch[]>([]);

  const refetchLots = useCallback(() => {
    dispatcherApi.batches.getList({ status: 'open' })
      .then((r) => setOpenLots(r.data ?? []))
      .catch(() => setOpenLots([]));
  }, []);

  useEffect(() => { refetchLots(); }, [refetchLots]);

  const pendingOrders = useMemo(() => pendingData?.data ?? [], [pendingData]);

  const unbatchedDos = useMemo(
    () => (doData?.data ?? []).filter((d) => UNBATCHED_STATUSES.includes(d.status) && !d.logistics_batch_id),
    [doData]
  );

  const zones = useMemo(() => {
    const set = new Set<string>();
    pendingOrders.forEach((o) => set.add(getZone(o)));
    unbatchedDos.forEach((d) => set.add(getDoZone(d)));
    return Array.from(set).sort();
  }, [pendingOrders, unbatchedDos]);

  const dosByZone = useMemo(() => {
    const map = new Map<string, DeliveryOrder[]>();
    zones.forEach((z) => map.set(z, []));
    unbatchedDos.forEach((d) => {
      const z = getDoZone(d);
      if (!map.has(z)) map.set(z, []);
      map.get(z)!.push(d);
    });
    return map;
  }, [zones, unbatchedDos]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const assignSelectionToZone = useCallback(
    async (zone: string) => {
      if (selectedOrders.length === 0) return;
      setAssigningZone(zone);
      try {
        // branch_code is optional here — the backend derives it from the selected orders'
        // branch_id. It's only needed to disambiguate a `mixed_branches` violation (orders from
        // different branches selected together), which we don't pre-resolve here; the dispatcher
        // sees the violation's reason and can re-select orders from a single branch instead.
        const res = await createDo({
          order_ids: selectedOrders.map((o) => o.id),
          delivery_zone: zone !== 'Sans zone' ? zone : undefined,
          auto_allocate: true,
        });
        if (res.success) {
          toast.success(`DO créé et alloué (${selectedOrders.length} BC) — zone "${zone}"`);
          setSelectedOrders([]);
          refetchPending();
          refetchDos();
        } else {
          toast.error(res.message || 'Création du DO refusée');
        }
      } catch (err) {
        toast.error(extractErrorMessage(err), { duration: 6000 });
      } finally {
        setAssigningZone(null);
      }
    },
    [selectedOrders, createDo, refetchPending, refetchDos]
  );

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    setIsDragActive(true);
  }, []);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      setIsDragActive(false);
      const zoneId = event.over?.id;
      if (typeof zoneId === 'string' && zoneId.startsWith('zone:')) {
        assignSelectionToZone(zoneId.slice('zone:'.length));
      }
    },
    [assignSelectionToZone]
  );

  const handleDragCancel = useCallback(() => {
    setIsDragActive(false);
  }, []);

  const toggleDo = useCallback((id: number) => {
    setSelectedDoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleCreateBatch = useCallback(async () => {
    if (selectedDoIds.size === 0) return;
    if (!branchCode) {
      console.warn('[PlanningWorkspace] branch_code introuvable sur le user — envoi sans branch_code, le backend devra le déduire des DO.');
    }
    try {
      const res = await createBatch({
        delivery_order_ids: Array.from(selectedDoIds),
        ...(branchCode ? { branch_code: branchCode } : {}),
      });
      if (res.success) {
        toast.success(res.message || 'LOT créé (ouvert) — vous pouvez encore y ajouter des DO');
        setSelectedDoIds(new Set());
        refetchDos();
        refetchLots();
      } else {
        toast.error(res.message || 'Création du LOT refusée');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  }, [selectedDoIds, branchCode, createBatch, refetchDos, refetchLots]);

  const handleSealBatch = useCallback(async () => {
    if (selectedDoIds.size === 0) return;
    if (!branchCode) {
      console.warn('[PlanningWorkspace] branch_code introuvable sur le user — envoi sans branch_code, le backend devra le déduire des DO.');
    }
    try {
      const res = await sealBatch({
        delivery_order_ids: Array.from(selectedDoIds),
        ...(branchCode ? { branch_code: branchCode } : {}),
      });
      if (res.success) {
        toast.success(res.message || 'LOT scellé — BP généré pour le magasin', { duration: 6000 });
        setSelectedDoIds(new Set());
        refetchDos();
        refetchLots();
      } else {
        toast.error(res.message || 'Scellement refusé');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  }, [selectedDoIds, branchCode, sealBatch, refetchDos, refetchLots]);

  const columnDefs = useMemo(
    () => [
      { field: 'order_code', headerName: 'BC', maxWidth: 140 },
      { headerName: 'Client', valueGetter: (p: any) => p.data?.partner?.name, flex: 2 },
      { headerName: 'Zone', valueGetter: (p: any) => getZone(p.data), maxWidth: 140 },
      {
        headerName: 'Montant',
        valueGetter: (p: any) => Number(p.data?.total_amount ?? 0),
        valueFormatter: (p: any) => `${Number(p.value ?? 0).toLocaleString('fr-FR')} DH`,
        maxWidth: 130,
      },
      { field: 'order_date', headerName: 'Date', maxWidth: 110 },
    ],
    []
  );

  const leftContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Package2 size={16} className="text-blue-600" /> Demande (BC en attente)
        </h2>
        <button
          onClick={() => refetchPending()}
          className="text-gray-400 hover:text-gray-600"
          title="Rafraîchir"
        >
          <RefreshCw size={14} />
        </button>
      </div>
      <div className="flex-1 min-h-0">
        <DataGrid
          rowData={pendingOrders}
          columnDefs={columnDefs}
          rowSelection="multiple"
          loading={pendingLoading}
          onSelectionChanged={(rows) => setSelectedOrders(rows)}
        />
      </div>
      {selectedOrders.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
          <SelectionChip count={selectedOrders.length} disabled={assigningZone !== null} />
        </div>
      )}
    </div>
  );

  const mainContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Truck size={16} className="text-blue-600" /> Plan de tournée (DO non groupés)
        </h2>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCreateBatch}
            disabled={selectedDoIds.size === 0 || creatingBatch || sealing}
            title="Crée un LOT ouvert sans le sceller — vous pourrez y ajouter d'autres DO avant de sceller"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-500 text-white text-xs font-bold shadow hover:bg-amber-600 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {creatingBatch ? <Loader2 size={14} className="animate-spin" /> : <PackagePlus size={14} />}
            Créer LOT {selectedDoIds.size > 0 ? `(${selectedDoIds.size})` : ''}
          </button>
          <button
            onClick={handleSealBatch}
            disabled={selectedDoIds.size === 0 || sealing || creatingBatch}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-bold shadow hover:bg-green-700 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {sealing ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />}
            Sceller le LOT &amp; Générer BP {selectedDoIds.size > 0 ? `(${selectedDoIds.size})` : ''}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        <LotsSection lots={openLots} onLotActionDone={() => { refetchLots(); refetchDos(); }} />
        {doLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : (
          zones.map((zone) => (
            <ZoneSection
              key={zone}
              zone={zone}
              dos={dosByZone.get(zone) ?? []}
              selectedDoIds={selectedDoIds}
              onToggleDo={toggleDo}
              isAssigning={assigningZone === zone}
              isDragActive={isDragActive}
              onDoActionDone={refetchDos}
            />
          ))
        )}
      </div>
    </div>
  );

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={handleDragCancel}>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      <DragOverlay dropAnimation={{ duration: 180, easing: 'cubic-bezier(0.18, 0.67, 0.6, 1.22)' }}>
        {isDragActive ? <SelectionDragPreview count={selectedOrders.length} /> : null}
      </DragOverlay>
    </DndContext>
  );
};

export default DispatcherPlanningWorkspacePage;
