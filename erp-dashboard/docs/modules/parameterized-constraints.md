# Parameterized Constraints — Guide d'utilisation

## Vue d'ensemble

Le moteur de transition de workflow supporte deux formats de contraintes dans `condition_group` :

**Format legacy** (rétrocompatible — rien à changer) :
```json
{
  "operator": "AND",
  "conditions": [
    "App\\Constraints\\CreditLimitConstraint"
  ]
}
```

**Format paramétré** (nouveau — thresholds modifiables depuis la DB) :
```json
{
  "operator": "AND",
  "conditions": [
    {
      "class": "App\\Constraints\\CreditLimitConstraint",
      "parameters": {
        "max_amount": 10000,
        "credit_buffer_percentage": 5,
        "bypass_payment_methods": ["Virement"]
      }
    }
  ]
}
```

Les deux formats coexistent dans le même `conditions[]`. Le resolver les détecte automatiquement.

---

## Contraintes paramétrables disponibles

### `GenericFlexiConstraint` ⭐ Évaluateur universel

Contrainte générique zero-déploiement. Évalue n'importe quelle propriété de n'importe quel modèle — entièrement piloté par le JSON en DB. **Aucune nouvelle classe PHP requise pour les règles ad-hoc.**

**Classe :** `App\Constraints\GenericFlexiConstraint`

| Paramètre | Type | Description |
|-----------|------|-------------|
| `target` | `string` | Chemin dot-notation sur le sujet (`"items"`, `"partner.credit_limit"`) |
| `property` | `string\|null` | Clé à extraire de chaque élément quand `target` est une collection |
| `operator` | `string` | Opérateur logique (voir tableau ci-dessous) |
| `value` | `mixed` | Valeur de comparaison (dépend de l'opérateur) |
| `label` | `string\|null` | Nom lisible affiché dans les violations |
| `message` | `string\|null` | Message de violation personnalisé |

**Opérateurs disponibles :**

| Opérateur | Alias | Cible | Description |
|-----------|-------|-------|-------------|
| `==` | `EQUALS` | Scalaire | Égalité stricte |
| `!=` | `NOT_EQUALS` | Scalaire | Inégalité |
| `>` | `GT` | Numérique | Supérieur à |
| `>=` | `GTE` | Numérique | Supérieur ou égal |
| `<` | `LT` | Numérique | Inférieur à |
| `<=` | `LTE` | Numérique | Inférieur ou égal |
| `CONTAINS` | — | Collection / String | Contient la valeur |
| `NOT_CONTAINS` | — | Collection / String | Ne contient PAS la valeur |
| `IN` | — | Scalaire | La valeur est dans un tableau |
| `NOT_IN` | — | Scalaire | La valeur n'est PAS dans un tableau |
| `EMPTY` | — | Collection / String | Est vide |
| `NOT_EMPTY` | — | Collection / String | N'est pas vide |
| `BETWEEN` | — | Numérique | Entre `value[0]` et `value[1]` (inclusif) |
| `REGEX` | — | String | Correspond au pattern PCRE |

---

**Exemple 1 — Product Boost : forcer une révision si le produit boosté est absent du panier**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "orderProducts",
    "property": "product_id",
    "operator": "CONTAINS",
    "value":    122,
    "label":    "Produit boost #122 requis dans la commande"
  }
}
```
→ Bloqué si `product_id 122` est **absent** des lignes de commande.

**Exemple 2 — Bloquer une méthode de paiement spécifique**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "payment_method",
    "operator": "NOT_EQUALS",
    "value":    "Espèce",
    "label":    "Paiement espèce non autorisé pour ce workflow"
  }
}
```

**Exemple 3 — Bloquer si le montant est hors fourchette**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "total_amount",
    "operator": "BETWEEN",
    "value":    [500, 50000],
    "label":    "Montant BC hors fourchette autorisée (500–50 000 MAD)"
  }
}
```

**Exemple 4 — Vérifier que la note de commande contient un code campagne**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "bc_notes",
    "operator": "REGEX",
    "value":    "/CAMP-[0-9]{4}/",
    "label":    "Code campagne requis dans les notes"
  }
}
```

**Exemple 5 — Combinaison dans un AND : boost + montant min**
```json
{
  "operator": "AND",
  "conditions": [
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "orderProducts",
        "property": "product_id",
        "operator": "CONTAINS",
        "value": 122
      }
    },
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "total_amount",
        "operator": ">=",
        "value": 1000
      }
    }
  ]
}
```

---

### `BcAutoValidationConstraint`

Contrainte composite pour la validation automatique des bons de commande.

