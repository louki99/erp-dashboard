# Theme Endpoint Migration — Action Required for UI Dashboard Team

**Date:** 2026-06-26
**Affects:** `GET /api/backend/generale-setting/theme` and `POST /api/backend/generale-setting/theme`

---

## What changed (backend)

The theme colours are no longer stored in the `generale_settings` table. They now live in the `configuration_settings` table, scoped per branch:

| Old field (generale_settings) | New key (configuration_settings) | Value type |
|---|---|---|
| `primary_color` | `branding.primary_color` | `string_value` |
| `secondary_color` | `branding.accent_color` | `string_value` |

The endpoint **URL and response shape are unchanged** — no breaking change for you.

---

## What the endpoint now returns

```json
GET /api/backend/generale-setting/theme

{
  "success": true,
  "data": {
    "primary_color":   "#1a56db",   // from branding.primary_color (branch config)
    "secondary_color": "#e8f0fe",   // from branding.accent_color  (branch config)
    "direction":       "ltr"        // still from generale_settings
  }
}
```

Colors are resolved in this priority order:
1. `configuration_settings` for the authenticated user's branch
2. `generale_settings` global record (legacy fallback)
3. Hard-coded defaults (`#1a56db` / `#e8f0fe`)

---

## What you need to do in the UI

### 1. Call the endpoint at app startup (or after login)

Fetch the theme as soon as the user is authenticated and their branch context is known:

```js
// Example (axios)
const { data } = await axios.get('/api/backend/generale-setting/theme');
applyTheme(data.data); // { primary_color, secondary_color, direction }
```

> The endpoint is authenticated (`auth:sanctum`). Make sure the Sanctum token is set in your request headers before calling it.

### 2. Apply colours as CSS custom properties

```js
function applyTheme({ primary_color, secondary_color, direction }) {
  const root = document.documentElement;
  root.style.setProperty('--color-primary',   primary_color);
  root.style.setProperty('--color-secondary', secondary_color);
  root.dir = direction; // 'ltr' | 'rtl'
}
```

Then reference `var(--color-primary)` / `var(--color-secondary)` in your Tailwind config or CSS instead of hard-coding hex values.

### 3. Each branch has its own colours

Because this endpoint reads from the authenticated user's `branch_id`, **two users from different branches will receive different colours**. Do not cache the response globally across sessions — cache it per authenticated user or re-fetch on login.

### 4. Updating colours (POST)

The POST body is unchanged:

```json
POST /api/backend/generale-setting/theme
{
  "primary_color":   "#1a56db",
  "secondary_color": "#e8f0fe"
}
```

This now writes to `configuration_settings` for the user's branch. The old `generale_settings` row is only updated as a fallback when the user has no branch.

---

## Example data (branch_id = 1)

From `configuration_settings` where `configurable_type = 'App\Models\Branch'` and `configurable_id = 1`:

| key | string_value |
|---|---|
| `branding.primary_color` | `#1a56db` |
| `branding.accent_color`  | `#e8f0fe` |

---

## Questions?

Contact the backend team or open an issue on the project board.
