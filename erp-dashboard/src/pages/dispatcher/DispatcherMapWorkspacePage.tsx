import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPinned, CheckCircle2, X, Truck, Box, Weight, AlertTriangle, RefreshCw, ArrowLeft, Route, Users, DollarSign, LayoutList } from 'lucide-react';
import toast from 'react-hot-toast';

import { OrdersMapView, pointInPolygon } from '@/components/dispatcher/OrdersMapView';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { LoadCapacityBar } from '@/components/dispatcher/LoadCapacityBar';
import { computeMissionLoad } from '@/utils/missionLoad';
import { useLocalDispatcherOrders } from '@/hooks/dispatcher/useLocalDispatcherOrders';
import { useRidersWithVehicles } from '@/hooks/dispatcher/useDispatcherFleet';
import { useCreateDeliveryMission } from '@/hooks/dispatcher/useDispatcherDeliveryMissions';
import type { DispatcherOrder } from '@/types/dispatcher.types';

// ─── Dispatcher Map Workspace ───────────────────────────────────────────────────
// Geo-area-first BC → Mission flow: see all pending BCs plotted by partner GPS coordinates
// (partner.geo_lat/geo_lng, already on every order — docs §6), draw a zone to bulk-pick everything
// inside it, fine-tune with individual pin toggles, then create a mission directly from the map
// without leaving it. Complements the list-based DispatcherMissionWorkspacePage — same
// create_delivery_mission call underneath (docs §8.1), different selection ergonomics.

