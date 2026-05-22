# 🧺 DOHEZ-API - Laundry Management Documentation

## 📋 Table of Contents
- [Laundry Management Overview](#laundry-management-overview)
- [Laundry Model](#-laundry-model)
- [Laundry Controller](#-laundry-controller)
- [Laundry Routes](#-laundry-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Laundry Management Overview

The Laundry resource manages customer requests for laundry services. It tracks the status of the laundry, pickup scheduling, and service associations. All operations are authenticated via JWT and governed by role-based access control (RBAC).

---

## 🧺 Laundry Model

### Schema Definition
```typescript
interface ILaundry extends Document {
  laundryNumber: string;
  pickUpDate: {
    day: Date;
    hour: string;
  };
  dropDate?: Date;
  services: Types.ObjectId[] | IProduct[];
  customer: Types.ObjectId | IUser;
  vendor: Types.ObjectId | IVendor;
  branch: Types.ObjectId | IBranch;
  location: {
    address: string;
    coordinates: {
      lat: number;
      lng: number;
    };
    place_id?: string;
  };
  status: 'PENDING' | 'CONFIRMED' | 'PICKED_UP' | 'IN_PROGRESS' | 'COMPLETED' | 'DELIVERED';
  bookingFee: number;
  remainingAmount: number;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Laundry.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { ILaundry } from '../types/laundry';

const laundrySchema = new Schema<ILaundry>(
  {
    laundryNumber: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    pickUpDate: {
      day: { type: Date, required: true },
      hour: { type: String, required: true },
    },
    dropDate: {
      type: Date,
      required: false,
    },
    services: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
      },
    ],
    customer: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    location: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      place_id: { type: String },
    },
    status: {
      type: String,
      enum: ['PENDING', 'CONFIRMED', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED'],
      default: 'PENDING',
    },
    bookingFee: {
      type: Number,
      required: true,
      default: 0,
    },
    remainingAmount: {
      type: Number,
      required: true,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Laundry = mongoose.model<ILaundry>('Laundry', laundrySchema);

export default Laundry;
```

### Validation Rules
```typescript
laundryNumber:   { required: true, unique: true }
pickUpDate:      { day: required, hour: required }
dropDate:        { optional }
services:        { required: true, minItems: 1, ref: 'Product' }
customer:        { required: true, ref: 'User' }
vendor:          { required: true, ref: 'Vendor' }
branch:          { required: true, ref: 'Branch' }
location:        { address: required, coordinates: required }
status:          { default: 'PENDING', enum: ['PENDING', 'CONFIRMED', 'PICKED_UP', 'IN_PROGRESS', 'COMPLETED', 'DELIVERED'] }
bookingFee:      { default: 0 }
remainingAmount: { default: 0 }
```

---

## 🎮 Laundry Controller

**Files:** `src/controllers/laundryController.ts`, `src/controllers/paymentController.ts`

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import Laundry from "../models/Laundry";
import { errorHandler } from "../middleware/errorHandler";
```

### Functions Overview

#### `getLaundries()`
**Purpose:** Retrieve a paginated list of laundry requests with support for filtering.  
**Access:** Admin, Staff  
**Validation:** Query parameters (page, limit, branch, vendor, status)  
**Process:** Filter, paginate, and return laundry records  
**Response:** Paginated list of laundry requests

**Controller Implementation:**
```typescript
export const getLaundries = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, branch, vendor, status, startDate, endDate } = req.query;
    const query: any = {};

    if (search) {
      query.laundryNumber = { $regex: search, $options: "i" };
    }
    if (branch) query.branch = branch;
    if (vendor) query.vendor = vendor;
    if (status) query.status = status;
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate as string);
      if (endDate) query.createdAt.$lte = new Date(endDate as string);
    }

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };
    const laundries = await Laundry.find(query)
      .populate("customer vendor branch services")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Laundry.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        laundries,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalLaundries: total,
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

#### `getLaundry()`
**Purpose:** Get details of a specific laundry request.  
**Access:** Authenticated users  
**Validation:** Laundry must exist  
**Process:** Find record and populate references  
**Response:** Laundry details

