import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Vendor from "../models/Vendor";
import Branch from "../models/Branch";
import User from "../models/User";
import Role from "../models/Role";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";
import { IRole } from "../types";

/**
 * @desc    Register a new vendor
 * @route   POST /api/vendors/register
 * @access  Private (Super Admin)
 */
export const registerVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { userId, name, description, categoryId, phone, email, location, workingHours } = req.body;

    if (!userId) {
      return next(errorHandler(400, "User ID is required in request body"));
    }

    const vendorData: any = {
      userId,
      name,
      details: description,
      vendorCategory: categoryId,
      phone,
      email,
      location: location ? (typeof location === 'string' ? JSON.parse(location) : location) : {},
      slug: name ? name.toLowerCase().replace(/ /g, '-') : '',
    };

    // Handle logo and cover uploads
    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendorData.logo = uploadResult.url;
      vendorData.logoPublicId = uploadResult.public_id;
    }
    if (files?.banner) {
      const uploadResult = await uploadToCloudinary(files.banner[0], "dohez/vendors/covers");
      vendorData.cover = uploadResult.url;
      vendorData.coverPublicId = uploadResult.public_id;
    }

    const vendor = await Vendor.create(vendorData);

    // Create default main branch
    const branchData = {
      vendorId: vendor._id,
      name: `${name} - Main Branch`,
      email,
      phone,
      location: vendorData.location,
      workingHours: workingHours ? (typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours) : [],
      isMainBranch: true,
      isActive: true,
    };

    const branch = await Branch.create(branchData);
    
    // Add branch to vendor
    vendor.branches.push(branch._id as any);
    await vendor.save();

    // Assign Role and Vendor to User
    const vendorAdminRole = await Role.findOne({ name: 'vendor_admin' });
    if (vendorAdminRole) {
      await User.findByIdAndUpdate(userId, {
        $addToSet: { roles: vendorAdminRole._id },
        vendor: vendor._id,
      });
    }

    res.status(201).json({
      success: true,
      message: "Vendor registered successfully",
      data: { vendor, branch },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all vendors
 * @route   GET /api/vendors
 * @access  Public
 */
export const getVendors = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { search, page = 1, limit = 10 } = req.query;
    const query: any = { isActive: true };

    if (search) {
      query.name = { $regex: search, $options: "i" };
    }

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const vendors = await Vendor.find(query)
      .populate('vendorCategory')
      .populate('branches')
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Vendor.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        vendors,
        pagination: {
          currentPage: options.page,
          totalPages: totalPages,
          totalVendors: total,
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
 * @desc    Get single vendor by ID
 * @route   GET /api/vendors/:vendorId
 * @access  Public
 */
export const getVendorById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId)
      .populate('vendorCategory')
      .populate('branches');

    if (!vendor) {
      return next(errorHandler(404, "Vendor not found"));
    }

    res.status(200).json({
      success: true,
      data: { vendor },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update vendor profile
 * @route   PUT /api/vendors/:vendorId
 * @access  Private (Super Admin / Admin)
 */
export const updateVendorProfile = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, description, categoryId } = req.body;
    const { vendorId } = req.params;
    const userRole = (req.user as any)?.role;

    if (userRole !== 'super_admin' && userRole !== 'admin') {
      return next(errorHandler(403, "Not authorized to update vendor"));
    }

    const vendor = await Vendor.findById(vendorId);

    if (!vendor) {
      return next(errorHandler(404, "Vendor profile not found"));
    }

    if (name) vendor.name = name;
    if (description !== undefined) vendor.details = description;
    if (categoryId) vendor.vendorCategory = categoryId;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    if (files?.logo) {
      const uploadResult = await uploadToCloudinary(files.logo[0], "dohez/vendors/logos");
      vendor.logo = uploadResult.url;
    }
    if (files?.banner) {
      const uploadResult = await uploadToCloudinary(files.banner[0], "dohez/vendors/banners");
      vendor.cover = uploadResult.url;
    }

    await vendor.save();

    res.status(200).json({
      success: true,
      message: "Vendor profile updated successfully",
      data: { vendor },
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete vendor profile
 * @route   DELETE /api/vendors/:vendorId
 * @access  Private (Admin)
 */
export const deleteVendor = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const vendor = await Vendor.findById(req.params.vendorId);

    if (!vendor) {
      return next(errorHandler(404, "Vendor not found"));
    }

    // Delete associated branches
    await Branch.deleteMany({ vendorId: vendor._id });
    await vendor.deleteOne();

    res.status(200).json({
      success: true,
      message: "Vendor profile and associated branches deleted successfully",
    });
  } catch (error: any) {
    next(error);
  }
};
