import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { useState, useEffect, useRef, forwardRef, useMemo } from 'react';

ModuleRegistry.registerModules([AllCommunityModule]);

// ─── Dynamic theme from backend CSS vars ──────────────────────────────────────

function readHslVar(varName: string, fallback: string): string {
    if (typeof window === 'undefined') return fallback;
    const val = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return val ? `hsl(${val})` : fallback;
}

function useThemeColors() {
    const read = () => ({
        accent: readHslVar('--sage-500', 'hsl(158 100% 34%)'),
        light:  readHslVar('--sage-50',  'hsl(152 76% 97%)'),
    });

    const [colors, setColors] = useState(read);

    useEffect(() => {
        const mo = new MutationObserver(() => setColors(read()));
        // ThemeContext sets inline style on <html> whenever backend theme is loaded
        mo.observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
        return () => mo.disconnect();
    }, []);

    return colors;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DataGridProps {
    rowData: any[];
    columnDefs: any[];
    onRowSelected?: (data: any) => void;
    onSelectionChanged?: (rows: any[]) => void;
    onRowDoubleClicked?: (data: any) => void;
    onRowClicked?: (event: any) => void;
    onCellValueChanged?: (event: any) => void;
    rowSelection?: 'single' | 'multiple';
    loading?: boolean;
    pagination?: boolean;
    paginationPageSize?: number;
    getRowClass?: (params: any) => string;
    isRowSelectable?: (params: any) => boolean;
    /** Function to determine if a row should be selected by default */
    defaultSelectedIds?: (row: any) => boolean;
    getRowId?: (data: any) => string;
    rowHeight?: number;
    /** Override the header row height. Pass 0 to hide headers entirely. */
    headerHeight?: number;
    /** When true, columns keep their explicit widths and AG Grid shows a horizontal scrollbar */
    suppressAutoFit?: boolean;
    /**
     * Set while a row click is fetching its own detail (e.g. GET /invoices/{id}
     * after selecting a row) — distinct from `loading`, which is for the grid's
     * own row data. Shows a wait cursor over the grid and blocks further clicks
     * until it resolves, so a slow connection doesn't look unresponsive.
     */
    rowActionLoading?: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const DataGrid = forwardRef<AgGridReact, DataGridProps>(({
    rowData,
    columnDefs,
    onRowSelected,
    onSelectionChanged,
    onRowDoubleClicked,
    onRowClicked,
    onCellValueChanged,
    rowSelection = 'single',
    loading,
    pagination = false,
    paginationPageSize = 10,
    getRowClass,
    isRowSelectable,
    defaultSelectedIds,
    getRowId,
    rowHeight: customRowHeight,
    headerHeight: customHeaderHeight,
    suppressAutoFit = false,
    rowActionLoading = false,
}, ref) => {
    const [gridApi, setGridApi] = useState<any>(null);
    const isInitializingSelection = useRef(false);
    const previousSelectedIdsRef = useRef<Set<any>>(new Set());

    const { accent, light } = useThemeColors();

    // Rebuild AG Grid theme whenever brand color changes (e.g. after ThemeContext refresh)
    const gridTheme = useMemo(() => themeQuartz.withParams({
        accentColor:                accent,
        selectedRowBackgroundColor: light,
        rowHoverColor:              light,
        headerBackgroundColor:      '#f9fafb',  // gray-50 — consistent across all pages
        fontFamily:                 'Cairo, system-ui, -apple-system, sans-serif',
        fontSize:                   13,
        cellHorizontalPaddingScale: 0.8,
    }), [accent, light]);

    const defaultColDef = {
        flex: suppressAutoFit ? undefined : 1,
        minWidth: 100,
        filter: true,
        sortable: true,
        resizable: true,
        floatingFilter: true,
        cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' },
        headerClass: 'text-xs font-semibold uppercase tracking-wide text-gray-500',
    };

    const onGridReady = (params: any) => {
        setGridApi(params.api);
        if (!suppressAutoFit) {
            params.api.sizeColumnsToFit();
        }
    };

    // Sync grid selection with external selected IDs (single or multiple)
    useEffect(() => {
        if (!gridApi || !defaultSelectedIds || !rowData || rowData.length === 0) {
            return;
        }

        const shouldBeSelectedIds = new Set<any>();
        rowData.forEach((row) => {
            if (defaultSelectedIds(row)) {
                const id = row.id || row.code || row.name || JSON.stringify(row);
                shouldBeSelectedIds.add(id);
            }
        });

        const effectiveSelectedIds = rowSelection === 'single'
            ? new Set(shouldBeSelectedIds.size > 0 ? [Array.from(shouldBeSelectedIds)[0]] : [])
            : shouldBeSelectedIds;

        const hasChanged =
            effectiveSelectedIds.size !== previousSelectedIdsRef.current.size ||
            Array.from(effectiveSelectedIds).some((id) => !previousSelectedIdsRef.current.has(id));

        if (!hasChanged) return;

        previousSelectedIdsRef.current = effectiveSelectedIds;
        isInitializingSelection.current = true;

        gridApi.forEachNode((node: any) => {
            if (node.data) {
                const id = node.data.id || node.data.code || node.data.name || JSON.stringify(node.data);
                const shouldBeSelected = effectiveSelectedIds.has(id);
                const isCurrentlySelected = node.isSelected();
                if (shouldBeSelected !== isCurrentlySelected) {
                    node.setSelected(shouldBeSelected, false, true);
                }
            }
        });

        setTimeout(() => { isInitializingSelection.current = false; }, 50);
    }, [gridApi, rowData, defaultSelectedIds, rowSelection]);

    return (
        <div className="h-full w-full relative">
            <AgGridReact
                ref={ref}
                theme={gridTheme}
                rowData={rowData}
                columnDefs={columnDefs}
                defaultColDef={defaultColDef}
                rowSelection={rowSelection === 'multiple'
                    ? { mode: 'multiRow', checkboxes: true, enableClickSelection: false }
                    : { mode: 'singleRow', checkboxes: false, enableClickSelection: true }
                }
                getRowClass={getRowClass}
                isRowSelectable={isRowSelectable}
                onSelectionChanged={(event) => {
                    if (isInitializingSelection.current) return;
                    const selectedRows = event.api.getSelectedRows();
                    if (rowSelection === 'multiple' && onSelectionChanged) {
                        onSelectionChanged(selectedRows);
                    } else if (selectedRows.length > 0 && onRowSelected) {
                        onRowSelected(selectedRows[0]);
                    }
                }}
                onRowDoubleClicked={(event) => {
                    if (onRowDoubleClicked && event.data) onRowDoubleClicked(event.data);
                }}
                onRowClicked={(event) => {
                    if (onRowClicked) onRowClicked(event);
                }}
                onCellValueChanged={onCellValueChanged}
                onGridReady={onGridReady}
                getRowId={getRowId}
                animateRows={true}
                headerHeight={customHeaderHeight ?? 40}
                floatingFiltersHeight={customHeaderHeight === 0 ? 0 : undefined}
                rowHeight={customRowHeight ?? 36}
                loading={loading}
                paginationPageSize={paginationPageSize}
                pagination={pagination}
                overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Chargement...</span>'}
            />
            {rowActionLoading && (
                // Transparent, on top of every AG Grid row — guarantees the wait
                // cursor wins over the grid's own row-hover cursor (a descendant's
                // own `cursor` always beats an ancestor's, so styling the wrapper
                // alone wouldn't reliably show through). Also blocks re-clicking
                // another row while the previous click's detail is still loading.
                <div className="absolute inset-0 z-10" style={{ cursor: 'wait' }} />
            )}
        </div>
    );
});

DataGrid.displayName = 'DataGrid';
