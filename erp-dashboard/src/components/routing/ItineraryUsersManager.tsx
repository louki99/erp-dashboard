import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Trash2, Save } from 'lucide-react';
import SearchableSelect from '@/components/common/SearchableSelect';
import type { ItineraryUser, SyncItineraryUsersPayload } from '@/types/routing.types';

interface ItineraryUsersManagerProps {
    users: ItineraryUser[];
    availableUsers: Array<{ id: number; name: string; email: string }>;
    onSave: (payload: SyncItineraryUsersPayload) => void;
    loading?: boolean;
}

export function ItineraryUsersManager({
    users,
    availableUsers,
    onSave,
    loading,
}: ItineraryUsersManagerProps) {
    const [selectedIds, setSelectedIds] = useState<number[]>(() => users.map((u) => u.user_id));

    /* eslint-disable react-hooks/set-state-in-effect */
    // Sync with server state when users change (e.g. after save or initial load).
    useEffect(() => {
        setSelectedIds(users.map((u) => u.user_id));
    }, [users]);
    /* eslint-enable react-hooks/set-state-in-effect */

    const safeAvailableUsers = availableUsers ?? [];

    const availableOptions = safeAvailableUsers
        .filter((u) => !selectedIds.includes(u.id))
        .map((u) => ({ value: u.id, label: `${u.name} (${u.email})` }));

    const addUser = (userId: string | number | undefined) => {
        const id = Number(userId);
        if (!id || selectedIds.includes(id)) return;
        setSelectedIds((prev) => [...prev, id]);
    };

    const removeUser = (id: number) => {
        setSelectedIds((prev) => prev.filter((uid) => uid !== id));
    };

    const handleSave = () => {
        onSave({ user_ids: selectedIds });
    };

    const selectedUserNames = (id: number) => {
        const found = users.find((u) => u.user_id === id) || safeAvailableUsers.find((u) => u.id === id);
        return found?.name ?? `Utilisateur #${id}`;
    };

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-gray-900">Vendeurs affectés</h4>
                <Button type="button" size="sm" onClick={handleSave} disabled={loading}>
                    <Save className="w-3.5 h-3.5 mr-1" />
                    Enregistrer
                </Button>
            </div>

            <SearchableSelect
                options={availableOptions}
                value={undefined}
                onChange={addUser}
                placeholder="Ajouter un vendeur..."
            />

            <div className="space-y-2">
                {selectedIds.map((id) => (
                    <div
                        key={id}
                        className="flex items-center justify-between p-2.5 rounded-lg border border-gray-200 bg-white"
                    >
                        <span className="text-sm text-gray-800">{selectedUserNames(id)}</span>
                        <button
                            onClick={() => removeUser(id)}
                            className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                        >
                            <Trash2 className="w-3.5 h-3.5" />
                        </button>
                    </div>
                ))}
                {selectedIds.length === 0 && (
                    <p className="text-sm text-gray-400 text-center py-6">Aucun vendeur affecté</p>
                )}
            </div>
        </div>
    );
}
