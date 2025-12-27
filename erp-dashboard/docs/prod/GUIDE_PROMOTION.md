# Guide Complet des Promotions - Documentation Développeur Frontend

## Table des Matières
1. [Vue d'ensemble](#vue-densemble)
2. [Types de Promotions](#types-de-promotions)
3. [Configuration des Promotions](#configuration-des-promotions)
4. [Scénarios d'Utilisation](#scénarios-dutilisation)
5. [API Endpoints](#api-endpoints)
6. [Exemples Complets avec CURL](#exemples-complets-avec-curl)
7. [Validation et Tests](#validation-et-tests)
8. [Troubleshooting](#troubleshooting)

---

## Vue d'ensemble

Le système de promotions permet de créer des remises automatiques basées sur:
- **Familles de produits** ou **produits spécifiques**
- **Quantité** ou **montant** d'achat
- **Familles de partenaires** (clients ciblés)
- **Conditions de paiement**
- **Périodes de validité**

### Concepts Clés

- **Breakpoint Type**: Détermine comment calculer le seuil
  - `1` = Basé sur la quantité (nombre d'unités)
  - `2` = Basé sur le montant (valeur en MAD)
  - `3` = Basé sur les unités promotionnelles

- **Scale Method**: Méthode de calcul de la remise
  - `1` = Cumulative (remise progressive)
  - `2` = Bracket (remise par palier)

- **Promo Type**: Type de remise
  - `1` = Remise en pourcentage (%)
  - `2` = Remise en montant fixe (MAD)
  - `3` = Produit gratuit (quantité)
  - `7` = Unité promotionnelle gratuite

---

## Types de Promotions

### 1. Remise sur Famille de Produits (Discount sur Panier)

**Cas d'usage**: Remise de 5% si le panier contient 100 MAD de produits de la famille JAMBON

**Configuration**:
```json
{
  "breakpoint_type": 2,  // Basé sur le montant
  "lines": [{
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "details": [{
      "promo_type": 1,  // Pourcentage
      "minimum_value": 100.00,
      "amount": 5.00,  // 5%
      "repeating": true
    }]
  }]
}
```

### 2. Remise sur Produit Spécifique

**Cas d'usage**: Remise de 10 MAD sur le produit JAMB001 si achat de 5 unités

**Configuration**:
```json
{
  "breakpoint_type": 1,  // Basé sur la quantité
  "lines": [{
    "paid_based_on_product": true,
    "paid_product_code": "JAMB001",
    "free_based_on_product": true,
    "free_product_code": "JAMB001",
    "details": [{
      "promo_type": 2,  // Montant fixe
      "minimum_value": 5,
      "amount": 10.00,
      "repeating": false
    }]
  }]
}
```

### 3. Produit Gratuit (Buy X Get Y)

**Cas d'usage**: Achetez 10 unités de JAMB001, obtenez 2 unités gratuites

**Configuration**:
```json
{
  "breakpoint_type": 1,  // Basé sur la quantité
  "lines": [{
    "paid_based_on_product": true,
    "paid_product_code": "JAMB001",
    "free_based_on_product": true,
    "free_product_code": "JAMB001",
    "details": [{
      "promo_type": 3,  // Produit gratuit
      "minimum_value": 10,
      "amount": 2,  // 2 unités gratuites
      "repeating": true
    }]
  }]
}
```

### 4. Remise Progressive (Cumulative)

**Cas d'usage**: Plus vous achetez, plus la remise augmente

**Configuration**:
```json
{
  "breakpoint_type": 2,
  "scale_method": 1,  // Cumulative
  "lines": [{
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "details": [
      {
        "promo_type": 1,
        "minimum_value": 100.00,
        "amount": 3.00,  // 3% pour 100-199 MAD
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 200.00,
        "amount": 5.00,  // 5% pour 200-299 MAD
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 300.00,
        "amount": 10.00,  // 10% pour 300+ MAD
        "repeating": false
      }
    ]
  }]
}
```

---

## Configuration des Promotions

### Structure Complète d'une Promotion

```json
{
  "code": "PROMO0001",
  "name": "Promotion Jambon 5%",
  "description": "Remise de 5% sur les produits de la famille JAMBON",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "skip_to_sequence": 0,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "is_loyalty_program": false,
  "partner_families": ["PREACHIBEST", "PREGROS"],
  "payment_terms": [],
  "lines": [
    {
      "line_number": 0,
      "name": "Règle 1",
      "paid_based_on_product": false,
      "paid_product_code": null,
      "paid_product_family_code": "FAMILLE_JAMBON",
      "free_based_on_product": false,
      "free_product_code": null,
      "free_product_family_code": null,
      "assortment_type": 0,
      "minimum_cart_amount": null,
      "details": [
        {
          "detail_number": 0,
          "promo_type": 1,
          "repeating": true,
          "minimum_value": 100.00,
          "amount": 5.00
        }
      ],
      "assortments": []
    }
  ]
}
```

### Champs Importants

#### Niveau Promotion

| Champ | Type | Description | Valeurs |
|-------|------|-------------|---------|
| `breakpoint_type` | int | Type de seuil | 1=Quantité, 2=Montant, 3=Promo Unit |
| `scale_method` | int | Méthode de calcul | 1=Cumulative, 2=Bracket |
| `sequence` | int | Priorité d'exécution | Plus petit = plus prioritaire |
| `partner_families` | array | Familles de clients ciblés | Codes des familles |
| `payment_terms` | array | Conditions de paiement | Codes des conditions |

#### Niveau Ligne (Line)

| Champ | Type | Description | Valeurs |
|-------|------|-------------|---------|
| `paid_based_on_product` | bool | Cible un produit spécifique | true=produit, false=famille |
| `paid_product_code` | string | Code produit (si paid_based_on_product=true) | Ex: "JAMB001" |
| `paid_product_family_code` | string | Code famille (si paid_based_on_product=false) | Ex: "FAMILLE_JAMBON" |
| `free_based_on_product` | bool | Remise sur produit spécifique | true=produit, false=famille |
| `assortment_type` | int | Type d'assortiment | 0=Aucun, 1=Multiple, 2=Montant, 3=Les deux |

#### Niveau Détail (Detail)

| Champ | Type | Description | Valeurs |
|-------|------|-------------|---------|
| `promo_type` | int | Type de remise | 1=%, 2=Montant, 3=Gratuit, 7=Promo Unit |
| `minimum_value` | decimal | Seuil minimum | Quantité ou montant selon breakpoint_type |
| `amount` | decimal | Valeur de la remise | %, MAD, ou quantité selon promo_type |
| `repeating` | bool | Remise répétitive | true=s'applique plusieurs fois |

---

## Scénarios d'Utilisation

### Scénario 1: Remise Simple sur Famille

**Objectif**: 5% de remise sur la famille JAMBON si achat ≥ 100 MAD

**Étapes**:
1. Créer la promotion avec `breakpoint_type: 2` (montant)
2. Configurer `paid_product_family_code: "FAMILLE_JAMBON"`
3. Définir `promo_type: 1` (pourcentage) avec `amount: 5`
4. Définir `minimum_value: 100`
5. Activer `repeating: true` si applicable à tout le panier

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO_JAMBON_5",
  "name": "Remise 5% Jambon",
  "description": "5% de remise sur famille JAMBON si achat >= 100 MAD",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "Règle Jambon",
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "assortment_type": 0,
    "details": [{
      "promo_type": 1,
      "minimum_value": 100.00,
      "amount": 5.00,
      "repeating": true
    }]
  }]
}'
```

**Test**:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "product_id": 62,
  "quantity": 3
}'
```

**Résultat Attendu**:
- Si 3 × 40.02 MAD = 120.06 MAD
- Remise: 120.06 × 5% = 6.00 MAD
- Total final: 114.06 MAD

---

### Scénario 2: Achetez X, Obtenez Y Gratuit

**Objectif**: Achetez 10 unités de JAMB001, obtenez 2 gratuites

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO_BUY10_GET2",
  "name": "Achetez 10, Obtenez 2 Gratuit",
  "description": "Achetez 10 unités JAMB001, obtenez 2 gratuites",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 1,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "Buy 10 Get 2",
    "paid_based_on_product": true,
    "paid_product_code": "JAMB001",
    "free_based_on_product": true,
    "free_product_code": "JAMB001",
    "assortment_type": 0,
    "details": [{
      "promo_type": 3,
      "minimum_value": 10,
      "amount": 2,
      "repeating": true
    }]
  }]
}'
```

**Test**:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "product_id": 62,
  "quantity": 10
}'
```

**Résultat Attendu**:
- Quantité payée: 10 unités
- Quantité gratuite: 2 unités
- Total: 12 unités pour le prix de 10

---

### Scénario 3: Remise Progressive par Paliers

**Objectif**: 
- 3% pour 100-199 MAD
- 5% pour 200-299 MAD
- 10% pour 300+ MAD

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO_PROGRESSIVE",
  "name": "Remise Progressive",
  "description": "Plus vous achetez, plus vous économisez",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "Paliers Progressifs",
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "assortment_type": 0,
    "details": [
      {
        "promo_type": 1,
        "minimum_value": 100.00,
        "amount": 3.00,
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 200.00,
        "amount": 5.00,
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 300.00,
        "amount": 10.00,
        "repeating": false
      }
    ]
  }]
}'
```

**Tests**:

Test 1 - 120 MAD:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 3}'
```
Résultat: 3% de remise = 3.60 MAD

