import mongoose, { Schema } from 'mongoose';
import { IProductModifier } from '../types';

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
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const ProductModifier = mongoose.model<IProductModifier>('ProductModifier', productModifierSchema);

export default ProductModifier;