**Controller Implementation:**
```typescript
export const getLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const laundry = await Laundry.findById(req.params.laundryId).populate("customer vendor branch services");
    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    res.status(200).json({
      success: true,
      data: { laundry }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `updateLaundry()`
**Purpose:** Update laundry details such as status, pickup/drop-off dates, or location.  
**Access:** Admin, Staff  
**Validation:** Laundry must exist  
**Process:** Update fields and save  
**Response:** Success message and updated laundry

**Controller Implementation:**
```typescript
export const updateLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { status, pickUpDate, dropDate, location } = req.body;
    const laundry = await Laundry.findById(req.params.laundryId);

    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    if (status) laundry.status = status;
    if (pickUpDate) laundry.pickUpDate = pickUpDate;
    if (dropDate) laundry.dropDate = dropDate;
    if (location) laundry.location = location;

    await laundry.save();

    res.status(200).json({
      success: true,
      message: "Laundry updated successfully",
      data: { laundry }
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `deleteLaundry()`
**Purpose:** Remove a laundry request from the system.  
**Access:** Admin  
**Validation:** Laundry must exist  
**Process:** Delete record  
**Response:** Success message

**Controller Implementation:**
```typescript
export const deleteLaundry = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const laundry = await Laundry.findByIdAndDelete(req.params.laundryId);
    if (!laundry) return next(errorHandler(404, "Laundry request not found"));

    res.status(200).json({
      success: true,
      message: "Laundry request deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
```

#### `bookLaundry()`
**Purpose:** Book a laundry service, create an invoice, and initiate payment.  
**Access:** Authenticated users  
**Validation:** Valid vendor, branch, and services. Phone number required for M-Pesa.  
**Process:** Create Laundry, create Invoice, and initiate M-Pesa STK push.  
**Response:** Success message, laundry, and payment details

**Controller Implementation:**
```typescript
export const bookLaundry = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { 
      vendorId, 
      branchId, 
      location, 
      services, 
      pickUpDate, 
      paymentMethod, 
      phoneNumber 
    } = req.body;
    
    const userId = (req as any).user?._id;

    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, 'Vendor not found'));

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, 'Branch not found'));

    const serviceProducts = await Product.find({ _id: { $in: services } });
    if (serviceProducts.length !== services.length) {
      return next(errorHandler(404, 'One or more services not found'));
    }

    const totalAmount = serviceProducts.reduce((sum, p) => sum + (p.offerPrice || p.price), 0);

    const laundry = await Laundry.create({
      laundryNumber: await generateLaundryNumber(),
      customer: userId,
      vendor: vendorId,
      branch: branchId,
      location,
      services,
      pickUpDate,
      status: 'PENDING',
      remainingAmount: totalAmount
    });

    const invoice = await Invoice.create({
      laundry: laundry._id,
      branch: branchId,
      vendor: vendorId,
      invoiceNumber: await generateInvoiceNumber(),
      subtotal: totalAmount,
      total: totalAmount,
      balanceDue: totalAmount,
      paymentStatus: 'PENDING'
    });

    if (paymentMethod === 'mpesa') {
      if (!phoneNumber) return next(errorHandler(400, 'phoneNumber is required for mpesa'));
      const msisdn = normalizePhoneNumber(phoneNumber);

      const { payment, res: darajaRes } = await initiateMpesaLaundryPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: branchId,
        vendor: vendorId,
        amount: totalAmount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });

      return res.status(202).json({
        success: true,
        message: 'Laundry booked and M-Pesa STK Push initiated',
        data: {
          laundryId: laundry._id,
          paymentId: payment._id,
          status: payment.status,
          daraja: {
            merchantRequestId: darajaRes.merchantRequestId,
            checkoutRequestId: darajaRes.checkoutRequestId
          }
        }
      });
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (error) {
    next(error);
  }
};
```

#### `payLaundryInvoice()`
**Purpose:** Initiate payment for an existing laundry invoice.  
**Access:** Authenticated users  
**Validation:** Invoice and associated laundry must exist and be unpaid.  
**Process:** Initiate M-Pesa STK push for the invoice balance.  
**Response:** Payment initiation details

**Controller Implementation:**
```typescript
export const payLaundryInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, method, payerPhone } = req.body;

    if (!invoiceId || !method) {
      return next(errorHandler(400, 'invoiceId and method are required'));
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));
    
    if (!invoice.laundry) return next(errorHandler(400, 'Invoice is not associated with a laundry request'));

    const laundry = await Laundry.findById(invoice.laundry);
    if (!laundry) return next(errorHandler(404, 'Laundry request not found'));

    if (invoice.paymentStatus === 'PAID') return next(errorHandler(409, 'Invoice already paid'));
    if (invoice.paymentStatus === 'CANCELLED') return next(errorHandler(409, 'Invoice is cancelled'));

    const amount = invoice.balanceDue;
    const userId = (req as any).user?._id;

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));
      const msisdn = normalizePhoneNumber(payerPhone);

      const { payment, res: darajaRes } = await initiateMpesaLaundryPayment({
        invoiceId: invoice._id,
        customer: userId,
        branch: invoice.branch as any,
        vendor: invoice.vendor as any,
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });

      return res.status(202).json({
        success: true,
        message: 'Payment initiated for laundry',
        data: {
          paymentId: payment._id,
          status: payment.status,
          daraja: {
            merchantRequestId: darajaRes.merchantRequestId,
            checkoutRequestId: darajaRes.checkoutRequestId
          }
        }
      });
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (error) {
    next(error);
  }
};
```

---

## 🛣️ Laundry Routes

### Base Path: `/api/laundries` (Management) & `/api/payments/laundries` (Payments)

```typescript
GET    /api/laundries                 // Get all laundries (admin/staff)
GET    /api/laundries/:laundryId      // Get single laundry (auth)
PUT    /api/laundries/:laundryId      // Update laundry (admin/staff)
DELETE /api/laundries/:laundryId      // Delete laundry (admin)

POST   /api/payments/laundries/book   // Book and initiate payment (auth)
POST   /api/payments/laundries/pay    // Pay existing invoice (auth)
```

### Router Implementation

**File: `src/routes/laundryRoutes.ts` & `src/routes/paymentRoutes.ts`**

```typescript
// Laundry Management Routes
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'staff']), getLaundries);
router.get('/:laundryId', authenticateToken, getLaundry);
router.put('/:laundryId', authenticateToken, authorizeRoles(['admin', 'super_admin', 'staff']), updateLaundry);
router.delete('/:laundryId', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteLaundry);

// Laundry Payment Routes
router.post('/laundries/book', authenticateToken, bookLaundry);
router.post('/laundries/pay', authenticateToken, payLaundryInvoice);
```

### Route Details

#### `GET /api/laundries`
**Headers:** `Authorization: Bearer <token>`
**Query Params:**
- `page`: 1
- `limit`: 10
- `search`: "LND-2026-0001"
- `branch`: "650af1234567890abcdef123"
- `vendor`: "650af1234567890abcdef124"
- `status`: "PENDING"
**Response:**
```json
{
  "success": true,
  "data": {
    "laundries": [
      {
        "id": "650af1234567890abcdef125",
        "laundryNumber": "LND-2026-0001",
        "status": "PENDING",
        "remainingAmount": 2500,
        "createdAt": "2026-05-22T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalLaundries": 48,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

#### `POST /api/payments/laundries/book`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "vendorId": "650af1234567890abcdef124",
  "branchId": "650af1234567890abcdef123",
  "location": {
    "address": "123 Ngong Road, Nairobi",
    "coordinates": {
      "lat": -1.3005,
      "lng": 36.7846
    }
  },
  "services": [
    "650af1234567890abcdef126",
    "650af1234567890abcdef127"
  ],
  "pickUpDate": {
    "day": "2026-05-25",
    "hour": "10:30"
  },
  "paymentMethod": "mpesa",
  "phoneNumber": "254712345678"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Laundry booked and M-Pesa STK Push initiated",
  "data": {
    "laundryId": "650af1234567890abcdef128",
    "paymentId": "650af1234567890abcdef129",
    "status": "INITIATED",
    "daraja": {
      "merchantRequestId": "29115-34620561-1",
      "checkoutRequestId": "ws_CO_22052026103000123"
    }
  }
}
```

#### `POST /api/payments/laundries/pay`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "invoiceId": "650af1234567890abcdef130",
  "method": "mpesa",
  "payerPhone": "254712345678"
}
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated for laundry",
  "data": {
    "paymentId": "650af1234567890abcdef131",
    "status": "INITIATED",
    "daraja": {
      "merchantRequestId": "29115-34620561-2",
      "checkoutRequestId": "ws_CO_22052026103500456"
    }
  }
}
```

#### `GET /api/laundries/:laundryId`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "laundry": {
      "id": "650af1234567890abcdef128",
      "laundryNumber": "LND-2026-0002",
      "pickUpDate": {
        "day": "2026-05-25T00:00:00.000Z",
        "hour": "10:30"
      },
      "status": "PENDING",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com"
      },
      "vendor": {
        "name": "Sparkle Cleaners"
      },
      "services": [
        {
          "name": "Dry Cleaning",
          "price": 1200
        }
      ]
    }
  }
}
```

