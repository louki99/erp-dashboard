# [Backend → UI] Data Rules — Hydration & Sélecteurs

**Date :** 2026-07-07
**De :** Backend (Idris)
**Pour :** Équipe UI — Admin Panel
**Priorité :** 🔴 À intégrer dès que possible

---

## Contexte

On avait un problème UX critique sur l'écran de Gouvernance des Données : l'interface affichait des IDs bruts comme `scope_value = 8` ou `resource = 3`, ce qui est illisible pour un admin terrain.

**Maintenant c'est réglé côté backend.** Voici exactement ce que vous devez faire de votre côté.

---

## 1. Le GET `/api/backend/access-control/data-rules` retourne maintenant 3 champs en plus

Chaque règle dans la réponse contient désormais :

| Champ nouveau | Ce qu'il contient | Exemple |
|--------------|-------------------|---------|
| `scope_label` | Nom lisible du scope | `"Superviseur Ventes"` |
| `resource_label` | Nom lisible de la ressource | `"Jus & Boissons"` |
| `model_type_label` | Nom lisible du type de modèle | `"Page Produit"` |

### Avant (ce que vous receviez)
```json
{
  "id": 42,
  "model_type": "App\\Models\\ProductPage",
  "model_id": 3,
  "scope_type": "profile",
  "scope_value": "8",
  "action": "deny"
}
```

### Maintenant (ce que vous recevez)
```json
{
  "id": 42,
  "model_type": "App\\Models\\ProductPage",
  "model_id": 3,
  "scope_type": "profile",
  "scope_value": "8",
  "action": "deny",

  "model_type_label": "Page Produit",
  "resource_label": "Jus & Boissons",
  "scope_label": "Superviseur Ventes"
}
```

**Ce que vous devez faire dans vos colonnes de table :**

```tsx
// Colonne RESSOURCE
<td>{rule.resource_label}</td>   // affiche "Jus & Boissons" au lieu de "3"

// Colonne SCOPE / VALEUR
<td>{rule.scope_label}</td>      // affiche "Superviseur Ventes" au lieu de "8"

// Colonne TYPE DE MODÈLE
<td>{rule.model_type_label}</td> // affiche "Page Produit" au lieu de "App\Models\ProductPage"
```

> Les anciens champs bruts (`model_id`, `scope_value`, `model_type`) restent présents dans la réponse — ne les supprimez pas, vous en aurez besoin pour les appels POST/PUT.

---

## 2. Nouveau endpoint — Sélecteur de Scope

**Pour les filtres et la modale de création**, plus besoin de laisser l'admin saisir un ID à la main. Utilisez ce endpoint pour alimenter vos `<Select>` :

```
GET /api/backend/access-control/data-rules/scopes?type={scope_type}
```

**Types supportés :** `profile` · `role` · `user` · `branch` · `partner`

### Exemple — charger les profils
```
GET /api/backend/access-control/data-rules/scopes?type=profile
```
```json
{
  "type": "profile",
  "data": [
    { "value": "1", "label": "Agent Commercial" },
    { "value": "8", "label": "Superviseur Ventes" },
    { "value": "12", "label": "Télévendeur" }
  ]
}
```

### Exemple — charger les rôles
```
GET /api/backend/access-control/data-rules/scopes?type=role
```
```json
{
  "type": "role",
  "data": [
    { "value": "sfa_van_sales", "label": "sfa_van_sales" },
    { "value": "sfa_preseller", "label": "sfa_preseller" },
    { "value": "adv",           "label": "adv" }
  ]
}
```

> ⚠️ Pour les rôles, `value` et `label` sont identiques : c'est le nom Spatie (string), pas l'ID numérique.

### Comment utiliser dans votre formulaire

```tsx
// Quand l'admin choisit scope_type, rechargez les options
const { data: scopeOptions } = useQuery({
  queryKey: ['data-rules-scopes', selectedScopeType],
  queryFn: () =>
    axios.get('/api/backend/access-control/data-rules/scopes', {
      params: { type: selectedScopeType },
    }).then(r => r.data.data),
  enabled: !!selectedScopeType,
});

// Dans votre Select
<Select
  options={scopeOptions?.map(o => ({ value: o.value, label: o.label }))}
  onChange={(val) => setFieldValue('scope_value', val)}
/>
```

