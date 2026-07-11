import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { promotionsApi } from '@/services/api/promotionsApi';
import type { ProductFamilyBoost, ProductFamily, PartnerFamily } from '@/types/promotion.types';
import {
    Star, Plus, Pencil, Trash2, ChevronDown, Search, Loader2,
    Package, Users, RefreshCw, TrendingUp, X, AlertTriangle,
    Tag, ListTodo,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';

// ── Searchable dropdown ────────────────────────────────────────────────────────
const SearchableSelect = ({
    options, value, onChange, placeholder = 'Sélectionner…', disabled = false,
}: {
    options: { value: number; label: string }[];
    value: number;
    onChange: (v: number) => void;
    placeholder?: string;
    disabled?: boolean;
}) => {
    const [open, setOpen] = useState(false);
    const [search, setSearch] = useState('');
    const ref = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    const selected = options.find(o => o.value === value);
    const filtered = options.filter(o => o.label.toLowerCase().includes(search.toLowerCase()));

    useEffect(() => {
        const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);

    return (
        <div ref={ref} className="relative">
            <button
                type="button"
                disabled={disabled}
                onClick={() => { setOpen(o => !o); setSearch(''); setTimeout(() => inputRef.current?.focus(), 40); }}
                className={`w-full h-10 px-3 flex items-center justify-between border rounded-lg bg-white text-sm transition-colors
                    ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 border-gray-300'}`}
            >
                <span className={`truncate ${selected ? 'text-gray-900' : 'text-gray-400'}`}>
                    {selected?.label ?? placeholder}
                </span>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 shrink-0 ml-1 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-xl overflow-hidden">
                    <div className="p-1.5 border-b border-gray-100">
                        <div className="flex items-center gap-1.5 px-2 py-1.5 bg-gray-50 rounded-md border border-gray-200">
                            <Search className="w-3 h-3 text-gray-400 shrink-0" />
                            <input
                                ref={inputRef}
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="flex-1 text-xs bg-transparent outline-none placeholder-gray-400"
                                placeholder="Rechercher…"
                            />
                        </div>
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                        {filtered.length === 0 && <p className="text-xs text-gray-400 text-center py-3">Aucun résultat</p>}
                        {filtered.map(opt => (
                            <button
                                key={opt.value}
                                type="button"
                                onMouseDown={() => { onChange(opt.value); setOpen(false); setSearch(''); }}
                                className={`w-full text-left px-3 py-2 text-xs leading-snug transition-colors
                                    ${opt.value === value ? 'bg-amber-50 text-amber-800 font-semibold' : 'text-gray-700 hover:bg-gray-50'}`}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};

// ── Boost form modal ───────────────────────────────────────────────────────────
interface BoostFormState {
    product_family_id: number;
    partner_family_id: number;
    rank: number;
    boost_factor: number;
}

const FORM_DEFAULTS: BoostFormState = { product_family_id: 0, partner_family_id: 0, rank: 1, boost_factor: 1.0 };

const BoostFormModal = ({
    open, onClose, onSaved, editing, productFamilies, partnerFamilies, saving, onSubmit,
}: {
    open: boolean; onClose: () => void; onSaved: () => void;
    editing: ProductFamilyBoost | null;
    productFamilies: ProductFamily[]; partnerFamilies: PartnerFamily[];
    saving: boolean; onSubmit: (data: BoostFormState) => Promise<void>;
}) => {
    const [form, setForm] = useState<BoostFormState>(FORM_DEFAULTS);

    useEffect(() => {
        if (open) {
            setForm(editing ? {
                product_family_id: editing.product_family_id,
                partner_family_id: editing.partner_family_id,
                rank: editing.rank,
                boost_factor: Number(editing.boost_factor),
            } : FORM_DEFAULTS);
        }
    }, [open, editing]);

    if (!open) return null;

    const pfOptions = productFamilies.map(f => ({ value: f.id!, label: `${f.code} — ${f.name}` }));
    const partOptions = partnerFamilies.map(f => ({ value: f.id!, label: `${f.code} — ${f.name}` }));

    const valid = form.product_family_id > 0 && form.partner_family_id > 0 && form.rank >= 0 && form.boost_factor >= 0;

    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                    <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Star className="w-4 h-4 text-amber-600" />
                        </div>
                        <h2 className="text-base font-semibold text-gray-900">
                            {editing ? 'Modifier le Boost' : 'Nouveau Boost'}
                        </h2>
                    </div>
                    <button type="button" onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
                        <X className="w-4 h-4 text-gray-500" />
                    </button>
                </div>

                {/* Body */}
                <div className="px-6 py-5 space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            <Package className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                            Famille produit <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                            options={pfOptions}
                            value={form.product_family_id}
                            onChange={v => setForm(f => ({ ...f, product_family_id: v }))}
                            placeholder="Choisir une famille produit…"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                            <Users className="w-3.5 h-3.5 inline mr-1 text-gray-400" />
                            Famille partenaire <span className="text-red-500">*</span>
                        </label>
                        <SearchableSelect
                            options={partOptions}
                            value={form.partner_family_id}
                            onChange={v => setForm(f => ({ ...f, partner_family_id: v }))}
                            placeholder="Choisir un segment client…"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Rang d'affichage
                            </label>
                            <input
                                type="number"
                                min="0"
                                value={form.rank}
                                onChange={e => setForm(f => ({ ...f, rank: Number(e.target.value) }))}
                                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                                Plus bas = apparaît plus haut dans le catalogue
                            </p>
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-700 mb-1.5">
                                Facteur de boost
                            </label>
                            <input
                                type="number"
                                min="0"
                                max="999.999999"
                                step="0.1"
                                value={form.boost_factor}
                                onChange={e => setForm(f => ({ ...f, boost_factor: Number(e.target.value) }))}
                                className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-amber-400 focus:border-amber-400 outline-none"
                            />
                            <p className="text-[10px] text-gray-400 mt-1 leading-snug">
                                Départage à rang égal — plus élevé = devant
                            </p>
                        </div>
                    </div>

                    <div className="bg-amber-50 border border-amber-200 rounded-lg px-3 py-2.5 text-xs text-amber-800">
                        <Star className="w-3.5 h-3.5 inline mr-1.5 text-amber-500" />
                        Ce boost est <strong>visible instantanément</strong> sur le terrain — aucun délai de cache, pas de bouton publier.
                    </div>
                </div>

                {/* Footer */}
                <div className="flex gap-3 px-6 pb-5">
                    <button
                        type="button"
                        onClick={onClose}
                        className="flex-1 h-10 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                        Annuler
                    </button>
                    <button
                        type="button"
                        disabled={!valid || saving}
                        onClick={() => onSubmit(form)}
                        className="flex-1 h-10 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
                        {editing ? 'Enregistrer' : 'Créer le boost'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Delete confirmation ────────────────────────────────────────────────────────
const DeleteModal = ({ open, onClose, onConfirm, deleting }: {
    open: boolean; onClose: () => void; onConfirm: () => void; deleting: boolean;
}) => {
    if (!open) return null;
    return (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-600" />
                    </div>
                    <h3 className="font-semibold text-gray-900">Supprimer ce boost ?</h3>
                </div>
                <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                    Ce boost sera retiré, les produits reprendront leur ordre normal dans le catalogue vendeur. Continuer ?
                </p>
                <div className="flex gap-3">
                    <button onClick={onClose} className="flex-1 h-9 border border-gray-200 rounded-lg text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                        Annuler
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={deleting}
                        className="flex-1 h-9 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                    >
                        {deleting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Supprimer
                    </button>
                </div>
            </div>
        </div>
    );
};

// ── Promotions quick-nav sidebar ───────────────────────────────────────────────
const PromoNav = () => {
    const navigate = useNavigate();
    const { pathname } = useLocation();
    const links = [
        { label: 'Campagnes', route: '/promotions', icon: ListTodo, exact: true },
        { label: 'Familles Produits', route: '/promotions/product-families', icon: Package },
        { label: 'Familles Partenaires', route: '/promotions/partner-families', icon: Users },
        { label: 'Boosts Catalogue', route: '/promotions/boosts', icon: Star },
    ];
    return (
        <div className="h-full flex flex-col bg-white">
            <div className="px-4 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 bg-amber-100 rounded-lg flex items-center justify-center shrink-0">
                        <Tag className="w-3.5 h-3.5 text-amber-600" />
                    </div>
                    <div>
                        <h2 className="text-sm font-bold text-gray-900 leading-tight">Promotions</h2>
                        <p className="text-[10px] text-gray-400">Navigation module</p>
                    </div>
                </div>
            </div>
            <nav className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                {links.map(({ label, route, icon: Icon, exact }) => {
                    const active = exact ? pathname === route : pathname.startsWith(route);
                    return (
                        <button
                            key={route}
                            onClick={() => navigate(route)}
                            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors text-left
                                ${active
                                    ? 'bg-amber-50 text-amber-700 font-semibold'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`}
                        >
                            <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-amber-500' : 'text-gray-400'}`} />
                            {label}
                            {active && <div className="ml-auto w-1.5 h-1.5 rounded-full bg-amber-500" />}
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

// ── Main page ──────────────────────────────────────────────────────────────────
export const BoostsPage = () => {
    const [boosts, setBoosts] = useState<ProductFamilyBoost[]>([]);
    const [productFamilies, setProductFamilies] = useState<ProductFamily[]>([]);
    const [partnerFamilies, setPartnerFamilies] = useState<PartnerFamily[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);

    // Filters
    const [pfFilter, setPfFilter] = useState(0);
    const [partFilter, setPartFilter] = useState(0);

    // Modal state
    const [formOpen, setFormOpen] = useState(false);
    const [editingBoost, setEditingBoost] = useState<ProductFamilyBoost | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ProductFamilyBoost | null>(null);

    // Collapsed partner-family groups
    const [collapsed, setCollapsed] = useState<Set<number>>(new Set());

    const loadData = useCallback(async () => {
        setLoading(true);
        try {
            const [boostsData, pfData, partData] = await Promise.all([
                promotionsApi.getBoosts(),
                promotionsApi.getProductFamilies(),
                promotionsApi.getPartnerFamilies(),
            ]);
            setBoosts(boostsData.boosts || []);
            setProductFamilies(pfData.productFamilies || []);
            setPartnerFamilies(partData.partnerFamilies || []);
        } catch {
            toast.error('Échec du chargement des données');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadData(); }, [loadData]);

    // Filtered + sorted boosts
    const filtered = useMemo(() => {
        return boosts
            .filter(b => (!pfFilter || b.product_family_id === pfFilter))
            .filter(b => (!partFilter || b.partner_family_id === partFilter))
            .sort((a, b) => a.rank - b.rank);
    }, [boosts, pfFilter, partFilter]);

    // Group by partner family
    const groups = useMemo(() => {
        const map = new Map<number, { partnerFamily: PartnerFamily; boosts: ProductFamilyBoost[] }>();
        for (const b of filtered) {
            const pf = b.partnerFamily
                ? { id: b.partner_family_id, code: b.partnerFamily.code, name: b.partnerFamily.name }
                : partnerFamilies.find(p => p.id === b.partner_family_id);
            if (!pf) continue;
            if (!map.has(b.partner_family_id)) {
                map.set(b.partner_family_id, { partnerFamily: pf as PartnerFamily, boosts: [] });
            }
            map.get(b.partner_family_id)!.boosts.push(b);
        }
        return [...map.values()].sort((a, b) => (a.partnerFamily.code < b.partnerFamily.code ? -1 : 1));
    }, [filtered, partnerFamilies]);

    const toggleGroup = (id: number) => {
        setCollapsed(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const pfLookup = (id: number) => {
        const b = boosts.find(b => b.product_family_id === id && b.productFamily);
        if (b?.productFamily) return b.productFamily;
        return productFamilies.find(f => f.id === id);
    };

    const handleSubmit = async (data: BoostFormState) => {
        setSaving(true);
        try {
            if (editingBoost?.id) {
                await promotionsApi.updateBoost(editingBoost.id, data);
                toast.success('Boost mis à jour');
            } else {
                await promotionsApi.createBoost(data);
                toast.success('Boost créé');
            }
            setFormOpen(false);
            setEditingBoost(null);
            await loadData();
        } catch (err: any) {
            const msg = err?.response?.data?.message || 'Échec de l\'enregistrement';
            toast.error(msg);
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget?.id) return;
        setDeleting(true);
        try {
            await promotionsApi.deleteBoost(deleteTarget.id);
            toast.success('Boost supprimé');
            setDeleteTarget(null);
            await loadData();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la suppression');
        } finally {
            setDeleting(false);
        }
    };

    const pfOptions = productFamilies.map(f => ({ value: f.id!, label: `${f.code} — ${f.name}` }));
    const partOptions = partnerFamilies.map(f => ({ value: f.id!, label: `${f.code} — ${f.name}` }));

    const pageContent = (
        <div className="h-full overflow-y-auto bg-gradient-to-br from-slate-50 to-slate-100">
            {/* ── Page header ── */}
            <div className="bg-white border-b border-gray-200 shadow-sm">
                <div className="max-w-6xl mx-auto px-6 py-5">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center">
                                <Star className="w-5 h-5 text-amber-600" />
                            </div>
                            <div>
                                <h1 className="text-xl font-bold text-gray-900">Boosts Merchandising</h1>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    Poussez des familles produit en tête du catalogue mobile pour un segment client donné — aucun impact prix.
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={loadData}
                                disabled={loading}
                                className="h-9 w-9 flex items-center justify-center hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-40"
                                title="Actualiser"
                            >
                                <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                            <button
                                onClick={() => { setEditingBoost(null); setFormOpen(true); }}
                                className="h-9 px-4 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors shadow-sm"
                            >
                                <Plus className="w-4 h-4" />
                                Nouveau Boost
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6 space-y-4">
                {/* ── Stats strip ── */}
                <div className="grid grid-cols-3 gap-3">
                    {[
                        { label: 'Total boosts', value: boosts.length, icon: Star, color: 'text-amber-600', bg: 'bg-amber-50' },
                        { label: 'Familles produit boostées', value: new Set(boosts.map(b => b.product_family_id)).size, icon: Package, color: 'text-blue-600', bg: 'bg-blue-50' },
                        { label: 'Segments couverts', value: new Set(boosts.map(b => b.partner_family_id)).size, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
                    ].map(s => (
                        <div key={s.label} className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex items-center gap-3">
                            <div className={`w-8 h-8 ${s.bg} rounded-lg flex items-center justify-center shrink-0`}>
                                <s.icon className={`w-4 h-4 ${s.color}`} />
                            </div>
                            <div>
                                <p className="text-lg font-bold text-gray-900 leading-none">{s.value}</p>
                                <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
                            </div>
                        </div>
                    ))}
                </div>

                {/* ── Filters ── */}
                <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                    <div className="flex items-center gap-3">
                        <span className="text-xs font-medium text-gray-500 shrink-0">Filtrer :</span>
                        <div className="w-64">
                            <SearchableSelect
                                options={[{ value: 0, label: 'Toutes les familles produit' }, ...pfOptions]}
                                value={pfFilter}
                                onChange={setPfFilter}
                                placeholder="Famille produit…"
                            />
                        </div>
                        <div className="w-64">
                            <SearchableSelect
                                options={[{ value: 0, label: 'Tous les segments' }, ...partOptions]}
                                value={partFilter}
                                onChange={setPartFilter}
                                placeholder="Famille partenaire…"
                            />
                        </div>
                        {(pfFilter > 0 || partFilter > 0) && (
                            <button
                                onClick={() => { setPfFilter(0); setPartFilter(0); }}
                                className="text-xs text-gray-400 hover:text-gray-700 flex items-center gap-1 transition-colors"
                            >
                                <X className="w-3 h-3" /> Réinitialiser
                            </button>
                        )}
                        <div className="ml-auto text-xs text-gray-400">
                            {filtered.length} boost{filtered.length !== 1 ? 's' : ''}
                        </div>
                    </div>
                </div>

                {/* ── Content ── */}
                {loading ? (
                    <div className="bg-white rounded-xl border border-gray-200 flex items-center justify-center py-16">
                        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
                    </div>
                ) : groups.length === 0 ? (
                    <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center py-16 text-center">
                        <div className="w-14 h-14 bg-amber-50 rounded-full flex items-center justify-center mb-3">
                            <Star className="w-7 h-7 text-amber-300" />
                        </div>
                        <p className="text-gray-500 font-medium">Aucun boost configuré</p>
                        <p className="text-xs text-gray-400 mt-1 mb-5">Créez votre premier boost pour mettre des produits en avant dans le catalogue vendeur</p>
                        <button
                            onClick={() => { setEditingBoost(null); setFormOpen(true); }}
                            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
                        >
                            <Plus className="w-4 h-4" /> Nouveau Boost
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {groups.map(({ partnerFamily, boosts: groupBoosts }) => {
                            const isCollapsed = collapsed.has(partnerFamily.id!);
                            return (
                                <div key={partnerFamily.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    {/* Group header */}
                                    <button
                                        type="button"
                                        onClick={() => toggleGroup(partnerFamily.id!)}
                                        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50/60 transition-colors text-left"
                                    >
                                        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${isCollapsed ? '-rotate-90' : ''}`} />
                                        <div className="flex items-center gap-2 flex-1">
                                            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-100 rounded-lg">
                                                <Users className="w-3.5 h-3.5 text-purple-600" />
                                                <span className="text-xs font-bold text-purple-800">{partnerFamily.code}</span>
                                            </div>
                                            <span className="text-sm font-semibold text-gray-800">{partnerFamily.name}</span>
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium shrink-0">
                                            {groupBoosts.length} boost{groupBoosts.length !== 1 ? 's' : ''}
                                        </span>
                                    </button>

                                    {/* Group rows */}
                                    {!isCollapsed && (
                                        <table className="w-full border-collapse">
                                            <thead>
                                                <tr className="border-t border-gray-100 bg-gray-50/80">
                                                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 w-16">Rang</th>
                                                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2">Famille Produit</th>
                                                    <th className="text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wide px-4 py-2 w-32">Facteur Boost</th>
                                                    <th className="w-24 px-4 py-2" />
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {groupBoosts.map((boost, i) => {
                                                    const pf = boost.productFamily ?? pfLookup(boost.product_family_id);
                                                    const factor = Number(boost.boost_factor);
                                                    return (
                                                        <tr
                                                            key={boost.id}
                                                            className={`border-t border-gray-100 hover:bg-amber-50/30 transition-colors group ${i === groupBoosts.length - 1 ? '' : ''}`}
                                                        >
                                                            <td className="px-4 py-3">
                                                                <span className="inline-flex items-center justify-center w-7 h-7 bg-gray-100 text-gray-700 text-xs font-bold rounded-lg">
                                                                    {boost.rank}
                                                                </span>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="flex items-center gap-1.5 px-2 py-0.5 bg-blue-50 border border-blue-100 rounded-md">
                                                                        <Package className="w-3 h-3 text-blue-500" />
                                                                        <span className="text-xs font-bold text-blue-700">{pf?.code ?? '—'}</span>
                                                                    </div>
                                                                    <span className="text-sm text-gray-700">{pf?.name}</span>
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center gap-1.5">
                                                                    <TrendingUp className="w-3.5 h-3.5 text-green-500" />
                                                                    <span className={`text-sm font-semibold ${factor > 1 ? 'text-green-700' : 'text-gray-600'}`}>
                                                                        ×{factor.toFixed(2)}
                                                                    </span>
                                                                    {factor > 2 && (
                                                                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-700 rounded-full font-medium">Fort</span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                                    <button
                                                                        onClick={() => { setEditingBoost(boost); setFormOpen(true); }}
                                                                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                                                                        title="Modifier"
                                                                    >
                                                                        <Pencil className="w-3.5 h-3.5" />
                                                                    </button>
                                                                    <button
                                                                        onClick={() => setDeleteTarget(boost)}
                                                                        className="h-7 w-7 flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                                        title="Supprimer"
                                                                    >
                                                                        <Trash2 className="w-3.5 h-3.5" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* ── Modals ── */}
            <BoostFormModal
                open={formOpen}
                onClose={() => { setFormOpen(false); setEditingBoost(null); }}
                onSaved={loadData}
                editing={editingBoost}
                productFamilies={productFamilies}
                partnerFamilies={partnerFamilies}
                saving={saving}
                onSubmit={handleSubmit}
            />
            <DeleteModal
                open={deleteTarget !== null}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                deleting={deleting}
            />
        </div>
    );

    return (
        <MasterLayout
            leftContent={<PromoNav />}
            mainContent={pageContent}
        />
    );
};
