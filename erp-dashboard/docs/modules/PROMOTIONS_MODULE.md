# Module Promotions — Documentation complète

> **Audience :** équipe backend, équipe UI, équipe mobile
> **Statut :** production-ready après les correctifs du 2026-07-11
> **Origine :** port PHP fidèle du moteur C# `PromoBR.cs` (AssabilServer), enrichi de drivers modulaires

---

## 1. Vue d'ensemble de l'architecture

```
                        ┌─────────────────────────────┐
                        │      SalesPromotionSuite     │  ← orchestrateur (singleton)
                        │  simulate() / applyToDraft() │
                        └──────────┬──────────────────┘
                                   │ config/promotions.php (driver_order)
        ┌──────────────┬───────────┼──────────────┬───────────────┐
        ▼              ▼           ▼              ▼               │
 SalesGroupLine  Transaction   MixAndMatch   TieredVolume         │
   (reporting)   (moteur C#)  (attribution)  (attribution)        │
                       │                                          │
                       ▼                                          │
              ┌────────────────┐                                  │
              │ PromotionService│  ← moteur central (PromoBR.cs)  │
              │  - éligibilité  │                                 │
              │  - breakpoints  │                                 │
              │  - 7 types      │                                 │
              │  - persistance  │                                 │
              └────────────────┘
```

| Composant | Rôle |
|-----------|------|
| `PromotionService` | Moteur de calcul : éligibilité partenaire, paliers, 7 types de promo, persistance `order_promotion_details`, mise à jour `order_products` + recalcul TVA |
| `SalesPromotionSuite` | Orchestrateur : `simulate()` (préview sans écriture) et `applyToDraftOrder()` (application définitive) |
| `ProductSalesGroupPromotionService` | Remise % par groupe de vente (FDP, CLN, SFD…), appliquée **au pricing de ligne** dans le panier |
| `PromotionEngine` | Ancien moteur simplifié — conservé pour `/api/promotions/calculate` (legacy), ne pas utiliser pour de nouveaux flux |
| Drivers (`config/promotions.php`) | Extension sans toucher aux controllers : chaque driver implémente `PromotionDriverInterface` |

---

## 2. Modèle de données

```
promotions
├── code, name, start_date, end_date, is_closed
├── sequence, skip_to_sequence        → ordre d'application + saut
├── scale_method                      → 1=Cumulative, 2=Bracket
├── breakpoint_type                   → 1=Quantité, 2=Montant, 3=Unité promo
├── payment_term_dependent            → promo liée à un mode de paiement
├── partner_precondition              → code partenaire spécifique
├── product_sales_group_code          → scope groupe de vente (remise ligne)
│
├── promotion_lines (1-N)
│   ├── paid_based_on_product         → condition sur produit précis ou famille
│   ├── paid_product_code / paid_product_family_code
│   ├── free_based_on_product         → cible de la remise/gratuité
│   ├── free_product_code / free_product_family_code
│   ├── assortment_type               → 0=Aucun, 1=Qté, 2=Qté%, 3=Montant%, 4=Montant
│   │
│   ├── promotion_line_assortments (1-N)   → mix obligatoire de produits
│   │   └── product_code | product_family_code + minimum
│   │
│   └── promotion_line_details (1-N)       → paliers (tiers)
│       ├── minimum_value             → seuil de déclenchement
│       ├── amount                    → valeur de la remise
│       ├── promo_type                → 1-7 (voir §3)
│       └── repeating                 → répétition par multiple du seuil
│
├── partner_family_promotions (N-N)   → ciblage par familles de partenaires
└── promotion_payment_terms (1-N)     → restriction modes de paiement
```

**Persistance à l'application :**
- `order_promotion_details` — détail par promo/ligne/palier appliqué
- `order_products.promotion_discount|promotion_codes|final_price|promo_unit_price_ttc|promo_unit_price_ht` — impact ligne
- `orders.promotion_discount|promotion_codes` — total commande
- `promotion_application_logs` — journal d'application (analytics)
- `promotion_lookup_no_matches` — échecs de lookup (debug)

---

## 3. Les 7 types de promotion (`promo_type`)

