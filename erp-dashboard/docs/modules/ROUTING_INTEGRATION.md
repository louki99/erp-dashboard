# Logistique & Sectorisation — Guide d'Intégration UI

> **Audience :** équipe Frontend (Admin Panel)
> **Base URL :** `/api/backend`
> **Auth :** Sanctum Bearer
> **Date :** 2026-07-08

---

## Table des matières

1. [Architecture du module](#1-architecture-du-module)
2. [Géographie — GeoArea & GeoAreaType](#2-géographie--geoarea--geoareatype)
3. [Tournées — Itinerary & ItineraryType](#3-tournées--itinerary--itinerarytype)
4. [Partenaires d'une tournée — ItineraryPartner](#4-partenaires-dune-tournée--itinerarypartner)
5. [Vendeurs affectés à une tournée — ItineraryUser](#5-vendeurs-affectés-à-une-tournée--itineraryuser)
6. [Planning hebdomadaire — ItineraryPlanning](#6-planning-hebdomadaire--itineraryplanning)
7. [Overrides journaliers — ItineraryPlanningDaily](#7-overrides-journaliers--itineraryplanningdaily)
8. [Affectation utilisateurs ↔ zones — GeoAreaUser](#8-affectation-utilisateurs--zones--geoareauser)
9. [Types TypeScript](#9-types-typescript)
10. [React Query hooks](#10-react-query-hooks)
11. [Erreurs et codes HTTP](#11-erreurs-et-codes-http)
12. [Scénarios complets](#12-scénarios-complets)

---

## 1. Architecture du module

```
GeoAreaType (Pays / Région / Ville / Secteur / Localité)
    │
    └── GeoArea (arborescence auto-référencée via parent_code)
            │
            ├── branches (geo_area_id)
            └── itinerary_localite ──► Itinerary
                                            │
                                            ├── ItineraryType
                                            ├── ItineraryPartner (liste ordonnée de partenaires)
                                            ├── itinerary_user  (vendeurs affectés)
                                            └── ItineraryPlanning (règles récurrence hebdo)
                                                        │
                                                        └── ItineraryPlanningDaily (overrides journaliers)
```

### Hiérarchie géographique standard

| rank | code type | Exemple |
|------|-----------|---------|
| 100 | Pays | Maroc |
| 200 | Région | Casablanca-Settat |
| 300 | Province | Casablanca |
| 400 | Ville | Casablanca (Ville) |
| 500 | Secteur | Hay Hassani |
| 600 | Localité | Sidi Moumen Est |

---

## 2. Géographie — GeoArea & GeoAreaType

**Base :** `/api/backend/geo-areas`

---

### `GET /geo-areas` — Lister les zones

```http
GET /api/backend/geo-areas
Authorization: Bearer {token}
```

**Query params :**

| Param | Type | Description |
|-------|------|-------------|
| `type_id` | int | Filtrer par type (ex: 5 = Secteur) |
| `parent_code` | string | Filtrer par parent |
| `search` | string | Recherche sur name, name_ar, code |
| `page` | int | Pagination |

**Réponse 200 :**

```json
{
  "geoAreas": {
    "data": [
      {
        "id": 12,
        "code": "HAY-HAS",
        "name": "Hay Hassani",
        "name_ar": "حي الحسني",
        "geo_area_type_id": 5,
        "parent_code": "CASA-VILLE",
        "latitude": 33.5731,
        "longitude": -7.6895,
        "is_active": true,
        "sort_order": 3,
        "geo_area_type": { "id": 5, "code": "500", "name": "Secteur", "rank": 500 },
        "parent": { "id": 8, "code": "CASA-VILLE", "name": "Casablanca" }
      }
    ],
    "current_page": 1,
    "total": 48
  },
  "geoAreaTypes": [ { "id": 1, "code": "100", "name": "Pays", "rank": 100 }, ... ],
  "parentAreas": [ { "id": 8, "code": "CASA-VILLE", "name": "Casablanca" }, ... ]
}
```

---

### `GET /geo-areas/hierarchy` — Arborescence complète

> ⚠️ Cette route est enregistrée **avant** `apiResource` — pas de conflit.

```http
GET /api/backend/geo-areas/hierarchy
```

**Réponse :** tableau d'aires racines avec `children` imbriqués récursivement.

```json
[
  {
    "id": 1,
    "code": "MAROC",
    "name": "Maroc",
    "children": [
      {
        "id": 3,
        "code": "CASA-SET",
        "name": "Casablanca-Settat",
        "children": [ ... ]
      }
    ]
  }
]
```

> Utiliser ce endpoint pour le **Tree View** de sectorisation.

---

### `GET /geo-areas/{parentCode}/children` — Enfants d'une zone

```http
GET /api/backend/geo-areas/CASA-VILLE/children
```

Retourne un tableau plat des zones enfants actives. Idéal pour le **lazy loading** d'un TreeView : ne charge les enfants que quand le nœud est développé.

```json
[
  { "id": 12, "code": "HAY-HAS", "name": "Hay Hassani", "geo_area_type_id": 5 },
  { "id": 13, "code": "AIN-DIAB", "name": "Aïn Diab", "geo_area_type_id": 5 }
]
```

---

### `POST /geo-areas` — Créer une zone

```http
POST /api/backend/geo-areas
Content-Type: application/json

{
  "code": "SID-MOM",
  "name": "Sidi Moumen",
  "name_ar": "سيدي مومن",
  "geo_area_type_id": 6,
  "parent_code": "HAY-HAS",
  "latitude": 33.583,
  "longitude": -7.631,
  "is_active": true,
  "sort_order": 1
}
```

**Règles de validation :**
- `code` : unique dans `geo_areas`
- Un **Secteur** (type code 500) doit avoir un **parent** de type **Ville** (code 400)
- Pas d'auto-référence ni de référence circulaire

**Réponse 201 :**

```json
{ "success": true, "geoArea": { "id": 55, "code": "SID-MOM", ... } }
```

---

### `PUT /geo-areas/{id}` — Modifier une zone

Mêmes champs que le POST. `code` unique sauf pour la ligne elle-même.

---

### `DELETE /geo-areas/{id}` — Supprimer une zone

Refuse si la zone a des enfants, des localités ou des branches rattachées.

```json
{ "success": false, "message": "Cannot delete area with child areas" }
```

---

### `GET /geo-areas/{id}/toggle` — Activer / Désactiver

```http
GET /api/backend/geo-areas/12/toggle
```

```json
{ "success": true, "is_active": false }
```

---

## 3. Tournées — Itinerary & ItineraryType

**Base :** `/api/backend/itineraries`

---

### ItineraryType — CRUD

**Base :** `/api/backend/itinerary-types`

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-types` | Lister (filtres: `search`, `is_active`, `per_page`) |
| `POST` | `/api/backend/itinerary-types` | Créer |
| `GET` | `/api/backend/itinerary-types/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-types/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-types/{id}` | Supprimer (409 si tournées liées) |

**Body POST/PUT :**

```json
{
  "code": "VAN",
  "name": "Tournée Van Sales",
  "name_ar": "جولة فان سيلز",
  "description": "Vente directe avec stock embarqué",
  "business_nature_id": 1,
  "is_active": true
}
```

---

### `GET /itineraries` — Lister les tournées

```http
GET /api/backend/itineraries?branch_code=CAS001&per_page=50
```

**Filtres :** `branch_code`, `rider_id`, `geo_area_code`, `search`

**Réponse :**

```json
{
  "itineraries": {
    "data": [
      {
        "id": 7,
        "code": "TRN-CAS-001",
        "name": "Tournée Épiceries Casa Centre",
        "itinerary_type": { "id": 2, "code": "VAN", "name": "Tournée Van Sales" },
        "branch": { "code": "CAS001", "name": "Casa Centre" },
        "geo_area": { "code": "HAY-HAS", "name": "Hay Hassani" },
        "rider": { "id": 42, "name": "Omar El Alaoui" },
        "is_active": true,
        "days_before_next_visit": 7,
        "sort_order": 1
      }
    ]
  },
  "branches": [...],
  "geoAreas": [...],
  "riders": [...]
}
```

---

### `POST /itineraries` — Créer une tournée

```json
{
  "code": "TRN-RBA-001",
  "name": "Tournée Épiceries Rabat",
  "itinerary_type_id": 2,
  "branch_code": "RBA001",
  "geo_area_code": "RBA-CENTRE",
  "rider_id": 15,
  "days_before_next_visit": 7,
  "trend": 1.05,
  "security_level": 0,
  "is_active": true,
  "start_date": "2026-01-01",
  "sort_order": 1
}
```

---

### `PUT /itineraries/{id}` / `DELETE /itineraries/{id}`

Mise à jour partielle et suppression standard.

---

## 4. Partenaires d'une tournée — ItineraryPartner

### `GET /itineraries/{id}` — Détail + liste des partenaires

```http
GET /api/backend/itineraries/7
```

```json
{
  "itinerary": {
    "id": 7,
    "itinerary_partners": [
      {
        "id": 101,
        "line_number": 1,
        "partner_code": "CLI-0042",
        "rank": 0,
        "is_stop_point": false,
        "visit_date": null,
        "start_time": "08:00",
        "end_time": "08:30",
        "mileage": 1.2,
        "visit_frequency_days": 7,
        "partner": { "code": "CLI-0042", "name": "Épicerie Amine" }
      }
    ]
  },
  "availablePartners": [...]
}
```

---

### `POST /itineraries/{id}/sync-partners` — Remplacer toute la liste (BULK)

**C'est l'endpoint principal pour le panel de gestion des partenaires.** Envoyer la liste complète dans l'ordre souhaité — le backend efface et recrée toute la liste dans une transaction.

```http
POST /api/backend/itineraries/7/sync-partners
Content-Type: application/json

{
  "partners": [
    { "partner_code": "CLI-0042", "rank": 0, "start_time": "08:00", "end_time": "08:30", "mileage": 1.2, "visit_frequency_days": 7 },
    { "partner_code": "CLI-0087", "rank": 1, "start_time": "08:45", "end_time": "09:15", "mileage": 0.8, "visit_frequency_days": 7 },
    { "partner_code": "CLI-0103", "rank": 2, "is_stop_point": true, "start_time": "10:00", "end_time": "10:30", "mileage": 2.1 }
  ]
}
```

**Champs par partenaire :**

| Champ | Requis | Description |
|-------|--------|-------------|
| `partner_code` | ✅ | Code du client |
| `rank` | — | Position dans la tournée (auto: index) |
| `is_stop_point` | — | `true` = point d'arrêt intermédiaire |
| `start_time` | — | Heure de début de visite (HH:MM) |
| `end_time` | — | Heure de fin de visite (HH:MM) |
| `mileage` | — | Distance depuis le point précédent (km) |
| `visit_frequency_days` | — | Fréquence de visite en jours (défaut: 7) |
| `notes` | — | Notes pour le vendeur |

**Réponse 200 :**

```json
{
  "success": true,
  "message": "Partners synced successfully",
  "partners": [ { "id": 201, "line_number": 1, "partner_code": "CLI-0042", "rank": 0, ... } ]
}
```

> ℹ️ Le `line_number` est automatiquement réassigné de 1 à N dans l'ordre du tableau envoyé.

---

### `POST /itineraries/{id}/assign-partner` — Ajouter un seul partenaire

Pour l'ajout rapide sans tout recharger. `line_number` est auto-incrémenté.

```json
{ "partner_code": "CLI-0150", "rank": 99, "visit_frequency_days": 14 }
```

---

### `DELETE /itineraries/{id}/partner/{itineraryPartnerId}` — Retirer un partenaire

```http
DELETE /api/backend/itineraries/7/partner/101
```

---

## 5. Vendeurs affectés à une tournée — ItineraryUser

La table `itinerary_user` lie un salesperson (SFA Van Seller, Order Taker…) à une tournée.

---

### `POST /itineraries/{id}/sync-users` — Remplacer la liste des vendeurs (BULK)

**Recommandé pour l'écran d'affectation.** Envoyer le tableau final des user_ids — les absents sont détachés, les nouveaux ajoutés.

```http
POST /api/backend/itineraries/7/sync-users
Content-Type: application/json

{
  "user_ids": [42, 56, 71]
}
```

**Réponse 200 :**

```json
{
  "success": true,
  "message": "Itinerary users synced successfully.",
  "users": [
    { "id": 42, "name": "Omar El Alaoui", "email": "omar@example.com" },
    { "id": 56, "name": "Karim Benhaddou", "email": "karim@example.com" },
    { "id": 71, "name": "Fatima Zohra", "email": "fatima@example.com" }
  ]
}
```

---

### `POST /itineraries/{id}/assign-user` — Affecter un vendeur

Pour l'ajout individuel depuis une multi-select.

```json
{ "user_id": 42, "is_active": true, "display_order": 0 }
```

---

### `DELETE /itineraries/{id}/users/{userId}` — Retirer un vendeur

```http
DELETE /api/backend/itineraries/7/users/42
```

---

## 6. Planning hebdomadaire — ItineraryPlanning

Définit **quel vendeur fait quelle tournée, quel jour de la semaine**.

**Base :** `/api/backend/itinerary-planning`

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-planning` | Lister (filtres: user_id, itinerary_id, day_code, is_active) |
| `POST` | `/api/backend/itinerary-planning` | Créer une affectation unique |
| `GET` | `/api/backend/itinerary-planning/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-planning/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-planning/{id}` | Supprimer |

### Codes de jour

| day_code | Jour |
|----------|------|
| 1 | Lundi |
| 2 | Mardi |
| 3 | Mercredi |
| 4 | Jeudi |
| 5 | Vendredi |
| 6 | Samedi |
| 7 | Dimanche |

---

### `POST /itinerary-planning/assign-days` — Affecter plusieurs jours à la fois

```http
POST /api/backend/itinerary-planning/assign-days
Content-Type: application/json

{
  "user_id": 42,
  "itinerary_id": 7,
  "day_codes": [2, 4],
  "is_active": true
}
```

Utilise `updateOrCreate` — safe à appeler plusieurs fois (idempotent).

**Réponse 200 :**

```json
{
  "success": true,
  "planning": [
    { "id": 91, "day_code": 2, "user": { "name": "Omar El Alaoui" }, "itinerary": { "code": "TRN-CAS-001" } },
    { "id": 92, "day_code": 4, "user": { "name": "Omar El Alaoui" }, "itinerary": { "code": "TRN-CAS-001" } }
  ]
}
```

---

### `DELETE /itinerary-planning/users/{userId}/days/{dayCode}` — Désaffecter un jour

```http
DELETE /api/backend/itinerary-planning/users/42/days/2
```

---

## 7. Overrides journaliers — ItineraryPlanningDaily

Permette de **remplacer ou enrichir** le planning hebdomadaire pour une date précise. Cas d'usage :
- Jour férié → désactiver une tournée
- Événement exceptionnel → vendeur fait une tournée différente ce jour-là
- Mode `APPEND` → s'ajoute aux tournées hebdomadaires déjà planifiées

**Base :** `/api/backend/itinerary-planning-daily`

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-planning-daily` | Lister (filtres: user_id, itinerary_id, work_date, from, to, is_active) |
| `POST` | `/api/backend/itinerary-planning-daily` | Créer un override |
| `GET` | `/api/backend/itinerary-planning-daily/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-planning-daily/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-planning-daily/{id}` | Supprimer |

---

### `POST /itinerary-planning-daily/upsert-for-date` — Remplacer les overrides d'un jour

**Endpoint principal pour le calendrier drag-and-drop.** Efface tout ce qui existait pour ce (user, date) et recrée avec les nouvelles entrées.

```http
POST /api/backend/itinerary-planning-daily/upsert-for-date
Content-Type: application/json

{
  "user_id": 42,
  "work_date": "2026-07-15",
  "entries": [
    { "itinerary_id": 9, "is_active": true, "strategy_mode": "REPLACE" },
    { "itinerary_id": 12, "is_active": true, "strategy_mode": "APPEND" }
  ]
}
```

**`strategy_mode` :**

| Valeur | Comportement sur le terminal |
|--------|------------------------------|
| `REPLACE` | Ce jour-là, ignorer le planning hebdomadaire — faire uniquement cette tournée |
| `APPEND` | Ce jour-là, faire cette tournée **en plus** des tournées hebdomadaires normales |

**Réponse 200 :**

```json
{
  "message": "Daily planning entries upserted.",
  "data": [
    { "id": 301, "work_date": "2026-07-15", "itinerary_id": 9, "strategy_mode": "REPLACE", "itinerary": { "code": "TRN-RBA-001", "name": "Tournée Rabat" } },
    { "id": 302, "work_date": "2026-07-15", "itinerary_id": 12, "strategy_mode": "APPEND", "itinerary": { "code": "TRN-RBA-002", "name": "Tournée Extra" } }
  ]
}
```

---

## 8. Affectation utilisateurs ↔ zones — GeoAreaUser

Permet d'affecter un superviseur ou un inspecteur à une zone géographique spécifique.

---

### `GET /geo-areas/{id}/users` — Liste des utilisateurs d'une zone

```http
GET /api/backend/geo-areas/12/users
```

```json
{
  "geo_area": { "id": 12, "code": "HAY-HAS", "name": "Hay Hassani" },
  "users": [
    { "id": 5, "name": "Superviseur Rachid", "email": "rachid@example.com", "assigned_at": "2026-03-23T12:00:00Z" }
  ]
}
```

---

### `POST /geo-areas/{id}/assign-user` — Affecter un utilisateur à une zone

```http
POST /api/backend/geo-areas/12/assign-user
Content-Type: application/json

{ "user_id": 5 }
```

Idempotent — si l'affectation existe déjà, ne crée pas de doublon.

**Réponse 200 :**

```json
{
  "message": "User assigned to geo area.",
  "user": { "id": 5, "name": "Superviseur Rachid", "email": "rachid@example.com" }
}
```

---

### `DELETE /geo-areas/{id}/users/{userId}` — Retirer un utilisateur d'une zone

```http
DELETE /api/backend/geo-areas/12/users/5
```

---

## 9. Types TypeScript

```typescript
// ─── Geo Area ──────────────────────────────────────────────────────────────

export interface GeoAreaType {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  rank: number;
  is_active: boolean;
}

export interface GeoArea {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  geo_area_type_id: number;
  parent_code: string | null;
  latitude: number | null;
  longitude: number | null;
  description: string | null;
  is_active: boolean;
  sort_order: number;
  geo_area_type?: GeoAreaType;
  parent?: Pick<GeoArea, 'id' | 'code' | 'name'>;
  children?: GeoArea[];
}

export interface GeoAreaUser {
  id: number;
  name: string;
  email: string;
  assigned_at: string;
}

export interface CreateGeoAreaPayload {
  code: string;
  name: string;
  name_ar?: string;
  geo_area_type_id: number;
  parent_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  description?: string | null;
  is_active?: boolean;
  sort_order?: number;
}

// ─── Itinerary Type ────────────────────────────────────────────────────────

export interface ItineraryType {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  description: string | null;
  business_nature_id: number | null;
  is_active: boolean;
}

// ─── Itinerary ─────────────────────────────────────────────────────────────

export interface Itinerary {
  id: number;
  code: string;
  name: string;
  name_ar: string | null;
  itinerary_type_id: number;
  itinerary_type?: ItineraryType;
  branch_code: string | null;
  branch?: { code: string; name: string };
  geo_area_code: string | null;
  geo_area?: Pick<GeoArea, 'code' | 'name'>;
  rider_id: number | null;
  rider?: { id: number; name: string };
  security_level: number;
  trend: number;
  days_before_next_visit: number;
  is_active: boolean;
  start_date: string | null;
  end_date: string | null;
  sort_order: number;
  itinerary_partners?: ItineraryPartner[];
}

// ─── ItineraryPartner ──────────────────────────────────────────────────────

export interface ItineraryPartner {
  id: number;
  itinerary_id: number;
  line_number: number;
  partner_code: string;
  rank: number;
  is_stop_point: boolean;
  start_time: string | null;
  end_time: string | null;
  mileage: number | null;
  visit_frequency_days: number;
  notes: string | null;
  is_active: boolean;
  partner?: { code: string; name: string };
}

export interface SyncPartnerEntry {
  partner_code: string;
  rank?: number;
  is_stop_point?: boolean;
  start_time?: string | null;
  end_time?: string | null;
  mileage?: number | null;
  visit_frequency_days?: number;
  notes?: string | null;
}

// ─── Planning hebdomadaire ─────────────────────────────────────────────────

export interface ItineraryPlanning {
  id: number;
  user_id: number;
  itinerary_id: number;
  day_code: 1 | 2 | 3 | 4 | 5 | 6 | 7;
  is_active: boolean;
  user?: { id: number; name: string; email: string };
  itinerary?: { id: number; code: string; name: string };
}

// ─── Planning journalier ───────────────────────────────────────────────────

export type PlanningDailyStrategyMode = 'REPLACE' | 'APPEND';

export interface ItineraryPlanningDaily {
  id: number;
  user_id: number;
  itinerary_id: number;
  work_date: string;
  is_active: boolean;
  strategy_mode: PlanningDailyStrategyMode;
  user?: { id: number; name: string; email: string };
  itinerary?: { id: number; code: string; name: string };
}

export interface UpsertForDateEntry {
  itinerary_id: number;
  is_active?: boolean;
  strategy_mode?: PlanningDailyStrategyMode;
}

export interface UpsertForDatePayload {
  user_id: number;
  work_date: string;
  entries: UpsertForDateEntry[];
}
```

---

## 10. React Query hooks

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const B = '/api/backend';

// ─── Geo Areas ─────────────────────────────────────────────────────────────

export function useGeoHierarchy() {
  return useQuery({
    queryKey: ['geo-areas', 'hierarchy'],
    queryFn: () => axios.get(`${B}/geo-areas/hierarchy`).then(r => r.data as GeoArea[]),
    staleTime: 5 * 60 * 1000,
  });
}

export function useGeoAreaChildren(parentCode: string | null) {
  return useQuery({
    queryKey: ['geo-areas', 'children', parentCode],
    queryFn: () => axios.get(`${B}/geo-areas/${parentCode}/children`).then(r => r.data as GeoArea[]),
    enabled: !!parentCode,
  });
}

export function useGeoAreas(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['geo-areas', params],
    queryFn: () => axios.get(`${B}/geo-areas`, { params }).then(r => r.data),
  });
}

export function useCreateGeoArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateGeoAreaPayload) =>
      axios.post(`${B}/geo-areas`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo-areas'] }),
  });
}

export function useUpdateGeoArea(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<CreateGeoAreaPayload>) =>
      axios.put(`${B}/geo-areas/${id}`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo-areas'] }),
  });
}

export function useDeleteGeoArea() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => axios.delete(`${B}/geo-areas/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo-areas'] }),
  });
}

export function useGeoAreaUsers(geoAreaId: number) {
  return useQuery({
    queryKey: ['geo-areas', geoAreaId, 'users'],
    queryFn: () => axios.get(`${B}/geo-areas/${geoAreaId}/users`).then(r => r.data),
    enabled: !!geoAreaId,
  });
}

export function useAssignGeoAreaUser(geoAreaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      axios.post(`${B}/geo-areas/${geoAreaId}/assign-user`, { user_id: userId }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo-areas', geoAreaId, 'users'] }),
  });
}

export function useRemoveGeoAreaUser(geoAreaId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: number) =>
      axios.delete(`${B}/geo-areas/${geoAreaId}/users/${userId}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['geo-areas', geoAreaId, 'users'] }),
  });
}

// ─── Itinerary Types ───────────────────────────────────────────────────────

export function useItineraryTypes(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['itinerary-types', params],
    queryFn: () => axios.get(`${B}/itinerary-types`, { params }).then(r => r.data),
  });
}

export function useCreateItineraryType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Partial<ItineraryType>) =>
      axios.post(`${B}/itinerary-types`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary-types'] }),
  });
}

// ─── Itineraries ───────────────────────────────────────────────────────────

export function useItineraries(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['itineraries', params],
    queryFn: () => axios.get(`${B}/itineraries`, { params }).then(r => r.data),
  });
}

export function useItinerary(id: number) {
  return useQuery({
    queryKey: ['itineraries', id],
    queryFn: () => axios.get(`${B}/itineraries/${id}`).then(r => r.data),
    enabled: !!id,
  });
}

export function useSyncPartners(itineraryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (partners: SyncPartnerEntry[]) =>
      axios.post(`${B}/itineraries/${itineraryId}/sync-partners`, { partners }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries', itineraryId] }),
  });
}

export function useSyncItineraryUsers(itineraryId: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userIds: number[]) =>
      axios.post(`${B}/itineraries/${itineraryId}/sync-users`, { user_ids: userIds }).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itineraries', itineraryId] }),
  });
}

// ─── Planning hebdomadaire ─────────────────────────────────────────────────

export function useItineraryPlanning(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['itinerary-planning', params],
    queryFn: () => axios.get(`${B}/itinerary-planning`, { params }).then(r => r.data),
  });
}

export function useAssignDays() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: { user_id: number; itinerary_id: number; day_codes: number[] }) =>
      axios.post(`${B}/itinerary-planning/assign-days`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary-planning'] }),
  });
}

export function useUnassignDay() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, dayCode }: { userId: number; dayCode: number }) =>
      axios.delete(`${B}/itinerary-planning/users/${userId}/days/${dayCode}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary-planning'] }),
  });
}

// ─── Planning journalier ───────────────────────────────────────────────────

export function usePlanningDaily(params: Record<string, unknown> = {}) {
  return useQuery({
    queryKey: ['itinerary-planning-daily', params],
    queryFn: () => axios.get(`${B}/itinerary-planning-daily`, { params }).then(r => r.data),
  });
}

export function useUpsertForDate() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpsertForDatePayload) =>
      axios.post(`${B}/itinerary-planning-daily/upsert-for-date`, payload).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['itinerary-planning-daily'] }),
  });
}
```

---

## 11. Erreurs et codes HTTP

| Code | Cause | Action UI |
|------|-------|-----------|
| `401` | Token invalide ou expiré | Rediriger login |
| `403` | Droit insuffisant ou suppression bloquée (enfants, branches) | Toast + message |
| `404` | Ressource introuvable | "Ressource introuvable" |
| `409` | Conflit — ItineraryType avec tournées liées | Modal avec compte |
| `422` | Validation échouée | Afficher erreurs par champ |
| `500` | Erreur serveur | Toast "Erreur serveur" + log Sentry |

**Pattern gestion d'erreur 422 :**

```typescript
catch (error) {
  if (axios.isAxiosError(error) && error.response?.status === 422) {
    const fieldErrors = error.response.data.errors as Record<string, string[]>;
    // ex: fieldErrors.code[0] = "The code has already been taken."
    setFormErrors(fieldErrors);
  }
}
```

---

## 12. Scénarios complets

---

### Scénario A — Construire l'écran Arborescence Géographique (Tree View)

```typescript
// 1. Charger la hiérarchie complète au montage
const { data: tree, isLoading } = useGeoHierarchy();

