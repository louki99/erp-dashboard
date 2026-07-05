import { useMutation, useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import apiClient from '@/services/api/client';
import { ENDPOINTS } from '@/config/apiConfig';
import type { ReportRequest, ReportPreviewResponse } from '@/types/reports.types';

export const useThemes = () =>
  useQuery({
    queryKey: ['reporting', 'themes'],
    queryFn: async () => {
      const { data } = await apiClient.get(ENDPOINTS.REPORTING_THEMES);
      return data.themes as string[];
    },
  });

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
    mutationFn: async (payload: ReportRequest): Promise<Blob> => {
      const response = await apiClient.post(ENDPOINTS.REPORTING_EXPORT, payload, {
        responseType: 'blob',
      });
      return response.data;
    },
    onSuccess: (blob, payload) => {
      const ext = payload.export_format;
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href     = url;
      a.download = `${payload.report_name}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Export téléchargé.');
    },
    onError: (error: Error) => {
      toast.error(error.message || "Erreur lors de l'export.");
    },
  });
