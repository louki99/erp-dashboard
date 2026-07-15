# Module 22 — Stock & WMS (Tier 2/3 API Contract)

> **Audience:** Frontend developers (ERP Webapp) — écrans Gestion de Stock, Pick & Pack, Alertes Péremption, Réception, Transfert, Ajustement
> **Base URL:** `https://api.omni360.cloud/api/backend`
> **Auth:** `Authorization: Bearer <token>` — permissions `browse-wms` (lecture), `complete-pick-tasks`, `manage-stock-batches`, `create-stock-receipts`, `create-stock-transfers`, `adjust-stock`
> **Statut:** contrat capturé sur des réponses réelles (staging, 2026-07-15) — Deep Review avant `db:fresh`, complété le même jour avec les flux d'entrée/mouvement (§4-6)

Contexte : ce document ferme la revue "Deep Review" du domaine Stock/WMS avant
le reset complet de la base. Il couvre les 6 groupes d'endpoints du Workspace
Magasinier (stock-levels, pick-tasks, batches/expiry, réceptions, transferts,
ajustements) et documente les correctifs apportés à la désynchronisation de
stock — dont un bug de contrainte d'unicité découvert en construisant les
captures de ce complément (§7.5).

Ces endpoints sont **Tier 2/3** — ils n'ont d'effet que si les paramètres
`wms.advanced_mode`, `wms.emplacements_enabled` et `wms.lot_tracking` sont
activés (désactivés par défaut). Voir §8 pour le détail du gating. Pour le
Tier 1 (stock agrégat par entrepôt, sans bins/lots), voir
[03-stock-management.md](03-stock-management.md). Pour le design complet
Tier 2/3 (PutAwayEngine, PickTaskEngine, capacité, FEFO), voir
[13-wms-logistics.md](13-wms-logistics.md).

---

## Table of Contents

