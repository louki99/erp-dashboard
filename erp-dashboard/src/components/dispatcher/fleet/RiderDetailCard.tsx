import { Phone, Mail, MapPin, Truck, PackageX, AlertTriangle, Weight, Box, Snowflake, Activity } from 'lucide-react';

import type { RiderWithVehicles, Vehicle } from '@/types/dispatcher.types';

const initials = (name?: string) =>
  (name ?? '?').trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join('');

const effectiveVolume = (vehicle: Vehicle): { pct: number; value: number } | null => {
  if (vehicle.capacity_volume == null || vehicle.usable_volume_ratio == null || vehicle.loading_efficiency_ratio == null) return null;
  return {
    pct: Math.round(vehicle.usable_volume_ratio * 100),
    value: Math.round(vehicle.capacity_volume * vehicle.usable_volume_ratio * vehicle.loading_efficiency_ratio * 10) / 10,
  };
};

const typeEmoji = (type?: string | null) => {
  switch (type) {
    case 'van': return '🚐';
    case 'truck': return '🚛';
    case 'motorcycle': return '🏍️';
    default: return '🚐';
  }
};

interface RiderDetailCardProps {
  rider: RiderWithVehicles;
}

const Section = ({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wide flex items-center gap-2 mb-4">
      <Icon size={16} className="text-sage-600" /> {title}
    </h3>
    {children}
  </div>
);

const ContactItem = ({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value?: string | null }) => (
  <div className="flex items-center gap-3 rounded-xl bg-gray-50 border border-gray-100 p-3">
    <div className="w-9 h-9 rounded-lg bg-white border border-gray-100 flex items-center justify-center shrink-0">
      <Icon size={15} className="text-gray-500" />
    </div>
    <div className="min-w-0 flex-1">
      <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wide">{label}</div>
      <div className="text-sm font-semibold text-gray-800 truncate">{value || '—'}</div>
    </div>
  </div>
);

export const RiderDetailCard = ({ rider }: RiderDetailCardProps) => {
  const vehicle = rider.vehicles?.[0];

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Identity */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <div className="flex flex-col sm:flex-row sm:items-start gap-4">
          <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shrink-0 ${rider.is_active ? 'bg-gradient-to-br from-blue-500 to-indigo-600' : 'bg-gray-300'}`}>
            {initials(rider.name)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-bold text-gray-900">{rider.name}</h2>
              {rider.code && <span className="font-mono text-[11px] px-2 py-0.5 rounded-md bg-gray-100 text-gray-500 border border-gray-200">{rider.code}</span>}
            </div>
            <div className="flex items-center gap-1.5 mt-1.5">
              <span className={`w-2 h-2 rounded-full ${rider.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
              <span className={`text-xs font-bold ${rider.is_active ? 'text-emerald-600' : 'text-gray-500'}`}>
                {rider.is_active ? 'Actif' : 'Inactif'}
              </span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-5 pt-5 border-t border-gray-50">
          <ContactItem icon={Phone} label="Téléphone" value={rider.phone} />
          <ContactItem icon={Mail} label="Email" value={rider.email} />
          <ContactItem icon={MapPin} label="Agence" value={rider.branch?.name ?? rider.branch_code} />
        </div>
      </div>

      {/* Assigned vehicle */}
      <Section title="Véhicule assigné" icon={Truck}>
        {vehicle ? (
          <div className="rounded-2xl border border-emerald-200 bg-gradient-to-br from-emerald-50/80 to-white p-5">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-12 h-12 rounded-xl bg-emerald-600 shadow-sm flex items-center justify-center shrink-0 text-2xl">
                  {typeEmoji(vehicle.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-base font-bold text-gray-900 truncate">{vehicle.plate_number ?? vehicle.plate}</div>
                  <div className="text-xs text-gray-500 truncate">
                    {[vehicle.make, vehicle.model, vehicle.year].filter(Boolean).join(' · ') || vehicle.type}
                    {vehicle.internal_code ? ` · ${vehicle.internal_code}` : ''}
                  </div>
                </div>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <span className="px-2 py-1 rounded-full bg-emerald-100 text-emerald-700 text-[10px] font-bold uppercase tracking-wide border border-emerald-200">
                  {vehicle.type ?? 'véhicule'}
                </span>
                {vehicle.cold_chain_enabled === true && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-sky-50 text-sky-700 border border-sky-200">
                    <Snowflake size={10} className="mr-1" /> Froid
                  </span>
                )}
                {vehicle.cold_chain_enabled === false && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide bg-orange-50 text-orange-700 border border-orange-200">
                    Sec
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="rounded-xl bg-white border border-emerald-100 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <Weight size={12} /> Poids max
                </div>
                <div className="text-sm font-bold text-gray-800">
                  {vehicle.capacity_weight ?? vehicle.capacity_kg ?? vehicle.payload_kg ?? '—'}
                  {(vehicle.capacity_weight ?? vehicle.capacity_kg ?? vehicle.payload_kg) != null && <span className="text-xs text-gray-500 ml-1">kg</span>}
                </div>
              </div>
              <div className="rounded-xl bg-white border border-emerald-100 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <Box size={12} /> Volume max
                </div>
                <div className="text-sm font-bold text-gray-800">
                  {vehicle.capacity_volume ?? '—'}
                  {vehicle.capacity_volume != null && <span className="text-xs text-gray-500 ml-1">m³</span>}
                </div>
              </div>
              <div className="rounded-xl bg-white border border-emerald-100 p-3">
                <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase mb-1">
                  <Activity size={12} /> Volume utile
                </div>
                <div className="text-sm font-bold text-gray-800">
                  {effectiveVolume(vehicle)?.value ?? '—'}
                  {effectiveVolume(vehicle) && <span className="text-xs text-gray-500 ml-1">m³</span>}
                </div>
              </div>
            </div>

            {vehicle.has_active_shipments && (
              <div className="flex items-center gap-2 px-3 py-2 mt-4 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                <AlertTriangle size={13} className="shrink-0" /> Mission en cours sur ce véhicule — retrait impossible tant qu'elle n'est pas terminée.
              </div>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-gray-200 bg-white p-8 text-center">
            <PackageX size={36} className="text-gray-300 mx-auto mb-3" />
            <p className="text-sm font-semibold text-gray-500">Aucun véhicule assigné</p>
            <p className="text-xs text-gray-400 mt-1">Utilisez « Assigner un véhicule » dans le panneau d'actions.</p>
          </div>
        )}
      </Section>
    </div>
  );
};

export default RiderDetailCard;
