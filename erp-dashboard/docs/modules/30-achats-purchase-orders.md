# Module 30 — Achats (BC Fournisseur → Réception → Facture → Stock)

> **Audience:** Frontend developers (ERP Webapp) — écrans Achats : Commande
> Fournisseur, Réception de Marchandise, Facture Fournisseur (3-way
> matching), Consultation Stock.
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>` — permissions listées en §2.
> **Statut:** BC Fournisseur/Réception/Stock (§1-9) déployés et vérifiés en
> staging le 2026-08-26 (commit `c3e74a14`). Facture Fournisseur (§11) est
> neuve, construite le 2026-08-26 suite au design sign-off — **migrations
> pas encore jouées sur staging au moment de la rédaction**, exemples JSON
> de cette section construits à partir des modèles/contrôleurs réels, pas
> des captures live.

Avant ce chantier, `purchase_receptions` existait déjà (réception de
marchandise, montée du stock Tier 1 + PMP pondéré) mais n'avait **aucune
commande fournisseur en amont** : le champ `purchase_order_number` était du
texte libre, jamais validé, jamais lu. Ce module ajoute le maillon manquant
(`PurchaseOrder` / BC Fournisseur) et le rapprochement Commandé ⇄ Reçu.

```
BC Fournisseur (PurchaseOrder)  --confirmer-->  CONFIRMÉ  --réception(s)-->  PARTIELLEMENT REÇU  -->  REÇU
        |                                                        |
        v                                                        v
   purchase_order_lines.ordered_quantity          purchase_order_lines.received_quantity
                                                    (incrémenté à chaque validation de réception,
                                                     décrémenté si la réception est annulée/reverse)
