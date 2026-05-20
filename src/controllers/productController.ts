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
      modifiers,
      selectedModifierOptions,
      status, 
      trackInventory 
    } = req.body;

    // 1. Validation to prevent slugify error
    if (!name || typeof name !== 'string') {
      return next(errorHandler(400, "Product name is required"));
    }

    // 2. Parse JSON strings (common in multipart/form-data)
    const parsedVariants = variants ? (typeof variants === 'string' ? JSON.parse(variants) : variants) : [];
    const parsedSelectedVariantOptions = selectedVariantOptions ? (typeof selectedVariantOptions === 'string' ? JSON.parse(selectedVariantOptions) : selectedVariantOptions) : [];
    const parsedModifiers = modifiers ? (typeof modifiers === 'string' ? JSON.parse(modifiers) : modifiers) : [];
    const parsedSelectedModifierOptions = selectedModifierOptions ? (typeof selectedModifierOptions === 'string' ? JSON.parse(selectedModifierOptions) : selectedModifierOptions) : [];

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

    // 3. Create instance without saving yet to prevent unique index conflicts on null SKU codes
    const product = new Product({
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
      variants: parsedVariants,
      selectedVariantOptions: parsedSelectedVariantOptions,
      modifiers: parsedModifiers,
      selectedModifierOptions: parsedSelectedModifierOptions,
      status,
      trackInventory
    });

    // 4. Always generate SKUs (handles both default and variant cases)
    // This method calls product.save() internally
    await product.generateSKUs();

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Create a new appointment service
 * @access Admin/Super Admin
 */
export const createService = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      category, 
      vendor, 
      branch, 
      service, 
      duration, 
      buffertime 
    } = req.body;

    if (!name || !price || !vendor || !branch) {
      return next(errorHandler(400, "Missing required fields for service"));
    }

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

    const slug = slugify(name, { lower: true, strict: true });

    const product = new Product({
      name,
      slug,
      details,
      price,
      images,
      category,
      vendor,
      branch,
      service,
      duration,
      buffertime,
      trackInventory: false
    });

    await product.generateSKUs();

    res.status(201).json({
      success: true,
      data: { product }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Create a new event for ticketing
 * @access Admin/Super Admin
 */
export const createEvent = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { 
      name, 
      details, 
      price, 
      category, 
      vendor, 
      branch, 
      startDate, 
      endDate, 
      venue, 
      maxTicket,
      variants,
      selectedVariantOptions,
      location,
      openAt
    } = req.body;

    if (!name || !price || !vendor || !branch || !startDate || !endDate || !venue) {
      return next(errorHandler(400, "Missing required fields for event"));
    }

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

    const slug = slugify(name, { lower: true, strict: true });
    
    const parsedVariants = variants ? (typeof variants === 'string' ? JSON.parse(variants) : variants) : [];
    const parsedSelectedVariantOptions = selectedVariantOptions ? (typeof selectedVariantOptions === 'string' ? JSON.parse(selectedVariantOptions) : selectedVariantOptions) : [];
    const parsedLocation = location ? (typeof location === 'string' ? JSON.parse(location) : location) : undefined;

    const product = new Product({
      name,
      slug,
      details,
      price,
      images,
      category,
      vendor,
      branch,
      startDate,
      endDate,
      venue,
      maxTicket,
      variants: parsedVariants,
      selectedVariantOptions: parsedSelectedVariantOptions,
      location: parsedLocation,
      openAt,
      trackInventory: true
    });

    await product.generateSKUs();

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
      .populate("modifiers")
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
      .populate("variants")
      .populate("modifiers");

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
      modifiers,
      selectedModifierOptions,
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

    let shouldRegenerateSKUs = false;

    // Update basic fields
    if (name) {
      product.name = name;
      product.slug = slugify(name, { lower: true, strict: true });
      shouldRegenerateSKUs = true; // Slug change affects SKU codes
    }
    
    if (details !== undefined) product.details = details;
    
    if (price !== undefined) {
      product.price = price;
      shouldRegenerateSKUs = true;
    }
    
    if (offerPrice !== undefined) product.offerPrice = offerPrice;
    if (category) product.category = category;
    if (vendor) product.vendor = vendor;
    if (branch) product.branch = branch;
    if (service) product.service = service;
    
    if (variants !== undefined) {
      product.variants = typeof variants === 'string' ? JSON.parse(variants) : variants;
      // Changing allowed variants might not immediately affect SKUs, 
      // but it's safer to check integrity. 
      // For now, we only regenerate if selected options change.
    }

    if (modifiers !== undefined) {
      product.modifiers = typeof modifiers === 'string' ? JSON.parse(modifiers) : modifiers;
    }

    if (selectedModifierOptions !== undefined) {
      product.selectedModifierOptions = typeof selectedModifierOptions === 'string' 
        ? JSON.parse(selectedModifierOptions) 
        : selectedModifierOptions;
    }
    
    if (status !== undefined) product.status = status;
    if (trackInventory !== undefined) product.trackInventory = trackInventory;

    // Handle variant option updates and SKU regeneration
    if (selectedVariantOptions !== undefined) {
      product.selectedVariantOptions = typeof selectedVariantOptions === 'string' 
        ? JSON.parse(selectedVariantOptions) 
        : selectedVariantOptions;
      shouldRegenerateSKUs = true;
    }

    if (shouldRegenerateSKUs) {
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
