# 🛒 DOHEZ-API - Cart Management Documentation

## 📋 Table of Contents
- [Cart Management Overview](#cart-management-overview)
- [Cart Model](#-cart-model)
- [Cart Controller](#-cart-controller)
- [Cart Routes](#-cart-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Cart Management Overview

Cart Management handles the user's shopping experience, supporting a vendor-branch hierarchy. Each cart is segmented into groups based on the vendor and branch, ensuring items are correctly associated with the correct fulfillment source.

---

## 🛒 Cart Model

### Schema Definition
```typescript
interface ICart extends Document {
  userId: Types.ObjectId;
  cartGroups: ICartGroup[];
  totalCartValue: number;
  createdAt: Date;
  updatedAt: Date;
}

interface ICartGroup {
  vendorId: Types.ObjectId;
  branchId: Types.ObjectId;
  items: ICartItem[];
  groupSubtotal: number;
}

interface ICartItem {
  productId: Types.ObjectId;
  skuId: Types.ObjectId;
  quantity: number;
  priceAtAddition: number;
  variants?: Array<{ variantId: Types.ObjectId; optionId: Types.ObjectId }>;
  modifiers?: Array<{ modifierId: Types.ObjectId; optionId: Types.ObjectId }>;
}
```

### Model Implementation

**File: `src/models/Cart.ts`**

```typescript
import mongoose, { Schema, Types } from 'mongoose';
import { ICart } from '../types';

const cartItemSchema = new Schema({
  productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true },
  skuId: { type: Schema.Types.ObjectId, required: true },
  quantity: { type: Number, required: true, min: 1 },
  priceAtAddition: { type: Number, required: true },
  variants: [
    {
      variantId: { type: Schema.Types.ObjectId },
      optionId: { type: Schema.Types.ObjectId }
    }
  ],
  modifiers: [
    {
      modifierId: { type: Schema.Types.ObjectId },
      optionId: { type: Schema.Types.ObjectId }
    }
  ]
  });


const cartGroupSchema = new Schema({
  vendorId: { type: Schema.Types.ObjectId, ref: 'Vendor', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch', required: true },
  items: [cartItemSchema],
  groupSubtotal: { type: Number, default: 0 }
});

const cartSchema = new Schema<ICart>(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
    cartGroups: [cartGroupSchema],
    totalCartValue: { type: Number, default: 0 }
  },
  { timestamps: true }
);

const Cart = mongoose.model<ICart>('Cart', cartSchema);
export default Cart;
```

### Validation Rules
```typescript
userId:         { required: true, unique: true, ref: 'User' }
cartGroups:     { type: Array }
totalCartValue: { default: 0 }
```

---

## 🎮 Cart Controller

**File:** `src/controllers/cartController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Cart from "../models/Cart";
import Product from "../models/Product";
```

### Functions Overview

#### `getCart()`
**Purpose:** Fetch user's cart  
**Access:** Authenticated users  
**Process:** Find cart and populate all relational references.  
**Response:** Cart details

**Controller Implementation:**
```typescript
export const getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const cart = await Cart.findOne({ userId: req.user?._id })
      .populate("cartGroups.vendorId cartGroups.branchId cartGroups.items.productId");
    
    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `addToCart()`
**Purpose:** Add item to cart  
**Access:** Authenticated users  
**Process:** Find/create cart, locate/create branch group, update items, recalc totals.  
**Response:** Success message and cart

**Controller Implementation:**
```typescript
export const addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, branchId, productId, skuId, quantity, priceAtAddition, variants, modifiers } = req.body;
    
    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    let cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) {
      cart = await Cart.create({ userId: req.user?._id, cartGroups: [], totalCartValue: 0 });
    }

    let group = cart.cartGroups.find(g => g.branchId.toString() === branchId);

    if (group) {
      const itemIndex = group.items.findIndex(i => i.skuId.toString() === skuId);
      if (itemIndex > -1) {
        group.items[itemIndex].quantity += quantity;
      } else {
        group.items.push({ productId, skuId, quantity, priceAtAddition, variants, modifiers });
      }
    } else {
      cart.cartGroups.push({
        vendorId,
        branchId,
        items: [{ productId, skuId, quantity, priceAtAddition, variants, modifiers }],
        groupSubtotal: 0
      });
      group = cart.cartGroups[cart.cartGroups.length - 1];
    }

    // Recalculate Subtotals
    group.groupSubtotal = group.items.reduce((sum, item) => sum + (item.priceAtAddition * item.quantity), 0);
    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);

    await cart.save();

    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateQuantity()`
**Purpose:** Update item quantity  
**Access:** Authenticated users  
**Process:** Update specific item qty using its unique `cartItemId`, remove if 0, update totals.  
**Response:** Success message

**Controller Implementation:**
```typescript
export const updateQuantity = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branchId, cartItemId, quantity } = req.body;
    
    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    const group = cart.cartGroups.find(g => g.branchId.toString() === branchId);
    if (!group) return next(errorHandler(404, "Branch group not found in cart"));

    const item = group.items.find(i => i._id?.toString() === cartItemId);
    if (!item) return next(errorHandler(404, "Item not found in cart"));

    if (quantity <= 0) {
      group.items = group.items.filter(i => i._id?.toString() !== cartItemId);
      if (group.items.length === 0) {
        cart.cartGroups = cart.cartGroups.filter(g => g.branchId.toString() !== branchId);
      }
    } else {
      item.quantity = quantity;
    }

    // Recalculate
    group.groupSubtotal = group.items.reduce((sum, i) => sum + (i.priceAtAddition * i.quantity), 0);
    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);

    await cart.save();

    res.status(200).json({ success: true, data: { cart } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `removeItem()`
**Purpose:** Remove item from cart  
**Access:** Authenticated users  
**Process:** Remove item using its unique `cartItemId`, remove empty group, update totals.  
**Response:** Success message

**Controller Implementation:**
```typescript
export const removeItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { branchId, cartItemId } = req.body;

    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    const group = cart.cartGroups.find(g => g.branchId.toString() === branchId);
    if (!group) return next(errorHandler(404, "Branch group not found"));

    group.items = group.items.filter(i => i._id?.toString() !== cartItemId);
    if (group.items.length === 0) {
      cart.cartGroups = cart.cartGroups.filter(g => g.branchId.toString() !== branchId);
    }

    cart.totalCartValue = cart.cartGroups.reduce((sum, g) => sum + g.groupSubtotal, 0);
    await cart.save();

    res.status(200).json({ success: true, message: "Item removed" });
  } catch (error: any) {
    next(error);
  }
};
```

#### `clearCart()`
**Purpose:** Clear full cart  
**Access:** Authenticated users  
**Process:** Clear cart groups and reset total.  
**Response:** Success message

**Controller Implementation:**
```typescript
export const clearCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const cart = await Cart.findOne({ userId: req.user?._id });
    if (!cart) return next(errorHandler(404, "Cart not found"));

    cart.cartGroups = [];
    cart.totalCartValue = 0;
    await cart.save();

    res.status(200).json({ success: true, message: "Cart cleared" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Cart Routes

### Base Path: `/api/cart`

```typescript
GET    /                 // Get user cart
POST   /add              // Add item to cart
PUT    /update           // Update quantity
DELETE /remove           // Remove item
DELETE /clear            // Clear full cart
```

### Router Implementation

**File: `src/routes/cartRoutes.ts`**

```typescript
import express from 'express';
import { getCart, addToCart, updateQuantity, removeItem, clearCart } from '../controllers/cartController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, getCart);

router.post('/add', authenticateToken, addToCart);

router.put('/update', authenticateToken, updateQuantity);

router.delete('/remove', authenticateToken, removeItem);

router.delete('/clear', authenticateToken, clearCart);

export default router;
```

### Route Details

#### 1. Get Cart
- **Route:** `GET /api/cart`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "userId": "660af1238888888888888888",
      "cartGroups": [
        {
          "vendorId": {
            "id": "660af4569999999999999999",
            "name": "Vendor Name"
          },
          "branchId": {
            "id": "660af7890000000000000000",
            "name": "Branch Name"
          },
          "items": [
            {
              "productId": {
                "id": "660af9995555555555555555",
                "name": "Luxury Pizza"
              },
              "skuId": "660af8881111111111111111",
              "quantity": 2,
              "priceAtAddition": 1500,
              "variants": []
            }
          ],
          "groupSubtotal": 3000
        }
      ],
      "totalCartValue": 3000,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

#### 2. Add Item to Cart
- **Route:** `POST /api/cart/add`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "vendorId": "660af4569999999999999999",
  "branchId": "660af7890000000000000000",
  "productId": "660af9995555555555555555",
  "skuId": "660af8881111111111111111",
  "quantity": 1,
  "priceAtAddition": 1500
}
```

**Complex Request Body (with Variants and Modifiers):**
```json
{
  "vendorId": "660af4569999999999999999",
  "branchId": "660af7890000000000000000",
  "productId": "660af9995555555555555555",
  "skuId": "660af8881111111111111111",
  "quantity": 1,
  "priceAtAddition": 1800,
  "variants": [
    { "variantId": "660af0001111111111111111", "optionId": "660af0002222222222222222" }
  ],
  "modifiers": [
    { "modifierId": "660af0003333333333333333", "optionId": "660af0004444444444444444" }
  ]
}
```
- **Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "userId": "660af1238888888888888888",
      "totalCartValue": 1500,
      "updatedAt": "2026-04-30T10:05:00.000Z"
    }
  }
}
```

#### 3. Update Quantity
- **Route:** `PUT /api/cart/update`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "branchId": "660af7890000000000000000",
  "cartItemId": "660af8881111111111111222",
  "quantity": 5
}
```
**Body Fields:**
- `branchId`: (String) The ID of the branch group containing the item.
- `cartItemId`: (String) The unique `_id` of the cart line item. This ID represents a specific combination of SKU + Variants + Modifiers.
- `quantity`: (Number) The new total quantity for this specific configuration.

