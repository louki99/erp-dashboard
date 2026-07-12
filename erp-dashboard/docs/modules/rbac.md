# RBAC — Gestion dynamique des Rôles & Permissions

> **Audience :** équipe UI (écran « Matrice des droits » / gestion des accès)
> **Statut :** opérationnel (2026-07-11) — 0 rôle hardcodé dans les routes
> **Moteur :** Spatie Laravel-Permission (guard `web`)
> **Accès aux endpoints RBAC :** permission `manage-rbac` (root, admin par défaut)

---

## 1. Le principe : Permissions (actions), jamais Rôles (titres)

Les routes du backend ne vérifient **jamais** un nom de rôle. Elles vérifient des
**permissions d'action** (`browse-warehouses`, `approve-loading-requests`…). Les rôles
sont de simples étiquettes qui *portent* des permissions :

```
Route ──vérifie──▶ Permission ◀──portée par── Rôle ◀──assigné à── User
                        ▲
                        └──── ou accordée DIRECTEMENT au user (grant individuel)
```

**Conséquences pour le client final :**
- Renommer `magasinier` en `Storekeeper` → aucun impact, les routes ne connaissent pas ce nom.
- Créer un rôle custom `Assistant_Logistique` → lui cocher `browse-warehouses` + `browse-stock` dans la matrice, c'est tout.
- La permission effective d'un user = **union** (permissions de ses rôles ∪ permissions directes).

---

## 2. Endpoints — Façade RBAC (lecture, pour construire la matrice)

### `GET /api/backend/rbac/roles`

Tous les rôles gérables avec leurs permissions, compteurs et flags de protection.

```json
{
  "success": true,
  "data": {
    "roles": [
      {
        "id": 3,
        "name": "magasinier",
        "guard_name": "web",
        "users_count": 7,
        "permissions": ["browse-warehouses", "browse-stock", "browse-stock-movements", "..."],
        "is_protected": true,
        "is_root": false
      },
      {
        "id": 12,
        "name": "assistant_logistique",
        "users_count": 2,
        "permissions": ["browse-warehouses"],
        "is_protected": false,
        "is_root": false
      }
    ],
    "protected_roles": ["root", "admin", "dispatcher", "magasinier"],
    "stats": { "total_roles": 14, "total_permissions": 412, "total_users_with_roles": 89 }
  }
}
```

> **UI :** utilisez `is_protected` pour désactiver le bouton Supprimer, et `is_root`
> pour verrouiller toute la ligne (les permissions de root ne sont pas éditables).

### `GET /api/backend/rbac/permissions`

Catalogue complet groupé par module — les colonnes/sections de votre matrice.
Query optionnelle : `?search=warehouse`.

```json
{
  "success": true,
  "data": {
    "total": 412,
    "modules": {
      "warehouses": [
        { "id": 380, "name": "browse-warehouses" },
        { "id": 381, "name": "create-warehouses" },
        { "id": 382, "name": "edit-warehouses" },
        { "id": 383, "name": "delete-warehouses" }
      ],
      "finance": [ { "id": 401, "name": "browse-finance" } ],
      "finance-journals": [ { "id": 402, "name": "manage-finance-journals" } ],
      "bon-commandes": [ { "id": 12, "name": "admin.bon-commandes.index" }, { "...": "..." } ]
    }
  }
}
```

> Deux conventions cohabitent : les permissions **dynamiques** kebab-case
> (`{verbe}-{module}`, passe 2026-07-11) et les permissions **legacy**
> `admin.{module}.{action}` (seeder ERP historique). Le groupement les fusionne par module.

### `GET /api/backend/rbac/users`

Annuaire des utilisateurs pour l'écran d'affectation — recherche, filtres, pagination.

| Param | Type | Description |
|---|---|---|
| `search` | string | Nom ou email |
| `role` | string | Filtrer par nom de rôle |
| `access_profile_id` | int | Filtrer par profil |
| `branch_id` | int | Filtrer par branche |
| `per_page` | int | Défaut 20 |

```json
{
  "success": true,
  "data": {
    "data": [
      {
        "id": 14,
        "name": "Ahmed Vendeur",
        "email": "ahmed@foodplus.dz",
        "phone": "+213 555…",
        "branch_id": 3,
        "is_active": true,
        "roles": ["magasinier"],
        "access_profile": { "id": 2, "name": "Profil Terrain Strict" }
      }
    ],
    "total": 89
  }
}
```

### `GET /api/backend/rbac/users/{id}/access`