#### `PUT /api/laundries/:laundryId`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "status": "CONFIRMED",
  "pickUpDate": {
    "day": "2026-05-26",
    "hour": "14:00"
  },
  "dropDate": "2026-05-28T16:00:00.000Z",
  "location": {
    "address": "456 Westlands Road, Nairobi"
  }
}
```
**Response:**
```json
{
  "success": true,
  "message": "Laundry updated successfully",
  "data": {
    "laundry": {
      "id": "650af1234567890abcdef128",
      "status": "CONFIRMED",
      "dropDate": "2026-05-28T16:00:00.000Z"
    }
  }
}
```

#### `DELETE /api/laundries/:laundryId`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "Laundry request deleted successfully"
}
```

---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.get('/:laundryId', authenticateToken, getLaundry);
```

#### `authorizeRoles(allowedRoles)`
**Purpose:** Check if user has any of the allowed roles  
**Usage:**
```typescript
router.get('/', authenticateToken, authorizeRoles(['admin', 'super_admin', 'staff']), getLaundries);
```

#### `requireAdmin`
**Purpose:** Admin access only (admin/super_admin)  
**Usage:**
```typescript
router.delete('/:laundryId', authenticateToken, authorizeRoles(['admin', 'super_admin']), deleteLaundry);
```

---

## 📝 API Examples

### Get All Laundries
```bash
curl -X GET "http://localhost:3500/api/laundries?page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "laundries": [
      {
        "id": "650af1234567890abcdef125",
        "laundryNumber": "LND-2026-0001",
        "status": "PENDING",
        "remainingAmount": 2500,
        "createdAt": "2026-05-22T10:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalLaundries": 48,
      "hasNextPage": true,
      "hasPrevPage": false
    }
  }
}
```

### Book Laundry
```bash
curl -X POST http://localhost:3500/api/payments/laundries/book \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "vendorId": "650af1234567890abcdef124",
    "branchId": "650af1234567890abcdef123",
    "location": {
      "address": "123 Ngong Road, Nairobi",
      "coordinates": {
        "lat": -1.3005,
        "lng": 36.7846
      }
    },
    "services": [
      "650af1234567890abcdef126",
      "650af1234567890abcdef127"
    ],
    "pickUpDate": {
      "day": "2026-05-25",
      "hour": "10:30"
    },
    "paymentMethod": "mpesa",
    "phoneNumber": "254712345678"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Laundry booked and M-Pesa STK Push initiated",
  "data": {
    "laundryId": "650af1234567890abcdef128",
    "paymentId": "650af1234567890abcdef129",
    "status": "INITIATED",
    "daraja": {
      "merchantRequestId": "29115-34620561-1",
      "checkoutRequestId": "ws_CO_22052026103000123"
    }
  }
}
```

### Pay Laundry Invoice
```bash
curl -X POST http://localhost:3500/api/payments/laundries/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "650af1234567890abcdef130",
    "method": "mpesa",
    "payerPhone": "254712345678"
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Payment initiated for laundry",
  "data": {
    "paymentId": "650af1234567890abcdef131",
    "status": "INITIATED",
    "daraja": {
      "merchantRequestId": "29115-34620561-2",
      "checkoutRequestId": "ws_CO_22052026103500456"
    }
  }
}
```

### Get Laundry Details
```bash
curl -X GET http://localhost:3500/api/laundries/650af1234567890abcdef128 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "laundry": {
      "id": "650af1234567890abcdef128",
      "laundryNumber": "LND-2026-0002",
      "pickUpDate": {
        "day": "2026-05-25T00:00:00.000Z",
        "hour": "10:30"
      },
      "status": "PENDING",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com"
      },
      "vendor": {
        "name": "Sparkle Cleaners"
      },
      "services": [
        {
          "name": "Dry Cleaning",
          "price": 1200
        }
      ]
    }
  }
}
```

### Update Laundry
```bash
curl -X PUT http://localhost:3500/api/laundries/650af1234567890abcdef128 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "status": "CONFIRMED",
    "pickUpDate": {
      "day": "2026-05-26",
      "hour": "14:00"
    },
    "dropDate": "2026-05-28T16:00:00.000Z",
    "location": {
      "address": "456 Westlands Road, Nairobi"
    }
  }'
