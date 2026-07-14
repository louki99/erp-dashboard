import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry, themeQuartz } from 'ag-grid-community';
import { useState, useEffect, useRef, forwardRef } from 'react';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

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
    defaultSelectedIds?: (row: any) => boolean; // Function to determine if a row should be selected by default
    getRowId?: (data: any) => string;
    rowHeight?: number;
    /** When true, columns keep their explicit widths and AG Grid shows a horizontal scrollbar */
    suppressAutoFit?: boolean;
}

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
    suppressAutoFit = false,
}, ref) => {
    const [gridApi, setGridApi] = useState<any>(null);
    const isInitializingSelection = useRef(false);
    const previousSelectedIdsRef = useRef<Set<any>>(new Set());

    const defaultColDef = {
        flex: suppressAutoFit ? undefined : 1,
        minWidth: 100,
        filter: true,
        sortable: true,
        resizable: true,
        floatingFilter: true,
        cellStyle: { fontSize: '13px', display: 'flex', alignItems: 'center' },
        headerClass: 'text-xs font-semibold uppercase tracking-wide text-gray-600 bg-gray-50',
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

        // For single selection, keep only the first matching row
        const effectiveSelectedIds = rowSelection === 'single'
            ? new Set(shouldBeSelectedIds.size > 0 ? [Array.from(shouldBeSelectedIds)[0]] : [])
            : shouldBeSelectedIds;

        const hasChanged =
            effectiveSelectedIds.size !== previousSelectedIdsRef.current.size ||
            Array.from(effectiveSelectedIds).some((id) => !previousSelectedIdsRef.current.has(id));

        if (!hasChanged) {
            return;
        }

        previousSelectedIdsRef.current = effectiveSelectedIds;
        isInitializingSelection.current = true;

        gridApi.forEachNode((node: any) => {
            if (node.data) {
                const id = node.data.id || node.data.code || node.data.name || JSON.stringify(node.data);
                const shouldBeSelected = effectiveSelectedIds.has(id);
                const isCurrentlySelected = node.isSelected();

                if (shouldBeSelected !== isCurrentlySelected) {
                    node.setSelected(shouldBeSelected, false, true); // suppressEvents = true
                }
            }
        });

        setTimeout(() => {
            isInitializingSelection.current = false;
        }, 50);
    }, [gridApi, rowData, defaultSelectedIds, rowSelection]);

    return (
        <div className="ag-theme-sage h-full w-full">
            <AgGridReact
                    ref={ref}
                    theme={themeQuartz}
                    rowData={rowData}
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowSelection={rowSelection === 'multiple'
                        ? { mode: "multiRow", checkboxes: true, enableClickSelection: false }
                        : { mode: "singleRow", checkboxes: false, enableClickSelection: true }
                    }
                    getRowClass={getRowClass}
                    isRowSelectable={isRowSelectable}
                    onSelectionChanged={(event) => {
                        // Skip callback if we're programmatically updating selection
                        if (isInitializingSelection.current) {
                            return;
                        }

                        const selectedRows = event.api.getSelectedRows();
                        if (rowSelection === 'multiple' && onSelectionChanged) {
                            onSelectionChanged(selectedRows);
                        } else if (selectedRows.length > 0 && onRowSelected) {
                            onRowSelected(selectedRows[0]);
                        }
                    }}
                    onRowDoubleClicked={(event) => {
                        if (onRowDoubleClicked && event.data) {
                            onRowDoubleClicked(event.data);
                        }
                    }}
                    onRowClicked={(event) => {
                        if (onRowClicked) {
                            onRowClicked(event);
                        }
                    }}
                    onCellValueChanged={onCellValueChanged}
                    onGridReady={onGridReady}
                    getRowId={getRowId}
                    animateRows={true}
                    headerHeight={40}
                    rowHeight={customRowHeight ?? 36}
                    loading={loading}
                    paginationPageSize={paginationPageSize}
                    pagination={pagination}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Loading...</span>'}
                />
        </div>
    );
});

DataGrid.displayName = 'DataGrid';
