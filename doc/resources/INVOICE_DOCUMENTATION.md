# 🧾 DOHEZ-API - Invoice Management Documentation

## 📋 Table of Contents
- [Invoice Management Overview](#invoice-management-overview)
- [Invoice Model](#-invoice-model)
- [Invoice Controller](#-invoice-controller)
- [Invoice Routes](#-invoice-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Invoice Management Overview

Invoice Management automatically generates detailed billing documents upon order confirmation. Invoices contain a breakdown of costs, including subtotal, taxes, and fees, maintaining a clear financial record linked to the order.

---

## 👤 Invoice Model

### Schema Definition
```typescript
interface IInvoice extends Document {
  order?: Types.ObjectId;
  branch: Types.ObjectId;
  vendor: Types.ObjectId;
  invoiceNumber: string;
  lineItems?: Array<{ label: string; amount: number }>;
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "PARTIAL" | "CANCELLED";
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Invoice.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IInvoice, IInvoiceLineItem } from '../types';

const invoiceLineItemSchema = new Schema<IInvoiceLineItem>(
  {
    label: { type: String, required: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const invoiceSchema = new Schema<IInvoice>(
  {
    order: {
      type: Schema.Types.ObjectId,
      ref: 'Order',
      required: false,
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
    invoiceNumber: {
      type: String,
      required: true,
      unique: true,
    },
    lineItems: {
      type: [invoiceLineItemSchema],
      default: [],
    },
    subtotal: {
      type: Number,
      required: true,
      min: 0,
    },
    discounts: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    fees: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    tax: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    total: {
      type: Number,
      required: true,
      min: 0,
    },
    balanceDue: {
      type: Number,
      required: true,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['PENDING', 'PAID', 'CANCELLED'],
      default: 'PENDING',
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

invoiceSchema.index({ order: 1 });
invoiceSchema.index({ paymentStatus: 1, createdAt: -1 });

const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);

export default Invoice;
```

### Validation Rules
```typescript
order:         { required: false, ref: 'Order' }
branch:        { required: true, ref: 'Branch' }
vendor:        { required: true, ref: 'Vendor' }
invoiceNumber: { required: true, unique: true }
lineItems:     { required: false, default: [] }
paymentStatus: { enum: ['PENDING', 'PAID', 'CANCELLED'], default: 'PENDING' }
```

---

## 🎮 Invoice Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Invoice from '../models/Invoice';
import Order from '../models/Order';
import { generateInvoiceNumber } from '../services/internal/paymentService';
import { errorHandler } from '../middleware/errorHandler';
```

### Functions Overview

#### `createInvoice()`
**Purpose:** Generates a new invoice for a confirmed order.  
**Access:** Admin/Vendor  
**Validation:** `orderId` required, order must exist and not already have an invoice.  
**Process:** Calculates line items and totals from order pricing, generates invoice number, and updates order.  
**Response:** Created invoice ID.

**Controller Implementation:**
```typescript
export const createInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const { orderId } = req.body || {};

    if (!orderId) return next(errorHandler(400, 'orderId is required'));

    const order = await Order.findById(orderId);
    if (!order) return next(errorHandler(404, 'Order not found'));

    // Check if invoice already exists
    const existingInvoice = await Invoice.findOne({ order: orderId });
    if (existingInvoice) {
      return res.status(409).json({ success: false, message: 'Invoice already exists for this order', data: { invoiceId: existingInvoice._id } });
    }

    const { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total } = (order as any).pricing || {};

    const lineItems = [
      { label: 'Items subtotal', amount: subtotal || 0 },
      ...(packagingFee ? [{ label: 'Packaging', amount: packagingFee }] : []),
      ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
      ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
      ...(tax ? [{ label: 'Tax', amount: tax }] : [])
    ];

    const invoiceNumber = await generateInvoiceNumber();

    const invoice = await Invoice.create({
      order: order._id,
      branch: order.branch,
      vendor: order.vendor,
      invoiceNumber,
      lineItems,
      subtotal: subtotal || 0,
      discounts: discounts || 0,
      fees: (packagingFee || 0) + (schedulingFee || 0) + (deliveryFee || 0),
      tax: tax || 0,
      total: total || 0,
      balanceDue: total || 0,
      paymentStatus: 'PENDING'
    });

    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};
```

#### `getInvoices()`
**Purpose:** Lists all invoices with optional filtering and pagination.  
**Access:** Admin  
**Validation:** None.  
**Response:** Paginated list of invoices.

**Controller Implementation:**
```typescript
export const getInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, paymentStatus, vendor, branch } = req.query;
    const query: any = {};
    if (paymentStatus) query.paymentStatus = paymentStatus;
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;

    const options = {
        page: parseInt(page as string) || 1,
        limit: parseInt(limit as string) || 10
    };

    const invoices = await Invoice.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);
      
    const total = await Invoice.countDocuments(query);

    return res.status(200).json({ 
        success: true, 
        data: { 
            invoices,
            pagination: {
                currentPage: options.page,
                totalPages: Math.ceil(total / options.limit),
                total
            }
        } 
    });
  } catch (err) {
    return next(err);
  }
};
```

#### `getInvoiceById()`
**Purpose:** Retrieves details for a specific invoice.  
**Access:** Admin  
**Validation:** Valid invoice ID.  
**Response:** Invoice with populated order, vendor, and branch details.

**Controller Implementation:**
```typescript
export const getInvoiceById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await Invoice.findById(req.params.id).populate('order vendor branch');
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));
    return res.status(200).json({ success: true, data: { invoice } });
  } catch (err) {
    return next(err);
  }
};
```

---

## 🛣️ Invoice Routes

### Base Path: `/api/invoices`

### Route Implementation

**File: `src/routes/invoiceRoutes.ts`**

```typescript
import express from 'express';
import {
    createInvoice,
    getInvoices,
    getInvoiceById
} from '../controllers/invoiceController';
import { authenticateToken, authorizeRoles } from '../middleware/auth';

