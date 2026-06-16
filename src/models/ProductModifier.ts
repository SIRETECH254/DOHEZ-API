import mongoose, { Schema } from 'mongoose';
import { IProductModifier, IOption } from '../types';

const optionSchema = new Schema<IOption>(
  {
    value: {
      type: String,
      required: true,
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: true }
);

const productModifierSchema = new Schema<IProductModifier>(
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
    options: [optionSchema],
    price: {
      type: Number,
      default: 0,
    },
    min_selection: {
      type: Number,
      default: 1,
    },
    max_selection: {
      type: Number,
      default: 1,
    },
    is_required: {
      type: Boolean,
      default: false,
    },
    branchId: {
      type: Schema.Types.ObjectId,
      ref: 'Branch',
      required: true,
    },
    vendor: {
      type: Schema.Types.ObjectId,
      ref: 'Vendor',
      required: true,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
productModifierSchema.index({ branchId: 1 });
productModifierSchema.index({ vendor: 1 });

const ProductModifier = mongoose.model<IProductModifier>('ProductModifier', productModifierSchema);

export default ProductModifier;
