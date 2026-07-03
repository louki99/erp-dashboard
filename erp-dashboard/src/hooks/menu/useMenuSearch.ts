import { useCallback, useMemo, useState } from 'react';
import type { FlatMenuItem, SearchMatch } from '@/lib/menu/menuUtils';
import { searchMenuItems } from '@/lib/menu/menuUtils';

export interface UseMenuSearchOptions {
  items: FlatMenuItem[];
  boostIds?: string[];
  recentIds?: string[];
  limit?: number;
}

export function useMenuSearch({
  items,
  boostIds = [],
  recentIds = [],
  limit = 50,
}: UseMenuSearchOptions) {
  const [query, setQueryState] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const matches = useMemo<SearchMatch[]>(() => {
    if (!query.trim()) return [];
    return searchMenuItems(items, query, limit);
  }, [items, query, limit]);

  const results = useMemo(() => {
    const boostSet = new Set(boostIds);
    const recentSet = new Set(recentIds);

    return matches
      .map(({ item, score }) => {
        let boostedScore = score;
        if (boostSet.has(item.id)) boostedScore += 25;
        if (recentSet.has(item.id)) boostedScore += 10;
        return { item, score: boostedScore };
      })
      .sort((a, b) => b.score - a.score)
      .map(({ item }) => item);
  }, [matches, boostIds, recentIds]);

  const setQuery = useCallback(
    (value: string) => {
      setQueryState(value);
      setSelectedIndex(0);
    },
    [setQueryState]
  );

  return {
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    results,
    resultCount: results.length,
  };
}
