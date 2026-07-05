import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ReportCatalogue } from '@/components/reporting/ReportCatalogue';
import { ReportFilters } from '@/components/reporting/ReportFilters';
import { DataGrid } from '@/components/common/DataGrid';
import { useReportPreview, useReportExport } from '@/hooks/reporting/use-reports';
import type { ReportDefinition, ExportFormat, ReportFilter, ReportPreviewResponse } from '@/types/reports.types';

type Step = 'catalogue' | 'filters' | 'preview';

function buildColumnDefs(
  definition: ReportDefinition,
  sample: Record<string, unknown>[],
): Record<string, unknown>[] {
  // Prefer the definition's default_columns (have labels), fall back to sample keys
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

function buildFilters(schema: ReportDefinition['parameter_schema'], values: Record<string, unknown>): ReportFilter[] {
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

function StepIndicator({ step }: { step: Step }) {
  const steps: { key: Step; label: string }[] = [
    { key: 'catalogue', label: '1. Choisir un rapport' },
    { key: 'filters',   label: '2. Paramètres'         },
    { key: 'preview',   label: '3. Aperçu & Export'    },
  ];

  const idx = steps.findIndex((s) => s.key === step);

  return (
    <div className="flex items-center gap-0">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center">
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-medium transition-colors ${
              i === idx
                ? 'bg-primary text-primary-foreground'
                : i < idx
                ? 'bg-primary/20 text-primary'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border ${
                i < idx ? 'border-primary/40 bg-primary/10' : 'border-current'
              }`}
            >
              {i < idx ? '✓' : i + 1}
            </span>
            {s.label}
          </div>
          {i < steps.length - 1 && (
            <div className={`h-px w-6 ${i < idx ? 'bg-primary/40' : 'bg-border'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function ReportingNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const isAdmin  = location.pathname.startsWith('/reporting/admin');

  const items = [
    { path: '/reporting',       label: 'Catalogue',       icon: '📊', desc: 'Rapports disponibles'  },
    { path: '/reporting/admin', label: 'Admin catalogue', icon: '⚙️', desc: 'Gérer les définitions' },
  ];

  return (
    <div className="h-full bg-white border-r flex flex-col overflow-hidden">
      <div className="px-4 py-5 border-b shrink-0">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Module</p>
        <h2 className="text-sm font-bold text-gray-800">Reporting</h2>
      </div>
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = item.path === '/reporting' ? !isAdmin : location.pathname.startsWith(item.path);
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              className={`w-full text-left rounded-lg px-3 py-2.5 transition-colors ${
                active ? 'bg-primary/10 text-primary' : 'hover:bg-gray-50 text-gray-600 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <span className="text-base">{item.icon}</span>
                <div>
                  <p className={`text-sm font-medium leading-none ${active ? 'text-primary' : ''}`}>{item.label}</p>
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

export default function ReportingPage() {
  const [step, setStep]                     = useState<Step>('catalogue');
  const [definition, setDefinition]         = useState<ReportDefinition | null>(null);
  const [paramValues, setParamValues]       = useState<Record<string, unknown>>({});
  const [format, setFormat]                 = useState<ExportFormat>('xlsx');
  const [preview, setPreview]               = useState<ReportPreviewResponse | null>(null);

  const { mutate: doPreview, isPending: previewing } = useReportPreview();
  const { mutate: doExport,  isPending: exporting  } = useReportExport();

  const handleSelectReport = (def: ReportDefinition) => {
    setDefinition(def);
    setParamValues({});
    setPreview(null);
    setFormat(def.default_format ?? 'xlsx');
    setStep('filters');
  };

  const handleParamChange = (key: string, value: unknown) => {
    setParamValues((prev) => ({ ...prev, [key]: value }));
  };

  const buildPayload = () => {
    if (!definition) return null;
    return {
      source_type:  definition.source_type,
      source_name:  definition.source_name,
      export_format: format,
      report_name:  definition.name,
      theme:        definition.default_theme,
      columns:      definition.default_columns.length ? definition.default_columns : undefined,
      style:        definition.default_style,
      filters:      buildFilters(definition.parameter_schema, paramValues),
    };
  };

  const requiredFields = definition?.parameter_schema.filter((f) => f.required) ?? [];
  const allRequiredFilled = requiredFields.every(
    (f) => paramValues[f.key] != null && paramValues[f.key] !== '',
  );

  const handlePreview = () => {
    const payload = buildPayload();
    if (!payload) return;
    doPreview(payload, {
      onSuccess: (data) => {
        setPreview(data);
        setStep('preview');
      },
    });
  };

  const handleExport = () => {
    const payload = buildPayload();
    if (!payload) return;
    doExport({ ...payload, export_format: format });
  };

  const pageContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 pt-6 pb-4 border-b bg-background shrink-0">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-semibold">Reporting</h1>
            {definition && (
              <p className="text-sm text-muted-foreground mt-0.5">{definition.name}</p>
            )}
          </div>
          {step !== 'catalogue' && (
            <Button variant="ghost" size="sm" onClick={() => { setStep('catalogue'); setPreview(null); }}>
              ← Changer de rapport
            </Button>
          )}
        </div>
        <StepIndicator step={step} />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">

        {/* ── STEP 1 : Catalogue ─────────────────────────────────────────── */}
        {step === 'catalogue' && (
          <ReportCatalogue onSelect={handleSelectReport} />
        )}

        {/* ── STEP 2 : Filtres ───────────────────────────────────────────── */}
        {step === 'filters' && definition && (
          <div className="max-w-4xl space-y-5">
            {/* Report info banner */}
            <div className="flex items-start gap-4 p-4 rounded-xl border bg-muted/30">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-base">{definition.name}</p>
                {definition.description && (
                  <p className="text-sm text-muted-foreground mt-0.5">{definition.description}</p>
                )}
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {definition.allowed_formats.map((fmt) => (
                    <Badge key={fmt} variant="outline" className="text-[10px]">
                      {fmt.toUpperCase()}
                    </Badge>
                  ))}
                  {definition.default_theme && (
                    <Badge variant="secondary" className="text-[10px]">
                      {definition.default_theme}
                    </Badge>
                  )}
                </div>
              </div>
              <div className="shrink-0 text-3xl select-none">📋</div>
            </div>

            {/* Filters card */}
            <Card className="shadow-sm">
              <CardContent className="pt-6">
                <ReportFilters
                  schema={definition.parameter_schema}
                  values={paramValues}
                  onChange={handleParamChange}
                />
              </CardContent>
            </Card>

            {/* Action bar */}
            <div className="flex items-center gap-3 pt-1">
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Format d'export :</span>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger className="h-9 w-32 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(definition.allowed_formats ?? ['xlsx', 'csv', 'pdf']).map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex gap-2 ml-auto">
                <Button
                  variant="outline"
                  onClick={handlePreview}
                  disabled={!allRequiredFilled || previewing}
                  className="gap-2"
                >
                  {previewing ? (
                    <><span className="animate-spin">⏳</span> Chargement…</>
                  ) : (
                    <>📊 Aperçu</>
                  )}
                </Button>
                <Button
                  onClick={handleExport}
                  disabled={!allRequiredFilled || exporting}
                  className="gap-2"
                >
                  {exporting ? (
                    <><span className="animate-spin">⏳</span> Export en cours…</>
                  ) : (
                    <>⬇ Exporter {format.toUpperCase()}</>
                  )}
                </Button>
              </div>
            </div>

            {!allRequiredFilled && requiredFields.length > 0 && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
                ⚠ Remplissez les champs marqués * pour activer l'aperçu et l'export.
              </p>
            )}
          </div>
        )}

        {/* ── STEP 3 : Aperçu ────────────────────────────────────────────── */}
        {step === 'preview' && definition && (
          <div className="flex flex-col gap-4">
            {/* Summary bar */}
            <div className="flex items-center gap-3 flex-wrap shrink-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm">{definition.name}</span>
                {preview && (
                  <Badge variant="secondary">
                    {preview.total_rows.toLocaleString('fr-FR')} ligne{preview.total_rows > 1 ? 's' : ''}
                  </Badge>
                )}
                {preview && preview.sample.length < preview.total_rows && (
                  <span className="text-xs text-muted-foreground">
                    (aperçu {preview.sample.length} premières lignes)
                  </span>
                )}
              </div>
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={() => setStep('filters')}>
                  ← Modifier les filtres
                </Button>
                <Select value={format} onValueChange={(v) => setFormat(v as ExportFormat)}>
                  <SelectTrigger className="h-8 w-28 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(definition.allowed_formats ?? ['xlsx', 'csv', 'pdf']).map((fmt) => (
                      <SelectItem key={fmt} value={fmt}>{fmt.toUpperCase()}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" onClick={handleExport} disabled={exporting}>
                  {exporting ? 'Export…' : '⬇ Exporter'}
                </Button>
              </div>
            </div>

            {/* AG Grid */}
            {preview && preview.sample.length > 0 ? (
              <div className="w-full overflow-hidden rounded-md border" style={{ height: '560px' }}>
                <DataGrid
                  rowData={preview.sample}
                  columnDefs={buildColumnDefs(definition, preview.sample)}
                  pagination={true}
                  paginationPageSize={50}
                  loading={previewing}
                />
              </div>
            ) : (
              <div className="flex items-center justify-center h-40 text-sm text-muted-foreground border rounded-md border-dashed">
                {previewing ? 'Chargement…' : 'Aucune donnée retournée pour ces paramètres.'}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <MasterLayout
      leftContent={<ReportingNav />}
      mainContent={pageContent}
    />
  );
}
