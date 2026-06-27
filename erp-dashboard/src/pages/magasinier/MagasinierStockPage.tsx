import { useEffect, useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { Loader2, RefreshCw, Package, TrendingDown, Search, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { magasinierApi } from '@/services/api/magasinierApi';
import type { Stock } from '@/types/magasinier.types';

export const MagasinierStockPage = () => {
    const [data, setData] = useState<Stock[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showLowStock, setShowLowStock] = useState(false);

    const fetchStock = async () => {
        setLoading(true);
        setError(null);
        try {
            // GET /magasinier/stock returns the raw Laravel paginator directly (docs §8.1) — flat,
            // `res.data` IS the row array, no `data.stock.data` wrapper.
            const res = await magasinierApi.stock.getList({
                search: searchTerm || undefined,
                low_stock: showLowStock || undefined,
            });
            setData(res?.data ?? []);
        } catch (err) {
            console.error('Failed to fetch stock:', err);
            setError(err instanceof Error ? err.message : 'Échec du chargement du stock');
            toast.error('Échec du chargement du stock');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const t = setTimeout(fetchStock, searchTerm ? 300 : 0);
        return () => clearTimeout(t);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [searchTerm, showLowStock]);

    const columnDefs = useMemo<ColDef[]>(
        () => [
            {
                field: 'product.sku',
                headerName: 'SKU',
                width: 130,
                valueGetter: (params: any) => params.data?.product?.sku || '-'
            },
            {
                field: 'product.name',
                headerName: 'Produit',
                flex: 1,
                minWidth: 180,
                valueGetter: (params: any) => params.data?.product?.name || '-'
            },
            {
                field: 'warehouse_code',
                headerName: 'Entrepôt',
                width: 110,
                valueFormatter: (params: any) => params.value || '-'
            },
            {
                field: 'quantity',
                headerName: 'Quantité',
                width: 100,
                valueFormatter: (params: any) => params.value ?? 0
            },
            {
                field: 'reserved_quantity',
                headerName: 'Réservé',
                width: 100,
                valueFormatter: (params: any) => params.value ?? 0,
                cellStyle: { color: '#d97706' }
            },
            {
                field: 'available_quantity',
                headerName: 'Disponible',
                width: 110,
                valueFormatter: (params: any) => params.value ?? 0,
                cellStyle: (params: any): { backgroundColor?: string; color: string; fontWeight: string } => {
                    const minQty = params.data?.minimum_quantity ?? 0;
                    if ((params.value ?? 0) <= minQty) {
                        return { backgroundColor: '#fee2e2', color: '#b91c1c', fontWeight: 'bold' };
                    }
                    return { color: '#059669', fontWeight: 'bold' };
                }
            },
            {
                field: 'minimum_quantity',
                headerName: 'Seuil min',
                width: 100,
                valueFormatter: (params: any) => params.value ?? 0
            },
        ],
        []
    );

    const stats = useMemo(() => ({
        total: data.length,
        lowStock: data.filter((item) => item.available_quantity <= (item.minimum_quantity ?? 0)).length,
        outOfStock: data.filter((item) => item.available_quantity <= 0).length,
    }), [data]);

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <div className="flex items-center justify-between mb-5">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Gestion du stock</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Vue d'ensemble des stocks disponibles en temps réel</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowLowStock(!showLowStock)}
                            className={`flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl transition-all duration-200 shadow-sm hover:shadow ${
                                showLowStock
                                    ? 'bg-gradient-to-r from-red-500 to-rose-600 text-white border-transparent'
                                    : 'bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                            }`}
                        >
                            <TrendingDown className={`w-4 h-4 ${showLowStock ? 'text-white' : 'text-gray-500'}`} />
                            Stock faible
                        </button>
                    </div>
                </div>
                <div className="relative group max-w-2xl">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400 group-focus-within:text-blue-500 transition-colors" />
                    </div>
                    <input
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        placeholder="Rechercher un produit par nom ou SKU..."
                        className="block w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl leading-5 bg-gray-50/50 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 sm:text-sm transition-all duration-200 shadow-sm"
                    />
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="w-8 h-8 animate-spin text-sage-600" />
                    </div>
                ) : error ? (
                    <div className="flex items-center justify-center h-full text-red-500">
                        <div className="text-center">
                            <AlertCircle className="w-12 h-12 mx-auto mb-3" />
                            <p className="font-medium">{error}</p>
                        </div>
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
                <div className="h-full bg-white border-r border-gray-100 flex flex-col p-5">
                    <h1 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-5">Statistiques</h1>
                    <div className="space-y-4">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-5 border border-blue-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-blue-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="relative">
                                <div className="text-xs font-bold text-sage-600 uppercase tracking-wider mb-2">Total produits</div>
                                <div className="text-4xl font-black text-blue-700 tracking-tight">{stats.total}</div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-5 border border-orange-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-orange-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="relative">
                                <div className="text-xs font-bold text-orange-600 uppercase tracking-wider mb-2">Stock faible</div>
                                <div className="text-4xl font-black text-orange-700 tracking-tight">{stats.lowStock}</div>
                            </div>
                        </div>
                        <div className="bg-gradient-to-br from-red-50 to-rose-50 rounded-2xl p-5 border border-red-100/50 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
                            <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-500/10 rounded-full blur-xl group-hover:scale-150 transition-transform duration-500"></div>
                            <div className="relative">
                                <div className="text-xs font-bold text-red-600 uppercase tracking-wider mb-2">Rupture</div>
                                <div className="text-4xl font-black text-red-700 tracking-tight">{stats.outOfStock}</div>
                            </div>
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

export default MagasinierStockPage;
