import { useState, useEffect, useCallback } from 'react';
import { BUSINESS_DOMAINS } from '@/lib/hub/hubData';
import { favoritesApi } from '@/services/api/favoritesApi';

export interface WorkspaceFavorite {
    menuKey: string;   // "domainId.actionId" — stable backend key
    id: string;
    label: string;
    route: string;
    domainId: string;
    domainLabel: string;
    domainColor: string;
}

/** Canonical key convention: "<domainId>.<actionId>" */
export const makeMenuKey = (domainId: string, actionId: string) =>
    `${domainId}.${actionId}`;

// Module-level lookup map built once from hubData (stable, no re-computation)
const ACTION_MAP = (() => {
    const map = new Map<string, WorkspaceFavorite>();
    BUSINESS_DOMAINS.forEach(domain => {
        domain.processes.forEach(process => {
            process.actions.forEach(action => {
                const menuKey = makeMenuKey(domain.id, action.id);
                map.set(menuKey, {
                    menuKey,
                    id: action.id,
                    label: action.label,
                    route: action.route,
                    domainId: domain.id,
                    domainLabel: domain.label,
                    domainColor: domain.color,
                });
            });
        });
    });
    return map;
})();

export const useWorkspaceFavorites = () => {
    const [favorites, setFavorites] = useState<WorkspaceFavorite[]>([]);
    const [loading, setLoading] = useState(true);

    // Hydrate from backend on mount
    useEffect(() => {
        favoritesApi.getAll()
            .then(keys => {
                const favs = keys
                    .map(k => ACTION_MAP.get(k))
                    .filter((f): f is WorkspaceFavorite => !!f);
                setFavorites(favs);
            })
            .catch(() => { /* network failure: start with empty list */ })
            .finally(() => setLoading(false));
    }, []);

    /**
     * Toggle a favorite (maps to POST /favorites).
     * Applies an optimistic update immediately; reconciles with the `favorited`
     * field in the response; rolls back on network error.
     */
    const toggle = useCallback((item: WorkspaceFavorite) => {
        const menuKey = item.menuKey ?? makeMenuKey(item.domainId, item.id);
        const hydrated = { ...item, menuKey };

        // Optimistic update
        setFavorites(prev => {
            const exists = prev.some(f => f.menuKey === menuKey);
            return exists ? prev.filter(f => f.menuKey !== menuKey) : [...prev, hydrated];
        });

        favoritesApi.toggle(menuKey)
            .then(favorited => {
                // Reconcile: ensure state matches what the server decided
                setFavorites(prev => {
                    const exists = prev.some(f => f.menuKey === menuKey);
                    if (favorited && !exists) return [...prev, hydrated];
                    if (!favorited && exists) return prev.filter(f => f.menuKey !== menuKey);
                    return prev;
                });
            })
            .catch(() => {
                // Rollback: re-apply the same toggle to undo the optimistic change
                setFavorites(prev => {
                    const exists = prev.some(f => f.menuKey === menuKey);
                    return exists ? prev.filter(f => f.menuKey !== menuKey) : [...prev, hydrated];
                });
            });
    }, []);

    /**
     * Explicit remove (maps to DELETE /favorites).
     * Use for a dedicated "×" remove button where toggle semantics are undesirable.
     */
    const remove = useCallback((item: WorkspaceFavorite) => {
        const menuKey = item.menuKey ?? makeMenuKey(item.domainId, item.id);
        const hydrated = { ...item, menuKey };

        // Optimistic remove
        setFavorites(prev => prev.filter(f => f.menuKey !== menuKey));

        favoritesApi.remove(menuKey).catch(() => {
            // Rollback: re-add if the DELETE failed
            setFavorites(prev => {
                if (prev.some(f => f.menuKey === menuKey)) return prev;
                return [...prev, hydrated];
            });
        });
    }, []);

    const isFavorite = useCallback((id: string, route: string) =>
        favorites.some(f => f.id === id && f.route === route),
    [favorites]);

    return { favorites, loading, toggle, remove, isFavorite };
};
