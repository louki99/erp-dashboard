import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useReportDefinitions } from '@/hooks/reporting/use-reports';
import type { ReportDefinition } from '@/types/reports.types';

const CATEGORY_META: Record<string, { label: string; icon: string }> = {
  clients:  { label: 'Clients',    icon: '👥' },
  sales:    { label: 'Ventes',     icon: '📊' },
  visits:   { label: 'Visites',    icon: '🗺️' },
  delivery: { label: 'Livraisons', icon: '🚚' },
  treasury: { label: 'Trésorerie', icon: '💰' },
  stock:    { label: 'Stock',      icon: '📦' },
  hr:       { label: 'RH',         icon: '👤' },
};

function categoryMeta(key: string) {
  return CATEGORY_META[key] ?? { label: key.charAt(0).toUpperCase() + key.slice(1), icon: '📋' };
}

interface Props {
  onSelect: (definition: ReportDefinition) => void;
}

export function ReportCatalogue({ onSelect }: Props) {
  const [search, setSearch]         = useState('');
  const [activeCategory, setActive] = useState<string | null>(null);

  const { data: catalogue, isPending, isError } = useReportDefinitions();

  if (isPending) {
    return (
      <div className="flex flex-col gap-4 p-6">
        <div className="h-8 w-64 rounded bg-muted animate-pulse" />
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (isError || !catalogue) {
    return (
      <div className="flex items-center justify-center h-40 text-sm text-muted-foreground">
        Impossible de charger le catalogue de rapports.
      </div>
    );
  }

  const categories = Object.entries(catalogue);

  // Filter reports across all categories by search term
  const filteredCategories = categories
    .map(([key, reports]) => ({
      key,
      reports: reports.filter(
        (r) =>
          !search ||
          r.name.toLowerCase().includes(search.toLowerCase()) ||
          r.description?.toLowerCase().includes(search.toLowerCase()),
      ),
    }))
    .filter(({ reports }) => reports.length > 0);

  const displayed = activeCategory
    ? filteredCategories.filter((c) => c.key === activeCategory)
    : filteredCategories;

  return (
    <div className="flex flex-col gap-5">
      {/* Search + category pills */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          className="max-w-xs text-sm"
          placeholder="Rechercher un rapport…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          <button
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !activeCategory
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-background hover:bg-muted border-border'
            }`}
            onClick={() => setActive(null)}
          >
            Tous
          </button>
          {categories.map(([key]) => {
            const meta = categoryMeta(key);
            return (
              <button
                key={key}
                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                  activeCategory === key
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
                onClick={() => setActive(activeCategory === key ? null : key)}
              >
                {meta.icon} {meta.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Report cards grouped by category */}
      {displayed.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">
          Aucun rapport ne correspond à votre recherche.
        </p>
      )}

      {displayed.map(({ key, reports }) => {
        const meta = categoryMeta(key);
        return (
          <section key={key}>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              {meta.icon} {meta.label}
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {reports.map((report) => (
                <Card
                  key={report.code}
                  className="cursor-pointer hover:shadow-md hover:border-primary/50 transition-all group"
                  onClick={() => onSelect(report)}
                >
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm font-medium leading-snug group-hover:text-primary transition-colors">
                      {report.name}
                    </CardTitle>
                    {report.description && (
                      <CardDescription className="text-xs line-clamp-2">
                        {report.description}
                      </CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="pt-0">
                    <div className="flex flex-wrap gap-1">
                      {report.allowed_formats.map((fmt) => (
                        <Badge key={fmt} variant="outline" className="text-[10px] h-4 px-1">
                          {fmt.toUpperCase()}
                        </Badge>
                      ))}
                      {report.parameter_schema.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          {report.parameter_schema.filter((p) => p.required).length > 0
                            ? `${report.parameter_schema.filter((p) => p.required).length} filtre(s) requis`
                            : 'Filtres optionnels'}
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
