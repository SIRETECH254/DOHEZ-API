# 📦 DOHEZ-API - Packaging Management Documentation

## 📋 Table of Contents
- [Packaging Management Overview](#packaging-management-overview)
- [Packaging Model](#-packaging-model)
- [Packaging Controller](#-packaging-controller)
- [Packaging Routes](#-packaging-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Packaging Management Overview

Packaging Management handles the various packaging options available for orders. Each vendor and branch can define their own set of packaging options with different price points. The system ensures that only one packaging option can be the default for a specific vendor and branch combination, which is automatically applied to new orders if not otherwise specified.

---

## 👤 Packaging Model

### Schema Definition
```typescript
export interface IPackaging extends Document {
  name: string;
  price: number;
  isActive: boolean;
  isDefault: boolean;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Packaging.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IPackaging } from '../types';

const packagingSchema = new Schema<IPackaging>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Unique case-insensitive name
packagingSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
packagingSchema.index({ isActive: 1, isDefault: 1 });

const Packaging = mongoose.model<IPackaging>('Packaging', packagingSchema);

export default Packaging;
```

### Validation Rules
```typescript
name:      { required: true, trim: true }
price:     { required: true, min: 0 }
isActive:  { default: true }
isDefault: { default: false }
vendor:    { required: true, ref: 'Vendor' }
branch:    { required: true, ref: 'Branch' }
```

---

## 🎮 Packaging Controller

**File:** `src/controllers/packagingController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Packaging from '../models/Packaging';
import { errorHandler } from '../middleware/errorHandler';
```

### Functions Overview

#### `createPackaging()`
**Purpose:** Create a new packaging option  
**Access:** Admin/Vendor  
**Validation:** Name, price, vendor, and branch are required  
**Process:** Validate fields, handle default flag consistency, and save record  
**Response:** Created packaging details

**Controller Implementation:**
```typescript
export const createPackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { name, price, isActive = true, isDefault = false, vendor, branch } = req.body || {};

        if (!name || typeof name !== 'string') {
            return next(errorHandler(400, 'Name is required'));
        }

        if (price == null || Number(price) < 0) {
            return next(errorHandler(400, 'Price must be a non-negative number'));
        }

        if (!vendor || !branch) {
            return next(errorHandler(400, 'Vendor and Branch are required'));
        }

        // If making default, unset others for the same vendor/branch
        if (isDefault) {
            await Packaging.updateMany(
                { vendor, branch, isDefault: true },
                { $set: { isDefault: false } }
            );
        }

        const packaging = await Packaging.create({
            name: name.trim(),
            price: Number(price),
            isActive: Boolean(isActive),
            isDefault: Boolean(isDefault && isActive),
            vendor,
            branch
        });

        return res.status(201).json({ success: true, data: { packaging } });
    } catch (err: any) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'));
        }
        return next(err);
    }
};
```

#### `updatePackaging()`
**Purpose:** Update an existing packaging option  
**Access:** Admin/Vendor  
**Validation:** Valid ID, non-negative price  
**Process:** Update fields, handle default flag transitions (ensure only one default per vendor/branch)  
**Response:** Updated packaging details

**Controller Implementation:**
```typescript
export const updatePackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { name, price, isActive, isDefault } = req.body || {};

        const packaging = await Packaging.findById(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));

        const update: any = {};
        if (name != null) update.name = String(name).trim();
        if (price != null) {
            if (Number(price) < 0) return next(errorHandler(400, 'Price must be a non-negative number'));
            update.price = Number(price);
        }
        if (isActive != null) update.isActive = Boolean(isActive);
        if (isDefault != null) update.isDefault = Boolean(isDefault);

        // Handle default flag transitions
        if (update.isDefault === true) {
            // Unset default on others for the same vendor/branch
            await Packaging.updateMany(
                { _id: { $ne: id }, vendor: packaging.vendor, branch: packaging.branch, isDefault: true },
                { $set: { isDefault: false } }
            );
            // Ensure active when default
            update.isActive = true;
        }

        if (update.isActive === false) {
            // If deactivating, cannot remain default
            update.isDefault = false;
        }

        const updatedPackaging = await Packaging.findByIdAndUpdate(id, update, { new: true, runValidators: true });
        return res.json({ success: true, data: { packaging: updatedPackaging } });
    } catch (err: any) {
        if (err?.code === 11000) {
            return next(errorHandler(409, 'A packaging option with that name already exists'));
        }
        return next(err);
    }
};
```

#### `deletePackaging()`
**Purpose:** Remove a packaging option  
**Access:** Admin/Vendor  
**Validation:** Valid ID  
**Process:** Delete record and auto-promote a new default if the deleted one was default  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deletePackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findByIdAndDelete(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));

        // If deleted was default, try auto-promote the lowest-priced active option for the same vendor/branch
        if (packaging.isDefault) {
            const replacement = await Packaging.findOne({ 
                vendor: packaging.vendor, 
                branch: packaging.branch, 
                isActive: true 
            }).sort({ price: 1, name: 1 });
            
            if (replacement) {
                replacement.isDefault = true;
                await replacement.save();
            }
        }

        return res.json({ success: true });
    } catch (err) {
        return next(err);
    }
};
```

#### `getPackagingList()`
**Purpose:** List packaging options with filters  
**Access:** Public  
**Validation:** None  
**Process:** Apply filters (search, active, default, price range, vendor, branch) and paginate  
**Response:** Paginated list of packaging options

**Controller Implementation:**
```typescript
export const getPackagingList = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const {
            page = 1,
            limit = 10,
            search,
            active,
            isDefault,
            minPrice,
            maxPrice,
            vendor,
            branch,
            sort = 'createdAt:desc'
        } = req.query || {};

        const filters: any = {};
        if (search) filters.name = { $regex: search, $options: 'i' };
        if (active !== undefined) filters.isActive = String(active) === 'true';
        if (isDefault !== undefined) filters.isDefault = String(isDefault) === 'true';
        if (vendor) filters.vendor = vendor;
        if (branch) filters.branch = branch;
        
        if (minPrice != null || maxPrice != null) {
            filters.price = {};
            if (minPrice != null) filters.price.$gte = Number(minPrice);
            if (maxPrice != null) filters.price.$lte = Number(maxPrice);
        }

        const [sortField, sortDirRaw] = String(sort).split(':');
        const sortDir = String(sortDirRaw).toLowerCase() === 'asc' ? 1 : -1;

        const skip = (Number(page) - 1) * Number(limit);

        const [data, total] = await Promise.all([
            Packaging.find(filters)
                .collation({ locale: 'en', strength: 2 })
                .sort({ [sortField || 'createdAt']: sortDir })
                .skip(skip)
                .limit(Number(limit)),
            Packaging.countDocuments(filters)
        ]);

        return res.json({
            success: true,
            data: {
                packaging: data,
                pagination: {
                    currentPage: Number(page),
                    pageSize: Number(limit),
                    totalItems: Number(total),
                    totalPages: Math.max(1, Math.ceil(Number(total) / Number(limit)))
                }
            }
        });
    } catch (err) {
        return next(err);
    }
};
```

#### `getPackagingById()`
**Purpose:** Fetch a single packaging option  
**Access:** Public  
**Validation:** Valid ID  
**Process:** Find record and populate vendor/branch references  
**Response:** Packaging details

**Controller Implementation:**
```typescript
export const getPackagingById = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findById(id).populate('vendor branch');
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));
        return res.json({ success: true, data: { packaging } });
    } catch (err) {
        return next(err);
    }
};
```

#### `setDefaultPackaging()`
**Purpose:** Manually set an option as the default  
**Access:** Admin/Vendor  
**Validation:** Valid ID, must be active  
**Process:** Unset current default and set the new one  
**Response:** Updated packaging details

**Controller Implementation:**
```typescript
export const setDefaultPackaging = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const packaging = await Packaging.findById(id);
        if (!packaging) return next(errorHandler(404, 'Packaging option not found'));
        if (!packaging.isActive) return next(errorHandler(400, 'Cannot set an inactive option as default'));

        // Unset current default for this vendor/branch
        await Packaging.updateMany(
            { _id: { $ne: id }, vendor: packaging.vendor, branch: packaging.branch, isDefault: true },
            { $set: { isDefault: false } }
        );

        packaging.isDefault = true;
        await packaging.save();

        return res.json({ success: true, data: { packaging } });
    } catch (err) {
        return next(err);
    }
};
```

---

## 🛣️ Packaging Routes

### Base Path: `/api/packaging`

```typescript
POST   /                // Create packaging (Admin/Vendor)
GET    /                // List packaging (Public)
GET    /:id             // Get by ID (Public)
PUT    /:id             // Update packaging (Admin/Vendor)
DELETE /:id             // Delete packaging (Admin/Vendor)
PATCH  /:id/default     // Set as default (Admin/Vendor)
```

### Router Implementation

**File: `src/routes/packagingRoutes.ts`**

```typescript
import express from 'express';
import {
    createPackaging,
    updatePackaging,
    deletePackaging,
    getPackagingList,
    getPackagingById,
    setDefaultPackaging
} from '../controllers/packagingController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createPackaging);

