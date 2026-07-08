# Token Series & Device Keys — Guide UI

> **Audience :** équipe Frontend (Admin Panel)
> **Base URL access-control :** `/api/backend/access-control`
> **Base URL backend :** `/api/backend`
> **Auth :** Sanctum Bearer — rôle `admin` ou `root`, ou permission `admin.access-control.manage`
> **Date :** 2026-07-07

---

## Table des matières

1. [C'est quoi une Token Serie ?](#1-cest-quoi-une-token-serie-)
2. [C'est quoi un Device Key ?](#2-cest-quoi-un-device-key-)
3. [Relation entre les deux](#3-relation-entre-les-deux)
4. [Token Series — API Reference](#4-token-series--api-reference)
5. [Device Keys — API Reference](#5-device-keys--api-reference)
6. [Types TypeScript](#6-types-typescript)
7. [React Query hooks](#7-react-query-hooks)
8. [Erreurs et codes de retour](#8-erreurs-et-codes-de-retour)
9. [Scénarios complets](#9-scénarios-complets)

---

## 1. C'est quoi une Token Serie ?

Une **Token Serie** est la **configuration de numérotation des documents** pour un appareil ou un groupe d'appareils.

Chaque document généré dans le système (commande, facture, bon de livraison, visite…) porte un numéro unique. Ce numéro est construit à partir d'un **préfixe** et d'un **compteur séquentiel** définis dans la Token Serie.

```
Token Serie: CAS-A01
  order_prefix:     "BCCAS-A01"
  order_next_number: 47
  
→  Prochain BC généré:  BCCAS-A010000047
                        ──────────────── 8 chiffres (digits_in_counter = 8)
```

### Pourquoi c'est critique

Sans Token Serie correctement configurée et assignée à un device :
- Les salespersons **ne peuvent pas créer de commandes** (numérotation impossible)
- Les livraisons n'ont pas de BL valide
- L'audit comptable ne peut pas réconcilier les documents

### Scopes disponibles

| Scope | Valeur | Signification |
|-------|--------|---------------|
| Global | `"global"` | Utilisable par toutes les branches et tous les devices |
| Branch | `"branch"` | Restreint à certaines branches (`allowed_branches`) |
| Device | `"device"` | Généré automatiquement pour un device spécifique |

### Types de documents supportés

| Champ prefix | Champ compteur | Document |
|-------------|----------------|---------|
| `invoice_prefix` | `invoice_next_number` | Facture |
| `order_prefix` | `order_next_number` | Bon de Commande (BC) |
| `payment_prefix` | `payment_next_number` | Paiement générique |
| `cash_payment_prefix` | `cash_payment_next_number` | Paiement espèces |
| `check_payment_prefix` | `check_payment_next_number` | Paiement chèque/effet |
| `credit_note_prefix` | `credit_note_next_number` | Avoir |
| `deposit_slip_prefix` | `deposit_slip_next_number` | Versement bancaire |
| `activity_prefix` | `activity_next_number` | Activité (visite sans vente) |
| `do_prefix` | `do_next_number` | Delivery Order |
| `batch_prefix` | `batch_next_number` | Lot logistique |
| `visit_prefix` | `visit_next_number` | Visite |
| `loading_prefix` | `loading_next_number` | Chargement |
| `transfer_prefix` | `transfer_next_number` | Bon de Livraison |
| `return_prefix` | `return_next_number` | Retour |
| `damage_prefix` | `damage_next_number` | Casse |
| `unloading_prefix` | `unloading_next_number` | Déchargement |
| `session_prefix` | `session_next_number` | Session de travail |
| `expense_prefix` | `expense_next_number` | Note de frais |

### Auto-génération

Si un salesperson se connecte sur un device qui n'a pas encore de Token Serie assignée, le système en crée une automatiquement via `TokenSerie::autoGenerate()` :

```
Code généré :  {BRANCH_PREFIX}-{LETTRE}{NUMERO}
Exemples   :   CAS-A01,  CAS-A02,  CAS-Z99,  CAS-AA01
```

Tous les préfixes sont dérivés du code pour garantir l'unicité globale.

---

## 2. C'est quoi un Device Key ?

Un **Device Key** est le **ticket d'authentification d'un appareil mobile** (tablette, smartphone) auprès du backend.

C'est la clé qui permet à l'app SFA de :
1. S'authentifier sans re-saisir le mot de passe à chaque fois
2. Accéder au catalogue, aux commandes, aux livraisons
3. Utiliser la numérotation documentaire (via la Token Serie assignée)
4. Activer le PIN de déverrouillage rapide

### Cycle de vie d'un Device Key

```
[Créé par admin]  →  [Activé par l'app mobile]  →  [PIN défini]  →  [Actif]
      STEP 1                  STEP 2                   STEP 3
                                                           │
                                              [Révoqué / Tournant / Reset PIN]
                                                        STEP 4
```

### États d'un Device Key

| État | Condition | Description |
|------|-----------|-------------|
| **Actif** | `revoked_at = null` | Le device peut s'authentifier |
| **Activé** | `activated_at ≠ null AND pin_hash ≠ null` | PIN défini, login rapide disponible |
| **Verrouillé** | `locked_until > now()` | Trop de tentatives PIN incorrectes |
| **Révoqué** | `revoked_at ≠ null` | Bloqué — aucun accès possible |

### Champs importants

| Champ | Type | Description |
|-------|------|-------------|
| `key` | string | La clé d'authentification (envoyée dans le header `X-Device-Key`) |
| `user_id` | int | Le salesperson associé |
| `branch_id` | int | La branche assignée |
| `token_series_code` | string | La serie de numérotation |
| `device_type` | string | `android`, `ios`, `tablet`… |
| `hardware_serial` | string | Numéro de série physique du device |
| `push_token` | string | Token FCM/APNs pour les notifications push |
| `app_version` | string | Version de l'app installée |
| `failed_attempts` | int | Tentatives PIN échouées (reset à 0 après succès) |
| `locked_until` | datetime | Date de fin de verrouillage |
| `last_seen_at` | datetime | Dernière activité (mis à jour automatiquement) |
| `last_sync_at` | datetime | Dernière tentative de sync |
| `last_successful_sync_at` | datetime | Dernière sync réussie |

---

## 3. Relation entre les deux

```
token_series (1) ──────────── (N) device_keys
     code ◄──────────────────── token_series_code

token_series (1) ──────────── (N) pos_devices
     code ◄──────────────────── tokenserie_code
```

Un Device Key **hérite** de la numérotation de sa Token Serie. Quand un salesperson crée un BC depuis son device :

```
1. L'app envoie la commande avec X-Device-Key: adm-xxx
2. Le backend charge le DeviceKey → lit token_series_code → charge la TokenSerie
3. Incrémente order_next_number de la TokenSerie
4. Génère le numéro: {order_prefix}{compteur_padded}
5. Sauvegarde la commande avec ce numéro unique
```

---

## 4. Token Series — API Reference

**Base :** `/api/backend/access-control/token-series`

> Note : Il existe aussi `/api/backend/token-series` (routes générales backend). Pour l'administration complète (CRUD admin), utiliser le préfixe `/api/backend/access-control`.

---

### `GET /` — Lister les séries

```http
GET /api/backend/access-control/token-series
Authorization: Bearer {token}
```

**Query params :**

| Paramètre | Type | Description |
|-----------|------|-------------|
| `active_only` | boolean | `true` pour n'afficher que les séries actives |
| `per_page` | int | 1–500, défaut 100 |

**Réponse 200 :**

```json
{
  "data": [
    {
      "id": 1,
      "code": "GLOBAL-01",
      "name": "Série globale par défaut",
      "description": "Utilisée par tous les devices sans série dédiée",
      "scope": "global",
      "allowed_branches": null,
      "branch_code": null,
      "digits_in_counter": 6,
      "is_default": true,
      "is_active": true,
      "auto_generated": false,
      "invoice_prefix": "INV-G01",
      "invoice_next_number": 1842,
      "order_prefix": "BC-G01",
      "order_next_number": 3291,
      "payment_prefix": "PAY-G01",
      "payment_next_number": 3291,
      "cash_payment_prefix": "CSH-G01",
      "cash_payment_next_number": 2100,
      "check_payment_prefix": "CHQ-G01",
      "check_payment_next_number": 1191,
      "credit_note_prefix": "AVR-G01",
      "credit_note_next_number": 45,
      "deposit_slip_prefix": "VRS-G01",
      "deposit_slip_next_number": 388,
      "visit_prefix": "VIS-G01",
      "visit_next_number": 9021,
      "session_prefix": "WS-G01",
      "session_next_number": 412,
      "created_at": "2026-01-17T20:00:00.000Z",
      "updated_at": "2026-07-06T08:12:00.000Z"
    }
  ],
  "links": { ... },
  "meta": { "current_page": 1, "total": 12 }
}
```

---

### `POST /` — Créer une série

```http
POST /api/backend/access-control/token-series
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "CAS-B01",
  "name": "Série Casablanca Branch B01",
  "description": "Serie pour les salespersons de la branche Casa-Centre",
  "scope": "branch",
  "allowed_branches": ["CAS001", "CAS002"],
  "digits_in_counter": 6,
  "is_default": false,
  "is_active": true,
  "invoice_prefix": "INVCASB01",
  "invoice_next_number": 1,
  "order_prefix": "BCCASB01",
  "order_next_number": 1,
  "payment_prefix": "PAYCASB01",
  "payment_next_number": 1,
  "cash_payment_prefix": "CSHCASB01",
  "cash_payment_next_number": 1,
  "check_payment_prefix": "CHQCASB01",
  "check_payment_next_number": 1,
  "credit_note_prefix": "AVRCASB01",
  "credit_note_next_number": 1,
  "deposit_slip_prefix": "VRSCASB01",
  "deposit_slip_next_number": 1,
  "visit_prefix": "VISCASB01",
  "visit_next_number": 1,
  "session_prefix": "WSCASB01",
  "session_next_number": 1,
  "activity_prefix": "ACTCASB01",
  "activity_next_number": 1,
  "do_prefix": "DOCASB01",
  "do_next_number": 1,
  "batch_prefix": "BATCHCASB01",
  "batch_next_number": 1,
  "loading_prefix": "LODCASB01",
  "loading_next_number": 1,
  "transfer_prefix": "BLCASB01",
  "transfer_next_number": 1,
  "return_prefix": "RETCASB01",
  "return_next_number": 1,
  "damage_prefix": "DMGCASB01",
  "damage_next_number": 1,
  "unloading_prefix": "UNLCASB01",
  "unloading_next_number": 1,
  "expense_prefix": "EXPCASB01",
  "expense_next_number": 1
}
```

**Champs requis :** `code` (unique), `name`, `scope`

**Réponse 201 :**

```json
{
  "data": {
    "id": 14,
    "code": "CAS-B01",
    "name": "Série Casablanca Branch B01",
    ...
  }
}
```

**Erreur 422 — code déjà utilisé :**

```json
{
  "message": "The code has already been taken.",
  "errors": { "code": ["The code has already been taken."] }
}
```

---

### `GET /{code}` — Détail + usage

```http
GET /api/backend/access-control/token-series/CAS-B01
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "data": {
    "id": 14,
    "code": "CAS-B01",
    ...
  },
  "usage": {
    "device_keys_count": 3,
    "pos_devices_count": 1
  }
}
```

> Le champ `usage` indique combien de device_keys et de POS devices référencent cette série. À vérifier avant suppression.

---

### `PUT /{code}` — Modifier

```http
PUT /api/backend/access-control/token-series/CAS-B01
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Série Casablanca Centre — Mise à jour",
  "is_active": true,
  "order_next_number": 500
}
```

> Tous les champs sont optionnels (`sometimes`). Seuls les champs envoyés sont modifiés.

> ⚠️ **Attention :** Modifier `{document}_next_number` en arrière peut créer des **collisions de numéros** si des documents ont déjà été générés. Ne jamais diminuer un compteur en production.

**Réponse 200 :**

```json
{
  "data": { "id": 14, "code": "CAS-B01", ... }
}
```

---

### `DELETE /{code}` — Supprimer

```http
DELETE /api/backend/access-control/token-series/CAS-B01
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{ "message": "Deleted" }
```

**Erreur 409 — références existantes :**

```json
{
  "message": "Cannot delete token serie while referenced.",
  "references": [
    "device_keys.token_series_code",
    "pos_devices.tokenserie_code (2 rows)"
  ]
}
```

> Avant de supprimer, il faut d'abord réassigner ou désassigner les device_keys et POS devices qui utilisent cette série.

---

## 5. Device Keys — API Reference

**Base :** `/api/backend/access-control/device-keys`

---

### `GET /` — Lister les device keys

```http
GET /api/backend/access-control/device-keys
Authorization: Bearer {token}
```

**Query params :**

| Paramètre | Type | Description |
|-----------|------|-------------|
| `user_id` | int | Filtrer par salesperson |
| `revoked` | boolean | `true` = révoqués seulement, `false` = actifs seulement |
| `branch_code` | string | Filtrer par branche |
| `token_series_code` | string | Filtrer par série |
| `key` | string | Recherche exacte par clé |
| `per_page` | int | 1–200, défaut 50 |

**Réponse 200 :**

```json
{
  "data": [
    {
      "id": 12,
      "user_id": 42,
      "user": { "id": 42, "name": "Omar El Alaoui", "email": "omar@example.com" },
      "key": "adm-k7x9p2mn8vqrtz4j6w1yuioeabc",
      "device_type": "android",
      "branch_id": 5,
      "branch": { "code": "CAS001", "name": "Casa Centre" },
      "token_series_code": "CAS-A01",
      "hardware_serial": "R52N8002ABC",
      "device_model_code": "SM-T505",
      "app_version": "2.4.1",
      "os_version": "Android 13",
      "last_seen_at": "2026-07-07T09:14:22.000Z",
      "last_sync_at": "2026-07-07T09:14:20.000Z",
      "last_successful_sync_at": "2026-07-07T09:14:20.000Z",
      "last_known_ip": "41.248.12.5",
      "failed_attempts": 0,
      "locked_until": null,
      "activated_at": "2026-05-12T10:30:00.000Z",
      "revoked_at": null,
      "created_at": "2026-05-10T08:00:00.000Z",
      "updated_at": "2026-07-07T09:14:22.000Z"
    }
  ],
  "links": { ... },
  "meta": { "current_page": 1, "total": 38 }
}
```

---

### `POST /` — Créer un device key

Utilisé pour **enregistrer manuellement un nouveau device** ou créer une clé pour un salesperson.

```http
POST /api/backend/access-control/device-keys
Authorization: Bearer {token}
Content-Type: application/json

{
  "user_id": 42,
  "device_type": "android",
  "branch_code": "CAS001",
  "token_series_code": "CAS-A01",
  "hardware_serial": "R52N8002ABC",
  "device_model_code": "SM-T505",
  "push_token": "eXaMpLeFcMtOkEn...",
  "app_version": "2.4.1",
  "os_version": "Android 13",
  "peripherals": { "printer": { "model": "Bluetooth-58mm", "ip": null } },
  "metadata": {}
}
```

> Le champ `key` est **optionnel**. Si absent, le backend génère automatiquement une clé au format `adm-{random32chars}`.

**Réponse 201 :**

```json
{
  "data": {
    "id": 55,
    "user_id": 42,
    "user": { "id": 42, "name": "Omar El Alaoui", "email": "omar@example.com" },
    "key": "adm-a3f8bk92xpqr7tnz1vmc6wyd0ei",
    "device_type": "android",
    "token_series_code": "CAS-A01",
    "revoked_at": null,
    "created_at": "2026-07-07T10:00:00.000Z"
  }
}
```

---

### `GET /{id}` — Détail d'un device key

```http
GET /api/backend/access-control/device-keys/55
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "data": {
    "id": 55,
    "user": { "id": 42, "name": "Omar El Alaoui", "email": "omar@example.com" },
    "token_serie": {
      "id": 14,
      "code": "CAS-A01",
      "name": "Série Casablanca A01",
      "order_next_number": 3291
    },
    "key": "adm-a3f8bk92xpqr7tnz1vmc6wyd0ei",
    "device_type": "android",
    ...
  }
}
```

> Le `show` charge en plus la relation `tokenSerie` complète (contrairement au `index` qui ne retourne que le code).

---

### `PUT /{id}` — Modifier un device key

Permet de réassigner la **branche**, la **token serie**, de mettre à jour les infos matériel ou le push token.

```http
PUT /api/backend/access-control/device-keys/55
Authorization: Bearer {token}
Content-Type: application/json

{
  "token_series_code": "CAS-B01",
  "branch_code": "CAS002",
  "push_token": "newFcmToken...",
  "app_version": "2.5.0"
}
```

**Champs modifiables :**

| Champ | Description |
|-------|-------------|
| `device_type` | Type d'appareil |
| `branch_code` | Réassigner la branche |
| `token_series_code` | **Changer la série de numérotation** |
| `hardware_serial` | Numéro de série hardware |
| `device_model_code` | Modèle de l'appareil |
| `device_id_digest` | Hash de l'identifiant stable du device |
| `push_token` | Token FCM/APNs |
| `app_version` | Version de l'app |
| `os_version` | Version de l'OS |
| `peripherals` | Config imprimante, scanner, etc. |
| `metadata` | Données libres JSON |
| `last_known_ip` | Dernière IP connue |

> `user_id` et `key` ne sont **pas modifiables** via update — utiliser `rotate` pour changer la clé.

**Réponse 200 :**

```json
{
  "data": { "id": 55, "token_series_code": "CAS-B01", ... }
}
```

---

### `DELETE /{id}` — Supprimer (hard delete)

```http
DELETE /api/backend/access-control/device-keys/55
Authorization: Bearer {token}
```

> Par défaut, **refuse** si le device est encore actif (non révoqué). Il faut d'abord révoquer ou passer `?force=1`.

```http
DELETE /api/backend/access-control/device-keys/55?force=1
```

**Réponse 409 — device actif sans `force` :**

```json
{
  "message": "Key is active. Call POST …/revoke first, or delete with ?force=1.",
  "hint": "Hard delete removes the row; prefer revoke for audit trail."
}
```

**Réponse 200 :**

```json
{ "message": "Deleted" }
```

> ⚠️ Préférer `revoke` au lieu de `delete` pour conserver la trace d'audit.

---

### `POST /{id}/revoke` — Révoquer un device

Bloque immédiatement l'accès du device. Opération **réversible** via `restore`.

```http
POST /api/backend/access-control/device-keys/55/revoke
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "message": "Revoked",
  "data": {
    "id": 55,
    "revoked_at": "2026-07-07T14:30:00.000Z",
    ...
  }
}
```

---

### `POST /{id}/restore` — Restaurer un device révoqué

```http
POST /api/backend/access-control/device-keys/55/restore
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "message": "Restored",
  "data": {
    "id": 55,
    "revoked_at": null,
    ...
  }
}
```

---

### `POST /{id}/rotate` — Tourner la clé d'authentification

Génère une **nouvelle clé** et invalide l'ancienne. Le device devra se reconnecter.

```http
POST /api/backend/access-control/device-keys/55/rotate
Authorization: Bearer {token}
Content-Type: application/json

{}
```

> Optionnellement, passer une clé personnalisée :

```json
{ "key": "custom-key-value" }
```

**Réponse 200 :**

```json
{
  "message": "Key rotated",
  "data": {
    "id": 55,
    "key": "adm-newrotatedkey987654321xyz",
    ...
  }
}
```

---

### `POST /{id}/reset-pin` — Réinitialiser le PIN SFA

Efface le PIN de l'app SFA et déverrouille le device (si verrouillé). Le salesperson devra définir un nouveau PIN depuis l'app après son prochain login par mot de passe.

> **Réservé aux devices SFA** (`sfa_van_sales`, `sfa_order_taker`, `sfa_collector`). Retourne 422 pour les autres rôles.

```http
POST /api/backend/access-control/device-keys/55/reset-pin
Authorization: Bearer {token}
```

**Réponse 200 :**

```json
{
  "message": "Salesperson device PIN has been reset. The user must set a new PIN from the app after password login.",
  "data": {
    "id": 55,
    "user_id": 42,
    "key": "adm-a3f8bk92xpqr7tnz1vmc6wyd0ei",
    "failed_attempts": 0,
    "locked_until": null,
    "requires_pin_setup": true
  }
}
```

**Erreur 422 — pas un SFA :**

```json
{
  "message": "This device key is not linked to an SFA salesperson account."
}
```

---

### `POST /{id}/set-pin` — Définir un PIN depuis l'admin

Permet à un admin de définir le PIN à la place du salesperson (cas : device perdu/remplacé).

```http
POST /api/backend/access-control/device-keys/55/set-pin
Authorization: Bearer {token}
Content-Type: application/json

{
  "pin": "1234"
}
```

> Format PIN : 4 à 8 chiffres uniquement.

**Réponse 200 :**

```json
{
  "message": "Salesperson device PIN has been set.",
  "data": {
    "id": 55,
    "user_id": 42,
    "failed_attempts": 0,
    "locked_until": null,
    "requires_pin_setup": false
  }
}
```

---

## 6. Types TypeScript

```typescript
// ─── Token Serie ───────────────────────────────────────────────────────────

export type TokenSerieScope = 'global' | 'branch' | 'device';

export interface TokenSerieNumbering {
  invoice_prefix: string | null;
  invoice_next_number: number;
  order_prefix: string | null;
  order_next_number: number;
  payment_prefix: string | null;
  payment_next_number: number;
  cash_payment_prefix: string | null;
  cash_payment_next_number: number;
  check_payment_prefix: string | null;
  check_payment_next_number: number;
  credit_note_prefix: string | null;
  credit_note_next_number: number;
  deposit_slip_prefix: string | null;
  deposit_slip_next_number: number;
  activity_prefix: string | null;
  activity_next_number: number;
  do_prefix: string | null;
  do_next_number: number;
  batch_prefix: string | null;
  batch_next_number: number;
  visit_prefix: string | null;
  visit_next_number: number;
  loading_prefix: string | null;
  loading_next_number: number;
  transfer_prefix: string | null;
  transfer_next_number: number;
  return_prefix: string | null;
  return_next_number: number;
  damage_prefix: string | null;
  damage_next_number: number;
  unloading_prefix: string | null;
  unloading_next_number: number;
  session_prefix: string | null;
  session_next_number: number;
  expense_prefix: string | null;
  expense_next_number: number;
}

export interface TokenSerie extends TokenSerieNumbering {
  id: number;
  code: string;
  name: string;
  description: string | null;
  scope: TokenSerieScope;
  allowed_branches: string[] | null;
  branch_code: string | null;
  digits_in_counter: number;
  is_default: boolean;
  is_active: boolean;
  auto_generated: boolean;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface TokenSerieDetail {
  data: TokenSerie;
  usage: {
    device_keys_count: number;
    pos_devices_count: number;
  };
}

export interface CreateTokenSeriePayload {
  code: string;
  name: string;
  description?: string;
  scope: TokenSerieScope;
  allowed_branches?: string[] | null;
  digits_in_counter?: number;
  is_default?: boolean;
  is_active?: boolean;
  // Tous les préfixes et compteurs — optionnels à la création
  [key: string]: unknown;
}

export interface UpdateTokenSeriePayload {
  name?: string;
  description?: string;
  scope?: TokenSerieScope;
  allowed_branches?: string[] | null;
  is_default?: boolean;
  is_active?: boolean;
  // Mise à jour sélective d'un compteur (attention : ne jamais diminuer)
  order_next_number?: number;
  invoice_next_number?: number;
  // ... autres compteurs
}

// ─── Device Key ────────────────────────────────────────────────────────────

export interface DeviceKeyUser {
  id: number;
  name: string;
  email: string;
}

export interface DeviceKeyBranch {
  code: string;
  name: string;
}

export interface DeviceKey {
  id: number;
  user_id: number;
  user?: DeviceKeyUser;
  key: string;
  device_type: string | null;
  branch_id: number | null;
  branch?: DeviceKeyBranch;
  token_series_code: string | null;
  token_serie?: TokenSerie;
  hardware_serial: string | null;
  device_model_code: string | null;
  device_id_digest: string | null;
  push_token: string | null;
  app_version: string | null;
  os_version: string | null;
  last_known_ip: string | null;
  peripherals: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  activation_token: string | null;
  activation_expires_at: string | null;
  activated_at: string | null;
  failed_attempts: number;
  locked_until: string | null;
  last_seen_at: string | null;
  last_sync_at: string | null;
  last_successful_sync_at: string | null;
  revoked_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateDeviceKeyPayload {
  user_id: number;
  key?: string;               // auto-généré si absent
  device_type?: string;
  branch_code?: string;
  token_series_code?: string;
  hardware_serial?: string;
  device_model_code?: string;
  push_token?: string;
  app_version?: string;
  os_version?: string;
  peripherals?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface UpdateDeviceKeyPayload {
  device_type?: string;
  branch_code?: string | null;
  token_series_code?: string | null;
  hardware_serial?: string | null;
  device_model_code?: string | null;
  device_id_digest?: string | null;
  push_token?: string | null;
  app_version?: string | null;
  os_version?: string | null;
  peripherals?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  last_known_ip?: string | null;
}

export interface RotateKeyPayload {
  key?: string;               // si absent, génère automatiquement
}

export interface SetPinPayload {
  pin: string;                // 4–8 chiffres
}

export interface PinOperationResult {
  id: number;
  user_id: number;
  key: string;
  failed_attempts: number;
  locked_until: string | null;
  requires_pin_setup: boolean;
}

// ─── Filtres ───────────────────────────────────────────────────────────────

export interface DeviceKeyFilters {
  user_id?: number;
  revoked?: boolean;
  branch_code?: string;
  token_series_code?: string;
  key?: string;
  per_page?: number;
}

export interface TokenSerieFilters {
  active_only?: boolean;
  per_page?: number;
}
```

---

## 7. React Query hooks

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';

const AC_BASE = '/api/backend/access-control';

// ─── Token Series ──────────────────────────────────────────────────────────

export function useTokenSeries(filters: TokenSerieFilters = {}) {
  return useQuery({
    queryKey: ['token-series', filters],
    queryFn: () =>
      axios
        .get(`${AC_BASE}/token-series`, { params: filters })
        .then((r) => r.data),
  });
}

export function useTokenSerie(code: string) {
  return useQuery({
    queryKey: ['token-series', code],
    queryFn: () =>
      axios.get(`${AC_BASE}/token-series/${code}`).then((r) => r.data),
    enabled: !!code,
  });
}

export function useCreateTokenSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateTokenSeriePayload) =>
      axios.post(`${AC_BASE}/token-series`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['token-series'] }),
  });
}

export function useUpdateTokenSerie(code: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateTokenSeriePayload) =>
      axios.put(`${AC_BASE}/token-series/${code}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['token-series'] });
      qc.invalidateQueries({ queryKey: ['token-series', code] });
    },
  });
}

export function useDeleteTokenSerie() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (code: string) =>
      axios.delete(`${AC_BASE}/token-series/${code}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['token-series'] }),
  });
}

