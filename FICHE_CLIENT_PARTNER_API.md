# Fiche client (Partner) — champs et API

Document de référence pour une fiche client complète et professionnelle, et le payload JSON attendu par le backend.

---

## 1. Structure professionnelle de la fiche client

### 1.1 Compte utilisateur (optionnel) — `auth`
À renseigner si le client doit avoir un accès B2B (login).

| Champ | Obligatoire si auth | Description | Exemple |
|-------|----------------------|-------------|---------|
| `auth.name` | Non | Prénom / nom de la personne | `"Karim"` |
| `auth.last_name` | Non | Nom de famille | `"Benali"` |
| `auth.email` | **Oui** | Email unique (login) | `"contact@client.ma"` |
| `auth.password` | **Oui** | Mot de passe (min 6 caractères) | `"MotDePasse123"` |
| `auth.phone` | Non | Téléphone | `"+212600000001"` |
| `auth.phone_code` | Non | Indicatif | `"+212"` |
| `auth.gender` | Non | `male` \| `female` | `"male"` |
| `auth.date_of_birth` | Non | Date de naissance | `"1985-04-15"` |
| `auth.branch_code` | Non | Code agence (référence `branches.code`) | `"A0001"` |
| `auth.geo_area_code` | Non | Zone géo (référence `geo_areas.code`) | `"AGE-CASA"` |
| `auth.is_active` | Non | Compte actif | `true` |
| `auth.target_app` | Non | `B2B` \| `ERP` \| `POS` | `"B2B"` |

---

### 1.2 Identification & classification — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.code` | Non | Code client (généré si vide) | `"CL000042"` |
| `partner.name` | **Oui** | Raison sociale / nom | `"Supermarché Atlas SARL"` |
| `partner.partner_type` | Non | Type (CUSTOMER, B2B, SUPPLIER…) | `"B2B"` |
| `partner.channel` | Non | Canal (RETAIL, B2B, DIRECT, HORECA…) | `"DIRECT"` |
| `partner.status` | Non | ACTIVE, ON_HOLD, BLOCKED, CLOSED | `"ACTIVE"` |
| `partner.risk_score` | Non | Score risque 0–100 | `10` |
| `partner.parent_partner_id` | Non | ID partenaire parent (groupe) | `null` |
| `partner.salesperson_id` | Non | ID commercial (référence `users.id`) | `3` |

---

### 1.3 Tarification & paiement — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.price_list_id` | **Oui** | ID grille tarifaire | `1` |
| `partner.payment_term_id` | Non | ID condition de paiement par défaut | `2` |
| `partner.currency` | Non | Devise (3 lettres) | `"MAD"` |
| `partner.credit_limit` | Non | Plafond crédit | `50000` |
| `partner.default_discount_rate` | Non | Remise par défaut (0–100 %) | `5` |
| `partner.default_discount_amount` | Non | Remise fixe | `0` |
| `partner.max_discount_rate` | Non | Remise max autorisée (0–100 %) | `15` |

---

### 1.4 Fiscalité — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.tax_number_ice` | Non | ICE | `"001234567000023"` |
| `partner.tax_number_if` | Non | IF | `"12345678"` |
| `partner.tax_exempt` | Non | Exonéré TVA | `false` |
| `partner.vat_group_code` | Non | Code groupe TVA | `"TVA20"` |

---

### 1.5 Contact — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.phone` | Non | Téléphone principal | `"+212600000001"` |
| `partner.whatsapp` | Non | WhatsApp | `"+212600000001"` |
| `partner.email` | Non | Email société | `"contact@atlas.ma"` |
| `partner.website` | Non | Site web | `"https://atlas.ma"` |

---

### 1.6 Adresse — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.address_line1` | Non | Adresse ligne 1 | `"123 Rue Mohammed V"` |
| `partner.address_line2` | Non | Complément | `"Bât. A, 2e étage"` |
| `partner.city` | Non | Ville | `"Casablanca"` |
| `partner.region` | Non | Région | `"Casablanca-Settat"` |
| `partner.country` | Non | Code pays (ISO 2) | `"MA"` |
| `partner.postal_code` | Non | Code postal | `"20000"` |
| `partner.geo_area_code` | Non | Zone géo (référence `geo_areas.code`) | `"SEC-CASA-AINC-02"` |
| `partner.geo_lat` | Non | Latitude | `33.5731` |
| `partner.geo_lng` | Non | Longitude | `-7.5898` |

**Recherche d’adresse et GPS :** pour aider l’utilisateur à remplir l’adresse, la ville et les coordonnées (lat/lng), utiliser l’API Geo : **recherche typeahead** (`GET /api/backend/geo/search`) et **reverse geocoding** (`GET /api/backend/geo/reverse`). Voir **[GEO_API_FRONTEND_GUIDE.md](./GEO_API_FRONTEND_GUIDE.md)**.

---

### 1.7 Livraison & commande — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.delivery_zone` | Non | Zone de livraison | `"Zone Nord Casablanca"` |
| `partner.delivery_instructions` | Non | Instructions livraison | `"Livraison matin uniquement"` |
| `partner.min_order_amount` | Non | Montant minimum commande | `500` |
| `partner.opening_hours` | Non | Horaires (objet/JSON) | `{"mon":"08:00-18:00"}` |

