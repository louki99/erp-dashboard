import { useRef, useMemo, useState } from 'react';
import { useDesignerStore } from '@/stores/designer-store';
import { extractDefaultArg } from '@/components/document-studio/DesignerCanvas';
import type { DesignerElement } from '@/types/document-studio.types';

/*
 * Simple edit mode — "mirror form" panel.
 * The canvas is frozen; the admin edits company assets through classic form
 * fields and sees the result live on the canvas. Nothing here can move,
 * resize or delete an element, so the template layout cannot be broken.
 */

// ── Binding helpers ───────────────────────────────────────────────────────────

function bindingPath(binding: string): string {
  const inner = binding.replace(/\{\{|\}\}/g, '').trim();
  return inner.split('|')[0].trim();
}

// Literal string default("...") only — nested expressions like
// default(company.name | default("X")) are NOT editable (would be corrupted)
function bindingLiteralDefault(binding: string): string | undefined {
  return extractDefaultArg(binding)?.literal;
}

// Replace the exact default(<raw>) span with default("<value>"), preserving
// everything else in the binding (nested filters, spacing…)
function withBindingDefault(binding: string, value: string): string {
  const def = extractDefaultArg(binding);
  const escaped = value.replace(/"/g, '\\"');
  if (!def) {
    // No default yet — append one before the closing braces
    const inner = binding.replace(/\{\{|\}\}/g, '').trim();
    return `{{${inner} | default("${escaped}")}}`;
  }
  return binding.replace(`default(${def.raw})`, `default("${escaped}")`);
}

// ── Editable field extraction ─────────────────────────────────────────────────

interface EditableText {
  el: DesignerElement;
  kind: 'static' | 'binding-default';
  label: string;
  value: string;
}

function humanLabel(el: DesignerElement): string {
  if (el.name) return el.name;
  if (el.binding) return bindingPath(el.binding);
  const content = (el.properties?.content as string) ?? '';
  return content.length > 32 ? content.slice(0, 32) + '…' : content || 'Texte';
}

function extractEditableTexts(elements: DesignerElement[]): EditableText[] {
  const out: EditableText[] = [];
  for (const el of elements) {
    if (el.type !== 'text') continue;
    if (el.binding) {
      const def = bindingLiteralDefault(el.binding);
      // Only bindings with a literal default("...") are company-editable — the
      // default IS the company asset (name, address, footer text…). Pure data
      // bindings and nested expressions stay untouchable in simple mode.
      if (def !== undefined) {
        out.push({ el, kind: 'binding-default', label: humanLabel(el), value: def });
      }
    } else {
      const content = (el.properties?.content as string) ?? '';
      out.push({ el, kind: 'static', label: humanLabel(el), value: content });
    }
  }
  // Read order: top-to-bottom, left-to-right like the printed page
  return out.sort((a, b) => a.el.y - b.el.y || a.el.x - b.el.x);
}

// Collect distinct accent colors used across the template (skip neutrals)
const NEUTRALS = new Set(['', 'transparent', '#fff', '#ffffff', '#000', '#000000', 'white', 'black']);

function extractColors(elements: DesignerElement[]): { color: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const el of elements) {
    for (const c of [el.style.color, el.style.background_color, el.style.border_color]) {
      if (!c) continue;
      const norm = c.toLowerCase().trim();
      if (NEUTRALS.has(norm) || norm.startsWith('rgba(0')) continue;
      counts.set(norm, (counts.get(norm) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .map(([color, count]) => ({ color, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ icon, title, subtitle, children }: {
  icon: string; title: string; subtitle?: string; children: React.ReactNode;
}) {
  return (
    <div className="border-b border-gray-100">
      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-gray-800 flex items-center gap-2">
          <span>{icon}</span> {title}
        </p>
        {subtitle && <p className="text-[10px] text-gray-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="px-4 pb-4 space-y-3">{children}</div>
    </div>
  );
}

// ── Main panel ────────────────────────────────────────────────────────────────

export function SimpleEditPanel() {
  const {
    elements, selectedId, selectElement, updateElement, setElementsBulk,
  } = useDesignerStore();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadTarget, setUploadTarget] = useState<string | null>(null);

  const texts  = useMemo(() => extractEditableTexts(elements), [elements]);
  const images = useMemo(() => elements.filter((el) => el.type === 'image'), [elements]);
  const colors = useMemo(() => extractColors(elements), [elements]);

  const handleTextChange = (item: EditableText, value: string) => {
    if (item.kind === 'static') {
      updateElement(item.el.id, { properties: { ...item.el.properties, content: value } });
    } else {
      updateElement(item.el.id, { binding: withBindingDefault(item.el.binding!, value) });
    }
  };

  const triggerUpload = (elementId: string) => {
    setUploadTarget(elementId);
    fileInputRef.current?.click();
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !uploadTarget) return;
    const target = elements.find((el) => el.id === uploadTarget);
    if (!target) return;
    const reader = new FileReader();
    reader.onload = () => {
      updateElement(target.id, { properties: { ...target.properties, src: reader.result as string } });
    };
    reader.readAsDataURL(file);
  };

  // Replace one color everywhere (color / background / border) in a single undo step
  const handleColorReplace = (from: string, to: string) => {
    const swap = (c?: string) => (c && c.toLowerCase().trim() === from ? to : c);
    setElementsBulk(
      elements.map((el) => ({
        ...el,
        style: {
          ...el.style,
          color:            swap(el.style.color),
          background_color: swap(el.style.background_color),
          border_color:     swap(el.style.border_color),
        },
      })),
    );
  };

  return (
    <div className="w-72 shrink-0 border-l bg-white overflow-y-auto flex flex-col">
      {/* Mode banner */}
      <div className="px-4 py-3 bg-emerald-50 border-b border-emerald-100 shrink-0">
        <p className="text-xs font-semibold text-emerald-800 flex items-center gap-1.5">
          🔒 Mode édition simple
        </p>
        <p className="text-[10px] text-emerald-600 mt-0.5 leading-relaxed">
          La mise en page est verrouillée. Modifiez vos textes, logo et couleurs —
          le document se met à jour en direct.
        </p>
      </div>

      {/* Logo & images */}
      {images.length > 0 && (
        <Section icon="🖼" title="Logo & images" subtitle="Cliquez pour remplacer l'image">
          {images.map((el) => {
            const src = el.properties?.src as string | undefined;
            return (
              <div
                key={el.id}
                className={`rounded-lg border transition-colors ${
                  selectedId === el.id ? 'border-indigo-300 ring-1 ring-indigo-200' : 'border-gray-200'
                }`}
              >
                <button
                  onClick={() => { selectElement(el.id); triggerUpload(el.id); }}
                  className="w-full h-20 flex items-center justify-center rounded-t-lg bg-slate-50 hover:bg-slate-100 transition-colors overflow-hidden"
                >
                  {src ? (
                    <img src={src} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-slate-400">📁 Choisir une image…</span>
                  )}
                </button>
                <div className="flex items-center justify-between px-2.5 py-1.5 border-t border-gray-100">
                  <span className="text-[10px] text-gray-500 truncate">
                    {el.name || el.binding || `Image ${Math.round(el.width)}×${Math.round(el.height)}`}
                  </span>
                  {src && (
                    <button
                      onClick={() => updateElement(el.id, { properties: { ...el.properties, src: undefined } })}
                      className="text-[10px] text-red-400 hover:text-red-600 shrink-0 ml-2"
                    >
                      Retirer
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </Section>
      )}

      {/* Texts */}
      <Section
        icon="✍️"
        title="Textes du document"
        subtitle={texts.length ? 'Cliquez sur un champ pour le repérer sur la page' : undefined}
      >
        {texts.length === 0 ? (
          <p className="text-[11px] text-gray-400">Aucun texte modifiable dans ce template.</p>
        ) : (
          texts.map((item) => (
            <div key={item.el.id} className="space-y-1">
              <label className="text-[10px] font-medium text-gray-500 flex items-center gap-1.5">
                {item.label}
                {item.kind === 'binding-default' && (
                  <span className="px-1.5 py-px rounded-full bg-sky-50 text-sky-600 border border-sky-100 text-[9px] font-mono">
                    défaut
                  </span>
                )}
              </label>
              {item.value.length > 60 ? (
                <textarea
                  value={item.value}
                  rows={3}
                  onFocus={() => selectElement(item.el.id)}
                  onChange={(e) => handleTextChange(item, e.target.value)}
                  className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 resize-none focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              ) : (
                <input
                  value={item.value}
                  onFocus={() => selectElement(item.el.id)}
                  onChange={(e) => handleTextChange(item, e.target.value)}
                  className="w-full h-8 text-xs border border-gray-200 rounded-lg px-2.5 focus:outline-none focus:border-indigo-400 focus:ring-1 focus:ring-indigo-200"
                />
              )}
            </div>
          ))
        )}
      </Section>

      {/* Theme colors */}
      {colors.length > 0 && (
        <Section icon="🎨" title="Couleurs du thème" subtitle="Remplace la couleur partout dans le document">
          {colors.map(({ color, count }) => (
            <div key={color} className="flex items-center gap-2.5">
              <input
                type="color"
                value={/^#[0-9a-f]{6}$/i.test(color) ? color : '#000000'}
                onChange={(e) => handleColorReplace(color, e.target.value)}
                className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
              />
              <div className="min-w-0">
                <p className="text-[11px] font-mono text-gray-600">{color}</p>
                <p className="text-[9px] text-gray-400">{count} élément{count > 1 ? 's' : ''}</p>
              </div>
            </div>
          ))}
        </Section>
      )}

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
    </div>
  );
}
