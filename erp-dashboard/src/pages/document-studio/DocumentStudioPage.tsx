import { useState, useRef } from 'react';
import { TemplateList } from '@/components/document-studio/TemplateList';
import { DesignerCanvas } from '@/components/document-studio/DesignerCanvas';
import { ToolPalette } from '@/components/document-studio/ToolPalette';
import { PropertiesPanel } from '@/components/document-studio/PropertiesPanel';
import { VersionsPanel } from '@/components/document-studio/VersionsPanel';
import { LivePreviewFrame } from '@/components/document-studio/LivePreviewFrame';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useDesignerStore } from '@/stores/designer-store';
import { useCreateVersion, useStreamDocument } from '@/hooks/document-studio/use-templates';
import type { Template } from '@/types/document-studio.types';

type Tab = 'designer' | 'versions' | 'preview';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4.0;
const STEP     = 0.1;

export default function DocumentStudioPage() {
  const [view, setView] = useState<'list' | 'editor'>('list');
  const [tab,  setTab]  = useState<Tab>('designer');
  const [zoom, setZoom] = useState(1);

  const fitValuesRef = useRef({ page: 1, width: 1 });

  const {
    template, version, page, elements, selectedId,
    setTemplate, setVersion, selectElement, updateElement,
    isDirty, markSaved, undo, redo,
    previewMode, setPreviewMode,
  } = useDesignerStore();

  const { mutate: createVersion, isPending: saving }    = useCreateVersion(template?.id ?? '');
  const { mutate: streamDoc,     isPending: generating } = useStreamDocument();

  const handleEdit = (t: Template) => {
    setTemplate(t);
    setView('editor');
    setTab('designer');
  };

  const handleSave = () => {
    if (!template) return;
    const variables = [...new Set(
      elements
        .map((el) => el.binding)
        .filter((b): b is string => !!b)
        .map((b) => b.replace(/\{\{|\}\}/g, '').trim()),
    )];
    createVersion(
      { page_settings: page, elements, variables },
      { onSuccess: (v) => { setVersion(v); markSaved(); } },
    );
  };

  const handleGenerate = (fmt: 'pdf' | 'xlsx' | 'docx') => {
    if (!template) return;
    streamDoc({
      templateCode: template.code,
      renderFormat: fmt,
      filename: `${template.code}_preview`,
    });
  };

  const handleZoomPreset = (preset: string) => {
    if (preset === 'page')  setZoom(fitValuesRef.current.page);
    if (preset === 'width') setZoom(fitValuesRef.current.width);
    if (preset === '100')   setZoom(1);
  };

  if (view === 'list') {
    return (
      <div className="p-6">
        <h1 className="text-2xl font-semibold mb-6">Document Studio</h1>
        <TemplateList onEdit={handleEdit} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header / Toolbar ─────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 px-4 py-2 border-b bg-[#1e1e2e] text-white shrink-0">
        <Button
          variant="ghost"
          size="sm"
          className="text-slate-300 hover:text-white hover:bg-white/10"
          onClick={() => setView('list')}
        >
          ← Templates
        </Button>

        <span className="font-medium text-sm text-white truncate">{template?.name}</span>
        {isDirty   && <Badge variant="outline" className="text-[9px] border-amber-400/40 text-amber-300">Non sauvegardé</Badge>}
        {version   && <Badge variant="secondary" className="text-[9px]">v{version.version_number}</Badge>}

        {/* Divider */}
        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Undo / Redo */}
        <button
          onClick={undo}
          title="Annuler (Ctrl+Z)"
          className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          ↩
        </button>
        <button
          onClick={redo}
          title="Rétablir (Ctrl+Y)"
          className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
        >
          ↪
        </button>

        {/* Divider */}
        <div className="h-4 w-px bg-white/10" />

        {/* Zoom controls */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/5 border border-white/10">
          <button
            onClick={() => setZoom((z) => +Math.max(MIN_ZOOM, z - STEP).toFixed(2))}
            title="Zoom arrière"
            className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors font-bold"
          >
            −
          </button>
          <span className="w-11 text-center text-[11px] font-medium text-slate-300">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => +Math.min(MAX_ZOOM, z + STEP).toFixed(2))}
            title="Zoom avant"
            className="h-6 w-6 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors font-bold"
          >
            +
          </button>
          {/* Zoom preset select */}
          <select
            value=""
            onChange={(e) => { handleZoomPreset(e.target.value); (e.target as HTMLSelectElement).value = ''; }}
            className="h-6 bg-white/5 border border-white/10 rounded text-[10px] text-slate-300 px-1 cursor-pointer ml-0.5"
          >
            <option value="" disabled className="bg-gray-900">Preset</option>
            <option value="page"  className="bg-gray-900">Fit Page</option>
            <option value="width" className="bg-gray-900">Fit Width</option>
            <option value="100"   className="bg-gray-900">100%</option>
          </select>
        </div>

        {/* Divider */}
        <div className="h-4 w-px bg-white/10" />

        {/* Tabs */}
        <div className="flex items-center gap-0.5 px-1 py-0.5 rounded bg-white/5 border border-white/10">
          {([
            { key: 'designer' as const, label: 'Designer', icon: '✏️' },
            { key: 'versions' as const, label: 'Versions',  icon: '🕐' },
            { key: 'preview'  as const, label: 'Aperçu',    icon: '👁' },
          ]).map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded transition-colors ${
                tab === t.key
                  ? 'bg-white/20 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-white/10'
              }`}
            >
              <span>{t.icon}</span>
              <span className="hidden sm:inline">{t.label}</span>
            </button>
          ))}
        </div>

        {/* Tags / Live Data toggle */}
        <button
          onClick={() => setPreviewMode(!previewMode)}
          className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border transition-colors ${
            previewMode
              ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
              : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
          }`}
          title="Basculer entre les tags bruts et les données mock"
        >
          {previewMode ? '👁 Live Data' : '</> Tags'}
        </button>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleSave}
            disabled={saving}
            className="h-7 text-xs border-white/20 text-white bg-transparent hover:bg-white/10 hover:text-white"
          >
            {saving ? '⏳ Sauvegarde…' : '💾 Sauvegarder'}
          </Button>
          <div className="flex rounded border border-white/20 overflow-hidden">
            {(['pdf', 'xlsx', 'docx'] as const).map((fmt, i) => (
              <button
                key={fmt}
                onClick={() => handleGenerate(fmt)}
                disabled={generating}
                className={`px-2.5 py-1 text-[10px] font-medium text-slate-300 hover:bg-white/10 hover:text-white transition-colors ${
                  i > 0 ? 'border-l border-white/20' : ''
                }`}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <div className="flex flex-1 min-h-0">
        {tab === 'designer' && (
          <>
            <ToolPalette />
            <DesignerCanvas
              page={page}
              elements={elements}
              selectedId={selectedId}
              zoom={zoom}
              onZoomChange={setZoom}
              onSelect={selectElement}
              onChange={(el) => updateElement(el.id, el)}
              onFitComputed={(fitPage, fitWidth) => {
                fitValuesRef.current = { page: fitPage, width: fitWidth };
              }}
            />
            <PropertiesPanel />
          </>
        )}
        {tab === 'versions' && (
          <div className="flex-1 overflow-auto">
            <VersionsPanel />
          </div>
        )}
        {tab === 'preview' && (
          <div className="flex-1 min-h-0">
            <LivePreviewFrame />
          </div>
        )}
      </div>
    </div>
  );
}
