# Module 18 — Partners (Vue 360°)

> **Audience:** Frontend developers consuming the Partner API
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>`
> **Rôle requis (partenaires) :** `root` ou `admin` — les autres rôles reçoivent `403`
> **Rôle requis (credit-v2) :** `root`, `admin`, `adv_agent`, ou `sfa_supervisor`
> **Idempotency:** Toutes les mutations (POST/PUT/PATCH/DELETE) requièrent `Idempotency-Key: <unique-string>`

---

## Table of Contents

1. [Vue d'ensemble](#1-vue-densemble)
2. [Bootstrap — Données de formulaire](#2-bootstrap--données-de-formulaire)
3. [Partner 360° — Fiche complète](#3-partner-360--fiche-complète)
4. [CRUD Partenaires](#4-crud-partenaires)
   - [Lister](#41-lister-les-partenaires)
   - [Créer](#42-créer-un-partenaire)
   - [Détail](#43-détail-partenaire)
   - [Modifier](#44-modifier-un-partenaire)
   - [Supprimer](#45-supprimer-un-partenaire)
5. [Tarification — Changer la liste de prix](#5-tarification--changer-la-liste-de-prix)
6. [Conditions de paiement (payment_terms)](#6-conditions-de-paiement-payment_terms)
7. [Modes de règlement (payment_methods)](#7-modes-de-règlement-payment_methods)
8. [Crédit & Exposition financière](#8-crédit--exposition-financière)
9. [Dérogation de paiement (Payment Override)](#9-dérogation-de-paiement-payment-override)
10. [Statut & Blocage](#10-statut--blocage)
11. [Tournée (Itinéraire)](#11-tournée-itinéraire)
12. [Zone géographique](#12-zone-géographique)
13. [Commandes (BC) & Bons de livraison (BL)](#13-commandes-bc--bons-de-livraison-bl)
14. [Soldes partenaire (Points / Budget)](#14-soldes-partenaire-points--budget)
15. [Remplacements de prix (Price Overrides)](#15-remplacements-de-prix-price-overrides)
16. [Opérations diverses](#16-opérations-diverses)
17. [Recherche & Statistiques](#17-recherche--statistiques)
18. [TypeScript Interfaces](#18-typescript-interfaces)
19. [Database Schema Reference](#19-database-schema-reference)

---

## 1. Vue d'ensemble

Un **Partner** représente un client B2B (supermarché, épicerie, CHR, grossiste…). Il centralise :

| Dimension | Description |
|---|---|
| **Identité** | code, nom, type de canal, segment |
| **Tarification** | liste de prix par défaut + remplacements produit |
| **Conditions de paiement** | multiple conditions avec une en défaut |
| **Crédit** | limite, usage, exposition en temps réel, historique d'approbation |
| **Statut** | ACTIVE / ON_HOLD / BLOCKED / CLOSED + historique blocage |
| **Géolocalisation** | lat/lng, zone géographique, adresse |
| **Tournée** | affectation à un ou plusieurs itinéraires de livraison |
| **Activité commerciale** | commandes BC, bons de livraison BL |
| **Soldes** | points, budget, avoir |

**Trois niveaux de crédit coexistent :**
- `partners.credit_limit` / `credit_used` — colonnes simples (héritage)
- `partner_financial_profiles` — profil versionnée avec règles métier (risque, tolérance, approbation)
- `partner_credit_states` — état matérialisé de l'exposition réelle (calculé en temps réel)

---

## 2. Bootstrap — Données de formulaire

Avant d'afficher le formulaire de création/modification d'un partenaire, charger les référentiels en **un seul appel** :

`GET /backend/masterdata/for-partner-form`

```bash
curl "https://api.omni360.cloud/api/backend/masterdata/for-partner-form" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "priceLists": [
    { "id": 1, "code": "C01", "name": "GROS", "rank": 10 },
    { "id": 4, "code": "C05", "name": "DETAILS", "rank": 40 }
  ],
  "paymentTerms": [
    { "id": 1,  "code": "IMMEDIATE",     "name": "Paiement immédiat",              "is_cash": true,  "is_credit": false, "calculation_type": "IMMEDIATE", "days_number": 0   },
    { "id": 2,  "code": "NET7",          "name": "Net 7 jours",                    "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 7   },
    { "id": 3,  "code": "NET15",         "name": "Net 15 jours",                   "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 15  },
    { "id": 4,  "code": "NET30",         "name": "Net 30 jours",                   "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 30  },
    { "id": 5,  "code": "NET45",         "name": "Net 45 jours",                   "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 45  },
    { "id": 6,  "code": "NET60",         "name": "Net 60 jours",                   "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 60  },
    { "id": 7,  "code": "NET90",         "name": "Net 90 jours",                   "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 90  },
    { "id": 8,  "code": "NET120",        "name": "Net 120 jours",                  "is_cash": false, "is_credit": true,  "calculation_type": "DAYS",      "days_number": 120 },
    { "id": 9,  "code": "EOM",           "name": "Fin de mois",                    "is_cash": false, "is_credit": true,  "calculation_type": "END_MONTH", "days_number": 0   },
    { "id": 10, "code": "EOM15",         "name": "Fin de mois + 15 jours",         "is_cash": false, "is_credit": true,  "calculation_type": "END_MONTH", "days_number": 15  },
    { "id": 11, "code": "EOM30",         "name": "Fin de mois + 30 jours",         "is_cash": false, "is_credit": true,  "calculation_type": "END_MONTH", "days_number": 30  },
    { "id": 12, "code": "EOM60",         "name": "Fin de mois + 60 jours",         "is_cash": false, "is_credit": true,  "calculation_type": "END_MONTH", "days_number": 60  },
    { "id": 13, "code": "AT_DELIVERY",   "name": "À la livraison",                 "is_cash": false, "is_credit": true,  "calculation_type": "IMMEDIATE", "days_number": 0   },
    { "id": 14, "code": "SPLIT_30_60",   "name": "50% à 30j / 50% à 60j",         "is_cash": false, "is_credit": true,  "calculation_type": "SPLIT",     "days_number": 60  },
    { "id": 15, "code": "SPLIT_30_60_90","name": "33% à 30j / 33% à 60j / 34% à 90j","is_cash": false,"is_credit": true,"calculation_type": "SPLIT",     "days_number": 90  },
    { "id": 16, "code": "SPLIT_4X30",   "name": "4 × 25% tous les 30 jours",       "is_cash": false, "is_credit": true,  "calculation_type": "SPLIT",     "days_number": 120 }
  ],
  "geoAreas": [ ... ],
  "salespersons": [ ... ],
  "vatTaxes": [ ... ],
  "currencies": [ ... ]
}
```

> **Utiliser ce seul endpoint** pour pré-remplir tous les dropdowns du formulaire partenaire — évite 6 appels séparés.

**Ou lister uniquement les conditions de paiement :**

`GET /backend/masterdata/payment-terms`

```bash
curl "https://api.omni360.cloud/api/backend/masterdata/payment-terms" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** `{"success": true, "data": [ ... 16 payment_terms ... ]}`

---

## 3. Partner 360° — Fiche complète

`GET /backend/partners/{id}`

Retourne le partenaire avec ses relations préchargées : liste de prix, payment_term par défaut, zone géo, commercial, adresses, itinéraires, commandes et BLs récents.

```bash
curl "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "partner": {
    "id": 472,
    "code": "CL00472",
    "name": "ABDERRAHMAN SUPERETTE",
    "name_ar": "ABDERRAHMAN SUPERETTE",
    "partner_type": "CUSTOMER",
    "channel": "DETAIL",
    "status": "ACTIVE",
    "risk_score": 0,
    "segment_code": null,
    "company_id": 1,

    "price_list": {
      "id": 4,
      "code": "C05",
      "name": "DETAILS",
      "rank": 40
    },

    "payment_term": {
      "id": 15,
      "code": "SPLIT_30_60_90",
      "name": "33% à 30j / 33% à 60j / 34% à 90j",
      "is_credit": true,
      "is_cash": false,
      "days_number": 90,
      "calculation_type": "SPLIT"
    },

    "credit_limit": "0.00",
    "credit_used": "0.00",
    "credit_available": "0.00",
    "credit_hold": false,
    "credit_hold_reason": null,

    "default_discount_rate": "0.000000",
    "default_discount_amount": "0.000000",
    "max_discount_rate": "0.000000",
    "vat_group_code": "VAT_14",
    "tax_exempt": false,
    "tax_number_ice": null,
    "tax_number_if": null,
    "currency": "MAD",

    "phone": null,
    "whatsapp": null,
    "email": null,
    "website": null,

    "address_line1": "BAB KHAMISS EL MADINA",
    "address_line2": null,
    "city": null,
    "region": null,
    "country": "MA",
    "postal_code": null,
    "geo_lat": "34.036003",
    "geo_lng": "-6.819938",
    "delivery_instructions": null,
    "min_order_amount": "0.000",

    "geo_area": {
      "id": 1,
      "code": "A0001",
      "name": "Agence Casablanca",
      "geo_area_type_id": 3
    },

    "salesperson": null,
    "parent": null,
    "children": [],

    "payment_behavior_score": 100,
    "blocked_until": null,
    "block_reason": null,
    "allow_show_on_pos": false,
    "allocation_priority": "normal",
    "min_allocation_pct": "0.00",

    "opening_hours": [],
    "last_order_date": null,
    "last_payment_date": null,
    "total_orders_count": 0,
    "total_orders_value": "0.00",
    "average_order_value": "0.00",

    "orders": [],
    "delivery_notes": [],
    "itinerary_partners": []
  },
  "taxId": null,
  "customFields": {
    "partner_rib": {
      "label": "RIB",
      "value": null,
      "type": "text"
    }
  }
}
```

**Pour une vue 360° complète, combiner avec :**
- `GET /partners/{id}/payment-terms` — toutes les conditions de paiement (§6)
- `GET /partners/{id}/credit/history` — historique crédit (§8)
- `GET /credit-v2/partners/{id}` — exposition financière temps réel (§8)
- `GET /credit-v2/partners/{id}/events` — audit crédit (§8)

---

## 4. CRUD Partenaires

### 4.1 Lister les partenaires

`GET /backend/partners`

**Query parameters :**

| Paramètre | Type | Description |
|---|---|---|
| `search` | `string` | Recherche trigram sur code, nom, email, téléphone |
| `status` | `string` | `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED` |
| `channel` | `string` | `GMS`, `GROS`, `DETAIL`, `CHR`, `SOM_GROS`, `OTHER` |
| `partner_type` | `string` | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| `geo_area_id` | `number` | Filtrer par zone géographique |
| `salesperson_id` | `number` | Filtrer par commercial |
| `price_list_id` | `number` | Filtrer par liste de prix |
| `page` | `number` | Pagination — 20 par page par défaut |

```bash
curl "https://api.omni360.cloud/api/backend/partners?status=ACTIVE&channel=DETAIL&page=1" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### 4.2 Créer un partenaire

`POST /backend/partners`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:create:$(date +%s)" \
  -d '{
    "name": "Supermarché Alami",
    "name_ar": "سوبرماركت العلامي",
    "price_list_id": 4,
    "payment_term_id": 15,
    "channel": "DETAIL",
    "partner_type": "CUSTOMER",
    "vat_group_code": "VAT_14",
    "geo_area_id": 1,
    "salesperson_id": 4,
    "address_line1": "Rue Hassan II",
    "city": "Casablanca",
    "country": "MA",
    "geo_lat": 33.5731,
    "geo_lng": -7.5898,
    "phone": "+212600000001",
    "credit_limit": 50000,
    "custom_fields": {
      "partner_rib": "123456789012345678901234"
    }
  }'
```

**Champs requis :** `name`, `price_list_id`

**Response `201` :** objet `partner` complet (même forme que `GET /partners/{id}`).

---

### 4.3 Détail partenaire

Voir §3 — `GET /backend/partners/{id}`

---

### 4.4 Modifier un partenaire

`PUT /backend/partners/{id}`

Tous les champs sont optionnels — envoyer uniquement ce qui change. **C'est cet endpoint qui gère le changement de liste de prix, de zone géo, de commercial, d'adresse, etc.**

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:update:$(date +%s)" \
  -d '{
    "phone": "+212600112233",
    "address_line1": "Bd Mohammed V",
    "city": "Rabat",
    "geo_lat": 34.036003,
    "geo_lng": -6.819938
  }'
```

**Response `200` :** objet `partner` mis à jour.

---

### 4.5 Supprimer un partenaire

`DELETE /backend/partners/{id}`

> ⚠️ Irréversible. Vérifier qu'aucune commande active n'est liée avant de supprimer.

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: partner:472:delete:$(date +%s)"
```

**Response `200` :** `{"success": true, "message": "Partenaire supprimé"}`

---

## 5. Tarification — Changer la liste de prix

La liste de prix du partenaire est stockée dans `price_list_id` sur la table `partners`. Pour la changer, utiliser le `PUT /partners/{id}` standard.

```bash
# Changer la liste de prix vers la liste ID=2 (GROS)
curl -X PUT "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:pricelist:$(date +%s)" \
  -d '{ "price_list_id": 2 }'
```

**Obtenir la liste des price lists disponibles :**

```bash
curl "https://api.omni360.cloud/api/partners/distribution-channel" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
[
  { "id": 1, "code": "C01", "name": "GROS", "rank": 10 },
  { "id": 2, "code": "C02", "name": "SEMI-GROS", "rank": 20 },
  { "id": 3, "code": "C03", "name": "CHR", "rank": 30 },
  { "id": 4, "code": "C05", "name": "DETAILS", "rank": 40 }
]
```

> `rank` détermine la priorité tarifaire — plus petit = plus cher (prix grossiste < prix détail).

**Remplacements de prix produit** (price overrides) — voir §15.

---

## 6. Conditions de paiement (payment_terms)

> **Important — deux concepts distincts :**
> - **Condition de paiement** (`payment_term`) = délai et mode de calcul (NET30, FIN DE MOIS, SPLIT…). Un partenaire peut en avoir plusieurs via le pivot `partner_payment_terms`, avec une en défaut.
> - **Mode de règlement** (`payment_method`) = instrument physique (CHEQUE, ESPECES, VIREMENT…). C'est une table séparée utilisée lors des encaissements et dérogations — **non stockée directement sur le partenaire** (voir §7).

Un partenaire peut avoir **plusieurs** conditions de paiement (pivot `partner_payment_terms`), avec une condition marquée en défaut (`is_default: true`). Le champ `payment_term_id` sur `partners` reflète la condition par défaut active.

### 6.1 Lister les conditions du partenaire

`GET /backend/partners/{id}/payment-terms`

```bash
curl "https://api.omni360.cloud/api/backend/partners/472/payment-terms" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "partner": {
    "id": 472,
    "payment_term": {
      "id": 15,
      "name": "33% à 30j / 33% à 60j / 34% à 90j",
      "is_credit": true,
      "calculation_type": "SPLIT"
    },
    "payment_terms": [
      {
        "id": 9,
        "code": "EOM",
        "name": "Fin de mois",
        "calculation_type": "END_MONTH",
        "is_credit": true,
        "days_number": 0,
        "pivot": {
          "partner_id": 472,
          "payment_term_id": 9,
          "is_default": false
        }
      },
      {
        "id": 15,
        "code": "SPLIT_30_60_90",
        "name": "33% à 30j / 33% à 60j / 34% à 90j",
        "calculation_type": "SPLIT",
        "is_credit": true,
        "days_number": 90,
        "pivot": {
          "is_default": true
        }
      }
    ]
  },
  "availableTerms": [
    { "id": 1, "code": "IMMEDIATE", "name": "Paiement immédiat", "is_cash": true, "calculation_type": "IMMEDIATE" }
  ]
}
```

> `availableTerms` = conditions globales du système non encore assignées à ce partenaire — utiliser pour le dropdown "Ajouter une condition".

---

### 6.2 Ajouter une condition de paiement

`POST /backend/partners/{id}/payment-terms`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners/472/payment-terms" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:term:add:$(date +%s)" \
  -d '{
    "payment_term_id": 1,
    "is_default": false
  }'
```

**Response `200` :** partenaire avec `payment_terms` mis à jour.

---

### 6.3 Changer la condition par défaut

`POST /backend/partners/{id}/payment-terms/{termId}/default`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners/472/payment-terms/9/default" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: partner:472:term:default:$(date +%s)"
```

Cette action met `is_default: true` sur la condition choisie et `is_default: false` sur toutes les autres. Met également à jour `partners.payment_term_id`.

**Response `200` :** `{"success": true, "message": "Condition par défaut mise à jour"}`

---

### 6.4 Retirer une condition de paiement

`DELETE /backend/partners/{id}/payment-terms/{termId}`

> Impossible de retirer la condition par défaut si c'est la seule — assigner une autre en défaut d'abord.

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/partners/472/payment-terms/9" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: partner:472:term:remove:$(date +%s)"
```

**Response `200` :** `{"success": true}`

---

---

## 7. Modes de règlement (payment_methods)

> **Distinction clé :** les modes de règlement ne sont **pas stockés sur le partenaire**. Ils sont utilisés dans deux contextes :
> 1. **Encaissement** — lors de la saisie d'un paiement sur une facture/commande
> 2. **Dérogation** — pour demander un instrument de paiement différent de la condition habituelle (voir §9)

**Modes disponibles (table `payment_methods`) :**

| id | code | name | type | Référence requise | Banque requise |
|---|---|---|---|---|---|
| 1 | `CHEQUE` | Chèque | `check` | oui | oui |
| 2 | `CASH` | Espèces | `cash` | non | non |
| 3 | `MOBILE` | Paiement mobile | `mobile_money` | oui | non |
| 4 | `EFFET` | Effet de commerce | `check` | oui | oui |
| 5 | `VIREMENT` | Virement bancaire | `bank_transfer` | oui | oui |
| 6 | `CARD` | Carte bancaire | `credit_card` | oui | non |

**Lister les modes de règlement disponibles :**

`GET /backend/masterdata/payment-methods`

```bash
curl "https://api.omni360.cloud/api/backend/masterdata/payment-methods" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "success": true,
  "data": [
    { "id": 2, "code": "CASH",     "name": "Espèces",           "type": "cash",          "requires_reference": false, "requires_bank": false, "is_active": true, "display_order": 1 },
    { "id": 1, "code": "CHEQUE",   "name": "Chèque",            "type": "check",         "requires_reference": true,  "requires_bank": true,  "is_active": true, "display_order": 2 },
    { "id": 4, "code": "EFFET",    "name": "Effet de commerce", "type": "check",         "requires_reference": true,  "requires_bank": true,  "is_active": true, "display_order": 3 },
    { "id": 5, "code": "VIREMENT", "name": "Virement bancaire", "type": "bank_transfer", "requires_reference": true,  "requires_bank": true,  "is_active": true, "display_order": 4 },
    { "id": 6, "code": "CARD",     "name": "Carte bancaire",    "type": "credit_card",   "requires_reference": true,  "requires_bank": false, "is_active": true, "display_order": 5 },
    { "id": 3, "code": "MOBILE",   "name": "Paiement mobile",   "type": "mobile_money",  "requires_reference": true,  "requires_bank": false, "is_active": true, "display_order": 6 }
  ]
}
```

> Il n'existe pas d'endpoint pour modifier le mode de règlement d'un partenaire directement — le mode est choisi **à chaque encaissement ou dérogation**, pas au niveau du profil partenaire.

---

## 8. Crédit & Exposition financière

### 8.1 État crédit simple (héritage)

Les champs `credit_limit`, `credit_used`, `credit_available` sont directement sur l'objet partenaire (§2).

---

### 8.2 Historique des modifications de crédit

`GET /backend/partners/{id}/credit/history`

```bash
curl "https://api.omni360.cloud/api/backend/partners/472/credit/history" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "success": true,
  "data": {
    "current_limit": "50000.00",
    "current_used": "12500.00",
    "current_available": 37500.00,
    "orders": [
      {
        "id": 201,
        "order_code": "BC-2026-00201",
        "bc_status": "confirmed",
        "total_amount": "12500.00",
        "order_date": "2026-06-28"
      }
    ],
    "deliveries": [
      {
        "id": 501,
        "delivery_number": "BL-2026-00501",
        "status": "in_transit",
        "total_amount": "8000.00"
      }
    ]
  }
}
```

---

### 8.3 Modifier la limite de crédit

`PATCH /backend/partners/{id}/credit`

```bash
curl -X PATCH "https://api.omni360.cloud/api/backend/partners/472/credit" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:credit:$(date +%s)" \
  -d '{
    "credit_limit": 75000,
    "reason": "Augmentation suite à l'\''historique de paiement positif sur 6 mois"
  }'
