import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Drawer } from '@/components/common/Drawer';
import { Package, Search } from 'lucide-react';
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
        },
        {
            headerName: 'Action',
            width: 120,
            cellRenderer: (params: any) => {
                const family = params.data as ProductFamily;
                const isSelected = family.code === currentCode;
                return (
                    <button
                        type="button"
                        onClick={() => {
                            onSelect(family.code);
                            onClose();
                        }}
                        disabled={isSelected}
                        className={`px-3 py-1 text-xs rounded transition ${
                            isSelected 
                                ? 'bg-gray-100 text-gray-400 cursor-not-allowed' 
                                : 'bg-sage-600 text-white hover:bg-sage-700'
                        }`}
                    >
                        {isSelected ? 'Sélectionné' : 'Sélectionner'}
                    </button>
                );
            },
            sortable: false,
            filter: false,
        }
    ];

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            title="Sélectionner une Famille de Produits"
            size="lg"
        >
            <div className="p-6 space-y-4">
                <div className="bg-gradient-to-r from-purple-50 to-indigo-50 p-4 rounded-lg border border-purple-100">
                    <div className="flex items-center gap-2 mb-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        <h3 className="text-sm font-semibold text-gray-900">
                            Familles de Produits
                        </h3>
                    </div>
                    <p className="text-xs text-gray-600">
                        Sélectionnez une famille de produits pour cibler cette règle de promotion.
                    </p>
                </div>

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

                <div className="h-[500px] border rounded-lg overflow-hidden">
                    <DataGrid
                        rowData={filteredFamilies}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                </div>
            </div>
        </Drawer>
    );
};
