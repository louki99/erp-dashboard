import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import type { ColDef } from 'ag-grid-community';
import { 
    Tag, 
    RefreshCw, 
    Users, 
    Package, 
    Plus,
    Edit,
    Trash2,
    Eye,
    Clock,
    CheckCircle,
    XCircle,
    Copy,
    Zap,
    Loader2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';


export const PromotionsPage = () => {
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({ total: 0, active: 0, expired: 0, upcoming: 0 });
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [promotionToDelete, setPromotionToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);

    const loadPromotions = async () => {
        try {
            setLoading(true);
            const data = await promotionsApi.getPromotions();
            setPromotions(data.promotions.data || []);
            setStats(data.statistics);
        } catch (error) {
            console.error('Failed to load promotions', error);
            toast.error('Échec du chargement des promotions');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setPromotionToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!promotionToDelete) return;
        
        try {
            setIsDeleting(true);
            await promotionsApi.deletePromotion(promotionToDelete);
            toast.success('Promotion supprimée');
            loadPromotions();
            if (selectedPromotion?.id === promotionToDelete) {
                setSelectedPromotion(null);
            }
            setShowDeleteModal(false);
            setPromotionToDelete(null);
        } catch (error) {
            console.error('Failed to delete promotion:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClone = async (id: number) => {
        try {
            const result = await promotionsApi.clonePromotion(id);
            toast.success('Promotion clonée avec succès');
            loadPromotions();
            navigate(`/promotions/${result.clone.id}/edit`);
        } catch (error) {
            console.error('Failed to clone promotion:', error);
            toast.error('Échec du clonage');
        }
    };

    const getStatusBadge = (promotion: Promotion) => {
        const now = new Date();
        const startDate = new Date(promotion.start_date);
        const endDate = new Date(promotion.end_date);
        
        if (promotion.is_closed) {
            return (
                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded flex items-center gap-1 w-fit">
                    <XCircle className="w-3 h-3" />
                    Fermé
                </span>
            );
        }
        
        if (endDate < now) {
            return (
                <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1 w-fit">
                    <Clock className="w-3 h-3" />
                    Expiré
                </span>
            );
        }
        
        if (startDate > now) {
            return (
                <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1 w-fit">
                    <Clock className="w-3 h-3" />
                    À venir
                </span>
            );
        }
        
        return (
            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 w-fit">
                <CheckCircle className="w-3 h-3" />
                Actif
            </span>
        );
    };

    useEffect(() => {
        loadPromotions();
    }, []);

    const columnDefs: ColDef<Promotion>[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            )
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-700">{params.value}</span>
                </div>
            )
        },
        {
            field: 'start_date',
            headerName: 'Date Début',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-500">{new Date(params.value).toLocaleDateString('fr-FR')}</span>
                </div>
            )
        },
        {
            field: 'end_date',
            headerName: 'Date Fin',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-500">{new Date(params.value).toLocaleDateString('fr-FR')}</span>
                </div>
            )
        },
        {
            headerName: 'Statut',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {getStatusBadge(params.data)}
                </div>
            ),
            sortable: false,
            filter: false,
        },
        {
            headerName: 'Actions',
            width: 140,
            cellRenderer: (params: any) => {
                const promotion = params.data as Promotion;
                
                return (
                    <div className="flex items-center justify-center gap-1 h-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setSelectedPromotion(promotion);
                            }}
                            className="p-1.5 text-purple-600 hover:bg-purple-50 rounded transition-colors"
                            title="Voir détails"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/promotions/${promotion.id}/edit`);
                            }}
                            className="p-1.5 text-gray-600 hover:bg-gray-50 rounded transition-colors"
                            title="Modifier"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleClone(promotion.id!);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Cloner"
                        >
                            <Copy className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(promotion.id!);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
        },
    ], [navigate]);

    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <Tag className="w-5 h-5 text-purple-600" />
                    <h2 className="font-bold text-gray-900">Promotions</h2>
                </div>
                <div className="text-xs px-2 py-1 bg-purple-100 text-purple-700 rounded-full font-medium">
                    {promotions.length}
                </div>
            </div>

            <div className="p-3 border-b border-gray-200 bg-white">
                <div className="grid grid-cols-2 gap-2 mb-3 text-xs">
                    <div className="p-2 bg-green-50 rounded">
                        <div className="text-green-600 font-medium">Actives</div>
                        <div className="text-green-900 font-bold text-lg">{stats.active}</div>
                    </div>
                    <div className="p-2 bg-blue-50 rounded">
                        <div className="text-blue-600 font-medium">À venir</div>
                        <div className="text-blue-900 font-bold text-lg">{stats.upcoming}</div>
                    </div>
                    <div className="p-2 bg-orange-50 rounded">
                        <div className="text-orange-600 font-medium">Expirées</div>
                        <div className="text-orange-900 font-bold text-lg">{stats.expired}</div>
                    </div>
                    <div className="p-2 bg-gray-50 rounded">
                        <div className="text-gray-600 font-medium">Total</div>
                        <div className="text-gray-900 font-bold text-lg">{stats.total}</div>
                    </div>
                </div>
            </div>


            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={promotions}
                    columnDefs={columnDefs}
                    loading={loading}
                    onRowSelected={(data) => setSelectedPromotion(data)}
                />
            </div>
        </div>
    );

    const DetailView = selectedPromotion ? (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {selectedPromotion.name}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span className="flex items-center gap-1">
                                <Clock className="w-4 h-4" /> {new Date(selectedPromotion.start_date).toLocaleDateString('fr-FR')} - {new Date(selectedPromotion.end_date).toLocaleDateString('fr-FR')}
                            </span>
                            <span className="uppercase font-medium">{selectedPromotion.code}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {getStatusBadge(selectedPromotion)}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="space-y-4">
                    <div className="bg-white rounded-lg border border-gray-200 p-6">
                        <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Code</p>
                                <p className="font-medium text-gray-900">{selectedPromotion.code}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Nom</p>
                                <p className="font-medium text-gray-900">{selectedPromotion.name}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Date de début</p>
                                <p className="font-medium text-gray-900">{new Date(selectedPromotion.start_date).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Date de fin</p>
                                <p className="font-medium text-gray-900">{new Date(selectedPromotion.end_date).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Séquence</p>
                                <p className="font-medium text-gray-900">{selectedPromotion.sequence}</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-600 mb-1">Lignes</p>
                                <p className="font-medium text-gray-900">{selectedPromotion.lines?.length || 0}</p>
                            </div>
                        </div>
                        {selectedPromotion.description && (
                            <div className="mt-4">
                                <p className="text-xs text-gray-600 mb-1">Description</p>
                                <p className="text-gray-700">{selectedPromotion.description}</p>
                            </div>
                        )}
                    </div>

                    {selectedPromotion.usage_count !== undefined && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Statistiques</h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-4 bg-blue-50 rounded-lg text-center">
                                    <p className="text-xs text-blue-600">Utilisations</p>
                                    <p className="text-2xl font-bold text-blue-700 mt-1">{selectedPromotion.usage_count}</p>
                                </div>
                                <div className="p-4 bg-green-50 rounded-lg text-center">
                                    <p className="text-xs text-green-600">Remise Totale</p>
                                    <p className="text-2xl font-bold text-green-700 mt-1">{selectedPromotion.total_discount?.toLocaleString()} MAD</p>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    ) : (
        <div className="h-full flex items-center justify-center text-gray-400">
            <div className="text-center">
                <Tag className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <p className="font-medium">Sélectionnez une promotion</p>
                <p className="text-sm mt-2">Cliquez sur une promotion dans la liste pour voir les détails</p>
            </div>
        </div>
    );

    const ActionPanel = (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-purple-500 rounded-full opacity-50"></div>
                </div>
                <button
                    onClick={loadPromotions}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                    title="Actualiser"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <button
                    onClick={() => navigate('/promotions/new')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="Nouvelle Promotion"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/partner-families')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                    title="Famille Partenaires"
                >
                    <Users className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/product-families')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="Famille Produits"
                >
                    <Package className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/boosts')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                    title="Boosts"
                >
                    <Zap className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {loading && !selectedPromotion ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                                <p>Chargement...</p>
                            </div>
                        ) : (
                            DetailView
                        )}
                    </div>
                }
                rightContent={ActionPanel}
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer la promotion"
                description="Êtes-vous sûr de vouloir supprimer cette promotion ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
};
