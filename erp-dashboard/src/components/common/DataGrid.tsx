import { AgGridReact } from 'ag-grid-react';
import { AllCommunityModule, ModuleRegistry } from 'ag-grid-community';
import { useState, useEffect } from 'react';

// Register all Community features
ModuleRegistry.registerModules([AllCommunityModule]);

interface DataGridProps {
    rowData: any[];
    columnDefs: any[];
    onRowSelected?: (data: any) => void;
    onSelectionChanged?: (rows: any[]) => void;
    onRowDoubleClicked?: (data: any) => void;
    rowSelection?: 'single' | 'multiple';
    loading?: boolean;
    getRowClass?: (params: any) => string;
    isRowSelectable?: (params: any) => boolean;
    defaultSelectedIds?: (row: any) => boolean; // Function to determine if a row should be selected by default
}

export const DataGrid = ({ 
    rowData, 
    columnDefs, 
    onRowSelected, 
    onSelectionChanged, 
    onRowDoubleClicked, 
    rowSelection = 'single', 
    loading,
    getRowClass,
    isRowSelectable,
    defaultSelectedIds
}: DataGridProps) => {
    const [gridApi, setGridApi] = useState<any>(null);

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

    // Handle default selection after grid is ready and data is loaded
    useEffect(() => {
        if (gridApi && defaultSelectedIds && rowSelection === 'multiple' && rowData && rowData.length > 0) {
            rowData.forEach((row) => {
                if (defaultSelectedIds(row)) {
                    // Use forEachNode to find and select the matching row
                    gridApi.forEachNode((node: any) => {
                        if (node.data === row) {
                            node.setSelected(true);
                        }
                    });
                }
            });
        }
    }, [gridApi, rowData, defaultSelectedIds, rowSelection]);

    return (
        <div className="h-full w-full mx-auto ag-theme-quartz-auto-dark">
            <style>
                {`
          .ag-theme-custom {
              --ag-header-height: 32px;
              --ag-row-height: 32px;
              --ag-font-size: 12px;
              --ag-header-background-color: #f8fafc;
              --ag-odd-row-background-color: #ffffff;
              --ag-row-hover-color: #e2e8f0;
              --ag-selected-row-background-color: #dbeafe;
              --ag-cell-horizontal-padding: 12px;
          }
          .ag-header-cell-label {
             font-weight: 600;
          }
        `}
            </style>
            <div className="h-full w-full ag-theme-custom">
                <AgGridReact
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
                    onGridReady={onGridReady}
                    animateRows={true}
                    headerHeight={32}
                    rowHeight={32}
                    loading={loading}
                    overlayLoadingTemplate={'<span class="ag-overlay-loading-center">Chargement...</span>'}
                />
            </div>
        </div>
    );
};
