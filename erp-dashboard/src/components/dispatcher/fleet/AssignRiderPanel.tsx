import { useState } from 'react';
import { ArrowLeft, Loader2, Plus, Search, Truck, UserCircle2, X, Calendar, StickyNote } from 'lucide-react';
import toast from 'react-hot-toast';

import { useAssignVehicle } from '@/hooks/dispatcher/useDispatcherFleet';
import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

interface AssignRiderPanelProps {
  vehicle: Vehicle;
  riders: RiderWithVehicles[];
  ridersLoading: boolean;
  onBack: () => void;
  onAssigned: () => void;
}

const initials = (name?: string) =>
  (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const roleOptions: { value: 'van_seller' | 'delivery_agent'; label: string }[] = [
  { value: 'van_seller', label: 'Van seller' },
  { value: 'delivery_agent', label: 'Delivery agent' },
];

const labelCls = 'block text-[11px] font-bold text-gray-500 uppercase tracking-wide mb-1.5';
const inputCls = 'w-full px-3.5 py-2.5 text-sm text-gray-800 bg-white border border-gray-200 rounded-xl outline-none transition-all focus:ring-2 focus:ring-sage-200 focus:border-sage-400';

export const AssignRiderPanel = ({ vehicle, riders, ridersLoading, onBack, onAssigned }: AssignRiderPanelProps) => {
  const [riderId, setRiderId] = useState<number | ''>('');
  const [startsAt, setStartsAt] = useState('');
  const [notes, setNotes] = useState('');
  const [role, setRole] = useState<'van_seller' | 'delivery_agent'>('van_seller');
  const [search, setSearch] = useState('');
  const { assign, loading } = useAssignVehicle();

  const filtered = riders.filter((r) => {
    const q = search.trim().toLowerCase();
    if (!q) return true;
    return [r.name, r.code, r.phone, r.email].some((f) => f?.toLowerCase().includes(q));
  });

  const selectedRider = riders.find((r) => r.id === riderId);

  const submit = async () => {
    if (riderId === '') return;
    try {
      const res = await assign(vehicle.id, riderId, { starts_at: startsAt || undefined, notes: notes || undefined, role });
      if (res.success) { toast.success(res.message || 'Livreur assigné'); onAssigned(); }
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
          <h2 className="text-base font-bold text-gray-900 truncate">Assigner un livreur</h2>
          <p className="text-xs text-gray-500 truncate">{vehicle.plate_number ?? vehicle.plate}</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-3xl mx-auto space-y-5">
          {/* Search */}
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <label className={labelCls}>Rechercher un livreur</label>
            <div className="relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Nom, matricule, téléphone, email..."
                className={`${inputCls} pl-10 pr-9`}
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X size={15} />
                </button>
              )}
            </div>
          </div>

          {/* Rider list */}
          <div className="space-y-3">
            {ridersLoading ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <Loader2 size={24} className="animate-spin" />
                <span className="text-xs">Chargement des livreurs...</span>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-100 shadow-sm">
                <UserCircle2 size={36} />
                <p className="text-sm font-semibold">{search ? 'Aucun livreur ne correspond' : 'Aucun livreur disponible'}</p>
              </div>
            ) : (
              filtered.map((r) => {
                const isSelected = r.id === riderId;
                return (
                  <button
                    key={r.id}
                    type="button"
                    onClick={() => setRiderId(r.id)}
                    className={`w-full text-left rounded-2xl border-2 transition-all flex items-center gap-4 p-4 ${
                      isSelected
                        ? 'border-sage-500 bg-sage-50/60 shadow-sm'
                        : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                    }`}
                  >
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0 ${isSelected ? 'bg-sage-500' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>
                      {isSelected ? <UserCircle2 size={22} className="text-white" /> : initials(r.name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-gray-900 truncate">{r.name}</span>
                        {r.code && <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-md bg-gray-100 text-gray-500">{r.code}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[11px] text-gray-500 flex-wrap">
                        {r.phone && <span>{r.phone}</span>}
                        <span>{r.branch?.name ?? r.branch_code ?? '—'}</span>
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
          {selectedRider && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-in fade-in slide-in-from-bottom-2 duration-200">
              <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
                <Truck size={16} className="text-sage-600" /> Paramètres d'assignation
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
          disabled={riderId === '' || loading}
          className="flex-1 flex items-center justify-center gap-2 px-5 py-3 text-sm font-bold text-white bg-emerald-700 rounded-xl shadow-sm hover:bg-emerald-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
          Assigner le livreur
        </button>
        <button onClick={onBack} className="px-5 py-3 text-sm font-semibold text-gray-700 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
          Annuler
        </button>
      </div>
    </div>
  );
};

export default AssignRiderPanel;
