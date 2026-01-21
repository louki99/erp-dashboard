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

## 8. SEQUENCE & SKIP LOGIC

### What is Sequence?

**Sequence** determines the **order** in which promotions are evaluated and applied.

- **Lower sequence = Higher priority** (evaluated first)
- Promotions are sorted by `sequence` in ascending order
- Example: `sequence: 10` is evaluated before `sequence: 20`

### What is Skip to Sequence?

**Skip to Sequence** (`skip_to_sequence`) is a control mechanism that allows a promotion to **skip subsequent promotions** after it is applied.

- When a promotion applies, it can set a "jump point"
- All promotions with `sequence < skip_to_sequence` are skipped
- Only updates when promotion **actually applies** (not just evaluated)

### How It Works

```
1. System fetches promotions ordered by sequence (10, 20, 30, 40...)
2. Start with skipToSequence = 0
3. For each promotion:
   - If promotion.sequence < skipToSequence → SKIP
   - Otherwise, evaluate promotion
   - If promotion applies → skipToSequence = promotion.skip_to_sequence
4. Continue to next promotion
```

---

### 8.1 Example 1: Exclusive VIP Promotion

**Business Rule:** "VIP customers get 30% off and cannot combine with other promotions"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "VIP_EXCLUSIVE",
    "name": "VIP 30% Discount",
    "description": "Exclusive VIP discount - blocks all other promotions",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 10,
    "skip_to_sequence": 999,
    "partner_families": ["VIP_PARTNERS"],
    "lines": [
        {
            "name": "VIP Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 1,
                    "amount": -30,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Result:**
- VIP customer: Gets 30% off, all other promos (seq 11-998) are skipped ✅
- Regular customer: VIP promo doesn't apply, other promos work normally ✅

---

### 8.2 Example 2: Tiered Promotion Priority

**Business Rule:** "Apply best promotion per category, skip lower-tier promos in same category"

```bash
# Premium Tier (blocks Standard tier)
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PREMIUM_TIER",
    "name": "Premium 20% Discount",
    "description": "Premium tier - blocks standard promotions",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 10,
    "skip_to_sequence": 30,
    "partner_families": ["PREMIUM_PARTNERS"],
    "lines": [
        {
            "name": "Premium Rule",
            "paid_based_on_product": "family",
            "paid_code": "ELECTRONICS",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 5,
                    "amount": -20,
                    "repeating": true
                }
            ]
        }
    ]
}'

# Standard Tier (would be skipped if Premium applies)
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "STANDARD_TIER",
    "name": "Standard 10% Discount",
    "description": "Standard tier promotion",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 20,
    "skip_to_sequence": 0,
    "partner_families": ["STANDARD_PARTNERS"],
    "lines": [
        {
            "name": "Standard Rule",
            "paid_based_on_product": "family",
            "paid_code": "ELECTRONICS",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 5,
                    "amount": -10,
                    "repeating": true
                }
            ]
        }
    ]
}'

# Clearance (always evaluated, regardless of tier)
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "CLEARANCE_PROMO",
    "name": "Clearance Items 50% Off",
    "description": "Clearance promotion - always applies",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 30,
    "skip_to_sequence": 0,
    "lines": [
        {
            "name": "Clearance Rule",
            "paid_based_on_product": "family",
            "paid_code": "CLEARANCE",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 1,
                    "amount": -50,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Execution Flow:**

**Premium Customer:**
```
1. Evaluate Premium (seq=10) → Applies ✅ → skipToSequence = 30
2. Check Standard (seq=20) → 20 < 30 → SKIP ❌
3. Evaluate Clearance (seq=30) → 30 >= 30 → Applies ✅
Result: Premium 20% + Clearance 50%
```

**Standard Customer:**
```
1. Check Premium (seq=10) → Doesn't qualify ❌ → skipToSequence = 0
2. Evaluate Standard (seq=20) → Applies ✅ → skipToSequence = 0
3. Evaluate Clearance (seq=30) → Applies ✅
Result: Standard 10% + Clearance 50%
```

---

### 8.3 Example 3: Stackable Promotions (No Skip)

**Business Rule:** "Allow multiple promotions to stack"

```bash
# First Promotion - No skip
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_STACK_1",
    "name": "5% Volume Discount",
    "description": "Stackable promotion 1",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 10,
    "skip_to_sequence": 0,
    "lines": [
        {
            "name": "Volume Rule",
            "paid_based_on_product": "family",
            "paid_code": "FOOD",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 10,
                    "amount": -5,
                    "repeating": true
                }
            ]
        }
    ]
}'

