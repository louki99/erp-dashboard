import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { 
    ArrowLeft, 
    Save, 
    Copy, 
    CheckCircle,
    FileText,
    Settings,
    Zap,
    Table as TableIcon,
    Plus,
    Trash2,
    Edit,
    RefreshCw,
    X,
    ArrowUp,
    ArrowDown,
    Database,
    Loader2
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template, TemplateField } from '@/types/importExport.types';
import toast from 'react-hot-toast';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import type { ColDef } from 'ag-grid-community';

type TabType = 'general' | 'fields' | 'settings';

export const TemplateDetailPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<TabType>('general');
    const [template, setTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [availableTables, setAvailableTables] = useState<Array<{ id: string; display_name: string; row_count: number; size: string }>>([]);
    const [loadingTables, setLoadingTables] = useState(false);

    useEffect(() => {
        if (id) {
            loadTemplate();
        }
        loadAvailableTables();
    }, [id]);

    const loadAvailableTables = async () => {
        try {
            setLoadingTables(true);
            const data = await importExportApi.metadata.getTables();
            setAvailableTables(data.tables);
        } catch (error) {
            console.error('Failed to load tables:', error);
        } finally {
            setLoadingTables(false);
        }
    };

    const loadTemplate = async () => {
        if (!id) {
            toast.error('ID du template manquant');
            navigate('/import-export/templates');
            return;
        }

        // Handle "new" template creation
        if (id === 'new') {
            setLoading(false);
            setTemplate({
                id: 0,
                code: '',
                name: '',
                type: 'both',
                object_code: '',
                object_name: '',
                primary_table: '',
                module: 'catalog',
                description: '',
                file_type: 'csv',
                field_separator: ';',
                decimal_separator: '.',
                date_format: 'Y-m-d',
                charset: 'UTF-8',
                record_separator: '\\n',
                allow_import: true,
                allow_update: true,
                allow_workflow: false,
                is_special_import: false,
                allow_export: true,
                export_chrono: 0,
                is_active: true,
                is_system: false,
                created_by: null,
                updated_by: null,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                deleted_at: null,
                fields: [],
            } as Template);
            return;
        }

        try {
            setLoading(true);
            // Handle both numeric ID and string code
            const templateId = isNaN(Number(id)) ? id : parseInt(id);
            const data = await importExportApi.templates.getTemplate(templateId);
            setTemplate(data.template);
        } catch (error) {
            console.error('Failed to load template:', error);
            toast.error('Échec du chargement du template');
            navigate('/import-export/templates');
        } finally {
            setLoading(false);
        }
    };

    const handleSave = async () => {
        if (!template) return;
        
        // Validate required fields
        if (!template.code || !template.name || !template.object_code || !template.object_name || !template.primary_table) {
            toast.error('Veuillez remplir tous les champs obligatoires');
            return;
        }
        
        setSaving(true);
        try {
            if (id === 'new' || template.id === 0) {
                // Create new template
                const data = await importExportApi.templates.createTemplate(template);
                toast.success('Template créé avec succès');
                navigate(`/import-export/templates/${data.template.id}`);
            } else {
                // Update existing template
                await importExportApi.templates.updateTemplate(template.id, template);
                toast.success('Template enregistré avec succès');
            }
        } catch (error: any) {
            console.error('Failed to save template:', error);
            toast.error(error?.response?.data?.message || 'Échec de l\'enregistrement');
        } finally {
            setSaving(false);
        }
    };

    const handleValidate = () => {
        toast.success('Template validé');
    };

    const handleCopy = async () => {
        if (!template) return;
        
        const newCode = prompt('Nouveau code du template:', `${template.code}_COPY`);
        const newName = prompt('Nouveau nom du template:', `${template.name} (Copie)`);

        if (!newCode || !newName) return;

        try {
            const data = await importExportApi.templates.duplicateTemplate(template.id, {
                code: newCode,
                name: newName,
            });
            toast.success('Template dupliqué avec succès');
            navigate(`/import-export/templates/${data.template.id}`);
        } catch (error: any) {
            console.error('Failed to duplicate template:', error);
            toast.error(error?.response?.data?.message || 'Échec de la duplication');
        }
    };

    if (loading) {
        return (
            <MasterLayout
                mainContent={
                    <div className="h-full flex items-center justify-center">
                        <div className="text-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
                            <p className="mt-4 text-gray-600">Chargement...</p>
                        </div>
                    </div>
                }
            />
        );
    }

    if (!template) {
        return (
            <MasterLayout
                mainContent={
                    <div className="h-full flex items-center justify-center">
                        <p className="text-gray-600">Template non trouvé</p>
                    </div>
                }
            />
        );
    }

    const tabs: TabItem[] = [
        { id: 'general', label: 'Général', icon: FileText },
        { id: 'fields', label: 'Champs', icon: TableIcon },
        { id: 'settings', label: 'Paramètres', icon: Settings },
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    <div className="p-4 border-b border-gray-200">
                        <button
                            onClick={() => navigate('/import-export/templates')}
                            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 w-full"
                        >
                            <ArrowLeft className="w-4 h-4" />
                            <span className="font-medium">Retour aux templates</span>
                        </button>
                    </div>
                    
                    <div className="flex-1 overflow-auto p-4">
                        <div className="space-y-3">
                            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                                <p className="text-xs font-medium text-blue-600 mb-1">CODE</p>
                                <p className="text-lg font-bold text-blue-900">{template.code || 'Nouveau'}</p>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Nom</p>
                                <p className="font-medium text-gray-900">{template.name || 'Non défini'}</p>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Objet</p>
                                <p className="font-medium text-gray-900">{template.object_name || 'Non défini'}</p>
                                <p className="text-xs text-gray-500 mt-1">{template.object_code || '-'}</p>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Table</p>
                                <div className="flex items-center gap-2">
                                    <Database className="w-4 h-4 text-gray-500" />
                                    <p className="font-mono text-sm text-gray-900">{template.primary_table || 'Non définie'}</p>
                                </div>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Type</p>
                                <span className="inline-block px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                                    {template.type === 'import' ? 'Import' : template.type === 'export' ? 'Export' : 'Import/Export'}
                                </span>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Statut</p>
                                <div className="flex items-center gap-2">
                                    {template.is_active ? (
                                        <>
                                            <CheckCircle className="w-4 h-4 text-green-600" />
                                            <span className="text-sm font-medium text-green-700">Actif</span>
                                        </>
                                    ) : (
                                        <>
                                            <X className="w-4 h-4 text-gray-400" />
                                            <span className="text-sm font-medium text-gray-600">Inactif</span>
                                        </>
                                    )}
                                </div>
                            </div>
                            
                            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                <p className="text-xs font-medium text-gray-600 mb-1">Champs</p>
                                <p className="text-2xl font-bold text-gray-900">{String(template.fields?.length || 0)}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div className="p-4 border-t border-gray-200 space-y-2">
                        <button
                            onClick={loadTemplate}
                            className="w-full px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition flex items-center justify-center gap-2"
                        >
                            <RefreshCw className="w-4 h-4" />
                            Actualiser
                        </button>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
                    {/* Header with Actions */}
                    <div className="bg-white border-b border-gray-200 px-6 py-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900">
                                    {id === 'new' ? 'Nouveau Template' : template.name || 'Template'}
                                </h1>
                                <p className="text-sm text-gray-600 mt-1">
                                    {id === 'new' ? 'Créer un nouveau template' : `Template ${template.code} · ${String(template.fields?.length || 0)} champ(s)`}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handleValidate}
                                    className="px-4 py-2 border border-green-600 text-green-700 rounded-lg hover:bg-green-50 transition flex items-center gap-2"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    Valider
                                </button>
                                <button
                                    onClick={handleCopy}
                                    className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                                >
                                    <Copy className="w-4 h-4" />
                                    Dupliquer
                                </button>
                                <button
                                    onClick={handleSave}
                                    disabled={saving}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                                >
                                    <Save className="w-4 h-4" />
                                    {saving ? 'Enregistrement...' : 'Enregistrer'}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tabs */}
                    <div className="bg-white border-b border-gray-200">
                        <SageTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
                    </div>

                    {/* Tab Content */}
                    <div className="flex-1 overflow-auto p-6">
                        {activeTab === 'general' && <GeneralTab template={template} setTemplate={setTemplate} availableTables={availableTables} loadingTables={loadingTables} />}
                        {activeTab === 'fields' && <FieldsTab template={template} setTemplate={setTemplate} onSave={handleSave} />}
                        {activeTab === 'settings' && <SettingsTab template={template} setTemplate={setTemplate} />}
                    </div>
                </div>
            }
        />
    );
};

