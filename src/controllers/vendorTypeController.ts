import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import VendorType from "../models/VendorType";
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
 * @desc    Create a new vendor type
 * @route   POST /api/vendor-types
 * @access  Private (Super Admin)
 */
export const createVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive } = req.body;

    if (!name) {
      return next(errorHandler(400, "Vendor type name is required"));
    }

    const slug = generateSlug(name);

    // Check if slug or name exists
    const existingType = await VendorType.findOne({ $or: [{ name }, { slug }] });
    if (existingType) {
      return next(errorHandler(400, "A vendor type with this name or slug already exists"));
    }

    const typeData: any = {
      name,
      description,
      slug,
      isActive: isActive !== undefined ? isActive : true,
    };

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-types");
      typeData.image = uploadResult.url;
      typeData.imagePublicId = uploadResult.public_id;
    }

    const vendorType = await VendorType.create(typeData);

    res.status(201).json({
      success: true,
      message: "Vendor type created successfully",
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all vendor types
 * @route   GET /api/vendor-types
 * @access  Public
 */
export const getVendorTypes = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, all, page = 1, limit = 10 } = req.query;
    const query: any = {};

    // For public view, only show active types unless 'all' is requested by an admin
    const isAdmin = req.user && (req.user.roles as IRole[]).some(role => 
      ['admin', 'super_admin'].includes(role.name as string)
    );

    if (!isAdmin || all !== 'true') {
      query.isActive = true;
    }

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const vendorTypes = await VendorType.find(query)
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await VendorType.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        vendorTypes,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalTypes: total,
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
 * @desc    Get single vendor type by ID or slug
 * @route   GET /api/vendor-types/:idOrSlug
 * @access  Public
 */
export const getVendorTypeById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const idOrSlug = req.params.idOrSlug as string;
    let vendorType;

    if (idOrSlug.match(/^[0-9a-fA-F]{24}$/)) {
      vendorType = await VendorType.findById(idOrSlug);
    } else {
      vendorType = await VendorType.findOne({ slug: idOrSlug });
    }

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    res.status(200).json({
      success: true,
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update vendor type
 * @route   PUT /api/vendor-types/:vendorTypeId
 * @access  Private (Super Admin)
 */
export const updateVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, isActive, image } = req.body;
    const vendorType = await VendorType.findById(req.params.vendorTypeId);

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    if (name) {
      vendorType.name = name;
      vendorType.slug = generateSlug(name);

      // Check for slug conflict
      const existing = await VendorType.findOne({ slug: vendorType.slug, _id: { $ne: vendorType._id } });
      if (existing) {
        return next(errorHandler(400, "A vendor type with this name already exists"));
      }
    }
    
    if (description !== undefined) vendorType.description = description;
    if (isActive !== undefined) vendorType.isActive = isActive;

    if (req.file) {
      const uploadResult = await uploadToCloudinary(req.file, "dohez/vendor-types");
      if (vendorType.imagePublicId) {
        await deleteFromCloudinary(vendorType.imagePublicId);
      }
      vendorType.image = uploadResult.url;
      vendorType.imagePublicId = uploadResult.public_id;
    } else if (image === null || image === "") {
      if (vendorType.imagePublicId) {
        await deleteFromCloudinary(vendorType.imagePublicId);
      }
      vendorType.image = null;
      vendorType.imagePublicId = null;
    }

    await vendorType.save();

    res.status(200).json({
      success: true,
      message: "Vendor type updated successfully",
      data: { vendorType },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete vendor type
 * @route   DELETE /api/vendor-types/:vendorTypeId
 * @access  Private (Super Admin)
 */
export const deleteVendorType = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendorType = await VendorType.findById(req.params.vendorTypeId);

    if (!vendorType) {
      return next(errorHandler(404, "Vendor type not found"));
    }

    if (vendorType.imagePublicId) {
      await deleteFromCloudinary(vendorType.imagePublicId);
    }

    await vendorType.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor type deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
