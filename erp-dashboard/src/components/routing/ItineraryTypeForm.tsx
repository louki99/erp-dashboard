import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SearchableSelect from '@/components/common/SearchableSelect';
import { useBusinessNatures } from '@/hooks/routing/useRouting';
import type { CreateItineraryTypePayload, ItineraryType } from '@/types/routing.types';

interface ItineraryTypeFormProps {
    itineraryType?: ItineraryType | null;
    onSubmit: (payload: CreateItineraryTypePayload | Partial<CreateItineraryTypePayload>) => void;
    onCancel: () => void;
    loading?: boolean;
}

function getInitialForm(itineraryType?: ItineraryType | null): CreateItineraryTypePayload {
    if (itineraryType) {
        return {
            code: itineraryType.code,
            name: itineraryType.name,
            name_ar: itineraryType.name_ar ?? '',
            description: itineraryType.description ?? '',
            business_nature_id: itineraryType.business_nature_id,
            is_active: itineraryType.is_active,
        };
    }
    return {
        code: '',
        name: '',
        name_ar: '',
        description: '',
        business_nature_id: null,
        is_active: true,
    };
}

export function ItineraryTypeForm({
    itineraryType,
    onSubmit,
    onCancel,
    loading,
}: ItineraryTypeFormProps) {
    const [form, setForm] = useState<CreateItineraryTypePayload>(() => getInitialForm(itineraryType));
    const { data: businessNatures } = useBusinessNatures();

    const natureOptions = (businessNatures ?? []).map((n) => ({
        value: n.id,
        label: `${n.label} (${n.code})`,
    }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...form,
            name_ar: form.name_ar || null,
            description: form.description || null,
        });
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="code">Code</Label>
                    <Input
                        id="code"
                        value={form.code}
                        onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
                        required
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="name">Nom</Label>
                    <Input
                        id="name"
                        value={form.name}
                        onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                        required
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="name_ar">Nom arabe</Label>
                <Input
                    id="name_ar"
                    dir="rtl"
                    value={form.name_ar ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, name_ar: e.target.value }))}
                />
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                    id="description"
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
            </div>

            <div className="space-y-2">
                <Label>Nature business (playbook de visite)</Label>
                <SearchableSelect
                    options={natureOptions}
                    value={form.business_nature_id ?? undefined}
                    onChange={(v) => setForm((f) => ({ ...f, business_nature_id: v ? Number(v) : null }))}
                    placeholder="— Aucun playbook —"
                    clearable
                />
            </div>

            <div className="flex items-center gap-2">
                <Checkbox
                    id="is_active"
                    checked={form.is_active}
                    onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked === true }))}
                />
                <Label htmlFor="is_active" className="cursor-pointer">Actif</Label>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                    {itineraryType ? 'Mettre à jour' : 'Créer'}
                </Button>
            </div>
        </form>
    );
}
