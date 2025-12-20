import { useState, useEffect } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    Upload, 
    Download, 
    CheckCircle, 
    XCircle, 
    Clock,
    AlertCircle,
    ArrowLeft,
    Search,
    Filter,
    Trash2,
    Eye
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { BatchOperation } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import { DataGrid } from '@/components/common/DataGrid';
import toast from 'react-hot-toast';

export const BatchHistoryPage = () => {
    const navigate = useNavigate();
    const [batches, setBatches] = useState<BatchOperation[]>([]);
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        operation_type: '',
        status: '',
        search: ''
    });

    useEffect(() => {
        loadBatches();
    }, [filters]);

    const loadBatches = async () => {
        setLoading(true);
        try {
            const params: any = { per_page: 100 };
            if (filters.operation_type) params.operation_type = filters.operation_type;
            if (filters.status) params.status = filters.status;

            const data = await importExportApi.batches.getBatches(params);
            let filteredBatches = data.batches.data;

            if (filters.search) {
                filteredBatches = filteredBatches.filter(batch => 
                    batch.filename.toLowerCase().includes(filters.search.toLowerCase()) ||
                    batch.template?.name.toLowerCase().includes(filters.search.toLowerCase())
                );
            }

            setBatches(filteredBatches);
        } catch (error) {
            console.error('Failed to load batches:', error);
            toast.error('Échec du chargement de l\'historique');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (batchId: string) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce lot?')) return;

        try {
            await importExportApi.batches.deleteBatch(batchId);
            toast.success('Lot supprimé avec succès');
            loadBatches();
        } catch (error) {
            console.error('Failed to delete batch:', error);
            toast.error('Échec de la suppression');
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-700';
            case 'processing': return 'bg-blue-100 text-blue-700';
            case 'failed': return 'bg-red-100 text-red-700';
            case 'queued': return 'bg-yellow-100 text-yellow-700';
            default: return 'bg-gray-100 text-gray-700';
        }
    };

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'completed': return <CheckCircle className="w-4 h-4" />;
            case 'processing': return <Clock className="w-4 h-4 animate-spin" />;
            case 'failed': return <XCircle className="w-4 h-4" />;
            case 'queued': return <AlertCircle className="w-4 h-4" />;
            default: return <Clock className="w-4 h-4" />;
        }
    };

    const columnDefs = [
        {
            headerName: 'Type',
            field: 'operation_type',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2">
                    {params.value === 'import' ? (
                        <Upload className="w-4 h-4 text-blue-600" />
                    ) : (
                        <Download className="w-4 h-4 text-green-600" />
                    )}
                    <span className="capitalize">{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Template',
            field: 'template.name',
            flex: 1,
            valueGetter: (params: any) => params.data.template?.name || 'N/A'
        },
        {
            headerName: 'Fichier',
            field: 'filename',
            flex: 1
        },
        {
            headerName: 'Statut',
            field: 'status',
            width: 130,
            cellRenderer: (params: any) => (
                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(params.value)}`}>
                    {getStatusIcon(params.value)}
                    <span className="capitalize">{params.value}</span>
                </div>
            )
        },
        {
            headerName: 'Total',
            field: 'total_records',
            width: 100,
            cellStyle: { textAlign: 'right' }
        },
        {
            headerName: 'Réussis',
            field: 'successful_records',
            width: 100,
            cellStyle: { textAlign: 'right' },
            cellRenderer: (params: any) => (
                <span className="text-green-600 font-medium">{params.value}</span>
            )
        },
        {
            headerName: 'Échoués',
            field: 'failed_records',
            width: 100,
            cellStyle: { textAlign: 'right' },
            cellRenderer: (params: any) => (
                params.value > 0 ? (
                    <span className="text-red-600 font-medium">{params.value}</span>
                ) : (
                    <span className="text-gray-400">{params.value}</span>
                )
            )
        },
        {
            headerName: 'Date',
            field: 'created_at',
            width: 150,
            valueFormatter: (params: any) => new Date(params.value).toLocaleString('fr-FR')
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => navigate(`/import-export/batches/${params.data.batch_id}`)}
                        className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                        title="Voir détails"
                    >
                        <Eye className="w-4 h-4" />
                    </button>
                    <button
                        onClick={() => handleDelete(params.data.batch_id)}
                        className="p-1 text-red-600 hover:bg-red-50 rounded"
                        title="Supprimer"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
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

                    <div className="flex items-center gap-2 mb-2 text-orange-800">
                        <Clock className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Historique</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Type d'Opération
                            </label>
                            <select
                                value={filters.operation_type}
                                onChange={(e) => setFilters({...filters, operation_type: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="">Tous</option>
                                <option value="import">Import</option>
                                <option value="export">Export</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Statut
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({...filters, status: e.target.value})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
                            >
                                <option value="">Tous</option>
                                <option value="completed">Complété</option>
                                <option value="processing">En cours</option>
                                <option value="failed">Échoué</option>
                                <option value="queued">En attente</option>
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
                                    className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-md focus:ring-orange-500 focus:border-orange-500"
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
                                <h1 className="text-2xl font-bold text-gray-900">Historique des Opérations</h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    Consultez l'historique de tous vos imports et exports
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-gray-600">
                                    {batches.length} opération(s)
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 p-6 overflow-hidden">
                        <div className="h-full bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                            <DataGrid
                                rowData={batches}
                                columnDefs={columnDefs}
                                loading={loading}
                                onRowDoubleClicked={(data) => navigate(`/import-export/batches/${data.batch_id}`)}
                            />
                        </div>
                    </div>
                </div>
            }
        />
    );
};
