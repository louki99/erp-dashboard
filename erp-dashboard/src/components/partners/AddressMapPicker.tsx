/**
 * AddressMapPicker
 * ─────────────────────────────────────────────────────────────────────────────
 * Full-featured address picker for the partner form:
 *
 *  • Typeahead search  — debounced GET /api/backend/geo/search
 *  • Interactive map   — Leaflet + OpenStreetMap, draggable marker
 *  • Reverse geocode   — click map / drag marker → GET /api/backend/geo/reverse
 *  • "Ma position"     — navigator.geolocation → reverse geocode
 *  • Editable fields   — address, city, region, postal_code, country, GPS
 *
 * All parent-form state is kept outside; this component only calls onChange.
 */

import React, {
    useCallback, useEffect, useMemo, useRef, useState,
} from 'react';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap, DivIcon } from 'leaflet';
import L from 'leaflet';

// Fix default Leaflet icon paths broken by bundlers
import markerIconPng   from 'leaflet/dist/images/marker-icon.png';
import markerIcon2xPng from 'leaflet/dist/images/marker-icon-2x.png';
import markerShadowPng from 'leaflet/dist/images/marker-shadow.png';
import 'leaflet/dist/leaflet.css';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconUrl:       markerIconPng,
    iconRetinaUrl: markerIcon2xPng,
    shadowUrl:     markerShadowPng,
});

import {
    Search, MapPin, Navigation, LocateFixed, Loader2,
    X, ChevronDown, ChevronUp, CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
    searchAddress, reverseGeocode, geoItemToAddress,
    type GeoItem, type GeoAddressFields,
} from '@/services/api/geoApi';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AddressValue {
    address_line1:  string;
    address_line2:  string;
    city:           string;
    region:         string;
    country:        string;
    postal_code:    string;
    geo_lat:        number | undefined;
    geo_lng:        number | undefined;
}

export interface AddressMapPickerProps {
    value:            AddressValue;
    onChange:         (fields: Partial<AddressValue>) => void;
    countryOptions?:  { value: string; label: string }[];
    className?:       string;
}

// ─── Custom pin icon ──────────────────────────────────────────────────────────

const PIN_ICON: DivIcon = L.divIcon({
    className: '',
    iconAnchor: [18, 42],
    popupAnchor: [0, -42],
    html: `<div style="
        width:36px;height:42px;
        background:linear-gradient(135deg,#4f46e5,#7c3aed);
        border-radius:50% 50% 50% 0;
        transform:rotate(-45deg);
        box-shadow:0 4px 16px rgba(79,70,229,0.5);
        border:3px solid #fff;
    ">
        <div style="
            position:absolute;top:50%;left:50%;
            transform:translate(-50%,-55%) rotate(45deg);
            width:10px;height:10px;
            background:#fff;border-radius:50%;
        "></div>
    </div>`,
});

// ─── Map click handler (inner component) ─────────────────────────────────────

interface MapClickHandlerProps {
    onClick: (lat: number, lng: number) => void;
}
const MapClickHandler: React.FC<MapClickHandlerProps> = ({ onClick }) => {
    useMapEvents({
        click: e => onClick(e.latlng.lat, e.latlng.lng),
    });
    return null;
};

// ─── Style helpers ────────────────────────────────────────────────────────────

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-400 transition-colors bg-white placeholder:text-gray-300';
const labelCls = 'block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest';

// Morocco centre as default map position
const DEFAULT_CENTER: [number, number] = [31.7917, -7.0926];
const DEFAULT_ZOOM   = 6;
const PINNED_ZOOM    = 14;

// ─── Main Component ──────────────────────────────────────────────────────────

