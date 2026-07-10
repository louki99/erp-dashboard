# [Backend → UI] Module Logistique & Sectorisation — Nouveaux endpoints + Guide UI Pro

**Date :** 2026-07-09
**De :** Backend (Idris)
**Pour :** Équipe UI — Admin Panel
**Priorité :** 🔴 À intégrer / fusionner avec ce que vous avez déjà commencé

---

## 1. Ce qu'on a changé côté backend (résumé rapide)

Vous avez déjà commencé à builder les pages. Voici **ce qui a changé ou été ajouté** depuis votre dernière synchro — mettez à jour vos appels API en conséquence.

### Endpoints ajoutés (n'existaient pas avant)

| Méthode | URL | Ce que ça fait |
|---------|-----|----------------|
| `GET` | `/api/backend/geo-area-types` | CRUD types géo (Pays, Région, Secteur…) |
| `POST/PUT/DELETE` | `/api/backend/geo-area-types/{id}` | Gestion des niveaux hiérarchiques |
| `GET` | `/api/backend/geo-areas/{id}` | **Détail d'une zone** — manquait, retournait 404 avant |
| `GET` | `/api/backend/geo-areas/statistics` | Compteurs globaux pour le dashboard |
| `GET/POST/DELETE` | `/api/backend/geo-areas/{id}/users` | Affectation superviseur ↔ zone |
| `GET` | `/api/backend/itinerary-business-natures` | Playbooks de visite (liste + détail) |
| `POST/PUT/DELETE` | `/api/backend/itinerary-business-natures/{id}` | CRUD complet |
| `POST` | `/api/backend/itineraries/{id}/sync-localites` | Lier des localités (type 600) à une tournée |
| `POST` | `/api/backend/itineraries/{id}/sync-users` | Remplacer liste vendeurs (format riche) |
| `POST` | `/api/backend/itinerary-planning-daily/upsert-for-date` | Override journalier (calendrier drag-drop) |
| `GET/POST/PUT/DELETE` | `/api/backend/itinerary-planning-daily` | CRUD overrides journaliers |

### Endpoints corrigés (bug ou champ manquant)

| URL | Ce qui a changé |
|-----|-----------------|
| `GET /api/backend/itineraries` | Nouveaux filtres : `itinerary_type_id`, `is_active`, `per_page` |
| `POST /api/backend/itineraries/{id}/sync-partners` | Champs ajoutés : `extra`, `last_visit_date`, `next_visit_date`, `is_active` |
| `POST /api/backend/itineraries/{id}/assign-user` | Pivot complet : `starts_at`, `expires_at`, `is_temporary` |
| `POST /api/backend/itineraries/{id}/sync-users` | Nouveau format riche `users:[{user_id, starts_at, expires_at, is_temporary}]` |

### Référence complète
📄 **[docs/api/ROUTING_INTEGRATION.md](../api/ROUTING_INTEGRATION.md)** — Tous les endpoints, schémas JSON, types TypeScript, hooks React Query.

---

## 2. Pages à construire / compléter

### Ce que vous avez probablement déjà
- Liste des tournées ✅
- Détail tournée / partenaires ✅

### Ce qui reste à builder ou mettre à jour

| Page | Status suggéré | Endpoints clés |
|------|---------------|----------------|
| **Arborescence Sectorielle** | 🔴 À builder | `GET /geo-areas/hierarchy` + `/children` |
| **CRUD Types Géo** | 🔴 À builder | `GET/POST/PUT/DELETE /geo-area-types` |
| **Affectation superviseur ↔ zone** | 🔴 À builder | `GET /geo-areas/{id}/users` + `/assign-user` |
| **Gestion Types Tournée** | 🟡 Vérifier si vous l'avez | `GET/POST/PUT/DELETE /itinerary-types` |
| **Business Natures** | 🔴 À builder | `GET/POST/PUT/DELETE /itinerary-business-natures` |
| **Localités d'une tournée** | 🔴 À ajouter dans le détail tournée | `POST /itineraries/{id}/sync-localites` |
| **Affectation vendeurs** | 🟡 Mettre à jour (nouveaux champs pivot) | `POST /itineraries/{id}/sync-users` |
| **Calendrier planning hebdo** | 🟡 Vérifier assign-days | `POST /itinerary-planning/assign-days` |
| **Override journalier** | 🔴 À builder | `POST /itinerary-planning-daily/upsert-for-date` |

