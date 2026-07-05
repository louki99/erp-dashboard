import type { ReportPreviewResponse } from '@/types/reports.types';

interface Props {
  preview: ReportPreviewResponse | null;
  isPending: boolean;
}

export function PreviewTable({ preview, isPending }: Props) {
  if (isPending) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
        Chargement de l'aperçu…
      </div>
    );
  }

  if (!preview) {
    return (
      <div className="flex items-center justify-center h-32 text-sm text-muted-foreground border rounded-md border-dashed">
        Configurez la source puis cliquez sur <strong className="mx-1">Aperçu</strong>
      </div>
    );
  }

  const { sample, total_rows } = preview;
  if (sample.length === 0) {
    return (
      <div className="flex items-center justify-center h-24 text-sm text-muted-foreground">
        Aucune donnée retournée.
      </div>
    );
  }

  const columns = Object.keys(sample[0]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          Aperçu — {sample.length} lignes sur {total_rows.toLocaleString('fr-FR')} au total
        </span>
      </div>

      <div className="overflow-auto rounded-md border max-h-80">
        <table className="w-full text-xs">
          <thead className="sticky top-0 bg-muted">
            <tr>
              {columns.map((col) => (
                <th key={col} className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y">
            {sample.map((row, i) => (
              <tr key={i} className="hover:bg-muted/50">
                {columns.map((col) => (
                  <td key={col} className="px-3 py-1.5 whitespace-nowrap">
                    {String(row[col] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
