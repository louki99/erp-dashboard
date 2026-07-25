import { useMemo, useState } from 'react';
import type { ColDef } from 'ag-grid-community';
import { CalendarPlus, Trash2, Upload, Loader2, CalendarDays, AlertCircle, CheckCircle2, RefreshCw, ListFilter } from 'lucide-react';
import toast from 'react-hot-toast';

import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { Modal, ConfirmModal } from '@/components/common/Modal';
import { PartnerPicker, type PartnerPickerOption } from '@/components/telesales/PartnerPicker';
import {
    useTelesalesAgents,
    useSchedulesList,
    useCreateSchedule,
    useBulkCreateSchedules,
    useDeleteSchedule,
} from '@/hooks/telesales';
import type { TeleVisit, BulkScheduleEntry, TeleVisitOutcome } from '@/types/telesales.types';
import { TELE_VISIT_OUTCOME_LABELS } from '@/types/telesales.types';

const todayIso = () => new Date().toISOString().slice(0, 10);
const weekAheadIso = () => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString().slice(0, 10);
};

const outcomeBadge = (outcome: TeleVisitOutcome | null) => {
    if (!outcome) return <span className="text-xs text-gray-400">En attente</span>;
    const label = TELE_VISIT_OUTCOME_LABELS[outcome];
    const isSuccess = outcome === 'ORDER_TAKEN';
    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold ${isSuccess ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'}`}>
            {label}
        </span>
    );
};

