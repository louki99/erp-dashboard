# Token Series & Device Keys — Guide UI

> **Audience :** équipe Frontend (Admin Panel + écrans GCOM)
> **Base URL access-control :** `/api/backend/access-control`
> **Base URL backend :** `/api/backend`
> **Auth :** Sanctum Bearer — rôle `admin` ou `root`, ou permission `admin.access-control.manage`
> **Date :** 2026-09-02 (voir §10 — nouveauté "Sales Souches")

---

> ## ⚠️ Breaking change (2026-09-02) — lire avant de toucher aux écrans GCOM
>
> Les écrans qui créent/convertissent une facture GCOM (BC → Facture, BL →
> Facture, facture directe comptoir, consolidation de BLs) envoyaient un
> champ **`souche_kind`** (`"declared"` ou `"internal"`, 2 valeurs figées).
> Ce champ **n'existe plus** — il est remplacé par **`sales_souche_id`**
> (entier, l'id d'une nouvelle entité `SalesSouche` — voir §10). Aucune
> compatibilité double n'est maintenue côté backend : tout payload envoyant
> encore `souche_kind` sera simplement ignoré (le champ n'est plus dans la
> liste des champs validés).
>
> **Ce qui doit changer côté UI :**
> - Tout `<select>`/toggle "Déclarée / Interne" codé en dur doit devenir un
>   sélecteur de souche alimenté par `GET /api/backend/access-control/sales-souches`
>   (voir §10.3 pour la liste des endpoints concernés).
> - La plupart des écrans n'ont **rien à changer** s'ils n'envoyaient jamais
>   ce champ : le comportement par défaut (aucune valeur envoyée) est
>   préservé à l'identique — la résolution automatique de la souche par
>   branche continue de fonctionner exactement comme avant.

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
10. [Sales Souches — nouveauté 2026-09-02](#10-sales-souches--nouveauté-2026-09-02)

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
| `bcf_prefix` | `bcf_next_number` | BC Fournisseur (Achats) |
| `brc_prefix` | `brc_next_number` | Bon de Réception (Achats) — pas `BR`, déjà pris par `return_*` |
| `facf_prefix` | `facf_next_number` | Facture Fournisseur (Achats) |
| `decf_prefix` | `decf_next_number` | Décaissement Fournisseur (Règlements) |

> Liste exhaustive : `App\Models\TokenSerie::NUMBERING_FAMILIES` (clé =
> préfixe de colonne, valeur = code `document_type` utilisé par
> `DocumentNumberingService`).

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

**Bug réel corrigé (2026-09-02, signalé par l'équipe UI)** : `show`/`update`/`destroy` renvoyaient un `500` générique pour **tout** code (`FD97`, `ERPDIST01`, peu importe le scope) alors que la liste fonctionnait normalement. Cause : le contrôleur s'appuie sur le binding de route implicite de Laravel (`show(TokenSerie $tokenSerie)`), et le modèle `TokenSerie` n'avait pas de `getRouteKeyName()` — Laravel liait donc par défaut sur `id` (bigint), et un code non numérique comme `FD97` remontait telle quelle jusqu'à Postgres (`invalid input syntax for type bigint`), une exception non interceptée plutôt qu'un `404` propre. Corrigé en faisant de `code` la clé de route (déjà unique en base, et déjà ce que toutes les URLs utilisent).

---

### `PUT /{code}` — Modifier

```http
PUT /api/backend/access-control/token-series/CAS-B01
Authorization: Bearer {token}
Content-Type: application/json

{
  "name": "Série Casablanca Centre — Mise à jour",
  "is_active": true,
  "bcf_prefix": "BCFCASB01",
  "bcf_next_number": 1
}
```

> Tous les champs sont optionnels (`sometimes`). Seuls les champs envoyés sont modifiés.

**Gouvernance de numérotation (2026-08-26, feu vert équipe UI)** — chaque
famille (`{family}_prefix`/`{family}_next_number`, liste complète §1) suit
sa **propre** règle de verrouillage, indépendante des autres familles sur
la même ligne :

- **Famille jamais tirée** (`next_number == 1`, valeur par défaut) →
  `prefix` et `next_number` librement éditables. C'est le cas "on définit
  le format avant la première utilisation".
- **Famille déjà consommée** (`next_number > 1` — un seul numéro a suffi
  pour verrouiller) → **toute tentative de modification renvoie `422`**,
  message explicite pointant vers l'endpoint de reset ci-dessous. Aucune
  exception, y compris pour `root`.
- Modifier une famille non verrouillée ne touche jamais aux autres — un BC
  déjà consommé (`order_next_number > 1`) n'empêche pas d'éditer
  `bcf_prefix` si cette famille-là est encore vierge.

**Erreur 422 — famille verrouillée :**
```json
{
  "message": "Numbering update rejected.",
  "errors": {
    "order": "Série 'order' (BC) déjà consommée (next_number > 1) — verrouillée. Utilisez POST .../reset-family."
  }
}
```

**Réponse 200 :**

```json
{
  "data": { "id": 14, "code": "CAS-B01", ... }
}
```

---

### `POST /{code}/reset-family` — Réinitialiser une famille verrouillée

**Seul moyen sanctionné** de reconfigurer une famille déjà consommée —
l'échappatoire "clôture d'exercice / changement d'année fiscale" demandée
par l'équipe UI. Volontairement une action séparée, plus verrouillée que
le `PUT` ci-dessus : passer la garde de route (`root`/`admin` ou
`admin.access-control.manage`) **ne suffit pas** — il faut en plus la
permission dédiée `reset-token-series-counter`, seedée `root` uniquement.
Un `admin` qui n'a pas cette permission reçoit un `403`, même s'il peut
éditer une famille non-consommée via `PUT`.

```http
POST /api/backend/access-control/token-series/CAS-B01/reset-family
Authorization: Bearer {token}
Content-Type: application/json

{
  "family": "bcf",
  "new_prefix": "BCFCASB01-2027",
  "new_next_number": 1,
  "reason": "Clôture exercice 2026 - nouvelle série 2027"
}
```

- `family` — une des clés de `TokenSerie::NUMBERING_FAMILIES` (§1), pas un nom de colonne arbitraire.
- `new_prefix` — optionnel, sinon le préfixe existant est conservé.
- `new_next_number` — optionnel, défaut `1`.
- `reason` — **obligatoire**, 10-500 caractères. Écrit dans les logs (`TokenSerie numbering family reset`) avec l'avant/après complet et l'auteur — ce n'est pas une simple UX, c'est la piste d'audit qui justifie de laisser cette porte ouverte.

**Réponse 200 :**
```json
{ "data": { "id": 14, "code": "CAS-B01", "bcf_prefix": "BCFCASB01-2027", "bcf_next_number": 1, ... } }
```

**Erreur 403 — permission manquante :**
```json
{ "message": "Forbidden. Requires permission reset-token-series-counter." }
```

> Ce endpoint ne modélise pas un exercice fiscal/une période comptable en
> tant qu'entité — rien de tel n'existe dans ce codebase aujourd'hui.
> C'est l'action manuelle qu'un admin root exécute AU moment de la clôture ;
> un futur workflow de clôture automatisé pourra appeler ce même endpoint.

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

## 10. Sales Souches — nouveauté 2026-09-02

### 10.1 Pourquoi cette entité existe

Avant, une facture GCOM était classée par un champ figé `souche_kind` sur la
`TokenSerie` : seulement 2 valeurs possibles, `declared` ("déclarée",
fiscale/export) ou `internal` ("interne", hors export). Aucune interface
d'admin ne permettait de créer/lier ce classement — c'était réglé une fois
en base par les devs.

Le client a besoin de **plus de 2 souches** par branche/société, avec un
**nom libre** ("Souche Export", "Vente Comptoir", "Casse & Dons"…), chacune
tirant d'un **compteur dédié** (une numérotation qui n'entre jamais en
collision avec une autre souche). `souche_kind` — un booléen déguisé — ne
pouvait pas exprimer ça. `SalesSouche` le remplace : une **vraie entité**,
administrable en CRUD, dont chaque ligne pointe vers **sa propre**
`TokenSerie` (relation 1:1 — jamais deux souches ne partagent un compteur).

`TokenSerie.souche_kind` reste en base (legacy/informatif, pour ne pas
casser l'historique) mais n'est **plus lu** par la résolution de
numérotation — tout passe désormais par `SalesSouche`.

### 10.2 Le modèle SalesSouche

| Champ | Type | Description |
|-------|------|--------------|
| `id` | int | — |
| `company_id` | int \| null | `null` = souche partagée par toute la société (portée globale) |
| `branch_code` | string \| null | `null` = souche globale, pas limitée à une branche |
| `code` | string (≤20) | Code court défini par l'admin — unique par `(company_id, branch_code)`, pas globalement |
| `name` | string (≤150) | Nom libre, ex. "Souche Export" |
| `fiscal_type` | `"declared"` \| `"internal"` | Seul champ à vocabulaire figé — c'est lui qui pilote la résolution automatique (§10.5), pas le nom/code |
| `token_serie_id` | int | La `TokenSerie` qui fournit le compteur — **1 série = au plus 1 souche** |
| `is_active` | boolean | Une souche inactive n'est jamais choisie automatiquement, et un `sales_souche_id` explicite pointant dessus est rejeté (`422`) |
| `is_default` | boolean | Au plus **une** souche active par `(company_id, branch_code)` peut être `is_default=true` — contrainte base, `409` sinon |

### 10.3 Workflow admin — toujours en 2 étapes, jamais automatique

1. **Créer/configurer la `TokenSerie`** via l'endpoint existant
   (`POST /api/backend/access-control/token-series`, §4) — c'est elle qui
   porte les 22 familles de préfixes/compteurs (facture, BC, BL, avoir…).
2. **Créer la `SalesSouche`** qui pointe vers cette série
   (`POST /api/backend/access-control/sales-souches`, ci-dessous).

Ce endpoint **ne crée jamais** de `TokenSerie` à votre place — si
`token_serie_id` ne correspond à aucune série existante, `422`.

### 10.4 API Reference

**Base :** `/api/backend/access-control/sales-souches` (même garde d'accès
que `token-series` — rôle `admin`/`root` ou `admin.access-control.manage`).

---

#### `GET /` — Lister

```http
GET /api/backend/access-control/sales-souches?branch_code=CAS001&active_only=1
Authorization: Bearer {token}
```

| Paramètre | Type | Description |
|-----------|------|--------------|
| `branch_code` | string | Filtrer par branche |
| `active_only` | boolean | `true` pour n'afficher que les souches actives |
| `per_page` | int | 1–500, défaut 100 |

**Réponse 200 :**

```json
{
  "data": [
    {
      "id": 7,
      "company_id": 1,
      "branch_code": "CAS001",
      "code": "EXPORT",
      "name": "Souche Export",
      "fiscal_type": "declared",
      "token_serie_id": 14,
      "token_serie": { "id": 14, "code": "CAS-B01", "name": "Série Casablanca Branch B01" },
      "is_active": true,
      "is_default": true,
      "created_at": "2026-09-02T09:00:00.000Z",
      "updated_at": "2026-09-02T09:00:00.000Z"
    }
  ],
  "links": { ... },
  "meta": { "current_page": 1, "total": 3 }
}
```

---

#### `POST /` — Créer une souche

```http
POST /api/backend/access-control/sales-souches
Authorization: Bearer {token}
Content-Type: application/json

{
  "branch_code": "CAS001",
  "code": "EXPORT",
  "name": "Souche Export",
  "fiscal_type": "declared",
  "token_serie_id": 14,
  "is_active": true,
  "is_default": true
}
```

**Champs requis :** `code`, `name`, `fiscal_type` (`declared`\|`internal`), `token_serie_id`.

**Réponse 201 :**

```json
{ "data": { "id": 7, "code": "EXPORT", "token_serie": { "id": 14, "code": "CAS-B01", "name": "..." }, ... } }
```

**Erreur 409 — série déjà liée à une autre souche :**

```json
{ "message": "Cette série est déjà liée à une autre souche — une série ne peut alimenter qu'une seule souche." }
```

**Erreur 409 — une souche par défaut existe déjà pour cette branche/société :**

```json
{
  "message": "Une souche par défaut est déjà active pour cette portée : Souche Déclarée (CAS-B01). Désactivez-la d'abord.",
  "conflicting_sales_souche_id": 3
}
```

---

#### `GET /{id}` — Détail

```http
GET /api/backend/access-control/sales-souches/7
```

**Réponse 200 :** `{ "data": { "id": 7, ..., "token_serie": { ...détail complet de la TokenSerie... } } }`

---

#### `PUT /{id}` — Modifier

```http
PUT /api/backend/access-control/sales-souches/7
Content-Type: application/json

{ "name": "Souche Export (Europe)", "is_default": false }
```

> `token_serie_id` n'est **volontairement pas modifiable** ici — ré-attacher
> une souche existante à une autre série redémarrerait son compteur sous la
> même identité, un risque fiscal plus grave qu'une simple erreur de nom.
> Pour changer de série : supprimer la souche et en recréer une.

Même conflit `409 conflicting_sales_souche_id` que `POST` si vous passez `is_default: true` alors qu'une autre souche active l'est déjà pour la même portée.

---

#### `DELETE /{id}` — Supprimer

```http
DELETE /api/backend/access-control/sales-souches/7
```

**Erreur 409 — souche référencée :**

```json
{
  "message": "Cannot delete sales souche while referenced.",
  "references": ["is_default (déliez-la comme souche par défaut avant de la supprimer)", "payment_terms.default_sales_souche_id"]
}
```

### 10.5 Résolution automatique — quand aucun `sales_souche_id` n'est envoyé

C'est le comportement à connaître pour savoir **si un écran doit changer ou
non** (voir l'encadré breaking-change en haut de page). Quand une facture
GCOM est créée **sans** `sales_souche_id` explicite, le backend choisit
dans cet ordre, et s'arrête au premier trouvé :

1. La souche `is_default=true` de la **branche** de l'acteur (fiscal_type `declared` uniquement).
2. À défaut, la souche `is_default=true` **globale** (`branch_code = null`, fiscal_type `declared`).
3. À défaut, s'il n'existe qu'**une seule** souche `declared` active pour la branche, elle est prise.
4. Sinon → `422` (`No active default sales souche available for ... numbering.`) — l'admin doit configurer une souche par défaut.

**Garantie importante pour les écrans qui n'envoient jamais d'override** :
ces 3 tiers ne considèrent **que** les souches `fiscal_type=declared` — un
document sans `sales_souche_id` explicite ne tombe **jamais** sur une
souche `internal`, même si elle est flaguée `is_default`. Seul un
`sales_souche_id` envoyé explicitement par l'UI peut sélectionner une
souche `internal`.

### 10.6 Impact sur les 4 endpoints GCOM concernés

| Endpoint | Avant | Après |
|----------|-------|-------|
| `POST /api/backend/gcom/orders/{order}/convert-to-invoice` | `souche_kind?: 'declared'\|'internal'` | `sales_souche_id?: int` |
| `POST /api/backend/gcom/direct-invoices` (facture directe comptoir) | `souche_kind?: 'declared'\|'internal'` | `sales_souche_id?: int` |
| `POST /api/backend/gcom/delivery-notes/{deliveryNote}/convert-to-invoice` | `souche_kind?: 'declared'\|'internal'` | `sales_souche_id?: int` |
| `POST /api/backend/gcom/invoices/consolidate` | `souche_kind?: 'declared'\|'internal'` | `sales_souche_id?: int` |

Dans les 4 cas, le champ reste **optionnel** — voir §10.5 pour ce qui se
passe s'il est omis. La réponse de chacun de ces endpoints inclut désormais
`sales_souche_id` (en plus de `souche_kind`, conservé pour compat
affichage/legacy) dans l'objet `invoice` retourné.

### 10.7 PaymentTerm — nouveau champ + nouveaux endpoints d'écriture

`PaymentTerm.is_internal_souche` (booléen) est **supprimé** — remplacé par
`default_sales_souche_id` (int \| null, FK vers `sales_souches`). Un moyen
de terme de paiement de crédit sans souche par défaut explicite (`null`)
signifie "utiliser la souche par défaut de la branche" (§10.5).

Nouveauté également : `POST`/`PUT` sur les termes de paiement n'existaient
pas avant (seuls liste + suppression existaient). Contrairement aux autres
routes de ce groupe `masterdata` (aucune permission requise), ces deux-là
sont protégées par la permission **`manage-master-data`** — c'est un
levier fiscal, pas une simple donnée de référence.

```http
POST /api/backend/masterdata/payment-terms
Authorization: Bearer {token}
Content-Type: application/json

{
  "code": "CREDIT_30J_EXPORT",
  "name": "Crédit 30j (Export)",
  "days_number": 30,
  "is_credit": true,
  "default_sales_souche_id": 7,
  "active": true
}
```

```http
PUT /api/backend/masterdata/payment-terms/{id}
Content-Type: application/json

{ "default_sales_souche_id": null }
```

**Réponse 403 sans la permission `manage-master-data` :**

```json
{ "message": "This action is unauthorized." }
```

### 10.8 Types TypeScript

```typescript
export type SalesSoucheFiscalType = 'declared' | 'internal';

export interface SalesSouche {
  id: number;
  company_id: number | null;
  branch_code: string | null;
  code: string;
  name: string;
  fiscal_type: SalesSoucheFiscalType;
  token_serie_id: number;
  token_serie?: { id: number; code: string; name: string };
  is_active: boolean;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreateSalesSouchePayload {
  branch_code?: string | null;
  code: string;
  name: string;
  fiscal_type: SalesSoucheFiscalType;
  token_serie_id: number;
  is_active?: boolean;
  is_default?: boolean;
}

export interface UpdateSalesSouchePayload {
  branch_code?: string | null;
  code?: string;
  name?: string;
  fiscal_type?: SalesSoucheFiscalType;
  // token_serie_id n'est pas modifiable — voir §10.4
  is_active?: boolean;
  is_default?: boolean;
}

export interface SalesSoucheFilters {
  branch_code?: string;
  active_only?: boolean;
  per_page?: number;
}

// Sur les 4 endpoints GCOM (§10.6) — remplace l'ancien souche_kind
export interface SalesSoucheOverride {
  sales_souche_id?: number;
}
```

### 10.9 React Query hooks

```typescript
const AC_BASE = '/api/backend/access-control';

export function useSalesSouches(filters: SalesSoucheFilters = {}) {
  return useQuery({
    queryKey: ['sales-souches', filters],
    queryFn: () => axios.get(`${AC_BASE}/sales-souches`, { params: filters }).then((r) => r.data),
  });
}

export function useSalesSouche(id: number) {
  return useQuery({
    queryKey: ['sales-souches', id],
    queryFn: () => axios.get(`${AC_BASE}/sales-souches/${id}`).then((r) => r.data),
    enabled: !!id,
  });
}

export function useCreateSalesSouche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CreateSalesSouchePayload) =>
      axios.post(`${AC_BASE}/sales-souches`, payload).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-souches'] }),
  });
}

export function useUpdateSalesSouche(id: number) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: UpdateSalesSouchePayload) =>
      axios.put(`${AC_BASE}/sales-souches/${id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['sales-souches'] });
      qc.invalidateQueries({ queryKey: ['sales-souches', id] });
    },
  });
}

