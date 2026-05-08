import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import ProductType from "../models/ProductType";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

export const createProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, order, service } = req.body;
    const slug = name.toLowerCase().replace(/ /g, '-');
    const productTypeData: any = { name, details, order, slug, service };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-types/icons");
      productTypeData.icon = uploadResult.url;
      productTypeData.iconPublicId = uploadResult.public_id;
    }

    const productType = await ProductType.create(productTypeData);

    res.status(201).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};

export const getProductTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, search, service } = req.query;
    const query: any = {};
    
    if (search) {
      query.name = { $regex: search, $options: "i" };
    }
    
    if (service) {
      query.service = service;
    }

    const options = { page: parseInt(page as string) || 1, limit: parseInt(limit as string) || 10 };

    const productTypes = await ProductType.find(query)
      .populate("service")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await ProductType.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            productTypes, 
            pagination: { 
                currentPage: options.page, 
                totalPages, 
                totalProductTypes: total,
                hasNextPage: options.page < totalPages,
                hasPrevPage: options.page > 1
            } 
        } 
    });
  } catch (error: any) {
    next(error);
  }
};

export const getProductTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productType = await ProductType.findById(req.params.id).populate("service");

    if (!productType) return next(errorHandler(404, "Product Type not found"));

    res.status(200).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};

export const updateProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, details, order, service } = req.body;
    const productType = await ProductType.findById(req.params.id);

    if (!productType) return next(errorHandler(404, "Product Type not found"));

    if (name) {
      productType.name = name;
      productType.slug = name.toLowerCase().replace(/ /g, '-');
    }

    if (details !== undefined) productType.details = details;
    if (order !== undefined) productType.order = order;
    if (service !== undefined) productType.service = service;

    if (req.file) {
      if (productType.iconPublicId) await deleteFromCloudinary(productType.iconPublicId);
      const uploadResult = await uploadToCloudinary(req.file, "dohez/product-types/icons");
      productType.icon = uploadResult.url;
      productType.iconPublicId = uploadResult.public_id;
    }

    await productType.save();

    res.status(200).json({ success: true, data: { productType } });
  } catch (error: any) {
    next(error);
  }
};

export const deleteProductType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const productType = await ProductType.findByIdAndDelete(req.params.id);

    if (!productType) return next(errorHandler(404, "Product Type not found"));

    if (productType.iconPublicId) await deleteFromCloudinary(productType.iconPublicId);

    res.status(200).json({ success: true, message: "Product Type deleted" });
  } catch (error: any) {
    next(error);
  }
};
