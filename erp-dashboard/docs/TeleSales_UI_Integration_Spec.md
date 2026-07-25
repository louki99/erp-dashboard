# Spec d'intégration UI — Module Télévendeur (Tele-Sales / Inside Sales)

Document de référence pour l'équipe UI/Front-end. Tous les endpoints ci-dessous sont **testés et fonctionnels** contre la base réelle (voir section "Statut" de chaque bloc).

> ⚠️ **Changement d'URL (2026-08)** : ce module a été déplacé de `routes/pos.php` vers `routes/backend/telesales.php`. Le Télévendeur est un module **Backoffice Web** (call-center), pas un module POS (caisse physique) — l'ancien préfixe `/api/pos/televendeur/...` **n'existe plus** (404). Toute intégration front doit utiliser le nouveau préfixe `/api/backend/telesales/...` ci-dessous.

## 0. Principes d'architecture (à connaître avant de coder les écrans)

- **Auth** : Sanctum Bearer token, exactement comme le reste du back-office web. **Aucun `device_key` / `device_id` requis nulle part dans ce module.** Les télévendeurs partagent des postes de bureau — l'isolation se fait à 100% par `user_id` / token de session. Ne jamais réutiliser le flow mobile SFA (bind/PIN/device) pour cet écran.
- **Rôle requis** : `televendeur`, `admin` ou `root`, appliqué au niveau **middleware de route** (`role:televendeur|admin|root`) — un utilisateur sans un de ces 3 rôles reçoit un 403 avant même d'atteindre le contrôleur. Chaque endpoint a en plus une permission Spatie dédiée (listée par bloc) pour un contrôle plus fin.
- **Base URL** : `/api/backend/telesales/...`
- **Format de réponse** : `{ "success": true|false, "message"?: "...", <clé métier>: ... }`. Sur erreur de validation Laravel standard (422), le format est `{ "message": "...", "errors": {...} }`.
- **Un agent = une session à la fois.** Le back refuse de démarrer une 2ᵉ session tant que la précédente n'est pas `ended`. L'UI doit donc appeler `GET /sessions/current` au chargement de l'app pour savoir si une session est déjà active (ex: reprise après un refresh de page).

---

## 1. Authentification

Réutilise le login backoffice existant (`POST /api/backend/login` déjà documenté ailleurs). Rien de spécifique à créer côté UI pour télévendeur — un utilisateur avec le rôle `televendeur` se connecte comme n'importe quel utilisateur backoffice et reçoit un Bearer token Sanctum classique.

---

## 2. Session Télévendeur (Start / Pause / Resume / End)

**Statut : testé en HTTP réel (start, double-start bloqué, pause, resume avec calcul de durée, end, isolation cross-user).**

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Session en cours | GET | `/sessions/current` | `televendeur.manage_session` |
| Démarrer | POST | `/sessions/start` | `televendeur.manage_session` |
| Mettre en pause | POST | `/sessions/{id}/pause` | `televendeur.manage_session` |
| Reprendre | POST | `/sessions/{id}/resume` | `televendeur.manage_session` |
| Terminer | POST | `/sessions/{id}/end` | `televendeur.manage_session` |

### Objet `session`
```json
{
  "id": 1,
  "user_id": 27,
  "status": "active",       // active | paused | ended
  "started_at": "2026-07-23T15:03:40.000000Z",
  "paused_at": "2026-07-23T15:04:06.000000Z",
  "resumed_at": "2026-07-23T15:04:58.000000Z",
  "ended_at": null,
  "total_paused_seconds": 52
}
```

### `GET /sessions/current`
Réponse `{ "success": true, "session": null }` si aucune session active/en pause. Sinon renvoie l'objet session.

### `POST /sessions/start`
- 201 avec l'objet session si OK.
- **422** si une session active ou en pause existe déjà : `{ "success": false, "message": "You already have an active or paused session. End it before starting a new one." }` → l'UI doit alors afficher la session existante (via `GET /sessions/current`) plutôt que de réessayer.