Test 2 - 240 MAD:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 6}'
```
Résultat: 5% de remise = 12.00 MAD

Test 3 - 400 MAD:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 10}'
```
Résultat: 10% de remise = 40.00 MAD

---

### Scénario 4: Promotion Ciblée par Famille de Partenaires

**Objectif**: Remise exclusive pour les clients PREACHIBEST

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO_VIP",
  "name": "Remise VIP Achibest",
  "description": "Remise exclusive pour clients Achibest",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": ["PREACHIBEST"],
  "lines": [{
    "name": "Remise VIP",
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "assortment_type": 0,
    "details": [{
      "promo_type": 1,
      "minimum_value": 50.00,
      "amount": 10.00,
      "repeating": true
    }]
  }]
}'
```

**Important**: Seuls les partenaires appartenant à la famille "PREACHIBEST" verront cette promotion.

---

### Scénario 5: Remise avec Assortiment (Panier Mixte)

**Objectif**: Achetez au moins 2 produits différents de la famille JAMBON, obtenez 5% de remise

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO_ASSORTMENT",
  "name": "Remise Assortiment",
  "description": "5% si achat de 2 produits différents minimum",
  "start_date": "2025-12-01",
  "end_date": "2025-12-31",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "Assortiment Jambon",
    "paid_based_on_product": false,
    "paid_product_family_code": "FAMILLE_JAMBON",
    "free_based_on_product": false,
    "assortment_type": 1,
    "minimum_cart_amount": 100.00,
    "details": [{
      "promo_type": 1,
      "minimum_value": 100.00,
      "amount": 5.00,
      "repeating": true
    }],
    "assortments": [
      {
        "based_on_product": false,
        "product_family_code": "FAMILLE_JAMBON",
        "minimum": 2
      }
    ]
  }]
}'
```

