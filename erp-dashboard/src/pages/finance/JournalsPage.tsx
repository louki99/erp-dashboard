import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Save, RefreshCw, Landmark, Building2, XCircle, ArrowLeftRight, Lock, Unlock, History, ChevronRight, BookOpen, Wallet, ExternalLink, ScrollText } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel } from '@/components/layout/ActionPanel';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox } from '@/components/common/AsyncCombobox';
import type { ComboboxOption } from '@/components/common/AsyncCombobox';
import { SageTabs, type TabItem } from '@/components/common/SageTabs';
import { financeApi } from '@/services/api/financeApi';
import type { Journal, JournalClosure, LedgerEntry, IntakeLine, AuditLogEntry } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number | string) => {
  const num = typeof n === 'string' ? parseFloat(n) : n;
  if (Number.isNaN(num)) return '—';
  return num.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';
};
// business_date/opened_at/closed_at come back as full UTC datetimes even
// though business_date is conceptually a plain date (verified live).
const formatDate = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const formatDateTime = (d: string | null | undefined) =>
  d ? new Date(d).toLocaleString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';
const todayBusinessDate = () => new Date().toISOString().slice(0, 10);

type MethodSuffix = 'ESP' | 'CHQ' | 'EFF' | 'VIR' | 'VER';

const METHOD_COLORS: Record<MethodSuffix, string> = {
  ESP: 'bg-green-100 text-green-800',
  CHQ: 'bg-blue-100 text-blue-800',
  EFF: 'bg-amber-100 text-amber-800',
  VIR: 'bg-indigo-100 text-indigo-800',
  VER: 'bg-purple-100 text-purple-800',
};