// 2. Afficher en TreeView (ex: react-arborist)
<TreeView
  data={tree}
  getNodeKey={n => n.code}
  getChildren={n => n.children}
  renderNode={(node) => (
    <div>
      <span>{node.name}</span>
      <Badge>{node.geo_area_type?.name}</Badge>
      <Button onClick={() => setEditTarget(node)}>✏️</Button>
    </div>
  )}
/>

// Alternative: lazy loading (mieux si arborescence profonde)
const { data: children } = useGeoAreaChildren(expandedNode?.code ?? null);
```

---

### Scénario B — Panel de configuration d'une tournée (partenaires)

```typescript
const { data } = useItinerary(7);
const syncPartners = useSyncPartners(7);

// Drag-and-drop de la liste de partenaires
const [partners, setPartners] = useState<SyncPartnerEntry[]>(
  data?.itinerary.itinerary_partners.map(p => ({
    partner_code: p.partner_code,
    rank: p.rank,
    start_time: p.start_time,
    end_time: p.end_time,
    mileage: p.mileage,
    visit_frequency_days: p.visit_frequency_days,
  })) ?? []
);

const handleSave = async () => {
  // Après réordonnancement drag-and-drop, envoyer la liste finale
  await syncPartners.mutateAsync(
    partners.map((p, index) => ({ ...p, rank: index }))
  );
};
```

---

### Scénario C — Calendrier de planification hebdomadaire

```typescript
// Afficher le planning d'un vendeur pour la semaine
const { data } = useItineraryPlanning({ user_id: 42 });

