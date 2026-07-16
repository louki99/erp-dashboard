# Module 18 — Partners (Vue 360°)

> **Audience:** Frontend developers consuming the Partner API
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>`
> **Rôle requis (partenaires) :** permission `manage-partners` (via `DynamicRbacPermissionsSeeder` — pas restreint à `root`/`admin`, tout rôle qui reçoit la permission passe)
> **Rôle requis (credit-v2) :** permission `browse-credit-control`
> **Idempotency:** ⚠️ contrairement à une version antérieure de cette doc, les routes `POST/PUT/DELETE /partners*` **n'exigent PAS** de header `Idempotency-Key` (aucun middleware `idempotency.required` sur le groupe `partners` dans `routes/backend.php`) — seule `POST /credit-v2/partners/{id}/recalculate` l'exige. Ne pas bloquer l'UI sur ce header pour le CRUD fiche client.
> **Statut :** revue "Deep Review" post-nettoyage crédit effectuée le 2026-07-14 — §3, §4, §11 et §19 mis à jour avec des captures réelles ; voir [§20](#20-deep-review--points-de-vigilance-2026-07-14) pour les constats et bugs corrigés.

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
20. [Deep Review — points de vigilance (2026-07-14)](#20-deep-review--points-de-vigilance-2026-07-14)

---

## 1. Vue d'ensemble

Un **Partner** représente un client B2B (supermarché, épicerie, CHR, grossiste…). Il centralise :

| Dimension | Description |
|---|---|
| **Identité** | code, nom, canal (table `channels`), chronologies commerciales |
| **Tarification** | liste de prix par défaut + remplacements produit |
| **Conditions de paiement** | multiple conditions avec une en défaut |
| **Crédit** | limite, usage, exposition en temps réel, historique d'approbation |
| **Statut** | ACTIVE / ON_HOLD / BLOCKED / CLOSED + historique blocage |
| **Géolocalisation** | lat/lng, zone géographique, adresse |
| **Tournée** | affectation à un ou plusieurs itinéraires de livraison |
| **Activité commerciale** | commandes BC, bons de livraison BL |
| **Soldes** | points, budget, avoir |

**Depuis le nettoyage financier (`9fe56ac4`), une seule source de vérité crédit existe :**
- `partner_financial_profiles` — profil versionné avec règles métier (risque, tolérance, approbation, `change_reason` obligatoire)
- `partner_credit_states` — état matérialisé de l'exposition réelle (colonnes `GENERATED` `total_exposure`/`available_credit`, recalculé en temps réel)

Les colonnes `partners.credit_limit` / `credit_used` / `credit_available` /
`credit_hold` / `credit_hold_reason` ont été **supprimées** de la table
(migration `2026_07_14_000001_drop_credit_columns_from_partners.php`).
`Partner` expose toujours `credit_limit`, `credit_used`, etc. comme
**accessors PHP** (`getCreditLimitAttribute()`…) qui lisent à travers
`financialProfile()`/`creditState()` — donc **côté API la forme JSON n'a pas
changé** pour ces champs, seul le stockage a bougé. Voir
[08-payment-credit.md](08-payment-credit.md) §3.3 et §9.0 pour le détail des
endpoints `GET/PUT /partners/{id}/financial-profile` et `GET /partners/{id}/balances`.

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

> ⚠️ Il n'existe **pas** de route `/api/backend/payment-terms` — le référentiel
> vit sous `masterdata/`. Contrat FIGÉ : **enveloppe** `{success, data: [...]}`
> (jamais un array nu), lignes = modèles `payment_terms` complets, filtrés
> `active = true`, triés `rank` puis `id`.

```bash
curl "https://api.omni360.cloud/api/backend/masterdata/payment-terms" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` :**
```json
{
  "success": true,
  "data": [
    {
      "id": 1, "code": "IMMEDIATE", "name": "Paiement immédiat",
      "days_number": 0, "discount": null, "rank": 10,
      "is_credit": false, "is_cash": true, "is_bank_transfer": false,
      "is_avoir": false, "is_system": false, "is_temporary": false,
      "active": true, "calculation_type": "IMMEDIATE",
      "created_at": "…", "updated_at": "…"
    }
  ]
}
```

Clés stables sur lesquelles l'UI peut compter : `id`, `code`, `name`,
`days_number`, `discount`, `rank`, `is_credit`, `is_cash`, `is_bank_transfer`,
`is_avoir`, `is_system`, `is_temporary`, `active`.

---

## 3. Partner 360° — Fiche complète

`GET /backend/partners/{id}`

Retourne le partenaire avec ses relations préchargées : liste de prix,
payment_term par défaut, canal, hiérarchie parent/enfants, profil
financier/état crédit (§8), chronologies commerciales, zone géo, commandes et
BLs récents.

```bash
curl "https://api.omni360.cloud/api/backend/partners/1492" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle (staging, 2026-07-14) :**
```json
{
  "partner": {
    "id": 1492,
    "code": "CL001484",
    "name": "SNACK LA MARINA",
    "customer_id": null,
    "price_list_id": 4,
    "currency": "MAD",
    "default_discount_rate": "0.000000",
    "default_discount_amount": "0.000000",
    "max_discount_rate": "0.000000",
    "tax_number_ice": "003344556000078",
    "tax_number_if": null,
    "tax_exempt": false,
    "vat_group_code": null,
    "partner_type": "CUSTOMER",
    "risk_score": 0,
    "status": "ACTIVE",
    "blocked_until": null,
    "block_reason": null,
    "phone": "0661000001",
    "whatsapp": null,
    "email": "marina@test.ma",
    "website": null,
    "address_line1": "Bd de la Corniche",
    "address_line2": null,
    "city": "Casablanca",
    "region": null,
    "country": null,
    "postal_code": null,
    "geo_lat": "33.602100",
    "geo_lng": "-7.632000",
    "default_address_id": null,
    "geo_area_id": null,
    "channel_id": 5,
    "channel": "CHR",
    "salesperson_id": null,
    "min_order_amount": "500.000",
    "opening_hours": [],
    "last_order_date": null,
    "last_payment_date": null,
    "total_orders_count": 0,
    "total_orders_value": "0.00",
    "average_order_value": "0.00",
    "payment_behavior_score": 100,
    "allow_show_on_pos": false,
    "allocation_priority": "normal",
    "min_allocation_pct": "0.00",

    "price_list": { "id": 4, "code": "C05", "name": "DETAILS", "rank": 40 },
    "parent": null,
    "salesperson": null,
    "payment_term": null,
    "channel_ref": { "id": 5, "code": "CHR", "name": "Cafés, Hôtels, Restaurants", "price_list_id": 4 },
    "customer": null,
    "business_chronologies": [],
    "financial_profile": null,
    "credit_state": null,
    "children": [],
    "geo_area": null,
    "orders": [],
    "delivery_notes": [],
    "itinerary_partners": []
  },
  "taxId": null,
  "customFields": {
    "partner_rib": {
      "label": "RIB",
      "value": null,
      "formatted_value": null,
      "type": "text",
      "field": { "id": 10, "field_name": "partner_rib", "field_label": "RIB", "is_required": true }
    }
  }
}
```

