import { useState, useEffect, useCallback } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    ArrowLeft,
    CheckCircle,
    Download,
    FileText,
    Settings,
    Play,
    RefreshCw,
    XCircle,
    Filter as FilterIcon,
    Eye
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template, BatchOperation, ExportFilters } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

type TabType = 'data' | 'details' | 'actions';

export const ExportPage = () => {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('data');
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

    const handleStartExport = async () => {
        if (!selectedTemplate) {
            toast.error('Veuillez sélectionner un template');
            return;
        }

        console.log('Starting export with options:', options);
        setExporting(true);
        try {
            const exportData = await importExportApi.export.startExport({
                template_code: selectedTemplate.code,
                filters: filters,
                options: options,
                use_queue: true
            });

            setBatchId(exportData.batch_id);
            toast.success('Export démarré avec succès');
            setActiveTab('details');
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
            console.log('Full batch response:', JSON.stringify(data.batch, null, 2));
            console.log('Batch keys:', Object.keys(data.batch));
            setBatchStatus(data.batch);

            const status = data.batch.status?.toLowerCase();
            const jobStatus = data.batch.job_status?.toLowerCase();
            
            // Check both status and job_status fields
            if (status === 'completed' || status === 'done' || status === 'success' ||
                jobStatus === 'completed' || jobStatus === 'done' || jobStatus === 'success') {
                setExporting(false);
                toast.success(`Export terminé! ${data.batch.total_records || data.batch.successful_records || 0} enregistrements exportés`);
            } else if (status === 'failed' || status === 'error' ||
                       jobStatus === 'failed' || jobStatus === 'error') {
                setExporting(false);
                toast.error('L\'export a échoué');
            }
        } catch (error) {
            console.error('Failed to check status:', error);
        }
    }, [batchId]);

    const downloadFile = async () => {
        if (!batchId) return;
        
        try {
            console.log('Downloading with format:', options.format);
            toast.loading('Téléchargement en cours...');
            const result = await importExportApi.export.downloadFile(batchId, options.format);
            toast.dismiss();
            toast.success(`Fichier téléchargé: ${result.filename}`);
        } catch (error: any) {
            toast.dismiss();
            toast.error(error.message || 'Échec du téléchargement');
            console.error('Download error:', error);
        }
    };

    const resetForm = () => {
        setBatchId(null);
        setBatchStatus(null);
        setExporting(false);
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
                        <div>
                            <label className="block text-xs text-gray-600 mb-1">Format</label>
                            <select
                                value={options.format}
                                onChange={(e) => setOptions({...options, format: e.target.value as 'xlsx' | 'csv'})}
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                disabled={exporting}
                            >
                                <option value="xlsx">XLSX (Excel)</option>
                                <option value="csv">CSV</option>
                            </select>
                        </div>
                        <label className="flex items-center gap-2 text-sm">
                            <input
                                type="checkbox"
                                checked={options.include_headers}
                                onChange={(e) => setOptions({...options, include_headers: e.target.checked})}
                                className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                                disabled={exporting}
                            />
                            <span className="text-gray-700">Inclure les en-têtes</span>
                        </label>
                        <div className="pt-2">
                            <label className="block text-xs text-gray-600 mb-1">Taille du lot</label>
                            <input
                                type="number"
                                value={options.batch_size}
                                onChange={(e) => setOptions({...options, batch_size: parseInt(e.target.value)})}
                                min="100"
                                max="10000"
                                className="w-full px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-green-500 focus:border-green-500"
                                disabled={exporting}
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
                                Export de Données
                            </h1>
                            <div className="flex items-center gap-2">
                                {batchStatus && ['completed', 'done', 'success'].includes(batchStatus.status?.toLowerCase()) && batchStatus.total_records > 0 && (
                                    <>
                                        <button
                                            onClick={downloadFile}
                                            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2"
                                        >
                                            <Download className="w-4 h-4" />
                                            Télécharger
                                        </button>
                                        <button
                                            onClick={resetForm}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition"
                                        >
                                            Nouvel Export
                                        </button>
                                    </>
                                )}
                                {batchStatus && ['failed', 'error'].includes(batchStatus.status?.toLowerCase()) && (
                                    <button
                                        onClick={resetForm}
                                        className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition flex items-center gap-2"
                                    >
                                        <XCircle className="w-4 h-4" />
                                        Nouvel Export
                                    </button>
                                )}
                                {!batchId && (
                                    <button
                                        onClick={handleStartExport}
                                        disabled={!selectedTemplate || exporting}
                                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        <Play className="w-4 h-4" />
                                        {exporting ? 'Export en cours...' : 'Démarrer Export'}
                                    </button>
                                )}
                                {batchId && !['completed', 'done', 'success'].includes(batchStatus?.status?.toLowerCase() || '') && (
                                    <>
                                        <button
                                            onClick={() => checkBatchStatus()}
                                            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition flex items-center gap-2"
                                        >
                                            <RefreshCw className="w-4 h-4" />
                                            Actualiser le Statut
                                        </button>
                                        {batchStatus?.filename && (
                                            <button
                                                onClick={downloadFile}
                                                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition flex items-center gap-2"
                                                title="Télécharger le fichier (même si le statut n'est pas à jour)"
                                            >
                                                <Download className="w-4 h-4" />
                                                Forcer le Téléchargement
                                            </button>
                                        )}
                                    </>
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
                                        ? 'text-green-600 bg-white border-t-2 border-t-green-600'
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
                                        ? 'text-green-600 bg-white border-t-2 border-t-green-600'
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
                                        ? 'text-green-600 bg-white border-t-2 border-t-green-600'
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
                            />
                        )}
                        {activeTab === 'details' && (
                            <DetailsTab 
                                batchStatus={batchStatus}
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

// Data Tab - Template Selection and Configuration
const DataTab = ({ 
    templates, 
    selectedTemplate, 
    setSelectedTemplate
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
                        <h3 className="font-semibold text-gray-900">Filtres d'Export (Optionnel)</h3>
                        <p className="text-xs text-gray-600 mt-1">
                            Laissez vide pour exporter toutes les données
                        </p>
                    </div>
                    <div className="p-6">
                        <div className="p-8 border-2 border-dashed border-gray-300 rounded-lg text-center">
                            <FilterIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                            <p className="text-sm text-gray-600">
                                Les filtres permettent d'exporter uniquement les données qui correspondent à vos critères
                            </p>
                            <p className="text-xs text-gray-500 mt-2">
                                Configuration des filtres disponible dans une version future
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {selectedTemplate && (
                <div className="bg-white border border-gray-200 rounded-lg mt-6">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Champs à Exporter</h3>
                        <p className="text-xs text-gray-600 mt-1">
                            {selectedTemplate.fields?.length || 0} champs seront exportés
                        </p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-slate-700 text-white">
                                <tr>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Champ</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Intitulé</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Type</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Table Source</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium">Colonne</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {selectedTemplate.fields?.map((field: any) => (
                                    <tr key={field.id} className="hover:bg-green-50">
                                        <td className="px-4 py-2 text-sm font-medium">{field.field_name}</td>
                                        <td className="px-4 py-2 text-sm">{field.display_name}</td>
                                        <td className="px-4 py-2 text-sm">{field.field_type}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{field.source_table}</td>
                                        <td className="px-4 py-2 text-sm text-gray-600">{field.source_column}</td>
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

// Details Tab - Export Progress and Results
const DetailsTab = ({ batchStatus }: any) => {
    if (!batchStatus) {
        return (
            <div className="p-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
                    <FileText className="w-12 h-12 text-green-400 mx-auto mb-4" />
                    <p className="text-gray-600">Aucun export en cours</p>
                    <p className="text-sm text-gray-500 mt-2">
                        Sélectionnez un template pour commencer
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Progression de l'Export</h3>
                </div>
                <div className="p-6">
                    <div className="space-y-4">
                        <div>
                            <div className="flex items-center justify-between text-sm mb-2">
                                <span className="text-gray-600">Progression</span>
                                <span className="font-medium text-gray-900">
                                    {batchStatus.progress_percentage || 0}%
                                </span>
                            </div>
                            <div className="w-full bg-gray-200 rounded-full h-3">
                                <div
                                    className="bg-green-600 h-3 rounded-full transition-all duration-300"
                                    style={{ width: `${batchStatus.progress_percentage || 0}%` }}
                                ></div>
                            </div>
                        </div>

                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600">Total Enregistrements</p>
                                <p className="text-2xl font-bold text-gray-900 mt-1">
                                    {batchStatus.total_records || 0}
                                </p>
                            </div>
                            <div className="p-4 bg-green-50 rounded-lg">
                                <p className="text-xs text-green-600">Exportés</p>
                                <p className="text-2xl font-bold text-green-700 mt-1">
                                    {batchStatus.successful_records || batchStatus.processed_records || 0}
                                </p>
                            </div>
                            <div className="p-4 bg-blue-50 rounded-lg">
                                <p className="text-xs text-blue-600">Statut</p>
                                <p className="text-sm font-bold text-blue-700 mt-1 uppercase">
                                    {batchStatus.status}
                                </p>
                            </div>
                        </div>

                        {['completed', 'done', 'success'].includes(batchStatus.status?.toLowerCase()) && (
                            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex items-center gap-2">
                                    <CheckCircle className="w-5 h-5 text-green-600" />
                                    <p className="font-medium text-green-900">Export terminé avec succès!</p>
                                </div>
                                <p className="text-sm text-green-700 mt-2">
                                    Le fichier est prêt à être téléchargé
                                </p>
                            </div>
                        )}

                        {['failed', 'error'].includes(batchStatus.status?.toLowerCase()) && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                                <div className="flex items-center gap-2 mb-2">
                                    <XCircle className="w-5 h-5 text-red-600" />
                                    <p className="font-medium text-red-900">L'export a échoué</p>
                                </div>
                                {batchStatus.error_summary && (
                                    <div className="mt-3 p-3 bg-white border border-red-300 rounded">
                                        <p className="text-xs font-semibold text-red-800 mb-1">Détails de l'erreur:</p>
                                        <pre className="text-xs text-red-700 whitespace-pre-wrap font-mono">{batchStatus.error_summary}</pre>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {batchStatus.status === 'completed' && (
                <div className="bg-white border border-gray-200 rounded-lg mt-6">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Informations du Fichier</h3>
                    </div>
                    <div className="p-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Format</p>
                                <p className="font-medium text-gray-900">XLSX</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Enregistrements</p>
                                <p className="font-medium text-gray-900">{batchStatus.total_records}</p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Date de création</p>
                                <p className="font-medium text-gray-900">
                                    {new Date(batchStatus.created_at).toLocaleString('fr-FR')}
                                </p>
                            </div>
                            <div className="p-4 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1">Temps d'exécution</p>
                                <p className="font-medium text-gray-900">
                                    {batchStatus.execution_time ? `${batchStatus.execution_time}s` : '-'}
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// Actions Tab - Post-Export Actions
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
                            className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-left"
                        >
                            <div className="flex items-center gap-3">
                                <Eye className="w-5 h-5 text-green-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Voir le Template</h4>
                                    <p className="text-sm text-gray-600">Consulter la configuration du template</p>
                                </div>
                            </div>
                        </button>
                    )}
                    
                    {batchStatus?.status === 'completed' && (
                        <button className="w-full p-4 border-2 border-green-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-left">
                            <div className="flex items-center gap-3">
                                <Download className="w-5 h-5 text-green-600" />
                                <div>
                                    <h4 className="font-medium text-gray-900">Télécharger le Fichier</h4>
                                    <p className="text-sm text-gray-600">
                                        {batchStatus.total_records} enregistrements exportés
                                    </p>
                                </div>
                            </div>
                        </button>
                    )}

                    <button 
                        onClick={() => navigate('/import-export/batches')}
                        className="w-full p-4 border-2 border-gray-200 rounded-lg hover:border-green-500 hover:bg-green-50 transition text-left"
                    >
                        <div className="flex items-center gap-3">
                            <FileText className="w-5 h-5 text-purple-600" />
                            <div>
                                <h4 className="font-medium text-gray-900">Historique des Exports</h4>
                                <p className="text-sm text-gray-600">Consulter tous les exports précédents</p>
                            </div>
                        </div>
                    </button>
                </div>
            </div>
        </div>
    );
};
