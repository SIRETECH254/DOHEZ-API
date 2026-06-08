import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import VendorCategory from "../models/VendorCategory";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";

/**
 * Helper to generate slug from name
 */
const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '') // Remove non-word chars
    .replace(/[\s_-]+/g, '-') // Replace spaces/underscores with -
    .replace(/^-+|-+$/g, ''); // Remove leading/trailing -
};

/**
 * @desc    Create a new vendor category
 * @route   POST /api/vendor-categories
 * @access  Private (Super Admin)
 */
export const createVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, vendorType } = req.body;

    if (!name) {
      return next(errorHandler(400, "Category name is required"));
    }

    const slug = generateSlug(name);

    // Check if slug exists
    const existingCategory = await VendorCategory.findOne({ slug });
    if (existingCategory) {
      return next(errorHandler(400, "A category with this name already exists (slug conflict)"));
    }

    const categoryData: any = {
      name,
      description,
      slug,
      vendorType: vendorType || null,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-categories");
      categoryData.image = uploadResult.url;
      categoryData.imagePublicId = uploadResult.public_id;
    }

    const category = await VendorCategory.create(categoryData);

    res.status(201).json({
      success: true,
      message: "Vendor category created successfully",
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all vendor categories
 * @route   GET /api/vendor-categories
 * @access  Public
 */
export const getVendorCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, vendorType, page = 1, limit = 10 } = req.query;
    const query: any = {};

    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    if (vendorType) {
      query.vendorType = vendorType;
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const categories = await VendorCategory.find(query)
      .populate('vendorType')
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await VendorCategory.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        categories,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalCategories: total,
          hasNextPage: options.page < totalPages,
          hasPrevPage: options.page > 1
        }
      },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get single vendor category by ID or slug
 * @route   GET /api/vendor-categories/:idOrSlug
 * @access  Public
 */
export const getVendorCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idOrSlug = req.params.idOrSlug as string;
    let category;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      category = await VendorCategory.findById(idOrSlug).populate('vendorType');
    } else {
      category = await VendorCategory.findOne({ slug: idOrSlug }).populate('vendorType');
    }

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    res.status(200).json({
      success: true,
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update vendor category
 * @route   PUT /api/vendor-categories/:categoryId
 * @access  Private (Super Admin)
 */
export const updateVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image, vendorType } = req.body;
    const category = await VendorCategory.findById(req.params.categoryId);

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    if (name) {
      category.name = name;
      category.slug = generateSlug(name);
      
      // Check if new slug conflicts with another category
      const existing = await VendorCategory.findOne({ slug: category.slug, _id: { $ne: category._id } });
      if (existing) {
        return next(errorHandler(400, "A category with this name already exists"));
      }
    }
    
    if (description !== undefined) category.description = description;
    if (isActive !== undefined) category.isActive = isActive;
    if (vendorType !== undefined) category.vendorType = vendorType;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-categories");
      if (category.imagePublicId) {
        await deleteFromCloudinary(category.imagePublicId);
      }
      category.image = uploadResult.url;
      category.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (category.imagePublicId) {
        await deleteFromCloudinary(category.imagePublicId);
      }
      category.image = null;
      category.imagePublicId = null;
    }

    await category.save();

    res.status(200).json({
      success: true,
      message: "Vendor category updated successfully",
      data: { category },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete vendor category
 * @route   DELETE /api/vendor-categories/:categoryId
 * @access  Private (Super Admin)
 */
export const deleteVendorCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const category = await VendorCategory.findById(req.params.categoryId);

    if (!category) {
      return next(errorHandler(404, "Vendor category not found"));
    }

    if (category.imagePublicId) {
      await deleteFromCloudinary(category.imagePublicId);
    }

    await category.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor category deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
