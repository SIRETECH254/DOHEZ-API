import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../middleware/errorHandler";
import Branch from "../models/Branch";
import Vendor from "../models/Vendor";

/**
 * @desc    Create a new branch
 * @route   POST /api/branches
 * @access  Private (Vendor Owner)
 */
export const createBranch = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { vendorId, name, email, phone, location, workingHours } = req.body;
    
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

    const branches = await Branch.find(query)
      .limit(parseInt(limit as string))
      .skip((parseInt(page as string) - 1) * parseInt(limit as string));

    const total = await Branch.countDocuments(query);

    res.status(200).json({ 
        success: true, 
        data: { 
            branches, 
            pagination: { 
                currentPage: parseInt(page as string), 
                totalBranches: total 
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
    const branch = await Branch.findByIdAndUpdate(req.params.branchId, req.body, { new: true });
    if (!branch) return next(errorHandler(404, "Branch not found"));
    res.status(200).json({ success: true, data: { branch } });
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
