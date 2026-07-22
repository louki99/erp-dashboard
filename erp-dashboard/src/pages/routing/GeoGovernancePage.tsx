import { useState, useRef, useEffect, useMemo } from 'react';
import toast from 'react-hot-toast';
import { isAxiosError } from 'axios';
import {
    MapPin,
    Plus,
    Edit2,
    Trash2,
    Users,
    FolderTree,
    Search,
    ChevronRight,
    MoreHorizontal,
    X,
    RotateCcw,
    AlertTriangle,
    GitBranch,
    ChevronDown,
    Globe2,
    Layers,
    AlertCircle,
} from 'lucide-react';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { DetailCard } from '@/components/common/DetailCard';
import { SageTabs } from '@/components/common/SageTabs';
import SearchableSelect from '@/components/common/SearchableSelect';
import { GeoAreaForm } from '@/components/routing';
import {
    useGeoHierarchy,
    useGeoAreaChildren,
    useGeoAreas,
    useCreateGeoArea,
    useUpdateGeoArea,
    useDeleteGeoArea,
    useGeoAreaUsers,
    useAssignGeoAreaUser,
    useRemoveGeoAreaUser,
} from '@/hooks/routing/useRouting';
import { useRbacUsers } from '@/hooks/rbac/useRbac';
import type { CreateGeoAreaPayload, GeoArea, GeoAreaType, UpdateGeoAreaPayload } from '@/types/routing.types';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
}

// Type rank → visual config
const TYPE_CONFIG: Record<number, { icon: string; color: string; dot: string; ring: string }> = {
    100: { icon: '🌍', color: 'bg-blue-50 border-blue-200 text-blue-700',   dot: 'bg-blue-400',   ring: 'ring-blue-200' },
    200: { icon: '📍', color: 'bg-rose-50 border-rose-200 text-rose-700',   dot: 'bg-rose-400',   ring: 'ring-rose-200' },
    300: { icon: '🏙️', color: 'bg-violet-50 border-violet-200 text-violet-700', dot: 'bg-violet-400', ring: 'ring-violet-200' },
    400: { icon: '🏘️', color: 'bg-amber-50 border-amber-200 text-amber-700', dot: 'bg-amber-400', ring: 'ring-amber-200' },
    500: { icon: '🗺️', color: 'bg-teal-50 border-teal-200 text-teal-700',   dot: 'bg-teal-400',   ring: 'ring-teal-200' },
    600: { icon: '📌', color: 'bg-gray-50 border-gray-200 text-gray-600',   dot: 'bg-gray-400',   ring: 'ring-gray-200' },
};

function getTypeConfig(rank: number) {
    return TYPE_CONFIG[rank] ?? TYPE_CONFIG[600];
}

// ─── Tree normalization ───────────────────────────────────────────────────────

/**
 * Normalise le payload hiérarchique du backend.
 * Le backend renvoie déjà les enfants imbriqués dans `children`, mais on
 * reconstruit proprement l'arbre à partir de `parent_code` pour être robuste
 * aux retours plats ou partiels.
 *
 * Règles :
 * - nœud sans `parent_code`                   → racine
 * - nœud avec `parent_code` trouvé dans all   → enfant de ce parent
 * - nœud avec `parent_code` absent du payload → orphan (zone à corriger)
 *
 * On ne crée plus de catégorie "misplaced" basée sur le rank : elle classait
 * à tort des zones actives et valides (ex. province dont la région parente
 * n'était pas dans le payload) comme étant à corriger.
 */
