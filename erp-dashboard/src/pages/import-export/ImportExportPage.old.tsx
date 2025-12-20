import { useState, useEffect } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    Upload, 
    Download, 
    FileText, 
    Activity, 
    TrendingUp,
    Database,
    CheckCircle,
    XCircle,
    Clock,
    AlertCircle
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Statistics, BatchOperation } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';

export const ImportExportPage = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<Statistics | null>(null);
    const [recentBatches, setRecentBatches] = useState<BatchOperation[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadDashboardData();
    }, []);

    const loadDashboardData = async () => {
        setLoading(true);
        try {
            const [statsData, batchesData] = await Promise.all([
                importExportApi.statistics.getStatistics(),
                importExportApi.batches.getBatches({ per_page: 5 })
            ]);
            setStats(statsData.statistics);
            setRecentBatches(batchesData.batches.data);
        } catch (error) {
            console.error('Failed to load dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'completed': return 'text-green-600 bg-green-50';
            case 'processing': return 'text-blue-600 bg-blue-50';
            case 'failed': return 'text-red-600 bg-red-50';
            case 'queued': return 'text-yellow-600 bg-yellow-50';
            default: return 'text-gray-600 bg-gray-50';
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

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-gradient-to-b from-white to-gray-50 p-4 border-r border-gray-200 flex flex-col gap-4">
                    <div className="flex items-center gap-2 mb-2 text-sage-800">
                        <Database className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Import/Export</h2>
                    </div>

                    {/* Quick Actions */}
                    <div className="space-y-2">
                        <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                            Actions Rapides
                        </div>

                        <button
                            onClick={() => navigate('/import-export/import')}
                            className="flex items-center gap-2 w-full bg-gradient-to-r from-blue-600 to-blue-700 text-white px-3 py-2.5 rounded-lg hover:from-blue-700 hover:to-blue-800 transition shadow-sm"
                        >
                            <Upload className="w-4 h-4" />
                            <span className="text-sm font-medium">Importer Données</span>
                        </button>

                        <button
                            onClick={() => navigate('/import-export/export')}
                            className="flex items-center gap-2 w-full bg-white border border-green-200 text-green-700 px-3 py-2 rounded-lg hover:bg-green-50 transition"
                        >
                            <Download className="w-4 h-4" />
                            <span className="text-sm font-medium">Exporter Données</span>
                        </button>

                        <button
                            onClick={() => navigate('/import-export/templates')}
                            className="flex items-center gap-2 w-full bg-white border border-purple-200 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-50 transition"
                        >
                            <FileText className="w-4 h-4" />
                            <span className="text-sm font-medium">Gérer Templates</span>
                        </button>

                        <button
                            onClick={() => navigate('/import-export/batches')}
                            className="flex items-center gap-2 w-full bg-white border border-orange-200 text-orange-700 px-3 py-2 rounded-lg hover:bg-orange-50 transition"
                        >
                            <Activity className="w-4 h-4" />
                            <span className="text-sm font-medium">Historique</span>
                        </button>
                    </div>

                    {/* Statistics */}
                    {stats && (
                        <div className="mt-auto border-t border-gray-200 pt-4">
                            <div className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                                Statistiques
                            </div>
                            <div className="space-y-2">
                                <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-3 rounded-lg border border-blue-200">
                                    <div className="text-xs text-blue-600 font-medium mb-1">Imports</div>
                                    <div className="text-2xl font-bold text-blue-700">{stats.imports.total}</div>
                                    <div className="text-xs text-blue-600 mt-1">
                                        {stats.imports.completed} réussis
                                    </div>
                                </div>
                                <div className="bg-gradient-to-br from-green-50 to-green-100 p-3 rounded-lg border border-green-200">
                                    <div className="text-xs text-green-600 font-medium mb-1">Exports</div>
                                    <div className="text-2xl font-bold text-green-700">{stats.exports.total}</div>
                                    <div className="text-xs text-green-600 mt-1">
                                        {stats.exports.completed} réussis
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-slate-50">
                    {/* Header */}
                    <div className="bg-white border-b px-6 py-4">
                        <h1 className="text-2xl font-bold text-gray-900">Tableau de Bord Import/Export</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Gérez vos imports et exports de données en toute simplicité
                        </p>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 p-6 overflow-auto">
                        {loading ? (
                            <div className="flex items-center justify-center h-64">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-sage-600"></div>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* Stats Cards */}
                                {stats && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Imports</p>
                                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                                        {stats.imports.total}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-blue-50 rounded-lg">
                                                    <Upload className="w-6 h-6 text-blue-600" />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm">
                                                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                                                <span className="text-green-600 font-medium">
                                                    {stats.imports.completed} complétés
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Total Exports</p>
                                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                                        {stats.exports.total}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-green-50 rounded-lg">
                                                    <Download className="w-6 h-6 text-green-600" />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm">
                                                <TrendingUp className="w-4 h-4 text-green-600 mr-1" />
                                                <span className="text-green-600 font-medium">
                                                    {stats.exports.completed} complétés
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">Enregistrements Traités</p>
                                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                                        {stats.imports.total_records_processed.toLocaleString()}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-purple-50 rounded-lg">
                                                    <Database className="w-6 h-6 text-purple-600" />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm">
                                                <CheckCircle className="w-4 h-4 text-green-600 mr-1" />
                                                <span className="text-green-600 font-medium">
                                                    {stats.imports.total_records_successful.toLocaleString()} réussis
                                                </span>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-sm text-gray-600">En Cours</p>
                                                    <p className="text-3xl font-bold text-gray-900 mt-2">
                                                        {stats.imports.processing + stats.exports.processing}
                                                    </p>
                                                </div>
                                                <div className="p-3 bg-orange-50 rounded-lg">
                                                    <Activity className="w-6 h-6 text-orange-600" />
                                                </div>
                                            </div>
                                            <div className="mt-4 flex items-center text-sm">
                                                <Clock className="w-4 h-4 text-orange-600 mr-1" />
                                                <span className="text-orange-600 font-medium">
                                                    Traitement actif
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Recent Activity */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                                    <div className="px-6 py-4 border-b border-gray-200">
                                        <h2 className="text-lg font-semibold text-gray-900">Activité Récente</h2>
                                    </div>
                                    <div className="divide-y divide-gray-200">
                                        {recentBatches.length === 0 ? (
                                            <div className="px-6 py-12 text-center text-gray-500">
                                                <Activity className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                                                <p>Aucune activité récente</p>
                                            </div>
                                        ) : (
                                            recentBatches.map((batch) => (
                                                <div
                                                    key={batch.id}
                                                    className="px-6 py-4 hover:bg-gray-50 cursor-pointer transition"
                                                    onClick={() => navigate(`/import-export/batches/${batch.batch_id}`)}
                                                >
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2 rounded-lg ${
                                                                batch.operation_type === 'import' 
                                                                    ? 'bg-blue-50' 
                                                                    : 'bg-green-50'
                                                            }`}>
                                                                {batch.operation_type === 'import' ? (
                                                                    <Upload className={`w-5 h-5 ${
                                                                        batch.operation_type === 'import'
                                                                            ? 'text-blue-600'
                                                                            : 'text-green-600'
                                                                    }`} />
                                                                ) : (
                                                                    <Download className="w-5 h-5 text-green-600" />
                                                                )}
                                                            </div>
                                                            <div>
                                                                <h3 className="font-medium text-gray-900">
                                                                    {batch.template?.name || 'Template inconnu'}
                                                                </h3>
                                                                <p className="text-sm text-gray-600">
                                                                    {batch.filename} • {batch.total_records} enregistrements
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <div className="text-right">
                                                                <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(batch.status)}`}>
                                                                    {getStatusIcon(batch.status)}
                                                                    <span className="capitalize">{batch.status}</span>
                                                                </div>
                                                                <p className="text-xs text-gray-500 mt-1">
                                                                    {new Date(batch.created_at).toLocaleString('fr-FR')}
                                                                </p>
                                                            </div>
                                                            {batch.status === 'completed' && (
                                                                <div className="text-right">
                                                                    <p className="text-sm font-medium text-green-600">
                                                                        {batch.successful_records} réussis
                                                                    </p>
                                                                    {batch.failed_records > 0 && (
                                                                        <p className="text-xs text-red-600">
                                                                            {batch.failed_records} échoués
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                    {batch.status === 'processing' && (
                                                        <div className="mt-3">
                                                            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
                                                                <span>Progression</span>
                                                                <span>{batch.progress_percentage}%</span>
                                                            </div>
                                                            <div className="w-full bg-gray-200 rounded-full h-2">
                                                                <div
                                                                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                                                                    style={{ width: `${batch.progress_percentage}%` }}
                                                                ></div>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            ))
                                        )}
                                    </div>
                                    {recentBatches.length > 0 && (
                                        <div className="px-6 py-3 bg-gray-50 border-t border-gray-200">
                                            <button
                                                onClick={() => navigate('/import-export/batches')}
                                                className="text-sm text-sage-600 hover:text-sage-700 font-medium"
                                            >
                                                Voir tout l'historique →
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            }
        />
    );
};
