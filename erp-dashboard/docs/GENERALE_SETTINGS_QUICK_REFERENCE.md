# General Settings API - Quick Reference Guide

## 🚀 Quick Start

### Frontend Integration (3 Steps)

1. **Load Public Settings on App Init**
```javascript
fetch('/backend/settings/public')
  .then(res => res.json())
  .then(data => {
    // Apply theme
    document.documentElement.style.setProperty('--primary', data.data.primary_color);
    document.documentElement.style.setProperty('--secondary', data.data.secondary_color);
    
    // Set direction
    document.dir = data.data.direction;
    
    // Set branding
    document.title = data.data.title;
    document.querySelector('link[rel="icon"]').href = data.data.favicon;
  });
```

2. **Authenticated Requests**
```javascript
const headers = {
  'Authorization': `Bearer ${token}`,
  'Accept': 'application/json',
  'Content-Type': 'application/json'
};
```

3. **Handle Responses**
```javascript
if (response.success) {
  // Success
  toast.success(response.message);
} else {
  // Error
  toast.error(response.message);
  console.error(response.errors); // Validation errors
}
```

---

## 📋 All Endpoints Summary

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/backend/settings/public` | GET | ❌ | Public settings |
| `/backend/generale-setting` | GET | ✅ | All settings |
| `/backend/generale-setting` | POST | ✅ | Update settings |
| `/backend/generale-setting/theme` | GET | ✅ | Theme only |
| `/backend/generale-setting/theme` | POST | ✅ | Update theme |
| `/backend/generale-setting/business` | GET | ✅ | Business config |
| `/backend/generale-setting/business` | POST | ✅ | Update business |
| `/backend/generale-setting/withdraw` | GET | ✅ | Withdraw config |
| `/backend/generale-setting/withdraw` | POST | ✅ | Update withdraw |
| `/backend/ai-prompts` | GET | ✅ | AI prompts |
| `/backend/ai-prompts/update` | POST | ✅ | Update prompts |
| `/backend/ai-prompts/configure` | GET | ✅ | AI config status |
| `/backend/ai-prompts/configure` | POST | ✅ | Update AI config |

---

## 🎨 Theme Settings

### Get Theme
```bash
GET /backend/generale-setting/theme
```

**Response:**
```json
{
  "success": true,
  "data": {
    "primary_color": "#8b5cf6",
    "secondary_color": "#ede9fe",
    "direction": "ltr"
  }
}
```

### Update Theme
```bash
POST /backend/generale-setting/theme
Content-Type: application/json

{
  "primary_color": "#10b981",
  "secondary_color": "#d1fae5"
}
```

**Validation:**
- Colors must be hex format: `#RGB` or `#RRGGBB`
- Both fields required

---

## 💼 Business Settings

### Get Business Config
```bash
GET /backend/generale-setting/business
```

**Response:**
```json
{
  "success": true,
  "data": {
    "business_based_on": "commission",
    "commission": 10,
    "commission_type": "percentage",
    "commission_charge": "per_order",
    "shop_type": "multi",
    "new_product_approval": true,
    "update_product_approval": true
  }
}
```

### Update Business Config
```bash
POST /backend/generale-setting/business
Content-Type: application/json

{
  "commission": 15,
  "commission_type": "percentage",
  "shop_type": "multi"
}
```

**Validation:**
- `commission`: 0-100
- `commission_type`: percentage | fixed
- `commission_charge`: per_order | per_product
- `shop_type`: multi | single

---

## 💰 Withdraw Settings

### Get Withdraw Config
```bash
GET /backend/generale-setting/withdraw
```

### Update Withdraw Config
```bash
POST /backend/generale-setting/withdraw
Content-Type: application/json

{
  "min_withdraw": 50,
  "max_withdraw": 5000,
  "withdraw_request": 7
}
```

**Validation:**
- `min_withdraw`: >= 0
- `max_withdraw`: >= min_withdraw
- `withdraw_request`: >= 1

---

## 🤖 AI Settings

### Get AI Prompts
```bash
GET /backend/ai-prompts
```

### Update AI Prompts
```bash
POST /backend/ai-prompts/update
Content-Type: application/json

{
  "product_description": "Generate compelling product...",
  "page_description": "Create engaging page...",
  "blog_description": "Write informative blog..."
}
```

**Validation:**
- All fields required
- Max 550 characters each

### Configure OpenAI
```bash
POST /backend/ai-prompts/configure
Content-Type: application/json

{
  "api_key": "sk-proj-...",
  "organization": "org-..."
}
```

---

## 📤 File Uploads

### Update with Files
```bash
POST /backend/generale-setting
Content-Type: multipart/form-data

FormData:
- name: "My ERP"
- email: "contact@erp.com"
- logo: [file]
- favicon: [file]
- app_logo: [file]
- footer_logo: [file]
- footer_qrcode: [file]
```

**File Requirements:**
- **Logo/App Logo/Footer Logo**: png, jpg, jpeg, svg (max 2MB)
- **Favicon**: png, jpg, jpeg, svg, webp (max 2MB)
- **QR Code**: png, jpg, jpeg, gif (max 2MB)

---

## ⚠️ Error Handling

