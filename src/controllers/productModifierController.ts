import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductModifier from "../models/ProductModifier";
import Branch from "../models/Branch";

export const createProductModifier = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, price, min_selection, max_selection, is_required, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const modifier = await ProductModifier.create({
      name,
      description,
      price,
      min_selection,
      max_selection,
      is_required,
      branchId,
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
    const { page = 1, limit = 10, search } = req.query;
    const query: any = {};

    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } }
      ];
    }

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const modifiers = await ProductModifier.find(query)
      .populate("branchId")
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
    const modifier = await ProductModifier.findById(req.params.id).populate("branchId");

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
    if (options !== undefined) modifier.options = options;
    if (price !== undefined) modifier.price = price;
    if (min_selection !== undefined) modifier.min_selection = min_selection;
    if (max_selection !== undefined) modifier.max_selection = max_selection;
    if (is_required !== undefined) modifier.is_required = is_required;
    if (sortOrder !== undefined) modifier.sortOrder = sortOrder;
    
    if (branchId) {
      const branch = await Branch.findById(branchId);
      if (!branch) return next(errorHandler(404, "Branch not found"));
      modifier.branchId = branchId;
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