---

## API Endpoints

### 1. Créer une Promotion

**Endpoint**: `POST /api/backend/promotions`

**Headers**:
```
Authorization: Bearer {token}
Content-Type: application/json
```

**Body**: Voir exemples ci-dessus

**Réponse Success (201)**:
```json
{
  "success": true,
  "message": "Promotion created successfully",
  "promotion": {
    "id": 1,
    "code": "PROMO0001",
    "name": "...",
    ...
  }
}
```

---

### 2. Mettre à Jour une Promotion

**Endpoint**: `PUT /api/backend/promotions/{id}`

**CURL**:
```bash
curl --location --request PUT 'http://localhost:8000/api/backend/promotions/2' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "PROMO0002",
  "name": "DISCOUNT 5%",
  "description": "Updated description",
  "start_date": "2025-12-13",
  "end_date": "2026-12-18",
  "breakpoint_type": 2,
  "is_closed": false,
  "partner_families": ["PREACHIBEST"],
  "lines": [...]
}'
```

---

### 3. Lister les Promotions

**Endpoint**: `GET /api/backend/promotions`

**Query Parameters**:
- `status`: active, upcoming, expired
- `breakpoint_type`: 1, 2, 3
- `start_date`: YYYY-MM-DD
- `end_date`: YYYY-MM-DD
- `search`: Recherche par nom/code

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions?status=active&breakpoint_type=2' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