1. [Matrice de stock — `GET /wms/stock-levels`](#1-matrice-de-stock--get-wmsstock-levels)
2. [Tâches de collecte — `GET /wms/pick-tasks` & `POST .../complete`](#2-tâches-de-collecte--get-wmspick-tasks--post-completepick-taskidcomplete)
3. [Alertes péremption — `GET /wms/batches/expiry` & bulk block/unblock](#3-alertes-péremption--get-wmsbatchesexpiry--bulk-blockunblock)
4. [Réception & Entrée de Stock — `POST /wms/receipts`](#4-réception--entrée-de-stock--post-wmsreceipts)
5. [Bon de Transfert — `POST /wms/transfers`](#5-bon-de-transfert--post-wmstransfers)
6. [Ajustement Manuel — `POST /wms/adjustments`](#6-ajustement-manuel--post-wmsadjustments)
7. [Deep Review — points de vigilance validés](#7-deep-review--points-de-vigilance-validés)
8. [Gating (paramètres wms.*)](#8-gating-paramètres-wms)
9. [TypeScript Interfaces](#9-typescript-interfaces)

---

## 1. Matrice de stock — `GET /wms/stock-levels`

Stock physique / réservé / disponible à la vente, par (entrepôt ×
emplacement × produit). Alimente l'écran gestionnaire de stock.

**Filtres :** `warehouse_id`, `storage_location_id`, `product_id`,
`branch_id`, `low_stock_only` (booléen — `available_quantity < minimum_quantity`).
**Tri :** entrepôt (code) → emplacement → produit, pour un rendu groupé sans
re-tri côté UI.

```bash
curl "https://api.omni360.cloud/api/backend/wms/stock-levels?warehouse_id=1" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle :**
```json
{
  "success": true,
  "data": {
    "current_page": 1,
    "data": [
      {
        "id": 8,
        "product_id": 1,
        "quantity": "500.000",
        "reserved_quantity": "120.000",
        "available_quantity": "380.000",
        "minimum_quantity": "50.000",
        "maximum_quantity": null,
        "warehouse_code": "A0001",
        "branch_id": 1,
        "storage_location_id": 1,
        "product": { "id": 1, "name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG", "code": "PSCE0200591", "barcode": null },
        "warehouse": { "code": "A0001", "name": "Central A0001", "type": "central", "branch_code": "A0001" },
        "storage_location": { "id": 1, "location_code": "A0001-DEPOT-MAIN", "location_name": "Dépôt Principal – A0001", "location_type": "DEPOT" }
      },
      {
        "id": 9,
        "product_id": 2,
        "quantity": "30.000",
        "reserved_quantity": "5.000",
        "available_quantity": "25.000",
        "minimum_quantity": "40.000",
        "warehouse_code": "A0001",
        "storage_location_id": 2,
        "product": { "id": 2, "name": "BURGER DE VOLAILLE SAC 1KG", "code": "BURV1KG" },
        "storage_location": { "id": 2, "location_code": "A0001-PFZ0", "location_name": "Zone Produit Fini – A0001", "location_type": "SELLABLE" }
      }
    ],
    "per_page": 30, "total": 2, "last_page": 1
  }
}
```

> `storage_location: null` signifie une ligne **agrégat entrepôt** (Tier 1,
> `storage_location_id IS NULL`) — normal et attendu tant que le Tier 2 n'est
> pas actif sur cet entrepôt. Les deux niveaux coexistent dans la même table
> `stocks`, distingués par `storage_location_id`.

---

## 2. Tâches de collecte — `GET /wms/pick-tasks` & `POST .../complete`

### 2.1 Lister — `GET /wms/pick-tasks`

La tournée interne du magasinier : tâches triées par `sequence_number`,
l'ordre de visite d'emplacement optimisé calculé par `PickTaskEngine` à la
génération. Par défaut ne retourne que `pending`/`in_progress` — passer
`status=completed` pour l'historique.

```bash
curl "https://api.omni360.cloud/api/backend/wms/pick-tasks?preparation_order_id=1" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle :**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1, "preparation_order_id": 1, "storage_location_id": 1, "product_id": 1,
        "quantity_to_pick": 10, "actual_picked_quantity": null,
        "sequence_number": 1, "status": "pending",
        "completed_at": null, "completed_by": null,
        "product": { "id": 1, "name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG", "code": "PSCE0200591" },
        "storage_location": { "id": 1, "location_code": "A0001-DEPOT-MAIN", "location_name": "Dépôt Principal – A0001", "location_type": "DEPOT" }
      },
      {
        "id": 2, "preparation_order_id": 1, "storage_location_id": 2, "product_id": 2,
        "quantity_to_pick": 5, "actual_picked_quantity": null,
        "sequence_number": 2, "status": "pending",
        "product": { "id": 2, "name": "BURGER DE VOLAILLE SAC 1KG", "code": "BURV1KG" },
        "storage_location": { "id": 2, "location_code": "A0001-PFZ0", "location_name": "Zone Produit Fini – A0001", "location_type": "SELLABLE" }
      }
    ],
    "total": 2
  }
}
```

### 2.2 Valider une collecte — `POST /wms/pick-tasks/{id}/complete`

`stock_batch_id` est **optionnel** — saisie du lot réellement scanné sur le
terrain (peut différer du lot théorique si le magasinier a pris un autre
carton). Quand fourni **et** `wms.lot_tracking` actif, le lot est validé en
FEFO (rejette un lot expiré/quarantaine/mauvais produit — §7.2) et décrémenté ;
sinon un mouvement d'emplacement simple est journalisé.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/pick-tasks/1/complete" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{ "actual_picked_quantity": 10, "notes": "Collecte conforme" }'
```

**Response `200` — capture réelle :**
```json
{
  "success": true,
  "message": "Pick task completed successfully",
  "data": {
    "id": 1, "preparation_order_id": 1, "storage_location_id": 1, "product_id": 1,
    "quantity_to_pick": 10, "actual_picked_quantity": 10,
    "sequence_number": 1, "status": "completed",
    "completed_at": "2026-07-15T19:54:24.000000Z", "completed_by": 59,
    "storage_location": { "id": 1, "location_code": "A0001-DEPOT-MAIN", "location_type": "DEPOT" }
  }
}
```

**Rejet — lot périmé scanné (`stock_batch_id` pointant sur un lot expiré) :**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/pick-tasks/2/complete" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "actual_picked_quantity": 5, "stock_batch_id": 1 }'
```
```json
{
  "success": false,
  "message": "Batch 'LOT-EXP-PAST' (id=1) is invalid: expiry_date 2026-07-12 has passed.",
  "error_code": "WMS_INVALID_BATCH",
  "errors": { "batch_id": 1, "batch_number": "LOT-EXP-PAST", "reason": "expiry_date 2026-07-12 has passed" }
}
```
> Rejet **transactionnel** : ni le stock d'emplacement ni le statut de la
> tâche ne bougent (vérifié — la tâche reste `pending`, le bin garde sa
> quantité initiale). L'UI peut retenter avec un autre `stock_batch_id` sans
> nettoyage côté serveur.

---

## 3. Alertes péremption — `GET /wms/batches/expiry` & bulk block/unblock

### 3.1 Lister — `GET /wms/batches/expiry`

Par défaut retourne les lots **actionnables** : quarantaine, expirés, ou
actifs à l'intérieur de la fenêtre d'alerte (`wms.lot_expiry_alert_days`,
30 jours par défaut). Passer `include_all=1` pour tout voir (y compris les
lots sains, comme dans la capture ci-dessous — utile pour l'onglet "Vue
d'ensemble").

```bash
curl "https://api.omni360.cloud/api/backend/wms/batches/expiry?warehouse_code=A0001&include_all=1" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json"
```

**Response `200` — capture réelle (les 3 statuts d'alerte en un seul appel) :**
```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 1, "product_id": 1, "batch_number": "LOT-EXP-PAST",
        "expiry_date": "2026-07-11T23:00:00.000000Z", "quantity": "40.00",
        "status": "quarantine", "notes": "Peremption depassee - retrait vente",
        "alert_status": "QUARANTINE", "days_until_expiry": -3,
        "product": { "id": 1, "name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG", "code": "PSCE0200591" }
      },
      {
        "id": 2, "product_id": 1, "batch_number": "LOT-EXP-SOON",
        "expiry_date": "2026-07-19T23:00:00.000000Z", "quantity": "80.00",
        "status": "active", "alert_status": "WARNING", "days_until_expiry": 4
      },
      {
        "id": 3, "product_id": 1, "batch_number": "LOT-HEALTHY",
        "expiry_date": "2026-11-11T23:00:00.000000Z", "quantity": "200.00",
        "status": "active", "alert_status": "OK", "days_until_expiry": 119
      }
    ],
    "total": 3
  },
  "lot_expiry_alert_days": 30
}
```

> `alert_status` : `OK` (hors fenêtre), `WARNING` (dans la fenêtre
> `lot_expiry_alert_days`), `EXPIRED` (date dépassée), `QUARANTINE`
> (bloqué manuellement). C'est un champ **calculé à la volée**, pas stocké —
> toujours à jour, contrairement à `status` qui ne bascule sur `expired` qu'au
> scan quotidien (`ExpiryAlertService`, 6h00 — voir §7.2).

### 3.2 Bloquer en masse — `POST /wms/batches/bulk-block`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/batches/bulk-block" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "stock_batch_ids": [1], "reason": "Peremption depassee - retrait vente" }'
```
```json
{ "success": true, "message": "1 batch(es) quarantined", "updated": 1 }
```
`reason` est **obligatoire** pour un blocage (`422` sinon) — optionnel pour le
déblocage.

### 3.3 Débloquer en masse — `POST /wms/batches/bulk-unblock`

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/batches/bulk-unblock" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "stock_batch_ids": [1] }'
```
```json
{ "success": true, "message": "1 batch(es) reactivated", "updated": 1 }
```
> Un lot **expiré** (`status='expired'`, pas `quarantine`) n'est PAS
> réactivé par bulk-unblock (seuls les lots `quarantine` repassent `active`)
> — c'est volontaire : la date de péremption reste la source de vérité, on ne
> peut pas "débloquer" un produit réellement périmé, seulement lever une mise
> en quarantaine manuelle.

---

## 4. Réception & Entrée de Stock — `POST /wms/receipts`

Pour l'écran "Nouvelle Réception" du magasinier (achat fournisseur ou retour
de tournée). Dépose directement dans le bin donné (`storage_location_id` est
**fourni par l'appelant** — ce n'est PAS l'auto-placement de `PutAwayEngine`,
le magasinier sait déjà où il range). Crée un `stock_movements` de type
`purchase`, et un `stock_batches` dès que `batch_number` est renseigné.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/receipts" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "supplier_id": 1,
    "warehouse_id": 1,
    "items": [
      {
        "product_id": 1,
        "quantity": 150.00,
        "storage_location_id": 1,
        "batch_number": "LOT-2026-07-15",
        "production_date": "2026-07-15",
        "expiry_date": "2026-10-15"
      }
    ]
  }'
```

**Response `201` — capture réelle :**
```json
{
  "success": true,
  "message": "Goods receipt recorded successfully",
  "data": {
    "movements": [
      {
        "id": 1,
        "warehouse_code": "A0001",
        "branch_code": "A0001",
        "product_id": 1,
        "type": "purchase",
        "quantity": "150.000",
        "balance_after": "150.000",
        "stock_batch_id": 2,
        "reference_type": "WmsGoodsReceipt",
        "reference_id": 1,
        "user_id": 59
      }
    ],
    "batches": [
      {
        "id": 2,
        "product_id": 1,
        "branch_code": "A0001",
        "warehouse_code": "A0001",
        "batch_number": "LOT-2026-07-15",
        "production_date": "2026-07-14T23:00:00.000000Z",
        "expiry_date": "2026-10-14T23:00:00.000000Z",
        "quantity": "150.00",
        "reserved_quantity": "0.00",
        "initial_quantity": "150.00",
        "supplier_code": 1,
        "status": "active"
      }
    ]
  }
}
```

> `reference_id` sur le mouvement = `supplier_id` (pas un lien vers une table
> `purchase_receptions` — ce nouvel endpoint est indépendant du flux
> `PurchaseReceptionController`/`purchase-receptions` existant, qui, lui, gère
> un vrai cycle brouillon→validation avec contrôle qualité mais **n'a jamais
> créé de `stock_batches`**. Les deux flux coexistent : celui-ci pour une
> saisie WMS directe et rapide, l'autre pour un processus de réception
> formalisé avec QC — voir [13-wms-logistics.md](13-wms-logistics.md) pour le
> détail du second si l'écran en a besoin).
>
> `batch_number` est **optionnel** — l'omettre crée uniquement le mouvement
> d'entrée + le stock d'emplacement, sans lot (utile pour un produit non
> tracé en FEFO).

---

## 5. Bon de Transfert — `POST /wms/transfers`

Transfert **agrégat entrepôt** (Tier 1, pas bin-level) entre deux entrepôts —
typiquement Central → Van d'un commercial SFA, ou dépôt → dépôt. Écrit la
paire miroir `transfer_out`/`transfer_in` sur `stock_movements`. Si
`stock_batch_id` est fourni et `wms.lot_tracking` actif, le lot est validé
(FEFO — rejette un lot expiré/quarantaine/mauvais produit, §7.2) et décrémenté
à la source.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/transfers" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "source_warehouse_id": 1,
    "destination_warehouse_id": 7,
    "items": [
      { "product_id": 1, "quantity": 50.00, "stock_batch_id": 1 }
    ]
  }'
```

**Response `201` — capture réelle (300 → 250 à la source, 0 → 50 au van) :**
```json
{
  "success": true,
  "message": "Transfer recorded successfully",
  "data": {
    "movements": [
      {
        "id": 2, "warehouse_code": "A0001", "branch_code": "A0001", "product_id": 1,
        "type": "transfer_out", "quantity": "-50.000", "balance_after": "250.000",
        "stock_batch_id": 1, "reference_type": "WmsTransfer", "user_id": 59
      },
      {
        "id": 3, "warehouse_code": "A0001-VAN-MERC-01", "branch_code": "A0001", "product_id": 1,
        "type": "transfer_in", "quantity": "50.000", "balance_after": "50.000",
        "stock_batch_id": 1, "reference_type": "WmsTransfer", "reference_id": 2, "user_id": 59
      }
    ]
  }
}
```

**Rejet — stock insuffisant à la source :**
```json
{ "success": false, "message": "Insufficient stock for product #1 at A0001: available=250 required=99999." }
```

> ⚠️ **Limitation connue (documentée, pas corrigée) :** le lot source est
> décrémenté (`stock_batches.quantity` : 100 → 50 dans la capture ci-dessus)
> mais **aucun lot miroir n'est créé à la destination** — le van reçoit un
> stock physique lié au même `stock_batch_id` que le dépôt central, sans
> ligne `stock_batches` propre au van. Le lot-splitting inter-entrepôt est
> hors périmètre de cette version ; si l'écran Van a besoin d'une vue FEFO
> indépendante par véhicule, il faut le spécifier en tâche produit dédiée.
>
> Contrairement à un `Stock::deduct()` classique, ce transfert **ne touche
> jamais `reserved_quantity`** à la source — un déplacement physique
> d'entrepôt à entrepôt ne doit pas libérer silencieusement la réservation
> d'une commande sans rapport avec ce transfert.

---

## 6. Ajustement Manuel — `POST /wms/adjustments`

Pour l'écran "Ajustement / Correction" (casse, perte, vol, écart de
re-comptage) sur un bin donné. `quantity` est **signée** : négative pour une
perte, positive pour un excédent.

```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/adjustments" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Accept: application/json" \
  -H "Content-Type: application/json" \
  -d '{
    "warehouse_id": 1,
    "storage_location_id": 2,
    "product_id": 2,
    "quantity": -5.00,
    "reason_code": "CASSE_DEPOT",
    "notes": "Palette renversée dans l allée B"
  }'
