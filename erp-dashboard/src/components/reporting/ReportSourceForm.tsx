import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportConfigStore } from '@/stores/report-config-store';
import type { SourceType } from '@/types/reports.types';

export function ReportSourceForm() {
  const {
    sourceType,
    sourceName,
    reportName,
    exportFormat,
    setSourceType,
    setSourceName,
    setReportName,
    setExportFormat,
  } = useReportConfigStore();

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Type de source</Label>
          <Select value={sourceType} onValueChange={(v) => setSourceType(v as SourceType)}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="procedure">Procédure stockée</SelectItem>
              <SelectItem value="query">Requête nommée</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">
            {sourceType === 'procedure' ? 'Nom de la procédure' : 'Nom de la requête'}
          </Label>
          <Input
            className="h-8 text-xs"
            placeholder={
              sourceType === 'procedure'
                ? 'reporting.get_client_balance'
                : 'commandes_en_attente'
            }
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Nom du rapport</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Rapport_Clients_2026"
            value={reportName}
            onChange={(e) => setReportName(e.target.value)}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Format d'export</Label>
          <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as 'xlsx' | 'csv' | 'pdf')}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="xlsx">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV (.csv)</SelectItem>
              <SelectItem value="pdf">PDF (.pdf)</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}
