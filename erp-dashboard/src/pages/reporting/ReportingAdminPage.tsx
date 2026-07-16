import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { json as jsonLang } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';
import type { ColDef } from 'ag-grid-community';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from '@/components/ui/dialog';
import { DataGrid } from '@/components/common/DataGrid';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { ActionPanel, type ActionItemProps } from '@/components/layout/ActionPanel';

import {
    useAdminDefinitions,
    useAdminSources,
    useCreateDefinition,
    useUpdateDefinition,
    useToggleDefinition,
    useDeleteDefinition,
    KNOWN_VIEWS,
} from '@/hooks/reporting/use-report-definitions';
import type { SourceView } from '@/types/reports.types';
import {
    reportDefinitionSchema,
    REPORT_CATEGORIES,
    REPORT_SOURCE_TYPES,
    REPORT_FORMATS,
    type ReportDefinitionInput,
} from '@/lib/schemas';
import type { ReportDefinitionAdmin } from '@/types/reports.types';
import {
    BarChart2, Plus, RefreshCw, Edit2, Trash2, ToggleLeft, ToggleRight,
    Search, X, ChevronRight, AlertTriangle, BookOpen, List,
} from 'lucide-react';

// ── helpers ───────────────────────────────────────────────────────────────────

function tryParseJson(str: string, fallback: unknown = null) {
    try { return JSON.parse(str); } catch { return fallback; }
}

function safeStringify(val: unknown, fallback = '') {
    if (typeof val === 'string') return val;
    if (val == null) return fallback;
    try { return JSON.stringify(val, null, 2); } catch { return fallback; }
}

function defToFormValues(def: ReportDefinitionAdmin): ReportDefinitionInput {
    return {
        code:             def.code,
        name:             def.name,
        description:      def.description ?? '',
        category:         def.category as ReportDefinitionInput['category'],
        sort_order:       def.sort_order,
        source_type:      def.source_type,
        source_name:      def.source_name,
        allowed_formats:  def.allowed_formats,
        default_format:   def.default_format,
        default_theme:    def.default_theme ?? '',
        parameter_schema: safeStringify(def.parameter_schema, '[]'),
        default_columns:  safeStringify(def.default_columns, '[]'),
        default_style:    safeStringify(def.default_style, '{}'),
    };
}

const EMPTY_DEFAULTS: ReportDefinitionInput = {
    code:             '',
    name:             '',
    description:      '',
    category:         'sales' as any,
    sort_order:       0,
    source_type:      'view',
    source_name:      '',
    allowed_formats:  ['xlsx'],
    default_format:   'xlsx',
    default_theme:    '',
    parameter_schema: '[]',
    default_columns:  '[]',
    default_style:    '{}',
};

const CATEGORY_LABELS: Record<string, string> = {
    clients: 'Clients', products: 'Produits', price_lists: 'Tarifs',
    sales: 'Ventes', visits: 'Visites', delivery: 'Livraisons', treasury: 'Trésorerie',
};

const CATEGORY_COLORS: Record<string, { bg: string; text: string }> = {
    clients:     { bg: 'bg-blue-50',    text: 'text-blue-700'    },
    products:    { bg: 'bg-green-50',   text: 'text-green-700'   },
    price_lists: { bg: 'bg-purple-50',  text: 'text-purple-700'  },
    sales:       { bg: 'bg-emerald-50', text: 'text-emerald-700' },
    visits:      { bg: 'bg-amber-50',   text: 'text-amber-700'   },
    delivery:    { bg: 'bg-orange-50',  text: 'text-orange-700'  },
    treasury:    { bg: 'bg-indigo-50',  text: 'text-indigo-700'  },
};

const SOURCE_LABELS: Record<string, string> = {
    view:      'Vue SQL',
    procedure: 'Procédure',
    query:     'Requête SQL',
};

// ── Tabs ──────────────────────────────────────────────────────────────────────

const TAB_ITEMS = [
    { key: 'basic',  label: '1. Informations'          },
    { key: 'source', label: '2. Source de données'     },
    { key: 'schema', label: '3. Paramètres & colonnes' },
] as const;
type TabKey = typeof TAB_ITEMS[number]['key'];

