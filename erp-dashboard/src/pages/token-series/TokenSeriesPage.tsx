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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { DetailCard } from '@/components/common/DetailCard';
import { Textarea } from '@/components/ui/textarea';
import { TokenSeriesForm, TokenSeriesTable } from '@/components/token-series';
import {
    useCreateTokenSerie,
    useDeleteTokenSerie,
    useResetTokenSerieFamily,
    useTokenSerie,
    useTokenSeries,
    useUpdateTokenSerie,
} from '@/hooks/tokenSeries/useTokenSeries';
import { usePermissions } from '@/hooks/usePermissions';
import type {
    CreateTokenSeriePayload,
    NumberingFamiliesMap,
    TokenSerie,
    TokenSerieConflictResponse,
    TokenSerieFilters,
    UpdateTokenSeriePayload,
} from '@/types/tokenSeries.types';
import {
    Plus, Hash, AlertTriangle, Edit2, Trash2, X,
    RotateCcw, Globe, Building2, Smartphone, Settings2,
    FileDigit, Save, ArrowLeft, Lock,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { getScopeLabel, NUMBERING_FIELDS } from '@/lib/tokenSeries';
import { cn } from '@/lib/utils';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) return error.response?.data?.message ?? error.message;
    if (error instanceof Error) return error.message;
    return 'Une erreur est survenue.';
}

function isConflictResponse(response: unknown): response is TokenSerieConflictResponse {
    return typeof response === 'object' && response !== null && 'references' in response;
}

const DEFAULT_FILTERS: TokenSerieFilters = { per_page: 50, page: 1 };

// ─── Detail view ──────────────────────────────────────────────────────────────

