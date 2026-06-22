import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Loader2, AlertTriangle, RefreshCw, Package, AlertCircle,
  ChevronRight, TrendingDown, Info,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { useDispatcherShortageQueue } from '@/hooks/dispatcher/useDispatcherShortageQueue';
import type { PreparationOrder, BpStatus } from '@/types/dispatcher.types';

const BP_STATUS: Record<BpStatus, { label: string; color: string }> = {
  pending:                  { label: 'En attente',        color: 'bg-gray-100 text-gray-700' },
  in_progress:              { label: 'En cours',          color: 'bg-blue-100 text-blue-700' },
  completed_full:           { label: 'Complété',          color: 'bg-green-100 text-green-700' },
  completed_partial:        { label: 'Rupture partielle', color: 'bg-orange-100 text-orange-700' },
  shortage_accepted:        { label: 'Rupture acceptée',  color: 'bg-yellow-100 text-yellow-800' },
  awaiting_shortage_review: { label: 'À revoir',          color: 'bg-red-100 text-red-700' },
  rejected:                 { label: 'Rejeté',            color: 'bg-red-100 text-red-800' },
};

// ─── Shortage detail panel for a BP ────────────────────────────────────────────
// 2026-06-20: the old BCH-level "Save Balance" (manual/equal/fifo rebalancing across BLs sharing
// a BCH, via the `adjust_quantities` decision) has no delivery-mission equivalent — confirmed gap,
// not ported by backend (config/decisions.php's `delivery-mission` block explicitly notes this).
// This panel is read-only: it shows the BP's per-item shortage, but there's no in-app action to
// rebalance it anymore. The old per-BL `allocate_delivery_note` re-run workaround no longer
// applies either — it was removed 2026-06-22 in favor of the atomic, mission-level
// `confirm_delivery_mission` (docs §8, runs once per mission, not re-runnable per BL). Until
// backend adds a mission-level rebalance equivalent, this requires backend-side intervention.