// ─── Device Keys ───────────────────────────────────────────────────────────

export function useDeviceKeys(filters: DeviceKeyFilters = {}) {
  return useQuery({
    queryKey: ['device-keys', filters],
    queryFn: () =>
      axios
        .get(`${AC_BASE}/device-keys`, { params: filters })
        .then((r) => r.data),
  });
}

export function useDeviceKey(id: number) {
  return useQuery({
    queryKey: ['device-keys', id],
    queryFn: () =>
      axios.get(`${AC_BASE}/device-keys/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateDeviceKeyPayload) =>
      axios.post(`${AC_BASE}/device-keys`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-keys'] }),
  });
}

export function useUpdateDeviceKey(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateDeviceKeyPayload) =>
      axios.put(`${AC_BASE}/device-keys/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['device-keys'] });
      qc.invalidateQueries({ queryKey: ['device-keys', id] });
    },
  });
}

export function useDeleteDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, force = false }: { id: number; force?: boolean }) =>
      axios
        .delete(`${AC_BASE}/device-keys/${id}`, { params: force ? { force: 1 } : {} })
        .then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['device-keys'] }),
  });
}

export function useRevokeDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      axios.post(`${AC_BASE}/device-keys/${id}/revoke`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['device-keys'] });
      qc.invalidateQueries({ queryKey: ['device-keys', id] });
    },
  });
}

