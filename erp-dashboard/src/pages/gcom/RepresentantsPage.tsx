import { useState, useEffect, useCallback, useMemo } from 'react';
import {
    Users, Plus, RefreshCw, Search, XCircle, Save, Loader2, ShieldOff, Mail, Phone,
} from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox, type ComboboxOption } from '@/components/common/AsyncCombobox';

import { gcomApi } from '@/services/api/gcomApi';
import { financeApi } from '@/services/api/financeApi';
import type { GcomRepresentative } from '@/types/gcom.types';

// ── Create form (inline, center panel — no modal, matches this codebase's
// established CRUD convention) ─────────────────────────────────────────────
const CreateRepresentativeForm = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [code, setCode] = useState('');
    const [phone, setPhone] = useState('');
    const [selectedBranch, setSelectedBranch] = useState<ComboboxOption | null>(null);
    const [saving, setSaving] = useState(false);

    const searchBranches = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
        return (res.data ?? []).map(b => ({ id: b.id, label: b.name, sub: b.code }));
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !email.trim() || !password.trim()) {
            toast.error('Nom, email et mot de passe sont obligatoires');
            return;
        }
        setSaving(true);
        try {
            await gcomApi.representatives.create({
                name: name.trim(),
                email: email.trim(),
                password,
                code: code.trim() || undefined,
                branch_id: selectedBranch ? Number(selectedBranch.id) : undefined,
                phone: phone.trim() || undefined,
            });
            toast.success('Représentant créé');
            onCreated();
            onClose();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la création');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto">
            <div className="px-5 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sage-100 flex items-center justify-center shrink-0">
                    <Plus className="w-4.5 h-4.5 text-sage-600" />
                </div>
                <h2 className="text-base font-bold text-gray-900">Nouveau représentant</h2>
            </div>
            <div className="p-5 max-w-lg">
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nom <span className="text-red-500">*</span></label>
                        <input
                            value={name}
                            onChange={e => setName(e.target.value)}
                            placeholder="Karim Bennani"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email <span className="text-red-500">*</span></label>
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            placeholder="karim@example.com"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe <span className="text-red-500">*</span></label>
                        <input
                            type="password"
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Code (optionnel)</label>
                        <input
                            value={code}
                            onChange={e => setCode(e.target.value.toUpperCase())}
                            placeholder="REP-001"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Agence</label>
                        <AsyncCombobox
                            value={selectedBranch}
                            onChange={setSelectedBranch}
                            onSearch={searchBranches}
                            placeholder="Rechercher une agence…"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone (optionnel)</label>
                        <input
                            value={phone}
                            onChange={e => setPhone(e.target.value)}
                            placeholder="0600000000"
                            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                        />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                        <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50 flex items-center gap-2">
                            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                            {saving ? 'Création…' : 'Créer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ── Detail panel (inline edit, no modal) ─────────────────────────────────────
const RepresentativeDetailPanel = ({ representative, onSaved }: { representative: GcomRepresentative; onSaved: () => void }) => {
    const [detail, setDetail] = useState<GcomRepresentative>(representative);
    const [loadingDetail, setLoadingDetail] = useState(true);
    const [selectedBranch, setSelectedBranch] = useState<ComboboxOption | null>(null);
    const [phone, setPhone] = useState(representative.phone ?? '');
    const [isActive, setIsActive] = useState(representative.is_active);
    const [saving, setSaving] = useState(false);

    const searchBranches = useCallback(async (q: string): Promise<ComboboxOption[]> => {
        const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
        return (res.data ?? []).map(b => ({ id: b.id, label: b.name, sub: b.code }));
    }, []);

    useEffect(() => {
        setLoadingDetail(true);
        setPhone(representative.phone ?? '');
        setIsActive(representative.is_active);
        setSelectedBranch(null);
        gcomApi.representatives.get(representative.id)
            .then(full => {
                setDetail(full);
                if (full.branch_id) setSelectedBranch({ id: full.branch_id, label: `Agence #${full.branch_id}` });
            })
            .catch(() => setDetail(representative))
            .finally(() => setLoadingDetail(false));
    }, [representative]);

    const handleSave = async () => {
        setSaving(true);
        try {
            const updated = await gcomApi.representatives.update(representative.id, {
                branch_id: selectedBranch ? Number(selectedBranch.id) : undefined,
                phone: phone.trim() || undefined,
                is_active: isActive,
            });
            setDetail(updated);
            toast.success('Représentant mis à jour');
            onSaved();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors de la mise à jour');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="h-full overflow-y-auto p-5 space-y-5">
            <div className="rounded-xl border border-gray-200 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                    <div>
                        <p className="text-lg font-bold text-gray-900">{detail.name}</p>
                        {detail.code && <p className="font-mono text-xs text-gray-500 bg-gray-100 rounded px-1.5 py-0.5 inline-block mt-0.5">{detail.code}</p>}
                    </div>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded-full ${detail.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${detail.is_active ? 'bg-emerald-500' : 'bg-gray-400'}`} />
                        {detail.is_active ? 'Actif' : 'Inactif'}
                    </span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Mail className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {detail.email}
                </div>
                {detail.phone && (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Phone className="w-3.5 h-3.5 text-gray-400 shrink-0" /> {detail.phone}
                    </div>
                )}
            </div>

            {loadingDetail ? (
                <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (
                <div className="rounded-xl border border-gray-200 p-4">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Rôles &amp; permissions (lecture seule)</h3>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                        {(detail.roles ?? []).map(r => (
                            <span key={r} className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700">{r}</span>
                        ))}
                    </div>
                    <p className="text-[11px] text-gray-400">
                        {(detail.permissions ?? []).length > 0 ? `${detail.permissions!.length} permission(s) effective(s)` : 'Aucune permission additionnelle — accès limité au rôle représentant.'}
                    </p>
                </div>
            )}

            <div className="rounded-xl border border-gray-200 p-4 space-y-4">
                <h3 className="text-sm font-semibold text-gray-700">Modifier</h3>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Agence</label>
                    <AsyncCombobox
                        value={selectedBranch}
                        onChange={setSelectedBranch}
                        onSearch={searchBranches}
                        placeholder="Rechercher une agence…"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Téléphone</label>
                    <input
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-sage-500"
                    />
                </div>
                <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">Actif</span>
                    <button
                        onClick={() => setIsActive(v => !v)}
                        className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                    {saving ? 'Enregistrement…' : 'Enregistrer'}
                </button>
            </div>
        </div>
    );
};

// ── Main page ─────────────────────────────────────────────────────────────────
export const RepresentantsPage = () => {
    const [representatives, setRepresentatives] = useState<GcomRepresentative[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<GcomRepresentative | null>(null);
    const [creating, setCreating] = useState(false);
    const [search, setSearch] = useState('');
    const [statusFilter, setStatusFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
    const [removeTarget, setRemoveTarget] = useState<GcomRepresentative | null>(null);
    const [removing, setRemoving] = useState(false);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await gcomApi.representatives.list({
                search: search.trim() || undefined,
                is_active: statusFilter === 'ALL' ? undefined : statusFilter === 'ACTIVE',
                per_page: 100,
            });
            setRepresentatives(res.data);
        } catch {
            toast.error('Erreur lors du chargement des représentants');
            setRepresentatives([]);
        } finally {
            setLoading(false);
        }
    }, [search, statusFilter]);

    useEffect(() => { load(); }, [load]);

    const confirmRemove = async () => {
        if (!removeTarget) return;
        setRemoving(true);
        try {
            await gcomApi.representatives.remove(removeTarget.id);
            toast.success('Rôle représentant retiré — le compte utilisateur est conservé');
            setRemoveTarget(null);
            if (selected?.id === removeTarget.id) setSelected(null);
            load();
        } catch (err: unknown) {
            const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
            toast.error(msg ?? 'Erreur lors du retrait du rôle');
        } finally {
            setRemoving(false);
        }
    };

    const columnDefs = useMemo(() => [
        {
            headerName: 'Code', field: 'code', width: 110,
            cellRenderer: (p: { value?: string }) => p.value ? <span className="font-mono text-xs bg-gray-100 text-gray-800 rounded px-1.5 py-0.5">{p.value}</span> : <span className="text-gray-300">—</span>,
        },
        { headerName: 'Nom', field: 'name', flex: 1, minWidth: 150 },
        { headerName: 'Email', field: 'email', flex: 1, minWidth: 180 },
        {
            headerName: 'Téléphone', field: 'phone', width: 130,
            cellRenderer: (p: { value?: string }) => <span className="text-xs">{p.value ?? '—'}</span>,
        },
        {
            headerName: 'Statut', field: 'is_active', width: 100,
            cellRenderer: (p: { value?: boolean }) => (
                <span className="inline-flex items-center gap-1.5 text-xs">
                    <span className={`w-2 h-2 rounded-full ${p.value ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                    {p.value ? 'Actif' : 'Inactif'}
                </span>
            ),
        },
    ], []);

    const leftContent = (
        <div className="h-full flex flex-col">
            <div className="p-3 border-b border-gray-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                    <Users className="w-4 h-4 text-sage-600" />
                    Représentants
                </span>
                <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title="Rafraîchir">
                    <RefreshCw className="w-4 h-4" />
                </button>
            </div>
            <div className="px-3 py-2 border-b border-gray-100">
                <div className="relative">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                    <input
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        placeholder="Rechercher (nom, email, code)…"
                        className="w-full pl-8 pr-2 py-1.5 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sage-400"
                    />
                </div>
            </div>
            <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1">
                {([
                    { key: 'ALL', label: 'Tous' },
                    { key: 'ACTIVE', label: 'Actifs' },
                    { key: 'INACTIVE', label: 'Inactifs' },
                ] as { key: 'ALL' | 'ACTIVE' | 'INACTIVE'; label: string }[]).map(opt => (
                    <button
                        key={opt.key}
                        onClick={() => setStatusFilter(opt.key)}
                        className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
                            statusFilter === opt.key ? 'bg-sage-600 text-white border-sage-600' : 'bg-white text-gray-500 border-gray-200 hover:border-sage-300'
                        }`}
                    >
                        {opt.label}
                    </button>
                ))}
            </div>
            <div className="flex-1 overflow-hidden">
                <DataGrid
                    rowData={representatives}
                    columnDefs={columnDefs}
                    loading={loading}
                    rowSelection="single"
                    onRowClicked={(e: { data?: GcomRepresentative }) => { if (e.data) { setSelected(e.data); setCreating(false); } }}
                />
            </div>
        </div>
    );

    const mainContent = creating ? (
        <CreateRepresentativeForm onClose={() => setCreating(false)} onCreated={() => { setCreating(false); load(); }} />
    ) : selected ? (
        <RepresentativeDetailPanel representative={selected} onSaved={load} />
    ) : (
        <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-400">
                <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Sélectionnez un représentant ou créez-en un nouveau.</p>
            </div>
        </div>
    );

    const rightContent = (
        <ActionPanel
            groups={[
                {
                    items: [
                        { icon: Plus, label: 'Nouveau représentant', variant: 'primary', onClick: () => { setCreating(true); setSelected(null); } },
                        { icon: RefreshCw, label: 'Rafraîchir', variant: 'sage', onClick: load },
                    ],
                },
                ...(selected && !creating ? [{
                    items: [
                        { icon: ShieldOff, label: 'Retirer le rôle représentant', onClick: () => setRemoveTarget(selected) },
                        { icon: XCircle, label: 'Fermer', onClick: () => setSelected(null) },
                    ],
                }] : []),
            ]}
        />
    );

    return (
        <>
            <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
            {removeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full mx-4">
                        <div className="flex items-center gap-3 mb-3">
                            <div className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center">
                                <ShieldOff className="w-4 h-4 text-red-600" />
                            </div>
                            <h3 className="text-base font-semibold text-gray-900">Retirer le rôle représentant</h3>
                        </div>
                        <p className="text-sm text-gray-600 mb-5">
                            <strong>{removeTarget.name}</strong> ne sera plus sélectionnable comme commercial pour de nouvelles ventes. Le compte utilisateur et l'historique existant (BC/BL/Factures déjà attribués) sont conservés.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={confirmRemove}
                                disabled={removing}
                                className="flex-1 flex items-center justify-center gap-2 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                                {removing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ShieldOff className="w-3.5 h-3.5" />}
                                Confirmer
                            </button>
                            <button onClick={() => setRemoveTarget(null)} disabled={removing} className="flex-1 py-2 border border-gray-200 text-sm text-gray-600 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors">
                                Annuler
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};

export default RepresentantsPage;
