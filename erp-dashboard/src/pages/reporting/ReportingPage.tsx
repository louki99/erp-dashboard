import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DataGrid } from '@/components/common/DataGrid';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';
import { ReportFilters } from '@/components/reporting/ReportFilters';
import {
    useReportDefinitions,
    useReportPreview,
    useReportExport,
} from '@/hooks/reporting/use-reports';
import type {
    ReportDefinition, ExportFormat, ReportFilter, ReportPreviewResponse,
} from '@/types/reports.types';
import {
    BarChart2, Eye, Download, ArrowLeft, RefreshCw, Search, X,
    List, Settings2, BookOpen, CheckCircle,
} from 'lucide-react';

// ── Helpers ────────────────────────────────────────────────────────────────────

function buildColumnDefs(
    definition: ReportDefinition,
    sample: Record<string, unknown>[],
): Record<string, unknown>[] {
    if (definition.default_columns.length > 0) {
        return definition.default_columns.map((col) => ({
            field:      col.key,
            headerName: col.label,
            width:      col.width,
            cellStyle:  col.align ? { textAlign: col.align } : undefined,
            filter:     true,
            sortable:   true,
        }));
    }
    const keys = Object.keys(sample[0] ?? {});
    return keys.map((key) => ({
        field:      key,
        headerName: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        filter:     true,
        sortable:   true,
    }));
}

function buildFilters(
    schema: ReportDefinition['parameter_schema'],
    values: Record<string, unknown>,
): ReportFilter[] {
    const filters: ReportFilter[] = [];
    for (const field of schema) {
        const val = values[field.key];
        if (val == null || val === '' || val === '__all__') continue;
        const key = field.key.toLowerCase();
        let operator: ReportFilter['operator'] = 'eq';
        if (key.endsWith('_from') || key.endsWith('_start') || key.endsWith('_debut') || key === 'date_from') {
            operator = 'gte';
        } else if (key.endsWith('_to') || key.endsWith('_end') || key.endsWith('_fin') || key === 'date_to') {
            operator = 'lte';
        } else if (field.type === 'text') {
            operator = 'contains';
        }
        filters.push({ column: field.key, operator, value: val as string | number | boolean });
    }
    return filters;
}

// ── Category meta ─────────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { label: string; dot: string }> = {
    clients:     { label: 'Clients',     dot: 'bg-blue-500'    },
    sales:       { label: 'Ventes',      dot: 'bg-emerald-500' },
    visits:      { label: 'Visites',     dot: 'bg-amber-500'   },
    delivery:    { label: 'Livraisons',  dot: 'bg-orange-500'  },
    treasury:    { label: 'Trésorerie',  dot: 'bg-indigo-500'  },
    stock:       { label: 'Stock',       dot: 'bg-teal-500'    },
    hr:          { label: 'RH',          dot: 'bg-purple-500'  },
    price_lists: { label: 'Tarifs',      dot: 'bg-rose-500'    },
    products:    { label: 'Produits',    dot: 'bg-green-500'   },
};

function catMeta(key: string) {
    return CATEGORY_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), dot: 'bg-gray-400' };
}

// ── Empty state ───────────────────────────────────────────────────────────────

const EmptyState: React.FC = () => (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
            <BookOpen className="w-10 h-10 text-gray-200" />
        </div>
        <h3 className="text-base font-semibold text-gray-700">Sélectionnez un rapport</h3>
        <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
            Choisissez un rapport dans le catalogue à gauche pour configurer ses paramètres.
        </p>
    </div>
);

// ── Report detail / filters panel ─────────────────────────────────────────────

interface FiltersProps {
    definition:       ReportDefinition;
    paramValues:      Record<string, unknown>;
    format:           ExportFormat;
    previewing:       boolean;
    exporting:        boolean;
    allRequiredFilled: boolean;
    onParamChange:    (key: string, value: unknown) => void;
    onFormatChange:   (v: ExportFormat) => void;
    onPreview:        () => void;
    onExport:         () => void;
}

