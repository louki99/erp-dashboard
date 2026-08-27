# Module 30 — Achats (BC Fournisseur → Réception → Facture → Règlement → Stock)

> **Audience:** Frontend developers (ERP Webapp) — écrans Achats : Commande
> Fournisseur, Réception de Marchandise, Facture Fournisseur (3-way
> matching), Règlements Fournisseurs & Relevé de Compte, Consultation Stock.
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>` — permissions listées en §2.
> **Statut:** BC Fournisseur/Réception/Stock (§1-9), Facture Fournisseur/
> 3-way matching (§11), numérotation TokenSerie (§3.9) et PDF (§3.10/§4.6/
> §11.6bis) déployés et vérifiés en staging (dernier commit vérifié
> `f78e71e1`). Règlements Fournisseurs & Lettrage Achat (§12) sont neufs,
> construits le 2026-08-26 — **migrations pas encore jouées sur staging au
> moment de la rédaction**, exemples JSON de cette section construits à
> partir des modèles/contrôleurs réels, pas des captures live.

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
12. [Règlements Fournisseurs & Lettrage Achat — `/supplier-payments`](#12-règlements-fournisseurs--lettrage-achat--supplier-payments)

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
        "order_number": "BCFA001-A01-000012",
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

> ⚠️ **Changement 2026-08-26 (breaking) : `branch_code` n'est plus accepté
> dans le body.** Faille cross-tenant réelle trouvée en revue production :
> un `branch_code` fourni par le client n'était vérifié que pour son
> existence, pas son appartenance à la société de l'utilisateur — une BC
> pouvait être créée contre la branche d'une AUTRE société. La branche est
> désormais **toujours dérivée côté serveur** de l'utilisateur authentifié
> (même mécanisme que `GcomOrderService` pour BC/BL/Facture GCOM), sans
> exception pour aucun rôle. Envoyer `branch_code` ne fait plus rien
> (silencieusement ignoré par la validation) — retirez-le du payload.

```json
{
  "supplier_id": 7,
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

### 3.8 Sélecteur fournisseur — `GET /purchase-orders/suppliers`

**Ajouté le 2026-08-26** — c'est LE bon endpoint pour le champ "Fournisseur"
de l'écran Nouveau BC Fournisseur. Ne pas utiliser `GET /partners` (ce sont
les clients, pas les fournisseurs — un vrai bug observé côté UI le
2026-08-26, l'onglet Réseau montrait `partners?per_page=20` appelé depuis
cet écran) ni `GET /suppliers` ou `GET /master-data/suppliers` (existent
mais gatés `manage-products`/`manage-master-data` — root/admin uniquement,
un magasinier qui crée un BC n'a pas forcément ces permissions). Celui-ci
est gated `browse-purchase-orders` (root/admin/magasinier), cohérent avec
qui peut réellement créer un BC.

```bash
curl "https://api.omni360.cloud/api/backend/purchase-orders/suppliers" \
  -H "Authorization: Bearer {TOKEN}"
```

**Response `200` :**
```json
{
  "success": true,
  "data": [
    { "id": 7, "name": "Fournisseur X", "contact_name": "M. Alaoui", "phone": "0600000000" }
  ]
}
```

### 3.9 Numérotation officielle (TokenSerie)

**Changement le 2026-08-26** — `order_number` (et `reception_number`,
`invoice_number` en §4/§11) ne sont plus générés par une séquence maison
par branche/jour ; ils sont tirés du même mécanisme officiel que tous les
documents GCOM (`DocumentNumberingService`, table `token_series`), avec
verrouillage de ligne et registre d'unicité (`document_numbers`) —
supprime un vrai risque de collision qui existait dans la version
précédente (deux réceptions simultanées sur la même branche pouvaient
théoriquement tirer le même numéro).

| Document | Code | Format | Colonnes `token_series` |
|---|---|---|---|
| BC Fournisseur | `BCF` | `BCF{code}-{seq}` | `bcf_prefix` / `bcf_next_number` |
| Bon de Réception | `BRC` | `BRC{code}-{seq}` | `brc_prefix` / `brc_next_number` |
| Facture Fournisseur | `FACF` | `FACF{code}-{seq}` | `facf_prefix` / `facf_next_number` |

> ⚠️ **`BRC`, pas `BR`** — `BR` est déjà le code GCOM du Bon de Retour
> (`return_prefix`/`return_next_number`). Piège identifié avant
> implémentation, voir le commit de la migration
> `2026_08_26_120000_add_achats_prefixes_to_token_series_table` pour le
> détail.

Ancien format (avant ce commit, à ne plus attendre) : `PO-{branch}-{Ymd}-{seq}`,
`PR-{branch}-{Ymd}-{seq}`, `SI-{branch}-{Ymd}-{seq}`.

### 3.10 PDF — `GET /purchase-orders/{id}/pdf`

```bash
curl "https://api.omni360.cloud/api/backend/purchase-orders/{id}/pdf?download=1" \
  -H "Authorization: Bearer {TOKEN}"
```

Retourne le PDF binaire (`Content-Type: application/pdf`). `download=1`
force `Content-Disposition: attachment` (sinon `inline`). Même pipeline
Document Studio que tous les autres documents (cache MinIO, invalidation
via `scheduleRegeneration`) — gated `browse-purchase-orders`.

---

## 4. Réception Achat — `/purchase-receptions`

Contrat globalement inchangé depuis avant ce chantier, **sauf** :
`purchase_order_number` (texte libre) est **supprimé**, remplacé par
`purchase_order_id` (nullable — une réception peut toujours exister sans BC).

### 4.1 Créer une réception liée à un BC — `POST /purchase-receptions`

> ⚠️ Même changement 2026-08-26 que §3.3 — `branch_code` n'est plus
> accepté, toujours dérivé côté serveur. `purchase_order_id` est
> maintenant vérifié pour appartenir à la société de l'acteur (`422` sinon
> — pas seulement son existence).