---

## 3. Comment builder un Découpage Sectoriel professionnel

C'est la partie la plus complexe visuellement. Voici comment la structurer pour que l'admin ait une vraie expérience de travail, pas juste un tableau.

---

### 3.1 — Structure recommandée de la page

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Découpage Sectoriel                              [+ Nouvelle Zone] [⚙️]  │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌─────────────────────┐   ┌──────────────────────────────────────────┐ │
│  │  🌍 Maroc            │   │  Détail — Hay Hassani (Secteur)          │ │
│  │   ├─ 📍 Casa-Settat  │   │                                          │ │
│  │   │   ├─ 📍 Casablanca│   │  Code :      HAY-HAS                    │ │
│  │   │   │   ├─ 🏙️ HAY-HAS │  Type :      Secteur (rank 500)          │ │
│  │   │   │   │   ├─ 🔵 SID-EST  │  Parent :   Casa Centre (Ville)     │ │
│  │   │   │   │   └─ 🔵 SID-OUE  │  Coords :   33.573° N, -7.689° W   │ │
│  │   │   │   └─ 🏙️ AIN-DIAB    │  Statut :   ✅ Actif                │ │
│  │   │   └─ 📍 Rabat     │   │                                          │ │
│  │   └─ 📍 Fès-Meknès   │   │  👥 Superviseurs (2)                    │ │
│  └─────────────────────┘   │  • Rachid El M.  [Retirer]               │ │
│                              │  • Sofia Benali  [Retirer]               │ │
│  [Type: Tous ▼] [Actifs ▼]  │                               [+ Affecter]│ │
│  [🔍 Rechercher...]         │                                          │ │
│                              │  🗺️ Tournées rattachées (3)              │ │
│                              │  • TRN-CAS-001  Van Sales  [Voir]       │ │
│                              │  • TRN-CAS-002  Order Taker [Voir]      │ │
│                              │                                          │ │
│                              │         [✏️ Modifier]  [🗑️ Supprimer]    │ │
│                              └──────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────┘
```

**Layout :** Split 30/70 — TreeView à gauche, panneau détail à droite.

---

### 3.2 — Le TreeView (panneau gauche)

**Recommandation librairie :** `react-arborist` (la meilleure pour du tree editable en React) ou `@tanstack/react-virtual` + tree custom si vous voulez du contrôle total.

**Icônes par niveau (rank) :**

```tsx
const GEO_TYPE_ICONS: Record<number, string> = {
  100: '🌍',  // Pays
  200: '📍',  // Région
  300: '📍',  // Province
  400: '🏙️', // Ville
  500: '🏘️', // Secteur
  600: '🔵', // Localité
};
```

**Stratégie de chargement — lazy (recommandé pour prod) :**

```tsx
// Au montage : charger uniquement les racines (Pays)
const { data: roots } = useQuery({
  queryKey: ['geo-areas', { parent_code: null }],
  queryFn: () => axios.get('/api/backend/geo-areas/hierarchy').then(r => r.data),
});

// Quand l'admin ouvre un nœud : charger ses enfants
const { data: children } = useQuery({
  queryKey: ['geo-areas', 'children', node.code],
  queryFn: () => axios.get(`/api/backend/geo-areas/${node.code}/children`).then(r => r.data),
  enabled: isExpanded && !node.childrenLoaded,
});
```

**Lazy vs eager :**
- Si < 500 zones → charger `GET /geo-areas/hierarchy` une seule fois (eager)
- Si > 500 zones → lazy loading par `/children` à chaque expand

---

### 3.3 — Filtres du TreeView

Barre de filtre au-dessus de l'arbre :

```tsx
// Filtre par type (Pays / Région / Ville / Secteur / Localité)
<Select
  placeholder="Tous les types"
  options={geoAreaTypes.map(t => ({ value: t.id, label: t.name }))}
  onChange={setTypeFilter}
  isClearable
/>

// Toggle actifs / tous
<Switch
  label="Actifs seulement"
  checked={activeOnly}
  onChange={setActiveOnly}
/>

// Recherche texte (côté backend via ?search=)
<Input
  placeholder="Rechercher une zone..."
  onChange={debounce(setSearch, 300)}