```

| Champ | Requis | Type | Description |
|---|---|---|---|
| `credit_limit` | oui | `number` | Nouvelle limite (≥ 0) |
| `reason` | non | `string` | Raison de la modification (enregistrée dans les logs) |

**Response `200` :** `{"success": true, "message": "Credit limit updated successfully", "partner": {...}}`

---

### 8.4 Exposition financière temps réel (Credit Control V2)

`GET /backend/credit-v2/partners/{id}`

> ⚠️ **Préfixe correct : `/credit-v2/`** (pas `/credit-control/`). Rôle requis : `root`, `admin`, `adv_agent`, ou `sfa_supervisor`.

Retourne l'état matérialisé complet de l'exposition du partenaire — calculé depuis les factures, chèques, effets, commandes confirmées et avoirs.

```bash
curl "https://api.omni360.cloud/api/backend/credit-v2/partners/472" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "partner_id": 472,
  "credit_limit": 75000.00,
  "open_invoices_amount": 12500.00,
  "pending_cheques_amount": 0.00,
  "pending_effets_amount": 0.00,
  "confirmed_orders_amount": 8000.00,
  "delivered_not_invoiced_amount": 0.00,
  "validated_payments_amount": 0.00,
  "credit_notes_amount": 0.00,
  "total_exposure": 20500.00,
  "available_credit": 54500.00,
  "status": "ALLOWED",
  "overdue_invoice_count": 0,
  "oldest_overdue_days": 0,
  "risk_score": 15.50,
  "last_recalculated_at": "2026-06-29T18:00:00+00:00"
}
```

**Statuts possibles (`status`) :**

| Valeur | Signification | Action UI |
|---|---|---|
| `ALLOWED` | Crédit disponible, commande autorisée | Badge vert |
| `WARNING` | Approche de la limite | Badge orange — alerter le commercial |
| `SOFT_BLOCK` | Limite dépassée — approbation requise | Badge rouge — bouton "Demander dérogation" |
| `HARD_BLOCK` | Blocage total | Badge rouge foncé — commande impossible |

---

### 8.5 Évaluer l'éligibilité d'une commande (dry-run)

`POST /backend/credit-v2/partners/{id}/evaluate`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/credit-v2/partners/472/evaluate" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:eval:$(date +%s)" \
  -d '{ "order_amount": 15000 }'
```

