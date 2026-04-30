import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Variant from "../models/Variant";
import Branch from "../models/Branch";

export const createVariant = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, options, branchId, sortOrder } = req.body;

    const branch = await Branch.findById(branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));

    const variant = await Variant.create({ name, options, branchId, sortOrder });

    res.status(201).json({ success: true, data: { variant } });
  } catch (error: any) {
    next(error);
  }
};

export const getVariants = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = search ? { name: { $regex: search, $options: "i" } } : {};
    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const variants = await Variant.find(query)
      .populate("branchId")
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
    const variant = await Variant.findById(req.params.id).populate("branchId");

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