- **Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "totalCartValue": 7500,
      "updatedAt": "2026-04-30T10:10:00.000Z"
    }
  }
}
```

#### 4. Remove Item
- **Route:** `DELETE /api/cart/remove`
- **Headers:** `Authorization: Bearer <token>`
- **Request Body:**
```json
{
  "branchId": "660af7890000000000000000",
  "cartItemId": "660af8881111111111111222"
}
```
**Body Fields:**
- `branchId`: (String) The ID of the branch group containing the item.
- `cartItemId`: (String) The unique `_id` of the specific cart line item configuration to remove.

#### 5. Clear Cart
- **Route:** `DELETE /api/cart/clear`
- **Headers:** `Authorization: Bearer <token>`
- **Response:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token to identify the user for cart operations  
**Usage:**
```typescript
router.get('/', authenticateToken, getCart);
router.post('/add', authenticateToken, addToCart);
```

---

## 📝 API Examples

### 1. Get Cart
```bash
curl -X GET http://localhost:3500/api/cart \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "userId": "660af1238888888888888888",
      "cartGroups": [
        {
          "vendorId": {
            "id": "660af4569999999999999999",
            "name": "Vendor Name"
          },
          "branchId": {
            "id": "660af7890000000000000000",
            "name": "Branch Name"
          },
          "items": [
            {
              "productId": {
                "id": "660af9995555555555555555",
                "name": "Luxury Pizza"
              },
              "skuId": "660af8881111111111111111",
              "quantity": 2,
              "priceAtAddition": 1500,
              "variants": []
            }
          ],
          "groupSubtotal": 3000
        }
      ],
      "totalCartValue": 3000,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

