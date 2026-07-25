import { useCallback, useEffect, useState } from 'react';
import { telesalesApi } from '@/services/api/telesalesApi';
import {
    putProducts, getAllProducts, countProducts,
    putPartners, getPartnerById, countPartners,
    getMeta, setMeta,
} from '@/lib/telesales/offlineDb';
import type { CatalogSyncProduct, PartnerSyncRecord } from '@/types/telesalesAgent.types';

const META_KEY_LAST_SYNC = 'last_synced_at';

/**
 * Offline cache sync (docs §4.4) — pulls the full catalogue + partner dumps
 * into IndexedDB. Triggered once on session start (see TelesalesSessionBanner)
 * and manually via the "Synchroniser" action on the Catalogue/Order screens.
 */
export const useTelesalesSync = () => {
    const [syncing, setSyncing] = useState(false);
    const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
    const [productCount, setProductCount] = useState(0);
    const [partnerCount, setPartnerCount] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const refreshMeta = useCallback(async () => {
        try {
            const [meta, products, partners] = await Promise.all([
                getMeta(META_KEY_LAST_SYNC),
                countProducts(),
                countPartners(),
            ]);
            setLastSyncedAt(meta);
            setProductCount(products);
            setPartnerCount(partners);
        } catch {
            // IndexedDB unavailable (private browsing, old browser) — offline cache
            // simply stays empty, callers fall back to live API calls.
        }
    }, []);

    useEffect(() => { refreshMeta(); }, [refreshMeta]);

    const syncNow = useCallback(async () => {
        setSyncing(true);
        setError(null);
        try {
            const [catalogRes, partnersRes] = await Promise.all([
                telesalesApi.catalog.sync(),
                telesalesApi.partners.sync(),
            ]);
            await Promise.all([
                putProducts(catalogRes.products),
                putPartners(partnersRes.partners),
            ]);
            const now = new Date().toISOString();
            await setMeta(META_KEY_LAST_SYNC, now);
            await refreshMeta();
            return { products: catalogRes.products.length, partners: partnersRes.partners.length };
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Échec de la synchronisation');
            throw err;
        } finally {
            setSyncing(false);
        }
    }, [refreshMeta]);

    return { syncing, lastSyncedAt, productCount, partnerCount, error, syncNow };
};

/** Read-only accessors for screens that consume the cache without syncing it. */
export const useCachedCatalog = () => {
    const [products, setProducts] = useState<CatalogSyncProduct[]>([]);
    const [loading, setLoading] = useState(true);

    const reload = useCallback(async () => {
        setLoading(true);
        try {
            setProducts(await getAllProducts());
        } catch {
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { reload(); }, [reload]);

    return { products, loading, reload };
};

export const useCachedPartner = (partnerId: number | null) => {
    // Derived, not reset-via-effect: `fetchedForId` lets the render decide
    // whether `fetchedPartner` is still valid for the current `partnerId`,
    // instead of eagerly clearing state inside the effect body.
    const [fetchedPartner, setFetchedPartner] = useState<PartnerSyncRecord | null>(null);
    const [fetchedForId, setFetchedForId] = useState<number | null>(null);

    useEffect(() => {
        if (!partnerId) return;
        let cancelled = false;
        getPartnerById(partnerId)
            .then((p) => { if (!cancelled) { setFetchedPartner(p ?? null); setFetchedForId(partnerId); } })
            .catch(() => { if (!cancelled) { setFetchedPartner(null); setFetchedForId(partnerId); } });
        return () => { cancelled = true; };
    }, [partnerId]);

    return partnerId && fetchedForId === partnerId ? fetchedPartner : null;
};
