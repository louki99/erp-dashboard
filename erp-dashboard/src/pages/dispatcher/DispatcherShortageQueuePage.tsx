import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
  Loader2, AlertTriangle, RefreshCw, Scale, Package, Clock, AlertCircle,
  ChevronRight, TrendingDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { useDispatcherBonChargementsList, useDispatcherBchBalance } from '@/hooks/dispatcher/useDispatcherBonChargements';
import type { PreparationOrder, BpStatus } from '@/types/dispatcher.types';

// ─── We list BCHs that have_shortage = true and show their balance analysis ───

const BP_STATUS: Record<BpStatus, { label: string; color: string }> = {
  pending:                  { label: 'En attente',        color: 'bg-gray-100 text-gray-700' },
  in_progress:              { label: 'En cours',          color: 'bg-blue-100 text-blue-700' },
  completed_full:           { label: 'Complété',          color: 'bg-green-100 text-green-700' },
  completed_partial:        { label: 'Rupture partielle', color: 'bg-orange-100 text-orange-700' },
  shortage_accepted:        { label: 'Rupture acceptée',  color: 'bg-yellow-100 text-yellow-800' },
  awaiting_shortage_review: { label: 'À revoir',          color: 'bg-red-100 text-red-700' },
  partial_rework_requested: { label: 'Retravail demandé', color: 'bg-purple-100 text-purple-700' },
  shortage_split_done:      { label: 'Réparti',           color: 'bg-teal-100 text-teal-700' },
  rejected:                 { label: 'Rejeté',            color: 'bg-red-100 text-red-800' },
};

// ─── Balance detail panel for a BCH in shortage ───────────────────────────────

