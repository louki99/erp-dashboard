import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useRenderPreview } from '@/hooks/document-studio/use-templates';
import { useDesignerStore } from '@/stores/designer-store';

export function LivePreviewFrame() {
  const { template, testData, setTestData } = useDesignerStore();
  const [html, setHtml]             = useState('');
  const [editingJson, setEditingJson] = useState(false);
  const [jsonError, setJsonError]   = useState('');

  const { mutate: doPreview, isPending } = useRenderPreview();

  const handlePreview = () => {
    if (!template) return;
    doPreview(
      { templateCode: template.code, data: testData },
      { onSuccess: (h) => setHtml(h) },
    );
  };

  const handleJsonChange = (raw: string) => {
    try {
      setTestData(JSON.parse(raw));
      setJsonError('');
    } catch {
      setJsonError('JSON invalide');
    }
  };

  return (
    <div className="flex flex-col h-full gap-3 p-4">
      <div className="flex items-center gap-2">
        <Button size="sm" onClick={handlePreview} disabled={!template || isPending}>
          {isPending ? 'Génération…' : '▶ Générer l\'aperçu'}
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => setEditingJson((v) => !v)}
        >
          {editingJson ? 'Fermer JSON' : '{ } Données test'}
        </Button>
      </div>

      {editingJson && (
        <div className="space-y-1">
          <Textarea
            className="text-xs font-mono h-40 resize-none"
            defaultValue={JSON.stringify(testData, null, 2)}
            onChange={(e) => handleJsonChange(e.target.value)}
          />
          {jsonError && <p className="text-xs text-destructive">{jsonError}</p>}
        </div>
      )}

      {html ? (
        <iframe
          className="flex-1 rounded border bg-white"
          srcDoc={html}
          title="Aperçu document"
          sandbox="allow-same-origin"
        />
      ) : (
        <div className="flex-1 flex items-center justify-center border rounded border-dashed text-sm text-muted-foreground">
          Cliquez sur "Générer l'aperçu" pour visualiser le rendu HTML
        </div>
      )}
    </div>
  );
}