**Response `200` :** `{"eligible": true, "status": "ALLOWED", "available_after": 39500.00}`  
ou `{"eligible": false, "status": "SOFT_BLOCK", "shortfall": 5000.00, "requires_approval": true}`

---

### 8.6 Forcer le recalcul de l'état crédit

`POST /backend/credit-v2/partners/{id}/recalculate`

Idempotent — peut être appelé après une mise à jour de facture ou de paiement pour rafraîchir `partner_credit_states`.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/credit-v2/partners/472/recalculate" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: partner:472:recalc:$(date +%s)"
```

---

### 8.7 Audit trail crédit (events)

`GET /backend/credit-v2/partners/{id}/events`

```bash
curl "https://api.omni360.cloud/api/backend/credit-v2/partners/472/events" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** liste chronologique de `credit_events` :
```json
[
  {
    "id": 88,
    "event_type": "ORDER_CONFIRMED",
    "amount": 8000.00,
    "reference_type": "Order",
    "reference_id": 201,
    "exposure_before": 12500.00,
    "exposure_after": 20500.00,
    "created_at": "2026-06-29T10:00:00+00:00"
  }
]
```

**Types d'événements (`event_type`) :** `INVOICE_VALIDATED`, `PAYMENT_RECEIVED`, `CHEQUE_CLEARED`, `CHEQUE_BOUNCED`, `EFFET_DEPOSITED`, `ORDER_CONFIRMED`, `ORDER_CANCELLED`, `CREDIT_NOTE_ISSUED`, `CREDIT_LIMIT_CHANGED`

