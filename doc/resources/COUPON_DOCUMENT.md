# 🎫 DOHEZ-API - Coupon Management Documentation

## 📋 Table of Contents
- [Coupon Management Overview](#coupon-management-overview)
- [Coupon Model](#-coupon-model)
- [Coupon Controller](#-coupon-controller)
- [Coupon Routes](#-coupon-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Coupon Management Overview

Coupon Management handles the lifecycle of promotional discounts within the system. It allows administrators and vendors to create coupons that can be applied to orders to provide either percentage or fixed-amount discounts. Features include usage limits, expiration dates, first-time user restrictions, and targeting of specific vendors or branches.

---

## 👤 Coupon Model

### Schema Definition
```typescript
export interface ICoupon extends Document {
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minimumOrderAmount: number;
  maximumDiscountAmount?: number;
  isActive: boolean;
  hasExpiry: boolean;
  expiryDate?: Date;
  hasUsageLimit: boolean;
  usageLimit?: number;
  usedCount: number;
  isFirstTimeOnly: boolean;
  applicableProducts: Types.ObjectId[] | IProduct[];
  applicableCategories: Types.ObjectId[] | IProductCategory[];
  excludedProducts: Types.ObjectId[] | IProduct[];
  excludedCategories: Types.ObjectId[] | IProductCategory[];
  vendor?: Types.ObjectId | IVendor;
  branch?: Types.ObjectId | IBranch;
  createdBy: Types.ObjectId | IUser;
  lastUsedBy: ICouponUsage[];
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Coupon.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { ICoupon, ICouponModel, ICouponUsage } from '../types';

const couponSchema = new Schema<ICoupon, ICouponModel>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
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
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumDiscountAmount: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    hasExpiry: {
      type: Boolean,
      default: false,
    },
    expiryDate: {
      type: Date,
    },
    hasUsageLimit: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFirstTimeOnly: {
      type: Boolean,
      default: false,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
      },
    ],
    excludedProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    excludedCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
      },
    ],
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
    },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    lastUsedBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
  }
);

const Coupon = mongoose.model<ICoupon, ICouponModel>('Coupon', couponSchema);

export default Coupon;
```

### Validation Rules
```typescript
code: { required: true, unique: true, uppercase: true }
name: { required: true }
discountType: { required: true, enum: ['percentage', 'fixed'] }
discountValue: { required: true, min: 0 }
minimumOrderAmount: { default: 0, min: 0 }
isActive: { default: true }
hasExpiry: { default: false }
hasUsageLimit: { default: false }
createdBy: { required: true, ref: 'User' }
```

---

## 🎮 Coupon Controller

**File:** `src/controllers/couponController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import Coupon from "../models/Coupon";
import { errorHandler } from "../middleware/errorHandler";
import mongoose from "mongoose";
```

### Functions Overview

#### `createCoupon()`
**Purpose:** Create a new coupon  
**Access:** Admin/Vendor  
**Validation:** Required fields in body  
**Process:** Validate fields, generate unique code, and save coupon record  
**Response:** Created coupon details

**Controller Implementation:**
```typescript
export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      hasExpiry,
      expiryDate,
      hasUsageLimit,
      usageLimit,
      isFirstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      vendor,
      branch
    } = req.body;

    // Validate required fields
    if (!name || !discountType || !discountValue) {
      return next(errorHandler(400, 'Name, discount type, and discount value are required'));
    }

    // Validate discount value
    if (discountValue <= 0) {
      return next(errorHandler(400, 'Discount value must be greater than 0'));
    }

    // Validate percentage discount
    if (discountType === 'percentage' && discountValue > 100) {
      return next(errorHandler(400, 'Percentage discount cannot exceed 100%'));
    }

    // Validate expiry date
    if (hasExpiry && expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry <= new Date()) {
        return next(errorHandler(400, 'Expiry date must be in the future'));
      }
    }

    // Validate usage limit
    if (hasUsageLimit && (!usageLimit || usageLimit < 1)) {
      return next(errorHandler(400, 'Usage limit must be at least 1'));
    }

    // Generate unique coupon code
    const code = await (Coupon as any).generateUniqueCode();

    const coupon = new Coupon({
      code,
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscountAmount,
      hasExpiry,
      expiryDate: hasExpiry ? expiryDate : null,
      hasUsageLimit,
      usageLimit: hasUsageLimit ? usageLimit : null,
      isFirstTimeOnly: isFirstTimeOnly || false,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      excludedProducts: excludedProducts || [],
      excludedCategories: excludedCategories || [],
      vendor,
      branch,
      createdBy: req.user?._id
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getAllCoupons()`
**Purpose:** List coupons  
**Access:** Admin  
**Validation:** None  
**Process:** Filter (search, status, vendor, branch), paginate, and return list  
**Response:** Paginated list of coupons

**Controller Implementation:**
```typescript
export const getAllCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, isActive, vendor, branch } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (vendor) {
      query.vendor = vendor;
    }

    if (branch) {
      query.branch = branch;
    }

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const coupons = await Coupon.find(query)
      .populate("vendor branch createdBy")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCoupons: total,
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

#### `getCouponById()`
**Purpose:** Fetch coupon by ID  
**Access:** Admin/Vendor  
**Validation:** Coupon must exist  
**Process:** Find coupon and populate references  
**Response:** Coupon details

**Controller Implementation:**
```typescript
export const getCouponById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupon = await Coupon.findById(req.params.couponId)
      .populate("vendor branch createdBy applicableProducts applicableCategories excludedProducts excludedCategories");

    if (!coupon) return next(errorHandler(404, "Coupon not found"));

    res.status(200).json({
      success: true,
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateCoupon()`
**Purpose:** Update coupon details  
**Access:** Admin/Vendor  
**Validation:** Coupon must exist, manual validation for discount and expiry  
**Process:** Update provided fields and save  
**Response:** Updated coupon details

**Controller Implementation:**
```typescript
export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;
    const {
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      isActive,
      hasExpiry,
      expiryDate,
      hasUsageLimit,
      usageLimit,
      isFirstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      vendor,
      branch
    } = req.body;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    // Validate discount value if provided
    if (discountValue !== undefined) {
      if (discountValue <= 0) {
        return next(errorHandler(400, 'Discount value must be greater than 0'));
      }
      const type = discountType || coupon.discountType;
      if (type === 'percentage' && discountValue > 100) {
        return next(errorHandler(400, 'Percentage discount cannot exceed 100%'));
      }
    }

    // Validate expiry date if provided
    if (hasExpiry && expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry <= new Date()) {
        return next(errorHandler(400, 'Expiry date must be in the future'));
      }
    }

    // Validate usage limit if provided
    if (hasUsageLimit && usageLimit !== undefined) {
      if (usageLimit < 1) {
        return next(errorHandler(400, 'Usage limit must be at least 1'));
      }
      if (usageLimit < coupon.usedCount) {
        return next(errorHandler(400, 'Usage limit cannot be less than current usage count'));
      }
    }

    // Update fields
    if (name !== undefined) coupon.name = name;
    if (description !== undefined) coupon.description = description;
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = minimumOrderAmount;
    if (maximumDiscountAmount !== undefined) coupon.maximumDiscountAmount = maximumDiscountAmount;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (hasExpiry !== undefined) coupon.hasExpiry = hasExpiry;
    if (expiryDate !== undefined) coupon.expiryDate = hasExpiry ? expiryDate : null;
    if (hasUsageLimit !== undefined) coupon.hasUsageLimit = hasUsageLimit;
    if (usageLimit !== undefined) coupon.usageLimit = hasUsageLimit ? usageLimit : null;
    if (isFirstTimeOnly !== undefined) coupon.isFirstTimeOnly = isFirstTimeOnly;
    if (applicableProducts !== undefined) coupon.applicableProducts = applicableProducts;
    if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories;
    if (excludedProducts !== undefined) coupon.excludedProducts = excludedProducts;
    if (excludedCategories !== undefined) coupon.excludedCategories = excludedCategories;
    if (vendor !== undefined) coupon.vendor = vendor;
    if (branch !== undefined) coupon.branch = branch;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteCoupon()`
**Purpose:** Delete a coupon  
**Access:** Admin  
**Validation:** Coupon must exist, must not have been used  
**Process:** Check usage count and remove record from database  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return next(errorHandler(400, 'Cannot delete coupon that has been used'));
    }

    await Coupon.findByIdAndDelete(couponId);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `validateCoupon()`
**Purpose:** Check if a coupon is valid for application  
**Access:** Authenticated User  
**Validation:** Code, branch, vendor, and order amount  
**Process:** Validate against branch/vendor targeting and model logic  
**Response:** Validation status and discount details

**Controller Implementation:**
```typescript
export const validateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, branch, vendor } = req.body;
    const { orderAmount = "0" } = req.query;
    const userId = req.user?._id || (req.user as any)?.userId;

    if (!code) {
      return next(errorHandler(400, 'Coupon code is required'));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      res.status(200).json({
        success: false,
        message: 'Invalid coupon code'
      });
      return;
    }

    // Check branch and vendor if set on coupon
    if (coupon.vendor && vendor && String(coupon.vendor) !== String(vendor)) {
      res.status(200).json({
        success: false,
        message: 'Coupon is not valid for this vendor'
      });
      return;
    }

    if (coupon.branch && branch && String(coupon.branch) !== String(branch)) {
      res.status(200).json({
        success: false,
        message: 'Coupon is not valid for this branch'
      });
      return;
    }

    // Validate coupon
    const validation = coupon.validateCoupon(userId ? String(userId) : "", parseFloat(orderAmount as string));

    if (!validation.isValid) {
      res.status(200).json({
        success: false,
        message: validation.message
      });
      return;
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(parseFloat(orderAmount as string));

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minimumOrderAmount: coupon.minimumOrderAmount,
          maximumDiscountAmount: coupon.maximumDiscountAmount
        },
        discountAmount,
        orderAmount: parseFloat(orderAmount as string),
        finalAmount: parseFloat(orderAmount as string) - discountAmount
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `applyCoupon()`
**Purpose:** Confirm application of a coupon to an order  
**Access:** Authenticated User  
**Validation:** Code, order amount, branch, vendor  
**Process:** Strict validation and return calculated discount summary  
**Response:** Success and final amount details

**Controller Implementation:**
```typescript
export const applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, orderAmount, branch, vendor } = req.body;
    const userId = req.user?._id;

    if (!code) {
      return next(errorHandler(400, 'Coupon code is required'));
    }

    if (!orderAmount || orderAmount <= 0) {
      return next(errorHandler(400, 'Valid order amount is required'));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return next(errorHandler(404, 'Invalid coupon code'));
    }

    // Check branch and vendor if set on coupon
    if (coupon.vendor && vendor && String(coupon.vendor) !== String(vendor)) {
      return next(errorHandler(400, 'Coupon is not valid for this vendor'));
    }

    if (coupon.branch && branch && String(coupon.branch) !== String(branch)) {
      return next(errorHandler(400, 'Coupon is not valid for this branch'));
    }

    // Validate coupon
    const validation = coupon.validateCoupon(String(userId), orderAmount);

    if (!validation.isValid) {
      return next(errorHandler(400, validation.message));
    }

    // Calculate discount
    const discountAmount = coupon.calculateDiscount(orderAmount);

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        },
        discountAmount,
        orderAmount,
        finalAmount: orderAmount - discountAmount
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `getCouponStats()`
**Purpose:** Get usage statistics  
**Access:** Admin/Vendor  
**Validation:** Coupon must exist  
**Process:** Return usedCount, usageLimit, and remainingUsage  
**Response:** Usage statistics

**Controller Implementation:**
```typescript
export const getCouponStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);

    if (!coupon) return next(errorHandler(404, "Coupon not found"));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          usedCount: coupon.usedCount,
          usageLimit: coupon.usageLimit,
          remainingUsage: coupon.remainingUsage,
          lastUsedBy: coupon.lastUsedBy
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `generateNewCode()`
**Purpose:** Generate a new unique coupon code for an existing coupon  
**Access:** Admin/Vendor  
**Validation:** Coupon must exist, must not have been used  
**Process:** Update code with a new unique value and save  
**Response:** New generated code details

**Controller Implementation:**
```typescript
export const generateNewCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    // Check if coupon has been used
    if (coupon.usedCount > 0) {
      return next(errorHandler(400, 'Cannot change code for coupon that has been used'));
    }

    // Generate new unique code
    const newCode = await (Coupon as any).generateUniqueCode();
    coupon.code = newCode;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'New coupon code generated successfully',
      data: {
        code: newCode
      }
    });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Coupon Routes

### Base Path: `/api/coupons`

```typescript
POST   /                         // Create coupon (Admin/Vendor)
GET    /                         // List coupons (Admin)
GET    /:couponId                // Get coupon details (Admin/Vendor)
PUT    /:couponId                // Update coupon (Admin/Vendor)
DELETE /:couponId                // Delete coupon (Admin)
POST   /validate                 // Validate coupon code
POST   /apply                    // Apply coupon to order
GET    /:couponId/stats          // Get coupon statistics (Admin/Vendor)
POST   /generate-code            // Generate unique code (Admin/Vendor)
```

### Router Implementation

**File: `src/routes/couponRoutes.ts`**

```typescript
import express from 'express';
import {
  createCoupon,
  getAllCoupons,
  getCouponById,
  updateCoupon,
  deleteCoupon,
  validateCoupon,
  applyCoupon,
  getCouponStats,
  generateNewCode
} from '../controllers/couponController';
import { authenticateToken, authorizeRoles, requireAdmin } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createCoupon);

router.get('/', authenticateToken, authorizeRoles(['admin']), getAllCoupons);

router.post('/validate', authenticateToken, validateCoupon);

router.post('/apply', authenticateToken, applyCoupon);

router.post('/generate-code', authenticateToken, authorizeRoles(['admin', 'vendor']), generateNewCode)

router.get('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponById);

router.put('/:couponId', authenticateToken, authorizeRoles(['admin', 'vendor']), updateCoupon);

router.delete('/:couponId', authenticateToken, requireAdmin, deleteCoupon);

router.get('/:couponId/stats', authenticateToken, authorizeRoles(['admin', 'vendor']), getCouponStats);

export default router;
```

### Route Details

#### `POST /api/coupons`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "name": "Welcome Discount",
  "description": "10% off for first-time orders",
  "discountType": "percentage",
  "discountValue": 10,
  "minimumOrderAmount": 500,
  "isFirstTimeOnly": true,
  "vendor": "65e26b1c09b068c201383805",
  "branch": "65e26b1c09b068c201383810"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "description": "10% off for first-time orders",
      "discountType": "percentage",
      "discountValue": 10,
      "minimumOrderAmount": 500,
      "isActive": true,
      "hasExpiry": false,
      "hasUsageLimit": false,
      "usedCount": 0,
      "isFirstTimeOnly": true,
      "applicableProducts": [],
      "applicableCategories": [],
      "excludedProducts": [],
      "excludedCategories": [],
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810",
      "createdBy": "65e26b1c09b068c201383801",
      "lastUsedBy": [],
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `GET /api/coupons`
**Headers:** 
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: `1`
- `limit`: `10`
- `search`: `WELCOME`
- `isActive`: `true`

**Response:**
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "6638a1b2c3d4e5f6g7h8i9j0",
        "code": "XYZ12345",
        "name": "Welcome Discount",
        "discountType": "percentage",
        "discountValue": 10,
        "isActive": true,
        "createdAt": "2026-05-25T10:00:00.000Z",
        "updatedAt": "2026-05-25T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCoupons": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/coupons/:couponId`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `couponId`: `6638a1b2c3d4e5f6g7h8i9j0`

**Response:**
```json
{
  "success": true,
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10,
      "vendor": {
        "_id": "65e26b1c09b068c201383805",
        "name": "Sample Vendor"
      },
      "branch": {
        "_id": "65e26b1c09b068c201383810",
        "name": "Main Branch"
      },
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

#### `PUT /api/coupons/:couponId`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**URL Parameters:**
- `couponId`: `6638a1b2c3d4e5f6g7h8i9j0`

**Request Body (JSON):**
```json
{
  "name": "Holiday Special",
  "discountValue": 15,
  "isActive": false
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Holiday Special",
      "discountType": "percentage",
      "discountValue": 15,
      "isActive": false,
      "createdAt": "2026-05-25T10:00:00.000Z",
      "updatedAt": "2026-05-25T11:00:00.000Z",
      "__v": 1
    }
  }
}
```

#### `DELETE /api/coupons/:couponId`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `couponId`: `6638a1b2c3d4e5f6g7h8i9j0`

**Response:**
```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

#### `POST /api/coupons/validate`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Query Parameters:**
- `orderAmount`: `1200.50`

**Request Body (JSON):**
```json
{
  "code": "XYZ12345",
  "vendor": "65e26b1c09b068c201383805",
  "branch": "65e26b1c09b068c201383810"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10
    },
    "discountAmount": 120.05,
    "orderAmount": 1200.50,
    "finalAmount": 1080.45
  }
}
```

#### `POST /api/coupons/apply`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "code": "XYZ12345",
  "orderAmount": 1200.50,
  "vendor": "65e26b1c09b068c201383805",
  "branch": "65e26b1c09b068c201383810"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10
    },
    "discountAmount": 120.05,
    "orderAmount": 1200.50,
    "finalAmount": 1080.45
  }
}
```

#### `GET /api/coupons/:couponId/stats`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `couponId`: `6638a1b2c3d4e5f6g7h8i9j0`

**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "usedCount": 15,
      "usageLimit": 100,
      "remainingUsage": 85,
      "lastUsedBy": [
        {
          "user": "65e26b1c09b068c201383801",
          "usedAt": "2026-05-25T14:30:00.000Z"
        }
      ]
    }
  }
}
```

