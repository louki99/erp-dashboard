import { useState, useEffect, useMemo } from 'react';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { promotionsApi } from '@/services/api/promotionsApi';
import { masterdataApi, type Partner } from '@/services/api/masterdataApi';
import type { PartnerFamily } from '@/types/promotion.types';
import type { ColDef } from 'ag-grid-community';
import { 
    Users, 
    Plus, 
    RefreshCw, 
    Edit, 
    Trash2, 
    ArrowLeft,
    Save,
    X,
    Search,
    CheckCircle,
    Download,
    Upload,
    Filter,
    TrendingUp,
    Package
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';

export const PartnerFamiliesPage = () => {
    const [families, setFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [familyToDelete, setFamilyToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [showForm, setShowForm] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeTab, setActiveTab] = useState<'info' | 'partners'>('info');
    const [formData, setFormData] = useState<Partial<PartnerFamily>>({
        code: '',
        name: '',
        partner_condition: '',
        partners: []
    });
    const [isSaving, setIsSaving] = useState(false);
    
    // Partner selection modal state
    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [allPartners, setAllPartners] = useState<Partner[]>([]);
    const [loadingPartners, setLoadingPartners] = useState(false);
    const [partnerSearch, setPartnerSearch] = useState('');
    const [creditFilter, setCreditFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');

    const loadFamilies = async () => {
        try {
            setLoading(true);
            const data = await promotionsApi.getPartnerFamilies();
            setFamilies(data.partnerFamilies || []);
        } catch (error) {
            console.error('Failed to load partner families:', error);
            toast.error('Échec du chargement des familles partenaires');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadFamilies();
        loadAllPartners();
    }, []);

    // Keyboard shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            // Ctrl/Cmd + S to save
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && showForm) {
                e.preventDefault();
                handleSave();
            }
            // Escape to cancel/close
            if (e.key === 'Escape') {
                if (showPartnerModal) {
                    setShowPartnerModal(false);
                } else if (showForm) {
                    handleCancel();
                }
            }
            // Ctrl/Cmd + N for new family
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showForm) {
                e.preventDefault();
                handleCreateNew();
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [showForm, showPartnerModal, formData, families]);

    const loadAllPartners = async () => {
        try {
            setLoadingPartners(true);
            const data = await masterdataApi.partners.getAll();
            setAllPartners(data.partner || []);
        } catch (error) {
            console.error('Failed to load partners:', error);
            toast.error('Échec du chargement des partenaires');
        } finally {
            setLoadingPartners(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setFamilyToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!familyToDelete) return;
        
        try {
            setIsDeleting(true);
            await promotionsApi.deletePartnerFamily(familyToDelete);
            toast.success('Famille partenaire supprimée');
            loadFamilies();
            setShowDeleteModal(false);
            setFamilyToDelete(null);
        } catch (error) {
            console.error('Failed to delete partner family:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleCreateNew = () => {
        setFormData({ code: '', name: '', partner_condition: '', partners: [] });
        setIsEditMode(false);
        setActiveTab('info');
        setShowForm(true);
    };

    const handleEdit = (family: PartnerFamily) => {
        // Normalize partners data - API might return objects or strings
        const normalizedFamily = {
            ...family,
            partners: Array.isArray(family.partners) 
                ? family.partners.map(p => typeof p === 'string' ? p : (p as any).partner_code)
                : []
        };
        setFormData(normalizedFamily);
        setIsEditMode(true);
        setActiveTab('info');
        setShowForm(true);
    };

    const handleCancel = () => {
        setShowForm(false);
        setFormData({ code: '', name: '', partner_condition: '', partners: [] });
    };

    const handleTogglePartner = (partnerCode: string) => {
        const currentPartners = formData.partners || [];
        if (currentPartners.includes(partnerCode)) {
            setFormData({
                ...formData,
                partners: currentPartners.filter(c => c !== partnerCode)
            });
        } else {
            setFormData({
                ...formData,
                partners: [...currentPartners, partnerCode]
            });
        }
    };

    const handleSelectAllPartners = () => {
        const allCodes = allPartners
            .filter(p => {
                const search = partnerSearch.toLowerCase();
                const matchesSearch = !partnerSearch || 
                    p.code.toLowerCase().includes(search) ||
                    p.name.toLowerCase().includes(search);
                
                if (!matchesSearch) return false;
                
                if (creditFilter === 'all') return true;
                const credit = parseFloat(p.credit_limit);
                if (creditFilter === 'high') return credit >= 100000;
                if (creditFilter === 'medium') return credit >= 50000 && credit < 100000;
                if (creditFilter === 'low') return credit < 50000;
                return true;
            })
            .map(p => p.code);
        
        setFormData({
            ...formData,
            partners: [...new Set([...(formData.partners || []), ...allCodes])]
        });
    };

    const handleClearAllPartners = () => {
        setFormData({
            ...formData,
            partners: []
        });
    };

    const handleExportFamily = () => {
        if (!formData.code) {
            toast.error('Aucune famille à exporter');
            return;
        }
        const dataStr = JSON.stringify(formData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `famille-${formData.code}.json`;
        link.click();
        URL.revokeObjectURL(url);
        toast.success('Famille exportée');
    };

    const handleSave = async () => {
        // Validation
        if (!formData.code || !formData.name) {
            toast.error('Code et Nom sont obligatoires');
            return;
        }

        if (formData.code.length < 2) {
            toast.error('Le code doit contenir au moins 2 caractères');
            return;
        }

        if (formData.name.length < 3) {
            toast.error('Le nom doit contenir au moins 3 caractères');
            return;
        }

        // Check for duplicate code (only for new families)
        if (!isEditMode && families.some(f => f.code === formData.code)) {
            toast.error('Ce code existe déjà');
            return;
        }

        try {
            setIsSaving(true);
            if (isEditMode && formData.id) {
                await promotionsApi.updatePartnerFamily(formData.id, formData);
                toast.success('Famille mise à jour avec succès');
            } else {
                await promotionsApi.createPartnerFamily(formData);
                toast.success('Famille créée avec succès');
            }
            setShowForm(false);
            setFormData({ code: '', name: '', partner_condition: '', partners: [] });
            loadFamilies();
        } catch (error: any) {
            const errorMsg = error?.response?.data?.message || 'Échec de l\'opération';
            toast.error(errorMsg);
        } finally {
            setIsSaving(false);
        }
    };

    const columnDefs: ColDef<PartnerFamily>[] = useMemo(() => [
        {
            field: 'code',
            headerName: 'Code',
            width: 140,
            cellRenderer: (params: any) => {
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm font-medium text-gray-900">{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            cellRenderer: (params: any) => {
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm text-gray-900">{params.value}</span>
                    </div>
                );
            }
        },
        {
            field: 'created_at',
            headerName: 'Date',
            width: 140,
            cellRenderer: (params: any) => {
                const date = params.value ? new Date(params.value) : new Date();
                return (
                    <div className="flex items-center h-full">
                        <span className="text-sm text-gray-600">
                            {date.toLocaleDateString('fr-FR', { 
                                day: '2-digit', 
                                month: '2-digit', 
                                year: 'numeric' 
                            })}
                        </span>
                    </div>
                );
            }
        },
        {
            headerName: 'Actions',
            width: 100,
            cellRenderer: (params: any) => {
                const family = params.data as PartnerFamily;
                return (
                    <div className="flex items-center justify-center gap-1 h-full">
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleEdit(family);
                            }}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                            title="Modifier"
                        >
                            <Edit className="w-4 h-4" />
                        </button>
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteClick(family.id!);
                            }}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Supprimer"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                );
            },
            sortable: false,
            filter: false,
        },
    ], []);

    const SidebarContent = (
        <div className="flex flex-col h-full bg-white border-r border-gray-200 w-full">
            <div className="p-3 border-b border-gray-200 flex justify-between items-center bg-gray-50/50">
                <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-blue-600" />
                    <h2 className="font-bold text-gray-900">Familles Partenaires</h2>
                </div>
                <div className="text-xs px-2 py-1 bg-blue-100 text-blue-700 rounded-full font-medium">
                    {families.length}
                </div>
            </div>

            <div className="p-3 border-b border-gray-200 bg-gray-50">
                <button
                    onClick={handleCreateNew}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition"
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">Nouvelle Famille</span>
                </button>
            </div>

            <div className="flex-1 w-full overflow-hidden">
                <DataGrid
                    rowData={families}
                    columnDefs={columnDefs}
                    loading={loading}
                />
            </div>
        </div>
    );

    const FormView = (
        <div className="flex flex-col h-full bg-white">
            {/* Header */}
            <div className="p-6 border-b border-gray-200 flex justify-between items-center">
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleCancel}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <ArrowLeft className="w-5 h-5 text-gray-600" />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold text-gray-900">
                            {isEditMode ? 'Modifier la Famille' : 'Nouvelle Famille Partenaire'}
                        </h1>
                        <p className="text-sm text-gray-500 mt-1">
                            {isEditMode ? `Code: ${formData.code}` : 'Créer une nouvelle famille partenaire'}
                        </p>
                        <div className="flex gap-2 mt-2">
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Ctrl+S pour sauvegarder
                            </span>
                            <span className="text-xs px-2 py-1 bg-gray-100 text-gray-600 rounded">
                                Échap pour annuler
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={handleCancel}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition flex items-center gap-2"
                    >
                        <X className="w-4 h-4" />
                        Annuler
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        {isSaving ? 'Enregistrement...' : 'Enregistrer'}
                    </button>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-200">
                <div className="flex gap-4 px-6">
                    <button
                        onClick={() => setActiveTab('info')}
                        className={`py-3 px-4 border-b-2 transition ${
                            activeTab === 'info'
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Informations
                    </button>
                    <button
                        onClick={() => setActiveTab('partners')}
                        className={`py-3 px-4 border-b-2 transition ${
                            activeTab === 'partners'
                                ? 'border-blue-600 text-blue-600 font-medium'
                                : 'border-transparent text-gray-600 hover:text-gray-900'
                        }`}
                    >
                        Partenaires ({formData.partners?.length || 0})
                    </button>
                </div>
            </div>

            {/* Tab Content */}
            <div className="flex-1 overflow-auto p-6">
                {activeTab === 'info' && (
                    <div className="max-w-2xl space-y-6">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <h3 className="text-lg font-semibold text-gray-900 mb-4">Informations Générales</h3>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Code <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.code || ''}
                                        onChange={(e) => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent uppercase"
                                        placeholder="Ex: PREGROS"
                                        maxLength={20}
                                        disabled={isEditMode}
                                        autoFocus
                                    />
                                    {isEditMode && (
                                        <p className="text-xs text-gray-500 mt-1">
                                            Le code ne peut pas être modifié
                                        </p>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Nom <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.name || ''}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                        placeholder="Ex: Clients Gros"
                                        maxLength={100}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        Condition Partenaire
                                    </label>
                                    <textarea
                                        value={formData.partner_condition || ''}
                                        onChange={(e) => setFormData({ ...formData, partner_condition: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
                                        placeholder="Ex: credit_limit > 50000"
                                        rows={2}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Condition SQL pour filtrer automatiquement les partenaires (ex: credit_limit &gt; 50000)
                                    </p>
                                    {formData.partner_condition && (
                                        <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded text-xs">
                                            <span className="font-medium text-blue-700">Condition active:</span>
                                            <code className="ml-2 text-blue-900">{formData.partner_condition}</code>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && (
                    <div className="max-w-4xl">
                        <div className="bg-white rounded-lg border border-gray-200 p-6">
                            <div className="flex justify-between items-center mb-4">
                                <h3 className="text-lg font-semibold text-gray-900">Partenaires</h3>
                                <button 
                                    onClick={() => setShowPartnerModal(true)}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                                >
                                    <Plus className="w-4 h-4" />
                                    Ajouter Partenaires
                                </button>
                            </div>
                            
                            {formData.partners && formData.partners.length > 0 ? (
                                <div>
                                    <div className="mb-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                                        <div className="grid grid-cols-3 gap-3 text-center">
                                            <div>
                                                <div className="text-xs text-gray-600">Partenaires</div>
                                                <div className="text-xl font-bold text-blue-600">{formData.partners.length}</div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">Crédit Total</div>
                                                <div className="text-xl font-bold text-emerald-600">
                                                    {formData.partners.reduce((sum, code) => {
                                                        const p = allPartners.find(partner => partner.code === code);
                                                        return sum + (p ? parseFloat(p.credit_limit) : 0);
                                                    }, 0).toLocaleString()} Dh
                                                </div>
                                            </div>
                                            <div>
                                                <div className="text-xs text-gray-600">Crédit Moyen</div>
                                                <div className="text-xl font-bold text-orange-600">
                                                    {formData.partners.length > 0 ? Math.round(formData.partners.reduce((sum, code) => {
                                                        const p = allPartners.find(partner => partner.code === code);
                                                        return sum + (p ? parseFloat(p.credit_limit) : 0);
                                                    }, 0) / formData.partners.length).toLocaleString() : 0} Dh
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="space-y-2 max-h-96 overflow-y-auto">
                                        {formData.partners.map((partnerCode: string) => {
                                            const partner = allPartners.find(p => p.code === partnerCode);
                                            return (
                                                <div key={partnerCode} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition border border-gray-200">
                                                    <div className="flex-1">
                                                        <p className="font-medium text-gray-900">{partner?.name || partnerCode}</p>
                                                        <p className="text-xs text-gray-500">{partnerCode}</p>
                                                        {partner && (
                                                            <div className="flex items-center gap-3 mt-1">
                                                                <p className="text-xs text-emerald-600 font-medium">
                                                                    💰 Crédit: {parseFloat(partner.credit_limit).toLocaleString()} Dh
                                                                </p>
                                                                {partner.price_list && (
                                                                    <p className="text-xs text-blue-600">
                                                                        📋 {partner.price_list.name}
                                                                    </p>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    <button 
                                                        onClick={() => {
                                                            setFormData({
                                                                ...formData,
                                                                partners: formData.partners?.filter(c => c !== partnerCode)
                                                            });
                                                        }}
                                                        className="p-1.5 text-red-600 hover:bg-red-50 rounded transition"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-gray-400">
                                    <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                                    <p>Aucun partenaire ajouté</p>
                                    <p className="text-sm mt-1">Cliquez sur "Ajouter Partenaires" pour commencer</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );

    const ActionPanel = (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-blue-500 rounded-full opacity-50"></div>
                </div>
                <button
                    onClick={loadFamilies}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                    title="Actualiser"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
                {showForm && isEditMode && (
                    <button
                        onClick={handleExportFamily}
                        className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                        title="Exporter"
                    >
                        <Download className="w-4 h-4" />
                    </button>
                )}
            </div>
        </div>
    );

    const filteredPartners = useMemo(() => {
        let filtered = allPartners;
        
        // Apply search filter
        if (partnerSearch) {
            const search = partnerSearch.toLowerCase();
            filtered = filtered.filter(p => 
                p.code.toLowerCase().includes(search) ||
                p.name.toLowerCase().includes(search)
            );
        }
        
        // Apply credit filter
        if (creditFilter !== 'all') {
            filtered = filtered.filter(p => {
                const credit = parseFloat(p.credit_limit);
                if (creditFilter === 'high') return credit >= 100000;
                if (creditFilter === 'medium') return credit >= 50000 && credit < 100000;
                if (creditFilter === 'low') return credit < 50000;
                return true;
            });
        }
        
        return filtered;
    }, [allPartners, partnerSearch, creditFilter]);

    const PartnerSelectionModal = (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${showPartnerModal ? '' : 'hidden'}`}>
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowPartnerModal(false)} />
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[80vh] flex flex-col">
                {/* Header */}
                <div className="p-6 border-b border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="text-2xl font-bold text-gray-900">Sélectionner des Partenaires</h2>
                        <button
                            onClick={() => setShowPartnerModal(false)}
                            className="p-2 hover:bg-gray-100 rounded-lg transition"
                        >
                            <X className="w-5 h-5 text-gray-600" />
                        </button>
                    </div>
                    {/* Search */}
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={partnerSearch}
                            onChange={(e) => setPartnerSearch(e.target.value)}
                            placeholder="Rechercher par code ou nom..."
                            className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>
                    <div className="mt-3 flex items-center justify-between">
                        <div className="text-sm text-gray-600">
                            {formData.partners?.length || 0} partenaire(s) sélectionné(s)
                        </div>
                        <div className="flex gap-2">
                            <button
                                onClick={handleSelectAllPartners}
                                className="text-xs px-3 py-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition"
                            >
                                Tout sélectionner
                            </button>
                            <button
                                onClick={handleClearAllPartners}
                                className="text-xs px-3 py-1 bg-gray-50 text-gray-600 rounded hover:bg-gray-100 transition"
                            >
                                Tout effacer
                            </button>
                        </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                        <button
                            onClick={() => setCreditFilter('all')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                creditFilter === 'all'
                                    ? 'bg-blue-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Tous
                        </button>
                        <button
                            onClick={() => setCreditFilter('high')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                creditFilter === 'high'
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Crédit &gt; 100K
                        </button>
                        <button
                            onClick={() => setCreditFilter('medium')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                creditFilter === 'medium'
                                    ? 'bg-orange-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            50K - 100K
                        </button>
                        <button
                            onClick={() => setCreditFilter('low')}
                            className={`text-xs px-3 py-1 rounded transition ${
                                creditFilter === 'low'
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                            }`}
                        >
                            Crédit &lt; 50K
                        </button>
                    </div>
                </div>

                {/* Partner List */}
                <div className="flex-1 overflow-y-auto p-6">
                    {loadingPartners ? (
                        <div className="text-center py-12">
                            <RefreshCw className="w-8 h-8 text-blue-600 animate-spin mx-auto mb-3" />
                            <p className="text-gray-400">Chargement des partenaires...</p>
                        </div>
                    ) : filteredPartners.length === 0 ? (
                        <div className="text-center py-12">
                            <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                            <p className="text-gray-400">Aucun partenaire trouvé</p>
                            <p className="text-sm text-gray-400 mt-1">Essayez de modifier vos filtres</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {filteredPartners.map((partner) => {
                                const isSelected = formData.partners?.includes(partner.code);
                                return (
                                    <button
                                        key={partner.code}
                                        onClick={() => handleTogglePartner(partner.code)}
                                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                                            isSelected
                                                ? 'border-blue-500 bg-blue-50'
                                                : 'border-gray-200 hover:border-blue-300 bg-white'
                                        }`}
                                    >
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <p className="font-semibold text-gray-900 truncate">{partner.name}</p>
                                                    {isSelected && <CheckCircle className="w-5 h-5 text-blue-600 shrink-0" />}
                                                </div>
                                                <p className="text-xs text-gray-500 mb-2">{partner.code}</p>
                                                <div className="flex items-center gap-3 text-xs">
                                                    <span className="text-emerald-600 font-medium">
                                                        💰 {parseFloat(partner.credit_limit).toLocaleString()} Dh
                                                    </span>
                                                    {partner.price_list && (
                                                        <span className="text-gray-500">
                                                            📋 {partner.price_list.name}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-gray-200 flex justify-between items-center">
                    <div className="text-sm text-gray-500">
                        {filteredPartners.length} partenaire(s) affiché(s)
                    </div>
                    <button
                        onClick={() => setShowPartnerModal(false)}
                        className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        Terminé
                    </button>
                </div>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {showForm ? FormView : (
                            <div className="h-full flex items-center justify-center text-gray-400">
                                <div className="text-center">
                                    <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                    <p className="font-medium">Sélectionnez une famille</p>
                                    <p className="text-sm mt-2">Cliquez sur "Modifier" ou "Nouvelle Famille" pour commencer</p>
                                </div>
                            </div>
                        )}
                    </div>
                }
                rightContent={ActionPanel}
            />

            {PartnerSelectionModal}

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer la famille"
                description="Êtes-vous sûr de vouloir supprimer cette famille partenaire ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />
        </>
    );
};
