import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportConfigStore } from '@/stores/report-config-store';
import type { FilterOperator, ReportFilter } from '@/types/reports.types';

const OPERATORS: { value: FilterOperator; label: string }[] = [
  { value: 'eq',           label: '= égal' },
  { value: 'neq',          label: '≠ différent' },
  { value: 'gt',           label: '> supérieur' },
  { value: 'gte',          label: '>= supérieur ou égal' },
  { value: 'lt',           label: '< inférieur' },
  { value: 'lte',          label: '<= inférieur ou égal' },
  { value: 'contains',     label: 'contient' },
  { value: 'starts_with',  label: 'commence par' },
  { value: 'ends_with',    label: 'finit par' },
  { value: 'in',           label: 'dans (valeurs séparées par ,)' },
  { value: 'not_in',       label: 'pas dans' },
  { value: 'between',      label: 'entre' },
  { value: 'is_null',      label: 'est vide' },
  { value: 'is_not_null',  label: 'n\'est pas vide' },
];

const NO_VALUE_OPS: FilterOperator[] = ['is_null', 'is_not_null'];
const BETWEEN_OPS:  FilterOperator[] = ['between'];
const MULTI_OPS:    FilterOperator[] = ['in', 'not_in'];

export function FilterBuilder() {
  const { filters, filterLogic, addFilter, updateFilter, removeFilter, setFilterLogic } =
    useReportConfigStore();

  const handleAdd = () => {
    addFilter({ column: '', operator: 'eq', value: '' });
  };

  const update = (i: number, patch: Partial<ReportFilter>) => {
    updateFilter(i, { ...filters[i], ...patch });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium">Filtres dynamiques</span>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Logique :</span>
          <Select value={filterLogic} onValueChange={(v) => setFilterLogic(v as 'AND' | 'OR')}>
            <SelectTrigger className="h-7 w-20 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="AND">ET</SelectItem>
              <SelectItem value="OR">OU</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleAdd}>
            + Ajouter un filtre
          </Button>
        </div>
      </div>

      {filters.length > 0 && (
        <div className="rounded-md border divide-y">
          {filters.map((f, i) => (
            <div key={i} className="flex items-center gap-2 p-2">
              <Input
                className="h-8 w-32 text-xs"
                placeholder="Colonne"
                value={f.column}
                onChange={(e) => update(i, { column: e.target.value })}
              />

              <Select
                value={f.operator}
                onValueChange={(v) => update(i, { operator: v as FilterOperator, value: '', value_to: undefined, values: undefined })}
              >
                <SelectTrigger className="h-8 w-48 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {OPERATORS.map((op) => (
                    <SelectItem key={op.value} value={op.value} className="text-xs">
                      {op.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {!NO_VALUE_OPS.includes(f.operator) && (
                <>
                  {MULTI_OPS.includes(f.operator) ? (
                    <Input
                      className="h-8 flex-1 text-xs"
                      placeholder="val1,val2,val3"
                      value={f.values?.join(',') ?? ''}
                      onChange={(e) => update(i, { values: e.target.value.split(',').map((v) => v.trim()) })}
                    />
                  ) : BETWEEN_OPS.includes(f.operator) ? (
                    <>
                      <Input
                        className="h-8 w-24 text-xs"
                        placeholder="De"
                        value={String(f.value ?? '')}
                        onChange={(e) => update(i, { value: e.target.value })}
                      />
                      <span className="text-xs text-muted-foreground">→</span>
                      <Input
                        className="h-8 w-24 text-xs"
                        placeholder="À"
                        value={String(f.value_to ?? '')}
                        onChange={(e) => update(i, { value_to: e.target.value })}
                      />
                    </>
                  ) : (
                    <Input
                      className="h-8 flex-1 text-xs"
                      placeholder="Valeur"
                      value={String(f.value ?? '')}
                      onChange={(e) => update(i, { value: e.target.value })}
                    />
                  )}
                </>
              )}

              <Button
                variant="ghost"
                size="sm"
                className="h-8 w-8 p-0 text-destructive"
                onClick={() => removeFilter(i)}
              >
                ✕
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