export function useRestoreDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      axios.post(`${AC_BASE}/device-keys/${id}/restore`).then((r) => r.data),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: ['device-keys'] });
      qc.invalidateQueries({ queryKey: ['device-keys', id] });
    },
  });
}

export function useRotateDeviceKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, key }: { id: number; key?: string }) =>
      axios
        .post(`${AC_BASE}/device-keys/${id}/rotate`, key ? { key } : {})
        .then((r) => r.data),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: ['device-keys'] });
      qc.invalidateQueries({ queryKey: ['device-keys', id] });
    },
  });
}

export function useResetDevicePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) =>
      axios.post(`${AC_BASE}/device-keys/${id}/reset-pin`).then((r) => r.data),
    onSuccess: (_, id) => qc.invalidateQueries({ queryKey: ['device-keys', id] }),
  });
}

export function useSetDevicePin() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, pin }: { id: number; pin: string }) =>
      axios
        .post(`${AC_BASE}/device-keys/${id}/set-pin`, { pin })
        .then((r) => r.data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: ['device-keys', id] }),
  });
}
```

---

## 8. Erreurs et codes de retour

| Code | Cause | Action UI |
|------|-------|-----------|
| `401` | Token expiré ou absent | Rediriger vers login |
| `403` | Rôle insuffisant | Afficher "Accès refusé" |
| `404` | ID ou code inexistant | Toast "Ressource introuvable" |
| `409` | Conflit — suppression impossible | Modal avec liste des références bloquantes |
| `422` | Validation échouée | Afficher les erreurs par champ (`errors.{field}[0]`) |
| `500` | Erreur serveur interne | Toast "Erreur serveur" + log Sentry |

### Pattern de validation d'erreur

```typescript
try {
  await createTokenSerie.mutateAsync(payload);
} catch (error) {
  if (axios.isAxiosError(error) && error.response?.status === 422) {
    const errors = error.response.data.errors as Record<string, string[]>;
    // errors.code[0] → "The code has already been taken."
    setFieldErrors(errors);
  } else if (axios.isAxiosError(error) && error.response?.status === 409) {
    const refs = error.response.data.references as string[];
    // Afficher une modal: "Impossible de supprimer — références: ..."
    showConflictModal(refs);
  }
}
```

---

## 9. Scénarios complets

---

### Scénario A — Onboarding d'un nouveau salesperson

**Contexte :** Omar vient d'être recruté comme Van Seller à Casa. Il faut lui créer son device key et lui assigner la série de sa branche.

#### Étape 1 — Vérifier si une série existe pour la branche CAS001

```typescript
const { data } = useTokenSeries({ active_only: true });
const casSerie = data?.data.find(s => s.allowed_branches?.includes('CAS001'));
// Si aucune série branch → utiliser la série globale ou en créer une
```

#### Étape 2 — Créer le device key

```typescript
const createKey = useCreateDeviceKey();

