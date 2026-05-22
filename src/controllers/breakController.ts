import { Request, Response, NextFunction } from "express";
import Break from "../models/Break";
import User from "../models/User";
import Role from "../models/Role";
import { errorHandler } from "../middleware/errorHandler";

/**
 * @description Create a new break record
 * @access Private (Authorized Roles)
 */
export const createBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { staff: staffId, startTime, endTime, reason } = req.body;

    // Verify staff user exists and has the 'staff' role
    const staffUser = await User.findById(staffId).populate("roles");
    if (!staffUser) {
      return next(errorHandler(404, "Staff user not found"));
    }

    const hasStaffRole = (staffUser.roles as any[]).some(
      (role) => role.name === "staff"
    );

    if (!hasStaffRole) {
      return next(errorHandler(403, "Breaks can only be created for users with the 'staff' role"));
    }

    const newBreak = await Break.create({
      staff: staffId,
      startTime,
      endTime,
      reason
    });

    res.status(201).json({
      success: true,
      message: "Break created successfully",
      data: {
        break: newBreak
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Get a single break record by ID
 * @access Private (Authorized Roles)
 */
export const getBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakRecord = await Break.findById(req.params.id).populate("staff", "firstName lastName email");

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    res.status(200).json({
      success: true,
      data: {
        break: breakRecord
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description List all breaks with pagination
 * @access Private (Authorized Roles)
 */
export const getBreaks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { page = 1, limit = 10, staff } = req.query;

    const query: any = {};
    if (staff) query.staff = staff;

    const options = {
      page: parseInt(page as string) || 1,
      limit: parseInt(limit as string) || 10
    };

    const breaks = await Break.find(query)
      .populate("staff", "firstName lastName email")
      .sort({ createdAt: -1 })
      .limit(options.limit)
      .skip((options.page - 1) * options.limit);

    const total = await Break.countDocuments(query);
    const totalPages = Math.ceil(total / options.limit);

    res.status(200).json({
      success: true,
      data: {
        breaks,
        pagination: {
          currentPage: options.page,
          totalPages,
          totalBreaks: total,
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
 * @description Update an existing break record
 * @access Private (Authorized Roles)
 */
export const updateBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { startTime, endTime, reason } = req.body;
    const breakRecord = await Break.findById(req.params.id);

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    if (startTime) breakRecord.startTime = startTime;
    if (endTime) breakRecord.endTime = endTime;
    if (reason !== undefined) breakRecord.reason = reason;

    await breakRecord.save();

    res.status(200).json({
      success: true,
      message: "Break record updated successfully",
      data: {
        break: breakRecord
      }
    });
  } catch (error: any) {
    next(error);
  }
};

/**
 * @description Delete a break record
 * @access Private (Authorized Roles)
 */
export const deleteBreak = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const breakRecord = await Break.findByIdAndDelete(req.params.id);

    if (!breakRecord) {
      return next(errorHandler(404, "Break record not found"));
    }

    res.status(200).json({
      success: true,
      message: "Break record deleted successfully"
    });
  } catch (error: any) {
    next(error);
  }
};