### `POST /sessions/{id}/pause` et `/resume`
- 422 si mauvais état (ex: pause sur une session déjà `paused`, resume sur une session `active`).
- 403 si `{id}` n'appartient pas à l'utilisateur connecté (garde-fou anti-partage de poste — l'UI ne devrait jamais construire cette requête avec un autre id que celui de `GET /sessions/current`, mais le back le bloque de toute façon).

### `POST /sessions/{id}/end`
- Fige `total_paused_seconds` (inclut la pause en cours si la session était `paused` au moment du end) et passe `status: ended`. Une fois `ended`, plus aucune action possible sur cette session — il faut en redémarrer une nouvelle.

**Écran recommandé** : bandeau persistant en haut de l'app télévendeur avec bouton Start/Pause/Resume/End + chrono (calculé côté front à partir de `started_at`/`total_paused_seconds`, pas besoin de polling serveur).

---

## 3. Planning / Semainier & Télé-visites

**Statut : testé en HTTP réel (planification, consultation planning, appel spontané, prise en main d'un appel planifié, isolation cross-user).**

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Planning du jour | GET | `/planning?date=YYYY-MM-DD` | `televendeur.manage_visits` |
| Historique | GET | `/visits?date_from=&date_to=` | `televendeur.manage_visits` |
| Planifier un appel | POST | `/visits` | `televendeur.manage_visits` |
| Démarrer un appel spontané | POST | `/visits/start-adhoc` | `televendeur.manage_visits` |
| Prendre en main un appel planifié | POST | `/visits/{id}/start` | `televendeur.manage_visits` |
| Qualifier le résultat | POST | `/visits/{id}/complete` | `televendeur.manage_visits` |

### Objet `visit`
```json
{
  "id": 1,
  "user_id": 27,
  "partner_id": 2,
  "tele_sales_session_id": 1,
  "order_id": null,
  "is_planned": true,
  "scheduled_at": "2026-07-24T09:00:00.000000Z",
  "started_at": null,
  "ended_at": null,
  "outcome": null,           // voir §3.4
  "notes": "Relance commande mensuelle",
  "partner": { "id": 2, "code": "CL00002", "name": "EXTRA DINDE", "phone": null, ... }
}
```

### 3.1 `GET /planning?date=2026-07-24`
Retourne les appels **planifiés et non qualifiés** (`outcome` encore null) pour la date donnée, triés par heure. Réponse : `{ "success": true, "date": "2026-07-24", "visits": [...] }`. `date` est optionnel — par défaut `now()`.

### 3.2 `POST /visits` — Planifier un appel
Body :
```json
{ "partner_id": 2, "scheduled_at": "2026-07-24 10:00:00", "notes": "optionnel" }
```
→ crée une télé-visite `is_planned: true`. C'est la brique du "semainier" : le back n'impose aucune récurrence ni contrainte de créneau — l'UI construit le planning en appelant cet endpoint autant de fois que nécessaire (une entrée = un créneau).

### 3.3 Appel spontané vs appel planifié
- **Spontané** : `POST /visits/start-adhoc` avec `{ "partner_id": ... }` → crée directement une visite `is_planned: false`, `started_at` = maintenant, rattachée automatiquement à la session active de l'agent si elle existe.
- **Planifié, prise en main** : `POST /visits/{id}/start` (pas de body) sur une entrée créée via `POST /visits` → fixe `started_at` = maintenant sur l'entrée existante. Erreur 422 si déjà démarrée.

**Écran recommandé** : dans la fiche planning, un bouton "Appeler" sur chaque ligne planifiée appelle `/visits/{id}/start`, puis navigue vers l'écran de qualification. Un bouton flottant "Appel libre" sur le dashboard appelle `/visits/start-adhoc` avec sélection de partenaire au préalable.

### 3.4 `POST /visits/{id}/complete` — Qualification du résultat
Body :
```json
{ "outcome": "ORDER_TAKEN", "notes": "optionnel", "order_id": 123 }
```

Valeurs valides pour `outcome` (validation stricte côté serveur, 422 si autre valeur) :

| Valeur | Libellé UI suggéré |
|---|---|
| `ORDER_TAKEN` | Prise de commande |
| `UNAVAILABLE` | Client indisponible |
| `COMPLAINT` | Réclamation client |
| `NO_ANSWER` | Pas de réponse |
| `BUSY` | Occupé |
| `RESTOCK_NEEDED` | Reconstitution de stock |

- `order_id` est optionnel et n'a de sens que si `outcome = ORDER_TAKEN` (lie la télé-visite à la commande créée via le flow §5). L'UI doit passer l'id de la commande fraîchement créée si l'agent vient de la saisir dans le même appel.
- 422 si la visite a déjà un `outcome` (pas de re-qualification).
- 403 si la visite n'appartient pas à l'utilisateur connecté.

**Écran recommandé** : "Fiche télé-visite" = zone de notes libres + les 6 boutons de qualification ci-dessus + (si `ORDER_TAKEN`) redirection vers l'écran de prise de commande (§5) puis retour automatique pour lier `order_id`.

---

## 4. Master Data & Catalogue (consultation temps réel)

**Statut : testé en HTTP réel (recherche, filtre par page produit, pricing avec/sans partenaire, stock, payment terms, sales groups).**

Un télévendeur en ligne doit pouvoir guider le client **pendant l'appel** — cross-sell, vérification de stock, prix exact — sans quitter l'écran. Ces 3 endpoints sont **volontairement plus légers** que le catalogue mobile SFA (`CatalogController` salesperson) : pas de scoping `data_rules` territorial ni de boost merchandising — un agent call-center voit tout le catalogue actif, pas un sous-ensemble géographique.

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Recherche produits | GET | `/catalog/products?search=&product_page_code=&partner_id=&per_page=` | `televendeur.view_products` |
| Pages produits (filtres) | GET | `/catalog/pages` | `televendeur.view_products` |
| Promotions partenaire | GET | `/partners/{id}/promotions` | `televendeur.view_promotions` *(déjà documenté en §5)* |
| Master data (modalités, groupes) | GET | `/master-data` | `televendeur.view_master_data` |

### 4.1 `GET /catalog/products`
Query params tous optionnels :
- `search` — recherche nom/code produit
- `product_page_code` — filtre par page/famille (voir §4.2)
- `partner_id` — **si fourni**, le prix est résolu via le moteur tarifaire officiel (`PartnerProductPriceResolver`, même moteur que §5.1) ; **si omis**, prix générique (`price_source: "generic"`, souvent `0` si aucun prix retail n'est configuré pour le produit — c'est un vrai trou de données catalogue, pas un bug).
- `per_page` (défaut 20, max 100)

Réponse :
```json
{
  "success": true,
  "products": [
    {
      "id": 67, "code": "PSEC0200213", "name": "ABRILSOL HUILE DE TOURNESOL OLEIQUE 3x 5L PET",
      "short_description": null, "barcode": null, "brand": { "id": 1, "name": "FoodPlus" },
      "product_page_code": "SHHTO", "unit_id": 1, "unit_name": "PCS",
      "price": 99.01, "price_source": "partner",
      "price_list": { "id": 4, "code": "C05", "name": "DETAILS" },
      "tax_rate": 20,
      "stock_available": 12,
      "marketing": { "is_new": true, "is_featured": false },
      "flags": {
        "is_salable": true, "is_returnable": true, "is_discountable": true, "is_expirable": true,
        "requires_refrigeration": false, "decimal_quantity_allowed": false, "min_quantity_order": 1
      },
      "packagings": [{ "packaging_id": 66, "unit_id": 1, "unit_name": "PCS", "quantity": 1, "is_default": true }]
    }
  ],
  "pagination": { "current_page": 1, "total_pages": 107, "total": 213, "per_page": 2 }
}
```
`stock_available` vient d'une résolution d'entrepôt bulk (même contrat que le catalogue SFA, `MobileProfileResolver::resolveStockWarehouseCode`) — si l'agent n'a ni entrepôt/van ni branche configurée, retombe à `0` pour tous les produits (comportement attendu, pas une erreur).

`price_list` n'est renseigné que si `partner_id` est fourni **et** que ce partenaire a une liste de prix effective résolue (directe ou héritée de son canal) — `null` sinon, pas une erreur. `flags` vient de `product_flags` (règles métier — ex: `decimal_quantity_allowed: false` interdit une quantité non-entière côté UI, `is_returnable: false` doit désactiver le bouton retour pour cette ligne) ; les valeurs par défaut ci-dessus (`true`/`true`/`true`/`false`/`false`/`true`/`0`) s'appliquent quand aucune ligne `product_flags` n'existe pour le produit. ⚠️ **`buy_price` (prix d'achat/coût) n'est volontairement jamais exposé** ici — c'est une donnée de marge interne, pas une info à faire remonter à un canal de vente.

**Écran recommandé** : barre de recherche produit accessible depuis le Dashboard (§7) et directement inline sur l'écran Prise de Commande (§5.1) — passer `partner_id` dès qu'un partenaire est sélectionné pour afficher le vrai prix négocié avant même d'ajouter la ligne à la commande.

### 4.2 `GET /catalog/pages`
Retourne les pages/familles produit actives et vendables (`hold=false`, `salable=true`), triées par `rank` puis nom :
```json
{ "success": true, "pages": [{ "id": 11, "code": "B010", "name": "Default", "rank": 1 }, ...] }
```
**Écran recommandé** : chips/onglets de filtre au-dessus de la liste produits (§4.1), `code` passé en `product_page_code`.

### 4.3 `GET /master-data`
```json
{
  "success": true,
  "payment_terms": [
    { "id": 1, "code": "IMMEDIATE", "name": "Paiement immédiat", "days_number": 0, "is_credit": false, "is_cash": true, "discount": "0.000000" },
    { "id": 2, "code": "NET7", "name": "Net 7 jours", "days_number": 7, "is_credit": true, "is_cash": false, "discount": "0.000000" }
  ],
  "sales_groups": [{ "code": "FDP", "name": "FoodPlus" }, { "code": "SFD", "name": "Seafood" }]
}
```
`payment_terms` = modalités de paiement sélectionnables (exclut les modalités système type `CART`) — même shape que ce que `POST /orders` accepte en `payment_term_id`. `sales_groups` = référentiel de familles commerciales produit (pour regroupement/affichage, pas un filtre catalogue à part entière — `product_page_code` en §4.1 reste le filtre principal).

⚠️ **Pas de "grille de remise" dédiée** : il n'existe aucune entité back distincte de type "discount grid" — les remises réelles viennent soit du prix négocié (§4.1, `partner_id`), soit des promotions actives (`GET /partners/{id}/promotions`, §5). Ne pas construire un écran "grilles de remise" séparé, il n'y a rien à y afficher.

### 4.4 Sync local-first (cache IndexedDB)

**Statut : testé en HTTP réel (catalogue 213 produits, partenaires avec override réel vérifié en aller-retour, `catalog/price-list` vérifié produit par produit contre le résolveur serveur réel, résolution de tier active vérifiée).**

Quatre endpoints pensés pour peupler un cache local (IndexedDB ou équivalent) et permettre un **calcul instantané côté client, sans requête serveur à chaque frappe**. Catalogue et partenaires sont volontairement séparés (le catalogue est partagé par tous les agents, les partenaires sont propres à chacun) — le client combine les deux localement pour une estimation de prix.

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Sync catalogue complet | GET | `/catalog/sync?updated_since=` | `televendeur.view_products` |
| **Prix de base par liste** | GET | `/catalog/price-list?price_list_id=` | `televendeur.view_products` |
| Sync tiers de prix (par liste) | GET | `/catalog/tiers?price_list_id=` | `televendeur.view_products` |
| Sync partenaires complet | GET | `/partners/sync?updated_since=` | `televendeur.view_partner_info` |

⚠️ **Correctif (2026-08)** : `/catalog/price-list` a été ajouté après coup — c'est en réalité la pièce **la plus importante** des quatre pour calculer un prix partenaire correct, pas un bonus optionnel. Sans elle, un client qui combine seulement catalogue générique + `price_overrides` + tiers retombe sur le prix générique dès qu'aucun override ni tier n'existe pour la ligne — **ce qui est le cas le plus fréquent** (voir l'ordre de priorité complet ci-dessous).

#### `GET /catalog/sync` — catalogue complet, prix générique

Dump complet des produits actifs (213 dans cet environnement — assez petit pour un aller-retour complet ; `updated_since` en option pour un re-sync allégé). Contrairement à `GET /catalog/products` (§4.1, paginé, prix résolu si `partner_id` fourni), celui-ci n'est **jamais** scopé à un partenaire — c'est du référentiel produit pur, le prix est le générique (`price_list` reste toujours `null` ici). Même forme d'objet produit que §4.1 (marketing, flags, tax_rate, brand inclus) — voir §4.1 pour le détail de chaque champ.
```json
{
  "success": true, "synced_at": "2026-08-09T10:00:00Z",
  "products": [{
    "id": 1, "code": "PSCE0200591", "name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG",
    "short_description": null, "barcode": null, "brand": null,
    "product_page_code": "SCOAA", "unit_id": 1, "unit_name": "PCS",
    "price": 42.5, "price_source": "generic", "price_list": null, "tax_rate": 20,
    "stock_available": 12,
    "marketing": { "is_new": true, "is_featured": false },
    "flags": {
      "is_salable": true, "is_returnable": true, "is_discountable": true, "is_expirable": false,
      "requires_refrigeration": false, "decimal_quantity_allowed": false, "min_quantity_order": 1
    },
    "packagings": [{ "packaging_id": 228, "unit_id": 1, "unit_name": "PCS", "quantity": 1, "is_default": true }],
    "updated_at": "2026-07-23T15:32:32Z"
  }]
}
```
`tax_rate` (nouveau, absent de `GET /catalog/products`) = taux de TVA du produit.

#### `GET /partners/sync` — partenaires complets, crédit + overrides

