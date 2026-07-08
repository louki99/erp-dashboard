import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchableSelect from '@/components/common/SearchableSelect';
import type {
    CreateTokenSeriePayload,
    TokenSerie,
    TokenSerieScope,
    UpdateTokenSeriePayload,
} from '@/types/tokenSeries.types';
import { TOKEN_SERIE_SCOPES } from '@/types/tokenSeries.types';
import { NUMBERING_FIELDS, SCOPE_LABELS } from '@/lib/tokenSeries';
import { Save, X } from 'lucide-react';
import { useBranchesOptions } from '@/hooks/tokenSeries/useEntitySelectors';
import { cn } from '@/lib/utils';

interface TokenSeriesFormProps {
    serie?: TokenSerie | null;
    onSubmit: (payload: CreateTokenSeriePayload | UpdateTokenSeriePayload) => void;
    onCancel: () => void;
    loading?: boolean;
}

const SCOPE_OPTIONS = TOKEN_SERIE_SCOPES.map((scope: TokenSerieScope) => ({ value: scope, label: SCOPE_LABELS[scope] }));

const emptyForm: CreateTokenSeriePayload = {
    code: '',
    name: '',
    description: '',
    scope: 'global',
    allowed_branches: [],
    digits_in_counter: 6,
    is_default: false,
    is_active: true,
};

function getInitialForm(serie: TokenSerie | null | undefined): CreateTokenSeriePayload {
    if (!serie) return emptyForm;
    return {
        code: serie.code,
        name: serie.name,
        description: serie.description ?? '',
        scope: serie.scope,
        allowed_branches: serie.allowed_branches ?? [],
        digits_in_counter: serie.digits_in_counter,
        is_default: serie.is_default,
        is_active: serie.is_active,
        ...NUMBERING_FIELDS.reduce((acc, field) => {
            const src = serie as unknown as Record<string, unknown>;
            acc[field.prefixKey] = src[field.prefixKey] as string;
            acc[field.counterKey] = src[field.counterKey] as number;
            return acc;
        }, {} as Record<string, string | number>),
    };
}

