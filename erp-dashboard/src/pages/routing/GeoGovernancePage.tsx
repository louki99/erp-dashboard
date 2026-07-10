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
import { useUsersOptions } from '@/hooks/tokenSeries/useEntitySelectors';
import type { CreateGeoAreaPayload, GeoArea, GeoAreaType, UpdateGeoAreaPayload } from '@/types/routing.types';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

// API returns decimals as strings — normalize before toFixed
function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) ? n : null;
}

const TYPE_ICONS: Record<number, string> = {
    100: '🌍',
    200: '📍',
    300: '🏙️',
    400: '🏘️',
    500: '🗺️',
    600: '📌',
};

// ─── Client-side tree normalization ─────────────────────────────────────────
// The /hierarchy endpoint can return misplaced roots (sectors whose parent
// exists elsewhere in the payload) and omits the geo_area_type relation.
// Rebuild the nesting from parent_code and enrich each node; zones whose
// parent_code points to a code absent from the dataset are surfaced as
// orphans instead of polluting the root level.
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

    // resolve parent relation for the detail panel
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
            // leaf: drop the empty array so LazyTreeNode can still lazy-load
            // localités via /children when the hierarchy payload omitted them
            else n.children = undefined;
        }
    };
    sortRec(tree);
    sortRec(orphans);

    return { tree, orphans };
}

// ─── Lazy Tree Node ──────────────────────────────────────────────────────────

// ─── Mini Dropdown ────────────────────────────────────────────────────────────

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
        <div ref={ref} className="relative shrink-0 mr-1">
            <Button
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
            >
                <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
            {open && (
                <div className="absolute right-0 top-7 z-50 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1 text-sm">
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('add-child', node); }}
                    >
                        <Plus className="w-3.5 h-3.5 text-gray-400" />
                        Ajouter une sous-zone
                    </button>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('edit', node); }}
                    >
                        <Edit2 className="w-3.5 h-3.5 text-gray-400" />
                        Modifier
                    </button>
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 text-gray-700 text-left"
                        onClick={(e) => { e.stopPropagation(); setOpen(false); onAction('assign-user', node); }}
                    >
                        <Users className="w-3.5 h-3.5 text-gray-400" />
                        Affecter superviseur
                    </button>
                    <div className="border-t border-gray-100 my-1" />
                    <button
                        className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-red-50 text-red-600 text-left"
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

