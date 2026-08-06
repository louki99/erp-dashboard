/**
 * TourMapView
 * ─────────────────────────────────────────────────────────────────────────────
 * Displays a single optimized delivery tour on a Google Map:
 *   • Depot marker (star pin)
 *   • Numbered stop markers in sequence_order
 *   • Polyline: depot → stops in order → depot
 *   • Fits viewport to the tour's bounding_box (GeoJSON: [lon, lat])
 */

import { useCallback, useEffect, useRef } from 'react';
import { GoogleMap, useJsApiLoader, Marker, Polyline } from '@react-google-maps/api';
import { Loader2 } from 'lucide-react';
import { GOOGLE_MAPS_API_KEY } from '@/config/googleMaps';
import type { OptimizedTour, BBoxPoint } from '@/types/route-optimizer.types';

// Colors for each tour (index = tour_number - 1, wraps)
const TOUR_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

// Convert GeoJSON [lon, lat] bounding_box to google.maps.LatLngBoundsLiteral
function bboxToBounds(bbox: BBoxPoint[]): google.maps.LatLngBoundsLiteral | null {
    if (!bbox || bbox.length === 0) return null;
    let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
    for (const [lng, lat] of bbox) {
        if (lat < minLat) minLat = lat;
        if (lat > maxLat) maxLat = lat;
        if (lng < minLng) minLng = lng;
        if (lng > maxLng) maxLng = lng;
    }
    return { south: minLat, north: maxLat, west: minLng, east: maxLng };
}

interface TourMapViewProps {
    tour: OptimizedTour;
    depot: { lat: number; lng: number };
    height?: string;
}

const MAP_OPTIONS: google.maps.MapOptions = {
    disableDefaultUI: true,
    zoomControl: true,
    gestureHandling: 'cooperative',
    styles: [
        { elementType: 'geometry', stylers: [{ color: '#1f2937' }] },
        { elementType: 'labels.text.fill', stylers: [{ color: '#9ca3af' }] },
        { elementType: 'labels.text.stroke', stylers: [{ color: '#1f2937' }] },
        { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#374151' }] },
        { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#374151' }] },
        { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#111827' }] },
        { featureType: 'poi', stylers: [{ visibility: 'off' }] },
        { featureType: 'transit', stylers: [{ visibility: 'off' }] },
    ],
};

export function TourMapView({ tour, depot, height = '280px' }: TourMapViewProps) {
    const { isLoaded } = useJsApiLoader({
        id: 'google-map-script',
        googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    });

    const mapRef = useRef<google.maps.Map | null>(null);
    const color = TOUR_COLORS[(tour.tour_number - 1) % TOUR_COLORS.length];

    const onLoad = useCallback((map: google.maps.Map) => {
        mapRef.current = map;
        const bounds = bboxToBounds(tour.bounding_box);
        if (bounds) {
            map.fitBounds(bounds, 40);
        } else {
            // fallback: fit to depot + stops
            const b = new google.maps.LatLngBounds();
            b.extend({ lat: depot.lat, lng: depot.lng });
            for (const s of tour.stops) b.extend({ lat: s.latitude, lng: s.longitude });
            map.fitBounds(b, 40);
        }
    }, [tour, depot]);

    // Re-fit when tour changes
    useEffect(() => {
        if (!mapRef.current) return;
        const bounds = bboxToBounds(tour.bounding_box);
        if (bounds) {
            mapRef.current.fitBounds(bounds, 40);
        }
    }, [tour]);

    const sortedStops = [...tour.stops].sort((a, b) => a.sequence_order - b.sequence_order);

    // Polyline path: depot → stops in order → depot
    const polylinePath = [
        { lat: depot.lat, lng: depot.lng },
        ...sortedStops.map(s => ({ lat: s.latitude, lng: s.longitude })),
        { lat: depot.lat, lng: depot.lng },
    ];

    if (!isLoaded) {
        return (
            <div
                style={{ height }}
                className="flex items-center justify-center rounded-xl bg-white/5 border border-white/10"
            >
                <Loader2 size={20} className="animate-spin text-white/30" />
            </div>
        );
    }

    return (
        <div style={{ height }} className="rounded-xl overflow-hidden border border-white/10">
            <GoogleMap
                mapContainerStyle={{ width: '100%', height: '100%' }}
                zoom={12}
                center={depot}
                options={MAP_OPTIONS}
                onLoad={onLoad}
            >
                {/* Depot marker */}
                <Marker
                    position={{ lat: depot.lat, lng: depot.lng }}
                    label={{ text: 'D', color: '#fff', fontWeight: 'bold', fontSize: '12px' }}
                    icon={{
                        path: google.maps.SymbolPath.CIRCLE,
                        scale: 12,
                        fillColor: '#f59e0b',
                        fillOpacity: 1,
                        strokeColor: '#ffffff',
                        strokeWeight: 2,
                    }}
                />

                {/* Stop markers */}
                {sortedStops.map(stop => (
                    <Marker
                        key={stop.sequence_order}
                        position={{ lat: stop.latitude, lng: stop.longitude }}
                        label={{
                            text: String(stop.sequence_order),
                            color: '#fff',
                            fontWeight: 'bold',
                            fontSize: '11px',
                        }}
                        icon={{
                            path: google.maps.SymbolPath.CIRCLE,
                            scale: 10,
                            fillColor: color,
                            fillOpacity: 1,
                            strokeColor: '#ffffff',
                            strokeWeight: 2,
                        }}
                    />
                ))}

                {/* Route polyline */}
                <Polyline
                    path={polylinePath}
                    options={{
                        strokeColor: color,
                        strokeOpacity: 0.85,
                        strokeWeight: 3,
                        geodesic: true,
                    }}
                />
            </GoogleMap>
        </div>
    );
}
