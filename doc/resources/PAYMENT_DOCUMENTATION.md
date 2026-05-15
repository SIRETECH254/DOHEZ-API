# 💰 TEO KICKS API - Payment Management Documentation

## 📋 Table of Contents
- [Payment Management Overview](#payment-management-overview)
- [Payment Model](#-payment-model)
- [Payment Controller](#-payment-controller)
- [Payment Routes](#-payment-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Payment Management Overview

Payment Management handles the processing of payments for invoices within the TEO KICKS API system. It supports multiple payment methods including M-Pesa STK Push (via Daraja API), Paystack card payments, cash payments, post-to-bill, and cash on delivery (COD). Payments are linked to invoices, which are linked to orders, creating a complete transactional flow. Upon successful payment, the system automatically updates invoice and order payment statuses, generates receipts, and updates inventory.

**Key Features:**
- **Multiple Payment Methods:** Supports M-Pesa STK Push, Paystack card payments, cash, post-to-bill, and COD
- **Webhook Integration:** Real-time payment callbacks from M-Pesa and Paystack
- **Automatic Receipt Generation:** Receipts are automatically created upon successful payment
- **Inventory Management:** Stock quantities are automatically updated when payments succeed
- **Real-time Updates:** Socket.io events notify connected clients of payment status changes
- **Status Queries:** Fallback polling endpoints to check payment status

---

## 👤 Payment Model

### Schema Definition
```typescript
export interface IPayment extends Document {
  paymentNumber: string;
  invoice?: Types.ObjectId | IInvoice;
  branch: Types.ObjectId | IBranch;
  vendor: Types.ObjectId | IVendor;
  method: "mpesa" | "paystack" | "cash" | "post_to_bill" | "cod";
  amount: number;
  currency: string;
  processorRefs?: {
    daraja?: {
      merchantRequestId?: string;
      checkoutRequestId?: string;
    };
    paystack?: {
      reference?: string;
    };
  };
  status: "INITIATED" | "PENDING" | "SUCCESS" | "FAILED" | "CANCELLED";
  type?: "BOOKING_FEE" | "FULLPAYMENT";
  rawPayload?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `../models/paymentModel.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IPayment } from '../types';

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
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
    method: {
      type: String,
      enum: ['mpesa', 'paystack', 'cash', 'post_to_bill', 'cod'],
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    currency: {
      type: String,
      default: 'KES',
    },
    processorRefs: {
      daraja: {
        merchantRequestId: { type: String },
        checkoutRequestId: { type: String },
      },
      paystack: {
        reference: { type: String },
      },
    },
    status: {
      type: String,
      enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'],
      default: 'INITIATED',
    },
    type: {
      type: String,
      enum: ['BOOKING_FEE', 'FULLPAYMENT'],
    },
    rawPayload: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

paymentSchema.index({ invoice: 1 });
paymentSchema.index({ paymentNumber: 1 });

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
```

### Validation Rules
```javascript
paymentNumber:    { required: true, type: String, unique: true }
invoice:          { type: ObjectId, ref: 'Invoice' }
branch:           { required: true, type: ObjectId, ref: 'Branch' }
vendor:           { required: true, type: ObjectId, ref: 'Vendor' }
method:           { required: true, type: String, enum: ['mpesa', 'paystack', 'cash', 'post_to_bill', 'cod'] }
amount:           { required: true, type: Number, min: 0 }
currency:         { type: String, default: 'KES' }
processorRefs:    { type: Object }
  daraja:           { type: Object }
    merchantRequestId: { type: String }
    checkoutRequestId:  { type: String }
  paystack:         { type: Object }
    reference:         { type: String }
status:           { type: String, enum: ['INITIATED', 'PENDING', 'SUCCESS', 'FAILED', 'CANCELLED'], default: 'INITIATED' }
type:             { type: String, enum: ['BOOKING_FEE', 'FULLPAYMENT'] }
rawPayload:       { type: Mixed, default: {} }
```

---

## 🎮 Payment Controller

### Required Imports
```typescript
import { Request, Response, NextFunction } from 'express';
import Payment from '../models/paymentModel';
import Invoice from '../models/Invoice';
import Order from '../models/Order';
import Receipt from '../models/receiptModel';
import { createPaymentRecord, initiateMpesaProductPayment, applySucceFullProductPayment } from '../services/internal/paymentService';
import { normalizePhoneNumber, parseCallback as parseDarajaCallback } from '../services/external/darajaService';
import { errorHandler } from '../middleware/errorHandler';
```

### Functions Overview

#### `confirmAppointment()`
**Purpose:** Validates appointment slot and initiates a booking fee payment.  
**Access:** Private (Authenticated User)  
**Validation:** Appointment must exist, not be completed/cancelled/no-show, not be in the past, and slot must be available (validated via `validateOptionAvailability`).  
**Process:** Validates slot, creates an invoice, and initiates M-Pesa STK Push if method is 'mpesa'.  
**Response:** Success message, and appointment details.

**Controller Implementation:**
```typescript
export const confirmAppointment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { appointmentId } = req.params;
    const { method, payerPhone } = req.body || {};

    if (!appointmentId || !method) {
      return next(errorHandler(400, 'appointmentId (params) and method are required'));
    }

    const appointment = await Appointment.findById(appointmentId).populate('items.service');
    if (!appointment) return next(errorHandler(404, 'Appointment not found'));

    if (['COMPLETED', 'CANCELLED', 'NO_SHOW'].includes(appointment.status)) {
      return next(errorHandler(400, 'Cannot pay for a completed, cancelled, or no-show appointment'));
    }

    if (appointment.overallStartTime < new Date()) {
      return next(errorHandler(400, 'Appointment time is in the past'));
    }

    const availability = await validateOptionAvailability(
      String(appointment.branch),
      String(appointment.vendor),
      appointment.items.map(item => ({
        serviceId: (item.service as any)._id,
        staffId: String(item.staff),
        startTime: item.startTime,
        endTime: item.endTime
      })),
      String(appointment._id)
    );

    if (!availability.ok) {
      return next(errorHandler(400, availability.message || 'Appointment slot is no longer available'));
    }

    const invoice = await Invoice.create({
      appointment: appointment._id,
      branch: appointment.branch,
      vendor: appointment.vendor,
      subtotal: appointment.bookingFeeAmount,
      total: appointment.bookingFeeAmount,
      balanceDue: appointment.remainingAmount,
      paymentStatus: 'PENDING',
      invoiceNumber: await generateInvoiceNumber()
    });

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
        branch: appointment.branch,
        vendor: appointment.vendor,
        amount: appointment.bookingFeeAmount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'BOOKING_FEE'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: 'Booking fee initiated',
      data: { appointment } 
    });
  } catch (err) {
    next(err);
  }
};
```

#### `payAppointmentInvoice()`
**Purpose:** Pay the appointment invoice (full payment).  
**Access:** Private (Authenticated User)  
**Validation:** Invoice must exist and not be paid/cancelled. Appointment must not be completed/cancelled/no-show.  
**Process:** Retrieves invoice by appointment ID, validates statuses, and initiates M-Pesa STK Push (as 'FULLPAYMENT') if method is 'mpesa'.  
**Response:** Success message, appointment, and invoice details.

**Controller Implementation:**
```typescript
export const payAppointmentInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { payerPhone, method, appointmentId } = req.body || {};

    if (!appointmentId || !method) {
      return next(errorHandler(400, 'appointmentId and method are required'));
    }

    const invoice = await Invoice.findOne({ appointment: appointmentId });
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));

    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) return next(errorHandler(404, 'Appointment not found'));

    if (invoice.paymentStatus === 'PAID') return next(errorHandler(409, 'Invoice already paid'));
    if (invoice.paymentStatus === 'CANCELLED') return next(errorHandler(409, 'Invoice is cancelled'));

    if (appointment.status === 'COMPLETED') return next(errorHandler(409, 'Appointment is already completed'));
    if (appointment.status === 'CANCELLED') return next(errorHandler(409, 'Appointment is cancelled'));
    if (appointment.status === 'NO_SHOW') return next(errorHandler(409, 'Appointment was a no-show'));

    const amount = invoice.balanceDue;

    if (method === 'mpesa') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa'));

      const msisdn = normalizePhoneNumber(payerPhone);

      await initiateMpesaAppointmentPayment({
        invoiceId: invoice._id,
        branch: appointment.branch,
        vendor: appointment.vendor,
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber,
        type: 'FULLPAYMENT'
      });
    }

    return res.status(200).json({ 
      success: true, 
      message: "appointment paidfully",
      data: { appointment, invoice } 
    });
  } catch (err) {
    next(err);
  }
};
```

**Purpose:** Main payment initiation endpoint. Supports M-Pesa STK Push and creates payment records.  
**Access:** Private (Authenticated User)  
**Validation:** `invoiceId` and `method` are required. `payerPhone` is required for `mpesa_stk`.  
**Process:** Validates invoice existence and status. Creates a payment record via `createPaymentRecord`. If method is `mpesa_stk`, normalizes the phone number and initiates the M-Pesa payment.  
**Response:** Payment ID, status, and Daraja references for M-Pesa.

**Controller Implementation:**
```typescript
export const payProductInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const {
      invoiceId,
      method,
      amount: clientAmount,
      payerPhone,
    } = req.body || {};

    if (!invoiceId || !method) {
      return next(errorHandler(400, 'invoiceId and method are required'));
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));

    if (invoice.paymentStatus === 'PAID') {
      return next(errorHandler(409, 'Invoice already paid'));
    }
    if (invoice.paymentStatus === 'CANCELLED') {
      return next(errorHandler(409, 'Invoice is cancelled'));
    }

    const amount = typeof clientAmount === 'number' ? clientAmount : invoice.balanceDue;
    if (!amount || amount <= 0) {
      return next(errorHandler(400, 'Invalid amount to charge'));
    }

    const payment = await createPaymentRecord({
      invoice: invoice._id,
      branch: invoice.branch as any,
      vendor: invoice.vendor as any,
      amount,
      method: method === 'mpesa_stk' ? 'mpesa' : 'paystack'
    });

    if (method === 'mpesa_stk') {
      if (!payerPhone) return next(errorHandler(400, 'payerPhone is required for mpesa_stk'));

      const msisdn = normalizePhoneNumber(payerPhone);

      const { payment: updatedPayment, res: darajaRes } = await initiateMpesaProductPayment({
        invoiceId: invoice._id,
        branch: invoice.branch as any,
        vendor: invoice.vendor as any,
        amount,
        phone: msisdn,
        invoiceNumber: invoice.invoiceNumber
      });

      return res.status(202).json({ 
        success: true, 
        data: { 
          paymentId: updatedPayment._id, 
          status: updatedPayment.status, 
          daraja: { 
            merchantRequestId: darajaRes.merchantRequestId, 
            checkoutRequestId: darajaRes.checkoutRequestId 
          } 
        } 
      });
    }

    if (method === 'paystack_card') {
      return next(errorHandler(501, 'paystack_card method not yet implemented'));
    }

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (err) {
    next(err);
  }
};
```

#### `mpesaWebhook()`
**Purpose:** Handles M-Pesa STK Push callback webhooks from Safaricom.  
**Access:** Public (no authentication required)  
**Validation:** Validates the webhook payload structure.  
**Process:** Parses the payload, finds the payment record, and updates its status. If successful, checks if the linked invoice belongs to an order or an appointment and routes to the appropriate handler (`applySucceFullProductPayment` or `applySuccessFullAppointmentPayment`). Emits real-time updates via Socket.io.  
**Response:** Success message.

**Controller Implementation:**
```typescript
export const mpesaWebhook = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const payload = req.body;

    const parsed = parseDarajaCallback(payload);

    if (payload?.Body?.stkCallback) {
      io.emit("callback.received", { 
        message: payload?.Body?.stkCallback.ResultDesc, 
        CODE: payload?.Body?.stkCallback.ResultCode 
      });
    }

    if (!parsed.valid) return next(errorHandler(400, 'Invalid payload'));

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': parsed.checkoutRequestId });
    if (!payment) return next(errorHandler(404, 'Payment not found'));

    payment.rawPayload = payload;

    if (parsed.success) {
      const invoice = await Invoice.findById(payment.invoice);
      if (invoice) {
        if (invoice.order) {
          await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
        } else if (invoice.appointment) {
          await applySuccessFullAppointmentPayment({ invoice, payment, io, method: 'mpesa_stk' });
        }
      }
    } else {
      payment.status = 'FAILED';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
    }

    return res.json({ success: true });
  } catch (err) {
    next(err);
  }
};
```


#### `queryMpesaByCheckoutId()`
**Purpose:** Manually queries the status of an M-Pesa STK Push transaction.  
**Access:** Private (Authenticated User)  
**Validation:** `checkoutRequestId` is required.  
**Process:** Queries Safaricom's API for the transaction status. Updates the local payment and invoice records based on the result.  
**Response:** Current payment status and raw Daraja response.

**Controller Implementation:**
```typescript
export const queryMpesaByCheckoutId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checkoutRequestId } = req.params;
    const io = req.app.get('io');

    if (!checkoutRequestId) return next(errorHandler(400, 'checkoutRequestId is required'));

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': checkoutRequestId });
    if (!payment) return next(errorHandler(404, 'Payment not found for this checkout request'));

    const result = await queryStkPushStatus(checkoutRequestId);
    if (!result.ok) {
      return next(errorHandler(502, result.error || 'Failed to query Daraja API'));
    }

    const status = result.resultCode === 0 ? 'SUCCESS' : 'FAILED';
    
    if (result.resultCode === 0 && payment.status !== 'SUCCESS') {
      const invoice = await Invoice.findById(payment.invoiceId);
      if (invoice) {
        await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
      }
    } else if (result.resultCode !== 0 && payment.status !== 'FAILED') {
      payment.status = 'FAILED';
      await payment.save();
      io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
    }

    return res.json({ 
      success: true, 
      data: { 
        status, 
        resultCode: result.resultCode, 
        resultDesc: result.resultDesc,
        paymentId: payment._id,
        invoiceId: payment.invoiceId,
        raw: result.raw
      } 
    });
  } catch (err) {
    next(err);
  }
};
```

#### `getPayments()`
**Purpose:** Retrieves a paginated list of all payments. Supports searching by payment number and filtering by branch and vendor.  
**Access:** Private (Admin)  
**Validation:** Optional `page`, `limit`, `search`, `branch`, and `vendor` query parameters.  
**Process:** Filters payments based on query parameters, applies pagination, and returns the results sorted by creation date (newest first).  
**Response:** Paginated list of payment objects.

**Controller Implementation:**
```typescript
export const getPayments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, search, branch, vendor } = req.query;
    const query: any = {};

    if (search) {
      query.paymentNumber = { $regex: search, $options: 'i' };
    }

    if (branch) {
      query.branch = branch;
    }

    if (vendor) {
      query.vendor = vendor;
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const payments = await Payment.find(query)
      .populate('invoice')
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Payment.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            payments, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalPayments: total,
                hasNextPage: options.page < totalPages,
                hasPrevPage: options.page > 1
            } 
        } 
    });
  } catch (error) {
    next(error);
  }
};
```

#### `getPaymentById()`
**Purpose:** Retrieves a single payment by its ID with populated invoice details.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds the payment by ID and populates the `invoice` field.  
**Response:** A single payment object.

**Controller Implementation:**
```typescript
export const getPaymentById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const payment = await Payment.findById(req.params.id).populate('invoice');
    if (!payment) return next(errorHandler(404, 'Payment not found'));
    
    res.status(200).json({ success: true, data: { payment } });
  } catch (error) {
    next(error);
  }
};
```

---

## 💰 Payment Routes

### Base Path: `/api/payments`

### Router Implementation

**File: `../routes/paymentRoutes.ts`**

```typescript
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import { 
  payProductInvoice, 
  mpesaWebhook, 
  queryMpesaByCheckoutId, 
  getPayments, 
  getPaymentById 
} from '../controllers/paymentController';

