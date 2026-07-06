import { useState, useRef, useEffect } from 'react';
import toast from 'react-hot-toast';
import type { DesignerCanvasRef } from '@/components/document-studio/DesignerCanvas';
import { TemplateList } from '@/components/document-studio/TemplateList';
import { DesignerCanvas, MM_TO_PX, PAGE_DIMS } from '@/components/document-studio/DesignerCanvas';
import { ToolPalette } from '@/components/document-studio/ToolPalette';
import { PropertiesPanel } from '@/components/document-studio/PropertiesPanel';
import { SimpleEditPanel } from '@/components/document-studio/SimpleEditPanel';
import { VersionsPanel } from '@/components/document-studio/VersionsPanel';
import { LivePreviewFrame } from '@/components/document-studio/LivePreviewFrame';
import { MasterLayout } from '@/components/layout/MasterLayout';
import { Badge } from '@/components/ui/badge';
import { useDesignerStore } from '@/stores/designer-store';
import {
  useTemplates,
  useTemplateVersions,
  useTemplateVersionDetail,
  useCreateVersion,
  useStreamDocument,
} from '@/hooks/document-studio/use-templates';
import type { Template } from '@/types/document-studio.types';

const STATUS_TABS = [
  { value: 'all',       label: 'Tous',       icon: '📋' },
  { value: 'published', label: 'Publiés',    icon: '✅' },
  { value: 'draft',     label: 'Brouillons', icon: '✏️' },
  { value: 'archived',  label: 'Archivés',   icon: '📁' },
];

// Fetches the best version for the current template and loads it into the store.
// Must be rendered inside the editor view so it only runs when editing.
function VersionAutoLoader() {
  const { template, setVersion } = useDesignerStore();
  const [targetId, setTargetId] = useState('');
  const didPick = useRef(false);

  const { data: versions } = useTemplateVersions(template?.id ?? '');
  const { data: fullVersion } = useTemplateVersionDetail(template?.id ?? '', targetId);

  // Reset when user switches to a different template
  useEffect(() => {
    didPick.current = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTargetId('');
  }, [template?.id]);

  // Pick published version first, then latest
  useEffect(() => {
    if (!versions?.length || didPick.current) return;
    const published = versions.find((v) => v.is_published);
    const best = published ?? versions[versions.length - 1];
    if (best) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setTargetId(best.id);
      didPick.current = true;
    }
  }, [versions]);

  // Load full version (with elements) into the store
  useEffect(() => {
    if (fullVersion) setVersion(fullVersion);
  }, [fullVersion, setVersion]);

  return null;
}

type Tab = 'designer' | 'versions' | 'preview';

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 8.0;
const STEP     = 0.1;