Vue complète des accès d'un utilisateur — pour l'onglet « Accès » d'une fiche user.

```json
{
  "success": true,
  "data": {
    "user": {
      "id": 14, "name": "Ahmed Vendeur", "email": "ahmed@...",
      "code": "0014", "company_id": 1, "branch_id": 3, "shop_id": null,
      "geo_area_id": 7, "geo_area_code": "A0007",
      "is_blocked": false, "is_active": true
    },
    "roles": [ { "id": 3, "name": "magasinier", "is_protected": true } ],
    "direct_permissions": ["approve-loading-requests"],
    "effective_permissions": ["approve-loading-requests", "browse-stock", "browse-warehouses", "..."],
    "effective_count": 23
  }
}
```

> `effective_permissions` = ce que le backend applique réellement (rôles ∪ directes).
> C'est LA liste à afficher quand on veut répondre à « pourquoi ce user voit/ne voit pas X ? ».

### `PUT /api/backend/rbac/users/{id}/info`

Mise à jour de l'affectation organisationnelle depuis l'écran RBAC.

```json
// Body — tous champs optionnels ("sometimes"), nullable où indiqué
{
  "branch_id": 3,          // nullable
  "geo_area_id": 7,        // nullable — geo_area_code est AUTO-SYNCHRONISÉ (ne jamais l'envoyer)
  "shop_id": null,         // nullable
  "company_id": 1,
  "code": "0014",          // unique
  "is_blocked": false,
  "is_active": true
}

// 200 → objet user complet mis à jour (mêmes champs que /access)
```

> ⚠️ **`geo_area_code` n'est pas un champ de saisie** : la table `users` porte
> historiquement les deux colonnes (`geo_area_id` FK + `geo_area_code` miroir string
> encore lu par l'auth, les itinéraires et les partenaires). L'API prend `geo_area_id`
> comme source de vérité et synchronise le miroir automatiquement — le supprimer
> viendra plus tard, une fois les lecteurs legacy migrés. Chaque modification est
> journalisée (avant/après, auteur).

### `GET /api/backend/rbac/access-profiles`

Profils d'accès (réglages fonctionnels partagés : plafonds de commande, scope data-rules…)
pour le dropdown d'affectation. Query : `?active_only=true` (défaut).

```json
{
  "success": true,
  "data": [
    { "id": 2, "name": "Profil Terrain Strict", "description": "…", "is_active": true, "users_count": 12 }
  ]
}
```

### `POST /api/backend/rbac/users/{id}/assign-profile`

Affecter — ou retirer avec `null` — le profil d'accès d'un utilisateur.

```json
// Affecter
{ "access_profile_id": 2 }
// Retirer
{ "access_profile_id": null }

// 200
{ "success": true, "message": "Access profile assigned.",
  "data": { "user_id": 14, "access_profile": { "id": 2, "name": "Profil Terrain Strict" } } }
```

> Chaque changement est journalisé (user, ancien profil, nouveau profil, auteur).

### CRUD des profils d'accès — `/api/backend/rbac/access-profiles`

| Méthode | Route | Body / Description |
|---|---|---|
| `POST` | `/rbac/access-profiles` | `{ name, description?, settings?: {}, is_active? }` — création |
| `GET` | `/rbac/access-profiles/{id}` | Détail complet (settings JSON + users_count) pour le formulaire d'édition |
| `PUT` | `/rbac/access-profiles/{id}` | Mêmes champs — **guard : désactivation bloquée si des users sont affectés** (`RBAC_PROFILE_HAS_USERS`, 422 avec `details.users_count`) |
| `POST` | `/rbac/access-profiles/{id}/clone` | `{ name, description? }` — clone profond incluant les data_rules du profil |

```json
// POST /rbac/access-profiles — exemple
{
  "name": "Profil Télévente",
  "description": "Plafonds réduits pour la prise de commande à distance",
  "settings": { "maximum_order_amount": 50000, "can_edit_prices": false }
}
```

> `settings` est un objet JSON libre lu par `ParameterService` en notation pointée —
> pour l'UI, un éditeur clé/valeur suffit (les clés usuelles : `maximum_order_amount`,
> `can_edit_prices`…). Pas de suppression de profil : désactivez-le (après réaffectation).

---

## 3. Endpoints — Mutations (existants, inchangés)

### Rôles — `/api/backend/roles`