const router = express.Router();

router.post('/pay', authenticateToken, payProductInvoice);

router.post('/webhooks/mpesa', mpesaWebhook);

router.get('/mpesa/:checkoutId', authenticateToken, queryMpesaByCheckoutId);

router.get('/', authenticateToken, requireAdmin, getPayments);

router.get('/:id', authenticateToken, requireAdmin, getPaymentById);

export default router;
```

### Route Details

#### `POST /api/payments/appointments/confirm/:appointmentId`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**URL Parameters:**
- `appointmentId`: `65e26b1c09b068c201383812`

**Request Body (JSON):**
```json
{
  "method": "mpesa",
  "payerPhone": "254712345678"
}
```

**Purpose:** Confirm appointment and initiate booking fee.
**Access:** Private (Authenticated User)
**Response (200 OK):**
```json
{
  "success": true,
  "message": "Booking fee initiated",
  "data": {
    "appointment": {
      "_id": "65e26b1c09b068c201383812",
      "status": "PENDING",
      "bookingFeeAmount": 500
    }
  }
}
```

#### `POST /api/payments/appointments/pay`
**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "appointmentId": "65e26b1c09b068c201383812",
  "method": "mpesa",
  "payerPhone": "254712345678"
}
```

**Purpose:** Pay appointment invoice.
**Access:** Private (Authenticated User)
**Response (200 OK):**
```json
{
  "success": true,
  "message": "appointment paidfully",
  "data": {
    "appointment": {
      "_id": "65e26b1c09b068c201383812",
      "status": "CONFIRMED"
    },
    "invoice": {
      "_id": "66389f4b52e2a1b4e8d1a2c3",
      "invoiceNumber": "INV-2026-001",
      "paymentStatus": "PENDING"
    }
  }
}
```

