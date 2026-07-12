import { useState, useEffect, useCallback, useMemo } from 'react';
import { Plus, Save, RefreshCw, Landmark } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { DataGrid } from '@/components/common/DataGrid';
import { AsyncCombobox } from '@/components/common/AsyncCombobox';
import type { ComboboxOption } from '@/components/common/AsyncCombobox';
import { financeApi } from '@/services/api/financeApi';
import type { Journal } from '@/types/finance.types';

// ── Helpers ────────────────────────────────────────────────────────────────────
const formatMAD = (n: number) =>
  n.toLocaleString('fr-MA', { minimumFractionDigits: 2 }) + ' MAD';

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

// ── Create Journal Modal ───────────────────────────────────────────────────────
const CreateJournalModal = ({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) => {
  const { t } = useTranslation();
  const [selectedUser, setSelectedUser] = useState<ComboboxOption | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<ComboboxOption | null>(null);
  const [methodSuffix, setMethodSuffix] = useState<MethodSuffix>('ESP');
  const [methods, setMethods] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

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

  // Preview of auto-generated journal code
  const codePreview = useMemo(() => {
    if (!selectedUser?.sub) return null;
    return `C${selectedUser.sub}${methodSuffix}`;
  }, [selectedUser, methodSuffix]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) { toast.error(t('finance.journals.userIdRequired')); return; }
    setSaving(true);
    try {
      await financeApi.createJournal({
        user_id: Number(selectedUser.id),
        method_suffix: methodSuffix,
        ...(selectedBranch ? { branch_id: Number(selectedBranch.id) } : {}),
      });
      toast.success(t('finance.journals.created'));
      onCreated();
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('finance.journals.createError'));
    } finally {
      setSaving(false);
    }
  };

  const methodKeys = Object.keys(methods).length > 0
    ? (Object.keys(methods) as MethodSuffix[])
    : (['ESP', 'CHQ', 'EFF', 'VIR', 'VER'] as MethodSuffix[]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">{t('finance.journals.new')}</h2>
        <form onSubmit={handleSubmit} className="space-y-4">

          {/* User picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {t('finance.journals.userIdLabel')} <span className="text-red-500">*</span>
            </label>
            <AsyncCombobox
              value={selectedUser}
              onChange={setSelectedUser}
              onSearch={searchUsers}
              placeholder={t('finance.journals.userIdPlaceholder')}
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
              {methodKeys.map(m => (
                <option key={m} value={m}>
                  {methods[m] ? `${m} — ${methods[m]}` : m}
                </option>
              ))}
            </select>
          </div>

          {/* Branch picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{t('finance.journals.agencyIdLabel')}</label>
            <AsyncCombobox
              value={selectedBranch}
              onChange={setSelectedBranch}
              onSearch={searchBranches}
              placeholder={t('finance.journals.agencyIdPlaceholder')}
            />
          </div>

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

// ── Detail Panel ──────────────────────────────────────────────────────────────
interface DetailPanelProps {
  journal: Journal;
  onSaved: () => void;
}

const JournalDetailPanel = ({ journal, onSaved }: DetailPanelProps) => {
  const { t } = useTranslation();
  const [isActive, setIsActive] = useState(journal.is_active);
  const [currency, setCurrency] = useState(journal.currency);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setIsActive(journal.is_active);
    setCurrency(journal.currency);
  }, [journal]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await financeApi.updateJournal(journal.id, { is_active: isActive, currency });
      toast.success(t('common.success'));
      onSaved();
    } catch (err: any) {
      toast.error(err?.response?.data?.message ?? t('errors.generic'));
    } finally {
      setSaving(false);
    }
  };

  return (
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
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('finance.journals.col.code')}</p>
          <p className="font-mono text-sm font-semibold text-gray-800 bg-gray-100 rounded px-2 py-1 inline-block">{journal.code}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('modules.finance.owner')}</p>
          <p className="text-sm text-gray-800">{journal.user.name}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-0.5">{t('modules.finance.method')}</p>
          <MethodBadge suffix={journal.method_suffix} />
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 p-4 space-y-4">
        <h3 className="text-sm font-semibold text-gray-700">{t('common.edit')}</h3>
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
};

// ── Main Page ─────────────────────────────────────────────────────────────────
export const JournalsPage = () => {
  const { t } = useTranslation();
  const [journals, setJournals] = useState<Journal[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Journal | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await financeApi.getJournals();
      setJournals(Array.isArray(res.data) ? res.data : []);
    } catch {
      toast.error(t('finance.journals.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

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
    { headerName: t('finance.journals.col.owner'), field: 'user.name', valueGetter: (p: any) => p.data?.user?.name },
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
        <div className="flex items-center gap-1">
          <button onClick={load} className="p-1.5 rounded hover:bg-gray-100 text-gray-500" title={t('common.refresh')}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-white bg-emerald-600 rounded-lg hover:bg-emerald-700"
          >
            <Plus className="w-3.5 h-3.5" /> {t('common.new')}
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <DataGrid
          rowData={journals}
          columnDefs={columnDefs}
          loading={loading}
          rowSelection="single"
          onRowClicked={(e: any) => setSelected(e.data)}
        />
      </div>
    </div>
  );

  const mainContent = selected ? (
    <JournalDetailPanel journal={selected} onSaved={load} />
  ) : (
    <div className="h-full flex items-center justify-center">
      <div className="text-center text-gray-400">
        <Landmark className="w-12 h-12 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{t('finance.journals.selectHint')}</p>
      </div>
    </div>
  );

  return (
    <>
      <MasterLayout leftContent={leftContent} mainContent={mainContent} />
      {showCreate && (
        <CreateJournalModal
          onClose={() => setShowCreate(false)}
          onCreated={load}
        />
      )}
    </>
  );
};

export default JournalsPage;
