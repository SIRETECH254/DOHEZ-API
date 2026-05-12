import mongoose, { Schema } from 'mongoose';
import { ICoupon, ICouponModel, ICouponUsage } from '../types';

const couponSchema = new Schema<ICoupon, ICouponModel>(
  {
    code: {
      type: String,
      required: true,
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    discountType: {
      type: String,
      enum: ['percentage', 'fixed'],
      required: true,
    },
    discountValue: {
      type: Number,
      required: true,
      min: 0,
    },
    minimumOrderAmount: {
      type: Number,
      default: 0,
      min: 0,
    },
    maximumDiscountAmount: {
      type: Number,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    hasExpiry: {
      type: Boolean,
      default: false,
    },
    expiryDate: {
      type: Date,
    },
    hasUsageLimit: {
      type: Boolean,
      default: false,
    },
    usageLimit: {
      type: Number,
      min: 1,
    },
    usedCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    isFirstTimeOnly: {
      type: Boolean,
      default: false,
    },
    applicableProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    applicableCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
      },
    ],
    excludedProducts: [
      {
        type: Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
    excludedCategories: [
      {
        type: Schema.Types.ObjectId,
        ref: 'ProductCategory',
      },
    ],
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
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
    lastUsedBy: [
      {
        user: {
          type: Schema.Types.ObjectId,
          ref: 'User',
        },
        usedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes for better performance
couponSchema.index({ isActive: 1, expiryDate: 1 });
couponSchema.index({ createdBy: 1 });
couponSchema.index({ vendor: 1 });
couponSchema.index({ branch: 1 });

// Virtual for checking if coupon is expired
couponSchema.virtual('isExpired').get(function (this: ICoupon) {
  if (!this.hasExpiry || !this.expiryDate) {
    return false;
  }
  return new Date() > this.expiryDate;
});

// Virtual for checking if coupon usage limit is reached
couponSchema.virtual('isUsageLimitReached').get(function (this: ICoupon) {
  if (!this.hasUsageLimit || this.usageLimit === undefined) {
    return false;
  }
  return this.usedCount >= this.usageLimit;
});

// Virtual for checking if coupon is valid
couponSchema.virtual('isValid').get(function (this: ICoupon) {
  return this.isActive && !this.isExpired && !this.isUsageLimitReached;
});

// Virtual for remaining usage count
couponSchema.virtual('remainingUsage').get(function (this: ICoupon) {
  if (!this.hasUsageLimit || this.usageLimit === undefined) {
    return null; // No limit
  }
  return Math.max(0, this.usageLimit - this.usedCount);
});

// Method to generate unique coupon code
couponSchema.statics.generateUniqueCode = async function (length = 8) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    // Check if code already exists
    const existingCoupon = await this.findOne({ code });
    if (!existingCoupon) {
      isUnique = true;
    }
  }

  return code;
};

// Method to validate coupon
couponSchema.methods.validateCoupon = function (this: ICoupon, userId: string, orderAmount = 0) {
  // Check if coupon is active
  if (!this.isActive) {
    return { isValid: false, message: 'Coupon is not active' };
  }

  // Check if coupon is expired
  if (this.isExpired) {
    return { isValid: false, message: 'Coupon has expired' };
  }

  // Check if usage limit is reached
  if (this.isUsageLimitReached) {
    return { isValid: false, message: 'Coupon usage limit reached' };
  }

  // Check minimum order amount
  if (orderAmount < this.minimumOrderAmount) {
    return {
      isValid: false,
      message: `Minimum order amount of ${this.minimumOrderAmount} required`,
    };
  }

  // Check if first time only and user has used it before
  if (this.isFirstTimeOnly) {
    const hasUsedBefore = this.lastUsedBy.some((usage: ICouponUsage) => usage.user.toString() === userId);
    if (hasUsedBefore) {
      return { isValid: false, message: 'Coupon can only be used once per customer' };
    }
  }

  return { isValid: true, message: 'Coupon is valid' };
};

// Method to calculate discount amount
couponSchema.methods.calculateDiscount = function (this: ICoupon, orderAmount: number) {
  let discountAmount = 0;

  if (this.discountType === 'percentage') {
    discountAmount = (orderAmount * this.discountValue) / 100;
  } else {
    discountAmount = this.discountValue;
  }

  // Apply maximum discount limit if set
  if (this.maximumDiscountAmount && discountAmount > this.maximumDiscountAmount) {
    discountAmount = this.maximumDiscountAmount;
  }

  // Ensure discount doesn't exceed order amount
  discountAmount = Math.min(discountAmount, orderAmount);

  return Math.round(discountAmount * 100) / 100; // Round to 2 decimal places
};

// Method to increment usage count
couponSchema.methods.incrementUsage = function (this: ICoupon, userId: string) {
  this.usedCount += 1;
  this.lastUsedBy.push({
    user: new mongoose.Types.ObjectId(userId) as any,
    usedAt: new Date(),
  });
  return this.save();
};

const Coupon = mongoose.model<ICoupon, ICouponModel>('Coupon', couponSchema);

export default Coupon;
