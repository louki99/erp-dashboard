import { useMemo, useState, useEffect } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, AlertCircle, Package, TrendingDown, Search } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';

export const MagasinierStockPage = () => {
    const [data, setData] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);

    const fetchStock = async () => {
        setLoading(true);
        try {
            const res = await magasinierApi.stock.getList({
                search: searchTerm,
                low_stock: showLowStock,
            });
            setData((res as any)?.data?.stock?.data || []);
        } catch (error) {
            console.error('Failed to fetch stock:', error);
            toast.error('Échec du chargement du stock');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchStock();
    }, [searchTerm, showLowStock]);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { 
                field: 'product.code', 
                headerName: 'Code', 
                width: 120,
                valueGetter: (params: any) => params.data?.product?.code || '-'
            },
            { 
                field: 'product.name', 
                headerName: 'Produit', 
                flex: 1,
                valueGetter: (params: any) => params.data?.product?.name || '-'
            },
            { 
                field: 'quantity', 
                headerName: 'Quantité', 
                width: 110,
                valueFormatter: (params: any) => params.value || 0
            },
            { 
                field: 'reserved_quantity', 
                headerName: 'Réservé', 
                width: 110,
                valueFormatter: (params: any) => params.value || 0,
                cellStyle: { color: '#f59e0b' }
            },
            { 
                field: 'available_quantity', 
                headerName: 'Disponible', 
                width: 120,
                valueFormatter: (params: any) => params.value || 0,
                cellStyle: (params: any) => {
                    const minStock = params.data?.min_stock_level || 0;
                    if (params.value <= minStock) {
                        return { backgroundColor: '#fee', color: '#c00', fontWeight: 'bold' };
                    }
                    return { color: '#059669', fontWeight: 'bold' };
                }
            },
            { 
                field: 'min_stock_level', 
                headerName: 'Stock min', 
                width: 110,
                valueFormatter: (params: any) => params.value || 0
            },
        ],
        []
    );

    const stats = {
        total: data.length,
        lowStock: data.filter((item: any) => item.available_quantity <= (item.min_stock_level || 0)).length,
        outOfStock: data.filter((item: any) => item.available_quantity === 0).length,
    };

    const mainContent = (
        <div className="h-full flex flex-col">
            <div className="p-4 border-b border-gray-200 bg-white">
                <div className="flex items-center justify-between mb-3">
                    <div>
                        <h2 className="text-lg font-semibold text-gray-900">Gestion du stock</h2>
                        <p className="text-sm text-gray-600 mt-1">Vue d'ensemble des stocks disponibles</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setShowLowStock(!showLowStock)}
                            className={`px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                                showLowStock
                                    ? 'bg-red-100 text-red-700 border border-red-300'
                                    : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                            }`}
                        >
                            <TrendingDown className="w-4 h-4 inline mr-1" />
                            Stock faible
                        </button>
                    </div>
                </div>
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rechercher un produit..."
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                    </div>
                ) : data.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <Package className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun produit trouvé</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid
                        rowData={data}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                )}
            </div>
        </div>
    );

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col p-4">
                    <h1 className="text-sm font-semibold text-gray-900 mb-4">Statistiques</h1>
                    <div className="space-y-2">
                        <div className="bg-blue-50 rounded p-3">
                            <div className="text-xs text-gray-500">Total produits</div>
                            <div className="text-2xl font-bold text-blue-700">{stats.total}</div>
                        </div>
                        <div className="bg-orange-50 rounded p-3">
                            <div className="text-xs text-gray-500">Stock faible</div>
                            <div className="text-2xl font-bold text-orange-700">{stats.lowStock}</div>
                        </div>
                        <div className="bg-red-50 rounded p-3">
                            <div className="text-xs text-gray-500">Rupture</div>
                            <div className="text-2xl font-bold text-red-700">{stats.outOfStock}</div>
                        </div>
                    </div>
                </div>
            }
            mainContent={mainContent}
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                {
                                    icon: RefreshCw,
                                    label: 'Rafraîchir',
                                    variant: 'sage',
                                    onClick: fetchStock,
                                },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};