const FiltersPanel: React.FC<FiltersProps> = ({
    definition, paramValues, format, previewing, exporting, allRequiredFilled,
    onParamChange, onFormatChange, onPreview, onExport,
}) => {
    const requiredCount = definition.parameter_schema.filter(f => f.required).length;
    const filledCount   = definition.parameter_schema.filter(f => f.required && paramValues[f.key] != null && paramValues[f.key] !== '').length;

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-gray-200 shrink-0">
                <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                        <BarChart2 className="w-5 h-5 text-white" />
                    </div>
                    <div className="min-w-0 flex-1">
                        <h1 className="text-base font-bold text-gray-900 truncate">{definition.name}</h1>
                        {definition.description && (
                            <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{definition.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                            {definition.allowed_formats.map(f => (
                                <span key={f} className={`font-mono text-[10px] font-bold uppercase px-1.5 py-0.5 rounded ${
                                    f === definition.default_format
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-gray-100 text-gray-500'
                                }`}>{f}</span>
                            ))}
                            {requiredCount > 0 && (
                                <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-md ${
                                    allRequiredFilled
                                        ? 'bg-emerald-50 text-emerald-600'
                                        : 'bg-amber-50 text-amber-600'
                                }`}>
                                    {allRequiredFilled
                                        ? `${filledCount} / ${requiredCount} champs remplis`
                                        : `${filledCount} / ${requiredCount} champs requis`
                                    }
                                </span>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex-1 overflow-y-auto p-5 bg-slate-50">
                <ReportFilters
                    schema={definition.parameter_schema}
                    values={paramValues}
                    onChange={onParamChange}
                />

                {/* Format selector + actions (mobile-friendly fallback) */}
                <div className="mt-6 pt-5 border-t border-gray-200 flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-gray-500 font-medium shrink-0">Format :</span>
                        <Select value={format} onValueChange={(v) => onFormatChange(v as ExportFormat)}>
                            <SelectTrigger className="h-8 w-28 text-xs">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                {definition.allowed_formats.map(f => (
                                    <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="flex gap-2 sm:ml-auto">
                        <button
                            onClick={onPreview}
                            disabled={!allRequiredFilled || previewing}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Eye className="w-3.5 h-3.5" />
                            {previewing ? 'Chargement…' : 'Aperçu'}
                        </button>
                        <button
                            onClick={onExport}
                            disabled={!allRequiredFilled || exporting}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                        >
                            <Download className="w-3.5 h-3.5" />
                            {exporting ? 'Export…' : `Exporter ${format.toUpperCase()}`}
                        </button>
                    </div>
                </div>

                {!allRequiredFilled && requiredCount > 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-3">
                        Remplissez les champs requis (*) pour activer l'aperçu et l'export.
                    </p>
                )}
            </div>
        </div>
    );
};

// ── Preview panel ─────────────────────────────────────────────────────────────

interface PreviewProps {
    definition:  ReportDefinition;
    preview:     ReportPreviewResponse | null;
    format:      ExportFormat;
    previewing:  boolean;
    exporting:   boolean;
    onFormatChange: (v: ExportFormat) => void;
    onExport:    () => void;
    onBack:      () => void;
}

const PreviewPanel: React.FC<PreviewProps> = ({
    definition, preview, format, previewing, exporting,
    onFormatChange, onExport, onBack,
}) => (
    <div className="h-full flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="bg-white px-5 py-3 border-b border-gray-200 shrink-0 flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                <span className="font-semibold text-sm text-gray-800">{definition.name}</span>
                {preview && (
                    <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                        {preview.total_rows.toLocaleString('fr-FR')} ligne{preview.total_rows > 1 ? 's' : ''}
                    </span>
                )}
                {preview && preview.sample.length < preview.total_rows && (
                    <span className="text-[11px] text-gray-400">
                        (aperçu : {preview.sample.length} premières lignes)
                    </span>
                )}
            </div>
            <div className="flex items-center gap-2 ml-auto">
                <button
                    onClick={onBack}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors"
                >
                    <Settings2 className="w-3.5 h-3.5" /> Modifier les filtres
                </button>
                <Select value={format} onValueChange={(v) => onFormatChange(v as ExportFormat)}>
                    <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                        {definition.allowed_formats.map(f => (
                            <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <button
                    onClick={onExport}
                    disabled={exporting}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
                >
                    <Download className="w-3.5 h-3.5" />
                    {exporting ? 'Export…' : `Exporter ${format.toUpperCase()}`}
                </button>
            </div>
        </div>

        {/* Grid */}
        <div className="flex-1 min-h-0 p-3 bg-slate-50">
            {preview && preview.sample.length > 0 ? (
                <div className="h-full rounded-lg border border-gray-200 shadow-sm overflow-hidden bg-white">
                    <DataGrid
                        rowData={preview.sample}
                        columnDefs={buildColumnDefs(definition, preview.sample)}
                        pagination={true}
                        paginationPageSize={50}
                        loading={previewing}
                    />
                </div>
            ) : (
                <div className="flex items-center justify-center h-full text-sm text-gray-400 border border-dashed border-gray-300 rounded-lg">
                    {previewing ? 'Chargement de l\'aperçu…' : 'Aucune donnée retournée pour ces paramètres.'}
                </div>
            )}
        </div>
    </div>
);

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ReportingPage() {
    const navigate = useNavigate();
    const location = useLocation();

    const [definition, setDefinition]   = useState<ReportDefinition | null>(null);
    const [paramValues, setParamValues] = useState<Record<string, unknown>>({});
    const [format, setFormat]           = useState<ExportFormat>('xlsx');
    const [preview, setPreview]         = useState<ReportPreviewResponse | null>(null);
    const [showPreview, setShowPreview] = useState(false);
    const [catFilter, setCatFilter]     = useState<string>('all');
    const [search, setSearch]           = useState('');

    const { data: catalogue = {}, isPending: cataloguePending, refetch } = useReportDefinitions();
    const { mutate: doPreview, isPending: previewing } = useReportPreview();
    const { mutate: doExport,  isPending: exporting  } = useReportExport();

    // Flatten catalogue to list with category annotation
    const allReports = useMemo(() =>
        Object.entries(catalogue).flatMap(([cat, reports]) =>
            reports.map(r => ({ ...r, _cat: cat }))
        ),
        [catalogue]
    );

    const categories = useMemo(() => Object.keys(catalogue), [catalogue]);

    const filteredReports = useMemo(() => {
        let list = allReports;
        if (catFilter !== 'all') list = list.filter(r => r._cat === catFilter);
        if (search.trim()) {
            const q = search.toLowerCase();
            list = list.filter(r =>
                r.name.toLowerCase().includes(q) ||
                r.description?.toLowerCase().includes(q)
            );
        }
        return list;
    }, [allReports, catFilter, search]);

    const handleSelectReport = useCallback((def: ReportDefinition) => {
        setDefinition(def);
        setParamValues({});
        setPreview(null);
        setShowPreview(false);
        setFormat((def.default_format ?? 'xlsx') as ExportFormat);
    }, []);

    const handleParamChange = useCallback((key: string, value: unknown) => {
        setParamValues(prev => ({ ...prev, [key]: value }));
    }, []);

    const buildPayload = useCallback(() => {
        if (!definition) return null;
        return {
            source_type:   definition.source_type,
            source_name:   definition.source_name,
            export_format: format,
            report_name:   definition.name,
            theme:         definition.default_theme,
            columns:       definition.default_columns.length ? definition.default_columns : undefined,
            style:         definition.default_style,
            filters:       buildFilters(definition.parameter_schema, paramValues),
        };
    }, [definition, format, paramValues]);

    const requiredFields      = definition?.parameter_schema.filter(f => f.required) ?? [];
    const allRequiredFilled   = requiredFields.every(f => paramValues[f.key] != null && paramValues[f.key] !== '');

    const handlePreview = useCallback(() => {
        const payload = buildPayload();
        if (!payload) return;
        doPreview(payload, {
            onSuccess: (data) => {
                setPreview(data);
                setShowPreview(true);
            },
        });
    }, [buildPayload, doPreview]);

    const handleExport = useCallback(() => {
        const payload = buildPayload();
        if (!payload) return;
        doExport({ ...payload, export_format: format });
    }, [buildPayload, doExport, format]);

    const isAdmin = location.pathname.startsWith('/reporting/admin');

    // ActionPanel
    const actionGroups = useMemo((): { items: ActionItemProps[] }[] => {
        if (!definition) {
            return [{ items: [
                { label: 'Rafraîchir', icon: RefreshCw, onClick: () => refetch(), variant: 'default' },
            ]}];
        }

        if (!showPreview) {
            return [
                { items: [
                    {
                        label:    previewing ? 'Chargement…' : 'Aperçu',
                        icon:     Eye,
                        onClick:  handlePreview,
                        variant:  'primary',
                        disabled: !allRequiredFilled || previewing,
                    },
                    {
                        label:    exporting ? 'Export…' : `Exporter ${format.toUpperCase()}`,
                        icon:     Download,
                        onClick:  handleExport,
                        variant:  'success',
                        disabled: !allRequiredFilled || exporting,
                    },
                ]},
                { items: [
                    { label: 'Changer de rapport', icon: ArrowLeft,  onClick: () => { setDefinition(null); setShowPreview(false); }, variant: 'default' },
                    { label: 'Rafraîchir',          icon: RefreshCw,  onClick: () => refetch(),                                     variant: 'default' },
                ]},
            ];
        }

        return [
            { items: [
                {
                    label:    exporting ? 'Export…' : `Exporter ${format.toUpperCase()}`,
                    icon:     Download,
                    onClick:  handleExport,
                    variant:  'primary',
                    disabled: exporting,
                },
            ]},
            { items: [
                { label: 'Modifier les filtres',  icon: Settings2,  onClick: () => setShowPreview(false),                         variant: 'default' },
                { label: 'Changer de rapport',    icon: ArrowLeft,  onClick: () => { setDefinition(null); setShowPreview(false); }, variant: 'default' },
            ]},
        ];
    }, [definition, showPreview, allRequiredFilled, previewing, exporting, format, handlePreview, handleExport, refetch]);

    return (
        <MasterLayout
            leftContent={
                <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                    {/* Module nav tabs */}
                    <div className="px-3 pt-3 pb-2 border-b border-gray-100 shrink-0">
                        <div className="flex gap-1">
                            <button
                                onClick={() => navigate('/reporting')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                                    !isAdmin ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <List className="w-3.5 h-3.5" /> Catalogue
                            </button>
                            <button
                                onClick={() => navigate('/reporting/admin')}
                                className={`flex items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium rounded-md transition-colors ${
                                    isAdmin ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-100'
                                }`}
                            >
                                <Settings2 className="w-3.5 h-3.5" /> Admin
                            </button>
                        </div>
                    </div>

                    {/* Header + filters */}
                    <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 shrink-0">
                        <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                                <BarChart2 className="w-4 h-4 text-gray-500" />
                                <h1 className="text-sm font-bold text-gray-900">Rapports</h1>
                            </div>
                            <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600">
                                {filteredReports.length}
                                {filteredReports.length < allReports.length && `/${allReports.length}`}
                            </span>
                        </div>

                        {/* Category pills */}
                        <div className="flex flex-wrap gap-1 mb-2">
                            <button
                                onClick={() => setCatFilter('all')}
                                className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                    catFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                }`}
                            >
                                Tous
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat}
                                    onClick={() => setCatFilter(cat)}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                        catFilter === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    {catMeta(cat).label}
                                </button>
                            ))}
                        </div>

                        {/* Search */}
                        <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                            <input
                                type="text"
                                placeholder="Rechercher…"
                                value={search}
                                onChange={e => setSearch(e.target.value)}
                                className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                            />
                            {search && (
                                <button onClick={() => setSearch('')}
                                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                    <X className="w-3 h-3 text-gray-400" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Report list */}
                    <div className="flex-1 overflow-y-auto">
                        {cataloguePending ? (
                            <div className="p-3 space-y-2">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" />
                                ))}
                            </div>
                        ) : filteredReports.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-xs text-gray-400">
                                <Search className="w-5 h-5 mb-2 text-gray-300" />
                                Aucun rapport trouvé
                            </div>
                        ) : (
                            <div className="p-2 space-y-0.5">
                                {filteredReports.map(report => {
                                    const meta      = catMeta(report._cat);
                                    const isSelected = definition?.code === report.code;
                                    const reqCount   = report.parameter_schema.filter(f => f.required).length;
                                    return (
                                        <button
                                            key={report.code}
                                            onClick={() => handleSelectReport(report)}
                                            className={`w-full text-left rounded-lg px-3 py-2.5 flex items-start gap-2.5 transition-colors ${
                                                isSelected
                                                    ? 'bg-indigo-50 border border-indigo-200'
                                                    : 'hover:bg-gray-50 border border-transparent'
                                            }`}
                                        >
                                            <div className={`w-2 h-2 rounded-full shrink-0 mt-1 ${meta.dot}`} />
                                            <div className="min-w-0 flex-1">
                                                <div className={`text-xs font-semibold truncate leading-snug ${
                                                    isSelected ? 'text-indigo-700' : 'text-gray-800'
                                                }`}>
                                                    {report.name}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                                                    <span className="text-[10px] text-gray-400">{meta.label}</span>
                                                    {reqCount > 0 && (
                                                        <span className="text-[10px] text-amber-600">
                                                            {reqCount} filtre{reqCount > 1 ? 's' : ''} requis
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-mono text-gray-300">
                                                        {report.allowed_formats.map(f => f.toUpperCase()).join('·')}
                                                    </span>
                                                </div>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            }
            mainContent={
                <div className="h-full overflow-hidden">
                    {!definition && <EmptyState />}

                    {definition && !showPreview && (
                        <FiltersPanel
                            definition={definition}
                            paramValues={paramValues}
                            format={format}
                            previewing={previewing}
                            exporting={exporting}
                            allRequiredFilled={allRequiredFilled}
                            onParamChange={handleParamChange}
                            onFormatChange={setFormat}
                            onPreview={handlePreview}
                            onExport={handleExport}
                        />
                    )}

                    {definition && showPreview && (
                        <PreviewPanel
                            definition={definition}
                            preview={preview}
                            format={format}
                            previewing={previewing}
                            exporting={exporting}
                            onFormatChange={setFormat}
                            onExport={handleExport}
                            onBack={() => setShowPreview(false)}
                        />
                    )}
                </div>
            }
            rightContent={<ActionPanel groups={actionGroups} />}
        />
    );
}
