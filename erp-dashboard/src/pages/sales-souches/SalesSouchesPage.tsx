import { useRef, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { DetailCard } from '@/components/common/DetailCard';
import { SalesSoucheForm } from '@/components/sales-souches/SalesSoucheForm';
import { SalesSouchesTable } from '@/components/sales-souches/SalesSouchesTable';
import {
    useCreateSalesSouche,
    useDeleteSalesSouche,
    useSalesSouche,
    useSalesSouches,
    useUpdateSalesSouche,
} from '@/hooks/salesSouches/useSalesSouches';
import type {
    CreateSalesSouchePayload,
    SalesSouche,
    SalesSoucheDeleteConflictResponse,
    SalesSoucheFilters,
    UpdateSalesSouchePayload,
} from '@/types/salesSouches.types';
import {
    Plus, Landmark, AlertTriangle, Edit2, Trash2, X,
    RotateCcw, ArrowLeft, Settings2, Hash, Link2,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function isDeleteConflict(response: unknown): response is SalesSoucheDeleteConflictResponse {
    return typeof response === 'object' && response !== null && 'references' in response;
}

const DEFAULT_FILTERS: SalesSoucheFilters = { per_page: 50, page: 1 };

// ─── Detail view ──────────────────────────────────────────────────────────────

function SalesSoucheDetail({ souche }: { souche: SalesSouche }) {
    return (
        <div className="h-full bg-slate-50/60 flex flex-col overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Landmark className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-sm font-bold text-gray-900">{souche.name}</h1>
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            {souche.code}
                        </span>
                        <span className={cn(
                            'text-[10px] font-semibold px-2 py-0.5 rounded-full border',
                            souche.is_active
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-gray-500 bg-gray-100 border-gray-200',
                        )}>
                            {souche.is_active ? 'Active' : 'Inactive'}
                        </span>
                        {souche.is_default && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Défaut
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Souche de vente</p>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Portée" icon={Settings2} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Branche</span>
                                <span className="font-medium">{souche.branch_code ?? 'Globale (toutes)'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Type fiscal</span>
                                <span className="font-medium">{souche.fiscal_type === 'declared' ? 'Déclarée' : 'Interne'}</span>
                            </div>
                        </div>
                    </DetailCard>

                    <DetailCard title="Série de numérotation" icon={Hash} accent="blue">
                        <div className="flex items-center gap-2">
                            <Link2 className="h-4 w-4 text-gray-400" />
                            <div>
                                <p className="font-mono text-sm font-medium">{souche.token_serie?.code ?? `#${souche.token_serie_id}`}</p>
                                {souche.token_serie?.name && (
                                    <p className="text-xs text-muted-foreground">{souche.token_serie.name}</p>
                                )}
                            </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                            Non modifiable — supprimer/recréer pour changer de série.
                        </p>
                    </DetailCard>
                </div>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function SalesSouchesPage() {
    const [filters, setFilters] = useState<SalesSoucheFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useSalesSouches(filters);

    const [viewSelected, setViewSelected] = useState<SalesSouche | null>(null);
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');
    const [editTarget, setEditTarget] = useState<SalesSouche | null>(null);
    const [soucheToDelete, setSoucheToDelete] = useState<SalesSouche | null>(null);
    const [conflictRefs, setConflictRefs] = useState<string[] | null>(null);
    // 409 on create/update — another souche is already is_default for this
    // scope (§10.10). conflictingId lets the dialog offer a direct jump to it.
    const [conflictingId, setConflictingId] = useState<number | null>(null);

    const formRef = useRef<HTMLFormElement>(null);

    const { data: conflictingSouche } = useSalesSouche(conflictingId);
    const createSouche = useCreateSalesSouche();
    const updateSouche = useUpdateSalesSouche(editTarget?.id ?? 0);
    const deleteSouche = useDeleteSalesSouche();

    // ── Form actions ──────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditTarget(null);
        setFormMode('create');
    };

    const openEdit = (souche: SalesSouche) => {
        setEditTarget(souche);
        setFormMode('edit');
    };

    const cancelForm = () => {
        setEditTarget(null);
        setFormMode('view');
    };

    const handleFormSubmit = async (payload: CreateSalesSouchePayload | UpdateSalesSouchePayload) => {
        try {
            if (formMode === 'edit' && editTarget) {
                await updateSouche.mutateAsync(payload as UpdateSalesSouchePayload);
                toast.success('Souche mise à jour.');
                setViewSelected(prev => prev?.id === editTarget.id
                    ? { ...prev, ...(payload as UpdateSalesSouchePayload) }
                    : prev
                );
            } else {
                await createSouche.mutateAsync(payload as CreateSalesSouchePayload);
                toast.success('Souche créée.');
            }
            cancelForm();
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409 && error.response.data?.conflicting_sales_souche_id) {
                setConflictingId(error.response.data.conflicting_sales_souche_id);
                return;
            }
            toast.error(getErrorMessage(error));
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!soucheToDelete) return;
        const idToDelete = soucheToDelete.id;
        // Same ordering as useDeleteTokenSerie's page — clear every state var
        // keeping a useSalesSouche(id) query enabled for this id BEFORE the
        // mutation resolves, so its own cache invalidation doesn't refetch a
        // just-deleted (now 404ing) resource still "enabled" by leftover state.
        setSoucheToDelete(null);
        if (viewSelected?.id === idToDelete) setViewSelected(null);
        if (editTarget?.id === idToDelete) { setEditTarget(null); setFormMode('view'); }
        try {
            const result = await deleteSouche.mutateAsync(idToDelete);
            if (isDeleteConflict(result)) { setConflictRefs(result.references); return; }
            toast.success('Souche supprimée.');
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409) {
                setConflictRefs(error.response.data.references ?? []);
                return;
            }
            toast.error(getErrorMessage(error));
        }
    };

    // ── Action panel ───────────────────────────────────────────────────────────
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (formMode !== 'view') {
            return [{ items: [
                {
                    icon: Plus,
                    label: 'Sauvegarder',
                    variant: 'primary' as const,
                    onClick: () => formRef.current?.requestSubmit(),
                    disabled: createSouche.isPending || updateSouche.isPending,
                },
                { icon: X, label: 'Annuler', variant: 'warning' as const, onClick: cancelForm },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: Plus,      label: 'Nouvelle souche', variant: 'primary' as const, onClick: openCreate },
            { icon: RotateCcw, label: 'Rafraîchir',      onClick: () => refetch() },
        ];
        if (viewSelected) {
            return [
                { items: base },
                { items: [
                    { icon: Edit2,  label: 'Éditer',    variant: 'sage' as const,   onClick: () => openEdit(viewSelected) },
                    { icon: Trash2, label: 'Supprimer', variant: 'danger' as const, onClick: () => setSoucheToDelete(viewSelected) },
                ]},
            ];
        }
        return [{ items: base }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formMode, viewSelected, createSouche.isPending, updateSouche.isPending]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <Landmark className="h-4 w-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Souches de vente</h2>
                                {data?.meta?.total != null && (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                        {data.meta.total}
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <input
                                    id="active-only"
                                    type="checkbox"
                                    checked={!!filters.active_only}
                                    onChange={(e) => setFilters(prev => ({ ...prev, active_only: e.target.checked, page: 1 }))}
                                    className="w-3.5 h-3.5"
                                />
                                <Label htmlFor="active-only" className="text-xs text-gray-600 cursor-pointer">Actives uniquement</Label>
                            </div>
                        </div>
                        <div className="flex-1 min-h-0">
                            <SalesSouchesTable
                                response={data}
                                loading={isLoading}
                                selected={viewSelected}
                                onSelect={souche => {
                                    setViewSelected(souche);
                                    if (formMode !== 'view') cancelForm();
                                }}
                                onPageChange={(page) => setFilters(prev => ({ ...prev, page }))}
                            />
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full flex flex-col overflow-hidden">
                        {formMode !== 'view' ? (
                            /* ── Inline form ── */
                            <div className="h-full bg-slate-50/60 flex flex-col overflow-hidden">
                                <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                                    <button
                                        onClick={cancelForm}
                                        className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-800 transition-colors mr-1"
                                    >
                                        <ArrowLeft className="w-3.5 h-3.5" />
                                    </button>
                                    <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white shadow-sm shrink-0">
                                        <Landmark className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h1 className="text-sm font-bold text-gray-900">
                                            {formMode === 'create' ? 'Nouvelle souche' : `Modifier — ${editTarget?.name}`}
                                        </h1>
                                        <p className="text-[11px] text-gray-400">
                                            {formMode === 'create' ? 'Souche de vente' : editTarget?.code}
                                        </p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                        {formMode === 'create' ? 'Nouveau' : 'Édition'}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <SalesSoucheForm
                                        key={formMode === 'edit' ? `edit-${editTarget?.id}` : 'create'}
                                        souche={formMode === 'edit' ? editTarget : null}
                                        onSubmit={handleFormSubmit}
                                        onCancel={cancelForm}
                                        loading={createSouche.isPending || updateSouche.isPending}
                                        formRef={formRef}
                                        hideFooter
                                    />
                                </div>
                            </div>
                        ) : viewSelected ? (
                            /* ── Detail view ── */
                            <SalesSoucheDetail souche={viewSelected} />
                        ) : (
                            /* ── Empty state ── */
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/60">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100 mb-4">
                                    <Landmark className="w-10 h-10 text-gray-200" />
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Souches de vente</p>
                                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                    Sélectionnez une souche pour voir ses détails, ou créez-en une nouvelle (la série de numérotation doit déjà exister).
                                </p>
                                <Button size="sm" onClick={openCreate} className="mt-4 bg-sage-600 hover:bg-sage-700">
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nouvelle souche
                                </Button>
                            </div>
                        )}
                    </div>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Delete confirm */}
            <Dialog open={!!soucheToDelete} onOpenChange={(open) => !open && setSoucheToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Supprimer la souche ?
                        </DialogTitle>
                        <DialogDescription>
                            {soucheToDelete && (
                                <>
                                    Vous allez supprimer la souche{' '}
                                    <Badge variant="outline">{soucheToDelete.code}</Badge> :{' '}
                                    <strong>{soucheToDelete.name}</strong>.
                                    <br /><br />
                                    Cette action est irréversible.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSoucheToDelete(null)}>Annuler</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteSouche.isPending}>
                            Supprimer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Delete-blocked conflict dialog (references[]) */}
            <Dialog open={!!conflictRefs} onOpenChange={(open) => !open && setConflictRefs(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Suppression impossible
                        </DialogTitle>
                        <DialogDescription>
                            Cette souche est encore référencée. Déliez-la d'abord :
                            <ul className="mt-2 list-disc pl-4 text-xs text-muted-foreground">
                                {conflictRefs?.map((ref, i) => <li key={i}>{ref}</li>)}
                            </ul>
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setConflictRefs(null)}>Compris</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Default-souche conflict on create/update (409 conflicting_sales_souche_id) */}
            <Dialog open={!!conflictingId} onOpenChange={(open) => !open && setConflictingId(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="h-5 w-5" />
                            Une souche par défaut existe déjà
                        </DialogTitle>
                        <DialogDescription>
                            Une seule souche active peut être « par défaut » pour cette branche/société.
                            {conflictingSouche && (
                                <>
                                    {' '}La souche actuelle est <Badge variant="outline">{conflictingSouche.code}</Badge> — <strong>{conflictingSouche.name}</strong>.
                                    Désactivez-la comme souche par défaut d'abord.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        {conflictingSouche && (
                            <Button
                                variant="outline"
                                onClick={() => {
                                    setViewSelected(conflictingSouche);
                                    cancelForm();
                                    setConflictingId(null);
                                }}
                            >
                                Voir cette souche
                            </Button>
                        )}
                        <Button onClick={() => setConflictingId(null)}>Compris</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
