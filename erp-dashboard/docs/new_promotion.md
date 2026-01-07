# Promotion System API Documentation

## Base URL
```
http://localhost:8000/api/admin/promotions
```

## Authentication
All requests require Bearer token authentication:
```bash
Authorization: Bearer YOUR_TOKEN_HERE
```

---

## 1. PROMOTION CRUD OPERATIONS

### 1.1 List All Promotions
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

**With Filters:**
```bash
curl --location 'http://localhost:8000/api/admin/promotions?status=active&breakpoint_type=1&search=discount' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

**Query Parameters:**
- `status`: `active`, `upcoming`, `expired`
- `breakpoint_type`: `1` (Quantity), `2` (Amount), `3` (Promo Unit)
- `start_date`: Filter by start date
- `end_date`: Filter by end date
- `search`: Search in name, code, description

---

### 1.2 Create Promotion - Type 1: Percentage Discount
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_PERCENT_001",
    "name": "10% Discount on Family A",
    "description": "Get 10% off when you buy 5 or more items",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 10,
    "payment_term_dependent": false,
    "is_loyalty_program": false,
    "is_closed": false,
    "partner_families": ["FAM001"],
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_code": "FAMILY_A",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 5,
                    "amount": -10,
                    "repeating": true
                },
                {
                    "promo_type": 1,
                    "minimum_value": 10,
                    "amount": -15,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.3 Create Promotion - Type 2: Amount Per Unit Discount
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_AMOUNT_001",
    "name": "5 MAD off per unit",
    "description": "Get 5 MAD discount per unit when you buy 3+",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 20,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "product",
            "paid_code": "PROD001",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 2,
                    "minimum_value": 3,
                    "amount": -5,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.4 Create Promotion - Type 3: Best Price
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_BESTPRICE_001",
    "name": "Best Price 50 MAD",
    "description": "Best price guarantee - max 50 MAD per unit",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 30,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "product",
            "paid_code": "PROD002",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 3,
                    "minimum_value": 1,
                    "amount": 50,
                    "repeating": false
                }
            ]
        }
    ]
}'
```

---

### 1.5 Create Promotion - Type 4: Free Units (Buy X Get Y Free)
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_FREEUNIT_001",
    "name": "Buy 10 Get 2 Free",
    "description": "Buy 10 units and get 2 free",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 40,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_code": "FAMILY_B",
            "free_based_on_product": "1",
            "free_code": "PROD003",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 4,
                    "minimum_value": 10,
                    "amount": -2,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.6 Create Promotion - Type 5: Free Promo Units
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_FREEPROMO_001",
    "name": "Free Promo Units",
    "description": "Get free promo units based on promo_unit field",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 3,
    "scale_method": 2,
    "sequence": 50,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_code": "FAMILY_C",
            "free_based_on_product": "0",
            "free_code": "FAMILY_D",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 5,
                    "minimum_value": 100,
                    "amount": -10,
                    "repeating": false
                }
            ]
        }
    ]
}'
```

---

### 1.7 Create Promotion - Type 6: Flat Amount Discount
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_FLAT_001",
    "name": "100 MAD Flat Discount",
    "description": "Get 100 MAD off when cart total reaches 1000 MAD",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 2,
    "scale_method": 2,
    "sequence": 60,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "entire_cart",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 6,
                    "minimum_value": 1000,
                    "amount": -100,
                    "repeating": false
                }
            ]
        }
    ]
}'
```

---