/>
```

Quand un filtre est actif → basculer du TreeView vers une **liste plate paginée** (le tree n'a plus de sens si on filtre par type).

---

### 3.4 — Panneau détail (panneau droit)

Quand l'admin clique sur une zone dans l'arbre :

```
Tabs : [Infos générales] [Superviseurs] [Tournées liées] [Localités enfants]
```

**Tab "Infos générales"** → Formulaire inline éditable :
- `code`, `name`, `name_ar`, `geo_area_type_id`, `parent_code`, `latitude`, `longitude`, `description`, `is_active`
- Bouton **Enregistrer** → `PUT /geo-areas/{id}`
- Badge de statut avec toggle rapide → `GET /geo-areas/{id}/toggle`

**Tab "Superviseurs"** → liste des users assignés + combobox pour en ajouter :

```tsx
const { data: assigned } = useGeoAreaUsers(selectedZone.id);
const assign   = useAssignGeoAreaUser(selectedZone.id);
const unassign = useRemoveGeoAreaUser(selectedZone.id);

// Combobox asynchrone (recherche les users backend)
<AsyncSelect
  loadOptions={(search) =>
    axios.get('/api/backend/users', { params: { search, per_page: 20 } })
      .then(r => r.data.data.map(u => ({ value: u.id, label: `${u.name} (${u.email})` })))
  }
  onChange={(opt) => assign.mutateAsync(opt.value)}
  placeholder="Affecter un superviseur..."
/>

{assigned?.users.map(u => (
  <div key={u.id} className="flex items-center justify-between py-2">
    <span>{u.name} — {u.email}</span>
    <Button variant="ghost" size="sm" onClick={() => unassign.mutateAsync(u.id)}>
      Retirer
    </Button>
  </div>
))}
```

**Tab "Tournées liées"** → Lecture seule, liste des tournées qui couvrent ce secteur.

**Tab "Localités enfants"** → Visible uniquement si `geo_area_type.rank <= 500`. Liste des zones enfants directes avec leurs compteurs de tournées.

---

### 3.5 — Modale de création / modification d'une zone

```tsx
<Modal title={editing ? "Modifier la zone" : "Nouvelle zone"}>
  <form>
    {/* Champ type — chargé depuis /geo-area-types */}
    <Select label="Type de zone *" name="geo_area_type_id"
      options={geoAreaTypes.map(t => ({ value: t.id, label: `${t.name} (rank ${t.rank})` }))}
    />

    {/* Parent — chargé dynamiquement selon le type choisi */}
    {/* Si type = Secteur (500), seules les Villes (400) sont des parents valides */}
    <AsyncSelect
      label="Zone parente"
      loadOptions={(search) =>
        axios.get('/api/backend/geo-areas', {
          params: { search, type_id: parentTypeId, is_active: true }
        }).then(r => r.data.geoAreas.data.map(a => ({ value: a.code, label: a.name })))
      }
      isClearable
    />

    <Input label="Code *" name="code" placeholder="HAY-HAS" />
    <Input label="Nom *"  name="name" placeholder="Hay Hassani" />
    <Input label="Nom AR" name="name_ar" dir="rtl" />

    {/* Coordonnées — optionnel, avec carte cliquable si vous avez Leaflet */}
    <div className="grid grid-cols-2 gap-4">
      <Input label="Latitude"  name="latitude"  type="number" step="0.000001" />
      <Input label="Longitude" name="longitude" type="number" step="0.000001" />
    </div>

    <Switch label="Zone active" name="is_active" defaultChecked />
  </form>
