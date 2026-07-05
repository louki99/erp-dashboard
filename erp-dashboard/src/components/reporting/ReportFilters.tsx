import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import type { ParameterField, ParameterOption } from '@/types/reports.types';

// Backend sends options as string[] or {value,label}[] — normalise to objects
function normaliseOptions(raw: (ParameterOption | string)[]): ParameterOption[] {
  return raw.map((o) =>
    typeof o === 'string'
      ? { value: o, label: o.charAt(0).toUpperCase() + o.slice(1).replace(/_/g, ' ') }
      : o,
  );
}

const FIELD_TYPE_LABELS: Record<string, string> = {
  date:    'Date',
  select:  'Sélection',
  boolean: 'Oui/Non',
  number:  'Nombre',
  text:    'Texte',
};

interface FieldInputProps {
  field:    ParameterField;
  value:    unknown;
  onChange: (v: unknown) => void;
}

function FieldInput({ field, value, onChange }: FieldInputProps) {
  const strVal = value != null ? String(value) : '';

  switch (field.type) {
    case 'date':
      return (
        <Input
          type="date"
          className="h-9 text-sm"
          value={strVal}
          onChange={(e) => onChange(e.target.value || undefined)}
          required={field.required}
        />
      );

    case 'select': {
      const options = field.options ? normaliseOptions(field.options) : [];
      if (options.length > 0) {
        return (
          <Select
            value={strVal || '__all__'}
            onValueChange={(v) => onChange(v === '__all__' ? undefined : v)}
          >
            <SelectTrigger className="h-9 text-sm">
              <SelectValue placeholder="Tous" />
            </SelectTrigger>
            <SelectContent>
              {!field.required && (
                <SelectItem value="__all__">
                  <span className="text-muted-foreground">Tous</span>
                </SelectItem>
              )}
              {options.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        );
      }
      // No options — text input (will be replaced when options endpoint is wired)
      return (
        <Input
          type="text"
          className="h-9 text-sm"
          placeholder={field.placeholder ?? `Code ${field.label.toLowerCase()}`}
          value={strVal}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
    }

    case 'boolean':
      return (
        <div className="flex items-center h-9 gap-2">
          <input
            type="checkbox"
            id={field.key}
            className="h-4 w-4 rounded accent-primary cursor-pointer"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
          />
          <label htmlFor={field.key} className="text-sm cursor-pointer select-none">
            {field.label}
          </label>
        </div>
      );

    case 'number':
      return (
        <Input
          type="number"
          className="h-9 text-sm"
          placeholder={field.placeholder ?? '0'}
          value={strVal}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : undefined)}
        />
      );

    default:
      return (
        <Input
          type="text"
          className="h-9 text-sm"
          placeholder={field.placeholder ?? field.label}
          value={strVal}
          onChange={(e) => onChange(e.target.value || undefined)}
        />
      );
  }
}

interface Props {
  schema:   ParameterField[];
  values:   Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
}

export function ReportFilters({ schema, values, onChange }: Props) {
  if (schema.length === 0) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <span className="text-lg">✓</span>
        Ce rapport ne nécessite aucun paramètre — cliquez sur Aperçu pour lancer.
      </div>
    );
  }

  const required = schema.filter((f) => f.required);
  const optional = schema.filter((f) => !f.required);

  return (
    <div className="space-y-6">
      {required.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-foreground">
              Paramètres requis
            </span>
            <Badge variant="destructive" className="text-[10px] h-4 px-1.5">
              {required.length} champ{required.length > 1 ? 's' : ''}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {required.map((field) => (
              <FieldItem
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => onChange(field.key, v)}
              />
            ))}
          </div>
        </section>
      )}

      {optional.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Filtres optionnels
            </span>
            <span className="text-[10px] text-muted-foreground">(laissez vide pour tout inclure)</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-4">
            {optional.map((field) => (
              <FieldItem
                key={field.key}
                field={field}
                value={values[field.key]}
                onChange={(v) => onChange(field.key, v)}
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function FieldItem({
  field,
  value,
  onChange,
}: {
  field:    ParameterField;
  value:    unknown;
  onChange: (v: unknown) => void;
}) {
  const hasValue = value != null && value !== '' && value !== '__all__';

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label
          htmlFor={field.key}
          className={`text-sm font-medium ${field.required ? 'text-foreground' : 'text-muted-foreground'}`}
        >
          {field.label}
          {field.required && <span className="text-destructive ml-0.5">*</span>}
        </Label>
        <div className="flex items-center gap-1">
          {hasValue && (
            <button
              className="text-[10px] text-muted-foreground hover:text-foreground underline"
              onClick={() => onChange(undefined)}
            >
              Effacer
            </button>
          )}
          <span className="text-[9px] text-muted-foreground/50 uppercase">
            {FIELD_TYPE_LABELS[field.type] ?? field.type}
          </span>
        </div>
      </div>
      <FieldInput field={field} value={value} onChange={onChange} />
    </div>
  );
}
