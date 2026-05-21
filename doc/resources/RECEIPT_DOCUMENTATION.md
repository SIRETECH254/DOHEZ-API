# 📄 DOHEZ-API - Receipt Management Documentation

## 📋 Table of Contents
- [Receipt Management Overview](#receipt-management-overview)
- [Receipt Model](#-receipt-model)
- [Receipt Controller](#-receipt-controller)
- [Receipt Routes](#-receipt-routes)
- [API Examples](#-api-examples)
- [Database Indexes](#-database-indexes)

---

## Receipt Management Overview

The Receipt Management resource provides a record of completed transactions. Each receipt is generated automatically upon successful payment and is linked to its corresponding Order, Appointment, or Ticket, as well as the Invoice, Vendor, and Branch.

---

## 📄 Receipt Model

### Schema Definition
```typescript
interface IReceipt extends Document {
  order?: Types.ObjectId | IOrder;
  appointment?: Types.ObjectId;
  ticket?: Types.ObjectId | ITicket;
  invoice: Types.ObjectId | IInvoice;
  customer: Types.ObjectId | IUser;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  receiptNumber: string;
  amountPaid: number;
  paymentMethod: 'mpesa' | 'paystack' | 'cash';
  issuedAt: Date;
  pdfUrl?: string;
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/receiptModel.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IReceipt } from '../types';

const receiptSchema = new Schema<IReceipt>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
    },
    appointment: {
      type: Schema.Types.ObjectId,
      ref: 'Appointment',
    },
    ticket: {
      type: Schema.Types.ObjectId,
      ref: 'Ticket',
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      required: true,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    branch: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    receiptNumber: {
      type: String,
      required: true,
      unique: true,
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentMethod: {
      type: String,
      enum: ['mpesa', 'paystack', 'cash'],
      required: true,
    },
    issuedAt: {
      type: Date,
      required: true,
    },
    pdfUrl: {
      type: String,
      default: null,
    },
    metadata: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

receiptSchema.index({ order: 1 });
receiptSchema.index({ appointment: 1 });
receiptSchema.index({ ticket: 1 });
receiptSchema.index({ invoice: 1 });
receiptSchema.index({ branch: 1 });
receiptSchema.index({ vendor: 1 });

const Receipt = mongoose.model<IReceipt>('Receipt', receiptSchema);

export default Receipt;
```

### Validation Rules
```typescript
order:         { ref: 'Order' }
appointment:   { ref: 'Appointment' }
ticket:        { ref: 'Ticket' }
invoice:       { required: true, ref: 'Invoice' }
customer:      { required: true, ref: 'User' }
branch:        { required: true, ref: 'Branch' }
vendor:        { required: true, ref: 'Vendor' }
receiptNumber: { required: true, unique: true }
amountPaid:    { required: true, min: 0 }
paymentMethod: { required: true, enum: ['mpesa', 'paystack', 'cash'] }
issuedAt:      { required: true }
pdfUrl:        { default: null }
metadata:      { default: {} }
```

---

## 🎮 Receipt Controller

**File:** `src/controllers/receiptController.ts`

### Required Imports
```typescript
import { Request, Response, NextFunction } from "express";
import Receipt from "../models/receiptModel";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `getReceipts()`
**Purpose:** List receipts with pagination, search by `receiptNumber`, and filtering.  
**Access:** Admin, Vendor, Branch Admin.  
**Validation:** None.  
**Process:** Apply filters (`vendor`, `branch`, `paymentMethod`), populate relations, paginate, and return.

**Controller Implementation:**
```typescript
export const getReceipts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, vendor, branch, paymentMethod } = req.query;
    const query: any = {};

    if (search) query.receiptNumber = { $regex: search, $options: "i" };
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (paymentMethod) query.paymentMethod = paymentMethod;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const receipts = await Receipt.find(query)
      .populate("order appointment ticket customer vendor branch invoice")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Receipt.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        receipts,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalReceipts: total,
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

#### `getReceipt()`
**Purpose:** Fetch receipt by ID with all relations populated.  
**Access:** Authenticated.  
**Validation:** Receipt must exist.

**Controller Implementation:**
```typescript
export const getReceipt = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const receipt = await Receipt.findById(req.params.id)
      .populate("order appointment ticket customer vendor branch invoice");

    if (!receipt) return next(errorHandler(404, "Receipt not found"));

    res.status(200).json({ success: true, data: { receipt } });
  } catch (error: any) {
    next(error);
  }
};
```

---

## 🛣️ Receipt Routes

### Base Path: `/api/receipts`

```typescript
GET    /                          // List all receipts
GET    /:id                       // Get receipt details
```

### Router Implementation
**File:** `src/routes/receiptRoutes.ts`

```typescript
import express from 'express';
import { getReceipts, getReceipt } from '../controllers/receiptController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getReceipts);
router.get('/:id', authenticateToken, getReceipt);

export default router;
```

### Route Details

#### `GET /api/receipts`
**Headers:** `Authorization: Bearer <token>`  
**Query Parameters:** `page`, `limit`, `search`, `vendor`, `branch`, `paymentMethod`  
**Response:** List of receipts with pagination.
```json
{
  "success": true,
  "data": {
    "receipts": [
      {
        "_id": "650af1234567890abcdef123",
        "receiptNumber": "RCP-2026-0001",
        "amountPaid": 1500,
        "paymentMethod": "mpesa",
        "issuedAt": "2026-05-20T10:00:00.000Z",
        "invoice": "650af1234567890abcdef001",
        "customer": "650af1234567890abcdef002",
        "branch": "650af1234567890abcdef003",
        "vendor": "650af1234567890abcdef004",
        "createdAt": "2026-05-20T10:00:00.000Z",
        "updatedAt": "2026-05-20T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalReceipts": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/receipts/:id`
**Headers:** `Authorization: Bearer <token>`  
**Response:** Detailed receipt object.
```json
{
  "success": true,
  "data": {
    "receipt": {
      "_id": "650af1234567890abcdef123",
      "receiptNumber": "RCP-2026-0001",
      "invoice": {
        "_id": "650af1234567890abcdef001",
        "invoiceNumber": "INV-2026-001",
        "total": 1500
      },
      "customer": {
        "_id": "650af1234567890abcdef002",
        "firstName": "John",
        "lastName": "Doe"
      },
      "branch": {
        "_id": "650af1234567890abcdef003",
        "name": "Main Branch"
      },
      "vendor": {
        "_id": "650af1234567890abcdef004",
        "name": "TEO KICKS"
      },
      "amountPaid": 1500,
      "paymentMethod": "mpesa",
      "issuedAt": "2026-05-20T10:00:00.000Z",
      "pdfUrl": "https://res.cloudinary.com/dohez/raw/upload/v1/receipts/receipt-RCP-2026-0001.pdf",
      "metadata": {},
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getReceipts);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'vendor', 'branch_admin']), getReceipts);
```

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "Receipt not found" }
```
```json
{ "success": false, "message": "Server error while processing receipt request" }
```

---

## 📝 API Examples

### List Receipts
```bash
curl -X GET "http://localhost:3500/api/receipts?page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "receipts": [
      {
        "_id": "650af1234567890abcdef123",
        "receiptNumber": "RCP-2026-0001",
        "amountPaid": 1500,
        "paymentMethod": "mpesa",
        "issuedAt": "2026-05-20T10:00:00.000Z",
        "invoice": "650af1234567890abcdef001",
        "customer": "650af1234567890abcdef002",
        "branch": "650af1234567890abcdef003",
        "vendor": "650af1234567890abcdef004",
        "createdAt": "2026-05-20T10:00:00.000Z",
        "updatedAt": "2026-05-20T10:00:00.000Z",
        "__v": 0
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalReceipts": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Receipt by ID
```bash
curl -X GET http://localhost:3500/api/receipts/650af1234567890abcdef123 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "receipt": {
      "_id": "650af1234567890abcdef123",
      "receiptNumber": "RCP-2026-0001",
      "invoice": {
        "_id": "650af1234567890abcdef001",
        "invoiceNumber": "INV-2026-001",
        "total": 1500
      },
      "customer": {
        "_id": "650af1234567890abcdef002",
        "firstName": "John",
        "lastName": "Doe"
      },
      "branch": {
        "_id": "650af1234567890abcdef003",
        "name": "Main Branch"
      },
      "vendor": {
        "_id": "650af1234567890abcdef004",
        "name": "TEO KICKS"
      },
      "amountPaid": 1500,
      "paymentMethod": "mpesa",
      "issuedAt": "2026-05-20T10:00:00.000Z",
      "pdfUrl": "https://res.cloudinary.com/dohez/raw/upload/v1/receipts/receipt-RCP-2026-0001.pdf",
      "metadata": {},
      "createdAt": "2026-05-20T10:00:00.000Z",
      "updatedAt": "2026-05-20T10:00:00.000Z",
      "__v": 0
    }
  }
}
```

---

## 📊 Database Indexes
```typescript
receiptSchema.index({ order: 1 });
receiptSchema.index({ appointment: 1 });
receiptSchema.index({ ticket: 1 });
receiptSchema.index({ invoice: 1 });
receiptSchema.index({ branch: 1 });
receiptSchema.index({ vendor: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