> `financial_profile` / `credit_state` sont `null` tant qu'aucun profil n'a
> été initialisé pour ce partner (voir [08-payment-credit.md](08-payment-credit.md)
> §9.0).
>
> ⚠️ **Depuis le 2026-07-16 (§21), `address_line1`…`postal_code` ne sont plus
> des colonnes `partners`** — ce sont des accesseurs calculés depuis
> `defaultAddress` (table `addresses`, polymorphe). Ils restent présents et au
> même format dans la réponse JSON (rétro-compatible), mais l'écriture passe
> désormais par `defaultAddress`/`addresses[]` (voir §21) — plus par les clés
> plates du payload `PUT /partners/{id}`. `geo_lat`/`geo_lng` restent de
> vraies colonnes sur `partners`. Voir aussi [§20.1](#201-adresses--colonnes-plates-vs-polymorphe-address-️-obsolète--voir-21) (historique, obsolète).

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
| `q` | `string` | Recherche `ILIKE` sur `name`, `code`, `phone`, `email` |
| `status` | `string` | `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED` |
| `channel` | `string` | Code canal legacy (`GMS`, `GROS`, `DETAIL`, `CHR`, `SOM_GROS`, `OTHER`) — filtre via `Partner::scopeChannelCode()` |
| `channel_id` | `number` | Filtre direct sur `partners.channel_id` (recommandé — évite l'ambiguïté du code legacy) |
| `partner_type` | `string` | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| `salesperson_id` | `number` | Filtrer par commercial assigné (`partners.salesperson_id`) |
| `price_list_id` | `number` | Filtrer par liste de prix |
| `sort_by` | `string` | Whitelist stricte : `name, code, created_at, last_order_date, total_orders_count, total_orders_value, average_order_value` — toute autre valeur retombe sur `name` |
| `sort_dir` | `string` | `asc` \| `desc` (défaut `asc`) |
| `per_page` | `number` | Pagination — 20 par page par défaut |

```bash
curl "https://api.omni360.cloud/api/backend/partners?channel_id=5&sort_by=total_orders_value&sort_dir=desc&per_page=2" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle (extrait) :**
```json
{
  "partners": {
    "current_page": 1,
    "data": [
      {
        "id": 1492, "code": "CL001484", "name": "SNACK LA MARINA",
        "price_list_id": 4, "channel_id": 5, "channel": "CHR",
        "total_orders_count": 0, "total_orders_value": "0.00", "average_order_value": "0.00",
        "price_list": { "id": 4, "code": "C05", "name": "DETAILS" },
        "channel_ref": { "id": 5, "code": "CHR", "name": "Cafés, Hôtels, Restaurants", "price_list_id": 4 }
      }
    ],
    "per_page": 2, "total": 1, "last_page": 1
  },
  "filters": {
    "q": "", "status": "", "partner_type": "", "channel": "",
    "channel_id": 5, "salesperson_id": 0, "price_list_id": 0,
    "sort_by": "total_orders_value", "sort_dir": "desc"
  },
  "priceLists": [
    { "id": 1, "code": "C01", "name": "DEMI-GROS" },
    { "id": 2, "code": "C03", "name": "GROS" },
    { "id": 3, "code": "C04", "name": "GMS" },
    { "id": 4, "code": "C05", "name": "DETAILS" }
  ]
}
```

> `priceLists` est renvoyé avec la liste (alimente le dropdown filtre sans
> appel séparé). Les colonnes KPI CRM sont triables directement.

---

### 4.2 Créer un partenaire

`POST /backend/partners`

Le payload accepte les champs **soit à la racine, soit sous une clé `partner`**
(les deux formes sont acceptées ; c'est la forme `{"partner": {...}}` qu'utilise
l'écran ERP). **Champs requis :** `name` (ou `partner.name`), `price_list_id`
(ou `partner.price_list_id`, doit exister dans `price_lists`).

**Code :** optionnel — si omis, **auto-généré** au format `CL######` (prochain
numéro de séquence sur `partners.code LIKE 'CL%'`, verrouillé en transaction —
voir [§20.5](#205-bugs-corrigés-pendant-cette-revue-bloquants-préexistants)).
Si fourni, doit être **unique** sur `partners.code` (`422` sinon).

```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "partner": {
      "name": "SNACK LA MARINA",
      "phone": "0661000001",
      "email": "marina@test.ma",
      "channel": "CHR",
      "price_list_id": 4,
      "payment_term_id": 1,
      "address_line1": "Bd de la Corniche",
      "city": "Casablanca",
      "geo_lat": 33.6021,
      "geo_lng": -7.6320,
      "tax_number_ice": "003344556000078",
      "min_order_amount": 500
    }
  }'
```

**Response `201` — capture réelle :**
```json
{
  "success": true,
  "message": "Partner created successfully",
  "partner": {
    "id": 1495,
    "code": "CL001487",
    "name": "SNACK LA MARINA",
    "price_list_id": 4,
    "currency": "MAD",
    "tax_number_ice": "003344556000078",
    "channel_id": 5,
    "channel": "CHR",
    "phone": "0661000001",
    "email": "marina@test.ma",
    "address_line1": "Bd de la Corniche",
    "city": "Casablanca",
    "geo_lat": "33.602100",
    "geo_lng": "-7.632000",
    "min_order_amount": "500.000"
  },
  "data": {
    "partner_id": 1495,
    "partner_code": "CL001487",
    "customer_id": null,
    "user_id": null
  }
}
```

> `channel` accepte un **code** (`"CHR"`, `"GROS"`, …) résolu en `channel_id`
> côté serveur (`OTHER` par défaut si code inconnu). `currency` par défaut lit
> `finance.currency_code` (`ConfigurationSetting`, fallback `MAD`).
> `payment_term_id` n'écrit **pas** de colonne `partners` (supprimée) : il
> attache la ligne par défaut sur le pivot `partner_payment_terms`.

**Erreur de validation — `422` :**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/partners" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"partner": {"phone": "0600000000"}}'
```
```json
{
  "message": "The partner.name field is required when name is not present. (and 3 more errors)",
  "errors": {
    "partner.name": ["The partner.name field is required when name is not present."],
    "partner.price_list_id": ["The partner.price list id field is required when price list id is not present."],
    "name": ["The name field is required when partner.name is not present."],
    "price_list_id": ["The price list id field is required when partner.price list id is not present."]
  }
}
```
> Le message dédouble le champ racine et le champ `partner.*` (les deux
> emplacements sont validés en parallèle) — normal, l'UI doit lire les deux
> clés en résolvant le premier message trouvé.

**Règles de validation (état réel — `PartnerRequest`) :**

| Champ | Règle | Note |
|---|---|---|
| `code` | `nullable, string, max:50, unique:partners,code[,{id}]` | pas de contrainte de format ; vide ⇒ auto-génération `CL######` |
| `name` | `required_without` (racine/`partner.*`), `max:255` | |
| `price_list_id` | `required_without`, doit exister dans `price_lists` | requis même en `PUT` (§4.4) |
| `phone` / `whatsapp` | `nullable, string, max:30` | ⚠️ **aucun format regex** appliqué côté serveur actuellement |
| `tax_number_ice` / `tax_number_if` | `nullable, string, max:100` | ⚠️ **aucun format IF/Patente** appliqué côté serveur actuellement |
| `email` | `nullable, email, max:255` | |
| `geo_lat` / `geo_lng` | `between:-90,90` / `between:-180,180` | |
| `status` | `in:ACTIVE,ON_HOLD,BLOCKED,CLOSED` | |
| `salesperson_id` | `nullable, exists:users,id` | pas de vérification de rôle — n'importe quel user id valide passe |

---

### 4.3 Détail partenaire

Voir §3 — `GET /backend/partners/{id}`

---

### 4.4 Modifier un partenaire

`PUT /backend/partners/{id}`

Même forme de payload que la création (racine ou `{"partner": {...}}`).
**`price_list_id` reste obligatoire même en update** — la validation
`required_without` s'applique aussi bien en `PUT` qu'en `POST` (pas de règle
`sometimes` partielle actuellement) : un payload qui omet `price_list_id`/`partner.price_list_id`
renvoie `422`.

```bash
curl -X PUT "https://api.omni360.cloud/api/backend/partners/1494" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "partner": {
      "name": "TEST PUT TARGET RENAMED",
      "channel": "GROS",
      "price_list_id": 4,
      "whatsapp": "0662000002"
    }
  }'
```

**Response `200` :**
```json
{ "success": true, "message": "Partner updated successfully" }
```

> ⚠️ **Bug corrigé pendant cette revue (2026-07-14)** — `PartnerController::update()`
> ignorait silencieusement tout payload envoyé sous la forme `{"partner": {...}}`
> (il ne dépliait pas la clé imbriquée avant de la passer à `PartnerRepository::edit()`,
> contrairement à `store()`) : le serveur répondait `success: true` sans qu'aucun
> champ ne soit réellement persisté. C'était un **no-op silencieux sur tous les
> `PUT /partners/{id}`** envoyés par l'écran ERP (qui utilise systématiquement
> l'enveloppe `partner`). Corrigé et vérifié par relecture (`GET /partners/{id}`)
> après la capture ci-dessus.

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

Un partenaire peut être affecté à un ou plusieurs itinéraires de livraison via
la table pivot `itinerary_partners` (clé **`partner_code`**, pas `partner_id` —
soft FK). Le champ `itinerary_partners` est aussi inclus (à plat, sans
enrichissement) dans la réponse `GET /partners/{id}`.

### 11.1 Séquence de visite dédiée — `GET /partners/{id}/itinerary`

Endpoint ajouté pendant la revue "Deep Review" (2026-07-14) — expose la
séquence de visite enrichie (nom/type d'itinéraire, rang, fenêtre horaire)
sans avoir à recharger toute la fiche 360.

```bash
curl "https://api.omni360.cloud/api/backend/partners/1486/itinerary" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle :**
```json
{
  "success": true,
  "partner": { "id": 1486, "code": "GOLD-P01", "name": "Golden Partner One" },
  "allocation": { "allocation_priority": "normal", "min_allocation_pct": 0 },
  "itineraries": [
    {
      "itinerary_id": 16,
      "itinerary_code": "ITNA0001STD016",
      "itinerary_name": "Centre Ville",
      "itinerary_type": "IT-DAILY",
      "is_active": true,
      "line_number": 1,
      "rank": 1,
      "is_stop_point": true,
      "visit_date": "2026-07-13T23:00:00.000000Z",
      "start_time": null,
      "end_time": null,
      "visit_frequency_days": 7
    }
  ]
}
```

> `allocation_priority`/`min_allocation_pct` viennent des colonnes `partners`
> (allocation stock, indépendante de l'itinéraire) — exposées ici pour éviter
> un aller-retour supplémentaire côté UI carte/itinéraire.
>
> ⚠️ **Réassignation de commercial** — changer `partners.salesperson_id`
> (§12) **ne cascade pas** sur `itinerary_partners`/`itinerary_user`. Voir
> [§20.4](#204-réassignation-salesperson--itinéraires--sync-mobile) pour le
> détail de cette limitation architecturale.

### 11.2 Lister tous les itinéraires disponibles

```bash
curl "https://api.omni360.cloud/api/backend/itineraries" \
  -H "Authorization: Bearer {TOKEN}"
```

---

### 11.3 Affecter le partenaire à une tournée

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

### 11.4 Retirer le partenaire d'une tournée

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
  -d '{ "partner": { "salesperson_id": 7, "price_list_id": 4 } }'
```

> ⚠️ `salesperson_id` sur `partners` est le représentant "responsable de
> compte" par défaut (filtres/reporting, §4.1) — **indépendant** de
> l'assignation d'itinéraire réelle (`itinerary_user`/`itinerary_partners`).
> Changer ce champ ne transfère **pas** automatiquement les points de visite
> du client vers le nouveau commercial. Voir
> [§20.4](#204-réassignation-salesperson--itinéraires--sync-mobile).

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

Retourne le prochain code disponible selon le séquencement interne
(`prefix` par défaut `CL`, `digits` par défaut 6). **Ce n'est qu'un aperçu** —
la génération réelle a lieu côté serveur à la création (§4.2) si `code` est
omis ; les deux utilisent la même logique de séquence sur `partners.code`.

```bash
curl "https://api.omni360.cloud/api/backend/partners/generate-code" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :** `{"success": true, "code": "CL001488", "sequence": 1488}`

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
  partner_type: PartnerType;
  channel: PartnerChannel; // code string from the channels table (accessor over channel_id)
  channel_id?: number | null;
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

  // Crédit — accessors PHP lisant financial_profile/credit_state
  // (colonnes DB supprimées le 2026-07-14 ; forme JSON inchangée)
  credit_limit: string;
  credit_used: string;
  credit_available: string;
  credit_hold: boolean;
  credit_hold_reason?: string | null;
  financial_profile?: Record<string, unknown> | null;
  credit_state?: PartnerCreditState | null;

  // Statut & Blocage
  blocked_until?: string | null;
  block_reason?: string | null;
  allow_show_on_pos: boolean;

  // Contact
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  website?: string | null;

  // Adresse & Géo — address_line1…postal_code sont des accesseurs calculés
  // depuis defaultAddress (table addresses) depuis le 2026-07-16 (§21), pas
  // des colonnes partners. Même forme JSON, écriture via §21 uniquement.
  address_line1?: string | null;
  address_line2?: string | null;
  city?: string | null;
  region?: string | null;
  country: string;
  postal_code?: string | null;
  geo_lat?: string | null;
  geo_lng?: string | null;
  geo_area_id?: number | null;
  default_address_id?: number | null;
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
| `partner_type` | `varchar` | `CUSTOMER`, `SUPPLIER`, `BOTH` |
| `channel_id` | `bigint FK → channels` | Canal (remplace l'ancien enum `channel` — voir [20-channels-chronologies.md](20-channels-chronologies.md)) |
| `status` | `enum` | `ACTIVE`, `ON_HOLD`, `BLOCKED`, `CLOSED` |
| `price_list_id` | `bigint FK → price_lists` | Liste de prix par défaut |
| `default_address_id` | `bigint FK → addresses` | Adresse par défaut du partner — alimenté depuis le 2026-07-16 (§21) par `PartnerRepository::syncDefaultAddress()` et l'endpoint `PATCH .../addresses/{address}/default` |
| ~~`address_line1/2`, `city`, `region`, `country`, `postal_code`~~ | — | **Supprimées de `partners` le 2026-07-16** (migration `2026_07_24_000000_move_partner_address_to_addresses_table`) — vivent maintenant sur `addresses` (polymorphe, `addressable_type='App\Models\Partner'`). Voir §21. |
| `geo_lat` / `geo_lng` | `decimal(10,7)` | Coordonnées GPS — **restées** sur `partners` (utilisées par le trigger PostGIS `fn_assign_partner_geo_area`), dupliquées aussi sur `addresses.geo_lat/geo_lng` |
| `tax_number_ice` / `tax_number_if` | `varchar(100)` | Identifiants fiscaux — pas de validation de format serveur |
| `tax_exempt` | `boolean` | Stocké et lu (POS dashboard) — **non consommé par l'Invoice Engine** (§20.2) |
| `vat_group_code` | `varchar(50)` | Idem `tax_exempt` |
| `geo_area_id` | `bigint FK → geo_areas` | Zone géographique |
| `salesperson_id` | `bigint FK → users` | Commercial "responsable de compte" — indépendant de l'assignation itinéraire (§20.4) |
| `opening_hours` | `jsonb` | Horaires d'ouverture |
| `blocked_until` | `timestamp` | Expiration automatique du blocage |
| `block_reason` | `text` | Raison du blocage |
| `risk_score` | `smallint` | Score de risque (0–100) |
| `allocation_priority` | `varchar` | `high`, `normal`, `low` |
| `allow_show_on_pos` | `boolean` | Visible sur TPV |
| `last_order_date`, `total_orders_count`, `total_orders_value`, `average_order_value` | mixed | KPI CRM — recalcul synchrone à chaque commande soumise, voir [§20.3](#203-kpi-performance--recalcul-async) |

> ⚠️ **`credit_limit` / `credit_used` / `credit_available` / `credit_hold` /
> `credit_hold_reason` ont été supprimées** de cette table le 2026-07-14
> (migration `drop_credit_columns_from_partners`). Le crédit vit désormais
> exclusivement dans `partner_financial_profiles` / `partner_credit_states`
> (voir plus bas) ; `Partner` expose toujours ces noms comme **accessors PHP**
> pour compatibilité API — la table `partners` elle-même ne les contient plus.
> Le legacy `payment_term_id`/`default_payment_method`/`allowed_payment_methods`
> sur `partners` ont également été retirés — la condition par défaut vit sur
> le pivot `partner_payment_terms` (`is_default: true`).

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

---

## 20. Deep Review — points de vigilance (2026-07-14)

Revue de production-readiness de la fiche Partner effectuée après le
nettoyage financier (`9fe56ac4`), sur les 4 points de vigilance identifiés :
adresses/géo, taxes/facturation, KPI performance, réassignation
commercial/itinéraire. Captures et corrections faites en staging avant mise à
jour de ce document.

### 20.1 Adresses — colonnes plates vs polymorphe `Address` (⚠️ obsolète — voir §21)

> Cette section décrit l'état **avant** la revue du 2026-07-16 (§21), qui a
> supprimé les colonnes plates. Conservée pour l'historique du diagnostic.

Les **deux** systèmes coexistaient : `partners` avait des colonnes plates
(`address_line1`, `address_line2`, `city`, `region`, `country`, `postal_code`,
`geo_lat`, `geo_lng`) **et** une relation `defaultAddress()` (`default_address_id`
→ `addresses`) plus une relation polymorphe `addresses()` (`morphMany`, table
`addresses`, `addressable_type/id`).

Le chemin d'écriture de la fiche client (`POST`/`PUT /partners`, §4) n'écrivait
QUE les colonnes plates — `default_address_id` n'était jamais renseigné par
`PartnerRepository::normalize()`/`edit()`. C'était exactement la duplication que
§21 a résorbée.

### 20.2 Taxes & Facturation — `tax_exempt` / `vat_group_code`

Ces deux champs sont bien **stockés** sur `partners` (create/update
fonctionnels, §4.2) et **survivent intacts** au nettoyage crédit (colonnes
indépendantes des colonnes crédit supprimées). Ils sont **lus en lecture
seule** dans `PosManagerDashboardService` (bloc `fiscal` du dashboard POS).

**Ils ne sont branchés nulle part dans le moteur de facturation**
(`InvoiceService`, `GenerateInvoiceJob`, `PaymentCalculationService`,
`InvoicePayload` — aucune référence trouvée). Le calcul de taxe actuel est
**uniquement au niveau ligne produit** (`tax_rate` produit), sans notion
d'exonération partenaire ni de groupe TVA. **Ce n'est pas une régression** du
nettoyage crédit — ces champs n'ont jamais été consommés par l'Invoice Engine.
C'est un gap fonctionnel pré-existant à trancher en produit (faut-il que
`tax_exempt=true` force `tax_rate=0` sur les lignes de facture générées pour ce
partner ? qui décide du mapping `vat_group_code` ?) — pas de logique de calcul
implémentée sans spec produit validée.

### 20.3 KPI Performance — recalcul async

`last_order_date`, `total_orders_count`, `total_orders_value`,
`average_order_value` sont recalculés **de façon synchrone** (pas de job async)
via `CreditManagementService::recordOrderKpis()`, appelé sans condition depuis
`SubmitOrderDecision` pour **toute** commande soumise (crédit ou comptant) —
avant même le check `is_credit_sale`. L'écriture est enveloppée dans
`DB::transaction()` + `try/catch` non bloquant (un échec KPI n'annule jamais la
commande, juste un `Log::warning`).

> ⚠️ **Comportement corrigé pendant cette revue** — ce recalcul était
> auparavant imbriqué dans la logique crédit et ne se déclenchait donc **que**
> pour les ventes à crédit. Extrait dans une méthode dédiée
> (`recordOrderKpis()`) et appelé pour tous les modes de paiement.

### 20.4 Réassignation salesperson ↔ itinéraires ↔ sync mobile

**Constat : `partners.salesperson_id` et l'assignation d'itinéraire sont deux
mécanismes indépendants, sans cascade automatique.** `salesperson_id` sur
`partners` est le représentant "responsable de compte" par défaut (utilisé pour
filtrer/reporter, §4.1). Le routage de visite réel est porté par
`Itinerary` → pivot `itinerary_user` (assigne un ou plusieurs users à un
itinéraire géographique) et `itinerary_partners` (rattache un partner à un
itinéraire **par `partner_code`**, pas `partner_id`). Changer `salesperson_id`
sur la fiche client ne modifie **ni** `itinerary_user` **ni** `itinerary_partners`.

Ce n'est pas une régression : c'est l'architecture actuelle (un itinéraire est
géographique/tournant, pas propriété exclusive d'un seul rep). Mais cela veut
dire que réassigner un client à un nouveau rep depuis la fiche 360 **ne
transfère pas automatiquement ses points de visite** — à faire manuellement
côté écran Itinéraires (§11.3/§11.4). La sync mobile
(`SalespersonSyncEngineService`) suit le même modèle : elle synchronise les
itinéraires assignés via `itinerary_user`, indépendamment de
`partners.salesperson_id`.

**Recommandation (non implémentée — nécessite une décision produit) :** si le
métier attend une cascade automatique, il faudrait un listener sur
`Partner::updated()` détectant le changement de `salesperson_id` et
proposant/exécutant un ré-rattachement des lignes `itinerary_partners`
correspondantes — actuellement absent.

### 20.5 Bugs corrigés pendant cette revue (bloquants, pré-existants)

1. **`SettingsService` interrogeait une table `company_settings` inexistante**
   (`SQLSTATE[42P01]`) — bloquait *toute* création de partner (résolution de
   `currency_code`). Réécrit pour lire `ConfigurationSetting` (colonnes typées
   `string_value`/`int_value`/`bool_value`/`decimal_value`/`json_value`,
   résolues via `resolveStoredValue()` en fonction du `value_type` déclaré
   dans `sfa_params`).
2. **Auto-génération du code partner (`'CL'`) cassée** —
   `PartnerService::createPartner()` appelait `DocumentNumberingService` sur le
   système `token_series` plat (colonnes `invoice_prefix`/`order_prefix`/…),
   qui n'a jamais eu de colonnes `client_prefix`/`client_next_number` : ce
   système ne couvre que les documents transactionnels. Remplacé par une
   génération de séquence dédiée sur `partners.code LIKE 'CL%'` (verrouillée en
   transaction), reprenant la logique déjà existante et correcte de
   `PartnerController::generateCode()` (§16.4).
3. **`PUT /partners/{id}` no-op silencieux** — voir §4.4.

Ces trois bugs empêchaient purement et simplement la création/modification de
partenaires sur toute base fraîchement provisionnée (`db:fresh` + seed) — ils
ne sont pas une régression de ce sprint, mais n'avaient jamais été exercés en
staging avec un flux de bout en bout avant cette revue.

---

## 21. Unification Partner ↔ Address (2026-07-16)

`partners` avait 6 colonnes texte d'adresse (`address_line1`, `address_line2`,
`city`, `region`, `country`, `postal_code`) qui dupliquaient exactement les
colonnes de la table polymorphe `addresses` (déjà utilisée pour d'autres
besoins — adresses de livraison via `Partner::addresses()`/`morphMany`). Avant
le `db:fresh` de mise en production, ces colonnes ont été supprimées de
`partners` et `addresses` devient la **seule source de vérité**.
`geo_lat`/`geo_lng` restent sur `partners` (utilisés par le trigger PostGIS
`fn_assign_partner_geo_area`) — dupliqués aussi sur `addresses` pour cohérence
avec la géolocalisation de l'adresse elle-même.

### 21.1 Ce qui a changé côté API

**Aucun breaking change sur `GET /api/backend/partners/{id}`** —
`address_line1`, `address_line2`, `city`, `region`, `country`, `postal_code`
apparaissent toujours dans la réponse JSON, au même format qu'avant. Ce sont
maintenant des accesseurs calculés sur `App\Models\Partner`, résolus depuis
`defaultAddress` (avec repli automatique sur l'adresse la plus récente si
`default_address_id` n'est pas chargé). La réponse expose en plus :

- `partner.default_address` — l'objet `Address` complet (id, label,
  soft-delete, etc.), pas seulement les champs plats.
- `addresses` (au niveau racine de la réponse, à côté de `partner`) — la liste
  complète des adresses du partner (`Partner::addresses()`, `morphMany`), pour
  les UIs qui gèrent plusieurs adresses par partner (facturation/livraison/…).
- `default_address_id` (racine) — id de l'adresse par défaut.

**Capture réelle, staging, `GET /api/backend/partners/1`** (extrait) :

```json
{
  "partner": {
    "id": 1,
    "code": "CL00001",
    "name": "TIMITAR FOOD",
    "default_address_id": 1,
    "address_line1": "105, hay Mandarona rue 14 Bd",
    "address_line2": null,
    "city": null,
    "region": null,
    "country": "MA",
    "postal_code": null,
    "default_address": {
      "id": 1,
      "label": "Principale",
      "address_line1": "105, hay Mandarona rue 14 Bd",
      "city": null,
      "postal_code": null,
      "geo_lat": "33.5329254",
      "geo_lng": "-7.6138989",
      "addressable_type": "App\\Models\\Partner",
      "addressable_id": 1,
      "region": null,
      "country": "MA"
    }
  },
  "addresses": [ { "id": 1, "label": "Principale", "...": "..." } ],
  "default_address_id": 1,
  "taxId": null,
  "customFields": {}
}
```

### 21.2 Nouveaux endpoints — gestion des adresses d'un partner

Toutes sous `permission:manage-partners`, scope `/api/backend/partners/{partner}/addresses`.

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/partners/{partner}/addresses` | Liste toutes les adresses du partner + `default_address_id` |
| `POST` | `/partners/{partner}/addresses` | Crée une adresse. `is_default: true` (ou 1ère adresse créée) → devient l'adresse par défaut |
| `PUT` | `/partners/{partner}/addresses/{address}` | Met à jour une adresse (`sometimes|required` sur les champs obligatoires — payload partiel accepté) |
| `DELETE` | `/partners/{partner}/addresses/{address}` | Supprime (soft-delete). Si c'était l'adresse par défaut, `default_address_id` retombe automatiquement sur l'adresse la plus récente restante (ou `null` s'il n'en reste aucune) |
| `PATCH` | `/partners/{partner}/addresses/{address}/default` | Change l'adresse par défaut sans la modifier |

Champs acceptés (`store`/`update`) : `label`, `address_line1` (requis),
`address_line2`, `city` (requis), `region`, `country`, `postal_code`,
`geo_lat`, `geo_lng`, `is_default`. `addressable_type`/`addressable_id` ne sont
**jamais** acceptés du client — toujours dérivés du `{partner}` de la route
(`$partner->addresses()->create(...)`), donc pas de risque qu'un client
rattache une adresse à un autre partner.

**Capture réelle, staging** :

```
POST /api/backend/partners/1/addresses
{"label":"Livraison","address_line1":"47 Boulevard Mohammed V","city":"Casablanca","region":"Grand Casablanca","postal_code":"20000","country":"MA","is_default":false}

→ 201
{"success":true,"message":"Address created successfully",
 "address":{"id":1475,"label":"Livraison","address_line1":"47 Boulevard Mohammed V","city":"Casablanca","region":"Grand Casablanca","country":"MA","postal_code":"20000","addressable_id":1,"addressable_type":"App\\Models\\Partner"},
 "default_address_id":1}

PATCH /api/backend/partners/1/addresses/1475/default
→ 200 {"success":true,"message":"Default address updated successfully","default_address_id":1475}

DELETE /api/backend/partners/1/addresses/1
→ 200 {"success":true,"message":"Address deleted successfully","default_address_id":1475}
```

### 21.3 Écriture — `POST`/`PUT /partners` et `PartnerService::createPartner()`

Le payload `PUT`/`POST /partners` accepte toujours `address_line1`, `city`,
etc. **au même format qu'avant** — `PartnerRepository::syncDefaultAddress()`
les intercepte et fait un upsert sur `defaultAddress` (crée l'adresse si
absente, sinon la met à jour), puis pointe `default_address_id`. Aucun
changement requis côté UI pour ce flux ; c'est purement interne
(`Partner::$fillable` ne liste plus ces 6 clés, donc un payload qui les
contient ne provoque plus d'erreur SQL — elles sont simplement redirigées).

### 21.4 Blast radius traité

La suppression des colonnes touchait ~15 fichiers avec des `select()`/`with()`
contraints nommant explicitement `address_line1`/`city`/`postal_code` comme
colonnes `partners` (POS catalog, dispatcher, résolveurs SDUI de bons de
livraison/session/carte partenaires, recherche partner, tournée salesperson) —
tous corrigés pour eager-charger `defaultAddress` à la place. Un seeder
(`PartnerCsvSeeder`) faisait un upsert SQL brut sur ces colonnes (hors ORM,
donc invisible au premier passage) — corrigé pour upserter dans `addresses`
après résolution des ids partner. La vue SQL `vw_clients_summary` référençait
`p.city`/`p.address_line1` directement — recréée avec un `LEFT JOIN addresses`.

Migration `2026_07_24_000000_move_partner_address_to_addresses_table` :
backfill idempotent (crée une `Address` + `default_address_id` pour tout
partner ayant des données d'adresse mais pas encore de `default_address_id`),
recrée la vue, puis `dropColumn`. `down()` restaure les colonnes et réinjecte
les données depuis `defaultAddress`.

### 21.5 Master data pour le formulaire "Ajouter une adresse" — Région/Pays/Ville

L'équipe UI a demandé des dropdowns Région/Ville/Pays au lieu de champs texte
libres pour le modal d'ajout d'adresse. Deux tables `regions`/`villes`
(+ pivot `region_ville`) existent en base mais sont **mortes** : 0 lignes,
aucun seeder, aucune route dédiée — seulement référencées dans deux blocs
inutilisés de `PartnerController::create()`/`edit()`. **Ne pas les utiliser.**

Le vrai référentiel géographique de l'app est `geo_areas` (88 lignes, seedé,
hiérarchie via `geo_area_type_id`/`parent_code`, déjà branché sur
`partners.geo_area_id` et le routing de livraison) :

| `geo_area_types.code` | Niveau | Nb lignes |
|---|---|---|
| `100` | Pays | 1 |
| `200` | **Région** | 7 (les 12 régions officielles du Maroc ne sont pas toutes seedées) |
| `300` | Agence (branche commerciale) | 6 |
| `400` | Ville / Secteur | 65 |
| `500` | Secteur | 3 |
| `600` | Localité/Zone | 6 |

⚠️ **Le niveau 400 n'est pas une liste propre de villes** — la plupart des
lignes de ce type sont des quartiers/secteurs de livraison rattachés à une
"Agence" commerciale (ex: `CAS003 Aïn Chok`, `CAS010 Sidi Maarouf`, parent =
`A0001 Agence Casablanca`), pas des villes administratives. Une région n'a
qu'**un seul** enfant direct de type Ville (ex: `REGCASA` → `CASACITY
Casablanca` uniquement) — pas de vraie liste "Casablanca, Mohammédia,
Bouskoura, …" exploitable pour un dropdown ville.

**Recommandation appliquée** :
- **Région** → dropdown alimenté par `GET /api/backend/geo-areas?type_id=2`
  (7 régions officielles, propre).
- **Pays** → dropdown alimenté par `GET /api/countries` (déjà existant,
  10 pays actifs, `id`/`name`/`phone_code`).
- **Ville** → reste un champ texte libre (pas de master data fiable
  actuellement — en construire une proprement nécessiterait une saisie de
  données dédiée, hors périmètre de cette revue).

**Capture réelle** :

```
GET /api/backend/geo-areas?type_id=2
→ 200 { "geoAreas": { "data": [
    {"id":8,"code":"REGCASA","name":"Grand Casablanca-Settat","name_ar":"...",
     "geo_area_type":{"code":"200","name":"Région"}, "parent":{"code":"MAROC","name":"Maroc"}, ...},
    {"id":9,"code":"REGRABA","name":"Rabat-Salé-Kénitra","name_ar":"..."},
    {"id":12,"code":"REGTANG","name":"Tanger-Tétouan-Al Hoceïma","name_ar":"..."},
    ... (7 au total, paginé 20/page)
  ] }, "geoAreaTypes": [...], "parentAreas": [...] }

GET /api/countries
→ 200 { "message":"all countries", "countries":[
    {"id":1,"name":"Morocco","phone_code":"212"},
    {"id":2,"name":"Algeria","phone_code":"213"},
    ... (10 au total)
  ] }
```

Le champ `region` sur `Address`/`Partner` reste `varchar` (pas de FK) — le
front envoie le `name` du `geo_area` sélectionné (ex: `"Grand
Casablanca-Settat"`), pas son `id`/`code`. Aucun changement de schéma
nécessaire côté backend pour ce point.
