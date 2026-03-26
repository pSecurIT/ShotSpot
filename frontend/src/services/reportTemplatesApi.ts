import { isAxiosError } from 'axios';
import api from '../utils/api';
import type { ReportTemplate, ReportTemplatePayload } from '../types/report-templates';
import { normalizeReportTemplate } from '../types/report-templates';

const apiCall = async <T>(operation: () => Promise<{ data: T }>, fallbackMessage: string): Promise<T> => {
  try {
    const response = await operation();
    return response.data;
  } catch (error) {
    if (isAxiosError(error)) {
      const serverError = error.response?.data as { error?: string } | undefined;
      throw new Error(serverError?.error || error.message || fallbackMessage);
    }

    if (error instanceof Error) {
      throw new Error(error.message || fallbackMessage);
    }

    throw new Error(fallbackMessage);
  }
};

export const reportTemplatesApi = {
  getAll: async (): Promise<ReportTemplate[]> => {
    const templates = await apiCall(
      () => api.get<Record<string, unknown>[]>('/report-templates'),
      'Failed to fetch report templates',
    );

    return templates.map((template) => normalizeReportTemplate(template));
  },

  create: async (payload: ReportTemplatePayload): Promise<ReportTemplate> => {
    const template = await apiCall(
      () => api.post<Record<string, unknown>>('/report-templates', payload),
      'Failed to create report template',
    );

    return normalizeReportTemplate(template);
  },

  update: async (id: number, payload: Partial<ReportTemplatePayload> & { is_active?: boolean }): Promise<ReportTemplate> => {
    const template = await apiCall(
      () => api.put<Record<string, unknown>>(`/report-templates/${id}`, payload),
      'Failed to update report template',
    );

    return normalizeReportTemplate(template);
  },

  remove: async (id: number): Promise<{ message: string }> => {
    return apiCall(
      () => api.delete<{ message: string }>(`/report-templates/${id}`),
      'Failed to delete report template',
    );
  },
};