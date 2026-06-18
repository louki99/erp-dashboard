import { useCallback, useEffect, useMemo, useState } from 'react';
import { DndContext, useDraggable, useDroppable, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { Package2, Truck, Plus, GripVertical, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { DecisionActionsBar } from '@/components/dispatcher/DecisionActionsBar';
import { dispatcherApi } from '@/services/api/dispatcherApi';
import type { DeliveryNote, Shipment, Rider, Vehicle, CreateBchPayload } from '@/types/dispatcher.types';

const ACTIVE_BCH_STATUSES = ['pending', 'in_preparation'];

// create_bch / addBls only accept BLs in `confirmed` or `ready` status (docs §8.3) — `draft` BLs
// must be confirmed first (confirm_delivery, exposed via the Actions column below). `ready` BLs
// are ones a LOT's BP already picked (magasinier-driven, docs §2 Pipeline 1) and may land here
// without ever passing through `draft` — show all three so nothing is invisible regardless of
// which pipeline produced the BL, but only `confirmed`/`ready` are selectable for grouping.
const BCH_ELIGIBLE_BL_STATUSES = ['confirmed', 'ready'];

// decision_denied errors come back as { violations: [{ constraint, reason, context }] }, not
// `constraints` — surface each violation's `reason` so the dispatcher sees the actual cause.
const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'action";
};

// ─── Draggable BL selection chip ──────────────────────────────────────────────

const SelectionChip = ({ count }: { count: number }) => {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: 'bl-selection-chip' });
  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-lg cursor-grab active:cursor-grabbing select-none ${isDragging ? 'opacity-70 z-50' : ''}`}
    >
      <GripVertical size={16} />
      {count} BL sélectionné{count > 1 ? 's' : ''} — glisser vers un camion
    </div>
  );
};

// ─── BCH card (drop target) ───────────────────────────────────────────────────

const BchCard = ({ bch, onActionDone }: { bch: Shipment; onActionDone: () => void }) => {
  const { setNodeRef, isOver } = useDroppable({ id: `bch:${bch.id}` });
  return (
    <div
      ref={setNodeRef}
      className={`rounded-lg border-2 transition-colors p-3 mb-3 ${
        isOver ? 'border-blue-500 bg-blue-50' : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
          <Truck size={14} className="text-gray-400" /> {bch.shipment_number}
        </span>
        <span className="px-1.5 py-0.5 rounded bg-gray-200 text-gray-600 text-[10px] font-medium">{bch.status}</span>
      </div>
      <div className="text-xs text-gray-500 flex items-center gap-3">
        <span>{bch.rider?.name ?? 'Sans livreur'}</span>
        <span>{bch.vehicle?.plate ?? bch.vehicle?.plate_number ?? '—'}</span>
        <span className="ml-auto">{bch.delivery_notes_count ?? bch.delivery_notes?.length ?? 0} BL</span>
      </div>
      {isOver && (
        <p className="text-[11px] text-blue-700 font-medium mt-1.5">Déposer pour ajouter au camion</p>
      )}
      <div className="mt-1.5 pt-1.5 border-t border-gray-100">
        <DecisionActionsBar
          subjectId={bch.id}
          subjectLabel={bch.shipment_number}
          fetchDecisions={dispatcherApi.bonChargements.getDecisions}
          executeDecision={dispatcherApi.bonChargements.executeDecision}
          onActionDone={onActionDone}
          compact
        />
      </div>
    </div>
  );
};

// ─── Create BCH modal ─────────────────────────────────────────────────────────

