import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateErpDocument } from '@/hooks/document-studio/use-templates';
import type { ErpDocumentType, RenderFormat, RenderResult } from '@/types/document-studio.types';

const DOC_LABELS: Record<ErpDocumentType, string> = {
  order:         'Bon de Commande',
  delivery_note: 'Bon de Livraison',
  invoice:       'Facture',
};

const DEFAULT_TEMPLATES: Record<ErpDocumentType, string> = {
  order:         'bc_standard',
  delivery_note: 'bl_standard',
  invoice:       'facture_ttc',
};

interface Props {
  documentType: ErpDocumentType;
  documentId:   number;
  variant?:     'default' | 'outline' | 'ghost';
  size?:        'default' | 'sm' | 'lg';
  className?:   string;
}

export function ErpDocumentButton({
  documentType,
  documentId,
  variant = 'outline',
  size = 'sm',
  className,
}: Props) {
  const [open, setOpen]               = useState(false);
  const [result, setResult]           = useState<RenderResult | null>(null);
  const [templateCode, setTemplate]   = useState(DEFAULT_TEMPLATES[documentType]);
  const [renderFormat, setFormat]     = useState<RenderFormat>('pdf');

  const { mutate: generate, isPending } = useGenerateErpDocument();

  const handleGenerate = () => {
    generate(
      { documentType, documentId, templateCode, renderFormat },
      {
        onSuccess: (data) => setResult(data),
      },
    );
  };

  const handleOpen = () => {
    setResult(null);
    setOpen(true);
  };

  return (
    <>
      <Button variant={variant} size={size} className={className} onClick={handleOpen}>
        📄 {DOC_LABELS[documentType]}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Générer — {DOC_LABELS[documentType]}</DialogTitle>
          </DialogHeader>

          {result ? (
            <div className="space-y-4 pt-2">
              <p className="text-sm text-green-600 font-medium">Document généré avec succès.</p>
              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  onClick={() => window.open(result.download_url, '_blank')}
                >
                  ⬇ Télécharger
                </Button>
                <Button
                  variant="outline"
                  onClick={() => { setResult(null); }}
                >
                  Nouveau
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Document #{result.document_id} archivé dans MinIO.
              </p>
            </div>
          ) : (
            <div className="space-y-3 pt-2">
              <div className="space-y-1">
                <Label className="text-xs">Template</Label>
                <Input
                  className="h-8 text-xs font-mono"
                  value={templateCode}
                  onChange={(e) => setTemplate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <Select value={renderFormat} onValueChange={(v) => setFormat(v as RenderFormat)}>
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="xlsx">Excel</SelectItem>
                    <SelectItem value="docx">Word</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex gap-2 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setOpen(false)}>
                  Annuler
                </Button>
                <Button className="flex-1" onClick={handleGenerate} disabled={!templateCode || isPending}>
                  {isPending ? 'Génération…' : 'Générer'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
