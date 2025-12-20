import React, { useState } from 'react';
import {
    X,
    Search,
    ChevronLeft,
    ChevronRight,
    CheckCircle,
    RefreshCw,
    XCircle,
    AlertTriangle,
    Loader2,
    FileText
} from 'lucide-react';
import type { BatchLogsResponse, BatchLogsFilters } from '@/types/importExport.types';

interface BatchLogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    logsData: BatchLogsResponse | null;
    loading: boolean;
    filters: BatchLogsFilters;
    onFilterChange: (filters: BatchLogsFilters) => void;
}

export const BatchLogsModal: React.FC<BatchLogsModalProps> = ({
    isOpen,
    onClose,
    logsData,
    loading,
    filters,
    onFilterChange
}) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState<string>('all');

    if (!isOpen) return null;

    const getLogStatusBadge = (status: string) => {
        switch (status) {
            case 'created':
            case 'success':
                return (
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 w-fit">
                        <CheckCircle className="w-3 h-3" />
                        {status === 'created' ? 'Créé' : 'Succès'}
                    </span>
                );
            case 'updated':
                return (
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded flex items-center gap-1 w-fit">
                        <RefreshCw className="w-3 h-3" />
                        Mis à jour
                    </span>
                );
            case 'failed':
                return (
                    <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1 w-fit">
                        <XCircle className="w-3 h-3" />
                        Échoué
                    </span>
                );
            case 'skipped':
                return (
                    <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" />
                        Ignoré
                    </span>
                );
            case 'warning':
                return (
                    <span className="text-xs px-2 py-0.5 bg-orange-100 text-orange-700 rounded flex items-center gap-1 w-fit">
                        <AlertTriangle className="w-3 h-3" />
                        Avertissement
                    </span>
                );
            default:
                return <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{status}</span>;
        }
    };

    const handleSearch = () => {
        onFilterChange({ ...filters, search: searchTerm, page: 1 });
    };

    const handleStatusFilter = (status: string) => {
        setStatusFilter(status);
        const newFilters: BatchLogsFilters = { ...filters, page: 1 };
        if (status !== 'all') {
            newFilters.status = status as any;
        } else {
            delete newFilters.status;
        }
        onFilterChange(newFilters);
    };

    const handlePageChange = (page: number) => {
        onFilterChange({ ...filters, page });
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-gray-200">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-900">Logs de l'opération</h2>
                        {logsData?.batch && (
                            <p className="text-sm text-gray-600 mt-1">
                                {logsData.batch.batch_id} - {logsData.batch.template}
                            </p>
                        )}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                {/* Stats */}
                {logsData?.stats && (
                    <div className="px-6 py-4 bg-gray-50 border-b border-gray-200">
                        <div className="grid grid-cols-5 gap-4">
                            <div className="text-center">
                                <p className="text-xs text-gray-600">Total</p>
                                <p className="text-xl font-bold text-gray-900">{logsData.stats.total}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-green-600">Succès</p>
                                <p className="text-xl font-bold text-green-700">{logsData.stats.success}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-red-600">Échoués</p>
                                <p className="text-xl font-bold text-red-700">{logsData.stats.failed}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-yellow-600">Ignorés</p>
                                <p className="text-xl font-bold text-yellow-700">{logsData.stats.skipped}</p>
                            </div>
                            <div className="text-center">
                                <p className="text-xs text-orange-600">Avertissements</p>
                                <p className="text-xl font-bold text-orange-700">{logsData.stats.warning}</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Filters */}
                <div className="px-6 py-4 border-b border-gray-200 bg-white">
                    <div className="flex gap-4">
                        {/* Search */}
                        <div className="flex-1 flex gap-2">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher un enregistrement..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                />
                            </div>
                            <button
                                onClick={handleSearch}
                                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                            >
                                Rechercher
                            </button>
                        </div>

                        {/* Status Filter */}
                        <div className="flex gap-2">
                            <button
                                onClick={() => handleStatusFilter('all')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    statusFilter === 'all'
                                        ? 'bg-purple-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Tous
                            </button>
                            <button
                                onClick={() => handleStatusFilter('success')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    statusFilter === 'success'
                                        ? 'bg-green-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Succès
                            </button>
                            <button
                                onClick={() => handleStatusFilter('failed')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    statusFilter === 'failed'
                                        ? 'bg-red-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Échoués
                            </button>
                            <button
                                onClick={() => handleStatusFilter('skipped')}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                                    statusFilter === 'skipped'
                                        ? 'bg-yellow-600 text-white'
                                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                }`}
                            >
                                Ignorés
                            </button>
                        </div>
                    </div>
                </div>

                {/* Logs Content */}
                <div className="flex-1 overflow-auto p-6">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                            <p>Chargement des logs...</p>
                        </div>
                    ) : logsData?.logs?.data && logsData.logs.data.length > 0 ? (
                        <div className="space-y-3">
                            {logsData.logs.data.map((log) => (
                                <div
                                    key={log.id}
                                    className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-sm font-medium text-gray-500">
                                                #{log.record_number}
                                            </span>
                                            {log.record_identifier && (
                                                <span className="text-sm font-semibold text-gray-900">
                                                    {log.record_identifier}
                                                </span>
                                            )}
                                        </div>
                                        {getLogStatusBadge(log.status)}
                                    </div>

                                    {log.message && (
                                        <p className="text-sm text-gray-700 mb-2">{log.message}</p>
                                    )}

                                    {log.errors && (
                                        <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded">
                                            <p className="text-xs font-semibold text-red-800 mb-1">Erreurs:</p>
                                            <pre className="text-xs text-red-700 whitespace-pre-wrap">
                                                {typeof log.errors === 'string'
                                                    ? log.errors
                                                    : JSON.stringify(log.errors, null, 2)}
                                            </pre>
                                        </div>
                                    )}

                                    {log.record_data && Object.keys(log.record_data).length > 0 && (
                                        <details className="mt-2">
                                            <summary className="text-xs font-medium text-gray-600 cursor-pointer hover:text-gray-900">
                                                Voir les données
                                            </summary>
                                            <pre className="mt-2 p-3 bg-gray-50 border border-gray-200 rounded text-xs overflow-auto max-h-40">
                                                {JSON.stringify(log.record_data, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-gray-400">
                            <FileText className="w-16 h-16 text-gray-300 mb-4" />
                            <p className="font-medium">Aucun log trouvé</p>
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {logsData?.logs && logsData.logs.total > 0 && (
                    <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
                        <div className="flex items-center justify-between">
                            <p className="text-sm text-gray-600">
                                Affichage de {((logsData.logs.current_page - 1) * logsData.logs.per_page) + 1} à{' '}
                                {Math.min(logsData.logs.current_page * logsData.logs.per_page, logsData.logs.total)} sur{' '}
                                {logsData.logs.total} enregistrements
                            </p>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => handlePageChange(logsData.logs.current_page - 1)}
                                    disabled={logsData.logs.current_page === 1}
                                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronLeft className="w-4 h-4" />
                                </button>
                                <span className="px-4 py-2 text-sm font-medium text-gray-700">
                                    Page {logsData.logs.current_page} / {logsData.logs.last_page}
                                </span>
                                <button
                                    onClick={() => handlePageChange(logsData.logs.current_page + 1)}
                                    disabled={logsData.logs.current_page === logsData.logs.last_page}
                                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    <ChevronRight className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
