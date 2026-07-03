# Module 19 — Configuration Settings (Dynamic Config API)

> **Audience :** équipe UI/Frontend  
> **Base URL :** `/api/backend/settings`  
> **Auth :** Bearer token (sanctum) — accès backend standard  
> **Principe :** Un seul jeu d'endpoints générique que **tous les modules** peuvent utiliser pour lire et écrire des configurations scopées (par rôle, utilisateur, partenaire, profil d'accès).

---

## 1. Concepts clés

### 1.1 Portée (scope) polymorphique

Chaque setting est attaché à une **entité** via deux champs :

| Champ | Description |
|---|---|
| `configurable_type` | Valeur de scope (voir tableau ci-dessous) |
| `configurable_id` | Clé primaire entière de l'entité (ou `0` pour `system`) |

**Types autorisés :**

| `configurable_type` | Entité | `id` |
|---|---|---|
| `system` | Paramètres globaux système | toujours `0` |
| `Spatie\Permission\Models\Role` | Rôle (livreur, commercial, magasinier…) | id du rôle |
| `App\Models\User` | Utilisateur individuel | id user |
| `App\Models\AccessProfile` | Profil d'accès personnalisé | id profil |
| `App\Models\Branch` | Agence / dépôt | id branche |
| `App\Models\Shop` | Point de vente | id shop |
| `App\Models\Company` | Société | id company |
| `App\Models\Partner` | Partenaire client/fournisseur | id partenaire |

### 1.2 Dictionnaire des clés (sfa_params)

Toutes les clés valides sont définies dans la table `sfa_params`. Chaque clé possède un `value_type` (`boolean`, `integer`, `decimal`, `string`, `json`). Le backend sélectionne automatiquement la bonne colonne typée — **le frontend n'a jamais à le spécifier**.

### 1.3 Format de réponse plat

Le backend unifie les 5 colonnes typées en un seul champ `value`. L'UI reçoit toujours :

```json
{ "key": "visit.gps.enabled", "value": true, "type": "boolean" }
```

---

## 2. Endpoints

### 2.1 GET /backend/settings — Lire les settings d'un scope

Retourne tous les settings overridés pour une entité donnée.

**Query params :**

| Param | Requis | Description |
|---|---|---|
| `type` | ✅ | Classe PHP du scope (voir tableau §1.1) |
| `id` | ✅ | Identifiant de l'entité |
| `key` | ❌ | Filtre partiel sur le nom de clé |

**Exemple — settings du rôle 9 :**

```http
GET /api/backend/settings?type=Spatie%5CPermission%5CModels%5CRole&id=9
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "configurable_type": "Spatie\\Permission\\Models\\Role",
  "configurable_id": 9,
  "settings": [
    { "key": "visit.gps.enabled",          "value": true,      "type": "boolean" },
    { "key": "visit.gps.strict_mode",      "value": "WARNING", "type": "string"  },
    { "key": "visit.max_distance_meters",  "value": 200,       "type": "integer" }
  ]
}
```

> Si l'entité n'a aucun override, `settings` retourne `[]`. Le frontend doit alors utiliser les valeurs par défaut définies dans `sfa_params.default_value`.

**Exemple — settings système globaux :**

```http
GET /api/backend/settings?type=system&id=0
```

**Exemple — avec filtre clé :**

```http
GET /api/backend/settings?type=App%5CModels%5CUser&id=42&key=visit.gps
```

---

### 2.2 POST /backend/settings/save-batch — Sauvegarder plusieurs settings

Batch upsert via une map `{ clé: valeur }`. Le backend résout automatiquement le type de chaque clé depuis `sfa_params`.

**Body :**

```json
{
  "configurable_type": "Spatie\\Permission\\Models\\Role",
  "configurable_id": 9,
  "settings": {
    "visit.gps.enabled": true,
    "visit.max_distance_meters": 250,
    "visit.gps.strict_mode": "STRICT"
  }
}
```

**Réponse 200 :**

```json
{
  "message": "Saved 3 setting(s).",
  "configurable_type": "Spatie\\Permission\\Models\\Role",
  "configurable_id": 9,
  "settings": [
    { "key": "visit.gps.enabled",         "value": true,    "type": "boolean" },
    { "key": "visit.gps.strict_mode",     "value": "STRICT","type": "string"  },
    { "key": "visit.max_distance_meters", "value": 250,     "type": "integer" }
  ]
}
```

**Réponse 422 — clé inconnue :**