Quand vous soumettez la règle en POST, envoyez `scope_value: option.value` (c'est la valeur brute, pas le label).

---

## 3. Nouveau endpoint — Sélecteur de Ressource

**Pour le champ "ID Ressource"** dans la modale de création, utilisez ce endpoint à la place d'un input texte :

```
GET /api/backend/access-control/data-rules/resources?model_type={class}
```

**Model types supportés :**

| Valeur à passer | Label affiché |
|----------------|---------------|
| `App\Models\ProductPage` | Page Produit |
| `App\Models\PaymentTerm` | Mode de Règlement |
| `App\Models\PaymentMethod` | Moyen de Paiement |
| `App\Models\Category` | Catégorie |
| `App\Models\Product` | Produit |

### Exemple — pages produit
```
GET /api/backend/access-control/data-rules/resources?model_type=App\Models\ProductPage
```
```json
{
  "model_type": "App\\Models\\ProductPage",
  "model_type_label": "Page Produit",
  "data": [
    { "id": 1, "label": "Eaux & Boissons",  "code": "EAU",  "parent_id": null },
    { "id": 3, "label": "Jus & Nectars",    "code": "JUS",  "parent_id": 1    },
    { "id": 7, "label": "Sodas & Gazeux",   "code": "SOD",  "parent_id": 1    }
  ]
}
```

### Exemple — modes de règlement
```
GET /api/backend/access-control/data-rules/resources?model_type=App\Models\PaymentTerm
```
```json
{
  "model_type": "App\\Models\\PaymentTerm",
  "model_type_label": "Mode de Règlement",
  "data": [
    { "id": 2, "label": "Comptant",  "code": "ESP",   "is_credit": false, "is_cash": true  },
    { "id": 5, "label": "Net 30",    "code": "NET30", "is_credit": true,  "is_cash": false },
    { "id": 8, "label": "Chèque",    "code": "CHQ",   "is_credit": false, "is_cash": false }
  ]
}
```

### Comment utiliser dans votre formulaire

```tsx
// Quand l'admin choisit model_type, rechargez les ressources disponibles
const { data: resources } = useQuery({
  queryKey: ['data-rules-resources', selectedModelType],
  queryFn: () =>
    axios.get('/api/backend/access-control/data-rules/resources', {
      params: { model_type: selectedModelType },
    }).then(r => r.data.data),
  enabled: !!selectedModelType,
});

// Dans votre Select "ID Ressource"
<Select
  placeholder="Toutes les ressources (wildcard)"
  isClearable                              // null = wildcard (model_id=null dans la règle)
  options={resources?.map(r => ({ value: r.id, label: r.label }))}
  onChange={(opt) => setFieldValue('model_id', opt?.value ?? null)}
/>
```

> Si l'admin ne sélectionne rien (null) = règle wildcard qui s'applique à **toutes** les ressources du type choisi. C'est voulu, mais ça déclenche une confirmation côté backend (`confirm_wildcard_deny`) si `action = deny`.

---

## 4. Comportement de la pagination (structure inchangée mais clarifiée)

La réponse de `GET /api/backend/access-control/data-rules` suit maintenant cette structure :

```json
{
  "data": [ /* règles hydratées */ ],
  "meta": {
    "current_page": 1,
    "last_page": 4,
    "per_page": 50,
    "total": 187
  },
  "links": {
    "first": "...?page=1",
    "last": "...?page=4",
    "prev": null,
    "next": "...?page=2"
  }
}
```

> Si vous utilisiez `response.data` pour accéder directement au tableau paginator Laravel (`data`, `links`, `meta`), rien ne change — la structure est identique.

---

## 5. Résumé de ce que vous devez mettre à jour dans l'UI

| Où | Avant | Après |
|----|-------|-------|
| Colonne "Ressource" de la table | `rule.model_id` | `rule.resource_label` |
| Colonne "Scope Valeur" de la table | `rule.scope_value` | `rule.scope_label` |
| Colonne "Type" de la table | `rule.model_type` (class PHP) | `rule.model_type_label` |
| Champ "Scope Valeur" dans la modale | `<Input type="text">` | `<Select>` alimenté par `/scopes?type=...` |
| Champ "ID Ressource" dans la modale | `<Input type="number">` | `<Select>` alimenté par `/resources?model_type=...` |
| Filtre "Scope" dans la barre de recherche | Input texte libre | `<Select>` alimenté par `/scopes?type=...` |

---

## Questions ?

Ping sur Slack ou ouvrez un ticket si quelque chose ne colle pas dans les réponses JSON.

— Backend