const MethodBadge = ({ suffix }: { suffix: string }) => (
  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${METHOD_COLORS[suffix as MethodSuffix] ?? 'bg-gray-100 text-gray-700'}`}>
    {suffix}
  </span>
);

const ActiveDot = ({ active }: { active: boolean }) => {
  const { t } = useTranslation();
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`w-2 h-2 rounded-full ${active ? 'bg-emerald-500' : 'bg-gray-300'}`} />
      {active ? t('common.active') : t('common.inactive')}
    </span>
  );
};

// ── Create Journal Form (inline, center panel — no modal) ──────────────────────
type JournalKind = 'user' | 'society';

// Payment methods valid per journal kind (docs §4). A user cash register only
// handles cash/cheque; a company bank/deposit account handles deposits/transfers.
const USER_METHODS: MethodSuffix[] = ['ESP', 'CHQ'];
const SOCIETY_METHODS: MethodSuffix[] = ['VER', 'VIR', 'CHQ'];

const CreateJournalForm = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { t } = useTranslation();
  const [kind, setKind] = useState<JournalKind>('user');
  const [selectedUser, setSelectedUser] = useState<ComboboxOption | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<ComboboxOption | null>(null);
  const [methodSuffix, setMethodSuffix] = useState<MethodSuffix>('ESP');
  const [bankCode, setBankCode] = useState('');
  const [bankName, setBankName] = useState('');
  const [rib, setRib] = useState('');
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const allowedMethods = kind === 'user' ? USER_METHODS : SOCIETY_METHODS;

  // Reset the method to a valid one whenever the journal kind changes.
  useEffect(() => {
    setMethodSuffix(kind === 'user' ? 'ESP' : 'VER');
  }, [kind]);

  // Load localized method labels once — normalize both array and flat-object shapes
  useEffect(() => {
    financeApi.getHelperMethods().then(res => {
      if (!res.success) return;
      const raw = res.data as any;
      if (Array.isArray(raw)) {
        const map: Record<string, string> = {};
        raw.forEach((item: any) => {
          if (item && typeof item === 'object') {
            if (item.code) map[item.code] = item.label ?? item.name ?? item.code;
            else Object.assign(map, item);
          }
        });
        setMethods(map);
      } else if (raw && typeof raw === 'object') {
        setMethods(raw as Record<string, string>);
      }
    }).catch(() => {});
  }, []);

  const searchUsers = useCallback(async (q: string): Promise<ComboboxOption[]> => {
    const res = await financeApi.getHelperUsers({ search: q, limit: 30 });
    return (res.data ?? []).map(u => ({
      id: u.id,
      label: u.name,
      sub: u.code,
    }));
  }, []);

  const searchBranches = useCallback(async (q: string): Promise<ComboboxOption[]> => {
    const res = await financeApi.getHelperBranches({ search: q, limit: 30 });
    return (res.data ?? []).map(b => ({
      id: b.id,
      label: b.name,
      sub: b.code,
    }));
  }, []);

  // Code preview only for the agent cash register (auto-generated server-side,
  // C{userCode}{method}). A bank account's code is caller-chosen (the bankCode field).
  const codePreview = useMemo(() => {
    if (kind === 'user') return selectedUser?.sub ? `C${selectedUser.sub}${methodSuffix}` : null;
    return null;
  }, [kind, selectedUser, methodSuffix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (kind === 'user') {
      if (!selectedUser) { toast.error(t('finance.journals.userIdRequired')); return; }
    } else {
      if (!selectedBranch) { toast.error(t('finance.journals.branchRequired')); return; }
      if (!bankCode.trim()) { toast.error(t('finance.journals.codeRequired')); return; }
    }
    setSaving(true);
    try {
      const payload = kind === 'user'
        ? {
            user_id: Number(selectedUser!.id),
            method_suffix: methodSuffix,
            ...(selectedBranch ? { branch_id: Number(selectedBranch.id) } : {}),
          }
        : {
            type: 'BANK_ACCOUNT' as const,
            code: bankCode.trim(),
            branch_id: Number(selectedBranch!.id),
            method_suffix: methodSuffix,
            ...(bankName.trim() ? { bank_name: bankName.trim() } : {}),
            ...(rib.trim() ? { rib: rib.trim() } : {}),
          };
      await financeApi.createJournal(payload);
      toast.success(t('finance.journals.created'));
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('finance.journals.createError'));
    } finally {
      setSaving(false);
    }
  };

  const kindTabClass = (active: boolean) =>
    `flex-1 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors text-center ${
      active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-300'
    }`;

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-5 py-4 border-b border-gray-100 bg-white/90 backdrop-blur-md sticky top-0 z-10 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center shrink-0">
          <Plus className="w-4.5 h-4.5 text-emerald-600" />
        </div>
        <h2 className="text-base font-bold text-gray-900">{t('finance.journals.new')}</h2>
      </div>
      <div className="p-5 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* Journal type selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">{t('finance.journals.typeLabel')}</label>
            <div className="flex gap-2">
              <button type="button" onClick={() => setKind('user')} className={kindTabClass(kind === 'user')}>
                {t('finance.journals.typeUser')}
              </button>
              <button type="button" onClick={() => setKind('society')} className={kindTabClass(kind === 'society')}>
                {t('finance.journals.typeSociety')}
              </button>
            </div>
          </div>

          {/* User picker — only for a personal cash register */}
          {kind === 'user' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {t('finance.journals.ownerLabel')} <span className="text-red-500">*</span>
              </label>
              <AsyncCombobox
                value={selectedUser}
                onChange={setSelectedUser}
                onSearch={searchUsers}
                placeholder={t('finance.journals.ownerPlaceholder')}
              />
            </div>
          )}

          {/* Branch picker — required for a company account, optional for a user register */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {kind === 'society' ? t('finance.journals.branchLabel') : t('finance.journals.agencyIdLabel')}
              {kind === 'society' && <span className="text-red-500"> *</span>}
            </label>
            <AsyncCombobox
              value={selectedBranch}
              onChange={setSelectedBranch}
              onSearch={searchBranches}
              placeholder={t('finance.journals.branchPlaceholder')}
            />
          </div>

          {/* Method */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('modules.finance.method')} <span className="text-red-500">*</span></label>
            <select
              value={methodSuffix}
              onChange={e => setMethodSuffix(e.target.value as MethodSuffix)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {allowedMethods.map(m => (
                <option key={m} value={m}>
                  {methods[m] ? `${m} — ${methods[m]}` : m}
                </option>
              ))}
            </select>
          </div>

          {/* Company account details */}
          {kind === 'society' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  {t('finance.journals.codeLabel')} <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={bankCode}
                  onChange={e => setBankCode(e.target.value.toUpperCase())}
                  placeholder={t('finance.journals.codePlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.bankNameLabel')}</label>
                <input
                  type="text"
                  value={bankName}
                  onChange={e => setBankName(e.target.value)}
                  placeholder={t('finance.journals.bankNamePlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.ribLabel')}</label>
                <input
                  type="text"
                  value={rib}
                  onChange={e => setRib(e.target.value)}
                  placeholder={t('finance.journals.ribPlaceholder')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>
            </>
          )}

          {/* Code preview */}
          {codePreview && (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 border border-emerald-200 px-3 py-2">
              <span className="text-xs text-emerald-600 font-medium">{t('finance.journals.col.code')} :</span>
              <span className="font-mono text-sm font-bold text-emerald-800 bg-white rounded px-2 py-0.5 border border-emerald-200">
                {codePreview}
              </span>
            </div>
          )}

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

// ── Clôture de caisse (Z de caisse, §16) ────────────────────────────────────────
// Scoped to BRANCH_CAISSE journals only — "chaque caisse d'agence (une par
// agence + moyen de paiement)" per the backend announcement. A discrepancy is
// a recorded fact, never auto-applied to the journal's own balance, and
// there is no reopen endpoint (deliberate, §16) — closing is final for the day.

const ClosureDetailModal = ({ closure, journalCode, onClose, onCorrect }: { closure: JournalClosure; journalCode: string; onClose: () => void; onCorrect?: (closure: JournalClosure) => void }) => {
  const { t } = useTranslation();
  const discrepancy = closure.discrepancy != null ? parseFloat(closure.discrepancy) : null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{t('finance.closures.reportTitle')}</h2>
            <p className="text-xs text-gray-500 font-mono">{journalCode} — {formatDate(closure.business_date)}</p>
          </div>
          <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${closure.status === 'CLOSED' ? 'bg-gray-100 text-gray-600' : 'bg-emerald-100 text-emerald-700'}`}>
            {closure.status === 'CLOSED' ? t('finance.closures.statusClosed') : t('finance.closures.statusOpen')}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 mb-4">
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] text-gray-500 mb-0.5">{t('finance.closures.opening')}</p>
            <p className="text-sm font-bold text-gray-800">{formatMAD(closure.opening_balance)}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] text-gray-500 mb-0.5">{t('finance.closures.theoretical')}</p>
            <p className="text-sm font-bold text-gray-800">{closure.theoretical_closing_balance != null ? formatMAD(closure.theoretical_closing_balance) : '—'}</p>
          </div>
          <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
            <p className="text-[11px] text-gray-500 mb-0.5">{t('finance.closures.counted')}</p>
            <p className="text-sm font-bold text-gray-800">{closure.counted_balance != null ? formatMAD(closure.counted_balance) : '—'}</p>
          </div>
          <div className={`rounded-lg border p-3 ${discrepancy == null ? 'bg-gray-50 border-gray-200' : discrepancy < 0 ? 'bg-red-50 border-red-200' : discrepancy > 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-gray-50 border-gray-200'}`}>
            <p className="text-[11px] text-gray-500 mb-0.5">{t('finance.closures.discrepancy')}</p>
            <p className={`text-sm font-bold ${discrepancy == null ? 'text-gray-800' : discrepancy < 0 ? 'text-red-700' : discrepancy > 0 ? 'text-emerald-700' : 'text-gray-800'}`}>
              {discrepancy == null ? '—' : `${discrepancy > 0 ? '+' : ''}${formatMAD(discrepancy)}`}
            </p>
          </div>
        </div>
        {closure.notes && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 mb-4">
            <p className="text-[11px] text-amber-600 mb-0.5">{t('common.notes')}</p>
            <p className="text-sm text-amber-900">{closure.notes}</p>
          </div>
        )}
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4 text-xs">
          <div className="flex justify-between px-3 py-2"><span className="text-gray-500">{t('finance.closures.openedAt')}</span><span className="font-mono text-gray-800">{formatDateTime(closure.opened_at)}</span></div>
          {closure.closed_at && <div className="flex justify-between px-3 py-2"><span className="text-gray-500">{t('finance.closures.closedAt')}</span><span className="font-mono text-gray-800">{formatDateTime(closure.closed_at)}</span></div>}
        </div>
        {!!closure.correction_count && (
          <div className="rounded-lg bg-orange-50 border border-orange-200 p-3 mb-4 space-y-1.5">
            <p className="text-xs font-semibold text-orange-700 flex items-center gap-1">
              <History className="w-3.5 h-3.5" /> {t('finance.closures.correctionPanelTitle')} ({closure.correction_count})
            </p>
            <div className="flex justify-between text-xs">
              <span className="text-orange-600">{t('finance.closures.originalCounted')}</span>
              <span className="font-mono text-orange-900">{closure.original_counted_balance != null ? formatMAD(closure.original_counted_balance) : '—'}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-orange-600">{t('finance.closures.correctedAt')}</span>
              <span className="font-mono text-orange-900">{formatDateTime(closure.last_corrected_at)}</span>
            </div>
            {closure.last_correction_reason && (
              <div className="text-xs text-orange-800 border-t border-orange-200 pt-1.5 mt-1.5">{closure.last_correction_reason}</div>
            )}
          </div>
        )}
        <div className="flex gap-2">
          {closure.status === 'CLOSED' && onCorrect && (
            <button onClick={() => onCorrect(closure)} className="flex-1 py-2 text-sm font-medium text-orange-700 bg-orange-50 border border-orange-200 rounded-lg hover:bg-orange-100">
              {t('finance.closures.correctAction')}
            </button>
          )}
          <button onClick={onClose} className="flex-1 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
            {t('common.close')}
          </button>
        </div>
      </div>
    </div>
  );
};