**Classe :** `App\Constraints\BcAutoValidationConstraint`

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `max_cash_amount` | `float\|null` | `null` | Montant max (MAD) pour paiement en espèces |
| `blocked_payment_methods` | `string[]` | `[]` | Méthodes de paiement bloquant l'auto-validation |
| `require_credit_check` | `bool` | `true` | Vérifier le plafond crédit partenaire |
| `credit_buffer_percentage` | `float` | `0` | Marge de sécurité (% du plafond crédit) |
| `require_partner_active` | `bool` | `true` | Bloquer si le partenaire est inactif |
| `require_price_list` | `bool` | `false` | Exiger une liste de prix sur le partenaire |
| `max_bc_amount` | `float\|null` | `null` | Plafond absolu par BC toutes méthodes confondues |

**Exemple — règle standard** :
```json
{
  "class": "App\\Constraints\\BcAutoValidationConstraint",
  "parameters": {
    "max_cash_amount": 10000,
    "blocked_payment_methods": ["Espèce"],
    "require_credit_check": true,
    "credit_buffer_percentage": 5,
    "require_partner_active": true
  }
}
```

---

### `CreditLimitConstraint`

Vérification du plafond crédit partenaire, avec paramètres optionnels.

**Classe :** `App\Constraints\CreditLimitConstraint`

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `max_amount` | `float\|null` | `null` | Plafond absolu par BC indépendant du crédit |
| `credit_buffer_percentage` | `float` | `0` | Marge de sécurité (% du plafond) |
| `bypass_payment_methods` | `string[]` | `[]` | Méthodes qui court-circuitent le check crédit |

---

## Comment créer une contrainte paramétrable

1. Implémenter `App\Contracts\Constraint`
2. Ajouter `use HasConstraintParameters;`
3. Lire les seuils via `$this->param()` / `$this->paramFloat()` / `$this->paramArray()`

```php
use App\Concerns\HasConstraintParameters;
use App\Contracts\Constraint;
use App\ValueObjects\{Context, ConstraintResult};

class MyCustomConstraint implements Constraint
{
    use HasConstraintParameters;

    public function name(): string { return 'my_custom_check'; }

    public function check(Context $context): ConstraintResult
    {
        // Lire un seuil admin-configurable (défaut: 5000)
        $threshold = $this->paramFloat('threshold', 5000.0);

        if ($context->subject->total_amount > $threshold) {
            return ConstraintResult::violated($this->name(), "Amount exceeds {$threshold}");
        }

        return ConstraintResult::satisfied($this->name());
    }

    public function explanation(): string { return 'Custom threshold check'; }

    // withParameters() est fourni automatiquement par le trait
}
```

---

## Helpers du trait `HasConstraintParameters`

| Méthode | Signature | Description |
|---------|-----------|-------------|
| `param()` | `param(string $key, mixed $default = null): mixed` | Lire un paramètre quelconque |
| `paramFloat()` | `paramFloat(string $key, float $default = 0.0): float` | Lire un paramètre comme float |
| `paramArray()` | `paramArray(string $key, array $default = []): array` | Lire un paramètre comme tableau |
| `hasParam()` | `hasParam(string $key): bool` | Vérifier si un paramètre est défini |
| `withParameters()` | `withParameters(array $params): static` | Injecter les paramètres (appelé par le resolver) |

---

## Modifier un seuil depuis l'Admin UI (Phase 2)

Un admin peut modifier `max_cash_amount` de 10 000 à 15 000 MAD directement dans la table `workflow_transition_rules`, colonne `condition_group`, **sans aucun redéploiement backend**.

```sql
-- Exemple de mise à jour directe (Phase 1)
UPDATE workflow_transition_rules
SET condition_group = JSON_SET(
    condition_group,
    '$.conditions[0].parameters.max_cash_amount',
    15000
)
WHERE id = <rule_id>;
```

En Phase 2, l'admin UI proposera un formulaire dédié qui génère ce JSON automatiquement.

---

## Ordre d'évaluation dans `BcAutoValidationConstraint`

Les règles s'évaluent dans l'ordre suivant (short-circuit au premier blocage) :

1. **Partenaire actif** (`require_partner_active`)
2. **Montant BC max absolu** (`max_bc_amount`)
3. **Méthodes de paiement bloquées** (`blocked_payment_methods`)
4. **Plafond espèces** (`max_cash_amount`)
5. **Plafond crédit partenaire** (`require_credit_check` + `credit_buffer_percentage`)
6. **Liste de prix** (`require_price_list`)

---

## Guide d'intégration UI (API Reference)

Cette section documente les endpoints exposés au tableau de bord (Developer Dashboard) pour exploiter le moteur de workflow, le registre des décisions et les configurations dynamiques.

### 1. Point d'entrée des écrans de Workflow (Obligatoire)

**Endpoint :** `GET /api/backend/workflow/{modelType}/{id}/context`