---

## 9. Dérogation de paiement (Payment Override)

Un **Payment Override** permet de demander un changement de condition de paiement ou de mode de règlement **pour une commande ou facture spécifique**, avec circuit d'approbation.

> **Rôle pour demander :** `root`, `admin`, `adv_agent`, `sfa_van_sales`, `sfa_order_taker`
> **Rôle pour approuver/rejeter :** `root`, `admin`, `sfa_supervisor`

### 9.1 Demander une dérogation

`POST /backend/payment-overrides`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/payment-overrides" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: override:order:201:$(date +%s)" \
  -d '{
    "document_type": "order",
    "document_id": 201,
    "payment_term_id": 4,
    "payment_method_id": 1,
    "reason": "Client demande règlement par chèque à 30 jours au lieu du comptant habituel"
  }'
```

| Champ | Requis | Description |
|---|---|---|
| `document_type` | oui | `order` ou `invoice` |
| `document_id` | oui | ID de la commande ou facture |
| `payment_term_id` | non* | Nouvelle condition de paiement (id de `payment_terms`) |
| `payment_method_id` | non* | Nouveau mode de règlement (id de `payment_methods`) |
| `reason` | oui | Justification (min 10 chars) |

\* Au moins un des deux (`payment_term_id` ou `payment_method_id`) doit être fourni.

**Response `201` :**
```json
{
  "message": "Override request submitted for approval.",
  "data": {
    "id": 42,
    "document_type": "order",
    "document_id": 201,
    "payment_term_id": 4,
    "payment_method_id": 1,
    "reason": "...",
    "approval_status": "pending",
    "requested_by": 7,
    "created_at": "2026-06-30T18:00:00Z",
    "payment_term": { "id": 4, "code": "NET30", "name": "Net 30 jours" },
    "payment_method": { "id": 1, "code": "CHEQUE", "name": "Chèque" }
  }
}
```

> Si aucune approbation n'est requise (rôle `root` ou `admin`), le message sera `"Override applied (no approval required)."` et `approval_status: "approved"` immédiatement.

---

### 9.2 Lister les dérogations en attente

`GET /backend/payment-overrides/pending`

```bash
curl "https://api.omni360.cloud/api/backend/payment-overrides/pending" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** liste paginée des dérogations avec `approval_status: "pending"`.