| # | Constante | Effet | Exemple |
|---|-----------|-------|---------|
| 1 | `TYPE_PERCENT` | Remise % sur le prix net | 10% dès 50 unités |
| 2 | `TYPE_AMOUNT_PER_UNIT` | Montant remisé par unité | −2 MAD/unité dès 100 unités |
| 3 | `TYPE_BEST_PRICE` | Prix plafonné (appliqué seulement si inférieur au prix courant) | prix garanti 8 MAD |
| 4 | `TYPE_FREE_UNIT` | Gratuité même produit (augmente la quantité) | 1 gratuit par 12 achetés |
| 5 | `TYPE_FREE_PROMO_UNIT` | Gratuité produit différent (via famille, ordre `promo_sequence`) | 1 verre offert par carton |
| 6 | `TYPE_FLAT_AMOUNT` | Montant fixe distribué au prorata des lignes | −50 MAD dès 500 MAD |
| 7 | `TYPE_REPLACE_PRICE` | Prix spécial remplaçant le prix courant | 6,90 MAD au lieu de 8,50 |
| 8 | `TYPE_CHEAPEST_FREE` | **Le moins cher offert** — la remise tombe sur la ligne éligible au prix net le plus bas (plafonnée à sa quantité) | 3 achetés → le moins cher gratuit |

**Paliers (details)** : chargés en `minimum_value DESC`.
- **Bracket** (`scale_method=2`) : le premier palier atteint (le plus haut) gagne, un seul s'applique.
- **Cumulative** (`scale_method=1`) : les paliers s'additionnent par incréments.
- **Repeating** : `floor(quantité / minimum_value)` répétitions (ex: 1 gratuit **par** tranche de 12).

**Breakpoints** (`breakpoint_type`) : la « quantité » comparée au seuil est soit la somme des quantités (1), soit la valeur en MAD (2), soit les unités-promo pondérées `products.promo_unit` (3).

**Assortiments** : conditions de mix — ex. « minimum 5 produits de la famille A **ET** 3 de la famille B » (type 1/4 = valeurs absolues, type 2/3 = % du breakpoint).

**Transaction-wide (nouveau, 2026-07-11)** : une ligne de promo **sans** `paid_product_code` NI `paid_product_family_code` s'applique à **toute la commande** (types 1, 2, 6 uniquement). Exemple : « 5% sur toute commande ≥ 5000 MAD » sans créer de famille englobante.

---

## 4. Cycle de vie d'une promo dans le flux vendeur (SFA mobile)

```
┌────────────┐    ┌───────────────┐    ┌──────────────┐    ┌─────────────┐
│ Ajout item │ →  │ Préview recap │ →  │  placeOrder  │ →  │  Facturation │
│ (cart)     │    │ (SDUI/simulate)│   │  (submit BC) │    │ (conventional)│
└────────────┘    └───────────────┘    └──────────────┘    └─────────────┘
 Sales-group %     Moteur complet       Moteur complet      applyToDraftOrder
 baked dans le     en PREVIEW           APPLIQUÉ + persisté  (déjà en place)
 prix de ligne     (read-only)          AVANT SubmitDecision
```

1. **Ajout au panier** (`addOrMergeLine`) : seule la remise % du groupe de vente est appliquée, directement dans le prix unitaire (`final_price`), avec `promotion_discount` informatif sur la ligne.
2. **Changement de quantité** (`setLineQuantity`) : le `promotion_discount` de ligne est resynchronisé (× nouvelle quantité) — le % étant dans le prix, l'échelle est linéaire.
3. **Récap SDUI** (`order_recap_totals`) : le resolver exécute le moteur **en préview** (aucune écriture) et affiche « Total remise » = remises lignes + remise moteur prévisionnelle.
4. **placeOrder** : `SalesPromotionSuite::applyToDraftOrder()` tourne **avant** `SubmitOrderDecision` — les contrôles crédit/minimum voient les totaux post-promo ; les promos sont persistées (`order_promotion_details`, `orders.promotion_discount`). La réponse inclut `promotions` (snapshot par driver) + `promotion_discount`.
5. **Idempotence** : rejouer `placeOrder` recalcule proprement (delete + insert des détails, calculs déterministes).

### Endpoints

