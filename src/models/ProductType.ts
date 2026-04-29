import mongoose, { Schema } from 'mongoose';
import { IProductType } from '../types';

const productTypeSchema = new Schema<IProductType>(
  {
    name: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    order: { type: Number, default: 0 },
    slug: { type: String, required: true, unique: true },
    icon: { type: String, default: null },
    iconPublicId: { type: String, default: null },
  },
  { timestamps: true }
);

productTypeSchema.index({ name: 1 });
productTypeSchema.index({ slug: 1 });

const ProductType = mongoose.model<IProductType>('ProductType', productTypeSchema);
export default ProductType;
