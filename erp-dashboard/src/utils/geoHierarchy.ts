/**
 * Geo Hierarchy – pure utility functions
 * ─────────────────────────────────────────────────────────────────────────────
 * All functions are pure (no side-effects) and are designed to be used inside
 * React `useMemo` calls so the results are stable between renders.
 *
 * Architecture note
 * ─────────────────
 * The tree is built lazily: we never materialise the full tree at once.
 * Instead we build a `childrenMap`  (parent_code → GeoAreaNode[])  once, then
 * derive whatever view we need by walking one level at a time.  This keeps
 * memory usage O(n) and avoids unnecessary work.
 */

import type { GeoAreaNode, GeoAreaTypeItem, GeoDropdownLevel, GeoSelectionStep } from '@/types/geoHierarchy.types';

// ─── Tree index ───────────────────────────────────────────────────────────────

/**
 * Build an index:  parent_code (or null for roots) → sorted children.
 *
 * O(n) time and space.  Should be wrapped in `useMemo` so it is computed
 * only when the `geoAreas` array reference changes.
 */
export function buildChildrenMap(areas: GeoAreaNode[]): Map<string | null, GeoAreaNode[]> {
    const map = new Map<string | null, GeoAreaNode[]>();

    for (const area of areas) {
        const key = area.parent_code ?? null;
        let bucket = map.get(key);
        if (!bucket) {
            bucket = [];
            map.set(key, bucket);
        }
        bucket.push(area);
    }

    // Sort each bucket so dropdown options are ordered consistently
    for (const bucket of map.values()) {
        bucket.sort((a, b) => a.sort_order - b.sort_order);
    }

    return map;
}

/**
 * Build a direct-access index:  area.code → GeoAreaNode.
 * Used for ancestor-chain resolution in `buildSelectionsFromLeaf`.
 */
export function buildAreaMap(areas: GeoAreaNode[]): Map<string, GeoAreaNode> {
    return new Map(areas.map(a => [a.code, a]));
}

// ─── Level computation ────────────────────────────────────────────────────────

/**
 * Compute the ordered list of dropdown levels to render given the current
 * selection state.
 *
 * Algorithm (iterative, not recursive to avoid stack issues on deep trees):
 *   1. Start at parentCode = null  (root)
 *   2. Look up children from childrenMap
 *   3. If children exist, push a GeoDropdownLevel for them
 *   4. If a selection exists at the current depth, advance to that code
 *   5. Otherwise stop – no more levels to show until user selects
 *
 * This naturally handles any hierarchy depth without hardcoding levels.
 *
 * @param childrenMap  pre-built by buildChildrenMap()
 * @param selections   array of selected area codes, one per depth level
 * @param geoAreaTypes full list used to look up type info (rank etc.)
 */
export function computeLevels(
    childrenMap: Map<string | null, GeoAreaNode[]>,
    selections: readonly string[],
    geoAreaTypes: GeoAreaTypeItem[],
): GeoDropdownLevel[] {
    const typeById = new Map(geoAreaTypes.map(t => [t.id, t]));
    const levels: GeoDropdownLevel[] = [];

    let parentCode: string | null = null;
    let depth = 0;

    while (true) {
        const children = childrenMap.get(parentCode);
        if (!children || children.length === 0) break;

        // Determine the type of this level from the first child
        // (all siblings share the same type in a well-formed hierarchy)
        const firstChild = children[0];
        // Prefer the full type definition (has rank); fall back to embedded object
        const typeInfo = typeById.get(firstChild.geo_area_type_id) ?? {
            id: firstChild.geo_area_type_id,
            code: firstChild.geo_area_type.code,
            name: firstChild.geo_area_type.name,
            rank: firstChild.geo_area_type.rank ?? 0,
        };

        const selectedCode = selections[depth] ?? '';

        levels.push({
            typeId: typeInfo.id,
            typeCode: typeInfo.code,
            typeName: typeInfo.name,
            options: children,
            selectedCode,
        });

        // Stop if nothing is selected at this depth
        if (!selectedCode) break;

        parentCode = selectedCode;
        depth++;
    }

    return levels;
}

// ─── Path helpers ─────────────────────────────────────────────────────────────

/**
 * Build the human-readable selection path (breadcrumbs) from the levels array.
 * Only includes levels that have an active selection.
 */
export function buildSelectionPath(levels: GeoDropdownLevel[]): GeoSelectionStep[] {
    return levels
        .filter(l => l.selectedCode)
        .map(l => {
            const area = l.options.find(o => o.code === l.selectedCode);
            return {
                typeId: l.typeId,
                typeCode: l.typeCode,
                typeName: l.typeName,
                areaCode: l.selectedCode,
                areaName: area?.name ?? l.selectedCode,
            };
        });
}

/**
 * Reconstruct the `selections` array from a leaf area code.
 *
 * Walks the ancestor chain upward via `parent_code` until a root is reached,
 * then reverses the chain to get it in root-to-leaf order.
 *
 * Returns [] when `leafCode` is empty or not found in `areaMap`.
 */
export function buildSelectionsFromLeaf(
    leafCode: string,
    areaMap: Map<string, GeoAreaNode>,
): string[] {
    if (!leafCode) return [];

    const chain: string[] = [];
    let current = areaMap.get(leafCode);

    while (current) {
        chain.unshift(current.code);
        current = current.parent_code ? areaMap.get(current.parent_code) : undefined;
    }

    return chain;
}
