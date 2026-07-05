import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';
import { ENDPOINTS } from '@/config/apiConfig';
import type {
  ReportRequest,
  ReportPreviewResponse,
  ReportDefinition,
  ReportDefinitionsResponse,
} from '@/types/reports.types';

// ── Catalogue ────────────────────────────────────────────────────────────────

export const useReportDefinitions = () =>
  useQuery({
    queryKey: ['reporting', 'definitions'],
    queryFn: async (): Promise<Record<string, ReportDefinition[]>> => {
      const { data } = await apiClient.get<ReportDefinitionsResponse>(
        ENDPOINTS.REPORTING_DEFINITIONS,
      );
      // Accept both { data: { clients: [...] } } and { clients: [...] } shapes
      return (data as any)?.data ?? data;
    },
    staleTime: 5 * 60 * 1000, // catalogue rarely changes — cache 5 min
  });

export const useReportDefinition = (code: string) =>
  useQuery({
    queryKey: ['reporting', 'definitions', code],
    queryFn: async (): Promise<ReportDefinition> => {
      const { data } = await apiClient.get(
        `${ENDPOINTS.REPORTING_DEFINITIONS}/${code}`,
      );
      return data;
    },
    enabled: !!code,
  });

// ── Themes ───────────────────────────────────────────────────────────────────

export const useThemes = () =>
  useQuery({
    queryKey: ['reporting', 'themes'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.REPORTING_THEMES);
      return data.themes as string[];
    },
  });

// ── Preview & Export ─────────────────────────────────────────────────────────

export const useReportPreview = () =>
  useMutation({
    mutationFn: async (
      payload: Omit<ReportRequest, 'export_format' | 'report_name'>,
    ): Promise<ReportPreviewResponse> => {
      const { data } = await apiClient.post(ENDPOINTS.REPORTING_PREVIEW, payload);
      return data;
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Erreur lors de la prévisualisation.');
    },
  });

export const useReportExport = () =>
  useMutation({
    mutationFn: async (payload: ReportRequest): Promise<{ blob: Blob; filename: string }> => {
      const response = await apiClient.post(ENDPOINTS.REPORTING_EXPORT, payload, {
        responseType: 'blob',
        // xlsx must not send Accept: application/json — browser would treat binary as text
        headers: payload.export_format === 'xlsx' ? { Accept: '*/*' } : undefined,
      });
      return { blob: response.data, filename: `${payload.report_name}.${payload.export_format}` };
    },
    onSuccess: ({ blob, filename }) => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'export.");
    },
  });
