import { useState } from 'react';
import { nanoid } from 'nanoid';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { useDesignerStore } from '@/stores/designer-store';
import type { DesignerElement } from '@/types/document-studio.types';

const MM_TO_PX = 3.7795275591;

function estimateTextWidth(text: string, fontSize: number): number {
  return Math.round(text.length * fontSize * 0.6 + 16);
}

function resolveMock(binding: string, testData: Record<string, unknown>): string {
  if (!binding) return '';
  const inner = binding.replace(/\{\{|\}\}/g, '').trim();
  const varPath = inner.split('|')[0].trim();
  const parts = varPath.split('.');
  let val: unknown = testData;
  for (const p of parts) {
    if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
    else return binding;
  }
  return val != null ? String(val) : binding;
}

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
};

function elementLabel(el: DesignerElement): string {
  if (el.binding) return el.binding;
  const content = el.properties?.content;
  if (typeof content === 'string' && content) return content;
  return el.type;
}

function elementOverlaps(el: DesignerElement, elements: DesignerElement[]): boolean {
  for (const other of elements) {
    if (other.id === el.id) continue;
    const xOverlap = Math.min(el.x + el.width, other.x + other.width) - Math.max(el.x, other.x);
    const yOverlap = Math.min(el.y + el.height, other.y + other.height) - Math.max(el.y, other.y);
    if (xOverlap > 1 && yOverlap > 1) return true;
  }
  return false;
}

// ── Internal accordion section ────────────────────────────────────────────────

function Section({
  title,
  open,
  onToggle,
  children,
}: {
  title:    string;
  open:     boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border-b">
      <button
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50"
        onClick={onToggle}
      >
        {title}
        <span className="text-gray-300">{open ? '▲' : '▼'}</span>
      </button>
      {open && <div className="px-3 pb-3 space-y-2">{children}</div>}
    </div>
  );
}

// ── Color row helper ──────────────────────────────────────────────────────────

function ColorRow({
  label,
  value,
  onChange,
}: {
  label:    string;
  value:    string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-0.5">
      <Label className="text-[10px]">{label}</Label>
      <div className="flex gap-1">
        <input
          type="color"
          className="h-7 w-9 rounded border cursor-pointer p-0.5"
          value={value || '#000000'}
          onChange={(e) => onChange(e.target.value)}
        />
        <Input
          className="h-7 flex-1 text-xs font-mono"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    </div>
  );
}

// ── Global settings (no element selected) ────────────────────────────────────

