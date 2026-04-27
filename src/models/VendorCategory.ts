import mongoose, { Schema } from 'mongoose';
import { IVendorCategory } from '../types';

const vendorCategorySchema = new Schema<IVendorCategory>(
  {
    name: {
      type: String,
      required: true,
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
vendorCategorySchema.index({ slug: 1 });
vendorCategorySchema.index({ isActive: 1 });

const VendorCategory = mongoose.model<IVendorCategory>('VendorCategory', vendorCategorySchema);

export default VendorCategory;
