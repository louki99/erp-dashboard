import { useState, useEffect, useCallback } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    ArrowLeft,
    CheckCircle,
    Upload,
    FileText,
    Settings,
    Play,
    RefreshCw,
    Download,
    XCircle,
    AlertTriangle,
    Eye
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template, BatchOperation, BatchLog } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type TabType = 'data' | 'details' | 'actions';

export const ImportPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('data');
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [batchStatus, setBatchStatus] = useState<BatchOperation | null>(null);
    const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
    const [options, setOptions] = useState({
        update_existing: true,
        skip_errors: false,
        validate_only: false,
        batch_size: 100
    });

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
            const importTemplates = data.templates.filter(t => t.allow_import);
            setTemplates(importTemplates);
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

    const handleStartImport = async () => {
        if (!selectedTemplate || !uploadedFile) {
            toast.error('Veuillez sélectionner un template et un fichier');
            return;
        }

        setImporting(true);
        try {
            const uploadData = await importExportApi.import.uploadFile(selectedTemplate.code, uploadedFile);
            const importData = await importExportApi.import.startImport({
                template_code: selectedTemplate.code,
                file_path: uploadData.file_path,
                options: options,
                use_queue: true
            });

            setBatchId(importData.batch_id);
            toast.success('Import démarré avec succès');
            setActiveTab('details');
            checkBatchStatus(importData.batch_id);
        } catch (error: any) {
            setImporting(false);
            console.error('Import failed:', error);
            toast.error(error?.response?.data?.message || 'Échec de l\'import');
        }
    };

    const checkBatchStatus = useCallback(async (id?: string) => {
        const targetId = id || batchId;
        if (!targetId) return;

        try {
            const data = await importExportApi.import.getStatus(targetId);
            setBatchStatus(data.batch);

            if (data.batch.status === 'completed') {
                setImporting(false);
                toast.success(`Import terminé! ${data.batch.successful_records} enregistrements importés`);
                loadBatchLogs(targetId);
            } else if (data.batch.status === 'failed') {
                setImporting(false);
                toast.error('L\'import a échoué');
                loadBatchLogs(targetId);
            }
        } catch (error) {
            console.error('Failed to check status:', error);
        }
    }, [batchId]);

    const loadBatchLogs = async (id: string) => {
        try {
            const data = await importExportApi.import.getLogs(id);
            setBatchLogs(data.logs.data || data.logs);
        } catch (error) {
            console.error('Failed to load logs:', error);
        }
    };

    const downloadErrorReport = () => {
        if (batchId) {
            importExportApi.import.downloadErrorReport(batchId);
        }
    };

    const resetForm = () => {
        setUploadedFile(null);
        setBatchId(null);
        setBatchStatus(null);
        setBatchLogs([]);
        setImporting(false);
        setActiveTab('data');
    };

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 p-4">
                    <button
                        onClick={() => navigate('/import-export')}
                        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-6"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        Retour
                    </button>
                    
                    {selectedTemplate && (
                        <div className="space-y-2">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Template</p>
                                <p className="font-medium text-gray-900">{selectedTemplate.name}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Code</p>
                                <p className="font-medium text-gray-900">{selectedTemplate.code}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Objet</p>
                                <p className="font-medium text-gray-900">{selectedTemplate.object_name}</p>
                            </div>
                            {uploadedFile && (
                                <div className="p-3 bg-blue-50 rounded-lg">
                                    <p className="text-xs text-blue-600 mb-1">Fichier</p>
                                    <p className="font-medium text-blue-900 text-sm">{uploadedFile.name}</p>
                                    <p className="text-xs text-blue-700 mt-1">
                                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            )}
                            {batchStatus && (
                                <div className="p-3 bg-green-50 rounded-lg">
                                    <p className="text-xs text-green-600 mb-1">Statut</p>
                                    <p className="font-medium text-green-900">{batchStatus.status}</p>
                                    <p className="text-xs text-green-700 mt-1">
                                        {batchStatus.progress_percentage}% complété
                                    </p>
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-6 space-y-2">
                        <h3 className="text-xs font-semibold text-gray-600 uppercase mb-2">Options</h3>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={options.update_existing}
                                onChange={(e) => setOptions({...options, update_existing: e.target.checked})}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={importing}
                            />
                            <span className="text-gray-700">Mettre à jour existants</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={options.skip_errors}
                                onChange={(e) => setOptions({...options, skip_errors: e.target.checked})}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={importing}
                            />
                            <span className="text-gray-700">Ignorer les erreurs</span>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={options.validate_only}
                                onChange={(e) => setOptions({...options, validate_only: e.target.checked})}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                disabled={importing}
                            />
                            <span className="text-gray-700">Validation uniquement</span>
                        </label>
                        <div className="pt-2">
                            <label className="block text-xs text-gray-600 mb-1">Taille du lot</label>
                            <input
                                type="number"
                                value={options.batch_size}
                                onChange={(e) => setOptions({...options, batch_size: parseInt(e.target.value)})}
                                min="10"
                                max="1000"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                disabled={importing}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-white">
                    {/* Header with Actions */}
                    <div className="bg-white border-b border-gray-200 px-6 py-3">
                        <div className="flex items-center justify-between">
                            <h1 className="text-xl font-semibold text-gray-900">
                                Import de Données
                            </h1>
                            <div className="flex items-center gap-2">
                                {batchStatus?.status === 'completed' && (
                                    <>
                                        {batchStatus.failed_records > 0 && (
                                            <button
                                                onClick={downloadErrorReport}
                                                className="px-4 py-2 border border-red-600 text-red-700 rounded-md hover:bg-red-50 transition flex items-center gap-2"
                                            >
                                                <Download className="w-4 h-4" />
                                                Rapport d'erreurs
                                            </button>
                                        )}
                                        <button
                                            onClick={resetForm}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                                        >
                                            Nouvel Import
                                        </button>
                                    </>
                                )}
                                {!batchId && (
                                    <button
                                        onClick={handleStartImport}
                                        disabled={!selectedTemplate || !uploadedFile || importing}
                                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Play className="w-4 h-4" />
                                        {importing ? 'Import en cours...' : 'Démarrer Import'}
                                    </button>
                                )}
                                {batchId && batchStatus?.status === 'processing' && (
                                    <button
                                        onClick={() => checkBatchStatus()}
                                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition flex items-center gap-2"
                                    >
                                        <RefreshCw className="w-4 h-4" />
                                        Actualiser
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-gray-50 border-b border-gray-200">
                        <div className="flex px-6">
                            <button
                                onClick={() => setActiveTab('data')}
                                className={`px-6 py-3 font-medium transition relative ${
                                    activeTab === 'data'
                                        ? 'text-blue-600 bg-white border-t-2 border-t-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <FileText className="w-4 h-4" />
                                    Données
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('details')}
                                className={`px-6 py-3 font-medium transition relative ${
                                    activeTab === 'details'
                                        ? 'text-blue-600 bg-white border-t-2 border-t-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <Settings className="w-4 h-4" />
                                    Détails
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveTab('actions')}
                                className={`px-6 py-3 font-medium transition relative ${
                                    activeTab === 'actions'
                                        ? 'text-blue-600 bg-white border-t-2 border-t-blue-600'
                                        : 'text-gray-600 hover:text-gray-900'
                                }`}
                            >
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-4 h-4" />
                                    Actions
                                </div>
                            </button>
                        </div>
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto">
                        {activeTab === 'data' && (
                            <DataTab 
                                templates={templates}
                                selectedTemplate={selectedTemplate}
                                setSelectedTemplate={setSelectedTemplate}
                                uploadedFile={uploadedFile}
                                handleFileChange={handleFileChange}
                            />
                        )}
                        {activeTab === 'details' && (
                            <DetailsTab 
                                batchStatus={batchStatus}
                                batchLogs={batchLogs}
                                importing={importing}
                            />
                        )}
                        {activeTab === 'actions' && (
                            <ActionsTab 
                                selectedTemplate={selectedTemplate}
                                batchStatus={batchStatus}
                            />
                        )}
                    </div>
                </div>
            }
        />
    );
};

// Data Tab - Template Selection and File Upload
const DataTab = ({ 
    templates, 
    selectedTemplate, 
    setSelectedTemplate,
    uploadedFile,
    handleFileChange
}: any) => {
    return (
        <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Sélection du Template</h3>
                </div>
                <div className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {templates.map((template: Template) => (
                            <button
                                key={template.id}
                                onClick={() => setSelectedTemplate(template)}
                                className={`p-4 rounded-lg border-2 text-left transition ${
                                    selectedTemplate?.id === template.id
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-blue-300'
                                }`}
                            >
                                <div className="flex items-start gap-3">
                                    <FileText className={`w-5 h-5 mt-0.5 ${
                                        selectedTemplate?.id === template.id
                                            ? 'text-blue-600'
                                            : 'text-gray-400'
                                    }`} />
                                    <div className="flex-1">
                                        <h3 className="font-medium text-gray-900">{template.name}</h3>
                                        <p className="text-sm text-gray-600 mt-1">{template.object_name}</p>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                                                {template.code}
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
            </div>

            {selectedTemplate && (
                <div className="bg-white border border-gray-200 rounded-lg mt-6">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Téléchargement du Fichier</h3>
                    </div>
                    <div className="p-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                            <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <input
                                type="file"
                                id="import-file-upload"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                            <label
                                htmlFor="import-file-upload"
                                className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition"
                            >
                                <Upload className="w-4 h-4" />
                                Choisir un fichier
                            </label>
                            <p className="text-sm text-gray-600 mt-2">
                                CSV, XLSX ou XLS (max 20MB)
                            </p>
                            {uploadedFile && (
                                <div className="mt-4 p-3 bg-blue-50 rounded-lg inline-block">
                                    <p className="text-sm font-medium text-blue-900">{uploadedFile.name}</p>
                                    <p className="text-xs text-blue-600 mt-1">
                                        {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                    </p>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {selectedTemplate && (
                <div className="bg-white border border-gray-200 rounded-lg mt-6">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Champs du Template</h3>
                        <p className="text-xs text-gray-600 mt-1">
                            {selectedTemplate.fields?.length || 0} champs définis
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700 text-white">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Champ</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Intitulé</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Type</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Requis</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Table Source</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {selectedTemplate.fields?.map((field: any) => (
                                    <tr key={field.id} className="hover:bg-blue-50">
                                        <td className="px-4 py-2 text-sm font-medium">{field.field_name}</td>
                                        <td className="px-4 py-2 text-sm">{field.display_name}</td>
                                        <td className="px-4 py-2 text-sm">{field.field_type}</td>
                                        <td className="px-4 py-2 text-sm">
                                            {field.is_required ? (
                                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Oui</span>
                                            ) : (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Non</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{field.source_table}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// Details Tab - Import Progress and Results
const DetailsTab = ({ batchStatus, batchLogs }: any) => {
    if (!batchStatus) {
        return (
            <div className="p-6">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                    <p className="text-gray-600">Aucun import en cours</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Sélectionnez un template et téléchargez un fichier pour commencer
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Progression de l'Import</h3>
                </div>
                <div className="p-6">
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
                                    className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${batchStatus.progress_percentage}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600">Total</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {batchStatus.total_records}
                                </p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <p className="text-xs text-green-600">Réussis</p>
                                <p className="text-2xl font-bold text-green-700 mt-1">
                                    {batchStatus.successful_records}
                                </p>
                            </div>
                            <div className="p-4 bg-red-50 rounded-lg">
                                <p className="text-xs text-red-600">Échoués</p>
                                <p className="text-2xl font-bold text-red-700 mt-1">
                                    {batchStatus.failed_records}
                                </p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-600">Statut</p>
                                <p className="text-sm font-bold text-blue-700 mt-1 uppercase">
                                    {batchStatus.status}
                                </p>
                            </div>
                        </div>

                        {batchStatus.status === 'completed' && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <p className="font-medium text-green-900">Import terminé avec succès!</p>
                                </div>
                            </div>
                        )}

                        {batchStatus.status === 'failed' && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <XCircle className="w-5 h-5 text-red-600" />
                                    <p className="font-medium text-red-900">L'import a échoué</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {batchLogs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg mt-6">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Logs d'Import</h3>
                        <p className="text-xs text-gray-600 mt-1">
                            {batchLogs.length} entrées
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700 text-white">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Ligne</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Niveau</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Message</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Détails</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {batchLogs.map((log: BatchLog, index: number) => (
                                    <tr key={index} className="hover:bg-blue-50">
                                        <td className="px-4 py-2 text-sm">{log.record_number || '-'}</td>
                                        <td className="px-4 py-2 text-sm">
                                            {log.status === 'failed' && (
                                                <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded flex items-center gap-1 w-fit">
                                                    <XCircle className="w-3 h-3" />
                                                    Erreur
                                                </span>
                                            )}
                                            {log.status === 'warning' && (
                                                <span className="text-xs px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded flex items-center gap-1 w-fit">
                                                    <AlertTriangle className="w-3 h-3" />
                                                    Avertissement
                                                </span>
                                            )}
                                            {log.status === 'success' && (
                                                <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1 w-fit">
                                                    <CheckCircle className="w-3 h-3" />
                                                    Succès
                                                </span>
                                            )}
                                            {log.status === 'skipped' && (
                                                <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">Ignoré</span>
                                            )}
                                        </td>
                                        <td className="px-4 py-2 text-sm">{log.message}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600">
                                            {log.errors ? JSON.stringify(log.errors) : '-'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

// Actions Tab - Post-Import Actions
const ActionsTab = ({ selectedTemplate, batchStatus }: any) => {
    const navigate = useNavigate();

    return (
        <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Actions Disponibles</h3>
                </div>
                <div className="p-6 space-y-4">
                    {selectedTemplate && (
                        <button 
                            onClick={() => navigate(`/import-export/templates/${selectedTemplate.id}`)}
                            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Eye className="w-5 h-5 text-blue-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Voir le Template</h4>
                                    <p className="text-sm text-gray-600">Consulter la configuration du template</p>
                                </div>
                            </div>
                        </button>
                    )}
                    
                    <button className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left">
                        <div className="flex items-center gap-3">
                            <Download className="w-5 h-5 text-green-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Télécharger Template Vide</h4>
                                <p className="text-sm text-gray-600">Obtenir un fichier template pour l'import</p>
                            </div>
                        </div>
                    </button>

                    {batchStatus?.status === 'completed' && batchStatus.failed_records > 0 && (
                        <button className="w-full p-4 border-2 border-red-200 rounded-lg hover:border-red-500 hover:bg-red-50 transition text-left">
                            <div className="flex items-center gap-3">
                                <Download className="w-5 h-5 text-red-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Télécharger Rapport d'Erreurs</h4>
                                    <p className="text-sm text-gray-600">
                                        {batchStatus.failed_records} enregistrements en erreur
                                    </p>
                                </div>
                            </div>
                        </button>
                    )}

                    <button 
                        onClick={() => navigate('/import-export/batches')}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition text-left"
                    >
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-purple-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Historique des Imports</h4>
                                <p className="text-sm text-gray-600">Consulter tous les imports précédents</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
