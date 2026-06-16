import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductModifier from "../models/ProductModifier";
import Branch from "../models/Branch";
import Product from "../models/Product";

/**
 * @description Attach a modifier to a product
 * @access Admin/Super Admin
 */
export const attachModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, modifierId, optionIds = [] } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    const modifier = await ProductModifier.findById(modifierId);
    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    // Optional: Validate that provided optionIds exist within the modifier
    if (optionIds.length > 0) {
      const validOptionIds = modifier.options.map(opt => opt._id?.toString());
      const invalidIds = optionIds.filter((id: string) => !validOptionIds.includes(id));
      if (invalidIds.length > 0) {
        return next(errorHandler(400, `Invalid option IDs for this modifier: ${invalidIds.join(", ")}`));
      }
    }

    // 1. Add to modifiers array if not already there
    const isAttached = product.modifiers.some((m: any) => m.toString() === modifierId);
    if (!isAttached) {
      product.modifiers.push(modifierId as any);
    }

    // 2. Update or Add to selectedModifierOptions
    const existingSelectionIndex = product.selectedModifierOptions.findIndex(
      (sel: any) => sel.modifierId.toString() === modifierId
    );

    if (existingSelectionIndex > -1) {
      // Update existing selection
      product.selectedModifierOptions[existingSelectionIndex].optionIds = optionIds;
    } else {
      // Add new selection
      product.selectedModifierOptions.push({
        modifierId: modifierId as any,
        optionIds: optionIds
      });
    }

    await product.save();

    res.status(200).json({
      success: true,
      message: "Modifier attached and configured successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Detach a modifier from a product
 * @access Admin/Super Admin
 */
export const detachModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { productId, modifierId } = req.body;

    const product = await Product.findById(productId);
    if (!product) return next(errorHandler(404, "Product not found"));

    // Remove from modifiers array
    product.modifiers = product.modifiers.filter((m: any) => m.toString() !== modifierId) as any;

    // Remove from selectedModifierOptions array
    product.selectedModifierOptions = product.selectedModifierOptions.filter(
      (sel: any) => sel.modifierId.toString() !== modifierId
    );

    await product.save();

    res.status(200).json({
      success: true,
      message: "Modifier detached successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

export const createProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, options, price, min_selection, max_selection, is_required, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const parsedOptions = options ? (typeof options === 'string' ? JSON.parse(options) : options) : [];

    const modifier = await ProductModifier.create({
      name,
      description,
      options: parsedOptions,
      price,
      min_selection,
      max_selection,
      is_required,
      branchId,
      vendor: branch.vendorId,
      sortOrder
    });

    res.status(201).json({
      success: true,
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProductModifiers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, branch, vendor } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    if (branch) query.branchId = branch;
    if (vendor) query.vendor = vendor;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const modifiers = await ProductModifier.find(query)
      .populate("branchId")
      .populate("vendor")
      .sort({ sortOrder: 1, createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductModifier.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        modifiers,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalModifiers: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProductModifierById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const modifier = await ProductModifier.findById(req.params.id).populate("branchId vendor");

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    res.status(200).json({
      success: true,
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const updateProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, options, price, min_selection, max_selection, is_required, branchId, sortOrder } = req.body;
    const modifier = await ProductModifier.findById(req.params.id);

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    if (name) modifier.name = name;
    if (description !== undefined) modifier.description = description;
    
    if (options !== undefined) {
      modifier.options = typeof options === 'string' ? JSON.parse(options) : options;
    }
    
    if (price !== undefined) modifier.price = price;
    if (min_selection !== undefined) modifier.min_selection = min_selection;
    if (max_selection !== undefined) modifier.max_selection = max_selection;
    if (is_required !== undefined) modifier.is_required = is_required;
    if (sortOrder !== undefined) modifier.sortOrder = sortOrder;
    
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return next(errorHandler(404, "Branch not found"));
      modifier.branchId = branchId;
      modifier.vendor = branch.vendorId as any;
    }

    await modifier.save();

    res.status(200).json({
      success: true,
      message: "Product modifier updated successfully",
      data: {
        modifier
      }
    });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const modifier = await ProductModifier.findByIdAndDelete(req.params.id);

    if (!modifier) return next(errorHandler(404, "Product modifier not found"));

    res.status(200).json({
      success: true,
      message: "Product modifier deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
