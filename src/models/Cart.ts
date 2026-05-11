import mongoose, { Schema } from 'mongoose';
import { ICart, ICartGroup, ICartItem } from '../types';

const cartItemSchema = new Schema<ICartItem>({
  productId: {
    type: Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
  },
  skuId: {
    type: Schema.Types.ObjectId,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
  priceAtAddition: {
    type: Number,
    required: true,
  },
  variants: [
    {
      variantId: { type: Schema.Types.ObjectId },
      optionId: { type: Schema.Types.ObjectId },
    },
  ],
  modifiers: [
    {
      modifierId: { type: Schema.Types.ObjectId },
      optionId: { type: Schema.Types.ObjectId },
    },
  ],
});

const cartGroupSchema = new Schema<ICartGroup>({
  vendorId: {
    type: Schema.Types.ObjectId,
    ref: 'Vendor',
    required: true,
  },
  branchId: {
    type: Schema.Types.ObjectId,
    ref: 'Branch',
    required: true,
  },
  items: [cartItemSchema],
  groupSubtotal: {
    type: Number,
    default: 0,
  },
});

const cartSchema = new Schema<ICart>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    cartGroups: [cartGroupSchema],
    totalCartValue: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const Cart = mongoose.model<ICart>('Cart', cartSchema);

export default Cart;
