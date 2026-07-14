import { useState, useEffect, useMemo } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DetailCard } from '@/components/common/DetailCard';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { Promotion, PromotionLine, PromotionLineDetail } from '@/types/promotion.types';
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
    LayoutGrid,
    Percent,
    TrendingUp,
    Box,
    Gift,
    ArrowRight,
    Hash,
    FileText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfirmationModal } from '@/components/common/ConfirmationModal';
import { PromotionFormRedesigned } from './components/PromotionFormRedesigned';
import { cn } from '@/lib/utils';

// ─── Types ───────────────────────────────────────────────────────────────────

type StatusColor = 'gray' | 'red' | 'blue' | 'orange' | 'green';

interface StatusInfo {
    label: string;
    color: StatusColor;
}

// ─── Shared status helper (pure) ─────────────────────────────────────────────

const getPromoStatus = (p: Promotion): StatusInfo => {
    const now = new Date();
    if (p.is_closed)            return { label: 'Fermée',        color: 'gray'   };
    if (p.budget_exhausted_at)  return { label: 'Budget épuisé', color: 'red'    };
    if (new Date(p.start_date) > now) return { label: 'À venir', color: 'blue'   };
    if (new Date(p.end_date)   < now) return { label: 'Expirée', color: 'orange' };
    return { label: 'Active', color: 'green' };
};

const STATUS_STYLE: Record<StatusColor, { badge: string; dot: string; border: string; icon: string }> = {
    gray:   { badge: 'bg-gray-100 text-gray-700',     dot: 'bg-gray-500',   border: 'border-gray-200',   icon: 'text-gray-500'   },
    red:    { badge: 'bg-red-100 text-red-700',       dot: 'bg-red-500',    border: 'border-red-200',    icon: 'text-red-500'    },
    blue:   { badge: 'bg-blue-100 text-blue-700',     dot: 'bg-blue-500',   border: 'border-blue-200',   icon: 'text-blue-500'   },
    orange: { badge: 'bg-amber-100 text-amber-700',   dot: 'bg-amber-500',  border: 'border-amber-200',  icon: 'text-amber-500'  },
    green:  { badge: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500', border: 'border-emerald-200', icon: 'text-emerald-500' },
};

// ─── Promotion engine labels ─────────────────────────────────────────────────

const BREAKPOINT_LABELS: Record<number, { icon: React.ElementType; label: string; desc: string }> = {
    1: { icon: Box,        label: 'Quantité',   desc: 'Seuil en unités' },
    2: { icon: Banknote,   label: 'Valeur',     desc: 'Seuil en MAD' },
    3: { icon: TrendingUp, label: 'Unités Promo', desc: 'Poids pondéré' },
};

const SCALE_LABELS: Record<number, { icon: React.ElementType; label: string; desc: string }> = {
    1: { icon: Layers,     label: 'Cumulatif', desc: 'Paliers cumulés' },
    2: { icon: TrendingUp, label: 'Tranche',   desc: 'Palier le plus haut' },
};

const PROMO_TYPE_LABELS: Record<number, string> = {
    1: 'Remise %',
    2: 'Remise / unité',
    3: 'Meilleur prix',
    4: 'Unité gratuite',
    5: 'UP gratuite',
    6: 'Remise forfaitaire',
    7: 'Prix de remplacement',
    8: 'Moins cher gratuit',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateShort = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });

