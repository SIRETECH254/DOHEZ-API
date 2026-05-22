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
      required: true,
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