```json
{
  "success": true, "synced_at": "2026-08-09T10:00:00Z",
  "partners": [{
    "id": 1, "code": "CL00001", "name": "TIMITAR FOOD", "phone": null, "status": "ACTIVE",
    "credit_limit": 100000, "current_balance": 45000, "available_credit": 55000,
    "payment_term_id": null, "price_list_id": 4,
    "price_overrides": [
      { "product_id": 1, "fixed_price": 45.5, "discount_rate": null, "discount_amount": null, "priority": 10, "valid_from": "2026-07-24T13:40:58Z", "valid_to": "2026-08-25T13:40:58Z" }
    ],
    "updated_at": "2026-07-23T15:33:17Z"
  }]
}
```
`price_overrides` = les dérogations de prix **propres à ce partenaire** (table `partner_price_overrides`, filtrées actives à la date du jour) — `fixed_price` prime sur tout le reste s'il est renseigné et `> 0`. `price_list_id` = la liste de prix effective du partenaire (directe ou héritée de son canal), à passer à `GET /catalog/price-list` et `GET /catalog/tiers`.

#### `GET /catalog/price-list?price_list_id=` — prix de base par produit/conditionnement

`price_list_id` vient de `GET /partners/sync`. Renvoie les lignes `price_list_line_details` — **le prix de base réel du partenaire pour chaque produit**, celui que le moteur serveur utilise dans l'écrasante majorité des cas (228 lignes rien que pour la liste `C05` dans cet environnement, contre 0 ligne de tier). Même règle de "ligne active" que `/catalog/tiers` ci-dessous — ne pas mettre en cache long terme.
```json
{ "success": true, "price_list_id": 4, "line_number": 10, "lines": [
  { "product_id": 1, "packaging_id": 228, "is_override": false, "sales_price": 17.03, "min_sales_price": 14.476, "max_sales_price": 19.585 }
] }
```
⚠️ **`is_override` ici est un concept interne à la liste de prix** (cette ligne gagne sur la ligne "standard" du même produit/conditionnement, *au sein de la même liste*) — **à ne pas confondre** avec `price_overrides` de `GET /partners/sync`, qui est un mécanisme différent, propre au partenaire, et de priorité supérieure (voir l'ordre complet ci-dessous). `min_sales_price`/`max_sales_price` bornent le prix final (clamp) si présents.

#### `GET /catalog/tiers?price_list_id=` — paliers de prix par quantité

`price_list_id` vient de `GET /partners/sync`. Renvoie les paliers actifs (`min_qty`/`max_qty`/`tier_price` par produit/conditionnement) pour la ligne de tarif actuellement active de cette liste — **cette "ligne active" change dans le temps** (fenêtre de dates + `closed`), donc ne pas mettre ce résultat en cache long terme, le re-fetcher à chaque reprise de connexion.
```json
{ "success": true, "price_list_id": 4, "line_number": 10, "tiers": [
  { "product_id": 1, "packaging_id": 228, "min_qty": 10, "max_qty": 49, "tier_price": 40.0 }
] }
```
`tiers: []` et/ou `line_number: null` si la liste n'a aucune ligne active à la date du jour — cas normal, pas une erreur.

#### Ordre de priorité réel du prix de base (`PartnerProductPriceResolver`)

Pour reproduire fidèlement le prix côté client, respecter **exactement** cet ordre (du plus prioritaire au moins prioritaire) :

1. **`price_overrides` du partenaire** (`GET /partners/sync`) — si `fixed_price > 0` renseigné, il gagne sur tout le reste ; sinon un `discount_rate`/`discount_amount` s'applique en plus, sur le prix obtenu à l'étape suivante.
2. **Palier de quantité** (`GET /catalog/tiers`) — seulement si un tier existe pour la quantité demandée à ce `packaging_id`. Vide dans la plupart des listes de prix (aucun tier configuré nulle part dans cet environnement).
3. **Ligne "override" de la liste de prix** (`GET /catalog/price-list`, `is_override: true`) — un prix spécifique qui prime sur la ligne standard, *au sein de la même liste*.
4. **Ligne "standard" de la liste de prix** (`GET /catalog/price-list`, `is_override: false`) — **c'est le cas le plus fréquent**, celui qui pricera la grande majorité des lignes de commande.
5. **Repli linéaire** (non-colisage uniquement) — prix de la ligne standard du conditionnement par défaut, divisé par sa quantité, multiplié par la quantité du conditionnement demandé. Le client peut le répliquer avec les données déjà reçues de `/catalog/price-list` (toutes les lignes de conditionnement y sont incluses) — pas d'endpoint séparé nécessaire pour ça.

Ce prix de base est **reproductible fidèlement côté client** en respectant cet ordre. En revanche, **les promotions ne sont pas prédictibles offline dans le cas général** :
- Les promotions à **budget plafonné** (`max_budget`/`current_spent`) sont décrémentées par **chaque commande, sur tous les canaux** (télévendeur, salesperson, POS) — un client offline ne peut pas savoir si le budget a été épuisé par une commande passée ailleurs il y a cinq minutes.
- Les promotions à **cumul mensuel partenaire** dépendent du chiffre d'affaires du mois en cours, recalculé serveur à chaque commande — même problème.
- Seules les promotions simples (fenêtre de dates/jours/heures fixes, sans plafond budgétaire ni cumul) sont fiables à reproduire offline.

**Règle d'implémentation obligatoire** : tout montant calculé côté client (prix, remise, total) doit être affiché comme une **estimation** (ex: badge "≈ estimé", pas un montant définitif) tant que la commande n'a pas été effectivement créée/soumise. Le montant qui compte réellement est toujours celui renvoyé par `POST /orders` ou `GET /orders/{id}/summary` (§5.2-bis) — c'est le back qui a le dernier mot, jamais le cache local. Ne jamais laisser l'agent annoncer un prix "définitif" au client au téléphone à partir du seul calcul local.

---

## 5. Prise de Commande & Dérogation Crédit

**Statut : testé en HTTP réel (création avec pricing tarifaire réel, update, submit, dérogation créée + workflow ADV→CDZ déclenché).**

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Liste partenaires | GET | `/partners?search=&per_page=` | `televendeur.view_partner_info` |
| Recherche partenaires | GET | `/partners/search?q=&limit=` | `televendeur.view_partner_info` |
| Statut crédit partenaire | GET | `/partners/{id}/credit-status` | `televendeur.view_partner_credit` |
| Promotions actives | GET | `/partners/{id}/promotions` | `televendeur.view_promotions` |
| Créer commande | POST | `/orders` | `televendeur.create_order` |
| Modifier commande DRAFT | PUT | `/orders/{id}` | `televendeur.update_order` |
| Soumettre pour préparation | POST | `/orders/{id}/submit` | `televendeur.submit_for_preparation` |
| **Demander dérogation crédit** | POST | `/orders/{id}/request-derogation` | `televendeur.request_derogation` |
| Commandes programmées | GET | `/orders/scheduled?date=` | `televendeur.view_orders` |
| Liste mes commandes | GET | `/orders?status=&date_from=&date_to=&search=` | `televendeur.view_orders` |
| Détail commande | GET | `/orders/{id}` | `televendeur.view_orders` |
| **Mon portefeuille client** | GET | `/portfolio?search=&per_page=` | `televendeur.view_partner_info` |

### 5.0 `GET /portfolio` — Mon portefeuille client

**Statut : testé en HTTP réel.**

Contrepartie self-service, côté agent, de la distribution admin (§7.4) : liste les partenaires que l'admin a assignés à l'agent connecté via `TelevendeurPartnerAssignment` (lecture seule — seul l'admin écrit dans cette table). Même shape que `/partners` (§5) mais filtré au portefeuille de l'agent plutôt que tout le catalogue partenaires, avec en plus `assigned_at`.
```json
{ "success": true, "partners": [{ "id": 2, "code": "CL00002", "name": "EXTRA DINDE", "credit_available": 90000, "assigned_at": "2026-08-08T10:00:00Z" }], "pagination": { "...": "..." } }
```
**Écran recommandé** : onglet "Mon portefeuille" sur le dashboard (§8), liste filtrable, clic → lance un appel spontané (`POST /visits/start-adhoc`) pré-rempli avec ce partenaire.

### 5.1 `POST /orders` — Création
Body :
```json
{
  "partner_id": 2,
  "items": [{ "product_id": 1, "quantity": 2 }],
  "notes": "optionnel",
  "payment_term_id": null,
  "scheduled_for": null
}
```
⚠️ **Important pour l'UI** : le champ `items.*.price` existe encore côté API (rétro-compatibilité) mais **n'est plus utilisé pour le calcul** — le serveur résout systématiquement le prix via le moteur tarifaire officiel (grille/tier/override du partenaire, promotions incluses). L'UI n'a donc pas besoin d'envoyer de prix ; elle peut *afficher* un prix indicatif côté catalogue produit avant validation, mais le prix final vient toujours de la réponse serveur (`order.final_total`).

✅ **La commande est toujours créée en `DRAFT`** — `POST /orders` n'a jamais soumis/confirmé quoi que ce soit automatiquement, c'est `POST /orders/{id}/submit` (§5.3) qui fait passer la commande dans le circuit ADV. L'agent peut donc composer, modifier (`PUT /orders/{id}`, §5.2) et consulter le récap complet (§5.1-bis ci-dessous) autant de fois qu'il veut avant de soumettre — rien n'est irréversible avant l'appel à `/submit`.

Réponse (201) :
```json
{
  "success": true,
  "order": {
    "id": 5, "bc_number": "FD98BC-000001", "status": "draft", "status_label": "Draft",
    "partner": { "id": 2, "code": "CL00002", "name": "EXTRA DINDE" },
    "scheduled_for": null,
    "total_amount": 17.03, "promotion_discount": 0, "final_total": 17.03,
    "items_count": 1, "created_at": "..."
  }
}
```

### 5.2 `PUT /orders/{id}` — Modification
Uniquement pour les commandes `DRAFT` **créées par l'agent lui-même** (403 sinon — garde-fou anti-partage de poste). Body identique à la création (`items`, `notes`).

### 5.2-bis `GET /orders/{id}/summary` — Récapitulatif avant soumission

**Statut : testé en HTTP réel.**

Écran de relecture pensé pour être affiché juste avant `POST /orders/{id}/submit` (§5.3) : détail ligne par ligne (prix HT/TTC, quel remise/promotion s'applique, montant TVA) + totaux commande. Contrairement à `GET /orders/{id}` (§5, qui ne renvoie que `product_id`/`price`/`subtotal`), cet endpoint expose la décomposition fiscale complète déjà calculée et persistée par le moteur de tarification/promotions — **aucun recalcul n'est fait**, ce qui garantit que le récap correspond exactement à ce qui a été réellement facturé, sans risque de divergence avec une seconde logique de calcul côté front.

Mêmes garde-fous que `GET /orders/{id}` : 403 si la commande n'appartient pas à l'agent connecté.

```json
{
  "success": true,
  "order_id": 114, "bc_number": "POS001BC-000003", "status": "draft",
  "partner": { "id": 1484, "code": "MARJANE-HOLDING", "name": "MARJANE HOLDING" },
  "payment_term": null,
  "items": [
    {
      "product_id": 1, "product_code": "PSCE0200591", "product_name": "JAVANA PRO BOUILLON EN POUDRE POISSON 1KG",
      "quantity": 3,
      "unit_price_ht": 83.33, "unit_price_ttc": 100, "tax_rate": 20,
      "promotion": {
        "applied": false, "codes": [], "labels": [],
        "discount_amount": 0, "unit_price_ttc_after_discount": 100
      },
      "tva_amount": 50.01, "line_total_ht": 250, "line_total_ttc": 300
    }
  ],
  "totals": {
    "sub_total_ht": 250, "tva_amount": 50,
    "original_total_ttc": 300, "promotion_discount": 0,
    "final_total_ttc": 300, "payable_amount": 300
  }
}
```
- `promotion.applied` : `true` dès qu'une remise/promotion a réduit le prix de la ligne (`promotion_discount > 0`). `codes` = codes promo bruts (`promotion_codes` stocké sur la ligne) ; `labels` = noms lisibles résolus via la table `promotions` (retombe sur le code si le nom n'est pas trouvé).
- `totals.original_total_ttc` = total TTC **avant** toute remise (prix catalogue × quantités) ; `totals.final_total_ttc` = total TTC **après** remise, c'est le montant que la commande va réellement facturer (identique à `payable_amount` sauf droit de timbre éventuel).

**Écran recommandé** : modale/étape "Récapitulatif" entre la composition du panier et le bouton "Soumettre" — tableau ligne par ligne avec badge "Promo appliquée" quand `promotion.applied = true` (afficher le nom de la promo + le montant de la remise), puis un bloc totaux (sous-total HT, TVA, remise totale, total TTC à payer) bien visible avant confirmation.

### 5.3 `POST /orders/{id}/submit` — Soumission
Deux issues possibles :

**a) Crédit OK** → 200, `bc_status` passe à `submitted`, entre dans le workflow ADV standard.

**b) Crédit dépassé** → **422**, ne bloque pas définitivement :
```json
{
  "success": false,
  "message": "Credit limit exceeded. Order requires ADV approval.",
  "credit_validation": {
    "can_proceed": false,
    "credit_available": 50000,
    "order_amount": 60834,
    "credit_after_order": -10834,
    "warnings": [{ "type": "credit_exceeded", "severity": "error", "message": "...", "excess_amount": 10834 }],
    "requires_derogation": true
  },
  "next_step": "Order will be sent to ADV for credit derogation approval"
}
```
→ **C'est le signal pour afficher le bouton "Demander Dérogation ADV"**. Ne pas traiter ce 422 comme une erreur bloquante classique : c'est un état métier normal.

