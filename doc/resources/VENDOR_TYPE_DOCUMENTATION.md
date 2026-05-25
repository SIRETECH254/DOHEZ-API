# 📋 DOHEZ-API - Vendor Type Management Documentation

## 📋 Table of Contents
- [Vendor Type Overview](#vendor-type-overview)
- [Vendor Type Model](#-vendor-type-model)
- [Vendor Type Controller](#-vendor-type-controller)
- [Vendor Type Routes](#-vendor-type-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Vendor Type Overview

Vendor Type Management allows administrators to define different types of vendors on the platform (e.g., "Product Vendor", "Service Vendor"). This classification helps in tailoring the user experience and business logic based on the nature of the vendor.

---

## 👤 Vendor Type Model

### Schema Definition
```typescript
export interface IVendorType extends Document {
  name: string;
  description?: string;
  slug: string;
  image?: string | null;
  imagePublicId?: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/VendorType.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IVendorType } from '../types';

const vendorTypeSchema = new Schema<IVendorType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorTypeSchema.index({ isActive: 1 });
vendorTypeSchema.index({ createdAt: -1 });

const VendorType = mongoose.model<IVendorType>('VendorType', vendorTypeSchema);

export default VendorType;
```

### Validation Rules
```typescript
name:        { required: true, unique: true, trim: true }
description: { optional, trim: true }
slug:        { required: true, unique: true, lowercase: true, trim: true }
image:       { optional, url }
isActive:    { default: true }
```

---

## 🎮 Vendor Type Controller

**File:** `src/controllers/vendorTypeController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import VendorType from "../models/VendorType";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `createVendorType()`
**Purpose:** Create a new vendor type  
**Access:** Super Admin  
**Validation:** Name is required and must be unique  
**Process:** Create type, automatically generate slug, handle optional image upload to Cloudinary  
**Response:** Success message and created vendor type

**Controller Implementation:**
```typescript
export const createVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return next(errorHandler(400, "Vendor type name is required"));
    }

    const slug = generateSlug(name);

    // Check if slug or name exists
    const existingType = await VendorType.findOne({ $or: [{ name }, { slug }] });
    if (existingType) {
      return next(errorHandler(400, "A vendor type with this name or slug already exists"));
    }

    const typeData: any = {
      name,
      description,
      slug,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-types");
      typeData.image = uploadResult.url;
      typeData.imagePublicId = uploadResult.public_id;
    }

    const vendorType = await VendorType.create(typeData);

    res.status(201).json({
      success: true,
      message: "Vendor type created successfully",
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVendorTypes()`
**Purpose:** List all vendor types with pagination. Sorted by `createdAt` descending (last added first).  
**Access:** Public  
**Validation:** None  
**Process:** Fetch types. Public sees only active ones. Admins can see all via `all=true`.  
**Response:** List of vendor types and pagination metadata

**Controller Implementation:**
```typescript
export const getVendorTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // For public view, only show active types unless 'all' is requested by an admin
    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const vendorTypes = await VendorType.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await VendorType.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        vendorTypes,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalTypes: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVendorTypeById()`
**Purpose:** Get vendor type details by ID or slug  
**Access:** Public  
**Validation:** Vendor type must exist  
**Process:** Find type by ID or slug  
**Response:** Vendor type details

**Controller Implementation:**
```typescript
export const getVendorTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idOrSlug = req.params.idOrSlug as string;
    let vendorType;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      vendorType = await VendorType.findById(idOrSlug);
    } else {
      vendorType = await VendorType.findOne({ slug: idOrSlug });
    }

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    res.status(200).json({
      success: true,
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateVendorType()`
**Purpose:** Update vendor type details or image  
**Access:** Super Admin  
**Validation:** Vendor type must exist  
**Process:** Update fields, regenerate slug if name changes, handle image replacement on Cloudinary  
**Response:** Updated vendor type

**Controller Implementation:**
```typescript
export const updateVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image } = req.body;
    const vendorType = await VendorType.findById(req.params.vendorTypeId);

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    if (name) {
      vendorType.name = name;
      vendorType.slug = generateSlug(name);

      // Check for slug conflict
      const existing = await VendorType.findOne({ slug: vendorType.slug, _id: { $ne: vendorType._id } });
      if (existing) {
        return next(errorHandler(400, "A vendor type with this name already exists"));
      }
    }
    
    if (description !== undefined) vendorType.description = description;
    if (isActive !== undefined) vendorType.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-types");
      if (vendorType.imagePublicId) {
        await deleteFromCloudinary(vendorType.imagePublicId);
      }
      vendorType.image = uploadResult.url;
      vendorType.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (vendorType.imagePublicId) {
        await deleteFromCloudinary(vendorType.imagePublicId);
      }
      vendorType.image = null;
      vendorType.imagePublicId = null;
    }

    await vendorType.save();

    res.status(200).json({
      success: true,
      message: "Vendor type updated successfully",
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteVendorType()`
**Purpose:** Delete a vendor type  
**Access:** Super Admin  
**Validation:** Vendor type must exist  
**Process:** Delete record and its associated image from Cloudinary  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendorType = await VendorType.findById(req.params.vendorTypeId);

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    if (vendorType.imagePublicId) {
      await deleteFromCloudinary(vendorType.imagePublicId);
    }

    await vendorType.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor type deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Vendor Type Routes

### Base Path: `/api/vendor-types`

```typescript
GET    /                          // Get all vendor types (Public)
GET    /:idOrSlug                 // Get vendor type details (Public)
POST   /                          // Create vendor type (Super Admin)
PUT    /:vendorTypeId             // Update vendor type (Super Admin)
DELETE /:vendorTypeId             // Delete vendor type (Super Admin)
```

### Router Implementation

**File: `src/routes/vendorTypeRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createVendorType,
  getVendorTypes,
  getVendorTypeById,
  updateVendorType,
  deleteVendorType
} from '../controllers/vendorTypeController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorType);
router.get('/', optionalAuthenticateToken, getVendorTypes);
router.get('/:idOrSlug', getVendorTypeById);
router.put('/:vendorTypeId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorType);
router.delete('/:vendorTypeId', authenticateToken, authorizeRoles(['super_admin']), deleteVendorType);

export default router;
```

### Route Details

#### `GET /api/vendor-types`
**Headers:**
- **Authorization:** Bearer <token> (Optional)
**Query Parameters:**
- **search:** string (Optional)
- **all:** boolean (Optional, Admin only)
- **page:** number (Default: 1)
- **limit:** number (Default: 10)
**Response Body:**
```json
{
  "success": true,
  "data": {
    "vendorTypes": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Product Vendor",
        "description": "Vendors selling physical products",
        "slug": "product-vendor",
        "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/product.jpg",
        "imagePublicId": "dohez/vendor-types/product_img_123",
        "isActive": true,
        "createdAt": "2026-05-20T10:30:00.000Z",
        "updatedAt": "2026-05-20T10:30:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTypes": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/vendor-types/:idOrSlug`
**Parameters:**
- **idOrSlug:** string (ID or Slug)
**Response Body:**
```json
{
  "success": true,
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef123",
      "name": "Product Vendor",
      "description": "Vendors selling physical products",
      "slug": "product-vendor",
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/product.jpg",
      "imagePublicId": "dohez/vendor-types/product_img_123",
      "isActive": true,
      "createdAt": "2026-05-20T10:30:00.000Z",
      "updatedAt": "2026-05-20T10:30:00.000Z",
      "__v": 0
    }
  }
}
```

#### `POST /api/vendor-types`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
- **Content-Type:** multipart/form-data
**Request Body (Multipart):**
- **name:** string (Required)
- **description:** string (Optional)
- **isActive:** boolean (Optional)
- **image:** file (Optional)
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type created successfully",
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef124",
      "name": "Service Vendor",
      "description": "Vendors providing specialized services",
      "slug": "service-vendor",
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/service.jpg",
      "imagePublicId": "dohez/vendor-types/service_img_456",
      "isActive": true,
      "createdAt": "2026-05-25T14:15:00.000Z",
      "updatedAt": "2026-05-25T14:15:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/vendor-types/:vendorTypeId`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
- **Content-Type:** multipart/form-data
**Parameters:**
- **vendorTypeId:** string
**Request Body (Multipart):**
- **name:** string (Optional)
- **description:** string (Optional)
- **isActive:** boolean (Optional)
- **image:** file (Optional)
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type updated successfully",
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef123",
      "name": "Physical Product Vendor",
      "description": "Updated description for physical product vendors",
      "slug": "physical-product-vendor",
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/updated_product.jpg",
      "imagePublicId": "dohez/vendor-types/updated_product_img_789",
      "isActive": true,
      "createdAt": "2026-05-20T10:30:00.000Z",
      "updatedAt": "2026-05-25T15:20:00.000Z",
      "__v": 1
    }
  }
}
```

#### `DELETE /api/vendor-types/:vendorTypeId`
**Headers:**
- **Authorization:** Bearer <super_admin_token>
**Parameters:**
- **vendorTypeId:** string
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorType);
```

#### `optionalAuthenticateToken`
**Purpose:** Optionally verify JWT token to identify user without enforcing authentication  
**Usage:**
```typescript
router.get('/', optionalAuthenticateToken, getVendorTypes);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.put('/:vendorTypeId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorType);
```

---

## 📝 API Examples

### Get All Vendor Types
**Request:**
```bash
curl -X GET "http://localhost:3500/api/vendor-types?page=1&limit=10"
```
**Response Body:**
```json
{
  "success": true,
  "data": {
    "vendorTypes": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Product Vendor",
        "slug": "product-vendor",
        "isActive": true,
        "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/product.jpg"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalTypes": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Vendor Type By ID or Slug
**Request:**
```bash
curl -X GET http://localhost:3500/api/vendor-types/product-vendor
```
**Response Body:**
```json
{
  "success": true,
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef123",
      "name": "Product Vendor",
      "slug": "product-vendor",
      "description": "Vendors selling physical products",
      "isActive": true,
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/product.jpg"
    }
  }
}
```

### Create Vendor Type (Super Admin)
**Request:**
```bash
curl -X POST http://localhost:3500/api/vendor-types \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Service Vendor" \
  -F "description=Professional service providers" \
  -F "isActive=true" \
  -F "image=@/path/to/service.jpg"
```
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type created successfully",
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef124",
      "name": "Service Vendor",
      "slug": "service-vendor",
      "description": "Professional service providers",
      "isActive": true,
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/service.jpg"
    }
  }
}
```

### Update Vendor Type (Super Admin)
**Request:**
```bash
curl -X PUT http://localhost:3500/api/vendor-types/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: multipart/form-data" \
  -F "name=Physical Product Vendor" \
  -F "description=Updated description" \
  -F "image=@/path/to/new_product.jpg"
```
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type updated successfully",
  "data": {
    "vendorType": {
      "_id": "650af1234567890abcdef123",
      "name": "Physical Product Vendor",
      "slug": "physical-product-vendor",
      "description": "Updated description",
      "isActive": true,
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/types/new_product.jpg"
    }
  }
}
```

### Delete Vendor Type (Super Admin)
**Request:**
```bash
curl -X DELETE http://localhost:3500/api/vendor-types/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>"
```
**Response Body:**
```json
{
  "success": true,
  "message": "Vendor type deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Write access (`POST`, `PUT`, `DELETE`) is restricted to `super_admin`.
- **Public Access:** Read-only access for all users.
- **Resource Cleanup:** Automatic deletion of Cloudinary assets upon vendor type deletion or image update.

---

## 🚨 Error Handling

Standard error responses:
```json
{ "success": false, "message": "Vendor type not found" }
```

---

## 📊 Database Indexes

```typescript
vendorTypeSchema.index({ isActive: 1 });
vendorTypeSchema.index({ createdAt: -1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
