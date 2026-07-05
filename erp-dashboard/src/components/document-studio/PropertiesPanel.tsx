import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useDesignerStore } from '@/stores/designer-store';

const BINDINGS_HINT = [
  '{{company.name}}', '{{company.logo_url}}',
  '{{customer.name}}', '{{customer.address}}',
  '{{invoice.number}}', '{{invoice.total}}', '{{invoice.items[]}}',
  '{{order.number}}', '{{order.total}}',
  '{{delivery_note.number}}',
  '{{sf_params.locale}}',
];

export function PropertiesPanel() {
  const { elements, selectedId, updateElement, removeElement } = useDesignerStore();
  const el = elements.find((e) => e.id === selectedId);

  if (!el) {
    return (
      <div className="w-52 shrink-0 border-l bg-muted/20 flex items-center justify-center p-4">
        <p className="text-xs text-muted-foreground text-center">
          Sélectionnez un élément pour éditer ses propriétés
        </p>
      </div>
    );
  }

  const upd = (patch: Parameters<typeof updateElement>[1]) => updateElement(el.id, patch);
  const updStyle = (patch: Partial<typeof el.style>) => upd({ style: { ...el.style, ...patch } });

  return (
    <div className="w-52 shrink-0 border-l bg-background overflow-y-auto p-3 space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {el.type}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive"
          onClick={() => removeElement(el.id)}
        >
          ✕
        </Button>
      </div>

      <section className="space-y-2">
        <p className="text-xs font-medium">Position & Taille</p>
        <div className="grid grid-cols-2 gap-1.5">
          {(['x', 'y', 'width', 'height'] as const).map((k) => (
            <div key={k} className="space-y-0.5">
              <Label className="text-[10px] uppercase">{k}</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={el[k]}
                onChange={(e) => upd({ [k]: Number(e.target.value) })}
              />
            </div>
          ))}
          <div className="space-y-0.5">
            <Label className="text-[10px] uppercase">Rotation</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={el.rotation}
              onChange={(e) => upd({ rotation: Number(e.target.value) })}
            />
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px] uppercase">Z-index</Label>
            <Input
              type="number"
              className="h-7 text-xs"
              value={el.z_index}
              onChange={(e) => upd({ z_index: Number(e.target.value) })}
            />
          </div>
        </div>
      </section>

      {(el.type === 'text' || el.type === 'current_date' || el.type === 'page_number') && (
        <section className="space-y-2">
          <p className="text-xs font-medium">Binding</p>
          <Input
            className="h-7 text-xs font-mono"
            placeholder="{{invoice.number}}"
            value={el.binding ?? ''}
            onChange={(e) => upd({ binding: e.target.value })}
          />
          <div className="flex flex-wrap gap-1">
            {BINDINGS_HINT.slice(0, 6).map((b) => (
              <button
                key={b}
                className="text-[9px] px-1 py-0.5 rounded bg-muted hover:bg-muted/80 font-mono"
                onClick={() => upd({ binding: b })}
              >
                {b}
              </button>
            ))}
          </div>
        </section>
      )}

      <section className="space-y-2">
        <p className="text-xs font-medium">Style</p>
        <div className="space-y-1.5">
          {el.style.font_size !== undefined && (
            <div className="space-y-0.5">
              <Label className="text-[10px]">Taille police</Label>
              <Input
                type="number"
                className="h-7 text-xs"
                value={el.style.font_size ?? 12}
                onChange={(e) => updStyle({ font_size: Number(e.target.value) })}
              />
            </div>
          )}

          <div className="space-y-0.5">
            <Label className="text-[10px]">Couleur texte</Label>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-7 w-9 rounded border cursor-pointer"
                value={el.style.color ?? '#000000'}
                onChange={(e) => updStyle({ color: e.target.value })}
              />
              <Input
                className="h-7 flex-1 text-xs"
                value={el.style.color ?? ''}
                onChange={(e) => updStyle({ color: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-0.5">
            <Label className="text-[10px]">Fond</Label>
            <div className="flex gap-1">
              <input
                type="color"
                className="h-7 w-9 rounded border cursor-pointer"
                value={el.style.background_color ?? '#ffffff'}
                onChange={(e) => updStyle({ background_color: e.target.value })}
              />
              <Input
                className="h-7 flex-1 text-xs"
                value={el.style.background_color ?? ''}
                onChange={(e) => updStyle({ background_color: e.target.value })}
              />
            </div>
          </div>

          <div className="flex gap-2">
            {[
              { key: 'bold',      label: 'G' },
              { key: 'italic',    label: 'I' },
              { key: 'underline', label: 'U' },
            ].map(({ key, label }) => (
              <button
                key={key}
                className={`h-7 w-7 text-xs rounded border font-medium ${
                  el.style[key as 'bold' | 'italic' | 'underline']
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background'
                }`}
                onClick={() => updStyle({ [key]: !el.style[key as 'bold' | 'italic' | 'underline'] })}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="space-y-2">
        <p className="text-xs font-medium">Visibilité</p>
        <div className="flex gap-3">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={el.visible}
              onChange={(e) => upd({ visible: e.target.checked })}
            />
            Visible
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={el.locked}
              onChange={(e) => upd({ locked: e.target.checked })}
            />
            Verrouillé
          </label>
        </div>
      </section>
    </div>
  );
}