export const DispatcherMapWorkspacePage = () => {
  const navigate = useNavigate();
  const { orders, loading: ordersLoading, syncing, refetch: refetchOrders } = useLocalDispatcherOrders();

  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [riderId, setRiderId] = useState<number | ''>('');
  const [vehicleId, setVehicleId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);

  const { data: riders, loading: ridersLoading } = useRidersWithVehicles({ status: 'active' });
  const selectedRider = riders.find((r) => r.id === riderId);
  const riderVehicles = selectedRider?.vehicles ?? [];
  const selectedVehicle = riderVehicles.find((v) => v.id === vehicleId) ?? null;

  const handleSelectRider = (id: number | '') => {
    setRiderId(id);
    if (id === '') { setVehicleId(''); return; }
    const rider = riders.find((r) => r.id === id);
    const vs = rider?.vehicles ?? [];
    setVehicleId(vs.length === 1 ? vs[0].id : '');
  };

  const { create, loading: creating } = useCreateDeliveryMission();

  const selectedOrders = useMemo(
    () => orders.filter((o) => selectedOrderIds.includes(o.id)),
    [orders, selectedOrderIds]
  );

  const missionLoad = useMemo(() => computeMissionLoad(selectedOrders), [selectedOrders]);
  const totalAmount = useMemo(
    () => selectedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0),
    [selectedOrders],
  );

  const toggleOrder = (order: DispatcherOrder) => {
    setSelectedOrderIds((prev) =>
      prev.includes(order.id) ? prev.filter((x) => x !== order.id) : [...prev, order.id]
    );
  };

  // Freehand lasso bulk-picks every BC whose partner GPS falls inside the traced shape (precise
  // point-in-polygon, not just its bounding rectangle) — union with the existing selection, so
  // multiple shapes can be drawn in sequence to build up one mission.
  const handlePolygonChange = (polygon: Array<[number, number]> | null) => {
    if (!polygon) return;
    const inside = orders.filter((o) => {
      const lat = o.partner?.geo_lat != null ? Number(o.partner.geo_lat) : null;
      const lng = o.partner?.geo_lng != null ? Number(o.partner.geo_lng) : null;
      if (lat == null || lng == null) return false;
      return pointInPolygon([lat, lng], polygon);
    });
    if (inside.length === 0) {
      toast('Aucune commande dans cette zone', { icon: 'ℹ️' });
      return;
    }
    setSelectedOrderIds((prev) => Array.from(new Set([...prev, ...inside.map((o) => o.id)])));
    toast.success(`${inside.length} commande(s) ajoutée(s) à la sélection`);
  };

  const clearSelection = () => setSelectedOrderIds([]);

  const handleCreateMission = async () => {
    if (selectedOrderIds.length === 0) {
      toast.error('Sélectionnez au moins une commande sur la carte');
      return;
    }
    if (riderId === '' || vehicleId === '') {
      toast.error('Sélectionnez un livreur et un véhicule');
      return;
    }
    try {
      const res = await create({
        order_ids: selectedOrderIds,
        rider_id: riderId,
        vehicle_id: vehicleId,
        notes: notes || undefined,
      });
      if (res.success) {
        toast.success(res.message || 'Mission créée');
        setSelectedOrderIds([]);
        setRiderId('');
        setVehicleId('');
        setNotes('');
        setShowConfirm(false);
        refetchOrders();
      } else {
        toast.error(res.message || 'Échec de la création');
      }
    } catch (err) {
      const e = err as { response?: { data?: { message?: string; violations?: Array<{ reason: string }> } } };
      const violations = e?.response?.data?.violations;
      toast.error(
        violations?.length ? violations.map((v) => v.reason).join(' · ') : e?.response?.data?.message ?? 'Échec de la création',
        { duration: 6000 }
      );
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col overflow-hidden bg-slate-50">
      {/* Page header — not floated over the map, so it can't cover OrdersMapView's own toolbar
          (e.g. "Dessiner une zone") sitting at the very top of the map area. */}
      <div className="shrink-0 h-14 bg-white border-b border-gray-200 flex items-center gap-3 px-4 z-[500]">
        <button
          onClick={() => navigate('/dispatcher/workspace/missions')}
          title="Retour au workspace missions"
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"
        >
          <ArrowLeft size={18} />
        </button>
        <MapPinned size={16} className="text-sage-600" />
        <div>
          <div className="text-sm font-bold text-gray-900">Dispatcher Carte</div>
          <div className="text-[11px] text-gray-500">Dessinez une zone ou cliquez un pin pour sélectionner</div>
        </div>
        <button
          onClick={refetchOrders}
          className="ml-auto p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          title={syncing ? 'Synchronisation…' : 'Rafraîchir'}
        >
          <RefreshCw size={14} className={syncing ? 'animate-spin text-blue-400' : ''} />
        </button>
      </div>

      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* Map */}
        <div className="flex-1 min-w-0 relative">
          {ordersLoading ? (
            <div className="h-full flex items-center justify-center text-gray-400">
              <Loader2 className="w-8 h-8 animate-spin" />
            </div>
          ) : (
            <OrdersMapView
              orders={orders}
              selectedIds={selectedOrderIds}
              onToggleOrder={toggleOrder}
              onPolygonChange={handlePolygonChange}
              depot={{ lat: 33.5731, lng: -7.5898 }}
            />
          )}
        </div>

        {/* ── Mission Builder Panel ─────────────────────────────────────── */}
        <div className="w-[380px] shrink-0 bg-white border-l border-gray-200 flex flex-col overflow-hidden">

          {/* ① Fixed header */}
          <div className="shrink-0 px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                <Route size={14} className="text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-sm font-bold text-gray-900">Construire une mission</h2>
                <p className="text-[11px] text-gray-400">Sélectionnez des BCs sur la carte</p>
              </div>
              {selectedOrders.length > 0 && (
                <span className="text-[11px] font-bold text-blue-700 bg-blue-100 rounded-full px-2.5 py-0.5 shrink-0">
                  {selectedOrders.length} BC{selectedOrders.length > 1 ? 's' : ''}
                </span>
              )}
            </div>
          </div>

          {/* ② Fixed stats bar — compact single row */}
          {selectedOrders.length > 0 && (
            <div className="shrink-0 border-b border-blue-100 bg-blue-50 px-4 py-2">
              <div className="grid grid-cols-4 divide-x divide-blue-100 text-center">
                <div className="px-1">
                  <p className="text-sm font-bold text-blue-800 leading-none">{selectedOrders.length}</p>
                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide mt-0.5">BCs</p>
                </div>
                <div className="px-1">
                  <p className="text-sm font-bold text-blue-800 leading-none">{missionLoad.weightKg.toFixed(1)}</p>
                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide mt-0.5">kg</p>
                </div>
                <div className="px-1">
                  <p className="text-sm font-bold text-blue-800 leading-none">{missionLoad.volumeM3.toFixed(2)}</p>
                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide mt-0.5">m³</p>
                </div>
                <div className="px-1">
                  <p className="text-sm font-bold text-emerald-700 leading-none truncate">
                    {totalAmount > 0 ? totalAmount.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) : '—'}
                  </p>
                  <p className="text-[9px] font-semibold text-blue-400 uppercase tracking-wide mt-0.5">MAD</p>
                </div>
              </div>
            </div>
          )}

          {/* ③ Single scrollable body — orders + assignment form */}
          <div className="flex-1 overflow-y-auto min-h-0">

            {/* Empty state */}
            {selectedOrders.length === 0 && (
              <div className="flex flex-col items-center justify-center py-16 text-center px-6">
                <div className="p-5 bg-gray-50 rounded-2xl mb-4">
                  <MapPinned size={32} className="text-gray-200" />
                </div>
                <p className="text-sm font-semibold text-gray-500">Aucune commande sélectionnée</p>
                <p className="text-xs text-gray-400 mt-1.5 leading-relaxed">
                  Dessinez une zone sur la carte<br />ou cliquez directement sur un pin
                </p>
              </div>
            )}

            {/* Order list */}
            {selectedOrders.length > 0 && (
              <>
                <div className="sticky top-0 z-10 px-4 py-2 bg-white border-b border-gray-100 flex items-center justify-between shadow-[0_1px_4px_rgba(0,0,0,0.04)]">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                    <LayoutList size={10} /> Commandes
                  </span>
                  <button
                    onClick={clearSelection}
                    className="text-[11px] text-red-500 hover:text-red-700 font-semibold flex items-center gap-1 transition-colors"
                  >
                    <X size={10} /> Tout vider
                  </button>
                </div>

                <div className="px-3 pt-2 pb-1 space-y-1.5">
                  {selectedOrders.map((o) => {
                    const w   = Number(o.total_weight_kg) || 0;
                    const v   = Number(o.total_volume_m3) || 0;
                    const amt = Number(o.total_amount) || 0;
                    return (
                      <div
                        key={o.id}
                        className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-gray-50 border border-gray-100 hover:border-red-100 hover:bg-red-50/20 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded leading-none">
                              {o.order_code}
                            </span>
                            {amt > 0 && (
                              <span className="text-[10px] font-semibold text-emerald-600 ml-auto">
                                {amt.toLocaleString('fr-FR')} MAD
                              </span>
                            )}
                          </div>
                          <div className="text-xs font-semibold text-gray-800 truncate">{o.partner.name}</div>
                          {(w > 0 || v > 0) && (
                            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-400">
                              {w > 0 && <span className="flex items-center gap-0.5"><Weight size={9} />{w.toFixed(1)} kg</span>}
                              {v > 0 && <span className="flex items-center gap-0.5"><Box size={9} />{v.toFixed(2)} m³</span>}
                            </div>
                          )}
                        </div>
                        <button
                          onClick={() => toggleOrder(o)}
                          className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-100 shrink-0 transition-colors opacity-0 group-hover:opacity-100"
                          title="Retirer de la sélection"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </>
            )}

            {/* Assignment form — always visible, scrolls with orders */}
            <div className="px-4 pt-4 pb-3 border-t border-gray-100 mt-2">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
                <Users size={10} /> Assignation
              </p>

              <div className="space-y-3">
                <SearchSelectDropdown
                  label="Livreur"
                  options={riders.map((r) => ({
                    id: r.id,
                    label: r.name,
                    sublabel: r.vehicles.length === 0
                      ? 'Sans véhicule'
                      : r.vehicles.length > 1
                      ? `${r.vehicles.length} véhicules`
                      : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
                  }))}
                  value={riderId}
                  onChange={handleSelectRider}
                  disabled={ridersLoading}
                />

                {riderId !== '' && riderVehicles.length === 0 && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-700">
                    <AlertTriangle size={12} className="shrink-0" />
                    Ce livreur n'a aucun véhicule assigné.
                  </div>
                )}

                {riderVehicles.length > 1 && (
                  <SearchSelectDropdown
                    label="Véhicule"
                    options={riderVehicles.map((v) => ({
                      id: v.id,
                      label: v.display_name ?? v.plate_number ?? v.plate ?? `#${v.id}`,
                      sublabel: [v.make, v.model].filter(Boolean).join(' ') || undefined,
                    }))}
                    value={vehicleId}
                    onChange={setVehicleId}
                  />
                )}

                {selectedVehicle && (
                  <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100">
                    <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
                      <Truck size={13} className="text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-bold text-blue-900 truncate">
                        {selectedVehicle.display_name ?? selectedVehicle.plate_number ?? selectedVehicle.plate}
                      </div>
                      <div className="flex items-center gap-3 mt-0.5 text-[10px] text-blue-500 font-medium">
                        <span className="flex items-center gap-0.5"><Box size={9} />{selectedVehicle.capacity_volume ?? '—'} m³</span>
                        <span className="flex items-center gap-0.5"><Weight size={9} />{selectedVehicle.payload_kg ?? selectedVehicle.capacity_weight ?? '—'} kg</span>
                      </div>
                    </div>
                  </div>
                )}

                {selectedOrderIds.length > 0 && selectedVehicle && (
                  <LoadCapacityBar estimate={missionLoad} vehicle={selectedVehicle} />
                )}

                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes pour le livreur (optionnel)…"
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-800 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-200 bg-white"
                />
              </div>
            </div>
          </div>

          {/* ④ Fixed create button — always pinned at bottom */}
          <div className="shrink-0 px-4 py-3 border-t border-gray-200 bg-white">
            <button
              onClick={() => setShowConfirm(true)}
              disabled={selectedOrderIds.length === 0 || riderId === '' || vehicleId === ''}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle2 size={15} />
              Créer la mission
              {selectedOrderIds.length > 0 && (
                <span className="ml-1 bg-white/20 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                  {selectedOrderIds.length} BC{selectedOrderIds.length > 1 ? 's' : ''}
                </span>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 overflow-hidden">
            {/* Modal header */}
            <div className="px-5 pt-5 pb-4 border-b border-gray-100">
              <div className="flex items-center gap-3 mb-1">
                <div className="p-2 bg-blue-50 rounded-xl">
                  <Route size={16} className="text-blue-600" />
                </div>
                <h3 className="text-sm font-bold text-gray-900">Confirmer la mission</h3>
              </div>
            </div>

            {/* Mission summary */}
            <div className="px-5 py-4 space-y-3">
              <div className="grid grid-cols-3 gap-2 text-center py-2 bg-gray-50 rounded-xl">
                <div>
                  <p className="text-lg font-bold text-gray-900">{selectedOrderIds.length}</p>
                  <p className="text-[10px] text-gray-400 uppercase">BCs</p>
                </div>
                <div className="border-x border-gray-200">
                  <p className="text-lg font-bold text-gray-900">{missionLoad.weightKg.toFixed(1)}</p>
                  <p className="text-[10px] text-gray-400 uppercase">kg</p>
                </div>
                <div>
                  <p className="text-lg font-bold text-gray-900">{missionLoad.volumeM3.toFixed(2)}</p>
                  <p className="text-[10px] text-gray-400 uppercase">m³</p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-blue-50 border border-blue-100 text-sm">
                <Truck size={14} className="text-blue-500 shrink-0" />
                <div className="min-w-0">
                  <span className="font-semibold text-blue-900">{selectedRider?.name}</span>
                  <span className="text-blue-400 mx-1.5">·</span>
                  <span className="text-blue-600 text-xs">{selectedVehicle?.display_name ?? selectedVehicle?.plate_number}</span>
                </div>
              </div>

              {totalAmount > 0 && (
                <p className="text-center text-xs text-gray-500">
                  Valeur totale :{' '}
                  <strong className="text-gray-800">
                    {totalAmount.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MAD
                  </strong>
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="px-5 pb-5 flex gap-2">
              <button
                onClick={handleCreateMission}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 transition-colors"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                {creating ? 'Création…' : 'Créer la mission'}
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 text-sm font-semibold text-gray-600 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DispatcherMapWorkspacePage;
