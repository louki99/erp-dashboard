import { useState, useEffect, useCallback } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    Download, 
    FileText, 
    CheckCircle, 
    XCircle,
    RefreshCw,
    ArrowLeft,
    Filter,
    Upload,
    Info,
    AlertTriangle,
    X
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template, BatchOperation, ExportFilters } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export const ExportPage = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [exporting, setExporting] = useState(false);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [batchStatus, setBatchStatus] = useState<BatchOperation | null>(null);
    const [filters, setFilters] = useState<ExportFilters>({});
    const [options, setOptions] = useState({
        format: 'xlsx' as 'xlsx' | 'csv',
        include_headers: true,
        batch_size: 1000
    });
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [exportMode, setExportMode] = useState<'database' | 'file'>('database');
    const [estimatedRecords, setEstimatedRecords] = useState<number>(0);

    useEffect(() => {
        loadTemplates();
    }, []);

    useEffect(() => {
        let interval: ReturnType<typeof setInterval> | undefined;
        if (batchId && batchStatus?.status === 'processing') {
            interval = setInterval(() => {
                checkBatchStatus();
            }, 2000);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [batchId, batchStatus?.status]);

    const loadTemplates = async () => {
        try {
            const data = await importExportApi.templates.getTemplates({ 
                type: 'both',
                is_active: true 
            });
            const exportTemplates = data.templates.filter(t => t.allow_export);
            setTemplates(exportTemplates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('Échec du chargement des templates');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            const validTypes = ['text/csv', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
            if (!validTypes.includes(selectedFile.type) && !selectedFile.name.match(/\.(csv|xlsx|xls)$/i)) {
                toast.error('Type de fichier non valide. Utilisez CSV ou Excel.');
                return;
            }
            if (selectedFile.size > 20 * 1024 * 1024) {
                toast.error('Le fichier est trop volumineux. Maximum 20MB.');
                return;
            }
            setUploadedFile(selectedFile);
        }
    };

    const openConfirmModal = () => {
        if (!selectedTemplate) {
            toast.error('Veuillez sélectionner un template');
            return;
        }
        if (exportMode === 'file' && !uploadedFile) {
            toast.error('Veuillez télécharger un fichier');
            return;
        }
        // Estimate records (mock for now)
        setEstimatedRecords(Math.floor(Math.random() * 1000) + 100);
        setShowConfirmModal(true);
    };

    const handleExport = async () => {
        setShowConfirmModal(false);
        setExporting(true);
        try {
            const exportData = await importExportApi.export.startExport({
                template_code: selectedTemplate!.code,
                filters: filters,
                options: options,
                use_queue: true
            });

            setBatchId(exportData.batch_id);
            toast.success('Export démarré avec succès');
            checkBatchStatus(exportData.batch_id);
        } catch (error: any) {
            setExporting(false);
            console.error('Export failed:', error);
            toast.error(error?.response?.data?.message || 'Échec de l\'export');
        }
    };

    const checkBatchStatus = useCallback(async (id?: string) => {
        const targetId = id || batchId;
        if (!targetId) return;

        try {
            const data = await importExportApi.export.getStatus(targetId);
            setBatchStatus(data.batch);

            if (data.batch.status === 'completed') {
                setExporting(false);
                toast.success(`Export terminé! ${data.batch.total_records} enregistrements exportés`);
            } else if (data.batch.status === 'failed') {
                setExporting(false);
                toast.error('L\'export a échoué');
            }
        } catch (error) {
            console.error('Failed to check status:', error);
        }
    }, [batchId]);

    const downloadFile = () => {
        if (batchId) {
            importExportApi.export.downloadFile(batchId);
        }
    };

    const resetForm = () => {
        setBatchId(null);
        setBatchStatus(null);
        setExporting(false);
        setFilters({});
    };

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

                    <div className="flex items-center gap-2 mb-2 text-green-800">
                        <Download className="w-5 h-5" />
                        <h2 className="font-semibold text-lg">Export</h2>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Format d'Export
                            </label>
                            <select
                                value={options.format}
                                onChange={(e) => setOptions({...options, format: e.target.value as 'xlsx' | 'csv'})}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            >
                                <option value="xlsx">Excel (XLSX)</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>

                        <div>
                            <label className="flex items-center gap-2 text-sm">
                                <input
                                    type="checkbox"
                                    checked={options.include_headers}
                                    onChange={(e) => setOptions({...options, include_headers: e.target.checked})}
                                    className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                                />
                                <span>Inclure les en-têtes</span>
                            </label>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                Taille du lot
                            </label>
                            <input
                                type="number"
                                value={options.batch_size}
                                onChange={(e) => setOptions({...options, batch_size: parseInt(e.target.value)})}
                                min="100"
                                max="10000"
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-slate-50">
                    <div className="bg-white border-b px-6 py-4">
                        <h1 className="text-2xl font-bold text-gray-900">Exporter des Données</h1>
                        <p className="text-sm text-gray-600 mt-1">
                            Sélectionnez un template et configurez vos filtres
                        </p>
                    </div>

                    <div className="flex-1 p-6 overflow-auto">
                        <div className="max-w-4xl mx-auto space-y-6">
                            {/* Step 1: Select Template */}
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <div className="flex items-center gap-2 mb-4">
                                    <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold">
                                        1
                                    </div>
                                    <h2 className="text-lg font-semibold text-gray-900">Sélectionner un Template</h2>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {templates.map((template) => (
                                        <button
                                            key={template.id}
                                            onClick={() => setSelectedTemplate(template)}
                                            className={`p-4 rounded-lg border-2 text-left transition ${
                                                selectedTemplate?.id === template.id
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            <div className="flex items-start gap-3">
                                                <FileText className={`w-5 h-5 mt-0.5 ${
                                                    selectedTemplate?.id === template.id
                                                        ? 'text-green-600'
                                                        : 'text-gray-400'
                                                }`} />
                                                <div className="flex-1">
                                                    <h3 className="font-medium text-gray-900">{template.name}</h3>
                                                    <p className="text-sm text-gray-600 mt-1">{template.object_name}</p>
                                                    <div className="flex items-center gap-2 mt-2">
                                                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                            {template.file_type.toUpperCase()}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {template.fields?.length || 0} champs
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Step 2: Choose Export Mode */}
                            {selectedTemplate && (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold">
                                            2
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900">Choisir le Mode d'Export</h2>
                                    </div>
                                    
                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <button
                                            onClick={() => setExportMode('database')}
                                            className={`p-4 rounded-lg border-2 transition ${
                                                exportMode === 'database'
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            <Download className={`w-6 h-6 mx-auto mb-2 ${
                                                exportMode === 'database' ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                            <h3 className="font-medium text-gray-900 text-sm">Exporter depuis la Base</h3>
                                            <p className="text-xs text-gray-600 mt-1">Exporter les données de la base de données</p>
                                        </button>
                                        
                                        <button
                                            onClick={() => setExportMode('file')}
                                            className={`p-4 rounded-lg border-2 transition ${
                                                exportMode === 'file'
                                                    ? 'border-green-500 bg-green-50'
                                                    : 'border-gray-200 hover:border-green-300'
                                            }`}
                                        >
                                            <Upload className={`w-6 h-6 mx-auto mb-2 ${
                                                exportMode === 'file' ? 'text-green-600' : 'text-gray-400'
                                            }`} />
                                            <h3 className="font-medium text-gray-900 text-sm">Télécharger un Fichier</h3>
                                            <p className="text-xs text-gray-600 mt-1">Traiter et exporter depuis un fichier</p>
                                        </button>
                                    </div>

                                    {exportMode === 'database' && (
                                        <div className="p-4 border-2 border-dashed border-gray-300 rounded-lg">
                                            <Filter className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <p className="text-sm text-gray-600 text-center">
                                                Filtres optionnels pour exporter uniquement certaines données
                                            </p>
                                        </div>
                                    )}

                                    {exportMode === 'file' && (
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                                            <input
                                                type="file"
                                                id="export-file-upload"
                                                accept=".csv,.xlsx,.xls"
                                                onChange={handleFileChange}
                                                className="hidden"
                                            />
                                            <label
                                                htmlFor="export-file-upload"
                                                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                                            >
                                                <Upload className="w-4 h-4" />
                                                Choisir un fichier
                                            </label>
                                            <p className="text-sm text-gray-600 mt-2">
                                                CSV, XLSX ou XLS (max 20MB)
                                            </p>
                                            {uploadedFile && (
                                                <div className="mt-4 p-3 bg-green-50 rounded-lg inline-block">
                                                    <p className="text-sm font-medium text-green-900">{uploadedFile.name}</p>
                                                    <p className="text-xs text-green-600 mt-1">
                                                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Step 3: Confirm and Start Export */}
                            {selectedTemplate && !batchId && (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center gap-2 mb-4">
                                        <div className="w-8 h-8 rounded-full bg-green-100 text-green-600 flex items-center justify-center font-semibold">
                                            3
                                        </div>
                                        <h2 className="text-lg font-semibold text-gray-900">Confirmer et Démarrer</h2>
                                    </div>
                                    <button
                                        onClick={openConfirmModal}
                                        disabled={exporting || (exportMode === 'file' && !uploadedFile)}
                                        className="w-full py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                                    >
                                        {exporting ? 'Export en cours...' : 'Vérifier et Démarrer l\'Export'}
                                    </button>
                                </div>
                            )}

                            {/* Confirmation Modal */}
                            {showConfirmModal && (
                                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                                    <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                                        <div className="p-6 border-b border-gray-200">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                                                        <Info className="w-5 h-5 text-green-600" />
                                                    </div>
                                                    <h2 className="text-xl font-semibold text-gray-900">Confirmer l'Export</h2>
                                                </div>
                                                <button
                                                    onClick={() => setShowConfirmModal(false)}
                                                    className="p-2 hover:bg-gray-100 rounded-lg transition"
                                                >
                                                    <X className="w-5 h-5 text-gray-500" />
                                                </button>
                                            </div>
                                        </div>

                                        <div className="p-6 space-y-4">
                                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                                <div className="flex items-start gap-3">
                                                    <Info className="w-5 h-5 text-blue-600 mt-0.5" />
                                                    <div>
                                                        <h3 className="font-medium text-blue-900">Informations de l'Export</h3>
                                                        <p className="text-sm text-blue-700 mt-1">
                                                            Veuillez vérifier les détails avant de continuer
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-xs text-gray-600 mb-1">Template</p>
                                                    <p className="font-medium text-gray-900">{selectedTemplate?.name}</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-xs text-gray-600 mb-1">Format</p>
                                                    <p className="font-medium text-gray-900">{options.format.toUpperCase()}</p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-xs text-gray-600 mb-1">Mode</p>
                                                    <p className="font-medium text-gray-900">
                                                        {exportMode === 'database' ? 'Base de données' : 'Fichier téléchargé'}
                                                    </p>
                                                </div>
                                                <div className="p-4 bg-gray-50 rounded-lg">
                                                    <p className="text-xs text-gray-600 mb-1">Enregistrements estimés</p>
                                                    <p className="font-medium text-gray-900">{estimatedRecords.toLocaleString()}</p>
                                                </div>
                                            </div>

                                            {uploadedFile && (
                                                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                    <p className="text-xs text-green-600 mb-1">Fichier téléchargé</p>
                                                    <p className="font-medium text-green-900">{uploadedFile.name}</p>
                                                    <p className="text-sm text-green-700 mt-1">
                                                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                                    </p>
                                                </div>
                                            )}

                                            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                                                <div className="flex items-start gap-3">
                                                    <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
                                                    <div>
                                                        <h3 className="font-medium text-yellow-900">Attention</h3>
                                                        <p className="text-sm text-yellow-700 mt-1">
                                                            L'export peut prendre plusieurs minutes selon la quantité de données.
                                                            Vous pourrez suivre la progression en temps réel.
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="p-6 border-t border-gray-200 flex gap-3">
                                            <button
                                                onClick={() => setShowConfirmModal(false)}
                                                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                                            >
                                                Annuler
                                            </button>
                                            <button
                                                onClick={handleExport}
                                                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
                                            >
                                                Confirmer et Démarrer
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Progress */}
                            {batchStatus && (
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <div className="flex items-center justify-between mb-4">
                                        <h2 className="text-lg font-semibold text-gray-900">Progression de l'Export</h2>
                                        <button
                                            onClick={() => checkBatchStatus()}
                                            className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                        </button>
                                    </div>

                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex items-center justify-between text-sm mb-2">
                                                <span className="text-gray-600">Progression</span>
                                                <span className="font-medium text-gray-900">
                                                    {batchStatus.progress_percentage}%
                                                </span>
                                            </div>
                                            <div className="w-full bg-gray-200 rounded-full h-3">
                                                <div
                                                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                                                    style={{ width: `${batchStatus.progress_percentage}%` }}
                                                ></div>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="p-4 bg-gray-50 rounded-lg">
                                                <p className="text-xs text-gray-600">Total Enregistrements</p>
                                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                                    {batchStatus.total_records}
                                                </p>
                                            </div>
                                            <div className="p-4 bg-green-50 rounded-lg">
                                                <p className="text-xs text-green-600">Exportés</p>
                                                <p className="text-2xl font-bold text-green-700 mt-1">
                                                    {batchStatus.successful_records}
                                                </p>
                                            </div>
                                        </div>

                                        {batchStatus.status === 'completed' && (
                                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                                    <p className="font-medium text-green-900">Export terminé avec succès!</p>
                                                </div>
                                                <div className="mt-3 flex gap-2">
                                                    <button
                                                        onClick={downloadFile}
                                                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition"
                                                    >
                                                        <Download className="w-4 h-4" />
                                                        Télécharger le fichier
                                                    </button>
                                                    <button
                                                        onClick={resetForm}
                                                        className="px-4 py-2 bg-white border border-green-300 text-green-700 rounded-md hover:bg-green-50 transition"
                                                    >
                                                        Nouvel Export
                                                    </button>
                                                </div>
                                            </div>
                                        )}

                                        {batchStatus.status === 'failed' && (
                                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <XCircle className="w-5 h-5 text-red-600" />
                                                    <p className="font-medium text-red-900">L'export a échoué</p>
                                                </div>
                                                {batchStatus.error_summary && (
                                                    <p className="text-sm text-red-700 mt-2">{batchStatus.error_summary}</p>
                                                )}
                                                <button
                                                    onClick={resetForm}
                                                    className="mt-3 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition text-sm"
                                                >
                                                    Réessayer
                                                </button>
                                            </div>
                                        )}

                                        {batchStatus.status === 'processing' && (
                                            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                                                    <p className="font-medium text-blue-900">Export en cours...</p>
                                                </div>
                                                <p className="text-sm text-blue-700 mt-2">
                                                    {batchStatus.processed_records} / {batchStatus.total_records} enregistrements traités
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            }
        />
    );
};
