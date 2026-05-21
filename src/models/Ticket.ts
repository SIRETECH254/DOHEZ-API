import mongoose, { Schema } from 'mongoose';
import { ITicket } from '../types';

const ticketSchema = new Schema<ITicket>(
  {
    ticketNumber: {
      type: String,
      required: true,
      unique: true,
    },
    event: {
      type: Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    skuId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    details: {
      name: { type: String, required: true },
      email: { type: String, required: true },
      phone: { type: String, required: true },
    },
    type: {
      type: String,
      required: true,
    },
    qrCodeData: {
      type: String,
    },
    pdfUrl: {
      type: String,
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
    status: {
      type: String,
      enum: ['PENDING', 'BOOKED', 'CANCELLED', 'USED', 'EXPIRED'],
      default: 'PENDING',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Ticket = mongoose.model<ITicket>('Ticket', ticketSchema);

export default Ticket;