function TokenSeriesDetail({ serie, numberingFamilies }: { serie: TokenSerie; numberingFamilies?: NumberingFamiliesMap }) {
    const ScopeIcon = serie.scope === 'global' ? Globe : serie.scope === 'branch' ? Building2 : Smartphone;
    const scopeAccent = serie.scope === 'global' ? 'blue' : serie.scope === 'branch' ? 'amber' : 'sage';

    return (
        <div className="h-full bg-slate-50/60 flex flex-col overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 bg-white shrink-0 flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-sage-500 to-sage-600 flex items-center justify-center text-white shadow-sm shrink-0">
                    <Hash className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h1 className="text-sm font-bold text-gray-900">{serie.name}</h1>
                        <span className="text-[10px] font-mono font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-100">
                            {serie.code}
                        </span>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                            serie.is_active
                                ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
                                : 'text-gray-500 bg-gray-100 border-gray-200'
                        }`}>
                            {serie.is_active ? 'Actif' : 'Inactif'}
                        </span>
                        {serie.is_default && (
                            <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                Défaut
                            </span>
                        )}
                    </div>
                    <p className="text-[11px] text-gray-400 mt-0.5">Série de numérotation documentaire</p>
                </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Scope" icon={ScopeIcon} accent={scopeAccent}>
                        <div className="flex items-center gap-2">
                            <ScopeIcon className="h-5 w-5 text-gray-500" />
                            <span className="font-semibold text-lg">{getScopeLabel(serie.scope)}</span>
                        </div>
                        {serie.scope === 'branch' && serie.allowed_branches && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Branches : <span className="font-medium text-gray-700">{serie.allowed_branches.join(', ')}</span>
                            </p>
                        )}
                    </DetailCard>

                    <DetailCard title="Configuration" icon={Settings2} accent="sage">
                        <div className="space-y-2 text-sm">
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Chiffres compteur</span>
                                <span className="font-mono font-medium">{serie.digits_in_counter}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Génération</span>
                                <span>{serie.auto_generated ? 'Automatique' : 'Manuelle'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Par défaut</span>
                                <span>{serie.is_default ? 'Oui' : 'Non'}</span>
                            </div>
                        </div>
                    </DetailCard>
                </div>

                {serie.description && (
                    <DetailCard title="Description" accent="default">
                        <p className="text-sm text-gray-700 leading-relaxed">{serie.description}</p>
                    </DetailCard>
                )}

                <DetailCard title="Numérotation documentaire" icon={FileDigit} accent="blue">
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                        {NUMBERING_FIELDS.map((field) => {
                            const src = serie as unknown as Record<string, unknown>;
                            const prefix = src[field.prefixKey] as string | null;
                            const counter = src[field.counterKey] as number;
                            const locked = numberingFamilies?.[field.key]?.locked;
                            return (
                                <div key={field.key} className={cn('rounded-lg border p-3 shadow-sm', locked ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-100')}>
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-1">
                                        {field.label}
                                        {locked != null && (locked
                                            ? <Lock className="h-2.5 w-2.5 text-amber-600" />
                                            : <span className="text-[9px] font-semibold text-emerald-600">éditable</span>)}
                                    </p>
                                    <p className="font-mono text-sm font-medium truncate">{prefix ?? '—'}</p>
                                    <p className="text-xs text-muted-foreground mt-0.5">prochain : {counter}</p>
                                </div>
                            );
                        })}
                    </div>
                </DetailCard>
            </div>
        </div>
    );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export function TokenSeriesPage() {
    const [filters, setFilters] = useState<TokenSerieFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useTokenSeries(filters);

    const { isRoot } = usePermissions();

    const [viewSelected, setViewSelected] = useState<TokenSerie | null>(null);
    const [formMode, setFormMode] = useState<'view' | 'create' | 'edit'>('view');
    const [editTarget, setEditTarget] = useState<TokenSerie | null>(null);
    const [serieToDelete, setSerieToDelete] = useState<TokenSerie | null>(null);
    const [conflictRefs, setConflictRefs] = useState<string[] | null>(null);
    // Reset-family dialog — root-only per doc §12 governance (a general
    // admin.access-control.manage grant is NOT enough, the backend checks a
    // separate reset-token-series-counter permission). `isRoot` gates
    // whether the trigger even renders (TokenSeriesForm's onResetFamily prop).
    const [resetTarget, setResetTarget] = useState<{ family: string; currentPrefix: string | null } | null>(null);
    const [resetNewPrefix, setResetNewPrefix] = useState('');
    const [resetNewNextNumber, setResetNewNextNumber] = useState('1');
    const [resetReason, setResetReason] = useState('');

    const formRef = useRef<HTMLFormElement>(null);

    const { data: detailData } = useTokenSerie(serieToDelete?.code ?? null);
    // Edit mode needs the full detail (numbering_families' locked flags) —
    // the list row (`TokenSerie`) never carries it, only GET /{code} does.
    const { data: editDetailData } = useTokenSerie(formMode === 'edit' ? editTarget?.code ?? null : null);
    // Same for the read-only detail view — "quelle famille est verrouillée"
    // is exactly what was asked for there too, not just the edit form.
    const { data: viewDetailData } = useTokenSerie(formMode === 'view' ? viewSelected?.code ?? null : null);
    const createSerie = useCreateTokenSerie();
    const updateSerie = useUpdateTokenSerie(editTarget?.code ?? '');
    const deleteSerie = useDeleteTokenSerie();
    const resetFamily = useResetTokenSerieFamily(editTarget?.code ?? '');

    // ── Form actions ──────────────────────────────────────────────────────────
    const openCreate = () => {
        setEditTarget(null);
        setFormMode('create');
    };

    const openEdit = (serie: TokenSerie) => {
        setEditTarget(serie);
        setFormMode('edit');
    };

    const cancelForm = () => {
        setEditTarget(null);
        setFormMode('view');
    };

    // ── Reset-family (clôture d'exercice) ─────────────────────────────────────
    const openResetFamily = (family: string, currentPrefix: string | null) => {
        setResetTarget({ family, currentPrefix });
        setResetNewPrefix(currentPrefix ?? '');
        setResetNewNextNumber('1');
        setResetReason('');
    };

    const closeResetFamily = () => setResetTarget(null);

    const handleResetSubmit = async () => {
        if (!resetTarget || !editTarget) return;
        if (resetReason.trim().length < 10) { toast.error('Le motif doit contenir au moins 10 caractères.'); return; }
        try {
            await resetFamily.mutateAsync({
                family: resetTarget.family,
                new_prefix: resetNewPrefix.trim() || undefined,
                new_next_number: resetNewNextNumber ? Number(resetNewNextNumber) : undefined,
                reason: resetReason.trim(),
            });
            toast.success('Famille réinitialisée.');
            closeResetFamily();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const handleFormSubmit = async (payload: CreateTokenSeriePayload | UpdateTokenSeriePayload) => {
        try {
            if (formMode === 'edit' && editTarget) {
                await updateSerie.mutateAsync(payload as UpdateTokenSeriePayload);
                toast.success('Série mise à jour.');
                setViewSelected(prev => prev?.code === editTarget.code
                    ? { ...prev, ...(payload as UpdateTokenSeriePayload) }
                    : prev
                );
            } else {
                await createSerie.mutateAsync(payload as CreateTokenSeriePayload);
                toast.success('Série créée.');
            }
            cancelForm();
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    // ── Delete ─────────────────────────────────────────────────────────────────
    const handleDelete = async () => {
        if (!serieToDelete) return;
        const usage = detailData?.usage;
        if (usage && (usage.device_keys_count > 0 || usage.pos_devices_count > 0)) {
            setConflictRefs([
                `${usage.device_keys_count} device key(s)`,
                `${usage.pos_devices_count} POS device(s)`,
            ]);
            return;
        }
        try {
            const result = await deleteSerie.mutateAsync(serieToDelete.code);
            if (isConflictResponse(result)) { setConflictRefs(result.references); return; }
            toast.success('Série supprimée.');
            setSerieToDelete(null);
            if (viewSelected?.code === serieToDelete.code) setViewSelected(null);
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
                    icon: Save,
                    label: 'Sauvegarder',
                    variant: 'primary' as const,
                    onClick: () => formRef.current?.requestSubmit(),
                    disabled: createSerie.isPending || updateSerie.isPending,
                },
                { icon: X, label: 'Annuler', variant: 'warning' as const, onClick: cancelForm },
            ]}];
        }
        const base: ActionItemProps[] = [
            { icon: Plus,      label: 'Nouvelle série', variant: 'primary' as const, onClick: openCreate },
            { icon: RotateCcw, label: 'Rafraîchir',     onClick: () => refetch() },
        ];
        if (viewSelected) {
            return [
                { items: base },
                { items: [
                    { icon: Edit2,  label: 'Éditer',     variant: 'sage' as const,   onClick: () => openEdit(viewSelected) },
                    { icon: Trash2, label: 'Supprimer',  variant: 'danger' as const, onClick: () => setSerieToDelete(viewSelected) },
                ]},
            ];
        }
        return [{ items: base }];
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formMode, viewSelected, createSerie.isPending, updateSerie.isPending]);

    // ─────────────────────────────────────────────────────────────────────────
    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        <div className="px-4 pt-4 pb-3 border-b border-gray-100 shrink-0">
                            <div className="flex items-center gap-2 mb-3">
                                <Hash className="h-4 w-4 text-sage-600" />
                                <h2 className="text-sm font-bold text-gray-900">Séries de numérotation</h2>
                                {data?.meta?.total != null && (
                                    <span className="px-2 py-0.5 text-[10px] font-semibold rounded-full bg-sage-50 text-sage-600 border border-sage-100">
                                        {data.meta.total}
                                    </span>
                                )}
                            </div>
                            <div className="space-y-2">
                                <Input
                                    placeholder="Rechercher…"
                                    className="h-8 text-xs"
                                    onChange={() => {}}
                                />
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
                        </div>
                        <div className="flex-1 min-h-0">
                            <TokenSeriesTable
                                response={data}
                                loading={isLoading}
                                selected={viewSelected}
                                onSelect={serie => {
                                    setViewSelected(serie);
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
                                        <Hash className="w-4 h-4" />
                                    </div>
                                    <div>
                                        <h1 className="text-sm font-bold text-gray-900">
                                            {formMode === 'create' ? 'Nouvelle série' : `Modifier — ${editTarget?.name}`}
                                        </h1>
                                        <p className="text-[11px] text-gray-400">
                                            {formMode === 'create' ? 'Série de numérotation documentaire' : editTarget?.code}
                                        </p>
                                    </div>
                                    <span className="ml-auto text-[10px] font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                                        {formMode === 'create' ? 'Nouveau' : 'Édition'}
                                    </span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-6">
                                    <TokenSeriesForm
                                        key={formMode === 'edit' ? `edit-${editTarget?.code}` : 'create'}
                                        serie={formMode === 'edit' ? editTarget : null}
                                        onSubmit={handleFormSubmit}
                                        onCancel={cancelForm}
                                        loading={createSerie.isPending || updateSerie.isPending}
                                        formRef={formRef}
                                        hideFooter
                                        numberingFamilies={formMode === 'edit' ? editDetailData?.numbering_families : undefined}
                                        onResetFamily={isRoot ? openResetFamily : undefined}
                                    />
                                </div>
                            </div>
                        ) : viewSelected ? (
                            /* ── Detail view ── */
                            <TokenSeriesDetail serie={viewSelected} numberingFamilies={viewDetailData?.numbering_families} />
                        ) : (
                            /* ── Empty state ── */
                            <div className="flex-1 flex flex-col items-center justify-center p-10 text-center bg-slate-50/60">
                                <div className="w-20 h-20 rounded-2xl bg-white flex items-center justify-center shadow-md border border-gray-100 mb-4">
                                    <Hash className="w-10 h-10 text-gray-200" />
                                </div>
                                <p className="text-sm font-semibold text-gray-700">Séries de numérotation</p>
                                <p className="text-xs text-gray-400 mt-1 max-w-xs">
                                    Sélectionnez une série pour voir ses détails, ou créez-en une nouvelle.
                                </p>
                                <Button size="sm" onClick={openCreate} className="mt-4 bg-sage-600 hover:bg-sage-700">
                                    <Plus className="w-3.5 h-3.5 mr-1.5" /> Nouvelle série
                                </Button>
                            </div>
                        )}
                    </div>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            {/* Delete confirm */}
            <Dialog open={!!serieToDelete} onOpenChange={(open) => !open && setSerieToDelete(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-destructive">
                            <AlertTriangle className="h-5 w-5" />
                            Supprimer la série ?
                        </DialogTitle>
                        <DialogDescription>
                            {serieToDelete && (
                                <>
                                    Vous allez supprimer la série{' '}
                                    <Badge variant="outline">{serieToDelete.code}</Badge> :{' '}
                                    <strong>{serieToDelete.name}</strong>.
                                    <br /><br />
                                    Cette action est irréversible.
                                </>
                            )}
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setSerieToDelete(null)}>Annuler</Button>
                        <Button variant="destructive" onClick={handleDelete} disabled={deleteSerie.isPending}>
                            Supprimer
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Conflict dialog */}
            <Dialog open={!!conflictRefs} onOpenChange={(open) => !open && setConflictRefs(null)}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <AlertTriangle className="h-5 w-5" />
                            Suppression impossible
                        </DialogTitle>
                        <DialogDescription>
                            Cette série est encore référencée. Réassignez ou supprimez d'abord :
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

            {/* Reset-family dialog — clôture d'exercice escape hatch, root-only.
                Not a real fiscal-period workflow (no such entity exists here) —
                just the one sanctioned action a root runs to unlock an
                already-consumed family, per the doc's own framing. */}
            <Dialog open={!!resetTarget} onOpenChange={(open) => !open && closeResetFamily()}>
                <DialogContent className="max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-amber-700">
                            <AlertTriangle className="h-5 w-5" />
                            Réinitialiser la famille « {resetTarget?.family} »
                        </DialogTitle>
                        <DialogDescription>
                            Cette famille est déjà consommée (un numéro a suffi pour la verrouiller). La réinitialiser change le préfixe et/ou repart le compteur à un nouveau numéro — action tracée dans les logs avec l'avant/après.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3 py-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="reset-prefix">Nouveau préfixe</Label>
                            <Input
                                id="reset-prefix"
                                value={resetNewPrefix}
                                onChange={(e) => setResetNewPrefix(e.target.value)}
                                placeholder={resetTarget?.currentPrefix ?? 'Préfixe'}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reset-next-number">Nouveau compteur</Label>
                            <Input
                                id="reset-next-number"
                                type="number"
                                min={1}
                                value={resetNewNextNumber}
                                onChange={(e) => setResetNewNextNumber(e.target.value)}
                            />
                        </div>
                        <div className="space-y-1.5">
                            <Label htmlFor="reset-reason">Motif (10-500 caractères) <span className="text-destructive">*</span></Label>
                            <Textarea
                                id="reset-reason"
                                value={resetReason}
                                onChange={(e) => setResetReason(e.target.value)}
                                placeholder="Ex : Clôture exercice 2026 - nouvelle série 2027"
                                rows={3}
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={closeResetFamily}>Annuler</Button>
                        <Button variant="destructive" onClick={handleResetSubmit} disabled={resetFamily.isPending}>
                            Réinitialiser
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
