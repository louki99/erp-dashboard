/**
 * Geo Hierarchy Types
 * ─────────────────────────────────────────────────────────────────────────────
 * The geo hierarchy is a **dynamic, multi-tenant tree** stored in two tables:
 *
 *   geo_area_types  – define the named levels (Pays, Région, Agence, Ville …)
 *                     each with a `rank` that establishes the ordering of
 *                     levels from broadest (low rank) to finest (high rank).
 *
 *   geo_areas       – the actual nodes of the tree.  Every node carries a
 *                     `parent_code` that points to its parent node's `code`,
 *                     and a `geo_area_type_id` that links it to its level
 *                     definition.  Nodes whose `parent_code` is null are roots.
 *
 * The hierarchy depth and the labels of each level are entirely controlled by
 * the database – **nothing is hardcoded in the frontend**.
 *
 * Example structures by company
 * ──────────────────────────────
 * Company A:  Pays → Région → Agence → Secteur → Zone
 * Company B:  Pays → Région → Ville → Zone
 * Company C:  Région → Gouvernorat → Commune
 *
 * The DynamicGeoSelector component works with ALL of the above because it only
 * follows `parent_code` links and reads labels from `geo_area_type.name`.
 */

// ─── Core entities ────────────────────────────────────────────────────────────

/**
 * One level definition returned by the API (geo_area_types table).
 * `rank` controls sort order: lower rank = broader territory.
 */
export interface GeoAreaTypeItem {
    id: number;
    code: string;       // business-level identifier, e.g. "200", "400" – opaque to UI
    name: string;       // human label used as dropdown header, e.g. "Région", "Ville"
    name_ar?: string;
    rank: number;       // sort key; do NOT treat as a magic level identifier
}

/**
 * One geographic node (geo_areas table).
 * The hierarchy is built purely from `parent_code` links.
 *
 * Note on `geo_area_type`:
 *   The API returns an embedded (denormalised) type object inside each area.
 *   That embedded object does NOT carry `rank` — only the top-level
 *   `geo_area_types` array does.  We therefore type it separately here so
 *   that the shape of API responses (GeoAreaItem in partner.types.ts) is
 *   structurally compatible with GeoAreaNode without casting.
 */
export interface GeoAreaNode {
    id: number;
    code: string;
    name: string;
    name_ar?: string;
    geo_area_type_id: number;
    parent_code: string | null;     // null  → root node
    sort_order: number;
    geo_area_type: {
        id: number;
        code: string;
        name: string;
        name_ar?: string;
        rank?: number; // present in geo_area_types list; absent in embedded objects
    };
}

// ─── Derived / computed types ─────────────────────────────────────────────────

/**
 * One breadcrumb step in a selection path from root to the chosen leaf.
 * Returned by useGeoHierarchy as `selectionPath`.
 */
export interface GeoSelectionStep {
    typeId: number;
    typeCode: string;
    typeName: string;
    areaCode: string;
    areaName: string;
}

/**
 * Everything the DynamicGeoSelector needs to render one dropdown level.
 * Produced by useGeoHierarchy.
 */
export interface GeoDropdownLevel {
    typeId: number;
    typeCode: string;
    typeName: string;               // dropdown header label
    options: GeoAreaNode[];         // items available at this depth
    selectedCode: string;           // '' means nothing selected yet
}
