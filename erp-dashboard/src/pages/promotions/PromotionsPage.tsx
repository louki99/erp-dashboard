import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion } from '@/types/promotion.types';
import {
    Tag,
    RefreshCw,
    Users,
    Package,
    Plus,
    Edit,
    Trash2,
    Clock,
    Copy,
    Zap,
    Loader2,
    X,
    Banknote,
    AlertTriangle,
    Search,
    CalendarRange,
    Layers,
    ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { PromotionFormRedesigned } from './components/PromotionFormRedesigned';

// ─── Shared status helper (pure) ─────────────────────────────────────────────

const getPromoStatus = (p: Promotion) => {
    const now = new Date();
    if (p.is_closed)            return { label: 'Fermée',        color: 'gray'   } as const;
    if (p.budget_exhausted_at)  return { label: 'Budget épuisé', color: 'red'    } as const;
    if (new Date(p.start_date) > now) return { label: 'À venir', color: 'blue'   } as const;
    if (new Date(p.end_date)   < now) return { label: 'Expirée', color: 'orange' } as const;
    return { label: 'Active', color: 'green' } as const;
};

const STATUS_STYLE = {
    gray:   { badge: 'bg-gray-100 text-gray-600',     dot: 'bg-gray-400',   border: 'border-gray-200'   },
    red:    { badge: 'bg-red-100 text-red-700 font-semibold', dot: 'bg-red-500', border: 'border-red-200' },
    blue:   { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',   border: 'border-blue-200'   },
    orange: { badge: 'bg-orange-100 text-orange-700', dot: 'bg-orange-400', border: 'border-orange-200' },
    green:  { badge: 'bg-green-100 text-green-700',   dot: 'bg-green-500',  border: 'border-green-200'  },
};

// ─── Promo list card ──────────────────────────────────────────────────────────

const PromoListCard = ({
    promo, selected, onClick,
}: { promo: Promotion; selected: boolean; onClick: () => void }) => {
    const status   = getPromoStatus(promo);
    const style    = STATUS_STYLE[status.color];
    const hasBudget = promo.max_budget && Number(promo.max_budget) > 0;
    const budgetPct = hasBudget
        ? Math.min((Number(promo.current_spent ?? 0) / Number(promo.max_budget!)) * 100, 100)
        : 0;
    const barColor  = budgetPct >= 100 ? 'bg-red-500' : budgetPct >= 80 ? 'bg-amber-400' : 'bg-emerald-400';
    const hasSchedule = (promo.active_days && promo.active_days.length > 0) || promo.daily_start_time;
    const bpTag: Record<number, string> = { 1: 'Qté', 2: 'Valeur', 3: 'UP' };
    const smTag: Record<number, string> = { 1: 'Cumulatif', 2: 'Tranche' };

    return (
        <button
            onClick={onClick}
            className={`w-full text-left px-3 py-2.5 border-b border-gray-50 transition-all group
                ${selected
                    ? 'bg-purple-50/70 border-l-[3px] border-l-purple-500'
                    : 'border-l-[3px] border-l-transparent hover:bg-slate-50'
                }`}
        >
            {/* Name + status */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <span className={`text-xs font-semibold leading-tight flex-1 min-w-0 truncate ${selected ? 'text-purple-900' : 'text-gray-800'}`}>
                    {promo.name}
                </span>
                <span className={`shrink-0 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 ${style.badge}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                    {status.label}
                </span>
            </div>

            {/* Code + dates */}
            <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-mono text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">{promo.code}</span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400 truncate">
                    {new Date(promo.start_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' })}
                    {' → '}
                    {new Date(promo.end_date).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: '2-digit' })}
                </span>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">
                    {bpTag[promo.breakpoint_type] ?? '—'}
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded-full">
                    {smTag[promo.scale_method] ?? '—'}
                </span>
                {(promo.lines?.length ?? 0) > 0 && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full">
                        {promo.lines?.length} règle{(promo.lines?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                )}
                {hasSchedule && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full" title="Happy Hours actif">
                        ⏰ HH
                    </span>
                )}
            </div>

            {/* Budget bar */}
            {hasBudget && (
                <div className="mt-2">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${budgetPct}%` }} />
                    </div>
                    <div className="flex justify-between mt-0.5">
                        <span className="text-[9px] text-gray-400">Budget {Math.round(budgetPct)}%</span>
                        <span className="text-[9px] text-gray-400">
                            {Number(promo.current_spent ?? 0).toLocaleString('fr-FR')} / {Number(promo.max_budget).toLocaleString('fr-FR')} MAD
                        </span>
                    </div>
                </div>
            )}
        </button>
    );
};


