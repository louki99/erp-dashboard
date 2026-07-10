import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    GripVertical,
    Save,
    Truck,
    Search,
    MapPin,
    SquareDashed,
    X,
    Clock,
    Route,
    Target,
    Loader2,
    Maximize2,
    Flag,
    Palette,
    ChevronDown,
    ChevronUp,
    Info,
    Layers,
} from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    useSortable,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    GoogleMap,
    useJsApiLoader,
    Marker,
    InfoWindow,
    Polyline,
    TrafficLayer,
    StreetViewPanorama,
} from '@react-google-maps/api';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import SearchableSelect from '@/components/common/SearchableSelect';
import {
    useItineraries,
    useItinerary,
    useSyncItineraryPartners,
    useBulkAssignPartners,
    useMapLayers,
    useGeoRoutingBounds,
    useGeoAreas,
    useUpdatePartnerGpsLocation,
} from '@/hooks/routing/useRouting';
import type {
    Itinerary,
    ItineraryPartner,
    SyncPartnerEntry,
    GeoAreaBounds,
    GeoAreaFeatureProperties,
} from '@/types/routing.types';

// ─── Google Maps API key & libraries ─────────────────────────────────────────

const GOOGLE_MAPS_API_KEY = 'AIzaSyDe9hV0j21IKh1p9NhoFsE6bNa7WEGxB4M';
const GOOGLE_MAPS_LIBRARIES: ('geometry' | 'places')[] = ['geometry'];
const MAP_CONTAINER_STYLE = { height: '100%', width: '100%' };
const DEFAULT_MAP_CENTER = { lat: 31.7917, lng: -7.0926 };

// ─── Stable color per parent city (backend-recommended hash → HSL) ───────────

