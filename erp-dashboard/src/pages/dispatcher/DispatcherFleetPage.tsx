import { useMemo, useState } from 'react';
import {
  Truck, Search, Phone, Mail, MapPin, RefreshCw, Loader2, Power,
  PackageX, Plus, X, Gauge, Weight, Box, Info, UserCircle2,
  Ruler, Fuel, Hash, Wrench, UserX, Pencil, StickyNote, Calendar, AlertTriangle,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { Modal, ConfirmModal } from '@/components/common/Modal';
import {
  useRidersWithVehicles,
  useFleetVehicles,
  useToggleRiderActive,
  useAssignVehicle,
  useUnassignVehicle,
  useUpdateAssignment,
} from '@/hooks/dispatcher/useDispatcherFleet';
import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

const extractErrorMessage = (err: any): string => {
  const violations = err?.response?.data?.violations as
    | Array<{ constraint?: string; reason: string; context?: unknown }>
    | undefined;
  if (violations?.length) return violations.map((v) => v.reason).join(' · ');
  return err?.response?.data?.message ?? "Échec de l'action";
};

const initials = (name?: string) =>
  (name ?? '?')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');

// ─── Rider list row ──────────────────────────────────────────────────────────

const RiderRow = ({
  rider,
  selected,
  onClick,
}: {
  rider: RiderWithVehicles;
  selected: boolean;
  onClick: () => void;
}) => {
  const vehicle = rider.vehicles?.[0];
  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
        selected ? 'border-sage-400 bg-sage-50/60 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
      }`}
    >
      <div className="relative shrink-0">
        <div
          className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold text-white ${
            rider.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-300'
          }`}
        >
          {initials(rider.name)}
        </div>
        <span
          className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${
            rider.is_active ? 'bg-emerald-500' : 'bg-gray-400'
          }`}
        />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-gray-800 truncate">{rider.name}</div>
        <div className="text-xs text-gray-400 truncate">{rider.branch?.name ?? rider.branch_code ?? '—'}</div>
      </div>
      {vehicle ? (
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0">
          <Truck size={11} /> {vehicle.plate_number ?? vehicle.plate}
        </span>
      ) : (
        <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-amber-50 text-amber-600 text-[10px] font-bold shrink-0">
          <PackageX size={11} /> Sans véhicule
        </span>
      )}
    </button>
  );
};

// ─── Vehicle list row ────────────────────────────────────────────────────────

const VehicleRow = ({
  vehicle,
  assignedRider,
  selected,
  onClick,
}: {
  vehicle: Vehicle;
  assignedRider?: RiderWithVehicles;
  selected: boolean;
  onClick: () => void;
}) => (
  <button
    onClick={onClick}
    className={`w-full text-left p-3 rounded-xl border transition-all flex items-center gap-3 ${
      selected ? 'border-sage-400 bg-sage-50/60 shadow-sm' : 'border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50'
    }`}
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${assignedRider ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gray-200'}`}>
      <Truck size={16} className={assignedRider ? 'text-white' : 'text-gray-500'} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="text-sm font-semibold text-gray-800 truncate">{vehicle.plate_number ?? vehicle.plate}</div>
      <div className="text-xs text-gray-400 truncate capitalize">{vehicle.type ?? '—'}{vehicle.internal_code ? ` · ${vehicle.internal_code}` : ''}</div>
    </div>
    {vehicle.has_active_shipments && (
      <span title="BCH en cours" className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
    )}
    {assignedRider ? (
      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-[10px] font-bold shrink-0 max-w-[110px] truncate">
        <UserCircle2 size={11} className="shrink-0" /> <span className="truncate">{assignedRider.name}</span>
      </span>
    ) : (
      <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-gray-100 text-gray-500 text-[10px] font-bold shrink-0">
        <UserX size={11} /> Disponible
      </span>
    )}
  </button>
);

// ─── Vehicle assignment card ─────────────────────────────────────────────────