export default function DocumentStudioPage() {
  const [view,         setView]        = useState<'list' | 'editor'>('list');
  const [tab,          setTab]         = useState<Tab>('designer');
  const [zoom,         setZoom]        = useState(1);
  const [search,       setSearch]      = useState('');
  const [statusFilter, setStatusFilter]= useState('all');
  const [createOpen,   setCreateOpen]  = useState(false);

  // Stats for sidebar — fetches all templates regardless of current filter
  const { data: allTemplates = [] } = useTemplates({});
  const stats = {
    total:     allTemplates.length,
    published: allTemplates.filter((t) => t.status === 'published').length,
    draft:     allTemplates.filter((t) => t.status === 'draft').length,
    archived:  allTemplates.filter((t) => t.status === 'archived').length,
  };

  const fitValuesRef = useRef({ page: 1, width: 1 });
  const canvasRef = useRef<DesignerCanvasRef | null>(null);

  const {
    template, version, page, elements, selectedId,
    setTemplate, setVersion, setPage, selectElement, updateElement, setElementsBulk,
    isDirty, markSaved, undo, redo,
    previewMode, setPreviewMode,
    editorMode, setEditorMode,
  } = useDesignerStore();

  const isSimpleMode = editorMode === 'simple';

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

  // Proportionally rescale ALL elements so the content fills the printable
  // area. Fixes templates authored in a smaller coordinate space (mm/points
  // instead of page px). Single history entry → one Ctrl+Z restores everything.
  const handleFitContent = () => {
    if (!elements.length) return;

    const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;
    const pageWmm = page.orientation === 'landscape' ? dims.h : dims.w;
    const pageHmm = page.orientation === 'landscape' ? dims.w : dims.h;
    const w = pageWmm * MM_TO_PX;
    const h = pageHmm * MM_TO_PX;
    const ml = (page.margin_left ?? 10) * MM_TO_PX;
    const mr = (page.margin_right ?? 10) * MM_TO_PX;
    const mt = (page.margin_top ?? 10) * MM_TO_PX;
    const mb = (page.margin_bottom ?? 10) * MM_TO_PX;

    const minX = Math.min(...elements.map((e) => e.x));
    const minY = Math.min(...elements.map((e) => e.y));
    const maxX = Math.max(...elements.map((e) => e.x + e.width));
    const maxY = Math.max(...elements.map((e) => e.y + e.height));
    const bboxW = maxX - minX;
    const bboxH = maxY - minY;
    if (bboxW <= 0 || bboxH <= 0) return;

    // Fit width, but never overflow the page height
    const s = Math.min((w - ml - mr) / bboxW, (h - mt - mb) / bboxH);

    setElementsBulk(
      elements.map((el) => ({
        ...el,
        x:      Math.round(ml + (el.x - minX) * s),
        y:      Math.round(mt + (el.y - minY) * s),
        width:  Math.max(2, Math.round(el.width * s)),
        height: Math.max(2, Math.round(el.height * s)),
        style: {
          ...el.style,
          font_size: el.style.font_size ? +(el.style.font_size * s).toFixed(1) : el.style.font_size,
          padding:   el.style.padding ? +(el.style.padding * s).toFixed(1) : el.style.padding,
        },
      })),
    );
    toast.success(`Contenu adapté à la page (×${s.toFixed(2)})`);
  };

  const handleZoomPreset = (preset: string) => {
    if (preset === 'page')  setZoom(fitValuesRef.current.page);
    if (preset === 'width') setZoom(fitValuesRef.current.width);
    if (preset === 'fill')  setZoom(Math.max(fitValuesRef.current.page, fitValuesRef.current.width));
    if (preset === '100')   setZoom(1);
  };

  if (view === 'list') {
    return (
      <MasterLayout
        leftContent={
          <div className="h-full flex flex-col bg-white border-r border-gray-100">
            {/* Module header */}
            <div className="p-4 border-b border-gray-100 shrink-0">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-indigo-100 flex items-center justify-center text-xl shrink-0">
                  📑
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 leading-tight">Document Studio</p>
                  <p className="text-xs text-gray-500">Templates de documents</p>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="bg-indigo-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 mb-0.5">Total</div>
                  <div className="text-xl font-bold text-indigo-700">{stats.total}</div>
                </div>
                <div className="bg-emerald-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 mb-0.5">Publiés</div>
                  <div className="text-xl font-bold text-emerald-700">{stats.published}</div>
                </div>
                <div className="bg-amber-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-500 mb-0.5">Brouillons</div>
                  <div className="text-xl font-bold text-amber-600">{stats.draft}</div>
                </div>
                <div className="bg-slate-50 rounded-lg p-2.5 border border-slate-100">
                  <div className="text-[10px] text-gray-500 mb-0.5">Archivés</div>
                  <div className="text-xl font-bold text-slate-500">{stats.archived}</div>
                </div>
              </div>
            </div>

            {/* Status filter */}
            <div className="p-3 border-b border-gray-100 shrink-0">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Filtrer par statut</p>
              <div className="flex flex-col gap-0.5">
                {STATUS_TABS.map((tab) => (
                  <button
                    key={tab.value}
                    onClick={() => setStatusFilter(tab.value)}
                    className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors text-left ${
                      statusFilter === tab.value
                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-100'
                        : 'text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                    {tab.value !== 'all' && (
                      <span className={`ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                        statusFilter === tab.value ? 'bg-indigo-100 text-indigo-600' : 'bg-gray-100 text-gray-500'
                      }`}>
                        {tab.value === 'published' ? stats.published : tab.value === 'draft' ? stats.draft : stats.archived}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* New template button */}
            <div className="p-3 mt-auto border-t border-gray-100 shrink-0">
              <button
                onClick={() => setCreateOpen(true)}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
              >
                <span className="text-sm">+</span> Nouveau template
              </button>
            </div>
          </div>
        }
        mainContent={
          <div className="h-full flex flex-col min-h-0 bg-slate-50">
            <TemplateList
              onEdit={handleEdit}
              search={search}
              statusFilter={statusFilter}
              onSearchChange={setSearch}
              createOpen={createOpen}
              onCreateOpenChange={setCreateOpen}
            />
          </div>
        }
      />
    );
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden">
      {/* ── Header / Toolbar — single line, never wraps ─────────────────── */}
      <div className="flex items-center flex-nowrap gap-1.5 px-3 py-1.5 border-b bg-[#1e1e2e] text-white shrink-0">
        <button
          onClick={() => setView('list')}
          title="Retour à la liste des templates"
          className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-300 hover:text-white hover:bg-white/10 transition-colors shrink-0 whitespace-nowrap"
        >
          ← <span className="hidden xl:inline">Templates</span>
        </button>

        <span className="font-medium text-sm text-white truncate max-w-[150px] shrink" title={template?.name}>
          {template?.name}
        </span>
        {isDirty && (
          <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" title="Modifications non sauvegardées" />
        )}
        {version && <Badge variant="secondary" className="text-[9px] shrink-0">v{version.version_number}</Badge>}

        {/* Divider */}
        <div className="h-4 w-px bg-white/10 mx-1" />

        {/* Simple / Designer mode switch */}
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-white/5 border border-white/10">
          <button
            onClick={() => setEditorMode('simple')}
            title="Mode sécurisé : textes, logo et couleurs uniquement — la mise en page est verrouillée"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              isSimpleMode
                ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            🔒 <span className="hidden xl:inline whitespace-nowrap">Simple</span>
          </button>
          <button
            onClick={() => setEditorMode('designer')}
            title="Mode avancé : contrôle total de la mise en page (réservé aux administrateurs)"
            className={`flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded-md transition-colors ${
              !isSimpleMode
                ? 'bg-indigo-500/25 text-indigo-300 border border-indigo-500/40'
                : 'text-slate-400 hover:text-white border border-transparent'
            }`}
          >
            🎨 <span className="hidden xl:inline whitespace-nowrap">Designer</span>
          </button>
        </div>

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

        {!isSimpleMode && (
          <button
            onClick={handleFitContent}
            title="Adapter à la page : redimensionne tout le contenu pour occuper la zone imprimable (annulable avec Ctrl+Z)"
            className="h-7 w-7 flex items-center justify-center rounded text-slate-400 hover:text-white hover:bg-white/10 transition-colors shrink-0"
          >
            ⤢
          </button>
        )}

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
          {/* Focus selected element */}
          <button
            onClick={() => selectedId && canvasRef.current?.focusElement(selectedId)}
            disabled={!selectedId}
            title="Centrer sur l'élément sélectionné"
            className="h-6 px-1.5 flex items-center justify-center rounded text-[10px] text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed ml-0.5"
          >
            🎯
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
            <option value="fill"  className="bg-gray-900">Fill</option>
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
              <span className="hidden lg:inline whitespace-nowrap">{t.label}</span>
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
          <span className="whitespace-nowrap">{previewMode ? '👁 Live' : '</> Tags'}</span>
        </button>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleSave}
            disabled={saving}
            title="Sauvegarder une nouvelle version"
            className="flex items-center gap-1.5 px-2.5 py-1 text-[11px] font-medium rounded border border-white/20 text-white hover:bg-white/10 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? '⏳' : '💾'} <span className="hidden lg:inline">Sauvegarder</span>
          </button>
          {/* Export dropdown — one control instead of three buttons */}
          <select
            value=""
            disabled={generating}
            onChange={(e) => {
              const fmt = e.target.value as 'pdf' | 'xlsx' | 'docx';
              (e.target as HTMLSelectElement).value = '';
              if (fmt) handleGenerate(fmt);
            }}
            title="Générer et télécharger le document"
            className="h-7 bg-white/5 border border-white/20 rounded text-[11px] text-slate-300 px-1.5 cursor-pointer disabled:opacity-50"
          >
            <option value="" disabled className="bg-gray-900">{generating ? '⏳ Export…' : '⬇ Exporter'}</option>
            <option value="pdf"  className="bg-gray-900">PDF</option>
            <option value="xlsx" className="bg-gray-900">XLSX</option>
            <option value="docx" className="bg-gray-900">DOCX</option>
          </select>
        </div>
      </div>

      {/* ── Content area ─────────────────────────────────────────────────── */}
      <VersionAutoLoader />
      <div className="flex flex-1 min-h-0">
        {tab === 'designer' && (
          <>
            {!isSimpleMode && <ToolPalette />}
            <DesignerCanvas
              ref={canvasRef}
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
              readOnly={isSimpleMode}
              onPageChange={setPage}
            />
            {isSimpleMode ? <SimpleEditPanel /> : <PropertiesPanel />}
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
