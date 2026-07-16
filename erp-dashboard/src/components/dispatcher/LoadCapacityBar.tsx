import { AlertTriangle, Box, Clock, Weight } from 'lucide-react';
import type { Vehicle } from '@/types/dispatcher.types';
import type { MissionLoadEstimate } from '@/utils/missionLoad';

const barColor  = (pct: number) => (pct > 100 ? 'bg-red-500'   : pct >= 80 ? 'bg-amber-500' : 'bg-emerald-500');
const textColor = (pct: number) => (pct > 100 ? 'text-red-700' : pct >= 80 ? 'text-amber-700' : 'text-emerald-700');

const Bar = ({
  icon,
  label,
  value,
  capacity,
  unit,
}: {
  icon:     React.ReactNode;
  label:    string;
  value:    number;
  capacity?: number | null;
  unit:     string;
}) => {
  if (!capacity) return null;
  const pct = (value / capacity) * 100;
  return (
    <div>
      <div className="flex items-center justify-between text-xs mb-1">
        <span className="flex items-center gap-1.5 text-gray-600 font-medium">{icon} {label}</span>
        <span className={`font-bold ${textColor(pct)}`}>
          {value.toFixed(2)} / {capacity} {unit} ({Math.round(pct)}%)
        </span>
      </div>
      <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor(pct)}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
      {pct > 100 && (
        <p className="text-[11px] text-red-600 font-medium mt-1 flex items-center gap-1">
          <AlertTriangle size={11} /> Dépasse la capacité du véhicule
        </p>
      )}
    </div>
  );
};

// Capacity bar for the Dispatcher mission workspace.
// Uses pre-computed order-header totals (total_weight_kg / total_volume_m3) via the
// CalculateDocumentPhysicalMetrics queued job — no per-product resolution at request time
// (§20.4 of 15-dispatcher.md, 2026-07-17 refactor).
export const LoadCapacityBar = ({
  estimate,
  vehicle,
}: {
  estimate: MissionLoadEstimate;
  vehicle:  Vehicle | null;
}) => {
  if (!vehicle) return null;
  const hasAnyCapacity = vehicle.capacity_volume || vehicle.payload_kg || vehicle.capacity_weight;
  if (!hasAnyCapacity) return null;

  return (
    <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 space-y-3">
      <Bar icon={<Box size={12} />}    label="Volume" value={estimate.volumeM3} capacity={vehicle.capacity_volume}                      unit="m³" />
      <Bar icon={<Weight size={12} />} label="Poids"  value={estimate.weightKg} capacity={vehicle.payload_kg ?? vehicle.capacity_weight} unit="kg" />

      {estimate.dataIncomplete && (
        <div className="flex items-start gap-2 px-2.5 py-2 rounded-md bg-amber-50 border border-amber-200">
          <Clock size={13} className="shrink-0 mt-0.5 text-amber-600" />
          <div className="text-[11px] text-amber-700 leading-snug">
            <strong>{estimate.incompleteOrderIds.length} BC</strong> en attente de calcul poids/volume
            (job asynchrone pas encore exécuté). L'estimation ci-dessus est partielle — planifier quand
            même ou patienter quelques secondes et rafraîchir.
          </div>
        </div>
      )}
    </div>
  );
};

export default LoadCapacityBar;