**Headers:** 
- `Authorization: Bearer <token>`
- `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "mpesa_stk",
  "amount": 1550,
  "payerPhone": "254712345678"
}
```

**Purpose:** Initiate payment for an invoice.
**Access:** Private (Authenticated User)
**Response (202 Accepted):**
```json
{
  "success": true,
  "data": {
    "paymentId": "66389f4b52e2a1b4e8d1a2c3",
    "status": "PENDING",
    "daraja": {
      "merchantRequestId": "29115-1234567-1",
      "checkoutRequestId": "ws_CO_06052026123456789"
    }
  }
}
```

#### `POST /api/payments/webhooks/mpesa`
**Headers:** 
- `Content-Type: application/json`

**Request Body (JSON):**
```json
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "29115-1234567-1",
      "CheckoutRequestID": "ws_CO_06052026123456789",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {
            "Name": "Amount",
            "Value": 1550.00
          },
          {
            "Name": "MpesaReceiptNumber",
            "Value": "NLJ7RT61AS"
          },
          {
            "Name": "Balance",
            "Value": 0
          },
          {
            "Name": "TransactionDate",
            "Value": 20260506123456
          },
          {
            "Name": "PhoneNumber",
            "Value": 254712345678
          }
        ]
      }
    }
  }
}
```

