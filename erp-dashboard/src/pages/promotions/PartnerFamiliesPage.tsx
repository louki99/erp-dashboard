import { useState, useEffect, useMemo, useCallback } from 'react';
import { promotionsApi } from '@/services/api/promotionsApi';
import { getPartners } from '@/services/api/partnerApi';
import type { Partner } from '@/types/partner.types';
import type { PartnerFamily } from '@/types/promotion.types';
import {
    Users, Plus, RefreshCw, Edit, Trash2, Save, X,
    Search, Loader2, Download, Code,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { MasterLayout } from '@/components/layout/MasterLayout';

const ACCENT = {
    bg: 'bg-violet-600', hbg: 'hover:bg-violet-700',
    light: 'bg-violet-50', border: 'border-violet-200',
    text: 'text-violet-700', ring: 'focus:ring-violet-500 focus:border-violet-500',
    badge: 'bg-violet-100 text-violet-800',
    dot: 'bg-violet-500',
};

const fmt = (n: number) => n.toLocaleString('fr-FR');
// credit_limit arrive tantôt en string (API), tantôt en number (type Partner)
const toCredit = (v: unknown): number => Number(v ?? 0) || 0;
const creditTier = (limit: string | number) => {
    const v = toCredit(limit);
    if (v >= 100000) return { label: '> 100K', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
    if (v >= 50000)  return { label: '50–100K', cls: 'bg-blue-50 text-blue-700 border-blue-200' };
    return { label: '< 50K', cls: 'bg-orange-50 text-orange-700 border-orange-200' };
};

export const PartnerFamiliesPage = () => {
    const [families, setFamilies]       = useState<PartnerFamily[]>([]);
    const [loading, setLoading]         = useState(true);
    const [listSearch, setListSearch]   = useState('');
    const [selected, setSelected]       = useState<PartnerFamily | null>(null);
    const [showForm, setShowForm]       = useState(false);
    const [isEditMode, setIsEditMode]   = useState(false);
    const [activeTab, setActiveTab]     = useState<'info' | 'partners'>('info');
    const [formData, setFormData]       = useState<Partial<PartnerFamily>>({ code: '', name: '', partner_condition: '', partners: [] });
    const [isSaving, setIsSaving]       = useState(false);

    const [showDeleteModal, setShowDeleteModal]   = useState(false);
    const [familyToDelete, setFamilyToDelete]     = useState<number | null>(null);
    const [isDeleting, setIsDeleting]             = useState(false);

    const [showPartnerModal, setShowPartnerModal] = useState(false);
    const [allPartners, setAllPartners]           = useState<Partner[]>([]);
    const [loadingPartners, setLoadingPartners]   = useState(false);
    const [partnerSearch, setPartnerSearch]       = useState('');
    const [creditFilter, setCreditFilter]         = useState<'all' | 'high' | 'medium' | 'low'>('all');

    const loadFamilies = useCallback(async () => {
        setLoading(true);
        try {
            const data = await promotionsApi.getPartnerFamilies();
            setFamilies(data.partnerFamilies || []);
        } catch { toast.error('Échec du chargement des familles partenaires'); }
        finally { setLoading(false); }
    }, []);

    const loadAllPartners = useCallback(async () => {
        setLoadingPartners(true);
        try {
            const res = await getPartners({ per_page: 500 });
            const list = res.partners?.data ?? [];
            setAllPartners(list);
        } catch (err) {
            console.error('Failed to load partners', err);
            toast.error('Échec du chargement des partenaires');
        } finally { setLoadingPartners(false); }
    }, []);

    useEffect(() => { loadFamilies(); loadAllPartners(); }, [loadFamilies, loadAllPartners]);

    const visibleFamilies = useMemo(() => {
        if (!listSearch.trim()) return families;
        const q = listSearch.toLowerCase();
        return families.filter(f => f.code.toLowerCase().includes(q) || f.name.toLowerCase().includes(q));
    }, [families, listSearch]);

    const handleCreateNew = () => {
        setFormData({ code: '', name: '', partner_condition: '', partners: [] });
        setIsEditMode(false); setActiveTab('info'); setShowForm(true); setSelected(null);
    };

    const handleEdit = (family: PartnerFamily) => {
        const partnerCodes: string[] = Array.isArray(family.partners)
            ? family.partners.map((p: string | { partner_code?: string; code?: string }) => typeof p === 'string' ? p : (p.partner_code ?? p.code ?? '')).filter(Boolean)
            : [];
        setFormData({ ...family, partners: partnerCodes });
        setIsEditMode(true); setActiveTab('info'); setShowForm(true);
    };

    const handleCancel = useCallback(() => {
        setShowForm(false);
        setFormData({ code: '', name: '', partner_condition: '', partners: [] });
    }, []);

    const handleSave = useCallback(async () => {
        if (!formData.code || !formData.name) { toast.error('Code et Nom sont obligatoires'); return; }
        if (formData.code.length < 2)          { toast.error('Le code doit contenir au moins 2 caractères'); return; }
        if (formData.name.length < 3)          { toast.error('Le nom doit contenir au moins 3 caractères'); return; }
        if (!isEditMode && families.some(f => f.code === formData.code)) { toast.error('Ce code existe déjà'); return; }
        setIsSaving(true);
        try {
            if (isEditMode && formData.id) {
                await promotionsApi.updatePartnerFamily(formData.id, formData);
                toast.success('Famille mise à jour');
            } else {
                await promotionsApi.createPartnerFamily(formData);
                toast.success('Famille créée');
            }
            setShowForm(false);
            setFormData({ code: '', name: '', partner_condition: '', partners: [] });
            await loadFamilies();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Échec de l\'opération');
        }
        finally { setIsSaving(false); }
    }, [formData, isEditMode, families, loadFamilies]);

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's' && showForm) { e.preventDefault(); handleSave(); }
            if (e.key === 'Escape') {
                if (showPartnerModal) setShowPartnerModal(false);
                else if (showForm) handleCancel();
            }
            if ((e.ctrlKey || e.metaKey) && e.key === 'n' && !showForm) { e.preventDefault(); handleCreateNew(); }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [showForm, showPartnerModal, formData, handleSave, handleCancel]);

    const handleDeleteClick = (id: number) => { setFamilyToDelete(id); setShowDeleteModal(true); };
    const handleDeleteConfirm = async () => {
        if (!familyToDelete) return;
        setIsDeleting(true);
        try {
            await promotionsApi.deletePartnerFamily(familyToDelete);
            toast.success('Famille supprimée');
            if (selected?.id === familyToDelete) setSelected(null);
            setShowDeleteModal(false); setFamilyToDelete(null);
            await loadFamilies();
        } catch (err) {
            const message = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(message || 'Échec de la suppression');
        }
        finally { setIsDeleting(false); }
    };

    const handleTogglePartner = (code: string) => {
        const cur = (formData.partners || []) as string[];
        setFormData({ ...formData, partners: cur.includes(code) ? cur.filter(c => c !== code) : [...cur, code] });
    };

    const filteredPartners = useMemo(() => {
        let list = allPartners;
        if (partnerSearch) { const q = partnerSearch.toLowerCase(); list = list.filter(p => p.code.toLowerCase().includes(q) || p.name.toLowerCase().includes(q)); }
        if (creditFilter !== 'all') {
            list = list.filter(p => {
                const v = toCredit(p.credit_limit);
                if (creditFilter === 'high')   return v >= 100000;
                if (creditFilter === 'medium') return v >= 50000 && v < 100000;
                if (creditFilter === 'low')    return v < 50000;
                return true;
            });
        }
        return list;
    }, [allPartners, partnerSearch, creditFilter]);

    const handleSelectAll = () => {
        const codes = filteredPartners.map(p => p.code);
        setFormData({ ...formData, partners: [...new Set([...(formData.partners || []) as string[], ...codes])] });
    };

    const handleExportFamily = () => {
        if (!formData.code) { toast.error('Aucune famille à exporter'); return; }
        const blob = new Blob([JSON.stringify(formData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = `famille-${formData.code}.json`; a.click();
        URL.revokeObjectURL(url);
        toast.success('Famille exportée');
    };

    const selectedPartners = useMemo(() => (formData.partners || []) as string[], [formData.partners]);

    const creditStats = useMemo(() => {
        const total = selectedPartners.reduce((s, c) => s + toCredit(allPartners.find(p => p.code === c)?.credit_limit), 0);
        const avg = selectedPartners.length > 0 ? Math.round(total / selectedPartners.length) : 0;
        return { total, avg };
    }, [selectedPartners, allPartners]);

    // ── Sidebar card ──────────────────────────────────────────────────────────
    const FamilyCard = ({ family }: { family: PartnerFamily }) => {
        const isActive = !showForm && selected?.id === family.id;
        const count = Array.isArray(family.partners) ? family.partners.length : (family.partners_count ?? 0);
        return (
            <button
                onClick={() => { setSelected(family); setShowForm(false); }}
                className={`w-full text-left px-3 py-2.5 rounded-xl border transition-all group
                    ${isActive
                        ? 'bg-violet-50 border-violet-300 shadow-sm'
                        : 'bg-white border-gray-200 hover:border-violet-200 hover:bg-violet-50/40'}`}
            >
                <div className="flex items-start gap-2.5">
                    <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isActive ? ACCENT.dot : 'bg-gray-300 group-hover:bg-violet-400'} transition-colors`} />
                    <div className="flex-1 min-w-0">
                        <div className="mb-0.5">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${isActive ? ACCENT.badge : 'bg-gray-100 text-gray-600'} font-mono transition-colors`}>
                                {family.code}
                            </span>
                        </div>
                        <p className="text-sm font-medium text-gray-800 truncate leading-snug">{family.name}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{count} partenaire{count !== 1 ? 's' : ''}</p>
                    </div>
                </div>
            </button>
        );
    };

    // ── Detail view ───────────────────────────────────────────────────────────
    const DetailView = ({ family }: { family: PartnerFamily }) => {
        const partnerCodes: string[] = Array.isArray(family.partners)
            ? family.partners.map((p: string | { partner_code?: string; code?: string }) => typeof p === 'string' ? p : (p.partner_code ?? p.code ?? '')).filter(Boolean)
            : [];
        const count = partnerCodes.length || (family.partners_count ?? 0);
        const totalCredit = partnerCodes.reduce((s, c) => s + toCredit(allPartners.find(p => p.code === c)?.credit_limit), 0);
        const avgCredit   = count > 0 ? Math.round(totalCredit / count) : 0;

        return (
            <div className="h-full flex flex-col">
                <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-violet-100 rounded-xl flex items-center justify-center">
                                <Users className="w-5 h-5 text-violet-600" />
                            </div>
                            <div>
                                <div className="flex items-center gap-2 mb-0.5">
                                    <span className="text-xs font-bold text-violet-700 bg-violet-100 px-2 py-0.5 rounded-md font-mono">{family.code}</span>
                                </div>
                                <h2 className="text-lg font-bold text-gray-900 leading-tight">{family.name}</h2>
                                {family.partner_condition && (
                                    <div className="flex items-center gap-1.5 mt-1">
                                        <Code className="w-3 h-3 text-gray-400" />
                                        <code className="text-xs text-gray-500 font-mono">{family.partner_condition}</code>
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            <button onClick={() => handleEdit(family)} className="h-8 px-3 flex items-center gap-1.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200 rounded-lg hover:bg-violet-100 transition-colors">
                                <Edit className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button onClick={() => handleDeleteClick(family.id!)} className="h-8 w-8 flex items-center justify-center text-red-500 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200">
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Credit stats */}
                    {count > 0 && (
                        <div className="grid grid-cols-3 gap-3 mt-4">
                            {[
                                { label: 'Partenaires', value: count.toString(), cls: 'bg-violet-50 border-violet-100' },
                                { label: 'Crédit Total', value: `${fmt(totalCredit)} Dh`, cls: 'bg-emerald-50 border-emerald-100' },
                                { label: 'Crédit Moyen', value: `${fmt(avgCredit)} Dh`, cls: 'bg-blue-50 border-blue-100' },
                            ].map(s => (
                                <div key={s.label} className={`px-3 py-2 rounded-lg border ${s.cls}`}>
                                    <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.label}</p>
                                    <p className="text-sm font-bold text-gray-800 mt-0.5">{s.value}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-6">
                    {partnerCodes.length === 0 ? (
                        <div className="flex flex-col items-center justify-center py-16 text-center">
                            <Users className="w-10 h-10 text-gray-200 mb-3" />
                            <p className="text-sm text-gray-500 font-medium">Aucun partenaire dans cette famille</p>
                            <button onClick={() => handleEdit(family)} className={`mt-4 px-4 py-2 text-sm font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} transition-colors`}>
                                Ajouter des partenaires
                            </button>
                        </div>
                    ) : (
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Partenaires ({count})</h3>
                            <div className="grid grid-cols-1 gap-1.5">
                                {partnerCodes.map(code => {
                                    const p = allPartners.find(x => x.code === code);
                                    const tier = p ? creditTier(p.credit_limit) : null;
                                    return (
                                        <div key={code} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-gray-100 hover:border-gray-200 transition-colors">
                                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-violet-600">{(p?.name || code)[0]?.toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{p?.name ?? '—'}</p>
                                                <p className="text-xs text-gray-400 font-mono">{code}</p>
                                            </div>
                                            {p && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-medium text-emerald-700">{fmt(toCredit(p.credit_limit))} Dh</span>
                                                    {tier && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border font-medium ${tier.cls}`}>{tier.label}</span>}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    // ── Form view ─────────────────────────────────────────────────────────────
    const FormView = () => (
        <div className="h-full flex flex-col">
            <div className="shrink-0 bg-white border-b border-gray-100 px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <button onClick={handleCancel} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{isEditMode ? 'Modifier la famille' : 'Nouvelle Famille Partenaire'}</h2>
                        <p className="text-xs text-gray-400 mt-0.5">{isEditMode ? `Code : ${formData.code}` : 'Créer un segment client pour les promotions'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {isEditMode && (
                        <button onClick={handleExportFamily} className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-lg border border-gray-200 transition-colors" title="Exporter en JSON">
                            <Download className="w-3.5 h-3.5 text-gray-500" />
                        </button>
                    )}
                    <button onClick={handleCancel} className="h-9 px-4 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">Annuler</button>
                    <button
                        onClick={handleSave} disabled={isSaving}
                        className={`h-9 px-4 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors disabled:opacity-50 ${ACCENT.bg} ${ACCENT.hbg}`}
                    >
                        {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Enregistrer
                    </button>
                </div>
            </div>

            <div className="shrink-0 bg-white border-b border-gray-100 px-6">
                <div className="flex gap-0">
                    {(['info', 'partners'] as const).map(tab => (
                        <button key={tab} onClick={() => setActiveTab(tab)}
                            className={`relative py-3 px-4 text-sm font-medium transition-colors ${activeTab === tab ? 'text-violet-700' : 'text-gray-500 hover:text-gray-800'}`}
                        >
                            {tab === 'info' ? 'Informations' : `Partenaires (${selectedPartners.length})`}
                            {activeTab === tab && <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-violet-600 rounded-full" />}
                        </button>
                    ))}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'info' && (
                    <div className="max-w-lg space-y-4">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Code <span className="text-red-500">*</span></label>
                            <input
                                value={formData.code || ''} onChange={e => setFormData({ ...formData, code: e.target.value.toUpperCase() })}
                                disabled={isEditMode} autoFocus maxLength={20}
                                placeholder="Ex : PREGROS"
                                className={`w-full h-10 px-3 border border-gray-300 rounded-lg text-sm font-mono uppercase outline-none ${ACCENT.ring} focus:ring-2 disabled:bg-gray-50 disabled:text-gray-400 transition-colors`}
                            />
                            {isEditMode && <p className="text-[11px] text-gray-400 mt-1">Le code ne peut pas être modifié après création.</p>}
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Nom <span className="text-red-500">*</span></label>
                            <input
                                value={formData.name || ''} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                maxLength={100} placeholder="Ex : Clients Grossistes"
                                className={`w-full h-10 px-3 border border-gray-300 rounded-lg text-sm outline-none ${ACCENT.ring} focus:ring-2 transition-colors`}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">Condition Partenaire</label>
                            <textarea
                                value={formData.partner_condition || ''} onChange={e => setFormData({ ...formData, partner_condition: e.target.value })}
                                rows={2} placeholder="Ex : credit_limit > 50000"
                                className={`w-full px-3 py-2 border border-gray-300 rounded-lg text-sm font-mono outline-none ${ACCENT.ring} focus:ring-2 resize-none transition-colors`}
                            />
                            <p className="text-[11px] text-gray-400 mt-1">Condition SQL pour filtrer automatiquement les partenaires.</p>
                            {formData.partner_condition && (
                                <div className="mt-2 px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg">
                                    <span className="text-[11px] font-semibold text-violet-600">Condition active : </span>
                                    <code className="text-xs text-violet-800">{formData.partner_condition}</code>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'partners' && (
                    <div className="max-w-2xl">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="text-sm font-semibold text-gray-800">Partenaires de la famille</h3>
                                <p className="text-xs text-gray-400 mt-0.5">{selectedPartners.length} partenaire{selectedPartners.length !== 1 ? 's' : ''} · crédit total {fmt(creditStats.total)} Dh</p>
                            </div>
                            <button onClick={() => setShowPartnerModal(true)} className={`h-8 px-3 text-xs font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} flex items-center gap-1.5 transition-colors`}>
                                <Plus className="w-3.5 h-3.5" /> Ajouter partenaires
                            </button>
                        </div>

                        {selectedPartners.length > 0 && (
                            <div className="grid grid-cols-3 gap-3 mb-4">
                                {[
                                    { l: 'Partenaires', v: selectedPartners.length.toString(), c: 'bg-violet-50 border-violet-100' },
                                    { l: 'Crédit Total', v: `${fmt(creditStats.total)} Dh`, c: 'bg-emerald-50 border-emerald-100' },
                                    { l: 'Crédit Moyen', v: `${fmt(creditStats.avg)} Dh`, c: 'bg-blue-50 border-blue-100' },
                                ].map(s => (
                                    <div key={s.l} className={`px-3 py-2 rounded-lg border ${s.c}`}>
                                        <p className="text-[10px] text-gray-400 uppercase tracking-wider">{s.l}</p>
                                        <p className="text-sm font-bold text-gray-800 mt-0.5">{s.v}</p>
                                    </div>
                                ))}
                            </div>
                        )}

                        {selectedPartners.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 border-2 border-dashed border-gray-200 rounded-xl text-center">
                                <Users className="w-8 h-8 text-gray-300 mb-2" />
                                <p className="text-sm text-gray-400">Aucun partenaire sélectionné</p>
                                <button onClick={() => setShowPartnerModal(true)} className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-medium">+ Parcourir les partenaires</button>
                            </div>
                        ) : (
                            <div className="space-y-1.5">
                                {selectedPartners.map(code => {
                                    const p = allPartners.find(x => x.code === code);
                                    const tier = p ? creditTier(p.credit_limit) : null;
                                    return (
                                        <div key={code} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-gray-200 hover:border-gray-300 group transition-colors">
                                            <div className="w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center shrink-0">
                                                <span className="text-[10px] font-bold text-violet-600">{(p?.name || code)[0]?.toUpperCase()}</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-gray-800 truncate">{p?.name ?? '—'}</p>
                                                <p className="text-xs text-gray-400 font-mono">{code}</p>
                                            </div>
                                            {p && (
                                                <div className="flex items-center gap-2 shrink-0">
                                                    <span className="text-xs font-medium text-emerald-700">{fmt(toCredit(p.credit_limit))} Dh</span>
                                                    {tier && <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tier.cls}`}>{tier.label}</span>}
                                                </div>
                                            )}
                                            <button
                                                onClick={() => handleTogglePartner(code)}
                                                className="opacity-0 group-hover:opacity-100 w-6 h-6 flex items-center justify-center text-red-400 hover:text-red-600 hover:bg-red-50 rounded transition-all ml-1"
                                            >
                                                <X className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    // ── Partner selection modal ───────────────────────────────────────────────
    const PartnerModal = () => !showPartnerModal ? null : (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[82vh] flex flex-col">
                <div className="px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center justify-between mb-3">
                        <h2 className="text-base font-bold text-gray-900">Sélectionner des partenaires</h2>
                        <button onClick={() => setShowPartnerModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4 text-gray-500" /></button>
                    </div>
                    <div className="relative mb-3">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                        <input
                            autoFocus value={partnerSearch} onChange={e => setPartnerSearch(e.target.value)}
                            placeholder="Rechercher par code ou nom…"
                            className="w-full h-9 pl-9 pr-4 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400"
                        />
                    </div>
                    <div className="flex items-center justify-between">
                        <div className="flex gap-1.5">
                            {([
                                { key: 'all', label: 'Tous', active: 'bg-gray-800 text-white border-gray-800' },
                                { key: 'high', label: '> 100K', active: 'bg-emerald-600 text-white border-emerald-600' },
                                { key: 'medium', label: '50–100K', active: 'bg-blue-600 text-white border-blue-600' },
                                { key: 'low', label: '< 50K', active: 'bg-orange-600 text-white border-orange-600' },
                            ] as const).map(f => (
                                <button key={f.key} onClick={() => setCreditFilter(f.key as 'all' | 'high' | 'medium' | 'low')}
                                    className={`px-2.5 py-1 text-xs rounded-full border transition-colors font-medium
                                        ${creditFilter === f.key ? f.active : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                                >{f.label}</button>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <button onClick={handleSelectAll} className="text-xs text-violet-600 hover:text-violet-700 font-medium">Tout sélectionner</button>
                            <span className="text-gray-300">·</span>
                            <button onClick={() => setFormData({ ...formData, partners: [] })} className="text-xs text-gray-500 hover:text-gray-700 font-medium">Tout effacer</button>
                        </div>
                    </div>
                </div>
                <div className="flex-1 overflow-y-auto p-4">
                    {loadingPartners ? (
                        <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-violet-500" /></div>
                    ) : filteredPartners.length === 0 ? (
                        <div className="text-center py-12"><Users className="w-10 h-10 text-gray-200 mx-auto mb-2" /><p className="text-sm text-gray-400">Aucun partenaire trouvé</p></div>
                    ) : (
                        <div className="border border-gray-200 rounded-xl overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-gray-50 border-b border-gray-200">
                                    <tr>
                                        <th className="w-10 px-3 py-2 text-left">
                                            <input
                                                type="checkbox"
                                                checked={filteredPartners.length > 0 && filteredPartners.every(p => selectedPartners.includes(p.code))}
                                                onChange={() => {
                                                    const allCodes = filteredPartners.map(p => p.code);
                                                    const allSelected = allCodes.every(code => selectedPartners.includes(code));
                                                    setFormData({
                                                        ...formData,
                                                        partners: allSelected
                                                            ? selectedPartners.filter(code => !allCodes.includes(code))
                                                            : [...new Set([...selectedPartners, ...allCodes])],
                                                    });
                                                }}
                                                className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500"
                                            />
                                        </th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Code</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Nom</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Crédit</th>
                                        <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">Liste de prix</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {filteredPartners.map(p => {
                                        const isSel = selectedPartners.includes(p.code);
                                        const tier = creditTier(p.credit_limit);
                                        return (
                                            <tr
                                                key={p.id}
                                                onClick={() => handleTogglePartner(p.code)}
                                                className={`cursor-pointer transition-colors ${isSel ? 'bg-violet-50 hover:bg-violet-100' : 'hover:bg-gray-50'}`}
                                            >
                                                <td className="px-3 py-2.5">
                                                    <input
                                                        type="checkbox"
                                                        checked={isSel}
                                                        onChange={() => handleTogglePartner(p.code)}
                                                        className="w-4 h-4 text-violet-600 rounded border-gray-300 focus:ring-violet-500 pointer-events-none"
                                                    />
                                                </td>
                                                <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{p.code}</td>
                                                <td className="px-3 py-2.5">
                                                    <p className="font-medium text-gray-900 truncate max-w-[200px]">{p.name}</p>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-xs font-medium text-emerald-700">{fmt(toCredit(p.credit_limit))} Dh</span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${tier.cls}`}>{tier.label}</span>
                                                    </div>
                                                </td>
                                                <td className="px-3 py-2.5">
                                                    <p className="text-xs text-gray-500 truncate max-w-[140px]">{p.price_list?.name ?? '—'}</p>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                <div className="px-6 py-3 border-t border-gray-100 flex items-center justify-between">
                    <span className="text-xs text-gray-400">{selectedPartners.length} sélectionné{selectedPartners.length !== 1 ? 's' : ''} · {filteredPartners.length} affiché{filteredPartners.length !== 1 ? 's' : ''}</span>
                    <button onClick={() => setShowPartnerModal(false)} className={`h-8 px-4 text-sm font-medium text-white rounded-lg ${ACCENT.bg} ${ACCENT.hbg} transition-colors`}>Terminé</button>
                </div>
            </div>
        </div>
    );

    // ── Sidebar content ───────────────────────────────────────────────────────
    const SidebarContent = (
        <div className="h-full flex flex-col bg-white">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                {/* Title row — no buttons here to avoid overlap with MasterLayout controls */}
                <div className="flex items-center gap-2 mb-3">
                    <div className="w-7 h-7 bg-violet-100 rounded-lg flex items-center justify-center shrink-0">
                        <Users className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 leading-tight">Familles Partenaires</h2>
                        <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] text-gray-400">{visibleFamilies.length} famille{visibleFamilies.length !== 1 ? 's' : ''}</span>
                            <button onClick={loadFamilies} disabled={loading} title="Actualiser" className="text-gray-300 hover:text-gray-500 transition-colors disabled:opacity-40">
                                <RefreshCw className={`w-3 h-3 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                    </div>
                </div>
                {/* Search + New button on same row */}
                <div className="flex items-center gap-1.5">
                    <div className="relative flex-1">
                        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                            value={listSearch} onChange={e => setListSearch(e.target.value)}
                            placeholder="Rechercher…"
                            className="w-full h-8 pl-8 pr-3 bg-gray-50 border border-gray-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-violet-400 focus:border-violet-400 transition-colors"
                        />
                    </div>
                    <button onClick={handleCreateNew} className={`h-8 w-8 shrink-0 flex items-center justify-center text-white rounded-lg transition-colors ${ACCENT.bg} ${ACCENT.hbg}`} title="Nouvelle famille">
                        <Plus className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                {loading ? (
                    <div className="flex items-center justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-violet-400" /></div>
                ) : visibleFamilies.length === 0 ? (
                    <div className="text-center py-10">
                        <Users className="w-8 h-8 text-gray-200 mx-auto mb-2" />
                        <p className="text-xs text-gray-400">{listSearch ? 'Aucun résultat' : 'Aucune famille'}</p>
                        {!listSearch && (
                            <button onClick={handleCreateNew} className="mt-3 text-xs text-violet-600 hover:text-violet-700 font-medium">+ Créer la première</button>
                        )}
                    </div>
                ) : visibleFamilies.map(f => <FamilyCard key={f.id} family={f} />)}
            </div>
        </div>
    );

    // ── Main content ──────────────────────────────────────────────────────────
    const MainContent = (
        <div className="h-full overflow-hidden bg-slate-50">
            {showForm ? (
                <FormView />
            ) : selected ? (
                <DetailView family={selected} />
            ) : (
                <div className="h-full flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-violet-50 rounded-2xl flex items-center justify-center mb-4">
                        <Users className="w-8 h-8 text-violet-300" />
                    </div>
                    <h3 className="text-base font-semibold text-gray-600 mb-1">Sélectionnez une famille</h3>
                    <p className="text-sm text-gray-400 mb-5">Cliquez sur une famille dans la liste pour voir ses détails</p>
                    <button onClick={handleCreateNew} className={`h-9 px-4 text-white text-sm font-medium rounded-lg flex items-center gap-2 transition-colors ${ACCENT.bg} ${ACCENT.hbg}`}>
                        <Plus className="w-4 h-4" /> Nouvelle Famille
                    </button>
                </div>
            )}
        </div>
    );

    // ── Main render ───────────────────────────────────────────────────────────
    return (
        <>
            <MasterLayout
                leftContent={SidebarContent}
                mainContent={MainContent}
            />

            <PartnerModal />

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
