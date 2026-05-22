# 📂 DOHEZ-API - Product Category Management Documentation

## 📋 Table of Contents
- [Product Category Management Overview](#product-category-management-overview)
- [Product Category Model](#-product-category-model)
- [Product Category Controller](#-product-category-controller)
- [Product Category Routes](#-product-category-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Product Category Management Overview

Product Category Management handles the sub-categorization of products linked to product types. Categories allow for organized product navigation and filtering.

---

## 📂 Product Category Model

### Schema Definition
```typescript
interface IProductCategory extends Document {
  name: string;
  details?: string;
  icon?: string | null;
  iconPublicId?: string | null;
  sort: number;
  slug: string;
  productType: Types.ObjectId | IProductType;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/ProductCategory.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IProductCategory } from '../types';

const productCategorySchema = new Schema<IProductCategory>(
  {
    name: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    icon: { type: String, default: null },
    iconPublicId: { type: String, default: null },
    sort: { type: Number, default: 0 },
    slug: { type: String, required: true, unique: true },
    productType: { type: Schema.Types.ObjectId, ref: 'ProductType', required: true },
  },
  { timestamps: true }
);

const ProductCategory = mongoose.model<IProductCategory>('ProductCategory', productCategorySchema);
export default ProductCategory;
```

### Validation Rules
```typescript
name:        { required: true, trim: true }
details:     { trim: true }
sort:        { default: 0 }
slug:        { required: true, unique: true }
productType: { required: true, ref: 'ProductType' }
```

---

## 🎮 Product Category Controller

**File:** `src/controllers/productCategoryController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductCategory from "../models/ProductCategory";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
```

### Functions Overview

#### `createProductCategory()`
**Purpose:** Create a new product category  
**Access:** Admin

**Controller Implementation:**
```typescript
export const createProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, sort, productType } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-');
    const categoryData: any = { name, details, sort, productType, slug };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-categories/icons");
      categoryData.icon = uploadResult.url;
      categoryData.iconPublicId = uploadResult.public_id;
    }

    const category = await ProductCategory.create(categoryData);

    res.status(201).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getProductCategories()`
**Purpose:** List all product categories with pagination  
**Access:** Public

**Controller Implementation:**
```typescript
export const getProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = search ? { name: { $regex: search, $options: "i" } } : {};
    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const categories = await ProductCategory.find(query)
      .populate("productType")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductCategory.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            categories, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalCategories: total,
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

#### `getProductCategoryById()`
**Purpose:** Get single product category by ID  
**Access:** Public

**Controller Implementation:**
```typescript
export const getProductCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ProductCategory.findById(req.params.id).populate("productType");

    if (!category) return next(errorHandler(404, "Category not found"));

    res.status(200).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateProductCategory()`
**Purpose:** Update product category  
**Access:** Admin

**Controller Implementation:**
```typescript
export const updateProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, sort, productType } = req.body;
    const category = await ProductCategory.findById(req.params.id);

    if (!category) return next(errorHandler(404, "Category not found"));

    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/ /g, '-');
    }

    if (details !== undefined) category.details = details;
    if (sort !== undefined) category.sort = sort;
    if (productType) category.productType = productType;

    if (req.file) {
      if (category.iconPublicId) await deleteFromCloudinary(category.iconPublicId);
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-categories/icons");
      category.icon = uploadResult.url;
      category.iconPublicId = uploadResult.public_id;
    }

    await category.save();

    res.status(200).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteProductCategory()`
**Purpose:** Delete product category  
**Access:** Admin

**Controller Implementation:**
```typescript
export const deleteProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ProductCategory.findByIdAndDelete(req.params.id);

    if (!category) return next(errorHandler(404, "Category not found"));

    if (category.iconPublicId) await deleteFromCloudinary(category.iconPublicId);

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Product Category Routes

### Base Path: `/api/product-categories`

```typescript
POST   /                  // Create category (Admin)
GET    /                  // Get all (Public)
GET    /:id               // Get details (Public)
PUT    /:id               // Update (Admin)
DELETE /:id               // Delete (Admin)
```

### Router Implementation

**File: `src/routes/productCategoryRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createProductCategory,
  getProductCategories,
  getProductCategoryById,
  updateProductCategory,
  deleteProductCategory
} from '../controllers/productCategoryController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductCategory);

router.get('/', getProductCategories);

router.get('/:id', getProductCategoryById);

router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), updateProductCategory);

router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductCategory);

export default router;
```

### Route Details

#### `POST /api/product-categories`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: multipart/form-data`
**Body (multipart/form-data):**
- `name`: "Mobile Phones"
- `details`: "Smartphones and mobile devices"
- `sort`: 1
- `productType`: "650af1234567890abcdef123"
- `icon`: [file]

**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Mobile Phones",
      "details": "Smartphones and mobile devices",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
      "iconPublicId": "product-categories/mobile-phones",
      "sort": 1,
      "slug": "mobile-phones",
      "productType": "650af1234567890abcdef123",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

#### `GET /api/product-categories`
**Query:** `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "650af1234567890abcdef456",
        "name": "Mobile Phones",
        "details": "Smartphones and mobile devices",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
        "iconPublicId": "product-categories/mobile-phones",
        "sort": 1,
        "slug": "mobile-phones",
        "productType": {
          "_id": "650af1234567890abcdef123",
          "name": "Electronics",
          "details": "Electronic devices and accessories",
          "order": 1,
          "slug": "electronics",
          "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
          "iconPublicId": "product-types/electronics",
          "createdAt": "2026-04-29T10:00:00.000Z",
          "updatedAt": "2026-04-29T10:00:00.000Z"
        },
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCategories": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/product-categories/:id`
**Params:** `id=650af1234567890abcdef456`
**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Mobile Phones",
      "details": "Smartphones and mobile devices",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
      "iconPublicId": "product-categories/mobile-phones",
      "sort": 1,
      "slug": "mobile-phones",
      "productType": {
        "_id": "650af1234567890abcdef123",
        "name": "Electronics",
        "details": "Electronic devices and accessories",
        "order": 1,
        "slug": "electronics",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
        "iconPublicId": "product-types/electronics",
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      },
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

#### `PUT /api/product-categories/:id`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: multipart/form-data`
**Params:** `id=650af1234567890abcdef456`
**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Smartphones",
      "details": "Latest smartphones",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/smartphones.png",
      "iconPublicId": "product-categories/smartphones",
      "sort": 2,
      "slug": "smartphones",
      "productType": "650af1234567890abcdef123",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T11:00:00.000Z"
    }
  }
}
```

#### `DELETE /api/product-categories/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id=650af1234567890abcdef456`
**Response:**
```json
{
  "success": true,
  "message": "Category deleted"
}
```

---

## 📝 API Examples

### 1. Create Product Category
**Endpoint:** `POST /api/product-categories`  
**Access:** Admin

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/product-categories \
  -H "Authorization: Bearer <admin_token>" \
  -F "name=Mobile Phones" \
  -F "details=Smartphones and mobile devices" \
  -F "sort=1" \
  -F "productType=650af1234567890abcdef123" \
  -F "icon=@/path/to/icon.png"
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Mobile Phones",
      "details": "Smartphones and mobile devices",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
      "iconPublicId": "product-categories/mobile-phones",
      "sort": 1,
      "slug": "mobile-phones",
      "productType": "650af1234567890abcdef123",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 2. Get All Product Categories
**Endpoint:** `GET /api/product-categories`  
**Access:** Public

**Request Example:**
```bash
curl -X GET "http://localhost:3500/api/product-categories?page=1&limit=10"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "650af1234567890abcdef456",
        "name": "Mobile Phones",
        "details": "Smartphones and mobile devices",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
        "iconPublicId": "product-categories/mobile-phones",
        "sort": 1,
        "slug": "mobile-phones",
        "productType": {
          "_id": "650af1234567890abcdef123",
          "name": "Electronics",
          "details": "Electronic devices and accessories",
          "order": 1,
          "slug": "electronics",
          "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
          "iconPublicId": "product-types/electronics",
          "createdAt": "2026-04-29T10:00:00.000Z",
          "updatedAt": "2026-04-29T10:00:00.000Z"
        },
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCategories": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Single Product Category
**Endpoint:** `GET /api/product-categories/:id`  
**Access:** Public

