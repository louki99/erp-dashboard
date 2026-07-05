import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useReportConfigStore } from '@/stores/report-config-store';
import { useThemes } from '@/hooks/reporting/use-reports';

export function StylePanel() {
  const { theme, style, setTheme, setStyle } = useReportConfigStore();
  const { data: themes = [], isPending } = useThemes();

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs">Thème</Label>
        <Select value={theme} onValueChange={setTheme} disabled={isPending}>
          <SelectTrigger className="h-8 text-xs">
            <SelectValue placeholder={isPending ? 'Chargement…' : 'Sélectionner un thème'} />
          </SelectTrigger>
          <SelectContent>
            {themes.map((t) => (
              <SelectItem key={t} value={t} className="text-xs">{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Titre du rapport</Label>
          <Input
            className="h-8 text-xs"
            value={style.title ?? ''}
            onChange={(e) => setStyle({ title: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Police</Label>
          <Input
            className="h-8 text-xs"
            placeholder="Calibri"
            value={style.font_family ?? ''}
            onChange={(e) => setStyle({ font_family: e.target.value })}
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Couleur en-tête (texte)</Label>
          <div className="flex gap-1">
            <input
              type="color"
              className="h-8 w-10 rounded border cursor-pointer"
              value={style.header_font_color ?? '#FFFFFF'}
              onChange={(e) => setStyle({ header_font_color: e.target.value })}
            />
            <Input
              className="h-8 flex-1 text-xs"
              value={style.header_font_color ?? ''}
              onChange={(e) => setStyle({ header_font_color: e.target.value })}
            />
          </div>
        </div>

        <div className="space-y-1">
          <Label className="text-xs">Couleur en-tête (fond)</Label>
          <div className="flex gap-1">
            <input
              type="color"
              className="h-8 w-10 rounded border cursor-pointer"
              value={style.header_bg_color ?? '#1F4E79'}
              onChange={(e) => setStyle({ header_bg_color: e.target.value })}
            />
            <Input
              className="h-8 flex-1 text-xs"
              value={style.header_bg_color ?? ''}
              onChange={(e) => setStyle({ header_bg_color: e.target.value })}
            />
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        {[
          { key: 'freeze_header',     label: 'Figer l\'en-tête' },
          { key: 'autofit_columns',   label: 'Ajuster largeurs' },
          { key: 'enable_autofilter', label: 'Autofiltre' },
          { key: 'show_totals_row',   label: 'Ligne totaux' },
        ].map(({ key, label }) => (
          <label key={key} className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(style[key as keyof typeof style])}
              onChange={(e) => setStyle({ [key]: e.target.checked })}
            />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}
