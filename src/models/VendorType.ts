import mongoose, { Schema } from 'mongoose';
import { IVendorType } from '../types';

const vendorTypeSchema = new Schema<IVendorType>(
  {
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    image: {
      type: String,
      default: null,
    },
    imagePublicId: {
      type: String,
      default: null,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
vendorTypeSchema.index({ isActive: 1 });
vendorTypeSchema.index({ createdAt: -1 });

const VendorType = mongoose.model<IVendorType>('VendorType', vendorTypeSchema);

export default VendorType;
