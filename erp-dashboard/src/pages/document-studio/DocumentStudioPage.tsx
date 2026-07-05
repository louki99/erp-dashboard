import { useState } from 'react';
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

export default function DocumentStudioPage() {
  const [view, setView]     = useState<'list' | 'editor'>('list');
  const [tab, setTab]       = useState<Tab>('designer');
  const [zoom, setZoom]     = useState(1);

  const {
    template, version, page, elements, selectedId,
    setTemplate, setVersion, selectElement, updateElement,
    isDirty, markSaved, undo, redo,
  } = useDesignerStore();

  const { mutate: createVersion, isPending: saving } = useCreateVersion(template?.id ?? '');
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
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 border-b bg-background shrink-0">
        <Button variant="ghost" size="sm" onClick={() => setView('list')}>
          ← Templates
        </Button>
        <span className="font-medium text-sm">{template?.name}</span>
        {isDirty && <Badge variant="outline" className="text-xs">Non sauvegardé</Badge>}
        {version && <Badge variant="secondary" className="text-xs">v{version.version_number}</Badge>}

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={undo} title="Annuler (Ctrl+Z)">↩</Button>
          <Button variant="ghost" size="sm" onClick={redo} title="Rétablir (Ctrl+Y)">↪</Button>
          <Button variant="outline" size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : '💾 Sauvegarder'}
          </Button>
          <div className="flex rounded border overflow-hidden">
            {(['pdf', 'xlsx', 'docx'] as const).map((fmt) => (
              <button
                key={fmt}
                className="px-3 py-1 text-xs hover:bg-muted transition-colors border-r last:border-r-0"
                onClick={() => handleGenerate(fmt)}
                disabled={generating}
              >
                {fmt.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 py-1 border-b shrink-0 bg-muted/30">
        {(['designer', 'versions', 'preview'] as Tab[]).map((t) => (
          <button
            key={t}
            className={`px-3 py-1 text-xs rounded-sm font-medium transition-colors ${
              tab === t ? 'bg-background shadow-sm' : 'hover:bg-background/60'
            }`}
            onClick={() => setTab(t)}
          >
            {t === 'designer' ? 'Designer' : t === 'versions' ? 'Versions' : 'Live Preview'}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-muted-foreground">Zoom :</span>
          {[0.5, 0.75, 1, 1.25, 1.5].map((z) => (
            <button
              key={z}
              className={`px-2 py-0.5 text-xs rounded ${zoom === z ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
              onClick={() => setZoom(z)}
            >
              {Math.round(z * 100)}%
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex flex-1 min-h-0">
        {tab === 'designer' && (
          <>
            <ToolPalette />
            <DesignerCanvas
              page={page}
              elements={elements}
              selectedId={selectedId}
              zoom={zoom}
              onSelect={selectElement}
              onChange={updateElement.bind(null, selectedId ?? '')}
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
