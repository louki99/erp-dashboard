/**
 * OrdersMapView
 * ─────────────────────────────────────────────────────────────────────────────
 * Leaflet map for the dispatcher orders page:
 *  • One pin per order that has GPS coordinates
 *  • Blue pin  = unassigned (DO concept removed — all pending orders render unassigned now)
 *  • Gray pin  = unused since the DO removal, kept for future mission-assignment styling
 *  • Click pin → select that order
 *  • "Dessiner une zone" mode: freehand lasso — click, hold, drag to trace a custom shape,
 *    release to close the polygon. The component calls onPolygonChange with the raw traced
 *    points (precise point-in-polygon selection) and onBboxChange with the shape's bounding
 *    rectangle (kept for callers — e.g. DispatcherOrdersPage's server-side lat/lng query — that
 *    only need a rectangular filter, not a true polygon).
 *  • Clear button resets the drawn shape
 */

import { useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polygon, Polyline, useMap, useMapEvents } from 'react-leaflet';
import MarkerClusterGroup from 'react-leaflet-cluster';
import type { Map as LeafletMap } from 'leaflet';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MousePointer2, Trash2, Plus, Check } from 'lucide-react';

import markerIconPng   from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';
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
// Multi-select mode (DispatcherMapWorkspacePage) — emerald instead of amber-ringed indigo, so a
// "picked for this mission" pin is visually distinct from the single-select "currently viewing"
// pin used elsewhere (DispatcherOrdersPage).
const ICON_PICKED = makeIcon('#059669');

// ─── Point-in-polygon (ray casting) ────────────────────────────────────────────
// Exported so callers that want precise selection (not just the bounding rectangle) can re-test
// individual points themselves if needed.
export const pointInPolygon = (point: [number, number], polygon: Array<[number, number]>): boolean => {
    const [py, px] = point;
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        const [yi, xi] = polygon[i];
        const [yj, xj] = polygon[j];
        const intersect = (yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
        if (intersect) inside = !inside;
    }
    return inside;
};

// ─── Freehand lasso draw handler ───────────────────────────────────────────────
// Leaflet's own mousedown handler initiates a map pan/drag by default — that has to be disabled
// while in draw mode (see MapDragToggle below) or this component never sees mousemove events at
// all while the button is held. Points are sampled by screen-space distance (not lat/lng) so the
// lasso looks equally smooth at any zoom level, and so a stationary mouse doesn't spam the array.
const MIN_POINT_SPACING_PX = 6;

interface FreehandDrawHandlerProps {
    active: boolean;
    onPointAdd: (pt: [number, number]) => void;
    onStart: () => void;
    onEnd: () => void;
}

const FreehandDrawHandler = ({ active, onPointAdd, onStart, onEnd }: FreehandDrawHandlerProps) => {
    const isPointerDownRef = useRef(false);
    const lastScreenPtRef = useRef<{ x: number; y: number } | null>(null);

    const map = useMapEvents({
        mousedown(e) {
            if (!active) return;
            isPointerDownRef.current = true;
            lastScreenPtRef.current = map.latLngToContainerPoint(e.latlng);
            onStart();
            onPointAdd([e.latlng.lat, e.latlng.lng]);
        },
        mousemove(e) {
            if (!active || !isPointerDownRef.current) return;
            const screenPt = map.latLngToContainerPoint(e.latlng);
            const last = lastScreenPtRef.current;
            if (last) {
                const dx = screenPt.x - last.x;
                const dy = screenPt.y - last.y;
                if (Math.sqrt(dx * dx + dy * dy) < MIN_POINT_SPACING_PX) return;
            }
            lastScreenPtRef.current = screenPt;
            onPointAdd([e.latlng.lat, e.latlng.lng]);
        },
        mouseup() {
            if (!active || !isPointerDownRef.current) return;
            isPointerDownRef.current = false;
            onEnd();
        },
    });

    return null;
};