```

**Response `201` — capture réelle :**
```json
{
  "success": true,
  "message": "Stock adjustment recorded successfully",
  "data": {
    "movement": {
      "id": 4, "warehouse_code": "A0001", "branch_code": "A0001", "product_id": 2,
      "type": "adjustment", "quantity": "-5.000", "balance_after": "25.000",
      "reference_type": "WmsAdjustment", "user_id": 59, "notes": "Palette renversee dans l allee B"
    },
    "stock": {
      "id": 12, "product_id": 2, "quantity": "25.000", "reserved_quantity": "0.000",
      "available_quantity": "25.000", "warehouse_code": "A0001", "storage_location_id": 2
    }
  }
}
```

**Excédent (recomptage) :**
```bash
curl -X POST "https://api.omni360.cloud/api/backend/wms/adjustments" \
  -H "Authorization: Bearer {TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{ "warehouse_id": 1, "storage_location_id": 2, "product_id": 2, "quantity": 3.00, "reason_code": "ECART_INVENTAIRE", "notes": "Recomptage physique" }'
```
```json
{ "success": true, "message": "Stock adjustment recorded successfully", "data": { "movement": { "quantity": "3.000", "balance_after": "28.000" } } }
```

> ⚠️ **Écart volontaire avec le payload demandé** — le champ
> `performed_by_user_id` est accepté dans le payload (pour affichage/log
> côté UI) mais **jamais utilisé comme acteur réel** : l'audit
> (`wms_audit_logs.performed_by_user_id`) est **toujours** l'utilisateur
> authentifié de la requête, jamais une valeur envoyée par le client.
> Vérifié en staging : un payload avec `"performed_by_user_id": 999` a bien
> écrit `performed_by_user_id: 59` (l'utilisateur du token Bearer) dans
> `wms_audit_logs`. Accepter un acteur arbitraire fourni par le client
> permettrait à n'importe qui d'attribuer une déclaration de perte/vol à
> quelqu'un d'autre — c'est un problème de sécurité, pas une simple
> divergence de contrat. **Ne pas envoyer ce champ dans l'UI** (il est
> silencieusement ignoré) ; l'acteur est déterminé côté serveur par le token.
>
> `reason_code` est **obligatoire** et libre (max 50 caractères) — aucune
> whitelist appliquée côté serveur actuellement. Suggestion de vocabulaire
> pour l'UI (cohérent avec les `reason_code` déjà utilisés en interne) :
> `CASSE_DEPOT`, `PERTE`, `VOL`, `ECART_INVENTAIRE`.

---

## 7. Deep Review — points de vigilance validés

### 7.1 Réservation "Soft Lock" — `mv_stock_available_by_branch_product` & over-selling

**Constat initial :** la réservation de stock (`StockService::reserveForOrder()`,
qui décrémente `stocks.reserved_quantity`/`available_quantity`) ne se
déclenchait **qu'à l'approbation ADV** de la commande (`ApproveOrderDecision`,
gate `stock.reserve_on_order`) — jamais à la création `draft`/`pending`. Entre
la soumission d'une commande (`SubmitOrderDecision`, statut `submitted`, l'état
"pending ADV") et son approbation, **aucune réservation n'existait** : deux
order-takers pouvaient soumettre une commande sur les mêmes dernières unités
sans qu'aucun des deux ne soit bloqué — l'over-sell se découvrait seulement à
l'approbation du second, potentiellement plusieurs heures après la vente
terrain.

**Corrigé** — `SubmitOrderDecision::doExecute()` appelle maintenant
`StockService::reserveForOrder()` (même méthode, gate `stock.reserve_on_order`
inchangée) **au moment du `submitted`**, pas seulement à l'approbation.
Idempotent par (order, product) via le movement `'reservation'` existant : si
la réservation a déjà eu lieu au submit, l'appel fait à l'approbation devient
un no-op. Zéro changement de comportement pour les intégrations qui n'activent
pas `stock.reserve_on_order`.

**Sur `mv_stock_available_by_branch_product` (le vecteur nommé dans le
brief) :** cette vue matérialisée n'est **pas** le mécanisme réellement
consommé par la chaîne de réservation/vente — elle est rafraîchie de façon
asynchrone (toutes les 15 min, `erp:refresh-matviews`, désactivée par défaut
via `ERP_USE_MATERIALIZED_VIEWS`) et sert uniquement un widget "stock bas" du
dashboard POS. Le "stock disponible à la vente" réellement vérifié par
`SubmitOrderDecision::collectStockShortages()` et par `reserveForOrder()` lit
`stocks.available_quantity` **en direct**, verrouillé (`lockForUpdate()`) au
moment de la réservation — c'est cette colonne, pas la vue matérialisée, qui
porte la garantie anti-over-sell. Fiabiliser le soft-lock sur cette base est
donc correct et suffisant ; s'appuyer sur la vue matérialisée aurait au
contraire **introduit** une fenêtre de dérive de 15 min.

**Sur `stock_allocation_lines` (l'autre vecteur nommé dans le brief) :** cette
table appartient à un moteur d'allocation distinct (S1/S2,
`AllocationEngine::propose()`), au périmètre différent — il traite des
**runs** d'allocation par branche/jour sur des commandes déjà **confirmées**
(en attente de conversion BL), avec un workflow propose→validate→confirm
piloté par le rôle `dispatcher`, pas un verrou temps réel à la soumission.
Le réutiliser pour le soft-lock draft/pending aurait mélangé deux sémantiques
incompatibles ; le soft-lock a donc été branché sur le mécanisme de
réservation existant (`stocks.reserved_quantity`), qui est le bon outil pour
ce job.

### 7.2 Verrou lot périmé — `stock_batches` & `wms_expiry_alert_log`

**Constat initial :** `LotEnforcementService::validateMovementBatch()`
(rejette un lot non-`active`/épuisé/mauvais produit) existait déjà mais
n'était câblé que sur un seul chemin d'écriture, mort en pratique
(`StockMovementService::deductVanStockForConventionalDirectInvoice()`, dont le
seul appelant ne passait jamais de `stock_batch_id` réel). **Tous les autres
chemins** de mouvement de stock (vente directe, transferts, ajustements)
ignoraient totalement `stock_batches`.

**Corrigé** — garde-fou ajouté directement dans `StockMovement::booted()`
(hook `creating`, aux côtés de la validation d'intégrité entrepôt déjà
présente) : tout mouvement de type sortant (`sale`, `transfer_out`,
`adjustment`) qui référence un `stock_batch_id` est rejeté si le lot n'est pas
`active`, ou si sa `expiry_date` est dépassée **même si le scan quotidien n'a
pas encore basculé son `status` sur `expired`** (fenêtre de dérive jusqu'à
24h). C'est un garde-fou au niveau **modèle**, pas juste service — impossible
à contourner en passant par un chemin d'écriture différent. Zéro régression :
aucun chemin de mouvement existant ne renseignait `stock_batch_id`
(`stock_movements.stock_batch_id`/`batch_number` manquaient même du
`$fillable` du modèle — corrigé au passage), donc ce garde-fou est
strictement additif tant qu'aucun appelant ne l'utilise pas encore.

**Bug annexe corrigé :** `ExpiryAlertService::emitAlert()` insérait une clé
`updated_at` dans `wms_expiry_alert_log`, table strictement append-only
(`created_at` uniquement) — aurait levé une erreur colonne inexistante au
premier scan réel avec `wms.lot_tracking` actif.

### 7.3 Audit trail — `wms_audit_logs`

**Constat initial :** `performed_by_user_id` était nullable
(`ON DELETE SET NULL`) et il n'existait **aucune colonne structurée** pour la
raison d'un mouvement — seul un `metadata` JSON libre, non validé. Pire :
la quasi-totalité des chemins de mouvement de stock (`StockService`,
`StockMovementApiController::adjustment/transfer`) n'écrivaient **jamais**
dans `wms_audit_logs` — seuls les flux Tier 2/3 (`EmplacementStockTracker`,
`LotEnforcementService`, `PutAwayEngine`) le font, et ils sont
feature-flag-gated off par défaut.

**Corrigé** — deux changements complémentaires :
1. **Schéma** : nouvelle colonne `reason_code` (NOT NULL) ; `performed_by_user_id`
   passé de nullable/`SET NULL` à **NOT NULL**/`RESTRICT` (migration
   `2026_07_22_000000_harden_wms_audit_logs_accountability.php`).
2. **Contrat PHP** : `WmsAuditLogger::logEmplacementMovement()`/`logBatchMovement()`
   exigent désormais `int $performedByUserId` et `string $reasonCode` — non
   optionnels, non nullable. Impossible d'écrire une entrée d'audit sans les
   deux. Les 3 appelants existants (`PutAwayEngine`, `EmplacementStockTracker`,
   `LotEnforcementService`) et le nouvel appelant (`WmsController::completePickTask()`)
   ont été mis à jour en conséquence.

Sans appelant en production aujourd'hui (feature Tier 2/3 désactivée par
défaut, voir §8), ce durcissement est sans risque de régression — il ferme la
porte avant l'ouverture du chantier, pas après.

### 7.4 Bug annexe trouvé pendant la revue — `Stock::storageLocation()`

La relation `Stock::storageLocation()` était définie
`belongsTo(StorageLocation::class, 'warehouse_code', 'location_code')` —
comparait un code d'entrepôt (`"A0001"`) à un code d'emplacement
(`"A0001-DEPOT-MAIN"'), qui ne matchent jamais. Résultat : `storage_location`
était **toujours `null`** dans toute réponse API qui l'eager-loadait
(`StockApiController`, et le nouveau `GET /wms/stock-levels` avant correctif).
Corrigé pour utiliser la vraie FK `storage_location_id`. Découvert et corrigé
en construisant §1 de ce document — capture avant/après dans l'historique Git.
Un deuxième bug lié a été corrigé au passage : `storage_location_id` manquait
du `$fillable` de `Stock`, donc `EmplacementStockTracker::incrementEmplacementStock()`
perdait silencieusement ce champ à la création d'une ligne d'emplacement.

