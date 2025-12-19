import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamilyBoost, ProductFamily, PartnerFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { ConfirmModal } from '@/components/common/Modal';
import { Plus, Pencil, Trash2, TrendingUp, Search, Loader2, Save } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useForm, useFieldArray } from 'react-hook-form';

interface BoostFormData {
    product_family_id: number;
    boosts: Array<{
        partner_family_id: number;
        rank: number;
        boost_factor: number;
    }>;
}

interface BoostManagerProps {
    productFamilyId?: number;
}

export const BoostManager = ({ productFamilyId }: BoostManagerProps) => {
    const [boosts, setBoosts] = useState<ProductFamilyBoost[]>([]);
    const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
    const [partnerFamilies, setPartnerFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingBoost, setEditingBoost] = useState<ProductFamilyBoost | null>(null);
    const [deletingBoost, setDeletingBoost] = useState<ProductFamilyBoost | null>(null);
    const [selectedProductFamilyId, setSelectedProductFamilyId] = useState<number | undefined>(productFamilyId);
    const [search, setSearch] = useState('');
    const [deleting, setDeleting] = useState(false);

    const { register, handleSubmit, reset, control, watch, formState: { errors } } = useForm<BoostFormData>({
        defaultValues: {
            product_family_id: selectedProductFamilyId || 0,
            boosts: []
        }
    });

    const { fields, append, remove } = useFieldArray({
        control,
        name: 'boosts'
    });

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [boostsResponse, productFamiliesResponse, partnerFamiliesResponse] = await Promise.all([
                promotionsApi.getBoosts({ product_family_id: selectedProductFamilyId }),
                promotionsApi.getProductFamilies(),
                promotionsApi.getPartnerFamilies()
            ]);
            setBoosts(boostsResponse.boosts || []);
            setProductFamilies(productFamiliesResponse.productFamilies || []);
            setPartnerFamilies(partnerFamiliesResponse.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load data', error);
            toast.error('Échec du chargement des données');
        } finally {
            setLoading(false);
        }
    }, [selectedProductFamilyId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    const filteredBoosts = boosts.filter(b => {
        if (!search) return true;
        const searchLower = search.toLowerCase();
        return (
            b.productFamily?.name?.toLowerCase().includes(searchLower) ||
            b.productFamily?.code?.toLowerCase().includes(searchLower) ||
            b.partnerFamily?.name?.toLowerCase().includes(searchLower) ||
            b.partnerFamily?.code?.toLowerCase().includes(searchLower)
        );
    });

    const handleCreate = () => {
        setEditingBoost(null);
        reset({
            product_family_id: selectedProductFamilyId || 0,
            boosts: [{
                partner_family_id: 0,
                rank: 1,
                boost_factor: 1.0
            }]
        });
        setIsModalOpen(true);
    };

    const handleBulkEdit = () => {
        if (!selectedProductFamilyId) {
            toast.error('Veuillez sélectionner une famille de produits');
            return;
        }
        
        // Load existing boosts for this product family
        const existingBoosts = boosts.filter(b => b.product_family_id === selectedProductFamilyId);
        reset({
            product_family_id: selectedProductFamilyId,
            boosts: existingBoosts.length > 0
                ? existingBoosts.map(b => ({
                    partner_family_id: b.partner_family_id,
                    rank: b.rank,
                    boost_factor: b.boost_factor
                }))
                : [{
                    partner_family_id: 0,
                    rank: 1,
                    boost_factor: 1.0
                }]
        });
        setIsBulkModalOpen(true);
    };

    const handleEdit = (boost: ProductFamilyBoost) => {
        setEditingBoost(boost);
        reset({
            product_family_id: boost.product_family_id,
            boosts: [{
                partner_family_id: boost.partner_family_id,
                rank: boost.rank,
                boost_factor: boost.boost_factor
            }]
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (boost: ProductFamilyBoost) => {
        setDeletingBoost(boost);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingBoost?.id) return;
        
        setDeleting(true);
        try {
            await promotionsApi.deleteBoost(deletingBoost.id);
            toast.success('Boost supprimé avec succès');
            await loadData();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de la suppression');
        } finally {
            setDeleting(false);
            setIsDeleteModalOpen(false);
            setDeletingBoost(null);
        }
    };

    const onSubmit = async (data: BoostFormData) => {
        try {
            if (editingBoost?.id) {
                await promotionsApi.updateBoost(editingBoost.id, {
                    product_family_id: data.product_family_id,
                    partner_family_id: data.boosts[0].partner_family_id,
                    rank: data.boosts[0].rank,
                    boost_factor: data.boosts[0].boost_factor
                });
                toast.success('Boost mis à jour avec succès');
            } else {
                await promotionsApi.createBoost({
                    product_family_id: data.product_family_id,
                    partner_family_id: data.boosts[0].partner_family_id,
                    rank: data.boosts[0].rank,
                    boost_factor: data.boosts[0].boost_factor
                });
                toast.success('Boost créé avec succès');
            }
            await loadData();
            setIsModalOpen(false);
            reset();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de l\'enregistrement');
        }
    };

    const onSubmitBulk = async (data: BoostFormData) => {
        try {
            await promotionsApi.bulkSyncBoosts({
                product_family_id: data.product_family_id,
                boosts: data.boosts.filter(b => b.partner_family_id > 0)
            });
            toast.success('Boosts synchronisés avec succès');
            await loadData();
            setIsBulkModalOpen(false);
            reset();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de la synchronisation');
        }
    };

    const columnDefs = [
        {
            field: 'productFamily.code',
            headerName: 'Famille Produit',
            width: 150,
            valueGetter: (params: any) => params.data?.productFamily?.code || '-'
        },
        {
            field: 'productFamily.name',
            headerName: 'Nom Famille Produit',
            flex: 1,
            valueGetter: (params: any) => params.data?.productFamily?.name || '-'
        },
        {
            field: 'partnerFamily.code',
            headerName: 'Famille Partenaire',
            width: 150,
            valueGetter: (params: any) => params.data?.partnerFamily?.code || '-'
        },
        {
            field: 'partnerFamily.name',
            headerName: 'Nom Famille Partenaire',
            flex: 1,
            valueGetter: (params: any) => params.data?.partnerFamily?.name || '-'
        },
        {
            field: 'rank',
            headerName: 'Rang',
            width: 100,
            filter: true
        },
        {
            field: 'boost_factor',
            headerName: 'Facteur Boost',
            width: 150,
            valueFormatter: (params: any) => params.value ? `${Number(params.value).toFixed(2)}x` : '-'
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => {
                const boost = params.data as ProductFamilyBoost;
                return (
                    <div className="flex items-center gap-2 h-full">
                        <button
                            onClick={() => handleEdit(boost)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Modifier"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(boost)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
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
    ];

    return (
        <div className="space-y-4">
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <TrendingUp className="w-5 h-5 text-green-600" />
                        Gestion des Boosts
                    </h3>
                    <div className="flex gap-2">
                        <button
                            onClick={handleBulkEdit}
                            disabled={!selectedProductFamilyId}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Save className="w-4 h-4" />
                            Édition en Masse
                        </button>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                            <Plus className="w-4 h-4" />
                            Nouveau Boost
                        </button>
                    </div>
                </div>
                <p className="text-sm text-gray-600 mb-3">
                    Les boosts définissent le facteur de priorité et d'amplification pour les familles de produits lorsqu'elles sont vendues à des familles de partenaires spécifiques.
                </p>
                
                <div className="flex items-center gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Filtrer par Famille de Produits
                        </label>
                        <select
                            value={selectedProductFamilyId || ''}
                            onChange={(e) => setSelectedProductFamilyId(e.target.value ? Number(e.target.value) : undefined)}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value="">Toutes les familles</option>
                            {productFamilies.map(pf => (
                                <option key={pf.id} value={pf.id}>{pf.code} - {pf.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <div className="h-96">
                    <DataGrid
                        rowData={filteredBoosts}
                        columnDefs={columnDefs}
                        loading={loading}
                    />
                </div>
            </div>

            {/* Create/Edit Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => {
                    setIsModalOpen(false);
                    reset();
                }}
                title={editingBoost ? 'Modifier le Boost' : 'Nouveau Boost'}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Famille de Produits <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('product_family_id', { required: true, valueAsNumber: true })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value="">Sélectionner...</option>
                            {productFamilies.map(pf => (
                                <option key={pf.id} value={pf.id}>{pf.code} - {pf.name}</option>
                            ))}
                        </select>
                        {errors.product_family_id && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Famille de Partenaires <span className="text-red-500">*</span>
                        </label>
                        <select
                            {...register('boosts.0.partner_family_id', { required: true, valueAsNumber: true })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                        >
                            <option value="0">Sélectionner...</option>
                            {partnerFamilies.map(pf => (
                                <option key={pf.id} value={pf.id}>{pf.code} - {pf.name}</option>
                            ))}
                        </select>
                        {errors.boosts?.[0]?.partner_family_id && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Rang <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                {...register('boosts.0.rank', { required: true, valueAsNumber: true, min: 1 })}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                min="1"
                            />
                            {errors.boosts?.[0]?.rank && <p className="text-xs text-red-500 mt-1">Obligatoire (min: 1)</p>}
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Facteur Boost <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="number"
                                step="0.000001"
                                {...register('boosts.0.boost_factor', { required: true, valueAsNumber: true, min: 0, max: 999.999999 })}
                                className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                min="0"
                                max="999.999999"
                            />
                            {errors.boosts?.[0]?.boost_factor && <p className="text-xs text-red-500 mt-1">Obligatoire (0-999.999999)</p>}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setIsModalOpen(false);
                                reset();
                            }}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                            {editingBoost ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Bulk Edit Modal */}
            <Modal
                isOpen={isBulkModalOpen}
                onClose={() => {
                    setIsBulkModalOpen(false);
                    reset();
                }}
                title="Édition en Masse des Boosts"
                size="xl"
            >
                <form onSubmit={handleSubmit(onSubmitBulk)} className="p-6 space-y-4">
                    <div className="p-3 bg-blue-50 rounded-md border border-blue-200 text-sm text-blue-800">
                        <strong>Note:</strong> Cette opération remplacera tous les boosts existants pour la famille de produits sélectionnée.
                    </div>

                    <div className="max-h-96 overflow-y-auto space-y-3">
                        {fields.map((field, index) => (
                            <div key={field.id} className="p-4 border rounded-md space-y-3">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-sm font-medium text-gray-700">Boost #{index + 1}</span>
                                    {fields.length > 1 && (
                                        <button
                                            type="button"
                                            onClick={() => remove(index)}
                                            className="text-red-600 hover:text-red-800 text-sm"
                                        >
                                            Supprimer
                                        </button>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Famille de Partenaires <span className="text-red-500">*</span>
                                    </label>
                                    <select
                                        {...register(`boosts.${index}.partner_family_id`, { required: true, valueAsNumber: true })}
                                        className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                    >
                                        <option value="0">Sélectionner...</option>
                                        {partnerFamilies.map(pf => (
                                            <option key={pf.id} value={pf.id}>{pf.code} - {pf.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Rang <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            {...register(`boosts.${index}.rank`, { required: true, valueAsNumber: true, min: 1 })}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                            min="1"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Facteur Boost <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="number"
                                            step="0.000001"
                                            {...register(`boosts.${index}.boost_factor`, { required: true, valueAsNumber: true, min: 0, max: 999.999999 })}
                                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none"
                                            min="0"
                                            max="999.999999"
                                        />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    <button
                        type="button"
                        onClick={() => append({ partner_family_id: 0, rank: fields.length + 1, boost_factor: 1.0 })}
                        className="w-full py-2 border-2 border-dashed border-gray-300 rounded-md text-gray-600 hover:border-green-500 hover:text-green-600 transition"
                    >
                        + Ajouter un Boost
                    </button>

                    <div className="flex justify-end gap-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={() => {
                                setIsBulkModalOpen(false);
                                reset();
                            }}
                            className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-md transition"
                        >
                            Annuler
                        </button>
                        <button
                            type="submit"
                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                        >
                            Synchroniser
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingBoost(null);
                }}
                onConfirm={handleDelete}
                title="Supprimer le Boost"
                message={`Êtes-vous sûr de vouloir supprimer ce boost ? Cette action ne peut pas être annulée.`}
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                loading={deleting}
            />
        </div>
    );
};

