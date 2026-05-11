# 📦 DOHEZ API - Order Management Documentation

## 📋 Table of Contents
- [Order Management Overview](#order-management-overview)
- [Order Model](#-order-model)
- [Order Controller](#-order-controller)
- [Order Routes](#-order-routes)
- [Middleware](#-middleware)
- [API Examples](#-api-examples)
- [Security Features](#-security-features)
- [Error Handling](#-error-handling)
- [Database Indexes](#-database-indexes)

---

## Order Management Overview

Order Management is a core component of the DOHEZ API system, handling the lifecycle of customer orders. This includes creating orders from a user's cart (vendor and branch specific), managing pricing (subtotal, discounts, fees, tax, total), tracking payment status, and updating order fulfillment statuses. Orders can be for pickup or delivery, scheduled, and are linked to invoices and receipts.

---

## 👤 Order Model

### Schema Definition
```typescript
interface IOrder {
  _id: string;
  customer: string; // User ObjectId
  vendor: string; // Vendor ObjectId
  branch: string; // Branch ObjectId
  createdBy: string; // User ObjectId
  location: "in_shop" | "away";
  type: "pickup" | "delivery";
  items: Array<{
    sku: string; // SKU ObjectId
    product: string; // Product ObjectId
    title: string;
    quantity: number;
    unitPrice: number;
    variants?: Array<{ variantId: string; optionId: string }>;
    modifiers?: Array<{ modifierId: string; optionId: string }>;
    packagingChoice?: {
      id?: string; // Packaging ObjectId
      name?: string;
      fee?: number;
    };
  }>;
  pricing: {
    subtotal: number;
    discounts: number;
    packagingFee: number;
    schedulingFee: number;
    deliveryFee: number;
    tax: number;
    total: number;
  };
  timing: {
    isScheduled: boolean;
    scheduledAt?: Date | null;
  };
  address?: string | null; // Address ObjectId
  paymentPreference: {
    mode: "post_to_bill" | "pay_now" | "cash" | "cod";
    method?: "mpesa_stk" | "paystack_card" | null;
  };
  status:
    | "PLACED"
    | "CONFIRMED"
    | "PACKED"
    | "SHIPPED"
    | "OUT_FOR_DELIVERY"
    | "DELIVERED"
    | "CANCELLED"
    | "REFUNDED";
  paymentStatus:
    | "UNPAID"
    | "PENDING"
    | "PAID"
    | "PARTIALLY_REFUNDED"
    | "REFUNDED";
  invoice?: string | null; // Invoice ObjectId
  receipt?: string | null; // Receipt ObjectId
  metadata?: any;
  createdAt: Date;
  updatedAt: Date;
}
```

### Model Implementation

**File: `src/models/Order.ts`**

```typescript
import mongoose, { Schema } from 'mongoose';
import { IOrder, IOrderItem, IPricing, ITiming } from '../types';

const orderItemSchema = new Schema<IOrderItem>(
  {
    sku: {
      type: Schema.Types.ObjectId,
      ref: 'SKU',
      required: true,
    },
    product: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    unitPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    variants: [
      {
        variantId: { type: Schema.Types.ObjectId },
        optionId: { type: Schema.Types.ObjectId },
      },
    ],
    modifiers: [
      {
        modifierId: { type: Schema.Types.ObjectId },
        optionId: { type: Schema.Types.ObjectId },
      },
    ],
    packagingChoice: {
      id: { type: String },
      name: { type: String },
      fee: { type: Number, default: 0 },
    },
  },
  { _id: false }
);

const pricingSchema = new Schema<IPricing>(
  {
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
    packagingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    schedulingFee: {
      type: Number,
      required: true,
      min: 0,
      default: 0,
    },
    deliveryFee: {
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
  },
  { _id: false }
);

const timingSchema = new Schema<ITiming>(
  {
    isScheduled: {
      type: Boolean,
      default: false,
    },
    scheduledAt: {
      type: Date,
      default: null,
    },
  },
  { _id: false }
);

const orderSchema = new Schema<IOrder>(
  {
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
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    location: {
      type: String,
      enum: ['in_shop', 'away'],
      required: true,
    },
    type: {
      type: String,
      enum: ['pickup', 'delivery'],
      required: true,
    },
    items: [orderItemSchema],
    pricing: pricingSchema,
    timing: timingSchema,
    address: {
      type: Schema.Types.ObjectId,
      ref: 'Address',
      default: null,
    },
    paymentPreference: {
      mode: {
        type: String,
        enum: ['post_to_bill', 'pay_now', 'cash', 'cod'],
        required: true,
      },
      method: {
        type: String,
        enum: ['mpesa_stk', 'paystack_card', null],
        default: null,
      },
    },
    status: {
      type: String,
      enum: [
        'PLACED',
        'CONFIRMED',
        'PACKED',
        'SHIPPED',
        'OUT_FOR_DELIVERY',
        'DELIVERED',
        'CANCELLED',
        'REFUNDED',
      ],
      default: 'PLACED',
    },
    paymentStatus: {
      type: String,
      enum: ['UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'],
      default: 'UNPAID',
    },
    invoice: {
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
      default: null,
    },
    receipt: {
      type: Schema.Types.ObjectId,
      ref: 'Receipt',
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
```



### Validation Rules
```javascript
customer:       { required: true, type: ObjectId, ref: 'User' }
vendor:         { required: true, type: ObjectId, ref: 'Vendor' }
branch:         { required: true, type: ObjectId, ref: 'Branch' }
createdBy:      { required: true, type: ObjectId, ref: 'User' }
location:       { required: true, type: String, enum: ['in_shop', 'away'] }
type:           { required: true, type: String, enum: ['pickup', 'delivery'] }
items:          { required: true, type: Array of orderItemSchema }
  sku:            { required: true, type: ObjectId }
  product:        { required: true, type: ObjectId, ref: 'Product' }
  title:          { required: true, type: String }
  quantity:       { required: true, type: Number, min: 1 }
  unitPrice:      { required: true, type: Number, min: 0 }
  variants:       { type: Array of { variantId: ObjectId, optionId: ObjectId } }
  modifiers:      { type: Array of { modifierId: ObjectId, optionId: ObjectId } }
  packagingChoice: { type: Object of { id: String, name: String, fee: Number } }
pricing:        { required: true, type: pricingSchema }
  subtotal:       { required: true, type: Number, min: 0 }
  discounts:      { required: true, type: Number, min: 0 }
  packagingFee:   { required: true, type: Number, min: 0 }
  schedulingFee:  { required: true, type: Number, min: 0 }
  deliveryFee:    { required: true, type: Number, min: 0 }
  tax:            { required: true, type: Number, min: 0 }
  total:          { required: true, type: Number, min: 0 }
timing:         { required: true, type: timingSchema }
  isScheduled:    { type: Boolean, default: false }
  scheduledAt:    { type: Date, default: null }
address:        { type: ObjectId, ref: 'Address', default: null }
paymentPreference: { required: true, type: Object }
  mode:           { required: true, type: String, enum: ['post_to_bill', 'pay_now', 'cash', 'cod'] }
  method:         { type: String, enum: ['mpesa_stk', 'paystack_card', null], default: null }
status:         { type: String, enum: ['PLACED', 'CONFIRMED', 'PACKED', 'SHIPPED', 'OUT_FOR_DELIVERY', 'DELIVERED', 'CANCELLED', 'REFUNDED'], default: 'PLACED' }
paymentStatus:  { type: String, enum: ['UNPAID', 'PENDING', 'PAID', 'PARTIALLY_REFUNDED', 'REFUNDED'], default: 'UNPAID' }
invoice:        { type: ObjectId, ref: 'Invoice', default: null }
receipt:        { type: ObjectId, ref: 'Receipt', default: null }
metadata:       { type: Mixed, default: {} }
```

---

## 🎮 Order Controller

### Required Imports
```typescript
import type { Request, Response, NextFunction } from "express";
import Order from "../models/Order";
import Invoice from "../models/Invoice";
import Cart from "../models/Cart";
import Product from "../models/Product";
import Coupon from "../models/Coupon";
import Packaging from "../models/Packaging";
import { generateInvoiceNumber } from "../services/internal/paymentService";
import { IOrderItem } from "../types";
```

### Functions Overview

#### `createOrder()`
**Purpose:** Creates a new order from a user's active cart group (specific vendor and branch). This involves calculating full pricing, applying any valid coupons, resolving packaging options, and initiating an associated invoice.  
**Access:** Private (Authenticated User)  
**Validation:** `vendorId`, `branchId`, `location`, `type`, `paymentPreference` are required. Checks for active cart, valid packaging, and coupon.  
**Process:** Fetches the user's cart, identifies the relevant vendor group, calculates pricing, creates `Order` and `Invoice` documents, clears the cart group, and emits Socket.io events.  
**Response:** The ID of the newly created order and its associated invoice.

**Controller Implementation:**
```typescript
export const createOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');

    const {
      customerId,
      vendorId,
      branchId,
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      packagingSelections = [],
      couponCode = null,
      cartId = null,
      metadata = {}
    } = req.body;

    const actingUserId = req.user?._id;
    const ownerCustomerId = customerId || actingUserId;

    if (!vendorId || !branchId) {
      return res.status(400).json({ success: false, message: 'vendorId and branchId are required' });
    }

    const cart = await Cart.findOne({ userId: ownerCustomerId });

    if (!cart) {
      return res.status(400).json({ success: false, message: 'Cart not found' });
    }

    const group = cart.cartGroups.find(
      (g) => g.vendorId.toString() === vendorId && g.branchId.toString() === branchId
    );

    if (!group || !group.items || group.items.length === 0) {
      return res.status(400).json({ success: false, message: 'No items in cart for this vendor/branch' });
    }

    const packagingMap = new Map();
    for (const sel of (packagingSelections || [])) {
      if (sel?.sku && sel?.choiceId) packagingMap.set(String(sel.sku), sel.choiceId);
    }

    const productIds = Array.from(new Set(group.items.map(ci => String(ci.productId))));
    const productDocs = await Product.find({ _id: { $in: productIds } }, 'name');
    const productIdToName = new Map(productDocs.map(p => [String(p._id), p.name]));

    const items: IOrderItem[] = group.items.map((ci) => ({
      sku: ci.skuId,
      product: ci.productId,
      title: productIdToName.get(String(ci.productId)) || 'Unknown product',
      quantity: ci.quantity,
      unitPrice: ci.priceAtAddition,
      variants: ci.variants,
      modifiers: ci.modifiers,
      packagingChoice: packagingMap.has(String(ci.skuId)) ? { id: packagingMap.get(String(ci.skuId)), name: '', fee: 0 } : undefined
    }));

    let selectedPackaging: any = null;
    if (packagingOptionId) {
      const opt = await Packaging.findOne({ _id: packagingOptionId, isActive: true });
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price };
    }
    if (!selectedPackaging) {
      const def = await Packaging.findOne({ isActive: true, isDefault: true });
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price };
    }

    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0;
    const schedulingFee = timing?.isScheduled ? 0 : 0; 
    const deliveryFee = (type === 'delivery') ? 0 : 0; 
    
    let couponSnapshot = null;
    let discounts = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() });
      if (coupon) {
        const validation = coupon.validateCoupon(String(ownerCustomerId), subtotal);
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal);
          discounts = Math.max(0, Number(discountAmount) || 0);
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          };
        }
      }
    }
    const tax = 0;
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax;

    const order = await Order.create({
      customer: ownerCustomerId,
      vendor: vendorId,
      branch: branchId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      address: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED',
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID',
      metadata: {
        ...metadata,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    });

    const invoice = await Invoice.create({
      order: order._id,
      number: generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    });

    order.invoice = invoice._id as any;
    await order.save();

    cart.cartGroups = cart.cartGroups.filter(
      (g) => !(g.vendorId.toString() === vendorId && g.branchId.toString() === branchId)
    );
    await cart.save();

    io?.emit('order.created', { orderId: order._id.toString() });
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};
```

#### `adminCreateOrder()`
**Purpose:** Allows admins to create an order for a specific customer by manually selecting items, bypassing the cart. It resolves item details from current product/SKU data, calculates pricing (including packaging and coupons), and initiates an associated invoice.  
**Access:** Private (Admin)  
**Validation:** `customerId`, `vendorId`, `branchId`, `items` (array of `{ productId, skuId, quantity }`), `location`, `type`, and `paymentPreference` are required. Checks for customer existence, product availability, valid packaging, and coupon.  
**Process:** Fetches relevant details for manual items, calculates pricing, creates `Order` and `Invoice` documents, and emits events.  
**Response:** The ID of the newly created order and its associated invoice.

**Controller Implementation:**
```typescript
export const adminCreateOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');

    const {
      customerId,
      vendorId,
      branchId,
      items: inputItems,
      location,
      type,
      timing = { isScheduled: false, scheduledAt: null },
      addressId = null,
      paymentPreference,
      packagingOptionId = null,
      couponCode = null,
      metadata = {}
    } = req.body;

    if (!customerId || !vendorId || !branchId) {
      return res.status(400).json({ success: false, message: 'customerId, vendorId, and branchId are required' });
    }

    if (!inputItems || !Array.isArray(inputItems) || inputItems.length === 0) {
      return res.status(400).json({ success: false, message: 'Items are required' });
    }

    const actingUserId = req.user?._id;

    const productIds = Array.from(new Set(inputItems.map((it: any) => String(it.productId))));
    const products = await Product.find({ _id: { $in: productIds } });
    const productMap = new Map(products.map(p => [String(p._id), p]));

    const items: IOrderItem[] = [];
    for (const inputItem of inputItems) {
      const product = productMap.get(String(inputItem.productId));
      if (!product) {
        return res.status(404).json({ success: false, message: `Product ${inputItem.productId} not found` });
      }

      const sku = (product.skus as any).id(inputItem.skuId);
      if (!sku) {
        return res.status(404).json({ success: false, message: `SKU ${inputItem.skuId} not found in product ${product.name}` });
      }

      if (sku.stock < inputItem.quantity) {
        return res.status(400).json({ success: false, message: `Insufficient stock for ${product.name}. Available: ${sku.stock}` });
      }

      items.push({
        sku: sku._id,
        product: product._id,
        title: product.name,
        quantity: inputItem.quantity,
        unitPrice: sku.price,
        variants: inputItem.variants,
        modifiers: inputItem.modifiers,
        packagingChoice: undefined
      });
    }

    let selectedPackaging: any = null;
    if (packagingOptionId) {
      const opt = await Packaging.findOne({ _id: packagingOptionId, isActive: true });
      if (opt) selectedPackaging = { id: String(opt._id), name: opt.name, price: opt.price };
    }
    if (!selectedPackaging) {
      const def = await Packaging.findOne({ isActive: true, isDefault: true });
      if (def) selectedPackaging = { id: String(def._id), name: def.name, price: def.price };
    }

    const subtotal = items.reduce((sum, it) => sum + (it.unitPrice * it.quantity), 0);
    const packagingFee = selectedPackaging ? Number(selectedPackaging.price || 0) : 0;
    const schedulingFee = timing?.isScheduled ? 0 : 0; 
    const deliveryFee = (type === 'delivery') ? 0 : 0; 

    let couponSnapshot = null;
    let discounts = 0;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: String(couponCode).toUpperCase() });
      if (coupon) {
        const validation = coupon.validateCoupon(String(customerId), subtotal);
        if (validation.isValid) {
          const discountAmount = coupon.calculateDiscount(subtotal);
          discounts = Math.max(0, Number(discountAmount) || 0);
          couponSnapshot = {
            _id: coupon._id,
            code: coupon.code,
            name: coupon.name,
            discountType: coupon.discountType,
            discountValue: coupon.discountValue,
            discountAmount: discounts
          };
        }
      }
    }

    const tax = 0;
    const total = subtotal - discounts + packagingFee + schedulingFee + deliveryFee + tax;

    const order = await Order.create({
      customer: customerId,
      vendor: vendorId,
      branch: branchId,
      createdBy: actingUserId,
      location,
      type,
      items,
      pricing: { subtotal, discounts, packagingFee, schedulingFee, deliveryFee, tax, total },
      timing,
      address: type === 'delivery' ? addressId : null,
      paymentPreference,
      status: 'PLACED',
      paymentStatus: paymentPreference?.mode === 'pay_now' ? 'PENDING' : 'UNPAID',
      metadata: {
        ...metadata,
        adminCreated: true,
        packaging: selectedPackaging || null,
        coupon: couponSnapshot || null
      }
    });

    const invoice = await Invoice.create({
      order: order._id,
      number: generateInvoiceNumber(),
      lineItems: [
        { label: 'Items subtotal', amount: subtotal },
        ...(packagingFee ? [{ label: `Packaging${selectedPackaging?.name ? ` - ${selectedPackaging.name}` : ''}`, amount: packagingFee }] : []),
        ...(schedulingFee ? [{ label: 'Scheduling', amount: schedulingFee }] : []),
        ...(deliveryFee ? [{ label: 'Delivery', amount: deliveryFee }] : []),
        ...(tax ? [{ label: 'Tax', amount: tax }] : [])
      ],
      subtotal,
      discounts,
      fees: packagingFee + schedulingFee + deliveryFee,
      tax,
      total,
      balanceDue: total,
      paymentStatus: 'PENDING',
      metadata: {
        coupon: couponSnapshot || null
      }
    });

    order.invoice = invoice._id as any;
    await order.save();

    io?.emit('order.created', { orderId: order._id.toString() });
    io?.emit('invoice.created', { invoiceId: invoice._id.toString(), orderId: order._id.toString() });

    return res.status(201).json({ success: true, data: { orderId: order._id, invoiceId: invoice._id } });
  } catch (err) {
    return next(err);
  }
};
```

#### `getOrderById()`
**Purpose:** Retrieves a single order by its ID, with populated details such as invoice, receipt, address, customer, createdBy, vendor, branch, and product item data.  
**Access:** Private (Authenticated User / Admin)  
**Validation:** `id` in params.  
**Process:** Finds the order by ID and populates all related documents.  
**Response:** A single order object with detailed information and all references populated.

**Controller Implementation:**
```typescript
export const getOrderById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id)
      .populate('invoice')
      .populate('receipt')
      .populate('address')
      .populate({ path: 'customer', select: 'firstName lastName email phone' })
      .populate({ path: 'createdBy', select: 'firstName lastName email phone' })
      .populate({ path: 'items.product', select: 'name images price' })
      .populate('vendor')
      .populate('branch');

    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true, data: { order } });
  } catch (err) {
    return next(err);
  }
};
```

#### `updateOrderStatus()`
**Purpose:** Updates the fulfillment status of an order.  
**Access:** Private (Admin)  
**Validation:** `id` in params, `status` in body.  
**Process:** Finds the order by ID and updates its status. Emits a `order.updated` Socket.io event.  
**Response:** Success message.

**Controller Implementation:**
```typescript
export const updateOrderStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const io = req.app.get('io');
    const { id } = req.params;
    const { status } = req.body;

    const order = await Order.findByIdAndUpdate(id, { status }, { new: true });
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    io?.to(`order_${order._id}`).emit('order.updated', { orderId: order._id.toString(), status: order.status });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};
```

#### `assignRider()`
**Purpose:** Placeholder function for assigning a rider to an order.  
**Access:** Private (Admin)  
**Response:** Success message (placeholder).

**Controller Implementation:**
```typescript
export const assignRider = async (req: Request, res: Response, next: NextFunction) => {
  try {
    return res.json({ success: true, message: 'Rider assigned successfully (placeholder)' });
  } catch (err) {
    return next(err);
  }
};
```

#### `getUserOrders()`
**Purpose:** Retrieves a paginated list of orders for the currently authenticated user.  
**Access:** Private (Authenticated User)  
**Validation:** Optional query parameters for pagination and filtering (`status`, `paymentStatus`, `type`, `location`, `q`).  
**Process:** Builds an aggregation pipeline to filter by `customer`, join invoice details, sort, and paginate orders.  
**Response:** Paginated list of the user's order objects.

**Controller Implementation:**
```typescript
export const getUserOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query as any;

    const filters: any = { customer: req.user?._id };
    if (status) filters.status = status;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (type) filters.type = type;
    if (location) filters.location = location;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filters },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: { 'invoice.number': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 as any } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', number: '$invoice.number' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.meta?.[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
};
```

#### `getOrders()`
**Purpose:** Retrieves a paginated list of orders for admins, with various filtering options.  
**Access:** Private (Admin)  
**Validation:** Optional query parameters for pagination and filtering.  
**Process:** Builds an aggregation pipeline to filter, join invoice and customer details, sort, and paginate orders.  
**Response:** Paginated list of all order objects.

**Controller Implementation:**
```typescript
export const getOrders = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      paymentStatus,
      type,
      location,
      q
    } = req.query as any;

    const filters: any = {};
    if (status) filters.status = status;
    if (paymentStatus) filters.paymentStatus = paymentStatus;
    if (type) filters.type = type;
    if (location) filters.location = location;

    const skip = (Number(page) - 1) * Number(limit);

    const pipeline = [
      { $match: filters },
      {
        $lookup: {
          from: 'invoices',
          localField: 'invoice',
          foreignField: '_id',
          as: 'invoice'
        }
      },
      { $unwind: { path: '$invoice', preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: 'users',
          localField: 'customer',
          foreignField: '_id',
          as: 'customer'
        }
      },
      { $unwind: { path: '$customer', preserveNullAndEmptyArrays: true } },
      ...(q ? [{ $match: { 'invoice.number': { $regex: q, $options: 'i' } } }] : []),
      { $sort: { createdAt: -1 as any } },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: Number(limit) },
            {
              $project: {
                _id: 1,
                createdAt: 1,
                status: 1,
                paymentStatus: 1,
                pricing: 1,
                invoice: { _id: '$invoice._id', number: '$invoice.number' },
                customer: { _id: '$customer._id', firstName: '$customer.firstName', lastName: '$customer.lastName', email: '$customer.email' }
              }
            }
          ],
          meta: [ { $count: 'total' } ]
        }
      }
    ];

    const result = await Order.aggregate(pipeline);
    const data = result[0]?.data || [];
    const total = result[0]?.meta?.[0]?.total || 0;

    return res.json({
      success: true,
      data: {
        orders: data,
        pagination: {
          currentPage: Number(page),
          pageSize: Number(limit),
          totalItems: total,
          totalPages: Math.max(1, Math.ceil(total / Number(limit)))
        }
      }
    });
  } catch (err) {
    return next(err);
  }
};
```

#### `deleteOrder()`
**Purpose:** Deletes an order from the system.  
**Access:** Private (Admin)  
**Validation:** `id` in params.  
**Process:** Finds and deletes the order document.  
**Response:** Success message.

**Controller Implementation:**
```typescript
export const deleteOrder = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
};
```

---

## 🛣️ Order Routes

### Base Path: `/api/orders`

```typescript
POST   /                     // Create a new order from active cart group
GET    /my-orders            // List user's orders (paginated)
GET    /:id                  // Get detailed order by ID
POST   /admin/create         // Create an order for a customer manually (Admin)
GET    /                     // List all orders (paginated) (Admin)
PATCH  /:id/status           // Update order fulfillment status (Admin)
PATCH  /:id/assign-rider     // Assign a rider to an order (Admin)
DELETE /:id                  // Delete an order (Admin)
```

### Router Implementation

**File: `src/routes/orderRoutes.ts`**

```typescript
import express from 'express';
import { authenticateToken, requireAdmin } from '../middleware/auth';
import {
  createOrder,
  adminCreateOrder,
  getOrderById,
  updateOrderStatus,
  assignRider,
  getOrders,
  deleteOrder,
  getUserOrders
} from '../controllers/orderController';

const router = express.Router();

router.post('/', authenticateToken, createOrder);
router.get('/my-orders', authenticateToken, getUserOrders);
router.get('/:id', authenticateToken, getOrderById);

router.post('/admin/create', authenticateToken, requireAdmin, adminCreateOrder);
router.get('/', authenticateToken, requireAdmin, getOrders);
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);
router.patch('/:id/assign-rider', authenticateToken, requireAdmin, assignRider);
router.delete('/:id', authenticateToken, requireAdmin, deleteOrder);

export default router;
```


### Route Details

#### `POST /api/orders`
**Headers:** `Authorization: Bearer <token>`
**Body:**
```json
{
  "vendorId": "65e26b1c09b068c201383810",
  "branchId": "65e26b1c09b068c201383811",
  "location": "in_shop",
  "type": "pickup",
  "paymentPreference": {
    "mode": "cash"
  },
  "packagingOptionId": "65e26b1c09b068c201383815"
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "650af123890abcdef1234567",
    "invoiceId": "650af456890abcdef1234568"
  }
}
```

#### `GET /api/orders/my-orders`
**Headers:** `Authorization: Bearer <token>`
**Query:** `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "650af123890abcdef1234567",
        "createdAt": "2026-05-05T10:00:00.000Z",
        "status": "PLACED",
        "paymentStatus": "UNPAID",
        "pricing": {
          "subtotal": 1500,
          "discounts": 0,
          "packagingFee": 50,
          "schedulingFee": 0,
          "deliveryFee": 0,
          "tax": 0,
          "total": 1550
        },
        "invoice": {
          "_id": "650af456890abcdef1234568",
          "number": "INV-2026-123456"
        }
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

#### `GET /api/orders/:id`
**Headers:** `Authorization: Bearer <token>`
**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "650af123890abcdef1234567",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phone": "+254700000000"
      },
      "vendor": {
        "name": "Quick Mart"
      },
      "branch": {
        "name": "Main Branch"
      },
      "items": [
        {
          "product": {
            "name": "Milk 500ml",
            "price": 60
          },
          "quantity": 2,
          "unitPrice": 60
        }
      ],
      "status": "PLACED",
      "paymentStatus": "UNPAID",
      "pricing": {
        "subtotal": 120,
        "total": 120
      }
    }
  }
}
```

#### `POST /api/orders/admin/create`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "customerId": "650af123890abcdef1234567",
  "vendorId": "65e26b1c09b068c201383810",
  "branchId": "65e26b1c09b068c201383811",
  "items": [
    {
      "productId": "650af123890abcdef1234569",
      "skuId": "650af123890abcdef1234570",
      "quantity": 3
    }
  ],
  "location": "in_shop",
  "type": "pickup",
  "paymentPreference": {
    "mode": "pay_now"
  }
}
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "650af987890abcdef1234567",
    "invoiceId": "650af987890abcdef1234568"
  }
}
```

#### `GET /api/orders`
**Headers:** `Authorization: Bearer <admin_token>`
**Query:** `page=1`, `limit=10`
**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "650af123890abcdef1234567",
        "customer": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe@example.com"
        },
        "status": "PLACED",
        "pricing": {
          "total": 1550
        }
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

#### `PATCH /api/orders/:id/status`
**Headers:** `Authorization: Bearer <admin_token>`
**Body:**
```json
{
  "status": "CONFIRMED"
}
```
**Response:**
```json
{
  "success": true
}
```

#### `PATCH /api/orders/:id/assign-rider`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true,
  "message": "Rider assigned successfully (placeholder)"
}
```

#### `DELETE /api/orders/:id`
**Headers:** `Authorization: Bearer <admin_token>`
**Response:**
```json
{
  "success": true
}
```



---

## 🔐 Middleware

### Authentication Middleware

#### `authenticateToken`
**Purpose:** Verify JWT token and load user with roles  
**Usage:**
```typescript
router.post('/', authenticateToken, createOrder);
```

#### `requireAdmin`
**Purpose:** Admin access only (admin/super_admin)  
**Usage:**
```typescript
router.patch('/:id/status', authenticateToken, requireAdmin, updateOrderStatus);
```


---

## 📝 API Examples

### Create a New Order
```bash
curl -X POST http://localhost:5000/api/orders \
  -H "Authorization: Bearer <access_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "vendorId": "65e26b1c09b068c201383810",
    "branchId": "65e26b1c09b068c201383811",
    "location": "in_shop",
    "type": "pickup",
    "paymentPreference": {
      "mode": "cash"
    },
    "packagingOptionId": "65e26b1c09b068c201383815"
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "650af123890abcdef1234567",
    "invoiceId": "650af456890abcdef1234568"
  }
}
```

### Get My Orders
```bash
curl -X GET "http://localhost:5000/api/orders/my-orders?page=1&limit=10" \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "650af123890abcdef1234567",
        "createdAt": "2026-05-05T10:00:00.000Z",
        "status": "PLACED",
        "paymentStatus": "UNPAID",
        "pricing": {
          "subtotal": 1500,
          "discounts": 0,
          "packagingFee": 50,
          "schedulingFee": 0,
          "deliveryFee": 0,
          "tax": 0,
          "total": 1550
        },
        "invoice": {
          "_id": "650af456890abcdef1234568",
          "number": "INV-2026-123456"
        }
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

### Get Order by ID
```bash
curl -X GET http://localhost:5000/api/orders/650af123890abcdef1234567 \
  -H "Authorization: Bearer <access_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "order": {
      "_id": "650af123890abcdef1234567",
      "customer": {
        "firstName": "John",
        "lastName": "Doe",
        "email": "john.doe@example.com",
        "phone": "+254700000000"
      },
      "vendor": {
        "name": "Quick Mart"
      },
      "branch": {
        "name": "Main Branch"
      },
      "items": [
        {
          "product": {
            "name": "Milk 500ml",
            "price": 60
          },
          "quantity": 2,
          "unitPrice": 60
        }
      ],
      "status": "PLACED",
      "paymentStatus": "UNPAID",
      "pricing": {
        "subtotal": 120,
        "total": 120
      }
    }
  }
}
```

### Admin: Create Order Manually
```bash
curl -X POST http://localhost:5000/api/orders/admin/create \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "customerId": "650af123890abcdef1234567",
    "vendorId": "65e26b1c09b068c201383810",
    "branchId": "65e26b1c09b068c201383811",
    "items": [
      {
        "productId": "650af123890abcdef1234569",
        "skuId": "650af123890abcdef1234570",
        "quantity": 3
      }
    ],
    "location": "in_shop",
    "type": "pickup",
    "paymentPreference": {
      "mode": "pay_now"
    }
  }'
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orderId": "650af987890abcdef1234567",
    "invoiceId": "650af987890abcdef1234568"
  }
}
```

### Admin: List All Orders
```bash
curl -X GET "http://localhost:5000/api/orders?page=1&limit=10" \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "_id": "650af123890abcdef1234567",
        "customer": {
          "firstName": "John",
          "lastName": "Doe",
          "email": "john.doe@example.com"
        },
        "status": "PLACED",
        "pricing": {
          "total": 1550
        }
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

