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
      enum: ['PENDING', 'PAID', 'PARTIAL', 'CANCELLED'],
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