</Modal>
```

**Règle UX importante :** quand `geo_area_type` = Secteur (rank 500), rendre le champ `parent_code` **obligatoire** et filtrer les options pour n'afficher que les Villes (rank 400). Le backend rejettera de toute façon avec 422, mais UX > backend.

---

### 3.6 — Drag & Drop pour réordonner

Si vous voulez permettre le réordonnancement des zones au sein d'un même niveau (pour le champ `sort_order`) :

```tsx
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// Dans le TreeView, activer le drag uniquement sur les nœuds du même parent
const handleDragEnd = async ({ active, over }) => {
  if (!over || active.id === over.id) return;

  // Recalculer les sort_order localement
  const reordered = arrayMove(siblings, oldIndex, newIndex);

  // Envoyer chaque PUT en batch (ou implémenter un endpoint bulk-sort côté backend)
  await Promise.all(
    reordered.map((zone, idx) =>
      axios.put(`/api/backend/geo-areas/${zone.id}`, { sort_order: idx })
    )
  );
};
```

---

### 3.7 — Dashboard statistiques (optionnel mais recommandé)

En haut de la page, avant l'arbre :

```
┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐
│  248     │  │  231     │  │  87      │  │  198     │
│ Zones    │  │ Actives  │  │ Secteurs │  │ Géolocal │
└──────────┘  └──────────┘  └──────────┘  └──────────┘
```

Alimenté par `GET /api/backend/geo-areas/statistics`.

---

## 4. Pages Business Natures & Planning Daily

### Business Natures — Page simple (liste + modale)

Ces données sont **quasi-statiques** (2 playbooks en prod). L'UI ne doit pas permettre à n'importe quel admin de modifier `action_rules` — c'est du JSON métier complexe.

**Recommandation UX :**
- Liste simple avec `code`, `label`, nombre de types liés
- Vue détail en **lecture seule** pour `action_rules` (afficher les actions comme des badges)
- Modification : réserver à un rôle `super_admin` avec un champ JSON brut en textarea (avec validation syntaxique)

```tsx
// Affichage des actions en badges lisibles
{nature.action_rules?.actions.map(action => (
  <div key={action.visit_action_code} className="flex items-center gap-2 p-2 border rounded">
    <Badge>{action.visit_action_code}</Badge>
    {action.required && <span className="text-xs text-red-500">Obligatoire</span>}
    <span className="text-xs text-gray-500">
      Déclencheur: {action.gates_any[0]?.[0] ?? 'always'}
    </span>
  </div>
))}
```

---

### Planning Daily — Vue calendrier

Pour `itinerary_planning_daily`, l'écran idéal est un **calendrier mensuel par vendeur** :

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Planning Omar El Alaoui — Juillet 2026     [< Mois préc.] [Mois suiv. >]│
├────────┬────────┬────────┬────────┬────────┬────────┬────────┤
│  LUN   │  MAR   │  MER   │  JEU   │  VEN   │  SAM   │  DIM   │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│        │ 🔵 Ép. │        │ 🔵 Ép. │        │        │        │  ← Planning hebdo (fond bleu clair)
│        │  Casa  │        │  Casa  │        │        │        │
├────────┼────────┼────────┼────────┼────────┼────────┼────────┤
│        │ 🟡 Sup!│        │        │        │        │        │  ← Override REPLACE (fond orange)
│        │Tournée │        │        │        │        │        │
│        │Extra   │        │        │        │        │        │
├────────┴────────┴────────┴────────┴────────┴────────┴────────┤
│  🔵 Planning hebdo normal    🟡 Override REPLACE    🟢 Override APPEND   │
└──────────────────────────────────────────────────────────────────────────┘
```

**Logique d'affichage :**

```tsx
// Pour chaque jour :
// 1. Charger le planning hebdo (itinerary_planning)
// 2. Charger les overrides de la semaine (itinerary_planning_daily)
// 3. Si override REPLACE → remplacer la case, fond orange
// 4. Si override APPEND → ajouter sous la case hebdo, fond vert
// 5. Click sur une case → modale pour créer/modifier l'override

const handleDayClick = (date: string) => {
  // Ouvrir modale : choisir tournée(s) + strategy_mode
  openOverrideModal({ userId: selectedUser.id, workDate: date });
};

const handleSaveOverride = async (entries: UpsertForDateEntry[]) => {
  await upsertForDate.mutateAsync({
    user_id: selectedUser.id,
    work_date: selectedDate,
    entries,
  });
};
```

**Chargement :**

```tsx
// Planning hebdo du vendeur
const { data: weeklyPlanning } = useItineraryPlanning({ user_id: userId });

// Overrides du mois
const { data: dailyOverrides } = usePlanningDaily({
  user_id: userId,
  from: startOfMonth,
  to: endOfMonth,
});
```

---

## 5. Checklist de migration — ce que vous devez vérifier dans votre code existant

- [ ] `GET /geo-areas/{id}` — si vous faisiez un workaround (reload de la liste entière), remplacer par le vrai endpoint show
- [ ] Filtres itineraries — ajouter `itinerary_type_id` et `is_active` à vos composants de filtre existants
- [ ] `sync-partners` — ajouter les colonnes `extra`, `last_visit_date`, `next_visit_date`, `is_active` à votre formulaire d'édition partenaire
- [ ] `sync-users` — si vous utilisez le format `user_ids`, migrer vers le format riche `users:[{user_id, ...}]` pour exposer les dates de début/fin
- [ ] Vérifier que vos appels utilisent `/api/backend/` (pas `/api/v1/`) — la base URL backend est toujours `/api/backend`