// ── Definition Form (Dialog) ──────────────────────────────────────────────────

interface FormProps {
    open:     boolean;
    editing?: ReportDefinitionAdmin | null;
    onClose:  () => void;
}

function DefinitionForm({ open, editing, onClose }: FormProps) {
    const isEdit = Boolean(editing);
    const [tab, setTab] = useState<TabKey>('basic');
    const sources = useAdminSources();

    const { register, handleSubmit, control, formState: { errors }, reset, watch } =
        useForm<ReportDefinitionInput>({
            resolver:      zodResolver(reportDefinitionSchema),
            defaultValues: EMPTY_DEFAULTS,
        });

    useEffect(() => {
        if (open) {
            setTab('basic');
            reset(editing ? defToFormValues(editing) : EMPTY_DEFAULTS);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, editing?.code]);

    const sourceType  = watch('source_type');
    const sourceName  = watch('source_name');
    const createMut   = useCreateDefinition();
    const updateMut   = useUpdateDefinition(editing?.code ?? '');
    const sourceList: SourceView[] = sources.data ?? KNOWN_VIEWS;
    const selectedView = sourceList.find((s) => s.view === sourceName);

    const onSubmit = (values: ReportDefinitionInput) => {
        const paramSchema  = tryParseJson(values.parameter_schema);
        const defaultCols  = tryParseJson(values.default_columns);
        const defaultStyle = tryParseJson(values.default_style);

        if (!Array.isArray(paramSchema)) {
            toast.error('parameter_schema doit être un tableau JSON valide []');
            setTab('schema'); return;
        }
        if (!Array.isArray(defaultCols)) {
            toast.error('default_columns doit être un tableau JSON valide []');
            setTab('schema'); return;
        }
        if (typeof defaultStyle !== 'object' || Array.isArray(defaultStyle) || defaultStyle === null) {
            toast.error('default_style doit être un objet JSON valide {}');
            setTab('schema'); return;
        }

        const payload = {
            ...values,
            parameter_schema: paramSchema,
            default_columns:  defaultCols,
            default_style:    defaultStyle,
        };

        if (isEdit) {
            updateMut.mutate(payload, { onSuccess: () => onClose() });
        } else {
            createMut.mutate(payload as any, { onSuccess: () => onClose() });
        }
    };

    const isPending = createMut.isPending || updateMut.isPending;

    return (
        <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
            <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
                <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
                    <DialogTitle>{isEdit ? 'Modifier le rapport' : 'Nouveau rapport'}</DialogTitle>
                    <DialogDescription>
                        {isEdit ? `Code : ${editing?.code}` : 'Définir un nouveau rapport dans le catalogue.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex border-b shrink-0 px-6 bg-background">
                    {TAB_ITEMS.map((t) => (
                        <button
                            key={t.key}
                            type="button"
                            onClick={() => setTab(t.key)}
                            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                                tab === t.key
                                    ? 'border-primary text-primary'
                                    : 'border-transparent text-muted-foreground hover:text-foreground'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 overflow-hidden">
                    <div className="flex-1 overflow-y-auto px-6 py-5">

                        {tab === 'basic' && (
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label htmlFor="code">Code <span className="text-destructive">*</span></Label>
                                        <Input
                                            id="code"
                                            {...register('code')}
                                            disabled={isEdit}
                                            placeholder="ex: sales_by_client"
                                            className={errors.code ? 'border-destructive' : ''}
                                        />
                                        {errors.code
                                            ? <p className="text-xs text-destructive">{errors.code.message}</p>
                                            : !isEdit && <p className="text-[10px] text-muted-foreground">snake_case uniquement, immuable après création</p>
                                        }
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="sort_order">Ordre d'affichage</Label>
                                        <Input id="sort_order" type="number" min={0} {...register('sort_order')} />
                                    </div>
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="name">Nom <span className="text-destructive">*</span></Label>
                                    <Input
                                        id="name" {...register('name')}
                                        placeholder="ex: Ventes par client"
                                        className={errors.name ? 'border-destructive' : ''}
                                    />
                                    {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                                </div>
                                <div className="space-y-1.5">
                                    <Label htmlFor="description">Description</Label>
                                    <Textarea id="description" {...register('description')} rows={2}
                                        placeholder="Explication courte du rapport (visible dans le catalogue)"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Catégorie <span className="text-destructive">*</span></Label>
                                    <Controller name="category" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={errors.category ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Choisir…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REPORT_CATEGORIES.map((c) => (
                                                    <SelectItem key={c} value={c}>{CATEGORY_LABELS[c] ?? c}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Formats autorisés <span className="text-destructive">*</span></Label>
                                    <Controller name="allowed_formats" control={control} render={({ field }) => (
                                        <div className="flex gap-5">
                                            {REPORT_FORMATS.map((fmt) => (
                                                <label key={fmt} className="flex items-center gap-2 cursor-pointer select-none">
                                                    <Checkbox
                                                        checked={field.value?.includes(fmt)}
                                                        onCheckedChange={(checked) => {
                                                            const next = checked
                                                                ? [...(field.value ?? []), fmt]
                                                                : (field.value ?? []).filter((f) => f !== fmt);
                                                            field.onChange(next);
                                                        }}
                                                    />
                                                    <span className="text-sm font-medium">{fmt.toUpperCase()}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )} />
                                    {errors.allowed_formats && <p className="text-xs text-destructive">{errors.allowed_formats.message}</p>}
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1.5">
                                        <Label>Format par défaut <span className="text-destructive">*</span></Label>
                                        <Controller name="default_format" control={control} render={({ field }) => (
                                            <Select value={field.value} onValueChange={field.onChange}>
                                                <SelectTrigger><SelectValue /></SelectTrigger>
                                                <SelectContent>
                                                    {REPORT_FORMATS.map((f) => (
                                                        <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        )} />
                                    </div>
                                    <div className="space-y-1.5">
                                        <Label htmlFor="default_theme">Thème par défaut</Label>
                                        <Input id="default_theme" {...register('default_theme')} placeholder="ex: corporate" />
                                    </div>
                                </div>
                            </div>
                        )}

                        {tab === 'source' && (
                            <div className="space-y-4">
                                <div className="space-y-1.5">
                                    <Label>Type de source <span className="text-destructive">*</span></Label>
                                    <Controller name="source_type" control={control} render={({ field }) => (
                                        <Select value={field.value} onValueChange={field.onChange}>
                                            <SelectTrigger className={errors.source_type ? 'border-destructive' : ''}>
                                                <SelectValue placeholder="Choisir…" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {REPORT_SOURCE_TYPES.map((t) => (
                                                    <SelectItem key={t} value={t}>
                                                        {t === 'view' ? 'Vue SQL (view)' : t === 'procedure' ? 'Procédure stockée (procedure)' : 'Requête SQL (query)'}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    )} />
                                </div>
                                <div className="space-y-1.5">
                                    <Label>Nom de la source <span className="text-destructive">*</span></Label>
                                    {sourceType === 'view' && (
                                        <>
                                            <Controller name="source_name" control={control} render={({ field }) => (
                                                <Select value={field.value} onValueChange={field.onChange}>
                                                    <SelectTrigger className={errors.source_name ? 'border-destructive' : ''}>
                                                        <SelectValue placeholder="Choisir une vue…">
                                                            {field.value ? (sourceList.find((s) => s.view === field.value)?.label ?? field.value) : undefined}
                                                        </SelectValue>
                                                    </SelectTrigger>
                                                    <SelectContent className="max-h-72">
                                                        {sourceList.map((s) => (
                                                            <SelectItem key={s.view} value={s.view}>
                                                                <div className="flex flex-col gap-0.5 py-0.5">
                                                                    <span className="font-medium text-sm leading-tight">{s.label}</span>
                                                                    <span className="text-[11px] text-muted-foreground font-mono leading-tight">{s.view}</span>
                                                                </div>
                                                            </SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            )} />
                                            {selectedView && (
                                                <div className="rounded-md border bg-muted/40 px-3 py-2.5 space-y-1.5">
                                                    <p className="text-xs text-muted-foreground">{selectedView.description}</p>
                                                    <div className="flex flex-wrap gap-1">
                                                        {selectedView.columns.map((col) => (
                                                            <span key={col} className="inline-block font-mono text-[10px] bg-background border rounded px-1.5 py-0.5 text-foreground">{col}</span>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </>
                                    )}
                                    {sourceType === 'procedure' && (
                                        <Input {...register('source_name')} placeholder="sp_get_sales_data" className={errors.source_name ? 'border-destructive' : ''} />
                                    )}
                                    {sourceType === 'query' && (
                                        <Controller name="source_name" control={control} render={({ field }) => (
                                            <div className={`rounded-md overflow-hidden border ${errors.source_name ? 'border-destructive' : 'border-input'}`}>
                                                <CodeMirror
                                                    value={field.value} onChange={field.onChange}
                                                    extensions={[sql()]} theme={oneDark} height="220px"
                                                    basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }}
                                                    placeholder={"SELECT c.code, c.name, SUM(l.amount) AS total\nFROM clients c\nJOIN lignes l ON l.client_id = c.id\nGROUP BY c.code, c.name"}
                                                />
                                            </div>
                                        )} />
                                    )}
                                    {errors.source_name && <p className="text-xs text-destructive">{errors.source_name.message}</p>}
                                    <p className="text-[10px] text-muted-foreground">
                                        {sourceType === 'view'
                                            ? `${sourceList.length} vue${sourceList.length > 1 ? 's' : ''} PostgreSQL disponibles.`
                                            : sourceType === 'procedure'
                                            ? 'Nom de la procédure stockée uniquement — sans les paramètres.'
                                            : 'Requête SQL complète. Variables : {{date_from}}, {{date_to}}…'}
                                    </p>
                                </div>
                            </div>
                        )}

                        {tab === 'schema' && (
                            <div className="space-y-5">
                                <div className="space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <Label>parameter_schema <span className="ml-1 text-[10px] font-normal text-muted-foreground">— tableau JSON</span></Label>
                                        <span className="text-[10px] text-muted-foreground">key · label · type · required · options[]</span>
                                    </div>
                                    <Controller name="parameter_schema" control={control} render={({ field }) => (
                                        <div className="rounded-md overflow-hidden border border-input">
                                            <CodeMirror value={field.value} onChange={field.onChange}
                                                extensions={[jsonLang()]} theme={oneDark} height="200px"
                                                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true }}
                                                placeholder={'[\n  {\n    "key": "date_from",\n    "label": "Du",\n    "type": "date",\n    "required": true\n  }\n]'}
                                            />
                                        </div>
                                    )} />
                                    <p className="text-[10px] text-muted-foreground">
                                        Types : <code className="font-mono">date</code> · <code className="font-mono">select</code> · <code className="font-mono">boolean</code> · <code className="font-mono">text</code> · <code className="font-mono">number</code>
                                    </p>
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <Label>default_columns <span className="ml-1 text-[10px] font-normal text-muted-foreground">— tableau JSON</span></Label>
                                        <span className="text-[10px] text-muted-foreground">key · label · width · align</span>
                                    </div>
                                    <Controller name="default_columns" control={control} render={({ field }) => (
                                        <div className="rounded-md overflow-hidden border border-input">
                                            <CodeMirror value={field.value} onChange={field.onChange}
                                                extensions={[jsonLang()]} theme={oneDark} height="160px"
                                                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
                                                placeholder={'[\n  { "key": "client_name", "label": "Client", "width": 200, "align": "left" }\n]'}
                                            />
                                        </div>
                                    )} />
                                </div>
                                <div className="space-y-1.5">
                                    <div className="flex items-baseline justify-between">
                                        <Label>default_style <span className="ml-1 text-[10px] font-normal text-muted-foreground">— objet JSON</span></Label>
                                        <span className="text-[10px] text-muted-foreground">freeze_header · enable_autofilter…</span>
                                    </div>
                                    <Controller name="default_style" control={control} render={({ field }) => (
                                        <div className="rounded-md overflow-hidden border border-input">
                                            <CodeMirror value={field.value} onChange={field.onChange}
                                                extensions={[jsonLang()]} theme={oneDark} height="130px"
                                                basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
                                                placeholder={'{\n  "freeze_header": true,\n  "enable_autofilter": true\n}'}
                                            />
                                        </div>
                                    )} />
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter className="px-6 py-4 border-t shrink-0">
                        <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>Annuler</Button>
                        <Button type="submit" disabled={isPending}>
                            {isPending ? (isEdit ? 'Enregistrement…' : 'Création…') : (isEdit ? 'Enregistrer' : 'Créer le rapport')}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────

function DeleteConfirm({
    target, onCancel, onConfirm, isPending,
}: {
    target:    ReportDefinitionAdmin | null;
    onCancel:  () => void;
    onConfirm: () => void;
    isPending: boolean;
}) {
    return (
        <Dialog open={Boolean(target)} onOpenChange={(v) => { if (!v) onCancel(); }}>
            <DialogContent className="max-w-sm">
                <div className="flex items-center gap-3 mb-3">
                    <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-500" />
                    </div>
                    <div>
                        <DialogHeader>
                            <DialogTitle className="text-sm">Supprimer ce rapport ?</DialogTitle>
                        </DialogHeader>
                    </div>
                </div>
                <div className="px-3 py-2.5 bg-gray-50 rounded-lg border border-gray-200 mb-3">
                    <div className="font-medium text-sm text-gray-900">{target?.name}</div>
                    <div className="font-mono text-[11px] text-gray-500 mt-0.5">{target?.code}</div>
                </div>
                <p className="text-xs text-red-600 mb-4">Cette action est irréversible.</p>
                <DialogFooter>
                    <Button variant="outline" size="sm" onClick={onCancel} disabled={isPending}>Annuler</Button>
                    <Button variant="destructive" size="sm" onClick={onConfirm} disabled={isPending}>
                        {isPending ? 'Suppression…' : 'Supprimer'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

// ── Detail Panel ──────────────────────────────────────────────────────────────

const ReportDetail: React.FC<{
    report: ReportDefinitionAdmin;
    onEdit: () => void;
    onDelete: () => void;
    onToggle: () => void;
    togglePending: boolean;
}> = ({ report, onEdit, onDelete, onToggle, togglePending }) => {
    const catColor = CATEGORY_COLORS[report.category] ?? { bg: 'bg-gray-50', text: 'text-gray-600' };

    return (
        <div className="h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-white px-5 py-4 border-b border-gray-200 shrink-0">
                <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-600 flex items-center justify-center shrink-0">
                            <BarChart2 className="w-5 h-5 text-white" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 flex-wrap">
                                <h1 className="text-base font-bold text-gray-900">{report.name}</h1>
                                <span className={`px-2 py-0.5 text-[10px] font-semibold rounded-md ${
                                    report.is_active ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-gray-100 text-gray-500 border border-gray-200'
                                }`}>
                                    {report.is_active ? 'Actif' : 'Inactif'}
                                </span>
                            </div>
                            <div className="font-mono text-[11px] text-gray-400 mt-0.5 flex items-center gap-1.5">
                                <span>{report.code}</span>
                                <ChevronRight className="w-3 h-3" />
                                <span>{CATEGORY_LABELS[report.category] ?? report.category}</span>
                            </div>
                        </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                        <button onClick={onEdit}
                            className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-600 transition-colors" title="Modifier">
                            <Edit2 className="w-4 h-4" />
                        </button>
                        <button onClick={onDelete}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-red-500 transition-colors" title="Supprimer">
                            <Trash2 className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-50">
                {/* Description */}
                {report.description && (
                    <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
                        <p className="text-xs text-gray-600 leading-relaxed">{report.description}</p>
                    </div>
                )}

                {/* Catégorie & ordre */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Classification</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Catégorie</span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${catColor.bg} ${catColor.text}`}>
                                {CATEGORY_LABELS[report.category] ?? report.category}
                            </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Ordre d'affichage</span>
                            <span className="font-mono text-gray-700">{report.sort_order}</span>
                        </div>
                        {report.default_theme && (
                            <div className="flex items-center justify-between text-xs">
                                <span className="text-gray-400">Thème</span>
                                <span className="font-mono text-gray-700">{report.default_theme}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Source */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Source de données</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Type</span>
                            <span className={`px-2 py-0.5 rounded-md text-[11px] font-medium ${
                                report.source_type === 'view' ? 'bg-blue-50 text-blue-700'
                                : report.source_type === 'procedure' ? 'bg-purple-50 text-purple-700'
                                : 'bg-orange-50 text-orange-700'
                            }`}>
                                {SOURCE_LABELS[report.source_type] ?? report.source_type}
                            </span>
                        </div>
                        <div className="flex items-start justify-between text-xs gap-3">
                            <span className="text-gray-400 shrink-0">Source</span>
                            <span className="font-mono text-gray-700 text-right break-all">{report.source_name}</span>
                        </div>
                    </div>
                </div>

                {/* Formats */}
                <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Formats d'export</span>
                    </div>
                    <div className="p-4 space-y-3">
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Formats autorisés</span>
                            <div className="flex gap-1.5">
                                {report.allowed_formats.map((f) => (
                                    <span key={f}
                                        className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase ${
                                            f === report.default_format
                                                ? 'bg-indigo-500 text-white'
                                                : 'bg-gray-100 text-gray-600'
                                        }`}>
                                        {f}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                            <span className="text-gray-400">Format par défaut</span>
                            <span className="font-mono font-bold text-indigo-600 uppercase">{report.default_format}</span>
                        </div>
                    </div>
                </div>

                {/* Toggle */}
                <button
                    onClick={onToggle}
                    disabled={togglePending}
                    className={`w-full rounded-xl border p-4 flex items-center gap-3 transition-colors ${
                        report.is_active
                            ? 'bg-amber-50 border-amber-200 hover:bg-amber-100'
                            : 'bg-emerald-50 border-emerald-200 hover:bg-emerald-100'
                    }`}
                >
                    {report.is_active
                        ? <ToggleLeft className="w-5 h-5 text-amber-600 shrink-0" />
                        : <ToggleRight className="w-5 h-5 text-emerald-600 shrink-0" />
                    }
                    <span className={`text-sm font-medium ${report.is_active ? 'text-amber-700' : 'text-emerald-700'}`}>
                        {togglePending
                            ? 'Mise à jour…'
                            : report.is_active ? 'Désactiver ce rapport' : 'Activer ce rapport'
                        }
                    </span>
                </button>
            </div>
        </div>
    );
};

// ── Empty State ───────────────────────────────────────────────────────────────

const EmptyState: React.FC<{ onNew: () => void }> = ({ onNew }) => (
    <div className="h-full flex flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-gray-100">
        <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center mb-5 shadow-md border border-gray-100">
            <BookOpen className="w-10 h-10 text-gray-200" />
        </div>
        <h3 className="text-base font-semibold text-gray-700">Aucun rapport sélectionné</h3>
        <p className="text-sm mt-1.5 text-gray-400 max-w-xs text-center">
            Double-cliquez sur un rapport à gauche pour afficher ses détails.
        </p>
        <button onClick={onNew}
            className="mt-5 flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors font-medium">
            <Plus className="w-4 h-4" /> Nouveau rapport
        </button>
    </div>
);

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportingAdminPage() {
    const navigate  = useNavigate();
    const location  = useLocation();

    const [formOpen, setFormOpen]         = useState(false);
    const [editing, setEditing]           = useState<ReportDefinitionAdmin | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<ReportDefinitionAdmin | null>(null);
    const [selectedReport, setSelectedReport] = useState<ReportDefinitionAdmin | null>(null);
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery]   = useState('');

    const { data: definitions = [], isPending, refetch } = useAdminDefinitions();
    const toggleMut = useToggleDefinition();
    const deleteMut = useDeleteDefinition();

    const openCreate  = () => { setEditing(null); setFormOpen(true); };
    const openEdit    = (def: ReportDefinitionAdmin) => { setEditing(def); setFormOpen(true); };
    const closeForm   = () => { setFormOpen(false); setEditing(null); };

    // Loading cursor on double-click
    const cursorTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
    useEffect(() => () => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        document.getElementById('loading-cursor-style')?.remove();
    }, []);

    const handleRowSelect = useCallback((row: ReportDefinitionAdmin) => {
        if (cursorTimeoutRef.current) clearTimeout(cursorTimeoutRef.current);
        if (!document.getElementById('loading-cursor-style')) {
            const s = document.createElement('style');
            s.id = 'loading-cursor-style';
            s.innerHTML = '* { cursor: wait !important; }';
            document.head.appendChild(s);
        }
        setSelectedReport(row);
        cursorTimeoutRef.current = setTimeout(() => {
            document.getElementById('loading-cursor-style')?.remove();
            cursorTimeoutRef.current = undefined;
        }, 300);
    }, []);

    // Filtered list
    const filteredDefs = useMemo(() => {
        let list = definitions;
        if (categoryFilter !== 'all') list = list.filter(d => d.category === categoryFilter);
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            list = list.filter(d =>
                d.name.toLowerCase().includes(q) ||
                d.code.toLowerCase().includes(q) ||
                (d.source_name ?? '').toLowerCase().includes(q)
            );
        }
        return list;
    }, [definitions, categoryFilter, searchQuery]);

    // Unique categories in data
    const categories = useMemo(() => {
        const seen = new Set<string>();
        definitions.forEach(d => seen.add(d.category));
        return Array.from(seen);
    }, [definitions]);

    // DataGrid columns — clean, no badges
    const columnDefs = useMemo<ColDef[]>(() => [
        {
            colId: 'status',
            headerName: '',
            width: 30,
            sortable: false,
            filter: false,
            cellRenderer: (p: any) => (
                <div className="flex items-center justify-center h-full">
                    <div style={{ width: 7, height: 7, borderRadius: '50%', backgroundColor: p.data?.is_active ? '#10b981' : '#d1d5db', flexShrink: 0 }} />
                </div>
            ),
        },
        {
            field: 'code',
            headerName: 'Code',
            width: 180,
            cellStyle: { fontFamily: 'monospace', fontSize: '11px', color: '#6b7280' },
        },
        {
            field: 'name',
            headerName: 'Nom',
            flex: 1,
            minWidth: 140,
            cellStyle: { fontSize: '12px', fontWeight: '600', color: '#111827' },
        },
        {
            field: 'category',
            headerName: 'Catégorie',
            width: 100,
            valueGetter: (p: any) => CATEGORY_LABELS[p.data?.category] ?? p.data?.category ?? '',
            cellStyle: { fontSize: '11px', color: '#374151' },
        },
        {
            field: 'source_type',
            headerName: 'Type',
            width: 90,
            valueGetter: (p: any) => SOURCE_LABELS[p.data?.source_type] ?? p.data?.source_type ?? '',
            cellStyle: { fontSize: '11px', color: '#6b7280' },
        },
        {
            colId: 'formats',
            headerName: 'Formats',
            width: 100,
            valueGetter: (p: any) => (p.data?.allowed_formats as string[] ?? []).map((f: string) => f.toUpperCase()).join(' · '),
            cellStyle: { fontFamily: 'monospace', fontSize: '10px', color: '#4f46e5', fontWeight: '600' },
        },
    ], []);

    // ActionPanel
    const actionGroups = useMemo(() => {
        const base: ActionItemProps[] = [
            { label: 'Nouveau rapport', icon: Plus, onClick: openCreate, variant: 'primary' },
            { label: 'Actualiser',      icon: RefreshCw, onClick: () => refetch(), variant: 'default' },
        ];
        const reportActions: ActionItemProps[] = selectedReport ? [
            { label: 'Modifier',  icon: Edit2, onClick: () => openEdit(selectedReport), variant: 'default' },
            {
                label: selectedReport.is_active ? 'Désactiver' : 'Activer',
                icon:  selectedReport.is_active ? ToggleLeft : ToggleRight,
                onClick: () => toggleMut.mutate(selectedReport.code, {
                    onSuccess: (updated) => setSelectedReport(updated),
                }),
                variant: selectedReport.is_active ? 'warning' : 'success',
            },
            { label: 'Supprimer', icon: Trash2, onClick: () => setDeleteTarget(selectedReport), variant: 'danger' },
        ] : [];

        return reportActions.length
            ? [{ items: base }, { items: reportActions }]
            : [{ items: base }];
    }, [selectedReport, toggleMut, refetch]);

    const activeCount = definitions.filter(d => d.is_active).length;
    const isAdmin = location.pathname.startsWith('/reporting/admin');

    return (
        <>
            <MasterLayout
                leftContent={
                    <div className="h-full bg-white border-r border-gray-200 flex flex-col">
                        {/* Module nav */}
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
                                    <BarChart2 className="w-3.5 h-3.5" /> Admin
                                </button>
                            </div>
                        </div>

                        {/* Header */}
                        <div className="px-3 pt-2.5 pb-2 border-b border-gray-100 shrink-0">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2">
                                    <BarChart2 className="w-4 h-4 text-gray-500" />
                                    <h1 className="text-sm font-bold text-gray-900 tracking-tight">Catalogue admin</h1>
                                </div>
                                <span className="px-1.5 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-50 text-indigo-600">
                                    {filteredDefs.length}
                                    {filteredDefs.length < definitions.length && `/${definitions.length}`}
                                </span>
                            </div>

                            {/* Category pills */}
                            <div className="flex flex-wrap gap-1 mb-2">
                                <button
                                    onClick={() => setCategoryFilter('all')}
                                    className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                        categoryFilter === 'all' ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                    }`}
                                >
                                    Tous
                                </button>
                                {categories.map(cat => (
                                    <button
                                        key={cat}
                                        onClick={() => setCategoryFilter(cat)}
                                        className={`px-2 py-0.5 text-[10px] font-medium rounded-md transition-colors ${
                                            categoryFilter === cat ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                                        }`}
                                    >
                                        {CATEGORY_LABELS[cat] ?? cat}
                                    </button>
                                ))}
                            </div>

                            {/* Search */}
                            <div className="relative">
                                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                                <input
                                    type="text"
                                    placeholder="Rechercher…"
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    className="w-full pl-8 pr-7 py-1.5 text-xs border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                                />
                                {searchQuery && (
                                    <button onClick={() => setSearchQuery('')}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-gray-200">
                                        <X className="w-3 h-3 text-gray-400" />
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Active / total stat */}
                        {!isPending && definitions.length > 0 && (
                            <div className="px-3 py-1.5 border-b border-gray-100 shrink-0 flex items-center gap-3">
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                    <span>{activeCount} actifs</span>
                                </div>
                                <div className="flex items-center gap-1.5 text-[10px] text-gray-400">
                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                                    <span>{definitions.length - activeCount} inactifs</span>
                                </div>
                            </div>
                        )}

                        {/* Grid */}
                        <div className="flex-1 min-h-0 p-2">
                            <div className="bg-white rounded-lg border border-gray-200 shadow-sm h-full">
                                <DataGrid
                                    rowData={filteredDefs}
                                    columnDefs={columnDefs}
                                    loading={isPending}
                                    rowSelection="single"
                                    onRowDoubleClicked={handleRowSelect}
                                />
                            </div>
                        </div>
                    </div>
                }
                mainContent={
                    <div className="h-full overflow-hidden">
                        {selectedReport
                            ? <ReportDetail
                                report={selectedReport}
                                onEdit={() => openEdit(selectedReport)}
                                onDelete={() => setDeleteTarget(selectedReport)}
                                onToggle={() => toggleMut.mutate(selectedReport.code, {
                                    onSuccess: (updated) => setSelectedReport(updated),
                                })}
                                togglePending={toggleMut.isPending}
                            />
                            : <EmptyState onNew={openCreate} />
                        }
                    </div>
                }
                rightContent={<ActionPanel groups={actionGroups} />}
            />

            <DefinitionForm open={formOpen} editing={editing} onClose={closeForm} />
            <DeleteConfirm
                target={deleteTarget}
                onCancel={() => setDeleteTarget(null)}
                onConfirm={() => {
                    if (deleteTarget) {
                        deleteMut.mutate(deleteTarget.code, {
                            onSuccess: () => {
                                setDeleteTarget(null);
                                if (selectedReport?.code === deleteTarget.code) setSelectedReport(null);
                            },
                        });
                    }
                }}
                isPending={deleteMut.isPending}
            />
        </>
    );
}