// planning.data = [
//   { day_code: 2, itinerary: { name: "Tournée Épiceries" } },
//   { day_code: 4, itinerary: { name: "Tournée Épiceries" } },
// ]

const assignDays = useAssignDays();

// L'admin coche Mardi + Jeudi dans un checkbox group
const handleAssign = () => assignDays.mutateAsync({
  user_id: 42,
  itinerary_id: 7,
  day_codes: [2, 4],
});

const unassign = useUnassignDay();

// Retirer le Mardi
const handleRemoveTuesday = () => unassign.mutateAsync({ userId: 42, dayCode: 2 });
```

---

### Scénario D — Override journalier (drag depuis calendrier)

```typescript
const upsertForDate = useUpsertForDate();

// L'admin déplace une journée sur un calendrier React (ex: FullCalendar)
const handleDrop = async (event: DropEvent) => {
  await upsertForDate.mutateAsync({
    user_id: event.userId,
    work_date: event.date,        // "2026-07-15"
    entries: [
      {
        itinerary_id: event.newItineraryId,
        strategy_mode: 'REPLACE', // Remplace la tournée habituelle de ce jour
      }
    ],
  });
};
```

---

### Scénario E — Affecter un superviseur à un secteur

```typescript
const { data } = useGeoAreaUsers(12);    // Zone "Hay Hassani"
const assign = useAssignGeoAreaUser(12);
const remove = useRemoveGeoAreaUser(12);

