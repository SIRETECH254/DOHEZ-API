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
}, { _id: false });

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
```

### Functions Overview

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
  deleteVariant
} from '../controllers/variantController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createVariant);

router.get('/', getVariants);

router.get('/:id', getVariantById);

router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateVariant);

router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteVariant);

export default router;
```

### Route Details

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
        { "value": "Small", "isActive": true, "sortOrder": 1 },
        { "value": "Large", "isActive": true, "sortOrder": 2 }
      ],
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
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
        { "value": "Small", "isActive": true, "sortOrder": 1 },
        { "value": "Large", "isActive": true, "sortOrder": 2 }
      ],
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T11:00:00.000Z"
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

### 1. Create Product Variant
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
