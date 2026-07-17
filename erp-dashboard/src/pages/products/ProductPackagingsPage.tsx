import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Box, Search, X, RefreshCw, Edit2, Save, CheckCircle2,
    Plus, Trash2, ArrowLeft, Star,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { productsApi } from '@/services/api/productsApi';
import type { Product, ProductPackaging, Unit } from '@/types/product.types';

// ─── Form state ───────────────────────────────────────────────────────────────

interface PackagingForm {
    unit_id: string;
    quantity: string;
    theoretical_weight: string;
    is_default: boolean;
    packaging_level_id: string;
}

const EMPTY_FORM: PackagingForm = {
    unit_id: '',
    quantity: '1',
    theoretical_weight: '',
    is_default: false,
    packaging_level_id: '',
};

function fromPkg(pkg: ProductPackaging): PackagingForm {
    return {
        unit_id: String(pkg.unit_id),
        quantity: String(pkg.quantity),
        theoretical_weight: pkg.theoretical_weight != null ? String(pkg.theoretical_weight) : '',
        is_default: pkg.is_default,
        packaging_level_id: pkg.packaging_level_id != null ? String(pkg.packaging_level_id) : '',
    };
}

function errMsg(err: unknown): string {
    if (isAxiosError(err)) return err.response?.data?.message ?? err.message;
    if (err instanceof Error) return err.message;
    return 'Une erreur est survenue.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductPackagingsPage() {
    // Products + meta
    const [products, setProducts] = useState<Product[]>([]);
    const [units, setUnits] = useState<Unit[]>([]);
    const [loadingMeta, setLoadingMeta] = useState(false);
    const [search, setSearch] = useState('');
    const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

    // Selected product
    const [viewSelected, setViewSelected] = useState<Product | null>(null);
    const [packagings, setPackagings] = useState<ProductPackaging[]>([]);
    const [loadingPkgs, setLoadingPkgs] = useState(false);

    // Form
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');
    const [editTarget, setEditTarget] = useState<ProductPackaging | null>(null);
    const [form, setForm] = useState<PackagingForm>(EMPTY_FORM);
    const [saving, setSaving] = useState(false);

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<ProductPackaging | null>(null);
    const [deleting, setDeleting] = useState(false);

    // ── Load metadata (products with has_colisage + units) ─────────────────────
    const loadMeta = useCallback(async () => {
        setLoadingMeta(true);
        try {
            const res = await productsApi.getPackagingFormMetadata();
            setProducts((res as any).products ?? []);
            setUnits((res as any).units ?? []);
        } catch (err) {
            toast.error(errMsg(err));
        } finally {
            setLoadingMeta(false);
        }
    }, []);

    useEffect(() => { loadMeta(); }, [loadMeta]);

    // ── Load packagings for selected product ───────────────────────────────────
    const loadPkgs = useCallback(async (id: number) => {
        setLoadingPkgs(true);
        try {
            const res = await productsApi.getPackagings(id);
            setPackagings((res as any).packagings ?? (res as any).data ?? []);
        } catch {
            setPackagings([]);
        } finally {
            setLoadingPkgs(false);
        }
    }, []);

    useEffect(() => {
        if (!viewSelected) { setPackagings([]); setFormMode('view'); return; }
        setFormMode('view');
        setEditTarget(null);
        loadPkgs(viewSelected.id);
    }, [viewSelected, loadPkgs]);

    // ── Client-side search filter ──────────────────────────────────────────────
    const filteredProducts = useMemo(() => {
        if (!search.trim()) return products;
        const q = search.toLowerCase();
        return products.filter(p => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q));
    }, [products, search]);

    const rowData = useMemo(
        () => filteredProducts.map(p => ({ ...p, _saved: savedIds.has(p.id) })),
        [filteredProducts, savedIds]
    );

    // ── Form actions ───────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setFormMode('create');
    };

    const openEdit = (pkg: ProductPackaging) => {
        setEditTarget(pkg);
        setForm(fromPkg(pkg));
        setFormMode('edit');
    };

    const cancelForm = () => {
        setEditTarget(null);
        setForm(EMPTY_FORM);
        setFormMode('view');
    };

    // ── Save ───────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!viewSelected) return;
        const unitId = Number(form.unit_id);
        const qty = Number(form.quantity);
        if (!unitId || !qty) { toast.error('Unité et quantité sont requis'); return; }
        setSaving(true);
        try {
            const payload = {
                unit_id: unitId,
                quantity: qty,
                is_default: form.is_default,
                packaging_level_id: form.packaging_level_id ? Number(form.packaging_level_id) : null,
                theoretical_weight: form.theoretical_weight ? Number(form.theoretical_weight) : null,
            };
            if (formMode === 'create') {
                await productsApi.createPackaging({ product_id: viewSelected.id, ...payload });
                toast.success('Conditionnement créé');
            } else if (editTarget) {
                await productsApi.updatePackaging(editTarget.id, payload);
                toast.success('Conditionnement mis à jour');
            }
            setSavedIds(prev => new Set(prev).add(viewSelected.id));
            cancelForm();
            await loadPkgs(viewSelected.id);
        } catch (err) {
            toast.error(errMsg(err));
        } finally {
            setSaving(false);
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!deleteTarget || !viewSelected) return;
        setDeleting(true);
        try {
            await productsApi.deletePackaging(deleteTarget.id);
            toast.success('Conditionnement supprimé');
            setSavedIds(prev => new Set(prev).add(viewSelected.id));
            setDeleteTarget(null);
            await loadPkgs(viewSelected.id);
        } catch (err) {
            toast.error(errMsg(err));
        } finally {
            setDeleting(false);
        }
    };

    // ── Unit name helper ───────────────────────────────────────────────────────
    const getUnitName = (unitId: number) => {
        const u = units.find(u => u.id === unitId);
        return u?.name ?? `Unité #${unitId}`;
    };

    // ── DataGrid columns ───────────────────────────────────────────────────────
    const productCols = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            colId: 'code', headerName: 'Code', width: 90,
            sortable: true, resizable: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center gap-1.5 h-full">
                    {p.data?._saved
                        ? <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                        : <div className="shrink-0" style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.data?.is_active ? '#10b981' : '#d1d5db' }} />
                    }
                    <span style={{ fontFamily: 'monospace', fontSize: '11px', fontWeight: 600, color: '#4338ca' }}>
                        {p.data?.code ?? '—'}
                    </span>
                </div>
            ),
        },
        {
            field: 'name', headerName: 'Produit', flex: 1, minWidth: 80,
            sortable: true, resizable: false,
            cellStyle: { fontSize: '12px', fontWeight: 500, color: '#111827' },
        },
    ], []);

    // ── Action panel ───────────────────────────────────────────────────────────
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode !== 'view') {
            return [{ items: [
                { icon: Save, label: 'Sauvegarder', variant: 'primary', onClick: handleSave, disabled: saving },
                { icon: X,    label: 'Annuler',     variant: 'warning', onClick: cancelForm },
            ]}];
        }
        const items: ActionItemProps[] = [
            { icon: RefreshCw, label: 'Actualiser', onClick: loadMeta, disabled: loadingMeta },
        ];
        if (viewSelected) {
            items.unshift({ icon: Plus, label: 'Nouveau conditionnement', variant: 'primary', onClick: openCreate });
        }
        return [{ items }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formMode, viewSelected, saving, loadingMeta]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Box className="w-4 h-4 text-amber-600" />
                                    <h2 className="text-sm font-bold text-gray-900">Produits (colisage)</h2>
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-amber-50 text-amber-600 border border-amber-100">
                                        {filteredProducts.length}
                                    </span>
                                </div>
                                {savedIds.size > 0 && (
                                    <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                                        <CheckCircle2 className="w-3 h-3" /> {savedIds.size}
                                    </span>
                                )}
                            </div>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                                <input
                                    type="text" value={search}
                                    onChange={e => setSearch(e.target.value)}
                                    placeholder="Chercher un produit…"
                                    className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-gray-50/70 transition-all"
                                />
                                {search && (
                                    <button onClick={() => setSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <DataGrid
                                rowData={rowData}
                                columnDefs={productCols}
                                loading={loadingMeta}
                                rowSelection="single"
                                suppressAutoFit
                                onRowClicked={e => { if (e.data) setViewSelected(e.data); }}
                                defaultSelectedIds={row => row.id === viewSelected?.id}
                            />
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full bg-slate-50/60 flex flex-col overflow-hidden">
                        {/* Fixed header */}
                        <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                <Box className="w-4 h-4" />
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <h1 className="text-sm font-bold text-gray-900">
                                        {viewSelected ? viewSelected.name : 'Colisage Produits'}
                                    </h1>
                                    {viewSelected && (
                                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                            {viewSelected.code}
                                        </span>
                                    )}
                                    {viewSelected && !loadingPkgs && (
                                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full border text-amber-700 bg-amber-50 border-amber-200">
                                            {packagings.length} conditionnement{packagings.length !== 1 ? 's' : ''}
                                        </span>
                                    )}
                                    {formMode !== 'view' && (
                                        <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                            {formMode === 'create' ? 'Nouveau' : 'Édition'}
                                        </span>
                                    )}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">
                                    {viewSelected
                                        ? 'Unités de commande associées à ce produit (has_colisage)'
                                        : 'Sélectionnez un produit dans la liste pour gérer ses conditionnements'}
                                </p>
                            </div>
                        </div>

                        {/* Scrollable content */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {!viewSelected ? (
                                /* Empty state — no product selected */
                                <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                    <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                        <Box className="w-10 h-10 text-gray-200" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-700">Aucun produit sélectionné</p>
                                        <p className="text-xs text-gray-400 mt-1">Cliquez sur un produit dans la liste à gauche</p>
                                    </div>
                                </div>
                            ) : loadingPkgs ? (
                                /* Skeleton */
                                <div className="space-y-3 max-w-2xl">
                                    {[1, 2].map(i => (
                                        <div key={i} className="h-20 bg-white rounded-xl border border-gray-200 animate-pulse" />
                                    ))}
                                </div>
                            ) : formMode === 'view' ? (
                                /* View mode */
                                <div className="max-w-2xl space-y-3">
                                    {packagings.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center gap-4 py-16">
                                            <div className="w-14 h-14 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                                <Box className="w-7 h-7 text-gray-200" />
                                            </div>
                                            <div className="text-center">
                                                <p className="text-sm font-semibold text-gray-700">Aucun conditionnement</p>
                                                <p className="text-xs text-gray-400 mt-1">Ce produit n'a pas encore d'unités de commande.</p>
                                            </div>
                                            <Button size="sm" onClick={openCreate} className="bg-amber-600 hover:bg-amber-700">
                                                <Plus className="w-3.5 h-3.5 mr-1.5" /> Ajouter un conditionnement
                                            </Button>
                                        </div>
                                    ) : (
                                        <>
                                            {packagings.map(pkg => {
                                                const uName = getUnitName(pkg.unit_id);
                                                return (
                                                    <div key={pkg.id} className="bg-white rounded-xl border border-gray-200 p-4 group hover:border-amber-300 hover:shadow-sm transition-all">
                                                        <div className="flex items-start gap-3">
                                                            <div className="w-9 h-9 rounded-lg bg-amber-50 border border-amber-100 flex items-center justify-center shrink-0 mt-0.5">
                                                                <Box className="w-[18px] h-[18px] text-amber-600" />
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <div className="flex items-center gap-2 flex-wrap mb-1.5">
                                                                    <span className="text-sm font-bold text-gray-900">
                                                                        {pkg.unit?.name ?? uName} × {pkg.quantity}
                                                                    </span>
                                                                    {pkg.is_default && (
                                                                        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                                                            <Star className="w-3 h-3" /> Défaut
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500">
                                                                    {pkg.unit?.short_name && (
                                                                        <span>
                                                                            <span className="text-gray-400">Code unité:</span>{' '}
                                                                            <span className="font-mono font-semibold text-gray-700">{pkg.unit.short_name}</span>
                                                                        </span>
                                                                    )}
                                                                    {pkg.theoretical_weight != null && (
                                                                        <span>
                                                                            <span className="text-gray-400">Poids théorique:</span>{' '}
                                                                            <span className="font-semibold text-gray-700">{pkg.theoretical_weight} kg</span>
                                                                        </span>
                                                                    )}
                                                                    {pkg.packaging_level_id != null && (
                                                                        <span>
                                                                            <span className="text-gray-400">Niveau logistique:</span>{' '}
                                                                            <span className="font-mono text-[10px] font-semibold text-indigo-700">#{pkg.packaging_level_id}</span>
                                                                        </span>
                                                                    )}
                                                                    <span className="text-gray-300">ID #{pkg.id}</span>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                                                <button
                                                                    onClick={() => openEdit(pkg)}
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                                                    title="Modifier"
                                                                >
                                                                    <Edit2 className="w-3.5 h-3.5" />
                                                                </button>
                                                                <button
                                                                    onClick={() => setDeleteTarget(pkg)}
                                                                    className="w-7 h-7 rounded-lg flex items-center justify-center text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                                                                    title="Supprimer"
                                                                >
                                                                    <Trash2 className="w-3.5 h-3.5" />
                                                                </button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            })}

                                            {/* Dashed add button */}
                                            <button
                                                onClick={openCreate}
                                                className="w-full border-2 border-dashed border-gray-200 rounded-xl p-4 text-xs text-gray-400 hover:border-amber-400 hover:text-amber-600 hover:bg-amber-50/40 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus className="w-4 h-4" /> Ajouter un conditionnement
                                            </button>
                                        </>
                                    )}
                                </div>
                            ) : (
                                /* Create / Edit form */
                                <div className="max-w-2xl">
                                    <button
                                        onClick={cancelForm}
                                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 mb-5 transition-colors"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                        Retour aux conditionnements
                                    </button>

                                    <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                                        <div className="flex items-center gap-2 pb-3 border-b border-gray-100">
                                            <Box className="w-4 h-4 text-amber-600" />
                                            <h3 className="text-sm font-bold text-gray-900">
                                                {formMode === 'create' ? 'Nouveau conditionnement' : 'Modifier le conditionnement'}
                                            </h3>
                                        </div>

                                        {/* Unit */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                                Unité de vente <span className="text-red-500">*</span>
                                            </Label>
                                            <select
                                                value={form.unit_id}
                                                onChange={e => setForm(prev => ({ ...prev, unit_id: e.target.value }))}
                                                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                            >
                                                <option value="">— Sélectionner une unité —</option>
                                                {units.map(u => (
                                                    <option key={u.id} value={u.id}>
                                                        {u.name}{u.short_name ? ` (${u.short_name})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>

                                        {/* Quantity */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                                Quantité (unités de base dans ce colisage) <span className="text-red-500">*</span>
                                            </Label>
                                            <input
                                                type="number" min="1" step="1"
                                                value={form.quantity}
                                                onChange={e => setForm(prev => ({ ...prev, quantity: e.target.value }))}
                                                placeholder="ex: 12"
                                                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                            />
                                        </div>

                                        {/* Theoretical weight */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                                Poids théorique (kg)
                                            </Label>
                                            <input
                                                type="number" min="0" step="0.001"
                                                value={form.theoretical_weight}
                                                onChange={e => setForm(prev => ({ ...prev, theoretical_weight: e.target.value }))}
                                                placeholder="ex: 7.5"
                                                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400">
                                                Sert au calcul du prix au kilo : prix = quantité × poids théorique × prix/kg
                                            </p>
                                        </div>

                                        {/* Packaging level ID */}
                                        <div className="space-y-1.5">
                                            <Label className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">
                                                ID Niveau logistique (optionnel)
                                            </Label>
                                            <input
                                                type="number" min="1" step="1"
                                                value={form.packaging_level_id}
                                                onChange={e => setForm(prev => ({ ...prev, packaging_level_id: e.target.value }))}
                                                placeholder="Laisser vide si non lié"
                                                className="w-full h-9 px-3 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 bg-white"
                                            />
                                            <p className="text-[10px] text-gray-400">
                                                Lien vers un niveau UNIT/CARTON/PALLET de la fiche logistique du produit
                                            </p>
                                        </div>

                                        {/* is_default */}
                                        <div className="flex items-start gap-3 pt-1">
                                            <Checkbox
                                                id="is_default"
                                                checked={form.is_default}
                                                onCheckedChange={v => setForm(prev => ({ ...prev, is_default: Boolean(v) }))}
                                                className="mt-0.5"
                                            />
                                            <div>
                                                <Label htmlFor="is_default" className="text-sm text-gray-700 cursor-pointer font-medium">
                                                    Conditionnement par défaut
                                                </Label>
                                                <p className="text-[10px] text-gray-400 mt-0.5">
                                                    Référence pour le calcul du prix linéaire (base_price = prix défaut / quantité défaut)
                                                </p>
                                            </div>
                                        </div>

                                        {/* Footer buttons */}
                                        <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                                            <Button
                                                size="sm"
                                                onClick={handleSave}
                                                disabled={saving}
                                                className="bg-amber-600 hover:bg-amber-700"
                                            >
                                                <Save className="w-3.5 h-3.5 mr-1.5" />
                                                {saving ? 'Sauvegarde…' : (formMode === 'create' ? 'Créer le conditionnement' : 'Sauvegarder')}
                                            </Button>
                                            <Button variant="outline" size="sm" onClick={cancelForm} disabled={saving}>
                                                Annuler
                                            </Button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Delete confirm dialog */}
            {deleteTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-xl border border-gray-200 p-6 w-full max-w-sm mx-4">
                        <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </div>
                            <div>
                                <h3 className="text-sm font-bold text-gray-900">Supprimer le conditionnement</h3>
                                <p className="text-xs text-gray-500 mt-0.5">
                                    {getUnitName(deleteTarget.unit_id)} × {deleteTarget.quantity}
                                </p>
                            </div>
                        </div>
                        <p className="text-xs text-gray-600 mb-5 bg-red-50 border border-red-100 rounded-lg p-3 leading-relaxed">
                            ⚠️ Supprimer ce conditionnement retirera également toutes les lignes de prix associées dans la tarification (<code className="text-red-700">price_list_line_details CASCADE</code>). Cette action est irréversible.
                        </p>
                        <div className="flex gap-3">
                            <Button
                                variant="outline" size="sm" className="flex-1"
                                onClick={() => setDeleteTarget(null)} disabled={deleting}
                            >
                                Annuler
                            </Button>
                            <Button
                                size="sm"
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                                onClick={handleDelete} disabled={deleting}
                            >
                                <Trash2 className="w-3.5 h-3.5 mr-1.5" />
                                {deleting ? 'Suppression…' : 'Supprimer'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
