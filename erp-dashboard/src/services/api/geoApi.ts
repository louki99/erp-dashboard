/**
 * Geo API service
 * Endpoints: /api/backend/geo/search  |  /api/backend/geo/reverse  |  /api/backend/geo/providers
 */
import apiClient from './client';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GeoItem {
    label:        string;
    country:      string | null;
    region:       string | null;
    city:         string | null;
    street:       string | null;
    postcode:     string | null;
    lat:          number;
    lng:          number;
    provider_ref: string;
}

export interface GeoSearchResponse {
    query:    string;
    provider: string;
    items:    GeoItem[];
}

export interface GeoReverseResponse {
    provider: string;
    result:   GeoItem | null;
    message?: string;
}

export interface GeoProvidersResponse {
    search_provider:  string;
    reverse_provider: string;
    supported:        string[];
    default_country:  { code: string; name: string };
}

/** Mapping from a GeoItem to partner address fields */
export interface GeoAddressFields {
    address_line1: string;
    city:          string;
    region:        string;
    country:       string;   // ISO-2 code, normalised to uppercase (e.g. "MA")
    postal_code:   string;
    geo_lat:       number | null;
    geo_lng:       number | null;
}

// ─── Normalisation helper ────────────────────────────────────────────────────

const COUNTRY_NAME_TO_CODE: Record<string, string> = {
    maroc:    'MA',
    morocco:  'MA',
    algérie:  'DZ',
    algerie:  'DZ',
    algeria:  'DZ',
    tunisie:  'TN',
    tunisia:  'TN',
    france:   'FR',
    espagne:  'ES',
    spain:    'ES',
};

function normaliseCountry(raw: string | null): string {
    if (!raw) return 'MA';
    const lc = raw.toLowerCase().trim();
    if (lc.length === 2) return lc.toUpperCase();
    return COUNTRY_NAME_TO_CODE[lc] ?? raw.slice(0, 2).toUpperCase();
}

/** Convert a GeoItem into flat partner address fields */
export function geoItemToAddress(item: GeoItem): GeoAddressFields {
    return {
        address_line1: item.street ?? item.label ?? '',
        city:          item.city    ?? '',
        region:        item.region  ?? '',
        country:       normaliseCountry(item.country),
        postal_code:   item.postcode ?? '',
        geo_lat:       item.lat  ?? null,
        geo_lng:       item.lng  ?? null,
    };
}

// ─── API calls ───────────────────────────────────────────────────────────────

export interface GeoSearchOptions {
    limit?:   number;
    lang?:    string;
    /** ISO-2 country code.  Omit to use backend default (MA).  Empty string = worldwide. */
    country?: string;
}

/** Typeahead address search.  Returns [] when q < 3 chars. */
export async function searchAddress(
    q: string,
    options: GeoSearchOptions = {},
): Promise<GeoItem[]> {
    if (!q || q.trim().length < 3) return [];

    const params: Record<string, string | number> = {
        q:     q.trim(),
        limit: options.limit ?? 8,
        lang:  options.lang  ?? 'fr',
    };
    if (options.country !== undefined) params.country = options.country;

    const { data } = await apiClient.get<GeoSearchResponse>(
        '/api/backend/geo/search',
        { params },
    );
    return data.items ?? [];
}

/** Reverse geocode: lat/lng → address */
export async function reverseGeocode(
    lat: number,
    lng: number,
    lang = 'fr',
): Promise<GeoItem | null> {
    const { data } = await apiClient.get<GeoReverseResponse>(
        '/api/backend/geo/reverse',
        { params: { lat, lng, lang } },
    );
    return data.result ?? null;
}

/** Fetch provider config (default country, etc.) */
export async function getGeoProviders(): Promise<GeoProvidersResponse> {
    const { data } = await apiClient.get<GeoProvidersResponse>(
        '/api/backend/geo/providers',
    );
    return data;
}
