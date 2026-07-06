import { nanoid } from 'nanoid';
import { Button } from '@/components/ui/button';
import { useDesignerStore } from '@/stores/designer-store';
import type { DesignerElement, ElementType } from '@/types/document-studio.types';

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

export function ToolPalette() {
  const { addElement, elements } = useDesignerStore();

  const createElement = (type: ElementType) => {
    const def = DEFAULTS[type] ?? { width: 100, height: 40 };
    const el: DesignerElement = {
      id:         nanoid(),
      type,
      x:          20,
      y:          20 + elements.length * 5,
      width:      def.width  ?? 100,
      height:     def.height ?? 40,
      rotation:   0,
      opacity:    1,
      z_index:    elements.length,
      visible:    true,
      locked:     false,
      binding:    type === 'text' ? '' : undefined,
      properties: {},
      style:      { font_size: 12, color: '#000000' },
    };
    addElement(el);
  };

  return (
    <div className="w-16 flex flex-col gap-1 p-2 border-r bg-muted/30 shrink-0">
      {TOOLS.map(({ type, label, icon }) => (
        <Button
          key={type}
          variant="ghost"
          size="sm"
          className="h-12 w-12 flex flex-col items-center justify-center p-1 text-xs gap-0.5"
          title={label}
          onClick={() => createElement(type)}
        >
          <span className="text-base leading-none">{icon}</span>
          <span className="text-[9px] leading-none text-muted-foreground">{label}</span>
        </Button>
      ))}
    </div>
  );
}
