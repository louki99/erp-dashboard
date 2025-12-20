import { useState, useEffect, useCallback, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    CheckCircle,
    Upload,
    FileText,
    Settings,
    Play,
    RefreshCw,
    Download,
    XCircle,
    AlertTriangle,
    Eye,
    Loader2
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template, BatchOperation, BatchLog } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import type { ColDef } from 'ag-grid-community';

export const ImportPage = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [uploadedFile, setUploadedFile] = useState<File | null>(null);
    const [previewData, setPreviewData] = useState<any[]>([]);
    const [editedData, setEditedData] = useState<any[]>([]);
    const [importing, setImporting] = useState(false);
    const [batchId, setBatchId] = useState<string | null>(null);
    const [batchStatus, setBatchStatus] = useState<BatchOperation | null>(null);
    const [batchLogs, setBatchLogs] = useState<BatchLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [validationErrors, setValidationErrors] = useState<Record<number, any>>({});
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
        const status = batchStatus?.status?.toLowerCase();
        // Poll while processing, pending, or running
        if (batchId && status && ['processing', 'pending', 'running', 'queued'].includes(status)) {
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
            setLoading(true);
            const data = await importExportApi.templates.getTemplates({ 
                type: 'both',
                is_active: true 
            });
            const importTemplates = data.templates.filter(t => t.allow_import);
            setTemplates(importTemplates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('Échec du chargement des templates');
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
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
            
            // Parse and preview file data
            await parseFileData(selectedFile);
        }
    };

    const parseFileData = async (file: File) => {
        try {
            const text = await file.text();
            const lines = text.split('\n').filter(line => line.trim());
            
            if (lines.length === 0) {
                toast.error('Le fichier est vide');
                return;
            }

            // Parse CSV (simple parser)
            const headers = lines[0].split(/[,;\t]/).map(h => h.trim().replace(/^"|"$/g, ''));
            const rows = lines.slice(1).map((line, index) => {
                const values = line.split(/[,;\t]/).map(v => v.trim().replace(/^"|"$/g, ''));
                const row: any = { _rowId: index };
                headers.forEach((header, i) => {
                    row[header] = values[i] || '';
                });
                return row;
            });

            setPreviewData(rows);
            setEditedData(JSON.parse(JSON.stringify(rows))); // Deep copy
            toast.success(`${rows.length} lignes chargées`);
        } catch (error) {
            console.error('Failed to parse file:', error);
            toast.error('Échec de la lecture du fichier');
        }
    };

    const validateData = () => {
        if (!selectedTemplate) return;
        
        const errors: Record<number, any> = {};
        const requiredFields = selectedTemplate.fields?.filter(f => f.is_required).map(f => f.field_name) || [];

        editedData.forEach((row, index) => {
            const rowErrors: any = {};
            requiredFields.forEach(field => {
                if (!row[field] || row[field].toString().trim() === '') {
                    rowErrors[field] = 'Champ requis';
                }
            });
            if (Object.keys(rowErrors).length > 0) {
                errors[index] = rowErrors;
            }
        });

        setValidationErrors(errors);
        
        if (Object.keys(errors).length > 0) {
            toast.error(`${Object.keys(errors).length} ligne(s) avec des erreurs`);
            return false;
        }
        
        toast.success('Validation réussie');
        return true;
    };

    const updateCellData = (rowIndex: number, field: string, value: any) => {
        const newData = [...editedData];
        newData[rowIndex] = { ...newData[rowIndex], [field]: value };
        setEditedData(newData);
        
        // Clear validation error for this cell
        if (validationErrors[rowIndex]?.[field]) {
            const newErrors = { ...validationErrors };
            delete newErrors[rowIndex][field];
            if (Object.keys(newErrors[rowIndex]).length === 0) {
                delete newErrors[rowIndex];
            }
            setValidationErrors(newErrors);
        }
    };

    const handleStartImport = async () => {
        if (!selectedTemplate || !uploadedFile) {
            toast.error('Veuillez sélectionner un template et un fichier');
            return;
        }

        if (editedData.length === 0) {
            toast.error('Aucune donnée à importer');
            return;
        }

        // Validate before import
        if (!validateData()) {
            return;
        }

        console.log('=== STARTING IMPORT PROCESS ===');
        console.log('Template:', selectedTemplate.code);
        console.log('Options:', options);
        console.log('Original file:', uploadedFile.name, 'Size:', uploadedFile.size, 'bytes');
        
        setImporting(true);
        try {
            // Step 1: Upload original file (no recreation)
            console.log('Step 1: Uploading original file...');
            const uploadData = await importExportApi.import.uploadFile(selectedTemplate.code, uploadedFile);
            console.log('Upload response:', uploadData);
            console.log('File path:', uploadData.file_path);
            
            // Step 2: Start import
            console.log('Step 2: Starting import with payload:', {
                template_code: selectedTemplate.code,
                file_path: uploadData.file_path,
                options: options,
                use_queue: true
            });
            
            const importData = await importExportApi.import.startImport({
                template_code: selectedTemplate.code,
                file_path: uploadData.file_path,
                options: options,
                use_queue: true
            });
            
            console.log('Start import response:', importData);
            console.log('Batch ID:', importData.batch_id);

            setBatchId(importData.batch_id);
            toast.success('Import démarré avec succès');
            
            // Step 3: Check status
            console.log('Step 3: Checking initial status...');
            checkBatchStatus(importData.batch_id);
        } catch (error: any) {
            setImporting(false);
            console.error('=== IMPORT FAILED ===');
            console.error('Error object:', error);
            console.error('Error response:', error?.response);
            console.error('Error data:', error?.response?.data);
            console.error('Error message:', error?.message);
            console.error('Error stack:', error?.stack);
            toast.error(error?.response?.data?.message || 'Échec de l\'import');
        }
    };

    const checkBatchStatus = useCallback(async (id?: string) => {
        const targetId = id || batchId;
        if (!targetId) return;

        try {
            const data = await importExportApi.import.getStatus(targetId);
            console.log('Import batch status response:', JSON.stringify(data.batch, null, 2));
            console.log('Import batch keys:', Object.keys(data.batch));
            setBatchStatus(data.batch);

            if (data.logs) {
                setBatchLogs(Array.isArray(data.logs) ? data.logs : data.logs.data || []);
            }

            const status = data.batch.status?.toLowerCase();
            const jobStatus = data.batch.job_status?.toLowerCase();
            
            // Check both status and job_status fields, handle multiple status formats
            if (status === 'completed' || status === 'done' || status === 'success' ||
                jobStatus === 'completed' || jobStatus === 'done' || jobStatus === 'success') {
                setImporting(false);
                toast.success(`Import terminé! ${data.batch.successful_records || 0} enregistrements importés`);
            } else if (status === 'failed' || status === 'error' ||
                       jobStatus === 'failed' || jobStatus === 'error') {
                setImporting(false);
                toast.error('L\'import a échoué');
            }
        } catch (error) {
            console.error('Failed to check status:', error);
        }
    }, [batchId]);

    const resetForm = () => {
        setUploadedFile(null);
        setPreviewData([]);
        setEditedData([]);
        setValidationErrors({});
        setBatchId(null);
        setBatchStatus(null);
        setBatchLogs([]);
        setImporting(false);
    };

    // Column definitions for DataGrid
    const colDefs: ColDef<Template>[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            )
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-900">{params.value}</span>
                </div>
            )
        },
        {
            field: 'object_name',
            headerName: 'Objet',
            width: 150,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600">{params.value}</span>
                </div>
            )
        },
    ], []);

    // Left Sidebar Content
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900">Templates d'Import</h2>
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {templates.length} template(s)
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={templates}
                    columnDefs={colDefs}
                    loading={loading}
                    onRowSelected={(data) => {
                        setSelectedTemplate(data);
                        resetForm();
                    }}
                />
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {loading ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-blue-500" />
                                <p>Chargement...</p>
                            </div>
                        ) : selectedTemplate ? (
                            <ImportWorkflowView 
                                template={selectedTemplate}
                                uploadedFile={uploadedFile}
                                handleFileChange={handleFileChange}
                                previewData={previewData}
                                editedData={editedData}
                                updateCellData={updateCellData}
                                validateData={validateData}
                                validationErrors={validationErrors}
                                options={options}
                                setOptions={setOptions}
                                handleStartImport={handleStartImport}
                                importing={importing}
                                batchStatus={batchStatus}
                                batchLogs={batchLogs}
                                resetForm={resetForm}
                                navigate={navigate}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="font-medium">Sélectionnez un template d'import</p>
                                    <p className="text-sm mt-2">Cliquez sur un template dans la liste pour commencer</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        onRefresh={loadTemplates}
                        onStartImport={handleStartImport}
                        onReset={resetForm}
                        hasSelection={!!selectedTemplate}
                        hasFile={!!uploadedFile}
                        importing={importing}
                        navigate={navigate}
                    />
                }
            />
        </>
    );
};

