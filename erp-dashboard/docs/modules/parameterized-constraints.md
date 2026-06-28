# Moteur Workflow & Contraintes Paramétrées — Guide complet

> **Audience :** Équipe UI / Dashboard Admin.
> Ce document couvre l'architecture complète du moteur, les API à consommer, les formats de données attendus, et les patterns d'intégration à respecter pour chaque écran piloté par un workflow.

---

## Table des matières

1. [Architecture générale](#1-architecture-générale)
2. [Flux d'une décision — du clic au DB](#2-flux-dune-décision--du-clic-au-db)
3. [Workflows standards et leurs étapes](#3-workflows-standards-et-leurs-étapes)
4. [API Reference — Workflow Engine](#4-api-reference--workflow-engine)
5. [API Reference — Configuration (Admin)](#5-api-reference--configuration-admin)
6. [Contraintes paramétrables disponibles](#6-contraintes-paramétrables-disponibles)
7. [Guards vs Contraintes — différences clés pour l'UI](#7-guards-vs-contraintes--différences-clés-pour-lui)
8. [Système de priorité des règles de transition](#8-système-de-priorité-des-règles-de-transition)
9. [Activation des règles via le Ledger Table (Admin)](#9-activation-des-règles-via-le-ledger-table-admin)
10. [Formulaires dynamiques — rendu depuis `fields[]`](#10-formulaires-dynamiques--rendu-depuis-fields)
11. [Gestion des erreurs et des violations](#11-gestion-des-erreurs-et-des-violations)
12. [Idempotency — guide d'utilisation](#12-idempotency--guide-dutilisation)
13. [Comment créer une contrainte paramétrable](#13-comment-créer-une-contrainte-paramétrable)
14. [Registre des décisions par modèle](#14-registre-des-décisions-par-modèle)
15. [Système de contraintes legacy (deprecated)](#15-système-de-contraintes-legacy-deprecated)
16. [Checklist de test UI](#16-checklist-de-test-ui)
17. [Glossaire](#17-glossaire)

---

## 1. Architecture générale

```
┌──────────────────────────────────────────────────────────────────────┐
│                          UI / Dashboard                              │
│                                                                      │
│   GET /context  ──────────────────────────────────┐                 │
│   POST /execute  ─────────────────────────────────┤                 │
│   GET /history   ─────────────────────────────────┘                 │
└─────────────────────────┬────────────────────────────────────────────┘
                          │  HTTP
                          ▼
┌──────────────────────────────────────────────────────────────────────┐
│                    WorkflowController (Backend)                      │
│   • Résout le modèle (bon-commande, bon-livraison, …)               │
│   • Résout la Decision depuis config/decisions.php                   │
│   • Appelle evaluate() → execute() sous DB::transaction             │
└──────────┬───────────────────────┬───────────────────────────────────┘
           │                       │
           ▼                       ▼
┌──────────────────┐   ┌──────────────────────────────────────────────┐
│ DecisionPolicy   │   │           AbstractDecision                   │
│ Service          │   │                                              │
│ • Role check     │   │  evaluate():                                 │
│ • Branch check   │   │    0. Policy (role + branche)                │
└──────────────────┘   │    1. Workflow state (allowedFromStates)     │
                       │    2. Constraints[] (App\Contracts\Constraint)│
                       │    3. validate() hook                        │
                       │                                              │
                       │  execute():                                  │
                       │    • Idempotency gate                        │
                       │    • doExecute() (side-effects)              │
                       │    • WorkflowEngineService::transition()     │
                       └───────────────┬──────────────────────────────┘
                                       │
                                       ▼
                       ┌──────────────────────────────────────────────┐
                       │          WorkflowEngineService               │
                       │                                              │
                       │  transition():                               │
                       │    1. TransitionRuleResolver                 │
                       │       → évalue condition_group (JSON DB)     │
                       │    2. GuardPipeline                          │
                       │       → block / warn / auto_approve          │
                       │    3. WorkflowService::transition()          │
                       │       → met à jour current_step              │
                       │    4. Spawn tâches (WorkflowTaskTemplate)    │
                       │    5. Events (WorkflowTransitioned)          │
                       └──────────────────────────────────────────────┘
```

**Résumé des couches :**

| Couche | Rôle | Configuré où |
|--------|------|--------------|
| `config/decisions.php` | Registre des décisions : classe, rôles, risk_level | PHP (déploiement) |
| `AbstractDecision::$constraints` | Contraintes PHP déclaratives par décision | PHP (déploiement) |
| `workflow_transition_rules.condition_group` | Règles de routage entre étapes | **DB (admin UI)** |
| `workflow_transition_guards` | Seuils de validation lors de la transition | **DB (admin UI)** |

---

## 2. Flux d'une décision — du clic au DB

### Scénario : l'ADV clique "Approuver la commande"

```
1. UI appelle GET /api/backend/workflow/bon-commande/42/context
   → reçoit { detail: {...}, decisions: [{key: "approve_order", fields: [...]}] }

2. L'utilisateur remplit la modale (champs dynamiques depuis fields[])

3. UI appelle POST /api/backend/workflow/bon-commande/42/execute
   Body: { decision: "approve_order", metadata: { comment: "OK crédit vérifié" } }
   Header: Idempotency-Key: <uuid>

4. Backend:
   a. DecisionPolicyService vérifie que l'user a le rôle 'adv'
   b. ApproveOrderDecision::evaluate() passe (commande en état 'submitted')
   c. ApproveOrderDecision::doExecute() s'exécute
   d. WorkflowEngineService::transition() → 'submitted' → 'confirmed'
   e. TransitionRuleResolver évalue les condition_group actives
   f. GuardPipeline vérifie les guards (seuils crédit, etc.)
   g. WorkflowTransitioned event dispatché

5. UI reçoit { success: true, data: { new_status: "confirmed", ... } }

6. UI raffraîchit via GET /context → nouveaux boutons disponibles
```

### États possibles d'une réponse `/execute`

| HTTP | Signification | Action UI |
|------|---------------|-----------|
| `200` | Décision exécutée avec succès | Rafraîchir le contexte |
| `409` | Déjà exécuté (idempotency hit) | Rafraîchir le contexte (résultat identique) |
| `422` | Violations de validation | Afficher les erreurs dans la modale |
| `403` | Rôle insuffisant ou branche incorrecte | Toast d'erreur, masquer le bouton |
| `400` | Payload invalide (champs manquants) | Validation côté formulaire |

---

## 3. Workflows standards et leurs étapes

### 3.1 Bon de Commande — `bc_validation`

```
[draft] ──► [submitted] ──► [confirmed] ──► [converted_to_do]
                │                                    │
                ├──► [in_review]                     └──► [converted_to_bl]
                │
                ├──► [pending_derogation]
                │
                ├──► [pending_cancellation]
                │
                ├──► [on_hold]
                │
                ├──► [rejected]
                └──► [cancelled]
```

| Code étape | Nom | Initial | Final | Actions disponibles |
|------------|-----|---------|-------|---------------------|
| `draft` | Brouillon | ✅ | — | `submit_order` |
| `submitted` | Soumis ADV | — | — | `approve_order`, `reject_order`, `hold_order`, `request_credit_derogation` |
| `in_review` | En révision | — | — | `approve_order`, `reject_order`, `request_derogation` |
| `on_hold` | En attente | — | — | `resume_order` |
| `pending_derogation` | Dérogation CDZ | — | — | `approve_derogation`, `reject_derogation` |
| `pending_cancellation` | Annulation CDZ | — | — | `approve_cancellation`, `reject_order` |
| `confirmed` | Confirmé | — | — | `finalize_sale`, `split_order`, `cancel_order` |
| `converted_to_do` | Converti en DO | — | — | — |
| `converted_to_bl` | Converti en BL | — | ✅ | — |
| `rejected` | Rejeté | — | ✅ | — |
| `cancelled` | Annulé | — | ✅ | — |

---

### 3.2 Bon de Livraison — `bl_delivery`

```
[draft] ──► [split] ──► [grouped] ──► [submitted_to_magasinier]
                                               │
                                         [prepared] ──► [loaded] ──► [in_transit]
                                                                           │
                                                             ┌─────────────┤
                                                             ▼             ▼
                                                       [delivered]  [delivery_failed]
                                                             │             │
                                                             │       [partially_delivered]
                                                             │             │
                                                          [returned] ◄────┘
                                                          [cancelled]
```

| Code étape | Rôle principal |
|------------|----------------|
| `draft` | ADV / Système |
| `split` | Dispatcher |
| `grouped` | Dispatcher (groupé en BCH) |
| `submitted_to_magasinier` | Magasinier |
| `prepared` | Magasinier |
| `loaded` | Dispatcher / Chauffeur |
| `in_transit` | Chauffeur / Livreur |
| `delivered` | Chauffeur (confirmation) |
| `delivery_failed` | Chauffeur |
| `partially_delivered` | Chauffeur / Dispatcher |
| `returned` | Magasinier |
| `cancelled` | ADV / Admin |

---

### 3.3 Bon de Préparation — `bp_preparation`

```
[pending] ──► [in_progress] ──► [completed_full]
                    │
                    └──► [completed_partial] ──► [awaiting_shortage_review]
                                                          │
                                         ┌────────────────┤
                                         ▼                ▼
                                [shortage_accepted]  [partial_rework_requested]
                                         │                │
                                         └────────┬───────┘
                                                  ▼
                                         [shortage_split_done]
                                         [rejected]
```

---

### 3.4 BCH (Bon de Chargement / Handover) — `bch_approval`

| Ordre | Code étape |
|-------|------------|
| 1 | `pending` |
| 2 | `in_preparation` |
| 3 | `prepared` |
| 4 | `confirmed` |
| 5 | `in_transit` |
| 6 | `delivery_failed` |
| 7 | `completed` |
| 8 | `closed` |
| 9 | `cancelled` |

---

## 4. API Reference — Workflow Engine

> Base URL : `/api/backend/workflow/`
> Authentification : `Bearer {token}` + rôle selon la décision

---

### `GET /{modelType}/{id}/context` ⭐ Point d'entrée obligatoire

Retourne **en un seul appel** : les détails du modèle + les décisions disponibles pour l'utilisateur courant.

**Modèles supportés :** `bon-commande`, `bon-livraison`, `bon-preparation`, `delivery-mission`

**Réponse complète :**

```json
{
  "model_status": "submitted",
  "model_detail_url": "/api/backend/bon-commande/42",
  "shortage_phase": null,
  "detail": {
    "id": 42,
    "bc_number": "BC-2026-00042",
    "bc_status": "submitted",
    "total_amount": 8500.00,
    "payment_method": "Virement",
    "partner": {
      "id": 7,
      "name": "Épicerie Atlas",
      "credit_limit": 50000,
      "credit_used": 12000
    },
    "workflow_instance": {
      "current_step": "submitted",
      "current_step_label": "Soumis ADV"
    }
  },
  "decisions": [
    {
      "key": "approve_order",
      "label": "Approuver la commande",
      "description": "Valider et confirmer le bon de commande.",
      "allowed_roles": ["adv", "admin"],
      "risk_level": "medium",
      "confirm": true,
      "danger": false,
      "available": true,
      "fields": [
        {
          "name": "comment",
          "type": "textarea",
          "label": "Commentaire ADV",
          "required": false,
          "placeholder": "Observations éventuelles…"
        }
      ]
    },
    {
      "key": "reject_order",
      "label": "Rejeter la commande",
      "allowed_roles": ["adv", "admin"],
      "risk_level": "high",
      "confirm": true,
      "danger": true,
      "available": true,
      "fields": [
        {
          "name": "reason",
          "type": "textarea",
          "label": "Motif de rejet",
          "required": true,
          "min_length": 10
        }
      ]
    }
  ]
}
```

**Règles d'affichage UI :**
- Ne montrer que les décisions où `available: true`
- Appliquer `danger: true` → style bouton destructif (rouge)
- Appliquer `confirm: true` → ouvrir une modale de confirmation avant d'exécuter
- `risk_level: "high"` ou `"critical"` → afficher un avertissement supplémentaire
- Si `decisions` est vide → afficher un état "Aucune action disponible"

---

### `POST /{modelType}/{id}/execute`

Exécute une décision. **Toujours appeler `/context` en amont pour obtenir la liste des décisions valides.**

**Headers requis :**
```
Authorization: Bearer {token}
Idempotency-Key: {uuid-v4}
Content-Type: application/json
```

**Body :**
```json
{
  "decision": "approve_order",
  "metadata": {
    "comment": "Crédit vérifié, commande conforme.",
    "approved_at": "2026-06-27T10:30:00Z"
  }
}
```

**Réponse succès (200) :**
```json
{
  "success": true,
  "decision": "approve_order",
  "new_status": "confirmed",
  "message": "Commande approuvée avec succès.",
  "data": {
    "order_id": 42,
    "bc_number": "BC-2026-00042",
    "previous_status": "submitted",
    "new_status": "confirmed",
    "transitioned_at": "2026-06-27T10:30:05Z"
  }
}
```

**Réponse violation (422) :**
```json
{
  "success": false,
  "message": "Validation failed",
  "violations": [
    {
      "constraint": "bc_auto_validation",
      "reason": "Crédit insuffisant. Disponible: 3 200,00 MAD, Requis: 8 500,00 MAD",
      "metadata": {
        "available": 3200.0,
        "required": 8500.0,
        "rule": "credit_limit",
        "can_request_override": true
      }
    }
  ]
}
```

> **Note :** quand `can_request_override: true` est présent dans une violation, proposer à l'utilisateur le bouton "Demander une dérogation" (`request_credit_derogation`).

---

### `POST /{modelType}/{id}/validate`

Évalue une décision **sans l'exécuter** (dry-run). Utile pour valider les champs d'un formulaire en temps réel avant soumission.

**Body :** identique à `/execute`

**Réponse :** même structure qu'un 422 de `/execute`, ou `{ "success": true, "can_execute": true }` si tout passe.

---

### `GET /{modelType}/{id}/decisions`

Retourne uniquement la liste des décisions (sans `detail`). Moins cher que `/context`. À utiliser quand le détail est déjà chargé et que seules les actions ont changé.

---

### `GET /{modelType}/{id}/history`

Historique complet des transitions et exécutions de décisions.

```json
{
  "history": [
    {
      "id": 1,
      "decision": "submit_order",
      "from_step": "draft",
      "to_step": "submitted",
      "actor": { "id": 12, "name": "Karim Idrissi" },
      "executed_at": "2026-06-27T09:15:00Z",
      "metadata": {}
    },
    {
      "id": 2,
      "decision": "approve_order",
      "from_step": "submitted",
      "to_step": "confirmed",
      "actor": { "id": 5, "name": "Yasmine ADV" },
      "executed_at": "2026-06-27T10:30:05Z",
      "metadata": { "comment": "Crédit vérifié" }
    }
  ]
}
```

---

### `GET /catalog` *(admin/root seulement)*

Registre complet de toutes les décisions déclarées dans `config/decisions.php`.

```json
{
  "bon-commande": {
    "submit_order": {
      "class": "App\\Decisions\\Adv\\SubmitOrderDecision",
      "allowed_roles": ["adv", "admin", "sfa_van_sales", "sfa_order_taker"],
      "risk_level": "low",
      "schema": {
        "label": "Soumettre la commande",
        "confirm": false,
        "danger": false,
        "fields": []
      }
    },
    "approve_order": { "..." : "..." }
  },
  "bon-livraison": { "..." : "..." }
}
```

---

## 5. API Reference — Configuration (Admin)

> ⚠️ **Deux préfixes distincts** selon le groupe de routes :
> - **`/api/backend/workflow-config/`** — CRUD des définitions et étapes (géré par `WorkflowConfigController`)
> - **`/api/workflow-definitions/`** et **`/api/workflow-steps/`** — API REST publique (géré par `WorkflowDefinitionController` / `WorkflowTransitionRuleController`, chargé dans `routes/api/workflow.php`)

Ces endpoints permettent à l'interface admin de gérer les **définitions visuelles** des workflows (étapes, transitions autorisées). Les permissions métier strictes restent dans `config/decisions.php` côté PHP.

### `GET /workflow-config`

Liste paginée des définitions de workflows.

```json
{
  "current_page": 1,
  "data": [
    {
      "id": 1,
      "code": "bc_validation",
      "name": "Validation Bon de Commande",
      "model_type": "App\\Models\\Order",
      "is_active": true,
      "templates_count": 3
    }
  ],
  "total": 4
}
```

### `GET /workflow-config/{id}`

Détail complet : définition + étapes ordonnées + statistiques d'utilisation.

```json
{
  "workflow": {
    "id": 1,
    "code": "bc_validation",
    "name": "Validation Bon de Commande",
    "is_active": true,
    "templates": [...]
  },
  "steps": [
    {
      "id": 10,
      "code": "draft",
      "name": "Brouillon",
      "order": 1,
      "is_initial": true,
      "is_final": false,
      "allowed_transitions": ["submitted"]
    }
  ],
  "stats": {
    "total_instances": 1240,
    "active_instances": 38,
    "completed_instances": 1202
  }
}
```

> ⚠️ **Ne pas utiliser** `GET /api/backend/workflows/{id}` — cet endpoint n'expose pas le détail des étapes.

---

### `GET /api/workflow-definitions` *(API publique — préfixe `/api/`)*

Équivalent REST pour les clients API. Même données, via `WorkflowDefinitionController`.

> **URL complète :** `http://localhost:8000/api/workflow-definitions`

### `GET /api/workflow-definitions/{id}/steps`

Liste les étapes d'une définition avec leurs `allowed_transitions[]` — utile pour dessiner le graphe de navigation.

> **URL complète :** `http://localhost:8000/api/workflow-definitions/1/steps`

### `GET /api/workflow-steps/{step}/rules` *(préfixe `/api/`, **pas** `/api/backend`)*

> **URL correcte :** `http://localhost:8000/api/workflow-steps/1/rules`

Liste les règles de transition (`workflow_transition_rules`) attachées à une étape donnée. **Ce n'est PAS sous `/api/backend/`.**

```json
[
  {
    "id": 5,
    "workflow_step_id": 10,
    "target_step_code": "confirmed",
    "priority": 20,
    "is_active": true,
    "condition_group": {
      "operator": "AND",
      "conditions": [
        "App\\Constraints\\CreditLimitConstraint"
      ]
    }
  },
  {
    "id": 9,
    "workflow_step_id": 10,
    "target_step_code": "confirmed",
    "priority": 100,
    "is_active": false,
    "condition_group": {
      "operator": "AND",
      "conditions": [
        {
          "class": "App\\Constraints\\BcAutoValidationConstraint",
          "parameters": {
            "max_cash_amount": 10000,
            "blocked_payment_methods": ["Espèce", "cash"],
            "require_credit_check": true,
            "credit_buffer_percentage": 5
          }
        }
      ]
    }
  }
]
```

### `PUT /api/workflow-steps/{step}/rules/{rule}`

Mettre à jour une règle — notamment activer/désactiver via `is_active`.

```json
{
  "is_active": true,
  "condition_group": {
    "operator": "AND",
    "conditions": [
      {
        "class": "App\\Constraints\\BcAutoValidationConstraint",
        "parameters": {
          "max_cash_amount": 15000
        }
      }
    ]
  }
}
```

---

## 6. Contraintes paramétrables disponibles

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

**Exemple 1 — Bloquer si méthode paiement est espèces :**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "payment_method",
    "operator": "IN",
    "value":    ["Espèce", "espece", "cash", "نقدا", "comptant"],
    "label":    "bc.cash_payment_method_check",
    "message":  "Le mode de paiement espèce nécessite une validation manuelle ADV."
  }
}
```

**Exemple 2 — Montant BC dans une fourchette :**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "total_amount",
    "operator": "BETWEEN",
    "value":    [1000, 50000],
    "label":    "Montant BC hors fourchette (1 000–50 000 MAD)"
  }
}
```

**Exemple 3 — Produit boost requis dans les lignes de commande :**
```json
{
  "class": "App\\Constraints\\GenericFlexiConstraint",
  "parameters": {
    "target":   "orderProducts",
    "property": "product_id",
    "operator": "CONTAINS",
    "value":    122,
    "label":    "Produit boost #122 requis"
  }
}
```

**Exemple 4 — Combinaison AND :**
```json
{
  "operator": "AND",
  "conditions": [
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "total_amount",
        "operator": ">=",
        "value": 1000
      }
    },
    {
      "class": "App\\Constraints\\GenericFlexiConstraint",
      "parameters": {
        "target": "total_amount",
        "operator": "<=",
        "value": 10000
      }
    }
  ]
}
```

---

### `BcAutoValidationConstraint`

Contrainte composite pour la **validation automatique des bons de commande** en un seul bloc configurable. Encapsule : partenaire actif, plafond absolu, méthodes de paiement bloquées, plafond espèces, crédit partenaire, liste de prix.

**Classe :** `App\Constraints\BcAutoValidationConstraint`

| Paramètre | Type | Défaut | Description |
|-----------|------|--------|-------------|
| `max_cash_amount` | `float\|null` | `null` | Montant max (MAD) pour paiement en espèces |
| `blocked_payment_methods` | `string[]` | `[]` | Méthodes bloquant l'auto-validation |
| `require_credit_check` | `bool` | `true` | Vérifier le plafond crédit partenaire |
| `credit_buffer_percentage` | `float` | `0` | Marge de sécurité (% du plafond crédit) |
| `require_partner_active` | `bool` | `true` | Bloquer si le partenaire est inactif |
| `require_price_list` | `bool` | `false` | Exiger une liste de prix sur le partenaire |
| `max_bc_amount` | `float\|null` | `null` | Plafond absolu par BC toutes méthodes confondues |

**Exemple — règle standard déploiement** :
```json
{
  "class": "App\\Constraints\\BcAutoValidationConstraint",
  "parameters": {
    "max_cash_amount": 10000,
    "blocked_payment_methods": ["Espèce", "espece", "cash", "نقدا", "comptant"],
    "require_credit_check": true,
    "credit_buffer_percentage": 5,
    "require_partner_active": true,
    "require_price_list": false,
    "max_bc_amount": 50000
  }
}
```

**Ordre d'évaluation (short-circuit au premier blocage) :**

1. **Partenaire actif** (`require_partner_active`)
2. **Plafond BC absolu** (`max_bc_amount`) — toutes méthodes confondues
3. **Méthodes bloquées** (`blocked_payment_methods`) — ignoré si `payment_method` est null
4. **Plafond espèces** (`max_cash_amount`) — uniquement si `payment_method` n'est pas null et est une méthode cash
5. **Crédit partenaire** (`require_credit_check` + `credit_buffer_percentage`)
6. **Liste de prix** (`require_price_list`)

> **Note :** les vérifications 3 et 4 sont silencieuses quand `payment_method` est null sur le BC. Utiliser un `GenericFlexiConstraint NOT_EMPTY` en amont si le champ est obligatoire.

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

## 7. Guards vs Contraintes — différences clés pour l'UI

C'est la distinction la plus importante à comprendre pour afficher le bon comportement dans l'interface.

### Contraintes (`condition_group`)

- Évaluées **avant** la transition — elles décident **si une règle de routage s'applique**
- Résultat binaire : `satisfied` ou `violated`
- Quand une contrainte est violée sur une règle de priorité N, le resolver essaie la règle N+1
- L'UI reçoit les violations en tant qu'erreurs structurées dans le 422

### Guards (`workflow_transition_guards`)

- Évaluées **au moment de la transition** — ils décident **comment** la transition se comporte
- Trois niveaux de sévérité :

| Sévérité | Comportement | Rendu UI |
|----------|-------------|----------|
| `block` | Transition **bloquée** — erreur retournée | Toast d'erreur rouge, transition impossible |
| `warn` | Transition **autorisée** mais avec avertissement | Modal de confirmation avec bandeau orange |
| `auto_approve` | Transition **auto-approuvée** par le guard | Aucune interruption UI |

**Exemple de réponse guard `warn` :**
```json
{
  "success": false,
  "guard_warning": true,
  "message": "Montant commande inférieur au minimum recommandé (500 MAD). Confirmez-vous ?",
  "guard_key": "MinimumOrderAmountGuard",
  "severity": "warn",
  "can_override": true
}
```

Quand `guard_warning: true` + `can_override: true`, l'UI doit afficher un modal de confirmation secondaire avec le message du guard et deux boutons : "Annuler" / "Confirmer malgré tout".

Pour confirmer malgré un guard `warn`, renvoyer l'exécution avec le flag :
```json
{
  "decision": "approve_order",
  "metadata": { "override_guard_warning": true }
}
```

---

## 8. Système de priorité des règles de transition

Les règles dans `workflow_transition_rules` sont évaluées par priorité croissante (la plus basse d'abord). Le resolver s'arrête à la **première règle dont toutes les contraintes passent**.

### Plages de priorité utilisées

| Plage | Usage | `is_active` |
|-------|-------|-------------|
| `1–9` | Règles de déviation urgente (ex: annulation demandée) | `true` |
| `10–30` | Règles opérationnelles principales (crédit, stock) | `true` |
| `100–130` | **Templates admin pré-configurés** (WorkflowMatrixSeeder) | `false` par défaut |

### Règles opérationnelles BC (priorités 5–30)

| Priorité | Cible | Contrainte | Description |
|----------|-------|-----------|-------------|
| 5 | `pending_cancellation` | `CancellationRequestedConstraint` | Le vendeur a demandé une annulation |
| 10 | `pending_derogation` | `CreditExceededConstraint` | Crédit dépassé → CDZ |
| 20 | `confirmed` | `CreditLimitConstraint` + `StockAvailableConstraint` | Auto-confirmer si crédit OK + stock OK |
| 30 | `in_review` | `CreditLimitConstraint` | Crédit OK mais autre issue → ADV |

### Templates admin (priorités 100–130) — désactivés par défaut

Ces règles sont pré-configurées par le `WorkflowMatrixSeeder` avec `is_active = false`. L'admin les active depuis le **Ledger Table**.

| Priorité | Cible | Contrainte | Description |
|----------|-------|-----------|-------------|
| 100 | `confirmed` | `BcAutoValidationConstraint` | Composite : partenaire + crédit + paiement + montant |
| 110 | `in_review` | `GenericFlexiConstraint` (payment IN cash list) | Route les espèces vers révision manuelle |
| 120 | `in_review` | `GenericFlexiConstraint` (total_amount > 10000) | Plafond auto-validation 10 000 MAD |
| 130 | `in_review` | `GenericFlexiConstraint` (total_amount < 1000) | Plancher commande minimum 1 000 MAD |

---

## 9. Activation des règles via le Ledger Table (Admin)

> Le Ledger Table est l'interface d'administration des règles de transition. Il permet d'activer/désactiver les templates pré-configurés sans redéploiement.

### Flux d'activation (UI Admin)

```
1. Charger les règles d'une étape :
   GET /api/workflow-steps/{step_id}/rules

2. Afficher sous forme de tableau :
   ┌────────────────────────────────────────────────────────────┐
   │ Prio │ Cible      │ Contrainte              │ Statut      │
   ├──────┼────────────┼─────────────────────────┼─────────────┤
   │  100 │ confirmed  │ BcAutoValidationConstraint│ ● Inactif  │
   │  110 │ in_review  │ GenericFlexi (cash)     │ ● Inactif   │
   │  120 │ in_review  │ GenericFlexi (>10000)   │ ● Inactif   │
   │  130 │ in_review  │ GenericFlexi (<1000)    │ ● Inactif   │
   └──────────────────────────────────────────────────────────┘

3. Admin clique sur le toggle "Activer" pour la règle 100 :
   PUT /api/workflow-steps/{step_id}/rules/100
   Body: { "is_active": true }

4. Afficher un badge "Actif" sur la ligne.

5. Optionnel — modifier un paramètre (ex: changer max_cash_amount de 10000 à 15000) :
   PUT /api/workflow-steps/{step_id}/rules/100
   Body: {
     "is_active": true,
     "condition_group": {
       "operator": "AND",
       "conditions": [{
         "class": "App\\Constraints\\BcAutoValidationConstraint",
         "parameters": { "max_cash_amount": 15000, "credit_buffer_percentage": 5, ... }
       }]
     }
   }
```

### Comment afficher le résumé d'une contrainte

Le champ `label` dans les paramètres GenericFlexi + la méthode `explanation()` sur BcAutoValidationConstraint fournissent des descriptions lisibles :

```
Règle 100 → BcAutoValidationConstraint :
  "Automatic BC validation composite check. Partner must be active.
   Max BC amount: 50,000.00 MAD. Blocked payment methods: Espèce, cash.
   Max cash payment: 10,000.00 MAD. Credit check with 5% safety buffer."
```

Utiliser ces descriptions pour afficher un tooltip ou un expandable detail sur chaque ligne du tableau.

---

## 10. Formulaires dynamiques — rendu depuis `fields[]`

> **Règle impérative :** Ne jamais coder en dur une modale pour une décision spécifique. Toujours rendre dynamiquement depuis `fields[]`.

### Types de champs supportés

| `type` | Rendu | Validation |
|--------|-------|-----------|
| `text` | Input texte | `required`, `min_length`, `max_length` |
| `textarea` | Zone de texte | `required`, `min_length`, `max_length` |
| `number` | Input numérique | `required`, `min`, `max` |
| `date` | Date picker | `required`, `min_date`, `max_date` |
| `select` | Dropdown | `required`, `options[]` |
| `boolean` | Checkbox / Toggle | `required` |
| `array` | Liste d'éléments | `required`, `min_items` |

### Structure complète d'un champ

```json
{
  "name": "reason",
  "type": "textarea",
  "label": "Motif de rejet",
  "description": "Expliquez pourquoi cette commande est rejetée.",
  "required": true,
  "min_length": 10,
  "max_length": 500,
  "placeholder": "Minimum 10 caractères…"
}
```

```json
{
  "name": "new_amount",
  "type": "number",
  "label": "Nouveau montant approuvé (MAD)",
  "required": true,
  "min": 0,
  "max": 500000
}
```

```json
{
  "name": "delivery_date",
  "type": "date",
  "label": "Date de livraison souhaitée",
  "required": false,
  "min_date": "today"
}
```

### Pattern de rendu générique (pseudo-code)

```typescript
function renderDecisionModal(decision: Decision) {
  return (
    <Modal
      title={decision.label}
      confirmStyle={decision.danger ? 'destructive' : 'primary'}
      showWarning={decision.risk_level === 'high' || decision.risk_level === 'critical'}
    >
      {decision.confirm && <ConfirmationBanner />}

      <Form onSubmit={(data) => executeDecision(decision.key, data)}>
        {decision.fields.map(field => (
          <DynamicField key={field.name} {...field} />
        ))}
        <SubmitButton label={decision.label} />
      </Form>
    </Modal>
  );
}
```

### Envoi du formulaire

Les valeurs des champs vont dans `metadata` :

```json
{
  "decision": "reject_order",
  "metadata": {
    "reason": "Crédit insuffisant, partenaire en contentieux.",
    "delivery_date": null
  }
}
```

---

## 11. Gestion des erreurs et des violations

### Structure d'une violation

```json
{
  "constraint": "bc_auto_validation",
  "reason": "Cash BC amount (12 000,00 MAD) exceeds the admin-configured cash limit (10 000,00 MAD).",
  "metadata": {
    "bc_amount": 12000,
    "max_cash_amount": 10000,
    "payment_method": "Espèce",
    "rule": "max_cash_amount",
    "can_request_override": true
  }
}
```

### Champs utiles pour l'UI

| Champ | Usage UI |
|-------|----------|
| `reason` | Message à afficher directement à l'utilisateur |
| `constraint` | Identifier quel type d'erreur (pour icône / couleur) |
| `metadata.rule` | Règle spécifique violée (afficher dans un tooltip) |
| `metadata.can_request_override` | Montrer le bouton "Demander une dérogation" |
| `metadata.available` / `metadata.required` | Afficher un indicateur visuel de progression crédit |

### Codes d'erreur par `constraint`

| `constraint` | Signification | Action UI recommandée |
|-------------|---------------|----------------------|
| `workflow_state` | L'étape actuelle n'autorise pas cette décision | Masquer le bouton, rafraîchir le contexte |
| `role_permission` | Rôle insuffisant | Toast "Accès refusé", masquer le bouton |
| `bc_auto_validation` | Contrainte composite BC | Afficher détails + bouton dérogation si applicable |
| `generic_flexi_constraint` | Règle flexi violation | Afficher le `label` + `reason` |
| `credit_limit` | Crédit dépassé | Afficher indicateur crédit + bouton dérogation |
| `partner_active` | Partenaire inactif | Toast rouge, contacter l'admin |
| `invalid_status` | Statut invalide | Rafraîchir — le modèle a changé entre-temps |

---

## 12. Idempotency — guide d'utilisation

Toutes les mutations (`/execute`) **doivent** inclure un header `Idempotency-Key`.

### Règle simple

```
1 action utilisateur = 1 clé unique
```

Générer un UUID v4 côté client avant d'afficher la modale. Réutiliser la même clé si l'utilisateur retry après un timeout réseau. Générer une nouvelle clé pour chaque nouvelle ouverture de modale.

```typescript
// Générer avant d'ouvrir la modale
const idempotencyKey = crypto.randomUUID();

// Envoyer avec la requête
fetch('/api/backend/workflow/bon-commande/42/execute', {
  method: 'POST',
  headers: {
    'Idempotency-Key': idempotencyKey,
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ decision: 'approve_order', metadata: {} }),
});
```

### Comportement en cas de retry

| Scénario | Comportement backend | Réponse |
|----------|---------------------|---------|
| 1ère exécution | Exécute la décision | `200 { success: true }` |
| Retry avec même clé (décision déjà exécutée) | Retourne le résultat mis en cache | `409 { success: true, idempotent: true }` |
| Nouvelle clé, même action | Tentative d'exécution (peut échouer si état a changé) | `200` ou `422` |

> `409` avec `success: true` est un succès — l'action a déjà été appliquée. L'UI doit rafraîchir le contexte exactement comme pour un `200`.

---

## 13. Comment créer une contrainte paramétrable

Quand `GenericFlexiConstraint` ne suffit pas (logique métier complexe, accès à plusieurs relations), créer une contrainte PHP :

```php
namespace App\Constraints;

use App\Concerns\HasConstraintParameters;
use App\Contracts\Constraint;
use App\ValueObjects\{Context, ConstraintResult};

class MyCustomConstraint implements Constraint
{
    use HasConstraintParameters;

    public function name(): string
    {
        return 'my_custom_check';
    }

    public function check(Context $context): ConstraintResult
    {
        // Lire des seuils admin-configurables depuis la DB (via condition_group.parameters)
        $threshold = $this->paramFloat('threshold', 5000.0);
        $allowedCategories = $this->paramArray('allowed_categories', []);

        $order = $context->subject;

        if ($order->total_amount > $threshold) {
            return ConstraintResult::violated(
                $this->name(),
                "Montant {$order->total_amount} MAD dépasse le seuil configuré {$threshold} MAD.",
                ['amount' => $order->total_amount, 'threshold' => $threshold, 'can_request_override' => true]
            );
        }

        return ConstraintResult::satisfied($this->name());
    }

    public function explanation(): string
    {
        return "Seuil personnalisé : {$this->paramFloat('threshold', 5000)} MAD max.";
    }
}
```

**Helpers du trait `HasConstraintParameters` :**

| Méthode | Signature | Description |
|---------|-----------|-------------|
| `param()` | `param(string $key, mixed $default = null)` | Lire un paramètre quelconque |
| `paramFloat()` | `paramFloat(string $key, float $default = 0.0)` | Lire comme float |
| `paramArray()` | `paramArray(string $key, array $default = [])` | Lire comme tableau |
| `hasParam()` | `hasParam(string $key): bool` | Vérifier si défini |
| `withParameters()` | `withParameters(array $params): static` | Injecter les paramètres (appelé par le resolver) |

**Format `condition_group` pour l'utiliser :**
```json
{
  "class": "App\\Constraints\\MyCustomConstraint",
  "parameters": {
    "threshold": 8000,
    "allowed_categories": ["alimentaire", "surgele"]
  }
}
```

**Format legacy (toujours supporté, sans paramètres) :**
```json
{ "conditions": ["App\\Constraints\\MyCustomConstraint"] }
```

---

## 14. Registre des décisions par modèle

Modèles supportés et leurs décisions clés (depuis `config/decisions.php`) :

### `bon-commande`
| Clé | Rôles | Risk | Description |
|-----|-------|------|-------------|
| `submit_order` | vendeur, sfa_order_taker, adv | low | Soumettre à l'ADV |
| `approve_order` | adv, admin | medium | Approuver et confirmer |
| `reject_order` | adv, admin | high | Rejeter |
| `hold_order` | adv, admin | low | Mettre en attente |
| `resume_order` | adv, admin | low | Relancer depuis on_hold |
| `request_credit_derogation` | vendeur, sfa_order_taker | medium | Demander une dérogation crédit |
| `approve_derogation` | sfa_supervisor, admin | medium | CDZ approuve la dérogation |
| `reject_derogation` | sfa_supervisor, admin | high | CDZ rejette la dérogation |
| `split_order` | dispatcher, admin | medium | Éclater en N sous-commandes |
| `cancel_order` | dispatcher, adv, admin | high | Annuler |
| `finalize_sale` | adv, admin | medium | Finaliser la vente |
| `change_payment` | adv, admin | medium | Changer la méthode de paiement |

### `bon-livraison`
| Clé | Rôles | Risk | Description |
|-----|-------|------|-------------|
| `confirm_delivery` | chauffeur, dispatcher | medium | Confirmer la livraison |
| `update_delivery` | dispatcher, admin | low | Mettre à jour |
| `mark_delivery_failed` | chauffeur, dispatcher | high | Signaler un échec |
| `cancel_delivery` | dispatcher, admin | high | Annuler |

### `bon-preparation`
| Clé | Rôles | Risk | Description |
|-----|-------|------|-------------|
| `start_preparation` | warehouse | low | Démarrer la préparation |
| `complete_preparation` | warehouse | medium | Compléter (full) |
| `report_shortage` | warehouse | medium | Signaler une rupture |
| `accept_partial_preparation` | dispatcher | medium | Accepter la rupture |
| `review_partial_preparation` | dispatcher | medium | Réviser la rupture |
| `request_rework` | dispatcher | low | Demander une reprise |
| `reject_preparation` | dispatcher, admin | high | Rejeter |

### `delivery-mission`
| Clé | Rôles | Description |
|-----|-------|-------------|
| `create_delivery_mission` | dispatcher | Créer une mission |
| `start_delivery_mission` | chauffeur | Démarrer la mission |
| `complete_delivery_mission` | chauffeur | Compléter |
| `cancel_delivery_mission` | dispatcher, admin | Annuler |
| `reassign_delivery_mission` | dispatcher | Réassigner un chauffeur |
| `reopen_delivery_mission` | dispatcher, admin | Rouvrir |

### Autres modèles
- **`stock-allocation`** : `propose_allocation`, `confirm_allocation`, `validate_allocation`, `override_allocation`
- **`credit-derogation`** : `approve_derogation`, `reject_derogation`
- **`return-request`** : `approve_return_request`, `process_return`, `finalize_return`
- **`financial-instrument`** : `collect`, `deposit_instrument`, `register_instrument`, `clear_instrument`
- **`visit`** : `start_visit`

---

## 15. Système de contraintes legacy (deprecated)

> ⚠️ **NE PAS UTILISER** pour de nouvelles contraintes.

`app/Constraints/ConstraintInterface.php` (signature `check($context): bool`) est un système **obsolète** qui n'est plus appelé par aucun chemin de production :

- `AbstractDecision` et `TransitionRuleResolver` utilisent exclusivement `App\Contracts\Constraint`
- `ConstraintEngine` / `DecisionEngine` (seuls appelants de l'ancienne interface) ne sont pas injectés dans le flux décisionnel actuel

Les ~23 contraintes héritant de `ConstraintInterface` doivent être migrées vers `App\Contracts\Constraint`. La procédure de migration est documentée dans le docblock de `ConstraintInterface`.

**Risque :** placer une contrainte legacy dans `$constraints = [...]` d'un `AbstractDecision` provoque une **Fatal Error** au runtime (appel de `->isSatisfied()` sur un `bool`).

---

## 16. Checklist de test UI

Avant de livrer un écran de workflow, valider chacun des scénarios suivants :

### Tests de base
- [ ] `GET /context` retourne `detail` + `decisions` dans un seul appel
- [ ] Les boutons sont affichés uniquement pour les décisions `available: true`
- [ ] Les boutons avec `danger: true` ont un style destructif
- [ ] Les décisions avec `confirm: true` ouvrent une modale avant exécution
- [ ] Les champs `fields[]` sont rendus dynamiquement (ne pas coder en dur)

### Tests de permissions
- [ ] Un utilisateur sans le bon rôle ne voit pas les boutons (`decisions` = [])
- [ ] Un `403` depuis `/execute` est géré proprement (toast + masquage du bouton)
- [ ] Changer de rôle (simuler) met à jour les boutons disponibles

### Tests d'idempotency
- [ ] Retry avec la même `Idempotency-Key` → `409` traité comme succès
- [ ] Nouvelle modale = nouvelle clé générée automatiquement

### Tests de violations (422)
- [ ] Les violations sont affichées dans la modale (pas un toast générique)
- [ ] `can_request_override: true` → afficher le bouton "Demander une dérogation"
- [ ] Plusieurs violations → afficher la liste complète

### Tests de guards
- [ ] Guard `warn` → modal de confirmation avec message orange
- [ ] Guard `block` → toast d'erreur rouge, action impossible
- [ ] Accepter un guard `warn` envoie `override_guard_warning: true`

### Tests du Ledger Table (Admin)
- [ ] Règles avec `is_active: false` affichées en état "Inactif" (grisé)
- [ ] Toggle "Activer" envoie `PUT` avec `is_active: true`
- [ ] Modifier un paramètre (ex: `max_cash_amount`) met à jour `condition_group`
- [ ] Après activation, re-tester les scénarios de validation

### Tests d'état
- [ ] Après `/execute` succès, rafraîchir `/context` — nouveaux boutons disponibles
- [ ] Si le modèle a changé entre-temps (conflit), `invalid_status` violation → rafraîchir
- [ ] L'historique (`/history`) reflète correctement la transition

---

## 17. Glossaire

| Terme | Définition |
|-------|-----------|
| **Decision** | Action métier exécutable sur un modèle. Exemple : `approve_order`. Définie dans `config/decisions.php`. |
| **evaluate()** | Phase de validation : policy + état workflow + contraintes. Retourne `allowed` ou `violations[]`. Ne modifie rien en DB. |
| **execute()** | Phase d'exécution : side-effects + transition d'état. Nécessite un `evaluate()` qui passe en amont. |
| **Constraint** | Règle de validation attachée à une décision ou une règle de transition. Interface `App\Contracts\Constraint`. |
| **Transition Rule** | Règle DB (`workflow_transition_rules`) : si les contraintes passent, router l'étape actuelle vers `target_step_code`. |
| **Guard** | Validation au moment exact de la transition. Peut bloquer, avertir, ou auto-approuver. |
| **condition_group** | Colonne JSON de `workflow_transition_rules` contenant l'opérateur (`AND`/`OR`) et les contraintes à évaluer. |
| **priority** | Ordre d'évaluation des règles de transition (plus petit = évalué en premier). |
| **is_active** | Flag d'activation d'une règle. Les règles `false` sont ignorées par le resolver. |
| **Ledger Table** | Interface admin pour activer/désactiver/modifier les règles de transition sans redéploiement. |
| **WorkflowMatrixSeeder** | Seeder qui pré-configure les règles template avec `is_active = false`. |
| **dry-run** | Mode d'évaluation sans exécution. Utilisé par `/context` pour lister les actions disponibles. |
| **idempotency** | Garantie qu'exécuter la même action plusieurs fois produit le même résultat. Contrôlé via `Idempotency-Key`. |
| **modelType** | Identifiant du type de modèle dans les URLs : `bon-commande`, `bon-livraison`, `bon-preparation`, `delivery-mission`. |
| **risk_level** | Niveau de risque d'une décision : `low`, `medium`, `high`, `critical`. Utilisé pour styler les boutons et avertissements. |
| **can_request_override** | Métadonnée dans une violation indiquant que l'utilisateur peut demander une dérogation. |
