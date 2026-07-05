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
} from '@/types/document-studio.types';

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
    mutationFn: async (payload: {
      label?:         string;
      page_settings:  TemplateVersion['page_settings'];
      elements:       TemplateVersion['elements'];
      variables:      string[];
    }): Promise<TemplateVersion> => {
      const { data } = await apiClient.post(
        `${ENDPOINTS.DOCUMENT_STUDIO_TEMPLATES}/${templateId}/versions`,
        payload,
      );
      return data;
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