```json
{
  "message": "Unknown configuration keys — not found in sfa_params.",
  "unknown_keys": ["visit.unknown_param"]
}
```

> `updateOrCreate` — si le setting existe déjà pour ce scope, il est mis à jour. Sinon il est créé.

---

### 2.3 DELETE /backend/settings/reset — Supprimer un override

Supprime le setting custom d'un scope → le système revient au défaut global (`sfa_params.default_value`).

**Body :**

```json
{
  "configurable_type": "Spatie\\Permission\\Models\\Role",
  "configurable_id": 9,
  "key": "visit.gps.enabled"
}
```

**Réponse 200 :**

```json
{ "message": "Setting reset to global default." }
```

**Réponse 404 — override non trouvé :**

```json
{ "message": "Setting not found for this scope." }
```

---

## 3. Endpoints masterdata — Pickers et dictionnaire

### 3.1 Dictionnaire des clés — GET /backend/masterdata/sfa-params

Retourne **toutes les clés de configuration** avec leur type et leur description. L'UI l'utilise pour afficher un label humain à côté de chaque clé.

**Params optionnels :**

| Param | Description |
|---|---|
| `prefix` | Filtre par namespace (ex: `visit` → retourne toutes les clés `visit.*`) |
| `search` | Recherche partielle sur `key` ou `description` |

**Réponse 200 :**

```json
{
  "success": true,
  "data": [
    { "key": "visit.gps.enabled",         "value_type": "boolean", "description": "Active la capture GPS sur les visites." },
    { "key": "visit.gps.strict_mode",     "value_type": "string",  "description": "Hors zone géo: OFF / WARNING / BLOCK." },
    { "key": "visit.max_distance_meters", "value_type": "integer", "description": "Rayon max (m) pour valider présence chez le client." },
    { "key": "wms.lot_tracking",          "value_type": "boolean", "description": "Active le suivi par lot (numéro de lot / date expiry)." },
    { "key": "wms.lot_expiry_alert_days", "value_type": "integer", "description": "Jours avant expiry pour déclencher l'alerte." }
  ],
  "grouped": {
    "visit": [ ... ],
    "wms":   [ ... ],
    "order": [ ... ]
  }
}
```

> La propriété `grouped` regroupe les clés par **namespace** (premier segment de la clé). Utilisez-la pour afficher des sections repliables dans l'UI (ex: section "visit", section "wms", etc.).

**Exemples de requêtes :**

```http
GET /api/backend/masterdata/sfa-params
GET /api/backend/masterdata/sfa-params?prefix=visit
GET /api/backend/masterdata/sfa-params?search=gps
```

---

### 3.2 Pickers d'entités (sélecteur de scope)

> Ces endpoints servent à **peupler les dropdowns** du sélecteur de scope dans l'UI.

| URL | Description | Params optionnels |
|---|---|---|
| `GET /api/backend/masterdata/roles` | Liste tous les rôles | — |
| `GET /api/backend/masterdata/users` | Liste les utilisateurs actifs | `search`, `role`, `per_page` |
| `GET /api/backend/masterdata/access-profiles` | Liste les profils d'accès | — |
| `GET /api/backend/masterdata/branches` | Liste les agences/dépôts | `type` (agency/warehouse/depot) |
| `GET /api/backend/masterdata/shops` | Liste les points de vente | `branch_id` |
| `GET /api/backend/masterdata/companies` | Liste les sociétés | — |
| `GET /api/backend/masterdata/partners` | Liste les partenaires actifs | — |

**Format réponse uniforme :**

```json
{
  "success": true,
  "data": [
    { "id": 18, "name": "Livreur" },
    { "id": 9,  "name": "Commercial" }
  ]
}
```

> Pour le scope `system`, aucun picker n'est nécessaire — `configurable_id` est toujours `0`.

---

## 4. Mapping des value_type

| `type` dans la réponse | Colonne DB | Exemple JS |
|---|---|---|
| `boolean` | `bool_value` | `true` / `false` |
| `integer` | `int_value` | `200` |
| `decimal` | `decimal_value` | `3.14` |
| `string` | `string_value` | `"WARNING"` |
| `json` | `json_value` | `{ "key": "val" }` ou `[1, 2, 3]` |

---

## 5. Clés connues (sfa_params — exemples)

> Liste non exhaustive — interroger `GET /api/backend/admin/system-settings` pour la liste complète.

