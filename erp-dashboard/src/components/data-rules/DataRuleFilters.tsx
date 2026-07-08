import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { DataRuleAction, DataRuleFilters as Filters, DataRuleModelType, DataRuleScopeType } from '@/types/dataRules.types';
import { MODEL_TYPE_OPTIONS, SCOPE_TYPE_OPTIONS, ACTION_OPTIONS } from '@/lib/dataRules';
import { useDataRuleScopes } from '@/hooks/dataRules/useDataRules';
import { Search, RotateCcw } from 'lucide-react';

interface DataRuleFiltersProps {
    filters: Filters;
    onChange: (filters: Filters) => void;
}

export function DataRuleFilters({ filters, onChange }: DataRuleFiltersProps) {
    const update = (patch: Partial<Filters>) => {
        onChange({ ...filters, ...patch, page: 1 });
    };

    const clear = () => {
        onChange({ per_page: filters.per_page ?? 50, page: 1 });
    };

    const { data: scopesResponse, isLoading: isLoadingScopes } = useDataRuleScopes(filters.scope_type);

    const modelTypeOptions = [{ value: 'all', label: 'Tous' }, ...MODEL_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))];
    const scopeTypeOptions = [{ value: 'all', label: 'Tous' }, ...SCOPE_TYPE_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))];
    const actionOptions = [{ value: 'all', label: 'Toutes' }, ...ACTION_OPTIONS.map((opt) => ({ value: opt.value, label: opt.label }))];
    const scopeValueOptions = [
        { value: 'all', label: 'Tous' },
        ...(scopesResponse?.data.map((option) => ({ value: option.value, label: option.label })) ?? []),
    ];

    return (
        <div className="flex flex-col gap-4 rounded-lg border bg-card p-4 shadow-sm">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div className="space-y-1.5">
                    <Label htmlFor="filter-model-type">Type de modèle</Label>
                    <SearchableSelect
                        options={modelTypeOptions}
                        value={filters.model_type ?? 'all'}
                        onChange={(value) =>
                            update({ model_type: value === 'all' ? undefined : (value as DataRuleModelType) })
                        }
                        placeholder="Tous"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="filter-scope-type">Scope</Label>
                    <SearchableSelect
                        options={scopeTypeOptions}
                        value={filters.scope_type ?? 'all'}
                        onChange={(value) => {
                            const scopeType = value === 'all' ? undefined : (value as DataRuleScopeType);
                            update({ scope_type: scopeType, scope_value: undefined });
                        }}
                        placeholder="Tous"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="filter-scope-value">Valeur du scope</Label>
                    {filters.scope_type ? (
                        <SearchableSelect
                            options={scopeValueOptions}
                            value={filters.scope_value ?? 'all'}
                            onChange={(value) =>
                                update({ scope_value: value === 'all' ? undefined : String(value) })
                            }
                            placeholder={isLoadingScopes ? 'Chargement…' : 'Tous'}
                            disabled={isLoadingScopes}
                        />
                    ) : (
                        <Input
                            id="filter-scope-value"
                            placeholder="Sélectionnez d'abord un scope"
                            value={filters.scope_value ?? ''}
                            onChange={(e) => update({ scope_value: e.target.value || undefined })}
                            disabled={!filters.scope_type}
                        />
                    )}
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="filter-action">Action</Label>
                    <SearchableSelect
                        options={actionOptions}
                        value={filters.action ?? 'all'}
                        onChange={(value) =>
                            update({ action: value === 'all' ? undefined : (value as DataRuleAction) })
                        }
                        placeholder="Toutes"
                    />
                </div>

                <div className="space-y-1.5">
                    <Label htmlFor="filter-model-id">ID ressource</Label>
                    <Input
                        id="filter-model-id"
                        type="number"
                        placeholder="ID concret ou vide"
                        value={filters.model_id ?? ''}
                        onChange={(e) => {
                            const value = e.target.value;
                            update({ model_id: value ? Number(value) : undefined });
                        }}
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                <Button variant="outline" size="sm" onClick={clear} className="gap-1.5">
                    <RotateCcw className="h-4 w-4" />
                    Réinitialiser
                </Button>
                <Button size="sm" className="gap-1.5" onClick={() => onChange({ ...filters, page: 1 })}>
                    <Search className="h-4 w-4" />
                    Filtrer
                </Button>
            </div>
        </div>
    );
}