const CorrectClosureModal = ({ journal, closure, onClose, onCorrected }: { journal: Journal; closure: JournalClosure; onClose: () => void; onCorrected: () => void }) => {
  const { t } = useTranslation();
  const [countedBalance, setCountedBalance] = useState(closure.counted_balance ?? '');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<JournalClosure | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countedBalance === '') { toast.error(t('finance.closures.countedRequired')); return; }
    if (!reason.trim()) { toast.error(t('finance.closures.reasonRequired')); return; }
    setSaving(true);
    try {
      const res = await financeApi.correctClosure(journal.id, closure.id, {
        counted_balance: parseFloat(countedBalance as string),
        reason: reason.trim(),
      });
      toast.success(t('finance.closures.corrected'));
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('finance.closures.correctError'));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return <ClosureDetailModal closure={result} journalCode={journal.code} onClose={() => { onCorrected(); onClose(); }} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <History className="w-5 h-5 text-orange-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('finance.closures.correctTitle')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{journal.code} — {formatDate(closure.business_date)}</p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 grid grid-cols-2 gap-2 text-center">
          <div>
            <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{t('finance.closures.counted')}</p>
            <p className="text-lg font-bold text-gray-800">{closure.counted_balance != null ? formatMAD(closure.counted_balance) : '—'}</p>
          </div>
          {closure.original_counted_balance != null && (
            <div>
              <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{t('finance.closures.originalCounted')}</p>
              <p className="text-lg font-bold text-gray-500">{formatMAD(closure.original_counted_balance)}</p>
            </div>
          )}
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.closures.countedLabel')} *</label>
            <input type="number" step="0.01" value={countedBalance} onChange={e => setCountedBalance(e.target.value)} placeholder="0.00" autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.closures.reasonLabel')} *</label>
            <textarea value={reason} onChange={e => setReason(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none" />
          </div>
          <div className="flex items-start gap-2 text-[11px] text-orange-700 bg-orange-50 border border-orange-100 rounded-lg px-2.5 py-2">
            <History className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('finance.closures.correctWarning')}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-orange-600 rounded-lg hover:bg-orange-700 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <History className="w-4 h-4" />}
              {saving ? t('common.saving') : t('finance.closures.correctAction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CloseCaisseModal = ({ journal, closure, onClose, onClosed }: { journal: Journal; closure: JournalClosure; onClose: () => void; onClosed: () => void }) => {
  const { t } = useTranslation();
  const [countedBalance, setCountedBalance] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<JournalClosure | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countedBalance === '') { toast.error(t('finance.closures.countedRequired')); return; }
    setSaving(true);
    try {
      const res = await financeApi.closeClosure(journal.id, closure.id, {
        counted_balance: parseFloat(countedBalance),
        ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      setResult(res.data);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('finance.closures.closeError'));
    } finally {
      setSaving(false);
    }
  };

  if (result) {
    return <ClosureDetailModal closure={result} journalCode={journal.code} onClose={() => { onClosed(); onClose(); }} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <Lock className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('finance.closures.closeTitle')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4 font-mono">{journal.code} — {formatDate(closure.business_date)}</p>
        <div className="rounded-lg bg-gray-50 border border-gray-200 p-3 mb-4 text-center">
          <p className="text-[11px] text-gray-500 uppercase tracking-wide mb-1">{t('finance.closures.theoreticalNow')}</p>
          <p className="text-2xl font-bold text-gray-800">{formatMAD(journal.computed_balance)}</p>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.closures.countedLabel')} *</label>
            <input type="number" step="0.01" value={countedBalance} onChange={e => setCountedBalance(e.target.value)} placeholder="0.00" autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.closures.notesOptional')}</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none" />
          </div>
          <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2">
            <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
            {t('finance.closures.closeWarning')}
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.cancel')}
            </button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2">
              {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              {saving ? t('common.saving') : t('finance.closures.closeAction')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const CaisseClosureSection = ({ journal }: { journal: Journal }) => {
  const { t } = useTranslation();
  const [today, setToday] = useState<JournalClosure | null | undefined>(undefined); // undefined = loading, null = none today
  const [history, setHistory] = useState<JournalClosure[]>([]);
  const [loading, setLoading] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [viewClosure, setViewClosure] = useState<JournalClosure | null>(null);
  const [correcting, setCorrecting] = useState<JournalClosure | null>(null);
  const [opening, setOpening] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setToday(undefined);
    try {
      const [todayRes, historyRes] = await Promise.all([
        financeApi.getClosures(journal.id, { business_date: todayBusinessDate() }),
        financeApi.getClosures(journal.id, { per_page: 15 }),
      ]);
      const todayList = Array.isArray(todayRes.data) ? todayRes.data : (todayRes.data?.data ?? []);
      const historyList = Array.isArray(historyRes.data) ? historyRes.data : (historyRes.data?.data ?? []);
      setToday(todayList[0] ?? null);
      setHistory(historyList);
    } catch {
      setToday(null);
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [journal.id]);

  useEffect(() => { load(); }, [load]);

  const handleOpen = async () => {
    setOpening(true);
    try {
      await financeApi.openClosure(journal.id);
      toast.success(t('finance.closures.opened'));
      load();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('finance.closures.openError'));
    } finally {
      setOpening(false);
    }
  };

  return (
    <div className="rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
          <Lock className="w-3.5 h-3.5 text-gray-400" /> {t('finance.closures.sectionTitle')}
        </h3>
        <button onClick={() => setShowHistory(v => !v)} className="text-xs text-gray-500 hover:text-emerald-600 flex items-center gap-1">
          <History className="w-3.5 h-3.5" /> {t('finance.closures.historyToggle')}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-3"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : today ? (
        today.status === 'OPEN' ? (
          <div className="flex items-center justify-between bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-emerald-700 font-semibold">
              <Unlock className="w-3.5 h-3.5" /> {t('finance.closures.statusOpen')} — {formatDate(today.business_date)}
            </div>
            <button onClick={() => setShowClose(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900">
              <Lock className="w-3.5 h-3.5" /> {t('finance.closures.closeAction')}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-between bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5">
            <div className="flex items-center gap-2 text-xs text-gray-600 font-semibold">
              <Lock className="w-3.5 h-3.5" /> {t('finance.closures.statusClosed')} — {formatDate(today.business_date)}
            </div>
            <div className="flex items-center gap-3">
              <button onClick={() => setCorrecting(today)} className="text-xs font-medium text-orange-600 hover:underline">
                {t('finance.closures.correctAction')}
              </button>
              <button onClick={() => setViewClosure(today)} className="text-xs font-medium text-emerald-600 hover:underline">
                {t('finance.closures.viewReport')}
              </button>
            </div>
          </div>
        )
      ) : (
        <div className="flex items-center justify-between bg-gray-50 border border-dashed border-gray-200 rounded-lg px-3 py-2.5">
          <p className="text-xs text-gray-400">{t('finance.closures.noSessionYet')}</p>
          <button onClick={handleOpen} disabled={opening} className="text-xs font-medium text-gray-500 hover:text-emerald-600 disabled:opacity-50">
            {opening ? t('common.saving') : t('finance.closures.openAction')}
          </button>
        </div>
      )}

      {showHistory && (
        <div className="rounded-lg border border-gray-100 divide-y divide-gray-100 max-h-56 overflow-y-auto">
          {history.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-3">{t('common.noData')}</p>
          ) : history.map(c => {
            const disc = c.discrepancy != null ? parseFloat(c.discrepancy) : null;
            return (
              <button key={c.id} onClick={() => setViewClosure(c)} className="w-full flex items-center justify-between px-3 py-2 text-xs hover:bg-gray-50 transition-colors">
                <span className="text-gray-600">{formatDate(c.business_date)}</span>
                <span className={`font-semibold ${c.status === 'OPEN' ? 'text-emerald-600' : 'text-gray-500'}`}>
                  {c.status === 'OPEN' ? t('finance.closures.statusOpen') : t('finance.closures.statusClosed')}
                </span>
                <span className={disc == null ? 'text-gray-300' : disc < 0 ? 'text-red-600 font-semibold' : disc > 0 ? 'text-emerald-600 font-semibold' : 'text-gray-500'}>
                  {disc == null ? '—' : `${disc > 0 ? '+' : ''}${formatMAD(disc)}`}
                </span>
                <ChevronRight className="w-3.5 h-3.5 text-gray-300" />
              </button>
            );
          })}
        </div>
      )}

      {showClose && today?.status === 'OPEN' && (
        <CloseCaisseModal journal={journal} closure={today} onClose={() => setShowClose(false)} onClosed={load} />
      )}
      {viewClosure && (
        <ClosureDetailModal
          closure={viewClosure}
          journalCode={journal.code}
          onClose={() => setViewClosure(null)}
          onCorrect={(c) => { setViewClosure(null); setCorrecting(c); }}
        />
      )}
      {correcting && (
        <CorrectClosureModal journal={journal} closure={correcting} onClose={() => setCorrecting(null)} onCorrected={load} />
      )}
    </div>
  );
};

// Branch-level "Clôturer tout" — lists every currently-OPEN BRANCH_CAISSE
// journal for the branch and closes them together in one call. Best-effort
// on the backend (always 200; closed/skipped/errors in the body), so the
// result is shown inline per-journal rather than as a single toast.
interface BatchRow { journal: Journal; countedBalance: string }
type BatchResult = { closed: JournalClosure[]; skipped: number[]; errors: { journal_id: number; message: string }[] };

const BatchCloseModal = ({ branchId, branchName, onClose, onDone }: { branchId: number; branchName: string; onClose: () => void; onDone: () => void }) => {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<BatchRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<BatchResult | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const journalsRes = await financeApi.getJournals({ branch_id: branchId, type: 'BRANCH_CAISSE' });
        const journals = Array.isArray(journalsRes.data) ? journalsRes.data : journalsRes.data?.data ?? [];
        const statuses = await Promise.all(journals.map(j => financeApi.getClosures(j.id, { business_date: todayBusinessDate() }).catch(() => null)));
        const openJournals = journals.filter((_j, i) => {
          const res = statuses[i];
          if (!res) return false;
          const list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
          return list[0]?.status === 'OPEN';
        });
        if (!cancelled) setRows(openJournals.map(j => ({ journal: j, countedBalance: '' })));
      } catch {
        if (!cancelled) toast.error(t('finance.journals.loadError'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [branchId, t]);

  const setCounted = (journalId: number, value: string) => {
    setRows(prev => prev.map(r => r.journal.id === journalId ? { ...r, countedBalance: value } : r));
  };

  const handleSubmit = async () => {
    if (rows.some(r => r.countedBalance === '')) { toast.error(t('finance.closures.countedRequired')); return; }
    setSaving(true);
    try {
      const res = await financeApi.batchCloseBranch(branchId, rows.map(r => ({ journal_id: r.journal.id, counted_balance: parseFloat(r.countedBalance) })));
      setResult(res);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg ?? t('finance.closures.batchCloseError'));
    } finally {
      setSaving(false);
    }
  };

  const journalCode = (journalId: number) => rows.find(r => r.journal.id === journalId)?.journal.code ?? `#${journalId}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
        <div className="flex items-center gap-2 mb-1">
          <Building2 className="w-5 h-5 text-gray-600" />
          <h2 className="text-lg font-semibold text-gray-900">{t('finance.closures.batchCloseTitle')}</h2>
        </div>
        <p className="text-xs text-gray-500 mb-4">{branchName}</p>

        {result ? (
          <div className="space-y-3 mb-4">
            {result.closed.length > 0 && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <p className="text-xs font-semibold text-emerald-700 mb-1.5">{t('finance.closures.resultClosedCount', { count: result.closed.length })}</p>
                {result.closed.map(c => (
                  <div key={c.id} className="flex justify-between text-xs py-0.5">
                    <span className="font-mono text-emerald-800">{journalCode(c.journal_id)}</span>
                    <span className="text-emerald-700">{c.discrepancy != null ? `${parseFloat(c.discrepancy) > 0 ? '+' : ''}${formatMAD(c.discrepancy)}` : '—'}</span>
                  </div>
                ))}
              </div>
            )}
            {result.skipped.length > 0 && (
              <div className="rounded-lg bg-gray-50 border border-gray-200 p-3">
                <p className="text-xs font-semibold text-gray-600 mb-1.5">{t('finance.closures.resultSkippedCount', { count: result.skipped.length })}</p>
                {result.skipped.map(id => <div key={id} className="text-xs font-mono text-gray-500 py-0.5">{journalCode(id)}</div>)}
              </div>
            )}
            {result.errors.length > 0 && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <p className="text-xs font-semibold text-red-700 mb-1.5">{t('finance.closures.resultErrorCount', { count: result.errors.length })}</p>
                {result.errors.map(e => (
                  <div key={e.journal_id} className="text-xs text-red-700 py-0.5">
                    <span className="font-mono">{journalCode(e.journal_id)}</span> — {e.message}
                  </div>
                ))}
              </div>
            )}
            <button onClick={() => { onDone(); onClose(); }} className="w-full py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700">
              {t('common.close')}
            </button>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-8"><RefreshCw className="w-5 h-5 animate-spin text-gray-400" /></div>
        ) : rows.length === 0 ? (
          <div className="space-y-4">
            <p className="text-sm text-gray-400 text-center py-6">{t('finance.closures.batchCloseNoOpen')}</p>
            <button onClick={onClose} className="w-full py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
              {t('common.close')}
            </button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-gray-200 divide-y divide-gray-100 mb-4 max-h-72 overflow-y-auto">
              {rows.map(r => (
                <div key={r.journal.id} className="flex items-center gap-2 px-3 py-2">
                  <MethodBadge suffix={r.journal.method_suffix} />
                  <span className="font-mono text-xs text-gray-700 flex-1 truncate">{r.journal.code}</span>
                  <span className="text-[11px] text-gray-400">{formatMAD(r.journal.computed_balance)}</span>
                  <input
                    type="number" step="0.01" placeholder="0.00" value={r.countedBalance}
                    onChange={e => setCounted(r.journal.id, e.target.value)}
                    className="w-24 border border-gray-300 rounded-lg px-2 py-1 text-sm text-right focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              ))}
            </div>
            <div className="flex items-start gap-2 text-[11px] text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2.5 py-2 mb-4">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              {t('finance.closures.closeWarning')}
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                {t('common.cancel')}
              </button>
              <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-gray-800 rounded-lg hover:bg-gray-900 disabled:opacity-50 flex items-center gap-2">
                {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {saving ? t('common.saving') : t('finance.closures.batchCloseSubmit')}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ── Caisse consultation tabs (Grand livre / Encaissements / Activité) ──────────
// §16's suggested screen shape: a caisse's detail view should let the user
// trace both "in" (encaissements landing in this journal) and "out"
// (ledger postings, transfers) — these three tabs cover that.

const CaisseLedgerTab = ({ journal }: { journal: Journal }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getLedger({ journal_code: journal.code, per_page: 30 });
      setEntries(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch {
      toast.error(t('finance.ledger.loadError'));
    } finally {
      setLoading(false);
    }
  }, [journal.code, t]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <button
        onClick={() => navigate(`/finance/ledger?journal=${journal.code}`)}
        className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 hover:underline"
      >
        <ExternalLink className="w-3.5 h-3.5" /> {t('finance.closures.openFullLedger')}
      </button>
      {loading ? (
        <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div>
      ) : entries.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-6">{t('common.noData')}</p>
      ) : (
        <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
          {entries.map(e => {
            const debit = parseFloat(e.debit_amount ?? '0');
            const credit = parseFloat(e.credit_amount ?? '0');
            return (
              <div key={e.id} className="flex items-center gap-2 px-3 py-2 text-xs">
                <span className="text-gray-400 font-mono w-20 shrink-0">{formatDate(e.date_comptable)}</span>
                <span className="text-gray-700 flex-1 truncate">{e.libelle}</span>
                <span className={`font-semibold w-24 text-right ${debit > 0 ? 'text-green-700' : 'text-gray-300'}`}>{debit > 0 ? formatMAD(debit) : '—'}</span>
                <span className={`font-semibold w-24 text-right ${credit > 0 ? 'text-red-600' : 'text-gray-300'}`}>{credit > 0 ? formatMAD(credit) : '—'}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

const CaisseIntakeLinesTab = ({ journal }: { journal: Journal }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [lines, setLines] = useState<IntakeLine[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getIntakeLines({ journal_id: journal.id, per_page: 30 });
      setLines(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch {
      toast.error(t('finance.journals.loadError'));
    } finally {
      setLoading(false);
    }
  }, [journal.id, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div>;
  if (lines.length === 0) return <p className="text-xs text-gray-400 text-center py-6">{t('common.noData')}</p>;

  return (
    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
      {lines.map(l => (
        <div key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs">
          <span className="text-gray-400 font-mono w-32 shrink-0">{formatDateTime(l.created_at)}</span>
          <span className="text-emerald-700 font-semibold w-20 text-right">{formatMAD(l.amount)}</span>
          {l.order_id ? (
            <button onClick={() => navigate(`/gcom/bons-commande?id=${l.order_id}`)} className="text-sage-600 hover:underline font-mono shrink-0">
              #{l.order_id}
            </button>
          ) : <span className="text-gray-300 shrink-0">—</span>}
          <span className="text-gray-500 flex-1 truncate">{l.note ?? '—'}</span>
        </div>
      ))}
    </div>
  );
};

const AUDIT_OP_COLORS: Record<string, string> = {
  CAISSE_OPENED: 'bg-emerald-100 text-emerald-700',
  CAISSE_CLOSED: 'bg-gray-200 text-gray-700',
  CAISSE_CLOSURE_CORRECTED: 'bg-orange-100 text-orange-700',
  TRANSFER_CREATED: 'bg-indigo-100 text-indigo-700',
  TRANSFER_APPROVED: 'bg-emerald-100 text-emerald-700',
  TRANSFER_REJECTED: 'bg-red-100 text-red-700',
  AUTH_CHECK: 'bg-gray-100 text-gray-500',
};

const CaisseAuditLogTab = ({ journal }: { journal: Journal }) => {
  const { t } = useTranslation();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getAuditLogs({ journal_code: journal.code, per_page: 30 });
      setLogs(Array.isArray(res.data) ? res.data : res.data?.data ?? []);
    } catch {
      toast.error(t('finance.journals.loadError'));
    } finally {
      setLoading(false);
    }
  }, [journal.code, t]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="flex justify-center py-6"><RefreshCw className="w-4 h-4 animate-spin text-gray-400" /></div>;
  if (logs.length === 0) return <p className="text-xs text-gray-400 text-center py-6">{t('common.noData')}</p>;

  return (
    <div className="rounded-lg border border-gray-200 divide-y divide-gray-100">
      {logs.map(l => (
        <div key={l.id} className="flex items-center gap-2 px-3 py-2 text-xs">
          <span className="text-gray-400 font-mono w-32 shrink-0">{formatDateTime(l.created_at)}</span>
          <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold shrink-0 ${AUDIT_OP_COLORS[l.operation_type] ?? 'bg-gray-100 text-gray-600'}`}>
            {l.operation_type}
          </span>
          {l.amount != null && <span className="text-gray-700 font-semibold w-20 text-right shrink-0">{formatMAD(l.amount)}</span>}
          {(l.previous_state || l.new_state) && (
            <span className="text-gray-500 truncate">{l.previous_state ?? '—'} → {l.new_state ?? '—'}</span>
          )}
        </div>
      ))}
    </div>
  );
};

