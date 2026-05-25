# 📍 DOHEZ-API - Branch Management Documentation

## 📋 Table of Contents
- [Branch Management Overview](#branch-management-overview)
- [Branch Model](#-branch-model)
- [Branch Controller](#-branch-controller)
- [Branch Routes](#-branch-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Branch Management Overview

Branch Management allows vendors to maintain multiple operational locations (e.g., Downtown, Uptown branches). Each branch has its own location, working hours, and contact details.

---

## 👤 Branch Model

### Schema Definition
```typescript
interface IBranch extends Document {
  vendorId: Types.ObjectId | IVendor;
  name: string;
  email: string;
  phone: string;
  location: {
    address: string;
    coordinates: { lat: number; lng: number };
    place_id?: string;
  };
  cover?: string | null;
  coverPublicId?: string | null;
  workingHours: {
    monday: { start: string; end: string };
    tuesday: { start: string; end: string };
    wednesday: { start: string; end: string };
    thursday: { start: string; end: string };
    friday: { start: string; end: string };
    saturday: { start: string; end: string };
    sunday: { start: string; end: string };
  };
  gallery: { url: string; publicId: string }[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Branch.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IBranch } from '../types';

const branchSchema = new Schema<IBranch>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    location: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      place_id: String,
    },
    cover: {
      type: String,
      default: null,
    },
    coverPublicId: {
      type: String,
      default: null,
    },
    workingHours: {
      monday: { start: String, end: String },
      tuesday: { start: String, end: String },
      wednesday: { start: String, end: String },
      thursday: { start: String, end: String },
      friday: { start: String, end: String },
      saturday: { start: String, end: String },
      sunday: { start: String, end: String },
    },
    gallery: [{
      url: String,
      publicId: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
branchSchema.index({ vendorId: 1 });
branchSchema.index({ location: '2dsphere' });

const Branch = mongoose.model<IBranch>('Branch', branchSchema);

export default Branch;
```

### Validation Rules
```typescript
vendorId:     { required: true, ref: 'Vendor' }
name:         { required: true, trim: true }
email:        { required: true, lowercase: true }
phone:        { required: true }
location:     { address: required, coordinates: required }
```

---

## 🎮 Branch Controller

**File:** `src/controllers/branchController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Branch from "../models/Branch";
import Vendor from "../models/Vendor";
```

### Functions Overview

#### `createBranch()`
**Purpose:** Create a new branch  
**Access:** Private (Vendor Owner)  
**Process:** Validates vendor, creates branch record, and links it to the vendor  
**Response:** Created branch object

**Controller Implementation:**
```typescript
export const createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, name, email, phone, location, workingHours, managerId } = req.body;
    
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    const branchData: any = {
      vendorId,
      name,
      email,
      phone,
      location: typeof location === 'string' ? JSON.parse(location) : location,
      workingHours: typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours,
    };

    const branch = await Branch.create(branchData);
    vendor.branches.push(branch._id as any);
    await vendor.save();

    // Assign Role and Branch to User
    const branchAdminRole = await Role.findOne({ name: 'branch_admin' });
    const targetUserId = managerId || (req.user as any)?._id;
    
    if (branchAdminRole && targetUserId) {
      await User.findByIdAndUpdate(targetUserId, {
        $addToSet: { roles: branchAdminRole._id },
        branch: branch._id,
        vendor: vendorId
      });
    }

    res.status(201).json({ success: true, data: { branch } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getBranches()`
**Purpose:** List all branches  
**Access:** Public  
**Process:** Paginate and filter by vendorId  
**Response:** List of branches and pagination metadata

**Controller Implementation:**
```typescript
export const getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, page = 1, limit = 10 } = req.query;
    const query: any = vendorId ? { vendorId } : {};

    const branches = await Branch.find(query)
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string));

    const total = await Branch.countDocuments(query);

    res.status(200).json({ 
        success: true, 
        data: { 
            branches, 
            pagination: { 
                currentPage: parseInt(page as string), 
                totalBranches: total 
            } 
        } 
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getBranchById()`
**Purpose:** Get single branch details  
**Access:** Public  
**Response:** Branch details

**Controller Implementation:**
```typescript
export const getBranchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branch = await Branch.findById(req.params.branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    res.status(200).json({ success: true, data: { branch } });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateBranch()`
**Purpose:** Update branch details, including cover image and gallery.
**Access:** Private (Vendor Owner)  
**Process:** Find branch, update standard fields, handle parsing for complex objects, and process Cloudinary image uploads for `cover` and `gallery`.
**Response:** Updated branch

**Controller Implementation:**
```typescript
export const updateBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, location, workingHours, fulfillmentConfig, gallery, cover } = req.body;
    const branch = await Branch.findById(req.params.branchId);

    if (!branch) return next(errorHandler(404, "Branch not found"));

    if (name) branch.name = name;
    if (email) branch.email = email;
    if (phone) branch.phone = phone;
    
    if (location) {
      branch.location = typeof location === 'string' ? JSON.parse(location) : location;
    }
    
    if (workingHours) {
      branch.workingHours = typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours;
    }

    if (fulfillmentConfig) {
      branch.fulfillmentConfig = typeof fulfillmentConfig === 'string' ? JSON.parse(fulfillmentConfig) : fulfillmentConfig;
    }

    if (gallery) {
      branch.gallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Handle Cover Image
    if (files && files['cover']) {
      const uploadResult = await uploadToCloudinary(files['cover'][0], "dohez/branches/covers");

      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }

      branch.cover = uploadResult.url;
      branch.coverPublicId = uploadResult.public_id;
    } else if (cover === null || (typeof cover === "string" && cover.trim().length === 0)) {
      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }
      branch.cover = null;
      branch.coverPublicId = null;
    } else if (typeof cover === "string" && cover.trim().length > 0) {
      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }
      branch.cover = cover.trim();
      branch.coverPublicId = null;
    }

    // Handle Gallery Images (Append new uploads)
    if (files && files['gallery']) {
      for (const file of files['gallery']) {
        const uploadResult = await uploadToCloudinary(file, "dohez/branches/gallery");
        branch.gallery.push({
          url: uploadResult.url,
          publicId: uploadResult.public_id
        });
      }
    }

    await branch.save();

    res.status(200).json({ 
      success: true, 
      message: "Branch updated successfully",
      data: { branch } 
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteBranch()`
**Purpose:** Delete a branch  
**Access:** Private (Vendor Owner)  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    res.status(200).json({ success: true, message: "Branch deleted" });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Branch Routes

### Base Path: `/api/branches`

```typescript
POST   /                          // Create branch (Private)
GET    /                          // Get all branches (Public)
GET    /:branchId                 // Get branch details (Public)
PUT    /:branchId                 // Update branch (Private)
DELETE /:branchId                 // Delete branch (Private)
```

### Router Implementation

**File: `src/routes/branchRoutes.ts`**

```typescript
import express from 'express';
import {
  createBranch,
  getBranches,
  getBranchById,
  updateBranch,
  deleteBranch
} from '../controllers/branchController';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, createBranch);
router.get('/', getBranches);
router.get('/:branchId', getBranchById);
router.put('/:branchId', authenticateToken, updateBranch);
router.delete('/:branchId', authenticateToken, deleteBranch);

export default router;
```

### Route Details

#### `POST /api/branches`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "vendorId": "650af1234567890abcdef999",
  "name": "Downtown Branch",
  "email": "downtown@vendor.com",
  "phone": "+254700000000",
  "location": "{\"address\": \"Main St\", \"lat\": -1.29, \"lng\": 36.82, \"place_id\": \"chIJsx123\"}",
  "workingHours": "{\"monday\": {\"start\": \"08:00\", \"end\": \"18:00\"}}"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "branch": {
      "_id": "650af1234567890abcdef888",
      "vendorId": "650af1234567890abcdef999",
      "name": "Downtown Branch",
      "email": "downtown@vendor.com",
      "phone": "+254700000000",
      "location": {
        "address": "Main St",
        "coordinates": {
          "lat": -1.29,
          "lng": 36.82
        },
        "place_id": "chIJsx123"
      },
      "cover": null,
      "coverPublicId": null,
      "workingHours": {
        "monday": { "start": "08:00", "end": "18:00" }
      },
      "gallery": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/branches`
**Query:** `vendorId`, `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "branches": [
      {
        "_id": "650af1234567890abcdef888",
        "vendorId": "650af1234567890abcdef999",
        "name": "Downtown Branch",
        "email": "downtown@vendor.com",
        "phone": "+254700000000",
        "location": {
          "address": "Main St",
          "coordinates": {
            "lat": -1.29,
            "lng": 36.82
          },
          "place_id": "chIJsx123"
        },
        "cover": null,
        "coverPublicId": null,
        "workingHours": {
          "monday": { "start": "08:00", "end": "18:00" }
        },
        "gallery": [],
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalBranches": 1
    }
  }
}
```

#### `GET /api/branches/:branchId`
**Params:** `branchId=650af1234567890abcdef888`
**Response:**
```json
{
  "success": true,
  "data": {
    "branch": {
      "_id": "650af1234567890abcdef888",
      "vendorId": "650af1234567890abcdef999",
      "name": "Downtown Branch",
      "email": "downtown@vendor.com",
      "phone": "+254700000000",
      "location": {
        "address": "Main St",
        "coordinates": {
          "lat": -1.29,
          "lng": 36.82
        },
        "place_id": "chIJsx123"
      },
      "cover": null,
      "coverPublicId": null,
      "workingHours": {
        "monday": { "start": "08:00", "end": "18:00" }
      },
      "gallery": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/branches/:branchId`
**Headers:** `Authorization: Bearer <token>`
**Params:** `branchId=650af1234567890abcdef888`
**Response:**
```json
{
  "success": true,
  "data": {
    "branch": {
      "_id": "650af1234567890abcdef888",
      "vendorId": "650af1234567890abcdef999",
      "name": "Downtown Branch Pro",
      "email": "downtown@vendor.com",
      "phone": "+254700000000",
      "location": {
        "address": "Main St",
        "coordinates": {
          "lat": -1.29,
          "lng": 36.82
        },
        "place_id": "chIJsx123"
      },
      "cover": null,
      "coverPublicId": null,
      "workingHours": {
        "monday": { "start": "08:00", "end": "18:00" }
      },
      "gallery": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T12:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `DELETE /api/branches/:branchId`
**Headers:** `Authorization: Bearer <token>`
**Params:** `branchId=650af1234567890abcdef888`
**Response:**
```json
{
  "success": true,
  "message": "Branch deleted"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, createBranch);
```

---

## 📝 API Examples

### Create Branch
**Endpoint:** `POST /api/branches`  
**Access:** Private (Vendor Owner)

**Request Example:**
```bash
curl -X POST http://localhost:3500/api/branches \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "650af1234567890abcdef999",
    "name": "Uptown Branch",
    "email": "uptown@vendor.com",
    "phone": "+254711111111",
    "location": "{\"address\": \"Second Ave\", \"lat\": -1.30, \"lng\": 36.83, \"place_id\": \"...\"}",
    "workingHours": "{\"monday\": {\"start\": \"09:00\", \"end\": \"19:00\"}}"
  }'
```

**Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "branch": {
      "_id": "650af1234567890abcdef777",
      "name": "Uptown Branch"
    }
  }
}
```

---

## 🛡️ Security Features

- **Auth:** Restricted branch operations to authenticated vendor owners.
- **Data Integrity:** Strict validation of location and contact fields.

---

## 🚨 Error Handling

Standard error response:
```json
{ "success": false, "message": "Branch not found" }
```

---

## 📊 Database Indexes

```typescript
branchSchema.index({ vendorId: 1 });
branchSchema.index({ location: '2dsphere' });
```

---

**Last Updated:** April 2026  
**Version:** 1.0.0
