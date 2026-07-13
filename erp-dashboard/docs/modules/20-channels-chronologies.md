# Module 20 — Canaux & Chronologies Commerciales (API Contract)

> **Audience:** Frontend developers (ERP Webapp) — écrans Canaux, Chronologies, Fiche Client
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>` — permission `manage-partners`
> **Statut:** contrat capturé sur des réponses réelles (staging, 2026-07-13)

Contexte : le refactor de segmentation a remplacé l'enum `partners.channel` par la
table `channels` (avec **tarif de masse** `price_list_id`) et introduit les
**chronologies commerciales** (`business_chronologies`) affectées aux clients via
le pivot polymorphe `business_chronologibles` (tags `sub_types`).
Voir [01-pricing-engine.md](01-pricing-engine.md) §6 (pricing) et
[11-promotions.md](11-promotions.md) (ciblage promo).

---

## Table of Contents

1. [Canaux (channels)](#1-canaux-channels)
2. [Chronologies (business-chronologies)](#2-chronologies-business-chronologies)
3. [Affectation client (partners/{id}/chronologies)](#3-affectation-client-partnersidchronologies)
4. [Règles & erreurs](#4-règles--erreurs)
5. [TypeScript Interfaces](#5-typescript-interfaces)

---

## 1. Canaux (channels)

Le canal classe le client pour l'affichage, les filtres, le BI **et le pricing de
masse** : `price_list_id` est la liste de prix appliquée à tout partner du canal
qui n'a pas de `price_list_id` direct (`Partner::effectivePriceListId()`).

### 1.1 Lister — `GET /channels`

```bash
curl "https://api.omni360.cloud/api/backend/channels" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200`:**
```json
{
  "success": true,
  "channels": [
    {
      "id": 2,
      "code": "GROS",
      "name": "Grossistes",
      "description": "Distribution en gros",
      "price_list_id": 2,
      "is_active": true,
      "sort_order": 1,
      "partners_count": 0,
      "price_list": { "id": 2, "code": "C03", "name": "GROS", "rank": 20 }
    },
    {
      "id": 4,
      "code": "DETAIL",
      "name": "Détaillants",
      "description": "Épiceries et commerces de détail",
      "price_list_id": 4,
      "is_active": true,
      "sort_order": 3,
      "partners_count": 1483,
      "price_list": { "id": 4, "code": "C05", "name": "DETAILS", "rank": 40 }
    },
    {
      "id": 6,
      "code": "OTHER",
      "name": "Autre",
      "description": "Canal non classifié — pas de tarif de masse",
      "price_list_id": null,
      "is_active": true,
      "sort_order": 5,
      "partners_count": 5,
      "price_list": null
    }
  ]
}
```

> `partners_count` sert directement le badge "N clients" de l'écran Canaux.
> Les listes de prix pour le dropdown viennent de
> `GET /backend/masterdata/for-partner-form` (clé `priceLists`).

### 1.2 Modifier (dont tarif de masse) — `PUT /channels/{id}`

Tous les champs sont optionnels (`sometimes`) — envoyer uniquement ce qui change.
`price_list_id: null` retire le tarif de masse (les partners du canal sans liste
directe deviennent non tarifés).

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/channels/2" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "price_list_id": 1,
    "description": "Grossistes — tarif de masse C01"
  }'
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Channel updated successfully",
  "channel": {
    "id": 2,
    "code": "GROS",
    "name": "Grossistes",
    "description": "Grossistes — tarif de masse C01",
    "price_list_id": 1,
    "is_active": true,
    "sort_order": 1,
    "partners_count": 0,
    "price_list": { "id": 1, "code": "C01", "name": "DEMI-GROS", "rank": 10 }
  }
}
```

### 1.3 Créer / Supprimer

`POST /channels` — body: `{code*, name*, description?, price_list_id?, is_active?, sort_order?}` → `201`.
`DELETE /channels/{id}` → `200`, ou **`409`** si des partners sont rattachés :