---

### 9.3 Détail d'une dérogation

`GET /backend/payment-overrides/{id}`

---

### 9.4 Approuver une dérogation

`POST /backend/payment-overrides/{id}/approve`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/payment-overrides/42/approve" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: override:42:approve:$(date +%s)" \
  -d '{ "comment": "Approuvé — client historique de confiance" }'
```

---

### 9.5 Rejeter une dérogation

`POST /backend/payment-overrides/{id}/reject`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/payment-overrides/42/reject" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: override:42:reject:$(date +%s)" \
  -d '{ "reason": "Politique crédit : client doit rester en comptant jusqu'\''au solde des impayés" }'
```

---

## 10. Statut & Blocage

### 10.1 Changer le statut

`PATCH /backend/partners/{id}/status`

```bash
curl -X PATCH "https://api.omni360.cloud/api/backend/partners/472/status" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:status:$(date +%s)" \
  -d '{
    "status": "ON_HOLD",
    "reason": "Litige en cours — en attente de validation finance"
  }'
```

| Statut | Signification |
|---|---|
| `ACTIVE` | Opérationnel — commandes et livraisons autorisées |
| `ON_HOLD` | Suspendu temporairement — commandes bloquées |
| `BLOCKED` | Bloqué formellement — avec date d'expiration possible |
| `CLOSED` | Compte fermé définitivement |

---

### 10.2 Bloquer un partenaire

`PATCH /backend/partners/{id}/block`

```bash
curl -X PATCH "https://api.omni360.cloud/api/backend/partners/472/block" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:block:$(date +%s)" \
  -d '{
    "reason": "Impayés > 90 jours — 3 relances sans réponse",
    "blocked_until": "2026-09-30"
  }'
```

| Champ | Requis | Description |
|---|---|---|
| `reason` | oui | Raison du blocage (min 10 chars) |
| `blocked_until` | non | Date d'expiration automatique du blocage (`YYYY-MM-DD`) — si null, blocage permanent jusqu'à `unblock` |

---

### 10.3 Débloquer un partenaire

`PATCH /backend/partners/{id}/unblock`

```bash
curl -X PATCH "https://api.omni360.cloud/api/backend/partners/472/unblock" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:unblock:$(date +%s)" \
  -d '{ "comment": "Règlement reçu et validé — compte remis en ordre" }'
```

---

### 10.4 Toggle rapide

`PATCH /backend/partners/{id}/toggle`

Bascule entre `ACTIVE` ↔ `ON_HOLD` sans passer de body. Pratique pour le switch rapide dans la liste.

```bash
curl -X PATCH "https://api.omni360.cloud/api/backend/partners/472/toggle" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: partner:472:toggle:$(date +%s)"
```

**Response `200` :** `{"success": true, "status": "ON_HOLD"}`

---

## 11. Tournée (Itinéraire)

Un partenaire peut être affecté à un ou plusieurs itinéraires de livraison via la table pivot `itinerary_partners`. Le champ `itinerary_partners` est inclus dans la réponse `GET /partners/{id}`.

### 11.1 Lister les tournées du partenaire

Les tournées actuelles du partenaire sont visibles dans `partner.itinerary_partners[]` (réponse du §2).

Pour lister tous les itinéraires disponibles :

```bash
curl "https://api.omni360.cloud/api/backend/itineraries" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### 11.2 Affecter le partenaire à une tournée

`POST /backend/itineraries/{itineraryId}/assign-partner`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/itineraries/3/assign-partner" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: itinerary:3:partner:472:assign:$(date +%s)" \
  -d '{
    "partner_code": "CL00472",
    "rank": 5,
    "visit_frequency_days": 7,
    "start_time": "09:00",
    "end_time": "10:30",
    "is_stop_point": true,
    "notes": "Livraison avant ouverture magasin"
  }'
```

| Champ | Requis | Description |
|---|---|---|
| `partner_code` | oui | Code du partenaire (`partners.code`) |
| `rank` | non | Ordre dans la tournée (défaut 0) |
| `visit_frequency_days` | non | Fréquence de visite en jours (défaut 7) |
| `start_time` | non | Heure de début de visite (`HH:MM`) |
| `end_time` | non | Heure de fin de visite (`HH:MM`) |
| `is_stop_point` | non | Point d'arrêt officiel (défaut false) |
| `mileage` | non | Distance depuis le point précédent (km) |
| `notes` | non | Notes pour le livreur |

---

### 11.3 Retirer le partenaire d'une tournée

`DELETE /backend/itineraries/{itineraryId}/partner/{itineraryPartnerId}`

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/itineraries/3/partner/55" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Idempotency-Key: itinerary:3:partner:55:remove:$(date +%s)"
```

> `itineraryPartnerId` est l'`id` du pivot `itinerary_partners`, pas l'ID du partenaire.

---

## 12. Zone géographique

La zone géographique (`geo_area_id`) détermine l'agence/zone de rattachement du partenaire. Changer via `PUT /partners/{id}` :

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:geoarea:$(date +%s)" \
  -d '{
    "geo_area_id": 3,
    "geo_lat": 33.9716,
    "geo_lng": -6.8498
  }'
```

**Lister les zones disponibles :**

```bash
curl "https://api.omni360.cloud/api/backend/geo-areas" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
[
  { "id": 1, "code": "A0001", "name": "Agence Casablanca", "geo_area_type_id": 3 },
  { "id": 2, "code": "A0002", "name": "Agence Rabat", "geo_area_type_id": 3 },
  { "id": 3, "code": "A0003", "name": "Agence Tanger", "geo_area_type_id": 3 }
]
```

**Changer le commercial (salesperson) :**

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/partners/472" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partner:472:salesperson:$(date +%s)" \
  -d '{ "salesperson_id": 7 }'
