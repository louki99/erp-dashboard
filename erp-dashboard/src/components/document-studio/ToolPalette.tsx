import { nanoid } from 'nanoid';
import { useDesignerStore } from '@/stores/designer-store';
import type { DesignerElement, ElementType } from '@/types/document-studio.types';

export const TOOL_DRAG_TYPE = 'application/x-document-studio-tool';

const TOOLS: { type: ElementType; label: string; icon: string }[] = [
  { type: 'text',         label: 'Texte',        icon: 'T'  },
  { type: 'rectangle',    label: 'Rectangle',    icon: '◻'  },
  { type: 'line',         label: 'Ligne',        icon: '▬'  },
  { type: 'image',        label: 'Image',        icon: '🖼' },
  { type: 'table',        label: 'Tableau',      icon: '▦'  },
  { type: 'qr_code',      label: 'QR Code',      icon: '▣'  },
  { type: 'barcode',      label: 'Code-barres',  icon: 'B'  },
  { type: 'current_date', label: 'Date',         icon: '📅' },
  { type: 'page_number',  label: 'N° page',      icon: '#'  },
];

const DEFAULTS: Partial<Record<ElementType, Partial<DesignerElement>>> = {
  text:         { width: 160, height: 26 },
  rectangle:    { width: 100, height: 60 },
  line:         { width: 200, height: 2  },
  image:        { width: 80,  height: 80 },
  table:        { width: 400, height: 120 },
  qr_code:      { width: 70,  height: 70 },
  barcode:      { width: 170, height: 48 },
  current_date: { width: 100, height: 24 },
  page_number:  { width: 50,  height: 24 },
};

// Shared factory — used by palette clicks AND canvas drag & drop
export function buildToolElement(type: ElementType, x: number, y: number, zIndex: number): DesignerElement {
  const def = DEFAULTS[type] ?? { width: 100, height: 40 };
  return {
    id:         nanoid(),
    type,
    x:          Math.round(x),
    y:          Math.round(y),
    width:      def.width  ?? 100,
    height:     def.height ?? 40,
    rotation:   0,
    opacity:    1,
    z_index:    zIndex,
    visible:    true,
    locked:     false,
    binding:    type === 'text' ? '' : undefined,
    properties: {},
    style:      { font_size: 12, color: '#000000' },
  };
}

export function ToolPalette() {
  const { addElement, selectElement, elements } = useDesignerStore();

  const createElement = (type: ElementType) => {
    const el = buildToolElement(type, 20, 20 + elements.length * 5, elements.length);
    addElement(el);
    selectElement(el.id);
  };

  return (
    <div className="w-16 flex flex-col gap-1 p-2 border-r bg-muted/30 shrink-0 overflow-y-auto">
      {TOOLS.map(({ type, label, icon }) => (
        <button
          key={type}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.setData(TOOL_DRAG_TYPE, type);
            e.dataTransfer.effectAllowed = 'copy';
          }}
          title={`${label} — cliquez pour ajouter, ou glissez directement sur la page`}
          onClick={() => createElement(type)}
          className="h-12 w-12 flex flex-col items-center justify-center gap-0.5 rounded-md cursor-grab active:cursor-grabbing hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all"
        >
          <span className="text-base leading-none">{icon}</span>
          <span className="text-[9px] leading-none text-muted-foreground">{label}</span>
        </button>
      ))}
      <p className="text-[8px] text-gray-400 text-center mt-2 leading-tight px-0.5 select-none">
        Glissez un outil sur la page
      </p>
    </div>
  );
}
