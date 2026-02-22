# Geo API — Guide frontend (recherche d’adresse & GPS partenaire)

Guide pour les développeurs frontend qui utilisent l’API Geo lors de la **création ou édition d’un partenaire** : recherche d’adresse (typeahead), ville, et coordonnées GPS (lat/lng).

---

## 1. Vue d’ensemble

L’API Geo expose trois endpoints protégés par **Sanctum** :

| Endpoint | Rôle | Usage typique |
|----------|------|----------------|
| `GET /api/backend/geo/search` | Autocomplete d’adresse | Saisie d’adresse partenaire (rue, ville, code postal) |
| `GET /api/backend/geo/reverse` | Coordonnées → adresse | Clic sur la carte ou géolocalisation client → remplir l’adresse |
| `GET /api/backend/geo/providers` | Config active | Afficher le pays par défaut (ex. Maroc) |

- **Base URL** : même origine que votre API (ex. `https://api.votredomaine.ma` ou `http://localhost:8000`).
- **Authentification** : en-tête `Authorization: Bearer <token>` (token Sanctum).
- **Pays par défaut** : toutes les recherches sont limitées au **Maroc** sauf si vous passez `country=` (global) ou `country=fr` (autre pays). Voir [§ 6](#6-pays-et-paramètre-country).

---

## 2. Recherche d’adresse (typeahead) — `GET /api/backend/geo/search`

À utiliser dans un champ **adresse** ou **ville** du formulaire partenaire : l’utilisateur tape, le front envoie la requête et affiche une liste de suggestions.

### Paramètres

| Paramètre | Obligatoire | Description |
|-----------|-------------|-------------|
| `q` | **Oui** | Texte saisi par l’utilisateur (min. 3 caractères) |
| `limit` | Non | Nombre de résultats (défaut `8`, max `20`) |
| `lang` | Non | Code langue pour les libellés (`fr`, `en`, etc.), défaut `fr` |
| `country` | Non | Code pays ISO 2 (défaut `ma`). Vide = recherche mondiale |

### Exemple de requête

```http
GET /api/backend/geo/search?q=anfa&limit=8&lang=fr
Authorization: Bearer <votre_token_sanctum>
Accept: application/json
```

### Exemple de réponse (200)

```json
{
  "query": "anfa",
  "provider": "photon",
  "items": [
    {
      "label": "Anfa, Casablanca, Grand Casablanca-Settat, Maroc",
      "country": "Maroc",
      "region": "Grand Casablanca-Settat",
      "city": "Casablanca",
      "street": null,
      "postcode": null,
      "lat": 33.5899,
      "lng": -7.6218,
      "provider_ref": "photon:R:5435600",
      "raw": { }
    },
    {
      "label": "Boulevard d'Anfa, Casablanca, Maroc",
      "country": "Maroc",
      "region": "Grand Casablanca-Settat",
      "city": "Casablanca",
      "street": "Boulevard d'Anfa",
      "postcode": "20000",
      "lat": 33.588,
      "lng": -7.632,
      "provider_ref": "photon:W:...",
      "raw": { }
    }
  ]
}
```

- **`label`** : texte complet à afficher dans la liste déroulante.
- **`city`**, **`region`**, **`country`**, **`street`**, **`postcode`** : champs structurés pour remplir le formulaire partenaire.
- **`lat`**, **`lng`** : coordonnées GPS à envoyer dans `partner.geo_lat` / `partner.geo_lng`.

Si aucun résultat : `items` est un tableau vide (toujours 200).

---

## 3. Reverse geocoding (lat/lng → adresse) — `GET /api/backend/geo/reverse`

Utile quand l’utilisateur :
- clique sur une carte pour choisir un point, ou  
- active la géolocalisation du navigateur.

Vous avez déjà `lat` et `lng` ; cet endpoint renvoie l’adresse correspondante pour pré-remplir le formulaire.

### Paramètres

| Paramètre | Obligatoire | Description |
|-----------|-------------|-------------|
| `lat` | **Oui** | Latitude (-90 à 90) |
| `lng` | **Oui** | Longitude (-180 à 180) |
| `lang` | Non | Langue des libellés (défaut `fr`) |
| `country` | Non | Code pays (défaut `ma`) |

### Exemple de requête

```http
GET /api/backend/geo/reverse?lat=33.59&lng=-7.62&lang=fr
Authorization: Bearer <votre_token_sanctum>
Accept: application/json
```

### Exemple de réponse (200)

```json
{
  "provider": "nominatim",
  "result": {
    "label": "Boulevard d'Anfa, Casablanca, Grand Casablanca-Settat, Maroc",
    "country": "Maroc",
    "region": "Grand Casablanca-Settat",
    "city": "Casablanca",
    "street": "Boulevard d'Anfa",
    "postcode": "20000",
    "lat": 33.59,
    "lng": -7.62,
    "provider_ref": "nominatim:12345678",
    "raw": { }
  }
}
```

Si aucune adresse trouvée : `result` est `null` et un champ `message` peut être présent (toujours 200).

---

## 4. Config des providers — `GET /api/backend/geo/providers`

Permet d’afficher en front le pays par défaut (ex. « Recherche limitée au Maroc »).

### Exemple de réponse (200)

```json
{
  "search_provider": "photon",
  "reverse_provider": "nominatim",
  "supported": ["photon", "nominatim", "opencage", "google"],
  "default_country": {
    "code": "ma",
    "name": "Maroc"
  }
}
```

---

## 5. Utilisation dans le formulaire partenaire (Create Partner)

Référence des champs partenaire : [FICHE_CLIENT_PARTNER_API.md](./FICHE_CLIENT_PARTNER_API.md).

### 5.1 Mapping : réponse Geo → champs `partner`

À partir d’un **item** de `/geo/search` ou de **result** de `/geo/reverse` :

| Champ API Geo | Champ partenaire (`partner.*`) | Note |
|---------------|--------------------------------|------|
| `street` | `address_line1` | Rue + numéro si présent |
| — | `address_line2` | Complément saisi manuellement par l’utilisateur |
| `city` | `city` | Ville |
| `region` | `region` | Région |
| `country` | `country` | Libellé « Maroc » → normaliser en code **`MA`** pour le backend |
| `postcode` | `postal_code` | Code postal |
| `lat` | `geo_lat` | Latitude |
| `lng` | `geo_lng` | Longitude |

- **`label`** : à utiliser comme texte affiché dans le champ adresse (ou pour pré-remplir une seule ligne).
- **`geo_area_code`** : n’est pas fourni par l’API Geo ; à choisir via la liste masterdata (`/api/backend/masterdata/for-partner-form` ou `geo-areas`) en fonction de la ville/région si besoin.

### 5.2 Scénario 1 : l’utilisateur tape l’adresse (typeahead)

1. Champ « Adresse » ou « Ville » : à chaque saisie (debounced, ex. 300 ms), si `q.length >= 3` :
   - `GET /api/backend/geo/search?q=<saisie>&limit=8&lang=fr`
2. Afficher les `items` en liste déroulante (ex. `item.label`).
3. Au clic sur une suggestion :
   - Remplir les champs du formulaire avec le mapping ci-dessus (street → address_line1, city, region, country → MA, postal_code, geo_lat, geo_lng).

### 5.3 Scénario 2 : l’utilisateur clique sur la carte ou utilise le GPS

1. Vous obtenez `lat` / `lng` (carte ou `navigator.geolocation`).
2. Appel : `GET /api/backend/geo/reverse?lat=<lat>&lng=<lng>&lang=fr`
3. Si `result` n’est pas null : remplir adresse, ville, région, pays, code postal, et **garder** `result.lat` / `result.lng` dans `partner.geo_lat` / `partner.geo_lng`.

---

## 6. Pays et paramètre `country`

- **Par défaut** : les recherches sont limitées au **Maroc** (config backend `GEO_DEFAULT_COUNTRY=ma`).
- Pour garder ce comportement : ne pas envoyer `country` dans l’URL.
- Pour une recherche **mondiale** : `?country=` (valeur vide).
- Pour un **autre pays** : `?country=fr`, `?country=dz`, etc. (code ISO 2).

Exemple : recherche limitée à la France :

```http
GET /api/backend/geo/search?q=lyon&country=fr
```

---

## 7. Exemples de code (JavaScript / React)

### 7.1 Recherche avec debounce (fetch)

```javascript
const API_BASE = 'http://localhost:8000/api/backend';

async function searchAddress(token, query, options = {}) {
  if (!query || query.trim().length < 3) return { items: [] };
  const params = new URLSearchParams({
    q: query.trim(),
    limit: options.limit ?? 8,
    lang: options.lang ?? 'fr',
  });
  if (options.country !== undefined) params.set('country', options.country);

  const res = await fetch(`${API_BASE}/geo/search?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// Exemple : remplir le formulaire partenaire à partir d’un item
function fillPartnerAddressFromGeoItem(partnerForm, item) {
  partnerForm.address_line1 = item.street ?? item.label ?? '';
  partnerForm.city         = item.city ?? '';
  partnerForm.region       = item.region ?? '';
  partnerForm.country      = item.country === 'Maroc' ? 'MA' : (item.country ?? 'MA');
  partnerForm.postal_code  = item.postcode ?? '';
  partnerForm.geo_lat      = item.lat ?? null;
  partnerForm.geo_lng      = item.lng ?? null;
}
```

### 7.2 Reverse geocoding (fetch)

```javascript
async function reverseGeocode(token, lat, lng, lang = 'fr') {
  const params = new URLSearchParams({ lat, lng, lang });
  const res = await fetch(`${API_BASE}/geo/reverse?${params}`, {
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
    },
  });
  if (!res.ok) throw new Error(await res.text());
  const data = await res.json();
  return data.result; // null si rien trouvé
}
```

### 7.3 React : typeahead + remplissage partenaire

```jsx
// Résumé d’idée (à adapter à votre state / formulaire)
const [query, setQuery] = useState('');
const [suggestions, setSuggestions] = useState([]);
const [partner, setPartner] = useState({});

