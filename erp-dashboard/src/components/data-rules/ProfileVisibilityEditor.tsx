import { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Save } from 'lucide-react';
import { useBulkReplaceDataRules, useDataRules } from '@/hooks/dataRules/useDataRules';
import type { DataRuleModelType } from '@/types/dataRules.types';
import { getModelTypeLabel } from '@/lib/dataRules';

interface VisibilityItem {
    id: number;
    label: string;
}

interface ProfileVisibilityEditorProps {
    profileId: number | string;
    modelType: DataRuleModelType;
    items: VisibilityItem[];
}

export function ProfileVisibilityEditor({ profileId, modelType, items }: ProfileVisibilityEditorProps) {
    const scopeValue = String(profileId);
    const { data, isLoading: isLoadingRules } = useDataRules({
        scope_type: 'profile',
        scope_value: scopeValue,
        model_type: modelType,
        per_page: 200,
    });

    const bulkReplace = useBulkReplaceDataRules();

    const existingRules = useMemo(() => data?.data ?? [], [data?.data]);

    const allowedIds = useMemo(
        () =>
            new Set(
                existingRules
                    .filter((rule) => rule.action === 'allow' && rule.model_id !== null)
                    .map((rule) => rule.model_id as number)
            ),
        [existingRules]
    );

    const hasWildcardDeny = useMemo(
        () => existingRules.some((rule) => rule.model_id === null && rule.action === 'deny'),
        [existingRules]
    );

    // Draft changes applied on top of the server-side allowedIds.
    const [additions, setAdditions] = useState<Set<number>>(new Set());
    const [removals, setRemovals] = useState<Set<number>>(new Set());

    const isSelected = useCallback(
        (id: number) => {
            if (removals.has(id)) return false;
            if (additions.has(id)) return true;
            return allowedIds.has(id);
        },
        [allowedIds, additions, removals]
    );

    const selectedCount = useMemo(
        () => items.filter((item) => isSelected(item.id)).length,
        [items, isSelected]
    );

    const toggleId = (id: number) => {
        const currentlySelected = isSelected(id);
        if (currentlySelected) {
            if (allowedIds.has(id)) {
                setRemovals((prev) => new Set([...prev, id]));
            }
            setAdditions((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
            });
        } else {
            if (allowedIds.has(id)) {
                setRemovals((prev) => {
                    const next = new Set(prev);
                    next.delete(id);
                    return next;
                });
            } else {
                setAdditions((prev) => new Set([...prev, id]));
            }
        }
    };

    const handleSave = () => {
        const selectedIds = items
            .filter((item) => isSelected(item.id))
            .map((item) => item.id)
            .sort((a, b) => a - b);

        bulkReplace.mutate(
            {
                scope_type: 'profile',
                scope_value: scopeValue,
                model_type: modelType,
                rules: [
                    { model_id: null, action: 'deny', confirm_wildcard_deny: true },
                    ...selectedIds.map((id) => ({ model_id: id, action: 'allow' as const })),
                ],
            },
            {
                onSuccess: () => {
                    setAdditions(new Set());
                    setRemovals(new Set());
                },
            }
        );
    };

    const isLoading = isLoadingRules || bulkReplace.isPending;

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    Visibilité {getModelTypeLabel(modelType)}
                    <Badge variant="outline">Profil {profileId}</Badge>
                </CardTitle>
                <CardDescription>
                    Toutes les ressources sont masquées par défaut. Cochez celles qui doivent être visibles.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {hasWildcardDeny && (
                    <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                        Un deny wildcard existe déjà pour ce profil. Seules les ressources autorisées ci-dessous seront
                        visibles.
                    </div>
                )}

                {items.length === 0 ? (
                    <div className="text-sm text-muted-foreground">Aucune ressource disponible.</div>
                ) : (
                    <div className="grid max-h-80 gap-2 overflow-y-auto rounded-md border p-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map((item) => (
                            <div key={item.id} className="flex items-center gap-2">
                                <Checkbox
                                    id={`visibility-${item.id}`}
                                    checked={isSelected(item.id)}
                                    onCheckedChange={() => toggleId(item.id)}
                                    disabled={isLoading}
                                />
                                <Label
                                    htmlFor={`visibility-${item.id}`}
                                    className="cursor-pointer text-sm font-normal"
                                >
                                    {item.label}
                                </Label>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex items-center justify-between pt-2">
                    <div className="text-xs text-muted-foreground">
                        {selectedCount} ressource{selectedCount > 1 ? 's' : ''} visible
                        {selectedCount > 1 ? 's' : ''}
                    </div>
                    <Button onClick={handleSave} disabled={isLoading || items.length === 0}>
                        {bulkReplace.isPending ? (
                            <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                        ) : (
                            <Save className="mr-1.5 h-4 w-4" />
                        )}
                        Enregistrer la visibilité
                    </Button>
                </div>
            </CardContent>
        </Card>
    );
}