const CreateBchModal = ({
  isOpen,
  onClose,
  blIds,
  onCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  blIds: number[];
  onCreated: () => void;
}) => {
  const [riders, setRiders] = useState<Rider[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [riderId, setRiderId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [plannedDate, setPlannedDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      dispatcherApi.livreurs.getList().then(setRiders).catch(() => setRiders([]));
      dispatcherApi.vehicles.getList().then(setVehicles).catch(() => setVehicles([]));
    }
  }, [isOpen]);

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const payload: CreateBchPayload = {
        decision: 'create_bch',
        bl_ids: blIds,
        rider_id: riderId === '' ? undefined : riderId,
        vehicle_id: vehicleId === '' ? undefined : vehicleId,
        planned_date: plannedDate || undefined,
      };
      const res = await dispatcherApi.bonChargements.create(payload);
      if (res.success) {
        toast.success(res.message || 'BCH créé');
        onCreated();
        onClose();
      } else {
        toast.error(res.message || 'Création refusée');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Créer un Bon de Chargement" size="sm">
      <div className="space-y-3">
        <p className="text-xs text-gray-500">{blIds.length} BL sélectionné(s)</p>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Livreur</label>
          <select
            value={riderId}
            onChange={(e) => setRiderId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Véhicule</label>
          <select
            value={vehicleId}
            onChange={(e) => setVehicleId(e.target.value ? Number(e.target.value) : '')}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          >
            <option value="">— Sélectionner —</option>
            {vehicles.map((v) => (
              <option key={v.id} value={v.id}>
                {v.plate_number ?? v.plate} {v.internal_code ? `(${v.internal_code})` : ''} — {v.capacity_weight ?? v.capacity_kg ?? '?'} kg
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Date prévue</label>
          <input
            type="date"
            value={plannedDate}
            onChange={(e) => setPlannedDate(e.target.value)}
            className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded">
            Annuler
          </button>
          <button
            onClick={handleSubmit}
            disabled={blIds.length === 0 || submitting}
            className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 rounded hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            {submitting ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            Créer
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const DispatcherLoadingWorkspacePage = () => {
  const [poolBls, setPoolBls] = useState<DeliveryNote[]>([]);
  const [blsLoading, setBlsLoading] = useState(true);
  const [bchs, setBchs] = useState<Shipment[]>([]);
  const [bchsLoading, setBchsLoading] = useState(true);
  const [selectedBls, setSelectedBls] = useState<DeliveryNote[]>([]);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Merge draft + confirmed + ready — a BL can land in any of these depending on which pipeline
  // produced it (see POOL_BL_STATUSES comment above), and none of them are "already grouped" yet.
  const refetchBls = useCallback(() => {
    setBlsLoading(true);
    Promise.all([
      dispatcherApi.bonLivraisons.getDraft().catch(() => ({ data: [] as DeliveryNote[] })),
      dispatcherApi.bonLivraisons.getConfirmed().catch(() => ({ data: [] as DeliveryNote[] })),
      dispatcherApi.bonLivraisons.getList({ status: 'ready' }).catch(() => ({ data: [] as DeliveryNote[] })),
    ])
      .then(([draft, confirmed, ready]) => {
        const byId = new Map<number, DeliveryNote>();
        [...(draft.data ?? []), ...(confirmed.data ?? []), ...(ready.data ?? [])].forEach((bl) => byId.set(bl.id, bl));
        setPoolBls(Array.from(byId.values()));
      })
      .catch(() => setPoolBls([]))
      .finally(() => setBlsLoading(false));
  }, []);

  const refetchBchs = useCallback(() => {
    setBchsLoading(true);
    dispatcherApi.bonChargements.getList({})
      .then((r) => setBchs((r.bch?.data ?? []).filter((b) => ACTIVE_BCH_STATUSES.includes(b.status))))
      .catch(() => setBchs([]))
      .finally(() => setBchsLoading(false));
  }, []);

  useEffect(() => { refetchBls(); refetchBchs(); }, [refetchBls, refetchBchs]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const targetId = event.over?.id;
      if (typeof targetId !== 'string' || !targetId.startsWith('bch:') || selectedBls.length === 0) return;
      const bchId = Number(targetId.slice('bch:'.length));
      try {
        const res = await dispatcherApi.bonChargements.addBls(bchId, selectedBls.map((b) => b.id));
        if (res.success) {
          toast.success(`${selectedBls.length} BL ajouté(s) au camion`);
          setSelectedBls([]);
          refetchBls();
          refetchBchs();
        } else {
          toast.error(res.message || 'Ajout refusé');
        }
      } catch (err) {
        toast.error(extractErrorMessage(err));
      }
    },
    [selectedBls, refetchBls, refetchBchs]
  );

  const columnDefs = useMemo(
    () => [
      { field: 'delivery_number', headerName: 'BL', maxWidth: 140 },
      { headerName: 'Client', valueGetter: (p: any) => p.data?.partner?.name, flex: 2 },
      {
        headerName: 'Statut',
        maxWidth: 110,
        cellRenderer: (p: { data?: DeliveryNote }) => {
          const eligible = p.data && BCH_ELIGIBLE_BL_STATUSES.includes(p.data.status);
          return (
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${
                eligible ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-600'
              }`}
            >
              {p.data?.status}
            </span>
          );
        },
      },
      {
        headerName: 'Montant',
        valueGetter: (p: any) => Number(p.data?.total_amount ?? 0),
        valueFormatter: (p: any) => `${Number(p.value ?? 0).toLocaleString('fr-FR')} DH`,
        maxWidth: 130,
      },
      { field: 'delivery_date', headerName: 'Date', maxWidth: 110 },
      {
        headerName: 'Actions',
        maxWidth: 180,
        sortable: false,
        filter: false,
        cellRenderer: (p: { data?: DeliveryNote }) =>
          p.data ? (
            <DecisionActionsBar
              subjectId={p.data.id}
              subjectLabel={p.data.delivery_number}
              fetchDecisions={dispatcherApi.bonLivraisons.getDecisions}
              executeDecision={dispatcherApi.bonLivraisons.executeDecision}
              onActionDone={refetchBls}
              compact
            />
          ) : null,
      },
    ],
    [refetchBls]
  );

  const leftContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Package2 size={16} className="text-blue-600" /> Zone de tri (BL à grouper)
        </h2>
        <button onClick={refetchBls} className="text-gray-400 hover:text-gray-600" title="Rafraîchir">
          <RefreshCw size={14} />
        </button>
      </div>
      <p className="px-4 py-1.5 text-[11px] text-gray-400 border-b border-gray-100 bg-gray-50">
        Brouillon (draft) doit être confirmé via l'action « Confirmer » avant de pouvoir être groupé dans un BCH.
      </p>
      <div className="flex-1 min-h-0">
        <DataGrid
          rowData={poolBls}
          columnDefs={columnDefs}
          rowSelection="multiple"
          loading={blsLoading}
          isRowSelectable={(p: { data?: DeliveryNote }) => !!p.data && BCH_ELIGIBLE_BL_STATUSES.includes(p.data.status)}
          getRowClass={(p: { data?: DeliveryNote }) =>
            p.data && !BCH_ELIGIBLE_BL_STATUSES.includes(p.data.status) ? 'opacity-50' : ''
          }
          onSelectionChanged={(rows) => setSelectedBls(rows)}
        />
      </div>
      {selectedBls.length > 0 && (
        <div className="p-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between gap-2">
          <SelectionChip count={selectedBls.length} />
          <button
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-600 text-white text-xs font-bold shadow hover:bg-green-700"
          >
            <Plus size={14} /> Créer BCH
          </button>
        </div>
      )}
    </div>
  );

  const mainContent = (
    <div className="flex flex-col h-full">
      <div className="px-4 py-3 border-b border-gray-200 bg-white flex items-center justify-between">
        <h2 className="text-sm font-bold text-gray-800 flex items-center gap-2">
          <Truck size={16} className="text-blue-600" /> Flotte (BCH actifs)
        </h2>
        <button
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-bold shadow hover:bg-blue-700"
        >
          <Plus size={14} /> Créer BCH
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        {bchsLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : bchs.length === 0 ? (
          <p className="text-xs text-gray-400 italic">Aucun BCH actif</p>
        ) : (
          bchs.map((b) => <BchCard key={b.id} bch={b} onActionDone={refetchBchs} />)
        )}
      </div>
    </div>
  );

  return (
    <>
      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      </DndContext>
      <CreateBchModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        blIds={selectedBls.map((b) => b.id)}
        onCreated={() => { setSelectedBls([]); refetchBls(); refetchBchs(); }}
      />
    </>
  );
};

export default DispatcherLoadingWorkspacePage;