| Méthode | Route | Description |
|---|---|---|
| `GET` | `/roles` | Liste + stats |
| `POST` | `/roles` | Créer `{ name, default_permissions?[] }` (name auto-lowercase) |
| `PUT` | `/roles/{role}` | Renommer — **403 sur root/admin** |
| `DELETE` | `/roles/{role}` | Supprimer — **403 sur rôles protégés**, **422 si users assignés** |
| `GET` | `/roles/{role}/permissions` | Permissions du rôle + catalogue |
| `POST` | `/roles/{role}/permissions` | `{ permissions: [names] }` sync — **403 sur root** |
| `POST` | `/roles/{role}/clone` | `{ name }` — dupliquer un rôle avec ses permissions |
| `GET` | `/roles/{role}/statistics` | Users + permissions par module |

### Affectation utilisateur — `/api/backend/user-permissions`

| Méthode | Route | Body | Description |
|---|---|---|---|
| `GET` | `/user-permissions/{user}` | — | Détail des accès |
| `POST` | `/user-permissions/{user}/assign-role` | `{ "role": "magasinier" }` | Ajouter un rôle |
| `POST` | `/user-permissions/{user}/remove-role` | `{ "role": "magasinier" }` | Retirer un rôle |
| `POST` | `/user-permissions/{user}/sync-roles` | `{ "roles": ["admin","manager"] }` | **Remplacer** tous les rôles (sync) |
| `POST` | `/user-permissions/{user}/grant-permission` | `{ "permission": "approve-loading-requests" }` | Permission directe (hors rôle) |
| `POST` | `/user-permissions/{user}/revoke-permission` | `{ "permission": "…" }` | Retirer une permission directe |
| `POST` | `/user-permissions/{user}/blacklist-permission` | `{ "permission": "…" }` | Refus explicite (prime sur les rôles) |
| `POST` | `/user-permissions/{user}/remove-blacklist` | `{ "permission": "…" }` | Lever le refus |
| `POST` | `/user-permissions/{user}/sync-permissions` | `{ "permissions": [names] }` | Sync des permissions directes |
| `GET` | `/user-permissions/{user}/effective` | — | Permissions effectives |

> **Modèle mental pour l'UI :** l'accès effectif d'un user =
> `(permissions de ses rôles) ∪ (permissions directes) − (blacklist)`.
> La blacklist permet l'exception : « ce magasinier précis ne doit PAS pouvoir ajuster le stock ».
> Le profil d'accès (`assign-profile`) est **orthogonal** : il ne porte pas de permissions,
> il porte des réglages fonctionnels (plafonds, scope de données).

---

## 4. Guards de sécurité (confirmés actifs)

| Guard | Où | Effet |
|---|---|---|
| **Suppression rôle `root` impossible** | `RolePermissionController::destroy` | 403 sur `root`, `admin`, `dispatcher`, `magasinier` (constante partagée `RbacController::PROTECTED_ROLES`) |
| **Permissions de `root` intouchables** | `updateRolePermission` | 403 — root garde toujours tous les droits |
| **Renommage root/admin bloqué** | `update` | 403 |
| **Suppression avec users bloquée** | `destroy` | 422 « reassign users first » |
| **Endpoints RBAC protégés** | routes `/rbac/*` | `permission:manage-rbac` (dynamique, lui-même remappable) |
| **Cache Spatie purgé** | store/update/sync | Prise d'effet immédiate côté API |

---

## 5. Les 34 permissions dynamiques (passe 2026-07-11) + mapping jour-1

Seeder : `php artisan db:seed --class=DynamicRbacPermissionsSeeder` (idempotent —
**doit tourner AVANT le déploiement des routes**, sinon 403 généralisés).

