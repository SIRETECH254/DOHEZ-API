# 🏷️ DOHEZ-API - Product Variant Management Documentation

## 📋 Table of Contents
- [Product Variant Management Overview](#product-variant-management-overview)
- [Product Variant Model](#-product-variant-model)
- [Product Variant Controller](#-product-variant-controller)
- [Product Variant Routes](#-product-variant-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Product Variant Management Overview

Product Variant Management allows for the creation and organization of product variations using customizable options. Each variant consists of a name and a list of associated options.

---

## 🏗️ Product Variant Model

### Schema Definition
```typescript
interface IOption {
  value: string;
  isActive: boolean;
  sortOrder: number;
}

interface IVariant extends Document {
  name: string;
  options: IOption[];
  branchId: Types.ObjectId | IBranch;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Variant.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IVariant, IOption } from '../types';

const optionSchema = new Schema<IOption>({
  value: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  }
}, { _id: true });

const variantSchema = new Schema<IVariant>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  options: [optionSchema],
  branchId: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Variant = mongoose.model<IVariant>('Variant', variantSchema);

export default Variant;
```

### Validation Rules
```typescript
name:      { required: true, trim: true }
value:     { required: true, trim: true }
isActive:  { default: true }
sortOrder: { default: 0 }
branchId:  { required: true, ref: 'Branch' }
```

---

## 🎮 Product Variant Controller

**File:** `src/controllers/variantController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Variant from "../models/Variant";
import Product from "../models/Product";
```

### Functions Overview

#### `attachVariant()`
**Purpose:** Attach and optionally configure a variant for a product  
**Access:** Admin/Super Admin  
**Process:** Add variant ID to product's variants array and update `selectedVariantOptions` with provided `optionIds`, then generate SKUs.

**Controller Implementation:**
```typescript
export const attachVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, variantId, optionIds = [] } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    const variant = await Variant.findById(variantId);
    if (!variant) return next(errorHandler(404, "Variant not found"));

    if (optionIds.length > 0) {
      const validOptionIds = variant.options.map(opt => opt._id?.toString());
      const invalidIds = optionIds.filter((id: string) => !validOptionIds.includes(id));
      if (invalidIds.length > 0) {
        return next(errorHandler(400, `Invalid option IDs for this variant: ${invalidIds.join(", ")}`));
      }
    }

    const isAttached = product.variants.some((v: any) => v.toString() === variantId);
    if (!isAttached) {
      product.variants.push(variantId as any);
    }
    
    const existingSelectionIndex = product.selectedVariantOptions.findIndex(
      (sel: any) => sel.variantId.toString() === variantId
    );

    if (existingSelectionIndex > -1) {
      product.selectedVariantOptions[existingSelectionIndex].optionIds = optionIds;
    } else {
      product.selectedVariantOptions.push({
        variantId: variantId as any,
        optionIds: optionIds
      });
    }

    await product.generateSKUs();

    res.status(200).json({ success: true, message: "Variant attached and configured successfully", data: { product } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `detachVariant()`
**Purpose:** Detach a variant from a product  
**Access:** Admin/Super Admin  
**Process:** Remove variant ID from product's variants and selectedVariantOptions arrays, then regenerate SKUs.

**Controller Implementation:**
```typescript
export const detachVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, variantId } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    product.variants = product.variants.filter((v: any) => v.toString() !== variantId);
    product.selectedVariantOptions = product.selectedVariantOptions.filter(
      (sel: any) => sel.variantId.toString() !== variantId
    );

    await product.generateSKUs();

    res.status(200).json({ success: true, message: "Variant detached successfully", data: { product } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `createVariant()`
**Purpose:** Create a new product variant  
**Access:** Admin

**Controller Implementation:**
```typescript
export const createVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, options, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const variant = await Variant.create({ name, options, branchId, sortOrder });

    res.status(201).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVariants()`
**Purpose:** List all product variants with pagination  
**Access:** Public

**Controller Implementation:**
```typescript
export const getVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = search ? { name: { $regex: search, $options: "i" } } : {};
    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const variants = await Variant.find(query)
      .populate("branchId")
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Variant.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
      success: true, 
      data: { 
        variants, 
        pagination: { 
          currentPage: options.page, 
          totalPages, 
          totalVariants: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        } 
      } 
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVariantById()`
**Purpose:** Get single product variant by ID  
**Access:** Public

**Controller Implementation:**
```typescript
export const getVariantById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variant = await Variant.findById(req.params.id).populate("branchId");

    if (!variant) return next(errorHandler(404, "Variant not found"));

    res.status(200).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateVariant()`
**Purpose:** Update product variant  
**Access:** Admin

**Controller Implementation:**
```typescript
export const updateVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, options, branchId, sortOrder } = req.body;
    const variant = await Variant.findById(req.params.id);

    if (!variant) return next(errorHandler(404, "Variant not found"));

    if (name) variant.name = name;
    if (options) variant.options = options;
    if (sortOrder !== undefined) variant.sortOrder = sortOrder;
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return next(errorHandler(404, "Branch not found"));
      variant.branchId = branchId;
    }

    await variant.save();

    res.status(200).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteVariant()`
**Purpose:** Delete product variant  
**Access:** Admin

**Controller Implementation:**
```typescript
export const deleteVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variant = await Variant.findByIdAndDelete(req.params.id);

    if (!variant) return next(errorHandler(404, "Variant not found"));

    res.status(200).json({ success: true, message: "Variant deleted" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Product Variant Routes

### Base Path: `/api/variants`

```typescript
POST   /attach            // Attach variant to product (Admin)
POST   /detach            // Detach variant from product (Admin)
POST   /                  // Create variant (Admin)
GET    /                  // Get all (Public)
GET    /:id               // Get details (Public)
PUT    /:id               // Update (Admin)
DELETE /:id               // Delete (Admin)
```

### Router Implementation

**File: `src/routes/variantRoutes.ts`**

```typescript
import express from 'express';
import {
  createVariant,
  getVariants,
  getVariantById,
  updateVariant,
  deleteVariant,
  attachVariant,
  detachVariant
} from '../controllers/variantController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/attach', authenticateToken, authorizeRoles(['admin', 'super_admin']), attachVariant);
router.post('/detach', authenticateToken, authorizeRoles(['admin', 'super_admin']), detachVariant);
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createVariant);

router.get('/', getVariants);

router.get('/:id', getVariantById);

router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateVariant);

router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteVariant);

export default router;
```

### Route Details

#### `POST /api/variants/attach`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
**Body:**
```json
{
  "productId": "650af9994444444444444444",
  "variantId": "650af1112222222222222222",
  "optionIds": ["650af2223333333333333333"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Variant attached and configured successfully",
  "data": {
    "product": {
      "_id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "variants": ["650af1112222222222222222"],
      "selectedVariantOptions": [
        { 
          "variantId": "650af1112222222222222222", 
          "optionIds": ["650af2223333333333333333"],
          "_id": "650af3334444444444444444"
        }
      ],
      "skus": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `POST /api/variants/detach`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
**Body:**
```json
{
  "productId": "650af9994444444444444444",
  "variantId": "650af1112222222222222222"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Variant detached successfully",
  "data": {
    "product": {
      "_id": "650af9994444444444444444",
      "name": "Luxury Pizza",
      "variants": [],
      "selectedVariantOptions": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:05:00.000Z",
      "__v": 2
    }
  }
}
```

#### `POST /api/variants`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Size",
  "branchId": "650af1234567890abcdef123",
  "sortOrder": 1,
  "options": [
    { "value": "Small", "sortOrder": 1 },
    { "value": "Large", "sortOrder": 2 }
  ]
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Size",
      "branchId": "650af1234567890abcdef123",
      "sortOrder": 1,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1, "_id": "650af1234567890abcdef790" },
        { "value": "Large", "isActive": true, "sortOrder": 2, "_id": "650af1234567890abcdef791" }
      ],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/variants`
**Query:** `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "variants": [
      {
        "_id": "650af1234567890abcdef789",
        "name": "Size",
        "branchId": {
          "_id": "650af1234567890abcdef123",
          "vendorId": "650af1234567890abcdef999",
          "name": "Main Branch",
          "email": "branch@example.com",
          "phone": "+254700000000",
          "location": {
            "address": "Street 123",
            "coordinates": {
              "lat": -1.2921,
              "lng": 36.8219
            }
          },
          "isMainBranch": true,
          "isActive": true,
          "createdAt": "2026-05-25T09:00:00.000Z",
          "updatedAt": "2026-05-25T09:00:00.000Z"
        },
        "sortOrder": 1,
        "options": [
          { "value": "Small", "isActive": true, "sortOrder": 1, "_id": "650af1234567890abcdef790" },
          { "value": "Large", "isActive": true, "sortOrder": 2, "_id": "650af1234567890abcdef791" }
        ],
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalVariants": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/variants/:id`
**Params:** `id=650af1234567890abcdef789`
**Response:**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Size",
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "vendorId": "650af1234567890abcdef999",
        "name": "Main Branch",
        "email": "branch@example.com",
        "phone": "+254700000000",
        "location": {
          "address": "Street 123",
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          }
        },
        "isMainBranch": true,
        "isActive": true,
        "createdAt": "2026-05-25T09:00:00.000Z",
        "updatedAt": "2026-05-25T09:00:00.000Z"
      },
      "sortOrder": 1,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1, "_id": "650af1234567890abcdef790" },
        { "value": "Large", "isActive": true, "sortOrder": 2, "_id": "650af1234567890abcdef791" }
      ],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/variants/:id`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: application/json`
**Params:** `id=650af1234567890abcdef789`
**Body:**
```json
{
  "name": "Color",
  "sortOrder": 2
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Color",
      "branchId": "650af1234567890abcdef123",
      "sortOrder": 2,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1, "_id": "650af1234567890abcdef790" },
        { "value": "Large", "isActive": true, "sortOrder": 2, "_id": "650af1234567890abcdef791" }
      ],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `DELETE /api/variants/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id=650af1234567890abcdef789`
**Response:**
```json
{
  "success": true,
  "message": "Variant deleted"
}
```

---

## 📝 API Examples

### 1. Attach and Configure Variant to Product
**Endpoint:** `POST /api/variants/attach`  
**Access:** Admin/Super Admin

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/variants/attach \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "650af9994444444444444444",
    "variantId": "650af1112222222222222222",
    "optionIds": ["650af2223333333333333333", "650af4445555555555555555"]
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Variant attached and configured successfully",
  "data": { 
    "product": {
      "id": "650af9994444444444444444",
      "variants": ["650af1112222222222222222"],
      "selectedVariantOptions": [
        {
          "variantId": "650af1112222222222222222",
          "optionIds": ["650af2223333333333333333", "650af4445555555555555555"]
        }
      ],
      "skus": [ ... ]
    } 
  }
}
```

### 2. Detach Variant from Product
**Endpoint:** `POST /api/variants/detach`  
**Access:** Admin/Super Admin

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/variants/detach \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "650af9994444444444444444",
    "variantId": "650af1112222222222222222"
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Variant detached successfully",
  "data": { "product": { ... } }
}
```

### 3. Create Product Variant
**Endpoint:** `POST /api/variants`  
**Access:** Admin

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/variants \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Size",
    "branchId": "650af1234567890abcdef123",
    "sortOrder": 1,
    "options": [
      { "value": "Small", "sortOrder": 1 },
      { "value": "Large", "sortOrder": 2 }
    ]
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Size",
      "branchId": "650af1234567890abcdef123",
      "sortOrder": 1,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1 },
        { "value": "Large", "isActive": true, "sortOrder": 2 }
      ],
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 2. Get All Variants
**Endpoint:** `GET /api/variants`  
**Access:** Public

**Request Example:**
```bash
curl -X GET "http://localhost:3500/api/variants?page=1&limit=10"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variants": [
      {
        "_id": "650af1234567890abcdef789",
        "name": "Size",
        "branchId": {
          "_id": "650af1234567890abcdef123",
          "vendorId": "650af1234567890abcdef999",
          "name": "Main Branch",
          "email": "branch@example.com",
          "phone": "+254700000000",
          "location": {
            "address": "Street 123",
            "coordinates": {
              "lat": -1.2921,
              "lng": 36.8219
            }
          },
          "isMainBranch": true,
          "isActive": true,
          "createdAt": "2026-04-29T09:00:00.000Z",
          "updatedAt": "2026-04-29T09:00:00.000Z"
        },
        "sortOrder": 1,
        "options": [
          { "value": "Small", "isActive": true, "sortOrder": 1 },
          { "value": "Large", "isActive": true, "sortOrder": 2 }
        ],
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalVariants": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Single Variant
**Endpoint:** `GET /api/variants/:id`  
**Access:** Public

**Request Example:**
```bash
curl -X GET http://localhost:3500/api/variants/650af1234567890abcdef789
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Size",
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "vendorId": "650af1234567890abcdef999",
        "name": "Main Branch",
        "email": "branch@example.com",
        "phone": "+254700000000",
        "location": {
          "address": "Street 123",
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          }
        },
        "isMainBranch": true,
        "isActive": true,
        "createdAt": "2026-04-29T09:00:00.000Z",
        "updatedAt": "2026-04-29T09:00:00.000Z"
      },
      "sortOrder": 1,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1 },
        { "value": "Large", "isActive": true, "sortOrder": 2 }
      ],
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 4. Update Product Variant
**Endpoint:** `PUT /api/variants/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/variants/650af1234567890abcdef789 \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Color",
    "sortOrder": 2
  }'
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "variant": {
      "_id": "650af1234567890abcdef789",
      "name": "Color",
      "branchId": "650af1234567890abcdef123",
      "sortOrder": 2,
      "options": [
        { "value": "Small", "isActive": true, "sortOrder": 1 },
        { "value": "Large", "isActive": true, "sortOrder": 2 }
      ],
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T11:00:00.000Z"
    }
  }
}
```

### 5. Delete Variant
**Endpoint:** `DELETE /api/variants/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X DELETE http://localhost:3500/api/variants/650af1234567890abcdef789 \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Variant deleted"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateVariant);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createVariant);
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `authenticateToken` and `authorizeRoles`.

---

## 🚨 Error Handling

Standard error: `{ "success": false, "message": "..." }`

---

## 📊 Database Indexes

```typescript
variantSchema.index({ name: 1 });
```

---
**Last Updated:** April 2026  
**Version:** 1.0.0