# Second Promotion - No skip
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "PROMO_STACK_2",
    "name": "3% Loyalty Discount",
    "description": "Stackable promotion 2",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 20,
    "skip_to_sequence": 0,
    "lines": [
        {
            "name": "Loyalty Rule",
            "paid_based_on_product": "family",
            "paid_code": "FOOD",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 1,
                    "amount": -3,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Result:** Both promotions apply (5% + 3% = 8% total discount)

---

### 8.4 Example 4: Black Friday Special

**Business Rule:** "Black Friday promotion blocks everything except loyalty points"

```bash
# Black Friday - Blocks most promos
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "BLACK_FRIDAY_2026",
    "name": "Black Friday 40% Off",
    "description": "Black Friday special - blocks regular promotions",
    "start_date": "2026-11-28",
    "end_date": "2026-11-30",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 5,
    "skip_to_sequence": 100,
    "lines": [
        {
            "name": "Black Friday Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 1,
                    "amount": -40,
                    "repeating": true
                }
            ]
        }
    ]
}'

# Regular promotions (seq 6-99) would be skipped

# Loyalty Points - Always applies
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "LOYALTY_POINTS",
    "name": "Loyalty Points Bonus",
    "description": "Earn loyalty points - always active",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 2,
    "scale_method": 2,
    "sequence": 100,
    "skip_to_sequence": 0,
    "is_loyalty_program": true,
    "lines": [
        {
            "name": "Points Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": "none",
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 100,
                    "amount": -2,
                    "repeating": false
                }
            ]
        }
    ]
}'
```

**Result:** Black Friday 40% + Loyalty Points (all promos seq 6-99 are skipped)

---

### 8.5 Sequence Planning Guide

#### Recommended Sequence Ranges

```
1-10:    Exclusive/VIP promotions (high skip values)
11-20:   Premium tier promotions
21-30:   Standard tier promotions
31-40:   Clearance/Special offers
41-50:   Category-specific promotions
51-99:   General promotions
100+:    Always-apply promotions (loyalty, points, etc.)
```

#### Skip Strategy Table

| Scenario | Sequence | Skip To | Effect |
|----------|----------|---------|--------|
| Exclusive promo | 10 | 999 | Blocks everything |
| Tier-based | 10 | 30 | Blocks same tier |
| Stackable | 10 | 0 | Allows all |
| Category block | 20 | 50 | Blocks category promos |
| No restriction | Any | 0 | Normal flow |

---

### 8.6 Testing Skip Logic

**Test Scenario 1: VIP vs Regular**
```bash
# Create promotions with sequences: 10 (VIP, skip=50), 20 (Regular), 30 (Regular), 50 (Clearance)
# Test with VIP partner → Should get: VIP + Clearance only
# Test with Regular partner → Should get: Regular(20) + Regular(30) + Clearance
```

**Test Scenario 2: Verify Skip Updates Only on Apply**
```bash
# Create promotion: seq=10, skip=50, minimum_value=100
# Test with cart total 50 → Promo doesn't apply → Other promos work
# Test with cart total 150 → Promo applies → Promos 11-49 are skipped
```

---

## 9. ASSORTMENT TYPES (MIX & MATCH REQUIREMENTS)

### What is Assortment Type?

**Assortment Type** enforces **mix and match** requirements for promotions. It ensures customers buy a **variety of products** (not just one product repeatedly) to qualify.

**Without Assortment:**
- Customer buys 10 units of same product → Qualifies ✅

**With Assortment (Type 1, min 2 each):**
- Customer buys 2A + 2B + 2C → Qualifies ✅
- Customer buys 10A + 0B + 0C → Doesn't qualify ❌

### Assortment Type Values

| Type | Code | Name | Description |
|------|------|------|-------------|
| 0 | None | No Requirement | Any products qualify (default) |
| 1 | Quantity | Absolute Quantity | Each assortment item must meet minimum quantity |
| 2 | QuantityPercent | Quantity % | Each item must represent minimum % of total quantity |
| 3 | AmountPercent | Amount % | Each item must represent minimum % of total amount |
| 4 | Amount | Absolute Amount | Each assortment item must meet minimum amount (MAD) |

### How It Works

```
1. Define assortment items (products or families)
2. Set minimum requirement for each item
3. System validates cart against all assortment items
4. If ANY item fails to meet minimum → Promotion doesn't apply
5. If ALL items meet minimum → Promotion applies
```

---

### 9.1 Example 1: Type 1 (Quantity) - Mix & Match Products

**Business Rule:** "Buy at least 2 units each of 3 different beverages to get 15% off"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "MIX_BEVERAGES_001",
    "name": "Mix & Match 3 Beverages",
    "description": "Buy 2 units each of 3 different beverages, get 15% off",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 30,
    "lines": [
        {
            "name": "Mix Rule",
            "paid_based_on_product": "family",
            "paid_code": "BEVERAGES",
            "assortment_type": 1,
            "assortments": [
                {
                    "product_code": "COLA_500ML",
                    "based_on_product": true,
                    "minimum": 2
                },
                {
                    "product_code": "ORANGE_500ML",
                    "based_on_product": true,
                    "minimum": 2
                },
                {
                    "product_code": "LEMON_500ML",
                    "based_on_product": true,
                    "minimum": 2
                }
            ],
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 6,
                    "amount": -15,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Cart | Cola | Orange | Lemon | Result | Reason |
|------|------|--------|-------|--------|--------|
| 1 | 2 | 2 | 2 | ✅ PASS | All meet minimum |
| 2 | 3 | 2 | 1 | ❌ FAIL | Lemon below minimum (1 < 2) |
| 3 | 5 | 0 | 3 | ❌ FAIL | Orange missing |
| 4 | 2 | 2 | 0 | ❌ FAIL | Lemon missing |
| 5 | 4 | 3 | 2 | ✅ PASS | All exceed minimum |

---

### 9.2 Example 2: Type 2 (QuantityPercent) - Balanced Mix

**Business Rule:** "Each product family must represent at least 20% of total quantity"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "BALANCED_MIX_001",
    "name": "Balanced Product Mix 10% Off",
    "description": "Each family must be at least 20% of total quantity",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 40,
    "lines": [
        {
            "name": "Balance Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": 2,
            "assortments": [
                {
                    "product_family_code": "DAIRY",
                    "based_on_product": false,
                    "minimum": 20
                },
                {
                    "product_family_code": "BAKERY",
                    "based_on_product": false,
                    "minimum": 20
                },
                {
                    "product_family_code": "FRUITS",
                    "based_on_product": false,
                    "minimum": 20
                }
            ],
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 10,
                    "amount": -10,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Total Qty | Dairy | Bakery | Fruits | Dairy % | Bakery % | Fruits % | Result |
|-----------|-------|--------|--------|---------|----------|----------|--------|
| 10 | 3 | 3 | 4 | 30% | 30% | 40% | ✅ PASS |
| 10 | 5 | 3 | 2 | 50% | 30% | 20% | ✅ PASS |
| 10 | 6 | 3 | 1 | 60% | 30% | 10% | ❌ FAIL (Fruits < 20%) |
| 15 | 5 | 5 | 5 | 33% | 33% | 33% | ✅ PASS |
| 20 | 8 | 8 | 4 | 40% | 40% | 20% | ✅ PASS |

**Formula:** `(Item Quantity / Total Quantity) * 100 >= Minimum %`

---

### 9.3 Example 3: Type 4 (Amount) - Spend on Each Category

**Business Rule:** "Spend at least 100 MAD on each of 2 product families"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "VALUE_MIX_001",
    "name": "Spend 100 MAD on Each Category",
    "description": "Spend at least 100 MAD on Electronics and Accessories",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 2,
    "scale_method": 2,
    "sequence": 50,
    "lines": [
        {
            "name": "Value Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": 4,
            "assortments": [
                {
                    "product_family_code": "ELECTRONICS",
                    "based_on_product": false,
                    "minimum": 100
                },
                {
                    "product_family_code": "ACCESSORIES",
                    "based_on_product": false,
                    "minimum": 100
                }
            ],
            "details": [
                {
                    "promo_type": 6,
                    "minimum_value": 200,
                    "amount": -50,
                    "repeating": false
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Electronics Amount | Accessories Amount | Result | Reason |
|-------------------|-------------------|--------|--------|
| 150 MAD | 120 MAD | ✅ PASS | Both exceed minimum |
| 100 MAD | 100 MAD | ✅ PASS | Both meet minimum exactly |
| 120 MAD | 80 MAD | ❌ FAIL | Accessories below 100 MAD |
| 50 MAD | 150 MAD | ❌ FAIL | Electronics below 100 MAD |
| 200 MAD | 0 MAD | ❌ FAIL | Accessories missing |

---

### 9.4 Example 4: Type 3 (AmountPercent) - Spend Distribution

**Business Rule:** "Each category must represent at least 25% of total cart value"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "SPEND_DISTRIBUTION_001",
    "name": "Balanced Spending 12% Off",
    "description": "Each category must be at least 25% of cart value",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 2,
    "scale_method": 2,
    "sequence": 60,
    "lines": [
        {
            "name": "Distribution Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": 3,
            "assortments": [
                {
                    "product_family_code": "FRESH_PRODUCE",
                    "based_on_product": false,
                    "minimum": 25
                },
                {
                    "product_family_code": "MEAT_POULTRY",
                    "based_on_product": false,
                    "minimum": 25
                },
                {
                    "product_family_code": "DAIRY_EGGS",
                    "based_on_product": false,
                    "minimum": 25
                }
            ],
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 500,
                    "amount": -12,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Total | Produce | Meat | Dairy | Produce % | Meat % | Dairy % | Result |
|-------|---------|------|-------|-----------|--------|---------|--------|
| 1000 | 300 | 300 | 400 | 30% | 30% | 40% | ✅ PASS |
| 1000 | 250 | 250 | 500 | 25% | 25% | 50% | ✅ PASS |
| 1000 | 400 | 400 | 200 | 40% | 40% | 20% | ❌ FAIL (Dairy < 25%) |
| 800 | 300 | 300 | 200 | 37.5% | 37.5% | 25% | ✅ PASS |
| 1200 | 500 | 500 | 200 | 41.7% | 41.7% | 16.7% | ❌ FAIL (Dairy < 25%) |

**Formula:** `(Item Amount / Total Amount) * 100 >= Minimum %`

---

### 9.5 Example 5: Type 1 with Product Families

**Business Rule:** "Buy from at least 3 different product families, minimum 5 units each"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "FAMILY_MIX_001",
    "name": "Mix 3 Families 20% Off",
    "description": "Buy 5+ units from each of 3 families",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 35,
    "lines": [
        {
            "name": "Family Mix Rule",
            "paid_based_on_product": "entire_cart",
            "assortment_type": 1,
            "assortments": [
                {
                    "product_family_code": "SNACKS",
                    "based_on_product": false,
                    "minimum": 5
                },
                {
                    "product_family_code": "BEVERAGES",
                    "based_on_product": false,
                    "minimum": 5
                },
                {
                    "product_family_code": "CONFECTIONERY",
                    "based_on_product": false,
                    "minimum": 5
                }
            ],
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 15,
                    "amount": -20,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Snacks Qty | Beverages Qty | Confectionery Qty | Result |
|------------|---------------|-------------------|--------|
| 5 | 5 | 5 | ✅ PASS |
| 10 | 6 | 5 | ✅ PASS |
| 8 | 4 | 6 | ❌ FAIL (Beverages < 5) |
| 0 | 10 | 10 | ❌ FAIL (Snacks missing) |
| 5 | 5 | 0 | ❌ FAIL (Confectionery missing) |

---

### 9.6 Example 6: Type 0 (None) - No Assortment

**Business Rule:** "No mix requirement - any products qualify"

```bash
curl --location 'http://localhost:8000/api/admin/promotions' \
--header 'Authorization: Bearer YOUR_TOKEN' \
--header 'Content-Type: application/json' \
--data '{
    "code": "SIMPLE_DISCOUNT_001",
    "name": "Simple 10% Off",
    "description": "No mix requirement - buy 10+ units, get 10% off",
    "start_date": "2026-01-01",
    "end_date": "2026-12-31",
    "breakpoint_type": 1,
    "scale_method": 2,
    "sequence": 70,
    "lines": [
        {
            "name": "Simple Rule",
            "paid_based_on_product": "family",
            "paid_code": "GROCERIES",
            "assortment_type": 0,
            "details": [
                {
                    "promo_type": 1,
                    "minimum_value": 10,
                    "amount": -10,
                    "repeating": true
                }
            ]
        }
    ]
}'
```

**Test Cases:**

| Cart | Result | Reason |
|------|--------|--------|
| 10x Product A | ✅ PASS | No mix requirement |
| 5x A + 5x B | ✅ PASS | Any combination works |
| 1x each of 10 products | ✅ PASS | Variety allowed but not required |

---

### 9.7 Assortment Type Comparison

| Type | Use Case | Validation | Example |
|------|----------|------------|---------|
| **0 (None)** | Simple promotions | No requirement | "Buy 10 units, get 10% off" |
| **1 (Quantity)** | Mix & match products | Absolute quantity per item | "Buy 2 of each: A, B, C" |
| **2 (Qty %)** | Balanced quantity mix | % of total quantity | "Each item ≥20% of total qty" |
| **3 (Amt %)** | Balanced spending | % of total amount | "Each category ≥25% of cart" |
| **4 (Amount)** | Minimum spend per item | Absolute amount per item | "Spend ≥100 MAD on each" |

---

### 9.8 Assortment Best Practices

**When to Use Each Type:**

- **Type 0 (None):** Simple volume discounts, single-product promos
- **Type 1 (Quantity):** Force variety, prevent single-product abuse
- **Type 2 (Qty %):** Ensure balanced product mix by quantity
- **Type 3 (Amt %):** Ensure balanced spending across categories
- **Type 4 (Amount):** Minimum spend requirements per category

**Common Patterns:**

1. **Variety Enforcement:** Type 1 with 3-5 assortment items
2. **Balanced Cart:** Type 2 or 3 with equal percentages (20-33%)
3. **Category Spend:** Type 4 with 2-3 high-value categories
4. **No Restriction:** Type 0 for simple promotions

**Tips:**

- ✅ Use `based_on_product: true` for specific products
- ✅ Use `based_on_product: false` for product families
- ✅ Set realistic minimums (test with actual cart data)
- ✅ Combine with appropriate breakpoint types
- ❌ Don't set minimums too high (customers won't qualify)
- ❌ Don't mix percentage and absolute types in same promotion

---

### 9.9 Testing Assortment Logic

**Test Scenario 1: Type 1 Validation**
```bash
# Create promotion with Type 1, 3 assortments, minimum 2 each
# Test: 2A + 2B + 2C → Should PASS
# Test: 3A + 1B + 2C → Should FAIL (B below minimum)
# Test: 5A + 0B + 3C → Should FAIL (B missing)
```

**Test Scenario 2: Type 2 Percentage Calculation**
```bash
# Create promotion with Type 2, 3 assortments, minimum 25% each
# Test: Total 12 (4A + 4B + 4C) → Should PASS (33% each)
# Test: Total 10 (6A + 3B + 1C) → Should FAIL (C = 10% < 25%)
```

**Test Scenario 3: Type 4 Amount Validation**
```bash
# Create promotion with Type 4, 2 assortments, minimum 100 MAD each
# Test: 150 MAD Family A + 120 MAD Family B → Should PASS
# Test: 150 MAD Family A + 80 MAD Family B → Should FAIL (B < 100)
```

**Test Scenario 4: Empty Assortments**
```bash
# Create promotion with assortment_type = 1 but NO assortment items
# Should PASS (empty assortments = no requirement)
```

---

## 10. NOTES

### Breakpoint Types
- **Type 1 (Quantity)**: Based on number of units
- **Type 2 (Amount)**: Based on total amount in MAD
- **Type 3 (Promo Unit)**: Based on promo_unit field in products table (can represent weight, volume, points)

### Scale Methods
- **Method 1 (Cumulative)**: Apply all matching tiers progressively
- **Method 2 (Bracket)**: Apply only the highest matching tier

### Sequence Best Practices
- **Plan your sequence ranges** before creating promotions
- **Lower sequence = Higher priority** (evaluated first)
- **Use skip_to_sequence strategically** to prevent unwanted stacking
- **Reserve high sequences (100+)** for always-apply promotions
- **Test with different partner types** to verify skip logic

### Skip to Sequence Rules
- **0 = No skip** (allow all subsequent promotions)
- **Value > 0** = Skip all promotions with sequence < skip_to_sequence
- **Only updates when promotion applies** (not just evaluated)
- **Use 999 for exclusive promotions** (blocks everything)

### Amount Sign Convention
- **Negative amounts**: Discounts (e.g., -10 = 10% off or 10 MAD off)
- **Positive amounts**: Target prices (e.g., 76 = set price to 76 MAD)

### Repeating Flag
- **true**: Apply discount multiple times based on quantity
- **false**: Apply discount once regardless of quantity

### Common Pitfalls
- ❌ **Don't set skip_to_sequence = own sequence** (will skip itself)
- ❌ **Don't use same sequence for conflicting promos** (unpredictable order)
- ❌ **Don't forget to test skip logic** with different partner types
- ✅ **Do plan sequence ranges** before implementation
- ✅ **Do document your skip strategy** for maintenance