```

---

## Table of Contents

1. [Vue d'ensemble du flux](#1-vue-densemble-du-flux)
2. [Permissions](#2-permissions)
3. [BC Fournisseur — `/purchase-orders`](#3-bc-fournisseur--purchase-orders)
4. [Réception Achat — `/purchase-receptions`](#4-réception-achat--purchase-receptions)
5. [Rapprochement Commandé vs Reçu](#5-rapprochement-commandé-vs-reçu)
6. [PMP (Prix Moyen Pondéré)](#6-pmp-prix-moyen-pondéré)
7. [Consultation Stock temps réel (Tier 1)](#7-consultation-stock-temps-réel-tier-1)
8. [TypeScript Interfaces](#8-typescript-interfaces)
9. [Statut du déploiement / ce qui reste à faire](#9-statut-du-déploiement--ce-qui-reste-à-faire)
10. [Testing](#10-testing)
11. [Facture Fournisseur & 3-Way Matching — `/supplier-invoices`](#11-facture-fournisseur--3-way-matching--supplier-invoices)

---

## 1. Vue d'ensemble du flux

1. **Créer un BC Fournisseur** (`draft`) avec ses lignes (produit + quantité
   commandée + coût unitaire optionnel).
2. **Confirmer** le BC (`draft → confirmed`) — c'est le geste "envoyé au
   fournisseur". Un BC confirmé devient une cible valide pour une réception.
3. **Réceptionner la marchandise** : créer une `PurchaseReception` en la
   liant au BC via `purchase_order_id` (optionnel — une réception "ad hoc"
   sans BC reste possible, elle n'alimente juste aucun rapprochement).
4. **Valider la réception** (`draft → validated`) : c'est le geste qui monte
   réellement le stock (Tier 1, `stocks.quantity`/`available_quantity`) et
   recalcule le PMP (`stocks.pmp_cost`). En parallèle, si la réception est
   liée à un BC, `purchase_order_lines.received_quantity` est incrémenté
   produit par produit, et le statut du BC est recalculé automatiquement
   (`confirmed` → `partially_received` → `received`).
5. **Un BC peut recevoir plusieurs réceptions** (livraison fournisseur en
   plusieurs fois) — le rapprochement s'accumule à chaque validation.
6. **Annuler une réception validée** (`reverse`) fait l'inverse
   symétriquement : déduit le stock, décrémente `received_quantity`, et
   recalcule le statut du BC.

---

## 2. Permissions

Même convention à trois niveaux que `purchase-receptions` (browse = lecture,
create = mutations brouillon, manage = transitions d'état qui bougent le
stock/PMP) — appliquée dès la création cette fois-ci, pas ajoutée après
coup.

| Permission | Rôles seedés | Donne accès à |
|---|---|---|
| `browse-purchase-orders` | `root`, `admin`, `magasinier` | `GET /purchase-orders`, `GET /purchase-orders/{id}` |
| `create-purchase-orders` | `root`, `admin`, `magasinier` | `POST`, `PUT`, ajout/suppression de ligne |
| `manage-purchase-orders` | `root`, `admin`, `magasinier` | `confirm`, `cancel` |
| `browse-purchase-receptions` | `root`, `admin`, `magasinier` | `GET /purchase-receptions`, `/stats`, `/suppliers`, `/{id}` |
| `create-purchase-receptions` | `root`, `admin`, `magasinier` | `POST`, `PUT`, ajout/suppression de ligne |
| `manage-purchase-receptions` | `root`, `admin`, `magasinier` | `validate`, `cancel`, `reverse` |
| `browse-stock` | (déjà existant) | `GET /stocks*` (consultation temps réel, §7) |

---

## 3. BC Fournisseur — `/purchase-orders`

### 3.1 Lister — `GET /purchase-orders`

**Filtres :** `status`, `supplier_id`, `branch_code`, `search` (matche
`order_number` ou le nom du fournisseur), `per_page`.

```bash
curl "https://api.omni360.cloud/api/backend/purchase-orders?status=confirmed" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` (forme) :**
```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": 12,
        "order_number": "PO-A0001-20260826-0001",
        "supplier_id": 7,
        "branch_code": "A0001",
        "ordered_by": 3,
        "order_date": "2026-08-26",
        "expected_delivery_date": "2026-08-30",
        "status": "confirmed",
        "total_quantity": "50.000",
        "total_amount": "1250.00",
        "confirmed_by": 3,
        "confirmed_at": "2026-08-26T09:15:00.000000Z",
        "supplier": { "id": 7, "name": "Fournisseur X" },
        "branch": { "code": "A0001", "name": "Central A0001" }
      }
    ],
    "per_page": 20, "total": 1, "last_page": 1
  }
}
```

### 3.2 Détail — `GET /purchase-orders/{id}`

Eager-load : `supplier`, `branch`, `orderedBy`, `confirmedBy`,
`lines.product`, `receptions` (toutes les réceptions liées, y compris
draft/annulées — utile pour reconstituer l'historique complet d'un BC).

### 3.3 Créer — `POST /purchase-orders`

```json
{
  "supplier_id": 7,
  "branch_code": "A0001",
  "order_date": "2026-08-26",
  "expected_delivery_date": "2026-08-30",
  "notes": "Commande mensuelle",
  "lines": [
    { "product_id": 42, "ordered_quantity": 30, "unit_cost": 25.0 },
    { "product_id": 55, "ordered_quantity": 20, "unit_cost": 12.5 }
  ]
}
```

`order_date` est optionnel (défaut `now()`). `unit_cost` par ligne est
optionnel — un BC peut être créé sans prix connu à l'avance, purement pour
tracer la quantité commandée. `201` avec le BC + ses lignes en retour.

### 3.4 Modifier — `PUT /purchase-orders/{id}`

**Uniquement en statut `draft`** — sinon `400`. Envoyer `lines` remplace
intégralement les lignes existantes (comme sur `purchase-receptions`).

### 3.5 Lignes — `POST /purchase-orders/{id}/lines`, `DELETE /purchase-orders/{id}/lines/{lineId}`

Même garde `draft`-only. `product_id` unique par BC (contrainte DB
`pol_unique_product_per_order`).

### 3.6 Confirmer — `POST /purchase-orders/{id}/confirm`

Garde : statut `draft` **et** au moins une ligne. `400` sinon (message
explicite du statut courant). Passe à `confirmed`, stampe
`confirmed_by`/`confirmed_at`.

### 3.7 Annuler — `POST /purchase-orders/{id}/cancel`

```json
{ "reason": "Fournisseur en rupture, commande reportée" }
```

Garde : `draft` ou `confirmed` uniquement (pas `partially_received`/
`received`/`cancelled`). `reason` obligatoire, 10-500 caractères — même
convention que `purchase-receptions.cancel`/`.reverse`.

---

## 4. Réception Achat — `/purchase-receptions`

Contrat globalement inchangé depuis avant ce chantier, **sauf** :
`purchase_order_number` (texte libre) est **supprimé**, remplacé par
`purchase_order_id` (nullable — une réception peut toujours exister sans BC).

### 4.1 Créer une réception liée à un BC — `POST /purchase-receptions`

```json
{
  "supplier_id": 7,
  "branch_code": "A0001",
  "purchase_order_id": 12,
  "reception_date": "2026-08-28",
  "supplier_invoice_number": "FACT-2026-0456",
  "lines": [
    { "product_id": 42, "received_quantity": 18, "unit_cost": 25.0 }
  ]
}
```

`purchase_order_id: null` (ou champ omis) → réception ad hoc, comportement
identique à avant. Si renseigné, chaque ligne se voit attribuer
automatiquement son `ordered_quantity` (lu depuis
`purchase_order_lines.ordered_quantity` du même produit) — **côté UI, pas
besoin de l'envoyer**, c'est calculé serveur.

**Response `201` (forme) :**
```json
{
  "success": true,
  "message": "Réception créée avec succès",
  "data": {
    "id": 34,
    "reception_number": "PR-A0001-20260828-0001",
    "purchase_order_id": 12,
    "status": "draft",
    "total_quantity": "18.000",
    "total_amount": "450.00",
    "lines": [
      {
        "id": 61,
        "product_id": 42,
        "ordered_quantity": "30.000",
        "received_quantity": "18.000",
        "accepted_quantity": null,
        "unit_cost": "25.0000",
        "qc_status": "pending"
      }
    ]
  }
}
```

`ordered_quantity: "30.000"` ici permet à l'écran de réception d'afficher
"18 / 30 reçus" — le reliquat (30 - 18 = 12) reste à recevoir sur une
prochaine réception liée au même BC.

### 4.2 Valider — `POST /purchase-receptions/{id}/validate`

Monte le stock Tier 1 (`StockUpdateService::addStock`), recalcule le PMP
(§6), et — nouveau — si `purchase_order_id` n'est pas null, incrémente
`purchase_order_lines.received_quantity` par la quantité réellement
acceptée (`accepted_quantity ?? received_quantity`) puis rafraîchit le
statut du BC.

### 4.3 Annuler une validée — `POST /purchase-receptions/{id}/reverse`

Symétrique de `validate` : déduit le stock, **décrémente**
`received_quantity` sur le BC lié, rafraîchit son statut (ex: un BC
`received` redevient `partially_received` ou `confirmed` selon ce qui
reste).

### 4.4 Autres endpoints (inchangés)

`GET /purchase-receptions`, `GET /{id}`, `PUT /{id}`, `POST/DELETE
.../lines`, `POST .../cancel` (draft-only, pas de reversal stock), `GET
/stats`, `GET /suppliers`, `GET /suppliers/{id}/products`.

---

## 5. Rapprochement Commandé vs Reçu

Deux champs sur `purchase_order_lines`, jamais écrits directement par un
contrôleur — uniquement dérivés par `PurchaseReceptionService` :

| Champ | Écrit par |
|---|---|
| `ordered_quantity` | Fixé une fois à la création/modif du BC |
| `received_quantity` | Incrémenté à chaque `validate()`, décrémenté à chaque `reverse()` d'une réception liée |

`getRemainingQuantityAttribute()` (`remaining_quantity` côté modèle, pas
exposé nommément dans le JSON aujourd'hui — à calculer côté UI comme
`ordered_quantity - received_quantity` si besoin, ou demander l'ajout de
l'accessor au payload si un écran en a besoin).

Statut du BC — recalculé automatiquement (`PurchaseOrder::refreshReceivedStatus()`,
appelé après chaque validate/reverse, seulement si le BC est actuellement
`confirmed` ou `partially_received` — ne touche jamais un `draft`/`cancelled`) :

| Condition sur les lignes | Statut résultant |
|---|---|
| Aucune ligne avec `received_quantity > 0` | `confirmed` (inchangé) |
| Au moins une ligne reçue, pas toutes complètes | `partially_received` |
| Toutes les lignes `received_quantity >= ordered_quantity` | `received` |

Le sur-réceptionnement (recevoir plus que commandé sur une ligne) est
**autorisé**, pas bloqué — c'est une décision métier/QC, pas une contrainte
technique. `isFullyReceived()` sur `PurchaseOrderLine` utilise `>=`, pas `=`.

---

## 6. PMP (Prix Moyen Pondéré)

Inchangé par ce chantier — rappel pour le contexte Achats :
`stocks.pmp_cost` est recalculé à chaque `validate()` d'une réception
(`StockUpdateService`) : `(quantité_avant × pmp_avant + quantité_reçue ×
unit_cost) / (quantité_avant + quantité_reçue)`. Lu par
`GcomMarginGuard` pour bloquer la vente à perte. Pas de FIFO/coût par lot —
décision produit assumée (suffisant pour GCOM, cf. audit).

---

## 7. Consultation Stock temps réel (Tier 1)

Ces endpoints existaient déjà, indépendants du chantier Achats — rappelés
ici car c'est la source à utiliser pour l'écran "stock disponible" (pas
`/wms/stock-levels`, gaté Tier 2/3, voir [22-stock-wms.md](22-stock-wms.md)).

| Endpoint | Description |
|---|---|
| `GET /stocks` | Liste paginée, filtres `product_id`, `branch_id`, `warehouse_code`, `location_type` |
| `GET /stocks/summary` | KPIs agrégés : `total_quantity`, `total_reserved`, `total_available`, `distinct_products`, `estimated_value` |
| `GET /stocks/low-stock` | Lignes où `available_quantity < minimum_quantity` |
| `GET /stocks/scan/{barcode}` | Résout un code-barres → produit + toutes ses localisations avec stock `> 0` (scanner PDA) |
| `GET /stocks/{product_id}` | Toutes les lignes stock d'un produit (tous entrepôts/emplacements) |
| `GET /stocks/location/{location_code}` | Stock d'un emplacement |
| `GET /stocks/branch/{branch_code}` | Stock d'une branche |

Champs clés d'une ligne `Stock` : `quantity` (physique), `reserved_quantity`
(réservé — commandes non livrées), `available_quantity` (= quantity -
reserved, ce qui est réellement vendable), `minimum_quantity`/
`maximum_quantity` (seuils réappro), `pmp_cost` (§6).

---

## 8. TypeScript Interfaces

```typescript
type PurchaseOrderStatus = 'draft' | 'confirmed' | 'partially_received' | 'received' | 'cancelled';
type PurchaseReceptionStatus = 'draft' | 'validated' | 'synced_to_erp' | 'cancelled';
type QcStatus = 'pending' | 'passed' | 'failed' | 'stock_added';

