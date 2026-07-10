import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, GripVertical, Save } from 'lucide-react';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { ItineraryPartner, SyncPartnerEntry } from '@/types/routing.types';

interface ItineraryPartnersManagerProps {
    partners: ItineraryPartner[];
    availablePartners: Array<{ code: string; name: string }>;
    onSave: (entries: SyncPartnerEntry[]) => void;
    loading?: boolean;
}

function mapPartnersToEntries(partners: ItineraryPartner[]): SyncPartnerEntry[] {
    return partners.map((p) => ({
        partner_code: p.partner_code,
        rank: p.rank,
        is_stop_point: p.is_stop_point,
        start_time: p.start_time,
        end_time: p.end_time,
        mileage: p.mileage,
        visit_frequency_days: p.visit_frequency_days,
        notes: p.notes,
    }));
}

export function ItineraryPartnersManager({
    partners,
    availablePartners,
    onSave,
    loading,
}: ItineraryPartnersManagerProps) {
    const [entries, setEntries] = useState<SyncPartnerEntry[]>(() => mapPartnersToEntries(partners));

    // Sync with server state when partners change (e.g. after save or initial load).
    useEffect(() => {
        setEntries(mapPartnersToEntries(partners));
    }, [partners]);

    const safeAvailablePartners = availablePartners ?? [];

    const availableOptions = safeAvailablePartners.map((p) => ({
        value: p.code,
        label: `${p.name} (${p.code})`,
    }));

    const addEntry = () => {
        setEntries((prev) => [
            ...prev,
            {
                partner_code: '',
                rank: prev.length,
                is_stop_point: false,
                start_time: null,
                end_time: null,
                mileage: null,
                visit_frequency_days: 7,
                notes: null,
            },
        ]);
    };

    const removeEntry = (index: number) => {
        setEntries((prev) => prev.filter((_, i) => i !== index));
    };

    const updateEntry = (index: number, patch: Partial<SyncPartnerEntry>) => {
        setEntries((prev) => prev.map((entry, i) => (i === index ? { ...entry, ...patch } : entry)));
    };

    const handleSave = () => {
        const cleaned = entries
            .filter((e) => e.partner_code)
            .map((e, index) => ({ ...e, rank: index }));
        onSave(cleaned);
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Partenaires de la tournée</h4>
                <div className="flex items-center gap-2">
                    <Button type="button" size="sm" variant="outline" onClick={addEntry}>
                        <Plus className="w-3.5 h-3.5 mr-1" />
                        Ajouter
                    </Button>
                    <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Enregistrer
                    </Button>
                </div>
            </div>

            <div className="space-y-2 pr-1">
                {entries.map((entry, index) => (
                    <div
                        key={`${entry.partner_code}-${index}`}
                        className="flex items-start gap-2 p-3 rounded-lg border border-gray-200 bg-white"
                    >
                        <GripVertical className="w-4 h-4 text-gray-300 mt-2" />
                        <div className="flex-1 grid grid-cols-12 gap-2">
                            <div className="col-span-5">
                                <SearchableSelect
                                    options={availableOptions}
                                    value={entry.partner_code}
                                    onChange={(v) => updateEntry(index, { partner_code: v ? String(v) : '' })}
                                    placeholder="Partenaire"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="time"
                                    value={entry.start_time ?? ''}
                                    onChange={(e) => updateEntry(index, { start_time: e.target.value || null })}
                                    className="text-xs"
                                />
                            </div>
                            <div className="col-span-2">
                                <Input
                                    type="time"
                                    value={entry.end_time ?? ''}
                                    onChange={(e) => updateEntry(index, { end_time: e.target.value || null })}
                                    className="text-xs"
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    step="any"
                                    placeholder="km"
                                    value={entry.mileage ?? ''}
                                    onChange={(e) => updateEntry(index, { mileage: e.target.value ? Number(e.target.value) : null })}
                                    className="text-xs"
                                />
                            </div>
                            <div className="col-span-1">
                                <Input
                                    type="number"
                                    placeholder="fréq."
                                    value={entry.visit_frequency_days}
                                    onChange={(e) => updateEntry(index, { visit_frequency_days: Number(e.target.value) })}
                                    className="text-xs"
                                />
                            </div>
                            <div className="col-span-1 flex items-center justify-end gap-1">
                                <div className="flex items-center gap-1">
                                    <Checkbox
                                        id={`stop-${index}`}
                                        checked={entry.is_stop_point}
                                        onCheckedChange={(checked) => updateEntry(index, { is_stop_point: checked === true })}
                                    />
                                    <Label htmlFor={`stop-${index}`} className="text-[10px] cursor-pointer">Arrêt</Label>
                                </div>
                                <button
                                    onClick={() => removeEntry(index)}
                                    className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
                {entries.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun partenaire affecté</p>
                )}
            </div>
        </div>
    );
}