| Méthode | Route | Usage |
|---------|-------|-------|
| `POST` | `/api/salesperson/orders/simulate` | Préview promo (offline-friendly) — body : `partner_id`, `payment_term_id?`, `items[{product_id, unit_id, quantity}]` |
| `POST` | `/api/salesperson/orders/place` | Soumission — applique le moteur + retourne `promotions`, `promotion_discount`, `promotion_codes` |
| `POST` | `/api/promotions/calculate` | Legacy (ancien `PromotionEngine`) — ne pas utiliser pour de nouveaux flux |
| `GET` | `/api/my-promotions` | Promotions actives du partenaire connecté |

---

## 5. Garde-fous production

| Garde-fou | Mécanisme |
|-----------|-----------|
| **Anti-double-remise** | Flag `sales_group_pricing_applied` sur la transaction : le moteur saute toute promo scoped `product_sales_group_code` quand le % groupe est déjà dans les prix de ligne (simulate, placeOrder, resolver SDUI) |
| **Produit non remisable** | `product_flags.is_discountable = false` → exclu du calcul |
| **Échec moteur ≠ vente bloquée** | `placeOrder` catch les exceptions moteur, log en error, la commande part sans promo moteur (même politique que POS) |
| **Remise max** | `sales.max_discount_percent` contrôlé par `SubmitOrderDecision` sur le prix final |
| **Cache + invalidation instantanée** | Promos par partenaire cachées 1h (`promotions:v{N}:{partner}:{date}:{term}`). Toute écriture sur `Promotion`/lignes/paliers/assortiments/modes de paiement **bump la version de cache** (trait `InvalidatesPromotionCache`) → invalidation instantanée O(1) sur tous les drivers. Les sync de pivots (familles partenaires) invalident explicitement dans `PromotionController` |
| **Stock gratuités** | `freeGoodWithStockLimitation` lit désormais `stocks.available_quantity` (la colonne `products.stock_quantity` n'existe plus) |
| **Prix liste préservé** | `original_price` de ligne n'est plus écrasé par le moteur — l'audit liste→vendu→final reste traçable |

---

## 6. Correctifs appliqués le 2026-07-11

| # | Problème | Fichier | Fix |
|---|----------|---------|-----|
| A | **Les promos n'étaient jamais appliquées au placement** (seul le POS et la facturation les appliquaient — la préview mobile mentait) | `API/Salesperson/OrderController::placeOrder` | Appel `applyToDraftOrder()` avant `SubmitOrderDecision` + snapshot dans la réponse |
| B | `promotion_discount` de ligne figé à la quantité d'ajout | `SalespersonCartService::setLineQuantity` | Resync `(list − sell) × qty` |
| C | Double remise possible (groupe de vente appliqué au pricing **et** ré-appliqué par le moteur si promo liée au partenaire) | `PromotionService`, `SalesPromotionSuite` | Flag `sales_group_pricing_applied` + skip |
| D | `getProductStock` lisait `products.stock_quantity` (colonne inexistante) → crash si limitation stock activée | `PromotionService` | Somme `stocks.available_quantity` |
| E | Le moteur écrasait `original_price` (prix liste) avec le prix vendu | `PromotionService::updateOrderProductsWithPromotions` | Préservation + discount ligne = part groupe + part moteur (déterministe/idempotent) |
| F | Récap SDUI : « Total remise » toujours 0 en brouillon | `OrderRecapTotalsResolver` | Préview moteur read-only + remises lignes affichées |
| G | Impossible d'exprimer « X% sur toute la commande » sans famille englobante | `PromotionService` | Support transaction-wide (ligne sans produit/famille payé) |

---

## 6b. Fonctionnalités avancées (2026-07-11)

### Budget Cap — plafond budgétaire par campagne

```
promotions.max_budget          → plafond (null/0 = illimité)
promotions.current_spent       → consommé (géré par le moteur, jamais par l'admin)
promotions.budget_exhausted_at → horodatage d'épuisement
promotion_budget_ledger        → 1 ligne par (promotion, commande) — source de vérité
```

**Fonctionnement :** à chaque `placeOrder`, le moteur écrit le montant de remise dans le **ledger** puis incrémente `current_spent` **par delta** (`nouveau − précédent`). Conséquences :
- **Idempotent** : un retry de placeOrder ne double-compte jamais.
- **Réversible** : si un recalcul réduit la remise, le delta négatif rembourse le budget.
- **Auditable** : le ledger trace quelle commande a consommé combien, par promo.
- **Instantané sur le terrain** : franchir le cap stampe `budget_exhausted_at` via `save()` → le trait `InvalidatesPromotionCache` bump la version de cache → plus aucun device ne voit la promo.
- **Réactivation** : augmenter `max_budget` au-dessus du consommé (admin) ou un remboursement de delta ré-active automatiquement la promo.
- Le check d'éligibilité relit `current_spent` **frais** à chaque évaluation (une petite requête), jamais depuis le cache.

### Paliers cumulatifs mensuels

```
promotions.cumulative_basis = 'order' (défaut) | 'monthly_partner'
```

En mode `monthly_partner` (breakpoint **montant** uniquement), le seuil est évalué contre : `CA partenaire du mois en cours (commandes soumises+, hors draft/annulé) + transaction courante`. La remise, elle, ne s'applique **qu'aux lignes de la commande courante**. Le CA month-to-date est caché 10 min par partenaire (`promotions:mtd:{partner}:{Y-m}`).

> Exemple : « 5% si le client dépasse 20 000 MAD cumulés depuis le 1er du mois » → `cumulative_basis=monthly_partner`, `breakpoint_type=2`, detail `{minimum_value: 20000, amount: 5, promo_type: 1}`.

### Happy Hours & Flash Sales

```
promotions.active_days       → JSON [1..7] (ISO : 1=lundi … 7=dimanche), null = tous les jours
promotions.daily_start_time  → borne horaire inclusive, null = toute la journée
promotions.daily_end_time    → idem
```

> « Mardis 14h–17h » → `active_days=[2]`, `daily_start_time=14:00`, `daily_end_time=17:00`.

**Important architecture :** les fenêtres horaires et le budget sont évalués **après** le cache (`filterRuntimeEligibility`), jamais dans la requête cachée — le cache par partenaire vit jusqu'à 1h et fausserait les bascules horaires.

### Mix & Match / Bundles complexes

Déjà couvert par le moteur existant + type 8 :

| Besoin | Configuration |
|--------|---------------|
| « 5 × Famille A + 2 × Produit B → 1 × Produit C offert » | ligne : `paid_product_family_code=A`, `assortment_type=1` (AND), assortiments `[{famille A, min 5}, {produit B, min 2}]`, détail `{promo_type: 4 ou 5, amount: -1}`, `free_product_code=C` |
| « 3 achetés, le moins cher offert » | ligne : `paid_product_family_code=X` (ou transaction-wide), détail `{promo_type: 8, minimum_value: 3, amount: -1}` — la remise tombe automatiquement sur la ligne éligible la moins chère |

> Le CRUD admin bloquait les types 4/5/6 (`in:1,2,3,7`) — débloqué : les 8 types sont désormais configurables.

### Boosts de Promotion (merchandising)

Un **Boost** n'est **pas une remise** — c'est une règle de **mise en avant** dans le catalogue vendeur :

```
product_family_partner_family_boosts
├── product_family_id   → QUELS produits mettre en avant
├── partner_family_id   → pour QUELS clients (segment)
├── rank                → priorité d'affichage entre familles boostées (asc)
└── boost_factor        → poids à rank égal (desc) — décimal jusqu'à 999.999999
```

**Exemple métier :** « Pour les clients de la famille CHR (cafés-hôtels-restaurants), pousser les produits de la famille SURGELÉS en tête du catalogue mobile. »

**Fonctionnement (opérationnel depuis 2026-07-11) :**
1. L'admin configure les boosts via `/backend/promotions/boosts` (CRUD + `bulk-sync`).
2. Quand un vendeur ouvre le catalogue (`GET /salesperson/catalog/products?partner_id=X`), le backend résout : partenaire → ses familles → boosts → produits des familles boostées.
3. Les produits boostés remontent **en tête** (rank asc, boost_factor desc), les autres gardent leur ordre.
4. Chaque produit du payload catalogue porte : `is_boosted` (bool), `boost_rank`, `boost_factor` — le mobile peut afficher un badge « ⭐ Mis en avant ».
5. Cache 10 min par partenaire, invalidé **instantanément** à toute édition de boost (même mécanisme de version que les promos).

**Garde-fous existants :** une famille (produit ou partenaire) utilisée dans un boost ne peut pas être supprimée (422), et le couple (product_family × partner_family) est unique.

---

## 7. Limitations connues & roadmap proposée

| Limitation | Impact | Proposition |
|------------|--------|-------------|
| **Offline mobile : pas d'évaluation promo** (`orderRecapResolvers.ts` → `discount = 0`) | Le récap offline n'affiche pas les remises ; elles apparaissent à la synchro (placeOrder les applique côté serveur) | Embarquer un sous-ensemble du moteur (percent + paliers simples) dans le SQLite du mobile, aligné sur la stratégie offline-first SDUI |
| **TVA plate 20% dans les récaps** (resolvers serveur + mobile) | Approximation si produits multi-taux | Utiliser `line_tax_amount` réels par ligne |
| **Pas de plafond fréquence par partenaire** | Un même partenaire peut bénéficier N fois d'une promo sur la période (le budget global, lui, est plafonné) | `max_applications_per_partner` + comptage sur `promotion_budget_ledger` (la table existe déjà) |
| **Cumul mensuel : CA global uniquement** | Le seuil `monthly_partner` compte tout le CA du partenaire, pas seulement les produits de la famille de la promo | Ledger de CA mensuel par (partenaire, famille) si le besoin apparaît |
| **Budget non remboursé à l'annulation de commande** | Une commande annulée après placement laisse sa consommation dans le ledger | Listener sur l'annulation BC → `recordBudgetSpend(order_code, [])` rembourse via delta |
| **Pas de codes coupon** | Promos uniquement automatiques | Table `promotion_coupons` + champ saisi au checkout |
| **Type 5 (gratuité produit différent) : valorisation partielle** | Le discount affiché peut être 0 si le produit gratuit n'est pas dans la commande | Lookup prix produit gratuit pour valoriser la ligne offerte |

---

## 8. Recettes de configuration (exemples)

**« 10% dès 50 unités, 15% dès 100 » (bracket)**
```
promotion: breakpoint_type=1 (qté), scale_method=2 (bracket)
line: paid_product_family_code=BOISSONS, free_product_family_code=BOISSONS
details: [ {minimum_value:100, amount:15, promo_type:1}, {minimum_value:50, amount:10, promo_type:1} ]
```

**« 1 gratuit par carton de 12 » (repeating)**
```
promotion: breakpoint_type=1
line: paid_product_code=CC-033, free_product_code=CC-033
detail: {minimum_value:12, amount:-1, promo_type:4, repeating:0}   // floor(qty/12) répétitions
```

**« 5% sur toute commande ≥ 5000 MAD » (transaction-wide — nouveau)**
```
promotion: breakpoint_type=2 (montant)
line: paid_based_on_product=false, paid_product_code=null, paid_product_family_code=null
detail: {minimum_value:5000, amount:5, promo_type:1}
```

**« Remise 8% permanente sur le groupe FoodPlus » (sales-group, prix de ligne)**
```
promotion: product_sales_group_code=FDP
line+detail: {promo_type:1, amount:8, minimum_value:0}
→ appliquée au pricing du panier, PAS ré-appliquée par le moteur (guard)
```

**« Mix 5 produits famille A + 3 famille B → −100 MAD » (assortiment)**
```
line: assortment_type=1 (AND quantités), free_product_family_code=A
assortments: [ {product_family_code:A, minimum:5}, {product_family_code:B, minimum:3} ]
detail: {minimum_value:8, amount:100, promo_type:6}
```

---

## 9. Checklist de mise en production

- [x] Promo appliquée au `placeOrder` (mobile B2B) — **corrigé**
- [x] Recalcul sur changement de quantité — **corrigé**
- [x] Préview = réalité (même moteur, même flag anti-double-remise)
- [x] Idempotence sur retry (`Idempotency-Key` + delete/insert + calculs déterministes)
- [x] POS : `PosCheckoutService`/`PosCartController` appellent déjà le moteur
- [x] Facturation conventionnelle : `DirectInvoiceBulkService::applyToDraftOrder` déjà en place
- [x] Invalidation instantanée du cache promo à l'édition admin — **implémenté** (version bump via model events + CRUD)
- [ ] Test E2E : créer une promo bracket + placer une commande mobile + vérifier `order_promotion_details`
```
php artisan tinker
>>> app(\App\Services\Promotions\PromotionService::class)->getPartnerApplicablePromo('PARTNER_CODE', now(), null)
```
