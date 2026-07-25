import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { UserPlus, Users, Loader2, X, Briefcase, RefreshCw, ListFilter } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import { useTelesalesAgents, useAssignmentsList, useCreateAssignment } from '@/hooks/telesales';

export const TelesalesAssignmentsPage = () => {
    const { data: agents, loading: agentsLoading } = useTelesalesAgents();

    const [filterAgentId, setFilterAgentId] = useState<number | ''>('');
    const { data: assignments, loading, refetch } = useAssignmentsList({ user_id: filterAgentId || undefined });

    const { createAssignment, loading: assigning } = useCreateAssignment();

    const [agentId, setAgentId] = useState<number | ''>('');
    const [selectedPartners, setSelectedPartners] = useState<PartnerPickerOption[]>([]);
    const [pickerValue, setPickerValue] = useState<PartnerPickerOption | null>(null);

    const addPartner = (partner: PartnerPickerOption | null) => {
        if (!partner) return;
        setSelectedPartners((prev) => (prev.some((p) => p.id === partner.id) ? prev : [...prev, partner]));
        setPickerValue(null);
    };

    const removePartner = (id: number) => {
        setSelectedPartners((prev) => prev.filter((p) => p.id !== id));
    };

    const handleAssign = async () => {
        if (!agentId || selectedPartners.length === 0) {
            toast.error('Sélectionner un agent et au moins un partenaire');
            return;
        }
        try {
            const res = await createAssignment({ user_id: Number(agentId), partner_ids: selectedPartners.map((p) => p.id) });
            toast.success(res.message || `${selectedPartners.length} partenaire(s) assigné(s)`);
            setSelectedPartners([]);
            setAgentId('');
            refetch();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec de l'assignation");
        }
    };

    const columnDefs = useMemo<ColDef[]>(
        () => [
            { field: 'user.name', headerName: 'Agent', flex: 1, minWidth: 150, valueGetter: (p: any) => p.data?.user?.name ?? `#${p.data?.user_id}` },
            {
                field: 'partner.name', headerName: 'Partenaire', flex: 1, minWidth: 180,
                valueGetter: (p: any) => p.data?.partner ? `${p.data.partner.name} (${p.data.partner.code})` : `#${p.data?.partner_id}`,
            },
            {
                field: 'assigned_at', headerName: 'Assigné le', width: 170,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-',
            },
        ],
        []
    );

    const stats = useMemo(() => {
        const uniqueAgents = new Set(assignments.map((a) => a.user_id));
        return { total: assignments.length, agents: uniqueAgents.size };
    }, [assignments]);

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Distribution de portefeuille</h2>
                <p className="text-sm font-medium text-gray-500 mt-1">
                    Attribuer des partenaires à un télévendeur. Un partenaire n'appartient qu'à un seul portefeuille à la fois — réassigner le déplace simplement (§7.4).
                </p>
            </div>

            <div className="p-6 bg-white border-b border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Agent (télévendeur)</label>
                        <select
                            value={agentId}
                            onChange={(e) => setAgentId(e.target.value ? Number(e.target.value) : '')}
                            disabled={agentsLoading}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                        >
                            <option value="">Sélectionner un agent...</option>
                            {agents.map((a) => (
                                <option key={a.id} value={a.id}>{a.name}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Ajouter un partenaire</label>
                        <PartnerPicker value={pickerValue} onChange={addPartner} />
                    </div>
                </div>

                {selectedPartners.length > 0 && (
                    <div className="mt-4 max-w-4xl">
                        <div className="text-xs font-bold text-gray-500 uppercase mb-2">Partenaires à assigner ({selectedPartners.length})</div>
                        <div className="flex flex-wrap gap-2">
                            {selectedPartners.map((p) => (
                                <span key={p.id} className="flex items-center gap-1.5 px-3 py-1.5 bg-sage-50 border border-sage-100 rounded-full text-sm text-gray-700">
                                    {p.name} <span className="text-gray-400">({p.code})</span>
                                    <button onClick={() => removePartner(p.id)} className="text-gray-400 hover:text-red-500">
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                </span>
                            ))}
                        </div>
                    </div>
                )}

                <div className="mt-5 max-w-4xl flex justify-end">
                    <button
                        onClick={handleAssign}
                        disabled={assigning || !agentId || selectedPartners.length === 0}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-gradient-to-r from-sage-500 to-sage-600 rounded-xl shadow-sm hover:shadow disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {assigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
                        Distribuer le portefeuille
                    </button>
                </div>
            </div>

            <div className="flex-1 overflow-hidden">
                {!loading && assignments.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <Briefcase className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>{filterAgentId ? 'Aucun partenaire assigné à cet agent' : 'Aucune assignation'}</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid rowData={assignments} columnDefs={columnDefs} loading={loading} />
                )}
            </div>
        </div>
    );

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-100 flex flex-col p-5 gap-5">
                    <div>
                        <h1 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                            <ListFilter className="w-3.5 h-3.5" /> Filtres
                        </h1>
                        <div>
                            <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Agent</label>
                            <select
                                value={filterAgentId}
                                onChange={(e) => setFilterAgentId(e.target.value ? Number(e.target.value) : '')}
                                disabled={agentsLoading}
                                className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                            >
                                <option value="">Tous les agents</option>
                                {agents.map((a) => (
                                    <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="space-y-3">
                        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50 shadow-sm">
                            <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Partenaires assignés</div>
                            <div className="text-3xl font-black text-blue-700 tracking-tight">{stats.total}</div>
                        </div>
                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100/50 shadow-sm">
                            <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Agents actifs</div>
                            <div className="text-3xl font-black text-emerald-700 tracking-tight">{stats.agents}</div>
                        </div>
                    </div>
                </div>
            }
            mainContent={mainContent}
            rightContent={
                <ActionPanel
                    groups={[
                        {
                            items: [
                                { icon: Users, label: 'Distribuer le portefeuille', variant: 'sage', onClick: handleAssign, disabled: assigning || !agentId || selectedPartners.length === 0 },
                                { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                            ],
                        },
                    ]}
                />
            }
        />
    );
};

export default TelesalesAssignmentsPage;
