import { useState, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronRight, Languages, RefreshCw, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { translationsApi, type TranslationEntity, type TranslationRow } from '@/services/api/translationsApi';

// ── Helpers ───────────────────────────────────────────────────────────────────

const LOCALE_LABELS: Record<string, { label: string; flag: string; dir: 'ltr' | 'rtl' }> = {
    ar: { label: 'العربية', flag: '🇸🇦', dir: 'rtl' },
    en: { label: 'English', flag: '🇬🇧', dir: 'ltr' },
    fr: { label: 'Français', flag: '🇫🇷', dir: 'ltr' },
};

const ProgressBar = ({ value, total }: { value: number; total: number }) => {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    const color = pct === 100 ? 'bg-emerald-500' : pct > 50 ? 'bg-amber-400' : 'bg-red-400';
    return (
        <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
            </div>
            <span className="text-[10px] text-gray-500 tabular-nums shrink-0">{value}/{total}</span>
        </div>
    );
};

// ── Entity Sidebar ────────────────────────────────────────────────────────────

const EntitySidebar = ({
    entities,
    loading,
    selected,
    onSelect,
    onRefresh,
}: {
    entities: TranslationEntity[];
    loading: boolean;
    selected: string | null;
    onSelect: (e: string) => void;
    onRefresh: () => void;
}) => {
    const { t } = useTranslation();

    return (
        <div className="h-full flex flex-col bg-white">
            <div className="px-3 pt-4 pb-3 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                        <Languages className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h2 className="text-sm font-bold text-gray-900 leading-tight">{t('translations.title')}</h2>
                        <p className="text-[10px] text-gray-400">{entities.length} {t('translations.entities').toLowerCase()}</p>
                    </div>
                    <button
                        onClick={onRefresh}
                        disabled={loading}
                        className="p-1 text-gray-400 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
                        title={t('common.refresh')}
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto divide-y divide-gray-50">
                {(entities ?? []).map(entity => {
                    const isActive = selected === entity.entity;
                    const pct = entity.rows_count > 0 ? Math.round((entity.translated_rows_count / entity.rows_count) * 100) : 0;
                    return (
                        <button
                            key={entity.entity}
                            onClick={() => onSelect(entity.entity)}
                            className={`w-full text-left px-3 py-2.5 hover:bg-gray-50 transition-colors border-l-2 ${
                                isActive ? 'bg-violet-50 border-l-violet-600' : 'border-l-transparent'
                            }`}
                        >
                            <div className="flex items-center justify-between gap-2 mb-1">
                                <span className={`text-xs font-medium truncate ${isActive ? 'text-violet-700' : 'text-gray-800'}`}>
                                    {entity.entity}
                                </span>
                                {pct === 100 && <Check className="w-3 h-3 text-emerald-500 shrink-0" />}
                                {isActive && pct < 100 && <ChevronRight className="w-3 h-3 text-violet-400 shrink-0" />}
                            </div>
                            <ProgressBar value={entity.translated_rows_count} total={entity.rows_count} />
                            <p className="text-[9px] text-gray-400 mt-0.5">
                                {entity.translatable_fields.join(' · ')}
                            </p>
                        </button>
                    );
                })}
            </nav>
        </div>
    );
};

// ── Translation Row Editor ────────────────────────────────────────────────────

interface RowEditorProps {
    row: TranslationRow;
    entity: string;
    locales: string[];
    fields: string[];
    onSaved: () => void;
}

const RowEditor = ({ row, entity, locales, fields, onSaved }: RowEditorProps) => {
    const { t } = useTranslation();
    const [draft, setDraft] = useState<Record<string, Record<string, string>>>(() => {
        const d: Record<string, Record<string, string>> = {};
        locales.forEach(loc => {
            d[loc] = {};
            fields.forEach(field => {
                d[loc][field] = row.translations?.[loc]?.[field] ?? '';
            });
        });
        return d;
    });
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    const handleChange = (locale: string, field: string, value: string) => {
        setDraft(prev => ({ ...prev, [locale]: { ...prev[locale], [field]: value } }));
        setDirty(true);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await translationsApi.updateRow(entity, row.id, draft);
            toast.success(t('translations.saveRow') + ' ✓');
            setDirty(false);
            onSaved();
        } catch (e: any) {
            toast.error(e?.response?.data?.message || t('errors.generic'));
        } finally {
            setSaving(false);
        }
    };

    const baseLabel = fields.map(f => row.base[f]).filter(Boolean).join(' — ') || `#${row.id}`;

    return (
        <div className={`border rounded-xl overflow-hidden transition-all ${dirty ? 'border-violet-200 shadow-sm' : 'border-gray-100'}`}>
            {/* Base value header */}
            <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 min-w-0">
                    {row.code && (
                        <span className="text-[10px] font-mono text-gray-400 shrink-0">{row.code}</span>
                    )}
                    <span className="text-sm font-semibold text-gray-800 truncate">{baseLabel}</span>
                </div>
                {dirty && (
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold text-white bg-violet-600 rounded-lg hover:bg-violet-700 disabled:opacity-50 shrink-0"
                    >
                        {saving ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                        {t('translations.saveRow')}
                    </button>
                )}
            </div>

            {/* Locale input grid */}
            <div className="divide-y divide-gray-50">
                {locales.map(locale => {
                    const meta = LOCALE_LABELS[locale] ?? { label: locale, flag: '🌐', dir: 'ltr' };
                    return (
                        <div key={locale} className="flex items-start gap-3 px-4 py-2.5">
                            {/* Locale badge */}
                            <div className="flex items-center gap-1.5 pt-1.5 shrink-0 w-20">
                                <span className="text-sm">{meta.flag}</span>
                                <span className="text-xs font-medium text-gray-500">{meta.label}</span>
                            </div>

                            {/* Field inputs */}
                            <div className="flex-1 flex flex-col gap-1.5">
                                {fields.map(field => {
                                    const val = draft[locale]?.[field] ?? '';
                                    const hasValue = val.trim().length > 0;
                                    return (
                                        <div key={field} className="relative flex items-center gap-1.5">
                                            {fields.length > 1 && (
                                                <span className="text-[9px] text-gray-400 w-12 shrink-0">{field}</span>
                                            )}
                                            <input
                                                type="text"
                                                value={val}
                                                dir={meta.dir}
                                                onChange={e => handleChange(locale, field, e.target.value)}
                                                placeholder={row.base[field] ?? '—'}
                                                className={`flex-1 text-sm border rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 transition-all ${
                                                    hasValue
                                                        ? 'border-emerald-200 bg-emerald-50/30 focus:ring-emerald-400/30'
                                                        : 'border-gray-200 bg-white focus:ring-violet-400/30'
                                                }`}
                                            />
                                            {hasValue && (
                                                <button
                                                    onClick={() => handleChange(locale, field, '')}
                                                    className="p-1 text-gray-300 hover:text-red-400 shrink-0"
                                                    title={t('translations.clearTranslation')}
                                                >
                                                    <X className="w-3 h-3" />
                                                </button>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// ── Main Page ─────────────────────────────────────────────────────────────────

export function TranslationsPage() {
    const { t } = useTranslation();
    const [entities, setEntities] = useState<TranslationEntity[]>([]);
    const [supportedLocales, setSupportedLocales] = useState<string[]>(['ar', 'en']);
    const [loadingEntities, setLoadingEntities] = useState(true);
    const [selectedEntity, setSelectedEntity] = useState<string | null>(null);
    const [rows, setRows] = useState<TranslationRow[]>([]);
    const [loadingRows, setLoadingRows] = useState(false);
    const [search, setSearch] = useState('');
    const [page, setPage] = useState(1);
    const [lastPage, setLastPage] = useState(1);
    const [total, setTotal] = useState(0);

    const PER_PAGE = 20;

    const fetchEntities = useCallback(async () => {
        setLoadingEntities(true);
        try {
            const res = await translationsApi.getEntities();
            if (res.success) {
                const nested = (res as any).data;
                const entityList = res.entities ?? nested?.entities ?? (Array.isArray(nested) ? nested : []);
                setEntities(Array.isArray(entityList) ? entityList : []);
                const locales = res.supported_locales ?? nested?.supported_locales;
                if (locales?.length) {
                    setSupportedLocales(locales.filter((l: string) => l !== 'fr'));
                }
            }
        } catch {
            toast.error(t('errors.generic'));
        } finally {
            setLoadingEntities(false);
        }
    }, [t]);

    const fetchRows = useCallback(async (entity: string, p = 1, q = '') => {
        setLoadingRows(true);
        try {
            const res = await translationsApi.getRows(entity, { per_page: PER_PAGE, page: p, search: q || undefined });
            if (res.success) {
                const nested = (res as any).data;
                const rowList = Array.isArray(res.data) ? res.data
                    : Array.isArray(nested?.data) ? nested.data
                    : Array.isArray(nested) ? nested
                    : [];
                const meta = res.meta ?? nested?.meta;
                setRows(rowList);
                setLastPage(meta?.last_page ?? 1);
                setTotal(meta?.total ?? rowList.length);
            }
        } catch {
            toast.error(t('errors.generic'));
        } finally {
            setLoadingRows(false);
        }
    }, [t]);

    useEffect(() => { fetchEntities(); }, [fetchEntities]);

    const handleSelectEntity = (entity: string) => {
        setSelectedEntity(entity);
        setSearch('');
        setPage(1);
        fetchRows(entity, 1, '');
    };

    const handleSearch = (q: string) => {
        setSearch(q);
        setPage(1);
        if (selectedEntity) fetchRows(selectedEntity, 1, q);
    };

    const handlePageChange = (p: number) => {
        setPage(p);
        if (selectedEntity) fetchRows(selectedEntity, p, search);
    };

    const activeEntity = (entities ?? []).find(e => e.entity === selectedEntity);
    const fields = activeEntity?.translatable_fields ?? [];

    const sidebar = (
        <EntitySidebar
            entities={entities}
            loading={loadingEntities}
            selected={selectedEntity}
            onSelect={handleSelectEntity}
            onRefresh={fetchEntities}
        />
    );

    const main = (
        <div className="h-full flex flex-col overflow-hidden bg-gray-50">
            {/* Header */}
            <div className="shrink-0 bg-white border-b border-gray-200 px-6 py-3">
                {selectedEntity ? (
                    <div className="flex items-center justify-between gap-4">
                        <div>
                            <h1 className="text-sm font-bold text-gray-900">{selectedEntity}</h1>
                            <p className="text-[10px] text-gray-400">
                                {activeEntity
                                    ? `${activeEntity.translated_rows_count} / ${activeEntity.rows_count} ${t('translations.translated').toLowerCase()} · ${fields.join(', ')}`
                                    : ''}
                            </p>
                        </div>
                        <div className="flex items-center gap-2">
                            <input
                                type="text"
                                value={search}
                                onChange={e => handleSearch(e.target.value)}
                                placeholder={t('common.search') + '…'}
                                className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 w-48 focus:outline-none focus:ring-2 focus:ring-violet-400/40"
                            />
                            {search && (
                                <button onClick={() => handleSearch('')} className="p-1.5 text-gray-400 hover:text-gray-700">
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            )}
                        </div>
                    </div>
                ) : (
                    <div>
                        <h1 className="text-sm font-bold text-gray-900">{t('translations.title')}</h1>
                        <p className="text-[10px] text-gray-400">{t('translations.subtitle')}</p>
                    </div>
                )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
                {!selectedEntity ? (
                    <div className="h-full flex flex-col items-center justify-center gap-3 text-center">
                        <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center">
                            <Languages className="w-6 h-6 text-violet-500" />
                        </div>
                        <p className="text-sm font-medium text-gray-500">{t('translations.selectEntity')}</p>
                        <p className="text-xs text-gray-400">{entities.length} {t('translations.entities').toLowerCase()} {t('translations.translated').toLowerCase()}s disponibles</p>
                    </div>
                ) : loadingRows ? (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" /> {t('common.loading')}
                    </div>
                ) : rows.length === 0 ? (
                    <div className="flex items-center justify-center h-32 text-sm text-gray-400">
                        {t('common.noResults')}
                    </div>
                ) : (
                    <div className="space-y-2 max-w-3xl">
                        {rows.map(row => (
                            <RowEditor
                                key={row.id}
                                row={row}
                                entity={selectedEntity}
                                locales={supportedLocales}
                                fields={fields}
                                onSaved={() => fetchEntities()}
                            />
                        ))}

                        {/* Pagination */}
                        {lastPage > 1 && (
                            <div className="flex items-center justify-between pt-2">
                                <span className="text-xs text-gray-400">{total} entrées</span>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => handlePageChange(page - 1)}
                                        disabled={page <= 1}
                                        className="px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        {t('common.previous')}
                                    </button>
                                    <span className="px-3 py-1.5 text-xs font-medium text-gray-700">
                                        {page} / {lastPage}
                                    </span>
                                    <button
                                        onClick={() => handlePageChange(page + 1)}
                                        disabled={page >= lastPage}
                                        className="px-2.5 py-1.5 text-xs text-gray-600 border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40"
                                    >
                                        {t('common.next')}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );

    return <MasterLayout leftContent={sidebar} mainContent={main} />;
}