export const AddressMapPicker: React.FC<AddressMapPickerProps> = ({
    value, onChange, countryOptions = [], className,
}) => {
    // ── Search state ──────────────────────────────────────────────────────────
    const [query,       setQuery]       = useState('');
    const [suggestions, setSuggestions] = useState<GeoItem[]>([]);
    const [searching,   setSearching]   = useState(false);
    const [showSug,     setShowSug]     = useState(false);
    const debounceRef   = useRef<ReturnType<typeof setTimeout> | null>(null);
    const searchBoxRef  = useRef<HTMLDivElement>(null);

    // ── Map state ─────────────────────────────────────────────────────────────
    const [showMap,     setShowMap]     = useState(false);
    const [mapCenter,   setMapCenter]   = useState<[number, number]>(DEFAULT_CENTER);
    const [markerPos,   setMarkerPos]   = useState<[number, number] | null>(null);
    const [reversing,   setReversing]   = useState(false);
    const [locating,    setLocating]    = useState(false);
    const mapRef        = useRef<LeafletMap | null>(null);

    // Sync marker with value lat/lng
    useEffect(() => {
        if (value.geo_lat && value.geo_lng) {
            const pos: [number, number] = [value.geo_lat, value.geo_lng];
            setMarkerPos(pos);
            setMapCenter(pos);
        }
    }, [value.geo_lat, value.geo_lng]);

    // ── Address search debounce ───────────────────────────────────────────────
    useEffect(() => {
        if (debounceRef.current) clearTimeout(debounceRef.current);
        if (query.trim().length < 3) {
            setSuggestions([]);
            setShowSug(false);
            return;
        }
        debounceRef.current = setTimeout(async () => {
            setSearching(true);
            try {
                const items = await searchAddress(query);
                setSuggestions(items);
                setShowSug(items.length > 0);
            } catch {
                setSuggestions([]);
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    }, [query]);

    // Close suggestions on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (searchBoxRef.current && !searchBoxRef.current.contains(e.target as Node)) {
                setShowSug(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, []);

    // ── Apply geo result to form fields ───────────────────────────────────────
    const applyGeoResult = useCallback((item: GeoItem) => {
        const fields = geoItemToAddress(item);
        onChange(fields);
        if (fields.geo_lat && fields.geo_lng) {
            const pos: [number, number] = [fields.geo_lat, fields.geo_lng];
            setMarkerPos(pos);
            setMapCenter(pos);
            mapRef.current?.setView(pos, PINNED_ZOOM);
        }
    }, [onChange]);

    // ── Suggestion click ──────────────────────────────────────────────────────
    const onSelectSuggestion = useCallback((item: GeoItem) => {
        applyGeoResult(item);
        setQuery(item.label);
        setSuggestions([]);
        setShowSug(false);
        if (!showMap) setShowMap(true);
    }, [applyGeoResult, showMap]);

    // ── Map click → reverse geocode ───────────────────────────────────────────
    const onMapClick = useCallback(async (lat: number, lng: number) => {
        const pos: [number, number] = [lat, lng];
        setMarkerPos(pos);
        onChange({ geo_lat: lat, geo_lng: lng });
        setReversing(true);
        try {
            const result = await reverseGeocode(lat, lng);
            if (result) applyGeoResult(result);
        } finally {
            setReversing(false);
        }
    }, [onChange, applyGeoResult]);

    // ── Marker drag ───────────────────────────────────────────────────────────
    const onMarkerDrag = useCallback(async (lat: number, lng: number) => {
        const pos: [number, number] = [lat, lng];
        setMarkerPos(pos);
        onChange({ geo_lat: lat, geo_lng: lng });
        setReversing(true);
        try {
            const result = await reverseGeocode(lat, lng);
            if (result) applyGeoResult(result);
        } finally {
            setReversing(false);
        }
    }, [onChange, applyGeoResult]);

    // ── "Ma position" ─────────────────────────────────────────────────────────
    const onMyLocation = useCallback(() => {
        if (!('geolocation' in navigator)) return;
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            async pos => {
                const { latitude: lat, longitude: lng } = pos.coords;
                setLocating(false);
                setShowMap(true);
                await onMapClick(lat, lng);
                mapRef.current?.setView([lat, lng], PINNED_ZOOM);
            },
            () => setLocating(false),
            { timeout: 10000, enableHighAccuracy: true },
        );
    }, [onMapClick]);

    // ── Has coordinates ───────────────────────────────────────────────────────
    const hasCoords = useMemo(() =>
        Boolean(value.geo_lat && value.geo_lng), [value.geo_lat, value.geo_lng]);

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className={cn('space-y-4', className)}>

            {/* ── Address search bar ───────────────────────────────────────── */}
            <div ref={searchBoxRef} className="relative">
                <label className={labelCls}>Rechercher une adresse</label>
                <div className={cn(
                    'flex items-center gap-2 px-3 py-2.5 border-2 rounded-xl transition-all bg-white',
                    showSug ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-gray-200 hover:border-gray-300',
                )}>
                    {searching
                        ? <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
                        : <Search   className="w-4 h-4 text-gray-400 shrink-0" />
                    }
                    <input
                        type="text"
                        value={query}
                        onChange={e => setQuery(e.target.value)}
                        onFocus={() => suggestions.length > 0 && setShowSug(true)}
                        placeholder="Tapez une adresse, ville ou code postal…"
                        className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-300 text-gray-800"
                    />
                    {query && (
                        <button type="button" onClick={() => { setQuery(''); setSuggestions([]); setShowSug(false); }}
                            className="p-0.5 text-gray-300 hover:text-gray-600 transition-colors shrink-0">
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onMyLocation}
                        disabled={locating}
                        className={cn(
                            'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all shrink-0',
                            locating
                                ? 'border-gray-200 text-gray-400 cursor-wait'
                                : 'border-indigo-200 text-indigo-600 hover:bg-indigo-50',
                        )}
                        title="Utiliser ma position GPS"
                    >
                        {locating
                            ? <Loader2    className="w-3.5 h-3.5 animate-spin" />
                            : <LocateFixed className="w-3.5 h-3.5" />
                        }
                        <span className="hidden sm:inline">Ma position</span>
                    </button>
                </div>

                {/* Suggestions dropdown */}
                {showSug && suggestions.length > 0 && (
                    <div className="absolute top-full left-0 right-0 z-[500] mt-1 bg-white border border-gray-200 rounded-xl shadow-xl overflow-hidden">
                        {suggestions.map((item, i) => (
                            <button
                                key={item.provider_ref ?? i}
                                type="button"
                                onMouseDown={e => { e.preventDefault(); onSelectSuggestion(item); }}
                                className="w-full flex items-start gap-3 px-4 py-3 text-left hover:bg-indigo-50 transition-colors border-b border-gray-50 last:border-0"
                            >
                                <MapPin className="w-4 h-4 text-indigo-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-800 truncate">{item.label}</p>
                                    {(item.city || item.region) && (
                                        <p className="text-xs text-gray-400 mt-0.5 truncate">
                                            {[item.city, item.region].filter(Boolean).join(' • ')}
                                        </p>
                                    )}
                                </div>
                                {item.lat && (
                                    <span className="ml-auto text-[10px] font-mono text-gray-300 shrink-0 hidden sm:block">
                                        {item.lat.toFixed(4)}, {item.lng.toFixed(4)}
                                    </span>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* ── Map toggle button ─────────────────────────────────────────── */}
            <button
                type="button"
                onClick={() => setShowMap(v => !v)}
                className={cn(
                    'w-full flex items-center justify-between px-4 py-2.5 rounded-xl border text-sm font-medium transition-all',
                    showMap
                        ? 'border-indigo-200 bg-indigo-50 text-indigo-700'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 hover:border-gray-300',
                )}
            >
                <div className="flex items-center gap-2">
                    <Navigation className="w-4 h-4" />
                    <span>{showMap ? 'Masquer la carte' : 'Afficher la carte interactive'}</span>
                    {hasCoords && !showMap && (
                        <span className="flex items-center gap-1 text-xs text-emerald-600 font-medium">
                            <CheckCircle2 className="w-3 h-3" />
                            Position définie
                        </span>
                    )}
                </div>
                {showMap ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>

            {/* ── Interactive map ───────────────────────────────────────────── */}
            {showMap && (
                <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm relative">
                    {/* Overlay while reverse-geocoding */}
                    {reversing && (
                        <div className="absolute inset-0 z-[900] flex items-center justify-center bg-white/60 backdrop-blur-[2px]">
                            <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-lg border border-gray-200">
                                <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                                <span className="text-xs text-gray-600 font-medium">Recherche de l'adresse…</span>
                            </div>
                        </div>
                    )}

                    {/* Map hint bar */}
                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-200 text-[11px] text-gray-500">
                        <MapPin className="w-3 h-3 shrink-0 text-indigo-500" />
                        <span>Cliquez sur la carte ou faites glisser le marqueur pour positionner le partenaire</span>
                        {hasCoords && (
                            <span className="ml-auto font-mono text-indigo-500 shrink-0">
                                {value.geo_lat?.toFixed(5)}, {value.geo_lng?.toFixed(5)}
                            </span>
                        )}
                    </div>

                    <MapContainer
                        center={mapCenter}
                        zoom={markerPos ? PINNED_ZOOM : DEFAULT_ZOOM}
                        style={{ height: '320px', width: '100%' }}
                        ref={mapRef as any}
                    >
                        <TileLayer
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                        />
                        <MapClickHandler onClick={onMapClick} />
                        {markerPos && (
                            <Marker
                                position={markerPos}
                                icon={PIN_ICON}
                                draggable
                                eventHandlers={{
                                    dragend: (e) => {
                                        const { lat, lng } = (e.target as any).getLatLng();
                                        onMarkerDrag(lat, lng);
                                    },
                                }}
                            />
                        )}
                    </MapContainer>
                </div>
            )}

            {/* ── Address fields ────────────────────────────────────────────── */}
            <div className="space-y-3 pt-1">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Adresse ligne 1</label>
                        <div className="relative">
                            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text"
                                value={value.address_line1}
                                onChange={e => onChange({ address_line1: e.target.value })}
                                className={`${inputCls} pl-9`}
                                placeholder="123 Rue Mohammed V"
                            />
                        </div>
                    </div>
                    <div className="sm:col-span-2">
                        <label className={labelCls}>Adresse ligne 2</label>
                        <input
                            type="text"
                            value={value.address_line2}
                            onChange={e => onChange({ address_line2: e.target.value })}
                            className={inputCls}
                            placeholder="Appartement, étage, immeuble…"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Ville</label>
                        <input
                            type="text"
                            value={value.city}
                            onChange={e => onChange({ city: e.target.value })}
                            className={inputCls}
                            placeholder="Casablanca"
                        />
                    </div>
                    <div>
                        <label className={labelCls}>Région</label>
                        <input
                            type="text"
                            value={value.region}
                            onChange={e => onChange({ region: e.target.value })}
                            className={inputCls}
                            placeholder="Grand Casablanca-Settat"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <div>
                        <label className={labelCls}>Code postal</label>
                        <input
                            type="text"
                            value={value.postal_code}
                            onChange={e => onChange({ postal_code: e.target.value })}
                            className={inputCls}
                            placeholder="20000"
                        />
                    </div>
                    <div className="col-span-1 sm:col-span-2">
                        <label className={labelCls}>Pays</label>
                        {countryOptions.length > 0 ? (
                            <select
                                value={value.country}
                                onChange={e => onChange({ country: e.target.value })}
                                className={inputCls}
                            >
                                {countryOptions.map(c => (
                                    <option key={c.value} value={c.value}>{c.label}</option>
                                ))}
                            </select>
                        ) : (
                            <input
                                type="text"
                                value={value.country}
                                onChange={e => onChange({ country: e.target.value.toUpperCase() })}
                                className={`${inputCls} font-mono uppercase`}
                                placeholder="MA"
                                maxLength={2}
                            />
                        )}
                    </div>
                </div>

                {/* GPS coordinates (read-mostly, but editable) */}
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={labelCls}>Latitude GPS</label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="number"
                                value={value.geo_lat ?? ''}
                                step="any"
                                onChange={e => onChange({ geo_lat: e.target.value ? Number(e.target.value) : undefined })}
                                className={`${inputCls} pl-9 font-mono text-xs`}
                                placeholder="33.5731"
                            />
                        </div>
                    </div>
                    <div>
                        <label className={labelCls}>Longitude GPS</label>
                        <div className="relative">
                            <Navigation className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="number"
                                value={value.geo_lng ?? ''}
                                step="any"
                                onChange={e => onChange({ geo_lng: e.target.value ? Number(e.target.value) : undefined })}
                                className={`${inputCls} pl-9 font-mono text-xs`}
                                placeholder="-7.5898"
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddressMapPicker;
