import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw, FileText, Package, Truck, Navigation, CheckCircle2, LayoutGrid } from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { useDispatcherDeliveryOrdersList } from '@/hooks/dispatcher/useDispatcherDeliveryOrders';
import type { DeliveryOrder, DoStatus } from '@/types/dispatcher.types';

type Column = {
  key: string;
  label: string;
  icon: typeof FileText;
  statuses: DoStatus[];
};

// Two separate, non-intersecting pipelines share these columns (docs §2, confirmed by backend
// 2026-06-16): Pipeline 1 (LOT path: allocated/partially_allocated/validated) and Pipeline 2
// (Dispatch V2: optimized/in_preparation/prepared/ready_for_loading). This board is read-only
// monitoring, so bucketing both into the same column is fine, but each card is tagged P1/P2 so
// dispatchers don't mistake a DO's stage for the other pipeline's equivalent stage.
const COLUMNS: Column[] = [
  { key: 'draft', label: 'Draft DOs', icon: FileText, statuses: ['draft', 'pending_allocation'] },
  { key: 'preparation', label: 'En préparation', icon: Package, statuses: ['allocated', 'partially_allocated', 'optimized', 'in_preparation'] },
  { key: 'ready', label: 'Chargé / Prêt', icon: Truck, statuses: ['validated', 'prepared', 'ready_for_loading'] },
  { key: 'transit', label: 'En transit', icon: Navigation, statuses: ['dispatched'] },
  { key: 'delivered', label: 'Livré', icon: CheckCircle2, statuses: [] },
];

const PIPELINE_2_ONLY_STATUSES: DoStatus[] = ['optimized', 'in_preparation', 'prepared', 'ready_for_loading', 'dispatched'];
const PIPELINE_1_ONLY_STATUSES: DoStatus[] = ['allocated', 'partially_allocated', 'validated'];

const PipelineTag = ({ status }: { status: DoStatus }) => {
  if (PIPELINE_1_ONLY_STATUSES.includes(status)) {
    return <span className="px-1 py-0.5 rounded bg-sky-100 text-sky-700 text-[9px] font-bold">LOT</span>;
  }
  if (PIPELINE_2_ONLY_STATUSES.includes(status)) {
    return <span className="px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">V2</span>;
  }
  return null;
};

const DoCard = ({ d, onClick }: { d: DeliveryOrder; onClick: () => void }) => (
  <button
    onClick={onClick}
    className="w-full text-left bg-white border border-gray-200 rounded-lg p-3 mb-2 hover:border-blue-400 hover:shadow-sm transition-colors"
  >
    <div className="flex items-center justify-between mb-1">
      <span className="text-sm font-bold text-gray-800 flex items-center gap-1.5">
        {d.do_number}
        <PipelineTag status={d.status} />
      </span>
      <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium">{d.status}</span>
    </div>
    <div className="text-xs text-gray-500 flex items-center justify-between">
      <span>{d.delivery_zone || 'Sans zone'}</span>
      <span>{d.orders_count} BC</span>
    </div>
  </button>
);

export const DispatcherMonitorPage = () => {
  const navigate = useNavigate();
  const { data, loading, refetch } = useDispatcherDeliveryOrdersList({});

  const dos = useMemo(() => data?.data ?? [], [data]);

  const byColumn = useMemo(() => {
    const map = new Map<string, DeliveryOrder[]>();
    COLUMNS.forEach((c) => map.set(c.key, []));
    dos.forEach((d) => {
      const col = COLUMNS.find((c) => c.statuses.includes(d.status));
      if (col) map.get(col.key)!.push(d);
    });
    return map;
  }, [dos]);

  const leftContent = (
    <div className="h-full bg-white flex flex-col">
      <div className="p-4 border-b border-gray-100">
        <h1 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <LayoutGrid size={16} className="text-blue-600" /> Moniteur Logistique
        </h1>
        <p className="text-xs text-gray-500 mt-1">Vue Kanban en lecture seule — {dos.length} DO</p>
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

      <div className="p-4">
        <h3 className="text-xs font-semibold text-gray-600 mb-2">Légende pipeline</h3>
        <div className="space-y-1.5 text-xs text-gray-600">
          <div className="flex items-center gap-2">
            <span className="px-1 py-0.5 rounded bg-sky-100 text-sky-700 text-[9px] font-bold">LOT</span>
            Pipeline 1 — chemin LOT (allocation groupée)
          </div>
          <div className="flex items-center gap-2">
            <span className="px-1 py-0.5 rounded bg-indigo-100 text-indigo-700 text-[9px] font-bold">V2</span>
            Pipeline 2 — Dispatch V2 (par DO)
          </div>
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
        <div className="grid grid-cols-5 gap-3 h-full min-w-[1000px]">
          {COLUMNS.map((col) => {
            const items = byColumn.get(col.key) ?? [];
            const Icon = col.icon;
            return (
              <div key={col.key} className="bg-gray-100 rounded-lg p-2 flex flex-col min-h-0">
                <div className="flex items-center justify-between px-1 py-1.5 mb-1">
                  <span className="text-xs font-bold text-gray-700 flex items-center gap-1.5">
                    <Icon size={13} className="text-gray-400" /> {col.label}
                  </span>
                  <span className="text-[10px] text-gray-500">{items.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto px-1">
                  {items.length === 0 ? (
                    <p className="text-[11px] text-gray-400 italic px-1">Aucun</p>
                  ) : (
                    items.map((d) => (
                      <DoCard key={d.id} d={d} onClick={() => navigate('/dispatcher/delivery-orders')} />
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