---

## 6. Ordre de priorité recommandé

1. 🔴 **Découpage Sectoriel** (Arborescence + CRUD zones + affectation superviseurs) — bloque le terrain
2. 🔴 **Panel Tournées** (sync-partners avec nouveaux champs + sync-localites) — critique opérationnel
3. 🔴 **Planning vendeur** (hebdo + overrides calendrier) — planning terrain
4. 🟡 **Types de Tournée & Business Natures** — config, moins urgent
5. 🟢 **GeoAreaTypes CRUD** — très rare en prod, peut rester en v2

---

Questions ? Ping sur Slack ou ouvrez un ticket.

— Backend (Idris)

---

---

# [Backend → UI] Map — 3 Quick Fixes · 2026-07-09

**De :** Backend (Idris)
**Pour :** Équipe UI — Écran carte Sectorisation
**Contexte :** Suite à vos retours sur la map Sidi Bernoussi, voici les 3 ajustements que vous attendiez. Tout est pushé, dispo immédiatement.

---

## ✅ Fix 1 — `GET /geo-routing/bounds/{id}` — bbox maintenant fiable

**Ce qui bugait :** La bounding box PostGIS renvoyait `null` même quand le polygone existait à cause d'un bug PHP/PostgreSQL (les booléens PG retournent `"t"`/`"f"` comme strings, toutes les deux truthy en PHP — la détection `has_geometry` était donc cassée).