const CapacityStat = ({
  icon: Icon,
  label,
  value,
  secondaryLabel,
  secondaryValue,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  secondaryLabel?: string;
  secondaryValue?: string;
}) => (
  <div className="flex items-start gap-2 px-3 py-2 rounded-lg bg-gray-50 border border-gray-100">
    <Icon size={14} className="text-gray-400 mt-0.5" />
    <div>
      <div className="text-xs font-bold text-gray-800">{value}</div>
      <div className="text-[10px] text-gray-400">{label}</div>
      {secondaryValue && (
        <div className="text-[10px] text-sage-600 font-semibold mt-1 pt-1 border-t border-gray-200">
          {secondaryLabel}: {secondaryValue}
        </div>
      )}
    </div>
  </div>
);

// capacity_volume * usable_volume_ratio * loading_efficiency_ratio — same formula as the WMS
// volumetric gate (docs §16). Guarded with a null-check rather than assumed present, since older
// cached vehicle data (or any endpoint backend hasn't updated yet) may still omit the ratios.
const effectiveVolume = (vehicle: Vehicle): { pct: number; value: number } | null => {
  if (vehicle.capacity_volume == null || vehicle.usable_volume_ratio == null || vehicle.loading_efficiency_ratio == null) {
    return null;
  }
  return {
    pct: Math.round(vehicle.usable_volume_ratio * 100),
    value: Math.round(vehicle.capacity_volume * vehicle.usable_volume_ratio * vehicle.loading_efficiency_ratio * 10) / 10,
  };
};

// Cold-chain badge — only flags vehicles explicitly marked non-refrigerated (`=== false`).
// undefined (older payload, field not yet selected by some endpoint) renders nothing rather than
// guessing — see Vehicle type comment for the confirmed real column.
const ColdChainBadge = ({ vehicle }: { vehicle: Vehicle }) => {
  if (vehicle.cold_chain_enabled !== false) return null;
  return (
    <span className="px-2 py-1 rounded-full bg-orange-100 text-orange-700 text-[10px] font-bold uppercase tracking-wide">
      Sec / Non-Réfrigéré
    </span>
  );
};

const VehicleCard = ({
  vehicle,
  onUnassign,
  onEdit,
  unassigning,
}: {
  vehicle: Vehicle;
  onUnassign: () => void;
  onEdit: () => void;
  unassigning: boolean;
}) => (
  <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50 to-white p-5">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2.5 rounded-xl bg-emerald-600 shadow-sm">
          <Truck className="w-5 h-5 text-white" />
        </div>
        <div>
          <div className="text-base font-bold text-gray-900">{vehicle.plate_number ?? vehicle.plate}</div>
          <div className="text-xs text-gray-500">
            {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || vehicle.type}
            {vehicle.internal_code ? ` · ${vehicle.internal_code}` : ''}
          </div>
        </div>
      </div>
      <div className="flex flex-col items-end gap-1.5">
        <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide">
          {vehicle.type ?? 'véhicule'}
        </span>
        <ColdChainBadge vehicle={vehicle} />
      </div>
    </div>

    <div className="grid grid-cols-2 gap-2 mb-4">
      <CapacityStat
        icon={Weight}
        label="Poids max"
        value={vehicle.capacity_weight != null ? `${vehicle.capacity_weight} kg` : (vehicle.capacity_kg != null ? `${vehicle.capacity_kg} kg` : '—')}
        secondaryLabel="Charge utile max"
        secondaryValue={vehicle.payload_kg != null ? `${vehicle.payload_kg} kg` : undefined}
      />
      <CapacityStat
        icon={Box}
        label="Volume max"
        value={vehicle.capacity_volume != null ? `${vehicle.capacity_volume} m³` : '—'}
        secondaryLabel={effectiveVolume(vehicle) ? `Volume utile (Eff. ${effectiveVolume(vehicle)!.pct}%)` : undefined}
        secondaryValue={effectiveVolume(vehicle) ? `${effectiveVolume(vehicle)!.value} m³` : undefined}
      />
    </div>

    {vehicle.has_active_shipments && (
      <div className="flex items-center gap-2 px-3 py-2 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
        <AlertTriangle size={13} className="shrink-0" />
        BCH en cours sur ce véhicule — retrait impossible tant qu'il n'est pas terminé/annulé.
      </div>
    )}

    <div className="flex gap-2">
      <button
        onClick={onEdit}
        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
      >
        <Pencil size={14} /> Modifier
      </button>
      <button
        onClick={onUnassign}
        disabled={unassigning || vehicle.has_active_shipments}
        title={vehicle.has_active_shipments ? 'Impossible de retirer : BCH en cours' : undefined}
        className="flex-1 flex items-center justify-center gap-2 py-2 text-sm font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
      >
        {unassigning ? <Loader2 size={14} className="animate-spin" /> : <X size={14} />}
        Retirer
      </button>
    </div>
  </div>
);

