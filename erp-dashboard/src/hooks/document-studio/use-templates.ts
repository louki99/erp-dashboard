import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';
import { ENDPOINTS } from '@/config/apiConfig';
import type {
  Template,
  TemplateCreatePayload,
  TemplateVersion,
  RenderResult,
  GenerateErpPayload,
  DesignerElement,
} from '@/types/document-studio.types';

/**
 * Strips canvas-only fields before sending an element to the MS.
 * Allowed: type · name · x · y · width · height · binding · properties · style
 * Also drops null property keys and base64 `src` (images must use a binding).
 */
function sanitizeElement(el: DesignerElement): Record<string, unknown> {
  const properties = Object.fromEntries(
    Object.entries(el.properties ?? {}).filter(
      ([key, value]) => value != null && !(key === 'src' && String(value).startsWith('data:')),
    ),
  );
  const out: Record<string, unknown> = {
    type:       el.type,
    x:          el.x,
    y:          el.y,
    width:      el.width,
    height:     el.height,
    properties,
    style:      el.style ?? {},
  };
  if (el.name)    out.name = el.name;
  if (el.binding) out.binding = el.binding;
  return out;
}

const TEMPLATES_KEY = ['document-studio', 'templates'];

export const useTemplates = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: [...TEMPLATES_KEY, params],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES, { params });
      // API returns { items: [], total: N }
      const items: Template[] = Array.isArray(data) ? data : (data?.items ?? data?.data ?? []);
      return items;
    },
  });

export const useTemplate = (id: string) =>
  useQuery({
    queryKey: [...TEMPLATES_KEY, id],
    queryFn: async () => {
      const { data } = await apiClient.get(`${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${id}`);
      return data as Template;
    },
    enabled: !!id,
  });

export const useCreateTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: TemplateCreatePayload): Promise<Template> => {
      const { data } = await apiClient.post(ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast.success('Template créé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la création.');
    },
  });
};

export const useUpdateTemplate = (id: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<TemplateCreatePayload>): Promise<Template> => {
      const { data } = await apiClient.put(`${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${id}`, payload);
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast.success('Template mis à jour.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la mise à jour.');
    },
  });
};

export const useDeleteTemplate = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      await apiClient.delete(`${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${id}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TEMPLATES_KEY });
      toast.success('Template supprimé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la suppression.');
    },
  });
};

export const useTemplateVersions = (templateId: string) =>
  useQuery({
    queryKey: [...TEMPLATES_KEY, templateId, 'versions'],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions`,
      );
      return data as TemplateVersion[];
    },
    enabled: !!templateId,
  });

export const useTemplateVersionDetail = (templateId: string, versionId: string) =>
  useQuery({
    queryKey: [...TEMPLATES_KEY, templateId, 'versions', versionId],
    queryFn: async () => {
      const { data } = await apiClient.get(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions/${versionId}`,
      );
      return data as TemplateVersion;
    },
    enabled: !!templateId && !!versionId,
  });

export const useCreateVersion = (templateId: string) => {
  const qc = useQueryClient();
  return useMutation({
    // Certified backend flow: create the version empty, then POST each
    // sanitized element to /versions/{vid}/elements, then refetch the full
    // version (the create response has no elements).
    mutationFn: async (payload: {
      label?:         string;
      page_settings:  TemplateVersion['page_settings'];
      elements:       DesignerElement[];
      variables:      string[];
    }): Promise<TemplateVersion> => {
      const label = (payload.label?.trim() ||
        `v-${new Date().toISOString().slice(0, 16).replace('T', ' ')}`).slice(0, 100);

      // 1. Version without elements — label is required by the Laravel controller
      const { data: created } = await apiClient.post(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions`,
        {
          label,
          page_settings: payload.page_settings,
          variables:     payload.variables,
          elements:      [],
        },
      );
      const versionId: string = created.id;

      // 2. One POST per element, in z-order so stacking survives the round-trip
      const ordered = [...payload.elements].sort((a, b) => (a.z_index ?? 0) - (b.z_index ?? 0));
      for (const el of ordered) {
        await apiClient.post(
          `${ENDPOINTS.DOCUMENT_STUDIO_VERSIONS}/${versionId}/elements`,
          sanitizeElement(el),
        );
      }

      // 3. Return the complete version so the store reloads with elements
      const { data: full } = await apiClient.get(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions/${versionId}`,
      );
      return full as TemplateVersion;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, templateId, 'versions'] });
      toast.success('Version sauvegardée.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la sauvegarde.');
    },
  });
};

export const usePublishVersion = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      templateId,
      versionId,
    }: {
      templateId: string;
      versionId:  string;
    }): Promise<void> => {
      await apiClient.post(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions/${versionId}/publish`,
      );
    },
    onSuccess: (_, { templateId }) => {
      qc.invalidateQueries({ queryKey: [...TEMPLATES_KEY, templateId, 'versions'] });
      toast.success('Version publiée.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la publication.');
    },
  });
};

export const useGenerateErpDocument = () =>
  useMutation({
    mutationFn: async ({
      documentType,
      documentId,
      templateCode,
      renderFormat = 'pdf',
    }: GenerateErpPayload): Promise<RenderResult> => {
      const endpointMap = {
        order:         ENDPOINTS.RENDER_GENERATE_ORDER,
        delivery_note: ENDPOINTS.RENDER_GENERATE_DELIVERY_NOTE,
        invoice:       ENDPOINTS.RENDER_GENERATE_INVOICE,
      } as const;

      const { data } = await apiClient.post(
        `${endpointMap[documentType]}/${documentId}`,
        { template_code: templateCode, render_format: renderFormat },
      );
      return data;
    },
    onSuccess: () => {
      toast.success('Document généré et archivé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la génération.');
    },
  });

export const useStreamDocument = () =>
  useMutation({
    mutationFn: async ({
      templateCode,
      renderFormat = 'pdf',
      filename,
      data,
    }: {
      templateCode:  string;
      renderFormat?: 'pdf' | 'xlsx' | 'docx';
      filename:      string;
      data?:         Record<string, unknown>;
    }): Promise<void> => {
      const response = await apiClient.post(
        ENDPOINTS.RENDER_STREAM,
        { template_code: templateCode, render_format: renderFormat, filename, data },
        { responseType: 'blob' },
      );
      const url = URL.createObjectURL(response.data);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${filename}.${renderFormat}`;
      a.click();
      URL.revokeObjectURL(url);
    },
    onSuccess: () => {
      toast.success('Document téléchargé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors du téléchargement.');
    },
  });

export const useRenderPreview = () =>
  useMutation({
    mutationFn: async ({
      templateCode,
      data,
    }: {
      templateCode: string;
      data:         Record<string, unknown>;
    }): Promise<string> => {
      const response = await apiClient.post(ENDPOINTS.RENDER_PREVIEW, {
        template_code: templateCode,
        data,
      });
      return response.data.html as string;
    },
  });
