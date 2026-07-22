import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { CreateGeoAreaPayload, GeoArea, GeoAreaType } from '@/types/routing.types';

function toCoord(v: string | number | null | undefined): number | null {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(String(v));
    return Number.isFinite(n) ? n : null;
}

interface GeoAreaFormProps {
    geoArea?: GeoArea | null;
    geoAreaTypes: GeoAreaType[];
    parentAreas: Array<Pick<GeoArea, 'id' | 'code' | 'name'>>;
    defaultParentCode?: string;
    onSubmit: (payload: CreateGeoAreaPayload | Partial<CreateGeoAreaPayload>) => void;
    onCancel: () => void;
    loading?: boolean;
}

function getInitialForm(geoArea?: GeoArea | null, defaultParentCode?: string): CreateGeoAreaPayload {
    if (geoArea) {
        return {
            code: geoArea.code,
            name: geoArea.name,
            name_ar: geoArea.name_ar ?? '',
            geo_area_type_id: geoArea.geo_area_type_id,
            parent_code: geoArea.parent_code,
            latitude: toCoord(geoArea.latitude),
            longitude: toCoord(geoArea.longitude),
            description: geoArea.description ?? '',
            is_active: geoArea.is_active,
            sort_order: geoArea.sort_order,
        };
    }
    return {
        code: '',
        name: '',
        name_ar: '',
        geo_area_type_id: 0,
        parent_code: defaultParentCode ?? null,
        latitude: null,
        longitude: null,
        description: '',
        is_active: true,
        sort_order: 0,
    };
}

export function GeoAreaForm({
    geoArea,
    geoAreaTypes,
    parentAreas,
    defaultParentCode,
    onSubmit,
    onCancel,
    loading,
}: GeoAreaFormProps) {
    const [form, setForm] = useState<CreateGeoAreaPayload>(() => getInitialForm(geoArea, defaultParentCode));

    const typeOptions = geoAreaTypes.map((t) => ({ value: t.id, label: `${t.name} (${t.code})` }));
    const parentOptions = [
        { value: '', label: '— Aucun parent —' },
        ...parentAreas.map((p) => ({ value: p.code, label: `${p.name} (${p.code})` })),
    ];

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        const payload: CreateGeoAreaPayload = {
            ...form,
            parent_code: form.parent_code || null,
            name_ar: form.name_ar || null,
            description: form.description || null,
            latitude: form.latitude ? Number(form.latitude) : null,
            longitude: form.longitude ? Number(form.longitude) : null,
        };
        onSubmit(payload);
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

            <div className="grid grid-cols-2 gap-4">
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
                    <Label>Type de zone</Label>
                    <SearchableSelect
                        options={typeOptions}
                        value={form.geo_area_type_id || undefined}
                        onChange={(v) => setForm((f) => ({ ...f, geo_area_type_id: Number(v) }))}
                        placeholder="— Sélectionner un type —"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label>Parent</Label>
                <SearchableSelect
                    options={parentOptions}
                    value={form.parent_code || ''}
                    onChange={(v) => setForm((f) => ({ ...f, parent_code: v ? String(v) : null }))}
                    placeholder="— Sélectionner un parent —"
                    clearable
                />
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label htmlFor="latitude">Latitude</Label>
                    <Input
                        id="latitude"
                        type="number"
                        step="any"
                        value={form.latitude ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, latitude: e.target.value ? Number(e.target.value) : null }))}
                    />
                </div>
                <div className="space-y-2">
                    <Label htmlFor="longitude">Longitude</Label>
                    <Input
                        id="longitude"
                        type="number"
                        step="any"
                        value={form.longitude ?? ''}
                        onChange={(e) => setForm((f) => ({ ...f, longitude: e.target.value ? Number(e.target.value) : null }))}
                    />
                </div>
            </div>

            <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Input
                    id="description"
                    value={form.description ?? ''}
                    onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
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
                    {geoArea ? 'Mettre à jour' : 'Créer'}
                </Button>
            </div>
        </form>
    );
}
