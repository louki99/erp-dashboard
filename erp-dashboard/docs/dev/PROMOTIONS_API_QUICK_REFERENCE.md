# Promotions API - Quick Reference Guide

## 📋 Base URL
```
http://localhost:8000/api
```

---

## 🔑 Authentication
All backend endpoints require Bearer token authentication:
```
Authorization: Bearer {your_token}
```

---

## 📚 API Endpoints Summary

### **Backend Management** (`/api/backend/promotions`)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 1 | GET | `/promotions` | List all promotions |
| 2 | GET | `/promotions/{id}` | Get promotion details |
| 3 | POST | `/promotions` | Create promotion |
| 4 | PUT | `/promotions/{id}` | Update promotion |
| 5 | DELETE | `/promotions/{id}` | Delete promotion |
| 6 | POST | `/promotions/{id}/clone` | Clone promotion |

### **Product Families** (`/api/backend/promotions/product-families`)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 10 | GET | `/product-families` | List product families |
| 11 | POST | `/product-families` | Create product family |
| 12 | GET | `/product-families/{id}` | Get family details |
| 13 | PUT | `/product-families/{id}` | Update family |
| 14 | DELETE | `/product-families/{id}` | Delete family |

### **Partner Families** (`/api/backend/promotions/partner-families`)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 15 | GET | `/partner-families` | List partner families |
| 16 | POST | `/partner-families` | Create partner family |
| 17 | GET | `/partner-families/{id}` | Get family details |
| 18 | PUT | `/partner-families/{id}` | Update family |
| 19 | DELETE | `/partner-families/{id}` | Delete family |

### **Boosts Management** (`/api/backend/promotions/boosts`)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 20 | GET | `/boosts` | List all boosts |
| 21 | POST | `/boosts` | Create boost |
| 22 | POST | `/boosts/bulk-sync` | Bulk sync boosts |
| 23 | GET | `/boosts/{id}` | Get boost details |
| 24 | PUT | `/boosts/{id}` | Update boost |
| 25 | DELETE | `/boosts/{id}` | Delete boost |

### **Calculation API** (`/api/promotions`)

| # | Method | Endpoint | Description |
|---|--------|----------|-------------|
| 7 | POST | `/calculate` | Calculate promotions for cart |
| 8 | GET | `/my-promotions` | Get partner's eligible promotions |
| 9 | POST | `/test` | Test promotion eligibility (dry run) |

---

## 🚀 Quick Start Examples

### **1. Create Promotion**
```bash
curl -X POST "http://localhost:8000/api/backend/promotions" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WINTER2024",
    "name": "Winter Sale",
    "start_date": "2024-01-01",
    "end_date": "2024-03-31",
    "breakpoint_type": 1,
    "lines": [{
      "name": "Main Discount",
      "details": [{
        "promo_type": 1,
        "minimum_value": 1000,
        "amount": 10
      }]
    }]
  }'
```

### **2. Calculate Promotions**
```bash
curl -X POST "http://localhost:8000/api/promotions/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "partner_code": "PARTNER001",
    "line_items": [
      {"product_code": "PROD001", "quantity": 10, "price": 150}
    ]
  }'
```

### **3. Create Product Family**
```bash
curl -X POST "http://localhost:8000/api/backend/promotions/product-families" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "ELECTRONICS",
    "name": "Electronics Products",
    "products": ["PROD001", "PROD002"]
  }'
```

### **4. Create Partner Family**
```bash
curl -X POST "http://localhost:8000/api/backend/promotions/partner-families" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "PREMIUM",
    "name": "Premium Customers",
    "partners": ["PARTNER001", "PARTNER002"]
  }'
```

### **5. Create Boost**
```bash
curl -X POST "http://localhost:8000/api/backend/promotions/boosts" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "product_family_code": "ELECTRONICS",
    "partner_family_code": "PREMIUM",
    "boost_percentage": 10
  }'
```

---

## 💡 Promotion Types