---

### 1.8 Options & blocage — `partner`

| Champ | Obligatoire | Description | Exemple |
|-------|------------|-------------|---------|
| `partner.allow_show_on_pos` | Non | Visible sur POS | `false` |
| `partner.blocked_until` | Non | Blocage jusqu’à (date) | `null` |
| `partner.block_reason` | Non | Motif blocage | `null` |

---

### 1.9 Champs personnalisés — `custom_fields`

Clés = **noms de champs** (ex. `partner_rib`, `partner_rc`) tels que définis dans `custom_fields` (entity `partner`). Les valeurs sont des chaînes (ou booléen pour type checkbox).

| Exemple clé | Exemple valeur |
|-------------|----------------|
| `partner_rib` | `"MA0123456789012345677"` |
| `partner_rc` | `"RC12345"` |

---

## 2. Endpoint

- **Création :** `POST /api/backend/partners`
- **Mise à jour :** `PUT /api/backend/partners/{id}`

---

## 3. Exemple de payload JSON complet (création)

À transmettre au backend pour une fiche client complète (avec compte B2B + custom fields).

```json
{
  "auth": {
    "name": "Karim",
    "last_name": "Benali",
    "email": "contact@atlas.ma",
    "password": "SecurePass123!",
    "phone": "+212600000001",
    "phone_code": "+212",
    "gender": "male",
    "date_of_birth": "1985-04-15",
    "branch_code": "A0001",
    "geo_area_code": "AGE-CASA",
    "is_active": true,
    "target_app": "B2B"
  },
  "partner": {
    "code": "",
    "name": "Supermarché Atlas SARL",
    "partner_type": "B2B",
    "channel": "DIRECT",
    "status": "ACTIVE",
    "risk_score": 10,
    "salesperson_id": 3,
    "parent_partner_id": null,

    "price_list_id": 1,
    "payment_term_id": 2,
    "currency": "MAD",
    "credit_limit": 50000,
    "default_discount_rate": 5,
    "default_discount_amount": 0,
    "max_discount_rate": 15,

    "tax_number_ice": "001234567000023",
    "tax_number_if": "12345678",
    "tax_exempt": false,
    "vat_group_code": "TVA20",

    "phone": "+212600000001",
    "whatsapp": "+212600000001",
    "email": "contact@atlas.ma",
    "website": "https://atlas.ma",

    "address_line1": "123 Rue Mohammed V",
    "address_line2": "Quartier Industriel, Bât. A",
    "city": "Casablanca",
    "region": "Casablanca-Settat",
    "country": "MA",
    "postal_code": "20000",
    "geo_area_code": "SEC-CASA-AINC-02",
    "geo_lat": 33.5731,
    "geo_lng": -7.5898,

    "delivery_zone": "Zone Nord Casablanca",
    "delivery_instructions": "Livraison le matin uniquement. Contacter le gardien.",
    "min_order_amount": 500,
    "opening_hours": {
      "mon": "08:00-12:00, 14:00-18:00",
      "tue": "08:00-12:00, 14:00-18:00",
      "wed": "08:00-12:00, 14:00-18:00",
      "thu": "08:00-12:00, 14:00-18:00",
      "fri": "08:00-12:00, 14:00-16:00",
      "sat": "08:00-12:00",
      "sun": "Fermé"
    },

    "allow_show_on_pos": false,
    "blocked_until": null,
    "block_reason": null
  },
  "custom_fields": {
    "partner_rib": "MA0123456789012345677",
    "partner_rc": "RC12345"
  }
}
```

---

## 4. Exemple sans compte B2B (client sans login)

Si le client n’a pas d’accès B2B, ne pas envoyer `auth` et ne pas lier de `customer_id` (le backend ne créera pas d’utilisateur).

```json
{
  "partner": {
    "name": "Épicerie du Marché",
    "partner_type": "CUSTOMER",
    "channel": "RETAIL",
    "status": "ACTIVE",
    "price_list_id": 1,
    "payment_term_id": 1,
    "credit_limit": 0,
    "default_discount_rate": 0,
    "phone": "+212600000099",
    "email": "epicerie@example.ma",
    "address_line1": "45 Bd Zerktouni",
    "city": "Casablanca",
    "region": "Casablanca-Settat",
    "country": "MA",
    "postal_code": "20100",
    "geo_area_code": "SEC-CASA-01",
    "tax_number_ice": "001234567000099",
    "tax_exempt": false,
    "delivery_zone": "Centre",
    "min_order_amount": 200
  },
  "custom_fields": {}
}
```

---

## 5. Références pour les listes (masterdata)

Pour remplir les listes déroulantes du formulaire, utiliser :

- `GET /api/backend/masterdata/for-partner-form` — tout en un (price lists, payment terms, geo areas, branches, salespersons, custom fields…)
- ou les endpoints ciblés :  
  `GET /api/backend/masterdata/geo-areas`,  
  `GET /api/backend/masterdata/branches`,  
  `GET /api/backend/masterdata/price-lists`,  
  `GET /api/backend/masterdata/payment-terms`,  
  `GET /api/backend/masterdata/custom-fields/partner`.

Les codes envoyés dans le payload (`branch_code`, `geo_area_code`, `price_list_id`, `payment_term_id`, etc.) doivent exister dans ces référentiels.
