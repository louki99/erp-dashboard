import { useRef, useState, useEffect, useMemo, useCallback, forwardRef, useImperativeHandle } from 'react';
import { Rnd } from 'react-rnd';
import { nanoid } from 'nanoid';
import { useDesignerStore } from '@/stores/designer-store';
import { buildToolElement, TOOL_DRAG_TYPE } from '@/components/document-studio/ToolPalette';
import { ElementEditModal } from '@/components/document-studio/ElementEditModal';
import type { DesignerElement, PageSettings, ElementStyle, ElementType } from '@/types/document-studio.types';

/*
 * HTML/CSS designer canvas.
 *
 * Replaces the previous Konva implementation: elements are real DOM nodes, so
 * text stays crisp at every zoom level, variables render as readable token
 * pills, tables render as skeleton previews, and hover/selection states are
 * plain CSS. The data model (absolute page-px coordinates) is unchanged —
 * the backend renderer is not affected.
 */

export const MM_TO_PX = 3.7795275591;
const RULER_SIZE = 20;
const SNAP = Math.round(2.5 * MM_TO_PX); // 2.5 mm snap grid

export const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
};

// ── Binding helpers ───────────────────────────────────────────────────────────

// Extracts the argument of default(...) with balanced parentheses — the seeder
// uses nested expressions like default(company.name | default("Fallback")).
export function extractDefaultArg(binding: string): { raw: string; literal?: string } | undefined {
  const idx = binding.indexOf('default(');
  if (idx === -1) return undefined;
  const start = idx + 'default('.length;
  let depth = 0;
  let i = start;
  for (; i < binding.length; i++) {
    const ch = binding[i];
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (depth === 0) break;
      depth--;
    }
  }
  const raw = binding.slice(start, i).trim();
  const m = raw.match(/^"([^"]*)"$/) ?? raw.match(/^'([^']*)'$/);
  return { raw, literal: m ? m[1] : undefined };
}

function parseBinding(binding: string): { path: string; defaultValue?: string } {
  if (!binding) return { path: '' };
  const inner = binding.replace(/\{\{|\}\}/g, '').trim();
  const path = inner.split('|')[0]?.trim() ?? '';
  const def = extractDefaultArg(inner);
  return { path, defaultValue: def?.literal ?? def?.raw };
}

function resolveMock(binding: string, testData: Record<string, unknown>): string {
  if (!binding) return '';
  const { path, defaultValue } = parseBinding(binding);
  const parts = path.split('.');
  let val: unknown = testData;
  for (const p of parts) {
    if (val && typeof val === 'object') val = (val as Record<string, unknown>)[p];
    else { val = undefined; break; }
  }
  if (val != null && typeof val !== 'object') return String(val);
  return defaultValue ?? binding;
}

function textCss(style: ElementStyle): React.CSSProperties {
  return {
    fontSize:       style.font_size ?? 12,
    fontFamily:     style.font_family ?? 'Arial, sans-serif',
    fontWeight:     style.bold ? 700 : 400,
    fontStyle:      style.italic ? 'italic' : 'normal',
    textDecoration: style.underline ? 'underline' : 'none',
    color:          style.color ?? '#1a1a1a',
    textAlign:      style.alignment ?? 'left',
    padding:        style.padding ?? 0,
    lineHeight:     1.25,
  };
}

// ── Element content renderers ─────────────────────────────────────────────────

function VariablePill({ path, defaultValue, height }: { path: string; defaultValue?: string; height: number }) {
  const compact = height < 22;
  return (
    <div className="w-full h-full flex flex-col justify-center overflow-hidden" style={{ gap: 1 }}>
      <span
        className="inline-block max-w-full truncate rounded border font-mono leading-tight self-start"
        style={{
          backgroundColor: '#e0f2fe',
          color:           '#0369a1',
          borderColor:     '#bae6fd',
          fontSize:        compact ? 9 : 10,
          padding:         compact ? '0px 4px' : '1px 5px',
        }}
      >
        {'{{'}{path}{'}}'}
      </span>
      {defaultValue && !compact && (
        <span className="truncate text-[9px] text-sky-500 pl-0.5">= "{defaultValue}"</span>
      )}
    </div>
  );
}

