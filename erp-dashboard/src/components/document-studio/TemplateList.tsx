import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTemplates, useCreateTemplate, useDeleteTemplate } from '@/hooks/document-studio/use-templates';
import { templateCreateSchema, type TemplateCreateInput } from '@/lib/schemas';
import type { Template } from '@/types/document-studio.types';

const STATUS_COLORS: Record<string, string> = {
  draft:     'secondary',
  published: 'default',
  archived:  'outline',
};

interface Props {
  onEdit: (template: Template) => void;
}

export function TemplateList({ onEdit }: Props) {
  const [search, setSearch]       = useState('');
  const [statusFilter, setStatus] = useState('all');
  const [creating, setCreating]   = useState(false);

  const params: Record<string, unknown> = {};
  if (search)       params.search = search;
  if (statusFilter && statusFilter !== 'all') params.status = statusFilter;

  const { data, isPending } = useTemplates(params);
  const { mutate: create, isPending: isCreating } = useCreateTemplate();
  const { mutate: remove }                        = useDeleteTemplate();

  const templates: Template[] = data ?? [];

  const form = useForm<TemplateCreateInput>({
    resolver: zodResolver(templateCreateSchema),
    defaultValues: {
      code: '', name: '', description: '', document_type: 'custom',
      page_format: 'A4', page_orientation: 'portrait',
      margin_top: 10, margin_right: 10, margin_bottom: 10, margin_left: 10,
    },
  });

  const onSubmit = (values: TemplateCreateInput) => {
    create(values, { onSuccess: () => { setCreating(false); form.reset(); } });
  };

  return (
    <>
      <div className="flex items-center gap-3 mb-4">
        <Input
          className="max-w-xs text-sm"
          placeholder="Rechercher un template…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-36 text-sm">
            <SelectValue placeholder="Tous statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous</SelectItem>
            <SelectItem value="draft">Brouillon</SelectItem>
            <SelectItem value="published">Publié</SelectItem>
            <SelectItem value="archived">Archivé</SelectItem>
          </SelectContent>
        </Select>
        <Button className="ml-auto" onClick={() => setCreating(true)}>
          + Nouveau template
        </Button>
      </div>

      {isPending ? (
        <div className="text-sm text-muted-foreground p-4">Chargement…</div>
      ) : templates.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-sm text-muted-foreground border rounded-md border-dashed">
          <p>Aucun template trouvé.</p>
          <Button variant="link" onClick={() => setCreating(true)}>Créer le premier</Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {templates.map((t) => (
            <Card key={t.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-sm font-medium leading-tight">{t.name}</CardTitle>
                  <Badge variant={STATUS_COLORS[t.status] as 'default' | 'secondary' | 'outline'}>
                    {t.status}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground font-mono">{t.code}</p>
              </CardHeader>
              <CardContent>
                {t.description && (
                  <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{t.description}</p>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-3">
                  <span>{t.page_format}</span>
                  <span>·</span>
                  <span>{t.page_orientation}</span>
                  <span>·</span>
                  <span>{t.document_type}</span>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 text-xs" onClick={() => onEdit(t)}>
                    Éditer
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-xs text-destructive"
                    onClick={() => { if (confirm('Supprimer ce template ?')) remove(t.id); }}
                  >
                    ✕
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouveau template</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Code *</Label>
                <Input className="h-8 text-xs" {...form.register('code')} placeholder="bc_standard" />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Nom *</Label>
                <Input className="h-8 text-xs" {...form.register('name')} placeholder="Bon de Commande Standard" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Type de document</Label>
                <Input className="h-8 text-xs" {...form.register('document_type')} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Format page</Label>
                <Select
                  value={form.watch('page_format')}
                  onValueChange={(v) => form.setValue('page_format', v as 'A4' | 'A5' | 'letter')}
                >
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A4">A4</SelectItem>
                    <SelectItem value="A5">A5</SelectItem>
                    <SelectItem value="letter">Letter</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1">
                <Label className="text-xs">Description</Label>
                <Input className="h-8 text-xs" {...form.register('description')} />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>Annuler</Button>
              <Button type="submit" disabled={isCreating}>
                {isCreating ? 'Création…' : 'Créer'}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
