import { useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Text, Line, Transformer } from 'react-konva';
import type Konva from 'konva';
import type { DesignerElement, PageSettings } from '@/types/document-studio.types';
import { useDesignerStore } from '@/stores/designer-store';

const MM_TO_PX = 3.7795275591;

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
};

// ── Placeholder colors for non-renderable types ───────────────────────────────

const PLACEHOLDER_COLORS: Record<string, { fill: string; stroke: string; label: string }> = {
  image:        { fill: '#eff6ff', stroke: '#93c5fd', label: '🖼 Image'    },
  table:        { fill: '#f0fdf4', stroke: '#86efac', label: '⊞ Tableau'  },
  qr_code:      { fill: '#faf5ff', stroke: '#c4b5fd', label: '⊡ QR Code'  },
  barcode:      { fill: '#fff7ed', stroke: '#fed7aa', label: '▐▐ Barcode'  },
  current_date: { fill: '#fefce8', stroke: '#fde047', label: '📅 Date'     },
  page_number:  { fill: '#f9fafb', stroke: '#d1d5db', label: '# Page'     },
};

// ── Mock binding resolver ─────────────────────────────────────────────────────

function resolveMock(binding: string, testData: Record<string, unknown>): string {
  if (!binding) return '';
  const inner = binding.replace(/\{\{|\}\}/g, '').trim();
  const varPath = inner.split('|')[0].trim(); // strip Jinja2 filters
  const parts = varPath.split('.');
  let val: unknown = testData;
  for (const p of parts) {
    if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
    else return binding;
  }
  return val != null ? String(val) : binding;
}

// ── Single element renderer ───────────────────────────────────────────────────

interface ElementRendererProps {
  element:     DesignerElement;
  isSelected:  boolean;
  onSelect:    () => void;
  onChange:    (el: DesignerElement) => void;
  previewMode: boolean;
  testData:    Record<string, unknown>;
}

