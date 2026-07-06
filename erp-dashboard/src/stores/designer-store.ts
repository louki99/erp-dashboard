import { create } from 'zustand';
import type {
  DesignerElement,
  PageSettings,
  Template,
  TemplateVersion,
} from '@/types/document-studio.types';

const DEFAULT_PAGE: PageSettings = {
  format: 'A4',
  orientation: 'portrait',
  margin_top: 10,
  margin_right: 10,
  margin_bottom: 10,
  margin_left: 10,
};

const DEFAULT_TEST_DATA: Record<string, unknown> = {
  company:  { name: 'AssabilFDP', address: 'Casablanca' },
  invoice:  { number: 'FAC-2026-0001', total: 1250.50, items: [] },
  order:    { number: 'BC-2026-0001', total: 980.00, items: [] },
  customer: { name: 'Client Démo', city: 'Casablanca' },
};

interface HistoryEntry {
  elements: DesignerElement[];
  page:     PageSettings;
}

export type EditorMode = 'simple' | 'designer';

interface DesignerState {
  template:    Template | null;
  version:     TemplateVersion | null;
  elements:    DesignerElement[];
  page:        PageSettings;
  selectedId:  string | null;
  testData:    Record<string, unknown>;
  isDirty:     boolean;
  history:     HistoryEntry[];
  historyIdx:  number;
  previewMode: boolean;
  editorMode:  EditorMode;

  setTemplate:    (t: Template) => void;
  setVersion:     (v: TemplateVersion) => void;
  setElements:    (elements: DesignerElement[]) => void;
  addElement:     (element: DesignerElement) => void;
  updateElement:  (id: string, patch: Partial<DesignerElement>) => void;
  removeElement:  (id: string) => void;
  selectElement:  (id: string | null) => void;
  setTestData:    (data: Record<string, unknown>) => void;
  setPage:        (page: PageSettings) => void;
  markSaved:      () => void;
  undo:           () => void;
  redo:           () => void;
  setPreviewMode: (v: boolean) => void;
  setEditorMode:  (m: EditorMode) => void;
  setElementsBulk:(elements: DesignerElement[]) => void;
}

function snapshot(elements: DesignerElement[], page: PageSettings): HistoryEntry {
  return { elements: structuredClone(elements), page: { ...page } };
}

export const useDesignerStore = create<DesignerState>((set, get) => ({
  template:    null,
  version:     null,
  elements:    [],
  page:        DEFAULT_PAGE,
  selectedId:  null,
  testData:    DEFAULT_TEST_DATA,
  isDirty:     false,
  history:     [],
  historyIdx:  -1,
  previewMode: false,
  editorMode:  'simple',

  // Always reopen in the safe simple mode — designer mode is opt-in per session
  setTemplate: (template) => set({ template, editorMode: 'simple' }),

  setVersion: (version) => {
    const elements = version.elements ?? [];
    const page     = version.page_settings;
    set({
      version,
      elements,
      page,
      isDirty:    false,
      selectedId: null,
      history:    [snapshot(elements, page)],
      historyIdx: 0,
    });
  },

  setElements: (elements) => {
    const { page, history, historyIdx } = get();
    const next = history.slice(0, historyIdx + 1);
    next.push(snapshot(elements, page));
    set({ elements, isDirty: true, history: next, historyIdx: next.length - 1 });
  },

  addElement: (element) => {
    const { elements, page, history, historyIdx } = get();
    const updated = [...elements, element];
    const next    = history.slice(0, historyIdx + 1);
    next.push(snapshot(updated, page));
    set({ elements: updated, isDirty: true, history: next, historyIdx: next.length - 1 });
  },

  updateElement: (id, patch) => {
    const { elements, page, history, historyIdx } = get();
    const updated = elements.map((el) => el.id === id ? { ...el, ...patch } : el);
    const next    = history.slice(0, historyIdx + 1);
    next.push(snapshot(updated, page));
    set({ elements: updated, isDirty: true, history: next, historyIdx: next.length - 1 });
  },

  removeElement: (id) => {
    const { elements, selectedId, page, history, historyIdx } = get();
    const updated = elements.filter((el) => el.id !== id);
    const next    = history.slice(0, historyIdx + 1);
    next.push(snapshot(updated, page));
    set({
      elements:   updated,
      selectedId: selectedId === id ? null : selectedId,
      isDirty:    true,
      history:    next,
      historyIdx: next.length - 1,
    });
  },

  selectElement: (id) => set({ selectedId: id }),

  setTestData: (testData) => set({ testData }),

  setPage: (page) => {
    const { elements, history, historyIdx } = get();
    const next = history.slice(0, historyIdx + 1);
    next.push(snapshot(elements, page));
    set({ page, isDirty: true, history: next, historyIdx: next.length - 1 });
  },

  markSaved: () => set({ isDirty: false }),

  undo: () => {
    const { history, historyIdx } = get();
    if (historyIdx <= 0) return;
    const prev = history[historyIdx - 1];
    set({ elements: prev.elements, page: prev.page, historyIdx: historyIdx - 1, isDirty: true });
  },

  redo: () => {
    const { history, historyIdx } = get();
    if (historyIdx >= history.length - 1) return;
    const next = history[historyIdx + 1];
    set({ elements: next.elements, page: next.page, historyIdx: historyIdx + 1, isDirty: true });
  },

  setPreviewMode: (v) => set({ previewMode: v }),

  setEditorMode: (m) => set({ editorMode: m, selectedId: null }),

  // Single history entry for a multi-element change (e.g. global color replace)
  setElementsBulk: (elements) => {
    const { page, history, historyIdx } = get();
    const next = history.slice(0, historyIdx + 1);
    next.push(snapshot(elements, page));
    set({ elements, isDirty: true, history: next, historyIdx: next.length - 1 });
  },
}));