**Réponse**:
```json
{
  "promotions": {
    "data": [...],
    "current_page": 1,
    "total": 10
  },
  "statistics": {
    "total": 10,
    "active": 5,
    "upcoming": 3,
    "expired": 2
  }
}
```

---

### 4. Voir une Promotion

**Endpoint**: `GET /api/backend/promotions/{id}`

**CURL**:
```bash
curl --location 'http://localhost:8000/api/backend/promotions/2' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 5. Supprimer une Promotion

**Endpoint**: `DELETE /api/backend/promotions/{id}`

**CURL**:
```bash
curl --location --request DELETE 'http://localhost:8000/api/backend/promotions/2' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 6. Tester une Promotion (Panier)

**Endpoint**: `POST /api/cart/store`

**CURL**:
```bash
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "product_id": 62,
  "quantity": 5
}'
```

**Réponse avec Promotion Appliquée**:
```json
{
  "message": "product added to cart",
  "data": {
    "promotions": {
      "applicable": true,
      "message": "1 promotion(s) applied to your cart",
      "promotions": [
        {
          "code": "PROMO0001",
          "name": "Remise 5% Jambon",
          "discount_amount": 10.00,
          "discount_percentage": 5.0
        }
      ],
      "summary": {
        "subtotal": 200.10,
        "total_discount": 10.00,
        "final_total": 190.10,
        "savings_percentage": 5.0
      }
    }
  }
}
```

---

## Validation et Tests

### Checklist de Validation

Avant de déployer une promotion, vérifier:

- [ ] **Dates**: `start_date` < `end_date`
- [ ] **Breakpoint Type**: Correspond au type de seuil voulu (quantité vs montant)
- [ ] **Scale Method**: Cumulative (1) ou Bracket (2)
- [ ] **Promo Type**: Correspond au type de remise (%, montant, gratuit)
- [ ] **Codes Produits/Familles**: Existent dans la base de données
- [ ] **Partner Families**: Si spécifié, les partenaires existent
- [ ] **Minimum Value**: Cohérent avec le breakpoint_type
- [ ] **Amount**: Valeur logique selon le promo_type
- [ ] **Repeating**: Activé si la remise doit s'appliquer plusieurs fois

### Tests Recommandés

#### Test 1: Seuil Minimum
```bash
# Panier en dessous du seuil
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 1}'
```
**Attendu**: Aucune promotion appliquée

#### Test 2: Seuil Atteint
```bash
# Panier au-dessus du seuil
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 5}'
```
**Attendu**: Promotion appliquée

#### Test 3: Famille de Partenaires
```bash
# Tester avec un partenaire hors famille
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer TOKEN_AUTRE_PARTNER' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 10}'
```
**Attendu**: Aucune promotion si partenaire non ciblé

#### Test 4: Dates de Validité
```bash
# Tester avant start_date ou après end_date
# Modifier les dates système ou attendre
```
**Attendu**: Promotion non applicable hors période

