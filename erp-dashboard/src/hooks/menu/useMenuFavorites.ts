import { useCallback, useEffect, useRef, useState } from 'react';
import type { FlatMenuItem } from '@/lib/menu/menuUtils';
import { resolveMenuItem } from '@/lib/menu/menuUtils';

const STORAGE_KEY_PREFIX = 'megamenu';

function getStorageKey(type: 'favorites' | 'recent', userId?: string) {
  const userPrefix = userId ? `user-${userId}` : 'guest';
  return `${STORAGE_KEY_PREFIX}-${type}-${userPrefix}`;
}

function emitUpdate(type: 'favorites' | 'recent', userId?: string) {
  window.dispatchEvent(
    new CustomEvent(`${type}-updated`, { detail: { userId } })
  );
}

function loadStoredIds(key: string): string[] {
  const raw = localStorage.getItem(key);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function loadAndMigrateIds(
  type: 'favorites' | 'recent',
  userId: string | undefined,
  allItems: FlatMenuItem[]
): string[] {
  const key = getStorageKey(type, userId);
  const stored = loadStoredIds(key);
  // Migrate legacy label-based values to stable IDs where possible.
  return stored
    .map((id) => resolveMenuItem(id, allItems)?.id ?? id)
    .filter((id, index, arr) => arr.indexOf(id) === index); // de-duplicate
}

/**
 * Manage user-specific favorite menu items.
 * Favorites are persisted by stable item ID. Legacy values saved by label are
 * migrated automatically when possible.
 */
export function useMenuFavorites(
  allItems: FlatMenuItem[],
  userId?: string,
  options: { maxItems?: number } = {}
) {
  const { maxItems = 20 } = options;

  // Lazy initializer avoids setState during render and reads storage only once.
  const [favoriteIds, setFavoriteIds] = useState<string[]>(() =>
    loadAndMigrateIds('favorites', userId, allItems)
  );
  const [recentIds, setRecentIds] = useState<string[]>(() =>
    loadAndMigrateIds('recent', userId, allItems)
  );
  const [hydrated, setHydrated] = useState(false);

  // Keep a ref to the latest items so sync effects don't re-run on every render.
  const itemsRef = useRef(allItems);
  useEffect(() => {
    itemsRef.current = allItems;
  });

  // Sync when the active user changes.
  useEffect(() => {
    setFavoriteIds(loadAndMigrateIds('favorites', userId, itemsRef.current));
    setRecentIds(loadAndMigrateIds('recent', userId, itemsRef.current));
    setHydrated(true);
  }, [userId]);

  const persist = useCallback(
    (type: 'favorites' | 'recent', ids: string[]) => {
      const key = getStorageKey(type, userId);
      if (ids.length === 0) {
        localStorage.removeItem(key);
      } else {
        localStorage.setItem(key, JSON.stringify(ids));
      }
      emitUpdate(type, userId);
    },
    [userId]
  );

  const favorites = favoriteIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is FlatMenuItem => Boolean(item));

  const recent = recentIds
    .map((id) => allItems.find((item) => item.id === id))
    .filter((item): item is FlatMenuItem => Boolean(item));

  const addRecent = useCallback(
    (item: FlatMenuItem) => {
      setRecentIds((prev) => {
        const next = [item.id, ...prev.filter((id) => id !== item.id)].slice(0, 5);
        persist('recent', next);
        return next;
      });
    },
    [persist]
  );

  const removeRecent = useCallback(
    (item: FlatMenuItem) => {
      setRecentIds((prev) => {
        const next = prev.filter((id) => id !== item.id);
        persist('recent', next);
        return next;
      });
    },
    [persist]
  );

  const clearRecent = useCallback(() => {
    setRecentIds([]);
    persist('recent', []);
  }, [persist]);

  const isFavorite = useCallback(
    (item: FlatMenuItem) => favoriteIds.includes(item.id),
    [favoriteIds]
  );

  const toggleFavorite = useCallback(
    (item: FlatMenuItem) => {
      setFavoriteIds((prev) => {
        const exists = prev.includes(item.id);
        const next = exists
          ? prev.filter((id) => id !== item.id)
          : [item.id, ...prev].slice(0, maxItems);
        persist('favorites', next);
        return next;
      });
    },
    [maxItems, persist]
  );

  // Sync across same-window instances and other tabs.
  useEffect(() => {
    const favoriteKey = getStorageKey('favorites', userId);

    const handleStorage = (e: StorageEvent) => {
      if (e.key === favoriteKey || e.key === getStorageKey('recent', userId)) {
        setFavoriteIds(loadAndMigrateIds('favorites', userId, itemsRef.current));
        setRecentIds(loadAndMigrateIds('recent', userId, itemsRef.current));
      }
    };

    const handleCustom = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.userId || detail.userId === userId) {
        setFavoriteIds(loadAndMigrateIds('favorites', userId, itemsRef.current));
        setRecentIds(loadAndMigrateIds('recent', userId, itemsRef.current));
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('favorites-updated', handleCustom);
    window.addEventListener('recent-updated', handleCustom);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('favorites-updated', handleCustom);
      window.removeEventListener('recent-updated', handleCustom);
    };
  }, [userId]);

  return {
    favorites,
    recent,
    favoriteIds,
    recentIds,
    hydrated,
    isFavorite,
    toggleFavorite,
    addRecent,
    removeRecent,
    clearRecent,
  };
}