const router = express.Router();

router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createInvoice);
router.get('/', authenticateToken, authorizeRoles(['admin']), getInvoices);
router.get('/:id', authenticateToken, authorizeRoles(['admin']), getInvoiceById);

export default router;
```

### Route Details

#### `POST /api/invoices`
**Headers:** `Authorization: Bearer <token>`, `Content-Type: application/json`
**Body:**
```json
{
  "orderId": "65e26b1c09b068c201383812"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "6638b2c3d4e5f6g7h8i9j0k5"
  }
}
```

#### `GET /api/invoices`
**Headers:** `Authorization: Bearer <admin_token>`
**Query Parameters:** `page`, `limit`, `paymentStatus`
**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k5",
        "invoiceNumber": "INV-2026-0001",
        "paymentStatus": "PENDING",
        "total": 1550
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "total": 1
    }
  }
}
```

#### `GET /api/invoices/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k5",
      "invoiceNumber": "INV-2026-0001",
      "paymentStatus": "PENDING",
      "order": {
        "_id": "65e26b1c09b068c201383812",
        "orderNumber": "ORD-2026-001"
      },
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

---

## 📝 API Examples

### Create Invoice
```bash
curl -X POST http://localhost:3500/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <admin_token>" \
  -d '{
    "orderId": "65e26b1c09b068c201383812"
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "invoiceId": "6638b2c3d4e5f6g7h8i9j0k5"
  }
}
```

### List Invoices (Admin)
```bash
curl -X GET "http://localhost:3500/api/invoices?paymentStatus=PENDING&page=1&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "invoices": [
      {
        "_id": "6638b2c3d4e5f6g7h8i9j0k5",
        "invoiceNumber": "INV-2026-0001",
        "paymentStatus": "PENDING",
        "total": 1550,
        "createdAt": "2026-05-06T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "total": 1
    }
  }
}
```

### Get Invoice Details (Admin)
```bash
curl -X GET http://localhost:3500/api/invoices/6638b2c3d4e5f6g7h8i9j0k5 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "invoice": {
      "_id": "6638b2c3d4e5f6g7h8i9j0k5",
      "invoiceNumber": "INV-2026-0001",
      "paymentStatus": "PENDING",
      "total": 1550,
      "order": {
        "_id": "65e26b1c09b068c201383812",
        "orderNumber": "ORD-2026-001"
      },
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

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user information  
**Usage:**
```typescript
router.post('/', authenticateToken, authorizeRoles(['admin', 'vendor']), createInvoice);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Ensure the authenticated user has appropriate permissions  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin']), getInvoices);
```

---

## 🛡️ Security Features

- **Authentication:** All invoice endpoints require a valid JWT token.
- **RBAC:** Invoicing actions are restricted to `admin` or authorized `vendor` roles.
- **Data Integrity:** Invoices are immutable once created and strictly linked to specific orders, branches, and vendors.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input (e.g., missing orderId).
- `401 Unauthorized`: Missing or invalid authentication token.
- `404 Not Found`: The referenced order or invoice was not found.
- `409 Conflict`: An invoice already exists for the specified order.
- `500 Internal Server Error`: An unexpected server-side error occurred.

---

## 📊 Database Indexes
...
```typescript
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ paymentStatus: 1, createdAt: -1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
