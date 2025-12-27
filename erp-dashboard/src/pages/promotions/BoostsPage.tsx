import { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamilyBoost, ProductFamily, PartnerFamily } from '@/types/promotion.types';
import type { ColDef } from 'ag-grid-community';
import { 
    Zap, 
    RefreshCw, 
    Plus,
    Edit,
    Trash2,
    Eye,
    TrendingUp,
    Package,
    Users
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';

export const BoostsPage = () => {
    const [boosts, setBoosts] = useState<ProductFamilyBoost[]>([]);
    const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
    const [partnerFamilies, setPartnerFamilies] = useState<PartnerFamily[]>([]);
    const [selectedBoost, setSelectedBoost] = useState<ProductFamilyBoost | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [boostToDelete, setBoostToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingBoost, setEditingBoost] = useState<ProductFamilyBoost | null>(null);
    const [newBoost, setNewBoost] = useState({
        product_family_id: 0,
        partner_family_id: 0,
        rank: 1,
        boost_factor: 1.0
    });

    const loadData = async () => {
        try {
            setLoading(true);
            const [boostsData, productFamiliesData, partnerFamiliesData] = await Promise.all([
                promotionsApi.getBoosts(),
                promotionsApi.getProductFamilies(),
                promotionsApi.getPartnerFamilies()
            ]);
            
            setBoosts(boostsData.boosts || []);
            setProductFamilies(productFamiliesData.productFamilies || []);
            setPartnerFamilies(partnerFamiliesData.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load boosts data', error);
            toast.error('Échec du chargement des données');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const handleDeleteClick = (id: number) => {
        setBoostToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!boostToDelete) return;
        
        try {
            setIsDeleting(true);
            await promotionsApi.deleteBoost(boostToDelete);
            toast.success('Boost supprimé');
            loadData();
            if (selectedBoost?.id === boostToDelete) {
                setSelectedBoost(null);
            }
            setShowDeleteModal(false);
            setBoostToDelete(null);
        } catch (error) {
            console.error('Failed to delete boost:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleEditClick = (boost: ProductFamilyBoost) => {
        setEditingBoost(boost);
        setShowEditModal(true);
    };

    const handleEditBoost = async () => {
        if (!editingBoost?.id) return;
        
        if (!editingBoost.product_family_id || !editingBoost.partner_family_id) {
            toast.error('Veuillez sélectionner les familles');
            return;
        }

        try {
            await promotionsApi.updateBoost(editingBoost.id, {
                product_family_id: editingBoost.product_family_id,
                partner_family_id: editingBoost.partner_family_id,
                rank: editingBoost.rank,
                boost_factor: editingBoost.boost_factor
            });
            toast.success('Boost mis à jour avec succès');
            setShowEditModal(false);
            setEditingBoost(null);
            loadData();
        } catch (error) {
            console.error('Failed to update boost:', error);
            toast.error('Échec de la mise à jour');
        }
    };

    const handleCreateBoost = async () => {
        if (!newBoost.product_family_id || !newBoost.partner_family_id) {
            toast.error('Veuillez sélectionner les familles');
            return;
        }

        try {
            await promotionsApi.createBoost(newBoost);
            toast.success('Boost créé avec succès');
            setShowCreateModal(false);
            setNewBoost({
                product_family_id: 0,
                partner_family_id: 0,
                rank: 1,
                boost_factor: 1.0
            });
            loadData();
        } catch (error) {
            console.error('Failed to create boost:', error);
            toast.error('Échec de la création');
        }
    };

    const getProductFamilyName = (id: number) => {
        const family = productFamilies.find(f => f.id === id);
        return family ? `${family.code} - ${family.name}` : 'N/A';
    };

    const getPartnerFamilyName = (id: number) => {
        const family = partnerFamilies.find(f => f.id === id);
        return family ? `${family.code} - ${family.name}` : 'N/A';
    };

    const columnDefs = useMemo<ColDef[]>(() => [
        {
            field: 'id',
            headerName: 'ID',
            width: 80,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600 font-mono text-sm">#{params.value}</span>
                </div>
            )
        },
        {
            field: 'product_family_id',
            headerName: 'Famille Produit',
            flex: 1,
            minWidth: 200,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <Package className="w-4 h-4 text-blue-500" />
                    <span className="text-gray-900">{getProductFamilyName(params.value)}</span>
                </div>
            )
        },
        {
            field: 'partner_family_id',
            headerName: 'Famille Partenaire',
            flex: 1,
            minWidth: 200,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2 h-full">
                    <Users className="w-4 h-4 text-purple-500" />
                    <span className="text-gray-900">{getPartnerFamilyName(params.value)}</span>
                </div>
            )
        },
        {
            field: 'rank',
            headerName: 'Rang',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-700 font-semibold">{params.value}</span>
                </div>
            )
        },
        {
            field: 'boost_factor',
            headerName: 'Facteur Boost',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-1 h-full">
                    <TrendingUp className="w-4 h-4 text-green-500" />
                    <span className="text-gray-900 font-semibold">×{params.value.toFixed(2)}</span>
                </div>
            )
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => {
                const boost = params.data as ProductFamilyBoost;
                
                return (
                    <div className="flex items-center justify-center gap-1 h-full">
                        <button
                            onClick={() => setSelectedBoost(boost)}
                            className="p-1.5 hover:bg-blue-50 rounded text-blue-600 transition-colors"
                            title="Voir détails"
                        >
                            <Eye className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleEditClick(boost)}
                            className="p-1.5 hover:bg-yellow-50 rounded text-yellow-600 transition-colors"
                            title="Modifier"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(boost.id!)}
                            className="p-1.5 hover:bg-red-50 rounded text-red-600 transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
        }
    ], [boosts, productFamilies, partnerFamilies]);

    const leftContent = (
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            <div className="p-4 border-b border-gray-200">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <Zap className="w-5 h-5 text-yellow-500" />
                        <h2 className="text-lg font-semibold text-gray-900">Boosts</h2>
                    </div>
                    <button
                        onClick={loadData}
                        disabled={loading}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        title="Actualiser"
                    >
                        <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>

                <div className="flex gap-2">
                    <button
                        onClick={() => setShowCreateModal(true)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                    >
                        <Plus className="w-4 h-4" />
                        Nouveau Boost
                    </button>
                </div>

                <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                    <div className="text-sm text-gray-600">
                        <div className="flex justify-between mb-1">
                            <span>Total Boosts:</span>
                            <span className="font-semibold text-gray-900">{boosts.length}</span>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={boosts}
                    columnDefs={columnDefs}
                    loading={loading}
                    onRowClicked={(event) => setSelectedBoost(event.data)}
                />
            </div>
        </div>
    );

    const mainContent = (
        <div className="h-full overflow-y-auto bg-gray-50">
            {selectedBoost ? (
                <div className="p-6">
                    <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="p-6 border-b border-gray-200">
                            <div className="flex items-center gap-3 mb-2">
                                <Zap className="w-6 h-6 text-yellow-500" />
                                <h3 className="text-xl font-semibold text-gray-900">
                                    Détails du Boost #{selectedBoost.id}
                                </h3>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Famille Produit
                                    </label>
                                    <div className="flex items-center gap-2 p-3 bg-blue-50 rounded-lg">
                                        <Package className="w-5 h-5 text-blue-500" />
                                        <span className="text-gray-900 font-medium">
                                            {getProductFamilyName(selectedBoost.product_family_id)}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Famille Partenaire
                                    </label>
                                    <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-lg">
                                        <Users className="w-5 h-5 text-purple-500" />
                                        <span className="text-gray-900 font-medium">
                                            {getPartnerFamilyName(selectedBoost.partner_family_id)}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Rang
                                    </label>
                                    <div className="p-3 bg-gray-50 rounded-lg">
                                        <span className="text-gray-900 font-semibold text-lg">
                                            {selectedBoost.rank}
                                        </span>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Facteur Boost
                                    </label>
                                    <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg">
                                        <TrendingUp className="w-5 h-5 text-green-500" />
                                        <span className="text-gray-900 font-semibold text-lg">
                                            ×{selectedBoost.boost_factor.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-4 border-t border-gray-200">
                                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                                    <p className="text-sm text-yellow-800">
                                        <strong>Info:</strong> Ce boost multiplie les promotions pour la combinaison 
                                        de cette famille de produits et cette famille de partenaires.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-full flex items-center justify-center">
                    <div className="text-center">
                        <Zap className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                        <p className="text-gray-500 text-lg">Sélectionnez un boost pour voir les détails</p>
                    </div>
                </div>
            )}
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={leftContent}
                mainContent={mainContent}
                leftWidth="60%"
                rightWidth="40%"
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer le boost"
                message="Êtes-vous sûr de vouloir supprimer ce boost ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                isLoading={isDeleting}
                variant="danger"
            />

            {showEditModal && editingBoost && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Modifier le Boost</h3>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Famille Produit
                                </label>
                                <select
                                    value={editingBoost.product_family_id}
                                    onChange={(e) => setEditingBoost({ ...editingBoost, product_family_id: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                >
                                    <option value={0}>Sélectionner...</option>
                                    {productFamilies.map(family => (
                                        <option key={family.id} value={family.id}>
                                            {family.code} - {family.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Famille Partenaire
                                </label>
                                <select
                                    value={editingBoost.partner_family_id}
                                    onChange={(e) => setEditingBoost({ ...editingBoost, partner_family_id: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                >
                                    <option value={0}>Sélectionner...</option>
                                    {partnerFamilies.map(family => (
                                        <option key={family.id} value={family.id}>
                                            {family.code} - {family.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rang
                                </label>
                                <input
                                    type="number"
                                    value={editingBoost.rank}
                                    onChange={(e) => setEditingBoost({ ...editingBoost, rank: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Facteur Boost
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={editingBoost.boost_factor}
                                    onChange={(e) => setEditingBoost({ ...editingBoost, boost_factor: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => {
                                    setShowEditModal(false);
                                    setEditingBoost(null);
                                }}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleEditBoost}
                                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                                Mettre à jour
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showCreateModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-900">Créer un Boost</h3>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Famille Produit
                                </label>
                                <select
                                    value={newBoost.product_family_id}
                                    onChange={(e) => setNewBoost({ ...newBoost, product_family_id: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                >
                                    <option value={0}>Sélectionner...</option>
                                    {productFamilies.map(family => (
                                        <option key={family.id} value={family.id}>
                                            {family.code} - {family.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Famille Partenaire
                                </label>
                                <select
                                    value={newBoost.partner_family_id}
                                    onChange={(e) => setNewBoost({ ...newBoost, partner_family_id: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                >
                                    <option value={0}>Sélectionner...</option>
                                    {partnerFamilies.map(family => (
                                        <option key={family.id} value={family.id}>
                                            {family.code} - {family.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Rang
                                </label>
                                <input
                                    type="number"
                                    value={newBoost.rank}
                                    onChange={(e) => setNewBoost({ ...newBoost, rank: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                    min="1"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Facteur Boost
                                </label>
                                <input
                                    type="number"
                                    step="0.1"
                                    value={newBoost.boost_factor}
                                    onChange={(e) => setNewBoost({ ...newBoost, boost_factor: Number(e.target.value) })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                                    min="0"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-gray-200 flex gap-3">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                Annuler
                            </button>
                            <button
                                onClick={handleCreateBoost}
                                className="flex-1 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-colors"
                            >
                                Créer
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
