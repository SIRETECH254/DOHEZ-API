import mongoose, { Schema } from 'mongoose';
import { IPayment } from '../types';

const paymentSchema = new Schema<IPayment>(
  {
    paymentNumber: {
      type: String,
      required: true,
      unique: true,
    },
    invoice: [{
      type: Schema.Types.ObjectId,
      ref: 'Invoice',
    }],
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

const Payment = mongoose.model<IPayment>('Payment', paymentSchema);

export default Payment;