router.get('/', getPackagingList);

router.get('/:id', getPackagingById);

router.put('/:id', authenticateToken, authorizeRoles(['admin', 'vendor']), updatePackaging);

router.delete('/:id', authenticateToken, authorizeRoles(['admin', 'vendor']), deletePackaging);

router.patch('/:id/default', authenticateToken, authorizeRoles(['admin', 'vendor']), setDefaultPackaging);

export default router;
```

### Route Details

#### `POST /api/packaging`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Eco Box",
  "price": 50,
  "vendor": "65e26b1c09b068c201383805",
  "branch": "65e26b1c09b068c201383810",
  "isDefault": true
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/packaging`
**Query Parameters:** `page`, `limit`, `search`, `active`, `isDefault`, `vendor`, `branch`, `sort`
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k1",
        "name": "Eco Box",
        "price": 50,
        "isActive": true,
        "isDefault": true,
        "vendor": "65e26b1c09b068c201383805",
        "branch": "65e26b1c09b068c201383810",
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      },
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k2",
        "name": "Standard Carton",
        "price": 30,
        "isActive": true,
        "isDefault": false,
        "vendor": "65e26b1c09b068c201383805",
        "branch": "65e26b1c09b068c201383810",
        "createdAt": "2026-05-25T10:05:00.000Z",
        "updatedAt": "2026-05-25T10:05:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalItems": 2,
      "totalPages": 1
    }
  }
}
```

#### `GET /api/packaging/:id`
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "vendor": {
        "_id": "65e26b1c09b068c201383805",
        "name": "Organic Supplies Co."
      },
      "branch": {
        "_id": "65e26b1c09b068c201383810",
        "name": "Main Distribution Center"
      },
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/packaging/:id`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "name": "Premium Box",
  "price": 100
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Premium Box",
      "price": 100,
      "isActive": true,
      "isDefault": true,
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `DELETE /api/packaging/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true
}
```

