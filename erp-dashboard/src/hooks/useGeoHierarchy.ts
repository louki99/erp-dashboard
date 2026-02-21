/**
 * useGeoHierarchy
 * ─────────────────────────────────────────────────────────────────────────────
 * React hook that manages the cascading selection state for the dynamic
 * geo hierarchy.
 *
 * Design principles
 * ─────────────────
 * • The hook owns the internal `selections: string[]` state array where
 *   selections[depth] = the area code selected at that depth.
 *
 * • Calling `select(depth, code)` trims all selections deeper than `depth`
 *   and appends the new code.  This is the "cascade reset" behaviour:
 *   changing a parent level always clears its children.
 *
 * • `setFromLeafCode` reconstructs the full selections array from a single
 *   leaf code (useful when loading existing data from the API).
 *
 * • All expensive computations (tree index, levels, path) are wrapped in
 *   useMemo so they only recompute when their specific dependencies change.
 */

import { useCallback, useMemo, useState } from 'react';
import type { GeoAreaNode, GeoAreaTypeItem, GeoDropdownLevel, GeoSelectionStep } from '@/types/geoHierarchy.types';
import {
    buildAreaMap,
    buildChildrenMap,
    buildSelectionPath,
    buildSelectionsFromLeaf,
    computeLevels,
} from '@/utils/geoHierarchy';

// ─── Public interface ─────────────────────────────────────────────────────────

export interface UseGeoHierarchyOptions {
    /** All geo_area nodes from the API  */
    geoAreas: GeoAreaNode[];
    /** All geo_area_type level definitions from the API */
    geoAreaTypes: GeoAreaTypeItem[];
}

export interface UseGeoHierarchyResult {
    /**
     * Ordered array of levels to render, one per depth.
     * The list grows as the user makes selections; it only shows levels that
     * are reachable from the current selection.
     */
    levels: GeoDropdownLevel[];

    /**
     * Raw selections array: selections[depth] = selected area code.
     * Can be inspected but should generally be mutated via `select`.
     */
    selections: readonly string[];

    /**
     * Breadcrumb path for the current selection (root → leaf).
     * Each step carries the type metadata and area name.
     */
    selectionPath: GeoSelectionStep[];

    /**
     * Code of the deepest selected area (the "leaf"), or '' if nothing is
     * selected.  This is the value that should be sent to the API as
     * `geo_area_code`.
     */
    leafCode: string;

    /**
     * Select an area at a given depth.
     * All deeper selections are automatically cleared.
     * Pass code = '' to clear from this depth downward.
     */
    select: (depth: number, code: string) => void;

    /** Clear all selections. */
    reset: () => void;

    /**
     * Reconstruct the selection path from a leaf code.
     * Call this when initialising the component from existing partner data.
     */
    setFromLeafCode: (leafCode: string) => void;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGeoHierarchy({
    geoAreas,
    geoAreaTypes,
}: UseGeoHierarchyOptions): UseGeoHierarchyResult {

    const [selections, setSelections] = useState<string[]>([]);

    // ── Stable indexes (recomputed only when the input data changes) ──────────

    const childrenMap = useMemo(() => buildChildrenMap(geoAreas), [geoAreas]);
    const areaMap     = useMemo(() => buildAreaMap(geoAreas),     [geoAreas]);

    // ── Derived view (recomputed when selections or indexes change) ───────────

    const levels = useMemo(
        () => computeLevels(childrenMap, selections, geoAreaTypes),
        [childrenMap, selections, geoAreaTypes],
    );

    const selectionPath = useMemo(
        () => buildSelectionPath(levels),
        [levels],
    );

    const leafCode = selectionPath[selectionPath.length - 1]?.areaCode ?? '';

    // ── Mutation helpers ──────────────────────────────────────────────────────

    const select = useCallback((depth: number, code: string) => {
        setSelections(prev => {
            // Keep everything above this depth, optionally append the new code
            const next = prev.slice(0, depth);
            if (code) next.push(code);
            return next;
        });
    }, []);

    const reset = useCallback(() => setSelections([]), []);

    const setFromLeafCode = useCallback((leafCode: string) => {
        const chain = buildSelectionsFromLeaf(leafCode, areaMap);
        setSelections(chain);
    }, [areaMap]);

    return { levels, selections, selectionPath, leafCode, select, reset, setFromLeafCode };
}