#### Test 5: Remise Répétitive
```bash
# Panier avec quantité multiple du seuil
curl --location 'http://localhost:8000/api/cart/store' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{"product_id": 62, "quantity": 20}'
```
**Attendu**: Si `repeating: true`, remise appliquée 2 fois (si seuil = 10)

---

## Troubleshooting

### Problème 1: Promotion Non Appliquée

**Symptômes**:
```json
{
  "promotions": {
    "applicable": false,
    "message": "No promotions available for your cart"
  }
}
```

**Causes Possibles**:

1. **Breakpoint Type Incorrect**
   - Vérifier: `breakpoint_type: 1` (quantité) vs `2` (montant)
   - Solution: Corriger le breakpoint_type selon le seuil voulu

2. **Seuil Non Atteint**
   - Vérifier: `minimum_value` vs quantité/montant du panier
   - Solution: Augmenter la quantité ou vérifier le calcul

3. **Famille de Partenaires**
   - Vérifier: Le partenaire appartient à `partner_families`
   - Solution: Ajouter le partenaire à la famille ou retirer la restriction

4. **Dates Invalides**
   - Vérifier: Date actuelle entre `start_date` et `end_date`
   - Solution: Ajuster les dates de la promotion

5. **Produit/Famille Incorrect**
   - Vérifier: Le produit appartient à `paid_product_family_code`
   - Solution: Vérifier le code famille du produit

6. **Promotion Fermée**
   - Vérifier: `is_closed: false`
   - Solution: Réactiver la promotion

**Debug avec Logs**:
```bash
# Vérifier les logs Laravel
tail -f storage/logs/laravel.log | grep "PromotionService"
```

Logs à surveiller:
- `Fetched applicable promotions`: Nombre de promotions trouvées
- `Calculated breakpoint quantity`: Quantité/montant calculé
- `Detail values`: Valeurs de remise calculées

---

### Problème 2: Erreur "null product code"

**Symptômes**:
```
TypeError: Argument #2 ($productCode) must be of type string, null given
```

**Cause**: `free_based_on_product: true` mais `free_product_code: null`

**Solution**:
```json
{
  "lines": [{
    "free_based_on_product": false,  // Changer à false pour famille
    "free_product_family_code": "FAMILLE_JAMBON"  // Spécifier la famille
  }]
}
```

Ou:
```json
{
  "lines": [{
    "free_based_on_product": true,  // Garder true
    "free_product_code": "JAMB001"  // Spécifier le produit
  }]
}
```

---

### Problème 3: Remise Incorrecte

**Symptômes**: La remise calculée ne correspond pas à l'attendu

**Vérifications**:

1. **Scale Method**
   - `scale_method: 1` (Cumulative): Remise progressive
   - `scale_method: 2` (Bracket): Remise par palier

2. **Repeating**
   - `repeating: true`: Remise appliquée plusieurs fois
   - `repeating: false`: Remise unique

3. **Promo Type**
   - `promo_type: 1`: `amount` est un pourcentage
   - `promo_type: 2`: `amount` est un montant fixe
   - `promo_type: 3`: `amount` est une quantité gratuite

**Exemple de Calcul**:

Panier: 10 unités × 40 MAD = 400 MAD
Promotion: 5% si ≥ 100 MAD, repeating: true

- Breakpoint atteint: 400 / 100 = 4 fois
- Remise par palier: 400 × 5% = 20 MAD
- Si repeating: 20 MAD × 4 = 80 MAD (incorrect)
- Si non-repeating: 20 MAD (correct)

---

## Bonnes Pratiques

### 1. Nommage des Promotions

- **Code**: Court et descriptif (ex: `PROMO_JAMBON_5`)
- **Name**: Clair pour l'utilisateur (ex: "Remise 5% Jambon")
- **Description**: Détaillée avec conditions (ex: "5% de remise sur famille JAMBON si achat ≥ 100 MAD")

