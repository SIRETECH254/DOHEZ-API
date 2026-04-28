import mongoose, { Schema } from 'mongoose';
import { IBranch } from '../types';

const branchSchema = new Schema<IBranch>(
  {
    vendorId: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    phone: {
      type: String,
      required: true,
    },
    location: {
      address: { type: String, required: true },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      place_id: String,
    },
    cover: {
      type: String,
      default: null,
    },
    coverPublicId: {
      type: String,
      default: null,
    },
    fulfillmentConfig: {
      type: Object, // Structured based on project needs
      default: {},
    },
    workingHours: {
      monday: { start: String, end: String },
      tuesday: { start: String, end: String },
      wednesday: { start: String, end: String },
      thursday: { start: String, end: String },
      friday: { start: String, end: String },
      saturday: { start: String, end: String },
      sunday: { start: String, end: String },
    },
    gallery: [{
      url: String,
      publicId: String,
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
branchSchema.index({ vendor: 1 });
branchSchema.index({ location: '2dsphere' });

const Branch = mongoose.model<IBranch>('Branch', branchSchema);

export default Branch;
