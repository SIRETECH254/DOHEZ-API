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
}, { _id: false });

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
  sortOrder: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

const Variant = mongoose.model<IVariant>('Variant', variantSchema);

export default Variant;