### 1.8 Create Promotion - Type 7: Replace Price
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_REPLACE_001",
    "name": "Special Price 76 MAD",
    "description": "Replace price to 76 MAD when buying 10+",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 70,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "product",
            "paid_code": "PSUR0200112",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 7,
                    "minimum_value": 10,
                    "amount": 76,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.9 Create Promotion with Assortments
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_ASSORT_001",
    "name": "Mix & Match Discount",
    "description": "Buy 3 different products from family and get 20% off",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 80,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_code": "FAMILY_E",
            "assortment_type": "1",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 5,
                    "amount": -20,
                    "repeating": true
                }
            ]
        }
    ],
    "assortments": [
        {
            "based_on_product": "1",
            "product_code": "PROD004",
            "minimum": 1
        },
        {
            "based_on_product": "1",
            "product_code": "PROD005",
            "minimum": 1
        },
        {
            "based_on_product": "1",
            "product_code": "PROD006",
            "minimum": 1
        }
    ]
}'
```

---

### 1.10 Create Promotion with Cumulative Scale Method
```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_CUMUL_001",
    "name": "Cumulative Discount Tiers",
    "description": "Progressive discount: 5% at 10 units, 10% at 20 units",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 1,
    "sequence": 90,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_code": "FAMILY_F",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 10,
                    "amount": -5,
                    "repeating": true
                },
                {
                    "promo_type": 1,
                    "minimum_value": 20,
                    "amount": -10,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.11 Show Promotion Details
```bash
curl --location 'http://localhost:8000/api/admin/promotions/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 1.12 Update Promotion
```bash
curl --location --request PUT 'http://localhost:8000/api/admin/promotions/1' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_PERCENT_001_UPDATED",
    "name": "15% Discount on Family A",
    "description": "Updated: Get 15% off when you buy 5 or more items",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 10,
    "is_closed": false,
    "lines": [
        {
            "name": "Rule #1",
            "paid_based_on_product": "family",
            "paid_product_family_code": "FAMILY_A",
            "assortment_type": "0",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 5,
                    "amount": -15,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

---

### 1.13 Clone Promotion
```bash
curl --location --request POST 'http://localhost:8000/api/admin/promotions/1/clone' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 1.14 Delete Promotion
```bash
curl --location --request DELETE 'http://localhost:8000/api/admin/promotions/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

## 2. PARTNER FAMILY MANAGEMENT

### 2.1 List Partner Families
```bash
curl --location 'http://localhost:8000/api/admin/promotions/partner-families' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 2.2 Create Partner Family
```bash
curl --location 'http://localhost:8000/api/admin/promotions/partner-families' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PFAM001",
    "name": "Premium Partners",
    "partner_condition": "Credit limit > 50000",
    "partners": ["PART001", "PART002", "PART003"]
}'
```

---

### 2.3 Show Partner Family
```bash
curl --location 'http://localhost:8000/api/admin/promotions/partner-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 2.4 Update Partner Family
```bash
curl --location --request PUT 'http://localhost:8000/api/admin/promotions/partner-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PFAM001",
    "name": "Premium Partners Updated",
    "partner_condition": "Credit limit > 100000",
    "partners": ["PART001", "PART002", "PART003", "PART004"]
}'
```

---

### 2.5 Delete Partner Family
```bash
curl --location --request DELETE 'http://localhost:8000/api/admin/promotions/partner-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

## 3. PRODUCT FAMILY MANAGEMENT

### 3.1 List Product Families
```bash
curl --location 'http://localhost:8000/api/admin/promotions/product-families' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 3.2 Create Product Family
```bash
curl --location 'http://localhost:8000/api/admin/promotions/product-families' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PRODFAM001",
    "name": "Frozen Foods",
    "description": "All frozen food products",
    "sales_group_code": "SG001",
    "products": ["PROD001", "PROD002", "PROD003"]
}'
```

---

### 3.3 Show Product Family
```bash
curl --location 'http://localhost:8000/api/admin/promotions/product-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 3.4 Update Product Family
```bash
curl --location --request PUT 'http://localhost:8000/api/admin/promotions/product-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PRODFAM001",
    "name": "Frozen Foods Updated",
    "description": "All frozen food products including ice cream",
    "sales_group_code": "SG001",
    "products": ["PROD001", "PROD002", "PROD003", "PROD004"]
}'
```

---

### 3.5 Delete Product Family
```bash
curl --location --request DELETE 'http://localhost:8000/api/admin/promotions/product-families/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

## 4. BOOST MANAGEMENT (Product Family x Partner Family)

### 4.1 List Boosts
```bash
curl --location 'http://localhost:8000/api/admin/promotions/boosts' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

**With Filters:**
```bash
curl --location 'http://localhost:8000/api/admin/promotions/boosts?product_family_id=1&partner_family_id=2' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 4.2 Create Boost
```bash
curl --location 'http://localhost:8000/api/admin/promotions/boosts' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "product_family_id": 1,
    "partner_family_id": 2,
    "rank": 1,
    "boost_factor": 1.5
}'
```

---

### 4.3 Show Boost
```bash
curl --location 'http://localhost:8000/api/admin/promotions/boosts/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 4.4 Update Boost
```bash
curl --location --request PUT 'http://localhost:8000/api/admin/promotions/boosts/1' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "product_family_id": 1,
    "partner_family_id": 2,
    "rank": 1,
    "boost_factor": 2.0
}'
```

---

### 4.5 Delete Boost
```bash
curl --location --request DELETE 'http://localhost:8000/api/admin/promotions/boosts/1' \
--header 'Authorization: Bearer YOUR_TOKEN'
```

---

### 4.6 Bulk Sync Boosts for Product Family
```bash
curl --location 'http://localhost:8000/api/admin/promotions/boosts/bulk-sync' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "product_family_id": 1,
    "boosts": [
        {
            "partner_family_id": 2,
            "rank": 1,
            "boost_factor": 1.5
        },
        {
            "partner_family_id": 3,
            "rank": 2,
            "boost_factor": 2.0
        },
        {
            "partner_family_id": 4,
            "rank": 3,
            "boost_factor": 1.2
        }
    ]
}'
```

---

## 5. FIELD REFERENCE

### Promotion Fields
- **code**: Unique promotion code (required)
- **name**: Promotion name (required)
- **description**: Detailed description
- **start_date**: Start date (YYYY-MM-DD, required)
- **end_date**: End date (YYYY-MM-DD, required)
- **breakpoint_type**: `1` (Quantity), `2` (Amount), `3` (Promo Unit)
- **scale_method**: `1` (Cumulative), `2` (Bracket)
- **sequence**: Promotion execution order (lower = earlier)
- **skip_to_sequence**: Skip to this sequence if promotion applies
- **payment_term_dependent**: Restrict to specific payment terms
- **is_loyalty_program**: Mark as loyalty program
- **is_closed**: Mark as closed/inactive
- **partner_families**: Array of partner family codes
- **payment_terms**: Array of payment term codes

### Promotion Line Fields
- **name**: Line name/description
- **paid_based_on_product**: `"product"`, `"family"`, or `"entire_cart"`
- **paid_code**: Product code or family code (depends on paid_based_on_product)
- **paid_product_code**: Specific product code
- **paid_product_family_code**: Product family code
- **free_based_on_product**: `"0"` (family) or `"1"` (product)
- **free_code**: Free product/family code
- **free_product_code**: Specific free product code
- **free_product_family_code**: Free product family code
- **assortment_type**: `"none"` (0), `"multiple"` (1), `"cart_amount"` (2), `"both"` (3)
- **minimum_cart_amount**: Minimum cart amount for line to apply

### Promotion Line Detail Fields (Breakpoints)
- **promo_type**: 
  - `1` = Percentage
  - `2` = Amount Per Unit
  - `3` = Best Price
  - `4` = Free Unit
  - `5` = Free Promo Unit
  - `6` = Flat Amount
  - `7` = Replace Price
- **minimum_value**: Minimum quantity/amount to reach this tier
- **amount**: Discount amount (negative for discounts, positive for prices)
- **repeating**: Apply discount repeatedly (true/false)

### Assortment Fields
- **based_on_product**: `"0"` (family) or `"1"` (product)
- **product_code**: Product code (if based_on_product = 1)
- **product_family_code**: Family code (if based_on_product = 0)
- **minimum**: Minimum quantity required

---

## 6. PROMO TYPE EXAMPLES

### Type 1: Percentage (-10 = 10% off)
```json
{
    "promo_type": 1,
    "minimum_value": 5,
    "amount": -10,
    "repeating": true
}
```

### Type 2: Amount Per Unit (-5 = 5 MAD off per unit)
```json
{
    "promo_type": 2,
    "minimum_value": 3,
    "amount": -5,
    "repeating": true
}
```

### Type 3: Best Price (50 = max price 50 MAD)
```json
{
    "promo_type": 3,
    "minimum_value": 1,
    "amount": 50,
    "repeating": false
}
```

### Type 4: Free Units (-2 = 2 free units)
```json
{
    "promo_type": 4,
    "minimum_value": 10,
    "amount": -2,
    "repeating": true
}
```

### Type 5: Free Promo Units (-10 = 10 promo units free)
```json
{
    "promo_type": 5,
    "minimum_value": 100,
    "amount": -10,
    "repeating": false
}
```

### Type 6: Flat Amount (-100 = 100 MAD off total)
```json
{
    "promo_type": 6,
    "minimum_value": 1000,
    "amount": -100,
    "repeating": false
}
```

### Type 7: Replace Price (76 = new price 76 MAD)
```json
{
    "promo_type": 7,
    "minimum_value": 10,
    "amount": 76,
    "repeating": true
}
```

---

## 7. COMMON SCENARIOS

### Scenario 1: Simple Percentage Discount
**"10% off when buying 5+ units from Family A"**
- breakpoint_type: `1` (Quantity)
- promo_type: `1` (Percentage)
- paid_based_on_product: `"family"`
- minimum_value: `5`
- amount: `-10`

### Scenario 2: Buy X Get Y Free
**"Buy 10 get 2 free"**
- breakpoint_type: `1` (Quantity)
- promo_type: `4` (Free Unit)
- paid_based_on_product: `"family"`
- free_based_on_product: `"1"`
- minimum_value: `10`
- amount: `-2`

### Scenario 3: Tiered Discount
**"5% at 10 units, 10% at 20 units, 15% at 30 units"**
- breakpoint_type: `1` (Quantity)
- scale_method: `2` (Bracket)
- Multiple details with increasing minimum_value

### Scenario 4: Cart Total Discount
**"100 MAD off when cart reaches 1000 MAD"**
- breakpoint_type: `2` (Amount)
- promo_type: `6` (Flat Amount)
- paid_based_on_product: `"entire_cart"`
- minimum_value: `1000`
- amount: `-100`

### Scenario 5: Special Price
**"Special price 76 MAD when buying 10+"**
- breakpoint_type: `1` (Quantity)
- promo_type: `7` (Replace Price)
- paid_based_on_product: `"product"`
- minimum_value: `10`
- amount: `76`

---

## 8. NOTES

### Breakpoint Types
- **Type 1 (Quantity)**: Based on number of units
- **Type 2 (Amount)**: Based on total amount in MAD
- **Type 3 (Promo Unit)**: Based on promo_unit field in products table

### Scale Methods
- **Method 1 (Cumulative)**: Apply all matching tiers progressively
- **Method 2 (Bracket)**: Apply only the highest matching tier

### Sequence Logic
- Promotions are evaluated in ascending sequence order
- Lower sequence = higher priority
- Use skip_to_sequence to skip subsequent promotions

### Amount Sign Convention
- **Negative amounts**: Discounts (e.g., -10 = 10% off or 10 MAD off)
- **Positive amounts**: Target prices (e.g., 76 = set price to 76 MAD)

### Repeating Flag
- **true**: Apply discount multiple times based on quantity
- **false**: Apply discount once regardless of quantity