// ─── Assign vehicle modal ────────────────────────────────────────────────────

const AssignVehicleModal = ({
  isOpen,
  onClose,
  rider,
  vehicles,
  vehiclesLoading,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  rider: RiderWithVehicles | null;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  onAssigned: () => void;
}) => {
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState<'van_seller' | 'delivery_agent'>('van_seller');
  const { assign, loading } = useAssignVehicle();

  const handleSubmit = async () => {
    if (!rider || vehicleId === '') return;
    try {
      const res = await assign(vehicleId, rider.id, {
        starts_at: startsAt || undefined,
        notes: notes || undefined,
        role,
      });
      if (res.success) {
        toast.success(res.message || 'Véhicule assigné');
        setVehicleId('');
        setStartsAt('');
        setNotes('');
        setRole('van_seller');
        onAssigned();
        onClose();
      } else {
        toast.error(res.message || 'Assignation refusée');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assigner un véhicule${rider ? ` — ${rider.name}` : ''}`} size="md">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex-1 overflow-y-auto px-5 pt-5 min-h-[120px]">
          {vehiclesLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-xs">Chargement des véhicules...</span>
            </div>
          ) : vehicles.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-400">
              <Truck size={28} />
              <p className="text-sm font-medium">Aucun véhicule disponible</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {vehicles.map((v) => {
                const isSelected = v.id === vehicleId;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                      isSelected ? 'border-sage-500 bg-sage-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-gray-800">
                        <Truck size={14} className={isSelected ? 'text-blue-500' : 'text-gray-400'} />
                        {v.plate_number ?? v.plate}
                      </span>
                      <span
                        className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                          isSelected ? 'border-sage-500 bg-sage-500' : 'border-gray-300'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-xs text-gray-500">
                      <span className="capitalize">{v.type ?? '—'}</span>
                      <span>{v.capacity_weight ?? v.capacity_kg ?? '?'} kg</span>
                      {v.capacity_volume != null && <span>{v.capacity_volume} m³</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {vehicleId !== '' && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'van_seller' | 'delivery_agent')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="van_seller">Van seller</option>
                    <option value="delivery_agent">Delivery agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Début (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex : remplace intérim de Karim..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
                />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 mt-3 border-t border-gray-100 bg-gray-50/60 rounded-b-lg flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={vehicleId === '' || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Assigner
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Assign rider modal (from the vehicle side) ──────────────────────────────

const AssignRiderModal = ({
  isOpen,
  onClose,
  vehicle,
  riders,
  ridersLoading,
  onAssigned,
}: {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  riders: RiderWithVehicles[];
  ridersLoading: boolean;
  onAssigned: () => void;
}) => {
  const [riderId, setRiderId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState<'van_seller' | 'delivery_agent'>('van_seller');
  const { assign, loading } = useAssignVehicle();

  const handleSubmit = async () => {
    if (!vehicle || riderId === '') return;
    try {
      const res = await assign(vehicle.id, riderId, {
        starts_at: startsAt || undefined,
        notes: notes || undefined,
        role,
      });
      if (res.success) {
        toast.success(res.message || 'Livreur assigné');
        setRiderId('');
        setStartsAt('');
        setNotes('');
        setRole('van_seller');
        onAssigned();
        onClose();
      } else {
        toast.error(res.message || 'Assignation refusée');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Assigner un livreur${vehicle ? ` — ${vehicle.plate_number ?? vehicle.plate}` : ''}`} size="md">
      <div className="flex flex-col max-h-[80vh]">
        <div className="flex-1 overflow-y-auto px-5 pt-5 min-h-[120px]">
          {ridersLoading ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-xs">Chargement des livreurs...</span>
            </div>
          ) : riders.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 py-10 text-center text-gray-400">
              <UserCircle2 size={28} />
              <p className="text-sm font-medium">Aucun livreur sans véhicule</p>
            </div>
          ) : (
            <div className="space-y-2 pb-2">
              {riders.map((r) => {
                const isSelected = r.id === riderId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRiderId(r.id)}
                    className={`w-full text-left p-3 rounded-xl border-2 transition-all flex items-center gap-3 ${
                      isSelected ? 'border-sage-500 bg-sage-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-[10px] font-bold text-white shrink-0">
                      {initials(r.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-gray-800 truncate">{r.name}</div>
                      <div className="text-xs text-gray-500 truncate">{r.branch?.name ?? r.branch_code ?? '—'}</div>
                    </div>
                    <span
                      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
                        isSelected ? 'border-sage-500 bg-sage-500' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {riderId !== '' && (
            <div className="space-y-3 mt-4 pt-4 border-t border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Rôle</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as 'van_seller' | 'delivery_agent')}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  >
                    <option value="van_seller">Van seller</option>
                    <option value="delivery_agent">Delivery agent</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-600 mb-1">Début (optionnel)</label>
                  <input
                    type="datetime-local"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg"
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Notes (optionnel)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Ex : remplace intérim de Karim..."
                  className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
                />
              </div>
            </div>
          )}
        </div>
        <div className="px-5 py-4 mt-3 border-t border-gray-100 bg-gray-50/60 rounded-b-lg flex gap-2">
          <button
            onClick={handleSubmit}
            disabled={riderId === '' || loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Assigner
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Edit assignment modal (notes/ends_at/is_active on the current assignment) ───────────────

const EditAssignmentModal = ({
  isOpen,
  onClose,
  vehicle,
  onUpdated,
}: {
  isOpen: boolean;
  onClose: () => void;
  vehicle: Vehicle | null;
  onUpdated: () => void;
}) => {
  const [notes, setNotes] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [isActive, setIsActive] = useState(true);
  const { update, loading } = useUpdateAssignment();

  const endsAtIsPastOrNow = endsAt !== '' && new Date(endsAt).getTime() <= Date.now();

  const handleSubmit = async () => {
    if (!vehicle) return;
    try {
      // Only send `is_active` when the dispatcher actually unchecked it — `ends_at` only when a
      // date was actually entered. Sending these unconditionally on every edit (even a pure notes
      // change) risks the backend treating it as "end this assignment now", which is exactly what
      // looked like an automatic unassign before this fix.
      const res = await update(vehicle.id, {
        notes: notes || undefined,
        ends_at: endsAt || undefined,
        ...(isActive ? {} : { is_active: false }),
      });
      if (res.success) {
        toast.success(res.message || 'Assignation mise à jour');
        onUpdated();
        onClose();
      } else {
        toast.error(res.message || 'Échec de la mise à jour');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Modifier l'assignation${vehicle ? ` — ${vehicle.plate_number ?? vehicle.plate}` : ''}`} size="sm">
      <div className="px-5 py-5 space-y-3">
        <p className="text-xs text-gray-500 flex items-start gap-2">
          <Info size={13} className="text-blue-400 mt-0.5 shrink-0" />
          Modifie l'assignation active sans en créer une nouvelle — utile pour ajouter une note ou planifier une fin, sans réassigner le véhicule.
        </p>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
            <StickyNote size={12} /> Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Ex : Véhicule en panne, intervention prévue demain..."
            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg resize-none"
          />
        </div>
        <div>
          <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-600 mb-1">
            <Calendar size={12} /> Terminer l'assignation le (optionnel)
          </label>
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(e) => setEndsAt(e.target.value)}
            className={`w-full px-3 py-2 text-sm border rounded-lg ${endsAtIsPastOrNow ? 'border-red-300 bg-red-50' : 'border-gray-200'}`}
          />
          {endsAt ? (
            <p className={`text-xs mt-1.5 flex items-start gap-1.5 ${endsAtIsPastOrNow ? 'text-red-600 font-medium' : 'text-amber-600'}`}>
              <Info size={12} className="mt-0.5 shrink-0" />
              {endsAtIsPastOrNow
                ? "Cette date est déjà passée — le véhicule sera retiré du livreur dès l'enregistrement."
                : "Le véhicule restera assigné jusqu'à cette date, puis sera automatiquement retiré."}
            </p>
          ) : (
            <p className="text-xs text-gray-400 mt-1.5">Laisser vide pour ne pas toucher à la date de fin actuelle.</p>
          )}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} className="rounded" />
          Assignation active
          {!isActive && <span className="text-xs text-red-500 font-medium">— retirera le véhicule à l'enregistrement</span>}
        </label>

        <div className="flex gap-2 pt-2">
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white shadow-sm disabled:opacity-40 transition-colors"
          >
            {loading ? <Loader2 size={14} className="animate-spin" /> : <Pencil size={14} />}
            Enregistrer
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Annuler
          </button>
        </div>
      </div>
    </Modal>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

export const DispatcherFleetPage = () => {
  const [viewMode, setViewMode] = useState<'riders' | 'vehicles'>('riders');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [selectedVehicleId, setSelectedVehicleId] = useState<number | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showAssignRiderModal, setShowAssignRiderModal] = useState(false);
  const [editingAssignmentVehicle, setEditingAssignmentVehicle] = useState<Vehicle | null>(null);
  const [confirmUnassign, setConfirmUnassign] = useState<{ vehicle: Vehicle; riderName: string } | null>(null);

  const { data: riders, loading, refetch } = useRidersWithVehicles({
    search: search || undefined,
    status: statusFilter || undefined,
  });
  const { data: vehicles, loading: vehiclesLoading, refetch: refetchVehicles } = useFleetVehicles();

  const { toggle, loading: toggling } = useToggleRiderActive();
  const { unassign, loading: unassigning } = useUnassignVehicle();

  const selectedRider = useMemo(() => riders.find((r) => r.id === selectedId) ?? null, [riders, selectedId]);
  const riderByVehicleId = useMemo(() => {
    const map = new Map<number, RiderWithVehicles>();
    riders.forEach((r) => r.vehicles?.forEach((v) => map.set(v.id, r)));
    return map;
  }, [riders]);
  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === selectedVehicleId) ?? null, [vehicles, selectedVehicleId]);
  const selectedVehicleRider = selectedVehicleId != null ? riderByVehicleId.get(selectedVehicleId) : undefined;

  const assignedVehicleIds = useMemo(
    () => new Set(riders.flatMap((r) => r.vehicles?.map((v) => v.id) ?? [])),
    [riders]
  );
  const availableVehicles = useMemo(
    () => vehicles.filter((v) => !assignedVehicleIds.has(v.id)),
    [vehicles, assignedVehicleIds]
  );
  const ridersWithoutVehicle = useMemo(
    () => riders.filter((r) => !r.vehicles?.length),
    [riders]
  );

  const filteredVehicles = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.plate_number, v.plate, v.internal_code, v.make, v.model].some((f) => f?.toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  const handleToggleActive = async () => {
    if (!selectedRider) return;
    try {
      const res = await toggle(selectedRider.id);
      if (res.success) {
        toast.success(res.message || (res.is_active ? 'Livreur activé' : 'Livreur désactivé'));
        refetch();
      } else {
        toast.error(res.message || "Échec de l'action");
      }
    } catch (err) {
      toast.error(extractErrorMessage(err));
    }
  };

  const askUnassign = () => {
    const vehicle = selectedRider?.vehicles?.[0];
    if (!vehicle || !selectedRider || vehicle.has_active_shipments) return;
    setConfirmUnassign({ vehicle, riderName: selectedRider.name });
  };

  const askUnassignFromVehicle = () => {
    if (!selectedVehicle || !selectedVehicleRider || selectedVehicle.has_active_shipments) return;
    setConfirmUnassign({ vehicle: selectedVehicle, riderName: selectedVehicleRider.name });
  };

  const performUnassign = async () => {
    if (!confirmUnassign) return;
    try {
      const res = await unassign(confirmUnassign.vehicle.id);
      if (res.success) {
        toast.success(res.message || 'Véhicule retiré');
        refetch();
        refetchVehicles();
        setConfirmUnassign(null);
      } else {
        toast.error(res.message || 'Échec du retrait');
      }
    } catch (err) {
      toast.error(extractErrorMessage(err), { duration: 6000 });
    }
  };

  const leftContent = (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-sm font-bold text-gray-900 flex items-center gap-2">
          <UserCircle2 size={18} className="text-sage-600" /> Flotte & Livreurs
        </h1>

        <div className="flex gap-1 mt-3 p-1 bg-gray-100 rounded-lg">
          <button
            onClick={() => setViewMode('riders')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'riders' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <UserCircle2 size={13} /> Livreurs ({riders.length})
          </button>
          <button
            onClick={() => setViewMode('vehicles')}
            className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-md text-xs font-semibold transition-colors ${
              viewMode === 'vehicles' ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <Truck size={13} /> Véhicules ({vehicles.length})
          </button>
        </div>

        <div className="relative mt-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={viewMode === 'riders' ? 'Rechercher un livreur...' : 'Rechercher un véhicule...'}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-200 focus:border-sage-400 outline-none"
          />
        </div>
        {viewMode === 'riders' && (
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full mt-2 px-3 py-1.5 text-xs border border-gray-200 rounded-lg"
          >
            <option value="">Tous les statuts</option>
            <option value="approved">Actifs</option>
          </select>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
        {viewMode === 'riders' ? (
          loading ? (
            <div className="flex items-center justify-center h-32 text-gray-400">
              <Loader2 className="animate-spin" />
            </div>
          ) : riders.length === 0 ? (
            <p className="text-xs text-gray-400 italic text-center py-8">Aucun livreur trouvé</p>
          ) : (
            riders.map((r) => (
              <RiderRow key={r.id} rider={r} selected={r.id === selectedId} onClick={() => setSelectedId(r.id)} />
            ))
          )
        ) : vehiclesLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400">
            <Loader2 className="animate-spin" />
          </div>
        ) : filteredVehicles.length === 0 ? (
          <p className="text-xs text-gray-400 italic text-center py-8">Aucun véhicule trouvé</p>
        ) : (
          filteredVehicles.map((v) => (
            <VehicleRow
              key={v.id}
              vehicle={v}
              assignedRider={riderByVehicleId.get(v.id)}
              selected={v.id === selectedVehicleId}
              onClick={() => setSelectedVehicleId(v.id)}
            />
          ))
        )}
      </div>

      <div className="p-3 border-t border-gray-100">
        <button
          onClick={() => { refetch(); refetchVehicles(); }}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={12} /> Rafraîchir
        </button>
      </div>
    </div>
  );

  const vehicleDetailContent = !selectedVehicle ? (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <Truck size={56} className="text-gray-300 mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-1">Aucun véhicule sélectionné</h3>
      <p className="text-sm text-gray-500">Sélectionnez un véhicule pour voir ses détails et son livreur</p>
    </div>
  ) : (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Vehicle header card */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-slate-700 to-slate-900 shrink-0">
              <Truck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-gray-900">{selectedVehicle.plate_number ?? selectedVehicle.plate}</h2>
              <p className="text-sm text-gray-500">
                {[selectedVehicle.make, selectedVehicle.model, selectedVehicle.year].filter(Boolean).join(' · ') || '—'}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold uppercase tracking-wide">
              {selectedVehicle.type ?? 'véhicule'}
            </span>
            <ColdChainBadge vehicle={selectedVehicle} />
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Hash size={14} className="text-gray-400" /> {selectedVehicle.internal_code || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Fuel size={14} className="text-gray-400" /> {selectedVehicle.fuel_type || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Wrench size={14} className="text-gray-400" /> {selectedVehicle.status || '—'}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={14} className="text-gray-400" /> {selectedVehicle.branch_code || '—'}
          </div>
        </div>
      </div>

      {/* Capacities */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2 mb-3">
          <Gauge size={15} className="text-gray-400" /> Capacités
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <CapacityStat
            icon={Weight}
            label="Poids max"
            value={selectedVehicle.capacity_weight != null ? `${selectedVehicle.capacity_weight} kg` : (selectedVehicle.capacity_kg != null ? `${selectedVehicle.capacity_kg} kg` : '—')}
            secondaryLabel="Charge utile max"
            secondaryValue={selectedVehicle.payload_kg != null ? `${selectedVehicle.payload_kg} kg` : undefined}
          />
          <CapacityStat
            icon={Box}
            label="Volume max"
            value={selectedVehicle.capacity_volume != null ? `${selectedVehicle.capacity_volume} m³` : '—'}
            secondaryLabel={effectiveVolume(selectedVehicle) ? `Volume utile (Eff. ${effectiveVolume(selectedVehicle)!.pct}%)` : undefined}
            secondaryValue={effectiveVolume(selectedVehicle) ? `${effectiveVolume(selectedVehicle)!.value} m³` : undefined}
          />
          <CapacityStat
            icon={Ruler}
            label="Dimensions (L×l×H)"
            value={
              selectedVehicle.capacity_length != null
                ? `${selectedVehicle.capacity_length}×${selectedVehicle.capacity_width}×${selectedVehicle.capacity_height} m`
                : '—'
            }
          />
          <CapacityStat icon={Gauge} label="Efficacité chargement" value={selectedVehicle.loading_efficiency_ratio != null ? `${Math.round(selectedVehicle.loading_efficiency_ratio * 100)}%` : '—'} />
        </div>
      </div>

      {/* Assigned rider */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <UserCircle2 size={15} className="text-gray-400" /> Livreur assigné
          </h3>
          {!selectedVehicleRider && (
            <button
              onClick={() => setShowAssignRiderModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-500 text-white text-xs font-bold shadow-sm hover:bg-sage-600"
            >
              <Plus size={13} /> Assigner un livreur
            </button>
          )}
        </div>

        {selectedVehicleRider ? (
          <div className="rounded-2xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white">
                  {initials(selectedVehicleRider.name)}
                </div>
                <div>
                  <div className="text-sm font-bold text-gray-900">{selectedVehicleRider.name}</div>
                  <div className="text-xs text-gray-500">{selectedVehicleRider.phone || '—'}</div>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setEditingAssignmentVehicle(selectedVehicle)}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Pencil size={13} /> Modifier
                </button>
                <button
                  onClick={askUnassignFromVehicle}
                  disabled={unassigning || selectedVehicle.has_active_shipments}
                  title={selectedVehicle.has_active_shipments ? 'Impossible de retirer : BCH en cours' : undefined}
                  className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {unassigning ? <Loader2 size={13} className="animate-spin" /> : <X size={13} />}
                  Retirer
                </button>
              </div>
            </div>
            {selectedVehicle.has_active_shipments && (
              <div className="flex items-center gap-2 px-3 py-2 mt-3 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <AlertTriangle size={13} className="shrink-0" />
                BCH en cours sur ce véhicule — retrait impossible tant qu'il n'est pas terminé/annulé.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <UserX size={32} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-500">Aucun livreur assigné</p>
            <p className="text-xs text-gray-400 mt-1">Ce véhicule est disponible pour assignation.</p>
          </div>
        )}
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full overflow-y-auto bg-slate-50 p-6">
      {viewMode === 'vehicles' ? (
        vehicleDetailContent
      ) : !selectedRider ? (
        <div className="h-full flex flex-col items-center justify-center text-center">
          <UserCircle2 size={56} className="text-gray-300 mb-4" />
          <h3 className="text-lg font-semibold text-gray-700 mb-1">Aucun livreur sélectionné</h3>
          <p className="text-sm text-gray-500">Sélectionnez un livreur pour voir ses détails et son véhicule</p>
        </div>
      ) : (
        <div className="max-w-3xl mx-auto space-y-5">

          {/* Rider header card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div
                  className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${
                    selectedRider.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-300'
                  }`}
                >
                  {initials(selectedRider.name)}
                </div>
                <div>
                  <h2 className="text-lg font-bold text-gray-900">{selectedRider.name}</h2>
                  <div className="flex items-center gap-1.5 mt-1">
                    <span className={`w-1.5 h-1.5 rounded-full ${selectedRider.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                    <span className={`text-xs font-semibold ${selectedRider.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                      {selectedRider.is_active ? 'Actif' : 'Inactif'}
                    </span>
                  </div>
                </div>
              </div>
              <button
                onClick={handleToggleActive}
                disabled={toggling}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold shadow-sm transition-colors disabled:opacity-40 ${
                  selectedRider.is_active
                    ? 'bg-white border border-red-200 text-red-600 hover:bg-red-50'
                    : 'bg-emerald-600 text-white hover:bg-emerald-700'
                }`}
              >
                {toggling ? <Loader2 size={14} className="animate-spin" /> : <Power size={14} />}
                {selectedRider.is_active ? 'Désactiver' : 'Activer'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-50">
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Phone size={14} className="text-gray-400" /> {selectedRider.phone || '—'}
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600 truncate">
                <Mail size={14} className="text-gray-400 shrink-0" /> <span className="truncate">{selectedRider.email || '—'}</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <MapPin size={14} className="text-gray-400" /> {selectedRider.branch?.name ?? selectedRider.branch_code ?? '—'}
              </div>
            </div>
          </div>

          {/* Vehicle assignment */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2">
                <Gauge size={15} className="text-gray-400" /> Véhicule assigné
              </h3>
              {!selectedRider.vehicles?.[0] && (
                <button
                  onClick={() => setShowAssignModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sage-500 text-white text-xs font-bold shadow-sm hover:bg-sage-600"
                >
                  <Plus size={13} /> Assigner un véhicule
                </button>
              )}
            </div>

            {selectedRider.vehicles?.[0] ? (
              <VehicleCard
                vehicle={selectedRider.vehicles[0]}
                onUnassign={askUnassign}
                onEdit={() => setEditingAssignmentVehicle(selectedRider.vehicles[0])}
                unassigning={unassigning}
              />
            ) : (
              <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
                <PackageX size={32} className="text-gray-300 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">Aucun véhicule assigné</p>
                <p className="text-xs text-gray-400 mt-1">Ce livreur ne peut pas être affecté à un BCH tant qu'aucun véhicule n'est assigné.</p>
              </div>
            )}
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 p-3 rounded-lg bg-sage-50 border border-blue-100">
            <Info size={14} className="text-blue-500 mt-0.5 shrink-0" />
            <p className="text-xs text-blue-800 leading-relaxed">
              L'assignation véhicule↔livreur est indépendante du Bon de Chargement — assigner un véhicule ici le rend disponible dans les listes déroulantes de création BCH partout dans le module.
            </p>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      <AssignVehicleModal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        rider={selectedRider}
        vehicles={availableVehicles}
        vehiclesLoading={vehiclesLoading}
        onAssigned={() => { refetch(); refetchVehicles(); }}
      />
      <AssignRiderModal
        isOpen={showAssignRiderModal}
        onClose={() => setShowAssignRiderModal(false)}
        vehicle={selectedVehicle}
        riders={ridersWithoutVehicle}
        ridersLoading={loading}
        onAssigned={() => { refetch(); refetchVehicles(); }}
      />
      <EditAssignmentModal
        isOpen={editingAssignmentVehicle !== null}
        onClose={() => setEditingAssignmentVehicle(null)}
        vehicle={editingAssignmentVehicle}
        onUpdated={() => { refetch(); refetchVehicles(); }}
      />
      <ConfirmModal
        isOpen={confirmUnassign !== null}
        onClose={() => setConfirmUnassign(null)}
        onConfirm={performUnassign}
        title="Retirer le véhicule"
        message={
          confirmUnassign ? (
            <>
              Retirer <strong>{confirmUnassign.vehicle.plate_number ?? confirmUnassign.vehicle.plate}</strong> de{' '}
              <strong>{confirmUnassign.riderName}</strong> ? Le véhicule redeviendra disponible pour être assigné à un autre livreur.
            </>
          ) : (
            ''
          )
        }
        confirmText="Retirer"
        cancelText="Annuler"
        variant="danger"
        loading={unassigning}
      />
    </>
  );
};

export default DispatcherFleetPage;