**Purpose:** Receive M-Pesa STK Push callback notifications from Safaricom.
**Access:** Public
**Response:** `200 OK`
```json
{
  "success": true
}
```

#### `GET /api/payments/mpesa/:checkoutId`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `checkoutId`: `ws_CO_06052026123456789`

**Purpose:** Manually query the status of an M-Pesa STK Push transaction.
**Access:** Private (Authenticated User)
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    "paymentId": "66389f4b52e2a1b4e8d1a2c3",
    "invoiceId": "65e26b1c09b068c201383812",
    "raw": {
      "MerchantRequestID": "29115-1234567-1",
      "CheckoutRequestID": "ws_CO_06052026123456789",
      "ResponseCode": "0",
      "ResponseDescription": "The service request has been accepted successsfully",
      "ResultCode": "0",
      "ResultDesc": "The service request is processed successfully."
    }
  }
}
```

#### `GET /api/payments`
**Headers:** 
- `Authorization: Bearer <token>`

**Query Parameters:**
- `page`: `1`
- `limit`: `10`
- `search`: `PAY-2026`
- `branch`: `65e26b1c09b068c201383810`
- `vendor`: `65e26b1c09b068c201383805`

**Purpose:** List all payments with optional searching and filtering.
**Access:** Private (Admin)
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "66389f4b52e2a1b4e8d1a2c3",
        "paymentNumber": "PAY-2026-0001",
        "invoice": "65e26b1c09b068c201383812",
        "branch": "65e26b1c09b068c201383810",
        "vendor": "65e26b1c09b068c201383805",
        "method": "mpesa",
        "amount": 1550,
        "status": "SUCCESS",
        "createdAt": "2026-05-06T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalPayments": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

#### `GET /api/payments/:id`
**Headers:** 
- `Authorization: Bearer <token>`

**URL Parameters:**
- `id`: `66389f4b52e2a1b4e8d1a2c3`

**Purpose:** Retrieve a single payment by its unique identifier.
**Access:** Private (Admin)
**Response (200 OK):**
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "66389f4b52e2a1b4e8d1a2c3",
      "paymentNumber": "PAY-2026-0001",
      "invoice": {
        "_id": "65e26b1c09b068c201383812",
        "invoiceNumber": "INV-2026-001",
        "total": 1550,
        "paymentStatus": "PAID"
      },
      "branch": "65e26b1c09b068c201383810",
      "vendor": "65e26b1c09b068c201383805",
      "method": "mpesa",
      "amount": 1550,
      "status": "SUCCESS",
      "createdAt": "2026-05-06T12:00:00.000Z"
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
router.post('/pay', authenticateToken, payProductInvoice);
```

