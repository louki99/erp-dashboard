import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Search, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ProductFamilySelectionDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onSelect: (code: string) => void;
    currentCode?: string;
}

export const ProductFamilySelectionDrawer = ({ 
    isOpen, 
    onClose, 
    onSelect,
    currentCode 
}: ProductFamilySelectionDrawerProps) => {
    const [families, setFamilies] = useState<ProductFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const response = await promotionsApi.getProductFamilies();
            setFamilies(response.productFamilies || []);
        } catch (error) {
            console.error('Failed to load product families', error);
            toast.error('Échec du chargement des familles de produits');
            setFamilies([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            loadFamilies();
        }
    }, [isOpen, loadFamilies]);

    const filteredFamilies = families.filter(f => 
        f.code?.toLowerCase().includes(search.toLowerCase()) ||
        f.name?.toLowerCase().includes(search.toLowerCase())
    );

    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 150,
            filter: true,
        },
        { 
            field: 'name', 
            headerName: 'Nom', 
            flex: 1, 
            filter: true 
        },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            filter: true,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            field: 'products_count',
            headerName: 'Produits',
            width: 100,
            valueFormatter: (params: any) => params.value || 0
        }
    ];

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                <div className="flex justify-between items-center p-4 border-b">
                    <h3 className="text-lg font-semibold text-gray-900">Sélectionner une Famille de Produits</h3>
                    <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-full text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par code ou nom..."
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
                                    <p className="mt-2 text-sm">Chargement des familles...</p>
                                </div>
                            </div>
                        ) : (
                            <div className="h-64">
                                <DataGrid
                                    key={`families-${filteredFamilies.length}`}
                                    rowData={filteredFamilies}
                                    columnDefs={columnDefs}
                                    loading={loading}
                                    onRowDoubleClicked={(data) => {
                                        if (data) {
                                            onSelect(data.code);
                                            onClose();
                                        }
                                    }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div className="p-4 border-t bg-gray-50 text-xs text-gray-500 flex justify-end">
                    Double-cliquez sur une ligne pour sélectionner
                </div>
            </div>
        </div>
    );
};
