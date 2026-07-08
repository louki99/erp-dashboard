import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchableSelect from '@/components/common/SearchableSelect';
import type {
    CreateDataRulePayload,
    DataRule,
    DataRuleAction,
    DataRuleModelType,
    DataRuleScopeType,
    UpdateDataRulePayload,
} from '@/types/dataRules.types';
import { ACTION_OPTIONS, MODEL_TYPE_OPTIONS, SCOPE_TYPE_OPTIONS } from '@/lib/dataRules';
import { useDataRuleResources, useDataRuleScopes } from '@/hooks/dataRules/useDataRules';
import { Save, X } from 'lucide-react';

interface DataRuleFormProps {
    rule?: DataRule | null;
    onSubmit: (payload: CreateDataRulePayload | UpdateDataRulePayload) => void;
    onCancel: () => void;
    loading?: boolean;
}

const emptyForm: CreateDataRulePayload = {
    model_type: 'App\\Models\\ProductPage',
    model_id: null,
    scope_type: 'profile',
    scope_value: '',
    action: 'allow',
};

function getInitialForm(rule: DataRule | null | undefined): CreateDataRulePayload {
    if (rule) {
        return {
            model_type: rule.model_type,
            model_id: rule.model_id,
            scope_type: rule.scope_type,
            scope_value: rule.scope_value,
            action: rule.action,
        };
    }
    return emptyForm;
}

export function DataRuleForm({ rule, onSubmit, onCancel, loading }: DataRuleFormProps) {
    const [form, setForm] = useState<CreateDataRulePayload>(() => getInitialForm(rule));
    const [confirmWildcard, setConfirmWildcard] = useState(false);
    const isEdit = Boolean(rule);

    const { data: scopesResponse, isLoading: isLoadingScopes } = useDataRuleScopes(form.scope_type);
    const { data: resourcesResponse, isLoading: isLoadingResources } = useDataRuleResources(form.model_type);

    const update = <K extends keyof CreateDataRulePayload>(key: K, value: CreateDataRulePayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateModelType = (modelType: DataRuleModelType) => {
        setForm((prev) => ({ ...prev, model_type: modelType, model_id: null }));
    };

    const updateScopeType = (scopeType: DataRuleScopeType) => {
        setForm((prev) => ({ ...prev, scope_type: scopeType, scope_value: '' }));
    };

    const isWildcardDeny = form.model_id === null && form.action === 'deny';

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: CreateDataRulePayload | UpdateDataRulePayload = {
            ...form,
            ...(isWildcardDeny && confirmWildcard ? { confirm_wildcard_deny: true } : {}),
        };
        onSubmit(payload);
    };

    const modelTypeOptions = MODEL_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }));
    const scopeTypeOptions = SCOPE_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }));
    const actionOptions = ACTION_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }));
    const scopeValueOptions =
        scopesResponse?.data.map((option) => ({ value: option.value, label: option.label })) ?? [];
    const resourceOptions = [
        { value: 'wildcard', label: 'Toutes les ressources (wildcard)' },
        ...(resourcesResponse?.data.map((resource) => ({ value: resource.id, label: resource.label })) ?? []),
    ];

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEdit ? 'Modifier la règle' : 'Nouvelle règle'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="model-type">Type de modèle</Label>
                            <SearchableSelect
                                options={modelTypeOptions}
                                value={form.model_type}
                                onChange={(value) => updateModelType(value as DataRuleModelType)}
                                placeholder="Sélectionner"
                                disabled={isEdit}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="model-id">Ressource</Label>
                            <SearchableSelect
                                options={resourceOptions}
                                value={form.model_id === null ? 'wildcard' : form.model_id}
                                onChange={(value) =>
                                    update('model_id', value === 'wildcard' ? null : Number(value))
                                }
                                placeholder={isLoadingResources ? 'Chargement…' : 'Sélectionner'}
                                disabled={isEdit || isLoadingResources}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="scope-type">Scope</Label>
                            <SearchableSelect
                                options={scopeTypeOptions}
                                value={form.scope_type}
                                onChange={(value) => updateScopeType(value as DataRuleScopeType)}
                                placeholder="Sélectionner"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="scope-value">Valeur du scope</Label>
                            <SearchableSelect
                                options={scopeValueOptions}
                                value={form.scope_value}
                                onChange={(value) => update('scope_value', String(value))}
                                placeholder={isLoadingScopes ? 'Chargement…' : 'Sélectionner'}
                                disabled={isLoadingScopes}
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="action">Action</Label>
                            <SearchableSelect
                                options={actionOptions}
                                value={form.action}
                                onChange={(value) => update('action', value as DataRuleAction)}
                                placeholder="Sélectionner"
                            />
                        </div>
                    </div>

                    {isWildcardDeny && (
                        <div className="flex items-start gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3">
                            <Checkbox
                                id="confirm-wildcard"
                                checked={confirmWildcard}
                                onCheckedChange={(checked) => setConfirmWildcard(checked === true)}
                            />
                            <Label htmlFor="confirm-wildcard" className="text-sm font-normal leading-tight">
                                Je confirme vouloir masquer <strong>toutes</strong> les lignes de ce type pour ce scope.
                                Cette action peut bloquer l'accès à des données en production.
                            </Label>
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            <X className="mr-1.5 h-4 w-4" />
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading || (isWildcardDeny && !confirmWildcard)}>
                            <Save className="mr-1.5 h-4 w-4" />
                            {isEdit ? 'Mettre à jour' : 'Créer'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
