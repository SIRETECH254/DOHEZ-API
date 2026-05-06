# 🧾 DOHEZ-API - Invoice Management Documentation

## 📋 Table of Contents
- [Invoice Management Overview](#invoice-management-overview)
- [Invoice Model](#-invoice-model)
- [Invoice Controller](#-invoice-controller)
- [Invoice Routes](#-invoice-routes)
- [API Examples](#-api-examples)
- [Database Indexes](#-database-indexes)

---

## Invoice Management Overview

Invoice Management automatically generates detailed billing documents upon order confirmation. Invoices contain a breakdown of costs, including subtotal, taxes, and fees, maintaining a clear financial record linked to the order.

---

## 👤 Invoice Model

### Schema Definition
```typescript
interface IInvoice extends Document {
  order: Types.ObjectId;
  branch: Types.ObjectId;
  vendor: Types.ObjectId;
  invoiceNumber: string;
  lineItems: Array<{ label: string; amount: number }>;
  subtotal: number;
  discounts: number;
  fees: number;
  tax: number;
  total: number;
  balanceDue: number;
  paymentStatus: "PENDING" | "PAID" | "CANCELLED";
  metadata: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Validation Rules
```typescript
order:         { required: true, ref: 'Order' }
branch:        { required: true, ref: 'Branch' }
vendor:        { required: true, ref: 'Vendor' }
invoiceNumber: { required: true, unique: true }
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

#### `getInvoices()`
**Purpose:** Lists all invoices with optional filtering and pagination.  
**Access:** Admin  
**Validation:** None.  
**Response:** Paginated list of invoices.

#### `getInvoiceById()`
**Purpose:** Retrieves details for a specific invoice.  
**Access:** Admin  
**Validation:** Valid invoice ID.  
**Response:** Invoice with populated order, vendor, and branch details.

---

## 🛣️ Invoice Routes

### Base Path: `/api/invoices`

```typescript
POST   /                // Create invoice (Admin/Vendor)
GET    /                // List invoices (Admin)
GET    /:id             // Get by ID (Admin)
```

---

## 📝 API Examples

### Create Invoice
```bash
curl -X POST http://localhost:3500/api/invoices \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
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

### Get Invoices (Admin)
```bash
curl -X GET "http://localhost:3500/api/invoices?paymentStatus=PENDING" \
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

---

## 📊 Database Indexes

```typescript
invoiceSchema.index({ order: 1 });
invoiceSchema.index({ paymentStatus: 1, createdAt: -1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