| Module | Permissions | Rôles jour-1 |
|---|---|---|
| Warehouses | `browse-` / `create-` / `edit-` / `delete-warehouses` | browse: +magasinier, dispatcher · write: root, admin |
| Stock | `browse-stock`, `browse-` / `create-stock-movements`, `adjust-stock` | movements: +magasinier · adjust: root, admin |
| Bons de préparation | `browse-` / `create-` / `edit-preparation-bills` | root, admin, dispatcher, magasinier |
| Master Data | `manage-master-data` | root, admin |
| Partenaires | `manage-partners` | root, admin |
| Demandes de chargement | `browse-` / `review-` / `approve-` / `reject-…-at-vendor` / `fulfill-loading-requests` | selon action (voir seeder) |
| Annulations factures | `browse-` / `approve-invoice-cancellations`, `confirm-decharge-reconciliation` | root, admin, adv_agent, sfa_supervisor / +magasinier, preparateur |
| Dérogations paiement | `browse-` / `create-` / `approve-payment-overrides` | create: +sfa_van_sales, sfa_order_taker · approve: sfa_supervisor |
| Contrôle crédit | `browse-credit-control` | root, admin, adv_agent, sfa_supervisor |
| POS / Dashboard / Settings | `browse-pos-catalog`, `view-manager-dashboard`, `manage-system-settings` | voir seeder |
| Finance | `browse-finance`, `manage-finance-journals`, `adjust-finance-ledger`, `manage-finance-transfers`, `reconcile-settlements` | browse/transfers/reconcile: +adv_agent · journals/ledger: root, admin |
| RBAC | `manage-rbac` | root, admin |
| **Produits** (catalogue admin complet : products, brands, categories, units, packagings, vat-taxes, suppliers, pages, sales-groups) | `browse-products` / `manage-products` | browse: 9 rôles back-office · manage: root, admin, manager, directeur_commercial |
| **Commandes** (BC admin) | `browse-orders` / `manage-orders` | browse: 7 rôles · manage: root, admin, adv_agent, dispatcher |
| **Pricing** (listes de prix) | `manage-pricing` | root, admin, manager, directeur_commercial |
| **Employés** | `manage-employees` | root, admin |

Source de vérité du mapping : [DynamicRbacPermissionsSeeder](../../database/seeders/DynamicRbacPermissionsSeeder.php).

### Permissions métier pré-existantes désormais APPLIQUÉES sur les routes

Le set **`promotions.*`** (12 permissions du `PromotionPermissionSeeder`) existait en base
mais n'était câblé sur **aucune route** — n'importe quel utilisateur connecté pouvait
créer/supprimer des promotions. Depuis le 2026-07-11 chaque route du bloc
`/api/backend/promotions` vérifie sa permission :

| Route | Permission |
|---|---|
| `GET` promotions / familles / boosts | `promotions.view` |
| `POST` (création promo, famille, boost) | `promotions.create` |
| `PUT` + boosts bulk-sync | `promotions.edit` |
| `DELETE` | `promotions.delete` |
| `POST {id}/clone` | `promotions.duplicate` |
| export / download-json | `promotions.export` |
| import / import-bulk | `promotions.import` |

Rôles porteurs (déjà en base — aucun changement nécessaire) : root, admin,
directeur_commercial (12/12) · manager (5/12) · technicien_commercial, user (view).

> Les permissions non câblées restantes du seeder (`promotions.approve`, `.reject`,
> `.test`, `.analytics`, `.generate-coupons`) sont réservées aux futurs endpoints
> de workflow d'approbation — ne pas les afficher comme actives dans la matrice.

---

## 6. Types TypeScript

```typescript
interface RbacRole {
  id: number;
  name: string;
  guard_name: string;
  users_count: number;
  permissions: string[];
  is_protected: boolean;   // désactiver Supprimer
  is_root: boolean;        // verrouiller toute la ligne
}

interface RbacPermissionCatalog {
  total: number;
  modules: Record<string, Array<{ id: number; name: string }>>;
}

interface RbacUserAccess {
  user: { id: number; name: string; email: string; branch_id: number | null };
  roles: Array<{ id: number; name: string; is_protected: boolean }>;
  direct_permissions: string[];
  effective_permissions: string[];
  effective_count: number;
}

type SyncRolePermissionsPayload = { permissions: string[] };  // POST /roles/{role}/permissions

interface RbacUserRow {                        // GET /rbac/users
  id: number;
  name: string;
  email: string;
  phone: string | null;
  branch_id: number | null;
  is_active: boolean;
  roles: string[];
  access_profile: { id: number; name: string } | null;
}

interface AccessProfile {                      // GET /rbac/access-profiles
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  users_count: number;
}

type AssignProfilePayload = { access_profile_id: number | null };
type SyncUserRolesPayload = { roles: string[] };
type UserPermissionPayload = { permission: string };
type CreateRolePayload = { name: string; default_permissions?: string[] };
type CloneRolePayload = { name: string };
```

---

## 7. Guide de construction — les 4 écrans RBAC

### Écran A — Liste des rôles

- Data : `GET /rbac/roles` (tout en un appel : permissions, users_count, flags)
- Actions par ligne : Éditer (→ écran B) · Cloner (`POST /roles/{role}/clone` `{name}`) ·
  Supprimer (`DELETE /roles/{role}`)
- Désactiver Supprimer quand `is_protected` ; afficher `users_count` dans la
  confirmation (422 backend si > 0)
