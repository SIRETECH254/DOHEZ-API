import mongoose, { Schema } from 'mongoose';
import { IVendor } from '../types';

const vendorSchema = new Schema<IVendor>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    service: {
      type: Schema.Types.ObjectId,
      ref: 'Service',
      default: null,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
    },
    email: {
      type: String,
      required: true,
      lowercase: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isFeatured: {
      type: Boolean,
      default: false,
    },
    logo: {
      type: String,
      default: null,
    },
    logoPublicId: {
      type: String,
      default: null,
    },
    cover: {
      type: String,
      default: null,
    },
    coverPublicId: {
      type: String,
      default: null,
    },
    location: {
      name: String,
      address: { type: String, required: true },
      regions: {
        administrative_area_level_3: String,
        administrative_area_level_1: String,
        country: { type: String, required: true },
      },
      coordinates: {
        lat: { type: Number, required: true },
        lng: { type: Number, required: true },
      },
      place_id: { type: String, required: true },
    },
    branches: [{
      type: Schema.Types.ObjectId,
      ref: 'Branch',
    }],
    slug: {
      type: String,
      required: true,
      unique: true,
    },
    details: {
      type: String,
      trim: true,
    },
    kraPin: {
      type: String,
      default: null,
    },
    regNo: {
      type: String,
      default: null,
    },
    vendorCategory: {
      type: Schema.Types.ObjectId,
      ref: 'VendorCategory',
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorSchema.index({ isActive: 1 });
vendorSchema.index({ isVerified: 1 });
vendorSchema.index({ name: 1 });

const Vendor = mongoose.model<IVendor>('Vendor', vendorSchema);

export default Vendor;