await createKey.mutateAsync({
  user_id: 42,                    // Omar
  device_type: 'android',
  branch_code: 'CAS001',
  token_series_code: 'CAS-A01',  // Série de la branche
  hardware_serial: 'R52N8002ABC',
  device_model_code: 'SM-T505',
  app_version: '2.4.1',
  os_version: 'Android 13',
});

// → Retourne { data: { id: 55, key: "adm-xxx...", ... } }
```

#### Étape 3 — Communiquer la clé à l'app mobile

La clé générée doit être **scannée par l'app** (QR code) ou communiquée manuellement lors de l'activation. Elle ne s'affiche qu'une seule fois dans la réponse de création.

---

### Scénario B — Réassigner la Token Serie d'un device

**Contexte :** La branche CAS001 reçoit une nouvelle série de numérotation `CAS-C01` (reset des compteurs pour un nouvel exercice fiscal). Il faut mettre à jour tous les devices de cette branche.

```typescript
// 1. Récupérer tous les device keys de la branche
const { data } = useDeviceKeys({ branch_code: 'CAS001', revoked: false });

// 2. Mettre à jour chacun
const updateKey = useUpdateDeviceKey(0); // id dynamique

for (const device of data.data) {
  await axios.put(`${AC_BASE}/device-keys/${device.id}`, {
    token_series_code: 'CAS-C01',
  });
}
```

---

### Scénario C — Salesperson bloqué (trop de tentatives PIN)

**Contexte :** Karim a essayé son PIN 5 fois de suite. Son device est verrouillé jusqu'à 17h00.

```typescript
// L'admin voit dans la liste :
// device.failed_attempts = 5
// device.locked_until = "2026-07-07T17:00:00.000Z"