### Success Response
```json
{
  "success": true,
  "message": "Settings updated successfully",
  "data": { ... }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed",
  "errors": {
    "primary_color": ["Invalid hex color format"],
    "commission": ["Must be between 0 and 100"]
  }
}
```

### HTTP Status Codes
- `200` - Success
- `404` - Settings not found
- `422` - Validation failed
- `500` - Server error

---

## 🔐 Authentication

### Get Token
```bash
POST /backend/login
Content-Type: application/json

{
  "email": "admin@erp.com",
  "password": "password"
}
```

### Use Token
```javascript
headers: {
  'Authorization': 'Bearer YOUR_TOKEN_HERE',
  'Accept': 'application/json'
}
```

---

## 💾 Caching

### Cached Endpoints
- `/backend/settings/public` - 1 hour
- `/backend/generale-setting/theme` - 1 hour

### Cache Auto-Clear
Cache automatically clears when settings are updated.

### Manual Cache Clear
```bash
php artisan cache:clear
```

---

## 🧪 Testing

### Test Public Endpoint
```bash
curl http://localhost/backend/settings/public
```

### Test Authenticated Endpoint
```bash
curl -H "Authorization: Bearer TOKEN" \
     -H "Accept: application/json" \
     http://localhost/backend/generale-setting
```

### Test Update
```bash
curl -X POST \
     -H "Authorization: Bearer TOKEN" \
     -H "Content-Type: application/json" \
     -H "Accept: application/json" \
     -d '{"primary_color":"#10b981","secondary_color":"#d1fae5"}' \
     http://localhost/backend/generale-setting/theme
```

---

## 🎯 Common Use Cases

### 1. Load App Settings on Startup
```javascript
async function initializeApp() {
  const settings = await fetch('/backend/settings/public').then(r => r.json());
  
  // Apply theme
  applyTheme(settings.data.primary_color, settings.data.secondary_color);
  
  // Set branding
  setBranding(settings.data.name, settings.data.logo, settings.data.favicon);
  
  // Set direction
  document.dir = settings.data.direction;
}
```

### 2. Admin Settings Page
```javascript
// Load current settings
const settings = await fetch('/backend/generale-setting', {
  headers: { 'Authorization': `Bearer ${token}` }
}).then(r => r.json());

// Display in form
form.name.value = settings.data.setting.name;
form.email.value = settings.data.setting.email;
// ...

// Update on submit
form.onsubmit = async (e) => {
  e.preventDefault();
  const formData = new FormData(form);
  
  const response = await fetch('/backend/generale-setting', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` },
    body: formData
  });
  
  const result = await response.json();
  if (result.success) {
    toast.success(result.message);
  }
};
```

### 3. Theme Customizer
```javascript
function ThemeCustomizer() {
  const [primary, setPrimary] = useState('#8b5cf6');
  const [secondary, setSecondary] = useState('#ede9fe');
  
  const updateTheme = async () => {
    const response = await fetch('/backend/generale-setting/theme', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        primary_color: primary,
        secondary_color: secondary
      })
    });
    
    const result = await response.json();
    if (result.success) {
      // Apply immediately
      document.documentElement.style.setProperty('--primary', primary);
      document.documentElement.style.setProperty('--secondary', secondary);
    }
  };
  
  return (
    <div>
      <input type="color" value={primary} onChange={e => setPrimary(e.target.value)} />
      <input type="color" value={secondary} onChange={e => setSecondary(e.target.value)} />
      <button onClick={updateTheme}>Save Theme</button>
    </div>
  );
}
```

### 4. Business Rules Display
```javascript
async function getBusinessRules() {
  const response = await fetch('/backend/generale-setting/business', {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  
  const { data } = await response.json();
  
  return {
    commission: `${data.commission}% ${data.commission_type}`,
    shopType: data.shop_type === 'multi' ? 'Multi-vendor' : 'Single vendor',
    approvals: {
      newProducts: data.new_product_approval,
      productUpdates: data.update_product_approval
    }
  };
}
```

---

## 🐛 Troubleshooting

### Issue: 401 Unauthorized
**Solution:** Check token is valid and included in Authorization header

### Issue: 422 Validation Error
**Solution:** Check request body matches validation rules

### Issue: 404 Not Found
**Solution:** Ensure settings record exists in database

### Issue: Images not loading
**Solution:** Run `php artisan storage:link`

### Issue: Cache not clearing
**Solution:** Check CACHE_DRIVER in .env, run `php artisan cache:clear`

---

## 📚 Related Documentation

- **Full API Docs:** `API_GENERALE_SETTINGS.md`
- **Configuration Guide:** `GENERALE_SETTINGS_CONFIG_VERIFICATION.md`
- **Postman Collection:** `GENERALE_SETTINGS_POSTMAN_COLLECTION.json`

---

## 🔗 Quick Links

- **Model:** `app/Models/GeneraleSetting.php`
- **Controller:** `app/Http/Controllers/Backend/GeneraleSettingController.php`
- **Repository:** `app/Repositories/GeneraleSettingRepository.php`
- **Routes:** `routes/backend.php`
- **Migrations:** `database/migrations/*generate_settings*`

---

**Version:** 1.0.0  
**Last Updated:** December 16, 2024