### 7.5 Bug critique trouvé en construisant §4 — contrainte d'unicité `stocks` cassait le Tier 2

**Découvert en capturant `POST /wms/receipts` : le tout premier appel réel
échouait** avec `SQLSTATE[23505]: duplicate key value violates unique
constraint "stocks_warehouse_code_product_id_unique"`, alors que la ligne
insérée avait un `storage_location_id` différent de la ligne agrégat
existante pour le même `(warehouse_code, product_id)`.

**Cause :** la migration `2026_07_04_000100_add_storage_location_id_to_stocks_table.php`
qui a introduit le Tier 2 (colonne `storage_location_id` + index unique
partiel `stocks_wh_product_location_uq` sur `(warehouse_code, product_id,
storage_location_id) WHERE storage_location_id IS NOT NULL`) affirmait dans
son propre commentaire que l'ancienne contrainte `UNIQUE(warehouse_code,
product_id)` *"continues to govern warehouse-aggregate rows (storage_location_id
IS NULL)"*. C'est faux : une contrainte `UNIQUE` multi-colonnes classique en
Postgres s'applique à **toutes** les lignes, quelle que soit la valeur des
autres colonnes — elle ne s'arrête pas de s'appliquer parce qu'une autre
colonne est renseignée ailleurs. Résultat concret : **impossible d'avoir à la
fois une ligne agrégat (Tier 1, `storage_location_id IS NULL`) et une ligne
de bin (Tier 2) pour le même produit dans le même entrepôt** — soit
exactement le cas d'usage central du Tier 2 (un entrepôt a une ligne agrégat
héritée ET des lignes de bin one fois `wms.emplacements_enabled` activé). Le
Tier 2 était donc **cassé pour tout entrepôt ayant déjà du stock Tier 1**
depuis son introduction, et personne ne l'avait remarqué faute d'un appel
réel exerçant les deux en même temps avant cette revue.

**Corrigé** — migration `2026_07_23_000000_fix_stocks_unique_constraint_for_tier2_emplacements.php` :
supprime la contrainte globale `stocks_warehouse_code_product_id_unique` et
la remplace par un index unique **partiel** `stocks_wh_product_aggregate_uq`
sur `(warehouse_code, product_id) WHERE storage_location_id IS NULL` — même
style de prédicat que l'index partiel Tier 2 déjà en place, garantissant
"au plus une ligne agrégat par (entrepôt, produit)" tout en laissant
coexister les lignes de bin. Vérifié en staging : la capture de `POST
/wms/receipts` en §4 a été refaite avec succès après ce correctif, sur un
entrepôt qui avait déjà une ligne Tier 1 pour le même produit.

---

## 8. Gating (paramètres `wms.*`)

| Paramètre | Défaut | Effet |
|---|---|---|
| `wms.advanced_mode` | `false` | Master gate — tous les sous-paramètres retombent à `false` si off |
| `wms.emplacements_enabled` | `false` | Active le put-away/pick par emplacement (Tier 2) |
| `wms.lot_tracking` | `false` | Active la sélection FEFO et le verrou de lot (Tier 3) |
| `wms.lot_expiry_alert_days` | `30` | Fenêtre d'alerte avant péremption |

> Les 6 endpoints de ce document (`stock-levels`, `pick-tasks`,
> `batches/expiry`, `receipts`, `transfers`, `adjustments`) **fonctionnent
> indépendamment de ces flags** — ils lisent/écrivent directement
> `stocks`/`stock_batches`/`wms_pick_tasks`. Les flags contrôlent uniquement
> la **génération automatique** des tâches de pick (`PickTaskEngine`) et
> l'affectation d'emplacement (`PutAwayEngine`), pas la consultation/action
> manuelle exposée ici. Le garde-fou anti-lot-périmé (§7.2) s'applique lui
> aussi **sans condition de flag** dès qu'un `stock_batch_id` est fourni ;
> `wms.lot_tracking` ne contrôle que la validation/décrémentation FEFO
> optionnelle sur `pick-tasks/{id}/complete` et `transfers`.

---

## 9. TypeScript Interfaces

```typescript
interface StockLevelRow {
  id: number;
  product_id: number;
  quantity: string;
  reserved_quantity: string;
  available_quantity: string;
  minimum_quantity: string;
  maximum_quantity: string | null;
  warehouse_code: string;
  branch_id: number | null;
  storage_location_id: number | null;
  product: { id: number; name: string; code: string; barcode: string | null };
  warehouse: { code: string; name: string; type: 'central' | 'delivery_van' | 'system_virtual'; branch_code: string };
  storage_location: {
    id: number;
    location_code: string;
    location_name: string;
    location_type: 'DEPOT' | 'SELLABLE' | 'DAMAGED' | 'EXPIRED' | 'QUARANTINE' | 'SCRAP' | 'RETURN_TO_SUPPLIER' | 'DELIVERY_VAN';
  } | null; // null = Tier 1 warehouse-aggregate row
}

