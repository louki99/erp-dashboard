import { useState } from 'react';
import { Textarea } from '@/components/ui/textarea';
import { useRenderPreview } from '@/hooks/document-studio/use-templates';
import { useDesignerStore } from '@/stores/designer-store';

export function LivePreviewFrame() {
  const { template, testData, setTestData } = useDesignerStore();
  const [html, setHtml]               = useState('');
  const [showJson, setShowJson]       = useState(false);
  const [jsonDraft, setJsonDraft]     = useState('');
  const [jsonError, setJsonError]     = useState('');

  const { mutate: doPreview, isPending } = useRenderPreview();

  const handlePreview = () => {
    if (!template) return;
    doPreview(
      { templateCode: template.code, data: testData },
      { onSuccess: (h) => setHtml(h) },
    );
  };

  const openJson = () => {
    setJsonDraft(JSON.stringify(testData, null, 2));
    setJsonError('');
    setShowJson(true);
  };

  const handleJsonChange = (raw: string) => {
    setJsonDraft(raw);
    try {
      setTestData(JSON.parse(raw));
      setJsonError('');
    } catch {
      setJsonError('JSON invalide');
    }
  };

  return (
    <div className="flex h-full min-h-0">

      {/* ── Main preview area ─────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0 min-h-0">

        {/* Sub-toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b bg-[#16161e] shrink-0">
          <button
            onClick={handlePreview}
            disabled={!template || isPending}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors"
          >
            {isPending
              ? <><span className="animate-spin">⏳</span> Génération…</>
              : <><span>▶</span> Générer l'aperçu</>
            }
          </button>

          <button
            onClick={showJson ? () => setShowJson(false) : openJson}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
              showJson
                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                : 'bg-white/5 border-white/10 text-slate-400 hover:text-white hover:bg-white/10'
            }`}
          >
            <span className="font-mono">{'{ }'}</span>
            <span>Données test</span>
          </button>

          {html && (
            <>
              <div className="h-4 w-px bg-white/10 mx-1" />
              <button
                onClick={() => setHtml('')}
                className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
              >
                Réinitialiser
              </button>
            </>
          )}

          <div className="ml-auto text-xs text-slate-500">
            {template ? (
              <span>Template : <span className="text-slate-300 font-mono">{template.code}</span></span>
            ) : (
              <span>Aucun template sélectionné</span>
            )}
          </div>
        </div>

        {/* Preview canvas */}
        <div className="flex-1 overflow-auto bg-[#e8eaed] min-h-0">
          {html ? (
            <div
              style={{
                minWidth:       '100%',
                width:          'max-content',
                minHeight:      '100%',
                display:        'flex',
                justifyContent: 'center',
                alignItems:     'flex-start',
                padding:        '32px 24px',
                boxSizing:      'border-box',
              }}
            >
              <div className="shadow-2xl rounded-sm bg-white" style={{ width: 794 }}>
                <iframe
                  className="block w-full rounded-sm"
                  style={{ minHeight: 1123, border: 'none' }}
                  srcDoc={html}
                  title="Aperçu document"
                  sandbox="allow-same-origin"
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center p-8">
              <div className="w-20 h-20 rounded-2xl bg-white/60 shadow-md flex items-center justify-center text-4xl">
                📄
              </div>
              <div>
                <p className="text-sm font-medium text-gray-700">Aperçu du document</p>
                <p className="text-xs text-gray-500 mt-1">
                  {template
                    ? 'Cliquez sur "Générer l\'aperçu" pour visualiser le rendu HTML du template'
                    : 'Sélectionnez un template puis cliquez sur "Générer l\'aperçu"'}
                </p>
              </div>
              <button
                onClick={handlePreview}
                disabled={!template || isPending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-colors shadow"
              >
                {isPending ? '⏳ Génération…' : '▶ Générer l\'aperçu'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── JSON side panel ───────────────────────────────────────────── */}
      {showJson && (
        <div className="w-80 shrink-0 border-l bg-[#1a1a2e] flex flex-col">
          <div className="flex items-center justify-between px-3 py-2 border-b border-white/10 shrink-0">
            <span className="text-xs font-medium text-slate-300">Données test (JSON)</span>
            <button
              onClick={() => setShowJson(false)}
              className="text-slate-500 hover:text-slate-300 text-lg leading-none transition-colors"
            >
              ×
            </button>
          </div>

          <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">
            <Textarea
              className="flex-1 min-h-0 text-xs font-mono resize-none bg-[#0d0d1a] border-white/10 text-slate-200 focus:border-indigo-500/50"
              value={jsonDraft}
              onChange={(e) => handleJsonChange(e.target.value)}
              spellCheck={false}
            />
            {jsonError && (
              <p className="text-xs text-red-400 flex items-center gap-1">
                <span>⚠</span> {jsonError}
              </p>
            )}
            <p className="text-[10px] text-slate-600">
              Les données sont appliquées en temps réel lors de la génération de l'aperçu.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
