import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { DesignerElement } from '@/types/document-studio.types';

/*
 * Quick-edit modal opened from the canvas context menu ("Modifier…").
 * Works on a local draft — nothing touches the store until "Enregistrer".
 */

const TYPE_LABELS: Record<string, string> = {
  text:         '✍️ Texte',
  rectangle:    '▭ Rectangle',
  line:         '— Ligne',
  image:        '🖼 Image',
  table:        '⊞ Tableau',
  qr_code:      '⊡ QR Code',
  barcode:      '▐▐ Code-barres',
  current_date: '📅 Date',
  page_number:  '# N° de page',
};

interface Props {
  element: DesignerElement;
  onClose: () => void;
  onSave:  (el: DesignerElement) => void;
}

export function ElementEditModal({ element, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<DesignerElement>(element);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setDraft(element), [element]);

  const upd = (patch: Partial<DesignerElement>) => setDraft((d) => ({ ...d, ...patch }));
  const updStyle = (patch: Partial<DesignerElement['style']>) =>
    setDraft((d) => ({ ...d, style: { ...d.style, ...patch } }));
  const updProps = (patch: Record<string, unknown>) =>
    setDraft((d) => ({ ...d, properties: { ...d.properties, ...patch } }));

  const isText = draft.type === 'text' || draft.type === 'current_date' || draft.type === 'page_number';
  const isShape = draft.type === 'rectangle' || draft.type === 'line';

  const handleImageFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => updProps({ src: reader.result as string });
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-md max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-sm">
            {TYPE_LABELS[draft.type] ?? draft.type}
            <span className="text-[10px] font-normal text-gray-400 font-mono">{draft.id.slice(0, 8)}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-1">
          {/* Name */}
          <div className="space-y-1">
            <Label className="text-xs">Nom (repère dans les calques)</Label>
            <Input
              className="h-8 text-xs"
              value={draft.name ?? ''}
              placeholder="ex: logo-entreprise"
              onChange={(e) => upd({ name: e.target.value || undefined })}
            />
          </div>

          {/* Content / binding */}
          {(isText || draft.type === 'table' || draft.type === 'qr_code' || draft.type === 'barcode') && (
            <div className="space-y-1">
              <Label className="text-xs">Binding (variable {'{{...}}'})</Label>
              <Input
                className="h-8 text-xs font-mono"
                value={draft.binding ?? ''}
                placeholder="{{company.name | default(&quot;...&quot;)}}"
                onChange={(e) => upd({ binding: e.target.value || undefined })}
              />
            </div>
          )}
          {isText && !draft.binding && (
            <div className="space-y-1">
              <Label className="text-xs">Texte statique</Label>
              <textarea
                className="w-full text-xs border border-gray-200 rounded-lg px-2.5 py-1.5 h-16 resize-none focus:outline-none focus:border-indigo-400"
                value={(draft.properties?.content as string) ?? ''}
                onChange={(e) => updProps({ content: e.target.value })}
              />
            </div>
          )}

          {/* Image source */}
          {draft.type === 'image' && (
            <div className="space-y-1">
              <Label className="text-xs">Image</Label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  className="flex-1 h-16 rounded-lg border border-dashed border-gray-300 hover:border-indigo-400 hover:bg-indigo-50/50 transition-colors flex items-center justify-center overflow-hidden"
                >
                  {draft.properties?.src ? (
                    <img src={draft.properties.src as string} alt="" className="max-h-full max-w-full object-contain" />
                  ) : (
                    <span className="text-xs text-gray-400">📁 Choisir une image…</span>
                  )}
                </button>
                {!!draft.properties?.src && (
                  <button
                    type="button"
                    onClick={() => updProps({ src: undefined })}
                    className="text-xs text-red-400 hover:text-red-600"
                  >
                    Retirer
                  </button>
                )}
              </div>
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
            </div>
          )}

          {/* Geometry */}
          <div className="space-y-1">
            <Label className="text-xs">Position & taille (px page)</Label>
            <div className="grid grid-cols-4 gap-2">
              {(['x', 'y', 'width', 'height'] as const).map((k) => (
                <div key={k} className="space-y-0.5">
                  <Label className="text-[9px] uppercase text-gray-400">{k === 'width' ? 'W' : k === 'height' ? 'H' : k}</Label>
                  <Input
                    type="number"
                    className="h-7 text-xs"
                    value={Math.round(draft[k])}
                    onChange={(e) => upd({ [k]: Number(e.target.value) } as Partial<DesignerElement>)}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Text style */}
          {isText && (
            <div className="space-y-2">
              <Label className="text-xs">Style du texte</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  className="h-7 w-16 text-xs"
                  title="Taille de police"
                  value={draft.style.font_size ?? 12}
                  onChange={(e) => updStyle({ font_size: Number(e.target.value) })}
                />
                {([
                  { key: 'bold' as const, label: 'B', cls: 'font-bold' },
                  { key: 'italic' as const, label: 'I', cls: 'italic' },
                  { key: 'underline' as const, label: 'U', cls: 'underline' },
                ]).map((b) => (
                  <button
                    key={b.key}
                    type="button"
                    onClick={() => updStyle({ [b.key]: !draft.style[b.key] })}
                    className={`h-7 w-7 rounded border text-xs ${b.cls} ${
                      draft.style[b.key]
                        ? 'bg-indigo-100 border-indigo-300 text-indigo-700'
                        : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                  >
                    {b.label}
                  </button>
                ))}
                <input
                  type="color"
                  title="Couleur du texte"
                  className="h-7 w-9 rounded border border-gray-200 cursor-pointer p-0.5"
                  value={draft.style.color ?? '#1a1a1a'}
                  onChange={(e) => updStyle({ color: e.target.value })}
                />
                <select
                  className="h-7 text-xs border border-gray-200 rounded px-1"
                  value={draft.style.alignment ?? 'left'}
                  onChange={(e) => updStyle({ alignment: e.target.value as 'left' | 'center' | 'right' })}
                >
                  <option value="left">Gauche</option>
                  <option value="center">Centre</option>
                  <option value="right">Droite</option>
                </select>
              </div>
            </div>
          )}

          {/* Shape style */}
          {isShape && (
            <div className="space-y-2">
              <Label className="text-xs">Style</Label>
              <div className="flex items-center gap-3">
                {draft.type === 'rectangle' && (
                  <label className="flex items-center gap-1.5 text-xs text-gray-500">
                    Fond
                    <input
                      type="color"
                      className="h-7 w-9 rounded border border-gray-200 cursor-pointer p-0.5"
                      value={draft.style.background_color ?? '#ffffff'}
                      onChange={(e) => updStyle({ background_color: e.target.value })}
                    />
                  </label>
                )}
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  Bordure
                  <input
                    type="color"
                    className="h-7 w-9 rounded border border-gray-200 cursor-pointer p-0.5"
                    value={draft.style.border_color ?? '#374151'}
                    onChange={(e) => updStyle({ border_color: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs text-gray-500">
                  Épaisseur
                  <Input
                    type="number"
                    className="h-7 w-14 text-xs"
                    value={draft.style.border_width ?? 1}
                    onChange={(e) => updStyle({ border_width: Number(e.target.value) })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end gap-2 pt-2 border-t">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="button"
              onClick={() => { onSave(draft); onClose(); }}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              Enregistrer
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