| Type | Name | Description | Amount Field |
|------|------|-------------|--------------|
| 1 | Percentage Discount | % off | Percentage (e.g., 10 = 10%) |
| 2 | Fixed Amount | Fixed MAD off | Amount in MAD |
| 3 | Best Price | Max price per unit | Best price per unit |
| 4 | Amount Per Unit | Discount per unit | Discount per unit |
| 5 | Free Promo Unit | Free different product | Number of free units |
| 6 | Flat Amount | Fixed total discount | Total discount amount |
| 7 | Replace Price | Special unit price | New price per unit |

---

## 📊 Breakpoint Types

| Type | Name | Description | minimum_value |
|------|------|-------------|---------------|
| 1 | Value-Based | Based on total MAD | Amount in MAD |
| 2 | Quantity-Based | Based on units | Number of units |
| 3 | Promo-Unit-Based | Based on promo units | Promo units |

---

## 🎯 Common Use Cases

### **Use Case 1: Simple Percentage Discount**
Buy 1000 MAD worth, get 10% off
```json
{
  "breakpoint_type": 1,
  "lines": [{
    "details": [{
      "promo_type": 1,
      "minimum_value": 1000,
      "amount": 10
    }]
  }]
}
```

### **Use Case 2: Multi-Tier Discount**
Progressive discounts: 5%, 10%, 15%
```json
{
  "breakpoint_type": 1,
  "lines": [{
    "details": [
      {"promo_type": 1, "minimum_value": 500, "amount": 5},
      {"promo_type": 1, "minimum_value": 1000, "amount": 10},
      {"promo_type": 1, "minimum_value": 2000, "amount": 15}
    ]
  }]
}
```

### **Use Case 3: Repeating Discount**
Buy 10 units, get 50 MAD off (repeating)
```json
{
  "breakpoint_type": 2,
  "lines": [{
    "details": [{
      "promo_type": 2,
      "minimum_value": 10,
      "amount": 50,
      "repeating": true
    }]
  }]
}
```

### **Use Case 4: Product Mix Requirement**
Buy 5 of Product A AND 3 of Product B, get 20% off
```json
{
  "breakpoint_type": 2,
  "lines": [{
    "assortment_type": "multiple",
    "assortments": [
      {"based_on_product": true, "product_code": "PROD_A", "minimum": 5},
      {"based_on_product": true, "product_code": "PROD_B", "minimum": 3}
    ],
    "details": [{
      "promo_type": 1,
      "minimum_value": 1,
      "amount": 20
    }]
  }]
}
```

---

## ⚠️ Important Notes

### **Route Structure**
✅ **Correct:**
- `/api/backend/promotions/product-families`
- `/api/backend/promotions/partner-families`
- `/api/backend/promotions/boosts`

❌ **Incorrect:**
- `/api/backend/product-families` (missing `/promotions/` prefix)
- `/api/backend/partner-families` (missing `/promotions/` prefix)

### **Authentication**
- Backend endpoints (`/api/backend/*`) require admin authentication
- Calculation endpoints (`/api/promotions/*`) can be public or partner-authenticated
- Use Bearer token in Authorization header

### **Validation**
- `code` must be unique
- `start_date` must be before `end_date`
- `minimum_value` must be positive
- `amount` must be positive
- Product/partner codes must exist in database

---

## 🔍 Testing

### **Postman Collection**
Import: `docs/PROMOTIONS_POSTMAN_COLLECTION.json`

### **Test Scenarios**
1. **Minimum Not Met** - Cart below threshold
2. **Exact Minimum** - Cart at exact threshold
3. **Repeating Promotion** - Multiple threshold hits
4. **Multi-Tier** - Different breakpoint levels
5. **Assortment Met** - Product mix satisfied
6. **Assortment Not Met** - Product mix not satisfied

---

## 📖 Full Documentation
See `docs/PROMOTIONS.md` for complete documentation including:
- Detailed API specifications
- Response examples
- Calculation engine logic
- Frontend integration examples
- Troubleshooting guide

---

**Version:** 1.0.1  
**Last Updated:** December 20, 2025  
**Status:** ✅ Production Ready