function TableSkeleton({ binding, height }: { binding?: string; height: number }) {
  const headerH = 18;
  const rowCount = Math.max(2, Math.min(6, Math.floor((height - headerH - 16) / 16)));
  return (
    <div className="w-full h-full flex flex-col rounded border-[1.5px] border-dashed border-emerald-400/70 bg-emerald-50/30 overflow-hidden">
      <div className="flex items-center gap-1 px-1.5 shrink-0" style={{ height: 16 }}>
        <span className="text-[9px] font-semibold text-emerald-700">⊞ Tableau</span>
        {binding && (
          <span className="text-[8px] font-mono text-emerald-600 truncate">{binding.replace(/\{\{|\}\}/g, '').trim()}</span>
        )}
      </div>
      {/* Header row */}
      <div className="grid grid-cols-4 gap-px bg-emerald-200/60 px-1 shrink-0" style={{ height: headerH }}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-center bg-emerald-100/80">
            <div className="h-1.5 w-2/3 rounded-full bg-emerald-300/90" />
          </div>
        ))}
      </div>
      {/* Wireframe rows */}
      <div className="flex-1 flex flex-col gap-px bg-emerald-100/40 px-1 pb-1 overflow-hidden">
        {Array.from({ length: rowCount }).map((_, r) => (
          <div key={r} className="grid grid-cols-4 gap-px flex-1 min-h-0">
            {Array.from({ length: 4 }).map((_, c) => (
              <div key={c} className="flex items-center px-1 bg-white/80">
                <div className="h-1 rounded-full bg-slate-200" style={{ width: `${55 + ((r * 4 + c) % 3) * 15}%` }} />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PlaceholderBox({ icon, label, sub, color }: { icon: string; label: string; sub?: string; color: string }) {
  return (
    <div
      className="w-full h-full flex flex-col items-center justify-center gap-0.5 rounded border-[1.5px] border-dashed overflow-hidden"
      style={{ borderColor: color, backgroundColor: `${color}14` }}
    >
      <span style={{ fontSize: 14, color }}>{icon}</span>
      <span className="text-[9px] font-medium truncate max-w-full px-1" style={{ color }}>{label}</span>
      {sub && <span className="text-[8px] font-mono truncate max-w-full px-1 opacity-70" style={{ color }}>{sub}</span>}
    </div>
  );
}

function ElementContent({ el, previewMode, testData }: {
  el: DesignerElement;
  previewMode: boolean;
  testData: Record<string, unknown>;
}) {
  const style = el.style;

  switch (el.type) {
    case 'text':
    case 'current_date':
    case 'page_number': {
      const binding = el.binding ?? '';
      if (binding && !previewMode) {
        const { path, defaultValue } = parseBinding(binding);
        return <VariablePill path={path} defaultValue={defaultValue} height={el.height} />;
      }
      const text = binding && previewMode
        ? resolveMock(binding, testData)
        : (el.properties?.content as string) ?? (el.type === 'current_date' ? '04/07/2026' : el.type === 'page_number' ? '1 / 1' : '');
      return (
        <div className="w-full h-full overflow-hidden" style={textCss(style)}>
          {text}
        </div>
      );
    }

    case 'rectangle':
      return (
        <div
          className="w-full h-full"
          style={{
            backgroundColor: style.background_color ?? 'transparent',
            border: `${style.border_width ?? 1}px solid ${style.border_color ?? '#374151'}`,
            borderRadius: style.radius ?? 0,
          }}
        />
      );

    case 'line':
      return (
        <div className="w-full h-full flex items-center">
          <div
            className="w-full"
            style={{ height: Math.max(1, style.border_width ?? 1), backgroundColor: style.border_color ?? '#374151' }}
          />
        </div>
      );

    case 'image': {
      const src = el.properties?.src as string | undefined;
      if (src) return <img src={src} alt="" className="w-full h-full object-contain" draggable={false} />;
      return <PlaceholderBox icon="🖼" label="Image" sub={el.binding} color="#3b82f6" />;
    }

    case 'table':
      return <TableSkeleton binding={el.binding} height={el.height} />;

    case 'qr_code':
      return <PlaceholderBox icon="⊡" label="QR Code" sub={el.binding} color="#8b5cf6" />;

    case 'barcode':
      return (
        <div className="w-full h-full flex flex-col items-center justify-center rounded border-[1.5px] border-dashed border-orange-300 bg-orange-50/40 overflow-hidden px-2">
          <div
            className="w-full flex-1 my-1"
            style={{
              backgroundImage: 'repeating-linear-gradient(90deg, #9a3412 0 2px, transparent 2px 5px, #9a3412 5px 6px, transparent 6px 10px)',
              opacity: 0.5,
            }}
          />
          {el.binding && <span className="text-[8px] font-mono text-orange-700 truncate max-w-full">{el.binding}</span>}
        </div>
      );

    default:
      return <PlaceholderBox icon="?" label={el.type} color="#9ca3af" />;
  }
}

// ── Draggable element wrapper ─────────────────────────────────────────────────

const RESIZE_HANDLE: React.CSSProperties = {
  width: 8,
  height: 8,
  backgroundColor: '#ffffff',
  border: '1.5px solid #4f46e5',
  borderRadius: 2,
};

function CanvasElement({ el, isSelected, zoom, readOnly, onSelect, onChange, onContextMenu, onEdit }: {
  el: DesignerElement;
  isSelected: boolean;
  zoom: number;
  readOnly: boolean;
  onSelect: () => void;
  onChange: (el: DesignerElement) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onEdit?: () => void;
}) {
  const outline = isSelected
    ? '1.5px solid #4f46e5'
    : readOnly
      ? '1px dashed transparent'
      : '1px dashed rgba(79, 70, 229, 0.35)';

  const inner = (
    <div
      className="w-full h-full designer-el"
      style={{
        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
        opacity: el.opacity ?? 1,
        cursor: readOnly ? 'pointer' : 'move',
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onDoubleClick={(e) => {
        if (!onEdit) return;
        e.stopPropagation();
        onEdit();
      }}
      onContextMenu={(e) => {
        if (!onContextMenu) return;
        e.preventDefault();
        e.stopPropagation();
        onSelect();
        onContextMenu(e);
      }}
    >
      <ElementContent el={el} previewMode={false} testData={{}} />
    </div>
  );

  if (readOnly) {
    return (
      <div
        style={{
          position: 'absolute',
          left: el.x,
          top: el.y,
          width: el.width,
          height: el.height,
          zIndex: el.z_index,
          display: el.visible === false ? 'none' : undefined,
          outline: isSelected ? '1.5px dashed #6366f1' : 'none',
          outlineOffset: 2,
          borderRadius: 2,
          backgroundColor: isSelected ? 'rgba(99, 102, 241, 0.06)' : undefined,
        }}
      >
        {inner}
      </div>
    );
  }

  return (
    <Rnd
      size={{ width: el.width, height: el.height }}
      position={{ x: el.x, y: el.y }}
      scale={zoom}
      bounds="parent"
      dragGrid={[SNAP, SNAP]}
      resizeGrid={[SNAP, SNAP]}
      disableDragging={el.locked}
      enableResizing={isSelected && !el.locked}
      minWidth={8}
      minHeight={2}
      style={{
        zIndex: el.z_index,
        display: el.visible === false ? 'none' : undefined,
        outline,
        outlineOffset: 1,
        borderRadius: 2,
        transition: 'outline-color 0.15s ease',
      }}
      resizeHandleStyles={{
        topLeft: RESIZE_HANDLE, top: RESIZE_HANDLE, topRight: RESIZE_HANDLE,
        left: RESIZE_HANDLE, right: RESIZE_HANDLE,
        bottomLeft: RESIZE_HANDLE, bottom: RESIZE_HANDLE, bottomRight: RESIZE_HANDLE,
      }}
      onMouseDown={(e: MouseEvent) => e.stopPropagation()}
      onDragStop={(_, d) => {
        onChange({ ...el, x: Math.round(d.x), y: Math.round(d.y) });
        onSelect();
      }}
      onResizeStop={(_, __, ref, ___, pos) => {
        onChange({
          ...el,
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          width: Math.round(parseFloat(ref.style.width)),
          height: Math.round(parseFloat(ref.style.height)),
        });
      }}
    >
      {inner}
    </Rnd>
  );
}

// ── Context menu ──────────────────────────────────────────────────────────────

interface MenuAction {
  icon: string;
  label: string;
  danger?: boolean;
  divider?: boolean;
  onClick: () => void;
}

function ContextMenu({ x, y, actions, onClose }: {
  x: number; y: number; actions: MenuAction[]; onClose: () => void;
}) {
  // Close on any outside click / Escape / scroll
  useEffect(() => {
    const close = () => onClose();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('mousedown', close);
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', close, { once: true });
    return () => {
      window.removeEventListener('mousedown', close);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('wheel', close);
    };
  }, [onClose]);

  const menuW = 200;
  const left = Math.min(x, window.innerWidth - menuW - 8);
  const top = Math.min(y, window.innerHeight - actions.length * 32 - 16);

  return (
    <div
      className="fixed z-[1000] bg-white rounded-xl border border-gray-200 shadow-xl py-1 select-none"
      style={{ left, top, width: menuW }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {actions.map((a, i) => (
        <div key={i}>
          {a.divider && <div className="h-px bg-gray-100 my-1" />}
          <button
            onClick={() => { a.onClick(); onClose(); }}
            className={`w-full flex items-center gap-2.5 px-3 py-1.5 text-xs text-left transition-colors ${
              a.danger ? 'text-red-500 hover:bg-red-50' : 'text-gray-700 hover:bg-indigo-50'
            }`}
          >
            <span className="w-4 text-center">{a.icon}</span>
            {a.label}
          </button>
        </div>
      ))}
    </div>
  );
}

// ── Ruler ─────────────────────────────────────────────────────────────────────

function RulerTicks({ lengthMm, zoom, horizontal }: { lengthMm: number; zoom: number; horizontal: boolean }) {
  const ticks = useMemo(() => {
    const out: { pos: number; major: boolean; label?: string }[] = [];
    for (let mm = 0; mm <= lengthMm; mm += 5) {
      out.push({
        pos: Math.round(mm * MM_TO_PX * zoom),
        major: mm % 10 === 0,
        label: mm % 50 === 0 ? String(mm) : undefined,
      });
    }
    return out;
  }, [lengthMm, zoom]);

  return (
    <>
      {ticks.map((t) => (
        <div
          key={t.pos}
          style={{
            position: 'absolute',
            [horizontal ? 'left' : 'top']: t.pos,
            [horizontal ? 'bottom' : 'right']: 0,
            [horizontal ? 'width' : 'height']: 1,
            [horizontal ? 'height' : 'width']: t.major ? 8 : 4,
            backgroundColor: t.major ? '#6b7280' : '#d1d5db',
          }}
        />
      ))}
      {ticks.filter((t) => t.label).map((t) => (
        <span
          key={`l-${t.pos}`}
          className="text-[8px] text-gray-500 font-medium select-none"
          style={{
            position: 'absolute',
            [horizontal ? 'left' : 'top']: t.pos + 2,
            [horizontal ? 'top' : 'left']: 2,
          }}
        >
          {t.label}
        </span>
      ))}
    </>
  );
}

// ── Band separator (HTML drag) ────────────────────────────────────────────────

function BandSeparator({ y, zoom, color, label, min, max, onCommit }: {
  y: number; zoom: number; color: string; label: string;
  min: number; max: number;
  onCommit: (yPx: number) => void;
}) {
  const [dragY, setDragY] = useState<number | null>(null);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientY = e.clientY;
    const startY = y;
    let current = y;

    const onMove = (ev: MouseEvent) => {
      current = Math.max(min, Math.min(max, startY + (ev.clientY - startClientY) / zoom));
      setDragY(current);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      setDragY(null);
      onCommit(current);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const displayY = dragY ?? y;

  return (
    <div
      className="absolute left-0 right-0 group"
      style={{ top: displayY - 5, height: 10, cursor: 'row-resize', zIndex: 500 }}
      onMouseDown={startDrag}
    >
      <div
        className="absolute left-0 right-0"
        style={{ top: 4.5, height: 1.5, backgroundImage: `repeating-linear-gradient(90deg, ${color} 0 8px, transparent 8px 14px)` }}
      />
      {/* Grip */}
      <div
        className="absolute left-1/2 -translate-x-1/2 flex items-center justify-center rounded-full shadow-sm"
        style={{ top: 1, width: 34, height: 8, backgroundColor: color }}
      >
        <div className="w-3 h-0.5 bg-white/90 rounded-full" />
      </div>
      <span
        className="absolute left-1 text-[8px] font-semibold uppercase tracking-wide opacity-0 group-hover:opacity-100 transition-opacity select-none"
        style={{ top: -11, color }}
      >
        {label}
      </span>
    </div>
  );
}

// ── Canvas ────────────────────────────────────────────────────────────────────

interface Props {
  page: PageSettings;
  elements: DesignerElement[];
  selectedId: string | null;
  zoom: number;
  onZoomChange: (z: number) => void;
  onSelect: (id: string | null) => void;
  onChange: (element: DesignerElement) => void;
  onFitComputed?: (fitPage: number, fitWidth: number) => void;
  readOnly?: boolean;
  onPageChange?: (page: PageSettings) => void;
}

export interface DesignerCanvasRef {
  focusElement: (id: string, targetZoom?: number) => void;
}

const PADDING = 24;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8.0;

export const DesignerCanvas = forwardRef<DesignerCanvasRef, Props>(function DesignerCanvas(
  { page, elements, selectedId, zoom, onZoomChange, onSelect, onChange, onFitComputed, readOnly = false, onPageChange }: Props,
  ref,
) {
  const containerRef = useRef<HTMLDivElement>(null);
  const fitZoomRef = useRef(1);

  const { testData, previewMode, addElement, removeElement, selectElement } = useDesignerStore();

  // Context menu + quick-edit modal state
  const [menu, setMenu] = useState<{ x: number; y: number; elId: string } | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const menuEl = menu ? elements.find((e) => e.id === menu.elId) : undefined;
  const editingEl = editingId ? elements.find((e) => e.id === editingId) : undefined;

  const duplicateElement = (el: DesignerElement) => {
    const copy: DesignerElement = {
      ...structuredClone(el),
      id: nanoid(),
      x: el.x + 12,
      y: el.y + 12,
      z_index: Math.max(0, ...elements.map((e) => e.z_index ?? 0)) + 1,
    };
    addElement(copy);
    selectElement(copy.id);
  };

  // Drop a tool from the palette at the exact cursor position
  const handleToolDrop = (e: React.DragEvent<HTMLDivElement>) => {
    const type = e.dataTransfer.getData(TOOL_DRAG_TYPE) as ElementType | '';
    if (!type) return;
    e.preventDefault();
    const rect = e.currentTarget.getBoundingClientRect();
    const px = (e.clientX - rect.left) / zoom;
    const py = (e.clientY - rect.top) / zoom;
    const el = buildToolElement(type, px, py, elements.length);
    // Center the new element under the cursor, clamped inside the page
    el.x = Math.max(0, Math.min(Math.round(px - el.width / 2), Math.round(w - el.width)));
    el.y = Math.max(0, Math.min(Math.round(py - el.height / 2), Math.round(h - el.height)));
    addElement(el);
    selectElement(el.id);
  };

  const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;
  const pageW = page.orientation === 'landscape' ? dims.h : dims.w;
  const pageH = page.orientation === 'landscape' ? dims.w : dims.h;
  const w = pageW * MM_TO_PX;
  const h = pageH * MM_TO_PX;

  useImperativeHandle(ref, () => ({
    focusElement: (id, targetZoom = 2.0) => {
      const el = elements.find((e) => e.id === id);
      const container = containerRef.current;
      if (!el || !container) return;
      const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, targetZoom));
      onZoomChange(newZoom);
      onSelect(id);
      requestAnimationFrame(() => {
        const centerX = (el.x + el.width / 2) * newZoom + RULER_SIZE;
        const centerY = (el.y + el.height / 2) * newZoom + RULER_SIZE;
        container.scrollTo({
          left: Math.max(0, centerX - container.clientWidth / 2),
          top: Math.max(0, centerY - container.clientHeight / 2),
          behavior: 'smooth',
        });
      });
    },
  }));

  // Auto-fit width on mount / container resize
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const calc = () => {
      const availW = el.clientWidth - PADDING - RULER_SIZE;
      const availH = el.clientHeight - PADDING - RULER_SIZE;
      const fitPage = +Math.min(availW / w, availH / h).toFixed(3);
      const fitWidth = +(availW / w).toFixed(3);
      fitZoomRef.current = fitWidth;
      onFitComputed?.(fitPage, fitWidth);
      onZoomChange(fitWidth);
    };
    calc();
    const ro = new ResizeObserver(calc);
    ro.observe(el);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w, h]);

  // Ctrl + wheel → smooth zoom
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return;
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 1 / 1.08;
      onZoomChange(+Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * factor)).toFixed(3));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoom]);

  const resetToFit = useCallback(() => onZoomChange(fitZoomRef.current), [onZoomChange]);

  const scaledW = Math.round(w * zoom);
  const scaledH = Math.round(h * zoom);

  // Margins + bands (page-px space)
  const mt = (page.margin_top ?? 10) * MM_TO_PX;
  const mr = (page.margin_right ?? 10) * MM_TO_PX;
  const mb = (page.margin_bottom ?? 10) * MM_TO_PX;
  const ml = (page.margin_left ?? 10) * MM_TO_PX;
  const headerY = (page.header_height ?? 45) * MM_TO_PX;
  const footerY = h - (page.footer_height ?? 40) * MM_TO_PX;
  const showBands = !previewMode;

  const gridStep = 10 * MM_TO_PX;

  return (
    <div
      ref={containerRef}
      className="flex-1 overflow-auto"
      style={{ backgroundColor: '#f1f5f9' }}
      onDoubleClick={resetToFit}
    >
      {/* Centering shell */}
      <div
        style={{
          minWidth: '100%',
          width: 'max-content',
          minHeight: scaledH + 40 + RULER_SIZE,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'flex-start',
          padding: '16px 12px',
          boxSizing: 'border-box',
        }}
      >
        {/* Page + rulers */}
        <div className="relative" style={{ width: scaledW + RULER_SIZE, height: scaledH + RULER_SIZE, flexShrink: 0 }}>
          {/* Rulers */}
          <div
            className="absolute top-0 left-0 right-0 h-5 bg-gray-100 border-b border-gray-300 overflow-hidden"
            style={{ marginLeft: RULER_SIZE }}
          >
            <RulerTicks lengthMm={pageW} zoom={zoom} horizontal={true} />
          </div>
          <div
            className="absolute top-0 left-0 bottom-0 w-5 bg-gray-100 border-r border-gray-300 overflow-hidden"
            style={{ marginTop: RULER_SIZE }}
          >
            <RulerTicks lengthMm={pageH} zoom={zoom} horizontal={false} />
          </div>

          {/* Page sheet */}
          <div
            className="absolute bg-white rounded-sm"
            style={{
              top: RULER_SIZE,
              left: RULER_SIZE,
              width: scaledW,
              height: scaledH,
              boxShadow: '0 10px 25px -5px rgba(0,0,0,0.12), 0 8px 10px -6px rgba(0,0,0,0.1)',
              overflow: 'hidden',
            }}
          >
            {/* Inner page — unscaled coordinate space, scaled via CSS transform */}
            <div
              className="relative"
              style={{
                width: w,
                height: h,
                transform: `scale(${zoom})`,
                transformOrigin: '0 0',
                backgroundImage: previewMode
                  ? undefined
                  : `radial-gradient(circle, #d1d5db 0.8px, transparent 0.8px)`,
                backgroundSize: `${gridStep}px ${gridStep}px`,
              }}
              onClick={(e) => { if (e.target === e.currentTarget) onSelect(null); }}
              onDragOver={(e) => {
                if (!readOnly && e.dataTransfer.types.includes(TOOL_DRAG_TYPE)) e.preventDefault();
              }}
              onDrop={readOnly ? undefined : handleToolDrop}
            >
              {/* Band zones */}
              {showBands && (
                <>
                  <div
                    className="absolute left-0 right-0 top-0 pointer-events-none"
                    style={{ height: headerY, backgroundColor: 'rgba(99, 102, 241, 0.045)' }}
                  />
                  <div
                    className="absolute left-0 right-0 bottom-0 pointer-events-none"
                    style={{ height: h - footerY, backgroundColor: 'rgba(245, 158, 11, 0.055)' }}
                  />
                  <span className="absolute pointer-events-none select-none text-[7px] font-semibold tracking-wide" style={{ left: 4, top: 2, color: '#818cf8' }}>
                    ▲ EN-TÊTE (Page Header)
                  </span>
                  <span className="absolute pointer-events-none select-none text-[7px] font-semibold tracking-wide" style={{ left: 4, top: headerY + 2, color: '#9ca3af' }}>
                    CORPS (Detail Band)
                  </span>
                  <span className="absolute pointer-events-none select-none text-[7px] font-semibold tracking-wide" style={{ left: 4, top: footerY + 2, color: '#d97706' }}>
                    ▼ PIED DE PAGE (Page Footer)
                  </span>
                </>
              )}

              {/* Margin guides */}
              {!previewMode && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: ml,
                    top: mt,
                    width: w - ml - mr,
                    height: h - mt - mb,
                    border: '1px dashed rgba(96, 165, 250, 0.55)',
                  }}
                />
              )}

              {/* Elements */}
              {[...elements]
                .sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0))
                .map((el) =>
                  previewMode ? (
                    <div
                      key={el.id}
                      style={{
                        position: 'absolute',
                        left: el.x, top: el.y, width: el.width, height: el.height,
                        zIndex: el.z_index,
                        display: el.visible === false ? 'none' : undefined,
                        transform: el.rotation ? `rotate(${el.rotation}deg)` : undefined,
                        opacity: el.opacity ?? 1,
                      }}
                    >
                      <ElementContent el={el} previewMode={true} testData={testData} />
                    </div>
                  ) : (
                    <CanvasElement
                      key={el.id}
                      el={el}
                      isSelected={el.id === selectedId}
                      zoom={zoom}
                      readOnly={readOnly}
                      onSelect={() => onSelect(el.id)}
                      onChange={onChange}
                      onContextMenu={
                        readOnly
                          ? undefined
                          : (e) => setMenu({ x: e.clientX, y: e.clientY, elId: el.id })
                      }
                      onEdit={readOnly ? undefined : () => setEditingId(el.id)}
                    />
                  ),
                )}

              {/* Band separators — draggable in designer mode only */}
              {showBands && !readOnly && onPageChange && (
                <>
                  <BandSeparator
                    y={headerY}
                    zoom={zoom}
                    color="#818cf8"
                    label="En-tête"
                    min={10 * MM_TO_PX}
                    max={footerY - 10 * MM_TO_PX}
                    onCommit={(yPx) => onPageChange({ ...page, header_height: Math.round(yPx / MM_TO_PX) })}
                  />
                  <BandSeparator
                    y={footerY}
                    zoom={zoom}
                    color="#f59e0b"
                    label="Pied de page"
                    min={headerY + 10 * MM_TO_PX}
                    max={h - 5 * MM_TO_PX}
                    onCommit={(yPx) => onPageChange({ ...page, footer_height: Math.round((h - yPx) / MM_TO_PX) })}
                  />
                </>
              )}
            </div>
          </div>

          {/* Format label + zoom hint */}
          <div
            className="absolute flex items-center justify-between text-[10px] text-gray-400 select-none"
            style={{ left: RULER_SIZE, right: 0, top: RULER_SIZE + scaledH + 4 }}
          >
            <span>
              {page.format} · {page.orientation} · <strong>{Math.round(zoom * 100)}%</strong>
            </span>
            <span className="italic">Ctrl+scroll pour zoomer · double-clic pour ajuster</span>
          </div>
        </div>
      </div>

      {/* Right-click context menu */}
      {menu && menuEl && (
        <ContextMenu
          x={menu.x}
          y={menu.y}
          onClose={() => setMenu(null)}
          actions={[
            { icon: '✏️', label: 'Modifier…', onClick: () => setEditingId(menuEl.id) },
            { icon: '📄', label: 'Dupliquer', onClick: () => duplicateElement(menuEl) },
            {
              icon: '⬆', label: 'Premier plan', divider: true,
              onClick: () => onChange({ ...menuEl, z_index: Math.max(0, ...elements.map((e) => e.z_index ?? 0)) + 1 }),
            },
            {
              icon: '⬇', label: 'Arrière-plan',
              onClick: () => onChange({ ...menuEl, z_index: Math.min(0, ...elements.map((e) => e.z_index ?? 0)) - 1 }),
            },
            {
              icon: menuEl.visible === false ? '👁' : '🚫',
              label: menuEl.visible === false ? 'Afficher' : 'Masquer',
              divider: true,
              onClick: () => onChange({ ...menuEl, visible: menuEl.visible === false }),
            },
            {
              icon: menuEl.locked ? '🔓' : '🔒',
              label: menuEl.locked ? 'Déverrouiller' : 'Verrouiller',
              onClick: () => onChange({ ...menuEl, locked: !menuEl.locked }),
            },
            {
              icon: '🗑', label: 'Supprimer', danger: true, divider: true,
              onClick: () => removeElement(menuEl.id),
            },
          ]}
        />
      )}

      {/* Quick-edit modal (from context menu → Modifier…) */}
      {editingEl && (
        <ElementEditModal
          element={editingEl}
          onClose={() => setEditingId(null)}
          onSave={onChange}
        />
      )}
    </div>
  );
});
