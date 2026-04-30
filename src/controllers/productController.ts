import type { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Product from "../models/Product";
import slugify from "slugify";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

/**
 * @description Create a new product
 * @access Admin/Super Admin
 */
export const createProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      offerPrice, 
      category, 
      vendor, 
      branch, 
      service, 
      variants, 
      selectedVariantOptions, 
      status, 
      trackInventory 
    } = req.body;

    const files = req.files as Express.Multer.File[];
    let images: Array<{ url: string; publicId: string }> = [];

    if (files && files.length > 0) {
      images = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToCloudinary(file, "dohez/products");
          return { url: result.url, publicId: result.public_id };
        })
      );
    }

    // Generate lowercased slug from name
    const slug = slugify(name, { lower: true, strict: true });

    const product = await Product.create({
      name,
      slug,
      details,
      price,
      offerPrice,
      images,
      category,
      vendor,
      branch,
      service,
      variants,
      selectedVariantOptions,
      status,
      trackInventory
    });

    // Generate SKUs if variant options are selected
    if (selectedVariantOptions && selectedVariantOptions.length > 0) {
      await product.generateSKUs();
    }

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Get all products with pagination, search, and filtering
 * @access Public/Admin
 */
export const getProducts = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search,
      category,
      vendor,
      branch,
      service,
      status 
    } = req.query;

    const query: any = {};

    // Search by name or details
    if (search) {
      query.$or = [
        { name: { $regex: search, $options: "i" } },
        { details: { $regex: search, $options: "i" } }
      ];
    }

    // Filters
    if (category) query.category = category;
    if (vendor) query.vendor = vendor;
    if (branch) query.branch = branch;
    if (service) query.service = service;
    if (status !== undefined) query.status = status === 'true';

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const products = await Product.find(query)
      .populate("category")
      .populate("vendor")
      .populate("branch")
      .populate("service")
      .populate("variants")
      .sort({ createdAt: "desc" })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Product.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        products,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalProducts: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Get single product by ID
 * @access Public/Admin
 */
export const getProductById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findById(req.params.id)
      .populate("category")
      .populate("vendor")
      .populate("branch")
      .populate("service")
      .populate("variants");

    if (!product) return next(errorHandler(404, "Product not found"));

    res.status(200).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Update an existing product
 * @access Admin/Super Admin
 */
export const updateProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      offerPrice, 
      category, 
      vendor, 
      branch, 
      service, 
      variants, 
      selectedVariantOptions, 
      status, 
      trackInventory 
    } = req.body;

    const product = await Product.findById(req.params.id);
    if (!product) return next(errorHandler(404, "Product not found"));

    const files = req.files as Express.Multer.File[];
    if (files && files.length > 0) {
      // Delete old images from Cloudinary
      if (product.images && product.images.length > 0) {
        await Promise.all(product.images.map((img) => deleteFromCloudinary(img.publicId)));
      }

      // Upload new images
      const newImages = await Promise.all(
        files.map(async (file) => {
          const result = await uploadToCloudinary(file, "dohez/products");
          return { url: result.url, publicId: result.public_id };
        })
      );
      product.images = newImages;
    }

    // Update basic fields
    if (name) {
      product.name = name;
      product.slug = slugify(name, { lower: true, strict: true });
    }
    
    if (details !== undefined) product.details = details;
    if (price !== undefined) product.price = price;
    if (offerPrice !== undefined) product.offerPrice = offerPrice;
    if (category) product.category = category;
    if (vendor) product.vendor = vendor;
    if (branch) product.branch = branch;
    if (service) product.service = service;
    if (variants !== undefined) product.variants = variants;
    if (status !== undefined) product.status = status;
    if (trackInventory !== undefined) product.trackInventory = trackInventory;

    // Handle variant option updates and SKU regeneration
    if (selectedVariantOptions !== undefined) {
      product.selectedVariantOptions = selectedVariantOptions;
      await product.generateSKUs(); // This handles saving
    } else {
      await product.save();
    }

    res.status(200).json({
      success: true,
      message: "Product updated successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Delete a product
 * @access Admin/Super Admin
 */
export const deleteProduct = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);

    if (!product) return next(errorHandler(404, "Product not found"));

    // Delete images from Cloudinary
    if (product.images && product.images.length > 0) {
      await Promise.all(product.images.map((img) => deleteFromCloudinary(img.publicId)));
    }

    res.status(200).json({
      success: true,
      message: "Product deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Update specific SKU details
 * @access Admin/Super Admin
 */
export const updateProductSKU = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { id, skuId } = req.params;
    const updateData = req.body;

    const product = await Product.findById(id);
    if (!product) return next(errorHandler(404, "Product not found"));

    await product.updateSKU(skuId as string, updateData);

    res.status(200).json({
      success: true,
      message: "SKU updated successfully",
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};
