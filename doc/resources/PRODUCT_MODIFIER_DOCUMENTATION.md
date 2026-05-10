# 🧪 DOHEZ API - Product Modifier Documentation

## 📋 Table of Contents
- [Product Modifier Overview](#product-modifier-overview)
- [Product Modifier Model](#product-modifier-model)
- [Product Modifier Controller](#product-modifier-controller)
- [Product Modifier Routes](#product-modifier-routes)
- [Middleware](#middleware)
- [API Examples](#api-examples)
- [Security Features](#security-features)
- [Error Handling](#error-handling)

---

## 🍽️ Product Modifier Overview

Product Modifiers are options that can be added to products, such as extra toppings, side dishes, or customizations. They allow for flexible product configurations with specific pricing and selection rules.

---

## Product Modifier Model

### Schema Definition
```typescript
export interface IProductModifier extends Document {
  name: string;
  description?: string;
  options: IOption[];
  price: number;
  min_selection: number;
  max_selection: number;
  is_required: boolean;
  branchId: Types.ObjectId | IBranch;
  sortOrder: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/ProductModifier.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IProductModifier, IOption } from '../types';

const optionSchema = new Schema<IOption>(
  {
    value: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const productModifierSchema = new Schema<IProductModifier>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    options: [optionSchema],
    price: {
      type: Number,
      default: 0,
    },
    min_selection: {
      type: Number,
      default: 1,
    },
    max_selection: {
      type: Number,
      default: 1,
    },
    is_required: {
      type: Boolean,
      default: false,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const ProductModifier = mongoose.model<IProductModifier>('ProductModifier', productModifierSchema);
export default ProductModifier;
```

### Validation Rules
```typescript
name:          { required: true, trim: true }
description:   { trim: true }
options:       { type: Array, subSchema: optionSchema }
price:         { default: 0 }
min_selection: { default: 1 }
max_selection: { default: 1 }
is_required:   { default: false }
branchId:      { required: true, ref: 'Branch' }
sortOrder:     { default: 0 }
```

---

## Product Modifier Controller

**File:** `src/controllers/productModifierController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductModifier from "../models/ProductModifier";
import Branch from "../models/Branch";
```

### Functions Overview

#### `createProductModifier()`
**Purpose:** Create a new product modifier  
**Access:** Admin/Super Admin  
**Validation:** `branchId` must reference a valid branch.
**Process:** Verify branch exists, then create the modifier document.
**Response:** Created product modifier object.

**Controller Implementation:**
```typescript
export const createProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, options, price, min_selection, max_selection, is_required, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const parsedOptions = options ? (typeof options === 'string' ? JSON.parse(options) : options) : [];

    const modifier = await ProductModifier.create({
      name,
      description,
      options: parsedOptions,
      price,
      min_selection,
      max_selection,
      is_required,
      branchId,
      sortOrder
    });

    res.status(201).json({
      success: true,
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getProductModifiers()`
**Purpose:** List all product modifiers with pagination and search. Populates `branchId`.  
**Access:** Public
**Process:** Build search query, apply pagination, and populate branch details.
**Response:** Array of product modifiers with pagination metadata.

**Controller Implementation:**
```typescript
export const getProductModifiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const modifiers = await ProductModifier.find(query)
      .populate("branchId")
      .sort({ sortOrder: 1, createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductModifier.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        modifiers,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalModifiers: total,
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

#### `getProductModifierById()`
**Purpose:** Get details of a single product modifier. Populates `branchId`.  
**Access:** Public
**Process:** Find modifier by ID and populate branch details.
**Response:** Single product modifier object.

**Controller Implementation:**
```typescript
export const getProductModifierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const modifier = await ProductModifier.findById(req.params.id).populate("branchId");

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    res.status(200).json({
      success: true,
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateProductModifier()`
**Purpose:** Update an existing product modifier. Validates `branchId` if provided.  
**Access:** Admin/Super Admin
**Process:** Find modifier, update fields, validate new branch if provided, and save.
**Response:** Updated product modifier object.

**Controller Implementation:**
```typescript
export const updateProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, options, price, min_selection, max_selection, is_required, branchId, sortOrder } = req.body;
    const modifier = await ProductModifier.findById(req.params.id);

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    if (name) modifier.name = name;
    if (description !== undefined) modifier.description = description;
    
    if (options !== undefined) {
      modifier.options = typeof options === 'string' ? JSON.parse(options) : options;
    }
    
    if (price !== undefined) modifier.price = price;
    if (min_selection !== undefined) modifier.min_selection = min_selection;
    if (max_selection !== undefined) modifier.max_selection = max_selection;
    if (is_required !== undefined) modifier.is_required = is_required;
    if (sortOrder !== undefined) modifier.sortOrder = sortOrder;
    
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return next(errorHandler(404, "Branch not found"));
      modifier.branchId = branchId;
    }

    await modifier.save();

    res.status(200).json({
      success: true,
      message: "Product modifier updated successfully",
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteProductModifier()`
**Purpose:** Permanently remove a product modifier  
**Access:** Admin/Super Admin
**Process:** Find and remove the product modifier by ID.
**Response:** Success message.

**Controller Implementation:**
```typescript
export const deleteProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const modifier = await ProductModifier.findByIdAndDelete(req.params.id);

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    res.status(200).json({
      success: true,
      message: "Product modifier deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `attachModifier()`
**Purpose:** Attach a modifier to a product and configure available options.  
**Access:** Admin/Super Admin  
**Process:** Validate product and modifier exist, validate option IDs, add to product's modifiers and selectedModifierOptions arrays.
**Response:** Updated product object.

**Controller Implementation:**
```typescript
export const attachModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, modifierId, optionIds = [] } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    const modifier = await ProductModifier.findById(modifierId);
    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    if (optionIds.length > 0) {
      const validOptionIds = modifier.options.map(opt => opt._id?.toString());
      const invalidIds = optionIds.filter((id: string) => !validOptionIds.includes(id));
      if (invalidIds.length > 0) {
        return next(errorHandler(400, `Invalid option IDs for this modifier: ${invalidIds.join(", ")}`));
      }
    }

    const isAttached = product.modifiers.some((m: any) => m.toString() === modifierId);
    if (!isAttached) {
      product.modifiers.push(modifierId as any);
    }

    const existingSelectionIndex = product.selectedModifierOptions.findIndex(
      (sel: any) => sel.modifierId.toString() === modifierId
    );

    if (existingSelectionIndex > -1) {
      product.selectedModifierOptions[existingSelectionIndex].optionIds = optionIds;
    } else {
      product.selectedModifierOptions.push({
        modifierId: modifierId as any,
        optionIds: optionIds
      });
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Modifier attached and configured successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `detachModifier()`
**Purpose:** Remove a modifier from a product.  
**Access:** Admin/Super Admin  
**Process:** Remove modifier from product's modifiers and selectedModifierOptions arrays.
**Response:** Updated product object.

**Controller Implementation:**
```typescript
export const detachModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, modifierId } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    product.modifiers = product.modifiers.filter((m: any) => m.toString() !== modifierId) as any;
    product.selectedModifierOptions = product.selectedModifierOptions.filter(
      (sel: any) => sel.modifierId.toString() !== modifierId
    );

    await product.save();

    res.status(200).json({
      success: true,
      message: "Modifier detached successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## Product Modifier Routes

### Base Path: `/api/product-modifiers`

```typescript
POST   /                  // Create product modifier (Admin)
GET    /                  // Get all product modifiers (Public)
GET    /:id               // Get single modifier (Public)
PUT    /:id               // Update modifier (Admin)
DELETE /:id               // Delete modifier (Admin)
POST   /attach            // Attach modifier to product (Admin)
POST   /detach            // Detach modifier from product (Admin)
```

### Router Implementation

**File: `src/routes/productModifierRoutes.ts`**

```typescript
import express from 'express';
import {
  createProductModifier,
  getProductModifiers,
  getProductModifierById,
  updateProductModifier,
  deleteProductModifier,
  attachModifier,
  detachModifier
} from '../controllers/productModifierController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/attach', authenticateToken, authorizeRoles(['admin', 'super_admin']), attachModifier);
router.post('/detach', authenticateToken, authorizeRoles(['admin', 'super_admin']), detachModifier);
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createProductModifier);
router.get('/', getProductModifiers);
router.get('/:id', getProductModifierById);
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProductModifier);
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductModifier);

export default router;
```

### Route Details

#### `POST /api/product-modifiers/attach`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "productId": "650af1234567890abcdef123",
  "modifierId": "650af1234567890abcdef789",
  "optionIds": ["650af1234567890abcdef001", "650af1234567890abcdef002"]
}
```
**Response:**
```json
{
  "success": true,
  "message": "Modifier attached and configured successfully",
  "data": {
    "product": {
      "_id": "650af1234567890abcdef123",
      "name": "Pizza",
      "modifiers": ["650af1234567890abcdef789"],
      "selectedModifierOptions": [
        {
          "modifierId": "650af1234567890abcdef789",
          "optionIds": ["650af1234567890abcdef001", "650af1234567890abcdef002"]
        }
      ]
    }
  }
}
```

#### `POST /api/product-modifiers/detach`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "productId": "650af1234567890abcdef123",
  "modifierId": "650af1234567890abcdef789"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Modifier detached successfully",
  "data": {
    "product": {
      "_id": "650af1234567890abcdef123",
      "name": "Pizza",
      "modifiers": [],
      "selectedModifierOptions": []
    }
  }
}
```

#### `POST /api/product-modifiers`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "name": "Toppings",
  "description": "Choose your pizza toppings",
  "price": 0,
  "min_selection": 1,
  "max_selection": 5,
  "is_required": true,
  "branchId": "650af1234567890abcdef123",
  "sortOrder": 1,
  "options": [
    { "value": "Extra Cheese", "sortOrder": 1 },
    { "value": "Mushrooms", "sortOrder": 2 },
    { "value": "Pepperoni", "sortOrder": 3 }
  ]
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "description": "Add an extra layer of mozzarella",
      "price": 50,
      "min_selection": 0,
      "max_selection": 3,
      "is_required": false,
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "vendorId": "650af1234567890abcdef000",
        "name": "Main Branch",
        "email": "branch@example.com",
        "phone": "+254700000000",
        "location": {
          "address": "123 Street, Nairobi",
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          },
          "place_id": "ChIJ..."
        },
        "cover": "https://res.cloudinary.com/...",
        "fulfillmentConfig": {
          "delivery": true,
          "pickup": true
        },
        "workingHours": {
          "monday": { "start": "08:00", "end": "17:00" },
          "tuesday": { "start": "08:00", "end": "17:00" },
          "wednesday": { "start": "08:00", "end": "17:00" },
          "thursday": { "start": "08:00", "end": "17:00" },
          "friday": { "start": "08:00", "end": "17:00" },
          "saturday": { "start": "09:00", "end": "14:00" },
          "sunday": { "start": "Closed", "end": "Closed" }
        },
        "gallery": [],
        "createdAt": "2026-04-30T09:00:00.000Z",
        "updatedAt": "2026-04-30T09:00:00.000Z"
      },
      "sortOrder": 1,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

#### `GET /api/product-modifiers`
**Headers:** `None`
**Query:** `page`, `limit`, `search`
**Response:**
```json
{
  "success": true,
  "data": {
    "modifiers": [
      {
        "_id": "650af1234567890abcdef789",
        "name": "Extra Cheese",
        "description": "Add an extra layer of mozzarella",
        "price": 50,
        "min_selection": 0,
        "max_selection": 3,
        "is_required": false,
        "branchId": {
          "_id": "650af1234567890abcdef123",
          "vendorId": "650af1234567890abcdef000",
          "name": "Main Branch",
          "email": "branch@example.com",
          "phone": "+254700000000",
          "location": {
            "address": "123 Street, Nairobi",
            "coordinates": {
              "lat": -1.2921,
              "lng": 36.8219
            },
            "place_id": "ChIJ..."
          },
          "cover": "https://res.cloudinary.com/...",
          "fulfillmentConfig": {
            "delivery": true,
            "pickup": true
          },
          "workingHours": {
            "monday": { "start": "08:00", "end": "17:00" }
          },
          "gallery": [],
          "createdAt": "2026-04-30T09:00:00.000Z",
          "updatedAt": "2026-04-30T09:00:00.000Z"
        },
        "sortOrder": 1,
        "createdAt": "2026-04-30T10:00:00.000Z",
        "updatedAt": "2026-04-30T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalModifiers": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/product-modifiers/:id`
**Headers:** `None`
**Params:** `id`
**Response:**
```json
{
  "success": true,
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "description": "Add an extra layer of mozzarella",
      "price": 50,
      "min_selection": 0,
      "max_selection": 3,
      "is_required": false,
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "vendorId": "650af1234567890abcdef000",
        "name": "Main Branch",
        "email": "branch@example.com",
        "phone": "+254700000000",
        "location": {
          "address": "123 Street, Nairobi",
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          },
          "place_id": "ChIJ..."
        },
        "cover": "https://res.cloudinary.com/...",
        "fulfillmentConfig": {
          "delivery": true,
          "pickup": true
        },
        "workingHours": {
          "monday": { "start": "08:00", "end": "17:00" }
        },
        "gallery": [],
        "createdAt": "2026-04-30T09:00:00.000Z",
        "updatedAt": "2026-04-30T09:00:00.000Z"
      },
      "sortOrder": 1,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

#### `PUT /api/product-modifiers/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id`
**Body:**
```json
{
  "price": 60
}
```
**Response:**
```json
{
  "success": true,
  "message": "Product modifier updated successfully",
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "description": "Add an extra layer of mozzarella",
      "price": 60,
      "min_selection": 0,
      "max_selection": 3,
      "is_required": false,
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "name": "Main Branch"
      },
      "sortOrder": 1,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T11:00:00.000Z"
    }
  }
}
```

#### `DELETE /api/product-modifiers/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id`
**Response:**
```json
{
  "success": true,
  "message": "Product modifier deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), createProductModifier);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), updateProductModifier);
```

---

## API Examples

### Create Product Modifier
```bash
curl -X POST http://localhost:3500/api/product-modifiers \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "name": "Extra Cheese",
    "description": "Add an extra layer of mozzarella",
    "price": 50,
    "min_selection": 0,
    "max_selection": 3,
    "is_required": false,
    "branchId": "650af1234567890abcdef123",
    "sortOrder": 1
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "description": "Add an extra layer of mozzarella",
      "price": 50,
      "min_selection": 0,
      "max_selection": 3,
      "is_required": false,
      "branchId": "650af1234567890abcdef123",
      "sortOrder": 1,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

### Get All Product Modifiers
```bash
curl -X GET "http://localhost:3500/api/product-modifiers?page=1&limit=10"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "modifiers": [
      {
        "_id": "650af1234567890abcdef789",
        "name": "Extra Cheese",
        "description": "Add an extra layer of mozzarella",
        "price": 50,
        "min_selection": 0,
        "max_selection": 3,
        "is_required": false,
        "branchId": {
          "_id": "650af1234567890abcdef123",
          "vendorId": "650af1234567890abcdef000",
          "name": "Main Branch",
          "email": "branch@example.com",
          "phone": "+254700000000",
          "location": {
            "address": "123 Street, Nairobi",
            "coordinates": {
              "lat": -1.2921,
              "lng": 36.8219
            },
            "place_id": "ChIJ..."
          },
          "cover": "https://res.cloudinary.com/...",
          "fulfillmentConfig": {
            "delivery": true,
            "pickup": true
          },
          "workingHours": {
            "monday": { "start": "08:00", "end": "17:00" },
            "tuesday": { "start": "08:00", "end": "17:00" },
            "wednesday": { "start": "08:00", "end": "17:00" },
            "thursday": { "start": "08:00", "end": "17:00" },
            "friday": { "start": "08:00", "end": "17:00" },
            "saturday": { "start": "09:00", "end": "14:00" },
            "sunday": { "start": "Closed", "end": "Closed" }
          },
          "gallery": [],
          "createdAt": "2026-04-30T09:00:00.000Z",
          "updatedAt": "2026-04-30T09:00:00.000Z"
        },
        "sortOrder": 1,
        "createdAt": "2026-04-30T10:00:00.000Z",
        "updatedAt": "2026-04-30T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalModifiers": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Product Modifier By ID
```bash
curl -X GET http://localhost:3500/api/product-modifiers/650af1234567890abcdef789
```
**Response:**
```json
{
  "success": true,
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "description": "Add an extra layer of mozzarella",
      "price": 50,
      "min_selection": 0,
      "max_selection": 3,
      "is_required": false,
      "branchId": {
        "_id": "650af1234567890abcdef123",
        "vendorId": "650af1234567890abcdef000",
        "name": "Main Branch",
        "email": "branch@example.com",
        "phone": "+254700000000",
        "location": {
          "address": "123 Street, Nairobi",
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          },
          "place_id": "ChIJ..."
        },
        "cover": "https://res.cloudinary.com/...",
        "fulfillmentConfig": {
          "delivery": true,
          "pickup": true
        },
        "workingHours": {
          "monday": { "start": "08:00", "end": "17:00" },
          "tuesday": { "start": "08:00", "end": "17:00" },
          "wednesday": { "start": "08:00", "end": "17:00" },
          "thursday": { "start": "08:00", "end": "17:00" },
          "friday": { "start": "08:00", "end": "17:00" },
          "saturday": { "start": "09:00", "end": "14:00" },
          "sunday": { "start": "Closed", "end": "Closed" }
        },
        "gallery": [],
        "createdAt": "2026-04-30T09:00:00.000Z",
        "updatedAt": "2026-04-30T09:00:00.000Z"
      },
      "sortOrder": 1,
      "createdAt": "2026-04-30T10:00:00.000Z",
      "updatedAt": "2026-04-30T10:00:00.000Z"
    }
  }
}
```

### Update Product Modifier
```bash
curl -X PUT http://localhost:3500/api/product-modifiers/650af1234567890abcdef789 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "price": 60,
    "branchId": "650af1234567890abcdef456"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Product modifier updated successfully",
  "data": {
    "modifier": {
      "_id": "650af1234567890abcdef789",
      "name": "Extra Cheese",
      "price": 60
    }
  }
}
```

### Delete Product Modifier
```bash
curl -X DELETE http://localhost:3500/api/product-modifiers/650af1234567890abcdef789 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Product modifier deleted successfully"
}
```

---

## Security Features

1.  **RBAC Protection:** Mutations (POST, PUT, DELETE) are restricted to `admin` and `super_admin` roles.
2.  **Input Sanitization:** Mongoose schema ensures type safety and trims string inputs.
3.  **Relational Integrity:** Ensures `branchId` exists before allowing creation or updates.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Product modifier not found" }
{ "success": false, "message": "Branch not found" }
```

---

**Last Updated:** April 2026  
**Version:** 1.1.0
