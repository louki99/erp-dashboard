import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    Truck, Search, X, RefreshCw, Edit2, Save, CheckCircle2,
    Layers, AlertTriangle, Package,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { productsApi } from '@/services/api/productsApi';
import type { Product, ProductLogisticsProfile } from '@/types/product.types';

// ─── Local types ──────────────────────────────────────────────────────────────

type LevelKey = 'UNIT' | 'CARTON' | 'PALLET';

interface LevelForm {
    enabled: boolean;
    units_per_package: string;
    length_m: string;
    width_m: string;
    height_m: string;
    gross_weight_kg: string;
    net_weight_kg: string;
    volume_m3: number | null;
}

interface LogisticsForm {
    shipping_level: string;
    stackable: boolean;
    fragile: boolean;
    keep_upright: boolean;
    temperature_controlled: boolean;
    levels: Record<LevelKey, LevelForm>;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const LEVEL_KEYS: LevelKey[] = ['UNIT', 'CARTON', 'PALLET'];

const LEVEL_LABELS: Record<LevelKey, string> = {
    UNIT: 'Unité', CARTON: 'Carton', PALLET: 'Palette',
};

const LEVEL_COLORS: Record<LevelKey, string> = {
    UNIT:   'text-blue-700 bg-blue-50 border-blue-200',
    CARTON: 'text-amber-700 bg-amber-50 border-amber-200',
    PALLET: 'text-purple-700 bg-purple-50 border-purple-200',
};

const EMPTY_LEVEL: LevelForm = {
    enabled: false,
    units_per_package: '1',
    length_m: '', width_m: '', height_m: '',
    gross_weight_kg: '', net_weight_kg: '',
    volume_m3: null,
};

const DEFAULT_FORM: LogisticsForm = {
    shipping_level: 'UNIT',
    stackable: false, fragile: false, keep_upright: false, temperature_controlled: false,
    levels: {
        UNIT:   { ...EMPTY_LEVEL, enabled: true },
        CARTON: { ...EMPTY_LEVEL },
        PALLET: { ...EMPTY_LEVEL },
    },
};

// ─── Converters ───────────────────────────────────────────────────────────────

function fromLogistics(lp: ProductLogisticsProfile): LogisticsForm {
    const form: LogisticsForm = {
        shipping_level: lp.shipping_level ?? 'UNIT',
        stackable:            lp.stackable             ?? false,
        fragile:              lp.fragile               ?? false,
        keep_upright:         lp.keep_upright          ?? false,
        temperature_controlled: lp.temperature_controlled ?? false,
        levels: {
            UNIT:   { ...EMPTY_LEVEL },
            CARTON: { ...EMPTY_LEVEL },
            PALLET: { ...EMPTY_LEVEL },
        },
    };
    for (const lvl of lp.packaging_levels ?? []) {
        const key = lvl.packaging_level as LevelKey;
        if (key !== 'UNIT' && key !== 'CARTON' && key !== 'PALLET') continue;
        form.levels[key] = {
            enabled: true,
            units_per_package:  String(lvl.units_per_package  ?? 1),
            length_m:           lvl.length_m        != null ? String(lvl.length_m)        : '',
            width_m:            lvl.width_m         != null ? String(lvl.width_m)         : '',
            height_m:           lvl.height_m        != null ? String(lvl.height_m)        : '',
            gross_weight_kg:    lvl.gross_weight_kg != null ? String(lvl.gross_weight_kg) : '',
            net_weight_kg:      lvl.net_weight_kg   != null ? String(lvl.net_weight_kg)   : '',
            volume_m3:          lvl.volume_m3 ?? null,
        };
    }
    return form;
}

function toPayload(form: LogisticsForm) {
    const packaging_levels = (Object.entries(form.levels) as [LevelKey, LevelForm][])
        .filter(([, l]) => l.enabled)
        .map(([key, l]) => ({
            packaging_level:  key,
            units_per_package: Number(l.units_per_package) || 1,
            ...(l.length_m        ? { length_m:        Number(l.length_m)        } : {}),
            ...(l.width_m         ? { width_m:         Number(l.width_m)         } : {}),
            ...(l.height_m        ? { height_m:        Number(l.height_m)        } : {}),
            ...(l.gross_weight_kg ? { gross_weight_kg: Number(l.gross_weight_kg) } : {}),
            ...(l.net_weight_kg   ? { net_weight_kg:   Number(l.net_weight_kg)   } : {}),
            // volume_m3 intentionally omitted — calculated by DB from L×W×H
        }));
    return {
        shipping_level:        form.shipping_level,
        stackable:             form.stackable,
        fragile:               form.fragile,
        keep_upright:          form.keep_upright,
        temperature_controlled: form.temperature_controlled,
        packaging_levels,
    };
}

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ProductLogisticsPage() {
    // ── Products list ──────────────────────────────────────────────────────────
    const [products, setProducts] = useState<Product[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [search, setSearch] = useState('');
    const [total, setTotal] = useState(0);
    const [savedIds, setSavedIds] = useState<Set<number>>(new Set());
    const searchTimer = useRef<ReturnType<typeof setTimeout>>();

    // ── Selected product ───────────────────────────────────────────────────────
    const [viewSelected, setViewSelected] = useState<Product | null>(null);
    const [logistics, setLogistics] = useState<ProductLogisticsProfile | null>(null);
    const [loadingLogistics, setLoadingLogistics] = useState(false);
    const [isNew, setIsNew] = useState(false);

    // ── Form ───────────────────────────────────────────────────────────────────
    const [formMode, setFormMode] = useState<'view' | 'edit'>('view');
    const [form, setForm] = useState<LogisticsForm>(DEFAULT_FORM);
    const [saving, setSaving] = useState(false);

    // ── Load products ──────────────────────────────────────────────────────────
    const fetchProducts = useCallback(async (q: string) => {
        setLoadingProducts(true);
        try {
            const res = await productsApi.getList({ search: q || undefined, per_page: 100 });
            const list: Product[] = (res as any)?.data?.data ?? (res as any)?.data ?? [];
            const savedSnapshot = savedIds;
            setProducts(list.map(p => ({ ...p, _saved: savedSnapshot.has(p.id) } as Product)));
            setTotal((res as any)?.data?.total ?? list.length);
        } catch {
            toast.error('Erreur lors du chargement des produits');
        } finally {
            setLoadingProducts(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => { fetchProducts(''); }, [fetchProducts]);

    const handleSearchChange = (value: string) => {
        setSearch(value);
        clearTimeout(searchTimer.current);
        searchTimer.current = setTimeout(() => fetchProducts(value), 400);
    };

    // ── Enrich row data with saved indicator ───────────────────────────────────
    const rowData = useMemo(
        () => products.map(p => ({ ...p, _saved: savedIds.has(p.id) })),
        [products, savedIds]
    );

    // ── Load logistics on product select ───────────────────────────────────────
    useEffect(() => {
        if (!viewSelected) { setLogistics(null); return; }
        setLoadingLogistics(true);
        setLogistics(null);
        productsApi.getLogistics(viewSelected.id)
            .then(r => {
                const lp: ProductLogisticsProfile | null = (r as any).logistics ?? (r as any).data ?? null;
                setLogistics(lp);
                setIsNew(!lp);
                setForm(lp ? fromLogistics(lp) : { ...DEFAULT_FORM });
                setFormMode('view');
            })
            .catch(() => {
                setLogistics(null);
                setIsNew(true);
                setForm({ ...DEFAULT_FORM });
                setFormMode('view');
            })
            .finally(() => setLoadingLogistics(false));
    }, [viewSelected]);

    // ── Level helper ───────────────────────────────────────────────────────────
    const setLevel = (key: LevelKey, patch: Partial<LevelForm>) =>
        setForm(prev => ({ ...prev, levels: { ...prev.levels, [key]: { ...prev.levels[key], ...patch } } }));

    // ── Save ───────────────────────────────────────────────────────────────────
    const handleSave = async () => {
        if (!viewSelected) return;
        setSaving(true);
        try {
            const res = await productsApi.updateLogistics(viewSelected.id, toPayload(form) as ProductLogisticsProfile);
            const lp: ProductLogisticsProfile | null = (res as any).logistics ?? (res as any).data ?? null;
            if (lp) { setLogistics(lp); setForm(fromLogistics(lp)); }
            setIsNew(false);
            setFormMode('view');
            setSavedIds(prev => new Set(prev).add(viewSelected.id));
            toast.success(`Profil logistique de "${viewSelected.name}" sauvegardé`);
        } catch (err) {
            toast.error(getErrorMessage(err));
        } finally {
            setSaving(false);
        }
    };

    const cancelEdit = () => {
        setForm(logistics ? fromLogistics(logistics) : { ...DEFAULT_FORM });
        setFormMode('view');
    };

    // ── DataGrid columns ───────────────────────────────────────────────────────
    const productColumns = useMemo<import('ag-grid-community').ColDef[]>(() => [
        {
            field: 'code', headerName: 'Code', width: 90,
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
            cellStyle: { fontSize: '12px', fontWeight: '500', color: '#111827' },
        },
    ], []);

    // ── Action panel ───────────────────────────────────────────────────────────
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode === 'edit') {
            return [{ items: [
                { icon: Save,      label: 'Sauvegarder', variant: 'primary', onClick: handleSave, disabled: saving },
                { icon: X,         label: 'Annuler',      variant: 'warning', onClick: cancelEdit },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: RefreshCw, label: 'Actualiser la liste', onClick: () => fetchProducts(search), disabled: loadingProducts },
        ];
        if (viewSelected) {
            base.unshift({
                icon: isNew ? Package : Edit2,
                label: isNew ? 'Créer le profil' : 'Modifier le profil',
                variant: 'primary',
                onClick: () => setFormMode('edit'),
            });
        }
        return [{ items: base }];
    }, [formMode, viewSelected, saving, loadingProducts, search]);

    // ─────────────────────────────────────────────────────────────────────────

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Truck className="w-4 h-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Produits</h2>
                                <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                    {total}
                                </span>
                            </div>
                            {savedIds.size > 0 && (
                                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-0.5">
                                    <CheckCircle2 className="w-3 h-3" /> {savedIds.size} sauvegardé{savedIds.size > 1 ? 's' : ''}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                            <input
                                type="text" value={search}
                                onChange={e => handleSearchChange(e.target.value)}
                                placeholder="Chercher un produit…"
                                className="w-full pl-9 pr-8 py-2 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-500 bg-gray-50/70 transition-all"
                            />
                            {search && (
                                <button onClick={() => { setSearch(''); fetchProducts(''); }} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>
                    <div className="flex-1 min-h-0">
                        <DataGrid
                            rowData={rowData}
                            columnDefs={productColumns}
                            loading={loadingProducts}
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
                    {/* ── Page header ── */}
                    <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white shadow-sm shrink-0">
                            <Package className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-sm font-bold text-gray-900">
                                    {viewSelected ? viewSelected.name : 'Logistique Produits'}
                                </h1>
                                {viewSelected && (
                                    <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                                        {viewSelected.code}
                                    </span>
                                )}
                                {viewSelected && !loadingLogistics && (
                                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                                        isNew
                                            ? 'text-amber-700 bg-amber-50 border-amber-200'
                                            : 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                    }`}>
                                        {isNew ? 'Nouveau profil' : 'Profil existant'}
                                    </span>
                                )}
                                {formMode === 'edit' && (
                                    <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                        Édition
                                    </span>
                                )}
                            </div>
                            <p className="text-[11px] text-gray-400 mt-0.5">
                                {viewSelected
                                    ? 'Saisir les dimensions et poids des niveaux d\'emballage'
                                    : 'Sélectionnez un produit dans la liste pour configurer son profil logistique'}
                            </p>
                        </div>
                    </div>

                    {/* ── Content ── */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {!viewSelected ? (
                            /* ── Empty state ── */
                            <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                    <Package className="w-10 h-10 text-gray-200" />
                                </div>
                                <div className="text-center">
                                    <p className="text-sm font-semibold text-gray-700">Aucun produit sélectionné</p>
                                    <p className="text-xs text-gray-400 mt-1">Cliquez sur un produit dans la liste à gauche</p>
                                </div>
                            </div>
                        ) : loadingLogistics ? (
                            /* ── Skeleton ── */
                            <div className="space-y-3 max-w-3xl">
                                {[1, 2, 3].map(i => (
                                    <div key={i} className="h-24 bg-white rounded-xl border border-gray-200 animate-pulse" />
                                ))}
                            </div>
                        ) : formMode === 'view' ? (
                            /* ── View mode ── */
                            isNew ? (
                                /* ── No profile yet ── */
                                <div className="h-full flex flex-col items-center justify-center gap-5">
                                    <div className="w-16 h-16 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100">
                                        <Package className="w-8 h-8 text-gray-200" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-sm font-semibold text-gray-700">Aucun profil logistique</p>
                                        <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                            Ce produit n'a pas encore de profil. Cliquez sur le bouton ci-dessous pour saisir ses dimensions et poids.
                                        </p>
                                    </div>
                                    <Button
                                        size="sm"
                                        onClick={() => setFormMode('edit')}
                                        className="bg-sage-600 hover:bg-sage-700"
                                    >
                                        <Package className="w-3.5 h-3.5 mr-1.5" /> Créer le profil logistique
                                    </Button>
                                </div>
                            ) : (
                            <div className="max-w-3xl space-y-5">
                                {/* Profile flags */}
                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <div className="flex items-center gap-1.5 mb-4">
                                        <Layers className="w-3.5 h-3.5 text-sage-500" />
                                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Profil général</p>
                                    </div>
                                    <div className="space-y-3">
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-400 w-36 shrink-0">Niveau d'expédition</span>
                                            {logistics?.shipping_level ? (
                                                <span className="text-xs font-mono font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-100">
                                                    {logistics.shipping_level}
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-300 italic">Non défini</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className="text-[10px] text-gray-400 w-36 shrink-0">Caractéristiques</span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {[
                                                    { key: 'stackable',              label: 'Empilable'    },
                                                    { key: 'fragile',                label: 'Fragile'      },
                                                    { key: 'keep_upright',           label: 'À l\'endroit' },
                                                    { key: 'temperature_controlled', label: 'Réfrigéré'   },
                                                ].map(({ key, label }) => {
                                                    const val = Boolean((logistics as any)?.[key]);
                                                    return (
                                                        <span key={key} className={`text-[10px] font-medium px-2 py-0.5 rounded-full border ${
                                                            val
                                                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                                                : 'text-gray-400 bg-gray-50 border-gray-200'
                                                        }`}>
                                                            {val ? '✓' : '✗'} {label}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* Packaging levels — read-only table */}
                                {(logistics?.packaging_levels ?? []).length > 0 ? (
                                    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                        <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                                            <Layers className="w-3.5 h-3.5 text-sage-500" />
                                            <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                                Niveaux d'emballage
                                            </span>
                                            <span className="ml-auto text-[10px] text-gray-400 italic">
                                                volume_m³ calculé automatiquement
                                            </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-xs">
                                                <thead>
                                                    <tr className="border-b border-gray-100 bg-gray-50/40">
                                                        <th className="text-left px-5 py-2.5 text-[10px] font-semibold text-gray-400 uppercase">Niveau</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Nombre d'unités de l'échelon inférieur contenues dans ce colis (ex : 12 unités dans un carton)">Unités</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Longueur de l'emballage en mètres">L (m)</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Largeur de l'emballage en mètres">l (m)</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Hauteur de l'emballage en mètres">H (m)</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Poids brut en kg — produit + emballage (ce qui est pesé sur la balance)">Brut (kg)</th>
                                                        <th className="text-right px-3 py-2.5 text-[10px] font-semibold text-gray-400 uppercase cursor-help" title="Poids net en kg — produit seul, sans emballage">Net (kg)</th>
                                                        <th className="text-right px-5 py-2.5 text-[10px] font-semibold text-sage-500 uppercase cursor-help" title="Volume calculé automatiquement par la base de données : L × l × H. Ne pas saisir.">Vol (m³) ↗</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(logistics?.packaging_levels ?? []).map(lvl => (
                                                        <tr key={lvl.packaging_level} className="border-b border-gray-50 hover:bg-gray-50/50">
                                                            <td className="px-5 py-3">
                                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[lvl.packaging_level as LevelKey] ?? 'text-gray-600 bg-gray-50 border-gray-200'}`}>
                                                                    {LEVEL_LABELS[lvl.packaging_level as LevelKey] ?? lvl.packaging_level}
                                                                </span>
                                                            </td>
                                                            <td className="px-3 py-3 text-right font-semibold text-gray-800">{lvl.units_per_package}</td>
                                                            <td className="px-3 py-3 text-right text-gray-600">{lvl.length_m ?? '—'}</td>
                                                            <td className="px-3 py-3 text-right text-gray-600">{lvl.width_m ?? '—'}</td>
                                                            <td className="px-3 py-3 text-right text-gray-600">{lvl.height_m ?? '—'}</td>
                                                            <td className="px-3 py-3 text-right text-gray-700">{lvl.gross_weight_kg ?? '—'}</td>
                                                            <td className="px-3 py-3 text-right text-gray-700">{lvl.net_weight_kg ?? '—'}</td>
                                                            <td className="px-5 py-3 text-right font-semibold text-sage-700">
                                                                {lvl.volume_m3 != null ? Number(lvl.volume_m3).toFixed(4) : <span className="text-gray-300">—</span>}
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-3 px-5 py-4 bg-amber-50 border border-amber-200 rounded-xl">
                                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                                        <p className="text-xs text-amber-700">
                                            Aucun niveau d'emballage configuré. Cliquez sur <strong>Modifier le profil</strong> pour saisir les dimensions.
                                        </p>
                                    </div>
                                )}
                            </div>
                            )
                        ) : (
                            /* ── Edit mode ── */
                            <div className="max-w-3xl space-y-5">
                                {/* Replace-all warning */}
                                <div className="flex items-start gap-2.5 px-4 py-3 bg-blue-50 border border-blue-200 rounded-xl">
                                    <AlertTriangle className="w-4 h-4 text-blue-600 mt-0.5 shrink-0" />
                                    <p className="text-xs text-blue-700">
                                        L'enregistrement <strong>remplace entièrement</strong> les niveaux existants.
                                        Cochez tous les niveaux à conserver — les niveaux non cochés seront supprimés.
                                    </p>
                                </div>

                                {/* Profile flags */}
                                <div className="bg-white rounded-xl border border-gray-200 p-5">
                                    <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Profil général</p>
                                    <div className="grid grid-cols-2 gap-5">
                                        <div className="space-y-1.5">
                                            <Label className="text-xs font-medium">Niveau d'expédition</Label>
                                            <select
                                                value={form.shipping_level}
                                                onChange={e => setForm(p => ({ ...p, shipping_level: e.target.value }))}
                                                className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sage-500/20 focus:border-sage-400"
                                            >
                                                <option value="UNIT">UNIT — Unité</option>
                                                <option value="CARTON">CARTON — Carton</option>
                                                <option value="PALLET">PALLET — Palette</option>
                                            </select>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-1">
                                            {[
                                                { key: 'stackable'              as const, label: 'Empilable'    },
                                                { key: 'fragile'                as const, label: 'Fragile'      },
                                                { key: 'keep_upright'           as const, label: 'À l\'endroit' },
                                                { key: 'temperature_controlled' as const, label: 'Réfrigéré'   },
                                            ].map(({ key, label }) => (
                                                <div key={key} className="flex items-center gap-2">
                                                    <Checkbox
                                                        id={`flag-${key}`}
                                                        checked={form[key]}
                                                        onCheckedChange={v => setForm(p => ({ ...p, [key]: Boolean(v) }))}
                                                    />
                                                    <Label htmlFor={`flag-${key}`} className="text-xs cursor-pointer">{label}</Label>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Packaging levels — editable table */}
                                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                                    <div className="flex items-center gap-1.5 px-5 py-3 border-b border-gray-100 bg-gray-50/60">
                                        <Layers className="w-3.5 h-3.5 text-sage-500" />
                                        <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                                            Niveaux d'emballage
                                        </span>
                                        <span className="ml-auto text-[10px] text-gray-400 italic">
                                            volume_m³ = L × l × H, calculé par la base de données
                                        </span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead>
                                                <tr className="border-b border-gray-100 bg-gray-50/40">
                                                    <th className="text-left px-4 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[130px]">Niveau</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[72px] cursor-help" title="Nombre d'unités de l'échelon inférieur contenues dans ce colis (ex : 12 unités dans un carton)">Unités</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[82px] cursor-help" title="Longueur de l'emballage en mètres">L (m)</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[82px] cursor-help" title="Largeur de l'emballage en mètres">l (m)</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[82px] cursor-help" title="Hauteur de l'emballage en mètres">H (m)</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[92px] cursor-help" title="Poids brut en kg — produit + emballage (ce qui est pesé sur la balance)">Brut (kg)</th>
                                                    <th className="text-left px-2 py-2.5 text-[10px] font-semibold text-gray-400 uppercase w-[92px] cursor-help" title="Poids net en kg — produit seul, sans emballage">Net (kg)</th>
                                                    <th className="text-right px-4 py-2.5 text-[10px] font-semibold text-sage-500 uppercase cursor-help" title="Volume calculé automatiquement par la base de données : L × l × H. Ne pas saisir.">Vol m³ ↗</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {LEVEL_KEYS.map(key => {
                                                    const lvl = form.levels[key];
                                                    return (
                                                        <tr key={key} className={`border-b border-gray-100 transition-opacity ${!lvl.enabled ? 'opacity-40' : ''}`}>
                                                            <td className="px-4 py-2.5">
                                                                <div className="flex items-center gap-2">
                                                                    <Checkbox
                                                                        checked={lvl.enabled}
                                                                        onCheckedChange={v => setLevel(key, { enabled: Boolean(v) })}
                                                                    />
                                                                    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${LEVEL_COLORS[key]}`}>
                                                                        {LEVEL_LABELS[key]}
                                                                    </span>
                                                                </div>
                                                            </td>
                                                            <td className="px-2 py-2.5">
                                                                <Input
                                                                    type="number" min="1"
                                                                    value={lvl.units_per_package}
                                                                    onChange={e => setLevel(key, { units_per_package: e.target.value })}
                                                                    disabled={!lvl.enabled}
                                                                    className="h-7 text-xs"
                                                                />
                                                            </td>
                                                            {(['length_m', 'width_m', 'height_m', 'gross_weight_kg', 'net_weight_kg'] as const).map(field => (
                                                                <td key={field} className="px-2 py-2.5">
                                                                    <Input
                                                                        type="number" min="0" step="0.001"
                                                                        value={lvl[field]}
                                                                        onChange={e => setLevel(key, { [field]: e.target.value })}
                                                                        disabled={!lvl.enabled}
                                                                        placeholder="0.000"
                                                                        className="h-7 text-xs"
                                                                    />
                                                                </td>
                                                            ))}
                                                            <td className="px-4 py-2.5 text-right">
                                                                {lvl.volume_m3 != null
                                                                    ? <span className="text-sage-600 font-semibold">{Number(lvl.volume_m3).toFixed(4)}</span>
                                                                    : <span className="text-gray-300 italic text-[10px]">auto</span>
                                                                }
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>

                                {/* Footer actions */}
                                <div className="flex items-center justify-end gap-2 pt-1">
                                    <Button variant="outline" size="sm" onClick={cancelEdit}>
                                        <X className="w-3.5 h-3.5 mr-1.5" /> Annuler
                                    </Button>
                                    <Button
                                        size="sm"
                                        onClick={handleSave}
                                        disabled={saving}
                                        className="bg-sage-600 hover:bg-sage-700"
                                    >
                                        <Save className="w-3.5 h-3.5 mr-1.5" />
                                        {saving ? 'Enregistrement…' : 'Enregistrer'}
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
