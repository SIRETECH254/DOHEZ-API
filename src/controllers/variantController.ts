import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Variant from "../models/Variant";
import Branch from "../models/Branch";
import Product from "../models/Product";

/**
 * @description Attach a variant to a product
 * @access Admin/Super Admin
 */
export const attachVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, variantId, optionIds = [] } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    const variant = await Variant.findById(variantId);
    if (!variant) return next(errorHandler(404, "Variant not found"));

    // Optional: Validate that provided optionIds exist within the variant
    if (optionIds.length > 0) {
      const validOptionIds = variant.options.map(opt => opt._id?.toString());
      const invalidIds = optionIds.filter((id: string) => !validOptionIds.includes(id));
      if (invalidIds.length > 0) {
        return next(errorHandler(400, `Invalid option IDs for this variant: ${invalidIds.join(", ")}`));
      }
    }

    // 1. Add to variants array if not already there
    const isAttached = product.variants.some((v: any) => v.toString() === variantId);
    if (!isAttached) {
      product.variants.push(variantId as any);
    }
    
    // 2. Update or Add to selectedVariantOptions
    const existingSelectionIndex = product.selectedVariantOptions.findIndex(
      (sel: any) => sel.variantId.toString() === variantId
    );

    if (existingSelectionIndex > -1) {
      // Update existing selection
      product.selectedVariantOptions[existingSelectionIndex].optionIds = optionIds;
    } else {
      // Add new selection
      product.selectedVariantOptions.push({
        variantId: variantId as any,
        optionIds: optionIds
      });
    }

    // 3. Generate SKUs and save
    await product.generateSKUs();

    res.status(200).json({
      success: true,
      message: "Variant attached and configured successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Detach a variant from a product
 * @access Admin/Super Admin
 */
export const detachVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, variantId } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    // Remove from variants array
    product.variants = product.variants.filter((v: any) => v.toString() !== variantId) as any;

    // Remove from selectedVariantOptions array
    product.selectedVariantOptions = product.selectedVariantOptions.filter(
      (sel: any) => sel.variantId.toString() !== variantId
    );

    await product.generateSKUs();

    res.status(200).json({
      success: true,
      message: "Variant detached successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

export const createVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, options, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const variant = await Variant.create({ name, options, branchId, vendor: branch.vendorId, sortOrder });

    res.status(201).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};

export const getVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, branch, vendor } = req.query;
    const query: any = {};
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    
    if (branch) query.branchId = branch;
    if (vendor) query.vendor = vendor;

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const variants = await Variant.find(query)
      .populate("branchId")
      .populate("vendor")
      .sort({ sortOrder: 1, createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Variant.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
      success: true, 
      data: { 
        variants, 
        pagination: { 
          currentPage: options.page, 
          totalPages, 
          totalVariants: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        } 
      } 
    });
  } catch (error: any) {
    next(error);
  }
};

export const getVariantById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variant = await Variant.findById(req.params.id).populate("branchId vendor");

    if (!variant) return next(errorHandler(404, "Variant not found"));

    res.status(200).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};

export const updateVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, options, branchId, sortOrder } = req.body;
    const variant = await Variant.findById(req.params.id);

    if (!variant) return next(errorHandler(404, "Variant not found"));

    if (name) variant.name = name;
    if (options) variant.options = options;
    if (sortOrder !== undefined) variant.sortOrder = sortOrder;
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return next(errorHandler(404, "Branch not found"));
      variant.branchId = branchId;
      variant.vendor = branch.vendorId as any;
    }

    await variant.save();

    res.status(200).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const variant = await Variant.findByIdAndDelete(req.params.id);

    if (!variant) return next(errorHandler(404, "Variant not found"));

    res.status(200).json({ success: true, message: "Variant deleted" });
  } catch (error: any) {
    next(error);
  }
};