#### `requireAdmin`
**Purpose:** Ensure the authenticated user has administrative privileges  
**Usage:**
```typescript
router.get('/', authenticateToken, requireAdmin, getPayments);
```

---

## 📝 API Examples

### Confirm Appointment and Initiate Booking Fee
```bash
curl -X POST http://localhost:5000/api/payments/appointments/confirm/65e26b1c09b068c201383812 \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "method": "mpesa",
    "payerPhone": "254712345678"
  }'
```

### Pay Appointment Invoice
```bash
curl -X POST http://localhost:5000/api/payments/appointments/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "appointmentId": "65e26b1c09b068c201383812",
    "method": "mpesa",
    "payerPhone": "254712345678"
  }'
```

```bash
curl -X POST http://localhost:5000/api/payments/pay \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer <access_token>" \
  -d '{
    "invoiceId": "65e26b1c09b068c201383812",
    "method": "mpesa_stk",
    "amount": 1550,
    "payerPhone": "254712345678"
  }'
```
**Body:**
```json
{
  "invoiceId": "65e26b1c09b068c201383812",
  "method": "mpesa_stk",
  "amount": 1550,
  "payerPhone": "254712345678"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "paymentId": "66389f4b52e2a1b4e8d1a2c3",
    "status": "PENDING",
    "daraja": {
      "merchantRequestId": "29115-1234567-1",
      "checkoutRequestId": "ws_CO_06052026123456789"
    }
  }
}
```