**Ce qui est fixé :**
- Détection `has_geometry` corrigée (retourne maintenant un entier propre `1`/`0`)
- `ST_Extent` utilisé à la place de `ST_Envelope` pour le calcul de la bbox (ST_Extent est l'agrégateur correct)

**Réponse garantie quand le polygone existe :**
```json
{
  "id": 42,
  "code": "HAY-HAS",
  "name": "Hay Hassani",
  "has_geometry": true,
  "center": { "lat": 33.5731, "lng": -7.5898 },
  "bbox": {
    "min_lat": 33.545,
    "min_lng": -7.632,
    "max_lat": 33.601,
    "max_lng": -7.547
  }
}
```

**Réponse si pas de polygone (fallback lat/lng du partenaire) :**
```json
{
  "has_geometry": false,
  "center": { "lat": 33.57, "lng": -7.60 },
  "bbox": null
}
```

**Usage Leaflet (fitBounds automatique) :**
```typescript
const { data } = await api.get(`/api/backend/geo-routing/bounds/${geoAreaId}`);

if (data.bbox) {
  map.fitBounds([
    [data.bbox.min_lat, data.bbox.min_lng],
    [data.bbox.max_lat, data.bbox.max_lng],
  ], { padding: [30, 30] });
} else if (data.center) {
  map.setView([data.center.lat, data.center.lng], 13);
}
```

---

## ✅ Fix 2 — Nouveau endpoint `PATCH /api/backend/partners/{code}/gps-location`

**Contexte :** Permet à l'admin de **dragguer un marker client sur la carte** et de sauvegarder sa nouvelle position GPS. L'URL utilise le `code` du partenaire (pas l'`id` numérique) pour que vous puissiez construire l'URL directement depuis le marker sans lookup supplémentaire.

**Route :**
```
PATCH /api/backend/partners/{code}/gps-location
```

**Payload :**
```json
{
  "latitude": 33.557,
  "longitude": -7.552
}
```

**Réponse 200 :**
```json
{
  "success": true,
  "message": "GPS location updated.",
  "partner_code": "CLI-0042",
  "geo_lat": 33.557,
  "geo_lng": -7.552,
  "geo_area_code": "HAY-HAS"
}
```

> **Bonus important :** Le trigger PostGIS `fn_assign_partner_geo_area` se déclenche automatiquement à chaque UPDATE des coordonnées. Si le nouveau point tombe dans un autre secteur, le `geo_area_code` est mis à jour automatiquement et renvoyé dans la réponse. Vous pouvez l'afficher dans le tooltip du marker sans faire de requête supplémentaire.

**Implémentation drag-and-drop Leaflet :**
```typescript
const marker = L.marker([partner.geo_lat, partner.geo_lng], { draggable: true });

marker.on('dragend', async (e) => {
  const { lat, lng } = e.target.getLatLng();

  const { data } = await api.patch(
    `/api/backend/partners/${partner.code}/gps-location`,
    { latitude: lat, longitude: lng }
  );

  // Mettre à jour le tooltip avec le nouveau secteur détecté par PostGIS
  marker.bindTooltip(`${partner.name} — ${data.geo_area_code ?? 'Zone inconnue'}`).openTooltip();
  toast.success('Position GPS sauvegardée.');
});
```

**Erreurs possibles :**
| Code | Cause |
|------|-------|
| `404` | `code` partenaire introuvable |
| `422` | `latitude` hors [-90, 90] ou `longitude` hors [-180, 180] |

---

## ✅ Confirmation — `parent_code` déjà dans `GET /geo-routing/map-layers`

**Bonne nouvelle :** le `parent_code` est déjà exposé dans les `properties` de chaque Feature. Rien à attendre côté backend.

**Structure de chaque Feature :**
```json
{
  "type": "Feature",
  "id": 42,
  "geometry": { "type": "Polygon", "coordinates": [[...]] },
  "properties": {
    "code": "HAY-HAS",
    "name": "Hay Hassani",
    "parent_code": "CASA-VILLE",
    "type_id": 5,
    "is_active": true,
    "sort_order": 3
  }
}
```

**Mapping de couleurs par ville-parent (comme vous l'avez demandé) :**
```typescript
// Générer une couleur stable par parent_code (hash → HSL)
function colorForParent(parentCode: string): string {
  let hash = 0;
  for (const c of parentCode) hash = c.charCodeAt(0) + ((hash << 5) - hash);
  return `hsl(${Math.abs(hash) % 360}, 60%, 45%)`;
}

L.geoJSON(featureCollection, {
  style: (feature) => ({
    color: colorForParent(feature!.properties.parent_code ?? 'ROOT'),
    fillOpacity: 0.15,
    weight: 2,
  }),
});
```

---

## Récap rapide

| # | Endpoint | Statut | Action UI |
|---|----------|--------|-----------|
| 1 | `GET /geo-routing/bounds/{id}` | ✅ Fixé | Brancher `fitBounds` sur click dans le TreeView |
| 2 | `PATCH /partners/{code}/gps-location` | ✅ Nouveau | Brancher sur `marker.on('dragend')` |
| 3 | `parent_code` dans `map-layers` | ✅ Déjà là | Utiliser pour le color-coding par ville |

Go pour vous ! 🗺️

— Backend (Idris)

---

---

# [Backend → UI] Planning — 3 endpoints demandés · 2026-07-09

**De :** Backend (Idris)
**Pour :** Équipe UI — Page Planning hebdomadaire
**Contexte :** Réponse directe à vos 3 demandes. Points 1 et 2 = nouveaux. Point 3 = déjà là depuis le début.

---

## ✅ Point 1 — `GET /api/backend/itinerary-planning/users` — Vendeurs assignables

**Filtre :** uniquement `b2b_role IN ('salesRep', 'livreur')` — les agents terrain. Dispatchers et magasiniers exclus.

```http
GET /api/backend/itinerary-planning/users
GET /api/backend/itinerary-planning/users?branch_code=CAS001
GET /api/backend/itinerary-planning/users?search=rachid
```

**Réponse 200 :**
```json
{
  "users": [
    {
      "id": 4,
      "name": "Rachid Alaoui",
      "email": "r.alaoui@company.ma",
      "branch_code": "CAS001",
      "geo_area_code": "HAY-HAS",
      "b2b_role": "salesRep"
    },
    {
      "id": 9,
      "name": "Omar Benali",
      "email": "o.benali@company.ma",
      "branch_code": "CAS001",
      "geo_area_code": null,
      "b2b_role": "livreur"
    }
  ]
}
```

**Trié par** `branch_code → name` — pratique pour un `<Select>` groupé par agence.

**Usage dans le select vendeur :**
```typescript
const { data } = useQuery({
  queryKey: ['itinerary-planning', 'users'],
  queryFn: () => axios.get('/api/backend/itinerary-planning/users').then(r => r.data.users),
  staleTime: 5 * 60 * 1000,
});

// Grouper par branch_code pour le select
const grouped = Object.groupBy(data ?? [], u => u.branch_code ?? 'Sans agence');
```

---

## ✅ Point 2 — `GET /api/backend/itinerary-planning/summary?user_id=X` — Vue consolidée

Retourne les 7 jours de la semaine avec les stats pré-calculées pour chaque tournée planifiée. Tous les jours sont toujours présents (même les jours de repos avec `itineraries: []`).

```http
GET /api/backend/itinerary-planning/summary?user_id=4
```

**Réponse 200 :**
```json
{
  "user_id": 4,
  "user": {
    "id": 4,
    "name": "Rachid Alaoui",
    "email": "r.alaoui@company.ma",
    "branch_code": "CAS001",
    "b2b_role": "salesRep"
  },
  "week": [
    {
      "day_code": 1,
      "label": "Lundi",
      "itineraries": [
        {
          "planning_id": 91,
          "id": 1,
          "code": "ITNA0001STD001",
          "name": "Sidi Bernoussi",
          "geo_area_code": "CASSECTSBR",
          "partners_count": 40,
          "estimated_km": 42.5
        }
      ],
      "total_partners": 40,
      "total_km": 42.5
    },
    {
      "day_code": 2,
      "label": "Mardi",
      "itineraries": [],
      "total_partners": 0,
      "total_km": 0.0
    }
  ]
}
```

**Champs utiles par itinéraire :**

| Champ | Source | Usage UI |
|-------|--------|----------|
| `planning_id` | `itinerary_planning.id` | Clé pour PUT /{id} (drag-and-drop inter-jours) |
| `partners_count` | count `itinerary_partners` actifs | Badge dans la grille |
| `estimated_km` | sum `itinerary_partners.mileage` | Info secondaire |
| `geo_area_code` | `itineraries.geo_area_code` | Lien vers la carte / couleur |

> **Note perf :** 1 seule requête SQL avec eager loading `itinerary.itineraryPartners`. Pas de N+1. Pas besoin de faire plusieurs appels depuis le front.

**Usage dans la grille hebdo :**
```typescript
const { data: summary } = useQuery({
  queryKey: ['itinerary-planning', 'summary', selectedUserId],
  queryFn: () => axios.get('/api/backend/itinerary-planning/summary', {
    params: { user_id: selectedUserId }
  }).then(r => r.data),
  enabled: !!selectedUserId,
});

// Affichage de la grille
{summary?.week.map(day => (
  <div key={day.day_code} className={day.itineraries.length === 0 ? 'opacity-40' : ''}>
    <h3>{day.label}</h3>
    {day.itineraries.map(itin => (
      <div key={itin.planning_id} className="bg-blue-50 rounded p-2">
        <span className="font-medium">{itin.name}</span>
        <span className="text-xs text-gray-500 ml-2">{itin.partners_count} clients · {itin.estimated_km} km</span>
      </div>
    ))}
    {day.itineraries.length === 0 && <span className="text-gray-400 text-sm">Repos</span>}
  </div>
))}
```

---

## ✅ Point 3 — `PUT /api/backend/itinerary-planning/{id}` — Déjà implémenté

Bonne nouvelle : cet endpoint **existait déjà** depuis le début. Vous pouvez l'utiliser immédiatement.

```http
PUT /api/backend/itinerary-planning/91
Content-Type: application/json

{ "day_code": 2 }
```

**Réponse 200 :**
```json
{
  "success": true,
  "message": "Planning updated successfully.",
  "planning": {
    "id": 91,
    "user_id": 4,
    "itinerary_id": 1,
    "day_code": 2,
    "is_active": true,
    "user": { "id": 4, "name": "Rachid Alaoui" },
    "itinerary": { "id": 1, "code": "ITNA0001STD001", "name": "Sidi Bernoussi" }
  }
}
```

**Gestion de conflit (422) :** si le vendeur a déjà une tournée assignée ce jour-là, le backend renvoie :
```json
{
  "success": false,
  "message": "This user already has a planning assignment for the selected day."
}
```

> Affichez ce message dans un toast — c'est le cas "drop sur un jour déjà occupé". Dans la grille UI, vous pouvez désactiver le drop zone visuellement si le jour a déjà un `itineraries.length > 0`.

**Drag-and-drop inter-jours :**
```typescript
const handleDayDrop = async (planningId: number, newDayCode: number) => {
  try {
    await axios.put(`/api/backend/itinerary-planning/${planningId}`, {
      day_code: newDayCode,
    });
    queryClient.invalidateQueries({ queryKey: ['itinerary-planning', 'summary', userId] });
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      toast.error(err.response.data.message);
    }
  }
};
```

---

## Récap des 3 endpoints

| # | Endpoint | Statut | Ce que vous pouvez builder |
|---|----------|--------|---------------------------|
| 1 | `GET /itinerary-planning/users` | ✅ Nouveau | Select vendeur filtré par rôle terrain + agence |
| 2 | `GET /itinerary-planning/summary?user_id=X` | ✅ Nouveau | Grille hebdo complète en 1 appel (stats incluses) |
| 3 | `PUT /itinerary-planning/{id}` | ✅ Déjà là | Drag-and-drop inter-jours avec gestion de conflit |

> **Astuce grille :** utilisez `summary` pour l'affichage et les `planning_id` retournés pour construire les URLs de drag-and-drop. Vous n'avez plus besoin de croiser deux sources de données.

— Backend (Idris)

---

# [UI → Backend] Business Natures + Planning — 3 questions · 2026-07-10

**De :** Équipe UI
**Pour :** Backend (Idris)
**Contexte :** On vient de builder la page **Business Natures** (`/routing/business-natures` — liste, détail playbook avec badges d'actions, édition JSON réservée admin) et la nouvelle page **Planning** (dialog d'affectation multi-jours + drag-and-drop inter-jours). Tout est branché sur vos endpoints, mais 3 points restent à confirmer car `docs/api/ROUTING_INTEGRATION.md` (référencé dans votre notice) n'est pas dans le repo UI.

---

## ❓ Question 1 — Schéma exact de `GET /api/backend/itinerary-business-natures`

On a implémenté en défensif (unwrap `{data: [...]}` ou tableau nu). Merci de confirmer le shape réel :

```json
// Ce qu'on suppose :
{
  "data": [
    {
      "id": 1,
      "code": "VAN_SALES",
      "label": "Vente directe",
      "description": "...",
      "action_rules": {
        "actions": [
          { "visit_action_code": "CHECKIN", "required": true, "gates_any": [["..."]] }
        ]
      },
      "is_active": true
    }
  ]
}
```

**Points à confirmer :**
- Le champ s'appelle bien `label` (pas `name`) ?
- `is_active` existe-t-il sur ce modèle ?
- Peut-on avoir `itinerary_types_count` dans la réponse liste (withCount) ? On l'affiche dans le détail — utile pour prévenir l'admin avant une suppression.

## ❓ Question 2 — Payload accepté par `POST/PUT /itinerary-business-natures`

On envoie `{ code, label, description, action_rules (objet JSON), is_active }`. Le backend valide-t-il la **structure** de `action_rules` (schéma des actions) ou seulement que c'est du JSON valide ? Si vous avez des règles de validation, donnez-les-nous pour qu'on valide côté UI avant l'envoi.

## ❓ Question 3 — Conflit sur `POST /itinerary-planning/assign-days`

Le `PUT /itinerary-planning/{id}` renvoie 422 si le vendeur a déjà une tournée ce jour-là. Mais le `summary` renvoie `itineraries: []` (tableau) par jour — donc plusieurs tournées par jour semblent possibles.

**Quelle est la règle exacte ?**
- `assign-days` renvoie-t-il aussi 422 si un des `day_codes` est déjà occupé par une **autre** tournée ?
- Ou bien plusieurs tournées le même jour sont autorisées, et le 422 du PUT ne concerne que le doublon exact (même tournée, même jour) ?

C'est important pour l'UX du drag-and-drop : on doit savoir s'il faut griser les jours déjà occupés ou non.

---

## ✅ Ce qui est déjà intégré côté UI (pour info)

| Feature | Endpoint utilisé |
|---------|------------------|
| Select vendeur (agents terrain groupés par agence) | `GET /itinerary-planning/users` |
| Grille hebdo + KPI (clients, km) | `GET /itinerary-planning/summary?user_id=X` |
| Drag-and-drop inter-jours + toast conflit 422 | `PUT /itinerary-planning/{id}` |
| Dialog "Affecter une tournée" (multi-jours, diff add/remove) | `POST /assign-days` + `DELETE /{id}` |
| Page Business Natures (liste + playbook badges + JSON admin) | `GET/POST/PUT/DELETE /itinerary-business-natures` |
| Select "Nature business" dans le form Types de tournée | `GET /itinerary-business-natures` |

— Équipe UI
