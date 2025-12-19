import { useState, useEffect, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { PartnerFamily } from '@/types/promotion.types';
import { DataGrid } from '@/components/common/DataGrid';
import { Drawer } from '@/components/common/Drawer';
import { Plus, Pencil, Trash2, Users, Search, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useForm } from 'react-hook-form';

interface PartnerFamilyManagementDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    onFamiliesUpdated?: () => void;
}

export const PartnerFamilyManagementDrawer = ({ 
    isOpen, 
    onClose,
    onFamiliesUpdated 
}: PartnerFamilyManagementDrawerProps) => {
    const [families, setFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [editingFamily, setEditingFamily] = useState<PartnerFamily | null>(null);
    const [saving, setSaving] = useState(false);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const { register, handleSubmit, reset, formState: { errors } } = useForm<PartnerFamily>();

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const response = await promotionsApi.getPartnerFamilies();
            setFamilies(response.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load partner families', error);
            toast.error('Échec du chargement des familles de partenaires');
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

    const handleCreate = () => {
        setEditingFamily(null);
        reset({
            code: '',
            name: '',
            partner_condition: ''
        });
        setIsFormOpen(true);
    };

    const handleEdit = (family: PartnerFamily) => {
        setEditingFamily(family);
        reset({
            code: family.code || '',
            name: family.name || '',
            partner_condition: family.partner_condition || ''
        });
        setIsFormOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette famille de partenaires ?')) {
            return;
        }

        setDeletingId(id);
        try {
            await promotionsApi.deletePartnerFamily(id);
            toast.success('Famille de partenaires supprimée avec succès');
            await loadFamilies();
            onFamiliesUpdated?.();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de la suppression');
        } finally {
            setDeletingId(null);
        }
    };

    const onSubmit = async (data: PartnerFamily) => {
        setSaving(true);
        try {
            if (editingFamily?.id) {
                await promotionsApi.updatePartnerFamily(editingFamily.id, data);
                toast.success('Famille de partenaires mise à jour avec succès');
            } else {
                await promotionsApi.createPartnerFamily(data);
                toast.success('Famille de partenaires créée avec succès');
            }
            await loadFamilies();
            onFamiliesUpdated?.();
            setIsFormOpen(false);
            reset();
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Échec de l\'enregistrement');
        } finally {
            setSaving(false);
        }
    };

    const columnDefs = [
        {
            field: 'code',
            headerName: 'Code',
            width: 150,
            filter: true,
        },
        { field: 'name', headerName: 'Nom', flex: 1, filter: true },
        {
            field: 'partner_condition',
            headerName: 'Condition',
            flex: 1,
            filter: true,
            valueFormatter: (params: any) => params.value || '-'
        },
        {
            field: 'partners_count',
            headerName: 'Partenaires',
            width: 120,
            valueFormatter: (params: any) => params.value || 0
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => {
                const family = params.data as PartnerFamily;
                const isDeleting = deletingId === family.id;
                return (
                    <div className="flex items-center gap-2 h-full">
                        <button
                            type="button"
                            onClick={() => handleEdit(family)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                            title="Modifier"
                            disabled={isDeleting}
                        >
                            <Pencil className="w-4 h-4" />
                        </button>
                        <button
                            type="button"
                            onClick={() => family.id && handleDelete(family.id)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                            title="Supprimer"
                            disabled={isDeleting}
                        >
                            {isDeleting ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Trash2 className="w-4 h-4" />
                            )}
                        </button>
                    </div>
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
            title="Gérer les Familles de Partenaires"
            size="xl"
        >
            <div className="p-6 space-y-4">
                <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-4 rounded-lg border border-blue-100">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                            <Users className="w-5 h-5 text-blue-600" />
                            <h3 className="text-sm font-semibold text-gray-900">
                                Familles de Partenaires
                            </h3>
                        </div>
                        <button
                            type="button"
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition text-sm"
                        >
                            <Plus className="w-4 h-4" />
                            Nouvelle Famille
                        </button>
                    </div>
                    <p className="text-xs text-gray-600">
                        Créez et gérez les familles de partenaires qui peuvent être utilisées pour cibler des promotions spécifiques.
                    </p>
                </div>

                {isFormOpen && (
                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                        <h4 className="text-sm font-semibold text-gray-900 mb-3">
                            {editingFamily ? 'Modifier la Famille' : 'Nouvelle Famille'}
                        </h4>
                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Code <span className="text-red-500">*</span>
                                </label>
                                <input
                                    {...register('code', { required: true })}
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 outline-none uppercase"
                                    placeholder="FAM001"
                                    disabled={!!editingFamily}
                                />
                                {errors.code && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Nom <span className="text-red-500">*</span>
                                </label>
                                <input
                                    {...register('name', { required: true })}
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Partenaires Premium"
                                />
                                {errors.name && <p className="text-xs text-red-500 mt-1">Obligatoire</p>}
                            </div>

                            <div>
                                <label className="block text-xs font-medium text-gray-700 mb-1">
                                    Condition (Optionnel)
                                </label>
                                <textarea
                                    {...register('partner_condition')}
                                    className="w-full px-3 py-2 text-sm border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={2}
                                    placeholder="credit > 10000"
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Expression SQL ou logique pour filtrer les partenaires
                                </p>
                            </div>

                            <div className="flex justify-end gap-2 pt-2">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsFormOpen(false);
                                        reset();
                                    }}
                                    className="px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition"
                                >
                                    Annuler
                                </button>
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                                >
                                    {saving && <Loader2 className="w-3 h-3 animate-spin" />}
                                    {editingFamily ? 'Mettre à jour' : 'Créer'}
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Rechercher par code ou nom..."
                        className="w-full pl-9 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none"
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
