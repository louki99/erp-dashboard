import { useMemo, useState } from 'react';
import { ArrowLeft, Loader2, Plus, Search, Truck, Weight, Box, Snowflake, X, Calendar, StickyNote, User } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAssignVehicle } from '@/hooks/dispatcher/useDispatcherFleet';
import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

interface AssignVehiclePanelProps {
  rider: RiderWithVehicles;
  vehicles: Vehicle[];
  vehiclesLoading: boolean;
  onBack: () => void;
  onAssigned: () => void;
}

const typeEmoji = (type?: string | null) => {
  switch (type) {
    case 'van': return '🚐';
    case 'truck': return '🚛';
    case 'motorcycle': return '🏍️';
    default: return '🚐';
  }
};

const roleOptions: { value: 'van_seller' | 'delivery_agent'; label: string }[] = [
  { value: 'van_seller', label: 'Van seller' },
  { value: 'delivery_agent', label: 'Delivery agent' },
];

const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none transition-all focus:ring-2 focus:ring-sage-200 focus:border-sage-400';

export const AssignVehiclePanel = ({ rider, vehicles, vehiclesLoading, onBack, onAssigned }: AssignVehiclePanelProps) => {
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState<'van_seller' | 'delivery_agent'>('van_seller');
  const [search, setSearch] = useState('');
  const { assign, loading } = useAssignVehicle();

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return vehicles;
    return vehicles.filter((v) =>
      [v.plate_number, v.plate, v.internal_code, v.make, v.model, v.type].some((f) => f?.toLowerCase().includes(q))
    );
  }, [vehicles, search]);

  const selectedVehicle = useMemo(() => vehicles.find((v) => v.id === vehicleId), [vehicles, vehicleId]);

  const submit = async () => {
    if (vehicleId === '') return;
    try {
      const res = await assign(vehicleId, rider.id, { starts_at: startsAt || undefined, notes: notes || undefined, role });
      if (res.success) { toast.success(res.message || 'Véhicule assigné'); onAssigned(); }
      else toast.error(res.message || 'Assignation refusée');
    } catch (err: unknown) {
      const message = err && typeof err === 'object' && 'response' in err
        ? (err.response as { data?: { message?: string } })?.data?.message
        : undefined;
      toast.error(message ?? "Échec de l'assignation", { duration: 6000 });
    }
  };

  return (
    <div className="h-full flex flex-col bg-slate-50/50">
      <div className="px-6 py-4 border-b border-gray-200 bg-white/90 backdrop-blur-md shrink-0 flex items-center gap-3 sticky top-0 z-10">
        <button onClick={onBack} title="Retour" className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center shrink-0 transition-colors">
          <ArrowLeft size={18} className="text-gray-500" />
        </button>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-bold text-gray-900 truncate">Assigner un véhicule</h2>
          <p className="text-xs text-gray-500 truncate">{rider.name}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Search */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className={labelCls}>Rechercher un véhicule</label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Plaque, code, marque, modèle, type..."
                className={`${inputCls} pl-10 pr-9`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Vehicle list */}
          <div className="space-y-3">
            {vehiclesLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs">Chargement des véhicules...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Truck size={36} />
                <p className="text-sm font-semibold">{search ? 'Aucun véhicule ne correspond' : 'Aucun véhicule disponible'}</p>
              </div>
            ) : (
              filtered.map((v) => {
                const isSelected = v.id === vehicleId;
                const weight = v.capacity_weight ?? v.capacity_kg ?? v.payload_kg;
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVehicleId(v.id)}
                    className={`w-full text-left rounded-2xl border-2 transition-all flex items-center gap-4 p-4 ${
                      isSelected
                        ? 'border-sage-500 bg-sage-50/60 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 text-xl ${isSelected ? 'bg-sage-500' : 'bg-gray-100'}`}>
                      {isSelected ? <Truck size={22} className="text-white" /> : <span>{typeEmoji(v.type)}</span>}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-gray-900 truncate">{v.plate_number ?? v.plate}</span>
                        <span className="px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[9px] font-bold uppercase tracking-wide shrink-0">
                          {v.type ?? '—'}
                        </span>
                        {v.cold_chain_enabled === true && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-100 text-sky-700 text-[9px] font-bold uppercase tracking-wide shrink-0">
                            <Snowflake size={9} className="mr-0.5" /> Froid
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-1.5 text-[11px] text-gray-500 flex-wrap">
                        {v.internal_code && <span className="font-mono text-gray-400">{v.internal_code}</span>}
                        {[v.make, v.model].filter(Boolean).length > 0 && <span className="truncate">{[v.make, v.model].filter(Boolean).join(' ')}</span>}
                        {weight != null && <span className="inline-flex items-center gap-0.5"><Weight size={10} /> {weight} kg</span>}
                        {v.capacity_volume != null && <span className="inline-flex items-center gap-0.5"><Box size={10} /> {v.capacity_volume} m³</span>}
                      </div>
                    </div>
                    <span className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center ${isSelected ? 'border-sage-500 bg-sage-500' : 'border-gray-300'}`}>
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Assignment settings */}
          {selectedVehicle && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
                <User size={16} className="text-sage-600" /> Paramètres d'assignation
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                <div>
                  <label className={labelCls}>Rôle</label>
                  <select value={role} onChange={(e) => setRole(e.target.value as 'van_seller' | 'delivery_agent')} className={`${inputCls} bg-white`}>
                    {roleOptions.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Début (optionnel)</label>
                  <div className="relative">
                    <Calendar size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={`${inputCls} pl-10`} />
                  </div>
                </div>
              </div>
              <div>
                <label className={labelCls}>Notes (optionnel)</label>
                <div className="relative">
                  <StickyNote size={16} className="absolute left-3.5 top-3 text-gray-400" />
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    placeholder="Ex : remplace intérim de Karim..."
                    className={`${inputCls} pl-10 resize-none`}
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-6 py-4 border-t border-gray-200 bg-white shrink-0 flex gap-3">
        <button
          onClick={submit}
          disabled={vehicleId === '' || loading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-emerald-700 rounded-xl shadow-sm hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Assigner le véhicule
        </button>
        <button onClick={onBack} className="px-5 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
};

export default AssignVehiclePanel;
