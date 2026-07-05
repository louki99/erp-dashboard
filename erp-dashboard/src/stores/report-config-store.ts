import { create } from 'zustand';
import type { ReportFilter, ReportColumn, StyleConfig, SourceType, ExportFormat } from '@/types/reports.types';

interface ReportConfigState {
  sourceType:   SourceType;
  sourceName:   string;
  parameters:   Record<string, unknown>;
  filters:      ReportFilter[];
  filterLogic:  'AND' | 'OR';
  sort:         Array<{ column: string; direction: 'asc' | 'desc' }>;
  exportFormat: ExportFormat;
  reportName:   string;
  columns:      ReportColumn[];
  theme:        string;
  style:        StyleConfig;

  setSourceType:   (t: SourceType) => void;
  setSourceName:   (name: string) => void;
  setParameters:   (params: Record<string, unknown>) => void;
  addFilter:       (filter: ReportFilter) => void;
  updateFilter:    (index: number, filter: ReportFilter) => void;
  removeFilter:    (index: number) => void;
  setFilterLogic:  (logic: 'AND' | 'OR') => void;
  setExportFormat: (fmt: ExportFormat) => void;
  setReportName:   (name: string) => void;
  setColumns:      (cols: ReportColumn[]) => void;
  setTheme:        (theme: string) => void;
  setStyle:        (style: Partial<StyleConfig>) => void;
  reset:           () => void;
}

const INITIAL: Omit<ReportConfigState,
  'setSourceType' | 'setSourceName' | 'setParameters' | 'addFilter' |
  'updateFilter' | 'removeFilter' | 'setFilterLogic' | 'setExportFormat' |
  'setReportName' | 'setColumns' | 'setTheme' | 'setStyle' | 'reset'
> = {
  sourceType:   'procedure',
  sourceName:   '',
  parameters:   {},
  filters:      [],
  filterLogic:  'AND',
  sort:         [],
  exportFormat: 'xlsx',
  reportName:   '',
  columns:      [],
  theme:        '',
  style:        {},
};

export const useReportConfigStore = create<ReportConfigState>((set) => ({
  ...INITIAL,

  setSourceType:   (sourceType)   => set({ sourceType }),
  setSourceName:   (sourceName)   => set({ sourceName }),
  setParameters:   (parameters)   => set({ parameters }),
  addFilter:       (filter)       => set((s) => ({ filters: [...s.filters, filter] })),
  updateFilter:    (index, filter) => set((s) => ({
    filters: s.filters.map((f, i) => i === index ? filter : f),
  })),
  removeFilter:    (index)        => set((s) => ({ filters: s.filters.filter((_, i) => i !== index) })),
  setFilterLogic:  (filterLogic)  => set({ filterLogic }),
  setExportFormat: (exportFormat) => set({ exportFormat }),
  setReportName:   (reportName)   => set({ reportName }),
  setColumns:      (columns)      => set({ columns }),
  setTheme:        (theme)        => set({ theme }),
  setStyle:        (style)        => set((s) => ({ style: { ...s.style, ...style } })),
  reset:           ()             => set(INITIAL),
}));