type PickTaskStatus = 'pending' | 'in_progress' | 'completed' | 'cancelled';

interface WmsPickTask {
  id: number;
  preparation_order_id: number;
  storage_location_id: number;
  product_id: number;
  quantity_to_pick: number;
  actual_picked_quantity: number | null;
  sequence_number: number;
  status: PickTaskStatus;
  completed_at: string | null;
  completed_by: number | null;
  product: { id: number; name: string; code: string };
  storage_location: { id: number; location_code: string; location_name: string; location_type: string };
}

interface CompletePickTaskPayload {
  actual_picked_quantity: number; // required
  stock_batch_id?: number;        // optional — real batch scanned on-site
  notes?: string;
}

type BatchAlertStatus = 'OK' | 'WARNING' | 'EXPIRED' | 'QUARANTINE';
type StockBatchStatus = 'active' | 'expired' | 'quarantine' | 'depleted';

interface StockBatchExpiryRow {
  id: number;
  product_id: number;
  branch_code: string;
  warehouse_code: string;
  batch_number: string;
  production_date: string | null;
  expiry_date: string;
  quantity: string;
  reserved_quantity: string;
  initial_quantity: string;
  status: StockBatchStatus;
  notes: string | null;
  alert_status: BatchAlertStatus; // computed, not stored
  days_until_expiry: number;      // negative = past expiry
  product: { id: number; name: string; code: string };
}

