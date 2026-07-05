import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReportSourceForm } from '@/components/reporting/ReportSourceForm';
import { FilterBuilder } from '@/components/reporting/FilterBuilder';
import { StylePanel } from '@/components/reporting/StylePanel';
import { PreviewTable } from '@/components/reporting/PreviewTable';
import { useReportPreview, useReportExport } from '@/hooks/reporting/use-reports';
import { useReportConfigStore } from '@/stores/report-config-store';
import type { ReportPreviewResponse } from '@/types/reports.types';

export default function ReportingPage() {
  const [preview, setPreview] = useState<ReportPreviewResponse | null>(null);
  const store = useReportConfigStore();

  const { mutate: doPreview, isPending: previewing } = useReportPreview();
  const { mutate: doExport,  isPending: exporting }  = useReportExport();

  const buildPayload = () => ({
    source_type:   store.sourceType,
    source_name:   store.sourceName,
    parameters:    Object.keys(store.parameters).length ? store.parameters : undefined,
    filters:       store.filters.length ? store.filters : undefined,
    filter_logic:  store.filterLogic,
    export_format: store.exportFormat,
    report_name:   store.reportName || 'Rapport',
    theme:         store.theme || undefined,
    style:         Object.keys(store.style).length ? store.style : undefined,
  });

  const handlePreview = () => {
    doPreview(buildPayload(), {
      onSuccess: (data) => setPreview(data),
    });
  };

  const handleExport = () => {
    doExport(buildPayload());
  };

  return (
    <div className="flex flex-col gap-4 p-6 h-full">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Reporting</h1>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={handlePreview}
            disabled={!store.sourceName || previewing}
          >
            {previewing ? 'Chargement…' : '📊 Aperçu'}
          </Button>
          <Button
            onClick={handleExport}
            disabled={!store.sourceName || exporting}
          >
            {exporting ? 'Export en cours…' : '⬇ Exporter'}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        <div className="lg:col-span-2 space-y-4 overflow-auto">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Source & Configuration</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <ReportSourceForm />
              <FilterBuilder />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Style & Thème</CardTitle>
            </CardHeader>
            <CardContent>
              <StylePanel />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4 overflow-auto">
          <Card className="h-full">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">Aperçu des données</CardTitle>
            </CardHeader>
            <CardContent>
              <PreviewTable preview={preview} isPending={previewing} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
