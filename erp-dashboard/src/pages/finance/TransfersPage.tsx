import { useState, useEffect, useCallback } from 'react';
import { ArrowLeftRight, Plus, RefreshCw, CheckCircle2, XCircle, ChevronRight, Landmark, AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { financeApi } from '@/services/api/financeApi';
import type { Transfer, Journal, LedgerEntry, TransferStatus } from '@/types/finance.types';

const formatMAD = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (isNaN(num)) return '—';
  return num.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};

const STATUS_KEYS: Record<TransferStatus, string> = {
  2: 'finance.transfers.status.requested',
  3: 'finance.transfers.status.accepted',
  4: 'finance.transfers.status.rejected',
  5: 'finance.transfers.status.cancelled',
};
const STATUS_COLORS: Record<TransferStatus, string> = {
  2: 'bg-amber-100 text-amber-700',
  3: 'bg-green-100 text-green-700',
  4: 'bg-red-100 text-red-600',
  5: 'bg-gray-100 text-gray-500',
};

const StatusBadge = ({ status }: { status: TransferStatus }) => {
  const { t } = useTranslation();
  const color = STATUS_COLORS[status] ?? 'bg-gray-100 text-gray-500';
  const label = STATUS_KEYS[status] ? t(STATUS_KEYS[status]) : String(status);
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${color}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
      {label}
    </span>
  );
};