```

---

## 13. Commandes (BC) & Bons de livraison (BL)

Les commandes et BLs du partenaire sont accessibles via les listes standard, filtrées par `partner_id`.

### 13.1 Commandes du partenaire

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/orders/pending?partner_id=472" \
  -H "Authorization: Bearer {TOKEN}"
```

Ou via l'objet partenaire directement — `partner.orders[]` dans la réponse de `GET /partners/{id}` (les N dernières commandes).

**Indicateurs disponibles sur le partenaire :**

| Champ | Description |
|---|---|
| `total_orders_count` | Nombre total de commandes |
| `total_orders_value` | Valeur totale cumulée |
| `average_order_value` | Panier moyen |
| `last_order_date` | Date de la dernière commande |
| `last_payment_date` | Date du dernier paiement |

---

### 13.2 Bons de livraison du partenaire

```bash
curl "https://api.omni360.cloud/api/backend/dispatcher/bon-livraisons?partner_id=472" \
  -H "Authorization: Bearer {TOKEN}"
```

Ou via `partner.delivery_notes[]` dans la réponse `GET /partners/{id}`.

---

### 13.3 Encours client (balance crédit)

Voir §8.2 (`GET /partners/{id}/credit/history`) et §8.4 (`GET /credit-v2/partners/{id}`) pour l'exposition complète factures + commandes + BLs.

---

## 14. Soldes partenaire (Points / Budget)

Les soldes (`partner_balances`) permettent de gérer des points de fidélité, des budgets promotionnels, ou des avoirs commerciaux.

### 14.1 Lister les soldes

```bash
curl "https://api.omni360.cloud/api/backend/partner-balances?partner_code=CL00472" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
[
  { "id": 1, "partner_code": "CL00472", "balance_type": "POINTS", "balance": 1500.00 },
  { "id": 2, "partner_code": "CL00472", "balance_type": "BUDGET_PROMO", "balance": 2500.00 }
]
```

---

### 14.2 Créer / Mettre à jour un solde

`POST /backend/partner-balances`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partner-balances" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: balance:CL00472:points:$(date +%s)" \
  -d '{
    "partner_code": "CL00472",
    "balance_type": "POINTS",
    "balance": 2000,
    "operation": "set"
  }'
```

| `operation` | Effet |
|---|---|
| `set` | Remplace le solde |
| `add` | Ajoute au solde |
| `subtract` | Soustrait du solde |

---

### 14.3 Supprimer un solde

`DELETE /backend/partner-balances/{id}`

---

## 15. Remplacements de prix (Price Overrides)

Les overrides permettent de définir un prix ou remise spécifique pour un couple (partenaire × produit), avec des fenêtres de validité et une priorité.

> **Note :** les endpoints CRUD dédiés ne sont pas encore exposés dans `routes/backend.php`. Les overrides sont créés/gérés directement via l'admin ou via `PUT /partners/{id}`. Demander au backend d'exposer `POST /partners/{id}/price-overrides` si l'UI en a besoin.

**Structure d'un override (table `partner_price_overrides`) :**

| Champ | Description |
|---|---|
| `product_id` | Produit ciblé |
| `fixed_price` | Prix fixe (remplace le prix de liste) |
| `discount_rate` | Remise en % sur le prix de base |
| `discount_amount` | Remise montant fixe |
| `valid_from` / `valid_to` | Fenêtre de validité |
| `priority` | Priorité — override le plus haut priorité gagne |
| `active` | Actif/inactif |

---

## 16. Opérations diverses

### 16.1 Trouver des partenaires proches (geo)

`GET /backend/partners/nearby`

Passer les coordonnées GPS du partenaire en query string (récupérées depuis `partner.geo_lat` / `partner.geo_lng`).

| Paramètre | Requis | Description |
|---|---|---|
| `lat` | oui | Latitude du point de référence |
| `lng` | oui | Longitude du point de référence |
| `radius` | non | Rayon en km (défaut 10, max 100) |

```bash
# Coordonnées du partenaire 472 : geo_lat=34.036003, geo_lng=-6.819938
curl "https://api.omni360.cloud/api/backend/partners/nearby?lat=34.036003&lng=-6.819938&radius=2" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** liste de partenaires dans le rayon spécifié, triés par distance croissante (champ `distance` en km ajouté à chaque objet).

---

### 16.2 Upload d'image

`POST /backend/partners/{id}/image`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners/472/image" \
  -H "Authorization: Bearer {TOKEN}" \
  -F "image=@/path/to/logo.jpg"
```

---

### 16.3 Opérations en masse

**Changer le statut de plusieurs partenaires :**

`POST /backend/partners/bulk/status`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners/bulk/status" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partners:bulk-status:$(date +%s)" \
  -d '{
    "partner_ids": [470, 471, 472],
    "status": "ON_HOLD",
    "reason": "Audit annuel — suspension temporaire"
  }'
```

**Suppression en masse :**

`DELETE /backend/partners/bulk/delete`

```bash
curl -X DELETE "https://api.omni360.cloud/api/backend/partners/bulk/delete" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: partners:bulk-delete:$(date +%s)" \
  -d '{ "partner_ids": [470, 471] }'
```

---

### 16.4 Générer un code partenaire

`GET /backend/partners/generate-code`

Retourne le prochain code disponible selon le séquencement interne.

```bash
curl "https://api.omni360.cloud/api/backend/partners/generate-code" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** `{"code": "CL00473"}`

---

## 17. Recherche & Statistiques

### 17.1 Recherche (trigram)

`GET /backend/partners/search`

```bash
curl "https://api.omni360.cloud/api/backend/partners/search?q=atlas&limit=10" \
  -H "Authorization: Bearer {TOKEN}"
```

Utilise un index GIN trigram PostgreSQL sur `name` et `code` — retourne des résultats pertinents même avec une saisie partielle ou des fautes de frappe légères.

---

### 17.2 Statistiques globales

`GET /backend/partners/statistics`

```bash
curl "https://api.omni360.cloud/api/backend/partners/statistics" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "total": 1250,
  "active": 980,
  "blocked": 42,
  "on_hold": 15,
  "closed": 213,
  "by_channel": {
    "DETAIL": 650,
    "GROS": 180,
    "GMS": 95,
    "CHR": 325
  },
  "average_credit_limit": 35000.00,
  "total_credit_exposure": 12500000.00
}
```

---

## 18. TypeScript Interfaces

```typescript
// ─── Enums ───────────────────────────────────────────────────────────────────