interface PurchaseOrder {
  id: number;
  order_number: string;               // PO-{branch}-{Ymd}-{seq}
  supplier_id: number;
  branch_code: string;
  ordered_by: number;
  order_date: string;                 // date
  expected_delivery_date: string | null;
  status: PurchaseOrderStatus;
  total_quantity: string;             // decimal:3 as string
  total_amount: string;               // decimal:2 as string
  confirmed_by: number | null;
  confirmed_at: string | null;        // ISO datetime
  notes: string | null;
  supplier?: { id: number; name: string };
  branch?: { code: string; name: string };
  lines?: PurchaseOrderLine[];
  receptions?: PurchaseReception[];
}

interface PurchaseOrderLine {
  id: number;
  purchase_order_id: number;
  product_id: number;
  ordered_quantity: string;
  received_quantity: string;          // accumulates across every validated reception
  unit_cost: string | null;
  product?: { id: number; name: string; code: string };
}

interface PurchaseReception {
  id: number;
  reception_number: string;           // PR-{branch}-{Ymd}-{seq}
  supplier_id: number;
  branch_code: string;
  purchase_order_id: number | null;   // was purchase_order_number (free text) — removed
  received_by: number;
  supplier_invoice_number: string | null;
  reception_date: string;
  status: PurchaseReceptionStatus;
  total_quantity: string;
  total_amount: string;
  lines: PurchaseReceptionLine[];
  supplier?: { id: number; name: string };
  purchaseOrder?: PurchaseOrder;
}