```json
{ "success": false, "message": "1483 partner(s) are attached to this channel. Reassign them first." }
```

---

## 2. Chronologies (business-chronologies)

Référentiel des natures d'activité (Snack, Boucherie, …). Chaque chronologie
porte un **catalogue de tags** `available_sub_types` : c'est la source du
multiselect de tags sur la fiche client et le formulaire promo.

### 2.1 Lister — `GET /business-chronologies`

```bash
curl "https://api.omni360.cloud/api/backend/business-chronologies" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200`:**
```json
{
  "success": true,
  "business_chronologies": [
    {
      "id": 1,
      "code": "SNACK",
      "name": "Snack",
      "description": "Snacks, fast-food, shawarma, tacos",
      "available_sub_types": ["shawarma", "tacos", "burger", "panini", "fried_chicken"],
      "is_active": true,
      "sort_order": 0,
      "partners_count": 0,
      "promotions_count": 0
    },
    {
      "id": 2,
      "code": "BOUCHERIE",
      "name": "Boucherie",
      "description": "Boucheries et viandes",
      "available_sub_types": ["viande_rouge", "volaille", "charcuterie", "halal_certifie"],
      "is_active": true,
      "sort_order": 1,
      "partners_count": 0,
      "promotions_count": 0
    }
  ]
}
```

### 2.2 Créer — `POST /business-chronologies`

`available_sub_types` s'envoie comme **array JSON natif** (pas de string
encodée) ; le backend déduplique et filtre les vides.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/business-chronologies" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "POISSONNERIE",
    "name": "Poissonnerie",
    "description": "Poissonneries et produits de la mer",
    "available_sub_types": ["poisson_frais", "crustaces", "surgele"],
    "sort_order": 7
  }'
```

**Response `201`:**
```json
{
  "success": true,
  "message": "Business chronology created successfully",
  "business_chronology": {
    "id": 8,
    "code": "POISSONNERIE",
    "name": "Poissonnerie",
    "description": "Poissonneries et produits de la mer",
    "available_sub_types": ["poisson_frais", "crustaces", "surgele"],
    "sort_order": 7
  }
}
```

### 2.3 Modifier le catalogue de tags — `PUT /business-chronologies/{id}`

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/business-chronologies/8" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "available_sub_types": ["poisson_frais", "crustaces", "surgele", "sushi"] }'
```

**Response `200`:**
```json
{
  "success": true,
  "message": "Business chronology updated successfully",
  "business_chronology": {
    "id": 8,
    "code": "POISSONNERIE",
    "name": "Poissonnerie",
    "available_sub_types": ["poisson_frais", "crustaces", "surgele", "sushi"],
    "is_active": true,
    "sort_order": 7,
    "partners_count": 0,
    "promotions_count": 0
  }
}
```

> ⚠️ Retirer un tag du catalogue n'efface pas les affectations existantes qui
> l'utilisent — prévoir un avertissement UI si `partners_count > 0`.

`DELETE /business-chronologies/{id}` → `200`, ou **`409`** si utilisée par des
partners ou des promotions.

---

## 3. Affectation client (partners/{id}/chronologies)

Pivot polymorphe `business_chronologibles`. Sémantique **full-replace (sync)** :
le POST remplace l'affectation complète du client — l'UI envoie l'état final
du formulaire, pas des deltas.

### 3.1 Lire — `GET /partners/{id}/chronologies`

Retourne l'affectation actuelle **et** le référentiel complet
(`availableChronologies`) — un seul appel pour peindre tout l'écran.