#### `POST /api/coupons/:couponId/generate-code`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `couponId`: `6638a1b2c3d4e5f6g7h8i9j0`

**Response:**
```json
{
  "success": true,
  "message": "New coupon code generated successfully",
  "data": {
    "code": "NEWCODE99"
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
router.post('/validate', authenticateToken, validateCoupon);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createCoupon);
```

#### `requireAdmin`
**Purpose:** Admin access only (admin/super_admin)  
**Usage:**
```typescript
router.delete('/:couponId', authenticateToken, requireAdmin, deleteCoupon);
```

---

## 📝 API Examples

### Create Coupon (Admin/Vendor)
```bash
curl -X POST http://localhost:3500/api/coupons \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Welcome Discount",
    "description": "10% off for first-time orders",
    "discountType": "percentage",
    "discountValue": 10,
    "minimumOrderAmount": 500,
    "isFirstTimeOnly": true,
    "vendor": "65e26b1c09b068c201383805",
    "branch": "65e26b1c09b068c201383810"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Coupon created successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "description": "10% off for first-time orders",
      "discountType": "percentage",
      "discountValue": 10,
      "minimumOrderAmount": 500,
      "isActive": true,
      "usedCount": 0,
      "isFirstTimeOnly": true,
      "vendor": "65e26b1c09b068c201383805",
      "branch": "65e26b1c09b068c201383810",
      "createdBy": "65e26b1c09b068c201383801",
      "createdAt": "2026-05-06T14:00:00.000Z",
      "updatedAt": "2026-05-06T14:00:00.000Z"
    }
  }
}
```