type PartnerStatus = 'ACTIVE' | 'ON_HOLD' | 'BLOCKED' | 'CLOSED';
type PartnerType = 'CUSTOMER' | 'SUPPLIER' | 'BOTH';
type PartnerChannel = 'GMS' | 'GROS' | 'DETAIL' | 'CHR' | 'SOM_GROS' | 'OTHER';
type CreditStatus = 'ALLOWED' | 'WARNING' | 'SOFT_BLOCK' | 'HARD_BLOCK';
type PaymentMethod = 'CASH' | 'CHEQUE' | 'BANK_TRANSFER' | 'CREDIT' | 'EFFET';
type AllocationPriority = 'high' | 'normal' | 'low';
type CreditEventType =
  | 'INVOICE_VALIDATED' | 'PAYMENT_RECEIVED' | 'CHEQUE_CLEARED' | 'CHEQUE_BOUNCED'
  | 'EFFET_DEPOSITED' | 'ORDER_CONFIRMED' | 'ORDER_CANCELLED'
  | 'CREDIT_NOTE_ISSUED' | 'CREDIT_LIMIT_CHANGED';

// ─── Core Models ─────────────────────────────────────────────────────────────

interface PriceList {
  id: number;
  code: string;
  name: string;
  rank: number;
}

interface PaymentTerm {
  id: number;
  code: string;
  name: string;
  discount: string;
  days_number: number;
  is_credit: boolean;
  is_cash: boolean;
  is_bank_transfer: boolean;
  calculation_type: 'IMMEDIATE' | 'NET_DAYS' | 'END_MONTH' | 'SPLIT' | 'DEFERRED';
  active: boolean;
}

interface GeoArea {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  geo_area_type_id: number;
  parent_code?: string | null;
  latitude?: string;
  longitude?: string;
  is_active: boolean;
}

interface ItineraryPartner {
  id: number;
  itinerary_id: number;
  partner_code: string;
  rank: number;
  line_number: number;
  is_stop_point: boolean;
  visit_date?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  visit_frequency_days: number;
  mileage?: number | null;
  notes?: string | null;
  is_active: boolean;
}

interface PartnerPaymentTerm extends PaymentTerm {
  pivot: {
    partner_id: number;
    payment_term_id: number;
    is_default: boolean;
    created_at: string;
    updated_at: string;
  };
}

// ─── Partner 360° ─────────────────────────────────────────────────────────────

interface Partner {
  id: number;
  code: string;
  name: string;
  name_ar?: string;
  description?: string | null;
  perimeter?: string | null;
  segment_code?: string | null;
  partner_type: PartnerType;
  channel: PartnerChannel;
  status: PartnerStatus;
  risk_score: number;
  company_id: number;

  // Tarification
  price_list_id?: number | null;
  price_list?: PriceList | null;

  // Paiement
  payment_term_id?: number | null;
  payment_term?: Pick<PaymentTerm, 'id' | 'name' | 'is_credit' | 'is_cash' | 'calculation_type'> | null;
  payment_terms?: PartnerPaymentTerm[];
  default_payment_method?: PaymentMethod;
  allowed_payment_methods?: PaymentMethod[];
  currency: string;

  // Remises
  default_discount_rate: string;
  default_discount_amount: string;
  max_discount_rate: string;

  // Fiscal
  tax_number_ice?: string | null;
  tax_number_if?: string | null;
  tax_exempt: boolean;
  vat_group_code?: string | null;

  // Crédit (colonnes simples)
  credit_limit: string;
  credit_used: string;
  credit_available: string;
  credit_hold: boolean;
  credit_hold_reason?: string | null;

  // Statut & Blocage
  blocked_until?: string | null;
  block_reason?: string | null;
  allow_show_on_pos: boolean;

  // Contact
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;

  // Adresse & Géo
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  postal_code?: string | null;
  geo_lat?: string | null;
  geo_lng?: string | null;
  geo_area_id?: number | null;
  geo_area?: GeoArea | null;
  delivery_instructions?: string | null;
  min_order_amount: string;
  delivery_zone?: string | null;
  opening_hours?: Record<string, unknown>[];

  // Hiérarchie & Commercial
  parent_partner_id?: number | null;
  parent?: Pick<Partner, 'id' | 'code' | 'name'> | null;
  children?: Pick<Partner, 'id' | 'code' | 'name'>[];
  salesperson_id?: number | null;
  salesperson?: { id: number; name: string } | null;

  // Opérations
  allocation_priority: AllocationPriority;
  min_allocation_pct: string;

  // Activité commerciale (stats)
  last_order_date?: string | null;
  last_payment_date?: string | null;
  total_orders_count: number;
  total_orders_value: string;
  average_order_value: string;
  payment_behavior_score: number;

  // Relations
  itinerary_partners?: ItineraryPartner[];
  orders?: Array<Record<string, unknown>>;
  delivery_notes?: Array<Record<string, unknown>>;

  created_at: string;
  updated_at: string;
}

// ─── Credit Control ────────────────────────────────────────────────────────────

interface PartnerCreditState {
  partner_id: number;
  credit_limit: number;
  open_invoices_amount: number;
  pending_cheques_amount: number;
  pending_effets_amount: number;
  confirmed_orders_amount: number;
  delivered_not_invoiced_amount: number;
  validated_payments_amount: number;
  credit_notes_amount: number;
  total_exposure: number;
  available_credit: number;
  status: CreditStatus;
  overdue_invoice_count: number;
  oldest_overdue_days: number;
  risk_score: number;
  last_recalculated_at: string;
}

interface CreditEvent {
  id: number;
  partner_id: number;
  event_type: CreditEventType;
  amount: number;
  reference_type: string;
  reference_id: number;
  exposure_before: number;
  exposure_after: number;
  metadata?: Record<string, unknown>;
  created_at: string;
}

interface PartnerCreditHistory {
  id: number;
  partner_id: number;
  old_limit: string;
  new_limit: string;
  changed_by: number;
  justification: string;
  approval_status: 'approved' | 'pending' | 'rejected';
  approved_by?: number | null;
  approved_at?: string | null;
  created_at: string;
}

// ─── Payment Methods ──────────────────────────────────────────────────────────

interface PaymentMethod {
  id: number;
  code: 'CHEQUE' | 'CASH' | 'MOBILE' | 'EFFET' | 'VIREMENT' | 'CARD';
  name: string;
  type: 'cash' | 'check' | 'bank_transfer' | 'mobile_money' | 'credit_card';
  requires_reference: boolean;
  requires_bank: boolean;
  is_active: boolean;
  display_order: number;
}

// ─── Payment Override ─────────────────────────────────────────────────────────

type OverrideApprovalStatus = 'pending' | 'approved' | 'rejected';