export function useDeleteSalesSouche() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => axios.delete(`${AC_BASE}/sales-souches/${id}`).then((r) => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sales-souches'] }),
  });
}
```

### 10.10 Erreurs spécifiques à Sales Souches

| Code | Cause | Action UI |
|------|-------|-----------|
| `409` (`store`/`update`) | `token_serie_id` déjà lié à une autre souche | Message direct — proposer de choisir une autre série ou d'en créer une |
| `409` (`store`/`update`) | Une souche par défaut existe déjà pour cette portée | Utiliser `conflicting_sales_souche_id` pour proposer un lien direct vers elle |
| `409` (`destroy`) | Souche encore `is_default` ou référencée par un `payment_terms.default_sales_souche_id` | Modal listant `references[]`, bloquer la suppression |
| `422` (endpoints GCOM §10.6) | `sales_souche_id` inconnu ou inactif | "Cette souche n'est pas disponible — vérifier la configuration" |
| `422` (endpoints GCOM §10.6, aucun override envoyé) | Aucune souche par défaut active pour la branche (§10.5, cas 4) | "Aucune souche configurée pour cette branche — contacter un admin" |

### 10.11 Scénario complet — configurer une nouvelle souche "Export"

```typescript
// 1. La série existe déjà (créée via §4) — sinon la créer d'abord
const serie = await axios.get(`${AC_BASE}/token-series/CAS-EXPORT-01`);