```json
{
  "supplier_id": 7,
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
    "reception_number": "BRCA001-A01-000034",
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

### 4.5 Numérotation — `BRC`, pas `BR`

Voir §3.9 — `reception_number` est désormais tiré de TokenSerie (code
`BRC`, format `BRC{code}-{seq}`), plus l'ancien `PR-{branch}-{Ymd}-{seq}`.

### 4.6 PDF — `GET /purchase-receptions/{id}/pdf`

Bon de Réception, pour émargement magasinier / contrôle à quai à l'arrivée
du camion. Même contrat que §3.10 (`download=1`, gated
`browse-purchase-receptions`).

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
  order_number: string;               // {bcf_prefix}-{padded seq} — drawn from TokenSerie (code 'BCF'), see §3.9
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
  reception_number: string;           // {brc_prefix}-{padded seq} — TokenSerie code 'BRC' (not 'BR', see §3.9)
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
| `tests/Feature/Warehouse/AchatsTokenSerieNumberingTest.php` | §3.9 — `order_number`/`reception_number`/`invoice_number` tirés des séries `BCF`/`BRC`/`FACF`, compteurs indépendants entre eux et des séries GCOM existantes (`BC`/`BR` sur la même ligne `token_series` restent à `1`) |

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

> ⚠️ Même changement 2026-08-26 que §3.3 — `branch_code` n'est plus
> accepté. `purchase_order_line_id`/`purchase_reception_line_id` sont
> vérifiés pour appartenir à une commande/réception de la société de
> l'acteur (`422` sinon).

```json
{
  "supplier_id": 7,
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
    "invoice_number": "FACFA001-A01-000005",
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

### 11.3bis Numérotation — `FACF`

Voir §3.9 — `invoice_number` tiré de TokenSerie (code `FACF`), plus l'ancien
`SI-{branch}-{Ymd}-{seq}`.

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

### 11.6bis PDF — `GET /supplier-invoices/{id}/pdf`

Récapitulatif du rapprochement 3-way matching — montre chaque ligne avec
Commandé/Reçu/Facturé, les écarts %, et le statut de matching. Utile aussi
bien pour une facture `pending_review` (donner au comptable de quoi
statuer sur l'écart) qu'`approved` (preuve archivable du rapprochement).
Même contrat que §3.10, gated `browse-supplier-invoices`.

### 11.7 TypeScript

```typescript
type SupplierInvoiceStatus = 'pending_review' | 'matched' | 'approved' | 'cancelled';
type MatchStatus = 'matched' | 'discrepancy' | 'unmatched';

type SupplierInvoicePaymentStatus = 'unpaid' | 'partially_paid' | 'paid';

interface SupplierInvoice {
  id: number;
  invoice_number: string;              // {facf_prefix}-{padded seq} — TokenSerie code 'FACF'
  supplier_invoice_reference: string | null;
  supplier_id: number;
  branch_code: string;
  invoice_date: string;
  due_date: string | null;
  status: SupplierInvoiceStatus;
  subtotal: string;
  tax_amount: string;
  total_amount: string;
  // Added 2026-08-26 alongside §12 (Règlements Fournisseurs) — missing
  // from this interface until now, a real doc gap (the fields were live
  // in the API the whole time; only this TypeScript block was stale).
  // remaining_amount/payment_status only mean something once the invoice
  // is `approved` — see §12.1's canBeLettered() note. Before that,
  // remaining_amount is "0.00" (not yet initialized) — don't treat that
  // as "fully paid".
  paid_amount: string;
  remaining_amount: string;
  payment_status: SupplierInvoicePaymentStatus;
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

---

## 12. Règlements Fournisseurs & Lettrage Achat — `/supplier-payments`

**Neuf le 2026-08-26**, ferme le cycle Achats complet (BC → Réception →
Facture → **Règlement**). Mirror du système règlement/lettrage côté ventes
(`PaymentTransfer`/`Lettering`), construit correct dès le départ sur les
deux points qui avaient nécessité un vrai correctif côté ventes : la somme
agrégée des imputations est validée **avant** toute écriture ligne par
ligne, et `remaining_amount` n'est **jamais tronqué** — un règlement qui
dépasse la facture laisse un vrai acompte/avance chez le fournisseur,
lisible, pas silencieusement perdu.

> ⚠️ **Convention de signe — inversée par rapport au relevé client.**
> `credit` = Facturé (une `SupplierInvoice` augmente ce qu'on doit),
> `debit` = Réglé (un décaissement le réduit). `current_balance` =
> `credit - debit` = ce qu'on doit encore au fournisseur. Ne pas copier le
> mapping du relevé client (où facture = débit, paiement = crédit) — c'est
> volontairement inversé, cf. terminologie métier demandée.

### 12.1 Décaissement — `POST /supplier-payments`

> ⚠️ Même changement 2026-08-26 que §3.3 — `branch_code` n'est plus
> accepté.

```json
{
  "supplier_id": 7,
  "amount": 1000.0,
  "payment_method_id": 3,
  "allocations": [
    { "supplier_invoice_id": 5, "amount": 325.0 }
  ]
}
```

`allocations` omis → lettrage automatique sur les factures `approved` les
plus anciennes du fournisseur (`auto_letter`, défaut `true`) ; passer
`"auto_letter": false` sans `allocations` enregistre un décaissement sans
imputation (avance pure). Une facture doit être **`approved`** (cf. §11)
pour être lettrable — `pending_review`/`cancelled` sont rejetées.

`code` tiré de TokenSerie (`DECF`, même mécanisme que §3.9). Chèque/effet
(`payment_method_id` résolvant sur `CHEQUE`/`EFFET`) exige
`instrument_reference` + `maturity_date` ; cycle de vie volontairement
minimal (`issued` → `cleared`/`rejected`, pas de remise bancaire complète —
décision de scope 2026-08-26).

### 12.2 Trésorerie

Chaque décaissement débite immédiatement la caisse (`TYPE_USER_CAISSE`) de
l'utilisateur qui l'enregistre — même mécanisme `treasury_intake_lines`
que les encaissements côté ventes, avec une ligne de montant **négatif**
et un `operation_type` d'audit dédié (`SUPPLIER_PAYMENT_OUTFLOW`), pas de
nouvelle table. Aucune caisse assignée pour la méthode → `422`
(`NoCaisseAssignedException`, même comportement que côté ventes).

### 12.1bis Lister / détail — `GET /supplier-payments`, `GET /supplier-payments/{id}`

**Absents de la rédaction initiale de ce paragraphe — un vrai trou de doc,
pas un manque côté API : ces deux endpoints existent et sont déployés
depuis le même commit que §12.1 (`5c5176ee`).**

```bash
curl "https://api.omni360.cloud/api/backend/supplier-payments?supplier_id=7&status=validated" \
  -H "Authorization: Bearer {TOKEN}"
```

Filtres : `supplier_id`, `status` (`validated`/`reconciled`/`cancelled`),
`branch_code`, `per_page`. Triés par `payment_date` décroissant.
`GET /supplier-payments/{id}` charge en plus `letterings.supplierInvoice`
— nécessaire pour retrouver les imputations d'un décaissement passé avant
d'appeler `letter`/`unletter` dessus (§12.3).

### 12.3 Lettrage explicite / annulation

- `POST /supplier-payments/{id}/letter` — imputer un décaissement déjà
  enregistré (allocations explicites).
- `POST /supplier-payments/letterings/{id}/unletter` — retire une
  imputation, restaure `paid_amount`/`remaining_amount` sur la facture et
  `reconciled_amount`/`remaining_amount`/`status` sur le décaissement.
  Body : `{ "reason": "..." }` (10-500 caractères, obligatoire).
- `POST /supplier-payments/{id}/cancel` — annule tout le décaissement :
  délettre chaque imputation, **puis** reverse la sortie de trésorerie
  (écriture de compensation positive, jamais un simple second débit).
  Body : `{ "reason": "..." }` (10-500 caractères, obligatoire — même
  convention que `purchase-orders`/`purchase-receptions`/`supplier-invoices`
  cancel ; manquait par erreur dans cette section jusqu'ici, cf.
  `SupplierPaymentController::cancel()`).

### 12.4 Relevé de Compte — `GET /supplier-payments/suppliers/{id}/{statement,ledger}`

```bash
curl "https://api.omni360.cloud/api/backend/supplier-payments/suppliers/7/statement" \
  -H "Authorization: Bearer {TOKEN}"
```
```json
{
  "success": true,
  "data": {
    "supplier_id": 7,
    "supplier_name": "Fournisseur X",
    "total_credit": 5400.0,
    "total_debit": 3200.0,
    "current_balance": 2200.0
  }
}
```

`GET .../ledger?from=&to=` renvoie le grand livre chronologique (mêmes
entrées que le statement, détaillées + solde courant). `GET
/supplier-payments/suppliers/statements` liste tous les fournisseurs avec
solde (revue de fin de mois), filtrable par `min_balance`.

> Chemin délibérément pas sous `/suppliers/{id}/...` — `Route::apiResource('suppliers', ...)`
> existe déjà sans préfixe (CRUD master-data) et aurait intercepté
> `/suppliers/statements` comme `show($supplier="statements")` selon
> l'ordre d'enregistrement des routes. Imbriqué sous `supplier-payments/`
> pour éviter la collision.

### 12.5 Permissions

| Permission | Rôles | Donne accès à |
|---|---|---|
| `browse-supplier-payments` | `root`, `admin`, `comptable` | Liste, détail, relevé, grand livre |
| `create-supplier-payments` | `root`, `admin`, `comptable` | Enregistrer un décaissement |
| `manage-supplier-payments` | `root`, `admin`, `comptable` | Lettrage explicite, délettrage, annulation |

Contrairement aux factures fournisseurs (§11.2, `magasinier` a
browse/create), **aucun accès `magasinier`** ici — un décaissement est
strictement comptabilité/admin, pas une saisie liée à la réception
physique.

### 12.6 Ce qui reste hors scope (2026-08-26)

- **Retours Fournisseurs & Avoirs d'Achat** — sortie de stock + note de
  crédit liée au lettrage, mentionné par l'équipe UI mais volontairement
  reporté à une passe séparée (mirror du module Retours Clients existant).
- **PDF "Reçu de Décaissement"** — pas construit dans cette passe (contrairement
  aux 3 PDF Achats de §3.10/§4.6/§11.6bis) ; peut suivre le même pattern
  Document Studio si besoin.
- **Cycle bancaire complet chèque/effet** — remise en banque, compensation
  — décision de scope explicite (§12.1), peut évoluer vers le modèle
  `FinancialInstrument` complet côté ventes si le besoin se confirme.

### 12.7 Testing

| File | Covers |
|---|---|
| `tests/Feature/Warehouse/SupplierPaymentLetteringTest.php` | Règlement exact = `reconciled`/`remaining_amount` à 0 des deux côtés ; sur-paiement = imputation partielle, `remaining_amount` jamais tronqué (même classe de bug corrigée côté ventes cette session) ; annulation délettre + restaure la facture + reverse la sortie de trésorerie (pas un second débit) |
