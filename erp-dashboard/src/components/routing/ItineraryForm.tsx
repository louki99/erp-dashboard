import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { CreateItineraryPayload, Itinerary, ItineraryType } from '@/types/routing.types';

interface ItineraryFormProps {
    itinerary?: Itinerary | null;
    itineraryTypes: ItineraryType[];
    branches: Array<{ id: number; code: string; name: string }>;
    geoAreas: Array<{ id: number; code: string; name: string }>;
    riders: Array<{ id: number; name: string }>;
    onSubmit: (payload: CreateItineraryPayload | Partial<CreateItineraryPayload>) => void;
    onCancel: () => void;
    loading?: boolean;
}

function getInitialForm(itinerary?: Itinerary | null): CreateItineraryPayload {
    if (itinerary) {
        return {
            code: itinerary.code,
            name: itinerary.name,
            name_ar: itinerary.name_ar ?? '',
            itinerary_type_id: itinerary.itinerary_type_id,
            branch_id: itinerary.branch_id,
            geo_area_id: itinerary.geo_area_id,
            rider_id: itinerary.rider_id,
            is_active: itinerary.is_active,
            start_date: itinerary.start_date,
            end_date: itinerary.end_date,
            sort_order: itinerary.sort_order,
        };
    }
    return {
        code: '',
        name: '',
        name_ar: '',
        itinerary_type_id: 0,
        branch_id: null,
        geo_area_id: null,
        rider_id: null,
        is_active: true,
        start_date: null,
        end_date: null,
        sort_order: 0,
    };
}

export function ItineraryForm({
    itinerary,
    itineraryTypes,
    branches,
    geoAreas,
    riders,
    onSubmit,
    onCancel,
    loading,
}: ItineraryFormProps) {
    const [form, setForm] = useState<CreateItineraryPayload>(() => getInitialForm(itinerary));

    const typeOptions = itineraryTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));
    const branchOptions = branches.map((b) => ({ value: b.id, label: `${b.name} (${b.code})` }));
    const geoAreaOptions = geoAreas.map((g) => ({ value: g.id, label: `${g.name} (${g.code})` }));
    const riderOptions = riders.map((r) => ({ value: r.id, label: r.name }));

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onSubmit({
            ...form,
            name_ar: form.name_ar || null,
            branch_id: form.branch_id || null,
            geo_area_id: form.geo_area_id || null,
            rider_id: form.rider_id || null,
            start_date: form.start_date || null,
            end_date: form.end_date || null,
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
                <Label>Type de tournée</Label>
                <SearchableSelect
                    options={typeOptions}
                    value={form.itinerary_type_id || undefined}
                    onChange={(v) => setForm((f) => ({ ...f, itinerary_type_id: Number(v) }))}
                    placeholder="— Sélectionner un type —"
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>Branche</Label>
                    <SearchableSelect
                        options={branchOptions}
                        value={form.branch_id ?? undefined}
                        onChange={(v) => setForm((f) => ({ ...f, branch_id: v ? Number(v) : null }))}
                        placeholder="— Branche —"
                        clearable
                    />
                </div>
                <div className="space-y-2">
                    <Label>Zone géographique</Label>
                    <SearchableSelect
                        options={geoAreaOptions}
                        value={form.geo_area_id ?? undefined}
                        onChange={(v) => setForm((f) => ({ ...f, geo_area_id: v ? Number(v) : null }))}
                        placeholder="— Zone —"
                        clearable
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Vendeur assigné</Label>
                <SearchableSelect
                    options={riderOptions}
                    value={form.rider_id ?? undefined}
                    onChange={(v) => setForm((f) => ({ ...f, rider_id: v ? Number(v) : null }))}
                    placeholder="— Vendeur —"
                    clearable
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="start_date">Date début</Label>
                    <Input
                        id="start_date"
                        type="date"
                        value={form.start_date ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value || null }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="end_date">Date fin</Label>
                    <Input
                        id="end_date"
                        type="date"
                        value={form.end_date ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value || null }))}
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="sort_order">Ordre</Label>
                    <Input
                        id="sort_order"
                        type="number"
                        value={form.sort_order}
                        onChange={(e) => setForm((f) => ({ ...f, sort_order: Number(e.target.value) }))}
                    />
                </div>
                <div className="flex items-end gap-2 pb-2">
                    <Checkbox
                        id="is_active"
                        checked={form.is_active}
                        onCheckedChange={(checked) => setForm((f) => ({ ...f, is_active: checked === true }))}
                    />
                    <Label htmlFor="is_active" className="cursor-pointer">Actif</Label>
                </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={onCancel} disabled={loading}>
                    Annuler
                </Button>
                <Button type="submit" disabled={loading}>
                    {itinerary ? 'Mettre à jour' : 'Créer'}
                </Button>
            </div>
        </form>
    );
}