useEffect(() => {
  if (query.length < 3) {
    setSuggestions([]);
    return;
  }
  const t = setTimeout(async () => {
    try {
      const data = await searchAddress(authToken, query);
      setSuggestions(data.items ?? []);
    } catch (e) {
      setSuggestions([]);
    }
  }, 300);
  return () => clearTimeout(t);
}, [query]);

function onSelectSuggestion(item) {
  setPartner(prev => ({
    ...prev,
    address_line1: item.street ?? item.label ?? '',
    city: item.city ?? '',
    region: item.region ?? '',
    country: item.country === 'Maroc' ? 'MA' : (item.country ?? 'MA'),
    postal_code: item.postcode ?? '',
    geo_lat: item.lat ?? null,
    geo_lng: item.lng ?? null,
  }));
  setSuggestions([]);
  setQuery(item.label);
}
```

---

## 8. Erreurs et limites

- **401** : token manquant ou invalide → rediriger vers la connexion.
- **422** : paramètres invalides (ex. `q` trop court) → corps JSON avec clés `message` / `errors`.
- **502** : fournisseur Geo indisponible ou timeout → afficher un message générique et réessayer plus tard.

Limites techniques (configurables côté backend) :
- Recherche : minimum **3 caractères** pour `q`.
- **Throttling** : 60 requêtes / minute par utilisateur (réponse 429 si dépassement).

---

## 9. Récap : flux recommandé « Créer partenaire »

1. **Charger les listes** : `GET /api/backend/masterdata/for-partner-form` (grilles tarifaires, conditions de paiement, zones géo, etc.).
2. **Champ adresse** : typeahead avec `GET /api/backend/geo/search?q=...` (debounce 300 ms, min 3 caractères).
3. **Au choix d’une suggestion** : remplir `address_line1`, `city`, `region`, `country` (MA), `postal_code`, `geo_lat`, `geo_lng` selon le mapping § 5.1.
4. **Optionnel** : bouton « Ma position » → `navigator.geolocation` → `GET /api/backend/geo/reverse?lat=...&lng=...` → remplir les mêmes champs.
5. **Envoi** : `POST /api/backend/partners` avec le payload décrit dans [FICHE_CLIENT_PARTNER_API.md](./FICHE_CLIENT_PARTNER_API.md).

Pour les champs d’adresse et GPS, ce document et la Fiche Client couvrent tout ce dont le frontend a besoin.
