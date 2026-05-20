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
