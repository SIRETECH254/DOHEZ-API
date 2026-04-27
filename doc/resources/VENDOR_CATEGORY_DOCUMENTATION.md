# 🏢 DOHEZ-API - Vendor Category Management Documentation

## 📋 Table of Contents
- [Vendor Category Overview](#vendor-category-overview)
- [Vendor Category Model](#-vendor-category-model)
- [Vendor Category Controller](#-vendor-category-controller)
- [Vendor Category Routes](#-vendor-category-routes)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Vendor Category Overview

Vendor Category Management allows administrators to define categories for vendors (e.g., "Food", "Laundry", "Logistics"). These categories help in grouping vendors and providing a better search experience for customers.

---

## 🏢 Vendor Category Model

### Schema Definition
```typescript
interface IVendorCategory extends Document {
  vendorType?: Types.ObjectId | IVendorType;
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

**File: `src/models/VendorCategory.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IVendorCategory } from '../types';

const vendorCategorySchema = new Schema<IVendorCategory>(
  {
    vendorType: {
      type: Schema.Types.ObjectId,
      ref: 'VendorType',
      default: null,
    },
    name: {
      type: String,
      required: true,
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
vendorCategorySchema.index({ isActive: 1 });

const VendorCategory = mongoose.model<IVendorCategory>('VendorCategory', vendorCategorySchema);

export default VendorCategory;
```

### Validation Rules
```typescript
name:        { required: true, trim: true }
description: { optional, trim: true }
slug:        { required: true, unique: true, lowercase: true, trim: true }
isActive:    { default: true }
```

---

## 🎮 Vendor Category Controller

**File:** `src/controllers/vendorCategoryController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import VendorCategory from "../models/VendorCategory";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `createVendorCategory()`
**Purpose:** Create a new category  
**Access:** Super Admin  
**Process:** Generate slug from name, upload image to Cloudinary  
**Response:** Created category object

**Controller Implementation:**
```typescript
export const createVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, vendorType } = req.body;

    if (!name) {
      return next(errorHandler(400, "Category name is required"));
    }

    const slug = generateSlug(name);

    // Check if slug exists
    const existingCategory = await VendorCategory.findOne({ slug });
    if (existingCategory) {
      return next(errorHandler(400, "A category with this name already exists (slug conflict)"));
    }

    const categoryData: any = {
      name,
      description,
      slug,
      vendorType: vendorType || null,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-categories");
      categoryData.image = uploadResult.url;
      categoryData.imagePublicId = uploadResult.public_id;
    }

    const category = await VendorCategory.create(categoryData);

    res.status(201).json({
      success: true,
      message: "Vendor category created successfully",
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVendorCategories()`
**Purpose:** List categories with pagination, search, and sorting  
**Access:** Public  
**Query Params:** `page`, `limit`, `search`, `sort` (name, createdAt), `order` (asc, desc)  
**Response:** List of categories and pagination metadata

**Controller Implementation:**
```typescript
export const getVendorCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, page = 1, limit = 10, sort = "createdAt", order = "desc" } = req.query;
    const query: any = {};

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
      limit: parseInt(limit as string, 10) || 10,
      sort: sort as string,
      order: order === "asc" ? 1 : -1
    };

    const categories = await VendorCategory.find(query)
      .populate('vendorType')
      .sort({ [options.sort]: options.order as any })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await VendorCategory.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalCategories: total,
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

#### `getVendorCategoryById()`
**Purpose:** Get category details by ID or slug  
**Access:** Public  
**Response:** Category object

**Controller Implementation:**
```typescript
export const getVendorCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idOrSlug = req.params.idOrSlug as string;
    let category;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      category = await VendorCategory.findById(idOrSlug).populate('vendorType');
    } else {
      category = await VendorCategory.findOne({ slug: idOrSlug }).populate('vendorType');
    }

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateVendorCategory()`
**Purpose:** Update category details and image  
**Access:** Super Admin  
**Process:** Update fields, handle image replacement on Cloudinary  
**Response:** Updated category object

**Controller Implementation:**
```typescript
export const updateVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image, vendorType } = req.body;
    const category = await VendorCategory.findById(req.params.categoryId);

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    if (name) {
      category.name = name;
      category.slug = generateSlug(name);
      
      // Check if new slug conflicts with another category
      const existing = await VendorCategory.findOne({ slug: category.slug, _id: { $ne: category._id } });
      if (existing) {
        return next(errorHandler(400, "A category with this name already exists"));
      }
    }
    
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;
    if (vendorType !== undefined) category.vendorType = vendorType;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-categories");
      if (category.imagePublicId) {
        await deleteFromCloudinary(category.imagePublicId);
      }
      category.image = uploadResult.url;
      category.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (category.imagePublicId) {
        await deleteFromCloudinary(category.imagePublicId);
      }
      category.image = null;
      category.imagePublicId = null;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Vendor category updated successfully",
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteVendorCategory()`
**Purpose:** Delete a category  
**Access:** Super Admin  
**Process:** Delete from DB and remove image from Cloudinary  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await VendorCategory.findById(req.params.categoryId);

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    if (category.imagePublicId) {
      await deleteFromCloudinary(category.imagePublicId);
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor category deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Vendor Category Routes

### Base Path: `/api/vendor-categories`

```typescript
POST   /                  // Create category (Super Admin)
GET    /                  // Get all categories (Public)
GET    /:idOrSlug         // Get category by ID or slug (Public)
PUT    /:categoryId       // Update category (Super Admin)
DELETE /:categoryId       // Delete category (Super Admin)
```

### Router Implementation

**File: `src/routes/vendorCategoryRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createVendorCategory,
  getVendorCategories,
  getVendorCategoryById,
  updateVendorCategory,
  deleteVendorCategory
} from '../controllers/vendorCategoryController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorCategory);
router.get('/', optionalAuthenticateToken, getVendorCategories);
router.get('/:idOrSlug', getVendorCategoryById);
router.put('/:categoryId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorCategory);
router.delete('/:categoryId', authenticateToken, authorizeRoles(['super_admin']), deleteVendorCategory);

export default router;
```

### Route Details

#### `POST /api/vendor-categories`
**Headers:** `Authorization: Bearer <super_admin_token>`, `Content-Type: multipart/form-data`
**Body (JSON representation):**
```json
{
  "name": "Food & Drinks",
  "description": "Restaurants, cafes and beverage providers",
  "isActive": true,
  "image": "category_image.jpg"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor category created successfully",
  "data": {
    "category": {
      "_id": "650af1234567890abcdef123",
      "name": "Food & Drinks",
      "slug": "food-drinks",
      "description": "Restaurants, cafes and beverage providers",
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/categories/food.jpg",
      "isActive": true,
      "createdAt": "2026-04-27T10:00:00.000Z",
      "updatedAt": "2026-04-27T10:00:00.000Z"
    }
  }
}
```

#### `GET /api/vendor-categories`
**Query Params:** `page=1`, `limit=10`, `search=food`, `sort=name`, `order=asc`
**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Food & Drinks",
        "slug": "food-drinks",
        "image": "https://res.cloudinary.com/dohez/image/upload/v1/categories/food.jpg",
        "isActive": true
      },
      {
        "_id": "650af1234567890abcdef456",
        "name": "Laundry",
        "slug": "laundry",
        "image": "https://res.cloudinary.com/dohez/image/upload/v1/categories/laundry.jpg",
        "isActive": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCategories": 2,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/vendor-categories/:idOrSlug`
**Params:** `idOrSlug` (e.g., `food-drinks` or `650af1234567890abcdef123`)
**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef123",
      "name": "Food & Drinks",
      "slug": "food-drinks",
      "description": "Restaurants, cafes and beverage providers",
      "image": "https://res.cloudinary.com/dohez/image/upload/v1/categories/food.jpg",
      "isActive": true
    }
  }
}
```

#### `PUT /api/vendor-categories/:categoryId`
**Headers:** `Authorization: Bearer <super_admin_token>`, `Content-Type: multipart/form-data`
**Params:** `categoryId`
**Body (JSON representation):**
```json
{
  "name": "Food & Beverages",
  "isActive": true
}
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor category updated successfully",
  "data": {
    "category": {
      "_id": "650af1234567890abcdef123",
      "name": "Food & Beverages",
      "slug": "food-beverages",
      "isActive": true
    }
  }
}
```

#### `DELETE /api/vendor-categories/:categoryId`
**Headers:** `Authorization: Bearer <super_admin_token>`
**Params:** `categoryId`
**Response:**
```json
{
  "success": true,
  "message": "Vendor category deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), createVendorCategory);
```

#### `optionalAuthenticateToken`
**Purpose:** Optionally verify JWT token to identify user for administrative views (e.g., viewing inactive categories)  
**Usage:**
```typescript
router.get('/', optionalAuthenticateToken, getVendorCategories);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Restrict access to specific roles (e.g., Super Admin for write operations)  
**Usage:**
```typescript
router.put('/:categoryId', authenticateToken, authorizeRoles(['super_admin']), upload.single('image'), updateVendorCategory);
```

---

## 📝 API Examples

### Create Vendor Category
**Request:**
```bash
curl -X POST http://localhost:3500/api/vendor-categories \
  -H "Authorization: Bearer <super_admin_token>" \
  -F "name=Logistics" \
  -F "description=Delivery and transport services" \
  -F "vendorType=650af1234567890abcdef789" \
  -F "image=@/path/to/logistics.jpg"
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor category created successfully",
  "data": {
    "category": {
      "_id": "650af9876543210fedcba321",
      "name": "Logistics",
      "slug": "logistics",
      "vendorType": "650af1234567890abcdef789",
      "image": "https://cloudinary.com/logistics.jpg"
    }
  }
}
```

### Get All Categories
**Request:**
```bash
curl -X GET "http://localhost:3500/api/vendor-categories?page=1&limit=5"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "_id": "650af1234567890abcdef123",
        "name": "Food & Drinks",
        "slug": "food-drinks",
        "vendorType": {
          "_id": "650af1234567890abcdef789",
          "name": "Product Vendor",
          "slug": "product-vendor"
        }
      },
      {
        "_id": "650af1234567890abcdef456",
        "name": "Laundry",
        "slug": "laundry",
        "vendorType": {
          "_id": "650af1234567890abcdef999",
          "name": "Service Vendor",
          "slug": "service-vendor"
        }
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCategories": 2
    }
  }
}
```

### Get Category By ID
**Request:**
```bash
curl -X GET http://localhost:3500/api/vendor-categories/food-drinks
```
**Response:**
```json
{
  "success": true,
  "data": {
    "category": {
      "_id": "650af1234567890abcdef123",
      "name": "Food & Drinks",
      "slug": "food-drinks",
      "vendorType": {
        "_id": "650af1234567890abcdef789",
        "name": "Product Vendor",
        "slug": "product-vendor"
      }
    }
  }
}
```

### Update Category
**Request:**
```bash
curl -X PUT http://localhost:3500/api/vendor-categories/650af1234567890abcdef123 \
  -H "Authorization: Bearer <super_admin_token>" \
  -F "name=Gourmet Food" \
  -F "vendorType=650af1234567890abcdef789"
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor category updated successfully",
  "data": {
    "category": {
      "_id": "650af1234567890abcdef123",
      "name": "Gourmet Food",
      "slug": "gourmet-food",
      "vendorType": "650af1234567890abcdef789"
    }
  }
}
```

### Delete Category
**Request:**
```bash
curl -X DELETE http://localhost:3500/api/vendor-categories/650af1234567890abcdef123 \
  -H "Authorization: Bearer <super_admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor category deleted successfully"
}
```

## 🛡️ Security Features

- **RBAC:** Write operations (`POST`, `PUT`, `DELETE`) are restricted to `super_admin`.
- **Public Access:** Read operations (`GET`) are public.
- **Slug Integrity:** Slugs are unique and automatically generated from names.

---

## 🚨 Error Handling

Standard error responses:
```json
{ "success": false, "message": "Vendor category not found" }
```

---

## 📊 Database Indexes

```typescript
vendorCategorySchema.index({ isActive: 1 });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
