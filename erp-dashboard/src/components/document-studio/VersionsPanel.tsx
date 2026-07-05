import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useTemplateVersions, useCreateVersion, usePublishVersion } from '@/hooks/document-studio/use-templates';
import { useDesignerStore } from '@/stores/designer-store';
import type { TemplateVersion } from '@/types/document-studio.types';

export function VersionsPanel() {
  const [label, setLabel] = useState('');
  const { template, version, page, elements, setVersion, markSaved } = useDesignerStore();

  const { data: versions = [], isPending } = useTemplateVersions(template?.id ?? '');
  const { mutate: createVersion, isPending: saving }   = useCreateVersion(template?.id ?? '');
  const { mutate: publishVersion, isPending: publishing } = usePublishVersion();

  if (!template) {
    return (
      <div className="p-4 text-xs text-muted-foreground">Aucun template chargé.</div>
    );
  }

  const handleSave = () => {
    const variables = [...new Set(
      elements
        .map((el) => el.binding)
        .filter((b): b is string => !!b)
        .map((b) => b.replace(/\{\{|\}\}/g, '').trim()),
    )];

    createVersion(
      { label: label || undefined, page_settings: page, elements, variables },
      { onSuccess: (v) => { setVersion(v); markSaved(); setLabel(''); } },
    );
  };

  const handleRestore = (v: TemplateVersion) => {
    setVersion(v);
  };

  const handlePublish = (v: TemplateVersion) => {
    publishVersion({ templateId: template.id, versionId: v.id });
  };

  return (
    <div className="p-4 space-y-4">
      <div className="space-y-2">
        <p className="text-sm font-medium">Sauvegarder une version</p>
        <div className="flex gap-2">
          <Input
            className="h-8 text-xs"
            placeholder="Libellé (optionnel)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? 'Sauvegarde…' : 'Sauvegarder'}
          </Button>
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-medium">Historique des versions</p>
        {isPending ? (
          <p className="text-xs text-muted-foreground">Chargement…</p>
        ) : versions.length === 0 ? (
          <p className="text-xs text-muted-foreground">Aucune version sauvegardée.</p>
        ) : (
          <div className="space-y-2">
            {[...versions].reverse().map((v) => (
              <div key={v.id} className="flex items-center gap-2 p-2 rounded border text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-medium">v{v.version_number}</span>
                    {v.is_published && <Badge className="text-[10px] h-4">Publiée</Badge>}
                    {v.id === version?.id && (
                      <Badge variant="outline" className="text-[10px] h-4">Active</Badge>
                    )}
                  </div>
                  {v.label && <p className="text-muted-foreground truncate">{v.label}</p>}
                  <p className="text-muted-foreground">
                    {new Date(v.created_at).toLocaleString('fr-FR')}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-6 text-[10px] px-2"
                    onClick={() => handleRestore(v)}
                  >
                    Restaurer
                  </Button>
                  {!v.is_published && (
                    <Button
                      size="sm"
                      className="h-6 text-[10px] px-2"
                      onClick={() => handlePublish(v)}
                      disabled={publishing}
                    >
                      Publier
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
