import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, MapPinned, Package, CheckCircle2, X, Truck, Box, Weight, AlertTriangle, RefreshCw, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';

import { OrdersMapView, pointInPolygon } from '@/components/dispatcher/OrdersMapView';
import { SearchSelectDropdown } from '@/components/dispatcher/SearchSelectDropdown';
import { LoadCapacityBar } from '@/components/dispatcher/LoadCapacityBar';
import { computeMissionLoad } from '@/utils/missionLoad';
import { useDispatcherPendingOrders } from '@/hooks/dispatcher/useDispatcherOrders';
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
  const { data: pendingData, loading: ordersLoading, refetch: refetchOrders } = useDispatcherPendingOrders({ per_page: 200 });
  const orders = useMemo(() => pendingData?.data ?? [], [pendingData]);

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
          title="Rafraîchir"
        >
          <RefreshCw size={14} />
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
            />
          )}
        </div>

        {/* Selection / mission panel */}
        <div className="w-96 shrink-0 bg-white border-l border-gray-200 flex flex-col">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Package size={16} className="text-sage-600" />
            <h2 className="text-sm font-bold text-gray-900">{selectedOrderIds.length} sélectionnée(s)</h2>
          </div>
          {selectedOrderIds.length > 0 && (
            <button
              onClick={clearSelection}
              className="text-xs text-red-500 hover:text-red-700 font-medium flex items-center gap-1"
            >
              <X size={12} /> Vider
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {selectedOrders.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">
              Dessinez une zone sur la carte ou cliquez un pin pour ajouter des commandes
            </p>
          ) : (
            selectedOrders.map((o) => (
              <div key={o.id} className="flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg bg-emerald-50 border border-emerald-100">
                <div className="min-w-0">
                  <div className="text-xs font-mono font-semibold text-gray-800 truncate">{o.order_code}</div>
                  <div className="text-[11px] text-gray-500 truncate">{o.partner.name}</div>
                </div>
                <button
                  onClick={() => toggleOrder(o)}
                  className="p-1 rounded hover:bg-emerald-100 text-emerald-600 shrink-0"
                >
                  <X size={12} />
                </button>
              </div>
            ))
          )}
        </div>

        {/* Mission creation */}
        <div className="border-t border-gray-100 p-4 space-y-3">
          <SearchSelectDropdown
            label="Livreur"
            options={riders.map((r) => ({
              id: r.id,
              label: r.name,
              sublabel: r.vehicles.length === 0 ? 'Sans véhicule' : r.vehicles.length > 1 ? `${r.vehicles.length} véhicules` : (r.vehicles[0].display_name ?? r.vehicles[0].plate_number),
            }))}
            value={riderId}
            onChange={handleSelectRider}
            disabled={ridersLoading}
          />

          {riderId !== '' && riderVehicles.length === 0 && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
              <AlertTriangle size={14} className="shrink-0" /> Ce livreur n'a aucun véhicule assigné.
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
            <div className="p-3 rounded-lg bg-sage-50 border border-sage-100">
              <div className="flex items-center gap-2 mb-2">
                <Truck size={14} className="text-blue-500" />
                <span className="text-sm font-bold text-blue-900">
                  {selectedVehicle.display_name ?? selectedVehicle.plate_number ?? selectedVehicle.plate}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center gap-1.5 text-blue-700">
                  <Box size={12} /> <strong>{selectedVehicle.capacity_volume ?? '—'} m³</strong>
                </div>
                <div className="flex items-center gap-1.5 text-blue-700">
                  <Weight size={12} /> <strong>{selectedVehicle.payload_kg ?? selectedVehicle.capacity_weight ?? '—'} kg</strong>
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
            placeholder="Notes (optionnel)…"
            className="w-full border border-gray-300 rounded-lg px-2.5 py-2 text-sm"
          />

          <button
            onClick={() => setShowConfirm(true)}
            disabled={selectedOrderIds.length === 0 || riderId === '' || vehicleId === ''}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white shadow-sm disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <CheckCircle2 size={14} /> Créer la mission ({selectedOrderIds.length} BC)
          </button>
        </div>
      </div>
      </div>

      {/* Confirmation */}
      {showConfirm && (
        <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm mx-4 p-5">
            <h3 className="text-sm font-bold text-gray-900 mb-2">Confirmer la création de mission</h3>
            <p className="text-xs text-gray-500 mb-4">
              {selectedOrderIds.length} commande(s) seront regroupées en une mission, assignée à{' '}
              <strong>{selectedRider?.name}</strong> avec le véhicule{' '}
              <strong>{selectedVehicle?.display_name ?? selectedVehicle?.plate_number}</strong>.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleCreateMission}
                disabled={creating}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-semibold rounded-lg bg-sage-500 hover:bg-sage-600 text-white disabled:opacity-50"
              >
                {creating ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                Confirmer
              </button>
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2.5 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-100"
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