export const TelesalesSchedulesPage = () => {
    const { data: agents, loading: agentsLoading } = useTelesalesAgents();

    const [filterAgentId, setFilterAgentId] = useState<number | ''>('');
    const [filterDateFrom, setFilterDateFrom] = useState(todayIso());
    const [filterDateTo, setFilterDateTo] = useState(weekAheadIso());

    const { data: visits, loading, refetch } = useSchedulesList({
        user_id: filterAgentId || undefined,
        date_from: filterDateFrom || undefined,
        date_to: filterDateTo || undefined,
    });

    const { createSchedule, loading: creating } = useCreateSchedule();
    const { bulkCreateSchedules, loading: bulkCreating } = useBulkCreateSchedules();
    const { execute: deleteSchedule, loading: deleting } = useDeleteSchedule();

    // Single create form
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [formAgentId, setFormAgentId] = useState<number | ''>('');
    const [formPartner, setFormPartner] = useState<PartnerPickerOption | null>(null);
    const [formDate, setFormDate] = useState('');
    const [formTime, setFormTime] = useState('');
    const [formNotes, setFormNotes] = useState('');

    // Bulk import
    const [showBulkModal, setShowBulkModal] = useState(false);
    const [bulkText, setBulkText] = useState('');
    const [bulkResult, setBulkResult] = useState<{ created_count: number; error_count: number; errors: { index: number; message: string }[] } | null>(null);

    // Delete confirm
    const [deleteTarget, setDeleteTarget] = useState<TeleVisit | null>(null);

    const resetCreateForm = () => {
        setFormAgentId('');
        setFormPartner(null);
        setFormDate('');
        setFormTime('');
        setFormNotes('');
    };

    const handleCreate = async () => {
        if (!formAgentId || !formPartner || !formDate || !formTime) {
            toast.error('Agent, partenaire, date et heure sont requis');
            return;
        }
        try {
            await createSchedule({
                user_id: Number(formAgentId),
                partner_id: formPartner.id,
                scheduled_at: `${formDate} ${formTime}:00`,
                notes: formNotes || undefined,
            });
            toast.success('Appel planifié');
            resetCreateForm();
            setShowCreateModal(false);
            refetch();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Échec de la planification');
        }
    };

    const handleBulkSubmit = async () => {
        const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean);
        const entries: BulkScheduleEntry[] = [];
        for (const line of lines) {
            const [userId, partnerId, date, time, ...notesParts] = line.split(',').map((p) => p.trim());
            if (!userId || !partnerId || !date || !time) continue;
            entries.push({
                user_id: Number(userId),
                partner_id: Number(partnerId),
                scheduled_at: `${date} ${time}:00`,
                notes: notesParts.join(',') || undefined,
            });
        }
        if (entries.length === 0) {
            toast.error('Aucune ligne valide à importer (format: user_id,partner_id,YYYY-MM-DD,HH:mm)');
            return;
        }
        try {
            const res = await bulkCreateSchedules({ entries });
            setBulkResult({ created_count: res.created_count, error_count: res.error_count, errors: res.errors });
            refetch();
            if (res.error_count === 0) {
                toast.success(`${res.created_count} créneau(x) importé(s)`);
                setBulkText('');
                setShowBulkModal(false);
                setBulkResult(null);
            } else {
                toast.error(`${res.created_count} importé(s), ${res.error_count} en erreur — voir détail`);
            }
        } catch (err: any) {
            toast.error(err?.response?.data?.message || "Échec de l'import en masse");
        }
    };

    const handleDelete = async () => {
        if (!deleteTarget) return;
        try {
            await deleteSchedule(deleteTarget.id);
            toast.success('Créneau retiré');
            refetch();
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Suppression impossible');
        } finally {
            setDeleteTarget(null);
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
                field: 'scheduled_at', headerName: 'Créneau', width: 160,
                valueFormatter: (p: any) => p.value ? new Date(p.value).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' }) : '-',
            },
            {
                field: 'outcome', headerName: 'Résultat', width: 150,
                cellRenderer: (p: any) => outcomeBadge(p.value),
            },
            { field: 'notes', headerName: 'Notes', flex: 1, valueFormatter: (p: any) => p.value || '-' },
            {
                headerName: '', width: 70, sortable: false, filter: false,
                cellRenderer: (p: any) => (
                    <button
                        onClick={() => setDeleteTarget(p.data)}
                        disabled={!!p.data?.outcome}
                        className="text-red-500 hover:text-red-700 p-1 disabled:opacity-30 disabled:cursor-not-allowed"
                        title={p.data?.outcome ? 'Appel déjà qualifié — historique' : 'Retirer le créneau'}
                    >
                        <Trash2 className="w-4 h-4" />
                    </button>
                ),
            },
        ],
        []
    );

    const stats = useMemo(() => ({
        total: visits.length,
        pending: visits.filter((v) => !v.outcome).length,
        qualified: visits.filter((v) => !!v.outcome).length,
    }), [visits]);

    const mainContent = (
        <div className="h-full flex flex-col bg-gray-50/50">
            <div className="p-6 border-b border-gray-200 bg-white/80 backdrop-blur-md shadow-sm z-10">
                <div className="flex items-center justify-between flex-wrap gap-4">
                    <div>
                        <h2 className="text-2xl font-extrabold text-gray-900 tracking-tight">Semainier d'équipe</h2>
                        <p className="text-sm font-medium text-gray-500 mt-1">Créneaux d'appel planifiés pour les télévendeurs</p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => setShowBulkModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-white text-gray-700 border border-gray-200 hover:border-gray-300 hover:bg-gray-50 shadow-sm"
                        >
                            <Upload className="w-4 h-4" />
                            Import en masse
                        </button>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold rounded-xl bg-gradient-to-r from-sage-500 to-sage-600 text-white shadow-sm hover:shadow"
                        >
                            <CalendarPlus className="w-4 h-4" />
                            Planifier un appel
                        </button>
                    </div>
                </div>
            </div>
            <div className="flex-1 overflow-hidden">
                {!loading && visits.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-gray-500">
                        <div className="text-center">
                            <CalendarDays className="w-12 h-12 mx-auto mb-3 text-gray-400" />
                            <p>Aucun créneau sur cette période</p>
                        </div>
                    </div>
                ) : (
                    <DataGrid rowData={visits} columnDefs={columnDefs} loading={loading} />
                )}
            </div>
        </div>
    );

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-100 flex flex-col p-5 gap-5">
                        <div>
                            <h1 className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 flex items-center gap-1.5">
                                <ListFilter className="w-3.5 h-3.5" /> Filtres
                            </h1>
                            <div className="space-y-3">
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
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Du</label>
                                    <input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)}
                                        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                                </div>
                                <div>
                                    <label className="block text-[11px] font-semibold text-gray-400 uppercase mb-1">Au</label>
                                    <input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)}
                                        className="w-full px-2.5 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-4 border border-blue-100/50 shadow-sm">
                                <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider mb-1">Total</div>
                                <div className="text-3xl font-black text-blue-700 tracking-tight">{stats.total}</div>
                            </div>
                            <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-4 border border-amber-100/50 shadow-sm">
                                <div className="text-[11px] font-bold text-amber-600 uppercase tracking-wider mb-1">En attente</div>
                                <div className="text-3xl font-black text-amber-700 tracking-tight">{stats.pending}</div>
                            </div>
                            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-4 border border-emerald-100/50 shadow-sm">
                                <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider mb-1">Qualifiés</div>
                                <div className="text-3xl font-black text-emerald-700 tracking-tight">{stats.qualified}</div>
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
                                    { icon: CalendarPlus, label: 'Planifier un appel', variant: 'sage', onClick: () => setShowCreateModal(true) },
                                    { icon: Upload, label: 'Import en masse', onClick: () => setShowBulkModal(true) },
                                    { icon: RefreshCw, label: 'Rafraîchir', onClick: refetch },
                                ],
                            },
                        ]}
                    />
                }
            />

            {/* Single create modal */}
            <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} title="Planifier un appel" size="md">
                <div className="p-5 space-y-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Agent (télévendeur)</label>
                        <select
                            value={formAgentId}
                            onChange={(e) => setFormAgentId(e.target.value ? Number(e.target.value) : '')}
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
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Partenaire</label>
                        <PartnerPicker value={formPartner} onChange={setFormPartner} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Date</label>
                            <input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Heure</label>
                            <input type="time" value={formTime} onChange={(e) => setFormTime(e.target.value)}
                                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1.5">Notes (optionnel)</label>
                        <textarea value={formNotes} onChange={(e) => setFormNotes(e.target.value)} rows={2}
                            className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500" />
                    </div>
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => setShowCreateModal(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Annuler
                        </button>
                        <button onClick={handleCreate} disabled={creating}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50">
                            {creating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Planifier
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Bulk import modal */}
            <Modal isOpen={showBulkModal} onClose={() => { setShowBulkModal(false); setBulkResult(null); }} title="Import en masse (jusqu'à 500 lignes)" size="lg">
                <div className="p-5 space-y-4">
                    <p className="text-sm text-gray-500">
                        Une ligne par créneau, format CSV : <code className="bg-gray-100 px-1.5 py-0.5 rounded text-xs">user_id,partner_id,YYYY-MM-DD,HH:mm,notes optionnel</code>
                    </p>
                    <textarea
                        value={bulkText}
                        onChange={(e) => setBulkText(e.target.value)}
                        rows={10}
                        placeholder={'57,2,2026-07-27,10:00\n58,3,2026-07-27,11:00,Relance mensuelle'}
                        className="w-full px-3 py-2 text-sm font-mono border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sage-500/50 focus:border-sage-500"
                    />
                    {bulkResult && (
                        <div className="rounded-lg border border-gray-200 p-3 space-y-2">
                            <div className="flex items-center gap-2 text-sm">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                                <span className="font-medium text-gray-700">{bulkResult.created_count} créé(s)</span>
                                {bulkResult.error_count > 0 && (
                                    <>
                                        <AlertCircle className="w-4 h-4 text-red-500 ml-3" />
                                        <span className="font-medium text-red-600">{bulkResult.error_count} en erreur</span>
                                    </>
                                )}
                            </div>
                            {bulkResult.errors.length > 0 && (
                                <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                                    {bulkResult.errors.map((e) => (
                                        <li key={e.index}>Ligne {e.index + 1} : {e.message}</li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                    <div className="flex justify-end gap-3 pt-2">
                        <button onClick={() => { setShowBulkModal(false); setBulkResult(null); }} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                            Fermer
                        </button>
                        <button onClick={handleBulkSubmit} disabled={bulkCreating}
                            className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white bg-sage-600 rounded-lg hover:bg-sage-700 disabled:opacity-50">
                            {bulkCreating && <Loader2 className="w-4 h-4 animate-spin" />}
                            Importer
                        </button>
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                isOpen={!!deleteTarget}
                onClose={() => setDeleteTarget(null)}
                onConfirm={handleDelete}
                title="Retirer ce créneau ?"
                message={deleteTarget ? `Le créneau de ${deleteTarget.user?.name ?? `#${deleteTarget.user_id}`} avec ${deleteTarget.partner?.name ?? `#${deleteTarget.partner_id}`} sera supprimé.` : ''}
                variant="danger"
                loading={deleting}
            />
        </>
    );
};

export default TelesalesSchedulesPage;