function normalizeTree(
    roots: GeoArea[],
    typesById: Map<number, GeoAreaType>
): { tree: GeoArea[]; orphans: GeoArea[] } {
    const all = new Map<string, GeoArea>();

    const collect = (nodes: GeoArea[]) => {
        for (const n of nodes) {
            if (!all.has(n.code)) {
                all.set(n.code, {
                    ...n,
                    geo_area_type: n.geo_area_type ?? typesById.get(n.geo_area_type_id),
                    children: [],
                });
            }
            if (n.children?.length) collect(n.children);
        }
    };
    collect(roots);

    // Resolve parent labels
    for (const node of all.values()) {
        if (node.parent_code) {
            const p = all.get(node.parent_code);
            if (p) node.parent = { id: p.id, code: p.code, name: p.name };
        }
    }

    const tree: GeoArea[] = [];
    const orphans: GeoArea[] = [];

    for (const node of all.values()) {
        if (node.parent_code && all.has(node.parent_code)) {
            all.get(node.parent_code)!.children!.push(node);
        } else if (node.parent_code) {
            orphans.push(node);
        } else {
            tree.push(node);
        }
    }

    const sortRec = (nodes: GeoArea[]) => {
        nodes.sort(
            (a, b) =>
                (a.geo_area_type?.rank ?? 0) - (b.geo_area_type?.rank ?? 0) ||
                a.sort_order - b.sort_order ||
                a.name.localeCompare(b.name)
        );
        for (const n of nodes) {
            if (n.children?.length) sortRec(n.children);
            else n.children = [];
        }
    };
    sortRec(tree);
    sortRec(orphans);

    return { tree, orphans };
}

function filterTree(nodes: GeoArea[], q: string): GeoArea[] {
    const lower = q.toLowerCase();
    return nodes.reduce<GeoArea[]>((acc, node) => {
        const matchSelf =
            node.name.toLowerCase().includes(lower) ||
            node.code.toLowerCase().includes(lower) ||
            (node.name_ar ?? '').toLowerCase().includes(lower) ||
            (node.parent?.name ?? '').toLowerCase().includes(lower);
        const filteredChildren = filterTree(node.children ?? [], lower);
        if (matchSelf || filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
        }
        return acc;
    }, []);
}

function countTree(nodes: GeoArea[]): number {
    return nodes.reduce((acc, n) => acc + 1 + countTree(n.children ?? []), 0);
}

/** Retourne tous les nœuds d'un type donné, prêts à être affichés comme racines virtuelles. */
function collectNodesByType(nodes: GeoArea[], typeId: number): GeoArea[] {
    const result: GeoArea[] = [];
    const walk = (list: GeoArea[]) => {
        for (const n of list) {
            if (n.geo_area_type_id === typeId) result.push(n);
            if (n.children?.length) walk(n.children);
        }
    };
    walk(nodes);
    return result.sort(
        (a, b) =>
            a.sort_order - b.sort_order ||
            a.name.localeCompare(b.name)
    );
}

function countByType(nodes: GeoArea[], typeId: number): number {
    let count = 0;
    const walk = (list: GeoArea[]) => {
        for (const n of list) {
            if (n.geo_area_type_id === typeId) count++;
            if (n.children?.length) walk(n.children);
        }
    };
    walk(nodes);
    return count;
}

// ─── Node context menu ────────────────────────────────────────────────────────

function NodeMenu({
    node,
    onAction,
}: {
    node: GeoArea;
    onAction: (action: 'edit' | 'add-child' | 'delete' | 'assign-user', area: GeoArea) => void;
}) {
    const [open, setOpen] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    return (
        <div ref={ref} className="relative shrink-0">
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 hover:bg-gray-200"
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            >
                <MoreHorizontal className="w-3.5 h-3.5 text-gray-500" />
            </Button>
            {open && (
                <div className="absolute right-0 top-7 z-[9999] w-52 bg-white rounded-xl border border-gray-200 shadow-xl py-1.5 text-sm overflow-hidden">
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-blue-50 text-gray-700 hover:text-blue-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('edit', node); }}
                    >
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                        Modifier la zone
                    </button>
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-sage-50 text-gray-700 hover:text-sage-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('add-child', node); }}
                    >
                        <GitBranch className="w-3.5 h-3.5 text-gray-400" />
                        Ajouter une sous-zone
                    </button>
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-amber-50 text-gray-700 hover:text-amber-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('assign-user', node); }}
                    >
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        Gérer superviseurs
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                        className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-red-50 text-red-600 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('delete', node); }}
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                        Supprimer
                    </button>
                </div>
            )}
        </div>
    );
}

// ─── Tree Node ────────────────────────────────────────────────────────────────

