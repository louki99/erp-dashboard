import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, RefreshCw, CheckCircle2, XCircle, ChevronRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { financeApi } from '@/services/api/financeApi';
import type { Transfer, Journal, LedgerEntry, TransferStatus } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};

const STATUS_CONFIG: Record<TransferStatus, { label: string; color: string }> = {
  2: { label: 'DEMANDE', color: 'bg-amber-100 text-amber-700' },
  3: { label: 'ACCEPTÉ', color: 'bg-green-100 text-green-700' },
  4: { label: 'REJETÉ', color: 'bg-red-100 text-red-600' },
  5: { label: 'ANNULÉ', color: 'bg-gray-100 text-gray-500' },
};

const StatusBadge = ({ status }: { status: TransferStatus }) => {
  const cfg = STATUS_CONFIG[status] ?? { label: String(status), color: 'bg-gray-100 text-gray-500' };
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${cfg.color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {cfg.label}
    </span>
  );
};

// ── Approve Modal ─────────────────────────────────────────────────────────────
interface ApproveModalProps {
  transfer: Transfer;
  onClose: () => void;
  onDone: () => void;
}

const ApproveModal = ({ transfer, onClose, onDone }: ApproveModalProps) => {
  const [comment, setComment] = useState('');
  const [confirmedAmount, setConfirmedAmount] = useState(transfer.amount);
  const [saving, setSaving] = useState(false);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await financeApi.approveTransfer(transfer.id, {
        ...(comment ? { comment } : {}),
        ...(confirmedAmount ? { confirmed_amount: parseFloat(String(confirmedAmount)) } : {}),
      });
      toast.success('Transfert approuvé');
      if (res.entries) setEntries(res.entries);
      else { onDone(); onClose(); }
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de l\'approbation';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (entries.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            <h2 className="text-lg font-semibold text-gray-900">Transfert approuvé</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">Écritures comptables générées :</p>
          <div className="space-y-2 mb-4">
            {entries.map(e => (
              <div key={e.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                <div className="font-mono text-gray-500">{e.compte_comptable} — {e.journal_code}</div>
                <div className="text-gray-800 mt-1">{e.libelle}</div>
                <div className="flex gap-4 mt-1">
                  {parseFloat(e.debit_amount) > 0 && <span className="text-green-700 font-semibold">Débit: {formatMAD(e.debit_amount)}</span>}
                  {parseFloat(e.credit_amount) > 0 && <span className="text-red-600 font-semibold">Crédit: {formatMAD(e.credit_amount)}</span>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { onDone(); onClose(); }} className="w-full py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            Fermer
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Approuver le transfert #{transfer.id}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Montant confirmé</label>
            <input
              type="number"
              step="0.01"
              value={confirmedAmount}
              onChange={e => setConfirmedAmount(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Commentaire (optionnel)</label>
            <textarea
              value={comment}
              onChange={e => setComment(e.target.value)}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Approuver
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Reject Modal ──────────────────────────────────────────────────────────────
interface RejectModalProps {
  transfer: Transfer;
  onClose: () => void;
  onDone: () => void;
}

const RejectModal = ({ transfer, onClose, onDone }: RejectModalProps) => {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error('Le motif est obligatoire'); return; }
    setSaving(true);
    try {
      await financeApi.rejectTransfer(transfer.id, { reason });
      toast.success('Transfert rejeté');
      onDone();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors du rejet';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Rejeter le transfert #{transfer.id}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Motif du rejet *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none"
              placeholder="Expliquer la raison du rejet…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              Rejeter
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Create Transfer Modal ─────────────────────────────────────────────────────
interface CreateTransferModalProps {
  journals: Journal[];
  onClose: () => void;
  onCreated: () => void;
}

const CreateTransferModal = ({ journals, onClose, onCreated }: CreateTransferModalProps) => {
  const [sourceJournalId, setSourceJournalId] = useState('');
  const [destJournalId, setDestJournalId] = useState('');
  const [amount, setAmount] = useState('');
  const [transferType, setTransferType] = useState<'DIRECT' | 'BANK_DEPOSIT'>('DIRECT');
  const [versementRef, setVersementRef] = useState('');
  const [versementPhoto, setVersementPhoto] = useState('');
  const [bankName, setBankName] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [intakeLineId, setIntakeLineId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const sourceJournal = journals.find(j => j.id === Number(sourceJournalId));
  const isESP = sourceJournal?.method_suffix === 'ESP';
  const isCHQorEFF = sourceJournal?.method_suffix === 'CHQ' || sourceJournal?.method_suffix === 'EFF';
  const isBankDeposit = isESP && transferType === 'BANK_DEPOSIT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceJournalId || !destJournalId) { toast.error('Veuillez sélectionner les journaux source et destination'); return; }
    setSaving(true);
    try {
      await financeApi.createTransfer({
        source_journal_id: Number(sourceJournalId),
        dest_journal_id: Number(destJournalId),
        amount: parseFloat(amount || '0'),
        ...(isESP ? { transfer_type: transferType } : {}),
        ...(isBankDeposit && versementRef ? { versement_reference: versementRef } : {}),
        ...(isBankDeposit && versementPhoto ? { versement_photo_path: versementPhoto } : {}),
        ...(isBankDeposit && bankName ? { bank_name: bankName } : {}),
        ...(isBankDeposit && depositDate ? { deposit_date: depositDate } : {}),
        ...(isCHQorEFF && intakeLineId ? { intake_line_id: Number(intakeLineId) } : {}),
        ...(note ? { note } : {}),
      });
      toast.success('Transfert créé');
      onCreated();
      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message ?? err?.response?.data?.error ?? 'Erreur lors de la création';
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Nouveau transfert de fonds</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Journal source *</label>
            <select
              value={sourceJournalId}
              onChange={e => setSourceJournalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Sélectionner --</option>
              {journals.map(j => (
                <option key={j.id} value={j.id}>{j.code} ({j.method_suffix})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Journal destination *</label>
            <select
              value={destJournalId}
              onChange={e => setDestJournalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">-- Sélectionner --</option>
              {journals.filter(j => j.id !== Number(sourceJournalId)).map(j => (
                <option key={j.id} value={j.id}>{j.code} ({j.method_suffix})</option>
              ))}
            </select>
          </div>

          {isESP && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type de transfert</label>
              <select
                value={transferType}
                onChange={e => setTransferType(e.target.value as 'DIRECT' | 'BANK_DEPOSIT')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="DIRECT">Direct</option>
                <option value="BANK_DEPOSIT">Dépôt bancaire</option>
              </select>
            </div>
          )}

          {isBankDeposit && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Référence versement</label>
                <input type="text" value={versementRef} onChange={e => setVersementRef(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Photo versement (URL)</label>
                <input type="text" value={versementPhoto} onChange={e => setVersementPhoto(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nom de la banque</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date de dépôt</label>
                <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
            </>
          )}

          {isCHQorEFF && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ID ligne d'encaissement</label>
              <input
                type="number"
                value={intakeLineId}
                onChange={e => setIntakeLineId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="ex: 123"
              />
              <p className="text-xs text-gray-400 mt-1">Le montant sera déterminé automatiquement par la ligne d'encaissement</p>
            </div>
          )}

          {!isCHQorEFF && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Montant *</label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="0.00"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Note (optionnel)</label>
            <textarea
              value={note}
              onChange={e => setNote(e.target.value)}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              Annuler
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Créer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────
interface TransferDetailProps {
  transfer: Transfer;
  onAction: () => void;
}

const TransferDetail = ({ transfer, onAction }: TransferDetailProps) => {
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const statusCfg = STATUS_CONFIG[transfer.status] ?? { label: String(transfer.status), color: 'bg-gray-100 text-gray-500' };

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">Transfert</p>
          <p className="text-2xl font-bold text-gray-900">#{transfer.id}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${statusCfg.color}`}>{statusCfg.label}</span>
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <p className="text-xs text-emerald-600 uppercase font-semibold tracking-wide mb-1">Montant</p>
        <p className="text-3xl font-bold text-emerald-800">{formatMAD(transfer.amount)}</p>
        <p className="text-xs text-emerald-600 mt-1">{transfer.currency}</p>
      </div>

      {/* Info rows */}
      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-gray-500">Source</span>
          <span className="font-mono font-semibold text-gray-800">
            {transfer.sourceJournal.code} <span className="text-xs text-gray-400">({transfer.sourceJournal.method_suffix})</span>
          </span>
        </div>
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-gray-500">Destination</span>
          <span className="font-mono font-semibold text-gray-800">
            {transfer.destJournal.code} <span className="text-xs text-gray-400">({transfer.destJournal.method_suffix})</span>
          </span>
        </div>
        {transfer.transfer_type && (
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Type</span>
            <span className="text-gray-800">{transfer.transfer_type}</span>
          </div>
        )}
        {transfer.bank_name && (
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Banque</span>
            <span className="text-gray-800">{transfer.bank_name}</span>
          </div>
        )}
        {transfer.deposit_date && (
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Date dépôt</span>
            <span className="text-gray-800">{transfer.deposit_date}</span>
          </div>
        )}
        {transfer.versement_reference && (
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Réf. versement</span>
            <span className="text-gray-800">{transfer.versement_reference}</span>
          </div>
        )}
        <div className="flex justify-between px-4 py-2.5 text-sm">
          <span className="text-gray-500">Créé le</span>
          <span className="text-gray-800">{new Date(transfer.created_at).toLocaleString('fr-MA')}</span>
        </div>
        {transfer.createdBy && (
          <div className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">Par</span>
            <span className="text-gray-800">{transfer.createdBy.name}</span>
          </div>
        )}
        {transfer.note && (
          <div className="px-4 py-2.5 text-sm">
            <p className="text-gray-500 mb-1">Note</p>
            <p className="text-gray-800 bg-gray-50 rounded p-2 text-xs">{transfer.note}</p>
          </div>
        )}
        {transfer.rejection_reason && (
          <div className="px-4 py-2.5 text-sm">
            <p className="text-red-500 mb-1">Motif de rejet</p>
            <p className="text-red-700 bg-red-50 rounded p-2 text-xs">{transfer.rejection_reason}</p>
          </div>
        )}
      </div>

      {/* Actions for REQUESTED transfers */}
      {transfer.status === 2 && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowApprove(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700"
          >
            <CheckCircle2 className="w-4 h-4" /> Approuver
          </button>
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700"
          >
            <XCircle className="w-4 h-4" /> Rejeter
          </button>
        </div>
      )}

      {showApprove && (
        <ApproveModal transfer={transfer} onClose={() => setShowApprove(false)} onDone={onAction} />
      )}
      {showReject && (
        <RejectModal transfer={transfer} onClose={() => setShowReject(false)} onDone={onAction} />
      )}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const TransfersPage = () => {
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [tRes, jRes] = await Promise.all([
        financeApi.getTransfers({
          ...(statusFilter ? { status: Number(statusFilter) } : {}),
          ...(fromDate ? { from_date: fromDate } : {}),
          ...(toDate ? { to_date: toDate } : {}),
        }),
        financeApi.getJournals(),
      ]);
      setTransfers(Array.isArray(tRes.data) ? tRes.data : []);
      setJournals(Array.isArray(jRes.data) ? jRes.data : []);
    } catch {
      toast.error('Erreur lors du chargement des transferts');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate]);

  useEffect(() => { load(); }, []);

  const columnDefs = [
    { headerName: '#', field: 'id', width: 70 },
    {
      headerName: 'Source → Dest',
      field: 'sourceJournal',
      cellRenderer: (p: any) => (
        <span className="text-xs font-mono flex items-center gap-1">
          {p.data?.sourceJournal?.code}
          <ChevronRight className="w-3 h-3 text-gray-400" />
          {p.data?.destJournal?.code}
        </span>
      ),
    },
    {
      headerName: 'Montant',
      field: 'amount',
      cellRenderer: (p: any) => <span className="text-xs font-semibold">{formatMAD(p.value)}</span>,
    },
    {
      headerName: 'Statut',
      field: 'status',
      cellRenderer: (p: any) => <StatusBadge status={p.value} />,
    },
    {
      headerName: 'Date',
      field: 'created_at',
      cellRenderer: (p: any) => <span className="text-xs text-gray-500">{new Date(p.value).toLocaleDateString('fr-MA')}</span>,
    },
  ];

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
          Transferts
        </span>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-3.5 h-3.5" /> Nouveau
          </button>
        </div>
      </div>
      {/* Filters */}
      <div className="p-3 border-b border-gray-200 space-y-2">
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
        >
          <option value="">Tous les statuts</option>
          <option value="2">Demandé</option>
          <option value="3">Accepté</option>
          <option value="4">Rejeté</option>
          <option value="5">Annulé</option>
        </select>
        <div className="flex gap-2">
          <input
            type="date"
            value={fromDate}
            onChange={e => setFromDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            title="Du"
          />
          <input
            type="date"
            value={toDate}
            onChange={e => setToDate(e.target.value)}
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500"
            title="Au"
          />
        </div>
        <button onClick={load} className="w-full py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          Filtrer
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          rowData={transfers}
          columnDefs={columnDefs}
          loading={loading}
          rowSelection="single"
          onRowClicked={(e: any) => setSelected(e.data)}
        />
      </div>
    </div>
  );

  const mainContent = selected ? (
    <TransferDetail transfer={selected} onAction={() => { load(); setSelected(null); }} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-400">
        <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">Sélectionnez un transfert pour voir ses détails</p>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      {showCreate && (
        <CreateTransferModal
          journals={journals}
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </>
  );
};

export default TransfersPage;