// ── Detail Panel ──────────────────────────────────────────────────────────────
interface DetailPanelProps {
  journal: Journal;
  onSaved: () => void;
}

const JournalDetailPanel = ({ journal, onSaved }: DetailPanelProps) => {
  const { t } = useTranslation();
  const isBank = journal.type === 'BANK_ACCOUNT';
  // GCOM branch caisse — no owner, keyed on branch like a bank account, but
  // edits is_active/currency like an agent journal (verified live: same PUT
  // payload accepted, 200), not bank_name/rib.
  const isBranchCaisse = journal.type === 'BRANCH_CAISSE';
  const [isActive, setIsActive] = useState(journal.is_active);
  const [currency, setCurrency] = useState(journal.currency);
  const [bankName, setBankName] = useState(journal.bank_name ?? '');
  const [rib, setRib] = useState(journal.rib ?? '');
  const [saving, setSaving] = useState(false);
  // Tabbed consultation view (§16 suggested shape) — only for BRANCH_CAISSE,
  // other journal kinds keep the original single-panel layout untouched.
  const [activeTab, setActiveTab] = useState('info');

  useEffect(() => {
    setIsActive(journal.is_active);
    setCurrency(journal.currency);
    setBankName(journal.bank_name ?? '');
    setRib(journal.rib ?? '');
  }, [journal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // BANK_ACCOUNT: only bank_name/rib are editable (backend rejects the rest with
      // 422 FINANCE_NOT_A_BANK_ACCOUNT); agent cash journals edit is_active/currency.
      await financeApi.updateJournal(
        journal.id,
        isBank ? { bank_name: bankName, rib } : { is_active: isActive, currency },
      );
      toast.success(t('common.success'));
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  const infoTab = (
    <div className="h-full overflow-y-auto p-5 space-y-5">
      <div className="grid grid-cols-1 gap-3">
        <div className="rounded-xl bg-gray-50 border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase font-semibold tracking-wide mb-1">{t('modules.finance.computedBalance')}</p>
          <p className="text-2xl font-bold text-gray-800">{formatMAD(journal.computed_balance)}</p>
        </div>
        <div className="rounded-xl bg-amber-50 border border-amber-200 p-4">
          <p className="text-xs text-amber-600 uppercase font-semibold tracking-wide mb-1">{t('modules.finance.transitBalance')}</p>
          <p className="text-2xl font-bold text-amber-700">{formatMAD(journal.transit_balance)}</p>
        </div>
        <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-4">
          <p className="text-xs text-emerald-600 uppercase font-semibold tracking-wide mb-1">{t('modules.finance.availableBalance')}</p>
          <p className="text-2xl font-bold text-emerald-700">{formatMAD(journal.available_balance)}</p>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('finance.journals.col.code')}</p>
            <p className="font-mono text-sm font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1 inline-block">{journal.code}</p>
          </div>
          {isBank && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-100 text-purple-800">
              <Landmark className="w-3 h-3" /> {t('finance.journals.typeSocietyShort')}
            </span>
          )}
          {isBranchCaisse && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-teal-100 text-teal-800">
              <Building2 className="w-3 h-3" /> {t('finance.journals.typeBranchCaisseShort')}
            </span>
          )}
        </div>
        {isBank ? (
          <>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('finance.journals.branchLabel')}</p>
              <p className="text-sm text-gray-800">{journal.branch?.name ?? '—'}{journal.branch?.code ? ` (${journal.branch.code})` : ''}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 mb-0.5">{t('finance.journals.bankNameLabel')}</p>
              <p className="text-sm text-gray-800">{journal.bank_name || '—'}</p>
            </div>
          </>
        ) : isBranchCaisse ? (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('finance.journals.branchLabel')}</p>
            <p className="text-sm text-gray-800">{journal.branch?.name ?? '—'}{journal.branch?.code ? ` (${journal.branch.code})` : ''}</p>
          </div>
        ) : (
          <div>
            <p className="text-xs text-gray-500 mb-0.5">{t('modules.finance.owner')}</p>
            <p className="text-sm text-gray-800">{journal.user?.name ?? '—'}</p>
          </div>
        )}
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('modules.finance.method')}</p>
          <MethodBadge suffix={journal.method_suffix} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{t('common.edit')}</h3>
        {isBank ? (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.bankNameLabel')}</label>
              <input
                type="text"
                value={bankName}
                onChange={e => setBankName(e.target.value)}
                placeholder={t('finance.journals.bankNamePlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.ribLabel')}</label>
              <input
                type="text"
                value={rib}
                onChange={e => setRib(e.target.value)}
                placeholder={t('finance.journals.ribPlaceholder')}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-700">{t('finance.journals.activeLabel')}</span>
              <button
                onClick={() => setIsActive(v => !v)}
                className={`relative inline-flex w-11 h-6 rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-300'}`}
              >
                <span className={`inline-block w-4 h-4 mt-1 rounded-full bg-white shadow transition-transform ${isActive ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.currencyLabel')}</label>
              <input
                type="text"
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                placeholder="MAD"
              />
            </div>
          </>
        )}
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700 disabled:opacity-50"
        >
          {saving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? t('common.saving') : t('common.save')}
        </button>
      </div>
    </div>
  );

  // Informations/Grand livre/Encaissements/Activité apply to every journal
  // type — ledger, intake lines and audit logs are all keyed by journal,
  // not GCOM-specific. Only "Clôture de caisse" (Z de caisse) is genuinely
  // BRANCH_CAISSE-only, so it's the sole conditional tab.
  const tabs: TabItem[] = [
    { id: 'info', label: t('finance.journals.tabInfo'), icon: Landmark },
    ...(isBranchCaisse ? [{ id: 'closures', label: t('finance.closures.sectionTitle'), icon: Lock }] : []),
    { id: 'ledger', label: t('modules.finance.ledger'), icon: BookOpen },
    { id: 'intake', label: t('finance.closures.tabIntake'), icon: Wallet },
    { id: 'activity', label: t('finance.closures.tabActivity'), icon: ScrollText },
  ];

  return (
    <div className="h-full flex flex-col">
      <SageTabs tabs={tabs} activeTabId={activeTab} onTabChange={setActiveTab} />
      <div className="flex-1 overflow-y-auto">
        {activeTab === 'info' && infoTab}
        {activeTab === 'closures' && isBranchCaisse && <div className="p-5"><CaisseClosureSection journal={journal} /></div>}
        {activeTab === 'ledger' && <div className="p-5"><CaisseLedgerTab journal={journal} /></div>}
        {activeTab === 'intake' && <div className="p-5"><CaisseIntakeLinesTab journal={journal} /></div>}
        {activeTab === 'activity' && <div className="p-5"><CaisseAuditLogTab journal={journal} /></div>}
      </div>
    </div>
  );
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const JournalsPage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Journal | null>(null);
  // Center panel drives create/detail inline (no modal): 'create' shows the form,
  // otherwise the selected journal's detail, or an empty prompt.
  const [creating, setCreating] = useState(false);
  // Deep-link support (?type=BRANCH_CAISSE) — the GCOM workspace links straight
  // into this filtered view instead of duplicating a per-branch caisse screen.
  const initialType = searchParams.get('type');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'AGENT_CASH' | 'BANK_ACCOUNT' | 'BRANCH_CAISSE'>(
    initialType === 'BRANCH_CAISSE' || initialType === 'BANK_ACCOUNT' || initialType === 'AGENT_CASH' ? initialType : 'ALL',
  );
  const [batchCloseOpen, setBatchCloseOpen] = useState(false);
  // Bumped after a batch close so the currently-selected journal's detail
  // panel (and its CaisseClosureSection) remounts and re-fetches — a batch
  // close can close journals other than the one currently shown.
  const [detailKey, setDetailKey] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getJournals(
        typeFilter === 'BANK_ACCOUNT' || typeFilter === 'BRANCH_CAISSE' ? { type: typeFilter } : undefined,
      );
      let list = Array.isArray(res.data) ? res.data : res.data?.data ?? [];
      // AGENT_CASH filtered client-side (no dedicated server value) — everything
      // that's neither a bank account nor a GCOM branch caisse.
      if (typeFilter === 'AGENT_CASH') list = list.filter((j) => j.type !== 'BANK_ACCOUNT' && j.type !== 'BRANCH_CAISSE');
      setJournals(list);
    } catch {
      toast.error(t('finance.journals.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t, typeFilter]);

  useEffect(() => { load(); }, [load]);

  const columnDefs = [
    {
      headerName: t('finance.journals.col.code'),
      field: 'code',
      cellRenderer: (p: any) => (
        <span className="font-mono text-xs bg-gray-100 text-gray-800 rounded px-1.5 py-0.5">{p.value}</span>
      ),
    },
    {
      headerName: t('finance.journals.col.method'),
      field: 'method_suffix',
      cellRenderer: (p: any) => <MethodBadge suffix={p.value} />,
    },
    {
      headerName: t('finance.journals.col.owner'),
      field: 'user.name',
      valueGetter: (p: any) => {
        const j = p.data as Journal | undefined;
        if (!j) return '';
        if (j.type === 'BANK_ACCOUNT') return j.bank_name || j.branch?.name || t('finance.journals.typeSocietyShort');
        if (j.type === 'BRANCH_CAISSE') return j.branch?.name ? `${j.branch.name}${j.branch.code ? ` (${j.branch.code})` : ''}` : t('finance.journals.typeBranchCaisseShort');
        return j.user?.name ?? '—';
      },
    },
    {
      headerName: t('finance.journals.col.computed'),
      field: 'computed_balance',
      cellRenderer: (p: any) => <span className="text-xs">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: t('finance.journals.col.transit'),
      field: 'transit_balance',
      cellRenderer: (p: any) => <span className="text-xs text-amber-600">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: t('finance.journals.col.available'),
      field: 'available_balance',
      cellRenderer: (p: any) => <span className="text-xs text-emerald-700 font-semibold">{formatMAD(p.value ?? 0)}</span>,
    },
    {
      headerName: t('finance.journals.col.status'),
      field: 'is_active',
      cellRenderer: (p: any) => <ActiveDot active={!!p.value} />,
    },
  ];

  const leftContent = (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 flex items-center justify-between">
        <span className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Landmark className="w-4 h-4 text-emerald-600" />
          {t('modules.finance.journals')}
        </span>
        <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title={t('common.refresh')}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>
      <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-1">
        {([
          { key: 'ALL', label: t('common.all') },
          { key: 'AGENT_CASH', label: t('finance.journals.filterCash') },
          { key: 'BRANCH_CAISSE', label: t('finance.journals.filterBranchCaisse') },
          { key: 'BANK_ACCOUNT', label: t('finance.journals.filterBank') },
        ] as { key: 'ALL' | 'AGENT_CASH' | 'BANK_ACCOUNT' | 'BRANCH_CAISSE'; label: string }[]).map(opt => (
          <button
            key={opt.key}
            onClick={() => { setTypeFilter(opt.key); setSelected(null); }}
            className={`px-2.5 py-1 text-xs font-semibold rounded-full border transition-colors ${
              typeFilter === opt.key ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-500 border-gray-200 hover:border-emerald-300'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          rowData={journals}
          columnDefs={columnDefs}
          loading={loading}
          rowSelection="single"
          onRowClicked={(e: any) => { setSelected(e.data); setCreating(false); }}
        />
      </div>
    </div>
  );

  const mainContent = creating ? (
    <CreateJournalForm
      onClose={() => setCreating(false)}
      onCreated={() => { setCreating(false); load(); }}
    />
  ) : selected ? (
    <JournalDetailPanel key={`${selected.id}-${detailKey}`} journal={selected} onSaved={load} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('finance.journals.selectHint')}</p>
      </div>
    </div>
  );

  const rightContent = (
    <ActionPanel
      groups={[
        {
          items: [
            {
              icon: Plus,
              label: t('finance.journals.new'),
              variant: 'primary',
              onClick: () => { setCreating(true); setSelected(null); },
            },
            { icon: RefreshCw, label: t('common.refresh'), variant: 'sage', onClick: load },
          ],
        },
        ...(selected && !creating ? [{
          items: [
            {
              icon: ArrowLeftRight,
              label: t('finance.journals.transferAction'),
              variant: 'sage' as const,
              onClick: () => navigate(`/finance/transfers?source=${selected.id}`),
            },
            ...(selected.type === 'BRANCH_CAISSE' ? [{
              icon: Building2,
              label: t('finance.closures.batchCloseAction'),
              variant: 'sage' as const,
              onClick: () => setBatchCloseOpen(true),
            }] : []),
            {
              icon: XCircle,
              label: t('common.close'),
              onClick: () => setSelected(null),
            },
          ],
        }] : []),
      ]}
    />
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} rightContent={rightContent} />
      {batchCloseOpen && selected?.branch?.id && (
        <BatchCloseModal
          branchId={selected.branch.id}
          branchName={selected.branch.name ?? selected.branch.code ?? ''}
          onClose={() => setBatchCloseOpen(false)}
          onDone={() => { load(); setDetailKey(k => k + 1); }}
        />
      )}
    </>
  );
};

export default JournalsPage;