// Modale: liste de superviseurs avec checkbox
<UserList
  users={allSupervisors}
  selectedIds={data?.users.map(u => u.id) ?? []}
  onChange={async (userId, checked) => {
    if (checked) await assign.mutateAsync(userId);
    else await remove.mutateAsync(userId);
  }}
/>
```

---

## Résumé de tous les endpoints

### GeoAreas

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/geo-areas` | Lister (filtres: type_id, parent_code, search) |
| `POST` | `/api/backend/geo-areas` | Créer |
| `GET` | `/api/backend/geo-areas/{id}` | Détail |
| `PUT` | `/api/backend/geo-areas/{id}` | Modifier |
| `DELETE` | `/api/backend/geo-areas/{id}` | Supprimer |
| `GET` | `/api/backend/geo-areas/hierarchy` | Arborescence complète |
| `GET` | `/api/backend/geo-areas/{id}/toggle` | Activer / Désactiver |
| `GET` | `/api/backend/geo-areas/{parentCode}/children` | Enfants d'une zone |
| `GET` | `/api/backend/geo-areas/{id}/users` | Utilisateurs affectés |
| `POST` | `/api/backend/geo-areas/{id}/assign-user` | Affecter un utilisateur |
| `DELETE` | `/api/backend/geo-areas/{id}/users/{userId}` | Retirer un utilisateur |

