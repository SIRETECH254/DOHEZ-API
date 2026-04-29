# 🏪 DOHEZ-API - Vendor Management Documentation

## 📋 Table of Contents
- [Vendor Management Overview](#vendor-management-overview)
- [Vendor Model](#-vendor-model)
- [Vendor Controller](#-vendor-controller)
- [Vendor Routes](#-vendor-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Vendor Management Overview

Vendor Management handles the registration, profiling, and operational status of vendors on the platform. Vendors are associated with categories, types, and branches, and are linked to user accounts.

---

## 👤 Vendor Model

### Schema Definition
```typescript
interface IVendor extends Document {
  user: Types.ObjectId | IUser;
  vendorCategory: Types.ObjectId | IVendorCategory;
  vendorType: Types.ObjectId | IVendorType;
  branch: Types.ObjectId | IBranch;
  name: string;
  description?: string;
  phone: string;
  email: string;
  address: string;
  isActive: boolean;
  isVerified: boolean;
  avatar?: string | null;
  avatarPublicId?: string | null;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Vendor.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IVendor } from '../types';

const vendorSchema = new Schema<IVendor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    logo: {
      type: String,
      default: null,
    },
    logoPublicId: {
      type: String,
      default: null,
    },
    cover: {
      type: String,
      default: null,
    },
    coverPublicId: {
      type: String,
      default: null,
    },
    location: {
      name: String,
      address: { type: String, required: true },
      regions: {
        administrative_area_level_3: String,
        administrative_area_level_1: String,
        country: { type: String, required: true },
      },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      place_id: { type: String, required: true },
    },
    branches: [{
      type: Schema.Types.ObjectId,
      ref: 'Branch',
    }],
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    details: {
      type: String,
      trim: true,
    },
    kraPin: {
      type: String,
      default: null,
    },
    regNo: {
      type: String,
      default: null,
    },
    vendorCategory: {
      type: Schema.Types.ObjectId,
      ref: 'VendorCategory',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorSchema.index({ isActive: 1 });
vendorSchema.index({ isVerified: 1 });
vendorSchema.index({ name: 1 });

const Vendor = mongoose.model<IVendor>('Vendor', vendorSchema);

export default Vendor;
```

### Validation Rules
```typescript
user:           { required: true, ref: 'User' }
vendorCategory: { required: true, ref: 'VendorCategory' }
vendorType:     { required: true, ref: 'VendorType' }
branch:         { required: true, ref: 'Branch' }
name:           { required: true, trim: true }
phone:          { required: true }
email:          { required: true }
address:        { required: true }
isActive:       { default: true }
isVerified:     { default: false }
```

---


## 🎮 Vendor Controller

**File:** `src/controllers/vendorController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Vendor from "../models/Vendor";
import Branch from "../models/Branch";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `registerVendor()`
**Purpose:** Register as a new vendor  
**Access:** Private (Authenticated users)  
**Process:** Validates user, creates vendor profile, creates main branch  
**Response:** Success message, vendor, and branch objects

**Controller Implementation:**
```typescript
export const registerVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    if (!req.body) {
      return next(errorHandler(400, "Request body is missing"));
    }
    const { name, description, categoryId, phone, email, location, workingHours } = req.body;
    const userId = (req.user as any)?._id;

    if (!userId) {
      return next(errorHandler(401, "Not authorized to register as vendor"));
    }

    // Check if user is already a vendor
    const existingVendor = await Vendor.findOne({ userId });
    if (existingVendor) {
      return next(errorHandler(400, "User already has a vendor profile"));
    }

    const vendorData: any = {
      userId,
      name,
      details: description,
      vendorCategory: categoryId,
      phone,
      email,
      location: location ? (typeof location === 'string' ? JSON.parse(location) : location) : {},
      slug: name ? name.toLowerCase().replace(/ /g, '-') : '',
    };

    // Handle logo and cover uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendorData.logo = uploadResult.url;
      vendorData.logoPublicId = uploadResult.public_id;
    }
    if (files?.cover) {
      const uploadResult = await uploadToCloudinary(files.cover[0], "dohez/vendors/covers");
      vendorData.cover = uploadResult.url;
      vendorData.coverPublicId = uploadResult.public_id;
    }

    const vendor = await Vendor.create(vendorData);

    // Create default main branch
    const branchData = {
      vendorId: vendor._id,
      name: `${name} - Main Branch`,
      email,
      phone,
      location: vendorData.location,
      workingHours: workingHours ? (typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours) : [],
      isMainBranch: true,
      isActive: true,
    };

    const branch = await Branch.create(branchData);
    
    // Add branch to vendor
    vendor.branches.push(branch._id as any);
    await vendor.save();

    res.status(201).json({
      success: true,
      message: "Vendor registered successfully",
      data: { vendor, branch },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getVendors()`
**Purpose:** List all vendors  
**Access:** Public  
**Process:** Paginate and filter by search. Returns only active and verified vendors.  
**Response:** List of vendors and pagination metadata

**Controller Implementation:**
```typescript
export const getVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query: any = { isActive: true, isVerified: true };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const vendors = await Vendor.find(query)
      .populate('vendorCategory')
      .sort({ name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Vendor.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        vendors,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalVendors: total,
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

#### `getVendorById()`
**Purpose:** Get single vendor by ID  
**Access:** Public  
**Response:** Vendor details

**Controller Implementation:**
```typescript
export const getVendorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId).populate('categoryId');

    if (!vendor) {
      return next(errorHandler(404, "Vendor not found"));
    }

    res.status(200).json({
      success: true,
      data: { vendor },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateVendorProfile()`
**Purpose:** Update vendor profile  
**Access:** Private (Vendor Owner)  
**Process:** Update fields, handle logo/banner uploads  
**Response:** Updated vendor profile

**Controller Implementation:**
```typescript
export const updateVendorProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, categoryId } = req.body;
    const ownerId = (req.user as any)?._id;
    const vendor = await Vendor.findOne({ ownerId });

    if (!vendor) {
      return next(errorHandler(404, "Vendor profile not found"));
    }

    if (name) vendor.name = name;
    if (description !== undefined) vendor.details = description;
    if (categoryId) vendor.vendorCategory = categoryId;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      // Logic for updating logo... (Simplified for now)
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendor.logo = uploadResult.url;
    }
    if (files?.banner) {
      // Logic for updating banner...
      const uploadResult = await uploadToCloudinary(files.banner[0], "dohez/vendors/banners");
      vendor.cover = uploadResult.url;
    }

    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Vendor profile updated successfully",
      data: { vendor },
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteVendor()`
**Purpose:** Delete vendor profile  
**Access:** Private (Admin)  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);

    if (!vendor) {
      return next(errorHandler(404, "Vendor not found"));
    }

    await vendor.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor profile deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Vendor Routes

### Base Path: `/api/vendors`

```typescript
POST   /                  // Create vendor (Auth)
GET    /                  // Get all vendors (Public)
GET    /:vendorId         // Get vendor details (Public)
PUT    /:vendorId         // Update vendor (Auth/Admin)
DELETE /:vendorId         // Delete vendor (Admin)
```

### Router Implementation

**File: `src/routes/vendorRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  createVendor,
  getVendors,
  getVendorById,
  updateVendor,
  deleteVendor
} from '../controllers/vendorController';
import { authenticateToken, authorizeRoles, optionalAuthenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, upload.single('avatar'), createVendor);
router.get('/', optionalAuthenticateToken, getVendors);
router.get('/:vendorId', getVendorById);
router.put('/:vendorId', authenticateToken, upload.single('avatar'), updateVendor);
router.delete('/:vendorId', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteVendor);

export default router;
```

### Route Details

### Route Details

#### `POST /api/vendors/register`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "name": "Quick Laundry",
  "description": "Professional laundry services",
  "categoryId": "650af1234567890abcdef123",
  "phone": "+254700000000",
  "email": "contact@quick.com",
  "location": "{\"address\": \"Street 123\", \"lat\": -1.2921, \"lng\": 36.8219, \"place_id\": \"chIJsx...\"}",
  "workingHours": "{\"monday\": \"08:00-18:00\"}"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor registered successfully",
  "data": {
    "vendor": {
      "id": "650af1234567890abcdef999",
      "name": "Quick Laundry"
    },
    "branch": {
      "id": "650af1234567890abcdef888",
      "name": "Quick Laundry - Main Branch"
    }
  }
}
```

#### `GET /api/vendors`
**Query:** `search=Quick`, `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "_id": "650af1234567890abcdef999",
        "name": "Quick Laundry",
        "email": "contact@quick.com"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalVendors": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/vendors/:vendorId`
**Params:** `vendorId=650af1234567890abcdef999`
**Response:**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "_id": "650af1234567890abcdef999",
      "name": "Quick Laundry",
      "phone": "+254700000000",
      "email": "contact@quick.com"
    }
  }
}
```

#### `PUT /api/vendors/profile`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: multipart/form-data`
**Body:**
```json
{
  "name": "Quick Laundry Pro",
  "description": "Best laundry in town",
  "categoryId": "650af1234567890abcdef123"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Vendor profile updated successfully",
  "data": {
    "vendor": {
      "_id": "650af1234567890abcdef999",
      "name": "Quick Laundry Pro"
    }
  }
}
```

#### `DELETE /api/vendors/:vendorId`
**Headers:** `Authorization: Bearer <admin_token>`
**Params:** `vendorId=650af1234567890abcdef999`
**Response:**
```json
{
  "success": true,
  "message": "Vendor profile deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, upload.single('avatar'), createVendor);
```

#### `optionalAuthenticateToken`
**Purpose:** Optionally verify JWT token to identify user without enforcing authentication  
**Usage:**
```typescript
router.get('/', optionalAuthenticateToken, getVendors);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.delete('/:vendorId', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteVendor);
```

---

## 📝 API Examples

### 1. Register as Vendor
**Endpoint:** `POST /api/vendors`  
**Access:** Private (Authenticated Users)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/vendors \
  -H "Authorization: Bearer <access_token>" \
  -F "name=Quick Laundry" \
  -F "description=Professional laundry services" \
  -F "categoryId=650af1234567890abcdef123" \
  -F "phone=+254700000000" \
  -F "email=contact@quick.com" \
  -F "location={\"address\": \"Street 123\", \"lat\": -1.2921, \"lng\": 36.8219, \"place_id\": \"chIJsx...\"}" \
  -F "workingHours={\"monday\": \"08:00-18:00\"}" \
  -F "logo=@/path/to/logo.jpg" \
  -F "cover=@/path/to/cover.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Vendor registered successfully",
  "data": {
    "vendor": {
      "_id": "650af1234567890abcdef999",
      "name": "Quick Laundry"
    },
    "branch": {
      "_id": "650af1234567890abcdef888",
      "name": "Quick Laundry - Main Branch"
    }
  }
}
```

### 2. Get All Vendors
**Endpoint:** `GET /api/vendors`  
**Access:** Public

**Request Example:**
```bash
curl -X GET "http://localhost:3500/api/vendors?search=Quick&page=1&limit=10"
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "vendors": [
      {
        "_id": "650af1234567890abcdef999",
        "name": "Quick Laundry",
        "email": "contact@quick.com"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalVendors": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### 3. Get Single Vendor
**Endpoint:** `GET /api/vendors/:vendorId`  
**Access:** Public

**Request Example:**
```bash
curl -X GET http://localhost:3500/api/vendors/650af1234567890abcdef999
```

**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "vendor": {
      "_id": "650af1234567890abcdef999",
      "name": "Quick Laundry",
      "phone": "+254700000000",
      "email": "contact@quick.com"
    }
  }
}
```

### 4. Update Vendor Profile
**Endpoint:** `PUT /api/vendors/profile`  
**Access:** Private (Vendor Owner)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/vendors/profile \
  -H "Authorization: Bearer <access_token>" \
  -F "name=Quick Laundry Pro" \
  -F "description=Best laundry in town" \
  -F "categoryId=650af1234567890abcdef123"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vendor profile updated successfully",
  "data": {
    "vendor": {
      "_id": "650af1234567890abcdef999",
      "name": "Quick Laundry Pro"
    }
  }
}
```

### 5. Delete Vendor
**Endpoint:** `DELETE /api/vendors/:vendorId`  
**Access:** Private (Admin)

**Request Example:**
```bash
curl -X DELETE http://localhost:3500/api/vendors/650af1234567890abcdef999 \
  -H "Authorization: Bearer <admin_token>"
```

**Response (200 OK):**
```json
{
  "success": true,
  "message": "Vendor profile deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Protected routes for creation and deletion.
- **Verification:** `isVerified` flag for platform validation.
- **Storage:** Secure image handling via Cloudinary.

---

## 🚨 Error Handling

Standard error: `{ "success": false, "message": "..." }`

---

## 📊 Database Indexes

```typescript
vendorSchema.index({ vendorCategory: 1 });
vendorSchema.index({ vendorType: 1 });
vendorSchema.index({ isActive: 1 });
```

---
**Last Updated:** April 2026  
**Version:** 1.0.0