| Clé | Type | Description |
|---|---|---|
| `visit.gps.enabled` | `boolean` | Active la géolocalisation obligatoire |
| `visit.gps.strict_mode` | `string` | `STRICT` / `WARNING` / `OFF` |
| `visit.max_distance_meters` | `integer` | Distance max acceptée en mètres |
| `visit.min_duration_seconds` | `integer` | Durée minimale d'une visite |
| `order.min_amount` | `decimal` | Montant minimum de commande |
| `order.require_signature` | `boolean` | Signature client obligatoire |
| `delivery.photo_required` | `boolean` | Photo de livraison obligatoire |

---

## 6. Utilisation générique côté UI (TypeScript)

```typescript
// Types
export type SettingType = 'boolean' | 'integer' | 'decimal' | 'string' | 'json';

export interface ConfigSetting {
  key: string;
  value: boolean | number | string | object | null;
  type: SettingType;
}

export interface ConfigSettingsResponse {
  configurable_type: string;
  configurable_id: number;
  settings: ConfigSetting[];
}

// Scopes prédéfinis
export const CONFIG_SCOPES = {
  SYSTEM:         'system',
  ROLE:           'Spatie\\Permission\\Models\\Role',
  USER:           'App\\Models\\User',
  ACCESS_PROFILE: 'App\\Models\\AccessProfile',
  BRANCH:         'App\\Models\\Branch',
  SHOP:           'App\\Models\\Shop',
  COMPANY:        'App\\Models\\Company',
  PARTNER:        'App\\Models\\Partner',
} as const;

// Lire les settings système globaux (id toujours 0)
async function getSystemSettings(keyFilter?: string) {
  const params = new URLSearchParams({ type: CONFIG_SCOPES.SYSTEM, id: '0', ...(keyFilter ? { key: keyFilter } : {}) });
  const res = await api.get<ConfigSettingsResponse>(`/backend/settings?${params}`);
  return res.data;
}

// Lire les settings d'un rôle
async function getRoleSettings(roleId: number, keyFilter?: string) {
  const params = new URLSearchParams({
    type: CONFIG_SCOPES.ROLE,
    id: String(roleId),
    ...(keyFilter ? { key: keyFilter } : {}),
  });
  const res = await api.get<ConfigSettingsResponse>(`/backend/settings?${params}`);
  return res.data;
}

// Helper : transformer la liste en map { key => value }
function settingsToMap(settings: ConfigSetting[]): Record<string, unknown> {
  return Object.fromEntries(settings.map(s => [s.key, s.value]));
}

// Sauvegarder plusieurs settings d'un rôle
async function saveRoleSettings(roleId: number, values: Record<string, unknown>) {
  const res = await api.post<ConfigSettingsResponse>('/backend/settings/save-batch', {
    configurable_type: CONFIG_SCOPES.ROLE,
    configurable_id: roleId,
    settings: values,
  });
  return res.data;
}

// Reset un setting vers le défaut global
async function resetSetting(type: string, id: number, key: string) {
  await api.delete('/backend/settings/reset', {
    data: { configurable_type: type, configurable_id: id, key },
  });
}
```

---

## 7. Architecture & sécurité

### 6.1 Relation avec l'API Admin

| API | Route | Audience | Format réponse |
|---|---|---|---|
| **UI Settings** | `/backend/settings` | Modules frontend | Plat `{key, value, type}` |
| **Admin Settings** | `/backend/admin/access-control/configuration-settings` | Admin/Root | Brut (colonnes DB) |

L'API UI est un **wrapper** au-dessus de la même table — elle ne duplique pas les données.

### 6.2 Résolution de type

Le backend suit toujours l'ordre :
1. Lookup `sfa_params.value_type` par `key`  
2. Si clé inconnue → rejet 422 (pas d'inférence PHP pour garantir la cohérence)

### 6.3 Hiérarchie de résolution (paramètre effectif)

La résolution complète d'un paramètre pour un utilisateur suit cette priorité :

```
User override  →  Role override  →  AccessProfile override  →  Global default (sfa_params)
```

> Cette résolution est gérée par `RoleSettingResolver` / `ParameterService` — le endpoint GET ici ne retourne que les **overrides** d'un scope donné, pas la valeur effective résolue.

---

## 8. Scénarios d'usage par module

| Module | Scope suggéré | Exemple clé |
|---|---|---|
| Visite terrain | `Role` (livreur, commercial) | `visit.gps.enabled` |
| Commandes B2B | `Partner` | `order.min_amount` |
| App paramétrage | `User` | `ui.theme`, `ui.language` |
| Profil accès custom | `AccessProfile` | `feature.xyz.enabled` |
