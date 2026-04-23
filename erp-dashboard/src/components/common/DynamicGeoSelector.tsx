/**
 * DynamicGeoSelector
 * ─────────────────────────────────────────────────────────────────────────────
 * Fully dynamic, multi-tenant cascading geo-area picker.
 *
 * How it works
 * ─────────────
 * The component asks the useGeoHierarchy hook for the list of levels to render.
 * The hook builds this list by following `parent_code` links in the flat
 * geo_areas array – no level names, depths, or type codes are hardcoded here.
 *
 * Rendering rules
 * ────────────────
 * • One SearchableSelect per level; the label is `geo_area_type.name`.
 * • A level only appears once its parent has a selection.
 * • Selecting at level N clears all levels below N.
 * • Levels with only one option are shown (but can be auto-selected via the
 *   `autoSelectSingle` prop).
 * • An optional breadcrumb bar shows the current path (root → leaf).
 *
 * Props
 * ──────
 * • geoAreas / geoAreaTypes   raw data from the API  (no transformation needed)
 * • value                     leaf area code to restore from existing data
 * • onChange(leafCode, path)  called whenever the leaf selection changes
 * • autoSelectSingle          auto-pick when a level has only one option
 * • showBreadcrumb            render a compact "path" pill below the selects
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { ChevronRight, MapPin, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { SelectOption } from '@/components/common/SearchableSelect';
import { useGeoHierarchy } from '@/hooks/useGeoHierarchy';
import type { GeoAreaNode, GeoAreaTypeItem, GeoSelectionStep } from '@/types/geoHierarchy.types';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface DynamicGeoSelectorProps {
    /** Flat list of all geo_area nodes from the API */
    geoAreas: GeoAreaNode[];
    /** Level definitions (geo_area_types) from the API */
    geoAreaTypes: GeoAreaTypeItem[];

    /**
     * Currently selected leaf area code (controlled).
     * Pass null / '' to start unselected.
     */
    value?: string | null;

    /**
     * Fired when the leaf selection changes.
     * `leafCode` is the deepest selected code; '' means nothing selected.
     * `path` is the full breadcrumb from root to leaf.
     */
    onChange: (leafCode: string, path: GeoSelectionStep[]) => void;

    /** Disable all dropdowns */
    disabled?: boolean;

    /** Automatically select a level when it has exactly one option */
    autoSelectSingle?: boolean;

    /** Show a breadcrumb bar below the selects */
    showBreadcrumb?: boolean;

    className?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

const DynamicGeoSelector: React.FC<DynamicGeoSelectorProps> = ({
    geoAreas,
    geoAreaTypes,
    value,
    onChange,
    disabled = false,
    autoSelectSingle = true,
    showBreadcrumb = true,
    className,
}) => {
    const { levels, selectionPath, leafCode, select, reset, setFromLeafCode } =
        useGeoHierarchy({ geoAreas, geoAreaTypes });

    // ── Sync external value → internal selections ─────────────────────────────
    // Run only when `value` changes from outside (e.g. form initialised with
    // existing partner data).  Guard against infinite loop by comparing with
    // the current internal leafCode.
    const prevValueRef = useRef<string | null | undefined>(undefined);
    useEffect(() => {
        if (value === prevValueRef.current) return;
        prevValueRef.current = value;
        if (value) {
            setFromLeafCode(value);
        } else {
            reset();
        }
    }, [value, setFromLeafCode, reset]);

    // ── Auto-select single-option levels ──────────────────────────────────────
    useEffect(() => {
        if (!autoSelectSingle) return;
        for (let depth = 0; depth < levels.length; depth++) {
            const level = levels[depth];
            if (!level.selectedCode && level.options.length === 1) {
                select(depth, level.options[0].code);
                break; // Re-render will handle subsequent levels
            }
        }
    }, [levels, autoSelectSingle, select]);

    // ── Sync internal leaf → external onChange ────────────────────────────────
    const prevLeafRef = useRef<string>('');
    useEffect(() => {
        if (leafCode === prevLeafRef.current) return;
        prevLeafRef.current = leafCode;
        onChange(leafCode, selectionPath);
    }, [leafCode, selectionPath, onChange]);

    // ── Build SelectOption arrays (one per level) ─────────────────────────────
    const levelOptions = useMemo<SelectOption[][]>(
        () =>
            levels.map(level =>
                level.options.map(area => ({
                    value: area.code,
                    label: area.name,
                    sublabel: area.name_ar,
                    badge: area.code,
                })),
            ),
        [levels],
    );

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <div className={cn('space-y-2', className)}>
            {levels.map((level, depth) => (
                <div key={`${level.typeCode}-${depth}`}>
                    {/* Level label */}
                    <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase tracking-widest">
                        {level.typeName}
                    </label>
                    <SearchableSelect
                        options={levelOptions[depth]}
                        value={level.selectedCode || null}
                        onChange={v => select(depth, String(v ?? ''))}
                        placeholder={`— ${level.typeName} —`}
                        clearable
                        disabled={disabled}
                    />
                </div>
            ))}

            {/* Empty state hint */}
            {levels.length === 0 && (
                <p className="text-xs text-gray-400 italic">
                    Aucune zone géographique disponible.
                </p>
            )}

            {/* Breadcrumb */}
            {showBreadcrumb && selectionPath.length > 0 && (
                <BreadcrumbBar path={selectionPath} onClear={reset} disabled={disabled} />
            )}
        </div>
    );
};

export default DynamicGeoSelector;

// ─── BreadcrumbBar ────────────────────────────────────────────────────────────

const BreadcrumbBar: React.FC<{
    path: GeoSelectionStep[];
    onClear: () => void;
    disabled?: boolean;
}> = ({ path, onClear, disabled }) => (
    <div className="flex items-center gap-1 flex-wrap px-2.5 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
        <MapPin className="w-3 h-3 text-blue-400 shrink-0" />
        {path.map((step, i) => (
            <React.Fragment key={step.areaCode}>
                {i > 0 && <ChevronRight className="w-3 h-3 text-blue-300 shrink-0" />}
                <span className="text-[11px] font-medium text-blue-700">{step.areaName}</span>
            </React.Fragment>
        ))}
        {!disabled && (
            <button
                type="button"
                onClick={onClear}
                className="ml-auto p-0.5 hover:bg-blue-100 rounded text-blue-400 hover:text-blue-700 transition-colors"
                title="Effacer la sélection"
            >
                <X className="w-3 h-3" />
            </button>
        )}
    </div>
);