```bash
curl "https://api.omni360.cloud/api/backend/partners/1/chronologies" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200`:**
```json
{
  "success": true,
  "chronologies": [
    { "id": 1, "code": "SNACK", "name": "Snack", "sub_types": ["shawarma", "tacos"], "is_primary": true },
    { "id": 5, "code": "CAFE_RESTAURANT", "name": "Café-Restaurant", "sub_types": ["cafe"], "is_primary": false }
  ],
  "availableChronologies": [
    { "id": 1, "code": "SNACK", "name": "Snack", "available_sub_types": ["shawarma", "tacos", "burger", "panini", "fried_chicken"] },
    { "id": 2, "code": "BOUCHERIE", "name": "Boucherie", "available_sub_types": ["viande_rouge", "volaille", "charcuterie", "halal_certifie"] }
  ]
}
```

### 3.2 Synchroniser — `POST /partners/{id}/chronologies`

- `sub_types` : tags cochés par le vendeur — **doivent appartenir au
  `available_sub_types` de la chronologie** (sinon `422`).
- `is_primary` : activité principale du client — **une seule au maximum**.
- `"chronologies": []` détache tout.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners/1/chronologies" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "chronologies": [
      { "code": "SNACK", "sub_types": ["shawarma", "tacos"], "is_primary": true },
      { "code": "CAFE_RESTAURANT", "sub_types": ["cafe"] }
    ]
  }'
```

**Response `200`** — même forme que le GET (état après sync) :
```json
{
  "success": true,
  "chronologies": [
    { "id": 1, "code": "SNACK", "name": "Snack", "sub_types": ["shawarma", "tacos"], "is_primary": true },
    { "id": 5, "code": "CAFE_RESTAURANT", "name": "Café-Restaurant", "sub_types": ["cafe"], "is_primary": false }
  ],
  "availableChronologies": [ "…" ]
}
```

> La sync invalide automatiquement le cache promotions du client (le ciblage
> promo par chronologie/tags est recalculé au prochain appel).

---

## 4. Règles & erreurs

| Cas | HTTP | Réponse |
|---|---|---|
| Tag hors catalogue | `422` | `{"success": false, "message": "Unknown sub_types for chronology SNACK: sushi", "available_sub_types": ["shawarma", "tacos", "burger", "panini", "fried_chicken"]}` |
| Plusieurs `is_primary` | `422` | `{"success": false, "message": "Only one chronology can be marked as primary."}` |
| Code chronologie inconnu | `422` | erreur de validation Laravel standard (`errors.chronologies.0.code`) |
| DELETE canal avec partners | `409` | `{"success": false, "message": "1483 partner(s) are attached to this channel. Reassign them first."}` |
| DELETE chronologie utilisée | `409` | `{"success": false, "message": "This chronology is used by N partner(s) and M promotion(s)…"}` |

Rappel fiche client : le canal du partner se lit/écrit via les endpoints
partner existants — `channel_id` (int) en écriture, ou `channel` (code string,
rétrocompatible) ; en lecture le JSON expose `channel` (code) + `channel_id`.

---

## 5. TypeScript Interfaces

```typescript
interface Channel {
  id: number;
  code: string;               // GMS | GROS | SOM_GROS | DETAIL | CHR | OTHER | custom
  name: string;
  description?: string | null;
  price_list_id?: number | null;   // tarif de MASSE (fallback pricing)
  is_active: boolean;
  sort_order: number;
  partners_count?: number;         // présent sur index/show/update
  price_list?: { id: number; code: string; name: string; rank: number } | null;
}

interface BusinessChronology {
  id: number;
  code: string;               // SNACK | BOUCHERIE | ...
  name: string;
  description?: string | null;
  available_sub_types: string[];   // catalogue de tags (source du multiselect)
  is_active: boolean;
  sort_order: number;
  partners_count?: number;
  promotions_count?: number;
}

interface PartnerChronologyAssignment {
  id: number;                 // business_chronology id
  code: string;
  name: string;
  sub_types: string[];        // tags cochés (⊆ available_sub_types)
  is_primary: boolean;        // au plus une par client
}

// POST /partners/{id}/chronologies — request body
interface SyncChronologiesRequest {
  chronologies: Array<{
    code: string;
    sub_types?: string[];
    is_primary?: boolean;
  }>;
}
```
