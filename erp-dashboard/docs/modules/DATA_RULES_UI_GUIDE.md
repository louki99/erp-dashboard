# Data Governance & Visibility Matrix — Guide UI

> **Audience :** équipe Frontend (Admin Panel)
> **Base URL :** `/api/admin/access-control/data-rules`
> **Auth :** Sanctum cookie — rôle `admin` ou `root`, ou permission `admin.access-control.manage`
> **Date :** 2026-07-07

---

## Table des matières

1. [C'est quoi data\_rules ?](#1-cest-quoi-data_rules-)
2. [Les concepts clés](#2-les-concepts-clés)
3. [Règle de priorité — qui gagne ?](#3-règle-de-priorité--qui-gagne-)
4. [Référence des endpoints](#4-référence-des-endpoints)
5. [Recipes — cas d'usage courants](#5-recipes--cas-dusage-courants)
6. [Types TypeScript](#6-types-typescript)
7. [React Query hooks](#7-react-query-hooks)
8. [Erreurs et codes de retour](#8-erreurs-et-codes-de-retour)

---

## 1. C'est quoi data\_rules ?

La table `data_rules` est la **matrice de visibilité dynamique** du système.  
Elle répond à une seule question : *« Cet utilisateur peut-il voir cette ligne de données ? »*

Elle ne contrôle **pas** les routes API (c'est Spatie Roles). Elle contrôle uniquement **quelles lignes** remontent dans les listes et les formulaires du commercial mobile :

- Quelles **pages produit** (ProductPage) un commercial voit-il ?
- Quels **modes de règlement** (PaymentTerm) sont proposés sur une commande ?
- Quels **moyens de paiement** (PaymentMethod) sont disponibles ?
- Quelles **catégories** (Category) et quels **produits** (Product) apparaissent dans le catalogue ?

> Les règles sont évaluées côté backend à chaque requête. Le frontend n'a qu'à gérer l'affichage et l'administration de la matrice.

---

## 2. Les concepts clés

### 2.1 Anatomie d'une règle

```
data_rules
┌────────────┬───────────────────────────────────────────────────────────┐
│ model_type │ Quelle entité ?  ex: "App\Models\ProductPage"             │
│ model_id   │ Quel identifiant ? (null = toutes les lignes de ce type)  │
│ scope_type │ À qui s'applique ?  role | user | branch | profile | partner │
│ scope_value│ L'ID/code du qui  ex: "8" (profile 8), "sfa_order_taker" │
│ action     │ allow   ou   deny                                         │
└────────────┴───────────────────────────────────────────────────────────┘
```

### 2.2 Les types de scope

| `scope_type` | `scope_value` contient | Exemple |
|---|---|---|
| `user` | `users.id` | `"42"` |
| `profile` | `access_profiles.id` | `"8"` |
| `role` | Spatie role name | `"sfa_order_taker"` |
| `branch` | `branches.code` | `"CAS-001"` |
| `partner` | `partners.id` | `"156"` (restriction client B2B) |

### 2.3 Les types de modèle autorisés

| Label UI | `model_type` à envoyer |
|---|---|
| Page Produit | `App\Models\ProductPage` |
| Condition de règlement | `App\Models\PaymentTerm` |
| Moyen de paiement | `App\Models\PaymentMethod` |
| Catégorie | `App\Models\Category` |
| Produit | `App\Models\Product` |

### 2.4 allow vs deny

| `action` | Effet |
|---|---|
| `allow` | L'entité est **visible** pour ce scope |
| `deny` | L'entité est **cachée** pour ce scope |

**Règle du wildcard :** Si `model_id = null`, la règle s'applique à **toutes** les lignes de ce `model_type`.

```
model_id = null  + action = allow  →  toutes les ProductPages sont visibles pour ce scope
model_id = null  + action = deny   →  toutes les ProductPages sont cachées  (⚠️ nécessite confirm_wildcard_deny=true)
model_id = 11    + action = allow  →  seulement ProductPage #11 est visible
model_id = 11    + action = deny   →  seulement ProductPage #11 est cachée
```

---

## 3. Règle de priorité — qui gagne ?

Quand plusieurs règles s'appliquent à un utilisateur pour une même ressource, le moteur applique :

### Niveau 1 — Priorité du scope (du plus fort au plus faible)

```
user      (1)  ← toujours le plus fort
partner   (2)  ← contexte B2B uniquement
role      (3)
profile   (4)
branch    (5)  ← le plus faible
```

### Niveau 2 — Règle concrète avant wildcard

À niveau de scope égal, une règle sur un `model_id` concret bat une règle wildcard (`model_id = null`).

### Exemple illustré

```
Profil 8 :
  ├── data_rule #3 → model_id=null, action=deny   (cache TOUT pour profil 8)
  └── data_rule #4 → model_id=11,   action=allow  (autorise ProductPage 11)
```

Quand le commercial avec profil 8 charge le catalogue :

| ProductPage demandée | Règle gagnante | Résultat |
|---|---|---|
| ID = 11 | #4 (concret, sort key=0) bat #3 (wildcard, sort key=1) | ✅ visible |
| ID = 7 | #3 uniquement (wildcard) | ❌ cachée |
| ID = 42 | #3 uniquement (wildcard) | ❌ cachée |

> **L'ID spécifique écrase toujours la règle globale, l-msetra.**

### Comportement si aucune règle ne correspond

- Si **aucune règle** n'existe pour cette ressource → la ressource est visible par défaut (sauf si d'autres ressources du même type ont des règles = "gating").
- Si la ressource est **"gated"** (il existe des règles pour d'autres utilisateurs sur ce model_id) → elle est cachée par défaut pour les utilisateurs sans règle explicite.

---

## 4. Référence des endpoints

Tous les endpoints sont préfixés par `/api/admin/access-control/data-rules`.

---

### `GET /` — Lister les règles

```http
GET /api/admin/access-control/data-rules
```

**Query params (tous optionnels) :**

| Paramètre | Type | Description |
|---|---|---|
| `model_type` | string | Filtrer par type (ex: `App\Models\ProductPage`) |
| `scope_type` | string | Filtrer par scope (role, user, branch, profile, partner) |
| `scope_value` | string | Filtrer par valeur de scope (ex: `"8"`) |
| `action` | string | `allow` ou `deny` |
| `model_id` | integer | Filtrer par ID de ressource |
| `per_page` | integer | Résultats par page (1–200, défaut: 50) |

**Réponse 200 :**
```json
{
  "data": [
    {
      "id": 3,
      "model_type": "App\\Models\\ProductPage",
      "model_id": null,
      "scope_type": "profile",
      "scope_value": "8",
      "action": "deny",
      "created_at": "2026-07-07T10:00:00.000000Z",
      "updated_at": "2026-07-07T10:00:00.000000Z"
    },
    {
      "id": 4,
      "model_type": "App\\Models\\ProductPage",
      "model_id": 11,
      "scope_type": "profile",
      "scope_value": "8",
      "action": "allow",
      "created_at": "2026-07-07T10:05:00.000000Z",
      "updated_at": "2026-07-07T10:05:00.000000Z"
    }
  ],
  "current_page": 1,
  "per_page": 50,
  "total": 2,
  "last_page": 1
}
```

---

### `POST /` — Créer une règle

```http
POST /api/admin/access-control/data-rules
Content-Type: application/json
```

**Body :**
```json
{
  "model_type":  "App\\Models\\ProductPage",
  "model_id":    11,
  "scope_type":  "profile",
  "scope_value": "8",
  "action":      "allow"
}
```

**Champs :**

| Champ | Requis | Type | Valeurs acceptées |
|---|---|---|---|
| `model_type` | ✅ | string | Voir [§2.3](#23-les-types-de-modèle-autorisés) |
| `model_id` | — | integer\|null | ID de la ressource, ou `null` pour wildcard |
| `scope_type` | ✅ | string | `role` `user` `branch` `profile` `partner` |
| `scope_value` | ✅ | string | ID ou code (toujours une string) |
| `action` | ✅ | string | `allow` ou `deny` |
| `confirm_wildcard_deny` | ⚠️ | boolean | Requis si `model_id=null` + `action=deny` |

> **Si une règle identique existe déjà**, retourne `200` avec la règle existante (pas de doublon).

**Réponse 201 :**
```json
{
  "data": {
    "id": 5,
    "model_type": "App\\Models\\ProductPage",
    "model_id": 11,
    "scope_type": "profile",
    "scope_value": "8",
    "action": "allow",
    "created_at": "2026-07-07T11:00:00.000000Z",
    "updated_at": "2026-07-07T11:00:00.000000Z"
  }
}
```

**Réponse 422 — wildcard deny sans confirmation :**
```json
{
  "message": "A wildcard deny (model_id=null) will hide ALL rows of this model_type for the given scope. Pass confirm_wildcard_deny=true to proceed. Note: specific allow rules for concrete model_ids still override this.",
  "requires": "confirm_wildcard_deny"
}
```

---

### `GET /{id}` — Détail d'une règle

```http
GET /api/admin/access-control/data-rules/4
```

**Réponse 200 :**
```json
{
  "data": {
    "id": 4,
    "model_type": "App\\Models\\ProductPage",
    "model_id": 11,
    "scope_type": "profile",
    "scope_value": "8",
    "action": "allow",
    "created_at": "2026-07-07T10:05:00.000000Z",
    "updated_at": "2026-07-07T10:05:00.000000Z"
  }
}
```

---

### `PUT /{id}` — Modifier une règle

```http
PUT /api/admin/access-control/data-rules/4
Content-Type: application/json
```

Tous les champs sont optionnels (PATCH sémantique via PUT).

```json
{
  "action": "deny",
  "model_id": 11
}
```

> Même contrainte : si le résultat est `model_id=null + action=deny`, ajouter `confirm_wildcard_deny=true`.

**Réponse 200 :**
```json
{
  "data": {
    "id": 4,
    "model_type": "App\\Models\\ProductPage",
    "model_id": 11,
    "scope_type": "profile",
    "scope_value": "8",
    "action": "deny",
    ...
  }
}
```

---

### `DELETE /{id}` — Supprimer une règle

```http
DELETE /api/admin/access-control/data-rules/4
```

**Réponse 200 :**
```json
{
  "message": "Deleted",
  "data": { "id": 4 }
}
```

---

### `POST /deny-by-subject-code` — Deny par code métier

Endpoint de confort : crée un deny en cherchant la ressource par son **code métier** plutôt que par son ID technique.

```http
POST /api/admin/access-control/data-rules/deny-by-subject-code
Content-Type: application/json
```

```json
{
  "subject":     "payment_term",
  "code":        "30J-NET",
  "scope_type":  "role",
  "scope_value": "sfa_order_taker"
}
```

**`subject` accepté :**

| Valeur | Modèle cherché | Colonne |
|---|---|---|
| `payment_term` | `PaymentTerm` | `code` |
| `payment_method` | `PaymentMethod` | `code` |
| `product_page` | `ProductPage` | `code` |
| `category` | `Category` | `code` |
| `product` | `Product` | `code` (ou ID si numérique) |

**Réponse 201 :** règle créée.
**Réponse 200 :** règle déjà existante (idempotent).
**Réponse 404 :** code introuvable.

---

### `POST /revoke-deny-by-subject-code` — Retirer un deny par code

Même signature que `deny-by-subject-code`, supprime la règle correspondante.

```http
POST /api/admin/access-control/data-rules/revoke-deny-by-subject-code
Content-Type: application/json
```

```json
{
  "subject":     "product_page",
  "code":        "PAGE-PREMIUM",
  "scope_type":  "profile",
  "scope_value": "8"
}
```

**Réponse 200 :**
```json
{
  "message": "Removed",
  "deleted": 1
}
```

---

### `POST /bulk-replace` — Remplacer toute la matrice d'un scope

Supprime **toutes** les règles existantes pour `(scope_type, scope_value, model_type)` et les remplace par le tableau fourni — dans une seule transaction DB.

Utile quand l'admin reconfigure entièrement la visibilité d'un profil.

```http
POST /api/admin/access-control/data-rules/bulk-replace
Content-Type: application/json
```

```json
{
  "scope_type":  "profile",
  "scope_value": "8",
  "model_type":  "App\\Models\\ProductPage",
  "rules": [
    { "model_id": null, "action": "deny",  "confirm_wildcard_deny": true },
    { "model_id": 11,   "action": "allow" },
    { "model_id": 15,   "action": "allow" },
    { "model_id": 22,   "action": "allow" }
  ]
}
```

**Réponse 201 :**
```json
{
  "message": "Rules replaced.",
  "count": 4,
  "data": [
    { "id": 10, "model_id": null, "action": "deny", ... },
    { "id": 11, "model_id": 11,   "action": "allow", ... },
    { "id": 12, "model_id": 15,   "action": "allow", ... },
    { "id": 13, "model_id": 22,   "action": "allow", ... }
  ]
}
```

> **Effet :** seules les ProductPages 11, 15 et 22 seront visibles pour le Profil 8. Toutes les autres seront cachées par le wildcard deny.

---

## 5. Recipes — cas d'usage courants

### Recipe A — Cacher une condition de règlement pour un rôle

```json
POST /api/admin/access-control/data-rules/deny-by-subject-code

{
  "subject":     "payment_term",
  "code":        "CREDIT-90J",
  "scope_type":  "role",
  "scope_value": "sfa_van_sales"
}
```

Les commerciaux van-sales ne verront plus "Crédit 90 jours" dans leurs formulaires de commande.

---

### Recipe B — Accès restreint à quelques pages produit pour un profil

Scénario : Profil 12 ne peut voir que les ProductPages 5, 8 et 20.

```json
POST /api/admin/access-control/data-rules/bulk-replace

{
  "scope_type":  "profile",
  "scope_value": "12",
  "model_type":  "App\\Models\\ProductPage",
  "rules": [
    { "model_id": null, "action": "deny",  "confirm_wildcard_deny": true },
    { "model_id": 5,    "action": "allow" },
    { "model_id": 8,    "action": "allow" },
    { "model_id": 20,   "action": "allow" }
  ]
}
```

---

### Recipe C — Exception utilisateur individuelle (override profil)

Scénario : Le Profil 8 bloque tout, mais l'utilisateur ID=42 doit avoir accès à la ProductPage 99.

**Étape 1** — Le bloc profil existe déjà (deny wildcard profil 8).

**Étape 2** — Ajouter un allow user-level qui prime sur le profil (scope priority user=1 > profile=4) :

```json
POST /api/admin/access-control/data-rules

{
  "model_type":  "App\\Models\\ProductPage",
  "model_id":    99,
  "scope_type":  "user",
  "scope_value": "42",
  "action":      "allow"
}
```

---

### Recipe D — Visibilité client B2B (partenaire)

Scénario : Le client (partner) ID=156 ne peut commander qu'avec le mode de règlement "CASH".

```json
POST /api/admin/access-control/data-rules/deny-by-subject-code

{
  "subject":     "payment_term",
  "code":        "CREDIT-30J",
  "scope_type":  "partner",
  "scope_value": "156"
}
```

Répéter pour chaque terme à bloquer. Le commercial qui visite ce client ne verra que "CASH" dans la liste.

---

### Recipe E — Débloquer une règle (retirer un deny)

```json
DELETE /api/admin/access-control/data-rules/3
```

ou par code :

```json
POST /api/admin/access-control/data-rules/revoke-deny-by-subject-code

{
  "subject":     "payment_term",
  "code":        "CREDIT-90J",
  "scope_type":  "role",
  "scope_value": "sfa_van_sales"
}
```

---

## 6. Types TypeScript

```typescript
// ─── Constantes ────────────────────────────────────────────────────────────

export const DATA_RULE_SCOPE_TYPES = ['user', 'profile', 'role', 'branch', 'partner'] as const;
export const DATA_RULE_ACTIONS     = ['allow', 'deny'] as const;
export const DATA_RULE_MODEL_TYPES = [
  'App\\Models\\ProductPage',
  'App\\Models\\PaymentTerm',
  'App\\Models\\PaymentMethod',
  'App\\Models\\Category',
  'App\\Models\\Product',
] as const;
export const DATA_RULE_SUBJECTS = [
  'product_page',
  'payment_term',
  'payment_method',
  'category',
  'product',
] as const;

export type DataRuleScopeType  = typeof DATA_RULE_SCOPE_TYPES[number];
export type DataRuleAction     = typeof DATA_RULE_ACTIONS[number];
export type DataRuleModelType  = typeof DATA_RULE_MODEL_TYPES[number];
export type DataRuleSubject    = typeof DATA_RULE_SUBJECTS[number];

// ─── Entité ────────────────────────────────────────────────────────────────

export interface DataRule {
  id:          number;
  model_type:  DataRuleModelType;
  model_id:    number | null;
  scope_type:  DataRuleScopeType;
  scope_value: string;
  action:      DataRuleAction;
  created_at:  string;
  updated_at:  string;
}

// ─── Payloads ──────────────────────────────────────────────────────────────

export interface CreateDataRulePayload {
  model_type:             DataRuleModelType;
  model_id?:              number | null;
  scope_type:             DataRuleScopeType;
  scope_value:            string;
  action:                 DataRuleAction;
  confirm_wildcard_deny?: boolean;
}

export interface UpdateDataRulePayload {
  model_type?:            DataRuleModelType;
  model_id?:              number | null;
  scope_type?:            DataRuleScopeType;
  scope_value?:           string;
  action?:                DataRuleAction;
  confirm_wildcard_deny?: boolean;
}

export interface DenyBySubjectCodePayload {
  subject:     DataRuleSubject;
  code:        string;
  scope_type:  DataRuleScopeType;
  scope_value: string;
}

export interface BulkReplaceRuleEntry {
  model_id:               number | null;
  action:                 DataRuleAction;
  confirm_wildcard_deny?: boolean;
}

export interface BulkReplacePayload {
  scope_type:  DataRuleScopeType;
  scope_value: string;
  model_type:  DataRuleModelType;
  rules:       BulkReplaceRuleEntry[];
}

// ─── Réponses ──────────────────────────────────────────────────────────────

export interface DataRuleListResponse {
  data:         DataRule[];
  current_page: number;
  per_page:     number;
  total:        number;
  last_page:    number;
}

export interface DataRuleSingleResponse {
  data: DataRule;
}

export interface BulkReplaceResponse {
  message: string;
  count:   number;
  data:    DataRule[];
}

export interface RevokeDenyResponse {
  message: string;
  deleted: number;
}

// ─── Filtres UI ────────────────────────────────────────────────────────────

export interface DataRuleFilters {
  model_type?:  DataRuleModelType;
  scope_type?:  DataRuleScopeType;
  scope_value?: string;
  action?:      DataRuleAction;
  model_id?:    number;
  per_page?:    number;
  page?:        number;
}
```

---

## 7. React Query hooks

```typescript
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import type {
  BulkReplacePayload,
  BulkReplaceResponse,
  CreateDataRulePayload,
  DataRule,
  DataRuleFilters,
  DataRuleListResponse,
  DataRuleSingleResponse,
  DenyBySubjectCodePayload,
  RevokeDenyResponse,
  UpdateDataRulePayload,
} from '../types/dataRules';

const BASE = '/api/admin/access-control/data-rules';

// ─── Keys ──────────────────────────────────────────────────────────────────

export const dataRuleKeys = {
  all:    ['data-rules'] as const,
  list:   (filters: DataRuleFilters) => ['data-rules', 'list', filters] as const,
  detail: (id: number) => ['data-rules', id] as const,
};

// ─── Lister ────────────────────────────────────────────────────────────────

export function useDataRules(filters: DataRuleFilters = {}) {
  return useQuery({
    queryKey: dataRuleKeys.list(filters),
    queryFn:  () =>
      axios.get<DataRuleListResponse>(BASE, { params: filters }).then((r) => r.data),
  });
}

// ─── Détail ────────────────────────────────────────────────────────────────

export function useDataRule(id: number) {
  return useQuery({
    queryKey: dataRuleKeys.detail(id),
    queryFn:  () =>
      axios.get<DataRuleSingleResponse>(`${BASE}/${id}`).then((r) => r.data.data),
  });
}

// ─── Créer ─────────────────────────────────────────────────────────────────

export function useCreateDataRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDataRulePayload) =>
      axios.post<DataRuleSingleResponse>(BASE, payload).then((r) => r.data.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataRuleKeys.all }),
  });
}

// ─── Modifier ──────────────────────────────────────────────────────────────

export function useUpdateDataRule(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDataRulePayload) =>
      axios.put<DataRuleSingleResponse>(`${BASE}/${id}`, payload).then((r) => r.data.data),
    onSuccess: (rule) => {
      qc.setQueryData(dataRuleKeys.detail(id), rule);
      qc.invalidateQueries({ queryKey: dataRuleKeys.all });
    },
  });
}

// ─── Supprimer ─────────────────────────────────────────────────────────────

export function useDeleteDataRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => axios.delete(`${BASE}/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataRuleKeys.all }),
  });
}

// ─── Deny par code métier ──────────────────────────────────────────────────

export function useDenyBySubjectCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DenyBySubjectCodePayload) =>
      axios.post<DataRuleSingleResponse>(`${BASE}/deny-by-subject-code`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataRuleKeys.all }),
  });
}

export function useRevokeDenyBySubjectCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: DenyBySubjectCodePayload) =>
      axios.post<RevokeDenyResponse>(`${BASE}/revoke-deny-by-subject-code`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataRuleKeys.all }),
  });
}

// ─── Bulk replace ──────────────────────────────────────────────────────────

export function useBulkReplaceDataRules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: BulkReplacePayload) =>
      axios.post<BulkReplaceResponse>(`${BASE}/bulk-replace`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: dataRuleKeys.all }),
  });
}
```

**Exemple d'usage dans un composant :**

```tsx
function ProfileVisibilityEditor({ profileId }: { profileId: number }) {
  const { data, isLoading } = useDataRules({
    scope_type:  'profile',
    scope_value: String(profileId),
    model_type:  'App\\Models\\ProductPage',
  });

  const bulkReplace = useBulkReplaceDataRules();

  const handleSave = (selectedPageIds: number[]) => {
    bulkReplace.mutate({
      scope_type:  'profile',
      scope_value: String(profileId),
      model_type:  'App\\Models\\ProductPage',
      rules: [
        { model_id: null, action: 'deny', confirm_wildcard_deny: true },
        ...selectedPageIds.map((id) => ({ model_id: id, action: 'allow' as const })),
      ],
    });
  };

  // ...
}
```

---

## 8. Erreurs et codes de retour

| Code | Signification | Quand |
|---|---|---|
| `200` | OK / règle déjà existante | `store()` ou `denyBySubjectCode()` avec doublon — idempotent |
| `201` | Règle créée | `store()`, `denyBySubjectCode()`, `bulkReplace()` |
| `404` | Règle ou code introuvable | `show()`, `update()`, `destroy()`, `denyBySubjectCode()` |
| `422` | Validation échouée | Champ manquant, type invalide, wildcard deny sans confirmation |

**Erreur 422 — wildcard deny :**
```json
{
  "message":  "A wildcard deny (model_id=null) will hide ALL rows of this model_type for the given scope...",
  "requires": "confirm_wildcard_deny"
}
```
→ Ajouter `"confirm_wildcard_deny": true` dans le payload et renvoyer.

**Erreur 422 — champ manquant :**
```json
{
  "message": "The scope_type field is required.",
  "errors": {
    "scope_type": ["The scope_type field is required."]
  }
}
```

**Gestion recommandée côté UI :**
```typescript
try {
  await createDataRule.mutateAsync(payload);
} catch (err) {
  if (axios.isAxiosError(err) && err.response?.status === 422) {
    const body = err.response.data;
    if (body.requires === 'confirm_wildcard_deny') {
      // Afficher une dialog de confirmation à l'admin
      const confirmed = await showWildcardDenyConfirmDialog();
      if (confirmed) {
        await createDataRule.mutateAsync({ ...payload, confirm_wildcard_deny: true });
      }
    } else {
      // Afficher les erreurs de validation standard
      showValidationErrors(body.errors);
    }
  }
}
```

---

## Notes importantes

**Invalidation du cache mobile :** Chaque modification d'une règle (`POST`, `PUT`, `DELETE`) déclenche automatiquement l'`Observer` côté backend qui invalide les caches bootstrap des utilisateurs concernés. La visibilité change en temps réel, **sans action supplémentaire de l'UI**.

**Bypass admin :** Les utilisateurs avec rôle `root` ou `admin` ignorent toutes les `data_rules` (`bypassesDataScoping()`). Inutile de créer des règles pour eux.

**`scope_value` est toujours une string :** Même si c'est un ID numérique (profil 8), envoyer `"8"` (string), jamais `8` (integer).
