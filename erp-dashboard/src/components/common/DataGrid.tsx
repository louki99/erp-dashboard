import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
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
    getRowClass?: (params: any) => string;
    isRowSelectable?: (params: any) => boolean;
    defaultSelectedIds?: (row: any) => boolean; // Function to determine if a row should be selected by default
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
    getRowClass,
    isRowSelectable,
    defaultSelectedIds
}, ref) => {
    const [gridApi, setGridApi] = useState<any>(null);
    const isInitializingSelection = useRef(false);
    const previousSelectedIdsRef = useRef<Set<any>>(new Set());

    const defaultColDef = {
        flex: 1,
        minWidth: 100,
        filter: true,
        sortable: true,
        resizable: true,
        floatingFilter: true,
        cellStyle: { fontSize: '12px', display: 'flex', alignItems: 'center' },
        headerClass: 'text-xs font-semibold text-gray-600 bg-gray-50',
    };

    const onGridReady = (params: any) => {
        setGridApi(params.api);
        params.api.sizeColumnsToFit();
    };

    // Sync grid selection with external selected IDs
    useEffect(() => {
        if (!gridApi || !defaultSelectedIds || rowSelection !== 'multiple' || !rowData || rowData.length === 0) {
            return;
        }

        // Build a set of IDs that should be selected
        const shouldBeSelectedSet = new Set<any>();
        rowData.forEach(row => {
            if (defaultSelectedIds(row)) {
                // Use a unique identifier - try common ID fields
                const id = row.id || row.code || row.name || JSON.stringify(row);
                shouldBeSelectedSet.add(id);
            }
        });

        // Check if selection state has actually changed
        const hasChanged =
            shouldBeSelectedSet.size !== previousSelectedIdsRef.current.size ||
            Array.from(shouldBeSelectedSet).some(id => !previousSelectedIdsRef.current.has(id));

        if (!hasChanged) {
            return; // No change needed
        }

        // Update the ref
        previousSelectedIdsRef.current = shouldBeSelectedSet;

        // Set flag to indicate we're programmatically updating selection
        isInitializingSelection.current = true;

        // Update grid selection to match
        gridApi.forEachNode((node: any) => {
            if (node.data) {
                const shouldBeSelected = defaultSelectedIds(node.data);
                const isCurrentlySelected = node.isSelected();

                if (shouldBeSelected !== isCurrentlySelected) {
                    node.setSelected(shouldBeSelected, false, true); // suppressEvents = true
                }
            }
        });

        // Reset flag after a brief delay to allow for any pending updates
        setTimeout(() => {
            isInitializingSelection.current = false;
        }, 50);
    }, [gridApi, rowData, defaultSelectedIds, rowSelection]);

    return (
        <div className="h-full w-full mx-auto ag-theme-quartz-auto-dark">
            <style>
                {`
          .ag-theme-custom {
              --ag-header-height: 30px;
              --ag-font-size: 10px;
              --ag-header-background-color: #ccd6db;
              --ag-odd-row-background-color: #ffffff;
              --ag-row-hover-color: #f2fcf6ff;
              --ag-selected-row-background-color: #ccd6db;
              --ag-cell-horizontal-padding: 12px;
          }
          .ag-header-cell-label {
             font-weight: 600;
          }
        `}
            </style>
            <div className="h-full w-full ag-theme-custom">
                <AgGridReact
                    ref={ref}
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
                    animateRows={true}
                    headerHeight={40}
                    rowHeight={36}
                    loading={loading}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Chargement...</span>'}
                />
            </div>
        </div>
    );
});

DataGrid.displayName = 'DataGrid';
