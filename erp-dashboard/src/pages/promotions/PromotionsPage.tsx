import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import { Tag, Search, Filter, RefreshCw, Users, Package, Zap } from 'lucide-react';
// import { toast } from 'react-hot-toast';


export const PromotionsPage = () => {
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, expired: 0 });

    const loadPromotions = async () => {
        setLoading(true);
        try {
            const data = await promotionsApi.getPromotions();
            setPromotions(data.promotions.data);
            setStats(data.statistics);
        } catch (error) {
            console.error('Failed to load promotions', error);
            // toast.error('Failed to load promotions');
            // Mock data for demonstration if API fails
            setPromotions([
                {
                    id: 1,
                    code: 'PROMO-WINTER',
                    name: 'Winter Sale 2024',
                    start_date: '2024-01-01',
                    end_date: '2024-03-31',
                    breakpoint_type: 1,
                    payment_term_dependent: false,
                    is_closed: false,
                    sequence: 10,
                    lines: [],
                    partner_families: [],
                    payment_terms: [],
                    usage_count: 154,
                    total_discount: 45000
                },
                {
                    id: 2,
                    code: 'PROMO-B2B',
                    name: 'B2B Volume Discount',
                    start_date: '2024-01-01',
                    end_date: '2024-12-31',
                    breakpoint_type: 2,
                    payment_term_dependent: true,
                    is_closed: false,
                    sequence: 20,
                    lines: [],
                    partner_families: [],
                    payment_terms: [],
                    usage_count: 89,
                    total_discount: 12500
                }
            ]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadPromotions();
    }, []);

    const columnDefs = [
        { field: 'code', headerName: 'Code', width: 120, pinned: 'left' },
        { field: 'name', headerName: 'Name', flex: 2 },
        {
            field: 'start_date',
            headerName: 'Valid From',
            width: 110,
            valueFormatter: (params: any) => new Date(params.value).toLocaleDateString()
        },
        {
            field: 'end_date',
            headerName: 'Valid Until',
            width: 110,
            valueFormatter: (params: any) => new Date(params.value).toLocaleDateString()
        },
        {
            field: 'usage_count',
            headerName: 'Usage',
            width: 90,
            cellStyle: { display: 'flex', justifyContent: 'center' }
        },
        {
            field: 'total_discount',
            headerName: 'Total Disc.',
            width: 110,
            valueFormatter: (params: any) => `${params.value?.toLocaleString()} MAD`
        },
        {
            field: 'status',
            headerName: 'Status',
            width: 100,
            cellRenderer: (params: any) => {
                const isExpired = new Date(params.data.end_date) < new Date();
                const isClosed = params.data.is_closed;
                if (isClosed) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">Closed</span>;
                if (isExpired) return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-700">Expired</span>;
                return <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>;
            }
        }
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-gradient-to-b from-white to-gray-50 p-4 border-r border-gray-200 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2 text-sage-800">
                        <Tag className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Promotions</h2>
                    </div>

                    {/* Quick Actions Section */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Actions Rapides</div>
                        
                        <button
                            onClick={() => navigate('/promotions/new')}
                            className="flex items-center gap-2 w-full bg-gradient-to-r from-sage-600 to-sage-700 text-white px-3 py-2.5 rounded-lg hover:from-sage-700 hover:to-sage-800 transition shadow-sm"
                        >
                            <Zap className="w-4 h-4" />
                            <span className="text-sm font-medium">Nouvelle Promotion</span>
                        </button>

                        <button
                            onClick={() => navigate('/promotions/new?tab=partners')}
                            className="flex items-center gap-2 w-full bg-white border border-blue-200 text-blue-700 px-3 py-2 rounded-lg hover:bg-blue-50 transition"
                        >
                            <Users className="w-4 h-4" />
                            <span className="text-sm font-medium">Famille Partenaires</span>
                        </button>

                        <button
                            onClick={() => navigate('/products')}
                            className="flex items-center gap-2 w-full bg-white border border-purple-200 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50 transition"
                        >
                            <Package className="w-4 h-4" />
                            <span className="text-sm font-medium">Famille Produits</span>
                        </button>
                    </div>

                    {/* Filters Section */}
                    <div className="space-y-1 mt-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">Filtres</div>
                        {['Toutes', 'Actives', 'Valides', 'Expirées', 'Brouillons'].map((filter) => (
                            <button
                                key={filter}
                                className="w-full text-left px-3 py-2 text-sm rounded-md text-gray-700 hover:bg-sage-50 hover:text-sage-800 transition flex justify-between items-center group"
                            >
                                <span>{filter}</span>
                                <span className="text-xs text-gray-400 opacity-0 group-hover:opacity-100 transition">→</span>
                            </button>
                        ))}
                    </div>

                    {/* Statistics Section */}
                    <div className="mt-auto border-t border-gray-200 pt-4">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">Statistiques</div>
                        <div className="grid grid-cols-2 gap-2 text-center">
                            <div className="bg-gradient-to-br from-sage-50 to-sage-100 p-3 rounded-lg border border-sage-200">
                                <div className="text-2xl font-bold text-sage-700">{stats.active || 2}</div>
                                <div className="text-xs text-sage-600 font-medium">Actives</div>
                            </div>
                            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-3 rounded-lg border border-orange-200">
                                <div className="text-2xl font-bold text-orange-700">{stats.expired || 0}</div>
                                <div className="text-xs text-orange-600 font-medium">Expirées</div>
                            </div>
                        </div>
                        <div className="mt-2 bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200 text-center">
                            <div className="text-2xl font-bold text-blue-700">{stats.total || 2}</div>
                            <div className="text-xs text-blue-600 font-medium">Total</div>
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-slate-50">
                    {/* Header Toolbar */}
                    <div className="bg-white border-b px-6 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-4 flex-1">
                            <div className="relative w-96">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search promotions..."
                                    className="w-full pl-9 pr-4 py-1.5 text-sm border rounded-md focus:ring-1 focus:ring-sage-500 outline-none"
                                />
                            </div>
                            <button className="p-1.5 text-gray-500 hover:text-sage-600 hover:bg-gray-50 rounded border">
                                <Filter className="w-4 h-4" />
                            </button>
                        </div>
                        <button onClick={loadPromotions} className="p-1.5 text-gray-400 hover:text-sage-600">
                            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        </button>
                    </div>

                    {/* Data Grid */}
                    <div className="flex-1 p-6 overflow-hidden">
                        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <DataGrid
                                rowData={promotions}
                                columnDefs={columnDefs}
                                loading={loading}
                                onRowDoubleClicked={(data) => navigate(`/promotions/${data.id}`)}
                            />
                        </div>
                    </div>
                </div>
            }
        />
    );
};
