/**
 * OrdersMapView — dispatcher map with:
 *  • Location grouping: multiple BCs at same address → one pin with count badge
 *  • Zone coloring: pins colored by geo_area / itinerary, with legend strip
 *  • OSRM route preview: when 2+ orders selected, draws driving route with
 *    distance + duration banner (OSRM at localhost:5000)
 *  • Freehand lasso zone selection
 *  • MarkerClusterer for dense zoom levels
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import {
    GoogleMap,
    useJsApiLoader,
    Marker,
    InfoWindow,
    Polygon as GPolygon,
    Polyline as GPolyline,
} from '@react-google-maps/api';
import { MarkerClusterer } from '@googlemaps/markerclusterer';
import { MousePointer2, Trash2, Navigation, Loader2 } from 'lucide-react';

import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';
import type { DispatcherOrder } from '@/types/dispatcher.types';

// ─── Point-in-polygon (ray casting) ──────────────────────────────────────────

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

function screenToLatLng(map: google.maps.Map, x: number, y: number): google.maps.LatLng | null {
    const projection = map.getProjection();
    if (!projection) return null;
    const bounds = map.getBounds();
    if (!bounds) return null;
    const ne = bounds.getNorthEast();
    const sw = bounds.getSouthWest();
    const topRight = projection.fromLatLngToPoint(ne);
    const bottomLeft = projection.fromLatLngToPoint(sw);
    if (!topRight || !bottomLeft) return null;
    const scale = 1 << (map.getZoom() ?? DEFAULT_ZOOM);
    return projection.fromPointToLatLng(
        new google.maps.Point(x / scale + bottomLeft.x, y / scale + topRight.y)
    );
}

// ─── Exported types ────────────────────────────────────────────────────────────

export interface MapBbox {
    lat_min: number; lat_max: number;
    lng_min: number; lng_max: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DEFAULT_CENTER = { lat: 31.7917, lng: -7.0926 }; // Morocco center
const DEFAULT_ZOOM = 6;
const GOOGLE_MAPS_LIBRARIES: ('geometry' | 'drawing')[] = ['geometry'];
const OSRM_BASE = 'http://localhost:5000';

// 10 distinct, colorblind-friendly zone colors
const ZONE_PALETTE = [
    '#3b82f6', // blue
    '#10b981', // emerald
    '#f59e0b', // amber
    '#ef4444', // red
    '#8b5cf6', // violet
    '#ec4899', // pink
    '#06b6d4', // cyan
    '#84cc16', // lime
    '#f97316', // orange
    '#a855f7', // purple
];
const ZONE_NONE_COLOR = '#6b7280'; // gray for orders with no zone

// ─── Icon helpers ─────────────────────────────────────────────────────────────

// Teardrop pin SVG — color-aware, with optional count badge for grouped locations.
function makeGroupIcon(color: string, count: number, selected = false): google.maps.Icon {
    const size = 32;
    const stroke = selected ? '#f59e0b' : 'white';
    const pin = `<path d="M16 0C7.163 0 0 7.163 0 16c0 12 16 32 16 32s16-20 16-32C32 7.163 24.837 0 16 0z" fill="${color}" stroke="${stroke}" stroke-width="2"/>`;
    const badge = count > 1
        ? `<circle cx="26" cy="6" r="7" fill="white" stroke="${color}" stroke-width="1.5"/>
           <text x="26" y="6.5" dominant-baseline="central" text-anchor="middle" fill="${color}" font-size="${count >= 10 ? 6 : 7.5}" font-weight="900" font-family="system-ui,sans-serif">${count}</text>`
        : '';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${pin}${badge}</svg>`;
    return {
        url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size),
    };
}

// ─── Internal types ────────────────────────────────────────────────────────────

interface LocationGroup {
    key: string;
    lat: number;
    lng: number;
    orders: DispatcherOrder[];
}

interface RoutePreview {
    path: { lat: number; lng: number }[];
    distanceM: number;
    durationS: number;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface OrdersMapViewProps {
    orders: DispatcherOrder[];
    onBboxChange?: (bbox: MapBbox | null) => void;
    onPolygonChange?: (polygon: Array<[number, number]> | null) => void;
    selectedId?: number | null;
    onSelectOrder?: (order: DispatcherOrder) => void;
    selectedIds?: number[];
    onToggleOrder?: (order: DispatcherOrder) => void;
    /** When provided, OSRM route starts and ends here (depot round-trip). */
    depot?: { lat: number; lng: number };
}

