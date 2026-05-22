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
  userId: Types.ObjectId | IUser;
  vendorCategory: Types.ObjectId | IVendorCategory;
  service: Types.ObjectId | IService;
  branches: Types.ObjectId[] | IBranch[];
  name: string;
  details?: string;
  phone: string;
  email: string;
  isActive: boolean;
  isVerified: boolean;
  isFeatured: boolean;
  logo?: string | null;
  logoPublicId?: string | null;
  cover?: string | null;
  coverPublicId?: string | null;
  location: any;
  slug: string;
  kraPin?: string | null;
  regNo?: string | null;
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
      address: { type: String },
      regions: {
        administrative_area_level_3: String,
        administrative_area_level_1: String,
        country: { type: String },
      },
      coordinates: {
        lat: { type: Number },
        lng: { type: Number },
      },
      place_id: { type: String },
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

const Vendor = mongoose.model<IVendor>('Vendor', vendorSchema);

export default Vendor;
```

### Validation Rules
```typescript
userId:         { required: true, ref: 'User' }
vendorCategory: { required: true, ref: 'VendorCategory' }
name:           { required: true, trim: true }
phone:          { required: true }
email:          { required: true }
isActive:       { default: true }
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
import User from "../models/User";
import Role from "../models/Role";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";
```

### Functions Overview

#### `registerVendor()`
**Purpose:** Register as a new vendor  
**Access:** Private (Super Admin)  
**Process:** Validates userId in body, creates vendor profile, creates main branch  
**Response:** Success message, vendor, and branch objects

**Controller Implementation:**
```typescript
export const registerVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, name, description, categoryId, phone, email, location, workingHours } = req.body;

    if (!userId) {
      return next(errorHandler(400, "User ID is required in request body"));
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

    // Handle logo and banner uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendorData.logo = uploadResult.url;
      vendorData.logoPublicId = uploadResult.public_id;
    }
    if (files?.banner) {
      const uploadResult = await uploadToCloudinary(files.banner[0], "dohez/vendors/covers");
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

    // Assign Role and Vendor to User
    const vendorAdminRole = await Role.findOne({ name: 'vendor_admin' });
    if (vendorAdminRole) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { roles: vendorAdminRole._id },
        vendor: vendor._id,
      });
    }

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
**Process:** Paginate and filter by search. Returns only active vendors.  
**Response:** List of vendors and pagination metadata

**Controller Implementation:**
```typescript
export const getVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query: any = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const vendors = await Vendor.find(query)
      .populate('vendorCategory')
      .populate('branches')
      .sort({ createdAt: -1 })
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
    const vendor = await Vendor.findById(req.params.vendorId)
      .populate('vendorCategory')
      .populate('branches');

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
**Access:** Private (Super Admin / Admin)  
**Process:** Update fields, handle logo/banner uploads  
**Response:** Updated vendor profile

**Controller Implementation:**
```typescript
export const updateVendorProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, categoryId } = req.body;
    const { vendorId } = req.params;
    const userRole = (req.user as any)?.role;

    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return next(errorHandler(403, "Not authorized to update vendor"));
    }

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return next(errorHandler(404, "Vendor profile not found"));
    }

    if (name) vendor.name = name;
    if (description !== undefined) vendor.details = description;
    if (categoryId) vendor.vendorCategory = categoryId;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendor.logo = uploadResult.url;
    }
    if (files?.banner) {
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

    // Delete associated branches
    await Branch.deleteMany({ vendorId: vendor._id });
    await vendor.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor profile and associated branches deleted successfully",
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
POST   /register          // Register vendor (Super Admin)
GET    /                  // Get all vendors (Public)
GET    /:vendorId         // Get vendor details (Public)
PUT    /:vendorId         // Update vendor (Admin/Super Admin)
DELETE /:vendorId         // Delete vendor (Admin)
```

### Router Implementation

**File: `src/routes/vendorRoutes.ts`**

```typescript
import express from 'express';
import upload from '../middleware/upload';
import {
  registerVendor,
  getVendors,
  getVendorById,
  updateVendorProfile,
  deleteVendor
} from '../controllers/vendorController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/register', authenticateToken, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), registerVendor);
router.get('/', getVendors);
router.get('/:vendorId', getVendorById);
router.put('/:vendorId', authenticateToken, authorizeRoles(['super_admin', 'admin']), upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), updateVendorProfile);
router.delete('/:vendorId', authenticateToken, authorizeRoles(['super_admin']), deleteVendor);