const ShortageDetailPanel = ({
  bp,
  onClose,
}: {
  bp: PreparationOrder;
  onClose: () => void;
}) => {
  const [open, setOpen] = useState(true);
  const shortageItems = (bp.items ?? []).filter((i) => (i.shortage_quantity ?? 0) > 0);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 truncate">Ruptures — {bp.bp_number}</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                ⚠ Rupture
              </span>
            </div>
            {bp.mission && <p className="text-xs text-gray-400 mt-0.5">Mission {bp.mission.mission_number}</p>}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        <div className="flex items-start gap-2.5 p-3 rounded-lg bg-blue-50 border border-blue-100">
          <Info size={16} className="text-blue-500 mt-0.5 shrink-0" />
          <p className="text-xs text-blue-800 leading-relaxed">
            Le rééquilibrage manuel (égal / FIFO) entre BL n'est plus disponible — cette action
            n'a pas d'équivalent dans le nouveau pipeline Delivery Mission (gap confirmé côté
            backend). Vue lecture seule en attendant un endpoint de remplacement.
          </p>
        </div>

        {shortageItems.length === 0 ? (
          <div className="text-center py-12 text-gray-400">
            <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
            <p className="text-sm">Aucune ligne en rupture pour ce BP</p>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
              <TrendingDown className="w-4 h-4 shrink-0" />
              <span><strong>{shortageItems.length}</strong> ligne(s) en rupture dans ce BP</span>
            </div>

            <SageCollapsible
              title={`Lignes en rupture (${shortageItems.length})`}
              isOpen={open}
              onOpenChange={setOpen}
            >
              <div className="space-y-2 p-1">
                {shortageItems.map((item) => {
                  const rate = item.requested_quantity > 0
                    ? Math.round((item.shortage_quantity / item.requested_quantity) * 100)
                    : 0;
                  return (
                    <div key={item.id} className="bg-white border border-red-100 rounded-lg overflow-hidden px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="text-sm font-semibold text-gray-800">Produit #{item.product_id}</div>
                        <div className="shrink-0 text-right">
                          <div className={`text-base font-bold ${rate > 50 ? 'text-red-700' : 'text-orange-600'}`}>
                            -{item.shortage_quantity}
                          </div>
                          <div className="text-xs text-red-400">{rate}% de rupture</div>
                        </div>
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-1.5">
                        <span>Préparé: {item.prepared_quantity}</span>
                        <span>Demandé: {item.requested_quantity}</span>
                      </div>
                      {item.shortage_reason && (
                        <div className="text-xs text-gray-500 mt-1.5 italic">{item.shortage_reason}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </SageCollapsible>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherShortageQueuePage = () => {
  const [selected, setSelected] = useState<PreparationOrder | null>(null);

  const { data, loading, error, refetch } = useDispatcherShortageQueue();
  const allBps = data?.data ?? [];
  const shortageItems = allBps.filter((b) => (b.total_shortage_percentage ?? 0) > 0 || b.is_critical_shortage);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'bp_number',
      headerName: 'N° BP',
      width: 160,
      cellRenderer: (p: { value: string }) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      headerName: 'Mission',
      width: 150,
      valueGetter: (p) => (p.data as PreparationOrder | undefined)?.mission?.mission_number ?? '—',
    },
    {
      headerName: 'Statut',
      width: 130,
      valueGetter: (p) => {
        const status = (p.data as PreparationOrder | undefined)?.status;
        return status ? BP_STATUS[status]?.label ?? status : '—';
      },
    },
    {
      field: 'total_shortage_percentage',
      headerName: '% Rupture',
      width: 100,
      valueFormatter: (p: { value?: number }) => p.value != null ? `${p.value}%` : '—',
    },
    {
      field: 'shortage_acknowledged',
      headerName: 'Traité',
      width: 80,
      cellRenderer: (p: { value?: boolean }) =>
        p.value
          ? <span className="text-xs text-green-600 font-medium">Oui</span>
          : <span className="text-xs text-red-600 font-semibold">Non</span>,
    },
    {
      field: 'created_at',
      headerName: 'Depuis',
      width: 110,
      valueFormatter: (p: { value?: string }) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
    },
  ], []);

  return (
    <MasterLayout
      leftContent={
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
          <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-500" />
                <h1 className="text-sm font-bold text-gray-900">File de ruptures</h1>
              </div>
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${shortageItems.length > 0 ? 'bg-red-100 text-red-700' : 'bg-gray-100 text-gray-500'}`}>
                  {shortageItems.length}
                </span>
                <button onClick={refetch} className="p-1 rounded hover:bg-gray-100 transition-colors text-gray-400">
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {shortageItems.length > 0 && (
              <div className="flex items-center gap-2 px-3 py-2 bg-red-50 border border-red-100 rounded-lg text-xs text-red-600">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span><strong>{shortageItems.length}</strong> BP(s) en rupture</span>
              </div>
            )}
          </div>

          {error && (
            <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-b border-red-100 flex items-center gap-2">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          <div className="flex-1 min-h-0 p-2">
            <div className="bg-white rounded-lg border border-gray-200 h-full">
              {loading ? (
                <div className="h-full flex items-center justify-center text-gray-400 text-sm gap-2">
                  <Loader2 className="w-5 h-5 animate-spin" /> Chargement…
                </div>
              ) : shortageItems.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
                  <Package className="w-12 h-12 mb-3 opacity-30" />
                  <div className="text-sm font-medium text-gray-500">Aucune rupture active</div>
                  <div className="text-xs mt-1">Tous les BP sont équilibrés</div>
                </div>
              ) : (
                <DataGrid
                  rowData={shortageItems}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: PreparationOrder) => setSelected(row)}
                />
              )}
            </div>
          </div>
        </div>
      }
      mainContent={
        selected ? (
          <ShortageDetailPanel key={selected.id} bp={selected} onClose={() => setSelected(null)} />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <AlertTriangle className="w-14 h-14 text-amber-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">File de ruptures</h3>
              <p className="text-sm text-gray-400">Sélectionnez un BP pour voir le détail des ruptures</p>
            </div>
          </div>
        )
      }
    />
  );
};

export default DispatcherShortageQueuePage;
