import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTemplates, useCreateTemplate, useDeleteTemplate } from '@/hooks/document-studio/use-templates';
import { templateCreateSchema, type TemplateCreateInput } from '@/lib/schemas';
import type { Template } from '@/types/document-studio.types';

const DOC_ICONS: Record<string, string> = {
  invoice:       '🧾',
  order:         '📋',
  delivery_note: '🚚',
  preparation:   '📦',
  shipment:      '🏗',
  custom:        '📄',
};

const STATUS_CONFIG: Record<string, { label: string; cls: string; dot: string }> = {
  published: { label: 'Publié',    cls: 'bg-emerald-100 text-emerald-700 border-emerald-200', dot: 'bg-emerald-500' },
  draft:     { label: 'Brouillon', cls: 'bg-amber-100 text-amber-700 border-amber-200',       dot: 'bg-amber-400'  },
  archived:  { label: 'Archivé',   cls: 'bg-slate-100 text-slate-500 border-slate-200',       dot: 'bg-slate-400'  },
};

interface Props {
  onEdit:         (template: Template) => void;
  search:         string;
  statusFilter:   string;
  onSearchChange: (v: string) => void;
  createOpen:     boolean;
  onCreateOpenChange: (open: boolean) => void;
}

export function TemplateList({
  onEdit, search, statusFilter, onSearchChange, createOpen, onCreateOpenChange,
}: Props) {
  const params: Record<string, unknown> = {};
  if (search)                                  params.search = search;
  if (statusFilter && statusFilter !== 'all')  params.status = statusFilter;

  const { data, isPending }                        = useTemplates(params);
  const { mutate: create, isPending: isCreating }  = useCreateTemplate();
  const { mutate: remove }                         = useDeleteTemplate();

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
    create(values, { onSuccess: () => { onCreateOpenChange(false); form.reset(); } });
  };

  return (
    <>
      {/* Search bar */}
      <div className="px-6 py-4 border-b bg-white shrink-0 flex items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm pointer-events-none">🔍</span>
          <Input
            className="pl-9 h-9 text-sm bg-slate-50 border-slate-200 focus:bg-white"
            placeholder="Rechercher un template…"
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <span className="text-xs text-slate-400 ml-auto">
          {templates.length} résultat{templates.length !== 1 ? 's' : ''}
        </span>
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-auto bg-slate-50 px-6 py-5">
        {isPending ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 rounded-2xl bg-white border border-slate-100 animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 gap-4 text-center">
            <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl">
              🔍
            </div>
            <div>
              <p className="text-sm font-medium text-slate-700">Aucun template trouvé</p>
              <p className="text-xs text-slate-400 mt-1">Essayez d'autres critères ou créez un nouveau template</p>
            </div>
            <button
              onClick={() => onCreateOpenChange(true)}
              className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 transition-colors"
            >
              + Nouveau template
            </button>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {templates.map((t) => {
              const status = STATUS_CONFIG[t.status] ?? STATUS_CONFIG.draft;
              const icon   = DOC_ICONS[t.document_type] ?? '📄';
              return (
                <div
                  key={t.id}
                  className="group bg-white rounded-2xl border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-200 flex flex-col overflow-hidden"
                >
                  <div className={`h-0.5 w-full ${t.status === 'published' ? 'bg-emerald-400' : t.status === 'draft' ? 'bg-amber-400' : 'bg-slate-200'}`} />

                  <div className="p-5 flex flex-col gap-3 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-xl shrink-0">
                          {icon}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-800 leading-tight line-clamp-1">{t.name}</p>
                          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{t.code}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${status.cls}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                        {status.label}
                      </span>
                    </div>

                    {t.description && (
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">{t.description}</p>
                    )}

                    <div className="flex items-center gap-1.5 flex-wrap mt-auto">
                      {[t.page_format, t.page_orientation, t.document_type].map((tag) => (
                        <span key={tag} className="text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="px-5 pb-4 flex items-center gap-2">
                    <button
                      onClick={() => onEdit(t)}
                      className="flex-1 flex items-center justify-center gap-2 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold transition-colors shadow-sm"
                    >
                      ✏️ Éditer
                    </button>
                    <button
                      onClick={() => { if (confirm('Supprimer ce template ?')) remove(t.id); }}
                      className="w-9 h-9 rounded-xl border border-slate-200 hover:border-red-200 hover:bg-red-50 text-slate-400 hover:text-red-500 flex items-center justify-center transition-colors text-sm"
                      title="Supprimer"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={onCreateOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span>📄</span> Nouveau template
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 mt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Code *</Label>
                <Input className="h-8 text-xs" {...form.register('code')} placeholder="bc_standard" />
                {form.formState.errors.code && (
                  <p className="text-xs text-destructive">{form.formState.errors.code.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Nom *</Label>
                <Input className="h-8 text-xs" {...form.register('name')} placeholder="Bon de Commande" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Type de document</Label>
                <Input className="h-8 text-xs" {...form.register('document_type')} placeholder="invoice" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Format page</Label>
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
              <div className="col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Description</Label>
                <Input className="h-8 text-xs" {...form.register('description')} placeholder="Description du template…" />
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => onCreateOpenChange(false)}
                className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={isCreating}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-500 disabled:opacity-50 transition-colors"
              >
                {isCreating ? 'Création…' : 'Créer le template'}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
