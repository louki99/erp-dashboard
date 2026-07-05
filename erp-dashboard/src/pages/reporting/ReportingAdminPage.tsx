import { useState, useMemo, useEffect } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import CodeMirror from '@uiw/react-codemirror';
import { sql } from '@codemirror/lang-sql';
import { json as jsonLang } from '@codemirror/lang-json';
import { oneDark } from '@codemirror/theme-one-dark';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

// ── Reporting nav sidebar (shared with ReportingPage) ─────────────────────────

function ReportingNav() {
  const navigate  = useNavigate();
  const location  = useLocation();
  const isAdmin   = location.pathname.startsWith('/reporting/admin');

  const items = [
    { path: '/reporting',       label: 'Catalogue',        icon: '📊', desc: 'Rapports disponibles' },
    { path: '/reporting/admin', label: 'Admin catalogue',  icon: '⚙️', desc: 'Gérer les définitions' },
  ];

  return (
    <div className="h-full bg-white border-r flex flex-col overflow-hidden">
      <div className="px-4 py-5 border-b shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Module</p>
        <h2 className="text-sm font-bold text-gray-800">Reporting</h2>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = item.path === '/reporting'
            ? !isAdmin
            : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors group ${
                active
                  ? 'bg-primary/10 text-primary'
                  : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <div>
                  <p className={`text-sm font-medium leading-none ${active ? 'text-primary' : ''}`}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">{item.desc}</p>
                </div>
              </div>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

// ── Inline Tabs ───────────────────────────────────────────────────────────────

const TAB_ITEMS = [
  { key: 'basic',  label: '1. Informations'         },
  { key: 'source', label: '2. Source de données'    },
  { key: 'schema', label: '3. Paramètres & colonnes' },
] as const;
type TabKey = typeof TAB_ITEMS[number]['key'];

// ── Definition Form Dialog ────────────────────────────────────────────────────

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

  // Reset form + tab each time dialog opens (edit or create)
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
      setTab('schema');
      return;
    }
    if (!Array.isArray(defaultCols)) {
      toast.error('default_columns doit être un tableau JSON valide []');
      setTab('schema');
      return;
    }
    if (typeof defaultStyle !== 'object' || Array.isArray(defaultStyle) || defaultStyle === null) {
      toast.error('default_style doit être un objet JSON valide {}');
      setTab('schema');
      return;
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
      {/* Override DialogContent to flex-col + overflow-hidden for inner scroll */}
      <DialogContent className="max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <DialogTitle>{isEdit ? 'Modifier le rapport' : 'Nouveau rapport'}</DialogTitle>
          <DialogDescription>
            {isEdit ? `Code : ${editing?.code}` : 'Définir un nouveau rapport dans le catalogue.'}
          </DialogDescription>
        </DialogHeader>

        {/* Tab bar */}
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
          {/* Scrollable body */}
          <div className="flex-1 overflow-y-auto px-6 py-5">

            {/* ── TAB 1: Informations ──────────────────────────── */}
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
                    id="name"
                    {...register('name')}
                    placeholder="ex: Ventes par client"
                    className={errors.name ? 'border-destructive' : ''}
                  />
                  {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    {...register('description')}
                    rows={2}
                    placeholder="Explication courte du rapport (visible dans le catalogue)"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Catégorie <span className="text-destructive">*</span></Label>
                  <Controller
                    name="category"
                    control={control}
                    render={({ field }) => (
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
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Formats autorisés <span className="text-destructive">*</span></Label>
                  <Controller
                    name="allowed_formats"
                    control={control}
                    render={({ field }) => (
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
                    )}
                  />
                  {errors.allowed_formats && (
                    <p className="text-xs text-destructive">{errors.allowed_formats.message}</p>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Format par défaut <span className="text-destructive">*</span></Label>
                    <Controller
                      name="default_format"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value} onValueChange={field.onChange}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {REPORT_FORMATS.map((f) => (
                              <SelectItem key={f} value={f}>{f.toUpperCase()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="default_theme">Thème par défaut</Label>
                    <Input id="default_theme" {...register('default_theme')} placeholder="ex: corporate" />
                  </div>
                </div>
              </div>
            )}

            {/* ── TAB 2: Source de données ─────────────────────── */}
            {tab === 'source' && (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Type de source <span className="text-destructive">*</span></Label>
                  <Controller
                    name="source_type"
                    control={control}
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger className={errors.source_type ? 'border-destructive' : ''}>
                          <SelectValue placeholder="Choisir…" />
                        </SelectTrigger>
                        <SelectContent>
                          {REPORT_SOURCE_TYPES.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t === 'view'      ? 'Vue SQL (view)'
                               : t === 'procedure' ? 'Procédure stockée (procedure)'
                               : 'Requête SQL (query)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <Label>Nom de la source <span className="text-destructive">*</span></Label>

                  {/* VIEW — dropdown with label + column preview */}
                  {sourceType === 'view' && (
                    <>
                      <Controller
                        name="source_name"
                        control={control}
                        render={({ field }) => (
                          <Select value={field.value} onValueChange={field.onChange}>
                            <SelectTrigger className={errors.source_name ? 'border-destructive' : ''}>
                              <SelectValue placeholder="Choisir une vue…">
                                {field.value
                                  ? (sourceList.find((s) => s.view === field.value)?.label ?? field.value)
                                  : undefined}
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
                        )}
                      />
                      {selectedView && (
                        <div className="rounded-md border bg-muted/40 px-3 py-2.5 space-y-1.5">
                          <p className="text-xs text-muted-foreground">{selectedView.description}</p>
                          <div className="flex flex-wrap gap-1">
                            {selectedView.columns.map((col) => (
                              <span
                                key={col}
                                className="inline-block font-mono text-[10px] bg-background border rounded px-1.5 py-0.5 text-foreground"
                              >
                                {col}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </>
                  )}

                  {/* PROCEDURE — plain text (just the name) */}
                  {sourceType === 'procedure' && (
                    <Input
                      {...register('source_name')}
                      placeholder="sp_get_sales_data"
                      className={errors.source_name ? 'border-destructive' : ''}
                    />
                  )}

                  {/* QUERY — SQL editor */}
                  {sourceType === 'query' && (
                    <Controller
                      name="source_name"
                      control={control}
                      render={({ field }) => (
                        <div className={`rounded-md overflow-hidden border ${errors.source_name ? 'border-destructive' : 'border-input'}`}>
                          <CodeMirror
                            value={field.value}
                            onChange={field.onChange}
                            extensions={[sql()]}
                            theme={oneDark}
                            height="220px"
                            basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true }}
                            placeholder={"SELECT c.code, c.name, SUM(l.amount) AS total\nFROM clients c\nJOIN lignes l ON l.client_id = c.id\nGROUP BY c.code, c.name"}
                          />
                        </div>
                      )}
                    />
                  )}

                  {errors.source_name && (
                    <p className="text-xs text-destructive">{errors.source_name.message}</p>
                  )}
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

            {/* ── TAB 3: Paramètres & colonnes (JSON editors) ──── */}
            {tab === 'schema' && (
              <div className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label>
                      parameter_schema
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">— tableau JSON</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">key · label · type · required · options[]</span>
                  </div>
                  <Controller
                    name="parameter_schema"
                    control={control}
                    render={({ field }) => (
                      <div className="rounded-md overflow-hidden border border-input">
                        <CodeMirror
                          value={field.value}
                          onChange={field.onChange}
                          extensions={[jsonLang()]}
                          theme={oneDark}
                          height="200px"
                          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, autocompletion: true, bracketMatching: true }}
                          placeholder={'[\n  {\n    "key": "date_from",\n    "label": "Du",\n    "type": "date",\n    "required": true\n  }\n]'}
                        />
                      </div>
                    )}
                  />
                  <p className="text-[10px] text-muted-foreground">
                    Types : <code className="font-mono">date</code> · <code className="font-mono">select</code> · <code className="font-mono">boolean</code> · <code className="font-mono">text</code> · <code className="font-mono">number</code>
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label>
                      default_columns
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">— tableau JSON</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">key · label · width · align</span>
                  </div>
                  <Controller
                    name="default_columns"
                    control={control}
                    render={({ field }) => (
                      <div className="rounded-md overflow-hidden border border-input">
                        <CodeMirror
                          value={field.value}
                          onChange={field.onChange}
                          extensions={[jsonLang()]}
                          theme={oneDark}
                          height="160px"
                          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
                          placeholder={'[\n  { "key": "client_name", "label": "Client", "width": 200, "align": "left" }\n]'}
                        />
                      </div>
                    )}
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-baseline justify-between">
                    <Label>
                      default_style
                      <span className="ml-1.5 text-[10px] font-normal text-muted-foreground">— objet JSON</span>
                    </Label>
                    <span className="text-[10px] text-muted-foreground">freeze_header · enable_autofilter…</span>
                  </div>
                  <Controller
                    name="default_style"
                    control={control}
                    render={({ field }) => (
                      <div className="rounded-md overflow-hidden border border-input">
                        <CodeMirror
                          value={field.value}
                          onChange={field.onChange}
                          extensions={[jsonLang()]}
                          theme={oneDark}
                          height="130px"
                          basicSetup={{ lineNumbers: true, foldGutter: true, highlightActiveLine: true, bracketMatching: true }}
                          placeholder={'{\n  "freeze_header": true,\n  "enable_autofilter": true\n}'}
                        />
                      </div>
                    )}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Sticky footer */}
          <DialogFooter className="px-6 py-4 border-t shrink-0">
            <Button type="button" variant="outline" onClick={onClose} disabled={isPending}>
              Annuler
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? (isEdit ? 'Enregistrement…' : 'Création…')
                : (isEdit ? 'Enregistrer' : 'Créer le rapport')}
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Supprimer ce rapport ?</DialogTitle>
          <DialogDescription>
            Le rapport <strong>{target?.name}</strong> (<code className="text-xs">{target?.code}</code>) sera
            définitivement supprimé. Cette action est irréversible.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="mt-2">
          <Button variant="outline" onClick={onCancel} disabled={isPending}>Annuler</Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isPending}>
            {isPending ? 'Suppression…' : 'Supprimer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ReportingAdminPage() {
  const [drawerOpen, setDrawerOpen]     = useState(false);
  const [editing, setEditing]           = useState<ReportDefinitionAdmin | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ReportDefinitionAdmin | null>(null);

  const { data: definitions = [], isPending, isError } = useAdminDefinitions();
  const toggleMut = useToggleDefinition();
  const deleteMut = useDeleteDefinition();

  const openCreate  = () => { setEditing(null); setDrawerOpen(true); };
  const openEdit    = (def: ReportDefinitionAdmin) => { setEditing(def); setDrawerOpen(true); };
  const closeDrawer = () => { setDrawerOpen(false); setEditing(null); };

  const columnDefs = useMemo(() => [
    {
      field: 'code', headerName: 'Code', width: 200, sortable: true, filter: true,
      cellRenderer: (p: any) => <span className="font-mono text-xs text-muted-foreground">{p.value}</span>,
    },
    { field: 'name', headerName: 'Nom', width: 240, sortable: true, filter: true },
    {
      field: 'category', headerName: 'Catégorie', width: 120, sortable: true, filter: true,
      cellRenderer: (p: any) => (
        <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[p.value] ?? p.value}</Badge>
      ),
    },
    {
      field: 'source_type', headerName: 'Type', width: 110,
      cellRenderer: (p: any) => (
        <Badge variant="secondary" className={`text-[10px] ${
          p.value === 'view' ? 'bg-blue-100 text-blue-700'
          : p.value === 'procedure' ? 'bg-purple-100 text-purple-700'
          : 'bg-orange-100 text-orange-700'
        }`}>{p.value}</Badge>
      ),
    },
    {
      field: 'source_name', headerName: 'Source', width: 220, sortable: true, filter: true,
      cellRenderer: (p: any) => <span className="font-mono text-xs">{p.value}</span>,
    },
    {
      field: 'allowed_formats', headerName: 'Formats', width: 100,
      cellRenderer: (p: any) => (
        <div className="flex gap-1 items-center h-full">
          {(p.value as string[]).map((f: string) => (
            <span key={f} className="text-[10px] font-semibold uppercase">{f}</span>
          ))}
        </div>
      ),
    },
    {
      field: 'is_active', headerName: 'Statut', width: 90, sortable: true, filter: true,
      cellRenderer: (p: any) => (
        <Badge variant={p.value ? 'default' : 'outline'} className={`text-[10px] ${
          p.value ? 'bg-green-100 text-green-700 border-green-200' : 'text-muted-foreground'
        }`}>{p.value ? 'Actif' : 'Inactif'}</Badge>
      ),
    },
    {
      headerName: 'Actions', width: 185, sortable: false, filter: false,
      cellRenderer: (p: { data: ReportDefinitionAdmin }) => (
        <div className="flex items-center gap-1 h-full">
          <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => openEdit(p.data)}>
            Modifier
          </Button>
          <Button
            size="sm" variant="ghost"
            className={`h-7 px-2 text-xs ${p.data.is_active ? 'text-amber-600 hover:text-amber-700' : 'text-green-600 hover:text-green-700'}`}
            onClick={() => toggleMut.mutate(p.data.code)}
            disabled={toggleMut.isPending}
          >
            {p.data.is_active ? 'Désactiver' : 'Activer'}
          </Button>
          <Button
            size="sm" variant="ghost" className="h-7 px-2 text-xs text-destructive hover:text-destructive"
            onClick={() => setDeleteTarget(p.data)}
          >
            Suppr.
          </Button>
        </div>
      ),
    },
  ], [toggleMut.isPending]);

  const mainContent = (
    <div className="flex flex-col h-full">
      <div className="px-6 pt-6 pb-4 border-b bg-background shrink-0">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Admin — Catalogue de rapports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Gérer les définitions de rapports disponibles dans le catalogue utilisateur.
            </p>
          </div>
          <div className="flex items-center gap-3">
            {definitions.length > 0 && (
              <p className="text-xs text-muted-foreground">
                <strong className="text-foreground">{definitions.filter((d) => d.is_active).length}</strong> actifs
                {' '}/ <strong className="text-foreground">{definitions.length}</strong> total
              </p>
            )}
            <Button onClick={openCreate}>+ Nouveau rapport</Button>
          </div>
        </div>
      </div>

      <div className="flex-1 p-6 min-h-0 flex flex-col gap-3">
        {isError && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive shrink-0">
            Impossible de charger les définitions. Vérifiez la connexion au backend.
          </div>
        )}
        <div className="overflow-hidden rounded-md border" style={{ height: '600px' }}>
          <DataGrid
            rowData={definitions}
            columnDefs={columnDefs}
            loading={isPending}
            pagination={true}
            paginationPageSize={25}
            suppressAutoFit={true}
          />
        </div>
      </div>

      <DefinitionForm open={drawerOpen} editing={editing} onClose={closeDrawer} />
      <DeleteConfirm
        target={deleteTarget}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMut.mutate(deleteTarget.code, { onSuccess: () => setDeleteTarget(null) });
        }}
        isPending={deleteMut.isPending}
      />
    </div>
  );

  return (
    <MasterLayout
      leftContent={<ReportingNav />}
      mainContent={mainContent}
    />
  );
}
