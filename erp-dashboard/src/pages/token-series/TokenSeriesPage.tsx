import { useState } from 'react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
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

import { TokenSeriesForm, TokenSeriesTable } from '@/components/token-series';
import { DetailCard } from '@/components/common/DetailCard';
import {
    useCreateTokenSerie,
    useDeleteTokenSerie,
    useTokenSerie,
    useTokenSeries,
    useUpdateTokenSerie,
} from '@/hooks/tokenSeries/useTokenSeries';
import type {
    CreateTokenSeriePayload,
    TokenSerie,
    TokenSerieConflictResponse,
    TokenSerieFilters,
    UpdateTokenSeriePayload,
} from '@/types/tokenSeries.types';
import {
    Plus,
    Hash,
    AlertTriangle,
    Edit2,
    Trash2,
    X,
    RotateCcw,
    Globe,
    Building2,
    Smartphone,
    Settings2,
    FileDigit,
} from 'lucide-react';
import { isAxiosError } from 'axios';
import { getScopeLabel, NUMBERING_FIELDS } from '@/lib/tokenSeries';

function getErrorMessage(error: unknown): string {
    if (isAxiosError(error)) {
        return error.response?.data?.message ?? error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return 'Une erreur est survenue.';
}

function isConflictResponse(response: unknown): response is TokenSerieConflictResponse {
    return typeof response === 'object' && response !== null && 'references' in response;
}

const DEFAULT_FILTERS: TokenSerieFilters = { per_page: 50, page: 1 };

function TokenSeriesDetail({
    serie,
    onBack,
}: {
    serie: TokenSerie;
    onBack?: () => void;
}) {
    const ScopeIcon = serie.scope === 'global' ? Globe : serie.scope === 'branch' ? Building2 : Smartphone;
    const scopeAccent = serie.scope === 'global' ? 'blue' : serie.scope === 'branch' ? 'amber' : 'sage';

    return (
        <div className="h-full bg-slate-50/60 flex flex-col">
            <div className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-sage-100 text-sage-700">
                        <Hash className="h-5 w-5" />
                    </div>
                    <div>
                        <h1 className="text-xl font-bold text-gray-900">{serie.name}</h1>
                        <p className="text-sm font-mono text-gray-500">{serie.code}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {serie.is_active ? (
                        <Badge variant="success" className="text-[10px]">Actif</Badge>
                    ) : (
                        <Badge variant="secondary" className="text-[10px]">Inactif</Badge>
                    )}
                    {serie.is_default && <Badge variant="outline" className="text-[10px]">Défaut</Badge>}
                    {onBack && (
                        <Button variant="outline" size="sm" onClick={onBack} className="ml-2">
                            <X className="mr-1.5 h-4 w-4" />
                            Fermer
                        </Button>
                    )}
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <DetailCard title="Scope" icon={ScopeIcon} accent={scopeAccent}>
                        <div className="flex items-center gap-2">
                            <ScopeIcon className="h-5 w-5 text-gray-500" />
                            <span className="font-semibold text-lg">{getScopeLabel(serie.scope)}</span>
                        </div>
                        {serie.scope === 'branch' && serie.allowed_branches && (
                            <p className="text-sm text-muted-foreground mt-2">
                                Branches autorisées : <span className="font-medium text-gray-700">{serie.allowed_branches.join(', ')}</span>
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
                            return (
                                <div key={field.key} className="rounded-lg border border-gray-100 bg-white p-3 shadow-sm">
                                    <p className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{field.label}</p>
                                    <p className="font-mono text-sm font-medium truncate">{prefix ?? '-'}</p>
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

export function TokenSeriesPage() {
    const [filters, setFilters] = useState<TokenSerieFilters>(DEFAULT_FILTERS);
    const { data, isLoading, refetch } = useTokenSeries(filters);

    const [selectedSerie, setSelectedSerie] = useState<TokenSerie | null>(null);
    const [showDetailPanel, setShowDetailPanel] = useState(false);
    const [editingSerie, setEditingSerie] = useState<TokenSerie | null | undefined>(undefined);
    const [serieToDelete, setSerieToDelete] = useState<TokenSerie | null>(null);
    const [conflictRefs, setConflictRefs] = useState<string[] | null>(null);

    const { data: detailData } = useTokenSerie(serieToDelete?.code ?? null);

    const createSerie = useCreateTokenSerie();
    const updateSerie = useUpdateTokenSerie(editingSerie?.code ?? '');
    const deleteSerie = useDeleteTokenSerie();

    const handleSelect = (serie: TokenSerie) => {
        setSelectedSerie(serie);
        setShowDetailPanel(true);
    };

    const handleFormSubmit = async (payload: CreateTokenSeriePayload | UpdateTokenSeriePayload) => {
        try {
            if (editingSerie) {
                await updateSerie.mutateAsync(payload as UpdateTokenSeriePayload);
                toast.success('Série mise à jour.');
            } else {
                await createSerie.mutateAsync(payload as CreateTokenSeriePayload);
                toast.success('Série créée.');
            }
            setEditingSerie(undefined);
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

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
            if (isConflictResponse(result)) {
                setConflictRefs(result.references);
                return;
            }
            toast.success('Série supprimée.');
            setSerieToDelete(null);
            if (selectedSerie?.code === serieToDelete.code) {
                setSelectedSerie(null);
                setShowDetailPanel(false);
            }
        } catch (error) {
            if (isAxiosError(error) && error.response?.status === 409) {
                setConflictRefs(error.response.data.references ?? []);
                return;
            }
            toast.error(getErrorMessage(error));
        }
    };

    const handlePageChange = (page: number) => {
        setFilters((prev) => ({ ...prev, page }));
    };

    const actionGroups = [
        {
            items: [
                {
                    icon: Plus,
                    label: 'Nouvelle série',
                    variant: 'primary' as const,
                    onClick: () => setEditingSerie(null),
                },
                {
                    icon: RotateCcw,
                    label: 'Rafraîchir',
                    variant: 'default' as const,
                    onClick: () => refetch(),
                },
            ],
        },
        ...(selectedSerie
            ? [
                {
                    items: [
                        {
                            icon: Edit2,
                            label: 'Éditer',
                            variant: 'sage' as const,
                            onClick: () => setEditingSerie(selectedSerie),
                        },
                        {
                            icon: Trash2,
                            label: 'Supprimer',
                            variant: 'danger' as const,
                            onClick: () => setSerieToDelete(selectedSerie),
                        },
                    ],
                },
            ]
            : []),
    ];

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col">
                    <div className="p-4 border-b border-gray-100 shrink-0">
                        <div className="flex items-center gap-2 mb-3">
                            <Hash className="h-5 w-5 text-sage-600" />
                            <h1 className="text-sm font-semibold text-gray-900">Séries de numérotation</h1>
                        </div>
                        <div className="space-y-2">
                            <Input
                                placeholder="Rechercher…"
                                value={''}
                                onChange={() => {}}
                                className="h-8 text-xs"
                            />
                            <div className="flex items-center gap-2">
                                <input
                                    id="active-only"
                                    type="checkbox"
                                    checked={!!filters.active_only}
                                    onChange={(e) => setFilters((prev) => ({ ...prev, active_only: e.target.checked, page: 1 }))}
                                />
                                <Label htmlFor="active-only" className="text-xs">Actives uniquement</Label>
                            </div>
                        </div>
                    </div>
                    <div className="flex-1 min-h-0 p-2">
                        <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                            <TokenSeriesTable
                                response={data}
                                loading={isLoading}
                                selected={selectedSerie}
                                onSelect={handleSelect}
                                onPageChange={handlePageChange}
                            />
                        </div>
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full flex flex-col">
                    <Dialog open={editingSerie !== undefined} onOpenChange={(open) => !open && setEditingSerie(undefined)}>
                        <DialogContent className="max-w-3xl">
                            <TokenSeriesForm
                                key={editingSerie ? `edit-${editingSerie.code}` : 'create'}
                                serie={editingSerie ?? null}
                                onSubmit={handleFormSubmit}
                                onCancel={() => setEditingSerie(undefined)}
                                loading={createSerie.isPending || updateSerie.isPending}
                            />
                        </DialogContent>
                    </Dialog>

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
                                            <br />
                                            <br />
                                            Cette action est irréversible.
                                        </>
                                    )}
                                </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                                <Button variant="outline" onClick={() => setSerieToDelete(null)}>
                                    Annuler
                                </Button>
                                <Button variant="destructive" onClick={handleDelete} disabled={deleteSerie.isPending}>
                                    Supprimer
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

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

                    {showDetailPanel && selectedSerie ? (
                        <TokenSeriesDetail
                            serie={selectedSerie}
                            onBack={() => setShowDetailPanel(false)}
                        />
                    ) : (
                        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center">
                            <Hash className="w-16 h-16 text-gray-300 mb-4" />
                            <h3 className="text-lg font-semibold text-gray-700 mb-2">Séries de numérotation</h3>
                            <p className="text-sm text-gray-500 max-w-md">
                                Cliquez sur une série dans la liste pour voir ses détails et actions.
                            </p>
                        </div>
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