### 5.4 `POST /orders/{id}/request-derogation` — Demande de dérogation
Body :
```json
{ "justification": "Texte d'au moins 20 caractères expliquant la demande." }
```
**Header obligatoire** : `X-Idempotency-Key: <uuid généré côté client>` — génère un nouvel UUID à chaque nouvelle tentative de demande (pas à chaque clic si c'est un retry du même clic réseau — voir note ci-dessous).

Réponse (200) :
```json
{
  "success": true,
  "message": "Credit derogation requested — pending ADV/CDZ review",
  "order": { "...": "...", "status": "pending_derogation" },
  "output": { "derogation_id": 1, "excess_amount": 10834, "status": "pending_derogation" }
}
```

Réponse si refusé par la politique métier (ex: partenaire pas en mode crédit, justification trop courte, dérogation déjà en attente) : **422** avec `{ "success": false, "message": "...", "decision": { "constraints": [...] } }` — exploiter `decision.constraints[0].reason` pour afficher un message précis à l'agent plutôt que le message générique.

**Note idempotence** : si l'UI relance automatiquement la requête après un timeout réseau (même clic utilisateur), renvoyer la **même** `X-Idempotency-Key` pour éviter une double dérogation ; générer une **nouvelle** clé uniquement pour une nouvelle action utilisateur explicite.

Après succès : la commande passe en `pending_derogation` et entre dans la chaîne d'approbation à **2 niveaux : Chef ADV (ou Admin) → Directeur Commercial (ou Admin)** — le télévendeur n'a plus d'action à faire, il attend la décision (visible via `GET /orders/{id}`, `bc_status` ne change qu'après l'approbation du niveau 2).

⚠️ **Correction (2026-08)** : une version précédente de ce doc décrivait cette chaîne comme pilotée par le moteur de workflow générique (`workflow_task_templates`, "chaîne dynamique ADV→CDZ configurable en base"). **C'était inexact** : l'endpoint d'approbation réel (`ApproveDerogationDecision`/`RejectDerogationDecision`) ne consulte pas du tout `workflow_task_templates` — c'est un statut à plat sur `CreditDerogation` (`pending` → `pending_l2` → `approved`/`rejected`), gardé par un rôle en dur dans `config/decisions.php` (`allowed_roles`) et dans la classe Decision elle-même. Le 3ᵉ niveau ajouté (Directeur Commercial) est donc du **vrai code** sur ces deux classes partagées avec le canal Salesperson, pas une simple ligne de config — voir `App\Decisions\Adv\ApproveDerogationDecision` pour le détail des deux étapes. Un 4ᵉ niveau nécessiterait de nouveau une modification de ces classes, pas juste une insertion en base.

**Écran recommandé** : sur le 422 de `/submit`, afficher une modale d'alerte "Plafond de crédit dépassé de X MAD" avec un champ justification (min 20 caractères, validation live) et le bouton "Demander Dérogation ADV" → appelle `/request-derogation`. Après succès, remplacer le bouton "Soumettre" par un badge "En attente de validation ADV/CDZ" (lecture seule tant que `bc_status = pending_derogation`).

### 5.5 `GET /orders/scheduled?date=` — Commandes programmées

**Statut : testé en HTTP réel.**

"Commande programmée" = une commande DRAFT créée aujourd'hui pour une **date d'exécution future** (ex: "créer maintenant, revoir/soumettre lundi"). C'est une brique **volontairement minimaliste** : le back ne fait rien d'automatique à la date échue — pas de soumission auto, pas de notification auto. C'est une simple liste de rappel/filtre que l'agent consulte et traite manuellement, exactement comme une commande DRAFT normale.

Pour créer une commande programmée, ajouter `scheduled_for` (date, `>= today`) au body de `POST /orders` (§5.1) :
```json
{ "partner_id": 2, "items": [{ "product_id": 2, "quantity": 1 }], "scheduled_for": "2026-07-25" }
```
L'objet `order` retourné inclut alors `"scheduled_for": "2026-07-25"` (sinon `null`).

`GET /orders/scheduled?date=2026-07-25` renvoie toutes les commandes DRAFT de l'agent programmées pour cette date :
```json
{ "success": true, "date": "2026-07-25", "orders": [ { "id": 104, "bc_number": "TV01BC-000001", "scheduled_for": "2026-07-25", "status": "draft", ... } ] }
```
`date` optionnel, défaut = aujourd'hui.

**Écran recommandé** : un onglet "Programmées" sur le dashboard (§7) listant les commandes du jour à traiter, avec bouton direct vers l'écran de soumission (§5.3) pour chaque ligne.

### 5.6 Flux de traitement configurable — `STANDARD_FULL` vs `SHORT_CHR`

**Statut : Phase 1 + Phase 2 livrées et testées en HTTP réel de bout en bout (commande → `confirmed` → mission + BL + allocation auto-créées avec chauffeur/véhicule auto-sélectionnés). Pas d'écran UI associé, rien à construire côté agent — le comportement est 100% invisible/transparent pour lui.**

Certaines branches (typiquement CHR/PME à faible volume) peuvent sauter la revue manuelle ADV **et** l'étape dispatcher pour les commandes télévendeur. C'est **piloté 100% par configuration**, sans aucun `switch` PHP :

- `STANDARD_FULL` (défaut, comportement actuel inchangé) : Télévendeur → ADV → Dispatcher → Magasinier → Livreur.
- `SHORT_CHR` : la commande passe directement de `submitted` à `confirmed` dès que le crédit est OK, **puis** une mission de livraison est auto-créée (un chauffeur et un véhicule sont auto-sélectionnés — voir plus bas), la BL est auto-générée et allouée, et le BP est auto-généré si du stock réel est disponible. Le magasinier retrouve directement un BP prêt, sans aucune action Dispatcher.

**Activation** : une `configuration_setting` scopée `App\Models\Branch`, clé `order.workflow_mode`, valeur `STANDARD_FULL` ou `SHORT_CHR` (via `POST /api/backend/access-control/configuration-settings/bulk` avec `configurable_type=App\Models\Branch`, `configurable_id=<branch_id>`). Aucune branche n'est en `SHORT_CHR` par défaut — il faut l'activer explicitement par branche.

**Garde-fous** (ordre de priorité des règles sur l'étape `submitted`, non contournables par `SHORT_CHR`) :
1. Une demande d'annulation en attente est toujours traitée en premier.
2. **Le crédit dépassé déclenche toujours `pending_derogation`**, quel que soit le mode — `SHORT_CHR` ne bypass jamais la dérogation crédit (§5.4).
3. Seules les commandes créées par le canal télévendeur (`created_by_role = televendeur`) sont éligibles — les commandes salesperson/POS dans la même branche suivent leur propre chaîne de règles, inchangée.

**Sélection automatique chauffeur/véhicule (Phase 2)** : aucun mécanisme d'auto-assignation n'existait dans le code avant cette fonctionnalité (`rider_id`/`vehicle_id` sont partout ailleurs une saisie manuelle dispatcher explicite). Heuristique introduite, volontairement simple :
- **Chauffeur** : rôle `driver` rattaché à la même branche, actif, avec le moins de missions actives en cours (least-loaded).
- **Véhicule** : premier véhicule `available()` de la branche (statut actif, sans mission concurrente).
- **Si aucun chauffeur ou véhicule disponible** : la commande reste `confirmed`, sans mission — un dispatcher la reprend manuellement, exactement le même filet de sécurité que le mécanisme "Mission Vide" existant.
- Ce n'est **pas** un optimiseur de tournée/capacité réel — juste un répartiteur de charge basique.

⚠️ **Dépendance de données pour le BP** : la génération du BP dépend de stock réel positionné sur l'emplacement dépôt de la branche (même moteur d'allocation que le flux standard, `BlAllocationService`/`MissionPreparationGeneratorService`, inchangés). Sans stock réel configuré, l'allocation est à 0, la mission reste `draft` avec sa BL mais sans BP (comportement documenté et volontaire du moteur — "fully backlogged", pas un bug). Vérifier que la branche a un emplacement dépôt + du stock avant d'activer `SHORT_CHR` en production.

### 5.7 Retours clients

**Statut : testé en HTTP réel (création, isolation cross-user).**

Réutilise le système de retours existant (`PartnerReturn`/`ReturnActivityService`, le même que le canal Salesperson) — **retours commerciaux (différés) uniquement**, pas de "retour immédiat" (ce concept suppose une livraison physique en cours devant l'initiateur, ce qu'un agent au téléphone n'a jamais).

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Liste mes retours | GET | `/returns?status=` | `televendeur.manage_returns` |
| Détail retour | GET | `/returns/{id}` | `televendeur.manage_returns` |
| Créer un retour | POST | `/returns` | `televendeur.manage_returns` |

Body `POST /returns` :
```json
{
  "partner_id": 2,
  "delivery_note_id": null,
  "notes": "optionnel",
  "items": [
    { "product_id": 1, "return_quantity": 2, "condition": "good", "reason": "COMMERCIAL_RETURN", "unit_price": 17.03 }
  ]
}
```
`condition` : `good|damaged|expired`. `reason` : `DAMAGED|PRICING_ERROR|COMMERCIAL_RETURN|EXPIRED|QUALITY_ISSUE`. Réponse 201 : `{ "success": true, "return": { "id": 1, "return_number": "TV01RET-000001", "status": "PENDING_DIRECTION_APPROVAL", "return_type": "commercial" } }`.

Entre en `PENDING_DIRECTION_APPROVAL` — même workflow d'approbation que tout autre retour commercial (direction approuve → un chauffeur est assigné pour la collecte). Le télévendeur n'a plus d'action après création ; suivre le statut via `GET /returns/{id}`.

⚠️ **Prérequis de configuration (déploiement)** : la résolution du "profil mobile" pour les retours passe par un mécanisme **différent** de celui utilisé ailleurs dans ce module (`ConfigurationSetting`/`MobileProfileResolver`, §0) — `ReturnActivityService` lit `users.access_profile_id` → `AccessProfile.settings.mobile.profile.kind` directement. Un `AccessProfile` "Télévendeur Profile" (`TELE_SELLING`) est désormais seedé (`TelevendeurPreparateurRoleSeeder`), mais **chaque utilisateur télévendeur doit encore se le voir assigné explicitement** (`users.access_profile_id`) — ce n'est pas automatique à l'attribution du rôle. Sans ça, `POST /returns` renvoie 403 même avec la permission Spatie correcte.

### 5.8 Auto-soumission des commandes programmées

**Statut : testé (commande CLI, exécution réelle contre données seedées).**

`scheduled_for` (§5.5) n'est plus un simple filtre de rappel : une commande Artisan `televendeur:auto-submit-scheduled-orders` tourne quotidiennement à 07h00 (`app/Console/Kernel.php`) et soumet automatiquement toute commande DRAFT télévendeur dont `scheduled_for` est atteint — **même vérification crédit que la soumission manuelle** (§5.3). Si le crédit est dépassé, la commande reste en DRAFT (pas de dérogation auto-générée — une justification ne peut pas être fabriquée automatiquement) ; l'agent la voit toujours dans `GET /orders/scheduled?date=` et la soumet/déroge manuellement.

Aucun changement de contrat pour l'UI — c'est un comportement serveur pur. L'agent verra simplement `bc_status` avancer sans avoir cliqué "Soumettre" pour les commandes dont la date est passée.

---

## 6. Devis B2B

**Statut : testé en HTTP réel (création avec pricing réel, envoi, conversion en commande, re-conversion bloquée, isolation cross-user).**

Entité **réellement distincte** de `Order` — un devis n'écrit **aucune ligne** dans `orders`/`order_products` tant qu'il n'est pas converti.

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| Liste mes devis | GET | `/devis?status=` | `televendeur.manage_quotes` |
| Détail devis | GET | `/devis/{id}` | `televendeur.manage_quotes` |
| Créer devis | POST | `/devis` | `televendeur.manage_quotes` |
| Modifier lignes (draft/sent) | PUT | `/devis/{id}` | `televendeur.manage_quotes` |
| Envoyer (draft → sent) | POST | `/devis/{id}/send` | `televendeur.manage_quotes` |
| **Convertir en commande** | POST | `/devis/{id}/convert` | `televendeur.manage_quotes` + `televendeur.create_order` |

### Cycle de vie (`status`)
`draft` → `sent` → `converted` (via `/convert`, à tout moment depuis draft ou sent) ; ou `draft`/`sent` → `expired` (automatique, seulement si `expires_at` était fourni et dépassé — job de fond, pas d'action UI requise). Une fois `converted` ou `expired`, le devis est **figé** (`PUT`/`send`/`convert` renvoient 422).

### Objet `devis`
```json
{
  "id": 1,
  "quote_number": "DEV-20260723-PXWX4Q",
  "user_id": 44,
  "partner_id": 2,
  "status": "draft",
  "sub_total": "42.58",
  "tax_amount": "8.51",
  "total_amount": "51.09",
  "notes": "Devis test",
  "expires_at": null,
  "converted_order_id": null,
  "items": [
    { "id": 1, "product_id": 1, "quantity": "3.000", "price": "17.0300", "line_total_ttc": "51.09", "product": { "id": 1, "name": "...", "code": "..." } }
  ]
}
```
Le prix (`price`) vient du **même moteur tarifaire officiel** que la prise de commande (§5.1, `PartnerProductPriceResolver`) — pas de champ prix côté client, la logique est identique à `POST /orders`.

### 6.1 `POST /devis` — Création
Body :
```json
{
  "partner_id": 2,
  "items": [{ "product_id": 1, "quantity": 3 }],
  "notes": "optionnel",
  "expires_at": "2026-08-01T00:00:00Z"
}
```
`expires_at` optionnel (doit être dans le futur si fourni). Réponse 201 avec l'objet `devis` complet (items + produit chargés).

### 6.2 `PUT /devis/{id}` — Modifier les lignes
Body : `{ "items": [...] }` — remplace intégralement les lignes existantes (mêmes règles de pricing qu'à la création). 422 si le devis est déjà `converted`/`expired`.

### 6.3 `POST /devis/{id}/send`

**Statut : testé en HTTP réel (gating + rendu du template email vérifiés ; envoi SMTP réel non testable dans cet environnement — `MAIL_USERNAME`/`MAIL_PASSWORD`/`MAIL_ENCRYPTION` non configurés, comportement inchangé/identique à `OrderMail` ailleurs dans l'app).**

Aucun body. Passe `draft → sent` **et** envoie un email récapitulatif au partenaire (si son email est renseigné et que le mailer est configuré sur l'environnement). Réponse :
```json
{
  "success": true,
  "quote": { "...": "...", "status": "sent" },
  "email": { "sent": true, "reason": null }
}
```
Si l'email n'est pas parti (`email.sent: false`), `email.reason` explique pourquoi — `"Partner has no email on file."`, `"Mail is not configured on this environment."`, ou `"Delivery failed — see server logs."` Le changement de statut `draft → sent` **réussit toujours**, même si l'email échoue — ne jamais bloquer l'UI sur `email.sent`, l'utiliser uniquement pour un message informatif ("Devis envoyé" vs "Devis marqué envoyé — email non délivré, vérifier l'adresse du partenaire").

### 6.4 `POST /devis/{id}/convert` — Conversion en commande réelle
Aucun body. Crée une **vraie** `Order` (mêmes règles que `POST /orders` : `shop_id`, `bc_number` via numérotation officielle, `bc_status: draft`, entre dans le workflow `bc_validation` standard). Réponse :
```json
{
  "success": true,
  "message": "Quote converted to order",
  "order_id": 103,
  "bc_number": "ERPBC-000001",
  "quote": { "...": "...", "status": "converted", "converted_order_id": 103 }
}
```
Après conversion, rediriger l'UI vers l'écran commande (§5) avec `order_id` — la suite du flow (submit, dérogation éventuelle) est identique à une commande créée directement.

- 422 si déjà `converted` : `"This quote was already converted to an order."`
- 422 si `expired` : `"This quote has expired and can no longer be converted."`

**Écran recommandé** : liste "Mes Devis" (filtrable par statut) → fiche devis avec bouton "Envoyer" (draft) et bouton "Convertir en commande" (draft/sent) → après conversion, bascule automatique vers l'écran de suivi de commande.

---

## 7. Module Admin / Superviseur (Backoffice — PAS un écran télévendeur)

**Statut : testé en HTTP réel (lecture + écriture schedules, bulk avec succès partiel, delete avec garde-fou historique, lecture + écriture assignments, monitoring sessions + KPIs, isolation confirmée : un télévendeur reçoit 403 sur ces routes).**

⚠️ **Ceci est un écran distinct, réservé aux managers/superviseurs call-center — pas au télévendeur lui-même.** Le télévendeur ne planifie pas son propre semainier et ne s'auto-assigne pas de portefeuille client ; c'est l'admin qui le fait pour lui. D'où une **base URL et un rôle différents** de tout le reste de ce document :

- **Base URL** : `/api/backend/admin/telesales/...` (noter `admin/` — différent de `/api/backend/telesales/...` utilisé partout ailleurs dans ce doc)
- **Rôle requis** : `admin` ou `root` **uniquement** — `role:admin|root` au niveau middleware. Un utilisateur avec seulement le rôle `televendeur` reçoit un 403 (`"User does not have the right roles."`), vérifié en test.
- Permissions Spatie dédiées : `telesales-admin.manage_schedules`, `telesales-admin.manage_assignments`, `telesales-admin.view_monitoring` (jamais accordées au rôle `televendeur`).

| Action | Méthode | Endpoint | Permission |
|---|---|---|---|
| **Lister le semainier d'équipe** | GET | `/schedules?user_id=&date_from=&date_to=` | `telesales-admin.manage_schedules` |
| Assigner un appel | POST | `/schedules` | `telesales-admin.manage_schedules` |
| Injection semainier en masse | POST | `/schedules/bulk` | `telesales-admin.manage_schedules` |
| Supprimer un créneau | DELETE | `/schedules/{id}` | `telesales-admin.manage_schedules` |
| **Lister la répartition du portefeuille** | GET | `/assignments?user_id=` | `telesales-admin.manage_assignments` |
| Distribuer un portefeuille | POST | `/assignments` | `telesales-admin.manage_assignments` |
| Sessions en direct | GET | `/monitoring/sessions` | `telesales-admin.view_monitoring` |
| KPIs d'équipe | GET | `/monitoring/kpis?date_from=&date_to=` | `telesales-admin.view_monitoring` |

### 7.0 `GET /schedules?user_id=&date_from=&date_to=` — Semainier d'équipe (lecture)

**Statut : testé en HTTP réel (filtres user_id et dates, pagination, isolation).**

Contrepartie lecture de §7.1/§7.2 — sans elle, l'écran admin ne pouvait afficher que ce qui venait d'être créé dans la session navigateur en cours (rien ne survivait à un refresh). Liste les créneaux `is_planned: true` (le "semainier" au sens strict — inclut les créneaux encore à faire **et** déjà qualifiés, pour permettre un audit complet de la semaine, contrairement à `GET /planning` côté agent qui ne montre que le non-qualifié). Tous les filtres sont optionnels ; `date_from`/`date_to` filtrent sur `scheduled_at`.
```json
{ "success": true, "visits": { "data": [ { "id": 6, "user_id": 57, "partner_id": 405, "scheduled_at": "2026-07-27T09:00:00Z", "outcome": null, "partner": { "code": "CL00405", "name": "boucherie douha" }, "user": { "name": "Jamila Télévendeur" } } ], "total": 3, "current_page": 1, ... } }
```
`partner`/`user` sont déjà chargés (code/nom/téléphone pour le partenaire) pour éviter un aller-retour supplémentaire côté front.

**Écran recommandé** : tableau semainier filtrable par agent (dropdown) et par plage de dates (sélecteur semaine), une ligne = un créneau, badge "Qualifié"/"À faire" selon `outcome`.

### 7.1 `POST /schedules` — Assigner un appel à un agent
Body :
```json
{ "user_id": 57, "partner_id": 2, "scheduled_at": "2026-07-27 10:00:00", "notes": "optionnel" }
```
Réutilise exactement le même modèle `TeleVisit` que le semainier self-service (§3) — juste créé par l'admin **pour** l'agent (`user_id` cible) plutôt que par l'agent pour lui-même. 422 si `user_id` ne porte pas le rôle `televendeur` : `"User #57 does not have the télévendeur role."` Réponse 201 avec l'objet `visit` (voir §3 pour le format).

### 7.2 `POST /schedules/bulk` — Semainier d'équipe en masse
Body :
```json
{ "entries": [
  { "user_id": 57, "partner_id": 2, "scheduled_at": "2026-07-27 10:00:00" },
  { "user_id": 58, "partner_id": 3, "scheduled_at": "2026-07-27 11:00:00", "notes": "optionnel" }
] }
```
Max 500 entrées par appel. **Succès partiel supporté** — une ligne invalide (mauvais partenaire, user sans rôle télévendeur, etc.) n'annule pas les autres :
```json
{ "success": false, "created_count": 2, "error_count": 1, "created": [{ "index": 0, "visit_id": 4 }, { "index": 1, "visit_id": 5 }], "errors": [{ "index": 2, "message": "No query results for model [App\\Models\\Partner] 999999" }] }
```
HTTP **201** si `error_count = 0`, sinon **207** (Multi-Status) — toujours lire `created_count`/`error_count`, ne pas se fier uniquement au code HTTP. `index` correspond à la position dans le tableau `entries` envoyé, pour que l'UI puisse surligner la ligne fautive dans un import Excel/CSV par exemple.

### 7.3 `DELETE /schedules/{id}` — Retirer un créneau
Aucun body. **Garde-fou testé** : si l'appel a déjà eu lieu et a un `outcome` enregistré, refus en 422 (`"This call already has a recorded outcome — it is history, not a pending schedule slot."`) — un créneau qualifié est un historique d'appel, pas un slot de planning, on ne le supprime pas. Seuls les créneaux encore `is_planned` et non qualifiés sont supprimables. Pas d'endpoint "réassigner" dédié : réassigner = `DELETE` puis nouveau `POST /schedules`.

### 7.3-bis `GET /assignments?user_id=` — Répartition du portefeuille (lecture)

**Statut : testé en HTTP réel (filtre user_id, isolation).**

Contrepartie lecture de §7.4 — sans elle, impossible d'auditer "quel partenaire est chez quel agent" une fois la session navigateur qui a fait le `POST` terminée. `user_id` optionnel (filtre sur l'agent). `partner`/`user`/`assignedBy` sont déjà chargés (code/nom) pour éviter un aller-retour supplémentaire côté front.
```json
{ "success": true, "assignments": { "data": [ { "id": 4, "partner_id": 405, "user_id": 57, "assigned_at": "2026-07-24T14:19:29Z", "partner": { "code": "CL00405", "name": "boucherie douha" }, "user": { "name": "Jamila Télévendeur" }, "assigned_by": { "id": 2, "name": "Admin Opérations" } } ], "total": 3, ... } }
```

### 7.4 `POST /assignments` — Distribution de portefeuille client
Body :
```json
{ "user_id": 57, "partner_ids": [2, 3, 4] }
```
Un partenaire appartient **au portefeuille d'un seul télévendeur à la fois** (contrainte unique sur `partner_id`) — réassigner un partenaire déjà attribué à un autre agent déplace simplement la ligne, pas de doublon. 422 si `user_id` n'a pas le rôle `televendeur`. Réponse 201 :
```json
{ "success": true, "message": "3 partner(s) assigned to Jamila Télévendeur", "assignments": [{ "partner_id": 2, "user_id": 57, "assigned_by": 2, "assigned_at": "...", "id": 1 }, ...] }
```
`assigned_by` = l'id de l'admin connecté (traçabilité). Le télévendeur peut consulter son propre portefeuille en lecture seule via `GET /api/backend/telesales/portfolio` (§5.0, self-service) ; l'admin garde ici la vue et l'écriture sur l'ensemble de l'équipe.

### 7.5 `GET /monitoring/sessions` — Vue temps réel des agents
```json
{ "success": true, "sessions": [
  { "session_id": 3, "user": { "id": 57, "name": "Jamila Télévendeur", "email": "jamila@foodplus.ma" },
    "status": "active", "started_at": "2026-07-23T20:01:44.000000Z", "paused_at": null,
    "total_paused_seconds": 0, "elapsed_seconds": 5 }
] }
```
Ne liste que les sessions `active`/`paused` (agents "en ligne" au sens large). `elapsed_seconds` est **déjà calculé côté serveur** (temps écoulé moins les pauses, jusqu'à `paused_at` si en pause, jusqu'à maintenant si active) — pratique pour un premier rendu sans dépendre du chrono JS, mais l'UI peut aussi reconstruire son propre chrono live à partir de `started_at`/`total_paused_seconds`/`status` pour l'incrément en temps réel.

**Écran recommandé** : tableau de bord superviseur avec une ligne par agent en ligne, badge Active (vert) / Paused (orange), chrono live, tri par ancienneté de connexion.

### 7.6 `GET /monitoring/kpis?date_from=&date_to=`
`date_from`/`date_to` optionnels — défaut : semaine en cours (`startOfWeek()` → aujourd'hui).
```json
{
  "success": true,
  "period": { "from": "2026-07-01", "to": "2026-07-31" },
  "outcomes": { "ORDER_TAKEN": 12, "UNAVAILABLE": 3, "COMPLAINT": 1, "NO_ANSWER": 8, "BUSY": 2, "RESTOCK_NEEDED": 0 },
  "total_qualified_calls": 26,
  "conversion_rate_percent": 46.15,
  "sales_by_agent": [{ "user_id": 57, "user_name": "Jamila Télévendeur", "orders_count": 5, "total_sales": 2450.75 }]
}
```
`conversion_rate_percent` = `ORDER_TAKEN / total_qualified_calls × 100` sur la période. `sales_by_agent` ne compte que les commandes `created_by_role = televendeur` dont `order_date` tombe dans la période, triées par CA décroissant.

**Écran recommandé** : dashboard supervision avec graphique répartition des `outcomes` (camembert), un KPI "taux de conversion" en évidence, et un classement agents par CA.

---

## 8. Récapitulatif des écrans (ordre suggéré)

1. **Dashboard Télévendeur** — bandeau session (§2) + KPIs du jour (nb appels, nb commandes, calculés côté front à partir de `/visits?date_from=today`) + onglet "Programmées" (§5.5) + raccourci "Appel libre".
2. **Semainier / Planning** — liste de `/planning`, bouton "Planifier un appel" (modale partenaire + date/heure → `POST /visits`).
3. **Fiche Télé-visite** — notes libres + 6 boutons de qualification (§3.4). Le bouton "Prise de commande" navigue vers l'écran 5 en gardant le `visit_id` en mémoire pour le relier après coup ; le bouton "Devis" navigue vers l'écran 6.
4. **Catalogue / Master Data** (§4) — recherche produit en temps réel pendant l'appel (cross-sell, stock, prix partenaire), accessible depuis le dashboard et depuis l'écran Prise de Commande (recherche produit inline).
5. **Prise de Commande** — recherche partenaire (`/partners/search`) → catalogue produits/quantités (§4.1, prix + stock déjà affichés) → `POST /orders` (avec `scheduled_for` optionnel) → `POST /orders/{id}/submit` → si 422 crédit, modale dérogation (§5.4) → au retour sur l'écran 3, appeler `/visits/{id}/complete` avec `outcome: ORDER_TAKEN` et `order_id`.
6. **Devis** — liste + fiche + conversion (§6), rebranche vers l'écran 5 après conversion.
7. **Mon portefeuille** (§5.0) — liste des partenaires assignés par l'admin, clic → appel spontané.
8. **Retours clients** (§5.7) — liste `/returns` + fiche création (partenaire, lignes produit, motif/condition), lecture seule après création.

---

## 9. Ce qui N'EST PAS dans ce sprint (ne pas construire d'écran pour)

- **SMS pour l'envoi de devis** (§6.3) : seul l'email a été branché (mailer existant de l'app). SMS nécessiterait le choix/l'intégration d'une passerelle SMS, non disponible aujourd'hui.
- **Retour immédiat depuis télévendeur** (§5.7) : seul le retour commercial (différé, avec approbation direction) est exposé — un retour "immédiat" suppose une livraison physique en cours devant l'initiateur, ce qu'un agent au téléphone n'a jamais.
- **4ᵉ niveau de validation sur la dérogation** : la chaîne est maintenant à 2 niveaux réels (Chef ADV → Directeur Commercial, §5.4) — un niveau supplémentaire nécessiterait à nouveau une modification de `ApproveDerogationDecision`/`RejectDerogationDecision`, pas une simple config.
- **Namespace/URL du module Admin (§7)** : `/api/backend/admin/telesales/...`, avec `role:admin|root` — ne pas le confondre avec `/api/backend/telesales/...` (agent, `role:televendeur|admin|root`). Les deux existent en parallèle, ce n'est pas une typo.

⚠️ **Bugs préexistants découverts en marge de ce sprint, non corrigés (hors périmètre)** — à garder en tête si un écran ADV/Direction interagit avec la dérogation :
- `config/decisions.php` et `ApproveDerogationDecision`/`RejectDerogationDecision` référençaient un rôle `chef_adv` qui **n'existe pas** dans les rôles Spatie réels de cet environnement (probablement `cdz`, jamais confirmé) — en pratique, seul `admin` pouvait valider le niveau 1 avant ce sprint. Non corrigé ici (rôle exact incertain, décision à prendre séparément).
- L'idempotency-key (`X-Idempotency-Key`, §5.4) dépend d'un cache Redis (`Class "Redis" not found` observé en environnement de dev Windows sans extension Redis) — fonctionnera normalement en environnement de prod/staging avec Redis installé, mais bloque `POST /orders/{id}/request-derogation` en local sans lui.

---

## 10. Historique des changements

- **2026-08** : déplacement complet du routing `routes/pos.php` (`/api/pos/televendeur/...`) → `routes/backend/telesales.php` (`/api/backend/telesales/...`). Le Télévendeur est un module backoffice (call-center), pas un module POS. Renommages associés : `/session/*` → `/sessions/*`, `/visits/planning` → `/planning`, `/visits/schedule` → `POST /visits`, `/quotes/*` → `/devis/*`. Les noms de permissions Spatie (`televendeur.*`) et le comportement des endpoints sont inchangés — seuls le préfixe d'URL et quelques noms de segments ont changé.
- **2026-08** : ajout §4 Master Data & Catalogue (`/catalog/products`, `/catalog/pages`, `/master-data`) pour la consultation temps réel pendant l'appel. Deux bugs de scoping/colonne corrigés au passage : `ProductPage`/`PaymentTerm`/`Product` portent un scope global `data_rules` pensé pour les profils SFA terrain (jamais configuré pour `televendeur` → résultats vides sans le bypass `withoutDataScoping()`) ; la résolution de stock par branche utilisait `stocks.branch_code`, colonne inexistante (`branch_id` est la vraie colonne) — bug dormant présent aussi dans le catalogue SFA, jamais exercé côté salesperson (entrepôt/van presque toujours résolu), révélé ici car les agents call-center n'ont typiquement ni van ni entrepôt configuré.
- **2026-08** : contrôleurs déplacés de `App\Http\Controllers\POS\*` vers `App\Http\Controllers\Backend\TeleSales\*` (cohérence avec l'URL `/api/backend/telesales/...` — aucun changement de comportement/URL pour le front).
- **2026-08** : ajout §7 Module Admin/Superviseur (`/api/backend/admin/telesales/...` — semainier admin, distribution de portefeuille, monitoring live + KPIs d'équipe). Nouvelle table `televendeur_partner_assignments`. Nouvelles permissions `telesales-admin.*`, accordées à `admin`/`root` uniquement, jamais à `televendeur`.
- **2026-08 (Phase 1 — bypass config pur)** : ajout §5.6 flux `STANDARD_FULL`/`SHORT_CHR`. Nouvelle règle `workflow_transition_rules` (priorité 12, entre le check crédit-dépassé priorité 10 et l'auto-confirm standard priorité 15+) gérée par `App\Constraints\ShortChrModeConstraint`, activable par branche via `configuration_settings` (clé `order.workflow_mode`). Explicitement **hors périmètre** de cette passe (décision utilisateur) : création automatique du BP magasinier et assignation directe du chauffeur pour le flux court — ces étapes restent 100% manuelles pour l'instant, seul le routage de statut ADV est bypassable. Bugs préexistants découverts et corrigés en chemin : `orders.branch_code` n'était pas une colonne réelle (`Order::$fillable` ne le contenait pas) — chaque commande télévendeur créée depuis le début du sprint avait donc `order_branch_id` non renseigné, silencieusement ; `submitForPreparation()` ne faisait qu'un write brut sur `bc_status` sans jamais faire avancer le `workflow_instance` (resté bloqué à l'étape `draft`) — corrigé pour appeler `WorkflowService::transition()`. Bug préexistant **découvert mais non corrigé** (flag-only, décision utilisateur) : `ProcessOrchestrator`/`WorkflowService::transition()` échoue en contexte cron (pas d'`Auth::id()` → violation `NOT NULL` sur `workflow_transitions.performed_by`) et `sweepTimedOutTasks()` utilise `TIMESTAMPDIFF()` (syntaxe MySQL, invalide sur Postgres) — bloque l'auto-avancement du moteur de workflow pour **tous** les workflows, pas seulement télévendeur/SHORT_CHR ; à corriger dans une passe dédiée.
- **2026-08 (Phase 2 + 5 fonctionnalités)** : SHORT_CHR Phase 2 livrée — `orders.workflow_transitions.performed_by` rendu nullable (un auto-advance système n'a réellement aucun acteur humain), nouveau `App\Observers\WorkflowTransitionObserver` qui synchronise génériquement `orders.bc_status` depuis le moteur de workflow (comblait un vrai trou : `ProcessOrchestrator` ne l'avait jamais fait, seules les classes `Decision` le faisaient au cas par cas), `submitForPreparation()` déclenche désormais `ProcessOrchestrator::processInstance()` en synchrone après soumission, et `App\Services\TeleSales\ShortChrFulfillmentService` (hooké sur `OrderObserver`, même pattern que "Mission Vide") auto-crée mission + BL + allocation + BP avec sélection auto de chauffeur/véhicule (voir §5.6 pour l'heuristique et ses limites). Plus 5 fonctionnalités additionnelles : §5.0 portefeuille self-service agent, §5.7 retours clients (réutilise `PartnerReturn`, nouvel `AccessProfile` "Télévendeur Profile" à assigner par utilisateur), §5.8 auto-soumission des commandes programmées (commande Artisan quotidienne), §5.4 devis envoyé par email réel (`App\Mail\QuoteMail`), §5.4 dérogation à 2 niveaux réels (Chef ADV → Directeur Commercial, `CreditDerogation.status` étendu avec `pending_l2` — **vrai changement de code sur une classe partagée avec le canal Salesperson**, pas une config). Deux bugs préexistants découverts et corrigés en chemin (recherche initiale imprécise, corrigés après vérification) : le rôle `directeur_commercial` n'existe pas réellement, c'est `commercial_director` (voir `RoleConsolidationSeeder`) ; `ReturnActivityService` résout le "profil mobile" via `AccessProfile` (`users.access_profile_id`), un mécanisme entièrement différent de `ConfigurationSetting`/`MobileProfileResolver` utilisé partout ailleurs dans ce module. Bugs préexistants découverts et **non corrigés** (flag-only) : le rôle `chef_adv` référencé dans `config/decisions.php` et les classes de dérogation n'existe pas non plus (seul `admin` pouvait valider avant ce sprint) ; l'idempotency-key de `request-derogation` dépend de Redis, absent de cet environnement de dev.
- **2026-08 (retour équipe UI — trou lecture admin)** : ajout `GET /schedules?user_id=&date_from=&date_to=` (§7.0) et `GET /assignments?user_id=` (§7.3-bis). L'écran admin ne pouvait auparavant afficher que ce qui venait d'être créé dans la session navigateur en cours — un refresh faisait disparaître le semainier/la répartition alors qu'ils existaient bien en base. Aucun changement de comportement sur les endpoints d'écriture existants.
- **2026-08 (récap avant soumission)** : ajout `GET /orders/{id}/summary` (§5.2-bis) — décomposition prix/TVA/promotion ligne par ligne pour un écran de relecture avant `POST /orders/{id}/submit`. Lit exclusivement les colonnes déjà persistées par `PromotionService` (aucun recalcul, pas de risque de divergence). Confirmation au passage (déjà vrai, pas un changement de comportement) : `POST /orders` crée toujours la commande en `DRAFT` — seul `POST /orders/{id}/submit` la fait avancer.
- **2026-08 (sync local-first)** : ajout §4.4 — `GET /catalog/sync`, `GET /catalog/tiers?price_list_id=`, `GET /partners/sync` pour peupler un cache IndexedDB côté UI. Correction de la demande initiale : `packagings`/`price_source` existaient déjà sur `GET /catalog/products` (non manquants) ; `tax_rate` était réellement absent, ajouté. "tier_id" ne correspond à aucun champ réel — les paliers sont des lignes quantité/produit/conditionnement dans `product_pricing_tiers`, exposées telles quelles via `/catalog/tiers`. `price_overrides` est une vraie table (`partner_price_overrides`, partenaire×produit), exposée par partenaire dans `/partners/sync`, pas comme un champ plat. ⚠️ Limitation structurelle documentée : les promotions à budget plafonné ou cumul mensuel dépendent d'un état serveur mutable (toutes commandes, tous canaux confondus) et ne peuvent pas être prédites de façon fiable hors-ligne — tout calcul client doit rester une estimation, confirmée par `GET /orders/{id}/summary` avant d'être présentée comme définitive à l'agent.
- **2026-08 (enrichissement catalogue)** : `GET /catalog/products` et `GET /catalog/sync` renvoient désormais le même objet produit enrichi — `tax_rate`, `brand`, `short_description`, `barcode`, `marketing` (`is_new`/`is_featured`), `flags` métier (`is_salable`/`is_returnable`/`is_discountable`/`is_expirable`/`requires_refrigeration`/`decimal_quantity_allowed`/`min_quantity_order`, table `product_flags`), et `price_list` (id/code/name, uniquement quand `partner_id` est fourni sur `/catalog/products` et résolu). `buy_price` (coût d'achat) reste volontairement exclu — donnée de marge interne, pas destinée à un canal de vente.
- **2026-08 (correctif — prix de base manquant)** : ajout `GET /catalog/price-list?price_list_id=` — expose `price_list_line_details` (les lignes de prix standard/override du partenaire), la source de prix la plus utilisée en pratique (228 lignes pour la liste C05 dans cet environnement, vs 0 tier). **Signalé par l'équipe UI** : sans cet endpoint, un client combinant seulement catalogue générique + `price_overrides` + tiers retombait systématiquement sur le prix générique dès que ni override ni tier n'existait — ce qui est le cas le plus fréquent, donnant des prix estimés totalement faux (ex: 23,50 affiché contre 17,03 réel pour un produit testé). Correction au passage de l'ordre de priorité documenté en §4.4 : `price_overrides` (partenaire) > tier > ligne override de la liste > **ligne standard de la liste (cas le plus fréquent, précédemment omis de la doc)** > repli linéaire. Vérifié produit par produit contre `PartnerProductPriceResolver::resolve()` réel (résultats identiques).
