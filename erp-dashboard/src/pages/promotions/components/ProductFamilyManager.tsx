import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Modal } from '@/components/common/Modal';
import { ConfirmModal } from '@/components/common/Modal';
import { Plus, Pencil, Trash2, Package, Search, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface ProductFamilyManagerProps {
    selectedCodes: string[];
    onSelectionChange: (codes: string[]) => void;
}

export const ProductFamilyManager = ({ selectedCodes, onSelectionChange }: ProductFamilyManagerProps) => {
    const [families, setFamilies] = useState<ProductFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [editingFamily, setEditingFamily] = useState<ProductFamily | null>(null);
    const [deletingFamily, setDeletingFamily] = useState<ProductFamily | null>(null);
    const [search, setSearch] = useState('');
    const [deleting, setDeleting] = useState(false);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductFamily>();

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
        loadFamilies();
    }, [loadFamilies]);

    const filteredFamilies = families.filter(f => 
        f.code?.toLowerCase().includes(search.toLowerCase()) ||
        f.name?.toLowerCase().includes(search.toLowerCase())
    );

    const handleCreate = () => {
        setEditingFamily(null);
        reset({
            code: '',
            name: '',
            description: '',
            sales_group_code: '',
            products: []
        });
        setIsModalOpen(true);
    };

    const handleEdit = (family: ProductFamily) => {
        setEditingFamily(family);
        reset({
            code: family.code || '',
            name: family.name || '',
            description: family.description || '',
            sales_group_code: family.sales_group_code || '',
            products: family.products?.map(p => p.code) || []
        });
        setIsModalOpen(true);
    };

    const handleDeleteClick = (family: ProductFamily) => {
        setDeletingFamily(family);
        setIsDeleteModalOpen(true);
    };

    const handleDelete = async () => {
        if (!deletingFamily?.id) return;
        
        setDeleting(true);
        try {
            await promotionsApi.deleteProductFamily(deletingFamily.id);
            toast.success('Famille de produits supprimée avec succès');
            await loadFamilies();
            // Remove from selection if selected
            if (selectedCodes.includes(deletingFamily.code)) {
                onSelectionChange(selectedCodes.filter(c => c !== deletingFamily.code));
            }
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de la suppression');
        } finally {
            setDeleting(false);
            setIsDeleteModalOpen(false);
            setDeletingFamily(null);
        }
    };

    const onSubmit = async (data: ProductFamily) => {
        try {
            if (editingFamily?.id) {
                await promotionsApi.updateProductFamily(editingFamily.id, data);
                toast.success('Famille de produits mise à jour avec succès');
            } else {
                await promotionsApi.createProductFamily(data);
                toast.success('Famille de produits créée avec succès');
            }
            await loadFamilies();
            setIsModalOpen(false);
            reset();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de l\'enregistrement');
        }
    };

    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 150,
            filter: true,
            checkboxSelection: true,
            headerCheckboxSelection: true,
        },
        { field: 'name', headerName: 'Nom', flex: 1, filter: true },
        {
            field: 'description',
            headerName: 'Description',
            flex: 1,
            filter: true,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            field: 'sales_group_code',
            headerName: 'Groupe de Vente',
            width: 150,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            field: 'products_count',
            headerName: 'Produits',
            width: 120,
            valueFormatter: (params: any) => params.value || 0
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => {
                const family = params.data as ProductFamily;
                return (
                    <div className="flex items-center gap-2 h-full">
                        <button
                            onClick={() => handleEdit(family)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Modifier"
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleDeleteClick(family)}
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
            <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-4 rounded-lg border border-purple-100">
                <div className="flex items-center justify-between mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                        <Package className="w-5 h-5 text-purple-600" />
                        Familles de Produits
                    </h3>
                    <button
                        onClick={handleCreate}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                    >
                        <Plus className="w-4 h-4" />
                        Nouvelle Famille
                    </button>
                </div>
                <p className="text-sm text-gray-600">
                    Gérez les familles de produits qui peuvent être utilisées dans les règles de promotion.
                    Sélectionnez les familles dans le tableau ci-dessous.
                </p>
            </div>

            <div className="bg-white rounded-lg border shadow-sm">
                <div className="p-4 border-b flex items-center gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Rechercher par code ou nom..."
                            className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <div className="text-sm text-gray-600">
                        {selectedCodes.length} sélectionnée(s)
                    </div>
                </div>

                <div className="h-96">
                    <DataGrid
                        rowData={filteredFamilies}
                        columnDefs={columnDefs}
                        loading={loading}
                        rowSelection="multiple"
                        onSelectionChanged={(rows) => {
                            const codes = rows.map((r: ProductFamily) => r.code);
                            onSelectionChange(codes);
                        }}
                        defaultSelectedIds={(row: ProductFamily) => selectedCodes.includes(row.code || '')}
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
                title={editingFamily ? 'Modifier la Famille de Produits' : 'Nouvelle Famille de Produits'}
                size="lg"
            >
                <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('code', { required: true })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none uppercase"
                            placeholder="PROD_FAM_001"
                        />
                        {errors.code && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom <span className="text-red-500">*</span>
                        </label>
                        <input
                            {...register('name', { required: true })}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="Électronique"
                        />
                        {errors.name && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Description (Optionnel)
                        </label>
                        <textarea
                            {...register('description')}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                            rows={3}
                            placeholder="Description de la famille de produits..."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Code Groupe de Vente (Optionnel)
                        </label>
                        <input
                            {...register('sales_group_code')}
                            className="w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-purple-500 outline-none"
                            placeholder="SG001"
                        />
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
                            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                        >
                            {editingFamily ? 'Mettre à jour' : 'Créer'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Delete Confirmation Modal */}
            <ConfirmModal
                isOpen={isDeleteModalOpen}
                onClose={() => {
                    setIsDeleteModalOpen(false);
                    setDeletingFamily(null);
                }}
                onConfirm={handleDelete}
                title="Supprimer la Famille de Produits"
                message={`Êtes-vous sûr de vouloir supprimer "${deletingFamily?.name}" ? Cette action ne peut pas être annulée.`}
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                loading={deleting}
            />
        </div>
    );
};