Il s'agit du point d'entrée **unique et obligatoire** pour tout écran nécessitant l'affichage d'un modèle avec son workflow (ex: Validation BC, Revue BP).

* **Pourquoi ?** Remplace l'ancien double appel (`GET /show...` puis `GET /decisions`) qui créait des "race conditions" (désynchronisation entre les données du modèle affiché et les actions réellement possibles).
* **Ce qu'il retourne :** Une réponse atomique fusionnant :
  * Les détails du modèle (sous la clé `detail`).
  * Les états métiers : `model_status` (statut global) et potentiellement `shortage_phase`.
  * La liste `decisions` disponibles (avec les `allowed_roles`, `risk_level`, et le schéma des champs requis pour générer la modale d'action).

### 2. Catalogue des Décisions (Admin / Root)

**Endpoint :** `GET /api/backend/workflow/catalog`

Expose le registre complet de toutes les décisions déclarées dans le code source (`config/decisions.php`), pour tous les types de modèles.

* **Usage Dashboard :** Permet à l'UI Admin de lister toutes les actions possibles, d'afficher leurs niveaux de risque (`risk_level`), les rôles autorisés (`allowed_roles`), et leurs champs de formulaire (`fields`).
* **Note:** Ce registre dicte les règles d'accès réelles. Ce point de terminaison est en *lecture seule*, car toute modification de politique d'accès ou de risque requiert un déploiement sécurisé.

### 3. Diagnostic des Configurations Workflow (Diff)

**Endpoint :** `GET /api/backend/workflow-config/{id}/decision-registry-diff`

Cet outil d'audit compare les étapes configurées par un administrateur en base de données (ce qu'il a dessiné sur l'interface graphique) avec le registre des décisions PHP.

* **Usage Dashboard :** L'UI l'utilise pour afficher des avertissements à l'administrateur, par exemple :
  * **`registry_only`** : Des décisions codées en backend mais que l'admin a oublié d'intégrer dans son dessin de workflow.
  * **`db_only`** : Des actions dessinées par l'admin qui n'existent pas ou plus dans le code backend (boutons morts).

### 4. Sauvegarde des Configurations Workflow

**Endpoints :**
* `POST /api/backend/workflow-config`
* `PUT /api/backend/workflow-config/{id}`

Lors de la création ou mise à jour de la définition visuelle d'un workflow, l'API renvoie désormais une clé `_advisory` dans sa réponse de succès.

* **Usage Dashboard :** Afficher cette note de type "avertissement informatif" (toaster ou info box) pour rappeler à l'administrateur que le schéma qu'il modifie dicte le routage visuel et l'historique, mais que la *permission métier stricte* reste sécurisée par le catalogue backend (`config/decisions.php`).

### 5. Spécifications de la structure du payload JSON (`GET /context`)

Voici un exemple explicite du contrat montrant comment la réponse unifiée encapsule les détails de l'entité, les métadonnées de gestion d'état et le tableau des décisions disponibles :

```json
{
  "model_status": "awaiting_shortage_review",
  "model_detail_url": "/api/backend/bon-preparation/42",
  "shortage_phase": "partial_shortage",
  "detail": {
    "id": 42,
    "code": "BP-2026-0004",
    "total_amount": 15500.00
  },
  "decisions": [
    {
      "key": "review_partial_preparation",
      "label": "Examiner la pénurie",
      "allowed_roles": ["dispatcher", "admin"],
      "risk_level": "medium",
      "confirm": true,
      "fields": [
        {
          "name": "comment",
          "type": "textarea",
          "required": true,
          "label": "Raison de validation"
        }
      ]
    }
  ]
}
```

### 6. Mandat de rendu UI : Le constructeur de formulaires dynamiques

> [!IMPORTANT]
> L'équipe UI **ne doit en aucun cas** coder en dur des modales de confirmation individuelles pour les actions.

L'équipe front-end doit analyser de manière générique le tableau de schéma `fields[]` fourni par les endpoints `/context` ou `/catalog`. Si une décision requiert des champs (par exemple, `type: "textarea"`), l'interface utilisateur doit rendre les éléments de saisie correspondants de manière dynamique.

### 7. Blueprint DTO du moteur de règles (Formulaires UI Admin Phase 2)

Pour préparer l'équipe du tableau de bord d'administration à la mise à jour des règles en Phase 2, voici la structure JSON attendue lors du chaînage de règles à l'intérieur du bloc `condition_group`. Cela illustre comment notre `GenericFlexiConstraint` (avec les champs `target`, `operator`, `value`, etc.) sera configurée via un formulaire structuré côté admin :

```json
{
  "operator": "AND",
  "conditions": [
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "order.payment_method",
        "operator": "==",
        "value": "Espèce"
      }
    },
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "order.total_amount",
        "operator": "<",
        "value": 10000
      }
    }
  ]
}
```