// Solution : reset PIN
const resetPin = useResetDevicePin();
await resetPin.mutateAsync(deviceId);

// → failed_attempts = 0, locked_until = null, requires_pin_setup = true
// Karim doit se reconnecter avec son mot de passe et choisir un nouveau PIN
```

---

### Scénario D — Tablette perdue / volée

**Contexte :** La tablette d'un livreur a été volée. Bloquer immédiatement l'accès.

```typescript
// 1. Révoquer le device key immédiatement
const revoke = useRevokeDeviceKey();
await revoke.mutateAsync(deviceKeyId);

// 2. (Optionnel) Tourner la clé pour invalider tout cache
const rotate = useRotateDeviceKey();
await rotate.mutateAsync({ id: deviceKeyId });

// Résultat : aucune requête de ce device ne passera plus l'auth
// La révocation est réversible via restore si la tablette est retrouvée
```

---

### Scénario E — Créer une série pour un nouveau device (manuel)

**Contexte :** Un device POS vient d'être livré et il n'existe pas encore de série pour lui.

```typescript
const createSerie = useCreateTokenSerie();

await createSerie.mutateAsync({
  code: 'RBA-A01',
  name: 'Série Rabat Device A01',
  scope: 'device',
  allowed_branches: ['RBA001'],
  digits_in_counter: 6,
  is_active: true,
  is_default: false,

  // Préfixes
  invoice_prefix: 'INVRBA-A01',     invoice_next_number: 1,
  order_prefix: 'BCRBA-A01',        order_next_number: 1,
  payment_prefix: 'PAYRBA-A01',     payment_next_number: 1,
  cash_payment_prefix: 'CSHRBA-A01', cash_payment_next_number: 1,
  check_payment_prefix: 'CHQRBA-A01', check_payment_next_number: 1,
  credit_note_prefix: 'AVRRBA-A01', credit_note_next_number: 1,
  deposit_slip_prefix: 'VRSRBA-A01', deposit_slip_next_number: 1,
  visit_prefix: 'VISRBA-A01',       visit_next_number: 1,
  session_prefix: 'WSRBA-A01',      session_next_number: 1,
  activity_prefix: 'ACTRBA-A01',    activity_next_number: 1,
  do_prefix: 'DORBA-A01',           do_next_number: 1,
  batch_prefix: 'BATCHRBA-A01',     batch_next_number: 1,
  loading_prefix: 'LODRBA-A01',     loading_next_number: 1,
  transfer_prefix: 'BLRBA-A01',     transfer_next_number: 1,
  return_prefix: 'RETRBA-A01',      return_next_number: 1,
  damage_prefix: 'DMGRBA-A01',      damage_next_number: 1,
  unloading_prefix: 'UNLRBA-A01',   unloading_next_number: 1,
  expense_prefix: 'EXPRBA-A01',     expense_next_number: 1,
});