function LazyTreeNode({
    node,
    level,
    selectedId,
    onSelect,
    onAction,
}: {
    node: GeoArea;
    level: number;
    selectedId: number | null;
    onSelect: (area: GeoArea) => void;
    onAction: (action: 'edit' | 'add-child' | 'delete' | 'assign-user', area: GeoArea) => void;
}) {
    const [expanded, setExpanded] = useState(level < 1);
    const [loadChildren, setLoadChildren] = useState(false);

    const { data: lazyChildren, isLoading: loadingChildren } = useGeoAreaChildren(
        loadChildren && !node.children ? node.code : null
    );

    const children = node.children ?? lazyChildren ?? [];
    const hasChildren = (node.children !== undefined) || loadChildren || (lazyChildren ?? []).length > 0;
    const isSelected = selectedId === node.id;
    const typeRank = node.geo_area_type?.rank ?? 0;
    const cfg = getTypeConfig(typeRank);

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!node.children && !loadChildren) setLoadChildren(true);
        setExpanded((v) => !v);
    };

    return (
        <div className="relative">
            {/* Connector lines for nested levels */}
            {level > 0 && (
                <div
                    className="absolute top-0 bottom-0 border-l border-gray-200"
                    style={{ left: `${(level - 1) * 20 + 10}px` }}
                />
            )}

            {/* Row */}
            <div
                className={cn(
                    'group relative flex items-center gap-1 rounded-lg cursor-pointer transition-all duration-100 pr-1',
                    isSelected
                        ? 'bg-sage-50 border border-sage-200 shadow-sm'
                        : 'hover:bg-gray-50 border border-transparent'
                )}
                style={{ paddingLeft: `${level * 20 + 4}px` }}
            >
                {/* Expand toggle */}
                <button
                    className="flex-none flex items-center justify-center w-5 h-5 rounded hover:bg-gray-200 text-gray-400 transition-colors"
                    onClick={handleToggle}
                >
                    {loadingChildren ? (
                        <span className="w-3 h-3 block border border-gray-300 border-t-sage-500 rounded-full animate-spin" />
                    ) : hasChildren ? (
                        <ChevronRight className={cn('w-3 h-3 transition-transform duration-150', expanded && 'rotate-90')} />
                    ) : (
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-200" />
                    )}
                </button>

                {/* Type dot */}
                <span className={`w-2 h-2 rounded-full shrink-0 ${cfg.dot}`} />

                {/* Name row */}
                <button
                    className="flex-1 flex items-center gap-2 py-1.5 text-left min-w-0 overflow-hidden"
                    onClick={() => onSelect(node)}
                >
                    <span className={cn('text-sm truncate font-medium', isSelected ? 'text-sage-800' : 'text-gray-700')}>
                        {node.name}
                    </span>
                    <span className="text-[9px] text-gray-400 font-mono shrink-0 hidden group-hover:inline">
                        {node.code}
                    </span>
                    {!node.is_active && (
                        <span className="shrink-0 text-[9px] text-gray-400 bg-gray-100 border border-gray-200 rounded px-1">
                            Inactif
                        </span>
                    )}
                    {children.length > 0 && !expanded && (
                        <span className="shrink-0 text-[9px] text-gray-400 bg-gray-100 rounded-full px-1.5 font-mono hidden group-hover:inline">
                            {children.length}
                        </span>
                    )}
                </button>

                <NodeMenu node={node} onAction={onAction} />
            </div>

            {/* Children */}
            {expanded && children.length > 0 && (
                <div className="relative">
                    {children.map((child) => (
                        <LazyTreeNode
                            key={child.id}
                            node={child}
                            level={level + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                            onAction={onAction}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Inline Form Panel ────────────────────────────────────────────────────────

function GeoAreaFormPanel({
    editingArea,
    parentForCreate,
    geoAreaTypes,
    parentAreas,
    onSubmit,
    onCancel,
    loading,
}: {
    editingArea: GeoArea | null;
    parentForCreate: GeoArea | null;
    geoAreaTypes: GeoAreaType[];
    parentAreas: Array<Pick<GeoArea, 'id' | 'code' | 'name'>>;
    onSubmit: (payload: CreateGeoAreaPayload | UpdateGeoAreaPayload) => Promise<void>;
    onCancel: () => void;
    loading: boolean;
}) {
    const typeRank = editingArea?.geo_area_type?.rank ?? 0;
    const cfg = getTypeConfig(typeRank);

    const title = editingArea
        ? 'Modifier la zone'
        : parentForCreate
        ? `Sous-zone de "${parentForCreate.name}"`
        : 'Nouvelle zone racine';

    const subtitle = editingArea
        ? `${editingArea.code} · ${editingArea.geo_area_type?.name ?? ''}`
        : parentForCreate
        ? `Rattachée à : ${parentForCreate.code} — ${parentForCreate.name}`
        : 'Définissez le code, le nom et le niveau hiérarchique';

    return (
        <div className="h-full bg-white flex flex-col">
            <div className="border-b border-gray-200 px-6 py-4 shrink-0 bg-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl ${editingArea ? cfg.color : 'bg-blue-50 border-blue-100'}`}>
                            {editingArea ? cfg.icon : <Plus className="h-5 w-5 text-blue-600" />}
                        </div>
                        <div>
                            <h2 className="text-base font-bold text-gray-900">{title}</h2>
                            <p className="text-xs text-gray-400 mt-0.5">{subtitle}</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={onCancel} className="h-8 w-8 p-0">
                        <X className="h-4 w-4" />
                    </Button>
                </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
                <GeoAreaForm
                    key={editingArea ? `edit-${editingArea.id}` : `create-${parentForCreate?.code ?? 'root'}`}
                    geoArea={editingArea ?? null}
                    geoAreaTypes={geoAreaTypes}
                    parentAreas={parentAreas}
                    defaultParentCode={parentForCreate?.code}
                    onSubmit={onSubmit}
                    onCancel={onCancel}
                    loading={loading}
                />
            </div>
        </div>
    );
}

// ─── Context Panel (detail + tabs) ───────────────────────────────────────────

function GeoAreaContextPanel({
    area,
    onEdit,
    onAddChild,
    onClose,
}: {
    area: GeoArea;
    onEdit: (area: GeoArea) => void;
    onAddChild: (area: GeoArea) => void;
    onClose: () => void;
}) {
    const [activeTab, setActiveTab] = useState('infos');
    const { data: usersData } = useGeoAreaUsers(area.id);
    const assignUser = useAssignGeoAreaUser(area.id);
    const removeUser = useRemoveGeoAreaUser(area.id);
    const { data: cdzData } = useRbacUsers({ role: 'cdz', per_page: 500 });

    const assignedIds = usersData?.users.map((u) => u.id) ?? [];
    const availableOptions = (cdzData?.data ?? [])
        .filter((u) => !assignedIds.includes(u.id))
        .map((u) => ({ value: u.id, label: u.name }));

    const typeRank = area.geo_area_type?.rank ?? 0;
    const cfg = getTypeConfig(typeRank);
    const supervisorCount = usersData?.users.length ?? 0;

    return (
        <div className="h-full flex flex-col bg-slate-50/40">
            {/* Header */}
            <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className={`flex h-11 w-11 items-center justify-center rounded-xl border text-xl shrink-0 ${cfg.color}`}>
                        {cfg.icon}
                    </div>
                    <div>
                        <div className="flex items-center gap-2 flex-wrap">
                            <h2 className="text-base font-bold text-gray-900">{area.name}</h2>
                            {area.name_ar && (
                                <span className="text-sm text-gray-400" dir="rtl">{area.name_ar}</span>
                            )}
                            <Badge variant={area.is_active ? 'success' : 'secondary'} className="text-[9px]">
                                {area.is_active ? 'Actif' : 'Inactif'}
                            </Badge>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5 flex-wrap">
                            <span className="font-mono">{area.code}</span>
                            {area.geo_area_type && (
                                <>
                                    <span>·</span>
                                    <span>{area.geo_area_type.name}</span>
                                </>
                            )}
                            {area.parent && (
                                <>
                                    <span>·</span>
                                    <span className="text-gray-500">{area.parent.name}</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 ml-2">
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onEdit(area)}>
                        <Edit2 className="w-3 h-3" /> Éditer
                    </Button>
                    <Button variant="outline" size="sm" className="h-7 text-xs gap-1" onClick={() => onAddChild(area)}>
                        <GitBranch className="w-3 h-3" /> Sous-zone
                    </Button>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0 ml-1">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <SageTabs
                tabs={[
                    { id: 'infos', label: 'Informations' },
                    { id: 'superviseurs', label: `Superviseurs (${supervisorCount})` },
                ]}
                activeTabId={activeTab}
                onTabChange={setActiveTab}
                className="px-6 pt-3 shrink-0"
            />

            <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'infos' && (
                    <DetailCard title="Détails de la zone" icon={MapPin} accent="sage">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                            <span className="text-muted-foreground">Type hiérarchique</span>
                            <span className="font-medium text-right">{area.geo_area_type?.name ?? `Type ${area.geo_area_type_id}`}</span>
                            <span className="text-muted-foreground">Zone parent</span>
                            <span className="font-medium text-right">{area.parent?.name ?? '— Racine —'}</span>
                            <span className="text-muted-foreground">Ordre</span>
                            <span className="font-mono text-right">{area.sort_order}</span>
                            {toCoord(area.latitude) !== null && (
                                <>
                                    <span className="text-muted-foreground">Latitude</span>
                                    <span className="font-mono text-right text-xs">{toCoord(area.latitude)?.toFixed(5)}</span>
                                    <span className="text-muted-foreground">Longitude</span>
                                    <span className="font-mono text-right text-xs">{toCoord(area.longitude)?.toFixed(5) ?? '—'}</span>
                                </>
                            )}
                        </div>
                        {area.description && (
                            <p className="mt-3 text-sm text-gray-600 border-t pt-3 leading-relaxed">{area.description}</p>
                        )}
                    </DetailCard>
                )}

                {activeTab === 'superviseurs' && (
                    <div className="space-y-3">
                        <div className="space-y-1">
                            <p className="text-xs font-medium text-gray-600">Ajouter un superviseur CDZ</p>
                            <SearchableSelect
                                options={availableOptions}
                                value={undefined}
                                onChange={async (v) => {
                                    try {
                                        await assignUser.mutateAsync(Number(v));
                                        toast.success('Superviseur assigné.');
                                    } catch (err) {
                                        toast.error(getErrorMessage(err));
                                    }
                                }}
                                placeholder="Rechercher un CDZ..."
                            />
                        </div>
                        <div className="space-y-2 mt-3">
                            {(usersData?.users.length ?? 0) === 0 ? (
                                <div className="flex flex-col items-center py-8 text-gray-400">
                                    <Users className="w-8 h-8 mb-2 opacity-30" />
                                    <p className="text-sm">Aucun superviseur assigné</p>
                                </div>
                            ) : (
                                usersData?.users.map((u) => (
                                    <div
                                        key={u.id}
                                        className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-white group hover:border-gray-300 transition-colors"
                                    >
                                        <div className="w-9 h-9 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-xs font-bold shrink-0">
                                            {u.name.split(' ').map((p: string) => p[0] ?? '').slice(0, 2).join('').toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-semibold text-gray-800 truncate">{u.name}</p>
                                            <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                        </div>
                                        <button
                                            onClick={async () => {
                                                try {
                                                    await removeUser.mutateAsync(u.id);
                                                    toast.success('Superviseur retiré.');
                                                } catch (err) {
                                                    toast.error(getErrorMessage(err));
                                                }
                                            }}
                                            className="p-1.5 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-red-50 text-red-400 hover:text-red-600 transition-all"
                                        >
                                            <X className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

// ─── Type filter tabs ─────────────────────────────────────────────────────────

function TypeFilterTabs({
    types,
    counts,
    selected,
    onSelect,
}: {
    types: GeoAreaType[];
    counts: Map<number, number>;
    selected: number | 'all';
    onSelect: (id: number | 'all') => void;
}) {
    const sortedTypes = useMemo(
        () => [...types].sort((a, b) => a.rank - b.rank),
        [types]
    );

    return (
        <div className="flex items-center gap-1 overflow-x-auto no-scrollbar pb-1">
            <button
                onClick={() => onSelect('all')}
                className={cn(
                    'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all',
                    selected === 'all'
                        ? 'bg-sage-50 border-sage-300 text-sage-700 shadow-sm'
                        : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                )}
            >
                <Layers className="w-3 h-3" />
                Tous
            </button>
            {sortedTypes.map((t) => {
                const cfg = getTypeConfig(t.rank);
                const isActive = selected === t.id;
                return (
                    <button
                        key={t.id}
                        onClick={() => onSelect(t.id)}
                        className={cn(
                            'shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-medium border transition-all',
                            isActive
                                ? `${cfg.color} shadow-sm`
                                : 'bg-white border-gray-200 text-gray-600 hover:border-gray-300'
                        )}
                    >
                        <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                        {t.name}
                        <span className={cn('ml-0.5 text-[10px] tabular-nums', isActive ? 'text-current opacity-80' : 'text-gray-400')}>
                            {counts.get(t.id) ?? 0}
                        </span>
                    </button>
                );
            })}
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function GeoGovernancePage() {
    const { data: hierarchy, isLoading: hierarchyLoading, refetch: refetchHierarchy } = useGeoHierarchy();
    const { data: listMeta, isLoading: listLoading } = useGeoAreas({ per_page: 500 });

    const [search, setSearch] = useState('');
    const [selectedTypeId, setSelectedTypeId] = useState<number | 'all'>('all');
    const [showOrphans, setShowOrphans] = useState(false);
    const [selectedArea, setSelectedArea] = useState<GeoArea | null>(null);
    const [editingArea, setEditingArea] = useState<GeoArea | null | undefined>(undefined);
    const [parentForCreate, setParentForCreate] = useState<GeoArea | null>(null);
    const [areaToDelete, setAreaToDelete] = useState<GeoArea | null>(null);

    const createArea = useCreateGeoArea();
    const updateArea = useUpdateGeoArea(editingArea?.id ?? 0);
    const deleteArea = useDeleteGeoArea();

    const typesById = useMemo(
        () => new Map((listMeta?.geoAreaTypes ?? []).map((t) => [t.id, t])),
        [listMeta]
    );

    const { tree, orphans } = useMemo(
        () => normalizeTree(hierarchy ?? [], typesById),
        [hierarchy, typesById]
    );

    const typeCounts = useMemo(() => {
        const map = new Map<number, number>();
        for (const t of listMeta?.geoAreaTypes ?? []) {
            map.set(t.id, countByType(tree, t.id));
        }
        return map;
    }, [tree, listMeta]);

    const displayRoots = useMemo(() => {
        if (selectedTypeId === 'all') return tree;
        return collectNodesByType(tree, selectedTypeId);
    }, [tree, selectedTypeId]);

    const filteredRoots = search.trim() ? filterTree(displayRoots, search.toLowerCase()) : displayRoots;
    const filteredOrphans = search.trim() ? filterTree(orphans, search.toLowerCase()) : orphans;

    const totalCount = countTree(tree);

    function handleAction(action: 'edit' | 'add-child' | 'delete' | 'assign-user', area: GeoArea) {
        if (action === 'edit') {
            setEditingArea(area);
        } else if (action === 'add-child') {
            setParentForCreate(area);
            setEditingArea(null);
        } else if (action === 'delete') {
            setAreaToDelete(area);
        } else if (action === 'assign-user') {
            setSelectedArea(area);
        }
    }

    const handleAddChild = (area: GeoArea) => {
        setParentForCreate(area);
        setEditingArea(null);
    };

    const handleFormSubmit = async (payload: CreateGeoAreaPayload | UpdateGeoAreaPayload) => {
        try {
            if (editingArea) {
                await updateArea.mutateAsync(payload);
                toast.success('Zone mise à jour.');
            } else {
                const createPayload: CreateGeoAreaPayload = {
                    ...(payload as CreateGeoAreaPayload),
                    parent_code: parentForCreate?.code ?? (payload as CreateGeoAreaPayload).parent_code,
                };
                await createArea.mutateAsync(createPayload);
                toast.success('Zone créée.');
            }
            setEditingArea(undefined);
            setParentForCreate(null);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const handleFormCancel = () => {
        setEditingArea(undefined);
        setParentForCreate(null);
    };

    const handleDelete = async () => {
        if (!areaToDelete) return;
        try {
            await deleteArea.mutateAsync(areaToDelete.id);
            toast.success('Zone supprimée.');
            setAreaToDelete(null);
            if (selectedArea?.id === areaToDelete.id) setSelectedArea(null);
        } catch (err) {
            toast.error(getErrorMessage(err));
        }
    };

    const isFormOpen = editingArea !== undefined;

    const actionGroups = [
        {
            items: [
                {
                    icon: Plus,
                    label: 'Nouvelle zone',
                    variant: 'primary' as const,
                    onClick: () => { setParentForCreate(null); setEditingArea(null); },
                },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetchHierarchy() },
            ],
        },
        ...(selectedArea && !isFormOpen
            ? [{
                items: [
                    { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingArea(selectedArea) },
                    {
                        icon: GitBranch,
                        label: 'Sous-zone',
                        variant: 'default' as const,
                        onClick: () => { setParentForCreate(selectedArea); setEditingArea(null); },
                    },
                    { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setAreaToDelete(selectedArea) },
                ],
            }]
            : []),
    ];

    // ── Left panel ──────────────────────────────────────────────────────────

    const leftContent = (
        <div className="h-full bg-white flex flex-col border-r border-gray-100">
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0 space-y-3">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-sage-50 border border-sage-100 flex items-center justify-center">
                            <FolderTree className="w-3.5 h-3.5 text-sage-600" />
                        </div>
                        <div>
                            <h1 className="text-sm font-semibold text-gray-900 leading-none">Arborescence</h1>
                            {!(hierarchyLoading || listLoading) && (
                                <p className="text-[10px] text-gray-400 mt-0.5">{totalCount} zones</p>
                            )}
                        </div>
                    </div>
                    <Button
                        size="sm"
                        className="h-7 text-xs gap-1 px-2"
                        onClick={() => { setParentForCreate(null); setEditingArea(null); }}
                    >
                        <Plus className="w-3.5 h-3.5" />
                        Nouveau
                    </Button>
                </div>

                {/* Search */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                        placeholder="Rechercher une zone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs pl-8 bg-gray-50 border-gray-200"
                    />
                    {search && (
                        <button
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                            onClick={() => setSearch('')}
                        >
                            <X className="w-3.5 h-3.5" />
                        </button>
                    )}
                </div>

                {/* Type filter tabs */}
                {!(hierarchyLoading || listLoading) && (
                    <TypeFilterTabs
                        types={listMeta?.geoAreaTypes ?? []}
                        counts={typeCounts}
                        selected={selectedTypeId}
                        onSelect={setSelectedTypeId}
                    />
                )}
            </div>

            {/* Tree */}
            <div className="flex-1 overflow-y-auto px-2 py-2 space-y-0.5">
                {hierarchyLoading || listLoading ? (
                    <div className="space-y-1 px-2 pt-2">
                        {[...Array(6)].map((_, i) => (
                            <div key={i} className="h-7 rounded-lg bg-gray-100 animate-pulse" style={{ marginLeft: `${(i % 3) * 16}px` }} />
                        ))}
                    </div>
                ) : filteredRoots.length === 0 && filteredOrphans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
                        <FolderTree className="w-8 h-8 mb-2 opacity-30" />
                        <p className="text-xs">
                            {search ? `Aucun résultat pour "${search}"` : 'Aucune zone trouvée'}
                        </p>
                    </div>
                ) : (
                    <>
                        {filteredRoots.map((node) => (
                            <LazyTreeNode
                                key={node.id}
                                node={node}
                                level={0}
                                selectedId={selectedArea?.id ?? null}
                                onSelect={(area) => { setSelectedArea(area); setEditingArea(undefined); }}
                                onAction={handleAction}
                            />
                        ))}

                        {/* Orphans — anomaly section */}
                        {filteredOrphans.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-amber-200">
                                <button
                                    className="w-full flex items-center gap-1.5 px-2 pb-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wider hover:text-amber-700"
                                    onClick={() => setShowOrphans((v) => !v)}
                                >
                                    <AlertTriangle className="w-3 h-3" />
                                    Zones à corriger ({filteredOrphans.length})
                                    <ChevronDown className={cn('w-3 h-3 ml-auto transition-transform', showOrphans && 'rotate-180')} />
                                </button>

                                {showOrphans && (
                                    <>
                                        <p className="px-2 pb-2 text-[10px] text-gray-500 leading-relaxed">
                                            Données orphelines : <strong>parent_code</strong> non trouvé dans l'arbre.
                                            Corrigez le champ « Zone parente » via <strong>Modifier</strong>.
                                        </p>
                                        <div className="space-y-0.5">
                                            {filteredOrphans.map((node) => {
                                                const cfg = getTypeConfig(node.geo_area_type?.rank ?? 0);
                                                return (
                                                    <div
                                                        key={node.id}
                                                        className="group flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-amber-50/50 border border-transparent hover:border-amber-100"
                                                    >
                                                        <span className={`w-2 h-2 rounded-full ${cfg.dot}`} />
                                                        <button
                                                            className="flex-1 text-left min-w-0"
                                                            onClick={() => { setSelectedArea(node); setEditingArea(undefined); }}
                                                        >
                                                            <div className="flex items-center gap-2">
                                                                <span className="text-sm text-gray-700 truncate">{node.name}</span>
                                                                <span className="text-[9px] text-gray-400 font-mono shrink-0">{node.code}</span>
                                                            </div>
                                                            <div className="flex items-center gap-1.5 text-[10px] text-amber-600">
                                                                <AlertCircle className="w-3 h-3" />
                                                                Parent manquant :
                                                                <span className="font-mono">{node.parent_code}</span>
                                                            </div>
                                                        </button>
                                                        <NodeMenu node={node} onAction={handleAction} />
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Footer stats */}
            {!(hierarchyLoading || listLoading) && orphans.length > 0 && (
                <div
                    className="px-4 py-2 border-t border-amber-100 bg-amber-50 flex items-center gap-1.5 cursor-pointer hover:bg-amber-100 transition-colors"
                    onClick={() => setShowOrphans(true)}
                >
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                    <p className="text-[10px] text-amber-700">
                        {orphans.length} zone{orphans.length > 1 ? 's' : ''} sans parent valide
                    </p>
                </div>
            )}
        </div>
    );

    // ── Main content ─────────────────────────────────────────────────────────

    const mainContent = (
        <div className="h-full flex flex-col min-w-0">
            {/* Delete confirm dialog */}
            <Dialog open={!!areaToDelete} onOpenChange={(open) => !open && setAreaToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <Trash2 className="h-5 w-5" />
                            Supprimer la zone ?
                        </DialogTitle>
                        <DialogDescription>
                            Vous allez supprimer <strong>{areaToDelete?.name}</strong> ({areaToDelete?.code}).
                            Cette action échoue si la zone possède des sous-zones.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setAreaToDelete(null)}>Annuler</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteArea.isPending}>
                            Supprimer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <div className="flex-1 min-h-0">
                {isFormOpen ? (
                    <GeoAreaFormPanel
                        editingArea={editingArea ?? null}
                        parentForCreate={parentForCreate}
                        geoAreaTypes={listMeta?.geoAreaTypes ?? []}
                        parentAreas={listMeta?.geoAreas.data ?? []}
                        onSubmit={handleFormSubmit}
                        onCancel={handleFormCancel}
                        loading={createArea.isPending || updateArea.isPending}
                    />
                ) : selectedArea ? (
                    <GeoAreaContextPanel
                        key={selectedArea.id}
                        area={selectedArea}
                        onEdit={(area) => setEditingArea(area)}
                        onAddChild={handleAddChild}
                        onClose={() => setSelectedArea(null)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-gradient-to-b from-slate-50/60 to-white">
                        <div className="w-20 h-20 rounded-2xl bg-sage-50 border border-sage-100 flex items-center justify-center mb-6">
                            <Globe2 className="w-9 h-9 text-sage-500" />
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Gouvernance Géographique</h2>
                        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                            Sélectionnez une zone dans l'arborescence pour voir ses informations,
                            gérer ses superviseurs CDZ ou créer des sous-zones.
                        </p>
                        <div className="flex items-center gap-3 mt-6">
                            <Button
                                variant="outline"
                                onClick={() => { setParentForCreate(null); setEditingArea(null); }}
                            >
                                <Plus className="w-4 h-4 mr-2" />
                                Créer une zone racine
                            </Button>
                        </div>

                        {!(hierarchyLoading || listLoading) && (
                            <div className="flex items-center gap-6 mt-8 text-xs text-gray-400">
                                <div className="flex items-center gap-1.5">
                                    <Layers className="w-3.5 h-3.5" />
                                    <span><strong className="text-gray-600">{totalCount}</strong> zones</span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                    <Users className="w-3.5 h-3.5" />
                                    <span><strong className="text-gray-600">{listMeta?.geoAreaTypes.length ?? 0}</strong> niveaux</span>
                                </div>
                                {orphans.length > 0 && (
                                    <div className="flex items-center gap-1.5 text-amber-500">
                                        <AlertTriangle className="w-3.5 h-3.5" />
                                        <span><strong>{orphans.length}</strong> à corriger</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return (
        <MasterLayout
            leftContent={leftContent}
            mainContent={mainContent}
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
