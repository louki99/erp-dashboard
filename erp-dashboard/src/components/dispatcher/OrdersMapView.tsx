/**
 * OrdersMapView
 * ─────────────────────────────────────────────────────────────────────────────
 * Leaflet map for the dispatcher orders page:
 *  • One pin per order that has GPS coordinates
 *  • Blue pin  = unassigned (no delivery_order_id)
 *  • Gray pin  = already in a DO
 *  • Click pin → select that order
 *  • "Dessiner une zone" mode: two clicks define a bounding rectangle;
 *    the component calls onBboxChange with the 4 corners so the parent
 *    can send lat_min/max/lng_min/max to the API
 *  • Clear button resets the drawn rectangle
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Rectangle, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, LatLngBounds } from 'leaflet';
import L from 'leaflet';
import { MousePointer2, Trash2 } from 'lucide-react';

import markerIconPng   from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import type { DispatcherOrder } from '@/types/dispatcher.types';

// Fix default Leaflet icon paths broken by bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl:      markerIconPng,
    iconRetinaUrl: markerIcon2xPng,
    shadowUrl:    markerShadowPng,
});

// ─── Custom icons ─────────────────────────────────────────────────────────────

const makeIcon = (color: string, selected = false) =>
    L.divIcon({
        className: '',
        iconSize: [28, 28],
        iconAnchor: [14, 28],
        popupAnchor: [0, -30],
        html: `
      <div style="
        width:28px;height:28px;border-radius:50% 50% 50% 0;
        background:${color};transform:rotate(-45deg);
        border:2px solid ${selected ? '#f59e0b' : 'white'};
        box-shadow:0 2px 6px rgba(0,0,0,.35);
      "></div>`,
    });

const ICON_UNASSIGNED = makeIcon('#4f46e5');
const ICON_UNASSIGNED_SEL = makeIcon('#4f46e5', true);
const ICON_ASSIGNED   = makeIcon('#9ca3af');
const ICON_ASSIGNED_SEL = makeIcon('#9ca3af', true);

// ─── Map click handler ────────────────────────────────────────────────────────

interface BboxState {
    corner1: [number, number] | null;
    corner2: [number, number] | null;
}

interface MapClickHandlerProps {
    drawing: boolean;
    bbox: BboxState;
    onBboxUpdate: (b: BboxState) => void;
}

const MapClickHandler = ({ drawing, bbox, onBboxUpdate }: MapClickHandlerProps) => {
    useMapEvents({
        click(e) {
            if (!drawing) return;
            const pt: [number, number] = [e.latlng.lat, e.latlng.lng];
            if (!bbox.corner1) {
                onBboxUpdate({ corner1: pt, corner2: null });
            } else {
                onBboxUpdate({ corner1: bbox.corner1, corner2: pt });
            }
        },
    });
    return null;
};

// ─── Exported bbox type ───────────────────────────────────────────────────────

export interface MapBbox {
    lat_min: number;
    lat_max: number;
    lng_min: number;
    lng_max: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OrdersMapViewProps {
    orders: DispatcherOrder[];
    selectedId: number | null;
    onSelectOrder: (order: DispatcherOrder) => void;
    onBboxChange: (bbox: MapBbox | null) => void;
}

// Morocco-centric default view
const DEFAULT_CENTER: [number, number] = [31.7917, -7.0926];
const DEFAULT_ZOOM = 6;

export const OrdersMapView = ({
    orders,
    selectedId,
    onSelectOrder,
    onBboxChange,
}: OrdersMapViewProps) => {
    const mapRef = useRef<LeafletMap | null>(null);
    const [drawing, setDrawing] = useState(false);
    const [bbox, setBbox] = useState<BboxState>({ corner1: null, corner2: null });

    // When both corners are set, emit to parent
    useEffect(() => {
        if (bbox.corner1 && bbox.corner2) {
            const [lat1, lng1] = bbox.corner1;
            const [lat2, lng2] = bbox.corner2;
            onBboxChange({
                lat_min: Math.min(lat1, lat2),
                lat_max: Math.max(lat1, lat2),
                lng_min: Math.min(lng1, lng2),
                lng_max: Math.max(lng1, lng2),
            });
            setDrawing(false);
        }
    }, [bbox.corner1, bbox.corner2]);

    const handleBboxUpdate = (b: BboxState) => {
        setBbox(b);
    };

    const clearBbox = () => {
        setBbox({ corner1: null, corner2: null });
        onBboxChange(null);
        setDrawing(false);
    };

    // Auto-fit to markers when orders change
    useEffect(() => {
        if (!mapRef.current) return;
        const pts = orders
            .filter((o) => o.partner?.geo_lat && o.partner?.geo_lng)
            .map((o) => [Number(o.partner.geo_lat), Number(o.partner.geo_lng)] as [number, number]);
        if (pts.length > 0) {
            mapRef.current.fitBounds(L.latLngBounds(pts), { padding: [40, 40], maxZoom: 13 });
        }
    }, [orders.length]);

    const hasBbox = !!(bbox.corner1 && bbox.corner2);
    const rectBounds: LatLngBounds | null = hasBbox
        ? L.latLngBounds(bbox.corner1!, bbox.corner2!)
        : null;

    const ordersWithGps = orders.filter(
        (o) => o.partner?.geo_lat != null && o.partner?.geo_lng != null,
    );
    const ordersNoGps = orders.length - ordersWithGps.length;

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
                <button
                    onClick={() => {
                        if (hasBbox) { clearBbox(); return; }
                        setDrawing((d) => !d);
                        setBbox({ corner1: null, corner2: null });
                    }}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        drawing
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : hasBbox
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                >
                    {hasBbox ? (
                        <><Trash2 className="w-3.5 h-3.5" /> Effacer zone</>
                    ) : drawing ? (
                        <><MousePointer2 className="w-3.5 h-3.5" /> {bbox.corner1 ? 'Cliquez le 2ᵉ coin' : 'Cliquez le 1ᵉʳ coin'}</>
                    ) : (
                        <><MousePointer2 className="w-3.5 h-3.5" /> Dessiner une zone</>
                    )}
                </button>

                <span className="text-xs text-gray-400 ml-auto">
                    {ordersWithGps.length} pin{ordersWithGps.length !== 1 ? 's' : ''}
                    {ordersNoGps > 0 && ` · ${ordersNoGps} sans GPS`}
                </span>

                <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Non assigné
                </span>
                <span className="flex items-center gap-1 text-xs text-gray-500">
                    <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" /> En DO
                </span>
            </div>

            {/* Map */}
            <div className={`flex-1 min-h-0 ${drawing ? 'cursor-crosshair' : ''}`}>
                <MapContainer
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    className="h-full w-full"
                    ref={mapRef}
                >
                    <TileLayer
                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    />

                    <MapClickHandler
                        drawing={drawing}
                        bbox={bbox}
                        onBboxUpdate={handleBboxUpdate}
                    />

                    {rectBounds && (
                        <Rectangle
                            bounds={rectBounds}
                            pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0.08 }}
                        />
                    )}

                    {ordersWithGps.map((order) => {
                        const lat = Number(order.partner.geo_lat);
                        const lng = Number(order.partner.geo_lng);
                        const isAssigned = !!(order.logistics_details?.delivery_order_id);
                        const isSel = order.id === selectedId;
                        const icon = isAssigned
                            ? (isSel ? ICON_ASSIGNED_SEL : ICON_ASSIGNED)
                            : (isSel ? ICON_UNASSIGNED_SEL : ICON_UNASSIGNED);

                        return (
                            <Marker
                                key={order.id}
                                position={[lat, lng]}
                                icon={icon}
                                eventHandlers={{ click: () => onSelectOrder(order) }}
                            >
                                <Popup>
                                    <div className="text-xs leading-snug min-w-[160px]">
                                        <div className="font-bold text-indigo-700 mb-1">{order.order_code}</div>
                                        <div className="font-medium text-gray-800">{order.partner.name}</div>
                                        <div className="text-gray-500">{order.partner.city}</div>
                                        {order.partner.delivery_zone && (
                                            <div className="mt-1 text-indigo-600 font-medium">{order.partner.delivery_zone}</div>
                                        )}
                                        <div className="mt-1 font-semibold text-gray-700">
                                            {Number(order.total_amount).toLocaleString('fr-FR')} MAD
                                        </div>
                                        {isAssigned && (
                                            <div className="mt-1 text-amber-600 font-semibold">⚠ Déjà en DO</div>
                                        )}
                                    </div>
                                </Popup>
                            </Marker>
                        );
                    })}
                </MapContainer>
            </div>
        </div>
    );
};
