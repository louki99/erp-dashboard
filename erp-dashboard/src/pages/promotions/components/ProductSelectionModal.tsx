import { useState, useEffect, useCallback } from 'react';
import { productsApi } from '@/services/api/productsApi';
import type { Product } from '@/types/product.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Search, X } from 'lucide-react';


interface ProductSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (productCode: string) => void;
}

export const ProductSelectionModal = ({ isOpen, onClose, onSelect }: ProductSelectionModalProps) => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadProducts = useCallback(async (searchTerm: string = '') => {
        setLoading(true);
        try {
            const apiResponse = await productsApi.getList({ search: searchTerm || undefined });

            // Handle the response structure: { success: true, data: { data: [...] } }
            if (apiResponse?.success && apiResponse?.data?.data && Array.isArray(apiResponse.data.data)) {
                setProducts(apiResponse.data.data);
                console.log('Loaded products:', apiResponse.data.data.length);
            } else {
                console.warn('Unexpected API response structure:', apiResponse);
                setProducts([]);
            }

        } catch (error) {
            console.error("Failed to load products", error);
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, []);

    // Debounce search - also handles initial load
    useEffect(() => {
        if (!isOpen) return;

        const timer = setTimeout(() => {
            loadProducts(search);
        }, 300); // 300ms debounce

        return () => clearTimeout(timer);
    }, [search, isOpen, loadProducts]); // Reload when search changes (debounced)

    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 120,
            filter: true,
            valueFormatter: (params: any) => params.value || 'N/A'
        },
        { field: 'name', headerName: 'Name', flex: 1, filter: true },
        {
            field: 'price',
            headerName: 'Price',
            width: 100,
            valueFormatter: (params: any) => params.value ? `${Number(params.value).toFixed(2)}` : 'N/A'
        },
        {
            field: 'quantity',
            headerName: 'Stock',
            width: 90,
            valueFormatter: (params: any) => params.value ?? 'N/A'
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Select Product</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by code or name..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-sage-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="flex-1 min-h-0 p-4">
                    <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                        {loading ? (
                            <div className="flex items-center justify-center h-full text-gray-500">
                                <div className="text-center">
                                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-sage-600 mx-auto"></div>
                                    <p className="mt-2 text-sm">Loading products...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-64">
                                <DataGrid
                                    key={`products-${products.length}`}
                                    rowData={products}
                                    columnDefs={columnDefs}
                                    loading={loading}
                                    onRowDoubleClicked={(data) => {
                                        if (data) {
                                            // Use code if available, otherwise use ID
                                            const productCode = data.code || `PROD-${data.id}`;
                                            onSelect(productCode);
                                            onClose();
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 text-xs text-gray-500 flex justify-end">
                    Double click a row to select
                </div>
            </div>
        </div>
    );
};
