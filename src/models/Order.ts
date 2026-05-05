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
    variantOptions: {
      type: Map,
      of: String,
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

orderSchema.index({ customer: 1, createdAt: -1 });
orderSchema.index({ vendor: 1, createdAt: -1 });
orderSchema.index({ branch: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.model<IOrder>('Order', orderSchema);

export default Order;