### 2. Configuration

- Toujours tester avec des données réelles
- Utiliser `repeating: false` par défaut sauf besoin spécifique
- Définir des dates de fin pour éviter les promotions perpétuelles
- Utiliser `sequence` pour contrôler l'ordre d'application

### 3. Ciblage

- Éviter de cibler trop finement (risque d'exclusion)
- Préférer les familles de produits aux produits individuels
- Documenter les familles de partenaires ciblées

### 4. Tests

- Tester tous les cas limites (seuil -1, seuil, seuil +1)
- Vérifier avec différents partenaires
- Tester les combinaisons de promotions
- Valider les calculs manuellement

### 5. Monitoring

- Surveiller les logs pour détecter les erreurs
- Vérifier régulièrement les promotions actives
- Analyser l'utilisation des promotions
- Désactiver les promotions obsolètes

---

## Exemples Complets de Production

### Exemple 1: Black Friday - Remise Générale

```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "BLACK_FRIDAY_2025",
  "name": "Black Friday - 20% sur tout",
  "description": "Remise exceptionnelle de 20% sur tous les produits",
  "start_date": "2025-11-29",
  "end_date": "2025-11-29",
  "sequence": 1,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "Black Friday",
    "paid_based_on_product": false,
    "paid_product_family_code": null,
    "free_based_on_product": false,
    "assortment_type": 0,
    "details": [{
      "promo_type": 1,
      "minimum_value": 0.01,
      "amount": 20.00,
      "repeating": true
    }]
  }]
}'
```

### Exemple 2: Fidélité - Remise VIP Progressive

```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "VIP_LOYALTY_2025",
  "name": "Programme Fidélité VIP",
  "description": "Remises progressives pour clients VIP",
  "start_date": "2025-01-01",
  "end_date": "2025-12-31",
  "sequence": 5,
  "scale_method": 2,
  "breakpoint_type": 2,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "is_loyalty_program": true,
  "partner_families": ["PREACHIBEST"],
  "lines": [{
    "name": "Paliers VIP",
    "paid_based_on_product": false,
    "free_based_on_product": false,
    "assortment_type": 0,
    "details": [
      {
        "promo_type": 1,
        "minimum_value": 500.00,
        "amount": 5.00,
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 1000.00,
        "amount": 8.00,
        "repeating": false
      },
      {
        "promo_type": 1,
        "minimum_value": 2000.00,
        "amount": 12.00,
        "repeating": false
      }
    ]
  }]
}'
```

### Exemple 3: Déstockage - Produit Gratuit

```bash
curl --location 'http://localhost:8000/api/backend/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
  "code": "DESTOCKAGE_JAMBON",
  "name": "Déstockage Jambon - 1 Gratuit pour 5",
  "description": "Achetez 5 paquets de jambon, obtenez 1 gratuit",
  "start_date": "2025-12-01",
  "end_date": "2025-12-15",
  "sequence": 10,
  "scale_method": 2,
  "breakpoint_type": 1,
  "category_code": "FDP",
  "payment_term_dependent": false,
  "is_closed": false,
  "partner_families": [],
  "lines": [{
    "name": "5+1 Gratuit",
    "paid_based_on_product": true,
    "paid_product_code": "JAMB001",
    "free_based_on_product": true,
    "free_product_code": "JAMB001",
    "assortment_type": 0,
    "details": [{
      "promo_type": 3,
      "minimum_value": 5,
      "amount": 1,
      "repeating": true
    }]
  }]
}'
```

---

## Support et Contact

Pour toute question ou problème:

1. Vérifier les logs: `storage/logs/laravel.log`
2. Utiliser le script de debug: `php check_promo.php`
3. Consulter cette documentation
4. Contacter l'équipe backend

---

**Version**: 1.0  
**Dernière mise à jour**: 26 Décembre 2025  
**Auteur**: Équipe Backend FoodSolution
