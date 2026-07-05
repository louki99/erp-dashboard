import { useRef } from 'react';
import { Stage, Layer, Rect, Text, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { DesignerElement, PageSettings } from '@/types/document-studio.types';

const MM_TO_PX = 3.7795275591;

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
};

interface ElementRendererProps {
  element:    DesignerElement;
  isSelected: boolean;
  onSelect:   () => void;
  onChange:   (el: DesignerElement) => void;
}

function DesignerElementRenderer({ element: el, isSelected, onSelect, onChange }: ElementRendererProps) {
  const shapeRef      = useRef<Konva.Shape>(null);
  const transformRef  = useRef<Konva.Transformer>(null);

  const commonProps = {
    x:        el.x,
    y:        el.y,
    width:    el.width,
    height:   el.height,
    rotation: el.rotation,
    opacity:  el.opacity,
    visible:  el.visible,
    draggable: !el.locked,
    onClick:  onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ ...el, x: e.target.x(), y: e.target.y() });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node   = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        ...el,
        x:        node.x(),
        y:        node.y(),
        width:    Math.max(10, node.width()  * scaleX),
        height:   Math.max(10, node.height() * scaleY),
        rotation: node.rotation(),
      });
    },
  };

  const style = el.style;

  let shape;
  switch (el.type) {
    case 'text':
    case 'current_date':
    case 'page_number':
      shape = (
        <Text
          {...commonProps}
          ref={shapeRef as React.RefObject<Konva.Text>}
          text={el.binding || (el.properties?.content as string) || `{{${el.type}}}`}
          fontSize={style.font_size ?? 12}
          fontFamily={style.font_family ?? 'Arial'}
          fontStyle={[style.bold ? 'bold' : '', style.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal'}
          fill={style.color ?? '#000000'}
          align={style.alignment ?? 'left'}
          wrap="word"
        />
      );
      break;

    case 'rectangle':
      shape = (
        <Rect
          {...commonProps}
          ref={shapeRef as React.RefObject<Konva.Rect>}
          fill={style.background_color ?? 'transparent'}
          stroke={style.border_color ?? '#000000'}
          strokeWidth={style.border_width ?? 1}
          cornerRadius={style.radius ?? 0}
        />
      );
      break;

    case 'line':
      shape = (
        <Line
          {...commonProps}
          ref={shapeRef as React.RefObject<Konva.Line>}
          points={[0, 0, el.width, 0]}
          stroke={style.border_color ?? '#000000'}
          strokeWidth={style.border_width ?? 1}
        />
      );
      break;

    default:
      shape = (
        <Rect
          {...commonProps}
          ref={shapeRef as React.RefObject<Konva.Rect>}
          fill={style.background_color ?? '#e5e7eb'}
          stroke={style.border_color ?? '#9ca3af'}
          strokeWidth={1}
          dash={[4, 4]}
        />
      );
  }

  return (
    <>
      {shape}
      {isSelected && (
        <Transformer
          ref={transformRef}
          nodes={shapeRef.current ? [shapeRef.current] : []}
          keepRatio={false}
          boundBoxFunc={(_, newBox) => ({
            ...newBox,
            width:  Math.max(10, newBox.width),
            height: Math.max(10, newBox.height),
          })}
        />
      )}
    </>
  );
}

interface Props {
  page:       PageSettings;
  elements:   DesignerElement[];
  selectedId: string | null;
  zoom:       number;
  onSelect:   (id: string | null) => void;
  onChange:   (element: DesignerElement) => void;
}

export function DesignerCanvas({ page, elements, selectedId, zoom, onSelect, onChange }: Props) {
  const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;
  const w    = dims.w * MM_TO_PX;
  const h    = page.orientation === 'portrait'
    ? dims.h * MM_TO_PX
    : dims.w * MM_TO_PX;

  const scaledW = w * zoom;
  const scaledH = h * zoom;

  return (
    <div className="flex items-start justify-center overflow-auto bg-gray-100 p-8 flex-1">
      <div
        className="shadow-xl bg-white"
        style={{ width: scaledW, height: scaledH }}
      >
        <Stage
          width={scaledW}
          height={scaledH}
          scaleX={zoom}
          scaleY={zoom}
          onClick={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
        >
          <Layer>
            <Rect x={0} y={0} width={w} height={h} fill="white" />
            {[...elements]
              .sort((a, b) => a.z_index - b.z_index)
              .map((el) => (
                <DesignerElementRenderer
                  key={el.id}
                  element={el}
                  isSelected={el.id === selectedId}
                  onSelect={() => onSelect(el.id)}
                  onChange={onChange}
                />
              ))}
          </Layer>
        </Stage>
      </div>
    </div>
  );
}
