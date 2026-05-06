import mongoose, { Schema } from 'mongoose';
import { IPackaging } from '../types';

const packagingSchema = new Schema<IPackaging>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    price: {
      type: Number,
      required: true,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    isDefault: {
      type: Boolean,
      default: false,
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
  },
  {
    timestamps: true,
  }
);

// Unique case-insensitive name
packagingSchema.index(
  { name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } }
);
packagingSchema.index({ isActive: 1, isDefault: 1 });

const Packaging = mongoose.model<IPackaging>('Packaging', packagingSchema);

export default Packaging;