// 2. Créer la souche qui pointe vers elle
const createSouche = useCreateSalesSouche();
const { data: souche } = await createSouche.mutateAsync({
  branch_code: 'CAS001',
  code: 'EXPORT',
  name: 'Souche Export',
  fiscal_type: 'declared',
  token_serie_id: serie.data.id,
  is_active: true,
  is_default: false, // ne remplace pas le default existant
});

// 3. (Optionnel) lier un terme de paiement à cette souche par défaut
await axios.put(`/api/backend/masterdata/payment-terms/${termId}`, {
  default_sales_souche_id: souche.data.id,
});

// 4. Ou : l'écran de facturation directe passe l'id explicitement
await axios.post('/api/backend/gcom/direct-invoices', {
  partner_id: 42,
  items: [...],
  payment_method: 'credit',
  payment_term_id: termId,
  sales_souche_id: souche.data.id, // au lieu de l'ancien souche_kind: 'declared'
});
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

### Sales Souches (nouveau, 2026-09-02)

| Méthode | URL | Action |
|---------|-----|--------|
| `GET` | `/api/backend/access-control/sales-souches` | Lister |
| `POST` | `/api/backend/access-control/sales-souches` | Créer |
| `GET` | `/api/backend/access-control/sales-souches/{id}` | Détail |
| `PUT` | `/api/backend/access-control/sales-souches/{id}` | Modifier |
| `DELETE` | `/api/backend/access-control/sales-souches/{id}` | Supprimer |
| `POST` | `/api/backend/masterdata/payment-terms` | Créer un terme de paiement (`manage-master-data`) |
| `PUT` | `/api/backend/masterdata/payment-terms/{id}` | Modifier (`manage-master-data`) |

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
