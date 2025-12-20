import { useState, useEffect } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    FileText, 
    Plus,
    ArrowLeft,
    Search,
    Pencil,
    Trash2,
    Power,
    Eye
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '@/components/common/DataGrid';
import toast from 'react-hot-toast';

export const TemplatesPage = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        type: '',
        module: '',
        is_active: '',
        search: ''
    });

    useEffect(() => {
        loadTemplates();
    }, [filters]);

    const loadTemplates = async () => {
        setLoading(true);
        try {
            const params: any = {};
            if (filters.type) params.type = filters.type;
            if (filters.module) params.module = filters.module;
            if (filters.is_active) params.is_active = filters.is_active === 'true';
            if (filters.search) params.search = filters.search;

            const data = await importExportApi.templates.getTemplates(params);
            setTemplates(data.templates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('Échec du chargement des templates');
        } finally {
            setLoading(false);
        }
    };

    const handleToggleStatus = async (id: number) => {
        try {
            await importExportApi.templates.toggleStatus(id);
            toast.success('Statut mis à jour');
            loadTemplates();
        } catch (error) {
            console.error('Failed to toggle status:', error);
            toast.error('Échec de la mise à jour');
        }
    };

    const handleDelete = async (id: number, isSystem: boolean) => {
        if (isSystem) {
            toast.error('Impossible de supprimer un template système');
            return;
        }

        if (!confirm('Êtes-vous sûr de vouloir supprimer ce template?')) return;

        try {
            await importExportApi.templates.deleteTemplate(id);
            toast.success('Template supprimé avec succès');
            loadTemplates();
        } catch (error) {
            console.error('Failed to delete template:', error);
            toast.error('Échec de la suppression');
        }
    };

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'import': return 'bg-blue-100 text-blue-700';
            case 'export': return 'bg-green-100 text-green-700';
            case 'both': return 'bg-purple-100 text-purple-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const columnDefs = [
        {
            headerName: 'Code',
            field: 'code',
            width: 150,
            pinned: 'left'
        },
        {
            headerName: 'Nom',
            field: 'name',
            flex: 2
        },
        {
            headerName: 'Type',
            field: 'type',
            width: 120,
            cellRenderer: (params: any) => (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getTypeColor(params.value)}`}>
                    {params.value.toUpperCase()}
                </span>
            )
        },
        {
            headerName: 'Objet',
            field: 'object_name',
            width: 150
        },
        {
            headerName: 'Module',
            field: 'module',
            width: 120,
            cellRenderer: (params: any) => (
                <span className="capitalize">{params.value}</span>
            )
        },
        {
            headerName: 'Format',
            field: 'file_type',
            width: 100,
            cellRenderer: (params: any) => (
                <span className="uppercase text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                    {params.value}
                </span>
            )
        },
        {
            headerName: 'Champs',
            field: 'fields',
            width: 100,
            cellStyle: { textAlign: 'center' },
            valueGetter: (params: any) => params.data.fields?.length || 0
        },
        {
            headerName: 'Statut',
            field: 'is_active',
            width: 100,
            cellRenderer: (params: any) => (
                <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                    params.value ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                    {params.value ? 'Actif' : 'Inactif'}
                </span>
            )
        },
        {
            headerName: 'Système',
            field: 'is_system',
            width: 100,
            cellRenderer: (params: any) => (
                params.value ? (
                    <span className="text-xs text-gray-500">Système</span>
                ) : (
                    <span className="text-xs text-gray-400">Custom</span>
                )
            )
        },
        {
            headerName: 'Actions',
            width: 150,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-1">
                    <button
                        onClick={() => navigate(`/import-export/templates/${params.data.id}`)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Voir détails"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleToggleStatus(params.data.id)}
                        className={`p-1 hover:bg-gray-50 rounded ${
                            params.data.is_active ? 'text-green-600' : 'text-gray-400'
                        }`}
                        title={params.data.is_active ? 'Désactiver' : 'Activer'}
                    >
                        <Power className="w-4 h-4" />
                    </button>
                    {!params.data.is_system && (
                        <>
                            <button
                                onClick={() => navigate(`/import-export/templates/${params.data.id}/edit`)}
                                className="p-1 text-orange-600 hover:bg-orange-50 rounded"
                                title="Modifier"
                            >
                                <Pencil className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleDelete(params.data.id, params.data.is_system)}
                                className="p-1 text-red-600 hover:bg-red-50 rounded"
                                title="Supprimer"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </>
                    )}
                </div>
            )
        }
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white p-4 border-r border-gray-200 flex flex-col gap-4">
                    <button
                        onClick={() => navigate('/import-export')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span className="text-sm">Retour</span>
                    </button>

                    <div className="flex items-center gap-2 mb-2 text-purple-800">
                        <FileText className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Templates</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type
                            </label>
                            <select
                                value={filters.type}
                                onChange={(e) => setFilters({...filters, type: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">Tous</option>
                                <option value="import">Import</option>
                                <option value="export">Export</option>
                                <option value="both">Les deux</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Module
                            </label>
                            <select
                                value={filters.module}
                                onChange={(e) => setFilters({...filters, module: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">Tous</option>
                                <option value="catalog">Catalogue</option>
                                <option value="crm">CRM</option>
                                <option value="inventory">Inventaire</option>
                                <option value="base">Base</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Statut
                            </label>
                            <select
                                value={filters.is_active}
                                onChange={(e) => setFilters({...filters, is_active: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                            >
                                <option value="">Tous</option>
                                <option value="true">Actif</option>
                                <option value="false">Inactif</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Recherche
                            </label>
                            <div className="relative">
                                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                                <input
                                    type="text"
                                    value={filters.search}
                                    onChange={(e) => setFilters({...filters, search: e.target.value})}
                                    placeholder="Rechercher..."
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-purple-500 focus:border-purple-500"
                                />
                            </div>
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-slate-50">
                    <div className="bg-white border-b px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">Gestion des Templates</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Configurez vos templates d'import et d'export
                                </p>
                            </div>
                            <button
                                onClick={() => navigate('/import-export/templates/new')}
                                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                            >
                                <Plus className="w-4 h-4" />
                                Nouveau Template
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-hidden">
                        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <DataGrid
                                rowData={templates}
                                columnDefs={columnDefs}
                                loading={loading}
                                onRowDoubleClicked={(data) => navigate(`/import-export/templates/${data.id}`)}
                            />
                        </div>
                    </div>
                </div>
            }
        />
    );
};
