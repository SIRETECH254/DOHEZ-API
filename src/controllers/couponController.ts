import { Request, Response, NextFunction } from "express";
import Coupon from "../models/Coupon";
import { errorHandler } from "../middleware/errorHandler";
import mongoose from "mongoose";

export const createCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const {
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      hasExpiry,
      expiryDate,
      hasUsageLimit,
      usageLimit,
      isFirstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      vendor,
      branch
    } = req.body;

    if (!name || !discountType || !discountValue) {
      return next(errorHandler(400, 'Name, discount type, and discount value are required'));
    }

    if (discountValue <= 0) {
      return next(errorHandler(400, 'Discount value must be greater than 0'));
    }

    if (discountType === 'percentage' && discountValue > 100) {
      return next(errorHandler(400, 'Percentage discount cannot exceed 100%'));
    }

    if (hasExpiry && expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry <= new Date()) {
        return next(errorHandler(400, 'Expiry date must be in the future'));
      }
    }

    if (hasUsageLimit && (!usageLimit || usageLimit < 1)) {
      return next(errorHandler(400, 'Usage limit must be at least 1'));
    }

    const code = await (Coupon as any).generateUniqueCode();

    const coupon = new Coupon({
      code,
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount: minimumOrderAmount || 0,
      maximumDiscountAmount,
      hasExpiry,
      expiryDate: hasExpiry ? expiryDate : null,
      hasUsageLimit,
      usageLimit: hasUsageLimit ? usageLimit : null,
      isFirstTimeOnly: isFirstTimeOnly || false,
      applicableProducts: applicableProducts || [],
      applicableCategories: applicableCategories || [],
      excludedProducts: excludedProducts || [],
      excludedCategories: excludedCategories || [],
      vendor,
      branch,
      createdBy: req.user?._id
    });

    await coupon.save();

    res.status(201).json({
      success: true,
      message: "Coupon created successfully",
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getAllCoupons = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, isActive, vendor, branch } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { code: { $regex: search, $options: "i" } },
        { name: { $regex: search, $options: "i" } }
      ];
    }

    if (isActive !== undefined) {
      query.isActive = isActive === "true";
    }

    if (vendor) {
      query.vendor = vendor;
    }

    if (branch) {
      query.branch = branch;
    }

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const coupons = await Coupon.find(query)
      .populate("vendor branch createdBy")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Coupon.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        coupons,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalCoupons: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCouponById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupon = await Coupon.findById(req.params.couponId)
      .populate("vendor branch createdBy applicableProducts applicableCategories excludedProducts excludedCategories");

    if (!coupon) return next(errorHandler(404, "Coupon not found"));

    res.status(200).json({
      success: true,
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;
    const {
      name,
      description,
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumDiscountAmount,
      isActive,
      hasExpiry,
      expiryDate,
      hasUsageLimit,
      usageLimit,
      isFirstTimeOnly,
      applicableProducts,
      applicableCategories,
      excludedProducts,
      excludedCategories,
      vendor,
      branch
    } = req.body;

    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    if (discountValue !== undefined) {
      if (discountValue <= 0) {
        return next(errorHandler(400, 'Discount value must be greater than 0'));
      }
      const type = discountType || coupon.discountType;
      if (type === 'percentage' && discountValue > 100) {
        return next(errorHandler(400, 'Percentage discount cannot exceed 100%'));
      }
    }

    if (hasExpiry && expiryDate) {
      const expiry = new Date(expiryDate);
      if (expiry <= new Date()) {
        return next(errorHandler(400, 'Expiry date must be in the future'));
      }
    }

    if (hasUsageLimit && usageLimit !== undefined) {
      if (usageLimit < 1) {
        return next(errorHandler(400, 'Usage limit must be at least 1'));
      }
      if (usageLimit < coupon.usedCount) {
        return next(errorHandler(400, 'Usage limit cannot be less than current usage count'));
      }
    }

    if (name !== undefined) coupon.name = name;
    if (description !== undefined) coupon.description = description;
    if (discountType !== undefined) coupon.discountType = discountType;
    if (discountValue !== undefined) coupon.discountValue = discountValue;
    if (minimumOrderAmount !== undefined) coupon.minimumOrderAmount = minimumOrderAmount;
    if (maximumDiscountAmount !== undefined) coupon.maximumDiscountAmount = maximumDiscountAmount;
    if (isActive !== undefined) coupon.isActive = isActive;
    if (hasExpiry !== undefined) coupon.hasExpiry = hasExpiry;
    if (expiryDate !== undefined) coupon.expiryDate = hasExpiry ? expiryDate : null;
    if (hasUsageLimit !== undefined) coupon.hasUsageLimit = hasUsageLimit;
    if (usageLimit !== undefined) coupon.usageLimit = hasUsageLimit ? usageLimit : null;
    if (isFirstTimeOnly !== undefined) coupon.isFirstTimeOnly = isFirstTimeOnly;
    if (applicableProducts !== undefined) coupon.applicableProducts = applicableProducts;
    if (applicableCategories !== undefined) coupon.applicableCategories = applicableCategories;
    if (excludedProducts !== undefined) coupon.excludedProducts = excludedProducts;
    if (excludedCategories !== undefined) coupon.excludedCategories = excludedCategories;
    if (vendor !== undefined) coupon.vendor = vendor;
    if (branch !== undefined) coupon.branch = branch;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'Coupon updated successfully',
      data: {
        coupon
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    if (coupon.usedCount > 0) {
      return next(errorHandler(400, 'Cannot delete coupon that has been used'));
    }

    await Coupon.findByIdAndDelete(couponId);

    res.status(200).json({
      success: true,
      message: 'Coupon deleted successfully'
    });
  } catch (error: any) {
    next(error);
  }
};

export const validateCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, branch, vendor } = req.body;
    const { orderAmount = "0" } = req.query;
    const userId = req.user?._id || (req.user as any)?.userId;

    if (!code) {
      return next(errorHandler(400, 'Coupon code is required'));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      res.status(200).json({
        success: false,
        message: 'Invalid coupon code'
      });
      return;
    }

    if (coupon.vendor && vendor && String(coupon.vendor) !== String(vendor)) {
      res.status(200).json({
        success: false,
        message: 'Coupon is not valid for this vendor'
      });
      return;
    }

    if (coupon.branch && branch && String(coupon.branch) !== String(branch)) {
      res.status(200).json({
        success: false,
        message: 'Coupon is not valid for this branch'
      });
      return;
    }

    const validation = (coupon as any).validateCoupon(userId ? String(userId) : "", parseFloat(orderAmount as string));

    if (!validation.isValid) {
      res.status(200).json({
        success: false,
        message: validation.message
      });
      return;
    }

    const discountAmount = (coupon as any).calculateDiscount(parseFloat(orderAmount as string));

    res.status(200).json({
      success: true,
      message: 'Coupon is valid',
      data: {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          name: coupon.name,
          description: coupon.description,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue,
          minimumOrderAmount: coupon.minimumOrderAmount,
          maximumDiscountAmount: coupon.maximumDiscountAmount
        },
        discountAmount,
        orderAmount: parseFloat(orderAmount as string),
        finalAmount: parseFloat(orderAmount as string) - discountAmount
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const applyCoupon = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { code, orderAmount, branch, vendor } = req.body;
    const userId = req.user?._id;

    if (!code) {
      return next(errorHandler(400, 'Coupon code is required'));
    }

    if (!orderAmount || orderAmount <= 0) {
      return next(errorHandler(400, 'Valid order amount is required'));
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() });

    if (!coupon) {
      return next(errorHandler(404, 'Invalid coupon code'));
    }

    if (coupon.vendor && vendor && String(coupon.vendor) !== String(vendor)) {
      return next(errorHandler(400, 'Coupon is not valid for this vendor'));
    }

    if (coupon.branch && branch && String(coupon.branch) !== String(branch)) {
      return next(errorHandler(400, 'Coupon is not valid for this branch'));
    }

    const validation = (coupon as any).validateCoupon(String(userId), orderAmount);

    if (!validation.isValid) {
      return next(errorHandler(400, validation.message));
    }

    const discountAmount = (coupon as any).calculateDiscount(orderAmount);

    res.status(200).json({
      success: true,
      message: 'Coupon applied successfully',
      data: {
        coupon: {
          _id: coupon._id,
          code: coupon.code,
          name: coupon.name,
          discountType: coupon.discountType,
          discountValue: coupon.discountValue
        },
        discountAmount,
        orderAmount,
        finalAmount: orderAmount - discountAmount
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getCouponStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const coupon = await Coupon.findById(req.params.couponId);

    if (!coupon) return next(errorHandler(404, "Coupon not found"));

    res.status(200).json({
      success: true,
      data: {
        stats: {
          usedCount: coupon.usedCount,
          usageLimit: coupon.usageLimit,
          remainingUsage: (coupon as any).remainingUsage,
          lastUsedBy: coupon.lastUsedBy
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const generateNewCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { couponId } = req.params;
    const coupon = await Coupon.findById(couponId);

    if (!coupon) {
      return next(errorHandler(404, 'Coupon not found'));
    }

    if (coupon.usedCount > 0) {
      return next(errorHandler(400, 'Cannot change code for coupon that has been used'));
    }

    const newCode = await (Coupon as any).generateUniqueCode();
    coupon.code = newCode;

    await coupon.save();

    res.status(200).json({
      success: true,
      message: 'New coupon code generated successfully',
      data: {
        code: newCode
      }
    });
  } catch (error: any) {
    next(error);
  }
};