export default router;
```

### Route Details

#### `POST /api/vendors/register`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "userId": "65e26b1c09b068c201383801",
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
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry",
      "details": "Professional laundry services",
      "vendorCategory": "650af1234567890abcdef123",
      "phone": "+254700000000",
      "email": "contact@quick.com",
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "place_id": "chIJsx..."
      },
      "branches": [
        "650af1234567890abcdef888"
      ],
      "slug": "quick-laundry",
      "isActive": true,
      "isFeatured": false,
      "logo": null,
      "logoPublicId": null,
      "cover": null,
      "coverPublicId": null,
      "_id": "650af1234567890abcdef999",
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 1
    },
    "branch": {
      "vendorId": "650af1234567890abcdef999",
      "name": "Quick Laundry - Main Branch",
      "email": "contact@quick.com",
      "phone": "+254700000000",
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "place_id": "chIJsx..."
      },
      "workingHours": {
        "monday": "08:00-18:00"
      },
      "isMainBranch": true,
      "isActive": true,
      "gallery": [],
      "_id": "650af1234567890abcdef888",
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 0
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
        "userId": "65e26b1c09b068c201383801",
        "name": "Quick Laundry",
        "phone": "+254700000000",
        "email": "contact@quick.com",
        "isActive": true,
        "isFeatured": false,
        "logo": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/logos/quick.jpg",
        "logoPublicId": "vendors/logos/quick",
        "cover": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/covers/quick_cover.jpg",
        "coverPublicId": "vendors/covers/quick_cover",
        "location": {
          "address": "Street 123",
          "regions": {
            "country": "Kenya"
          },
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          },
          "place_id": "chIJsx..."
        },
        "branches": [
          {
            "_id": "650af1234567890abcdef888",
            "vendorId": "650af1234567890abcdef999",
            "name": "Quick Laundry - Main Branch",
            "email": "contact@quick.com",
            "phone": "+254700000000",
            "location": {
              "address": "Street 123",
              "regions": {
                "country": "Kenya"
              },
              "coordinates": {
                "lat": -1.2921,
                "lng": 36.8219
              }
            },
            "isMainBranch": true,
            "isActive": true
          }
        ],
        "slug": "quick-laundry",
        "details": "Professional laundry services",
        "vendorCategory": {
          "_id": "650af1234567890abcdef123",
          "name": "Laundry",
          "slug": "laundry"
        },
        "createdAt": "2026-05-07T10:00:00.000Z",
        "updatedAt": "2026-05-07T10:00:00.000Z",
        "__v": 1
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
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry",
      "phone": "+254700000000",
      "email": "contact@quick.com",
      "isActive": true,
      "isFeatured": false,
      "logo": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/logos/quick.jpg",
      "logoPublicId": "vendors/logos/quick",
      "cover": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/covers/quick_cover.jpg",
      "coverPublicId": "vendors/covers/quick_cover",
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "place_id": "chIJsx..."
      },
      "branches": [
        {
          "_id": "650af1234567890abcdef888",
          "vendorId": "650af1234567890abcdef999",
          "name": "Quick Laundry - Main Branch",
          "email": "contact@quick.com",
          "phone": "+254700000000",
          "location": {
            "address": "Street 123",
            "regions": {
              "country": "Kenya"
            },
            "coordinates": {
              "lat": -1.2921,
              "lng": 36.8219
            }
          },
          "isMainBranch": true,
          "isActive": true,
          "workingHours": {
            "monday": "08:00-18:00"
          }
        }
      ],
      "slug": "quick-laundry",
      "details": "Professional laundry services",
      "vendorCategory": {
        "_id": "650af1234567890abcdef123",
        "name": "Laundry",
        "slug": "laundry"
      },
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `PUT /api/vendors/:vendorId`
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
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry Pro",
      "details": "Best laundry in town",
      "vendorCategory": "650af1234567890abcdef123",
      "slug": "quick-laundry-pro",
      "updatedAt": "2026-05-07T11:00:00.000Z"
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
  "message": "Vendor profile and associated branches deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/register', authenticateToken, upload.fields([{ name: 'logo', maxCount: 1 }, { name: 'banner', maxCount: 1 }]), registerVendor);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.delete('/:vendorId', authenticateToken, authorizeRoles(['super_admin']), deleteVendor);
```

---

## 📝 API Examples

### 1. Register as Vendor
**Endpoint:** `POST /api/vendors/register`  
**Access:** Private (Super Admin)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/vendors/register \
  -H "Authorization: Bearer <access_token>" \
  -F "userId=65e26b1c09b068c201383801" \
  -F "name=Quick Laundry" \
  -F "description=Professional laundry services" \
  -F "categoryId=650af1234567890abcdef123" \
  -F "phone=+254700000000" \
  -F "email=contact@quick.com" \
  -F "location={\"address\": \"Street 123\", \"lat\": -1.2921, \"lng\": 36.8219, \"place_id\": \"chIJsx...\"}" \
  -F "workingHours={\"monday\": \"08:00-18:00\"}" \
  -F "logo=@/path/to/logo.jpg" \
  -F "banner=@/path/to/banner.jpg"
