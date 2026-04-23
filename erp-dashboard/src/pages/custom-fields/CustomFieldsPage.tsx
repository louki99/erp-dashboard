import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import {
    Search,
    X,
    Plus,
    Edit2,
    Trash2,
    CheckCircle2,
    Settings,
    FileText,
    RefreshCw,
    ToggleLeft,
    ToggleRight,
    Users,
    Package,
    GripVertical,
    Type,
    Hash,
    Calendar,
    Mail,
    List,
    CheckSquare,
    FileUp,
    AlignLeft,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { SageCollapsible } from '@/components/common/SageCollapsible';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';

import {
    useCustomFieldsList,
    useCustomFieldDetail,
    useCreateCustomField,
    useUpdateCustomField,
    useDeleteCustomField,
    useToggleCustomField,
    useReorderCustomFields,
} from '@/hooks/customFields/useCustomFields';

import type {
    CustomField,
    CustomFieldFilters,
    CreateCustomFieldRequest,
    EntityType,
} from '@/types/customFields.types';

import { ModalCreateEdit, ModalDelete } from './CustomFieldsModals';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const FIELD_TYPE_ICONS: Record<string, React.ElementType> = {
    text: Type,
    textarea: AlignLeft,
    number: Hash,
    email: Mail,
    date: Calendar,
    datetime: Calendar,
    select: List,
    radio: List,
    checkbox: CheckSquare,
    file: FileUp,
};

const FIELD_TYPE_LABELS: Record<string, string> = {
    text: 'Texte',
    textarea: 'Zone de texte',
    number: 'Nombre',
    email: 'Email',
    date: 'Date',
    datetime: 'Date/heure',
    select: 'Liste',
    radio: 'Radio',
    checkbox: 'Checkbox',
    file: 'Fichier',
};

const ENTITY_LABELS: Record<string, string> = {
    partner: 'Partenaire',
    product: 'Produit',
};

const ENTITY_COLORS: Record<string, { bg: string; text: string; border: string }> = {
    partner: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
    product: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
};

// ─── Component ───────────────────────────────────────────────────────────────

export const CustomFieldsPage = () => {
    // ── State ─────────────────────────────────────────────────────────────────
    const [selectedField, setSelectedField] = useState<CustomField | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [activeTab, setActiveTab] = useState('info');

    // Filters
    const [filters, setFilters] = useState<CustomFieldFilters>({
        entity_type: 'all',
        page: 1,
        per_page: 50,
    });

    const [searchQuery, setSearchQuery] = useState('');

    const [openSections, setOpenSections] = useState<Record<string, boolean>>({
        info: true,
        config: true,
    });

    // ── Data Hooks ────────────────────────────────────────────────────────────
    const {
        data: listData,
        loading: listLoading,
        refetch: refetchList,
    } = useCustomFieldsList(filters);

    const {
        data: detailData,
        loading: detailLoading,
        refetch: refetchDetail,
    } = useCustomFieldDetail(selectedField?.id || null);

    const allFields = listData?.customFields?.data || [];

    // Client-side search filter
    const filteredFields = useMemo(() => {
        if (!searchQuery.trim()) return allFields;
        const q = searchQuery.toLowerCase();
        return allFields.filter(f =>
            f.field_label.toLowerCase().includes(q) ||
            f.field_name.toLowerCase().includes(q) ||
            f.field_type.toLowerCase().includes(q)
        );
    }, [allFields, searchQuery]);

    // Use detail data if available
    const fieldDetail = detailData || selectedField;

    // Mutations
    const { execute: createField, loading: createLoading } = useCreateCustomField();
    const { updateCustomField, loading: updateLoading } = useUpdateCustomField();
    const { execute: deleteField, loading: deleteLoading } = useDeleteCustomField();
    const { execute: toggleField } = useToggleCustomField();
    const { execute: reorderFields } = useReorderCustomFields();

    // ── Modal State ───────────────────────────────────────────────────────────
    const [isCreateEditOpen, setCreateEditOpen] = useState(false);
    const [editingField, setEditingField] = useState<CustomField | null>(null);
    const [form, setForm] = useState<Partial<CreateCustomFieldRequest>>({});

    const [isDeleteOpen, setDeleteOpen] = useState(false);

    // ── Handlers ──────────────────────────────────────────────────────────────

    const handleCreate = () => {
        setEditingField(null);
        setForm({
            field_label: '',
            field_type: 'text',
            entity_type: (filters.entity_type !== 'all' ? filters.entity_type : 'partner') as EntityType,
            is_required: false,
            is_active: true,
            is_searchable: false,
            order: allFields.length + 1,
        });
        setCreateEditOpen(true);
    };

    const handleEdit = (cf: CustomField) => {
        setEditingField(cf);
        setForm({
            field_label: cf.field_label,
            field_type: cf.field_type,
            entity_type: cf.entity_type,
            is_required: cf.is_required,
            default_value: cf.default_value || undefined,
            placeholder: cf.placeholder || undefined,
            help_text: cf.help_text || undefined,
            options: cf.options?.join(', ') || cf.options_string || '',
            validation_rules: cf.validation_rules?.join('|') || cf.validation_rules_string || '',
            order: cf.order,
            is_active: cf.is_active,
            is_searchable: cf.is_searchable,
        });
        setCreateEditOpen(true);
    };

    const handleSubmitCreateEdit = async () => {
        if (!form.field_label || !form.field_type || !form.entity_type) {
            toast.error('Veuillez remplir les champs obligatoires');
            return;
        }
        try {
            if (editingField) {
                await updateCustomField({ id: editingField.id, data: form as any });
                toast.success('Champ mis à jour');
            } else {
                await createField(form as any);
                toast.success('Champ créé');
            }
            setCreateEditOpen(false);
            refetchList();
            if (editingField && selectedField?.id === editingField.id) {
                refetchDetail();
            }
        } catch {
            toast.error('Erreur lors de l\'enregistrement');
        }
    };

    const handleDeleteRequest = () => {
        if (!selectedField) return;
        setDeleteOpen(true);
    };

    const handleConfirmDelete = async () => {
        if (!selectedField) return;
        try {
            await deleteField(selectedField.id);
            toast.success('Champ supprimé');
            setDeleteOpen(false);
            setSelectedField(null);
            setShowDetailPanel(false);
            refetchList();
        } catch {
            toast.error('Erreur suppression');
        }
    };

    const handleToggle = async (id: number) => {
        try {
            await toggleField(id);
            toast.success('Statut mis à jour');
            refetchList();
            if (selectedField?.id === id) refetchDetail();
        } catch {
            toast.error('Erreur lors du changement de statut');
        }
    };

    const handleMoveUp = async (cf: CustomField) => {
        const sorted = [...allFields].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(f => f.id === cf.id);
        if (idx <= 0) return;
        const items = sorted.map((f, i) => ({ id: f.id, order: i }));
        // Swap
        const temp = items[idx].order;
        items[idx].order = items[idx - 1].order;
        items[idx - 1].order = temp;
        try {
            await reorderFields({ items });
            toast.success('Ordre mis à jour');
            refetchList();
        } catch {
            toast.error('Erreur réorganisation');
        }
    };

    const handleMoveDown = async (cf: CustomField) => {
        const sorted = [...allFields].sort((a, b) => a.order - b.order);
        const idx = sorted.findIndex(f => f.id === cf.id);
        if (idx >= sorted.length - 1) return;
        const items = sorted.map((f, i) => ({ id: f.id, order: i }));
        const temp = items[idx].order;
        items[idx].order = items[idx + 1].order;
        items[idx + 1].order = temp;
        try {
            await reorderFields({ items });
            toast.success('Ordre mis à jour');
            refetchList();
        } catch {
            toast.error('Erreur réorganisation');
        }
    };

    const handleSearch = (value: string) => {
        setSearchQuery(value);
    };

    const handleSelectField = (row: CustomField) => {
        const style = document.createElement('style');
        style.id = 'loading-cursor-style';
        style.innerHTML = '* { cursor: wait !important; }';
        document.head.appendChild(style);

        setSelectedField(row);
        setShowDetailPanel(true);
        setActiveTab('info');

        setTimeout(() => {
            const el = document.getElementById('loading-cursor-style');
            if (el) el.remove();
        }, 800);
    };

    const handleEntityFilter = (entityType: EntityType | 'all') => {
        setFilters(prev => ({ ...prev, entity_type: entityType, page: 1 }));
    };

    const toggleSection = (section: string, isOpen: boolean) => {
        setOpenSections(prev => ({ ...prev, [section]: isOpen }));
    };

    // ── Columns ───────────────────────────────────────────────────────────────

    const columns = useMemo<ColDef[]>(() => [
        {
            field: 'field_label',
            headerName: 'Libellé',
            flex: 1,
            minWidth: 100,
            cellStyle: { fontWeight: '600' } as any,
        },
        {
            field: 'field_type',
            headerName: 'Type',
            width: 80,
            valueFormatter: (p: any) => FIELD_TYPE_LABELS[p.value] || p.value,
            cellStyle: { color: '#6b7280' } as any,
        },
        {
            field: 'entity_type',
            headerName: 'Entité',
            width: 80,
            valueFormatter: (p: any) => ENTITY_LABELS[p.value] || p.value,
            cellStyle: (p: any) => ({
                color: p.value === 'partner' ? '#7c3aed' : '#0284c7',
                fontWeight: '600',
            }),
        },
        {
            field: 'is_active',
            headerName: 'Actif',
            width: 55,
            cellRenderer: (p: any) => (
                <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); handleToggle(p.data.id); }}
                    className={`flex justify-center items-center w-full ${p.value ? 'text-emerald-500' : 'text-gray-300'}`}
                    title={p.value ? 'Désactiver' : 'Activer'}
                >
                    <CheckCircle2 className={`w-4 h-4 ${!p.value && 'opacity-30'}`} />
                </button>
            ),
            sortable: false,
            filter: false,
        },
    ], [allFields]);

    // ── Action Panel ──────────────────────────────────────────────────────────

    const actionItems: ActionItemProps[] = [
        {
            label: 'Actualiser',
            icon: RefreshCw,
            onClick: () => { refetchList(); if (selectedField) refetchDetail(); },
            variant: 'default',
        },
        {
            label: 'Nouveau champ',
            icon: Plus,
            onClick: handleCreate,
            variant: 'primary',
        },
    ];

    if (selectedField) {
        actionItems.push({
            label: 'Modifier',
            icon: Edit2,
            onClick: () => handleEdit(selectedField),
            variant: 'default',
        });
        actionItems.push({
            label: 'Supprimer',
            icon: Trash2,
            onClick: handleDeleteRequest,
            variant: 'danger',
        });
    }

    const actionGroups = [{ items: actionItems }];

    // ── Tabs ──────────────────────────────────────────────────────────────────

    const tabs: TabItem[] = [
        { id: 'info', label: 'Informations', icon: FileText },
        { id: 'config', label: 'Configuration', icon: Settings },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* Header */}
                        <div className="px-3 pt-3 pb-2.5 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <h1 className="text-sm font-bold text-gray-900 tracking-tight">Champs personnalisés</h1>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-blue-50 text-blue-600">
                                    {filteredFields.length}
                                </span>
                            </div>

                            {/* Entity type filter pills */}
                            <div className="flex items-center gap-1 mb-2">
                                {[
                                    { value: 'all' as const, label: 'Tous', icon: Settings },
                                    { value: 'partner' as const, label: 'Partenaires', icon: Users },
                                    { value: 'product' as const, label: 'Produits', icon: Package },
                                ].map(tab => (
                                    <button
                                        key={tab.value}
                                        onClick={() => handleEntityFilter(tab.value)}
                                        className={`flex items-center gap-1 px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                                            filters.entity_type === tab.value
                                                ? 'bg-blue-600 text-white shadow-sm'
                                                : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        <tab.icon className="w-3 h-3" />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Rechercher..."
                                    value={searchQuery}
                                    onChange={(e) => handleSearch(e.target.value)}
                                    className="w-full pl-8 pr-8 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50"
                                />
                                {searchQuery && (
                                    <button onClick={() => handleSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Grid */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                <DataGrid
                                    rowData={filteredFields}
                                    columnDefs={columns}
                                    loading={listLoading}
                                    rowSelection="single"
                                    onRowDoubleClicked={handleSelectField}
                                />
                            </div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex overflow-hidden">
                        {showDetailPanel && fieldDetail ? (
                            <div className="flex-1 flex flex-col bg-slate-50 min-w-0 overflow-hidden">
                                {/* Detail Header */}
                                <div className="bg-white px-5 py-3.5 border-b border-gray-200 shrink-0">
                                    <div className="flex items-start justify-between">
                                        <div className="flex items-center gap-3.5">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-sm ${
                                                fieldDetail.entity_type === 'partner'
                                                    ? 'bg-gradient-to-br from-violet-500 to-violet-600'
                                                    : 'bg-gradient-to-br from-sky-500 to-sky-600'
                                            } text-white`}>
                                                {(() => {
                                                    const Icon = FIELD_TYPE_ICONS[fieldDetail.field_type] || Type;
                                                    return <Icon className="w-5 h-5" />;
                                                })()}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">{fieldDetail.field_label}</h1>
                                                    <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-md border ${
                                                        ENTITY_COLORS[fieldDetail.entity_type]?.bg || ''
                                                    } ${ENTITY_COLORS[fieldDetail.entity_type]?.text || ''} ${
                                                        ENTITY_COLORS[fieldDetail.entity_type]?.border || ''
                                                    }`}>
                                                        {ENTITY_LABELS[fieldDetail.entity_type] || fieldDetail.entity_type}
                                                    </span>
                                                    {fieldDetail.is_active ? (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-emerald-50 text-emerald-600 border border-emerald-200">Actif</span>
                                                    ) : (
                                                        <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-md bg-gray-100 text-gray-400 border border-gray-200">Inactif</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-3 text-[11px] text-gray-400 mt-0.5">
                                                    <span className="font-mono">{fieldDetail.field_name}</span>
                                                    <span>·</span>
                                                    <span>{FIELD_TYPE_LABELS[fieldDetail.field_type] || fieldDetail.field_type}</span>
                                                    <span>·</span>
                                                    <span>Ordre: {fieldDetail.order}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => handleToggle(fieldDetail.id)}
                                                className={`p-1.5 rounded-lg transition-colors ${fieldDetail.is_active ? 'hover:bg-gray-100 text-emerald-600' : 'hover:bg-emerald-50 text-gray-400'}`}
                                                title={fieldDetail.is_active ? 'Désactiver' : 'Activer'}
                                            >
                                                {fieldDetail.is_active ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                                            </button>
                                            <button onClick={() => handleEdit(fieldDetail)} className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Modifier">
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setShowDetailPanel(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 transition-colors">
                                                <X className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Tabs */}
                                <div className="bg-white border-b border-gray-200">
                                    <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} />
                                </div>

                                {/* Tab Content */}
                                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                                    {activeTab === 'info' && (
                                        <SageCollapsible
                                            title="Informations Générales"
                                            isOpen={openSections.info}
                                            onOpenChange={(open) => toggleSection('info', open)}
                                        >
                                            <div className="space-y-4">
                                                {/* KPI cards */}
                                                <div className="grid grid-cols-4 gap-3">
                                                    {[
                                                        { label: 'Type', value: FIELD_TYPE_LABELS[fieldDetail.field_type] || fieldDetail.field_type, color: 'blue' },
                                                        { label: 'Entité', value: ENTITY_LABELS[fieldDetail.entity_type] || fieldDetail.entity_type, color: fieldDetail.entity_type === 'partner' ? 'purple' : 'sky' },
                                                        { label: 'Ordre', value: fieldDetail.order, color: 'amber' },
                                                        { label: 'Statut', value: fieldDetail.is_active ? 'Actif' : 'Inactif', color: fieldDetail.is_active ? 'emerald' : 'gray' },
                                                    ].map((kpi) => (
                                                        <div key={kpi.label} className="bg-white rounded-lg p-3 border border-gray-100 shadow-sm">
                                                            <div className="text-[11px] uppercase font-medium text-gray-400 mb-1">{kpi.label}</div>
                                                            <div className="text-lg font-bold text-gray-800">{kpi.value}</div>
                                                        </div>
                                                    ))}
                                                </div>

                                                {/* Detail fields */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <div className="grid grid-cols-2 gap-y-4 gap-x-6">
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Libellé</label>
                                                            <div className="text-sm font-semibold text-gray-900">{fieldDetail.field_label}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Nom technique</label>
                                                            <div className="text-sm font-mono text-gray-900">{fieldDetail.field_name}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Placeholder</label>
                                                            <div className="text-sm text-gray-700">{fieldDetail.placeholder || <span className="text-gray-300 italic">Non défini</span>}</div>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Valeur par défaut</label>
                                                            <div className="text-sm text-gray-700">{fieldDetail.default_value || <span className="text-gray-300 italic">Aucune</span>}</div>
                                                        </div>
                                                        <div className="col-span-2">
                                                            <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Texte d'aide</label>
                                                            <div className="text-sm text-gray-700">{fieldDetail.help_text || <span className="text-gray-300 italic">Aucun</span>}</div>
                                                        </div>
                                                        {fieldDetail.created_at && (
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Créé le</label>
                                                                <div className="text-sm text-gray-700">{new Date(fieldDetail.created_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                                            </div>
                                                        )}
                                                        {fieldDetail.updated_at && (
                                                            <div>
                                                                <label className="block text-[11px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Modifié le</label>
                                                                <div className="text-sm text-gray-700">{new Date(fieldDetail.updated_at).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* Flags */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Propriétés</h4>
                                                    <div className="grid grid-cols-3 gap-3">
                                                        {[
                                                            { label: 'Obligatoire', active: fieldDetail.is_required },
                                                            { label: 'Actif', active: fieldDetail.is_active },
                                                            { label: 'Recherchable', active: fieldDetail.is_searchable },
                                                        ].map(flag => (
                                                            <div key={flag.label} className={`flex items-center gap-2 p-2 rounded-lg border ${flag.active ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
                                                                <CheckCircle2 className={`w-4 h-4 ${flag.active ? 'text-emerald-600' : 'text-gray-300'}`} />
                                                                <span className={`text-xs font-medium ${flag.active ? 'text-emerald-700' : 'text-gray-400'}`}>{flag.label}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    )}

                                    {activeTab === 'config' && (
                                        <SageCollapsible
                                            title="Configuration technique"
                                            isOpen={openSections.config}
                                            onOpenChange={(open) => toggleSection('config', open)}
                                        >
                                            <div className="space-y-4">
                                                {/* Options (select/radio) */}
                                                {(fieldDetail.field_type === 'select' || fieldDetail.field_type === 'radio') && (
                                                    <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                        <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Options disponibles</h4>
                                                        {fieldDetail.options && fieldDetail.options.length > 0 ? (
                                                            <div className="flex flex-wrap gap-2">
                                                                {fieldDetail.options.map((opt, idx) => (
                                                                    <span key={idx} className="px-2.5 py-1 text-xs font-medium bg-blue-50 text-blue-700 rounded-lg border border-blue-100">
                                                                        {opt}
                                                                    </span>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <p className="text-xs text-gray-400 italic">Aucune option configurée</p>
                                                        )}
                                                    </div>
                                                )}

                                                {/* Validation rules */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Règles de validation</h4>
                                                    {fieldDetail.validation_rules && fieldDetail.validation_rules.length > 0 ? (
                                                        <div className="flex flex-wrap gap-2">
                                                            {fieldDetail.validation_rules.map((rule, idx) => (
                                                                <span key={idx} className="px-2.5 py-1 text-xs font-mono bg-amber-50 text-amber-700 rounded-lg border border-amber-100">
                                                                    {rule}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    ) : (
                                                        <p className="text-xs text-gray-400 italic">Aucune règle de validation</p>
                                                    )}
                                                </div>

                                                {/* Reorder buttons */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Ordre d'affichage</h4>
                                                    <div className="flex items-center gap-3">
                                                        <div className="flex items-center gap-1.5">
                                                            <GripVertical className="w-4 h-4 text-gray-400" />
                                                            <span className="text-sm font-bold text-gray-900">Position {fieldDetail.order}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleMoveUp(fieldDetail)}
                                                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                                                            >
                                                                ↑ Monter
                                                            </button>
                                                            <button
                                                                onClick={() => handleMoveDown(fieldDetail)}
                                                                className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 text-gray-600 rounded-md transition-colors"
                                                            >
                                                                ↓ Descendre
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Preview */}
                                                <div className="bg-white rounded-lg border border-gray-100 p-4">
                                                    <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Aperçu du champ</h4>
                                                    <div className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                                                        <label className="block text-xs text-gray-500 mb-1 font-medium">
                                                            {fieldDetail.field_label}
                                                            {fieldDetail.is_required && <span className="text-red-500 ml-0.5">*</span>}
                                                        </label>
                                                        {fieldDetail.field_type === 'textarea' ? (
                                                            <textarea
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                placeholder={fieldDetail.placeholder || ''}
                                                                defaultValue={fieldDetail.default_value || ''}
                                                                rows={3}
                                                                disabled
                                                            />
                                                        ) : fieldDetail.field_type === 'select' ? (
                                                            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white" disabled>
                                                                <option>{fieldDetail.placeholder || '-- Sélectionner --'}</option>
                                                                {(fieldDetail.options || []).map((opt, i) => <option key={i}>{opt}</option>)}
                                                            </select>
                                                        ) : fieldDetail.field_type === 'checkbox' ? (
                                                            <label className="flex items-center gap-2">
                                                                <input type="checkbox" disabled className="w-4 h-4 rounded" />
                                                                <span className="text-sm text-gray-700">{fieldDetail.field_label}</span>
                                                            </label>
                                                        ) : fieldDetail.field_type === 'radio' ? (
                                                            <div className="flex items-center gap-3">
                                                                {(fieldDetail.options || []).map((opt, i) => (
                                                                    <label key={i} className="flex items-center gap-1.5">
                                                                        <input type="radio" name="preview" disabled className="w-4 h-4" />
                                                                        <span className="text-sm text-gray-700">{opt}</span>
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        ) : (
                                                            <input
                                                                type={fieldDetail.field_type === 'number' ? 'number' : fieldDetail.field_type === 'email' ? 'email' : fieldDetail.field_type === 'date' ? 'date' : fieldDetail.field_type === 'datetime' ? 'datetime-local' : 'text'}
                                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white"
                                                                placeholder={fieldDetail.placeholder || ''}
                                                                defaultValue={fieldDetail.default_value || ''}
                                                                disabled
                                                            />
                                                        )}
                                                        {fieldDetail.help_text && (
                                                            <p className="text-[11px] text-gray-400 mt-1">{fieldDetail.help_text}</p>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </SageCollapsible>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100 text-gray-400">
                                <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
                                    <Settings className="w-10 h-10 text-gray-200" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-700">Aucun champ sélectionné</h3>
                                <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
                                    Double-cliquez sur un champ personnalisé à gauche pour afficher ses détails et sa configuration.
                                </p>
                            </div>
                        )}
                    </div>
                }
                rightContent={
                    <ActionPanel groups={actionGroups} />
                }
            />

            {/* Modals */}
            {isCreateEditOpen && (
                <ModalCreateEdit
                    editing={editingField}
                    form={form}
                    setForm={setForm}
                    onClose={() => setCreateEditOpen(false)}
                    onSubmit={handleSubmitCreateEdit}
                    loading={createLoading || updateLoading}
                />
            )}

            {isDeleteOpen && selectedField && (
                <ModalDelete
                    field={selectedField}
                    onClose={() => setDeleteOpen(false)}
                    onConfirm={handleConfirmDelete}
                    loading={deleteLoading}
                />
            )}
        </>
    );
};