export const OrdersMapView = ({
    orders,
    selectedId = null,
    onSelectOrder,
    selectedIds,
    onToggleOrder,
    onBboxChange,
    onPolygonChange,
    depot,
}: OrdersMapViewProps) => {
    const multiMode = selectedIds != null;

    const mapRef        = useRef<google.maps.Map | null>(null);
    const containerRef  = useRef<HTMLDivElement | null>(null);
    const clustererRef  = useRef<MarkerClusterer | null>(null);
    const markerRefs    = useRef<(google.maps.Marker | null)[]>([]);
    const overlayRef    = useRef<HTMLDivElement | null>(null);
    const drawingRef    = useRef(false);

    const [drawMode,     setDrawMode]     = useState(false);
    const [isTracing,    setIsTracing]    = useState(false);
    const [path,         setPath]         = useState<Array<[number, number]>>([]);
    const [activeInfoId, setActiveInfoId] = useState<string | null>(null);
    const [routePreview, setRoutePreview] = useState<RoutePreview | null>(null);
    const [routeLoading, setRouteLoading] = useState(false);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES,
    });

    const hasShape = path.length >= 3;

    // ── Zone color mapping ──────────────────────────────────────────────────

    const zoneColorMap = useMemo(() => {
        const map = new Map<string, string>();
        let idx = 0;
        for (const o of orders) {
            const key = o.partner.geo_area?.id != null
                ? `geo:${o.partner.geo_area.id}`
                : o.partner.active_itineraries?.[0]?.id != null
                ? `itin:${o.partner.active_itineraries[0].id}`
                : null;
            if (key && !map.has(key)) {
                map.set(key, ZONE_PALETTE[idx % ZONE_PALETTE.length]);
                idx++;
            }
        }
        return map;
    }, [orders]);

    const getZoneColor = useCallback((o: DispatcherOrder): string => {
        const key = o.partner.geo_area?.id != null
            ? `geo:${o.partner.geo_area.id}`
            : o.partner.active_itineraries?.[0]?.id != null
            ? `itin:${o.partner.active_itineraries[0].id}`
            : null;
        return key ? (zoneColorMap.get(key) ?? ZONE_NONE_COLOR) : ZONE_NONE_COLOR;
    }, [zoneColorMap]);

    // Legend entries sorted by count desc
    const zoneLegend = useMemo(() => {
        const seen = new Map<string, { name: string; color: string; count: number }>();
        for (const o of orders) {
            const zk = o.partner.geo_area?.id != null
                ? `geo:${o.partner.geo_area.id}`
                : o.partner.active_itineraries?.[0]?.id != null
                ? `itin:${o.partner.active_itineraries[0].id}`
                : 'none';
            const name = o.partner.geo_area?.name
                ?? o.partner.active_itineraries?.[0]?.name
                ?? 'Sans zone';
            const color = zoneColorMap.get(zk) ?? ZONE_NONE_COLOR;
            if (!seen.has(zk)) seen.set(zk, { name, color, count: 0 });
            seen.get(zk)!.count++;
        }
        return [...seen.values()].sort((a, b) => b.count - a.count);
    }, [orders, zoneColorMap]);

    // ── GPS-filtered orders + location groups ───────────────────────────────

    const ordersWithGps = useMemo(() =>
        orders.filter(o => o.partner?.geo_lat != null && o.partner?.geo_lng != null),
    [orders]);
    const ordersNoGps = orders.length - ordersWithGps.length;

    const locationGroups = useMemo<LocationGroup[]>(() => {
        const map = new Map<string, LocationGroup>();
        for (const o of ordersWithGps) {
            const lat = Number(o.partner.geo_lat);
            const lng = Number(o.partner.geo_lng);
            const key = `${lat.toFixed(5)},${lng.toFixed(5)}`; // ~1 m precision
            if (!map.has(key)) map.set(key, { key, lat, lng, orders: [] });
            map.get(key)!.orders.push(o);
        }
        return [...map.values()];
    }, [ordersWithGps]);

    // ── OSRM route preview ──────────────────────────────────────────────────

    const fetchRoute = useCallback(async (ids: number[]) => {
        const selected = ordersWithGps.filter(o => ids.includes(o.id));
        if (selected.length < 2) { setRoutePreview(null); return; }

        const pts: string[] = [];
        if (depot) pts.push(`${depot.lng},${depot.lat}`);
        selected.forEach(o => pts.push(`${Number(o.partner.geo_lng)},${Number(o.partner.geo_lat)}`));
        if (depot) pts.push(`${depot.lng},${depot.lat}`); // return to depot

        setRouteLoading(true);
        try {
            const res  = await fetch(`${OSRM_BASE}/route/v1/driving/${pts.join(';')}?overview=full&geometries=geojson&steps=false`);
            const data = await res.json();
            if (data.routes?.[0]) {
                const r = data.routes[0];
                setRoutePreview({
                    path: (r.geometry.coordinates as [number, number][]).map(([lng, lat]) => ({ lat, lng })),
                    distanceM: r.distance,
                    durationS: r.duration,
                });
            }
        } catch {
            setRoutePreview(null);
        } finally {
            setRouteLoading(false);
        }
    }, [ordersWithGps, depot]);

    const selectedKey = selectedIds?.join(',') ?? '';
    useEffect(() => {
        if (!multiMode || !selectedIds || selectedIds.length < 2) {
            setRoutePreview(null);
            return;
        }
        fetchRoute(selectedIds);
    }, [multiMode, selectedKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // ── Lasso helpers ───────────────────────────────────────────────────────

    const finishShape = useCallback(() => {
        setIsTracing(false);
        setDrawMode(false);
        if (path.length < 3) { setPath([]); onBboxChange?.(null); onPolygonChange?.(null); return; }
        const lats = path.map(p => p[0]);
        const lngs = path.map(p => p[1]);
        onBboxChange?.({ lat_min: Math.min(...lats), lat_max: Math.max(...lats), lng_min: Math.min(...lngs), lng_max: Math.max(...lngs) });
        onPolygonChange?.(path);
    }, [path, onBboxChange, onPolygonChange]);

    const clearShape = useCallback(() => {
        setPath([]); setDrawMode(false); setIsTracing(false);
        onBboxChange?.(null); onPolygonChange?.(null);
    }, [onBboxChange, onPolygonChange]);

    const toggleDrawMode = () => { if (hasShape) { clearShape(); return; } setDrawMode(d => !d); setPath([]); };

    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoaded) return;
        map.setOptions({ draggable: !drawMode });
        return () => { map.setOptions({ draggable: true }); };
    }, [drawMode, isLoaded]);

    const addOverlayPoint = useCallback((cx: number, cy: number) => {
        const map = mapRef.current;
        const overlay = overlayRef.current;
        if (!map || !overlay) return;
        const rect = overlay.getBoundingClientRect();
        const ll = screenToLatLng(map, cx - rect.left, cy - rect.top);
        if (ll) setPath(prev => [...prev, [ll.lat(), ll.lng()]]);
    }, []);

    const handleOverlayPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault(); e.stopPropagation();
        drawingRef.current = true; setIsTracing(true); setPath([]);
        addOverlayPoint(e.clientX, e.clientY);
        (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    }, [addOverlayPoint]);

    const handleOverlayPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!drawingRef.current) return;
        e.preventDefault(); e.stopPropagation();
        addOverlayPoint(e.clientX, e.clientY);
    }, [addOverlayPoint]);

    const handleOverlayPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!drawingRef.current) return;
        e.preventDefault(); e.stopPropagation();
        drawingRef.current = false; finishShape();
    }, [finishShape]);

    // ── Auto-fit bounds ─────────────────────────────────────────────────────

    useEffect(() => {
        const map = mapRef.current;
        if (!map || ordersWithGps.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        ordersWithGps.forEach(o => bounds.extend({ lat: Number(o.partner.geo_lat), lng: Number(o.partner.geo_lng) }));
        map.fitBounds(bounds, 40);
        const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            if ((map.getZoom() ?? DEFAULT_ZOOM) > 13) map.setZoom(13);
        });
        return () => { listener?.remove(); };
    }, [ordersWithGps]);

    // ── MarkerClusterer ─────────────────────────────────────────────────────

    const clustererRenderer = useMemo(() => ({
        render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            const sz = count >= 50 ? 44 : count >= 10 ? 38 : 32;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${sz}" height="${sz}" viewBox="0 0 ${sz} ${sz}">
                <circle cx="${sz/2}" cy="${sz/2}" r="${sz/2-2}" fill="#4f46e5" stroke="white" stroke-width="3"/>
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-size="${count >= 100 ? 11 : 12}" font-weight="700" font-family="system-ui,sans-serif">${count}</text>
            </svg>`;
            return new google.maps.Marker({
                position,
                icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, scaledSize: new google.maps.Size(sz, sz), anchor: new google.maps.Point(sz/2, sz/2) },
            });
        },
    }), []);

    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;
        const markers = markerRefs.current.filter((m): m is google.maps.Marker => m instanceof google.maps.Marker);
        if (markers.length === 0) return;
        clustererRef.current?.setMap(null);
        clustererRef.current = new MarkerClusterer({ map: mapRef.current, markers, renderer: clustererRenderer });
        return () => { clustererRef.current?.setMap(null); clustererRef.current = null; };
    }, [isLoaded, locationGroups.length, clustererRenderer]);

    // ── Formatters ─────────────────────────────────────────────────────────

    const fmtDist = (m: number) => m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
    const fmtDur  = (s: number) => {
        const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60);
        return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
    };

    // ─────────────────────────────────────────────────────────────────────────

    if (!isLoaded) {
        return <div className="h-full flex items-center justify-center text-gray-400">Chargement de la carte…</div>;
    }

    return (
        <div className="h-full flex flex-col">

            {/* ── Toolbar ──────────────────────────────────────────────────── */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white border-b border-gray-100 shrink-0 flex-wrap gap-y-1.5">

                {/* Lasso button */}
                <button
                    onClick={toggleDrawMode}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                        isTracing       ? 'bg-amber-500 text-white'
                        : hasShape      ? 'bg-red-500 text-white hover:bg-red-600'
                        : drawMode      ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-sage-500 text-white hover:bg-sage-600'
                    }`}
                >
                    {hasShape   ? <><Trash2       className="w-3.5 h-3.5" /> Effacer zone</>
                    : isTracing  ? <><MousePointer2 className="w-3.5 h-3.5" /> Tracé en cours…</>
                    : drawMode   ? <><MousePointer2 className="w-3.5 h-3.5" /> Cliquez, maintenez, glissez</>
                    :              <><MousePointer2 className="w-3.5 h-3.5" /> Dessiner une zone</>}
                </button>

                {/* OSRM route banner */}
                {multiMode && routeLoading && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-600 font-medium">
                        <Loader2 className="w-3 h-3 animate-spin" /> Calcul itinéraire…
                    </div>
                )}
                {multiMode && routePreview && !routeLoading && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-50 border border-emerald-200 text-xs font-semibold text-emerald-700">
                        <Navigation className="w-3.5 h-3.5 shrink-0" />
                        <span>{fmtDist(routePreview.distanceM)}</span>
                        <span className="text-emerald-300">·</span>
                        <span>~{fmtDur(routePreview.durationS)}</span>
                        {depot && <span className="text-emerald-500 font-normal text-[10px]">aller-retour dépôt</span>}
                    </div>
                )}

                {/* Stats */}
                <span className="text-xs text-gray-400 ml-auto">
                    {ordersWithGps.length} BC{ordersWithGps.length !== 1 ? 's' : ''}
                    {locationGroups.length !== ordersWithGps.length && ` · ${locationGroups.length} localisation${locationGroups.length !== 1 ? 's' : ''}`}
                    {ordersNoGps > 0 && <span className="text-amber-500"> · {ordersNoGps} sans GPS</span>}
                </span>

                {/* Selection legend */}
                {multiMode ? (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500" /> Sélectionné
                    </span>
                ) : (
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                        <span className="inline-block w-2.5 h-2.5 rounded-full bg-blue-400" /> Par zone
                    </span>
                )}
            </div>

            {/* ── Zone legend strip ─────────────────────────────────────────── */}
            {zoneLegend.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-white border-b border-gray-100 overflow-x-auto shrink-0">
                    <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider shrink-0">Zones</span>
                    {zoneLegend.map(({ name, color, count }) => (
                        <span
                            key={name}
                            className="inline-flex items-center gap-1.5 text-[11px] text-gray-700 shrink-0 whitespace-nowrap px-2 py-0.5 rounded-full border font-medium"
                            style={{ borderColor: `${color}55`, background: `${color}14` }}
                        >
                            <span className="inline-block w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
                            {name}
                            <span className="font-bold" style={{ color }}>{count}</span>
                        </span>
                    ))}
                </div>
            )}

            {/* ── Map ──────────────────────────────────────────────────────── */}
            <div ref={containerRef} className={`relative flex-1 min-h-0 ${drawMode ? 'cursor-crosshair' : ''}`}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    options={{ mapTypeControl: true, streetViewControl: false, fullscreenControl: false, draggable: !drawMode }}
                    onLoad={(map) => { mapRef.current = map; }}
                >
                    {/* Lasso in-progress polyline */}
                    {path.length >= 2 && !hasShape && (
                        <GPolyline path={path.map(([lat, lng]) => ({ lat, lng }))} options={{ strokeColor: '#f59e0b', strokeWeight: 3 }} />
                    )}
                    {/* Finished lasso polygon */}
                    {hasShape && (
                        <GPolygon
                            path={path.map(([lat, lng]) => ({ lat, lng }))}
                            options={{ strokeColor: '#f59e0b', strokeWeight: 2, fillColor: '#f59e0b', fillOpacity: 0.12 }}
                        />
                    )}

                    {/* OSRM route preview — dashed emerald line with direction arrows */}
                    {routePreview && (
                        <GPolyline
                            path={routePreview.path}
                            options={{
                                strokeColor: '#10b981',
                                strokeOpacity: 0.9,
                                strokeWeight: 4,
                                geodesic: true,
                                icons: [{
                                    icon: {
                                        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
                                        scale: 3,
                                        fillColor: '#10b981',
                                        fillOpacity: 1,
                                        strokeColor: 'white',
                                        strokeWeight: 1,
                                    },
                                    offset: '50%',
                                    repeat: '100px',
                                }],
                            }}
                        />
                    )}

                    {/* Order pins — one per unique GPS location, colored by zone */}
                    {locationGroups.map((group, idx) => {
                        const { key, lat, lng, orders: groupOrders } = group;
                        const count       = groupOrders.length;
                        const firstOrder  = groupOrders[0];
                        const zoneColor   = getZoneColor(firstOrder);

                        const allPicked  = multiMode && groupOrders.every(o => selectedIds!.includes(o.id));
                        const somePicked = !allPicked && multiMode && groupOrders.some(o => selectedIds!.includes(o.id));
                        const isSel      = !multiMode && count === 1 && firstOrder.id === selectedId;

                        // Selection states override zone color
                        const pinColor = allPicked ? '#059669' : somePicked ? '#d97706' : zoneColor;
                        const icon     = makeGroupIcon(pinColor, count, isSel || allPicked);

                        return (
                            <Marker
                                key={key}
                                position={{ lat, lng }}
                                icon={icon}
                                onLoad={(marker) => { markerRefs.current[idx] = marker; }}
                                onClick={() => {
                                    if (!multiMode && count === 1) onSelectOrder?.(firstOrder);
                                    setActiveInfoId(activeInfoId === key ? null : key);
                                }}
                            >
                                {activeInfoId === key && (
                                    <InfoWindow position={{ lat, lng }} onCloseClick={() => setActiveInfoId(null)}>
                                        <div style={{ minWidth: 210, maxWidth: 290, fontFamily: 'system-ui,sans-serif', lineHeight: 1.4 }}>

                                            {/* Partner + zone */}
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 2 }}>
                                                {firstOrder.partner.name}
                                            </div>
                                            {(firstOrder.partner.geo_area || firstOrder.partner.active_itineraries?.[0]) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: zoneColor, display: 'inline-block', flexShrink: 0 }} />
                                                    <span style={{ fontSize: 11, color: '#6b7280' }}>
                                                        {firstOrder.partner.geo_area?.name ?? firstOrder.partner.active_itineraries![0].name}
                                                    </span>
                                                </div>
                                            )}
                                            {firstOrder.partner.address_line1 && (
                                                <div style={{ fontSize: 11, color: '#9ca3af', marginBottom: 4 }}>
                                                    {firstOrder.partner.address_line1}
                                                </div>
                                            )}
                                            {firstOrder.partner.delivery_zone && (
                                                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 4 }}>
                                                    {firstOrder.partner.delivery_zone}
                                                </div>
                                            )}

                                            {/* BC list */}
                                            <div style={{ borderTop: '1px solid #e5e7eb' }}>
                                                {groupOrders.map(order => {
                                                    const isPicked = multiMode && selectedIds!.includes(order.id);
                                                    return (
                                                        <div
                                                            key={order.id}
                                                            style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', borderBottom: '1px solid #f3f4f6' }}
                                                        >
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 700, fontSize: 11, color: '#4338ca' }}>{order.order_code}</div>
                                                                <div style={{ fontSize: 11, color: '#374151' }}>
                                                                    {Number(order.total_amount).toLocaleString('fr-FR')} MAD
                                                                </div>
                                                            </div>
                                                            {multiMode ? (
                                                                <button
                                                                    onClick={() => onToggleOrder?.(order)}
                                                                    style={{
                                                                        flexShrink: 0, padding: '4px 10px', borderRadius: 6, border: 'none',
                                                                        fontSize: 12, fontWeight: 800, cursor: 'pointer',
                                                                        background: isPicked ? '#d1fae5' : '#4f46e5',
                                                                        color: isPicked ? '#065f46' : 'white',
                                                                    }}
                                                                >{isPicked ? '✓' : '+'}</button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { onSelectOrder?.(order); setActiveInfoId(null); }}
                                                                    style={{
                                                                        flexShrink: 0, padding: '4px 10px', borderRadius: 6, border: 'none',
                                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                                        background: '#4f46e5', color: 'white',
                                                                    }}
                                                                >Voir</button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Bulk select (multi-mode, 2+ BCs at location) */}
                                            {multiMode && count > 1 && (
                                                <button
                                                    onClick={() => {
                                                        if (allPicked) {
                                                            groupOrders.forEach(o => { if (selectedIds!.includes(o.id)) onToggleOrder?.(o); });
                                                        } else {
                                                            groupOrders.forEach(o => { if (!selectedIds!.includes(o.id)) onToggleOrder?.(o); });
                                                        }
                                                    }}
                                                    style={{
                                                        marginTop: 6, width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer', textAlign: 'center',
                                                        background: allPicked ? '#f3f4f6' : '#059669',
                                                        color: allPicked ? '#6b7280' : 'white',
                                                    }}
                                                >
                                                    {allPicked ? 'Tout désélectionner' : `Sélectionner les ${count} BCs`}
                                                </button>
                                            )}
                                        </div>
                                    </InfoWindow>
                                )}
                            </Marker>
                        );
                    })}
                </GoogleMap>

                {/* Transparent drawing overlay — sits above the map to capture lasso events */}
                {(drawMode || isTracing) && (
                    <div
                        ref={overlayRef}
                        className="absolute inset-0 z-[500] touch-none"
                        style={{ cursor: 'crosshair' }}
                        onPointerDown={handleOverlayPointerDown}
                        onPointerMove={handleOverlayPointerMove}
                        onPointerUp={handleOverlayPointerUp}
                        onPointerLeave={handleOverlayPointerUp}
                        onPointerCancel={handleOverlayPointerUp}
                    />
                )}
            </div>
        </div>
    );
};
