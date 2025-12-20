import { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import {
    Plus,
    Edit,
    Trash2,
    Copy,
    Database,
    Table2,
    RefreshCw,
    Save,
    X,
    ChevronRight,
    Settings,
    FileText,
    BarChart3,
    CheckCircle,
    AlertTriangle,
    ArrowUp,
    ArrowDown,
    Eye,
    EyeOff,
    Loader2
} from 'lucide-react';
import { importExportApi } from '@/services/api/importExportApi';
import type { Template } from '@/types/importExport.types';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import type { ColDef } from 'ag-grid-community';

interface DatabaseTable {
    name: string;
    type: string;
    row_count: number;
    size: string;
    has_timestamps: boolean;
}

interface TableColumn {
    name: string;
    type: string;
    laravel_type: string;
    max_length: number | null;
    nullable: boolean;
    default: string | null;
    is_primary_key: boolean;
    is_foreign_key: boolean;
    foreign_key: {
        references_table: string;
        references_column: string;
    } | null;
    is_unique: boolean;
}

interface TemplateField {
    id?: number;
    indicator: string;
    table_name: string;
    field_name: string;
    label: string;
    sequence: number;
    level: number;
    data_type: string;
    input_output: 'input' | 'output' | 'both';
    is_required: boolean;
    is_identifier: boolean;
    is_readonly: boolean;
    validation_rule: string | null;
    default_value: string | null;
    max_length: number | null;
    format: string | null;
    transformation: string | null;
    value_mapping: any;
    is_visible: boolean;
    help_text: string | null;
}

export const TemplateEditorPage = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<Template[]>([]);
    const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    
    // Database introspection
    const [databaseTables, setDatabaseTables] = useState<DatabaseTable[]>([]);
    const [selectedTable, setSelectedTable] = useState<string | null>(null);
    const [tableColumns, setTableColumns] = useState<TableColumn[]>([]);
    const [loadingTables, setLoadingTables] = useState(false);
    const [loadingColumns, setLoadingColumns] = useState(false);
    
    // Template editing
    const [editMode, setEditMode] = useState<'view' | 'edit' | 'create'>('view');
    const [editedTemplate, setEditedTemplate] = useState<Partial<Template> | null>(null);
    const [editedFields, setEditedFields] = useState<TemplateField[]>([]);
    
    // UI state
    const [showDatabaseBrowser, setShowDatabaseBrowser] = useState(false);

    useEffect(() => {
        loadTemplates();
    }, []);

    const loadTemplates = async () => {
        try {
            setLoading(true);
            const data = await importExportApi.templates.getTemplates();
            setTemplates(data.templates);
        } catch (error) {
            console.error('Failed to load templates:', error);
            toast.error('Échec du chargement des templates');
        } finally {
            setLoading(false);
        }
    };

    const loadDatabaseTables = async () => {
        try {
            setLoadingTables(true);
            const data = await importExportApi.metadata.getTables();
            setDatabaseTables(data.tables);
            setShowDatabaseBrowser(true);
        } catch (error) {
            console.error('Failed to load database tables:', error);
            toast.error('Échec du chargement des tables');
        } finally {
            setLoadingTables(false);
        }
    };

    const loadTableColumns = async (tableName: string) => {
        try {
            setLoadingColumns(true);
            setSelectedTable(tableName);
            const data = await importExportApi.metadata.getTableColumns(tableName);
            setTableColumns(data.columns);
        } catch (error) {
            console.error('Failed to load table columns:', error);
            toast.error('Échec du chargement des colonnes');
        } finally {
            setLoadingColumns(false);
        }
    };

    const handleSelectTemplate = async (template: Template) => {
        try {
            const data = await importExportApi.templates.getTemplate(template.id);
            setSelectedTemplate(data.template);
            setEditedTemplate(data.template);
            setEditedFields(data.template.fields || []);
            setEditMode('view');
        } catch (error) {
            console.error('Failed to load template details:', error);
            toast.error('Échec du chargement du template');
        }
    };

    const handleCreateNew = () => {
        setSelectedTemplate(null);
        setEditedTemplate({
            code: '',
            name: '',
            type: 'both',
            object_code: '',
            object_name: '',
            primary_table: '',
            module: 'catalog',
            file_type: 'csv',
            field_separator: ';',
            decimal_separator: '.',
            date_format: 'Y-m-d',
            charset: 'UTF-8',
            allow_import: true,
            allow_export: true,
            is_active: true,
        });
        setEditedFields([]);
        setEditMode('create');
    };

    const handleEdit = () => {
        setEditMode('edit');
    };

    const handleCancel = () => {
        if (selectedTemplate) {
            setEditedTemplate(selectedTemplate);
            setEditedFields(selectedTemplate.fields || []);
            setEditMode('view');
        } else {
            setEditedTemplate(null);
            setEditedFields([]);
            setEditMode('view');
        }
    };

    const handleSave = async () => {
        if (!editedTemplate) return;

        try {
            setSaving(true);
            
            const templateData = {
                ...editedTemplate,
                fields: editedFields,
            };

            if (editMode === 'create') {
                const data = await importExportApi.templates.createTemplate(templateData);
                toast.success('Template créé avec succès');
                setSelectedTemplate(data.template);
                setEditedTemplate(data.template);
                setEditMode('view');
                loadTemplates();
            } else {
                const data = await importExportApi.templates.updateTemplate(
                    selectedTemplate!.id,
                    templateData
                );
                toast.success('Template mis à jour avec succès');
                setSelectedTemplate(data.template);
                setEditedTemplate(data.template);
                setEditMode('view');
                loadTemplates();
            }
        } catch (error: any) {
            console.error('Failed to save template:', error);
            toast.error(error?.response?.data?.message || 'Échec de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!selectedTemplate) return;
        
        if (!confirm('Êtes-vous sûr de vouloir supprimer ce template ?')) return;

        try {
            await importExportApi.templates.deleteTemplate(selectedTemplate.id);
            toast.success('Template supprimé avec succès');
            setSelectedTemplate(null);
            setEditedTemplate(null);
            setEditedFields([]);
            setEditMode('view');
            loadTemplates();
        } catch (error: any) {
            console.error('Failed to delete template:', error);
            toast.error(error?.response?.data?.message || 'Échec de la suppression');
        }
    };

    const handleDuplicate = async () => {
        if (!selectedTemplate) return;

        const newCode = prompt('Nouveau code du template:', `${selectedTemplate.code}_COPY`);
        const newName = prompt('Nouveau nom du template:', `${selectedTemplate.name} (Copie)`);

        if (!newCode || !newName) return;

        try {
            const data = await importExportApi.templates.duplicateTemplate(selectedTemplate.id, {
                code: newCode,
                name: newName,
            });
            toast.success('Template dupliqué avec succès');
            loadTemplates();
            handleSelectTemplate(data.template);
        } catch (error: any) {
            console.error('Failed to duplicate template:', error);
            toast.error(error?.response?.data?.message || 'Échec de la duplication');
        }
    };

    const handleGenerateFromTable = async (tableName: string) => {
        const code = prompt('Code du template:', `IMP${tableName.toUpperCase()}`);
        const name = prompt('Nom du template:', `${tableName} Import/Export`);

        if (!code || !name) return;

        try {
            const data = await importExportApi.templates.generateFromTable({
                table_name: tableName,
                code,
                name,
            });
            toast.success('Template généré avec succès');
            loadTemplates();
            handleSelectTemplate(data.template);
            setShowDatabaseBrowser(false);
        } catch (error: any) {
            console.error('Failed to generate template:', error);
            toast.error(error?.response?.data?.message || 'Échec de la génération');
        }
    };

    const handleAddField = () => {
        const newField: TemplateField = {
            indicator: String.fromCharCode(65 + editedFields.length),
            table_name: editedTemplate?.primary_table || '',
            field_name: '',
            label: '',
            sequence: editedFields.length,
            level: 1,
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
        };
        setEditedFields([...editedFields, newField]);
    };

    const handleUpdateField = (index: number, field: Partial<TemplateField>) => {
        const newFields = [...editedFields];
        newFields[index] = { ...newFields[index], ...field };
        setEditedFields(newFields);
    };

    const handleDeleteField = (index: number) => {
        const newFields = editedFields.filter((_, i) => i !== index);
        // Resequence
        newFields.forEach((field, i) => {
            field.sequence = i;
        });
        setEditedFields(newFields);
    };

    const handleMoveField = (index: number, direction: 'up' | 'down') => {
        if (direction === 'up' && index === 0) return;
        if (direction === 'down' && index === editedFields.length - 1) return;

        const newFields = [...editedFields];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        [newFields[index], newFields[targetIndex]] = [newFields[targetIndex], newFields[index]];
        
        // Resequence
        newFields.forEach((field, i) => {
            field.sequence = i;
        });
        
        setEditedFields(newFields);
    };

    const handleAddFieldFromColumn = (column: TableColumn) => {
        const newField: TemplateField = {
            indicator: String.fromCharCode(65 + editedFields.length),
            table_name: selectedTable || '',
            field_name: column.name,
            label: column.name.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
            sequence: editedFields.length,
            level: 1,
            data_type: column.laravel_type,
            input_output: 'both',
            is_required: !column.nullable,
            is_identifier: column.is_primary_key || column.is_unique,
            is_readonly: column.is_primary_key,
            validation_rule: null,
            default_value: column.default,
            max_length: column.max_length,
            format: null,
            transformation: null,
            value_mapping: null,
            is_visible: true,
            help_text: null,
        };
        setEditedFields([...editedFields, newField]);
        toast.success(`Champ ${column.name} ajouté`);
    };

    // Template list columns
    const templateColDefs: ColDef<Template>[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 140,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'type',
            headerName: 'Type',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded">
                        {params.value}
                    </span>
                </div>
            ),
        },
        {
            field: 'module',
            headerName: 'Module',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'is_active',
            headerName: 'Statut',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {params.value ? (
                        <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Actif
                        </span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-600 rounded">
                            Inactif
                        </span>
                    )}
                </div>
            ),
        },
    ], []);

    // Database tables columns
    const tableColDefs: ColDef<DatabaseTable>[] = useMemo(() => [
        {
            field: 'name',
            headerName: 'Table',
            flex: 1,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full gap-2">
                    <Table2 className="w-4 h-4 text-blue-600" />
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'row_count',
            headerName: 'Lignes',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600">{params.value.toLocaleString()}</span>
                </div>
            ),
        },
        {
            field: 'size',
            headerName: 'Taille',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-gray-600">{params.value}</span>
                </div>
            ),
        },
        {
            headerName: 'Actions',
            width: 120,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full gap-2">
                    <button
                        onClick={() => loadTableColumns(params.data.name)}
                        className="text-blue-600 hover:text-blue-700 text-xs"
                    >
                        Voir colonnes
                    </button>
                </div>
            ),
        },
    ], []);

    // Table columns grid
    const columnColDefs: ColDef<TableColumn>[] = useMemo(() => [
        {
            field: 'name',
            headerName: 'Colonne',
            width: 150,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="font-medium text-gray-900">{params.value}</span>
                </div>
            ),
        },
        {
            field: 'laravel_type',
            headerName: 'Type',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded">
                        {params.value}
                    </span>
                </div>
            ),
        },
        {
            field: 'nullable',
            headerName: 'Nullable',
            width: 90,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {params.value ? (
                        <span className="text-xs text-gray-600">Oui</span>
                    ) : (
                        <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">Requis</span>
                    )}
                </div>
            ),
        },
        {
            field: 'is_primary_key',
            headerName: 'PK',
            width: 60,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full justify-center">
                    {params.value && <span className="text-xs px-1.5 py-0.5 bg-yellow-100 text-yellow-700 rounded">PK</span>}
                </div>
            ),
        },
        {
            field: 'is_foreign_key',
            headerName: 'FK',
            width: 60,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full justify-center">
                    {params.value && <span className="text-xs px-1.5 py-0.5 bg-green-100 text-green-700 rounded">FK</span>}
                </div>
            ),
        },
        {
            headerName: 'Actions',
            width: 100,
            cellRenderer: (params: any) => (
                <div className="flex items-center h-full">
                    {editMode !== 'view' && (
                        <button
                            onClick={() => handleAddFieldFromColumn(params.data)}
                            className="text-xs px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                        >
                            Ajouter
                        </button>
                    )}
                </div>
            ),
        },
    ], [editMode]);

    // Left Sidebar - Template List
    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-4 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <h2 className="font-bold text-gray-900">Templates</h2>
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {templates.length} template(s)
                </div>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={templates}
                    columnDefs={templateColDefs}
                    loading={loading}
                    onRowSelected={(data) => handleSelectTemplate(data)}
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
                        ) : editedTemplate ? (
                            <TemplateEditorView
                                template={editedTemplate}
                                fields={editedFields}
                                editMode={editMode}
                                saving={saving}
                                onUpdateTemplate={setEditedTemplate}
                                onUpdateField={handleUpdateField}
                                onDeleteField={handleDeleteField}
                                onMoveField={handleMoveField}
                                onAddField={handleAddField}
                                onSave={handleSave}
                                onCancel={handleCancel}
                                showDatabaseBrowser={showDatabaseBrowser}
                                databaseTables={databaseTables}
                                selectedTable={selectedTable}
                                tableColumns={tableColumns}
                                loadingTables={loadingTables}
                                loadingColumns={loadingColumns}
                                onLoadTables={loadDatabaseTables}
                                onLoadColumns={loadTableColumns}
                                onGenerateFromTable={handleGenerateFromTable}
                                onCloseDatabaseBrowser={() => setShowDatabaseBrowser(false)}
                                tableColDefs={tableColDefs}
                                columnColDefs={columnColDefs}
                            />
                        ) : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="font-medium">Sélectionnez un template</p>
                                    <p className="text-sm mt-2">ou créez-en un nouveau</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel
                        onRefresh={loadTemplates}
                        onCreateNew={handleCreateNew}
                        onEdit={handleEdit}
                        onSave={handleSave}
                        onCancel={handleCancel}
                        onDelete={handleDelete}
                        onDuplicate={handleDuplicate}
                        onBrowseDatabase={loadDatabaseTables}
                        hasSelection={!!selectedTemplate}
                        editMode={editMode}
                        saving={saving}
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
    variant?: 'default' | 'primary' | 'success' | 'danger';
    disabled?: boolean;
}