function GlobalSettings() {
  const { page, setPage, version, elements, addElement } = useDesignerStore();
  const variables: string[] = version?.variables ?? [];

  // Group variables by first segment
  const groups: Record<string, string[]> = {};
  for (const v of variables) {
    const key = v.split('.')[0] ?? 'other';
    if (!groups[key]) groups[key] = [];
    groups[key].push(v);
  }

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});

  const toggleGroup = (key: string) =>
    setOpenGroups((prev) => ({ ...prev, [key]: !prev[key] }));

  const handleAddVar = (v: string) => {
    const binding = '{{' + v + '}}';
    const fontSize = 12;
    const width = Math.max(160, Math.round(binding.length * fontSize * 0.6 + 16));
    addElement({
      id:         nanoid(),
      type:       'text',
      x:          20,
      y:          20,
      width,
      height:     26,
      rotation:   0,
      opacity:    1,
      z_index:    elements.length,
      visible:    true,
      locked:     false,
      binding,
      properties: {},
      style:      { font_size: fontSize, color: '#000000' },
    });
  };

  return (
    <div className="space-y-0">
      {/* ── Document section ── */}
      <div className="border-b px-3 py-2">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">
          Document
        </p>

        {/* Format */}
        <div className="space-y-1 mb-2">
          <Label className="text-[10px]">Format</Label>
          <Select
            value={page.format}
            onValueChange={(v) => setPage({ ...page, format: v as 'A4' | 'A5' | 'letter' })}
          >
            <SelectTrigger className="h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="A4">A4</SelectItem>
              <SelectItem value="A5">A5</SelectItem>
              <SelectItem value="letter">Letter</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Orientation */}
        <div className="space-y-1 mb-2">
          <Label className="text-[10px]">Orientation</Label>
          <div className="flex gap-1">
            {(['portrait', 'landscape'] as const).map((o) => (
              <button
                key={o}
                onClick={() => setPage({ ...page, orientation: o })}
                className={`flex-1 py-1 text-[10px] font-medium rounded border transition-colors ${
                  page.orientation === o
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {o === 'portrait' ? 'Portrait' : 'Paysage'}
              </button>
            ))}
          </div>
        </div>

        {/* Margins */}
        <div className="space-y-1">
          <Label className="text-[10px]">Marges (mm)</Label>
          <div className="grid grid-cols-2 gap-1">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-gray-400">Haut</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.margin_top}
                onChange={(e) => setPage({ ...page, margin_top: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-gray-400">Droite</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.margin_right}
                onChange={(e) => setPage({ ...page, margin_right: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-gray-400">Bas</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.margin_bottom}
                onChange={(e) => setPage({ ...page, margin_bottom: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-gray-400">Gauche</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.margin_left}
                onChange={(e) => setPage({ ...page, margin_left: Number(e.target.value) })}
              />
            </div>
          </div>
        </div>

        {/* Bands */}
        <div className="space-y-1">
          <Label className="text-[10px]">Bandes (mm)</Label>
          <div className="grid grid-cols-2 gap-1">
            <div className="space-y-0.5">
              <Label className="text-[9px] text-indigo-400">▲ En-tête</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.header_height ?? 45}
                onChange={(e) => setPage({ ...page, header_height: Number(e.target.value) })}
              />
            </div>
            <div className="space-y-0.5">
              <Label className="text-[9px] text-amber-500">▼ Pied de page</Label>
              <Input
                type="number"
                className="h-6 text-xs"
                value={page.footer_height ?? 40}
                onChange={(e) => setPage({ ...page, footer_height: Number(e.target.value) })}
              />
            </div>
          </div>
          <p className="text-[9px] text-gray-400 leading-snug">
            Les séparateurs sont aussi déplaçables directement sur le canvas.
          </p>
        </div>
      </div>

      {/* ── Variables section ── */}
      <div className="px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">
            Variables
          </p>
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500 font-medium">
            {variables.length}
          </span>
        </div>

        {variables.length === 0 ? (
          <p className="text-[10px] text-gray-400 italic">Aucune variable définie</p>
        ) : (
          <div className="space-y-1">
            {Object.entries(groups).map(([groupKey, vars]) => (
              <div key={groupKey} className="border rounded overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-2 py-1 text-[10px] font-semibold text-gray-600 bg-gray-50 hover:bg-gray-100"
                  onClick={() => toggleGroup(groupKey)}
                >
                  <span>{groupKey}</span>
                  <span className="flex items-center gap-1">
                    <span className="text-gray-300">{vars.length}</span>
                    <span className="text-gray-300">{openGroups[groupKey] ? '▲' : '▼'}</span>
                  </span>
                </button>
                {openGroups[groupKey] && (
                  <div className="divide-y">
                    {vars.map((v) => (
                      <button
                        key={v}
                        className="w-full text-left px-2 py-1 text-[9px] font-mono text-blue-600 hover:bg-blue-50 transition-colors"
                        title="Cliquer pour ajouter au canvas"
                        onClick={() => handleAddVar(v)}
                      >
                        {'{{'}{v}{'}}'}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Element properties panel ──────────────────────────────────────────────────

function ElementProperties({ el }: { el: DesignerElement }) {
  const { page, version, updateElement, removeElement, previewMode, testData } = useDesignerStore();

  const [sections, setSections] = useState<Record<string, boolean>>({
    geometry:   true,
    style:      true,
    binding:    true,
    visibility: false,
  });

  const toggleSection = (key: string) =>
    setSections((prev) => ({ ...prev, [key]: !prev[key] }));

  const upd = (patch: Partial<DesignerElement>) => updateElement(el.id, patch);
  const updStyle = (patch: Partial<DesignerElement['style']>) =>
    upd({ style: { ...el.style, ...patch } });

  const isText = el.type === 'text' || el.type === 'current_date' || el.type === 'page_number';
  const isStrokable = el.type === 'rectangle' || el.type === 'line';

  // Page dimensions in px
  const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;
  const pageWidthPx  = (page.orientation === 'landscape' ? dims.h : dims.w) * MM_TO_PX;
  const pageHeightPx = (page.orientation === 'landscape' ? dims.w : dims.h) * MM_TO_PX;

  const variables: string[] = version?.variables ?? [];

  return (
    <div className="flex flex-col">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 py-2 border-b shrink-0">
        <span className="text-[10px] font-semibold uppercase tracking-wide bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
          {el.type}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 w-6 p-0 text-destructive hover:bg-red-50"
          onClick={() => removeElement(el.id)}
        >
          ✕
        </Button>
      </div>

      <div>
        {/* ── Geometry ── */}
        <Section
          title="Géométrie"
          open={sections.geometry}
          onToggle={() => toggleSection('geometry')}
        >
          {/* X Y W H grid */}
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

          {/* Auto-width for text elements */}
          {isText && (
            <div className="space-y-0.5">
              <Label className="text-[10px]">Largeur</Label>
              <button
                type="button"
                onClick={() => {
                  const fontSize = el.style.font_size ?? 12;
                  const text =
                    previewMode && el.binding
                      ? resolveMock(el.binding, testData)
                      : el.binding || (el.properties?.content as string) || '';
                  const newW = estimateTextWidth(text, fontSize);
                  upd({ width: Math.max(40, Math.min(newW, pageWidthPx - el.x - 20)) });
                }}
                className="w-full h-7 text-[10px] rounded border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors font-medium"
              >
                Ajuster à la largeur du texte
              </button>
            </div>
          )}

          {/* Alignment tools */}
          <div className="space-y-0.5">
            <Label className="text-[10px]">Alignement</Label>
            <div className="grid grid-cols-6 gap-0.5">
              {[
                {
                  title: 'Aligner à gauche',
                  label: '|←',
                  action: () => upd({ x: Math.round((page.margin_left ?? 10) * MM_TO_PX) }),
                },
                {
                  title: 'Centrer horizontalement',
                  label: '↔',
                  action: () => upd({ x: Math.round((pageWidthPx - el.width) / 2) }),
                },
                {
                  title: 'Aligner à droite',
                  label: '→|',
                  action: () => upd({ x: Math.round(pageWidthPx - (page.margin_right ?? 10) * MM_TO_PX - el.width) }),
                },
                {
                  title: 'Aligner en haut',
                  label: '↑|',
                  action: () => upd({ y: Math.round((page.margin_top ?? 10) * MM_TO_PX) }),
                },
                {
                  title: 'Centrer verticalement',
                  label: '↕',
                  action: () => upd({ y: Math.round((pageHeightPx - el.height) / 2) }),
                },
                {
                  title: 'Aligner en bas',
                  label: '↓|',
                  action: () => upd({ y: Math.round(pageHeightPx - (page.margin_bottom ?? 10) * MM_TO_PX - el.height) }),
                },
              ].map(({ title, label, action }) => (
                <button
                  key={title}
                  title={title}
                  onClick={action}
                  className="h-7 text-[10px] rounded border border-gray-200 hover:bg-gray-100 hover:border-gray-300 transition-colors font-mono"
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        {/* ── Style ── */}
        <Section
          title="Style"
          open={sections.style}
          onToggle={() => toggleSection('style')}
        >
          {/* Font size (only when defined) */}
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

          {/* Text color */}
          <ColorRow
            label="Couleur texte"
            value={el.style.color ?? '#000000'}
            onChange={(v) => updStyle({ color: v })}
          />

          {/* Background */}
          <ColorRow
            label="Fond"
            value={el.style.background_color ?? '#ffffff'}
            onChange={(v) => updStyle({ background_color: v })}
          />

          {/* Stroke (rectangle / line only) */}
          {isStrokable && (
            <>
              <ColorRow
                label="Contour"
                value={el.style.border_color ?? '#374151'}
                onChange={(v) => updStyle({ border_color: v })}
              />
              <div className="space-y-0.5">
                <Label className="text-[10px]">Épaisseur contour</Label>
                <Input
                  type="number"
                  className="h-7 text-xs"
                  value={el.style.border_width ?? 1}
                  onChange={(e) => updStyle({ border_width: Number(e.target.value) })}
                />
              </div>
            </>
          )}

          {/* Bold / Italic / Underline (text types only) */}
          {isText && (
            <div className="flex gap-1">
              {([
                { key: 'bold'      as const, label: 'G' },
                { key: 'italic'    as const, label: 'I' },
                { key: 'underline' as const, label: 'U' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  title={key}
                  className={`h-7 w-7 text-xs rounded border font-medium transition-colors ${
                    el.style[key]
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => updStyle({ [key]: !el.style[key] })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Text align (text types only) */}
          {isText && (
            <div className="flex gap-1">
              {([
                { key: 'left'    as const, label: 'L' },
                { key: 'center'  as const, label: 'C' },
                { key: 'right'   as const, label: 'R' },
                { key: 'justify' as const, label: 'J' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  title={`Align ${key}`}
                  className={`flex-1 h-7 text-xs rounded border font-medium transition-colors ${
                    el.style.alignment === key
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-white border-gray-200 hover:bg-gray-50'
                  }`}
                  onClick={() => updStyle({ alignment: key })}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </Section>

        {/* ── Binding (text types only) ── */}
        {isText && (
          <Section
            title="Binding"
            open={sections.binding}
            onToggle={() => toggleSection('binding')}
          >
            <Input
              className="h-7 text-xs font-mono"
              placeholder="{{invoice.number}}"
              value={el.binding ?? ''}
              onChange={(e) => upd({ binding: e.target.value })}
            />
            {variables.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {variables.slice(0, 8).map((v) => (
                  <button
                    key={v}
                    className="text-[9px] px-1 py-0.5 rounded bg-gray-100 hover:bg-blue-50 hover:text-blue-700 font-mono transition-colors"
                    onClick={() => upd({ binding: '{{' + v + '}}' })}
                  >
                    {'{{'}{v}{'}}'}
                  </button>
                ))}
              </div>
            )}
          </Section>
        )}

        {/* ── Visibility ── */}
        <Section
          title="Visibilité"
          open={sections.visibility}
          onToggle={() => toggleSection('visibility')}
        >
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
        </Section>
      </div>
    </div>
  );
}

// ── Layers panel ──────────────────────────────────────────────────────────────

function LayersPanel() {
  const { elements, selectedId, selectElement, updateElement, removeElement } = useDesignerStore();
  const [open, setOpen] = useState(true);

  const sorted = [...elements].sort((a, b) => (b.z_index ?? 0) - (a.z_index ?? 0));

  return (
    <div className="flex flex-col h-52 shrink-0 border-t bg-white">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-500 hover:bg-gray-50 border-b shrink-0"
      >
        <span className="flex items-center gap-2">
          Calques
          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
            {elements.length}
          </span>
        </span>
        <span className="text-gray-300">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="flex-1 overflow-y-auto">
          {sorted.length === 0 ? (
            <p className="text-[10px] text-gray-400 italic p-3">Aucun élément</p>
          ) : (
            <div className="divide-y">
              {sorted.map((el) => {
                const label = elementLabel(el);
                const isSelected = el.id === selectedId;
                const overlapping = elementOverlaps(el, elements);
                return (
                  <div
                    key={el.id}
                    onClick={() => selectElement(el.id)}
                    className={`group flex items-center gap-2 px-2 py-1.5 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="text-[10px] w-4 text-center text-gray-400">
                      {el.type === 'text' && 'T'}
                      {el.type === 'rectangle' && '▭'}
                      {el.type === 'line' && '—'}
                      {el.type === 'image' && '🖼'}
                      {el.type === 'table' && '⊞'}
                      {el.type === 'qr_code' && '⊡'}
                      {el.type === 'barcode' && 'B'}
                      {el.type === 'current_date' && '📅'}
                      {el.type === 'page_number' && '#'}
                    </span>

                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] font-medium text-gray-700 truncate" title={label}>
                        {label}
                      </p>
                      <p className="text-[9px] text-gray-400 truncate">
                        {el.type} · {Math.round(el.x)},{Math.round(el.y)} · {Math.round(el.width)}×{Math.round(el.height)}
                      </p>
                    </div>

                    {overlapping && (
                      <span className="w-2 h-2 rounded-full bg-red-500" title="Chevauchement détecté" />
                    )}

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateElement(el.id, { visible: !el.visible });
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-700"
                      title={el.visible ? 'Masquer' : 'Afficher'}
                    >
                      {el.visible ? '👁' : '🚫'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        updateElement(el.id, { locked: !el.locked });
                      }}
                      className="text-[10px] text-gray-400 hover:text-gray-700"
                      title={el.locked ? 'Déverrouiller' : 'Verrouiller'}
                    >
                      {el.locked ? '🔒' : '🔓'}
                    </button>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        removeElement(el.id);
                      }}
                      className="text-[10px] text-red-400 hover:text-red-600"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Public component ──────────────────────────────────────────────────────────

export function PropertiesPanel() {
  const { elements, selectedId } = useDesignerStore();
  const el = elements.find((e) => e.id === selectedId);

  return (
    <div className="w-72 shrink-0 border-l bg-white flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0">
        {el ? <ElementProperties el={el} /> : <GlobalSettings />}
      </div>
      <LayersPanel />
    </div>
  );
}