const formatCurrency = (value: number | string | undefined) =>
    Number(value ?? 0).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

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
    const BpIcon = BREAKPOINT_LABELS[promo.breakpoint_type]?.icon ?? Box;
    const SmIcon = SCALE_LABELS[promo.scale_method]?.icon ?? Layers;

    return (
        <button
            onClick={onClick}
            className={cn(
                'w-full text-left px-3 py-3 border-b border-gray-100 transition-all group',
                selected
                    ? 'bg-purple-50/80 border-l-[3px] border-l-purple-600'
                    : 'border-l-[3px] border-l-transparent hover:bg-slate-50'
            )}
        >
            {/* Name + status */}
            <div className="flex items-start justify-between gap-2 mb-1">
                <span className={cn(
                    'text-xs font-semibold leading-tight flex-1 min-w-0 truncate',
                    selected ? 'text-purple-900' : 'text-gray-800'
                )}>
                    {promo.name}
                </span>
                <span className={cn('shrink-0 text-[10px] px-1.5 py-0.5 rounded-full flex items-center gap-1 border', style.badge, style.border)}>
                    <span className={cn('w-1.5 h-1.5 rounded-full', style.dot)} />
                    {status.label}
                </span>
            </div>

            {/* Code + dates */}
            <div className="flex items-center gap-1.5 mb-2">
                <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded shrink-0">
                    {promo.code}
                </span>
                <span className="text-[10px] text-gray-300">·</span>
                <span className="text-[10px] text-gray-400 truncate">
                    {formatDateShort(promo.start_date)} → {formatDateShort(promo.end_date)}
                </span>
            </div>

            {/* Tags */}
            <div className="flex items-center gap-1 flex-wrap">
                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-indigo-50 text-indigo-600 rounded-full flex items-center gap-1">
                    <BpIcon className="w-3 h-3" />
                    {BREAKPOINT_LABELS[promo.breakpoint_type]?.label ?? '—'}
                </span>
                <span className="text-[9px] font-medium px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded-full flex items-center gap-1">
                    <SmIcon className="w-3 h-3" />
                    {SCALE_LABELS[promo.scale_method]?.label ?? '—'}
                </span>
                {(promo.lines?.length ?? 0) > 0 && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded-full flex items-center gap-1">
                        <Hash className="w-3 h-3" />
                        {promo.lines?.length} règle{(promo.lines?.length ?? 0) !== 1 ? 's' : ''}
                    </span>
                )}
                {hasSchedule && (
                    <span className="text-[9px] font-medium px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded-full flex items-center gap-1" title="Happy Hours actif">
                        <Clock className="w-3 h-3" /> HH
                    </span>
                )}
            </div>

            {/* Budget bar */}
            {hasBudget && (
                <div className="mt-2.5">
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', barColor)} style={{ width: `${budgetPct}%` }} />
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

// ─── Rule detail row ─────────────────────────────────────────────────────────

const RuleDetailRow = ({ detail, index }: { detail: PromotionLineDetail; index: number }) => {
    const typeLabel = PROMO_TYPE_LABELS[detail.promo_type] ?? `Type ${detail.promo_type ?? '?'}`;
    return (
        <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
            <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-purple-50 text-purple-600 text-[10px] font-bold flex items-center justify-center">
                    {index + 1}
                </span>
                <span className="text-xs font-medium text-gray-700">{typeLabel}</span>
            </div>
            <div className="flex items-center gap-3 text-[11px] text-gray-500">
                <span className="flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" />
                    Seuil {Number(detail.minimum_value ?? 0).toLocaleString('fr-FR')}
                </span>
                <span className="flex items-center gap-1">
                    <Gift className="w-3 h-3" />
                    {Number(detail.amount ?? 0).toLocaleString('fr-FR')}
                    {detail.promo_type === 1 || detail.promo_type === 2 ? ' MAD' : '%'}
                </span>
                {detail.repeating && (
                    <span className="px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded-full text-[9px] font-medium">
                        Répétable
                    </span>
                )}
            </div>
        </div>
    );
};

const RuleCard = ({ line, index }: { line: PromotionLine; index: number }) => {
    const targetLabel =
        line.paid_based_on_product === 'cart'
            ? 'Panier entier'
            : line.paid_based_on_product === 'family'
            ? `Famille ${line.paid_product_family_code ?? '—'}`
            : `Produit ${line.paid_product_code ?? '—'}`;

    return (
        <div className="border border-gray-100 rounded-lg p-3 bg-white hover:border-purple-200 transition-colors">
            <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span className="w-6 h-6 rounded-md bg-purple-100 text-purple-700 text-xs font-bold flex items-center justify-center shrink-0">
                        {line.line_number ?? index + 1}
                    </span>
                    <span className="text-sm font-semibold text-gray-900 truncate">{line.name}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full shrink-0">
                    {targetLabel}
                </span>
            </div>
            <div className="space-y-0.5">
                {(line.details ?? []).map((detail, idx) => (
                    <RuleDetailRow key={idx} detail={detail} index={idx} />
                ))}
                {(line.details ?? []).length === 0 && (
                    <p className="text-[11px] text-gray-400 italic py-1">Aucun palier défini</p>
                )}
            </div>
        </div>
    );
};

// ─── Main page ───────────────────────────────────────────────────────────────

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
        <div className="h-full flex flex-col bg-white border-r border-gray-200">
            {/* ── Header ──────────────────────────────────── */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-purple-600 flex items-center justify-center shadow-sm">
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
                        { key: 'all',              label: 'Toutes',        activeCls: 'text-purple-700 border-purple-300 bg-purple-50' },
                        { key: 'active',           label: 'Active',        activeCls: 'text-emerald-700 border-emerald-300 bg-emerald-50' },
                        { key: 'upcoming',         label: 'À venir',       activeCls: 'text-blue-700 border-blue-300 bg-blue-50' },
                        { key: 'expired',          label: 'Expirée',       activeCls: 'text-amber-700 border-amber-300 bg-amber-50' },
                        { key: 'budget_exhausted', label: 'Budget',        activeCls: 'text-red-700 border-red-300 bg-red-50' },
                    ] as const).map(f => (
                        <button key={f.key} onClick={() => setStatusFilter(f.key)}
                            className={cn(
                                'px-2 py-0.5 text-[10px] font-semibold rounded-full border transition-all',
                                statusFilter === f.key ? f.activeCls : 'text-gray-500 border-gray-200 bg-white hover:border-gray-300'
                            )}>
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
        const bp = BREAKPOINT_LABELS[selectedPromotion.breakpoint_type] ?? BREAKPOINT_LABELS[1];
        const sm = SCALE_LABELS[selectedPromotion.scale_method] ?? SCALE_LABELS[1];
        const BpIcon = bp.icon;
        const SmIcon = sm.icon;
        const hasBudget = selectedPromotion.max_budget && Number(selectedPromotion.max_budget) > 0;
        const hasSchedule = (selectedPromotion.active_days && selectedPromotion.active_days.length > 0) || selectedPromotion.daily_start_time;
        const isExhausted = Boolean(selectedPromotion.budget_exhausted_at);
        const budgetMax = Number(selectedPromotion.max_budget ?? 0);
        const budgetSpent = Number(selectedPromotion.current_spent ?? 0);
        const budgetPct = budgetMax > 0 ? Math.min((budgetSpent / budgetMax) * 100, 100) : 0;

        return (
        <div className="flex flex-col h-full bg-slate-50/60 overflow-hidden">
            {/* ── ERP header with breadcrumbs ─────────────── */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-4 py-3">
                <div className="flex flex-col gap-2.5">
                    <div className="flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2 min-w-0">
                            <div className="hidden sm:flex w-8 h-8 rounded-md bg-purple-600 items-center justify-center text-white shadow-sm shrink-0">
                                <Tag className="w-3.5 h-3.5" />
                            </div>
                            <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                    <h1 className="text-sm font-bold text-gray-900 truncate">{selectedPromotion.name}</h1>
                                    <span className={cn('text-[10px] px-2 py-0.5 rounded-full font-semibold flex items-center gap-1 border', st.badge, st.border)}>
                                        <span className={cn('w-1.5 h-1.5 rounded-full', st.dot)} /> {status.label}
                                    </span>
                                </div>
                                {selectedPromotion.description && (
                                    <p className="text-[11px] text-gray-500 truncate">{selectedPromotion.description}</p>
                                )}
                            </div>
                        </div>

                        <nav className="hidden sm:flex items-center gap-1 text-[11px] text-gray-500 shrink-0">
                            <Link to="/dashboard" className="hover:text-purple-600 transition-colors">Tableau de bord</Link>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <Link to="/promotions" className="hover:text-purple-600 transition-colors">Promotions</Link>
                            <ChevronRight className="w-3 h-3 text-gray-300" />
                            <span className="text-gray-700 font-medium">{selectedPromotion.code}</span>
                        </nav>
                    </div>

                    {/* Module sub-navigation */}
                    <nav className="flex flex-wrap items-center gap-1">
                        {[
                            { id: 'hub', label: 'Hub', route: '/promotions', icon: LayoutGrid },
                            { id: 'promotions', label: 'Promotions', route: '/promotions', icon: Tag },
                            { id: 'partnerFamilies', label: 'Familles Partenaires', route: '/promotions/partner-families', icon: Users },
                            { id: 'productFamilies', label: 'Familles Produits', route: '/promotions/product-families', icon: Package },
                            { id: 'boosts', label: 'Boosts', route: '/promotions/boosts', icon: Zap },
                        ].map((item) => {
                            const isActive = item.id === 'promotions';
                            return (
                                <Link
                                    key={item.id}
                                    to={item.route}
                                    className={cn(
                                        'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium transition-all border',
                                        isActive
                                            ? 'bg-purple-50 text-purple-700 border-purple-200 shadow-sm'
                                            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-700 border-transparent'
                                    )}
                                >
                                    <item.icon className={cn('w-3.5 h-3.5', isActive ? 'text-purple-600' : 'text-gray-400')} />
                                    {item.label}
                                </Link>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4">
                <div className="space-y-4 max-w-5xl">
                    {/* ── KPI metric grid ───────────────────────── */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
                                    <CalendarRange className="w-3.5 h-3.5 text-blue-600" />
                                </div>
                                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Période</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">
                                {formatDateShort(selectedPromotion.start_date)} <ArrowRight className="w-3 h-3 inline text-gray-300 mx-0.5" /> {formatDateShort(selectedPromotion.end_date)}
                            </p>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-indigo-50 flex items-center justify-center">
                                    <BpIcon className="w-3.5 h-3.5 text-indigo-600" />
                                </div>
                                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Seuil</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{bp.label}</p>
                            <p className="text-[10px] text-gray-400">{bp.desc}</p>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-slate-50 flex items-center justify-center">
                                    <SmIcon className="w-3.5 h-3.5 text-slate-600" />
                                </div>
                                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Méthode</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{sm.label}</p>
                            <p className="text-[10px] text-gray-400">{sm.desc}</p>
                        </div>

                        <div className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
                            <div className="flex items-center gap-2 mb-2">
                                <div className="w-7 h-7 rounded-lg bg-purple-50 flex items-center justify-center">
                                    <Layers className="w-3.5 h-3.5 text-purple-600" />
                                </div>
                                <span className="text-[11px] font-medium text-gray-500 uppercase tracking-wide">Règles</span>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{selectedPromotion.lines?.length ?? 0}</p>
                            <p className="text-[10px] text-gray-400">ligne(s) configurée(s)</p>
                        </div>
                    </div>

                    {/* ── General info + stats ───────────────────── */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <DetailCard title="Informations Générales" icon={FileText} className="lg:col-span-2">
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Code</p>
                                    <p className="font-semibold text-gray-900 font-mono text-sm">{selectedPromotion.code}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Séquence</p>
                                    <p className="font-semibold text-gray-900 text-sm">{selectedPromotion.sequence}</p>
                                </div>
                                <div className="p-3 bg-gray-50 rounded-lg">
                                    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Règles</p>
                                    <p className="font-semibold text-gray-900 text-sm">{selectedPromotion.lines?.length || 0} ligne(s)</p>
                                </div>
                            </div>
                            {selectedPromotion.description && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Description</p>
                                    <p className="text-sm text-gray-700 leading-relaxed">{selectedPromotion.description}</p>
                                </div>
                            )}
                            {hasSchedule && (
                                <div className="mt-4 pt-4 border-t border-gray-100">
                                    <p className="text-[11px] text-gray-500 mb-1 font-medium uppercase tracking-wide">Happy Hours</p>
                                    <p className="text-sm text-gray-700 flex items-center gap-2">
                                        <Clock className="w-3.5 h-3.5 text-blue-500" />
                                        {selectedPromotion.active_days && selectedPromotion.active_days.length > 0
                                            ? `Jours ${selectedPromotion.active_days.map(d => ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'][d - 1]).join(', ')}`
                                            : 'Tous les jours'}
                                        {selectedPromotion.daily_start_time && ` · ${selectedPromotion.daily_start_time.slice(0, 5)} – ${selectedPromotion.daily_end_time?.slice(0, 5)}`}
                                    </p>
                                </div>
                            )}
                        </DetailCard>

                        {selectedPromotion.usage_count !== undefined ? (
                            <DetailCard title="Statistiques" icon={Percent} accent="sage">
                                <div className="space-y-3">
                                    <div className="p-3 bg-sage-50 rounded-lg border border-sage-100">
                                        <p className="text-[11px] text-sage-700 font-semibold uppercase tracking-wide">Utilisations</p>
                                        <p className="text-2xl font-bold text-sage-900 mt-1">{selectedPromotion.usage_count}</p>
                                    </div>
                                    <div className="p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                                        <p className="text-[11px] text-emerald-700 font-semibold uppercase tracking-wide">Remise Totale</p>
                                        <p className="text-2xl font-bold text-emerald-900 mt-1">
                                            {selectedPromotion.total_discount?.toLocaleString()} <span className="text-sm font-medium">MAD</span>
                                        </p>
                                    </div>
                                </div>
                            </DetailCard>
                        ) : (
                            <DetailCard title="Statistiques" icon={Percent} accent="sage">
                                <div className="flex flex-col items-center justify-center py-6 text-center text-gray-400">
                                    <Percent className="w-8 h-8 mb-2 opacity-20" />
                                    <p className="text-xs">Aucune statistique disponible</p>
                                </div>
                            </DetailCard>
                        )}
                    </div>

                    {/* ── Budget Cap ───────────────────────────────── */}
                    {hasBudget && (
                        <DetailCard
                            title="Budget Campagne"
                            icon={Banknote}
                            accent={isExhausted ? 'red' : 'green'}
                            rightContent={isExhausted ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 bg-red-100 text-red-700 rounded-full flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> Budget épuisé
                                </span>
                            ) : undefined}
                        >
                            <div className="flex items-end justify-between mb-2">
                                <div>
                                    <span className="text-2xl font-bold text-gray-900">{formatCurrency(budgetSpent)}</span>
                                    <span className="text-sm text-gray-400 ml-1">/ {formatCurrency(budgetMax)} MAD</span>
                                </div>
                                <span className={cn(
                                    'text-sm font-semibold',
                                    isExhausted ? 'text-red-600' : budgetPct >= 70 ? 'text-amber-600' : 'text-emerald-600'
                                )}>
                                    {Math.round(budgetPct)}%
                                </span>
                            </div>
                            <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                                <div
                                    className={cn(
                                        'h-full rounded-full transition-all duration-700',
                                        isExhausted ? 'bg-red-500' : budgetPct >= 90 ? 'bg-orange-500' : budgetPct >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                                    )}
                                    style={{ width: `${budgetPct}%` }}
                                />
                            </div>
                            {isExhausted && selectedPromotion.budget_exhausted_at && (
                                <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    Épuisé le {new Date(selectedPromotion.budget_exhausted_at).toLocaleString('fr-FR')} — Augmentez le budget pour réactiver la promo.
                                </p>
                            )}
                        </DetailCard>
                    )}

                    {/* ── Rules preview ───────────────────────────── */}
                    <DetailCard title="Règles de Promotion" icon={Layers}>
                        <div className="space-y-3">
                            {(selectedPromotion.lines ?? []).map((line, idx) => (
                                <RuleCard key={idx} line={line} index={idx} />
                            ))}
                            {(selectedPromotion.lines ?? []).length === 0 && (
                                <div className="flex flex-col items-center justify-center py-8 text-gray-400 text-center">
                                    <Layers className="w-10 h-10 mb-2 opacity-15" />
                                    <p className="text-xs font-medium">Aucune règle configurée</p>
                                    <p className="text-[10px] mt-0.5">Modifiez la promotion pour ajouter des paliers.</p>
                                </div>
                            )}
                        </div>
                    </DetailCard>
                </div>
            </div>
        </div>
        );
    })() : (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-3 bg-slate-50/60">
            <div className="w-20 h-20 rounded-2xl bg-purple-100 flex items-center justify-center shadow-inner">
                <Tag className="w-9 h-9 text-purple-400" />
            </div>
            <div className="text-center">
                <p className="font-semibold text-gray-600">Aucune promotion sélectionnée</p>
                <p className="text-sm text-gray-400 mt-1">Choisissez une promotion dans la liste pour voir ses détails</p>
            </div>
            <button onClick={() => navigate('/promotions/new')}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition-colors shadow-sm mt-1">
                <Plus className="w-4 h-4" /> Nouvelle promotion
            </button>
        </div>
    );

    const actionPanelGroups = [
        {
            items: [
                { icon: RefreshCw, label: 'Actualiser', onClick: loadPromotions, variant: 'default' as const },
            ],
        },
        {
            items: [
                { icon: Plus, label: 'Nouvelle Promotion', onClick: () => navigate('/promotions/new'), variant: 'primary' as const },
                { icon: Users, label: 'Familles Partenaires', onClick: () => navigate('/promotions/partner-families'), variant: 'sage' as const },
                { icon: Package, label: 'Familles Produits', onClick: () => navigate('/promotions/product-families'), variant: 'primary' as const },
                { icon: Zap, label: 'Boosts', onClick: () => navigate('/promotions/boosts'), variant: 'warning' as const },
            ],
        },
    ];

    return (
        <>
            <MasterLayout
                leftContent={<div className="h-full w-full overflow-hidden flex flex-col">{SidebarContent}</div>}
                mainContent={
                    <div className="h-full overflow-hidden flex flex-col">
                        {loading && !selectedPromotion ? (
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 bg-slate-50/60">
                                <Loader2 className="w-8 h-8 animate-spin mb-2 text-purple-500" />
                                <p>Chargement...</p>
                            </div>
                        ) : (
                            DetailView
                        )}
                    </div>
                }
                rightContent={<ActionPanel groups={actionPanelGroups} />}
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
