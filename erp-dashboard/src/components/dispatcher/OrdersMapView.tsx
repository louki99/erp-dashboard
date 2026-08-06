/**
 * OrdersMapView
 * ─────────────────────────────────────────────────────────────────────────────
 * Google Maps view for the dispatcher orders page.
 *  • One pin per order that has GPS coordinates
 *  • Blue pin  = unassigned
 *  • Gray pin  = unused, kept for future mission-assignment styling
 *  • Click pin → select that order (single-select mode)
 *  • "Dessiner une zone" mode: freehand lasso — click, hold, drag to trace a
 *    custom shape, release to close the polygon. The component calls
 *    onPolygonChange with the raw traced points and onBboxChange with the
 *    shape's bounding rectangle.
 *  • Clear button resets the drawn shape
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
import { MousePointer2, Trash2, Plus, Check } from 'lucide-react';

import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';
import type { DispatcherOrder } from '@/types/dispatcher.types';

// ─── Point-in-polygon (ray casting) ────────────────────────────────────────────

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

// Convert a screen pixel position inside the map container to LatLng.
// Works with the current zoom level and map bounds.
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
    const zoom = map.getZoom() ?? DEFAULT_ZOOM;
    const scale = 1 << zoom;
    const worldPoint = new google.maps.Point(
        x / scale + bottomLeft.x,
        y / scale + topRight.y
    );
    return projection.fromPointToLatLng(worldPoint);
}

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
    onBboxChange?: (bbox: MapBbox | null) => void;
    onPolygonChange?: (polygon: Array<[number, number]> | null) => void;
    selectedId?: number | null;
    onSelectOrder?: (order: DispatcherOrder) => void;
    selectedIds?: number[];
    onToggleOrder?: (order: DispatcherOrder) => void;
}

const DEFAULT_CENTER = { lat: 31.7917, lng: -7.0926 };
const DEFAULT_ZOOM = 6;
const GOOGLE_MAPS_LIBRARIES: ('geometry' | 'drawing')[] = ['geometry'];


// Pin with optional count badge — used when multiple orders share the same GPS location.
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

interface LocationGroup {
    key: string;
    lat: number;
    lng: number;
    orders: DispatcherOrder[];
}

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
    const mapRef = useRef<google.maps.Map | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const clustererRef = useRef<MarkerClusterer | null>(null);
    const markerRefs = useRef<(google.maps.Marker | null)[]>([]);
    const [drawMode, setDrawMode] = useState(false);
    const [isTracing, setIsTracing] = useState(false);
    const [path, setPath] = useState<Array<[number, number]>>([]);
    const [activeInfoId, setActiveInfoId] = useState<string | null>(null);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES,
    });


    const hasShape = path.length >= 3;

    const finishShape = useCallback(() => {
        setIsTracing(false);
        setDrawMode(false);
        if (path.length < 3) {
            setPath([]);
            onBboxChange?.(null);
            onPolygonChange?.(null);
            return;
        }
        const lats = path.map((p) => p[0]);
        const lngs = path.map((p) => p[1]);
        onBboxChange?.({
            lat_min: Math.min(...lats),
            lat_max: Math.max(...lats),
            lng_min: Math.min(...lngs),
            lng_max: Math.max(...lngs),
        });
        onPolygonChange?.(path);
    }, [path, onBboxChange, onPolygonChange]);

    const clearShape = useCallback(() => {
        setPath([]);
        setDrawMode(false);
        setIsTracing(false);
        onBboxChange?.(null);
        onPolygonChange?.(null);
    }, [onBboxChange, onPolygonChange]);

    const toggleDrawMode = () => {
        if (hasShape) {
            clearShape();
            return;
        }
        setDrawMode((d) => !d);
        setPath([]);
    };

    // Disable map panning while drawing so the lasso can trace freely.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !isLoaded) return;
        map.setOptions({ draggable: !drawMode });
        return () => { map.setOptions({ draggable: true }); };
    }, [drawMode, isLoaded]);

    // Freehand drawing helpers using a transparent overlay above the map.
    const overlayRef = useRef<HTMLDivElement | null>(null);
    const drawingRef = useRef(false);

    const addOverlayPoint = useCallback((clientX: number, clientY: number) => {
        const map = mapRef.current;
        const overlay = overlayRef.current;
        if (!map || !overlay) return;
        const rect = overlay.getBoundingClientRect();
        const x = clientX - rect.left;
        const y = clientY - rect.top;
        const latLng = screenToLatLng(map, x, y);
        if (!latLng) return;
        setPath((prev) => [...prev, [latLng.lat(), latLng.lng()]]);
    }, []);

    const handleOverlayPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        drawingRef.current = true;
        setIsTracing(true);
        setPath([]);
        addOverlayPoint(e.clientX, e.clientY);
        (e.target as HTMLDivElement).setPointerCapture(e.pointerId);
    }, [addOverlayPoint]);

    const handleOverlayPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        addOverlayPoint(e.clientX, e.clientY);
    }, [addOverlayPoint]);

    const handleOverlayPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
        if (!drawingRef.current) return;
        e.preventDefault();
        e.stopPropagation();
        drawingRef.current = false;
        finishShape();
    }, [finishShape]);

    const ordersWithGps = orders.filter(
        (o) => o.partner?.geo_lat != null && o.partner?.geo_lng != null,
    );
    const ordersNoGps = orders.length - ordersWithGps.length;

    // Group orders that share the same GPS coordinate into one map pin.
    const locationGroups = useMemo<LocationGroup[]>(() => {
        const map = new Map<string, LocationGroup>();
        for (const o of ordersWithGps) {
            const lat = Number(o.partner.geo_lat);
            const lng = Number(o.partner.geo_lng);
            // 5-decimal precision ≈ 1 m — close enough to merge same-partner pins.
            const key = `${lat.toFixed(5)},${lng.toFixed(5)}`;
            if (!map.has(key)) map.set(key, { key, lat, lng, orders: [] });
            map.get(key)!.orders.push(o);
        }
        return [...map.values()];
    }, [ordersWithGps]);

    // Auto-fit to markers when orders change.
    useEffect(() => {
        const map = mapRef.current;
        if (!map || ordersWithGps.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        ordersWithGps.forEach((o) => {
            bounds.extend({ lat: Number(o.partner.geo_lat), lng: Number(o.partner.geo_lng) });
        });
        map.fitBounds(bounds, 40);
        // Cap zoom so a single order doesn't zoom in too tightly.
        const listener = google.maps.event.addListenerOnce(map, 'bounds_changed', () => {
            const z = map.getZoom() ?? DEFAULT_ZOOM;
            if (z > 13) map.setZoom(13);
        });
        return () => {
            listener?.remove();
        };
    }, [ordersWithGps]);

    const clustererRenderer = {
        render: ({ count, position }: { count: number; position: google.maps.LatLng }) => {
            const size = count >= 50 ? 44 : count >= 10 ? 38 : 32;
            const fontSize = count >= 100 ? 11 : 12;
            const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" fill="#4f46e5" stroke="white" stroke-width="3"/>
                <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle" fill="white" font-size="${fontSize}" font-weight="700" font-family="system-ui,sans-serif">${count}</text>
            </svg>`;
            const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
            return new google.maps.Marker({
                position,
                icon: {
                    url,
                    scaledSize: new google.maps.Size(size, size),
                    anchor: new google.maps.Point(size / 2, size / 2),
                },
            });
        },
    };

    // Rebuild clusterer when markers change.
    useEffect(() => {
        if (!isLoaded || !mapRef.current) return;
        const markers = markerRefs.current.filter((m): m is google.maps.Marker => m instanceof google.maps.Marker);
        if (markers.length === 0) return;

        clustererRef.current?.setMap(null);
        clustererRef.current = new MarkerClusterer({
            map: mapRef.current,
            markers,
            renderer: clustererRenderer,
        });

        return () => {
            clustererRef.current?.setMap(null);
            clustererRef.current = null;
        };
    }, [isLoaded, locationGroups.length]);

    if (!isLoaded) {
        return (
            <div className="h-full flex items-center justify-center text-gray-400">
                Chargement de la carte…
            </div>
        );
    }

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
                            : 'bg-sage-500 text-white hover:bg-sage-600'
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
                    {ordersWithGps.length} BC{ordersWithGps.length !== 1 ? 's' : ''} · {locationGroups.length} localisation{locationGroups.length !== 1 ? 's' : ''}
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
            <div ref={containerRef} className={`relative flex-1 min-h-0 ${drawMode ? 'cursor-crosshair' : ''}`}>
                <GoogleMap
                    mapContainerStyle={{ width: '100%', height: '100%' }}
                    center={DEFAULT_CENTER}
                    zoom={DEFAULT_ZOOM}
                    options={{
                        mapTypeControl: true,
                        streetViewControl: false,
                        fullscreenControl: false,
                        draggable: !drawMode,
                    }}
                    onLoad={(map) => {
                        mapRef.current = map;
                    }}
                >
                    {path.length >= 2 && !hasShape && (
                        <GPolyline
                            path={path.map(([lat, lng]) => ({ lat, lng }))}
                            options={{ strokeColor: '#f59e0b', strokeWeight: 3 }}
                        />
                    )}
                    {hasShape && (
                        <GPolygon
                            path={path.map(([lat, lng]) => ({ lat, lng }))}
                            options={{
                                strokeColor: '#f59e0b',
                                strokeWeight: 2,
                                fillColor: '#f59e0b',
                                fillOpacity: 0.12,
                            }}
                        />
                    )}

                    {locationGroups.map((group, idx) => {
                        const { key, lat, lng, orders: groupOrders } = group;
                        const count = groupOrders.length;
                        const firstOrder = groupOrders[0];

                        const allPicked = multiMode && groupOrders.every(o => selectedIds!.includes(o.id));
                        const somePicked = !allPicked && multiMode && groupOrders.some(o => selectedIds!.includes(o.id));
                        const isSel = !multiMode && count === 1 && firstOrder.id === selectedId;

                        const pinColor = allPicked ? '#059669' : somePicked ? '#d97706' : '#4f46e5';
                        const icon = isLoaded ? makeGroupIcon(pinColor, count, isSel || allPicked) : undefined;

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
                                    <InfoWindow
                                        position={{ lat, lng }}
                                        onCloseClick={() => setActiveInfoId(null)}
                                    >
                                        <div className="leading-snug" style={{ minWidth: 210, maxWidth: 290, fontFamily: 'system-ui,sans-serif' }}>
                                            {/* Partner header */}
                                            <div style={{ fontWeight: 700, fontSize: 13, color: '#111827', marginBottom: 2 }}>
                                                {firstOrder.partner.name}
                                            </div>
                                            {firstOrder.partner.address_line1 && (
                                                <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>
                                                    {firstOrder.partner.address_line1}
                                                </div>
                                            )}
                                            {firstOrder.partner.delivery_zone && (
                                                <div style={{ fontSize: 11, color: '#059669', fontWeight: 600, marginBottom: 6 }}>
                                                    {firstOrder.partner.delivery_zone}
                                                </div>
                                            )}

                                            {/* Order list */}
                                            <div style={{ borderTop: '1px solid #e5e7eb', marginBottom: count > 1 ? 6 : 0 }}>
                                                {groupOrders.map(order => {
                                                    const isPicked = multiMode && selectedIds!.includes(order.id);
                                                    return (
                                                        <div key={order.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid #f3f4f6' }}>
                                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                                <div style={{ fontWeight: 700, fontSize: 11, color: '#4338ca', letterSpacing: '0.01em' }}>
                                                                    {order.order_code}
                                                                </div>
                                                                <div style={{ fontSize: 11, color: '#374151', fontWeight: 600 }}>
                                                                    {Number(order.total_amount).toLocaleString('fr-FR')} MAD
                                                                </div>
                                                            </div>
                                                            {multiMode ? (
                                                                <button
                                                                    onClick={() => onToggleOrder?.(order)}
                                                                    style={{
                                                                        flexShrink: 0,
                                                                        display: 'flex', alignItems: 'center', gap: 3,
                                                                        padding: '4px 8px', borderRadius: 6, border: 'none',
                                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                                        background: isPicked ? '#d1fae5' : '#4f46e5',
                                                                        color: isPicked ? '#065f46' : 'white',
                                                                    }}
                                                                >
                                                                    {isPicked ? '✓' : '+'}
                                                                </button>
                                                            ) : (
                                                                <button
                                                                    onClick={() => { onSelectOrder?.(order); setActiveInfoId(null); }}
                                                                    style={{
                                                                        flexShrink: 0,
                                                                        padding: '4px 8px', borderRadius: 6, border: 'none',
                                                                        fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                                                        background: '#4f46e5', color: 'white',
                                                                    }}
                                                                >
                                                                    Voir
                                                                </button>
                                                            )}
                                                        </div>
                                                    );
                                                })}
                                            </div>

                                            {/* Bulk select button for multi-order groups */}
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
                                                        width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
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

                {/* Transparent drawing overlay: captures pointer events so the lasso works
                    reliably without fighting Google Maps' own drag/pan handlers. */}
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
