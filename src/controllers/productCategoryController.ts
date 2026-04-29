import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductCategory from "../models/ProductCategory";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

export const createProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, sort, productType } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-');
    const categoryData: any = { name, details, sort, productType, slug };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-categories/icons");
      categoryData.icon = uploadResult.url;
      categoryData.iconPublicId = uploadResult.public_id;
    }

    const category = await ProductCategory.create(categoryData);

    res.status(201).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};

export const getProductCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const query: any = search ? { name: { $regex: search, $options: "i" } } : {};
    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const categories = await ProductCategory.find(query)
      .populate("productType")
      .sort({ sort: 1, name: 1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductCategory.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            categories, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalCategories: total,
                hasNextPage: options.page < totalPages,
                hasPrevPage: options.page > 1
            } 
        } 
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProductCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ProductCategory.findById(req.params.id).populate("productType");

    if (!category) return next(errorHandler(404, "Category not found"));

    res.status(200).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};

export const updateProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, sort, productType } = req.body;
    const category = await ProductCategory.findById(req.params.id);

    if (!category) return next(errorHandler(404, "Category not found"));

    if (name) {
      category.name = name;
      category.slug = name.toLowerCase().replace(/ /g, '-');
    }

    if (details !== undefined) category.details = details;
    if (sort !== undefined) category.sort = sort;
    if (productType) category.productType = productType;

    if (req.file) {
      if (category.iconPublicId) await deleteFromCloudinary(category.iconPublicId);
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-categories/icons");
      category.icon = uploadResult.url;
      category.iconPublicId = uploadResult.public_id;
    }

    await category.save();

    res.status(200).json({ success: true, data: { category } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProductCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await ProductCategory.findByIdAndDelete(req.params.id);

    if (!category) return next(errorHandler(404, "Category not found"));

    if (category.iconPublicId) await deleteFromCloudinary(category.iconPublicId);

    res.status(200).json({ success: true, message: "Category deleted" });
  } catch (error: any) {
    next(error);
  }
};