```

**Response (201 Created):**
```json
{
  "success": true,
  "message": "Vendor registered successfully",
  "data": {
    "vendor": {
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry",
      "details": "Professional laundry services",
      "vendorCategory": "650af1234567890abcdef123",
      "phone": "+254700000000",
      "email": "contact@quick.com",
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "place_id": "chIJsx..."
      },
      "branches": [
        "650af1234567890abcdef888"
      ],
      "slug": "quick-laundry",
      "isActive": true,
      "_id": "650af1234567890abcdef999",
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 1
    },
    "branch": {
      "vendorId": "650af1234567890abcdef999",
      "name": "Quick Laundry - Main Branch",
      "email": "contact@quick.com",
      "phone": "+254700000000",
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        },
        "place_id": "chIJsx..."
      },
      "workingHours": {
        "monday": "08:00-18:00"
      },
      "isMainBranch": true,
      "isActive": true,
      "_id": "650af1234567890abcdef888",
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 0
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
        "userId": "65e26b1c09b068c201383801",
        "name": "Quick Laundry",
        "phone": "+254700000000",
        "email": "contact@quick.com",
        "isActive": true,
        "isFeatured": false,
        "logo": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/logos/quick.jpg",
        "cover": "https://res.cloudinary.com/dohez/image/upload/v1/vendors/covers/quick_cover.jpg",
        "location": {
          "address": "Street 123",
          "regions": {
            "country": "Kenya"
          },
          "coordinates": {
            "lat": -1.2921,
            "lng": 36.8219
          }
        },
        "branches": [
          {
            "_id": "650af1234567890abcdef888",
            "name": "Quick Laundry - Main Branch",
            "location": {
              "address": "Street 123",
              "lat": -1.2921,
              "lng": 36.8219
            }
          }
        ],
        "slug": "quick-laundry",
        "details": "Professional laundry services",
        "vendorCategory": {
          "_id": "650af1234567890abcdef123",
          "name": "Laundry",
          "slug": "laundry"
        },
        "createdAt": "2026-05-07T10:00:00.000Z",
        "updatedAt": "2026-05-07T10:00:00.000Z",
        "__v": 1
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
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry",
      "phone": "+254700000000",
      "email": "contact@quick.com",
      "isActive": true,
      "location": {
        "address": "Street 123",
        "regions": {
          "country": "Kenya"
        },
        "coordinates": {
          "lat": -1.2921,
          "lng": 36.8219
        }
      },
      "branches": [
        {
          "_id": "650af1234567890abcdef888",
          "name": "Quick Laundry - Main Branch",
          "location": {
            "address": "Street 123",
            "lat": -1.2921,
            "lng": 36.8219
          },
          "workingHours": {
            "monday": "08:00-18:00"
          }
        }
      ],
      "slug": "quick-laundry",
      "details": "Professional laundry services",
      "vendorCategory": {
        "_id": "650af1234567890abcdef123",
        "name": "Laundry",
        "slug": "laundry"
      },
      "createdAt": "2026-05-07T10:00:00.000Z",
      "updatedAt": "2026-05-07T10:00:00.000Z",
      "__v": 1
    }
  }
}
```

### 4. Update Vendor Profile
**Endpoint:** `PUT /api/vendors/:vendorId`  
**Access:** Private (Super Admin / Admin)  
**Content-Type:** `multipart/form-data`

**Request Example:**
```bash
curl -X PUT http://localhost:3500/api/vendors/650af1234567890abcdef999 \
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
      "userId": "65e26b1c09b068c201383801",
      "name": "Quick Laundry Pro",
      "details": "Best laundry in town",
      "vendorCategory": "650af1234567890abcdef123",
      "slug": "quick-laundry-pro",
      "updatedAt": "2026-05-07T11:00:00.000Z"
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
  "message": "Vendor profile and associated branches deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Protected routes for creation and deletion.
- **Verification:** `isActive` flag for platform status.
- **Storage:** Secure image handling via Cloudinary.

---

## 🚨 Error Handling

Standard error: `{ "success": false, "message": "..." }`

---

## 📊 Database Indexes

```typescript
vendorSchema.index({ isActive: 1 });
vendorSchema.index({ name: 1 });
```

---
**Last Updated:** May 2026  
**Version:** 1.1.0