- Bouton **+ Nouveau rôle** → modal `{ name, default_permissions?[] }` →
  `POST /roles` (name auto-lowercase côté backend). Astuce UX : proposer
  « partir d'un rôle existant » = clone.

### Écran B — Matrice des droits (rôle × permissions)

```
┌──────────────────────────────────────────────────────────────────────┐
│ Matrice des droits                    [🔍 search perm]  [+ Nouveau rôle]│
│                                                                        │
│ Module: Warehouses ▾                                                   │
│ ┌──────────────────────┬───────┬────────┬─────────────┬─────────────┐  │
│ │ Permission           │ root  │ admin  │ magasinier  │ assistant_… │  │
│ ├──────────────────────┼───────┼────────┼─────────────┼─────────────┤  │
│ │ browse-warehouses    │ 🔒✓   │  ☑     │   ☑         │   ☑         │  │
│ │ create-warehouses    │ 🔒✓   │  ☑     │   ☐         │   ☐         │  │
│ │ delete-warehouses    │ 🔒✓   │  ☑     │   ☐         │   ☐         │  │
│ └──────────────────────┴───────┴────────┴─────────────┴─────────────┘  │
│  🔒 = colonne root verrouillée (403 backend)                           │
└──────────────────────────────────────────────────────────────────────┘
```

- Colonnes : `GET /rbac/roles` · Lignes : `GET /rbac/permissions` (groupées par module)
- Sauvegarde **par rôle** : `POST /roles/{role}/permissions` avec la liste **complète**
  (c'est un sync, pas un delta) → toast avec le message backend (« X added, Y removed »)
- Verrouiller la colonne root (`is_root`) — le backend renvoie 403 de toute façon

### Écran C — Annuaire & affectation utilisateurs

```
┌──────────────────────────────────────────────────────────────────────────┐
│ Utilisateurs & Accès        [🔍 nom/email] [Rôle ▾] [Profil ▾] [Branche ▾] │
│ ┌────────────────┬──────────────────┬──────────────────────┬───────────┐  │
│ │ Ahmed Vendeur  │ magasinier       │ Profil Terrain Strict│ [Gérer ▸] │  │
│ │ Meriam ADV     │ adv_agent, admin │ —                    │ [Gérer ▸] │  │
│ └────────────────┴──────────────────┴──────────────────────┴───────────┘  │
└──────────────────────────────────────────────────────────────────────────┘
```

- Data : `GET /rbac/users` (search + filtres role/profil/branche)
- « Gérer » ouvre l'écran D

### Écran D — Fiche affectation d'un utilisateur (3 onglets)

1. **Rôles** — chips avec ajout/retrait :
   multi-select depuis `GET /rbac/roles` → `POST /user-permissions/{user}/sync-roles`
2. **Permissions individuelles** — deux listes :
   - *Accordées en direct* (`grant-permission` / `revoke-permission`)
   - *Blacklist* (`blacklist-permission` / `remove-blacklist`) — badge rouge,
     tooltip « prime sur les rôles »
3. **Profil d'accès** — dropdown depuis `GET /rbac/access-profiles` →
   `POST /rbac/users/{id}/assign-profile` (option « Aucun » = `null`).
   Bouton « ⚙ Gérer les profils » → écran E.

### Écran E — Gestion des profils d'accès (optionnel V1, endpoints prêts)

- Liste : `GET /rbac/access-profiles` (avec `users_count`)
- Création : `POST /rbac/access-profiles` — formulaire nom + description + éditeur
  clé/valeur pour `settings`
- Édition : `GET /rbac/access-profiles/{id}` puis `PUT` — toast 422
  `RBAC_PROFILE_HAS_USERS` si désactivation avec users affectés
- Clone : `POST /rbac/access-profiles/{id}/clone` `{name}` (copie aussi les data_rules)

En pied de fiche, panneau read-only **« Accès effectif »** alimenté par
`GET /rbac/users/{id}/access` (`effective_permissions` + compteur) — rafraîchir
après chaque mutation : c'est la vérité backend.

### Checklist d'intégration

- [ ] Tous les appels sous `Authorization: Bearer` + gestion 403 (`manage-rbac` requis)
- [ ] `is_protected` / `is_root` pilotent l'état des boutons (le backend garde le dernier mot)
- [ ] Sync (roles, permissions) = listes **complètes**, jamais des deltas
- [ ] Après toute mutation : re-fetch de l'accès effectif (pas de calcul local)
- [ ] Prise d'effet immédiate (cache Spatie purgé côté backend) — pas de bouton « Publier »