function DesignerElementRenderer({
  element: el,
  isSelected,
  onSelect,
  onChange,
  previewMode,
  testData,
}: ElementRendererProps) {
  const shapeRef     = useRef<Konva.Shape | null>(null);
  const transformRef = useRef<Konva.Transformer | null>(null);

  // Attach transformer to shape after mount / selection change
  useEffect(() => {
    if (!transformRef.current || !shapeRef.current) return;
    if (isSelected) {
      transformRef.current.nodes([shapeRef.current]);
      transformRef.current.getLayer()?.batchDraw();
    } else {
      transformRef.current.nodes([]);
      transformRef.current.getLayer()?.batchDraw();
    }
  }, [isSelected]);

  const style = el.style;

  const commonDrag = {
    draggable:  !el.locked,
    onClick:    onSelect,
    onTap:      onSelect,
    onDragEnd: (e: Konva.KonvaEventObject<DragEvent>) => {
      onChange({ ...el, x: Math.round(e.target.x()), y: Math.round(e.target.y()) });
    },
    onTransformEnd: (e: Konva.KonvaEventObject<Event>) => {
      const node   = e.target;
      const scaleX = node.scaleX();
      const scaleY = node.scaleY();
      node.scaleX(1);
      node.scaleY(1);
      onChange({
        ...el,
        x:        Math.round(node.x()),
        y:        Math.round(node.y()),
        width:    Math.max(10, Math.round(node.width()  * scaleX)),
        height:   Math.max(10, Math.round(node.height() * scaleY)),
        rotation: Math.round(node.rotation()),
      });
    },
  };

  const baseProps = {
    x:        el.x,
    y:        el.y,
    width:    el.width,
    height:   el.height,
    rotation: el.rotation ?? 0,
    opacity:  el.opacity  ?? 1,
    visible:  el.visible  ?? true,
    ...commonDrag,
  };

  let shape: React.ReactElement;

  switch (el.type) {
    case 'text':
    case 'current_date':
    case 'page_number':
      shape = (
        <Text
          {...baseProps}
          ref={shapeRef as React.RefObject<Konva.Text>}
          text={
            previewMode && el.binding
              ? resolveMock(el.binding, testData)
              : el.binding || (el.properties?.content as string) || ''
          }
          fontSize={style.font_size ?? 12}
          fontFamily={style.font_family ?? 'Arial'}
          fontStyle={
            [style.bold ? 'bold' : '', style.italic ? 'italic' : ''].filter(Boolean).join(' ') || 'normal'
          }
          textDecoration={style.underline ? 'underline' : ''}
          fill={style.color ?? '#1a1a1a'}
          align={style.alignment ?? 'left'}
          verticalAlign={style.vertical_alignment ?? 'top'}
          padding={style.padding ?? 0}
          wrap="word"
          ellipsis={false}
        />
      );
      break;

    case 'rectangle':
      shape = (
        <Rect
          {...baseProps}
          ref={shapeRef as React.RefObject<Konva.Rect>}
          fill={style.background_color ?? 'transparent'}
          stroke={style.border_color ?? '#374151'}
          strokeWidth={style.border_width ?? 1}
          cornerRadius={style.radius ?? 0}
        />
      );
      break;

    case 'line':
      shape = (
        <Line
          {...{
            x:        el.x,
            y:        el.y,
            rotation: el.rotation ?? 0,
            opacity:  el.opacity  ?? 1,
            visible:  el.visible  ?? true,
            ...commonDrag,
          }}
          ref={shapeRef as React.RefObject<Konva.Line>}
          points={[0, 0, el.width, 0]}
          stroke={style.border_color ?? '#374151'}
          strokeWidth={style.border_width ?? 1}
        />
      );
      break;

    default: {
      const meta = PLACEHOLDER_COLORS[el.type] ?? { fill: '#f3f4f6', stroke: '#9ca3af', label: el.type };
      const label = el.binding
        ? `${meta.label}\n${el.binding}`
        : (el.properties?.content as string)
          ? `${meta.label}\n${el.properties.content}`
          : meta.label;
      shape = (
        <>
          <Rect
            {...baseProps}
            ref={shapeRef as React.RefObject<Konva.Rect>}
            fill={meta.fill}
            stroke={meta.stroke}
            strokeWidth={1}
            dash={[5, 3]}
            cornerRadius={3}
          />
          <Text
            x={el.x + 4}
            y={el.y + 4}
            width={Math.max(0, el.width - 8)}
            height={Math.max(0, el.height - 8)}
            text={label}
            fontSize={Math.min(11, el.height / 3)}
            fill={meta.stroke}
            align="center"
            verticalAlign="middle"
            listening={false}
          />
        </>
      );
      break;
    }
  }

  return (
    <>
      {shape}
      {isSelected && (
        <Transformer
          ref={transformRef as React.RefObject<Konva.Transformer>}
          keepRatio={false}
          rotateEnabled={true}
          borderStroke="#3b82f6"
          borderStrokeWidth={1.5}
          anchorFill="#ffffff"
          anchorStroke="#3b82f6"
          anchorSize={8}
          anchorCornerRadius={2}
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

// ── Canvas wrapper ────────────────────────────────────────────────────────────

interface Props {
  page:           PageSettings;
  elements:       DesignerElement[];
  selectedId:     string | null;
  zoom:           number;
  onZoomChange:   (z: number) => void;
  onSelect:       (id: string | null) => void;
  onChange:       (element: DesignerElement) => void;
  onFitComputed?: (fitPage: number, fitWidth: number) => void;
}

const PADDING  = 48;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const STEP     = 0.1;

export function DesignerCanvas({
  page,
  elements,
  selectedId,
  zoom,
  onZoomChange,
  onSelect,
  onChange,
  onFitComputed,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitZoomRef   = useRef(1);

  const { testData, previewMode } = useDesignerStore();

  const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;

  const pageW = page.orientation === 'landscape' ? dims.h : dims.w;
  const pageH = page.orientation === 'landscape' ? dims.w : dims.h;

  const w = pageW * MM_TO_PX;
  const h = pageH * MM_TO_PX;

  // Auto-fit on mount and container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calc = () => {
      const availW   = el.clientWidth  - PADDING;
      const availH   = el.clientHeight - PADDING;
      const fitPage  = +Math.min(availW / w, availH / h).toFixed(3);
      const fitWidth = +(availW / w).toFixed(3);
      fitZoomRef.current = fitPage;
      onFitComputed?.(fitPage, fitWidth);
      onZoomChange(fitPage);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  // Ctrl + wheel → zoom in / out
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? STEP : -STEP;
      onZoomChange(+Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom + delta)).toFixed(2));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  // Double-click on background → reset to fit
  const resetToFit = () => onZoomChange(fitZoomRef.current);

  const scaledW = Math.round(w * zoom);
  const scaledH = Math.round(h * zoom);

  // Margin guide lines (in page-coord space, before zoom)
  const mt = (page.margin_top    ?? 10) * MM_TO_PX;
  const mr = (page.margin_right  ?? 10) * MM_TO_PX;
  const mb = (page.margin_bottom ?? 10) * MM_TO_PX;
  const ml = (page.margin_left   ?? 10) * MM_TO_PX;

  return (
    <div ref={containerRef} className="flex-1 overflow-auto bg-[#e8eaed]" onDoubleClick={resetToFit}>
      {/* Centering shell */}
      <div
        style={{
          minWidth:       '100%',
          width:          'max-content',
          minHeight:      scaledH + 64,
          display:        'flex',
          justifyContent: 'center',
          alignItems:     'flex-start',
          padding:        '32px 24px',
          boxSizing:      'border-box',
        }}
      >
        {/* Page shadow + white background */}
        <div
          className="relative shadow-2xl rounded-sm bg-white"
          style={{ width: scaledW, height: scaledH, flexShrink: 0 }}
        >
          <Stage
            width={scaledW}
            height={scaledH}
            scaleX={zoom}
            scaleY={zoom}
            onClick={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}
          >
            <Layer>
              {/* Page background */}
              <Rect x={0} y={0} width={w} height={h} fill="white" />

              {/* Margin guides */}
              <Line points={[ml, mt, w - mr, mt]}         stroke="#93c5fd" strokeWidth={0.5} dash={[4, 4]} listening={false} />
              <Line points={[ml, h - mb, w - mr, h - mb]} stroke="#93c5fd" strokeWidth={0.5} dash={[4, 4]} listening={false} />
              <Line points={[ml, mt, ml, h - mb]}          stroke="#93c5fd" strokeWidth={0.5} dash={[4, 4]} listening={false} />
              <Line points={[w - mr, mt, w - mr, h - mb]} stroke="#93c5fd" strokeWidth={0.5} dash={[4, 4]} listening={false} />

              {/* Elements sorted by z_index */}
              {[...elements]
                .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
                .map((el) => (
                  <DesignerElementRenderer
                    key={el.id}
                    element={el}
                    isSelected={el.id === selectedId}
                    onSelect={() => onSelect(el.id)}
                    onChange={onChange}
                    previewMode={previewMode}
                    testData={testData}
                  />
                ))}
            </Layer>
          </Stage>

          {/* Format label + zoom hint */}
          <div className="absolute -bottom-6 left-0 right-0 flex items-center justify-between text-[10px] text-gray-400 select-none">
            <span>
              {page.format} · {page.orientation} · <strong>{Math.round(zoom * 100)}%</strong>
            </span>
            <span className="italic">Ctrl+scroll pour zoomer · double-clic pour ajuster</span>
          </div>
        </div>
      </div>
    </div>
  );
}