```
**Response:**
```json
{
  "success": true,
  "message": "Laundry updated successfully",
  "data": {
    "laundry": {
      "id": "650af1234567890abcdef128",
      "status": "CONFIRMED",
      "dropDate": "2026-05-28T16:00:00.000Z"
    }
  }
}
```

### Delete Laundry
```bash
curl -X DELETE http://localhost:3500/api/laundries/650af1234567890abcdef128 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Laundry request deleted successfully"
}
```

---

## 🛡️ Security Features

- **RBAC:** Route-level authorization ensures only authorized roles can list, update, or delete laundry requests.
- **Least Privilege:** Sensitive operations like deletion are restricted to `admin`.
- **Data Integrity:** Validations ensure that only valid vendors, branches, and services are associated with a laundry request.

---

## 🚨 Error Handling

Common responses:
```json
{ "success": false, "message": "..." }
```
- `404`: Laundry request, vendor, branch, or service not found.
- `400`: Missing required fields (e.g., phoneNumber for M-Pesa).
- `409`: Payment already completed or invoice cancelled.

---

## 📊 Database Indexes

```typescript
laundrySchema.index({ laundryNumber: 1 });
laundrySchema.index({ customer: 1 });
laundrySchema.index({ vendor: 1 });
laundrySchema.index({ status: 1 });
```

---

**Last Updated:** May 2026  
**Version:** 1.0.0
