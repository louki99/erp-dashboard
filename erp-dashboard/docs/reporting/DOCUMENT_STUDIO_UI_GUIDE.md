# Document Studio & Advanced Reporting — Guide d'intégration UI

> **Audience :** équipe Frontend (React / TypeScript)  
> **Statut :** Gateway Laravel prête — backend FastAPI prêt et testé  
> **Date :** 2026-07-04

---

## ⚠️ Règle de sécurité absolue

```
JAMAIS de X-API-Key dans le code frontend.
JAMAIS de connexion directe au port 8088.
```

L'API Key reste côté Laravel. Le frontend appelle **uniquement** le gateway Laravel (`/api/v1/*`).
Laravel injecte l'API Key avant de transmettre au microservice. Le browser ne la voit jamais.

```
Browser
  │  Sanctum session cookie  (pas d'API Key)
  ▼
Laravel  /api/v1/*          ← seul host visible du frontend
  │  inject X-API-Key       (serveur uniquement)
  ▼
FastAPI :8088               ← jamais appelé directement par le browser
  │
  ├── MinIO  (fichiers persistés)
  └── Stream (téléchargement direct)
```

---

## Table des matières

1. [Stack cible](#1-stack-cible)
2. [Configuration Axios](#2-configuration-axios)
3. [Architecture des dossiers](#3-architecture-des-dossiers)
4. [Module A — Portail de Reporting](#4-module-a--portail-de-reporting)
5. [Module B — Document Studio Designer](#5-module-b--document-studio-designer)
6. [Génération ERP (BC / BL / Facture)](#6-génération-erp-bc--bl--facture)
7. [Référence complète des endpoints](#7-référence-complète-des-endpoints)
8. [Data bindings disponibles dans les templates](#8-data-bindings-disponibles-dans-les-templates)
9. [Types TypeScript](#9-types-typescript)
10. [Validation Zod](#10-validation-zod)
11. [React Query hooks](#11-react-query-hooks)
12. [Architecture Konva / react-konva](#12-architecture-konva--react-konva)
13. [Store Zustand](#13-store-zustand)
14. [Gestion des erreurs](#14-gestion-des-erreurs)
15. [Checklist de livraison](#15-checklist-de-livraison)

---

## 1. Stack cible

| Couche | Choix |
|--------|-------|
| Framework | React 18+ |
| Langage | TypeScript strict |
| Build | Vite |
| UI | shadcn/ui + Tailwind CSS |
| Formulaires | React Hook Form + Zod |
| Requêtes API | TanStack Query (React Query) |
| État global | Zustand |
| Routing | React Router v6 |
| Canvas designer | Konva + react-konva |
| HTTP client | Axios |

---

## 2. Configuration Axios

> **CRITIQUE :** `baseURL` pointe sur le **Laravel backend**, pas sur le port 8088.  
> `X-API-Key` n'apparaît **nulle part** dans ce fichier.

```typescript
// api/client.ts
import axios from 'axios';

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000',
  withCredentials: true,                  // envoie le cookie Sanctum
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    // ❌ JAMAIS X-API-Key ici — Laravel l'injecte côté serveur
  },
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      window.location.href = '/login';
    }
    const message = error.response?.data?.ms_error
      ?? error.response?.data?.message
      ?? error.message;
    return Promise.reject(new Error(message));
  },
);
```

`.env`:
```bash
# URL du backend Laravel — jamais le port 8088
VITE_API_BASE_URL=http://localhost:8000
```

---

## 3. Architecture des dossiers

```
src/
├── api/
│   ├── client.ts                  # Axios instance (voir §2)
│   ├── reporting.ts               # Hooks + appels reporting
│   └── document-studio.ts         # Hooks + appels document studio
├── components/
│   ├── ui/                        # shadcn/ui components
│   ├── reporting/
│   │   ├── ReportSourceForm.tsx
│   │   ├── FilterBuilder.tsx
│   │   ├── StylePanel.tsx
│   │   ├── ColumnConfigurator.tsx
│   │   └── PreviewTable.tsx
│   └── document-studio/
│       ├── TemplateList.tsx
│       ├── DesignerCanvas.tsx      # Konva
│       ├── ToolPalette.tsx
│       ├── PropertiesPanel.tsx
│       ├── VersionsPanel.tsx
│       └── LivePreviewFrame.tsx
├── hooks/
│   ├── use-reports.ts
│   ├── use-templates.ts
│   └── use-designer.ts
├── stores/
│   ├── designer-store.ts          # Zustand : template, éléments, history
│   └── report-config-store.ts     # Zustand : filtres + style en cours
├── types/
│   ├── reports.ts
│   └── document-studio.ts
├── lib/
│   └── schemas.ts                 # Zod schemas
└── pages/
    ├── ReportingPage.tsx
    └── DocumentStudioPage.tsx
```

---

## 4. Module A — Portail de Reporting

### 4.1 User flow

1. Choisir une **source** : `procedure` (procédure stockée) ou `query` (requête nommée).
2. Renseigner les **paramètres** de la source (dates, id client, etc.).
3. Ajouter des **filtres dynamiques** par colonne (`eq`, `between`, `in`, …).
4. Choisir un **thème** prédéfini et/ou personnaliser le style.
5. Cliquer **Aperçu** → tableau d'échantillon + total count.
6. Cliquer **Exporter** → téléchargement binaire (xlsx / csv / pdf).

### 4.2 Wireframe

```
┌─────────────────────────────────────────────────────────────────────┐
│  Reporting                                       [Exporter] [Aperçu]│
├─────────────────────────────────────────────────────────────────────┤
│ ┌──────────────┐  ┌──────────────────────────────────────────────┐  │
│ │ Source       │  │ Configuration                                │  │
│ │ • Procedure  │  │                                              │  │
│ │ • Query      │  │  [Procédure ▼] reporting.get_client_balance  │  │
│ │              │  │                                              │  │
│ │ Paramètres   │  │  Paramètres :                                │  │
│ │ Filtres      │  │  Date début [____]  Date fin [____]          │  │
│ │ Thème        │  │  Client ID  [____]                           │  │
│ │ Style        │  │                                              │  │
│ │ Colonnes     │  │  Filtres dynamiques :                        │  │
│ │              │  │  [+ Ajouter un filtre]                       │  │
│ │              │  │  ┌────────┬──────────┬─────────┬──────┐      │  │
│ │              │  │  │Colonne │ Opérateur│ Valeur  │  🗑️  │      │  │
│ │              │  │  │ amount │   gte    │ 1000    │  🗑️  │      │  │
│ │              │  │  │ region │   in     │ C,RABAT │  🗑️  │      │  │
│ │              │  │  └────────┴──────────┴─────────┴──────┘      │  │
│ └──────────────┘  │  Thème : [moroccan_gold ▼]                   │  │
│                   │  Style : Police / Couleurs / Totaux …         │  │
│                   │  Colonnes : key / label / width / align / fmt │  │
│                   └──────────────────────────────────────────────┘  │
│  📊 Aperçu (50 premières lignes + total_count)                      │
│  ┌─────────────────────────────────────────────────────────────────┐ │
│  │ Tableau de données …                                            │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### 4.3 shadcn/ui à installer

```bash
npx shadcn@latest add button card input select tabs badge separator scroll-area
npx shadcn@latest add table dialog dropdown-menu label switch
npx shadcn@latest add popover calendar
npx shadcn@latest add sonner
```

---

## 5. Module B — Document Studio Designer

### 5.1 User flow

1. **Liste des templates** : créer, dupliquer, archiver, restaurer.
2. **Éditeur** : onglets **Designer** / **Versions** / **Aperçu**.
3. **Canvas A4** (react-konva) : palette d'outils à gauche, propriétés à droite.
4. **Drag & drop** d'éléments (Texte, Tableau, Image, Ligne, Rectangle, QR Code, Barcode) → canvas.
5. **Resize / move** sur le canvas avec transformers Konva.
6. **Binding** des variables via `{{ binding }}`.
7. **Versions** : sauvegarder un snapshot, publier (seule la version publiée est rendue).
8. **Live Preview** → `POST /render/preview` → HTML dans `<iframe srcdoc>`.
9. **Generate** → PDF / XLSX / DOCX.

### 5.2 Wireframe

```
┌──────────────────────────────────────────────────────────────────────┐
│  Document Studio                                           [Publier] │
├──────────┬───────────────────────────────────────┬───────────────────┤
│          │                                       │                   │
│  OUTILS  │         CANVAS A4 (Konva)             │   PROPRIÉTÉS      │
│  [T]     │  ┌─────────────────────────┐          │  Type : Texte     │
│  Texte   │  │  {{company.name}}       │          │  X:[20]  Y:[30]   │
│  [▦]     │  │                         │          │  W:[100] H:[10]   │
│  Tableau │  │  ┌─────────────────┐    │          │  Binding :        │
│  [🖼]    │  │  │ Logo            │    │          │  [{{invoice.n...] │
│  Image   │  │  └─────────────────┘    │          │  Police [Arial ▼] │
│  [▬]     │  │  ── séparateur ──────── │          │  Taille [12]      │
│  Ligne   │  │  [QR]                   │          │  [x] Gras         │
│  [◻]     │  └─────────────────────────┘          │  Fond  [#FFF]     │
│  Rect    │  Zoom [100% ▼]  Grille [x]            │  Bordure [1px]    │
│  [QR]    │                                       │                   │
│  [B]     │                                       │                   │
│  Barcode │                                       │                   │
├──────────┴───────────────────────────────────────┴───────────────────┤
│  [Designer]  [Versions]  [Live Preview ▶]  [Generate ▼ PDF/XLSX/DOCX]│
└──────────────────────────────────────────────────────────────────────┘
```

### 5.3 shadcn/ui à installer

```bash
npx shadcn@latest add button card input select tabs badge separator scroll-area
npx shadcn@latest add table dialog dropdown-menu label switch slider
npx shadcn@latest add popover textarea
npx shadcn@latest add sonner
```

---

## 6. Génération ERP (BC / BL / Facture)

Pour les **documents liés à un enregistrement ERP**, le gateway Laravel récupère les données depuis la base, hydrate le contexte, et appelle le microservice. Le frontend fournit seulement l'`id` de l'enregistrement et le `template_code`.

### 6.1 Bon de Commande (BC / Order)

```http
POST /api/v1/document-studio/render/generate/order/{orderId}
Content-Type: application/json

{
  "template_code": "bc_standard",
  "render_format": "pdf"
}
```

Réponse `200` :
```json
{
  "download_url": "https://minio.internal/docs/bc_001234.pdf",
  "format": "pdf",
  "document_id": 412
}
```

- `download_url` → lien direct MinIO. Stocker pour afficher "Retélécharger".
- `document_id` → ID dans la table `documents` (lié polymorphiquement à l'Order).

### 6.2 Bon de Livraison (BL / DeliveryNote)

```http
POST /api/v1/document-studio/render/generate/delivery_note/{deliveryNoteId}
Content-Type: application/json

{
  "template_code": "bl_standard",
  "render_format": "pdf"
}
```

Réponse `200` :
```json
{
  "download_url": "https://minio.internal/docs/bl_00456.pdf",
  "format": "pdf",
  "document_id": 517
}
```

### 6.3 Facture (Invoice)

```http
POST /api/v1/document-studio/render/generate/invoice/{invoiceId}
Content-Type: application/json

{
  "template_code": "facture_ttc",
  "render_format": "pdf"
}
```

Le payload Facture est le plus riche : colonnes prix, remise, TVA, totaux HT/TTC, montant payé, reste à payer.

### 6.4 Modes de rendu

| Mode | Endpoint | Stockage | Usage |
|---|---|---|---|
| **generate** | `POST /render/generate/{type}/{id}` | MinIO + `documents` table | Archivage, email, impression |
| **stream** | `POST /render/generate/stream` | Aucun (binaire en mémoire) | Téléchargement instantané |
| **preview** | `POST /render/preview` | Aucun (HTML) | Panneau de prévisualisation |

#### Stream (téléchargement direct, sans archivage)

```http
POST /api/v1/document-studio/render/generate/stream
Content-Type: application/json

{
  "template_code": "bc_standard",
  "render_format": "pdf",
  "filename": "BC-2026-001",
  "data": { ... }   ← optionnel : si omis, template defaults s'appliquent
}
```

Réponse : binaire brut avec headers `Content-Disposition: attachment`.

```typescript
// React — déclencher le téléchargement
const res = await apiClient.post(
  '/api/v1/document-studio/render/generate/stream',
  { template_code: 'bc_standard', render_format: 'pdf', filename: 'BC-001' },
  { responseType: 'blob' },
);
const url = URL.createObjectURL(res.data);
const a = document.createElement('a');
a.href = url;
a.download = 'BC-001.pdf';
a.click();
URL.revokeObjectURL(url);
```

#### Live Preview (HTML)

```http
POST /api/v1/document-studio/render/preview
Content-Type: application/json

{
  "template_code": "bc_standard",
  "data": {
    "company": { "name": "AssabilFDP", "address": "Casablanca" },
    "order":   { "number": "PREVIEW-001", "total": 1250.50 }
  }
}
```

Réponse :
```json
{ "html": "<div class=\"document\">...</div>" }
```

> Injecter `html` via `<iframe srcdoc={...}>` — **ne pas** utiliser `innerHTML` directement.

---

## 7. Référence complète des endpoints

**Toutes les routes passent par le gateway Laravel** (`/api/v1/`) avec cookie Sanctum.

### Reporting

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/reporting/themes` | Liste des thèmes prédéfinis |
| POST | `/api/v1/reporting/preview` | Échantillon + `total_count` |
| POST | `/api/v1/reporting/export` | Fichier binaire (xlsx/csv/pdf) |

### Templates

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/document-studio/templates` | Liste paginée + recherche |
| POST | `/api/v1/document-studio/templates` | Créer un template |
| GET | `/api/v1/document-studio/templates/{id}` | Détail |
| PUT | `/api/v1/document-studio/templates/{id}` | Modifier |
| DELETE | `/api/v1/document-studio/templates/{id}` | Supprimer |

### Versions

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/document-studio/templates/{id}/versions` | Lister les versions |
| POST | `/api/v1/document-studio/templates/{id}/versions` | Créer une version (snapshot complet) |
| POST | `/api/v1/document-studio/templates/{id}/versions/{versionId}/publish` | Publier |

> **Conseil designer :** gérer tous les éléments côté client dans le store Zustand, puis créer une nouvelle version (snapshot complet) à chaque sauvegarde. C'est plus simple que d'appeler les endpoints élément par élément.

### Assets

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| GET | `/api/v1/document-studio/assets` | Lister les assets (`?type=image`) |
| DELETE | `/api/v1/document-studio/assets/{assetId}` | Supprimer un asset |

> L'upload d'assets est géré directement par le designer Document Studio (pas par ce gateway).

### Rendu ERP

| Méthode | Endpoint | Description |
|---------|----------|-------------|
| POST | `/api/v1/document-studio/render/preview` | HTML de prévisualisation |
| POST | `/api/v1/document-studio/render/generate/stream` | Binaire direct |
| POST | `/api/v1/document-studio/render/generate/invoice/{id}` | Facture → MinIO + Document |
| POST | `/api/v1/document-studio/render/generate/order/{id}` | BC → MinIO + Document |
| POST | `/api/v1/document-studio/render/generate/delivery_note/{id}` | BL → MinIO + Document |

> **BP (Bon de Préparation) et BCH (Bon de Chargement)** : hydration ERP pas encore câblée.  
> Pour ces documents, utiliser le mode `stream` en construisant `data` manuellement côté client.

---

## 8. Data bindings disponibles dans les templates

Le microservice résout les expressions `{{ binding | filter }}` contre le contexte JSON hydraté par Laravel.

### BC (Order)

```
{{ order.number }}            {{ order.date }}          {{ order.payment_term }}
{{ order.subtotal }}          {{ order.tax_amount }}    {{ order.total }}
{{ order.status }}            {{ order.notes }}

{{ order.items[].ref }}       {{ order.items[].label }}
{{ order.items[].qty }}       {{ order.items[].unit }}
{{ order.items[].unit_price }}  {{ order.items[].discount }}
{{ order.items[].tax_rate }}  {{ order.items[].total_ht }}  {{ order.items[].total_ttc }}
```

### BL (DeliveryNote)

```
{{ delivery_note.number }}    {{ delivery_note.date }}   {{ delivery_note.status }}
{{ delivery_note.notes }}

{{ delivery_note.items[].ref }}   {{ delivery_note.items[].label }}
{{ delivery_note.items[].qty }}   {{ delivery_note.items[].unit }}
```

> Pas de colonnes prix sur les BL — utiliser la Facture pour les données financières.

### Facture (Invoice)

```
{{ invoice.number }}          {{ invoice.date }}         {{ invoice.due_date }}
{{ invoice.payment_term }}    {{ invoice.subtotal }}     {{ invoice.tax_amount }}
{{ invoice.discount_amount }} {{ invoice.total }}        {{ invoice.paid_amount }}
{{ invoice.remaining }}       {{ invoice.status }}       {{ invoice.notes }}

{{ invoice.items[].ref }}     {{ invoice.items[].label }}
{{ invoice.items[].qty }}     {{ invoice.items[].unit }}
{{ invoice.items[].unit_price }}  {{ invoice.items[].discount }}
{{ invoice.items[].tax_rate }}    {{ invoice.items[].total_ht }}
{{ invoice.items[].total_ttc }}
```

### Champs communs (tous types)

```
{{ company.name }}     {{ company.address }}  {{ company.ice }}
{{ company.if }}       {{ company.rc }}       {{ company.patente }}
{{ company.phone }}    {{ company.email }}    {{ company.logo_url }}

{{ customer.name }}    {{ customer.code }}    {{ customer.address }}
{{ customer.city }}    {{ customer.ice }}     {{ customer.if }}
{{ customer.rc }}      {{ customer.phone }}   {{ customer.email }}

{{ sf_params.locale }}     → ex. "fr"
{{ sf_params.currency }}   → ex. "MAD"
{{ sf_params.timezone }}   → ex. "Africa/Casablanca"
```

---

## 9. Types TypeScript

### types/reports.ts

```typescript
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';
export type SourceType  = 'procedure' | 'query';

export type FilterOperator =
  | 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte'
  | 'contains' | 'starts_with' | 'ends_with'
  | 'in' | 'not_in' | 'between' | 'is_null' | 'is_not_null';

export interface ReportFilter {
  column:    string;
  operator:  FilterOperator;
  value?:    string | number | boolean | null;
  value_to?: string | number | null;
  values?:   (string | number)[];
}

export interface ReportColumn {
  key:            string;
  label:          string;
  width?:         number;
  align?:         'left' | 'center' | 'right';
  number_format?: string;
}

export interface StyleConfig {
  font_family?:       string;
  font_size?:         number;
  header_font_color?: string;
  header_bg_color?:   string;
  alternate_row_color?: string;
  border_color?:      string;
  freeze_header?:     boolean;
  autofit_columns?:   boolean;
  freeze_columns?:    number;
  enable_autofilter?: boolean;
  show_totals_row?:   boolean;
  totals?:            Record<string, 'sum' | 'avg' | 'count' | 'min' | 'max'>;
  title?:             string;
  logo_url?:          string;
}

export interface ReportRequest {
  source_type:   SourceType;
  source_name:   string;
  parameters?:   Record<string, unknown>;
  filters?:      ReportFilter[];
  filter_logic?: 'AND' | 'OR';
  sort?:         Array<{ column: string; direction: 'asc' | 'desc' }>;
  export_format: ExportFormat;
  report_name:   string;
  columns?:      ReportColumn[];
  theme?:        string;
  style?:        StyleConfig;
}
```

### types/document-studio.ts

```typescript
export type ElementType =
  | 'text' | 'table' | 'image' | 'line' | 'rectangle'
  | 'qr_code' | 'barcode' | 'current_date' | 'page_number';

export type PageFormat      = 'A4' | 'A5' | 'letter';
export type PageOrientation = 'portrait' | 'landscape';
export type DocumentStatus  = 'draft' | 'published' | 'archived';

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
  code:             string;
  name:             string;
  description?:     string;
  document_type?:   string;
  page_format?:     PageFormat;
  page_orientation?: PageOrientation;
  margin_top?:      number;
  margin_right?:    number;
  margin_bottom?:   number;
  margin_left?:     number;
}

export interface RenderResult {
  download_url: string;
  format:       string;
  document_id:  number;
}
```

---

## 10. Validation Zod

```typescript
// lib/schemas.ts
import { z } from 'zod';

export const reportRequestSchema = z.object({
  source_type:  z.enum(['procedure', 'query']),
  source_name:  z.string().min(1),
  parameters:   z.record(z.unknown()).optional(),
  filters: z.array(z.object({
    column:   z.string().min(1),
    operator: z.enum([
      'eq','neq','gt','gte','lt','lte',
      'contains','starts_with','ends_with',
      'in','not_in','between','is_null','is_not_null',
    ]),
    value:    z.unknown().optional(),
    value_to: z.unknown().optional(),
    values:   z.array(z.union([z.string(), z.number()])).optional(),
  })).optional(),
  filter_logic:  z.enum(['AND', 'OR']).optional(),
  sort: z.array(z.object({
    column:    z.string(),
    direction: z.enum(['asc', 'desc']),
  })).optional(),
  export_format: z.enum(['xlsx', 'csv', 'pdf']),
  report_name:   z.string().min(1),
  theme:         z.string().optional(),
  style:         z.record(z.unknown()).optional(),
});

export const templateCreateSchema = z.object({
  code:             z.string().min(1).max(120),
  name:             z.string().min(1).max(255),
  description:      z.string().optional(),
  document_type:    z.string().max(120).default('custom'),
  page_format:      z.enum(['A4', 'A5', 'letter']).default('A4'),
  page_orientation: z.enum(['portrait', 'landscape']).default('portrait'),
  margin_top:       z.number().default(10),
  margin_right:     z.number().default(10),
  margin_bottom:    z.number().default(10),
  margin_left:      z.number().default(10),
});
```

---

## 11. React Query hooks

```typescript
// hooks/use-reports.ts
import { useMutation, useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/client';
import type { ReportRequest } from '@/types/reports';

export const useThemes = () =>
  useQuery({
    queryKey: ['reporting', 'themes'],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/reporting/themes');
      return data.themes as string[];
    },
  });

export const useReportPreview = () =>
  useMutation({
    mutationFn: async (payload: Omit<ReportRequest, 'export_format' | 'report_name'>) => {
      const { data } = await apiClient.post('/api/v1/reporting/preview', payload);
      return data as { total_rows: number; sample: Record<string, unknown>[] };
    },
  });

export const useReportExport = () =>
  useMutation({
    mutationFn: async (payload: ReportRequest) => {
      const response = await apiClient.post('/api/v1/reporting/export', payload, {
        responseType: 'blob',
      });
      return response.data as Blob;
    },
  });

// hooks/use-templates.ts
import type { TemplateCreatePayload } from '@/types/document-studio';

export const useTemplates = (params?: Record<string, unknown>) =>
  useQuery({
    queryKey: ['templates', params],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/document-studio/templates', { params });
      return data;
    },
  });

export const useCreateTemplate = () =>
  useMutation({
    mutationFn: async (payload: TemplateCreatePayload) => {
      const { data } = await apiClient.post('/api/v1/document-studio/templates', payload);
      return data;
    },
  });

export const usePublishVersion = () =>
  useMutation({
    mutationFn: async ({ templateId, versionId }: { templateId: string; versionId: string }) => {
      const { data } = await apiClient.post(
        `/api/v1/document-studio/templates/${templateId}/versions/${versionId}/publish`,
      );
      return data;
    },
  });

export const useGenerateErpDocument = () =>
  useMutation({
    mutationFn: async ({
      documentType,
      documentId,
      templateCode,
      renderFormat = 'pdf',
    }: {
      documentType: 'invoice' | 'order' | 'delivery_note';
      documentId:   number;
      templateCode: string;
      renderFormat?: 'pdf' | 'xlsx' | 'docx';
    }) => {
      const { data } = await apiClient.post(
        `/api/v1/document-studio/render/generate/${documentType}/${documentId}`,
        { template_code: templateCode, render_format: renderFormat },
      );
      return data as { download_url: string; format: string; document_id: number };
    },
  });
```

---

## 12. Architecture Konva / react-konva

```typescript
// components/document-studio/DesignerCanvas.tsx
import { Stage, Layer, Rect } from 'react-konva';
import type { DesignerElement, PageSettings } from '@/types/document-studio';

// 1 mm = 3.7795 px @ 96 DPI
const MM_TO_PX = 3.7795275591;

const PAGE_DIMS: Record<string, { w: number; h: number }> = {
  A4:     { w: 210, h: 297 },
  A5:     { w: 148, h: 210 },
  letter: { w: 216, h: 279 },
};

interface Props {
  page:       PageSettings;
  elements:   DesignerElement[];
  selectedId: string | null;
  onSelect:   (id: string | null) => void;
  onChange:   (element: DesignerElement) => void;
}

export function DesignerCanvas({ page, elements, selectedId, onSelect, onChange }: Props) {
  const dims = PAGE_DIMS[page.format] ?? PAGE_DIMS.A4;
  const w    = dims.w * MM_TO_PX;
  const h    = page.orientation === 'portrait' ? dims.h * MM_TO_PX : dims.w * MM_TO_PX;

  return (
    <Stage width={w} height={h} onClick={(e) => { if (e.target === e.target.getStage()) onSelect(null); }}>
      <Layer>
        <Rect x={0} y={0} width={w} height={h} fill="white" shadowBlur={8} />
        {[...elements]
          .sort((a, b) => a.z_index - b.z_index)
          .map((el) => (
            <DesignerElementRenderer
              key={el.id}
              element={el}
              isSelected={el.id === selectedId}
              onSelect={() => onSelect(el.id)}
              onChange={onChange}
            />
          ))}
      </Layer>
    </Stage>
  );
}
```

---

## 13. Store Zustand

```typescript
// stores/designer-store.ts
import { create } from 'zustand';
import type { DesignerElement, PageSettings, Template, TemplateVersion } from '@/types/document-studio';

interface DesignerState {
  template:   Template | null;
  version:    TemplateVersion | null;
  elements:   DesignerElement[];
  page:       PageSettings;
  selectedId: string | null;
  testData:   Record<string, unknown>;
  isDirty:    boolean;

  setTemplate:   (t: Template) => void;
  setVersion:    (v: TemplateVersion) => void;
  setElements:   (elements: DesignerElement[]) => void;
  addElement:    (element: DesignerElement) => void;
  updateElement: (id: string, patch: Partial<DesignerElement>) => void;
  removeElement: (id: string) => void;
  selectElement: (id: string | null) => void;
  setTestData:   (data: Record<string, unknown>) => void;
  setPage:       (page: PageSettings) => void;
  markSaved:     () => void;
}

export const useDesignerStore = create<DesignerState>((set) => ({
  template:   null,
  version:    null,
  elements:   [],
  page:       { format: 'A4', orientation: 'portrait', margin_top: 10, margin_right: 10, margin_bottom: 10, margin_left: 10 },
  selectedId: null,
  testData:   {
    company:  { name: 'AssabilFDP', address: 'Casablanca' },
    invoice:  { number: 'FAC-2026-0001', total: 1250.50, items: [] },
  },
  isDirty: false,

  setTemplate:   (template)   => set({ template }),
  setVersion:    (version)    => set({ version, elements: version.elements ?? [], isDirty: false }),
  setElements:   (elements)   => set({ elements, isDirty: true }),
  addElement:    (element)    => set((s) => ({ elements: [...s.elements, element], isDirty: true })),
  updateElement: (id, patch)  => set((s) => ({
    elements: s.elements.map((el) => el.id === id ? { ...el, ...patch } : el),
    isDirty: true,
  })),
  removeElement: (id)         => set((s) => ({
    elements:   s.elements.filter((el) => el.id !== id),
    selectedId: s.selectedId === id ? null : s.selectedId,
    isDirty:    true,
  })),
  selectElement: (id)         => set({ selectedId: id }),
  setTestData:   (testData)   => set({ testData }),
  setPage:       (page)       => set({ page, isDirty: true }),
  markSaved:     ()           => set({ isDirty: false }),
}));
```

---

## 14. Gestion des erreurs

Toutes les erreurs suivent le même format :

```json
{
  "message": "Document Studio service returned an error.",
  "ms_error": "template_code 'bc_v999' not found"
}
```

| Status | Cause | Action UI |
|--------|-------|-----------|
| `401` | Session expirée | Rediriger vers login |
| `403` | Rôle insuffisant | Toast "Non autorisé" |
| `404` | ID ERP invalide (order/BL/invoice introuvable) | Toast "Document introuvable" |
| `422` | Validation Laravel (champ manquant ou invalide) | Afficher erreurs champ par champ depuis `errors` |
| `502` | Microservice indisponible ou erreur 5xx | Toast "Service temporairement indisponible, réessayez" |

**Exemple 422 :**
```json
{
  "message": "The template_code field is required.",
  "errors": {
    "template_code": ["The template_code field is required."]
  }
}
```

---

## 15. Checklist de livraison

### Portail Reporting
- [ ] Formulaire source (procedure / query) avec validation Zod
- [ ] Gestion dynamique des filtres (tous opérateurs)
- [ ] Sélecteur de thème + panel de style avancé
- [ ] Liste des colonnes configurable (key / label / width / align / format)
- [ ] Bouton Aperçu avec tableau d'échantillon et total_rows
- [ ] Bouton Exporter — téléchargement blob
- [ ] Gestion des erreurs backend

### Document Studio — Liste
- [ ] Liste des templates avec pagination et recherche
- [ ] Créer / Modifier / Supprimer un template
- [ ] Filtrer par `document_type` et `status`

### Document Studio — Designer
- [ ] Canvas Konva A4 avec grille et règles
- [ ] Palette d'outils drag & drop (Texte, Tableau, Image, Ligne, Rect, QR, Barcode)
- [ ] Propriétés éditables par type d'élément (panneau droite)
- [ ] Binding `{{ ... }}` avec autocomplétion des variables disponibles
- [ ] Layering / z-index / lock / visibility
- [ ] Undo / Redo (history dans le store)
- [ ] Panel Versions : créer, publier, restaurer
- [ ] Live Preview HTML dans `<iframe srcdoc>`
- [ ] Generate PDF / XLSX / DOCX (stream ou MinIO)
- [ ] Éditeur JSON des test data

### Génération ERP
- [ ] Bouton "Générer BC" sur la fiche Order → `POST /render/generate/order/{id}`
- [ ] Bouton "Générer BL" sur la fiche DeliveryNote → `POST /render/generate/delivery_note/{id}`
- [ ] Bouton "Générer Facture" sur la fiche Invoice → `POST /render/generate/invoice/{id}`
- [ ] Afficher `download_url` après génération (lien ou bouton téléchargement)

### Global
- [ ] **Pas de X-API-Key dans le code frontend** (vérification code review)
- [ ] **Base URL pointe sur Laravel** (`localhost:8000`), pas sur `:8088`
- [ ] Loading states (skeleton / spinner) sur toutes les mutations
- [ ] Error toasts via sonner
- [ ] TypeScript strict sans `any`
- [ ] Responsive minimum (sidebar collapsible)

---

## Liens de référence

- Gateway Laravel (ce repo) : `app/Http/Controllers/API/V1/DocumentStudio/` et `Reporting/`
- Docs interactives FastAPI : `http://<backend-ms>/docs`  
- Schémas Python : `app/schemas.py` (reporting) · `app/document_studio/schemas.py` (Document Studio)
- Bindings ERP disponibles : §8 de ce document