const ActionItem = ({ icon: Icon, label, onClick, variant = 'default', disabled = false }: ActionItemProps) => {
    const variants = {
        default: "text-gray-400 hover:text-gray-700 hover:bg-gray-50",
        primary: "text-gray-400 hover:text-blue-600 hover:bg-blue-50",
        success: "text-gray-400 hover:text-green-600 hover:bg-green-50",
        danger: "text-gray-400 hover:text-red-600 hover:bg-red-50"
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
    onCreateNew: () => void;
    onEdit: () => void;
    onSave: () => void;
    onCancel: () => void;
    onDelete: () => void;
    onDuplicate: () => void;
    onBrowseDatabase: () => void;
    hasSelection: boolean;
    editMode: 'view' | 'edit' | 'create';
    saving: boolean;
    navigate: any;
}

const ActionPanel = ({
    onRefresh,
    onCreateNew,
    onEdit,
    onSave,
    onCancel,
    onDelete,
    onDuplicate,
    onBrowseDatabase,
    hasSelection,
    editMode,
    saving,
}: ActionPanelProps) => {
    return (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40 transition-all duration-300">
            <ActionGroup>
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-blue-500 rounded-full opacity-50"></div>
                </div>
                {editMode === 'view' ? (
                    <>
                        <ActionItem
                            icon={Plus}
                            label="Nouveau Template"
                            variant="success"
                            onClick={onCreateNew}
                        />
                        <ActionItem
                            icon={Edit}
                            label="Modifier"
                            variant="primary"
                            onClick={onEdit}
                            disabled={!hasSelection}
                        />
                        <ActionItem
                            icon={Copy}
                            label="Dupliquer"
                            variant="default"
                            onClick={onDuplicate}
                            disabled={!hasSelection}
                        />
                    </>
                ) : (
                    <>
                        <ActionItem
                            icon={Save}
                            label="Sauvegarder"
                            variant="success"
                            onClick={onSave}
                            disabled={saving}
                        />
                        <ActionItem
                            icon={X}
                            label="Annuler"
                            variant="danger"
                            onClick={onCancel}
                            disabled={saving}
                        />
                    </>
                )}
            </ActionGroup>

            <ActionGroup>
                <ActionItem
                    icon={Database}
                    label="Parcourir BDD"
                    variant="primary"
                    onClick={onBrowseDatabase}
                />
                <ActionItem
                    icon={RefreshCw}
                    label="Actualiser"
                    variant="default"
                    onClick={onRefresh}
                />
            </ActionGroup>

            {editMode === 'view' && hasSelection && (
                <ActionGroup>
                    <ActionItem
                        icon={Trash2}
                        label="Supprimer"
                        variant="danger"
                        onClick={onDelete}
                    />
                </ActionGroup>
            )}

            <div className="mt-auto pb-4">
                <ActionGroup>
                    <ActionItem icon={Settings} label="Paramètres" variant="default" />
                </ActionGroup>
            </div>
        </div>
    );
};

// Template Editor View Component
interface TemplateEditorViewProps {
    template: Partial<Template>;
    fields: TemplateField[];
    editMode: 'view' | 'edit' | 'create';
    saving: boolean;
    onUpdateTemplate: (template: Partial<Template>) => void;
    onUpdateField: (index: number, field: Partial<TemplateField>) => void;
    onDeleteField: (index: number) => void;
    onMoveField: (index: number, direction: 'up' | 'down') => void;
    onAddField: () => void;
    onSave: () => void;
    onCancel: () => void;
    showDatabaseBrowser: boolean;
    databaseTables: DatabaseTable[];
    selectedTable: string | null;
    tableColumns: TableColumn[];
    loadingTables: boolean;
    loadingColumns: boolean;
    onLoadTables: () => void;
    onLoadColumns: (tableName: string) => void;
    onGenerateFromTable: (tableName: string) => void;
    onCloseDatabaseBrowser: () => void;
    tableColDefs: ColDef<DatabaseTable>[];
    columnColDefs: ColDef<TableColumn>[];
}

const TemplateEditorView = ({
    template,
    fields,
    editMode,
    onUpdateTemplate,
    onUpdateField,
    onDeleteField,
    onMoveField,
    onAddField,
    showDatabaseBrowser,
    databaseTables,
    selectedTable,
    tableColumns,
    loadingTables,
    loadingColumns,
    onGenerateFromTable,
    onCloseDatabaseBrowser,
    tableColDefs,
    columnColDefs,
}: TemplateEditorViewProps) => {
    const tabs: TabItem[] = [
        { id: 'general', label: 'Général', icon: FileText },
        { id: 'fields', label: 'Champs', icon: Table2 },
        { id: 'settings', label: 'Paramètres', icon: Settings },
    ];

    const [activeTab, setActiveTab] = useState('general');

    return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 p-6">
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900 mb-1">
                            {editMode === 'create' ? 'Nouveau Template' : template.name}
                        </h1>
                        <div className="flex items-center gap-4 text-sm text-gray-500">
                            {template.code && <span>Code: {template.code}</span>}
                            {template.module && <span>Module: {template.module}</span>}
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {editMode !== 'view' && (
                            <span className="text-xs px-3 py-1.5 bg-yellow-100 text-yellow-700 rounded-full font-medium">
                                Mode édition
                            </span>
                        )}
                        {template.is_system && (
                            <span className="text-xs px-3 py-1.5 bg-purple-100 text-purple-700 rounded-full font-medium">
                                Système
                            </span>
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
                {activeTab === 'general' && (
                    <GeneralTab
                        template={template}
                        editMode={editMode}
                        onUpdate={onUpdateTemplate}
                    />
                )}
                {activeTab === 'fields' && (
                    <FieldsTab
                        fields={fields}
                        editMode={editMode}
                        onUpdateField={onUpdateField}
                        onDeleteField={onDeleteField}
                        onMoveField={onMoveField}
                        onAddField={onAddField}
                    />
                )}
                {activeTab === 'settings' && (
                    <SettingsTab
                        template={template}
                        editMode={editMode}
                        onUpdate={onUpdateTemplate}
                    />
                )}
            </div>

            {/* Database Browser Modal */}
            {showDatabaseBrowser && (
                <DatabaseBrowserModal
                    tables={databaseTables}
                    selectedTable={selectedTable}
                    tableColumns={tableColumns}
                    loadingTables={loadingTables}
                    loadingColumns={loadingColumns}
                    onGenerateFromTable={onGenerateFromTable}
                    onClose={onCloseDatabaseBrowser}
                    tableColDefs={tableColDefs}
                    columnColDefs={columnColDefs}
                />
            )}
        </div>
    );
};

// General Tab
const GeneralTab = ({ template, editMode, onUpdate }: any) => {
    const isReadOnly = editMode === 'view';

    return (
        <div className="space-y-6 max-w-4xl">
            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Informations de base</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Code <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.code || ''}
                            onChange={(e) => onUpdate({ ...template, code: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.name || ''}
                            onChange={(e) => onUpdate({ ...template, name: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Code Objet <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.object_code || ''}
                            onChange={(e) => onUpdate({ ...template, object_code: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Nom Objet <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.object_name || ''}
                            onChange={(e) => onUpdate({ ...template, object_name: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Table Principale <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            value={template.primary_table || ''}
                            onChange={(e) => onUpdate({ ...template, primary_table: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Module
                        </label>
                        <select
                            value={template.module || 'catalog'}
                            onChange={(e) => onUpdate({ ...template, module: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        >
                            <option value="catalog">Catalog</option>
                            <option value="crm">CRM</option>
                            <option value="inventory">Inventory</option>
                            <option value="pricing">Pricing</option>
                            <option value="base">Base</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description
                    </label>
                    <textarea
                        value={template.description || ''}
                        onChange={(e) => onUpdate({ ...template, description: e.target.value })}
                        disabled={isReadOnly}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                    />
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Type et Permissions</h3>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Type
                        </label>
                        <select
                            value={template.type || 'both'}
                            onChange={(e) => onUpdate({ ...template, type: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        >
                            <option value="import">Import</option>
                            <option value="export">Export</option>
                            <option value="both">Import & Export</option>
                        </select>
                    </div>
                </div>
                <div className="mt-4 space-y-3">
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={template.allow_import || false}
                            onChange={(e) => onUpdate({ ...template, allow_import: e.target.checked })}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Autoriser l'import</span>
                    </label>
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={template.allow_export || false}
                            onChange={(e) => onUpdate({ ...template, allow_export: e.target.checked })}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Autoriser l'export</span>
                    </label>
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={template.allow_update || false}
                            onChange={(e) => onUpdate({ ...template, allow_update: e.target.checked })}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Autoriser la mise à jour</span>
                    </label>
                    <label className="flex items-center gap-3">
                        <input
                            type="checkbox"
                            checked={template.is_active || false}
                            onChange={(e) => onUpdate({ ...template, is_active: e.target.checked })}
                            disabled={isReadOnly}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                        />
                        <span className="text-sm font-medium text-gray-900">Template actif</span>
                    </label>
                </div>
            </div>
        </div>
    );
};

// Fields Tab
const FieldsTab = ({ fields, editMode, onUpdateField, onDeleteField, onMoveField, onAddField }: any) => {
    const isReadOnly = editMode === 'view';

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center">
                <h3 className="font-semibold text-gray-900">{fields.length} champ(s)</h3>
                {!isReadOnly && (
                    <button
                        onClick={onAddField}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Ajouter un champ
                    </button>
                )}
            </div>

            <div className="space-y-3">
                {fields.map((field: TemplateField, index: number) => (
                    <div key={index} className="bg-white border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start gap-4">
                            {!isReadOnly && (
                                <div className="flex flex-col gap-1">
                                    <button
                                        onClick={() => onMoveField(index, 'up')}
                                        disabled={index === 0}
                                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    >
                                        <ArrowUp className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => onMoveField(index, 'down')}
                                        disabled={index === fields.length - 1}
                                        className="p-1 text-gray-400 hover:text-gray-700 disabled:opacity-30"
                                    >
                                        <ArrowDown className="w-4 h-4" />
                                    </button>
                                </div>
                            )}
                            
                            <div className="flex-1 grid grid-cols-4 gap-3">
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Indicateur</label>
                                    <input
                                        type="text"
                                        value={field.indicator}
                                        onChange={(e) => onUpdateField(index, { indicator: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Nom du champ</label>
                                    <input
                                        type="text"
                                        value={field.field_name}
                                        onChange={(e) => onUpdateField(index, { field_name: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Intitulé</label>
                                    <input
                                        type="text"
                                        value={field.label}
                                        onChange={(e) => onUpdateField(index, { label: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-50"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">Type</label>
                                    <select
                                        value={field.data_type}
                                        onChange={(e) => onUpdateField(index, { data_type: e.target.value })}
                                        disabled={isReadOnly}
                                        className="w-full px-2 py-1 text-sm border border-gray-300 rounded disabled:bg-gray-50"
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
                                <div className="col-span-4 flex items-center gap-4 mt-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={field.is_required}
                                            onChange={(e) => onUpdateField(index, { is_required: e.target.checked })}
                                            disabled={isReadOnly}
                                            className="w-3 h-3 text-blue-600 border-gray-300 rounded"
                                        />
                                        <span className="text-xs text-gray-700">Requis</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={field.is_identifier}
                                            onChange={(e) => onUpdateField(index, { is_identifier: e.target.checked })}
                                            disabled={isReadOnly}
                                            className="w-3 h-3 text-blue-600 border-gray-300 rounded"
                                        />
                                        <span className="text-xs text-gray-700">Identifiant</span>
                                    </label>
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={field.is_visible}
                                            onChange={(e) => onUpdateField(index, { is_visible: e.target.checked })}
                                            disabled={isReadOnly}
                                            className="w-3 h-3 text-blue-600 border-gray-300 rounded"
                                        />
                                        <span className="text-xs text-gray-700">Visible</span>
                                    </label>
                                </div>
                            </div>

                            {!isReadOnly && (
                                <button
                                    onClick={() => onDeleteField(index)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {fields.length === 0 && (
                <div className="text-center py-12 text-gray-400">
                    <Table2 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Aucun champ défini</p>
                    {!isReadOnly && (
                        <button
                            onClick={onAddField}
                            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                        >
                            Ajouter le premier champ
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

// Settings Tab
const SettingsTab = ({ template, editMode, onUpdate }: any) => {
    const isReadOnly = editMode === 'view';

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
                            onChange={(e) => onUpdate({ ...template, file_type: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
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
                            onChange={(e) => onUpdate({ ...template, field_separator: e.target.value })}
                            disabled={isReadOnly}
                            maxLength={1}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Séparateur décimal
                        </label>
                        <input
                            type="text"
                            value={template.decimal_separator || '.'}
                            onChange={(e) => onUpdate({ ...template, decimal_separator: e.target.value })}
                            disabled={isReadOnly}
                            maxLength={1}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Format de date
                        </label>
                        <input
                            type="text"
                            value={template.date_format || 'Y-m-d'}
                            onChange={(e) => onUpdate({ ...template, date_format: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Encodage
                        </label>
                        <select
                            value={template.charset || 'UTF-8'}
                            onChange={(e) => onUpdate({ ...template, charset: e.target.value })}
                            disabled={isReadOnly}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
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

// Database Browser Modal
const DatabaseBrowserModal = ({
    tables,
    selectedTable,
    tableColumns,
    loadingTables,
    loadingColumns,
    onGenerateFromTable,
    onClose,
    tableColDefs,
    columnColDefs,
}: any) => {
    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] flex flex-col">
                <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">Explorateur de Base de Données</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Sélectionnez une table pour générer un template automatiquement
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="flex-1 overflow-hidden flex">
                    {/* Tables List */}
                    <div className="w-1/2 border-r border-gray-200 flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-gray-50">
                            <h3 className="font-semibold text-gray-900">Tables ({tables.length})</h3>
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {loadingTables ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : (
                                <DataGrid
                                    rowData={tables}
                                    columnDefs={tableColDefs}
                                />
                            )}
                        </div>
                    </div>

                    {/* Table Columns */}
                    <div className="w-1/2 flex flex-col">
                        <div className="p-4 border-b border-gray-200 bg-gray-50 flex justify-between items-center">
                            <h3 className="font-semibold text-gray-900">
                                {selectedTable ? `Colonnes de ${selectedTable}` : 'Sélectionnez une table'}
                            </h3>
                            {selectedTable && (
                                <button
                                    onClick={() => onGenerateFromTable(selectedTable)}
                                    className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Générer Template
                                </button>
                            )}
                        </div>
                        <div className="flex-1 overflow-hidden">
                            {loadingColumns ? (
                                <div className="flex items-center justify-center h-full">
                                    <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
                                </div>
                            ) : selectedTable ? (
                                <DataGrid
                                    rowData={tableColumns}
                                    columnDefs={columnColDefs}
                                />
                            ) : (
                                <div className="flex items-center justify-center h-full text-gray-400">
                                    <div className="text-center">
                                        <Database className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                                        <p>Sélectionnez une table pour voir ses colonnes</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