### 2. Add Item to Cart
```bash
curl -X POST http://localhost:3500/api/cart/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "660af4569999999999999999",
    "branchId": "660af7890000000000000000",
    "productId": "660af9995555555555555555",
    "skuId": "660af8881111111111111111",
    "quantity": 1,
    "priceAtAddition": 1500
  }'
```

**Complex Add Item (with Variants and Modifiers):**
```bash
curl -X POST http://localhost:3500/api/cart/add \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "660af4569999999999999999",
    "branchId": "660af7890000000000000000",
    "productId": "660af9995555555555555555",
    "skuId": "660af8881111111111111111",
    "quantity": 1,
    "priceAtAddition": 1800,
    "variants": [
      { "variantId": "660af0001111111111111111", "optionId": "660af0002222222222222222" }
    ],
    "modifiers": [
      { "modifierId": "660af0003333333333333333", "optionId": "660af0004444444444444444" }
    ]
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "userId": "660af1238888888888888888",
      "totalCartValue": 1500,
      "updatedAt": "2026-04-30T10:05:00.000Z"
    }
  }
}
```

### 3. Update Quantity
```bash
curl -X PUT http://localhost:3500/api/cart/update \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "660af7890000000000000000",
    "cartItemId": "660af8881111111111111222",
    "quantity": 5
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "cart": {
      "id": "660af9994444444444444444",
      "totalCartValue": 7500,
      "updatedAt": "2026-04-30T10:10:00.000Z"
    }
  }
}
```

### 4. Remove Item
```bash
curl -X DELETE http://localhost:3500/api/cart/remove \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "branchId": "660af7890000000000000000",
    "cartItemId": "660af8881111111111111222"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Item removed"
}
```

### 5. Clear Cart
```bash
curl -X DELETE http://localhost:3500/api/cart/clear \
  -H "Authorization: Bearer <token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Cart cleared"
}
```

---

## 🛡️ Security Features
- **Ownership:** Users only access their own cart.
- **Atomic Updates:** Cart totals recalculated on every mutation.

---

## 📊 Database Indexes
```typescript
cartSchema.index({ userId: 1 });
```

**Last Updated:** April 2026  
**Version:** 1.0.0
