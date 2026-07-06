export type ElementType =
  | 'text' | 'table' | 'image' | 'line' | 'rectangle'
  | 'qr_code' | 'barcode' | 'current_date' | 'page_number';

export type PageFormat      = 'A4' | 'A5' | 'letter';
export type PageOrientation = 'portrait' | 'landscape';
export type DocumentStatus  = 'draft' | 'published' | 'archived';
export type RenderFormat    = 'pdf' | 'xlsx' | 'docx';
export type ErpDocumentType = 'invoice' | 'order' | 'delivery_note';

export interface ElementStyle {
  font_family?:        string;
  font_size?:          number;
  bold?:               boolean;
  italic?:             boolean;
  underline?:          boolean;
  color?:              string;
  background_color?:   string;
  border_color?:       string;
  border_width?:       number;
  border_style?:       string;
  padding?:            number;
  radius?:             number;
  opacity?:            number;
  rotation?:           number;
  alignment?:          'left' | 'center' | 'right' | 'justify';
  vertical_alignment?: 'top' | 'middle' | 'bottom';
}

export interface DesignerElement {
  id:         string;
  type:       ElementType;
  name?:      string;
  x:          number;
  y:          number;
  width:      number;
  height:     number;
  rotation:   number;
  opacity:    number;
  z_index:    number;
  visible:    boolean;
  locked:     boolean;
  binding?:   string;
  properties: Record<string, unknown>;
  style:      ElementStyle;
}

export interface PageSettings {
  format:         PageFormat;
  orientation:    PageOrientation;
  margin_top:     number;
  margin_right:   number;
  margin_bottom:  number;
  margin_left:    number;
  // Banded layout (Crystal Reports style) — design-time zone boundaries in mm.
  // The renderer keeps absolute mm positions; bands are conception guides.
  header_height?: number;
  footer_height?: number;
}

export interface Template {
  id:               string;
  code:             string;
  name:             string;
  description?:     string;
  document_type:    string;
  status:           DocumentStatus;
  page_format:      PageFormat;
  page_orientation: PageOrientation;
  margin_top:       number;
  margin_right:     number;
  margin_bottom:    number;
  margin_left:      number;
  created_at:       string;
  updated_at:       string;
}

export interface TemplateVersion {
  id:             string;
  template_id:    string;
  version_number: number;
  label?:         string;
  is_published:   boolean;
  page_settings:  PageSettings;
  variables:      string[];
  elements?:      DesignerElement[];
  created_at:     string;
}

export interface TemplateCreatePayload {
  code:              string;
  name:              string;
  description?:      string;
  document_type?:    string;
  page_format?:      PageFormat;
  page_orientation?: PageOrientation;
  margin_top?:       number;
  margin_right?:     number;
  margin_bottom?:    number;
  margin_left?:      number;
}

export interface RenderResult {
  download_url: string;
  format:       string;
  document_id:  number;
}

export interface GenerateErpPayload {
  documentType: ErpDocumentType;
  documentId:   number;
  templateCode: string;
  renderFormat?: RenderFormat;
}