// ─── Lazy Tree Node ──────────────────────────────────────────────────────────

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
    const hasChildren = (node.children?.length ?? 0) > 0 || loadChildren;
    const isSelected = selectedId === node.id;
    const typeRank = node.geo_area_type?.rank ?? 0;
    const icon = TYPE_ICONS[typeRank] ?? '📌';

    const handleToggle = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!node.children && !loadChildren) {
            setLoadChildren(true);
        }
        setExpanded((v) => !v);
    };

    return (
        <div>
            <div
                className={cn(
                    'group flex items-center gap-1 rounded-lg cursor-pointer transition-colors',
                    isSelected ? 'bg-sage-100' : 'hover:bg-gray-50'
                )}
                style={{ paddingLeft: `${level * 16 + 4}px` }}
            >
                <button
                    className="p-1 rounded hover:bg-gray-200 text-gray-400"
                    onClick={handleToggle}
                >
                    {loadingChildren ? (
                        <span className="w-3.5 h-3.5 block animate-spin border border-gray-300 border-t-sage-500 rounded-full" />
                    ) : expanded ? (
                        <ChevronRight className="w-3.5 h-3.5 rotate-90 transition-transform" />
                    ) : (
                        <ChevronRight className="w-3.5 h-3.5 transition-transform" />
                    )}
                </button>

                <button
                    className="flex-1 flex items-center gap-2 py-1.5 pr-1 text-left min-w-0"
                    onClick={() => onSelect(node)}
                >
                    <span className="text-sm shrink-0">{icon}</span>
                    <span className={cn('text-sm truncate', isSelected ? 'font-semibold text-sage-800' : 'text-gray-700')}>
                        {node.name}
                    </span>
                    <span className="text-[10px] text-gray-400 font-mono shrink-0">{node.code}</span>
                    {!node.is_active && (
                        <Badge variant="secondary" className="text-[9px] px-1 py-0 shrink-0">Inactif</Badge>
                    )}
                </button>

                <NodeMenu node={node} onAction={onAction} />
            </div>

            {expanded && children.length > 0 && (
                <div>
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

// ─── Context Panel ───────────────────────────────────────────────────────────

function GeoAreaContextPanel({
    area,
    onEdit,
    onClose,
}: {
    area: GeoArea;
    onEdit: (area: GeoArea) => void;
    onClose: () => void;
}) {
    const { data: usersData } = useGeoAreaUsers(area.id);
    const assignUser = useAssignGeoAreaUser(area.id);
    const removeUser = useRemoveGeoAreaUser(area.id);
    const { data: userOptions } = useUsersOptions();

    const assignedIds = usersData?.users.map((u) => u.id) ?? [];
    const availableOptions =
        userOptions
            ?.filter((u) => !assignedIds.includes(u.value as number))
            .map((u) => ({ value: u.value, label: u.label })) ?? [];

    const typeRank = area.geo_area_type?.rank ?? 0;
    const icon = TYPE_ICONS[typeRank] ?? '📌';

    return (
        <div className="h-full flex flex-col bg-slate-50/50">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-white shrink-0">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-xl">
                        {icon}
                    </div>
                    <div>
                        <h2 className="text-base font-bold text-gray-900">{area.name}</h2>
                        <p className="text-xs font-mono text-gray-500">
                            {area.code}
                            {area.name_ar && <span className="ml-2 text-gray-400">{area.name_ar}</span>}
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <Badge variant={area.is_active ? 'success' : 'secondary'} className="text-[10px]">
                        {area.is_active ? 'Actif' : 'Inactif'}
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={onClose} className="h-7 w-7 p-0">
                        <X className="w-4 h-4" />
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <DetailCard title="Informations" icon={MapPin} accent="sage">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                        <span className="text-muted-foreground">Type</span>
                        <span className="font-medium text-right">{area.geo_area_type?.name ?? area.geo_area_type_id}</span>
                        <span className="text-muted-foreground">Parent</span>
                        <span className="font-medium text-right">{area.parent?.name ?? '—'}</span>
                        {toCoord(area.latitude) !== null && (
                            <>
                                <span className="text-muted-foreground">Lat / Lng</span>
                                <span className="font-mono text-right text-xs">
                                    {toCoord(area.latitude)?.toFixed(4)}, {toCoord(area.longitude)?.toFixed(4) ?? '—'}
                                </span>
                            </>
                        )}
                        <span className="text-muted-foreground">Ordre</span>
                        <span className="font-mono text-right">{area.sort_order}</span>
                    </div>
                    {area.description && (
                        <p className="mt-3 text-sm text-gray-600 border-t pt-3">{area.description}</p>
                    )}
                </DetailCard>

                <DetailCard title="Superviseurs assignés" icon={Users} accent="amber">
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
                        placeholder="Ajouter un superviseur..."
                    />
                    <div className="mt-3 space-y-2">
                        {usersData?.users.map((u) => (
                            <div
                                key={u.id}
                                className="flex items-center justify-between p-2 rounded-lg border border-gray-100 bg-white"
                            >
                                <div className="min-w-0">
                                    <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                                </div>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    className="shrink-0 h-7 w-7 p-0 text-red-400 hover:text-red-600 hover:bg-red-50"
                                    onClick={async () => {
                                        try {
                                            await removeUser.mutateAsync(u.id);
                                            toast.success('Superviseur retiré.');
                                        } catch (err) {
                                            toast.error(getErrorMessage(err));
                                        }
                                    }}
                                >
                                    <X className="w-3.5 h-3.5" />
                                </Button>
                            </div>
                        ))}
                        {(usersData?.users.length ?? 0) === 0 && (
                            <p className="text-center text-xs text-gray-400 py-4">Aucun superviseur assigné</p>
                        )}
                    </div>
                </DetailCard>

                <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => onEdit(area)}
                >
                    <Edit2 className="w-3.5 h-3.5 mr-2" />
                    Modifier cette zone
                </Button>
            </div>
        </div>
    );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export function GeoGovernancePage() {
    const { data: hierarchy, isLoading, refetch: refetchHierarchy } = useGeoHierarchy();
    const { data: listMeta } = useGeoAreas({ per_page: 500 });

    const [search, setSearch] = useState('');
    const [selectedArea, setSelectedArea] = useState<GeoArea | null>(null);

    const [editingArea, setEditingArea] = useState<GeoArea | null | undefined>(undefined);
    const [parentForCreate, setParentForCreate] = useState<GeoArea | null>(null);
    const [areaToDelete, setAreaToDelete] = useState<GeoArea | null>(null);

    const createArea = useCreateGeoArea();
    const updateArea = useUpdateGeoArea(editingArea?.id ?? 0);
    const deleteArea = useDeleteGeoArea();

    // Rebuild nesting from parent_code — see normalizeTree
    const typesById = useMemo(
        () => new Map((listMeta?.geoAreaTypes ?? []).map((t) => [t.id, t])),
        [listMeta]
    );
    const { tree, orphans } = useMemo(
        () => normalizeTree(hierarchy ?? [], typesById),
        [hierarchy, typesById]
    );

    const filteredTree = search.trim() ? filterTree(tree, search.toLowerCase()) : tree;
    const filteredOrphans = search.trim() ? filterTree(orphans, search.toLowerCase()) : orphans;

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
                    onClick: () => {
                        setParentForCreate(null);
                        setEditingArea(null);
                    },
                },
                { icon: RotateCcw, label: 'Rafraîchir', variant: 'default' as const, onClick: () => refetchHierarchy() },
            ],
        },
        ...(selectedArea
            ? [
                {
                    items: [
                        { icon: Edit2, label: 'Éditer', variant: 'sage' as const, onClick: () => setEditingArea(selectedArea) },
                        {
                            icon: Plus,
                            label: 'Sous-zone',
                            variant: 'default' as const,
                            onClick: () => {
                                setParentForCreate(selectedArea);
                                setEditingArea(null);
                            },
                        },
                        { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setAreaToDelete(selectedArea) },
                    ],
                },
            ]
            : []),
    ];

    const leftContent = (
        <div className="h-full bg-white flex flex-col">
            <div className="px-4 py-3 border-b border-gray-100 shrink-0">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <FolderTree className="w-4 h-4 text-sage-600" />
                        <h1 className="text-sm font-semibold text-gray-900">Gouvernance Géographique</h1>
                    </div>
                    <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                            setParentForCreate(null);
                            setEditingArea(null);
                        }}
                    >
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Nouveau
                    </Button>
                </div>
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <Input
                        placeholder="Rechercher une zone..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="h-8 text-xs pl-8"
                    />
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {isLoading ? (
                    <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
                        Chargement de l'arborescence…
                    </div>
                ) : filteredTree.length === 0 && filteredOrphans.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-32 text-gray-400">
                        <FolderTree className="w-8 h-8 mb-2" />
                        <p className="text-xs">Aucune zone trouvée</p>
                    </div>
                ) : (
                    <>
                        <div className="space-y-0.5">
                            {filteredTree.map((node) => (
                                <LazyTreeNode
                                    key={node.id}
                                    node={node}
                                    level={0}
                                    selectedId={selectedArea?.id ?? null}
                                    onSelect={setSelectedArea}
                                    onAction={handleAction}
                                />
                            ))}
                        </div>

                        {/* Zones whose parent_code points to a missing zone — data issue to fix via "Modifier" */}
                        {filteredOrphans.length > 0 && (
                            <div className="mt-4 pt-3 border-t border-amber-200">
                                <p className="flex items-center gap-1.5 px-2 pb-2 text-[10px] font-semibold text-amber-600 uppercase tracking-wider">
                                    <AlertTriangle className="w-3 h-3" />
                                    Zones mal rattachées ({filteredOrphans.length})
                                </p>
                                <p className="px-2 pb-2 text-[10px] text-gray-400 leading-relaxed">
                                    Le parent référencé n'existe pas. Corrigez le champ « Zone parente » via Modifier.
                                </p>
                                <div className="space-y-0.5">
                                    {filteredOrphans.map((node) => (
                                        <LazyTreeNode
                                            key={node.id}
                                            node={node}
                                            level={0}
                                            selectedId={selectedArea?.id ?? null}
                                            onSelect={setSelectedArea}
                                            onAction={handleAction}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>
        </div>
    );

    const mainContent = (
        <div className="h-full flex flex-col min-w-0">
            <div className="flex-1 min-h-0">
                {selectedArea ? (
                    <GeoAreaContextPanel
                        key={selectedArea.id}
                        area={selectedArea}
                        onEdit={(area) => setEditingArea(area)}
                        onClose={() => setSelectedArea(null)}
                    />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center p-12 bg-slate-50/40">
                        <div className="w-20 h-20 rounded-2xl bg-sage-50 flex items-center justify-center mb-6 text-4xl">
                            🗺️
                        </div>
                        <h2 className="text-lg font-semibold text-gray-800 mb-2">Gouvernance Géographique</h2>
                        <p className="text-sm text-gray-500 max-w-sm leading-relaxed">
                            Sélectionnez une zone dans l'arborescence pour voir ses détails,
                            gérer ses superviseurs ou créer des sous-zones.
                        </p>
                        <Button
                            variant="outline"
                            className="mt-6"
                            onClick={() => {
                                setParentForCreate(null);
                                setEditingArea(null);
                            }}
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Créer une zone racine
                        </Button>
                    </div>
                )}
            </div>

            {/* ── Form Dialog ── */}
            {/* (dialogs live inside mainContent so they mount with the layout) */}
            <Dialog open={isFormOpen} onOpenChange={(open) => !open && setEditingArea(undefined)}>
                <DialogContent className="max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            {editingArea
                                ? 'Modifier la zone'
                                : parentForCreate
                                ? `Nouvelle sous-zone de "${parentForCreate.name}"`
                                : 'Nouvelle zone racine'}
                        </DialogTitle>
                        <DialogDescription>
                            Renseignez le code, le nom et le type hiérarchique de la zone.
                        </DialogDescription>
                    </DialogHeader>
                    {isFormOpen && (
                        <GeoAreaForm
                            key={editingArea ? `edit-${editingArea.id}` : `create-${parentForCreate?.code ?? 'root'}`}
                            geoArea={editingArea ?? null}
                            geoAreaTypes={listMeta?.geoAreaTypes ?? []}
                            parentAreas={listMeta?.geoAreas.data ?? []}
                            defaultParentCode={parentForCreate?.code}
                            onSubmit={handleFormSubmit}
                            onCancel={() => {
                                setEditingArea(undefined);
                                setParentForCreate(null);
                            }}
                            loading={createArea.isPending || updateArea.isPending}
                        />
                    )}
                </DialogContent>
            </Dialog>

            {/* ── Delete Confirm ── */}
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

// ─── Helper: recursive search filter ────────────────────────────────────────

function filterTree(nodes: GeoArea[], q: string): GeoArea[] {
    return nodes.reduce<GeoArea[]>((acc, node) => {
        const matchSelf =
            node.name.toLowerCase().includes(q) ||
            node.code.toLowerCase().includes(q) ||
            (node.name_ar ?? '').toLowerCase().includes(q);
        const filteredChildren = filterTree(node.children ?? [], q);
        if (matchSelf || filteredChildren.length > 0) {
            acc.push({ ...node, children: filteredChildren.length > 0 ? filteredChildren : node.children });
        }
        return acc;
    }, []);
}