// ── Approve Modal ─────────────────────────────────────────────────────────────
const ApproveModal = ({ transfer, onClose, onDone }: { transfer: Transfer; onClose: () => void; onDone: () => void }) => {
  const { t } = useTranslation();
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
      toast.success(t('finance.transfers.approvedMsg'));
      if (res.entries) setEntries(res.entries);
      else { onDone(); onClose(); }
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('errors.generic'));
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
            <h2 className="text-lg font-semibold text-gray-900">{t('finance.transfers.approvedMsg')}</h2>
          </div>
          <p className="text-sm text-gray-600 mb-3">{t('finance.transfers.ledgerEntriesTitle')} :</p>
          <div className="space-y-2 mb-4">
            {entries.map(e => (
              <div key={e.id} className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs">
                <div className="font-mono text-gray-500">{e.compte_comptable} — {e.journal_code}</div>
                <div className="text-gray-800 mt-1">{e.libelle}</div>
                <div className="flex gap-4 mt-1">
                  {parseFloat(e.debit_amount) > 0 && <span className="text-green-700 font-semibold">{t('common.debit')}: {formatMAD(e.debit_amount)}</span>}
                  {parseFloat(e.credit_amount) > 0 && <span className="text-red-600 font-semibold">{t('common.credit')}: {formatMAD(e.credit_amount)}</span>}
                </div>
              </div>
            ))}
          </div>
          <button onClick={() => { onDone(); onClose(); }} className="w-full py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            {t('common.close')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('finance.transfers.approveTitle')} #{transfer.id}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Bank deposit — show the receipt before approving. The photo is required
              server-side before approval (else 422 TREASURY_VERSEMENT_REQUIRED), so warn
              clearly when it's still missing. Preview uses versement_photo_url (a ready
              URL), never versement_photo_path (raw storage path). */}
          {transfer.transfer_type === 'BANK_DEPOSIT' && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-2">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-800">
                <Landmark className="w-3.5 h-3.5" /> {t('modules.finance.transferType.bankDeposit')}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div><span className="text-gray-500">{t('finance.transfers.detail.depositRef')}: </span><span className="font-medium text-gray-800">{transfer.versement_reference || '—'}</span></div>
                <div><span className="text-gray-500">{t('finance.transfers.detail.depositDate')}: </span><span className="font-medium text-gray-800">{transfer.deposit_date || '—'}</span></div>
              </div>
              {transfer.versement_photo_url ? (
                <a href={transfer.versement_photo_url} target="_blank" rel="noreferrer" className="block">
                  <img src={transfer.versement_photo_url} alt={t('finance.transfers.depositPhotoLabel')} className="w-full max-h-48 object-contain rounded-lg border border-purple-100 bg-white" />
                </a>
              ) : (
                <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-2">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                  {t('finance.transfers.depositPhotoMissing')}
                </div>
              )}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.confirmedAmount')}</label>
            <input type="number" step="0.01" value={confirmedAmount}
              onChange={e => setConfirmedAmount(e.target.value as any)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.commentOptional')}</label>
            <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button
              type="submit"
              disabled={saving || (transfer.transfer_type === 'BANK_DEPOSIT' && !transfer.versement_photo_url)}
              title={transfer.transfer_type === 'BANK_DEPOSIT' && !transfer.versement_photo_url ? t('finance.transfers.depositPhotoMissing') : undefined}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {t('common.approve')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Reject Modal ──────────────────────────────────────────────────────────────
const RejectModal = ({ transfer, onClose, onDone }: { transfer: Transfer; onClose: () => void; onDone: () => void }) => {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) { toast.error(t('finance.transfers.reasonRequired')); return; }
    setSaving(true);
    try {
      await financeApi.rejectTransfer(transfer.id, { reason });
      toast.success(t('finance.transfers.rejectedMsg'));
      onDone();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('finance.transfers.rejectError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('finance.transfers.rejectTitle')} #{transfer.id}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.rejectReasonLabel')} *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={4}
              placeholder={t('finance.transfers.rejectReasonPlaceholder')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              {t('common.reject')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Create Transfer Modal ─────────────────────────────────────────────────────
const CreateTransferModal = ({ journals, onClose, onCreated }: { journals: Journal[]; onClose: () => void; onCreated: () => void }) => {
  const { t } = useTranslation();
  const [sourceJournalId, setSourceJournalId] = useState('');
  const [destJournalId, setDestJournalId] = useState('');
  const [amount, setAmount] = useState('');
  const [versementRef, setVersementRef] = useState('');
  const [versementPhoto, setVersementPhoto] = useState('');
  const [bankName, setBankName] = useState('');
  const [depositDate, setDepositDate] = useState('');
  const [intakeLineId, setIntakeLineId] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const sourceJournal = journals.find(j => j.id === Number(sourceJournalId));
  const destJournal = journals.find(j => j.id === Number(destJournalId));
  const isCHQorEFF = sourceJournal?.method_suffix === 'CHQ' || sourceJournal?.method_suffix === 'EFF';
  // Backend rule (2026-08): the transfer_type is dictated by the DESTINATION journal.
  // A BANK_ACCOUNT destination requires BANK_DEPOSIT + versement_reference + deposit_date;
  // a cash-register destination must be DIRECT.
  const destIsBank = destJournal?.type === 'BANK_ACCOUNT';
  const effectiveTransferType: 'DIRECT' | 'BANK_DEPOSIT' = destIsBank ? 'BANK_DEPOSIT' : 'DIRECT';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceJournalId || !destJournalId) { toast.error(t('finance.transfers.journalsRequired')); return; }
    if (destIsBank) {
      if (!versementRef.trim()) { toast.error(t('finance.transfers.depositRefRequired')); return; }
      if (!depositDate) { toast.error(t('finance.transfers.depositDateRequired')); return; }
    }
    setSaving(true);
    try {
      await financeApi.createTransfer({
        source_journal_id: Number(sourceJournalId),
        dest_journal_id: Number(destJournalId),
        amount: parseFloat(amount || '0'),
        transfer_type: effectiveTransferType,
        ...(destIsBank && versementRef ? { versement_reference: versementRef } : {}),
        ...(destIsBank && versementPhoto ? { versement_photo_path: versementPhoto } : {}),
        ...(destIsBank && bankName ? { bank_name: bankName } : {}),
        ...(destIsBank && depositDate ? { deposit_date: depositDate } : {}),
        ...(isCHQorEFF && intakeLineId ? { intake_line_id: Number(intakeLineId) } : {}),
        ...(note ? { note } : {}),
      });
      toast.success(t('finance.transfers.created'));
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('finance.transfers.createError'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('finance.transfers.new')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.sourceJournalLabel')} *</label>
            <select value={sourceJournalId} onChange={e => setSourceJournalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">{t('common.selectPlaceholder')}</option>
              {journals.map(j => <option key={j.id} value={j.id}>{j.code} ({j.method_suffix})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.destJournalLabel')} *</label>
            <select value={destJournalId} onChange={e => setDestJournalId(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">{t('common.selectPlaceholder')}</option>
              {journals.filter(j => j.id !== Number(sourceJournalId)).map(j => <option key={j.id} value={j.id}>{j.code} ({j.method_suffix}){j.type === 'BANK_ACCOUNT' ? ` 🏦 ${j.bank_name ?? ''}`.trimEnd() : ''}</option>)}
            </select>
          </div>
          {destIsBank && (
            <div className="rounded-lg bg-purple-50 border border-purple-200 p-3 space-y-3">
              <div className="flex items-center gap-2 text-xs font-semibold text-purple-800">
                <Landmark className="w-3.5 h-3.5" />
                {t('modules.finance.transferType.bankDeposit')} — {destJournal?.bank_name || destJournal?.code}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.depositRefLabel')} <span className="text-red-500">*</span></label>
                <input type="text" value={versementRef} onChange={e => setVersementRef(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.depositDateLabel')} <span className="text-red-500">*</span></label>
                <input type="date" value={depositDate} onChange={e => setDepositDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.bankNameLabel')}</label>
                <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} placeholder={destJournal?.bank_name ?? ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.depositPhotoLabel')}</label>
                <input type="text" value={versementPhoto} onChange={e => setVersementPhoto(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                <p className="text-xs text-amber-600 mt-1">{t('finance.transfers.depositPhotoApproveHint')}</p>
              </div>
            </div>
          )}
          {isCHQorEFF && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.settlementLineLabel')}</label>
              <input type="number" value={intakeLineId} onChange={e => setIntakeLineId(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              <p className="text-xs text-gray-400 mt-1">{t('finance.transfers.settlementLineHint')}</p>
            </div>
          )}
          {!isCHQorEFF && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('common.amount')} *</label>
              <input type="number" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} placeholder="0.00"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.transfers.noteOptional')}</label>
            <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              {saving ? t('common.creating') : t('common.create')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────
const TransferDetail = ({ transfer, onAction }: { transfer: Transfer; onAction: () => void }) => {
  const { t } = useTranslation();
  const [showApprove, setShowApprove] = useState(false);
  const [showReject, setShowReject] = useState(false);

  const color = STATUS_COLORS[transfer.status] ?? 'bg-gray-100 text-gray-500';
  const label = STATUS_KEYS[transfer.status] ? t(STATUS_KEYS[transfer.status]) : String(transfer.status);

  return (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs text-gray-500">{t('modules.finance.transfers')}</p>
          <p className="text-2xl font-bold text-gray-900">#{transfer.id}</p>
        </div>
        <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${color}`}>{label}</span>
      </div>

      <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-center">
        <p className="text-xs text-emerald-600 uppercase font-semibold tracking-wide mb-1">{t('common.amount')}</p>
        <p className="text-3xl font-bold text-emerald-800">{formatMAD(transfer.amount)}</p>
        <p className="text-xs text-emerald-600 mt-1">{transfer.currency}</p>
      </div>

      <div className="rounded-xl border border-gray-200 divide-y divide-gray-100">
        {[
          [t('finance.transfers.detail.source'), `${transfer.sourceJournal.code} (${transfer.sourceJournal.method_suffix})`],
          [t('finance.transfers.detail.destination'), `${transfer.destJournal.code} (${transfer.destJournal.method_suffix})`],
          transfer.transfer_type && [t('common.type'), transfer.transfer_type],
          transfer.bank_name && [t('finance.transfers.detail.bank'), transfer.bank_name],
          transfer.deposit_date && [t('finance.transfers.detail.depositDate'), transfer.deposit_date],
          transfer.versement_reference && [t('finance.transfers.detail.depositRef'), transfer.versement_reference],
          [t('finance.transfers.detail.createdAt'), new Date(transfer.created_at).toLocaleString('fr-MA')],
          transfer.createdBy && [t('finance.transfers.detail.by'), transfer.createdBy.name],
        ].filter(Boolean).map(([label, value]) => (
          <div key={String(label)} className="flex justify-between px-4 py-2.5 text-sm">
            <span className="text-gray-500">{label}</span>
            <span className="font-mono font-semibold text-gray-800 text-xs">{value}</span>
          </div>
        ))}
        {transfer.note && (
          <div className="px-4 py-2.5 text-sm">
            <p className="text-gray-500 mb-1">{t('finance.transfers.detail.note')}</p>
            <p className="text-gray-800 bg-gray-50 rounded p-2 text-xs">{transfer.note}</p>
          </div>
        )}
        {transfer.rejection_reason && (
          <div className="px-4 py-2.5 text-sm">
            <p className="text-red-500 mb-1">{t('finance.transfers.detail.rejectReason')}</p>
            <p className="text-red-700 bg-red-50 rounded p-2 text-xs">{transfer.rejection_reason}</p>
          </div>
        )}
      </div>

      {transfer.status === 2 && (
        <div className="flex gap-3">
          <button onClick={() => setShowApprove(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-green-600 rounded-xl hover:bg-green-700">
            <CheckCircle2 className="w-4 h-4" /> {t('common.approve')}
          </button>
          <button onClick={() => setShowReject(true)}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium text-white bg-red-600 rounded-xl hover:bg-red-700">
            <XCircle className="w-4 h-4" /> {t('common.reject')}
          </button>
        </div>
      )}

      {showApprove && <ApproveModal transfer={transfer} onClose={() => setShowApprove(false)} onDone={onAction} />}
      {showReject && <RejectModal transfer={transfer} onClose={() => setShowReject(false)} onDone={onAction} />}
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const TransfersPage = () => {
  const { t } = useTranslation();
  const [transfers, setTransfers] = useState<Transfer[]>([]);
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Transfer | null>(null);
  const [showCreate, setShowCreate] = useState(false);
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
      setTransfers(Array.isArray(tRes.data) ? tRes.data : (tRes.data?.data ?? []));
      setJournals(Array.isArray(jRes.data) ? jRes.data : (jRes.data?.data ?? []));
    } catch {
      toast.error(t('finance.transfers.loadError'));
    } finally {
      setLoading(false);
    }
  }, [statusFilter, fromDate, toDate, t]);

  useEffect(() => { load(); }, []);

  const columnDefs = [
    { headerName: t('finance.transfers.col.ref'), field: 'id', width: 70 },
    {
      headerName: t('finance.transfers.col.srcDest'),
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
      headerName: t('finance.transfers.col.amount'),
      field: 'amount',
      cellRenderer: (p: any) => <span className="text-xs font-semibold">{formatMAD(p.value)}</span>,
    },
    {
      headerName: t('finance.transfers.col.status'),
      field: 'status',
      cellRenderer: (p: any) => <StatusBadge status={p.value} />,
    },
    {
      headerName: t('finance.transfers.col.date'),
      field: 'created_at',
      cellRenderer: (p: any) => <span className="text-xs text-gray-500">{new Date(p.value).toLocaleDateString('fr-MA')}</span>,
    },
  ];

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-emerald-600" />
          {t('modules.finance.transfers')}
        </span>
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            <Plus className="w-3.5 h-3.5" /> {t('common.new')}
          </button>
        </div>
      </div>
      <div className="p-3 border-b border-gray-200 space-y-2">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500">
          <option value="">{t('finance.transfers.allStatuses')}</option>
          <option value="2">{t('modules.finance.status.requested')}</option>
          <option value="3">{t('modules.finance.status.accepted')}</option>
          <option value="4">{t('modules.finance.status.rejected')}</option>
          <option value="5">{t('modules.finance.status.cancelled')}</option>
        </select>
        <div className="flex gap-2">
          <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} title={t('finance.ledger.filterFrom')}
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} title={t('finance.ledger.filterTo')}
            className="flex-1 border border-gray-300 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500" />
        </div>
        <button onClick={load} className="w-full py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
          {t('common.filter')}
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid rowData={transfers} columnDefs={columnDefs} loading={loading}
          rowSelection="single" onRowClicked={(e: any) => setSelected(e.data)} />
      </div>
    </div>
  );

  const mainContent = selected ? (
    <TransferDetail transfer={selected} onAction={() => { load(); setSelected(null); }} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-400">
        <ArrowLeftRight className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('finance.transfers.selectHint')}</p>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      {showCreate && <CreateTransferModal journals={journals} onClose={() => setShowCreate(false)} onCreated={load} />}
    </>
  );
};

export default TransfersPage;