// Disables map panning while a freehand shape is being traced — otherwise Leaflet consumes the
// mousedown/drag for its own panning instead of letting FreehandDrawHandler see the stroke.
const MapDragToggle = ({ active }: { active: boolean }) => {
    const map = useMap();
    useEffect(() => {
        if (active) map.dragging.disable();
        else map.dragging.enable();
        return () => { map.dragging.enable(); };
    }, [active, map]);
    return null;
};

// ─── Exported bbox type ───────────────────────────────────────────────────────
// Kept for callers that only need a rectangular server-side filter (e.g. DispatcherOrdersPage's
// lat_min/max, lng_min/max query params) — derived from the freehand polygon's bounding box.

export interface MapBbox {
    lat_min: number;
    lat_max: number;
    lng_min: number;
    lng_max: number;
}

// ─── Main component ───────────────────────────────────────────────────────────

interface OrdersMapViewProps {
    orders: DispatcherOrder[];
    onBboxChange?: (bbox: MapBbox | null) => void;
    // Precise selection — the raw freehand-traced polygon, for callers that do point-in-polygon
    // filtering themselves instead of a rectangular bbox (DispatcherMapWorkspacePage).
    onPolygonChange?: (polygon: Array<[number, number]> | null) => void;
    // Single-select mode (DispatcherOrdersPage) — clicking a pin selects that one order.
    selectedId?: number | null;
    onSelectOrder?: (order: DispatcherOrder) => void;
    // Multi-select mode (DispatcherMapWorkspacePage) — pins render a "Sélectionner" toggle inside
    // their popup instead of selecting on click, so the popup's info stays readable on click
    // without immediately closing/reopening on every toggle.
    selectedIds?: number[];
    onToggleOrder?: (order: DispatcherOrder) => void;
}

// Morocco-centric default view
const DEFAULT_CENTER: [number, number] = [31.7917, -7.0926];
const DEFAULT_ZOOM = 6;