function colorForParent(parentCode: string): string {
    let hash = 0;
    for (const c of parentCode) hash = c.charCodeAt(0) + ((hash << 5) - hash);
    return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

// ─── Marker Icons (Google Maps SVG data-URI) ──────────────────────────────────

/**
 * Produces a google.maps.Icon for numbered stop markers.
 * - Commercial client → indigo circle
 * - Logistic stop point → amber rounded square
 * - Hovered → enlarged with drop-shadow
 */
function numberedIcon(n: number, isStopPoint: boolean, highlighted: boolean): google.maps.Icon {
    const size = highlighted ? 32 : 24;
    const bg = isStopPoint ? '#f59e0b' : '#4f46e5';
    const rx = isStopPoint ? '7' : '50%';
    const fontSize = highlighted ? 13 : 11;

    // Build an SVG string: rounded square or circle with a white number
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <rect x="0" y="0" width="${size}" height="${size}" rx="${rx}" ry="${rx}" fill="${bg}" stroke="white" stroke-width="2"/>
        <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
            fill="white" font-size="${fontSize}" font-weight="700" font-family="system-ui,sans-serif">${n}</text>
    </svg>`;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return {
        url,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
    };
}

/** Red pulsing edit icon — used when GPS correction mode is active for this marker */
function editIcon(): google.maps.Icon {
    const size = 22;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
        <circle cx="11" cy="11" r="9" fill="#ef4444" stroke="white" stroke-width="3"/>
    </svg>`;
    const url = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    return {
        url,
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(11, 11),
    };
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

/** API returns geo_lat/geo_lng as decimal strings — coerce and reject NaN/empty */
function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

/** Great-circle distance in km between two [lat, lng] points */
function haversineKm(a: [number, number], b: [number, number]): number {
    const R = 6371;
    const dLat = ((b[0] - a[0]) * Math.PI) / 180;
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const s =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((a[0] * Math.PI) / 180) * Math.cos((b[0] * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(s));
}

function formatDuration(totalMinutes: number): string {
    const h = Math.floor(totalMinutes / 60);
    const m = Math.round(totalMinutes % 60);
    return h > 0 ? `${h}h${String(m).padStart(2, '0')}` : `${m} min`;
}

/**
 * Unsaved-changes guard.
 */
function useUnsavedChangesGuard(when: boolean, message: string) {
    useEffect(() => {
        if (!when) return;

        const onBeforeUnload = (e: BeforeUnloadEvent) => {
            e.preventDefault();
            e.returnValue = message;
        };

        const onClickCapture = (e: MouseEvent) => {
            const anchor = (e.target as HTMLElement)?.closest?.('a[href]');
            if (!anchor) return;
            const href = anchor.getAttribute('href') ?? '';
            if (!href.startsWith('/') || anchor.getAttribute('target') === '_blank') return;
            if (!window.confirm(message)) {
                e.preventDefault();
                e.stopPropagation();
            }
        };

        window.addEventListener('beforeunload', onBeforeUnload);
        document.addEventListener('click', onClickCapture, true);
        return () => {
            window.removeEventListener('beforeunload', onBeforeUnload);
            document.removeEventListener('click', onClickCapture, true);
        };
    }, [when, message]);
}

// ─── Sortable Partner Row ─────────────────────────────────────────────────────

function SortablePartnerRow({
    entry,
    index,
    isEditing,
    geoAreaCode,
    onRemove,
    onStartEdit,
    onHover,
    onClick,
}: {
    entry: DraftEntry;
    index: number;
    isEditing: boolean;
    geoAreaCode: string | null | undefined;
    onRemove: (id: string) => void;
    onStartEdit: (code: string) => void;
    onHover: (code: string | null) => void;
    onClick: () => void;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
        useSortable({ id: entry._id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.45 : 1,
        zIndex: isDragging ? 50 : undefined,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            onMouseEnter={() => onHover(entry.partner_code)}
            onMouseLeave={() => onHover(null)}
            onClick={onClick}
            className={`flex items-center gap-2 p-2 border rounded-lg group transition-all ${isEditing
                ? 'bg-red-50 border-red-300 shadow-sm ring-1 ring-red-200'
                : 'bg-white border-gray-200 hover:border-indigo-300 hover:shadow-sm'
                }`}
        >
            <span
                className={`w-6 h-6 shrink-0 flex items-center justify-center text-white text-[10px] font-bold ${entry.is_stop_point ? 'rounded-md bg-amber-500' : 'rounded-full bg-indigo-600'
                    }`}
                title={entry.is_stop_point ? 'Point d\'arrêt logistique' : 'Client commercial'}
            >
                {index + 1}
            </span>

            <button
                {...attributes}
                {...listeners}
                className="text-gray-300 hover:text-gray-500 cursor-grab shrink-0"
                aria-label="Réordonner"
            >
                <GripVertical className="w-3.5 h-3.5" />
            </button>

            <div className="flex-1 min-w-0">
                <p className="text-[12px] font-medium text-gray-800 truncate leading-tight">
                    {entry.name ?? entry.partner_code}
                </p>
                <div className="flex items-center gap-1.5 mt-px">
                    <p className="text-[10px] font-mono text-gray-400 truncate">{entry.partner_code}</p>
                    {geoAreaCode && (
                        <span className="text-[9px] px-1 py-px rounded bg-indigo-50 text-indigo-600 font-mono shrink-0">
                            {geoAreaCode}
                        </span>
                    )}
                </div>
            </div>

            {/* GPS-edit toggle */}
            <button
                onClick={(e) => { e.stopPropagation(); onStartEdit(entry.partner_code); }}
                title={isEditing ? 'Annuler la correction GPS' : 'Corriger la position GPS'}
                className={`p-1 shrink-0 transition-all rounded ${isEditing
                    ? 'text-white bg-red-500 opacity-100'
                    : 'text-gray-300 hover:text-blue-600 hover:bg-blue-50 opacity-0 group-hover:opacity-100'
                    }`}
            >
                <MapPin className="w-3.5 h-3.5" />
            </button>

            <button
                onClick={(e) => { e.stopPropagation(); onRemove(entry._id); }}
                className="p-1 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 shrink-0"
                title="Retirer de la tournée"
            >
                <X className="w-3.5 h-3.5" />
            </button>
        </div>
    );
}

// ─── PartnerMarker type ───────────────────────────────────────────────────────

interface PartnerMarker {
    partner_code: string;
    name: string;
    lat: number;
    lng: number;
    geo_area_code: string | null;
    is_stop_point: boolean;
    /** Full itinerary-partner record — feeds the rich popup card */
    raw: ItineraryPartner | undefined;
}

// ─── Partner Popup Card ───────────────────────────────────────────────────────

function initials(name: string): string {
    return name
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((w) => w[0])
        .join('')
        .toUpperCase();
}

function formatMoney(v: string | number | null | undefined, currency?: string | null): string | null {
    const n = toCoord(v);
    if (n == null) return null;
    return `${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} ${currency ?? 'MAD'}`;
}

const STATUS_STYLE: Record<string, { dot: string; label: string }> = {
    ACTIVE: { dot: '#22c55e', label: 'Actif' },
    BLOCKED: { dot: '#ef4444', label: 'Bloqué' },
    INACTIVE: { dot: '#9ca3af', label: 'Inactif' },
};

const CHANNEL_LABEL: Record<string, string> = {
    DETAIL: 'Détail',
    GROS: 'Gros',
    DEMI_GROS: 'Demi-gros',
    CHR: 'CHR',
};

function MiniStreetView({ lat, lng }: { lat: number; lng: number }) {
    const ref = useRef<HTMLDivElement>(null);
    const [hasStreetView, setHasStreetView] = useState<boolean | null>(null);

    useEffect(() => {
        if (!window.google) return;
        const svService = new window.google.maps.StreetViewService();
        svService.getPanorama({ location: { lat, lng }, radius: 50 }, (data, status) => {
            if (status === window.google.maps.StreetViewStatus.OK) {
                setHasStreetView(true);
            } else {
                setHasStreetView(false);
            }
        });
    }, [lat, lng]);

    useEffect(() => {
        if (hasStreetView === true && ref.current && window.google) {
            const panorama = new window.google.maps.StreetViewPanorama(ref.current, {
                position: { lat, lng },
                visible: true,
                disableDefaultUI: true,
                showRoadLabels: false,
                linksControl: false,
                panControl: false,
                enableCloseButton: false,
                zoomControl: false,
                fullscreenControl: false,
            });
            return () => {
                panorama.setVisible(false);
            };
        }
    }, [hasStreetView, lat, lng]);

    if (hasStreetView === false) {
        return (
            <div className="w-full h-full bg-indigo-50/50 flex flex-col items-center justify-center text-indigo-300 rounded-t-xl absolute inset-0">
                <MapPin className="w-6 h-6 opacity-40 mb-1" />
                <span className="text-[10px] font-medium">Aperçu indisponible</span>
            </div>
        );
    }

    return (
        <div className="w-full h-full absolute inset-0 rounded-t-xl bg-gray-100">
            {hasStreetView === true && <div ref={ref} className="w-full h-full rounded-t-xl" />}
        </div>
    );
}

function PartnerPopupCard({
    marker,
    stopNumber,
    isEditingGps,
    onEditGps,
    onClose,
}: {
    marker: PartnerMarker;
    stopNumber: number;
    isEditingGps: boolean;
    onEditGps: (code: string) => void;
    onClose: () => void;
}) {
    const p = marker.raw?.partner;
    const ip = marker.raw;
    const status = p?.status ? STATUS_STYLE[p.status] ?? { dot: '#9ca3af', label: p.status } : null;
    const address = [p?.address_line1, p?.address_line2, p?.city].filter(Boolean).join(', ');
    const creditLimit = toCoord(p?.credit_limit);
    const creditUsed = toCoord(p?.credit_used);
    const showCredit = creditLimit != null && creditLimit > 0;
    const creditPct = showCredit && creditUsed != null ? Math.min(100, (creditUsed / creditLimit!) * 100) : 0;

    return (
        <div className="font-sans text-gray-800 w-[264px] overflow-hidden rounded-xl shadow-sm">
            {/* Street View Banner */}
            <div className="h-[120px] bg-gray-100 relative">
                <MiniStreetView lat={marker.lat} lng={marker.lng} />
            </div>
            {/* Header */}
            <div className="bg-gradient-to-br from-indigo-600 to-indigo-700 px-3.5 pt-3 pb-2.5 text-white">
                <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(marker.name)}
                    </div>
                    <div className="min-w-0 flex-1 pr-4">
                        <p className="text-[13px] font-semibold leading-tight truncate">{marker.name}</p>
                        <p className="text-[10px] text-indigo-200 font-mono leading-tight mt-0.5">
                            {marker.partner_code}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="absolute top-2 right-2 text-white/70 hover:text-white"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                    <span className="text-[10px] px-1.5 py-px rounded-full bg-white/15 border border-white/20">
                        Arrêt n°{stopNumber}
                    </span>
                    {ip?.is_stop_point && (
                        <span className="text-[10px] px-1.5 py-px rounded-full bg-amber-400/30 border border-amber-300/40">
                            Stop Point
                        </span>
                    )}
                    {p?.channel && (
                        <span className="text-[10px] px-1.5 py-px rounded-full bg-white/15 border border-white/20">
                            {CHANNEL_LABEL[p.channel] ?? p.channel}
                        </span>
                    )}
                    {status && (
                        <span className="ml-auto flex items-center gap-1 text-[10px]">
                            <span
                                className="w-1.5 h-1.5 rounded-full"
                                style={{ backgroundColor: status.dot }}
                            />
                            {status.label}
                        </span>
                    )}
                </div>
            </div>

            {/* Body */}
            <div className="px-3.5 py-2.5 space-y-2 bg-white">
                {/* Visit info */}
                <div className="flex items-center gap-3 text-[11px] text-gray-600">
                    <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-gray-400" />
                        Tous les {ip?.visit_frequency_days ?? 7} j
                    </span>
                    {ip?.start_time && (
                        <span className="flex items-center gap-1">
                            <Flag className="w-3 h-3 text-gray-400" />
                            {ip.start_time}
                            {ip.end_time ? ` – ${ip.end_time}` : ''}
                        </span>
                    )}
                    {marker.geo_area_code && (
                        <span className="flex items-center gap-1 ml-auto">
                            <MapPin className="w-3 h-3 text-gray-400" />
                            {marker.geo_area_code}
                        </span>
                    )}
                </div>

                {/* Contact */}
                {(address || p?.phone || p?.whatsapp || p?.email) && (
                    <div className="border-t border-gray-100 pt-2 space-y-1">
                        {address && (
                            <p className="text-[11px] text-gray-600 flex items-start gap-1.5">
                                <MapPin className="w-3 h-3 text-gray-400 shrink-0 mt-px" />
                                <span className="leading-snug">{address}</span>
                            </p>
                        )}
                        <div className="flex items-center gap-2">
                            {p?.phone && (
                                <a
                                    href={`tel:${p.phone}`}
                                    className="text-[11px] text-indigo-600 hover:text-indigo-800 font-medium"
                                >
                                    📞 {p.phone}
                                </a>
                            )}
                            {p?.whatsapp && (
                                <a
                                    href={`https://wa.me/${p.whatsapp.replace(/[^0-9]/g, '')}`}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="text-[11px] text-green-600 hover:text-green-800 font-medium"
                                >
                                    💬 WhatsApp
                                </a>
                            )}
                        </div>
                        {p?.email && (
                            <a
                                href={`mailto:${p.email}`}
                                className="text-[11px] text-gray-500 hover:text-indigo-600 block truncate"
                            >
                                ✉️ {p.email}
                            </a>
                        )}
                    </div>
                )}

                {/* Business */}
                {(showCredit || (p?.total_orders_count ?? 0) > 0) && (
                    <div className="border-t border-gray-100 pt-2 space-y-1.5">
                        {(p?.total_orders_count ?? 0) > 0 && (
                            <div className="flex items-center justify-between text-[11px]">
                                <span className="text-gray-500">Commandes</span>
                                <span className="font-semibold text-gray-800">
                                    {p?.total_orders_count}
                                    {formatMoney(p?.total_orders_value, p?.currency)
                                        ? ` · ${formatMoney(p?.total_orders_value, p?.currency)}`
                                        : ''}
                                </span>
                            </div>
                        )}
                        {showCredit && (
                            <div>
                                <div className="flex items-center justify-between text-[11px] mb-1">
                                    <span className="text-gray-500">Crédit</span>
                                    <span className="font-semibold text-gray-800">
                                        {formatMoney(creditUsed, p?.currency)} / {formatMoney(creditLimit, p?.currency)}
                                    </span>
                                </div>
                                <div className="h-1 rounded-full bg-gray-100 overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all"
                                        style={{
                                            width: `${creditPct}%`,
                                            backgroundColor: creditPct > 85 ? '#ef4444' : creditPct > 60 ? '#f59e0b' : '#22c55e',
                                        }}
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Footer action */}
            <div className="px-3.5 pb-3 bg-white rounded-b-xl">
                <button
                    onClick={() => onEditGps(marker.partner_code)}
                    className={`w-full flex items-center justify-center gap-1.5 text-[11px] font-medium rounded-lg py-1.5 transition-colors ${isEditingGps
                        ? 'bg-red-500 text-white hover:bg-red-600'
                        : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-indigo-50 hover:text-indigo-700 hover:border-indigo-200'
                        }`}
                >
                    <MapPin className="w-3 h-3" />
                    {isEditingGps ? 'Annuler la correction GPS' : 'Corriger la position GPS'}
                </button>
            </div>
        </div>
    );
}

// ─── GeoJSON overlay (via Google Maps Data layer) ────────────────────────────

function GeoJsonLayer({
    mapRef,
    mapLayers,
    geoJsonStyle,
}: {
    mapRef: React.MutableRefObject<google.maps.Map | null>;
    mapLayers: { features: { id: unknown; properties: GeoAreaFeatureProperties; geometry: unknown }[] } | undefined;
    geoJsonStyle: (props: GeoAreaFeatureProperties | undefined) => { fillColor: string; strokeColor: string; fillOpacity: number; strokeWeight: number };
}) {
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !mapLayers || mapLayers.features.length === 0) return;

        // Clear previous data features
        map.data.forEach((f) => map.data.remove(f));
        // Add new features
        map.data.addGeoJson(mapLayers as unknown as object);
        // Apply styles
        map.data.setStyle((feature) => {
            const props = feature.getProperty('code') !== undefined
                ? ({
                    code: feature.getProperty('code'),
                    name: feature.getProperty('name'),
                    parent_code: feature.getProperty('parent_code'),
                    is_active: feature.getProperty('is_active'),
                } as GeoAreaFeatureProperties)
                : undefined;
            const s = geoJsonStyle(props);
            return {
                fillColor: s.fillColor,
                strokeColor: s.strokeColor,
                fillOpacity: s.fillOpacity,
                strokeWeight: s.strokeWeight,
                clickable: true,
            };
        });
        // Bind click popup
        const clickListener = map.data.addListener('click', (event: google.maps.Data.MouseEvent) => {
            const name = event.feature.getProperty('name') as string;
            const code = event.feature.getProperty('code') as string;
            // Simple toast — could be upgraded to an InfoWindow
            toast(`${name} (${code})`, { icon: '🗺️', duration: 2000 });
        });

        return () => {
            map.data.forEach((f) => map.data.remove(f));
            google.maps.event.removeListener(clickListener);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapLayers]);

    return null;
}

// ─── Lasso Rectangle Selector ─────────────────────────────────────────────────

function LassoController({
    enabled,
    mapRef,
    partnerMarkers,
    onSelect,
}: {
    enabled: boolean;
    mapRef: React.MutableRefObject<google.maps.Map | null>;
    partnerMarkers: PartnerMarker[];
    onSelect: (codes: string[]) => void;
}) {
    const startLatLng = useRef<google.maps.LatLng | null>(null);
    const rectRef = useRef<google.maps.Rectangle | null>(null);
    const drawingRef = useRef(false);
    const listenersRef = useRef<google.maps.MapsEventListener[]>([]);

    useEffect(() => {
        const map = mapRef.current;
        if (!map) return;

        // Clear previous listeners
        listenersRef.current.forEach((l) => google.maps.event.removeListener(l));
        listenersRef.current = [];

        if (!enabled) {
            map.setOptions({ draggable: true, gestureHandling: 'greedy' });
            map.getDiv().style.cursor = '';
            if (rectRef.current) {
                rectRef.current.setMap(null);
                rectRef.current = null;
            }
            return;
        }

        map.setOptions({ draggable: false, gestureHandling: 'none' });
        map.getDiv().style.cursor = 'crosshair';

        const onMouseDown = (e: google.maps.MapMouseEvent) => {
            if (!e.latLng) return;
            drawingRef.current = true;
            startLatLng.current = e.latLng;
        };

        const onMouseMove = (e: google.maps.MapMouseEvent) => {
            if (!drawingRef.current || !startLatLng.current || !e.latLng) return;
            const bounds = new google.maps.LatLngBounds(startLatLng.current, e.latLng);
            // Extend to cover both corners regardless of drag direction
            bounds.extend(startLatLng.current);
            bounds.extend(e.latLng);
            if (rectRef.current) {
                rectRef.current.setBounds(bounds);
            } else {
                rectRef.current = new google.maps.Rectangle({
                    map,
                    bounds,
                    strokeColor: '#4f46e5',
                    strokeWeight: 1.5,
                    fillColor: '#4f46e5',
                    fillOpacity: 0.1,
                    clickable: false,
                    zIndex: 10,
                });
            }
        };

        const onMouseUp = (e: google.maps.MapMouseEvent) => {
            if (!drawingRef.current || !startLatLng.current || !e.latLng) return;
            const start = startLatLng.current;
            const end = e.latLng;

            if (rectRef.current) {
                rectRef.current.setMap(null);
                rectRef.current = null;
            }
            drawingRef.current = false;
            startLatLng.current = null;

            // Ignore accidental clicks without a real drag
            const minDelta = 0.001;
            const hasSize =
                Math.abs(start.lat() - end.lat()) > minDelta ||
                Math.abs(start.lng() - end.lng()) > minDelta;
            if (!hasSize) return;

            const bounds = new google.maps.LatLngBounds();
            bounds.extend(start);
            bounds.extend(end);

            const selected = partnerMarkers
                .filter((m) => bounds.contains({ lat: m.lat, lng: m.lng }))
                .map((m) => m.partner_code);
            onSelect(selected);
        };

        listenersRef.current = [
            map.addListener('mousedown', onMouseDown),
            map.addListener('mousemove', onMouseMove),
            map.addListener('mouseup', onMouseUp),
        ];

        return () => {
            listenersRef.current.forEach((l) => google.maps.event.removeListener(l));
            listenersRef.current = [];
            if (rectRef.current) {
                rectRef.current.setMap(null);
                rectRef.current = null;
            }
            map.setOptions({ draggable: true, gestureHandling: 'greedy' });
            map.getDiv().style.cursor = '';
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, partnerMarkers]);

    return null;
}

// ─── Map Auto-Fit ─────────────────────────────────────────────────────────────

function MapAutoFit({
    mapRef,
    boundsData,
    fitRouteSignal,
    partnerMarkers,
}: {
    mapRef: React.MutableRefObject<google.maps.Map | null>;
    boundsData: GeoAreaBounds | undefined;
    fitRouteSignal: number;
    partnerMarkers: PartnerMarker[];
}) {
    // Zone focus
    useEffect(() => {
        const map = mapRef.current;
        if (!map || !boundsData) return;
        if (boundsData.bbox) {
            const bounds = new google.maps.LatLngBounds(
                { lat: boundsData.bbox.min_lat, lng: boundsData.bbox.min_lng },
                { lat: boundsData.bbox.max_lat, lng: boundsData.bbox.max_lng }
            );
            map.fitBounds(bounds, 30);
        } else if (boundsData.center) {
            map.setCenter({ lat: boundsData.center.lat, lng: boundsData.center.lng });
            map.setZoom(13);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [boundsData]);

    // Fit-route button
    useEffect(() => {
        const map = mapRef.current;
        if (!map || fitRouteSignal === 0 || partnerMarkers.length === 0) return;
        const bounds = new google.maps.LatLngBounds();
        partnerMarkers.forEach((m) => bounds.extend({ lat: m.lat, lng: m.lng }));
        map.fitBounds(bounds, 50);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fitRouteSignal]);

    return null;
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type DraftEntry = SyncPartnerEntry & { _id: string; name?: string };

export function ItineraryDesignerPage() {
    // ── Google Maps loader ────────────────────────────────────────────────────
    const { isLoaded: mapsLoaded } = useJsApiLoader({
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
        libraries: GOOGLE_MAPS_LIBRARIES,
    });

    const mapRef = useRef<google.maps.Map | null>(null);
    const onMapLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
    }, []);

    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedItineraryId, setSelectedItineraryId] = useState<number | null>(null);
    const [searchItinerary, setSearchItinerary] = useState('');
    const [lassoMode, setLassoMode] = useState(false);
    const [showTraffic, setShowTraffic] = useState(false);
    const [focusAreaId, setFocusAreaId] = useState<number | null>(null);
    const [draftPartners, setDraftPartners] = useState<DraftEntry[]>([]);
    const [isDirty, setIsDirty] = useState(false);
    const [legendOpen, setLegendOpen] = useState(true);
    const [fitRouteSignal, setFitRouteSignal] = useState(0);
    const [hoveredCode, setHoveredCode] = useState<string | null>(null);
    const [editingCode, setEditingCode] = useState<string | null>(null);
    const [localCoords, setLocalCoords] = useState<Record<string, { lat: number; lng: number }>>({});
    const [localAreaCodes, setLocalAreaCodes] = useState<Record<string, string | null>>({});
    const [openPopupCode, setOpenPopupCode] = useState<string | null>(null);

    // ── Data hooks ────────────────────────────────────────────────────────────
    const { data: itinerariesData, isLoading: loadingItineraries } = useItineraries({
        search: searchItinerary,
        per_page: 200,
    });
    const { data: detail, isFetching: loadingDetail } = useItinerary(selectedItineraryId);
    const { data: mapLayers } = useMapLayers({ active_only: true });
    const { data: boundsData } = useGeoRoutingBounds(focusAreaId);
    const activeAreaCode = detail?.itinerary?.geo_area?.code ?? undefined;
    const { data: geoAreasData } = useGeoAreas(
        activeAreaCode ? { parent_code: activeAreaCode, per_page: 500 } : { per_page: 500 }
    );
    const syncPartners = useSyncItineraryPartners(selectedItineraryId ?? 0);
    const bulkAssign = useBulkAssignPartners();
    const updateGps = useUpdatePartnerGpsLocation();

    const itinerary: Itinerary | undefined = detail?.itinerary;

    useUnsavedChangesGuard(
        isDirty,
        'Des modifications non sauvegardées seront perdues (ordre des arrêts). Quitter quand même ?'
    );

    // ── Select options ────────────────────────────────────────────────────────

    const itineraryOptions = useMemo(
        () =>
            (itinerariesData?.itineraries.data ?? []).map((it) => ({
                value: it.id,
                label: `${it.name} (${it.code})`,
            })),
        [itinerariesData]
    );

    const zoneOptions = useMemo(() => {
        const children = (geoAreasData?.geoAreas.data ?? []).map((a) => ({
            value: a.id,
            label: `${a.name} (${a.code})`,
        }));
        const sector = detail?.itinerary?.geo_area;
        if (sector?.id) {
            return [
                { value: sector.id, label: `🏁 ${sector.name} — secteur de la tournée` },
                ...children.filter((c) => c.value !== sector.id),
            ];
        }
        return children;
    }, [geoAreasData, detail]);

    // ── City color legend ─────────────────────────────────────────────────────

    const legendEntries = useMemo(() => {
        if (!mapLayers) return [];
        const nameByCode = new Map(
            mapLayers.features.map((f) => [f.properties.code, f.properties.name])
        );
        const areaNameByCode = new Map(
            (geoAreasData?.geoAreas.data ?? []).map((a) => [a.code, a.name])
        );
        const parents = [
            ...new Set(
                mapLayers.features
                    .map((f) => f.properties.parent_code)
                    .filter((c): c is string => c !== null)
            ),
        ];
        return parents
            .map((code) => ({
                code,
                name: nameByCode.get(code) ?? areaNameByCode.get(code) ?? code,
                color: colorForParent(code),
            }))
            .sort((a, b) => a.name.localeCompare(b.name));
    }, [mapLayers, geoAreasData]);

    const geoJsonStyle = useCallback((props: GeoAreaFeatureProperties | undefined) => {
        const color = colorForParent(props?.parent_code ?? 'ROOT');
        return {
            strokeColor: color,
            strokeWeight: 2,
            fillColor: color,
            fillOpacity: props?.is_active ? 0.15 : 0.05,
        };
    }, []);

    // ── Partner markers, ordered by draft list ────────────────────────────────

    const partnerMarkers: PartnerMarker[] = useMemo(() => {
        const partnersByCode = new Map(
            (detail?.itinerary.itinerary_partners ?? []).map((p) => [p.partner_code, p])
        );
        const mapped = draftPartners.map((d) => {
            const p = partnersByCode.get(d.partner_code);
            const local = localCoords[d.partner_code];
            const lat = local?.lat ?? toCoord(p?.partner?.geo_lat);
            const lng = local?.lng ?? toCoord(p?.partner?.geo_lng);
            if (lat == null || lng == null) return null;
            return {
                partner_code: d.partner_code,
                name: d.name ?? d.partner_code,
                lat,
                lng,
                geo_area_code: localAreaCodes[d.partner_code] ?? null,
                is_stop_point: d.is_stop_point ?? false,
                raw: p,
            } satisfies PartnerMarker;
        });
        return mapped.filter((m): m is PartnerMarker => m !== null);
    }, [detail, draftPartners, localCoords, localAreaCodes]);

    const missingGpsCount = draftPartners.length - partnerMarkers.length;

    const routePath = useMemo(
        () => partnerMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
        [partnerMarkers]
    );

    // ── Tournée KPIs ──────────────────────────────────────────────────────────
    const kpis = useMemo(() => {
        const declaredKm = draftPartners.reduce((sum, p) => sum + (p.mileage ?? 0), 0);
        let estimatedKm = 0;
        const path: [number, number][] = partnerMarkers.map((m) => [m.lat, m.lng]);
        for (let i = 1; i < path.length; i++) {
            estimatedKm += haversineKm(path[i - 1], path[i]);
        }
        const km = declaredKm > 0 ? declaredKm : estimatedKm;
        const drivingMin = (km / 30) * 60;
        const serviceMin = draftPartners.length * 8;
        return {
            stops: draftPartners.length,
            km,
            kmIsEstimate: declaredKm === 0,
            durationMin: drivingMin + serviceMin,
        };
    }, [draftPartners, partnerMarkers]);

    // ── Populate draft when itinerary loads ──────────────────────────────────

    useEffect(() => {
        if (!detail?.itinerary) return;
        const entries: DraftEntry[] = (detail.itinerary.itinerary_partners ?? []).map((p) => ({
            _id: `p-${p.id}`,
            partner_code: p.partner_code,
            rank: p.rank,
            is_stop_point: p.is_stop_point,
            start_time: p.start_time ?? undefined,
            end_time: p.end_time ?? undefined,
            mileage: p.mileage ?? undefined,
            visit_frequency_days: p.visit_frequency_days,
            notes: p.notes ?? undefined,
            name: p.partner?.name,
        }));
        setDraftPartners(entries);
        setIsDirty(false);
        setEditingCode(null);
        setLocalCoords({});
        setLocalAreaCodes({});
        setOpenPopupCode(null);
    }, [detail]);

    // ── DnD ──────────────────────────────────────────────────────────────────

    const sensors = useSensors(
        useSensor(PointerSensor),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setDraftPartners((items) => {
                const oldIdx = items.findIndex((i) => i._id === active.id);
                const newIdx = items.findIndex((i) => i._id === over.id);
                return arrayMove(items, oldIdx, newIdx);
            });
            setIsDirty(true);
        }
    }, []);

    const handleRemove = useCallback((id: string) => {
        setDraftPartners((prev) => prev.filter((p) => p._id !== id));
        setIsDirty(true);
    }, []);

    // ── Save ──────────────────────────────────────────────────────────────────

    const handleSave = async () => {
        if (!selectedItineraryId) return;
        try {
            await syncPartners.mutateAsync({
                partners: draftPartners.map((p, i) => ({
                    partner_code: p.partner_code,
                    rank: i,
                    is_stop_point: p.is_stop_point,
                    start_time: p.start_time,
                    end_time: p.end_time,
                    mileage: p.mileage,
                    visit_frequency_days: p.visit_frequency_days,
                    notes: p.notes,
                })),
            });
            toast.success('Ordre de la tournée sauvegardé.');
            setIsDirty(false);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    // ── Lasso bulk assign ─────────────────────────────────────────────────────

    const handleLassoSelect = useCallback(
        async (codes: string[]) => {
            if (codes.length === 0) {
                toast('Aucun client dans la zone sélectionnée.', { icon: '📍' });
                return;
            }
            if (!selectedItineraryId) {
                toast.error('Sélectionnez d\'abord une tournée.');
                return;
            }
            try {
                const result = await bulkAssign.mutateAsync({
                    itinerary_id: selectedItineraryId,
                    partner_codes: codes,
                    options: { default_visit_frequency_days: 7 },
                });
                toast.success(
                    `${result.added} partenaire(s) ajouté(s)` +
                    (result.already_present > 0 ? ` · ${result.already_present} déjà présent(s)` : '')
                );
            } catch (err) {
                toast.error(getErrorMessage(err));
            }
        },
        [selectedItineraryId, bulkAssign]
    );

    const handleFocusPartner = useCallback(
        (code: string) => {
            setOpenPopupCode((prev) => {
                if (prev === code) return null;
                const m = partnerMarkers.find((x) => x.partner_code === code);
                if (m && mapRef.current) {
                    mapRef.current.panTo({ lat: m.lat, lng: m.lng });
                    mapRef.current.setZoom(19);
                    mapRef.current.setTilt(45);
                }
                return code;
            });
        },
        [partnerMarkers]
    );

    // ── GPS correction ────────────────────────────────────────────────────────

    const handleEditPosition = useCallback(
        (code: string) => {
            setEditingCode((prev) => (prev === code ? null : code));
            setOpenPopupCode(null);
            if (lassoMode) setLassoMode(false);
        },
        [lassoMode]
    );

    const handleMarkerDragEnd = useCallback(
        async (code: string, latLng: google.maps.LatLng) => {
            const lat = latLng.lat();
            const lng = latLng.lng();
            setLocalCoords((prev) => ({ ...prev, [code]: { lat, lng } }));
            setEditingCode(null);
            try {
                const res = await updateGps.mutateAsync({
                    partner_code: code,
                    latitude: lat,
                    longitude: lng,
                });
                setLocalAreaCodes((prev) => ({ ...prev, [code]: res.geo_area_code }));
                toast.success(
                    res.geo_area_code
                        ? `Position sauvegardée — secteur : ${res.geo_area_code}`
                        : 'Position GPS sauvegardée.'
                );
            } catch (err) {
                setLocalCoords((prev) => {
                    const next = { ...prev };
                    delete next[code];
                    return next;
                });
                toast.error(getErrorMessage(err));
            }
        },
        [updateGps]
    );

    const stopPointCount = draftPartners.filter((p) => p.is_stop_point).length;

    // ── Google Maps options ───────────────────────────────────────────────────
    const mapOptions: google.maps.MapOptions = useMemo(() => ({
        mapTypeId: 'roadmap',
        gestureHandling: 'greedy',
        disableDefaultUI: false,
        zoomControl: true,
        mapTypeControl: true,
        mapTypeControlOptions: {
            mapTypeIds: ['roadmap', 'satellite', 'hybrid'],
        },
        streetViewControl: true,
        tilt: 45,
        fullscreenControl: false,
        styles: [
            // Subtle de-saturated style so markers & polygons pop
            { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', elementType: 'labels', stylers: [{ visibility: 'off' }] },
        ],
    }), []);

    return (
        <div className="flex overflow-hidden bg-gray-50" style={{ height: '100vh' }}>
            {/* ══ LEFT PANEL ══ */}
            <div className="w-[380px] shrink-0 flex flex-col border-r border-gray-200 bg-white shadow-sm">
                {/* Header */}
                <div className="px-4 pt-4 pb-3 border-b border-gray-100 space-y-3 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
                                <Truck className="w-4 h-4 text-white" />
                            </div>
                            <div>
                                <h1 className="text-sm font-semibold text-gray-900 leading-tight">
                                    Designer de Tournée
                                </h1>
                                <p className="text-[11px] text-gray-400 leading-tight">
                                    Sectorisation · Ordre des arrêts
                                </p>
                            </div>
                        </div>
                        {loadingDetail && <Loader2 className="w-4 h-4 text-indigo-400 animate-spin" />}
                    </div>

                    <div className="relative">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <Input
                            placeholder="Rechercher une tournée..."
                            value={searchItinerary}
                            onChange={(e) => setSearchItinerary(e.target.value)}
                            className="h-8 text-xs pl-8"
                        />
                    </div>
                    <SearchableSelect
                        options={itineraryOptions}
                        value={selectedItineraryId}
                        onChange={(v) => {
                            setSelectedItineraryId(v ? Number(v) : null);
                            setIsDirty(false);
                            setEditingCode(null);
                            setLocalCoords({});
                            setLocalAreaCodes({});
                            setFocusAreaId(null);
                            setOpenPopupCode(null);
                        }}
                        placeholder={loadingItineraries ? 'Chargement…' : '— Choisir une tournée —'}
                        clearable
                    />

                    <div className="flex items-center gap-2">
                        <Target className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                        <div className="flex-1 min-w-0">
                            <SearchableSelect
                                options={zoneOptions}
                                value={focusAreaId}
                                onChange={(v) => setFocusAreaId(v ? Number(v) : null)}
                                placeholder={
                                    activeAreaCode
                                        ? 'Zoomer sur une localité du secteur…'
                                        : 'Zoomer sur une zone…'
                                }
                                clearable
                            />
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-hidden flex flex-col">
                    {selectedItineraryId ? (
                        <>
                            {/* Stats strip */}
                            <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100 shrink-0">
                                <div className="px-3 py-2 text-center">
                                    <p className="text-lg font-semibold text-gray-900 leading-none">
                                        {draftPartners.length}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">Clients</p>
                                </div>
                                <div className="px-3 py-2 text-center">
                                    <p className="text-lg font-semibold text-gray-900 leading-none">
                                        {stopPointCount}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">Points d'arrêt</p>
                                </div>
                                <div className="px-3 py-2 text-center">
                                    <p className="text-lg font-semibold text-gray-900 leading-none">
                                        {partnerMarkers.length}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-1">Géolocalisés</p>
                                </div>
                            </div>

                            {/* Toolbar row */}
                            <div className="flex items-center justify-between px-4 py-2 border-b border-gray-100 shrink-0">
                                <div className="flex items-center gap-2">
                                    <Route className="w-3.5 h-3.5 text-gray-500" />
                                    <span className="text-xs font-medium text-gray-700">Ordre de visite</span>
                                    {isDirty && (
                                        <Badge variant="warning" className="text-[9px] px-1.5 py-0">
                                            Non sauvegardé
                                        </Badge>
                                    )}
                                </div>
                                <Button
                                    size="sm"
                                    className="h-7 text-xs"
                                    disabled={!isDirty || syncPartners.isPending}
                                    onClick={handleSave}
                                >
                                    {syncPartners.isPending ? (
                                        <Loader2 className="w-3 h-3 mr-1.5 animate-spin" />
                                    ) : (
                                        <Save className="w-3 h-3 mr-1.5" />
                                    )}
                                    Sauvegarder
                                </Button>
                            </div>

                            {/* GPS-edit banner */}
                            {editingCode && (
                                <div className="mx-3 mt-2 shrink-0 flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-xs text-red-700">
                                    <MapPin className="w-3.5 h-3.5 shrink-0 animate-bounce" />
                                    <span className="leading-snug">
                                        Glissez le marqueur <b>rouge</b> sur la carte pour corriger{' '}
                                        <span className="font-mono">{editingCode}</span>
                                    </span>
                                    <button
                                        onClick={() => setEditingCode(null)}
                                        className="ml-auto text-red-400 hover:text-red-600 shrink-0"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            )}

                            {/* Missing-GPS hint */}
                            {missingGpsCount > 0 && !editingCode && (
                                <div className="mx-3 mt-2 shrink-0 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-[11px] text-amber-700">
                                    <Info className="w-3.5 h-3.5 shrink-0 mt-px" />
                                    <span className="leading-snug">
                                        {missingGpsCount} client(s) sans coordonnées GPS — ils n'apparaissent pas
                                        sur la carte. Utilisez 📍 pour les positionner.
                                    </span>
                                </div>
                            )}

                            {/* Sortable list */}
                            <div className="flex-1 overflow-y-auto p-3">
                                {draftPartners.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-48 text-gray-400">
                                        <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center mb-3">
                                            <MapPin className="w-6 h-6" />
                                        </div>
                                        <p className="text-xs font-medium text-gray-500">Aucun arrêt dans cette tournée</p>
                                        <p className="text-[11px] mt-1 text-center max-w-[220px]">
                                            Activez le <b>Lasso</b> puis dessinez un rectangle sur la carte pour
                                            ajouter des clients en masse
                                        </p>
                                    </div>
                                ) : (
                                    <DndContext
                                        sensors={sensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={handleDragEnd}
                                    >
                                        <SortableContext
                                            items={draftPartners.map((p) => p._id)}
                                            strategy={verticalListSortingStrategy}
                                        >
                                            <div className="space-y-1.5">
                                                {draftPartners.map((entry, idx) => (
                                                    <SortablePartnerRow
                                                        key={entry._id}
                                                        entry={entry}
                                                        index={idx}
                                                        isEditing={editingCode === entry.partner_code}
                                                        geoAreaCode={localAreaCodes[entry.partner_code]}
                                                        onRemove={handleRemove}
                                                        onStartEdit={handleEditPosition}
                                                        onHover={setHoveredCode}
                                                        onClick={() => handleFocusPartner(entry.partner_code)}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                )}
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-gray-400">
                            <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center mb-4">
                                <Truck className="w-7 h-7 text-indigo-400" />
                            </div>
                            <p className="text-sm font-medium text-gray-600">Aucune tournée sélectionnée</p>
                            <p className="text-xs mt-1.5 max-w-[240px] leading-relaxed">
                                Choisissez une tournée ci-dessus pour organiser ses arrêts et visualiser
                                son parcours sur la carte
                            </p>
                        </div>
                    )}
                </div>
            </div>

            {/* ══ RIGHT: MAP ══ */}
            <div className="flex-1 min-w-0 relative h-full">
                {/* Toolbar */}
                <div className="absolute top-3 right-3 z-[1000] flex items-center gap-2">
                    {lassoMode && (
                        <div className="flex items-center gap-1.5 bg-indigo-600 text-white text-xs px-3 py-1.5 rounded-lg shadow-md animate-pulse">
                            <SquareDashed className="w-3.5 h-3.5" />
                            Dessinez un rectangle sur la carte
                        </div>
                    )}
                    <Button
                        size="sm"
                        variant={showTraffic ? 'default' : 'outline'}
                        className={`h-8 text-xs shadow-md ${showTraffic ? '' : 'bg-white/95 backdrop-blur-sm'}`}
                        onClick={() => setShowTraffic((v) => !v)}
                        title="Afficher le trafic en direct"
                    >
                        <Layers className="w-3.5 h-3.5 mr-1.5" />
                        Trafic
                    </Button>
                    <Button
                        size="sm"
                        variant={lassoMode ? 'default' : 'outline'}
                        className={`h-8 text-xs shadow-md ${lassoMode ? '' : 'bg-white/95 backdrop-blur-sm'}`}
                        onClick={() => {
                            setLassoMode((v) => !v);
                            if (editingCode) setEditingCode(null);
                        }}
                        title="Sélection rectangle : ajoutez tous les clients d'une zone à la tournée"
                    >
                        <SquareDashed className="w-3.5 h-3.5 mr-1.5" />
                        {lassoMode ? 'Annuler' : 'Lasso'}
                    </Button>
                    <Button
                        size="sm"
                        variant="outline"
                        className="h-8 text-xs shadow-md bg-white/95 backdrop-blur-sm"
                        disabled={partnerMarkers.length === 0}
                        onClick={() => setFitRouteSignal((n) => n + 1)}
                        title="Cadrer la carte sur tous les arrêts de la tournée"
                    >
                        <Maximize2 className="w-3.5 h-3.5 mr-1.5" />
                        Cadrer la tournée
                    </Button>
                </div>

                {/* Active zone chip */}
                {itinerary?.geo_area && (
                    <div className="absolute top-3 left-3 z-[1000]">
                        <button
                            className="flex items-center gap-1.5 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 shadow-md hover:bg-white hover:border-indigo-300 transition-colors"
                            onClick={() => {
                                if (itinerary?.geo_area?.id) setFocusAreaId(itinerary.geo_area.id);
                            }}
                            title="Zoomer sur la zone de cette tournée"
                        >
                            <Flag className="w-3 h-3 text-indigo-600" />
                            {itinerary.geo_area.name}
                        </button>
                    </div>
                )}

                {/* Tournée KPI summary bar */}
                {selectedItineraryId && kpis.stops > 0 && (
                    <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] flex items-center divide-x divide-gray-200 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg px-1 py-1.5">
                        <div className="flex items-center gap-1.5 px-3">
                            <Route className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold text-gray-800">{kpis.stops}</span>
                            <span className="text-[11px] text-gray-400">arrêts</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3">
                            <Maximize2 className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold text-gray-800">
                                {kpis.kmIsEstimate ? '~' : ''}
                                {kpis.km.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km
                            </span>
                            {kpis.kmIsEstimate && <span className="text-[11px] text-gray-400">est.</span>}
                        </div>
                        <div className="flex items-center gap-1.5 px-3">
                            <Clock className="w-3.5 h-3.5 text-indigo-500" />
                            <span className="text-xs font-semibold text-gray-800">
                                ~{formatDuration(kpis.durationMin)}
                            </span>
                            <span className="text-[11px] text-gray-400">est.</span>
                        </div>
                    </div>
                )}

                {/* City color legend */}
                {legendEntries.length > 0 && (
                    <div className="absolute bottom-6 left-3 z-[1000] bg-white/95 backdrop-blur-sm border border-gray-200 rounded-xl shadow-lg overflow-hidden max-w-[220px]">
                        <button
                            className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50 transition-colors"
                            onClick={() => setLegendOpen((v) => !v)}
                        >
                            <Palette className="w-3.5 h-3.5 text-gray-400" />
                            Villes / Secteurs
                            {legendOpen ? (
                                <ChevronDown className="w-3 h-3 ml-auto text-gray-400" />
                            ) : (
                                <ChevronUp className="w-3 h-3 ml-auto text-gray-400" />
                            )}
                        </button>
                        {legendOpen && (
                            <div className="px-3 pb-2.5 space-y-1 max-h-[180px] overflow-y-auto">
                                <div className="flex items-center gap-2 text-[11px] text-gray-600">
                                    <span className="w-3 h-3 rounded-full shrink-0 bg-indigo-600 border border-black/10" />
                                    <span>Client commercial</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px] text-gray-600 pb-1 mb-1 border-b border-gray-100">
                                    <span className="w-3 h-3 rounded-[3px] shrink-0 bg-amber-500 border border-black/10" />
                                    <span>Point d'arrêt logistique</span>
                                </div>
                                {legendEntries.map((e) => (
                                    <div key={e.code} className="flex items-center gap-2 text-[11px] text-gray-600">
                                        <span
                                            className="w-3 h-3 rounded-sm shrink-0 border border-black/10"
                                            style={{ backgroundColor: e.color }}
                                        />
                                        <span className="truncate">{e.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Google Map */}
                {!mapsLoaded ? (
                    <div className="flex items-center justify-center h-full bg-gray-100">
                        <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
                    </div>
                ) : (
                    <GoogleMap
                        mapContainerStyle={MAP_CONTAINER_STYLE}
                        center={DEFAULT_MAP_CENTER}
                        zoom={6}
                        options={mapOptions}
                        onLoad={onMapLoad}
                    >
                        {showTraffic && <TrafficLayer />}
                        {/* GeoJSON zone polygons via Data layer */}
                        <GeoJsonLayer
                            mapRef={mapRef}
                            mapLayers={mapLayers}
                            geoJsonStyle={geoJsonStyle}
                        />

                        {/* Route polyline: white casing + dashed indigo */}
                        {routePath.length > 1 && (
                            <>
                                <Polyline
                                    path={routePath}
                                    options={{ strokeColor: 'white', strokeWeight: 6, strokeOpacity: 0.85, zIndex: 1 }}
                                />
                                <Polyline
                                    path={routePath}
                                    options={{
                                        strokeColor: '#4f46e5',
                                        strokeWeight: 2.5,
                                        strokeOpacity: 0.9,
                                        icons: [{
                                            icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                                            offset: '0',
                                            repeat: '15px',
                                        }],
                                        zIndex: 2,
                                    }}
                                />
                            </>
                        )}

                        {/* Numbered stop markers */}
                        {partnerMarkers.map((m, idx) => {
                            const isEditingMarker = editingCode === m.partner_code;
                            const isHovered = hoveredCode === m.partner_code;
                            const isPopupOpen = openPopupCode === m.partner_code;

                            return (
                                <Marker
                                    key={m.partner_code}
                                    position={{ lat: m.lat, lng: m.lng }}
                                    icon={
                                        isEditingMarker
                                            ? editIcon()
                                            : numberedIcon(idx + 1, m.is_stop_point ?? false, isHovered)
                                    }
                                    animation={
                                        isHovered && window.google
                                            ? window.google.maps.Animation.BOUNCE
                                            : undefined
                                    }
                                    draggable={isEditingMarker}
                                    zIndex={isEditingMarker ? 1000 : isHovered ? 800 : idx}
                                    title={`${idx + 1}. ${m.name}${m.geo_area_code ? ` — ${m.geo_area_code}` : ''}`}
                                    onClick={() => {
                                        if (!isEditingMarker) {
                                            handleFocusPartner(m.partner_code);
                                        }
                                    }}
                                    onDragEnd={(e) => {
                                        if (e.latLng) {
                                            void handleMarkerDragEnd(m.partner_code, e.latLng);
                                        }
                                    }}
                                >
                                    {isPopupOpen && (
                                        <InfoWindow
                                            onCloseClick={() => setOpenPopupCode(null)}
                                            options={{ pixelOffset: new google.maps.Size(0, -16), disableAutoPan: false }}
                                        >
                                            <PartnerPopupCard
                                                marker={m}
                                                stopNumber={idx + 1}
                                                isEditingGps={isEditingMarker}
                                                onEditGps={handleEditPosition}
                                                onClose={() => setOpenPopupCode(null)}
                                            />
                                        </InfoWindow>
                                    )}
                                </Marker>
                            );
                        })}

                        {/* Lasso rectangle drawer */}
                        <LassoController
                            enabled={lassoMode}
                            mapRef={mapRef}
                            partnerMarkers={partnerMarkers}
                            onSelect={async (codes) => {
                                setLassoMode(false);
                                await handleLassoSelect(codes);
                            }}
                        />

                        {/* Auto-fit */}
                        <MapAutoFit
                            mapRef={mapRef}
                            boundsData={boundsData}
                            fitRouteSignal={fitRouteSignal}
                            partnerMarkers={partnerMarkers}
                        />
                    </GoogleMap>
                )}
            </div>
        </div>
    );
}