// Action Panel Component
const ActionGroup = ({ children }: { children: React.ReactNode }) => (
    <div className="flex flex-col gap-1 py-3 border-b border-gray-200 last:border-0">
        {children}
    </div>
);

interface ActionItemProps {
    icon: React.ElementType;
    label: string;
    onClick?: () => void;
    variant?: 'default' | 'primary' | 'success';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 hover:bg-gray-50",
        primary: "text-gray-400 hover:text-blue-600 hover:bg-blue-50",
        success: "text-gray-400 hover:text-green-600 hover:bg-green-50"
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto ${
                disabled ? "opacity-30 cursor-not-allowed" : variants[variant]
            }`}
        >
            <Icon className="w-4 h-4 transition-transform group-hover:scale-110" />
            <span className="absolute right-full mr-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-gray-900 text-white text-[10px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50 shadow-lg translate-x-1 group-hover:translate-x-0">
                {label}
                <span className="absolute top-1/2 -translate-y-1/2 -right-1 border-4 border-transparent border-l-gray-900"></span>
            </span>
        </button>
    );
};

interface ActionPanelProps {
    onRefresh: () => void;
    onStartImport: () => void;
    onReset: () => void;
    hasSelection: boolean;
    hasFile: boolean;
    importing: boolean;
    navigate: any;
}

const ActionPanel = ({ onRefresh, onStartImport, onReset, hasSelection, hasFile, importing, navigate }: ActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40 transition-all duration-300">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-blue-500 rounded-full opacity-50"></div>
                </div>
                <ActionItem
                    icon={CheckCircle}
                    label="Valider Données"
                    variant="primary"
                    onClick={() => {}}
                    disabled={!hasSelection || !hasFile || importing}
                />
                <ActionItem
                    icon={Play}
                    label="Démarrer Import"
                    variant="success"
                    onClick={onStartImport}
                    disabled={!hasSelection || !hasFile || importing}
                />
                <ActionItem
                    icon={RefreshCw}
                    label="Réinitialiser"
                    variant="default"
                    onClick={onReset}
                    disabled={importing}
                />
            </ActionGroup>

            <ActionGroup>
                <ActionItem
                    icon={RefreshCw}
                    label="Actualiser"
                    variant="default"
                    onClick={onRefresh}
                />
                <ActionItem
                    icon={Eye}
                    label="Voir template"
                    variant="default"
                    disabled={!hasSelection}
                />
            </ActionGroup>

            <div className="mt-auto pb-4">
                <ActionGroup>
                    <ActionItem icon={Settings} label="Paramètres" variant="default" />
                </ActionGroup>
            </div>
        </div>
    );
};

// Import Workflow View Component
const ImportWorkflowView = ({ 
    template, 
    uploadedFile, 
    handleFileChange, 
    previewData,
    editedData,
    updateCellData,
    validateData,
    validationErrors,
    options, 
    setOptions, 
    handleStartImport, 
    importing, 
    batchStatus, 
    batchLogs,
    resetForm,
    navigate
}: any) => {
    const tabs: TabItem[] = [
        { id: 'upload', label: 'Fichier', icon: Upload },
        { id: 'preview', label: 'Aperçu & Édition', icon: Eye },
        { id: 'config', label: 'Configuration', icon: Settings },
        { id: 'progress', label: 'Progression', icon: RefreshCw },
    ];

    const [activeTab, setActiveTab] = useState('upload');

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {template.name}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            <span>Code: {template.code}</span>
                            <span>Objet: {template.object_name}</span>
                        </div>
                    </div>
                    <div className="text-right">
                        {batchStatus && (
                            <div className="text-sm text-gray-600 mb-1">Progression</div>
                        )}
                        {batchStatus && (
                            <div className="text-3xl font-bold text-blue-600">
                                {batchStatus.progress_percentage}%
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200">
                <SageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'upload' && (
                    <UploadTab 
                        template={template}
                        uploadedFile={uploadedFile}
                        handleFileChange={handleFileChange}
                    />
                )}
                {activeTab === 'preview' && (
                    <PreviewTab 
                        template={template}
                        previewData={previewData}
                        editedData={editedData}
                        updateCellData={updateCellData}
                        validateData={validateData}
                        validationErrors={validationErrors}
                    />
                )}
                {activeTab === 'config' && (
                    <ConfigTab 
                        options={options}
                        setOptions={setOptions}
                    />
                )}
                {activeTab === 'progress' && (
                    <ProgressTab 
                        batchStatus={batchStatus}
                        batchLogs={batchLogs}
                        importing={importing}
                    />
                )}
            </div>
        </div>
    );
};

// Upload Tab
const UploadTab = ({ template, uploadedFile, handleFileChange }: any) => {
    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Sélection du Fichier</h3>
                </div>
                <div className="p-6">
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                        <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                        <label className="cursor-pointer">
                            <span className="text-blue-600 hover:text-blue-700 font-medium">
                                Cliquez pour sélectionner un fichier
                            </span>
                            <input
                                type="file"
                                accept=".csv,.xlsx,.xls"
                                onChange={handleFileChange}
                                className="hidden"
                            />
                        </label>
                        <p className="text-sm text-gray-500 mt-2">
                            CSV, XLSX ou XLS (max 20MB)
                        </p>
                        {uploadedFile && (
                            <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                                <p className="text-sm font-medium text-green-900">
                                    {uploadedFile.name}
                                </p>
                                <p className="text-xs text-green-700 mt-1">
                                    {(uploadedFile.size / 1024 / 1024).toFixed(2)} MB
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Champs du Template</h3>
                    <p className="text-xs text-gray-600 mt-1">
                        {template.fields?.length || 0} champs configurés
                    </p>
                </div>
                <div style={{ height: '400px' }}>
                    <DataGrid
                        rowData={template.fields || []}
                        columnDefs={[
                            {
                                field: 'sequence',
                                headerName: '#',
                                width: 60,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-gray-600 font-medium">{params.value}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'field_name',
                                headerName: 'Champ',
                                width: 150,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="font-medium text-gray-900">{params.value}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'label',
                                headerName: 'Intitulé',
                                width: 180,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-gray-900">{params.value}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'data_type',
                                headerName: 'Type',
                                width: 100,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                                            {params.value}
                                        </span>
                                    </div>
                                )
                            },
                            {
                                field: 'is_required',
                                headerName: 'Requis',
                                width: 90,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        {params.value ? (
                                            <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded font-medium">Oui</span>
                                        ) : (
                                            <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">Non</span>
                                        )}
                                    </div>
                                )
                            },
                            {
                                field: 'input_output',
                                headerName: 'I/O',
                                width: 80,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-xs text-gray-600">{params.value}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'max_length',
                                headerName: 'Long. Max',
                                width: 100,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-gray-600">{params.value || '-'}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'default_value',
                                headerName: 'Valeur par défaut',
                                width: 140,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        <span className="text-gray-600">{params.value || '-'}</span>
                                    </div>
                                )
                            },
                            {
                                field: 'validation_rule',
                                headerName: 'Règle de validation',
                                width: 150,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        {params.value ? (
                                            <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                                                {params.value}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </div>
                                )
                            },
                            {
                                field: 'transformation',
                                headerName: 'Transformation',
                                width: 130,
                                cellRenderer: (params: any) => (
                                    <div className="flex items-center h-full">
                                        {params.value ? (
                                            <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded">
                                                {params.value}
                                            </span>
                                        ) : (
                                            <span className="text-gray-400">-</span>
                                        )}
                                    </div>
                                )
                            }
                        ]}
                    />
                </div>
            </div>
        </div>
    );
};

// Preview Tab - Editable DataGrid
const PreviewTab = ({ template, previewData, editedData, updateCellData, validateData, validationErrors }: any) => {
    if (!previewData || previewData.length === 0) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucune donnée à prévisualiser</p>
                <p className="text-sm text-gray-500 mt-2">
                    Téléchargez un fichier dans l'onglet Fichier pour voir les données
                </p>
            </div>
        );
    }

    // Generate column definitions from data
    const headers = Object.keys(editedData[0] || {}).filter(k => k !== '_rowId');
    const templateFields = template.fields || [];
    
    const colDefs: ColDef[] = headers.map(header => {
        const field = templateFields.find((f: any) => f.field_name === header);
        const isRequired = field?.is_required || false;

        return {
            field: header,
            headerName: field?.display_name || header,
            editable: true,
            width: 150,
            cellClass: (params: any) => {
                const rowIndex = params.node.rowIndex;
                const hasError = validationErrors[rowIndex]?.[header];
                return hasError ? 'bg-red-50 border-red-300' : '';
            },
            cellRenderer: (params: any) => {
                const rowIndex = params.node.rowIndex;
                const hasError = validationErrors[rowIndex]?.[params.colDef.field];
                
                return (
                    <div className="flex items-center h-full relative group">
                        <span className={hasError ? 'text-red-700' : ''}>
                            {params.value || ''}
                        </span>
                        {isRequired && !params.value && (
                            <span className="ml-1 text-red-500">*</span>
                        )}
                        {hasError && (
                            <div className="absolute left-0 bottom-full mb-1 hidden group-hover:block z-50 bg-red-900 text-white text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap">
                                {hasError}
                            </div>
                        )}
                    </div>
                );
            },
            valueSetter: (params: any) => {
                const rowIndex = params.node.rowIndex;
                updateCellData(rowIndex, params.colDef.field, params.newValue);
                return true;
            }
        };
    });

    // Add row number column
    const allColDefs: ColDef[] = [
        {
            headerName: '#',
            valueGetter: (params: any) => params.node.rowIndex + 1,
            width: 60,
            pinned: 'left',
            cellClass: 'bg-gray-50 font-medium text-gray-600'
        },
        ...colDefs
    ];

    const errorCount = Object.keys(validationErrors).length;

    return (
        <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-semibold text-gray-900">Données Importées</h3>
                        <p className="text-sm text-gray-600 mt-1">
                            {editedData.length} ligne(s) • Double-cliquez sur une cellule pour éditer
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        {errorCount > 0 && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-lg">
                                <AlertTriangle className="w-4 h-4 text-red-600" />
                                <span className="text-sm font-medium text-red-700">
                                    {errorCount} erreur(s)
                                </span>
                            </div>
                        )}
                        <button
                            onClick={validateData}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <CheckCircle className="w-4 h-4" />
                            Valider les données
                        </button>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <DataGrid
                    rowData={editedData}
                    columnDefs={allColDefs}
                />
            </div>

            {templateFields.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <h4 className="font-semibold text-blue-900 mb-2">Champs Requis</h4>
                    <div className="flex flex-wrap gap-2">
                        {templateFields
                            .filter((f: any) => f.is_required)
                            .map((f: any) => (
                                <span key={f.id} className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded">
                                    {f.display_name} <span className="text-red-500">*</span>
                                </span>
                            ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// Config Tab
const ConfigTab = ({ options, setOptions }: any) => {
    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Options d'Import</h3>
                </div>
                <div className="p-6 space-y-4">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={options.update_existing}
                            onChange={(e) => setOptions({...options, update_existing: e.target.checked})}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                            <span className="font-medium text-gray-900">Mettre à jour les enregistrements existants</span>
                            <p className="text-sm text-gray-600">Si désactivé, les doublons seront ignorés</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={options.skip_errors}
                            onChange={(e) => setOptions({...options, skip_errors: e.target.checked})}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                            <span className="font-medium text-gray-900">Ignorer les erreurs</span>
                            <p className="text-sm text-gray-600">Continuer l'import même en cas d'erreurs</p>
                        </div>
                    </label>

                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={options.validate_only}
                            onChange={(e) => setOptions({...options, validate_only: e.target.checked})}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <div>
                            <span className="font-medium text-gray-900">Validation uniquement</span>
                            <p className="text-sm text-gray-600">Vérifier les données sans les importer</p>
                        </div>
                    </label>

                    <div>
                        <label className="block text-sm font-medium text-gray-900 mb-2">
                            Taille du lot
                        </label>
                        <input
                            type="number"
                            value={options.batch_size}
                            onChange={(e) => setOptions({...options, batch_size: parseInt(e.target.value)})}
                            min="10"
                            max="1000"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                        <p className="text-sm text-gray-600 mt-1">
                            Nombre d'enregistrements traités par lot
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
};

// Progress Tab
const ProgressTab = ({ batchStatus, batchLogs, importing }: any) => {
    if (!batchStatus) {
        return (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
                <Upload className="w-12 h-12 text-blue-400 mx-auto mb-4" />
                <p className="text-gray-600">Aucun import en cours</p>
                <p className="text-sm text-gray-500 mt-2">
                    Configurez et démarrez l'import pour voir la progression
                </p>
            </div>
        );
    }

    const status = batchStatus.status?.toLowerCase();
    const isCompleted = ['completed', 'done', 'success'].includes(status);
    const isFailed = ['failed', 'error'].includes(status);
    const isProcessing = ['processing', 'running', 'pending', 'queued'].includes(status);

    return (
        <div className="space-y-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3 flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Progression</h3>
                    {isProcessing && (
                        <div className="flex items-center gap-2 text-sm text-blue-600">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>En cours...</span>
                        </div>
                    )}
                </div>
                <div className="p-6">
                    <div className="mb-4">
                        <div className="flex items-center justify-between text-sm mb-2">
                            <span className="text-gray-600">Progression</span>
                            <span className="font-medium text-gray-900">{batchStatus.progress_percentage || 0}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-3">
                            <div
                                className={`h-3 rounded-full transition-all duration-300 ${
                                    isFailed ? 'bg-red-600' : isCompleted ? 'bg-green-600' : 'bg-blue-600'
                                }`}
                                style={{ width: `${batchStatus.progress_percentage || 0}%` }}
                            ></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-4 gap-3">
                        <div className="p-3 bg-gray-50 rounded-lg text-center">
                            <p className="text-xs text-gray-600">Total</p>
                            <p className="text-xl font-bold text-gray-900 mt-1">{batchStatus.total_records || 0}</p>
                        </div>
                        <div className="p-3 bg-green-50 rounded-lg text-center">
                            <p className="text-xs text-green-600">Réussis</p>
                            <p className="text-xl font-bold text-green-700 mt-1">{batchStatus.successful_records || 0}</p>
                        </div>
                        <div className="p-3 bg-red-50 rounded-lg text-center">
                            <p className="text-xs text-red-600">Échoués</p>
                            <p className="text-xl font-bold text-red-700 mt-1">{batchStatus.failed_records || 0}</p>
                        </div>
                        <div className="p-3 bg-yellow-50 rounded-lg text-center">
                            <p className="text-xs text-yellow-600">Ignorés</p>
                            <p className="text-xl font-bold text-yellow-700 mt-1">{batchStatus.skipped_records || 0}</p>
                        </div>
                    </div>

                    {/* Status Messages */}
                    {isCompleted && (
                        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                            <div className="flex items-center gap-2">
                                <CheckCircle className="w-5 h-5 text-green-600" />
                                <p className="font-medium text-green-900">Import terminé avec succès!</p>
                            </div>
                            <p className="text-sm text-green-700 mt-2">
                                {batchStatus.successful_records || 0} enregistrement(s) importé(s)
                            </p>
                        </div>
                    )}

                    {isFailed && (
                        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                                <XCircle className="w-5 h-5 text-red-600" />
                                <p className="font-medium text-red-900">L'import a échoué</p>
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

            {batchLogs.length > 0 && (
                <div className="bg-white border border-gray-200 rounded-lg">
                    <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                        <h3 className="font-semibold text-gray-900">Logs d'Import</h3>
                    </div>
                    <div className="max-h-96 overflow-y-auto">
                        {batchLogs.map((log: BatchLog, index: number) => (
                            <div key={index} className="p-4 border-b border-gray-100 last:border-0">
                                <div className="flex items-start gap-3">
                                    {log.status === 'success' && <CheckCircle className="w-4 h-4 text-green-600 mt-0.5" />}
                                    {log.status === 'failed' && <XCircle className="w-4 h-4 text-red-600 mt-0.5" />}
                                    {log.status === 'warning' && <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />}
                                    <div className="flex-1">
                                        <p className="text-sm font-medium text-gray-900">
                                            Ligne {log.record_number}
                                        </p>
                                        {log.message && (
                                            <p className="text-sm text-gray-600 mt-1">{log.message}</p>
                                        )}
                                        {log.errors && (
                                            <div className="mt-2 text-xs text-red-600">
                                                {Object.entries(log.errors).map(([field, errors]) => (
                                                    <div key={field}>
                                                        <strong>{field}:</strong> {Array.isArray(errors) ? errors.join(', ') : errors}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