export const OrdersMapView = ({
    orders,
    selectedId = null,
    onSelectOrder,
    selectedIds,
    onToggleOrder,
    onBboxChange,
    onPolygonChange,
}: OrdersMapViewProps) => {
    const multiMode = selectedIds != null;
    const mapRef = useRef<LeafletMap | null>(null);
    const [drawMode, setDrawMode] = useState(false);
    const [isTracing, setIsTracing] = useState(false);
    const [path, setPath] = useState<Array<[number, number]>>([]);

    const hasShape = path.length >= 3;

    const finishShape = () => {
        setIsTracing(false);
        if (path.length < 3) { setPath([]); return; }
        setDrawMode(false);

        const lats = path.map((p) => p[0]);
        const lngs = path.map((p) => p[1]);
        onBboxChange?.({
            lat_min: Math.min(...lats),
            lat_max: Math.max(...lats),
            lng_min: Math.min(...lngs),
            lng_max: Math.max(...lngs),
        });
        onPolygonChange?.(path);
    };

    const clearShape = () => {
        setPath([]);
        setDrawMode(false);
        setIsTracing(false);
        onBboxChange?.(null);
        onPolygonChange?.(null);
    };

    const toggleDrawMode = () => {
        if (hasShape) { clearShape(); return; }
        setDrawMode((d) => !d);
        setPath([]);
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

    const ordersWithGps = orders.filter(
        (o) => o.partner?.geo_lat != null && o.partner?.geo_lng != null,
    );
    const ordersNoGps = orders.length - ordersWithGps.length;

    return (
        <div className="h-full flex flex-col">
            {/* Toolbar */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0">
                <button
                    onClick={toggleDrawMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        isTracing
                            ? 'bg-amber-500 text-white'
                            : hasShape
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : drawMode
                            ? 'bg-amber-500 text-white hover:bg-amber-600'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                    }`}
                >
                    {hasShape ? (
                        <><Trash2 className="w-3.5 h-3.5" /> Effacer zone</>
                    ) : isTracing ? (
                        <><MousePointer2 className="w-3.5 h-3.5" /> Tracé en cours…</>
                    ) : drawMode ? (
                        <><MousePointer2 className="w-3.5 h-3.5" /> Cliquez, maintenez, glissez</>
                    ) : (
                        <><MousePointer2 className="w-3.5 h-3.5" /> Dessiner une zone</>
                    )}
                </button>

                <span className="text-xs text-gray-400 ml-auto">
                    {ordersWithGps.length} pin{ordersWithGps.length !== 1 ? 's' : ''}
                    {ordersNoGps > 0 && ` · ${ordersNoGps} sans GPS`}
                </span>

                {multiMode ? (
                    <>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Disponible
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-600" /> Sélectionné
                        </span>
                    </>
                ) : (
                    <>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-indigo-500" /> Non assigné
                        </span>
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                            <span className="inline-block w-2.5 h-2.5 rounded-full bg-gray-400" /> En DO
                        </span>
                    </>
                )}
            </div>

            {/* Map */}
            <div className={`flex-1 min-h-0 ${drawMode ? 'cursor-crosshair' : ''}`}>
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

                    <MapDragToggle active={drawMode} />
                    <FreehandDrawHandler
                        active={drawMode}
                        onStart={() => setIsTracing(true)}
                        onPointAdd={(pt) => setPath((prev) => [...prev, pt])}
                        onEnd={finishShape}
                    />

                    {path.length >= 2 && !hasShape && (
                        <Polyline positions={path} pathOptions={{ color: '#f59e0b', weight: 3 }} />
                    )}
                    {hasShape && (
                        <Polygon
                            positions={path}
                            pathOptions={{ color: '#f59e0b', weight: 2, fillOpacity: 0.12 }}
                        />
                    )}

                    <MarkerClusterGroup
                        chunkedLoading
                        maxClusterRadius={50}
                        spiderfyOnMaxZoom
                        iconCreateFunction={(cluster: L.MarkerCluster) => {
                            const count = cluster.getChildCount();
                            const size = count >= 50 ? 44 : count >= 10 ? 38 : 32;
                            return L.divIcon({
                                html: `<div style="
                                    width:${size}px;height:${size}px;border-radius:50%;
                                    background:#4f46e5;color:white;display:flex;
                                    align-items:center;justify-content:center;
                                    font-weight:700;font-size:${count >= 100 ? 11 : 12}px;
                                    border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,.4);
                                ">${count}</div>`,
                                className: '',
                                iconSize: [size, size],
                            });
                        }}
                    >
                        {ordersWithGps.map((order) => {
                            const lat = Number(order.partner.geo_lat);
                            const lng = Number(order.partner.geo_lng);
                            // Always false — see file header. The DO-assignment concept no longer
                            // exists; pending orders are inherently "unassigned" by definition now.
                            const isAssigned = false;
                            const isPicked = multiMode && selectedIds!.includes(order.id);
                            const isSel = !multiMode && order.id === selectedId;
                            const icon = isPicked
                                ? ICON_PICKED
                                : isAssigned
                                ? (isSel ? ICON_ASSIGNED_SEL : ICON_ASSIGNED)
                                : (isSel ? ICON_UNASSIGNED_SEL : ICON_UNASSIGNED);

                            return (
                                <Marker
                                    key={order.id}
                                    position={[lat, lng]}
                                    icon={icon}
                                    eventHandlers={multiMode ? {} : { click: () => onSelectOrder?.(order) }}
                                >
                                    <Popup>
                                        <div className="text-xs leading-snug min-w-[170px]">
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
                                            {multiMode && (
                                                <button
                                                    onClick={() => onToggleOrder?.(order)}
                                                    className={`mt-2 w-full flex items-center justify-center gap-1 px-2 py-1.5 rounded text-xs font-semibold transition-colors ${
                                                        isPicked
                                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200'
                                                            : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                                    }`}
                                                >
                                                    {isPicked ? (<><Check className="w-3 h-3" /> Sélectionné</>) : (<><Plus className="w-3 h-3" /> Sélectionner</>)}
                                                </button>
                                            )}
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}
                    </MarkerClusterGroup>
                </MapContainer>
            </div>
        </div>
    );
};