export function TokenSeriesForm({ serie, onSubmit, onCancel, loading }: TokenSeriesFormProps) {
    const [form, setForm] = useState<CreateTokenSeriePayload>(() => getInitialForm(serie));
    const [activeTab, setActiveTab] = useState<'general' | 'numbering'>('general');
    const isEdit = Boolean(serie);

    const { data: branches = [] } = useBranchesOptions();

    const update = <K extends keyof CreateTokenSeriePayload>(key: K, value: CreateTokenSeriePayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    const updateScope = (scope: TokenSerieScope) => {
        setForm((prev) => ({
            ...prev,
            scope,
            allowed_branches: scope === 'branch' ? prev.allowed_branches ?? [] : null,
        }));
    };

    const toggleBranch = (branchCode: string) => {
        setForm((prev) => {
            const current = prev.allowed_branches ?? [];
            const next = current.includes(branchCode)
                ? current.filter((b) => b !== branchCode)
                : [...current, branchCode];
            return { ...prev, allowed_branches: next };
        });
    };

    const handleNumberChange = (key: string, value: string) => {
        const num = value === '' ? 0 : Number(value);
        setForm((prev) => ({ ...prev, [key]: Number.isNaN(num) ? 0 : num }));
    };

    const branchOptions = useMemo(
        () => branches.map((b) => ({ value: String(b.value), label: b.label, description: b.description })),
        [branches]
    );

    const selectedBranches = useMemo(
        () => branchOptions.filter((b) => form.allowed_branches?.includes(b.value)),
        [branchOptions, form.allowed_branches]
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload = isEdit
            ? ({ ...form, code: undefined } as UpdateTokenSeriePayload)
            : form;
        onSubmit(payload);
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEdit ? 'Modifier la série' : 'Nouvelle série de numérotation'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="flex gap-2 border-b pb-2">
                        <button
                            type="button"
                            onClick={() => setActiveTab('general')}
                            className={cn(
                                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                                activeTab === 'general' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                            )}
                        >
                            Général
                        </button>
                        <button
                            type="button"
                            onClick={() => setActiveTab('numbering')}
                            className={cn(
                                'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                                activeTab === 'numbering' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'
                            )}
                        >
                            Numérotation
                        </button>
                    </div>

                    {activeTab === 'general' && (
                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="code">Code</Label>
                                <Input
                                    id="code"
                                    value={form.code}
                                    onChange={(e) => update('code', e.target.value)}
                                    placeholder="CAS-A01"
                                    disabled={isEdit}
                                    required
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="name">Nom</Label>
                                <Input
                                    id="name"
                                    value={form.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    placeholder="Série Casablanca A01"
                                    required
                                />
                            </div>

                            <div className="space-y-1.5 sm:col-span-2">
                                <Label htmlFor="description">Description</Label>
                                <Input
                                    id="description"
                                    value={form.description}
                                    onChange={(e) => update('description', e.target.value)}
                                    placeholder="Description optionnelle"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="scope">Scope</Label>
                                <SearchableSelect
                                    options={SCOPE_OPTIONS}
                                    value={form.scope}
                                    onChange={(value) => updateScope(value as TokenSerieScope)}
                                    placeholder="Sélectionner"
                                />
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="digits">Chiffres dans le compteur</Label>
                                <Input
                                    id="digits"
                                    type="number"
                                    min={1}
                                    max={12}
                                    value={form.digits_in_counter}
                                    onChange={(e) => update('digits_in_counter', Number(e.target.value))}
                                />
                            </div>

                            {form.scope === 'branch' && (
                                <div className="space-y-1.5 sm:col-span-2">
                                    <Label>Branches autorisées</Label>
                                    <SearchableSelect
                                        options={branchOptions}
                                        value={selectedBranches.length > 0 ? selectedBranches[0].value : ''}
                                        onChange={(value) => {
                                            if (value) toggleBranch(String(value));
                                        }}
                                        placeholder="Ajouter une branche..."
                                    />
                                    {selectedBranches.length > 0 && (
                                        <div className="flex flex-wrap gap-1 pt-1">
                                            {selectedBranches.map((b) => (
                                                <span
                                                    key={b.value}
                                                    className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs"
                                                >
                                                    {b.label}
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleBranch(String(b.value))}
                                                        className="text-muted-foreground hover:text-foreground"
                                                    >
                                                        ×
                                                    </button>
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is_active"
                                    checked={form.is_active}
                                    onCheckedChange={(checked) => update('is_active', checked === true)}
                                />
                                <Label htmlFor="is_active" className="font-normal">Actif</Label>
                            </div>

                            <div className="flex items-center gap-2">
                                <Checkbox
                                    id="is_default"
                                    checked={form.is_default}
                                    onCheckedChange={(checked) => update('is_default', checked === true)}
                                />
                                <Label htmlFor="is_default" className="font-normal">Série par défaut</Label>
                            </div>
                        </div>
                    )}

                    {activeTab === 'numbering' && (
                        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 max-h-[400px] overflow-y-auto pr-1">
                            {NUMBERING_FIELDS.map((field) => (
                                <div key={field.key} className="rounded-lg border p-3 space-y-2">
                                    <Label className="text-xs font-semibold">{field.label}</Label>
                                    <div className="grid grid-cols-[1fr,80px] gap-2">
                                        <Input
                                            value={(form as unknown as Record<string, unknown>)[field.prefixKey] as string ?? ''}
                                            onChange={(e) => setForm((prev) => ({ ...prev, [field.prefixKey]: e.target.value }))}
                                            placeholder="Préfixe"
                                            className="h-8 text-xs"
                                        />
                                        <Input
                                            type="number"
                                            min={0}
                                            value={(form as unknown as Record<string, unknown>)[field.counterKey] as number ?? 1}
                                            onChange={(e) => handleNumberChange(field.counterKey, e.target.value)}
                                            className="h-8 text-xs"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                        <Button type="button" variant="outline" onClick={onCancel}>
                            <X className="mr-1.5 h-4 w-4" />
                            Annuler
                        </Button>
                        <Button type="submit" disabled={loading}>
                            <Save className="mr-1.5 h-4 w-4" />
                            {isEdit ? 'Mettre à jour' : 'Créer'}
                        </Button>
                    </div>
                </form>
            </CardContent>
        </Card>
    );
}