interface BulkBatchActionPayload {
  stock_batch_ids: number[]; // required, min 1
  reason?: string;           // required for bulk-block, optional for bulk-unblock
}

// ─── Goods Receipt ──────────────────────────────────────────────────────────

interface GoodsReceiptItemPayload {
  product_id: number;
  quantity: number;              // > 0
  storage_location_id: number;   // required — caller-chosen bin, not auto-placed
  batch_number?: string;         // omit for non-lot-tracked products
  production_date?: string;      // YYYY-MM-DD
  expiry_date?: string;          // YYYY-MM-DD, must be after production_date
}

interface GoodsReceiptPayload {
  supplier_id?: number;
  warehouse_id: number;
  items: GoodsReceiptItemPayload[]; // min 1
}

interface GoodsReceiptResponse {
  success: boolean;
  message: string;
  data: {
    movements: Array<{ id: number; warehouse_code: string; product_id: number; type: 'purchase'; quantity: string; balance_after: string; stock_batch_id: number | null }>;
    batches: Array<{ id: number; product_id: number; batch_number: string; expiry_date: string | null; quantity: string; status: StockBatchStatus }>;
  };
}

// ─── Transfer ───────────────────────────────────────────────────────────────

interface TransferItemPayload {
  product_id: number;
  quantity: number;          // > 0
  stock_batch_id?: number;   // validated + decremented at source when lot_tracking is on
}

interface TransferPayload {
  source_warehouse_id: number;
  destination_warehouse_id: number; // must differ from source
  items: TransferItemPayload[];     // min 1
}

interface TransferResponse {
  success: boolean;
  message: string;
  data: {
    movements: Array<{ id: number; warehouse_code: string; type: 'transfer_out' | 'transfer_in'; quantity: string; balance_after: string; stock_batch_id: number | null; reference_id: number | null }>;
  };
}

// ─── Manual Adjustment ──────────────────────────────────────────────────────

interface AdjustmentPayload {
  warehouse_id: number;
  storage_location_id: number;
  product_id: number;
  quantity: number;        // signed — negative = loss, positive = surplus, cannot be 0
  reason_code: string;     // required, max 50 chars, e.g. CASSE_DEPOT | PERTE | VOL | ECART_INVENTAIRE
  notes?: string;
  // performed_by_user_id is accepted but IGNORED server-side — the actor is
  // always the authenticated request user. Do not rely on this field.
  performed_by_user_id?: number;
}

interface AdjustmentResponse {
  success: boolean;
  message: string;
  data: {
    movement: { id: number; warehouse_code: string; product_id: number; type: 'adjustment'; quantity: string; balance_after: string };
    stock: StockLevelRow;
  };
}
```