### Query M-Pesa Status
```bash
curl -X GET http://localhost:5000/api/payments/mpesa/ws_CO_06052026123456789 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "status": "SUCCESS",
    "resultCode": 0,
    "resultDesc": "The service request is processed successfully.",
    "paymentId": "66389f4b52e2a1b4e8d1a2c3",
    "invoiceId": "65e26b1c09b068c201383812",
    "raw": {
      "MerchantRequestID": "29115-1234567-1",
      "CheckoutRequestID": "ws_CO_06052026123456789",
      "ResultCode": "0",
      "ResultDesc": "The service request is processed successfully."
    }
  }
}
```

### List All Payments (Admin)
```bash
curl -X GET "http://localhost:5000/api/payments?page=1&limit=10&search=PAY-2026" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "payments": [
      {
        "_id": "66389f4b52e2a1b4e8d1a2c3",
        "paymentNumber": "PAY-2026-0001",
        "invoice": "65e26b1c09b068c201383812",
        "branch": "65e26b1c09b068c201383810",
        "vendor": "65e26b1c09b068c201383805",
        "method": "mpesa",
        "amount": 1550,
        "status": "SUCCESS",
        "createdAt": "2026-05-06T12:00:00.000Z"
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 1,
      "totalPayments": 1,
      "hasNextPage": false,
      "hasPrevPage": false
    }
  }
}
```

