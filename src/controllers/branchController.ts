import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Branch from "../models/Branch";
import Vendor from "../models/Vendor";
import User from "../models/User";
import Role from "../models/Role";
import { uploadToCloudinary, deleteFromCloudinary } from "../config/cloudinary";

/**
 * @desc    Create a new branch
 * @route   POST /api/branches
 * @access  Private (Vendor Owner)
 */
export const createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, name, email, phone, location, workingHours, managerId } = req.body;
    
    const vendor = await Vendor.findById(vendorId);
    if (!vendor) return next(errorHandler(404, "Vendor not found"));

    const branchData: any = {
      vendorId,
      name,
      email,
      phone,
      location: typeof location === 'string' ? JSON.parse(location) : location,
      workingHours: typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours,
    };

    const branch = await Branch.create(branchData);
    vendor.branches.push(branch._id as any);
    await vendor.save();

    // Assign Role and Branch to User
    const branchAdminRole = await Role.findOne({ name: 'branch_admin' });
    const targetUserId = managerId || (req.user as any)?._id;
    
    if (branchAdminRole && targetUserId) {
      await User.findByIdAndUpdate(targetUserId, {
        $addToSet: { roles: branchAdminRole._id },
        branch: branch._id,
        vendor: vendorId
      });
    }

    res.status(201).json({ success: true, data: { branch } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Get all branches
 * @route   GET /api/branches
 * @access  Public
 */
export const getBranches = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, page = 1, limit = 10 } = req.query;
    const query: any = vendorId ? { vendorId } : {};

    const options = {
      page: parseInt(page as string, 10) || 1,
      limit: parseInt(limit as string, 10) || 10
    };

    const branches = await Branch.find(query)
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Branch.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({ 
        success: true, 
        data: { 
            branches, 
            pagination: { 
                currentPage: options.page,
                totalPages: totalPages,
                totalBranches: total,
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
 * @desc    Get single branch by ID
 * @route   GET /api/branches/:branchId
 * @access  Public
 */
export const getBranchById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branch = await Branch.findById(req.params.branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    res.status(200).json({ success: true, data: { branch } });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Update branch
 * @route   PUT /api/branches/:branchId
 * @access  Private (Vendor Owner)
 */
export const updateBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, email, phone, location, workingHours, fulfillmentConfig, gallery, cover } = req.body;
    const branch = await Branch.findById(req.params.branchId);

    if (!branch) return next(errorHandler(404, "Branch not found"));

    if (name) branch.name = name;
    if (email) branch.email = email;
    if (phone) branch.phone = phone;
    
    if (location) {
      branch.location = typeof location === 'string' ? JSON.parse(location) : location;
    }
    
    if (workingHours) {
      branch.workingHours = typeof workingHours === 'string' ? JSON.parse(workingHours) : workingHours;
    }

    if (fulfillmentConfig) {
      branch.fulfillmentConfig = typeof fulfillmentConfig === 'string' ? JSON.parse(fulfillmentConfig) : fulfillmentConfig;
    }

    if (gallery) {
      branch.gallery = typeof gallery === 'string' ? JSON.parse(gallery) : gallery;
    }

    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;

    // Handle Cover Image
    if (files && files['cover']) {
      const uploadResult = await uploadToCloudinary(files['cover'][0], "dohez/branches/covers");

      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }

      branch.cover = uploadResult.url;
      branch.coverPublicId = uploadResult.public_id;
    } else if (cover === null || (typeof cover === "string" && cover.trim().length === 0)) {
      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }
      branch.cover = null;
      branch.coverPublicId = null;
    } else if (typeof cover === "string" && cover.trim().length > 0) {
      if (branch.coverPublicId) {
        try {
          await deleteFromCloudinary(branch.coverPublicId);
        } catch (deleteError) {
          console.error("Failed to delete previous cover:", deleteError);
        }
      }
      branch.cover = cover.trim();
      branch.coverPublicId = null;
    }

    // Handle Gallery Images (Append new uploads)
    if (files && files['gallery']) {
      for (const file of files['gallery']) {
        const uploadResult = await uploadToCloudinary(file, "dohez/branches/gallery");
        branch.gallery.push({
          url: uploadResult.url,
          publicId: uploadResult.public_id
        });
      }
    }

    await branch.save();

    res.status(200).json({ 
      success: true, 
      message: "Branch updated successfully",
      data: { branch } 
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @desc    Delete branch
 * @route   DELETE /api/branches/:branchId
 * @access  Private (Vendor Owner)
 */
export const deleteBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const branch = await Branch.findByIdAndDelete(req.params.branchId);
    if (!branch) return next(errorHandler(404, "Branch not found"));
    res.status(200).json({ success: true, message: "Branch deleted" });
  } catch (error: any) {
    next(error);
  }
};