### ItineraryTypes

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-types` | Lister |
| `POST` | `/api/backend/itinerary-types` | Créer |
| `GET` | `/api/backend/itinerary-types/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-types/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-types/{id}` | Supprimer (409 si tournées liées) |

### Itineraries

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itineraries` | Lister |
| `POST` | `/api/backend/itineraries` | Créer |
| `GET` | `/api/backend/itineraries/{id}` | Détail + partenaires |
| `PUT` | `/api/backend/itineraries/{id}` | Modifier |
| `DELETE` | `/api/backend/itineraries/{id}` | Supprimer |
| `POST` | `/api/backend/itineraries/{id}/sync-partners` | **Remplacer liste partenaires (BULK)** |
| `POST` | `/api/backend/itineraries/{id}/assign-partner` | Ajouter un partenaire |
| `DELETE` | `/api/backend/itineraries/{id}/partner/{pid}` | Retirer un partenaire |
| `POST` | `/api/backend/itineraries/{id}/sync-users` | **Remplacer liste vendeurs (BULK)** |
| `POST` | `/api/backend/itineraries/{id}/assign-user` | Affecter un vendeur |
| `DELETE` | `/api/backend/itineraries/{id}/users/{userId}` | Retirer un vendeur |

### Planning hebdomadaire

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-planning` | Lister |
| `POST` | `/api/backend/itinerary-planning` | Créer une affectation |
| `GET` | `/api/backend/itinerary-planning/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-planning/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-planning/{id}` | Supprimer |
| `POST` | `/api/backend/itinerary-planning/assign-days` | **Multi-jours (BULK)** |
| `DELETE` | `/api/backend/itinerary-planning/users/{uid}/days/{day}` | Désaffecter un jour |

### Planning journalier (overrides)

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/itinerary-planning-daily` | Lister (filtres: from, to, user_id) |
| `POST` | `/api/backend/itinerary-planning-daily` | Créer un override |
| `GET` | `/api/backend/itinerary-planning-daily/{id}` | Détail |
| `PUT` | `/api/backend/itinerary-planning-daily/{id}` | Modifier |
| `DELETE` | `/api/backend/itinerary-planning-daily/{id}` | Supprimer |
| `POST` | `/api/backend/itinerary-planning-daily/upsert-for-date` | **Remplacer overrides d'un jour (BULK)** |

---

*Dernière mise à jour : 2026-07-08*
