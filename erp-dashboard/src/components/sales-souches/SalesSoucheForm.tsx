import React, { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SearchableSelect from '@/components/common/SearchableSelect';
import type {
    CreateSalesSouchePayload,
    SalesSouche,
    SalesSoucheFiscalType,
    UpdateSalesSouchePayload,
} from '@/types/salesSouches.types';
import { useBranchesOptions } from '@/hooks/tokenSeries/useEntitySelectors';
import { useTokenSeries } from '@/hooks/tokenSeries/useTokenSeries';
import { Save, X } from 'lucide-react';

interface SalesSoucheFormProps {
    souche?: SalesSouche | null;
    onSubmit: (payload: CreateSalesSouchePayload | UpdateSalesSouchePayload) => void;
    onCancel: () => void;
    loading?: boolean;
    formRef?: React.RefObject<HTMLFormElement | null>;
    hideFooter?: boolean;
}

const FISCAL_TYPE_OPTIONS: { value: SalesSoucheFiscalType; label: string }[] = [
    { value: 'declared', label: 'Déclarée (fiscale, export)' },
    { value: 'internal', label: 'Interne (hors export)' },
];

const emptyForm: CreateSalesSouchePayload = {
    branch_code: null,
    code: '',
    name: '',
    fiscal_type: 'declared',
    token_serie_id: 0,
    is_active: true,
    is_default: false,
};

function getInitialForm(souche: SalesSouche | null | undefined): CreateSalesSouchePayload {
    if (!souche) return emptyForm;
    return {
        branch_code: souche.branch_code,
        code: souche.code,
        name: souche.name,
        fiscal_type: souche.fiscal_type,
        token_serie_id: souche.token_serie_id,
        is_active: souche.is_active,
        is_default: souche.is_default,
    };
}

export function SalesSoucheForm({ souche, onSubmit, onCancel, loading, formRef, hideFooter }: SalesSoucheFormProps) {
    const [form, setForm] = useState<CreateSalesSouchePayload>(() => getInitialForm(souche));
    const isEdit = Boolean(souche);

    const { data: branches = [] } = useBranchesOptions();
    const { data: seriesResponse } = useTokenSeries({ active_only: true, per_page: 500 });

    const update = <K extends keyof CreateSalesSouchePayload>(key: K, value: CreateSalesSouchePayload[K]) => {
        setForm((prev) => ({ ...prev, [key]: value }));
    };

    // Radix's SelectItem forbids an empty-string value (reserved to mean
    // "cleared" on the Select's own controlled value) — use a sentinel for
    // "no branch / global scope" instead, translated back to null on change.
    const GLOBAL_BRANCH_SENTINEL = '__global__';
    const branchOptions = useMemo(
        () => [{ value: GLOBAL_BRANCH_SENTINEL, label: 'Toutes les branches (portée globale)' }, ...branches.map((b) => ({ value: String(b.value), label: b.label }))],
        [branches],
    );

    // token_serie_id is a numeric FK to TokenSerie.id — the shared
    // useTokenSeriesOptions() selector can't be reused here, it maps to
    // .code (that hook's series identifier is the code everywhere else).
    const serieOptions = useMemo(
        () => (seriesResponse?.data ?? []).map((s) => ({ value: s.id, label: `${s.code} — ${s.name}` })),
        [seriesResponse],
    );

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (isEdit) {
            // token_serie_id is not editable — see §10.4, never send it on update.
            const { branch_code, code, name, fiscal_type, is_active, is_default } = form;
            onSubmit({ branch_code, code, name, fiscal_type, is_active, is_default } satisfies UpdateSalesSouchePayload);
        } else {
            onSubmit(form);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>{isEdit ? 'Modifier la souche' : 'Nouvelle souche de vente'}</CardTitle>
            </CardHeader>
            <CardContent>
                <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-1.5">
                            <Label htmlFor="code">Code</Label>
                            <Input
                                id="code"
                                value={form.code}
                                onChange={(e) => update('code', e.target.value)}
                                placeholder="EXPORT"
                                maxLength={20}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="name">Nom</Label>
                            <Input
                                id="name"
                                value={form.name}
                                onChange={(e) => update('name', e.target.value)}
                                placeholder="Souche Export"
                                maxLength={150}
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="branch_code">Branche</Label>
                            <SearchableSelect
                                options={branchOptions}
                                value={form.branch_code ?? GLOBAL_BRANCH_SENTINEL}
                                onChange={(value) => update('branch_code', !value || value === GLOBAL_BRANCH_SENTINEL ? null : String(value))}
                                placeholder="Toutes les branches"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="fiscal_type">Type fiscal</Label>
                            <SearchableSelect
                                options={FISCAL_TYPE_OPTIONS}
                                value={form.fiscal_type}
                                onChange={(value) => update('fiscal_type', value as SalesSoucheFiscalType)}
                                placeholder="Sélectionner"
                            />
                        </div>

                        <div className="space-y-1.5 sm:col-span-2">
                            <Label htmlFor="token_serie_id">Série de numérotation</Label>
                            <SearchableSelect
                                options={serieOptions}
                                value={form.token_serie_id || ''}
                                onChange={(value) => update('token_serie_id', value ? Number(value) : 0)}
                                placeholder="Sélectionner une série existante..."
                                disabled={isEdit}
                            />
                            {isEdit && (
                                <p className="text-[11px] text-muted-foreground">
                                    Non modifiable — supprimez la souche et recréez-en une pour changer de série.
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is_active"
                                checked={form.is_active}
                                onCheckedChange={(checked) => update('is_active', checked === true)}
                            />
                            <Label htmlFor="is_active" className="font-normal">Active</Label>
                        </div>

                        <div className="flex items-center gap-2">
                            <Checkbox
                                id="is_default"
                                checked={form.is_default}
                                onCheckedChange={(checked) => update('is_default', checked === true)}
                            />
                            <Label htmlFor="is_default" className="font-normal">Souche par défaut de cette portée</Label>
                        </div>
                    </div>

                    {!hideFooter && (
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
                    )}
                </form>
            </CardContent>
        </Card>
    );
}