interface PurchaseReceptionLine {
  id: number;
  purchase_reception_id: number;
  product_id: number;
  ordered_quantity: string | null;    // null when not linked to a PO
  received_quantity: string;
  accepted_quantity: string | null;
  rejected_quantity: string;
  unit_cost: string;
  lot_number: string | null;
  batch_number: string | null;
  expiration_date: string | null;
  qc_status: QcStatus;
  product?: { id: number; name: string; code: string };
}

interface Stock {
  id: number;
  product_id: number;
  warehouse_code: string;
  branch_id: number;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  minimum_quantity: string | null;
  maximum_quantity: string | null;
  pmp_cost: string | null;
  product?: { id: number; name: string; code: string; barcode: string | null };
}
```

---

## 9. Statut du déploiement / ce qui reste à faire

- **Code mergé sur `gcom`** (`0d643c68`), migrations écrites et testées en
  syntaxe localement, **pas encore jouées sur staging** au moment de la
  rédaction de ce doc — le déploiement (migrate + reseed permissions +
  restart du worker Octane) est à la charge de l'infra, pas automatisé
  depuis cette session. Si un appel `POST /purchase-orders` renvoie `404`
  ou `500` de type "table not found", c'est que le déploiement staging
  n'a pas encore eu lieu — vérifier avant d'ouvrir un ticket bug.
- **Alignement `/wms/receipts` — fait pour les entrepôts CENTRAL (2026-08-26)** :
  une réception via `POST /wms/receipts` sur un entrepôt CENTRAL monte
  désormais le stock Tier 1 + le PMP via le même
  `StockUpdateService::addStock()` que `PurchaseReceptionService` — voir
  [22-stock-wms.md](22-stock-wms.md) §4. **Reste volontairement hors
  scope : les entrepôts VAN** (retour de tournée) — leur ligne Tier 1 est
  indexée différemment (`warehouse_code`, pas `branch_id`), router par
  `addStock()` aurait crédité le mauvais entrepôt. Une réception VAN garde
  le comportement bin-only d'avant.
- **Toujours pas fait** : `/wms/receipts` ne participe pas au rapprochement
  BC ⇄ Reçu décrit en §5 (pas de `purchase_order_id` sur cet endpoint) —
  seul `/purchase-receptions/{id}/validate` l'alimente. Ce n'était pas dans
  le périmètre de l'alignement Tier 1/PMP ci-dessus ; à revisiter séparément
  si un écran a besoin qu'une réception WMS directe compte aussi contre un
  BC Fournisseur.
- **Pas de champ `remaining_quantity` exposé dans le JSON** — calculable
  côté UI (`ordered_quantity - received_quantity`), voir §5. Signalez si un
  écran a besoin qu'il soit ajouté au payload plutôt que recalculé côté
  client.

---

## 10. Testing

| File | Covers |
|---|---|
| `tests/Feature/Warehouse/PurchaseReceptionPermissionsTest.php` | Les 3 permissions `purchase-receptions` — bystander 403, create-only ne peut pas valider, full-access peut créer + valider |
| `tests/Feature/Warehouse/PurchaseOrderPermissionsTest.php` | Les 3 permissions `purchase-orders` — même structure |
| `tests/Feature/Warehouse/PurchaseOrderReceptionReconciliationTest.php` | Rapprochement §5 de bout en bout — deux réceptions successives contre le même BC amènent `partially_received` puis `received` ; `reverse()` d'une réception validée redescend `received_quantity` et repasse le BC à `confirmed` |
| `tests/Feature/Warehouse/PurchaseReceptionValidationTest.php` | PMP (§6) — première réception adopte son coût comme PMP, une deuxième à coût différent fait la moyenne pondérée correcte |
| `tests/Feature/Warehouse/WmsReceiptTier1AlignmentTest.php` | `/wms/receipts` (2026-08-26) — un entrepôt CENTRAL monte le Tier 1 + PMP, un entrepôt VAN ne touche pas l'agrégat central de la branche |
| `tests/Feature/Warehouse/SupplierInvoiceMatchingTest.php` | §11 3-way matching — dans la tolérance = `matched` + `invoiced_quantity` bouge à l'approbation ; hors tolérance = `discrepancy`, approbation bloquée sans `override-purchase-matching-tolerance` ; override approuve et réconcilie ; annulation d'une facture approuvée redescend `invoiced_quantity` ; facturer sans rien reçu = discrepancy à 100% |
| `tests/Feature/Warehouse/SupplierInvoicePermissionsTest.php` | §11 — les 4 permissions `supplier-invoices`, y compris le cas manage-sans-override bloqué sur une discrepancy |

---

## 11. Facture Fournisseur & 3-Way Matching — `/supplier-invoices`

Ferme le triangle **Commandé ⇄ Reçu ⇄ Facturé**. Ancré sur
`purchase_order_lines` (pas directement sur une réception) — `received_quantity`
s'accumule déjà sur toutes les réceptions validées contre une ligne de BC,
donc une seule facture peut consolider plusieurs livraisons (facturation
mensuelle groupée, cas réel courant). Une ligne peut aussi pointer une
`purchase_reception_line_id` précise pour un rapprochement plus fin
(facture = exactement cette livraison).

`purchase_receptions.supplier_invoice_number` (texte libre) **reste actif**
en parallèle — dépréciation douce, nettoyage prévu dans une migration
ultérieure une fois ce module stabilisé, pas de suppression immédiate.

### 11.1 Statuts

Pas d'état `draft` — le matching tourne systématiquement à la création/
modification d'une facture, donc une facture persistée est toujours déjà
`pending_review` ou `matched` :

| Statut | Signification |
|---|---|
| `pending_review` | Au moins une ligne en écart hors tolérance (`has_discrepancy: true`) |
| `matched` | Toutes les lignes liées à un BC sont dans la tolérance |
| `approved` | Approuvée — **point de bascule** : `purchase_order_lines.invoiced_quantity` s'incrémente ici, pas avant (même logique que `PurchaseReceptionService::validate()`) |
| `cancelled` | Si la facture était `approved`, `invoiced_quantity` est décrémenté symétriquement |

### 11.2 Permissions

| Permission | Rôles | Donne accès à |
|---|---|---|
| `browse-supplier-invoices` | `root`, `admin`, `magasinier`, `comptable` | Lecture |
| `create-supplier-invoices` | `root`, `admin`, `magasinier`, `comptable` | Création/modification de brouillon (magasinier peut saisir depuis une réception) |
| `manage-supplier-invoices` | `root`, `admin`, `comptable` | `approve`, `cancel` — séparation des tâches : la saisie n'est pas l'approbation |
| `override-purchase-matching-tolerance` | `root`, `admin`, `comptable` | Approuver une facture avec au moins une ligne en `discrepancy` — sans cette permission, `approve` renvoie `400` même avec `manage-supplier-invoices` |

> `comptable` est un rôle neuf, créé par ce chantier (aucun utilisateur
> assigné par défaut) — à attribuer manuellement aux profils comptabilité
> concernés après déploiement.

### 11.3 Créer une facture — `POST /supplier-invoices`

```json
{
  "supplier_id": 7,
  "branch_code": "A0001",
  "supplier_invoice_reference": "FACT-2026-0456",
  "invoice_date": "2026-08-28",
  "lines": [
    { "purchase_order_line_id": 12, "product_id": 42, "invoiced_quantity": 18, "unit_cost": 25.0, "tax_percent": 20 }
  ]
}
```

Le matching tourne immédiatement (pas d'étape séparée) : chaque ligne reçoit
`quantity_variance_percent`, `price_variance_percent` et `match_status`, et
le statut de la facture se déduit de l'état de ses lignes.

**Response `201` (forme) :**
```json
{
  "success": true,
  "message": "Facture fournisseur créée avec succès",
  "data": {
    "id": 5,
    "invoice_number": "SI-A0001-20260828-0001",
    "status": "matched",
    "has_discrepancy": false,
    "subtotal": "450.00",
    "total_amount": "540.00",
    "lines": [
      {
        "id": 9,
        "purchase_order_line_id": 12,
        "invoiced_quantity": "18.000",
        "unit_cost": "25.0000",
        "quantity_variance_percent": "0.00",
        "price_variance_percent": "0.00",
        "match_status": "matched"
      }
    ]
  }
}
```

### 11.4 Approuver — `POST /supplier-invoices/{id}/approve`

Sans corps. `400` si une ligne est en `discrepancy` et que l'appelant n'a
pas `override-purchase-matching-tolerance` (message explicite, pas
d'approbation partielle — c'est tout ou rien).

### 11.5 Annuler — `POST /supplier-invoices/{id}/cancel`

```json
{ "reason": "Erreur de facturation fournisseur — quantité incorrecte" }
```

`reason` obligatoire (10-500 caractères, même convention que
`purchase-receptions`/`purchase-orders`). Si la facture était `approved`,
`invoiced_quantity` redescend sur chaque ligne de BC concernée.

### 11.6 Tolérances (paramétrables)

Même pattern que `gcom.max_discount_percent` — `ParameterService::getFloat()`,
pas de ligne DB nécessaire, résolution Partner → User → AccessProfile →
Rôle → Branche → Société → défaut :

| Clé | Défaut | Usage |
|---|---|---|
| `gcom.purchase_matching_quantity_tolerance_percent` | 2.0 | Écart `\|facturé − reçu\| / reçu` |
| `gcom.purchase_matching_price_tolerance_percent` | 3.0 | Écart `\|coût facturé − coût BC\| / coût BC` |

Facturer une quantité non nulle contre une ligne **jamais reçue** (`reçu = 0`)
est traité comme un écart de 100% — cas volontairement non silencieux,
c'est exactement ce que le 3-way matching existe pour intercepter. Une
ligne de BC sans `unit_cost` renseigné (prix pas encore connu à la commande)
ne bloque pas le matching sur le prix — l'écart prix est simplement ignoré
faute de référence.

### 11.7 TypeScript

```typescript
type SupplierInvoiceStatus = 'pending_review' | 'matched' | 'approved' | 'cancelled';
type MatchStatus = 'matched' | 'discrepancy' | 'unmatched';

interface SupplierInvoice {
  id: number;
  invoice_number: string;              // SI-{branch}-{Ymd}-{seq}
  supplier_invoice_reference: string | null;
  supplier_id: number;
  branch_code: string;
  invoice_date: string;
  due_date: string | null;
  status: SupplierInvoiceStatus;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  has_discrepancy: boolean;
  created_by: number;
  approved_by: number | null;
  approved_at: string | null;
  lines: SupplierInvoiceLine[];
  supplier?: { id: number; name: string };
}

interface SupplierInvoiceLine {
  id: number;
  supplier_invoice_id: number;
  purchase_order_line_id: number | null;
  purchase_reception_line_id: number | null;
  product_id: number;
  invoiced_quantity: string;
  unit_cost: string;
  tax_percent: string | null;
  line_total: string;
  quantity_variance_percent: string | null;
  price_variance_percent: string | null;
  match_status: MatchStatus;
  product?: { id: number; name: string; code: string };
}
```