### Get Payment Details (Admin)
```bash
curl -X GET http://localhost:5000/api/payments/66389f4b52e2a1b4e8d1a2c3 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "payment": {
      "_id": "66389f4b52e2a1b4e8d1a2c3",
      "paymentNumber": "PAY-2026-0001",
      "invoice": {
        "_id": "65e26b1c09b068c201383812",
        "invoiceNumber": "INV-2026-001",
        "total": 1550,
        "paymentStatus": "PAID"
      },
      "branch": "65e26b1c09b068c201383810",
      "vendor": "65e26b1c09b068c201383805",
      "method": "mpesa",
      "amount": 1550,
      "status": "SUCCESS",
      "createdAt": "2026-05-06T12:00:00.000Z"
    }
  }
}
```

---

## 🛡️ Security Features

- **Authentication:** All payment endpoints (except webhooks) require a valid JWT token. Webhook endpoints are public but should be secured using webhook signature verification in production.
- **Data Integrity:** Payments are strongly linked to invoices via `invoiceId`, maintaining a clear and auditable transactional history. Payment amounts are validated server-side to prevent manipulation.
- **Webhook Security:** Webhook endpoints should implement signature verification to ensure requests are from legitimate payment processors. Consider implementing IP whitelisting for webhook endpoints in production.
- **Phone Number Validation:** M-Pesa phone numbers are normalized and validated to ensure they match the Kenyan format (254XXXXXXXXX).
- **Amount Validation:** Payment amounts are validated against invoice `balanceDue` or `total` to prevent overpayment or underpayment.
- **Status Checks:** The system prevents payment processing for invoices that are already paid or cancelled.
- **Processor References:** Payment processor references (Daraja `checkoutRequestId`, Paystack `reference`) are stored to enable idempotent webhook processing and status queries.

---

## 🚨 Error Handling

Common HTTP status codes and their meanings:

- `400 Bad Request`: Invalid input (e.g., missing required fields, invalid phone format, invalid amount, unsupported payment method).
- `401 Unauthorized`: Missing or invalid authentication token.
- `404 Not Found`: The referenced invoice or payment was not found.
- `409 Conflict`: Invoice is already paid or cancelled, preventing duplicate payment processing.
- `502 Bad Gateway`: Error communicating with external payment processor (M-Pesa or Paystack).
- `500 Internal Server Error`: An unexpected server-side error occurred during processing.

---

## 📊 Database Indexes

```typescript
paymentSchema.index({ invoice: 1 });
paymentSchema.index({ paymentNumber: 1 });
```

---

**Last Updated:** February 2026
**Version:** 1.0.0
**Maintainer:** TEO KICKS API Development Team