interface PaymentOverride {
  id: number;
  document_type: 'order' | 'invoice';
  document_id: number;
  payment_term_id?: number | null;
  payment_method_id?: number | null;
  reason: string;
  approval_status: OverrideApprovalStatus;
  requested_by: number;
  approved_by?: number | null;
  comment?: string | null;
  payment_term?: Pick<PaymentTerm, 'id' | 'code' | 'name'> | null;
  payment_method?: Pick<PaymentMethod, 'id' | 'code' | 'name'> | null;
  created_at: string;
  updated_at: string;
}

// ─── Balances ─────────────────────────────────────────────────────────────────

interface PartnerBalance {
  id: number;
  partner_code: string;
  balance_type: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

// ─── Price Override ───────────────────────────────────────────────────────────

interface PartnerPriceOverride {
  id: number;
  partner_id: number;
  product_id: number;
  fixed_price?: number | null;
  discount_rate?: number | null;
  discount_amount?: number | null;
  valid_from?: string | null;
  valid_to?: string | null;
  active: boolean;
  priority: number;
  created_at: string;
  updated_at: string;
}
```

---

## 19. Database Schema Reference

### `partners` (colonnes clés)

| Colonne | Type | Description |
|---|---|---|
| `id` | `bigint` | Clé primaire |
| `code` | `varchar(50)` | Code interne unique (ex: `CL00472`) |
| `name` | `varchar(255)` | Nom commercial |
| `name_ar` | `varchar(255)` | Nom en arabe |
| `partner_type` | `enum` | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| `channel` | `enum` | `GMS`, `GROS`, `DETAIL`, `CHR`, `SOM_GROS`, `OTHER` |
| `status` | `enum` | `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED` |
| `price_list_id` | `bigint FK → price_lists` | Liste de prix par défaut |
| `payment_term_id` | `bigint FK → payment_terms` | Condition de paiement par défaut |
| `default_payment_method` | `enum` | Mode de paiement par défaut |
| `allowed_payment_methods` | `jsonb` | Modes autorisés |
| `credit_limit` | `decimal(14,3)` | Limite de crédit |
| `credit_used` | `decimal(14,3)` | Crédit consommé |
| `credit_available` | `decimal(14,3)` | **GENERATED** : `credit_limit - credit_used` |
| `geo_area_id` | `bigint FK → geo_areas` | Zone géographique |
| `salesperson_id` | `bigint FK → users` | Commercial assigné |
| `geo_lat` / `geo_lng` | `decimal(10,7)` | Coordonnées GPS |
| `opening_hours` | `jsonb` | Horaires d'ouverture |
| `blocked_until` | `timestamp` | Expiration automatique du blocage |
| `block_reason` | `text` | Raison du blocage |
| `risk_score` | `smallint` | Score de risque (0–100) |
| `allocation_priority` | `varchar` | `high`, `normal`, `low` |
| `allow_show_on_pos` | `boolean` | Visible sur TPV |

### `partner_payment_terms` (pivot)

| Colonne | Type | Description |
|---|---|---|
| `partner_id` | `bigint FK` | |
| `payment_term_id` | `bigint FK` | |
| `is_default` | `boolean` | Condition par défaut |

Unique sur `(partner_id, payment_term_id)`.

### `partner_credit_states` (matérialisé)

| Colonne | Type | Description |
|---|---|---|
| `partner_id` | `bigint FK` | Un seul enregistrement par partenaire |
| `credit_limit` | `decimal(15,2)` | Synced depuis `partner_financial_profiles` |
| `total_exposure` | `decimal(15,2)` | **GENERATED** : somme de toutes les expositions |
| `available_credit` | `decimal(15,2)` | **GENERATED** : `credit_limit - total_exposure` |
| `status` | `varchar(15)` | `ALLOWED`, `WARNING`, `SOFT_BLOCK`, `HARD_BLOCK` |
| `last_recalculated_at` | `timestamp` | Dernière mise à jour |

### `partner_financial_profiles` (versionnée)

| Colonne | Type | Description |
|---|---|---|
| `partner_id` | `bigint FK` | Unique quand `effective_to IS NULL` (profil actif) |
| `credit_limit_amount` | `decimal(15,2)` | Limite métier |
| `max_credit_days` | `int` | Jours max de créance |
| `risk_level` | `varchar(10)` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `over_credit_tolerance_pct` | `decimal(5,2)` | % de tolérance au-dessus de la limite |
| `require_approval_over_limit` | `boolean` | Approbation requise si dépassement |
| `effective_from` / `effective_to` | `date` | Fenêtre de validité du profil |

### `itinerary_partners` (pivot tournée)

| Colonne | Type | Description |
|---|---|---|
| `itinerary_id` | `bigint FK` | |
| `partner_code` | `varchar(50)` | Référence **par code** (soft FK) |
| `rank` | `int` | Ordre dans la tournée |
| `line_number` | `int` | Numéro de ligne unique par itinéraire |
| `is_stop_point` | `boolean` | Point d'arrêt officiel |
| `visit_frequency_days` | `int` | Fréquence de visite |
| `start_time` / `end_time` | `time` | Créneau horaire de visite |
| `mileage` | `decimal(10,2)` | Distance depuis le point précédent (km) |
| `last_visit_date` / `next_visit_date` | `datetime` | Dates de visite |

### `partner_credit_history`

| Colonne | Type | Description |
|---|---|---|
| `partner_id` | `bigint FK` | |
| `old_limit` / `new_limit` | `decimal(15,2)` | Avant / après |
| `changed_by` | `bigint FK → users` | Qui a modifié |
| `justification` | `varchar(500)` | Raison |
| `approval_status` | `varchar(20)` | `approved`, `pending`, `rejected` |
| `approved_by` / `approved_at` | mixed | Circuit d'approbation |

### `partner_balances`

| Colonne | Type | Description |
|---|---|---|
| `partner_code` | `varchar(50)` | Référence par code |
| `balance_type` | `varchar(50)` | `POINTS`, `BUDGET`, etc. |
| `balance` | `decimal(15,2)` | Solde courant |

---

*Source: `app/Http/Controllers/Backend/PartnerController.php`, `app/Http/Controllers/Backend/CreditControlV2Controller.php`, `app/Http/Controllers/API/PartnerBalanceController.php`, `app/Models/Partner.php`, `app/Models/PartnerPaymentTerms.php`, `app/Models/PartnerBalance.php`, `app/Models/PartnerPriceOverride.php`, `app/Models/ItineraryPartner.php`, `database/migrations/`, `routes/backend.php`*

*Créé: 2026-06-30 — Documentation Partner 360° complète : CRUD, tarification, conditions de paiement, crédit V2, statut/blocage, tournées, zone géo, balances, overrides de prix, opérations en masse, TypeScript interfaces.*
