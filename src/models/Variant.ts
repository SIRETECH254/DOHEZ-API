import mongoose, { Schema } from 'mongoose';
import { IVariant, IOption } from '../types';

const optionSchema = new Schema<IOption>({
  value: { 
    type: String, 
    required: true,
    trim: true
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  sortOrder: { 
    type: Number, 
    default: 0 
  }
}, { _id: true });

const variantSchema = new Schema<IVariant>({
  name: {
    type: String,
    required: true,
    trim: true
  },
  options: [optionSchema],
  branchId: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    required: true
  },
  vendor: {
    type: Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true
  },
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Indexes
variantSchema.index({ branchId: 1 });
variantSchema.index({ vendor: 1 });

const Variant = mongoose.model<IVariant>('Variant', variantSchema);

export default Variant;