// General Tab Component
const GeneralTab = ({ 
    template, 
    setTemplate, 
    availableTables, 
    loadingTables 
}: { 
    template: Template; 
    setTemplate: (t: Template) => void;
    availableTables: Array<{ id: string; display_name: string; row_count: number; size: string }>;
    loadingTables: boolean;
}) => {
    const handleTableChange = (tableId: string) => {
        const selectedTable = availableTables.find(t => t.id === tableId);
        if (selectedTable) {
            const actualTableName = importExportApi.metadata.decodeTableId(tableId);
            setTemplate({ 
                ...template, 
                primary_table: actualTableName,
                object_code: actualTableName,
                object_name: selectedTable.display_name
            });
        }
    };

    return (
        <div className="p-6">
            <div className="bg-white border border-gray-200 rounded-lg">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Général</h3>
                </div>
                <div className="p-6 grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Code du template <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.code}
                            onChange={(e) => setTemplate({ ...template, code: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="ex: PRODUCT_IMPORT"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Nom du template <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.name}
                            onChange={(e) => setTemplate({ ...template, name: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            placeholder="ex: Import des produits"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Module
                        </label>
                        <input
                            type="text"
                            value={template.module}
                            onChange={(e) => setTemplate({ ...template, module: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Code activité
                        </label>
                        <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Table principale (Objet) <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-center gap-2">
                            <Database className="w-5 h-5 text-gray-400" />
                            <select
                                value={availableTables.find(t => importExportApi.metadata.decodeTableId(t.id) === template.primary_table)?.id || ''}
                                onChange={(e) => handleTableChange(e.target.value)}
                                disabled={loadingTables}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                            >
                                <option value="">Sélectionner une table...</option>
                                {availableTables.map((table) => (
                                    <option key={table.id} value={table.id}>
                                        {table.display_name} ({table.row_count} lignes, {table.size})
                                    </option>
                                ))}
                            </select>
                            {loadingTables && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                        </div>
                        {template.primary_table && (
                            <p className="text-xs text-gray-500 mt-1">
                                Objet: {template.object_name || template.primary_table}
                            </p>
                        )}
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Description
                        </label>
                        <textarea
                            value={template.description || ''}
                            onChange={(e) => setTemplate({ ...template, description: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            rows={3}
                            placeholder="Description du template..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Type de template <span className="text-red-500">*</span>
                        </label>
                        <select
                            value={template.type}
                            onChange={(e) => setTemplate({ ...template, type: e.target.value as 'import' | 'export' | 'both' })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="import">Import uniquement</option>
                            <option value="export">Export uniquement</option>
                            <option value="both">Import et Export</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg mt-6">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Export</h3>
                </div>
                <div className="p-6">
                    <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2">
                            <input
                                type="checkbox"
                                checked={template.allow_export}
                                onChange={(e) => setTemplate({ ...template, allow_export: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">Export</span>
                        </label>
                        <span className="text-sm text-gray-500">Chrono export: 0</span>
                    </div>
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg mt-6">
                <div className="border-b border-gray-200 bg-gray-50 px-4 py-3">
                    <h3 className="font-semibold text-gray-900">Import</h3>
                </div>
                <div className="p-6">
                    <label className="flex items-center gap-2">
                        <input
                            type="checkbox"
                            checked={template.allow_import}
                            onChange={(e) => setTemplate({ ...template, allow_import: e.target.checked })}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-700">Import</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

// Fields Tab Component with DataGrid
const FieldsTab = ({ template, setTemplate, onSave }: { template: Template; setTemplate: (t: Template) => void; onSave: () => void }) => {
    const [editingField, setEditingField] = useState<TemplateField | null>(null);
    const [showFieldModal, setShowFieldModal] = useState(false);

    const handleAddField = () => {
        const fieldIndex = template.fields?.length || 0;
        const indicator = String.fromCharCode(65 + fieldIndex); // A, B, C...
        
        const newField: TemplateField = {
            id: Date.now(),
            template_id: template.id,
            level: 0,
            sequence: fieldIndex,
            indicator: indicator,
            table_name: template.primary_table || '',
            field_name: '',
            label: '',
            link: null,
            data_type: 'string',
            input_output: 'both',
            is_required: false,
            is_identifier: false,
            is_readonly: false,
            validation_rule: null,
            default_value: null,
            max_length: null,
            format: null,
            transformation: null,
            value_mapping: null,
            is_visible: true,
            help_text: null,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            column_index: fieldIndex,
            display_name: '',
            field_type: 'string',
            source_table: template.primary_table,
            source_column: ''
        };
        setEditingField(newField);
        setShowFieldModal(true);
    };

    const handleEditField = (field: TemplateField) => {
        setEditingField(field);
        setShowFieldModal(true);
    };

    const handleDeleteField = (fieldId: number) => {
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce champ ?')) return;
        
        const updatedFields = template.fields?.filter(f => f.id !== fieldId) || [];
        setTemplate({ ...template, fields: updatedFields });
        toast.success('Champ supprimé');
    };

    const handleSaveField = () => {
        if (!editingField) return;

        if (!editingField.field_name || !editingField.display_name) {
            toast.error('Le nom du champ et l\'intitulé sont requis');
            return;
        }

        // Ensure all required backend fields are set
        const fieldToSave: TemplateField = {
            ...editingField,
            label: editingField.display_name || editingField.label,
            table_name: editingField.source_table || editingField.table_name || template.primary_table || '',
            data_type: (editingField.field_type || editingField.data_type) as any,
            updated_at: new Date().toISOString()
        };

        const existingFieldIndex = template.fields?.findIndex(f => f.id === editingField.id) ?? -1;
        
        if (existingFieldIndex >= 0) {
            const updatedFields = [...(template.fields || [])];
            updatedFields[existingFieldIndex] = fieldToSave;
            setTemplate({ ...template, fields: updatedFields });
            toast.success('Champ mis à jour');
        } else {
            setTemplate({
                ...template,
                fields: [...(template.fields || []), fieldToSave]
            });
            toast.success('Champ ajouté');
        }

        setShowFieldModal(false);
        setEditingField(null);
    };

    const handleMoveField = (index: number, direction: 'up' | 'down') => {
        const fields = [...(template.fields || [])];
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === fields.length - 1) return;

        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [fields[index], fields[targetIndex]] = [fields[targetIndex], fields[index]];
        
        // Update sequence, column_index, and indicator for all fields
        fields.forEach((field, i) => {
            field.sequence = i;
            field.column_index = i;
            field.indicator = String.fromCharCode(65 + i); // A, B, C...
        });
        
        setTemplate({ ...template, fields });
    };

    const fieldColDefs: ColDef<TemplateField>[] = useMemo(() => [
        {
            field: 'column_index',
            headerName: '#',
            width: 60,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600 font-medium">{(params.value ?? 0) + 1}</span>
                </div>
            ),
        },
        {
            field: 'field_name',
            headerName: 'Nom du champ',
            width: 150,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'display_name',
            headerName: 'Intitulé',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'field_type',
            headerName: 'Type',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                        {params.value}
                    </span>
                </div>
            ),
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
            ),
        },
        {
            field: 'is_identifier',
            headerName: 'Identifiant',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {params.value ? (
                        <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">Oui</span>
                    ) : (
                        <span className="text-xs text-gray-400">-</span>
                    )}
                </div>
            ),
        },
        {
            headerName: 'Actions',
            width: 150,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const index = template.fields?.findIndex(f => f.id === params.data.id) ?? -1;
                            handleMoveField(index, 'up');
                        }}
                        disabled={params.data.column_index === 0}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                        <ArrowUp className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const index = template.fields?.findIndex(f => f.id === params.data.id) ?? -1;
                            handleMoveField(index, 'down');
                        }}
                        disabled={params.data.column_index === (template.fields?.length || 0) - 1}
                        className="p-1 text-gray-600 hover:bg-gray-200 rounded disabled:opacity-30"
                    >
                        <ArrowDown className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleEditField(params.data);
                        }}
                        className="p-1 text-blue-600 hover:bg-blue-100 rounded"
                    >
                        <Edit className="w-4 h-4" />
                    </button>
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteField(params.data.id);
                        }}
                        className="p-1 text-red-600 hover:bg-red-100 rounded"
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                </div>
            ),
        },
    ], [template.fields]);

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <div>
                    <h3 className="text-lg font-semibold text-gray-900">Champs du template</h3>
                    <p className="text-sm text-gray-600 mt-1">
                        {String(template.fields?.length || 0)} champ(s) configuré(s)
                    </p>
                </div>
                <button
                    onClick={handleAddField}
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                >
                    <Plus className="w-4 h-4" />
                    Ajouter un champ
                </button>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: '600px' }}>
                <DataGrid
                    rowData={template.fields || []}
                    columnDefs={fieldColDefs}
                />
            </div>

            {/* Field Edit Modal */}
            {showFieldModal && editingField && (
                <FieldEditModal
                    field={editingField}
                    onUpdate={setEditingField}
                    onSave={handleSaveField}
                    onCancel={() => {
                        setShowFieldModal(false);
                        setEditingField(null);
                    }}
                />
            )}
        </div>
    );
};

// Field Edit Modal
const FieldEditModal = ({
    field,
    onUpdate,
    onSave,
    onCancel
}: {
    field: TemplateField;
    onUpdate: (field: TemplateField) => void;
    onSave: () => void;
    onCancel: () => void;
}) => {
    const [availableTables, setAvailableTables] = useState<Array<{ id: string; display_name: string }>>([]);
    const [availableColumns, setAvailableColumns] = useState<Array<{ 
        name: string; 
        type: string; 
        laravel_type: string; 
        nullable: boolean;
        max_length: number | null;
        is_primary_key: boolean;
        is_unique: boolean;
        default: string | null;
    }>>([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [loadingColumns, setLoadingColumns] = useState(false);
    const [selectedTableId, setSelectedTableId] = useState<string>('');

    useEffect(() => {
        loadTables();
    }, []);

    useEffect(() => {
        if (field.source_table || field.table_name) {
            const tableName = field.source_table || field.table_name;
            const table = availableTables.find(t => importExportApi.metadata.decodeTableId(t.id) === tableName);
            if (table) {
                setSelectedTableId(table.id);
                loadColumns(table.id);
            }
        }
    }, [field.source_table, field.table_name, availableTables]);

    const loadTables = async () => {
        try {
            setLoadingTables(true);
            const data = await importExportApi.metadata.getTables();
            setAvailableTables(data.tables);
        } catch (error) {
            console.error('Failed to load tables:', error);
        } finally {
            setLoadingTables(false);
        }
    };

    const loadColumns = async (tableId: string) => {
        if (!tableId) return;
        try {
            setLoadingColumns(true);
            const data = await importExportApi.metadata.getTableColumns(tableId);
            setAvailableColumns(data.columns);
        } catch (error) {
            console.error('Failed to load columns:', error);
            toast.error('Échec du chargement des colonnes');
        } finally {
            setLoadingColumns(false);
        }
    };

    const handleTableChange = (tableId: string) => {
        setSelectedTableId(tableId);
        const selectedTable = availableTables.find(t => t.id === tableId);
        if (selectedTable) {
            const actualTableName = importExportApi.metadata.decodeTableId(tableId);
            onUpdate({ 
                ...field, 
                source_table: actualTableName, 
                table_name: actualTableName, 
                source_column: '',
                field_name: ''
            });
            loadColumns(tableId);
        }
    };

    const handleColumnSelect = (columnName: string) => {
        const column = availableColumns.find(c => c.name === columnName);
        if (column) {
            const displayName = field.display_name || 
                columnName.split('_').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
            
            // Map Laravel types to valid data_type enum values
            const dataTypeMap: Record<string, 'string' | 'integer' | 'decimal' | 'boolean' | 'date' | 'datetime' | 'text'> = {
                'string': 'string',
                'bigInteger': 'integer',
                'integer': 'integer',
                'decimal': 'decimal',
                'float': 'decimal',
                'double': 'decimal',
                'boolean': 'boolean',
                'date': 'date',
                'datetime': 'datetime',
                'timestamp': 'datetime',
                'text': 'text',
                'longText': 'text'
            };
            
            const mappedDataType = dataTypeMap[column.laravel_type] || 'string';
            
            onUpdate({ 
                ...field, 
                field_name: columnName,
                source_column: columnName,
                display_name: displayName,
                label: displayName,
                field_type: mappedDataType,
                data_type: mappedDataType,
                is_required: !column.nullable,
                is_identifier: column.is_unique || column.is_primary_key,
                max_length: column.max_length,
                default_value: column.default
            });
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-900">
                        {field.id > 1000000 ? 'Nouveau champ' : 'Modifier le champ'}
                    </h2>
                    <button
                        onClick={onCancel}
                        className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Table source <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <Database className="w-4 h-4 text-gray-400" />
                                <select
                                    value={selectedTableId}
                                    onChange={(e) => handleTableChange(e.target.value)}
                                    disabled={loadingTables}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                                >
                                    <option value="">Sélectionner une table...</option>
                                    {availableTables.map((table) => (
                                        <option key={table.id} value={table.id}>
                                            {table.display_name}
                                        </option>
                                    ))}
                                </select>
                                {loadingTables && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                            </div>
                            {field.source_table && (
                                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded">
                                    <p className="text-xs text-blue-700">
                                        <span className="font-semibold">Table réelle:</span> {field.source_table}
                                    </p>
                                    {availableColumns.length > 0 && (
                                        <p className="text-xs text-blue-600 mt-1">
                                            {availableColumns.length} colonnes disponibles
                                        </p>
                                    )}
                                </div>
                            )}
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Colonne (Nom du champ) <span className="text-red-500">*</span>
                            </label>
                            <div className="flex items-center gap-2">
                                <select
                                    value={field.field_name}
                                    onChange={(e) => handleColumnSelect(e.target.value)}
                                    disabled={loadingColumns || !field.source_table}
                                    className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                                >
                                    <option value="">Sélectionner une colonne...</option>
                                    {availableColumns.map((column) => {
                                        const metadata = [];
                                        if (column.is_primary_key) metadata.push('PK');
                                        if (column.is_unique) metadata.push('UNIQUE');
                                        if (!column.nullable) metadata.push('REQUIRED');
                                        if (column.max_length) metadata.push(`max:${column.max_length}`);
                                        
                                        const metaStr = metadata.length > 0 ? ` [${metadata.join(', ')}]` : '';
                                        
                                        return (
                                            <option key={column.name} value={column.name}>
                                                {column.name} ({column.laravel_type}){metaStr}
                                            </option>
                                        );
                                    })}
                                </select>
                                {loadingColumns && <Loader2 className="w-4 h-4 animate-spin text-blue-600" />}
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                                Ou saisissez manuellement:
                            </p>
                            <input
                                type="text"
                                value={field.field_name}
                                onChange={(e) => onUpdate({ ...field, field_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 mt-1"
                                placeholder="ex: code, name, email"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Indicateur (Colonne Excel) <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={field.indicator}
                                onChange={(e) => onUpdate({ ...field, indicator: e.target.value.toUpperCase() })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="ex: A, B, C"
                                maxLength={5}
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Lettre de colonne Excel (auto-généré mais modifiable)
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Intitulé <span className="text-red-500">*</span>
                            </label>
                            <input
                                type="text"
                                value={field.display_name}
                                onChange={(e) => onUpdate({ ...field, display_name: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                                placeholder="ex: Code produit"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Type de données
                            </label>
                            <select
                                value={field.field_type || field.data_type}
                                onChange={(e) => onUpdate({ ...field, field_type: e.target.value, data_type: e.target.value as any })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="string">String</option>
                                <option value="integer">Integer</option>
                                <option value="decimal">Decimal</option>
                                <option value="boolean">Boolean</option>
                                <option value="date">Date</option>
                                <option value="datetime">DateTime</option>
                                <option value="text">Text</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                Valeur par défaut
                            </label>
                            <input
                                type="text"
                                value={field.default_value || ''}
                                onChange={(e) => onUpdate({ ...field, default_value: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                            />
                        </div>
                    </div>

                    <div className="space-y-3 pt-4 border-t border-gray-200">
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={field.is_required}
                                onChange={(e) => onUpdate({ ...field, is_required: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-900">Champ requis</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={field.is_identifier}
                                onChange={(e) => onUpdate({ ...field, is_identifier: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-900">Champ identifiant (clé)</span>
                        </label>
                        <label className="flex items-center gap-3">
                            <input
                                type="checkbox"
                                checked={field.is_visible}
                                onChange={(e) => onUpdate({ ...field, is_visible: e.target.checked })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-900">Champ visible</span>
                        </label>
                    </div>
                </div>

                <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition"
                    >
                        Annuler
                    </button>
                    <button
                        onClick={onSave}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Enregistrer
                    </button>
                </div>
            </div>
        </div>
    );
};

// Settings Tab Component
const SettingsTab = ({ template, setTemplate }: { template: Template; setTemplate: (t: Template) => void }) => {
    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Format de fichier</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type de fichier
                        </label>
                        <select
                            value={template.file_type || 'csv'}
                            onChange={(e) => setTemplate({ ...template, file_type: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="csv">CSV</option>
                            <option value="xlsx">Excel (XLSX)</option>
                            <option value="xls">Excel (XLS)</option>
                            <option value="txt">Text</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Séparateur de champs
                        </label>
                        <input
                            type="text"
                            value={template.field_separator || ';'}
                            onChange={(e) => setTemplate({ ...template, field_separator: e.target.value })}
                            maxLength={1}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Séparateur décimal
                        </label>
                        <input
                            type="text"
                            value={template.decimal_separator || '.'}
                            onChange={(e) => setTemplate({ ...template, decimal_separator: e.target.value })}
                            maxLength={1}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Format de date
                        </label>
                        <input
                            type="text"
                            value={template.date_format || 'Y-m-d'}
                            onChange={(e) => setTemplate({ ...template, date_format: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Encodage
                        </label>
                        <select
                            value={template.charset || 'UTF-8'}
                            onChange={(e) => setTemplate({ ...template, charset: e.target.value })}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                        >
                            <option value="UTF-8">UTF-8</option>
                            <option value="ISO-8859-1">ISO-8859-1</option>
                            <option value="Windows-1252">Windows-1252</option>
                        </select>
                    </div>
                </div>
            </div>
        </div>
    );
};
