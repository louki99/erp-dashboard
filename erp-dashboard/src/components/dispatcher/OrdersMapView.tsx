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

function makeIcon(color: string, selected = false): google.maps.Icon {
    const size = 28;
    const stroke = selected ? '#f59e0b' : 'white';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <path d="M14 0C6.268 0 0 6.268 0 14c0 10.5 14 28 14 28s14-17.5 14-28C28 6.268 21.732 0 14 0z" fill="${color}" stroke="${stroke}" stroke-width="2"/>
    </svg>`;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return {
        url,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size),
    };
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
    const [activeInfoId, setActiveInfoId] = useState<number | null>(null);

    const { isLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES,
    });

    // Icons must be created lazily — `google` is only available after the JS API loader finishes.
    const { ICON_UNASSIGNED, ICON_UNASSIGNED_SEL, ICON_ASSIGNED, ICON_ASSIGNED_SEL, ICON_PICKED } = useMemo(() => {
        if (!isLoaded) {
            return {
                ICON_UNASSIGNED: undefined,
                ICON_UNASSIGNED_SEL: undefined,
                ICON_ASSIGNED: undefined,
                ICON_ASSIGNED_SEL: undefined,
                ICON_PICKED: undefined,
            };
        }
        return {
            ICON_UNASSIGNED: makeIcon('#4f46e5'),
            ICON_UNASSIGNED_SEL: makeIcon('#4f46e5', true),
            ICON_ASSIGNED: makeIcon('#9ca3af'),
            ICON_ASSIGNED_SEL: makeIcon('#9ca3af', true),
            ICON_PICKED: makeIcon('#059669'),
        };
    }, [isLoaded]);

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
    }, [isLoaded, ordersWithGps.length]);

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

                    {ordersWithGps.map((order, idx) => {
                        const lat = Number(order.partner.geo_lat);
                        const lng = Number(order.partner.geo_lng);
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
                                position={{ lat, lng }}
                                icon={icon}
                                onLoad={(marker) => {
                                    markerRefs.current[idx] = marker;
                                }}
                                onClick={() => {
                                    if (!multiMode) {
                                        onSelectOrder?.(order);
                                    }
                                    setActiveInfoId(order.id);
                                }}
                            >
                                {activeInfoId === order.id && (
                                    <InfoWindow
                                        position={{ lat, lng }}
                                        onCloseClick={() => setActiveInfoId(null)}
                                    >
                                        <div className="text-xs leading-snug min-w-[170px]">
                                            <div className="font-bold text-indigo-700 mb-1">{order.order_code}</div>
                                            <div className="font-medium text-gray-800">{order.partner.name}</div>
                                            <div className="text-gray-500">{order.partner.city}</div>
                                            {order.partner.delivery_zone && (
                                                <div className="mt-1 text-sage-600 font-medium">{order.partner.delivery_zone}</div>
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
                                                            : 'bg-sage-500 text-white hover:bg-sage-600'
                                                    }`}
                                                >
                                                    {isPicked ? (<><Check className="w-3 h-3" /> Sélectionné</>) : (<><Plus className="w-3 h-3" /> Sélectionner</>)}
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