export const PromotionsPage = () => {
    const navigate = useNavigate();
    const [promotions, setPromotions] = useState<Promotion[]>([]);
    const [selectedPromotion, setSelectedPromotion] = useState<Promotion | null>(null);
    const [loading, setLoading] = useState(true);
    const [showDeleteModal, setShowDeleteModal] = useState(false);
    const [promotionToDelete, setPromotionToDelete] = useState<number | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isEditDrawerOpen, setIsEditDrawerOpen] = useState(false);
    const [editingPromotionId, setEditingPromotionId] = useState<number | null>(null);
    const [listSearch, setListSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'upcoming' | 'expired' | 'closed' | 'budget_exhausted'>('all');

    const filteredPromos = useMemo(() => {
        let list = promotions;
        if (listSearch) {
            const q = listSearch.toLowerCase();
            list = list.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
        }
        if (statusFilter !== 'all') {
            const now = new Date();
            list = list.filter(p => {
                if (statusFilter === 'closed')           return p.is_closed;
                if (statusFilter === 'budget_exhausted') return !!p.budget_exhausted_at;
                if (statusFilter === 'upcoming')         return !p.is_closed && new Date(p.start_date) > now;
                if (statusFilter === 'expired')          return !p.is_closed && new Date(p.end_date) < now;
                if (statusFilter === 'active')           return !p.is_closed && !p.budget_exhausted_at && new Date(p.start_date) <= now && new Date(p.end_date) >= now;
                return true;
            });
        }
        return list;
    }, [promotions, listSearch, statusFilter]);

    const loadPromotions = async () => {
        try {
            setLoading(true);
            const data = await promotionsApi.getPromotions();
            setPromotions(data.promotions.data || []);
        } catch (error) {
            console.error('Failed to load promotions', error);
            toast.error('Échec du chargement des promotions');
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteClick = (id: number) => {
        setPromotionToDelete(id);
        setShowDeleteModal(true);
    };

    const handleDeleteConfirm = async () => {
        if (!promotionToDelete) return;
        
        try {
            setIsDeleting(true);
            await promotionsApi.deletePromotion(promotionToDelete);
            toast.success('Promotion supprimée');
            loadPromotions();
            if (selectedPromotion?.id === promotionToDelete) {
                setSelectedPromotion(null);
            }
            setShowDeleteModal(false);
            setPromotionToDelete(null);
        } catch (error) {
            console.error('Failed to delete promotion:', error);
            toast.error('Échec de la suppression');
        } finally {
            setIsDeleting(false);
        }
    };

    const handleClone = async (id: number) => {
        try {
            const result = await promotionsApi.clonePromotion(id);
            toast.success('Promotion clonée avec succès');
            loadPromotions();
            navigate(`/promotions/${result.clone.id}/edit`);
        } catch (error) {
            console.error('Failed to clone promotion:', error);
            toast.error('Échec du clonage');
        }
    };

    useEffect(() => {
        loadPromotions();
    }, []);

    const SidebarContent = (
        <div className="h-full flex flex-col bg-white border-r border-gray-100">
            {/* ── Header ──────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-purple-500 to-violet-600 flex items-center justify-center shadow-sm">
                            <Tag className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h2 className="font-bold text-gray-900 text-sm leading-tight">Promotions</h2>
                            <p className="text-[11px] text-gray-400">{filteredPromos.length} / {promotions.length}</p>
                        </div>
                    </div>
                    <button
                        onClick={() => navigate('/promotions/new')}
                        className="w-7 h-7 rounded-lg bg-purple-600 flex items-center justify-center hover:bg-purple-700 transition-colors shadow-sm"
                        title="Nouvelle promotion"
                    >
                        <Plus className="w-3.5 h-3.5 text-white" />
                    </button>
                </div>

                {/* Search */}
                <div className="relative mb-2">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                    <input
                        type="text"
                        placeholder="Rechercher nom ou code…"
                        value={listSearch}
                        onChange={e => setListSearch(e.target.value)}
                        className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-lg bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-300 focus:bg-white transition-colors"
                    />
                    {listSearch && (
                        <button onClick={() => setListSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                            <X className="w-3 h-3" />
                        </button>
                    )}
                </div>

                {/* Status filter pills */}
                <div className="flex gap-1 flex-wrap">
                    {([
                        { key: 'all',              label: 'Toutes',        cls: 'text-purple-700 border-purple-300 bg-purple-50' },
                        { key: 'active',           label: '● Active',      cls: 'text-green-700 border-green-300 bg-green-50'   },
                        { key: 'upcoming',         label: '● À venir',     cls: 'text-blue-700 border-blue-300 bg-blue-50'      },
                        { key: 'expired',          label: '● Expirée',     cls: 'text-orange-700 border-orange-300 bg-orange-50'},
                        { key: 'budget_exhausted', label: '⚠ Budget',      cls: 'text-red-700 border-red-300 bg-red-50'         },
                    ] as const).map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key)}
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all
                                ${statusFilter === f.key ? f.cls : 'text-gray-400 border-gray-200 bg-white hover:border-gray-300'}`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Card list ────────────────────────────────── */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex items-center justify-center py-16 text-gray-400">
                        <Loader2 className="w-4 h-4 animate-spin mr-2 text-purple-400" /> Chargement…
                    </div>
                ) : filteredPromos.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-gray-400 px-4 text-center">
                        <Tag className="w-10 h-10 opacity-15 mb-3" />
                        <p className="text-xs font-medium">Aucune promotion trouvée</p>
                        {listSearch && <p className="text-[10px] mt-1 text-gray-300">Essayez un autre terme</p>}
                    </div>
                ) : (
                    filteredPromos.map(promo => (
                        <PromoListCard
                            key={promo.id}
                            promo={promo}
                            selected={selectedPromotion?.id === promo.id}
                            onClick={() => setSelectedPromotion(promo)}
                        />
                    ))
                )}
            </div>
        </div>
    );

    const DetailView = selectedPromotion ? (() => {
        const status   = getPromoStatus(selectedPromotion);
        const st       = STATUS_STYLE[status.color];
        const bpLabels: Record<number, { icon: string; label: string; desc: string }> = {
            1: { icon: '📦', label: 'Quantité', desc: 'Seuil en unités' },
            2: { icon: '💰', label: 'Valeur', desc: 'Seuil en MAD' },
            3: { icon: '🎁', label: 'Unités Promo', desc: 'Poids pondéré' },
        };
        const smLabels: Record<number, { icon: string; label: string; desc: string }> = {
            1: { icon: '📊', label: 'Cumulatif', desc: 'Paliers cumulés' },
            2: { icon: '🎯', label: 'Tranche', desc: 'Palier le plus haut' },
        };
        const bp = bpLabels[selectedPromotion.breakpoint_type] ?? bpLabels[1];
        const sm = smLabels[selectedPromotion.scale_method] ?? smLabels[1];
        const hasBudget = selectedPromotion.max_budget && Number(selectedPromotion.max_budget) > 0;
        const hasSchedule = (selectedPromotion.active_days && selectedPromotion.active_days.length > 0) || selectedPromotion.daily_start_time;

        return (
        <div className="flex flex-col h-full bg-slate-50 overflow-hidden">
            {/* ── Hero header ─────────────────────────────── */}
            <div className="shrink-0 bg-white border-b border-gray-100 shadow-sm">
                {/* Top bar */}
                <div className={`h-1 w-full ${st.dot.replace('bg-', 'bg-').replace('400', '500').replace('500', '500')}`} />
                <div className="px-6 py-5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            {/* Breadcrumb */}
                            <div className="flex items-center gap-1.5 text-[11px] text-gray-400 mb-2">
                                <Tag className="w-3 h-3" /> Promotions
                                <ChevronRight className="w-3 h-3" />
                                <span className="font-mono text-purple-600 font-semibold">{selectedPromotion.code}</span>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <h1 className="text-xl font-bold text-gray-900 leading-tight">{selectedPromotion.name}</h1>
                                <span className={`text-xs px-2.5 py-1 rounded-full font-semibold flex items-center gap-1.5 border ${st.badge} ${st.border}`}>
                                    <span className={`w-1.5 h-1.5 rounded-full ${st.dot}`} /> {status.label}
                                </span>
                            </div>
                            {selectedPromotion.description && (
                                <p className="text-sm text-gray-400 mt-1 leading-snug line-clamp-2">{selectedPromotion.description}</p>
                            )}
                        </div>
                        {/* Action buttons */}
                        <div className="flex items-center gap-2 shrink-0">
                            <button
                                onClick={() => { setEditingPromotionId(selectedPromotion.id!); setIsEditDrawerOpen(true); }}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 border border-purple-200 rounded-lg hover:bg-purple-100 transition-colors"
                            >
                                <Edit className="w-3.5 h-3.5" /> Modifier
                            </button>
                            <button
                                onClick={() => handleClone(selectedPromotion.id!)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                            >
                                <Copy className="w-3.5 h-3.5" /> Cloner
                            </button>
                            <button
                                onClick={() => handleDeleteClick(selectedPromotion.id!)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 border border-gray-200 rounded-lg transition-colors"
                                title="Supprimer"
                            >
                                <Trash2 className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* KPI strip */}
                    <div className="flex items-center gap-3 mt-4 flex-wrap">
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-100 rounded-lg">
                            <CalendarRange className="w-3.5 h-3.5 text-gray-400" />
                            <span className="text-xs text-gray-600 font-medium">
                                {new Date(selectedPromotion.start_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short' })}
                                {' → '}
                                {new Date(selectedPromotion.end_date).toLocaleDateString('fr-FR', { day:'2-digit', month:'short', year:'numeric' })}
                            </span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 border border-indigo-100 rounded-lg">
                            <span className="text-sm">{bp.icon}</span>
                            <span className="text-xs text-indigo-700 font-medium">{bp.label}</span>
                            <span className="text-[10px] text-indigo-400">{bp.desc}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-100 rounded-lg">
                            <span className="text-sm">{sm.icon}</span>
                            <span className="text-xs text-slate-700 font-medium">{sm.label}</span>
                            <span className="text-[10px] text-slate-400">{sm.desc}</span>
                        </div>
                        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 border border-purple-100 rounded-lg">
                            <Layers className="w-3.5 h-3.5 text-purple-500" />
                            <span className="text-xs text-purple-700 font-medium">{selectedPromotion.lines?.length ?? 0} règle{(selectedPromotion.lines?.length ?? 0) !== 1 ? 's' : ''}</span>
                        </div>
                        {hasBudget && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                                <Banknote className="w-3.5 h-3.5 text-emerald-600" />
                                <span className="text-xs text-emerald-700 font-medium">
                                    {Number(selectedPromotion.max_budget).toLocaleString('fr-FR')} MAD cap
                                </span>
                            </div>
                        )}
                        {hasSchedule && (
                            <div className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-lg">
                                <Clock className="w-3.5 h-3.5 text-blue-500" />
                                <span className="text-xs text-blue-700 font-medium">
                                    Happy Hours{selectedPromotion.daily_start_time ? ` ${selectedPromotion.daily_start_time?.slice(0,5)}–${selectedPromotion.daily_end_time?.slice(0,5)}` : ''}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-6">
                <div className="space-y-4 max-w-4xl">
                    <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                        <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                            <div className="w-1 h-5 bg-purple-500 rounded-full"></div>
                            Informations Générales
                        </h3>
                        <div className="grid grid-cols-3 gap-4">
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1 font-medium">Code</p>
                                <p className="font-semibold text-gray-900 font-mono">{selectedPromotion.code}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1 font-medium">Séquence</p>
                                <p className="font-semibold text-gray-900">{selectedPromotion.sequence}</p>
                            </div>
                            <div className="p-3 bg-gray-50 rounded-lg">
                                <p className="text-xs text-gray-600 mb-1 font-medium">Règles</p>
                                <p className="font-semibold text-gray-900">{selectedPromotion.lines?.length || 0} ligne(s)</p>
                            </div>
                        </div>
                        {selectedPromotion.description && (
                            <div className="mt-4">
                                <p className="text-xs text-gray-600 mb-1">Description</p>
                                <p className="text-gray-700">{selectedPromotion.description}</p>
                            </div>
                        )}
                    </div>

                    {selectedPromotion.usage_count !== undefined && (
                        <div className="bg-white rounded-lg border border-gray-200 p-6 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-1 h-5 bg-sage-500 rounded-full"></div>
                                Statistiques d'Utilisation
                            </h3>
                            <div className="grid grid-cols-2 gap-4">
                                <div className="p-5 bg-gradient-to-br from-sage-50 to-sage-100/50 rounded-lg border border-sage-200/50">
                                    <p className="text-xs text-sage-700 font-semibold uppercase tracking-wide">Utilisations</p>
                                    <p className="text-3xl font-bold text-sage-900 mt-2">{selectedPromotion.usage_count}</p>
                                </div>
                                <div className="p-5 bg-gradient-to-br from-green-50 to-green-100/50 rounded-lg border border-green-200/50">
                                    <p className="text-xs text-green-700 font-semibold uppercase tracking-wide">Remise Totale</p>
                                    <p className="text-3xl font-bold text-green-900 mt-2">{selectedPromotion.total_discount?.toLocaleString()} <span className="text-lg">MAD</span></p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Budget Cap */}
                    {selectedPromotion.max_budget && Number(selectedPromotion.max_budget) > 0 && (() => {
                        const max = Number(selectedPromotion.max_budget);
                        const spent = Number(selectedPromotion.current_spent ?? 0);
                        const pct = Math.min((spent / max) * 100, 100);
                        const isExhausted = Boolean(selectedPromotion.budget_exhausted_at);
                        const barColor = isExhausted ? 'bg-red-500' : pct >= 90 ? 'bg-orange-500' : pct >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
                        return (
                            <div className={`bg-white rounded-lg border p-6 shadow-sm ${isExhausted ? 'border-red-300' : 'border-gray-200'}`}>
                                <h3 className="text-base font-semibold text-gray-900 mb-4 flex items-center gap-2">
                                    <div className={`w-1 h-5 rounded-full ${isExhausted ? 'bg-red-500' : 'bg-emerald-500'}`}></div>
                                    <Banknote className={`w-4 h-4 ${isExhausted ? 'text-red-500' : 'text-emerald-600'}`} />
                                    Budget Campagne
                                    {isExhausted && (
                                        <span className="ml-auto text-xs font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                                            <AlertTriangle className="w-3 h-3" /> Budget épuisé
                                        </span>
                                    )}
                                </h3>
                                <div className="flex items-end justify-between mb-2">
                                    <div>
                                        <span className="text-2xl font-bold text-gray-900">{spent.toLocaleString('fr-FR', { minimumFractionDigits: 2 })}</span>
                                        <span className="text-sm text-gray-400 ml-1">/ {max.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} MAD</span>
                                    </div>
                                    <span className={`text-sm font-semibold ${isExhausted ? 'text-red-600' : pct >= 70 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {Math.round(pct)}%
                                    </span>
                                </div>
                                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full transition-all duration-700 ${barColor}`} style={{ width: `${pct}%` }} />
                                </div>
                                {isExhausted && selectedPromotion.budget_exhausted_at && (
                                    <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        Épuisé le {new Date(selectedPromotion.budget_exhausted_at).toLocaleString('fr-FR')} — Augmentez le budget pour réactiver la promo.
                                    </p>
                                )}
                            </div>
                        );
                    })()}
                </div>
            </div>
        </div>
    );
    })() : (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-purple-100 to-violet-200 flex items-center justify-center shadow-inner">
                <Tag className="w-9 h-9 text-purple-400" />
            </div>
            <div className="text-center">
                <p className="font-semibold text-gray-600">Aucune promotion sélectionnée</p>
                <p className="text-sm text-gray-400 mt-1">Choisissez une promotion dans la liste pour voir ses détails</p>
            </div>
            <button onClick={() => navigate('/promotions/new')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-xl hover:bg-purple-700 transition-colors shadow-sm mt-1">
                <Plus className="w-4 h-4" /> Nouvelle promotion
            </button>
        </div>
    );

    const ActionPanel = (
        <div className="flex flex-col h-full bg-white border-l border-gray-200 w-11 shrink-0 shadow-[0_0_15px_rgba(0,0,0,0.05)] z-40">
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <div className="w-full flex justify-center mb-1">
                    <div className="w-6 h-0.5 bg-purple-500 rounded-full opacity-50"></div>
                </div>
                <button
                    onClick={loadPromotions}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-gray-400 hover:text-gray-700 hover:bg-gray-50"
                    title="Actualiser"
                >
                    <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                </button>
            </div>
            <div className="flex flex-col gap-1 py-3 border-b border-gray-200">
                <button
                    onClick={() => navigate('/promotions/new')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="Nouvelle Promotion"
                >
                    <Plus className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/partner-families')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-sage-600 hover:text-sage-700 hover:bg-sage-50"
                    title="Famille Partenaires"
                >
                    <Users className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/product-families')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-purple-600 hover:text-purple-700 hover:bg-purple-50"
                    title="Famille Produits"
                >
                    <Package className="w-4 h-4" />
                </button>
                <button
                    onClick={() => navigate('/promotions/boosts')}
                    className="group relative w-8 h-8 flex items-center justify-center rounded-lg transition-all duration-200 mx-auto text-yellow-600 hover:text-yellow-700 hover:bg-yellow-50"
                    title="Boosts"
                >
                    <Zap className="w-4 h-4" />
                </button>
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {loading && !selectedPromotion ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                                <p>Chargement...</p>
                            </div>
                        ) : (
                            DetailView
                        )}
                    </div>
                }
                rightContent={ActionPanel}
            />

            <ConfirmationModal
                isOpen={showDeleteModal}
                onClose={() => setShowDeleteModal(false)}
                onConfirm={handleDeleteConfirm}
                title="Supprimer la promotion"
                description="Êtes-vous sûr de vouloir supprimer cette promotion ? Cette action est irréversible."
                confirmText="Supprimer"
                cancelText="Annuler"
                variant="danger"
                isLoading={isDeleting}
            />

            {isEditDrawerOpen && editingPromotionId && (
                <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm">
                    <div className="fixed inset-0 bg-white overflow-auto">
                        <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shadow-sm">
                            <h2 className="text-xl font-bold text-gray-900">Modifier la Promotion</h2>
                            <button
                                onClick={() => {
                                    setIsEditDrawerOpen(false);
                                    setEditingPromotionId(null);
                                    loadPromotions();
                                }}
                                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <PromotionFormRedesigned key={editingPromotionId} />
                    </div>
                </div>
            )}
        </>
    );
};