**Request Example:**
```bash
curl -X GET http://localhost:3500/api/product-categories/650af1234567890abcdef456
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Mobile Phones",
      "details": "Smartphones and mobile devices",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/mobile-phones.png",
      "iconPublicId": "product-categories/mobile-phones",
      "sort": 1,
      "slug": "mobile-phones",
      "productType": {
        "_id": "650af1234567890abcdef123",
        "name": "Electronics",
        "details": "Electronic devices and accessories",
        "order": 1,
        "slug": "electronics",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
        "iconPublicId": "product-types/electronics",
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      },
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 4. Update Product Category
**Endpoint:** `PUT /api/product-categories/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/product-categories/650af1234567890abcdef456 \
  -H "Authorization: Bearer <admin_token>" \
  -F "name=Smartphones" \
  -F "details=Latest smartphones" \
  -F "sort=2"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef456",
      "name": "Smartphones",
      "details": "Latest smartphones",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-categories/smartphones.png",
      "iconPublicId": "product-categories/smartphones",
      "sort": 2,
      "slug": "smartphones",
      "productType": "650af1234567890abcdef123",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T11:00:00.000Z"
    }
  }
}
```

### 5. Delete Product Category
**Endpoint:** `DELETE /api/product-categories/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X DELETE http://localhost:3500/api/product-categories/650af1234567890abcdef456 \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Category deleted"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductCategory);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductCategory);
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization via `authenticateToken` and `authorizeRoles`.
- **Storage:** Secure image handling via Cloudinary.

---

## 🚨 Error Handling

Standard error: `{ "success": false, "message": "..." }`

---

## 📊 Database Indexes

```typescript
productCategorySchema.index({ name: 1 });
productCategorySchema.index({ slug: 1 });
productCategorySchema.index({ productType: 1 });
```

---
**Last Updated:** April 2026  
**Version:** 1.0.0