// Puis assigner la série au device key
await axios.put(`${AC_BASE}/device-keys/${deviceKeyId}`, {
  token_series_code: 'RBA-A01',
});
```

---

### Scénario F — Vérifier avant suppression d'une série

```typescript
const deleteTokenSerie = useDeleteTokenSerie();

const handleDelete = async (code: string) => {
  try {
    // 1. Vérifier l'usage via show
    const { data } = await axios.get(`${AC_BASE}/token-series/${code}`);
    const { device_keys_count, pos_devices_count } = data.usage;

    if (device_keys_count > 0 || pos_devices_count > 0) {
      showModal({
        title: 'Impossible de supprimer',
        message: `Cette série est utilisée par ${device_keys_count} device(s) mobile(s) et ${pos_devices_count} POS device(s). Réassignez-les d'abord.`,
      });
      return;
    }

    // 2. Supprimer
    await deleteTokenSerie.mutateAsync(code);
    showToast('Série supprimée');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 409) {
      showModal({ message: error.response.data.message });
    }
  }
};
```

---

## Résumé des endpoints

### Token Series

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/access-control/token-series` | Lister |
| `POST` | `/api/backend/access-control/token-series` | Créer |
| `GET` | `/api/backend/access-control/token-series/{code}` | Détail + usage |
| `PUT` | `/api/backend/access-control/token-series/{code}` | Modifier |
| `DELETE` | `/api/backend/access-control/token-series/{code}` | Supprimer |

### Device Keys

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/access-control/device-keys` | Lister |
| `POST` | `/api/backend/access-control/device-keys` | Créer |
| `GET` | `/api/backend/access-control/device-keys/{id}` | Détail |
| `PUT` | `/api/backend/access-control/device-keys/{id}` | Modifier / Réassigner série |
| `DELETE` | `/api/backend/access-control/device-keys/{id}` | Supprimer (hard) |
| `POST` | `/api/backend/access-control/device-keys/{id}/revoke` | Révoquer |
| `POST` | `/api/backend/access-control/device-keys/{id}/restore` | Restaurer |
| `POST` | `/api/backend/access-control/device-keys/{id}/rotate` | Tourner la clé |
| `POST` | `/api/backend/access-control/device-keys/{id}/reset-pin` | Reset PIN SFA |
| `POST` | `/api/backend/access-control/device-keys/{id}/set-pin` | Définir PIN SFA |

---

*Dernière mise à jour : 2026-07-07*