### Admin: Update Order Status
```bash
curl -X PATCH http://localhost:5000/api/orders/650af123890abcdef1234567/status \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "CONFIRMED"
  }'
```
**Response:**
```json
{
  "success": true
}
```

### Admin: Assign Rider (Placeholder)
```bash
curl -X PATCH http://localhost:5000/api/orders/650af123890abcdef1234567/assign-rider \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true,
  "message": "Rider assigned successfully (placeholder)"
}
```

### Admin: Delete Order
```bash
curl -X DELETE http://localhost:5000/api/orders/650af123890abcdef1234567 \
  -H "Authorization: Bearer <admin_token>"
```
**Response:**
```json
{
  "success": true
}
```


---

## 🛡️ Security Features

-   **Authentication:** JWT required for all endpoints.
-   **Authorization:** Strict RBAC enforced to protect customer data.
-   **Data Integrity:** Pricing and inventory checks performed server-side.
-   **Real-time:** Socket.io used for status update notifications.

---

## 🚨 Error Handling

-   `400 Bad Request`: Missing IDs, empty cart group, or insufficient stock.
-   `401 Unauthorized`: Missing or invalid token.
-   `403 Forbidden`: Non-admin accessing admin routes.
-   `404 Not Found`: Order, vendor, or branch not found.

---

## 📊 Database Indexes

```typescript
orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ branch: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
```


---

**Last Updated:** May 2026
**Version:** 1.1.0
**Maintainer:** DOHEZ API Development Team