const ShortageDetailPanel = ({
  bchId,
  shipmentNumber,
  onClose,
  onNavigateToBch,
}: {
  bchId: number;
  shipmentNumber: string;
  onClose: () => void;
  onNavigateToBch: (id: number) => void;
}) => {
  const { data: balance, loading, error } = useDispatcherBchBalance(bchId);
  const [open, setOpen] = useState(true);

  return (
    <div className="h-full flex flex-col bg-white">
      <div className="px-5 py-4 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
            <ChevronRight className="w-4 h-4 text-gray-500 rotate-180" />
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 truncate">Ruptures — {shipmentNumber}</h2>
              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700 border border-red-200">
                ⚠ Rupture
              </span>
            </div>
          </div>
          <button
            onClick={() => onNavigateToBch(bchId)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors shrink-0"
          >
            <Scale className="w-3.5 h-3.5" />
            Équilibrer dans BCH
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
        {loading && (
          <div className="flex items-center justify-center gap-2 py-12 text-gray-400 text-sm">
            <Loader2 className="w-5 h-5 animate-spin" /> Chargement de l'analyse…
          </div>
        )}
        {error && (
          <div className="flex items-center gap-2 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0" /> {error}
          </div>
        )}
        {!loading && balance && (
          <>
            {balance.products.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Package className="w-10 h-10 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Aucune rupture détectée pour ce BCH</p>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
                  <TrendingDown className="w-4 h-4 shrink-0" />
                  <span><strong>{balance.products.length}</strong> produit(s) en rupture dans ce BCH</span>
                </div>

                <SageCollapsible
                  title={`Produits en rupture (${balance.products.length})`}
                  isOpen={open}
                  onOpenChange={setOpen}
                >
                  <div className="space-y-3 p-1">
                    {balance.products.map((product) => {
                      const shortageRate = product.total_requested > 0
                        ? Math.round((product.shortage / product.total_requested) * 100)
                        : 0;
                      return (
                        <div key={product.product_id} className="bg-white border border-red-100 rounded-lg overflow-hidden">
                          <div className="px-4 py-3 bg-red-50 border-b border-red-100">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="text-sm font-bold text-red-900">{product.product_name}</div>
                                <div className="text-xs text-red-500 mt-0.5">{product.sku}</div>
                              </div>
                              <div className="shrink-0 text-right">
                                <div className={`text-lg font-bold ${shortageRate > 50 ? 'text-red-700' : 'text-orange-600'}`}>
                                  -{product.shortage}
                                </div>
                                <div className="text-xs text-red-400">{shortageRate}% de rupture</div>
                              </div>
                            </div>
                            {/* Progress bar */}
                            <div className="mt-2 h-1.5 bg-red-100 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${shortageRate > 50 ? 'bg-red-500' : 'bg-orange-400'}`}
                                style={{ width: `${Math.min(100 - shortageRate, 100)}%` }}
                              />
                            </div>
                            <div className="flex justify-between text-xs text-red-400 mt-1">
                              <span>Préparé: {product.total_prepared}</span>
                              <span>Demandé: {product.total_requested}</span>
                            </div>
                          </div>

                          <div className="divide-y divide-gray-50">
                            <div className="grid grid-cols-5 px-4 py-1.5 bg-gray-50 text-xs text-gray-500 font-medium">
                              <div className="col-span-2">BL</div>
                              <div className="text-center">Demandé</div>
                              <div className="text-center text-blue-600">Égal</div>
                              <div className="text-center text-purple-600">FIFO</div>
                            </div>
                            {product.requesting_bls.map((bl) => (
                              <div key={bl.bl_id} className="grid grid-cols-5 px-4 py-2.5 items-center text-xs">
                                <div className="col-span-2 min-w-0">
                                  <div className="font-mono font-semibold text-gray-800 truncate">{bl.delivery_number}</div>
                                  <div className="text-gray-400 truncate">{bl.partner_name}</div>
                                </div>
                                <div className="text-center font-semibold text-gray-700">{bl.requested}</div>
                                <div className="text-center font-bold text-blue-700">{bl.suggested_equal}</div>
                                <div className="text-center font-bold text-purple-700">{bl.suggested_fifo}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </SageCollapsible>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ─── Page ──────────────────────────────────────────────────────────────────────

export const DispatcherShortageQueuePage = () => {
  const navigate = useNavigate();
  const [selected, setSelected] = useState<{ id: number; shipment_number: string } | null>(null);

  // Get BCHs that have shortage — filtering by status that would have shortages
  const { data, loading, error, refetch } = useDispatcherBonChargementsList({
    status: 'in_preparation',
  });

  const allBchs = data?.bch?.data ?? [];
  const shortageItems = allBchs.filter((b) => b.has_shortage);

  const columnDefs = useMemo<ColDef[]>(() => [
    {
      field: 'shipment_number',
      headerName: 'N° BCH',
      width: 200,
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs font-semibold text-gray-800">{p.value}</span>
      ),
    },
    {
      field: 'rider.name',
      headerName: 'Livreur',
      flex: 1,
      minWidth: 120,
      valueFormatter: (p: any) => p.value ?? '—',
    },
    {
      field: 'delivery_notes_count',
      headerName: 'BLs',
      width: 65,
    },
    {
      field: 'shortage_acknowledged',
      headerName: 'Traité',
      width: 80,
      cellRenderer: (p: any) =>
        p.value
          ? <span className="text-xs text-green-600 font-medium">Oui</span>
          : <span className="text-xs text-red-600 font-semibold">Non</span>,
    },
    {
      field: 'created_at',
      headerName: 'Depuis',
      width: 110,
      valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleDateString('fr-FR') : '—',
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
                <span><strong>{shortageItems.length}</strong> BCH(s) nécessitent un rééquilibrage</span>
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
              ) : shortageItems.length === 0 && !loading ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 px-6">
                  <Package className="w-12 h-12 mb-3 opacity-30" />
                  <div className="text-sm font-medium text-gray-500">Aucune rupture active</div>
                  <div className="text-xs mt-1">Tous les BCH sont équilibrés</div>
                </div>
              ) : (
                <DataGrid
                  rowData={shortageItems}
                  columnDefs={columnDefs}
                  loading={false}
                  onRowSelected={(row: any) => setSelected({ id: row.id, shipment_number: row.shipment_number })}
                />
              )}
            </div>
          </div>
        </div>
      }
      mainContent={
        selected ? (
          <ShortageDetailPanel
            key={selected.id}
            bchId={selected.id}
            shipmentNumber={selected.shipment_number}
            onClose={() => setSelected(null)}
            onNavigateToBch={(id) => navigate(`/dispatcher/bons-chargements?bch=${id}`)}
          />
        ) : (
          <div className="h-full flex items-center justify-center bg-slate-50">
            <div className="text-center space-y-3">
              <AlertTriangle className="w-14 h-14 text-amber-200 mx-auto" />
              <h3 className="text-base font-semibold text-gray-500">File de ruptures</h3>
              <p className="text-sm text-gray-400">Sélectionnez un BCH pour analyser les ruptures et lancer le rééquilibrage</p>
            </div>
          </div>
        )
      }
    />
  );
};
