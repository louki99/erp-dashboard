import { Hash, Fuel, Wrench, MapPin, UserCircle2, UserX, Weight, Box, Ruler, Gauge, Snowflake, AlertTriangle, Activity } from 'lucide-react';

import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

const effectiveVolume = (vehicle: Vehicle): { pct: number; value: number } | null => {
  if (vehicle.capacity_volume == null || vehicle.usable_volume_ratio == null || vehicle.loading_efficiency_ratio == null) return null;
  return {
    pct: Math.round(vehicle.usable_volume_ratio * 100),
    value: Math.round(vehicle.capacity_volume * vehicle.usable_volume_ratio * vehicle.loading_efficiency_ratio * 10) / 10,
  };
};

const statusMeta = (status?: string | null) => {
  switch (status) {
    case 'active': return { label: 'Actif', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    case 'maintenance': return { label: 'En maintenance', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
    case 'retired': return { label: 'Retiré', cls: 'bg-gray-100 text-gray-600 border-gray-200' };
    default: return { label: status || 'Actif', cls: 'bg-slate-100 text-slate-700 border-slate-200' };
  }
};

const typeEmoji = (type?: string | null) => {
  switch (type) {
    case 'van': return '🚐';
    case 'truck': return '🚛';
    case 'motorcycle': return '🏍️';
    default: return '🚐';
  }
};

const initials = (name?: string) =>
  (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

interface VehicleDetailCardProps {
  vehicle: Vehicle;
  assignedRider?: RiderWithVehicles;
}

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
      <Icon size={16} className="text-sage-600" /> {title}
    </h3>
    {children}
  </div>
);

const Stat = ({ icon: Icon, label, value, unit, highlight }: { icon: React.ElementType; label: string; value?: string | number | null; unit?: string; highlight?: boolean }) => (
  <div className={`rounded-xl p-4 border ${highlight ? 'bg-sage-50/50 border-sage-100' : 'bg-gray-50 border-gray-100'}`}>
    <div className="flex items-center gap-2 mb-2">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${highlight ? 'bg-sage-100' : 'bg-white border border-gray-100'}`}>
        <Icon size={15} className={highlight ? 'text-sage-600' : 'text-gray-500'} />
      </div>
      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</span>
    </div>
    <div className="text-lg font-bold text-gray-900">
      {value != null && value !== '' ? value : '—'}
      {value != null && value !== '' && unit && <span className="text-sm font-semibold text-gray-500 ml-1">{unit}</span>}
    </div>
  </div>
);

export const VehicleDetailCard = ({ vehicle, assignedRider }: VehicleDetailCardProps) => {
  const status = statusMeta(vehicle.status);
  const ev = effectiveVolume(vehicle);
  const weight = vehicle.capacity_weight ?? vehicle.capacity_kg ?? vehicle.payload_kg;

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-900 flex items-center justify-center shrink-0 text-2xl">
              {typeEmoji(vehicle.type)}
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold text-gray-900 truncate">{vehicle.plate_number ?? vehicle.plate ?? '—'}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || '—'}
              </p>
              <div className="flex flex-wrap items-center gap-2 mt-2">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${status.cls}`}>
                  <Activity size={11} className="mr-1" /> {status.label}
                </span>
                {vehicle.cold_chain_enabled === true && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 border border-sky-200">
                    <Snowflake size={11} className="mr-1" /> Chaîne du froid
                  </span>
                )}
                {vehicle.cold_chain_enabled === false && (
                  <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200">
                    Sec / Non-Réfrigéré
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-5 border-t border-gray-50">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Hash size={15} className="text-gray-400" />
            <span className="truncate">{vehicle.internal_code || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Fuel size={15} className="text-gray-400" />
            <span className="capitalize">{vehicle.fuel_type || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Wrench size={15} className="text-gray-400" />
            <span className="capitalize">{vehicle.status || '—'}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <MapPin size={15} className="text-gray-400" />
            <span className="truncate">{vehicle.branch_code || '—'}</span>
          </div>
        </div>
      </div>

      {/* Capacities */}
      <Section title="Capacités" icon={Gauge}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Stat icon={Weight} label="Poids max" value={weight} unit="kg" highlight />
          <Stat icon={Box} label="Volume max" value={vehicle.capacity_volume} unit="m³" />
          <Stat
            icon={Box}
            label={ev ? `Volume utile (${ev.pct}%)` : 'Volume utile'}
            value={ev?.value}
            unit="m³"
          />
          <Stat
            icon={Ruler}
            label="Dimensions"
            value={vehicle.capacity_length != null ? `${vehicle.capacity_length}×${vehicle.capacity_width}×${vehicle.capacity_height}` : null}
            unit="m"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-gray-500 uppercase tracking-wide">Volume utilisable</span>
              <span className="font-bold text-sage-700">
                {vehicle.usable_volume_ratio != null ? `${Math.round(vehicle.usable_volume_ratio * 100)}%` : '—'}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-500 rounded-full transition-all"
                style={{ width: `${Math.round((vehicle.usable_volume_ratio ?? 0) * 100)}%` }}
              />
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
            <div className="flex items-center justify-between text-xs mb-2">
              <span className="font-bold text-gray-500 uppercase tracking-wide">Efficacité chargement</span>
              <span className="font-bold text-sage-700">
                {vehicle.loading_efficiency_ratio != null ? `${Math.round(vehicle.loading_efficiency_ratio * 100)}%` : '—'}
              </span>
            </div>
            <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-sage-500 rounded-full transition-all"
                style={{ width: `${Math.round((vehicle.loading_efficiency_ratio ?? 0) * 100)}%` }}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Rider */}
      <Section title="Livreur assigné" icon={UserCircle2}>
        {assignedRider ? (
          <div className="flex items-center gap-4 rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-white p-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-sm font-bold text-white shrink-0">
              {initials(assignedRider.name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-gray-900 truncate">{assignedRider.name}</div>
              <div className="text-xs text-gray-500">{assignedRider.phone || '—'}</div>
            </div>
            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${assignedRider.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
              {assignedRider.is_active ? 'Actif' : 'Inactif'}
            </span>
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <UserX size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">Aucun livreur assigné</p>
            <p className="text-xs text-gray-400 mt-1">Ce véhicule est disponible pour assignation.</p>
          </div>
        )}
      </Section>

      {vehicle.has_active_shipments && (
        <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-800">
          <AlertTriangle size={16} className="shrink-0 text-amber-600" />
          <div>
            <span className="font-bold">Mission en cours</span>
            <span className="block text-amber-700/80">Ce véhicule est lié à une mission active — retrait impossible tant qu'elle n'est pas terminée.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default VehicleDetailCard;
