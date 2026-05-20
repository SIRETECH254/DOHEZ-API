# 💰 Saveplan API - Daraja (M-Pesa) Documentation

## 📋 Table of Contents
- [Daraja Overview](#daraja-overview)
- [Configuration](#configuration)
- [External Services](#external-services)
- [Internal Services](#internal-services)
- [Usage in Controllers](#usage-in-controllers)
- [Callbacks and Webhooks](#callbacks-and-webhooks)
- [Error Handling](#error-handling)
- [API Examples](#api-examples)

---

## Daraja Overview

Daraja is the API gateway for M-Pesa, a mobile money transfer service in Kenya. In this project, the Daraja API is integrated to facilitate M-Pesa payments for member contributions, specifically using the STK Push (Sim Tool Kit Push) functionality. This allows members to confirm payments directly from their mobile phones.

**Key Features:**
-   **STK Push Initiation:** Programmatically trigger M-Pesa STK Push prompts on user phones.
-   **Transaction Callbacks:** Receive real-time notifications for payment success or failure.
-   **Transaction Status Query:** Check the status of an STK Push transaction.
-   **Secure Authentication:** Uses OAuth 2.0 for API access.

---

## Configuration

Daraja API credentials and settings are managed through environment variables. These are consumed by `src/services/external/darajaService.ts` to authenticate with Safaricom and handle transaction callbacks.

**Environment Variables:**
-   `MPESA_ENV`: `sandbox` or `production`. Determines the base URL for Daraja API.
-   `MPESA_CONSUMER_KEY`: Your M-Pesa app consumer key.
-   `MPESA_CONSUMER_SECRET`: Your M-Pesa app consumer secret.
-   `MPESA_SHORT_CODE`: The M-Pesa Pay Bill or Buy Goods short code.
-   `MPESA_PASSKEY`: The M-Pesa STK Push Passkey.
-   `CALLBACK_URL`: The base URL of your API server used to construct the webhook endpoint (`/api/payments/webhooks/mpesa`).

---

## External Services

The `src/services/external/darajaService.ts` file provides the core functions for direct interaction with the Safaricom Daraja API.

### .Required imports
```typescript
import axios from 'axios';
import { generateAuthToken } from '../internal/authService'; // Example import
```

### used constansts

#### `getBaseUrl()`
**Purpose:** Returns the base API URL for Daraja.  
**Process:** Checks `MPESA_ENV` to return either sandbox or production URL.

**Implementation:**
```typescript
const getBaseUrl = (): string => {
  return process.env.MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke'
    : 'https://sandbox.safaricom.co.ke';
};
```

#### `buildTimestamp()`
**Purpose:** Generates a timestamp string.  
**Process:** Returns current time in YYYYMMDDHHMMSS format.

**Implementation:**
```typescript
const buildTimestamp = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}${month}${date}${hours}${minutes}${seconds}`;
};
```

#### `buildPassword()`
**Purpose:** Creates M-Pesa password.  
**Process:** Concatenates short code, passkey, and timestamp, then encodes in base64.

**Implementation:**
```typescript
const buildPassword = (shortCode: string, passkey: string, timestamp: string): string => {
  return Buffer.from(`${shortCode}${passkey}${timestamp}`).toString('base64');
};
```

#### `normalizePhoneNumber()`
**Purpose:** Formats phone number.  
**Process:** Converts local format to 254XXXXXXXXX format.

**Implementation:**
```typescript
export const normalizePhoneNumber = (phone: string): string => {
  const digitsOnly = String(phone).replace(/[^0-9]/g, "");
  let msisdn = digitsOnly;

  if (msisdn.startsWith("0")) {
    msisdn = `254${msisdn.slice(1)}`;
  }

  if (!msisdn.startsWith("254")) {
    if (digitsOnly.length === 9) {
      msisdn = `254${digitsOnly}`;
    }
  }

  if (!/^254\d{9}$/.test(msisdn)) {
    throw new Error(`Invalid Kenyan phone format: ${phone}`);
  }

  return msisdn;
};
```

#### `getAccessToken()`
**Purpose:** Retrieves OAuth 2.0 token.  
**Process:** Requests a new token from Daraja using client credentials.

**Implementation:**
```typescript
export const getAccessToken = async (): Promise<string> => {
  const consumerKey = (process.env.MPESA_CONSUMER_KEY || "").trim();
  const consumerSecret = (process.env.MPESA_CONSUMER_SECRET || "").trim();

  if (!consumerKey || !consumerSecret) {
    throw new Error("Daraja credentials (MPESA_CONSUMER_KEY/SECRET) not configured");
  }

  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString("base64");
  const base = getBaseUrl();

  try {
    const response = await axios.get(`${base}/oauth/v1/generate?grant_type=client_credentials`, {
      headers: { Authorization: `Basic ${auth}` }
    });
    return response.data.access_token;
  } catch (err: any) {
    throw new Error(`Daraja OAuth failed: ${err.response?.data?.errorMessage || err.message}`);
  }
};
```

### Function overview

#### `initiateStkPush(params)`
**Purpose:** Initiates an M-Pesa STK push.  
**Validation:** Requires `amount`, `phone`, and `accountReference`.  
**Process:** Authenticates, builds payload, and POSTs to Daraja API.  
**Response:** Returns `merchantRequestId` and `checkoutRequestId`.

**Implementation:**
```typescript
export const initiateStkPush = async (params: { amount: number, phone: string, accountReference: string }): Promise<any> => {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;
  const callbackUrl = process.env.CALLBACK_URL;

  if (!shortCode || !passkey || !callbackUrl) {
    throw new Error("Daraja configuration missing (SHORT_CODE, PASSKEY, or CALLBACK_URL)");
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);
  const normalizedPhone = normalizePhoneNumber(params.phone);

  const payload = {
    BusinessShortCode: Number(shortCode),
    Password: password,
    Timestamp: timestamp,
    TransactionType: "CustomerPayBillOnline",
    Amount: Math.round(params.amount),
    PartyA: normalizedPhone,
    PartyB: Number(shortCode),
    PhoneNumber: normalizedPhone,
    CallBackURL: `${callbackUrl}/api/payments/webhooks/mpesa`,
    AccountReference: "FAMILY SAVINGS PLAN",
    TransactionDesc: "Contribution Payment"
  };

  try {
    const resp = await axios.post(`${base}/mpesa/stkpush/v1/processrequest`, payload, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });
    return {
      merchantRequestId: resp.data.MerchantRequestID,
      checkoutRequestId: resp.data.CheckoutRequestID,
      raw: resp.data
    };
  } catch (err: any) {
    throw new Error(`Daraja STK Push failed: ${err.response?.data?.errorMessage || err.message}`);
  }
};
```

#### `parseCallback(body)`
**Purpose:** Processes webhook callbacks.  
**Process:** Validates response, extracts metadata (amount, phone, receipt), and maps to object.  
**Response:** Object containing parsed data and transaction success status.

**Implementation:**
```typescript
export const parseCallback = (body: any) => {
  const stk = body?.Body?.stkCallback;
  if (!stk) return { valid: false };

  const resultCode = stk.ResultCode;
  const success = String(resultCode) === "0";
  const checkoutRequestId = stk.CheckoutRequestID;
  const metadata = stk.CallbackMetadata?.Item || [];

  let amount, phone, transactionRef;
  for (const item of metadata) {
    if (item.Name === "Amount") amount = item.Value;
    if (item.Name === "PhoneNumber") phone = item.Value;
    if (item.Name === "MpesaReceiptNumber") transactionRef = item.Value;
  }

  return {
    valid: true,
    success,
    checkoutRequestId,
    amount,
    phone,
    transactionRef,
    resultCode,
    resultDesc: stk.ResultDesc,
    raw: body
  };
};
```

#### `queryStkPushStatus(checkoutRequestId)`
**Purpose:** Queries status of a push request.  
**Validation:** `checkoutRequestId` must be valid.  
**Process:** Authenticates and POSTs query request to Daraja.  
**Response:** Result code and description.

**Implementation:**
```typescript
export const queryStkPushStatus = async (checkoutRequestId: string): Promise<any> => {
  const shortCode = process.env.MPESA_SHORT_CODE;
  const passkey = process.env.MPESA_PASSKEY;

  if (!shortCode || !passkey) {
    throw new Error("Daraja configuration missing (SHORT_CODE, PASSKEY)");
  }

  const accessToken = await getAccessToken();
  const base = getBaseUrl();
  const timestamp = buildTimestamp();
  const password = buildPassword(shortCode, passkey, timestamp);

  try {
    const resp = await axios.post(`${base}/mpesa/stkpushquery/v1/query`, {
      BusinessShortCode: Number(shortCode),
      Password: password,
      Timestamp: timestamp,
      CheckoutRequestID: checkoutRequestId
    }, {
      headers: { Authorization: `Bearer ${accessToken}` }
    });

    return {
      ok: true,
      resultCode: resp.data.ResultCode,
      resultDesc: resp.data.ResultDesc,
      raw: resp.data
    };
  } catch (err: any) {
    return {
      ok: false,
      error: err.response?.data?.errorMessage || err.message,
      raw: err.response?.data
    };
  }
};
```

---

## Internal Services

The internal payment service (`src/services/internal/paymentService.ts`) orchestrates M-Pesa payments within the application's business logic.

### Required imports
```typescript
import Payment from '../../models/paymentModel';
import Invoice from '../../models/Invoice';
import Order from '../../models/Order';
import Receipt from '../../models/receiptModel';
import Coupon from '../../models/Coupon';
import Product from '../../models/Product';
import { initiateStkPush } from '../external/darajaService';
import type { IPayment } from '../../types';
```

### used consts

#### `generatePaymentNumber()`
**Purpose:** Generate a sequential payment number: PAY-YYYY-XXXX.

**Implementation:**
```typescript
export const generatePaymentNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Payment.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `PAY-${year}-${String(count + 1).padStart(4, "0")}`;
};
```

#### `generateInvoiceNumber()`
**Purpose:** Generate a random invoice number: INV-YYYY-XXXX.

**Implementation:**
```typescript
export const generateInvoiceNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `INV-${year}-${randomSuffix}`;
};
```

#### `generateReceiptNumber()`
**Purpose:** Generate a sequential receipt number: RCP-YYYY-XXXX.

**Implementation:**
```typescript
export const generateReceiptNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Receipt.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `RCP-${year}-${String(count + 1).padStart(4, "0")}`;
};
```

#### `generateTicketNumber()`
**Purpose:** Generate a sequential ticket number: TKT-YYYY-XXXX.

**Implementation:**
```typescript
export const generateTicketNumber = async (): Promise<string> => {
  const year = new Date().getFullYear();
  const count = await Ticket.countDocuments({
    createdAt: { $gte: new Date(year, 0, 1) }
  });
  return `TKT-${year}-${String(count + 1).padStart(4, "0")}`;
};
```

#### `createPaymentRecord()`
**Purpose:** Create a PENDING payment record.

**Implementation:**
```typescript
export const createPaymentRecord = async (params: {
  invoice?: string;
  branch: string;
  vendor: string;
  amount: number;
  method: "mpesa" | "paystack" | "cash" | "post_to_bill" | "cod";
}): Promise<IPayment> => {
  return await Payment.create({
    ...params,
    paymentNumber: await generatePaymentNumber(),
    status: "PENDING"
  } as any);
};
```

### Function overview

#### `updateInventoryForOrder(order)`
**Purpose:** Deducts purchased items from product SKU stock levels.

**Implementation:**
```typescript
const updateInventoryForOrder = async (order: any): Promise<void> => {
  if (!order.items || order.items.length === 0) {
    console.log('No items in order to update inventory');
    return;
  }

  console.log(`Updating inventory for order ${order._id} with ${order.items.length} items`);

  for (const item of order.items) {
    try {
      const product = await Product.findOne({ 
        'skus._id': item.sku 
      });

      if (!product) {
        console.error(`Product not found for SKU ${item.sku}`);
        continue;
      }

      const sku = (product.skus as any).id(item.sku);
      if (!sku) {
        console.error(`SKU ${item.sku} not found in product ${product._id}`);
        continue;
      }

      if (sku.stock < item.quantity) {
        console.warn(`Insufficient stock for SKU ${item.sku}. Available: ${sku.stock}, Requested: ${item.quantity}`);
      }

      sku.stock = Math.max(0, sku.stock - item.quantity);

      console.log(`Updated SKU ${item.sku} stock: ${sku.stock} (reduced by ${item.quantity})`);

      await product.save();
    } catch (error) {
      console.error(`Failed to update inventory for SKU ${item.sku}:`, error);
    }
  }

  console.log(`Completed inventory update for order ${order._id}`);
};
```

#### `updateInventoryForTicket(ticket)`
**Purpose:** Deducts purchased ticket from product SKU stock levels.

**Implementation:**
```typescript
const updateInventoryForTicket = async (ticket: any): Promise<void> => {
  try {
    const event = await Product.findById(ticket.event);
    if (event && event.trackInventory) {
      const sku = event.skus.find((s: any) => 
        s.attributes.some((attr: any) => attr.optionId.toString() === ticket.variantOptionId?.toString())
      );

      if (sku) {
        sku.stock = Math.max(0, sku.stock - 1);
        await event.save();
        console.log(`Updated Ticket Event SKU stock for ticket ${ticket._id}: ${sku.stock}`);
      }
    }
  } catch (error) {
    console.error(`Failed to update inventory for ticket ${ticket._id}:`, error);
  }
};
```

#### `applySucceFullProductPayment(params)`
**Purpose:** Apply a successful payment to the associated invoice and order, updates inventory, and generates a receipt.

**Implementation:**
```typescript
export const applySucceFullProductPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  invoice.paymentStatus = 'PAID';
  invoice.balanceDue = 0;
  await invoice.save();

  const order = await Order.findById(invoice.order);
  if (!order) {
    throw new Error('Order not found for successful payment');
  }

  order.paymentStatus = 'PAID';
  await order.save();

  // Increment coupon usage if applied
  const couponSnapshot = invoice.metadata?.coupon;
  if (couponSnapshot) {
    try {
      const c = await Coupon.findById(couponSnapshot._id);
      if (c) {
        await c.incrementUsage(String(order.customer));
      }
    } catch (couponError) {
      console.error('Failed to increment coupon usage after payment:', couponError);
    }
  }

  // Update SKU inventory
  try {
    await updateInventoryForOrder(order);
  } catch (inventoryError) {
    console.error('Failed to update inventory for order:', order._id, inventoryError);
  }

  const receipt: any = await Receipt.create({
    order: invoice.order,
    invoice: invoice._id,
    branch: invoice.branch,
    vendor: invoice.vendor,
    receiptNumber: await generateReceiptNumber(),
    amountPaid: payment.amount,
    paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
    issuedAt: new Date(),
    metadata: {
      coupon: invoice?.metadata?.coupon || null
    }
  });

  order.receipt = receipt._id as any;
  await order.save();

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  io?.emit('receipt.created', { receiptId: receipt._id.toString(), orderId: String(invoice.order) });

  return { receipt };
};
```

#### `applySuccessFullAppointmentPayment(params)`
**Purpose:** Apply a successful payment to an appointment, updates invoice and appointment status, and generates a receipt for full payments.

**Implementation:**
```typescript
export const applySuccessFullAppointmentPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt?: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  const appointment = await Appointment.findById(invoice.appointment);
  if (!appointment) {
    throw new Error('Appointment not found for successful payment');
  }

  let receipt = null;

  if (payment.type === 'BOOKING_FEE' && appointment.status === 'PENDING') {
    invoice.paymentStatus = 'PARTIAL';
    invoice.balanceDue = appointment.remainingAmount;
    await invoice.save();

    appointment.status = 'CONFIRMED';
    await appointment.save();
  } else if (payment.type === 'FULLPAYMENT') {
    invoice.paymentStatus = 'PAID';
    invoice.balanceDue = 0;
    await invoice.save();

    appointment.remainingAmount = 0;
    if (appointment.status === 'PENDING') {
      appointment.status = 'CONFIRMED';
    }
    await appointment.save();

    receipt = await Receipt.create({
      appointment: invoice.appointment,
      invoice: invoice._id,
      branch: invoice.branch,
      vendor: invoice.vendor,
      receiptNumber: await generateReceiptNumber(),
      amountPaid: payment.amount,
      paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
      issuedAt: new Date(),
    });
  }

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  if (receipt) {
    io?.emit('receipt.created', { receiptId: receipt._id.toString(), appointmentId: String(invoice.appointment) });
  }

  return { receipt };
};
```

#### `applySuccessfulTicketPayment(params)`
**Purpose:** Apply a successful payment to a ticket, updates invoice and ticket status, updates inventory, and generates a receipt.

**Implementation:**
```typescript
export const applySuccessfulTicketPayment = async ({ invoice, payment, io, method }: any): Promise<{ receipt: any }> => {
  payment.status = 'SUCCESS';
  await payment.save();

  invoice.paymentStatus = 'PAID';
  invoice.balanceDue = 0;
  await invoice.save();

  const ticket = await Ticket.findById(invoice.ticket);
  if (!ticket) {
    throw new Error('Ticket not found for successful payment');
  }

  // Update inventory
  await updateInventoryForTicket(ticket);

  ticket.status = 'BOOKED';
  ticket.qrCodeData = `DOHEZ-TICK-${ticket.ticketNumber}-${invoice._id}`;
  ticket.pdfUrl = `https://cdn.dohez.com/tickets/${ticket.ticketNumber}.pdf`; 
  await ticket.save();

  const receipt: any = await Receipt.create({
    ticket: ticket._id,
    invoice: invoice._id,
    branch: invoice.branch,
    vendor: invoice.vendor,
    receiptNumber: await generateReceiptNumber(),
    amountPaid: payment.amount,
    paymentMethod: method === 'mpesa_stk' ? 'mpesa' : (method === 'paystack_card' ? 'paystack' : method),
    issuedAt: new Date(),
  });

  io?.emit('payment.updated', { paymentId: payment._id.toString(), status: payment.status });
  io?.emit('ticket.activated', { ticketId: ticket._id.toString(), status: 'BOOKED' });
  io?.emit('receipt.created', { receiptId: receipt._id.toString(), ticketId: String(ticket._id) });

  return { receipt };
};
```

#### `initiateMpesaProductPayment(params)`
**Purpose:** Orchestrate M-Pesa STK Push payment for products and create an INITIATED payment record.

**Implementation:**
```typescript
export const initiateMpesaProductPayment = async (params: {
  invoiceId?: any;
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  invoiceNumber: string;
}): Promise<any> => {
  const { invoiceId, amount, phone, invoiceNumber, branch, vendor } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference: invoiceNumber
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: [invoiceId],
    branch,
    vendor,
    method: 'mpesa',
    amount,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};
```

#### `initiateMpesaAppointmentPayment(params)`
**Purpose:** Orchestrate M-Pesa STK Push payment for appointments and create an INITIATED payment record with type.

**Implementation:**
```typescript
export const initiateMpesaAppointmentPayment = async (params: {
  invoiceId?: any;
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  invoiceNumber: string;
  type: 'BOOKING_FEE' | 'FULLPAYMENT';
}): Promise<any> => {
  const { invoiceId, amount, phone, invoiceNumber, branch, vendor, type } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference: invoiceNumber
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: [invoiceId],
    branch,
    vendor,
    method: 'mpesa',
    amount,
    type,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};
```

#### `initiateMpesaTicketPayment(params)`
**Purpose:** Orchestrate M-Pesa STK Push payment for tickets (batch) and create an INITIATED payment record.

**Implementation:**
```typescript
export const initiateMpesaTicketPayment = async (params: {
  invoiceIds: any[];
  branch: any;
  vendor: any;
  amount: number;
  phone: string;
  accountReference: string;
}): Promise<any> => {
  const { invoiceIds, amount, phone, accountReference, branch, vendor } = params;

  const res = await initiateStkPush({
    amount,
    phone,
    accountReference
  });

  const payment = await Payment.create({
    paymentNumber: await generatePaymentNumber(),
    invoice: invoiceIds,
    branch,
    vendor,
    method: 'mpesa',
    amount,
    status: 'INITIATED',
    processorRefs: {
      daraja: {
        merchantRequestId: res.merchantRequestId,
        checkoutRequestId: res.checkoutRequestId
      }
    }
  });

  return { payment, res };
};
```



---

## Usage in Controllers

The payment controller (`src/controllers/paymentController.ts`) serves as the primary interface for handling payment-related requests, integrating both external Daraja services and internal payment logic.

### Required imports
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

### Function overview

#### `payProductInvoice()`
**Purpose:** Initiates a payment for a specific invoice. Handles M-Pesa STK Push initiation.

**Implementation:**
```typescript
export const payProductInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { invoiceId, method, amount: clientAmount, payerPhone } = req.body || {};

    if (!invoiceId || !method) {
      return next(errorHandler(400, 'invoiceId and method are required'));
    }

    const invoice = await Invoice.findById(invoiceId);
    if (!invoice) return next(errorHandler(404, 'Invoice not found'));

    if (invoice.paymentStatus === 'PAID') return next(errorHandler(409, 'Invoice already paid'));
    
    const amount = typeof clientAmount === 'number' ? clientAmount : invoice.balanceDue;

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

    return next(errorHandler(400, 'Unsupported payment method'));
  } catch (err) {
    next(err);
  }
};
```

#### `mpesaWebhook()`
**Purpose:** Handles the asynchronous callback from Safaricom after an STK Push is processed.

**Implementation:**
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
        await applySucceFullProductPayment({ invoice, payment, io, method: 'mpesa_stk' });
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
**Purpose:** Manually queries Safaricom for the status of a specific checkout request.

**Implementation:**
```typescript
export const queryMpesaByCheckoutId = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { checkoutRequestId } = req.params;
    const io = req.app.get('io');

    if (!checkoutRequestId) return next(errorHandler(400, 'checkoutRequestId is required'));

    const payment = await Payment.findOne({ 'processorRefs.daraja.checkoutRequestId': checkoutRequestId });
    if (!payment) return next(errorHandler(404, 'Payment not found for this checkout request'));

    const result = await queryStkPushStatus(checkoutRequestId as string);
    if (!result.ok) return next(errorHandler(502, result.error || 'Failed to query Daraja API'));

    const status = result.resultCode === 0 ? 'SUCCESS' : 'FAILED';
    
    if (result.resultCode === 0 && payment.status !== 'SUCCESS') {
      const invoice = await Invoice.findById(payment.invoice);
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
        paymentId: payment._id, 
        invoiceId: payment.invoice, 
        raw: result.raw 
      } 
    });
  } catch (err) {
    next(err);
  }
};
```


## Callbacks and Webhooks

The Daraja API relies on callbacks (webhooks) to notify the application of transaction outcomes. The `mpesaWebhook` controller function is configured as the endpoint for STK Push transactions.

All webhook processing is logged for debugging.

---

## Error Handling

Daraja service functions use `try-catch` blocks with custom error reporting. API failures include raw error details when available.

---

## API Examples

**Initiate M-Pesa Payment**

```bash
curl -X POST http://localhost:2500/api/payments/initiate \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{ "amount": 1000, "phone": "2547XXXXXXXX", "contributionId": "<contributionId>" }'
```

**Check M-Pesa STK Push Status**

```bash
curl -X GET http://localhost:2500/api/payments/status/<checkoutRequestId> \
  -H "Authorization: Bearer <token>"
```

---

**Last Updated:** April 2026
**Version:** 1.0.0
**Maintainer:** Saveplan API Development Team