### Get All Coupons (Admin)
```bash
curl -X GET "http://localhost:3500/api/coupons?page=1&limit=10&search=WELCOME" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "coupons": [
      {
        "_id": "6638a1b2c3d4e5f6g7h8i9j0",
        "code": "XYZ12345",
        "name": "Welcome Discount",
        "discountType": "percentage",
        "discountValue": 10,
        "isActive": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalCoupons": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Coupon Details (Admin/Vendor)
```bash
curl -X GET http://localhost:3500/api/coupons/6638a1b2c3d4e5f6g7h8i9j0 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10,
      "vendor": {
        "_id": "65e26b1c09b068c201383805",
        "name": "Sample Vendor"
      },
      "branch": {
        "_id": "65e26b1c09b068c201383810",
        "name": "Main Branch"
      }
    }
  }
}
```

### Update Coupon (Admin/Vendor)
```bash
curl -X PUT http://localhost:3500/api/coupons/6638a1b2c3d4e5f6g7h8i9j0 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "name": "Holiday Special",
    "discountValue": 15,
    "isActive": false
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Coupon updated successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "name": "Holiday Special",
      "discountValue": 15,
      "isActive": false,
      "updatedAt": "2026-05-06T15:00:00.000Z"
    }
  }
}
```

### Delete Coupon (Admin)
```bash
curl -X DELETE http://localhost:3500/api/coupons/6638a1b2c3d4e5f6g7h8i9j0 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Coupon deleted successfully"
}
```

### Validate Coupon
```bash
curl -X POST "http://localhost:3500/api/coupons/validate?orderAmount=1200.50" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "code": "XYZ12345",
    "vendor": "65e26b1c09b068c201383805",
    "branch": "65e26b1c09b068c201383810"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Coupon is valid",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10
    },
    "discountAmount": 120.05,
    "orderAmount": 1200.50,
    "finalAmount": 1080.45
  }
}
```

### Apply Coupon
```bash
curl -X POST http://localhost:3500/api/coupons/apply \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "code": "XYZ12345",
    "orderAmount": 1200.50,
    "vendor": "65e26b1c09b068c201383805",
    "branch": "65e26b1c09b068c201383810"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Coupon applied successfully",
  "data": {
    "coupon": {
      "_id": "6638a1b2c3d4e5f6g7h8i9j0",
      "code": "XYZ12345",
      "name": "Welcome Discount",
      "discountType": "percentage",
      "discountValue": 10
    },
    "discountAmount": 120.05,
    "orderAmount": 1200.50,
    "finalAmount": 1080.45
  }
}
```

### Get Coupon Stats (Admin/Vendor)
```bash
curl -X GET http://localhost:3500/api/coupons/6638a1b2c3d4e5f6g7h8i9j0/stats \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "stats": {
      "usedCount": 15,
      "usageLimit": 100,
      "remainingUsage": 85,
      "lastUsedBy": [
        {
          "user": "65e26b1c09b068c201383801",
          "usedAt": "2026-05-06T14:30:00.000Z"
        }
      ]
    }
  }
}
```

### Generate New Code (Admin/Vendor)
```bash
curl -X POST http://localhost:3500/api/coupons/6638a1b2c3d4e5f6g7h8i9j0/generate-code \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "New coupon code generated successfully",
  "data": {
    "code": "NEWCODE99"
  }
}
```

---

## 🛡️ Security Features

- **RBAC:** creation and management limited to `admin` and `vendor`.
- **Validation:** Server-side validation of expiry, usage limits, and minimum order values.
- **Code Normalization:** Codes are automatically converted to uppercase to prevent duplicates.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Invalid coupon code" }
```
```json
{ "success": false, "message": "Coupon has expired" }
```

---

## 📊 Database Indexes

```typescript
couponSchema.index({ isActive: 1, expiryDate: 1 });
couponSchema.index({ createdBy: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0