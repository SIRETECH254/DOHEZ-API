# 🏷️ DOHEZ-API - Product Type Management Documentation

## 📋 Table of Contents
- [Product Type Management Overview](#product-type-management-overview)
- [Product Type Model](#-product-type-model)
- [Product Type Controller](#-product-type-controller)
- [Product Type Routes](#-product-type-routes)
- [API Examples](#-api-examples)
- [Database Indexes](#-database-indexes)

---

## Product Type Management Overview

Product Type Management handles the categorization and organizational ordering of products within the system. Product types provide structural classification for products.

---

## 🏷️ Product Type Model

### Schema Definition
```typescript
interface IProductType extends Document {
  service: Types.ObjectId | IService;
  name: string;
  details?: string;
  order: number;
  slug: string;
  icon?: string | null;
  iconPublicId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/ProductType.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IProductType } from '../types';

const productTypeSchema = new Schema<IProductType>(
  {
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      required: true,
    },
    name: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    order: { type: Number, default: 0 },
    slug: { type: String, required: true, unique: true },
    icon: { type: String, default: null },
    iconPublicId: { type: String, default: null },
  },
  { timestamps: true }
);

productTypeSchema.index({ service: 1 });
productTypeSchema.index({ name: 1 });

const ProductType = mongoose.model<IProductType>('ProductType', productTypeSchema);
export default ProductType;
```

### Validation Rules
```typescript
service: { required: true, ref: 'Service' }
name:    { required: true, trim: true }
details: { trim: true }
order:   { default: 0 }
slug:    { required: true, unique: true }
```

---

## 🎮 Product Type Controller

**File:** `src/controllers/productTypeController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductType from "../models/ProductType";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
```

### Functions Overview

#### `createProductType()`
**Purpose:** Create a new product type  
**Access:** Admin  
**Process:** Creates product type with service reference, handles icon upload  
**Response:** Created product type data

**Controller Implementation:**
```typescript
export const createProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, order, service } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-');
    const productTypeData: any = { name, details, order, slug, service };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-types/icons");
      productTypeData.icon = uploadResult.url;
      productTypeData.iconPublicId = uploadResult.public_id;
    }

    const productType = await ProductType.create(productTypeData);
    res.status(201).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getProductTypes()`
**Purpose:** List all product types with pagination and service filtering  
**Access:** Public  
**Response:** List of product types (populated with service) and pagination metadata

**Controller Implementation:**
```typescript
export const getProductTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, service } = req.query;
    const query: any = {};
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    
    if (service) {
      query.service = service;
    }

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const productTypes = await ProductType.find(query)
      .populate("service")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductType.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            productTypes, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalProductTypes: total,
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

#### `getProductTypeById()`
**Purpose:** Get single product type by ID with populated service  
**Access:** Public  
**Response:** Product type data

**Controller Implementation:**
```typescript
export const getProductTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productType = await ProductType.findById(req.params.id).populate("service");
    if (!productType) return next(errorHandler(404, "Product Type not found"));
    res.status(200).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateProductType()`
**Purpose:** Update product type  
**Access:** Admin  
**Process:** Update fields including service, handle icon update  
**Response:** Updated product type

**Controller Implementation:**
```typescript
export const updateProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, order, service } = req.body;
    const productType = await ProductType.findById(req.params.id);
    if (!productType) return next(errorHandler(404, "Product Type not found"));

    if (name) {
      productType.name = name;
      productType.slug = name.toLowerCase().replace(/ /g, '-');
    }
    if (details !== undefined) productType.details = details;
    if (order !== undefined) productType.order = order;
    if (service !== undefined) productType.service = service;

    if (req.file) {
      if (productType.iconPublicId) await deleteFromCloudinary(productType.iconPublicId);
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-types/icons");
      productType.icon = uploadResult.url;
      productType.iconPublicId = uploadResult.public_id;
    }

    await productType.save();
    res.status(200).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteProductType()`
**Purpose:** Delete product type  
**Access:** Admin  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productType = await ProductType.findByIdAndDelete(req.params.id);
    if (!productType) return next(errorHandler(404, "Product Type not found"));
    if (productType.iconPublicId) await deleteFromCloudinary(productType.iconPublicId);
    res.status(200).json({ success: true, message: "Product Type deleted" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Product Type Routes

### Base Path: `/api/product-types`

```typescript
POST   /                  // Create product type (Admin)
GET    /                  // Get all (Public)
GET    /:id               // Get details (Public)
PUT    /:id               // Update (Admin)
DELETE /:id               // Delete (Admin)
```

### Router Implementation

**File: `src/routes/productTypeRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createProductType,
  getProductTypes,
  getProductTypeById,
  updateProductType,
  deleteProductType
} from '../controllers/productTypeController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductType);
router.get('/', getProductTypes);
router.get('/:id', getProductTypeById);
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), updateProductType);
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductType);

export default router;
```

### Route Details

#### `POST /api/product-types`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: multipart/form-data`
**Body (multipart/form-data):**
- `service`: "650af987654321fedcba0987"
- `name`: "Electronics"
- `details`: "Electronic devices and accessories"
- `order`: 1
- `icon`: [file]

**Response:**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": "650af987654321fedcba0987",
      "name": "Electronics",
      "details": "Electronic devices and accessories",
      "order": 1,
      "slug": "electronics",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
      "iconPublicId": "product-types/electronics",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/product-types`
**Query:** `page=1`, `limit=10`, `service=650af987654321fedcba0987`
**Response:**
```json
{
  "success": true,
  "data": {
    "productTypes": [
      {
        "_id": "650af1234567890abcdef123",
        "service": {
          "_id": "650af987654321fedcba0987",
          "name": "General Delivery"
        },
        "name": "Electronics",
        "details": "Electronic devices and accessories",
        "order": 1,
        "slug": "electronics",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
        "iconPublicId": "product-types/electronics",
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalProductTypes": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/product-types/:id`
**Params:** `id=650af1234567890abcdef123`
**Response:**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": {
        "_id": "650af987654321fedcba0987",
        "name": "General Delivery"
      },
      "name": "Electronics",
      "details": "Electronic devices and accessories",
      "order": 1,
      "slug": "electronics",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
      "iconPublicId": "product-types/electronics",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/product-types/:id`
**Headers:** `Authorization: Bearer <admin_token>`, `Content-Type: multipart/form-data`
**Params:** `id=650af1234567890abcdef123`
**Response:**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": "650af987654321fedcba0987",
      "name": "Home Appliances",
      "details": "Kitchen and home electronics",
      "order": 2,
      "slug": "home-appliances",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/home-appliances.png",
      "iconPublicId": "product-types/home-appliances",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `DELETE /api/product-types/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `id=650af1234567890abcdef123`
**Response:**
```json
{
  "success": true,
  "message": "Product Type deleted"
}
```

---

## 📝 API Examples

### 1. Create Product Type
**Endpoint:** `POST /api/product-types`  
**Access:** Admin

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/product-types \
  -H "Authorization: Bearer <admin_token>" \
  -F "service=650af987654321fedcba0987" \
  -F "name=Electronics" \
  -F "details=Electronic devices and accessories" \
  -F "order=1" \
  -F "icon=@/path/to/icon.png"
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": "650af987654321fedcba0987",
      "name": "Electronics",
      "details": "Electronic devices and accessories",
      "order": 1,
      "slug": "electronics",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
      "iconPublicId": "product-types/electronics",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 2. Get All Product Types
**Endpoint:** `GET /api/product-types`  
**Access:** Public

**Request Example:**
```bash
curl -X GET "http://localhost:3500/api/product-types?page=1&limit=10&service=650af987654321fedcba0987"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productTypes": [
      {
        "_id": "650af1234567890abcdef123",
        "service": {
          "_id": "650af987654321fedcba0987",
          "name": "General Delivery"
        },
        "name": "Electronics",
        "details": "Electronic devices and accessories",
        "order": 1,
        "slug": "electronics",
        "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
        "iconPublicId": "product-types/electronics",
        "createdAt": "2026-04-29T10:00:00.000Z",
        "updatedAt": "2026-04-29T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalProductTypes": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Single Product Type
**Endpoint:** `GET /api/product-types/:id`  
**Access:** Public

**Request Example:**
```bash
curl -X GET http://localhost:3500/api/product-types/650af1234567890abcdef123
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": {
        "_id": "650af987654321fedcba0987",
        "name": "General Delivery"
      },
      "name": "Electronics",
      "details": "Electronic devices and accessories",
      "order": 1,
      "slug": "electronics",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/electronics.png",
      "iconPublicId": "product-types/electronics",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T10:00:00.000Z"
    }
  }
}
```

### 4. Update Product Type
**Endpoint:** `PUT /api/product-types/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/product-types/650af1234567890abcdef123 \
  -H "Authorization: Bearer <admin_token>" \
  -F "service=650af987654321fedcba0987" \
  -F "name=Home Appliances" \
  -F "details=Kitchen and home electronics" \
  -F "order=2"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "productType": {
      "_id": "650af1234567890abcdef123",
      "service": "650af987654321fedcba0987",
      "name": "Home Appliances",
      "details": "Kitchen and home electronics",
      "order": 2,
      "slug": "home-appliances",
      "icon": "https://res.cloudinary.com/dohez/image/upload/v1/product-types/home-appliances.png",
      "iconPublicId": "product-types/home-appliances",
      "createdAt": "2026-04-29T10:00:00.000Z",
      "updatedAt": "2026-04-29T11:00:00.000Z"
    }
  }
}
```

### 5. Delete Product Type
**Endpoint:** `DELETE /api/product-types/:id`  
**Access:** Admin

**Request Example:**
```bash
curl -X DELETE http://localhost:3500/api/product-types/650af1234567890abcdef123 \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Product Type deleted"
}
```

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'super_admin']), upload.single('icon'), createProductType);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteProductType);
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
productTypeSchema.index({ name: 1 });
productTypeSchema.index({ slug: 1 });
```

---
**Last Updated:** April 2026  
**Version:** 1.0.0
