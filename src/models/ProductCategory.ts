import mongoose, { Schema } from 'mongoose';
import { IProductCategory } from '../types';

const productCategorySchema = new Schema<IProductCategory>(
  {
    name: { type: String, required: true, trim: true },
    details: { type: String, trim: true },
    icon: { type: String, default: null },
    iconPublicId: { type: String, default: null },
    sort: { type: Number, default: 0 },
    slug: { type: String, required: true, unique: true },
    productType: { type: Schema.Types.ObjectId, ref: 'ProductType', required: true },
  },
  { timestamps: true }
);

productCategorySchema.index({ name: 1 });
productCategorySchema.index({ productType: 1 });

const ProductCategory = mongoose.model<IProductCategory>('ProductCategory', productCategorySchema);

export default ProductCategory;