#### `PATCH /api/packaging/:id/default`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Premium Box",
      "price": 100,
      "isActive": true,
      "isDefault": true,
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810",
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 0
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createPackaging);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Restrict access to specific roles (e.g., admin, vendor)  
**Usage:**
```typescript
router.put('/:id', authenticateToken, authorizeRoles(['admin', 'vendor']), updatePackaging);
```

---

## 📝 API Examples

### Create Packaging
```bash
curl -X POST http://localhost:3500/api/packaging \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Eco-friendly Box",
    "price": 50,
    "vendor": "65e26b1c09b068c201383805",
    "branch": "65e26b1c09b068c201383810",
    "isDefault": true
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco-friendly Box",
      "price": 50,
      "isActive": true,
      "isDefault": true,
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810"
    }
  }
}
```

### List Packaging
```bash
curl -X GET "http://localhost:3500/api/packaging?vendor=65e26b1c09b068c201383805&active=true"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k1",
        "name": "Eco-friendly Box",
        "price": 50,
        "isActive": true,
        "isDefault": true,
        "vendor": "65e26b1c09b068c201383805",
        "branch": "65e26b1c09b068c201383810"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "pageSize": 10,
      "totalItems": 1,
      "totalPages": 1
    }
  }
}
```

### Get Packaging By ID
```bash
curl -X GET http://localhost:3500/api/packaging/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco-friendly Box",
      "price": 50,
      "vendor": {
        "_id": "65e26b1c09b068c201383805",
        "name": "Organic Supplies Co."
      },
      "branch": {
        "_id": "65e26b1c09b068c201383810",
        "name": "Main Distribution Center"
      }
    }
  }
}
```

### Update Packaging
```bash
curl -X PUT http://localhost:3500/api/packaging/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "price": 60,
    "isActive": true
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco-friendly Box",
      "price": 60,
      "isActive": true,
      "isDefault": true
    }
  }
}
```

### Delete Packaging
```bash
curl -X DELETE http://localhost:3500/api/packaging/6638b2c3d4e5f6g7h8i9j0k1 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true
}
```

### Set Default Packaging
```bash
curl -X PATCH http://localhost:3500/api/packaging/6638b2c3d4e5f6g7h8i9j0k1/default \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "packaging": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k1",
      "name": "Eco-friendly Box",
      "isDefault": true
    }
  }
}
```

---

## 🛡️ Security Features

- **Role-Based Access Control:** Only users with `admin` or `vendor` roles can modify packaging options.
- **Data Isolation:** Packaging options are strictly linked to `vendor` and `branch` IDs.
- **Consistency:** The system automatically manages the `isDefault` flag to ensure only one option is default per branch.

---

## 🚨 Error Handling

- `400 Bad Request`: Missing required fields or invalid price.
- `404 Not Found`: Packaging option ID does not exist.
- `409 Conflict`: Duplicate packaging name for the same vendor/branch.

---

## 📊 Database Indexes

```typescript
packagingSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
packagingSchema.index({ isActive: 1, isDefault: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
