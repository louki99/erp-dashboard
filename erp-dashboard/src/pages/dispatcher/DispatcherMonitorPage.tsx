import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, FileText, Package, Truck, Navigation, CheckCircle2, LayoutGrid, AlertTriangle, XCircle } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { useDeliveryMissionsList } from '@/hooks/dispatcher/useDispatcherDeliveryMissions';
import type { DeliveryMission, DeliveryMissionStatus } from '@/types/dispatcher.types';

type Column = {
  key: string;
  label: string;
  icon: typeof FileText;
  statuses: DeliveryMissionStatus[];
};

// 2026-06-20: single Delivery Mission pipeline replaces the old DO/LOT split-pipeline board
// (docs §3, §8). draft → in_preparation → ready → in_transit → completed.
// cancelled is reachable from both draft (simple discard) and ready (full rollback: WT cancelled →
// BP cancelled → BLs soft-deleted → BCs revert to confirmed). 2026-06-25: cancel_delivery_mission
// now allowed from ready, so cancelled missions must have their own column or they vanish silently.
// awaiting_shortage_review added 2026-06-23 — without its own column these missions would simply
// not match any column's `statuses` and silently disappear from the board entirely (byColumn only
// buckets a mission if `COLUMNS.find(...)` finds a match).
const COLUMNS: Column[] = [
  { key: 'draft', label: 'Brouillon', icon: FileText, statuses: ['draft'] },
  { key: 'preparation', label: 'En préparation', icon: Package, statuses: ['in_preparation'] },
  { key: 'shortage_review', label: 'Rupture à examiner', icon: AlertTriangle, statuses: ['awaiting_shortage_review'] },
  { key: 'ready', label: 'Prêt', icon: Truck, statuses: ['ready'] },
  { key: 'transit', label: 'En transit', icon: Navigation, statuses: ['in_transit'] },
  { key: 'completed', label: 'Terminé', icon: CheckCircle2, statuses: ['completed'] },
  { key: 'cancelled', label: 'Annulé', icon: XCircle, statuses: ['cancelled'] },
];

const MissionCard = ({ m, onClick }: { m: DeliveryMission; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 mb-2 hover:border-blue-400 hover:shadow-sm transition-colors"
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-bold text-gray-800">{m.mission_number}</span>
      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{m.status}</span>
    </div>
    <div className="text-xs text-gray-500 flex items-center justify-between">
      <span>{m.rider?.name ?? 'Sans livreur'}</span>
      <span>{m.bl_count ?? m.delivery_notes?.length ?? 0} BL</span>
    </div>
  </button>
);

export const DispatcherMonitorPage = () => {
  const navigate = useNavigate();
  const { data: missions, loading, refetch } = useDeliveryMissionsList();

  const byColumn = useMemo(() => {
    const map = new Map<string, DeliveryMission[]>();
    COLUMNS.forEach((c) => map.set(c.key, []));
    missions.forEach((m) => {
      const col = COLUMNS.find((c) => c.statuses.includes(m.status));
      if (col) map.get(col.key)!.push(m);
    });
    return map;
  }, [missions]);

  const leftContent = (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <LayoutGrid size={16} className="text-sage-600" /> Moniteur Logistique
        </h1>
        <p className="text-xs text-gray-500 mt-1">Vue Kanban en lecture seule — {missions.length} mission(s)</p>
        <button
          onClick={refetch}
          className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-medium text-gray-600 hover:bg-gray-50"
        >
          <RefreshCw size={12} /> Rafraîchir
        </button>
      </div>

      <div className="p-4 border-b border-gray-100">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Résumé par colonne</h3>
        <div className="space-y-1.5">
          {COLUMNS.map((c) => {
            const count = byColumn.get(c.key)?.length ?? 0;
            const Icon = c.icon;
            return (
              <div key={c.key} className="flex items-center justify-between px-2 py-1.5 rounded bg-gray-50 text-xs">
                <span className="flex items-center gap-1.5 text-gray-600">
                  <Icon size={12} className="text-gray-400" /> {c.label}
                </span>
                <span className="font-semibold text-gray-800">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );

  const mainContent = (
    <div className="h-full overflow-hidden p-4 bg-gray-50">
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-gray-400 h-full">
          <Loader2 className="animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3 h-full min-w-[1400px]">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            const Icon = col.icon;
            const isShortageColumn = col.key === 'shortage_review';
            const isCancelledColumn = col.key === 'cancelled';
            return (
              <div key={col.key} className={`rounded-lg p-2 flex flex-col min-h-0 ${isShortageColumn ? 'bg-red-50' : isCancelledColumn ? 'bg-rose-50' : 'bg-gray-100'}`}>
                <div className="flex items-center justify-between px-1 py-1.5 mb-1">
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${isShortageColumn ? 'text-red-700' : isCancelledColumn ? 'text-rose-600' : 'text-gray-700'}`}>
                    <Icon size={13} className={isShortageColumn ? 'text-red-500' : isCancelledColumn ? 'text-rose-400' : 'text-gray-400'} /> {col.label}
                  </span>
                  <span className={`text-[10px] ${isShortageColumn && items.length > 0 ? 'font-bold text-red-600' : 'text-gray-500'}`}>{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-1">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic px-1">Aucun</p>
                  ) : (
                    items.map((m) => (
                      <MissionCard key={m.id} m={m} onClick={() => navigate('/dispatcher/workspace/missions')} />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  return <MasterLayout leftContent={leftContent} mainContent={mainContent} />;
};

export default DispatcherMonitorPage;
